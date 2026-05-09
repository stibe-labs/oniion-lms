import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';
import { getRegionGroup, getEnrollmentCategory, normalizeGrade, toFeeGrade, getActiveFee, isOfferActive } from '@/lib/enrollment-fee';
import { getPlatformName } from '@/lib/platform-config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';

/**
 * POST /api/v1/enrollment-links
 * Internal endpoint for AO / Owner to create enrollment links from portal dashboard.
 * Auth: JWT session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !['academic_operator', 'academic', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      student_name, student_phone, student_email, student_grade,
      student_board, student_region, preferred_batch_type,
      send_whatsapp,
    } = body as {
      student_name?: string;
      student_phone?: string;
      student_email?: string;
      student_grade?: string;
      student_board?: string;
      student_region?: string;
      preferred_batch_type?: string;
      send_whatsapp?: boolean;
    };

    if (!student_name?.trim() || !student_phone?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'student_name and student_phone are required' },
        { status: 400 },
      );
    }

    // Derive enrollment category if region + board provided
    const regionGroup = student_region ? getRegionGroup(student_region) : null;
    const enrollmentCategory = (student_region && student_board)
      ? getEnrollmentCategory(student_region, student_board)
      : null;

    const linkId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.query(
      `INSERT INTO enrollment_links (
        id, student_name, student_phone, student_email, student_grade,
        student_board, student_region, preferred_batch_type,
        enrollment_region_group, enrollment_category,
        source, created_by, status, expires_at, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'portal',$11,'pending',$12,NOW())`,
      [
        linkId,
        student_name.trim(),
        student_phone.trim(),
        student_email?.trim() || null,
        student_grade?.trim() || null,
        student_board?.trim() || null,
        student_region?.trim() || null,
        preferred_batch_type?.trim() || null,
        regionGroup,
        enrollmentCategory,
        user.id,
        expiresAt.toISOString(),
      ],
    );

    const enrollmentUrl = `${BASE_URL}/enroll/${linkId}`;

    // Look up fee if we have enough info
    let feeInfo = '';
    if (enrollmentCategory && preferred_batch_type && student_grade) {
      const gradeNorm = toFeeGrade(normalizeGrade(student_grade));
      const feeResult = await db.query(
        `SELECT fee_paise, early_bird_fee_paise, offer_label, offer_expires_at, fee_unit, show_per_class_only
         FROM enrollment_fee_structure
         WHERE region_group = $1 AND board = $2 AND batch_type = $3 AND grade IN ($4, 'all')
           AND is_active = true AND academic_year = '2026-27'
         ORDER BY (grade = $4) DESC
         LIMIT 1`,
        [regionGroup, student_board, preferred_batch_type, gradeNorm],
      );
      if (feeResult.rows.length > 0) {
        const row = feeResult.rows[0] as {
          fee_paise: number; early_bird_fee_paise: number | null;
          offer_label: string | null; offer_expires_at: string | null;
          fee_unit: string; show_per_class_only: boolean;
        };
        const activeFee = getActiveFee(row);
        const offerOn = isOfferActive(row);
        const isPerClass = row.show_per_class_only;
        const unit = isPerClass ? '/class' : '/year';
        const fmtFee = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
        if (offerOn && row.early_bird_fee_paise) {
          feeInfo = `\n\n💰 Fee: *${fmtFee(activeFee)}${unit}* (was ${fmtFee(row.fee_paise)}${unit}) — 🏷️ ${row.offer_label || 'Special Offer'}`;
        } else {
          feeInfo = `\n\n💰 Fee: ${fmtFee(activeFee)}${unit}${isPerClass ? ' (session advance)' : ' (all subjects included)'}`;
        }
      }
    }

    // Send WhatsApp if requested
    if (send_whatsapp !== false) {
      const cleanPhone = student_phone.replace(/\D/g, '');
      const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const gradeLine = student_grade ? ` (Grade ${student_grade})` : '';

      const platformName = await getPlatformName();
      const waMessage = `🎓 *${platformName} Classes — Enrollment*\n\nHi ${student_name}!${gradeLine}\n\nYou're one step away from starting your learning journey!${feeInfo}\n\nSelect your subjects and complete enrollment here:\n${enrollmentUrl}\n\nThis link is valid for 7 days. After payment, our team will add you to the right batch.\n\n— ${platformName} Classes`;

      try {
        await fireWhatsApp(
          `wa_portal_enroll_${linkId}`,
          waMessage,
          undefined,
          'stibe_alert',
          [student_name, `Complete your ${platformName} enrollment here: ${enrollmentUrl}`],
          normalizedPhone,
        );
      } catch (waErr) {
        console.error('[enrollment-links] WhatsApp send error (non-critical):', waErr);
      }
    }

    console.log(`[enrollment-links] ${user.id} created enrollment link ${linkId} for ${student_name}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { enrollment_link_id: linkId, enrollment_url: enrollmentUrl },
      message: send_whatsapp !== false ? 'Enrollment link created and WhatsApp sent' : 'Enrollment link created',
    }, { status: 201 });
  } catch (err) {
    console.error('[enrollment-links] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/v1/enrollment-links
 * List recent enrollment links (portal-created).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !['academic_operator', 'academic', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // AO sees own portal-created links + all CRM links; owner sees all
    let sql: string;
    let queryParams: unknown[];
    if (user.role === 'owner') {
      sql = `SELECT id, student_name, student_phone, student_email, student_grade,
                    status, created_by, source, expires_at, created_at
             FROM enrollment_links
             ORDER BY created_at DESC
             LIMIT 50`;
      queryParams = [];
    } else {
      sql = `SELECT id, student_name, student_phone, student_email, student_grade,
                    status, created_by, source, expires_at, created_at
             FROM enrollment_links
             WHERE source = 'crm' OR created_by = $1
             ORDER BY created_at DESC
             LIMIT 50`;
      queryParams = [user.id];
    }

    const { rows } = await db.query(sql, queryParams);

    return NextResponse.json<ApiResponse>({ success: true, data: rows });
  } catch (err) {
    console.error('[enrollment-links] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
