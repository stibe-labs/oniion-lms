// ═══════════════════════════════════════════════════════════════
// Owner Dashboard — /owner
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import OwnerDashboardClient from './OwnerDashboardClient';

export default async function OwnerPage() {
  const user = await requireRole('owner');

  return (
    <OwnerDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
