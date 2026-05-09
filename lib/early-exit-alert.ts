// ═══════════════════════════════════════════════════════════════
// Early Exit Alert — Notify parent & coordinator when student
// leaves a live session before scheduled end without approval.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { earlyExitAlertTemplate } from '@/lib/email-templates';

/**
 * Called from webhook participant_left handler.
 * Non-blocking fire-and-forget: caller should .catch() errors.
 *
 * Logic:
 * 1. Is the room still live (not ended)?
 * 2. Does the student have approved leave?
 * 3. Is there meaningful time remaining (>5 min)?
 * If all checks pass → send alerts to parent + coordinator.
 */
export async function notifyEarlyExit(
  roomId: string,
  studentEmail: string,
  studentName: string,
): Promise<void> {
  // 1. Get room details — only alert if room is still live
  const roomRes = await db.query(
    `SELECT room_name, subject, coordinator_email, status,
            scheduled_start, duration_minutes, batch_id
     FROM rooms WHERE room_id = $1`,
    [roomId],
  );
  const room = roomRes.rows[0] as {
    room_name: string; subject: string; coordinator_email: string | null;
    status: string; scheduled_start: string; duration_minutes: number; batch_id: string;
  } | undefined;
  if (!room || room.status !== 'live') return;

  // 2. Check if student had approved leave
  const attRes = await db.query(
    `SELECT leave_approved FROM attendance_sessions
     WHERE room_id = $1 AND participant_email = $2`,
    [roomId, studentEmail],
  );
  if (attRes.rows[0]?.leave_approved === true) return;

  // 3. Calculate remaining time — only alert if >5 minutes left
  const scheduledEnd = new Date(
    new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000,
  );
  const now = new Date();
  const remainingMs = scheduledEnd.getTime() - now.getTime();
  const remainingMinutes = Math.round(remainingMs / 60_000);

  if (remainingMinutes <= 5) return; // class is almost over, don't alert

  // 4. Format times for email
  const fmtOpts: Intl.DateTimeFormatOptions = {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  };
  const scheduledEndStr = scheduledEnd.toLocaleString('en-IN', {
    ...fmtOpts, day: 'numeric', month: 'short',
  });
  const exitTimeStr = now.toLocaleString('en-IN', {
    ...fmtOpts, day: 'numeric', month: 'short',
  });

  // 5. Log monitoring alert
  await db.query(
    `INSERT INTO monitoring_alerts (room_id, alert_type, severity, title, message, target_email, status)
     VALUES ($1, 'unusual_leave', 'warning', $2, $3, $4, 'active')`,
    [
      roomId,
      `${studentName} left early`,
      `Student left "${room.room_name}" with ~${remainingMinutes} minutes remaining. No approved leave.`,
      studentEmail,
    ],
  );

  // 6. Look up parent email and name
  const profileRes = await db.query(
    `SELECT up.parent_email, u.full_name AS parent_name
     FROM user_profiles up
     LEFT JOIN users u ON u.email = up.parent_email
     WHERE up.email = $1`,
    [studentEmail],
  );
  const profile = profileRes.rows[0] as { parent_email?: string; parent_name?: string } | undefined;
  const parentEmail = profile?.parent_email;
  const parentName = profile?.parent_name || 'Parent';

  // 7. Send to parent (if parent email exists)
  if (parentEmail) {
    const tpl = earlyExitAlertTemplate({
      recipientName: parentName,
      recipientEmail: parentEmail,
      recipientRole: 'parent',
      studentName,
      studentEmail,
      roomName: room.room_name,
      subject: room.subject,
      scheduledEnd: scheduledEndStr,
      exitTime: exitTimeStr,
      remainingMinutes,
    });
    sendEmail({ to: parentEmail, ...tpl, priority: 'high' }).catch(() => {});
  }

  // 8. Send to batch coordinator
  if (room.coordinator_email) {
    // Look up coordinator name
    const coordRes = await db.query(
      `SELECT full_name FROM portal_users WHERE email = $1`,
      [room.coordinator_email],
    );
    const coordName = (coordRes.rows[0] as { full_name?: string })?.full_name || 'Coordinator';

    const tpl = earlyExitAlertTemplate({
      recipientName: coordName,
      recipientEmail: room.coordinator_email,
      recipientRole: 'batch_coordinator',
      studentName,
      studentEmail,
      roomName: room.room_name,
      subject: room.subject,
      scheduledEnd: scheduledEndStr,
      exitTime: exitTimeStr,
      remainingMinutes,
    });
    sendEmail({ to: room.coordinator_email, ...tpl, priority: 'high' }).catch(() => {});
  }
}
