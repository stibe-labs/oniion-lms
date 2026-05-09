// ═══════════════════════════════════════════════════════════════
// Ghost Oversight Console — /ghost/monitor
// Multi-view grid of all live classes for silent observation
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import GhostMonitorClient from './GhostMonitorClient';

export default async function GhostMonitorPage() {
  const user = await requireRole('ghost', 'owner');

  return (
    <GhostMonitorClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
