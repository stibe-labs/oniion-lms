import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { deleteRoom as deleteLiveKitRoom } from '@/lib/livekit';
import { stopRecording } from '@/lib/recording';

/**
 * POST /api/v1/room/[room_id]/end-request
 * Teacher requests to end class early (before scheduled end time).
 * Creates an event in room_events; coordinator must approve.
 *
 * Body: { reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // Verify room exists
    const roomResult = await db.query(
      `SELECT room_id, status, teacher_email, batch_session_id, scheduled_start, duration_minutes
       FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0] as Record<string, unknown>;
    const actualRoomId = String(room.room_id);

    // Only the teacher of this room can request early end
    if (user.role !== 'teacher' || room.teacher_email !== user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the assigned teacher can request early end' },
        { status: 403 }
      );
    }

    // Check if room is live
    if (room.status !== 'live') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room is not currently live' },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const pendingResult = await db.query(
      `SELECT id FROM room_events
       WHERE room_id = $1 AND event_type = 'end_class_requested'
       AND NOT EXISTS (
         SELECT 1 FROM room_events re2
         WHERE re2.room_id = $1
         AND re2.event_type IN ('end_class_approved', 'end_class_denied')
         AND re2.created_at > room_events.created_at
       )
       ORDER BY created_at DESC LIMIT 1`,
      [actualRoomId]
    );

    if (pendingResult.rows.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'A pending end-class request already exists' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = (body as Record<string, string>).reason || '';

    // Create the request event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'end_class_requested', $2, $3)`,
      [actualRoomId, user.id, JSON.stringify({
        teacher_name: user.name,
        reason,
        requested_at: new Date().toISOString(),
        scheduled_end: room.scheduled_start && room.duration_minutes
          ? new Date(new Date(String(room.scheduled_start)).getTime() + Number(room.duration_minutes) * 60000).toISOString()
          : null,
      })]
    );

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'End-class request submitted. Waiting for coordinator approval.' },
      { status: 201 }
    );
  } catch (err) {
    console.error('[end-request/post] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/room/[room_id]/end-request
 * Check the status of the end-class request.
 * Returns: { status: 'none' | 'pending' | 'approved' | 'denied', reason? }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // Resolve room_id
    const roomResult = await db.query(
      `SELECT room_id FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }
    const actualRoomId = String(roomResult.rows[0].room_id);

    // Get latest end-class events
    const eventsResult = await db.query(
      `SELECT event_type, payload, created_at FROM room_events
       WHERE room_id = $1
       AND event_type IN ('end_class_requested', 'end_class_approved', 'end_class_denied')
       ORDER BY created_at DESC LIMIT 5`,
      [actualRoomId]
    );

    if (eventsResult.rows.length === 0) {
      return NextResponse.json<ApiResponse<{ status: string }>>(
        { success: true, data: { status: 'none' } }
      );
    }

    const latest = eventsResult.rows[0] as Record<string, unknown>;
    const eventType = String(latest.event_type);
    const payload = typeof latest.payload === 'string'
      ? JSON.parse(latest.payload)
      : (latest.payload || {});

    let status = 'none';
    if (eventType === 'end_class_requested') status = 'pending';
    else if (eventType === 'end_class_approved') status = 'approved';
    else if (eventType === 'end_class_denied') status = 'denied';

    return NextResponse.json<ApiResponse<{ status: string; reason?: string; decided_by?: string; teacher_name?: string; requested_at?: string }>>(
      {
        success: true,
        data: {
          status,
          reason: payload.reason || payload.deny_reason || undefined,
          decided_by: payload.decided_by || undefined,
          teacher_name: payload.teacher_name || undefined,
          requested_at: payload.requested_at || (latest.created_at ? String(latest.created_at) : undefined),
        },
      }
    );
  } catch (err) {
    console.error('[end-request/get] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/room/[room_id]/end-request
 * Coordinator approves or denies an end-class request.
 * Body: { action: 'approve' | 'deny', reason?: string }
 *
 * If approved: also ends the room (same as DELETE /api/v1/room/[room_id])
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // Only coordinator / AO / owner can approve
    const approverRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner'];
    if (!approverRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only coordinators or admins can approve end-class requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, reason } = body as { action: 'approve' | 'deny'; reason?: string };

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'action must be "approve" or "deny"' },
        { status: 400 }
      );
    }

    // Resolve room_id
    const roomResult = await db.query(
      `SELECT room_id, status, room_name, batch_session_id
       FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0] as Record<string, string | null>;
    const actualRoomId = room.room_id as string;
    const batchSessionId = room.batch_session_id;

    // Verify there's a pending request
    const pendingResult = await db.query(
      `SELECT id, created_at FROM room_events
       WHERE room_id = $1 AND event_type = 'end_class_requested'
       AND NOT EXISTS (
         SELECT 1 FROM room_events re2
         WHERE re2.room_id = $1
         AND re2.event_type IN ('end_class_approved', 'end_class_denied')
         AND re2.created_at > room_events.created_at
       )
       ORDER BY created_at DESC LIMIT 1`,
      [actualRoomId]
    );

    if (pendingResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No pending end-class request found' },
        { status: 404 }
      );
    }

    const eventType = action === 'approve' ? 'end_class_approved' : 'end_class_denied';

    // Log the decision
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, $2, $3, $4)`,
      [actualRoomId, eventType, user.id, JSON.stringify({
        decided_by: user.name,
        decided_by_role: user.role,
        deny_reason: action === 'deny' ? (reason || '') : undefined,
        decided_at: new Date().toISOString(),
      })]
    );

    // If approved → end the room (same logic as DELETE handler)
    if (action === 'approve') {
      // Stop recording if active (before deleting the LiveKit room)
      try {
        await stopRecording(actualRoomId);
      } catch (e) {
        console.warn(`[end-request/approve] stopRecording warning for ${actualRoomId}:`, e);
      }

      // Record explicit-end marker so the LiveKit webhook recognizes this as a
      // genuine teacher-initiated end (not an idle auto-close).
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_end_requested', $2)`,
        [actualRoomId, JSON.stringify({ ended_by: user.id, via: 'end-request-approve' })]
      ).catch(e => console.warn('[end-request/approve] end-requested event insert warning:', e));

      try {
        await deleteLiveKitRoom(actualRoomId);
      } catch (e) {
        console.warn(`[end-request/approve] LiveKit room delete warning for ${actualRoomId}:`, e);
      }

      await db.query(
        `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW()
         WHERE room_id = $1`,
        [actualRoomId]
      );

      if (batchSessionId) {
        await db.query(
          `UPDATE batch_sessions SET status = 'ended', ended_at = COALESCE(ended_at, NOW())
           WHERE session_id = $1 AND status IN ('live', 'scheduled')`,
          [batchSessionId]
        ).catch(e => console.warn('[end-request/approve] batch_session sync warning:', e));
      }

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, payload)
         VALUES ($1, 'room_ended_by_coordinator', $2, $3)`,
        [actualRoomId, user.id, JSON.stringify({ ended_by: user.name, role: user.role, via: 'end_class_approval' })]
      );

      return NextResponse.json<ApiResponse>(
        { success: true, message: `End-class request approved. Session "${room.room_name}" has been ended.` }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'End-class request denied.' }
    );
  } catch (err) {
    console.error('[end-request/patch] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/room/[room_id]/end-request
 * Teacher cancels their own pending end-class request.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const roomResult = await db.query(
      `SELECT room_id, teacher_email FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Room not found' }, { status: 404 });
    }
    const room = roomResult.rows[0] as Record<string, string>;
    const actualRoomId = room.room_id;

    if (user.role !== 'teacher' || room.teacher_email !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only the assigned teacher can cancel' }, { status: 403 });
    }

    // Insert a 'denied' event to cancel the pending request
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'end_class_denied', $2, $3)`,
      [actualRoomId, user.id, JSON.stringify({ decided_by: user.name, cancel_reason: 'Teacher cancelled request' })]
    );

    return NextResponse.json<ApiResponse>({ success: true, message: 'End-class request cancelled' });
  } catch (err) {
    console.error('[end-request/delete] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
