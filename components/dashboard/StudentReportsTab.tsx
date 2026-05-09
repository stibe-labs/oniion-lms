// ═══════════════════════════════════════════════════════════════
// StudentReportsTab — Reusable component for student report view
// Shows Exam, Attendance, AI Monitoring reports with daily trends
// Used in: Student, Teacher, BC, AO, Owner, Parent dashboards
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, LoadingState, EmptyState, Badge, RefreshButton,
} from '@/components/dashboard/shared';
import {
  Trophy, CheckCircle2, AlertCircle, Eye,
  Clock, BarChart2, BookOpen,
  ChevronDown, ChevronRight, Brain, XCircle, Smartphone,
  Timer, Minus, Calendar, Target, Zap, AlertTriangle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, Legend,
  PieChart, Pie,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────

interface ExamResult {
  id: string;
  topic_title: string;
  subject: string;
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
  answered: number;
  skipped: number;
  total_questions: number;
  time_taken_seconds: number;
  tab_switch_count: number;
  auto_submitted: boolean;
  completed_at: string;
}

interface SubjectAttendance {
  total: number;
  present: number;
  avgAttention: number;
}

interface BehaviorItem {
  event_type: string;
  count: number;
  total_minutes: number;
  avg_confidence: number;
}

interface AlertItem {
  alert_type: string;
  count: number;
}

interface DailyTrend {
  date: string;
  attendance: number;
  attention: number;
  exams: number;
  alerts: number;
}

interface ReportData {
  student: {
    name: string;
    email: string;
    parent_email?: string;
    batch_name?: string;
    grade?: string;
    subjects?: string[];
    batch_id?: string;
  };
  period: string;
  date_from: string;
  date_to: string;
  exam_summary: {
    total_exams: number;
    avg_percentage: number;
    total_tab_switches: number;
    auto_submitted_count: number;
    exams: ExamResult[];
  };
  attendance_summary: {
    total_classes: number;
    present: number;
    late: number;
    absent: number;
    attendance_rate: number;
    avg_engagement: number;
    avg_attention: number;
    by_subject: Record<string, SubjectAttendance>;
  };
  monitoring_summary: {
    total_alerts: number;
    alert_breakdown: AlertItem[];
    behavior_breakdown: BehaviorItem[];
  };
  daily_trend: DailyTrend[];
}

interface Props {
  studentEmail: string;
  batchId?: string;
  showStudentHeader?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────

const gradeColor = (pct: number) =>
  pct >= 90 ? 'text-emerald-600' :
  pct >= 75 ? 'text-green-600' :
  pct >= 50 ? 'text-amber-600' :
  'text-red-600';

const gradeBg = (pct: number) =>
  pct >= 90 ? 'bg-emerald-50 border-emerald-200' :
  pct >= 75 ? 'bg-green-50 border-green-200' :
  pct >= 50 ? 'bg-amber-50 border-amber-200' :
  'bg-red-50 border-red-200';

const attColor = (r: number) => r >= 75 ? 'text-green-600' : r >= 50 ? 'text-amber-600' : 'text-red-600';

const ringColor = (pct: number) =>
  pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

const BEHAVIOR_LABELS: Record<string, { label: string; color: string; icon: typeof Eye }> = {
  looking_away:    { label: 'Looking Away',     color: 'bg-amber-100 text-amber-700',   icon: Eye },
  eyes_closed:     { label: 'Eyes Closed',      color: 'bg-purple-100 text-purple-700',  icon: XCircle },
  not_in_frame:    { label: 'Not in Frame',     color: 'bg-red-100 text-red-700',        icon: Minus },
  phone_detected:  { label: 'Phone Detected',   color: 'bg-orange-100 text-orange-700',  icon: Smartphone },
  tab_switched:    { label: 'Tab Switched',     color: 'bg-blue-100 text-blue-700',      icon: Eye },
  distracted:      { label: 'Distracted',       color: 'bg-yellow-100 text-yellow-700',  icon: AlertCircle },
  yawning:         { label: 'Yawning',          color: 'bg-indigo-100 text-indigo-700',  icon: Timer },
  inactive:        { label: 'Inactive',         color: 'bg-gray-100 text-gray-700',      icon: Clock },
  head_turned:     { label: 'Head Turned',      color: 'bg-pink-100 text-pink-700',      icon: Eye },
};

const fmtDate = (d: unknown) => {
  const dt = new Date(String(d));
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtShortDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const fmtTime = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const fmtDateRange = (from: string, to: string) => {
  const f = new Date(from);
  const t = new Date(to);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (f.getFullYear() !== t.getFullYear()) return `${f.toLocaleDateString('en-IN', { ...opts, year: 'numeric' })} – ${t.toLocaleDateString('en-IN', { ...opts, year: 'numeric' })}`;
  return `${f.toLocaleDateString('en-IN', opts)} – ${t.toLocaleDateString('en-IN', { ...opts, year: 'numeric' })}`;
};

const computeHealthScore = (examPct: number, attRate: number, attentionPct: number, alertCount: number) => {
  const alertPenalty = Math.min(alertCount * 2, 20);
  return Math.round(examPct * 0.35 + attRate * 0.35 + attentionPct * 0.30 - alertPenalty);
};

const healthGrade = (score: number) =>
  score >= 85 ? { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50', icon: '🟢' } :
  score >= 70 ? { label: 'Good', color: 'text-green-600 bg-green-50', icon: '🟡' } :
  score >= 50 ? { label: 'Needs Improvement', color: 'text-amber-600 bg-amber-50', icon: '🟠' } :
  { label: 'At Risk', color: 'text-red-600 bg-red-50', icon: '🔴' };

// ── Main Component ─────────────────────────────────────────────

export default function StudentReportsTab({ studentEmail, batchId, showStudentHeader }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'overall'>('weekly');
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchReport = useCallback(async () => {
    if (hasFetched.current) setRefreshing(true);
    setError('');
    try {
      const params = new URLSearchParams({ student_email: studentEmail, period });
      if (batchId) params.set('batch_id', batchId);
      const res = await fetch(`/api/v1/student-reports?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      hasFetched.current = true;
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [studentEmail, period, batchId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (initialLoading) return <LoadingState />;
  if (error) return (
    <div className="text-center py-12">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={fetchReport} className="mt-3 text-sm text-emerald-600 hover:underline">Retry</button>
    </div>
  );
  if (!data) return <EmptyState icon={BarChart2} message="No report data available." />;

  const { exam_summary: ex, attendance_summary: att, monitoring_summary: mon, daily_trend: trend, student } = data;
  const health = computeHealthScore(ex.avg_percentage, att.attendance_rate, att.avg_attention, mon.total_alerts);
  const grade = healthGrade(health);
  const hasAnyData = ex.total_exams > 0 || att.total_classes > 0 || mon.behavior_breakdown.length > 0;

  // Attendance pie data
  const attPieData = att.total_classes > 0 ? [
    { name: 'Present', value: att.present - att.late, fill: '#10b981' },
    ...(att.late > 0 ? [{ name: 'Late', value: att.late, fill: '#f59e0b' }] : []),
    ...(att.absent > 0 ? [{ name: 'Absent', value: att.absent, fill: '#ef4444' }] : []),
  ] : [];

  // Behavior total time for relative sizing
  const totalBehaviorMinutes = mon.behavior_breakdown.reduce((s, b) => s + b.total_minutes, 0);

  return (
    <div className="space-y-5">
      {/* Header with student info */}
      {showStudentHeader && student.name && (
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-emerald-700 font-bold text-sm">{student.name.charAt(0)}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{student.name}</p>
            <p className="text-xs text-gray-500">{student.email} {student.batch_name && `· ${student.batch_name}`} {student.grade && `· Grade ${student.grade}`}</p>
          </div>
        </div>
      )}

      {/* Period Selector + Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['daily', 'weekly', 'overall'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                period === p ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : 'Overall'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
          <Calendar className="w-3.5 h-3.5" />
          <span>{fmtDateRange(data.date_from, data.date_to)}</span>
        </div>
        <RefreshButton loading={refreshing} onClick={fetchReport} />
      </div>

      {!hasAnyData ? (
        <EmptyState icon={BarChart2} message={`No data available for ${period === 'daily' ? 'today' : period === 'weekly' ? 'this week' : 'the last 90 days'}.`} />
      ) : (
        <>
          {/* ═══ HEALTH SCORE + METRIC RINGS ═══ */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-between">
              {/* Overall Health */}
              <div className="flex items-center gap-3">
                <ProgressRing value={Math.max(0, health)} size={72} strokeWidth={6} color={ringColor(health)} />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Overall Health</p>
                  <p className={`text-sm font-bold ${grade.color} px-2 py-0.5 rounded-md inline-block mt-0.5`}>
                    {grade.icon} {grade.label}
                  </p>
                </div>
              </div>

              {/* Three metric rings */}
              <div className="flex items-center justify-center sm:justify-start flex-wrap gap-4 sm:gap-5">
                <MetricRing value={ex.avg_percentage} label="Exams" icon={Trophy} subtext={`${ex.total_exams} taken`} />
                <MetricRing value={att.attendance_rate} label="Attendance" icon={CheckCircle2} subtext={`${att.present}/${att.total_classes}`} />
                <MetricRing value={att.avg_attention} label="Attention" icon={Target} subtext={`${att.avg_engagement}% engaged`} />
              </div>
            </div>
          </div>

          {/* ═══ QUICK STATS BAR ═══ */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <QuickStat label="Late" value={att.late} icon={Clock} color={att.late > 0 ? 'amber' : 'gray'} />
            <QuickStat label="Absent" value={att.absent} icon={XCircle} color={att.absent > 0 ? 'red' : 'gray'} />
            <QuickStat label="Alerts" value={mon.total_alerts} icon={AlertTriangle} color={mon.total_alerts > 0 ? 'red' : 'gray'} />
            <QuickStat label="Tab Switches" value={ex.total_tab_switches} icon={Zap} color={ex.total_tab_switches > 0 ? 'orange' : 'gray'} />
            <QuickStat label="Auto-Submit" value={ex.auto_submitted_count} icon={Timer} color={ex.auto_submitted_count > 0 ? 'purple' : 'gray'} />
            <QuickStat label="Behaviors" value={mon.behavior_breakdown.length} icon={Eye} color={mon.behavior_breakdown.length > 0 ? 'blue' : 'gray'} />
          </div>

          {/* ═══ DAILY TREND ═══ */}
          {trend.length > 1 && (
            <Card>
              <p className="text-sm font-semibold text-gray-700 mb-3">Daily Trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={fmtDate} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="attention" name="Attention %" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="attendance" name="Classes" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="alerts" name="Alerts" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ═══ EXAMS SECTION ═══ */}
          {ex.total_exams > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-gray-700">Exam Results</p>
                </div>
                <p className="text-xs text-gray-400">{ex.total_exams} exam{ex.total_exams !== 1 ? 's' : ''} · Avg {ex.avg_percentage}%</p>
              </div>

              {/* Score trend chart */}
              {ex.exams.length > 1 && (
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={[...ex.exams].reverse()} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="topic_title" tick={{ fontSize: 8 }} interval={0} angle={-15} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="percentage" name="Score %" radius={[4, 4, 0, 0]}>
                        {[...ex.exams].reverse().map((e, i) => (
                          <Cell key={i} fill={e.percentage >= 75 ? '#10b981' : e.percentage >= 50 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Exam list */}
              <div className="space-y-2">
                {ex.exams.map(e => (
                  <div key={e.id} className={`border rounded-lg overflow-hidden ${gradeBg(e.percentage)}`}>
                    <button
                      onClick={() => setExpandedExam(expandedExam === e.id ? null : e.id)}
                      className="w-full flex items-center justify-between p-2.5 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{e.topic_title}</p>
                        <p className="text-xs text-gray-500">{e.subject} · {fmtDate(e.completed_at)}</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="text-right">
                          <span className={`text-base font-bold ${gradeColor(e.percentage)}`}>{e.percentage}%</span>
                          <p className="text-[10px] text-gray-400">{e.score}/{e.total_marks}</p>
                        </div>
                        <Badge variant={e.grade_letter === 'A' || e.grade_letter === 'A+' ? 'success' : e.grade_letter === 'B' ? 'info' : 'warning'} label={e.grade_letter} />
                        {expandedExam === e.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {expandedExam === e.id && (
                      <div className="border-t border-gray-200 bg-white/60 p-3 grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-gray-500">Answered:</span>
                          <span className="font-medium">{e.answered}/{e.total_questions}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Minus className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-500">Skipped:</span>
                          <span className="font-medium">{e.skipped}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-gray-500">Time:</span>
                          <span className="font-medium">{fmtTime(e.time_taken_seconds)}</span>
                        </div>
                        {e.tab_switch_count > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-gray-500">Tab Switches:</span>
                            <span className="font-medium text-orange-600">{e.tab_switch_count}</span>
                          </div>
                        )}
                        {e.auto_submitted && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-600 font-medium">Auto-Submitted (time ran out)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ═══ ATTENDANCE SECTION ═══ */}
          {att.total_classes > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-gray-700">Attendance</p>
                </div>
                <p className="text-xs text-gray-400">{att.present}/{att.total_classes} classes · {att.attendance_rate}%</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* Attendance pie */}
                {attPieData.length > 0 && (
                  <div className="flex items-center justify-center sm:w-40 shrink-0">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={attPieData}
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {attPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1 text-[10px]">
                      {attPieData.map(d => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="text-gray-500">{d.name}: {d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* By Subject breakdown */}
                {Object.keys(att.by_subject).length > 0 && (
                  <div className="flex-1 space-y-2.5">
                    {Object.entries(att.by_subject).map(([sub, v]) => {
                      const rate = v.total > 0 ? Math.round(v.present / v.total * 100) : 0;
                      return (
                        <div key={sub}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{sub}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${attColor(rate)}`}>{rate}%</span>
                              <span className="text-[10px] text-gray-400">{v.present}/{v.total}</span>
                              {v.avgAttention > 0 && (
                                <span className="text-[10px] text-gray-400">· {v.avgAttention}% attention</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${rate >= 75 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attendance trend */}
              {trend.length > 1 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Attendance & Attention Trend</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip labelFormatter={fmtDate} />
                      <Area type="monotone" dataKey="attendance" name="Classes" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                      <Area type="monotone" dataKey="attention" name="Attention %" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}

          {/* ═══ AI MONITORING SECTION ═══ */}
          {(mon.behavior_breakdown.length > 0 || mon.alert_breakdown.length > 0) && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <p className="text-sm font-semibold text-gray-700">AI Monitoring</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Attention: <span className={`font-bold ${attColor(att.avg_attention)}`}>{att.avg_attention}%</span></span>
                  <span>Engagement: <span className="font-bold text-purple-600">{att.avg_engagement}%</span></span>
                </div>
              </div>

              {/* Behavior breakdown as horizontal bars */}
              {mon.behavior_breakdown.length > 0 && (
                <div className="space-y-2 mb-4">
                  {mon.behavior_breakdown.map(b => {
                    const meta = BEHAVIOR_LABELS[b.event_type] || { label: b.event_type, color: 'bg-gray-100 text-gray-700', icon: Eye };
                    const Icon = meta.icon;
                    const pct = totalBehaviorMinutes > 0 ? Math.round(b.total_minutes / totalBehaviorMinutes * 100) : 0;
                    return (
                      <div key={b.event_type} className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 w-32 shrink-0 text-xs font-medium ${meta.color} px-2 py-1 rounded-md`}>
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{meta.label}</span>
                        </div>
                        <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gray-400/60 transition-all" style={{ width: `${Math.max(pct, 3)}%` }} />
                        </div>
                        <div className="text-right shrink-0 w-24 text-[11px] text-gray-500">
                          <span className="font-medium text-gray-700">{b.count}×</span>
                          <span className="ml-1">({b.total_minutes}m)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alert breakdown */}
              {mon.alert_breakdown.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Alerts ({mon.total_alerts} total)</p>
                  <div className="flex flex-wrap gap-2">
                    {mon.alert_breakdown.map(a => (
                      <div key={a.alert_type} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-100 rounded-lg text-xs">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-red-700 capitalize">{a.alert_type.replace(/_/g, ' ')}</span>
                        <span className="text-red-500 font-bold">{a.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerts trend */}
              {trend.length > 1 && mon.total_alerts > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Alerts Over Time</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip labelFormatter={fmtDate} />
                      <Bar dataKey="alerts" name="Alerts" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Progress Ring (SVG) ────────────────────────────────────────

function ProgressRing({ value, size, strokeWidth, color }: { value: number; size: number; strokeWidth: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-800">{value}%</span>
      </div>
    </div>
  );
}

// ── Metric Ring ────────────────────────────────────────────────

function MetricRing({ value, label, icon: Icon, subtext }: { value: number; label: string; icon: typeof Trophy; subtext: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <ProgressRing value={value} size={56} strokeWidth={5} color={ringColor(value)} />
      <div className="flex items-center gap-1 text-[11px] font-medium text-gray-700">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className="text-[10px] text-gray-400">{subtext}</p>
    </div>
  );
}

// ── Quick Stat Chip ────────────────────────────────────────────

function QuickStat({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Clock; color: string }) {
  const colors: Record<string, string> = {
    amber:  'text-amber-700 bg-amber-50 border-amber-200',
    red:    'text-red-700 bg-red-50 border-red-200',
    orange: 'text-orange-700 bg-orange-50 border-orange-200',
    purple: 'text-purple-700 bg-purple-50 border-purple-200',
    blue:   'text-blue-700 bg-blue-50 border-blue-200',
    gray:   'text-gray-500 bg-gray-50 border-gray-200',
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${colors[color] || colors.gray}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight">{value}</p>
        <p className="text-[9px] opacity-70 truncate">{label}</p>
      </div>
    </div>
  );
}
