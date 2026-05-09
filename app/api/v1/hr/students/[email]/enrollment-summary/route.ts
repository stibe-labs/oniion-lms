// ═══════════════════════════════════════════════════════════════
// Student Enrollment Summary API
// GET /api/v1/hr/students/[email]/enrollment-summary
//
// Returns full enrollment context for a student:
//   • enrollment links (paid) — batch type, subjects, payment plan, sessions
//   • session credits (1:1 / 1:3) — per-subject balance, rate
//   • invoice stats — billed / paid / outstanding
//   • next upcoming invoice
//   • recent payment receipts
//
// Accessible by: owner, academic_operator, hr, batch_coordinator
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const ALLOWED_ROLES = ['owner', 'academic_operator', 'academic', 'hr', 'hr_associate', 'batch_coordinator'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const { email: rawEmail } = await params;
  const studentEmail = decodeURIComponent(rawEmail).toLowerCase();

  // ── 1. Enrollment links (most recent paid first) ────────────
  const linksRes = await db.query(
    `SELECT
       el.id,
       el.preferred_batch_type,
       el.selected_subjects,
       el.minimum_sessions,
       el.amount_paise,
       el.payment_plan,
       el.enrollment_category,
       el.student_grade,
       el.student_board,
       el.status,
       el.source,
       el.created_at,
       ao.full_name AS created_by_name
     FROM enrollment_links el
     LEFT JOIN portal_users ao ON ao.email = el.created_by
     WHERE el.student_email = $1
       AND el.status = 'paid'
     ORDER BY el.created_at DESC
     LIMIT 5`,
    [studentEmail],
  );

  // ── 2. Session credits (1:1 / 1:3 only) ────────────────────
  const creditsRes = await db.query(
    `SELECT
       id,
       subject,
       batch_type,
       total_sessions,
       used_sessions,
       remaining,
       fee_per_session_paise,
       currency,
       source,
       is_active,
       expires_at,
       created_at
     FROM student_session_credits
     WHERE student_email = $1
       AND is_active = true
     ORDER BY subject ASC, created_at DESC`,
    [studentEmail],
  );

  // ── 3. Invoice stats ────────────────────────────────────────
  const statsRes = await db.query(
    `SELECT
       COUNT(*)::int                                                                AS total_invoices,
       COALESCE(SUM(amount_paise), 0)::bigint                                      AS total_billed_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0)::bigint       AS total_paid_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status IN ('pending','overdue')), 0)::bigint AS total_outstanding_paise,
       COUNT(*) FILTER (WHERE status = 'pending')::int                             AS pending_count,
       COUNT(*) FILTER (WHERE status = 'paid')::int                                AS paid_count,
       COUNT(*) FILTER (WHERE status = 'overdue')::int                             AS overdue_count
     FROM invoices
     WHERE student_email = $1`,
    [studentEmail],
  );

  // ── 4. Next upcoming invoice ────────────────────────────────
  const nextRes = await db.query(
    `SELECT
       id, invoice_number, description, billing_period,
       amount_paise, currency, due_date, status,
       installment_number, scheduled_for, period_start, period_end
     FROM invoices
     WHERE student_email = $1
       AND status IN ('pending', 'overdue', 'scheduled')
     ORDER BY
       CASE WHEN status = 'overdue' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
       COALESCE(due_date, scheduled_for) ASC
     LIMIT 1`,
    [studentEmail],
  );

  // ── 5. Recent receipts (last 6) ─────────────────────────────
  const receiptsRes = await db.query(
    `SELECT
       pr.id,
       pr.receipt_number,
       pr.amount_paise,
       pr.currency,
       pr.payment_method,
       pr.created_at,
       i.description AS invoice_description,
       i.billing_period
     FROM payment_receipts pr
     LEFT JOIN invoices i ON i.id = pr.invoice_id
     WHERE pr.student_email = $1
     ORDER BY pr.created_at DESC
     LIMIT 6`,
    [studentEmail],
  );

  return NextResponse.json({
    success: true,
    data: {
      enrollment_links: linksRes.rows,
      credits: creditsRes.rows,
      invoice_stats: statsRes.rows[0] ?? null,
      next_invoice: nextRes.rows[0] ?? null,
      recent_receipts: receiptsRes.rows,
    },
  });
}
