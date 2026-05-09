import { requireRole } from '@/lib/auth-utils';
import AcademicOperatorDashboardClient from '@/app/(portal)/academic-operator/AcademicOperatorDashboardClient';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Academic Operations · ${n}` };
}

export default async function OwnerAcademicOperatorPage() {
  const user = await requireRole('owner');
  return (
    <AcademicOperatorDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
