// ═══════════════════════════════════════════════════════════════
// Enrollment API — GET + PATCH + POST /api/v1/enroll/[linkId]
// Public (no login). Student opens from WhatsApp link.
// GET   → validate link, return link data + fee structure + subject rates
// PATCH → save student profile (personal + academic + guardian)
// POST  → { selected_subjects? } → create invoice → return pay token
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createInvoice, createPaymentOrder, createScheduledInvoice } from '@/lib/payment';
import { generatePayToken } from '@/lib/pay-token';
import {
  getRegionGroup, getEnrollmentCategory, getAvailableBatchTypes,
  isSessionBased, BATCH_TYPE_LABELS, ELIGIBLE_GRADES,
  ENROLLMENT_BOARDS, STUDENT_REGIONS, normalizeGrade, toFeeGrade,
} from '@/lib/enrollment-fee';
import { getPlatformName } from '@/lib/platform-config';

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const MIN_SESSIONS_DEFAULT = 50;
const MIN_SESSIONS_MINIMUM = 5;

function getActiveFee(row: { fee_paise: number; early_bird_fee_paise?: number | null; offer_expires_at?: string | null }): number {
  if (row.early_bird_fee_paise && (!row.offer_expires_at || new Date(row.offer_expires_at) > new Date())) {
    return row.early_bird_fee_paise;
  }
  return row.fee_paise;
}

