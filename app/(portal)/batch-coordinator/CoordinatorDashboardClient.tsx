// ═══════════════════════════════════════════════════════════════
// Coordinator Dashboard — Batch-Centric (v3)
// ═══════════════════════════════════════════════════════════════
// Tabs: Overview, Batches (inline detail), Leave, Teacher Reports
// Data: /api/v1/batch-sessions + /api/v1/batches
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ExtensionRequestsPanel from '@/components/dashboard/ExtensionRequestsPanel';
import UsersTab from '@/components/dashboard/UsersTab';
import TeacherReportsTab from '@/components/dashboard/TeacherReportsTab';
import StudentReportsBrowser from '@/components/dashboard/StudentReportsBrowser';
import {
  BatchesTab as SharedBatchesTab,
  SessionsTab as SharedSessionsTab,
  type Batch as SharedBatch,
  type Session as SharedSession,
} from '@/app/(portal)/academic-operator/AcademicOperatorDashboardClient';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Clock, Users, Send, Radio, CheckCircle2,
  XCircle, Eye, ChevronDown, ChevronRight,
  BookOpen, GraduationCap, Mail, Phone, AlertTriangle,
  CalendarClock, Briefcase, Trash2, Zap, Play, Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PageHeader, StatCard, Card, Badge, StatusBadge,
  RefreshButton, Avatar, EmptyState, LoadingState, useToast, useConfirm,
  Alert,
} from '@/components/dashboard/shared';

/* ═══ TYPES ═══ */

interface Session {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string | null;
  teacher_name: string | null;
  teacher_image?: string | null;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number;
  prep_buffer_minutes: number;
  status: string;
  livekit_room_name: string | null;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  batch_name?: string;
  batch_type?: string;
  grade?: string;
  section?: string;
  student_count?: number;
  recording_status?: string | null;
  recording_url?: string | null;
  room_status?: string | null;
}

interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  subjects: string[] | null;
  grade: string;
  section: string | null;
  coordinator_email: string | null;
  coordinator_name: string | null;
  max_students: number;
  status: string;
  notes: string | null;
  created_at: string;
  student_count: number;
  teacher_count: number;
  teachers: { teacher_email: string; teacher_name: string; teacher_image?: string | null; subject: string }[];
}

interface BatchDetail {
  batch: Batch;
  students: BatchStudent[];
  teachers: { teacher_email: string; teacher_name: string | null; teacher_image?: string | null; subject: string; added_at?: string }[];
}

interface BatchStudent {
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  added_at: string;
  total_classes: number | null;
  present: number | null;
  attendance_rate: number | null;
}

interface CoordinatorDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

type TabId = 'overview' | 'batches' | 'sessions' | 'leave' | 'teacher-reports' | 'student-reports' | 'students' | 'teachers';

/* ═══ HELPERS ═══ */

const BATCH_TYPE_LABELS: Record<string, string> = { one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15', one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture', improvement_batch: 'Improvement', custom: 'Custom' };
const BATCH_TYPE_VARIANTS: Record<string, 'info' | 'primary' | 'warning' | 'default'> = { one_to_one: 'info', one_to_three: 'primary', one_to_fifteen: 'primary', one_to_thirty: 'warning', one_to_many: 'warning', lecture: 'warning', improvement_batch: 'default', custom: 'default' };

function fmtTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function effectiveSessionStatus(s: Session): string {
  // Trust the live room status (teacher pressed Go Live)
  if (s.room_status === 'live') return 'live';
  if (s.room_status === 'ended') return 'ended';

  if (s.status === 'live') {
    const startMs = s.started_at ? new Date(s.started_at).getTime() : new Date(`${s.scheduled_date.slice(0, 10)}T${s.start_time}`).getTime();
    const endMs = startMs + s.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
    return 'live';
  }
  if (s.status === 'ended') return 'ended';
  if (s.status === 'cancelled') return 'cancelled';

  // scheduled but never went live -> mark cancelled after scheduled end
  const startMs = new Date(`${s.scheduled_date.slice(0, 10)}T${s.start_time}`).getTime();
  const endMs = startMs + s.duration_minutes * 60_000;
  if (Date.now() >= endMs) return 'cancelled';
  return 'scheduled';
}

function effectiveRoomStatus(room: { status: string; scheduled_start: string; duration_minutes: number; go_live_at?: string | null }): string {
  // Trust 'live' status — teacher controls when class ends, not the clock.
  return room.status;
}

const attColor = (s: number) => s >= 75 ? 'text-primary' : s >= 50 ? 'text-amber-600' : 'text-red-600';
const attBg    = (s: number) => s >= 75 ? 'bg-primary'   : s >= 50 ? 'bg-amber-500'   : 'bg-red-500';

/* ═══ MAIN COMPONENT ═══ */

