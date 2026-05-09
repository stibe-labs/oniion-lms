// ═══════════════════════════════════════════════════════════════
// Parent Dashboard — /parent
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import ParentDashboardClient from './ParentDashboardClient';

export default async function ParentPage() {
  const user = await requireRole('parent');
  const permissions = await getEffectivePermissions(user.id, user.role);

  return (
    <ParentDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
