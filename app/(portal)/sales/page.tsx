// ═══════════════════════════════════════════════════════════════
// Sales CRM Dashboard — /sales
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import SalesDashboardClient from './SalesDashboardClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Sales CRM · ${n}` };
}

export default async function SalesPage() {
  const user = await requireRole('sales');
  const permissions = await getEffectivePermissions(user.id, user.role);

  return (
    <SalesDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
