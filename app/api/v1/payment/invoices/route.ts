// ═══════════════════════════════════════════════════════════════
// Payment Invoices API — GET /api/v1/payment/invoices
// POST to create invoice (owner/coordinator only)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getStudentInvoices, getParentInvoices, createInvoice, updateOverdueInvoices } from '@/lib/payment';
import { generatePayToken } from '@/lib/pay-token';

function withPayTokens(invoices: Record<string, unknown>[]) {
  return invoices.map(inv => ({ ...inv, pay_token: generatePayToken(String(inv.id)) }));
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const studentEmail = url.searchParams.get('student_email');

    // Owner can fetch any student's invoices
    if (user.role === 'owner' && studentEmail) {
      const invoices = await getStudentInvoices(studentEmail);
      return NextResponse.json({ success: true, data: { invoices: withPayTokens(invoices) } });
    }

    // Student sees own invoices
    if (user.role === 'student') {
      const invoices = await getStudentInvoices(user.id);
      return NextResponse.json({ success: true, data: { invoices: withPayTokens(invoices) } });
    }

    // Parent sees child's invoices
    if (user.role === 'parent') {
      const invoices = await getParentInvoices(user.id);
      return NextResponse.json({ success: true, data: { invoices: withPayTokens(invoices) } });
    }

    // Coordinators / academic ops / owner see all
    if (['owner', 'batch_coordinator', 'academic_operator', 'hr'].includes(user.role)) {
      const { db } = await import('@/lib/db');
      await updateOverdueInvoices();
      const result = await db.query(
        `SELECT i.*, u.full_name AS student_name
         FROM invoices i
         LEFT JOIN portal_users u ON u.email = i.student_email
         WHERE i.hidden_from_owner = FALSE
         ORDER BY i.created_at DESC LIMIT 500`
      );
      return NextResponse.json({ success: true, data: { invoices: result.rows } });
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  } catch (err) {
    console.error('[payment/invoices] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'batch_coordinator', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { student_email, parent_email, description, billing_period, period_start, period_end, amount_paise, currency, due_date } = body;

    if (!student_email || !period_start || !period_end || !amount_paise || !due_date) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const invoice = await createInvoice({
      studentEmail: student_email,
      parentEmail: parent_email,
      description,
      billingPeriod: billing_period,
      periodStart: period_start,
      periodEnd: period_end,
      amountPaise: amount_paise,
      currency,
      dueDate: due_date,
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (err) {
    console.error('[payment/invoices] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE — Soft-delete invoices (owner only) ──────────────
// Marks invoices as hidden from owner dashboard but keeps them
// visible to students and parents for their payment records.
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'owner') {
      return NextResponse.json({ success: false, error: 'Only owner can delete invoices' }, { status: 403 });
    }

    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids as string[] : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids array required' }, { status: 400 });
    }

    const { db } = await import('@/lib/db');

    // Soft-delete: hide from owner, keep for students/parents
    const result = await db.query(
      `UPDATE invoices SET hidden_from_owner = TRUE, updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND hidden_from_owner = FALSE
       RETURNING id`,
      [ids]
    );

    return NextResponse.json({
      success: true,
      data: { deleted: result.rows.length, requested: ids.length },
    });
  } catch (err) {
    console.error('[payment/invoices] DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
