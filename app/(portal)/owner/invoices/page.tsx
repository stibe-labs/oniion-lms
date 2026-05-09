// ═══════════════════════════════════════════════════════
// Owner → Fees & Invoices — Server Page
// ═══════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import FeesClient from './FeesClient';

export default async function FeesPage() {
  const user = await requireRole('owner');
  return <FeesClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
