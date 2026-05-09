// ═══════════════════════════════════════════════════════════════
// Student Dashboard — /student
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import { getBujiEnabled } from '@/lib/platform-config';
import StudentDashboardClient from './StudentDashboardClient';

export default async function StudentPage() {
  const user = await requireRole('student');
  const [permissions, bujiEnabled] = await Promise.all([
    getEffectivePermissions(user.id, user.role),
    getBujiEnabled(),
  ]);

  return (
    <StudentDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
      bujiEnabled={bujiEnabled}
    />
  );
}
