import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export interface TeacherControls {
  go_live_skip_coordinator: boolean;
  allow_go_live_before_schedule: boolean;
  end_class_skip_coordinator: boolean;
  allow_session_extend: boolean;
  allow_homework_create: boolean;
  allow_exam_push: boolean;
  allow_recording: boolean;
  free_rejoin: boolean;
}

const DEFAULTS: TeacherControls = {
  go_live_skip_coordinator: false,
  allow_go_live_before_schedule: false,
  end_class_skip_coordinator: false,
  allow_session_extend: true,
  allow_homework_create: true,
  allow_exam_push: true,
  allow_recording: true,
  free_rejoin: false,
};

async function getControls(): Promise<TeacherControls> {
  const { rows } = await db.query(
    `SELECT setting_values FROM academic_settings WHERE setting_key = 'teacher_controls'`,
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
 * GET /api/v1/teacher-controls — fetch current teacher control toggles
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const controls = await getControls();
    return NextResponse.json<ApiResponse>({ success: true, data: controls });
  } catch (err) {
    console.error('[teacher-controls] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/teacher-controls — update teacher control toggles
 * Body: partial TeacherControls object, e.g. { go_live_skip_coordinator: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !['academic_operator', 'academic', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const current = await getControls();

    // Only allow known boolean keys
    const allowedKeys = Object.keys(DEFAULTS) as (keyof TeacherControls)[];
    for (const key of allowedKeys) {
      if (typeof body[key] === 'boolean') {
        current[key] = body[key];
      }
    }

    const jsonStr = JSON.stringify(current);
    await db.query(
      `INSERT INTO academic_settings (setting_key, setting_values)
       VALUES ('teacher_controls', ARRAY[$1])
       ON CONFLICT (setting_key) DO UPDATE SET setting_values = ARRAY[$1]`,
      [jsonStr],
    );

    console.log(`[teacher-controls] Updated by ${user.id}: ${jsonStr}`);

    return NextResponse.json<ApiResponse>({ success: true, data: current, message: 'Teacher controls updated' });
  } catch (err) {
    console.error('[teacher-controls] PATCH error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