export default function CoordinatorDashboardClient({
  userName, userEmail, userRole, permissions,
}: CoordinatorDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const visitedTabs = useRef(new Set<string>());
  if (activeTab) visitedTabs.current.add(activeTab);
  const router = useRouter();
  const toast = useToast();

  // Re-render every 30s so effectiveSessionStatus re-evaluates
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30_000); return () => clearInterval(id); }, []);

  // ── Primary data ──
  const [sessions, setSessions] = useState<Session[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // ── End-class requests (room-centric) ──
  const [endClassRequests, setEndClassRequests] = useState<{ room_id: string; room_name: string; teacher_name: string; reason: string; requested_at: string }[]>([]);

  // ── Go-live approval requests ──
  const [goLiveRequests, setGoLiveRequests] = useState<{ session_id: string; subject: string; teacher_email: string; teacher_name: string; scheduled_date: string; start_time: string; duration_minutes: number; go_live_requested_at: string; batch_name: string; batch_id: string; grade: string; section: string | null }[]>([]);

  // ── Fetch functions ──
  const fetchSessions = useCallback(async (silent?: boolean) => {
    if (!silent) setLoadingSessions(true);
    try {
      const res = await fetch('/api/v1/batch-sessions');
      const data = await res.json();
      if (data.success) setSessions(data.data?.sessions || []);
    } catch (err) { console.error('Failed to fetch sessions:', err); }
    finally { setLoadingSessions(false); }
  }, []);

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch('/api/v1/batches');
      const data = await res.json();
      if (data.success) setBatches(data.data?.batches || []);
    } catch (err) { console.error('Failed to fetch batches:', err); }
    finally { setLoadingBatches(false); }
  }, []);

  const fetchEndClassRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/coordinator/rooms');
      const data = await res.json();
      if (!data.success) return;
      type Room = { room_id: string; room_name: string; teacher_email: string | null; status: string; scheduled_start: string; duration_minutes: number; go_live_at?: string | null };
      const liveRooms = (data.data?.rooms || []).filter((r: Room) => r.status === 'live' || effectiveRoomStatus(r) === 'live');
      const requests: { room_id: string; room_name: string; teacher_name: string; reason: string; requested_at: string }[] = [];
      await Promise.all(liveRooms.map(async (r: Room) => {
        try {
          const reqRes = await fetch(`/api/v1/room/${r.room_id}/end-request`);
          const reqData = await reqRes.json();
          if (reqData?.data?.status === 'pending') {
            requests.push({
              room_id: r.room_id,
              room_name: r.room_name,
              teacher_name: reqData.data.teacher_name || r.teacher_email || 'Teacher',
              reason: reqData.data.reason || '',
              requested_at: reqData.data.requested_at || new Date().toISOString(),
            });
          }
        } catch { /* ignore */ }
      }));
      setEndClassRequests(requests);
    } catch { /* ignore */ }
  }, []);

  const handleEndClassDecision = useCallback(async (roomId: string, action: 'approve' | 'deny') => {
    try {
      await fetch(`/api/v1/room/${roomId}/end-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setEndClassRequests((prev) => prev.filter((r) => r.room_id !== roomId));
      if (action === 'approve') fetchSessions();
    } catch { /* ignore */ }
  }, [fetchSessions]);

  // ── Go-live request fetch & decision ──
  const fetchGoLiveRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/batch-coordinator/go-live-requests');
      const data = await res.json();
      if (data.success) setGoLiveRequests(data.data?.requests || []);
    } catch { /* ignore */ }
  }, []);

  const handleGoLiveDecision = useCallback(async (sessionId: string, action: 'approve' | 'deny') => {
    try {
      await fetch(`/api/v1/batch-sessions/${sessionId}/go-live-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setGoLiveRequests((prev) => prev.filter((r) => r.session_id !== sessionId));
    } catch { /* ignore */ }
  }, []);

  // ── Initial load ──
  useEffect(() => { fetchSessions(); fetchBatches(); fetchEndClassRequests(); fetchGoLiveRequests(); }, [fetchSessions, fetchBatches, fetchEndClassRequests, fetchGoLiveRequests]);

  // ── Auto-refresh end-class & go-live every 15s ──
  useEffect(() => {
    const iv = setInterval(() => { fetchEndClassRequests(); fetchGoLiveRequests(); }, 15_000);
    return () => clearInterval(iv);
  }, [fetchEndClassRequests, fetchGoLiveRequests]);

  // ── Auto-start polling ──
  useEffect(() => {
    let mounted = true;
    const autoStart = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/auto-start', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.started > 0) {
          toast.success(`Auto-started ${data.data.started} session${data.data.started > 1 ? 's' : ''} (prep time open)`);
          fetchSessions(true);
        }
      } catch { /* silent */ }
    };
    autoStart();
    const iv = setInterval(autoStart, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [toast, fetchSessions]);

  // ── Hash-based tab navigation ──
  useEffect(() => {
    const validTabs: TabId[] = ['overview', 'batches', 'sessions', 'leave', 'teacher-reports', 'student-reports', 'students', 'teachers'];
    const hash = window.location.hash.replace('#', '') as TabId;
    if (hash && validTabs.includes(hash)) setActiveTab(hash);
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as TabId;
      if (h && validTabs.includes(h)) setActiveTab(h);
      else if (!h) setActiveTab('overview');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const h = activeTab === 'overview' ? '' : `#${activeTab}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', h || window.location.pathname);
  }, [activeTab]);

  // ── Computed stats ──
  const loading = loadingSessions || loadingBatches;
  const stats = useMemo(() => ({
    totalBatches: batches.length,
    activeBatches: batches.filter(b => b.status === 'active').length,
    todaySessions: sessions.filter(s => isToday(s.scheduled_date) && effectiveSessionStatus(s) !== 'cancelled').length,
    liveSessions: sessions.filter(s => effectiveSessionStatus(s) === 'live').length,
    scheduledSessions: sessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length,
    totalStudents: batches.reduce((sum, b) => sum + Number(b.student_count || 0), 0),
  }), [sessions, batches]);

  const refreshAll = () => { fetchSessions(); fetchBatches(); };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      {activeTab === 'overview' && (
        <PageHeader icon={LayoutDashboard} title="Batch Coordinator" subtitle={`Welcome back, ${userName}`}>
          <RefreshButton loading={loading} onClick={refreshAll} />
        </PageHeader>
      )}

      {/* Go-live approval requests banner */}
      {goLiveRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          {goLiveRequests.map((req) => (
            <div key={req.session_id} className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
              <Play className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">Go Live Request — {req.batch_name}</p>
                <p className="text-xs text-primary">{req.teacher_name} wants to start <strong>{req.subject}</strong> · Grade {req.grade}{req.section ? `-${req.section}` : ''} · {req.start_time?.slice(0, 5)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleGoLiveDecision(req.session_id, 'deny')}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">Deny</button>
                <button onClick={() => handleGoLiveDecision(req.session_id, 'approve')}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">Approve Go Live</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* End-class requests banner */}
      {endClassRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          {endClassRequests.map((req) => (
            <div key={req.room_id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700">End Session Request — {req.room_name}</p>
                <p className="text-xs text-amber-500">{req.teacher_name} wants to end the session early{req.reason ? `: ${req.reason}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEndClassDecision(req.room_id, 'deny')}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">Deny</button>
                <button onClick={() => handleEndClassDecision(req.room_id, 'approve')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">Approve End</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <OverviewTab stats={stats} sessions={sessions} batches={batches} loading={loading} router={router} />
          <ExtensionRequestsPanel />
        </>
      )}
      {activeTab === 'batches' && (
        <SharedBatchesTab
          batches={batches as unknown as SharedBatch[]}
          sessions={sessions as unknown as SharedSession[]}
          loading={loadingBatches}
          onRefresh={refreshAll}
          onSearch={() => {}}
          userRole={userRole}
          onNewBatch={() => {}}
        />
      )}
      {activeTab === 'sessions' && (
        <SharedSessionsTab
          sessions={sessions as unknown as SharedSession[]}
          batches={batches as unknown as SharedBatch[]}
          loading={loadingSessions}
          onRefresh={refreshAll}
          userRole={userRole}
        />
      )}
      {activeTab === 'leave' && <CoordinatorLeaveTab />}
      {activeTab === 'teacher-reports' && <TeacherReportsTab />}
      {activeTab === 'student-reports' && <StudentReportsBrowser />}
      {visitedTabs.current.has('students') && (
        <div style={{ display: activeTab === 'students' ? 'contents' : 'none' }}>
          <UsersTab role="student" label="Students" hideCreate active={activeTab === 'students'} />
        </div>
      )}
      {visitedTabs.current.has('teachers') && (
        <div style={{ display: activeTab === 'teachers' ? 'contents' : 'none' }}>
          <UsersTab role="teacher" label="Teachers" hideCreate hideActions active={activeTab === 'teachers'} />
        </div>
      )}
    </DashboardShell>
  );
}

