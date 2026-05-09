'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader,
  RefreshButton,
  TabBar,
  StatCard,
  Card,
  Badge,
  StatusBadge,
  LoadingState,
  EmptyState,
  Button,
  Input,
  Textarea,
  Select,
  FormPanel,
  FormField,
  FormGrid,
  FormActions,
  Modal,
  money,
  TableWrapper,
  THead,
  TH,
  TRow,
  useToast,
  type TabItem,
} from '@/components/dashboard/shared';
import { fmtSmartDateIST, fmtTimeIST } from '@/lib/utils';
import StudentReportsTab from '@/components/dashboard/StudentReportsTab';
import BujiChatbot from '@/components/auth/BujiChatbot';
import { usePlatformName } from '@/components/providers/PlatformProvider';
import Script from 'next/script';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  Radio,
  Eye,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  FileText,
  BookOpen,
  ClipboardList,
  AlertCircle,
  BarChart3,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Send,
  Brain,
  Download,
  ExternalLink,
  Shield,
  CalendarClock,
  Ban,
  XCircle,
  ArrowRightLeft,
  Layers,
} from 'lucide-react';

/* ─── Interfaces ──────────────────────────────────────────── */

function effectiveStatus(room: { status: string; scheduled_start: string; duration_minutes: number }): string {
  // DB status is authoritative — sessions run overtime until teacher manually ends them
  if (room.status === 'live') return 'live';
  if (room.status === 'ended') return 'ended';
  if (room.status === 'cancelled') return 'cancelled';
  // scheduled room never went live -> cancelled after scheduled end
  const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
  if (Date.now() >= endMs) return 'cancelled';
  return room.status;
}

interface ChildRoom {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  teacher_email: string | null;
  student_email?: string;
  student_name?: string;
  batch_session_id?: string;
  batch_id?: string;
}

interface AttendanceChild {
  student_email: string;
  student_name: string;
  summary: {
    total_sessions: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
    avg_time_minutes: number;
    total_rejoins: number;
  };
  recent_sessions: Array<{
    room_id: string;
    batch_name: string;
    subject: string;
    grade: string;
    scheduled_start: string;
    status: string;
    is_late: boolean;
    late_by_seconds: number;
    time_in_class_seconds: number;
    join_count: number;
  }>;
}

interface ExamChild {
  student_email: string;
  student_name: string;
  summary: {
    total_exams: number;
    avg_percentage: number;
    best_score: number;
    worst_score: number;
    passed: number;
    failed: number;
  };
  exams: Array<{
    attempt_id: string;
    exam_title: string;
    subject: string;
    exam_type: string;
    total_marks: number;
    total_marks_obtained: number;
    percentage: number;
    grade_letter: string;
    passed: boolean;
    submitted_at: string;
  }>;
}

