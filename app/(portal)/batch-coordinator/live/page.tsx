// ═══════════════════════════════════════════════════════════════
// BC Live Monitor — /batch-coordinator/live
// Full-screen multi-session observation command center
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import LiveMonitorClient from './LiveMonitorClient';

export default async function LiveMonitorPage() {
  const user = await requireRole('batch_coordinator');

  return (
    <LiveMonitorClient
      userName={user.name}
      userEmail={user.id}
    />
  );
}