/* ═══ OVERVIEW TAB ═══ */

function OverviewTab({ stats, sessions, batches, loading, router }: {
  stats: { totalBatches: number; activeBatches: number; todaySessions: number; liveSessions: number; scheduledSessions: number; totalStudents: number };
  sessions: Session[]; batches: Batch[]; loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  if (loading) return <LoadingState />;

  const todaySessions = sessions
    .filter(s => isToday(s.scheduled_date) && effectiveSessionStatus(s) !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const liveSessions = sessions.filter(s => effectiveSessionStatus(s) === 'live');

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={BookOpen}      label="Total Batches"    value={stats.totalBatches}      variant="default" />
        <StatCard icon={Zap}           label="Active Batches"   value={stats.activeBatches}     variant="success" />
        <StatCard icon={Calendar}      label="Today's Sessions" value={stats.todaySessions}     variant="info" />
        <StatCard icon={Radio}         label="Live Now"         value={stats.liveSessions}      variant="success" />
        <StatCard icon={Clock}         label="Scheduled"        value={stats.scheduledSessions} variant="warning" />
        <StatCard icon={GraduationCap} label="Total Students"   value={stats.totalStudents}     variant="default" />
      </div>

      {/* Live sessions alert */}
      {liveSessions.length > 0 && (
        <Alert
          variant="success"
          message={`${liveSessions.length} session${liveSessions.length > 1 ? 's' : ''} currently live: ${liveSessions.map(s => `${s.subject} (${s.batch_name || s.batch_id})`).join(', ')}`}
        />
      )}

      {/* Today's Agenda */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-primary" /> Today&apos;s Agenda
        </h3>
        {todaySessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No sessions scheduled for today</p>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => {
              const es = effectiveSessionStatus(s);
              return (
                <div key={s.session_id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    es === 'live' ? 'bg-primary/10 text-primary' : es === 'ended' ? 'bg-gray-100 text-gray-400' : 'bg-teal-50 text-teal-600'
                  }`}>
                    {es === 'live' ? <Radio className="h-5 w-5" /> : es === 'ended' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{s.subject}</span>
                      <StatusBadge status={es} />
                      {s.topic && <span className="text-xs text-gray-400">&mdash; {s.topic}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(s.start_time)}</span>
                      <span>{s.duration_minutes}m</span>
                      {s.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.teacher_name}</span>}
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{s.batch_name || s.batch_id}</span>
                    </div>
                  </div>
                  {es === 'live' && (
                    <button onClick={() => router.push('/batch-coordinator/live')}
                      className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-700 shrink-0">
                      <Eye className="h-3 w-3" /> Live Monitor
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch Summary */}
      {batches.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-primary" /> Batch Summary
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.filter(b => b.status === 'active').slice(0, 6).map(b => (
              <div key={b.batch_id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm truncate">{b.batch_name}</span>
                  <Badge label={BATCH_TYPE_LABELS[b.batch_type] || b.batch_type} variant={BATCH_TYPE_VARIANTS[b.batch_type] || 'default'} />
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{b.grade}{b.section ? ` - ${b.section}` : ''}</span>
                  <span>{b.student_count} student{b.student_count !== 1 ? 's' : ''}</span>
                  <span>{b.teacher_count} teacher{b.teacher_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ BATCHES TAB — Inline Detail (AO Pattern) ═══ */

function BatchesTab({ batches, sessions, loading, router }: {
  batches: Batch[]; sessions: Session[]; loading: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const filtered = batches;

  return (
    <div className="space-y-4">

      {loading && batches.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message="No batches found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const isExpanded = expandedBatch === b.batch_id;
            const batchSessions = sessions.filter(s => s.batch_id === b.batch_id);
            const liveCount = batchSessions.filter(s => effectiveSessionStatus(s) === 'live').length;

            return (
              <div key={b.batch_id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Batch row — clickable */}
                <button
                  type="button"
                  onClick={() => setExpandedBatch(isExpanded ? null : b.batch_id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', b.status === 'active' ? 'bg-primary/5 border border-primary/20' : 'bg-gray-50 border border-gray-200')}>
                    <BookOpen className={cn('h-5 w-5', b.status === 'active' ? 'text-primary' : 'text-gray-400')} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{b.batch_name}</h3>
                      <Badge label={BATCH_TYPE_LABELS[b.batch_type] || b.batch_type} variant={BATCH_TYPE_VARIANTS[b.batch_type] || 'default'} />
                      <StatusBadge status={b.status} />
                      {liveCount > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          <Radio className="h-3 w-3 animate-pulse" /> {liveCount} Live
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{b.grade}{b.section ? ` — ${b.section}` : ''}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.student_count} students</span>
                      <span>{b.teacher_count} teacher{b.teacher_count !== 1 ? 's' : ''}</span>
                      {b.subjects && b.subjects.length > 0 && (
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{b.subjects.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-gray-400 shrink-0">{batchSessions.length} sessions</span>
                </button>

                {/* Inline detail expansion */}
                {isExpanded && (
                  <BatchDetailInline batch={b} sessions={batchSessions} router={router} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ BATCH DETAIL INLINE ═══ */

function BatchDetailInline({ batch, sessions, router }: {
  batch: Batch; sessions: Session[];
  router: ReturnType<typeof useRouter>;
}) {
  const [detailTab, setDetailTab] = useState<'sessions' | 'info' | 'students'>('sessions');
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch batch detail (students + teachers)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/v1/batches/${batch.batch_id}`);
        const data = await res.json();
        if (!cancelled && data.success) setDetail(data.data);
      } catch { /* ignore */ }
      if (!cancelled) setDetailLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [batch.batch_id]);

  const teachers = detail?.teachers || batch.teachers?.map(t => ({ ...t, teacher_name: t.teacher_name as string | null })) || [];
  const students = detail?.students || [];
  const liveCount = sessions.filter(s => effectiveSessionStatus(s) === 'live').length;

  // Accent colors for the inline panel
  const accent = 'from-primary to-secondary';
  const light = 'bg-primary/5';
  const border = 'border-primary/20';
  const text = 'text-primary';

  return (
    <div className="border-t border-gray-200">
      {/* Header banner */}
      <div className={`bg-gradient-to-r ${accent} px-6 py-4 relative overflow-hidden`}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/5" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{batch.batch_name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="bg-white/20 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  {BATCH_TYPE_LABELS[batch.batch_type] || batch.batch_type}
                </span>
                <span className="text-white/70 text-xs">Grade {batch.grade}{batch.section ? ` - ${batch.section}` : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{batch.student_count}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Students</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{batch.teacher_count}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Teachers</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{sessions.length}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Sessions</p>
            </div>
            {liveCount > 0 && (
              <div className="bg-primary/30 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center ring-1 ring-green-300/40">
                <p className="text-lg font-bold text-white flex items-center gap-1"><Radio className="h-3.5 w-3.5 animate-pulse" />{liveCount}</p>
                <p className="text-[10px] text-green-100 uppercase tracking-wider">Live</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className={`${light} px-6 py-2.5 border-b ${border} flex items-center gap-1`}>
        {([
          { key: 'sessions' as const, label: 'Sessions', icon: Calendar, count: sessions.length },
          { key: 'info' as const, label: 'Info & Teachers', icon: Users, count: teachers.length },
          { key: 'students' as const, label: 'Students & Parents', icon: GraduationCap, count: batch.student_count },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              detailTab === t.key
                ? `bg-white ${text} shadow-sm ring-1 ${border}`
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              detailTab === t.key ? `${light} ${text}` : 'bg-gray-100 text-gray-400'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {detailTab === 'sessions' && (
          <SessionsSubTab sessions={sessions} router={router} />
        )}
        {detailTab === 'info' && (
          <InfoSubTab batch={batch} teachers={teachers} />
        )}
        {detailTab === 'students' && (
          detailLoading ? <LoadingState /> : <StudentsSubTab students={students} />
        )}
      </div>
    </div>
  );
}

/* ── Sessions sub-tab ── */

function SessionsSubTab({ sessions, router }: { sessions: Session[]; router: ReturnType<typeof useRouter> }) {
  if (sessions.length === 0) return <EmptyState icon={Calendar} message="No sessions for this batch" />;

  const sorted = [...sessions].sort((a, b) => {
    const da = `${a.scheduled_date}${a.start_time}`;
    const db = `${b.scheduled_date}${b.start_time}`;
    return db.localeCompare(da); // newest first
  });

  // Pick best-fit highlight session
  const liveSession = sessions.find(s => effectiveSessionStatus(s) === 'live');
  const todaysScheduled = sessions
    .filter(s => isToday(s.scheduled_date) && effectiveSessionStatus(s) === 'scheduled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const todaysAny = sessions
    .filter(s => isToday(s.scheduled_date))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const todayIso = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextUpcoming = sessions
    .filter(s => effectiveSessionStatus(s) === 'scheduled' && s.scheduled_date.slice(0, 10) >= todayIso)
    .sort((a, b) => (a.scheduled_date + a.start_time).localeCompare(b.scheduled_date + b.start_time))[0];
  const lastEnded = [...sessions]
    .filter(s => effectiveSessionStatus(s) === 'ended')
    .sort((a, b) => (b.scheduled_date + b.start_time).localeCompare(a.scheduled_date + a.start_time))[0];

  let highlight: Session | undefined;
  let label = '';
  let theme: { ring: string; bg: string; chipBg: string; pill: string; iconColor: string } = { ring: '', bg: '', chipBg: '', pill: '', iconColor: '' };
  if (liveSession) {
    highlight = liveSession;
    label = 'LIVE NOW';
    theme = { ring: 'border-green-300 ring-2 ring-green-200', bg: 'bg-gradient-to-r from-primary/5 to-primary/5', chipBg: 'bg-primary', pill: 'bg-white/80 text-primary border-primary/20', iconColor: 'text-primary' };
  } else if (todaysScheduled) {
    highlight = todaysScheduled;
    label = "TODAY'S NEXT SESSION";
    theme = { ring: 'border-blue-300', bg: 'bg-gradient-to-r from-blue-50 to-sky-50', chipBg: 'bg-blue-600', pill: 'bg-white/80 text-blue-700 border-blue-200', iconColor: 'text-blue-600' };
  } else if (todaysAny) {
    highlight = todaysAny;
    label = effectiveSessionStatus(todaysAny) === 'ended' ? 'TODAY (COMPLETED)' : 'TODAY';
    theme = { ring: 'border-amber-300', bg: 'bg-gradient-to-r from-amber-50 to-yellow-50', chipBg: 'bg-amber-600', pill: 'bg-white/80 text-amber-700 border-amber-200', iconColor: 'text-amber-600' };
  } else if (nextUpcoming) {
    highlight = nextUpcoming;
    label = 'NEXT UPCOMING SESSION';
    theme = { ring: 'border-teal-300', bg: 'bg-gradient-to-r from-teal-50 to-cyan-50', chipBg: 'bg-secondary', pill: 'bg-white/80 text-teal-700 border-teal-200', iconColor: 'text-teal-600' };
  } else if (lastEnded) {
    highlight = lastEnded;
    label = 'LATEST SESSION';
    theme = { ring: 'border-gray-300', bg: 'bg-gradient-to-r from-gray-50 to-slate-50', chipBg: 'bg-gray-600', pill: 'bg-white/80 text-gray-700 border-gray-200', iconColor: 'text-gray-600' };
  }

  return (
    <div className="space-y-3">
      {highlight && (() => {
        const es = effectiveSessionStatus(highlight!);
        return (
          <div className={`rounded-2xl border ${theme.ring} ${theme.bg} px-4 py-3 shadow-sm`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center gap-1.5 ${theme.chipBg} text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0`}>
                  {label === 'LIVE NOW' && <Radio className="h-3 w-3 animate-pulse" />}
                  {label}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 truncate">{highlight!.subject}</span>
                    {highlight!.topic && <span className="text-xs text-gray-500 truncate">— {highlight!.topic}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-600 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Calendar className={`h-3 w-3 ${theme.iconColor}`} />
                      {new Date(highlight!.scheduled_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="inline-flex items-center gap-1"><Clock className={`h-3 w-3 ${theme.iconColor}`} />{fmtTime12(highlight!.start_time)} · {highlight!.duration_minutes}m</span>
                    {highlight!.teacher_name && (
                      <span className="inline-flex items-center gap-1"><Users className={`h-3 w-3 ${theme.iconColor}`} />{highlight!.teacher_name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${theme.pill}`}>
                  {es}
                </span>
                {es === 'live' && (
                  <button onClick={() => router.push('/batch-coordinator/live')}
                    className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-green-700">
                    <Eye className="h-3 w-3" /> Live Monitor
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {sorted.map(s => {
        const es = effectiveSessionStatus(s);
        return (
          <div key={s.session_id} className={cn(
            'flex items-center gap-3 rounded-lg border p-3 transition-colors',
            es === 'live' ? 'border-primary/20 bg-primary/5/50' : 'border-gray-100 bg-gray-50/50',
          )}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              es === 'live' ? 'bg-primary/10 text-primary' : es === 'ended' ? 'bg-gray-100 text-gray-400' : es === 'cancelled' ? 'bg-red-50 text-red-400' : 'bg-blue-50 text-blue-600'
            }`}>
              {es === 'live' ? <Radio className="h-4 w-4 animate-pulse" /> : es === 'ended' ? <CheckCircle2 className="h-4 w-4" /> : es === 'cancelled' ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 text-sm">{s.subject}</span>
                <StatusBadge status={es} />
                {s.topic && <span className="text-xs text-gray-400 truncate">&mdash; {s.topic}</span>}
              </div>
              <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                <span>{new Date(s.scheduled_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(s.start_time)}</span>
                <span>{s.duration_minutes}m</span>
                {s.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.teacher_name}</span>}
              </div>
            </div>
            {es === 'live' && (
              <button onClick={() => router.push('/batch-coordinator/live')}
                className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-700 shrink-0">
                <Eye className="h-3 w-3" /> Live Monitor
              </button>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

/* ── Info sub-tab ── */

function InfoSubTab({ batch, teachers }: { batch: Batch; teachers: { teacher_email: string; teacher_name: string | null; teacher_image?: string | null; subject: string; added_at?: string }[] }) {
  return (
    <div className="space-y-5">
      {/* Batch info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Type</p>
          <Badge label={BATCH_TYPE_LABELS[batch.batch_type] || batch.batch_type} variant={BATCH_TYPE_VARIANTS[batch.batch_type] || 'default'} />
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Grade</p>
          <p className="text-sm font-medium text-gray-900">{batch.grade}{batch.section ? ` - ${batch.section}` : ''}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Subjects</p>
          <div className="flex flex-wrap gap-1">
            {(batch.subjects || []).map(s => (
              <span key={s} className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">{s}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Max Students</p>
          <p className="text-sm font-medium text-gray-900">{batch.max_students}</p>
        </div>
      </div>

      {batch.notes && (
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-gray-600">{batch.notes}</p>
        </div>
      )}

      {/* Coordinator info */}
      {batch.coordinator_name && (
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Coordinator</p>
          <div className="flex items-center gap-2">
            <Avatar name={batch.coordinator_name} size="sm" />
            <div>
              <p className="text-sm font-medium text-gray-900">{batch.coordinator_name}</p>
              {batch.coordinator_email && <p className="text-xs text-gray-500">{batch.coordinator_email}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Teachers */}
      {teachers.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Assigned Teachers</p>
          <div className="space-y-2">
            {teachers.map((t, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <Avatar name={t.teacher_name || t.teacher_email} src={t.teacher_image} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t.teacher_name || t.teacher_email}</p>
                  <p className="text-xs text-gray-500">{t.subject}</p>
                </div>
                <span className="text-xs text-gray-400">{t.teacher_email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Students sub-tab ── */

function StudentsSubTab({ students }: { students: BatchStudent[] }) {
  if (students.length === 0) return <EmptyState icon={GraduationCap} message="No students enrolled" />;

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {students.map((st) => (
        <div key={st.student_email} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
          <Avatar name={st.student_name || st.student_email} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{st.student_name || st.student_email}</p>
            <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{st.student_email}</span>
              {st.parent_name && <span>Parent: {st.parent_name}</span>}
              {st.parent_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{st.parent_phone}</span>}
            </div>
          </div>
          {/* Attendance */}
          {st.attendance_rate != null && (
            <div className="text-right shrink-0">
              <p className={cn('text-sm font-bold', attColor(st.attendance_rate))}>{Math.round(st.attendance_rate)}%</p>
              <p className="text-[10px] text-gray-400">{st.present ?? 0}/{st.total_classes ?? 0}</p>
              <div className="w-16 h-1.5 rounded-full bg-gray-200 mt-1 overflow-hidden">
                <div className={cn('h-full rounded-full', attBg(st.attendance_rate))} style={{ width: `${Math.min(st.attendance_rate, 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


/* ─── TAB: Coordinator Leave & Session Requests ─── */

interface CoordLeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  hr_status: string;
  owner_status: string;
  affected_sessions: string[];
  sessions_managed: boolean;
  created_at: string;
}

interface CoordSessionRequest {
  id: string;
  request_type: string;
  batch_session_id: string;
  batch_id: string;
  reason: string;
  proposed_date: string | null;
  proposed_time: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  batch_name?: string;
  subject?: string;
  session_date?: string;
  start_time?: string;
}

function CoordinatorLeaveTab() {
  const [subView, setSubView] = useState<'leave' | 'session-requests'>('leave');
  const [leaveRequests, setLeaveRequests] = useState<CoordLeaveRequest[]>([]);
  const [sessionRequests, setSessionRequests] = useState<CoordSessionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSR, setLoadingSR] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSessForm, setShowSessForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { confirm } = useConfirm();
  const [form, setForm] = useState({ leaveType: 'planned', startDate: '', endDate: '', reason: '' });
  const [sessForm, setSessForm] = useState({ sessionId: '', batchId: '', type: 'reschedule' as 'reschedule' | 'cancel', reason: '', proposedDate: '', proposedTime: '' });
  const [coordSessions, setCoordSessions] = useState<Array<{ session_id: string; batch_id: string; subject: string; scheduled_date: string; start_time: string; batch_name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher-leave');
      const data = await res.json();
      if (data.success) setLeaveRequests(data.data?.requests ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  const fetchSessionRequests = useCallback(async () => {
    setLoadingSR(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.data?.requests ?? []);
    } catch { /* */ }
    finally { setLoadingSR(false); }
  }, []);

  const fetchCoordSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/batch-sessions?status=scheduled');
      const data = await res.json();
      if (data.success) setCoordSessions(data.data?.sessions?.map((s: { session_id: string; batch_id: string; subject: string; scheduled_date: string; start_time: string; batch_name: string }) => ({
        session_id: s.session_id, batch_id: s.batch_id, subject: s.subject,
        scheduled_date: s.scheduled_date, start_time: s.start_time, batch_name: s.batch_name,
      })) ?? []);
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);
  useEffect(() => { if (subView === 'session-requests') { fetchSessionRequests(); fetchCoordSessions(); } }, [subView, fetchSessionRequests, fetchCoordSessions]);

  const submitLeave = async () => {
    if (!form.startDate || !form.endDate || !form.reason) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_type: form.leaveType, start_date: form.startDate, end_date: form.endDate, reason: form.reason }),
      });
      const data = await res.json();
      if (data.success) { setShowForm(false); setForm({ leaveType: 'planned', startDate: '', endDate: '', reason: '' }); fetchLeave(); }
    } catch { /* */ } finally { setSubmitting(false); }
  };

  const submitSessionRequest = async () => {
    if (!sessForm.sessionId || !sessForm.reason) return;
    setSubmitting(true);
    try {
      const sel = coordSessions.find(s => s.session_id === sessForm.sessionId);
      const res = await fetch('/api/v1/session-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: sessForm.type,
          batch_session_id: sessForm.sessionId,
          batch_id: sel?.batch_id || sessForm.batchId,
          reason: sessForm.reason,
          proposed_date: sessForm.type === 'reschedule' ? sessForm.proposedDate : undefined,
          proposed_time: sessForm.type === 'reschedule' ? sessForm.proposedTime : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSessForm(false);
        setSessForm({ sessionId: '', batchId: '', type: 'reschedule', reason: '', proposedDate: '', proposedTime: '' });
        fetchSessionRequests();
      }
    } catch { /* */ } finally { setSubmitting(false); }
  };

  const withdrawLeave = async (id: string) => {
    try {
      await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', leave_id: id }),
      });
      fetchLeave();
    } catch { /* */ }
  };

  const withdrawSessReq = async (id: string) => {
    try {
      await fetch('/api/v1/session-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', request_id: id }),
      });
      fetchSessionRequests();
    } catch { /* */ }
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === leaveRequests.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leaveRequests.map(r => r.id)));
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({ title: 'Delete Leave Requests', message: `Delete ${selectedIds.size} leave request${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`${data.data?.deleted || selectedIds.size} leave request(s) deleted`); setSelectedIds(new Set()); fetchLeave(); }
      else toast.error(data.error || 'Delete failed');
    } catch { toast.error('Network error'); }
    finally { setDeleting(false); }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setSubView('leave')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
            ${subView === 'leave' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <Briefcase className="h-4 w-4" />Leave Requests
          </button>
          <button onClick={() => setSubView('session-requests')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
            ${subView === 'session-requests' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <CalendarClock className="h-4 w-4" />Session Requests
          </button>
        </div>
      </div>

      {subView === 'leave' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Leave Requests</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 hover:bg-amber-100 transition text-sm font-medium">
              <Send className="h-4 w-4" />{showForm ? 'Cancel' : 'Request Leave'}
            </button>
          </div>

          {showForm && (
            <Card className="p-5 space-y-4 border-amber-200">
              <h3 className="text-sm font-semibold text-gray-900">New Leave Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.leaveType}
                    onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}>
                    <option value="planned">Planned</option>
                    <option value="sick">Sick</option>
                    <option value="personal">Personal</option>
                    <option value="emergency">Emergency</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                  <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Explain your leave reason…"
                    value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <button disabled={submitting || !form.startDate || !form.endDate || !form.reason} onClick={submitLeave}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting…' : 'Submit Leave Request'}
              </button>
            </Card>
          )}

          {leaveRequests.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No leave requests yet." />
          ) : (
            <div className="space-y-3">
              {/* Selection toolbar */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={leaveRequests.length > 0 && selectedIds.size === leaveRequests.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                  </span>
                </div>
                {selectedIds.size > 0 && (
                  <button disabled={deleting} onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting ? 'Deleting\u2026' : `Delete ${selectedIds.size}`}
                  </button>
                )}
              </div>

              {leaveRequests.map(lr => {
                const displayStatus = (() => {
                  switch (lr.status) {
                    case 'pending_ao': return { status: 'pending', label: 'Pending AO Review' };
                    case 'pending_hr': return { status: 'warning', label: 'Pending HR Approval' };
                    case 'approved': return { status: 'warning', label: 'Approved — Sessions Being Managed' };
                    case 'confirmed': return { status: 'approved', label: 'Confirmed' };
                    case 'rejected': return { status: 'rejected', label: 'Rejected' };
                    case 'withdrawn': return { status: 'rejected', label: 'Withdrawn' };
                    default: return { status: 'pending', label: lr.status };
                  }
                })();
                return (
                <Card key={lr.id} className={`p-4 ${selectedIds.has(lr.id) ? 'border-amber-300 bg-amber-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input type="checkbox" checked={selectedIds.has(lr.id)} onChange={() => toggleSelect(lr.id)}
                        className="mt-1.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900 capitalize">{lr.leave_type} Leave</span>
                          <StatusBadge status={displayStatus.status} label={displayStatus.label} />
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(lr.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} \u2013 {new Date(lr.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {lr.affected_sessions?.length > 0 && ` \u00b7 ${lr.affected_sessions.length} sessions affected`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{lr.reason}</p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                          <span>Status: {displayStatus.label}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-gray-400">{new Date(lr.created_at).toLocaleDateString('en-IN')}</p>
                      {(lr.status === 'pending_ao' || lr.status === 'pending_hr') && (
                        <button onClick={() => withdrawLeave(lr.id)} className="text-xs text-red-500 hover:text-red-700">Withdraw</button>
                      )}
                    </div>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Session Change Requests</h2>
            <button onClick={() => setShowSessForm(!showSessForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition text-sm font-medium">
              <Send className="h-4 w-4" />{showSessForm ? 'Cancel' : 'Request Change'}
            </button>
          </div>

          {showSessForm && (
            <Card className="p-5 space-y-4 border-blue-200">
              <h3 className="text-sm font-semibold text-gray-900">New Session Change Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Session</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sessForm.sessionId}
                    onChange={e => {
                      const sid = e.target.value;
                      const sess = coordSessions.find(s => s.session_id === sid);
                      setSessForm(f => ({ ...f, sessionId: sid, batchId: sess?.batch_id || '' }));
                    }}>
                    <option value="">Choose a session…</option>
                    {coordSessions.map(s => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.subject} — {s.batch_name} — {new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at {s.start_time?.substring(0, 5)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Request Type</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sessForm.type}
                    onChange={e => setSessForm(f => ({ ...f, type: e.target.value as 'reschedule' | 'cancel' }))}>
                    <option value="reschedule">Reschedule</option>
                    <option value="cancel">Cancel</option>
                  </select>
                </div>
                <div />
                {sessForm.type === 'reschedule' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Date</label>
                      <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sessForm.proposedDate}
                        onChange={e => setSessForm(f => ({ ...f, proposedDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Time</label>
                      <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sessForm.proposedTime}
                        onChange={e => setSessForm(f => ({ ...f, proposedTime: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                  <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Explain why…"
                    value={sessForm.reason} onChange={e => setSessForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <button disabled={submitting || !sessForm.sessionId || !sessForm.reason || (sessForm.type === 'reschedule' && !sessForm.proposedDate)}
                onClick={submitSessionRequest}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </Card>
          )}

          {loadingSR ? <LoadingState /> : sessionRequests.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No session requests yet." />
          ) : (
            <div className="space-y-3">
              {sessionRequests.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-900 capitalize">{r.request_type} Request</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {r.subject && `${r.subject} · `}
                        {r.batch_name && `${r.batch_name} · `}
                        {r.session_date && new Date(r.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {r.start_time && ` at ${r.start_time.substring(0, 5)}`}
                      </p>
                      {r.proposed_date && <p className="text-xs text-blue-500 mt-0.5">Proposed: {new Date(r.proposed_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{r.proposed_time ? ` at ${r.proposed_time}` : ''}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejected: {r.rejection_reason}</p>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                      {r.status === 'pending' && (
                        <button onClick={() => withdrawSessReq(r.id)} className="text-xs text-red-500 hover:text-red-700">Withdraw</button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
