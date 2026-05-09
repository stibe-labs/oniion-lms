// ═══════════════════════════════════════════════════════════════
// Student Sessions API — GET /api/v1/student/sessions
//
// Returns batch_sessions for the logged-in student's enrolled batches.
// Includes teacher name, subject, topic, status, scheduled time.
// Query params: range (today|week|all), status, batch_id
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const studentEmail = user.id;
  const url = new URL(req.url);
  const range = url.searchParams.get('range') || 'all';
  const status = url.searchParams.get('status');
  const batchId = url.searchParams.get('batch_id');

  let sql = `
    SELECT
      s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
      s.scheduled_date::text AS scheduled_date, s.start_time::text AS start_time,
      s.duration_minutes, s.teaching_minutes,
      s.status, s.livekit_room_name, s.topic, s.notes,
      s.started_at, s.ended_at, s.cancelled_at, s.cancel_reason,
      b.batch_name, b.batch_type, b.grade, b.section,
      -- attendance for this student in this session
      a.status AS attendance_status,
      a.late_join AS is_late,
      a.first_join_at,
      a.last_leave_at,
      a.total_duration_sec AS time_in_class_seconds,
      a.join_count,
      a.engagement_score,
      s.prep_buffer_minutes,
      -- class portion, remarks, and recording from room
      r.class_portion,
      r.class_remarks,
      r.recording_url,
      r.recording_status,
      -- payment status for this session
      sp.status AS payment_status,
      sp.amount_paise AS payment_amount_paise,
      -- refund request status
      srr.id AS refund_request_id,
      srr.request_type AS refund_request_type,
      srr.status AS refund_request_status
    FROM batch_sessions s
    JOIN batches bat ON bat.batch_id = s.batch_id
    JOIN batch_students bs ON bs.batch_id = s.batch_id AND bs.student_email = $1
    JOIN batches b ON b.batch_id = s.batch_id
    LEFT JOIN rooms r ON r.room_id = s.livekit_room_name
    LEFT JOIN attendance_sessions a ON a.room_id = r.room_id AND a.participant_email = $1
    LEFT JOIN session_payments sp ON sp.batch_session_id = s.session_id AND sp.student_email = $1
    LEFT JOIN session_refund_requests srr ON srr.batch_session_id = s.session_id AND srr.student_email = $1
    WHERE 1=1
  `;
  const params: unknown[] = [studentEmail];

  if (range === 'today') {
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

  sql += `
    ORDER BY
      CASE WHEN s.scheduled_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date THEN 0 ELSE 1 END ASC,
      CASE WHEN s.scheduled_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date THEN s.scheduled_date END ASC,
      CASE WHEN s.scheduled_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date THEN s.start_time END ASC,
      s.scheduled_date DESC, s.start_time DESC
    LIMIT 200`;

  const result = await db.query(sql, params);

  // Today summary
  const todayStats = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE s.status = 'live')::int AS live,
       COUNT(*) FILTER (
         WHERE s.status = 'scheduled'
           AND (s.scheduled_date + s.start_time)::timestamp AT TIME ZONE 'Asia/Kolkata' > NOW()
       )::int AS upcoming,
       COUNT(*) FILTER (WHERE s.status = 'ended')::int AS completed,
       COUNT(*) FILTER (WHERE s.status = 'cancelled')::int AS cancelled
     FROM batch_sessions s
     JOIN batch_students bs ON bs.batch_id = s.batch_id AND bs.student_email = $1
     WHERE s.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
    [studentEmail]
  );

  return NextResponse.json({
    success: true,
    data: {
      sessions: result.rows,
      today: todayStats.rows[0] || { total: 0, live: 0, upcoming: 0, completed: 0, cancelled: 0 },
    },
  });
}
