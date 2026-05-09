// ═══════════════════════════════════════════════════════════════
// Owner → Batch Management — Server Page
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import BatchesClient from './BatchesClient';

export default async function BatchesPage() {
  const user = await requireRole('owner');
  return <BatchesClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
