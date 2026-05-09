import ClassroomWrapper from '@/components/classroom/ClassroomWrapper';
import { getPlatformName } from '@/lib/platform-config';

/**
 * /classroom/[roomId] — Main classroom page.
 * Mounts ClassroomWrapper which reads sessionStorage for LiveKit token
 * and renders role-based view (Teacher/Student/Ghost).
 *
 * Full screen, no scroll, dark background.
 */

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `${n} Classroom` };
}

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <ClassroomWrapper roomId={roomId} />
    </div>
  );
}
