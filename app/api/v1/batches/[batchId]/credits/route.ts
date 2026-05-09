// ═══════════════════════════════════════════════════════════════
// Batch Credits — GET /api/v1/batches/[batchId]/credits
//
// Returns per-student session credit status for a batch, covering
// all batch types, all credit sources (enrollment / invoice_payment
// / topup), with expiry gating and upcoming-session coverage info.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

export interface StudentCreditRow {
  student_email: string;
  student_name: string;
  // Per-credit-source pools
  pools: Array<{
    id: string;
    source: 'enrollment' | 'invoice_payment' | 'topup';
    subject: string;
    total_sessions: number;
    used_sessions: number;
    remaining: number;
    fee_per_session_paise: number;
    currency: string;
    is_active: boolean;
    expires_at: string | null;
    is_expired: boolean;
    invoice_id: string | null;
  }>;
  // Aggregated
  total_remaining: number;
  total_used: number;
  total_sessions: number;
  // Upcoming coverage
  upcoming_sessions: number;   // scheduled sessions not yet ended for this batch
  covered_by_credits: number;  // min(total_remaining, upcoming_sessions)
  uncovered_sessions: number;  // upcoming_sessions - covered_by_credits
  // Status flags
  credit_status: 'healthy' | 'low' | 'critical' | 'none' | 'no_pool';
  has_overdue_invoice: boolean;
  overdue_invoice_count: number;
  pending_invoice_count: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator', 'batch_coordinator', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { batchId } = await params;

