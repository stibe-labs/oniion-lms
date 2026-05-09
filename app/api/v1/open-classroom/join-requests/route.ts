import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ApiResponse { success: boolean; data?: unknown; error?: string }

// GET /api/v1/open-classroom/join-requests?room_id=oc_xxx
// Returns pending join requests for an OC room
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get('room_id');
  if (!roomId) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'room_id required' }, { status: 400 });
  }

  try {
    // Find classroom by room name
    const ocRes = await db.query(
      `SELECT id, auto_approve_joins FROM open_classrooms WHERE livekit_room_name = $1 OR room_id = $1 LIMIT 1`,
      [roomId]
    );
    if (ocRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: { requests: [], auto_approve: true } });
    }
    const oc = ocRes.rows[0];

    const pendingRes = await db.query(
      `SELECT id, name, email, phone, joined_at AS created_at
       FROM open_classroom_participants
       WHERE classroom_id = $1 AND approval_status = 'pending'
       ORDER BY joined_at ASC`,  
      [oc.id]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        requests: pendingRes.rows,
        auto_approve: oc.auto_approve_joins,
      },
    });
  } catch (err) {
    console.error('[join-requests GET] error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST /api/v1/open-classroom/join-requests
// Approve or deny a join request (or toggle auto-approve)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_id, participant_id, action, auto_approve } = body;

    if (!room_id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'room_id required' }, { status: 400 });
    }

    // Find classroom
    const ocRes = await db.query(
      `SELECT id FROM open_classrooms WHERE livekit_room_name = $1 OR room_id = $1 LIMIT 1`,
      [room_id]
    );
    if (ocRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }
    const classroomId = ocRes.rows[0].id;

    // Toggle auto-approve
    if (typeof auto_approve === 'boolean') {
      await db.query(
        `UPDATE open_classrooms SET auto_approve_joins = $1 WHERE id = $2`,
        [auto_approve, classroomId]
      );
      // If enabling auto-approve, approve all pending
      if (auto_approve) {
        await db.query(
          `UPDATE open_classroom_participants SET approval_status = 'approved'
           WHERE classroom_id = $1 AND approval_status = 'pending'`,
          [classroomId]
        );
      }
      return NextResponse.json<ApiResponse>({ success: true, data: { auto_approve } });
    }

    // Approve or deny a specific participant
    if (!participant_id || !action) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'participant_id and action required' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'denied';
    await db.query(
      `UPDATE open_classroom_participants SET approval_status = $1
       WHERE id = $2 AND classroom_id = $3`,
      [newStatus, participant_id, classroomId]
    );

    return NextResponse.json<ApiResponse>({ success: true, data: { participant_id, status: newStatus } });
  } catch (err) {
    console.error('[join-requests POST] error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Server error' }, { status: 500 });
  }
}
