import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { roomService, listParticipants } from '@/lib/livekit';

/**
 * POST /api/v1/room/participants/[identity]/mute
 * Teacher-only: mutes a participant's audio track.
 *
 * Body: { room_id }
 * Finds the participant's audio track and calls mutePublishedTrack.
 */
export async function POST(
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
        { success: false, error: 'Only teachers can mute participants' },
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

    // Find participant's audio track
    const participants = await listParticipants(room_id);
    const target = participants.find((p) => p.identity === identity);

    if (!target) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Participant not found in room' },
        { status: 404 }
      );
    }

    // Mute all audio tracks
    let mutedCount = 0;
    for (const track of target.tracks) {
      // Track.Source.MICROPHONE = 1 in protocol
      if (track.type === 1 || track.source === 1) {
        await roomService.mutePublishedTrack(room_id, identity, track.sid, true);
        mutedCount++;
      }
    }

    console.log(`[mute] Teacher ${user.name} muted ${identity} (${mutedCount} tracks) in ${room_id}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { muted: true, tracks_muted: mutedCount },
    });
  } catch (err) {
    console.error('[mute] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to mute participant' },
      { status: 500 }
    );
  }
}
