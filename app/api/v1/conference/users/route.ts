import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * GET /api/v1/conference/users
 * ?type=staff      — owners, teachers, HRs, BCs, AOs
 * ?type=students   — all students
 * ?type=parents    — all parents
 * ?type=batch&batch_id=xxx — students + parents under a batch
 * ?type=batches    — list of active batches for dropdown
 */

const ALLOWED_ROLES = ['owner', 'academic_operator', 'academic'];

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'staff';

    if (type === 'batches') {
      const result = await db.query(
        `SELECT b.batch_id, b.batch_name, b.grade, b.section, b.board, b.status,
                (SELECT COUNT(*) FROM batch_students bs WHERE bs.batch_id = b.batch_id AND bs.student_status = 'active') AS student_count
         FROM batches b
         WHERE b.status = 'active'
         ORDER BY b.batch_name ASC`
      );
      return NextResponse.json<ApiResponse>({ success: true, data: result.rows });
    }

    if (type === 'staff') {
      const result = await db.query(
        `SELECT u.email, u.full_name, u.portal_role, u.phone AS portal_phone,
                up.whatsapp, up.phone AS profile_phone
         FROM portal_users u
         LEFT JOIN user_profiles up ON up.email = u.email
         WHERE u.portal_role IN ('owner','teacher','hr','batch_coordinator','academic_operator','academic')
           AND u.is_active = TRUE
         ORDER BY
           CASE u.portal_role
             WHEN 'owner' THEN 1
             WHEN 'academic_operator' THEN 2
             WHEN 'academic' THEN 2
             WHEN 'batch_coordinator' THEN 3
             WHEN 'hr' THEN 4
             WHEN 'teacher' THEN 5
           END,
           u.full_name ASC`
      );
      const users = result.rows.map((r: Record<string, unknown>) => ({
        email: r.email,
        name: r.full_name,
        role: r.portal_role,
        whatsapp: r.whatsapp || r.profile_phone || r.portal_phone || null,
      }));
      return NextResponse.json<ApiResponse>({ success: true, data: users });
    }

    if (type === 'students') {
      const result = await db.query(
        `SELECT u.email, u.full_name, u.phone AS portal_phone,
                up.whatsapp, up.phone AS profile_phone
         FROM portal_users u
         LEFT JOIN user_profiles up ON up.email = u.email
         WHERE u.portal_role = 'student' AND u.is_active = TRUE
         ORDER BY u.full_name ASC`
      );
      const users = result.rows.map((r: Record<string, unknown>) => ({
        email: r.email,
        name: r.full_name,
        role: 'student',
        whatsapp: r.whatsapp || r.profile_phone || r.portal_phone || null,
      }));
      return NextResponse.json<ApiResponse>({ success: true, data: users });
    }

    if (type === 'parents') {
      const result = await db.query(
        `SELECT u.email, u.full_name, u.phone AS portal_phone,
                up.whatsapp, up.phone AS profile_phone
         FROM portal_users u
         LEFT JOIN user_profiles up ON up.email = u.email
         WHERE u.portal_role = 'parent' AND u.is_active = TRUE
         ORDER BY u.full_name ASC`
      );
      const users = result.rows.map((r: Record<string, unknown>) => ({
        email: r.email,
        name: r.full_name,
        role: 'parent',
        whatsapp: r.whatsapp || r.profile_phone || r.portal_phone || null,
      }));
      return NextResponse.json<ApiResponse>({ success: true, data: users });
    }

    if (type === 'batch') {
      const batchId = searchParams.get('batch_id');
      if (!batchId) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'batch_id required' }, { status: 400 });
      }
      const result = await db.query(
        `SELECT
           bs.student_email,
           su.full_name AS student_name,
           su.phone AS student_portal_phone,
           sup.whatsapp AS student_whatsapp,
           sup.phone AS student_profile_phone,
           bs.parent_email,
           pu.full_name AS parent_name,
           pu.phone AS parent_portal_phone,
           pup.whatsapp AS parent_whatsapp,
           pup.phone AS parent_profile_phone
         FROM batch_students bs
         JOIN portal_users su ON su.email = bs.student_email
         LEFT JOIN user_profiles sup ON sup.email = bs.student_email
         LEFT JOIN portal_users pu ON pu.email = bs.parent_email
         LEFT JOIN user_profiles pup ON pup.email = bs.parent_email
         WHERE bs.batch_id = $1 AND bs.student_status = 'active'
         ORDER BY su.full_name ASC`,
        [batchId]
      );

      const students: Array<{ email: string; name: string; role: string; whatsapp: string | null }> = [];
      const parents: Array<{ email: string; name: string; role: string; whatsapp: string | null }> = [];
      const seenParents = new Set<string>();

      for (const r of result.rows) {
        students.push({
          email: String(r.student_email),
          name: String(r.student_name),
          role: 'student',
          whatsapp: (r.student_whatsapp || r.student_profile_phone || r.student_portal_phone || null) as string | null,
        });
        if (r.parent_email && !seenParents.has(String(r.parent_email))) {
          seenParents.add(String(r.parent_email));
          parents.push({
            email: String(r.parent_email),
            name: String(r.parent_name || r.parent_email),
            role: 'parent',
            whatsapp: (r.parent_whatsapp || r.parent_profile_phone || r.parent_portal_phone || null) as string | null,
          });
        }
      }

      return NextResponse.json<ApiResponse>({ success: true, data: { students, parents } });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid type parameter' }, { status: 400 });
  } catch (err) {
    console.error('[conference/users]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
