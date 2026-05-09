// ═══════════════════════════════════════════════════════════════
// Academic Operator Dashboard — /academic-operator
// ═══════════════════════════════════════════════════════════════
// Creates rooms, assigns teachers & students, sends notifications.
// Per doc: Academic Operator owns batch creation and assignment.
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import AcademicOperatorDashboardClient from './AcademicOperatorDashboardClient';

export default async function AcademicOperatorPage() {
  const user = await requireRole('academic_operator');

  return (
    <AcademicOperatorDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
