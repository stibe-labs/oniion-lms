// ═══════════════════════════════════════════════════════════════
// Batch Coordinator Cancellations — /batch-coordinator/cancellations
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import { redirect } from 'next/navigation';
import CancellationsClient from './CancellationsClient';

export default async function CancellationsPage() {
  const user = await requireRole('batch_coordinator');
  const permissions = await getEffectivePermissions(user.id, user.role);

  // Block if cancellations_manage permission is revoked
  if (permissions.cancellations_manage === false) redirect('/batch-coordinator');

  return (
    <CancellationsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
