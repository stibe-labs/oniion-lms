import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { collectDemoSummary } from '@/lib/demo-summary';

/**
 * GET /api/v1/demo/summary/[roomId]
 *
 * Returns comprehensive summary data for a completed demo session.
 * Used by the teacher dashboard to display session details inline.
 *
 * Auth: teacher of the room, AO, owner, batch_coordinator, ghost, hr
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    // Only demo rooms
    if (!roomId.startsWith('demo_')) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not a demo room' }, { status: 400 });
    }

    // Authorization: teacher of this room, or admin roles
    const adminRoles = ['academic_operator', 'owner', 'batch_coordinator', 'ghost', 'hr'];
    if (user.role === 'teacher') {
      // Verify teacher owns this demo
      const { db } = await import('@/lib/db');
      const check = await db.query(
        `SELECT 1 FROM rooms WHERE room_id = $1 AND teacher_email = $2`,
        [roomId, user.id],
      );
      if (check.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Not your demo session' }, { status: 403 });
      }
    } else if (!adminRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const summary = await collectDemoSummary(roomId);
    if (!summary) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Summary data not available' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: summary });
  } catch (err) {
    console.error('[demo/summary GET] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
