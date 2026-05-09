// ═══════════════════════════════════════════════════════════════
// Student Dashboard — Client Component
// Tabs: Overview · Batches · Sessions · Sessions · Attendance · Exams · Fees · Materials · Profile
// Theme: light / emerald primary — uses shared UI components
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, SearchInput, TabBar,
  StatCard, Card, Badge, StatusBadge,
  LoadingState, EmptyState, Alert, Avatar, money,
} from '@/components/dashboard/shared';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import { fmtSmartDateLocal, fmtTimeLocal, fmtDateLongIST, sessionToDate, fmtSessionTime24Local } from '@/lib/utils';
import StudentReportsTab from '@/components/dashboard/StudentReportsTab';
import BujiChatbot from '@/components/auth/BujiChatbot';
import { usePlatformName } from '@/components/providers/PlatformProvider';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, BookOpen, User, Radio, Calendar, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  GraduationCap, Phone, Timer, Users,
  CreditCard, AlertCircle, Info, BookMarked, School,
  FolderOpen, ExternalLink, TrendingUp, ArrowRight, BarChart2, Activity,
  Receipt, Trophy, FileText, DollarSign, CalendarDays, PlayCircle,
  ListChecks, Send, CalendarClock, ClipboardList, Ban, Loader2,
  Paperclip, Upload, Video, Layers, Download, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface Assignment {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  status: string;
  scheduled_start: string;
  started_at: string | null;
  duration_minutes: number;
  max_participants: number;
  teacher_email: string | null;
  teacher_name: string | null;
  payment_status: string;
  join_token: string | null;
}

interface StudentProfile {
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  date_of_birth: string | null;
  grade: string | null;
  section: string | null;
  board: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  admission_date: string | null;
  notes: string | null;
  address: string | null;
  category: string | null;
}

interface TeachingMaterial {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  material_type: string;
  created_at: string;
  updated_at: string | null;
  file_size: number | null;
  mime_type: string | null;
  batches: { batch_id: string; batch_name: string }[];
  batch_id?: string | null;
  batch_name?: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
  bujiEnabled?: boolean;
}

// ── Batch & Attendance Types ───────────────────────────────────

interface BatchTeacher {
  subject: string;
  is_primary: boolean;
  teacher_name: string;
  teacher_email: string;
  teacher_image?: string | null;
}

interface BatchDetail {
  id: string;
  name: string;
  type: string;
  grade: string | null;
  section: string | null;
  subjects: string[];
  status: string;
  max_students: number;
  notes: string | null;
  enrolled_at: string;
  coordinator: { name: string | null; email: string | null };
  ao_name: string | null;
  teachers: BatchTeacher[];
  stats: { total_sessions: number; completed_sessions: number; upcoming_sessions: number };
  attendance: { total: number; present: number; absent: number; late: number; rate: number };
}

interface AttendanceRecord {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  scheduled_start: string;
  duration_minutes: number;
  room_status: string;
  teacher_name: string | null;
  status: string | null;
  is_late: boolean | null;
  late_by_seconds: number | null;
  first_join_at: string | null;
  last_leave_at: string | null;
  time_in_class_seconds: number | null;
  join_count: number | null;
  engagement_score: number | null;
  mic_off_count: number;
  camera_off_count: number;
  leave_request_count: number;
  attention_avg: number | null;
}

interface SubjectAttendance {
  subject: string;
  total: number;
  present: number;
  absent: number;
  rate: number;
}

interface AttendanceSummaryData {
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  attendance_rate: number;
  avg_time_minutes: number;
  total_rejoins: number;
}

// ── Session Types ──────────────────────────────────────────────

interface SessionData {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string | null;
  teacher_name: string | null;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number | null;
  status: string;
  livekit_room_name: string | null;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  batch_name: string;
  batch_type: string;
  grade: string | null;
  section: string | null;
  attendance_status: string | null;
  is_late: boolean | null;
  first_join_at: string | null;
  last_leave_at: string | null;
  time_in_class_seconds: number | null;
  join_count: number | null;
  engagement_score: number | null;
  class_portion: string | null;
  class_remarks: string | null;
  recording_url: string | null;
  recording_status: string | null;
  prep_buffer_minutes: number | null;
  payment_status: string | null;
  payment_amount_paise: number | null;
  refund_request_id: string | null;
  refund_request_type: string | null;
  refund_request_status: string | null;
}

interface SessionTodayStats {
  total: number;
  live: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

interface VideoAccessRequest {
  id: string;
  room_id: string;
  status: 'pending' | 'approved' | 'rejected';
  recording_url: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ── Session Request / Availability Types ───────────────────────

interface SessionRequest {
  id: string;
  request_type: 'reschedule' | 'cancel';
  requester_email: string;
  batch_session_id: string;
  batch_id: string;
  reason: string;
  proposed_date: string | null;
  proposed_time: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  batch_name?: string;
  subject?: string;
  session_date?: string;
  requester_name?: string;
}

interface AvailabilitySlot {
  id: string;
  student_email: string;
  batch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  preference: 'available' | 'preferred' | 'unavailable';
  notes: string | null;
  is_active: boolean;
}

// ── Fee Types ──────────────────────────────────────────────────

interface FeesSummaryData {
  total_invoices: number;
  total_invoiced_paise: number;
  total_paid_paise: number;
  total_pending_paise: number;
  pending_count: number;
  paid_count: number;
  overdue_count: number;
  is_group_batch?: boolean;
  payment_plan?: string | null;
  next_invoice?: {
    id: string;
    invoice_number: string;
    description: string | null;
    billing_period: string | null;
    amount_paise: number;
    currency: string;
    due_date: string | null;
    scheduled_for: string | null;
    status: string;
    installment_number: number | null;
  } | null;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  description: string | null;
  billing_period: string | null;
  period_start: string | null;
  period_end: string | null;
  amount_paise: number;
  currency: string | null;
  status: string;
  due_date: string | null;
  scheduled_for: string | null;
  installment_number: number | null;
  paid_at: string | null;
  created_at: string;
  pay_token?: string;
}

interface ReceiptData {
  id: string;
  receipt_number: string;
  invoice_id: string;
  amount_paise: number;
  currency: string | null;
  payment_method: string | null;
  paid_at: string;
  created_at: string;
  invoice_description: string | null;
  billing_period: string | null;
}

// ── Exam Types ─────────────────────────────────────────────────

interface ExamData {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  scheduled_at: string | null;
  ends_at: string | null;
  attempt_status: string | null;
  attempt_score: number | null;
  attempt_percentage: number | null;
  attempt_grade: string | null;
}

// ── Homework Types ─────────────────────────────────────────────

interface HomeworkQuestion {
  id: string;
  homework_id: string;
  question_number: number;
  question_text: string;
}

interface HomeworkAssignment {
  id: string;
  room_id: string | null;
  batch_id: string;
  batch_name: string | null;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  assigned_by_name: string;
  status: string;
  created_at: string;
  questions: HomeworkQuestion[];
  attachment_urls: string[];
  attachment_names: string[];
}

interface HomeworkSubmission {
  id: string;
  homework_id: string;
  student_email: string;
  submission_text: string | null;
  file_urls: string[];
  file_names: string[];
  completion_status: string;
  delay_days: number;
  submitted_at: string;
  grade: string | null;
  teacher_comment: string | null;
  graded_at: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-600', A: 'text-green-600',
  'B+': 'text-blue-600', B: 'text-blue-600',
  'C+': 'text-yellow-600', C: 'text-yellow-600',
  D: 'text-orange-600', F: 'text-red-600',
};

const HW_STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
  partial: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' },
  not_started: { bg: 'bg-red-100', text: 'text-red-700', label: 'Not Started' },
};

// ── Helpers ────────────────────────────────────────────────────

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function effectiveStatus(a: Assignment): string {
  return a.status;
}

/** Compute effective status for batch_sessions — server status is authoritative for live/ended */
function effectiveSessionStatus(s: SessionData): string {
  // DB status is authoritative — never downgrade 'live' to 'ended' client-side
  // (sessions run overtime and only end when teacher manually ends them)
  if (s.status === 'live') return 'live';
  if (s.status === 'ended') return 'ended';
  if (s.status === 'cancelled') return 'cancelled';

  // For scheduled sessions that never went live, if the scheduled end time has passed, mark as cancelled
  if (s.status === 'scheduled') {
    const startMs = sessionToDate(s.scheduled_date, s.start_time).getTime();
    const endMs = startMs + s.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'cancelled';
    return 'scheduled';
  }

  return s.status;
}

// ── Payment Badge ──────────────────────────────────────────────

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'info'; label: string }> = {
    paid:    { variant: 'success', label: 'Paid' },
    exempt:  { variant: 'info',    label: 'Free' },
    pending: { variant: 'warning', label: 'Pending' },
  };
  const s = map[status] ?? { variant: 'default' as const, label: status };
  return <Badge label={s.label} variant={s.variant} icon={CreditCard} />;
}

// ── Countdown ──────────────────────────────────────────────────

