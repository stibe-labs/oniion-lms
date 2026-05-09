// ═══════════════════════════════════════════════════════════════
// HR Attendance API — GET /api/v1/hr/attendance
// Returns aggregate attendance data across all rooms for HR
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['hr', 'owner'].includes(user.role))
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });

    const url = new URL(req.url);
    const resource = url.searchParams.get('resource') || 'summary';
    const days = Math.min(Number(url.searchParams.get('days') || '30'), 90);

    // ── Summary: Aggregate attendance stats ───────────────────
    if (resource === 'summary') {
      // Total rooms in period
      const roomsResult = await db.query<{ total: string; completed: string; cancelled: string }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'ended') AS completed,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
         FROM rooms
         WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
        [days]
      );

      // Attendance stats across all rooms
      const attendanceResult = await db.query<{
        total_sessions: string;
        present_count: string;
        late_count: string;
        absent_count: string;
        avg_duration_sec: string;
      }>(
        `SELECT
           COUNT(*) AS total_sessions,
           COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
           COUNT(*) FILTER (WHERE a.status = 'late') AS late_count,
           COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
           COALESCE(AVG(a.total_duration_sec) FILTER (WHERE a.total_duration_sec > 0), 0) AS avg_duration_sec
         FROM attendance_sessions a
         JOIN rooms r ON r.room_id = a.room_id
         WHERE r.created_at >= NOW() - INTERVAL '1 day' * $1
           AND a.participant_role = 'student'`,
        [days]
      );

      // Teacher attendance
      const teacherResult = await db.query<{
        total_sessions: string;
        present_count: string;
        avg_duration_sec: string;
      }>(
        `SELECT
           COUNT(*) AS total_sessions,
           COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) AS present_count,
           COALESCE(AVG(a.total_duration_sec) FILTER (WHERE a.total_duration_sec > 0), 0) AS avg_duration_sec
         FROM attendance_sessions a
         JOIN rooms r ON r.room_id = a.room_id
         WHERE r.created_at >= NOW() - INTERVAL '1 day' * $1
           AND a.participant_role = 'teacher'`,
        [days]
      );

      const rooms = roomsResult.rows[0];
      const students = attendanceResult.rows[0];
      const teachers = teacherResult.rows[0];

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          period_days: days,
          rooms: {
            total: Number(rooms?.total || 0),
            completed: Number(rooms?.completed || 0),
            cancelled: Number(rooms?.cancelled || 0),
          },
          students: {
            total_sessions: Number(students?.total_sessions || 0),
            present: Number(students?.present_count || 0),
            late: Number(students?.late_count || 0),
            absent: Number(students?.absent_count || 0),
            avg_duration_min: Math.round(Number(students?.avg_duration_sec || 0) / 60),
          },
          teachers: {
            total_sessions: Number(teachers?.total_sessions || 0),
            present: Number(teachers?.present_count || 0),
            avg_duration_min: Math.round(Number(teachers?.avg_duration_sec || 0) / 60),
          },
        },
      });
    }

    // ── Recent: Latest attendance records ───────────────────────
    if (resource === 'recent') {
      const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 200);
      const role = url.searchParams.get('role'); // 'student' | 'teacher' | null

      let whereRole = '';
      const params: (string | number)[] = [days, limit];
      if (role === 'student' || role === 'teacher') {
        whereRole = `AND a.participant_role = $3`;
        params.push(role);
      }

      const result = await db.query(
        `SELECT
           a.participant_email, a.participant_name, a.participant_role,
           a.status, a.first_join_at, a.last_leave_at,
           a.total_duration_sec, a.join_count, a.late_join, a.late_by_sec,
           r.room_id, r.room_name, r.scheduled_start, r.status AS room_status
         FROM attendance_sessions a
         JOIN rooms r ON r.room_id = a.room_id
         WHERE r.created_at >= NOW() - INTERVAL '1 day' * $1
           ${whereRole}
         ORDER BY a.first_join_at DESC NULLS LAST
         LIMIT $2`,
        params
      );

      return NextResponse.json<ApiResponse>({ success: true, data: { records: result.rows } });
    }

    // ── By Teacher: Attendance grouped by teacher ──────────────
    if (resource === 'by_teacher') {
      const result = await db.query(
        `SELECT
           a.participant_email,
           a.participant_name,
           COUNT(*) AS total_classes,
           COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) AS attended,
           COUNT(*) FILTER (WHERE a.status = 'absent') AS missed,
           COUNT(*) FILTER (WHERE a.status = 'late') AS late,
           COALESCE(AVG(a.total_duration_sec) FILTER (WHERE a.total_duration_sec > 0), 0) AS avg_duration_sec
         FROM attendance_sessions a
         JOIN rooms r ON r.room_id = a.room_id
         WHERE r.created_at >= NOW() - INTERVAL '1 day' * $1
           AND a.participant_role = 'teacher'
         GROUP BY a.participant_email, a.participant_name
         ORDER BY total_classes DESC`,
        [days]
      );

      return NextResponse.json<ApiResponse>({ success: true, data: { teachers: result.rows } });
    }

    // ── By Student: Attendance grouped by student ──────────────
    if (resource === 'by_student') {
      const result = await db.query(
        `SELECT
           a.participant_email,
           a.participant_name,
           COUNT(*) AS total_classes,
           COUNT(*) FILTER (WHERE a.status = 'present') AS present,
           COUNT(*) FILTER (WHERE a.status = 'late') AS late,
           COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,
           COALESCE(AVG(a.total_duration_sec) FILTER (WHERE a.total_duration_sec > 0), 0) AS avg_duration_sec,
           COALESCE(AVG(a.late_by_sec) FILTER (WHERE a.late_by_sec > 0), 0) AS avg_late_sec
         FROM attendance_sessions a
         JOIN rooms r ON r.room_id = a.room_id
         WHERE r.created_at >= NOW() - INTERVAL '1 day' * $1
           AND a.participant_role = 'student'
         GROUP BY a.participant_email, a.participant_name
         ORDER BY total_classes DESC`,
        [days]
      );

      return NextResponse.json<ApiResponse>({ success: true, data: { students: result.rows } });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid resource. Use: summary, recent, by_teacher, by_student' }, { status: 400 });
  } catch (err) {
    console.error('[hr/attendance] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
