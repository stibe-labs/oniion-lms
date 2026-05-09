import { requireRole } from '@/lib/auth-utils';
import OwnerTeachersClient from './OwnerTeachersClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Teacher Management · ${n}` };
}

export default async function OwnerTeachersPage() {
  const user = await requireRole('owner');
  return (
    <OwnerTeachersClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
