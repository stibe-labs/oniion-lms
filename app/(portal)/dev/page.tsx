'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePlatformName } from '@/components/providers/PlatformProvider';

/**
 * /dev — DEV ONLY dashboard.
 * Launch any role with one click using dev token API.
 * API health panel + LiveKit connectivity test.
 * Only accessible in development mode or when ENABLE_DEV_PAGE=true.
 */

interface HealthStatus {
  status: string;
  db: string;
  redis: string;
  livekit: string;
  uptime: number;
  version: string;
}

interface LiveKitTestResult {
  steps: { name: string; pass: boolean; error?: string }[];
  reachable: boolean;
  livekit_url: string;
}

const DEV_ROLES = [
  { role: 'teacher', name: 'Priya Sharma', color: 'border-emerald-500 bg-emerald-500/10', accent: 'bg-emerald-600' },
  { role: 'student', name: 'Rahul Nair', color: 'border-blue-500 bg-blue-500/10', accent: 'bg-blue-600' },
  { role: 'ghost', name: 'Ghost Observer', color: 'border-purple-500 bg-purple-500/10', accent: 'bg-purple-600' },
  { role: 'coordinator', name: 'Seema Verma', color: 'border-indigo-500 bg-indigo-500/10', accent: 'bg-indigo-600' },
  { role: 'academic_operator', name: 'Dr. Mehta', color: 'border-teal-500 bg-teal-500/10', accent: 'bg-teal-600' },
  { role: 'parent', name: 'Nair Parent', color: 'border-orange-500 bg-orange-500/10', accent: 'bg-orange-600' },
  { role: 'owner', name: 'Admin', color: 'border-purple-500 bg-purple-500/10', accent: 'bg-purple-600' },
];

