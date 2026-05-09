// ═══════════════════════════════════════════════════════════════
// Server-side user getter for dashboard pages
// ═══════════════════════════════════════════════════════════════

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import type { PortalUser } from '@/types';

/**
 * Get authenticated user or redirect to login.
 * Use in server components: const user = await getServerUser();
 */
export async function getServerUser(): Promise<PortalUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect('/login');

  const user = await verifySession(token);
  if (!user) redirect('/login');

  // Verify user still exists and is active in DB (catches deleted/deactivated accounts
  // that still have a valid JWT cookie)
  const dbCheck = await db.query<{ is_active: boolean }>(
    'SELECT is_active FROM portal_users WHERE email = $1',
    [user.id]
  );
  if (dbCheck.rows.length === 0 || !dbCheck.rows[0].is_active) {
    // Redirect through a route handler that can clear the cookie
    redirect('/api/v1/auth/revoke-session');
  }

  return user;
}

/**
 * Get user and ensure they have the required role.
 * Redirects to their correct dashboard if role mismatch.
 */
export async function requireRole(...roles: string[]): Promise<PortalUser> {
  const user = await getServerUser();

  if (!roles.includes(user.role)) {
    // Superadmin and owner can access everything
    if (user.role === 'superadmin' || user.role === 'owner') return user;

    const dashMap: Record<string, string> = {
      batch_coordinator:   '/batch-coordinator',
      academic_operator:  '/academic-operator',
      academic:           '/academic-operator', // legacy alias
      hr:                 '/hr',
      teacher:            '/teacher',
      student:            '/student',
      parent:             '/parent',
      owner:              '/owner',
      ghost:              '/ghost',
      sales:              '/sales',
      superadmin:         '/superadmin',
    };
    redirect(dashMap[user.role] || '/login');
  }

  return user;
}
