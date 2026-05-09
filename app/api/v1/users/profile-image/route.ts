// ═══════════════════════════════════════════════════════════════
// Profile Image API — GET /api/v1/users/profile-image
// Returns { profile_image } for the authenticated user.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const res = await db.query(
    `SELECT profile_image FROM portal_users WHERE email = $1`,
    [user.id],
  );

  return NextResponse.json({
    success: true,
    data: { profile_image: (res.rows[0] as Record<string, unknown>)?.profile_image || null },
  });
}
