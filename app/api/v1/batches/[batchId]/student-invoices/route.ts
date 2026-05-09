// ═══════════════════════════════════════════════════════════════
// Batch Student Invoices — GET /api/v1/batches/[batchId]/student-invoices
//
// Returns per-student invoice list for a batch, covering:
//   • session_group invoices linked to this batch's schedule groups
//   • per-session invoices linked to this batch's batch_sessions
//   • enrollment invoices for these students (preferred_batch_type match)
//   • monthly/other invoices for these students (fallback — no link)
//
// Used in BatchDetailInline (Students tab) to show paid / pending /
// overdue invoices when expanding a student row. Works for all batch
// types (per-class and group).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

export interface StudentInvoiceRow {
  student_email: string;
  invoices: Array<{
    id: string;
    invoice_number: string;
    description: string | null;
    billing_period: string;
    status: string;
    amount_paise: number;
    currency: string;
    period_start: string | null;
    period_end: string | null;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
    schedule_group_id: string | null;
    batch_session_id: string | null;
  }>;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  cancelled_count: number;
  total_paid_paise: number;
  total_outstanding_paise: number;
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
      `SELECT batch_id, batch_name, batch_type FROM batches WHERE batch_id = $1`,
      [batchId]
    );
    if (batchRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    const batch = batchRes.rows[0] as { batch_id: string; batch_name: string; batch_type: string };

    // 2. Students in batch
    const studentsRes = await db.query(
      `SELECT student_email FROM batch_students WHERE batch_id = $1`,
      [batchId]
    );
    const emails = (studentsRes.rows as Array<{ student_email: string }>).map(r => r.student_email);
    if (emails.length === 0) {
      return NextResponse.json({ success: true, data: { students: [] } });
    }

    // 3. Schedule group IDs and session IDs for this batch
    const sgRes = await db.query(
      `SELECT DISTINCT schedule_group_id FROM batch_sessions
       WHERE batch_id = $1 AND schedule_group_id IS NOT NULL`,
      [batchId]
    );
    const scheduleGroupIds = (sgRes.rows as Array<{ schedule_group_id: string }>)
      .map(r => r.schedule_group_id);

    const sessRes = await db.query(
      `SELECT session_id FROM batch_sessions WHERE batch_id = $1`,
      [batchId]
    );
    const sessionIds = (sessRes.rows as Array<{ session_id: string }>).map(r => r.session_id);

    // 4. Fetch invoices scoped to this batch context.
    //    - session_group invoices linked via schedule_group_id (this batch's groups)
    //    - per-session invoices linked via batch_session_id (this batch's sessions)
    //    - enrollment invoices: invoice_id present in enrollment_links with matching
    //      student + preferred_batch_type = this batch's batch_type
    const invoicesRes = await db.query(
      `SELECT DISTINCT i.id, i.invoice_number, i.description, i.billing_period,
              i.status, i.amount_paise, i.currency,
              i.period_start, i.period_end, i.due_date, i.paid_at, i.created_at,
              i.schedule_group_id, i.batch_session_id, i.student_email
       FROM invoices i
       WHERE i.student_email = ANY($1)
         AND (
           ($2::text[] IS NOT NULL AND i.schedule_group_id = ANY($2))
           OR ($3::text[] IS NOT NULL AND i.batch_session_id = ANY($3))
           OR i.id IN (
             SELECT el.invoice_id FROM enrollment_links el
             WHERE el.student_email = i.student_email
               AND el.preferred_batch_type = $4
               AND el.invoice_id IS NOT NULL
           )
         )
       ORDER BY i.created_at DESC`,
      [
        emails,
        scheduleGroupIds.length > 0 ? scheduleGroupIds : null,
        sessionIds.length > 0 ? sessionIds : null,
        batch.batch_type,
      ]
    );

    type InvRow = {
      id: string; invoice_number: string; description: string | null;
      billing_period: string; status: string; amount_paise: number; currency: string;
      period_start: string | Date | null; period_end: string | Date | null;
      due_date: string | Date | null; paid_at: string | Date | null;
      created_at: string | Date;
      schedule_group_id: string | null; batch_session_id: string | null;
      student_email: string;
    };

    const fmt = (v: string | Date | null): string | null => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString();
      return String(v);
    };

    const byStudent = new Map<string, StudentInvoiceRow>();
    for (const email of emails) {
      byStudent.set(email, {
        student_email: email,
        invoices: [],
        paid_count: 0, pending_count: 0, overdue_count: 0, cancelled_count: 0,
        total_paid_paise: 0, total_outstanding_paise: 0,
      });
    }

    for (const row of invoicesRes.rows as InvRow[]) {
      const entry = byStudent.get(row.student_email);
      if (!entry) continue;
      entry.invoices.push({
        id: row.id,
        invoice_number: row.invoice_number,
        description: row.description,
        billing_period: row.billing_period,
        status: row.status,
        amount_paise: Number(row.amount_paise) || 0,
        currency: row.currency || 'INR',
        period_start: fmt(row.period_start),
        period_end: fmt(row.period_end),
        due_date: fmt(row.due_date),
        paid_at: fmt(row.paid_at),
        created_at: fmt(row.created_at) || '',
        schedule_group_id: row.schedule_group_id,
        batch_session_id: row.batch_session_id,
      });
      const amt = Number(row.amount_paise) || 0;
      if (row.status === 'paid') { entry.paid_count++; entry.total_paid_paise += amt; }
      else if (row.status === 'pending') { entry.pending_count++; entry.total_outstanding_paise += amt; }
      else if (row.status === 'overdue') { entry.overdue_count++; entry.total_outstanding_paise += amt; }
      else if (row.status === 'cancelled') { entry.cancelled_count++; }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batch.batch_id,
        batch_type: batch.batch_type,
        students: Array.from(byStudent.values()),
      },
    });
  } catch (err) {
    console.error('[batches/student-invoices] error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
