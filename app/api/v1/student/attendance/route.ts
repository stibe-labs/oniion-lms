// ═══════════════════════════════════════════════════════════════
// Student Attendance API — GET /api/v1/student/attendance
// Returns the logged-in student's own attendance records
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['student', 'owner'].includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const studentEmail = user.id;

    // ── Summary stats (via enrollment path, not room_assignments) ────
    // Uses batch_students → batch_sessions → rooms so all enrolled sessions
    // are counted even before the student has ever clicked "Join".
    const summaryResult = await db.query<{
      total_sessions: string;
      present: string;
      absent: string;
      late_count: string;
      avg_time_sec: string;
      total_rejoins: string;
    }>(
      `SELECT
         COUNT(r.room_id) AS total_sessions,
         COUNT(a.room_id) FILTER (WHERE a.status = 'present') AS present,
         COUNT(r.room_id) FILTER (WHERE a.room_id IS NULL) AS absent,
         COUNT(a.room_id) FILTER (WHERE a.late_join = true) AS late_count,
         COALESCE(AVG(a.total_duration_sec), 0) AS avg_time_sec,
         COALESCE(SUM(a.join_count), 0) AS total_rejoins
       FROM batch_students bs
       JOIN batch_sessions bsess ON bsess.batch_id = bs.batch_id
       JOIN rooms r ON r.room_id = bsess.livekit_room_name
       LEFT JOIN attendance_sessions a ON a.room_id = r.room_id AND a.participant_email = $1
       WHERE bs.student_email = $1
         AND r.status = 'ended'`,
      [studentEmail]
    );

    // ── Per-session records: all enrolled sessions with attendance data ─
    const recordsResult = await db.query(
      `SELECT
         r.room_id,
         r.room_name,
         r.subject,
         r.grade,
         r.section,
         r.scheduled_start,
         r.duration_minutes,
         r.status AS room_status,
         t.full_name AS teacher_name,
         COALESCE(a.status,
           CASE WHEN r.status = 'ended' THEN 'absent' ELSE NULL END
         ) AS status,
         a.late_join AS is_late,
         a.late_by_sec AS late_by_seconds,
         a.first_join_at,
         a.last_leave_at,
         a.total_duration_sec AS time_in_class_seconds,
         a.join_count,
         a.engagement_score,
         COALESCE(a.mic_off_count, 0) AS mic_off_count,
         COALESCE(a.camera_off_count, 0) AS camera_off_count,
         COALESCE(a.leave_request_count, 0) AS leave_request_count,
         a.attention_avg
       FROM batch_students bs
       JOIN batch_sessions bsess ON bsess.batch_id = bs.batch_id
       JOIN rooms r ON r.room_id = bsess.livekit_room_name
       LEFT JOIN portal_users t ON t.email = r.teacher_email
       LEFT JOIN attendance_sessions a ON a.room_id = r.room_id AND a.participant_email = $1
       WHERE bs.student_email = $1
       ORDER BY r.scheduled_start DESC
       LIMIT 60`,
      [studentEmail]
    );

    // ── Subject-wise breakdown (via enrollment path) ──────────
    const subjectResult = await db.query<{
      subject: string;
      total: string;
      present: string;
      absent: string;
    }>(
      `SELECT
         r.subject,
         COUNT(r.room_id) FILTER (WHERE r.status = 'ended') AS total,
         COUNT(a.room_id) FILTER (WHERE a.status = 'present') AS present,
         COUNT(r.room_id) FILTER (WHERE r.status = 'ended' AND a.room_id IS NULL) AS absent
       FROM batch_students bs
       JOIN batch_sessions bsess ON bsess.batch_id = bs.batch_id
       JOIN rooms r ON r.room_id = bsess.livekit_room_name
       LEFT JOIN attendance_sessions a ON a.room_id = r.room_id AND a.participant_email = $1
       WHERE bs.student_email = $1
       GROUP BY r.subject
       ORDER BY total DESC`,
      [studentEmail]
    );

    const s = summaryResult.rows[0];
    const total = Number(s?.total_sessions || 0);
    const present = Number(s?.present || 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_sessions: total,
          present,
          absent: Number(s?.absent || 0),
          late: Number(s?.late_count || 0),
          attendance_rate: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0,
          avg_time_minutes: Number((Number(s?.avg_time_sec || 0) / 60).toFixed(1)),
          total_rejoins: Number(s?.total_rejoins || 0),
        },
        records: recordsResult.rows,
        by_subject: subjectResult.rows.map(row => ({
          subject: row.subject,
          total: Number(row.total),
          present: Number(row.present),
          absent: Number(row.absent),
          rate: Number(row.total) > 0
            ? Number(((Number(row.present) / Number(row.total)) * 100).toFixed(1))
            : 0,
        })),
      },
    });
  } catch (err) {
    console.error('[student/attendance] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
