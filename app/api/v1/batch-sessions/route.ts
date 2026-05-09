// ═══════════════════════════════════════════════════════════════
// Batch Sessions API — GET + POST + DELETE (bulk)
// GET    /api/v1/batch-sessions?batch_id=X  — List sessions for a batch
// POST   /api/v1/batch-sessions             — Schedule a new class session
// DELETE /api/v1/batch-sessions              — Bulk cancel sessions
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { scheduleTimetableUpdate } from '@/lib/timetable-auto';
import { cleanupSessionData } from '@/lib/cascade-cleanup';
import { generateSessionJoinLinks } from '@/lib/session-join-tokens';
import { generateScheduleGroupInvoices } from '@/lib/payment';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
}

// ── GET — List sessions ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const batchId = url.searchParams.get('batch_id');
  const teacherEmail = url.searchParams.get('teacher_email');
  const status = url.searchParams.get('status') || 'all';
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');

  let sql = `
    SELECT
      s.*,
      b.batch_name, b.batch_type, b.grade, b.section, b.subjects,
      b.coordinator_email, b.academic_operator_email,
      COALESCE(sc.student_count, 0) AS student_count,
      tu.profile_image AS teacher_image,
      rm.recording_status, rm.recording_url,
      rm.status AS room_status
    FROM batch_sessions s
    JOIN batches b ON b.batch_id = s.batch_id
    LEFT JOIN (
      SELECT batch_id, COUNT(*) AS student_count FROM batch_students GROUP BY batch_id
    ) sc ON sc.batch_id = s.batch_id
    LEFT JOIN portal_users tu ON tu.email = s.teacher_email
    LEFT JOIN rooms rm ON rm.room_id = s.livekit_room_name
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (batchId) {
    params.push(batchId);
    sql += ` AND s.batch_id = $${params.length}`;
  }

  if (teacherEmail) {
    params.push(teacherEmail);
    sql += ` AND s.teacher_email = $${params.length}`;
  }

  // For AO, only show sessions for their assigned batches
  if (caller.role === 'academic_operator') {
    params.push(caller.id);
    sql += ` AND b.academic_operator_email = $${params.length}`;
  }

  // For BC, only show sessions for their assigned batches
  if (caller.role === 'batch_coordinator') {
    params.push(caller.id);
    sql += ` AND b.coordinator_email = $${params.length}`;
  }

  if (status !== 'all') {
    params.push(status);
    sql += ` AND s.status = $${params.length}`;
  }

  if (dateFrom) {
    params.push(dateFrom);
    sql += ` AND s.scheduled_date >= $${params.length}::date`;
  }
  if (dateTo) {
    params.push(dateTo);
    sql += ` AND s.scheduled_date <= $${params.length}::date`;
  }

  sql += ` ORDER BY s.scheduled_date DESC, s.start_time DESC`;

  const result = await db.query(sql, params);

  return NextResponse.json({ success: true, data: { sessions: result.rows } });
}

// ── POST — Schedule a new session ───────────────────────────
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    batch_id, subject, teacher_email, teacher_name,
    scheduled_date, start_time,
    duration_minutes = 90, teaching_minutes = 75, prep_buffer_minutes = 15,
    topic, notes, schedule_group_id,
  } = body;

  if (!batch_id || !subject || !scheduled_date || !start_time) {
    return NextResponse.json({
      success: false,
      error: 'batch_id, subject, scheduled_date, and start_time are required',
    }, { status: 400 });
  }

  // Validate start_time is a valid HH:MM in 00:00-23:59
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time as string)) {
    return NextResponse.json({
      success: false,
      error: `Invalid start_time "${start_time}". Must be HH:MM between 00:00 and 23:59.`,
    }, { status: 400 });
  }

  // ── Reject sessions scheduled in the past (IST) ──────────
  const sessionDateTimeIST = new Date(`${scheduled_date}T${(start_time as string).slice(0, 5)}+05:30`);
  if (sessionDateTimeIST < new Date()) {
    return NextResponse.json({
      success: false,
      error: 'Cannot schedule a session in the past. Please select a future date and time (IST).',
    }, { status: 400 });
  }

  // Verify batch exists and caller has access
  const batchRes = await db.query('SELECT * FROM batches WHERE batch_id = $1', [batch_id]);
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  const batch = batchRes.rows[0] as Record<string, unknown>;
  if (caller.role === 'academic_operator' && batch.academic_operator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }
  if (caller.role === 'batch_coordinator' && batch.coordinator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }

  // Check teacher's daily session limit (max 4 per day per workflow.json)
  if (teacher_email) {
    const countRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM batch_sessions
       WHERE teacher_email = $1
       AND scheduled_date = $2::date
       AND status IN ('scheduled', 'live')`,
      [teacher_email, scheduled_date]
    );
    const cnt = parseInt((countRes.rows[0] as { cnt: string }).cnt, 10);
    if (cnt >= 4) {
      return NextResponse.json({
        success: false,
        error: `Teacher already has ${cnt} sessions on this date (max 4 per day)`,
      }, { status: 400 });
    }

    // Check for time conflicts (same teacher, overlapping time)
    const conflictRes = await db.query(
      `SELECT bs.session_id, bs.batch_id, bs.subject, bs.start_time, bs.duration_minutes,
              b.batch_name
       FROM batch_sessions bs
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       WHERE bs.teacher_email = $1
       AND bs.scheduled_date = $2::date
       AND bs.status IN ('scheduled', 'live')
       AND (
         ($3::time >= bs.start_time AND $3::time < bs.start_time + (bs.duration_minutes || ' minutes')::interval)
         OR (bs.start_time >= $3::time AND bs.start_time < $3::time + ($4 || ' minutes')::interval)
       )`,
      [teacher_email, scheduled_date, start_time, duration_minutes]
    );
    if (conflictRes.rows.length > 0) {
      const c = conflictRes.rows[0] as Record<string, unknown>;
      const cTime = String(c.start_time).slice(0, 5);
      const cBatch = c.batch_name || c.batch_id;
      return NextResponse.json({
        success: false,
        error: `Teacher has a conflicting session: "${c.subject}" at ${cTime} in batch "${cBatch}" (${c.duration_minutes}min)`,
      }, { status: 400 });
    }
  }

  // Generate LiveKit room name: stibe_{date}_{time}_{short_unique}
  const shortId = Math.random().toString(36).substring(2, 8);
  const livekitRoomName = `stibe_${(scheduled_date as string).replace(/-/g, '')}_${(start_time as string).replace(/:/g, '').substring(0, 4)}_${shortId}`;

  const insertRes = await db.query(
    `INSERT INTO batch_sessions (
      batch_id, subject, teacher_email, teacher_name,
      scheduled_date, start_time,
      duration_minutes, teaching_minutes, prep_buffer_minutes,
      livekit_room_name, topic, notes, created_by, schedule_group_id
    ) VALUES ($1, $2, $3, $4, $5, $6::time, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING session_id`,
    [
      batch_id, subject, teacher_email || null, teacher_name || null,
      scheduled_date, start_time,
      duration_minutes, teaching_minutes, prep_buffer_minutes,
      livekitRoomName, topic || null, notes || null, caller.id,
      schedule_group_id || null,
    ]
  );

  const sessionId = insertRes.rows[0].session_id as string;

  // ── Invoice + credit allocation for 1:1 and 1:3 batches ──────────────
  // When a schedule_group_id is provided (ScheduleSessionModal, AutoSchedule), the caller
  // is responsible for calling POST /api/v1/batch-sessions/finalize-invoices after ALL
  // sessions are created — one combined invoice per student for the whole group.
  //
  // For standalone sessions (no schedule_group_id), we auto-assign a group_id and run
  // generateScheduleGroupInvoices inline so the session gets its own invoice/credit record.
  //
  // NOTE: used_sessions is NOT touched here. It is only incremented by deductSessionCreditsOnEnd
  // when a session actually ends, so the display always shows sessions actually attended.
  const batchTypeVal = String(batch.batch_type || '');
  if ((batchTypeVal === 'one_to_one' || batchTypeVal === 'one_to_three') && !schedule_group_id) {
    try {
      const standaloneGroupId = crypto.randomUUID();
      await db.query(
        `UPDATE batch_sessions SET schedule_group_id = $1 WHERE session_id = $2`,
        [standaloneGroupId, sessionId]
      );
      // Fire-and-forget — invoice/credit generation is non-blocking
      generateScheduleGroupInvoices(standaloneGroupId).catch(err =>
        console.error('[batch-sessions] Standalone invoice generation error:', err)
      );
    } catch (invoiceErr) {
      console.error('[batch-sessions] Standalone group_id assignment error:', invoiceErr);
    }
  }

  // Trigger auto timetable update email (debounced, non-blocking)
  scheduleTimetableUpdate(batch_id as string);

  // Generate join tokens (fire-and-forget, WhatsApp sent later by session-reminder cron)
  generateSessionJoinLinks({
    session_id: sessionId,
    batch_id: batch_id as string,
    teacher_email: (teacher_email as string) || null,
    teacher_name: (teacher_name as string) || null,
  }).catch(err => console.error('[batch-sessions] Join link generation error:', err));

  return NextResponse.json({
    success: true,
    data: {
      session_id: sessionId,
      livekit_room_name: livekitRoomName,
    },
    message: 'Session scheduled successfully',
  }, { status: 201 });
}

