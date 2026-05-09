// ═══════════════════════════════════════════════════════════════
// Owner → Exams Management — Server Page
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import ExamsClient from './ExamsClient';

export default async function ExamsPage() {
  const user = await requireRole('owner');
  return <ExamsClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
