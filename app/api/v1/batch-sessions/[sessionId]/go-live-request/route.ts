import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════
// POST — Teacher requests to go live
// ═══════════════════════════════════════════════════════════════
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const sessionToken = _request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    // Verify session exists and teacher owns it
    const result = await db.query(
      `SELECT s.session_id, s.teacher_email, s.status, s.go_live_status,
              b.coordinator_email, b.batch_name
       FROM batch_sessions s
       JOIN batches b ON b.batch_id = s.batch_id
       WHERE s.session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = result.rows[0] as Record<string, string | null>;

    if (user.role !== 'teacher' || session.teacher_email !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only the assigned teacher can request Go Live' }, { status: 403 });
    }
    if (session.status !== 'scheduled') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session is not in scheduled status' }, { status: 400 });
    }
    if (session.go_live_status === 'pending') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'A request is already pending' }, { status: 409 });
    }

    // Set status to pending
    await db.query(
      `UPDATE batch_sessions SET go_live_status = 'pending', go_live_requested_at = NOW(),
       go_live_decided_at = NULL, go_live_decided_by = NULL
       WHERE session_id = $1`,
      [sessionId]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        session_id: sessionId,
        go_live_status: 'pending',
        coordinator_email: session.coordinator_email,
        batch_name: session.batch_name,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[go-live-request] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// GET — Poll go-live request status
// ═══════════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const result = await db.query(
      `SELECT s.go_live_status, s.go_live_requested_at, s.go_live_decided_at, s.go_live_decided_by,
              b.coordinator_email
       FROM batch_sessions s
       JOIN batches b ON b.batch_id = s.batch_id
       WHERE s.session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const row = result.rows[0] as Record<string, string | null>;
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        go_live_status: row.go_live_status ?? 'none',
        requested_at: row.go_live_requested_at,
        decided_at: row.go_live_decided_at,
        decided_by: row.go_live_decided_by,
        has_coordinator: !!row.coordinator_email,
      },
    });
  } catch (err) {
    console.error('[go-live-request] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH — BC approves or denies the go-live request
// Body: { action: 'approve' | 'deny' }
// ═══════════════════════════════════════════════════════════════
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    // Only BC, AO, or owner can approve/deny
    const allowedRoles = ['batch_coordinator', 'academic_operator', 'owner'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = (body as Record<string, string>).action;
    if (action !== 'approve' && action !== 'deny') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'action must be approve or deny' }, { status: 400 });
    }

    // Verify session exists and has pending request
    const result = await db.query(
      `SELECT s.session_id, s.go_live_status, b.coordinator_email
       FROM batch_sessions s
       JOIN batches b ON b.batch_id = s.batch_id
       WHERE s.session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = result.rows[0] as Record<string, string | null>;
    if (session.go_live_status !== 'pending') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No pending go-live request' }, { status: 400 });
    }

    // BC can only approve their own batch sessions
    if (user.role === 'batch_coordinator' && session.coordinator_email !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not your batch' }, { status: 403 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'denied';
    await db.query(
      `UPDATE batch_sessions SET go_live_status = $1, go_live_decided_at = NOW(), go_live_decided_by = $2
       WHERE session_id = $3`,
      [newStatus, user.id, sessionId]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { session_id: sessionId, go_live_status: newStatus },
    });
  } catch (err) {
    console.error('[go-live-request] PATCH error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
