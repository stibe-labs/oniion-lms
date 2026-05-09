// ═══════════════════════════════════════════════════════════════
// Room Reminders Cron — DEPRECATED (2025-11)
// Replaced by /api/v1/batch-sessions/session-reminder which sends
// a single 15-min lobby-open notification with a persistent
// no-login token URL.
// This endpoint is kept as a 410-Gone so stale cron jobs don't
// accidentally re-trigger the old 30-min/5-min email flood.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message:
        'Replaced by POST /api/v1/batch-sessions/session-reminder (single 15-min lobby reminder).',
    },
    { status: 410 },
  );
}
