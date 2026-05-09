// ═══════════════════════════════════════════════════════════════
// Enrollment Fee Structure CRUD — /api/v1/payment/enrollment-fees
// Owner & HR only. Manage enrollment_fee_structure rows.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

function authorize(role: string) {
  return ['owner', 'hr'].includes(role);
}

// GET — list all enrollment fee structure rows
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'hr', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = url.searchParams.get('academic_year') || '2026-27';

    // Standard enrollment fees
    const result = await db.query(
      `SELECT * FROM enrollment_fee_structure
       WHERE academic_year = $1 AND is_active = true AND (fee_type IS NULL OR fee_type = 'enrollment')
       ORDER BY region_group, board, batch_type,
                CASE grade WHEN 'HSS' THEN 99 ELSE CAST(NULLIF(REGEXP_REPLACE(grade, '[^0-9]', '', 'g'), '') AS INT) END NULLS LAST`,
      [year],
    );

    // Batch flat fees
    const flatResult = await db.query(
      `SELECT * FROM enrollment_fee_structure
       WHERE academic_year = $1 AND is_active = true AND fee_type = 'batch_flat'
       ORDER BY created_at DESC`,
      [year],
    );

    return NextResponse.json({ success: true, data: { fees: result.rows, batch_flat_fees: flatResult.rows } });
  } catch (err) {
    console.error('[enrollment-fees] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create or update a fee row
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !authorize(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id, academic_year, region_group, board, batch_type, grade,
      fee_paise, early_bird_fee_paise, fee_unit, currency, notes,
      offer_label, offer_expires_at, show_per_class_only,
      // batch_flat fields
      fee_type, batch_name, payment_gate_enabled,
      applicable_grades, applicable_regions, applicable_boards,
    } = body as {
      id?: string;
      academic_year?: string;
      region_group?: string;
      board?: string;
      batch_type?: string;
      grade?: string;
      fee_paise?: number;
      early_bird_fee_paise?: number | null;
      fee_unit?: string;
      currency?: string;
      notes?: string;
      offer_label?: string | null;
      offer_expires_at?: string | null;
      show_per_class_only?: boolean;
      fee_type?: string;
      batch_name?: string;
      payment_gate_enabled?: boolean;
      applicable_grades?: string[];
      applicable_regions?: string[];
      applicable_boards?: string[];
    };

    const isBatchFlat = fee_type === 'batch_flat';
    const isCustomBatch = batch_type === 'custom' || batch_type === 'improvement_batch';

    // batch_flat fees only need a batch_name and fee_paise
    if (isBatchFlat) {
      if (!batch_name?.trim() || !fee_paise || fee_paise <= 0) {
        return NextResponse.json({ success: false, error: 'batch_name and fee_paise are required for batch flat fees' }, { status: 400 });
      }
    } else {
      if (!batch_type || (!isCustomBatch && (!region_group || !board || !grade)) || !fee_paise || fee_paise <= 0) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }
    }

    // Auto-set show_per_class_only for 1:1 and 1:3
    const resolvedShowPerClass = batch_type === 'one_to_one' || batch_type === 'one_to_three'
      ? true
      : (show_per_class_only ?? false);

    // Validate offer_expires_at if provided
    if (offer_expires_at) {
      const expiry = new Date(offer_expires_at);
      if (isNaN(expiry.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid offer_expires_at date' }, { status: 400 });
      }
    }

    // ── batch_flat: insert without unique constraint (each entry is its own batch fee) ──
    if (isBatchFlat) {
      const gradesJson  = JSON.stringify(applicable_grades?.length  ? applicable_grades  : ['all']);
      const regionsJson = JSON.stringify(applicable_regions?.length ? applicable_regions : ['all']);
      const boardsJson  = JSON.stringify(applicable_boards?.length  ? applicable_boards  : ['all']);
      if (id) {
        const result = await db.query(
          `UPDATE enrollment_fee_structure
           SET fee_paise = $1, currency = COALESCE($2, currency), notes = $3,
               batch_name = $4, payment_gate_enabled = $5, fee_unit = 'batch_flat',
               applicable_grades = $6::jsonb, applicable_regions = $7::jsonb, applicable_boards = $8::jsonb
           WHERE id = $9
           RETURNING *`,
          [fee_paise, currency, notes ?? null, batch_name!.trim(), payment_gate_enabled ?? false,
           gradesJson, regionsJson, boardsJson, id],
        );
        if (result.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Fee row not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: result.rows[0] });
      }
      const result = await db.query(
        `INSERT INTO enrollment_fee_structure
           (academic_year, region_group, board, batch_type, grade,
            fee_paise, fee_unit, currency, notes,
            fee_type, batch_name, payment_gate_enabled, show_per_class_only,
            is_active,
            applicable_grades, applicable_regions, applicable_boards)
         VALUES ($1, 'all', 'all', COALESCE($2, 'custom'), 'all',
                 $3, 'batch_flat', $4, $5,
                 'batch_flat', $6, $7, false,
                 true,
                 $8::jsonb, $9::jsonb, $10::jsonb)
         ON CONFLICT (academic_year, region_group, board, batch_type, grade)
         DO UPDATE SET
           fee_paise            = EXCLUDED.fee_paise,
           currency             = EXCLUDED.currency,
           notes                = EXCLUDED.notes,
           batch_name           = EXCLUDED.batch_name,
           payment_gate_enabled = EXCLUDED.payment_gate_enabled,
           applicable_grades    = EXCLUDED.applicable_grades,
           applicable_regions   = EXCLUDED.applicable_regions,
           applicable_boards    = EXCLUDED.applicable_boards,
           is_active            = true
         RETURNING *`,
        [
          academic_year || '2026-27', batch_type || 'custom',
          fee_paise, currency || 'INR', notes ?? null,
          batch_name!.trim(), payment_gate_enabled ?? false,
          gradesJson, regionsJson, boardsJson,
        ],
      );
      return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
    }

    // ── Standard enrollment fee (existing logic) ──

    // Update existing
    if (id) {
      const result = await db.query(
        `UPDATE enrollment_fee_structure
         SET fee_paise = $1, early_bird_fee_paise = $2, fee_unit = COALESCE($3, fee_unit),
             currency = COALESCE($4, currency), notes = $5,
             region_group = COALESCE($6, region_group), board = COALESCE($7, board),
             batch_type = COALESCE($8, batch_type), grade = COALESCE($9, grade),
             offer_label = $10, offer_expires_at = $11, show_per_class_only = $12
         WHERE id = $13
         RETURNING *`,
        [
          fee_paise, early_bird_fee_paise ?? null, fee_unit, currency, notes ?? null,
          region_group ?? null, board ?? null, batch_type, grade ?? 'all',
          offer_label ?? null, offer_expires_at ?? null, resolvedShowPerClass, id,
        ],
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Fee row not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: result.rows[0] });
    }

    // Create new — upsert on unique constraint
    const effectiveRegion = region_group ?? 'Kerala';
    const effectiveBoard = board ?? 'CBSE';
    const effectiveGrade = grade ?? 'all';
    const result = await db.query(
      `INSERT INTO enrollment_fee_structure
         (academic_year, region_group, board, batch_type, grade,
          fee_paise, early_bird_fee_paise, fee_unit, currency, notes,
          offer_label, offer_expires_at, show_per_class_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (academic_year, region_group, board, batch_type, grade)
       DO UPDATE SET
         fee_paise            = EXCLUDED.fee_paise,
         early_bird_fee_paise = EXCLUDED.early_bird_fee_paise,
         fee_unit             = EXCLUDED.fee_unit,
         currency             = EXCLUDED.currency,
         notes                = EXCLUDED.notes,
         offer_label          = EXCLUDED.offer_label,
         offer_expires_at     = EXCLUDED.offer_expires_at,
         show_per_class_only  = EXCLUDED.show_per_class_only,
         is_active            = true
       RETURNING *`,
      [
        academic_year || '2026-27', effectiveRegion, effectiveBoard, batch_type, effectiveGrade,
        fee_paise, early_bird_fee_paise ?? null, fee_unit || 'per_class', currency || 'INR', notes ?? null,
        offer_label ?? null, offer_expires_at ?? null, resolvedShowPerClass,
      ],
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[enrollment-fees] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — bulk offer control (end now / set expiry / re-enable)
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !authorize(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { action, offer_expires_at, academic_year, id: patchId } = body as {
      action: 'end_now' | 'set_expiry' | 'reenable' | 'toggle_gate';
      offer_expires_at?: string;
      academic_year?: string;
      id?: string;
    };
    const year = academic_year || '2026-27';

    // ── Toggle payment gate for a specific batch_flat row ──
    if (action === 'toggle_gate') {
      if (!patchId) return NextResponse.json({ success: false, error: 'id required for toggle_gate' }, { status: 400 });
      const result = await db.query(
        `UPDATE enrollment_fee_structure
         SET payment_gate_enabled = NOT payment_gate_enabled
         WHERE id = $1 AND fee_type = 'batch_flat'
         RETURNING id, payment_gate_enabled`,
        [patchId],
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Row not found or not a batch_flat fee' }, { status: 404 });
      }
      const row = result.rows[0] as { id: string; payment_gate_enabled: boolean };
      return NextResponse.json({ success: true, data: row });
    }

    if (action === 'end_now') {
      await db.query(
        `UPDATE enrollment_fee_structure
         SET offer_expires_at = NOW()
         WHERE academic_year = $1 AND is_active = true AND early_bird_fee_paise IS NOT NULL`,
        [year],
      );
    } else if (action === 'set_expiry') {
      if (!offer_expires_at) return NextResponse.json({ success: false, error: 'offer_expires_at required' }, { status: 400 });
      const expiry = new Date(offer_expires_at);
      if (isNaN(expiry.getTime())) return NextResponse.json({ success: false, error: 'Invalid date' }, { status: 400 });
      await db.query(
        `UPDATE enrollment_fee_structure
         SET offer_expires_at = $1
         WHERE academic_year = $2 AND is_active = true AND early_bird_fee_paise IS NOT NULL`,
        [expiry.toISOString(), year],
      );
    } else if (action === 'reenable') {
      await db.query(
        `UPDATE enrollment_fee_structure
         SET offer_expires_at = NULL
         WHERE academic_year = $1 AND is_active = true AND early_bird_fee_paise IS NOT NULL`,
        [year],
      );
    } else {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[enrollment-fees] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — soft delete a fee row
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !authorize(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const result = await db.query(
      `UPDATE enrollment_fee_structure SET is_active = false WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[enrollment-fees] DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
