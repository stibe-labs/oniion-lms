// ═══════════════════════════════════════════════════════════════
// Teacher My-Sessions API
// GET /api/v1/teacher/my-sessions
//
// Returns batch_sessions assigned to the logged-in teacher.
// Query params: date (YYYY-MM-DD), status, batch_id, range (today|week|all)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !['teacher', 'owner'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const teacherEmail = user.id;
  const url = new URL(req.url);
  const date = url.searchParams.get('date');          // specific date
  const status = url.searchParams.get('status');       // scheduled|live|ended|cancelled
  const batchId = url.searchParams.get('batch_id');
  const range = url.searchParams.get('range') || 'all'; // today|week|all

  // ── No auto-cleanup of stale 'live' sessions ──
  // A live class ends only when the teacher explicitly ends it (DELETE /room),
  // or when LiveKit fires the room_finished webhook (room actually empty).
  // Time-based auto-end was kicking students out of overtime classes that
  // the teacher hadn't ended.

  let sql = `
    SELECT
      s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
      s.scheduled_date::text AS scheduled_date, s.start_time::text AS start_time,
      s.duration_minutes, s.teaching_minutes,
      s.prep_buffer_minutes, s.status, s.livekit_room_name,
      s.topic, s.notes, s.started_at, s.ended_at, s.cancelled_at,
      s.cancel_reason, s.created_by,
      s.go_live_status, s.go_live_requested_at,
      b.batch_name, b.batch_type, b.grade, b.section, b.subjects AS batch_subjects,
      b.coordinator_email, b.academic_operator_email,
      COALESCE(sc.student_count, 0)::int AS student_count,
      rm.recording_status, rm.recording_url
    FROM batch_sessions s
    JOIN batches b ON b.batch_id = s.batch_id
    LEFT JOIN (
      SELECT batch_id, COUNT(*) AS student_count FROM batch_students GROUP BY batch_id
    ) sc ON sc.batch_id = s.batch_id
    LEFT JOIN rooms rm ON rm.batch_session_id = s.session_id
    WHERE s.teacher_email = $1
  `;
  const params: unknown[] = [teacherEmail];

  if (date) {
    params.push(date);
    sql += ` AND s.scheduled_date = $${params.length}::date`;
  } else if (range === 'today') {
    sql += ` AND s.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
  } else if (range === 'week') {
    sql += ` AND s.scheduled_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
             AND s.scheduled_date < ((NOW() AT TIME ZONE 'Asia/Kolkata')::date + 7)`;
  }

  if (status && status !== 'all') {
    params.push(status);
    sql += ` AND s.status = $${params.length}`;
  }

  if (batchId) {
    params.push(batchId);
    sql += ` AND s.batch_id = $${params.length}`;
  }

  sql += ` ORDER BY s.scheduled_date ASC, s.start_time ASC`;

  const result = await db.query(sql, params);

  // Summary stats for today
  const todayStats = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('scheduled','live'))::int AS today_total,
       COUNT(*) FILTER (WHERE status = 'live')::int AS today_live,
       COUNT(*) FILTER (WHERE status = 'scheduled')::int AS today_upcoming,
       COUNT(*) FILTER (WHERE status = 'ended')::int AS today_completed,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS today_cancelled
     FROM batch_sessions
     WHERE teacher_email = $1
     AND scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
    [teacherEmail]
  );

  // Max sessions per day (hardcoded default; no session_config table yet)
  const maxSessionsPerDay = 4;

  return NextResponse.json({
    success: true,
    data: {
      sessions: result.rows,
      today: todayStats.rows[0] || { today_total: 0, today_live: 0, today_upcoming: 0, today_completed: 0, today_cancelled: 0 },
      max_sessions_per_day: maxSessionsPerDay,
    },
  });
}
