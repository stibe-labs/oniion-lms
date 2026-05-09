// ═══════════════════════════════════════════════════════════════
// Owner — Students by Academic Operator
// GET  /api/v1/owner/academic-operators/[email]/students
//   → Returns all students in this AO's scope:
//     - enrolled in any of this AO's batches, OR
//     - created_by = this AO's email
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const owner = await requireOwner(req);
  if (!owner) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email: rawEmail } = await params;
  const aoEmail = decodeURIComponent(rawEmail).toLowerCase();

  try {
    const result = await db.query(`
      SELECT DISTINCT
        pu.email,
        pu.full_name,
        pu.is_active,
        pu.created_at,
        up.grade,
        up.board,
        up.phone,
        b.batch_name,
        b.batch_id,
        b.status AS batch_status,
        bs.student_status
      FROM portal_users pu
      LEFT JOIN user_profiles up ON up.email = pu.email
      LEFT JOIN batch_students bs ON bs.student_email = pu.email
      LEFT JOIN batches b ON b.batch_id = bs.batch_id AND b.academic_operator_email = $1
      WHERE pu.portal_role = 'student'
        AND (
          EXISTS (
            SELECT 1 FROM batch_students bs2
            JOIN batches b2 ON b2.batch_id = bs2.batch_id
            WHERE b2.academic_operator_email = $1
              AND bs2.student_email = pu.email
          )
          OR pu.created_by = $1
        )
      ORDER BY pu.full_name
    `, [aoEmail]);

    return NextResponse.json({ success: true, data: { students: result.rows } });
  } catch (err) {
    console.error('[owner/academic-operators/students] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
  }
}
