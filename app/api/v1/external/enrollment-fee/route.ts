// GET /api/v1/external/enrollment-fee
// Called by Stibe CRM to look up the fee for a given grade/board/region/batch_type.
// Auth: X-API-Key header.
//
// Query params:
//   grade         — "8", "9", "10", "11"
//   board         — "CBSE" | "State Board"
//   region        — "Dubai", "Kerala", etc.
//   batch_type    — "one_to_one", "one_to_three", etc.
//   academic_year — optional, defaults to "2026-27"
//
// Returns:
//   fee_paise, early_bird_fee_paise, fee_unit, currency,
//   show_per_class_only, offer_label, offer_expires_at,
//   active_fee_paise  (resolved: early bird if offer active, else annual),
//   offer_active      (bool)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRegionGroup, getActiveFee, isOfferActive, normalizeGrade, toFeeGrade } from '@/lib/enrollment-fee';

const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawGrade   = searchParams.get('grade') ?? '';
    const board      = searchParams.get('board') ?? 'CBSE';
    const region     = searchParams.get('region') ?? '';
    const batchType  = searchParams.get('batch_type') ?? '';
    const year       = searchParams.get('academic_year') ?? '2026-27';

    // ?all=true — return every active fee row (for full matrix display in CRM)
    if (searchParams.get('all') === 'true') {
      const allRes = await db.query<{
        region_group: string; board: string; batch_type: string; grade: string;
        fee_paise: number; early_bird_fee_paise: number | null; fee_unit: string;
        currency: string; show_per_class_only: boolean;
        offer_label: string | null; offer_expires_at: string | null;
      }>(
        `SELECT region_group, board, batch_type, grade,
                fee_paise, early_bird_fee_paise, fee_unit, currency,
                show_per_class_only, offer_label, offer_expires_at
         FROM enrollment_fee_structure
         WHERE academic_year = $1 AND is_active = true
         ORDER BY region_group, board, batch_type, grade`,
        [year],
      );
      const fees = allRes.rows.map(r => ({
        ...r,
        active_fee_paise: getActiveFee(r),
        offer_active: isOfferActive(r),
      }));
      return NextResponse.json({ success: true, data: { fees } });
    }

    // ?list_flat=true — return active flat-fee batch types (no region/board needed)
    if (searchParams.get('list_flat') === 'true') {
      const flatRes = await db.query<{ batch_type: string; batch_name: string | null }>(
        `SELECT batch_type, batch_name FROM enrollment_fee_structure
         WHERE fee_type = 'batch_flat' AND academic_year = $1 AND is_active = true
         ORDER BY created_at`,
        [year],
      );
      return NextResponse.json({ success: true, data: { flat_types: flatRes.rows } });
    }

    // ?list=true — return available batch types for region+board (no grade/batch required)
    if (searchParams.get('list') === 'true') {
      if (!region || !board) {
        return NextResponse.json({ success: false, error: 'region and board are required for list mode' }, { status: 400 });
      }
      const rg = getRegionGroup(region);
      const listRes = await db.query<{ batch_type: string }>(
        `SELECT DISTINCT batch_type FROM enrollment_fee_structure
         WHERE academic_year = $1 AND region_group = $2 AND board = $3 AND is_active = true
         ORDER BY batch_type`,
        [year, rg, board],
      );
      return NextResponse.json({ success: true, data: { batch_types: listRes.rows.map(r => r.batch_type) } });
    }

    if (!rawGrade || !region || !batchType) {
      return NextResponse.json(
        { success: false, error: 'grade, region and batch_type are required' },
        { status: 400 },
      );
    }

    const grade       = toFeeGrade(normalizeGrade(rawGrade));
    const regionGroup = getRegionGroup(region);

    // Try exact match first, then fall back to 'all' grade
    const res = await db.query<{
      id: string;
      fee_paise: number;
      early_bird_fee_paise: number | null;
      fee_unit: string;
      currency: string;
      show_per_class_only: boolean;
      offer_label: string | null;
      offer_expires_at: string | null;
    }>(
      `SELECT id, fee_paise, early_bird_fee_paise, fee_unit, currency,
              show_per_class_only, offer_label, offer_expires_at
       FROM enrollment_fee_structure
       WHERE academic_year = $1
         AND region_group  = $2
         AND board         = $3
         AND batch_type    = $4
         AND grade         IN ($5, 'all')
         AND is_active     = true
       ORDER BY (grade = $5) DESC
       LIMIT 1`,
      [year, regionGroup, board, batchType, grade],
    );

    if (res.rows.length === 0) {
      // Fallback: check for a batch_flat fee with this batch_type (special/improvement batches)
      // Filter by applicable_grades/regions/boards — '["all"]' means applies everywhere
      const flatRes = await db.query<{
        id: string; batch_name: string | null; fee_paise: number; currency: string;
        payment_gate_enabled: boolean; applicable_grades: string[]; applicable_regions: string[]; applicable_boards: string[];
      }>(
        `SELECT id, batch_name, fee_paise, currency, payment_gate_enabled,
                applicable_grades, applicable_regions, applicable_boards
         FROM enrollment_fee_structure
         WHERE fee_type = 'batch_flat' AND batch_type = $1 AND is_active = true
           AND (applicable_grades  @> '["all"]'::jsonb OR applicable_grades  @> to_jsonb(ARRAY[$2]))
           AND (applicable_regions @> '["all"]'::jsonb OR applicable_regions @> to_jsonb(ARRAY[$3]))
           AND (applicable_boards  @> '["all"]'::jsonb OR applicable_boards  @> to_jsonb(ARRAY[$4]))
         ORDER BY
           -- Prefer more specific rows (those with non-all arrays) over generic ones
           (CASE WHEN applicable_grades  = '["all"]'::jsonb THEN 0 ELSE 1 END +
            CASE WHEN applicable_regions = '["all"]'::jsonb THEN 0 ELSE 1 END +
            CASE WHEN applicable_boards  = '["all"]'::jsonb THEN 0 ELSE 1 END) DESC,
           created_at DESC
         LIMIT 1`,
        [batchType, grade, regionGroup, board],
      );
      if (flatRes.rows.length > 0) {
        const flat = flatRes.rows[0];
        return NextResponse.json({
          success: true,
          data: {
            fee_type:             'batch_flat',
            is_gate:              flat.payment_gate_enabled,
            batch_name:           flat.batch_name,
            fee_paise:            flat.fee_paise,
            early_bird_fee_paise: null,
            active_fee_paise:     flat.fee_paise,
            fee_unit:             'batch_flat',
            currency:             flat.currency,
            show_per_class_only:  false,
            offer_label:          null,
            offer_expires_at:     null,
            offer_active:         false,
            region_group:         'all',
            grade:                'all',
            board:                'all',
            batch_type:           batchType,
            academic_year:        year,
          },
        });
      }
      return NextResponse.json(
        { success: false, error: 'No fee configured for this combination', fee: null },
        { status: 404 },
      );
    }

    const row = res.rows[0];
    const activeFee   = getActiveFee(row);
    const offerActive = isOfferActive(row);

    return NextResponse.json({
      success: true,
      data: {
        fee_paise:            row.fee_paise,
        early_bird_fee_paise: row.early_bird_fee_paise,
        active_fee_paise:     activeFee,
        fee_unit:             row.fee_unit,
        currency:             row.currency,
        show_per_class_only:  row.show_per_class_only,
        offer_label:          row.offer_label,
        offer_expires_at:     row.offer_expires_at,
        offer_active:         offerActive,
        region_group:         regionGroup,
        grade,
        board,
        batch_type:           batchType,
        academic_year:        year,
      },
    });
  } catch (err) {
    console.error('[external/enrollment-fee] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
