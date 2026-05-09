// ═══════════════════════════════════════════════════════════════
// Teacher Exams — Comprehensive Exam Dashboard
// Session exam summaries, student marksheets, batch-wise analytics
// Anti-cheat insights, student rankings, performance trends
// Theme: light / emerald — shared UI components
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  StatCardSmall, Card, Badge, Avatar,
  TableWrapper, THead, TH, TRow,
  LoadingState, EmptyState,
} from '@/components/dashboard/shared';
import {
  GraduationCap, FileText, Eye, Clock,
  Trophy, Users, CheckCircle2, ChevronDown, ChevronRight,
  BookOpen, Award, BarChart2, TrendingUp,
  Calendar, Target, Percent, ClipboardList,
  ArrowUp, ArrowDown, X as XIcon, Filter,
  ShieldCheck, ShieldAlert, AlertTriangle, Timer,
  Medal, Crown, ArrowUpDown, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────

interface SessionExamResult {
  id: string;
  topic_id: string;
  session_id: string | null;
  room_id: string | null;
  student_email: string;
  student_name: string;
  subject: string;
  topic_title: string;
  total_questions: number;
  answered: number;
  skipped: number;
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
  time_taken_seconds: number;
  tab_switch_count: number;
  auto_submitted: boolean;
  completed_at: string;
  created_at: string;
  batch_id: string | null;
  effective_session_id: string | null;
}

interface ExamSummary {
  topic_id: string;
  topic_title: string;
  subject: string;
  total_questions: number;
  total_marks: number;
  student_count: number;
  avg_percentage: number;
  highest_percentage: number;
  lowest_percentage: number;
  pass_count: number;
  first_taken: string;
  last_taken: string;
  topic_grade: string | null;
  topic_category: string | null;
}

interface BatchInfo {
  batch_id: string;
  batch_name: string;
  grade: string;
  section: string | null;
  subjects: string | null;
}

interface MonthlyAggregate {
  month: string;
  exam_count: number;
  result_count: number;
  avg_percentage: number;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Helpers ─────────────────────────────────────────────────

const GRADE_STYLE: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'A':  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'B+': 'bg-blue-100   text-blue-700    border-blue-200',
  'B':  'bg-blue-100   text-blue-700    border-blue-200',
  'C+': 'bg-amber-100  text-amber-700   border-amber-200',
  'C':  'bg-amber-100  text-amber-700   border-amber-200',
  'D':  'bg-orange-100 text-orange-700  border-orange-200',
  'F':  'bg-red-100    text-red-700     border-red-200',
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const dt = new Date(Number(y), Number(mo) - 1);
  return dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};
const fmtTime = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

type Tab = 'overview' | 'history' | 'marksheets' | 'analytics';

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TeacherExamsClient({ userName, userEmail, userRole }: Props) {
  const [results, setResults] = useState<SessionExamResult[]>([]);
  const [examList, setExamList] = useState<ExamSummary[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [monthly, setMonthly] = useState<MonthlyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher/exam-summary');
      const json = await res.json();
      if (json.success) {
        setResults(json.data.results || []);
        setExamList(json.data.exam_list || []);
        setBatches(json.data.batches || []);
        setMonthly(json.data.monthly || []);
      }
    } catch (e) { console.error('Failed to load exam data', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived stats ──
  const totalExams = examList.length;
  const totalStudentsTested = results.length;
  const uniqueStudents = new Set(results.map(r => r.student_email)).size;
  const avgPercentage = results.length > 0 ? Math.round(results.reduce((s, r) => s + Number(r.percentage), 0) / results.length) : 0;
  const passRate = results.length > 0 ? Math.round(results.filter(r => Number(r.percentage) >= 40).length / results.length * 100) : 0;

  // Anti-cheat & timing stats
  const avgTimeSecs = results.length > 0 ? Math.round(results.reduce((s, r) => s + Number(r.time_taken_seconds || 0), 0) / results.length) : 0;
  const integrityRate = results.length > 0 ? Math.round(results.filter(r => Number(r.tab_switch_count || 0) === 0 && !r.auto_submitted).length / results.length * 100) : 100;
  const autoSubmitCount = results.filter(r => r.auto_submitted).length;
  const totalTabSwitches = results.reduce((s, r) => s + Number(r.tab_switch_count || 0), 0);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview',    label: 'Overview',     icon: BarChart2 },
    { key: 'history',     label: 'Exam History', icon: ClipboardList },
    { key: 'marksheets',  label: 'Marksheets',   icon: FileText },
    { key: 'analytics',   label: 'Analytics',    icon: TrendingUp },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        <PageHeader icon={GraduationCap} title="Exam Dashboard" subtitle="Session exams, results, student marksheets & analytics">
          <RefreshButton loading={loading} onClick={fetchData} />
        </PageHeader>

        {/* ── Stats Row 1 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCardSmall icon={FileText}     label="Exams Conducted" value={totalExams}          variant="info" />
          <StatCardSmall icon={Users}        label="Students Tested" value={uniqueStudents}      variant="default" />
          <StatCardSmall icon={ClipboardList} label="Total Results"  value={totalStudentsTested}  variant="default" />
          <StatCardSmall icon={Percent}      label="Avg Score"       value={`${avgPercentage}%`} variant={avgPercentage >= 60 ? 'success' : 'warning'} />
          <StatCardSmall icon={Target}       label="Pass Rate"       value={`${passRate}%`}      variant={passRate >= 70 ? 'success' : 'warning'} />
        </div>

        {/* ── Stats Row 2 — Integrity & Timing ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCardSmall icon={Timer}        label="Avg Time"        value={fmtTime(avgTimeSecs)} variant="default" />
          <StatCardSmall icon={ShieldCheck}  label="Integrity Rate"  value={`${integrityRate}%`}  variant={integrityRate >= 80 ? 'success' : 'warning'} />
          <StatCardSmall icon={AlertTriangle} label="Tab Switches"   value={totalTabSwitches}     variant={totalTabSwitches === 0 ? 'success' : 'warning'} />
          <StatCardSmall icon={ShieldAlert}  label="Auto-Submitted"  value={autoSubmitCount}      variant={autoSubmitCount === 0 ? 'success' : 'danger'} />
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                ${tab === t.key
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <LoadingState /> : (
          <>
            {tab === 'overview'   && <OverviewTab examList={examList} results={results} monthly={monthly} batches={batches} />}
            {tab === 'history'    && <ExamHistoryTab examList={examList} results={results} batches={batches} />}
            {tab === 'marksheets' && <MarksheetsTab results={results} batches={batches} />}
            {tab === 'analytics'  && <AnalyticsTab results={results} examList={examList} batches={batches} />}
          </>
        )}
      </div>
    </DashboardShell>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Overview — charts, recent exams, monthly trend
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ examList, results, monthly, batches }: {
  examList: ExamSummary[]; results: SessionExamResult[]; monthly: MonthlyAggregate[]; batches: BatchInfo[];
}) {
  const recentExams = examList.slice(0, 8);

  // Subject breakdown
  const subjectMap = useMemo(() => {
    const map: Record<string, { count: number; avg: number; total: number }> = {};
    for (const r of results) {
      if (!map[r.subject]) map[r.subject] = { count: 0, avg: 0, total: 0 };
      map[r.subject].count++;
      map[r.subject].total += Number(r.percentage);
    }
    for (const s of Object.keys(map)) {
      map[s].avg = Math.round(map[s].total / map[s].count);
    }
    return map;
  }, [results]);
  const subjectChartData = Object.entries(subjectMap).map(([name, d]) => ({ name, avg: d.avg, count: d.count }));
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Grade distribution
  const gradeMap = useMemo(() => {
    const map: Record<string, number> = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 };
    for (const r of results) {
      if (map[r.grade_letter] !== undefined) map[r.grade_letter]++;
    }
    return map;
  }, [results]);
  const gradeChartData = Object.entries(gradeMap).map(([grade, count]) => ({ grade, count }));
  const GRADE_COLORS: Record<string, string> = {
    'A+': '#059669', 'A': '#10b981', 'B+': '#3b82f6', 'B': '#60a5fa',
    'C+': '#f59e0b', 'C': '#fbbf24', 'D': '#f97316', 'F': '#ef4444',
  };

  // Student leaderboard
  const studentRankings = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number; exams: number }> = {};
    for (const r of results) {
      if (!map[r.student_email]) map[r.student_email] = { name: r.student_name, total: 0, count: 0, exams: 0 };
      map[r.student_email].total += Number(r.percentage);
      map[r.student_email].count++;
      map[r.student_email].exams++;
    }
    return Object.entries(map)
      .map(([email, d]) => ({ email, name: d.name, avg: Math.round(d.total / d.count), exams: d.exams }))
      .sort((a, b) => b.avg - a.avg);
  }, [results]);
  const topPerformers = studentRankings.slice(0, 5);
  const needsAttention = studentRankings.length > 5 ? [...studentRankings].reverse().slice(0, 5) : [];

  return (
    <div className="space-y-6">
      {/* ── Monthly Trend + Subject Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend */}
        <Card className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Monthly Trend
          </h4>
          {monthly.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly.slice(0, 12).reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={fmtMonth} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Avg Score']}
                  labelFormatter={(label) => fmtMonth(String(label))}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="avg_percentage" fill="#10b981" radius={[4, 4, 0, 0]} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Subject Avg Score */}
        <Card className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Subject Performance
          </h4>
          {subjectChartData.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Avg Score']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                  {subjectChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Grade Distribution ── */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> Overall Grade Distribution
        </h4>
        {results.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No results yet</p>
        ) : (
          <div className="flex items-end gap-3 h-32 px-2">
            {gradeChartData.map(({ grade, count }) => {
              const maxCount = Math.max(...gradeChartData.map(g => g.count), 1);
              const pct = (count / maxCount) * 100;
              return (
                <div key={grade} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-600">{count}</span>
                  <div className="w-full rounded-t-md bg-gray-100 relative" style={{ height: '80px' }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                      style={{ height: `${pct}%`, minHeight: count > 0 ? '4px' : '0', backgroundColor: GRADE_COLORS[grade] || '#9ca3af' }}
                    />
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${GRADE_STYLE[grade] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {grade}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Recent Exams ── */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Recent Exams
        </h4>
        {recentExams.length === 0 ? (
          <EmptyState icon={FileText} message="No exams conducted yet — push exams from your live classrooms" />
        ) : (
          <div className="space-y-2">
            {recentExams.map(exam => {
              const passRate = exam.student_count > 0 ? Math.round((Number(exam.pass_count) / Number(exam.student_count)) * 100) : 0;
              return (
                <div key={exam.topic_id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{exam.topic_title}</p>
                    <p className="text-[10px] text-gray-500">
                      {exam.subject} · {Number(exam.total_questions)} Q · {fmtShortDate(exam.last_taken)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <div className="text-center">
                      <p className="font-bold text-gray-800">{exam.student_count}</p>
                      <p className="text-[10px] text-gray-400">students</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${Number(exam.avg_percentage) >= 60 ? 'text-emerald-600' : Number(exam.avg_percentage) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {Number(exam.avg_percentage)}%
                      </p>
                      <p className="text-[10px] text-gray-400">avg</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${passRate >= 70 ? 'text-emerald-600' : passRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {passRate}%
                      </p>
                      <p className="text-[10px] text-gray-400">pass</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {/* ── Student Leaderboard ── */}
      {studentRankings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Performers */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" /> Top Performers
            </h4>
            <div className="space-y-2">
              {topPerformers.map((s, i) => (
                <div key={s.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-50/30">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'}`}>
                    {i + 1}
                  </span>
                  <Avatar name={s.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.exams} exams</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{s.avg}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Needs Attention
              </h4>
              <div className="space-y-2">
                {needsAttention.map(s => (
                  <div key={s.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50/30">
                    <Avatar name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.exams} exams</p>
                    </div>
                    <span className={`text-sm font-bold ${s.avg >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{s.avg}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Exam History — full exam list, expandable results
// ═══════════════════════════════════════════════════════════════

function ExamHistoryTab({ examList, results, batches }: {
  examList: ExamSummary[]; results: SessionExamResult[]; batches: BatchInfo[];
}) {
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  const subjects = useMemo(() => [...new Set(examList.map(e => e.subject))].sort(), [examList]);
  const batchMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of batches) map[b.batch_id] = b.batch_name;
    return map;
  }, [batches]);

  const filtered = subjectFilter === 'all' ? examList : examList.filter(e => e.subject === subjectFilter);

  return (
    <div className="space-y-4">
      {/* Filters */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} message="No exams found" />
      ) : (
        <div className="space-y-2">
          {filtered.map(exam => {
            const isExpanded = expandedExam === exam.topic_id;
            const examResults = results.filter(r => r.topic_id === exam.topic_id);
            const passRate = exam.student_count > 0 ? Math.round((Number(exam.pass_count) / Number(exam.student_count)) * 100) : 0;

            return (
              <div key={exam.topic_id} className="rounded-xl border border-gray-200 overflow-hidden">
                {/* Exam row */}
                <button
                  onClick={() => setExpandedExam(isExpanded ? null : exam.topic_id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{exam.topic_title}</p>
                    <p className="text-[10px] text-gray-500">
                      {exam.subject} {exam.topic_grade ? `· Grade ${exam.topic_grade}` : ''} · {Number(exam.total_questions)} Q × {Number(exam.total_marks)} marks · {fmtDate(exam.last_taken)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Stat label="Students" value={exam.student_count} />
                    <Stat label="Avg" value={`${Number(exam.avg_percentage)}%`} color={Number(exam.avg_percentage) >= 60 ? 'emerald' : Number(exam.avg_percentage) >= 40 ? 'amber' : 'red'} />
                    <Stat label="Pass" value={`${passRate}%`} color={passRate >= 70 ? 'emerald' : passRate >= 50 ? 'amber' : 'red'} />
                    <Stat label="High" value={`${Number(exam.highest_percentage)}%`} color="emerald" />
                    <Stat label="Low" value={`${Number(exam.lowest_percentage)}%`} color="red" />
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded results */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                    {examResults.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">No student results</p>
                    ) : (
                      <TableWrapper>
                        <THead>
                          <TH>Student</TH>
                          <TH>Score</TH>
                          <TH>%</TH>
                          <TH>Grade</TH>
                          <TH>Time</TH>
                          <TH>Answered</TH>
                          <TH>Tab Switches</TH>
                          <TH>Date</TH>
                        </THead>
                        <tbody>
                          {examResults
                            .sort((a, b) => Number(b.percentage) - Number(a.percentage))
                            .map((r, i) => (
                            <TRow key={r.id} className={i === 0 ? 'bg-emerald-50/50' : Number(r.percentage) < 40 ? 'bg-red-50/30' : ''}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Avatar name={r.student_name} size="sm" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{r.student_name}</p>
                                    {r.batch_id && batchMap[r.batch_id] && (
                                      <p className="text-[10px] text-gray-400">{batchMap[r.batch_id]}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-sm font-mono font-semibold text-gray-700">{r.score}/{r.total_marks}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-sm font-bold ${Number(r.percentage) >= 75 ? 'text-emerald-600' : Number(r.percentage) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {Number(r.percentage)}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${GRADE_STYLE[r.grade_letter] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                  {r.grade_letter}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">{fmtTime(Number(r.time_taken_seconds))}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">{r.answered}/{r.total_questions}</td>
                              <td className="px-4 py-2.5">
                                {Number(r.tab_switch_count) > 0
                                  ? <span className="text-xs font-medium text-red-500">{r.tab_switch_count}</span>
                                  : <span className="text-xs text-gray-400">0</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-500">{fmtShortDate(r.completed_at)}</td>
                            </TRow>
                          ))}
                        </tbody>
                      </TableWrapper>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Marksheets — batch-wise student exam cards
// ═══════════════════════════════════════════════════════════════

function MarksheetsTab({ results, batches }: {
  results: SessionExamResult[]; batches: BatchInfo[];
}) {
  const [selectedBatch, setSelectedBatch] = useState<string>(batches[0]?.batch_id || '');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Results grouped by batch
  const batchResults = useMemo(() => {
    const map: Record<string, SessionExamResult[]> = {};
    for (const r of results) {
      const bid = r.batch_id || '_unlinked';
      if (!map[bid]) map[bid] = [];
      map[bid].push(r);
    }
    return map;
  }, [results]);

  // Students in selected batch
  const batchStudents = useMemo(() => {
    const recs = batchResults[selectedBatch] || [];
    const map: Record<string, { name: string; results: SessionExamResult[] }> = {};
    for (const r of recs) {
      if (!map[r.student_email]) map[r.student_email] = { name: r.student_name, results: [] };
      map[r.student_email].results.push(r);
    }
    return Object.entries(map)
      .map(([email, { name, results: rs }]) => {
        const avgPct = rs.length > 0 ? Math.round(rs.reduce((s, r) => s + Number(r.percentage), 0) / rs.length) : 0;
        const totalScore = rs.reduce((s, r) => s + Number(r.score), 0);
        const totalMarks = rs.reduce((s, r) => s + Number(r.total_marks), 0);
        const passCount = rs.filter(r => Number(r.percentage) >= 40).length;
        return { email, name, results: rs, avgPct, totalScore, totalMarks, passCount, examCount: rs.length };
      })
      .sort((a, b) => b.avgPct - a.avgPct);
  }, [batchResults, selectedBatch]);

  const batchName = batches.find(b => b.batch_id === selectedBatch)?.batch_name || 'Unlinked';
  const selectedStudentData = selectedStudent ? batchStudents.find(s => s.email === selectedStudent) : null;

  // All unique batches (including _unlinked)
  const batchOptions = useMemo(() => {
    const ids = new Set(Object.keys(batchResults));
    const opts: { id: string; name: string }[] = [];
    for (const b of batches) {
      if (ids.has(b.batch_id)) opts.push({ id: b.batch_id, name: b.batch_name });
    }
    if (ids.has('_unlinked')) opts.push({ id: '_unlinked', name: 'Unlinked Exams' });
    return opts;
  }, [batches, batchResults]);

  // Auto-select first batch
  useEffect(() => {
    if (!selectedBatch && batchOptions.length > 0) setSelectedBatch(batchOptions[0].id);
  }, [batchOptions, selectedBatch]);

  return (
    <div className="space-y-4">
      {/* Batch selector */}
      {batchOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={selectedBatch}
            onChange={e => { setSelectedBatch(e.target.value); setSelectedStudent(null); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
          >
            {batchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className="text-xs text-gray-400 ml-1">{batchStudents.length} student{batchStudents.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {batchStudents.length === 0 ? (
        <EmptyState icon={Users} message={batchOptions.length === 0 ? "No exam data linked to any batch yet" : "No exam results in this batch"} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {batchStudents.map(student => {
            const overallGrade = getGradeLetter(student.avgPct);
            return (
              <button
                key={student.email}
                onClick={() => setSelectedStudent(student.email)}
                className="text-left rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all bg-white"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={student.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{student.email}</p>
                  </div>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold border ${GRADE_STYLE[overallGrade] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {overallGrade}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{student.examCount}</p>
                    <p className="text-[10px] text-gray-400">Exams</p>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${student.avgPct >= 60 ? 'text-emerald-600' : student.avgPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {student.avgPct}%
                    </p>
                    <p className="text-[10px] text-gray-400">Avg</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{student.totalScore}/{student.totalMarks}</p>
                    <p className="text-[10px] text-gray-400">Score</p>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${student.passCount === student.examCount ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {student.passCount}/{student.examCount}
                    </p>
                    <p className="text-[10px] text-gray-400">Passed</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Student Marksheet Modal ── */}
      {selectedStudentData && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <Avatar name={selectedStudentData.name} size="md" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedStudentData.name}</h3>
                  <p className="text-xs text-gray-500">{selectedStudentData.email} · {batchName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <XIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Summary stats */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50/80 to-blue-50/40 border-b border-gray-100">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedStudentData.examCount}</p>
                  <p className="text-[10px] text-gray-500">Total Exams</p>
                </div>
                <div>
                  <p className={`text-lg font-bold ${selectedStudentData.avgPct >= 60 ? 'text-emerald-600' : selectedStudentData.avgPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {selectedStudentData.avgPct}%
                  </p>
                  <p className="text-[10px] text-gray-500">Average</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedStudentData.totalScore}/{selectedStudentData.totalMarks}</p>
                  <p className="text-[10px] text-gray-500">Total Score</p>
                </div>
                <div>
                  <p className={`text-lg font-bold ${selectedStudentData.passCount === selectedStudentData.examCount ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedStudentData.passCount}/{selectedStudentData.examCount}
                  </p>
                  <p className="text-[10px] text-gray-500">Passed</p>
                </div>
                <div>
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold border mx-auto ${GRADE_STYLE[getGradeLetter(selectedStudentData.avgPct)] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {getGradeLetter(selectedStudentData.avgPct)}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1">Grade</p>
                </div>
              </div>
            </div>

            {/* Exam results table */}
            <div className="p-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Exam Results</h4>
              <TableWrapper>
                <THead>
                  <TH>Exam</TH>
                  <TH>Subject</TH>
                  <TH>Score</TH>
                  <TH>%</TH>
                  <TH>Grade</TH>
                  <TH>Time</TH>
                  <TH>Date</TH>
                </THead>
                <tbody>
                  {selectedStudentData.results
                    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
                    .map(r => (
                    <TRow key={r.id} className={Number(r.percentage) < 40 ? 'bg-red-50/30' : ''}>
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{r.topic_title}</p>
                        <p className="text-[10px] text-gray-400">{r.answered}/{r.total_questions} answered</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{r.subject}</td>
                      <td className="px-4 py-2.5 text-sm font-mono font-semibold text-gray-700">{r.score}/{r.total_marks}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-sm font-bold ${Number(r.percentage) >= 75 ? 'text-emerald-600' : Number(r.percentage) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {Number(r.percentage)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${GRADE_STYLE[r.grade_letter] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {r.grade_letter}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{fmtTime(Number(r.time_taken_seconds))}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(r.completed_at)}</td>
                    </TRow>
                  ))}
                </tbody>
              </TableWrapper>

              {/* Performance trend mini chart */}
              {selectedStudentData.results.length > 1 && (() => {
                const trend = [...selectedStudentData.results]
                  .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
                  .map(r => ({ date: fmtShortDate(r.completed_at), pct: Number(r.percentage), topic: r.topic_title }));
                return (
                  <div className="mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Performance Trend
                    </h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip
                          formatter={(value) => [`${value}%`, 'Score']}
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                          {trend.map((d, i) => (
                            <Cell key={i} fill={d.pct >= 75 ? '#10b981' : d.pct >= 40 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Analytics — anti-cheat insights, batch comparison, difficulty
// ═══════════════════════════════════════════════════════════════

function AnalyticsTab({ results, examList, batches }: {
  results: SessionExamResult[]; examList: ExamSummary[]; batches: BatchInfo[];
}) {
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Batch comparison
  const batchComparison = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    for (const r of results) {
      const bid = r.batch_id || '_unlinked';
      if (!map[bid]) {
        const b = batches.find(b => b.batch_id === bid);
        map[bid] = { name: b?.batch_name || 'Unlinked', total: 0, count: 0 };
      }
      map[bid].total += Number(r.percentage);
      map[bid].count++;
    }
    return Object.entries(map)
      .map(([id, d]) => ({ batch: d.name, avg: Math.round(d.total / d.count), students: d.count }))
      .sort((a, b) => b.avg - a.avg);
  }, [results, batches]);

  // Difficulty analysis (by exam)
  const difficultyData = useMemo(() => {
    return examList
      .filter(e => Number(e.student_count) >= 2)
      .map(e => ({
        name: e.topic_title.length > 25 ? e.topic_title.slice(0, 25) + '…' : e.topic_title,
        avg: Number(e.avg_percentage),
        spread: Number(e.highest_percentage) - Number(e.lowest_percentage),
        students: Number(e.student_count),
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 10);
  }, [examList]);

  // Anti-cheat breakdown
  const cheatingInsights = useMemo(() => {
    const tabSwitchers = results.filter(r => Number(r.tab_switch_count) > 0);
    const autoSubmitted = results.filter(r => r.auto_submitted);
    // Students with repeat tab switches
    const repeatOffenders: Record<string, { name: string; count: number; total_switches: number }> = {};
    for (const r of tabSwitchers) {
      if (!repeatOffenders[r.student_email]) repeatOffenders[r.student_email] = { name: r.student_name, count: 0, total_switches: 0 };
      repeatOffenders[r.student_email].count++;
      repeatOffenders[r.student_email].total_switches += Number(r.tab_switch_count);
    }
    const offenderList = Object.entries(repeatOffenders)
      .map(([email, d]) => ({ email, ...d }))
      .sort((a, b) => b.total_switches - a.total_switches)
      .slice(0, 8);

    return { tabSwitchers: tabSwitchers.length, autoSubmitted: autoSubmitted.length, offenderList };
  }, [results]);

  // Time analysis
  const timeDistribution = useMemo(() => {
    const buckets = { 'Under 1m': 0, '1-3m': 0, '3-5m': 0, '5-10m': 0, '10m+': 0 };
    for (const r of results) {
      const secs = Number(r.time_taken_seconds);
      if (secs < 60) buckets['Under 1m']++;
      else if (secs < 180) buckets['1-3m']++;
      else if (secs < 300) buckets['3-5m']++;
      else if (secs < 600) buckets['5-10m']++;
      else buckets['10m+']++;
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [results]);

  if (results.length === 0) {
    return <EmptyState icon={TrendingUp} message="No exam data available for analytics" />;
  }

  return (
    <div className="space-y-6">
      {/* ── Batch Comparison + Difficulty ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Batch Comparison */}
        <Card className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Batch Comparison
          </h4>
          {batchComparison.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No batch data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={batchComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="batch" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Avg Score']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {batchComparison.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Difficulty Analysis */}
        <Card className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Exam Difficulty (Lowest → Highest Avg)
          </h4>
          {difficultyData.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Need 2+ student exams for analysis</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={difficultyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Avg Score']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                  {difficultyData.map((d, i) => (
                    <Cell key={i} fill={d.avg >= 60 ? '#10b981' : d.avg >= 40 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Time Distribution + Anti-Cheat ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time Distribution */}
        <Card className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" /> Completion Time Distribution
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value) => [value, 'Students']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Anti-Cheat Insights */}
        <Card className="p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Integrity Report
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-lg font-bold text-amber-700">{cheatingInsights.tabSwitchers}</p>
              <p className="text-[10px] text-amber-600">Tab switch attempts</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-lg font-bold text-red-700">{cheatingInsights.autoSubmitted}</p>
              <p className="text-[10px] text-red-600">Auto-submitted</p>
            </div>
          </div>
          {cheatingInsights.offenderList.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Repeat Tab Switchers</p>
              <div className="space-y-1.5">
                {cheatingInsights.offenderList.map(s => (
                  <div key={s.email} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-red-50/30">
                    <Avatar name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.count} exams</p>
                    </div>
                    <span className="text-xs font-bold text-red-500">{s.total_switches} switches</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {cheatingInsights.offenderList.length === 0 && cheatingInsights.tabSwitchers === 0 && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <p className="text-sm text-emerald-600 font-medium">All exams completed with full integrity</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}


// ── Helper Components ────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClass = color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : color === 'red' ? 'text-red-600' : 'text-gray-800';
  return (
    <div className="text-center hidden sm:block">
      <p className={`text-xs font-bold ${colorClass}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

function getGradeLetter(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B+';
  if (pct >= 45) return 'B';
  if (pct >= 30) return 'C+';
  return 'C';
}
