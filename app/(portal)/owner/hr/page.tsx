import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import HRDashboardClient from '@/app/(portal)/hr/HRDashboardClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `HR Management · ${n}` };
}

export default async function OwnerHRPage() {
  const user = await requireRole('owner');
  const permissions = await getEffectivePermissions(user.id, user.role);
  return (
    <HRDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
