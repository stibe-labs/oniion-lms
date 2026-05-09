// ═══════════════════════════════════════════════════════════════
// Owner → Admin Management — Server Page
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import AdminsClient from './AdminsClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Admin Management · ${n}` };
}

export default async function AdminsPage() {
  const user = await requireRole('owner');
  return (
    <AdminsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
