import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { roomService } from '@/lib/livekit';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * GET /api/v1/academic-operator/zombie-rooms
 * Returns rooms that are marked 'live' in the DB but no longer exist
 * in the LiveKit media server (zombie / stuck rooms).
 *
 * Also exposes POST for force-ending a zombie room by room_id.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['academic_operator', 'owner', 'batch_coordinator', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Step 1: All rooms currently marked live in DB
    const { rows: dbLiveRooms } = await db.query<{
      room_id: string;
      room_name: string;
      teacher_email: string | null;
      batch_id: string | null;
      go_live_at: string | null;
    }>(
      `SELECT room_id, room_name, teacher_email, batch_id, go_live_at
       FROM rooms
       WHERE status = 'live'
       ORDER BY go_live_at ASC NULLS LAST`,
    );

    if (dbLiveRooms.length === 0) {
      return NextResponse.json({ success: true, data: { zombies: [], count: 0 } });
    }

    // Step 2: Ask LiveKit which of these rooms actually exist right now
    const names = dbLiveRooms.map(r => r.room_id);
    let livekitRooms: Set<string>;
    try {
      const rooms = await roomService.listRooms(names);
      livekitRooms = new Set(rooms.map(r => r.name));
    } catch {
      // If LiveKit is unreachable, return an error state rather than false positives
      return NextResponse.json(
        { success: false, error: 'LiveKit unreachable — cannot verify room status' },
        { status: 502 },
      );
    }

    // Step 3: Any DB-live room not found in LiveKit → zombie
    const zombies = dbLiveRooms.filter(r => !livekitRooms.has(r.room_id));

    return NextResponse.json({ success: true, data: { zombies, count: zombies.length } });
  } catch (err) {
    console.error('[zombie-rooms GET]', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/academic-operator/zombie-rooms
 * Body: { room_id: string }
 * Force-ends a zombie room by marking it 'ended' in the DB.
 * (The LiveKit room is already gone — we just clean up the DB record.)
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['academic_operator', 'owner', 'batch_coordinator', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { room_id } = await request.json() as { room_id?: string };
    if (!room_id) return NextResponse.json({ success: false, error: 'Missing room_id' }, { status: 400 });

    // Verify it's actually a zombie (still live in DB, not in LiveKit)
    const { rows } = await db.query('SELECT room_id FROM rooms WHERE room_id = $1 AND status = $2', [room_id, 'live']);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Room not found or not in live status' }, { status: 404 });
    }

    // Mark ended
    await db.query(
      `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE room_id = $1`,
      [room_id],
    );
    // Mirror to batch_sessions if linked
    await db.query(
      `UPDATE batch_sessions SET status = 'ended', updated_at = NOW() WHERE livekit_room_name = $1`,
      [room_id],
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[zombie-rooms POST]', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