export default function DevPage() {
  const platformName = usePlatformName();
  const [roomId, setRoomId] = useState('dev_room_001');
  const [roomName, setRoomName] = useState('Grade 10 Maths');
  const [launching, setLaunching] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lkTest, setLkTest] = useState<LiveKitTestResult | null>(null);
  const [lkTestLoading, setLkTestLoading] = useState(false);

  // Check if dev mode (client-side check)
  const [isDevMode, setIsDevMode] = useState(true);

  // Fetch health on mount
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/v1/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Launch a role
  const launchRole = async (role: string) => {
    setLaunching(role);
    try {
      const res = await fetch('/api/v1/dev/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, room_id: roomId, room_name: roomName }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Unknown error'}`);
        return;
      }

      const data = await res.json();
      const { lk_token, livekit_url, room_id, room_name: rName, user, participant_identity, scheduled_start, duration_minutes, room_status } = data.data;

      // Store in sessionStorage for the new tab
      // We need to open the classroom page which reads from sessionStorage
      // Since we can't set sessionStorage cross-tab, we'll redirect
      // to a special flow that sets it up

      // For dev: store in current tab's sessionStorage, open join page
      const joinUrl = `/join/${room_id}`;

      // Open in new tab with session data encoded in URL hash
      // The join page will detect dev mode and process the hash
      const params = new URLSearchParams({
        dev: '1',
        lk_token,
        lk_url: livekit_url,
        room_name: rName,
        role: user.role,
        name: user.name,
        identity: participant_identity,
      });

      // Open new tab — each tab gets its own context
      const newTab = window.open(`/classroom/${room_id}`, '_blank');
      if (newTab) {
        // Wait for tab to load, then inject sessionStorage
        newTab.addEventListener('load', () => {
          try {
            newTab.sessionStorage.setItem('lk_token', lk_token);
            newTab.sessionStorage.setItem('lk_url', livekit_url);
            newTab.sessionStorage.setItem('room_name', rName);
            newTab.sessionStorage.setItem('participant_role', user.role);
            newTab.sessionStorage.setItem('participant_name', user.name);
            newTab.sessionStorage.setItem('scheduled_start', scheduled_start);
            newTab.sessionStorage.setItem('duration_minutes', String(duration_minutes));
            newTab.sessionStorage.setItem('room_status', room_status || 'scheduled');
          } catch {
            // Cross-origin might block this
          }
        });

        // Also try setting immediately (race condition fallback)
        setTimeout(() => {
          try {
            newTab.sessionStorage.setItem('lk_token', lk_token);
            newTab.sessionStorage.setItem('lk_url', livekit_url);
            newTab.sessionStorage.setItem('room_name', rName);
            newTab.sessionStorage.setItem('participant_role', user.role);
            newTab.sessionStorage.setItem('participant_name', user.name);
            newTab.sessionStorage.setItem('scheduled_start', scheduled_start);
            newTab.sessionStorage.setItem('duration_minutes', String(duration_minutes));
            newTab.sessionStorage.setItem('room_status', room_status || 'scheduled');
            newTab.location.reload();
          } catch {
            // If cross-tab sessionStorage doesn't work, use localStorage as bridge
            localStorage.setItem('dev_lk_token', lk_token);
            localStorage.setItem('dev_lk_url', livekit_url);
            localStorage.setItem('dev_room_name', rName);
            localStorage.setItem('dev_participant_role', user.role);
            localStorage.setItem('dev_participant_name', user.name);
            localStorage.setItem('dev_scheduled_start', scheduled_start);
            localStorage.setItem('dev_duration_minutes', String(duration_minutes));
            localStorage.setItem('dev_room_status', room_status || 'scheduled');
            localStorage.setItem('dev_bridge_ready', Date.now().toString());
            newTab.location.reload();
          }
        }, 500);
      }
    } catch (err) {
      alert(`Launch failed: ${String(err)}`);
    } finally {
      setLaunching(null);
    }
  };

  // LiveKit connectivity test
  const runLkTest = async () => {
    setLkTestLoading(true);
    try {
      const res = await fetch('/api/v1/dev/livekit-test');
      const data = await res.json();
      setLkTest(data.data);
    } catch {
      setLkTest(null);
    } finally {
      setLkTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {platformName} Portal — 🛠 Dev Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Launch any role for testing · Multi-tab support
          </p>
        </div>
        <span className="rounded bg-yellow-600/20 px-3 py-1 text-xs font-mono text-yellow-400">
          NODE: {process.env.NODE_ENV || 'development'}
        </span>
      </div>

      {/* Room settings */}
      <div className="mb-8 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Batch Settings</h2>
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Batch ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 block rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Batch Name</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="mt-1 block rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Launch cards */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Launch as Role</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {DEV_ROLES.map((item) => (
            <div
              key={item.role}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                item.color
              )}
            >
              <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">{item.role.replace('_', ' ')}</div>
              <div className="mb-3 text-sm text-foreground">{item.name}</div>
              <button
                onClick={() => launchRole(item.role)}
                disabled={launching === item.role || !roomId}
                className={cn(
                  'w-full rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors',
                  item.accent,
                  'hover:opacity-90 disabled:opacity-50'
                )}
              >
                {launching === item.role ? 'Launching...' : '🚀 Launch'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Health + LiveKit panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* API Health */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">API Status</h2>
            <button
              onClick={fetchHealth}
              disabled={healthLoading}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {healthLoading ? '⟳ Checking...' : '↻ Refresh'}
            </button>
          </div>
          {health ? (
            <div className="space-y-2 text-sm">
              <HealthRow label="Overall" value={health.status} />
              <HealthRow label="Database" value={health.db} />
              <HealthRow label="Redis" value={health.redis} />
              <HealthRow label="LiveKit" value={health.livekit} />
              <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                Uptime: {health.uptime}s · Version: {health.version}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </div>

        {/* LiveKit Test */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">LiveKit Connectivity</h2>
            <button
              onClick={runLkTest}
              disabled={lkTestLoading}
              className="rounded bg-muted px-3 py-1 text-xs text-foreground hover:bg-accent"
            >
              {lkTestLoading ? '⟳ Testing...' : '🔌 Test Connection'}
            </button>
          </div>
          {lkTest ? (
            <div className="space-y-1.5">
              {lkTest.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={step.pass ? 'text-green-400' : 'text-red-400'}>
                    {step.pass ? '●' : '●'}
                  </span>
                  <span className="text-foreground/80">{step.name}</span>
                  {step.error && (
                    <span className="text-xs text-red-400 truncate">{step.error}</span>
                  )}
                </div>
              ))}
              <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                {lkTest.reachable ? '✅ LiveKit reachable' : '❌ LiveKit unreachable'} at {lkTest.livekit_url}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Click "Test Connection" to verify LiveKit</p>
          )}
        </div>
      </div>

      {/* Test accounts reference */}
      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Test Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase">
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="text-foreground/80">
              <tr className="border-t border-border">
                <td className="py-2 pr-4">Teacher</td>
                <td className="py-2 pr-4">Priya Sharma</td>
                <td className="py-2 pr-4 font-mono text-xs">priya@stibelearning.online</td>
                <td className="py-2 text-xs text-muted-foreground">Full classroom controls</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4">Student</td>
                <td className="py-2 pr-4">Rahul Nair</td>
                <td className="py-2 pr-4 font-mono text-xs">rahul@student.stibelearning.online</td>
                <td className="py-2 text-xs text-muted-foreground">Join via invite link</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4">Owner</td>
                <td className="py-2 pr-4">Admin</td>
                <td className="py-2 pr-4 font-mono text-xs">admin@stibelearning.online</td>
                <td className="py-2 text-xs text-muted-foreground">Ghost mode access</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4">Coordinator</td>
                <td className="py-2 pr-4">Seema Verma</td>
                <td className="py-2 pr-4 font-mono text-xs">seema@stibelearning.online</td>
                <td className="py-2 text-xs text-muted-foreground">Ghost mode access</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4">Academic</td>
                <td className="py-2 pr-4">Dr. Mehta</td>
                <td className="py-2 pr-4 font-mono text-xs">mehta@stibelearning.online</td>
                <td className="py-2 text-xs text-muted-foreground">Ghost mode access</td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4">Parent</td>
                <td className="py-2 pr-4">Nair Parent</td>
                <td className="py-2 pr-4 font-mono text-xs">nair.parent@gmail.com</td>
                <td className="py-2 text-xs text-muted-foreground">Ghost — watches student</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Health row component ──────────────────────────────────
function HealthRow({ label, value }: { label: string; value: string }) {
  const isOk = value === 'ok';
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('flex items-center gap-1', isOk ? 'text-green-400' : 'text-red-400')}>
        <span>{isOk ? '●' : '●'}</span>
        <span className="text-xs">{value}</span>
      </span>
    </div>
  );
}
