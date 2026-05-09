// ═══════════════════════════════════════════════════════════════
// System Settings — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, FilterSelect,
  TableWrapper, THead, TH, TRow,
  LoadingState, Badge,
} from '@/components/dashboard/shared';
import {
  Shield, Server, Activity, Settings, Globe,
  CheckCircle, XCircle, Wifi, HardDrive,
  AlertTriangle, Zap, Lock, Key, Bell, Cpu, BookOpen,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface HealthStatus {
  status: string;
  database: string;
  livekit: string;
  redis: string;
  timestamp: string;
}

interface SchoolConfig {
  key: string;
  value: string;
  description: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Local Components ─────────────────────────────────────────

function ServiceStatus({ name, status, icon: Icon }: { name: string; status: string; icon: typeof Server }) {
  const isOk = status === 'ok' || status === 'connected' || status === 'healthy';
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${isOk ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
      <div className={`rounded-lg p-2.5 ${isOk ? 'bg-green-100' : 'bg-red-100'}`}>
        <Icon className={`h-5 w-5 ${isOk ? 'text-green-700' : 'text-red-700'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className={`text-xs ${isOk ? 'text-green-600' : 'text-red-600'}`}>{status}</p>
      </div>
      {isOk ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function SystemClient({ userName, userEmail, userRole }: Props) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [configs, setConfigs] = useState<SchoolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);
  const [tab, setTab] = useState('health');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/health');
      const json = await res.json();
      setHealth(json.data || json);
    } catch (e) {
      console.error('Health check failed:', e);
      setHealth({ status: 'error', database: 'unknown', livekit: 'unknown', redis: 'unknown', timestamp: new Date().toISOString() });
    }
    setLoading(false);
  }, []);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      setConfigs([
        { key: 'default_class_fee_paise', value: '50000', description: 'Default fee per session in paise (₹500.00)' },
        { key: 'early_join_minutes', value: '15', description: 'Minutes before session start when joins are allowed' },
        { key: 'grace_period_minutes', value: '10', description: 'Grace period for late joins after session start' },
        { key: 'max_students_per_room', value: '30', description: 'Maximum students allowed per batch' },
        { key: 'email_reminder_minutes', value: '30', description: 'Minutes before session to send email reminder' },
        { key: 'smtp_provider', value: 'resend', description: 'Email service provider' },
        { key: 'session_duration_minutes', value: '90', description: 'Total session duration (75 teaching + 15 prep)' },
        { key: 'teacher_max_sessions_per_day', value: '4', description: 'Maximum sessions per teacher per day' },
      ]);
    } catch (e) { console.error(e); }
    setConfigLoading(false);
  }, []);

  useEffect(() => { fetchHealth(); fetchConfig(); }, [fetchHealth, fetchConfig]);

  const allOk = health && (health.status === 'ok' || health.status === 'healthy');

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* Header */}
        <PageHeader icon={Shield} title="System & Settings" subtitle="Monitor system health, services, and configuration">
          <RefreshButton loading={loading} onClick={() => { fetchHealth(); fetchConfig(); }} />
        </PageHeader>

        {/* Status banner */}
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${allOk ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          {allOk ? (
            <>
              <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">All Systems Operational</p>
                <p className="text-xs text-green-600">Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleString('en-IN') : '—'}</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Service Issues Detected</p>
                <p className="text-xs text-amber-600">Check individual service status below</p>
              </div>
            </>
          )}
        </div>

        {/* Section selector */}
        <FilterSelect
          value={tab}
          onChange={setTab}
          options={[{ value: 'health', label: 'System Health' }, { value: 'config', label: 'Configuration' }, { value: 'info', label: 'Platform Info' }]}
        />

        {/* Health tab */}
        {tab === 'health' && (
          <div className="space-y-6">
            {loading ? (
              <LoadingState />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ServiceStatus name="Application" status={health?.status || 'unknown'} icon={Server} />
                  <ServiceStatus name="PostgreSQL Database" status={health?.database || 'unknown'} icon={HardDrive} />
                  <ServiceStatus name="LiveKit Server" status={health?.livekit || 'unknown'} icon={Wifi} />
                  <ServiceStatus name="Redis Cache" status={health?.redis || 'unknown'} icon={Zap} />
                </div>

                {/* Environment info */}
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-gray-400" /> Environment
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: 'Runtime', value: 'Node.js (Next.js 16)' },
                      { label: 'Framework', value: 'React 19.2 + Tailwind 4' },
                      { label: 'Database', value: 'PostgreSQL' },
                      { label: 'Cache', value: 'Redis' },
                      { label: 'Video', value: 'LiveKit WebRTC' },
                      { label: 'Email', value: 'Resend / SMTP' },
                      { label: 'Process Manager', value: 'PM2' },
                      { label: 'Auth', value: 'JWT Session Cookie' },
                      { label: 'Hosting', value: 'VPS (76.13.244.60)' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                        <span className="text-xs text-gray-500">{item.label}</span>
                        <span className="text-sm font-medium text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Config tab */}
        {tab === 'config' && (
          <div className="space-y-6">
            {configLoading ? (
              <LoadingState />
            ) : (
              <TableWrapper>
                <THead>
                  <TH>Setting</TH>
                  <TH>Value</TH>
                  <TH>Description</TH>
                </THead>
                <tbody>
                  {configs.map((cfg) => (
                    <TRow key={cfg.key}>
                      <td className="px-6 py-3">
                        <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700 font-mono">{cfg.key}</code>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-medium text-gray-900">{cfg.value}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{cfg.description || '—'}</td>
                    </TRow>
                  ))}
                </tbody>
              </TableWrapper>
            )}

            {/* Academic configuration */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gray-400" /> Academic Configuration
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: 'Grade Range', value: 'Grade 1 — Grade 12', desc: '12 grades supported' },
                  { label: 'Subjects', value: 'Physics, Chemistry, Mathematics, Social Science, Languages', desc: '5 subjects offered' },
                  { label: 'Session Types', value: '1:1, 1:3, 1:Many', desc: 'Three session category types' },
                  { label: 'Session Duration', value: '90 minutes', desc: '75 min teaching + 15 min prep' },
                  { label: 'Max Sessions/Day', value: '4 per teacher', desc: 'Teacher daily limit' },
                  { label: 'Exam Types', value: 'Online MCQ + Offline Descriptive', desc: 'Auto & manual evaluation' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900">{item.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info tab */}
        {tab === 'info' && (
          <div className="space-y-6">
            {/* Roles & permissions */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-400" /> Roles & Access Control
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { role: 'Owner',             level: 'Top-level',         desc: 'Full system access, all dashboards, HR, finance, reports, ghost mode',              color: 'border-emerald-200 bg-emerald-50' },
                  { role: 'HR',                level: 'Senior Management', desc: 'User management, payroll, teacher cancellation final approval',                      color: 'border-teal-200 bg-teal-50' },
                  { role: 'Academic Operator', level: 'Management',        desc: 'Academic monitoring, room management, join logs, cancellation approval',            color: 'border-green-200 bg-green-50' },
                  { role: 'Batch Coordinator', level: 'Operational',       desc: 'Batch management, scheduling, admissions, attendance, teacher oversight',           color: 'border-teal-200 bg-teal-50' },
                  { role: 'Teacher',           level: 'Academic Staff',    desc: 'Conduct sessions, mark attendance, update portions, manage exams, rejoin control',  color: 'border-emerald-200 bg-emerald-50' },
                  { role: 'Student',           level: 'End User',          desc: 'Attend sessions, take exams, view results, submit feedback',                          color: 'border-green-200 bg-green-50' },
                  { role: 'Parent',            level: 'Guardian',          desc: 'View attendance, fees, exam results, academic progress, submit complaints',         color: 'border-teal-200 bg-teal-50' },
                  { role: 'Ghost',             level: 'Observer',          desc: 'Invisible classroom observation, monitoring live sessions',                          color: 'border-gray-200 bg-gray-50' },
                ].map((r) => (
                  <div key={r.role} className={`rounded-lg border p-4 ${r.color}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-900">{r.role}</span>
                      <Badge label={r.level} variant="default" />
                    </div>
                    <p className="text-xs text-gray-600">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cancellation workflow */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Bell className="h-4 w-4 text-gray-400" /> Cancellation Approval Workflows
              </h3>
              <div className="space-y-3">
                {[
                  { initiator: 'Parent (1:1)', chain: 'Parent Request → Batch Coordinator Approval', authority: 'Batch Coordinator' },
                  { initiator: 'Students (1:3)', chain: 'All Students Request → Batch Coordinator Approval', authority: 'Batch Coordinator' },
                  { initiator: 'Students (1:Many)', chain: 'Batch Request → Batch Coordinator → Admin Review', authority: 'Admin' },
                  { initiator: 'Teacher (All)', chain: 'Teacher → Batch Coordinator → Admin → Acad. Op. → HR', authority: 'HR (5-step)' },
                ].map((wf) => (
                  <div key={wf.initiator} className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-3">
                    <div className="w-32 shrink-0">
                      <p className="text-xs text-gray-400">Initiator</p>
                      <p className="text-sm font-medium text-gray-800">{wf.initiator}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">Approval Chain</p>
                      <p className="text-sm text-gray-700 truncate">{wf.chain}</p>
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      <p className="text-xs text-gray-400">Final Authority</p>
                      <p className="text-sm font-semibold text-gray-900">{wf.authority}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security features */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-400" /> Security Features
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { title: 'JWT Session Authentication', desc: 'Secure httpOnly cookie-based sessions with role claims' },
                  { title: 'Role-Based Access Control', desc: 'Server-side route guards via requireRole() middleware' },
                  { title: 'Unauthorized Contact Detection', desc: 'AI monitoring for phone/social media sharing in chat' },
                  { title: 'Teacher Rejoin Control', desc: 'Teachers approve/deny student re-entry to live sessions' },
                  { title: 'Password Hashing', desc: 'bcrypt password hashing with secure credential generation' },
                  { title: 'Audit Logging', desc: 'Room events, email logs, and cancellation records tracked' },
                ].map((sec) => (
                  <div key={sec.title} className="flex items-start gap-3 rounded-lg bg-gray-50 p-4">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{sec.title}</p>
                      <p className="text-xs text-gray-500">{sec.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
