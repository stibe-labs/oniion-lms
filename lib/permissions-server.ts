// ═══════════════════════════════════════════════════════════════
// stibe Portal — Server-side Permission Checks
// ═══════════════════════════════════════════════════════════════
// Use in server components (page.tsx) to fetch and check
// permissions before rendering dashboard pages.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mergePermissions, type PermissionMap } from '@/lib/permissions';

/**
 * Fetch the effective permissions for a user from the database.
 * Merges role defaults with any custom overrides.
 * Owner always gets an empty map (all permissions are granted implicitly).
 */
export async function getEffectivePermissions(
  email: string,
  role: string,
): Promise<PermissionMap> {
  if (role === 'owner') return {};

  const result = await db.query(
    'SELECT custom_permissions FROM portal_users WHERE email = $1',
    [email]
  );

  const customPermissions: PermissionMap =
    result.rows.length > 0
      ? ((result.rows[0] as { custom_permissions: PermissionMap }).custom_permissions ?? {})
      : {};

  return mergePermissions(role, customPermissions);
}
