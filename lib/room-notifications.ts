// ═══════════════════════════════════════════════════════════════
// Room Notification Helpers
// Only `sendGoLiveNotifications` still fires (WhatsApp ops pings to
// teacher + BC). Creation + reminder emails are deprecated — the
// 15-min lobby reminder (/api/v1/batch-sessions/session-reminder)
// is the single source of truth for recipient-facing notifications.
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';

// ── Types ───────────────────────────────────────────────────

interface RoomData {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  scheduled_start: string;
  duration_minutes: number;
  notes_for_teacher?: string | null;
}

interface Assignment {
  participant_email: string;
  participant_name: string;
  participant_type: 'teacher' | 'student';
  payment_status: string;
}

// ── Fetch participants for a room ───────────────────────────

async function getAssignments(roomId: string): Promise<Assignment[]> {
  const result = await db.query(
    `SELECT participant_email, participant_name, participant_type, payment_status
     FROM room_assignments WHERE room_id = $1`,
    [roomId]
  );
  return result.rows as unknown as Assignment[];
}

// ═══════════════════════════════════════════════════════════════
// 1. ON ROOM CREATION — invite emails to teacher + students
// ═══════════════════════════════════════════════════════════════

export async function sendCreationNotifications(room: RoomData): Promise<void> {
  // ── DEPRECATED (2025-11) ─────────────────────────────────
  // Per-room creation invites are redundant. Batch-level creation
  // emails inform users when they're enrolled; the 15-min lobby
  // reminder delivers the join link on the day of class.
  // Kept as a no-op so existing callers don't break.
  void room;
  return;
}

// ═══════════════════════════════════════════════════════════════
// 2. REMINDERS — 30-min and 5-min before class
// ═══════════════════════════════════════════════════════════════

export async function sendReminderNotifications(
  room: RoomData,
  minutesBefore: number
): Promise<number> {
  // ── DEPRECATED (2025-11) ─────────────────────────────────
  // Room-level reminder cron is superseded by the single
  // 15-min session-reminder (/api/v1/batch-sessions/session-reminder)
  // which sends persistent no-login join links.
  void room; void minutesBefore;
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// 3. ON GO-LIVE — "Class has started" email
// ═══════════════════════════════════════════════════════════════

export async function sendGoLiveNotifications(room: RoomData): Promise<void> {
  const assignments = await getAssignments(room.room_id);
  if (assignments.length === 0) return;

  // ── Generate join tokens for all existing participants ─────
  const tokenMap = new Map<string, string>(); // email → token
  for (const a of assignments) {
    const token = randomUUID();
    tokenMap.set(a.participant_email, token);
    await db.query(
      `UPDATE room_assignments SET join_token = $1 WHERE room_id = $2 AND participant_email = $3`,
      [token, room.room_id, a.participant_email],
    );
  }

  // ── Resolve batch coordinator from batch data ─────────────
  let bcEmail: string | null = null;
  let bcName: string | null = null;
  let bcToken: string | null = null;
  try {
    const bcRes = await db.query(
      `SELECT b.coordinator_email, pu.full_name AS coordinator_name
       FROM rooms r
       JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
       JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users pu ON pu.email = b.coordinator_email
       WHERE r.room_id = $1 AND b.coordinator_email IS NOT NULL`,
      [room.room_id],
    );
    if (bcRes.rows.length > 0) {
      const row = bcRes.rows[0] as { coordinator_email: string; coordinator_name: string | null };
      bcEmail = row.coordinator_email;
      bcName = row.coordinator_name || 'Coordinator';
      bcToken = randomUUID();
      // Insert or update BC in room_assignments so token-based join works
      await db.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, join_token, payment_status)
         VALUES ($1, 'batch_coordinator', $2, $3, $4, 'exempt')
         ON CONFLICT (room_id, participant_email) DO UPDATE SET join_token = $4`,
        [room.room_id, bcEmail, bcName, bcToken],
      );
    }
  } catch (err) {
    console.warn('[room-notify] BC lookup warning:', err);
  }

  const teacherAssignment = assignments.find(a => a.participant_type === 'teacher');
  const teacherName = teacherAssignment?.participant_name || 'Your teacher';

  // ── Students: no email/WA here. The 15-min reminder already ──
  //    delivered a persistent no-login link that works once live.
  //    Student dashboards auto-show "Enter Lobby" buttons.

  // ── Notify teacher (WhatsApp only — operational signal) ──
  if (teacherAssignment) {
    const teacherLink = `${BASE_URL}/join/${room.room_id}?token=${tokenMap.get(teacherAssignment.participant_email)}`;
    fireWhatsApp(
      teacherAssignment.participant_email,
      `🔴 Your class *${room.room_name}* is now LIVE!\n\nDirect join link (no login needed):\n${teacherLink}`,
    ).catch(() => {});
  }

  // ── Notify batch coordinator (WhatsApp only) ──────────────
  if (bcEmail && bcToken) {
    const bcLink = `${BASE_URL}/join/${room.room_id}?token=${bcToken}`;
    fireWhatsApp(
      bcEmail,
      `🔴 Class *${room.room_name}* is now LIVE!\n\nTeacher: ${teacherName}\nDirect join link (no login needed):\n${bcLink}`,
    ).catch(() => {});
  }

  console.log(`[room-notify] Go-live notifications sent for ${room.room_id} (${assignments.length} participants${bcEmail ? ' + BC' : ''})`);
}
