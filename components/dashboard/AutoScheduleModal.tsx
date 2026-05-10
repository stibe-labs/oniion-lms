// ═══════════════════════════════════════════════════════════════
// Auto-Schedule from Calendar — Wizard modal (batch-wizard style)
// Used in AO Dashboard to bulk-create sessions from academic calendar
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Button, FormField,
  useToast, Badge,
} from '@/components/dashboard/shared';
import {
  CalendarDays, ChevronRight, ChevronLeft, CheckCircle2,
  AlertTriangle, Loader2, Sparkles, Clock, BookOpen,
  Eye, X, Check, FileText, Star, Globe,
  CreditCard, ShieldCheck, CircleDollarSign, UserCheck,
} from 'lucide-react';
import {
  istToRegionTime, groupStudentsByTimezone,
  REGION_FLAGS, REGION_TZ_LABELS,
} from '@/lib/region-timezone';

// ── Types ───────────────────────────────────────────────────
interface AcademicCalendar {
  id: string;
  academic_year: string;
  region: string;
  grade: string;
  board: string;
  category: string;
  start_date: string;
  end_date: string;
  total_sessions: number;
  summary: Record<string, number>;
}

interface PreviewData {
  total_sessions: number;
  per_subject: Record<string, number>;
  date_range: { start: string; end: string } | null;
  conflicts: { type: string; date: string; message: string }[];
  calendar: { region: string; grade: string; board: string; category: string };
  sessions: {
    date: string; day: string; time: string;
    subject: string; topic: string | null;
    session_type: string; teacher_email: string | null;
  }[];
}

interface BatchTeacher {
  teacher_email: string;
  teacher_name: string | null;
  subject: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  batchId: string;
  batchGrade: string;
  batchBoard: string | null;
  batchTeachers: BatchTeacher[];
  batchSubjects?: string[];
  batchType?: string;
  onComplete: (scheduleGroupId: string) => void;
}

// Builds a day→subject map from the batch's actual subjects.
// Subjects are spread across Mon–Fri (cycling if fewer than 5); Sat = 'Special Class'.
function buildDaySubjectMap(subjects: string[]): Record<string, string> {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const map: Record<string, string> = {};
  if (subjects.length === 0) {
    // fallback to legacy hardcoded map if no subjects info available
    return { Mon: 'Physics', Tue: 'Biology', Wed: 'Mathematics', Thu: 'Mathematics', Fri: 'Chemistry', Sat: 'Special Class' };
  }
  weekdays.forEach((day, i) => {
    map[day] = subjects[i % subjects.length];
  });
  map['Sat'] = 'Special Class';
  return map;
}

const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 24h values for storage, 12h labels for display
const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00',
];

