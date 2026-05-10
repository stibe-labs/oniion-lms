import { requireRole } from '@/lib/auth-utils';
import DashboardShell from '@/components/dashboard/DashboardShell';
import SuperadminOverview from './SuperadminOverview';

export const metadata = { title: 'Superadmin · Overview' };

export default async function SuperadminPage() {
  const user = await requireRole('superadmin');

  return (
    <DashboardShell role={user.role} userName={user.name} userEmail={user.id}>
      <SuperadminOverview user={user} />
    </DashboardShell>
  );
}
