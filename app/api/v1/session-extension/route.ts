// ═══════════════════════════════════════════════════════════════
// Session Extension Request API
// POST   — Student creates request (checks teacher availability first)
// GET    — Fetch requests for a room / coordinator dashboard
// PATCH  — Teacher or Coordinator approves/rejects
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { calculateBatchSessionFee, formatAmount } from '@/lib/payment';
import { sendInvoiceGenerated } from '@/lib/email';

// ── POST — Student requests extension ───────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'student') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only students can request extensions' }, { status: 403 });
    }

    const body = await req.json();
    const { room_id, requested_minutes, reason, check_only } = body as {
      room_id: string;
      requested_minutes: number;
      reason?: string;
      check_only?: boolean;
    };

    if (!room_id || ![30, 60, 120].includes(requested_minutes)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid room_id or requested_minutes (30/60/120)' }, { status: 400 });
    }

    // 1. Fetch room + batch info
    const roomRes = await db.query(
      `SELECT r.room_id, r.status, r.teacher_email, r.scheduled_start, r.duration_minutes,
              r.batch_id, r.batch_session_id, r.subject, r.grade, r.go_live_at, r.expires_at,
              b.coordinator_email, b.batch_name
       FROM rooms r
       LEFT JOIN batches b ON b.batch_id = r.batch_id
       WHERE r.room_id = $1`,
      [room_id]
    );
    if (roomRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Room not found' }, { status: 404 });
    }
    const room = roomRes.rows[0] as Record<string, unknown>;

    if (room.status !== 'live') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session is not live' }, { status: 400 });
    }

    // 2. Check no duplicate pending request for this student + room
    const existing = await db.query(
      `SELECT id FROM session_extension_requests
       WHERE room_id = $1 AND student_email = $2
         AND status NOT IN ('rejected_by_teacher', 'rejected_by_coordinator', 'expired', 'cancelled')`,
      [room_id, user.id]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'You already have a pending or approved extension request' }, { status: 409 });
    }

    // 3. Check teacher availability — no overlapping sessions after current one ends
    const teacherEmail = room.teacher_email as string;
    const startStr = (room.go_live_at || room.scheduled_start) as string;
    const currentDuration = Number(room.duration_minutes);
    const currentEndMs = new Date(startStr).getTime() + currentDuration * 60_000;
    const proposedEndMs = currentEndMs + requested_minutes * 60_000;
    const proposedEndISO = new Date(proposedEndMs).toISOString();

    // Check rooms table for teacher conflicts
    const conflictRes = await db.query(
      `SELECT room_id, room_name, scheduled_start, duration_minutes
       FROM rooms
       WHERE teacher_email = $1
         AND room_id != $2
         AND status IN ('scheduled', 'live')
         AND scheduled_start < $3::timestamptz
         AND (scheduled_start + (duration_minutes || ' minutes')::interval) > $4::timestamptz`,
      [teacherEmail, room_id, proposedEndISO, new Date(currentEndMs).toISOString()]
    );

    if (conflictRes.rows.length > 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Teacher has another session scheduled — extension not available',
        data: { teacher_busy: true },
      }, { status: 409 });
    }

    // Also check batch_sessions for teacher conflicts (sessions not yet created as rooms)
    const today = new Date().toISOString().slice(0, 10);
    const currentEndTime = new Date(currentEndMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const proposedEndTime = new Date(proposedEndMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

    const bsConflict = await db.query(
      `SELECT session_id, subject, start_time, duration_minutes
       FROM batch_sessions
       WHERE teacher_email = $1
         AND scheduled_date = $2::date
         AND session_id != COALESCE($5, '')
         AND status IN ('scheduled', 'live')
         AND start_time < $3::time
         AND (start_time + (duration_minutes || ' minutes')::interval) > $4::time`,
      [teacherEmail, today, proposedEndTime, currentEndTime, room.batch_session_id || '']
    );

    if (bsConflict.rows.length > 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Teacher has another session scheduled — extension not available',
        data: { teacher_busy: true },
      }, { status: 409 });
    }

    // 4. Calculate extension fee — check extra_time_rates first, then fallback to pro-rata session rate
    let extensionFeePaise = 0;
    const etRateRes = await db.query(
      `SELECT rate_paise, currency FROM extra_time_rates
       WHERE duration_minutes = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [requested_minutes]
    );
    if (etRateRes.rows.length > 0) {
      extensionFeePaise = Number((etRateRes.rows[0] as { rate_paise: number }).rate_paise);
    } else if (room.batch_id) {
      const fee = await calculateBatchSessionFee({
        batchId: room.batch_id as string,
        subject: (room.subject as string) || '',
        grade: (room.grade as string) || null,
        durationMinutes: requested_minutes,
      });
      if (fee) extensionFeePaise = fee.amountPaise;
    }

    // Also fetch all tier prices for the response (for check_only)
    const allTiersRes = await db.query(
      `SELECT duration_minutes, rate_paise, currency, label
       FROM extra_time_rates WHERE is_active = true ORDER BY duration_minutes ASC`
    );
    const tiers = allTiersRes.rows as Array<{ duration_minutes: number; rate_paise: number; currency: string; label: string }>;

    // Availability check only — don't create the request
    if (check_only) {
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'Teacher is available for extension',
        data: { available: true, extension_fee_paise: extensionFeePaise, tiers },
      });
    }

    // 5. Create request
    const insertRes = await db.query(
      `INSERT INTO session_extension_requests (
         room_id, batch_session_id, batch_id,
         student_email, student_name,
         requested_minutes, reason, status,
         teacher_email, coordinator_email,
         original_duration, extension_fee_paise
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_teacher',$8,$9,$10,$11)
       RETURNING id, extension_fee_paise`,
      [
        room_id,
        room.batch_session_id || null,
        room.batch_id || null,
        user.id,
        user.name || user.id,
        requested_minutes,
        reason || null,
        teacherEmail,
        (room.coordinator_email as string) || null,
        currentDuration,
        extensionFeePaise,
      ]
    );

    const request = insertRes.rows[0] as { id: string; extension_fee_paise: number };

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Extension request sent to teacher',
      data: {
        request_id: request.id,
        requested_minutes,
        extension_fee_paise: request.extension_fee_paise,
        status: 'pending_teacher',
      },
    });
  } catch (err) {
    console.error('[session-extension POST]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET — Fetch extension requests ──────────────────────────
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const roomId = url.searchParams.get('room_id');
    const status = url.searchParams.get('status');

    let query = `
      SELECT ser.*,
             r.room_name, r.subject, r.grade, r.scheduled_start, r.duration_minutes,
             b.batch_name
      FROM session_extension_requests ser
      LEFT JOIN rooms r ON r.room_id = ser.room_id
      LEFT JOIN batches b ON b.batch_id = ser.batch_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Role-based filtering
    if (user.role === 'student') {
      params.push(user.id);
      query += ` AND ser.student_email = $${params.length}`;
    } else if (user.role === 'teacher') {
      params.push(user.id);
      query += ` AND ser.teacher_email = $${params.length}`;
    } else if (user.role === 'batch_coordinator') {
      params.push(user.id);
      query += ` AND ser.coordinator_email = $${params.length}`;
    }
    // owner/academic_operator see all

    if (roomId) {
      params.push(roomId);
      query += ` AND ser.room_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND ser.status = $${params.length}`;
    }

    query += ` ORDER BY ser.created_at DESC LIMIT 50`;

    const result = await db.query(query, params);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { requests: result.rows },
    });
  } catch (err) {
    console.error('[session-extension GET]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH — Teacher or Coordinator approves/rejects ─────────
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { request_id, action, note } = body as {
      request_id: string;
      action: 'approve' | 'reject';
      note?: string;
    };

    if (!request_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid request_id or action' }, { status: 400 });
    }

    // Fetch the request
    const reqRes = await db.query(
      `SELECT * FROM session_extension_requests WHERE id = $1`,
      [request_id]
    );
    if (reqRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Request not found' }, { status: 404 });
    }
    const extReq = reqRes.rows[0] as Record<string, unknown>;

    // ── TEACHER action ──
    if (user.role === 'teacher') {
      if (extReq.status !== 'pending_teacher') {
        return NextResponse.json<ApiResponse>({ success: false, error: `Cannot act on request in status: ${extReq.status}` }, { status: 400 });
      }
      if (extReq.teacher_email !== user.id) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Not your request to review' }, { status: 403 });
      }

      if (action === 'reject') {
        await db.query(
          `UPDATE session_extension_requests
           SET status = 'rejected_by_teacher', teacher_responded_at = NOW(), teacher_note = $2, updated_at = NOW()
           WHERE id = $1`,
          [request_id, note || null]
        );
        return NextResponse.json<ApiResponse>({ success: true, message: 'Extension rejected', data: { status: 'rejected_by_teacher' } });
      }

      // Teacher approves → forward to coordinator
      if (extReq.coordinator_email) {
        await db.query(
          `UPDATE session_extension_requests
           SET status = 'pending_coordinator', teacher_responded_at = NOW(), teacher_note = $2, updated_at = NOW()
           WHERE id = $1`,
          [request_id, note || null]
        );
        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Approved by teacher — forwarded to coordinator',
          data: { status: 'pending_coordinator' },
        });
      }

      // No coordinator — teacher approval is final, apply extension
      return await applyExtension(request_id, extReq, user.id, note);
    }

    // ── COORDINATOR action ──
    if (user.role === 'batch_coordinator' || user.role === 'academic_operator' || user.role === 'owner') {
      if (extReq.status !== 'pending_coordinator' && extReq.status !== 'teacher_approved') {
        return NextResponse.json<ApiResponse>({ success: false, error: `Cannot act on request in status: ${extReq.status}` }, { status: 400 });
      }

      if (action === 'reject') {
        await db.query(
          `UPDATE session_extension_requests
           SET status = 'rejected_by_coordinator', coordinator_responded_at = NOW(), coordinator_note = $2, updated_at = NOW()
           WHERE id = $1`,
          [request_id, note || null]
        );
        return NextResponse.json<ApiResponse>({ success: true, message: 'Extension rejected by coordinator', data: { status: 'rejected_by_coordinator' } });
      }

      // Coordinator approves — apply extension
      await db.query(
        `UPDATE session_extension_requests
         SET coordinator_responded_at = NOW(), coordinator_note = $2, updated_at = NOW()
         WHERE id = $1`,
        [request_id, note || null]
      );
      return await applyExtension(request_id, extReq, user.id, note);
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Only teacher or coordinator can act on requests' }, { status: 403 });
  } catch (err) {
    console.error('[session-extension PATCH]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// Apply Extension — extend session + generate overdue invoice
// ═══════════════════════════════════════════════════════════
async function applyExtension(
  requestId: string,
  extReq: Record<string, unknown>,
  approvedBy: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _note?: string,
): Promise<NextResponse<ApiResponse>> {
  const roomId = extReq.room_id as string;
  const requestedMinutes = Number(extReq.requested_minutes);
  const originalDuration = Number(extReq.original_duration);
  const newDuration = originalDuration + requestedMinutes;
  const extensionFeePaise = Number(extReq.extension_fee_paise) || 0;
  const studentEmail = extReq.student_email as string;
  const batchSessionId = extReq.batch_session_id as string | null;
  const batchId = extReq.batch_id as string | null;

  let invoiceId: string | null = null;

  await db.withTransaction(async (client) => {
    // 1. Extend room duration + push expires_at
    //    Save original_duration_minutes on first extension (for selective end)
    await client.query(
      `UPDATE rooms
       SET original_duration_minutes = COALESCE(original_duration_minutes, duration_minutes),
           duration_minutes = $2,
           expires_at = scheduled_start + (CAST($2 AS integer) * INTERVAL '1 minute') + INTERVAL '30 minutes',
           updated_at = NOW()
       WHERE room_id = $1`,
      [roomId, newDuration]
    );

    // 2. Extend batch_session duration if linked
    if (batchSessionId) {
      await client.query(
        `UPDATE batch_sessions
         SET duration_minutes = $2, teaching_minutes = $2 - prep_buffer_minutes
         WHERE session_id = $1`,
        [batchSessionId, newDuration]
      );
    }

    // 3. Generate overdue invoice for the extension fee
    if (extensionFeePaise > 0) {
      // Get parent email
      const parentRes = await client.query(
        `SELECT parent_email FROM batch_students WHERE batch_id = $1 AND student_email = $2 LIMIT 1`,
        [batchId, studentEmail]
      );
      const parentEmail = parentRes.rows.length > 0
        ? (parentRes.rows[0] as { parent_email: string | null }).parent_email
        : null;

      // Generate invoice number
      const invCountRes = await client.query(`SELECT COUNT(*) AS cnt FROM invoices`);
      const invCount = parseInt((invCountRes.rows[0] as { cnt: string }).cnt, 10) + 1;
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const invoiceNumber = `INV-${year}${month}-${String(invCount).padStart(5, '0')}`;

      // Get room info for description
      const roomInfoRes = await client.query(
        `SELECT r.room_name, r.subject, r.grade, b.batch_name
         FROM rooms r LEFT JOIN batches b ON b.batch_id = r.batch_id
         WHERE r.room_id = $1`,
        [roomId]
      );
      const roomInfo = roomInfoRes.rows[0] as Record<string, string> | undefined;
      const subject = roomInfo?.subject || 'Session';
      const batchName = roomInfo?.batch_name || '';
      const description = `Extension: +${requestedMinutes}min for ${subject}${batchName ? ` (${batchName})` : ''} — ₹${(extensionFeePaise / 100).toFixed(2)}`;

      const today = new Date().toISOString().slice(0, 10);

      // Create invoice as OVERDUE
      const invResult = await client.query(
        `INSERT INTO invoices (
           invoice_number, student_email, parent_email, description,
           billing_period, period_start, period_end,
           amount_paise, currency, due_date, status, batch_session_id
         ) VALUES ($1,$2,$3,$4,'session',$5,$5,$6,'INR',$5,'overdue',$7)
         RETURNING id`,
        [invoiceNumber, studentEmail, parentEmail, description, today, extensionFeePaise, batchSessionId]
      );
      invoiceId = (invResult.rows[0] as { id: string }).id;

      // Create session_payment row (upsert — student may already have a session payment for this room)
      await client.query(
        `INSERT INTO session_payments (batch_session_id, student_email, parent_email, invoice_id, amount_paise, currency, status, room_id)
         VALUES ($1, $2, $3, $4, $5, 'INR', 'pending', $6)
         ON CONFLICT (room_id, student_email) DO UPDATE
         SET invoice_id = EXCLUDED.invoice_id,
             amount_paise = session_payments.amount_paise + EXCLUDED.amount_paise,
             status = 'pending',
             batch_session_id = COALESCE(EXCLUDED.batch_session_id, session_payments.batch_session_id)`,
        [batchSessionId, studentEmail, parentEmail, invoiceId, extensionFeePaise, roomId]
      );
    }

    // 4. Update request status
    await client.query(
      `UPDATE session_extension_requests
       SET status = 'approved',
           extended_duration = $2,
           invoice_id = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [requestId, newDuration, invoiceId]
    );

    // 5. Log event
    await client.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'session_extended', $2, $3)`,
      [roomId, approvedBy, JSON.stringify({
        student_email: studentEmail,
        requested_minutes: requestedMinutes,
        new_duration: newDuration,
        extension_fee_paise: extensionFeePaise,
        approved_by: approvedBy,
      })]
    );
  });

  // ── Send notifications (fire-and-forget, after transaction) ──
  if (extensionFeePaise > 0 && invoiceId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
    const payLink = `${appUrl}/pay/${invoiceId}`;
    const amountStr = formatAmount(extensionFeePaise, 'INR');
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Get student name + invoice number
    const infoRes = await db.query(
      `SELECT i.invoice_number, COALESCE(u.full_name, i.student_email) AS student_name, i.parent_email
       FROM invoices i LEFT JOIN portal_users u ON u.email = i.student_email
       WHERE i.id = $1`,
      [invoiceId]
    );
    const info = infoRes.rows[0] as { invoice_number: string; student_name: string; parent_email: string | null } | undefined;
    const invoiceNumber = info?.invoice_number || '';
    const studentName = info?.student_name || studentEmail;
    const parentEmail = info?.parent_email || null;

    const invoiceData = {
      recipientName: studentName,
      recipientEmail: studentEmail,
      studentName,
      invoiceNumber,
      description: `Extra time: +${requestedMinutes} min session extension`,
      amount: amountStr,
      dueDate: today,
      billingPeriod: 'Extra Time',
      payLink,
      invoiceId,
    };

    // Send to student
    sendInvoiceGenerated(invoiceData).catch(() => {});
    // Send to parent
    if (parentEmail) {
      sendInvoiceGenerated({ ...invoiceData, recipientName: 'Parent', recipientEmail: parentEmail }).catch(() => {});
    }
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    message: `Session extended by ${requestedMinutes} minutes`,
    data: {
      status: 'approved',
      new_duration: newDuration,
      extension_fee_paise: extensionFeePaise,
    },
  });
}
