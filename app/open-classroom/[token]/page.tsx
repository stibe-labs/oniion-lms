import OpenClassroomClient from './OpenClassroomClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Open Classroom · ${n}` };
}

export default async function OpenClassroomPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <OpenClassroomClient token={token} />;
}
