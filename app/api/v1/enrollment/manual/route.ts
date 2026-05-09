import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateInvoiceNumber, generateReceiptNumber, backfillSessionInvoicesForStudents } from '@/lib/payment';
import { sendEmail, sendPaymentReceipt } from '@/lib/email';
import { credentialsTemplate } from '@/lib/email-templates';
import bcrypt from 'bcryptjs';
import { getPlatformName } from '@/lib/platform-config';

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const LOGIN_URL = `${PORTAL_URL}/login`;

const FLAT_FEE_BATCH_TYPES = new Set(['improvement_batch', 'special', 'custom', 'lecture']);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/v1/enrollment/manual
 * AO / Owner manually enrolls a student into a batch with optional offline payment recording.
 *
 * Body:
 *   student_name       string (required)
 *   student_email      string (required — used as login; generate a placeholder if none)
 *   student_phone      string
 *   student_grade      string
 *   student_board      string
 *   student_section    string
 *   student_dob        string (YYYY-MM-DD)
 *   parent_name        string
 *   parent_email       string
 *   parent_phone       string
 *   batch_id           string (required)
 *   payment_mode       'none' | 'advance' | 'full'
 *   payment_method     'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'
 *   amount_paise       number  (0 for none)
 *   transaction_ref    string  (receipt/UTR/cheque number)
 *   notes              string
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !['academic_operator', 'academic', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;

    const studentName  = String(body.student_name  || '').trim();
    const studentEmail = String(body.student_email || '').trim().toLowerCase();
    const studentPhone = String(body.student_phone || '').trim();
    const studentGrade = String(body.student_grade || '').trim();
    const studentBoard = String(body.student_board || '').trim();
    const studentSection  = String(body.student_section  || '').trim();
    const studentWhatsapp = String(body.student_whatsapp || '').trim() || null;
    const studentDob   = String(body.student_dob   || '').trim() || null;
    const studentPassword = String(body.student_password || '').trim();
    const studentRegion   = String(body.student_region   || '').trim() || null;
    const studentCategory = String(body.student_category || '').trim() || null;

    const parentName  = String(body.parent_name  || '').trim();
    const parentEmail = String(body.parent_email || '').trim().toLowerCase() || null;
    const parentPhone = String(body.parent_phone || '').trim();
    const parentPassword = String(body.parent_password || '').trim();

    const batchId       = String(body.batch_id || '').trim();
    const paymentMode   = String(body.payment_mode   || 'none') as 'none' | 'advance' | 'full';
    const paymentMethod = String(body.payment_method || 'cash');
    const amountPaise   = Math.max(0, parseInt(String(body.amount_paise || 0), 10));
    const transactionRef = String(body.transaction_ref || '').trim() || null;
    const notes         = String(body.notes || '').trim() || null;
    const skipPaymentGate = body.skip_payment_gate === true;
    const paymentPlan = (body.payment_plan === 'quarterly') ? 'quarterly' : 'otp';
    const paymentType = (['otp', 'spo'].includes(String(body.payment_type)) ? String(body.payment_type) : (paymentPlan === 'quarterly' ? 'spo' : 'otp')) as 'otp' | 'spo';
    const feeOtpPaise = Math.max(0, parseInt(String(body.fee_otp_paise || 0), 10));
    const feeSpoQ123Paise = Math.max(0, parseInt(String(body.fee_spo_q123_paise || 0), 10));
    const feeSpoQ4Paise = Math.max(0, parseInt(String(body.fee_spo_q4_paise || 0), 10));
    const preferredBatchType = String(body.preferred_batch_type || '').trim() || null;
    // Session-based advance sessions (1:1 / 1:3 only)
    const minimumSessions = Math.max(0, parseInt(String(body.minimum_sessions || 0), 10));

    if (!studentName) return NextResponse.json<ApiResponse>({ success: false, error: 'Student name is required' }, { status: 400 });
    if (!studentEmail) return NextResponse.json<ApiResponse>({ success: false, error: 'Student email is required' }, { status: 400 });

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid student email address' }, { status: 400 });
    }

    if (paymentMode !== 'none' && amountPaise <= 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Amount must be greater than 0 when payment is recorded' }, { status: 400 });
    }

    // Validate batch if provided
    let batch: Record<string, unknown> | null = null;
    let sessionsCredited = 0;
    if (batchId) {
      const batchRes = await db.query(
        `SELECT batch_id, batch_name, batch_type, grade, board, subjects FROM batches WHERE batch_id = $1`,
        [batchId]
      );
      if (batchRes.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Batch not found' }, { status: 404 });
      }
      batch = batchRes.rows[0] as Record<string, unknown>;
    }

    const result = await db.withTransaction(async (client) => {
      // ── 1. Create / upsert student portal_user ──────────────
      const existingStudent = await client.query<{ email: string; portal_role: string }>(
        `SELECT email, portal_role FROM portal_users WHERE email = $1`,
        [studentEmail]
      );

      let studentIsNew = false;
      let actualStudentPassword: string | null = null;

      if (existingStudent.rows.length === 0) {
        studentIsNew = true;
        // New student — use provided password or generate a default
        const platformNameForPass = await getPlatformName();
        const plainPass = studentPassword || `${platformNameForPass}@${Math.floor(1000 + Math.random() * 9000)}`;
        actualStudentPassword = plainPass;
        const hash = await bcrypt.hash(plainPass, 10);
        await client.query(
          `INSERT INTO portal_users (email, full_name, portal_role, phone, password_hash, plain_password, is_active, created_by)
           VALUES ($1, $2, 'student', $3, $4, $5, true, $6)
           ON CONFLICT (email) DO NOTHING`,
          [studentEmail, studentName, studentPhone || null, hash, plainPass, user.id]
        );
        // Create user_profile
        await client.query(
          `INSERT INTO user_profiles (email, phone, whatsapp, date_of_birth, grade, board, section, parent_email, assigned_region, category, preferred_batch_type, admission_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE)
           ON CONFLICT (email) DO UPDATE SET
             phone = COALESCE(EXCLUDED.phone, user_profiles.phone),
             whatsapp = COALESCE(EXCLUDED.whatsapp, user_profiles.whatsapp),
             grade = COALESCE(NULLIF(EXCLUDED.grade,''), user_profiles.grade),
             board = COALESCE(NULLIF(EXCLUDED.board,''), user_profiles.board),
             section = COALESCE(NULLIF(EXCLUDED.section,''), user_profiles.section),
             assigned_region = COALESCE(EXCLUDED.assigned_region, user_profiles.assigned_region),
             category = COALESCE(EXCLUDED.category, user_profiles.category),
             preferred_batch_type = COALESCE(EXCLUDED.preferred_batch_type, user_profiles.preferred_batch_type),
             parent_email = COALESCE(EXCLUDED.parent_email, user_profiles.parent_email)`,
          [studentEmail, studentPhone || null, studentWhatsapp, studentDob, studentGrade || null, studentBoard || null, studentSection || null, parentEmail, studentRegion, studentCategory, preferredBatchType]
        );
      } else {
        // Existing user — update profile if new info provided
        await client.query(
          `INSERT INTO user_profiles (email, phone, whatsapp, grade, board, section, assigned_region, category, preferred_batch_type, parent_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (email) DO UPDATE SET
             phone = COALESCE(NULLIF(EXCLUDED.phone,''), user_profiles.phone),
             whatsapp = COALESCE(EXCLUDED.whatsapp, user_profiles.whatsapp),
             grade = COALESCE(NULLIF(EXCLUDED.grade,''), user_profiles.grade),
             board = COALESCE(NULLIF(EXCLUDED.board,''), user_profiles.board),
             section = COALESCE(NULLIF(EXCLUDED.section,''), user_profiles.section),
             assigned_region = COALESCE(EXCLUDED.assigned_region, user_profiles.assigned_region),
             category = COALESCE(EXCLUDED.category, user_profiles.category),
             preferred_batch_type = COALESCE(EXCLUDED.preferred_batch_type, user_profiles.preferred_batch_type),
             parent_email = COALESCE(EXCLUDED.parent_email, user_profiles.parent_email)`,
          [studentEmail, studentPhone || null, studentWhatsapp, studentGrade || null, studentBoard || null, studentSection || null, studentRegion, studentCategory, preferredBatchType, parentEmail]
        );
      }

      // ── 2. Create / upsert parent if provided ───────────────
      let resolvedParentEmail = parentEmail;
      let parentIsNew = false;
      let actualParentPassword: string | null = null;

      if (parentEmail && parentName) {
        const existingParent = await client.query<{ email: string; portal_role: string }>(
          `SELECT email, portal_role FROM portal_users WHERE email = $1`,
          [parentEmail]
        );
        if (existingParent.rows.length === 0) {
          parentIsNew = true;
          const platformNameForParentPass = await getPlatformName();
          const plainParentPass = parentPassword || `${platformNameForParentPass}@${Math.floor(1000 + Math.random() * 9000)}`;
          actualParentPassword = plainParentPass;
          const parentHash = await bcrypt.hash(plainParentPass, 10);
          await client.query(
            `INSERT INTO portal_users (email, full_name, portal_role, phone, password_hash, plain_password, is_active)
             VALUES ($1, $2, 'parent', $3, $4, $5, true)
             ON CONFLICT (email) DO NOTHING`,
            [parentEmail, parentName, parentPhone || null, parentHash, plainParentPass]
          );
        } else if (existingParent.rows[0].portal_role !== 'parent') {
          throw new Error(`${parentEmail} is already a registered ${existingParent.rows[0].portal_role} account. Please use a different email for the parent/guardian.`);
        }
        resolvedParentEmail = parentEmail;
      }

      // ── 3. Determine effective batch type ────────────────────
      // Works without specific batch selection — falls back to preferred_batch_type from step 2.
      const batchTypeStr = batch ? String(batch.batch_type) : (preferredBatchType || '');
      const isPerClassBatch = batchTypeStr === 'one_to_one' || batchTypeStr === 'one_to_three';
      const isGroupBatch = !!batchId && batch !== null && !isPerClassBatch && !FLAT_FEE_BATCH_TYPES.has(batchTypeStr);

      let invoiceNumber: string | null = null;
      let receiptNumber: string | null = null;
      let capturedInvoiceId: string | null = null;

      // ── 4. Add to batch_students (if batch selected) ─────────
      if (batchId && batch) {
        await client.query(
          `INSERT INTO batch_students (batch_id, student_email, parent_email, skip_payment_gate, payment_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (batch_id, student_email) DO UPDATE SET
             parent_email = COALESCE(EXCLUDED.parent_email, batch_students.parent_email),
             skip_payment_gate = EXCLUDED.skip_payment_gate,
             payment_type = EXCLUDED.payment_type`,
          [batchId, studentEmail, resolvedParentEmail, skipPaymentGate, isGroupBatch ? paymentType : 'otp']
        );
      }

      // ── 5. Record payment ──────────────────────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      const batchDisplayName = batch ? String(batch.batch_name) : batchTypeStr.replace(/_/g, ' ');

      if (isGroupBatch) {
        // ── Group batch: OTP or SPO invoice logic ──────────────────────
        if (paymentType === 'otp') {
          // OTP total from fee structure (fallback to amount paid if no fee data)
          const otpTotal = feeOtpPaise > 0 ? feeOtpPaise : (paymentMode !== 'none' ? amountPaise : 0);

          if (paymentMode === 'full' || paymentMode === 'advance') {
            // Create paid invoice for collected amount
            invoiceNumber = await generateInvoiceNumber();
            const descPaid = [
              `Manual Enrollment \u2014 ${batchDisplayName}`,
              paymentMode === 'full' ? '(OTP Full Payment)' : '(OTP Advance Payment)',
              notes ? `\u2022 ${notes}` : '',
            ].filter(Boolean).join(' ');
            const invRes = await client.query<{ id: string }>(
              `INSERT INTO invoices (
                 invoice_number, student_email, parent_email, description,
                 billing_period, period_start, period_end,
                 amount_paise, currency, due_date,
                 status, paid_at, payment_method, transaction_id
               ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$5,'paid',NOW(),$8,$9)
               RETURNING id`,
              [invoiceNumber, studentEmail, resolvedParentEmail, descPaid,
               today, addMonths(today, 12), amountPaise, paymentMethod, transactionRef]
            );
            capturedInvoiceId = invRes.rows[0].id;
            receiptNumber = await generateReceiptNumber();
            await client.query(
              `INSERT INTO payment_receipts (receipt_number, invoice_id, student_email, amount_paise, currency, payment_method, transaction_id)
               VALUES ($1,$2,$3,$4,'INR',$5,$6)`,
              [receiptNumber, capturedInvoiceId, studentEmail, amountPaise, paymentMethod, transactionRef]
            );
            // Advance with balance: create pending balance invoice + set gate
            if (paymentMode === 'advance' && otpTotal > amountPaise) {
              const balance = otpTotal - amountPaise;
              const dueDate30 = addDays(today, 30);
              const balInvNum = await generateInvoiceNumber();
              const descBal = [
                `Balance Invoice \u2014 ${batchDisplayName}`,
                '(OTP Balance)',
                notes ? `\u2022 ${notes}` : '',
              ].filter(Boolean).join(' ');
              await client.query(
                `INSERT INTO invoices (
                   invoice_number, student_email, parent_email, description,
                   billing_period, period_start, period_end,
                   amount_paise, currency, due_date, status
                 ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$8,'pending')`,
                [balInvNum, studentEmail, resolvedParentEmail, descBal, today, addMonths(today, 12), balance, dueDate30]
              );
              await client.query(
                `UPDATE batch_students SET quarterly_due_date = $1 WHERE batch_id = $2 AND student_email = $3`,
                [dueDate30, batchId, studentEmail]
              );
            }
            // Full OTP payment: no gate

          } else {
            // payment_mode === 'none': create pending invoice for full OTP amount
            if (otpTotal > 0) {
              const dueDate30 = addDays(today, 30);
              invoiceNumber = await generateInvoiceNumber();
              const descPending = [
                `Enrollment Invoice \u2014 ${batchDisplayName}`,
                '(OTP)',
                notes ? `\u2022 ${notes}` : '',
              ].filter(Boolean).join(' ');
              const invRes = await client.query<{ id: string }>(
                `INSERT INTO invoices (
                   invoice_number, student_email, parent_email, description,
                   billing_period, period_start, period_end,
                   amount_paise, currency, due_date, status
                 ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$8,'pending')
                 RETURNING id`,
                [invoiceNumber, studentEmail, resolvedParentEmail, descPending, today, addMonths(today, 12), otpTotal, dueDate30]
              );
              capturedInvoiceId = invRes.rows[0].id;
              await client.query(
                `UPDATE batch_students SET quarterly_due_date = $1 WHERE batch_id = $2 AND student_email = $3`,
                [dueDate30, batchId, studentEmail]
              );
            }
          }

        } else {
          // SPO: Q1 now + Q2/Q3/Q4 scheduled
          const q1Amount = feeSpoQ123Paise > 0 ? feeSpoQ123Paise : (paymentMode !== 'none' ? amountPaise : 0);
          const q4Amount = feeSpoQ4Paise > 0 ? feeSpoQ4Paise : q1Amount;
          const qDates = [today, addMonths(today, 3), addMonths(today, 6), addMonths(today, 9)];

          // ── Q1 ──
          if (paymentMode === 'full' || (paymentMode === 'advance' && amountPaise >= q1Amount && q1Amount > 0)) {
            // Q1 fully paid
            invoiceNumber = await generateInvoiceNumber();
            const q1Desc = [`SPO Q1/4 \u2014 ${batchDisplayName}`, notes ? `\u2022 ${notes}` : ''].filter(Boolean).join(' ');
            const invRes = await client.query<{ id: string }>(
              `INSERT INTO invoices (
                 invoice_number, student_email, parent_email, description,
                 billing_period, period_start, period_end,
                 amount_paise, currency, due_date,
                 status, paid_at, payment_method, transaction_id, installment_number
               ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$5,'paid',NOW(),$8,$9,$10)
               RETURNING id`,
              [invoiceNumber, studentEmail, resolvedParentEmail, q1Desc,
               today, addMonths(today, 12), q1Amount > 0 ? q1Amount : amountPaise,
               paymentMethod, transactionRef, 1]
            );
            capturedInvoiceId = invRes.rows[0].id;
            receiptNumber = await generateReceiptNumber();
            await client.query(
              `INSERT INTO payment_receipts (receipt_number, invoice_id, student_email, amount_paise, currency, payment_method, transaction_id)
               VALUES ($1,$2,$3,$4,'INR',$5,$6)`,
              [receiptNumber, capturedInvoiceId, studentEmail, q1Amount > 0 ? q1Amount : amountPaise, paymentMethod, transactionRef]
            );
            // Gate advances to Q2
            await client.query(
              `UPDATE batch_students SET quarterly_due_date = $1 WHERE batch_id = $2 AND student_email = $3`,
              [qDates[1], batchId, studentEmail]
            );

          } else if (paymentMode === 'advance' && amountPaise > 0) {
            // Partial Q1: paid receipt + pending balance
            invoiceNumber = await generateInvoiceNumber();
            const q1PartDesc = [`SPO Q1/4 (Partial) \u2014 ${batchDisplayName}`, notes ? `\u2022 ${notes}` : ''].filter(Boolean).join(' ');
            const invRes = await client.query<{ id: string }>(
              `INSERT INTO invoices (
                 invoice_number, student_email, parent_email, description,
                 billing_period, period_start, period_end,
                 amount_paise, currency, due_date,
                 status, paid_at, payment_method, transaction_id, installment_number
               ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$5,'paid',NOW(),$8,$9,$10)
               RETURNING id`,
              [invoiceNumber, studentEmail, resolvedParentEmail, q1PartDesc,
               today, addMonths(today, 12), amountPaise, paymentMethod, transactionRef, 1]
            );
            capturedInvoiceId = invRes.rows[0].id;
            receiptNumber = await generateReceiptNumber();
            await client.query(
              `INSERT INTO payment_receipts (receipt_number, invoice_id, student_email, amount_paise, currency, payment_method, transaction_id)
               VALUES ($1,$2,$3,$4,'INR',$5,$6)`,
              [receiptNumber, capturedInvoiceId, studentEmail, amountPaise, paymentMethod, transactionRef]
            );
            if (q1Amount > amountPaise) {
              const q1BalNum = await generateInvoiceNumber();
              const q1BalDesc = [`SPO Q1/4 Balance \u2014 ${batchDisplayName}`, notes ? `\u2022 ${notes}` : ''].filter(Boolean).join(' ');
              await client.query(
                `INSERT INTO invoices (
                   invoice_number, student_email, parent_email, description,
                   billing_period, period_start, period_end,
                   amount_paise, currency, due_date, status, installment_number
                 ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$8,'pending',$9)`,
                [q1BalNum, studentEmail, resolvedParentEmail, q1BalDesc,
                 today, addMonths(today, 12), q1Amount - amountPaise, qDates[0], 1]
              );
            }
            // Gate to Q1 due date (today, since it's now due)
            await client.query(
              `UPDATE batch_students SET quarterly_due_date = $1 WHERE batch_id = $2 AND student_email = $3`,
              [qDates[0], batchId, studentEmail]
            );

          } else {
            // Q1 none: pending
            if (q1Amount > 0) {
              invoiceNumber = await generateInvoiceNumber();
              const q1Desc = [`SPO Q1/4 \u2014 ${batchDisplayName}`, notes ? `\u2022 ${notes}` : ''].filter(Boolean).join(' ');
              const invRes = await client.query<{ id: string }>(
                `INSERT INTO invoices (
                   invoice_number, student_email, parent_email, description,
                   billing_period, period_start, period_end,
                   amount_paise, currency, due_date, status, installment_number
                 ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$8,'pending',$9)
                 RETURNING id`,
                [invoiceNumber, studentEmail, resolvedParentEmail, q1Desc,
                 today, addMonths(today, 12), q1Amount, qDates[0], 1]
              );
              capturedInvoiceId = invRes.rows[0].id;
              // Gate to today (Q1 due now)
              await client.query(
                `UPDATE batch_students SET quarterly_due_date = $1 WHERE batch_id = $2 AND student_email = $3`,
                [qDates[0], batchId, studentEmail]
              );
            }
          }

          // ── Q2 / Q3 / Q4 always scheduled ──
          const qAmounts = [0, q1Amount, q1Amount, q1Amount, q4Amount]; // index 0 unused; Q2=Q3=q1Amount, Q4=q4Amount
          const qLabels  = ['', 'Q1/4', 'Q2/4', 'Q3/4', 'Q4/4'];
          for (let q = 2; q <= 4; q++) {
            const qAmount = qAmounts[q] > 0 ? qAmounts[q] : (q < 4 ? q1Amount : q4Amount);
            const qDate = qDates[q - 1];
            const qInvNum = await generateInvoiceNumber();
            await client.query(
              `INSERT INTO invoices (
                 invoice_number, student_email, parent_email, description,
                 billing_period, period_start, period_end,
                 amount_paise, currency, due_date, status,
                 installment_number, scheduled_for
               ) VALUES ($1,$2,$3,$4,'enrollment',$5,$6,$7,'INR',$8,'scheduled',$9,$8)`,
              [qInvNum, studentEmail, resolvedParentEmail,
               `SPO ${qLabels[q]} \u2014 ${batchDisplayName}`,
               today, addMonths(today, 12), qAmount, qDate, q]
            );
          }
        }

      } else if (paymentMode !== 'none' && amountPaise > 0) {
        // ── Non-group: single paid invoice (1:1, 1:3, flat-fee, no-batch) ──
        const periodStart = today;
        const periodEnd   = new Date(new Date(today).getFullYear(), new Date(today).getMonth() + 1, 0).toISOString().slice(0, 10);

        invoiceNumber = await generateInvoiceNumber();
        const descParts = [
          `Manual Enrollment \u2014 ${batchDisplayName}`,
          paymentMode === 'advance' ? '(Advance Payment)' : '(Full Payment)',
          notes ? `\u2022 ${notes}` : '',
        ].filter(Boolean).join(' ');
        const invRes = await client.query<{ id: string }>(
          `INSERT INTO invoices (
             invoice_number, student_email, parent_email, description,
             billing_period, period_start, period_end,
             amount_paise, currency, due_date,
             status, paid_at, payment_method, transaction_id
           ) VALUES ($1,$2,$3,$4,'manual',$5,$6,$7,'INR',$8,'paid',NOW(),$9,$10)
           RETURNING id`,
          [invoiceNumber, studentEmail, resolvedParentEmail, descParts,
           periodStart, periodEnd, amountPaise, periodStart, paymentMethod, transactionRef]
        );
        const invoiceId = invRes.rows[0].id;
        capturedInvoiceId = invoiceId;
        receiptNumber = await generateReceiptNumber();
        await client.query(
          `INSERT INTO payment_receipts (receipt_number, invoice_id, student_email, amount_paise, currency, payment_method, transaction_id)
           VALUES ($1,$2,$3,$4,'INR',$5,$6)`,
          [receiptNumber, invoiceId, studentEmail, amountPaise, paymentMethod, transactionRef]
        );

        // ── 6. Session credits for 1:1 / 1:3 advance payments ─
        if (isPerClassBatch && minimumSessions > 0) {
          const feePerSessionPaise = Math.round(amountPaise / minimumSessions);
          const existingCredits = await client.query(
            `SELECT id FROM student_session_credits WHERE student_email = $1 AND invoice_id = $2`,
            [studentEmail, invoiceId]
          );
          if (existingCredits.rows.length === 0) {
            await client.query(
              `INSERT INTO student_session_credits
                 (student_email, subject, batch_type, total_sessions, fee_per_session_paise, currency,
                  enrollment_link_id, invoice_id, source)
               VALUES ($1, 'general', $2, $3, $4, 'INR', NULL, $5, 'manual')`,
              [studentEmail, batchTypeStr, minimumSessions, feePerSessionPaise, invoiceId]
            );
            sessionsCredited = minimumSessions;
          }
        }
      }

      // ── 8. Free credits when no payment recorded ─────────────
      // Only when AO explicitly passes minimum_sessions (e.g. complimentary access).
      if (paymentMode === 'none' && isPerClassBatch && minimumSessions > 0) {
        const existingFreeCredits = await client.query(
          `SELECT id FROM student_session_credits
           WHERE student_email = $1 AND source = 'manual' AND invoice_id IS NULL
             AND batch_type = $2 AND created_at > NOW() - INTERVAL '10 minutes'
           LIMIT 1`,
          [studentEmail, batchTypeStr]
        );
        if (existingFreeCredits.rows.length === 0) {
          await client.query(
            `INSERT INTO student_session_credits
               (student_email, subject, batch_type, total_sessions, fee_per_session_paise, currency,
                enrollment_link_id, invoice_id, source)
             VALUES ($1, 'general', $2, $3, 0, 'INR', NULL, NULL, 'manual')`,
            [studentEmail, batchTypeStr, minimumSessions]
          );
          sessionsCredited = minimumSessions;
        }
      }

      return {
        student_email: studentEmail,
        batch_id: batchId || null,
        batch_name: batch ? batch.batch_name : null,
        invoice_number: invoiceNumber,
        receipt_number: receiptNumber,
        amount_paid_paise: paymentMode !== 'none' ? amountPaise : 0,
        payment_mode: paymentMode,
        sessions_credited: sessionsCredited,
        // Notification data — not exposed to API caller
        invoice_id: capturedInvoiceId,
        studentIsNew,
        actualStudentPassword,
        resolvedParentEmail,
        parentIsNew,
        actualParentPassword,
      };
    });

    // Generate invoices/credits for any already-scheduled sessions in this batch (fire-and-forget)
    if (batchId) {
      backfillSessionInvoicesForStudents(batchId, [studentEmail]).catch((err) =>
        console.warn('[enrollment/manual] invoice backfill warning:', err)
      );
    }

    // ── Fire-and-forget notifications (email + WhatsApp auto-mirror) ──
    void (async () => {
      try {
        const fmtAmount = (p: number) =>
          `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

        // 1. Welcome credentials: new student
        if (result.studentIsNew && result.actualStudentPassword) {
          const additionalInfo = [
            studentGrade ? `Grade: ${studentGrade}` : '',
            studentBoard ? `Board: ${studentBoard}` : '',
          ].filter(Boolean).join(' | ') || undefined;
          const tpl = credentialsTemplate({
            recipientEmail: studentEmail,
            recipientName: studentName,
            role: 'Student',
            loginEmail: studentEmail,
            tempPassword: result.actualStudentPassword,
            loginUrl: LOGIN_URL,
            additionalInfo,
          });
          await sendEmail({ to: studentEmail, ...tpl, priority: 'high' }).catch((e) =>
            console.error('[enrollment/manual] student welcome email failed:', e),
          );
        }

        // 2. Welcome credentials: new parent
        if (result.parentIsNew && result.resolvedParentEmail && result.actualParentPassword) {
          const tpl = credentialsTemplate({
            recipientEmail: result.resolvedParentEmail,
            recipientName: parentName || 'Parent',
            role: 'Parent',
            loginEmail: result.resolvedParentEmail,
            tempPassword: result.actualParentPassword,
            loginUrl: LOGIN_URL,
            additionalInfo: `Your child ${studentName} has been enrolled.`,
          });
          await sendEmail({ to: result.resolvedParentEmail, ...tpl, priority: 'high' }).catch((e) =>
            console.error('[enrollment/manual] parent welcome email failed:', e),
          );
        }

        // 3. Payment receipt: student + parent
        if (result.invoice_number && result.receipt_number && result.amount_paid_paise > 0) {
          const amountStr = fmtAmount(result.amount_paid_paise);
          const receiptLink = `${PORTAL_URL}/api/v1/payment/invoice-pdf/${result.invoice_id ?? ''}`;
          const payDate = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const description = `Manual Enrollment${result.batch_name ? ` — ${result.batch_name}` : ''}`;
          const receiptBase = {
            studentName,
            receiptNumber: result.receipt_number,
            invoiceNumber: result.invoice_number,
            amount: amountStr,
            transactionId: transactionRef || '—',
            paymentMethod: paymentMethod.replace(/_/g, ' '),
            paymentDate: payDate,
            receiptLink,
            description,
          };
          await sendPaymentReceipt({
            recipientName: studentName,
            recipientEmail: studentEmail,
            ...receiptBase,
          }).catch((e) => console.error('[enrollment/manual] receipt email to student failed:', e));

          if (result.resolvedParentEmail) {
            await sendPaymentReceipt({
              recipientName: parentName || 'Parent',
              recipientEmail: result.resolvedParentEmail,
              ...receiptBase,
            }).catch((e) =>
              console.error('[enrollment/manual] receipt email to parent failed:', e),
            );
          }
        }
      } catch (notifErr) {
        console.error('[enrollment/manual] notification error:', notifErr);
      }
    })();

    return NextResponse.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    console.error('[enrollment/manual] Error:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}
