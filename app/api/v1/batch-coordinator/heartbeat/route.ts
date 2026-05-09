// ═══════════════════════════════════════════════════════════════
// POST /api/v1/batch-coordinator/heartbeat
// Lightweight endpoint — BC pings this every ~15s from Live Monitor
// Updates portal_users.last_heartbeat_at for presence detection
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !['batch_coordinator', 'owner', 'academic_operator'].includes(user.role)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  await db.query(
    `UPDATE portal_users SET last_heartbeat_at = NOW() WHERE email = $1`,
    [user.id]
  );

  return NextResponse.json({ success: true });
}
