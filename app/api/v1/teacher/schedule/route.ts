// ═══════════════════════════════════════════════════════════════
// Teacher Schedule API — GET /api/v1/teacher/schedule
// Returns upcoming week's schedule for the logged-in teacher
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner'].includes(user.role))
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const weeksStr = searchParams.get('weeks') || '2';
    const weeks = Math.min(Math.max(parseInt(weeksStr, 10) || 2, 1), 8);

    // Fetch rooms from today going forward N weeks
    const result = await db.query(
      `SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
              r.status, r.scheduled_start, r.duration_minutes,
              r.notes_for_teacher, r.max_participants,
              (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count
       FROM rooms r
       WHERE r.teacher_email = $1
         AND r.scheduled_start >= CURRENT_DATE
         AND r.scheduled_start < CURRENT_DATE + INTERVAL '1 week' * $2
       ORDER BY r.scheduled_start ASC`,
      [user.id, weeks]
    );

    // Also get today's count for session-limit display
    const todayCount = await db.query(
      `SELECT COUNT(*) AS cnt FROM rooms
       WHERE teacher_email = $1
         AND DATE(scheduled_start AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
         AND status != 'cancelled'`,
      [user.id]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        schedule: result.rows,
        today_session_count: parseInt(String(todayCount.rows[0]?.cnt ?? '0'), 10),
        max_sessions_per_day: 4,
      },
    });
  } catch (err) {
    console.error('[teacher/schedule] error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
