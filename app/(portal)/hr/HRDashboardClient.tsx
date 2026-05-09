// ===============================================================
// HR Associate Dashboard — Client Component
// Uses shared UI components — consistent with Roles screen design
// ===============================================================

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FilterSelect,
  FormField, FormGrid, Input, Textarea, Select, Modal, Alert,
  TableWrapper, THead, TH, TRow,
  StatCard, StatCardSmall, InfoCard,
  LoadingState, EmptyState, Badge, StatusBadge, RoleBadge, ActiveIndicator,
  useToast, useConfirm, Avatar, money,
} from '@/components/dashboard/shared';
import { fmtDateLongIST, fmtDateTimeIST } from '@/lib/utils';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, UserCheck,
  UserPlus, Search, Eye, EyeOff, Save,
  KeyRound, UserX, UserCheck2, Mail, Phone, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Shield, Award, Briefcase, Pencil,
  XCircle, ClipboardList, CreditCard, Clock, TrendingUp, Loader2,
  Calendar, DollarSign, FileText, ArrowRight, Ban, Check,
  AlertTriangle, Activity, Zap, X, Trash2,
  CalendarClock, ChevronLeft, ArrowRightLeft, Video,
} from 'lucide-react';
import {
  SUBJECTS, GRADES, BOARDS, QUALIFICATIONS,
  PwdInput, SubjectSelector, QualificationSelector,
  CredentialsPanel, CreateUserModal,
} from '@/components/dashboard/CreateUserForm';
import UsersTab from '@/components/dashboard/UsersTab';

// --- Types --------------------------------------------------
interface UserRow {
  email: string;
  full_name: string;
  portal_role: string;
  is_active: boolean;
  created_at: string;
  phone?: string;
  whatsapp?: string;
  subjects?: string[];
  grade?: string;
  section?: string;
  board?: string;
  parent_email?: string;
  parent_name?: string;
  qualification?: string;
  experience_years?: number;
  per_hour_rate?: number;
  assigned_region?: string;
  admission_date?: string;
  notes?: string;
  address?: string;
  children?: { name: string; email: string }[];
}

interface Stats {
  counts: Record<string, { total: number; active: number }>;
  recent_users: UserRow[];
  alerts: { students_without_parent: number; teachers_without_subjects: number };
}

interface HRDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

// --- Constants -----------------------------------------------
type HRTab = 'overview' | 'teachers' | 'students' | 'parents' | 'coordinators' | 'academic_operators' | 'hr_associates' | 'ghost_observers' | 'cancellations' | 'attendance' | 'payroll' | 'fee_rates' | 'leave_requests' | 'hr_credentials';

// Constants, PwdInput, SubjectSelector, QualificationSelector, CredentialsPanel,
// CreateUserModal — all imported from @/components/dashboard/CreateUserForm







// --- Main Dashboard -------------------------------------------
export default function HRDashboardClient({ userName, userEmail, userRole, permissions }: HRDashboardClientProps) {
  const [tab, setTab] = useState<HRTab>('overview');

  // Sync tab with URL hash (sidebar nav clicks)
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '') as HRTab;
      const valid: HRTab[] = ['overview','teachers','students','parents','coordinators','academic_operators','hr_associates','ghost_observers','cancellations','attendance','payroll','fee_rates','leave_requests','hr_credentials'];
      if (hash && valid.includes(hash)) setTab(hash);
      else if (!hash) setTab('overview');
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const tabs = [
    { key: 'overview',           label: 'Overview',           icon: LayoutDashboard },
    { key: 'teachers',           label: 'Teachers',           icon: BookOpen        },
    { key: 'students',           label: 'Students',           icon: GraduationCap   },
    { key: 'parents',            label: 'Parents',            icon: Shield          },
    { key: 'coordinators',       label: 'Batch Coordinators',  icon: UserCheck       },
    { key: 'academic_operators', label: 'Academic Operators',  icon: Briefcase       },
    { key: 'hr_associates',      label: 'HR Associates',       icon: UserCheck       },
    { key: 'ghost_observers',    label: 'Ghost Observers',     icon: Eye             },
    ...(permissions?.cancellations_manage !== false ? [{ key: 'cancellations', label: 'Cancellations', icon: XCircle }] : []),
    ...(permissions?.attendance_view !== false      ? [{ key: 'attendance',    label: 'Attendance',    icon: ClipboardList }] : []),
    ...(permissions?.payroll_manage !== false        ? [{ key: 'payroll',       label: 'Payroll',       icon: CreditCard }] : []),
    { key: 'fee_rates', label: 'Fee Rates', icon: DollarSign },
    { key: 'leave_requests', label: 'Leave Requests', icon: CalendarClock },
    ...(userRole === 'owner' ? [{ key: 'hr_credentials', label: 'HR Credentials', icon: UserPlus }] : []),
  ];
  void tabs; // kept for future use

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <div className="space-y-6">
        <PageHeader icon={Briefcase} title="HR Associate" subtitle="Create accounts, assign roles, issue login credentials" />

        {tab === 'overview'           && <OverviewTab />}
        {tab === 'teachers'           && <UsersTab role="teacher"           label="Teachers"           permissions={permissions} />}
        {tab === 'students'           && <UsersTab role="student"           label="Students"           permissions={permissions} />}
        {tab === 'parents'            && <UsersTab role="parent"            label="Parents"            permissions={permissions} />}
        {tab === 'coordinators'       && <UsersTab role="batch_coordinator" label="Batch Coordinators" permissions={permissions} />}
        {tab === 'academic_operators' && <UsersTab role="academic_operator" label="Academic Operators"  permissions={permissions} />}
        {tab === 'hr_associates'      && <UsersTab role="hr"                label="HR Associates"       permissions={permissions} />}
        {tab === 'ghost_observers'    && <UsersTab role="ghost"             label="Ghost Observers"     permissions={permissions} />}
        {tab === 'cancellations'      && <CancellationsTab />}
        {tab === 'attendance'         && <AttendanceTab />}
        {tab === 'payroll'            && <PayrollTab />}
        {tab === 'fee_rates'          && <FeeRatesTab />}
        {tab === 'leave_requests'      && <LeaveRequestsTab />}
        {tab === 'hr_credentials'       && userRole === 'owner' && <HRCredentialsTab currentUserEmail={userEmail} />}
      </div>
    </DashboardShell>
  );
}

