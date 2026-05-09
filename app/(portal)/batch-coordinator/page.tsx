// ═══════════════════════════════════════════════════════════════
// Batch Coordinator Dashboard — /batch-coordinator
// ═══════════════════════════════════════════════════════════════
// Create rooms, assign teacher/students, send notifications,
// monitor live/scheduled/ended rooms.
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import CoordinatorDashboardClient from './CoordinatorDashboardClient';

export default async function CoordinatorPage() {
  const user = await requireRole('batch_coordinator');
  const permissions = await getEffectivePermissions(user.id, user.role);

  return (
    <CoordinatorDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
