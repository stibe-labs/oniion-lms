// ═══════════════════════════════════════════════════════════════
// Teacher Dashboard — /teacher
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import TeacherDashboardClient from './TeacherDashboardClient';

export default async function TeacherPage() {
  const user = await requireRole('teacher');
  const permissions = await getEffectivePermissions(user.id, user.role);

  return (
    <TeacherDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
