// ═══════════════════════════════════════════════════════════════
// Ghost Dashboard — /ghost
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import GhostDashboardClient from './GhostDashboardClient';

export default async function GhostPage() {
  const user = await requireRole('ghost');
  const permissions = await getEffectivePermissions(user.id, user.role);

  return (
    <GhostDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
