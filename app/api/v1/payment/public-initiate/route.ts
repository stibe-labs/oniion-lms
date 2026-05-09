// ═══════════════════════════════════════════════════════════════
// Public Payment Initiate — POST /api/v1/payment/public-initiate
// Token-authenticated (no login required).
// Used by /pay/[id] page opened from WhatsApp pay links.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createPaymentOrder } from '@/lib/payment';
import { verifyPayToken } from '@/lib/pay-token';

export async function POST(req: NextRequest) {
  try {
    const { invoice_id, token } = await req.json();

    if (!invoice_id || !token) {
      return NextResponse.json({ success: false, error: 'Missing invoice_id or token' }, { status: 400 });
    }

    // Verify HMAC token
    if (!verifyPayToken(invoice_id, token)) {
      return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 403 });
    }

    // Fetch invoice (allow pending, overdue, and scheduled)
    const inv = await db.query(
      `SELECT i.*, pu.full_name AS student_name
       FROM invoices i
       LEFT JOIN portal_users pu ON pu.email = i.student_email
       WHERE i.id = $1 AND i.status IN ('pending', 'overdue', 'scheduled')`,
      [invoice_id]
    );

    if (inv.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found or already paid' }, { status: 404 });
    }

    const invoice = inv.rows[0] as Record<string, unknown>;

    const order = await createPaymentOrder({
      invoiceId: invoice_id,
      amountPaise: invoice.amount_paise as number,
      currency: (invoice.currency as string) || 'INR',
      studentEmail: invoice.student_email as string,
      studentName: String(invoice.student_name || invoice.student_email),
      description: invoice.description as string,
    });

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('[payment/public-initiate] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
