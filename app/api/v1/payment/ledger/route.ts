// ═══════════════════════════════════════════════════════════════
// Fee Ledger API — GET /api/v1/payment/ledger
// Running balance ledger for student fee accounts
// Shows all invoices + payments with running balance
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    let studentEmail = url.searchParams.get('student_email');

    // Students see own ledger
    if (user.role === 'student') {
      studentEmail = user.id;
    }
    // Parents see child's ledger
    else if (user.role === 'parent') {
      if (!studentEmail) {
        // Get first child
        const childResult = await db.query(
          `SELECT email FROM user_profiles WHERE parent_email = $1 LIMIT 1`,
          [user.id]
        );
        studentEmail = childResult.rows[0]
          ? String((childResult.rows[0] as Record<string, unknown>).email)
          : null;
      }
      // Verify this is actually their child
      if (studentEmail) {
        const verifyResult = await db.query(
          `SELECT 1 FROM user_profiles WHERE email = $1 AND parent_email = $2`,
          [studentEmail, user.id]
        );
        if (verifyResult.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Not your child' }, { status: 403 });
        }
      }
    }
    // Admin roles can fetch any student
    else if (!['owner', 'batch_coordinator', 'academic_operator', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (!studentEmail) {
      return NextResponse.json({
        success: false,
        error: 'student_email required',
      }, { status: 400 });
    }

    // Get all invoices for this student
    const invoicesResult = await db.query(
      `SELECT
         id, invoice_number, description, billing_period,
         period_start, period_end, amount_paise, currency,
         status, due_date, paid_at, created_at
       FROM invoices
       WHERE student_email = $1
       ORDER BY created_at ASC`,
      [studentEmail]
    );

    // Get all payment receipts
    const receiptsResult = await db.query(
      `SELECT
         pr.id, pr.receipt_number, pr.invoice_id,
         pr.amount_paise, pr.currency, pr.payment_method,
         pr.created_at
       FROM payment_receipts pr
       WHERE pr.student_email = $1
       ORDER BY pr.created_at ASC`,
      [studentEmail]
    );

    // Build ledger with running balance
    interface LedgerEntry {
      date: string;
      type: 'invoice' | 'payment';
      reference: string;
      description: string;
      debit_paise: number;
      credit_paise: number;
      balance_paise: number;
      status?: string;
      currency: string;
    }

    const entries: LedgerEntry[] = [];
    let balance = 0;

    // Combine invoices and receipts chronologically
    const allItems: Array<{
      date: Date;
      type: 'invoice' | 'payment';
      data: Record<string, unknown>;
    }> = [];

    for (const inv of invoicesResult.rows) {
      const i = inv as Record<string, unknown>;
      allItems.push({
        date: new Date(String(i.created_at)),
        type: 'invoice',
        data: i,
      });
    }

    for (const rcpt of receiptsResult.rows) {
      const r = rcpt as Record<string, unknown>;
      allItems.push({
        date: new Date(String(r.created_at)),
        type: 'payment',
        data: r,
      });
    }

    // Sort by date
    allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const item of allItems) {
      if (item.type === 'invoice') {
        const inv = item.data;
        const amount = Number(inv.amount_paise || 0);
        balance += amount; // Debit (amount owed)
        entries.push({
          date: item.date.toISOString(),
          type: 'invoice',
          reference: String(inv.invoice_number || ''),
          description: String(inv.description || `Invoice for ${inv.billing_period || 'period'}`),
          debit_paise: amount,
          credit_paise: 0,
          balance_paise: balance,
          status: String(inv.status || 'pending'),
          currency: String(inv.currency || 'INR'),
        });
      } else {
        const rcpt = item.data;
        const amount = Number(rcpt.amount_paise || 0);
        balance -= amount; // Credit (amount paid)
        entries.push({
          date: item.date.toISOString(),
          type: 'payment',
          reference: String(rcpt.receipt_number || ''),
          description: `Payment via ${rcpt.payment_method || 'online'}`,
          debit_paise: 0,
          credit_paise: amount,
          balance_paise: balance,
          currency: String(rcpt.currency || 'INR'),
        });
      }
    }

    // Summary
    const totalInvoiced = entries
      .filter(e => e.type === 'invoice')
      .reduce((sum, e) => sum + e.debit_paise, 0);
    const totalPaid = entries
      .filter(e => e.type === 'payment')
      .reduce((sum, e) => sum + e.credit_paise, 0);

    // Get student name
    const nameResult = await db.query(
      `SELECT full_name FROM portal_users WHERE email = $1`,
      [studentEmail]
    );
    const studentName = (nameResult.rows[0] as Record<string, unknown>)?.full_name || studentEmail;

    return NextResponse.json({
      success: true,
      data: {
        student_email: studentEmail,
        student_name: studentName,
        summary: {
          total_invoiced_paise: totalInvoiced,
          total_paid_paise: totalPaid,
          outstanding_paise: balance,
          currency: entries[0]?.currency || 'INR',
        },
        entries,
      },
    });
  } catch (err) {
    console.error('[payment/ledger] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
