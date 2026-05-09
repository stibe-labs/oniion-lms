// ═══════════════════════════════════════════════════════════════
// Academic Rooms API — GET /api/v1/academic/rooms
// Academic operator can view all rooms (read-only observation)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['academic', 'academic_operator', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
            r.coordinator_email, r.teacher_email, r.status,
            r.scheduled_start, r.duration_minutes, r.max_participants,
            (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count
     FROM rooms r
     ORDER BY r.scheduled_start DESC
     LIMIT 100`
  );

  return NextResponse.json({ success: true, data: { rooms: result.rows } });
}
