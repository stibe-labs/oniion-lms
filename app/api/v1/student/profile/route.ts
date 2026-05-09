// ═══════════════════════════════════════════════════════════════
// Student Profile API — GET /api/v1/student/profile
// Returns the logged-in student's own profile from user_profiles
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !['student', 'owner'].includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const result = await db.query(
      `SELECT
         u.full_name AS name, u.email,
         up.phone, up.whatsapp, up.date_of_birth,
         up.grade, up.section, up.board,
         up.parent_email, up.parent_phone, up.admission_date, up.notes,
         up.address, up.category
       FROM portal_users u
       LEFT JOIN user_profiles up ON up.email = u.email
       WHERE u.email = $1`,
      [user.id]
    );

    if (result.rows.length === 0)
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[student/profile] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
