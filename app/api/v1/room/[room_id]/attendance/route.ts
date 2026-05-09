import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db, resolveRoomId } from '@/lib/db';
import { getAttendance, getEnhancedAttendance, getJoinLogs, type AttendanceRecord, type EnhancedAttendanceRecord, type JoinLogEntry } from '@/lib/attendance';

/**
 * GET /api/v1/room/[room_id]/attendance
 * Returns attendance records + join logs for a room.
 *
 * Auth: session cookie (teacher, coordinator, academic_operator, owner, ghost)
 *
 * Response: { attendance: AttendanceRecord[], logs: JoinLogEntry[], summary }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);

    // Auth
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid session' },
        { status: 401 },
      );
    }

    // Only authorized roles
    const allowedRoles = ['teacher', 'student', 'batch_coordinator', 'academic_operator', 'academic', 'owner', 'ghost', 'hr'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const isStudent = user.role === 'student';
    const isPrivileged = ['teacher', 'batch_coordinator', 'academic_operator', 'academic', 'owner', 'ghost'].includes(user.role);

    // Enhanced attendance for privileged roles includes unjoined students + contact info
    const [attendance, enhancedAttendance, logs] = await Promise.all([
      isStudent ? getAttendance(actualRoomId) : Promise.resolve([]),
      isPrivileged ? getEnhancedAttendance(actualRoomId) : Promise.resolve([]),
      getJoinLogs(actualRoomId),
    ]);

    // Also get teacher record from attendance_sessions
    let teacherRecord: AttendanceRecord | null = null;
    if (isPrivileged) {
      const allAtt = await getAttendance(actualRoomId);
      teacherRecord = allAtt.find((a) => a.participant_role === 'teacher') ?? null;
    }

    // Students only see their own record + limited logs
    const filteredAttendance: (AttendanceRecord | EnhancedAttendanceRecord)[] = isStudent
      ? attendance.filter((a) => a.participant_email === user.id)
      : [
          ...(teacherRecord ? [teacherRecord] : []),
          ...enhancedAttendance,
        ];
    const filteredLogs = isStudent
      ? logs.filter((l) => l.participant_email === user.id)
      : logs;

    // Compute summary (students only)
    const students = isStudent
      ? filteredAttendance.filter((a) => a.participant_role === 'student')
      : enhancedAttendance;
    const present = students.filter((a) => a.status === 'present').length;
    const late = students.filter((a) => a.status === 'late').length;
    const absent = students.filter((a) => a.status === 'absent').length;
    const notJoined = students.filter((a) => a.status === 'not_joined').length;
    const leftEarly = students.filter((a) => a.status === 'left_early').length;
    const totalDuration = students.reduce((sum, a) => sum + a.total_duration_sec, 0);
    const avgDuration = students.length > 0 ? Math.round(totalDuration / students.length) : 0;

    // Room schedule info (for auto-absent timing)
    let roomSchedule: { scheduled_start: string; duration_minutes: number } | null = null;
    if (isPrivileged) {
      const roomRes = await db.query(
        `SELECT scheduled_start, duration_minutes FROM rooms WHERE room_id = $1`,
        [actualRoomId],
      );
      if (roomRes.rows.length > 0) {
        const r = roomRes.rows[0] as { scheduled_start: string; duration_minutes: number };
        roomSchedule = { scheduled_start: r.scheduled_start, duration_minutes: r.duration_minutes };
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        attendance: filteredAttendance,
        logs: filteredLogs,
        summary: {
          total_students: students.length,
          present,
          late,
          absent,
          not_joined: notJoined,
          left_early: leftEarly,
          avg_duration_sec: avgDuration,
        },
        ...(roomSchedule ? { room_schedule: roomSchedule } : {}),
      },
    });
  } catch (err) {
    console.error('[attendance GET] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
