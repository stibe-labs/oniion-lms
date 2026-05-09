import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/**
 * GET /api/v1/room/[room_id]/lobby
 * Returns count of students actively waiting in the lobby (heartbeat within last 15 s).
 * Only teachers/admins of the room should call this.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    // Resolve actual room_id (in case batch_session_id was used)
    const roomResult = await db.query(
      `SELECT room_id FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );
    const resolvedRoomId = roomResult.rows[0]?.room_id ?? room_id;

    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM lobby_presence
       WHERE room_id = $1 AND last_seen > NOW() - INTERVAL '30 seconds'`,
      [resolvedRoomId]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { count: result.rows[0]?.count ?? 0 },
    });
  } catch (err) {
    console.error('[lobby] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
