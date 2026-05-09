// ═══════════════════════════════════════════════════════════════
// Student Fees Summary API — GET /api/v1/student/fees
//
// Aggregated fee overview for the logged-in student.
// Returns: total invoiced, total paid, balance, recent invoices,
// recent receipts.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { updateOverdueInvoices } from '@/lib/payment';
import { generatePayToken } from '@/lib/pay-token';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const email = user.id;

  // Auto-flip overdue invoices
  await updateOverdueInvoices();

  // Aggregate invoice stats
  const statsRes = await db.query(
    `SELECT
       COUNT(*)::int                                    AS total_invoices,
       COALESCE(SUM(amount_paise), 0)::bigint           AS total_invoiced_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0)::bigint    AS total_paid_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'pending'), 0)::bigint AS total_pending_paise,
       COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending_count,
       COUNT(*) FILTER (WHERE status = 'paid')::int     AS paid_count,
       COUNT(*) FILTER (WHERE status = 'overdue')::int  AS overdue_count
     FROM invoices
     WHERE student_email = $1`,
    [email]
  );

  const stats = statsRes.rows[0] as Record<string, unknown>;

  // Recent invoices (last 20, including scheduled future installments)
  const invoicesRes = await db.query(
    `SELECT
       id, invoice_number, description, billing_period,
       period_start, period_end, amount_paise, currency,
       status, due_date, scheduled_for, installment_number, paid_at, created_at
     FROM invoices
     WHERE student_email = $1
     ORDER BY
       CASE WHEN status IN ('overdue','pending') THEN 0 WHEN status = 'scheduled' THEN 1 ELSE 2 END,
       COALESCE(due_date, scheduled_for, created_at) ASC
     LIMIT 20`,
    [email]
  );

  // Recent receipts (last 10)
  const receiptsRes = await db.query(
    `SELECT
       pr.id, pr.receipt_number, pr.invoice_id,
       pr.amount_paise, pr.currency, pr.payment_method,
       pr.created_at,
       i.description AS invoice_description,
       i.billing_period
     FROM payment_receipts pr
     LEFT JOIN invoices i ON i.id = pr.invoice_id
     WHERE pr.student_email = $1
     ORDER BY pr.created_at DESC
     LIMIT 10`,
    [email]
  );

  // Next upcoming invoice — nearest scheduled/pending invoice with a future due_date
  // Includes scheduled (SPO future installments) and pending (unpaid active invoices)
  const nextInvoiceRes = await db.query(
    `SELECT id, invoice_number, description, billing_period,
            amount_paise, currency, due_date, status, installment_number, scheduled_for
     FROM invoices
     WHERE student_email = $1
       AND status IN ('pending', 'overdue', 'scheduled')
     ORDER BY
       CASE WHEN status = 'overdue' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
       COALESCE(due_date, scheduled_for) ASC
     LIMIT 1`,
    [email]
  );
  const nextInvoice = nextInvoiceRes.rows.length > 0
    ? { ...(nextInvoiceRes.rows[0] as Record<string, unknown>) }
    : null;

  // Determine if student is in a group batch (non 1:1/1:3) and enrollment payment plan
  let isGroupBatch = false;
  let paymentPlan: string | null = null;
  try {
    const batchTypeRes = await db.query(
      `SELECT DISTINCT b.batch_type FROM batch_students bs
       JOIN batches b ON b.batch_id = bs.batch_id
       WHERE bs.student_email = $1 AND b.batch_type IS NOT NULL
       LIMIT 5`,
      [email]
    );
    const types = (batchTypeRes.rows as Array<{ batch_type: string }>).map(r => r.batch_type);
    isGroupBatch = types.some(t => t !== 'one_to_one' && t !== 'one_to_three');

    const planRes = await db.query(
      `SELECT payment_plan FROM enrollment_links WHERE student_email = $1
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (planRes.rows.length > 0) {
      paymentPlan = String((planRes.rows[0] as { payment_plan: string }).payment_plan);
    }
  } catch { /* non-critical */ }

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        total_invoices: Number(stats.total_invoices ?? 0),
        total_invoiced_paise: Number(stats.total_invoiced_paise ?? 0),
        total_paid_paise: Number(stats.total_paid_paise ?? 0),
        total_pending_paise: Number(stats.total_pending_paise ?? 0),
        pending_count: Number(stats.pending_count ?? 0),
        paid_count: Number(stats.paid_count ?? 0),
        overdue_count: Number(stats.overdue_count ?? 0),
        is_group_batch: isGroupBatch,
        payment_plan: paymentPlan,
        next_invoice: nextInvoice ? {
          id: String(nextInvoice.id),
          invoice_number: String(nextInvoice.invoice_number),
          description: nextInvoice.description ? String(nextInvoice.description) : null,
          billing_period: nextInvoice.billing_period ? String(nextInvoice.billing_period) : null,
          amount_paise: Number(nextInvoice.amount_paise),
          currency: String(nextInvoice.currency || 'INR'),
          due_date: nextInvoice.due_date ? String(nextInvoice.due_date) : null,
          scheduled_for: nextInvoice.scheduled_for ? String(nextInvoice.scheduled_for) : null,
          status: String(nextInvoice.status),
          installment_number: nextInvoice.installment_number != null ? Number(nextInvoice.installment_number) : null,
        } : null,
      },
      invoices: invoicesRes.rows.map((row: Record<string, unknown>) => ({
        ...row,
        pay_token: generatePayToken(String(row.id)),
      })),
      receipts: receiptsRes.rows,
    },
  });
}
