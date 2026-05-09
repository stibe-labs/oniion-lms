// ═══════════════════════════════════════════════════════════════
// Student Refund/Reschedule Requests API
// GET  — list requests for the logged-in student
// POST — create a new refund or reschedule request
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const result = await db.query(
    `SELECT
       r.id, r.batch_session_id, r.request_type, r.amount_paise, r.currency,
       r.reason, r.status, r.reviewed_by, r.reviewed_at, r.review_notes,
       r.created_at,
       s.subject, s.scheduled_date::text AS scheduled_date, s.start_time::text AS start_time,
       s.teacher_name, b.batch_name
     FROM session_refund_requests r
     JOIN batch_sessions s ON s.session_id = r.batch_session_id
     JOIN batches b ON b.batch_id = s.batch_id
     WHERE r.student_email = $1
     ORDER BY r.created_at DESC`,
    [user.id]
  );

  return NextResponse.json({ success: true, data: result.rows });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { batch_session_id, request_type, reason, account_holder_name, account_number, ifsc_code, upi_id, qr_code_url } = body as {
    batch_session_id: string;
    request_type: 'refund' | 'reschedule';
    reason?: string;
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    upi_id?: string;
    qr_code_url?: string;
  };

  if (!batch_session_id || !request_type || !['refund', 'reschedule'].includes(request_type)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid fields' }, { status: 400 });
  }

  // For refund requests, require at least one payment method
  if (request_type === 'refund') {
    const hasBank = account_holder_name && account_number && ifsc_code;
    const hasUpi = upi_id;
    const hasQr = qr_code_url;
    if (!hasBank && !hasUpi && !hasQr) {
      return NextResponse.json({ success: false, error: 'Please provide bank account details, UPI ID, or QR code for refund' }, { status: 400 });
    }
  }

  // Verify the student is enrolled in this session's batch
  const enrollCheck = await db.query(
    `SELECT 1 FROM batch_sessions s
     JOIN batch_students bs ON bs.batch_id = s.batch_id AND bs.student_email = $1
     WHERE s.session_id = $2`,
    [user.id, batch_session_id]
  );
  if (enrollCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'You are not enrolled in this session' }, { status: 403 });
  }

  // Verify the student was absent
  const attendanceCheck = await db.query(
    `SELECT a.status FROM attendance_sessions a
     JOIN rooms r ON r.room_id = a.room_id
     WHERE r.batch_session_id = $1 AND a.participant_email = $2
     LIMIT 1`,
    [batch_session_id, user.id]
  );
  if (attendanceCheck.rows.length === 0 || attendanceCheck.rows[0].status !== 'absent') {
    return NextResponse.json({ success: false, error: 'Refund/reschedule is only available for sessions where you were absent' }, { status: 400 });
  }

  // Find the paid session_payment for this session
  const spRes = await db.query(
    `SELECT sp.id, sp.invoice_id, sp.amount_paise, sp.currency
     FROM session_payments sp
     WHERE sp.batch_session_id = $1 AND sp.student_email = $2 AND sp.status = 'paid'
     LIMIT 1`,
    [batch_session_id, user.id]
  );
  if (spRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'No paid session payment found for this session' }, { status: 400 });
  }

  const sp = spRes.rows[0] as { id: string; invoice_id: string; amount_paise: number; currency: string };

  // Check for existing request (unique constraint will also catch this)
  const existingCheck = await db.query(
    `SELECT id, status FROM session_refund_requests
     WHERE batch_session_id = $1 AND student_email = $2`,
    [batch_session_id, user.id]
  );
  if (existingCheck.rows.length > 0) {
    const existing = existingCheck.rows[0] as { id: string; status: string };
    return NextResponse.json({
      success: false,
      error: `A ${existing.status} request already exists for this session`,
    }, { status: 409 });
  }

  // Create the refund/reschedule request
  const insertRes = await db.query(
    `INSERT INTO session_refund_requests
       (student_email, batch_session_id, invoice_id, session_payment_id, request_type, amount_paise, currency, reason,
        account_holder_name, account_number, ifsc_code, upi_id, qr_code_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, status, created_at`,
    [user.id, batch_session_id, sp.invoice_id, sp.id, request_type, sp.amount_paise, sp.currency, reason || null,
     account_holder_name || null, account_number || null, ifsc_code || null, upi_id || null, qr_code_url || null]
  );

  return NextResponse.json({
    success: true,
    data: insertRes.rows[0],
  }, { status: 201 });
}
