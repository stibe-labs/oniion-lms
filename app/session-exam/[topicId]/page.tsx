import { Suspense } from 'react';
import SessionExamClient from './SessionExamClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return {
    title: `Session Exam · ${n}`,
    description: 'Daily topic assessment for your class session',
  };
}

export default async function SessionExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ session_id?: string; student_email?: string; student_name?: string; room_id?: string }>;
}) {
  const { topicId } = await params;
  const search = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
        </div>
      }
    >
      <SessionExamClient
        topicId={topicId}
        sessionId={search.session_id || ''}
        studentEmail={search.student_email || ''}
        studentName={search.student_name || ''}
        roomId={search.room_id || ''}
      />
    </Suspense>
  );
}
