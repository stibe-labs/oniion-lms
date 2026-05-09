import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { roomService } from '@/lib/livekit';

/**
 * DELETE /api/v1/room/participants/[identity]
 * Teacher-only: removes (kicks) a participant from the room.
 *
 * Body: { room_id }
 * The participant is disconnected but can re-join if they have a valid token.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ identity: string }> }
) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user || user.role !== 'teacher') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only teachers can remove participants' },
        { status: 403 }
      );
    }

    const { identity } = await params;
    const body = await request.json();
    const { room_id } = body as { room_id?: string };

    if (!room_id || !identity) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing room_id or identity' },
        { status: 400 }
      );
    }

    // Prevent teacher from kicking themselves
    const teacherIdentity = `teacher_${user.id}`;
    if (identity === teacherIdentity) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Cannot remove yourself from the room' },
        { status: 400 }
      );
    }

    await roomService.removeParticipant(room_id, identity);

    console.log(`[kick] Teacher ${user.name} removed ${identity} from ${room_id}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { removed: true, identity },
    });
  } catch (err) {
    console.error('[kick] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
}
