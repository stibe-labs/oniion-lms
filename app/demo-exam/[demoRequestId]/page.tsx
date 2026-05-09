import { Suspense } from 'react';
import DemoExamClient from './DemoExamClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return {
    title: `Demo Session Exam · ${n}`,
    description: 'Sample assessment for your demo session',
  };
}

export default async function DemoExamPage({
  params,
}: {
  params: Promise<{ demoRequestId: string }>;
}) {
  const { demoRequestId } = await params;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
        </div>
      }
    >
      <DemoExamClient demoRequestId={demoRequestId} />
    </Suspense>
  );
}
