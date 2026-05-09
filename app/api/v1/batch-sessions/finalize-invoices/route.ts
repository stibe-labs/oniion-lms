// ═══════════════════════════════════════════════════════════════
// Finalize Invoices — POST /api/v1/batch-sessions/finalize-invoices
//
// After all sessions in a schedule group have been created,
// this endpoint generates COMBINED invoices (one per student)
// covering all sessions in the group.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { generateScheduleGroupInvoices, formatAmount } from '@/lib/payment';
import { sendInvoiceGenerated } from '@/lib/email';
import { buildPayUrl, buildInvoiceUrl } from '@/lib/pay-token';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { schedule_group_id } = body;

    if (!schedule_group_id) {
      return NextResponse.json({ success: false, error: 'schedule_group_id is required' }, { status: 400 });
    }

    // Scope: AO/BC can only finalize invoices for sessions in their own batches
    if (user.role === 'academic_operator' || user.role === 'batch_coordinator') {
      const col = user.role === 'academic_operator' ? 'academic_operator_email' : 'coordinator_email';
      const scopeRes = await db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE b.${col} = $2)::int AS owned
         FROM batch_sessions s
         JOIN batches b ON b.batch_id = s.batch_id
         WHERE s.schedule_group_id = $1`,
        [schedule_group_id, user.id]
      );
      const row = scopeRes.rows[0] as { total: number; owned: number };
      if (row.total === 0) {
        return NextResponse.json({ success: false, error: 'Schedule group not found' }, { status: 404 });
      }
      if (row.owned !== row.total) {
        return NextResponse.json({ success: false, error: 'Schedule group is not in your batches' }, { status: 403 });
      }
    }

    const result = await generateScheduleGroupInvoices(schedule_group_id);

    // Send invoice emails to students & parents (fire-and-forget)
    if (result.created > 0) {
      (async () => {
        try {
          const invRows = await db.query(
            `SELECT i.*, pu.full_name AS student_name
             FROM invoices i
             LEFT JOIN portal_users pu ON pu.email = i.student_email
             WHERE i.schedule_group_id = $1`,
            [schedule_group_id]
          );
          for (const row of invRows.rows as Array<Record<string, unknown>>) {
            const studentName = String(row.student_name || row.student_email);
            const amount = formatAmount(Number(row.amount_paise), String(row.currency || 'INR'));
            const dueDate = new Date(String(row.due_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const payLink = buildPayUrl(String(row.id));
            const invoiceLink = buildInvoiceUrl(String(row.id));

            const emailData = {
              recipientName: studentName,
              recipientEmail: String(row.student_email),
              studentName,
              invoiceNumber: String(row.invoice_number),
              description: String(row.description || 'Session Fee'),
              amount,
              dueDate,
              billingPeriod: `${new Date(String(row.period_start)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(String(row.period_end)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
              payLink,
              invoiceLink,
              invoiceId: String(row.id),
            };

            // Send to student
            await sendInvoiceGenerated(emailData).catch(e => console.error('[finalize] Invoice email failed:', e));

            // Also send to parent if available
            const parentEmail = String(row.parent_email || '');
            if (parentEmail && parentEmail !== 'null' && parentEmail !== '') {
              const pRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [parentEmail]);
              const parentName = pRes.rows.length > 0 ? String((pRes.rows[0] as Record<string, unknown>).full_name) : 'Parent';
              await sendInvoiceGenerated({ ...emailData, recipientName: parentName, recipientEmail: parentEmail })
                .catch(e => console.error('[finalize] Parent invoice email failed:', e));
            }
          }
        } catch (e) {
          console.error('[finalize-invoices] Email dispatch error:', e);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      data: {
        invoices_created: result.created,
        invoices_skipped: result.skipped,
        credits_covered: result.creditsCovered,
        session_count: result.sessionCount,
        total_amount: result.totalAmount,
      },
      message: result.created > 0
        ? `${result.created} invoice${result.created > 1 ? 's' : ''} generated for ${result.sessionCount} session${result.sessionCount > 1 ? 's' : ''}`
          + (result.creditsCovered > 0 ? ` (${result.creditsCovered} session${result.creditsCovered > 1 ? 's' : ''} covered by prepaid credits)` : '')
        : result.creditsCovered > 0
          ? `All ${result.creditsCovered} session${result.creditsCovered > 1 ? 's' : ''} covered by prepaid credits — no invoice needed`
          : result.totalAmount
            ? 'All students already have invoices for this schedule group'
            : 'No fee rates configured — no invoices generated',
    });
  } catch (err) {
    console.error('[finalize-invoices] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
