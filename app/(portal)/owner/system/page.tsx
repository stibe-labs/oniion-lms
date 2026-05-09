// ═══════════════════════════════════════════════════════════════
// Owner → System Settings — Server Page
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import SystemClient from './SystemClient';

export default async function SystemPage() {
  const user = await requireRole('owner');
  return <SystemClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
