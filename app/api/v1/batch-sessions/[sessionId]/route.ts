// ═══════════════════════════════════════════════════════════════
// Batch Session Detail API
// GET    /api/v1/batch-sessions/[sessionId]        — Session detail
// PATCH  /api/v1/batch-sessions/[sessionId]        — Update session
// DELETE /api/v1/batch-sessions/[sessionId]        — Cancel session
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { scheduleTimetableUpdate } from '@/lib/timetable-auto';
import { deleteRoom as deleteLiveKitRoom } from '@/lib/livekit';
import { cleanupSessionData } from '@/lib/cascade-cleanup';
import { sendEmail } from '@/lib/email';
import { sessionRescheduledNotifyTemplate } from '@/lib/email-templates';
import { deductSessionCreditsOnEnd } from '@/lib/payment';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
}

// ── GET — Session detail with participants ──────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  const sessionRes = await db.query(
    `SELECT s.*,
            b.batch_name, b.batch_type, b.grade, b.section, b.subjects,
            b.coordinator_email, b.academic_operator_email, b.max_students,
            c.full_name AS coordinator_name,
            ao.full_name AS academic_operator_name
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     LEFT JOIN portal_users c ON c.email = b.coordinator_email
     LEFT JOIN portal_users ao ON ao.email = b.academic_operator_email
     WHERE s.session_id = $1`,
    [sessionId]
  );

  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }

  const session = sessionRes.rows[0] as Record<string, unknown>;

  // Fetch batch students
  const studentsRes = await db.query(
    `SELECT bs.student_email, bs.parent_email,
            su.full_name AS student_name,
            pu.full_name AS parent_name
     FROM batch_students bs
     LEFT JOIN portal_users su ON su.email = bs.student_email
     LEFT JOIN portal_users pu ON pu.email = bs.parent_email
     WHERE bs.batch_id = $1
     ORDER BY su.full_name`,
    [session.batch_id]
  );

  // Fetch batch teachers
  const teachersRes = await db.query(
    `SELECT bt.teacher_email, bt.subject,
            u.full_name AS teacher_name
     FROM batch_teachers bt
     LEFT JOIN portal_users u ON u.email = bt.teacher_email
     WHERE bt.batch_id = $1
     ORDER BY bt.subject`,
    [session.batch_id]
  );

  return NextResponse.json({
    success: true,
    data: {
      session,
      students: studentsRes.rows,
      teachers: teachersRes.rows,
    },
  });
}

