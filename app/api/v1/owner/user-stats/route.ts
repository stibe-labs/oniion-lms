// ═══════════════════════════════════════════════════════════════
// Owner User Stats — GET /api/v1/owner/user-stats
// Returns count of portal_users grouped by role
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || user.role !== 'owner')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT portal_role AS role, COUNT(*)::int AS count
     FROM portal_users
     WHERE is_active = true
     GROUP BY portal_role
     ORDER BY count DESC`
  );

  return NextResponse.json({ success: true, data: { stats: result.rows } });
}
