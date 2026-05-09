// ═══════════════════════════════════════════════════════════════
// Monthly Invoice Generation API — POST /api/v1/payment/generate-monthly
// Auto-generates invoices for all active students based on fee structures
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { generateInvoiceNumber, formatAmount } from '@/lib/payment';
import { sendInvoiceGenerated } from '@/lib/email';
import { buildPayUrl } from '@/lib/pay-token';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Owner/Academic Operator only' }, { status: 403 });
    }

    const body = await req.json();
    const { month, year } = body;

    const billingMonth = month || (new Date().getMonth() + 1);
    const billingYear = year || new Date().getFullYear();

    // Calculate period
    const periodStart = new Date(billingYear, billingMonth - 1, 1);
    const periodEnd = new Date(billingYear, billingMonth, 0); // Last day of month
    const dueDate = new Date(billingYear, billingMonth - 1, 10); // Due by 10th

    // Find all active students with batch assignments
    const studentsResult = await db.query(
      `SELECT DISTINCT
         ra.participant_email AS student_email,
         up.parent_email,
         pu.full_name AS student_name,
         r.batch_type,
         r.subject,
         r.grade,
         r.room_id
       FROM room_assignments ra
       JOIN rooms r ON r.room_id = ra.room_id
       JOIN portal_users pu ON pu.email = ra.participant_email
       LEFT JOIN user_profiles up ON up.email = ra.participant_email
       WHERE ra.participant_type = 'student'
         AND r.status IN ('scheduled', 'live', 'ended')
         AND pu.is_active = true`
    );

    if (studentsResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { generated: 0, message: 'No active students found' },
      });
    }

    // Get fee structures
    const feeResult = await db.query(
      `SELECT * FROM fee_structures WHERE is_active = true`
    );
    const feeMap = new Map<string, { amount_paise: number; currency: string }>();
    for (const fee of feeResult.rows) {
      const f = fee as Record<string, unknown>;
      const key = `${f.batch_type}|${f.grade || ''}|${f.subject || ''}`;
      feeMap.set(key, { amount_paise: Number(f.amount_paise), currency: String(f.currency || 'INR') });
    }

    // Check for already generated invoices this month
    const existingResult = await db.query(
      `SELECT student_email FROM invoices
       WHERE period_start = $1 AND period_end = $2`,
      [periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]]
    );
    const alreadyGenerated = new Set(
      existingResult.rows.map((r: Record<string, unknown>) => String(r.student_email))
    );

    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Group by student (may have multiple batches)
    const studentBatches = new Map<string, Array<Record<string, unknown>>>();
    for (const row of studentsResult.rows) {
      const r = row as Record<string, unknown>;
      const email = String(r.student_email);
      if (!studentBatches.has(email)) studentBatches.set(email, []);
      studentBatches.get(email)!.push(r);
    }

    for (const [studentEmail, batches] of studentBatches) {
      if (alreadyGenerated.has(studentEmail)) {
        skipped++;
        continue;
      }

      // Calculate total fee for all batches
      let totalPaise = 0;
      let currency = 'INR';
      const batchDetails: string[] = [];

      for (const batch of batches) {
        const bType = String(batch.batch_type);
        const grade = String(batch.grade || '');
        const subject = String(batch.subject || '');

        // Try specific match first, then batch_type-only
        const fee = feeMap.get(`${bType}|${grade}|${subject}`)
          || feeMap.get(`${bType}|${grade}|`)
          || feeMap.get(`${bType}||`)
          || feeMap.get(`${bType}||${subject}`);

        if (fee) {
          totalPaise += fee.amount_paise;
          currency = fee.currency;
          batchDetails.push(`${subject || 'General'} (${bType})`);
        } else {
          errors.push(`No fee structure for ${studentEmail}: ${bType}/${grade}/${subject}`);
        }
      }

      if (totalPaise <= 0) continue;

      try {
        const invoiceNumber = await generateInvoiceNumber();
        const description = `Monthly tuition fee - ${batchDetails.join(', ')}`;

        const insertRes = await db.query(
          `INSERT INTO invoices (
             invoice_number, student_email, parent_email, description,
             billing_period, period_start, period_end,
             amount_paise, currency, due_date, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
           RETURNING id`,
          [
            invoiceNumber,
            studentEmail,
            String(batches[0].parent_email || ''),
            description,
            'monthly',
            periodStart.toISOString().split('T')[0],
            periodEnd.toISOString().split('T')[0],
            totalPaise,
            currency,
            dueDate.toISOString().split('T')[0],
          ]
        );
        const invoiceId = String((insertRes.rows[0] as Record<string, unknown>).id);

        // Update room assignments payment status to pending
        for (const batch of batches) {
          await db.query(
            `UPDATE room_assignments SET payment_status = 'pending'
             WHERE participant_email = $1 AND room_id = $2 AND payment_status IN ('not_required', 'unknown')`,
            [studentEmail, batch.room_id]
          );
        }

        generated++;

        // Send invoice email to parent (or student if no parent) — fire-and-forget
        const payLink = buildPayUrl(invoiceId);
        const parentEmail = String(batches[0].parent_email || '');
        const studentName = String(batches[0].student_name || studentEmail);
        const amount = formatAmount(totalPaise, currency);
        const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const periodStr = `${periodStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;

        if (parentEmail && parentEmail !== 'null') {
          const parentRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [parentEmail]);
          const parentName = parentRes.rows.length > 0 ? String((parentRes.rows[0] as Record<string, unknown>).full_name) : 'Parent';
          sendInvoiceGenerated({
            recipientName: parentName, recipientEmail: parentEmail, studentName,
            invoiceNumber, description, amount, dueDate: dueDateStr, billingPeriod: periodStr, payLink, invoiceId,
          }).catch(e => console.error('[generate-monthly] Email to parent failed:', e));
        }
        // Also send to student
        sendInvoiceGenerated({
          recipientName: studentName, recipientEmail: studentEmail, studentName,
          invoiceNumber, description, amount, dueDate: dueDateStr, billingPeriod: periodStr, payLink, invoiceId,
        }).catch(e => console.error('[generate-monthly] Email to student failed:', e));
      } catch (e) {
        errors.push(`Failed to generate invoice for ${studentEmail}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        generated,
        skipped,
        total_students: studentBatches.size,
        billing_period: `${billingYear}-${String(billingMonth).padStart(2, '0')}`,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    console.error('[payment/generate-monthly] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
