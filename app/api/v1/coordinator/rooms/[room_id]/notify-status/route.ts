// ═══════════════════════════════════════════════════════════════
// GET /api/v1/coordinator/rooms/[room_id]/notify-status
// ═══════════════════════════════════════════════════════════════
// Returns email notification send progress for a room.
// Coordinator dashboard polls this every 3 seconds until
// pending === 0.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { resolveRoomId } from '@/lib/db';
import { getNotifyStatus } from '@/lib/email-queue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

    if (!room_id) {
      return NextResponse.json(
        { success: false, error: 'Missing room_id parameter' },
        { status: 400 }
      );
    }

    const actualRoomId = await resolveRoomId(room_id);
    const status = await getNotifyStatus(actualRoomId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[notify-status] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification status' },
      { status: 500 }
    );
  }
}
