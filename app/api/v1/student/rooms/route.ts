// ═══════════════════════════════════════════════════════════════
// Student Rooms API — GET /api/v1/student/rooms
// Returns rooms assigned to the logged-in student
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

    const result = await db.query(
      `SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
              r.teacher_email, r.status, r.scheduled_start, r.duration_minutes,
              r.max_participants, r.notes_for_teacher,
              bs.started_at,
              ra.payment_status,
              t.full_name AS teacher_name
       FROM room_assignments ra
       JOIN rooms r ON r.room_id = ra.room_id
       LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
       LEFT JOIN portal_users t ON t.email = r.teacher_email
       WHERE ra.participant_email = $1
         AND ra.participant_type = 'student'
       ORDER BY r.scheduled_start DESC
       LIMIT 100`,
      [user.id]
    );

    return NextResponse.json({ success: true, data: { rooms: result.rows } });
  } catch (err) {
    console.error('[student/rooms] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
