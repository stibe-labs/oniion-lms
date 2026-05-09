// ═══════════════════════════════════════════════════════════════
// Owner → Live Monitor — /owner/live
// Full-screen multi-session observation command center for owners
// Reuses AO live monitor client (API already permits owner role)
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import AOLiveMonitorClient from '../../academic-operator/live/AOLiveMonitorClient';

export default async function OwnerLiveMonitorPage() {
  const user = await requireRole('owner');

  return (
    <AOLiveMonitorClient
      userName={user.name}
      userEmail={user.id}
    />
  );
}