interface Complaint {
  id: string;
  subject: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

interface ParentSessionRequest {
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

interface LedgerEntry {
  date: string;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit_paise: number;
  credit_paise: number;
  balance_paise: number;
  status?: string;
  currency: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

type TabId = 'overview' | 'classes' | 'attendance' | 'exams' | 'fees' | 'reports';
const VALID_TABS: TabId[] = ['overview', 'classes', 'attendance', 'exams', 'fees', 'reports'];

const BATCH_TYPE_LABEL: Record<string, string> = {
  one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15',
  one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture',
  improvement_batch: 'Improve', custom: 'Custom',
};

/* ─── Consolidated Alerts Widget ──────────────────────────── */
function ParentAlertsWidget({ rooms, invoices, onFeeClick }: { rooms: ChildRoom[]; invoices: Record<string, unknown>[]; onFeeClick: () => void }) {
  const alerts: Array<{ type: string; color: string; icon: typeof AlertCircle; msg: string; action?: { label: string; onClick: () => void; color: string } }> = [];
  // Overdue invoices
  const overdue = invoices.filter(inv => inv.status === 'overdue');
  const pending = invoices.filter(inv => inv.status === 'pending');
  if (overdue.length > 0) alerts.push({
    type: 'fee-overdue',
    color: 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50',
    icon: AlertCircle,
    msg: `${overdue.length} overdue payment${overdue.length > 1 ? 's' : ''} — your child${overdue.length > 1 ? "'s" : "'s"} class access is blocked`,
    action: { label: 'Pay Now', onClick: onFeeClick, color: 'bg-red-600 hover:bg-red-700' },
  });
  if (pending.length > 0) alerts.push({
    type: 'fee-pending',
    color: 'border-amber-300 bg-amber-50/80',
    icon: CreditCard,
    msg: `${pending.length} invoice${pending.length > 1 ? 's' : ''} pending payment — pay before due date`,
    action: { label: 'View', onClick: onFeeClick, color: 'bg-amber-600 hover:bg-amber-700' },
  });
  // Missed sessions (ended sessions with room_name)
  const today = new Date().toLocaleDateString('en-IN');
  const missedToday = rooms.filter(r => effectiveStatus(r) === 'ended' && new Date(r.scheduled_start).toLocaleDateString('en-IN') === today);
  if (missedToday.length > 0) alerts.push({ type: 'attendance', color: 'border-amber-200 bg-amber-50', icon: AlertCircle, msg: `${missedToday.length} session${missedToday.length > 1 ? 's' : ''} ended today` });
  // Upcoming in next hour
  const soonMs = 60 * 60 * 1000;
  const soonRooms = rooms.filter(r => { const t = new Date(r.scheduled_start).getTime(); return effectiveStatus(r) === 'scheduled' && t - Date.now() > 0 && t - Date.now() < soonMs; });
  if (soonRooms.length > 0) alerts.push({ type: 'soon', color: 'border-blue-200 bg-blue-50', icon: Clock, msg: `${soonRooms.length} session${soonRooms.length > 1 ? 's' : ''} starting within 1 hour` });

  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5" /> Alerts · {alerts.length}
      </h3>
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${a.color}`}>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.type.startsWith('fee') ? (a.type === 'fee-overdue' ? 'bg-red-100 ring-1 ring-red-200' : 'bg-amber-100 ring-1 ring-amber-200') : 'bg-white/60'}`}>
            <a.icon className={`h-4 w-4 ${a.type === 'fee-overdue' ? 'text-red-600' : a.type === 'fee-pending' ? 'text-amber-700' : 'text-gray-600'}`} />
          </span>
          <span className="flex-1 text-sm font-medium text-gray-800">{a.msg}</span>
          {a.action && (
            <button onClick={a.action.onClick} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${a.action.color}`}>
              {a.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────── */

export default function ParentDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const platformName = usePlatformName();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(h)) return h;
    }
    return 'overview';
  });
  const [rooms, setRooms] = useState<ChildRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);

  // Session credits state
  const [creditsData, setCreditsData] = useState<{
    children: Array<{
      student_email: string;
      student_name: string;
      total_remaining: number;
      total_allotted: number;
      warning: boolean;
      exhausted: boolean;
      credits: Array<{ subject: string; remaining: number; total_sessions: number; batch_type?: string }>;
    }>;
    total_remaining: number;
    total_allotted: number;
    warning: boolean;
    exhausted: boolean;
  } | null>(null);

  // Attendance state
  const [attendanceChildren, setAttendanceChildren] = useState<AttendanceChild[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Exam state
  const [examChildren, setExamChildren] = useState<ExamChild[]>([]);
  const [examLoading, setExamLoading] = useState(false);

  // Complaints state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    subject: '',
    category: 'general',
    description: '',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<{
    total_invoiced_paise: number;
    total_paid_paise: number;
    outstanding_paise: number;
    currency: string;
  } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Reports state
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  // Monitoring state
  const [monitorReports, setMonitorReports] = useState<Record<string, unknown>[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);

  // Payment state
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Separate expanded state per tab to avoid cross-tab collisions
  const [expandedMonitorReport, setExpandedMonitorReport] = useState<string | null>(null);

  // Session requests state
  const toast = useToast();
  const [sessionRequests, setSessionRequests] = useState<ParentSessionRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    sessionId: '',
    batchId: '',
    childEmail: '',
    requestType: 'reschedule' as 'reschedule' | 'cancel',
    reason: '',
    proposedDate: '',
    proposedTime: '',
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  /* ─── Fetchers ─────────────────────────────────────────── */

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/parent/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms || []);
    } catch (err) { console.error('Failed to fetch:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payment/invoices');
      const data = await res.json();
      if (data.success) setInvoices(data.data?.invoices || []);
    } catch (err) { console.error('Invoices fetch failed:', err); }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/student/credits');
      const data = await res.json();
      if (data.success) setCreditsData(data.data);
    } catch (err) { console.error('Credits fetch failed:', err); }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/v1/parent/attendance');
      const data = await res.json();
      if (data.success) setAttendanceChildren(data.data?.children || []);
    } catch (err) { console.error('Attendance fetch failed:', err); }
    finally { setAttendanceLoading(false); }
  }, []);

  const fetchExams = useCallback(async () => {
    setExamLoading(true);
    try {
      const res = await fetch('/api/v1/parent/exams');
      const data = await res.json();
      if (data.success) setExamChildren(data.data?.children || []);
    } catch (err) { console.error('Exams fetch failed:', err); }
    finally { setExamLoading(false); }
  }, []);

  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const res = await fetch('/api/v1/parent/complaints');
      const data = await res.json();
      if (data.success) setComplaints(data.data?.complaints || []);
    } catch (err) { console.error('Complaints fetch failed:', err); }
    finally { setComplaintsLoading(false); }
  }, []);

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await fetch('/api/v1/payment/ledger');
      const data = await res.json();
      if (data.success) {
        setLedgerEntries(data.data?.entries || []);
        setLedgerSummary(data.data?.summary || null);
      }
    } catch (err) { console.error('Ledger fetch failed:', err); }
    finally { setLedgerLoading(false); }
  }, []);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch('/api/v1/parent/reports');
      const data = await res.json();
      if (data.success) setReports(data.data?.reports || []);
    } catch (err) { console.error('Reports fetch failed:', err); }
    finally { setReportsLoading(false); }
  }, []);

  const fetchMonitorReports = useCallback(async () => {
    setMonitorLoading(true);
    try {
      const res = await fetch('/api/v1/monitoring/reports?role=parent');
      const data = await res.json();
      if (data.success) setMonitorReports(data.data?.reports || []);
    } catch (err) { console.error('Monitor reports fetch failed:', err); }
    finally { setMonitorLoading(false); }
  }, []);

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
        const cbRes = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_id: invoiceId }),
        });
        const cbData = await cbRes.json();
        if (cbData.success) { fetchLedger(); fetchInvoices(); }
        else { alert('Payment failed'); }
      } else {
        const Razorpay = getRazorpay();
        if (!Razorpay) { alert('Payment gateway loading...'); return; }
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
            fetchLedger();
            fetchInvoices();
          },
        });
        rzp.open();
      }
    } catch { alert('Network error'); }
    finally { setPayingInvoice(null); }
  }, [fetchLedger, fetchInvoices]);

  const fetchSessionRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.data?.requests ?? []);
    } catch (err) { console.error('[Parent] session-requests fetch failed:', err); }
    finally { setRequestsLoading(false); }
  }, []);

  const submitSessionRequest = async () => {
    if (!requestForm.sessionId || !requestForm.reason) return;
    setRequestSubmitting(true);
    try {
      const body: Record<string, string> = {
        batch_session_id: requestForm.sessionId,
        batch_id: requestForm.batchId,
        request_type: requestForm.requestType,
        reason: requestForm.reason,
      };
      if (requestForm.requestType === 'reschedule') {
        if (requestForm.proposedDate) body.proposed_date = requestForm.proposedDate;
        if (requestForm.proposedTime) body.proposed_time = requestForm.proposedTime;
      }
      const res = await fetch('/api/v1/session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Request submitted successfully');
        setShowRequestForm(false);
        setRequestForm({ sessionId: '', batchId: '', childEmail: '', requestType: 'reschedule', reason: '', proposedDate: '', proposedTime: '' });
        fetchSessionRequests();
      } else {
        toast.error(data.error || 'Failed to submit request');
      }
    } catch { toast.error('Network error'); }
    finally { setRequestSubmitting(false); }
  };

  const withdrawSessionRequest = async (id: string) => {
    try {
      const res = await fetch('/api/v1/session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', request_id: id }),
      });
      const data = await res.json();
      if (data.success) toast.success('Request withdrawn');
      fetchSessionRequests();
    } catch { toast.error('Failed to withdraw request'); }
  };

  // Quick action: open request form pre-filled for a specific session
  const openQuickRequest = (room: ChildRoom, type: 'cancel' | 'reschedule') => {
    setRequestForm({
      sessionId: room.batch_session_id || room.room_id,
      batchId: room.batch_id || '',
      childEmail: room.student_email || '',
      requestType: type,
      reason: '',
      proposedDate: '',
      proposedTime: '',
    });
    setShowRequestForm(true);
    setActiveTab('complaints' as TabId);
  };

  /* ─── Submit complaint ──────────────────────────────────── */

  const submitComplaint = async () => {
    if (!complaintForm.subject.trim() || !complaintForm.description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/parent/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complaintForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowComplaintForm(false);
        setComplaintForm({ subject: '', category: 'general', description: '', priority: 'medium' });
        fetchComplaints();
      }
    } catch (err) { console.error('Complaint submit failed:', err); }
    finally { setSubmitting(false); }
  };

  /* ─── Hash sync ──────────────────────────────────────────── */

  useEffect(() => {
    const hash = activeTab === 'overview' ? '' : `#${activeTab}`;
    window.history.replaceState(null, '', window.location.pathname + hash);
  }, [activeTab]);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(h)) setActiveTab(h);
      else if (!window.location.hash) setActiveTab('overview');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchInvoices();
    fetchCredits();
  }, [fetchRooms, fetchInvoices, fetchCredits]);

  // Poll rooms every 60s so live/scheduled sessions update automatically
  useEffect(() => {
    const id = setInterval(fetchRooms, 60_000);
    return () => clearInterval(id);
  }, [fetchRooms]);

  // Refresh invoices when page regains focus (e.g. after paying via WhatsApp link in another tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') { fetchInvoices(); fetchLedger(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchInvoices, fetchLedger]);

  // Load tab data on every tab visit (always fresh)
  useEffect(() => {
    if (activeTab === 'classes') fetchRooms();
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'exams') fetchExams();
    if (activeTab === 'fees') fetchLedger();
    // Reports: also need attendance data for StudentReportsTab
    if (activeTab === 'reports') { fetchReports(); fetchAttendance(); }
  }, [activeTab, fetchRooms, fetchAttendance, fetchExams, fetchLedger, fetchReports]);

  /* ─── Derived ────────────────────────────────────────────── */

  const live = rooms.filter((r) => effectiveStatus(r) === 'live');
  const upcoming = rooms.filter((r) => effectiveStatus(r) === 'scheduled');
  const ended = rooms.filter((r) => effectiveStatus(r) === 'ended');
  const pendingRequestCount = sessionRequests.filter(r => r.status === 'pending').length;

  // Session picker options for requests tab — only scheduled sessions make sense
  const sessionPickerOptions = rooms
    .filter(r => effectiveStatus(r) === 'scheduled')
    .map(r => ({
      value: r.batch_session_id || r.room_id,
      label: `${r.subject} - ${r.room_name} (${fmtSmartDateIST(r.scheduled_start)})`,
      batchId: r.batch_id || '',
    }));

  const tabs: TabItem[] = [
    { key: 'overview',    label: 'Overview',    icon: LayoutDashboard },
    { key: 'classes',     label: 'Classes',     icon: Calendar },
    ...(permissions?.attendance_view !== false ? [{ key: 'attendance', label: 'Attendance', icon: ClipboardList }] : []),
    ...(permissions?.exams_view     !== false ? [{ key: 'exams',      label: 'Exams',      icon: GraduationCap }] : []),
    ...(permissions?.fees_view      !== false ? [{ key: 'fees',       label: 'Fee Ledger', icon: CreditCard    }] : []),
    ...(permissions?.reports_view   !== false ? [{ key: 'reports',    label: 'Reports',    icon: BarChart3     }] : []),
  ];

  /* ─── Render ──────────────────────────────────────────── */

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const navBadges: Record<string, number> = {};
  const feeBadgeCount = overdueInvoices.length + pendingInvoices.length;
  if (feeBadgeCount > 0) navBadges['/parent#fees'] = feeBadgeCount;
  if (pendingRequestCount > 0) navBadges['/parent#requests'] = pendingRequestCount;

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions} navBadges={navBadges}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} strategy="afterInteractive" />

      <div className="space-y-6">
        {/* Header */}
        <PageHeader icon={Shield} title="Parent Dashboard" subtitle="Monitor your child's sessions, progress, and fees">
          <RefreshButton loading={loading} onClick={() => {
            fetchRooms(); fetchInvoices(); fetchCredits();
            if (activeTab === 'attendance') fetchAttendance();
            if (activeTab === 'exams') fetchExams();
            if (activeTab === 'fees') fetchLedger();
            if (activeTab === 'reports') { fetchReports(); fetchAttendance(); }
          }} label="Refresh" />
        </PageHeader>

        {/* Tabs */}
        {/* Navigation handled by DashboardShell sidebar — no duplicate TabBar */}

        {/* ─── OVERVIEW TAB ──────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Fee / Access Alerts — shown first so parents see immediately */}
            <ParentAlertsWidget rooms={rooms} invoices={invoices} onFeeClick={() => setActiveTab('fees')} />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Radio} label="Live Now" value={live.length} variant="success" />
              <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} variant="info" />
              <StatCard icon={CheckCircle2} label="Total Sessions" value={rooms.length} variant="default" />
            </div>

            {/* Credits alerts — only for per-class batch types (not group 1:15/lecture etc.) */}
            {(() => {
              const GROUP_TYPES = new Set(['one_to_fifteen', 'one_to_thirty', 'one_to_many', 'lecture']);
              const hasPerClassCredits = creditsData?.children?.some((ch: { credits: { batch_type?: string }[] }) =>
                ch.credits.some((c: { batch_type?: string }) => c.batch_type && !GROUP_TYPES.has(c.batch_type))
              );
              if (!hasPerClassCredits) return null;
              return (
                <>
                  {creditsData?.exhausted && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                      <Ban className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-800">Session credits exhausted</p>
                        <p className="text-xs text-red-600 mt-0.5">All prepaid sessions used — class access is blocked until credits are renewed.</p>
                      </div>
                      <button onClick={() => setActiveTab('fees')} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition">Renew Now</button>
                    </div>
                  )}
                  {creditsData?.warning && !creditsData.exhausted && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">Low session credits</p>
                        <p className="text-xs text-amber-600 mt-0.5">{creditsData.total_remaining} of {creditsData.total_allotted} credits remaining — renew soon.</p>
                      </div>
                      <button onClick={() => setActiveTab('fees')} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition">Renew</button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Per-child credits summary — only show if child has per-class credits */}
            {creditsData?.children && creditsData.children.length > 0 && (() => {
              const GROUP_TYPES = new Set(['one_to_fifteen', 'one_to_thirty', 'one_to_many', 'lecture']);
              const childrenWithCredits = (creditsData.children as { student_email: string; student_name: string; total_remaining: number; total_allotted: number; warning: boolean; exhausted: boolean; credits: { subject: string; remaining: number; total_sessions: number; batch_type?: string }[] }[])
                .filter(ch => ch.credits.some((c: { batch_type?: string }) => c.batch_type && !GROUP_TYPES.has(c.batch_type)));
              if (childrenWithCredits.length === 0) return null;
              return (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-indigo-600" /> Session Credits
                  </h3>
                  <div className="space-y-3">
                    {childrenWithCredits.map((child) => (
                      <div key={child.student_email} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm font-semibold text-gray-900">{child.student_name}</span>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${child.exhausted ? 'bg-red-100 text-red-700' : child.warning ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {child.total_remaining}/{child.total_allotted} credits
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {child.credits.filter((c: { batch_type?: string }) => c.batch_type && !GROUP_TYPES.has(c.batch_type!)).map((c: { subject: string; remaining: number; total_sessions: number; batch_type?: string }) => {
                            const batchLabel = c.batch_type ? (BATCH_TYPE_LABEL[c.batch_type] || c.batch_type) : null;
                            return (
                              <div key={`${c.subject}-${c.batch_type}`} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border ${c.remaining <= 0 ? 'bg-red-50 text-red-700 border-red-200' : c.remaining <= 5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-700 border-gray-200'}`}>
                                <span className="font-semibold">{c.subject}</span>
                                {batchLabel && <span className={`rounded px-1 py-px text-[10px] font-bold ${c.remaining <= 0 ? 'bg-red-100' : c.remaining <= 5 ? 'bg-amber-100' : 'bg-gray-100 text-gray-500'}`}>{batchLabel}</span>}
                                <span className="font-bold">{c.remaining}<span className="font-normal text-[10px] opacity-60">/{c.total_sessions}</span></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })()}

            {/* Quick Actions */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-emerald-600" /> Quick Actions
              </h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveTab('fees')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition">
                  <CreditCard className="h-3.5 w-3.5" /> Make Payment
                </button>
                <button onClick={() => setActiveTab('reports')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition">
                  <FileText className="h-3.5 w-3.5" /> View Reports
                </button>
                <button onClick={() => setActiveTab('attendance')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition">
                  <ClipboardList className="h-3.5 w-3.5" /> Attendance
                </button>
              </div>
            </Card>

            {/* Live classes with observe */}
            {live.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="h-4 w-4 animate-pulse" /> Live Now
                </h2>
                <div className="space-y-3">
                  {live.map((room) => (
                    <Card key={room.room_id} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                          <Radio className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{room.room_name}</h3>
                          <p className="text-xs text-gray-500">
                            {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                          </p>
                        </div>
                        {overdueInvoices.length > 0 ? (
                          <button
                            onClick={() => setActiveTab('fees')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 transition"
                          >
                            <AlertCircle className="h-3.5 w-3.5" /> Pay to Observe
                          </button>
                        ) : (
                          <a
                            href={`/classroom/${room.room_id}?mode=observe`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition"
                          >
                            <Eye className="h-3.5 w-3.5" /> Observe
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Upcoming Sessions
              </h2>
              {loading && rooms.length === 0 ? (
                <LoadingState />
              ) : upcoming.length === 0 ? (
                <EmptyState icon={Calendar} message="No upcoming sessions" />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((room) => (
                    <Card key={room.room_id} className="p-4">
                      <div className="flex items-center gap-4">
                        <Calendar className="h-8 w-8 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{room.room_name}</h3>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            <span>{room.subject} · {room.grade}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {fmtSmartDateIST(room.scheduled_start)}
                            </span>
                          </div>
                          {room.student_name && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <Users className="h-3 w-3" />{room.student_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Completed */}
            {ended.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Completed
                </h2>
                <div className="space-y-2">
                  {ended.slice(0, 5).map((room) => (
                    <Card key={room.room_id} className="p-3 opacity-70">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{room.room_name}</p>
                          <p className="text-xs text-gray-400">{room.subject} · {room.grade}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Fee Summary */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Fee Summary
              </h2>
              {invoices.length === 0 ? (
                <EmptyState icon={CreditCard} message="No invoices found" />
              ) : (
                <div className="space-y-2">
                  {invoices.slice(0, 5).map((inv, idx) => {
                    const st = inv.status as string;
                    return (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{inv.invoice_number as string || `Invoice #${idx + 1}`}</p>
                            <p className="text-xs text-gray-500">
                              {money(inv.amount_paise as number, inv.currency as string)} · Due: {inv.due_date ? new Date(inv.due_date as string).toLocaleDateString('en-IN') : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={st} />
                            {!!inv.pay_token ? (
                              <a
                                href={`/pay/${inv.id as string}?t=${inv.pay_token as string}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
                              >
                                <ExternalLink className="h-3 w-3" /> View
                              </a>
                            ) : (
                              <a
                                href={`/api/v1/payment/invoice-pdf/${inv.id as string}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
                              >
                                <Download className="h-3 w-3" /> View
                              </a>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  <button onClick={() => setActiveTab('fees')} className="text-xs text-emerald-600 hover:underline">
                    View all {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CLASSES TAB ─────────────────────────────────── */}
        {activeTab === 'classes' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-600" /> Classes
              </h2>
              <span className="text-xs text-gray-400">{rooms.length} session{rooms.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <LoadingState />
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">No sessions found</p>
                <p className="mt-1 text-xs text-gray-400">Your child&apos;s upcoming and completed sessions will appear here</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* ── Live Now Banner ── */}
                {live.length > 0 && (
                  <div className="rounded-2xl border-2 border-green-300 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Radio className="h-4 w-4 text-green-600 animate-pulse" />
                      <span className="text-sm font-bold text-green-700 uppercase tracking-wide">Live Now</span>
                      <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{live.length} live</span>
                    </div>
                    <div className="space-y-2">
                      {live.map(room => (
                        <div key={room.room_id} className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5 shadow-sm">
                          <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{room.subject} — {room.room_name}</p>
                            <p className="text-xs text-gray-500">
                              {room.grade}
                              {room.teacher_email ? ` · Teacher: ${room.teacher_email}` : ''}
                              {room.student_name ? ` · ${room.student_name}` : ''}
                            </p>
                          </div>
                          <a
                            href={`/classroom/${room.room_id}?mode=observe`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 transition shadow-sm shrink-0"
                          >
                            <Eye className="h-3.5 w-3.5" /> Observe
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Upcoming Sessions ── */}
                {upcoming.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">Upcoming ({upcoming.length})</p>
                    {upcoming.map(room => {
                      const d = new Date(room.scheduled_start);
                      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
                      const dayNum = d.getDate();
                      const mon = d.toLocaleDateString('en-IN', { month: 'short' });
                      return (
                        <div key={room.room_id} className="flex items-stretch rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                          <div className="flex w-14 flex-col items-center justify-center border-r border-gray-100 bg-gray-50/80 px-2 py-3">
                            <span className="text-[10px] font-semibold uppercase text-gray-400">{dayName}</span>
                            <span className="text-xl font-black text-gray-800 leading-none">{dayNum}</span>
                            <span className="text-[10px] font-medium text-gray-400">{mon}</span>
                          </div>
                          <div className="flex flex-1 items-center gap-3 px-3 py-3 min-w-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{room.subject}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{room.room_name} · {fmtTimeIST(room.scheduled_start)} · {room.duration_minutes}min</p>
                              {room.student_name && (
                                <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                                  <Users className="h-3 w-3" />{room.student_name}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 shrink-0">Upcoming</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Completed Sessions ── */}
                {ended.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">Completed ({ended.length})</p>
                    {ended.slice(0, 15).map(room => {
                      const d = new Date(room.scheduled_start);
                      const dayNum = d.getDate();
                      const mon = d.toLocaleDateString('en-IN', { month: 'short' });
                      return (
                        <div key={room.room_id} className="flex items-stretch rounded-2xl border border-gray-100 bg-white/60 shadow-sm overflow-hidden opacity-75">
                          <div className="flex w-14 flex-col items-center justify-center border-r border-gray-100 bg-gray-50/80 px-2 py-3">
                            <span className="text-xl font-black text-gray-500 leading-none">{dayNum}</span>
                            <span className="text-[10px] font-medium text-gray-400">{mon}</span>
                          </div>
                          <div className="flex flex-1 items-center gap-3 px-3 py-3 min-w-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{room.subject} — {room.room_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{room.grade}{room.student_name ? ` · ${room.student_name}` : ''}</p>
                            </div>
                            <span className="text-[10px] font-bold rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 shrink-0">Done</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── ATTENDANCE TAB ──────────────────────────────── */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-600" /> Attendance Reports
              </h2>
            </div>

            {attendanceLoading ? (
              <LoadingState />
            ) : attendanceChildren.length === 0 ? (
              <EmptyState icon={ClipboardList} message="No attendance records found" />
            ) : (
              attendanceChildren.map((child) => (
                <div key={child.student_email} className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    {child.student_name}
                  </h3>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      icon={BarChart3}
                      label="Attendance Rate"
                      value={`${child.summary.attendance_rate}%`}
                      variant={child.summary.attendance_rate >= 75 ? 'success' : 'danger'}
                    />
                    <StatCard icon={CheckCircle2} label="On Time" value={`${child.summary.present}/${child.summary.total_sessions}`} variant="success" />
                    <StatCard icon={AlertCircle} label="Absent" value={child.summary.absent} variant="danger" />
                    <StatCard icon={Clock} label="Late" value={child.summary.late} variant="warning" />
                  </div>

                  {/* Recent Sessions */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase">Recent Sessions</h4>
                    <div className="space-y-2">
                      {child.recent_sessions.slice(0, 10).map((session, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              session.status === 'present' ? 'bg-emerald-500' :
                              session.status === 'absent' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{session.batch_name}</p>
                              <p className="text-xs text-gray-500">
                                {session.subject} · {new Date(session.scheduled_start).toLocaleDateString('en-IN')}
                                {session.is_late && (
                                  <span className="ml-2 text-amber-600">Late by {Math.round(session.late_by_seconds / 60)}min</span>
                                )}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400">
                              {Math.round(session.time_in_class_seconds / 60)}min
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── EXAMS TAB ───────────────────────────────────── */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" /> Exam Results
              </h2>
            </div>

            {examLoading ? (
              <LoadingState />
            ) : examChildren.length === 0 ? (
              <EmptyState icon={GraduationCap} message="No exam results found" />
            ) : (
              examChildren.map((child) => (
                <div key={child.student_email} className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    {child.student_name}
                  </h3>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      icon={BarChart3}
                      label="Average Score"
                      value={`${child.summary.avg_percentage}%`}
                      variant={child.summary.avg_percentage >= 60 ? 'success' : 'danger'}
                    />
                    <StatCard icon={BookOpen} label="Exams Taken" value={child.summary.total_exams} variant="default" />
                    <StatCard icon={TrendingUp} label="Passed" value={child.summary.passed} variant="success" />
                    <StatCard icon={TrendingDown} label="Failed" value={child.summary.failed} variant="danger" />
                  </div>

                  {/* Subject-wise Performance Matrix */}
                  {child.exams.length > 0 && (() => {
                    const bySubject: Record<string, { total: number; sum: number; passed: number; count: number; best: number; worst: number }> = {};
                    child.exams.forEach(e => {
                      if (!bySubject[e.subject]) bySubject[e.subject] = { total: 0, sum: 0, passed: 0, count: 0, best: 0, worst: 100 };
                      const s = bySubject[e.subject];
                      s.count++; s.sum += e.percentage; s.total += e.total_marks;
                      if (e.passed) s.passed++;
                      if (e.percentage > s.best) s.best = e.percentage;
                      if (e.percentage < s.worst) s.worst = e.percentage;
                    });
                    const subjects = Object.entries(bySubject);
                    if (subjects.length < 1) return null;
                    return (
                      <Card className="p-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <BarChart3 className="h-3 w-3" /> Subject Performance
                        </h4>
                        <div className="space-y-2.5">
                          {subjects.map(([subject, data]) => {
                            const avg = Math.round(data.sum / data.count);
                            const barColor = avg >= 75 ? 'bg-emerald-500' : avg >= 50 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={subject}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-900">{subject}</span>
                                  <span className="text-xs text-gray-500">
                                    {avg}% avg · {data.count} exam{data.count !== 1 ? 's' : ''} · {data.passed} passed
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${avg}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })()}

                  {/* Exam List */}
                  <div className="space-y-2">
                    {child.exams.map((exam) => (
                      <Card key={exam.attempt_id} className="p-3">
                        <div className="flex items-center gap-3">
                          <BookOpen className={`h-5 w-5 ${exam.passed ? 'text-emerald-600' : 'text-red-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{exam.exam_title}</p>
                            <p className="text-xs text-gray-500">
                              {exam.subject} · {exam.exam_type} · {new Date(exam.submitted_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${exam.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                              {exam.total_marks_obtained}/{exam.total_marks}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {exam.percentage.toFixed(1)}% · {exam.grade_letter}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── FEES / LEDGER TAB ────────────────────────────── */}
        {activeTab === 'fees' && (
          <div className="space-y-5">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" /> Fees & Payments
              </h2>
            </div>

            {ledgerLoading && ledgerEntries.length === 0 ? (
              <LoadingState />
            ) : (
              <>
                {/* ── Summary Gradient Cards ── */}
                {ledgerSummary && (() => {
                  const pendingAmt = invoices.filter(i => (i.status as string) === 'pending').reduce((s, i) => s + ((i.amount_paise as number) || 0), 0);
                  const overdueCount = invoices.filter(i => (i.status as string) === 'overdue').length;
                  const paidCount = invoices.filter(i => (i.status as string) === 'paid').length;
                  const pendingCount = invoices.filter(i => (i.status as string) === 'pending').length;
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 p-4 text-white shadow-md shadow-teal-500/20">
                        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-100">Total Billed</p>
                        <p className="mt-1.5 text-xl font-black tracking-tight">{money(ledgerSummary.total_invoiced_paise, ledgerSummary.currency)}</p>
                        <p className="mt-0.5 text-[11px] text-teal-200">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-white shadow-md shadow-emerald-500/20">
                        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">Paid</p>
                        <p className="mt-1.5 text-xl font-black tracking-tight">{money(ledgerSummary.total_paid_paise, ledgerSummary.currency)}</p>
                        <p className="mt-0.5 text-[11px] text-emerald-200">{paidCount} settled</p>
                      </div>
                      <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md ${
                        pendingAmt > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20' : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/20'
                      }`}>
                        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-100">Pending</p>
                        <p className="mt-1.5 text-xl font-black tracking-tight">{money(pendingAmt, ledgerSummary.currency)}</p>
                        <p className="mt-0.5 text-[11px] text-orange-200">{pendingCount} due</p>
                      </div>
                      <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md ${
                        overdueCount > 0 ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20' : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/20'
                      }`}>
                        <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-100">Overdue</p>
                        <p className="mt-1.5 text-xl font-black tracking-tight">{overdueCount}</p>
                        <p className="mt-0.5 text-[11px] text-red-200">{overdueCount > 0 ? 'action needed' : 'all clear'}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Overdue alert */}
                {invoices.some(i => i.status === 'overdue') && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700 font-medium">
                      {invoices.filter(i => i.status === 'overdue').length} overdue invoice{invoices.filter(i => i.status === 'overdue').length > 1 ? 's' : ''} — please pay promptly to avoid disruption.
                    </p>
                  </div>
                )}

                {/* ── Scheduled Invoices ── */}
                {invoices.filter(inv => inv.status === 'scheduled').length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
                      Upcoming ({invoices.filter(inv => inv.status === 'scheduled').length})
                    </p>
                    {invoices.filter(inv => inv.status === 'scheduled').map(inv => (
                      <div key={inv.id as string} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white shadow-sm bg-indigo-400" />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold text-gray-700">{inv.invoice_number as string}</span>
                                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700">Scheduled</span>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-gray-900">{String(inv.description || 'Fee Invoice')}</p>
                              {!!inv.due_date && (
                                <p className="text-xs font-medium mt-0.5 text-indigo-600">
                                  Due: {new Date(inv.due_date as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xl font-black text-gray-900 shrink-0">{money(inv.amount_paise as number, inv.currency as string)}</p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <a
                            href={inv.pay_token ? `/pay/${inv.id as string}?t=${inv.pay_token as string}` : `/api/v1/payment/invoice-pdf/${inv.id as string}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                          >
                            <ExternalLink className="h-3 w-3" /> View Invoice
                          </a>
                          <a
                            href={`/api/v1/payment/invoice-pdf/${inv.id as string}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition"
                          >
                            <Download className="h-3 w-3" /> Print
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Pending / Overdue Invoices ── */}
                {invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
                      Action Required ({invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').length})
                    </p>
                    {invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').map(inv => {
                      const isOverdue = inv.status === 'overdue';
                      return (
                        <div key={inv.id as string} className={`rounded-2xl border p-4 ${isOverdue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white shadow-sm ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-gray-700">{inv.invoice_number as string}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isOverdue ? 'Overdue' : 'Pending'}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-gray-900">{String(inv.description || 'Fee Invoice')}</p>
                                {!!inv.due_date && (
                                  <p className={`text-xs font-medium mt-0.5 ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                                    Due: {new Date(inv.due_date as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xl font-black text-gray-900">{money(inv.amount_paise as number, inv.currency as string)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handlePayInvoice(inv.id as string)}
                              disabled={payingInvoice === inv.id as string}
                              className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 transition shadow-sm shadow-teal-500/30"
                            >
                              <CreditCard className="h-3 w-3" />
                              {payingInvoice === inv.id as string ? 'Processing…' : 'Pay Now'}
                            </button>
                            {!!inv.pay_token && (
                              <a
                                href={`/pay/${inv.id as string}?t=${inv.pay_token as string}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                              >
                                <ExternalLink className="h-3 w-3" /> View Invoice
                              </a>
                            )}
                            <a
                              href={`/api/v1/payment/invoice-pdf/${inv.id as string}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition"
                            >
                              <Download className="h-3 w-3" /> Print
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Paid Receipts ── */}
                {invoices.filter(inv => inv.status === 'paid').length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
                      Paid Receipts ({invoices.filter(inv => inv.status === 'paid').length})
                    </p>
                    {invoices.filter(inv => inv.status === 'paid').slice(0, 20).map(inv => (
                        <div key={inv.id as string} className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-gray-700">{inv.invoice_number as string}</span>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Paid</span>
                            </div>
                            <p className="text-sm font-medium text-gray-700 truncate">{(inv.description as string) || 'Fee Invoice'}</p>
                            <div className="flex flex-wrap gap-x-3 mt-0.5">
                              {!!inv.paid_at && (
                                <p className="text-xs text-emerald-600 font-medium">
                                  Paid {new Date(inv.paid_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-black text-emerald-700">{money(inv.amount_paise as number, inv.currency as string)}</p>
                            <div className="mt-1.5 flex items-center justify-end gap-1.5">
                              {!!inv.pay_token ? (
                                <a
                                  href={`/pay/${inv.id as string}?t=${inv.pay_token as string}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 transition"
                                >
                                  <ExternalLink className="h-3 w-3" />View
                                </a>
                              ) : null}
                              <a
                                href={`/api/v1/payment/invoice-pdf/${inv.id as string}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 transition"
                              >
                                <Download className="h-3 w-3" />Print
                              </a>
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                )}

                {/* ── Full Transaction Ledger ── */}
                {ledgerEntries.length > 0 && (
                  <div>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">Transaction Ledger</p>
                    <div className="overflow-hidden rounded-2xl border border-gray-200">
                      <TableWrapper>
                        <THead>
                          <TH>Date</TH>
                          <TH>Reference</TH>
                          <TH>Description</TH>
                          <TH className="text-right">Debit</TH>
                          <TH className="text-right">Credit</TH>
                          <TH className="text-right">Balance</TH>
                        </THead>
                        <tbody>
                          {ledgerEntries.map((entry, idx) => (
                            <TRow key={idx}>
                              <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                                {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-2.5 text-xs font-mono text-gray-900">{entry.reference}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[180px]">{entry.description}</td>
                              <td className="px-4 py-2.5 text-xs text-right font-medium text-red-600">
                                {entry.debit_paise > 0 ? money(entry.debit_paise, entry.currency) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-right font-medium text-emerald-600">
                                {entry.credit_paise > 0 ? money(entry.credit_paise, entry.currency) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className={`px-4 py-2.5 text-xs text-right font-bold ${entry.balance_paise > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {money(entry.balance_paise, entry.currency)}
                              </td>
                            </TRow>
                          ))}
                        </tbody>
                      </TableWrapper>
                    </div>
                  </div>
                )}

                {invoices.length === 0 && ledgerEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                      <CreditCard className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No fee records yet</p>
                    <p className="mt-1 text-xs text-gray-400">Your invoices and payments will appear here.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── REPORTS TAB ─────────────────────────────────── */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" /> Progress Reports
              </h2>
            </div>

            {reportsLoading ? (
              <LoadingState />
            ) : reports.length === 0 ? (
              <div className="text-center py-16">
                <EmptyState icon={BarChart3} message="No reports available yet" />
                <p className="text-xs text-gray-400 mt-1">Monthly progress reports will appear here once generated.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => {
                  const id = String(report.id);
                  const isExpanded = expandedReport === id;
                  const data = report.data as Record<string, unknown>;
                  const students = (data?.students as Array<Record<string, unknown>>) || [];

                  return (
                    <Card key={id} className="overflow-hidden">
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : id)}
                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <BarChart3 className="h-5 w-5 text-emerald-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{report.title as string}</p>
                          <p className="text-xs text-gray-500">
                            {report.report_type as string} · {new Date(report.created_at as string).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </button>

                      {isExpanded && students.length > 0 && (
                        <div className="border-t border-gray-200 p-4 space-y-4">
                          {students.map((student, sIdx) => {
                            const att = student.attendance as Record<string, number> || {};
                            const academic = student.academic as Record<string, number> || {};
                            const fees = student.fees as Record<string, number> || {};

                            return (
                              <div key={sIdx} className="rounded-lg border border-gray-100 p-3">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">{student.student_name as string}</h4>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-gray-500">Attendance</p>
                                    <p className="font-bold text-emerald-600">{att.attendance_rate || 0}%</p>
                                    <p className="text-[10px] text-gray-400">{att.present || 0}/{att.total_sessions || 0} sessions</p>
                                  </div>
                                  <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-gray-500">Academics</p>
                                    <p className="font-bold text-emerald-600">{academic.avg_percentage || 0}%</p>
                                    <p className="text-[10px] text-gray-400">{academic.exams_taken || 0} exams</p>
                                  </div>
                                  <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-gray-500">Fees</p>
                                    <p className={`font-bold ${(fees.overdue || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {(fees.pending || 0) + (fees.overdue || 0) > 0 ? `${fees.pending || 0} pending` : 'Clear'}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{fees.paid || 0} paid</p>
                                  </div>
                                </div>
                                {(student.topics_covered as Array<Record<string, unknown>>)?.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-[10px] text-gray-400 uppercase mb-1">Topics Covered</p>
                                    <div className="flex flex-wrap gap-1">
                                      {(student.topics_covered as Array<Record<string, unknown>>).slice(0, 8).map((t, tIdx) => (
                                        <span key={tIdx} className="text-[10px] rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5">
                                          {t.class_portion as string}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ─── Per-child detailed report ─── */}
            {attendanceChildren.length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="text-sm font-semibold text-gray-700">Detailed Student Reports</h3>
                {attendanceChildren.map((child) => (
                  <StudentReportsTab
                    key={child.student_email}
                    studentEmail={child.student_email}
                    showStudentHeader
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* monitoring tab removed */}
        {false && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Brain className="h-5 w-5 text-emerald-600" /> AI Monitoring Reports
              </h2>
              <RefreshButton loading={monitorLoading} onClick={fetchMonitorReports} label="Refresh" />
            </div>

            {monitorLoading && monitorReports.length === 0 ? (
              <LoadingState />
            ) : monitorReports.length === 0 ? (
              <div className="text-center">
                <EmptyState icon={Brain} message="No monitoring reports yet" />
                <p className="text-xs text-gray-400 -mt-4">Reports will appear here after your children attend AI-monitored sessions</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                {(() => {
                  const metrics = monitorReports.reduce<{ totalSessions: number; avgAttendance: number; avgAttention: number; totalAlerts: number }>(
                    (acc, r) => {
                      const m = (r.metrics || {}) as Record<string, number>;
                      acc.totalSessions++;
                      acc.avgAttendance += (m.attendance_rate || 0);
                      acc.avgAttention += (m.avg_attention_score || 0);
                      acc.totalAlerts += (m.alerts_count || 0);
                      return acc;
                    },
                    { totalSessions: 0, avgAttendance: 0, avgAttention: 0, totalAlerts: 0 }
                  );
                  if (metrics.totalSessions > 0) {
                    metrics.avgAttendance = Math.round(metrics.avgAttendance / metrics.totalSessions);
                    metrics.avgAttention = Math.round(metrics.avgAttention / metrics.totalSessions);
                  }
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatCard icon={FileText} label="Reports" value={metrics.totalSessions} variant="info" />
                      <StatCard icon={CheckCircle2} label="Avg Attendance" value={`${metrics.avgAttendance}%`} variant="success" />
                      <StatCard
                        icon={Eye}
                        label="Avg Attention"
                        value={`${metrics.avgAttention}%`}
                        variant={metrics.avgAttention >= 70 ? 'success' : metrics.avgAttention >= 50 ? 'warning' : 'danger'}
                      />
                      <StatCard
                        icon={AlertCircle}
                        label="Total Alerts"
                        value={metrics.totalAlerts}
                        variant={metrics.totalAlerts > 10 ? 'danger' : 'warning'}
                      />
                    </div>
                  );
                })()}

                {/* Reports grouped by child */}
                {(() => {
                  const byChild: Record<string, Record<string, unknown>[]> = {};
                  monitorReports.forEach((r) => {
                    const key = String(r.target_email || 'unknown');
                    if (!byChild[key]) byChild[key] = [];
                    byChild[key].push(r);
                  });
                  return Object.entries(byChild).map(([email, childReports]) => {
                    const childName = String(childReports[0]?.target_name || email);
                    return (
                      <Card key={email}>
                        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 rounded-t-xl">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <Users className="h-4 w-4 text-emerald-600" />
                            {childName}
                            <Badge label={`${childReports.length} report${childReports.length !== 1 ? 's' : ''}`} variant="primary" />
                          </h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {childReports.map((report) => {
                            const m = (report.metrics || {}) as Record<string, unknown>;
                            const rId = String(report.id);
                            const isExpanded = expandedMonitorReport === rId;
                            return (
                              <div key={rId} className="px-4 py-3">
                                <button
                                  onClick={() => setExpandedMonitorReport(isExpanded ? null : rId)}
                                  className="flex w-full items-center justify-between text-left"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {String(report.report_type || 'session').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Report
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {report.period_start ? fmtSmartDateIST(String(report.period_start)) : ''}
                                      {report.period_end ? ` – ${fmtSmartDateIST(String(report.period_end))}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {m.avg_attention_score != null && (
                                      <Badge
                                        label={`Attention: ${Number(m.avg_attention_score).toFixed(0)}%`}
                                        variant={Number(m.avg_attention_score) >= 70 ? 'success' : Number(m.avg_attention_score) >= 50 ? 'warning' : 'danger'}
                                      />
                                    )}
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                  </div>
                                </button>

                                {expandedMonitorReport === rId && (
                                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                      {m.attendance_rate != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.attendance_rate).toFixed(0)}%</p>
                                          <p className="text-[10px] text-gray-500">Attendance</p>
                                        </div>
                                      )}
                                      {m.avg_attention_score != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.avg_attention_score).toFixed(0)}%</p>
                                          <p className="text-[10px] text-gray-500">Attention</p>
                                        </div>
                                      )}
                                      {m.alerts_count != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.alerts_count)}</p>
                                          <p className="text-[10px] text-gray-500">Alerts</p>
                                        </div>
                                      )}
                                      {m.sessions_monitored != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.sessions_monitored)}</p>
                                          <p className="text-[10px] text-gray-500">Sessions</p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Engagement metric breakdown */}
                                    {(m.looking_away_minutes != null || m.eyes_closed_minutes != null || m.distracted_minutes != null) && (
                                      <div>
                                        <p className="mb-1.5 text-xs font-medium text-gray-500">Engagement Breakdown</p>
                                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                          {Number(m.looking_away_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-amber-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-amber-700">{Number(m.looking_away_minutes)} min</p>
                                              <p className="text-[9px] text-amber-600">Looking Away</p>
                                            </div>
                                          )}
                                          {Number(m.eyes_closed_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-red-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-red-700">{Number(m.eyes_closed_minutes)} min</p>
                                              <p className="text-[9px] text-red-600">Eyes Closed</p>
                                            </div>
                                          )}
                                          {Number(m.distracted_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-orange-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-orange-700">{Number(m.distracted_minutes)} min</p>
                                              <p className="text-[9px] text-orange-600">Distracted</p>
                                            </div>
                                          )}
                                          {Number(m.not_in_frame_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-gray-100 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-gray-700">{Number(m.not_in_frame_minutes)} min</p>
                                              <p className="text-[9px] text-gray-600">Not in Frame</p>
                                            </div>
                                          )}
                                          {Number(m.head_turned_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-amber-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-amber-700">{Number(m.head_turned_minutes)} min</p>
                                              <p className="text-[9px] text-amber-600">Not Looking</p>
                                            </div>
                                          )}
                                          {Number(m.tab_switched_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-purple-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-purple-700">{Number(m.tab_switched_minutes)} min</p>
                                              <p className="text-[9px] text-purple-600">Tab Switched</p>
                                            </div>
                                          )}
                                          {Number(m.yawning_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-purple-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-purple-700">{Number(m.yawning_minutes)} min</p>
                                              <p className="text-[9px] text-purple-600">Yawning</p>
                                            </div>
                                          )}
                                          {Number(m.phone_detected_minutes || 0) > 0 && (
                                            <div className="rounded-md bg-red-50 px-2 py-1.5 text-center">
                                              <p className="text-xs font-bold text-red-700">{Number(m.phone_detected_minutes)} min</p>
                                              <p className="text-[9px] text-red-600">Phone Detected</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {m.overall_summary ? (
                                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                                        <div className="mb-1 flex items-center gap-1 font-semibold">
                                          <Shield className="h-3.5 w-3.5" /> AI Summary
                                        </div>
                                        {String(m.overall_summary)}
                                      </div>
                                    ) : null}
                                    {Array.isArray(m.alert_breakdown) && (m.alert_breakdown as Array<Record<string, unknown>>).length > 0 && (
                                      <div>
                                        <p className="mb-1 text-xs font-medium text-gray-500">Alert Breakdown</p>
                                        <div className="flex flex-wrap gap-2">
                                          {(m.alert_breakdown as Array<Record<string, unknown>>).map((ab, i) => (
                                            <Badge key={i} label={`${String(ab.type || ab.alert_type || 'alert')}: ${String(ab.count || 0)}`} variant="default" />
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
                      </Card>
                    );
                  });
                })()}
              </>
            )}
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
