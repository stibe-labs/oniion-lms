import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Monitoring Tuning — global AI monitoring behavior switches
 * Managed by Academic Operators / Owners. Applies to all live classroom
 * attention monitors.
 */
export interface MonitoringTuning {
  writing_aware_mode: boolean;         // treat note-taking as engaged time
  mobile_relaxed_thresholds: boolean;  // relax thresholds on mobile devices
  exam_strict_mode: boolean;           // disable writing-aware for exam sessions
  low_visibility_fallback: boolean;    // emit low_visibility instead of false positives
}

const DEFAULTS: MonitoringTuning = {
  writing_aware_mode: true,
  mobile_relaxed_thresholds: true,
  exam_strict_mode: false,
  low_visibility_fallback: true,
};

async function getTuning(): Promise<MonitoringTuning> {
  const { rows } = await db.query(
    `SELECT setting_values FROM academic_settings WHERE setting_key = 'monitoring_tuning'`,
  );
  const row = rows[0] as { setting_values?: string[] } | undefined;
  if (row?.setting_values?.[0]) {
    try {
      return { ...DEFAULTS, ...JSON.parse(row.setting_values[0]) };
    } catch { /* fallback */ }
  }
  return DEFAULTS;
}

/**
 * GET /api/v1/monitoring-tuning
 * Returns current monitoring tuning config. Authenticated users can read.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const tuning = await getTuning();
    return NextResponse.json<ApiResponse>({ success: true, data: tuning });
  } catch (err) {
    console.error('[monitoring-tuning] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/monitoring-tuning
 * Updates one or more tuning toggles. AO/Owner only.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !['academic_operator', 'academic', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const current = await getTuning();

    const allowedKeys = Object.keys(DEFAULTS) as (keyof MonitoringTuning)[];
    for (const key of allowedKeys) {
      if (typeof body[key] === 'boolean') {
        current[key] = body[key];
      }
    }

    const jsonStr = JSON.stringify(current);
    await db.query(
      `INSERT INTO academic_settings (setting_key, setting_values)
       VALUES ('monitoring_tuning', ARRAY[$1])
       ON CONFLICT (setting_key) DO UPDATE SET setting_values = ARRAY[$1]`,
      [jsonStr],
    );

    console.log(`[monitoring-tuning] Updated by ${user.id}: ${jsonStr}`);

    return NextResponse.json<ApiResponse>({ success: true, data: current, message: 'Monitoring tuning updated' });
  } catch (err) {
    console.error('[monitoring-tuning] PATCH error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
