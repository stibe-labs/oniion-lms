'use client';

/**
 * Owner Meetings Tab
 * ─────────────────────────────────────────────────────────────
 * Template-driven meeting hub for the owner. The owner is always
 * the host. Templates pre-configure audience + subject:
 *   • Staff Meeting    — internal team sync
 *   • Parents Meeting  — broadcast to parents
 *   • Batch Meeting    — students + parents of a batch
 *   • Student Meeting  — all students assembly
 *   • Custom           — define your own
 *
 * Reuses backend endpoints:
 *   POST /api/v1/open-classroom        (owner allowed)
 *   GET  /api/v1/open-classroom        (owner sees all)
 *   POST /api/v1/open-classroom/share  (bulk WhatsApp)
 *   GET  /api/v1/conference/users      (audience lookup)
 *   GET  /api/v1/open-classroom/:t/details
 *   PATCH/DELETE /api/v1/open-classroom/:t
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, GraduationCap, BookOpen, UserCheck, Pencil,
  Calendar, Clock, Video, Loader2, Plus, RefreshCw,
  Send, Search, Phone, Check, Copy, X, ExternalLink,
  CheckCircle2, ChevronLeft, MessageSquare,
  Trash2, CalendarClock, Eye, Radio, Ban, AlertCircle, UserPlus,
} from 'lucide-react';
import OpenClassroomDetail from './OpenClassroomDetail';

/* ── Types ─────────────────────────────────────────────────── */

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  meeting_type: string | null;
  host_token: string;
  join_token: string;
  status: string;
  classroom_type: string;
  scheduled_at: string | null;
  duration_minutes: number;
  max_participants: number;
  participant_count: number | string;
  teacher_name?: string;
  teacher_email?: string;
  host_link?: string;
  join_link?: string;
}

interface ShareUser {
  email: string;
  name: string;
  role: string;
  whatsapp: string | null;
}

interface BatchOpt {
  batch_id: string;
  batch_name: string;
  student_count: number;
}

type TemplateId = 'staff' | 'parents' | 'batch' | 'student' | 'custom';
type Audience = 'staff' | 'parents' | 'students' | 'batch';

interface Template {
  id: TemplateId;
  label: string;
  icon: typeof Users;
  audience: Audience;
  defaultSubject: string;
  defaultDuration: number;
  defaultMaxParticipants: number;
  desc: string;
  accent: { bar: string; barBefore: string; bg: string; text: string; ring: string };
}