function to12h(t24: string): string {
  const [hh, mm] = t24.split(':').map(Number);
  const p = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${p}`;
}

type WizardStep = 'calendar' | 'configure' | 'preview' | 'done';

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'calendar', label: 'Select Calendar' },
  { key: 'configure', label: 'Configure' },
  { key: 'preview', label: 'Preview' },
  { key: 'done', label: 'Done' },
];

export default function AutoScheduleModal({
  open, onClose, batchId, batchGrade, batchBoard, batchTeachers, batchSubjects = [], batchType, onComplete,
}: Props) {
  // Group batches have enrollment invoices — no per-session invoice generation needed
  const isPerClassBatch = !batchType || batchType === 'one_to_one' || batchType === 'one_to_three';
  // Derived subjects: prefer explicit batchSubjects, fall back to unique subjects from batchTeachers
  const effectiveSubjects = batchSubjects.length > 0
    ? batchSubjects
    : [...new Set(batchTeachers.map(t => t.subject).filter(Boolean))];
  const DAY_SUBJECT_MAP = buildDaySubjectMap(effectiveSubjects);
  const toast = useToast();

  const [wizardStep, setWizardStep] = useState<WizardStep>('calendar');
  const [calendars, setCalendars] = useState<AcademicCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<AcademicCalendar | null>(null);
  const [recommendedCategory, setRecommendedCategory] = useState<string | null>(null);
  const [studentRegions, setStudentRegions] = useState<string[]>([]);

  // Step 2: Configuration
  const [timeSlots, setTimeSlots] = useState<Record<string, string>>({
    Mon: '16:00', Tue: '16:00', Wed: '16:00', Thu: '16:00', Fri: '16:00', Sat: '10:00',
  });
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  // Per-day subject overrides — editable in configure step
  const [daySubjectOverrides, setDaySubjectOverrides] = useState<Record<string, string>>({});
  const [includeSpecial, setIncludeSpecial] = useState(true);
  const [includeNewBatch, setIncludeNewBatch] = useState(false);
  const [includeExam, setIncludeExam] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default to tomorrow
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>('');

  // Step 3: Preview
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 4: Creation
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{
    schedule_group_id: string; sessions_created: number; per_subject: Record<string, number>;
  } | null>(null);

  // Step 4b: Credit check preview
  const [creditCheck, setCreditCheck] = useState<{
    students: Array<{
      student_email: string; student_name: string; has_enrollment: boolean;
      credits_available: number; sessions_scheduled: number; sessions_covered: number;
      sessions_billable: number; billable_amount_paise: number; per_session_rate_paise: number;
      currency: string; status: 'fully_covered' | 'partially_covered' | 'no_credits' | 'no_rate';
    }>;
    summary: {
      total_students: number; fully_covered: number; partially_covered: number;
      no_credits: number; no_rate: number; total_sessions: number;
      total_billable_paise: number; currency: string; formatted_billable: string;
    };
  } | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{
    invoices_created: number; invoices_skipped: number; credits_covered: number;
    session_count: number; message: string;
  } | null>(null);
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);

  const stepIdx = WIZARD_STEPS.findIndex(s => s.key === wizardStep);

  // Fetch matching calendars on mount
  useEffect(() => {
    if (!open) return;
    setWizardStep('calendar');
    setSelectedCalendar(null);
    setPreview(null);
    setResult(null);

    const fetchCalendars = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/academic-calendars?batch_id=${batchId}`);
        const data = await res.json();
        if (data.success) {
          setCalendars(data.data);
          setRecommendedCategory(data.recommended_category || null);
          setStudentRegions(data.student_regions || []);
        } else toast.error(data.error || 'Failed to load calendars');
      } catch { toast.error('Network error'); }
      setLoading(false);
    };
    fetchCalendars();
  }, [open, batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill teacher map from batch teachers
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const t of batchTeachers) {
      if (t.subject && t.teacher_email && !map[t.subject]) {
        map[t.subject] = t.teacher_email;
      }
    }
    setTeacherMap(map);
  }, [batchTeachers]);

  // Auto-fetch credit check when sessions are created
  useEffect(() => {
    if (!result) return;
    setCreditCheck(null);
    setInvoiceResult(null);
    setCreditLoading(true);
    fetch(`/api/v1/batch-sessions/credit-check?schedule_group_id=${result.schedule_group_id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setCreditCheck(json.data);
      })
      .catch(() => {})
      .finally(() => setCreditLoading(false));
  }, [result]);

  // Unique teachers for dropdown
  const uniqueTeachers = useMemo(() => {
    const seen = new Set<string>();
    return batchTeachers.filter(t => {
      if (seen.has(t.teacher_email)) return false;
      seen.add(t.teacher_email);
      return true;
    });
  }, [batchTeachers]);

  // Group calendars by region
  const calendarsByRegion = useMemo(() => {
    const groups: Record<string, AcademicCalendar[]> = {};
    for (const c of calendars) {
      const key = `${c.region} — Grade ${c.grade} ${c.board}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [calendars]);

  // Student timezone groups (for GCC display)
  const tzGroups = useMemo(() => groupStudentsByTimezone(studentRegions), [studentRegions]);
  // Non-IST timezone groups for showing regional times
  const nonIstGroups = useMemo(() => tzGroups.filter(g => g.tzLabel !== 'IST'), [tzGroups]);

  // ── Fetch preview (dry_run) ───────────────────────────────
  const fetchPreview = async () => {
    if (!selectedCalendar) return;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/v1/academic-calendars/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: selectedCalendar.id,
          batch_id: batchId,
          time_slots: timeSlots,
          teacher_map: teacherMap,
          day_subject_map: { ...DAY_SUBJECT_MAP, ...daySubjectOverrides },
          include_special_classes: includeSpecial,
          include_new_batch: includeNewBatch,
          include_exam_special: includeExam,
          duration_minutes: durationMinutes,
          start_date: startDate,
          end_date: endDate || undefined,
          dry_run: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.data.preview);
        setWizardStep('preview');
      } else {
        toast.error(data.error || 'Preview failed');
      }
    } catch { toast.error('Network error'); }
    setPreviewLoading(false);
  };

  // ── Create sessions ───────────────────────────────────────
  const createSessions = async () => {
    if (!selectedCalendar) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/academic-calendars/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: selectedCalendar.id,
          batch_id: batchId,
          time_slots: timeSlots,
          teacher_map: teacherMap,
          day_subject_map: { ...DAY_SUBJECT_MAP, ...daySubjectOverrides },
          include_special_classes: includeSpecial,
          include_new_batch: includeNewBatch,
          include_exam_special: includeExam,
          duration_minutes: durationMinutes,
          start_date: startDate,
          end_date: endDate || undefined,
          dry_run: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setWizardStep('done');
        toast.success(`${data.data.sessions_created} sessions created!`);
      } else {
        toast.error(data.error || 'Failed to create sessions');
      }
    } catch { toast.error('Network error'); }
    setCreating(false);
  };

  // ── Helpers ───────────────────────────────────────────────
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const subjectLabel: Record<string, string> = { PHY: 'Physics', CHE: 'Chemistry', BIO: 'Biology', MATH: 'Mathematics' };

  const canGoNext = (): boolean => {
    if (wizardStep === 'calendar') return !!selectedCalendar;
    if (wizardStep === 'configure') return !!startDate && (!endDate || endDate >= startDate);
    return false;
  };

  const goNext = () => {
    if (wizardStep === 'calendar') setWizardStep('configure');
    else if (wizardStep === 'configure') fetchPreview();
  };

  const goPrev = () => {
    if (wizardStep === 'configure') setWizardStep('calendar');
    else if (wizardStep === 'preview') setWizardStep('configure');
  };

  const closeWizard = () => {
    if (wizardStep === 'done' && result) {
      onComplete(result.schedule_group_id);
    }
    onClose();
  };

  if (!open) return null;

  // ── Step renderers ────────────────────────────────────────

  const renderCalendarStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Select Academic Calendar</h3>
      <p className="text-gray-500 mb-8">Choose the calendar that matches this batch&apos;s curriculum</p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
          <span className="text-sm text-gray-500">Loading calendars...</span>
        </div>
      ) : calendars.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No matching calendars found</p>
          <p className="text-xs text-gray-400 mt-1">No calendars available for Grade {batchGrade} {batchBoard || ''}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(calendarsByRegion).map(([groupLabel, cals]) => (
            <div key={groupLabel}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{groupLabel}</h4>
              <div className="space-y-2">
                {cals.map(cal => {
                  const isSelected = selectedCalendar?.id === cal.id;
                  const isRecommended = recommendedCategory === cal.category;
                  return (
                    <button
                      key={cal.id}
                      onClick={() => setSelectedCalendar(cal)}
                      className={`relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-primary/10 shadow-md ring-2 ring-primary/20'
                          : isRecommended
                            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400 hover:bg-amber-50/50 ring-1 ring-amber-200'
                            : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-primary/5/30'
                      }`}
                    >
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        {isRecommended && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Recommended
                          </span>
                        )}
                        {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-primary text-white'
                              : cal.category.includes('Excellent') ? 'bg-violet-100 text-violet-600'
                              : cal.category.includes('Good') ? 'bg-blue-100 text-blue-600'
                              : cal.category.includes('Average') ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            <CalendarDays className="h-5 w-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{cal.category}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              cal.category.includes('Excellent') ? 'bg-violet-100 text-violet-700'
                              : cal.category.includes('Good') ? 'bg-blue-100 text-blue-700'
                              : cal.category.includes('Average') ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>
                              {cal.category.includes('Excellent') ? 'Cat A' : cal.category.includes('Good') ? 'Cat B' : cal.category.includes('Average') ? 'Cat C' : ''}
                            </span>
                            <span className="text-xs text-gray-400">{cal.academic_year}</span>
                          </div>
                        </div>
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isSelected ? 'bg-primary/20 text-primary' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {cal.total_sessions} sessions
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 pl-13">
                        {Object.entries(cal.summary)
                          .filter(([k]) => k !== 'TOTAL')
                          .map(([k, v]) => (
                            <span key={k} className={`text-xs px-2 py-1 rounded-lg ${
                              isSelected ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-500'
                            }`}>
                              {subjectLabel[k] || k}: <span className="font-semibold">{v}</span>
                            </span>
                          ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderConfigureStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Configure Schedule</h3>
      <p className="text-gray-500 mb-6">Set time slots (IST), assign teachers, and choose what to include</p>

      {/* Student timezone badge */}
      {tzGroups.length > 0 && (
        <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Student Timezones</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tzGroups.map(g => (
              <span key={g.region} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-blue-200 text-blue-700">
                {g.flag} {g.region} <span className="text-blue-400">({g.tzLabel})</span> <span className="font-bold">{g.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Batch Start Date */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Schedule Period</label>
        <p className="text-xs text-gray-400 mb-3">Topics will be assigned in calendar sequence within this date range. Leave end date empty to schedule all topics.</p>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setStartDate(e.target.value)}
              className="text-sm border-2 border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>
          <span className="text-gray-400 mt-5">→</span>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date <span className="text-gray-300">(optional)</span></label>
            <input
              type="date"
              value={endDate}
              min={startDate || new Date().toISOString().slice(0, 10)}
              onChange={e => setEndDate(e.target.value)}
              className={`text-sm border-2 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary transition-all ${
                endDate && endDate < startDate ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {endDate && endDate < startDate && (
              <p className="text-xs text-red-500 mt-1">End date must be after start date</p>
            )}
          </div>
          {endDate && (
            <button
              type="button"
              onClick={() => setEndDate('')}
              className="mt-5 text-xs text-gray-400 hover:text-gray-600"
            >Clear</button>
          )}
        </div>
      </div>

      {/* Day → Subject → Time → Teacher cards */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Day-wise Schedule</label>
        <p className="text-xs text-gray-400 mb-3">Times are in IST{nonIstGroups.length > 0 ? ` — regional times shown for ${nonIstGroups.map(g => g.tzLabel).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` : ''}</p>
        <div className="space-y-2">
          {DAYS_ORDER.map(day => {
            const subject = daySubjectOverrides[day] ?? DAY_SUBJECT_MAP[day];
            const hasTeacher = !!teacherMap[subject];
            const istTime = timeSlots[day] || '16:00';
            const subjectOptions = [...effectiveSubjects, 'Special Class'].filter((v, i, a) => a.indexOf(v) === i);
            return (
              <div key={day} className={`rounded-xl px-5 py-4 border-2 transition-all ${
                hasTeacher ? 'border-primary/20 bg-primary/5/50' : 'border-gray-200 bg-gray-50/50'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    hasTeacher ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-16">
                    <span className="text-sm font-bold text-gray-800">{day}</span>
                  </div>
                  <div className="w-36 shrink-0">
                    <select
                      value={subject}
                      onChange={e => {
                        const newSubj = e.target.value;
                        setDaySubjectOverrides(prev => ({ ...prev, [day]: newSubj }));
                        // Pre-fill teacher for new subject if available
                        const teacher = batchTeachers.find(t => t.subject === newSubj);
                        if (teacher) setTeacherMap(prev => ({ ...prev, [newSubj]: teacher.teacher_email }));
                      }}
                      className="w-full text-sm border-2 border-indigo-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
                    >
                      {subjectOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-36 shrink-0">
                    <select
                      value={istTime}
                      onChange={e => setTimeSlots(prev => ({ ...prev, [day]: e.target.value }))}
                      className="w-full text-sm border-2 border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t} value={t}>{to12h(t)} IST</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <select
                      value={teacherMap[subject] || ''}
                      onChange={e => setTeacherMap(prev => ({ ...prev, [subject]: e.target.value }))}
                      className="w-full text-sm border-2 border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="">Select Teacher…</option>
                      {uniqueTeachers.map(t => (
                        <option key={t.teacher_email} value={t.teacher_email}>
                          {t.teacher_name || t.teacher_email}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasTeacher && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                </div>
                {/* GCC / regional times */}
                {nonIstGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-14">
                    {nonIstGroups
                      .filter((g, i, a) => a.findIndex(x => x.tzLabel === g.tzLabel) === i)
                      .map(g => (
                        <span key={g.tzLabel} className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-0.5">
                          {g.flag} {istToRegionTime(istTime, g.region)} {g.tzLabel}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Options</label>
        <div className="space-y-3">
          {[
            { checked: includeSpecial, onChange: (v: boolean) => setIncludeSpecial(v), label: 'Include Saturday Special Classes', hint: 'Exam reviews & extra sessions' },
            { checked: includeNewBatch, onChange: (v: boolean) => setIncludeNewBatch(v), label: 'Include New Batch / Revision Phase', hint: '' },
            { checked: includeExam, onChange: (v: boolean) => setIncludeExam(v), label: 'Include February Exam Phase', hint: '' },
          ].map((opt, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={opt.checked}
                onChange={e => opt.onChange(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-300 text-primary focus:ring-primary transition-all"
              />
              <div>
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                {opt.hint && <span className="text-xs text-gray-400 ml-2">{opt.hint}</span>}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="mb-6">
        <FormField label="Session Duration">
          <div className="flex gap-2">
            {[60, 75, 90, 120].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMinutes(d)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all duration-150 ${
                  durationMinutes === d
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:bg-primary/5/50'
                }`}
              >
                {durationMinutes === d && <Check className="h-3.5 w-3.5 inline mr-1.5" />}
                {d} min
              </button>
            ))}
          </div>
        </FormField>
      </div>

      {/* Calendar info badge */}
      {selectedCalendar && (
        <div className="bg-linear-to-r from-primary/5 to-secondary/5 rounded-xl p-4 border border-primary/15">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{selectedCalendar.category}</span>
            <span className="text-xs text-primary">— {selectedCalendar.total_sessions} subject sessions</span>
          </div>
          <p className="text-xs text-primary mt-1">
            {fmtDate(selectedCalendar.start_date)} → {fmtDate(selectedCalendar.end_date)}
          </p>
        </div>
      )}
    </div>
  );

  const renderPreviewStep = () => {
    if (!preview) return null;
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Review & Create</h3>
        <p className="text-gray-500 mb-6">Confirm the schedule before creating {preview.total_sessions} sessions</p>

        {/* Summary card */}
        <div className="bg-linear-to-r from-primary/5 to-secondary/5 rounded-xl p-5 border border-primary/15 mb-6">
          <h4 className="text-sm font-bold text-primary mb-4">Schedule Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">Calendar:</span> <span className="font-medium text-gray-800">{selectedCalendar?.category}</span></div>
            <div><span className="text-gray-400">Total Sessions:</span> <span className="font-medium text-gray-800">{preview.total_sessions}</span></div>
            <div>
              <span className="text-gray-400">Schedule From:</span>{' '}
              <span className="font-medium text-gray-800">{startDate ? fmtDate(startDate) : '—'}</span>
            </div>
            <div>
              <span className="text-gray-400">Schedule Until:</span>{' '}
              <span className="font-medium text-gray-800">{endDate ? fmtDate(endDate) : 'All topics'}</span>
            </div>
            {preview.date_range && (
              <>
                <div><span className="text-gray-400">First Session:</span> <span className="font-medium text-primary">{fmtDate(preview.date_range.start)}</span></div>
                <div><span className="text-gray-400">Last Session:</span> <span className="font-medium text-primary">{fmtDate(preview.date_range.end)}</span></div>
              </>
            )}
            <div><span className="text-gray-400">Duration:</span> <span className="font-medium text-gray-800">{durationMinutes} min per session</span></div>
          </div>
          {/* Regional timetable summary */}
          {nonIstGroups.length > 0 && (
            <div className="mt-4 pt-3 border-t border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Regional Timetable</span>
              </div>
              <div className="space-y-1">
                {DAYS_ORDER.map(day => {
                  const istTime = timeSlots[day] || '16:00';
                  const uniqueTzs = nonIstGroups.filter((g, i, a) => a.findIndex(x => x.tzLabel === g.tzLabel) === i);
                  return (
                    <div key={day} className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-primary w-8">{day}</span>
                      <span className="text-primary">{to12h(istTime)} IST</span>
                      {uniqueTzs.map(g => (
                        <span key={g.tzLabel} className="text-blue-600">{g.flag} {istToRegionTime(istTime, g.region)} {g.tzLabel}</span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Per-subject breakdown */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subjects ({Object.keys(preview.per_subject).length})</h4>
          <div className="space-y-2">
            {Object.entries(preview.per_subject).map(([subj, count]) => {
              const teacher = teacherMap[subj];
              const teacherData = uniqueTeachers.find(t => t.teacher_email === teacher);
              return (
                <div key={subj} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    teacherData ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-gray-700 min-w-28">{subj}</span>
                  <Badge label={`${count} sessions`} variant="info" />
                  <span className="text-gray-300">→</span>
                  {teacherData ? (
                    <span className="text-primary">{teacherData.teacher_name || teacherData.teacher_email}</span>
                  ) : (
                    <span className="text-amber-500 italic">No teacher assigned</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Conflicts */}
        {preview.conflicts.length > 0 && (
          <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">{preview.conflicts.length} Conflict{preview.conflicts.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1">
              {preview.conflicts.slice(0, 5).map((c, i) => (
                <p key={i} className="text-xs text-amber-700">{c.message}</p>
              ))}
              {preview.conflicts.length > 5 && (
                <p className="text-xs text-amber-500">...and {preview.conflicts.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Session preview table */}
        <SessionPreviewList sessions={preview.sessions} nonIstGroups={nonIstGroups} />
      </div>
    );
  };

  const renderDoneStep = () => {
    if (!result) return null;

    const handleGenerateInvoices = async () => {
      setInvoiceGenerating(true);
      try {
        const res = await fetch('/api/v1/batch-sessions/finalize-invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule_group_id: result.schedule_group_id }),
        });
        const data = await res.json();
        if (data.success) {
          setInvoiceResult({ ...data.data, message: data.message });
          toast.success(data.message || 'Invoices generated');
          onComplete(result.schedule_group_id);
        } else {
          toast.error(data.error || 'Invoice generation failed');
        }
      } catch { toast.error('Network error'); }
      setInvoiceGenerating(false);
    };

    const money = (paise: number, cur = 'INR') => {
      const amt = paise / 100;
      return cur === 'INR' ? `₹${amt.toLocaleString('en-IN')}` : `${amt.toLocaleString()} ${cur}`;
    };

    return (
      <div className="py-4 space-y-6">
        {/* ── Success header ── */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{result.sessions_created} Sessions Created</h3>
          <p className="text-xs text-gray-400 mt-1">
            Group: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{result.schedule_group_id}</code>
          </p>
        </div>

        {/* ── Per-subject grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-xl mx-auto">
          {Object.entries(result.per_subject).map(([subj, count]) => (
            <div key={subj} className="rounded-lg bg-primary/5 border border-primary/20 px-2 py-2 text-center">
              <p className="text-[9px] font-semibold text-primary uppercase tracking-wide truncate">{subj}</p>
              <p className="text-xl font-bold text-primary">{count}</p>
            </div>
          ))}
        </div>

        {/* ── Credit check / payment preview ── */}
        {creditLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking student prepaid credits…
          </div>
        )}

        {creditCheck && !invoiceResult && (
          <div className="space-y-3">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-center">
                <ShieldCheck className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-primary">{creditCheck.summary.fully_covered}</p>
                <p className="text-[9px] text-primary font-medium">Fully Prepaid</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-center">
                <CreditCard className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-700">{creditCheck.summary.partially_covered}</p>
                <p className="text-[9px] text-amber-600 font-medium">Partial Credits</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-center">
                <CircleDollarSign className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-600">{creditCheck.summary.no_credits}</p>
                <p className="text-[9px] text-red-500 font-medium">No Credits</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-center">
                <CircleDollarSign className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-700">
                  {creditCheck.summary.total_billable_paise > 0
                    ? creditCheck.summary.formatted_billable
                    : '₹0'}
                </p>
                <p className="text-[9px] text-blue-600 font-medium">Total Billable</p>
              </div>
            </div>

            {/* Student table */}
            {creditCheck.students.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Student</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Credits</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Covered</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Billable</th>
                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Amount</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {creditCheck.students.map(s => (
                      <tr key={s.student_email} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <p className="font-medium text-gray-800 truncate max-w-[140px]">{s.student_name}</p>
                        </td>
                        <td className="px-3 py-1.5 text-center text-gray-600">{s.credits_available}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={s.sessions_covered > 0 ? 'text-primary font-medium' : 'text-gray-400'}>
                            {s.sessions_covered}/{s.sessions_scheduled}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={s.sessions_billable > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                            {s.sessions_billable}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          {s.billable_amount_paise > 0
                            ? <span className="text-amber-700">{money(s.billable_amount_paise, s.currency)}</span>
                            : <span className="text-primary">₹0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {s.status === 'fully_covered' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              <ShieldCheck className="h-2.5 w-2.5" /> Prepaid
                            </span>
                          )}
                          {s.status === 'partially_covered' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                              <CreditCard className="h-2.5 w-2.5" /> Partial
                            </span>
                          )}
                          {s.status === 'no_credits' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="h-2.5 w-2.5" /> No Credits
                            </span>
                          )}
                          {s.status === 'no_rate' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              No Rate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Warning for students without credits */}
            {creditCheck.summary.no_credits > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold">{creditCheck.summary.no_credits} student{creditCheck.summary.no_credits > 1 ? 's have' : ' has'} no prepaid credits</p>
                  <p className="mt-0.5 text-amber-700">Invoice{creditCheck.summary.no_credits > 1 ? 's' : ''} will be generated for the full session amount. Students can pay via the payment link sent by email.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Invoice result ── */}
        {invoiceResult && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center space-y-2">
            <UserCheck className="h-6 w-6 text-blue-600 mx-auto" />
            <p className="text-sm font-semibold text-blue-800">{invoiceResult.message}</p>
            <div className="flex justify-center gap-4 text-xs text-blue-700">
              {invoiceResult.invoices_created > 0 && (
                <span>{invoiceResult.invoices_created} invoice{invoiceResult.invoices_created > 1 ? 's' : ''} created</span>
              )}
              {invoiceResult.credits_covered > 0 && (
                <span>{invoiceResult.credits_covered} session{invoiceResult.credits_covered > 1 ? 's' : ''} prepaid</span>
              )}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="md" onClick={() => { onClose(); }}>
            Close
          </Button>
          {!invoiceResult && isPerClassBatch && (
            <Button
              variant="primary"
              size="md"
              icon={FileText}
              loading={invoiceGenerating}
              onClick={handleGenerateInvoices}
            >
              Generate Invoices
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeWizard}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left sidebar — step indicator ── */}
        <div className="w-60 bg-linear-to-b from-primary via-primary/90 to-secondary p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Auto-Schedule</h2>
            <p className="text-primary/60 text-xs mt-1">Step {stepIdx + 1} of {WIZARD_STEPS.length}</p>
          </div>
          <div className="space-y-1 flex-1">
            {WIZARD_STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-primary/60' : 'text-primary/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isDone ? 'bg-primary text-emerald-900' : isCurrent ? 'bg-white text-primary' : 'bg-primary/30 text-primary/80/70'
                  }`}>
                    {isDone ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
              );
            })}
          </div>
          <button onClick={closeWizard} className="mt-4 text-primary/60 hover:text-white text-xs flex items-center gap-2 transition">
            <X className="h-3.5 w-3.5" /> Cancel & Close
          </button>
        </div>

        {/* ── Right content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
            {wizardStep === 'calendar' && renderCalendarStep()}
            {wizardStep === 'configure' && renderConfigureStep()}
            {wizardStep === 'preview' && renderPreviewStep()}
            {wizardStep === 'done' && renderDoneStep()}
          </div>

          {/* ── Footer navigation ── */}
          {wizardStep !== 'done' && (
            <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
              <div>
                {stepIdx > 0 && (
                  <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {wizardStep === 'calendar' && (
                  <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">
                    Continue
                  </Button>
                )}
                {wizardStep === 'configure' && (
                  <Button variant="primary" iconRight={Eye} onClick={fetchPreview} disabled={previewLoading} size="lg">
                    {previewLoading ? 'Loading Preview…' : 'Preview Sessions'}
                  </Button>
                )}
                {wizardStep === 'preview' && (
                  <Button variant="primary" icon={Sparkles} onClick={createSessions} disabled={creating} size="lg">
                    {creating ? 'Creating…' : `Create ${preview?.total_sessions || ''} Sessions`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Collapsible session list ────────────────────────────────
function SessionPreviewList({ sessions, nonIstGroups }: {
  sessions: { date: string; day: string; time: string; subject: string; topic: string | null; session_type: string }[];
  nonIstGroups: { region: string; flag: string; tzLabel: string; count: number; offsetMinutes: number }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? sessions : sessions.slice(0, 10);
  const uniqueTzs = nonIstGroups.filter((g, i, a) => a.findIndex(x => x.tzLabel === g.tzLabel) === i);

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Session Details ({sessions.length})</h4>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[240px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">#</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Date</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Day</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Time (IST)</th>
                {uniqueTzs.map(g => (
                  <th key={g.tzLabel} className="text-left px-3 py-2 font-semibold text-blue-500">{g.flag} {g.tzLabel}</th>
                ))}
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Subject</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Topic</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 text-gray-700">{s.date}</td>
                  <td className="px-3 py-2 text-gray-500">{s.day}</td>
                  <td className="px-3 py-2 text-gray-600">{to12h(s.time)}</td>
                  {uniqueTzs.map(g => (
                    <td key={g.tzLabel} className="px-3 py-2 text-blue-600">{istToRegionTime(s.time, g.region)}</td>
                  ))}
                  <td className="px-3 py-2 font-medium text-gray-700">{s.subject}</td>
                  <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{s.topic || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center py-2 text-xs font-medium text-primary hover:bg-primary/5 border-t border-gray-200 transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${sessions.length} sessions`}
          </button>
        )}
      </div>
    </div>
  );
}