function Countdown({ scheduledStart, durationMinutes }: { scheduledStart: string; durationMinutes: number }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const startMs = new Date(scheduledStart).getTime();
      const endMs = startMs + durationMinutes * 60_000;
      if (now < startMs) {
        const diff = startMs - now;
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`Starts in ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`);
      } else if (now < endMs) {
        const diff = endMs - now;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`${m}m ${s}s remaining`);
      } else {
        const diff = now - endMs;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`Overtime +${m}m ${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [scheduledStart, durationMinutes]);
  return <>{label}</>;
}

// ── Chart Colors ───────────────────────────────────────────────

const CHART_COLORS = {
  emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b', purple: '#8b5cf6',
  teal: '#14b8a6', rose: '#f43f5e', red: '#ef4444',
};

// ── Overview Tab ───────────────────────────────────────────────

function OverviewTab({
  userName, batches, attendanceSummary, attendanceBySubject, sessions, exams, feesSummary, router, pendingHomework, sessionTodayStats, creditsData,
}: {
  userName: string;
  batches: BatchDetail[];
  attendanceSummary: AttendanceSummaryData | null;
  attendanceBySubject: SubjectAttendance[];
  sessions: SessionData[];
  exams: ExamData[];
  feesSummary: FeesSummaryData | null;
  router: ReturnType<typeof useRouter>;
  pendingHomework: HomeworkAssignment[];
  sessionTodayStats: SessionTodayStats | null;
  creditsData: {
    credits: Array<{ id: string; subject: string; batch_type: string; total_sessions: number; used_sessions: number; remaining: number }>;
    total_remaining: number;
    total_allotted: number;
    warning: boolean;
    exhausted: boolean;
  } | null;
}) {
  // IST-aware today detection
  const todayISO = (() => {
    const d = new Date();
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  })();

  // Session-based derived state
  const liveSessions = sessions.filter(s => effectiveSessionStatus(s) === 'live');
  const scheduledSessions = sessions.filter(s => effectiveSessionStatus(s) === 'scheduled');
  const todaySessions = sessions.filter(s => s.scheduled_date.slice(0, 10) === todayISO && effectiveSessionStatus(s) !== 'cancelled');
  const nextSession = [...scheduledSessions]
    .sort((a, b) => (a.scheduled_date + a.start_time).localeCompare(b.scheduled_date + b.start_time))[0];
  const completedBatches = batches.filter(b => b.status === 'completed' || b.status === 'ended').length;
  const totalSessionsAll = batches.reduce((sum, b) => sum + b.stats.total_sessions, 0);
  const completedSessionsAll = batches.reduce((sum, b) => sum + b.stats.completed_sessions, 0);
  const upcomingSessionsAll = batches.reduce((sum, b) => sum + b.stats.upcoming_sessions, 0);

  // Classroom access blocked when overdue invoice (group batch) OR credits exhausted (per-class)
  const joinBlocked =
    (feesSummary?.is_group_batch && (feesSummary?.overdue_count ?? 0) > 0) ||
    (!feesSummary?.is_group_batch && !!creditsData?.exhausted);

  // Exam derived
  const gradedExams = exams.filter(e => e.attempt_status === 'graded');
  const pendingExams = exams.filter(e => !e.attempt_status || e.attempt_status === 'in_progress');
  const avgScore = (() => {
    const graded = exams.filter(e => e.attempt_percentage != null);
    if (graded.length === 0) return null;
    return Math.round(graded.reduce((s, e) => s + Number(e.attempt_percentage ?? 0), 0) / graded.length);
  })();

  // ── Chart Data ──────────────────────────────────────────────

  // Weekly sessions: group by day of week (Mon-Sun)
  const weeklySessionData = (() => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const data = dayNames.map((day, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dateStr = dayDate.toISOString().slice(0, 10);
      const daySessions = sessions.filter(s => s.scheduled_date.slice(0, 10) === dateStr);
      return {
        day,
        Completed: daySessions.filter(s => effectiveSessionStatus(s) === 'ended').length,
        Upcoming: daySessions.filter(s => ['scheduled', 'live'].includes(effectiveSessionStatus(s))).length,
      };
    });
    return data;
  })();

  // Subject attendance bar data
  const subjectAttendanceData = attendanceBySubject
    .filter(s => s.total > 0)
    .slice(0, 6)
    .map(s => ({
      subject: s.subject.length > 8 ? s.subject.slice(0, 7) + '…' : s.subject,
      Present: s.present,
      Absent: s.absent,
      rate: s.rate,
    }));

  // Fees pie data
  const feesPieData = (() => {
    if (!feesSummary) return [];
    const data: { name: string; value: number; fill: string }[] = [];
    if (feesSummary.total_paid_paise > 0) data.push({ name: 'Paid', value: feesSummary.total_paid_paise, fill: CHART_COLORS.emerald });
    if (feesSummary.total_pending_paise > 0) data.push({ name: 'Pending', value: feesSummary.total_pending_paise - (feesSummary.overdue_count > 0 ? 0 : 0), fill: CHART_COLORS.amber });
    if (feesSummary.overdue_count > 0) {
      // Approximate overdue as a portion — use pending as overdue if all pending are overdue
      const overdueVal = Math.round(feesSummary.total_pending_paise * (feesSummary.overdue_count / Math.max(feesSummary.pending_count, 1)));
      if (overdueVal > 0) {
        // Adjust pending to exclude overdue
        const pendingOnly = feesSummary.total_pending_paise - overdueVal;
        data.length = 0;
        if (feesSummary.total_paid_paise > 0) data.push({ name: 'Paid', value: feesSummary.total_paid_paise, fill: CHART_COLORS.emerald });
        if (pendingOnly > 0) data.push({ name: 'Pending', value: pendingOnly, fill: CHART_COLORS.amber });
        data.push({ name: 'Overdue', value: overdueVal, fill: CHART_COLORS.red });
      }
    }
    return data;
  })();

  return (
    <div className="flex flex-col gap-3 sm:gap-4 min-h-0">
      {/* ═══ Row 1: Key Metrics (6 compact colored-icon cards) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 shrink-0">
        {[
          { label: 'Today', value: `${sessionTodayStats?.total ?? todaySessions.length} session${(sessionTodayStats?.total ?? todaySessions.length) !== 1 ? 's' : ''}`, sub: liveSessions.length > 0 ? `${liveSessions.length} live` : `${sessionTodayStats?.upcoming ?? scheduledSessions.filter(s => s.scheduled_date.slice(0,10) === todayISO).length} upcoming`, color: 'bg-blue-500', icon: CalendarDays },
          { label: 'Attendance', value: attendanceSummary ? `${attendanceSummary.attendance_rate}%` : '—', sub: attendanceSummary ? `${attendanceSummary.present}/${attendanceSummary.total_sessions} present` : 'No data', color: attendanceSummary && attendanceSummary.attendance_rate >= 75 ? 'bg-emerald-500' : attendanceSummary && attendanceSummary.attendance_rate >= 50 ? 'bg-amber-500' : 'bg-rose-500', icon: TrendingUp },
          { label: 'Avg Score', value: avgScore !== null ? `${avgScore}%` : '—', sub: gradedExams.length > 0 ? `${gradedExams.length} exam${gradedExams.length !== 1 ? 's' : ''}` : 'No exams', color: avgScore !== null && avgScore >= 75 ? 'bg-emerald-500' : avgScore !== null && avgScore >= 50 ? 'bg-amber-500' : 'bg-purple-500', icon: Trophy },
          { label: 'Fees', value: feesSummary ? money(feesSummary.total_pending_paise) : '—', sub: feesSummary ? `${money(feesSummary.total_paid_paise)} paid` : 'No data', color: feesSummary && feesSummary.total_pending_paise > 0 ? 'bg-amber-500' : 'bg-emerald-500', icon: CreditCard },
          (() => {
            const isGroup = feesSummary?.is_group_batch;
            const ni = feesSummary?.next_invoice;
            if (isGroup) {
              // Group batch: show next invoice or enrollment status
              if (ni && ni.status === 'overdue') {
                const installLabel = ni.installment_number ? `Q${ni.installment_number} overdue` : 'Overdue';
                return { label: 'Invoice', value: money(ni.amount_paise), sub: installLabel, color: 'bg-red-500', icon: Receipt };
              }
              if (ni && ni.status === 'pending') {
                const dueDate = ni.due_date ? new Date(ni.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Due soon';
                const installLabel = ni.installment_number ? `Q${ni.installment_number} · due ${dueDate}` : `Due ${dueDate}`;
                return { label: 'Invoice', value: money(ni.amount_paise), sub: installLabel, color: 'bg-amber-500', icon: Receipt };
              }
              if (ni && ni.status === 'scheduled') {
                const schedDate = (ni.scheduled_for || ni.due_date);
                const dateLabel = schedDate ? new Date(schedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Upcoming';
                const installLabel = ni.installment_number ? `Q${ni.installment_number} on ${dateLabel}` : `Next: ${dateLabel}`;
                return { label: 'Next Invoice', value: money(ni.amount_paise), sub: installLabel, color: 'bg-indigo-500', icon: Receipt };
              }
              // Fully paid / no upcoming
              return { label: 'Enrollment', value: 'Paid Up', sub: feesSummary?.payment_plan === 'quarterly' ? 'SPO plan · all paid' : 'One-time paid', color: 'bg-emerald-500', icon: Receipt };
            }
            // Per-class batch: show credits
            return { label: 'Credits', value: creditsData ? `${creditsData.total_remaining}` : '—', sub: creditsData ? `of ${creditsData.total_allotted} sessions` : 'No credits', color: creditsData?.exhausted ? 'bg-red-500' : creditsData?.warning ? 'bg-amber-500' : 'bg-indigo-500', icon: Layers };
          })(),
          { label: 'Classes', value: totalSessionsAll > 0 ? `${completedSessionsAll}/${totalSessionsAll}` : String(batches.length), sub: totalSessionsAll > 0 ? `${upcomingSessionsAll} upcoming` : `${completedBatches} completed`, color: 'bg-teal-500', icon: BookOpen },
        ].map(m => (
          <div key={m.label} className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 flex items-center gap-3">
            <div className={`${m.color} rounded-lg p-2 shrink-0`}>
              <m.icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">{m.label}</p>
              <p className="text-base font-bold text-gray-900 truncate">{m.value}</p>
              <p className="text-[10px] text-gray-400 truncate">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Row 2: Alerts (conditional, compact) ═══ */}
      {liveSessions.length > 0 && (
        <div className="rounded-xl border border-green-300 bg-green-50/60 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
          <Radio className="h-5 w-5 text-green-600 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-green-800">
              {liveSessions.length} Live Now
            </span>
            <span className="text-xs text-green-600 ml-2 hidden sm:inline">
              {liveSessions.map(s => `${s.subject} — ${s.batch_name}`).join(', ')}
            </span>
          </div>
          {joinBlocked ? (
            <button
              onClick={() => { window.location.hash = 'fees'; }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shrink-0 flex items-center gap-1"
            >
              <AlertCircle className="h-3 w-3" /> Pay to Join
            </button>
          ) : (
            <a
              href={`/join/${liveSessions[0].session_id}`}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 shrink-0"
            >
              Join
            </a>
          )}
        </div>
      )}

      {feesSummary && feesSummary.overdue_count > 0 && feesSummary.total_pending_paise > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 flex items-start gap-3 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 ring-1 ring-red-200">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              {feesSummary.overdue_count} Overdue Invoice{feesSummary.overdue_count > 1 ? 's' : ''} — Immediate Action Required
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {money(feesSummary.total_pending_paise)} pending · {liveSessions.length > 0 ? 'Live class access is blocked until dues are cleared' : 'Late fees may apply'}
            </p>
          </div>
          <button onClick={() => { window.location.hash = 'fees'; }} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm">
            Pay Now
          </button>
        </div>
      )}

      {feesSummary && feesSummary.overdue_count === 0 && feesSummary.pending_count > 0 && feesSummary.total_pending_paise > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3 flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <CreditCard className="h-4.5 w-4.5 text-amber-700" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {feesSummary.pending_count} Invoice{feesSummary.pending_count > 1 ? 's' : ''} Pending — {money(feesSummary.total_pending_paise)}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Pay before due date to avoid overdue status</p>
          </div>
          <button onClick={() => { window.location.hash = 'fees'; }} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition">
            View
          </button>
        </div>
      )}

      {/* Group batch: upcoming scheduled invoice reminder — only within 7 days */}
      {feesSummary?.is_group_batch && feesSummary.next_invoice?.status === 'scheduled' && (() => {
        const schedDate = new Date(feesSummary.next_invoice!.scheduled_for ?? feesSummary.next_invoice!.due_date ?? '');
        const daysUntil = (schedDate.getTime() - Date.now()) / 86400000;
        return daysUntil <= 7 && daysUntil >= 0;
      })() && (
        <div className="rounded-xl border border-indigo-300 bg-indigo-50/80 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
          <Receipt className="h-5 w-5 text-indigo-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-indigo-800">
              {feesSummary.next_invoice.installment_number ? `Q${feesSummary.next_invoice.installment_number} ` : ''}Invoice Upcoming — {money(feesSummary.next_invoice.amount_paise)}
            </span>
            <span className="text-xs text-indigo-600 ml-2 hidden sm:inline">
              Due {feesSummary.next_invoice.scheduled_for
                ? new Date(feesSummary.next_invoice.scheduled_for).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : feesSummary.next_invoice.due_date
                  ? new Date(feesSummary.next_invoice.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'soon'}
            </span>
          </div>
          <button onClick={() => { window.location.hash = 'fees'; }} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shrink-0">View</button>
        </div>
      )}

      {/* Group batch: pending invoice reminder */}
      {feesSummary?.is_group_batch && feesSummary.next_invoice?.status === 'pending' && (
        <div className="rounded-xl border border-amber-400 bg-amber-50/80 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
          <Receipt className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-amber-800">
              {feesSummary.next_invoice.installment_number ? `Q${feesSummary.next_invoice.installment_number} ` : ''}Invoice Due — {money(feesSummary.next_invoice.amount_paise)}
            </span>
            <span className="text-xs text-amber-600 ml-2 hidden sm:inline">
              {feesSummary.next_invoice.due_date
                ? `Due ${new Date(feesSummary.next_invoice.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Payment pending'}
            </span>
          </div>
          <button onClick={() => { window.location.hash = 'fees'; }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shrink-0">Pay Now</button>
        </div>
      )}

      {/* Per-class batch: credits exhausted */}
      {!feesSummary?.is_group_batch && creditsData?.exhausted && (
        <div className="rounded-xl border border-red-400 bg-red-50/80 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
          <Ban className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-red-800">Session credits exhausted</span>
            <span className="text-xs text-red-600 ml-2 hidden sm:inline">
              All {creditsData.total_allotted} prepaid sessions used — class access blocked until renewed
            </span>
          </div>
          <button onClick={() => { window.location.hash = 'fees'; }} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shrink-0">
            Renew Now
          </button>
        </div>
      )}

      {/* Per-class batch: low credits */}
      {!feesSummary?.is_group_batch && creditsData?.warning && !creditsData?.exhausted && (
        <div className="rounded-xl border border-amber-400 bg-amber-50/80 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-amber-800">Low session credits — {creditsData.total_remaining} remaining</span>
            <span className="text-xs text-amber-600 ml-2 hidden sm:inline">
              of {creditsData.total_allotted} total • renew soon to avoid class disruption
            </span>
          </div>
          <button onClick={() => { window.location.hash = 'fees'; }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shrink-0">
            Renew
          </button>
        </div>
      )}

      {pendingHomework.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/60 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
          <ListChecks className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-amber-800">{pendingHomework.length} Homework Pending</span>
            <span className="text-xs text-amber-600 ml-2 hidden sm:inline truncate">{pendingHomework.map(hw => hw.title).join(', ')}</span>
          </div>
          <button onClick={() => { window.location.hash = 'homework'; }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shrink-0">View</button>
        </div>
      )}

      {/* ═══ Row 3: Next Session Bar ═══ */}
      {nextSession && (() => {
        const nsStart = sessionToDate(nextSession.scheduled_date, nextSession.start_time);
        const nsLobbyOpen = Date.now() >= nsStart.getTime() - 15 * 60 * 1000;
        return (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-1 min-w-0">
              <Calendar className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-sm font-semibold text-gray-900 truncate">{nextSession.subject} — {nextSession.batch_name}</span>
                <span className="text-xs text-gray-500 truncate">
                  {fmtSmartDateLocal(`${nextSession.scheduled_date}T${nextSession.start_time}+05:30`)}
                  {nextSession.teacher_name && ` · ${nextSession.teacher_name}`}
                </span>
                <div className="rounded-md bg-teal-100 border border-teal-200 px-2 py-0.5 text-xs font-mono font-bold text-teal-700 w-fit">
                  <Countdown scheduledStart={`${nextSession.scheduled_date}T${nextSession.start_time}+05:30`} durationMinutes={nextSession.duration_minutes} />
                </div>
              </div>
            </div>
            {nsLobbyOpen && (
              joinBlocked ? (
                <button
                  onClick={() => { window.location.hash = 'fees'; }}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shrink-0"
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Pay First
                </button>
              ) : (
                <a
                  href={`/join/${nextSession.session_id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shrink-0"
                >
                  <Timer className="h-3.5 w-3.5" /> Enter Lobby
                </a>
              )
            )}
          </div>
        );
      })()}

      {/* ═══ Row 4: Today's Sessions (compact pills like teacher) ═══ */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-3 sm:px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-700">Today&apos;s Schedule</h3>
          <div className="flex items-center gap-3">
            {pendingExams.length > 0 && (
              <button onClick={() => router.push('/student/exams')} className="text-[10px] text-amber-600 font-medium hover:underline">
                {pendingExams.length} exam{pendingExams.length !== 1 ? 's' : ''} pending
              </button>
            )}
            <button onClick={() => { window.location.hash = 'batches'; }} className="text-[10px] text-emerald-600 hover:underline">All sessions</button>
          </div>
        </div>
        {todaySessions.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">No sessions today</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...todaySessions]
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((s) => {
                const es = effectiveSessionStatus(s);
                const sStart = sessionToDate(s.scheduled_date, s.start_time);
                const lobbyOpen = Date.now() >= sStart.getTime() - 15 * 60 * 1000;
                return (
                  <div key={s.session_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                    <span className="font-bold text-gray-800">{fmtSessionTime24Local(s.scheduled_date, s.start_time)}</span>
                    <span className="text-gray-500 truncate max-w-[120px]">{s.subject}</span>
                    {s.teacher_name && <span className="text-gray-400 hidden sm:inline">· {s.teacher_name}</span>}
                    {es === 'live' && <Radio className="h-3 w-3 text-red-500 animate-pulse" />}
                    {es === 'ended' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    {es === 'live' && (
                      joinBlocked ? (
                        <button onClick={() => { window.location.hash = 'fees'; }} className="flex items-center gap-0.5 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-700">
                          <AlertCircle className="h-2.5 w-2.5" /> Pay
                        </button>
                      ) : (
                        <a href={`/join/${s.session_id}`} className="rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-green-700">
                          Join
                        </a>
                      )
                    )}
                    {es === 'scheduled' && lobbyOpen && (
                      joinBlocked ? (
                        <button onClick={() => { window.location.hash = 'fees'; }} className="flex items-center gap-0.5 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-700">
                          <AlertCircle className="h-2.5 w-2.5" /> Pay
                        </button>
                      ) : (
                        <a href={`/join/${s.session_id}`} className="flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-teal-700 shrink-0">
                          <Timer className="h-2.5 w-2.5" /> Enter Lobby
                        </a>
                      )
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ═══ Row 5: Charts (Weekly Sessions · Subject Attendance · Fees) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
        {/* Weekly Sessions AreaChart (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 flex flex-col" style={{ minHeight: 220 }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h3 className="text-xs font-semibold text-gray-700">Weekly Sessions</h3>
              <p className="text-[10px] text-gray-400">This week by day</p>
            </div>
            <button onClick={() => { window.location.hash = 'batches'; }} className="text-[10px] text-emerald-600 hover:underline">View all →</button>
          </div>
          <div className="flex-1 min-h-0">
            {weeklySessionData.some(d => d.Completed + d.Upcoming > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklySessionData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradStudComp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradStudUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="Completed" stroke={CHART_COLORS.emerald} strokeWidth={2.5} fill="url(#gradStudComp)" dot={{ r: 3, fill: CHART_COLORS.emerald }} />
                  <Area type="monotone" dataKey="Upcoming" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#gradStudUp)" strokeDasharray="4 2" dot={{ r: 3, fill: CHART_COLORS.blue }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No sessions this week</div>
            )}
          </div>
        </div>

        {/* Subject Attendance BarChart (4 cols) */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 flex flex-col" style={{ minHeight: 220 }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h3 className="text-xs font-semibold text-gray-700">Subject Attendance</h3>
              <p className="text-[10px] text-gray-400">Present vs Absent by subject</p>
            </div>
            <button onClick={() => { window.location.hash = 'attendance'; }} className="text-[10px] text-emerald-600 hover:underline">Details →</button>
          </div>
          <div className="flex-1 min-h-0">
            {subjectAttendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAttendanceData} barSize={18} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="Present" stackId="a" fill={CHART_COLORS.emerald} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Absent" stackId="a" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No attendance data</div>
            )}
          </div>
        </div>

        {/* Fees PieChart donut (3 cols) */}
        <div className="lg:col-span-3 rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 flex flex-col" style={{ minHeight: 220 }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h3 className="text-xs font-semibold text-gray-700">Fee Status</h3>
              <p className="text-[10px] text-gray-400">Payment breakdown</p>
            </div>
            <button onClick={() => { window.location.hash = 'fees'; }} className="text-[10px] text-emerald-600 hover:underline">Details →</button>
          </div>
          {feesPieData.length > 0 ? (
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full" style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={feesPieData} cx="50%" cy="50%" innerRadius={36} outerRadius={52}
                      dataKey="value" paddingAngle={2} stroke="none">
                      {feesPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((v: number) => [money(v), '']) as any}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-1 mt-1">
                {feesPieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.fill }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800 tabular-nums">{money(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">No fee data</div>
          )}
        </div>
      </div>

      {/* ═══ Row 6: Two-column — Upcoming Sessions + Recent Results ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 shrink-0">
        {/* Upcoming Sessions */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700">Upcoming Sessions</h3>
            <button onClick={() => { window.location.hash = 'batches'; }} className="text-[10px] text-emerald-600 hover:underline">View all</button>
          </div>
          {(() => {
            const upcoming = sessions
              .filter(s => effectiveSessionStatus(s) === 'scheduled')
              .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.start_time.localeCompare(b.start_time))
              .slice(0, 4);
            if (upcoming.length === 0) return <p className="text-xs text-gray-400 py-1">No upcoming sessions</p>;
            return (
              <div className="space-y-1.5">
                {upcoming.map(s => {
                  const sStart = sessionToDate(s.scheduled_date, s.start_time);
                  const lobbyIsOpen = Date.now() >= sStart.getTime() - 15 * 60 * 1000;
                  return (
                    <div key={s.session_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                      <span className="font-mono font-semibold text-gray-500 w-16 shrink-0">{s.scheduled_date.slice(5)} {fmtSessionTime24Local(s.scheduled_date, s.start_time)}</span>
                      <span className="text-gray-800 font-medium truncate flex-1">{s.subject}</span>
                      {lobbyIsOpen ? (
                        <a href={`/join/${s.session_id}`} className="flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-teal-700 shrink-0">
                          <Timer className="h-2.5 w-2.5" /> Enter Lobby
                        </a>
                      ) : (
                        <span className="text-gray-400">{fmtDuration(s.duration_minutes)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Recent Results */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700">Recent Results</h3>
            <button onClick={() => { window.location.hash = 'exams'; }} className="text-[10px] text-emerald-600 hover:underline">All exams</button>
          </div>
          {gradedExams.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No exam results yet</p>
          ) : (
            <div className="space-y-1.5">
              {gradedExams.slice(0, 4).map(e => {
                const passed = Number(e.attempt_percentage) >= (e.passing_marks / e.total_marks * 100);
                return (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${passed ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    <span className="text-gray-800 font-medium truncate flex-1">{e.title}</span>
                    <span className="text-gray-500">{e.attempt_score}/{e.total_marks}</span>
                    <span className={`font-bold ${GRADE_COLORS[e.attempt_grade ?? ''] ?? 'text-gray-400'}`}>{e.attempt_grade}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── My Sessions Tab ─────────────────────────────────────────────

type FilterKey = 'all' | 'live' | 'scheduled' | 'ended' | 'cancelled';

function MyClassesTab({ assignments }: { assignments: Assignment[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const q = search.toLowerCase();
  const filtered = assignments.filter((a) => {
    const es = effectiveStatus(a);
    const matchSearch =
      !q || a.room_name.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || es === filter;
    return matchSearch && matchFilter;
  });

  const counts: Record<FilterKey, number> = {
    all: assignments.length,
    live: assignments.filter((a) => effectiveStatus(a) === 'live').length,
    scheduled: assignments.filter((a) => effectiveStatus(a) === 'scheduled').length,
    ended: assignments.filter((a) => effectiveStatus(a) === 'ended').length,
    cancelled: assignments.filter((a) => effectiveStatus(a) === 'cancelled').length,
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search sessions…" className="sm:w-64" />
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 sm:py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                filter === f ? 'bg-white/20' : 'bg-white'
              }`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Class list */}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message={search ? 'No sessions match your search' : 'No sessions in this category'} />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const es = effectiveStatus(a);
            const isExpanded = expandedId === a.room_id;
            return (
              <Card
                key={a.room_id}
                className={`overflow-hidden transition-colors ${isExpanded ? 'ring-1 ring-emerald-300' : ''}`}
              >
                {/* Clickable row */}
                <button
                  className="flex w-full items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : a.room_id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    es === 'live' ? 'bg-green-100' :
                    es === 'scheduled' ? 'bg-teal-50' :
                    es === 'cancelled' ? 'bg-red-50' : 'bg-gray-100'
                  }`}>
                    {es === 'live'      && <Radio        className="h-5 w-5 text-green-600" />}
                    {es === 'ended'     && <CheckCircle2 className="h-5 w-5 text-gray-400" />}
                    {es === 'cancelled' && <XCircle      className="h-5 w-5 text-red-500" />}
                    {es === 'scheduled' && <Calendar     className="h-5 w-5 text-teal-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">{a.room_name}</p>
                      <span className="sm:hidden shrink-0"><StatusBadge status={es} /></span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-500">
                      <span>{a.subject} · {a.grade}{a.section ? ` · ${a.section}` : ''}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtSmartDateLocal(a.scheduled_start)}
                      </span>
                      <span className="sm:hidden">{fmtDuration(a.duration_minutes)}</span>
                      {a.teacher_name && (
                        <span className="hidden sm:flex items-center gap-1">
                          <Users className="h-3 w-3" /> {a.teacher_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="hidden text-right sm:block">
                      <StatusBadge status={es} />
                      <p className="mt-1 text-xs text-gray-400">{fmtDuration(a.duration_minutes)}</p>
                    </div>
                    {es === 'live' && (
                      <a
                        href={`/join/${a.room_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Join
                      </a>
                    )}
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                    <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-2.5 text-sm sm:grid-cols-4 sm:gap-3">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Date & Time</p>
                        <p className="text-gray-800">{fmtSmartDateLocal(a.scheduled_start)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Duration</p>
                        <p className="text-gray-800">{fmtDuration(a.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Teacher</p>
                        <p className="text-gray-800">{a.teacher_name ?? 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Payment</p>
                        <PaymentBadge status={a.payment_status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-2.5 text-sm">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Status</p>
                        <StatusBadge status={es} />
                      </div>
                    </div>

                    {es === 'scheduled' && (
                      <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                        <Timer className="h-4 w-4 shrink-0" />
                        <span className="font-mono font-bold">
                          <Countdown scheduledStart={a.scheduled_start} durationMinutes={a.duration_minutes} />
                        </span>
                      </div>
                    )}

                    {a.payment_status === 'pending' && es === 'scheduled' && (
                      <Alert
                        variant="warning"
                        message="Payment pending — contact your coordinator to complete payment."
                      />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Homework Tab ───────────────────────────────────────────────

function HomeworkTab({
  assignments, submissions, loading, onRefresh, userEmail,
}: {
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  loading: boolean;
  onRefresh: () => void;
  userEmail: string;
}) {
  const [submitTarget, setSubmitTarget] = useState<string | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitStatus, setSubmitStatus] = useState<string>('completed');
  const [uploadedFiles, setUploadedFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      const res = await fetch('/api/v1/homework/upload', { method: 'POST', credentials: 'include', body: formData });
      const json = await res.json();
      if (json.success) setUploadedFiles(prev => [...prev, ...json.data]);
      else alert(json.error || 'Upload failed');
    } catch { alert('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSubmit = async (homeworkId: string) => {
    if (submitting) return;
    if (!submitText.trim() && uploadedFiles.length === 0 && submitStatus !== 'not_started') {
      alert('Please add text or upload files'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/student/homework', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          homework_id: homeworkId, submission_text: submitText || undefined,
          file_urls: uploadedFiles.map(f => f.url), file_names: uploadedFiles.map(f => f.name),
          completion_status: submitStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitText(''); setSubmitTarget(null); setUploadedFiles([]); setSubmitStatus('completed');
        onRefresh();
      } else { alert(data.error || 'Submission failed'); }
    } catch { alert('Network error'); }
    finally { setSubmitting(false); }
  };

  const getSubmission = (hwId: string) => submissions.find(s => s.homework_id === hwId);

  if (loading && assignments.length === 0) return <LoadingState />;

  const active = assignments.filter(hw => hw.status === 'active');
  const closed = assignments.filter(hw => hw.status !== 'active');

  return (
    <div className="space-y-4 sm:space-y-6">
      {assignments.length === 0 ? (
        <EmptyState icon={ListChecks} message="No homework assigned yet." />
      ) : (
        <div className="space-y-3">
          {active.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600">Active ({active.length})</h3>
              {active.map(hw => {
                const sub = getSubmission(hw.id);
                // Compare in IST: due_date means end of that day in IST
                const isDue = hw.due_date && new Date(hw.due_date + 'T23:59:59+05:30') < new Date();
                return (
                  <Card key={hw.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{hw.title}</p>
                        {hw.description && <p className="text-xs text-gray-600 mt-1 line-clamp-3">{hw.description}</p>}
                      </div>
                      {sub ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${HW_STATUS_STYLE[sub.completion_status]?.bg || 'bg-gray-100'} ${HW_STATUS_STYLE[sub.completion_status]?.text || 'text-gray-600'}`}>
                          <CheckCircle2 className="h-3 w-3" /> {HW_STATUS_STYLE[sub.completion_status]?.label || 'Submitted'}
                        </span>
                      ) : isDue ? (
                        <Badge label="Overdue" variant="danger" icon={AlertCircle} />
                      ) : (
                        <Badge label="Pending" variant="warning" icon={Clock} />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> {hw.subject}</span>
                      {hw.batch_name && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {hw.batch_name}</span>}
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {hw.assigned_by_name}</span>
                      {hw.due_date && (
                        <span className={`inline-flex items-center gap-1 ${isDue ? 'text-red-500 font-medium' : ''}`}>
                          <CalendarClock className="h-3 w-3" /> Due: {new Date(hw.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{hw.due_time ? ` ${hw.due_time}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Attachments from teacher */}
                    {hw.attachment_urls?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {hw.attachment_names.map((name, i) => (
                          <a key={i} href={hw.attachment_urls[i]} target="_blank" rel="noreferrer" download
                            className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition">
                            <Download className="h-3 w-3" /> {name}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Questions */}
                    {hw.questions?.length > 0 && (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-gray-700">Questions:</p>
                        {hw.questions.map(q => (
                          <div key={q.id} className="flex gap-2 text-xs">
                            <span className="text-emerald-600 font-medium shrink-0">{q.question_number}.</span>
                            <span className="text-gray-800">{q.question_text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Submission status or form */}
                    {sub ? (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-medium text-gray-700">
                            Submitted {new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                          {sub.delay_days > 0 && (
                            <span className="text-xs text-red-500 font-medium">({sub.delay_days} day{sub.delay_days > 1 ? 's' : ''} late)</span>
                          )}
                        </div>
                        {sub.submission_text && <p className="text-xs text-gray-600 line-clamp-4">{sub.submission_text}</p>}
                        {sub.file_urls?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {sub.file_names.map((name, i) => (
                              <a key={i} href={sub.file_urls[i]} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-100 transition">
                                <Paperclip className="h-3 w-3" /> {name}
                              </a>
                            ))}
                          </div>
                        )}
                        {sub.grade && <p className="text-xs text-gray-800">Grade: <span className={`font-bold ${GRADE_COLORS[sub.grade] || 'text-gray-900'}`}>{sub.grade}</span></p>}
                        {sub.teacher_comment && <p className="text-xs text-gray-600">💬 {sub.teacher_comment}</p>}
                      </div>
                    ) : submitTarget === hw.id ? (
                      <div className="space-y-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
                        {/* Completion status picker */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-600 font-medium">Status:</span>
                          {(['completed', 'partial', 'not_started'] as const).map(st => (
                            <button key={st} onClick={() => setSubmitStatus(st)}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${submitStatus === st
                                ? `${HW_STATUS_STYLE[st].bg} ${HW_STATUS_STYLE[st].text} ring-1 ring-current`
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              {HW_STATUS_STYLE[st].label}
                            </button>
                          ))}
                        </div>

                        <textarea value={submitText} onChange={e => setSubmitText(e.target.value)}
                          placeholder="Write your answer (optional if uploading files)…"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                          rows={4} maxLength={5000} autoFocus />

                        {/* File upload */}
                        <div>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-white border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
                            <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Attach Files'}
                            <input type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.mp4,.mp3"
                              onChange={handleFileUpload} className="hidden" disabled={uploading} />
                          </label>
                          <span className="text-[10px] text-gray-400 ml-2">JPEG, PNG, PDF, DOCX, PPTX (max 20 MB each)</span>
                          {uploadedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {uploadedFiles.map((f, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                                  <Paperclip className="h-3 w-3" /> {f.name}
                                  <button onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 ml-0.5">✕</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleSubmit(hw.id)} disabled={submitting}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                            {submitting ? 'Submitting…' : 'Submit'}
                          </button>
                          <button onClick={() => { setSubmitTarget(null); setSubmitText(''); setUploadedFiles([]); setSubmitStatus('completed'); }}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setSubmitTarget(hw.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition">
                        <Send className="h-3.5 w-3.5" /> Submit Homework
                      </button>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {closed.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-4">Closed ({closed.length})</h3>
              {closed.map(hw => {
                const sub = getSubmission(hw.id);
                return (
                  <Card key={hw.id} className="p-4 space-y-2 opacity-70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 text-sm">{hw.title}</p>
                      </div>
                      {sub ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${HW_STATUS_STYLE[sub.completion_status]?.bg || 'bg-gray-100'} ${HW_STATUS_STYLE[sub.completion_status]?.text || 'text-gray-600'}`}>
                          {HW_STATUS_STYLE[sub.completion_status]?.label || 'Submitted'}
                        </span>
                      ) : (
                        <Badge label="Not Submitted" variant="default" icon={XCircle} />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>{hw.subject}</span>
                      {hw.batch_name && <span>{hw.batch_name}</span>}
                    </div>
                    {/* Attachments from teacher */}
                    {hw.attachment_urls?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {hw.attachment_names.map((name, i) => (
                          <a key={i} href={hw.attachment_urls[i]} target="_blank" rel="noreferrer" download
                            className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition">
                            <Download className="h-3 w-3" /> {name}
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Questions */}
                    {hw.questions?.length > 0 && (
                      <div className="space-y-1 text-xs text-gray-500">
                        {hw.questions.map(q => (
                          <div key={q.id} className="flex gap-1.5"><span className="font-medium">{q.question_number}.</span> {q.question_text}</div>
                        ))}
                      </div>
                    )}
                    {sub?.grade && <p className="text-xs text-gray-600">Grade: <span className="font-bold">{sub.grade}</span></p>}
                    {sub?.teacher_comment && <p className="text-xs text-gray-500">💬 {sub.teacher_comment}</p>}
                    {sub?.delay_days ? <p className="text-xs text-red-400">{sub.delay_days} day{sub.delay_days > 1 ? 's' : ''} late</p> : null}
                    {sub?.file_urls?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {sub.file_names.map((name, i) => (
                          <a key={i} href={sub.file_urls[i]} target="_blank" rel="noreferrer"
                            className="text-xs text-emerald-600 hover:underline">📎 {name}</a>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────

function ProfileTab({ profile, loading }: { profile: StudentProfile | null; loading: boolean }) {
  if (loading) return <LoadingState />;

  if (!profile) {
    return <EmptyState icon={User} message="Your profile will appear here once HR has filled in your details." />;
  }

  const Field = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value?: string | number | null;
    icon: React.ElementType;
  }) => (
    <div className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div>
        <p className="mb-0.5 text-xs text-gray-400">{label}</p>
        <p className={`text-sm ${value != null && value !== '' ? 'text-gray-800' : 'italic text-gray-400'}`}>
          {value != null && value !== '' ? String(value) : 'Not set'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-5">
          <Avatar name={profile.name} size="lg" />
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{profile.name}</h2>
            <p className="mt-0.5 text-xs sm:text-sm font-medium text-emerald-600">Student</p>
            <p className="mt-0.5 sm:mt-1 text-xs text-gray-500 truncate">{profile.email}</p>
          </div>
        </div>

        {/* Grade / Section badges */}
        {(profile.grade || profile.section || profile.board) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.grade && (
              <Badge label={profile.grade} variant="primary" icon={GraduationCap} />
            )}
            {profile.section && (
              <Badge label={`Section ${profile.section}`} variant="primary" icon={BookMarked} />
            )}
            {profile.board && (
              <Badge label={profile.board} variant="info" icon={School} />
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <Card className="px-3 sm:px-5">
        <Field label="Phone" value={profile.phone} icon={Phone} />
        <Field label="WhatsApp" value={profile.whatsapp} icon={Phone} />
        <Field
          label="Date of Birth"
          value={profile.date_of_birth ? fmtDateLongIST(profile.date_of_birth) : null}
          icon={Calendar}
        />
        <Field label="Board" value={profile.board} icon={School} />
        <Field label="Grade" value={profile.grade} icon={GraduationCap} />
        <Field label="Section" value={profile.section} icon={BookMarked} />
        <Field label="Address" value={profile.address} icon={Info} />
        <Field label="Category" value={profile.category ? `Category ${profile.category}` : null} icon={Layers} />
        <Field label="Parent Email" value={profile.parent_email} icon={Users} />
        <Field label="Parent Phone" value={profile.parent_phone} icon={Phone} />
        <Field
          label="Admission Date"
          value={profile.admission_date ? fmtDateLongIST(profile.admission_date) : null}
          icon={Calendar}
        />
        {profile.notes && <Field label="Notes" value={profile.notes} icon={Info} />}
      </Card>
    </div>
  );
}

// ── Mobile Bottom Navigation ───────────────────────────────────

const BOTTOM_NAV_TABS: { key: string; label: string; icon: typeof LayoutDashboard; center?: boolean }[] = [
  { key: 'overview',    label: 'Home',       icon: LayoutDashboard },
  { key: 'attendance',  label: 'Attendance', icon: CheckCircle2 },
  { key: 'batches',     label: 'Classes',    icon: BookOpen, center: true },
  { key: 'fees',        label: 'Fees',       icon: CreditCard },
  { key: 'exams',       label: 'Exams',      icon: Trophy },
];

function MobileBottomNav({
  active,
  onChange,
  liveCount,
}: {
  active: string;
  onChange: (key: string) => void;
  liveCount: number;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md sm:hidden safe-bottom">
      <div className="flex items-end justify-around px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {BOTTOM_NAV_TABS.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;

          // Center "Live" button — elevated FAB style
          if (t.center) {
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className="relative -mt-4 flex flex-col items-center"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
                    liveCount > 0
                      ? 'bg-green-500 text-white ring-4 ring-green-100 animate-pulse'
                      : isActive
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                        : 'bg-gray-100 text-gray-500 ring-2 ring-gray-200'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {liveCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                      {liveCount}
                    </span>
                  )}
                </div>
                <span className={`mt-0.5 text-[10px] font-semibold ${
                  liveCount > 0 ? 'text-green-600' : isActive ? 'text-emerald-600' : 'text-gray-400'
                }`}>
                  {liveCount > 0 ? `${liveCount} Live` : 'Classes'}
                </span>
              </button>
            );
          }

          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="flex min-w-[56px] flex-col items-center gap-0.5 py-1.5 transition-colors active:scale-95"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-gray-400'
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {t.label}
              </span>
              {isActive && (
                <div className="h-0.5 w-4 rounded-full bg-emerald-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Main Dashboard Component ───────────────────────────────────

export default function StudentDashboardClient({ userName, userEmail, userRole, permissions, bujiEnabled = true }: Props) {
  const platformName = usePlatformName();
  const router = useRouter();

  // Re-render every 30s so effectiveStatus / effectiveSessionStatus re-evaluate Date.now()
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [batches, setBatches] = useState<BatchDetail[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryData | null>(null);
  const [attendanceBySubject, setAttendanceBySubject] = useState<SubjectAttendance[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionTodayStats, setSessionTodayStats] = useState<SessionTodayStats | null>(null);
  const [feesSummary, setFeesSummary] = useState<FeesSummaryData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [exams, setExams] = useState<ExamData[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<SessionRequest[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [videoRequests, setVideoRequests] = useState<Map<string, VideoAccessRequest>>(new Map());
  const [requestingVideo, setRequestingVideo] = useState<string | null>(null);
  const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignment[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loadingHomework, setLoadingHomework] = useState(false);

  // Session credits state
  const [creditsData, setCreditsData] = useState<{
    credits: Array<{ id: string; subject: string; batch_type: string; total_sessions: number; used_sessions: number; remaining: number }>;
    total_remaining: number;
    total_allotted: number;
    warning: boolean;
    exhausted: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Sync tab with URL hash (sidebar nav clicks)
  useEffect(() => {
    const validTabs = ['overview', 'batches', 'attendance', 'exams', 'fees', 'materials', 'homework', 'reports', 'requests', 'profile'];
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && validTabs.includes(hash)) setActiveTab(hash);
      else if (!hash) setActiveTab('overview');
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const changeTab = useCallback((key: string) => {
    setActiveTab(key);
    window.location.hash = key === 'overview' ? '' : key;
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/v1/student/rooms');
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success) setAssignments(data.data?.rooms ?? []);
    } catch (err) {
      console.error('[Student] rooms fetch failed:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch('/api/v1/student/batches');
      const data = await res.json();
      if (data.success) setBatches(data.data?.batches ?? []);
    } catch (err) {
      console.error('[Student] batches fetch failed:', err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetch('/api/v1/student/attendance');
      const data = await res.json();
      if (data.success) {
        setAttendanceRecords(data.data?.records ?? []);
        setAttendanceSummary(data.data?.summary ?? null);
        setAttendanceBySubject(data.data?.by_subject ?? []);
      }
    } catch (err) {
      console.error('[Student] attendance fetch failed:', err);
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    try {
      const res = await fetch('/api/v1/teaching-materials');
      const data = await res.json();
      if (data.success) setMaterials(data.data?.materials ?? []);
    } catch (err) {
      console.error('[Student] materials fetch failed:', err);
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  const fetchHomework = useCallback(async () => {
    setLoadingHomework(true);
    try {
      const res = await fetch('/api/v1/student/homework');
      const data = await res.json();
      if (data.success) {
        setHomeworkAssignments(data.data?.assignments ?? []);
        setHomeworkSubmissions(data.data?.submissions ?? []);
      }
    } catch (err) {
      console.error('[Student] homework fetch failed:', err);
    } finally {
      setLoadingHomework(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch('/api/v1/student/profile');
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success) setProfile(data.data);
      else console.error('[Student] profile error:', data.error);
    } catch (err) {
      console.error('[Student] profile fetch failed:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/v1/student/sessions?range=all');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data?.sessions ?? []);
        setSessionTodayStats(data.data?.today ?? null);
      }
    } catch (err) {
      console.error('[Student] sessions fetch failed:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/student/credits');
      const data = await res.json();
      if (data.success) setCreditsData(data.data);
    } catch (err) {
      console.error('[Student] credits fetch failed:', err);
    }
  }, []);

  const fetchFees = useCallback(async () => {
    setLoadingFees(true);
    try {
      const res = await fetch('/api/v1/student/fees');
      const data = await res.json();
      if (data.success) {
        setFeesSummary(data.data?.summary ?? null);
        setInvoices(data.data?.invoices ?? []);
        setReceipts(data.data?.receipts ?? []);
      }
    } catch (err) {
      console.error('[Student] fees fetch failed:', err);
    } finally {
      setLoadingFees(false);
    }
  }, []);

  // ── Razorpay payment ────────────────────────────────
  const getRazorpay = () => (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;

  const handlePayInvoice = useCallback(async (invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      const res = await fetch('/api/v1/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Payment initiation failed'); return; }

      const order = data.data;

      if (order.mode === 'test' || order.mode === 'mock') {
        // Mock/test mode: auto-complete
        const cbRes = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_id: invoiceId }),
        });
        const cbData = await cbRes.json();
        if (cbData.success) { fetchFees(); }
        else { alert('Payment failed'); }
      } else {
        // Live Razorpay checkout
        const Razorpay = getRazorpay();
        if (!Razorpay) { alert('Payment gateway loading, please try again...'); return; }
        const rzp = new Razorpay({
          key: order.gatewayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: platformName,
          description: 'Fee Payment',
          order_id: order.orderId,
          prefill: order.prefill,
          theme: { color: '#059669' },
          handler: async (response: Record<string, string>) => {
            await fetch('/api/v1/payment/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            fetchFees();
          },
        });
        rzp.open();
      }
    } catch { alert('Network error'); }
    finally { setPayingInvoice(null); }
  }, [fetchFees]);

  const fetchExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const res = await fetch('/api/v1/exams?role=student');
      const data = await res.json();
      if (data.success) setExams(data.data?.exams ?? []);
    } catch (err) {
      console.error('[Student] exams fetch failed:', err);
    } finally {
      setLoadingExams(false);
    }
  }, []);

  const fetchSessionRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.requests ?? []);
    } catch (err) {
      console.error('[Student] session-requests fetch failed:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const fetchAvailability = useCallback(async () => {
    setLoadingAvailability(true);
    try {
      const res = await fetch('/api/v1/student-availability');
      const data = await res.json();
      if (data.success) setAvailability(data.slots ?? []);
    } catch (err) {
      console.error('[Student] availability fetch failed:', err);
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  const fetchVideoRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/recording/requests');
      const data = await res.json();
      if (data.success) {
        const map = new Map<string, VideoAccessRequest>();
        for (const r of data.data ?? []) map.set(r.room_id, r);
        setVideoRequests(map);
      }
    } catch (err) {
      console.error('[Student] video requests fetch failed:', err);
    }
  }, []);

  const requestVideoAccess = useCallback(async (roomId: string) => {
    setRequestingVideo(roomId);
    try {
      const res = await fetch('/api/v1/recording/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      const data = await res.json();
      if (data.success) {
        setVideoRequests(prev => {
          const next = new Map(prev);
          next.set(roomId, { id: data.data.id, room_id: roomId, status: 'pending', recording_url: null, created_at: data.data.created_at, reviewed_at: null });
          return next;
        });
      } else {
        alert(data.error || 'Request failed');
      }
    } catch { alert('Network error'); }
    finally { setRequestingVideo(null); }
  }, []);

  useEffect(() => { fetchAssignments(); fetchBatches(); fetchAttendance(); fetchSessions(); fetchCredits(); }, [fetchAssignments, fetchBatches, fetchAttendance, fetchSessions, fetchCredits]);

  useEffect(() => {
    if (activeTab === 'profile' && !profile) fetchProfile();
  }, [activeTab, profile, fetchProfile]);

  useEffect(() => {
    if (activeTab === 'materials') fetchMaterials();
  }, [activeTab, fetchMaterials]);

  useEffect(() => {
    if (activeTab === 'batches') { fetchSessions(); fetchVideoRequests(); }
  }, [activeTab, fetchSessions, fetchVideoRequests]);

  useEffect(() => {
    if (activeTab === 'batches') fetchBatches();
  }, [activeTab, fetchBatches]);

  useEffect(() => {
    if (activeTab === 'fees') fetchFees();
  }, [activeTab, fetchFees]);

  useEffect(() => {
    if (activeTab === 'overview' && exams.length === 0) fetchExams();
  }, [activeTab, exams.length, fetchExams]);

  useEffect(() => {
    if (activeTab === 'requests') { fetchSessionRequests(); fetchAvailability(); }
  }, [activeTab, fetchSessionRequests, fetchAvailability]);

  useEffect(() => {
    if (activeTab === 'overview' && !feesSummary) fetchFees();
  }, [activeTab, feesSummary, fetchFees]);

  useEffect(() => {
    if (activeTab === 'overview' && sessions.length === 0) fetchSessions();
  }, [activeTab, sessions.length, fetchSessions]);

  useEffect(() => {
    if (activeTab === 'homework' || activeTab === 'overview') fetchHomework();
  }, [activeTab, fetchHomework]);

  // Poll sessions every 20 seconds to pick up live-status changes
  useEffect(() => {
    const id = setInterval(fetchSessions, 20_000);
    return () => clearInterval(id);
  }, [fetchSessions]);

  // Refresh fees when page regains focus (e.g. after paying via WhatsApp link in another tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchFees();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchFees]);

  useEffect(() => {
    const id = setInterval(fetchAssignments, 60_000);
    return () => clearInterval(id);
  }, [fetchAssignments]);

  // Poll homework every 60s so pending count stays fresh
  useEffect(() => {
    const id = setInterval(fetchHomework, 60_000);
    return () => clearInterval(id);
  }, [fetchHomework]);

  const sessionLiveCount = sessions.filter(s => effectiveSessionStatus(s) === 'live').length;
  const pendingHomework = homeworkAssignments.filter(hw => {
    const submitted = homeworkSubmissions.some(s => s.homework_id === hw.id);
    return hw.status === 'active' && !submitted;
  });

  // ── Build AI chatbot context from student data ──
  const bujiContext = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Student Name: ${userName}`);
    lines.push(`Email: ${userEmail}`);
    if (profile) {
      if (profile.grade) lines.push(`Grade: ${profile.grade}`);
      if (profile.section) lines.push(`Section: ${profile.section}`);
      if (profile.board) lines.push(`Board: ${profile.board}`);
      if (profile.phone) lines.push(`Phone: ${profile.phone}`);
    }

    // Batches/Classes
    if (batches.length > 0) {
      lines.push(`\nEnrolled Classes (${batches.length}):`);
      for (const b of batches) {
        const subjects = b.teachers?.map(t => t.subject).join(', ') || 'N/A';
        lines.push(`- ${b.name} (${b.type?.replace(/_/g, ' ')}) — Subjects: ${subjects}, Status: ${b.status}`);
        if (b.stats) lines.push(`  Sessions: ${b.stats.completed_sessions} completed, ${b.stats.upcoming_sessions} upcoming of ${b.stats.total_sessions} total`);
        if (b.attendance) lines.push(`  Attendance: ${b.attendance.rate}% (${b.attendance.present}/${b.attendance.total} present)`);
        if (b.teachers?.length) {
          for (const t of b.teachers) lines.push(`  Teacher: ${t.teacher_name} (${t.subject}${t.is_primary ? ', Primary' : ''})`);
        }
      }
    }

    // Attendance summary
    if (attendanceSummary) {
      lines.push(`\nOverall Attendance: ${attendanceSummary.attendance_rate}%`);
      lines.push(`Present: ${attendanceSummary.present}, Absent: ${attendanceSummary.absent}, Late: ${attendanceSummary.late}, Total: ${attendanceSummary.total_sessions}`);
      if (attendanceSummary.avg_time_minutes) lines.push(`Average time in class: ${Math.round(attendanceSummary.avg_time_minutes)} minutes`);
    }
    if (attendanceBySubject.length > 0) {
      lines.push(`\nAttendance by Subject:`);
      for (const s of attendanceBySubject) lines.push(`- ${s.subject}: ${s.rate}% (${s.present}/${s.total})`);
    }

    // Upcoming sessions (next 5)
    const upcoming = sessions
      .filter(s => effectiveSessionStatus(s) === 'scheduled')
      .sort((a, b) => new Date(`${a.scheduled_date}T${a.start_time}`).getTime() - new Date(`${b.scheduled_date}T${b.start_time}`).getTime())
      .slice(0, 5);
    if (upcoming.length > 0) {
      lines.push(`\nUpcoming Sessions (next ${upcoming.length}):`);
      for (const s of upcoming) {
        lines.push(`- ${s.subject} on ${s.scheduled_date} at ${s.start_time?.slice(0, 5)} (${s.duration_minutes}min) — Teacher: ${s.teacher_name || 'TBD'}, Batch: ${s.batch_name}`);
      }
    }

    // Live sessions
    const live = sessions.filter(s => effectiveSessionStatus(s) === 'live');
    if (live.length > 0) {
      lines.push(`\nLIVE NOW (${live.length}):`);
      for (const s of live) lines.push(`- ${s.subject} — ${s.batch_name} (Teacher: ${s.teacher_name})`);
    }

    // Exams
    const gradedExams = exams.filter(e => e.attempt_status === 'graded');
    if (gradedExams.length > 0) {
      lines.push(`\nExam Results (${gradedExams.length} graded):`);
      for (const e of gradedExams.slice(0, 8)) {
        lines.push(`- ${e.title} (${e.subject}): ${e.attempt_score}/${e.total_marks} = ${e.attempt_percentage}% [${e.attempt_grade || ''}]`);
      }
      const avgScore = gradedExams.reduce((sum, e) => sum + Number(e.attempt_percentage || 0), 0) / gradedExams.length;
      lines.push(`Average exam score: ${Math.round(avgScore)}%`);
    }
    const pendingExams = exams.filter(e => e.attempt_status === 'pending');
    if (pendingExams.length > 0) {
      lines.push(`Pending exams: ${pendingExams.length}`);
    }

    // Fees
    if (feesSummary) {
      lines.push(`\nFees Summary:`);
      lines.push(`Total invoiced: ₹${(feesSummary.total_invoiced_paise / 100).toLocaleString('en-IN')}`);
      lines.push(`Paid: ₹${(feesSummary.total_paid_paise / 100).toLocaleString('en-IN')}`);
      lines.push(`Pending: ₹${(feesSummary.total_pending_paise / 100).toLocaleString('en-IN')} (${feesSummary.pending_count} invoices)`);
      if (feesSummary.overdue_count > 0) lines.push(`OVERDUE: ${feesSummary.overdue_count} invoices!`);
    }

    // Credits
    if (creditsData) {
      lines.push(`\nSession Credits: ${creditsData.total_remaining} remaining of ${creditsData.total_allotted} total`);
      if (creditsData.warning) lines.push(`⚠ Credits running low!`);
      if (creditsData.exhausted) lines.push(`🚨 Credits exhausted!`);
    }

    // Homework
    if (pendingHomework.length > 0) {
      lines.push(`\nPending Homework (${pendingHomework.length}):`);
      for (const hw of pendingHomework.slice(0, 5)) {
        lines.push(`- ${hw.title} (${hw.subject}) — Due: ${hw.due_date}${hw.due_time ? ' ' + hw.due_time.slice(0, 5) : ''}`);
      }
    }

    return lines.join('\n');
  }, [userName, userEmail, profile, batches, attendanceSummary, attendanceBySubject, sessions, exams, feesSummary, creditsData, pendingHomework]);

  const refreshAll = useCallback(() => {
    fetchAssignments(); fetchBatches(); fetchAttendance(); fetchSessions(); fetchHomework(); fetchFees(); fetchMaterials();
  }, [fetchAssignments, fetchBatches, fetchAttendance, fetchSessions, fetchHomework, fetchFees, fetchMaterials]);

  const tabs = [
    { key: 'overview',   label: 'Overview',   icon: LayoutDashboard },
    { key: 'batches',    label: `Classes${batches.length > 0 ? ` · ${batches.length}` : ''}`, icon: BookOpen },
    { key: 'attendance', label: attendanceSummary ? `Attendance · ${attendanceSummary.attendance_rate}%` : 'Attendance', icon: CheckCircle2 },
    { key: 'exams',      label: 'Exams', icon: Trophy },
    { key: 'fees',       label: feesSummary && feesSummary.overdue_count > 0 ? `Fees · ${feesSummary.overdue_count} Due` : 'Fees', icon: CreditCard },
    { key: 'materials',  label: 'Materials',  icon: FolderOpen },
    { key: 'homework',   label: pendingHomework.length > 0 ? `Homework · ${pendingHomework.length} Due` : 'Homework', icon: ListChecks },
    { key: 'requests',   label: `Requests${sessionRequests.filter(r => r.status === 'pending').length > 0 ? ` · ${sessionRequests.filter(r => r.status === 'pending').length}` : ''}`, icon: ClipboardList },
    { key: 'profile',    label: 'Profile', icon: User },
  ];

  const navBadges: Record<string, number> = {};
  if (feesSummary && (feesSummary.overdue_count + feesSummary.pending_count) > 0)
    navBadges['/student#fees'] = feesSummary.overdue_count + feesSummary.pending_count;
  if (pendingHomework.length > 0)
    navBadges['/student#homework'] = pendingHomework.length;
  const pendingExamsBadge = exams.filter(e => !e.attempt_status || e.attempt_status === 'pending' || e.attempt_status === 'in_progress').length;
  if (pendingExamsBadge > 0)
    navBadges['/student#exams'] = pendingExamsBadge;

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions} navBadges={navBadges}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} strategy="afterInteractive" />
      <div className="space-y-4 sm:space-y-6">
        {/* Header — hidden on mobile, visible on desktop */}
        {(() => {
          const headerMap: Record<string, { icon: LucideIcon; title: string; subtitle: string }> = {
            overview:   { icon: LayoutDashboard, title: `Welcome back, ${userName.split(' ')[0]}`, subtitle: sessionLiveCount > 0 ? `${sessionLiveCount} live session${sessionLiveCount > 1 ? 's' : ''} now` : `${batches.length} class${batches.length !== 1 ? 'es' : ''} enrolled` },
            batches:    { icon: BookOpen, title: 'My Classes', subtitle: `${batches.filter(b => b.status === 'active').length} active · ${batches.length} total` },
            attendance: { icon: CheckCircle2, title: 'Attendance', subtitle: attendanceSummary ? `${attendanceSummary.attendance_rate}% · ${attendanceSummary.present}/${attendanceSummary.total_sessions} present` : 'Track your class attendance' },
            exams:      { icon: Trophy, title: 'Exams', subtitle: 'Live class exam results' },
            fees:       { icon: CreditCard, title: 'Fees & Payments', subtitle: feesSummary ? `${money(feesSummary.total_paid_paise)} paid · ${money(feesSummary.total_pending_paise)} pending` : 'View invoices and payments' },
            materials:  { icon: FolderOpen, title: 'Study Materials', subtitle: 'Course files and resources' },
            homework:   { icon: ListChecks, title: 'Homework', subtitle: pendingHomework.length > 0 ? `${pendingHomework.length} pending` : 'All caught up' },
            reports:    { icon: BarChart2, title: 'Reports', subtitle: 'Academic performance reports' },
            requests:   { icon: ClipboardList, title: 'Requests', subtitle: `${sessionRequests.filter(r => r.status === 'pending').length} pending` },
            profile:    { icon: User, title: 'My Profile', subtitle: 'Your details and preferences' },
          };
          const h = headerMap[activeTab] || headerMap.overview;
          return (
            <div className="hidden sm:flex items-center justify-between">
              <PageHeader icon={h.icon} title={h.title} subtitle={h.subtitle} />
              <RefreshButton loading={loadingRooms || loadingBatches} onClick={refreshAll} />
            </div>
          );
        })()}

        {/* Mobile: compact greeting */}
        {(() => {
          const mobileMap: Record<string, { title: string; sub: string }> = {
            overview:   { title: `Hi, ${userName.split(' ')[0]} 👋`, sub: sessionLiveCount > 0 ? `${sessionLiveCount} live session${sessionLiveCount > 1 ? 's' : ''} now` : `${batches.length} batch${batches.length !== 1 ? 'es' : ''} enrolled` },
            batches:    { title: 'My Batches', sub: `${batches.filter(b => b.status === 'active').length} active` },
            attendance: { title: 'Attendance', sub: attendanceSummary ? `${attendanceSummary.attendance_rate}%` : '' },
            exams:      { title: 'Exams', sub: '' },
            fees:       { title: 'Fees & Payments', sub: feesSummary && feesSummary.overdue_count > 0 ? `${feesSummary.overdue_count} overdue` : '' },
            materials:  { title: 'Study Materials', sub: '' },
            homework:   { title: 'Homework', sub: pendingHomework.length > 0 ? `${pendingHomework.length} pending` : '' },
            reports:    { title: 'Reports', sub: '' },
            requests:   { title: 'Requests', sub: `${sessionRequests.filter(r => r.status === 'pending').length} pending` },
            profile:    { title: 'My Profile', sub: '' },
          };
          const m = mobileMap[activeTab] || mobileMap.overview;
          return (
            <div className="flex items-center justify-between sm:hidden">
              <div>
                <p className="text-base font-bold text-gray-900">{m.title}</p>
                {m.sub && <p className="text-xs text-gray-500">{m.sub}</p>}
              </div>
              <RefreshButton loading={loadingRooms || loadingBatches} onClick={refreshAll} />
            </div>
          );
        })()}

        {/* Desktop tab bar — hidden; navigation via sidebar + MobileBottomNav */}
        {/* <TabBar tabs={tabs} active={activeTab} onChange={changeTab} /> */}

        {(loadingRooms || loadingBatches) && assignments.length === 0 && batches.length === 0 ? (
          <LoadingState />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                userName={userName}
                batches={batches}
                attendanceSummary={attendanceSummary}
                attendanceBySubject={attendanceBySubject}
                sessions={sessions}
                exams={exams}
                feesSummary={feesSummary}
                router={router}
                pendingHomework={pendingHomework}
                sessionTodayStats={sessionTodayStats}
                creditsData={creditsData}
              />
            )}
            {activeTab === 'batches' && (
              <BatchesTab
                batches={batches}
                loading={loadingBatches}
                onRefresh={() => { fetchBatches(); fetchSessions(); fetchVideoRequests(); }}
                sessions={sessions}
                videoRequests={videoRequests}
                requestVideoAccess={requestVideoAccess}
                requestingVideo={requestingVideo}
              />
            )}
            {activeTab === 'attendance' && (
              <AttendanceTab
                records={attendanceRecords}
                summary={attendanceSummary}
                bySubject={attendanceBySubject}
                loading={loadingAttendance}
                onRefresh={fetchAttendance}
              />
            )}
            {activeTab === 'exams' && (
              <ExamsTab />
            )}
            {activeTab === 'fees' && (
              <FeesTab
                summary={feesSummary}
                invoices={invoices}
                receipts={receipts}
                loading={loadingFees}
                onRefresh={fetchFees}
                onPay={handlePayInvoice}
                payingId={payingInvoice}
                studentName={userName}
              />
            )}
            {activeTab === 'materials' && (
              <StudentMaterialsTab materials={materials} loading={loadingMaterials} onRefresh={fetchMaterials} />
            )}
            {activeTab === 'homework' && (
              <HomeworkTab
                assignments={homeworkAssignments}
                submissions={homeworkSubmissions}
                loading={loadingHomework}
                onRefresh={fetchHomework}
                userEmail={userEmail}
              />
            )}
            {activeTab === 'requests' && (
              <RequestsTab
                requests={sessionRequests}
                availability={availability}
                sessions={sessions}
                batches={batches}
                loading={loadingRequests}
                loadingAvailability={loadingAvailability}
                onRefresh={() => { fetchSessionRequests(); fetchAvailability(); }}
                userEmail={userEmail}
                userName={userName}
              />
            )}
            {activeTab === 'reports' && (
              <StudentReportsTab studentEmail={userEmail} />
            )}
            {activeTab === 'profile' && <ProfileTab profile={profile} loading={loadingProfile} />}
          </>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav
        active={activeTab}
        onChange={changeTab}
        liveCount={sessionLiveCount}
      />

      {/* Buji AI Chatbot */}
      <BujiChatbot userEmail={userEmail} userName={userName} userContext={bujiContext} enabled={bujiEnabled} />
    </DashboardShell>
  );
}

// ── Batches Tab ────────────────────────────────────────────────

const BATCH_TYPE_LABEL: Record<string, string> = {
  one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15',
  one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture',
  improvement_batch: 'Improvement', custom: 'Custom',
};
const BATCH_TYPE_VARIANT: Record<string, 'primary' | 'info' | 'default' | 'warning'> = {
  one_to_one:   'info',    one_to_three: 'primary',
  one_to_many:  'default', custom:       'warning',
};

const SUBJECT_COLORS = [
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', pill: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', pill: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', pill: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', pill: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-teal-500', light: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', pill: 'bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
];

type SessionFilterKey = 'all' | 'scheduled' | 'live' | 'ended' | 'cancelled';

function BatchesTab({
  batches, loading, onRefresh, sessions, videoRequests, requestVideoAccess, requestingVideo,
}: {
  batches: BatchDetail[];
  loading: boolean;
  onRefresh: () => void;
  sessions: SessionData[];
  videoRequests: Map<string, VideoAccessRequest>;
  requestVideoAccess: (roomId: string) => void;
  requestingVideo: string | null;
}) {
  const [activeBatchIdx, setActiveBatchIdx] = useState<number>(0);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<SessionFilterKey>('all');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showBatchInfo, setShowBatchInfo] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [refundSubmitting, setRefundSubmitting] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<{ sessionId: string; type: 'refund' | 'reschedule' } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrUploading, setQrUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'upi' | 'qr'>('upi');

  const uploadQrCode = async (file: File) => {
    setQrUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/v1/student/refund-upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setQrCodeUrl(data.data.url);
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch {
      alert('Upload failed');
    } finally {
      setQrUploading(false);
    }
  };

  const resetRefundForm = () => {
    setRefundModal(null);
    setRefundReason('');
    setBankName('');
    setBankAccount('');
    setBankIfsc('');
    setUpiId('');
    setQrCodeUrl('');
    setPaymentMethod('upi');
  };

  const submitRefundRequest = async (sessionId: string, requestType: 'refund' | 'reschedule', reason: string) => {
    setRefundSubmitting(sessionId);
    try {
      const payload: Record<string, string> = {
        batch_session_id: sessionId,
        request_type: requestType,
        reason,
      };
      if (requestType === 'refund') {
        if (paymentMethod === 'bank') {
          payload.account_holder_name = bankName;
          payload.account_number = bankAccount;
          payload.ifsc_code = bankIfsc;
        } else if (paymentMethod === 'upi') {
          payload.upi_id = upiId;
        } else if (paymentMethod === 'qr') {
          payload.qr_code_url = qrCodeUrl;
        }
      }
      const res = await fetch('/api/v1/student/refund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        resetRefundForm();
      } else {
        alert(data.error || 'Failed to submit request');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setRefundSubmitting(null);
    }
  };

  if (loading && batches.length === 0) return <LoadingState />;
  if (!loading && batches.length === 0) {
    return <EmptyState icon={BookOpen} message="You're not enrolled in any class yet. Contact your coordinator to get started." />;
  }

  // Clamp index in case batches array shrinks
  const safeIdx = Math.min(activeBatchIdx, batches.length - 1);
  const b = batches[safeIdx];
  const rate = b.attendance.rate;
  const attColor = (r: number) => r >= 75 ? 'text-emerald-600' : r >= 50 ? 'text-amber-600' : 'text-red-600';
  const attBarCls = (r: number) => r >= 75 ? 'bg-emerald-500' : r >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const allSessions = sessions.filter(s => s.batch_id === b.id);
  const subjects = [...new Set(allSessions.map(s => s.subject))].sort();
  const subjectColorMap = new Map(subjects.map((s, i) => [s, SUBJECT_COLORS[i % SUBJECT_COLORS.length]]));

  const liveSessions = allSessions.filter(s => effectiveSessionStatus(s) === 'live');
  const statusCounts: Record<SessionFilterKey, number> = {
    all: allSessions.length,
    live: liveSessions.length,
    scheduled: allSessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length,
    ended: allSessions.filter(s => effectiveSessionStatus(s) === 'ended').length,
    cancelled: allSessions.filter(s => effectiveSessionStatus(s) === 'cancelled').length,
  };

  const filtered = allSessions
    .filter(s => subjectFilter === 'all' || s.subject === subjectFilter)
    .filter(s => statusFilter === 'all' || effectiveSessionStatus(s) === statusFilter)
    .sort((a, c) => {
      const ae = effectiveSessionStatus(a), ce = effectiveSessionStatus(c);
      if (ae === 'live' && ce !== 'live') return -1;
      if (ce === 'live' && ae !== 'live') return 1;
      if (ae === 'scheduled' && ce === 'ended') return -1;
      if (ae === 'ended' && ce === 'scheduled') return 1;
      if (ae === 'scheduled' && ce === 'scheduled') {
        return new Date(`${a.scheduled_date}T${a.start_time}`).getTime() - new Date(`${c.scheduled_date}T${c.start_time}`).getTime();
      }
      // For other cases, keep existing fallback but prefer chronological order
      return new Date(`${c.scheduled_date}T${c.start_time}`).getTime() - new Date(`${a.scheduled_date}T${a.start_time}`).getTime();
    });

  const groupedBySubject = subjects
    .filter(sub => subjectFilter === 'all' || sub === subjectFilter)
    .map(sub => ({
      subject: sub,
      color: subjectColorMap.get(sub)!,
      teacher: b.teachers.find(t => t.subject === sub),
      sessions: filtered.filter(s => s.subject === sub),
    }))
    .filter(g => g.sessions.length > 0);

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return { weekday: dt.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(), day: dt.getDate(), month: dt.toLocaleDateString('en-IN', { month: 'short' }) };
  };

  /* ── Refund Request Modal ── */
  const refundModalUI = refundModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={resetRefundForm}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">
          {refundModal.type === 'refund' ? 'Request Refund' : 'Request Reschedule'}
        </h3>
        <p className="text-sm text-gray-500">
          {refundModal.type === 'refund'
            ? 'Your payment will be reviewed for a refund by the academic coordinator.'
            : 'The academic coordinator will review and reschedule this session for you.'}
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
          <textarea
            value={refundReason}
            onChange={e => setRefundReason(e.target.value)}
            placeholder="Why were you absent? Any additional details…"
            rows={2}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bank details — only for refund type */}
        {refundModal.type === 'refund' && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Refund Payment Details</p>

            {/* Payment method selector */}
            <div className="flex gap-2">
              {([
                { key: 'upi' as const, label: 'UPI ID' },
                { key: 'bank' as const, label: 'Bank Account' },
                { key: 'qr' as const, label: 'QR Code' },
              ]).map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors ${
                    paymentMethod === m.key
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* UPI ID */}
            {paymentMethod === 'upi' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UPI ID</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Bank Account */}
            {paymentMethod === 'bank' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="Full name as per bank"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={e => setBankAccount(e.target.value)}
                    placeholder="Account number"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={bankIfsc}
                    onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* QR Code Upload */}
            {paymentMethod === 'qr' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Upload QR Code</label>
                {qrCodeUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <img src={qrCodeUrl} alt="QR Code" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-700">QR code uploaded</p>
                      <button
                        type="button"
                        onClick={() => setQrCodeUrl('')}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        Remove & re-upload
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                    qrUploading ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                  }`}>
                    <Upload className="h-6 w-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">{qrUploading ? 'Uploading…' : 'Click to upload QR code image'}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WebP — max 5 MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={qrUploading}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) uploadQrCode(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={resetRefundForm}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => submitRefundRequest(refundModal.sessionId, refundModal.type, refundReason)}
            disabled={
              refundSubmitting === refundModal.sessionId ||
              (refundModal.type === 'refund' && paymentMethod === 'upi' && !upiId) ||
              (refundModal.type === 'refund' && paymentMethod === 'bank' && (!bankName || !bankAccount || !bankIfsc)) ||
              (refundModal.type === 'refund' && paymentMethod === 'qr' && !qrCodeUrl)
            }
            className={`rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors ${
              refundModal.type === 'refund'
                ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
            }`}
          >
            {refundSubmitting === refundModal.sessionId ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Batch Selector (when enrolled in multiple) ── */}
      {batches.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {batches.map((batch, idx) => {
            const liveSess = sessions.filter(s => s.batch_id === batch.id && effectiveSessionStatus(s) === 'live').length;
            return (
              <button
                key={batch.id}
                onClick={() => { setActiveBatchIdx(idx); setSubjectFilter('all'); setStatusFilter('all'); setExpandedSession(null); }}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all border-2 ${
                  safeIdx === idx
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="max-w-[160px] truncate">{batch.name}</span>
                {liveSess > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white animate-pulse shrink-0">
                    {liveSess}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Class Info Card — Compact, modern ── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 text-white overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight">{b.name}</h2>
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold">
                  {BATCH_TYPE_LABEL[b.type] ?? b.type}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-emerald-100 text-xs">
                {b.grade && <span>{b.grade}{b.section ? ` · ${b.section}` : ''}</span>}
                <span>{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
                <span>{allSessions.length} session{allSessions.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <button onClick={() => setShowBatchInfo(!showBatchInfo)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0" title="Class details">
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Quick stats row */}
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Total', val: b.stats.total_sessions },
              { label: 'Completed', val: b.stats.completed_sessions },
              { label: 'Upcoming', val: b.stats.upcoming_sessions },
              { label: 'Present', val: b.attendance.present },
              { label: 'Absent', val: b.attendance.absent },
              { label: 'Attendance', val: `${rate}%` },
            ].map(x => (
              <div key={x.label} className="rounded-xl bg-white/10 backdrop-blur-sm px-2.5 py-2 text-center">
                <p className="text-sm font-bold">{x.val}</p>
                <p className="text-[10px] text-emerald-200">{x.label}</p>
              </div>
            ))}
          </div>

          {/* Attendance progress */}
          {b.attendance.total > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${rate}%` }} />
              </div>
              <span className="text-xs font-semibold text-emerald-100">{b.attendance.present}/{b.attendance.total}</span>
            </div>
          )}
        </div>

        {/* Expandable teachers/details */}
        {showBatchInfo && (
          <div className="border-t border-white/10 bg-white/5 backdrop-blur-sm px-4 sm:px-5 py-4 space-y-3">
            {b.teachers.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200 mb-2">Your Teachers</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {b.teachers.map((t, i) => {
                    const sc = subjectColorMap.get(t.subject);
                    return (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5">
                        <Avatar name={t.teacher_name} src={t.teacher_image} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{t.teacher_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {sc && <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />}
                            <p className="text-[10px] text-emerald-200">{t.subject}{t.is_primary ? ' · Primary' : ''}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(b.coordinator.name || b.ao_name) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {b.coordinator.name && (
                  <div className="rounded-xl bg-white/10 px-3 py-2.5">
                    <p className="text-[10px] text-emerald-300 uppercase tracking-wide">Coordinator</p>
                    <p className="text-xs font-semibold mt-0.5">{b.coordinator.name}</p>
                  </div>
                )}
                {b.ao_name && (
                  <div className="rounded-xl bg-white/10 px-3 py-2.5">
                    <p className="text-[10px] text-emerald-300 uppercase tracking-wide">Academic Operator</p>
                    <p className="text-xs font-semibold mt-0.5">{b.ao_name}</p>
                  </div>
                )}
              </div>
            )}
            {b.notes && <div className="rounded-xl bg-white/10 px-3 py-2.5 text-xs text-emerald-100">{b.notes}</div>}
          </div>
        )}
      </div>

      {/* ── Live Now Alert ── */}
      {liveSessions.length > 0 && (
        <div className="rounded-2xl border-2 border-green-300 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 p-4 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <p className="text-sm font-bold text-green-800">
              {liveSessions.length === 1 ? 'Your class is live!' : `${liveSessions.length} classes are live!`}
            </p>
          </div>
          <div className="space-y-2">
            {liveSessions.map(s => (
              <div key={s.session_id} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-green-200 px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${subjectColorMap.get(s.subject)?.dot ?? 'bg-gray-400'}`} />
                    <p className="text-sm font-bold text-gray-900">{s.subject}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.teacher_name} · Started at {fmtSessionTime24Local(s.scheduled_date, s.start_time)} · {fmtDuration(s.duration_minutes)}
                    {s.topic && <span className="ml-1 text-gray-400">· {s.topic}</span>}
                  </p>
                </div>
                <a href={`/join/${s.session_id}`}
                  className="shrink-0 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow-md hover:shadow-lg transition-all animate-pulse">
                  Join Now
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Subject Cards (when multiple) ── */}
      {subjects.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <button onClick={() => setSubjectFilter('all')}
            className={`rounded-xl p-3 text-left border-2 transition-all ${
              subjectFilter === 'all'
                ? 'border-emerald-300 bg-emerald-50 shadow-md ring-1 ring-emerald-200 ring-opacity-50'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
            }`}>
            <p className={`text-sm font-bold ${subjectFilter === 'all' ? 'text-emerald-700' : ''}`}>{allSessions.length}</p>
            <p className={`text-[11px] mt-0.5 ${subjectFilter === 'all' ? 'text-emerald-700' : 'opacity-75'}`}>All Subjects</p>
          </button>
          {subjects.map(sub => {
            const sc = subjectColorMap.get(sub)!;
            const isActive = subjectFilter === sub;
            const count = allSessions.filter(s => s.subject === sub).length;
            return (
              <button key={sub} onClick={() => setSubjectFilter(isActive ? 'all' : sub)}
                className={`rounded-xl p-3 text-left border-2 transition-all ${
                  isActive
                    ? `${sc.border} ${sc.light} shadow-md ring-1 ring-opacity-50`
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm'
                }`}>
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${sc.dot}`} />
                  <p className={`text-sm font-bold ${isActive ? sc.text : ''}`}>{count}</p>
                </div>
                <p className={`text-[11px] mt-0.5 truncate ${isActive ? sc.text : 'text-gray-500'}`}>{sub}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as SessionFilterKey[])
            .filter(f => f === 'all' || statusCounts[f] > 0)
            .map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === f
                    ? f === 'live' ? 'bg-green-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {f === 'live' && <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse mr-1.5" />}
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1 opacity-75">{statusCounts[f]}</span>
              </button>
            ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setViewMode('timeline')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'timeline' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}><Calendar className="h-3.5 w-3.5" /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}><Layers className="h-3.5 w-3.5" /></button>
          <span className="text-[10px] text-gray-400 ml-1">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Sessions ── */}
      {allSessions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No sessions scheduled yet</p>
          <p className="text-xs text-gray-400 mt-1">Your teacher will schedule classes soon</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-400">No sessions match your filters</p>
        </div>
      ) : viewMode === 'list' ? (
        /* ── Flat List View ── */
        <div className="space-y-2">
          {filtered.map(s => {
            const es = effectiveSessionStatus(s);
            const isExp = expandedSession === s.session_id;
            const sc = subjectColorMap.get(s.subject) ?? SUBJECT_COLORS[0];
            const d = fmtDate(s.scheduled_date);
            return (
              <div key={s.session_id} className={`rounded-2xl border overflow-hidden transition-all ${
                es === 'live' ? 'border-green-300 bg-green-50/40 shadow-md ring-1 ring-green-200' :
                isExp ? 'border-gray-200 shadow-md' : 'border-gray-100 bg-white hover:shadow-sm'
              }`}>
                <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => setExpandedSession(isExp ? null : s.session_id)}>
                  {/* Date column */}
                  <div className="shrink-0 text-center w-11">
                    <p className="text-[10px] font-bold text-gray-400">{d.weekday}</p>
                    <p className="text-lg font-bold text-gray-800 leading-tight">{d.day}</p>
                    <p className="text-[10px] text-gray-400">{d.month}</p>
                  </div>
                  <div className={`w-1 self-stretch rounded-full ${es === 'live' ? 'bg-green-500 animate-pulse' : sc.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{s.subject}</span>
                      <span className="text-xs text-gray-400">{fmtSessionTime24Local(s.scheduled_date, s.start_time)}</span>
                      <span className="text-[10px] text-gray-400">· {fmtDuration(s.duration_minutes)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{s.teacher_name ?? 'TBA'}</span>
                      {s.topic && <span className="text-xs text-gray-400 truncate max-w-[200px]">· {s.topic}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {es === 'live' && s.recording_status === 'recording' && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-red-500" /></span>
                        REC
                      </span>
                    )}
                    {es === 'ended' && s.recording_url && (
                      <a href={s.recording_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                        <Video className="h-3.5 w-3.5" /> Watch
                      </a>
                    )}
                    {s.attendance_status && (
                      <span className={`h-6 w-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        s.attendance_status === 'present'
                          ? s.is_late ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {s.is_late ? 'L' : s.attendance_status === 'present' ? '✓' : '✗'}
                      </span>
                    )}
                    {es === 'live' && (
                      <a href={`/join/${s.session_id}`} onClick={e => e.stopPropagation()} className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 shadow-sm animate-pulse">Join</a>
                    )}
                    {es === 'scheduled' && (() => {
                      const sStart = sessionToDate(s.scheduled_date, s.start_time);
                      if (Date.now() >= sStart.getTime() - 15 * 60 * 1000) return (
                        <a href={`/join/${s.session_id}`} onClick={e => e.stopPropagation()} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-sm">Lobby</a>
                      );
                      return null;
                    })()}
                    {es !== 'live' && <StatusBadge status={es} />}
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isExp && renderExpandedSession(s, es, fmtTime)}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Timeline View (grouped by subject) ── */
        <div className="space-y-5">
          {groupedBySubject.map(group => (
            <div key={group.subject}>
              {/* Subject header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`h-6 w-6 rounded-lg ${group.color.bg} flex items-center justify-center`}>
                  <BookOpen className="h-3 w-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${group.color.text}`}>{group.subject}</p>
                  {group.teacher && <p className="text-[10px] text-gray-400">{group.teacher.teacher_name}</p>}
                </div>
                <span className="text-[11px] font-medium text-gray-400">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Session cards */}
              <div className="space-y-2 pl-3 border-l-2 border-gray-100 ml-3">
                {group.sessions.map(s => {
                  const es = effectiveSessionStatus(s);
                  const isExp = expandedSession === s.session_id;
                  const d = fmtDate(s.scheduled_date);
                  return (
                    <div key={s.session_id} className={`rounded-2xl border overflow-hidden transition-all ${
                      es === 'live' ? 'border-green-300 bg-green-50/40 shadow-md ring-1 ring-green-200' :
                      isExp ? 'border-gray-200 shadow-md bg-white' : 'border-gray-100 bg-white hover:shadow-sm hover:border-gray-200'
                    }`}>
                      {/* Session row */}
                      <button className="flex w-full items-center gap-3 px-3 sm:px-4 py-3 text-left" onClick={() => setExpandedSession(isExp ? null : s.session_id)}>
                        {/* Date chip */}
                        <div className={`shrink-0 rounded-xl px-2.5 py-1.5 text-center ${es === 'live' ? 'bg-green-100' : 'bg-gray-50'}`}>
                          <p className="text-[9px] font-bold text-gray-400 leading-tight">{d.weekday}</p>
                          <p className={`text-base font-bold leading-tight ${es === 'live' ? 'text-green-700' : 'text-gray-800'}`}>{d.day}</p>
                          <p className="text-[9px] text-gray-400 leading-tight">{d.month}</p>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{fmtSessionTime24Local(s.scheduled_date, s.start_time)}</span>
                            <span className="text-xs text-gray-400">{fmtDuration(s.duration_minutes)}</span>
                            {s.topic && <span className="text-xs text-gray-500 truncate max-w-[140px] sm:max-w-[220px]">· {s.topic}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                            <span>{s.teacher_name}</span>
                            {s.teaching_minutes != null && s.prep_buffer_minutes != null && (
                              <span className="text-gray-300">({s.teaching_minutes}m + {s.prep_buffer_minutes}m prep)</span>
                            )}
                          </div>
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {es === 'live' && s.recording_status === 'recording' && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                              <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-red-500" /></span>
                              REC
                            </span>
                          )}
                          {es === 'ended' && s.recording_url && (
                            <a href={s.recording_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                              <Video className="h-3.5 w-3.5" /> Watch
                            </a>
                          )}
                          {s.attendance_status && (
                            <span className={`h-6 w-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                              s.attendance_status === 'present'
                                ? s.is_late ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {s.is_late ? 'L' : s.attendance_status === 'present' ? '✓' : '✗'}
                            </span>
                          )}
                          {es === 'live' && (
                            <a href={`/join/${s.session_id}`} onClick={e => e.stopPropagation()} className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 shadow-sm animate-pulse">Join</a>
                          )}
                          {es === 'scheduled' && (() => {
                            const sStart = sessionToDate(s.scheduled_date, s.start_time);
                            if (Date.now() >= sStart.getTime() - 15 * 60 * 1000) return (
                              <a href={`/join/${s.session_id}`} onClick={e => e.stopPropagation()} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-sm">Lobby</a>
                            );
                            return null;
                          })()}
                          {es !== 'live' && <StatusBadge status={es} />}
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExp && renderExpandedSession(s, es, fmtTime)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* refundModalUI — HIDDEN */}
    </div>
  );

  /* ── Shared expanded session detail ── */
  function renderExpandedSession(s: SessionData, es: string, fmtTimeFn: (iso: string) => string) {
    return (
      <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4 space-y-3">
        {/* Timing grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl bg-white border border-gray-100 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Scheduled</p>
            <p className="text-xs font-semibold text-gray-800 mt-0.5">{s.scheduled_date.slice(5)}</p>
            <p className="text-[10px] text-gray-500">{fmtSessionTime24Local(s.scheduled_date, s.start_time)}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-100 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Duration</p>
            <p className="text-xs font-semibold text-gray-800 mt-0.5">{fmtDuration(s.duration_minutes)}</p>
            {s.teaching_minutes != null && s.prep_buffer_minutes != null && (
              <p className="text-[10px] text-gray-400">{s.teaching_minutes}m class + {s.prep_buffer_minutes}m prep</p>
            )}
          </div>
          <div className="rounded-xl bg-white border border-gray-100 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Teacher</p>
            <p className="text-xs font-semibold text-gray-800 mt-0.5">{s.teacher_name ?? 'Not assigned'}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-100 p-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Your Attendance</p>
            {s.attendance_status
              ? <Badge label={s.is_late ? 'Late' : s.attendance_status === 'present' ? 'Present' : 'Absent'} variant={s.is_late ? 'warning' : s.attendance_status === 'present' ? 'success' : 'danger'} />
              : <span className="text-xs text-gray-400">—</span>}
          </div>
          {es === 'ended' && s.started_at && s.ended_at && (
            <div className="rounded-xl bg-white border border-gray-100 p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Actual Time</p>
              <p className="text-xs font-semibold text-gray-800 mt-0.5">{fmtTimeFn(s.started_at)} – {fmtTimeFn(s.ended_at)}</p>
              <p className="text-[10px] text-gray-400">{Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)}m</p>
            </div>
          )}
        </div>

        {/* Your stats */}
        {s.time_in_class_seconds != null && s.time_in_class_seconds > 0 && (
          <div className="flex items-center gap-5 rounded-xl bg-white border border-gray-100 px-4 py-2.5">
            <div>
              <p className="text-[10px] text-gray-400">Time in Class</p>
              <p className="text-sm font-bold text-gray-800">{Math.round(s.time_in_class_seconds / 60)}m</p>
            </div>
            {s.join_count != null && (
              <div>
                <p className="text-[10px] text-gray-400">Joins</p>
                <p className="text-sm font-bold text-gray-800">{s.join_count}</p>
              </div>
            )}
            {s.engagement_score != null && (
              <div>
                <p className="text-[10px] text-gray-400">Engagement</p>
                <p className="text-sm font-bold text-emerald-600">{s.engagement_score}%</p>
              </div>
            )}
          </div>
        )}

        {/* Portion & Remarks */}
        {(s.class_portion || s.class_remarks) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {s.class_portion && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <p className="text-[10px] text-emerald-600 font-semibold uppercase">Portion Covered</p>
                <p className="text-xs text-emerald-800 mt-1">{s.class_portion}</p>
              </div>
            )}
            {s.class_remarks && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                <p className="text-[10px] text-blue-600 font-semibold uppercase">Teacher Remarks</p>
                <p className="text-xs text-blue-800 mt-1">{s.class_remarks}</p>
              </div>
            )}
          </div>
        )}

        {s.topic && <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Topic:</span> {s.topic}</p>}
        {s.notes && <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Notes:</span> {s.notes}</p>}
        {es === 'cancelled' && s.cancel_reason && <Alert variant="error" message={`Cancelled: ${s.cancel_reason}`} />}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {es === 'ended' && s.recording_url && (
            <a href={s.recording_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-all">
              <Video className="h-3.5 w-3.5" /> Watch Recording <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {es === 'ended' && <SessionMaterialsButton sessionId={s.session_id} />}
          {es === 'live' && (
            <a href={`/join/${s.session_id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> Join Live Session
            </a>
          )}
          {es === 'scheduled' && (() => {
            const sessionStart = sessionToDate(s.scheduled_date, s.start_time);
            const localTime = fmtSessionTime24Local(s.scheduled_date, s.start_time);
            const lobbyIsOpen = Date.now() >= sessionStart.getTime() - 15 * 60 * 1000;
            return lobbyIsOpen ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> Lobby is open — class starts at <strong>{localTime}</strong>
                </div>
                <a href={`/join/${s.session_id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-sm">
                  <Timer className="h-3.5 w-3.5" /> Enter Lobby
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                <Clock className="h-3.5 w-3.5 shrink-0" /> Lobby opens 15 min before class
              </div>
            );
          })()}
        </div>

        {/* Refund / Reschedule for absent + paid sessions — HIDDEN */}
        {false && es === 'ended' && s.attendance_status === 'absent' && s.payment_status === 'paid' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            {s.refund_request_id ? (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  s.refund_request_status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : s.refund_request_status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {s.refund_request_status === 'pending' ? <Clock className="h-3 w-3" /> : s.refund_request_status === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {s.refund_request_type === 'refund' ? 'Refund' : 'Reschedule'} {s.refund_request_status}
                </span>
                {s.payment_amount_paise && (
                  <span className="text-xs text-gray-500">₹{((s.payment_amount_paise ?? 0) / 100).toFixed(0)}</span>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-amber-700 font-medium">
                  You were absent for this paid session (₹{s.payment_amount_paise ? ((s.payment_amount_paise ?? 0) / 100).toFixed(0) : '—'}). You can request a refund or reschedule.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setRefundModal({ sessionId: s.session_id, type: 'refund' }); setRefundReason(''); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
                  >
                    <DollarSign className="h-3.5 w-3.5" /> Request Refund
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRefundModal({ sessionId: s.session_id, type: 'reschedule' }); setRefundReason(''); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Request Reschedule
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
}

// ── Attendance Tab ─────────────────────────────────────────────

function AttendanceTab({
  records, summary, bySubject, loading, onRefresh,
}: {
  records: AttendanceRecord[];
  summary: AttendanceSummaryData | null;
  bySubject: SubjectAttendance[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus,  setFilterStatus]  = useState<'' | 'present' | 'absent' | 'late'>('');

  const subjects = Array.from(new Set(records.map(r => r.subject))).filter(Boolean).sort();

  const subjectFiltered = (r: AttendanceRecord) => !filterSubject || r.subject === filterSubject;
  const statusMatch = (r: AttendanceRecord, s: '' | 'present' | 'absent' | 'late') => {
    if (s === '') return true;
    if (s === 'late')    return r.is_late === true;
    if (s === 'present') return r.status === 'present';
    if (s === 'absent')  return r.status === 'absent' || (!r.status && r.room_status === 'ended');
    return true;
  };

  const filtered = records
    .filter(subjectFiltered)
    .filter(r => statusMatch(r, filterStatus));

  // Per-tab counts (respect subject filter but not status filter)
  const tabCounts: Record<'' | 'present' | 'absent' | 'late', number> = {
    '':       records.filter(subjectFiltered).length,
    present:  records.filter(subjectFiltered).filter(r => statusMatch(r, 'present')).length,
    absent:   records.filter(subjectFiltered).filter(r => statusMatch(r, 'absent')).length,
    late:     records.filter(subjectFiltered).filter(r => statusMatch(r, 'late')).length,
  };

  const attColor  = (rate: number) => rate >= 75 ? 'text-green-700' : rate >= 50 ? 'text-amber-700' : 'text-red-600';
  const attBar    = (rate: number) => rate >= 75 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {/* Attendance Rate */}
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Attendance Rate</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${attColor(summary.attendance_rate)}`}>{summary.attendance_rate}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${attBar(summary.attendance_rate)}`} style={{ width: `${summary.attendance_rate}%` }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{summary.present}/{summary.total_sessions} sessions attended</p>
          </div>
          <StatCard icon={BookOpen}      label="Total Sessions" value={summary.total_sessions} />
          <StatCard icon={CheckCircle2}  label="On Time"       value={summary.present}         variant="success" />
          <StatCard icon={XCircle}       label="Absent"        value={summary.absent}           variant="danger" />
        </div>
      )}

      {/* Subject-wise breakdown table */}
      {bySubject.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5" /> Subject-wise Attendance
          </h3>
          <div className="space-y-2">
            {bySubject.map(sub => (
              <div key={sub.subject} className="flex items-center gap-2 sm:gap-3">
                <div className="w-20 sm:w-28 shrink-0">
                  <p className="text-[11px] sm:text-xs font-medium text-gray-700 truncate">{sub.subject}</p>
                  <p className="text-[10px] text-gray-400">{sub.present}/{sub.total}</p>
                </div>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${attBar(sub.rate)}`} style={{ width: `${sub.rate}%` }} />
                </div>
                <span className={`w-10 text-right text-xs font-bold shrink-0 ${attColor(sub.rate)}`}>{sub.rate}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Classroom Behaviour Summary (from media tracking) ── */}
      {(() => {
        const presentRecords = records.filter(r => r.status === 'present');
        const totalMicOff = presentRecords.reduce((s, r) => s + (r.mic_off_count || 0), 0);
        const totalCamOff = presentRecords.reduce((s, r) => s + (r.camera_off_count || 0), 0);
        const totalLeaveReq = presentRecords.reduce((s, r) => s + (r.leave_request_count || 0), 0);
        const attentionScores = presentRecords.filter(r => r.attention_avg !== null).map(r => r.attention_avg as number);
        const avgAttention = attentionScores.length > 0
          ? Math.round(attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length)
          : null;
        if (totalMicOff === 0 && totalCamOff === 0 && totalLeaveReq === 0 && avgAttention === null) return null;
        return (
          <Card className="p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Classroom Behaviour
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {totalMicOff > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 sm:p-3 text-center">
                  <p className="text-base sm:text-lg font-bold text-gray-700">{totalMicOff}</p>
                  <p className="text-[10px] text-gray-400">Mic Off</p>
                </div>
              )}
              {totalCamOff > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 sm:p-3 text-center">
                  <p className="text-base sm:text-lg font-bold text-gray-700">{totalCamOff}</p>
                  <p className="text-[10px] text-gray-400">Cam Off</p>
                </div>
              )}
              {totalLeaveReq > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 sm:p-3 text-center">
                  <p className="text-base sm:text-lg font-bold text-gray-700">{totalLeaveReq}</p>
                  <p className="text-[10px] text-gray-400">Leave Reqs</p>
                </div>
              )}
              {avgAttention !== null && (
                <div className={`rounded-lg border p-2.5 sm:p-3 text-center ${
                  avgAttention >= 70 ? 'border-green-200 bg-green-50' : avgAttention >= 40 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
                }`}>
                  <p className={`text-base sm:text-lg font-bold ${avgAttention >= 70 ? 'text-green-700' : avgAttention >= 40 ? 'text-amber-700' : 'text-red-600'}`}>{avgAttention}%</p>
                  <p className="text-[10px] text-gray-400">Avg Attention</p>
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {subjects.length > 1 && (
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="flex gap-2 flex-wrap">
          {(['', 'present', 'absent', 'late'] as const).map(f => (
            <button
              key={f || 'all'}
              onClick={() => setFilterStatus(f)}
              className={`rounded-lg px-3 py-2.5 sm:py-1.5 text-xs font-medium capitalize transition-colors ${
                filterStatus === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f || 'All'} ({tabCounts[f]})
            </button>
          ))}
        </div>
        {filtered.length !== records.length && (
          <span className="text-xs text-gray-400">{filtered.length} shown</span>
        )}
      </div>

      {/* Records list */}
      {loading && records.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="No attendance records yet. Records appear once sessions have been held." />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const isPresent = r.status === 'present';
            const isAbsent  = r.status === 'absent' || (!r.status && r.room_status === 'ended');
            const isLate    = r.is_late === true;
            const timeMins  = r.time_in_class_seconds ? Math.round(r.time_in_class_seconds / 60) : null;
            return (
              <div
                key={r.room_id + r.scheduled_start}
                className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                  isPresent
                    ? isLate ? 'border-amber-200 bg-amber-50/30' : 'border-green-200 bg-green-50/30'
                    : isAbsent ? 'border-red-200 bg-red-50/20' : 'border-gray-100 bg-white'
                }`}
              >
                {/* Status icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isPresent ? (isLate ? 'bg-amber-100' : 'bg-green-100') : isAbsent ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {isPresent
                    ? isLate ? <Timer className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : isAbsent ? <XCircle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-gray-400" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.room_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span>{r.subject}</span>
                    {r.teacher_name && <span>{r.teacher_name}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{fmtSmartDateLocal(r.scheduled_start)}
                    </span>
                    {timeMins !== null && isPresent && (
                      <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{timeMins}m attended</span>
                    )}
                  </div>
                  {/* Media tracking row */}
                  {isPresent && (r.mic_off_count > 0 || r.camera_off_count > 0 || r.leave_request_count > 0 || r.attention_avg !== null) && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
                      {r.mic_off_count > 0 && (
                        <span title="Mic muted count" className="hidden sm:inline">🎤×{r.mic_off_count}</span>
                      )}
                      {r.camera_off_count > 0 && (
                        <span title="Camera off count" className="hidden sm:inline">📷×{r.camera_off_count}</span>
                      )}
                      {r.leave_request_count > 0 && (
                        <span title="Leave requests">🚪×{r.leave_request_count}</span>
                      )}
                      {r.attention_avg !== null && (
                        <span title="Attention score" className={`font-medium ${r.attention_avg >= 70 ? 'text-green-600' : r.attention_avg >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                          Att: {r.attention_avg}%
                        </span>
                      )}
                      {r.last_leave_at && (
                        <span title="Exit time" className="hidden sm:inline">⏱️ {new Date(r.last_leave_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Badge */}
                <div className="shrink-0">
                  {isPresent ? (
                    <Badge label={isLate ? 'Late' : 'On Time'} variant={isLate ? 'warning' : 'success'} />
                  ) : isAbsent ? (
                    <Badge label="Absent" variant="danger" />
                  ) : (
                    <StatusBadge status={r.room_status} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StudentMaterialsTab ────────────────────────────────────────

const STUDENT_MATERIAL_TYPE_STYLE: Record<string, string> = {
  notes:      'bg-blue-50   text-blue-700   border-blue-200',
  assignment: 'bg-amber-50  text-amber-700  border-amber-200',
  resource:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  video:      'bg-purple-50 text-purple-700  border-purple-200',
  other:      'bg-gray-50   text-gray-600   border-gray-200',
};

function fmtBytesStudent(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function StudentMaterialsTab({
  materials, loading, onRefresh,
}: {
  materials: TeachingMaterial[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filterBatch, setFilterBatch] = useState('');
  const [filterType, setFilterType]   = useState('');

  const batches = Array.from(
    new Map(
      materials
        .flatMap(m => (m.batches ?? []).map(b => [b.batch_id, { value: b.batch_id, label: b.batch_name }] as const))
    ).values()
  );

  const types = Array.from(new Set(materials.map(m => m.material_type))).sort();

  const filtered = materials
    .filter(m => !filterBatch || (m.batches ?? []).some(b => b.batch_id === filterBatch))
    .filter(m => !filterType  || m.material_type === filterType);

  return (
    <div className="space-y-5">

      {/* Filters */}
      {materials.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All batches</option>
            {batches.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} message="No materials available for your batches yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {filtered.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${STUDENT_MATERIAL_TYPE_STYLE[m.material_type] ?? STUDENT_MATERIAL_TYPE_STYLE.other}`}>
                      {m.material_type}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.subject}</span>
                  </div>
                  {/* Batch pills (multiple) */}
                  {m.batches && m.batches.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {m.batches.map(b => (
                        <span key={b.batch_id} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                          {b.batch_name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {m.file_size && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fmtBytesStudent(m.file_size)}</span>
                  )}
                </div>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {m.file_name || 'Open / Download'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sessions Tab ───────────────────────────────────────────────

function SessionsTab({
  sessions, todayStats, loading, onRefresh, videoRequests, requestVideoAccess, requestingVideo,
}: {
  sessions: SessionData[];
  todayStats: SessionTodayStats | null;
  loading: boolean;
  onRefresh: () => void;
  videoRequests: Map<string, VideoAccessRequest>;
  requestVideoAccess: (roomId: string) => void;
  requestingVideo: string | null;
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<SessionFilterKey>('all');
  const [filterBatch, setFilterBatch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const batchList = Array.from(
    new Map(sessions.map(s => [s.batch_id, { id: s.batch_id, name: s.batch_name }])).values()
  );

  const q = search.toLowerCase();
  const filtered = sessions
    .filter(s => !q || s.subject.toLowerCase().includes(q) || s.batch_name.toLowerCase().includes(q) || (s.topic?.toLowerCase().includes(q)))
    .filter(s => filterStatus === 'all' || effectiveSessionStatus(s) === filterStatus)
    .filter(s => !filterBatch || s.batch_id === filterBatch);

  const counts: Record<SessionFilterKey, number> = {
    all: sessions.length,
    scheduled: sessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length,
    live: sessions.filter(s => effectiveSessionStatus(s) === 'live').length,
    ended: sessions.filter(s => effectiveSessionStatus(s) === 'ended').length,
    cancelled: sessions.filter(s => effectiveSessionStatus(s) === 'cancelled').length,
  };

  const attColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-500';
    if (status === 'present') return 'bg-green-100 text-green-700';
    if (status === 'absent') return 'bg-red-100 text-red-600';
    return 'bg-gray-100 text-gray-500';
  };

  // Compute today stats client-side using effectiveSessionStatus for accurate counts
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const todaySessions = sessions.filter(s => s.scheduled_date.slice(0, 10) === todayStr);
  const clientTodayStats = todaySessions.length > 0 ? {
    total: todaySessions.length,
    live: todaySessions.filter(s => effectiveSessionStatus(s) === 'live').length,
    upcoming: todaySessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length,
    completed: todaySessions.filter(s => effectiveSessionStatus(s) === 'ended').length,
    cancelled: todaySessions.filter(s => effectiveSessionStatus(s) === 'cancelled').length,
  } : todayStats;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Today Stats */}
      {clientTodayStats && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-5">
          <StatCard icon={ListChecks} label="Today Total" value={clientTodayStats.total} />
          <StatCard icon={Radio} label="Live" value={clientTodayStats.live} variant="success" />
          <StatCard icon={Clock} label="Upcoming" value={clientTodayStats.upcoming} variant="info" />
          <StatCard icon={CheckCircle2} label="Completed" value={clientTodayStats.completed} variant="default" />
          <StatCard icon={XCircle} label="Cancelled" value={clientTodayStats.cancelled} variant="danger" />
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search sessions…" className="sm:w-64" />
        {batchList.length > 1 && (
          <select
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All Batches</option>
            {batchList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-2">
          {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as SessionFilterKey[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 sm:py-1.5 text-xs font-medium capitalize transition-colors ${
                filterStatus === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${filterStatus === f ? 'bg-white/20' : 'bg-white'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Session Cards */}
      {loading && sessions.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ListChecks} message={search ? 'No sessions match your search' : 'No sessions found'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isExpanded = expandedId === s.session_id;
            const es = effectiveSessionStatus(s);
            const statusIcon = {
              live: <Radio className="h-5 w-5 text-green-600" />,
              scheduled: <Clock className="h-5 w-5 text-teal-600" />,
              ended: <CheckCircle2 className="h-5 w-5 text-gray-400" />,
              cancelled: <XCircle className="h-5 w-5 text-red-500" />,
            }[es] ?? <Clock className="h-5 w-5 text-gray-400" />;
            const statusBg = {
              live: 'bg-green-100', scheduled: 'bg-teal-50', ended: 'bg-gray-100', cancelled: 'bg-red-50',
            }[es] ?? 'bg-gray-100';

            return (
              <Card key={s.session_id} className={`overflow-hidden transition-colors ${isExpanded ? 'ring-1 ring-emerald-300' : ''}`}>
                <button
                  className="flex w-full items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : s.session_id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusBg}`}>
                    {statusIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{s.subject}</p>
                      {s.topic && <span className="text-xs text-gray-500">— {s.topic}</span>}
                      <span className="sm:hidden shrink-0"><StatusBadge status={es} /></span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-500">
                      <span>{s.batch_name}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {s.scheduled_date} {fmtSessionTime24Local(s.scheduled_date, s.start_time)}
                      </span>
                      <span className="sm:hidden">{fmtDuration(s.duration_minutes)}</span>
                      {s.teacher_name && <span className="hidden sm:flex items-center gap-1"><Users className="h-3 w-3" />{s.teacher_name}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <StatusBadge status={es} />
                      <p className="text-xs text-gray-400">{fmtDuration(s.duration_minutes)}</p>
                    </div>
                    {s.attendance_status && (
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${attColor(s.attendance_status)}`}>
                        {s.attendance_status === 'present' ? 'On Time' : 'Absent'}
                      </span>
                    )}
                    {es === 'live' && (
                      <a
                        href={`/join/${s.session_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg bg-green-600 px-4 py-2.5 sm:px-3 sm:py-1.5 text-xs font-bold text-white hover:bg-green-700 shrink-0 animate-pulse"
                      >
                        Join Now
                      </a>
                    )}
                    {es === 'scheduled' && (() => {
                      const sStart = sessionToDate(s.scheduled_date, s.start_time);
                      const lobbyMs = sStart.getTime() - 15 * 60 * 1000;
                      if (Date.now() >= lobbyMs) return (
                        <a
                          href={`/join/${s.session_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg bg-teal-600 px-4 py-2.5 sm:px-3 sm:py-1.5 text-xs font-bold text-white hover:bg-teal-700 shrink-0"
                        >
                          Enter Lobby
                        </a>
                      );
                      return null;
                    })()}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                    <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-2.5 text-sm sm:grid-cols-4 sm:gap-3">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Date & Time</p>
                        <p className="text-gray-800">{s.scheduled_date} {fmtSessionTime24Local(s.scheduled_date, s.start_time)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Duration</p>
                        <p className="text-gray-800">{fmtDuration(s.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Teacher</p>
                        <p className="text-gray-800">{s.teacher_name ?? 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Attendance</p>
                        {s.attendance_status ? (
                          <Badge
                            label={s.is_late ? 'Late' : s.attendance_status === 'present' ? 'On Time' : 'Absent'}
                            variant={s.is_late ? 'warning' : s.attendance_status === 'present' ? 'success' : 'danger'}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </div>
                    </div>

                    {/* Time in class */}
                    {s.time_in_class_seconds != null && s.time_in_class_seconds > 0 && (
                      <div className="flex items-center gap-4 rounded-lg bg-white border border-gray-100 px-3 py-2">
                        <div>
                          <p className="text-[10px] text-gray-400">Time in Session</p>
                          <p className="text-sm font-bold text-gray-800">{Math.round(s.time_in_class_seconds / 60)}m</p>
                        </div>
                        {s.join_count != null && (
                          <div>
                            <p className="text-[10px] text-gray-400">Joins</p>
                            <p className="text-sm font-bold text-gray-800">{s.join_count}</p>
                          </div>
                        )}
                        {s.engagement_score != null && (
                          <div>
                            <p className="text-[10px] text-gray-400">Engagement</p>
                            <p className="text-sm font-bold text-gray-800">{s.engagement_score}%</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Class Portion & Remarks */}
                    {(s.class_portion || s.class_remarks) && (
                      <div className="space-y-2">
                        {s.class_portion && (
                          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Session Portion Covered</p>
                            <p className="text-sm text-emerald-800 mt-0.5">{s.class_portion}</p>
                          </div>
                        )}
                        {s.class_remarks && (
                          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                            <p className="text-[10px] text-blue-600 font-semibold uppercase">Teacher Remarks</p>
                            <p className="text-sm text-blue-800 mt-0.5">{s.class_remarks}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Topic & Notes */}
                    {s.topic && (
                      <p className="text-xs text-gray-500"><span className="font-semibold">Topic:</span> {s.topic}</p>
                    )}
                    {s.notes && <Alert variant="info" message={s.notes} />}

                    {es === 'cancelled' && s.cancel_reason && (
                      <Alert variant="error" message={`Cancelled: ${s.cancel_reason}`} />
                    )}
                    {/* Recording */}
                    {es === 'ended' && s.recording_url && (
                      <a href={s.recording_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
                        <Video className="h-4 w-4" /> Watch Recording <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {/* Session Materials */}
                    {es === 'ended' && (
                      <SessionMaterialsButton sessionId={s.session_id} />
                    )}
                    {es === 'live' && (
                      <a
                        href={`/join/${s.session_id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700"
                      >
                        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        Join Live Session
                      </a>
                    )}
                    {es === 'scheduled' && (() => {
                      const sessionStart = sessionToDate(s.scheduled_date, s.start_time);
                      const localTime = fmtSessionTime24Local(s.scheduled_date, s.start_time);
                      const lobbyOpenMs = sessionStart.getTime() - 15 * 60 * 1000;
                      const hasStarted = Date.now() >= sessionStart.getTime();
                      const lobbyIsOpen = Date.now() >= lobbyOpenMs;
                      return hasStarted ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>Class was scheduled at <strong>{localTime}</strong> — waiting for teacher to go live</span>
                          </div>
                          <a
                            href={`/join/${s.session_id}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700"
                          >
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                            Enter Lobby
                          </a>
                        </div>
                      ) : lobbyIsOpen ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>Lobby is open — class starts at <strong>{localTime}</strong></span>
                          </div>
                          <a
                            href={`/join/${s.session_id}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
                          >
                            <Timer className="h-4 w-4" />
                            Enter Lobby
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>Lobby opens 15 min before class at <strong>{localTime}</strong></span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Exams Tab (Session Exams Only) ─────────────────────────────

interface SessionExamResult {
  id: string;
  topic_id: string;
  session_id: string;
  room_id: string;
  subject: string;
  topic_title: string;
  total_questions: number;
  answered: number;
  skipped: number;
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
  time_taken_seconds: number;
  tab_switch_count: number;
  auto_submitted: boolean;
  completed_at: string;
  teacher_name: string;
  paper_type: string;
  category: string;
  answers: Array<{ question_id: string; question_text: string; options: string[]; selected_option: number | null; correct_answer: number; is_correct: boolean; marks: number }>;
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  'Previous Year Question Paper': 'Previous Year',
  'Model Question Paper': 'Model Exam',
  'Onam Exam': 'Onam Exam',
  'Christmas Exam': 'Christmas Exam',
  'Annual Exam': 'Annual Exam',
  'Quarterly Exam': 'Quarterly',
  'Half-Yearly Exam': 'Half-Yearly',
  'Unit Test': 'Unit Test',
  'Practice Paper': 'Practice',
  'Sample Paper': 'Sample',
  'Other': 'Other',
};

function ExamsTab() {
  const [sessionExams, setSessionExams] = useState<SessionExamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchSessionExams = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/student/session-exams')
      .then(r => r.json())
      .then(data => {
        if (data.success) setSessionExams(data.data?.results ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSessionExams(); }, [fetchSessionExams]);

  // Derive unique subjects and exam types from data
  const subjects = useMemo(() => {
    const set = new Set(sessionExams.map(e => e.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [sessionExams]);

  const examTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of sessionExams) {
      if (e.category === 'topic') set.add('topic');
      else if (e.paper_type) set.add(e.paper_type);
      else set.add('topic');
    }
    return Array.from(set).sort();
  }, [sessionExams]);

  // Filter exams
  const filtered = useMemo(() => {
    return sessionExams.filter(e => {
      if (selectedSubject !== 'all' && e.subject !== selectedSubject) return false;
      if (selectedType !== 'all') {
        if (selectedType === 'topic') {
          if (e.category !== 'topic' && e.paper_type) return false;
        } else {
          if (e.paper_type !== selectedType) return false;
        }
      }
      return true;
    });
  }, [sessionExams, selectedSubject, selectedType]);

  // Summary stats from filtered exams
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((s, e) => s + e.percentage, 0) / filtered.length)
    : null;
  const passCount = filtered.filter(e => e.percentage >= 40).length;

  const pctColor = (p: number) => p >= 75 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
  const pctBg = (p: number) => p >= 75 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total Exams" value={filtered.length} />
        <StatCard icon={Trophy} label="Passed" value={passCount} variant="success" />
        <StatCard icon={BarChart2} label="Avg Score" value={avgScore != null ? `${avgScore}%` : '—'}
          variant={avgScore != null ? (avgScore >= 75 ? 'success' : avgScore >= 50 ? 'warning' : 'danger') : 'default'}
        />
        <StatCard icon={CheckCircle2} label="Pass Rate" value={filtered.length > 0 ? `${Math.round((passCount / filtered.length) * 100)}%` : '—'}
          variant={filtered.length > 0 ? (passCount === filtered.length ? 'success' : 'warning') : 'default'}
        />
      </div>

      {/* Filters */}
      {sessionExams.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Subject Filter */}
          {subjects.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium shrink-0">Subject:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedSubject('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    selectedSubject === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >All</button>
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSubject(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      selectedSubject === s ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Exam Type Filter */}
          {examTypes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium shrink-0">Type:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedType('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    selectedType === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >All</button>
                {examTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      selectedType === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{t === 'topic' ? 'Topic Exam' : (EXAM_TYPE_LABELS[t] || t)}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Exam List */}
      {loading && sessionExams.length === 0 ? (
        <LoadingState />
      ) : sessionExams.length === 0 ? (
        <EmptyState icon={Radio} message="No session exams taken yet" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Radio} message="No exams match the selected filters" />
      ) : (
        <div className="space-y-3">
          {filtered.map(se => {
            const passed = se.percentage >= 40;
            const isExpanded = expandedSessionId === se.id;
            const answers = Array.isArray(se.answers) ? se.answers : [];
            const typeLabel = se.category === 'topic' || !se.paper_type
              ? null
              : (EXAM_TYPE_LABELS[se.paper_type] || se.paper_type);
            return (
              <div key={se.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedSessionId(isExpanded ? null : se.id)}
                  className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-gray-50 transition"
                >
                  <div className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <span className={`text-lg font-bold ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {se.grade_letter || '—'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{se.topic_title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {se.subject} · {se.teacher_name ? `by ${se.teacher_name}` : 'Live Session'}
                      {typeLabel && <span className="ml-1.5 inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">{typeLabel}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-lg font-bold ${pctColor(se.percentage)}`}>{Math.round(se.percentage)}%</p>
                    <p className="text-[10px] text-gray-400">{se.score}/{se.total_marks}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Score Bar */}
                <div className="px-4 sm:px-5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pctBg(se.percentage)}`}
                        style={{ width: `${Math.min(se.percentage, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {se.completed_at ? new Date(se.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5 space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-xl bg-white border border-gray-100 p-3 text-center">
                        <p className="text-lg font-bold text-gray-900">{se.answered}/{se.total_questions}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Answered</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-100 p-3 text-center">
                        <p className="text-lg font-bold text-amber-600">{se.skipped}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Skipped</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-100 p-3 text-center">
                        <p className="text-lg font-bold text-gray-900">
                          {se.time_taken_seconds ? `${Math.floor(se.time_taken_seconds / 60)}m ${se.time_taken_seconds % 60}s` : '—'}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Time Taken</p>
                      </div>
                      <div className="rounded-xl bg-white border border-gray-100 p-3 text-center">
                        <p className="text-lg font-bold text-gray-900">{se.tab_switch_count || 0}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Tab Switches</p>
                      </div>
                    </div>

                    {se.auto_submitted && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs text-amber-700">Auto-submitted (time expired or violations)</span>
                      </div>
                    )}

                    {/* Question Review */}
                    {answers.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                          Question Review ({answers.length})
                        </h4>
                        <div className="space-y-2">
                          {answers.map((a, idx) => (
                            <SessionQuestionCard key={a.question_id || idx} q={a} index={idx} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Session Exam Question Card ─────────────────────────────────

function SessionQuestionCard({ q, index }: { q: SessionExamResult['answers'][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const options = Array.isArray(q.options) ? q.options : [];
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className={`rounded-xl border overflow-hidden ${
      q.is_correct ? 'border-emerald-200 bg-emerald-50/30'
      : q.selected_option == null ? 'border-gray-200 bg-white'
      : 'border-red-200 bg-red-50/30'
    }`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <span className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
          q.is_correct ? 'bg-emerald-100 text-emerald-700'
          : q.selected_option == null ? 'bg-gray-100 text-gray-500'
          : 'bg-red-100 text-red-700'
        }`}>{index + 1}</span>
        <p className="flex-1 text-xs sm:text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
        <div className="shrink-0 flex items-center gap-2">
          {q.is_correct && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {!q.is_correct && q.selected_option != null && <XCircle className="h-4 w-4 text-red-500" />}
          {q.selected_option == null && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Skipped</span>}
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && options.length > 0 && (
        <div className="px-3.5 pb-3.5 pt-0 space-y-1.5">
          {options.map((opt, oi) => {
            const isCorrect = oi === q.correct_answer;
            const isSelected = oi === q.selected_option;
            return (
              <div key={oi} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs sm:text-sm ${
                isCorrect && isSelected ? 'border-emerald-300 bg-emerald-50'
                : isCorrect ? 'border-emerald-200 bg-emerald-50/50'
                : isSelected ? 'border-red-300 bg-red-50'
                : 'border-gray-100 bg-white'
              }`}>
                <span className={`shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  isCorrect ? 'bg-emerald-100 text-emerald-700'
                  : isSelected ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>{optionLabels[oi] || oi + 1}</span>
                <span className={`flex-1 ${isCorrect ? 'text-emerald-800 font-medium' : isSelected ? 'text-red-800' : 'text-gray-700'}`}>
                  {opt}
                </span>
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Fees Tab ───────────────────────────────────────────────────

function printReceiptWindow(r: ReceiptData, studentName: string, platformName: string) {
  const fmtAmount = (paise: number) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(rupees);
  };
  const paidDate = new Date(r.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const paidTime = new Date(r.paid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const method = r.payment_method ? r.payment_method.charAt(0).toUpperCase() + r.payment_method.slice(1).replace(/_/g, ' ') : 'Online';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${r.receipt_number}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px}
  .page{background:#fff;width:100%;max-width:440px;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#0d9488 0%,#059669 100%);padding:28px 28px 24px}
  .header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand-icon{width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;backdrop-filter:blur(4px)}
  .brand-name{font-size:15px;font-weight:800;color:#fff;letter-spacing:-.2px}
  .brand-sub{font-size:10px;color:rgba(255,255,255,.7);margin-top:1px}
  .stamp{background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.4);border-radius:8px;padding:4px 12px;font-size:11px;font-weight:700;color:#fff;letter-spacing:.05em;text-transform:uppercase}
  .amount-section{text-align:center;padding:8px 0 4px}
  .amount-label{font-size:11px;color:rgba(255,255,255,.7);font-weight:500;text-transform:uppercase;letter-spacing:.08em}
  .amount-value{font-size:42px;font-weight:900;color:#fff;letter-spacing:-1px;margin-top:4px;line-height:1}
  .amount-sub{font-size:12px;color:rgba(255,255,255,.65);margin-top:6px}
  .body{padding:24px 28px}
  .doc-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}
  .row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border-bottom:none}
  .row-label{font-size:13px;color:#94a3b8;font-weight:500}
  .row-value{font-size:13px;font-weight:600;color:#0f172a;text-align:right;max-width:60%}
  .badge-paid{display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
  .divider{border:none;border-top:2px dashed #e2e8f0;margin:20px 0}
  .footer{text-align:center;padding:0 28px 24px}
  .footer-msg{font-size:13px;color:#64748b;font-weight:500;margin-bottom:6px}
  .footer-sub{font-size:11px;color:#94a3b8}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div class="brand">
        <div class="brand-icon">S</div>
        <div><div class="brand-name">${platformName}</div><div class="brand-sub">Learning Academy</div></div>
      </div>
      <div class="stamp">&#10003; PAID</div>
    </div>
    <div class="amount-section">
      <div class="amount-label">Amount Paid</div>
      <div class="amount-value">${fmtAmount(r.amount_paise)}</div>
      <div class="amount-sub">${r.invoice_description || 'Fee Payment'}${r.billing_period ? ' &middot; ' + r.billing_period : ''}</div>
    </div>
  </div>
  <div class="body">
    <div class="doc-title">Payment Receipt</div>
    <div class="row"><span class="row-label">Receipt No.</span><span class="row-value" style="font-family:monospace;font-size:12px">${r.receipt_number}</span></div>
    <div class="row"><span class="row-label">Student</span><span class="row-value">${studentName}</span></div>
    <div class="row"><span class="row-label">Date</span><span class="row-value">${paidDate}, ${paidTime}</span></div>
    <div class="row"><span class="row-label">Payment Method</span><span class="row-value">${method}</span></div>
    <div class="row"><span class="row-label">Status</span><span class="row-value"><span class="badge-paid">&#10003; Paid</span></span></div>
    <hr class="divider">
  </div>
  <div class="footer">
    <div class="footer-msg">Thank you for your payment!</div>
    <div class="footer-sub">This is a computer-generated receipt &bull; stibelearning.online</div>
  </div>
</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script>
</body></html>`;
  const w = window.open('', '_blank', 'width=520,height=740');
  if (w) { w.document.write(html); w.document.close(); }
}

function printInvoiceWindow(inv: InvoiceData, studentName: string, platformName: string) {
  const fmtAmount = (paise: number) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(rupees);
  };
  const createdDate = new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const paidDate = inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const statusColor = inv.status === 'paid' ? '#15803d' : inv.status === 'overdue' ? '#dc2626' : '#d97706';
  const statusBg = inv.status === 'paid' ? '#dcfce7' : inv.status === 'overdue' ? '#fee2e2' : '#fef3c7';
  const statusBorder = inv.status === 'paid' ? '#bbf7d0' : inv.status === 'overdue' ? '#fecaca' : '#fde68a';
  const statusLabel = inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
  const headerBg = inv.status === 'paid'
    ? 'linear-gradient(135deg,#0d9488 0%,#059669 100%)'
    : inv.status === 'overdue'
    ? 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)'
    : 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${inv.invoice_number}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter','Segoe UI',sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px}
  .page{background:#fff;width:100%;max-width:440px;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08)}
  .header{background:${headerBg};padding:28px 28px 24px}
  .header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand-icon{width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;backdrop-filter:blur(4px)}
  .brand-name{font-size:15px;font-weight:800;color:#fff;letter-spacing:-.2px}
  .brand-sub{font-size:10px;color:rgba(255,255,255,.7);margin-top:1px}
  .status-chip{background:rgba(255,255,255,.2);border:1.5px solid rgba(255,255,255,.45);border-radius:8px;padding:4px 12px;font-size:11px;font-weight:700;color:#fff;letter-spacing:.05em;text-transform:uppercase;backdrop-filter:blur(4px)}
  .amount-section{text-align:center;padding:8px 0 4px}
  .amount-label{font-size:11px;color:rgba(255,255,255,.7);font-weight:500;text-transform:uppercase;letter-spacing:.08em}
  .amount-value{font-size:42px;font-weight:900;color:#fff;letter-spacing:-1px;margin-top:4px;line-height:1}
  .amount-sub{font-size:12px;color:rgba(255,255,255,.65);margin-top:6px}
  .body{padding:24px 28px}
  .section-title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px}
  .row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border-bottom:none}
  .row-label{font-size:13px;color:#94a3b8;font-weight:500}
  .row-value{font-size:13px;font-weight:600;color:#0f172a;text-align:right;max-width:60%}
  .mono{font-family:monospace;font-size:12px}
  .paid-stamp{display:inline-flex;align-items:center;gap:5px;background:${statusBg};color:${statusColor};border:1.5px solid ${statusBorder};padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.04em}
  .divider{border:none;border-top:2px dashed #e2e8f0;margin:20px 0}
  .footer{text-align:center;padding:0 28px 24px}
  .footer-line1{font-size:12px;color:#64748b;font-weight:500}
  .footer-line2{font-size:11px;color:#94a3b8;margin-top:4px}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div class="brand">
        <div class="brand-icon">S</div>
        <div><div class="brand-name">${platformName}</div><div class="brand-sub">Learning Academy</div></div>
      </div>
      <div class="status-chip">${statusLabel}</div>
    </div>
    <div class="amount-section">
      <div class="amount-label">Invoice Amount</div>
      <div class="amount-value">${fmtAmount(inv.amount_paise)}</div>
      <div class="amount-sub">${inv.description || 'Fee Invoice'}${inv.billing_period ? ' &middot; ' + inv.billing_period : ''}</div>
    </div>
  </div>
  <div class="body">
    <div class="section-title">Invoice Details</div>
    <div class="row"><span class="row-label">Invoice No.</span><span class="row-value mono">${inv.invoice_number}</span></div>
    <div class="row"><span class="row-label">Student</span><span class="row-value">${studentName}</span></div>
    <div class="row"><span class="row-label">Issued On</span><span class="row-value">${createdDate}</span></div>
    <div class="row"><span class="row-label">Due Date</span><span class="row-value">${dueDate}</span></div>
    ${paidDate ? `<div class="row"><span class="row-label">Paid On</span><span class="row-value">${paidDate}</span></div>` : ''}
    <div class="row"><span class="row-label">Status</span><span class="row-value"><span class="paid-stamp">${statusLabel}</span></span></div>
    <hr class="divider">
  </div>
  <div class="footer">
    <div class="footer-line1">${platformName} Learning Academy</div>
    <div class="footer-line2">stibelearning.online &bull; This is a system-generated invoice</div>
  </div>
</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script>
</body></html>`;
  const w = window.open('', '_blank', 'width=520,height=740');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Session Materials Button + Modal ──────────────────────────
function SessionMaterialsButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<Array<{
    id: string; file_name: string; file_url: string; file_type: string;
    title: string | null; file_size_bytes: number | null; created_at: string;
    uploaded_by_name: string | null;
  }> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/session-materials?session_id=${encodeURIComponent(sessionId)}`);
      const json = await res.json() as { success: boolean; data?: { materials: NonNullable<typeof materials> } };
      if (json.success) setMaterials(json.data?.materials ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleOpen = () => { setOpen(true); if (!materials) fetch_(); };

  const fileIcon = (type: string) => {
    if (type === 'pdf') return '📄';
    if (type === 'image') return '🖼️';
    if (type === 'video') return '🎬';
    return '📎';
  };

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-5 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-100 transition-colors"
      >
        <Paperclip className="h-4 w-4" /> View Materials
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-gray-900">Session Materials</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Content */}
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>}
              {!loading && materials?.length === 0 && (
                <div className="flex flex-col items-center py-10 text-gray-400">
                  <Paperclip className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No materials uploaded for this session</p>
                </div>
              )}
              {!loading && materials && materials.length > 0 && (
                <div className="space-y-2">
                  {materials.map(m => (
                    <a
                      key={m.id}
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-teal-50 hover:border-teal-200 px-4 py-3 transition-colors group"
                    >
                      <span className="text-xl shrink-0">{fileIcon(m.file_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-teal-700">{m.title || m.file_name}</p>
                        {m.title && <p className="text-xs text-gray-400 truncate">{m.file_name}</p>}
                        <p className="text-xs text-gray-400">
                          {m.uploaded_by_name ?? 'Teacher'}{m.file_size_bytes ? ` · ${fmtSize(m.file_size_bytes)}` : ''}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-teal-500 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FeesTab({
  summary, invoices, receipts, loading, onRefresh, onPay, payingId, studentName,
}: {
  summary: FeesSummaryData | null;
  invoices: InvoiceData[];
  receipts: ReceiptData[];
  loading: boolean;
  onRefresh: () => void;
  onPay: (invoiceId: string) => void;
  payingId: string | null;
  studentName: string;
}) {
  const platformName = usePlatformName();
  const [view, setView] = useState<'invoices' | 'receipts'>('invoices');

  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue' || i.status === 'scheduled');
  const paidInvoices = invoices.filter(i => i.status === 'paid');

  const statusConfig = (status: string) => {
    if (status === 'paid')      return { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', label: 'Paid' };
    if (status === 'overdue')   return { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700', label: 'Overdue' };
    if (status === 'scheduled') return { bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-400', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', label: 'Scheduled' };
    return { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'Pending' };
  };

  const openPayPage = (inv: InvoiceData) => {
    if (!inv.pay_token) return;
    window.open(`/pay/${inv.id}?t=${inv.pay_token}`, '_blank');
  };

  return (
    <div className="space-y-5">

      {/* ── Summary Banner ── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Total Billed */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 p-4 text-white shadow-md shadow-teal-500/20">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-100">Total Billed</p>
            <p className="mt-1.5 text-xl font-black tracking-tight">{money(summary.total_invoiced_paise)}</p>
            <p className="mt-0.5 text-[11px] text-teal-200">{summary.total_invoices} invoice{summary.total_invoices !== 1 ? 's' : ''}</p>
          </div>
          {/* Paid */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-white shadow-md shadow-emerald-500/20">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">Paid</p>
            <p className="mt-1.5 text-xl font-black tracking-tight">{money(summary.total_paid_paise)}</p>
            <p className="mt-0.5 text-[11px] text-emerald-200">{summary.paid_count} settled</p>
          </div>
          {/* Pending */}
          <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md ${
            summary.total_pending_paise > 0
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
              : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/20'
          }`}>
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-100">Pending</p>
            <p className="mt-1.5 text-xl font-black tracking-tight">{money(summary.total_pending_paise)}</p>
            <p className="mt-0.5 text-[11px] text-orange-200">{summary.pending_count} due</p>
          </div>
          {/* Overdue */}
          <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md ${
            summary.overdue_count > 0
              ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20'
              : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/20'
          }`}>
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-100">Overdue</p>
            <p className="mt-1.5 text-xl font-black tracking-tight">{summary.overdue_count}</p>
            <p className="mt-0.5 text-[11px] text-red-200">{summary.overdue_count > 0 ? 'action needed' : 'all clear'}</p>
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {summary && summary.overdue_count > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 font-medium">
            {summary.overdue_count} overdue invoice{summary.overdue_count > 1 ? 's' : ''} — please pay promptly to avoid disruption.
          </p>
        </div>
      )}

      {/* ── Tab toggle + Refresh ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
          {([
            { key: 'invoices' as const, label: 'Invoices', count: invoices.length },
            { key: 'receipts' as const, label: 'Receipts', count: receipts.length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                view === t.key
                  ? 'bg-white text-teal-700 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.key === 'invoices' ? <FileText className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                view === t.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* ── Content ── */}
      {loading ? (
        <LoadingState />
      ) : view === 'invoices' ? (
        invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No invoices found</p>
            <p className="mt-1 text-xs text-gray-400">Your fee invoices will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pending / Overdue first */}
            {pendingInvoices.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">Action Required ({pendingInvoices.length})</p>
                {pendingInvoices.map(inv => {
                  const cfg = statusConfig(inv.status);
                  return (
                    <div key={inv.id} className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot} ring-4 ring-white shadow-sm`} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-gray-700">{inv.invoice_number}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>{cfg.label}</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{inv.description || 'Fee Invoice'}</p>
                            {inv.billing_period && <p className="text-xs text-gray-500 mt-0.5">{inv.billing_period}</p>}
                            {inv.status === 'scheduled' ? (
                              <p className={`text-xs font-medium mt-1 ${cfg.text}`}>
                                Due: {new Date(inv.scheduled_for ?? inv.due_date ?? inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {inv.installment_number ? ` · Installment ${inv.installment_number}` : ''}
                              </p>
                            ) : inv.due_date && (
                              <p className={`text-xs font-medium mt-1 ${cfg.text}`}>
                                Due: {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-gray-900">{money(inv.amount_paise)}</p>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {inv.status !== 'scheduled' && (
                        <button
                          onClick={() => onPay(inv.id)}
                          disabled={payingId === inv.id}
                          className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 transition shadow-sm shadow-teal-500/30"
                        >
                          {payingId === inv.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" />Processing…</>
                          ) : (
                            <><CreditCard className="h-3 w-3" />Pay Now</>
                          )}
                        </button>
                        )}
                        <a
                          href={inv.pay_token ? `/pay/${inv.id}?t=${inv.pay_token}` : `/api/v1/payment/invoice-pdf/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                        >
                          <ExternalLink className="h-3 w-3" />View Invoice
                        </a>
                        <button
                          onClick={() => printInvoiceWindow(inv, studentName, platformName)}
                          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition"
                        >
                          <Download className="h-3 w-3" />Print
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Paid invoices */}
            {paidInvoices.length > 0 && (
              <div className="space-y-2.5">
                {pendingInvoices.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1 mt-4">Paid ({paidInvoices.length})</p>
                )}
                {paidInvoices.map(inv => {
                  const cfg = statusConfig(inv.status);
                  return (
                    <div key={inv.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-gray-700">{inv.invoice_number}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>{cfg.label}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-700 truncate">{inv.description || 'Fee Invoice'}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {inv.billing_period && <p className="text-xs text-gray-400">{inv.billing_period}</p>}
                              {inv.paid_at && (
                                <p className="text-xs text-emerald-600 font-medium">
                                  Paid {new Date(inv.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-black text-emerald-700">{money(inv.amount_paise)}</p>
                          <div className="mt-1.5 flex items-center justify-end gap-1.5">
                            <a
                              href={inv.pay_token ? `/pay/${inv.id}?t=${inv.pay_token}` : `/api/v1/payment/invoice-pdf/${inv.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View Invoice"
                              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 transition"
                            >
                              <ExternalLink className="h-3 w-3" />View
                            </a>
                            <button
                              onClick={() => printInvoiceWindow(inv, studentName, platformName)}
                              title="Print Invoice"
                              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 transition"
                            >
                              <Download className="h-3 w-3" />Print
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      ) : (
        /* ── Receipts ── */
        receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
              <Receipt className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No payment receipts yet</p>
            <p className="mt-1 text-xs text-gray-400">Receipts are generated after successful payment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map(r => {
              const method = r.payment_method
                ? r.payment_method.charAt(0).toUpperCase() + r.payment_method.slice(1).replace(/_/g, ' ')
                : 'Online';
              const paidDateFmt = new Date(r.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              const paidTimeFmt = new Date(r.paid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              return (
                <div key={r.receipt_number} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {/* Green accent top bar */}
                  <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
                  <div className="p-4">
                    {/* Top row: description + amount */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{r.invoice_description || 'Fee Payment'}</p>
                        {r.billing_period && <p className="text-xs text-gray-400 mt-0.5">{r.billing_period}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-emerald-700 leading-none">{money(r.amount_paise)}</p>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 className="h-2.5 w-2.5" />Paid
                        </span>
                      </div>
                    </div>
                    {/* Divider */}
                    <div className="my-3 border-t border-dashed border-gray-100" />
                    {/* Meta row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                          <span className="font-mono text-[11px] text-gray-500">{r.receipt_number}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                          <span className="text-[11px] text-gray-500 capitalize">{method}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                          <span className="text-[11px] text-gray-500">{paidDateFmt} · {paidTimeFmt}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => printReceiptWindow(r, studentName, platformName)}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      >
                        <Download className="h-3 w-3" />Print
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ── Requests Tab ───────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function RequestsTab({ requests, availability, sessions, batches, loading, loadingAvailability, onRefresh, userEmail, userName }: {
  requests: SessionRequest[];
  availability: AvailabilitySlot[];
  sessions: SessionData[];
  batches: BatchDetail[];
  loading: boolean;
  loadingAvailability: boolean;
  onRefresh: () => void;
  userEmail: string;
  userName: string;
}) {
  const [view, setView] = useState<'requests' | 'availability'>('requests');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sessionId: '', batchId: '', requestType: 'reschedule' as 'reschedule' | 'cancel', reason: '', proposedDate: '', proposedTime: '' });
  const [availForm, setAvailForm] = useState({ batchId: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:30', preference: 'available' as 'available' | 'preferred' | 'unavailable' });

  // Upcoming sessions for making requests
  const upcomingSessions = sessions.filter(s => effectiveSessionStatus(s) === 'scheduled' && new Date(s.scheduled_date) >= new Date());

  const submitRequest = async () => {
    if (!form.sessionId || !form.reason) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        batch_session_id: form.sessionId,
        batch_id: form.batchId,
        request_type: form.requestType,
        reason: form.reason,
      };
      if (form.requestType === 'reschedule') {
        if (form.proposedDate) body.proposed_date = form.proposedDate;
        if (form.proposedTime) body.proposed_time = form.proposedTime;
      }
      const res = await fetch('/api/v1/session-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { setShowForm(false); setForm({ sessionId: '', batchId: '', requestType: 'reschedule', reason: '', proposedDate: '', proposedTime: '' }); onRefresh(); }
      else alert(data.error || 'Failed to submit request');
    } catch { alert('Network error — please try again'); } finally { setSubmitting(false); }
  };

  const withdrawRequest = async (id: string) => {
    try {
      await fetch('/api/v1/session-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw', request_id: id }) });
      onRefresh();
    } catch { alert('Failed to withdraw request'); }
  };

  const submitAvailability = async () => {
    if (!availForm.batchId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/student-availability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: availForm.batchId, day_of_week: Number(availForm.dayOfWeek), start_time: availForm.startTime, end_time: availForm.endTime, preference: availForm.preference }),
      });
      const data = await res.json();
      if (data.success) onRefresh();
      else alert(data.error || 'Failed to save availability');
    } catch { alert('Network error — please try again'); } finally { setSubmitting(false); }
  };

  const deleteSlot = async (id: string) => {
    try {
      await fetch('/api/v1/student-availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', slot_id: id }) });
      onRefresh();
    } catch { alert('Failed to remove slot'); }
  };

  const statusColor = (s: string) => s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'withdrawn' ? 'neutral' : 'warning';

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'requests' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <ClipboardList className="inline h-4 w-4 mr-1.5" />Session Requests
          </button>
          <button onClick={() => setView('availability')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'availability' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <CalendarClock className="inline h-4 w-4 mr-1.5" />My Availability
          </button>
        </div>
        <RefreshButton loading={loading || loadingAvailability} onClick={onRefresh} />
      </div>

      {view === 'requests' ? (
        <div className="space-y-4">
          {/* New request button */}
          {upcomingSessions.length > 0 && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition text-sm font-medium">
              <Send className="h-4 w-4" />{showForm ? 'Cancel' : 'New Request'}
            </button>
          )}

          {/* Request form */}
          {showForm && (
            <Card className="p-5 space-y-4 border-emerald-200">
              <h3 className="text-sm font-semibold text-gray-900">Submit Session Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.sessionId}
                    onChange={e => {
                      const sess = upcomingSessions.find(s => s.session_id === e.target.value);
                      setForm(f => ({ ...f, sessionId: e.target.value, batchId: sess?.batch_id || '' }));
                    }}>
                    <option value="">Select session…</option>
                    {upcomingSessions.map(s => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.subject} — {new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {s.start_time?.slice(0, 5)} ({s.batch_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Request Type</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.requestType}
                    onChange={e => setForm(f => ({ ...f, requestType: e.target.value as 'reschedule' | 'cancel' }))}>
                    <option value="reschedule">🔄 Reschedule</option>
                    <option value="cancel">❌ Cancel</option>
                  </select>
                </div>
                {form.requestType === 'reschedule' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Date</label>
                      <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.proposedDate} onChange={e => setForm(f => ({ ...f, proposedDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Time</label>
                      <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.proposedTime} onChange={e => setForm(f => ({ ...f, proposedTime: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                  <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Explain why you need this change…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <button disabled={submitting || !form.sessionId || !form.reason} onClick={submitRequest}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </Card>
          )}

          {/* Request list */}
          {requests.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No session requests yet" />
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${r.request_type === 'cancel' ? 'bg-red-100' : 'bg-blue-100'}`}>
                      {r.request_type === 'cancel' ? <Ban className="h-4.5 w-4.5 text-red-600" /> : <CalendarClock className="h-4.5 w-4.5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{r.request_type === 'cancel' ? 'Cancel' : 'Reschedule'} — {r.subject || 'Session'}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.batch_name && `${r.batch_name} · `}
                        {r.session_date && fmtSmartDateLocal(r.session_date)}
                        {r.proposed_date && ` → ${fmtSmartDateLocal(r.proposed_date)}`}
                        {r.proposed_time && ` at ${r.proposed_time}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejection: {r.rejection_reason}</p>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-gray-400">{fmtSmartDateLocal(r.created_at)}</p>
                      {r.status === 'pending' && (
                        <button onClick={() => withdrawRequest(r.id)} className="text-xs text-red-500 hover:text-red-700">Withdraw</button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Availability view */
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Add Available Time Slot</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.batchId} onChange={e => setAvailForm(f => ({ ...f, batchId: e.target.value }))}>
                  <option value="">Select…</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Day</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.dayOfWeek} onChange={e => setAvailForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                  {DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.startTime} onChange={e => setAvailForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.endTime} onChange={e => setAvailForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preference</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.preference} onChange={e => setAvailForm(f => ({ ...f, preference: e.target.value as 'available' | 'preferred' | 'unavailable' }))}>
                  <option value="available">Available</option>
                  <option value="preferred">Preferred</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>
            <button disabled={submitting || !availForm.batchId} onClick={submitAvailability}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
              {submitting ? 'Saving…' : 'Add Slot'}
            </button>
          </Card>

          {/* Availability schedule */}
          {loadingAvailability ? <LoadingState /> : availability.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No availability slots set. Add your preferred times above." />
          ) : (
            <div className="space-y-3">
              {DAYS.map((day, idx) => {
                const daySlots = availability.filter(s => s.day_of_week === idx);
                if (daySlots.length === 0) return null;
                return (
                  <Card key={idx} className="p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{day}</h4>
                    <div className="space-y-1.5">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${slot.preference === 'preferred' ? 'bg-emerald-500' : slot.preference === 'unavailable' ? 'bg-red-500' : 'bg-blue-500'}`} />
                            <span className="text-gray-700">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</span>
                            <Badge label={slot.preference} variant={slot.preference === 'preferred' ? 'success' : slot.preference === 'unavailable' ? 'danger' : 'info'} />
                            {slot.notes && <span className="text-xs text-gray-400">({slot.notes})</span>}
                          </div>
                          <button onClick={() => deleteSlot(slot.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
