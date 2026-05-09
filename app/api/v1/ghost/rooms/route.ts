// ═══════════════════════════════════════════════════════════════
// Ghost Rooms API — GET /api/v1/ghost/rooms
// Ghost observers can see all live/scheduled rooms with batch info
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['ghost', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view'); // 'batch' | 'teacher' | null

  // Fetch rooms with batch info
  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade,
            r.teacher_email, r.status, r.scheduled_start, r.duration_minutes,
            r.batch_id, r.batch_session_id, r.section, r.batch_type,
            b.batch_name, b.coordinator_email,
            t.full_name AS teacher_name
     FROM rooms r
     LEFT JOIN batches b ON b.batch_id = r.batch_id
     LEFT JOIN portal_users t ON t.email = r.teacher_email
     WHERE r.status IN ('scheduled', 'live')
     ORDER BY
       CASE WHEN r.status = 'live' THEN 0 ELSE 1 END,
       r.scheduled_start ASC
     LIMIT 100`
  );

  const rooms = result.rows;

  // Build grouped views
  if (view === 'batch') {
    const byBatch: Record<string, { batch_name: string; batch_id: string; rooms: typeof rooms }> = {};
    for (const r of rooms) {
      const row = r as Record<string, unknown>;
      const bid = (row.batch_id as string) || 'unlinked';
      if (!byBatch[bid]) {
        byBatch[bid] = {
          batch_id: bid,
          batch_name: (row.batch_name as string) || 'Standalone Room',
          rooms: [],
        };
      }
      byBatch[bid].rooms.push(r);
    }
    return NextResponse.json({ success: true, data: { batches: Object.values(byBatch) } });
  }

  if (view === 'teacher') {
    const byTeacher: Record<string, { teacher_email: string; teacher_name: string; rooms: typeof rooms }> = {};
    for (const r of rooms) {
      const row = r as Record<string, unknown>;
      const email = (row.teacher_email as string) || 'unassigned';
      if (!byTeacher[email]) {
        byTeacher[email] = {
          teacher_email: email,
          teacher_name: (row.teacher_name as string) || email,
          rooms: [],
        };
      }
      byTeacher[email].rooms.push(r);
    }
    return NextResponse.json({ success: true, data: { teachers: Object.values(byTeacher) } });
  }

  return NextResponse.json({ success: true, data: { rooms } });
}
