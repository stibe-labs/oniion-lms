// ═══════════════════════════════════════════════════════════════
// HR Stats API — GET /api/v1/hr/stats
// Returns headcount per role + recent signups for HR dashboard
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['hr', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Role counts
  const countsResult = await db.query<{ portal_role: string; total: string; active: string }>(
    `SELECT portal_role,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE is_active = TRUE) AS active
     FROM portal_users
     WHERE portal_role IN ('teacher','student','batch_coordinator','parent','hr','academic_operator')
     GROUP BY portal_role`
  );

  const counts: Record<string, { total: number; active: number }> = {};
  for (const row of countsResult.rows) {
    counts[row.portal_role] = { total: Number(row.total), active: Number(row.active) };
  }

  // Recent new users (last 10)
  const recentResult = await db.query(
    `SELECT email, full_name, portal_role, is_active, created_at
     FROM portal_users
     WHERE portal_role IN ('teacher','student','batch_coordinator','parent')
     ORDER BY created_at DESC
     LIMIT 10`
  );

  // Students without parent linked
  const orphanResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM portal_users u
     LEFT JOIN user_profiles p ON p.email = u.email
     WHERE u.portal_role = 'student'
       AND (p.parent_email IS NULL OR p.email IS NULL)`
  );

  // Teachers without subjects
  const noSubjectsResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM portal_users u
     LEFT JOIN user_profiles p ON p.email = u.email
     WHERE u.portal_role = 'teacher'
       AND (p.subjects IS NULL OR array_length(p.subjects, 1) IS NULL)`
  );

  return NextResponse.json({
    success: true,
    data: {
      counts,
      recent_users: recentResult.rows,
      alerts: {
        students_without_parent: Number(orphanResult.rows[0]?.count ?? 0),
        teachers_without_subjects: Number(noSubjectsResult.rows[0]?.count ?? 0),
      },
    },
  });
}
