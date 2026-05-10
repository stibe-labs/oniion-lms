'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button, Badge,
  LoadingState, EmptyState,
  useToast,
} from '@/components/dashboard/shared';
import { CreateUserModal, examGradeToCategory, CATEGORY_STYLES } from '@/components/dashboard/CreateUserForm';
import {
  Copy, ExternalLink, Plus, Clock, User, CheckCircle, XCircle, Link2, RefreshCw, Eye, PlayCircle, Check,
  Mail, Phone, BookOpen, GraduationCap, MessageSquare, Award, BarChart3,
  Trash2, CheckSquare, Square, Users, UserCheck, UserPlus, Send, Loader2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface DemoRequest {
  id: string;
  demo_link_id: string;
  student_email: string | null;
  student_name: string | null;
  student_phone: string | null;
  student_grade: string | null;
  student_board: string | null;
  subject: string | null;
  portions: string | null;
  sample_portions: string[] | null;
  teacher_email: string | null;
  teacher_name: string | null;
  status: string;
  outcome: string | null;
  room_id: string | null;
  scheduled_start: string | null;
  duration_minutes: number;
  ao_email: string | null;
  teacher_responded_at: string | null;
  teacher_note: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  // Exam result fields (from LEFT JOIN)
  exam_score: number | null;
  exam_total_marks: number | null;
  exam_percentage: number | null;
  exam_grade: string | null;
  exam_answered: number | null;
  exam_skipped: number | null;
  exam_time_taken: number | null;
  // Student feedback (from LEFT JOIN)
  feedback_rating: number | null;
  feedback_text: string | null;
  feedback_tags: string | null;
}

interface TeacherSession {
  start: string;
  end: string;
  duration: number;
  type: string;
  label: string;
  status: string;
}

interface AvailableTeacher {
  email: string;
  name: string;
  subjects: string[];
  qualification?: string;
  isFree: boolean;
  freeAfter: string | null;
  currentSession: { label: string; end: string; status: string } | null;
  schedule: TeacherSession[];
}

// ─── Status helpers ─────────────────────────────────────────

function demoStatusLabel(status: string): string {
  switch (status) {
    case 'link_created': return 'Link Created';
    case 'submitted': return 'Submitted';
    case 'pending_teacher': return 'Pending Teacher';
    case 'accepted': return 'Accepted';
    case 'live': return 'Live';
    case 'completed': return 'Completed';
    case 'rejected': return 'Rejected';
    case 'expired': return 'Expired';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

/** Returns a single clear label + Tailwind style based on combined status + outcome */
function demoCombinedStatus(status: string, outcome: string | null): { label: string; style: string } {
  // Terminal / non-completed statuses
  switch (status) {
    case 'link_created': return { label: 'Link Created', style: 'bg-gray-100 text-gray-600 border-gray-200' };
    case 'submitted':    return { label: 'Registered', style: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'pending_teacher': return { label: 'Pending Teacher', style: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'accepted':     return { label: 'Demo Scheduled', style: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    case 'live':         return { label: '● Live Now', style: 'bg-primary/10 text-primary border-primary/20' };
    case 'rejected':     return { label: 'Teacher Rejected', style: 'bg-red-100 text-red-700 border-red-200' };
    case 'expired':      return { label: 'Expired', style: 'bg-gray-100 text-gray-500 border-gray-200' };
    case 'cancelled':    return { label: 'Cancelled', style: 'bg-gray-100 text-gray-500 border-gray-200' };
  }
  // completed — use outcome for clear status
  if (status === 'completed') {
    switch (outcome) {
      case 'completed_with_exam': return { label: 'Completed + Exam', style: 'bg-primary/10 text-primary border-primary/20' };
      case 'student_no_show':     return { label: 'Student No-Show', style: 'bg-red-100 text-red-700 border-red-200' };
      case 'cancelled_by_teacher': return { label: 'Ended Early', style: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'time_expired':        return { label: 'Time Expired', style: 'bg-gray-100 text-gray-600 border-gray-200' };
      default:                    return { label: 'Demo Completed', style: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
  }
  return { label: status, style: 'bg-gray-100 text-gray-600 border-gray-200' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusDescription(req: DemoRequest): string {
  switch (req.status) {
    case 'link_created': return 'Waiting for student to register via the demo link.';
    case 'submitted': return 'Student registered. Finding an available teacher…';
    case 'pending_teacher': return `Request sent to ${req.teacher_name || 'teacher'}. Awaiting response.`;
    case 'accepted': return `${req.teacher_name || 'Teacher'} accepted! Demo room is ready.`;
    case 'live': return 'Demo session is currently live.';
    case 'completed': {
      if (req.outcome === 'completed_with_exam') return 'Demo completed — student took the sample exam.';
      if (req.outcome === 'student_no_show') return 'Student did not join the demo session.';
      if (req.outcome === 'cancelled_by_teacher') return 'Demo was ended by the teacher.';
      if (req.outcome === 'time_expired') return 'Demo session time expired.';
      return 'Demo session has been completed.';
    }
    case 'rejected': return `${req.teacher_name || 'Teacher'} declined.${req.teacher_note ? ` Note: "${req.teacher_note}"` : ''}`;
    case 'expired': return 'This demo link has expired.';
    case 'cancelled': return 'Demo request was cancelled.';
    default: return '';
  }
}

function outcomeLabel(outcome: string | null): string {
  switch (outcome) {
    case 'completed': return 'Completed';
    case 'completed_with_exam': return 'Completed + Exam';
    case 'student_no_show': return 'Student No-Show';
    case 'cancelled_by_teacher': return 'Ended Early';
    case 'time_expired': return 'Time Expired';
    default: return '';
  }
}

function outcomeBadgeStyle(outcome: string | null): string {
  switch (outcome) {
    case 'completed_with_exam': return 'bg-primary/10 text-primary border-primary/20';
    case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'student_no_show': return 'bg-red-100 text-red-700 border-red-200';
    case 'cancelled_by_teacher': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'time_expired': return 'bg-gray-100 text-gray-600 border-gray-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

// ─── Main tabs ──────────────────────────────────────────────
type MainTab = 'sessions' | 'leads';

// ─── Component ──────────────────────────────────────────────

export default function DemoTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [teachers, setTeachers] = useState<AvailableTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'link_created' | 'pending_teacher' | 'accepted' | 'completed'>('active');
  const [mainTab, setMainTab] = useState<MainTab>('sessions');

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Convert-to-student modal
  const [convertingLead, setConvertingLead] = useState<DemoRequest | null>(null);
  const [existingStudents, setExistingStudents] = useState<Set<string>>(new Set());

  // WhatsApp send state
  const [waPhones, setWaPhones] = useState<Record<string, string>>({});
  const [sendingWA, setSendingWA] = useState<string | null>(null);
  const [waSent, setWaSent] = useState<Set<string>>(new Set());

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://stibelearning.online';

  // ── Data fetching ──
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/demo/requests');
      const data = await res.json();
      if (data.success) setRequests(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    try {
      const res = await fetch('/api/v1/demo/available-teachers?hours=4');
      const data = await res.json();
      if (data.success) setTeachers(data.data?.teachers || []);
    } catch { /* ignore */ }
    setLoadingTeachers(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchTeachers();
  }, [fetchRequests, fetchTeachers]);

  // Check which demo student emails already exist as portal users (batch query)
  useEffect(() => {
    const emails = leads.map(l => l.student_email).filter(Boolean) as string[];
    if (emails.length === 0) return;
    const checkExisting = async () => {
      try {
        const uniqueEmails = [...new Set(emails)];
        const res = await fetch(`/api/v1/hr/users?emails=${encodeURIComponent(uniqueEmails.join(','))}`);
        const data = await res.json();
        if (data.success && data.data?.existing) {
          setExistingStudents(new Set(data.data.existing as string[]));
        }
      } catch { /* ignore */ }
    };
    checkExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  // ── Actions ──
  const generateLink = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/demo/requests', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Demo link generated!');
        fetchRequests();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    setGenerating(false);
  };

  const cancelRequest = async (id: string) => {
    try {
      const res = await fetch('/api/v1/demo/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action: 'cancel' }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Cancelled'); fetchRequests(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/v1/demo/requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${data.data?.deleted || selected.size} demo(s)`);
        setSelected(new Set());
        fetchRequests();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    setDeleting(false);
  };

  const copyLink = (linkId: string) => {
    const url = `${baseUrl}/demo/${linkId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    toast.success('Link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendDemoLinkWA = async (reqId: string, linkId: string) => {
    const phone = (waPhones[reqId] || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    setSendingWA(reqId);
    try {
      const res = await fetch('/api/v1/demo/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, demo_link_id: linkId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Demo link sent via WhatsApp!');
        setWaSent(prev => new Set(prev).add(reqId));
      } else {
        toast.error(data.error || 'Failed to send');
      }
    } catch { toast.error('Network error'); }
    setSendingWA(null);
  };

  // Teacher assignment for submitted/rejected demos
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assigningTeacher, setAssigningTeacher] = useState(false);

  const assignTeacher = async (requestId: string, teacherEmail: string) => {
    setAssigningTeacher(true);
    try {
      const res = await fetch('/api/v1/demo/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action: 'assign_teacher', teacher_email: teacherEmail }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Teacher assigned!');
        setAssigningId(null);
        fetchRequests();
        fetchTeachers();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    setAssigningTeacher(false);
  };

  // ── Selection helpers ──
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: DemoRequest[]) => {
    const allIds = items.map(r => r.id);
    const allSelected = allIds.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  // ── Filtering ──
  const activeStatuses = ['link_created', 'submitted', 'pending_teacher', 'accepted', 'live'];
  const filtered = useMemo(() => {
    return filter === 'all' ? requests
      : filter === 'active' ? requests.filter(r => activeStatuses.includes(r.status))
      : requests.filter(r => r.status === filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, filter]);

  // Student leads: any request where student filled the form
  const leads = useMemo(() =>
    requests.filter(r => r.student_name && r.student_email),
    [requests]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const allLeadsSelected = leads.length > 0 && leads.every(r => selected.has(r.id));

  // ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Demo Sessions</h2>
          <p className="text-sm text-gray-500 mt-1">Generate demo links for prospective students. Free 30-minute sessions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={RefreshCw} onClick={() => { fetchRequests(); fetchTeachers(); }}>
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={generateLink} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Demo Link'}
          </Button>
        </div>
      </div>

      {/* Main Tab Switch: Sessions / Student Leads */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => { setMainTab('sessions'); setSelected(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mainTab === 'sessions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Sessions
          <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 ml-0.5">
            {requests.length}
          </span>
        </button>
        <button
          onClick={() => { setMainTab('leads'); setSelected(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mainTab === 'leads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Student Leads
          <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5 ml-0.5">
            {leads.length}
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  SESSIONS TAB                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {mainTab === 'sessions' && (
        <>
          {/* Available Teachers Card */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-gray-900">All Teachers</h3>
                <Badge variant="success" label={`${teachers.filter(t => t.isFree).length} free now`} />
                <span className="text-xs text-gray-400">{teachers.length} total</span>
              </div>
              <button
                onClick={fetchTeachers}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                disabled={loadingTeachers}
              >
                <RefreshCw className={`h-3 w-3 ${loadingTeachers ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {loadingTeachers ? (
              <div className="text-sm text-gray-500">Checking availability…</div>
            ) : teachers.length === 0 ? (
              <div className="text-sm text-gray-400">No active teachers found.</div>
            ) : (
              <div className="space-y-2">
                {teachers.map(t => (
                  <div key={t.email} className={`rounded-lg border p-3 ${t.isFree ? 'border-primary/20 bg-primary/5/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        t.isFree ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{t.name}</span>
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            t.isFree
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {t.isFree ? '● Free' : '● Busy'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">{t.subjects?.join(', ') || 'No subjects listed'}</div>
                      </div>
                      {/* Current status */}
                      <div className="text-right shrink-0">
                        {t.currentSession ? (
                          <div>
                            <div className="text-[10px] text-amber-600 font-medium truncate max-w-[180px]">{t.currentSession.label}</div>
                            <div className="text-[10px] text-gray-400">
                              Free at {new Date(t.currentSession.end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                            </div>
                          </div>
                        ) : t.schedule.length > 0 ? (
                          <div className="text-[10px] text-gray-400">
                            Next: {new Date(t.schedule[0].start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-primary">No upcoming sessions</div>
                        )}
                      </div>
                    </div>
                    {/* Schedule timeline */}
                    {t.schedule.length > 0 && (
                      <div className="mt-2 ml-12 flex flex-wrap gap-1.5">
                        {t.schedule.map((s, i) => {
                          const sStart = new Date(s.start);
                          const sEnd = new Date(s.end);
                          const isLive = s.status === 'live';
                          const isNow = sStart.getTime() <= Date.now() && sEnd.getTime() > Date.now();
                          return (
                            <span
                              key={i}
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                                isLive || isNow
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : s.type === 'batch'
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'bg-purple-50 text-purple-600 border-purple-200'
                              }`}
                              title={s.label}
                            >
                              {isLive && <span className="mr-1">●</span>}
                              {sStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                              {' – '}
                              {sEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                              <span className="ml-1 opacity-70 truncate max-w-[120px]">{s.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              {([
                ['active', 'Active'],
                ['all', 'All'],
                ['link_created', 'Links'],
                ['pending_teacher', 'Pending Teacher'],
                ['accepted', 'Accepted'],
                ['completed', 'Completed'],
              ] as [typeof filter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setFilter(key); setSelected(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label}
                  {key === 'active' && (
                    <span className="ml-1.5 text-xs opacity-80">
                      ({requests.filter(r => activeStatuses.includes(r.status)).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSelectAll(filtered)}
                  className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 font-medium"
                >
                  {allFilteredSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {selected.size} selected
                </span>
              </div>
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting…' : `Delete (${selected.size})`}
              </button>
            </div>
          )}

          {/* Demo Requests List */}
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Link2}
              message={filter === 'active' ? 'Generate a demo link to get started.' : 'No matching demo requests.'}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map(req => (
                <div
                  key={req.id}
                  className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-all ${
                    selected.has(req.id) ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'
                  }`}
                >
                  {/* ── Top bar: checkbox + link + status ── */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => toggleSelect(req.id)}
                        className="shrink-0 text-gray-400 hover:text-primary transition-colors"
                      >
                        {selected.has(req.id)
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4" />
                        }
                      </button>
                      <Link2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-500 truncate">
                        /demo/{req.demo_link_id}
                      </code>
                      <button
                        onClick={() => copyLink(req.demo_link_id)}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                        title="Copy link"
                      >
                        {copiedId === req.demo_link_id ? (
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={`/demo/${req.demo_link_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                        title="Open link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => { const s = demoCombinedStatus(req.status, req.outcome); return (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.style}`}>{s.label}</span>
                      ); })()}
                      <span className="text-xs text-gray-400">{timeAgo(req.created_at)}</span>
                    </div>
                  </div>

                  {/* ── Student Details Card ── */}
                  {req.student_name ? (
                    <div className="mx-4 mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {req.student_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{req.student_name}</p>
                          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                            {req.student_email && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                                <span className="truncate">{req.student_email}</span>
                              </div>
                            )}
                            {req.student_phone && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                                <span>{req.student_phone}</span>
                              </div>
                            )}
                            {req.student_grade && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <GraduationCap className="h-3 w-3 text-gray-400 shrink-0" />
                                <span>Grade {req.student_grade}</span>
                              </div>
                            )}
                            {req.subject && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <BookOpen className="h-3 w-3 text-gray-400 shrink-0" />
                                <span>{req.subject}</span>
                              </div>
                            )}
                          </div>
                          {(req.portions || (req.sample_portions && req.sample_portions.length > 0)) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {req.sample_portions?.map(p => (
                                <span key={p} className="inline-flex items-center rounded-full bg-primary/5 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {p}
                                </span>
                              ))}
                              {req.portions && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                                  {req.portions}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-4 mb-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-2.5">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <User className="h-4 w-4" />
                        <span>Waiting for student to register…</span>
                      </div>
                      {/* WhatsApp send inline */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-xs">
                          <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="tel"
                            placeholder="Student phone number"
                            value={waPhones[req.id] || ''}
                            onChange={e => setWaPhones(prev => ({ ...prev, [req.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && sendDemoLinkWA(req.id, req.demo_link_id)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:border-green-400 focus:ring-1 focus:ring-green-200 outline-none transition-colors placeholder:text-gray-400"
                          />
                        </div>
                        <button
                          onClick={() => sendDemoLinkWA(req.id, req.demo_link_id)}
                          disabled={sendingWA === req.id || !waPhones[req.id]?.trim()}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            waSent.has(req.id)
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-primary text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                        >
                          {sendingWA === req.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</>
                          ) : waSent.has(req.id) ? (
                            <><CheckCircle className="h-3 w-3" /> Sent</>
                          ) : (
                            <><Send className="h-3 w-3" /> Send via WhatsApp</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Exam Results Card ── */}
                  {req.exam_score !== null && req.exam_total_marks !== null && (
                    <div className="mx-4 mb-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Award className="h-4 w-4 text-teal-600" />
                        <span className="text-xs font-semibold text-teal-800">Demo Exam Result</span>
                        {req.exam_grade && (
                          <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            req.exam_grade === 'A+' || req.exam_grade === 'A'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : req.exam_grade === 'B+' || req.exam_grade === 'B'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            Grade: {['D', 'F'].includes(req.exam_grade) ? 'C' : req.exam_grade}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-teal-700">{req.exam_score}/{req.exam_total_marks}</p>
                          <p className="text-[10px] text-teal-600/70 uppercase font-medium">Score</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-teal-700">{req.exam_percentage ?? 0}%</p>
                          <p className="text-[10px] text-teal-600/70 uppercase font-medium">Percentage</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-teal-700">{req.exam_answered ?? 0}/{(req.exam_answered ?? 0) + (req.exam_skipped ?? 0)}</p>
                          <p className="text-[10px] text-teal-600/70 uppercase font-medium">Answered</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-teal-700">{req.exam_time_taken ? `${Math.floor(req.exam_time_taken / 60)}m ${req.exam_time_taken % 60}s` : '—'}</p>
                          <p className="text-[10px] text-teal-600/70 uppercase font-medium">Time Taken</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Student Feedback Card ── */}
                  {req.feedback_rating && (
                    <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">⭐</span>
                        <span className="text-xs font-semibold text-amber-800">Student Feedback</span>
                        <span className="ml-auto text-xs font-bold text-amber-700">{req.feedback_rating}/5</span>
                      </div>
                      <div className="flex gap-0.5 mb-1.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} className={`text-sm ${s <= (req.feedback_rating ?? 0) ? '' : 'grayscale opacity-30'}`}>⭐</span>
                        ))}
                      </div>
                      {req.feedback_text && (
                        <p className="text-xs text-amber-700 italic">&ldquo;{req.feedback_text}&rdquo;</p>
                      )}
                      {req.feedback_tags && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {req.feedback_tags.split(',').filter(Boolean).map(tag => (
                            <span key={tag} className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                              {tag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Status context + Teacher + Actions ── */}
                  <div className="flex items-end justify-between gap-4 px-4 pb-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        <MessageSquare className="inline h-3 w-3 mr-1 -mt-0.5 text-gray-400" />
                        {statusDescription(req)}
                      </p>
                      {req.teacher_name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <div className="h-5 w-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {req.teacher_name.charAt(0).toUpperCase()}
                          </div>
                          <span>Teacher: <span className="font-medium text-gray-700">{req.teacher_name}</span></span>
                          {req.teacher_responded_at && (
                            <span className="text-gray-400">· responded {timeAgo(req.teacher_responded_at)}</span>
                          )}
                        </div>
                      )}
                      {req.scheduled_start && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {new Date(req.scheduled_start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                          <span className="text-gray-400">({req.duration_minutes}min)</span>
                        </div>
                      )}
                    </div>

                    {/* ── Status-based action buttons ── */}
                    <div className="flex gap-1.5 shrink-0">
                      <DemoActions
                        req={req}
                        onCancel={() => cancelRequest(req.id)}
                        onDelete={() => { setSelected(new Set([req.id])); }}
                        onCopyLink={() => copyLink(req.demo_link_id)}
                        onAssignTeacher={(email) => assignTeacher(req.id, email)}
                        assignOpen={assigningId === req.id}
                        onToggleAssign={() => setAssigningId(prev => prev === req.id ? null : req.id)}
                        teachers={teachers}
                        assigning={assigningTeacher}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  STUDENT LEADS TAB                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {mainTab === 'leads' && (
        <>
          {loading ? (
            <LoadingState />
          ) : leads.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              message="No student leads yet. Students who register via demo links will appear here."
            />
          ) : (
            <>
            {/* Bulk action bar for leads */}
            {selected.size > 0 && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleSelectAll(leads)}
                    className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 font-medium"
                  >
                    {allLeadsSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    {allLeadsSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {selected.size} selected
                  </span>
                </div>
                <button
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? 'Deleting…' : `Delete (${selected.size})`}
                </button>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[30px_1fr_1fr_80px_100px_70px_120px_80px_110px] gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <button onClick={() => toggleSelectAll(leads)} className="flex items-center justify-center">
                  {allLeadsSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-gray-400" />}
                </button>
                <span>Student</span>
                <span>Contact</span>
                <span>Grade</span>
                <span>Subject</span>
                <span>Category</span>
                <span>Demo Status</span>
                <span>When</span>
                <span className="text-right">Action</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-gray-100">
                {leads.map(req => {
                  const isExisting = !!req.student_email && existingStudents.has(req.student_email);
                  const cat = req.exam_grade ? examGradeToCategory(req.exam_grade) : null;
                  const catStyle = cat ? CATEGORY_STYLES[cat] : null;
                  return (
                  <div key={req.id} className={`sm:grid sm:grid-cols-[30px_1fr_1fr_80px_100px_70px_120px_80px_110px] gap-4 px-4 py-3 items-center hover:bg-gray-50 transition-colors ${selected.has(req.id) ? 'bg-red-50/50' : ''}`}>
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(req.id)} className="hidden sm:flex items-center justify-center">
                      {selected.has(req.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-gray-300 hover:text-gray-500" />}
                    </button>
                    {/* Student */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {req.student_name!.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{req.student_name}</p>
                        {req.student_phone && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" /> {req.student_phone}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Contact */}
                    <div className="min-w-0 mt-1 sm:mt-0">
                      <p className="text-xs text-gray-600 truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 text-gray-400 shrink-0" /> {req.student_email}
                      </p>
                    </div>
                    {/* Grade */}
                    <div className="hidden sm:block">
                      <span className="text-xs text-gray-700 font-medium">{req.student_grade || '—'}</span>
                    </div>
                    {/* Subject */}
                    <div className="hidden sm:block">
                      <span className="text-xs text-gray-700">{req.subject || '—'}</span>
                    </div>
                    {/* Category */}
                    <div className="hidden sm:block">
                      {catStyle ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                          {cat}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                    {/* Status */}
                    <div className="flex flex-col gap-0.5 mt-1 sm:mt-0">
                      {(() => { const s = demoCombinedStatus(req.status, req.outcome); return (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold w-fit ${s.style}`}>{s.label}</span>
                      ); })()}
                    </div>
                    {/* Date */}
                    <div className="hidden sm:block">
                      <span className="text-xs text-gray-500">{timeAgo(req.created_at)}</span>
                    </div>
                    {/* Action */}
                    <div className="flex justify-end mt-2 sm:mt-0">
                      {isExisting ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1">
                          <CheckCircle className="h-3 w-3" /> Student Added
                        </span>
                      ) : (
                        <button
                          onClick={() => setConvertingLead(req)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 transition-colors shadow-sm"
                        >
                          <UserPlus className="h-3 w-3" /> Add as Student
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              {/* Footer summary */}
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {leads.length} lead{leads.length !== 1 ? 's' : ''} · {leads.filter(l => l.status === 'completed').length} completed demos · {leads.filter(l => l.exam_score !== null).length} exams taken
                </span>
                <span className="text-xs text-gray-500">
                  {existingStudents.size > 0 && `${existingStudents.size} converted to students`}
                </span>
              </div>
            </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════ Convert to Student Modal ═══════════════ */}
      {convertingLead && (
        <CreateUserModal
          role="student"
          open={!!convertingLead}
          fixedRole
          onClose={() => setConvertingLead(null)}
          title="Convert Demo Lead to Student"
          subtitle={`Pre-filled from demo registration by ${convertingLead.student_name}`}
          initialData={{
            email: convertingLead.student_email || undefined,
            full_name: convertingLead.student_name || undefined,
            phone: convertingLead.student_phone || undefined,
            grade: convertingLead.student_grade || undefined,
            board: convertingLead.student_board || undefined,
            subject: convertingLead.subject || undefined,
            category: convertingLead.exam_grade ? examGradeToCategory(convertingLead.exam_grade) : undefined,
            notes: `Converted from demo session (${convertingLead.demo_link_id}). ${
              convertingLead.exam_percentage !== null ? `Demo exam: ${convertingLead.exam_percentage}% (Grade ${convertingLead.exam_grade})` : ''
            }`.trim(),
          }}
          onCreated={(data) => {
            if (data?.email) {
              setExistingStudents(prev => new Set([...prev, data.email]));
            }
            setConvertingLead(null);
            toast.success(`Student account created for ${data?.full_name || 'student'}!`);
          }}
        />
      )}
    </div>
  );
}

// ─── Status-based Action Buttons ────────────────────────────

function DemoActions({
  req,
  onCancel,
  onDelete,
  onCopyLink,
  onAssignTeacher,
  assignOpen,
  onToggleAssign,
  teachers,
  assigning,
}: {
  req: DemoRequest;
  onCancel: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onAssignTeacher: (teacherEmail: string) => void;
  assignOpen: boolean;
  onToggleAssign: () => void;
  teachers: AvailableTeacher[];
  assigning: boolean;
}) {
  switch (req.status) {
    case 'link_created':
      return (
        <>
          <button
            onClick={onCopyLink}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1 font-medium border border-gray-200"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
          >
            Cancel
          </button>
        </>
      );

    case 'submitted':
    case 'rejected':
    case 'pending_teacher': {
      const statusLabel = req.status === 'submitted' ? 'No Teacher' : req.status === 'rejected' ? 'Rejected' : 'Deciding…';
      const statusColor = req.status === 'submitted' ? 'bg-blue-50 text-blue-600' : req.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600';
      return (
        <div className="relative flex items-center gap-1.5">
          <span className={`text-xs px-2 py-1 rounded-lg ${statusColor} flex items-center gap-1 font-medium`}>
            <Clock className="h-3 w-3" /> {statusLabel}
          </span>
          <button
            onClick={onToggleAssign}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center gap-1 font-medium"
            title={req.status === 'pending_teacher' ? 'Reassign to different teacher' : 'Assign a teacher'}
          >
            <UserPlus className="h-3 w-3" /> {req.status === 'pending_teacher' ? 'Reassign' : 'Assign'}
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-2 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
            title="Cancel demo"
          >
            <XCircle className="h-3 w-3" />
          </button>
          {assignOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 w-72 rounded-xl bg-white border border-gray-200 shadow-xl p-2 space-y-1 max-h-80 overflow-y-auto">
              <p className="text-[10px] font-semibold text-gray-400 uppercase px-2 pt-1">
                All Teachers {req.subject && <span className="normal-case text-gray-300">· {req.subject}</span>}
              </p>
              {teachers.length === 0 ? (
                <p className="text-xs text-gray-400 px-2 py-2">No teachers found</p>
              ) : (
                teachers.map(t => {
                  const subjectMatch = req.subject && t.subjects?.some(
                    s => s.toLowerCase() === req.subject!.toLowerCase()
                  );
                  return (
                    <button
                      key={t.email}
                      disabled={assigning}
                      onClick={() => onAssignTeacher(t.email)}
                      className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 disabled:opacity-50 ${
                        !t.isFree ? 'opacity-60 hover:bg-gray-50' : subjectMatch ? 'hover:bg-primary/5 bg-primary/5/30' : 'hover:bg-indigo-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-700">{t.name}</span>
                          {subjectMatch && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary border border-primary/20 px-1 py-0 text-[9px] font-semibold">
                              <Check className="h-3 w-3 inline" /> {req.subject}
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-gray-400">{(t.subjects || []).join(', ') || 'No subjects'}</span>
                        {!t.isFree && t.freeAfter && (
                          <span className="block text-[10px] text-amber-500">
                            Free at {new Date(t.freeAfter).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.isFree ? 'bg-primary' : 'bg-amber-400'}`} />
                        {assigning ? <Loader2 className="h-3 w-3 animate-spin text-indigo-400" /> : <UserCheck className="h-3 w-3 text-indigo-400" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      );
    }

    case 'accepted':
      return req.room_id ? (
        <a
          href={`/classroom/${req.room_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 font-medium"
        >
          <Eye className="h-3 w-3" /> Join as Ghost
        </a>
      ) : (
        <span className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/5 text-primary flex items-center gap-1 font-medium">
          <CheckCircle className="h-3 w-3" /> Ready
        </span>
      );

    case 'live':
      return req.room_id ? (
        <a
          href={`/classroom/${req.room_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 font-medium"
        >
          <PlayCircle className="h-3 w-3" /> Live — Watch
        </a>
      ) : null;

    case 'completed':
      return (
        <button
          onClick={onDelete}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1 font-medium border border-gray-200"
          title="Select for deletion"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      );

    case 'expired':
    case 'cancelled':
      return (
        <button
          onClick={onDelete}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1 font-medium border border-gray-200"
          title="Select for deletion"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      );

    default:
      return null;
  }
}
