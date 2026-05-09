// ═══════════════════════════════════════════════════════════════
// Take Exam — /student/exams/[id]
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import TakeExamClient from './TakeExamClient';

export default async function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('student');
  const { id } = await params;
  return (
    <TakeExamClient
      examId={id}
      userName={user.name}
      userEmail={user.id}
    />
  );
}
