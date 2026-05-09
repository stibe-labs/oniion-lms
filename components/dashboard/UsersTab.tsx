// ═══════════════════════════════════════════════════════════════
// Shared Users Tab — student / parent / teacher management
// Extracted from HR dashboard for reuse in AO dashboard.
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FilterSelect, StatCard,
  FormField, FormGrid, Input, Textarea, Select, Modal, Alert,
  TableWrapper, THead, TH, TRow,
  InfoCard, LoadingState, EmptyState, Badge, RoleBadge, ActiveIndicator,
  useToast, useConfirm, Avatar,
} from '@/components/dashboard/shared';
import { fmtDateLongIST, fmtDateTimeIST } from '@/lib/utils';
import {
  BookOpen, GraduationCap, UserCheck,
  UserPlus, Save, KeyRound, UserX, UserCheck2,
  Mail, Phone, AlertCircle, CheckCircle2,
  Shield, Award, Pencil, Trash2,
  Calendar, CreditCard, Clock, TrendingUp, Loader2,
  ChevronLeft, ChevronRight, Users, FileText, CheckCircle, User,
  AlertTriangle, Eye, BarChart3, Activity,
  MicOff, CameraOff, LogIn, LogOut, Star, ShieldAlert, Hand, Smartphone,
  ArrowLeft, Printer, Download, X, MinusSquare, Camera, EllipsisVertical,
  PlusCircle, Search,
} from 'lucide-react';
import ImageCropModal from '@/components/dashboard/ImageCropModal';
import { CreateBatchWizard } from '@/components/dashboard/CreateBatchWizard';
import { usePlatformName } from '@/components/providers/PlatformProvider';
import {
  GRADES, BOARDS, STUDENT_REGIONS,
  PwdInput, SubjectSelector, QualificationSelector,
  CreateUserModal, CATEGORY_STYLES, CATEGORIES,
} from '@/components/dashboard/CreateUserForm';

// ─── Types ──────────────────────────────────────────────────
export interface UserRow {
  email: string;
  full_name: string;
  portal_role: string;
  is_active: boolean;
  created_at: string;
  profile_image?: string | null;
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
  category?: string;
  children?: { name: string; email: string }[];
  enrollment_source?: string; // 'crm' | 'portal' | 'manual'
  enrolled_by_name?: string;
  enrollment_batch_type?: string | null;
  enrollment_subjects?: string[] | null;
  enrollment_category?: string | null;
  current_batches?: { batch_id: string; batch_name: string; batch_type: string }[] | null;
}

// ─── Student Performance ────────────────────────────────────
interface StudentPerf {
  batches: {
    id: string; name: string; type: string; grade: string | null;
    subjects: string[]; stats: {
      total_sessions: number; done_sessions: number;
      att_total: number; present: number; rate: number;
    };
    coordinator: string | null;
  }[];
  attendance: { total_classes: number; present: number; absent: number; late: number; attendance_rate: number };
  exams: { id: string; title: string; subject: string; total_marks: number; score: number | null; percentage: number | null; attempt_status: string }[];
}

// ─── Student Report Modal (Monthly) ───────────────────────────
interface ReportMetrics {
  attendance_rate: number;
  avg_attention_score: number;
  total_classes: number;
  classes_attended: number;
  time_in_class_minutes: number;
  looking_away_minutes: number;
  eyes_closed_minutes: number;
  not_in_frame_minutes: number;
  distracted_minutes: number;
  hand_raises: number;
  alerts_count: number;
  engagement_trend: number[];
  overall_summary: string;
  phone_detected_minutes: number;
  head_turned_minutes: number;
  yawning_minutes: number;
  inactive_minutes: number;
  tab_switched_minutes: number;
  late_join_count: number;
  avg_late_minutes: number;
  leave_requests: number;
  leave_approved: number;
  leave_denied: number;
  mic_off_count: number;
  camera_off_count: number;
  rejoin_count: number;
  contact_violations: number;
  avg_feedback_rating: number;
  feedback_count: number;
  alert_breakdown: Record<string, number>;
}
interface BatchPerf {
  id: string; name: string; grade: string | null; section: string | null;
  subjects: string[]; stats: { total_sessions: number; done_sessions: number; present: number; rate: number };
}
interface ExamResult {
  id: string; title: string; subject: string; total_marks: number;
  score: number | null; percentage: number | null; attempt_status: string;
}

/* ── Stat Row helper for report tables ── */
function StatRow({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2.5 pr-4 text-sm text-gray-500 whitespace-nowrap">{label}</td>
      <td className={`py-2.5 text-sm font-semibold text-right ${warn ? 'text-red-600' : 'text-gray-800'}`}>
        {value}{sub && <span className="font-normal text-gray-400 text-xs ml-1">{sub}</span>}
      </td>
    </tr>
  );
}

/* ── Circular Progress Ring ── */
function RingScore({ value, size = 80, stroke = 7, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 75 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold text-gray-800">{value}%</span>
      </div>
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
    </div>
  );
}

