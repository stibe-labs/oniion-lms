// ═══════════════════════════════════════════════════════════════
// Owner → Roles — Server Page
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import RolesClient from './RolesClient';

export default async function RolesPage() {
  const user = await requireRole('owner');
  return <RolesClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
