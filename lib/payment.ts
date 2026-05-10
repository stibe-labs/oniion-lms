// ═══════════════════════════════════════════════════════════════
// stibe Portal — Payment Gateway Service
// ═══════════════════════════════════════════════════════════════
// Supports: Razorpay (default), Federal Bank (when credentials provided)
// Mode: PAYMENT_MODE=test|live
//
// Usage:
//   import { createOrder, verifyPayment, ... } from '@/lib/payment';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import crypto from 'crypto';
import { hash } from 'bcryptjs';
import { notifyCRM } from '@/lib/crm-webhook';
import { sendEmail } from '@/lib/email';
import { credentialsTemplate } from '@/lib/email-templates';
import { getIntegrationConfig } from '@/lib/integration-config';

const LOGIN_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
  : 'https://stibelearning.online/login';

/** Generate a readable 8-char temp password: 2 uppercase + 4 lowercase + 2 digits */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (chars: string, n: number) =>
    Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]).join('');
  return pick(upper, 2) + pick(lower, 4) + pick(digits, 2);
}

// ── Currency helpers ────────────────────────────────────────

const SUPPORTED_CURRENCIES = ['INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', AED: 'د.إ', SAR: '﷼', QAR: 'ر.ق',
  KWD: 'د.ك', OMR: 'ر.ع.', BHD: '.د.ب', USD: '$',
};

export function formatAmount(paise: number, currency: string = 'INR'): string {
  const amount = (paise / 100).toFixed(2);
  return `${CURRENCY_SYMBOLS[currency] || currency} ${amount}`;
}

// ── Invoice Number Generator ────────────────────────────────

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const result = await db.query<{ nextval: string }>(`SELECT nextval('invoice_number_seq') AS nextval`);
  const next = parseInt(result.rows[0].nextval, 10);
  return `INV-${year}${month}-${String(next).padStart(5, '0')}`;
}

export async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const result = await db.query<{ nextval: string }>(`SELECT nextval('receipt_number_seq') AS nextval`);
  const next = parseInt(result.rows[0].nextval, 10);
  return `RCT-${year}${month}-${String(next).padStart(5, '0')}`;
}

// ── Create Invoice ──────────────────────────────────────────

export interface CreateInvoiceInput {
  studentEmail: string;
  parentEmail?: string;
  description?: string;
  billingPeriod?: string;
  periodStart: string;
  periodEnd: string;
  amountPaise: number;
  currency?: SupportedCurrency;
  dueDate: string;
}

export async function createInvoice(input: CreateInvoiceInput) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      const result = await db.query(
        `INSERT INTO invoices (
           invoice_number, student_email, parent_email, description,
           billing_period, period_start, period_end,
           amount_paise, currency, due_date, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
         RETURNING *`,
        [
          invoiceNumber, input.studentEmail, input.parentEmail || null,
          input.description || `Tuition fee for ${input.periodStart} to ${input.periodEnd}`,
          input.billingPeriod || 'monthly',
          input.periodStart, input.periodEnd,
          input.amountPaise, input.currency || 'INR', input.dueDate,
        ]
      );
      return result.rows[0];
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      if (pgErr.code === '23505' && pgErr.constraint === 'invoices_invoice_number_key' && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique invoice number after retries');
}

// ── Create Payment Order ────────────────────────────────────

export interface CreateOrderInput {
  invoiceId: string;
  amountPaise: number;
  currency: string;
  studentEmail: string;
  studentName: string;
  description?: string;
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  gatewayKeyId: string;
  callbackUrl: string;
  prefill: { name: string; email: string };
  mode: string;
}

export async function createPaymentOrder(input: CreateOrderInput): Promise<PaymentOrder> {
  const { keyId: RAZORPAY_KEY_ID, keySecret: RAZORPAY_KEY_SECRET, mode: PAYMENT_MODE, callbackUrl: CALLBACK_URL } = (await getIntegrationConfig()).razorpay;

  // If Razorpay keys are set, create a real order
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && PAYMENT_MODE === 'live') {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.invoiceId,
        notes: { student_email: input.studentEmail },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Razorpay order creation failed: ${err}`);
    }

    const order = await response.json();

    // Store gateway order ID on invoice
    await db.query(
      `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
      [order.id, input.invoiceId]
    );

    return {
      orderId: order.id,
      amount: input.amountPaise,
      currency: input.currency,
      gatewayKeyId: RAZORPAY_KEY_ID,
      callbackUrl: CALLBACK_URL,
      prefill: { name: input.studentName, email: input.studentEmail },
      mode: 'live',
    };
  }

  // Test/mock mode — generate a mock order ID
  const mockOrderId = `mock_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db.query(
    `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
    [mockOrderId, input.invoiceId]
  );

  return {
    orderId: mockOrderId,
    amount: input.amountPaise,
    currency: input.currency,
    gatewayKeyId: RAZORPAY_KEY_ID || 'test_key',
    callbackUrl: CALLBACK_URL,
    prefill: { name: input.studentName, email: input.studentEmail },
    mode: 'test',
  };
}

// ── Verify Payment ──────────────────────────────────────────

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export async function verifyRazorpaySignature(input: VerifyPaymentInput): Promise<boolean> {
  const secret = (await getIntegrationConfig()).razorpay.keySecret;
  if (!secret) return true; // test mode
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  return expectedSignature === input.signature;
}

// ── Complete Payment ────────────────────────────────────────

