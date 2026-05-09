// ═══════════════════════════════════════════════════════
// Owner → Payroll Management — Server Page
// ═══════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import PayrollClient from './PayrollClient';

export default async function PayrollPage() {
  const user = await requireRole('owner');
  return <PayrollClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
