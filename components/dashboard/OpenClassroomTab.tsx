'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Video, Copy, ExternalLink, Plus, Check, RefreshCw, Clock, Calendar, Users, X,
  Send, Search, ChevronDown, ChevronRight, ChevronLeft, UserPlus, Phone, CheckCircle2, AlertCircle,
  Loader2, Pencil, Ban, CalendarClock, DollarSign, Eye, Paperclip, FileText, Trash2,
  Radio, GraduationCap, Wallet, Settings,
  HelpCircle, Repeat, Sparkles, Presentation,
} from 'lucide-react';
import OpenClassroomDetail from './OpenClassroomDetail';
import { usePlatformName } from '@/components/providers/PlatformProvider';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface OpenClassroom {
  id: string;
  title: string;
  description: string | null;
  teacher_email: string;
  teacher_name: string | null;
  host_token: string;
  join_token: string;
  status: string;
  classroom_type: string;
  scheduled_at: string | null;
  duration_minutes: number;
  payment_enabled: boolean;
  price_paise: number;
  currency: string;
  max_participants: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
  paid_count: number;
  revenue_paise: number;
  host_link?: string;
  join_link?: string;
}

interface Teacher {
  email: string;
  full_name: string;
  whatsapp: string | null;
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

const STATUS_STYLE: Record<string, { label: string; bg: string; dot?: string }> = {
  live:      { label: 'Live',      bg: 'bg-primary/5 text-primary ring-1 ring-inset ring-primary/20', dot: 'bg-primary animate-pulse' },
  created:   { label: 'Ready',     bg: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' },
  scheduled: { label: 'Scheduled', bg: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' },
  ended:     { label: 'Ended',     bg: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200' },
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', academic_operator: 'Academic Op', academic: 'Academic Op',
  batch_coordinator: 'Batch Coord', hr: 'HR', teacher: 'Teacher',
  student: 'Student', parent: 'Parent',
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

/* ── Class Templates (AO presets) ── */
type TemplateId = 'class' | 'doubt' | 'revision' | 'demo' | 'workshop' | 'custom';

interface ClassTemplate {
  id: TemplateId;
  label: string;
  icon: typeof Video;
  desc: string;
  defaultDescription: string;
  defaultDuration: number;
  defaultMaxParticipants: number;
  accent: { barBefore: string; bg: string; text: string; ring: string };
}

const CLASS_TEMPLATES: ClassTemplate[] = [
  {
    id: 'class', label: 'Subject Class', icon: GraduationCap,
    desc: 'Standard teaching session with public join link',
    defaultDescription: '', defaultDuration: 60, defaultMaxParticipants: 100,
    accent: { barBefore: 'before:bg-primary', bg: 'bg-primary/5', text: 'text-primary', ring: 'ring-primary/20' },
  },
  {
    id: 'doubt', label: 'Doubt Class', icon: HelpCircle,
    desc: 'Live doubt clearance for batch students',
    defaultDescription: 'Open doubt-clearing session — bring your questions.',
    defaultDuration: 45, defaultMaxParticipants: 80,
    accent: { barBefore: 'before:bg-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200' },
  },
  {
    id: 'revision', label: 'Revision', icon: Repeat,
    desc: 'Pre-exam revision session',
    defaultDescription: 'Comprehensive revision before the upcoming exam.',
    defaultDuration: 90, defaultMaxParticipants: 150,
    accent: { barBefore: 'before:bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  },
  {
    id: 'demo', label: 'Demo Class', icon: Presentation,
    desc: 'Public demo for prospective students',
    defaultDescription: 'Introductory demo session — sample our teaching style.',
    defaultDuration: 45, defaultMaxParticipants: 200,
    accent: { barBefore: 'before:bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200' },
  },
  {
    id: 'workshop', label: 'Workshop', icon: Sparkles,
    desc: 'Special topic, guest speaker, masterclass',
    defaultDescription: 'Special workshop session.',
    defaultDuration: 90, defaultMaxParticipants: 250,
    accent: { barBefore: 'before:bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200' },
  },
  {
    id: 'custom', label: 'Custom', icon: Pencil,
    desc: 'Free-form — set your own defaults',
    defaultDescription: '', defaultDuration: 60, defaultMaxParticipants: 100,
    accent: { barBefore: 'before:bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200' },
  },
];

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function OpenClassroomTab() {
  const platformName = usePlatformName();
  const [classrooms, setClassrooms] = useState<OpenClassroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form — teacher first
  const [teacherSource, setTeacherSource] = useState<'platform' | 'manual'>('platform');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [manualTeacherName, setManualTeacherName] = useState('');
  const [manualTeacherEmail, setManualTeacherEmail] = useState('');
  const [manualTeacherWhatsapp, setManualTeacherWhatsapp] = useState('');
  const [manualTeacherPassword, setManualTeacherPassword] = useState('');
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [unlimitedDuration, setUnlimitedDuration] = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [priceRupees, setPriceRupees] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [autoApproveJoins, setAutoApproveJoins] = useState(true);
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('class');

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Share panel
  const [shareClassroom, setShareClassroom] = useState<OpenClassroom | null>(null);

  // Edit panel
  const [editClassroom, setEditClassroom] = useState<OpenClassroom | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editMode, setEditMode] = useState<'edit' | 'reschedule'>('edit');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [detailClassroom, setDetailClassroom] = useState<OpenClassroom | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // ── Data fetching ──
  const fetchClassrooms = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/open-classroom');
      const data = await res.json();
      if (data.success) setClassrooms(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/conference/users?type=staff');
      const data = await res.json();
      if (data.success) {
        const teacherList = (data.data || []).filter((u: ShareUser) => u.role === 'teacher');
        setTeachers(teacherList.map((u: ShareUser) => ({ email: u.email, full_name: u.name, whatsapp: u.whatsapp })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchClassrooms(); fetchTeachers(); }, [fetchClassrooms, fetchTeachers]);

  // ── Create ──
  const resolvedSubject = subject === '__custom__' ? customSubject.trim() : subject;
  const selectedTeacher = teachers.find(t => t.email === teacherEmail);
  const resolvedTeacherName = teacherSource === 'platform' ? (selectedTeacher?.full_name || '') : manualTeacherName.trim();
  const autoTitle = resolvedSubject && resolvedTeacherName ? `${resolvedSubject} — ${resolvedTeacherName}` : '';

  const canCreate = !!resolvedSubject && !!resolvedTeacherName && (
    teacherSource === 'platform'
      ? !!teacherEmail
      : (!!manualTeacherEmail.trim() && !!manualTeacherPassword.trim())
  );

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true); setCreateSuccess(null);
    try {
      const body: Record<string, unknown> = {
        subject: resolvedSubject,
        grade: grade || undefined,
        description: description.trim() || undefined,
        payment_enabled: paymentEnabled,
        price_paise: paymentEnabled ? Math.round(parseFloat(priceRupees || '0') * 100) : 0,
        currency: 'INR',
        max_participants: maxParticipants,
        auto_approve_joins: autoApproveJoins,
        duration_minutes: unlimitedDuration ? 0 : duration,
        meeting_type: activeTemplate,
      };

      if (teacherSource === 'platform') {
        body.teacher_email = teacherEmail;
      } else {
        body.teacher_name = manualTeacherName.trim();
        body.teacher_email = manualTeacherEmail.trim() || undefined;
        body.teacher_whatsapp = manualTeacherWhatsapp.trim();
        if (manualTeacherPassword.trim()) body.teacher_password = manualTeacherPassword.trim();
      }

      if (mode === 'scheduled') {
        if (!scheduledDate || !scheduledTime) { setCreating(false); return; }
        body.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const res = await fetch('/api/v1/open-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        // Upload materials if any
        if (materialFiles.length > 0 && data.data.host_token) {
          try {
            const formData = new FormData();
            materialFiles.forEach(f => formData.append('files', f));
            await fetch(`/api/v1/open-classroom/${data.data.host_token}/materials`, {
              method: 'POST',
              body: formData,
            });
          } catch { /* materials upload is best-effort */ }
        }
        const sentMsg = data.data.teacher_whatsapp_sent
          ? `Host link sent to ${resolvedTeacherName} via WhatsApp ✓`
          : `Created! (WhatsApp not sent — no number)`;
        setCreateSuccess(sentMsg);
        // Open share panel so AO can send participant link to students
        setShareClassroom(data.data);
        // Reset form
        setSubject(''); setCustomSubject(''); setDescription('');
        if (data.data.temp_teacher_email) {
          setTempCredentials({ email: data.data.temp_teacher_email, password: data.data.temp_teacher_password || '' });
        }
        setTeacherEmail(''); setManualTeacherName(''); setManualTeacherEmail(''); setManualTeacherWhatsapp(''); setManualTeacherPassword('');
        setScheduledDate(''); setScheduledTime('');
        setPaymentEnabled(false); setPriceRupees(''); setMaxParticipants(100);
        setUnlimitedDuration(false); setDuration(60); setAutoApproveJoins(true);
        setMaterialFiles([]);
        fetchClassrooms();
        setTimeout(() => setCreateSuccess(null), 5000);
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ── Edit / Reschedule ──
  const startEdit = (c: OpenClassroom, m: 'edit' | 'reschedule') => {
    setEditClassroom(c); setEditMode(m); setEditTitle(c.title);
    setEditError(''); setEditSuccess('');
    if (c.scheduled_at) {
      const d = new Date(c.scheduled_at);
      setEditDate(d.toISOString().split('T')[0]);
      setEditTime(d.toTimeString().slice(0, 5));
    } else { setEditDate(''); setEditTime(''); }
    setEditDuration(c.duration_minutes || 60);
  };

  const handleEditSave = async () => {
    if (!editClassroom) return;
    setEditSaving(true); setEditError(''); setEditSuccess('');
    const action = editMode === 'reschedule' ? 'reschedule' : 'edit';
    const body: Record<string, unknown> = { action, notify: true };
    if (editMode === 'reschedule') {
      if (!editDate || !editTime) { setEditError('Date and time required'); setEditSaving(false); return; }
      body.scheduled_at = new Date(`${editDate}T${editTime}`).toISOString();
      body.duration_minutes = editDuration;
    } else {
      if (!editTitle.trim()) { setEditError('Title required'); setEditSaving(false); return; }
      body.title = editTitle.trim();
      if (editDate && editTime) {
        body.scheduled_at = new Date(`${editDate}T${editTime}`).toISOString();
        body.duration_minutes = editDuration;
      }
    }
    try {
      const res = await fetch(`/api/v1/open-classroom/${editClassroom.host_token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setEditSuccess(action === 'reschedule' ? 'Rescheduled — recipients notified' : 'Updated — recipients notified');
        fetchClassrooms();
        setTimeout(() => { setEditClassroom(null); setEditSuccess(''); }, 2000);
      } else setEditError(data.error || 'Failed');
    } catch { setEditError('Network error'); }
    setEditSaving(false);
  };

  const handleCancel = async (c: OpenClassroom) => {
    if (!confirm(`Cancel "${c.title}"? All shared recipients will be notified.`)) return;
    setCancelling(c.id);
    try {
      const res = await fetch(`/api/v1/open-classroom/${c.host_token}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', notify: true }),
      });
      const data = await res.json();
      if (data.success) fetchClassrooms();
    } catch { /* ignore */ }
    setCancelling(null);
  };

  const handleEnd = async (c: OpenClassroom) => {
    if (!confirm(`End "${c.title}"? LiveKit room will be destroyed.`)) return;
    try {
      await fetch(`/api/v1/open-classroom/${c.host_token}`, { method: 'DELETE' });
      fetchClassrooms();
    } catch { /* ignore */ }
  };

  // ── Stats ──
  const stats = {
    total: classrooms.length,
    active: classrooms.filter(c => c.status === 'live').length,
    participants: classrooms.reduce((n, c) => n + Number(c.participant_count || 0), 0),
    revenue: classrooms.reduce((n, c) => n + Number(c.revenue_paise || 0), 0),
  };

  // ── Detail Screen (full page, early return) ──
  if (detailClassroom) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <button
          onClick={() => setDetailClassroom(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-emerald-900 transition">
          <ChevronLeft className="w-4 h-4" /> Back to Classrooms
        </button>
        <OpenClassroomDetail
          classroomId={detailClassroom.id}
          hostToken={detailClassroom.host_token}
          onClose={() => setDetailClassroom(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary/90 to-secondary p-6 shadow-lg">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-inset ring-white/20">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/40">Public Sessions</div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Open Classroom</h2>
              <p className="text-xs text-white/60 mt-0.5">Host real teaching sessions with public join links</p>
            </div>
          </div>
          <button onClick={fetchClassrooms} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition disabled:opacity-50 self-start sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stats inside hero */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, icon: Video, accent: 'white' },
            { label: 'Live Now', value: stats.active, icon: Radio, accent: 'lime' },
            { label: 'Participants', value: stats.participants, icon: Users, accent: 'white' },
            { label: 'Revenue', value: `₹${(stats.revenue / 100).toLocaleString('en-IN')}`, icon: Wallet, accent: 'amber' },
          ].map(stat => {
            const accents: Record<string, { iconBg: string; iconText: string }> = {
              white:   { iconBg: 'bg-white/15',        iconText: 'text-white' },
              lime:    { iconBg: 'bg-white/15',        iconText: 'text-primary/40' },
              amber:   { iconBg: 'bg-amber-400/20',   iconText: 'text-amber-100' },
            };
            const a = accents[stat.accent];
            return (
              <div key={stat.label} className="rounded-xl bg-white/10 backdrop-blur-sm p-4 ring-1 ring-inset ring-white/15">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">{stat.label}</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-white">{stat.value}</div>
                  </div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.iconBg}`}>
                    <stat.icon className={`h-4 w-4 ${a.iconText}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Templates strip ── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Choose a class template</h3>
          <p className="text-[11px] text-gray-500">Pick a preset to pre-fill duration, capacity &amp; description</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {CLASS_TEMPLATES.map(t => {
            const isActive = activeTemplate === t.id;
            return (
              <button key={t.id} onClick={() => {
                setActiveTemplate(t.id);
                setDuration(t.defaultDuration);
                setMaxParticipants(t.defaultMaxParticipants);
                if (!description.trim() || description === CLASS_TEMPLATES.find(p => p.id === activeTemplate)?.defaultDescription) {
                  setDescription(t.defaultDescription);
                }
                if (t.id === 'demo') {
                  setMode('scheduled');
                }
              }}
                className={`relative overflow-hidden text-left rounded-2xl border p-3.5 transition group before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${t.accent.barBefore} ${isActive ? `border-transparent ring-2 ${t.accent.ring} shadow-md` : 'border-gray-200 bg-white hover:shadow-md'}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.accent.bg} mb-2 group-hover:scale-110 transition`}>
                  <t.icon className={`h-4 w-4 ${t.accent.text}`} />
                </div>
                <h4 className="text-xs font-bold text-gray-800">{t.label}</h4>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{t.desc}</p>
                {isActive && (
                  <span className={`absolute top-2 right-2 inline-flex items-center justify-center h-5 w-5 rounded-full ${t.accent.bg}`}>
                    <Check className={`h-3 w-3 ${t.accent.text}`} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Create Form ── */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800">Create Open Classroom</h3>
            <p className="text-[11px] text-gray-500 truncate">
              Template: <strong className="text-gray-700">{CLASS_TEMPLATES.find(t => t.id === activeTemplate)?.label}</strong> · Configure teacher, subject &amp; schedule
            </p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-5">

          {/* Step 1: Teacher */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Teacher *</label>
            <div className="flex gap-1 mb-3 text-xs">
              <button onClick={() => setTeacherSource('platform')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${teacherSource === 'platform' ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-inset ring-gray-200'}`}>
                Select from platform
              </button>
              <button onClick={() => setTeacherSource('manual')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${teacherSource === 'manual' ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-inset ring-gray-200'}`}>
                Add manually
              </button>
            </div>

            {teacherSource === 'platform' ? (
              <select value={teacherEmail} onChange={e => setTeacherEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Select teacher…</option>
                {teachers.map(t => (
                  <option key={t.email} value={t.email}>
                    {t.full_name} {t.whatsapp ? `(${t.whatsapp})` : `(${t.email})`}
                  </option>
                ))}
              </select>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Name *</label>
                  <input value={manualTeacherName} onChange={e => setManualTeacherName(e.target.value)}
                    placeholder="Teacher name"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-0.5">WhatsApp</label>
                  <input value={manualTeacherWhatsapp} onChange={e => setManualTeacherWhatsapp(e.target.value)}
                    placeholder="+91…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Email *</label>
                  <input value={manualTeacherEmail} onChange={e => setManualTeacherEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-400 mb-0.5 flex items-center gap-1">
                    App Password * <span className="text-amber-500 font-normal">(for Flutter screen-share login)</span>
                  </label>
                  <input type="text" value={manualTeacherPassword} onChange={e => setManualTeacherPassword(e.target.value)}
                    placeholder="Set a login password…"
                    className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-amber-200" />
                </div>
              </div>
              {(manualTeacherEmail.trim() || manualTeacherPassword.trim()) && (
                <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  A temporary portal account (teacher_screen role) will be auto-created. Share the login email + password with the teacher to use in the {platformName} Teacher app.
                </p>
              )}
              </>
            )}
          </div>

          {/* Step 2: Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject *</label>
            <div className="flex gap-2">
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                <option value="">Select subject…</option>
                {['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Accountancy', 'Economics', 'Business Studies'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__custom__">Other (type below)</option>
              </select>
              {subject === '__custom__' && (
                <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Enter subject…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
              )}
            </div>
          </div>

          {/* Step 3: Grade (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Grade / Class <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={grade} onChange={e => setGrade(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 bg-white">
              <option value="">No grade (general / workshop)</option>
              {['1','2','3','4','5','6','7','8','9','10','11','12'].map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>

          {/* Auto-generated title preview */}
          {autoTitle && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 ring-1 ring-inset ring-primary/20 rounded-lg">
              <Video className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-primary">Classroom: <strong>{autoTitle}</strong></span>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the session…" rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
          </div>

          {/* Training Materials (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Training Materials <span className="text-gray-400 font-normal">(optional — available to teacher for exam generation)</span></label>
            <div className="space-y-2">
              {materialFiles.length > 0 && (
                <div className="space-y-1">
                  {materialFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                      <span className="text-[10px] text-gray-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => setMaterialFiles(prev => prev.filter((_, j) => j !== i))} className="p-0.5 rounded hover:bg-red-50">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">Attach files (PDF, PPT, images, etc.)</span>
                <input type="file" multiple className="hidden"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.txt"
                  onChange={e => {
                    if (e.target.files) setMaterialFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-600">Type:</span>
            <div className="inline-flex rounded-lg ring-1 ring-inset ring-gray-200 overflow-hidden text-xs bg-gray-50 p-0.5">
              <button onClick={() => setMode('instant')}
                className={`px-3.5 py-1 rounded-md font-semibold transition ${mode === 'instant' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                Instant
              </button>
              <button onClick={() => setMode('scheduled')}
                className={`px-3.5 py-1 rounded-md font-semibold transition ${mode === 'scheduled' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                Scheduled
              </button>
            </div>
          </div>

          {mode === 'scheduled' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                {unlimitedDuration ? (
                  <div className="flex items-center h-[38px] px-3 text-sm text-primary font-medium">∞ Unlimited</div>
                ) : (
                  <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={15} max={480}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
                )}
              </div>
            </div>
          )}
          {mode === 'instant' && !unlimitedDuration && (
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-500 mb-1">Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={15} max={480}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={unlimitedDuration} onChange={e => setUnlimitedDuration(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary rounded-full transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-xs font-medium text-gray-600">Unlimited Duration</span>
          </label>

          {/* Payment toggle */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className="relative">
                <input type="checkbox" checked={paymentEnabled} onChange={e => setPaymentEnabled(e.target.checked)}
                  className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary rounded-full transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <span className="text-xs font-medium text-gray-600">Paid Entry</span>
            </label>
            {paymentEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">₹</span>
                <input type="number" value={priceRupees} onChange={e => setPriceRupees(e.target.value)}
                  placeholder="0" min={1}
                  className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
                <span className="text-xs text-gray-400">per participant</span>
              </div>
            )}
          </div>

          {/* Max participants */}
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Participants</label>
            <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(Number(e.target.value))} min={1} max={500}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Auto-approve toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={!autoApproveJoins} onChange={e => setAutoApproveJoins(!e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-amber-500 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
            </div>
            <span className="text-xs font-medium text-gray-600">Require join approval</span>
          </label>

          <button onClick={handleCreate} disabled={creating || !canCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 text-sm font-semibold transition shadow-md hover:shadow-lg">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create & Send Host Link
          </button>
          {createSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 ring-1 ring-inset ring-primary/20 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-medium text-primary">{createSuccess}</p>
            </div>
          )}
          {tempCredentials && (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                Teacher App Login Credentials
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg px-3 py-2 border border-amber-200">
                  <p className="text-gray-400 font-medium mb-0.5">Login Email</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-amber-800 break-all">{tempCredentials.email}</span>
                    <button onClick={() => copyToClipboard(tempCredentials.email, 'temp-email')}
                      className="shrink-0 text-amber-500 hover:text-amber-700 transition">
                      {copiedField === 'temp-email' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-amber-200">
                  <p className="text-gray-400 font-medium mb-0.5">Password</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-amber-800">{tempCredentials.password}</span>
                    <button onClick={() => copyToClipboard(tempCredentials.password, 'temp-pass')}
                      className="shrink-0 text-amber-500 hover:text-amber-700 transition">
                      {copiedField === 'temp-pass' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-amber-600">Share these credentials with the teacher. They log in to the <strong>{platformName} Teacher</strong> app and join the class for screen sharing.</p>
              <button onClick={() => setTempCredentials(null)} className="text-[11px] text-amber-400 hover:text-amber-600 transition">Dismiss</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Share Panel (overlay) ── */}
      {shareClassroom && (
        <SharePanel
          classroom={shareClassroom}
          onClose={() => setShareClassroom(null)}
          baseUrl={baseUrl}
          copiedField={copiedField}
          copyToClipboard={copyToClipboard}
        />
      )}

      {/* ── Edit Panel (overlay) ── */}
      {editClassroom && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-amber-500">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                {editMode === 'reschedule' ? <CalendarClock className="h-4 w-4 text-amber-600" /> : <Pencil className="h-4 w-4 text-amber-600" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  {editMode === 'reschedule' ? 'Reschedule' : 'Edit'} Classroom
                </h3>
                <p className="text-[11px] text-gray-500 truncate max-w-md">{editClassroom.title}</p>
              </div>
            </div>
            <button onClick={() => setEditClassroom(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="px-5 py-5 space-y-4">
            {editMode === 'edit' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Time</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Duration (min)</label>
                <input type="number" value={editDuration} onChange={e => setEditDuration(Number(e.target.value))} min={15}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 ring-1 ring-inset ring-rose-200 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                <p className="text-xs font-medium text-rose-700">{editError}</p>
              </div>
            )}
            {editSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 ring-1 ring-inset ring-primary/20 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-medium text-primary">{editSuccess}</p>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleEditSave} disabled={editSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 transition shadow-sm">
                {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {editSaving ? 'Saving…' : 'Save & Notify'}
              </button>
              <button onClick={() => setEditClassroom(null)} className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Classroom List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <Video className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No open classrooms yet</p>
          <p className="text-xs text-gray-500 mt-1">Create one above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classrooms.map(c => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE.created;
            const isActive = c.status === 'created' || c.status === 'live';
            const hostLink = c.host_link || `${baseUrl}/open-classroom/${c.host_token}`;
            const joinLink = c.join_link || `${baseUrl}/open-classroom/${c.join_token}`;
            const accentBar = c.status === 'live' ? 'before:bg-primary'
              : c.status === 'scheduled' ? 'before:bg-amber-500'
              : c.status === 'cancelled' ? 'before:bg-rose-500'
              : c.status === 'ended' ? 'before:bg-slate-300'
              : 'before:bg-blue-500';

            return (
              <div key={c.id} className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accentBar}`}>
                <div className="p-5 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setDetailClassroom(c)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-900 tracking-tight">{c.title}</h4>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-0.5 ${st.bg}`}>
                          {st.dot && <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />}
                          {st.label}
                        </span>
                        {c.payment_enabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 rounded-md px-2 py-0.5">
                            <Wallet className="h-3 w-3" /> ₹{(c.price_paise / 100).toFixed(0)}/person
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-semibold bg-primary/5 text-primary ring-1 ring-inset ring-primary/20 rounded-md px-2 py-0.5">
                            Free
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 mt-2">
                        {c.teacher_name && (
                          <span className="inline-flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium text-gray-600">{c.teacher_name}</span>
                          </span>
                        )}
                        {c.scheduled_at && (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {new Date(c.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                            {' · '}
                            {new Date(c.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {c.duration_minutes ? `${c.duration_minutes} min` : 'Unlimited'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {c.participant_count}
                        </span>
                        {c.payment_enabled && c.revenue_paise > 0 && (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                            <Wallet className="h-3.5 w-3.5" />
                            ₹{(c.revenue_paise / 100).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Copy Teacher Link */}
                    <button onClick={() => copyToClipboard(hostLink, `host-${c.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition">
                      {copiedField === `host-${c.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Teacher Link
                    </button>

                    {/* Copy Join Link */}
                    <button onClick={() => copyToClipboard(joinLink, `join-${c.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition">
                      {copiedField === `join-${c.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Join Link
                    </button>

                    {/* Share */}
                    <button onClick={() => setShareClassroom(c)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 ring-1 ring-inset ring-primary/20 rounded-lg px-2.5 py-1.5 hover:bg-primary/10 transition">
                      <Send className="w-3 h-3" /> Share
                    </button>

                    {/* Join as host */}
                    {isActive && (
                      <a href={hostLink} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-br from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 rounded-lg px-2.5 py-1.5 transition shadow-sm">
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                    )}

                    {/* View Details */}
                    <button onClick={() => setDetailClassroom(c)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 ring-1 ring-inset ring-violet-200 rounded-lg px-2.5 py-1.5 hover:bg-violet-100 transition">
                      <Eye className="w-3 h-3" /> Details
                    </button>

                    {isActive && (
                      <>
                        <button onClick={() => startEdit(c, 'edit')}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 ring-1 ring-inset ring-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        {c.classroom_type === 'scheduled' && c.status !== 'live' && (
                          <button onClick={() => startEdit(c, 'reschedule')}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition">
                            <CalendarClock className="w-3 h-3" /> Reschedule
                          </button>
                        )}
                        {c.status === 'live' && (
                          <button onClick={() => handleEnd(c)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-200 rounded-lg px-2.5 py-1.5 hover:bg-rose-100 transition">
                            <Ban className="w-3 h-3" /> End
                          </button>
                        )}
                        {c.status !== 'live' && (
                          <button onClick={() => handleCancel(c)} disabled={cancelling === c.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 ring-1 ring-inset ring-rose-200 rounded-lg px-2.5 py-1.5 hover:bg-rose-100 transition disabled:opacity-50">
                            <Ban className="w-3 h-3" /> {cancelling === c.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        )}
                      </>
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

/* ═══════════════════════════════════════════════════════════════
   Share Panel — WhatsApp bulk send
   ═══════════════════════════════════════════════════════════════ */

function SharePanel({
  classroom, onClose, baseUrl, copiedField, copyToClipboard,
}: {
  classroom: OpenClassroom;
  onClose: () => void;
  baseUrl: string;
  copiedField: string | null;
  copyToClipboard: (text: string, field: string) => void;
}) {
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ sent: number; failed: number } | null>(null);
  const [userType, setUserType] = useState<string>('students');
  const [batchId, setBatchId] = useState('');
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualList, setManualList] = useState<Array<{ name: string; phone: string }>>([]);

  const joinLink = classroom.join_link || `${baseUrl}/open-classroom/${classroom.join_token}`;

  const fetchUsers = useCallback(async (type: string, bId?: string) => {
    try {
      let url = `/api/v1/conference/users?type=${type}`;
      if (bId) url += `&batch_id=${bId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/conference/users?type=batches');
      const data = await res.json();
      if (data.success) setBatches(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchBatches(); fetchUsers('students'); }, [fetchBatches, fetchUsers]);

  useEffect(() => {
    if (userType === 'batch' && batchId) fetchUsers('batch', batchId);
    else if (userType !== 'batch') fetchUsers(userType);
  }, [userType, batchId, fetchUsers]);

  const toggleSelect = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
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

    // Selected platform users
    for (const email of selected) {
      const u = users.find(u => u.email === email);
      if (u?.whatsapp) recipients.push({ name: u.name, phone: u.whatsapp, email: u.email });
    }
    // Manual entries
    for (const m of manualList) {
      recipients.push({ name: m.name, phone: m.phone });
    }

    if (recipients.length === 0) return;
    setSending(true); setResults(null);

    try {
      const res = await fetch('/api/v1/open-classroom/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroom_id: classroom.id, recipients }),
      });
      const data = await res.json();
      if (data.success) setResults({ sent: data.data.sent, failed: data.data.failed });
    } catch { /* ignore */ }
    setSending(false);
  };

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5">
            <Send className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Share Classroom</h3>
            <p className="text-[11px] text-gray-500 truncate max-w-md">{classroom.title}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Copy link */}
        <div className="flex items-center gap-2">
          <input readOnly value={joinLink} className="flex-1 min-w-0 text-xs text-slate-600 bg-slate-50 ring-1 ring-inset ring-slate-200 rounded-lg px-3 py-2 outline-none" />
          <button onClick={() => copyToClipboard(joinLink, 'share-link')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 ring-1 ring-inset ring-primary/20 rounded-lg px-3 py-2 hover:bg-primary/10 transition">
            {copiedField === 'share-link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy
          </button>
        </div>

        {/* User type tabs */}
        <div className="flex gap-1 text-xs">
          {(['students', 'parents', 'staff', 'batch'] as const).map(t => (
            <button key={t} onClick={() => { setUserType(t); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition capitalize ${userType === t ? 'bg-primary text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-inset ring-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {userType === 'batch' && (
          <select value={batchId} onChange={e => setBatchId(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Select batch…</option>
            {batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.batch_name} ({b.student_count})</option>)}
          </select>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        {/* User list */}
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
          {filtered.length > 0 && (
            <button onClick={selectAll} className="w-full text-left px-3 py-2 text-xs text-primary font-medium hover:bg-primary/5">
              {filtered.every(u => selected.has(u.email)) ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {filtered.map(u => (
            <label key={u.email} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(u.email)} onChange={() => toggleSelect(u.email)}
                className="rounded border-gray-300 text-primary focus:ring-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{u.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
              </div>
              <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 border ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {ROLE_LABELS[u.role] || u.role}
              </span>
              {u.whatsapp ? (
                <Phone className="w-3 h-3 text-green-500 shrink-0" />
              ) : (
                <Phone className="w-3 h-3 text-gray-300 shrink-0" />
              )}
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No users found</p>
          )}
        </div>

        {/* Manual entry */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Add external recipients:</p>
          <div className="flex gap-2">
            <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Name"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none" />
            <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="+91…"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none" />
            <button onClick={addManual} className="text-xs text-primary font-medium hover:underline px-2">
              <UserPlus className="w-4 h-4" />
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

        {/* Send button */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {selected.size + manualList.length} recipient{(selected.size + manualList.length) !== 1 ? 's' : ''}
          </span>
          <button onClick={handleSend} disabled={sending || (selected.size + manualList.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-green-700 text-white px-4 py-2 text-xs font-medium disabled:opacity-50 transition">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send WhatsApp
          </button>
        </div>

        {results && (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-gray-600">Sent: {results.sent}</span>
            {results.failed > 0 && (
              <span className="text-red-500">Failed: {results.failed}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
