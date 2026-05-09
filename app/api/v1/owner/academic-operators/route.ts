// ═══════════════════════════════════════════════════════════════
// Owner — Academic Operators API
// GET  /api/v1/owner/academic-operators
//   → Returns all AO users with student + batch counts, and the
//     current default_academic_operator setting.
// PUT  /api/v1/owner/academic-operators
//   Body: { default_email: string }
//   → Sets the default academic operator in academic_settings.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function requireOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (!owner) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // All AO users with batch + student counts
    const aoResult = await db.query(`
      SELECT
        pu.email,
        pu.full_name,
        pu.is_active,
        pu.created_at,
        COUNT(DISTINCT b.batch_id) FILTER (WHERE b.batch_id IS NOT NULL) AS batch_count,
        COUNT(DISTINCT b.batch_id) FILTER (WHERE b.status = 'active') AS active_batch_count,
        COUNT(DISTINCT bs.student_email) AS student_count
      FROM portal_users pu
      LEFT JOIN batches b ON b.academic_operator_email = pu.email
      LEFT JOIN batch_students bs ON bs.batch_id = b.batch_id AND bs.student_status = 'active'
      WHERE pu.portal_role = 'academic_operator' AND pu.is_active = TRUE
      GROUP BY pu.email, pu.full_name, pu.is_active, pu.created_at
      ORDER BY pu.full_name
    `);

    // Current default AO setting
    const settingResult = await db.query(
      `SELECT setting_values FROM academic_settings WHERE setting_key = 'default_academic_operator'`
    );
    const settingValues = settingResult.rows[0]?.setting_values as string[] | undefined;
    const defaultAO = settingValues?.[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        aos: aoResult.rows,
        defaultAO,
      },
    });
  } catch (err) {
    console.error('[owner/academic-operators] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch academic operators' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const owner = await requireOwner(req);
  if (!owner) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: { default_email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { default_email } = body;

  if (!default_email) {
    // Clear the default
    await db.query(
      `DELETE FROM academic_settings WHERE setting_key = 'default_academic_operator'`
    );
    return NextResponse.json({ success: true, data: { defaultAO: null } });
  }

  // Validate the email is actually an AO
  const check = await db.query(
    `SELECT email FROM portal_users WHERE email = $1 AND portal_role = 'academic_operator' AND is_active = TRUE`,
    [default_email]
  );
  if (check.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User is not an active academic operator' }, { status: 400 });
  }

  await db.query(
    `INSERT INTO academic_settings (setting_key, setting_values, updated_at)
     VALUES ('default_academic_operator', ARRAY[$1::text], NOW())
     ON CONFLICT (setting_key)
     DO UPDATE SET setting_values = ARRAY[$1::text], updated_at = NOW()`,
    [default_email]
  );

  return NextResponse.json({ success: true, data: { defaultAO: default_email } });
}