export async function completePayment(invoiceId: string, paymentId: string, paymentMethod?: string, gatewayResponse?: unknown) {
  let receiptNumber: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    receiptNumber = await generateReceiptNumber();
    try {
      return await _completePaymentInner(invoiceId, paymentId, paymentMethod, gatewayResponse, receiptNumber);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      if (pgErr.code === '23505' && pgErr.constraint === 'payment_receipts_receipt_number_key' && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique receipt number after retries');
}

async function _completePaymentInner(invoiceId: string, paymentId: string, paymentMethod: string | undefined, gatewayResponse: unknown, receiptNumber: string) {

  const result = await db.withTransaction(async (client) => {
    // Update invoice
    const invResult = await client.query(
      `UPDATE invoices
       SET status = 'paid', paid_at = NOW(), transaction_id = $1, payment_method = $2
       WHERE id = $3
       RETURNING *`,
      [paymentId, paymentMethod || 'online', invoiceId]
    );

    const invoice = invResult.rows[0];
    if (!invoice) throw new Error('Invoice not found');

    // Create receipt
    await client.query(
      `INSERT INTO payment_receipts (
         receipt_number, invoice_id, student_email, amount_paise,
         currency, payment_method, transaction_id, gateway_response
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        receiptNumber, invoiceId, invoice.student_email,
        invoice.amount_paise, invoice.currency,
        paymentMethod || 'online', paymentId,
        JSON.stringify(gatewayResponse || {}),
      ]
    );

    // Update room_assignments for this student to 'paid' — scoped to rooms covered
    // by this invoice (via session_payments). Falls back to all rooms for legacy invoices.
    await client.query(
      `UPDATE room_assignments SET payment_status = 'paid', payment_verified = true
       WHERE participant_email = $1
         AND payment_status != 'paid'
         AND (
           room_id IN (
             SELECT r.room_id FROM rooms r
             JOIN batch_sessions bs ON bs.batch_id = r.batch_id
             JOIN session_payments sp ON sp.batch_session_id = bs.session_id
             WHERE sp.invoice_id = $2
           )
           OR NOT EXISTS (SELECT 1 FROM session_payments WHERE invoice_id = $2)
         )`,
      [invoice.student_email, invoiceId]
    );

    // Update session_payments for this invoice to 'paid'
    await client.query(
      `UPDATE session_payments SET status = 'paid', paid_at = NOW(), payment_method = $1, transaction_id = $2
       WHERE invoice_id = $3`,
      [paymentMethod || 'online', paymentId, invoiceId]
    );

    // Log payment event
    await client.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       SELECT ra.room_id, 'payment_completed', $1, $2::jsonb
       FROM room_assignments ra
       WHERE ra.participant_email = $1 AND ra.payment_status = 'paid'
       LIMIT 1`,
      [invoice.student_email, JSON.stringify({ invoice_id: invoiceId, amount: invoice.amount_paise })]
    );

    // Update the payment_attempts table too (legacy)
    await client.query(
      `INSERT INTO payment_attempts (room_id, student_email, order_id, amount_paise, status, transaction_id, raw_callback)
       SELECT ra.room_id, $1, $2, $3, 'completed', $4, $5::jsonb
       FROM room_assignments ra
       WHERE ra.participant_email = $1
       LIMIT 1`,
      [invoice.student_email, invoice.gateway_order_id, invoice.amount_paise, paymentId, JSON.stringify(gatewayResponse || {})]
    );

    return { invoice, receiptNumber };
  });

  // Fire CRM enrollment_paid webhook (fire-and-forget) + create student account
  void (async () => {
    try {
      const linkRes = await db.query(
        `SELECT id, crm_lead_id, crm_tenant_id, selected_subjects, amount_paise,
                minimum_sessions, preferred_batch_type, demo_request_id,
                student_name, student_email, student_phone, student_grade,
                student_board, student_region, student_whatsapp, student_dob,
                student_section, student_address, student_category,
                student_parent_name, student_parent_email, student_parent_phone,
                created_by, source, payment_plan
         FROM enrollment_links WHERE invoice_id = $1 LIMIT 1`,
        [invoiceId],
      );
      // Handle Q2/Q3/Q4 installment payment (no enrollment_link match, but installment_number set)
      if (linkRes.rows.length === 0) {
        try {
          const installRes = await db.query(
            `SELECT installment_number, enrollment_link_id, student_email
             FROM invoices WHERE id = $1`,
            [invoiceId],
          );
          if (installRes.rows.length > 0) {
            const inv = installRes.rows[0] as {
              installment_number: number | null;
              enrollment_link_id: string | null;
              student_email: string;
            };
            if (inv.installment_number && inv.installment_number >= 2) {
              await _handleSpoInstallmentPaid(inv.installment_number, inv.enrollment_link_id, inv.student_email);
            }
            // Handle top-up invoice payment → add session credits
            const topupRes = await db.query(
              `SELECT is_topup, topup_sessions, enrollment_link_id FROM invoices WHERE id = $1`,
              [invoiceId],
            );
            if (topupRes.rows.length > 0) {
              const t = topupRes.rows[0] as { is_topup: boolean; topup_sessions: number | null; enrollment_link_id: string | null };
              if (t.is_topup && inv.student_email) {
                await _handleTopupInvoicePaid(invoiceId, inv.student_email, t.topup_sessions || 50, t.enrollment_link_id);
              }
            }
          }
        } catch (e) {
          console.error('[payment] installment/topup post-payment error:', e);
        }

        // Handle session_group invoice payment → add session credits for pay-per-class students
        try {
          const sgInv = result.invoice as Record<string, unknown>;
          if (sgInv.billing_period === 'session_group' && sgInv.schedule_group_id && sgInv.student_email) {
            // Check if credits already created for this invoice (prevent double on retry)
            const existingCredit = await db.query(
              `SELECT id FROM student_session_credits WHERE invoice_id = $1`,
              [invoiceId],
            );
            if (existingCredit.rows.length === 0) {
              // Count billable (non-prepaid) sessions covered by this invoice
              const billableRes = await db.query(
                `SELECT COUNT(*)::int AS cnt FROM session_payments
                 WHERE invoice_id = $1`,
                [invoiceId],
              );
              const sessionCount = Number((billableRes.rows[0] as Record<string, unknown>).cnt) || 0;

              if (sessionCount > 0) {
                const batchTypeRes = await db.query(
                  `SELECT DISTINCT b.batch_type FROM batch_sessions s
                   JOIN batches b ON b.batch_id = s.batch_id
                   WHERE s.schedule_group_id = $1 LIMIT 1`,
                  [sgInv.schedule_group_id as string],
                );
                const batchType = batchTypeRes.rows.length > 0
                  ? String((batchTypeRes.rows[0] as Record<string, unknown>).batch_type)
                  : 'one_to_one';
                // Session credits only apply to per-class batches (1:1, 1:3).
                // Group batches (1:15, 1:30, 1:m, etc.) use enrollment/session-group
                // invoices directly and must NOT get session-credit pools.
                const isPerClassBatch = batchType === 'one_to_one' || batchType === 'one_to_three';
                const feePerSession = Math.round(Number(sgInv.amount_paise) / sessionCount);

                if (isPerClassBatch) {
                  await db.query(
                    `INSERT INTO student_session_credits
                       (student_email, subject, batch_type, total_sessions, used_sessions,
                        fee_per_session_paise, currency, invoice_id, source)
                     VALUES ($1, 'general', $2, $3, 0, $4, $5, $6, 'invoice_payment')`,
                    [
                      sgInv.student_email as string,
                      batchType,
                      sessionCount,
                      feePerSession,
                      String(sgInv.currency || 'INR'),
                      invoiceId,
                    ],
                  );
                  console.log(`[payment] Added ${sessionCount} session credits for ${sgInv.student_email} (invoice_payment) after invoice ${invoiceId}`);
                } else {
                  console.log(`[payment] Skipped session-credit creation for ${sgInv.student_email} — batch_type=${batchType} is a group batch (not 1:1 / 1:3)`);
                }
              }
            }
          }
        } catch (e) {
          console.error('[payment] session_group credit creation error:', e);
        }
      }

      if (linkRes.rows.length > 0) {
        const link = linkRes.rows[0] as Record<string, unknown>;

        await db.query(
          `UPDATE enrollment_links SET status = 'paid' WHERE invoice_id = $1`,
          [invoiceId],
        );

        // Create portal_users student account with password
        const studentPassword = generateTempPassword();
        const studentPasswordHash = await hash(studentPassword, 10);
        const studentInsertResult = await db.query(
          `INSERT INTO portal_users (email, full_name, portal_role, phone, is_active, password_hash, plain_password, created_by)
           VALUES ($1, $2, 'student', $3, true, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET
             full_name = COALESCE(EXCLUDED.full_name, portal_users.full_name),
             phone = COALESCE(EXCLUDED.phone, portal_users.phone),
             password_hash = COALESCE(portal_users.password_hash, EXCLUDED.password_hash),
             plain_password = COALESCE(portal_users.plain_password, EXCLUDED.plain_password),
             created_by = COALESCE(portal_users.created_by, EXCLUDED.created_by)
           RETURNING (xmax = 0) AS is_new`,
          [link.student_email, link.student_name, link.student_phone ?? null, studentPasswordHash, studentPassword, link.created_by ?? null],
        );
        const studentIsNew = Boolean(studentInsertResult.rows[0]?.is_new);

        // Resolve student category from demo exam marks (A/B/C), fallback to CRM-provided category
        let studentCategory: string | null = null;
        if (link.demo_request_id) {
          try {
            const examRes = await db.query(
              `SELECT der.grade_letter
               FROM demo_requests dr
               JOIN demo_exam_results der ON der.id = dr.exam_result_id
               WHERE dr.id = $1`,
              [link.demo_request_id],
            );
            if (examRes.rows.length > 0) {
              const gl = String((examRes.rows[0] as Record<string, unknown>).grade_letter);
              if (['A+', 'A'].includes(gl)) studentCategory = 'A';
              else if (['B+', 'B'].includes(gl)) studentCategory = 'B';
              else studentCategory = 'C';
            }
          } catch { /* demo tables may not exist */ }
        }
        if (!studentCategory && link.student_category) {
          studentCategory = String(link.student_category);
        }

        // Create user_profile with grade + board + region + category + address + phone + whatsapp
        await db.query(
          `INSERT INTO user_profiles (email, grade, board, assigned_region, parent_email, admission_date, category, address, phone, whatsapp, date_of_birth, section, parent_phone)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (email) DO UPDATE SET
             grade = COALESCE(EXCLUDED.grade, user_profiles.grade),
             board = COALESCE(EXCLUDED.board, user_profiles.board),
             assigned_region = COALESCE(EXCLUDED.assigned_region, user_profiles.assigned_region),
             parent_email = COALESCE(EXCLUDED.parent_email, user_profiles.parent_email),
             category = COALESCE(EXCLUDED.category, user_profiles.category),
             address = COALESCE(EXCLUDED.address, user_profiles.address),
             phone = COALESCE(EXCLUDED.phone, user_profiles.phone),
             whatsapp = COALESCE(EXCLUDED.whatsapp, user_profiles.whatsapp),
             date_of_birth = COALESCE(EXCLUDED.date_of_birth, user_profiles.date_of_birth),
             section = COALESCE(EXCLUDED.section, user_profiles.section),
             parent_phone = COALESCE(EXCLUDED.parent_phone, user_profiles.parent_phone)`,
          [
            link.student_email, link.student_grade ?? null,
            link.student_board ?? null, link.student_region ?? null,
            link.student_parent_email ?? null, studentCategory,
            link.student_address ?? null,
            link.student_phone ?? null,
            link.student_whatsapp ?? null,
            link.student_dob ?? null,
            link.student_section ?? null,
            link.student_parent_phone ?? null,
          ],
        );

        // Create parent portal_users account with password if parent email provided
        let parentPassword: string | undefined;
        let parentIsNew = false;
        if (link.student_parent_email) {
          parentPassword = generateTempPassword();
          const parentPasswordHash = await hash(parentPassword, 10);
          const parentInsertResult = await db.query(
            `INSERT INTO portal_users (email, full_name, portal_role, phone, is_active, password_hash, plain_password, created_by)
             VALUES ($1, $2, 'parent', $3, true, $4, $5, $6)
             ON CONFLICT (email) DO UPDATE SET
               full_name = COALESCE(EXCLUDED.full_name, portal_users.full_name),
               phone = COALESCE(EXCLUDED.phone, portal_users.phone),
               password_hash = COALESCE(portal_users.password_hash, EXCLUDED.password_hash),
               plain_password = COALESCE(portal_users.plain_password, EXCLUDED.plain_password),
               created_by = COALESCE(portal_users.created_by, EXCLUDED.created_by)
             RETURNING (xmax = 0) AS is_new`,
            [link.student_parent_email, link.student_parent_name ?? null, link.student_parent_phone ?? null, parentPasswordHash, parentPassword, link.created_by ?? null],
          );
          parentIsNew = Boolean(parentInsertResult.rows[0]?.is_new);
        }

        await notifyCRM({
          event: 'enrollment_paid',
          crm_lead_id: String(link.crm_lead_id),
          crm_tenant_id: String(link.crm_tenant_id),
          amount_paise: Number(link.amount_paise),
          transaction_id: paymentId,
          selected_subjects: link.selected_subjects as string[],
        });

        // Create ONE general session credit pool (not per-subject).
        // minimum_sessions = TOTAL sessions across all subjects.
        // Only for per-class batches (1:1 and 1:3) — group batches (1:15, 1:30, 1:many, etc.)
        // use enrollment invoices and do NOT need per-session credits.
        const totalSessions = Number(link.minimum_sessions) || 50;
        const batchType = String(link.preferred_batch_type || 'one_to_one');
        const isPerClassEnrollment = batchType === 'one_to_one' || batchType === 'one_to_three';
        const totalPaid = Number(link.amount_paise) || 0;
        const feePerSession = totalSessions > 0 ? Math.round(totalPaid / totalSessions) : 0;

        if (isPerClassEnrollment && feePerSession > 0 && link.student_email) {
          try {
            const result = await createSessionCreditsFromEnrollment({
              studentEmail: String(link.student_email),
              batchType,
              totalSessions,
              feePerSessionPaise: feePerSession,
              currency: 'INR',
              enrollmentLinkId: String(link.id),
              invoiceId,
            });
            console.log(`[payment] Created general credit pool: ${result.creditsCreated ? totalSessions : 0} sessions for ${link.student_email}`);
          } catch (creditErr) {
            console.error('[payment] Session credit creation failed:', creditErr);
          }
        }

        // SPO Q1: set quarterly_due_date to Q2 scheduled_for date
        if (link.payment_plan === 'quarterly') {
          try {
            const q2Res = await db.query(
              `SELECT scheduled_for FROM invoices
               WHERE enrollment_link_id = $1 AND installment_number = 2
               LIMIT 1`,
              [String(link.id)],
            );
            if (q2Res.rows.length > 0) {
              const q2Date = (q2Res.rows[0] as { scheduled_for: string }).scheduled_for;
              await db.query(
                `UPDATE batch_students SET quarterly_due_date = $1
                 WHERE student_email = $2`,
                [q2Date, link.student_email],
              );
              console.log(`[payment] SPO Q1 paid — quarterly_due_date set to ${q2Date} for ${link.student_email}`);
            }
          } catch (e) {
            console.error('[payment] Failed to set quarterly_due_date after Q1:', e);
          }
        }

        // Send welcome emails with credentials
        const studentName = String(link.student_name || 'Student');
        if (studentIsNew) {
          const tpl = credentialsTemplate({
            recipientEmail: String(link.student_email),
            recipientName: studentName,
            role: 'Student',
            loginEmail: String(link.student_email),
            tempPassword: studentPassword,
            loginUrl: LOGIN_URL,
            additionalInfo: `Grade: ${link.student_grade || 'N/A'} | Board: ${link.student_board || 'N/A'}`,
          });
          await sendEmail({ to: String(link.student_email), ...tpl }).catch(e =>
            console.error('[payment] student welcome email failed:', e),
          );
        }
        if (parentIsNew && link.student_parent_email && parentPassword) {
          const tpl = credentialsTemplate({
            recipientEmail: String(link.student_parent_email),
            recipientName: String(link.student_parent_name || 'Parent'),
            role: 'Parent',
            loginEmail: String(link.student_parent_email),
            tempPassword: parentPassword,
            loginUrl: LOGIN_URL,
            additionalInfo: `Your child ${studentName} has been enrolled at stibe Classes.`,
          });
          await sendEmail({ to: String(link.student_parent_email), ...tpl }).catch(e =>
            console.error('[payment] parent welcome email failed:', e),
          );
        }
      }
    } catch (err) {
      console.error('[payment] enrollment CRM webhook failed:', err);
    }
  })();

  return result;
}

// ── Mock Payment (test mode) ────────────────────────────────

export async function mockCompletePayment(invoiceId: string) {
  const mockPaymentId = `mock_pay_${Date.now()}`;
  return completePayment(invoiceId, mockPaymentId, 'mock_gateway', { mock: true });
}

// ── Auto-flip overdue invoices ──────────────────────────────

export async function updateOverdueInvoices() {
  try {
    await db.query(
      `UPDATE invoices SET status = 'overdue', updated_at = NOW()
       WHERE status = 'pending' AND due_date < CURRENT_DATE`
    );
  } catch (err) {
    console.error('[payment] updateOverdueInvoices error:', err);
  }
}

// ── Get Invoices for Student ────────────────────────────────

export async function getStudentInvoices(studentEmail: string) {
  // Auto-flip pending invoices past due date to overdue
  await updateOverdueInvoices();
  const result = await db.query(
    `SELECT * FROM invoices
     WHERE student_email = $1
     ORDER BY created_at DESC`,
    [studentEmail]
  );
  return result.rows;
}

// ── Get Invoices for Parent ─────────────────────────────────

export async function getParentInvoices(parentEmail: string) {
  await updateOverdueInvoices();
  const result = await db.query(
    `SELECT i.* FROM invoices i
     WHERE i.parent_email = $1
        OR i.student_email IN (
          SELECT email FROM user_profiles WHERE parent_email = $1
        )
     ORDER BY i.created_at DESC`,
    [parentEmail]
  );
  return result.rows;
}

// ── Fee Structure CRUD ──────────────────────────────────────

export async function getFeeStructures() {
  const result = await db.query(
    `SELECT * FROM fee_structures WHERE is_active = true ORDER BY batch_type, grade`
  );
  return result.rows;
}

export async function createFeeStructure(input: {
  batchType: string;
  grade?: string;
  subject?: string;
  amountPaise: number;
  currency?: string;
  billingPeriod?: string;
  registrationFee?: number;
  securityDeposit?: number;
  createdBy: string;
}) {
  const result = await db.query(
    `INSERT INTO fee_structures (
       batch_type, grade, subject, amount_paise, currency,
       billing_period, registration_fee, security_deposit, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.batchType, input.grade || null, input.subject || null,
      input.amountPaise, input.currency || 'INR',
      input.billingPeriod || 'monthly',
      input.registrationFee || 0, input.securityDeposit || 0,
      input.createdBy,
    ]
  );
  return result.rows[0];
}

// 
// Session-Based Payment Helpers
// 

/**
 * Calculate session fee for a student joining a room.
 * Looks up session_fee_rates by batch/subject, calculates based on duration.
 */
export async function calculateSessionFee(roomId: string): Promise<{
  amountPaise: number;
  currency: string;
  perHourRate: number;
  durationMinutes: number;
} | null> {
  // First check if room has a pre-set session_fee_paise
  const roomResult = await db.query(
    `SELECT r.room_id, r.subject, r.grade, r.duration_minutes,
            r.session_fee_paise, r.payment_required, r.batch_id
     FROM rooms r
     WHERE r.room_id = $1`,
    [roomId]
  );
  if (roomResult.rows.length === 0) return null;

  const room = roomResult.rows[0] as Record<string, unknown>;
  const durationMinutes = Number(room.duration_minutes) || 60;

  // If room already has a session fee set, use it
  if (room.session_fee_paise && Number(room.session_fee_paise) > 0) {
    return {
      amountPaise: Number(room.session_fee_paise),
      currency: 'INR',
      perHourRate: Math.round(Number(room.session_fee_paise) / (durationMinutes / 60)),
      durationMinutes,
    };
  }

  // Look up rate from session_fee_rates table
  const batchId = room.batch_id as string | null;
  const subject = room.subject as string | null;
  const grade = room.grade as string | null;

  // Try: exact batch+subject match, then batch-only, then subject+grade, then subject-only
  const rateResult = await db.query(
    `SELECT per_hour_rate_paise, currency FROM session_fee_rates
     WHERE is_active = true
       AND (batch_id = $1 OR batch_id IS NULL)
       AND (subject = $2 OR subject IS NULL)
       AND (grade = $3 OR grade IS NULL)
     ORDER BY
       CASE WHEN batch_id = $1 AND subject = $2 THEN 0
            WHEN batch_id = $1 THEN 1
            WHEN subject = $2 AND grade = $3 THEN 2
            WHEN subject = $2 THEN 3
            ELSE 4 END
     LIMIT 1`,
    [batchId, subject, grade]
  );

  if (rateResult.rows.length === 0) return null;

  const rate = rateResult.rows[0] as Record<string, unknown>;
  const perHourRate = Number(rate.per_hour_rate_paise);
  // Flat per-session fee (rate IS the session fee, not hourly)
  const amountPaise = perHourRate;

  return {
    amountPaise,
    currency: (rate.currency as string) || 'INR',
    perHourRate,
    durationMinutes,
  };
}

/**
 * Check if a student has paid for a specific session.
 * Returns the payment record or null.
 */
export async function checkSessionPayment(roomId: string, studentEmail: string): Promise<{
  paid: boolean;
  invoiceId?: string;
  status?: string;
} > {
  const result = await db.query(
    `SELECT sp.status, sp.invoice_id
     FROM session_payments sp
     WHERE sp.room_id = $1 AND sp.student_email = $2
     LIMIT 1`,
    [roomId, studentEmail]
  );

  if (result.rows.length === 0) return { paid: false };

  const row = result.rows[0] as Record<string, unknown>;
  return {
    paid: row.status === 'paid' || row.status === 'prepaid',
    invoiceId: row.invoice_id as string | undefined,
    status: row.status as string,
  };
}

/**
 * Create a session-specific invoice and payment record.
 * Used when a student tries to join a session that requires payment.
 */
export async function createSessionInvoice(input: {
  roomId: string;
  roomName: string;
  subject: string;
  studentEmail: string;
  parentEmail?: string;
  amountPaise: number;
  currency: string;
  durationMinutes: number;
  scheduledStart: string;
}): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const invoiceNumber = await generateInvoiceNumber();
  const sessionDate = new Date(input.scheduledStart);
  const periodStart = sessionDate.toISOString().split('T')[0];
  const periodEnd = periodStart; // single day

  return db.withTransaction(async (client) => {
    // Create invoice
    const invResult = await client.query(
      `INSERT INTO invoices (
         invoice_number, student_email, parent_email, description,
         billing_period, period_start, period_end,
         amount_paise, currency, due_date, status
       ) VALUES ($1,$2,$3,$4,'session',$5,$6,$7,$8,$5,'pending')
       RETURNING id`,
      [
        invoiceNumber,
        input.studentEmail,
        input.parentEmail || null,
        `Session fee: ${input.roomName} (${input.subject}) - ${input.durationMinutes}min on ${periodStart}`,
        periodStart, periodEnd,
        input.amountPaise,
        input.currency,
      ]
    );

    const invoiceId = (invResult.rows[0] as Record<string, unknown>).id as string;

    // Create session payment record
    await client.query(
      `INSERT INTO session_payments (room_id, student_email, parent_email, invoice_id, amount_paise, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (room_id, student_email) DO UPDATE SET
         invoice_id = EXCLUDED.invoice_id, amount_paise = EXCLUDED.amount_paise`,
      [input.roomId, input.studentEmail, input.parentEmail || null, invoiceId, input.amountPaise, input.currency]
    );

    // Update room_assignments with invoice reference
    await client.query(
      `UPDATE room_assignments SET session_invoice_id = $1, payment_verified = false
       WHERE room_id = $2 AND participant_email = $3`,
      [invoiceId, input.roomId, input.studentEmail]
    );

    return { invoiceId, invoiceNumber };
  });
}

/**
 * Mark a session payment as complete (called after Razorpay callback).
 */
export async function completeSessionPayment(invoiceId: string, paymentId: string, paymentMethod?: string) {
  return db.withTransaction(async (client) => {
    // Update invoice
    await client.query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW(), transaction_id = $1, payment_method = $2
       WHERE id = $3`,
      [paymentId, paymentMethod || 'online', invoiceId]
    );

    // Update session_payments
    await client.query(
      `UPDATE session_payments SET status = 'paid', paid_at = NOW(), payment_method = $1, transaction_id = $2
       WHERE invoice_id = $3`,
      [paymentMethod || 'online', paymentId, invoiceId]
    );

    // Update room_assignments
    await client.query(
      `UPDATE room_assignments SET payment_verified = true, payment_status = 'paid'
       WHERE session_invoice_id = $1`,
      [invoiceId]
    );

    // Create receipt
    const receiptNumber = await generateReceiptNumber();
    const spResult = await client.query(
      `SELECT sp.*, i.amount_paise, i.currency FROM session_payments sp
       JOIN invoices i ON i.id = sp.invoice_id
       WHERE sp.invoice_id = $1 LIMIT 1`,
      [invoiceId]
    );
    if (spResult.rows.length > 0) {
      const sp = spResult.rows[0] as Record<string, unknown>;
      await client.query(
        `INSERT INTO payment_receipts (receipt_number, invoice_id, student_email, amount_paise, currency, payment_method, transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [receiptNumber, invoiceId, sp.student_email, sp.amount_paise, sp.currency, paymentMethod || 'online', paymentId]
      );
    }

    return { receiptNumber };
  });
}
// 
// Batch-Session-Based Fee Calculation (no room_id needed)
// 

/**
 * Calculate session fee for a batch session using session_fee_rates.
 * Works at schedule time — doesn't require a rooms row.
 */
export async function calculateBatchSessionFee(input: {
  batchId: string;
  subject: string;
  grade: string | null;
  durationMinutes: number;
}): Promise<{
  amountPaise: number;
  currency: string;
  perHourRate: number;
  durationMinutes: number;
} | null> {
  const { batchId, subject, grade, durationMinutes } = input;

  // Priority: exact batch+subject+grade → batch+subject → subject+grade → subject-only
  const rateResult = await db.query(
    `SELECT per_hour_rate_paise, currency FROM session_fee_rates
     WHERE is_active = true
       AND (batch_id = $1 OR batch_id IS NULL)
       AND (subject = $2 OR subject IS NULL)
       AND (grade = $3 OR grade IS NULL)
     ORDER BY
       CASE WHEN batch_id = $1 AND subject = $2 AND grade = $3 THEN 0
            WHEN batch_id = $1 AND subject = $2 THEN 1
            WHEN subject = $2 AND grade = $3 THEN 2
            WHEN subject = $2 THEN 3
            WHEN batch_id = $1 THEN 4
            ELSE 5 END
     LIMIT 1`,
    [batchId, subject, grade]
  );

  if (rateResult.rows.length === 0) return null;

  const rate = rateResult.rows[0] as Record<string, unknown>;
  const perHourRate = Number(rate.per_hour_rate_paise);
  // Flat per-session fee (rate IS the session fee, not hourly)
  const amountPaise = perHourRate;

  return {
    amountPaise,
    currency: (rate.currency as string) || 'INR',
    perHourRate,
    durationMinutes,
  };
}

/**
 * Generate COMBINED invoices for all sessions in a schedule group.
 * Instead of 1 invoice per session per student, creates 1 invoice per student
 * covering ALL sessions in the group. Each session still gets a session_payment row
 * for per-session tracking, but they all share the same invoice_id.
 *
 * Fee lookup priority:
 *   1. enrollment_fee_structure (region/board/batch_type/grade)
 *   2. session_fee_rates (batch/subject fallback)
 *
 * Session credit deduction:
 *   - If a student has prepaid session credits (from enrollment advance payment),
 *     those credits are consumed first per subject.
 *   - Only sessions that exceed the credit balance generate an invoice.
 *   - Fully-covered students get session_payment rows marked 'prepaid' (no invoice).
 *
 * When the combined invoice is paid, completePayment() marks ALL session_payments
 * for that invoice as paid — so per-session payment checks still work.
 */
export async function generateScheduleGroupInvoices(scheduleGroupId: string): Promise<{
  created: number;
  skipped: number;
  creditsCovered: number;
  sessionCount: number;
  totalAmount: { amountPaise: number; currency: string } | null;
}> {
  // 1. Fetch all sessions in this schedule group with batch info
  const sessionsRes = await db.query(
    `SELECT s.session_id, s.batch_id, s.subject, s.scheduled_date, s.start_time,
            s.duration_minutes, b.batch_name, b.grade, b.batch_type
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     WHERE s.schedule_group_id = $1
       AND s.status NOT IN ('ended', 'cancelled')
     ORDER BY s.scheduled_date, s.start_time`,
    [scheduleGroupId]
  );
  if (sessionsRes.rows.length === 0) return { created: 0, skipped: 0, creditsCovered: 0, sessionCount: 0, totalAmount: null };

  const sessions = sessionsRes.rows as Array<Record<string, unknown>>;
  const batchId = sessions[0].batch_id as string;
  const batchName = sessions[0].batch_name as string;
  const batchType = sessions[0].batch_type as string;
  const batchGrade = sessions[0].grade as string | null;

  // Group batches (one_to_fifteen, one_to_thirty, one_to_many, lecture, improvement_batch, one_to_five)
  // already have enrollment invoices created at enrollment time — do NOT generate session invoices.
  const isPerClassBatch = batchType === 'one_to_one' || batchType === 'one_to_three';
  if (!isPerClassBatch) {
    console.log(`[payment] generateScheduleGroupInvoices: skipping — batch ${batchId} is group type (${batchType}), invoices already created at enrollment`);
    return { created: 0, skipped: sessions.length, creditsCovered: 0, sessionCount: sessions.length, totalAmount: null };
  }

  // 2. Build per-session fee data (subject → sessionId[])
  const sessionsBySubject = new Map<string, Array<{ sessionId: string; date: string; time: string; duration: number }>>();
  for (const sess of sessions) {
    const subject = sess.subject as string;
    const rawDate = typeof sess.scheduled_date === 'object'
      ? (sess.scheduled_date as Date).toISOString().slice(0, 10)
      : String(sess.scheduled_date).slice(0, 10);
    if (!sessionsBySubject.has(subject)) sessionsBySubject.set(subject, []);
    sessionsBySubject.get(subject)!.push({
      sessionId: sess.session_id as string,
      date: rawDate,
      time: String(sess.start_time).slice(0, 5),
      duration: Number(sess.duration_minutes) || 90,
    });
  }

  // 2b. For annual fees: get total calendar sessions for proration
  //     (annual_fee / total_sessions_in_calendar = per-session rate)
  let totalCalendarSessions = 0;
  const calRunRes = await db.query(
    `SELECT c.id AS calendar_id
     FROM calendar_schedule_runs csr
     JOIN academic_calendars c ON c.id = csr.calendar_id
     WHERE csr.schedule_group_id = $1 LIMIT 1`,
    [scheduleGroupId]
  );
  if (calRunRes.rows.length > 0) {
    const calId = (calRunRes.rows[0] as Record<string, unknown>).calendar_id as string;
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM academic_calendar_sessions
       WHERE calendar_id = $1
         AND session_type IN ('session', 'special_class', 'exam_special', 'new_batch')`,
      [calId]
    );
    totalCalendarSessions = Number((countRes.rows[0] as Record<string, unknown>).cnt) || 0;
  }

  // 3. Fetch all students in the batch
  const studentsRes = await db.query(
    `SELECT bs.student_email, bs.parent_email,
            COALESCE(u.full_name, bs.student_email) AS student_name
     FROM batch_students bs
     LEFT JOIN portal_users u ON u.email = bs.student_email
     WHERE bs.batch_id = $1`,
    [batchId]
  );
  if (studentsRes.rows.length === 0) {
    return { created: 0, skipped: 0, creditsCovered: 0, sessionCount: sessions.length, totalAmount: null };
  }

  let created = 0;
  let skipped = 0;
  let creditsCoveredTotal = 0;
  let overallTotalPaise = 0;
  let currency = 'INR';

  // 4. Process each student individually (fees may differ by region/board)
  await db.withTransaction(async (client) => {
    for (const row of studentsRes.rows) {
      const student = row as { student_email: string; parent_email: string | null; student_name: string };

      // Skip if already has invoice for this schedule group
      const existing = await client.query(
        `SELECT id FROM invoices
         WHERE schedule_group_id = $1 AND student_email = $2`,
        [scheduleGroupId, student.student_email]
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      // Resolve student's profile for enrollment_fee_structure lookup
      const profile = await getStudentRegionGroup(student.student_email);
      // Prefer batchGrade (already normalized) over profile.grade which may be free-text like 'Class 8'
      const rawGrade = batchGrade || profile.grade || '10';
      const grade = rawGrade.replace(/[^0-9a-zA-Z]/g, ' ').trim().split(' ').pop() || rawGrade;

      // Calculate per-subject fees using enrollment_fee_structure first, then session_fee_rates
      let studentTotalPaise = 0;
      let studentCreditsCovered = 0;
      const sessionFees: Array<{
        sessionId: string; fee: number; subject: string; date: string;
        time: string; duration: number; perSessionRate: number; coveredByCredit: boolean;
      }> = [];

      // 4b. Fetch credits ONCE for the student before the subject loop.
      // Credits are always stored as subject='general' (not per-subject), so a single
      // fetch is correct. Fetching inside the loop causes each subject to see the full
      // credit balance, leading to over-coverage in multi-subject batches.
      const allStudentCredits = await getStudentSessionCredits(student.student_email, batchType);
      let creditsRemainingForStudent = allStudentCredits.reduce((sum, c) => sum + c.remaining, 0);

      for (const [subject, subjectSessions] of sessionsBySubject) {
        // 4a. Lookup fee rate: enrollment_fee_structure → session_fee_rates fallback
        let perSessionPaise = 0;
        let feeCurrency = 'INR';

        const enrollmentRate = await getEnrollmentFeeRate({
          regionGroup: profile.regionGroup,
          board: profile.board,
          batchType,
          grade,
        });

        if (enrollmentRate) {
          if (enrollmentRate.feeUnit === 'session' || enrollmentRate.feeUnit === 'per_class') {
            perSessionPaise = enrollmentRate.feePaise;
          } else if (enrollmentRate.feeUnit === 'year' || enrollmentRate.feeUnit === 'annual') {
            // Prorate annual fee evenly across all calendar sessions.
            // For manual/recurring schedules with no linked calendar, assume 200 sessions/year
            // (consistent with the 8 sessions/month fallback used for the 'monthly' fee unit).
            const annualSessions = totalCalendarSessions > 0 ? totalCalendarSessions : 200;
            perSessionPaise = Math.ceil(enrollmentRate.feePaise / annualSessions);
          } else if (enrollmentRate.feeUnit === 'monthly') {
            // Monthly fee: prorate over expected sessions per month (~total sessions ÷ 12).
            // If calendar sessions available use that; otherwise assume 8 sessions/month.
            const sessionsPerMonth = totalCalendarSessions > 0
              ? Math.max(1, Math.ceil(totalCalendarSessions / 12))
              : 8;
            perSessionPaise = Math.ceil(enrollmentRate.feePaise / sessionsPerMonth);
          }
          feeCurrency = enrollmentRate.currency;
        }

        if (perSessionPaise <= 0) {
          // Fallback to session_fee_rates (no enrollment fee match or missing calendar)
          const legacyRate = await calculateBatchSessionFee({
            batchId,
            subject,
            grade: batchGrade,
            durationMinutes: subjectSessions[0].duration,
          });
          if (legacyRate) {
            perSessionPaise = legacyRate.amountPaise;
            feeCurrency = legacyRate.currency;
          }
        }

        if (perSessionPaise <= 0) {
          // Final fallback: use fee_per_session_paise from student_session_credits
          // (set at manual enrollment time — most accurate rate for this student)
          const creditRate = await db.query<{ fee_per_session_paise: number }>(
            `SELECT fee_per_session_paise FROM student_session_credits
             WHERE student_email = $1 AND batch_type = $2 AND fee_per_session_paise > 0
             ORDER BY created_at DESC LIMIT 1`,
            [student.student_email, batchType]
          );
          if (creditRate.rows.length > 0) {
            perSessionPaise = creditRate.rows[0].fee_per_session_paise;
            console.log(`[payment] generateScheduleGroupInvoices: using credit rate fallback ${perSessionPaise} paise/session for ${student.student_email} (${subject})`);
          }
        }

        if (perSessionPaise <= 0) {
          console.log(`[payment] generateScheduleGroupInvoices: no fee rate found for student=${student.student_email} subject=${subject} batchType=${batchType} grade=${grade} — session skipped`);
          continue;
        }
        currency = feeCurrency;

        // 4c. Allocate credits from the shared pool (decrements across subjects).
        // Credits are stored as subject='general' so they apply to all subjects equally.
        const totalSubjectSessions = subjectSessions.length;
        const creditToUse = Math.min(creditsRemainingForStudent, totalSubjectSessions);
        creditsRemainingForStudent -= creditToUse;

        // Credits are NOT consumed at schedule time.
        // used_sessions is only incremented when a session ends (via deductSessionCreditsOnEnd).
        // Here we just track how many sessions are covered by credits for billing/description purposes.
        if (creditToUse > 0) {
          studentCreditsCovered += creditToUse;
        }

        // 4d. Build fee entries (mark which are credit-covered vs billable)
        for (let i = 0; i < subjectSessions.length; i++) {
          const s = subjectSessions[i];
          const coveredByCredit = i < creditToUse;
          const fee = coveredByCredit ? 0 : perSessionPaise;
          studentTotalPaise += fee;
          sessionFees.push({
            sessionId: s.sessionId, fee, subject,
            date: s.date, time: s.time, duration: s.duration,
            perSessionRate: perSessionPaise, coveredByCredit,
          });
        }
      }

      creditsCoveredTotal += studentCreditsCovered;

      // 4e. Build description with rate breakdown
      const subjects = [...new Set(sessionFees.map(f => f.subject))];
      const dates = sessionFees.map(f => f.date).sort();
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];
      const dateRange = dates.length > 1 ? `${firstDate} to ${lastDate}` : firstDate;

      const rateBreakdown = subjects.map(subj => {
        const items = sessionFees.filter(f => f.subject === subj);
        const total = items.length;
        const creditItems = items.filter(f => f.coveredByCredit).length;
        const billable = total - creditItems;
        const rate = items[0].perSessionRate;
        const subtotal = items.reduce((sum, i) => sum + i.fee, 0);

        let breakdown = `${subj}: ${total} session${total > 1 ? 's' : ''} @₹${(rate / 100).toFixed(0)}/session`;
        if (creditItems > 0) {
          breakdown += ` (${creditItems} prepaid`;
          if (billable > 0) breakdown += `, ${billable} billable = ₹${(subtotal / 100).toFixed(2)}`;
          breakdown += ')';
        } else {
          breakdown += ` = ₹${(subtotal / 100).toFixed(2)}`;
        }
        return breakdown;
      }).join(' | ');

      const description = `${batchName} — ${sessionFees.length} session${sessionFees.length > 1 ? 's' : ''} (${dateRange}) | ${rateBreakdown}`;

      // 4f. If student has no billable amount, just create session_payment rows marked 'prepaid'
      if (studentTotalPaise <= 0) {
        for (const sf of sessionFees) {
          const spExists = await client.query(
            `SELECT id FROM session_payments WHERE batch_session_id = $1 AND student_email = $2`,
            [sf.sessionId, student.student_email]
          );
          if (spExists.rows.length === 0) {
            await client.query(
              `INSERT INTO session_payments (batch_session_id, student_email, parent_email, amount_paise, currency, status)
               VALUES ($1, $2, $3, $4, $5, 'prepaid')`,
              [sf.sessionId, student.student_email, student.parent_email || null, sf.perSessionRate, currency]
            );
          }
        }
        // No invoice needed — all sessions covered by credits
        console.log(`[payment] generateScheduleGroupInvoices: all ${sessionFees.length} sessions prepaid by credits for ${student.student_email}, no invoice created`);
        continue;
      }

      // 4g. Generate invoice number
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const pattern = `INV-${year}${month}-%`;
      const invMaxRes = await client.query(
        `SELECT MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)) AS max_num
         FROM invoices WHERE invoice_number LIKE $1`,
        [pattern],
      );
      const invCount = (parseInt((invMaxRes.rows[0] as { max_num: string | null }).max_num || '0', 10) || 0) + 1;
      const invoiceNumber = `INV-${year}${month}-${String(invCount).padStart(5, '0')}`;

      // 4h. Create ONE combined invoice for this student (only billable amount)
      const invResult = await client.query(
        `INSERT INTO invoices (
           invoice_number, student_email, parent_email, description,
           billing_period, period_start, period_end,
           amount_paise, currency, due_date, status, schedule_group_id
         ) VALUES ($1,$2,$3,$4,'session_group',$5,$6,$7,$8,$5,'pending',$9)
         RETURNING id`,
        [
          invoiceNumber,
          student.student_email,
          student.parent_email || null,
          description,
          firstDate, lastDate,
          studentTotalPaise,
          currency,
          scheduleGroupId,
        ]
      );
      const invoiceId = (invResult.rows[0] as Record<string, unknown>).id as string;

      overallTotalPaise = Math.max(overallTotalPaise, studentTotalPaise);

      // 4i. Create session_payment row for EACH session
      for (const sf of sessionFees) {
        const spExists = await client.query(
          `SELECT id FROM session_payments WHERE batch_session_id = $1 AND student_email = $2`,
          [sf.sessionId, student.student_email]
        );
        if (spExists.rows.length === 0) {
          const status = sf.coveredByCredit ? 'prepaid' : 'pending';
          await client.query(
            `INSERT INTO session_payments (batch_session_id, student_email, parent_email, invoice_id, amount_paise, currency, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [sf.sessionId, student.student_email, student.parent_email || null,
             sf.coveredByCredit ? null : invoiceId,
             sf.coveredByCredit ? sf.perSessionRate : sf.fee,
             currency, status]
          );
        }
      }

      created++;
      console.log(`[payment] generateScheduleGroupInvoices: created invoice ${invoiceNumber} for ${student.student_email} — ${sessionFees.length} sessions, ₹${(studentTotalPaise/100).toFixed(0)} (${studentCreditsCovered} credit-covered)`);
    }
  });

  // Fire-and-forget: check and notify students with low/exhausted credits
  if (creditsCoveredTotal > 0) {
    const studentEmails = new Set(
      (studentsRes.rows as Array<{ student_email: string }>).map(r => r.student_email)
    );
    for (const email of studentEmails) {
      checkAndNotifyLowCredits(email, batchType).catch(() => {});
    }
  }

  return {
    created,
    skipped,
    creditsCovered: creditsCoveredTotal,
    sessionCount: sessions.length,
    totalAmount: overallTotalPaise > 0 ? { amountPaise: overallTotalPaise, currency } : null,
  };
}

/**
 * Link session_payments to a room when the room is created (teacher starts session).
 * Called from batch-sessions/[sessionId]/start to bridge the gap.
 */
export async function linkSessionPaymentsToRoom(sessionId: string, roomId: string): Promise<void> {
  await db.query(
    `UPDATE session_payments
     SET room_id = $1
     WHERE batch_session_id = $2 AND room_id IS NULL`,
    [roomId, sessionId]
  );
}

/**
 * Check if a student has paid for a specific batch session.
 * Works by batch_session_id (before room exists) or room_id (after room exists).
 */
export async function checkBatchSessionPayment(
  batchSessionId: string,
  studentEmail: string
): Promise<{ paid: boolean; invoiceId?: string; status?: string }> {
  const result = await db.query(
    `SELECT sp.status, sp.invoice_id
     FROM session_payments sp
     WHERE sp.batch_session_id = $1 AND sp.student_email = $2
     LIMIT 1`,
    [batchSessionId, studentEmail]
  );

  if (result.rows.length === 0) return { paid: false };

  const row = result.rows[0] as Record<string, unknown>;
  return {
    paid: row.status === 'paid' || row.status === 'prepaid',
    invoiceId: row.invoice_id as string | undefined,
    status: row.status as string,
  };
}

// ── Auto-adjust invoices for absent students ────────────────

/**
 * After a session ends and attendance is finalized, adjust pending invoices
 * for students who were absent:
 *
 * 1. Single-session invoice (only 1 active session_payment for this invoice) →
 *    cancel the entire invoice + session_payment.
 *
 * 2. Multi-session combined invoice (multiple active session_payments) →
 *    cancel that session_payment, reduce invoice amount by the session fee.
 *
 * Only acts on PENDING invoices — paid/cancelled invoices are untouched.
 */
export async function adjustInvoicesForAbsentStudents(roomId: string): Promise<{
  cancelled: number;
  reduced: number;
}> {
  let cancelled = 0;
  let reduced = 0;

  // Find the batch_session_id for this room
  const roomRes = await db.query(
    `SELECT batch_session_id FROM rooms WHERE room_id = $1 LIMIT 1`,
    [roomId]
  );
  if (roomRes.rows.length === 0) return { cancelled, reduced };
  const batchSessionId = (roomRes.rows[0] as Record<string, unknown>).batch_session_id as string | null;
  if (!batchSessionId) return { cancelled, reduced };

  // Find all absent students for this room
  const absentRes = await db.query(
    `SELECT participant_email FROM attendance_sessions
     WHERE room_id = $1 AND status = 'absent'`,
    [roomId]
  );
  if (absentRes.rows.length === 0) return { cancelled, reduced };

  const absentEmails = (absentRes.rows as Array<{ participant_email: string }>)
    .map(r => r.participant_email);

  for (const studentEmail of absentEmails) {
    // Find the session_payment for this session + student
    const spRes = await db.query(
      `SELECT sp.id, sp.invoice_id, sp.amount_paise, sp.status
       FROM session_payments sp
       WHERE sp.batch_session_id = $1 AND sp.student_email = $2
       LIMIT 1`,
      [batchSessionId, studentEmail]
    );
    if (spRes.rows.length === 0) continue;

    const sp = spRes.rows[0] as {
      id: string; invoice_id: string; amount_paise: number; status: string;
    };

    // Only adjust pending payments — never touch paid/cancelled
    if (sp.status !== 'pending') continue;

    // Check the invoice status
    const invRes = await db.query(
      `SELECT id, status, amount_paise FROM invoices WHERE id = $1 LIMIT 1`,
      [sp.invoice_id]
    );
    if (invRes.rows.length === 0) continue;
    const invoice = invRes.rows[0] as {
      id: string; status: string; amount_paise: number;
    };
    if (invoice.status !== 'pending') continue;

    // Count how many active (non-cancelled) session_payments share this invoice
    const countRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM session_payments
       WHERE invoice_id = $1 AND status != 'cancelled'`,
      [sp.invoice_id]
    );
    const activeSessions = parseInt((countRes.rows[0] as { cnt: string }).cnt, 10);

    await db.withTransaction(async (client) => {
      if (activeSessions <= 1) {
        // ── Single-session invoice → cancel both ──
        await client.query(
          `UPDATE session_payments SET status = 'cancelled' WHERE id = $1`,
          [sp.id]
        );
        await client.query(
          `UPDATE invoices SET status = 'cancelled' WHERE id = $1`,
          [sp.invoice_id]
        );
        cancelled++;
        console.log(`[payment] Cancelled invoice ${sp.invoice_id} — absent student ${studentEmail} (session ${batchSessionId})`);
      } else {
        // ── Multi-session invoice → reduce amount ──
        const newAmount = Math.max(invoice.amount_paise - sp.amount_paise, 0);

        await client.query(
          `UPDATE session_payments SET status = 'cancelled' WHERE id = $1`,
          [sp.id]
        );
        await client.query(
          `UPDATE invoices SET amount_paise = $1 WHERE id = $2`,
          [newAmount, sp.invoice_id]
        );
        reduced++;
        console.log(
          `[payment] Reduced invoice ${sp.invoice_id} by ₹${(sp.amount_paise / 100).toFixed(0)} — absent student ${studentEmail} (session ${batchSessionId}). New total: ₹${(newAmount / 100).toFixed(0)}`
        );
      }
    });
  }

  return { cancelled, reduced };
}

// ═══════════════════════════════════════════════════════════════
// Session Credits — prepaid session tracking
// ═══════════════════════════════════════════════════════════════

/**
 * Lookup the per-session fee from enrollment_fee_structure.
 * Uses the student's profile (region → region_group, board) + batch info (batch_type, grade).
 * Falls back to session_fee_rates if no enrollment_fee_structure match.
 */
export async function getEnrollmentFeeRate(input: {
  regionGroup: string;   // 'GCC' | 'Kerala'
  board: string;         // 'CBSE' | 'State Board'
  batchType: string;     // one_to_one, one_to_three, one_to_many, etc.
  grade: string;         // '8' | '9' | '10' | '11' | '12'
  academicYear?: string; // defaults to '2026-27'
}): Promise<{ feePaise: number; feeUnit: string; currency: string; isEarlyBird: boolean } | null> {
  const year = input.academicYear || '2026-27';
  const result = await db.query(
    `SELECT fee_paise, early_bird_fee_paise, offer_expires_at, fee_unit, currency
     FROM enrollment_fee_structure
     WHERE is_active = true
       AND academic_year = $1
       AND region_group = $2
       AND board = $3
       AND batch_type = $4
       AND grade = $5
     LIMIT 1`,
    [year, input.regionGroup, input.board, input.batchType, input.grade]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as {
    fee_paise: number;
    early_bird_fee_paise: number | null;
    offer_expires_at: string | null;
    fee_unit: string;
    currency: string;
  };
  // Use early bird fee if set and not expired
  const earlyBirdActive = row.early_bird_fee_paise != null
    && row.early_bird_fee_paise > 0
    && (!row.offer_expires_at || new Date(row.offer_expires_at) > new Date());
  const feePaise = earlyBirdActive ? row.early_bird_fee_paise! : row.fee_paise;
  return { feePaise, feeUnit: row.fee_unit, currency: row.currency, isEarlyBird: earlyBirdActive };
}

/**
 * Get remaining session credits for a student, grouped by subject.
 * Only returns active, non-expired credits with remaining > 0.
 */
export async function getStudentSessionCredits(
  studentEmail: string,
  batchType: string,
): Promise<Array<{
  id: string;
  subject: string;
  remaining: number;
  feePerSessionPaise: number;
  currency: string;
}>> {
  // Effective remaining = total_sessions - used_sessions - already_allocated_prepaid_not_ended
  //
  // used_sessions       = sessions that have already ended (deducted by deductSessionCreditsOnEnd)
  // already_allocated   = session_payments with status='prepaid' for sessions still scheduled/live
  //                       — these are credits committed to future sessions by a previous finalize-invoices run
  //
  // Subtracting already_allocated prevents the same credit from being used twice when the AO
  // creates a second schedule group before any sessions from the first group have ended.
  const result = await db.query(
    `WITH allocated AS (
       SELECT COUNT(*)::int AS cnt
       FROM session_payments sp
       JOIN batch_sessions bs ON bs.session_id = sp.batch_session_id
       JOIN batches b ON b.batch_id = bs.batch_id
       WHERE sp.student_email = $1
         AND b.batch_type = $2
         AND sp.status = 'prepaid'
         AND bs.status IN ('scheduled', 'live')
     )
     SELECT ssc.id, ssc.subject,
            GREATEST(0, ssc.total_sessions - ssc.used_sessions - (SELECT cnt FROM allocated))::int AS remaining,
            ssc.fee_per_session_paise, ssc.currency
     FROM student_session_credits ssc
     WHERE ssc.student_email = $1
       AND ssc.batch_type = $2
       AND ssc.is_active = true
       AND GREATEST(0, ssc.total_sessions - ssc.used_sessions - (SELECT cnt FROM allocated)) > 0
       AND (ssc.expires_at IS NULL OR ssc.expires_at > NOW())
     ORDER BY ssc.created_at ASC`,
    [studentEmail, batchType]
  );
  return result.rows as Array<{
    id: string; subject: string; remaining: number;
    feePerSessionPaise: number; currency: string;
  }>;
}

/**
 * Consume session credits for a student.
 * Updates used_sessions and logs to session_credit_ledger.
 * Returns the number of sessions actually consumed (may be less than requested if insufficient).
 */
export async function consumeSessionCredits(input: {
  studentEmail: string;
  subject: string;
  batchType: string;
  sessionsToConsume: number;
  invoiceId?: string;
  scheduleGroupId?: string;
  batchSessionIds?: string[];
}): Promise<{ consumed: number; creditId: string | null }> {
  const credits = await db.query(
    `SELECT id, (total_sessions - used_sessions) AS remaining
     FROM student_session_credits
     WHERE student_email = $1
       AND subject = $2
       AND batch_type = $3
       AND is_active = true
       AND (total_sessions - used_sessions) > 0
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at ASC
     FOR UPDATE`,
    [input.studentEmail, input.subject, input.batchType]
  );

  let remaining = input.sessionsToConsume;
  let totalConsumed = 0;
  let lastCreditId: string | null = null;

  for (const row of credits.rows as Array<{ id: string; remaining: number }>) {
    if (remaining <= 0) break;

    const consume = Math.min(remaining, row.remaining);
    await db.query(
      `UPDATE student_session_credits SET used_sessions = used_sessions + $1, updated_at = NOW() WHERE id = $2`,
      [consume, row.id]
    );

    await db.query(
      `INSERT INTO session_credit_ledger
         (credit_id, student_email, subject, sessions_consumed, invoice_id, schedule_group_id, batch_session_ids, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.id, input.studentEmail, input.subject, consume,
        input.invoiceId || null,
        input.scheduleGroupId || null,
        input.batchSessionIds || null,
        `Consumed ${consume} prepaid session(s) for ${input.subject}`,
      ]
    );

    totalConsumed += consume;
    remaining -= consume;
    lastCreditId = row.id;
  }

  return { consumed: totalConsumed, creditId: lastCreditId };
}

/**
 * Check remaining credits after consumption and send low-credit / exhausted
 * notifications to student and parent via email + WhatsApp.
 * Fire-and-forget — never throws.
 */
export async function checkAndNotifyLowCredits(studentEmail: string, batchType: string): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { sendLowCreditsWarning } = await import('@/lib/email');

    // Get general credit pool for this student (credits are no longer per-subject)
    const creditsRes = await db.query(
      `SELECT subject, total_sessions, used_sessions,
              (total_sessions - used_sessions) AS remaining
       FROM student_session_credits
       WHERE student_email = $1 AND subject = 'general' AND batch_type = $2 AND is_active = true
       ORDER BY created_at ASC`,
      [studentEmail, batchType]
    );
    const credits = creditsRes.rows as Array<{
      subject: string; total_sessions: number; used_sessions: number; remaining: number;
    }>;
    if (credits.length === 0) return;

    const totalRemaining = credits.reduce((s, c) => s + c.remaining, 0);
    const totalAllotted = credits.reduce((s, c) => s + c.total_sessions, 0);
    const totalUsed = credits.reduce((s, c) => s + c.used_sessions, 0);

    // Only notify at key thresholds: 5, 3, 1, 0
    if (totalRemaining > 5) return;

    // Check if we already sent a notification at this threshold recently (within 24h)
    const threshold = totalRemaining <= 0 ? 'exhausted' : `low_${totalRemaining}`;
    const recentNotif = await db.query(
      `SELECT id FROM notification_log
       WHERE recipient_email = $1 AND template_type = $2
         AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [studentEmail, `credits_${threshold}`]
    );
    if (recentNotif.rows.length > 0) return; // Already notified

    // Log this notification to prevent duplicates
    await db.query(
      `INSERT INTO notification_log (recipient_email, template_type, subject, channel)
       VALUES ($1, $2, $3, 'email')`,
      [studentEmail, `credits_${threshold}`, `Credits ${threshold} for ${studentEmail}`]
    ).catch(() => {}); // notification_log may not exist

    // Resolve student + parent names
    const userRes = await db.query(
      `SELECT full_name FROM portal_users WHERE email = $1`, [studentEmail]
    );
    const studentName = (userRes.rows[0] as { full_name: string } | undefined)?.full_name || studentEmail;

    const parentRes = await db.query(
      `SELECT bs.parent_email, COALESCE(u.full_name, bs.parent_email) AS parent_name
       FROM batch_students bs
       LEFT JOIN portal_users u ON u.email = bs.parent_email
       WHERE bs.student_email = $1 AND bs.parent_email IS NOT NULL
       LIMIT 1`,
      [studentEmail]
    );

    const isExhausted = totalRemaining <= 0;
    const renewLink = 'https://stibelearning.online/student#fees';
    const subjectBreakdown = credits.map(c => ({
      subject: c.subject, remaining: c.remaining, total: c.total_sessions,
    }));

    const baseData = {
      studentName,
      remainingCredits: totalRemaining,
      totalAllotted,
      usedCredits: totalUsed,
      subjectBreakdown,
      renewLink,
      isExhausted,
    };

    // Notify student
    sendLowCreditsWarning({
      ...baseData,
      recipientName: studentName,
      recipientEmail: studentEmail,
    }).catch(e => console.error('[payment] Low credit email to student failed:', e));

    // Notify parent if exists
    if (parentRes.rows.length > 0) {
      const parent = parentRes.rows[0] as { parent_email: string; parent_name: string };
      sendLowCreditsWarning({
        ...baseData,
        recipientName: parent.parent_name,
        recipientEmail: parent.parent_email,
        renewLink: 'https://stibelearning.online/parent#fees',
      }).catch(e => console.error('[payment] Low credit email to parent failed:', e));
    }

    console.log(`[payment] Low-credit notification sent: ${studentEmail} — ${totalRemaining}/${totalAllotted} remaining (${threshold})`);

    // Auto-generate top-up invoice when credits hit 0
    if (isExhausted) {
      // Find the enrollment_link_id from existing credits
      const linkRes = await db.query(
        `SELECT enrollment_link_id FROM student_session_credits
         WHERE student_email = $1 AND batch_type = $2 AND enrollment_link_id IS NOT NULL
         LIMIT 1`,
        [studentEmail, batchType],
      );
      const enrollmentLinkId = (linkRes.rows[0] as { enrollment_link_id?: string } | undefined)?.enrollment_link_id;
      generateCreditTopupInvoice({ studentEmail, batchType, enrollmentLinkId }).catch(() => {});
    }
  } catch (err) {
    console.error('[payment] checkAndNotifyLowCredits error:', err);
  }
}

/**
 * Create a single general session credit pool for a student after enrollment payment.
 * Credits are no longer per-subject — one pool covers all subjects in 1:1/1:3 batches.
 */
export async function createSessionCreditsFromEnrollment(input: {
  studentEmail: string;
  batchType: string;
  totalSessions: number;
  feePerSessionPaise: number;
  currency: string;
  enrollmentLinkId: string;
  invoiceId: string;
}): Promise<{ creditsCreated: number }> {
  // Avoid duplicates — check if credits already exist for this enrollment
  const existing = await db.query(
    `SELECT id FROM student_session_credits
     WHERE student_email = $1 AND subject = 'general' AND enrollment_link_id = $2`,
    [input.studentEmail, input.enrollmentLinkId]
  );
  if (existing.rows.length > 0) return { creditsCreated: 0 };

  await db.query(
    `INSERT INTO student_session_credits
       (student_email, subject, batch_type, total_sessions, fee_per_session_paise, currency,
        enrollment_link_id, invoice_id, source)
     VALUES ($1, 'general', $2, $3, $4, $5, $6, $7, 'enrollment')`,
    [
      input.studentEmail, input.batchType,
      input.totalSessions, input.feePerSessionPaise, input.currency,
      input.enrollmentLinkId, input.invoiceId,
    ]
  );
  return { creditsCreated: 1 };
}

/**
 * Consume exactly 1 general session credit when a session is assigned to a student.
 * Logs the session_id in session_credit_ledger.
 * Returns { consumed: true } if a credit was available, { consumed: false } if none left.
 */
export async function consumeOneGeneralCredit(input: {
  studentEmail: string;
  batchType: string;
  sessionId: string;
  source?: string; // if set, only consume credits with this source (e.g. 'invoice_payment')
}): Promise<{ consumed: boolean }> {
  const sourceFilter = input.source ? `AND source = $3` : '';
  const queryParams: unknown[] = [input.studentEmail, input.batchType];
  if (input.source) queryParams.push(input.source);

  const credits = await db.query(
    `SELECT id, (total_sessions - used_sessions) AS remaining
     FROM student_session_credits
     WHERE student_email = $1
       AND subject = 'general'
       AND batch_type = $2
       AND is_active = true
       AND (total_sessions - used_sessions) > 0
       AND (expires_at IS NULL OR expires_at > NOW())
       ${sourceFilter}
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE`,
    queryParams
  );
  if (credits.rows.length === 0) return { consumed: false };

  const row = credits.rows[0] as { id: string; remaining: number };
  await db.query(
    `UPDATE student_session_credits SET used_sessions = used_sessions + 1, updated_at = NOW() WHERE id = $1`,
    [row.id]
  );
  await db.query(
    `INSERT INTO session_credit_ledger
       (credit_id, student_email, subject, sessions_consumed, batch_session_ids, note)
     VALUES ($1, $2, 'general', 1, ARRAY[$3], $4)`,
    [row.id, input.studentEmail, input.sessionId, `1 general credit consumed for session ${input.sessionId}`]
  );
  return { consumed: true };
}

/**
 * Deduct one session credit per enrolled student when a batch_session ends.
 * This is the ONLY place where used_sessions is incremented (not at schedule time, not on join).
 * Called from:
 *   - PATCH /api/v1/batch-sessions/[sessionId] when status → 'ended'
 *   - POST /api/v1/webhook/livekit when room_finished causes batch_session → 'ended'
 */
export async function deductSessionCreditsOnEnd(sessionId: string): Promise<void> {
  try {
    // Find enrolled students in the batch for this session, scoped to credit-eligible batch types
    const enrolled = await db.query<{ student_email: string; batch_type: string }>(
      `SELECT bstu.student_email, b.batch_type
       FROM batch_sessions bs
       JOIN batches b ON b.batch_id = bs.batch_id
       JOIN batch_students bstu ON bstu.batch_id = bs.batch_id
       WHERE bs.session_id = $1
         AND b.batch_type IN ('one_to_one', 'one_to_three')`,
      [sessionId]
    );

    for (const row of enrolled.rows) {
      // Find the oldest active credit row with remaining balance
      const creditRes = await db.query<{ id: string }>(
        `SELECT id FROM student_session_credits
         WHERE student_email = $1
           AND is_active = true
           AND (total_sessions - used_sessions) > 0
         ORDER BY created_at ASC
         LIMIT 1`,
        [row.student_email]
      );
      if (creditRes.rows.length === 0) continue;

      const creditId = creditRes.rows[0].id;
      await db.query(
        `UPDATE student_session_credits
         SET used_sessions = used_sessions + 1, updated_at = NOW()
         WHERE id = $1`,
        [creditId]
      );
      // Ledger entry: record which session caused this deduction
      await db.query(
        `INSERT INTO session_credit_ledger
           (credit_id, student_email, subject, sessions_consumed, batch_session_ids, note)
         VALUES ($1, $2, 'general', 1, ARRAY[$3::text], 'Deducted on session end')
         ON CONFLICT DO NOTHING`,
        [creditId, row.student_email, sessionId]
      );
    }
  } catch (err) {
    // Non-critical — log but don't fail the session-end flow
    console.error('[payment] deductSessionCreditsOnEnd error for session', sessionId, err);
  }
}

/**
 * Resolve region_group from a student's assigned_region via user_profiles.
 * Returns 'GCC' or 'Kerala' (defaults to 'Kerala').
 */
export async function getStudentRegionGroup(studentEmail: string): Promise<{
  regionGroup: string;
  board: string;
  grade: string | null;
}> {
  const result = await db.query(
    `SELECT assigned_region, board, grade FROM user_profiles WHERE email = $1`,
    [studentEmail]
  );
  if (result.rows.length === 0) return { regionGroup: 'Kerala', board: 'CBSE', grade: null };
  const profile = result.rows[0] as { assigned_region: string | null; board: string | null; grade: string | null };

  const GCC_REGIONS = new Set([
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
    'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  ]);
  const regionGroup = profile.assigned_region && GCC_REGIONS.has(profile.assigned_region) ? 'GCC' : 'Kerala';
  return {
    regionGroup,
    board: profile.board || 'CBSE',
    grade: profile.grade,
  };
}

// ── Quarterly Payment Helpers ──────────────────────────────────

/**
 * Advance a student's quarterly_due_date by exactly 3 months.
 * Called by AO after confirming the quarterly payment from the student.
 * Returns the new due date.
 */
export async function advanceQuarterlyDueDate(
  batchId: string,
  studentEmail: string,
): Promise<Date> {
  const res = await db.query<{ quarterly_due_date: string }>(
    `UPDATE batch_students
     SET quarterly_due_date = quarterly_due_date + INTERVAL '3 months'
     WHERE batch_id = $1 AND student_email = $2 AND quarterly_due_date IS NOT NULL
     RETURNING quarterly_due_date`,
    [batchId, studentEmail]
  );
  if (res.rows.length === 0) {
    throw new Error(`No quarterly_due_date set for student ${studentEmail} in batch ${batchId}`);
  }
  return new Date(res.rows[0].quarterly_due_date);
}

/**
 * Set the initial quarterly_due_date for a student.
 * AO calls this when enrolling a student on a quarterly payment plan.
 */
export async function setQuarterlyDueDate(
  batchId: string,
  studentEmail: string,
  dueDate: Date,
): Promise<void> {
  await db.query(
    `UPDATE batch_students SET quarterly_due_date = $1
     WHERE batch_id = $2 AND student_email = $3`,
    [dueDate.toISOString().split('T')[0], batchId, studentEmail]
  );
}

// ── SPO Scheduled Invoice Helpers ─────────────────────────────

export interface CreateScheduledInvoiceInput {
  enrollmentLinkId: string;
  studentEmail: string;
  parentEmail?: string;
  installmentNumber: number;
  amountPaise: number;
  currency?: string;
  scheduledFor: string; // ISO date
  description: string;
}

/**
 * Create a future SPO installment invoice with status='scheduled'.
 * The cron job activates these to 'pending' when scheduled_for <= today+7.
 */
export async function createScheduledInvoice(input: CreateScheduledInvoiceInput): Promise<{ id: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      const result = await db.query(
        `INSERT INTO invoices (
           invoice_number, student_email, parent_email, description,
           billing_period, period_start, period_end,
           amount_paise, currency, due_date, status,
           enrollment_link_id, installment_number, scheduled_for
         ) VALUES ($1,$2,$3,$4,'enrollment',$5,$5,$6,$7,$5,'scheduled',$8,$9,$10)
         RETURNING id`,
        [
          invoiceNumber,
          input.studentEmail,
          input.parentEmail || null,
          input.description,
          input.scheduledFor,
          input.amountPaise,
          input.currency || 'INR',
          input.enrollmentLinkId,
          input.installmentNumber,
          input.scheduledFor,
        ],
      );
      return result.rows[0] as { id: string };
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      if (pgErr.code === '23505' && pgErr.constraint === 'invoices_invoice_number_key' && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique invoice number for scheduled installment');
}

/**
 * Generate a credit top-up invoice for a per-class student whose credits are exhausted.
 * Uses the fee_per_session from the student's existing general credit and the original pack size.
 * Sends payment link via email. Does NOT add credits yet — credits added after payment.
 */
export async function generateCreditTopupInvoice(input: {
  studentEmail: string;
  batchType: string;
  enrollmentLinkId?: string;
}): Promise<{ invoiceId: string; payUrl: string } | null> {
  try {
    // Avoid duplicate: check if there's already an unpaid top-up invoice
    const existing = await db.query(
      `SELECT id FROM invoices
       WHERE student_email = $1 AND is_topup = true AND status IN ('pending', 'overdue', 'scheduled')
       LIMIT 1`,
      [input.studentEmail],
    );
    if (existing.rows.length > 0) {
      console.log(`[payment] Top-up invoice already exists for ${input.studentEmail}`);
      return null;
    }

    // Get fee_per_session and original pack size from the student's general credit record
    const creditRes = await db.query(
      `SELECT total_sessions, fee_per_session_paise, currency, enrollment_link_id
       FROM student_session_credits
       WHERE student_email = $1 AND subject = 'general' AND batch_type = $2
         AND source = 'enrollment' AND is_active = true
       ORDER BY created_at ASC LIMIT 1`,
      [input.studentEmail, input.batchType],
    );

    let topupSessions: number;
    let perSessionPaise: number;
    let currency = 'INR';
    let enrollmentLinkId = input.enrollmentLinkId || null;

    if (creditRes.rows.length > 0) {
      const cr = creditRes.rows[0] as {
        total_sessions: number; fee_per_session_paise: number; currency: string; enrollment_link_id?: string;
      };
      topupSessions = cr.total_sessions;   // same pack size as original enrollment
      perSessionPaise = cr.fee_per_session_paise;
      currency = cr.currency || 'INR';
      enrollmentLinkId = enrollmentLinkId || cr.enrollment_link_id || null;
    } else {
      // Fallback: no existing credits — cannot determine fee
      console.warn(`[payment] generateCreditTopupInvoice: no general credits for ${input.studentEmail}`);
      return null;
    }

    const totalPaise = perSessionPaise * topupSessions;

    const today = new Date().toISOString().slice(0, 10);
    const invoice = await createInvoice({
      studentEmail: input.studentEmail,
      description: `Session credits top-up — ${topupSessions} sessions (${input.batchType})`,
      billingPeriod: 'one_time',
      periodStart: today,
      periodEnd: today,
      amountPaise: totalPaise,
      currency: currency as 'INR',
      dueDate: today,
    });

    // Mark as top-up
    await db.query(
      `UPDATE invoices SET is_topup = true, topup_sessions = $1, enrollment_link_id = $2 WHERE id = $3`,
      [topupSessions, enrollmentLinkId, invoice.id],
    );

    const { buildPayUrl } = await import('@/lib/pay-token');
    const payUrl = buildPayUrl(String(invoice.id));

    // Send email to student
    const { sendEmail } = await import('@/lib/email');
    const userRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [input.studentEmail]);
    const studentName = (userRes.rows[0] as { full_name: string } | undefined)?.full_name || input.studentEmail;

    await sendEmail({
      to: input.studentEmail,
      subject: 'stibe — Session Credits Exhausted — Renew to Continue',
      html: `
        <p>Dear ${studentName},</p>
        <p>Your session credits have been exhausted. To continue attending classes, please renew your credits.</p>
        <p><strong>Top-up: ${topupSessions} sessions — ${formatAmount(totalPaise, currency)}</strong></p>
        <p><a href="${payUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Pay Now</a></p>
        <p>After payment, your credits will be replenished and you can join sessions immediately.</p>
      `,
      text: `Your stibe session credits are exhausted. Renew ${topupSessions} sessions for ${formatAmount(totalPaise, currency)}: ${payUrl}`,
    }).catch(e => console.error('[payment] top-up email failed:', e));

    console.log(`[payment] Generated top-up invoice ${invoice.id} for ${input.studentEmail}`);
    return { invoiceId: String(invoice.id), payUrl };
  } catch (err) {
    console.error('[payment] generateCreditTopupInvoice error:', err);
    return null;
  }
}

// ── Internal helpers for post-payment SPO & top-up logic ─────

/**
 * After an SPO Q2/Q3/Q4 installment is paid:
 * - If Q4 → clear quarterly_due_date (no more gating)
 * - Otherwise → advance quarterly_due_date to next installment's scheduled_for
 */
async function _handleSpoInstallmentPaid(
  installmentNumber: number,
  enrollmentLinkId: string | null,
  studentEmail: string,
): Promise<void> {
  if (!enrollmentLinkId) return;

  const isLastInstallment = installmentNumber >= 4;
  if (isLastInstallment) {
    // Q4 paid — clear gate for the year
    await db.query(
      `UPDATE batch_students SET quarterly_due_date = NULL WHERE student_email = $1`,
      [studentEmail],
    );
    console.log(`[payment] SPO Q4 paid — quarterly_due_date cleared for ${studentEmail}`);
    return;
  }

  // Find the next installment's scheduled_for
  const nextNum = installmentNumber + 1;
  const nextRes = await db.query(
    `SELECT scheduled_for FROM invoices
     WHERE enrollment_link_id = $1 AND installment_number = $2
     LIMIT 1`,
    [enrollmentLinkId, nextNum],
  );
  if (nextRes.rows.length === 0) return;

  const nextDate = (nextRes.rows[0] as { scheduled_for: string }).scheduled_for;

  // Scope the update to only the batch whose quarterly_due_date matches the current
  // installment's scheduled_for (the date that was set when the previous installment was paid).
  // This prevents cross-batch contamination when a student is enrolled in multiple SPO batches.
  const currentInstRes = await db.query(
    `SELECT scheduled_for FROM invoices
     WHERE enrollment_link_id = $1 AND installment_number = $2
     LIMIT 1`,
    [enrollmentLinkId, installmentNumber],
  );
  const currentScheduledFor = currentInstRes.rows.length > 0
    ? (currentInstRes.rows[0] as { scheduled_for: string }).scheduled_for
    : null;

  if (currentScheduledFor) {
    await db.query(
      `UPDATE batch_students SET quarterly_due_date = $1
       WHERE student_email = $2 AND quarterly_due_date::date = $3::date`,
      [nextDate, studentEmail, currentScheduledFor],
    );
  } else {
    // Fallback: update all batches for this student (original behavior)
    await db.query(
      `UPDATE batch_students SET quarterly_due_date = $1 WHERE student_email = $2`,
      [nextDate, studentEmail],
    );
  }
  console.log(`[payment] SPO Q${installmentNumber} paid — quarterly_due_date advanced to ${nextDate} for ${studentEmail}`);
}

/**
 * After a top-up invoice is paid: add general session credits and retroactively
 * consume them for any assigned-but-uncovered sessions in the student's 1:1/1:3 batches.
 */
async function _handleTopupInvoicePaid(
  invoiceId: string,
  studentEmail: string,
  topupSessions: number,
  enrollmentLinkId: string | null,
): Promise<void> {
  // Get batch_type from existing credits
  const creditsRes = await db.query(
    `SELECT DISTINCT batch_type, fee_per_session_paise, currency
     FROM student_session_credits
     WHERE student_email = $1 AND subject = 'general' AND is_active = true
     ORDER BY batch_type LIMIT 1`,
    [studentEmail],
  );
  if (creditsRes.rows.length === 0) return;

  const row = creditsRes.rows[0] as { batch_type: string; fee_per_session_paise: number; currency: string };
  const batchType = row.batch_type;
  const currency = row.currency || 'INR';

  // Insert one general credit pack
  await db.query(
    `INSERT INTO student_session_credits
       (student_email, subject, batch_type, total_sessions, fee_per_session_paise, currency,
        enrollment_link_id, invoice_id, source)
     VALUES ($1, 'general', $2, $3, $4, $5, $6, $7, 'top_up')`,
    [
      studentEmail, batchType, topupSessions,
      row.fee_per_session_paise, currency,
      enrollmentLinkId || null, invoiceId,
    ],
  );
  console.log(`[payment] Top-up: added ${topupSessions} general credits for ${studentEmail}`);

  // Retroactively consume credits for sessions that were assigned but not credit-covered yet.
  // These are sessions in the student's 1:1/1:3 batches whose session_id is NOT in the ledger.
  try {
    const uncoveredRes = await db.query(
      `SELECT bs.session_id
       FROM batch_sessions bs
       JOIN batches b ON b.batch_id = bs.batch_id
       JOIN batch_students bstu ON bstu.batch_id = b.batch_id AND bstu.student_email = $1
       WHERE b.batch_type = $2
         AND bs.status IN ('scheduled', 'live', 'completed')
         AND bs.session_id NOT IN (
           SELECT unnest(batch_session_ids) FROM session_credit_ledger WHERE student_email = $1
         )
       ORDER BY bs.scheduled_date ASC
       LIMIT $3`,
      [studentEmail, batchType, topupSessions],
    );

    for (const s of uncoveredRes.rows as Array<{ session_id: string }>) {
      await consumeOneGeneralCredit({ studentEmail, batchType, sessionId: s.session_id });
    }
    if (uncoveredRes.rows.length > 0) {
      console.log(`[payment] Retroactively covered ${uncoveredRes.rows.length} sessions for ${studentEmail}`);
    }
  } catch (e) {
    console.error('[payment] Retroactive credit coverage error:', e);
  }
}

/**
 * When a student is added to a batch that already has scheduled (not-yet-ended)
 * sessions, generate invoices / prepaid credit records for those sessions.
 *
 * How it works:
 *   1. Finds all distinct schedule_group_ids from scheduled/live sessions in the batch.
 *   2. Calls generateScheduleGroupInvoices for each group.
 *      - The dedup guard inside that function skips students who already have an invoice
 *        for the group, so existing students are not touched.
 *   3. Sessions without a schedule_group_id (created before the group concept) get a
 *      shared synthetic group_id assigned first, then invoiced.
 *
 * Called fire-and-forget after INSERT into batch_students.
 */
export async function backfillSessionInvoicesForStudents(
  batchId: string,
  studentEmails: string[],
): Promise<void> {
  if (studentEmails.length === 0) return;

  try {
    // Check batch type — only 1:1 and 1:3 use per-session invoices
    const batchRes = await db.query<{ batch_type: string }>(
      `SELECT batch_type FROM batches WHERE batch_id = $1`,
      [batchId]
    );
    if (batchRes.rows.length === 0) return;
    const batchType = batchRes.rows[0].batch_type;
    if (batchType !== 'one_to_one' && batchType !== 'one_to_three') return;

    // Find all scheduled/live sessions for this batch that haven't ended
    const sessionsRes = await db.query<{ session_id: string; schedule_group_id: string | null }>(
      `SELECT session_id, schedule_group_id
       FROM batch_sessions
       WHERE batch_id = $1 AND status IN ('scheduled', 'live')
       ORDER BY scheduled_date ASC`,
      [batchId]
    );
    if (sessionsRes.rows.length === 0) return;

    // Group sessions by schedule_group_id. Sessions with NULL get a new synthetic group.
    const groups = new Map<string, string[]>(); // groupId → session_ids
    const ungrouped: string[] = [];
    for (const row of sessionsRes.rows) {
      if (row.schedule_group_id) {
        const arr = groups.get(row.schedule_group_id) ?? [];
        arr.push(row.session_id);
        groups.set(row.schedule_group_id, arr);
      } else {
        ungrouped.push(row.session_id);
      }
    }

    // Assign a synthetic group_id to ungrouped sessions (so finalize-invoices can batch them)
    if (ungrouped.length > 0) {
      const syntheticGroupId = crypto.randomUUID();
      await db.query(
        `UPDATE batch_sessions SET schedule_group_id = $1
         WHERE session_id = ANY($2::text[])`,
        [syntheticGroupId, ungrouped]
      );
      groups.set(syntheticGroupId, ungrouped);
    }

    // Run generateScheduleGroupInvoices for each group.
    // Dedup inside that function ensures existing students are skipped.
    for (const groupId of groups.keys()) {
      await generateScheduleGroupInvoices(groupId);
    }

    console.log(
      `[payment] backfillSessionInvoicesForStudents: batch=${batchId}, students=${studentEmails.join(',')}, groups=${groups.size}`
    );
  } catch (err) {
    console.error('[payment] backfillSessionInvoicesForStudents error:', err);
  }
}