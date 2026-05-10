'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Video, Copy, ExternalLink, Plus, Check, RefreshCw, Clock, Calendar, Users, X,
  Send, Search, ChevronDown, ChevronRight, UserPlus, Phone, CheckCircle2, AlertCircle,
  Loader2, Pencil, Ban, CalendarClock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface Conference {
  id: string;
  title: string;
  admin_token: string;
  user_token: string;
  status: string;
  conference_type: string;
  scheduled_at: string | null;
  duration_minutes: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
  admin_link?: string;
  user_link?: string;
}

interface ShareUser {
  email: string;
  name: string;
  role: string;
  whatsapp: string | null;
}

interface Batch {
  batch_id: string;
  batch_name: string;
  grade: string;
  section: string;
  student_count: number;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  academic_operator: 'Academic Op',
  academic: 'Academic Op',
  batch_coordinator: 'Batch Coord',
  hr: 'HR',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 border-purple-200',
  academic_operator: 'bg-blue-100 text-blue-700 border-blue-200',
  academic: 'bg-blue-100 text-blue-700 border-blue-200',
  batch_coordinator: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  hr: 'bg-teal-100 text-teal-700 border-teal-200',
  teacher: 'bg-amber-100 text-amber-700 border-amber-200',
  student: 'bg-primary/10 text-primary border-primary/20',
  parent: 'bg-rose-100 text-rose-700 border-rose-200',
};

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export default function ConferenceTab() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Share panel state
  const [shareConference, setShareConference] = useState<Conference | null>(null);
  const [shareLinkType, setShareLinkType] = useState<'admin' | 'user'>('admin');

  // Edit/reschedule state
  const [editConference, setEditConference] = useState<Conference | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editMode, setEditMode] = useState<'edit' | 'reschedule'>('edit');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchConferences = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/conference');
      const data = await res.json();
      if (data.success) setConferences(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConferences(); }, [fetchConferences]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (mode === 'scheduled') {
        if (!scheduledDate || !scheduledTime) { setCreating(false); return; }
        body.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        body.duration_minutes = duration;
      }
      const res = await fetch('/api/v1/conference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShareConference(data.data);
        setTitle('');
        setScheduledDate('');
        setScheduledTime('');
        fetchConferences();
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const startEdit = (c: Conference, mode: 'edit' | 'reschedule') => {
    setEditConference(c);
    setEditMode(mode);
    setEditTitle(c.title);
    setEditError('');
    setEditSuccess('');
    if (c.scheduled_at) {
      const d = new Date(c.scheduled_at);
      setEditDate(d.toISOString().split('T')[0]);
      setEditTime(d.toTimeString().slice(0, 5));
    } else {
      setEditDate('');
      setEditTime('');
    }
    setEditDuration(c.duration_minutes || 60);
  };

  const handleEditSave = async () => {
    if (!editConference) return;
    setEditSaving(true);
    setEditError('');
    setEditSuccess('');

    const action = editMode === 'reschedule' ? 'reschedule' : 'edit';
    const body: Record<string, unknown> = { action, notify: true };

    if (editMode === 'reschedule') {
      if (!editDate || !editTime) { setEditError('Date and time are required'); setEditSaving(false); return; }
      body.scheduled_at = new Date(`${editDate}T${editTime}`).toISOString();
      body.duration_minutes = editDuration;
    } else {
      if (!editTitle.trim()) { setEditError('Title is required'); setEditSaving(false); return; }
      body.title = editTitle.trim();
      if (editDate && editTime) {
        body.scheduled_at = new Date(`${editDate}T${editTime}`).toISOString();
        body.duration_minutes = editDuration;
      }
    }

    try {
      const res = await fetch(`/api/v1/conference/${editConference.admin_token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setEditSuccess(action === 'reschedule' ? 'Conference rescheduled — recipients notified via WhatsApp' : 'Conference updated — recipients notified');
        fetchConferences();
        setTimeout(() => { setEditConference(null); setEditSuccess(''); }, 2000);
      } else {
        setEditError(data.error || 'Failed to update');
      }
    } catch {
      setEditError('Network error');
    }
    setEditSaving(false);
  };

  const handleCancel = async (c: Conference) => {
    if (!confirm(`Cancel conference "${c.title}"? All shared recipients will be notified via WhatsApp.`)) return;
    setCancelling(c.id);
    try {
      const res = await fetch(`/api/v1/conference/${c.admin_token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', notify: true }),
      });
      const data = await res.json();
      if (data.success) fetchConferences();
    } catch { /* ignore */ }
    setCancelling(null);
  };

  const adminLink = (c: Conference) => `${baseUrl}/conference/${c.admin_token}?role=admin`;
  const userLink = (c: Conference) => `${baseUrl}/conference/${c.user_token}`;

  const statusBadge = (c: Conference) => {
    if (c.status === 'live') return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live
      </span>
    );
    if (c.status === 'ended') return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200">Ended</span>
    );
    if (c.status === 'cancelled') return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 border border-red-200">
        <Ban className="h-3 w-3" /> Cancelled
      </span>
    );
    if (c.conference_type === 'scheduled') return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
        <Clock className="h-3 w-3" /> Scheduled
      </span>
    );
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">Ready</span>
    );
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* ── Create Conference ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          Create Conference
        </h3>

        {/* Mode Toggle */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setMode('instant')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'instant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Instant
          </button>
          <button
            onClick={() => setMode('scheduled')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'scheduled' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Scheduled
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && mode === 'instant' && handleCreate()}
            placeholder="Conference title (e.g. Team Standup, Parent Meeting)"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            maxLength={100}
          />
        </div>

        {mode === 'scheduled' && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={today}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Time</label>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>
          </div>
        )}

        <button onClick={handleCreate}
          disabled={!title.trim() || creating || (mode === 'scheduled' && (!scheduledDate || !scheduledTime))}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
          {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {mode === 'scheduled' ? 'Schedule Conference' : 'Start Instant Conference'}
        </button>
      </div>

      {/* ── Share Panel (after creation or from list) ── */}
      {shareConference && (
        <SharePanel
          conference={shareConference}
          linkType={shareLinkType}
          setLinkType={setShareLinkType}
          adminLink={adminLink(shareConference)}
          userLink={userLink(shareConference)}
          onClose={() => setShareConference(null)}
          copyToClipboard={copyToClipboard}
          copiedField={copiedField}
        />
      )}

      {/* ── Edit / Reschedule Panel ── */}
      {editConference && (
        <div className="rounded-xl border-2 border-blue-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              {editMode === 'reschedule'
                ? <><CalendarClock className="h-4 w-4 text-amber-600" /> Reschedule: {editConference.title}</>
                : <><Pencil className="h-4 w-4 text-blue-600" /> Edit: {editConference.title}</>
              }
            </h3>
            <button onClick={() => setEditConference(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-700">{editError}</p>
              </div>
            )}
            {editSuccess && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-xs text-primary">{editSuccess}</p>
              </div>
            )}

            {editMode === 'edit' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Title</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  maxLength={100} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} min={today}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Time</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration</label>
                <select value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Send className="h-3 w-3" />
              All previously shared recipients will be notified of this change via WhatsApp.
            </p>
          </div>

          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
            <button onClick={() => setEditConference(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleEditSave} disabled={editSaving}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors shadow-sm disabled:opacity-50 ${
                editMode === 'reschedule' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editMode === 'reschedule' ? <CalendarClock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {editMode === 'reschedule' ? 'Reschedule & Notify' : 'Save & Notify'}
            </button>
          </div>
        </div>
      )}

      {/* ── Conference List ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">My Conferences</h3>
          <button onClick={fetchConferences} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600" />
          </div>
        ) : conferences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Video className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No conferences yet</p>
            <p className="text-xs text-gray-400 mt-1">Create one above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conferences.map((c) => {
              const isActive = c.status !== 'ended' && c.status !== 'cancelled';
              return (
              <div key={c.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-medium text-gray-900">{c.title}</h4>
                    {statusBadge(c)}
                  </div>
                  <span className="text-xs text-gray-400">{fmtDate(c.created_at)}</span>
                </div>

                {c.conference_type === 'scheduled' && c.scheduled_at && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-600">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(c.scheduled_at)} at {fmtTime(c.scheduled_at)}
                    <span className="text-gray-400">· {c.duration_minutes} min</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {c.participant_count || 0}
                  </span>
                  <button onClick={() => copyToClipboard(adminLink(c), `admin-${c.id}`)}
                    className="flex items-center gap-1 text-primary hover:text-primary">
                    {copiedField === `admin-${c.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Admin Link
                  </button>
                  <button onClick={() => copyToClipboard(userLink(c), `user-${c.id}`)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                    {copiedField === `user-${c.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} User Link
                  </button>
                  {isActive && (
                    <>
                      <a href={adminLink(c)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:text-primary font-medium">
                        <ExternalLink className="h-3 w-3" /> Join
                      </a>
                      <button
                        onClick={() => { setShareConference(c); setShareLinkType('admin'); }}
                        className="flex items-center gap-1 text-violet-600 hover:text-violet-700 font-medium">
                        <Send className="h-3 w-3" /> Share
                      </button>
                      <button onClick={() => startEdit(c, 'edit')}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      {c.conference_type === 'scheduled' && (
                        <button onClick={() => startEdit(c, 'reschedule')}
                          className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-medium">
                          <CalendarClock className="h-3 w-3" /> Reschedule
                        </button>
                      )}
                      <button onClick={() => handleCancel(c)} disabled={cancelling === c.id}
                        className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium disabled:opacity-50">
                        {cancelling === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />} Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Share Panel Component
   ═══════════════════════════════════════════════════ */

function SharePanel({
  conference, linkType, setLinkType, adminLink, userLink, onClose, copyToClipboard, copiedField,
}: {
  conference: Conference;
  linkType: 'admin' | 'user';
  setLinkType: (t: 'admin' | 'user') => void;
  adminLink: string;
  userLink: string;
  onClose: () => void;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  const link = linkType === 'admin' ? adminLink : userLink;

  // Users data
  const [staffUsers, setStaffUsers] = useState<ShareUser[]>([]);
  const [studentUsers, setStudentUsers] = useState<ShareUser[]>([]);
  const [parentUsers, setParentUsers] = useState<ShareUser[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchStudents, setBatchStudents] = useState<ShareUser[]>([]);
  const [batchParents, setBatchParents] = useState<ShareUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  // External/manual entries
  const [manualEntries, setManualEntries] = useState<Array<{ name: string; phone: string }>>([]);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Sending state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['owner', 'academic_operator', 'teacher', 'hr', 'batch_coordinator', 'student', 'parent', 'batch_students', 'batch_parents']));

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  // Load staff users (always), batches (always), students/parents (for user link)
  useEffect(() => {
    setLoadingUsers(true);
    setSelected(new Set());
    setSendResult(null);

    const promises: Promise<void>[] = [
      fetch('/api/v1/conference/users?type=staff').then(r => r.json()).then(d => {
        if (d.success) setStaffUsers(d.data || []);
      }),
      fetch('/api/v1/conference/users?type=batches').then(r => r.json()).then(d => {
        if (d.success) setBatches(d.data || []);
      }),
    ];

    if (linkType === 'user') {
      promises.push(
        fetch('/api/v1/conference/users?type=students').then(r => r.json()).then(d => {
          if (d.success) setStudentUsers(d.data || []);
        }),
        fetch('/api/v1/conference/users?type=parents').then(r => r.json()).then(d => {
          if (d.success) setParentUsers(d.data || []);
        }),
      );
    }

    Promise.all(promises).finally(() => setLoadingUsers(false));
  }, [linkType]);

  // Load batch students/parents when batch selected
  useEffect(() => {
    if (!selectedBatch) {
      setBatchStudents([]);
      setBatchParents([]);
      return;
    }
    setLoadingBatch(true);
    fetch(`/api/v1/conference/users?type=batch&batch_id=${encodeURIComponent(selectedBatch)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBatchStudents(d.data.students || []);
          setBatchParents(d.data.parents || []);
        }
      })
      .finally(() => setLoadingBatch(false));
  }, [selectedBatch]);

  // Selection helpers
  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = (users: ShareUser[]) => {
    const filtered = users.filter(u => matchesSearch(u));
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = filtered.every(u => next.has(u.email));
      if (allSelected) {
        filtered.forEach(u => next.delete(u.email));
      } else {
        filtered.forEach(u => next.add(u.email));
      }
      return next;
    });
  };

  const matchesSearch = (u: ShareUser) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || (u.role && u.role.toLowerCase().includes(s));
  };

  const getPhone = (u: ShareUser): string | null => {
    return phoneOverrides[u.email] || u.whatsapp || null;
  };

  const addManualEntry = () => {
    if (!manualName.trim() || !manualPhone.trim()) return;
    const phone = manualPhone.trim().replace(/\s/g, '');
    setManualEntries(prev => [...prev, { name: manualName.trim(), phone }]);
    setManualName('');
    setManualPhone('');
  };

  const removeManualEntry = (idx: number) => {
    setManualEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // Build recipients list for sending
  const buildRecipients = () => {
    const all = getUniqueUsers();
    const recipients: Array<{ name: string; phone: string; email?: string }> = [];

    for (const u of all) {
      if (!selected.has(u.email)) continue;
      const phone = getPhone(u);
      if (!phone) continue;
      recipients.push({ name: u.name, phone, email: u.email });
    }

    for (const m of manualEntries) {
      recipients.push({ name: m.name, phone: m.phone });
    }

    return recipients;
  };

  const getUniqueUsers = (): ShareUser[] => {
    const all = linkType === 'admin'
      ? staffUsers
      : [...staffUsers, ...studentUsers, ...parentUsers, ...batchStudents, ...batchParents];
    const seen = new Set<string>();
    return all.filter(u => {
      if (seen.has(u.email)) return false;
      seen.add(u.email);
      return true;
    });
  };

  const selectedCount = selected.size + manualEntries.length;
  const readyCount = buildRecipients().length;

  // Send WhatsApp
  const handleSend = async () => {
    const recipients = buildRecipients();
    if (recipients.length === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/v1/conference/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conference_id: conference.id,
          link_type: linkType,
          recipients,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult(data.data);
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  // Group staff by role
  const staffByRole = staffUsers.reduce<Record<string, ShareUser[]>>((acc, u) => {
    const role = u.role === 'academic' ? 'academic_operator' : u.role;
    if (!acc[role]) acc[role] = [];
    acc[role].push(u);
    return acc;
  }, {});

  const staffRoleOrder = ['owner', 'academic_operator', 'batch_coordinator', 'hr', 'teacher'];

  return (
    <div className="rounded-xl border-2 border-violet-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-600" />
            Share Conference: {conference.title}
          </h3>
          {conference.conference_type === 'scheduled' && conference.scheduled_at && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(conference.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} at{' '}
              {new Date(conference.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              {conference.duration_minutes ? ` · ${conference.duration_minutes} min` : ''}
            </p>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Link Type Toggle + Copy */}
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button onClick={() => setLinkType('admin')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${linkType === 'admin' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Admin / Host Link
          </button>
          <button onClick={() => setLinkType('user')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${linkType === 'user' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Participant / User Link
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input type="text" readOnly value={link}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 font-mono" />
          <button onClick={() => copyToClipboard(link, `share-${linkType}`)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors ${linkType === 'admin' ? 'bg-primary hover:bg-primary/90' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {copiedField === `share-${linkType}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Search + Users */}
      <div className="px-6 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {selectedCount} selected · {readyCount} ready
          </span>
        </div>

        {loadingUsers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto space-y-3 -mx-1 px-1">
            {/* Staff groups */}
            {staffRoleOrder.map(role => {
              const users = staffByRole[role];
              if (!users?.length) return null;
              const filtered = users.filter(matchesSearch);
              if (filtered.length === 0 && search) return null;
              const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.email));

              return (
                <div key={role} className="border border-gray-100 rounded-lg">
                  <button onClick={() => toggleGroup(role)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      {expandedGroups.has(role) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {ROLE_LABELS[role] || role}
                      </span>
                      <span className="text-xs text-gray-400">{filtered.length}</span>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); selectAll(filtered); }}
                      className={`text-xs font-medium px-2 py-0.5 rounded cursor-pointer ${allSelected ? 'text-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'}`}>
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                  {expandedGroups.has(role) && (
                    <div className="divide-y divide-gray-50">
                      {filtered.map(u => (
                        <UserRow key={u.email} user={u} isSelected={selected.has(u.email)}
                          onToggle={() => toggleSelect(u.email)}
                          phone={getPhone(u)}
                          onPhoneChange={(p) => setPhoneOverrides(prev => ({ ...prev, [u.email]: p }))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* User link: students, parents, batch selector */}
            {linkType === 'user' && (
              <>
                {/* All Students */}
                {studentUsers.length > 0 && (
                  <UserGroup label="Students" role="student"
                    users={studentUsers.filter(matchesSearch)} selected={selected}
                    expanded={expandedGroups.has('student')} onToggleExpand={() => toggleGroup('student')}
                    onSelectAll={() => selectAll(studentUsers)}
                    onToggleSelect={toggleSelect} getPhone={getPhone}
                    onPhoneChange={(email, p) => setPhoneOverrides(prev => ({ ...prev, [email]: p }))}
                  />
                )}

                {/* All Parents */}
                {parentUsers.length > 0 && (
                  <UserGroup label="Parents" role="parent"
                    users={parentUsers.filter(matchesSearch)} selected={selected}
                    expanded={expandedGroups.has('parent')} onToggleExpand={() => toggleGroup('parent')}
                    onSelectAll={() => selectAll(parentUsers)}
                    onToggleSelect={toggleSelect} getPhone={getPhone}
                    onPhoneChange={(email, p) => setPhoneOverrides(prev => ({ ...prev, [email]: p }))}
                  />
                )}

                {/* Batch Selector */}
                <div className="border border-gray-100 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-medium text-gray-700">Select by Batch</span>
                  </div>
                  <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
                    <option value="">Choose a batch...</option>
                    {batches.map(b => (
                      <option key={b.batch_id} value={b.batch_id}>
                        {b.batch_name} {b.grade ? `(${b.grade}${b.section ? ` ${b.section}` : ''})` : ''} — {b.student_count} students
                      </option>
                    ))}
                  </select>

                  {loadingBatch && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading batch members...
                    </div>
                  )}

                  {batchStudents.length > 0 && (
                    <UserGroup label="Batch Students" role="student"
                      users={batchStudents.filter(matchesSearch)} selected={selected}
                      expanded={expandedGroups.has('batch_students')} onToggleExpand={() => toggleGroup('batch_students')}
                      onSelectAll={() => selectAll(batchStudents)}
                      onToggleSelect={toggleSelect} getPhone={getPhone}
                      onPhoneChange={(email, p) => setPhoneOverrides(prev => ({ ...prev, [email]: p }))}
                    />
                  )}

                  {batchParents.length > 0 && (
                    <UserGroup label="Batch Parents" role="parent"
                      users={batchParents.filter(matchesSearch)} selected={selected}
                      expanded={expandedGroups.has('batch_parents')} onToggleExpand={() => toggleGroup('batch_parents')}
                      onSelectAll={() => selectAll(batchParents)}
                      onToggleSelect={toggleSelect} getPhone={getPhone}
                      onPhoneChange={(email, p) => setPhoneOverrides(prev => ({ ...prev, [email]: p }))}
                    />
                  )}
                </div>
              </>
            )}

            {/* Manual / External entries */}
            <div className="border border-gray-100 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium text-gray-700">Add External Recipients</span>
              </div>
              <div className="flex gap-2">
                <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)}
                  placeholder="Name" className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                <input type="text" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="WhatsApp (e.g. 919876543210)" className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  onKeyDown={(e) => e.key === 'Enter' && addManualEntry()} />
                <button onClick={addManualEntry} disabled={!manualName.trim() || !manualPhone.trim()}
                  className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {manualEntries.length > 0 && (
                <div className="space-y-1">
                  {manualEntries.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-violet-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-violet-500" />
                        <span className="font-medium text-gray-700">{m.name}</span>
                        <span className="text-gray-400">{m.phone}</span>
                      </div>
                      <button onClick={() => removeManualEntry(idx)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Send Footer */}
      <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
        {sendResult ? (
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-primary font-medium">{sendResult.sent} sent</span>
            {sendResult.failed > 0 && (
              <span className="text-red-600">{sendResult.failed} failed</span>
            )}
            <button onClick={() => setSendResult(null)} className="text-xs text-gray-500 hover:text-gray-700 ml-2">Dismiss</button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            {readyCount === 0 && selectedCount > 0
              ? 'Selected users have no WhatsApp numbers — enter numbers manually'
              : `${readyCount} recipient${readyCount !== 1 ? 's' : ''} will receive the ${linkType === 'admin' ? 'host' : 'participant'} link via WhatsApp`}
          </p>
        )}
        <button onClick={handleSend} disabled={sending || readyCount === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send via WhatsApp ({readyCount})
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   UserGroup — Collapsible group of users
   ═══════════════════════════════════════════════════ */

function UserGroup({
  label, role, users, selected, expanded, onToggleExpand, onSelectAll, onToggleSelect, getPhone, onPhoneChange,
}: {
  label: string;
  role: string;
  users: ShareUser[];
  selected: Set<string>;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectAll: () => void;
  onToggleSelect: (email: string) => void;
  getPhone: (u: ShareUser) => string | null;
  onPhoneChange: (email: string, phone: string) => void;
}) {
  if (users.length === 0) return null;
  const allSelected = users.every(u => selected.has(u.email));

  return (
    <div className="border border-gray-100 rounded-lg">
      <button onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {label}
          </span>
          <span className="text-xs text-gray-400">{users.length}</span>
        </div>
        <span onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
          className={`text-xs font-medium px-2 py-0.5 rounded cursor-pointer ${allSelected ? 'text-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'}`}>
          {allSelected ? 'Deselect All' : 'Select All'}
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-50">
          {users.map(u => (
            <UserRow key={u.email} user={u} isSelected={selected.has(u.email)}
              onToggle={() => onToggleSelect(u.email)}
              phone={getPhone(u)}
              onPhoneChange={(p) => onPhoneChange(u.email, p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   UserRow — Single user with checkbox + phone
   ═══════════════════════════════════════════════════ */

function UserRow({
  user, isSelected, onToggle, phone, onPhoneChange,
}: {
  user: ShareUser;
  isSelected: boolean;
  onToggle: () => void;
  phone: string | null;
  onPhoneChange: (phone: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tempPhone, setTempPhone] = useState('');

  return (
    <div className={`flex items-center gap-3 px-3 py-2 ${isSelected ? 'bg-primary/5/50' : 'hover:bg-gray-50'} transition-colors`}>
      <button onClick={onToggle} className="shrink-0">
        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-emerald-600' : 'border-gray-300'}`}>
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {phone ? (
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <Phone className="h-3 w-3" /> {phone.slice(-4)}
          </span>
        ) : editing ? (
          <div className="flex items-center gap-1">
            <input type="text" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)}
              placeholder="91xxxxxxxxxx" autoFocus
              className="w-28 rounded border border-gray-200 px-2 py-1 text-xs focus:border-primary focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && tempPhone) { onPhoneChange(tempPhone); setEditing(false); } }} />
            <button onClick={() => { if (tempPhone) { onPhoneChange(tempPhone); setEditing(false); } }}
              className="text-primary hover:text-primary"><Check className="h-3 w-3" /></button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button onClick={() => { setEditing(true); setTempPhone(''); }}
            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600">
            <AlertCircle className="h-3 w-3" /> No number
          </button>
        )}
      </div>
    </div>
  );
}
