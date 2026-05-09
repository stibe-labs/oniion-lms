// ═══════════════════════════════════════════════════════════════
// Extra Time Fee Rates — GET/POST/DELETE /api/v1/payment/extra-time-rates
// Owner-configurable fee tiers for session extension requests
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import type { ApiResponse } from '@/types';

// GET — List all active extra time rates
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    const result = await db.query(
      `SELECT id, duration_minutes, rate_paise, currency, label, is_active, created_at
       FROM extra_time_rates
       WHERE is_active = true
       ORDER BY duration_minutes ASC`
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { rates: result.rows },
    });
  } catch (err) {
    console.error('[extra-time-rates] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update extra time rates (owner only)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'owner') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only owner can manage extra time rates' }, { status: 403 });
    }

    const body = await req.json();
    const { rates } = body as {
      rates: Array<{ duration_minutes: number; rate_paise: number; currency?: string; label?: string }>;
    };

    if (!Array.isArray(rates) || rates.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'rates array is required' }, { status: 400 });
    }

    const VALID_DURATIONS = [30, 60, 120];
    const VALID_CURRENCIES = ['INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'];

    for (const r of rates) {
      if (!VALID_DURATIONS.includes(r.duration_minutes)) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Invalid duration: ${r.duration_minutes}. Must be 30, 60, or 120.` }, { status: 400 });
      }
      if (typeof r.rate_paise !== 'number' || r.rate_paise < 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'rate_paise must be a non-negative number' }, { status: 400 });
      }
      if (r.currency && !VALID_CURRENCIES.includes(r.currency)) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Invalid currency: ${r.currency}` }, { status: 400 });
      }
    }

    // Upsert: deactivate existing rates for the same duration+currency, then insert new ones
    await db.withTransaction(async (client) => {
      for (const r of rates) {
        const currency = r.currency || 'INR';
        const label = r.label || (r.duration_minutes === 30 ? '30 Minutes' : r.duration_minutes === 60 ? '1 Hour' : '2 Hours');

        // Deactivate existing rate for this duration+currency
        await client.query(
          `UPDATE extra_time_rates SET is_active = false, updated_at = NOW()
           WHERE duration_minutes = $1 AND currency = $2 AND is_active = true`,
          [r.duration_minutes, currency]
        );

        // Insert new rate
        await client.query(
          `INSERT INTO extra_time_rates (duration_minutes, rate_paise, currency, label, is_active)
           VALUES ($1, $2, $3, $4, true)`,
          [r.duration_minutes, r.rate_paise, currency, label]
        );
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `${rates.length} extra time rate(s) saved`,
    });
  } catch (err) {
    console.error('[extra-time-rates] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove an extra time rate (owner only)
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'owner') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only owner can manage extra time rates' }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'id parameter required' }, { status: 400 });
    }

    await db.query(
      `UPDATE extra_time_rates SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return NextResponse.json<ApiResponse>({ success: true, message: 'Rate deleted' });
  } catch (err) {
    console.error('[extra-time-rates] DELETE error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
