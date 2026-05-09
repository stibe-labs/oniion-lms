// ═══════════════════════════════════════════════════════════════
// Teacher Batch Detail API
// GET /api/v1/teacher/batch-detail?batch_id=X
//
// Returns comprehensive batch data for the teacher's batch detail view:
//   - timetable: Weekly recurring schedule pattern
//   - attendance: Per-student attendance aggregates
//   - session_summaries: Ended sessions with attendance counts
//   - exam_results: All exam results for this batch's sessions
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return fail('Not authenticated', 401);

  const user = await verifySession(token);
  if (!user || !['teacher', 'owner'].includes(user.role)) {
    return fail('Forbidden', 403);
  }

  const batchId = new URL(req.url).searchParams.get('batch_id');
  if (!batchId) return fail('batch_id is required');

  const teacherEmail = user.role === 'owner' ? undefined : user.id;

  // Verify teacher is assigned to this batch (unless owner)
  if (teacherEmail) {
    const check = await db.query(
      `SELECT 1 FROM batch_teachers WHERE batch_id = $1 AND teacher_email = $2 LIMIT 1`,
      [batchId, teacherEmail],
    );
    if (check.rows.length === 0) return fail('Not assigned to this batch', 403);
  }

  // ── 1. Timetable pattern (deduplicated weekly slots) ──
  const timetableRes = await db.query(
    `SELECT DISTINCT ON (EXTRACT(DOW FROM s.scheduled_date), s.start_time, s.subject)
       EXTRACT(DOW FROM s.scheduled_date)::int AS dow,
       TO_CHAR(s.scheduled_date, 'Day') AS day_name,
       s.start_time::text,
       s.duration_minutes,
       s.subject,
       s.teacher_name
     FROM batch_sessions s
     WHERE s.batch_id = $1 AND s.status != 'cancelled'
     ORDER BY EXTRACT(DOW FROM s.scheduled_date), s.start_time, s.subject, s.scheduled_date DESC`,
    [batchId],
  );

  // ── 2. Per-student attendance aggregates ──
  // Deduplicate per (student, session) — pick best status when session has multiple rooms
  const attendanceRes = await db.query(
    `WITH per_session AS (
       SELECT DISTINCT ON (bs_st.student_email, s.session_id)
         bs_st.student_email,
         s.session_id,
         COALESCE(att.status, 'not_joined') AS status,
         COALESCE(att.attention_avg, 0) AS attention_avg,
         COALESCE(att.total_duration_sec, 0) AS total_duration_sec
       FROM batch_students bs_st
       CROSS JOIN batch_sessions s
       LEFT JOIN rooms r ON r.batch_session_id = s.session_id
       LEFT JOIN attendance_sessions att ON att.room_id = r.room_id
         AND att.participant_email = bs_st.student_email
         AND att.participant_role = 'student'
       WHERE bs_st.batch_id = $1 AND s.batch_id = $1 AND s.status = 'ended'
       ORDER BY bs_st.student_email, s.session_id,
         CASE COALESCE(att.status, 'not_joined')
           WHEN 'present' THEN 1 WHEN 'late' THEN 2
           WHEN 'left_early' THEN 3 WHEN 'absent' THEN 4
           ELSE 5
         END
     )
     SELECT
       ps.student_email,
       pu.full_name AS student_name,
       COUNT(*) AS total_sessions,
       COUNT(*) FILTER (WHERE ps.status = 'present') AS present,
       COUNT(*) FILTER (WHERE ps.status = 'late') AS late,
       COUNT(*) FILTER (WHERE ps.status = 'absent') AS absent,
       COUNT(*) FILTER (WHERE ps.status = 'left_early') AS left_early,
       COUNT(*) FILTER (WHERE ps.status = 'not_joined') AS not_joined,
       COALESCE(ROUND(AVG(ps.attention_avg) FILTER (WHERE ps.status IN ('present','late')), 1), 0) AS avg_attention,
       COALESCE(SUM(ps.total_duration_sec), 0)::int AS total_duration_sec
     FROM per_session ps
     JOIN portal_users pu ON pu.email = ps.student_email
     GROUP BY ps.student_email, pu.full_name
     ORDER BY pu.full_name`,
    [batchId],
  );

  // ── 3. Session summaries (ended sessions with attendance counts) ──
  const sessionSummaryRes = await db.query(
    `SELECT
       s.session_id,
       s.scheduled_date::text AS scheduled_date,
       s.start_time::text,
       s.duration_minutes,
       s.subject,
       s.topic,
       s.status,
       s.started_at,
       s.ended_at,
       r.room_id,
       COALESCE(att_agg.students_joined, 0)::int AS students_joined,
       COALESCE(mon_agg.avg_attention, att_agg.avg_attention, 0)::numeric AS avg_attention,
       COALESCE(att_agg.avg_duration_sec, 0)::int AS avg_duration_sec
     FROM batch_sessions s
     LEFT JOIN rooms r ON r.batch_session_id = s.session_id
     LEFT JOIN (
       SELECT
         a.room_id,
         COUNT(*) FILTER (WHERE a.participant_role = 'student' AND a.status IN ('present','late')) AS students_joined,
         ROUND(AVG(a.attention_avg) FILTER (WHERE a.participant_role = 'student'), 1) AS avg_attention,
         ROUND(AVG(a.total_duration_sec) FILTER (WHERE a.participant_role = 'student')) AS avg_duration_sec
       FROM attendance_sessions a
       GROUP BY a.room_id
     ) att_agg ON att_agg.room_id = r.room_id
     LEFT JOIN (
       SELECT
         cme.room_id,
         ROUND(
           SUM(CASE WHEN cme.event_type = 'attentive' THEN cme.duration_seconds ELSE 0 END)::numeric
           / NULLIF(SUM(cme.duration_seconds), 0) * 100
         , 1) AS avg_attention
       FROM class_monitoring_events cme
       GROUP BY cme.room_id
     ) mon_agg ON mon_agg.room_id = r.room_id
     WHERE s.batch_id = $1 AND s.status = 'ended'
     ORDER BY s.scheduled_date DESC, s.start_time DESC`,
    [batchId],
  );

  // ── 4. Exam results for this batch ──
  const examRes = await db.query(
    `SELECT
       ser.student_email,
       ser.student_name,
       ser.topic_title,
       ser.subject,
       ser.score,
       ser.total_marks,
       ser.percentage,
       ser.grade_letter,
       ser.total_questions,
       ser.answered,
       ser.time_taken_seconds,
       ser.completed_at,
       ser.room_id,
       COALESCE(ser.session_id, r.batch_session_id) AS session_id
     FROM session_exam_results ser
     LEFT JOIN batch_sessions bs ON bs.session_id = ser.session_id
     LEFT JOIN rooms r ON r.room_id = ser.room_id
     WHERE bs.batch_id = $1 OR r.batch_id = $1
     ORDER BY ser.completed_at DESC`,
    [batchId],
  );

  return NextResponse.json({
    success: true,
    data: {
      timetable: timetableRes.rows,
      attendance: attendanceRes.rows,
      session_summaries: sessionSummaryRes.rows,
      exam_results: examRes.rows,
    },
  });
}
