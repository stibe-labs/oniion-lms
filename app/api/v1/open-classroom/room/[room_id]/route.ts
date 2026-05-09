import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';

/**
 * GET /api/v1/open-classroom/room/[room_id] — Public lookup
 *
 * Maps an open classroom room_id (oc_*) to its public join_token.
 * No authentication required — used by ClassroomWrapper to redirect
 * unauthenticated participants back to the OC join page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

    const result = await db.query(
      `SELECT join_token, status FROM open_classrooms WHERE room_id = $1 LIMIT 1`,
      [room_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }

    const row = result.rows[0] as { join_token: string; status: string };

    if (row.status === 'ended') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'This classroom has ended' }, { status: 410 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { join_token: row.join_token } });
  } catch (err) {
    console.error('[OC room lookup]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
