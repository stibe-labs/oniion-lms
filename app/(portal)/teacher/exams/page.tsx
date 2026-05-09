// ═══════════════════════════════════════════════════════════════
// Teacher Exams — /teacher/exams
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import { redirect } from 'next/navigation';
import TeacherExamsClient from './TeacherExamsClient';

export default async function TeacherExamsPage() {
  const user = await requireRole('teacher');
  const permissions = await getEffectivePermissions(user.id, user.role);

  // Block if exams_create permission is revoked
  if (permissions.exams_create === false) redirect('/teacher');

  return (
    <TeacherExamsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