function StudentReportView({ user, onBack }: { user: UserRow; onBack: () => void }) {
  const platformName = usePlatformName();
  const now = new Date();
  const [month, setMonth] = React.useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [metrics, setMetrics] = React.useState<ReportMetrics | null>(null);
  const [batches, setBatches] = React.useState<BatchPerf[]>([]);
  const [exams, setExams] = React.useState<ExamResult[]>([]);
  const [overallAtt, setOverallAtt] = React.useState<{ total_classes: number; present: number; absent: number; late: number; attendance_rate: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reportErr, setReportErr] = React.useState('');

  const periodStart = `${month}-01`;
  const periodEnd = React.useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, '0')}`;
  }, [month]);

  const monthLabel = React.useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [month]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReportErr('');
    setMetrics(null);
    const email = encodeURIComponent(user.email);

    const reportPromise = fetch('/api/v1/monitoring/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_email: user.email,
        target_role: 'student',
        period: 'monthly',
        period_start: periodStart,
        period_end: periodEnd,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.report_id) {
          return fetch(`/api/v1/monitoring/reports/${d.data.report_id}`).then(r => r.json());
        }
        return null;
      })
      .then(d => {
        if (!cancelled && d?.success && d.data?.metrics) {
          setMetrics(d.data.metrics as ReportMetrics);
        }
      })
      .catch(() => {
        if (!cancelled) setReportErr('Could not generate monitoring report');
      });

    const perfPromise = fetch(`/api/v1/hr/students/${email}/performance`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.success) {
          setBatches(d.data.batches || []);
          setExams(d.data.exams || []);
          setOverallAtt(d.data.attendance || null);
        }
      })
      .catch(() => {});

    Promise.all([reportPromise, perfPromise]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user.email, periodStart, periodEnd]);

  const pct = (v: number) => `${v}%`;
  const attColor = (r: number) => r >= 75 ? 'text-green-600' : r >= 50 ? 'text-amber-600' : 'text-red-600';
  const attBg = (r: number) => r >= 75 ? 'bg-green-500' : r >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const moveMonth = (dir: -1 | 1) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const isCurrentMonth = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const effAttRate = metrics?.attendance_rate ?? overallAtt?.attendance_rate ?? 0;
  const effPresent = metrics?.classes_attended ?? overallAtt?.present ?? 0;
  const effTotal = metrics?.total_classes ?? overallAtt?.total_classes ?? 0;
  const effAbsent = overallAtt?.absent ?? (effTotal - effPresent);
  const hasAnyData = metrics || overallAtt || batches.length > 0 || exams.length > 0;

  return (
    <div className="space-y-0">
      {/* ════ Top Bar ════ */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition font-medium">
          <ArrowLeft className="h-4 w-4" /> Students
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-35 text-center">{monthLabel}</span>
          <button onClick={() => moveMonth(1)} disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 disabled:opacity-20">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-gray-400">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">Generating report…</p>
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <BarChart3 className="h-10 w-10 mb-3 text-gray-300" />
          <p className="text-sm font-medium">No data for {monthLabel}</p>
          <p className="text-xs mt-1 text-gray-400">No attendance or monitoring records found.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* ════════════════════════════════════════════════════
              REPORT DOCUMENT
             ════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* ── Report Header ── */}
            <div className="bg-gray-900 px-6 py-5 sm:px-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white text-lg font-bold tracking-tight">Student Monthly Report</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{monthLabel}</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-white font-semibold">{user.full_name}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                    {user.grade && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        Grade {user.grade}{user.section ? ` · Section ${user.section}` : ''}
                      </p>
                    )}
                  </div>
                  <Avatar name={user.full_name} size="md" />
                </div>
              </div>
            </div>

            {/* ── Score Ring Summary ── */}
            <div className="px-6 py-6 sm:px-8 border-b border-gray-100">
              <div className="flex items-center justify-center gap-10 sm:gap-16 flex-wrap">
                <div className="relative flex flex-col items-center">
                  <RingScore value={effAttRate} label="Attendance" />
                </div>
                {metrics && (
                  <div className="relative flex flex-col items-center">
                    <RingScore value={metrics.avg_attention_score} label="Attention" />
                  </div>
                )}
                {metrics && metrics.feedback_count > 0 && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center justify-center" style={{ width: 80, height: 80 }}>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-gray-800">{metrics.avg_feedback_rating}</span>
                        <span className="text-sm text-gray-400">/5</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">Feedback</span>
                  </div>
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <span className="text-2xl font-bold text-gray-800">{effPresent}<span className="text-sm text-gray-400 font-normal">/{effTotal}</span></span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium">Sessions</span>
                </div>
              </div>
            </div>

            {/* ── AI Summary ── */}
            {metrics?.overall_summary && (
              <div className="px-6 py-5 sm:px-8 border-b border-gray-100 bg-indigo-50/40">
                <div className="flex gap-3">
                  <Activity className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">AI Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{metrics.overall_summary}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">

              {/* ══ Section 1: Attendance ══ */}
              <div className="px-6 py-5 sm:px-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5" /> Attendance Overview
                </h3>
                <table className="w-full">
                  <tbody>
                    <StatRow label="Total Sessions" value={effTotal} />
                    <StatRow label="On Time" value={effPresent} />
                    <StatRow label="Absent" value={effAbsent} warn={effAbsent > 0} />
                    <StatRow label="Attendance Rate" value={pct(effAttRate)} />
                    {metrics && <StatRow label="Time in Class" value={`${metrics.time_in_class_minutes} min`} />}
                    {metrics && metrics.late_join_count > 0 && (
                      <StatRow label="Late Joins" value={metrics.late_join_count} sub={metrics.avg_late_minutes > 0 ? `avg ${metrics.avg_late_minutes} min` : undefined} warn />
                    )}
                    {metrics && metrics.rejoin_count > 0 && (
                      <StatRow label="Rejoins" value={metrics.rejoin_count} />
                    )}
                  </tbody>
                </table>
              </div>

              {/* ══ Section 2: Attention & Behaviour ══ */}
              {metrics && metrics.time_in_class_minutes > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" /> Attention &amp; Behaviour
                  </h3>
                  <table className="w-full">
                    <tbody>
                      <StatRow label="Attention Score" value={pct(metrics.avg_attention_score)} />
                      <StatRow label="Looking Away" value={`${metrics.looking_away_minutes} min`} warn={metrics.looking_away_minutes > 10} />
                      <StatRow label="Eyes Closed" value={`${metrics.eyes_closed_minutes} min`} warn={metrics.eyes_closed_minutes > 5} />
                      <StatRow label="Not in Frame" value={`${metrics.not_in_frame_minutes} min`} warn={metrics.not_in_frame_minutes > 5} />
                      <StatRow label="Distracted" value={`${metrics.distracted_minutes} min`} warn={metrics.distracted_minutes > 10} />
                      {metrics.head_turned_minutes > 0 && (
                        <StatRow label="Head Turned" value={`${metrics.head_turned_minutes} min`} warn={metrics.head_turned_minutes > 10} />
                      )}
                      {metrics.yawning_minutes > 0 && (
                        <StatRow label="Yawning" value={`${metrics.yawning_minutes} min`} warn={metrics.yawning_minutes > 10} />
                      )}
                      {metrics.inactive_minutes > 0 && (
                        <StatRow label="Inactive" value={`${metrics.inactive_minutes} min`} warn={metrics.inactive_minutes > 5} />
                      )}
                      {metrics.tab_switched_minutes > 0 && (
                        <StatRow label="Tab Switched" value={`${metrics.tab_switched_minutes} min`} warn={metrics.tab_switched_minutes > 5} />
                      )}
                      {metrics.phone_detected_minutes > 0 && (
                        <StatRow label="Phone Detected" value={`${metrics.phone_detected_minutes} min`} warn />
                      )}
                      <StatRow label="Hand Raises" value={metrics.hand_raises} />
                    </tbody>
                  </table>
                </div>
              )}

              {/* ══ Section 3: Discipline ══ */}
              {metrics && (metrics.leave_requests > 0 || metrics.mic_off_count > 0 || metrics.camera_off_count > 0) && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> Discipline
                  </h3>
                  <table className="w-full">
                    <tbody>
                      {metrics.leave_requests > 0 && (
                        <>
                          <StatRow label="Leave Requests" value={metrics.leave_requests} />
                          <StatRow label="  Approved" value={metrics.leave_approved} />
                          <StatRow label="  Denied" value={metrics.leave_denied} warn={metrics.leave_denied > 0} />
                        </>
                      )}
                      {metrics.mic_off_count > 0 && <StatRow label="Mic Turned Off" value={`${metrics.mic_off_count} times`} />}
                      {metrics.camera_off_count > 0 && <StatRow label="Camera Turned Off" value={`${metrics.camera_off_count} times`} />}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ══ Section 4: Safety & Alerts ══ */}
              {metrics && (metrics.contact_violations > 0 || metrics.alerts_count > 0) && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5" /> Safety &amp; Alerts
                  </h3>
                  <table className="w-full">
                    <tbody>
                      {metrics.contact_violations > 0 && (
                        <StatRow label="Contact Violations" value={metrics.contact_violations} warn />
                      )}
                      <StatRow label="Total Alerts" value={metrics.alerts_count} warn={metrics.alerts_count > 0} />
                    </tbody>
                  </table>
                  {metrics.alert_breakdown && Object.keys(metrics.alert_breakdown).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(metrics.alert_breakdown).map(([type, count]) => (
                        <span key={type} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 font-medium">
                          <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                          <span className="text-gray-400">({count})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ Section 5: Session Feedback ══ */}
              {metrics && metrics.feedback_count > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Star className="h-3.5 w-3.5" /> Session Feedback
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-5 w-5 ${s <= Math.round(metrics.avg_feedback_rating) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{metrics.avg_feedback_rating}/5</span>
                    <span className="text-xs text-gray-400">from {metrics.feedback_count} session{metrics.feedback_count > 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              {/* ══ Section 6: Engagement Trend ══ */}
              {metrics && metrics.engagement_trend.length > 1 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" /> Daily Engagement Trend
                  </h3>
                  <div className="flex items-end gap-0.75 h-28">
                    {metrics.engagement_trend.map((score, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className={`w-full rounded-t ${score >= 75 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'} transition-all hover:opacity-80`}
                          style={{ height: `${Math.max(score, 4)}%` }}
                        />
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition pointer-events-none z-10">
                          Day {i + 1}: {score}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                    <span>Day 1</span>
                    <span>Day {metrics.engagement_trend.length}</span>
                  </div>
                </div>
              )}

              {/* ══ Section 7: Class-wise Performance ══ */}
              {batches.length > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" /> Class-wise Performance
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left pb-2 text-xs text-gray-400 font-semibold">Batch</th>
                          <th className="text-center pb-2 text-xs text-gray-400 font-semibold">Attended</th>
                          <th className="text-right pb-2 text-xs text-gray-400 font-semibold w-28">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches.map(b => (
                          <tr key={b.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-2.5">
                              <p className="font-medium text-gray-800">{b.name}</p>
                              <p className="text-[11px] text-gray-400">
                                {b.grade && `${b.grade}`}{b.section && ` · ${b.section}`}
                                {b.subjects?.length > 0 && ` · ${b.subjects.join(', ')}`}
                              </p>
                            </td>
                            <td className="py-2.5 text-center text-gray-600">{b.stats.present}/{b.stats.total_sessions}</td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex items-center gap-2">
                                <span className={`font-bold ${attColor(b.stats.rate)}`}>{pct(b.stats.rate)}</span>
                                <div className="w-16 h-1.5 rounded-full bg-gray-200">
                                  <div className={`h-full rounded-full ${attBg(b.stats.rate)}`} style={{ width: `${b.stats.rate}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ══ Section 8: Exam Results ══ */}
              {exams.length > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Award className="h-3.5 w-3.5" /> Exam Results
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left pb-2 text-xs text-gray-400 font-semibold">Exam</th>
                          <th className="text-left pb-2 text-xs text-gray-400 font-semibold">Subject</th>
                          <th className="text-center pb-2 text-xs text-gray-400 font-semibold">Score</th>
                          <th className="text-right pb-2 text-xs text-gray-400 font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exams.slice(0, 10).map(e => (
                          <tr key={e.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-2.5 font-medium text-gray-800">{e.title}</td>
                            <td className="py-2.5 text-gray-500">{e.subject}</td>
                            <td className="py-2.5 text-center text-gray-600">
                              {e.score !== null ? `${e.score}/${e.total_marks}` : <span className="text-gray-400 capitalize text-xs">{e.attempt_status}</span>}
                            </td>
                            <td className="py-2.5 text-right">
                              {e.percentage !== null ? (
                                <span className={`font-bold ${attColor(e.percentage)}`}>{pct(e.percentage)}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Report Footer ── */}
            <div className="px-6 py-3 sm:px-8 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">
                Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {platformName} Portal
              </p>
              {reportErr && !metrics && (
                <p className="text-[10px] text-amber-500">{reportErr}</p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Teacher Report View (Monthly) ──────────────────────────
interface TeacherReportMetricsLocal {
  sessions_conducted: number;
  sessions_cancelled: number;
  sessions_scheduled: number;
  avg_start_delay_minutes: number;
  on_time_rate: number;
  avg_class_duration_minutes: number;
  avg_student_engagement: number;
  camera_off_incidents: number;
  total_teaching_hours: number;
  late_starts: number;
  late_by_total_minutes: number;
  batches: string[];
  overall_summary: string;
}
interface TeacherBatchPerf {
  id: string; name: string; type: string; grade: string | null; section: string | null;
  subjects: string[]; assigned_subject: string; student_count: number;
  stats: { total_sessions: number; completed_sessions: number; cancelled_sessions: number; teaching_minutes: number };
}
interface TeacherRatings {
  punctuality: number; teaching_quality: number; communication: number; overall: number; total_count: number;
  trend: { month: string; avg_overall: number; count: number }[];
}
interface TeacherSessions {
  total: number; completed: number; cancelled: number; live: number;
  teaching_minutes: number; teaching_hours: number; late_starts: number; completion_rate: number;
}
interface TeacherLeave {
  total: number; approved: number; rejected: number; pending: number;
}

function TeacherReportView({ user, onBack }: { user: UserRow; onBack: () => void }) {
  const platformName = usePlatformName();
  const now = new Date();
  const [month, setMonth] = React.useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [metrics, setMetrics] = React.useState<TeacherReportMetricsLocal | null>(null);
  const [batches, setBatches] = React.useState<TeacherBatchPerf[]>([]);
  const [sessions, setSessions] = React.useState<TeacherSessions | null>(null);
  const [ratings, setRatings] = React.useState<TeacherRatings | null>(null);
  const [leave, setLeave] = React.useState<TeacherLeave | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reportErr, setReportErr] = React.useState('');

  const periodStart = `${month}-01`;
  const periodEnd = React.useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, '0')}`;
  }, [month]);

  const monthLabel = React.useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [month]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReportErr('');
    setMetrics(null);
    const email = encodeURIComponent(user.email);

    const reportPromise = fetch('/api/v1/monitoring/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_email: user.email,
        target_role: 'teacher',
        period: 'monthly',
        period_start: periodStart,
        period_end: periodEnd,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.report_id) {
          return fetch(`/api/v1/monitoring/reports/${d.data.report_id}`).then(r => r.json());
        }
        return null;
      })
      .then(d => {
        if (!cancelled && d?.success && d.data?.metrics) {
          setMetrics(d.data.metrics as TeacherReportMetricsLocal);
        }
      })
      .catch(() => {
        if (!cancelled) setReportErr('Could not generate monitoring report');
      });

    const perfPromise = fetch(`/api/v1/hr/teachers/${email}/performance`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.success) {
          setBatches(d.data.batches || []);
          setSessions(d.data.sessions || null);
          setRatings(d.data.ratings || null);
          setLeave(d.data.leave || null);
        }
      })
      .catch(() => {});

    Promise.all([reportPromise, perfPromise]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user.email, periodStart, periodEnd]);

  const pct = (v: number) => `${v}%`;
  const moveMonth = (dir: -1 | 1) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const isCurrentMonth = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalSessions = metrics?.sessions_scheduled ?? sessions?.total ?? 0;
  const completedSessions = metrics?.sessions_conducted ?? sessions?.completed ?? 0;
  const cancelledSessions = metrics?.sessions_cancelled ?? sessions?.cancelled ?? 0;
  const completionRate = totalSessions > 0 ? Number(((completedSessions / totalSessions) * 100).toFixed(1)) : 0;
  const onTimeRate = metrics?.on_time_rate ?? (sessions ? (sessions.total > 0 ? Number((((sessions.total - sessions.late_starts) / sessions.total) * 100).toFixed(1)) : 100) : 0);
  const teachingHours = metrics?.total_teaching_hours ?? sessions?.teaching_hours ?? 0;
  const overallRating = ratings?.overall ?? 0;
  const hasAnyData = metrics || sessions || batches.length > 0 || (ratings && ratings.total_count > 0);

  const ringColor = (v: number) => v >= 75 ? 'text-green-600' : v >= 50 ? 'text-amber-600' : 'text-red-600';
  const barBg = (v: number) => v >= 75 ? 'bg-green-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-0">
      {/* ════ Top Bar ════ */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition font-medium">
          <ArrowLeft className="h-4 w-4" /> Teachers
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-35 text-center">{monthLabel}</span>
          <button onClick={() => moveMonth(1)} disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 disabled:opacity-20">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-gray-400">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">Generating report…</p>
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <BarChart3 className="h-10 w-10 mb-3 text-gray-300" />
          <p className="text-sm font-medium">No data for {monthLabel}</p>
          <p className="text-xs mt-1 text-gray-400">No session or rating records found.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* ── Report Header ── */}
            <div className="bg-gray-900 px-6 py-5 sm:px-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white text-lg font-bold tracking-tight">Teacher Monthly Report</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{monthLabel}</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-white font-semibold">{user.full_name}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                    {user.subjects && user.subjects.length > 0 && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        {user.subjects.join(', ')}
                      </p>
                    )}
                  </div>
                  <Avatar name={user.full_name} size="md" />
                </div>
              </div>
            </div>

            {/* ── Score Ring Summary ── */}
            <div className="px-6 py-6 sm:px-8 border-b border-gray-100">
              <div className="flex items-center justify-center gap-10 sm:gap-16 flex-wrap">
                <div className="relative flex flex-col items-center">
                  <RingScore value={completionRate} label="Completion" />
                </div>
                <div className="relative flex flex-col items-center">
                  <RingScore value={onTimeRate} label="On-Time" />
                </div>
                {metrics && metrics.avg_student_engagement > 0 && (
                  <div className="relative flex flex-col items-center">
                    <RingScore value={metrics.avg_student_engagement} label="Engagement" />
                  </div>
                )}
                {ratings && ratings.total_count > 0 && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center justify-center" style={{ width: 80, height: 80 }}>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-gray-800">{overallRating}</span>
                        <span className="text-sm text-gray-400">/5</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">Rating</span>
                  </div>
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <span className="text-2xl font-bold text-gray-800">{teachingHours}<span className="text-sm text-gray-400 font-normal">h</span></span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium">Teaching</span>
                </div>
              </div>
            </div>

            {/* ── AI Summary ── */}
            {metrics?.overall_summary && (
              <div className="px-6 py-5 sm:px-8 border-b border-gray-100 bg-indigo-50/40">
                <div className="flex gap-3">
                  <Activity className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">AI Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{metrics.overall_summary}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">

              {/* ══ Section 1: Session Overview ══ */}
              <div className="px-6 py-5 sm:px-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" /> Session Overview
                </h3>
                <table className="w-full">
                  <tbody>
                    <StatRow label="Total Sessions" value={totalSessions} />
                    <StatRow label="Completed" value={completedSessions} />
                    <StatRow label="Cancelled" value={cancelledSessions} warn={cancelledSessions > 0} />
                    {sessions?.live ? <StatRow label="Currently Live" value={sessions.live} /> : null}
                    <StatRow label="Completion Rate" value={pct(completionRate)} />
                    <StatRow label="Total Teaching Hours" value={`${teachingHours}h`} />
                    {metrics && <StatRow label="Avg Class Duration" value={`${metrics.avg_class_duration_minutes} min`} />}
                  </tbody>
                </table>
              </div>

              {/* ══ Section 2: Punctuality ══ */}
              <div className="px-6 py-5 sm:px-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Punctuality
                </h3>
                <table className="w-full">
                  <tbody>
                    <StatRow label="On-Time Rate" value={pct(onTimeRate)} />
                    <StatRow label="Late Starts" value={metrics?.late_starts ?? sessions?.late_starts ?? 0} warn={(metrics?.late_starts ?? sessions?.late_starts ?? 0) > 0} />
                    {metrics && metrics.avg_start_delay_minutes > 0 && (
                      <StatRow label="Avg Start Delay" value={`${metrics.avg_start_delay_minutes} min`} warn />
                    )}
                    {metrics && metrics.late_by_total_minutes > 0 && (
                      <StatRow label="Total Late Time" value={`${metrics.late_by_total_minutes} min`} warn />
                    )}
                  </tbody>
                </table>
              </div>

              {/* ══ Section 3: Classroom Conduct ══ */}
              {metrics && metrics.camera_off_incidents > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CameraOff className="h-3.5 w-3.5" /> Classroom Conduct
                  </h3>
                  <table className="w-full">
                    <tbody>
                      <StatRow label="Camera Off Incidents" value={metrics.camera_off_incidents} warn />
                    </tbody>
                  </table>
                </div>
              )}

              {/* ══ Section 4: Student Engagement ══ */}
              {metrics && metrics.avg_student_engagement > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" /> Student Engagement
                  </h3>
                  <table className="w-full">
                    <tbody>
                      <StatRow label="Avg Student Engagement" value={pct(metrics.avg_student_engagement)} />
                    </tbody>
                  </table>
                </div>
              )}

              {/* ══ Section 5: Leave History ══ */}
              {leave && leave.total > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Leave Requests
                  </h3>
                  <table className="w-full">
                    <tbody>
                      <StatRow label="Total Requests" value={leave.total} />
                      <StatRow label="Approved" value={leave.approved} />
                      <StatRow label="Rejected" value={leave.rejected} warn={leave.rejected > 0} />
                      <StatRow label="Pending" value={leave.pending} />
                    </tbody>
                  </table>
                </div>
              )}

              {/* ══ Section 6: Ratings ══ */}
              {ratings && ratings.total_count > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Star className="h-3.5 w-3.5" /> Student Ratings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-5 w-5 ${s <= Math.round(overallRating) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{overallRating}/5</span>
                      <span className="text-xs text-gray-400">from {ratings.total_count} rating{ratings.total_count > 1 ? 's' : ''}</span>
                    </div>
                    <table className="w-full">
                      <tbody>
                        <StatRow label="Punctuality" value={`${ratings.punctuality}/5`} />
                        <StatRow label="Teaching Quality" value={`${ratings.teaching_quality}/5`} />
                        <StatRow label="Communication" value={`${ratings.communication}/5`} />
                        <StatRow label="Overall" value={`${ratings.overall}/5`} />
                      </tbody>
                    </table>
                  </div>

                  {/* Rating trend */}
                  {ratings.trend.length > 1 && (
                    <div className="mt-5">
                      <p className="text-xs text-gray-400 font-medium mb-3">Monthly Rating Trend</p>
                      <div className="flex items-end gap-2 h-24">
                        {ratings.trend.map((t, i) => {
                          const h = (t.avg_overall / 5) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                              <div
                                className={`w-full rounded-t ${barBg(h)} transition-all hover:opacity-80`}
                                style={{ height: `${Math.max(h, 4)}%` }}
                              />
                              <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap transition pointer-events-none z-10">
                                {t.month}: {t.avg_overall}/5 ({t.count})
                              </div>
                              <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">{t.month.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══ Section 7: Batch-wise Performance ══ */}
              {batches.length > 0 && (
                <div className="px-6 py-5 sm:px-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" /> Batch-wise Performance
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left pb-2 text-xs text-gray-400 font-semibold">Batch</th>
                          <th className="text-center pb-2 text-xs text-gray-400 font-semibold">Students</th>
                          <th className="text-center pb-2 text-xs text-gray-400 font-semibold">Sessions</th>
                          <th className="text-right pb-2 text-xs text-gray-400 font-semibold w-28">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches.map(b => {
                          const rate = b.stats.total_sessions > 0
                            ? Number(((b.stats.completed_sessions / b.stats.total_sessions) * 100).toFixed(1))
                            : 0;
                          return (
                            <tr key={b.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-2.5">
                                <p className="font-medium text-gray-800">{b.name}</p>
                                <p className="text-[11px] text-gray-400">
                                  {b.assigned_subject}
                                  {b.grade && ` · ${b.grade}`}{b.section && ` ${b.section}`}
                                </p>
                              </td>
                              <td className="py-2.5 text-center text-gray-600">{b.student_count}</td>
                              <td className="py-2.5 text-center text-gray-600">{b.stats.completed_sessions}/{b.stats.total_sessions}</td>
                              <td className="py-2.5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <span className={`font-bold ${ringColor(rate)}`}>{pct(rate)}</span>
                                  <div className="w-16 h-1.5 rounded-full bg-gray-200">
                                    <div className={`h-full rounded-full ${barBg(rate)}`} style={{ width: `${rate}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Report Footer ── */}
            <div className="px-6 py-3 sm:px-8 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">
                Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {platformName} Portal
              </p>
              {reportErr && !metrics && (
                <p className="text-[10px] text-amber-500">{reportErr}</p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add to Batch Modal ───────────────────────────────────────
const BATCH_TYPES_ORDERED = [
  'one_to_one', 'one_to_three', 'one_to_five', 'one_to_fifteen',
  'one_to_thirty', 'one_to_many', 'lecture', 'improvement_batch', 'custom',
];
const BATCH_TYPE_LABEL: Record<string, string> = {
  one_to_one: 'One-to-One (1:1)',
  one_to_three: 'One-to-Three (1:3)',
  one_to_five: 'One-to-Five (1:5)',
  one_to_fifteen: '1:15 Group',
  one_to_thirty: '1:30 Group',
  one_to_many: 'Large Classroom',
  lecture: 'Lecture',
  improvement_batch: 'Improvement Batch',
  custom: 'Custom',
};

interface BatchListItem {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  subjects: string[];
  grade: string | null;
  section: string | null;
  board: string | null;
  max_students: number | null;
  student_count: number;
  coordinator_email: string | null;
  academic_operator_email: string | null;
  coordinator_name: string | null;
  academic_operator_name: string | null;
  status: string;
}

// Suppress unused warning — used for type checking only
void BATCH_TYPES_ORDERED;

function AddToBatchModal({ student, onClose, onCreateNew }: { student: UserRow; onClose: () => void; onCreateNew: () => void }) {
  const toast = useToast();
  const [batches, setBatches] = React.useState<BatchListItem[]>([]);
  const [loadingBatches, setLoadingBatches] = React.useState(true);
  const [batchSearch, setBatchSearch] = React.useState('');
  const [adding, setAdding] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setLoadingBatches(true);
    fetch('/api/v1/batches?status=active')
      .then(r => r.json())
      .then(d => { if (d.success) setBatches((d as { success: boolean; data: { batches: BatchListItem[] } }).data.batches || []); })
      .catch(() => {})
      .finally(() => setLoadingBatches(false));
  }, []);

  const filteredBatches = React.useMemo(() => {
    let list = batches;
    if (batchSearch) {
      const q = batchSearch.toLowerCase();
      list = list.filter(b =>
        b.batch_name.toLowerCase().includes(q) ||
        (b.grade || '').toLowerCase().includes(q) ||
        (b.board || '').toLowerCase().includes(q) ||
        (BATCH_TYPE_LABEL[b.batch_type] || b.batch_type).toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aScore = (a.grade === student.grade ? 1 : 0) + (a.batch_type === student.enrollment_batch_type ? 1 : 0);
      const bScore = (b.grade === student.grade ? 1 : 0) + (b.batch_type === student.enrollment_batch_type ? 1 : 0);
      return bScore - aScore;
    });
  }, [batches, batchSearch, student.grade, student.enrollment_batch_type]);

  const handleAddToExisting = async (batchId: string) => {
    setAdding(batchId);
    setError('');
    try {
      const res = await fetch(`/api/v1/batches/${batchId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: student.email, parent_email: student.parent_email || null }),
      });
      const data = await res.json() as { success: boolean; message?: string; error?: string };
      if (data.success) {
        toast.success(data.message || 'Student added to batch');
        onClose();
      } else {
        setError(data.error || 'Failed to add student');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setAdding(null);
    }
  };

  const isFull = (b: BatchListItem) => !!b.max_students && b.student_count >= b.max_students;

  return (
    <Modal open title={`Add ${student.full_name} to Batch`} onClose={onClose} maxWidth="lg">
      <div className="flex gap-2 mb-1">
        <Button variant="primary" icon={PlusCircle} onClick={onCreateNew} size="sm">
          Create New Batch
        </Button>
        <p className="text-xs text-gray-400 self-center ml-1">— or add to an existing batch below</p>
      </div>

      {error && (
        <Alert variant="error" message={error} onDismiss={() => setError('')} />
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            value={batchSearch}
            onChange={e => setBatchSearch(e.target.value)}
            placeholder="Search by name, grade, type…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        {loadingBatches ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading batches…
          </div>
        ) : filteredBatches.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-6">No active batches found.</p>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {filteredBatches.map(b => {
              const isMatch = b.grade === student.grade && b.batch_type === student.enrollment_batch_type;
              const full = isFull(b);
              return (
                <div
                  key={b.batch_id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                    full ? 'opacity-60 border-gray-200 bg-gray-50' :
                    isMatch ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{b.batch_name}</span>
                      {isMatch && <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Best match</span>}
                      {full && <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">Full</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />{BATCH_TYPE_LABEL[b.batch_type] || b.batch_type}
                      </span>
                      {b.grade && <span><GraduationCap className="h-3 w-3 inline mr-0.5" />{b.grade}{b.section ? ` · ${b.section}` : ''}</span>}
                      {b.board && <span>{b.board}</span>}
                      <span className="text-gray-400">
                        {b.student_count}{b.max_students ? `/${b.max_students}` : ''} students
                      </span>
                    </div>
                    {b.subjects && b.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {b.subjects.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={full ? 'ghost' : 'primary'}
                    disabled={full || adding === b.batch_id}
                    onClick={() => handleAddToExisting(b.batch_id)}
                  >
                    {adding === b.batch_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
                    <span className="ml-1">{full ? 'Full' : 'Add'}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Enrollment Summary types ────────────────────────────────
interface EnrollmentLink {
  id: string;
  preferred_batch_type: string | null;
  selected_subjects: string[] | null;
  minimum_sessions: number | null;
  amount_paise: number | null;
  payment_plan: string | null;
  enrollment_category: string | null;
  student_grade: string | null;
  student_board: string | null;
  status: string;
  source: string;
  created_at: string;
  created_by_name: string | null;
}
interface SessionCredit {
  id: string;
  subject: string;
  batch_type: string;
  total_sessions: number;
  used_sessions: number;
  remaining: number;
  fee_per_session_paise: number;
  currency: string;
  source: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}
interface InvoiceStats {
  total_invoices: number;
  total_billed_paise: string;
  total_paid_paise: string;
  total_outstanding_paise: string;
  pending_count: number;
  paid_count: number;
  overdue_count: number;
}
interface NextInvoice {
  id: string;
  invoice_number: string;
  description: string | null;
  billing_period: string;
  amount_paise: number;
  currency: string;
  due_date: string | null;
  status: string;
  installment_number: number | null;
  scheduled_for: string | null;
  period_start: string | null;
  period_end: string | null;
}
interface RecentReceipt {
  id: string;
  receipt_number: string;
  amount_paise: number;
  currency: string;
  payment_method: string | null;
  created_at: string;
  invoice_description: string | null;
  billing_period: string | null;
}
interface EnrollmentSummary {
  enrollment_links: EnrollmentLink[];
  credits: SessionCredit[];
  invoice_stats: InvoiceStats | null;
  next_invoice: NextInvoice | null;
  recent_receipts: RecentReceipt[];
}

const CREDIT_BATCH_TYPES = new Set(['one_to_one', 'one_to_three']);

const BATCH_TYPE_LABELS: Record<string, string> = {
  one_to_one: '1:1 Private',
  one_to_three: '1:3 Small Group',
  one_to_fifteen: '1:15 Group',
  one_to_thirty: '1:30 Classroom',
  one_to_many: 'Large Classroom',
  improvement_batch: 'Improvement',
  special: 'Special',
  lecture: 'Lecture',
  custom: 'Custom',
};

const PAYMENT_PLAN_LABELS: Record<string, string> = {
  otp: 'One-Time Payment',
  quarterly: 'Quarterly',
};

function fmtPaise(paise: number | string): string {
  const n = typeof paise === 'string' ? parseInt(paise, 10) : paise;
  return `₹${(n / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Detail Panel (expanded row) ─────────────────────────────
function UserDetailPanel({ user }: { user: UserRow }) {
  const [perf, setPerf] = React.useState<StudentPerf | null>(null);
  const [loadingPerf, setLoadingPerf] = React.useState(false);
  const [parentUser, setParentUser] = React.useState<UserRow | null>(null);
  const [loadingParent, setLoadingParent] = React.useState(false);
  const [enrollSummary, setEnrollSummary] = React.useState<EnrollmentSummary | null>(null);
  const [loadingEnroll, setLoadingEnroll] = React.useState(false);
  const [showAddToBatch, setShowAddToBatch] = React.useState(false);
  const [showCreateBatch, setShowCreateBatch] = React.useState(false);

  React.useEffect(() => {
    if (user.portal_role !== 'student') return;
    setLoadingPerf(true);
    fetch(`/api/v1/hr/students/${encodeURIComponent(user.email)}/performance`)
      .then(r => r.json())
      .then(d => { if (d.success) setPerf(d.data); })
      .catch(() => {})
      .finally(() => setLoadingPerf(false));
  }, [user.email, user.portal_role]);

  React.useEffect(() => {
    if (user.portal_role !== 'student' || !user.parent_email) return;
    setLoadingParent(true);
    fetch(`/api/v1/hr/users/${encodeURIComponent(user.parent_email)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setParentUser(d.data.user); })
      .catch(() => {})
      .finally(() => setLoadingParent(false));
  }, [user.portal_role, user.parent_email]);

  React.useEffect(() => {
    if (user.portal_role !== 'student') return;
    setLoadingEnroll(true);
    fetch(`/api/v1/hr/students/${encodeURIComponent(user.email)}/enrollment-summary`)
      .then(r => r.json())
      .then(d => { if (d.success) setEnrollSummary(d.data); })
      .catch(() => {})
      .finally(() => setLoadingEnroll(false));
  }, [user.email, user.portal_role]);



  type FieldPair = [string, string | number | null | undefined, React.ComponentType<{ className?: string }>?];
  const fields = ([
    ['Email', user.email, Mail],
    ['Phone', user.phone, Phone],
    ['WhatsApp', user.whatsapp, Phone],
    ['Address', user.address, Calendar],
    ['Qualification', user.qualification, Award],
    ['Experience', user.experience_years != null ? `${user.experience_years} years` : null],
    ['Per Hour Rate', user.per_hour_rate != null ? `₹${user.per_hour_rate}/hr` : null, CreditCard],
    ['Subjects', user.subjects?.join(', '), BookOpen],
    ['Grade', user.grade ? `${user.grade}${user.section ? ` · ${user.section}` : ''}` : null, GraduationCap],
    ['Board', user.board],
    ['Parent', user.parent_name || user.parent_email, Shield],
    ['Admission', user.admission_date ? fmtDateLongIST(user.admission_date) : null, Calendar],
    ['Region', user.assigned_region],
    ['Notes', user.notes],
    ['Account created', fmtDateTimeIST(user.created_at), Clock],
  ] as FieldPair[]).filter(([, v]) => v != null && v !== '');

  const attColor = (r: number) => r >= 75 ? 'text-green-700' : r >= 50 ? 'text-amber-700' : 'text-red-600';
  const attBar   = (r: number) => r >= 75 ? 'bg-green-500' : r >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-emerald-200/60 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <Avatar name={user.full_name} size="md" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user.portal_role === 'student' && (
            <Button size="sm" variant="outline" onClick={() => setShowAddToBatch(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />Add to Batch
            </Button>
          )}
          <RoleBadge role={user.portal_role} />
          <ActiveIndicator active={user.is_active} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {fields.map(([label, value, Icon]) => (
          <InfoCard key={label as string} label={label as string} icon={Icon as React.ComponentType<{ className?: string }> & import('lucide-react').LucideIcon | undefined}>
            <p className="text-sm font-medium text-gray-800">{value as string}</p>
          </InfoCard>
        ))}
      </div>

      {/* ── Parent Details Section (student only) ── */}
      {user.portal_role === 'student' && user.parent_email && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Parent / Guardian
            </p>
          </div>
          {loadingParent ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading parent details…
            </div>
          ) : parentUser ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {([
                ['Name', parentUser.full_name],
                ['Email', parentUser.email],
                ['Phone', parentUser.phone],
                ['WhatsApp', parentUser.whatsapp],
                ['Address', parentUser.address],
                ['Notes', parentUser.notes],
              ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([lbl, val]) => (
                <InfoCard key={lbl} label={lbl}>
                  <p className="text-sm font-medium text-gray-800">{val}</p>
                </InfoCard>
              ))}
              <InfoCard label="Status">
                <ActiveIndicator active={parentUser.is_active} />
              </InfoCard>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Parent email linked: {user.parent_email} — no profile found.</p>
          )}
        </div>
      )}

      {/* ── CRM Enrollment Preferences (student only) ── */}
      {user.portal_role === 'student' && (user.enrollment_batch_type || (user.enrollment_subjects && user.enrollment_subjects.length > 0) || user.enrollment_category) && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> CRM Enrollment Preferences
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {user.enrollment_batch_type && (
              <InfoCard label="Preferred Batch Type">
                <p className="text-sm font-medium text-gray-800">
                  {user.enrollment_batch_type === 'one_to_one' ? 'One-to-One'
                    : user.enrollment_batch_type === 'one_to_three' ? 'One-to-Three'
                    : user.enrollment_batch_type === 'one_to_fifteen' ? 'One-to-Fifteen'
                    : user.enrollment_batch_type === 'one_to_thirty' ? 'One-to-Thirty'
                    : user.enrollment_batch_type === 'one_to_many' ? 'Large Classroom'
                    : user.enrollment_batch_type}
                </p>
              </InfoCard>
            )}
            {user.enrollment_subjects && user.enrollment_subjects.length > 0 && (
              <InfoCard label="Enrolled Subjects">
                <p className="text-sm font-medium text-gray-800">{user.enrollment_subjects.join(', ')}</p>
              </InfoCard>
            )}
            {user.enrollment_category && (
              <InfoCard label="Enrollment Category">
                <p className="text-sm font-medium text-gray-800">
                  {user.enrollment_category === 'GCC_CBSE' ? 'GCC — CBSE'
                    : user.enrollment_category === 'KERALA_CBSE' ? 'Kerala — CBSE'
                    : user.enrollment_category === 'KERALA_STATE' ? 'Kerala — State Board'
                    : user.enrollment_category.replace(/_/g, ' ')}
                </p>
              </InfoCard>
            )}
          </div>
        </div>
      )}

      {/* ── Student Performance Section ── */}
      {user.portal_role === 'student' && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Academic Performance
          </p>
          {loadingPerf ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading performance data…
            </div>
          ) : perf ? (
            <div className="space-y-3">
              {/* Attendance summary */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className={`text-lg font-bold ${attColor(perf.attendance.attendance_rate)}`}>
                    {perf.attendance.attendance_rate}%
                  </p>
                  <p className="text-[10px] text-gray-400">Attendance</p>
                  <div className="mt-1.5 h-1 rounded-full bg-gray-200">
                    <div className={`h-full rounded-full ${attBar(perf.attendance.attendance_rate)}`}
                      style={{ width: `${perf.attendance.attendance_rate}%` }} />
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-gray-800">{perf.attendance.total_classes}</p>
                  <p className="text-[10px] text-gray-400">Sessions</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{perf.attendance.present}</p>
                  <p className="text-[10px] text-gray-400">Present</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-red-600">{perf.attendance.absent}</p>
                  <p className="text-[10px] text-gray-400">Absent</p>
                </div>
              </div>

              {/* Batches */}
              {perf.batches.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-500 mb-2">
                    Enrolled in {perf.batches.length} batch{perf.batches.length !== 1 ? 'es' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {perf.batches.map(b => (
                      <div key={b.id} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs">
                        <span className="font-medium text-gray-800">{b.name}</span>
                        {b.grade && <span className="text-gray-400">· {b.grade}</span>}
                        <span className={`font-bold ${attColor(b.stats.rate)}`}>{b.stats.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent exam results */}
              {perf.exams.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-500 mb-2">Recent Exams</p>
                  <div className="space-y-1">
                    {perf.exams.slice(0, 4).map(e => (
                      <div key={e.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{e.title}</p>
                          <p className="text-[10px] text-gray-400">{e.subject}</p>
                        </div>
                        {e.percentage !== null ? (
                          <span className={`text-xs font-bold ${attColor(e.percentage)}`}>{e.percentage}%</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 capitalize">{e.attempt_status}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No performance data available.</p>
          )}
        </div>
      )}

      {/* ── Enrollment & Credits Section ── */}
      {user.portal_role === 'student' && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Enrollment & Credits
          </p>
          {loadingEnroll ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading enrollment data…
            </div>
          ) : enrollSummary ? (
            <div className="space-y-4">
              {/* Enrollment Links */}
              {enrollSummary.enrollment_links.length > 0 ? (
                <div className="space-y-2">
                  {enrollSummary.enrollment_links.map(link => {
                    const batchLabel = link.preferred_batch_type ? (BATCH_TYPE_LABELS[link.preferred_batch_type] || link.preferred_batch_type) : null;
                    const isCreditType = link.preferred_batch_type ? CREDIT_BATCH_TYPES.has(link.preferred_batch_type) : false;
                    return (
                      <div key={link.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {batchLabel && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isCreditType ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                              {batchLabel}
                            </span>
                          )}
                          {link.payment_plan && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                              {PAYMENT_PLAN_LABELS[link.payment_plan] || link.payment_plan}
                            </span>
                          )}
                          {link.enrollment_category && (
                            <span className="text-[11px] text-gray-500 px-2 py-0.5 rounded-full bg-white border border-gray-200">
                              {link.enrollment_category.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto">{fmtDate(link.created_at)}{link.created_by_name ? ` · via ${link.created_by_name}` : ''}</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {link.selected_subjects && link.selected_subjects.length > 0 && (
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1">Subjects</p>
                              <div className="flex flex-wrap gap-1">
                                {link.selected_subjects.map(s => (
                                  <span key={s} className="text-[10px] font-medium bg-violet-50 border border-violet-200 text-violet-700 rounded px-1.5 py-0.5">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {link.minimum_sessions != null && (
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1">Sessions contracted</p>
                              <p className="text-sm font-semibold text-gray-800">{link.minimum_sessions}</p>
                            </div>
                          )}
                          {link.amount_paise != null && link.amount_paise > 0 && (
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1">Enrollment fee paid</p>
                              <p className="text-sm font-semibold text-emerald-700">{fmtPaise(link.amount_paise)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No paid enrollment links found. Student was manually enrolled.</p>
              )}

              {/* Session Credits (1:1 / 1:3) */}
              {enrollSummary.credits.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Session Credit Balance</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {enrollSummary.credits.map(c => {
                      const pct = c.total_sessions > 0 ? Math.round((c.remaining / c.total_sessions) * 100) : 0;
                      const barColor = pct > 40 ? 'bg-emerald-500' : pct > 15 ? 'bg-amber-400' : 'bg-red-500';
                      const textColor = pct > 40 ? 'text-emerald-700' : pct > 15 ? 'text-amber-700' : 'text-red-600';
                      return (
                        <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-800">{c.subject}</span>
                            <span className={`text-xs font-bold ${textColor}`}>{c.remaining} left</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>{c.used_sessions} used / {c.total_sessions} total</span>
                            <span>{fmtPaise(c.fee_per_session_paise)}/session</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No enrollment data available.</p>
          )}
        </div>
      )}

      {/* ── Fees & Invoices Section ── */}
      {user.portal_role === 'student' && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Fees & Invoices
          </p>
          {loadingEnroll ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : enrollSummary?.invoice_stats ? (
            <div className="space-y-3">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total Billed', value: fmtPaise(enrollSummary.invoice_stats.total_billed_paise), color: 'text-gray-800' },
                  { label: 'Total Paid', value: fmtPaise(enrollSummary.invoice_stats.total_paid_paise), color: 'text-emerald-700' },
                  { label: 'Outstanding', value: fmtPaise(enrollSummary.invoice_stats.total_outstanding_paise), color: parseInt(enrollSummary.invoice_stats.total_outstanding_paise as unknown as string) > 0 ? 'text-red-600' : 'text-gray-400' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                    <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Invoice count badges */}
              <div className="flex flex-wrap gap-2">
                {enrollSummary.invoice_stats.overdue_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" /> {enrollSummary.invoice_stats.overdue_count} overdue
                  </span>
                )}
                {enrollSummary.invoice_stats.pending_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" /> {enrollSummary.invoice_stats.pending_count} pending
                  </span>
                )}
                {enrollSummary.invoice_stats.paid_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> {enrollSummary.invoice_stats.paid_count} paid
                  </span>
                )}
              </div>
              {/* Next invoice */}
              {enrollSummary.next_invoice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1">Next Invoice Due</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{enrollSummary.next_invoice.description || enrollSummary.next_invoice.billing_period}</p>
                      <p className="text-[10px] text-gray-400">{enrollSummary.next_invoice.invoice_number}{enrollSummary.next_invoice.installment_number ? ` · Installment #${enrollSummary.next_invoice.installment_number}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-amber-700">{fmtPaise(enrollSummary.next_invoice.amount_paise)}</p>
                      <p className="text-[10px] text-gray-500">Due {fmtDate(enrollSummary.next_invoice.due_date || enrollSummary.next_invoice.scheduled_for)}</p>
                    </div>
                  </div>
                  {enrollSummary.next_invoice.status === 'overdue' && (
                    <p className="text-[10px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Overdue — payment not received
                    </p>
                  )}
                </div>
              )}
              {/* Recent receipts */}
              {enrollSummary.recent_receipts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Recent Payments</p>
                  <div className="space-y-1">
                    {enrollSummary.recent_receipts.map(r => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{r.invoice_description || r.billing_period || 'Payment'}</p>
                          <p className="text-[10px] text-gray-400">{r.receipt_number} · {fmtDate(r.created_at)}{r.payment_method ? ` · ${r.payment_method.replace(/_/g, ' ')}` : ''}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 shrink-0">{fmtPaise(r.amount_paise)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {enrollSummary.invoice_stats.total_invoices === 0 && (
                <p className="text-xs text-gray-400">No invoices generated yet.</p>
              )}
            </div>
          ) : !loadingEnroll ? (
            <p className="text-xs text-gray-400">No invoice data available.</p>
          ) : null}
        </div>
      )}

      {showAddToBatch && (
        <AddToBatchModal
          student={user}
          onClose={() => setShowAddToBatch(false)}
          onCreateNew={() => { setShowAddToBatch(false); setShowCreateBatch(true); }}
        />
      )}
      {showCreateBatch && (
        <CreateBatchWizard
          prefillStudent={{
            email: user.email,
            name: user.full_name,
            parent_email: user.parent_email || null,
            grade: user.grade,
            board: user.board,
            batch_type: user.enrollment_batch_type || undefined,
            subjects: user.enrollment_subjects || user.subjects,
            category: user.category,
          }}
          onClose={() => setShowCreateBatch(false)}
          onCreated={() => setShowCreateBatch(false)}
        />
      )}
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    phone: user.phone || '', whatsapp: user.whatsapp || '',
    address: user.address || '',
    qualification: user.qualification || '', notes: user.notes || '',
    subjects: user.subjects || [],
    experience_years: user.experience_years?.toString() || '',
    per_hour_rate: user.per_hour_rate?.toString() || '',
    grade: user.grade || 'Class 10', section: user.section || '',
    board: user.board || 'CBSE', parent_email: user.parent_email || '',
    admission_date: user.admission_date ? user.admission_date.split('T')[0] : '',
    assigned_region: user.assigned_region || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const f = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      qualification: form.qualification.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (user.portal_role === 'teacher') {
      payload.subjects = form.subjects;
      payload.experience_years = form.experience_years ? Number(form.experience_years) : null;
      payload.per_hour_rate = form.per_hour_rate ? Math.round(Number(form.per_hour_rate)) : null;
    }
    if (user.portal_role === 'student') {
      payload.grade = form.grade;
      payload.section = form.section.trim() || null;
      payload.board = form.board;
      payload.parent_email = form.parent_email.trim().toLowerCase() || null;
      payload.admission_date = form.admission_date || null;
    }
    if (user.portal_role === 'batch_coordinator') {
      payload.qualification = form.qualification?.trim() || null;
    }
    if (user.portal_role === 'academic_operator') {
      payload.qualification = form.qualification?.trim() || null;
    }

    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { toast.success('User updated successfully'); setTimeout(onSaved, 500); }
      else setError(data.error || 'Failed to save');
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${user.full_name}`} subtitle={`${user.email} · ${user.portal_role}`} maxWidth="xl">
      <div className="space-y-4 max-h-[65vh] overflow-auto">
        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

        <FormField label="Full Name">
          <Input type="text" value={form.full_name} onChange={(e) => f('full_name', e.target.value)} />
        </FormField>

        <FormGrid cols={2}>
          <FormField label="Phone">
            <Input type="tel" value={form.phone} onChange={(e) => f('phone', e.target.value)} />
          </FormField>
          <FormField label="WhatsApp">
            <Input type="tel" value={form.whatsapp} onChange={(e) => f('whatsapp', e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Address">
          <Textarea rows={2} value={form.address} onChange={(e) => f('address', e.target.value)} placeholder="Full address..." />
        </FormField>

        {user.portal_role === 'teacher' && (
          <>
            <FormField label="Subjects">
              <SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} />
            </FormField>
            <FormGrid cols={2}>
              <FormField label="Qualification">
                <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
              </FormField>
              <FormField label="Experience (years)">
                <Input type="number" min={0} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormField label="Per Hour Rate" hint="Amount per teaching hour">
              <Input type="number" min={0} step={1} value={form.per_hour_rate} onChange={(e) => f('per_hour_rate', e.target.value)} placeholder="e.g. 500" />
            </FormField>
          </>
        )}

        {user.portal_role === 'student' && (
          <>
            <FormGrid cols={2}>
              <FormField label="Grade">
                <Select value={form.grade} onChange={(v) => f('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} />
              </FormField>
              <FormField label="Section">
                <Input type="text" value={form.section} onChange={(e) => f('section', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Board">
                <Select value={form.board} onChange={(v) => f('board', v)} options={BOARDS.map(b => ({ value: b, label: b }))} />
              </FormField>
              <FormField label="Admission Date">
                <Input type="date" value={form.admission_date} onChange={(e) => f('admission_date', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormField label="Parent Email">
              <Input type="email" value={form.parent_email} onChange={(e) => f('parent_email', e.target.value)} />
            </FormField>
          </>
        )}

        {user.portal_role === 'batch_coordinator' && (
          <>
            <FormField label="Qualification">
              <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
            </FormField>
          </>
        )}

        {user.portal_role === 'academic_operator' && (
          <>
            <FormField label="Qualification">
              <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
            </FormField>
          </>
        )}

        <FormField label="Notes (internal)">
          <Textarea rows={2} value={form.notes} onChange={(e) => f('notes', e.target.value)} />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" icon={Save} onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Teacher Modal (multi-step wizard matching create form) ─
function EditTeacherModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  type StepKey = 'basic' | 'teaching' | 'notes';
  const STEPS: { key: StepKey; label: string; icon: React.ElementType; desc: string }[] = [
    { key: 'basic',    label: 'Basic Info',        icon: User,          desc: 'Name & contact details' },
    { key: 'teaching', label: 'Teaching Details',  icon: GraduationCap, desc: 'Subjects, qualification & experience' },
    { key: 'notes',    label: 'Notes',             icon: FileText,      desc: 'Internal HR notes' },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx].key;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.profile_image || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('');

  // Parse existing phone to extract country code + number
  const parsePhone = (raw: string) => {
    const CODES = ['+971', '+966', '+974', '+968', '+973', '+965', '+91', '+86', '+81', '+65', '+61', '+60', '+49', '+44', '+33', '+1'];
    for (const code of CODES) {
      if (raw.startsWith(code)) return { code, number: raw.slice(code.length).trim() };
    }
    return { code: '+91', number: raw.replace(/^\+\d+\s*/, '').trim() };
  };
  const parsed = parsePhone(user.phone || '');

  const [form, setForm] = useState({
    full_name: user.full_name,
    phone: parsed.number,
    phoneCode: parsed.code,
    address: user.address || '',
    subjects: user.subjects || [] as string[],
    qualification: user.qualification || '',
    experience_years: user.experience_years?.toString() || '',
    per_hour_rate: user.per_hour_rate?.toString() || '',
    assigned_region: user.assigned_region || '',
    notes: user.notes || '',
    category: user.category || '',
  });

  const f = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const fullPhone = form.phone.trim() ? `${form.phoneCode} ${form.phone.trim()}` : '';
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: fullPhone || null,
        whatsapp: fullPhone || null,
        address: form.address.trim() || null,
        subjects: form.subjects,
        qualification: form.qualification.trim() || null,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        per_hour_rate: form.per_hour_rate ? Math.round(Number(form.per_hour_rate)) : null,
        assigned_region: form.assigned_region.trim() || null,
        notes: form.notes.trim() || null,
        category: form.category || null,
      };
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to save'); return; }

      // Upload avatar if changed
      if (avatarFile) {
        const fd = new FormData();
        fd.append('image', avatarFile);
        await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}/avatar`, { method: 'POST', body: fd }).catch(() => {});
      }

      toast.success('Teacher updated successfully');
      setTimeout(onSaved, 400);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Sidebar */}
        <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Edit Teacher</h2>
            <p className="text-emerald-200 text-xs mt-1">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <div className="space-y-1 flex-1">
            {STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const StepIcon = step.icon;
              return (
                <button key={step.key} type="button"
                  onClick={() => { if (idx < stepIdx) setStepIdx(idx); }}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all text-left ${
                    isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-emerald-200 hover:bg-white/10 cursor-pointer' : 'text-emerald-400/50 cursor-default'
                  }`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-emerald-400 text-emerald-900' : isCurrent ? 'bg-white text-emerald-700' : 'bg-emerald-500/30 text-emerald-300/70'
                  }`}>
                    {isDone ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium block">{step.label}</span>
                    <span className="text-[10px] opacity-70">{step.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="mt-4 text-emerald-200 hover:text-white text-xs flex items-center gap-2 transition">
            Cancel &amp; Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto space-y-6">
            {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

            {currentStep === 'basic' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                  <p className="text-sm text-gray-500 mt-1">Name &amp; contact details for {user.email}</p>
                </div>
                {/* Avatar upload */}
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Preview" className="h-20 w-20 rounded-full object-cover ring-2 ring-emerald-200" />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-emerald-100">
                        <Camera className="h-8 w-8 text-emerald-300" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow hover:bg-emerald-700 transition"
                      title="Upload photo"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Profile Photo</p>
                    <p className="text-xs text-gray-400 mt-0.5">Optional — JPEG, PNG or WebP, max 3 MB</p>
                    {avatarFile && (
                      <button
                        type="button"
                        onClick={() => { setAvatarFile(null); setAvatarPreview(user.profile_image || null); }}
                        className="mt-1.5 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> Remove new photo
                      </button>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setCropSrc(ev.target?.result as string);
                        setCropFileName(file.name);
                      };
                      reader.readAsDataURL(file);
                      if (avatarInputRef.current) avatarInputRef.current.value = '';
                    }}
                  />
                </div>
                {cropSrc && (
                  <ImageCropModal
                    imageSrc={cropSrc}
                    fileName={cropFileName}
                    onCropComplete={(file, previewUrl) => {
                      setAvatarFile(file);
                      setAvatarPreview(previewUrl);
                      setCropSrc(null);
                    }}
                    onCancel={() => setCropSrc(null)}
                  />
                )}
                <FormField label="Full Name">
                  <Input type="text" value={form.full_name} onChange={e => f('full_name', e.target.value)} placeholder="e.g. Priya Sharma" />
                </FormField>
                <FormField label="Phone / WhatsApp">
                  <div className="flex gap-2">
                    <select
                      value={form.phoneCode}
                      onChange={(e) => f('phoneCode', e.target.value)}
                      className="w-24 shrink-0 rounded-lg border border-gray-200 bg-white py-2 px-2 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+966">🇸🇦 +966</option>
                      <option value="+974">🇶🇦 +974</option>
                      <option value="+968">🇴🇲 +968</option>
                      <option value="+973">🇧🇭 +973</option>
                      <option value="+965">🇰🇼 +965</option>
                      <option value="+60">🇲🇾 +60</option>
                      <option value="+65">🇸🇬 +65</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+81">🇯🇵 +81</option>
                      <option value="+86">🇨🇳 +86</option>
                    </select>
                    <Input type="tel" inputMode="numeric" value={form.phone} onChange={e => f('phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" className="flex-1" />
                  </div>
                </FormField>
                <FormField label="Address">
                  <Textarea rows={2} value={form.address} onChange={e => f('address', e.target.value as string)} placeholder="Full address..." />
                </FormField>
              </>
            )}

            {currentStep === 'teaching' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Teaching Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Subjects, qualification, and experience</p>
                </div>
                <FormField label="Subjects" hint="Select all that apply">
                  <SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} />
                </FormField>
                <FormGrid cols={2}>
                  <FormField label="Qualification">
                    <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
                  </FormField>
                  <FormField label="Experience (years)">
                    <Input type="number" min={0} max={50} value={form.experience_years} onChange={e => f('experience_years', e.target.value)} placeholder="e.g. 5" />
                  </FormField>
                </FormGrid>
                <FormGrid cols={2}>
                  <FormField label="Per Hour Rate" hint="Amount per teaching hour">
                    <Input type="number" min={0} step={1} value={form.per_hour_rate} onChange={e => f('per_hour_rate', e.target.value)} placeholder="e.g. 500" />
                  </FormField>
                  <FormField label="Category" hint="Teacher performance tier">
                    <Select value={form.category} onChange={(v) => f('category', v)} options={[
                      { value: '', label: '— No Category —' },
                      { value: 'A', label: 'Category A — Top Tier' },
                      { value: 'B', label: 'Category B — Mid Tier' },
                      { value: 'C', label: 'Category C — Entry Tier' },
                    ]} />
                  </FormField>
                </FormGrid>
              </>
            )}

            {currentStep === 'notes' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Internal Notes</h2>
                  <p className="text-sm text-gray-500 mt-1">HR notes visible only to staff</p>
                </div>
                <FormField label="Notes">
                  <Textarea rows={5} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Any internal notes..." />
                </FormField>
              </>
            )}
          </div>

          {/* Footer nav */}
          <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
            <div>
              {stepIdx > 0 && (
                <Button variant="ghost" icon={ChevronLeft} onClick={() => setStepIdx(s => s - 1)}>Back</Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {stepIdx < STEPS.length - 1 ? (
                <Button variant="primary" iconRight={ChevronRight} onClick={() => setStepIdx(s => s + 1)} size="lg">Continue</Button>
              ) : (
                <Button variant="primary" icon={Save} onClick={handleSave} loading={saving} size="lg">Save Changes</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Student Modal (multi-step wizard matching create form) ─
function EditStudentModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  type StepKey = 'basic' | 'academic' | 'guardian' | 'notes';
  const STEPS: { key: StepKey; label: string; icon: React.ElementType; desc: string }[] = [
    { key: 'basic',    label: 'Basic Info',        icon: User,          desc: 'Name & contact details' },
    { key: 'academic', label: 'Academic Details',  icon: BookOpen,      desc: 'Grade, board & admission' },
    { key: 'guardian', label: 'Guardian Details',  icon: Users,         desc: 'Parent / guardian info' },
    { key: 'notes',    label: 'Notes',             icon: FileText,      desc: 'Internal HR notes' },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx].key;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const parsePhone = (raw: string) => {
    const CODES = ['+971', '+966', '+974', '+968', '+973', '+965', '+91', '+86', '+81', '+65', '+61', '+60', '+49', '+44', '+33', '+1'];
    for (const code of CODES) {
      if (raw.startsWith(code)) return { code, number: raw.slice(code.length).trim() };
    }
    return { code: '+91', number: raw.replace(/^\+\d+\s*/, '').trim() };
  };
  const parsedPhone = parsePhone(user.phone || '');

  const [form, setForm] = useState({
    full_name: user.full_name,
    phone: parsedPhone.number,
    phoneCode: parsedPhone.code,
    address: user.address || '',
    grade: user.grade || 'Class 10',
    section: user.section || '',
    board: user.board || 'CBSE',
    admission_date: user.admission_date ? user.admission_date.split('T')[0] : '',
    parent_email: user.parent_email || '',
    parent_name: '',
    parent_phone: '',
    parent_whatsapp: '',
    parent_address: '',
    parent_notes: '',
    notes: user.notes || '',
    category: user.category || '',
    assigned_region: user.assigned_region || '',
  });

  // Fetch parent profile on open
  useEffect(() => {
    if (!user.parent_email) return;
    fetch(`/api/v1/hr/users/${encodeURIComponent(user.parent_email)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const p = d.data.user as UserRow;
          setForm(prev => ({
            ...prev,
            parent_name: p.full_name || '',
            parent_phone: p.phone || '',
            parent_whatsapp: p.whatsapp || '',
            parent_address: p.address || '',
            parent_notes: p.notes || '',
          }));
        }
      })
      .catch(() => {});
  }, [user.parent_email]);

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      // 1. Patch student
      const fullPhone = form.phone.trim() ? `${form.phoneCode} ${form.phone.trim()}` : '';
      const studentPayload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        phone: fullPhone || null,
        whatsapp: fullPhone || null,
        address: form.address.trim() || null,
        grade: form.grade,
        section: form.section.trim() || null,
        board: form.board,
        admission_date: form.admission_date || null,
        parent_email: form.parent_email.trim().toLowerCase() || null,
        notes: form.notes.trim() || null,
        category: form.category || null,
        assigned_region: form.assigned_region || null,
      };
      const res1 = await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentPayload),
      });
      const d1 = await res1.json();
      if (!d1.success) { setError(d1.error || 'Failed to save student'); return; }

      // 2. Patch parent if email set
      const pe = form.parent_email.trim().toLowerCase();
      if (pe) {
        const parentPayload: Record<string, unknown> = {
          full_name: form.parent_name.trim() || undefined,
          phone: form.parent_phone.trim() || null,
          whatsapp: form.parent_whatsapp.trim() || null,
          address: form.parent_address.trim() || null,
          notes: form.parent_notes.trim() || null,
        };
        await fetch(`/api/v1/hr/users/${encodeURIComponent(pe)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parentPayload),
        });
      }

      toast.success('Saved successfully');
      setTimeout(onSaved, 400);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Sidebar */}
        <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Edit Student</h2>
            <p className="text-emerald-200 text-xs mt-1">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <div className="space-y-1 flex-1">
            {STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const StepIcon = step.icon;
              return (
                <button key={step.key} type="button"
                  onClick={() => { if (idx < stepIdx) setStepIdx(idx); }}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all text-left ${
                    isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-emerald-200 hover:bg-white/10 cursor-pointer' : 'text-emerald-400/50 cursor-default'
                  }`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-emerald-400 text-emerald-900' : isCurrent ? 'bg-white text-emerald-700' : 'bg-emerald-500/30 text-emerald-300/70'
                  }`}>
                    {isDone ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium block">{step.label}</span>
                    <span className="text-[10px] opacity-70">{step.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="mt-4 text-emerald-200 hover:text-white text-xs flex items-center gap-2 transition">
            Cancel &amp; Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto space-y-6">
            {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

            {currentStep === 'basic' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                  <p className="text-sm text-gray-500 mt-1">Name &amp; contact details for {user.email}</p>
                </div>
                <FormField label="Full Name">
                  <Input type="text" value={form.full_name} onChange={e => f('full_name', e.target.value)} />
                </FormField>
                <FormField label="Phone / WhatsApp">
                  <div className="flex gap-2">
                    <select
                      value={form.phoneCode}
                      onChange={(e) => f('phoneCode', e.target.value)}
                      className="w-24 shrink-0 rounded-lg border border-gray-200 bg-white py-2 px-2 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+966">🇸🇦 +966</option>
                      <option value="+974">🇶🇦 +974</option>
                      <option value="+968">🇴🇲 +968</option>
                      <option value="+973">🇧🇭 +973</option>
                      <option value="+965">🇰🇼 +965</option>
                      <option value="+60">🇲🇾 +60</option>
                      <option value="+65">🇸🇬 +65</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+81">🇯🇵 +81</option>
                      <option value="+86">🇨🇳 +86</option>
                    </select>
                    <Input type="tel" inputMode="numeric" value={form.phone} onChange={e => f('phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" className="flex-1" />
                  </div>
                </FormField>
                <FormField label="Address">
                  <Textarea rows={2} value={form.address} onChange={e => f('address', e.target.value)} />
                </FormField>
              </>
            )}

            {currentStep === 'academic' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Academic Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Grade, board and admission</p>
                </div>
                <FormGrid cols={2}>
                  <FormField label="Grade">
                    <Select value={form.grade} onChange={v => f('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} />
                  </FormField>
                  <FormField label="Section">
                    <Input type="text" value={form.section} onChange={e => f('section', e.target.value)} placeholder="e.g. A" />
                  </FormField>
                </FormGrid>
                <FormGrid cols={2}>
                  <FormField label="Board">
                    <Select value={form.board} onChange={v => f('board', v)} options={BOARDS.map(b => ({ value: b, label: b }))} />
                  </FormField>
                  <FormField label="Admission Date">
                    <Input type="date" value={form.admission_date} onChange={e => f('admission_date', e.target.value)} />
                  </FormField>
                </FormGrid>
                <FormField label="Category" hint="Student performance tier (from demo exam or manual)">
                  <Select value={form.category} onChange={v => f('category', v)} options={[
                    { value: '', label: '— No Category —' },
                    { value: 'A', label: 'Category A — High Performer' },
                    { value: 'B', label: 'Category B — Average' },
                    { value: 'C', label: 'Category C — Needs Support' },
                  ]} />
                </FormField>
                <FormField label="Region" hint="Helps schedule sessions in the right timezone">
                  <Select value={form.assigned_region} onChange={v => f('assigned_region', v)} options={[
                    { value: '', label: '— Select Region —' },
                    ...STUDENT_REGIONS.map(r => ({ value: r.value, label: r.label })),
                  ]} />
                </FormField>
              </>
            )}

            {currentStep === 'guardian' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Guardian Details</h2>
                  <p className="text-sm text-gray-500 mt-1">Parent / guardian linked to this student</p>
                </div>
                <FormField label="Parent Email" hint="Change to link a different parent account">
                  <Input type="email" value={form.parent_email} onChange={e => f('parent_email', e.target.value)} placeholder="parent@gmail.com" />
                </FormField>
                {form.parent_email.trim() && (
                  <>
                    <FormField label="Parent Full Name">
                      <Input type="text" value={form.parent_name} onChange={e => f('parent_name', e.target.value)} />
                    </FormField>
                    <FormGrid cols={2}>
                      <FormField label="Parent Phone">
                        <Input type="tel" value={form.parent_phone} onChange={e => f('parent_phone', e.target.value)} />
                      </FormField>
                      <FormField label="Parent WhatsApp">
                        <Input type="tel" value={form.parent_whatsapp} onChange={e => f('parent_whatsapp', e.target.value)} />
                      </FormField>
                    </FormGrid>
                    <FormField label="Parent Address">
                      <Textarea rows={2} value={form.parent_address} onChange={e => f('parent_address', e.target.value)} />
                    </FormField>
                    <FormField label="Parent Notes">
                      <Textarea rows={2} value={form.parent_notes} onChange={e => f('parent_notes', e.target.value)} />
                    </FormField>
                  </>
                )}
              </>
            )}

            {currentStep === 'notes' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Internal Notes</h2>
                  <p className="text-sm text-gray-500 mt-1">HR notes visible only to staff</p>
                </div>
                <FormField label="Notes">
                  <Textarea rows={5} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Any internal notes..." />
                </FormField>
              </>
            )}
          </div>

          {/* Footer nav */}
          <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
            <div>
              {stepIdx > 0 && (
                <Button variant="ghost" icon={ChevronLeft} onClick={() => setStepIdx(s => s - 1)}>Back</Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {stepIdx < STEPS.length - 1 ? (
                <Button variant="primary" iconRight={ChevronRight} onClick={() => setStepIdx(s => s + 1)} size="lg">Continue</Button>
              ) : (
                <Button variant="primary" icon={Save} onClick={handleSave} loading={saving} size="lg">Save Changes</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; new_password?: string } | null>(null);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(password.trim() ? { password: password.trim() } : {}),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message || data.error, new_password: data.data?.new_password });
    } catch { setResult({ success: false, message: 'Network error' }); }
    finally { setResetting(false); }
  };

  return (
    <Modal open onClose={onClose} title="Reset Password" subtitle={`${user.full_name} · ${user.email}`} maxWidth="sm">
      {result ? (
        <div className="space-y-4">
          <Alert variant={result.success ? 'success' : 'error'} message={result.message} />
          {result.success && result.new_password && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-gray-500 mb-1">New Password</p>
              <p className="font-mono text-lg font-bold text-emerald-700">{result.new_password}</p>
              <p className="mt-1 text-xs text-gray-400">Also emailed to {user.email}</p>
            </div>
          )}
          <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set a new password or leave blank to auto-generate a secure password. An email will be sent to the user.
          </p>
          <FormField label="New Password" hint="Optional — auto-generated if blank">
            <PwdInput value={password} onChange={setPassword} placeholder="Leave blank to auto-generate" />
          </FormField>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" icon={KeyRound} onClick={handleReset} loading={resetting}>Reset &amp; Email</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Action Dropdown ─────────────────────────────────────────
import type { LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
function ActionMenu({ items }: { items: { label: string; icon: LucideIcon; onClick: () => void; className?: string }[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX });
    setOpen(o => !o);
  };

  if (items.length === 0) return null;
  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="inline-flex items-center justify-center rounded-md p-1.5 min-h-[36px] min-w-[36px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
      >
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: coords.top, left: coords.left, transform: 'translateX(-100%)', zIndex: 9999 }}
          className="min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
        >
          {items.map((item, i) => (
            <button key={i} onClick={() => { item.onClick(); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition hover:bg-gray-50 ${item.className ?? 'text-gray-700'}`}>
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── UsersTab (main export) ──────────────────────────────────
function UsersTabInner({ role, label, permissions, hideCreate, hideActions, active = true, extraHeaderActions }: { role: string; label: string; permissions?: Record<string, boolean>; hideCreate?: boolean; hideActions?: boolean; active?: boolean; extraHeaderActions?: React.ReactNode }) {
  const platformName = usePlatformName();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [reportUser, setReportUser] = useState<UserRow | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activated, setActivated] = useState(active);
  const toast = useToast();

  // Track first activation — once active, stay activated (already fetched)
  useEffect(() => { if (active) setActivated(true); }, [active]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ role, ...(search ? { q: search } : {}), ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}), ...(gradeFilter !== 'all' ? { grade: gradeFilter } : {}) });
      const res = await fetch(`/api/v1/hr/users?${qs}`);
      const data = await res.json();
      if (data.success) { setUsers(data.data.users); setTotal(data.data.total); }
    } finally { setLoading(false); }
  }, [role, search, categoryFilter, gradeFilter]);

  useEffect(() => { if (activated) fetchUsers(); }, [fetchUsers, activated]);

  const canDeactivate = permissions?.users_deactivate !== false;
  const { confirm } = useConfirm();

  const handleDeactivate = async (email: string, isActive: boolean) => {
    const ok = await confirm({
      title: isActive ? 'Deactivate User' : 'Reactivate User',
      message: `${isActive ? 'Deactivate' : 'Reactivate'} ${email}?`,
      confirmLabel: isActive ? 'Deactivate' : 'Reactivate',
      variant: isActive ? 'danger' : 'info',
    });
    if (!ok) return;
    try {
      if (isActive) {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
      }
      toast.success(`User ${isActive ? 'deactivated' : 'reactivated'} successfully`);
      fetchUsers();
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const handlePermanentDelete = async (email: string, name: string) => {
    const ok = await confirm({
      title: 'Permanently Delete User',
      message: `This will permanently delete ${name} (${email}) and all their profile data. This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}?permanent=true`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Failed to delete user'); return; }
      toast.success(`User ${name} permanently deleted`);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  // ── Selection helpers ──────────────────────────────────
  const toggleSelect = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  const toggleSelectAll = (filteredList: UserRow[]) => {
    const allSelected = filteredList.length > 0 && filteredList.every(u => selectedEmails.has(u.email));
    if (allSelected) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredList.map(u => u.email)));
    }
  };

  const clearSelection = () => setSelectedEmails(new Set());

  // ── Bulk action handlers ──────────────────────────────
  const handleBulkDeactivate = async () => {
    const emails = [...selectedEmails];
    const ok = await confirm({
      title: `Deactivate ${emails.length} User${emails.length > 1 ? 's' : ''}`,
      message: `This will deactivate ${emails.length} selected user${emails.length > 1 ? 's' : ''}. They will no longer be able to log in.`,
      confirmLabel: 'Deactivate All',
      variant: 'danger',
    });
    if (!ok) return;
    setBulkLoading(true);
    try {
      let success = 0, failed = 0;
      for (const email of emails) {
        try {
          await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
          success++;
        } catch { failed++; }
      }
      toast.success(`${success} user${success > 1 ? 's' : ''} deactivated${failed ? `, ${failed} failed` : ''}`);
      clearSelection();
      fetchUsers();
    } finally { setBulkLoading(false); }
  };

  const handleBulkActivate = async () => {
    const emails = [...selectedEmails];
    const ok = await confirm({
      title: `Activate ${emails.length} User${emails.length > 1 ? 's' : ''}`,
      message: `This will reactivate ${emails.length} selected user${emails.length > 1 ? 's' : ''}.`,
      confirmLabel: 'Activate All',
      variant: 'info',
    });
    if (!ok) return;
    setBulkLoading(true);
    try {
      let success = 0, failed = 0;
      for (const email of emails) {
        try {
          await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true }),
          });
          success++;
        } catch { failed++; }
      }
      toast.success(`${success} user${success > 1 ? 's' : ''} activated${failed ? `, ${failed} failed` : ''}`);
      clearSelection();
      fetchUsers();
    } finally { setBulkLoading(false); }
  };

  const handleBulkDelete = async () => {
    const emails = [...selectedEmails];
    const ok = await confirm({
      title: `Permanently Delete ${emails.length} User${emails.length > 1 ? 's' : ''}`,
      message: `This will PERMANENTLY delete ${emails.length} selected user${emails.length > 1 ? 's' : ''} and all their data. This action cannot be undone!`,
      confirmLabel: 'Delete All Permanently',
      variant: 'danger',
    });
    if (!ok) return;
    setBulkLoading(true);
    try {
      let success = 0, failed = 0;
      for (const email of emails) {
        try {
          const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}?permanent=true`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) success++; else failed++;
        } catch { failed++; }
      }
      toast.success(`${success} user${success > 1 ? 's' : ''} deleted${failed ? `, ${failed} failed` : ''}`);
      clearSelection();
      fetchUsers();
    } finally { setBulkLoading(false); }
  };

  const filtered = users.filter(u => {
    if (statusFilter === 'active') return u.is_active;
    if (statusFilter === 'inactive') return !u.is_active;
    return true;
  });

  const activeCount = users.filter(u => u.is_active).length;
  const inactiveCount = users.length - activeCount;

  // Grade distribution for students
  const gradeMap: Record<string, number> = {};
  if (role === 'student') {
    for (const u of users) {
      const g = u.grade || 'Unassigned';
      gradeMap[g] = (gradeMap[g] || 0) + 1;
    }
  }
  const uniqueGrades = Object.keys(gradeMap).length;

  // If a report is being viewed, show it inline instead of the table
  if (reportUser) {
    return (
      <div>
        {reportUser.portal_role === 'teacher'
          ? <TeacherReportView user={reportUser} onBack={() => setReportUser(null)} />
          : <StudentReportView user={reportUser} onBack={() => setReportUser(null)} />
        }
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────── */}
      <PageHeader
        icon={role === 'student' ? GraduationCap : role === 'teacher' ? BookOpen : Users}
        title={label}
        subtitle={`${activeCount} active · ${inactiveCount} inactive`}
      >
        <RefreshButton loading={loading} onClick={fetchUsers} />
        {extraHeaderActions}
        {!hideCreate && (
          <Button variant="primary" icon={UserPlus} onClick={() => setShowCreate(true)}>
            Add {label.slice(0, -1)}
          </Button>
        )}
      </PageHeader>

      {/* ── Stat Cards ─────────────────────────────── */}
      <div className={`grid gap-3 ${role === 'student' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <StatCard icon={Users} label={`Total ${label}`} value={total} variant="default" />
        <StatCard icon={UserCheck} label="Active" value={activeCount} variant="success" />
        <StatCard icon={UserX} label="Inactive" value={inactiveCount} variant={inactiveCount > 0 ? 'danger' : 'default'} />
        {role === 'student' && <StatCard icon={GraduationCap} label="Grades" value={uniqueGrades} variant="info" />}
      </div>

      {/* ── Search + Filter ────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${label.toLowerCase()}…`}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active Only' },
            { value: 'inactive', label: 'Inactive Only' },
          ]}
        />
        {(role === 'student' || role === 'teacher') && (
          <FilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'A', label: 'Category A' },
              { value: 'B', label: 'Category B' },
              { value: 'C', label: 'Category C' },
            ]}
          />
        )}
        {role === 'student' && (
          <FilterSelect
            value={gradeFilter}
            onChange={setGradeFilter}
            options={[
              { value: 'all', label: 'All Grades' },
              ...GRADES.map(g => ({ value: g, label: g })),
            ]}
          />
        )}
        <span className="text-xs text-gray-400 ml-auto">Showing {filtered.length} of {total}</span>
      </div>

      {/* ── Bulk Action Bar ────────────────────────── */}
      {selectedEmails.size > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              {selectedEmails.size}
            </div>
            <span className="text-sm font-medium text-emerald-800">
              {selectedEmails.size} selected
            </span>
          </div>
          <div className="h-4 w-px bg-emerald-200" />
          {canDeactivate && (
            <button
              onClick={handleBulkDeactivate}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </button>
          )}
          {canDeactivate && (
            <button
              onClick={handleBulkActivate}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <UserCheck2 className="h-3.5 w-3.5" /> Activate
            </button>
          )}
          {!hideActions && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
          {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
        </div>
      )}

      {/* Table */}
      {loading && users.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={role === 'teacher' ? BookOpen : role === 'student' ? GraduationCap : role === 'parent' ? Shield : UserCheck}
          message={users.length === 0 ? `No ${label.toLowerCase()} yet — click "Add ${label.slice(0, -1)}" to create the first account` : `No ${label.toLowerCase()} match the selected filter`}
        />
      ) : (
        <TableWrapper
          footer={
            <span>Showing {filtered.length} of {total} {label.toLowerCase()}</span>
          }
        >
          <THead>
            <TH className="w-10">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every(u => selectedEmails.has(u.email))}
                onChange={() => toggleSelectAll(filtered)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </TH>
            <TH>Name</TH>
            <TH>Contact</TH>
            {role === 'teacher' && <TH>Subjects</TH>}
            {role === 'teacher' && <TH>Rate/hr</TH>}
            {role === 'student' && <TH>Grade / Board</TH>}
            {role === 'student' && <TH>Enrolled As</TH>}
            {role === 'student' && <TH>Assigned Batches</TH>}
            {(role === 'student' || role === 'teacher') && <TH>Category</TH>}
            {role === 'student' && <TH>Source</TH>}
            {role === 'parent' && <TH>Children</TH>}
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {filtered.map((u) => {
              const isExpanded = expandedEmail === u.email;
              return (
                <React.Fragment key={u.email}>
                  <TRow
                    selected={isExpanded || selectedEmails.has(u.email)}
                    onClick={() => setExpandedEmail(isExpanded ? null : u.email)}
                  >
                    <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(u.email)}
                        onChange={() => toggleSelect(u.email)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} src={u.profile_image} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800 truncate max-w-40">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-40">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                      {!u.phone && <span className="text-gray-300">—</span>}
                    </td>
                    {role === 'teacher' && (
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {u.subjects && u.subjects.length > 0
                          ? u.subjects.slice(0, 2).join(', ') + (u.subjects.length > 2 ? ` +${u.subjects.length - 2}` : '')
                          : <Badge label="No subjects" variant="warning" icon={AlertCircle} />}
                      </td>
                    )}
                    {role === 'teacher' && (
                      <td className="px-4 py-3 text-xs text-gray-600 font-medium">
                        {u.per_hour_rate != null ? `₹${u.per_hour_rate}` : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {role === 'student' && (
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <p className="font-medium">{u.grade || '—'}</p>
                        {u.board && <p className="text-[10px] text-gray-400">{u.board}</p>}
                      </td>
                    )}
                    {role === 'student' && (() => {
                      const bt = u.enrollment_batch_type;
                      const btLabel = bt ? (BATCH_TYPE_LABELS[bt] || bt) : null;
                      const isCreditType = bt ? CREDIT_BATCH_TYPES.has(bt) : false;
                      return (
                        <td className="px-4 py-3">
                          {btLabel ? (
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                              isCreditType ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            }`}>{btLabel}</span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                          {u.assigned_region && <p className="text-[10px] text-gray-400 mt-0.5">{u.assigned_region}</p>}
                        </td>
                      );
                    })()}
                    {role === 'student' && (() => {
                      const batches = Array.isArray(u.current_batches) ? u.current_batches : [];
                      return (
                        <td className="px-4 py-3">
                          {batches.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {batches.slice(0, 2).map(b => (
                                <span key={b.batch_id} title={b.batch_name} className="inline-block text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 rounded px-1.5 py-0.5 max-w-[140px] truncate">
                                  {b.batch_name}
                                </span>
                              ))}
                              {batches.length > 2 && (
                                <span className="text-[10px] text-gray-400">+{batches.length - 2} more</span>
                              )}
                            </div>
                          ) : <span className="text-xs text-gray-300">None</span>}
                        </td>
                      );
                    })()}
                    {(role === 'student' || role === 'teacher') && (
                      <td className="px-4 py-3">
                        {u.category && CATEGORY_STYLES[u.category] ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${CATEGORY_STYLES[u.category].bg} ${CATEGORY_STYLES[u.category].text} ${CATEGORY_STYLES[u.category].border}`}>
                            {CATEGORY_STYLES[u.category].label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    )}
                    {role === 'student' && (() => {
                      const src = u.enrollment_source;
                      const isCRM = src === 'crm';
                      const isPortal = src === 'portal';
                      return (
                        <td className="px-4 py-3">
                          <span title={u.enrolled_by_name ? `By: ${u.enrolled_by_name}` : undefined}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                              isCRM
                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                : isPortal
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                            {isCRM ? 'CRM' : isPortal ? 'Portal' : 'Manual'}
                          </span>
                          {u.enrolled_by_name && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[80px]" title={u.enrolled_by_name}>{u.enrolled_by_name}</p>
                          )}
                        </td>
                      );
                    })()}
                    {role === 'parent' && (
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {u.children && u.children.length > 0
                          ? u.children.map(c => c.name).join(', ')
                          : <span className="text-gray-300">No children linked</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <ActiveIndicator active={u.is_active} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu items={[
                        ...((u.portal_role === 'student' || u.portal_role === 'teacher') ? [{
                          label: 'Monthly Report', icon: BarChart3, onClick: () => setReportUser(u),
                          className: 'text-indigo-600 hover:bg-indigo-50',
                        }] : []),
                        ...(!hideActions ? [
                          { label: 'Reset Password', icon: KeyRound, onClick: () => setResetUser(u), className: 'text-gray-700' },
                          { label: 'Edit', icon: Pencil, onClick: () => setEditUser(u), className: 'text-gray-700' },
                          ...(canDeactivate ? [{
                            label: u.is_active ? 'Deactivate' : 'Reactivate',
                            icon: u.is_active ? UserX : UserCheck2,
                            onClick: () => handleDeactivate(u.email, u.is_active),
                            className: u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50',
                          }] : []),
                          { label: 'Delete', icon: Trash2, onClick: () => handlePermanentDelete(u.email, u.full_name), className: 'text-red-600 hover:bg-red-50' },
                        ] : []),
                      ]} />
                    </td>
                  </TRow>
                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={role === 'student' ? 10 : role === 'teacher' ? 8 : role === 'parent' ? 7 : 6} className="bg-emerald-50/40 border-b border-emerald-100 px-4 py-4">
                        <UserDetailPanel user={u} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </TableWrapper>
      )}

      {/* Modals */}
      <CreateUserModal role={role} open={showCreate} onClose={() => { setShowCreate(false); fetchUsers(); }} onCreated={() => { fetchUsers(); }} />
      {editUser && editUser.portal_role === 'student' && (
        <EditStudentModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); fetchUsers(); }} />
      )}
      {editUser && editUser.portal_role === 'teacher' && (
        <EditTeacherModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); fetchUsers(); }} />
      )}
      {editUser && editUser.portal_role !== 'student' && editUser.portal_role !== 'teacher' && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); fetchUsers(); }} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </div>
  );
}

export default React.memo(UsersTabInner);