// ── PATCH — Update session ──────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  // Check session exists and is still schedulable
  const existing = await db.query(
    `SELECT s.*, b.coordinator_email, b.academic_operator_email
     FROM batch_sessions s JOIN batches b ON b.batch_id = s.batch_id
     WHERE s.session_id = $1`,
    [sessionId]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }

  const session = existing.rows[0] as Record<string, string>;

  // Scope check
  if (caller.role === 'academic_operator' && session.academic_operator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }
  if (caller.role === 'batch_coordinator' && session.coordinator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }

  // Special status updates
  if (body.status === 'live' && session.status === 'scheduled') {
    // Start the session
    await db.query(
      `UPDATE batch_sessions SET status = 'live', started_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );
    return NextResponse.json({ success: true, message: 'Session started' });
  }

  if (body.status === 'ended' && session.status === 'live') {
    // End the session
    await db.query(
      `UPDATE batch_sessions SET status = 'ended', ended_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );

    // Also end the associated LiveKit room so all participants (including Flutter tablet) get disconnected
    const roomRes = await db.query(
      `SELECT room_id FROM rooms WHERE batch_session_id = $1 AND status IN ('live', 'scheduled') LIMIT 1`,
      [sessionId]
    );
    if (roomRes.rows.length > 0) {
      const roomId = (roomRes.rows[0] as Record<string, string>).room_id;
      // Record explicit-end marker so the LiveKit webhook recognizes this as a
      // genuine administrative end (not an idle auto-close).
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_end_requested', $2)`,
        [roomId, JSON.stringify({ ended_by: caller?.id, via: 'batch-session-end' })]
      ).catch(e => console.warn('[batch-sessions/end] end-requested event insert warning:', e));
      try {
        await deleteLiveKitRoom(roomId);
      } catch (e) {
        console.warn(`[batch-sessions/end] LiveKit room delete warning for ${roomId}:`, e);
      }
      await db.query(
        `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE room_id = $1`,
        [roomId]
      );
      console.log(`[batch-sessions/end] Ended room ${roomId} for session ${sessionId} by ${caller?.id}`);
    }

    // Deduct one session credit per enrolled student (fire-and-forget, non-critical)
    deductSessionCreditsOnEnd(sessionId).catch(e =>
      console.warn('[batch-sessions/end] deductSessionCreditsOnEnd warning:', e)
    );

    return NextResponse.json({ success: true, message: 'Session ended' });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({
      success: false,
      error: `Cannot edit session in '${session.status}' status`,
    }, { status: 400 });
  }

  // ── Reject past date/time when scheduling fields are updated ─
  if ('scheduled_date' in body || 'start_time' in body) {
    const newDate = (body.scheduled_date as string) || session.scheduled_date;
    const newTime = ((body.start_time as string) || session.start_time).slice(0, 5);
    const newDateTimeIST = new Date(`${newDate}T${newTime}+05:30`);
    if (newDateTimeIST < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Cannot reschedule a session to a past date/time (IST).',
      }, { status: 400 });
    }
  }

  const updatable = ['subject', 'teacher_email', 'teacher_name', 'scheduled_date', 'start_time',
                     'duration_minutes', 'teaching_minutes', 'prep_buffer_minutes', 'topic', 'notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of updatable) {
    if (field in body) {
      values.push(body[field] ?? null);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(sessionId);
  await db.query(
    `UPDATE batch_sessions SET ${sets.join(', ')} WHERE session_id = $${values.length}`,
    values
  );

  // Trigger auto timetable update (schedule/time changed)
  scheduleTimetableUpdate(session.batch_id);

  // ── Reschedule notifications ─────────────────────────────────
  const isRescheduled = 'scheduled_date' in body || 'start_time' in body;
  if (isRescheduled) {
    const oldDate = session.scheduled_date;
    const oldTime = String(session.start_time).slice(0, 5);
    const newDate = String(body.scheduled_date ?? session.scheduled_date);
    const newTime = String(body.start_time ?? session.start_time).slice(0, 5);
    // Only notify if something actually changed
    if (oldDate !== newDate || oldTime !== newTime) {
      // Fetch batch info and stakeholders
      const batchRes = await db.query(
        `SELECT b.batch_name, b.subjects, b.coordinator_email, b.academic_operator_email,
                s.subject, s.topic
         FROM batches b
         JOIN batch_sessions s ON s.batch_id = b.batch_id
         WHERE b.batch_id = $1 AND s.session_id = $2`,
        [session.batch_id, sessionId]
      );
      const batchInfo = batchRes.rows[0] as Record<string, string> | undefined;
      const batchName = batchInfo?.batch_name || 'Your batch';
      const subjectName = (body.subject as string) ?? batchInfo?.subject ?? 'Class';
      const topicName = (body.topic as string) ?? batchInfo?.topic ?? '';
      const rescheduledBy = caller.id;

      // Get all stakeholders (students, parents, teacher, coordinator, AO)
      const stakeholderRows = await db.query(
        `SELECT 'student' AS role, bs.student_email AS email, u.full_name AS name, NULL AS child_email, NULL AS child_name
         FROM batch_students bs
         JOIN portal_users u ON u.email = bs.student_email
         WHERE bs.batch_id = $1
         UNION ALL
         SELECT 'parent', bs.parent_email, pu.full_name, bs.student_email, su.full_name
         FROM batch_students bs
         JOIN portal_users pu ON pu.email = bs.parent_email
         JOIN portal_users su ON su.email = bs.student_email
         WHERE bs.batch_id = $1 AND bs.parent_email IS NOT NULL`,
        [session.batch_id]
      );

      for (const s of stakeholderRows.rows as { role: string; email: string; name: string; child_email: string | null; child_name: string | null }[]) {
        try {
          const tmpl = sessionRescheduledNotifyTemplate({
            recipientName: s.name,
            recipientEmail: s.email,
            batchName,
            subject: subjectName,
            oldDate,
            oldTime,
            newDate,
            newTime,
            reason: 'Rescheduled by coordinator',
            requestedBy: rescheduledBy,
            ...(topicName ? { topic: topicName } : {}),
            ...(s.role === 'parent' && s.child_name ? { childName: s.child_name } : {}),
          });
          await sendEmail({
            to: s.email,
            ...tmpl,
            waTemplate: 'stibe_session_moved',
            waParams: [s.name, `${batchName} (${subjectName})`, oldDate, `${newDate} at ${newTime} (Rescheduled by coordinator)`],
          });
        } catch (e) {
          console.error('[batch-sessions/patch] Reschedule notify failed for', s.email, e);
        }
      }
    }
  }

  return NextResponse.json({ success: true, message: 'Session updated' });
}

// ── DELETE — Cancel or permanently delete session ───────────
// ?permanent=true  → hard-delete from DB
// default          → soft-cancel (set status='cancelled')
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;
  const url = new URL(req.url);
  const permanent = url.searchParams.get('permanent') === 'true';
  const reason = url.searchParams.get('reason') || 'Cancelled by operator';

  // Pre-load batch ownership info for scope checks
  const sessRes = await db.query(
    `SELECT s.batch_id, s.status, b.coordinator_email, b.academic_operator_email
     FROM batch_sessions s JOIN batches b ON b.batch_id = s.batch_id
     WHERE s.session_id = $1`,
    [sessionId]
  );
  if (sessRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }
  const sessionInfo = sessRes.rows[0] as { batch_id: string; status: string; coordinator_email: string; academic_operator_email: string };
  if (caller.role === 'academic_operator' && sessionInfo.academic_operator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }
  if (caller.role === 'batch_coordinator' && sessionInfo.coordinator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }


  if (permanent) {
    // ── Permanent delete — remove session and all related data ──
    const { batch_id, status } = sessionInfo;
    if (status === 'live') {
      return NextResponse.json({ success: false, error: 'Cannot delete a live session. End it first.' }, { status: 400 });
    }

    await db.withTransaction(async (client) => {
      // Clean all related data (rooms, monitoring, exams, invoices, earnings, etc.)
      await cleanupSessionData(client, [sessionId]);

      // Delete the session
      await client.query('DELETE FROM batch_sessions WHERE session_id = $1', [sessionId]);
    });

    scheduleTimetableUpdate(batch_id);
    return NextResponse.json({ success: true, message: 'Session permanently deleted' });
  }

  // ── Soft cancel — keep in DB as cancelled ──
  const result = await db.query(
    `UPDATE batch_sessions
     SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $2
     WHERE session_id = $1 AND status IN ('scheduled')
     RETURNING session_id`,
    [sessionId, reason]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found or already started' }, { status: 404 });
  }

  // Cancel pending invoices & session_payments for cancelled session
  const cancelledSgRes = await db.query('SELECT batch_id, schedule_group_id FROM batch_sessions WHERE session_id = $1', [sessionId]);
  if (cancelledSgRes.rows.length > 0) {
    const row = cancelledSgRes.rows[0] as { batch_id: string; schedule_group_id: string | null };
    if (row.schedule_group_id) {
      await db.query(
        `UPDATE invoices SET status = 'cancelled' WHERE schedule_group_id = $1 AND status = 'pending'`,
        [row.schedule_group_id]
      );
    }
    await db.query(
      `UPDATE session_payments SET status = 'cancelled' WHERE batch_session_id = $1 AND status = 'pending'`,
      [sessionId]
    );
    scheduleTimetableUpdate(row.batch_id);
  }

  return NextResponse.json({ success: true, message: 'Session cancelled' });
}
