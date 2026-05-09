'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Badge, StatusBadge,
  LoadingState, EmptyState,
  useToast,
} from '@/components/dashboard/shared';
import {
  CheckCircle, XCircle, Clock, BookOpen, RefreshCw, PlayCircle, Eye, Check,
  CalendarClock, X, Star, AlertTriangle, ChevronDown, ChevronUp,
  UserCheck, Timer, Brain, FileText, MessageSquare,
} from 'lucide-react';
import { useSession } from '@/hooks/useSession';

// ─── Types ──────────────────────────────────────────────────

interface DemoRequest {
  id: string;
  demo_link_id: string;
  student_email: string | null;
  student_name: string | null;
  student_phone: string | null;
  student_grade: string | null;
  subject: string | null;
  portions: string | null;
  teacher_email: string | null;
  teacher_name: string | null;
  status: string;
  room_id: string | null;
  scheduled_start: string | null;
  duration_minutes: number;
  teacher_note: string | null;
  created_at: string;
  updated_at: string;
}

interface DemoSummary {
  roomId: string;
  roomName: string;
  subject: string;
  grade: string;
  scheduledStart: string;
  durationMinutes: number;
  endedAt: string;
  outcome: string;
  portions: string;
  teacherEmail: string;
  teacherName: string;
  studentEmail: string;
  studentName: string;
  studentPhone: string;
  aoEmail: string;
  studentJoinedAt: string | null;
  studentLeftAt: string | null;
  studentDurationSec: number;
  studentLate: boolean;
  studentLateBySec: number;
  studentJoinCount: number;
  attentionScore: number;
  attentiveMinutes: number;
  lookingAwayMinutes: number;
  eyesClosedMinutes: number;
  notInFrameMinutes: number;
  distractedMinutes: number;
  phoneDetectedMinutes: number;
  headTurnedMinutes: number;
  yawningMinutes: number;
  inactiveMinutes: number;
  tabSwitchedMinutes: number;
  totalMonitoringEvents: number;
  alerts: { type: string; severity: string; message: string }[];
  exam: {
    totalQuestions: number;
    answered: number;
    skipped: number;
    score: number;
    totalMarks: number;
    percentage: number;
    gradeLetter: string;
    timeTakenSeconds: number;
    questions: {
      questionText: string;
      correctAnswer: string;
      selectedOption: string;
      isCorrect: boolean;
      marks: number;
      topic?: string;
    }[];
  } | null;
  feedback: { rating: number; text: string; tags: string } | null;
}

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_teacher': return 'Action Required';
    case 'accepted': return 'Accepted';
    case 'live': return 'Live Now';
    case 'completed': return 'Completed';
    case 'rejected': return 'Rejected';
    default: return status;
  }
}

