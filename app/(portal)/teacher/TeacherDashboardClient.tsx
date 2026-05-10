// ═══════════════════════════════════════════════════════════════
// Teacher Dashboard — Client Component (Batch-Sessions Based)
// ═══════════════════════════════════════════════════════════════
// Tabs: Overview · My Batches · Today · Schedule · My Profile
// Theme: light / emerald primary — uses shared UI components
// Pattern: matches HR & Academic Operator dashboards
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  SearchInput, FilterSelect,
  FormField, FormGrid, Input, Select,
  StatCard, StatCardSmall, Card, InfoCard,
  Badge, StatusBadge, Avatar,
  LoadingState, EmptyState, Alert,
  TableWrapper, THead, TH, TRow,
  useToast, useConfirm,
  money,
} from '@/components/dashboard/shared';
import QuestionViewer, { ViewQuestion } from '@/components/exam/QuestionViewer';
import { getChapters } from '@/lib/curriculum-data';
import {
  LayoutDashboard, BookOpen, User, Radio, Calendar, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  GraduationCap, Briefcase, Phone, Timer,
  Users, Loader2, CalendarDays, Play, Video,
  MapPin, FileText, Star, Eye, BarChart3,
  ArrowRight, Pencil, Save, X as XIcon,
  HelpCircle, ListChecks, AlertTriangle, Info,
  CreditCard, TrendingUp, FolderOpen, ExternalLink,
  CalendarClock, Ban, Send, Camera, ClipboardList, Brain,
  UserCheck, Mail, Award, Paperclip, Upload, Trash2, Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import ImageCropModal from '@/components/dashboard/ImageCropModal';
import TeacherDemoTab from '@/components/dashboard/TeacherDemoTab';
import StudentReportsTab from '@/components/dashboard/StudentReportsTab';
import SessionCalendar from '@/components/dashboard/SessionCalendar';
import SessionMaterialsPanel from '@/components/classroom/SessionMaterialsPanel';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────

interface BatchSession {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string;
  teacher_name: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number;
  prep_buffer_minutes: number;
  status: string;
  livekit_room_name: string;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string;
  batch_name: string;
  batch_type: string;
  grade: string;
  section: string | null;
  batch_subjects: string[] | null;
  coordinator_email: string | null;
  academic_operator_email: string | null;
  student_count: number;
  go_live_status: string | null;
  go_live_requested_at: string | null;
  recording_status?: string | null;
  recording_url?: string | null;
}

interface TodayStats {
  today_total: number;
  today_live: number;
  today_upcoming: number;
  today_completed: number;
  today_cancelled: number;
}

interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  grade: string;
  section: string | null;
  subjects: string[] | null;
  board: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  coordinator_email: string | null;
  academic_operator_email: string | null;
  assigned_subject: string;
  student_count: number;
  total_sessions: number;
  completed_sessions: number;
  upcoming_sessions: number;
  live_sessions: number;
  cancelled_sessions: number;
  students: BatchStudent[];
}

interface BatchStudent {
  batch_id: string;
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  is_active: boolean;
}

interface TeacherProfile {
  name: string;
  email: string;
  profile_image: string | null;
  phone: string | null;
  whatsapp: string | null;
  date_of_birth: string | null;
  subjects: string[] | null;
  qualification: string | null;
  experience_years: number | null;
  assigned_region: string | null;
  notes: string | null;
}

// ── Salary & Ratings types ─────────────────────────────────

interface Payslip {
  id: string;
  payroll_period_id: string;
  teacher_email: string;
  period_label: string;
  start_date: string;
  end_date: string;
  classes_conducted: number;
  classes_missed: number;
  classes_cancelled: number;
  rate_per_class: number;
  base_pay_paise: number;
  incentive_paise: number;
  extension_sessions: number;
  extension_paise: number;
  lop_paise: number;
  medical_leave_adjustment_paise: number;
  total_paise: number;
  status: string;
  paid_at?: string;
  payment_reference?: string;
}

interface PayConfig {
  teacher_email: string;
  per_hour_rate: number;
  incentive_rules: {
    bonus_threshold?: number;
    bonus_per_class?: number;
  };
}

interface RatingFeedback {
  student_email: string;
  display_name: string;
  rating: number;
  feedback_text: string;
  tags: string;
  created_at: string;
}

interface RatingSession {
  room_id: string;
  batch_session_id: string;
  subject: string;
  batch_name: string;
  grade: string;
  scheduled_date: string;
  scheduled_start: string;
  go_live_at: string;
  late_minutes: number;
  punctuality_score: number;
  feedbacks: RatingFeedback[];
  avg_student_rating: number | null;
  feedback_count: number;
}

interface RatingsData {
  summary: {
    punctuality_avg: number;
    student_rating_avg: number;
    overall_avg: number;
    total_sessions: number;
    total_feedback: number;
    sessions_with_feedback: number;
  };
  punctuality_distribution: { on_time: number; slightly_late: number; late: number; very_late: number };
  rating_distribution: { five: number; four: number; three: number; two: number; one: number };
  sessions: RatingSession[];
  monthly: { month: string; punctuality_avg: number; student_rating_avg: number | null; session_count: number; feedback_count: number }[];
}

interface TeachingMaterial {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  material_type: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string | null;
  file_size: number | null;
  mime_type: string | null;
  batches: { batch_id: string; batch_name: string }[];
  batch_id?: string | null;
  batch_name?: string | null;
}

interface TeacherHomeworkQuestion {
  id: string;
  homework_id: string;
  question_number: number;
  question_text: string;
}

interface TeacherHomeworkSubmission {
  id: string;
  homework_id: string;
  student_email: string;
  student_name: string;
  submission_text: string | null;
  file_urls: string[];
  file_names: string[];
  completion_status: string;
  delay_days: number;
  submitted_at: string;
  grade: string | null;
  teacher_comment: string | null;
  graded_by: string | null;
  graded_at: string | null;
}

