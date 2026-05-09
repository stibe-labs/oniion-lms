// ═══════════════════════════════════════════════════════════════
// Parent Attendance API — GET /api/v1/parent/attendance
// Returns attendance records for parent's children
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'parent') {
      return NextResponse.json({ success: false, error: 'Parent only' }, { status: 403 });
    }

    const url = new URL(req.url);
    const studentEmail = url.searchParams.get('student_email');

    // Find children linked to this parent
    const childrenResult = await db.query(
      `SELECT up.email, pu.full_name
       FROM user_profiles up
       JOIN portal_users pu ON pu.email = up.email
       WHERE up.parent_email = $1`,
      [user.id]
    );

    // If no profiles linked, try admission_requests
    let childEmails: string[] = childrenResult.rows.map(
      (r: Record<string, unknown>) => String(r.email)
    );

    if (childEmails.length === 0) {
      const admResult = await db.query(
        `SELECT DISTINCT student_email FROM admission_requests
         WHERE parent_email = $1 AND status = 'active'`,
        [user.id]
      );
      childEmails = admResult.rows.map((r: Record<string, unknown>) => String(r.student_email));
    }

    // If specific student requested, verify it's parent's child
    const targetEmails = studentEmail && childEmails.includes(studentEmail)
      ? [studentEmail]
      : childEmails;

    if (targetEmails.length === 0) {
      return NextResponse.json({
        success: true,
        data: { children: [], message: 'No children linked to this parent account' },
      });
    }

    const childAttendance = [];

    for (const email of targetEmails) {
      // Get student name
      const nameResult = await db.query(
        `SELECT full_name FROM portal_users WHERE email = $1`,
        [email]
      );
      const name = String((nameResult.rows[0] as Record<string, unknown>)?.full_name || email);

      // Get attendance summary
      const summaryResult = await db.query(
        `SELECT
           COUNT(*) AS total_sessions,
           COUNT(*) FILTER (WHERE a.status = 'present') AS present,
           COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,
           COUNT(*) FILTER (WHERE a.late_join = true) AS late_count,
           COALESCE(AVG(a.total_duration_sec), 0) AS avg_time_sec,
           COALESCE(SUM(a.join_count), 0) AS total_rejoins
         FROM attendance_sessions a
         WHERE a.participant_email = $1`,
        [email]
      );

      // Get recent attendance details (last 30 sessions)
      const detailsResult = await db.query(
        `SELECT
           a.room_id,
           r.room_name AS batch_name,
           r.subject,
           r.grade,
           r.scheduled_start,
           a.status,
           a.late_join AS is_late,
           a.late_by_sec AS late_by_seconds,
           a.first_join_at,
           a.last_leave_at,
           a.total_duration_sec AS time_in_class_seconds,
           a.join_count,
           a.engagement_score
         FROM attendance_sessions a
         JOIN rooms r ON r.room_id = a.room_id
         WHERE a.participant_email = $1
         ORDER BY r.scheduled_start DESC
         LIMIT 30`,
        [email]
      );

      const summary = summaryResult.rows[0] as Record<string, unknown>;
      const totalSessions = Number(summary.total_sessions || 0);
      const present = Number(summary.present || 0);

      childAttendance.push({
        student_email: email,
        student_name: name,
        summary: {
          total_sessions: totalSessions,
          present,
          absent: Number(summary.absent || 0),
          late: Number(summary.late_count || 0),
          attendance_rate: totalSessions > 0
            ? Number(((present / totalSessions) * 100).toFixed(1))
            : 0,
          avg_time_minutes: Number((Number(summary.avg_time_sec || 0) / 60).toFixed(1)),
          total_rejoins: Number(summary.total_rejoins || 0),
        },
        recent_sessions: detailsResult.rows,
      });
    }

    return NextResponse.json({ success: true, data: { children: childAttendance } });
  } catch (err) {
    console.error('[parent/attendance] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
