import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import HRDashboardClient from './HRDashboardClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `HR Dashboard · ${n}` };
}

export default async function HRPage() {
  const user = await requireRole('hr', 'owner');
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
