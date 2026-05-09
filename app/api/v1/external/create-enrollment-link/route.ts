import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';
import { createInvoice, completePayment } from '@/lib/payment';
import { sendEmail } from '@/lib/email';
import { enrollmentPaymentLinkEmail } from '@/lib/email-templates';
import {
  getRegionGroup, getEnrollmentCategory, isSessionBased,
  normalizeGrade, toFeeGrade, getActiveFee, isOfferActive, BATCH_TYPE_LABELS,
} from '@/lib/enrollment-fee';
import { getPlatformName } from '@/lib/platform-config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';
const MIN_SESSIONS = 50;

/**
 * POST /api/v1/external/create-enrollment-link
 * Called by Stibe CRM to create an enrollment payment link for an interested lead.
 * Auth: X-API-Key header.
 *
 * Body: {
 *   crm_lead_id, crm_tenant_id, demo_request_id?,
 *   student_name, student_phone, student_email?, student_grade?,
 *   // Prefilled mode (all details filled by sales staff):
 *   prefilled?, student_board?, student_region?, student_whatsapp?,
 *   student_dob?, student_section?, student_parent_name?,
 *   student_parent_email?, student_parent_phone?,
 *   preferred_batch_type?, selected_subjects?
 * }
 * Returns: { enrollment_link_id, enrollment_url, payment_url? }
 */
