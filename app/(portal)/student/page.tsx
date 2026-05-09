// ═══════════════════════════════════════════════════════════════
// Student Dashboard — /student
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import StudentDashboardClient from './StudentDashboardClient';

export default async function StudentPage() {
  const user = await requireRole('student');
  const permissions = await getEffectivePermissions(user.id, user.role);

  return (
    <StudentDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