// --- Overview Tab ---------------------------------------------
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelPending, setCancelPending] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/hr/stats').then((r) => r.json()),
      fetch('/api/v1/cancellations').then((r) => r.json()).catch(() => ({ success: false })),
    ]).then(([statsData, cancelData]) => {
      if (statsData.success) setStats(statsData.data);
      if (cancelData.success) {
        const pending = (cancelData.data?.requests || []).filter((r: { status: string }) => r.status === 'academic_approved').length;
        setCancelPending(pending);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const c = stats?.counts ?? {};
  const totalUsers = Object.values(c).reduce((sum, d) => sum + d.total, 0);
  const totalActive = Object.values(c).reduce((sum, d) => sum + d.active, 0);
  const alertCount = (stats?.alerts.students_without_parent ?? 0) + (stats?.alerts.teachers_without_subjects ?? 0);
  const urgentCount = cancelPending + alertCount;

  return (
    <div className="space-y-6">

      {/* -- Monitoring Priority Banner -- */}
      {urgentCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800">Requires Attention</h3>
              <p className="text-xs text-amber-600">{urgentCount} item{urgentCount !== 1 ? 's' : ''} need your immediate review</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {cancelPending > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{cancelPending} Cancellation{cancelPending !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-500">Awaiting HR final approval</p>
                </div>
              </div>
            )}
            {(stats?.alerts.students_without_parent ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{stats!.alerts.students_without_parent} Student{stats!.alerts.students_without_parent !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-500">Without parent linked</p>
                </div>
              </div>
            )}
            {(stats?.alerts.teachers_without_subjects ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{stats!.alerts.teachers_without_subjects} Teacher{stats!.alerts.teachers_without_subjects !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-500">Without subjects assigned</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- Quick Stats — Monitoring at a Glance -- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCardSmall icon={Users}         label="Total Users"      value={totalUsers}                      variant="default" />
        <StatCardSmall icon={Activity}      label="Active"           value={totalActive}                     variant="success" />
        <StatCardSmall icon={BookOpen}      label="Teachers"         value={c.teacher?.total ?? 0}           variant="info" />
        <StatCardSmall icon={GraduationCap} label="Students"         value={c.student?.total ?? 0}           variant="info" />
        <StatCardSmall icon={Shield}        label="Parents"          value={c.parent?.total ?? 0}            variant="default" />
        <StatCardSmall icon={UserCheck}     label="Batch Coordinators" value={c.batch_coordinator?.total ?? 0}  variant="default" />
      </div>

      {/* -- Role Breakdown Cards -- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { role: 'teacher',           label: 'Teachers',          icon: BookOpen    },
          { role: 'student',           label: 'Students',          icon: GraduationCap },
          { role: 'parent',            label: 'Parents',           icon: Shield      },
          { role: 'batch_coordinator', label: 'Batch Coordinators', icon: UserCheck   },
          { role: 'academic_operator', label: 'Acad. Operators',   icon: Briefcase   },
        ].map(({ role, label, icon: Icon }) => {
          const d = c[role] || { total: 0, active: 0 };
          const inactive = d.total - d.active;
          return (
            <div key={role} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <Icon className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{d.total}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-green-600 font-medium">{d.active} active</span>
                {inactive > 0 && <span className="text-xs text-red-500 font-medium">{inactive} inactive</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* -- Alerts -- */}
      {stats && (stats.alerts.students_without_parent > 0 || stats.alerts.teachers_without_subjects > 0) && (
        <div className="space-y-2">
          {stats.alerts.students_without_parent > 0 && (
            <Alert variant="warning" message={`${stats.alerts.students_without_parent} student${stats.alerts.students_without_parent !== 1 ? 's' : ''} without parent linked — assign parent accounts for proper monitoring`} />
          )}
          {stats.alerts.teachers_without_subjects > 0 && (
            <Alert variant="warning" message={`${stats.alerts.teachers_without_subjects} teacher${stats.alerts.teachers_without_subjects !== 1 ? 's' : ''} without subjects assigned — update teacher profiles`} />
          )}
        </div>
      )}

      {/* -- Recently Added -- */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Recently Added</h3>
        {stats?.recent_users.length === 0 ? (
          <EmptyState icon={Users} message="No users yet" />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_users.map((u) => (
                  <tr key={u.email} className="border-b border-gray-50 hover:bg-emerald-50/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} size="sm" />
                        <span className="font-medium text-gray-800">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.portal_role} /></td>
                    <td className="px-4 py-3"><ActiveIndicator active={u.is_active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- UsersTab imported from @/components/dashboard/UsersTab ---

// ================================================================
// CANCELLATIONS TAB — HR is final approver for teacher-initiated
// ================================================================


// ================================================================
// CANCELLATIONS TAB — HR is final approver for teacher-initiated
// ================================================================

interface CancellationRequest {
  id: string;
  room_id: string;
  room_name: string;
  requested_by: string;
  requester_role: string;
  reason: string;
  cancellation_type: string;
  status: string;
  coordinator_decision: string | null;
  coordinator_email: string | null;
  coordinator_at: string | null;
  admin_decision: string | null;
  admin_email: string | null;
  admin_at: string | null;
  academic_decision: string | null;
  academic_email: string | null;
  academic_at: string | null;
  hr_decision: string | null;
  hr_email: string | null;
  hr_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

function CancellationsTab() {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { confirm } = useConfirm();
  const toast = useToast();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/cancellations');
      const data = await res.json();
      if (data.success) setRequests(data.data.requests || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    const ok = await confirm({
      title: 'Approve Cancellation',
      message: 'This is the final approval. The session will be cancelled permanently.',
      confirmLabel: 'Approve',
      variant: 'warning',
    });
    if (!ok) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/v1/cancellations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestId: id }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Failed to approve'); return; }
      toast.success('Cancellation approved');
      fetchRequests();
    } finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/v1/cancellations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', requestId: id, notes: rejectReason }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Failed to reject'); return; }
      toast.success('Cancellation rejected');
      setRejectId(null);
      setRejectReason('');
      fetchRequests();
    } finally { setActionLoading(null); }
  };

  const filtered = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending_hr') return r.status === 'academic_approved';
    return r.status === filter || r.cancellation_type === filter;
  });

  const pendingHR = requests.filter(r => r.status === 'academic_approved').length;

  if (loading) return <LoadingState />;

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending_hr', label: `Awaiting HR (${pendingHR})` },
    { key: 'teacher_initiated', label: 'Teacher Initiated' },
    { key: 'parent_initiated', label: 'Parent Initiated' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" /> Session Cancellations
          </h2>
          <p className="text-xs text-gray-500">HR is the final approver for teacher-initiated cancellations</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingHR > 0 && (
            <Badge icon={AlertCircle} label={`${pendingHR} awaiting approval`} variant="warning" />
          )}
          <RefreshButton loading={loading} onClick={fetchRequests} />
        </div>
      </div>

      {/* Filter */}
      <FilterSelect value={filter} onChange={setFilter} options={filterTabs.map(t => ({ value: t.key, label: t.label }))} />

      {/* Requests */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={XCircle}
          message={filter === 'pending_hr' ? 'No requests awaiting HR approval' : 'No cancellation requests match the selected filter'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 space-y-2">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{r.room_name || r.room_id}</span>
                      <StatusBadge status={r.cancellation_type.replace(/_/g, ' ')} />
                      <StatusBadge status={r.status.replace(/_/g, ' ')} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Requested by <strong>{r.requested_by}</strong> ({r.requester_role}) · {fmtDateTimeIST(r.created_at)}
                    </p>
                    {r.reason && (
                      <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{r.reason}&rdquo;</p>
                    )}
                  </div>

                  {/* Action buttons — HR can approve at academic_approved status */}
                  {r.status === 'academic_approved' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="success" size="sm" icon={Check} onClick={() => handleApprove(r.id)}
                        loading={actionLoading === r.id} disabled={actionLoading === r.id}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" icon={Ban} onClick={() => setRejectId(r.id)}
                        disabled={actionLoading === r.id}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Approval chain for teacher-initiated */}
                {r.cancellation_type === 'teacher_initiated' && (
                  <div className="flex items-center gap-1 text-[10px] flex-wrap mt-1">
                    <span className="text-gray-400 font-medium">Chain:</span>
                    {[
                      { label: 'Coordinator', decision: r.coordinator_decision },
                      { label: 'Admin', decision: r.admin_decision },
                      { label: 'Academic', decision: r.academic_decision },
                      { label: 'HR', decision: r.hr_decision },
                    ].map((step, i) => (
                      <span key={step.label} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-gray-300" />}
                        <span className={`rounded px-1.5 py-0.5 border text-[10px] font-medium ${
                          step.decision === 'approved' ? 'bg-green-50 border-green-200 text-green-700' :
                          step.decision === 'rejected' ? 'bg-red-50 border-red-200 text-red-600' :
                          'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                          {step.label}{step.decision ? ' ✓' : ''}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Rejection reason */}
                {r.status === 'rejected' && r.rejection_reason && (
                  <Alert variant="error" message={`Rejection reason: ${r.rejection_reason}`} />
                )}
              </div>

              {/* Inline reject reason form */}
              {rejectId === r.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                  <FormField label="Reason for rejection">
                    <Textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this cancellation is being rejected..."
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
                    <Button variant="danger" size="sm" icon={Ban} onClick={() => handleReject(r.id)} loading={actionLoading === r.id}>Confirm Rejection</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// ATTENDANCE TAB — Aggregate attendance monitoring
// ================================================================

interface AttendanceSummary {
  period_days: number;
  rooms: { total: number; completed: number; cancelled: number };
  students: { total_sessions: number; present: number; late: number; absent: number; avg_duration_min: number };
  teachers: { total_sessions: number; present: number; avg_duration_min: number };
}

interface TeacherAttendance {
  participant_email: string;
  participant_name: string;
  total_classes: string;
  attended: string;
  missed: string;
  late: string;
  avg_duration_sec: string;
}

interface StudentAttendance {
  participant_email: string;
  participant_name: string;
  total_classes: string;
  present: string;
  late: string;
  absent: string;
  avg_duration_sec: string;
  avg_late_sec: string;
}

function AttendanceTab() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [teachers, setTeachers] = useState<TeacherAttendance[]>([]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [subTab, setSubTab] = useState<string>('summary');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, teachRes, stuRes] = await Promise.all([
        fetch(`/api/v1/hr/attendance?resource=summary&days=${days}`),
        fetch(`/api/v1/hr/attendance?resource=by_teacher&days=${days}`),
        fetch(`/api/v1/hr/attendance?resource=by_student&days=${days}`),
      ]);
      const [sumData, teachData, stuData] = await Promise.all([sumRes.json(), teachRes.json(), stuRes.json()]);
      if (sumData.success) setSummary(sumData.data);
      if (teachData.success) setTeachers(teachData.data.teachers || []);
      if (stuData.success) setStudents(stuData.data.students || []);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingState />;

  const attendSubTabs = [
    { key: 'summary',  label: 'Overview',   icon: LayoutDashboard },
    { key: 'teachers', label: 'Teachers',    icon: BookOpen, count: teachers.length },
    { key: 'students', label: 'Students',    icon: GraduationCap, count: students.length },
  ];

  // Compute rates for monitoring indicators
  const studentRate = summary && summary.students.total_sessions > 0
    ? Math.round((summary.students.present / summary.students.total_sessions) * 100) : 0;
  const absentRate = summary && summary.students.total_sessions > 0
    ? Math.round((summary.students.absent / summary.students.total_sessions) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" /> Attendance Monitor
          </h2>
          <p className="text-xs text-gray-500">Aggregate attendance across all rooms</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '14', label: 'Last 14 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '60', label: 'Last 60 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
          <RefreshButton loading={loading} onClick={fetchData} />
        </div>
      </div>

      {/* Monitoring Priority — Attendance Health */}
      {summary && absentRate > 15 && (
        <Alert variant="warning" message={`Student absence rate is ${absentRate}% (${summary.students.absent} absent out of ${summary.students.total_sessions} sessions) — investigate and follow up`} />
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCardSmall icon={Calendar}      label="Total Rooms"      value={summary.rooms.total}           variant="info" />
          <StatCardSmall icon={CheckCircle2}   label="Students Present" value={summary.students.present}      variant="success" />
          <StatCardSmall icon={Clock}          label="Students Late"    value={summary.students.late}         variant="warning" />
          <StatCardSmall icon={UserX}          label="Students Absent"  value={summary.students.absent}       variant="danger" />
          <StatCardSmall icon={BookOpen}       label="Teacher Present"  value={summary.teachers.present}      variant="success" />
          <StatCardSmall icon={TrendingUp}     label="Avg Duration"     value={`${summary.students.avg_duration_min}m`} variant="default" />
        </div>
      )}

      {/* Sub-section */}
      <FilterSelect value={subTab} onChange={setSubTab} options={attendSubTabs.map(t => ({ value: t.key, label: t.label }))} />

      {/* Summary view */}
      {subTab === 'summary' && summary && (
        <div className="space-y-4">
          {/* Attendance rate bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Student Attendance Rate</h3>
            {summary.students.total_sessions > 0 ? (
              <>
                <div className="relative h-6 rounded-full bg-gray-100 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-green-500" style={{ width: `${(summary.students.present / summary.students.total_sessions) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-amber-500" style={{ left: `${(summary.students.present / summary.students.total_sessions) * 100}%`, width: `${(summary.students.late / summary.students.total_sessions) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-red-500" style={{ left: `${((summary.students.present + summary.students.late) / summary.students.total_sessions) * 100}%`, width: `${(summary.students.absent / summary.students.total_sessions) * 100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Present {Math.round((summary.students.present / summary.students.total_sessions) * 100)}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Late {Math.round((summary.students.late / summary.students.total_sessions) * 100)}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent {Math.round((summary.students.absent / summary.students.total_sessions) * 100)}%</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">No attendance data in this period</p>
            )}
          </div>

          {/* Room statistics */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Calendar} label="Total Rooms" value={summary.rooms.total} variant="info" />
            <StatCard icon={CheckCircle2} label="Completed" value={summary.rooms.completed} variant="success" />
            <StatCard icon={XCircle} label="Cancelled" value={summary.rooms.cancelled} variant="danger" />
          </div>
        </div>
      )}

      {/* Teachers table */}
      {subTab === 'teachers' && (
        teachers.length === 0 ? (
          <EmptyState icon={BookOpen} message="No teacher attendance data" />
        ) : (
          <TableWrapper
            footer={<span>{teachers.length} teacher{teachers.length !== 1 ? 's' : ''}</span>}
          >
            <THead>
              <TH>Teacher</TH>
              <TH className="text-center">Sessions</TH>
              <TH className="text-center">Attended</TH>
              <TH className="text-center">Missed</TH>
              <TH className="text-center">Late</TH>
              <TH className="text-center">Avg Duration</TH>
              <TH className="text-center">Rate</TH>
            </THead>
            <tbody>
              {teachers.map(t => {
                const total = Number(t.total_classes);
                const attended = Number(t.attended);
                const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
                return (
                  <TRow key={t.participant_email}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.participant_name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800">{t.participant_name}</p>
                          <p className="text-xs text-gray-400">{t.participant_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{total}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{attended}</td>
                    <td className="px-4 py-3 text-center text-red-500">{t.missed}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{t.late}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{Math.round(Number(t.avg_duration_sec) / 60)}m</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        label={`${rate}%`}
                        variant={rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger'}
                      />
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrapper>
        )
      )}

      {/* Students table */}
      {subTab === 'students' && (
        students.length === 0 ? (
          <EmptyState icon={GraduationCap} message="No student attendance data" />
        ) : (
          <TableWrapper
            footer={<span>{students.length} student{students.length !== 1 ? 's' : ''}</span>}
          >
            <THead>
              <TH>Student</TH>
              <TH className="text-center">Sessions</TH>
              <TH className="text-center">Present</TH>
              <TH className="text-center">Late</TH>
              <TH className="text-center">Absent</TH>
              <TH className="text-center">Avg Duration</TH>
              <TH className="text-center">Rate</TH>
            </THead>
            <tbody>
              {students.map(s => {
                const total = Number(s.total_classes);
                const present = Number(s.present) + Number(s.late);
                const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                return (
                  <TRow key={s.participant_email}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.participant_name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800">{s.participant_name}</p>
                          <p className="text-xs text-gray-400">{s.participant_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{total}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{s.present}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{s.late}</td>
                    <td className="px-4 py-3 text-center text-red-500">{s.absent}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{Math.round(Number(s.avg_duration_sec) / 60)}m</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        label={`${rate}%`}
                        variant={rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger'}
                      />
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrapper>
        )
      )}
    </div>
  );
}

// ================================================================
// PAYROLL TAB — Manage pay configs, periods, payslips
// ================================================================

// --- Payroll types & tab -----------------------------------------

interface TeacherRate {
  email: string;
  full_name: string;
  per_hour_rate: number | null;
  subjects: string[] | null;
  total_sessions: number;
  total_earned_paise: number;
}

interface PayrollPeriod {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  payslip_count: number;
  total_paise: number;
  created_at: string;
}

interface Payslip {
  id: string;
  payroll_period_id: string;
  teacher_email: string;
  teacher_name?: string;
  per_hour_rate?: number;
  classes_conducted: number;
  classes_cancelled: number;
  classes_missed: number;
  rate_per_class: number;
  base_pay_paise: number;
  extension_sessions: number;
  extension_paise: number;
  incentive_paise: number;
  lop_paise: number;
  total_paise: number;
  status: string;
  paid_at?: string;
  payment_reference?: string;
  paid_by?: string;
}

function PayrollTab() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [teacherRates, setTeacherRates] = useState<TeacherRate[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [paySubTab, setPaySubTab] = useState<string>('periods');
  const [actionLoading, setActionLoading] = useState(false);
  const { confirm } = useConfirm();
  const toast = useToast();

  // Pay modal
  const [payModal, setPayModal] = useState<{ slip: Payslip; ref: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-sync: creates periods + payslips for any month with earnings that doesn't have a period yet
      await fetch('/api/v1/payroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_periods' }),
      });
      const [pRes, tRes] = await Promise.all([
        fetch('/api/v1/payroll?resource=periods'),
        fetch('/api/v1/payroll?resource=teacher_rates'),
      ]);
      const [pData, tData] = await Promise.all([pRes.json(), tRes.json()]);
      if (pData.success) setPeriods(pData.data.periods || []);
      if (tData.success) setTeacherRates(tData.data.teachers || []);
    } finally { setLoading(false); }
  }, []);

  const fetchPayslips = useCallback(async (periodId: string) => {
    const res = await fetch(`/api/v1/payroll?resource=payslips&periodId=${periodId}`);
    const data = await res.json();
    if (data.success) setPayslips(data.data.payslips || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (selectedPeriod) fetchPayslips(selectedPeriod);
    else setPayslips([]);
  }, [selectedPeriod, fetchPayslips]);

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { action, ...extra };
      const res = await fetch('/api/v1/payroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${action.replace(/_/g, ' ')} completed`);
        fetchAll();
        if (selectedPeriod) fetchPayslips(selectedPeriod);
      } else {
        toast.error(data.error || 'Action failed');
      }
    } finally { setActionLoading(false); }
  };

  if (loading) return <LoadingState />;

  const payTabs = [
    { key: 'periods', label: 'Payroll',      icon: Calendar,   count: periods.length },
    { key: 'teachers', label: 'Teacher Rates', icon: DollarSign, count: teacherRates.filter(t => t.per_hour_rate).length },
  ];

  const draftPeriods = periods.filter(p => p.status === 'draft').length;
  const finalizedPeriods = periods.filter(p => p.status === 'finalized').length;
  const selPeriod = periods.find(p => p.id === selectedPeriod);
  const paidCount = payslips.filter(s => s.status === 'paid').length;
  const unpaidCount = payslips.filter(s => s.status !== 'paid').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" /> Payroll Management
          </h2>
          <p className="text-xs text-gray-500">Monthly periods auto-generated from session data. Review, finalize, and process payments.</p>
        </div>
        <div className="flex items-center gap-2">
          {draftPeriods > 0 && <Badge icon={AlertCircle} label={`${draftPeriods} draft`} variant="warning" />}
          {finalizedPeriods > 0 && <Badge icon={CheckCircle2} label={`${finalizedPeriods} ready to pay`} variant="info" />}
          <RefreshButton loading={loading} onClick={fetchAll} />
        </div>
      </div>

      {/* Sub-section */}
      <FilterSelect value={paySubTab} onChange={setPaySubTab} options={payTabs.map(t => ({ value: t.key, label: t.label }))} />

      {/* ═══ PERIODS ═══ */}
      {paySubTab === 'periods' && (
        <div className="space-y-4">
          {periods.length === 0 ? (
            <EmptyState icon={Calendar} message="No payroll data yet — periods are auto-created when sessions are completed" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {periods.map(p => {
                const isSelected = selectedPeriod === p.id;
                const isPaid = p.status === 'paid';
                const isFinal = p.status === 'finalized';
                const isDraft = p.status === 'draft';
                return (
                  <div key={p.id}
                    onClick={() => setSelectedPeriod(isSelected ? null : p.id)}
                    className={`rounded-xl border cursor-pointer transition-all shadow-sm ${
                      isSelected ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                      : isPaid ? 'border-green-200 bg-green-50/30 hover:border-green-300'
                      : isFinal ? 'border-blue-200 bg-blue-50/30 hover:border-blue-300'
                      : 'border-gray-200 bg-white hover:border-emerald-200 hover:shadow-md'
                    }`}>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 text-sm">{p.period_label}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fmtDateLongIST(p.period_start)} — {fmtDateLongIST(p.period_end)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-gray-400">{p.payslip_count} teacher{p.payslip_count !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-emerald-700">{money(p.total_paise)}</span>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1.5 mt-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {isDraft && (
                          <>
                            <Button variant="primary" size="xs" onClick={async () => {
                              const ok = await confirm({ title: 'Recalculate Payslips', message: 'Recalculate payslips with latest session data? Existing draft payslips will be updated.', confirmLabel: 'Recalculate', variant: 'info' });
                              if (ok) handleAction('generate', { periodId: p.id });
                            }} disabled={actionLoading}>
                              <Zap className="h-3 w-3 mr-1" /> Recalculate
                            </Button>
                            <Button variant="secondary" size="xs" onClick={async () => {
                              const ok = await confirm({ title: 'Finalize Payroll', message: 'Finalize this period? Payslips will be locked and ready for payment.', confirmLabel: 'Finalize', variant: 'warning' });
                              if (ok) handleAction('finalize', { periodId: p.id });
                            }} disabled={actionLoading || p.payslip_count === 0}>Finalize</Button>
                          </>
                        )}
                        {isFinal && (
                          <Button variant="success" size="xs" onClick={async () => {
                            const ok = await confirm({ title: 'Mark All as Paid', message: `Mark all ${p.payslip_count} payslips as paid? Or pay teachers individually below.`, confirmLabel: 'Pay All', variant: 'info' });
                            if (ok) handleAction('mark_paid', { periodId: p.id });
                          }} disabled={actionLoading}>
                            <Check className="h-3 w-3 mr-1" /> Pay All
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payslips for selected period */}
          {selectedPeriod && selPeriod && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  {selPeriod.period_label} — Payslips
                  {payslips.length > 0 && (
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ({paidCount} paid, {unpaidCount} pending)
                    </span>
                  )}
                </h3>
              </div>

              {payslips.length === 0 ? (
                <EmptyState icon={FileText} message="No payslips for this period — click Recalculate to generate" />
              ) : (
                <TableWrapper
                  footer={
                    <>
                      <span>{payslips.length} payslip{payslips.length !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-emerald-700">Total: {money(payslips.reduce((s, p) => s + p.total_paise, 0))}</span>
                    </>
                  }
                >
                  <THead>
                    <TH>Teacher</TH>
                    <TH className="text-center">Rate/hr</TH>
                    <TH className="text-center">Sessions</TH>
                    <TH className="text-right">Base Pay</TH>
                    <TH className="text-right">Extension</TH>
                    <TH className="text-right">Incentive</TH>
                    <TH className="text-right">LOP</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-center">Status</TH>
                    <TH></TH>
                  </THead>
                  <tbody>
                    {payslips.map(s => (
                      <TRow key={s.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={s.teacher_name || s.teacher_email} size="sm" />
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{s.teacher_name || s.teacher_email}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[160px]">{s.teacher_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-emerald-700 font-medium">
                          {s.per_hour_rate ? `₹${s.per_hour_rate}` : money(s.rate_per_class)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-gray-800">{s.classes_conducted}</span>
                          {s.extension_sessions > 0 && (
                            <span className="text-xs text-teal-500 ml-0.5">(+{s.extension_sessions}ext)</span>
                          )}
                          {s.classes_missed > 0 && (
                            <span className="text-xs text-red-400 ml-0.5">(−{s.classes_missed})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{money(s.base_pay_paise)}</td>
                        <td className="px-4 py-3 text-right text-sm text-teal-600">
                          {s.extension_paise > 0 ? `+${money(s.extension_paise)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-green-600">
                          {s.incentive_paise > 0 ? `+${money(s.incentive_paise)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-red-500">
                          {s.lop_paise > 0 ? `−${money(s.lop_paise)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">{money(s.total_paise)}</td>
                        <td className="px-4 py-3 text-center">
                          {s.status === 'paid' ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200">
                                Paid
                              </span>
                              {s.paid_at && (
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(s.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {s.payment_reference && (
                                <span className="text-[10px] text-gray-400 truncate max-w-[80px]" title={s.payment_reference}>
                                  {s.payment_reference}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                              s.status === 'finalized' ? 'text-blue-700 bg-blue-50 border border-blue-200'
                              : 'text-gray-600 bg-gray-50 border border-gray-200'
                            }`}>
                              {s.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.status === 'finalized' && (
                            <Button variant="success" size="xs"
                              onClick={() => setPayModal({ slip: s, ref: '' })}
                              disabled={actionLoading}>
                              <Check className="h-3 w-3 mr-0.5" /> Pay
                            </Button>
                          )}
                        </td>
                      </TRow>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TEACHER RATES ═══ */}
      {paySubTab === 'teachers' && (
        <div className="space-y-3">
          {teacherRates.length === 0 ? (
            <EmptyState icon={DollarSign} message="No active teachers found" />
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Per-hour rates are set in each teacher&apos;s profile (HR → Teachers → Edit).
                Salary is auto-calculated: <strong>rate/hr × (session duration / 60)</strong>.
              </p>
              <TableWrapper footer={<span>{teacherRates.length} teacher{teacherRates.length !== 1 ? 's' : ''}</span>}>
                <THead>
                  <TH>Teacher</TH>
                  <TH>Subjects</TH>
                  <TH className="text-right">Rate/hr</TH>
                  <TH className="text-center">Sessions</TH>
                  <TH className="text-right">Total Earned</TH>
                </THead>
                <tbody>
                  {teacherRates.map(t => (
                    <TRow key={t.email}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={t.full_name || t.email} size="sm" />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{t.full_name}</p>
                            <p className="text-xs text-gray-400">{t.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {t.subjects?.join(', ') || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.per_hour_rate ? (
                          <span className="font-semibold text-emerald-700">₹{t.per_hour_rate}/hr</span>
                        ) : (
                          <span className="text-xs text-red-400 font-medium">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">{t.total_sessions}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                        {t.total_earned_paise > 0 ? money(t.total_earned_paise) : <span className="text-gray-300">—</span>}
                      </td>
                    </TRow>
                  ))}
                </tbody>
              </TableWrapper>
            </>
          )}
        </div>
      )}

      {/* ═══ PAY MODAL — individual payment ═══ */}
      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title="Confirm Payment">
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Teacher</span>
                <span className="font-medium text-gray-800">{payModal.slip.teacher_name || payModal.slip.teacher_email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-emerald-700 text-lg">{money(payModal.slip.total_paise)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sessions</span>
                <span className="text-gray-700">{payModal.slip.classes_conducted} conducted</span>
              </div>
            </div>
            <FormField label="Payment Reference / UTR (optional)">
              <Input type="text" value={payModal.ref}
                onChange={(e) => setPayModal(m => m ? { ...m, ref: e.target.value } : null)}
                placeholder="e.g. UTR123456789, NEFT ref" />
            </FormField>
            <p className="text-xs text-gray-400">
              An email notification will be sent to the teacher confirming payment.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setPayModal(null)}>Cancel</Button>
              <Button variant="success" className="flex-1" icon={Check}
                loading={actionLoading} disabled={actionLoading}
                onClick={async () => {
                  await handleAction('mark_slip_paid', {
                    payslipId: payModal.slip.id,
                    paymentReference: payModal.ref.trim() || undefined,
                  });
                  setPayModal(null);
                }}>
                Confirm Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- Fee Rates Tab --------------------------------------------
interface FeeRate {
  id: string;
  batch_id: string | null;
  batch_name: string | null;
  subject: string | null;
  grade: string | null;
  per_hour_rate_paise: number;
  currency: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

function FeeRatesTab() {
  const [rates, setRates] = useState<FeeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<{ batch_id: string; batch_name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    batch_id: '', subject: '', grade: '',
    per_hour_rate: '', currency: 'INR', notes: '',
  });
  const toast = useToast();

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payment/session-rates');
      const data = await res.json();
      if (data.success) setRates(data.data?.rates || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/batches');
      const data = await res.json();
      if (data.success) setBatches(data.data?.batches || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRates(); fetchBatches(); }, [fetchRates, fetchBatches]);

  function resetForm() {
    setForm({ batch_id: '', subject: '', grade: '', per_hour_rate: '', currency: 'INR', notes: '' });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(rate: FeeRate) {
    setForm({
      batch_id: rate.batch_id || '',
      subject: rate.subject || '',
      grade: rate.grade || '',
      per_hour_rate: String(rate.per_hour_rate_paise / 100),
      currency: rate.currency || 'INR',
      notes: rate.notes || '',
    });
    setEditId(rate.id);
    setShowForm(true);
  }

  async function handleSave() {
    const rateNum = parseFloat(form.per_hour_rate);
    if (!rateNum || rateNum <= 0) {
      toast.error('Enter a valid per-hour rate');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/payment/session-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editId ? { id: editId } : {}),
          batch_id: form.batch_id || null,
          subject: form.subject || null,
          grade: form.grade || null,
          per_hour_rate_paise: Math.round(rateNum * 100),
          currency: form.currency,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editId ? 'Rate updated' : 'Rate created');
        resetForm();
        fetchRates();
      } else {
        toast.error(data.error || 'Failed to save rate');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch('/api/v1/payment/session-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: false }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Rate deactivated'); fetchRates(); }
    } catch { toast.error('Failed'); }
  }

  const fmtRate = (paise: number, cur: string) => {
    const sym: Record<string, string> = { INR: '\u20b9', USD: '$', AED: '\u062f.\u0625', SAR: '\ufdfc' };
    return `${sym[cur] || cur} ${(paise / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Session Fee Rates</h3>
          <p className="text-xs text-muted-foreground">Configure per-hour rates for batch/subject combinations. These are used when students join sessions.</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={fetchRates} loading={loading} />
          <Button variant="primary" icon={DollarSign} onClick={() => { resetForm(); setShowForm(true); }}>
            Add Rate
          </Button>
        </div>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h4 className="font-semibold text-sm">{editId ? 'Edit Fee Rate' : 'New Fee Rate'}</h4>
          <FormGrid cols={3}>
            <FormField label="Batch (optional)">
              <Select
                value={form.batch_id}
                onChange={(val) => setForm({ ...form, batch_id: val })}
                placeholder="All Batches"
                options={batches.map(b => ({ value: b.batch_id, label: b.batch_name }))}
              />
            </FormField>
            <FormField label="Subject (optional)">
              <Select
                value={form.subject}
                onChange={(val) => setForm({ ...form, subject: val })}
                placeholder="All Subjects"
                options={SUBJECTS.map(s => ({ value: s, label: s }))}
              />
            </FormField>
            <FormField label="Grade (optional)">
              <Select
                value={form.grade}
                onChange={(val) => setForm({ ...form, grade: val })}
                placeholder="All Grades"
                options={GRADES.map(g => ({ value: g, label: g }))}
              />
            </FormField>
          </FormGrid>
          <FormGrid cols={3}>
            <FormField label="Per-Hour Rate">
              <Input type="number" step="0.01" min="0" placeholder="e.g. 500"
                value={form.per_hour_rate} onChange={(e) => setForm({ ...form, per_hour_rate: e.target.value })} />
            </FormField>
            <FormField label="Currency">
              <Select
                value={form.currency}
                onChange={(val) => setForm({ ...form, currency: val })}
                options={['INR', 'USD', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD'].map(c => ({ value: c, label: c }))}
              />
            </FormField>
            <FormField label="Notes (optional)">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal note" />
            </FormField>
          </FormGrid>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={resetForm}>Cancel</Button>
            <Button variant="primary" icon={Save} onClick={handleSave} loading={saving} disabled={saving || !form.per_hour_rate}>
              {editId ? 'Update Rate' : 'Create Rate'}
            </Button>
          </div>
        </div>
      )}

      {/* Rates table */}
      {loading ? (
        <LoadingState />
      ) : rates.length === 0 ? (
        <EmptyState icon={DollarSign} message="No fee rates configured yet" />
      ) : (
        <TableWrapper>
          <THead>
            <TH>Batch</TH>
            <TH>Subject</TH>
            <TH>Grade</TH>
            <TH>Per-Hour Rate</TH>
            <TH>Currency</TH>
            <TH>Notes</TH>
            <TH>Actions</TH>
          </THead>
          <tbody>
            {rates.map(r => (
              <TRow key={r.id}>
                <td className="px-3 py-2 text-sm">{r.batch_name || <span className="text-muted-foreground italic">All</span>}</td>
                <td className="px-3 py-2 text-sm">{r.subject || <span className="text-muted-foreground italic">All</span>}</td>
                <td className="px-3 py-2 text-sm">{r.grade || <span className="text-muted-foreground italic">All</span>}</td>
                <td className="px-3 py-2 text-sm font-bold text-green-400">{fmtRate(r.per_hour_rate_paise, r.currency)}/hr</td>
                <td className="px-3 py-2 text-sm">{r.currency}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes || '—'}</td>
                <td className="px-3 py-2 text-sm">
                  <div className="flex gap-1">
                    <IconButton icon={Pencil} title="Edit" onClick={() => startEdit(r)} size="sm" />
                    <IconButton icon={Trash2} title="Delete" onClick={() => handleDelete(r.id)} size="sm" variant="danger" />
                  </div>
                </td>
              </TRow>
            ))}
          </tbody>
        </TableWrapper>
      )}

      {/* Info box */}
      <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p><strong>How fee rates work:</strong></p>
        <p>When a student joins a session, the system looks for the most specific matching rate:</p>
        <p>1. Exact batch + subject match &rarr; 2. Batch only &rarr; 3. Subject + grade &rarr; 4. Subject only &rarr; 5. Default</p>
        <p>The per-hour rate is prorated by session duration (e.g. 45-min session = 75% of hourly rate).</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: Leave Requests (HR approval — new workflow)
// HR reviews AO's resolution plan and approves/rejects
// ═══════════════════════════════════════════════════════════════

interface HRLeaveRequest {
  id: string;
  teacher_email: string;
  teacher_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  hr_status: string;
  ao_reviewed_by: string | null;
  ao_notes: string | null;
  hr_reviewed_by: string | null;
  affected_sessions: string[];
  resolution_plan: { session_id: string; action: string; substitute_name?: string; substitute_email?: string; new_date?: string; new_time?: string; notes?: string; subject_override?: string; original_subject?: string }[];
  forwarded_at: string | null;
  medical_certificate_url: string | null;
  medical_certificate_name: string | null;
  salary_adjustment: 'full_pay' | 'half_pay' | 'no_pay' | null;
  created_at: string;
}

interface HRSessionDetail {
  session_id: string;
  batch_id: string;
  subject: string;
  scheduled_date: string;
  start_time: string;
  batch_name: string;
  teacher_name: string;
  teacher_email: string;
  status: string;
  grade: string | null;
  board: string | null;
  duration_minutes: number;
}

function LeaveRequestsTab() {
  const [requests, setRequests] = useState<HRLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showReject, setShowReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending_hr' | 'approved' | 'confirmed' | 'rejected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [salaryAdjMap, setSalaryAdjMap] = useState<Record<string, 'full_pay' | 'half_pay' | 'no_pay'>>({});

  // Detail view state
  const [detailLeaveId, setDetailLeaveId] = useState<string | null>(null);
  const [detailSessions, setDetailSessions] = useState<HRSessionDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLeave, setDetailLeave] = useState<HRLeaveRequest | null>(null);

  const toast = useToast();
  const { confirm } = useConfirm();

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher-leave');
      const data = await res.json();
      if (data.success) setRequests(data.data?.requests ?? []);
    } catch { toast.error('Failed to load leave requests'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  const handleAction = async (id: string, action: 'hr_approve' | 'hr_reject', reason?: string) => {
    if (actionId) return; // prevent double-click
    setActionId(id);
    try {
      const salaryAdj = salaryAdjMap[id] || undefined;
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, request_id: id, ...(reason ? { notes: reason } : {}), ...(action === 'hr_approve' && salaryAdj ? { salary_adjustment: salaryAdj } : {}) }),
      });
      const data = await res.json();
      if (data.success) { toast.success(action === 'hr_approve' ? 'Leave approved \u2014 sessions managed' : 'Leave rejected'); closeDetail(); fetchLeave(); setShowReject(null); setRejectReason(''); }
      else toast.error(data.error || 'Action failed');
    } catch { toast.error('Network error'); }
    finally { setActionId(null); }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pendingHRCount = requests.filter(r => r.status === 'pending_hr').length;

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(r => r.id)));
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
      if (data.success) { toast.success(`${data.data?.deleted || selectedIds.size} deleted`); setSelectedIds(new Set()); fetchLeave(); }
      else toast.error(data.error || 'Delete failed');
    } catch { toast.error('Network error'); }
    finally { setDeleting(false); }
  };

  const openDetail = async (leaveId: string) => {
    setDetailLeaveId(leaveId);
    setDetailLoading(true);
    setDetailSessions([]);
    // Use the existing leave from list
    const lr = requests.find(r => r.id === leaveId) || null;
    setDetailLeave(lr);
    try {
      const res = await fetch(`/api/v1/teacher-leave?leave_id=${encodeURIComponent(leaveId)}`);
      const data = await res.json();
      if (data.success) {
        setDetailSessions(data.data?.affectedSessions || []);
        // Update resolution_plan from server (freshest data)
        if (data.data?.leave?.resolution_plan && lr) {
          lr.resolution_plan = data.data.leave.resolution_plan;
          lr.ao_notes = data.data.leave.ao_notes;
          setDetailLeave({ ...lr });
        }
      }
    } catch { toast.error('Failed to load plan details'); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => {
    setDetailLeaveId(null);
    setDetailSessions([]);
    setDetailLeave(null);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending_ao': return { label: 'Pending AO', color: 'text-amber-500' };
      case 'pending_hr': return { label: 'Pending Your Review', color: 'text-blue-600' };
      case 'approved': return { label: 'Approved — AO Executing', color: 'text-emerald-600' };
      case 'confirmed': return { label: 'Confirmed', color: 'text-green-600' };
      case 'rejected': return { label: 'Rejected', color: 'text-red-500' };
      case 'withdrawn': return { label: 'Withdrawn', color: 'text-gray-500' };
      default: return { label: status, color: 'text-gray-500' };
    }
  };

  if (loading) return <LoadingState />;

  // ═══════════════════════════════════════════════════════════
  // DETAIL VIEW — Full plan + session breakdown
  // ═══════════════════════════════════════════════════════════
  if (detailLeaveId && detailLeave) {
    const lr = detailLeave;
    const sd = getStatusDisplay(lr.status);
    const isPendingHR = lr.status === 'pending_hr';
    const plan = lr.resolution_plan || [];

    const substituteCount = plan.filter(p => p.action === 'substitute').length;
    const rescheduleCount = plan.filter(p => p.action === 'reschedule').length;
    const cancelCount = plan.filter(p => p.action === 'cancel').length;
    const subjectChangeCount = plan.filter(p => p.subject_override).length;

    return (
      <div className="space-y-5">
        <button onClick={closeDetail} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition">
          <ChevronLeft className="h-4 w-4" />Back to Leave Requests
        </button>

        {/* Leave details header */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Avatar name={lr.teacher_name || lr.teacher_email} size="lg" />
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-base font-bold">{lr.teacher_name || lr.teacher_email}</span>
                  <Badge label={lr.leave_type} variant="secondary" />
                  <StatusBadge status={lr.status} />
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(lr.start_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  {' – '}
                  {new Date(lr.end_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400 mt-1">{lr.reason}</p>
                {lr.medical_certificate_url && (
                  <a href={lr.medical_certificate_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition font-medium">
                    <FileText className="h-3.5 w-3.5" /> View Medical Certificate
                  </a>
                )}
                <p className={`text-xs mt-1 font-semibold ${sd.color}`}>{sd.label}</p>
                {lr.forwarded_at && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    AO forwarded: {new Date(lr.forwarded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Approve / Reject buttons */}
            {isPendingHR && (
              <div className="flex flex-col gap-2 shrink-0">
                {lr.leave_type === 'sick' && (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Salary Impact</label>
                    <select value={salaryAdjMap[lr.id] || 'no_pay'}
                      onChange={e => setSalaryAdjMap(m => ({ ...m, [lr.id]: e.target.value as 'full_pay' | 'half_pay' | 'no_pay' }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
                      <option value="no_pay">No Pay (LOP)</option>
                      <option value="half_pay">Half Pay</option>
                      <option value="full_pay">Full Pay{lr.medical_certificate_url ? ' — Certificate Attached' : ''}</option>
                    </select>
                  </div>
                )}
                <button disabled={!!actionId} onClick={() => handleAction(lr.id, 'hr_approve')}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground font-medium hover:bg-brand-green-dark disabled:opacity-50 transition">
                  <CheckCircle2 className="h-4 w-4" />{actionId === lr.id ? 'Approving…' : 'Approve Leave & Plan'}
                </button>
                {showReject === lr.id ? (
                  <div className="flex items-center gap-1.5">
                    <input placeholder="Rejection reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs" />
                    <button disabled={!!actionId || !rejectReason} onClick={() => handleAction(lr.id, 'hr_reject', rejectReason)}
                      className="rounded-lg bg-destructive px-3 py-2 text-xs text-white font-medium hover:opacity-90 disabled:opacity-50">{actionId === lr.id ? 'Rejecting…' : 'Reject'}</button>
                  </div>
                ) : (
                  <button onClick={() => setShowReject(lr.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/50 px-4 py-2 text-sm text-destructive font-medium hover:bg-destructive/5 transition">
                    <XCircle className="h-4 w-4" />Reject
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AO Notes */}
        {lr.ao_notes && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">AO Notes</p>
            <p className="text-sm text-blue-800">{lr.ao_notes}</p>
          </div>
        )}

        {/* Plan summary stats */}
        {plan.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 text-center">
              <UserPlus className="h-4 w-4 text-blue-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-blue-700">{substituteCount}</p>
              <p className="text-[10px] text-blue-500 font-medium">Substitutes</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 text-center">
              <ArrowRightLeft className="h-4 w-4 text-amber-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-amber-700">{rescheduleCount}</p>
              <p className="text-[10px] text-amber-500 font-medium">Rescheduled</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/30 p-3 text-center">
              <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-red-600">{cancelCount}</p>
              <p className="text-[10px] text-red-400 font-medium">Cancelled</p>
            </div>
            {subjectChangeCount > 0 ? (
              <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-3 text-center">
                <BookOpen className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-purple-700">{subjectChangeCount}</p>
                <p className="text-[10px] text-purple-500 font-medium">Subject Changed</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-3 text-center">
                <CalendarClock className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-600">{lr.affected_sessions?.length || 0}</p>
                <p className="text-[10px] text-gray-400 font-medium">Total Sessions</p>
              </div>
            )}
          </div>
        )}

        {/* Detailed session-by-session plan */}
        {detailLoading ? <LoadingState /> : (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">AO Resolution Plan — Session Details</h3>

            {plan.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                No sessions affected — leave can be approved directly.
              </div>
            )}

            {plan.map((item, i) => {
              const sess = detailSessions.find(s => s.session_id === item.session_id);

              return (
                <div key={i} className={`rounded-xl border p-4 ${
                  item.action === 'substitute' ? 'border-blue-200 bg-blue-50/20' :
                  item.action === 'reschedule' ? 'border-amber-200 bg-amber-50/20' :
                  'border-red-200 bg-red-50/20'
                }`}>
                  {/* Session info */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-gray-900">{item.original_subject || sess?.subject || 'Session'}</span>
                        {sess?.grade && <Badge label={`Grade ${sess.grade}`} variant="info" />}
                        {sess?.batch_name && <Badge label={sess.batch_name} variant="secondary" />}
                        {sess?.board && <span className="text-[10px] text-gray-400 font-medium uppercase">{sess.board}</span>}
                      </div>
                      <p className="text-xs text-gray-500">
                        {sess ? (
                          <>
                            {new Date(sess.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                            {' at '}{sess.start_time?.substring(0, 5)}
                            {' · '}{sess.duration_minutes || 90}min
                            {sess.teacher_name && <span className="text-gray-400"> · Original: {sess.teacher_name}</span>}
                          </>
                        ) : (
                          <span className="text-gray-400">Session {item.session_id.slice(0, 12)}…</span>
                        )}
                      </p>
                    </div>
                    <Badge label={item.action === 'substitute' ? 'Substitute' : item.action === 'reschedule' ? 'Reschedule' : 'Cancel'}
                      variant={item.action === 'substitute' ? 'info' : item.action === 'cancel' ? 'danger' : 'warning'} />
                  </div>

                  {/* Action details */}
                  <div className="rounded-lg bg-white/60 border border-gray-100 p-3 space-y-2">
                    {item.action === 'substitute' && (
                      <>
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-xs font-semibold text-gray-700">Substitute Teacher:</span>
                          <span className="text-xs text-blue-700 font-medium">{item.substitute_name || item.substitute_email || '—'}</span>
                        </div>
                        {item.subject_override && (
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                            <span className="text-xs font-semibold text-gray-700">Subject Changed:</span>
                            <span className="text-xs text-gray-400 line-through">{item.original_subject || sess?.subject}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-purple-700 font-medium">{item.subject_override}</span>
                          </div>
                        )}
                        {!item.subject_override && (
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">Same subject: {item.original_subject || sess?.subject || '—'}</span>
                          </div>
                        )}
                      </>
                    )}

                    {item.action === 'reschedule' && (
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-gray-700">Rescheduled to:</span>
                        <span className="text-xs text-amber-700 font-medium">
                          {item.new_date ? new Date(item.new_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}
                          {item.new_time && ` at ${item.new_time.substring(0, 5)}`}
                        </span>
                      </div>
                    )}

                    {item.action === 'cancel' && (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs text-red-600">Session will be cancelled. Students and parents will be notified.</span>
                      </div>
                    )}

                    {item.notes && (
                      <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
                        <ClipboardList className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                        <span className="text-xs text-gray-500 italic">{item.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom action bar for pending_hr */}
        {isPendingHR && plan.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <p className="text-sm font-semibold text-primary">Ready to review?</p>
              <p className="text-xs text-brand-green-dark">
                {substituteCount > 0 && `${substituteCount} substitute${substituteCount > 1 ? 's' : ''}`}
                {rescheduleCount > 0 && `${substituteCount > 0 ? ', ' : ''}${rescheduleCount} reschedule${rescheduleCount > 1 ? 's' : ''}`}
                {cancelCount > 0 && `${(substituteCount + rescheduleCount) > 0 ? ', ' : ''}${cancelCount} cancellation${cancelCount > 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button disabled={!!actionId} onClick={() => handleAction(lr.id, 'hr_approve')}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground font-medium hover:bg-brand-green-dark disabled:opacity-50 transition">
                <CheckCircle2 className="h-4 w-4" />{actionId === lr.id ? 'Approving…' : 'Approve'}
              </button>
              <button onClick={() => setShowReject(lr.id)}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/50 px-4 py-2 text-sm text-destructive font-medium hover:bg-destructive/5 transition">
                <XCircle className="h-4 w-4" />Reject
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Teacher Leave Requests</h2>
          {pendingHRCount > 0 && <Badge label={`${pendingHRCount} pending`} variant="warning" />}
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect value={filter} onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pending_hr', label: 'Pending Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'rejected', label: 'Rejected' },
            ]} />
          <RefreshButton loading={loading} onClick={fetchLeave} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} message={filter === 'all' ? 'No leave requests' : `No ${filter} requests`} />
      ) : (
        <div className="space-y-3">
          {/* Selection toolbar */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <button disabled={deleting} onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition">
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            )}
          </div>

          {filtered.map(lr => {
            const sd = getStatusDisplay(lr.status);
            const isPendingHR = lr.status === 'pending_hr';
            const hasPlan = lr.resolution_plan?.length > 0;

            return (
              <div key={lr.id} className={`rounded-xl border p-4 ${
                isPendingHR ? 'border-blue-200 bg-blue-50/20' :
                selectedIds.has(lr.id) ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input type="checkbox" checked={selectedIds.has(lr.id)} onChange={() => toggleSelect(lr.id)}
                      className="mt-2.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <Avatar name={lr.teacher_name || lr.teacher_email} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold">{lr.teacher_name || lr.teacher_email}</span>
                        <Badge label={lr.leave_type} variant="secondary" />
                        <StatusBadge status={lr.status} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(lr.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(lr.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {lr.affected_sessions?.length > 0 && ` · ${lr.affected_sessions.length} sessions affected`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{lr.reason}</p>
                      {lr.medical_certificate_url && (
                        <a href={lr.medical_certificate_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-blue-600 hover:text-blue-800">
                          <FileText className="h-3 w-3" /> Certificate
                        </a>
                      )}
                      {lr.salary_adjustment && (
                        <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          lr.salary_adjustment === 'full_pay' ? 'bg-green-100 text-green-700' :
                          lr.salary_adjustment === 'half_pay' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {lr.salary_adjustment === 'full_pay' ? 'Full Pay' : lr.salary_adjustment === 'half_pay' ? 'Half Pay' : 'No Pay'}
                        </span>
                      )}
                      <p className={`text-[10px] mt-1 font-medium ${sd.color}`}>{sd.label}</p>
                      {lr.ao_notes && (
                        <p className="text-[10px] text-gray-500 mt-0.5">AO Notes: {lr.ao_notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[10px] text-gray-400">{new Date(lr.created_at).toLocaleDateString('en-IN')}</p>

                    {/* View full plan */}
                    {hasPlan && (
                      <button onClick={() => openDetail(lr.id)}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-brand-green-dark font-medium transition">
                        View Full Plan ({lr.resolution_plan.length})
                      </button>
                    )}

                    {/* Quick approve / reject for pending_hr */}
                    {isPendingHR && (
                      <div className="flex gap-1.5">
                        <button onClick={() => openDetail(lr.id)}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] text-primary-foreground font-medium hover:bg-brand-green-dark transition">
                          <CheckCircle2 className="h-3 w-3" />Review & Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── HR Credentials Tab ──────────────────────────────────────
// Owner-only: create / toggle / remove HR associate accounts.
// All HR accounts see identical dashboard & data.
// ─────────────────────────────────────────────────────────────
interface HRAccount {
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

function HRCredentialsTab({ currentUserEmail }: { currentUserEmail: string }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [accounts, setAccounts] = useState<HRAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/hr/users?role=hr&limit=200');
      const json = await res.json();
      if (json.success) setAccounts(json.data?.users ?? json.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/hr/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail, full_name: formName, portal_role: 'hr', password: formPassword }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error || 'Failed to create account'); return; }
      toast.success('HR account created');
      setFormName(''); setFormEmail(''); setFormPassword(''); setShowForm(false);
      fetchAccounts();
    } catch { toast.error('Network error'); } finally { setSaving(false); }
  };

  const handleToggle = async (acc: HRAccount) => {
    if (acc.email === currentUserEmail) return;
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(acc.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !acc.is_active }),
      });
      const json = await res.json();
      if (json.success) { toast.success(`${acc.full_name} ${acc.is_active ? 'deactivated' : 'activated'}`); fetchAccounts(); }
      else toast.error(json.error || 'Failed to update');
    } catch { toast.error('Network error'); }
  };

  const handleDelete = async (acc: HRAccount) => {
    if (acc.email === currentUserEmail) return;
    const ok = await confirm({
      title: 'Remove HR Account',
      message: `Remove HR account "${acc.full_name}" (${acc.email})? This cannot be undone.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(acc.email)}?permanent=true`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success(`${acc.email} removed`); fetchAccounts(); }
      else toast.error(json.error || 'Failed to delete');
    } catch { toast.error('Network error'); }
  };

  const copyPwd = () => {
    if (!formPassword) return;
    navigator.clipboard.writeText(formPassword);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader icon={UserPlus} title="HR Credentials" subtitle="Manage HR associate login accounts — all HR accounts see the same dashboard & data">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={showForm ? X : undefined} onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : '+ Add HR Account'}
          </Button>
        </div>
      </PageHeader>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            New HR account will have full HR-level access to the same dashboard and all data.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full Name">
              <Input value={formName} onChange={e => setFormName(e.target.value)} required placeholder="e.g. Priya Sharma" />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} required placeholder="e.g. hr2@stibe.in" />
            </FormField>
          </div>
          <FormField label="Password">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button type="button" onClick={copyPwd} disabled={!formPassword}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <ClipboardList className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Share this password securely with the new HR associate.</p>
          </FormField>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" icon={UserPlus} loading={saving}>Create HR Account</Button>
          </div>
        </form>
      )}

      {/* Accounts table */}
      {loading ? <LoadingState /> : (
        <TableWrapper footer={<span>{accounts.length} HR account{accounts.length !== 1 ? 's' : ''}</span>}>
          <THead>
            <TH>HR Associate</TH>
            <TH>Status</TH>
            <TH>Created</TH>
            <TH>Last Login</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {accounts.map(acc => {
              const isSelf = acc.email === currentUserEmail;
              return (
                <TRow key={acc.email}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={acc.full_name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {acc.full_name}
                          {isSelf && <span className="ml-2 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">You</span>}
                        </p>
                        <p className="text-xs text-gray-500">{acc.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ActiveIndicator active={acc.is_active} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(acc.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(acc.last_login_at)}</td>
                  <td className="px-4 py-3">
                    {!isSelf ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleToggle(acc)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${acc.is_active ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                          {acc.is_active ? <><EyeOff className="h-3.5 w-3.5" /> Deactivate</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Activate</>}
                        </button>
                        <button onClick={() => handleDelete(acc)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    ) : (
                      <p className="text-right text-xs text-gray-400 italic">Current session</p>
                    )}
                  </td>
                </TRow>
              );
            })}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No HR accounts found</td></tr>
            )}
          </tbody>
        </TableWrapper>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> All HR accounts have the <strong>hr</strong> role and access identical HR dashboard data. Adding a new account only creates login credentials.
        </p>
      </div>
    </div>
  );
}