// ── GET /api/v1/enroll/[linkId] ──────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  try {
    const { linkId } = await params;

    const linkRes = await db.query(
      `SELECT * FROM enrollment_links WHERE id = $1 LIMIT 1`,
      [linkId],
    );

    if (linkRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Enrollment link not found' }, { status: 404 });
    }

    const link = linkRes.rows[0] as Record<string, unknown>;

    if (link.status === 'paid') {
      return NextResponse.json({ success: false, error: 'This enrollment has already been paid', paid: true }, { status: 410 });
    }

    if (link.status === 'expired' || new Date(link.expires_at as string) < new Date()) {
      return NextResponse.json({ success: false, error: 'This enrollment link has expired', expired: true }, { status: 410 });
    }

    // Fetch enrollment fee structure
    const feesRes = await db.query(
      `SELECT id, region_group, board, batch_type, grade,
              fee_paise, early_bird_fee_paise, offer_label, offer_expires_at,
              show_per_class_only, fee_unit, currency
       FROM enrollment_fee_structure
       WHERE is_active = true AND academic_year = '2026-27'
       ORDER BY region_group, board, batch_type, grade::int`,
    );

    // Fetch subject rates (for session-based batch types)
    const ratesRes = await db.query(
      `SELECT DISTINCT ON (subject) subject, per_hour_rate_paise, currency, notes
       FROM session_fee_rates
       WHERE is_active = true AND subject IS NOT NULL
       ORDER BY subject, per_hour_rate_paise DESC`,
    );

    return NextResponse.json({
      success: true,
      data: {
        link: {
          student_name: link.student_name,
          student_email: link.student_email,
          student_phone: link.student_phone,
          student_grade: link.student_grade,
          student_board: link.student_board,
          student_region: link.student_region,
          student_whatsapp: link.student_whatsapp,
          student_dob: link.student_dob,
          student_section: link.student_section,
          student_parent_name: link.student_parent_name,
          student_parent_email: link.student_parent_email,
          student_parent_phone: link.student_parent_phone,
          preferred_batch_type: link.preferred_batch_type,
          enrollment_category: link.enrollment_category,
          minimum_sessions: MIN_SESSIONS_DEFAULT,
          status: link.status,
        },
        fee_structure: feesRes.rows,
        subjects: ratesRes.rows,
        constants: {
          student_regions: STUDENT_REGIONS,
          boards: ENROLLMENT_BOARDS,
          eligible_grades: ELIGIBLE_GRADES,
          batch_type_labels: BATCH_TYPE_LABELS,
        },
      },
    });
  } catch (err) {
    console.error('[enroll/GET] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH /api/v1/enroll/[linkId] — save student profile ────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  try {
    const { linkId } = await params;
    const body = await req.json();

    const linkRes = await db.query(
      `SELECT id, status, expires_at FROM enrollment_links WHERE id = $1 LIMIT 1`,
      [linkId],
    );
    if (linkRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Enrollment link not found' }, { status: 404 });
    }
    const link = linkRes.rows[0] as Record<string, unknown>;
    if (link.status === 'paid') {
      return NextResponse.json({ success: false, error: 'Already paid' }, { status: 409 });
    }
    if (link.status === 'expired' || new Date(link.expires_at as string) < new Date()) {
      return NextResponse.json({ success: false, error: 'Link expired' }, { status: 410 });
    }

    const {
      student_name, student_email, student_phone, student_whatsapp, student_dob,
      student_grade, student_board, student_region, student_section,
      student_parent_name, student_parent_email, student_parent_phone,
      preferred_batch_type,
    } = body;

    const normalizedParentEmail = (student_parent_email || '').trim().toLowerCase();
    if (normalizedParentEmail) {
      const parentRoleRes = await db.query<{ portal_role: string }>(
        `SELECT portal_role FROM portal_users WHERE LOWER(email) = $1 LIMIT 1`,
        [normalizedParentEmail],
      );
      if (parentRoleRes.rows.length > 0) {
        const role = parentRoleRes.rows[0].portal_role;
        if (role !== 'parent') {
          return NextResponse.json(
            { success: false, error: `Parent email is already used by ${role} role` },
            { status: 409 },
          );
        }
      }
    }

    // Derive category
    const regionGroup = student_region ? getRegionGroup(student_region) : null;
    const category = (student_region && student_board)
      ? getEnrollmentCategory(student_region, student_board)
      : null;

    await db.query(
      `UPDATE enrollment_links SET
        student_name = COALESCE($1, student_name),
        student_email = COALESCE($2, student_email),
        student_phone = COALESCE($3, student_phone),
        student_whatsapp = $4,
        student_dob = $5,
        student_grade = COALESCE($6, student_grade),
        student_board = $7,
        student_region = $8,
        student_section = $9,
        student_parent_name = $10,
        student_parent_email = $11,
        student_parent_phone = $12,
        preferred_batch_type = $13,
        enrollment_region_group = $14,
        enrollment_category = $15
       WHERE id = $16`,
      [
        student_name || null, student_email || null, student_phone || null,
        student_whatsapp || null, student_dob || null,
        student_grade || null, student_board || null, student_region || null,
        student_section || null, student_parent_name || null,
        normalizedParentEmail || null, student_parent_phone || null,
        preferred_batch_type || null, regionGroup, category,
        linkId,
      ],
    );

    // Look up fee for this combination
    let fee = null;
    if (category && preferred_batch_type && student_grade) {
      const g = toFeeGrade(normalizeGrade(student_grade));
      const rgMap: Record<string, { rg: string; b: string }> = {
        GCC_CBSE:     { rg: 'GCC', b: 'CBSE' },
        KERALA_CBSE:  { rg: 'Kerala', b: 'CBSE' },
        KERALA_STATE: { rg: 'Kerala', b: 'State Board' },
      };
      const { rg, b } = rgMap[category] || {};
      if (rg && b) {
        const feeRes = await db.query(
          `SELECT fee_paise, early_bird_fee_paise, offer_label, offer_expires_at,
                  show_per_class_only, fee_unit, currency
           FROM enrollment_fee_structure
           WHERE is_active = true AND region_group = $1 AND board = $2
             AND batch_type = $3 AND grade = $4
           LIMIT 1`,
          [rg, b, preferred_batch_type, g],
        );
        if (feeRes.rows.length > 0) fee = feeRes.rows[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        enrollment_category: category,
        enrollment_region_group: regionGroup,
        available_batch_types: category ? getAvailableBatchTypes(category) : [],
        is_session_based: preferred_batch_type ? isSessionBased(preferred_batch_type) : null,
        fee,
      },
    });
  } catch (err) {
    console.error('[enroll/PATCH] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/v1/enroll/[linkId] — create invoice + pay ─────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  try {
    const { linkId } = await params;
    const body = await req.json();
    const selected: string[] = Array.isArray(body.selected_subjects) ? body.selected_subjects : [];
    const paymentPlan: 'otp' | 'quarterly' = body.payment_plan === 'quarterly' ? 'quarterly' : 'otp';
    const requestedSessions = typeof body.minimum_sessions === 'number' ? body.minimum_sessions : MIN_SESSIONS_DEFAULT;
    const sessionCount = Math.max(MIN_SESSIONS_MINIMUM, Math.round(requestedSessions));

    const linkRes = await db.query(
      `SELECT * FROM enrollment_links WHERE id = $1 LIMIT 1`,
      [linkId],
    );

    if (linkRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Enrollment link not found' }, { status: 404 });
    }

    const link = linkRes.rows[0] as Record<string, unknown>;

    if (link.status === 'paid') {
      return NextResponse.json({ success: false, error: 'Already paid', paid: true }, { status: 409 });
    }

    if (link.status === 'expired' || new Date(link.expires_at as string) < new Date()) {
      return NextResponse.json({ success: false, error: 'Link expired', expired: true }, { status: 410 });
    }

    // Must have profile saved (board + region + batch_type set)
    const batchType = link.preferred_batch_type as string | null;
    const category = link.enrollment_category as string | null;
    const grade = toFeeGrade(normalizeGrade(link.student_grade as string | null));

    if (!batchType || !category || !grade) {
      return NextResponse.json({
        success: false,
        error: 'Please complete your profile (academic details) before payment',
      }, { status: 400 });
    }

    // If a stale unpaid invoice exists, clear it so a fresh one is created with the correct amount
    if (link.invoice_id) {
      const oldInvRes = await db.query(
        `SELECT status FROM invoices WHERE id = $1`,
        [link.invoice_id],
      );
      if (oldInvRes.rows.length > 0 && (oldInvRes.rows[0] as Record<string, unknown>).status === 'paid') {
        return NextResponse.json({ success: false, error: 'Already paid', paid: true }, { status: 409 });
      }
      // Delete stale pending invoice and clear link reference
      await db.query(`DELETE FROM invoices WHERE id = $1 AND status = 'pending'`, [link.invoice_id]);
      await db.query(`UPDATE enrollment_links SET invoice_id = NULL, amount_paise = NULL WHERE id = $1`, [linkId]);
    }

    const sessionBased = isSessionBased(batchType);
    const platformName = await getPlatformName();

    let totalAmountPaise: number;
    let description: string;
    let annualSpoData: { spoTotal: number; btLabel: string; grade: string; category: string; studentEmail: string } | null = null;

    if (sessionBased) {
      // Session-based: needs subjects
      if (selected.length === 0) {
        return NextResponse.json({ success: false, error: 'Please select at least one subject' }, { status: 400 });
      }

      // Look up per-session rate from enrollment_fee_structure (same rate for all subjects)
      const rgMap: Record<string, { rg: string; b: string }> = {
        GCC_CBSE:     { rg: 'GCC', b: 'CBSE' },
        KERALA_CBSE:  { rg: 'Kerala', b: 'CBSE' },
        KERALA_STATE: { rg: 'Kerala', b: 'State Board' },
      };
      const { rg: sRg, b: sB } = rgMap[category] || {};
      if (!sRg || !sB) {
        return NextResponse.json({ success: false, error: 'Invalid enrollment category' }, { status: 400 });
      }
      const sessionFeeRes = await db.query(
        `SELECT fee_paise, early_bird_fee_paise, offer_expires_at, currency
         FROM enrollment_fee_structure
         WHERE is_active = true AND region_group = $1 AND board = $2
           AND batch_type = $3 AND grade = $4
         LIMIT 1`,
        [sRg, sB, batchType, grade],
      );
      if (sessionFeeRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No fee configured for this combination' }, { status: 422 });
      }
      const sessionFee = sessionFeeRes.rows[0] as { fee_paise: number; early_bird_fee_paise?: number | null; offer_expires_at?: string | null; currency: string };
      // Flat advance: active rate × sessions (not multiplied by subject count)
      totalAmountPaise = getActiveFee(sessionFee) * sessionCount;
      const subjectNames = selected.join(', ');
      const btShort = batchType === 'one_to_one' ? '1:1' : '1:3';
      description = `${platformName} enrollment — ${btShort} — ${sessionCount} sessions advance: ${subjectNames}`;
    } else {
      // Annual: look up from enrollment_fee_structure
      const rgMap: Record<string, { rg: string; b: string }> = {
        GCC_CBSE:     { rg: 'GCC', b: 'CBSE' },
        KERALA_CBSE:  { rg: 'Kerala', b: 'CBSE' },
        KERALA_STATE: { rg: 'Kerala', b: 'State Board' },
      };
      const { rg, b } = rgMap[category] || {};
      if (!rg || !b) {
        return NextResponse.json({ success: false, error: 'Invalid enrollment category' }, { status: 400 });
      }
      const feeRes = await db.query(
        `SELECT fee_paise, early_bird_fee_paise, offer_expires_at, fee_unit, currency
         FROM enrollment_fee_structure
         WHERE is_active = true AND region_group = $1 AND board = $2
           AND batch_type = $3 AND grade = $4
         LIMIT 1`,
        [rg, b, batchType, grade],
      );
      if (feeRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No fee configured for this combination' }, { status: 422 });
      }
      const fee = feeRes.rows[0] as { fee_paise: number; early_bird_fee_paise?: number | null; offer_expires_at?: string | null; fee_unit: string; currency: string };
      const ebAnnual = getActiveFee(fee);
      const offerOn = fee.early_bird_fee_paise && (!fee.offer_expires_at || new Date(fee.offer_expires_at) > new Date());
      const base = offerOn ? fee.fee_paise : ebAnnual;
      const btLabel = BATCH_TYPE_LABELS[batchType] || batchType;

      const subjectSuffix = selected.length > 0 ? ` [${selected.join(', ')}]` : '';
      if (paymentPlan === 'quarterly') {
        // SPO: Q1 = 30% of spoTotal; spoTotal = base × 0.80 (offer) or EB × 0.95 (no offer)
        const spoTotal = Math.round(base * (offerOn ? 0.80 : 0.95));
        const q123 = Math.round(spoTotal * 0.30);
        totalAmountPaise = q123; // charge only Q1 now
        const offerSuffix = offerOn ? ' — SPO Launching Offer (20% off)' : ' — SPO (5% off EB)';
        description = `${platformName} enrollment — ${btLabel} — Grade ${grade} — Q1/4 SPO (${category.replace(/_/g, ' ')})${offerSuffix}${subjectSuffix}`;
        // Q2/Q3/Q4 are created as scheduled invoices below
        annualSpoData = { spoTotal, btLabel, grade, category, studentEmail: (link.student_email as string) || '' };
      } else {
        // OTP = EB × 90% (no offer) or Regular × 75% (launching offer active)
        totalAmountPaise = Math.round(base * (offerOn ? 0.75 : 0.90));
        const offerSuffix = offerOn ? ' — OTP Launching Offer (25% off)' : ' — OTP (10% off EB)';
        description = `${platformName} enrollment — ${btLabel} — Grade ${grade} — Annual OTP (${category.replace(/_/g, ' ')})${offerSuffix}${subjectSuffix}`;
      }
    }

    // Compute period (today + 12 months for annual, 6 months for session-based)
    const today = new Date().toISOString().slice(0, 10);
    const endMs = sessionBased ? 180 * 86400 * 1000 : 365 * 86400 * 1000;
    const periodEnd = new Date(Date.now() + endMs).toISOString().slice(0, 10);

    const invoice = await createInvoice({
      studentEmail: (link.student_email as string) || '',
      description,
      billingPeriod: paymentPlan === 'quarterly' ? 'quarterly' : 'enrollment',
      periodStart: today,
      periodEnd,
      amountPaise: totalAmountPaise,
      currency: 'INR',
      dueDate: today,
    });

    // Mark Q1 with installment_number=1 and enrollment_link_id for SPO
    if (annualSpoData) {
      await db.query(
        `UPDATE invoices SET installment_number = 1, enrollment_link_id = $1 WHERE id = $2`,
        [linkId, invoice.id],
      );
    }

    // Update enrollment_links with plan and selected subjects
    await db.query(
      `UPDATE enrollment_links
       SET selected_subjects = $1, amount_paise = $2, invoice_id = $3,
           status = 'subject_selected', payment_plan = $4,
           minimum_sessions = $5
       WHERE id = $6`,
      [selected.length > 0 ? selected : [], totalAmountPaise, invoice.id, paymentPlan,
       sessionBased ? sessionCount : (link.minimum_sessions as number | null) || null, linkId],
    );

    // Create Q2/Q3/Q4 scheduled invoices for SPO
    if (annualSpoData) {
      const { spoTotal, btLabel: btLbl, grade: g, category: cat, studentEmail: sEmail } = annualSpoData;
      const q123 = Math.round(spoTotal * 0.30);
      const q4 = Math.round(spoTotal * 0.10);
      const installmentAmounts = [q123, q123, q4];
      const installmentDays  = [91, 182, 274];
      const installmentLabels = ['Q2/4', 'Q3/4', 'Q4/4'];
      for (let i = 0; i < 3; i++) {
        const scheduledFor = addDays(today, installmentDays[i]);
        await createScheduledInvoice({
          enrollmentLinkId: linkId,
          studentEmail: sEmail,
          installmentNumber: i + 2,
          amountPaise: installmentAmounts[i],
          currency: 'INR',
          scheduledFor,
          description: `${platformName} enrollment — ${btLbl} — Grade ${g} — ${installmentLabels[i]} SPO (${cat.replace(/_/g, ' ')})`,
        });
      }
    }

    // Create payment order
    const order = await createPaymentOrder({
      invoiceId: String(invoice.id),
      amountPaise: totalAmountPaise,
      currency: 'INR',
      studentEmail: (link.student_email as string) || '',
      studentName: String(link.student_name || link.student_email),
      description,
    });

    const token = generatePayToken(String(invoice.id));

    return NextResponse.json({
      success: true,
      data: { invoice_id: String(invoice.id), token, order, payment_plan: paymentPlan },
    });
  } catch (err) {
    console.error('[enroll/POST] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
