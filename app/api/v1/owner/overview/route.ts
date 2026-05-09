// ═══════════════════════════════════════════════════════════════
// Owner API — overview + user stats
// GET /api/v1/owner/overview    — All rooms
// GET /api/v1/owner/user-stats  — User counts by role
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getOwner(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade,
            r.coordinator_email, r.teacher_email, r.status,
            r.scheduled_start, r.duration_minutes,
            (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count
     FROM rooms r
     ORDER BY r.scheduled_start DESC
     LIMIT 100`
  );

  return NextResponse.json({ success: true, data: { rooms: result.rows } });
}
