// ═══════════════════════════════════════════════════════════════
// Payment Callback — POST /api/v1/payment/callback
// Webhook from payment gateway after payment attempt
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRazorpaySignature, completePayment, formatAmount } from '@/lib/payment';
import { sendPaymentReceipt } from '@/lib/email';

// Helper: send receipt email after successful payment (fire-and-forget)
async function sendReceiptEmail(invoiceId: string, receiptNumber: string) {
  try {
    const inv = await db.query(
      `SELECT i.*, pu.full_name AS student_name, up.parent_email
       FROM invoices i
       LEFT JOIN portal_users pu ON pu.email = i.student_email
       LEFT JOIN user_profiles up ON up.email = i.student_email
       WHERE i.id = $1`,
      [invoiceId]
    );
    if (inv.rows.length === 0) return;
    const invoice = inv.rows[0] as Record<string, unknown>;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
    const receiptLink = `${baseUrl}/api/v1/payment/invoice-pdf/${invoiceId}`;
    const amount = formatAmount(Number(invoice.amount_paise), String(invoice.currency || 'INR'));
    const studentName = String(invoice.student_name || invoice.student_email);
    const payDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const emailData = {
      recipientName: studentName,
      recipientEmail: String(invoice.student_email),
      studentName,
      receiptNumber,
      invoiceNumber: String(invoice.invoice_number),
      amount,
      transactionId: String(invoice.transaction_id || 'N/A'),
      paymentMethod: String(invoice.payment_method || 'online'),
      paymentDate: payDate,
      receiptLink,
      description: String(invoice.description || ''),
    };

    // Send to student
    await sendPaymentReceipt(emailData);

    // Also send to parent if available
    const parentEmail = String(invoice.parent_email || '');
    if (parentEmail && parentEmail !== 'null' && parentEmail !== '') {
      const parentRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [parentEmail]);
      const parentName = parentRes.rows.length > 0 ? String((parentRes.rows[0] as Record<string, unknown>).full_name) : 'Parent';
      await sendPaymentReceipt({ ...emailData, recipientName: parentName, recipientEmail: parentEmail });
    }
  } catch (e) {
    console.error('[payment/callback] Failed to send receipt email:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoice_id, mock } = body;

    // Mock mode for testing — directly complete the payment
    if (mock === true && process.env.PAYMENT_MODE !== 'live') {
      // Support combined payment: invoice_ids array or single invoice_id
      const invoiceIds: string[] = body.invoice_ids || (invoice_id ? [invoice_id] : []);
      if (invoiceIds.length === 0) {
        return NextResponse.json({ success: false, error: 'invoice_id or invoice_ids required' }, { status: 400 });
      }
      const mockPaymentId = `mock_pay_${Date.now()}`;
      let lastResult: { receiptNumber: string } | null = null;
      for (const invId of invoiceIds) {
        lastResult = await completePayment(invId, mockPaymentId, 'mock_gateway', { mock: true });
        sendReceiptEmail(invId, lastResult.receiptNumber);
      }
      return NextResponse.json({ success: true, data: lastResult });
    }

    // Live mode — verify Razorpay signature
    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json({ success: false, error: 'Missing payment details' }, { status: 400 });
    }

    // Verify signature
    const valid = await verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature || '',
    });

    if (!valid) {
      console.error('[payment/callback] Invalid signature', { razorpay_order_id });
      return NextResponse.json({ success: false, error: 'Invalid payment signature' }, { status: 400 });
    }

    // Find ALL invoices with this gateway order (supports combined payment)
    const inv = await db.query(
      `SELECT id FROM invoices WHERE gateway_order_id = $1`,
      [razorpay_order_id]
    );
    if (inv.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found for this order' }, { status: 404 });
    }

    // Complete all invoices linked to this order
    let lastResult: { receiptNumber: string } | null = null;
    for (const row of inv.rows) {
      const invId = (row as Record<string, unknown>).id as string;
      lastResult = await completePayment(invId, razorpay_payment_id, 'razorpay', body);
      sendReceiptEmail(invId, lastResult.receiptNumber);
    }
    return NextResponse.json({ success: true, data: lastResult });
  } catch (err) {
    console.error('[payment/callback] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