// ── DELETE — Bulk cancel or permanently delete sessions ─────
// body.permanent = true  → hard-delete from DB
// default                → soft-cancel (set status='cancelled')
export async function DELETE(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const sessionIds = Array.isArray(body.session_ids) ? body.session_ids as string[] : [];
  if (sessionIds.length === 0) {
    return NextResponse.json({ success: false, error: 'session_ids array required' }, { status: 400 });
  }

  const permanent = body.permanent === true;

  // Scope: AO/BC can only act on sessions in their own batches
  if (caller.role === 'academic_operator' || caller.role === 'batch_coordinator') {
    const col = caller.role === 'academic_operator' ? 'academic_operator_email' : 'coordinator_email';
    const scopeRes = await db.query(
      `SELECT s.session_id FROM batch_sessions s
       JOIN batches b ON b.batch_id = s.batch_id
       WHERE s.session_id = ANY($1::text[]) AND b.${col} = $2`,
      [sessionIds, caller.id]
    );
    const allowedIds = new Set(scopeRes.rows.map((r) => (r as { session_id: string }).session_id));
    if (allowedIds.size !== sessionIds.length) {
      return NextResponse.json({ success: false, error: 'One or more sessions are not in your batches' }, { status: 403 });
    }
  }

  if (permanent) {
    // ── Permanent delete — remove rows and all related data ──
    const result = await db.withTransaction(async (client) => {
      // Gather batch_ids for timetable update, exclude live sessions
      const batchesRes = await client.query(
        `SELECT DISTINCT batch_id FROM batch_sessions WHERE session_id = ANY($1::text[]) AND status != 'live'`,
        [sessionIds],
      );
      // Filter to only deletable (non-live) sessions
      const deletableRes = await client.query(
        `SELECT session_id FROM batch_sessions WHERE session_id = ANY($1::text[]) AND status != 'live'`,
        [sessionIds],
      );
      const deletableIds = deletableRes.rows.map((r: Record<string, string>) => r.session_id);

      // Clean all related data (rooms, monitoring, exams, invoices, etc.)
      await cleanupSessionData(client, deletableIds);

      // Delete the sessions
      const delResult = await client.query(
        `DELETE FROM batch_sessions WHERE session_id = ANY($1::text[]) AND status != 'live' RETURNING session_id`,
        [deletableIds]
      );

      return { deleted: delResult.rows.length, batchIds: batchesRes.rows.map((r: Record<string, string>) => r.batch_id) };
    });

    const { deleted, batchIds } = result;
    const skipped = sessionIds.length - deleted;
    for (const bid of batchIds) {
      scheduleTimetableUpdate(bid);
    }
    return NextResponse.json({
      success: true,
      data: { deleted, skipped },
      message: `${deleted} session${deleted !== 1 ? 's' : ''} permanently deleted${skipped > 0 ? ` (${skipped} skipped — live sessions cannot be deleted)` : ''}`,
    });
  }

  // ── Soft cancel — keep in DB as cancelled ──
  const reason = (body.reason as string) || 'Bulk cancelled by operator';

  // Only cancel sessions that are still 'scheduled'
  const result = await db.query(
    `UPDATE batch_sessions
     SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $2
     WHERE session_id = ANY($1::text[]) AND status = 'scheduled'
     RETURNING session_id`,
    [sessionIds, reason]
  );

  const cancelled = result.rows.length;
  const skipped = sessionIds.length - cancelled;

  // Trigger auto timetable update for affected batches
  if (cancelled > 0) {
    const batchesRes = await db.query(
      `SELECT DISTINCT batch_id FROM batch_sessions WHERE session_id = ANY($1::text[])`,
      [sessionIds],
    );
    for (const row of batchesRes.rows) {
      scheduleTimetableUpdate((row as { batch_id: string }).batch_id);
    }
  }

  return NextResponse.json({
    success: true,
    data: { cancelled, skipped },
    message: `${cancelled} session${cancelled !== 1 ? 's' : ''} cancelled${skipped > 0 ? ` (${skipped} skipped — already started/ended/cancelled)` : ''}`,
  });
}