    // 1. Fetch batch info
    const batchRes = await db.query(
      `SELECT batch_id, batch_name, batch_type, grade FROM batches WHERE batch_id = $1`,
      [batchId]
    );
    if (batchRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    const batch = batchRes.rows[0] as { batch_id: string; batch_name: string; batch_type: string; grade: string | null };

    // 2. Fetch all students in batch
    const studentsRes = await db.query(
      `SELECT bs.student_email,
              COALESCE(pu.full_name, bs.student_email) AS student_name
       FROM batch_students bs
       LEFT JOIN portal_users pu ON pu.email = bs.student_email
       WHERE bs.batch_id = $1
       ORDER BY student_name`,
      [batchId]
    );
    const students = studentsRes.rows as Array<{ student_email: string; student_name: string }>;

    // 3. Count upcoming (not-ended, not-cancelled) sessions for this batch
    const upcomingRes = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM batch_sessions
       WHERE batch_id = $1 AND status IN ('scheduled', 'live')`,
      [batchId]
    );
    const batchUpcomingSessions = Number((upcomingRes.rows[0] as { cnt: number }).cnt) || 0;

    // 4. Fetch ALL credit pools for ALL students in one query
    const emails = students.map(s => s.student_email);
    if (emails.length === 0) {
      return NextResponse.json({ success: true, data: { batch, students: [], summary: buildSummary([]) } });
    }

    const creditsRes = await db.query(
      `SELECT id, student_email, subject, batch_type, total_sessions, used_sessions,
              (total_sessions - used_sessions) AS remaining,
              fee_per_session_paise, currency, source, is_active, expires_at, invoice_id
       FROM student_session_credits
       WHERE student_email = ANY($1)
         AND batch_type = $2
         AND is_active = true
       ORDER BY student_email, created_at ASC`,
      [emails, batch.batch_type]
    );

    // Also fetch credits from enrollment source with ANY batch_type
    // (some legacy data may have stored as different type)
    const creditsAllTypesRes = await db.query(
      `SELECT id, student_email, subject, batch_type, total_sessions, used_sessions,
              (total_sessions - used_sessions) AS remaining,
              fee_per_session_paise, currency, source, is_active, expires_at, invoice_id
       FROM student_session_credits
       WHERE student_email = ANY($1)
         AND batch_type != $2
         AND is_active = true
       ORDER BY student_email, created_at ASC`,
      [emails, batch.batch_type]
    );

    // Group all credits by student email
    type CreditRow = {
      id: string; student_email: string; subject: string; batch_type: string;
      total_sessions: number; used_sessions: number; remaining: number;
      fee_per_session_paise: number; currency: string; source: string;
      is_active: boolean; expires_at: string | null; invoice_id: string | null;
    };

    const now = new Date();
    const creditsByStudent = new Map<string, CreditRow[]>();

    for (const row of [...creditsRes.rows, ...creditsAllTypesRes.rows] as CreditRow[]) {
      if (!creditsByStudent.has(row.student_email)) creditsByStudent.set(row.student_email, []);
      creditsByStudent.get(row.student_email)!.push(row);
    }

    // 5. Fetch invoice info per student (overdue + pending session_group invoices)
    const invoicesRes = await db.query(
      `SELECT student_email, status, COUNT(*)::int AS cnt
       FROM invoices
       WHERE student_email = ANY($1)
         AND billing_period = 'session_group'
         AND status IN ('pending', 'overdue')
       GROUP BY student_email, status`,
      [emails]
    );
    type InvoiceAgg = { student_email: string; status: string; cnt: number };
    const invoicesByStudent = new Map<string, { pending: number; overdue: number }>();
    for (const row of invoicesRes.rows as InvoiceAgg[]) {
      if (!invoicesByStudent.has(row.student_email)) invoicesByStudent.set(row.student_email, { pending: 0, overdue: 0 });
      const entry = invoicesByStudent.get(row.student_email)!;
      if (row.status === 'pending') entry.pending += row.cnt;
      if (row.status === 'overdue') entry.overdue += row.cnt;
    }

    // 6. Build per-student response
    const studentData: StudentCreditRow[] = students.map(student => {
      const allPools = creditsByStudent.get(student.student_email) || [];

      // Build pool details
      const pools = allPools.map(p => {
        const isExpired = p.expires_at ? new Date(p.expires_at) < now : false;
        const effectiveRemaining = isExpired ? 0 : p.remaining;
        return {
          id: p.id,
          source: p.source as 'enrollment' | 'invoice_payment' | 'topup',
          subject: p.subject,
          total_sessions: p.total_sessions,
          used_sessions: p.used_sessions,
          remaining: effectiveRemaining,
          fee_per_session_paise: p.fee_per_session_paise,
          currency: p.currency || 'INR',
          is_active: p.is_active,
          expires_at: p.expires_at,
          is_expired: isExpired,
          invoice_id: p.invoice_id,
        };
      });

      const totalRemaining = pools.reduce((s, p) => s + p.remaining, 0);
      const totalUsed = pools.reduce((s, p) => s + p.used_sessions, 0);
      const totalSessions = pools.reduce((s, p) => s + p.total_sessions, 0);

      const coveredByCredits = Math.min(totalRemaining, batchUpcomingSessions);
      const uncoveredSessions = Math.max(0, batchUpcomingSessions - coveredByCredits);

      // Credit status classification
      let credit_status: StudentCreditRow['credit_status'];
      if (pools.length === 0) {
        credit_status = 'no_pool';
      } else if (totalRemaining === 0) {
        credit_status = 'none';
      } else if (totalRemaining <= 2) {
        credit_status = 'critical';
      } else if (totalRemaining <= 5) {
        credit_status = 'low';
      } else {
        credit_status = 'healthy';
      }

      const invoiceInfo = invoicesByStudent.get(student.student_email) || { pending: 0, overdue: 0 };

      return {
        student_email: student.student_email,
        student_name: student.student_name,
        pools,
        total_remaining: totalRemaining,
        total_used: totalUsed,
        total_sessions: totalSessions,
        upcoming_sessions: batchUpcomingSessions,
        covered_by_credits: coveredByCredits,
        uncovered_sessions: uncoveredSessions,
        credit_status,
        has_overdue_invoice: invoiceInfo.overdue > 0,
        overdue_invoice_count: invoiceInfo.overdue,
        pending_invoice_count: invoiceInfo.pending,
      };
    });

    const summary = buildSummary(studentData);

    return NextResponse.json({
      success: true,
      data: {
        batch,
        students: studentData,
        summary,
        upcoming_sessions: batchUpcomingSessions,
      }
    });
  } catch (err) {
    console.error('[batch/credits] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function buildSummary(students: StudentCreditRow[]) {
  return {
    total_students: students.length,
    healthy: students.filter(s => s.credit_status === 'healthy').length,
    low: students.filter(s => s.credit_status === 'low').length,
    critical: students.filter(s => s.credit_status === 'critical').length,
    none: students.filter(s => s.credit_status === 'none').length,
    no_pool: students.filter(s => s.credit_status === 'no_pool').length,
    has_overdue: students.filter(s => s.has_overdue_invoice).length,
    has_pending_invoice: students.filter(s => s.pending_invoice_count > 0).length,
    needs_attention: students.filter(s =>
      s.credit_status === 'critical' || s.credit_status === 'none' ||
      s.credit_status === 'low' || s.has_overdue_invoice
    ).length,
  };
}