const TEMPLATES: Template[] = [
  {
    id: 'staff', label: 'Staff Meeting', icon: Users, audience: 'staff',
    defaultSubject: 'Staff Meeting', defaultDuration: 45, defaultMaxParticipants: 50,
    desc: 'Internal team sync — owners, AOs, BCs, HR, teachers',
    accent: { bar: 'bg-indigo-500', barBefore: 'before:bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  },
  {
    id: 'parents', label: 'Parents Meeting', icon: UserCheck, audience: 'parents',
    defaultSubject: 'Parents Meeting', defaultDuration: 60, defaultMaxParticipants: 200,
    desc: 'Broadcast announcements & PTM with all parents',
    accent: { bar: 'bg-rose-500', barBefore: 'before:bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200' },
  },
  {
    id: 'batch', label: 'Batch Meeting', icon: BookOpen, audience: 'batch',
    defaultSubject: 'Batch Discussion', defaultDuration: 45, defaultMaxParticipants: 80,
    desc: 'Address a specific batch — students + parents',
    accent: { bar: 'bg-amber-500', barBefore: 'before:bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  },
  {
    id: 'student', label: 'Student Meeting', icon: GraduationCap, audience: 'students',
    defaultSubject: 'Student Assembly', defaultDuration: 45, defaultMaxParticipants: 300,
    desc: 'All-students assembly or motivational session',
    accent: { bar: 'bg-emerald-500', barBefore: 'before:bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  },
  {
    id: 'custom', label: 'Custom Meeting', icon: Pencil, audience: 'staff',
    defaultSubject: '', defaultDuration: 60, defaultMaxParticipants: 100,
    desc: 'Free-form meeting — define your own audience & details',
    accent: { bar: 'bg-slate-500', barBefore: 'before:bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200' },
  },
];

/* ── Helpers ──────────────────────────────────────────────── */

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

const STATUS_STYLE: Record<string, { bar: string; badge: string; label: string }> = {
  live:      { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'LIVE' },
  created:   { bar: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 ring-blue-200',          label: 'READY' },
  ended:     { bar: 'bg-gray-300',    badge: 'bg-gray-100 text-gray-600 ring-gray-200',         label: 'ENDED' },
  cancelled: { bar: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 ring-rose-200',          label: 'CANCELLED' },
};

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  academic_operator: 'bg-blue-50 text-blue-700 ring-blue-200',
  academic: 'bg-blue-50 text-blue-700 ring-blue-200',
  batch_coordinator: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  hr: 'bg-amber-50 text-amber-700 ring-amber-200',
  teacher: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  student: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  parent: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/* ─────────────────────────────────────────────────────────── */
/*  Main Component                                             */
/* ─────────────────────────────────────────────────────────── */

export default function OwnerMeetingsTab({
  ownerName,
  ownerEmail,
}: {
  ownerName: string;
  ownerEmail: string;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [detail, setDetail] = useState<Meeting | null>(null);
  const [shareTarget, setShareTarget] = useState<{ meeting: Meeting; audience: Audience } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');

  // Form state
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [batchId, setBatchId] = useState(''); // for batch template
  const [batches, setBatches] = useState<BatchOpt[]>([]);
  const [mode, setMode] = useState<'instant' | 'scheduled'>('scheduled');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/open-classroom');
      const data = await res.json();
      if (data.success) {
        // Owner sees all classrooms; filter to those that are meetings
        const list = (data.data || []).filter((m: Meeting) => m.meeting_type);
        setMeetings(list);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/conference/users?type=batches');
      const data = await res.json();
      if (data.success) setBatches(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMeetings(); fetchBatches(); }, [fetchMeetings, fetchBatches]);

  /* ── Template selection ── */
  const selectTemplate = (t: Template) => {
    setActiveTemplate(t);
    setSubject(t.defaultSubject);
    setDuration(t.defaultDuration);
    setMaxParticipants(t.defaultMaxParticipants);
    setDescription('');
    setBatchId('');
    setMode('scheduled');
    // Default scheduled time = +1 hour from now
    const d = new Date(Date.now() + 60 * 60 * 1000);
    setScheduledDate(d.toISOString().split('T')[0]);
    setScheduledTime(d.toTimeString().slice(0, 5));
    setCreateMsg(null);
  };

  const cancelTemplate = () => {
    setActiveTemplate(null);
    setCreateMsg(null);
  };

  /* ── Create meeting ── */
  const handleCreate = async () => {
    if (!activeTemplate) return;
    if (!subject.trim()) { setCreateMsg({ ok: false, text: 'Subject is required' }); return; }
    if (activeTemplate.id === 'batch' && !batchId) { setCreateMsg({ ok: false, text: 'Please pick a batch' }); return; }
    if (mode === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      setCreateMsg({ ok: false, text: 'Date & time required for scheduled meeting' }); return;
    }

    setCreating(true); setCreateMsg(null);
    try {
      const selectedBatch = batches.find(b => b.batch_id === batchId);
      const finalSubject = activeTemplate.id === 'batch' && selectedBatch
        ? `${subject.trim()} — ${selectedBatch.batch_name}`
        : subject.trim();

      const body: Record<string, unknown> = {
        subject: finalSubject,
        title: `${finalSubject} — ${ownerName || 'Owner'}`,
        description: description.trim() || undefined,
        teacher_email: ownerEmail,        // owner = host
        teacher_name: ownerName,
        duration_minutes: duration,
        max_participants: maxParticipants,
        auto_approve_joins: true,
        payment_enabled: false,
        meeting_type: activeTemplate.id,
      };
      if (mode === 'scheduled') {
        body.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const res = await fetch('/api/v1/open-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setCreateMsg({ ok: true, text: 'Meeting created — open share panel to invite participants' });
        await fetchMeetings();
        // Auto-open share panel pre-targeted to template audience
        const created: Meeting = data.data;
        const audience: Audience = activeTemplate.id === 'batch' ? 'batch' : activeTemplate.audience;
        setShareTarget({ meeting: created, audience });
        // Close the form template after a short delay
        setTimeout(() => { setActiveTemplate(null); }, 1200);
      } else {
        setCreateMsg({ ok: false, text: data.error || 'Failed to create' });
      }
    } catch {
      setCreateMsg({ ok: false, text: 'Network error' });
    } finally {
      setCreating(false);
    }
  };

  const handleCancelMeeting = async (m: Meeting) => {
    if (!confirm(`Cancel "${m.title}"? Recipients will be notified.`)) return;
    try {
      await fetch(`/api/v1/open-classroom/${m.host_token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', notify: true }),
      });
      fetchMeetings();
    } catch { /* ignore */ }
  };

  const handleEnd = async (m: Meeting) => {
    if (!confirm(`End "${m.title}"? LiveKit room will be destroyed.`)) return;
    try {
      await fetch(`/api/v1/open-classroom/${m.host_token}`, { method: 'DELETE' });
      fetchMeetings();
    } catch { /* ignore */ }
  };

  /* ── Filter ── */
  const filtered = useMemo(() => {
    return meetings.filter(m => {
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      if (filterTemplate !== 'all' && m.meeting_type !== filterTemplate) return false;
      return true;
    });
  }, [meetings, filterStatus, filterTemplate]);

  /* ── Stats ── */
  const stats = {
    total: meetings.length,
    live: meetings.filter(m => m.status === 'live').length,
    upcoming: meetings.filter(m => m.status === 'created' && m.scheduled_at && new Date(m.scheduled_at) > new Date()).length,
    participants: meetings.reduce((s, m) => s + Number(m.participant_count || 0), 0),
  };

  /* ── Detail screen (early return) ── */
  if (detail) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <button
          onClick={() => setDetail(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition">
          <ChevronLeft className="w-4 h-4" /> Back to Meetings
        </button>
        <OpenClassroomDetail
          classroomId={detail.id}
          hostToken={detail.host_token}
          onClose={() => setDetail(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-6 shadow-lg">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-inset ring-white/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-100">Owner Console</div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Meetings &amp; Sessions</h2>
              <p className="text-xs text-white/70 mt-0.5">Host staff, parents, batch &amp; student meetings — you&apos;re always the host</p>
            </div>
          </div>
          <button onClick={() => { setLoading(true); fetchMeetings(); }} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition disabled:opacity-50 self-start sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stats inside hero */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total',        value: stats.total,        icon: Video },
            { label: 'Live Now',     value: stats.live,         icon: Radio },
            { label: 'Upcoming',     value: stats.upcoming,     icon: CalendarClock },
            { label: 'Participants', value: stats.participants, icon: Users },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl bg-white/10 backdrop-blur-sm p-4 ring-1 ring-inset ring-white/15">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">{stat.label}</div>
                  <div className="mt-1 text-2xl font-bold tracking-tight text-white">{stat.value}</div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Templates ── */}
      {!activeTemplate && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Start a meeting</h3>
              <p className="text-[11px] text-gray-500">Pick a template — host: <strong>{ownerName || 'Owner'}</strong></p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => selectTemplate(t)}
                className={`relative overflow-hidden text-left rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition group before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${t.accent.barBefore}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.accent.bg} mb-3 group-hover:scale-110 transition`}>
                  <t.icon className={`h-5 w-5 ${t.accent.text}`} />
                </div>
                <h4 className="text-sm font-bold text-gray-800">{t.label}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {activeTemplate && (
        <div className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${activeTemplate.accent.barBefore}`}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeTemplate.accent.bg}`}>
                <activeTemplate.icon className={`h-4 w-4 ${activeTemplate.accent.text}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">{activeTemplate.label}</h3>
                <p className="text-[11px] text-gray-500">{activeTemplate.desc}</p>
              </div>
            </div>
            <button onClick={cancelTemplate} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Host (locked) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Host (you)</label>
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200 px-3 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
                  {(ownerName || 'O').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{ownerName || 'Owner'}</p>
                  <p className="text-[10px] text-gray-400 truncate">{ownerEmail}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Host</span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject / Title *</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder={activeTemplate.id === 'custom' ? 'e.g. Quarterly Review' : activeTemplate.defaultSubject}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400" />
            </div>

            {/* Batch picker (only for batch template) */}
            {activeTemplate.id === 'batch' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Batch *</label>
                <select value={batchId} onChange={e => setBatchId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200 bg-white">
                  <option value="">Select batch…</option>
                  {batches.map(b => (
                    <option key={b.batch_id} value={b.batch_id}>
                      {b.batch_name} ({b.student_count} students)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Agenda / Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief agenda for the meeting…" rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none" />
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600">When:</span>
              <div className="inline-flex rounded-lg ring-1 ring-inset ring-gray-200 overflow-hidden text-xs bg-gray-50 p-0.5">
                <button onClick={() => setMode('instant')}
                  className={`px-3.5 py-1 rounded-md font-semibold transition ${mode === 'instant' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                  Start Now
                </button>
                <button onClick={() => setMode('scheduled')}
                  className={`px-3.5 py-1 rounded-md font-semibold transition ${mode === 'scheduled' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                  Schedule
                </button>
              </div>
            </div>

            {mode === 'scheduled' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                  <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Duration (min)</label>
                  <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={15} max={480}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
            )}

            {mode === 'instant' && (
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-500 mb-1">Duration (min)</label>
                <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={15} max={480}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
            )}

            <div className="w-48">
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Participants</label>
              <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(Number(e.target.value))} min={1} max={500}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200" />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleCreate} disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 text-sm font-semibold transition shadow-md hover:shadow-lg">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create &amp; Open Share Panel
              </button>
              {createMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-inset ${
                  createMsg.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
                }`}>
                  {createMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  <p className="text-xs font-medium">{createMsg.text}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters & Meeting list ── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-gray-800">All Meetings ({filtered.length})</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)}
              className="text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-emerald-200">
              <option value="all">All types</option>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-emerald-200">
              <option value="all">All statuses</option>
              <option value="created">Ready</option>
              <option value="live">Live</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No meetings yet — pick a template above to start one</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(m => {
              const tpl = TEMPLATES.find(t => t.id === m.meeting_type);
              const status = STATUS_STYLE[m.status] || STATUS_STYLE.created;
              return (
                <div key={m.id} className="px-5 py-4 hover:bg-gray-50/60 transition">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetail(m)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {tpl && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${tpl.accent.bg} ${tpl.accent.text} ${tpl.accent.ring}`}>
                            <tpl.icon className="w-3 h-3" /> {tpl.label}
                          </span>
                        )}
                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${status.badge}`}>
                          {status.label}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-semibold text-gray-800 truncate">{m.title}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                        {m.scheduled_at && (<span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmt(m.scheduled_at)}</span>)}
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {m.duration_minutes} min</span>
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {m.participant_count} joined</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {m.status !== 'cancelled' && m.status !== 'ended' && (
                        <button onClick={() => {
                          const audience: Audience = m.meeting_type === 'parents' ? 'parents'
                            : m.meeting_type === 'student' ? 'students'
                            : m.meeting_type === 'batch' ? 'batch'
                            : 'staff';
                          setShareTarget({ meeting: m, audience });
                        }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-100 transition">
                          <Send className="w-3 h-3" /> Share
                        </button>
                      )}
                      {(m.status === 'created' || m.status === 'live') && (
                        <a href={m.host_link || `${baseUrl}/open-classroom/${m.host_token}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-700 transition">
                          <ExternalLink className="w-3 h-3" /> {m.status === 'live' ? 'Join' : 'Start'}
                        </a>
                      )}
                      <button onClick={() => setDetail(m)}
                        className="inline-flex items-center gap-1 rounded-lg bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-gray-100 transition">
                        <Eye className="w-3 h-3" /> Details
                      </button>
                      {m.status === 'live' && (
                        <button onClick={() => handleEnd(m)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-red-100 transition">
                          <Ban className="w-3 h-3" /> End
                        </button>
                      )}
                      {m.status === 'created' && (
                        <button onClick={() => handleCancelMeeting(m)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 px-2.5 py-1 text-[11px] font-semibold hover:bg-rose-100 transition">
                          <Trash2 className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Share Panel (overlay) ── */}
      {shareTarget && (
        <MeetingSharePanel
          meeting={shareTarget.meeting}
          defaultAudience={shareTarget.audience}
          baseUrl={baseUrl}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Meeting Share Panel                                        */
/* ─────────────────────────────────────────────────────────── */

function MeetingSharePanel({
  meeting, defaultAudience, baseUrl, onClose,
}: {
  meeting: Meeting;
  defaultAudience: Audience;
  baseUrl: string;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [batches, setBatches] = useState<BatchOpt[]>([]);
  const [audience, setAudience] = useState<Audience>(defaultAudience);
  const [batchId, setBatchId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualList, setManualList] = useState<Array<{ name: string; phone: string }>>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ sent: number; failed: number } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const joinLink = meeting.join_link || `${baseUrl}/open-classroom/${meeting.join_token}`;

  const fetchUsers = useCallback(async (type: Audience, bId?: string) => {
    try {
      let url = `/api/v1/conference/users?type=${type}`;
      if (bId) url += `&batch_id=${bId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/conference/users?type=batches');
        const data = await res.json();
        if (data.success) setBatches(data.data || []);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    setSelected(new Set());
    if (audience === 'batch') {
      if (batchId) fetchUsers('batch', batchId);
      else setUsers([]);
    } else {
      fetchUsers(audience);
    }
  }, [audience, batchId, fetchUsers]);

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (email: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(email)) n.delete(email); else n.add(email);
      return n;
    });
  };

  const selectAll = () => {
    const visible = filtered.map(u => u.email);
    if (visible.every(e => selected.has(e))) {
      setSelected(prev => { const n = new Set(prev); visible.forEach(e => n.delete(e)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); visible.forEach(e => n.add(e)); return n; });
    }
  };

  const addManual = () => {
    if (!manualName.trim() || !manualPhone.trim()) return;
    setManualList(prev => [...prev, { name: manualName.trim(), phone: manualPhone.trim() }]);
    setManualName(''); setManualPhone('');
  };

  const handleSend = async () => {
    const recipients: Array<{ name: string; phone: string; email?: string }> = [];
    for (const email of selected) {
      const u = users.find(u => u.email === email);
      if (u?.whatsapp) recipients.push({ name: u.name, phone: u.whatsapp, email: u.email });
    }
    for (const m of manualList) recipients.push({ name: m.name, phone: m.phone });
    if (recipients.length === 0) return;
    setSending(true); setResults(null);
    try {
      const res = await fetch('/api/v1/open-classroom/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroom_id: meeting.id, recipients }),
      });
      const data = await res.json();
      if (data.success) setResults({ sent: data.data.sent, failed: data.data.failed });
    } catch { /* ignore */ }
    setSending(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const recipientCount = selected.size + manualList.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-16"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-emerald-500">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <Send className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Share Meeting</h3>
              <p className="text-[11px] text-gray-500 truncate max-w-md">{meeting.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Copy link */}
          <div className="flex items-center gap-2">
            <input readOnly value={joinLink} className="flex-1 min-w-0 text-xs text-gray-600 bg-gray-50 ring-1 ring-inset ring-gray-200 rounded-lg px-3 py-2 outline-none" />
            <button onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition">
              {linkCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {linkCopied ? 'Copied' : 'Copy'}
            </button>
            <a href={joinLink} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 ring-1 ring-inset ring-gray-200 rounded-lg px-3 py-2 hover:bg-gray-100 transition">
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Audience tabs */}
          <div className="flex gap-1 text-xs flex-wrap">
            {(['staff', 'parents', 'students', 'batch'] as Audience[]).map(t => (
              <button key={t} onClick={() => setAudience(t)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition capitalize ${audience === t ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-inset ring-gray-200'}`}>
                {t}
              </button>
            ))}
          </div>

          {audience === 'batch' && (
            <select value={batchId} onChange={e => setBatchId(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-emerald-200">
              <option value="">Select batch…</option>
              {batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.batch_name} ({b.student_count})</option>)}
            </select>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-200" />
          </div>

          {/* User list */}
          <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {filtered.length > 0 && (
              <button onClick={selectAll} className="w-full text-left px-3 py-2 text-xs text-emerald-600 font-semibold hover:bg-emerald-50 sticky top-0 bg-white border-b border-gray-100">
                {filtered.every(u => selected.has(u.email)) ? 'Deselect All' : `Select All (${filtered.length})`}
              </button>
            )}
            {filtered.map(u => (
              <label key={u.email} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(u.email)} onChange={() => toggleSelect(u.email)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{u.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                </div>
                <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ring-1 ring-inset ${ROLE_BADGE[u.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
                  {u.role.replace('_', ' ')}
                </span>
                <Phone className={`w-3 h-3 shrink-0 ${u.whatsapp ? 'text-green-500' : 'text-gray-300'}`} />
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">
                {audience === 'batch' && !batchId ? 'Pick a batch first' : 'No users found'}
              </p>
            )}
          </div>

          {/* Manual entry */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Add external recipients:</p>
            <div className="flex gap-2">
              <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Name"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200" />
              <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="+91…"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200" />
              <button onClick={addManual} className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 ring-1 ring-inset ring-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition">
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>
            {manualList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {manualList.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-gray-100 rounded-full px-2 py-0.5">
                    {m.name} · {m.phone}
                    <button onClick={() => setManualList(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Send */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-500">
              <strong className="text-gray-800">{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''} selected
            </span>
            <button onClick={handleSend} disabled={sending || recipientCount === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 text-xs font-semibold disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-sm hover:shadow-md">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send via WhatsApp
            </button>
          </div>

          {results && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ring-1 ring-inset ${
              results.failed === 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span><strong>{results.sent}</strong> sent · <strong>{results.failed}</strong> failed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
