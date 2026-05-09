// ═══════════════════════════════════════════════════════════════
// Batch Coordinator Admissions — /batch-coordinator/admissions
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import { redirect } from 'next/navigation';
import AdmissionsClient from './AdmissionsClient';

export default async function AdmissionsPage() {
  const user = await requireRole('batch_coordinator');
  const permissions = await getEffectivePermissions(user.id, user.role);

  // Block if admissions_manage permission is revoked
  if (permissions.admissions_manage === false) redirect('/batch-coordinator');

  return (
    <AdmissionsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
