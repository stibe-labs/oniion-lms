// ═══════════════════════════════════════════════════════════════
// GET /api/v1/users/search?q=priya&role=teacher&subject=Mathematics
// ═══════════════════════════════════════════════════════════════
// Search portal_users for coordinator assignment flow.
// Requires authenticated session (coordinator, academic_operator, or owner).
// Optional subject= param: when role=teacher, prioritizes teachers whose
// user_profiles.subjects array contains the given subject.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { searchUsers, getUsersByRole, searchTeachersBySubject, searchCoordinatorsWithBatchCount } from '@/lib/users';
import type { ApiResponse, PortalRole } from '@/types';

export async function GET(request: NextRequest) {
  // Auth check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifySession(token);
  if (!user || !['batch_coordinator', 'academic_operator', 'owner'].includes(user.role)) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const role = searchParams.get('role') as PortalRole | null;
  const subject = searchParams.get('subject') || '';

  try {
    // When searching teachers with a subject filter, use specialized query
    if (role === 'teacher' && subject) {
      const users = await searchTeachersBySubject(q, subject);
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { users: users.map(u => ({
          email: u.email,
          name: u.full_name,
          role: u.portal_role,
          phone: u.phone,
          subjects: u.subjects || [],
          matchesSubject: u.matches_subject ?? false,
        })) },
      });
    }

    // When searching coordinators, include active batch count
    if (role === 'batch_coordinator') {
      const users = await searchCoordinatorsWithBatchCount(q);
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { users: users.map(u => ({
          email: u.email,
          name: u.full_name,
          role: u.portal_role,
          phone: u.phone,
          batchCount: u.batch_count ?? 0,
        })) },
      });
    }

    const users = q
      ? await searchUsers(q, role || undefined)
      : role
        ? await getUsersByRole(role)
        : [];

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { users: users.map(u => ({
        email: u.email,
        name: u.full_name,
        role: u.portal_role,
        phone: u.phone,
        batchIds: u.batch_ids,
      })) },
    });
  } catch (error) {
    console.error('[User Search]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to search users' }, { status: 500 });
  }
}
