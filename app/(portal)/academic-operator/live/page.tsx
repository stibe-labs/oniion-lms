// ═══════════════════════════════════════════════════════════════
// AO Live Monitor — /academic-operator/live
// Full-screen multi-session observation command center for AOs
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import AOLiveMonitorClient from './AOLiveMonitorClient';

export default async function AOLiveMonitorPage() {
  const user = await requireRole('academic_operator');

  return (
    <AOLiveMonitorClient
      userName={user.name}
      userEmail={user.id}
    />
  );
}
