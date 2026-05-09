import { requireRole } from '@/lib/auth-utils';
import DashboardShell from '@/components/dashboard/DashboardShell';
import SuperadminClient from './SuperadminClient';

export const metadata = { title: 'Superadmin · Platform Settings' };

export default async function SuperadminPage() {
  const user = await requireRole('superadmin');

  return (
    <DashboardShell role={user.role} userName={user.name} userEmail={user.id}>
      <SuperadminClient user={user} />
    </DashboardShell>
  );
}
