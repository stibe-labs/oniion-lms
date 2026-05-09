// ═══════════════════════════════════════════════════════════════
// Class Cancellation Request Workflow API
// 4 workflows: parent-initiated, group, teacher-initiated (multi-level), policy
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

// ── GET — List cancellation requests ─────────────────────────

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');

    let query = `SELECT cr.*, r.room_name, r.subject, r.grade, r.scheduled_start, r.batch_type
                 FROM cancellation_requests cr
                 JOIN rooms r ON r.room_id = cr.room_id`;
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Role-based filtering
    if (user.role === 'parent' || user.role === 'student') {
      params.push(user.id); conditions.push(`cr.requested_by = $${params.length}`);
    } else if (user.role === 'teacher') {
      params.push(user.id); conditions.push(`(cr.requested_by = $${params.length} OR r.teacher_email = $${params.length})`);
    } else if (user.role === 'batch_coordinator') {
      params.push(user.id); conditions.push(`r.coordinator_email = $${params.length}`);
    }
    // owner, hr, academic_operator see all

    if (roomId) { params.push(roomId); conditions.push(`cr.room_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`cr.status = $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY cr.created_at DESC LIMIT 200';

    const result = await db.query(query, params);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { requests: result.rows },
    });
  } catch (err) {
    console.error('[cancellations] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — Create or process cancellation request ─────────────

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });

    const body = await request.json();
    const { action } = body as { action: string };

    // ── WORKFLOW A: Parent-initiated cancellation (1:1 classes) ──
    if (action === 'request_cancel') {
      const { roomId, reason } = body;
      if (!roomId) return NextResponse.json<ApiResponse>({ success: false, error: 'roomId required' }, { status: 400 });

      // Verify room exists and check batch_type
      const roomResult = await db.query(
        `SELECT room_id, batch_type, status, coordinator_email FROM rooms WHERE room_id = $1`,
        [roomId]
      );
      if (roomResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Batch not found' }, { status: 404 });
      }
      const room = roomResult.rows[0] as Record<string, unknown>;

      if (room.status === 'cancelled' || room.status === 'ended') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Batch already ended or cancelled' }, { status: 400 });
      }

      // Determine cancellation type based on requester role and batch_type
      let cancellationType = 'parent_initiated';
      if (user.role === 'teacher') {
        cancellationType = 'teacher_initiated';
      } else if (room.batch_type !== 'one_to_one' && (user.role === 'parent' || user.role === 'student')) {
        cancellationType = 'group_request';
      }

      const result = await db.query(
        `INSERT INTO cancellation_requests
           (room_id, requested_by, requester_role, reason, cancellation_type, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [roomId, user.id, user.role, reason || null, cancellationType]
      );

      // Log event
      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, payload)
         VALUES ($1, 'cancellation_requested', $2, $3)`,
        [roomId, user.id, JSON.stringify({ cancellationType, requestId: result.rows[0].id })]
      );

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { request: result.rows[0] },
        message: 'Cancellation request submitted for review',
      }, { status: 201 });
    }

    // ── Process approval (multi-level chain) ─────────────────
    if (action === 'approve' || action === 'reject') {
      const { requestId, notes } = body;
      if (!requestId) return NextResponse.json<ApiResponse>({ success: false, error: 'requestId required' }, { status: 400 });

      const reqResult = await db.query('SELECT * FROM cancellation_requests WHERE id = $1', [requestId]);
      if (reqResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Request not found' }, { status: 404 });
      }
      const req = reqResult.rows[0] as Record<string, unknown>;

      if (req.status === 'approved' || req.status === 'rejected') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Request already finalized' }, { status: 400 });
      }

      const isReject = action === 'reject';
      const cancellationType = req.cancellation_type as string;

      // ─── PARENT-INITIATED (1:1): Coordinator is final authority ───
      if (cancellationType === 'parent_initiated') {
        if (!['batch_coordinator', 'owner'].includes(user.role)) {
          return NextResponse.json<ApiResponse>({ success: false, error: 'Only batch coordinator can process parent cancellation requests' }, { status: 403 });
        }

        const finalStatus = isReject ? 'rejected' : 'approved';
        await db.query(
          `UPDATE cancellation_requests SET
             status = $1, coordinator_decision = $2, coordinator_email = $3, coordinator_at = NOW(),
             rejection_reason = $4, updated_at = NOW()
           WHERE id = $5`,
          [finalStatus, isReject ? 'rejected' : 'approved', user.id, isReject ? (notes || null) : null, requestId]
        );

        // If approved, cancel the room
        if (!isReject) {
          await db.query(`UPDATE rooms SET status = 'cancelled', updated_at = NOW() WHERE room_id = $1`, [req.room_id]);
          await db.query(
            `INSERT INTO room_events (room_id, event_type, participant_email, payload)
             VALUES ($1, 'cancellation_approved', $2, $3)`,
            [req.room_id, user.id, JSON.stringify({ requestId, approvedBy: user.id })]
          );
        }

        return NextResponse.json<ApiResponse>({ success: true, data: { status: finalStatus } });
      }

      // ─── GROUP REQUEST: Coordinator authority ───
      if (cancellationType === 'group_request') {
        if (!['batch_coordinator', 'owner'].includes(user.role)) {
          return NextResponse.json<ApiResponse>({ success: false, error: 'Only batch coordinator can process group cancellation requests' }, { status: 403 });
        }

        const finalStatus = isReject ? 'rejected' : 'approved';
        await db.query(
          `UPDATE cancellation_requests SET
             status = $1, coordinator_decision = $2, coordinator_email = $3, coordinator_at = NOW(),
             rejection_reason = $4, updated_at = NOW()
           WHERE id = $5`,
          [finalStatus, isReject ? 'rejected' : 'approved', user.id, isReject ? (notes || null) : null, requestId]
        );

        if (!isReject) {
          await db.query(`UPDATE rooms SET status = 'cancelled', updated_at = NOW() WHERE room_id = $1`, [req.room_id]);
        }

        return NextResponse.json<ApiResponse>({ success: true, data: { status: finalStatus } });
      }

      // ─── TEACHER-INITIATED: Multi-level approval chain ───
      // Flow: teacher → coordinator_approved → admin_approved → academic_approved → hr_approved → approved
      if (cancellationType === 'teacher_initiated') {
        const currentStatus = req.status as string;

        // Determine which level this approver can act on
        const levelMap: Record<string, { roles: string[]; decisionField: string; emailField: string; atField: string; nextStatus: string }> = {
          'pending': { roles: ['batch_coordinator', 'owner'], decisionField: 'coordinator_decision', emailField: 'coordinator_email', atField: 'coordinator_at', nextStatus: 'coordinator_approved' },
          'coordinator_approved': { roles: ['owner', 'academic_operator'], decisionField: 'admin_decision', emailField: 'admin_email', atField: 'admin_at', nextStatus: 'admin_approved' },
          'admin_approved': { roles: ['academic_operator', 'owner'], decisionField: 'academic_decision', emailField: 'academic_email', atField: 'academic_at', nextStatus: 'academic_approved' },
          'academic_approved': { roles: ['hr', 'owner'], decisionField: 'hr_decision', emailField: 'hr_email', atField: 'hr_at', nextStatus: 'approved' },
        };

        const level = levelMap[currentStatus];
        if (!level) {
          return NextResponse.json<ApiResponse>({ success: false, error: `Cannot process at status: ${currentStatus}` }, { status: 400 });
        }

        if (!level.roles.includes(user.role)) {
          return NextResponse.json<ApiResponse>({ success: false, error: `Your role (${user.role}) cannot approve at this stage` }, { status: 403 });
        }

        const newStatus = isReject ? 'rejected' : level.nextStatus;
        await db.query(
          `UPDATE cancellation_requests SET
             status = $1,
             ${level.decisionField} = $2,
             ${level.emailField} = $3,
             ${level.atField} = NOW(),
             rejection_reason = $4,
             updated_at = NOW()
           WHERE id = $5`,
          [newStatus, isReject ? 'rejected' : 'approved', user.id, isReject ? (notes || null) : null, requestId]
        );

        // If final approval reached (hr_approved → approved), cancel the room
        if (!isReject && newStatus === 'approved') {
          await db.query(`UPDATE rooms SET status = 'cancelled', updated_at = NOW() WHERE room_id = $1`, [req.room_id]);
          await db.query(
            `INSERT INTO room_events (room_id, event_type, participant_email, payload)
             VALUES ($1, 'cancellation_approved', $2, $3)`,
            [req.room_id, user.id, JSON.stringify({ requestId, approvedBy: user.id, chain: 'teacher_initiated' })]
          );
        }

        if (isReject) {
          await db.query(
            `INSERT INTO room_events (room_id, event_type, participant_email, payload)
             VALUES ($1, 'cancellation_rejected', $2, $3)`,
            [req.room_id, user.id, JSON.stringify({ requestId, rejectedBy: user.id, stage: currentStatus })]
          );
        }

        return NextResponse.json<ApiResponse>({ success: true, data: { status: newStatus } });
      }

      return NextResponse.json<ApiResponse>({ success: false, error: 'Unknown cancellation type' }, { status: 400 });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action. Use: request_cancel, approve, reject' }, { status: 400 });
  } catch (err) {
    console.error('[cancellations] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