interface TeacherHomework {
  id: string;
  room_id: string;
  batch_id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: string;
  created_at: string;
  batch_name: string | null;
  grade: string | null;
  room_name: string | null;
  questions: TeacherHomeworkQuestion[];
  submissions: TeacherHomeworkSubmission[];
  total_students: number;
  submission_count: number;
  attachment_urls: string[];
  attachment_names: string[];
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

// ── Live Salary type ────────────────────────────────────────

interface LiveSalaryMonth {
  label: string;
  start: string;
  end: string;
  classes_conducted: number;
  classes_missed: number;
  classes_cancelled: number;
  classes_upcoming: number;
  extension_sessions: number;
  extension_minutes: number;
  base_pay_paise: number;
  extension_paise: number;
  incentive_paise: number;
  lop_paise: number;
  medical_leave_adjustment_paise: number;
  total_paise: number;
}

interface SessionEarning {
  id: string;
  room_id: string;
  batch_session_id: string;
  batch_id: string;
  batch_name?: string;
  subject: string;
  scheduled_date: string;
  duration_minutes: number;
  actual_minutes: number;
  per_hour_rate_paise: number;
  base_paise: number;
  extension_minutes: number;
  extension_paise: number;
  total_paise: number;
  created_at: string;
}

interface LiveSalary {
  configured: boolean;
  per_hour_rate: number;
  incentive_rules: { bonus_threshold?: number; bonus_per_class?: number } | null;
  current_month: LiveSalaryMonth | null;
  recent_earnings: SessionEarning[];
}

// ── Helpers ─────────────────────────────────────────────────

const BATCH_TYPE_LABELS: Record<string, string> = {
  one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15',
  one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture',
  improvement_batch: 'Improvement', custom: 'Custom',
};

function batchTypeLabel(t: string): string {
  return BATCH_TYPE_LABELS[t] || t;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function sessionDateTime(s: BatchSession): Date {
  return new Date(`${nd(s.scheduled_date)}T${s.start_time.slice(0, 5)}+05:30`);
}

function sessionEndTime(s: BatchSession): Date {
  const d = sessionDateTime(s);
  d.setMinutes(d.getMinutes() + s.duration_minutes);
  return d;
}

function sessionPrepStart(s: BatchSession): Date {
  const d = sessionDateTime(s);
  d.setMinutes(d.getMinutes() - s.prep_buffer_minutes);
  return d;
}

function formatTime12h(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getWeekDates(): string[] {
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(istNow);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getDayLabel(dateStr: string): string {
  const todayStr = todayISO();
  if (dateStr === todayStr) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (dateStr === tomorrowStr) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

function getFullDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Normalize DB date (may be full ISO or YYYY-MM-DD) to YYYY-MM-DD */
function nd(d: string): string {
  if (!d) return '';
  return d.slice(0, 10);
}

function canStartSession(s: BatchSession): boolean {
  // Only allow starting a scheduled session within a 15-minute window
  // before the scheduled start time and until session end.
  if (s.status !== 'scheduled') return false;
  const now = Date.now();
  const startMs = sessionDateTime(s).getTime();
  const endTime = sessionEndTime(s).getTime();
  const fifteenMinMs = 15 * 60 * 1000;
  // show Start button when now is >= (start - 15min) and before end
  return now >= (startMs - fifteenMinMs) && now < endTime;
}

/** True if session end time is still in the future */
function isSessionUpcoming(s: BatchSession): boolean {
  return sessionEndTime(s).getTime() > Date.now();
}

// ── Countdown Component ─────────────────────────────────────

function SessionCountdown({ session }: { session: BatchSession }) {
  const [label, setLabel] = useState('');
  const [live, setLive] = useState(false);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const startMs = sessionDateTime(session).getTime();
      const endMs = sessionEndTime(session).getTime();
      const prepMs = sessionPrepStart(session).getTime();
      if (now < prepMs) {
        const diff = prepMs - now;
        if (diff > 86_400_000) {
          const days = Math.ceil(diff / 86_400_000);
          setLabel(`in ${days} day${days > 1 ? 's' : ''}`);
          setLive(false);
        } else {
          const h = Math.floor(diff / 3_600_000);
          const m = Math.floor((diff % 3_600_000) / 60_000);
          const s = Math.floor((diff % 60_000) / 1_000);
          setLabel(`Prep in ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`);
          setLive(true);
        }
      } else if (now < startMs) {
        const diff = startMs - now;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`Starts in ${m}m ${s}s`);
        setLive(true);
      } else if (now < endMs) {
        const diff = endMs - now;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`${m}m ${s}s left`);
        setLive(true);
      } else if (session.status === 'live') {
        // Session is running overtime — only teacher can end it manually
        const over = now - endMs;
        const m = Math.floor(over / 60_000);
        const s = Math.floor((over % 60_000) / 1_000);
        setLabel(`Overtime +${m}m ${s}s`);
        setLive(true);
      } else {
        setLabel('Ended');
        setLive(false);
      }
    };
    tick();
    const id = setInterval(tick, live ? 1_000 : 60_000);
    return () => clearInterval(id);
  }, [session, live]);
  return <span className={`text-xs ${live ? 'font-mono text-primary' : 'text-gray-500'}`}>{label}</span>;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TeacherDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const validTabs = ['overview', 'batches', 'schedule', 'homework', 'profile', 'salary', 'ratings', 'materials', 'leave', 'demo', 'questions'] as const;
  type Tab = typeof validTabs[number];
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Data state ──
  const [sessions, setSessions] = useState<BatchSession[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({ today_total: 0, today_live: 0, today_upcoming: 0, today_completed: 0, today_cancelled: 0 });
  const [maxPerDay, setMaxPerDay] = useState(4);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  // ── Salary & Ratings state ──
  const [salaryData, setSalaryData] = useState<{ payslips: Payslip[]; config: PayConfig | null } | null>(null);
  const [ratingsData, setRatingsData] = useState<RatingsData | null>(null);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [homeworkData, setHomeworkData] = useState<TeacherHomework[]>([]);
  const [liveSalary, setLiveSalary] = useState<LiveSalary | null>(null);

  // ── Hash sync (matches HR/AO pattern) ──
  useEffect(() => {
    const syncHash = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      if (h && validTabs.includes(h)) setActiveTab(h);
      else if (!h) setActiveTab('overview');
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = useCallback((t: string) => {
    if ((validTabs as readonly string[]).includes(t)) {
      setActiveTab(t as Tab);
      window.location.hash = t;
    }
  }, []);

  // ── Fetch all data ──
  const fetchData = useCallback(async (silent = true) => {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const [sessRes, batchRes, profRes, salRes, ratRes, matRes, hwRes, liveSalRes] = await Promise.all([
        fetch('/api/v1/teacher/my-sessions?range=week'),
        fetch('/api/v1/teacher/my-batches'),
        fetch('/api/v1/teacher/profile'),
        fetch('/api/v1/payroll'),
        fetch('/api/v1/teacher/ratings'),
        fetch('/api/v1/teaching-materials'),
        fetch('/api/v1/teacher/homework'),
        fetch('/api/v1/teacher/salary-live'),
      ]);
      const [sessData, batchData, profData, salData, ratData, matData, hwData, liveSalData] = await Promise.all([
        sessRes.json(), batchRes.json(), profRes.json(), salRes.json(), ratRes.json(), matRes.json(), hwRes.json(), liveSalRes.json(),
      ]);

      if (sessData.success) {
        setSessions(sessData.data.sessions || []);
        setTodayStats(sessData.data.today || { today_total: 0, today_live: 0, today_upcoming: 0, today_completed: 0, today_cancelled: 0 });
        setMaxPerDay(sessData.data.max_sessions_per_day || 4);
      }
      if (batchData.success) {
        setBatches(batchData.data.batches || []);
      }
      if (profData.success) {
        setProfile(profData.data);
      }
      if (salData.success) {
        setSalaryData({ payslips: salData.data.payslips || [], config: salData.data.config || null });
      }
      if (ratData.success) {
        setRatingsData(ratData.data);
      }
      if (matData.success) {
        setMaterials(matData.data.materials || []);
      }
      if (hwData.success) {
        setHomeworkData(hwData.data.assignments || []);
      }
      if (liveSalData.success) {
        setLiveSalary(liveSalData.data);
      }
    } catch {
      if (!silent) setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(false); }, [fetchData]);

  // ── Periodic refresh: pick up status changes (e.g. session ended) every 60s ──
  useEffect(() => {
    const iv = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // ── Actually start the LiveKit session (called after approval or if no BC) ──
  const doStartSession = async (sessionId: string, session: BatchSession) => {
    setStarting(sessionId);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${sessionId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to start session');
        return;
      }
      const participants = data.data?.participants || [];
      const teacherEntry = participants.find((p: Record<string, unknown>) => p.email === userEmail);
      if (!teacherEntry) {
        alert('Could not find your join token. Please try again.');
        return;
      }
      sessionStorage.setItem('lk_token', teacherEntry.token);
      sessionStorage.setItem('lk_url', data.data.ws_url);
      sessionStorage.setItem('room_name', data.data.livekit_room_name);
      sessionStorage.setItem('participant_role', 'teacher');
      sessionStorage.setItem('participant_name', userName);
      const isoStart = `${session.scheduled_date}T${session.start_time}+05:30`;
      sessionStorage.setItem('scheduled_start', isoStart);
      sessionStorage.setItem('duration_minutes', String(session.duration_minutes));
      sessionStorage.setItem('topic', session.topic || '');
      sessionStorage.setItem('room_status', 'scheduled');
      // Open classroom in a new tab so teacher can keep the dashboard open
      window.open(`/classroom/${sessionId}`, '_blank');
    } catch {
      alert('Network error starting session');
    } finally {
      setStarting(null);
    }
  };

  // ── Start session — always enters classroom directly ──
  const startSession = async (sessionId: string, session: BatchSession) => {
    doStartSession(sessionId, session);
  };

  // ── Derived data ──
  const todaySessions = sessions.filter(s => nd(s.scheduled_date) === todayISO());
  const liveSessions = sessions.filter(s => s.status === 'live');
  const upcomingSessions = sessions
    .filter(s => s.status === 'scheduled' && isSessionUpcoming(s))
    .sort((a, b) => sessionDateTime(a).getTime() - sessionDateTime(b).getTime());
  const nextSession = upcomingSessions.length > 0
    ? upcomingSessions.reduce((a, b) =>
        sessionDateTime(a).getTime() < sessionDateTime(b).getTime() ? a : b
      )
    : null;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <DashboardShell userName={userName} userEmail={userEmail} role={userRole} permissions={permissions}>
      <div className="space-y-6">

        {/* ── Live class overlay warning ── */}
        {liveSessions.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-red-400 bg-linear-to-r from-red-600 to-red-500 shadow-lg shadow-red-200">
            {/* Pulse ring */}
            <span className="absolute right-4 top-4 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-white/70" />
            </span>

            {/* Header row */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
                <Radio className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-100">You are live</p>
                <h2 className="text-lg font-extrabold text-white leading-tight">
                  {liveSessions.length === 1 ? 'Session In Progress' : `${liveSessions.length} Sessions In Progress`}
                </h2>
              </div>
            </div>

            {/* Per-session details */}
            <div className="px-5 pb-5 space-y-3">
              {liveSessions.map(s => (
                <div key={s.session_id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl bg-white/10 border border-white/20 px-3 sm:px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm sm:text-base font-bold text-white">{s.subject}</span>
                      <span className="text-red-200 text-sm">—</span>
                      <span className="text-sm font-semibold text-red-100">{s.batch_name}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse inline-block" /> LIVE
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-red-100">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Grade {s.grade}{s.section ? `-${s.section}` : ''}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {s.student_count} student{s.student_count !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Started {formatTime12h(s.start_time)}</span>
                      <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {fmtDuration(s.duration_minutes)}</span>
                      {s.topic && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {s.topic}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => startSession(s.session_id, s)}
                    disabled={starting === s.session_id}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-md hover:bg-red-50 active:scale-95 transition-all disabled:opacity-60 shrink-0 w-full sm:w-auto"
                  >
                    {starting === s.session_id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Video className="h-4 w-4" />}
                    Join Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab content ── */}
        {initialLoading ? (
          <LoadingState />
        ) : error ? (
          <Alert variant="error" message={error} />
        ) : activeTab === 'overview' ? (
          <OverviewTab
            sessions={sessions}
            liveSessions={liveSessions}
            todaySessions={todaySessions}
            todayStats={todayStats}
            maxPerDay={maxPerDay}
            nextSession={nextSession}
            batches={batches}
            salaryData={salaryData}
            ratingsData={ratingsData}
            homeworkData={homeworkData}
            liveSalary={liveSalary}
            onRefresh={fetchData}
            onStartSession={startSession}
            starting={starting}
            changeTab={changeTab}
            loading={loading}
          />
        ) : activeTab === 'batches' ? (
          <MyBatchesTab
            batches={batches}
            sessions={sessions}
            onRefresh={fetchData}
            onStartSession={startSession}
            starting={starting}
            loading={loading}
          />
        ) : activeTab === 'schedule' ? (
          <WeeklyScheduleTab
            sessions={sessions}
            onRefresh={fetchData}
            onStartSession={startSession}
            starting={starting}
            loading={loading}
          />
        ) : activeTab === 'profile' ? (
          <ProfileTab profile={profile} onRefresh={fetchData} />
        ) : activeTab === 'salary' ? (
          <SalaryTab
            payslips={salaryData?.payslips ?? []}
            config={salaryData?.config ?? null}
            liveSalary={liveSalary}
            onRefresh={fetchData}
            loading={loading}
          />
        ) : activeTab === 'ratings' ? (
          <RatingsTab data={ratingsData} onRefresh={fetchData} loading={loading} />
        ) : activeTab === 'materials' ? (
          <TeacherMaterialsTab materials={materials} onRefresh={fetchData} loading={loading} />
        ) : activeTab === 'leave' ? (
          <LeaveTab />
        ) : activeTab === 'homework' ? (
          <TeacherHomeworkTab assignments={homeworkData} onRefresh={fetchData} loading={loading} />
        ) : activeTab === 'demo' ? (
          <TeacherDemoTab />
        ) : activeTab === 'questions' ? (
          <QuestionsTab />
        ) : null}
      </div>
    </DashboardShell>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Overview (Enhanced with analytics & charts)
// ═════════════════════════════════════════════════════════════

const CHART_COLORS = {
  emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b', purple: '#8b5cf6',
  red: '#ef4444', gray: '#9ca3af', teal: '#14b8a6', rose: '#f43f5e',
};

function OverviewTab({
  sessions, todaySessions, todayStats, maxPerDay, nextSession, batches, liveSessions,
  salaryData, ratingsData, homeworkData, liveSalary,
  onRefresh, onStartSession, starting, changeTab, loading,
}: {
  sessions: BatchSession[];
  liveSessions: BatchSession[];
  todaySessions: BatchSession[];
  todayStats: TodayStats;
  maxPerDay: number;
  nextSession: BatchSession | null;
  batches: Batch[];
  salaryData: { payslips: Payslip[]; config: PayConfig | null } | null;
  ratingsData: RatingsData | null;
  homeworkData: TeacherHomework[];
  liveSalary: LiveSalary | null;
  onRefresh: () => void;
  onStartSession: (id: string, s: BatchSession) => void;
  starting: string | null;
  changeTab: (t: string) => void;
  loading: boolean;
}) {
  const totalStudents = batches.reduce((sum, b) => sum + b.student_count, 0);
  const totalCompleted = batches.reduce((sum, b) => sum + b.completed_sessions, 0);
  const totalSessions = batches.reduce((sum, b) => sum + b.total_sessions, 0);
  const completionPct = totalSessions > 0 ? Math.round((totalCompleted / totalSessions) * 100) : 0;

  // ── Salary derived ──
  const payslips = salaryData?.payslips ?? [];
  const totalEarned = payslips.filter(p => p.status === 'paid').reduce((s, p) => s + p.total_paise, 0);

  // ── Rating derived ──
  const rSummary = ratingsData?.summary;
  const ratingMonthly = ratingsData?.monthly ?? [];

  // ── Homework derived ──
  const pendingGrading = homeworkData.reduce((n, a) => n + a.submissions.filter(s => !s.grade).length, 0);

  // ── Weekly session activity (line chart) ──
  const weekDates = getWeekDates();
  const weeklySessionData = weekDates.map(dateStr => {
    const daySessions = sessions.filter(s => nd(s.scheduled_date) === dateStr);
    return {
      day: getDayLabel(dateStr),
      completed: daySessions.filter(s => s.status === 'ended').length,
      upcoming: daySessions.filter(s => s.status === 'scheduled').length,
      total: daySessions.length,
    };
  });

  // ── Earnings line chart (from payslips — last 6 months) ──
  const earningsChartData = payslips
    .slice(0, 6)
    .reverse()
    .map(p => ({
      period: p.period_label.length > 6 ? p.period_label.slice(0, 6) : p.period_label,
      earned: p.total_paise / 100,
      sessions: p.classes_conducted,
    }));

  const ratingTrendData = ratingMonthly.map(m => ({
    month: m.month.length > 5 ? m.month.slice(0, 3) : m.month,
    rating: m.punctuality_avg,
  }));

  // ── Rating distribution chart data ──
  const ratingDist = ratingsData?.rating_distribution;
  const ratingDistData = [
    { star: '5 ★', count: ratingDist?.five ?? 0, fill: CHART_COLORS.emerald },
    { star: '4 ★', count: ratingDist?.four ?? 0, fill: CHART_COLORS.teal },
    { star: '3 ★', count: ratingDist?.three ?? 0, fill: CHART_COLORS.amber },
    { star: '2 ★', count: ratingDist?.two ?? 0, fill: CHART_COLORS.rose },
    { star: '1 ★', count: ratingDist?.one ?? 0, fill: CHART_COLORS.red },
  ];
  const hasRatingData = ratingDistData.some(d => d.count > 0);

  // ── Current month earnings ──
  const monthEarnings = liveSalary?.current_month ? liveSalary.current_month.total_paise : (totalEarned > 0 ? totalEarned : 0);
  const monthSessions = liveSalary?.current_month ? liveSalary.current_month.classes_conducted : payslips[0]?.classes_conducted ?? 0;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 min-h-0 lg:h-[calc(100vh-9rem)]">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Overview</h1>
            <p className="text-xs text-gray-400">Your teaching snapshot</p>
          </div>
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* ═══ Row 1: Key Metrics (5 compact cards) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 shrink-0">
        {[
          { label: 'Today', value: `${todayStats.today_total} session${todayStats.today_total !== 1 ? 's' : ''}`, sub: todayStats.today_live > 0 ? `${todayStats.today_live} live` : `${todayStats.today_upcoming} upcoming`, color: 'bg-blue-500', icon: CalendarDays },
          { label: 'Earnings', value: monthEarnings > 0 ? money(monthEarnings) : '—', sub: monthSessions > 0 ? `${monthSessions} sessions` : 'This month', color: 'bg-primary', icon: CreditCard },
          { label: 'Rating', value: rSummary?.overall_avg ? `${rSummary.overall_avg.toFixed(1)} ★` : '—', sub: rSummary ? `${rSummary.total_feedback} reviews` : 'No reviews', color: 'bg-amber-500', icon: Star },
          { label: 'Completion', value: `${completionPct}%`, sub: `${totalCompleted}/${totalSessions}`, color: 'bg-purple-500', icon: TrendingUp },
          { label: 'Students', value: String(totalStudents), sub: `${batches.length} batches`, color: 'bg-teal-500', icon: Users },
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

      {/* ═══ Row 2: Next Session Bar ═══ */}
      {nextSession && (
        <div className="rounded-xl border border-primary/20 bg-primary/5/60 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-1 min-w-0">
            <Calendar className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {nextSession.subject}
              </span>
              <span className="text-xs text-gray-500 truncate">
                {nextSession.batch_name} · {formatTime12h(nextSession.start_time)} · {nextSession.student_count} students
              </span>
              <SessionCountdown session={nextSession} />
            </div>
          </div>
          {canStartSession(nextSession) && (
            <Button size="xs" icon={Play} onClick={() => onStartSession(nextSession.session_id, nextSession)} disabled={starting === nextSession.session_id} loading={starting === nextSession.session_id}>
              Start
            </Button>
          )}
        </div>
      )}

      {/* ═══ Row 3: Charts (takes remaining space) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 min-h-0">
        {/* Left: Weekly Sessions Line Chart */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 flex flex-col min-h-[200px] md:min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h3 className="text-xs font-semibold text-gray-700">Weekly Sessions</h3>
            <button onClick={() => changeTab('schedule')} className="text-[10px] text-primary hover:underline">View all</button>
          </div>
          <div className="flex-1 min-h-0">
            {weeklySessionData.some(d => d.total > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklySessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="completed" name="Done" stroke={CHART_COLORS.emerald} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.emerald }} />
                  <Line type="monotone" dataKey="upcoming" name="Upcoming" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.blue }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No sessions this week</div>
            )}
          </div>
        </div>

        {/* Center: Earnings Line Chart -- hidden on small screens, shown from md up */}
        <div className="hidden md:flex lg:col-span-4 rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 flex-col min-h-[200px] md:min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h3 className="text-xs font-semibold text-gray-700">Earnings Trend</h3>
            <button onClick={() => changeTab('salary')} className="text-[10px] text-primary hover:underline">Details</button>
          </div>
          <div className="flex-1 min-h-0">
            {earningsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsChartData}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`₹${Number(value ?? 0).toLocaleString('en-IN')}`, 'Earned']} />
                  <Area type="monotone" dataKey="earned" stroke={CHART_COLORS.emerald} fill="url(#earnGrad)" strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.emerald }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No earnings data yet</div>
            )}
          </div>
        </div>

        {/* Right: Subject Pie + Rating mini */}
        <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4 min-h-0">
          {/* Student Rating Distribution */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h3 className="text-xs font-semibold text-gray-700">Student Ratings</h3>
              {rSummary?.total_feedback ? (
                <span className="text-[10px] text-gray-400">{rSummary.total_feedback} reviews</span>
              ) : null}
            </div>
            {hasRatingData ? (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingDistData} barSize={22} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="star" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${value} student${value !== 1 ? 's' : ''}`, 'Feedback']} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {ratingDistData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <Star className="h-6 w-6 text-gray-200" />
                <p className="text-xs text-gray-400">No ratings yet</p>
              </div>
            )}
          </div>

          {/* Rating mini card */}
          <button onClick={() => changeTab('ratings')} className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 flex items-center gap-3 hover:border-amber-200 transition-colors shrink-0">
            <div className="bg-amber-100 rounded-lg p-2">
              <Star className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-gray-400">Rating Trend</p>
              {ratingTrendData.length > 1 ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{rSummary?.overall_avg?.toFixed(1) ?? '—'}</span>
                  {ratingTrendData.length >= 2 && (() => {
                    const diff = ratingTrendData[ratingTrendData.length - 1].rating - ratingTrendData[ratingTrendData.length - 2].rating;
                    return <span className={`text-[10px] font-medium ${diff >= 0 ? 'text-primary' : 'text-red-500'}`}>{diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}</span>;
                  })()}
                </div>
              ) : (
                <span className="text-sm font-bold text-gray-900">{rSummary?.overall_avg?.toFixed(1) ?? '—'}</span>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
          </button>
        </div>
      </div>

      {/* ═══ Row 4: Today's Sessions (compact list) ═══ */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-700">Today&apos;s Sessions</h3>
          <div className="flex items-center gap-3">
            {pendingGrading > 0 && (
              <button onClick={() => changeTab('homework')} className="text-[10px] text-amber-600 font-medium hover:underline">
                {pendingGrading} homework to grade
              </button>
            )}
            <button onClick={() => changeTab('schedule')} className="text-[10px] text-primary hover:underline">Full schedule</button>
          </div>
        </div>
        {todaySessions.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">No sessions today</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...todaySessions].sort((a, b) => a.start_time.localeCompare(b.start_time)).slice(0, 6).map(s => (
              <div key={s.session_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                <span className="font-bold text-gray-800">{formatTime12h(s.start_time)}</span>
                <span className="text-gray-500">{s.subject}</span>
                <span className="text-gray-400">· {s.student_count} <Users className="inline h-3 w-3" /></span>
                {s.status === 'live' && <Radio className="h-3 w-3 text-red-500 animate-pulse" />}
                {s.status === 'ended' && <CheckCircle2 className="h-3 w-3 text-primary" />}
                {s.status === 'live' && (
                  <Button size="xs" variant="danger" icon={Video} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                    Rejoin
                  </Button>
                )}
                {canStartSession(s) && (
                  <Button size="xs" icon={Play} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                    Start
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Session Limit Warning ── */}
      {todayStats.today_total >= maxPerDay && (
        <Alert variant="warning" message={`Daily limit reached (${maxPerDay}). No more sessions today.`} />
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// Quick Setup Guide (workflow-based teacher onboarding dropdown)
// ═════════════════════════════════════════════════════════════

const SETUP_SECTIONS = [
  {
    id: 'session_rules',
    icon: Info,
    label: 'Session Rules',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    items: [
      'Each session is 1 hour 30 minutes (75 min teaching + 15 min prep buffer)',
      'Maximum 4 sessions per day per teacher',
      'Session types: One-to-One, One-to-Three (max 3 students), One-to-Many',
      'One-to-One students may request preferred timings, subject to approval',
    ],
  },
  {
    id: 'pre_class',
    icon: ListChecks,
    label: 'Before & During Session',
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    items: [
      'Enter the session 15 minutes before the scheduled start time',
      'Students join after you (the teacher) have entered',
      'Mark student attendance at the start of every session',
      'Conduct the full scheduled lesson portion',
      'After session: update the topic covered and add remarks in the system',
    ],
  },
  {
    id: 'responsibilities',
    icon: CheckCircle2,
    label: 'Your Responsibilities',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    items: [
      'Conduct sessions as per the assigned schedule',
      'Always enter the session on time (15 min early)',
      'Mark attendance for every student in every session',
      'Complete the scheduled academic portion each session',
      'Update session details, topic covered, and remarks after each session',
      'Evaluate student performance and update exam marks promptly',
    ],
  },
  {
    id: 'cancellation',
    icon: AlertTriangle,
    label: 'Cancellation Policy',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    items: [
      'Teachers cannot directly cancel any scheduled session',
      'Submit a cancellation request to your Batch Coordinator with a valid reason',
      'Approval chain: Batch Coordinator → Admin → Academic Operator → HR',
      'Session is cancelled only after HR final approval',
      'Unauthorized cancellation is considered a policy violation',
      'All cancellation actions are logged and audited',
    ],
  },
];

/* Pending Tasks Widget — shows exams needing grading */
function PendingTasksWidget() {
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  useEffect(() => {
    fetch('/api/v1/teacher/my-batches')
      .then(r => r.json())
      .then(async (d) => {
        if (!d.success) return;
        // Get exams that have submitted but ungraded attempts
        const examRes = await fetch('/api/v1/exams?status=published');
        const examData = await examRes.json();
        if (examData.success && examData.data) {
          const pending = (examData.data as Array<Record<string, unknown>>).filter((e: Record<string, unknown>) => {
            return e.results_published !== true && e.published === true;
          });
          setTasks(pending.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTasks(false));
  }, []);
  if (loadingTasks || tasks.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-800">Pending Tasks</h3>
        <Badge label={`${tasks.length}`} variant="warning" />
      </div>
      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-2.5">
            <FileText className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{t.title as string}</p>
              <p className="text-[10px] text-gray-500">{t.subject as string} — Grade {t.grade as string}</p>
            </div>
            <span className="text-[10px] text-amber-600 font-medium shrink-0">Needs grading</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QuickSetupGuide() {
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (id: string) =>
    setOpenSection(prev => (prev === id ? null : id));

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header / main toggle */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <HelpCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Quick Setup Guide</p>
          <p className="text-xs text-gray-400">How sessions work, your duties &amp; policies — tap to expand</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {SETUP_SECTIONS.map(section => (
            <div key={section.id}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${section.bg} shrink-0`}>
                  <section.icon className={`h-3.5 w-3.5 ${section.color}`} />
                </div>
                <span className={`flex-1 text-sm font-medium ${section.color}`}>{section.label}</span>
                <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 shrink-0 ${openSection === section.id ? 'rotate-90' : ''}`} />
              </button>

              {/* Section steps */}
              {openSection === section.id && (
                <div className={`mx-4 mb-3 rounded-lg border ${section.border} ${section.bg} px-4 py-3`}>
                  <ol className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${section.border} text-[10px] font-bold ${section.color} shrink-0`}>
                          {i + 1}
                        </span>
                        <span className="text-xs text-gray-700 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Batches & Schedule (combined) — comprehensive detail
// ═════════════════════════════════════════════════════════════

// ── Batch Detail types ──
interface TimetableSlot { dow: number; day_name: string; start_time: string; duration_minutes: number; subject: string; teacher_name: string }
interface StudentAttendance { student_email: string; student_name: string; total_sessions: number; present: number; late: number; absent: number; left_early: number; not_joined: number; avg_attention: number; total_duration_sec: number }
interface SessionSummary { session_id: string; scheduled_date: string; start_time: string; duration_minutes: number; subject: string; topic: string; status: string; started_at: string; ended_at: string; room_id: string; students_joined: number; avg_attention: number; avg_duration_sec: number }
interface ExamResult { student_email: string; student_name: string; topic_title: string; subject: string; score: number; total_marks: number; percentage: number; grade_letter: string; total_questions: number; answered: number; time_taken_seconds: number; completed_at: string; room_id: string; session_id: string }
interface BatchDetail { timetable: TimetableSlot[]; attendance: StudentAttendance[]; session_summaries: SessionSummary[]; exam_results: ExamResult[] }

type DetailSubTab = 'sessions' | 'timetable' | 'attendance';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Per-session attendance types ──
interface SessionAttendanceRecord {
  participant_email: string;
  participant_name: string;
  participant_role: string;
  status: string;
  first_join_at: string | null;
  last_leave_at: string | null;
  total_duration_sec: number;
  join_count: number;
  late_join: boolean;
  late_by_sec: number;
  attention_avg: number;
}
interface SessionAttendanceSummary {
  total_students: number;
  present: number;
  late: number;
  absent: number;
  not_joined: number;
  left_early: number;
  avg_duration_sec: number;
}

function SessionReportPanel({
  session, summary, sessionExams, studentCount,
}: {
  session: BatchSession;
  summary: SessionSummary | undefined;
  sessionExams: ExamResult[];
  studentCount: number;
}) {
  const [attRecords, setAttRecords] = useState<SessionAttendanceRecord[]>([]);
  const [attSummary, setAttSummary] = useState<SessionAttendanceSummary | null>(null);
  const [attLoading, setAttLoading] = useState(false);

  const roomId = summary?.room_id || session.livekit_room_name;

  useEffect(() => {
    if (!roomId || (session.status !== 'ended' && session.status !== 'live')) return;
    setAttLoading(true);
    fetch(`/api/v1/room/${encodeURIComponent(roomId)}/attendance`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setAttRecords((data.data.attendance || []).filter((a: SessionAttendanceRecord) => a.participant_role === 'student'));
          setAttSummary(data.data.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setAttLoading(false));
  }, [roomId, session.status]);

  if (session.status === 'scheduled' || session.status === 'cancelled') {
    return (
      <div className="text-center py-4">
        <Info className="h-5 w-5 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          {session.status === 'scheduled' ? 'Session report will be available after the session ends' : 'Session was cancelled'}
        </p>
        {session.status === 'cancelled' && session.cancel_reason && (
          <p className="text-xs text-gray-400 mt-1">Reason: {session.cancel_reason}</p>
        )}
      </div>
    );
  }

  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  const statusColor: Record<string, string> = {
    present: 'bg-primary/10 text-primary',
    late: 'bg-amber-100 text-amber-700',
    absent: 'bg-red-100 text-red-700',
    not_joined: 'bg-gray-100 text-gray-500',
    left_early: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-4">
      {/* ── Session Timing ── */}
      <div>
        <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> Session Timing
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium">Started</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmtTime(session.started_at)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium">Ended</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmtTime(session.ended_at)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium">Actual Duration</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {session.started_at && session.ended_at
                ? fmtDuration(Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000))
                : `${session.duration_minutes}m (scheduled)`}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium">Scheduled</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatTime12h(session.start_time)} · {session.duration_minutes}m</p>
          </div>
        </div>
      </div>

      {/* ── Attendance Summary ── */}
      {(attSummary || summary) && (
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-500" /> Attendance Summary
          </h5>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Present', value: attSummary?.present ?? summary?.students_joined ?? 0, color: 'text-primary' },
              { label: 'Late', value: attSummary?.late ?? 0, color: 'text-amber-600' },
              { label: 'Absent', value: attSummary?.absent ?? 0, color: 'text-red-600' },
              { label: 'Not Joined', value: attSummary?.not_joined ?? (studentCount - (summary?.students_joined ?? 0)), color: 'text-gray-500' },
              { label: 'Left Early', value: attSummary?.left_early ?? 0, color: 'text-orange-600' },
              { label: 'Avg Attention', value: summary && summary.avg_attention > 0 ? `${summary.avg_attention}%` : '—', color: summary && summary.avg_attention >= 70 ? 'text-primary' : summary && summary.avg_attention >= 40 ? 'text-amber-600' : 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 uppercase font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-Student Attendance ── */}
      {attLoading ? (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-gray-400">Loading student attendance...</span>
        </div>
      ) : attRecords.length > 0 ? (
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-purple-500" /> Student Attendance ({attRecords.length})
          </h5>
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Student</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Status</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500 hidden sm:table-cell">Joined</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500 hidden sm:table-cell">Left</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Duration</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Attention</th>
                  {sessionExams.length > 0 && <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Exam</th>}
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Rejoins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attRecords.map(a => (
                  <tr key={a.participant_email}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={a.participant_name || 'Student'} size="sm" />
                        <span className="text-xs font-medium text-gray-800">{a.participant_name || a.participant_email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[a.status] || 'bg-gray-100 text-gray-500'}`}>
                        {a.status === 'not_joined' ? 'Not Joined' : a.status.charAt(0).toUpperCase() + a.status.slice(1).replace('_', ' ')}
                      </span>
                      {a.late_join && a.late_by_sec > 0 && (
                        <span className="text-[10px] text-amber-500 ml-1">({Math.round(a.late_by_sec / 60)}m late)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 hidden sm:table-cell">{fmtTime(a.first_join_at)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 hidden sm:table-cell">{fmtTime(a.last_leave_at)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 font-medium">
                      {a.total_duration_sec > 0 ? fmtDuration(Math.round(a.total_duration_sec / 60)) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {a.attention_avg > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${a.attention_avg >= 70 ? 'bg-primary' : a.attention_avg >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(a.attention_avg, 100)}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${a.attention_avg >= 70 ? 'text-primary' : a.attention_avg >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(a.attention_avg)}%</span>
                        </div>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    {sessionExams.length > 0 && (() => {
                      const exam = sessionExams.find(e => e.student_email === a.participant_email);
                      return (
                        <td className="px-3 py-2">
                          {exam ? (
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-bold ${exam.percentage >= 75 ? 'text-primary' : exam.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {exam.score}/{exam.total_marks}
                              </span>
                              <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[8px] font-bold ${
                                exam.grade_letter === 'A' || exam.grade_letter === 'A+' ? 'bg-primary/10 text-primary'
                                : exam.grade_letter === 'B' || exam.grade_letter === 'B+' ? 'bg-blue-100 text-blue-700'
                                : exam.grade_letter === 'C' || exam.grade_letter === 'C+' ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                              }`}>{exam.grade_letter}</span>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                      );
                    })()}
                    <td className="px-3 py-2 text-xs text-gray-500">{a.join_count > 1 ? a.join_count : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── Exam Results ── */}
      {sessionExams.length > 0 && (
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-amber-500" /> Exam Results ({sessionExams.length})
          </h5>
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Student</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Topic</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Score</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Grade</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessionExams.map((e, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={e.student_name} size="sm" />
                        <span className="text-xs font-medium text-gray-800">{e.student_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-28 truncate">{e.topic_title}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold ${e.percentage >= 75 ? 'text-primary' : e.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {e.score}/{e.total_marks} ({Math.round(e.percentage)}%)
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                        e.grade_letter === 'A' || e.grade_letter === 'A+' ? 'bg-primary/10 text-primary'
                        : e.grade_letter === 'B' || e.grade_letter === 'B+' ? 'bg-blue-100 text-blue-700'
                        : e.grade_letter === 'C' || e.grade_letter === 'C+' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{e.grade_letter}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{e.time_taken_seconds ? `${Math.floor(e.time_taken_seconds / 60)}m ${e.time_taken_seconds % 60}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Notes / Topic ── */}
      {(session.topic || session.notes) && (
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-gray-400" /> Session Details
          </h5>
          <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1.5">
            {session.topic && <p className="text-sm text-gray-700"><span className="font-medium text-gray-500">Topic:</span> {session.topic}</p>}
            {session.notes && <p className="text-sm text-gray-700"><span className="font-medium text-gray-500">Notes:</span> {session.notes}</p>}
          </div>
        </div>
      )}

      {/* ── No data fallback ── */}
      {!summary && !attSummary && sessionExams.length === 0 && !session.topic && !session.notes && !attLoading && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400">{session.status === 'live' ? 'Session is in progress — full report available after it ends' : 'No detailed report data available for this session'}</p>
        </div>
      )}
    </div>
  );
}

function BatchDetailInline({
  batch, sessions, detail, detailLoading, onStartSession, starting,
}: {
  batch: Batch;
  sessions: BatchSession[];
  detail: BatchDetail | null;
  detailLoading: boolean;
  onStartSession: (id: string, s: BatchSession) => void;
  starting: string | null;
}) {
  const [subTab, setSubTab] = useState<DetailSubTab>('sessions');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionMaterialsFor, setSessionMaterialsFor] = useState<string | null>(null);
  const [perfStudent, setPerfStudent] = useState<{ email: string; name: string } | null>(null);

  const batchSessions = sessions
    .filter(s => s.batch_id === batch.batch_id)
    .sort((a, b) => {
      const order: Record<string, number> = { live: 0, scheduled: 1, ended: 2, cancelled: 3 };
      const sa = order[a.status] ?? 4;
      const sb = order[b.status] ?? 4;
      if (sa !== sb) return sa - sb;
      // Scheduled: nearest first (ascending), ended: newest first (descending)
      if (a.status === 'scheduled') return (a.scheduled_date + a.start_time).localeCompare(b.scheduled_date + b.start_time);
      return (b.scheduled_date + b.start_time).localeCompare(a.scheduled_date + a.start_time);
    });

  const filteredSessions = sessionFilter === 'all' ? batchSessions : batchSessions.filter(s => s.status === sessionFilter);

  const subTabs: { key: DetailSubTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'sessions', label: 'Sessions', icon: CalendarDays, count: batchSessions.length },
    { key: 'timetable', label: 'Timetable', icon: Calendar },
    { key: 'attendance', label: 'Attendance', icon: UserCheck, count: detail?.attendance.length },
  ];

  return (
    <div className="border-t border-gray-100">
      {/* ── Stats bar ── */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50/80 to-blue-50/40 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Total', value: batch.total_sessions, color: 'text-gray-800' },
          { label: 'Completed', value: batch.completed_sessions, color: 'text-primary' },
          { label: 'Upcoming', value: batch.upcoming_sessions, color: 'text-blue-600' },
          { label: 'Live', value: batch.live_sessions, color: 'text-red-600' },
          { label: 'Students', value: batch.student_count, color: 'text-purple-600' },
          { label: 'Cancelled', value: batch.cancelled_sessions, color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Sub-tab navigation ── */}
      <div className="flex items-center gap-0.5 px-4 bg-gray-50/80 border-y border-gray-100 overflow-x-auto">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
              subTab === t.key
                ? 'border-primary text-primary bg-white/60'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-0.5 text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                subTab === t.key ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sub-tab content ── */}
      <div className="p-4">
        {/* ═══ SESSIONS ═══ */}
        {subTab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" /> Sessions
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {batchSessions.filter(s => s.status === 'scheduled').length > 0 && <span className="text-teal-600 font-medium">{batchSessions.filter(s => s.status === 'scheduled').length} upcoming</span>}
                  {batchSessions.filter(s => s.status === 'scheduled').length > 0 && batchSessions.filter(s => s.status === 'live').length > 0 && <span> · </span>}
                  {batchSessions.filter(s => s.status === 'live').length > 0 && <span className="text-primary font-medium">{batchSessions.filter(s => s.status === 'live').length} live</span>}
                  {batchSessions.filter(s => s.status === 'ended').length > 0 && <span className="text-gray-400"> · {batchSessions.filter(s => s.status === 'ended').length} completed</span>}
                </p>
              </div>
              <FilterSelect value={sessionFilter} onChange={setSessionFilter} options={[
                { value: 'all', label: 'All Status' },
                { value: 'scheduled', label: 'Upcoming' },
                { value: 'live', label: 'Live' },
                { value: 'ended', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]} />
            </div>
            {filteredSessions.length === 0 ? (
              <EmptyState icon={CalendarDays} message="No sessions found" />
            ) : (
              <TableWrapper>
                <THead>
                  <TH></TH>
                  <TH>Date</TH>
                  <TH>Time</TH>
                  <TH>Subject</TH>
                  <TH>Duration</TH>
                  <TH>Status</TH>
                  <TH>Recording</TH>
                  <TH className="text-right">Action</TH>
                </THead>
                <tbody>
                  {filteredSessions.map(s => {
                    const isSessionToday = nd(s.scheduled_date) === todayISO();
                    const isExpanded = expandedSession === s.session_id;
                    const summary = detail?.session_summaries.find(sm => sm.session_id === s.session_id);
                    const sessionExams = detail?.exam_results.filter(e => e.session_id === s.session_id) || [];
                    return (
                      <React.Fragment key={s.session_id}>
                      <TRow className={`cursor-pointer ${isExpanded ? 'bg-primary/5/50' : 'hover:bg-gray-50/80'}`} onClick={() => setExpandedSession(isExpanded ? null : s.session_id)}>
                        <td className="px-2 py-2.5 w-6">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-primary" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-gray-700">{fmtDate(nd(s.scheduled_date))}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-400">{getDayLabel(nd(s.scheduled_date))}</span>
                            {isSessionToday && s.status === 'scheduled' && (
                              <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">TODAY</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{formatTime12h(s.start_time)}</td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-gray-800">{s.subject}</p>
                          {s.topic && <p className="text-xs text-gray-400 truncate max-w-36">{s.topic}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">
                          {s.duration_minutes}m
                          <span className="text-xs text-gray-400 ml-1">({s.teaching_minutes}+{s.prep_buffer_minutes})</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <StatusBadge status={s.status} />
                            {s.status === 'live' && <Radio className="h-3 w-3 text-red-500 animate-pulse" />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {s.status === 'live' && s.recording_status === 'recording' && (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
                              REC
                            </span>
                          )}
                          {s.status === 'ended' && s.recording_url && (
                            <a href={s.recording_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                              <Video className="h-3.5 w-3.5" />
                              <span>Watch</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {!(s.status === 'live' && s.recording_status === 'recording') && !(s.status === 'ended' && s.recording_url) && (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            {/* Files button — always visible */}
                            <button
                              onClick={() => setSessionMaterialsFor(s.session_id)}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                              title="Session files"
                            >
                              <Paperclip className="h-3 w-3" /> Files
                            </button>
                            {s.status === 'live' && (
                              <Button size="xs" variant="danger" icon={Video} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                                Rejoin
                              </Button>
                            )}
                            {canStartSession(s) && (
                              <Button size="xs" icon={Play} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                                Start
                              </Button>
                            )}
                            {s.status === 'scheduled' && !canStartSession(s) && <SessionCountdown session={s} />}
                          </div>
                        </td>
                      </TRow>
                      {/* ── Expanded Session Report ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-0 py-0">
                            <div className="bg-gradient-to-b from-emerald-50/60 to-white border-y border-primary/15 px-6 py-4">
                              <SessionReportPanel
                                session={s}
                                summary={summary}
                                sessionExams={sessionExams}
                                studentCount={batch.student_count}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </TableWrapper>
            )}
            <div className="text-center text-xs text-gray-400 py-1 mt-2">
              {batchSessions.length} total session{batchSessions.length !== 1 ? 's' : ''}
              {batchSessions.filter(s => s.status === 'ended' && s.recording_url).length > 0 && ` · ${batchSessions.filter(s => s.status === 'ended' && s.recording_url).length} with recordings`}
            </div>
          </div>
        )}

        {/* ═══ TIMETABLE ═══ */}
        {subTab === 'timetable' && (
          <div>
            {detailLoading ? <LoadingState /> : !detail || detail.timetable.length === 0 ? (
              <EmptyState icon={Calendar} message="No timetable pattern found — sessions need to be scheduled first" />
            ) : (() => {
              const activeDays = [1, 2, 3, 4, 5, 6, 0].filter(dow => detail.timetable.some(t => t.dow === dow));
              const todayDow = new Date().getDay();
              const subjects = [...new Set(detail.timetable.map(t => t.subject))].sort();
              const colorSets = [
                { bg: 'bg-primary', light: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary' },
                { bg: 'bg-blue-500', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
                { bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
                { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                { bg: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
              ];
              const getColor = (subj: string) => colorSets[subjects.indexOf(subj) % colorSets.length];
              const totalHrs = Math.round(detail.timetable.reduce((s, t) => s + t.duration_minutes, 0) / 60 * 10) / 10;

              return (
                <div className="space-y-3">
                  {/* Summary strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-gray-900">Weekly Schedule</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span>{activeDays.length} days</span>
                      <span className="text-gray-300">·</span>
                      <span>{detail.timetable.length} slots</span>
                      <span className="text-gray-300">·</span>
                      <span>{totalHrs}h/week</span>
                    </div>
                    {subjects.length > 1 && (
                      <div className="flex items-center gap-3 sm:ml-auto">
                        {subjects.map(s => (
                          <span key={s} className="flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-full ${getColor(s).bg}`} />
                            <span className="text-[10px] text-gray-500 font-medium">{s}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Day columns */}
                  <div className={`grid gap-2 grid-cols-2 sm:grid-cols-3 ${activeDays.length <= 3 ? 'md:grid-cols-3' : activeDays.length <= 5 ? 'md:grid-cols-5' : 'md:grid-cols-6'}`}>
                    {activeDays.map(dow => {
                      const isToday = dow === todayDow;
                      const daySlots = detail.timetable
                        .filter(t => t.dow === dow)
                        .sort((a, b) => a.start_time.localeCompare(b.start_time));

                      return (
                        <div key={dow} className={`rounded-xl border overflow-hidden ${isToday ? 'border-emerald-300 ring-1 ring-primary/20' : 'border-gray-200'}`}>
                          {/* Day header */}
                          <div className={`px-3 py-2 text-center ${isToday ? 'bg-primary' : 'bg-gray-100'}`}>
                            <span className={`text-xs font-bold ${isToday ? 'text-white' : 'text-gray-600'}`}>
                              {DAY_NAMES[dow].slice(0, 3).toUpperCase()}
                            </span>
                            {isToday && <span className="ml-1 text-[9px] text-primary/40 font-medium">TODAY</span>}
                          </div>
                          {/* Slots */}
                          <div className={`p-1.5 space-y-1.5 ${isToday ? 'bg-primary/5/30' : 'bg-white'}`}>
                            {daySlots.map((sl, i) => {
                              const c = getColor(sl.subject);
                              return (
                                <div key={i} className={`rounded-lg ${c.light} border ${c.border} px-2 py-1.5`}>
                                  <p className={`text-[11px] font-bold ${c.text} truncate leading-tight`}>{sl.subject}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{formatTime12h(sl.start_time)} · {sl.duration_minutes}m</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ ATTENDANCE ═══ */}
        {subTab === 'attendance' && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Per-Student Attendance Summary
            </h4>
            {detailLoading ? <LoadingState /> : !detail || detail.attendance.length === 0 ? (
              <EmptyState icon={UserCheck} message="No attendance data yet — will appear after sessions are completed" />
            ) : (
              <TableWrapper>
                <THead>
                  <TH>Student</TH>
                  <TH>Sessions</TH>
                  <TH>Present</TH>
                  <TH>Late</TH>
                  <TH>Absent</TH>
                  <TH>Left Early</TH>
                  <TH>Rate</TH>
                  <TH>Avg Attention</TH>
                  <TH></TH>
                </THead>
                <tbody>
                  {detail.attendance.map(a => {
                    const total = Number(a.total_sessions);
                    const present = Number(a.present);
                    const late = Number(a.late);
                    const absent = Number(a.absent);
                    const notJoined = Number(a.not_joined);
                    const leftEarly = Number(a.left_early);
                    const avgAtt = Number(a.avg_attention);
                    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
                    return (
                      <TRow key={a.student_email}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={a.student_name} size="sm" />
                            <p className="text-sm font-medium text-gray-800">{a.student_name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-700 font-medium">{total}</td>
                        <td className="px-4 py-2.5 text-sm text-primary font-semibold">{present}</td>
                        <td className="px-4 py-2.5 text-sm text-amber-600 font-semibold">{late}</td>
                        <td className="px-4 py-2.5 text-sm text-red-600 font-semibold">{absent + notJoined}</td>
                        <td className="px-4 py-2.5 text-sm text-orange-600 font-semibold">{leftEarly}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${rate >= 75 ? 'bg-primary' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${rate >= 75 ? 'text-primary' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {avgAtt > 0
                            ? <span className={`text-xs font-bold ${avgAtt >= 70 ? 'text-primary' : avgAtt >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{avgAtt}%</span>
                            : <span className="text-xs text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => setPerfStudent({ email: a.student_email, name: a.student_name })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-md transition-colors"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Performance
                          </button>
                        </td>
                      </TRow>
                    );
                  })}
                </tbody>
              </TableWrapper>
            )}

            {/* ── Student Performance Modal ── */}
            {perfStudent && (
              <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={perfStudent.name} size="md" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{perfStudent.name}&apos;s Performance</h3>
                      <p className="text-xs text-gray-400">{perfStudent.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setPerfStudent(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 text-xs font-medium" title="Close">
                    <XIcon className="w-4 h-4" />
                    Close
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50/50">
                    <StudentReportsTab studentEmail={perfStudent.email} batchId={batch.batch_id} showStudentHeader={false} />
                </div>
              </div>
            )}
          </div>
        )}


      </div>

      {/* ── Session Materials Modal ── */}
      {sessionMaterialsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSessionMaterialsFor(null)}>
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Session Materials</h3>
                  <p className="text-xs text-gray-400">Upload files students can download after this session</p>
                </div>
              </div>
              <button onClick={() => setSessionMaterialsFor(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <SessionMaterialsPanel sessionId={sessionMaterialsFor} teacherEmail="" lightMode />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyBatchesTab({
  batches, sessions, onRefresh, onStartSession, starting, loading,
}: {
  batches: Batch[];
  sessions: BatchSession[];
  onRefresh: () => void;
  onStartSession: (id: string, s: BatchSession) => void;
  starting: string | null;
  loading: boolean;
}) {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allBatchSessions, setAllBatchSessions] = useState<BatchSession[]>([]);

  useEffect(() => {
    if (!expandedBatch) { setBatchDetail(null); setAllBatchSessions([]); return; }
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([
      fetch(`/api/v1/teacher/batch-detail?batch_id=${encodeURIComponent(expandedBatch)}`).then(r => r.json()),
      fetch(`/api/v1/teacher/my-sessions?batch_id=${encodeURIComponent(expandedBatch)}&range=all`).then(r => r.json()),
    ])
      .then(([detailData, sessData]) => {
        if (cancelled) return;
        if (detailData.success) setBatchDetail(detailData.data);
        if (sessData.success) setAllBatchSessions(sessData.data.sessions || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [expandedBatch]);

  const filteredBatches = batches.filter(b => b.status === 'active');

  const activeBatches = batches.filter(b => b.status === 'active').length;
  const totalStudents = batches.reduce((sum, b) => sum + b.student_count, 0);
  const totalSessions = batches.reduce((sum, b) => sum + b.total_sessions, 0);
  const completedSessions = batches.reduce((sum, b) => sum + b.completed_sessions, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader icon={BookOpen} title="My Batches" subtitle={`${activeBatches} active batch${activeBatches !== 1 ? 'es' : ''} · ${totalStudents} students`} />
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSmall icon={BookOpen}     label="Active Batches" value={activeBatches}    variant="info" />
        <StatCardSmall icon={Users}        label="Total Students" value={totalStudents}    variant="default" />
        <StatCardSmall icon={CalendarDays} label="Total Sessions" value={totalSessions}    variant="info" />
        <StatCardSmall icon={CheckCircle2} label="Completed"      value={completedSessions} variant="success" />
      </div>

      {filteredBatches.length === 0 ? (
        <EmptyState icon={BookOpen} message="No batches assigned yet — contact your Academic Operator" />
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((b, idx) => {
            const isExpanded = expandedBatch === b.batch_id;
            return (
              <Card key={`${b.batch_id}-${idx}`} className={`overflow-hidden transition-shadow ${isExpanded ? 'ring-1 ring-primary/20 shadow-md' : ''}`}>
                <button
                  onClick={() => setExpandedBatch(isExpanded ? null : b.batch_id)}
                  className="w-full flex items-center gap-4 text-left p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${isExpanded ? 'bg-primary' : 'bg-primary/10'}`}>
                    <BookOpen className={`h-5 w-5 ${isExpanded ? 'text-white' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{b.batch_name}</p>
                      <StatusBadge status={b.status} />
                      {b.live_sessions > 0 && <Badge icon={Radio} label="LIVE" variant="danger" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.assigned_subject} · Grade {b.grade}{b.section ? `-${b.section}` : ''} · {batchTypeLabel(b.batch_type)}
                      {b.board && ` · ${b.board}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    <span className="hidden sm:flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b.student_count}</span>
                    <span className="hidden sm:flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{b.completed_sessions}/{b.total_sessions}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>
                {isExpanded && (
                  <BatchDetailInline
                    batch={b}
                    sessions={allBatchSessions}
                    detail={batchDetail}
                    detailLoading={detailLoading}
                    onStartSession={onStartSession}
                    starting={starting}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Weekly Schedule (FullCalendar-based)
// ═════════════════════════════════════════════════════════════

function WeeklyScheduleTab({
  sessions, onRefresh, onStartSession, starting, loading,
}: {
  sessions: BatchSession[];
  onRefresh: () => void;
  onStartSession: (id: string, s: BatchSession) => void;
  starting: string | null;
  loading: boolean;
}) {
  // Map BatchSession → SessionCalendar format
  const calendarSessions = React.useMemo(() =>
    sessions.map(s => ({
      session_id: s.session_id,
      batch_id: s.batch_id,
      subject: s.subject,
      teacher_email: s.teacher_email,
      teacher_name: s.teacher_name,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      duration_minutes: s.duration_minutes,
      teaching_minutes: s.teaching_minutes,
      prep_buffer_minutes: s.prep_buffer_minutes,
      status: s.status,
      livekit_room_name: s.livekit_room_name,
      topic: s.topic,
      notes: s.notes,
      started_at: s.started_at,
      ended_at: s.ended_at,
      cancelled_at: s.cancelled_at,
      cancel_reason: s.cancel_reason,
      created_at: '',
      batch_name: s.batch_name,
      batch_type: s.batch_type,
      grade: s.grade,
      section: s.section ?? undefined,
      student_count: s.student_count,
    })),
    [sessions],
  );

  // Today's sessions for the agenda panel
  const todaySessions = React.useMemo(() => {
    const today = todayISO();
    return sessions
      .filter(s => s.scheduled_date === today)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [sessions]);

  const weekLive = sessions.filter(s => s.status === 'live').length;
  const weekUpcoming = sessions.filter(s => s.status === 'scheduled').length;
  const weekCompleted = sessions.filter(s => s.status === 'ended').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader icon={Calendar} title="Weekly Schedule" subtitle={`${sessions.length} sessions · ${todaySessions.length} today`}>
          <RefreshButton loading={loading} onClick={onRefresh} />
        </PageHeader>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSmall icon={CalendarDays} label="This Week"  value={sessions.length} variant="info" />
        <StatCardSmall icon={Clock}        label="Upcoming"   value={weekUpcoming}    variant="default" />
        <StatCardSmall icon={Radio}        label="Live Now"   value={weekLive}        variant={weekLive > 0 ? 'danger' : 'default'} />
        <StatCardSmall icon={CheckCircle2} label="Completed"  value={weekCompleted}   variant="success" />
      </div>

      {/* Today's Agenda */}
      {todaySessions.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Today&apos;s Agenda
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {todaySessions.map(s => (
              <div key={s.session_id} className="flex items-center gap-3 shrink-0 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 min-w-[220px]">
                <div className="text-center shrink-0">
                  <p className="text-xs font-bold text-gray-800">{formatTime12h(s.start_time)}</p>
                  <p className="text-[10px] text-gray-400">{fmtDuration(s.duration_minutes)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.subject}</p>
                  <p className="text-xs text-gray-400 truncate">{s.batch_name} · {s.student_count} students</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <StatusBadge status={s.status} />
                  {s.status === 'live' && (
                    <Button size="xs" variant="danger" icon={Video} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                      Join
                    </Button>
                  )}
                  {canStartSession(s) && (
                    <Button size="xs" icon={Play} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                      Start
                    </Button>
                  )}
                  {s.status === 'scheduled' && !canStartSession(s) && <SessionCountdown session={s} />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FullCalendar */}
      <SessionCalendar
        sessions={calendarSessions}
        onRefresh={onRefresh}
        onEditSession={() => {}}
        readOnly
      />
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Profile
// ═════════════════════════════════════════════════════════════

function ProfileTab({ profile, onRefresh }: { profile: TeacherProfile | null; onRefresh: () => void }) {
  const [editing, setEditing]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('');

  const handleAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropSrc(ev.target?.result as string);
      setCropFileName(file.name);
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const uploadCroppedAvatar = async (file: File, previewUrl: string) => {
    setCropSrc(null);
    setAvatarPreview(previewUrl);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/v1/teacher/profile/avatar', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        onRefresh();
      } else {
        setSaveError(json.error || 'Failed to upload photo');
        setAvatarPreview(null);
      }
    } catch {
      setSaveError('Network error uploading photo');
      setAvatarPreview(null);
    }
    setAvatarUploading(false);
  };

  // Edit form state — only teacher-editable fields
  const [fPhone, setFPhone]         = useState('');
  const [fWhatsapp, setFWhatsapp]   = useState('');
  const [fQual, setFQual]           = useState('');
  const [fExp, setFExp]             = useState('');
  const [fRegion, setFRegion]       = useState('');
  const [fNotes, setFNotes]         = useState('');

  const startEdit = () => {
    if (!profile) return;
    setFPhone(profile.phone ?? '');
    setFWhatsapp(profile.whatsapp ?? '');
    setFQual(profile.qualification ?? '');
    setFExp(profile.experience_years != null ? String(profile.experience_years) : '');
    setFRegion(profile.assigned_region ?? '');
    setFNotes(profile.notes ?? '');
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setSaveError(null); };

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/v1/teacher/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone:            fPhone    || null,
          whatsapp:         fWhatsapp || null,
          qualification:    fQual     || null,
          experience_years: fExp !== '' ? Number(fExp) : null,
          assigned_region:  fRegion   || null,
          notes:            fNotes    || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditing(false);
        onRefresh();
      } else {
        setSaveError(json.error || 'Failed to save profile');
      }
    } catch {
      setSaveError('Network error — please try again');
    }
    setSaving(false);
  };

  if (!profile) return <EmptyState icon={User} message="Profile not found" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={User} title="My Profile" subtitle="Your teaching profile and contact details">
        <div className="flex items-center gap-2">
          <RefreshButton onClick={onRefresh} />
          {!editing && (
            <Button icon={Pencil} size="sm" variant="ghost" onClick={startEdit}>
              Edit Profile
            </Button>
          )}
        </div>
      </PageHeader>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
          <XIcon className="h-4 w-4 shrink-0" /> {saveError}
        </div>
      )}

      <Card className="p-6">
        {/* Profile header — always read-only */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
          {/* Avatar with upload overlay */}
          <div className="relative shrink-0">
            <Avatar name={profile.name} src={avatarPreview ?? profile.profile_image} size="lg" />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 transition disabled:opacity-50"
              title="Change photo"
            >
              {avatarUploading
                ? <span className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="h-3 w-3" />}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarPicked}
            />
            {cropSrc && (
              <ImageCropModal
                imageSrc={cropSrc}
                fileName={cropFileName}
                onCropComplete={uploadCroppedAvatar}
                onCancel={() => setCropSrc(null)}
              />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{profile.name}</h3>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">Click the camera icon to update your photo</p>
            {profile.subjects && profile.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.subjects.map(s => (
                  <Badge key={s} label={s} variant="primary" />
                ))}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          /* ── Edit Form ── */
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Phone">
                <input value={fPhone} onChange={e => setFPhone(e.target.value)}
                  className={editInputCls} placeholder="e.g. +92 300 1234567" />
              </EditField>
              <EditField label="WhatsApp">
                <input value={fWhatsapp} onChange={e => setFWhatsapp(e.target.value)}
                  className={editInputCls} placeholder="Same as phone if identical" />
              </EditField>
              <EditField label="Qualification">
                <select value={fQual} onChange={e => setFQual(e.target.value)} className={editInputCls}>
                  <option value="">— Select qualification —</option>
                  {QUALIFICATION_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </EditField>
              <EditField label="Experience">
                <select value={fExp} onChange={e => setFExp(e.target.value)} className={editInputCls}>
                  <option value="">— Select experience —</option>
                  {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </EditField>
              <EditField label="Region">
                <select value={fRegion} onChange={e => setFRegion(e.target.value)} className={editInputCls}>
                  <option value="">— Select region —</option>
                  {REGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </EditField>

              <EditField label="Notes" className="sm:col-span-2">
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)}
                  className={`${editInputCls} resize-none`} rows={3}
                  placeholder="Any additional notes about your profile\u2026" />
              </EditField>
            </div>

            {/* Admin-only reminder */}
            <p className="text-xs text-gray-400 italic">
              Name, email and date of birth are managed by admin.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="ghost" icon={XIcon} onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button icon={Save} onClick={saveProfile} disabled={saving} loading={saving}>
                {saving ? 'Saving\u2026' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Read View ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ProfileField icon={Phone}        label="Phone"          value={profile.phone} />
            <ProfileField icon={Phone}        label="WhatsApp"       value={profile.whatsapp} />
            <ProfileField icon={GraduationCap} label="Qualification" value={profile.qualification} />
            <ProfileField icon={Briefcase}    label="Experience"     value={profile.experience_years != null ? `${profile.experience_years} years` : null} />
            <ProfileField icon={BookOpen}     label="Subjects"       value={profile.subjects?.join(', ')} />
            <ProfileField icon={MapPin}       label="Region"         value={profile.assigned_region} />
            {profile.date_of_birth && (
              <ProfileField icon={Calendar} label="Date of Birth" value={fmtDate(profile.date_of_birth)} />
            )}
            {profile.notes && (
              <ProfileField icon={FileText} label="Notes" value={profile.notes} />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Edit Profile option lists ─────────────────────────────
const QUALIFICATION_OPTIONS = [
  'B.A.', 'M.A.', 'B.Sc.', 'M.Sc.', 'M.Phil.',
  'Ph.D.', 'B.Ed.', 'M.Ed.', 'B.Tech.', 'M.Tech.',
  'B.Com.', 'M.Com.', 'MBA', 'Other',
];

const EXPERIENCE_OPTIONS = [
  { value: '0',  label: 'Less than 1 year' },
  { value: '1',  label: '1 year' },
  { value: '2',  label: '2 years' },
  { value: '3',  label: '3 years' },
  { value: '4',  label: '4 years' },
  { value: '5',  label: '5 years' },
  { value: '6',  label: '6 years' },
  { value: '7',  label: '7 years' },
  { value: '8',  label: '8 years' },
  { value: '9',  label: '9 years' },
  { value: '10', label: '10 years' },
  { value: '12', label: '12 years' },
  { value: '15', label: '15 years' },
  { value: '20', label: '20 years' },
  { value: '25', label: '25+ years' },
];

const REGION_OPTIONS = [
  'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'India', 'Pakistan', 'Bangladesh', 'Other',
];

// Shared styling for edit inputs
const editInputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-emerald-300';

function EditField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// Shared sub-components
// ═════════════════════════════════════════════════════════════

function ProfileField({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3 text-primary" /> {label}
      </p>
      <p className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Salary
// ═════════════════════════════════════════════════════════════

const PAYSLIP_STATUS_STYLE: Record<string, string> = {
  paid:      'text-primary bg-primary/5 border border-primary/20',
  finalized: 'text-blue-700   bg-blue-50   border border-blue-200',
  draft:     'text-gray-600   bg-gray-50   border border-gray-200',
};

function SalaryTab({
  payslips, config, liveSalary, onRefresh, loading,
}: {
  payslips: Payslip[];
  config: PayConfig | null;
  liveSalary: LiveSalary | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const [subTab, setSubTab] = useState<'summary' | 'sessions' | 'history' | 'config'>('summary');

  const totalPaid    = payslips.filter(p => p.status === 'paid').reduce((s, p) => s + p.total_paise, 0);
  const totalPending = payslips.filter(p => p.status !== 'paid').reduce((s, p) => s + p.total_paise, 0);
  const totalDone    = payslips.reduce((s, p) => s + p.classes_conducted, 0);
  const totalMissed  = payslips.reduce((s, p) => s + p.classes_missed,    0);
  const cm = liveSalary?.current_month;
  const recentEarnings = liveSalary?.recent_earnings ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Salary &amp; Payroll
        </h2>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['summary', 'sessions', 'history', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
              subTab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Summary ── */}
      {subTab === 'summary' && (
        <div className="space-y-5">

          {/* Current Month Live Estimate */}
          {cm && (
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-primary">{cm.label} — Live Estimate</p>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Real-time</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Sessions Done',     value: String(cm.classes_conducted), color: 'text-primary' },
                  { label: 'Upcoming',           value: String(cm.classes_upcoming),  color: 'text-blue-600' },
                  { label: 'Extensions',         value: cm.extension_sessions > 0 ? `${cm.extension_sessions} (+${cm.extension_minutes}m)` : '0', color: 'text-teal-600' },
                  { label: 'Missed',             value: String(cm.classes_missed),    color: cm.classes_missed > 0 ? 'text-red-600' : 'text-gray-400' },
                ].map(c => (
                  <div key={c.label} className="text-center">
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-gray-500">{c.label}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-primary/20 pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{money(cm.base_pay_paise)}</p>
                    <p className="text-xs text-gray-400">Base Pay</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-teal-700">{money(cm.extension_paise)}</p>
                    <p className="text-xs text-gray-400">Extension Pay</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-700">{money(cm.incentive_paise)}</p>
                    <p className="text-xs text-gray-400">Incentive</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-500">{cm.lop_paise > 0 ? `-${money(cm.lop_paise)}` : money(0)}</p>
                    <p className="text-xs text-gray-400">LOP</p>
                  </div>
                  {(cm.medical_leave_adjustment_paise || 0) > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-blue-600">+{money(cm.medical_leave_adjustment_paise)}</p>
                      <p className="text-xs text-gray-400">Medical Adj.</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-bold text-primary">{money(cm.total_paise)}</p>
                    <p className="text-xs text-gray-500 font-medium">Estimated Total</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!liveSalary?.configured && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
              <strong>Pay not configured.</strong> Your salary rate has not been set up yet. Contact your coordinator or HR.
            </div>
          )}

          {/* Historical totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Earned',    value: money(totalPaid),    color: 'text-primary' },
              { label: 'Pending / Draft', value: money(totalPending), color: 'text-amber-600'   },
              { label: 'Sessions Done',    value: String(totalDone),   color: 'text-blue-700'    },
              { label: 'Sessions Missed',  value: String(totalMissed), color: 'text-red-600'     },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Current pay config */}
          {config && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Pay Schedule</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-primary">{money(config.per_hour_rate)}</p>
                  <p className="text-xs text-gray-400 mt-1">Rate per hour</p>
                </div>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-blue-700">
                    {config.incentive_rules?.bonus_threshold ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bonus threshold</p>
                </div>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-purple-700">
                    {config.incentive_rules?.bonus_per_class
                      ? money(config.incentive_rules.bonus_per_class)
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bonus per session</p>
                </div>
              </div>
            </div>
          )}

          {payslips.length === 0 && !cm && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No payslip records yet.
            </div>
          )}
        </div>
      )}

      {/* ── Sessions (Per-Session Earnings) ── */}
      {subTab === 'sessions' && (
        <div className="space-y-3">
          {recentEarnings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No per-session earnings yet. Earnings are recorded automatically after each live session ends.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Earnings are auto-calculated when each session ends. Showing last {recentEarnings.length} sessions.
              </p>
              <TableWrapper>
                <THead>
                    <TH>Date</TH>
                    <TH>Subject</TH>
                    <TH>Batch</TH>
                    <TH>Duration</TH>
                    <TH>Rate</TH>
                    <TH>Base</TH>
                    <TH>Extension</TH>
                    <TH>Total</TH>
                </THead>
                <tbody>
                  {recentEarnings.map(e => (
                    <TRow key={e.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {e.scheduled_date ? new Date(e.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">{e.subject || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{e.batch_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {fmtDuration(e.actual_minutes)}
                        {e.actual_minutes !== e.duration_minutes && (
                          <span className="text-xs text-gray-400 ml-1">/ {fmtDuration(e.duration_minutes)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{money(e.per_hour_rate_paise)}/hr</td>
                      <td className="px-4 py-3 text-sm text-primary">{money(e.base_paise)}</td>
                      <td className="px-4 py-3 text-sm text-teal-600">
                        {e.extension_minutes > 0
                          ? <>{money(e.extension_paise)} <span className="text-xs text-gray-400">(+{e.extension_minutes}m)</span></>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">{money(e.total_paise)}</td>
                    </TRow>
                  ))}
                </tbody>
              </TableWrapper>
              <p className="text-xs text-gray-400 text-right">
                Total from recent sessions: <span className="font-semibold text-gray-600">{money(recentEarnings.reduce((s, e) => s + e.total_paise, 0))}</span>
              </p>
            </>
          )}
        </div>
      )}

      {/* ── History ── */}
      {subTab === 'history' && (
        <div className="space-y-3">
          {payslips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No payslips found.
            </div>
          ) : (
            <TableWrapper>
              <THead>
                  <TH>Period</TH>
                  <TH>Sessions</TH>
                  <TH>Base Pay</TH>
                  <TH>Extension</TH>
                  <TH>Incentive</TH>
                  <TH>LOP</TH>
                  <TH>Total</TH>
                  <TH>Status</TH>
                  <TH></TH>
              </THead>
              <tbody>
                {payslips.map(p => (
                  <TRow key={p.id}>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{p.period_label}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="text-primary font-semibold">{p.classes_conducted}</span>
                      {(p.extension_sessions || 0) > 0 && (
                        <span className="text-teal-500 text-xs ml-1">(+{p.extension_sessions} ext)</span>
                      )}
                      {p.classes_missed > 0 && (
                        <span className="text-red-500 text-xs ml-1">(−{p.classes_missed})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{money(p.base_pay_paise)}</td>
                    <td className="px-4 py-3 text-sm text-teal-600">{money(p.extension_paise || 0)}</td>
                    <td className="px-4 py-3 text-sm text-primary">{money(p.incentive_paise)}</td>
                    <td className="px-4 py-3 text-sm text-red-500">
                      {p.lop_paise > 0 ? `−${money(p.lop_paise)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{money(p.total_paise)}</td>
                    <td className="px-4 py-3">
                      {p.status === 'paid' ? (
                        <div className="flex flex-col">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAYSLIP_STATUS_STYLE.paid}`}>
                            Paid
                          </span>
                          {p.paid_at && (
                            <span className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          {p.payment_reference && (
                            <span className="text-[10px] text-gray-400 truncate max-w-[100px]" title={p.payment_reference}>
                              Ref: {p.payment_reference}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PAYSLIP_STATUS_STYLE[p.status] ?? PAYSLIP_STATUS_STYLE.draft}`}>
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/api/v1/payroll/payslip-pdf/${p.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                        <FileText className="h-3 w-3" /> View
                      </a>
                    </td>
                  </TRow>
                ))}
              </tbody>
            </TableWrapper>
          )}
          <p className="text-xs text-gray-400 text-right">
            {payslips.length} payslip{payslips.length !== 1 ? 's' : ''} · Total paid: <span className="font-semibold text-gray-600">{money(totalPaid)}</span>
          </p>
        </div>
      )}

      {/* ── Config ── */}
      {subTab === 'config' && (
        <div className="space-y-4">
          {config ? (
            <>
              <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <p className="text-sm font-semibold text-gray-700">Pay Schedule Details</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rate per hour</span>
                    <span className="font-semibold text-gray-800">{money(config.per_hour_rate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bonus threshold (sessions)</span>
                    <span className="font-semibold text-gray-800">{config.incentive_rules?.bonus_threshold ?? 'Not set'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bonus per extra session</span>
                    <span className="font-semibold text-gray-800">
                      {config.incentive_rules?.bonus_per_class ? money(config.incentive_rules.bonus_per_class) : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Extension pay</span>
                    <span className="font-semibold text-gray-800">Pro-rata (based on session rate)</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-700">
                <strong>LOP Policy:</strong> Loss of pay is applied for missed sessions not cancelled 24 hours in advance.
                Contact your coordinator if you believe a deduction is incorrect.
              </div>
              <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 text-xs text-teal-700">
                <strong>Extension Pay:</strong> When a session is extended (30/60/120 min), you receive pro-rata pay
                based on your per-hour rate.
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              Pay configuration not available. Contact your coordinator.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Ratings (2-Dimension: Punctuality + Student Rating)
// ═════════════════════════════════════════════════════════════

function StarDisplay({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < Math.round(value) ? 'text-amber-400' : 'text-gray-200'}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ScoreRing({ value, label, color, sub }: { value: number; label: string; color: string; sub: string }) {
  const pct = Math.round((value / 5) * 100);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-gray-900">{value > 0 ? value.toFixed(1) : '—'}</span>
          <span className="text-[10px] text-gray-400">/5.0</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function PunctualityBadge({ lateMin }: { lateMin: number }) {
  if (lateMin <= 1) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/5 text-primary">On Time</span>;
  if (lateMin <= 3) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">+{Math.round(lateMin)}m</span>;
  if (lateMin <= 5) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">+{Math.round(lateMin)}m</span>;
  if (lateMin <= 15) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">+{Math.round(lateMin)}m late</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">+{Math.round(lateMin)}m late</span>;
}

function RatingsTab({
  data, onRefresh, loading,
}: {
  data: RatingsData | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const [subTab, setSubTab] = useState<'overview' | 'sessions' | 'feedback'>('overview');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const sm = data?.summary;
  const sessions = data?.sessions ?? [];
  const pDist = data?.punctuality_distribution;
  const rDist = data?.rating_distribution;
  const monthly = data?.monthly ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" /> Ratings &amp; Performance
        </h2>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['overview', 'sessions', 'feedback'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
              subTab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'feedback' ? 'Student Feedback' : t}
          </button>
        ))}
      </div>

      {!sm || sm.total_sessions === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-400">
          No ratings data yet. Ratings are computed from your session start times and student feedback after each class.
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {subTab === 'overview' && (
            <div className="space-y-5">
              {/* 3 Score Rings */}
              <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-center gap-10 sm:gap-16">
                  <ScoreRing value={sm.punctuality_avg} label="Punctuality" color="#3b82f6" sub={`${sm.total_sessions} sessions`} />
                  <ScoreRing value={sm.student_rating_avg} label="Student Rating" color="#f59e0b" sub={`${sm.total_feedback} reviews`} />
                  <ScoreRing value={sm.overall_avg} label="Overall" color="#10b981" sub={`${sm.sessions_with_feedback} rated`} />
                </div>
              </div>

              {/* Distributions: punctuality + rating side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Punctuality Distribution */}
                {pDist && (
                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class Start Timing</p>
                    {[
                      { label: 'On Time (≤1 min)', count: pDist.on_time, color: 'bg-primary', total: sm.total_sessions },
                      { label: 'Slightly Late (1-5m)', count: pDist.slightly_late, color: 'bg-blue-400', total: sm.total_sessions },
                      { label: 'Late (5-15m)', count: pDist.late, color: 'bg-amber-400', total: sm.total_sessions },
                      { label: 'Very Late (>15m)', count: pDist.very_late, color: 'bg-red-400', total: sm.total_sessions },
                    ].map(d => {
                      const pctBar = d.total > 0 ? Math.round((d.count / d.total) * 100) : 0;
                      return (
                        <div key={d.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{d.label}</span>
                            <span className="font-semibold text-gray-700">{d.count} ({pctBar}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${d.color}`} style={{ width: `${pctBar}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Student Rating Distribution */}
                {rDist && (
                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Ratings Breakdown</p>
                    {[
                      { label: '★★★★★ Excellent', count: rDist.five, color: 'bg-primary' },
                      { label: '★★★★ Good', count: rDist.four, color: 'bg-blue-400' },
                      { label: '★★★ Average', count: rDist.three, color: 'bg-amber-400' },
                      { label: '★★ Below Avg', count: rDist.two, color: 'bg-orange-400' },
                      { label: '★ Poor', count: rDist.one, color: 'bg-red-400' },
                    ].map(d => {
                      const total = sm.total_feedback || 1;
                      const pctBar = Math.round((d.count / total) * 100);
                      return (
                        <div key={d.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">{d.label}</span>
                            <span className="font-semibold text-gray-700">{d.count} ({pctBar}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${d.color}`} style={{ width: `${pctBar}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Monthly Trend Chart */}
              {monthly.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly Trend</p>
                  <div className="h-36 sm:h-44 md:h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={20} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="punctuality_avg" name="Punctuality" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="student_rating_avg" name="Student Rating" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SESSIONS ── */}
          {subTab === 'sessions' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Each session shows your start timing score and student feedback received.
              </p>
              <TableWrapper>
                <THead>
                    <TH>Date</TH>
                    <TH>Subject</TH>
                    <TH>Batch</TH>
                    <TH>Punctuality</TH>
                    <TH>Student Rating</TH>
                    <TH>Feedback</TH>
                </THead>
                <tbody>
                  {sessions.map(s => {
                    const isExpanded = expandedSession === s.room_id;
                    return (
                      <React.Fragment key={s.room_id}>
                        <TRow className={`cursor-pointer ${isExpanded ? 'bg-primary/5/50' : ''}`} onClick={() => setExpandedSession(isExpanded ? null : s.room_id)}>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-700">{s.subject}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{s.batch_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <PunctualityBadge lateMin={s.late_minutes} />
                              <span className="text-xs text-gray-400">{s.punctuality_score}/5</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {s.avg_student_rating !== null ? (
                              <div className="flex items-center gap-1.5">
                                <StarDisplay value={s.avg_student_rating} />
                                <span className="text-xs font-semibold text-gray-700">{s.avg_student_rating.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">No ratings</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {s.feedback_count > 0 ? (
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{s.feedback_count}</span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </TRow>

                        {/* Expanded: show individual feedback */}
                        {isExpanded && s.feedbacks.length > 0 && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50/50 px-6 py-3">
                              <div className="space-y-2">
                                {s.feedbacks.map((f, fi) => (
                                  <div key={fi} className="flex items-start gap-3 text-xs">
                                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                      {f.display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-700">{f.display_name}</span>
                                        <StarDisplay value={f.rating} />
                                        <span className="font-semibold text-gray-600">{f.rating}/5</span>
                                      </div>
                                      {f.tags && (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {f.tags.split(',').filter(Boolean).map(t => (
                                            <span key={t} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">{t.replace(/_/g, ' ')}</span>
                                          ))}
                                        </div>
                                      )}
                                      {f.feedback_text && (
                                        <p className="text-gray-500 italic mt-0.5">&ldquo;{f.feedback_text}&rdquo;</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {isExpanded && s.feedbacks.length === 0 && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50/50 px-6 py-3 text-xs text-gray-400 text-center">
                              No student feedback for this session
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </TableWrapper>
            </div>
          )}

          {/* ── STUDENT FEEDBACK ── */}
          {subTab === 'feedback' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                All student reviews across all sessions ({sm.total_feedback} total).
              </p>
              {sessions.filter(s => s.feedbacks.length > 0).length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
                  No student feedback received yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.filter(s => s.feedbacks.length > 0).map(s => (
                    <div key={s.room_id} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                      {/* Session header */}
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-700">{s.subject}</span>
                          <span className="text-xs text-gray-400 ml-2">{s.batch_name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </span>
                        </div>
                        {s.avg_student_rating !== null && (
                          <div className="flex items-center gap-1">
                            <StarDisplay value={s.avg_student_rating} />
                            <span className="text-xs font-semibold text-gray-700">{s.avg_student_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      {/* Individual feedbacks */}
                      <div className="divide-y divide-gray-50">
                        {s.feedbacks.map((f, fi) => (
                          <div key={fi} className="flex items-start gap-3 px-4 py-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {f.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-semibold text-gray-700">{f.display_name}</span>
                                <StarDisplay value={f.rating} />
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  f.rating >= 4 ? 'bg-primary/5 text-primary' :
                                  f.rating >= 3 ? 'bg-amber-50 text-amber-700' :
                                  'bg-red-50 text-red-600'
                                }`}>{f.rating}/5</span>
                              </div>
                              {f.tags && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {f.tags.split(',').filter(Boolean).map(t => (
                                    <span key={t} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-medium">{t.replace(/_/g, ' ')}</span>
                                  ))}
                                </div>
                              )}
                              {f.feedback_text && (
                                <p className="text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2 border-l-2 border-emerald-300">
                                  &ldquo;{f.feedback_text}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Homework (teacher view across all batches)
// ═════════════════════════════════════════════════════════════

const HW_COMPLETION_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  completed:   { bg: 'bg-primary/10', text: 'text-primary', label: 'Completed' },
  partial:     { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Partial' },
  not_started: { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Not Started' },
};

const GRADE_COLORS_T: Record<string, string> = {
  A: 'text-primary', B: 'text-blue-600', C: 'text-amber-600',
  D: 'text-orange-600', F: 'text-red-600',
};

function TeacherHomeworkTab({
  assignments, onRefresh, loading,
}: {
  assignments: TeacherHomework[];
  onRefresh: () => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [grading, setGrading] = useState<{ subId: string; grade: string; comment: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const batches = [...new Set(assignments.map(a => a.batch_name).filter(Boolean))] as string[];
  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.batch_name === filter);

  const stats = {
    total: assignments.length,
    active: assignments.filter(a => a.status === 'active').length,
    totalSubs: assignments.reduce((n, a) => n + a.submission_count, 0),
    pendingGrade: assignments.reduce((n, a) => n + a.submissions.filter(s => !s.grade).length, 0),
  };

  const handleGrade = async (hwId: string) => {
    if (!grading || saving) return;
    const hw = assignments.find(a => a.id === hwId);
    if (!hw?.room_id) { alert('Missing room reference'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/room/${hw.room_id}/homework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'grade', submission_id: grading.subId, grade: grading.grade, teacher_comment: grading.comment }),
      });
      const data = await res.json();
      if (data.success) { setGrading(null); onRefresh(); }
      else alert(data.error || 'Failed to save grade');
    } catch { alert('Network error'); }
    finally { setSaving(false); }
  };

  if (loading && assignments.length === 0) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-gray-900">Homework</h2>
        </div>
        <div className="flex items-center gap-2">
          {batches.length > 1 && (
            <FilterSelect value={filter} onChange={setFilter}
              options={[{ value: 'all', label: 'All Batches' }, ...batches.map(b => ({ value: b, label: b }))]} />
          )}
          <RefreshButton loading={loading} onClick={onRefresh} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSmall label="Total Assigned" value={stats.total} icon={ListChecks} />
        <StatCardSmall label="Active" value={stats.active} icon={Clock} />
        <StatCardSmall label="Submissions" value={stats.totalSubs} icon={Send} />
        <StatCardSmall label="Pending Grade" value={stats.pendingGrade} icon={AlertTriangle} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ListChecks} message="No homework assigned yet. Assign homework from a live session." />
      ) : (
        <div className="space-y-3">
          {filtered.map(hw => {
            const isOpen = expanded === hw.id;
            const isDue = hw.due_date && new Date(hw.due_date + 'T23:59:59+05:30') < new Date();
            const subRate = hw.total_students > 0 ? Math.round((hw.submission_count / hw.total_students) * 100) : 0;
            return (
              <Card key={hw.id} className="overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : hw.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{hw.title}</p>
                      <Badge label={hw.status === 'active' ? 'Active' : 'Closed'} variant={hw.status === 'active' ? 'success' : 'default'} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> {hw.subject}</span>
                      {hw.batch_name && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {hw.batch_name}</span>}
                      {hw.grade && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Grade {hw.grade}</span>}
                      {hw.due_date && (
                        <span className={`inline-flex items-center gap-1 ${isDue && hw.status === 'active' ? 'text-red-500 font-medium' : ''}`}>
                          <CalendarClock className="h-3 w-3" /> Due: {new Date(hw.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{hw.due_time ? ` ${hw.due_time}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{hw.submission_count}/{hw.total_students}</p>
                      <p className="text-[10px] text-gray-400">{subRate}% submitted</p>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
                    {hw.description && <p className="text-xs text-gray-600">{hw.description}</p>}

                    {/* Attachments */}
                    {hw.attachment_urls?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-700">Attachments:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {hw.attachment_names.map((name, i) => (
                            <a key={i} href={hw.attachment_urls[i]} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100 transition">
                              <Paperclip className="h-3 w-3" /> {name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Questions */}
                    {hw.questions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-700">Questions:</p>
                        {hw.questions.map(q => (
                          <div key={q.id} className="flex gap-2 text-xs">
                            <span className="text-primary font-medium shrink-0">{q.question_number}.</span>
                            <span className="text-gray-800">{q.question_text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Submissions */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Submissions ({hw.submissions.length}):</p>
                      {hw.submissions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No submissions yet</p>
                      ) : (
                        hw.submissions.map(sub => {
                          const style = HW_COMPLETION_STYLE[sub.completion_status] || HW_COMPLETION_STYLE.completed;
                          const isGrading = grading?.subId === sub.id;
                          return (
                            <div key={sub.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{sub.student_name || sub.student_email}</p>
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                                  {sub.delay_days > 0 && (
                                    <span className="text-[10px] text-red-500 font-medium">{sub.delay_days}d late</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {new Date(sub.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </div>

                              {sub.submission_text && <p className="text-xs text-gray-600 line-clamp-3">{sub.submission_text}</p>}

                              {sub.file_urls?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {sub.file_names.map((name, i) => (
                                    <a key={i} href={sub.file_urls[i]} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded hover:bg-primary/10 transition">
                                      <FileText className="h-3 w-3" /> {name}
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Grade display or grade form */}
                              {sub.grade && !isGrading ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-500">Grade:</span>
                                  <span className={`font-bold ${GRADE_COLORS_T[sub.grade] || 'text-gray-800'}`}>{sub.grade}</span>
                                  {sub.teacher_comment && <span className="text-gray-400">— {sub.teacher_comment}</span>}
                                  <button onClick={() => setGrading({ subId: sub.id, grade: sub.grade || '', comment: sub.teacher_comment || '' })}
                                    className="text-primary hover:underline text-[10px]">Edit</button>
                                </div>
                              ) : isGrading ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <select value={grading.grade} onChange={e => setGrading({ ...grading, grade: e.target.value })}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-400">
                                    <option value="">Grade</option>
                                    {['A', 'B', 'C', 'D', 'F'].map(g => <option key={g} value={g}>{g}</option>)}
                                  </select>
                                  <input value={grading.comment} onChange={e => setGrading({ ...grading, comment: e.target.value })}
                                    placeholder="Comment…" className="flex-1 min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-400" />
                                  <button onClick={() => handleGrade(hw.id)} disabled={!grading.grade || saving}
                                    className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50 transition">
                                    {saving ? '…' : 'Save'}
                                  </button>
                                  <button onClick={() => setGrading(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setGrading({ subId: sub.id, grade: '', comment: '' })}
                                  className="text-xs text-primary hover:underline">
                                  Grade
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
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


// ═════════════════════════════════════════════════════════════
// TAB: Teaching Materials (read-only for teacher)
// ═════════════════════════════════════════════════════════════

const MATERIAL_TYPE_STYLE_T: Record<string, string> = {
  notes:      'bg-blue-50   text-blue-700   border-blue-200',
  assignment: 'bg-amber-50  text-amber-700  border-amber-200',
  resource:   'bg-primary/5 text-primary border-primary/20',
  video:      'bg-purple-50 text-purple-700  border-purple-200',
  other:      'bg-gray-50   text-gray-600   border-gray-200',
};

function TeacherMaterialsTab({
  materials, onRefresh, loading,
}: {
  materials: TeachingMaterial[];
  onRefresh: () => void;
  loading: boolean;
}) {
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType]       = useState('');

  const subjects = Array.from(new Set(materials.map(m => m.subject))).sort();
  const types    = Array.from(new Set(materials.map(m => m.material_type))).sort();

  const filtered = materials.filter(m => {
    if (filterSubject && m.subject !== filterSubject) return false;
    if (filterType    && m.material_type !== filterType)    return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" /> Teaching Materials
        </h2>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>

      {/* Filters */}
      {materials.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Materials grid */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No materials available</p>
          <p className="text-xs text-gray-400 mt-1">Your academic operator will upload study resources here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${MATERIAL_TYPE_STYLE_T[m.material_type] ?? MATERIAL_TYPE_STYLE_T.other}`}>
                      {m.material_type}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.subject}</span>
                  </div>
                  {/* Batch pills (multiple) */}
                  {m.batches && m.batches.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {m.batches.map(b => (
                        <span key={b.batch_id} className="text-[11px] bg-primary/5 text-primary border border-primary/15 px-1.5 py-0.5 rounded-full">
                          {b.batch_name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                <span className="text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-emerald-900 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {m.file_name || 'Open file'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ═════════════════════════════════════════════════════════════
// TAB: Leave & Session Requests
// ═════════════════════════════════════════════════════════════

interface LeaveRequest {
  id: string;
  teacher_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  hr_status: string;
  owner_status: string;
  ao_reviewed_by: string | null;
  hr_reviewed_by: string | null;
  owner_reviewed_by: string | null;
  affected_sessions: string[];
  medical_certificate_url: string | null;
  medical_certificate_name: string | null;
  salary_adjustment: 'full_pay' | 'half_pay' | 'no_pay' | null;
  created_at: string;
}

function LeaveTab() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: 'planned', startDate: '', endDate: '', reason: '' });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher-leave');
      const data = await res.json();
      if (data.success) setLeaveRequests(data.data?.requests ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  const submitLeave = async () => {
    if (!form.startDate || !form.endDate || !form.reason) return;
    setSubmitting(true);
    try {
      // Upload medical certificate if selected
      let certUrl: string | null = null;
      let certName: string | null = null;
      if (certFile && form.leaveType === 'sick') {
        setCertUploading(true);
        const fd = new FormData();
        fd.append('file', certFile);
        const upRes = await fetch('/api/v1/teacher-leave/upload', { method: 'POST', body: fd });
        const upData = await upRes.json();
        setCertUploading(false);
        if (upData.success) {
          certUrl = upData.data.url;
          certName = upData.data.name;
        }
      }

      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: form.leaveType, start_date: form.startDate, end_date: form.endDate, reason: form.reason,
          medical_certificate_url: certUrl, medical_certificate_name: certName,
        }),
      });
      const data = await res.json();
      if (data.success) { setShowForm(false); setForm({ leaveType: 'planned', startDate: '', endDate: '', reason: '' }); setCertFile(null); fetchLeave(); }
    } catch { /* */ } finally { setSubmitting(false); setCertUploading(false); }
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

  const [uploadingCertFor, setUploadingCertFor] = useState<string | null>(null);
  const attachCertificate = async (leaveId: string, file: File) => {
    setUploadingCertFor(leaveId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/v1/teacher-leave/upload', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upData.success) return;
      await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attach_certificate', leave_id: leaveId, medical_certificate_url: upData.data.url, medical_certificate_name: upData.data.name }),
      });
      fetchLeave();
    } catch { /* */ } finally { setUploadingCertFor(null); }
  };

  const getDisplayStatus = (lr: LeaveRequest): { status: string; label: string } => {
    switch (lr.status) {
      case 'pending_ao': return { status: 'pending', label: 'Pending AO Review' };
      case 'pending_hr': return { status: 'warning', label: 'Pending HR Approval' };
      case 'approved': return { status: 'warning', label: 'Approved — Sessions Being Managed' };
      case 'confirmed': return { status: 'approved', label: 'Confirmed' };
      case 'rejected': return { status: 'rejected', label: 'Rejected' };
      case 'withdrawn': return { status: 'rejected', label: 'Withdrawn' };
      default: return { status: 'pending', label: lr.status };
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Leave Requests</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg text-primary hover:bg-primary/10 transition text-sm font-medium">
              <Send className="h-4 w-4" />{showForm ? 'Cancel' : 'Request Leave'}
            </button>
          </div>

          {showForm && (
            <Card className="p-5 space-y-4 border-primary/20">
              <h3 className="text-sm font-semibold text-gray-900">New Leave Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.leaveType}
                    onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}>
                    <option value="planned">📅 Planned</option>
                    <option value="sick">🤒 Sick</option>
                    <option value="personal">👤 Personal</option>
                    <option value="emergency">🚨 Emergency</option>
                    <option value="other">📋 Other</option>
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
                {form.leaveType === 'sick' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Medical Certificate (optional)</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition text-sm font-medium cursor-pointer">
                        <Paperclip className="h-4 w-4" />
                        {certFile ? certFile.name : 'Attach Certificate'}
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={e => setCertFile(e.target.files?.[0] || null)} />
                      </label>
                      {certFile && (
                        <button type="button" onClick={() => setCertFile(null)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">PDF or image, max 10 MB. Helps with salary consideration during sick leave.</p>
                  </div>
                )}
              </div>
              <button disabled={submitting || certUploading || !form.startDate || !form.endDate || !form.reason} onClick={submitLeave}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition">
                {certUploading ? 'Uploading certificate…' : submitting ? 'Submitting…' : 'Submit Leave Request'}
              </button>
            </Card>
          )}

          {leaveRequests.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No leave requests yet. Use the button above to request leave." />
          ) : (
            <div className="space-y-3">
              {leaveRequests.map(lr => {
                const displayStatus = getDisplayStatus(lr);
                return (
                <Card key={lr.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-900 capitalize">{lr.leave_type} Leave</span>
                        <StatusBadge status={displayStatus.status as 'pending' | 'approved' | 'rejected' | 'warning'} label={displayStatus.label} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(lr.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(lr.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {lr.affected_sessions?.length > 0 && ` · ${lr.affected_sessions.length} sessions affected`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{lr.reason}</p>
                      {lr.medical_certificate_url ? (
                        <a href={lr.medical_certificate_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800">
                          <Paperclip className="h-3 w-3" /> Medical Certificate
                        </a>
                      ) : !['withdrawn', 'rejected'].includes(lr.status) ? (
                        <label className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:text-primary cursor-pointer">
                          <Paperclip className="h-3 w-3" />
                          {uploadingCertFor === lr.id ? 'Uploading…' : 'Upload Medical Certificate'}
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                            disabled={uploadingCertFor === lr.id}
                            onChange={e => { const f = e.target.files?.[0]; if (f) attachCertificate(lr.id, f); e.target.value = ''; }} />
                        </label>
                      ) : null}
                      {lr.salary_adjustment && (
                        <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          lr.salary_adjustment === 'full_pay' ? 'bg-primary/10 text-primary' :
                          lr.salary_adjustment === 'half_pay' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {lr.salary_adjustment === 'full_pay' ? 'Full Pay' : lr.salary_adjustment === 'half_pay' ? 'Half Pay' : 'No Pay (LOP)'}
                        </span>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                        <span>Status: {getDisplayStatus(lr).label}</span>
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
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Questions (Exam topic upload & AI generation)
// ═════════════════════════════════════════════════════════════

interface ExamTopicFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

interface ExamTopic {
  id: string;
  title: string;
  subject: string;
  grade: string;
  board?: string;
  category?: 'question_paper' | 'topic';
  paper_type?: string;
  chapter_name?: string;
  topic_name?: string;
  question_count: number;
  generated_questions?: number;
  status: 'generating' | 'ready' | 'failed' | 'archived';
  generation_progress?: string | null;
  error_message?: string;
  pdf_url?: string;
  pdf_filename?: string;
  uploaded_by: string;
  created_at: string;
  files: ExamTopicFile[];
}

function qFormatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function qFileTypeIcon(mime: string): string {
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📗';
  if (mime.includes('word') || mime.includes('document')) return '📘';
  return '📄';
}

function qFileTypeLabel(mime: string): string {
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('word') || mime.includes('document')) return 'DOC';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'PPT';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'XLS';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.includes('csv') || mime.includes('text/plain')) return 'Text';
  return 'File';
}

const Q_PAPER_TYPES = [
  'Previous Year Question Paper',
  'Model Question Paper',
  'Onam Exam',
  'Christmas Exam',
  'Annual Exam',
  'Quarterly Exam',
  'Half-Yearly Exam',
  'Unit Test',
  'Practice Paper',
  'Sample Paper',
  'Other',
];

const Q_DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Social Science', 'English', 'Malayalam', 'Arabic'];
const Q_DEFAULT_GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const Q_DEFAULT_BOARDS = [
  'CBSE', 'ICSE', 'ISC', 'State Board',
  'IB', 'IGCSE', 'NIOS', 'SSC', 'HSC', 'Matriculation', 'Anglo Indian',
];

function QuestionsTab() {
  const toast = useToast();
  const { confirm } = useConfirm();

  const [topics, setTopics] = useState<ExamTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [genStartTime, setGenStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [genCountPromptId, setGenCountPromptId] = useState<string | null>(null);
  const [genCountValue, setGenCountValue] = useState('10');
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  const [viewTopicTitle, setViewTopicTitle] = useState('');
  const [viewQuestions, setViewQuestions] = useState<ViewQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const emptyForm = {
    title: '', grade: '', board: '', subject: '',
    category: '' as '' | 'question_paper' | 'topic',
    paper_type: '', chapter_name: '', topic_name: '',
  };
  const [form, setForm] = useState(emptyForm);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.set('subject', filterSubject);
      if (filterGrade) params.set('grade', filterGrade);
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/v1/session-exam-topics?${params}`);
      const data = await res.json();
      if (data.success) setTopics(data.data || []);
    } catch { toast.error('Failed to load questions'); }
    finally { setLoading(false); }
  }, [filterSubject, filterGrade, filterCategory, toast]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  useEffect(() => {
    if (!genStartTime) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - genStartTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [genStartTime]);

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const progressLabel = (stage?: string | null) => {
    switch (stage) {
      case 'extracting': return 'Extracting text from files…';
      case 'building_prompt': return 'Building AI prompt…';
      case 'generating_ai': return 'AI is generating questions…';
      case 'parsing': return 'Parsing AI response…';
      case 'saving': return 'Saving questions…';
      default: return 'Starting…';
    }
  };

  const progressPercent = (stage?: string | null) => {
    switch (stage) {
      case 'extracting': return 15;
      case 'building_prompt': return 25;
      case 'generating_ai': return 60;
      case 'parsing': return 85;
      case 'saving': return 95;
      default: return 5;
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      toast.error('Maximum 10 files allowed');
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.grade.trim())    { toast.error('Grade is required'); return; }
    if (!form.board.trim())    { toast.error('Board is required'); return; }
    if (!form.subject.trim())  { toast.error('Subject is required'); return; }
    if (!form.category)        { toast.error('Please select Question Paper or Topic'); return; }
    if (form.category === 'question_paper' && !form.paper_type.trim()) {
      toast.error('Paper type is required'); return;
    }
    const chapterName = form.chapter_name === '__other__' ? '' : form.chapter_name;
    const topicName = form.topic_name === '__other__' ? '' : form.topic_name;
    if (form.category === 'topic' && !chapterName.trim()) {
      toast.error('Chapter name is required'); return;
    }
    if (!form.title.trim())    { toast.error('Title is required'); return; }
    if (!selectedFiles.length) { toast.error('Please select at least one file'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      for (const f of selectedFiles) fd.append('files', f);
      fd.append('title', form.title);
      fd.append('grade', form.grade);
      fd.append('board', form.board);
      fd.append('subject', form.subject);
      fd.append('category', form.category);
      if (form.category === 'question_paper' && form.paper_type) fd.append('paper_type', form.paper_type);
      if (form.category === 'topic') {
        if (chapterName) fd.append('chapter_name', chapterName);
        if (topicName) fd.append('topic_name', topicName);
      }
      const res = await fetch('/api/v1/session-exam-topics', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Upload failed'); return; }
      toast.success('Questions uploaded successfully');
      setForm(emptyForm);
      setSelectedFiles([]);
      setShowForm(false);
      fetchTopics();
    } catch { toast.error('Server error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({ title: 'Delete Questions', message: `Delete "${title}" and all its questions/results? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/session-exam-topics?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Delete failed'); return; }
      toast.success('Deleted');
      setTopics(prev => prev.filter(t => t.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch { toast.error('Server error'); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ok = await confirm({ title: 'Delete Selected', message: `Delete ${selected.size} selected topic(s) and all their questions? This cannot be undone.`, confirmLabel: 'Delete All', variant: 'danger' });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected).join(',');
      const res = await fetch(`/api/v1/session-exam-topics?ids=${encodeURIComponent(ids)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Bulk delete failed'); return; }
      toast.success(data.message || 'Deleted');
      setSelected(new Set());
      fetchTopics();
    } catch { toast.error('Server error'); }
    finally { setBulkDeleting(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === topics.length) setSelected(new Set());
    else setSelected(new Set(topics.map(t => t.id)));
  };

  const handleGenerate = async (topicId: string, count?: number) => {
    setGenCountPromptId(null);
    setGeneratingId(topicId);
    setGenStartTime(Date.now());
    try {
      const res = await fetch('/api/v1/session-exam-topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, ...(count ? { count } : {}) }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Generation failed'); setGeneratingId(null); setGenStartTime(null); return; }
      toast.success('Generation started — this may take a few minutes');
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`/api/v1/session-exam-topics?limit=100`);
          const d = await r.json();
          if (!d.success) return;
          setTopics(d.data || []);
          const topic = (d.data || []).find((t: { id: string }) => t.id === topicId);
          if (!topic || topic.status !== 'generating') {
            clearInterval(poll);
            pollRef.current = null;
            setGeneratingId(null);
            setGenStartTime(null);
            if (topic?.error_message) toast.error(topic.error_message);
            else if (topic?.generated_questions > 0) toast.success(`Generated ${topic.generated_questions} questions`);
          }
        } catch { /* ignore poll errors */ }
      }, 5_000);
      pollRef.current = poll;
    } catch { toast.error('Server error during generation'); setGeneratingId(null); setGenStartTime(null); }
  };

  const handleCancelGenerate = async (topicId: string) => {
    try {
      const res = await fetch('/api/v1/session-exam-topics/generate/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId }),
      });
      const data = await res.json();
      if (data.success) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setGeneratingId(null);
        setGenStartTime(null);
        toast.success('Generation cancelled');
        fetchTopics();
      } else {
        toast.error(data.error || 'Failed to cancel');
      }
    } catch { toast.error('Failed to cancel generation'); }
  };

  const handleViewQuestions = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    setViewTopicId(topicId);
    setViewTopicTitle(topic?.title || 'Questions');
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/v1/session-exam-topics/questions?topic_id=${topicId}`);
      const data = await res.json();
      if (data.success) setViewQuestions(data.data || []);
      else toast.error(data.error || 'Failed to load questions');
    } catch { toast.error('Failed to load questions'); }
    finally { setLoadingQuestions(false); }
  };

  const totalFiles = topics.reduce((sum, t) => sum + (t.files?.length || 0), 0);

  const gradeSelected = !!form.grade;
  const boardSelected = gradeSelected && !!form.board;
  const subjectSelected = boardSelected && !!form.subject;
  const categorySelected = subjectSelected && !!form.category;

  return (
    <div className="space-y-5">
      <PageHeader icon={ClipboardCheck} title="Questions" subtitle={`${topics.length} uploads`}>
        <RefreshButton onClick={fetchTopics} loading={loading} />
        <Button variant="primary" icon={showForm ? XIcon : Upload} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : 'Upload Questions'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Total Uploads" value={topics.length} variant="default" />
        <StatCard icon={FileText} label="Total Files" value={totalFiles} variant="success" />
        <StatCard icon={CheckCircle2} label="Ready" value={topics.filter(t => t.status === 'ready').length} variant="success" />
      </div>

      {/* ── Upload Form ── */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-blue-800">Upload Exam Questions</p>
          <p className="text-xs text-blue-600">Select grade, board, subject, then choose Question Paper or Topic.</p>

          <FormGrid>
            <FormField label="Grade *">
              <Select
                value={form.grade}
                onChange={v => setForm(f => ({ ...f, grade: v, board: '', subject: '', category: '' as const, paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                options={[
                  { value: '', label: 'Select grade...' },
                  ...Q_DEFAULT_GRADES.map(g => ({ value: g, label: `Grade ${g}` })),
                ]}
              />
            </FormField>
            {gradeSelected && (
              <FormField label="Board *">
                <Select
                  value={form.board}
                  onChange={v => setForm(f => ({ ...f, board: v, subject: '', category: '' as const, paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  options={[
                    { value: '', label: 'Select board...' },
                    ...Q_DEFAULT_BOARDS.map(b => ({ value: b, label: b })),
                  ]}
                />
              </FormField>
            )}
            {boardSelected && (
              <FormField label="Subject *">
                <Select
                  value={form.subject}
                  onChange={v => setForm(f => ({ ...f, subject: v, category: '' as const, paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  options={[
                    { value: '', label: 'Select subject...' },
                    ...Q_DEFAULT_SUBJECTS.map(s => ({ value: s, label: s })),
                  ]}
                />
              </FormField>
            )}
          </FormGrid>

          {subjectSelected && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-600">Choose type *</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, category: 'question_paper', paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.category === 'question_paper'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">📝 Question Paper</p>
                  <p className="text-xs text-gray-500 mt-0.5">Previous year, model, exam papers</p>
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, category: 'topic', paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.category === 'topic'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">📖 Topic / Chapter</p>
                  <p className="text-xs text-gray-500 mt-0.5">Chapter-wise questions by topic</p>
                </button>
              </div>
            </div>
          )}

          {form.category === 'question_paper' && (
            <FormGrid>
              <FormField label="Paper Type *">
                <Select
                  value={form.paper_type}
                  onChange={v => {
                    const autoTitle = `${v} — ${form.subject} Gr.${form.grade}`;
                    setForm(f => ({ ...f, paper_type: v, title: autoTitle }));
                  }}
                  options={[
                    { value: '', label: 'Select paper type...' },
                    ...Q_PAPER_TYPES.map(p => ({ value: p, label: p })),
                  ]}
                />
              </FormField>
              <FormField label="Title *">
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. CBSE 2024 Mathematics Final"
                />
              </FormField>
            </FormGrid>
          )}

          {form.category === 'topic' && (() => {
            const chapters = getChapters(form.board, form.grade, form.subject);
            const hasChapterData = chapters.length > 0;
            const selectedChapter = chapters.find(c => c.name === form.chapter_name);
            const hasTopicData = (selectedChapter?.topics?.length ?? 0) > 0;
            const isChapterOther = form.chapter_name === '__other__' || (!hasChapterData && form.chapter_name !== '');
            const isTopicOther = form.topic_name === '__other__';
            return (
            <FormGrid>
              <FormField label="Chapter Name *">
                {hasChapterData ? (
                  <>
                    <Select
                      value={isChapterOther ? '__other__' : form.chapter_name}
                      onChange={v => {
                        if (v === '__other__') {
                          setForm(f => ({ ...f, chapter_name: '__other__', topic_name: '', title: '' }));
                        } else {
                          const autoTitle = v ? `${v} — ${form.subject} Gr.${form.grade}` : '';
                          setForm(f => ({ ...f, chapter_name: v, topic_name: '', title: autoTitle }));
                        }
                      }}
                      options={[
                        { value: '', label: 'Select chapter...' },
                        ...chapters.map(c => ({ value: c.name, label: c.name })),
                        { value: '__other__', label: '— Other (enter manually) —' },
                      ]}
                    />
                    {isChapterOther && (
                      <Input
                        className="mt-2"
                        value={form.chapter_name === '__other__' ? '' : form.chapter_name}
                        onChange={e => setForm(f => ({ ...f, chapter_name: e.target.value || '__other__', topic_name: '', title: e.target.value ? `${e.target.value} — ${f.subject} Gr.${f.grade}` : '' }))}
                        placeholder="Enter chapter name..."
                      />
                    )}
                  </>
                ) : (
                  <Input
                    value={form.chapter_name}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, chapter_name: v, title: v ? `${v} — ${f.subject} Gr.${f.grade}` : '' }));
                    }}
                    placeholder="e.g. Chapter 4 — Quadratic Equations"
                  />
                )}
              </FormField>
              {form.chapter_name && form.chapter_name !== '__other__' && (
                <FormField label="Topic / Subtopic">
                  {hasTopicData ? (
                    <>
                      <Select
                        value={isTopicOther ? '__other__' : form.topic_name}
                        onChange={v => {
                          if (v === '__other__') {
                            setForm(f => ({ ...f, topic_name: '__other__' }));
                          } else {
                            setForm(f => ({
                              ...f, topic_name: v,
                              title: v ? `${f.chapter_name} — ${v} (${f.subject} Gr.${f.grade})` : `${f.chapter_name} — ${f.subject} Gr.${f.grade}`,
                            }));
                          }
                        }}
                        options={[
                          { value: '', label: 'Select topic...' },
                          { value: 'Full Chapter', label: '📚 Full Chapter' },
                          ...selectedChapter!.topics.map(t => ({ value: t, label: t })),
                          { value: '__other__', label: '— Other (enter manually) —' },
                        ]}
                      />
                      {isTopicOther && (
                        <Input
                          className="mt-2"
                          value={form.topic_name === '__other__' ? '' : form.topic_name}
                          onChange={e => setForm(f => ({ ...f, topic_name: e.target.value || '__other__' }))}
                          placeholder="Enter topic name..."
                        />
                      )}
                    </>
                  ) : (
                    <Input
                      value={form.topic_name}
                      onChange={e => setForm(f => ({ ...f, topic_name: e.target.value }))}
                      placeholder="e.g. Discriminant & Nature of Roots"
                    />
                  )}
                </FormField>
              )}
              <FormField label="Title *">
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Quadratic Equations — Practice Questions"
                />
              </FormField>
            </FormGrid>
            );
          })()}

          {categorySelected && (
            <FormField label="Question Files * (max 10 files, 20 MB each)">
              <div className="mt-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-white hover:bg-blue-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Click to select files</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, PPT, XLS, Images, Text — all formats (max 20 MB each)</p>
                  </div>
                  <input type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg"
                    onChange={handleFilesSelected} />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 rounded-lg bg-white border border-gray-100 p-2.5">
                        <span className="text-lg">{qFileTypeIcon(f.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            <span>{qFormatFileSize(f.size)}</span>
                            <span>{qFileTypeLabel(f.type)}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeFile(idx)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1">
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setForm(emptyForm); setSelectedFiles([]); setShowForm(false); }}>Cancel</Button>
            <Button variant="primary" icon={Send} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload Questions'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Filters + Bulk Actions ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterSelect value={filterGrade} onChange={v => setFilterGrade(v)}
          options={[{ value: '', label: 'All grades' }, ...Q_DEFAULT_GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]} />
        <FilterSelect value={filterSubject} onChange={v => setFilterSubject(v)}
          options={[{ value: '', label: 'All subjects' }, ...Q_DEFAULT_SUBJECTS.map(s => ({ value: s, label: s }))]} />
        <FilterSelect value={filterCategory} onChange={v => setFilterCategory(v)}
          options={[{ value: '', label: 'All types' }, { value: 'question_paper', label: 'Question Papers' }, { value: 'topic', label: 'Topics' }]} />
        {topics.length > 0 && (
          <button onClick={toggleSelectAll}
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            {selected.size === topics.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
          <span className="text-xs font-medium text-red-700">{selected.size} selected</span>
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition">
            <Trash2 className="h-3.5 w-3.5" /> {bulkDeleting ? 'Deleting…' : 'Delete Selected'}
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700 transition">Clear</button>
        </div>
      )}

      {/* ── Topic Cards ── */}
      {loading ? (
        <LoadingState />
      ) : topics.length === 0 ? (
        <EmptyState icon={ClipboardList} message="No questions found. Upload question papers or topic files to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map(t => (
            <div key={t.id} className={`rounded-xl border bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow ${
              selected.has(t.id) ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {t.category === 'question_paper' ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">📝 QP</span>
                    ) : t.category === 'topic' ? (
                      <span className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-full font-medium">📖 Topic</span>
                    ) : null}
                    <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{t.subject}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Gr.{t.grade}</span>
                    {t.board && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{t.board}</span>
                    )}
                    {t.files?.length > 0 && (
                      <span className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-full">{t.files.length} file{t.files.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate mt-1">{t.title}</p>
                  {t.category === 'question_paper' && t.paper_type && (
                    <p className="text-xs text-blue-600 mt-0.5">{t.paper_type}</p>
                  )}
                  {t.category === 'topic' && (t.chapter_name || t.topic_name) && (
                    <p className="text-xs text-primary mt-0.5">
                      {t.chapter_name}{t.topic_name ? ` → ${t.topic_name}` : ''}
                    </p>
                  )}
                  </div>
                </div>
                <button onClick={() => handleDelete(t.id, t.title)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {t.files && t.files.length > 0 && (
                <div className="space-y-1.5">
                  {t.files.map(f => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 p-2.5 transition-colors group">
                      <span className="text-lg">{qFileTypeIcon(f.mime_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{f.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span>{qFormatFileSize(f.file_size)}</span>
                          <span>{qFileTypeLabel(f.mime_type)}</span>
                        </div>
                      </div>
                      <span className="text-gray-300 group-hover:text-blue-500 text-sm">↗</span>
                    </a>
                  ))}
                </div>
              )}

              {(!t.files || t.files.length === 0) && t.pdf_url && (
                <a href={t.pdf_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 p-2.5 transition-colors group">
                  <span className="text-lg">📕</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{t.pdf_filename || 'PDF'}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-500 text-sm">↗</span>
                </a>
              )}

              {(generatingId === t.id || t.status === 'generating') ? (
                <div className="space-y-2 bg-violet-50/60 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-violet-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{progressLabel(t.generation_progress)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-violet-500 tabular-nums">
                      <Clock className="h-3 w-3" />
                      <span>{fmtElapsed(elapsed)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-violet-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progressPercent(t.generation_progress)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-violet-400">AI question generation typically takes 2–4 minutes</p>
                  <button onClick={() => handleCancelGenerate(t.id)}
                    className="flex items-center justify-center gap-1.5 w-full text-xs font-medium py-1.5 rounded-lg bg-white/80 text-red-600 hover:bg-red-50 border border-red-200 transition-colors">
                    <XIcon className="h-3 w-3" /> Cancel
                  </button>
                </div>
              ) : (
                <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {(t.generated_questions ?? 0) > 0 ? (
                      <button
                        onClick={() => handleViewQuestions(t.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> {t.generated_questions} Qs
                      </button>
                    ) : null}
                    {t.error_message && (
                      <span className="text-xs text-red-500 truncate max-w-[180px]" title={t.error_message}>
                        ⚠️ {t.error_message.slice(0, 50)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (t.category === 'topic') {
                        setGenCountPromptId(t.id);
                        setGenCountValue('10');
                      } else {
                        handleGenerate(t.id);
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all bg-violet-50 text-violet-700 hover:bg-violet-100 hover:shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {(t.generated_questions ?? 0) > 0 ? 'Re-generate' : 'Generate'}
                  </button>
                </div>
                {genCountPromptId === t.id && (
                  <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <label className="text-xs text-primary font-medium whitespace-nowrap">How many questions?</label>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={genCountValue}
                      onChange={e => setGenCountValue(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = Math.min(50, Math.max(5, parseInt(genCountValue) || 10));
                          handleGenerate(t.id, n);
                        } else if (e.key === 'Escape') {
                          setGenCountPromptId(null);
                        }
                      }}
                      className="w-16 px-2 py-1 text-xs rounded-md border border-emerald-300 focus:ring-2 focus:ring-emerald-400 focus:border-primary outline-none text-center"
                    />
                    <button
                      onClick={() => {
                        const n = Math.min(50, Math.max(5, parseInt(genCountValue) || 10));
                        handleGenerate(t.id, n);
                      }}
                      className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      Go
                    </button>
                    <button
                      onClick={() => setGenCountPromptId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 p-1">
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                )}
                </>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewTopicId && !loadingQuestions && viewQuestions.length > 0 && (
        <QuestionViewer
          questions={viewQuestions}
          topicTitle={viewTopicTitle}
          onClose={() => { setViewTopicId(null); setViewQuestions([]); }}
        />
      )}
      {viewTopicId && loadingQuestions && (
        <div className="fixed inset-0 z-[200] bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading questions...</p>
          </div>
        </div>
      )}
    </div>
  );
}