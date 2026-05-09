// ═══════════════════════════════════════════════════════════════
// Academic Operator — Refund/Reschedule Requests API
// GET — list all refund requests (filterable by status)
// PUT — approve or reject a request
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendRefundApproved } from '@/lib/email';

const AO_ROLES = ['academic_operator', 'academic', 'owner'];

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !AO_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let sql = `
    SELECT
      r.id, r.student_email, r.batch_session_id, r.invoice_id, r.session_payment_id,
      r.request_type, r.amount_paise, r.currency, r.reason,
      r.status, r.reviewed_by, r.reviewed_at, r.review_notes,
      r.account_holder_name, r.account_number, r.ifsc_code, r.upi_id, r.qr_code_url,
      r.created_at, r.updated_at,
      p.full_name AS student_name,
      s.subject, s.scheduled_date::text AS scheduled_date, s.start_time::text AS start_time,
      s.teacher_name, b.batch_name, b.grade, b.section,
      inv.invoice_number, inv.status AS invoice_status
    FROM session_refund_requests r
    JOIN portal_users p ON p.email = r.student_email
    JOIN batch_sessions s ON s.session_id = r.batch_session_id
    JOIN batches b ON b.batch_id = s.batch_id
    LEFT JOIN invoices inv ON inv.id = r.invoice_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status && status !== 'all') {
    params.push(status);
    sql += ` AND r.status = $${params.length}`;
  }

  // AO data isolation: only show refund requests from AO's batches
  if (user.role === 'academic_operator') {
    params.push(user.id);
    sql += ` AND b.academic_operator_email = $${params.length}`;
  }

  sql += ` ORDER BY r.created_at DESC`;

  const result = await db.query(sql, params);

  return NextResponse.json({ success: true, data: result.rows });
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !AO_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { id, action, review_notes } = body as {
    id: string;
    action: 'approve' | 'reject';
    review_notes?: string;
  };

  if (!id || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid fields' }, { status: 400 });
  }

  // Fetch the request
  const reqRes = await db.query(
    `SELECT * FROM session_refund_requests WHERE id = $1`,
    [id]
  );
  if (reqRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
  }

  const refundReq = reqRes.rows[0] as {
    id: string; student_email: string; batch_session_id: string;
    invoice_id: string; session_payment_id: string;
    request_type: string; amount_paise: number; status: string;
    account_holder_name?: string; account_number?: string; ifsc_code?: string;
    upi_id?: string; qr_code_url?: string;
  };

  if (refundReq.status !== 'pending') {
    return NextResponse.json({ success: false, error: `Request already ${refundReq.status}` }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  if (action === 'approve' && refundReq.request_type === 'refund') {
    // Mark session_payment as refunded and adjust invoice
    await db.withTransaction(async (client) => {
      // Update request status
      await client.query(
        `UPDATE session_refund_requests
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW()
         WHERE id = $4`,
        [newStatus, user.id, review_notes || null, id]
      );

      // Mark session_payment as refunded
      if (refundReq.session_payment_id) {
        await client.query(
          `UPDATE session_payments SET status = 'refunded' WHERE id = $1`,
          [refundReq.session_payment_id]
        );
      }

      // Check how many active session_payments remain on this invoice
      const countRes = await client.query(
        `SELECT COUNT(*) AS cnt FROM session_payments
         WHERE invoice_id = $1 AND status NOT IN ('cancelled', 'refunded')`,
        [refundReq.invoice_id]
      );
      const remaining = parseInt((countRes.rows[0] as { cnt: string }).cnt, 10);

      if (remaining === 0) {
        // All sessions refunded/cancelled → mark invoice refunded
        await client.query(
          `UPDATE invoices SET status = 'refunded' WHERE id = $1`,
          [refundReq.invoice_id]
        );
      } else {
        // Reduce invoice amount
        await client.query(
          `UPDATE invoices SET amount_paise = GREATEST(amount_paise - $1, 0) WHERE id = $2`,
          [refundReq.amount_paise, refundReq.invoice_id]
        );
      }
    });
  } else {
    // Reject, or approve reschedule (just update status — reschedule logistics handled separately)
    await db.query(
      `UPDATE session_refund_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW()
       WHERE id = $4`,
      [newStatus, user.id, review_notes || null, id]
    );
  }

  // ── Send email + WhatsApp to parent & student on refund approval ──
  if (action === 'approve' && refundReq.request_type === 'refund') {
    try {
      // Look up session/batch info
      const infoRes = await db.query(
        `SELECT s.subject, s.scheduled_date::text AS scheduled_date, b.batch_name,
                bs2.parent_email
         FROM batch_sessions s
         JOIN batches b ON b.batch_id = s.batch_id
         LEFT JOIN batch_students bs2 ON bs2.batch_id = s.batch_id AND bs2.student_email = $1
         WHERE s.session_id = $2
         LIMIT 1`,
        [refundReq.student_email, refundReq.batch_session_id]
      );
      const info = infoRes.rows[0] as {
        subject: string; scheduled_date: string; batch_name: string; parent_email?: string;
      } | undefined;

      if (info) {
        // Build refund method description
        let refundMethod = 'N/A';
        if (refundReq.upi_id) {
          refundMethod = `UPI: ${refundReq.upi_id}`;
        } else if (refundReq.account_number) {
          refundMethod = `Bank: ${refundReq.account_holder_name || ''} / A/C ${refundReq.account_number} / IFSC ${refundReq.ifsc_code || ''}`;
        } else if (refundReq.qr_code_url) {
          refundMethod = 'QR Code (uploaded by student)';
        }

        const amountStr = (refundReq.amount_paise / 100).toFixed(2);

        // Look up student name
        const stuRes = await db.query(
          `SELECT full_name FROM portal_users WHERE email = $1`, [refundReq.student_email]
        );
        const studentName = (stuRes.rows[0] as { full_name: string })?.full_name || refundReq.student_email;

        // Send to student
        sendRefundApproved({
          recipientName: studentName,
          recipientEmail: refundReq.student_email,
          studentName,
          amount: amountStr,
          sessionSubject: info.subject,
          sessionDate: info.scheduled_date,
          batchName: info.batch_name,
          refundMethod,
          reviewNotes: review_notes || undefined,
        }).catch(() => {});

        // Send to parent if available
        if (info.parent_email) {
          const parRes = await db.query(
            `SELECT full_name FROM portal_users WHERE email = $1`, [info.parent_email]
          );
          const parentName = (parRes.rows[0] as { full_name: string })?.full_name || 'Parent';
          sendRefundApproved({
            recipientName: parentName,
            recipientEmail: info.parent_email,
            studentName,
            amount: amountStr,
            sessionSubject: info.subject,
            sessionDate: info.scheduled_date,
            batchName: info.batch_name,
            refundMethod,
            reviewNotes: review_notes || undefined,
          }).catch(() => {});
        }
      }
    } catch (emailErr) {
      console.error('[refund-requests] Failed to send refund approval email:', emailErr);
    }
  }

  return NextResponse.json({ success: true, data: { id, status: newStatus } });
}
