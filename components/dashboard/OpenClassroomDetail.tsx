'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, Users, Clock, DollarSign, Copy, Check, ExternalLink, Phone,
  Eye, AlertTriangle, Brain, CheckCircle2, Activity, Loader2,
  BookOpen, Send, Ban, Video, ChevronDown, ChevronRight,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Participant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  payment_status: string;
  invoice_id: string | null;
  paid_at: string | null;
  joined_at: string | null;
  left_at: string | null;
}

interface Share {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  shared_at: string;
}

interface MonitoringSummary {
  student_email: string;
  event_type: string;
  event_count: number;
  total_duration_sec: number;
  avg_confidence: number;
}

interface MonitoringAlert {
  id: string;
  target_email: string;
  alert_type: string;
  message: string;
  severity: string;
  acknowledged: boolean;
  created_at: string;
}

interface AttentionSummary {
  student_email: string;
  attentive_sec: number;
  distracted_sec: number;
  total_tracked_sec: number;
  eyes_closed_count: number;
  looking_away_count: number;
  phone_count: number;
  sleeping_count: number;
}

interface AttendanceSession {
  participant_email: string;
  participant_name: string;
  participant_role: string;
  first_join_at: string | null;
  last_leave_at: string | null;
  total_duration_sec: number;
  join_count: number;
  status: string;
  late_by_sec: number;
}

interface AttendanceLog {
  participant_email: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface AnswerItem {
  question_text: string;
  options: string[];
  correct_answer: number;
  selected_option: number | null;
  is_correct: boolean;
  marks: number;
  marks_awarded: number;
  time_taken: number;
  topic: string;
}

interface ExamResult {
  student_email: string;
  student_name: string;
  topic_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  started_at: string | null;
  completed_at: string | null;
  answers: AnswerItem[];
}

interface ClassroomDetail {
  classroom: Record<string, unknown>;
  participants: Participant[];
  shares: Share[];
  monitoring_summary: MonitoringSummary[];
  monitoring_alerts: MonitoringAlert[];
  attention_summary: AttentionSummary[];
  attendance_sessions: AttendanceSession[];
  attendance_logs: AttendanceLog[];
  exam_results: ExamResult[];
  revenue: { paid_count: number; total_revenue_paise: number };
}

const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function fmtTime(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });
}

