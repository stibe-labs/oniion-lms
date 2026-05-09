// ═══════════════════════════════════════════════════════════════
// Student Exam List — /student/exams
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import { redirect } from 'next/navigation';
import StudentExamsClient from './StudentExamsClient';

export default async function StudentExamsPage() {
  const user = await requireRole('student');
  const permissions = await getEffectivePermissions(user.id, user.role);

  // Block if exams_view permission is revoked
  if (permissions.exams_view === false) redirect('/student');

  return (
    <StudentExamsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
