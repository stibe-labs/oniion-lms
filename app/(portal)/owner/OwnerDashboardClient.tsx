// ═══════════════════════════════════════════════════════════════
// Owner Dashboard — Command Center
// Comprehensive monitoring, control & approval hub for system owner
// Tabs: Overview │ Sessions │ Finance │ Approvals │ People
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import OwnerMeetingsTab from '@/components/dashboard/OwnerMeetingsTab';
import { fmtDateBriefIST } from '@/lib/utils';
import {
  PageHeader, RefreshButton, SearchInput, FilterSelect,
  THead, TH, TRow,
  StatusBadge as SharedStatusBadge,
  RoleBadge, Avatar, Button, money,
  LoadingState,
} from '@/components/dashboard/shared';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, Shield, Clock, Radio,
  Activity, Eye, CreditCard, Briefcase, BarChart3,
  BookOpen, GraduationCap, ChevronRight,
  XCircle, CheckCircle2, Bell, IndianRupee, TrendingUp,
  AlertTriangle, CircleDollarSign,
  FileText, Wallet, ArrowUpRight, Receipt, Send, Calendar,
  FileCheck, Ban, UserPlus,

} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

/* ═══ Types ═══ */

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  coordinator_email: string;
  teacher_email: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  student_count: number;
}

interface UserStat { role: string; count: number }
interface DailyClass { date: string; total: number; conducted: number; cancelled: number }
interface SubjectDist { subject: string; count: number }
interface GradeDist { grade: string; count: number }
interface RecentUser { email: string; display_name: string; portal_role: string; created_at: string }
interface RecentPayment { id: number; studentEmail: string; studentName: string; amountPaise: number; paidAt: string }
interface RevenueTrend { month: string; collectedPaise: number; invoiceCount: number }
interface GhostVisit { roomId: string; roomName: string; subject: string; grade: string; teacherEmail: string; observerEmail: string; observerName: string; observerRole: string; enteredAt: string }

interface PaymentStats {
  totalInvoices: number; paidInvoices: number; pendingInvoices: number; overdueInvoices: number;
  totalCollectedPaise: number; totalPendingPaise: number; totalOverduePaise: number;
  totalInvoicedPaise: number; collectedLast30dPaise: number;
}

interface PayrollStats {
  totalPeriods: number; draftPeriods: number; finalizedPeriods: number;
  paidPeriods: number; totalPaidPaise: number;
}

interface TodayStats {
  total: number; live: number; upcoming: number; completed: number; cancelled: number;
}

interface PendingStats {
  leaveRequests: number; cancellations: number; sessionRequests: number;
  alerts: number; criticalAlerts: number; warningAlerts: number;
}

interface DashboardData {
  summary: {
    totalBatches: number; liveBatches: number; scheduledBatches: number;
    completedBatches: number; cancelledBatches: number; totalUsers: number;
    cancelledLast30: number;
  };
  today: TodayStats;
  pending: PendingStats;
  usersByRole: UserStat[];
  rooms: Room[];
  dailyClasses: DailyClass[];
  subjectDistribution: SubjectDist[];
  gradeDistribution: GradeDist[];
  recentUsers: RecentUser[];
  payment: PaymentStats;
  recentPayments: RecentPayment[];
  payroll: PayrollStats;
  revenueTrend: RevenueTrend[];
  ghostVisits: GhostVisit[];
}

interface Props { userName: string; userEmail: string; userRole: string }

/* ═══ Constants ═══ */

const COLORS = ['#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04'];

const ROLE_ICON_MAP: Record<string, React.ElementType> = {
  owner: Shield, teacher: GraduationCap, student: BookOpen,
  batch_coordinator: Users, academic_operator: BarChart3,
  hr_associate: Briefcase, ghost_observer: Eye, parent: Users,
};

function fmtRole(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function effectiveStatus(r: Room): string {
  if (r.status !== 'live') return r.status;
  const end = new Date(r.scheduled_start).getTime() + r.duration_minutes * 60_000;
  return Date.now() > end ? 'ended' : 'live';
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {money(p.value)}</p>
      ))}
    </div>
  );
}

type TabKey = 'overview' | 'live' | 'sessions' | 'meetings' | 'users' | 'finance' | 'payroll' | 'approvals';

