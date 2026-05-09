// ═══════════════════════════════════════════════════════════════
// Payment Initiate — POST /api/v1/payment/initiate
// Creates a payment order for an invoice
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { createPaymentOrder } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return NextResponse.json({ success: false, error: 'invoice_id required' }, { status: 400 });
    }

    // Fetch invoice (allow both pending and overdue to be paid)
    const inv = await db.query(
      `SELECT * FROM invoices WHERE id = $1 AND status IN ('pending', 'overdue')`,
      [invoice_id]
    );
    if (inv.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found or already paid' }, { status: 404 });
    }

    const invoice = inv.rows[0] as Record<string, unknown>;

    // Verify the user owns this invoice or is a parent
    const isOwner = user.role === 'owner';
    const isStudent = (invoice.student_email as string) === user.id;
    const isParent = (invoice.parent_email as string) === user.id;
    if (!isOwner && !isStudent && !isParent) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const order = await createPaymentOrder({
      invoiceId: invoice_id,
      amountPaise: invoice.amount_paise as number,
      currency: (invoice.currency as string) || 'INR',
      studentEmail: invoice.student_email as string,
      studentName: user.name,
      description: invoice.description as string,
    });

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('[payment/initiate] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
