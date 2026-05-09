// ═══════════════════════════════════════════════════════════════
// Payment Reminder API — POST /api/v1/payment/send-reminder
// Owner-only: sends payment reminder email for overdue/pending invoices
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { formatAmount } from '@/lib/payment';
import { sendPaymentReminder } from '@/lib/email';
import { buildPayUrl } from '@/lib/pay-token';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'owner') {
      return NextResponse.json({ success: false, error: 'Owner access required' }, { status: 403 });
    }

    const body = await req.json();
    const { invoice_id } = body;
    if (!invoice_id) {
      return NextResponse.json({ success: false, error: 'invoice_id required' }, { status: 400 });
    }

    // Fetch invoice + student details
    const result = await db.query(
      `SELECT i.*, u.full_name AS student_name
       FROM invoices i
       LEFT JOIN portal_users u ON u.email = i.student_email
       WHERE i.id = $1`,
      [invoice_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const inv = result.rows[0] as Record<string, unknown>;
    const status = String(inv.status);
    if (status === 'paid') {
      return NextResponse.json({ success: false, error: 'Invoice already paid' }, { status: 400 });
    }

    const dueDate = new Date(String(inv.due_date));
    const now = new Date();
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));
    const studentName = String(inv.student_name || inv.student_email);
    const amount = formatAmount(Number(inv.amount_paise));

    const reminderData = {
      recipientName: studentName,
      studentName,
      invoiceNumber: String(inv.invoice_number),
      amount,
      dueDate: dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      daysOverdue,
      payLink: buildPayUrl(String(inv.id)),
    };

    // Send to student
    const sent: string[] = [];
    await sendPaymentReminder({
      ...reminderData,
      recipientEmail: String(inv.student_email),
    });
    sent.push(String(inv.student_email));

    // Send to parent if exists
    const parentEmail = inv.parent_email || null;
    if (parentEmail) {
      await sendPaymentReminder({
        ...reminderData,
        recipientName: 'Parent',
        recipientEmail: String(parentEmail),
      });
      sent.push(String(parentEmail));
    }

    return NextResponse.json({ success: true, data: { sent, count: sent.length } });
  } catch (err) {
    console.error('[payment/send-reminder] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