const TAB_DEF: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { key: 'live',      label: 'Live Monitor', icon: Radio },
  { key: 'sessions',  label: 'Sessions',     icon: BookOpen },
  { key: 'meetings',  label: 'Meetings',     icon: Radio },
  { key: 'users',     label: 'Users',        icon: Users },
  { key: 'finance',   label: 'Finance',      icon: IndianRupee },
  { key: 'payroll',   label: 'Payroll',      icon: Briefcase },
  { key: 'approvals', label: 'Approvals',    icon: CheckCircle2 },
];

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */

export default function OwnerDashboardClient({ userName, userEmail, userRole }: Props) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/owner/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync tab with URL hash so sidebar nav links work
  useEffect(() => {
    const validTabs: TabKey[] = ['overview', 'live', 'sessions', 'meetings', 'users', 'finance', 'payroll', 'approvals'];
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '') as TabKey;
      if (hash && validTabs.includes(hash)) setTab(hash);
      else if (!hash) setTab('overview');
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  /* ── Computed ── */
  const rooms = data?.rooms || [];
  const live = rooms.filter((r) => r.status === 'live');

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (statusFilter !== 'all') {
      list = list.filter((r) => effectiveStatus(r) === statusFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.room_name?.toLowerCase().includes(q) ||
          r.subject?.toLowerCase().includes(q) ||
          r.grade?.toLowerCase().includes(q) ||
          r.coordinator_email?.toLowerCase().includes(q) ||
          r.teacher_email?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rooms, searchTerm, statusFilter]);

  const tabs = useMemo(() => {
    const p = data?.pending;
    const pendingTotal = p ? p.cancellations + p.sessionRequests : 0;
    return TAB_DEF.map((t) => ({
      ...t,
      count:
        t.key === 'approvals' && pendingTotal > 0 ? pendingTotal :
        t.key === 'live' && live.length > 0 ? live.length :
        t.key === 'sessions' && live.length > 0 ? live.length :
        undefined,
    }));
  }, [data, live.length]);

  if (loading && !data) return <DashboardShell role="owner" userName={userName} userEmail={userEmail}><LoadingState /></DashboardShell>;

  return (
    <DashboardShell role="owner" userName={userName} userEmail={userEmail}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Welcome, {userName || 'Owner'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">System command center — monitor, approve &amp; manage everything</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.pending && (data.pending.cancellations + data.pending.sessionRequests) > 0 && (
            <button onClick={() => setTab('approvals')} className="relative flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition">
              <Bell className="h-3.5 w-3.5" />
              {data.pending.cancellations + data.pending.sessionRequests} Pending
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
            </button>
          )}
          <RefreshButton loading={loading} onClick={() => { fetchData(); }} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-5">
        {tab === 'overview' && (
          <OverviewTab data={data} live={live} onSwitchTab={setTab} />
        )}
        {tab === 'live' && (
          <LiveTab data={data} live={live} />
        )}
        {tab === 'sessions' && (
          <ClassesTab
            data={data} live={live} rooms={rooms}
            filteredRooms={filteredRooms}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          />
        )}
        {tab === 'meetings' && (
          <OwnerMeetingsTab ownerName={userName} ownerEmail={userEmail} />
        )}
        {tab === 'users' && (
          <PeopleTab data={data} />
        )}
        {tab === 'finance' && (
          <FinanceTab data={data} />
        )}
        {tab === 'payroll' && (
          <PayrollTab data={data} />
        )}
        {tab === 'approvals' && (
          <ApprovalsTab data={data} />
        )}
      </div>
    </DashboardShell>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: OVERVIEW                                                  */
/* ═══════════════════════════════════════════════════════════════ */

function OverviewTab({ data, live, onSwitchTab }: {
  data: DashboardData | null; live: Room[]; onSwitchTab: (t: TabKey) => void;
}) {
  if (!data) return null;
  const { summary, today, pending, payment, dailyClasses, subjectDistribution, gradeDistribution, usersByRole, revenueTrend } = data;
  const totalPending = pending.cancellations + pending.sessionRequests;

  return (
    <div className="space-y-6">
      {/* ── Urgent Attention Banner ── */}
      {totalPending > 0 && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Requires Your Attention</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pending.cancellations > 0 && (
              <button onClick={() => onSwitchTab('approvals')} className="flex items-center gap-2 rounded-lg bg-white border border-amber-100 p-3 hover:shadow-md transition text-left">
                <Ban className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-gray-900">{pending.cancellations}</p>
                  <p className="text-[11px] text-gray-500">Cancellations</p>
                </div>
              </button>
            )}
            {pending.sessionRequests > 0 && (
              <button onClick={() => onSwitchTab('approvals')} className="flex items-center gap-2 rounded-lg bg-white border border-amber-100 p-3 hover:shadow-md transition text-left">
                <Send className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-gray-900">{pending.sessionRequests}</p>
                  <p className="text-[11px] text-gray-500">Session Requests</p>
                </div>
              </button>
            )}

          </div>
        </div>
      )}

      {/* ── Today's Sessions ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <SectionHeader icon={Calendar} title="Today's Sessions" />
        <div className="grid grid-cols-5 gap-3 mt-3">
          <MiniStatCard label="Total" value={today.total} icon={Calendar} color="text-gray-600" bg="bg-gray-50" />
          <MiniStatCard label="Live" value={today.live} icon={Radio} color="text-primary" bg="bg-primary/5" pulse={today.live > 0} />
          <MiniStatCard label="Upcoming" value={today.upcoming} icon={Clock} color="text-blue-600" bg="bg-blue-50" />
          <MiniStatCard label="Completed" value={today.completed} icon={CheckCircle2} color="text-primary" bg="bg-primary/5" />
          <MiniStatCard label="Cancelled" value={today.cancelled} icon={XCircle} color="text-red-600" bg="bg-red-50" />
        </div>
      </div>

      {/* ── Main KPI Grid ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Batches" value={summary.totalBatches} icon={LayoutDashboard} variant="primary" />
        <KpiCard label="Live Now" value={summary.liveBatches} icon={Radio} variant="success" pulse={summary.liveBatches > 0} />
        <KpiCard label="Total Users" value={summary.totalUsers} icon={Users} variant="info" />
        <KpiCard label="Cancelled (30d)" value={summary.cancelledLast30} icon={AlertTriangle} variant="danger" />
      </div>

      {/* ── Revenue KPI Grid ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Collected" value={money(payment.totalCollectedPaise)} icon={IndianRupee} variant="primary" />
        <KpiCard label="Pending Revenue" value={money(payment.totalPendingPaise)} icon={CircleDollarSign} variant="warning" />
        <KpiCard label="Overdue Amount" value={money(payment.totalOverduePaise)} icon={AlertTriangle} variant="danger" />
        <KpiCard label="Collected (30d)" value={money(payment.collectedLast30dPaise)} icon={TrendingUp} variant="success" />
      </div>

      {/* ── Live Classes Marquee ── */}
      {live.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-green-800">
              {live.length} Live {live.length === 1 ? 'Session' : 'Sessions'} in Progress
            </h3>
          </div>
          <div className="space-y-2">
            {live.slice(0, 5).map((room) => (
              <div key={room.room_id} className="flex items-center gap-3 rounded-lg bg-white border border-green-100 p-3">
                <div className="relative">
                  <Radio className="h-5 w-5 text-green-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{room.room_name}</p>
                  <p className="text-xs text-gray-500">
                    {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                  </p>
                </div>
                <Button variant="success" size="sm" icon={Eye} onClick={() => window.location.href = '/owner/live'}>
                  Observe
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts Row 1: Daily Trend + Revenue Trend ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={Activity} title="30-Day Session Activity" />
          <div className="h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyClasses}>
                <defs>
                  <linearGradient id="owGradC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="owGradX" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="conducted" name="Conducted" stroke="#059669" fill="url(#owGradC)" strokeWidth={2} />
                <Area type="monotone" dataKey="cancelled" name="Cancelled" stroke="#ef4444" fill="url(#owGradX)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={TrendingUp} title="Revenue Trend (6 Months)" />
          <div className="h-56 mt-3">
            {(revenueTrend || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueTrend.map((r) => ({ ...r, collected: r.collectedPaise }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => money(v)} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Bar dataKey="collected" name="Collected" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No revenue data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts Row 2: Subject Pie + Grade Bar ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={BookOpen} title="Subject Distribution" />
          <div className="h-56 mt-3">
            {subjectDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subjectDistribution} dataKey="count" nameKey="subject"
                    cx="50%" cy="50%" outerRadius={85} innerRadius={40} paddingAngle={2}
                    label={({ subject, percent }: any) => `${subject} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {subjectDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No subject data</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={GraduationCap} title="Grade Distribution" />
          <div className="h-56 mt-3">
            {gradeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="grade" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Batches" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No grade data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Users by Role ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <SectionHeader icon={Users} title="Users by Role" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-3">
          {usersByRole.map((u) => {
            const Icon = ROLE_ICON_MAP[u.role] || Users;
            return (
              <div key={u.role} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:border-primary/20 transition">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{u.count}</p>
                  <p className="text-[11px] text-gray-500">{fmtRole(u.role)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ghost Observations (Audit Log) ── */}
      {(data.ghostVisits?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={Eye} title="Ghost Observations — Last 30 days" />
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Observer</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Session</th>
                  <th className="pb-2 font-medium">Subject</th>
                  <th className="pb-2 font-medium">Teacher</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.ghostVisits.map((gv, i) => (
                  <tr key={`${gv.roomId}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{gv.observerName}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {fmtRole(gv.observerRole)}
                      </span>
                    </td>
                    <td className="py-2 text-gray-700">{gv.roomName || gv.roomId}</td>
                    <td className="py-2 text-gray-600">{gv.subject || '—'}</td>
                    <td className="py-2 text-gray-600">{gv.teacherEmail || '—'}</td>
                    <td className="py-2 text-gray-500">{new Date(gv.enteredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quick Access ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <SectionHeader icon={ArrowUpRight} title="Quick Access" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mt-3">
          <QuickLink href="/owner/admins" icon={UserPlus} label="Admins" desc="Manage admin accounts" variant="success" />
          <QuickLink href="/owner/invoices" icon={CreditCard} label="Invoices" desc="Invoices & payments" variant="warning" />
          <QuickLink href="/owner/reports" icon={BarChart3} label="Reports" desc="Analytics & exports" variant="primary" />
          <QuickLink href="/hr" icon={Briefcase} label="HR & Payroll" desc="Staff management" variant="info" />
          <QuickLink href="/academic-operator" icon={BookOpen} label="Academic Ops" desc="Batches & sessions" variant="success" />
          <QuickLink href="/owner/live" icon={Eye} label="Live Monitor" desc="Observe all live sessions" variant="default" />
          <QuickLink href="/coordinator" icon={Users} label="Coordinator" desc="Batch coordination" variant="primary" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: LIVE MONITOR                                              */
/* ═══════════════════════════════════════════════════════════════ */

function LiveTab({ data, live }: { data: DashboardData | null; live: Room[] }) {
  if (!data) return null;
  const { today } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Live Now" value={today.live} icon={Radio} variant="success" pulse={today.live > 0} />
        <KpiCard label="Upcoming Today" value={today.upcoming} icon={Clock} variant="info" />
        <KpiCard label="Completed Today" value={today.completed} icon={CheckCircle2} variant="primary" />
        <KpiCard label="Cancelled Today" value={today.cancelled} icon={XCircle} variant="danger" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio className="h-4 w-4 text-primary" />
              {live.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-ping" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-800">
              {live.length === 0 ? 'No live sessions' : `${live.length} live session${live.length === 1 ? '' : 's'}`}
            </h3>
          </div>
          <a href="/owner/live" className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1">
            Live Monitor <ChevronRight className="h-3 w-3" />
          </a>
        </div>
        {live.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            All quiet. Live sessions will appear here in real-time.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((room) => (
              <div key={room.room_id} className="rounded-xl border border-primary/20 bg-primary/5 p-4 hover:border-green-300 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                    <Radio className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-white px-2 py-0.5 rounded-full">
                    LIVE
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{room.room_name}</p>
                <p className="text-xs text-gray-600 mt-0.5 truncate">{room.subject || '—'} · {room.grade || '—'}</p>
                <p className="text-[11px] text-gray-500 mt-1 truncate">Teacher: {room.teacher_email || '—'}</p>
                <p className="text-[11px] text-gray-500 truncate">Students: {room.student_count || 0}</p>
                <Button
                  variant="success"
                  size="sm"
                  icon={Eye}
                  className="mt-3 w-full justify-center"
                  onClick={() => window.location.href = '/owner/live'}
                >
                  Observe
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: SESSIONS                                                  */
/* ═══════════════════════════════════════════════════════════════ */

function ClassesTab({ data, live, rooms, filteredRooms, searchTerm, setSearchTerm, statusFilter, setStatusFilter }: {
  data: DashboardData | null; live: Room[]; rooms: Room[]; filteredRooms: Room[];
  searchTerm: string; setSearchTerm: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
}) {
  if (!data) return null;
  const { today, summary } = data;

  return (
    <div className="space-y-6">
      {/* ── Today's Sessions ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <KpiCard label="Today Total" value={today.total} icon={Calendar} variant="primary" />
        <KpiCard label="Live Now" value={today.live} icon={Radio} variant="success" pulse={today.live > 0} />
        <KpiCard label="Upcoming" value={today.upcoming} icon={Clock} variant="info" />
        <KpiCard label="Completed" value={today.completed} icon={CheckCircle2} variant="primary" />
        <KpiCard label="Cancelled" value={today.cancelled} icon={XCircle} variant="danger" />
      </div>

      {/* ── Status Overview ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatMini label="All Batches" value={summary.totalBatches} color="text-gray-700" />
        <StatMini label="Live" value={summary.liveBatches} color="text-primary" />
        <StatMini label="Scheduled" value={summary.scheduledBatches} color="text-blue-600" />
        <StatMini label="Completed" value={summary.completedBatches} color="text-primary" />
        <StatMini label="Cancelled" value={summary.cancelledBatches} color="text-red-600" />
      </div>

      {/* ── Live Sessions ── */}
      {live.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-green-800">
              {live.length} Live {live.length === 1 ? 'Session' : 'Sessions'} in Progress
            </h3>
          </div>
          <div className="space-y-2">
            {live.map((room) => (
              <div key={room.room_id} className="flex items-center gap-3 rounded-lg bg-white border border-green-100 p-3">
                <div className="relative">
                  <Radio className="h-5 w-5 text-green-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{room.room_name}</p>
                  <p className="text-xs text-gray-500">
                    {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'} · {room.student_count || 0} students
                  </p>
                </div>
                <Button variant="success" size="sm" icon={Eye} onClick={() => window.location.href = '/owner/live'}>
                  Observe
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Batches Table ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">All Batches</h3>
            <p className="text-xs text-gray-400 mt-0.5">{filteredRooms.length} of {rooms.length} batches</p>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search batches..." className="w-48" />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'live', label: 'Live' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'ended', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead>
              <TH>Batch</TH>
              <TH>Subject</TH>
              <TH>Grade</TH>
              <TH>Coordinator</TH>
              <TH>Teacher</TH>
              <TH className="text-center">Students</TH>
              <TH>Status</TH>
              <TH>Scheduled</TH>
            </THead>
            <tbody className="divide-y divide-gray-100">
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    {rooms.length === 0 ? 'No batches in the system yet' : 'No batches match your filter'}
                  </td>
                </tr>
              ) : (
                filteredRooms.slice(0, 50).map((room) => (
                  <TRow key={room.room_id}>
                    <td className="px-4 py-3"><p className="font-medium text-gray-800 truncate max-w-45">{room.room_name}</p></td>
                    <td className="px-4 py-3 text-gray-600">{room.subject || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{room.grade || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-35">{room.coordinator_email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-35">{room.teacher_email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-center">{room.student_count || 0}</td>
                    <td className="px-4 py-3"><SharedStatusBadge status={effectiveStatus(room)} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateBriefIST(new Date(room.scheduled_start))}</div>
                    </td>
                  </TRow>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
          <span>Showing {Math.min(filteredRooms.length, 50)} of {rooms.length} batches</span>
          <a href="/academic-operator" className="text-primary hover:text-primary font-medium flex items-center gap-1">
            Full Batch Management <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ── Management Links ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/academic-operator" icon={BookOpen} label="Academic Ops" desc="Full batch & session management" variant="primary" />
        <QuickLink href="/coordinator" icon={Users} label="Coordinator" desc="Batch coordination panel" variant="info" />
        <QuickLink href="/owner/live" icon={Eye} label="Live Monitor" desc="Observe all live sessions" variant="default" />
        <QuickLink href="/owner/reports" icon={BarChart3} label="Reports" desc="Attendance & analytics" variant="success" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: FINANCE                                                   */
/* ═══════════════════════════════════════════════════════════════ */

function FinanceTab({ data }: { data: DashboardData | null }) {
  if (!data) return null;
  const { payment, payroll, recentPayments, revenueTrend } = data;

  const invoiceStatusData = [
    { name: 'Paid', value: payment.paidInvoices, color: '#059669' },
    { name: 'Pending', value: payment.pendingInvoices, color: '#f59e0b' },
    { name: 'Overdue', value: payment.overdueInvoices, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const collectionRate = payment.totalInvoicedPaise > 0
    ? ((payment.totalCollectedPaise / payment.totalInvoicedPaise) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* ── Revenue Summary ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Invoiced" value={money(payment.totalInvoicedPaise)} icon={FileText} variant="primary" />
        <KpiCard label="Total Collected" value={money(payment.totalCollectedPaise)} icon={IndianRupee} variant="success" />
        <KpiCard label="Pending Revenue" value={money(payment.totalPendingPaise)} icon={CircleDollarSign} variant="warning" />
        <KpiCard label="Overdue Amount" value={money(payment.totalOverduePaise)} icon={AlertTriangle} variant="danger" />
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Invoices" value={payment.totalInvoices} icon={Receipt} variant="primary" />
        <KpiCard label="Paid Invoices" value={payment.paidInvoices} icon={CheckCircle2} variant="success" />
        <KpiCard label="Collection Rate" value={`${collectionRate}%`} icon={TrendingUp} variant="info" />
        <KpiCard label="Collected (30d)" value={money(payment.collectedLast30dPaise)} icon={Wallet} variant="primary" />
      </div>

      {/* ── Revenue Trend + Invoice Status ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={TrendingUp} title="Monthly Revenue Trend" />
          <div className="h-64 mt-3">
            {(revenueTrend || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueTrend.map((r) => ({ ...r, collected: r.collectedPaise }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => money(v)} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Bar dataKey="collected" name="Collected" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No revenue data yet</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <SectionHeader icon={Receipt} title="Invoice Breakdown" />
          <div className="h-56 mt-3">
            {invoiceStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={invoiceStatusData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={75} innerRadius={35} paddingAngle={3}
                    label={({ name, value }: any) => `${name}: ${value}`} labelLine={false}>
                    {invoiceStatusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No invoices yet</div>
            )}
          </div>
          {/* Legend strip */}
          <div className="flex justify-center gap-4 mt-2 text-[11px]">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Paid</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pending</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Overdue</span>
          </div>
        </div>
      </div>

      {/* ── Payroll Summary ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader icon={Briefcase} title="Payroll Summary" />
          <a href="/hr" className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1">
            Manage in HR <ChevronRight className="h-3 w-3" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <MiniStatCard label="Total Periods" value={payroll.totalPeriods} icon={Calendar} color="text-gray-600" bg="bg-gray-50" />
          <MiniStatCard label="Draft" value={payroll.draftPeriods} icon={FileText} color="text-amber-600" bg="bg-amber-50" />
          <MiniStatCard label="Finalized" value={payroll.finalizedPeriods} icon={FileCheck} color="text-blue-600" bg="bg-blue-50" />
          <MiniStatCard label="Paid" value={payroll.paidPeriods} icon={CheckCircle2} color="text-primary" bg="bg-primary/5" />
          <MiniStatCard label="Total Paid" value={money(payroll.totalPaidPaise)} icon={IndianRupee} color="text-primary" bg="bg-primary/5" />
        </div>
      </div>

      {/* ── Recent Payments ── */}
      {recentPayments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Recent Payments</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 10 received payments</p>
            </div>
            <a href="/owner/invoices" className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1">
              All Invoices <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <THead>
                <TH>Student</TH>
                <TH>Amount</TH>
                <TH>Paid At</TH>
                <TH>Invoice</TH>
              </THead>
              <tbody className="divide-y divide-gray-100">
                {recentPayments.map((p) => (
                  <TRow key={p.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.studentName} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{p.studentName}</p>
                          <p className="text-[11px] text-gray-400">{p.studentEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{money(p.amountPaise)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.paidAt ? fmtDateBriefIST(new Date(p.paidAt)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/api/v1/payment/receipt/${p.id}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Receipt className="h-3 w-3" /> View
                      </a>
                    </td>
                  </TRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Finance Quick Links ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/owner/invoices" icon={CreditCard} label="Invoices" desc="Manage invoices" variant="warning" />
        <QuickLink href="/hr" icon={Briefcase} label="Payroll" desc="Pay periods & slips" variant="info" />
        <QuickLink href="/owner/reports" icon={BarChart3} label="Financial Reports" desc="Revenue analytics" variant="primary" />
        <QuickLink href="/owner/invoices" icon={Send} label="Send Reminders" desc="Overdue notifications" variant="danger" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: PAYROLL (read-only)                                       */
/* ═══════════════════════════════════════════════════════════════ */

function PayrollTab({ data }: { data: DashboardData | null }) {
  if (!data) return null;
  const { payroll } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-primary/5 to-secondary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary font-medium">Total Paid Out (lifetime)</p>
            <p className="text-3xl font-bold text-primary mt-1">{money(payroll.totalPaidPaise)}</p>
            <p className="text-xs text-primary/70 mt-1">
              Across {payroll.paidPeriods} paid period{payroll.paidPeriods === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/80 shadow-sm">
            <Briefcase className="h-7 w-7 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Periods" value={payroll.totalPeriods} icon={Calendar} variant="primary" />
        <KpiCard label="Draft" value={payroll.draftPeriods} icon={FileText} variant="warning" />
        <KpiCard label="Finalized" value={payroll.finalizedPeriods} icon={FileCheck} variant="info" />
        <KpiCard label="Paid" value={payroll.paidPeriods} icon={CheckCircle2} variant="success" />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Payroll CRUD (period creation, rate configs, finalize/pay) is managed by HR.
        Use the link below to open the HR payroll panel.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <QuickLink href="/hr#payroll" icon={Briefcase} label="HR Payroll" desc="Manage periods & slips" variant="primary" />
        <QuickLink href="/owner/reports" icon={BarChart3} label="Payroll Reports" desc="Period analytics" variant="info" />
        <QuickLink href="/owner/invoices" icon={Receipt} label="Invoices" desc="Revenue side" variant="success" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: APPROVALS                                                 */
/* ═══════════════════════════════════════════════════════════════ */

function ApprovalsTab({ data }: {
  data: DashboardData | null;
}) {
  if (!data) return null;
  const { pending } = data;

  return (
    <div className="space-y-6">
      {/* ── Pending Summary ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="Cancellations" value={pending.cancellations} icon={Ban} variant={pending.cancellations > 0 ? 'danger' : 'primary'} />
        <KpiCard label="Session Requests" value={pending.sessionRequests} icon={Send} variant={pending.sessionRequests > 0 ? 'info' : 'primary'} />
        <KpiCard label="Active Alerts" value={pending.alerts} icon={AlertTriangle} variant={pending.criticalAlerts > 0 ? 'danger' : 'primary'} />
      </div>

      {/* ── Approvals ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a href="/academic-operator" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-primary/20 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <Ban className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Cancellation Requests</p>
              <p className="text-xs text-gray-400">Session cancellation approvals</p>
            </div>
            {pending.cancellations > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{pending.cancellations}</span>
            )}
          </div>
          <p className="text-xs text-primary group-hover:text-primary font-medium flex items-center gap-1">
            Manage in Academic Ops <ChevronRight className="h-3 w-3" />
          </p>
        </a>

        <a href="/academic-operator" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-primary/20 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Send className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Session Requests</p>
              <p className="text-xs text-gray-400">Reschedule &amp; cancel requests</p>
            </div>
            {pending.sessionRequests > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{pending.sessionRequests}</span>
            )}
          </div>
          <p className="text-xs text-primary group-hover:text-primary font-medium flex items-center gap-1">
            Manage in Academic Ops <ChevronRight className="h-3 w-3" />
          </p>
        </a>

        <a href="/coordinator" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-primary/20 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Monitoring Alerts</p>
              <p className="text-xs text-gray-400">System &amp; session alerts</p>
            </div>
            {pending.alerts > 0 && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{pending.alerts}</span>
            )}
          </div>
          <p className="text-xs text-primary group-hover:text-primary font-medium flex items-center gap-1">
            View in Coordinator <ChevronRight className="h-3 w-3" />
          </p>
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TAB: PEOPLE                                                    */
/* ═══════════════════════════════════════════════════════════════ */

function PeopleTab({ data }: { data: DashboardData | null }) {
  if (!data) return null;
  const { usersByRole, recentUsers, summary } = data;

  return (
    <div className="space-y-6">
      {/* ── Total Users Banner ── */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-primary/5 to-secondary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary font-medium">Total Active Users</p>
            <p className="text-3xl font-bold text-primary mt-1">{summary.totalUsers}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/80 shadow-sm">
            <Users className="h-7 w-7 text-primary" />
          </div>
        </div>
      </div>

      {/* ── Role Breakdown ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <SectionHeader icon={Users} title="Users by Role" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-4">
          {usersByRole.map((u) => {
            const Icon = ROLE_ICON_MAP[u.role] || Users;
            const pct = summary.totalUsers > 0 ? ((u.count / summary.totalUsers) * 100).toFixed(1) : '0';
            return (
              <div key={u.role} className="rounded-xl border border-gray-100 p-4 hover:border-primary/20 hover:shadow-sm transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{u.count}</p>
                    <p className="text-[11px] text-gray-500">{fmtRole(u.role)}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Users ── */}
      {recentUsers.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Recently Added Users</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest team members and students</p>
            </div>
            <a href="/hr" className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1">
              Manage All Users <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentUsers.map((u) => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                <Avatar name={u.display_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.display_name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <RoleBadge role={u.portal_role} />
                <span className="text-[11px] text-gray-400">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HR Quick Links ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/hr" icon={UserPlus} label="Add User" desc="Create new accounts" variant="primary" />
        <QuickLink href="/hr" icon={Briefcase} label="HR Panel" desc="Full user management" variant="info" />
        <QuickLink href="/hr" icon={GraduationCap} label="Teachers" desc="Teacher profiles" variant="success" />
        <QuickLink href="/hr" icon={BookOpen} label="Students" desc="Student profiles" variant="warning" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  SHARED SUB-COMPONENTS                                          */
/* ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
  );
}

const KPI_VARIANTS: Record<string, { icon: string; light: string }> = {
  primary: { icon: 'text-primary', light: 'bg-primary/5' },
  success: { icon: 'text-green-500', light: 'bg-primary/5' },
  info:    { icon: 'text-teal-500', light: 'bg-teal-50' },
  warning: { icon: 'text-amber-500', light: 'bg-amber-50' },
  danger:  { icon: 'text-red-500', light: 'bg-red-50' },
};

function KpiCard({ label, value, icon: Icon, variant = 'primary', pulse }: {
  label: string; value: number | string; icon: React.ElementType; variant?: string; pulse?: boolean;
}) {
  const v = KPI_VARIANTS[variant] || KPI_VARIANTS.primary;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${v.light}`}>
          <Icon className={`h-5 w-5 ${v.icon}`} />
        </div>
        {pulse && (
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function MiniStatCard({ label, value, icon: Icon, color, bg, pulse }: {
  label: string; value: number | string; icon: React.ElementType; color: string; bg: string; pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} shrink-0 relative`}>
        <Icon className={`h-4 w-4 ${color}`} />
        {pulse && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-ping" />}
      </div>
      <div>
        <p className={`text-lg font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

const QUICK_VARIANT: Record<string, string> = {
  primary: 'bg-primary/5 text-primary',
  info:    'bg-teal-50 text-teal-600',
  warning: 'bg-amber-50 text-amber-600',
  danger:  'bg-red-50 text-red-600',
  success: 'bg-primary/5 text-primary',
  default: 'bg-gray-50 text-gray-600',
};

function QuickLink({ href, icon: Icon, label, desc, variant = 'primary' }: {
  href: string; icon: React.ElementType; label: string; desc: string; variant?: string;
}) {
  const color = QUICK_VARIANT[variant] || QUICK_VARIANT.primary;
  return (
    <a href={href} className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 hover:border-primary/20 hover:shadow-md transition-all">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color} mb-3`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
    </a>
  );
}


