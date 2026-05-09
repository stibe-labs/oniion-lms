// ═══════════════════════════════════════════════════════════════
// Student Finance Details API
// GET /api/v1/hr/students/[email]/finance
//
// Returns payment history, invoice summary, session credits,
// and batch plan details for a given student.
// Accessible by: owner, hr, academic_operator, batch_coordinator
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const ALLOWED_ROLES = ['owner', 'hr', 'academic_operator', 'batch_coordinator'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const caller = await verifySession(token);
  if (!caller || !ALLOWED_ROLES.includes(caller.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { email: rawEmail } = await params;
  const studentEmail = decodeURIComponent(rawEmail).toLowerCase().trim();

  // ── Invoice summary ──────────────────────────────────────────
  const invoiceSummaryRes = await db.query(
    `SELECT
       COUNT(*)::int                                                            AS total_invoices,
       COALESCE(SUM(amount_paise), 0)::bigint                                  AS total_invoiced_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0)::bigint   AS total_paid_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'pending'), 0)::bigint AS pending_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'overdue'), 0)::bigint AS overdue_paise,
       COUNT(*) FILTER (WHERE status = 'pending')::int                         AS pending_count,
       COUNT(*) FILTER (WHERE status = 'overdue')::int                         AS overdue_count,
       COUNT(*) FILTER (WHERE status = 'paid')::int                            AS paid_count
     FROM invoices
     WHERE student_email = $1`,
    [studentEmail]
  );
  const invSummary = invoiceSummaryRes.rows[0] as Record<string, unknown>;

  // ── Recent invoices (last 8) ──────────────────────────────────
  const invoicesRes = await db.query(
    `SELECT
       id, invoice_number, description, billing_period,
       period_start, period_end, amount_paise, currency,
       status, due_date, paid_at, created_at, is_topup, topup_sessions
     FROM invoices
     WHERE student_email = $1
     ORDER BY created_at DESC
     LIMIT 8`,
    [studentEmail]
  );

  // ── Session credits ───────────────────────────────────────────
  const creditsRes = await db.query(
    `SELECT
       id, subject, batch_type, total_sessions, used_sessions,
       (total_sessions - used_sessions) AS remaining,
       fee_per_session_paise, currency, source, expires_at, created_at, is_active
     FROM student_session_credits
     WHERE student_email = $1
     ORDER BY is_active DESC, created_at DESC`,
    [studentEmail]
  );

  // ── Batch plan details ────────────────────────────────────────
  // Returns current batch enrolments with batch type, fee structure, and
  // next invoice date (only relevant for subscription/group batches).
  const batchPlanRes = await db.query(
    `SELECT
       b.batch_id, b.batch_name, b.batch_type, b.grade, b.board,
       b.subjects, b.status AS batch_status,
       bs.student_status, bs.added_at,
       -- fee structure matching this batch type + grade + first subject
       fs.amount_paise   AS plan_amount_paise,
       fs.billing_period AS plan_billing_period,
       fs.currency       AS plan_currency,
       -- next pending invoice for this batch (session-based lookup)
       (SELECT MIN(inv.due_date)
        FROM invoices inv
        WHERE inv.student_email = $1
          AND inv.status IN ('pending', 'overdue')
          AND inv.batch_session_id IN (
              SELECT bsess.session_id FROM batch_sessions bsess
              WHERE bsess.batch_id = b.batch_id
          )
       ) AS next_invoice_due,
       -- upcoming scheduled sessions count
       (SELECT COUNT(*)::int FROM batch_sessions bsess
        WHERE bsess.batch_id = b.batch_id
          AND bsess.status = 'scheduled'
          AND bsess.scheduled_date > CURRENT_DATE
       ) AS upcoming_sessions
     FROM batch_students bs
     JOIN batches b ON b.batch_id = bs.batch_id
     LEFT JOIN fee_structures fs ON
       fs.batch_type = b.batch_type
       AND (fs.grade = b.grade OR fs.grade IS NULL)
       AND fs.is_active = true
     WHERE bs.student_email = $1
     ORDER BY bs.student_status ASC, bs.added_at DESC`,
    [studentEmail]
  );

  // ── Credits aggregate ─────────────────────────────────────────
  const activeCredits = (creditsRes.rows as Record<string, unknown>[]).filter(c => c.is_active);
  const totalAllotted = activeCredits.reduce((s, c) => s + Number(c.total_sessions ?? 0), 0);
  const totalUsed     = activeCredits.reduce((s, c) => s + Number(c.used_sessions ?? 0), 0);
  const totalRemaining = totalAllotted - totalUsed;

  return NextResponse.json({
    success: true,
    data: {
      invoice_summary: {
        total_invoices: Number(invSummary.total_invoices ?? 0),
        total_invoiced_paise: Number(invSummary.total_invoiced_paise ?? 0),
        total_paid_paise: Number(invSummary.total_paid_paise ?? 0),
        pending_paise: Number(invSummary.pending_paise ?? 0),
        overdue_paise: Number(invSummary.overdue_paise ?? 0),
        pending_count: Number(invSummary.pending_count ?? 0),
        overdue_count: Number(invSummary.overdue_count ?? 0),
        paid_count: Number(invSummary.paid_count ?? 0),
      },
      recent_invoices: invoicesRes.rows,
      credits: creditsRes.rows,
      credits_summary: {
        total_allotted: totalAllotted,
        total_used: totalUsed,
        total_remaining: totalRemaining,
        active_packs: activeCredits.length,
      },
      batch_plans: batchPlanRes.rows,
    },
  });
}
