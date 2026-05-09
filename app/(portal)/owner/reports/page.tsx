// ═══════════════════════════════════════════════════════════════
// Owner Reports — /owner/reports
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const user = await requireRole('owner');
  return (
    <ReportsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