/** Format remaining time until scheduled start */
function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Generate default scheduled_start: nearest 15-min slot at least 30min from now */
function defaultScheduledStart(): string {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  // Format for datetime-local input (IST)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

// ─── Component ──────────────────────────────────────────────

export default function TeacherDemoTab() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending_teacher' | 'accepted' | 'completed'>('all');

  // ── Schedule modal state ──
  const [scheduleModal, setScheduleModal] = useState<{ requestId: string; studentName: string; subject: string } | null>(null);
  const [scheduledTime, setScheduledTime] = useState('');

  // ── Live countdown ticker ──
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Summary expansion state ──
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<Record<string, DemoSummary>>({});
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null);

  const toggleSummary = useCallback(async (roomId: string) => {
    if (expandedSummary === roomId) {
      setExpandedSummary(null);
      return;
    }
    setExpandedSummary(roomId);
    if (summaryData[roomId]) return; // already fetched
    setSummaryLoading(roomId);
    try {
      const res = await fetch(`/api/v1/demo/summary/${roomId}`);
      const data = await res.json();
      if (data.success) {
        setSummaryData(prev => ({ ...prev, [roomId]: data.data }));
      }
    } catch { /* ignore */ }
    setSummaryLoading(null);
  }, [expandedSummary, summaryData]);

  /** Fetch a LiveKit token via /api/v1/room/join, set sessionStorage, navigate */
  const joinDemoRoom = useCallback(async (roomId: string) => {
    setJoiningRoom(roomId);
    try {
      const res = await fetch('/api/v1/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || data.error || 'Failed to join room');
        setJoiningRoom(null);
        return;
      }
      const d = data.data as {
        livekit_token: string; livekit_url: string; room_id: string;
        role: string; participant_name: string;
        scheduled_start?: string; duration_minutes?: number; room_name?: string;
        room_status?: string;
      };
      sessionStorage.setItem('lk_token', d.livekit_token);
      sessionStorage.setItem('lk_url', d.livekit_url);
      sessionStorage.setItem('room_name', d.room_name || d.room_id);
      sessionStorage.setItem('participant_name', d.participant_name);
      sessionStorage.setItem('participant_role', d.role);
      sessionStorage.setItem('scheduled_start', d.scheduled_start || new Date().toISOString());
      sessionStorage.setItem('duration_minutes', String(d.duration_minutes || 30));
      sessionStorage.setItem('room_status', d.room_status || 'live');
      router.push(`/classroom/${d.room_id}`);
    } catch {
      toast.error('Network error joining room');
      setJoiningRoom(null);
    }
  }, [toast, router]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/demo/requests');
      const data = await res.json();
      if (data.success) setRequests(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    // Poll every 30 seconds for new requests
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleAction = async (requestId: string, action: 'accept' | 'reject', scheduledStart?: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch('/api/v1/demo/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          action,
          ...(scheduledStart ? { scheduled_start: scheduledStart } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'accept') {
          const d = data.data as { scheduled_start: string };
          const time = new Date(d.scheduled_start).toLocaleString('en-IN', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
          });
          toast.success(`Demo accepted! Scheduled for ${time}. Student & AO notified.`);
          setScheduleModal(null);
        } else {
          toast.info('Demo request rejected.');
        }
        fetchRequests();
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Network error');
    }
    setActionLoading(null);
  };

  /** Open schedule modal for accept */
  const openScheduleModal = (req: DemoRequest) => {
    setScheduledTime(defaultScheduledStart());
    setScheduleModal({
      requestId: req.id,
      studentName: req.student_name || 'Student',
      subject: req.subject || 'Demo Session',
    });
  };

  /** Confirm accept with scheduled time */
  const confirmAccept = () => {
    if (!scheduleModal) return;
    // Convert IST datetime-local to UTC ISO string
    const [datePart, timePart] = scheduledTime.split('T');
    const istDate = new Date(`${datePart}T${timePart}:00+05:30`);
    if (isNaN(istDate.getTime()) || istDate.getTime() < Date.now() + 5 * 60 * 1000) {
      toast.error('Please select a time at least 5 minutes from now.');
      return;
    }
    handleAction(scheduleModal.requestId, 'accept', istDate.toISOString());
  };

  const pendingCount = requests.filter(r => r.status === 'pending_teacher').length;
  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Demo Requests
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-amber-500 text-white text-xs font-bold px-1.5">
                {pendingCount}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Accept or reject incoming demo session requests from prospective students.
          </p>
        </div>
        <Button variant="ghost" icon={RefreshCw} onClick={fetchRequests}>
          Refresh
        </Button>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} demo request{pendingCount > 1 ? 's' : ''} waiting for your response
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              A prospective student is waiting. Please respond promptly.
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['all', 'All'],
          ['pending_teacher', 'Pending'],
          ['accepted', 'Accepted'],
          ['completed', 'Completed'],
        ] as [typeof filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
            {key === 'pending_teacher' && pendingCount > 0 && (
              <span className="ml-1 text-xs opacity-80">({pendingCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          message={filter === 'pending_teacher' ? 'No pending requests right now.' : 'No demo requests found.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div
              key={req.id}
              className={`rounded-xl border bg-white p-5 transition-shadow ${
                req.status === 'pending_teacher'
                  ? 'border-amber-200 shadow-sm shadow-amber-100'
                  : 'border-gray-200 hover:shadow-sm'
              }`}
            >
              {/* Status badge row */}
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={statusLabel(req.status)} />
                <span className="text-xs text-gray-400">{timeAgo(req.created_at)}</span>
              </div>

              {/* Student info */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    {(req.student_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{req.student_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      {req.student_email && <span>{req.student_email}</span>}
                      {req.student_phone && <span>· 📞 {req.student_phone}</span>}
                    </div>
                  </div>
                </div>

                {/* Subject + Grade */}
                <div className="flex items-center gap-2 flex-wrap">
                  {req.subject && <Badge variant="info" label={req.subject} />}
                  {req.student_grade && <Badge variant="default" label={`Grade ${req.student_grade}`} />}
                  <Badge variant="default" icon={Clock} label={`${req.duration_minutes}min demo`} />
                </div>

                {/* Portions */}
                {req.portions && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-900">Topics:</span> {req.portions}
                  </div>
                )}

                {/* Scheduled time for accepted */}
                {req.scheduled_start && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    Scheduled: {new Date(req.scheduled_start).toLocaleString('en-IN', {
                      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {req.status === 'pending_teacher' && (
                  <>
                    <Button
                      variant="primary"
                      icon={CalendarClock}
                      size="sm"
                      onClick={() => openScheduleModal(req)}
                      disabled={actionLoading === req.id}
                    >
                      {actionLoading === req.id ? 'Processing…' : 'Accept & Schedule'}
                    </Button>
                    <Button
                      variant="ghost"
                      icon={XCircle}
                      size="sm"
                      onClick={() => handleAction(req.id, 'reject')}
                      disabled={actionLoading === req.id}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {req.status === 'accepted' && req.room_id && (() => {
                  const schedMs = req.scheduled_start ? new Date(req.scheduled_start).getTime() - now : 0;
                  const canStart = schedMs <= 5 * 60 * 1000; // 5 min before
                  return canStart ? (
                    <button
                      onClick={() => joinDemoRoom(req.room_id!)}
                      disabled={joiningRoom === req.room_id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-bold hover:bg-emerald-700 transition-colors animate-pulse disabled:opacity-50"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {joiningRoom === req.room_id ? 'Joining…' : 'Start Demo'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 text-sm font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Starts in {fmtCountdown(schedMs)}
                      </span>
                    </div>
                  );
                })()}
                {req.status === 'live' && req.room_id && (
                  <button
                    onClick={() => joinDemoRoom(req.room_id!)}
                    disabled={joiningRoom === req.room_id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 transition-colors animate-pulse disabled:opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {joiningRoom === req.room_id ? 'Joining…' : 'Join Live Demo'}
                  </button>
                )}
                {req.status === 'completed' && req.room_id && (
                  <button
                    onClick={() => toggleSummary(req.room_id!)}
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                  >
                    {expandedSummary === req.room_id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {expandedSummary === req.room_id ? 'Hide Summary' : 'View Summary'}
                  </button>
                )}
              </div>

              {/* ── Expanded Summary ─────────────────────── */}
              {req.status === 'completed' && req.room_id && expandedSummary === req.room_id && (
                <DemoSummaryPanel
                  summary={summaryData[req.room_id] ?? null}
                  loading={summaryLoading === req.room_id}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Schedule Time Modal ─────────────────────────────── */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-bold text-gray-900">Schedule Demo Session</h3>
              <button onClick={() => setScheduleModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-sm font-medium text-emerald-800">{scheduleModal.subject}</p>
                <p className="text-xs text-emerald-600 mt-0.5">with {scheduleModal.studentName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Choose your available time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={new Date(Date.now() + 5 * 60 * 1000 + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Student and AO will be notified with this time. You can start 5 minutes before.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setScheduleModal(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAccept}
                  disabled={actionLoading === scheduleModal.requestId}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === scheduleModal.requestId ? 'Scheduling…' : 'Confirm & Notify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers for Summary ────────────────────────────────────

function fmtDuration(sec: number): string {
  if (sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function fmtIST(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
}

function outcomeLabel(o: string): string {
  switch (o) {
    case 'completed': return 'Completed';
    case 'completed_with_exam': return 'Completed with Exam';
    case 'student_no_show': return 'Student No-Show';
    case 'cancelled_by_teacher': return 'Ended by Teacher';
    case 'time_expired': return 'Time Expired';
    default: return o;
  }
}

function outcomeColor(o: string): string {
  switch (o) {
    case 'completed': case 'completed_with_exam': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'student_no_show': return 'text-red-700 bg-red-50 border-red-200';
    case 'cancelled_by_teacher': case 'time_expired': return 'text-amber-700 bg-amber-50 border-amber-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

// ─── Summary Panel Component ────────────────────────────────

function DemoSummaryPanel({ summary, loading }: { summary: DemoSummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center py-8 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          Loading summary…
        </div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="mt-4 py-6 text-center text-sm text-gray-400 border-t border-gray-100">
        Summary data not available.
      </div>
    );
  }

  const s = summary;
  const totalEngaged = s.attentiveMinutes + s.lookingAwayMinutes + s.eyesClosedMinutes + s.notInFrameMinutes + s.distractedMinutes;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
      {/* ── Session Overview ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard label="Outcome" value={outcomeLabel(s.outcome)} className={outcomeColor(s.outcome)} />
        <SummaryCard label="Duration" value={`${s.durationMinutes} min`} />
        <SummaryCard label="Scheduled" value={fmtIST(s.scheduledStart)} small />
        <SummaryCard label="Ended" value={fmtIST(s.endedAt)} small />
      </div>

      {/* ── Student Details ── */}
      <SectionHeader icon={<UserCheck className="h-4 w-4" />} title="Student Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <InfoRow label="Name" value={s.studentName || '—'} />
        <InfoRow label="Email" value={s.studentEmail || '—'} />
        <InfoRow label="Phone" value={s.studentPhone || '—'} />
        <InfoRow label="Grade" value={s.grade || '—'} />
        {s.portions && <InfoRow label="Topics" value={s.portions} full />}
      </div>

      {/* ── Attendance ── */}
      <SectionHeader icon={<Timer className="h-4 w-4" />} title="Attendance & Timing" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard label="Joined At" value={fmtIST(s.studentJoinedAt)} small />
        <SummaryCard label="Left At" value={fmtIST(s.studentLeftAt)} small />
        <SummaryCard label="Time in Class" value={fmtDuration(s.studentDurationSec)} />
        <SummaryCard label="Join Count" value={String(s.studentJoinCount || 0)} />
      </div>
      {s.studentLate && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Student joined late by {fmtDuration(s.studentLateBySec)}
        </div>
      )}

      {/* ── AI Monitoring ── */}
      {s.totalMonitoringEvents > 0 && (
        <>
          <SectionHeader icon={<Brain className="h-4 w-4" />} title="AI Session Monitoring" />
          <div className="space-y-2">
            {/* Attention score bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">Attention Score</span>
              <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    s.attentionScore >= 70 ? 'bg-emerald-500' : s.attentionScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${s.attentionScore}%` }}
                />
              </div>
              <span className={`text-sm font-bold tabular-nums ${
                s.attentionScore >= 70 ? 'text-emerald-600' : s.attentionScore >= 40 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {s.attentionScore}%
              </span>
            </div>
            {/* Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <MiniStat label="Attentive" value={`${s.attentiveMinutes}m`} color="emerald" />
              <MiniStat label="Looking Away" value={`${s.lookingAwayMinutes}m`} color="amber" />
              <MiniStat label="Eyes Closed" value={`${s.eyesClosedMinutes}m`} color="red" />
              <MiniStat label="Not in Frame" value={`${s.notInFrameMinutes}m`} color="gray" />
              <MiniStat label="Distracted" value={`${s.distractedMinutes}m`} color="orange" />
              {s.headTurnedMinutes > 0 && <MiniStat label="Head Turned" value={`${s.headTurnedMinutes}m`} color="amber" />}
              {s.yawningMinutes > 0 && <MiniStat label="Yawning" value={`${s.yawningMinutes}m`} color="purple" />}
              {s.inactiveMinutes > 0 && <MiniStat label="Inactive" value={`${s.inactiveMinutes}m`} color="gray" />}
              {s.tabSwitchedMinutes > 0 && <MiniStat label="Tab Switched" value={`${s.tabSwitchedMinutes}m`} color="purple" />}
              {s.phoneDetectedMinutes > 0 && <MiniStat label="Phone Detected" value={`${s.phoneDetectedMinutes}m`} color="red" />}
            </div>
            <p className="text-xs text-gray-400">{s.totalMonitoringEvents} monitoring events · {totalEngaged.toFixed(1)} min monitored</p>
          </div>

          {/* Alerts */}
          {s.alerts.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Session Alerts ({s.alerts.length})</p>
              {s.alerts.slice(0, 5).map((a, i) => (
                <div key={i} className={`text-xs rounded px-2 py-1 ${
                  a.severity === 'high' ? 'bg-red-50 text-red-700' :
                  a.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  <span className="font-medium">{a.type}</span>: {a.message}
                </div>
              ))}
              {s.alerts.length > 5 && <p className="text-xs text-gray-400">+ {s.alerts.length - 5} more</p>}
            </div>
          )}
        </>
      )}

      {/* ── Exam Results ── */}
      {s.exam && (
        <>
          <SectionHeader icon={<FileText className="h-4 w-4" />} title="Demo Exam Results" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard
              label="Score"
              value={`${s.exam.score}/${s.exam.totalMarks}`}
              className={s.exam.percentage >= 60 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}
            />
            <SummaryCard label="Grade" value={s.exam.gradeLetter} className="text-blue-700 bg-blue-50 border-blue-200" />
            <SummaryCard label="Percentage" value={`${s.exam.percentage.toFixed(1)}%`} />
            <SummaryCard label="Time Taken" value={fmtDuration(s.exam.timeTakenSeconds)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Total Questions" value={String(s.exam.totalQuestions)} color="gray" />
            <MiniStat label="Answered" value={String(s.exam.answered)} color="emerald" />
            <MiniStat label="Skipped" value={String(s.exam.skipped)} color="amber" />
          </div>

          {/* Per-question breakdown */}
          {s.exam.questions.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                Question-by-Question Breakdown
              </summary>
              <div className="mt-2 space-y-1.5">
                {s.exam.questions.map((q, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${
                    q.isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-700">Q{i + 1}. {q.questionText}</span>
                      <span className={`shrink-0 font-bold ${q.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                        {q.isCorrect ? <Check className="h-3.5 w-3.5 inline" /> : <X className="h-3.5 w-3.5 inline" />} {q.marks}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-gray-500">
                      <span>Selected: <span className={q.isCorrect ? 'text-emerald-600' : 'text-red-600'}>{q.selectedOption || '—'}</span></span>
                      {!q.isCorrect && <span>Correct: <span className="text-emerald-600">{q.correctAnswer}</span></span>}
                      {q.topic && <span className="text-gray-400">Topic: {q.topic}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {/* ── Student Feedback ── */}
      {s.feedback && (
        <>
          <SectionHeader icon={<MessageSquare className="h-4 w-4" />} title="Student Feedback" />
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className={`h-4 w-4 ${n <= s.feedback!.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
              ))}
              <span className="text-sm font-medium text-gray-700 ml-1">{s.feedback.rating}/5</span>
            </div>
            {s.feedback.text && <p className="text-sm text-gray-600">{s.feedback.text}</p>}
            {s.feedback.tags && (
              <div className="flex flex-wrap gap-1">
                {s.feedback.tags.split(',').filter(Boolean).map((tag, i) => (
                  <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag.trim()}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tiny UI Components ─────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-emerald-600">{icon}</span>
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
    </div>
  );
}

function SummaryCard({ label, value, className = '', small }: { label: string; value: string; className?: string; small?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${className || 'border-gray-200 bg-gray-50'}`}>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
      <p className={`font-semibold ${small ? 'text-xs' : 'text-sm'} mt-0.5`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-gray-400">{label}:</span>{' '}
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`rounded border px-2 py-1.5 text-center ${colorMap[color] || colorMap.gray}`}>
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-xs font-bold mt-0.5">{value}</p>
    </div>
  );
}