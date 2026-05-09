// ═══════════════════════════════════════════════════════════════
// AO Payments API — GET /api/v1/academic-operator/payments
// Returns complete payment/invoice data for all AO-managed batches
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { updateOverdueInvoices } from '@/lib/payment';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Auto-flip overdue invoices
    await updateOverdueInvoices();

    // ── AO student scope: parameterized filter for data isolation ──
    const isAO = user.role === 'academic_operator';

    // For AO: pre-fetch scoped student emails (their batches + CRM-enrolled)
    let scopedStudentEmails: string[] | null = null;
    if (isAO) {
      const scopeRes = await db.query(`
        SELECT DISTINCT student_email FROM (
          SELECT bs.student_email FROM batch_students bs
          JOIN batches b ON b.batch_id = bs.batch_id
          WHERE b.academic_operator_email = $1
          UNION
          SELECT el.student_email FROM enrollment_links el
          WHERE el.source = 'crm' AND el.status = 'paid' AND el.student_email IS NOT NULL
        ) scoped
      `, [user.id]);
      scopedStudentEmails = scopeRes.rows.map((r: Record<string, unknown>) => r.student_email as string);
    }

    // Helper: add scoped filter to queries
    const addScope = (baseWhere: string, alias: string, paramOffset: number): { where: string; params: unknown[] } => {
      if (!isAO || !scopedStudentEmails) return { where: baseWhere, params: [] };
      if (scopedStudentEmails.length === 0) {
        return { where: `${baseWhere} AND FALSE`, params: [] };
      }
      const placeholders = scopedStudentEmails.map((_, i) => `$${paramOffset + i + 1}`).join(',');
      return {
        where: `${baseWhere} AND ${alias}.student_email IN (${placeholders})`,
        params: scopedStudentEmails,
      };
    };

    // ── Summary stats ──────────────────────────────────────
    const statsScope = addScope('WHERE hidden_from_owner = FALSE', 'i', 0);
    const statsRes = await db.query(`
      SELECT
        COUNT(*)::int                                          AS total_invoices,
        COALESCE(SUM(amount_paise), 0)::bigint                AS total_invoiced_paise,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise ELSE 0 END), 0)::bigint    AS total_paid_paise,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_paise ELSE 0 END), 0)::bigint  AS total_pending_paise,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount_paise ELSE 0 END), 0)::bigint  AS total_overdue_paise,
        COUNT(*) FILTER (WHERE status = 'paid')::int          AS paid_count,
        COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending_count,
        COUNT(*) FILTER (WHERE status = 'overdue')::int       AS overdue_count,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int     AS cancelled_count
      FROM invoices i
      ${statsScope.where}
    `, statsScope.params);

    // ── Recent 30-day collection ───────────────────────────
    const recentScope = addScope(`WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'`, 'i', 0);
    const recentRes = await db.query(`
      SELECT COALESCE(SUM(amount_paise), 0)::bigint AS collected_30d
      FROM invoices i
      ${recentScope.where}
    `, recentScope.params);

    // ── All invoices with student info ─────────────────────
    const invScope = addScope('WHERE i.hidden_from_owner = FALSE', 'i', 0);
    const invoicesRes = await db.query(`
      SELECT i.id, i.invoice_number, i.student_email, i.parent_email,
             i.description, i.billing_period, i.period_start, i.period_end,
             i.amount_paise, i.currency, i.status, i.due_date,
             i.paid_at, i.payment_method, i.transaction_id,
             i.created_at, i.schedule_group_id,
             u.full_name AS student_name,
             pu.full_name AS parent_name
      FROM invoices i
      LEFT JOIN portal_users u ON u.email = i.student_email
      LEFT JOIN portal_users pu ON pu.email = i.parent_email
      ${invScope.where}
      ORDER BY i.created_at DESC
      LIMIT 1000
    `, invScope.params);

    // ── Per-student payment summary ────────────────────────
    const sumScope = addScope('WHERE i.hidden_from_owner = FALSE', 'i', 0);
    const studentSummaryRes = await db.query(`
      SELECT i.student_email,
             u.full_name AS student_name,
             COUNT(*)::int AS total_invoices,
             COALESCE(SUM(i.amount_paise), 0)::bigint AS total_amount,
             COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount_paise ELSE 0 END), 0)::bigint AS paid_amount,
             COALESCE(SUM(CASE WHEN i.status IN ('pending', 'overdue') THEN i.amount_paise ELSE 0 END), 0)::bigint AS due_amount,
             COUNT(*) FILTER (WHERE i.status = 'overdue')::int AS overdue_count,
             COUNT(*) FILTER (WHERE i.status = 'pending')::int AS pending_count,
             COUNT(*) FILTER (WHERE i.status = 'paid')::int AS paid_count
      FROM invoices i
      LEFT JOIN portal_users u ON u.email = i.student_email
      ${sumScope.where}
      GROUP BY i.student_email, u.full_name
      ORDER BY due_amount DESC
    `, sumScope.params);

    // ── Receipts (recent 200) ──────────────────────────────
    let receiptsRes;
    if (isAO && scopedStudentEmails) {
      if (scopedStudentEmails.length === 0) {
        receiptsRes = { rows: [] };
      } else {
        const placeholders = scopedStudentEmails.map((_, i) => `$${i + 1}`).join(',');
        receiptsRes = await db.query(`
          SELECT pr.receipt_number, pr.invoice_id, pr.student_email,
                 pr.amount_paise, pr.currency, pr.payment_method,
                 pr.created_at AS paid_at,
                 u.full_name AS student_name,
                 i.invoice_number, i.description
          FROM payment_receipts pr
          LEFT JOIN portal_users u ON u.email = pr.student_email
          LEFT JOIN invoices i ON i.id = pr.invoice_id
          WHERE pr.student_email IN (${placeholders})
          ORDER BY pr.created_at DESC
          LIMIT 200
        `, scopedStudentEmails);
      }
    } else {
      receiptsRes = await db.query(`
        SELECT pr.receipt_number, pr.invoice_id, pr.student_email,
               pr.amount_paise, pr.currency, pr.payment_method,
               pr.created_at AS paid_at,
               u.full_name AS student_name,
               i.invoice_number, i.description
        FROM payment_receipts pr
        LEFT JOIN portal_users u ON u.email = pr.student_email
        LEFT JOIN invoices i ON i.id = pr.invoice_id
        ORDER BY pr.created_at DESC
        LIMIT 200
      `);
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          ...(statsRes.rows[0] as Record<string, unknown>),
          collected_30d: (recentRes.rows[0] as { collected_30d: number }).collected_30d,
        },
        invoices: invoicesRes.rows,
        studentSummary: studentSummaryRes.rows,
        receipts: receiptsRes.rows,
      },
    });
  } catch (err) {
    console.error('[ao/payments] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