function durStr(sec: number) {
  if (!sec || sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function OpenClassroomDetail({
  classroomId,
  hostToken,
  onClose,
}: {
  classroomId: string;
  hostToken: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ClassroomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [expandedExam, setExpandedExam] = useState<number | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/open-classroom/${hostToken}/details`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Failed to load');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [hostToken]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-12 text-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
        <p className="text-sm text-gray-400 mt-2">Loading classroom details…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8 text-center">
        <p className="text-sm text-red-500">{error || 'Failed to load'}</p>
        <button onClick={onClose} className="mt-3 text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>
    );
  }

  const c = data.classroom;
  const isOwnerMeeting = String(c.teacher_role || '') === 'owner';
  const hostLabel = isOwnerMeeting ? 'Chairman (Host)' : 'Teacher (Host)';
  const hostLinkLabel = isOwnerMeeting ? 'Chairman Link' : 'Teacher Link';
  const students = data.participants.filter(p => p.role === 'student');
  const teacherPart = data.participants.find(p => p.role === 'teacher');
  const hostLink = String(c.host_link || '');
  const joinLink = String(c.join_link || '');

  const sections = [
    { id: 'overview', label: 'Overview', icon: Video },
    { id: 'participants', label: `Students (${students.length})`, icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'monitoring', label: 'AI Monitoring', icon: Brain },
    { id: 'exams', label: `Exams (${data.exam_results.length})`, icon: BookOpen },
    { id: 'shares', label: `Shares (${data.shares.length})`, icon: Send },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary px-5 py-4 text-white flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-primary/60 text-[10px] font-medium uppercase tracking-wide">Open Classroom Details</p>
          <h2 className="text-lg font-bold leading-tight mt-0.5 truncate">{String(c.title)}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-primary/40 mt-1.5">
            {c.teacher_name ? <span>🧑‍🏫 {String(c.teacher_name)}</span> : null}
            {c.scheduled_at ? <span>📅 {fmt(String(c.scheduled_at))}</span> : null}
            <span>⏱ {c.duration_minutes ? `${String(c.duration_minutes)} min` : 'Unlimited'}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
              c.status === 'live' ? 'bg-white/20' : c.status === 'ended' ? 'bg-black/20' : 'bg-white/10'
            }`}>
              {String(c.status).toUpperCase()}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition shrink-0 mt-0.5">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Section tabs */}
      <div className="px-5 py-2 border-b border-gray-100 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 min-w-max">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSection === s.id
                  ? 'bg-primary/5 text-primary border border-primary/20'
                  : 'text-gray-500 hover:bg-gray-50 border border-transparent'
              }`}>
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">

        {/* ── Overview ── */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Students" value={students.length} icon={Users} />
              <StatCard label="Duration" value={c.duration_minutes ? `${c.duration_minutes} min` : 'Unlimited'} icon={Clock} />
              <StatCard label="Revenue" value={`₹${(Number(data.revenue?.total_revenue_paise ?? 0) / 100).toLocaleString('en-IN')}`} icon={DollarSign} />
              <StatCard label="Alerts" value={data.monitoring_alerts.length} icon={AlertTriangle} />
            </div>

            {/* Description */}
            {c.description ? (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{String(c.description)}</p>
            ) : null}

            {/* Teacher / Chairman Info */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">{hostLabel}</p>
              <p className="text-sm text-gray-800">{String(c.teacher_name || c.teacher_email || '—')}</p>
              {c.teacher_email ? <p className="text-xs text-gray-500">{String(c.teacher_email)}</p> : null}
              {teacherPart?.joined_at && (
                <p className="text-[10px] text-amber-600 mt-1">Joined: {fmt(teacherPart.joined_at)}</p>
              )}
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <LinkRow label={hostLinkLabel} url={hostLink} field="host" copiedField={copiedField} onCopy={copy} />
              <LinkRow label="Join Link" url={joinLink} field="join" copiedField={copiedField} onCopy={copy} />
            </div>

            {/* Payment info */}
            {c.payment_enabled ? (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-700">Paid Entry</p>
                  <p className="text-sm text-gray-800">₹{(Number(c.price_paise) / 100).toFixed(0)} per participant</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-700">{Number(data.revenue.paid_count)}</p>
                  <p className="text-[10px] text-blue-500">paid</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Participants ── */}
        {activeSection === 'participants' && (
          <div className="space-y-3">
            {students.length === 0 ? (
              <EmptyState icon={Users} text="No students have joined yet" />
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Contact</th>
                      <th className="text-left px-3 py-2 font-medium">Payment</th>
                      <th className="text-left px-3 py-2 font-medium">Joined</th>
                      <th className="text-left px-3 py-2 font-medium">Left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map(p => {
                      const attn = data.attention_summary.find(a => a.student_email === p.email);
                      const attnPct = attn ? pct(Number(attn.attentive_sec), Number(attn.total_tracked_sec)) : null;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{p.name}</p>
                            {attnPct !== null && (
                              <span className={`text-[10px] ${attnPct >= 70 ? 'text-primary' : attnPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                {attnPct}% attentive
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {p.email && <p className="truncate max-w-[160px]">{p.email}</p>}
                            {p.phone && <p className="text-[10px] text-gray-400">{p.phone}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              p.payment_status === 'paid' ? 'bg-primary/5 text-primary border-primary/20' :
                              p.payment_status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                              {p.payment_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{fmtTime(p.joined_at)}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtTime(p.left_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance ── */}
        {activeSection === 'attendance' && (
          <div className="space-y-4">
            {data.attendance_sessions.length === 0 ? (
              <EmptyState icon={Clock} text="No attendance data recorded" />
            ) : (
              <>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Duration</th>
                        <th className="text-left px-3 py-2 font-medium">Joins</th>
                        <th className="text-left px-3 py-2 font-medium">First In</th>
                        <th className="text-left px-3 py-2 font-medium">Last Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.attendance_sessions.map((a, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{a.participant_name || a.participant_email}</p>
                            <p className="text-[10px] text-gray-400">{a.participant_role}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              a.status === 'present' ? 'bg-primary/5 text-primary border-primary/20' :
                              a.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              {a.status}{a.late_by_sec > 0 ? ` (${durStr(a.late_by_sec)} late)` : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 font-medium">{durStr(Number(a.total_duration_sec))}</td>
                          <td className="px-3 py-2 text-gray-500">{a.join_count}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtTime(a.first_join_at)}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtTime(a.last_leave_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Join/Leave log */}
                {data.attendance_logs.length > 0 && (
                  <CollapsibleSection title="Join/Leave Timeline" count={data.attendance_logs.length}>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {data.attendance_logs.map((log, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded hover:bg-gray-50">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            log.event_type === 'join' || log.event_type === 'rejoin' ? 'bg-primary' :
                            log.event_type === 'leave' ? 'bg-red-400' :
                            'bg-gray-400'
                          }`} />
                          <span className="text-gray-500 font-mono w-16 shrink-0">{fmtTime(log.created_at)}</span>
                          <span className="text-gray-400 w-28 truncate shrink-0">{log.participant_email}</span>
                          <span className="font-medium text-gray-700">{log.event_type}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}
              </>
            )}
          </div>
        )}

        {/* ── AI Monitoring ── */}
        {activeSection === 'monitoring' && (
          <div className="space-y-4">
            {/* Per-student attention cards */}
            {data.attention_summary.length === 0 ? (
              <EmptyState icon={Brain} text="No AI monitoring data — attention tracking may not have been active" />
            ) : (
              <>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Attention Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.attention_summary.map(a => {
                    const totalSec = Number(a.total_tracked_sec) || 1;
                    const attnPct = pct(Number(a.attentive_sec), totalSec);
                    const participant = data.participants.find(p => p.email === a.student_email);
                    return (
                      <div key={a.student_email} className="border border-gray-100 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-800">{participant?.name || a.student_email}</p>
                          <span className={`text-xs font-bold ${attnPct >= 70 ? 'text-primary' : attnPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                            {attnPct}%
                          </span>
                        </div>
                        {/* Attention bar */}
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${attnPct}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                          <span>⏱ {durStr(totalSec)} tracked</span>
                          {Number(a.eyes_closed_count) > 0 && <span>😴 {a.eyes_closed_count} eyes closed</span>}
                          {Number(a.looking_away_count) > 0 && <span>👀 {a.looking_away_count} looked away</span>}
                          {Number(a.phone_count) > 0 && <span>📱 {a.phone_count} phone</span>}
                          {Number(a.sleeping_count) > 0 && <span>💤 {a.sleeping_count} sleeping</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Alerts */}
            {data.monitoring_alerts.length > 0 && (
              <CollapsibleSection title="Monitoring Alerts" count={data.monitoring_alerts.length}>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {data.monitoring_alerts.map(alert => (
                    <div key={alert.id} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.low}`}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{alert.message || alert.alert_type}</p>
                        <p className="text-[10px] opacity-70">{alert.target_email} · {fmtTime(alert.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Detailed breakdown by event type */}
            {data.monitoring_summary.length > 0 && (
              <CollapsibleSection title="Event Breakdown" count={data.monitoring_summary.length}>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Student</th>
                        <th className="text-left px-3 py-2 font-medium">Event</th>
                        <th className="text-right px-3 py-2 font-medium">Count</th>
                        <th className="text-right px-3 py-2 font-medium">Duration</th>
                        <th className="text-right px-3 py-2 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.monitoring_summary.map((m, i) => {
                        const p = data.participants.find(p => p.email === m.student_email);
                        return (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-3 py-1.5 text-gray-700">{p?.name || m.student_email || '—'}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                m.event_type === 'attentive' ? 'bg-primary/5 text-primary' : 'bg-amber-50 text-amber-700'
                              }`}>{m.event_type}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{m.event_count}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{durStr(Number(m.total_duration_sec))}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{Math.round(Number(m.avg_confidence))}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* ── Exams ── */}
        {activeSection === 'exams' && (
          <div className="space-y-3">
            {data.exam_results.length === 0 ? (
              <EmptyState icon={BookOpen} text="No exams were conducted during this session" />
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Student</th>
                      <th className="text-right px-3 py-2 font-medium">Score</th>
                      <th className="text-right px-3 py-2 font-medium">%</th>
                      <th className="text-left px-3 py-2 font-medium">Started</th>
                      <th className="text-left px-3 py-2 font-medium">Completed</th>
                      <th className="px-3 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.exam_results.flatMap((e, i) => {
                      const isOpen = expandedExam === i;
                      const rows = [
                        <tr key={`er-${i}`}
                          className="hover:bg-gray-50/50 cursor-pointer"
                          onClick={() => setExpandedExam(isOpen ? null : i)}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{e.student_name || e.student_email}</p>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">{e.score}/{e.total_questions}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-bold ${
                              Number(e.percentage) >= 70 ? 'text-primary' :
                              Number(e.percentage) >= 40 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {Math.round(Number(e.percentage))}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{fmtTime(e.started_at)}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtTime(e.completed_at)}</td>
                          <td className="px-3 py-2 text-gray-400">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </td>
                        </tr>,
                      ];
                      if (isOpen && Array.isArray(e.answers) && e.answers.length > 0) {
                        rows.push(
                          <tr key={`qa-${i}`}>
                            <td colSpan={6} className="px-4 py-4 bg-gray-50/80">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Questions &amp; Answers</p>
                              <div className="space-y-3">
                                {e.answers.map((ans, qi) => (
                                  <div key={qi} className={`rounded-lg border px-4 py-3 ${
                                    ans.is_correct ? 'border-primary/20 bg-primary/5/60' :
                                    ans.selected_option === null ? 'border-gray-200 bg-gray-50' :
                                    'border-red-200 bg-red-50/50'
                                  }`}>
                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                      <p className="text-[11px] font-medium text-gray-800 flex-1 leading-snug">
                                        <span className="text-gray-400 font-normal mr-1">Q{qi + 1}.</span>
                                        {ans.question_text}
                                      </p>
                                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        ans.is_correct ? 'text-primary bg-primary/10' :
                                        ans.selected_option === null ? 'text-gray-500 bg-gray-200' :
                                        'text-red-700 bg-red-100'
                                      }`}>
                                        {ans.is_correct ? `+${ans.marks}` : ans.selected_option === null ? 'Skipped' : '0'}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {ans.options.map((opt, oi) => (
                                        <div key={oi} className={`text-[10px] px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 ${
                                          oi === ans.correct_answer
                                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                                            : oi === ans.selected_option && !ans.is_correct
                                            ? 'border-red-400 bg-red-100 text-red-800'
                                            : 'border-gray-200 text-gray-600'
                                        }`}>
                                          <span className="font-bold text-gray-400 shrink-0">{'ABCD'[oi]}.</span>
                                          <span className="flex-1">{opt}</span>
                                          {oi === ans.correct_answer && <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />}
                                          {oi === ans.selected_option && !ans.is_correct && <Ban className="w-3 h-3 text-red-400 shrink-0" />}
                                        </div>
                                      ))}
                                    </div>
                                    {ans.time_taken > 0 && (
                                      <p className="text-[10px] text-gray-400 mt-1.5">⏱ {ans.time_taken}s</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Shares ── */}
        {activeSection === 'shares' && (
          <div className="space-y-3">
            {data.shares.length === 0 ? (
              <EmptyState icon={Send} text="No WhatsApp shares sent yet" />
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Phone</th>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Shared</th>
                      <th className="text-left px-3 py-2 font-medium">Joined?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.shares.map(s => {
                      const joined = data.participants.some(
                        p => (p.email && s.email && p.email === s.email) || (p.phone && s.phone && p.phone === s.phone)
                      );
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                          <td className="px-3 py-2 text-gray-500">{s.phone}</td>
                          <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">{s.email || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{fmt(s.shared_at)}</td>
                          <td className="px-3 py-2">
                            {joined ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Helper Components
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Users }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}

function LinkRow({ label, url, field, copiedField, onCopy }: {
  label: string; url: string; field: string;
  copiedField: string | null; onCopy: (text: string, field: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <span className="text-[10px] text-gray-400 shrink-0 w-20">{label}</span>
      <input readOnly value={url} className="flex-1 min-w-0 text-[11px] text-gray-600 bg-transparent outline-none truncate" />
      <button onClick={() => onCopy(url, field)}
        className="shrink-0 p-1 rounded hover:bg-gray-200 transition">
        {copiedField === field ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-gray-400" />}
      </button>
      <a href={url} target="_blank" rel="noreferrer" className="shrink-0 p-1 rounded hover:bg-gray-200 transition">
        <ExternalLink className="w-3 h-3 text-gray-400" />
      </a>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
      <Icon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function CollapsibleSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-xs font-medium text-gray-600">
        <span>{title} ({count})</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="p-2">{children}</div>}
    </div>
  );
}
