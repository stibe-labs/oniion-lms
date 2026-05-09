// ═══════════════════════════════════════════════════════════════
// Batches People API — Fetch available people for batch assignment
// GET /api/v1/batches/people?role=student|teacher|batch_coordinator|parent
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const role = url.searchParams.get('role') || 'all';
  const search = url.searchParams.get('q') || '';
  const categoryFilter = url.searchParams.get('category') || '';
  const gradeFilter = url.searchParams.get('grade') || '';

  const validRoles = ['student', 'teacher', 'batch_coordinator', 'parent', 'academic_operator'];

  let sql = `
    SELECT u.email, u.full_name, u.portal_role, u.is_active, u.profile_image,
           p.phone, p.subjects, p.grade, p.board, p.parent_email, p.category,
           p.assigned_region,
           par.full_name AS parent_name,
           (
             COALESCE(
               (
                 SELECT el.preferred_batch_type
                 FROM enrollment_links el
                 WHERE el.student_email = u.email AND el.status = 'paid' AND el.preferred_batch_type IS NOT NULL
                 ORDER BY el.created_at DESC
                 LIMIT 1
               ),
               p.preferred_batch_type
             )
           ) AS preferred_batch_type,
           COALESCE((
             SELECT json_agg(json_build_object('batch_id', b2.batch_id, 'batch_name', b2.batch_name))
             FROM batch_students bs2
             JOIN batches b2 ON b2.batch_id = bs2.batch_id
             WHERE bs2.student_email = u.email AND b2.status = 'active' AND bs2.student_status = 'active'
           ), '[]') AS current_batches
    FROM portal_users u
    LEFT JOIN user_profiles p ON p.email = u.email
    LEFT JOIN portal_users par ON par.email = p.parent_email
    WHERE u.is_active = TRUE
  `;
  const params: unknown[] = [];

  if (role !== 'all' && validRoles.includes(role)) {
    params.push(role);
    sql += ` AND u.portal_role = $${params.length}`;
  } else if (role === 'all') {
    sql += ` AND u.portal_role IN ('student', 'teacher', 'batch_coordinator', 'parent')`;
  }

  // AO batch creation: show all active students (AOs need to assign any student to batches,
  // regardless of which AO originally created them)

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  if (categoryFilter && ['A', 'B', 'C'].includes(categoryFilter)) {
    params.push(categoryFilter);
    sql += ` AND p.category = $${params.length}`;
  }

  if (gradeFilter) {
    params.push(gradeFilter);
    sql += ` AND p.grade = $${params.length}`;
  }

  sql += ` ORDER BY u.full_name ASC LIMIT 200`;
  const result = await db.query(sql, params);

  return NextResponse.json({ success: true, data: { people: result.rows } });
}