export async function POST(request: NextRequest) {
  try {
    // API key auth
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const {
      crm_lead_id,
      crm_tenant_id,
      demo_request_id,
      student_name,
      student_phone,
      student_email,
      student_grade,
      student_board,
      student_region,
      prefilled,
      manually_paid,
      manual_payment_amount_paise,
      manual_transaction_id,
      student_whatsapp,
      student_dob,
      student_section,
      student_address,
      student_category,
      student_parent_name,
      student_parent_email,
      student_parent_phone,
      preferred_batch_type,
      selected_subjects,
      payment_plan,
    } = body as {
      crm_lead_id?: string;
      crm_tenant_id?: string;
      demo_request_id?: string;
      student_name?: string;
      student_phone?: string;
      student_email?: string;
      student_grade?: string;
      student_board?: string;
      student_region?: string;
      prefilled?: boolean;
      manually_paid?: boolean;
      manual_payment_amount_paise?: number;
      manual_transaction_id?: string;
      student_whatsapp?: string;
      student_dob?: string;
      student_section?: string;
      student_address?: string;
      student_category?: string;
      student_parent_name?: string;
      student_parent_email?: string;
      student_parent_phone?: string;
      preferred_batch_type?: string;
      selected_subjects?: string[];
      payment_plan?: 'otp' | 'quarterly'; // otp = one-time, quarterly = 3-month installments
    };

    if (!crm_lead_id || !crm_tenant_id || !student_name || !student_phone) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: crm_lead_id, crm_tenant_id, student_name, student_phone' },
        { status: 400 },
      );
    }

    const normalizedEmail = (student_email || '').trim().toLowerCase();
    const normalizedParentEmail = (student_parent_email || '').trim().toLowerCase();
    if (normalizedEmail) {
      const existingUserRes = await db.query<{ email: string; portal_role: string }>(
        `SELECT email, portal_role
         FROM portal_users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [normalizedEmail],
      );
      if (existingUserRes.rows.length > 0) {
        const existing = existingUserRes.rows[0];
        return NextResponse.json<ApiResponse>(
          { success: false, error: `Email already exists in portal (${existing.portal_role})` },
          { status: 409 },
        );
      }
    }

    if (normalizedParentEmail) {
      const existingParentRes = await db.query<{ email: string; portal_role: string }>(
        `SELECT email, portal_role
         FROM portal_users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [normalizedParentEmail],
      );
      if (existingParentRes.rows.length > 0) {
        const existingParent = existingParentRes.rows[0];
        if (existingParent.portal_role !== 'parent') {
          return NextResponse.json<ApiResponse>(
            { success: false, error: `Parent email already exists in portal (${existingParent.portal_role})` },
            { status: 409 },
          );
        }
      }
    }

    // Extra validation for prefilled mode
    if (prefilled) {
      if (!student_email || !student_grade || !student_board || !student_region || !preferred_batch_type) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Prefilled mode requires: student_email, student_grade, student_board, student_region, preferred_batch_type' },
          { status: 400 },
        );
      }
      if (!student_parent_name || !normalizedParentEmail) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Prefilled mode requires: student_parent_name, student_parent_email' },
          { status: 400 },
        );
      }
      const sessionBased = isSessionBased(preferred_batch_type);
      if (sessionBased && (!selected_subjects || selected_subjects.length === 0)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Session-based batch types require selected_subjects' },
          { status: 400 },
        );
      }
    }

    // Generate a unique 10-char enrollment link ID
    const linkId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Resolve demo_request_id UUID (validate it exists if provided)
    let resolvedDemoRequestId: string | null = null;
    if (demo_request_id) {
      const demoCheck = await db.query(
        `SELECT id FROM demo_requests WHERE id = $1 LIMIT 1`,
        [demo_request_id],
      );
      if (demoCheck.rows.length > 0) {
        resolvedDemoRequestId = demo_request_id;
      }
    }

    // Derive category/region for prefilled mode
    const regionGroup = (prefilled && student_region) ? getRegionGroup(student_region) : null;
    const category = (prefilled && student_region && student_board)
      ? getEnrollmentCategory(student_region, student_board) : null;

    // Create enrollment_link row
    await db.query(
      `INSERT INTO enrollment_links (
        id, demo_request_id, crm_lead_id, crm_tenant_id,
        student_name, student_phone, student_email, student_grade,
        student_board, student_region, student_whatsapp, student_dob,
        student_section, student_address, student_category,
        student_parent_name, student_parent_email,
        student_parent_phone, preferred_batch_type,
        enrollment_region_group, enrollment_category,
        payment_plan,
        status, expires_at, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'pending',$23,NOW())
      ON CONFLICT (id) DO NOTHING`,
      [
        linkId, resolvedDemoRequestId, crm_lead_id, crm_tenant_id,
        student_name, student_phone, normalizedEmail || null, student_grade || null,
        student_board || null, student_region || null,
        student_whatsapp || null, student_dob || null,
        student_section || null, student_address || null,
        student_category || null, student_parent_name || null,
        normalizedParentEmail || null, student_parent_phone || null,
        preferred_batch_type || null, regionGroup, category,
        payment_plan || 'otp',
        expiresAt.toISOString(),
      ],
    );

    const enrollmentUrl = `${BASE_URL}/enroll/${linkId}`;

    // ── Manually paid mode: CRM recorded offline payment, enroll directly ──
    if (manually_paid && prefilled && category && preferred_batch_type && student_grade && normalizedEmail) {
      const grade = normalizeGrade(student_grade);
      const sessionBased = isSessionBased(preferred_batch_type);
      const subjects = selected_subjects || [];
      const manualAmount = manual_payment_amount_paise || 0;

      if (manualAmount <= 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Manual payment amount must be positive' }, { status: 400 });
      }

      const btLabel = BATCH_TYPE_LABELS[preferred_batch_type] || preferred_batch_type;
      const platformName = await getPlatformName();
      const description = sessionBased
        ? `${platformName} enrollment — ${preferred_batch_type === 'one_to_one' ? '1:1' : '1:3'} — Manual payment: ${subjects.join(', ')}`
        : `${platformName} enrollment — ${btLabel} — Grade ${grade} — Manual payment`;

      const today = new Date().toISOString().slice(0, 10);
      const endMs = sessionBased ? 180 * 86400 * 1000 : 365 * 86400 * 1000;
      const periodEnd = new Date(Date.now() + endMs).toISOString().slice(0, 10);

      // Create invoice with manual payment amount
      const invoice = await createInvoice({
        studentEmail: normalizedEmail,
        description,
        billingPeriod: 'enrollment',
        periodStart: today,
        periodEnd,
        amountPaise: manualAmount,
        currency: 'INR',
        dueDate: today,
      });

      // Update enrollment_links with invoice + subjects + amount
      await db.query(
        `UPDATE enrollment_links
         SET selected_subjects = $1, amount_paise = $2, invoice_id = $3, status = 'subject_selected'
         WHERE id = $4`,
        [sessionBased ? subjects : [], manualAmount, invoice.id, linkId],
      );

      // Mark as paid immediately — triggers student account creation, session credits, CRM webhook, welcome emails
      const txnId = manual_transaction_id || `manual_crm_${linkId}`;
      await completePayment(String(invoice.id), txnId, 'manual_crm');

      console.log(`[external/create-enrollment-link] CRM lead ${crm_lead_id} → enrollment ${linkId} → MANUALLY PAID ₹${(manualAmount/100).toLocaleString('en-IN')} → student enrolled`);

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          enrollment_link_id: linkId,
          enrollment_url: enrollmentUrl,
        },
        message: 'Student enrolled directly with manual payment',
      }, { status: 201 });
    }

    // ── Prefilled mode: send verification-first enrollment link ──
    if (prefilled && category && preferred_batch_type && student_grade && normalizedEmail) {
      const grade = normalizeGrade(student_grade);
      const feeGrade = toFeeGrade(grade);
      const sessionBased = isSessionBased(preferred_batch_type);
      const subjects = selected_subjects || [];

      // Look up fee from enrollment_fee_structure
      const rgMap: Record<string, { rg: string; b: string }> = {
        GCC_CBSE:     { rg: 'GCC', b: 'CBSE' },
        KERALA_CBSE:  { rg: 'Kerala', b: 'CBSE' },
        KERALA_STATE: { rg: 'Kerala', b: 'State Board' },
      };
      const { rg, b } = rgMap[category] || {};
      if (!rg || !b) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid enrollment category' }, { status: 400 });
      }

      const feeRes = await db.query(
        `SELECT fee_paise, early_bird_fee_paise, offer_label, offer_expires_at, fee_unit, currency
         FROM enrollment_fee_structure
         WHERE is_active = true AND region_group = $1 AND board = $2
           AND batch_type = $3 AND grade IN ($4, 'all')
         ORDER BY (grade = $4) DESC
         LIMIT 1`,
        [rg, b, preferred_batch_type, feeGrade],
      );
      if (feeRes.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'No fee configured for this combination' }, { status: 422 });
      }
      const fee = feeRes.rows[0] as {
        fee_paise: number; early_bird_fee_paise: number | null;
        offer_label: string | null; offer_expires_at: string | null;
        fee_unit: string; currency: string;
      };
      const activeFeeUnit = getActiveFee(fee);
      const offerOn = isOfferActive(fee);

      let displayAmountPaise: number;
      if (sessionBased) {
        displayAmountPaise = activeFeeUnit * MIN_SESSIONS;
      } else {
        const annualBase = activeFeeUnit;
        if (payment_plan === 'quarterly') {
          const spoTotal = Math.round(annualBase * (offerOn ? 0.80 : 0.95));
          displayAmountPaise = Math.round(spoTotal * 0.30); // Q1 payable now
        } else {
          displayAmountPaise = Math.round(annualBase * (offerOn ? 0.75 : 0.90));
        }
      }

      // Save prefilled selections so student reaches verification with data already populated.
      await db.query(
        `UPDATE enrollment_links
         SET selected_subjects = $1, payment_plan = $2
         WHERE id = $3`,
        [subjects, payment_plan || 'otp', linkId],
      );

      // Send WhatsApp with enrollment verification link (not direct Razorpay).
      const cleanPhone = student_phone.replace(/\D/g, '');
      const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const amountStr = `₹${(displayAmountPaise / 100).toLocaleString('en-IN')}`;
      const btLabel = BATCH_TYPE_LABELS[preferred_batch_type] || preferred_batch_type;
      const offerLine = offerOn && fee.offer_label
        ? `\n🏷️ *${fee.offer_label}* — was ₹${(fee.fee_paise / 100).toLocaleString('en-IN')}${sessionBased ? '/class' : '/year'}`
        : '';
      const planLine = !sessionBased
        ? `\n🧾 Plan: *${(payment_plan === 'quarterly' ? 'SPO (Quarterly)' : 'OTP (One-Time)')}*`
        : '';

      const platformNamePrefilled = await getPlatformName();
      const waMessage = `🎓 *${platformNamePrefilled} Classes — Verify & Complete Enrollment*\n\nHi ${student_name}!\n\nYour enrollment details are pre-filled:\n📚 Grade ${grade} · ${student_board}\n🏅 ${btLabel}${planLine}\n💰 Payable now: *${amountStr}*${offerLine}\n\nReview details and complete payment here:\n${enrollmentUrl}\n\nThis link is valid for 7 days. After payment, our team will add you to the right batch.\n\n— ${platformNamePrefilled} Classes`;

      await fireWhatsApp(
        `wa_crm_enroll_${linkId}`,
        waMessage,
        undefined,
        'stibe_alert',
        [student_name, `Review and complete your ${platformNamePrefilled} enrollment here: ${enrollmentUrl}`],
        normalizedPhone,
      );

      // Send email with verification-first enrollment link
      try {
        const { subject, html, text } = enrollmentPaymentLinkEmail({
          studentName: student_name,
          grade,
          board: student_board!,
          batchType: btLabel,
          amount: amountStr,
          paymentUrl: enrollmentUrl,
        });
        await sendEmail({
          to: normalizedEmail,
          subject,
          html,
          text,
          recipientPhone: normalizedPhone,
        });
      } catch (emailErr) {
        console.error('[create-enrollment-link] Email send error (non-critical):', emailErr);
      }

      console.log(`[external/create-enrollment-link] CRM lead ${crm_lead_id} → enrollment ${linkId} → PREFILLED → verification link sent to ${normalizedPhone}`);

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          enrollment_link_id: linkId,
          enrollment_url: enrollmentUrl,
        },
        message: 'Enrollment verification link sent via WhatsApp + email',
      }, { status: 201 });
    }

    // ── Normal mode: send enrollment form link ──────────────

    // Fetch demo details for a personalized enrollment message
    let demoSubject = '';
    let demoTeacher = '';
    let demoGrade = student_grade || '';
    if (resolvedDemoRequestId) {
      try {
        const demoInfo = await db.query(
          `SELECT subject, teacher_name, student_grade FROM demo_requests WHERE id = $1`,
          [resolvedDemoRequestId],
        );
        if (demoInfo.rows.length > 0) {
          const d = demoInfo.rows[0] as Record<string, unknown>;
          demoSubject = (d.subject as string) || '';
          demoTeacher = (d.teacher_name as string) || '';
          if (!demoGrade) demoGrade = (d.student_grade as string) || '';
        }
      } catch { /* non-critical */ }
    }

    // Build WhatsApp enrollment message — include demo details if available
    const demoLine = demoSubject
      ? `\n\nThank you for attending the *${demoSubject}* demo${demoTeacher ? ` with ${demoTeacher}` : ''}! We're glad you're interested in continuing.`
      : '';
    const gradeLine = demoGrade ? ` (Grade ${demoGrade})` : '';

    // Send WhatsApp to student with enrollment (form) link
    const cleanPhone = student_phone.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const platformNameNormal = await getPlatformName();
    const waMessage = `🎓 *${platformNameNormal} Classes — Enrollment*\n\nHi ${student_name}!${demoLine}\n\nYou're one step away from starting your learning journey${gradeLine}!\n\nSelect your subjects and complete enrollment here:\n${enrollmentUrl}\n\nThis link is valid for 7 days. After payment, our team will add you to the right batch.\n\n— ${platformNameNormal} Classes`;

    await fireWhatsApp(
      `wa_crm_enroll_${linkId}`,
      waMessage,
      undefined,
      'stibe_alert',
      [student_name, `Complete your ${platformNameNormal} enrollment here: ${enrollmentUrl}`],
      normalizedPhone,
    );

    console.log(`[external/create-enrollment-link] CRM lead ${crm_lead_id} → enrollment link ${linkId} → WA sent to ${normalizedPhone}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        enrollment_link_id: linkId,
        enrollment_url: enrollmentUrl,
      },
      message: 'Enrollment link created and WhatsApp sent',
    }, { status: 201 });
  } catch (err) {
    console.error('[external/create-enrollment-link] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
