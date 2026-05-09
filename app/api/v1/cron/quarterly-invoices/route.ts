// ═══════════════════════════════════════════════════════════════════════
// Cron: Activate Scheduled SPO Invoices
// GET /api/v1/cron/quarterly-invoices
//
// Called daily (08:00 IST / 02:30 UTC via vercel.json).
// Finds all 'scheduled' invoices where scheduled_for <= today+7,
// activates them to 'pending', and sends reminder emails with pay links.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePayToken } from '@/lib/pay-token';
import { sendEmail } from '@/lib/email';
import { getPlatformName } from '@/lib/platform-config';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: NextRequest) {
  // Verify cron secret (allows local testing if secret is empty)
  const secret = req.headers.get('x-cron-secret');
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sevenDaysOut = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10);

    // Activate invoices coming due within 7 days
    const activated = await db.query<{
      id: string;
      student_email: string;
      parent_email: string | null;
      amount_paise: number;
      currency: string;
      description: string;
      scheduled_for: string;
      installment_number: number;
      enrollment_link_id: string | null;
    }>(
      `UPDATE invoices
       SET status = 'pending', updated_at = NOW()
       WHERE status = 'scheduled' AND scheduled_for <= $1
       RETURNING id, student_email, parent_email, amount_paise, currency,
                 description, scheduled_for, installment_number, enrollment_link_id`,
      [sevenDaysOut],
    );

    let emailsSent = 0;
    const platformName = await getPlatformName();

    for (const inv of activated.rows) {
      const token = generatePayToken(inv.id);
      const payUrl = `${APP_URL}/pay/${inv.id}?t=${token}`;
      const dueDate = new Date(inv.scheduled_for).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      const amount = `₹${(inv.amount_paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      const qNum = inv.installment_number || '?';

      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#047857">${platformName} — Q${qNum} Payment Due</h2>
          <p>Your Q${qNum} installment of <strong>${amount}</strong> is due on <strong>${dueDate}</strong>.</p>
          <p>Please complete your payment to ensure uninterrupted access to your classes.</p>
          <p style="margin:24px 0">
            <a href="${payUrl}" style="background:#10b981;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
              Pay ${amount} Now
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">${inv.description}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">${platformName} Learning · stibelearning.online</p>
        </div>
      `;
      const text = `${platformName} Q${qNum} payment of ${amount} is due on ${dueDate}. Pay now: ${payUrl}`;
      const subject = `${platformName} — Q${qNum} Payment Due: ${amount} on ${dueDate}`;

      // Email student
      await sendEmail({ to: inv.student_email, subject, html, text }).catch(e =>
        console.error(`[cron/quarterly] Email to ${inv.student_email} failed:`, e),
      );
      emailsSent++;

      // Email parent if linked
      if (inv.parent_email) {
        await sendEmail({ to: inv.parent_email, subject, html, text }).catch(e =>
          console.error(`[cron/quarterly] Parent email to ${inv.parent_email} failed:`, e),
        );
        emailsSent++;
      } else {
        // Look up parent from batch_students
        const parentRes = await db.query<{ parent_email: string }>(
          `SELECT parent_email FROM batch_students
           WHERE student_email = $1 AND parent_email IS NOT NULL
           LIMIT 1`,
          [inv.student_email],
        );
        if (parentRes.rows.length > 0) {
          await sendEmail({ to: parentRes.rows[0].parent_email, subject, html, text }).catch(() => {});
          emailsSent++;
        }
      }
    }

    console.log(`[cron/quarterly] Activated ${activated.rowCount} invoices, sent ${emailsSent} emails`);

    return NextResponse.json({
      success: true,
      activated: activated.rowCount,
      emailsSent,
    });
  } catch (err) {
    console.error('[cron/quarterly-invoices] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
