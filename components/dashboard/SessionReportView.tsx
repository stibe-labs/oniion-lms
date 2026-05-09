'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlatformName } from '@/components/providers/PlatformProvider';
import {
  X, Clock, Users, AlertTriangle, MessageSquare, ShieldAlert, BookOpen, Star,
  ChevronDown, ChevronUp, Download, Printer, Award, Activity, Brain,
  Video, FileText, HelpCircle, Trophy, Paperclip, RefreshCw,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

interface SessionReport {
  id: string;
  data: {
    sessions: SessionData[];
    narrative_summary?: string;
  };
  created_at: string;
}

interface SessionData {
  room_id: string;
  batch_name: string;
  subject: string;
  grade: string;
  batch_type: string;
  teacher: { name: string; email: string };
  scheduled_start: string;
  go_live_at: string | null;
  ended_at: string | null;
  scheduled_duration_min: number;
  actual_duration_min: number;
  go_live_delay_sec: number;
  teacher_late: boolean;
  class_portion: string | null;
  class_remarks: string | null;
  attendance: {
    total_students: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
    details: AttendanceDetail[];
  };
  join_leave_log: { email: string; name: string; event: string; at: string }[];
  ai_monitoring: {
    per_student: Record<string, { name: string; events: { type: string; occurrences: number; total_duration_sec: number; avg_confidence: number }[] }>;
    alerts: { student_email: string; student_name: string; type: string; severity: string; message: string; at: string }[];
    alert_summary: { total: number; critical: number; warnings: number };
  };
  chat: { message_count: number; messages: { sender: string; role: string; text: string; at: string }[] };
  teacher_reports: { student: string; category: string; description: string; severity: string; status: string; at: string }[];
  exam_results: { student: string; email: string; topic: string; score: number; total: number; correct: number; time_sec: number }[];
  student_feedback: { student: string; rating: number; text: string; tags: string[] }[];
  contact_violations: number;
  doubts: {
    total: number;
    answered: number;
    open: number;
    list?: { student: string; email: string; subject: string | null; text: string; status: string; reply: string | null; replied_by: string | null; replied_at: string | null; at: string }[];
  };
  recording?: { url: string | null; status: string };
  session_topic?: string | null;
  session_notes?: string | null;
  materials?: { id: string; file_name: string; file_url: string; file_type: string; file_size_bytes: number; title: string | null; description: string | null; uploaded_by: string; at: string }[];
  exam_summary?: {
    attempts: number;
    class_avg: number;
    pass_count: number;
    pass_rate: number;
    top_scorer: { name: string; score: number };
    low_scorer: { name: string; score: number };
    by_topic: { topic: string; attempts: number; avg: number }[];
  } | null;
  homework?: {
    total_assigned: number;
    assignments: {
      title: string;
      description: string | null;
      due_date: string | null;
      due_time: string | null;
      status: string;
      questions: { number: number; text: string }[];
      submissions: {
        student: string;
        email: string;
        completion_status: string;
        delay_days: number;
        grade: string | null;
        comment: string | null;
        file_count: number;
        submitted_at: string;
      }[];
      submission_count: number;
    }[];
  };
  room_events: { type: string; participant: string; at: string }[];
}

interface AttendanceDetail {
  email: string;
  name: string;
  status: string;
  is_late: boolean;
  late_by_sec: number;
  join_count: number;
  time_in_class_sec: number;
  first_join: string | null;
  last_leave: string | null;
  attention_avg: number | null;
  remarks: string | null;
}

/* ── Helpers ───────────────────────────────────────────── */

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDuration(sec: number) {
  if (!sec || sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function attColor(rate: number | null) {
  if (rate == null) return 'text-gray-400';
  if (rate >= 75) return 'text-emerald-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function fmtPct(rate: number | null) {
  if (rate == null) return '—';
  return `${Math.round(rate)}%`;
}

function gradeFromScore(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
    gray: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
    purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true, accent = 'indigo' }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accents: Record<string, { iconBg: string; iconText: string; bar: string }> = {
    indigo:  { iconBg: 'bg-indigo-50',  iconText: 'text-indigo-600',  bar: 'before:bg-indigo-500' },
    emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', bar: 'before:bg-emerald-500' },
    amber:   { iconBg: 'bg-amber-50',   iconText: 'text-amber-600',   bar: 'before:bg-amber-500' },
    rose:    { iconBg: 'bg-rose-50',    iconText: 'text-rose-600',    bar: 'before:bg-rose-500' },
    purple:  { iconBg: 'bg-purple-50',  iconText: 'text-purple-600',  bar: 'before:bg-purple-500' },
    slate:   { iconBg: 'bg-slate-100',  iconText: 'text-slate-600',   bar: 'before:bg-slate-400' },
  };
  const a = accents[accent];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${a.bar}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50/60"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.iconBg}`}>
            <Icon className={`h-4 w-4 ${a.iconText}`} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-800">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
}

/* ── Per-student report overlay ─────────────────────────── */

function SessionStudentReportOverlay({
  student,
  session,
  onClose,
}: {
  student: AttendanceDetail;
  session: SessionData;
  onClose: () => void;
}) {
  const platformName = usePlatformName();
  const monitoring = session.ai_monitoring.per_student[student.email];
  const exams = session.exam_results.filter(e => e.email === student.email || e.student === student.name);
  const teacherReports = session.teacher_reports.filter(r => r.student === student.name || r.student === student.email);
  const hwSubs = (session.homework?.assignments ?? []).flatMap(hw =>
    hw.submissions.filter(s => s.email === student.email || s.student === student.name).map(s => ({ ...s, hw_title: hw.title }))
  );
  const feedback = session.student_feedback.find(f => f.student === student.name);
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const handleDownloadPDF = () => {
    const el = document.getElementById('session-student-report-print');
    if (!el) return;
    const pageStyles = Array.from(
      document.head.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')
    ).map(n => n.outerHTML).join('\n');
    const popup = window.open('', '_blank', 'width=900,height=800,scrollbars=yes');
    if (!popup) return;
    popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${student.name} — Session Report</title>
  ${pageStyles}
  <style>
    body { background: white !important; padding: 24px; font-family: Arial, sans-serif; }
    button { display: none !important; }
    .overflow-hidden, .overflow-auto, .overflow-y-auto { overflow: visible !important; }
    @page { margin: 12mm; size: A4 portrait; }
    @media print {
      body { padding: 0; }
      table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 8pt; }
      th, td { border: 1px solid #ccc; padding: 3pt 5pt; vertical-align: top; }
      thead tr { background: #e8e8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${el.innerHTML}
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</body>
</html>`);
    popup.document.close();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <p className="text-base font-bold text-gray-900">{student.name} — Session Report</p>
          <p className="text-xs text-gray-400">{session.batch_name} · {session.subject} · {fmtDate(session.scheduled_start)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700">
            <Printer className="h-4 w-4" />
            Download PDF
          </button>
          <button onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {/* Scrollable report body */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div id="session-student-report-print" className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
            <div>
              <p className="text-lg font-bold text-gray-900">{student.name}</p>
              <p className="text-sm text-gray-600 mt-0.5">{session.batch_name} · {session.subject} · Grade {session.grade}</p>
              <p className="text-xs text-gray-400 mt-0.5">{student.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Individual Session Report</p>
              <p className="text-xs text-gray-400 mt-1">{fmtDate(session.scheduled_start)}</p>
              <p className="text-xs text-gray-400">Generated {generatedDate}</p>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Attendance',
                value: student.status === 'present' ? 'Present' : student.status === 'late' ? 'Late' : 'Absent',
                sub: student.is_late && student.late_by_sec > 0 ? `Late by ${fmtDuration(student.late_by_sec)}` : student.status === 'absent' ? 'Did not join' : 'On time',
                color: student.status === 'present' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : student.status === 'late' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700',
              },
              {
                label: 'Time in Class',
                value: fmtDuration(student.time_in_class_sec),
                sub: `${session.actual_duration_min} min session`,
                color: 'border-sky-200 bg-sky-50 text-sky-700',
              },
              {
                label: 'Attention',
                value: fmtPct(student.attention_avg),
                sub: 'AI monitored average',
                color: student.attention_avg == null ? 'border-gray-200 bg-gray-50 text-gray-500'
                  : student.attention_avg >= 75 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : student.attention_avg >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-red-200 bg-red-50 text-red-700',
              },
              {
                label: 'Exam Score',
                value: exams.length > 0 ? `${exams[0].score}%` : '—',
                sub: exams.length > 0 ? `${exams[0].correct}/${exams[0].total} · ${exams[0].topic}` : 'No exam this session',
                color: exams.length === 0 ? 'border-gray-200 bg-gray-50 text-gray-500'
                  : exams[0].score >= 75 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : exams[0].score >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-red-200 bg-red-50 text-red-700',
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className={`rounded-xl border p-3 ${color}`}>
                <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</p>
                <p className="text-2xl font-bold mt-0.5">{value}</p>
                <p className="text-[10px] mt-0.5 opacity-70">{sub}</p>
              </div>
            ))}
          </div>

          {/* Session info */}
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">Session Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-500">Teacher: </span><span className="font-medium text-gray-800">{session.teacher.name}</span></div>
              <div><span className="text-gray-500">Subject: </span><span className="font-medium text-gray-800">{session.subject}</span></div>
              <div><span className="text-gray-500">Scheduled: </span><span className="font-medium text-gray-800">{fmtTime(session.scheduled_start)}</span></div>
              <div><span className="text-gray-500">Went Live: </span><span className="font-medium text-gray-800">{fmtTime(session.go_live_at)}</span></div>
              <div><span className="text-gray-500">Ended: </span><span className="font-medium text-gray-800">{fmtTime(session.ended_at)}</span></div>
              <div><span className="text-gray-500">Duration: </span><span className="font-medium text-gray-800">{session.actual_duration_min} min</span></div>
              {session.class_portion && <div className="col-span-2"><span className="text-gray-500">Portion: </span><span className="font-medium text-gray-800">{session.class_portion}</span></div>}
            </div>
          </div>

          {/* Student join/leave */}
          {student.time_in_class_sec > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">Class Participation</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Joined at</p>
                  <p className="text-base font-bold text-gray-800">{fmtTime(student.first_join)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Left at</p>
                  <p className="text-base font-bold text-gray-800">{fmtTime(student.last_leave)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Rejoins</p>
                  <p className="text-base font-bold text-gray-800">{Math.max(0, student.join_count - 1)}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Monitoring */}
          {monitoring && monitoring.events.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">AI Monitoring Breakdown</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Event Type</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Occurrences</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Total Duration</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Avg Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitoring.events.map((ev, i) => {
                      const isBad = ['eyes_closed', 'tab_switched', 'multiple_faces', 'phone_detected'].includes(ev.type);
                      const isWarn = ['looking_away', 'head_turned', 'distracted'].includes(ev.type);
                      return (
                        <tr key={i} className="border-t border-gray-100">
                          <td className={`px-3 py-2 font-medium ${isBad ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-sky-600'}`}>
                            {ev.type.replace(/_/g, ' ')}
                          </td>
                          <td className={`px-3 py-2 font-bold ${ev.occurrences >= 5 ? 'text-red-600' : ev.occurrences >= 2 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {ev.occurrences}×
                          </td>
                          <td className="px-3 py-2 text-gray-600">{fmtDuration(ev.total_duration_sec)}</td>
                          <td className="px-3 py-2 text-gray-500">{ev.avg_confidence != null ? `${Math.round(ev.avg_confidence * 100)}%` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {session.ai_monitoring.alerts.filter(a => a.student_email === student.email || a.student_name === student.name).length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Alerts Triggered</p>
                  {session.ai_monitoring.alerts
                    .filter(a => a.student_email === student.email || a.student_name === student.name)
                    .map((a, i) => (
                      <div key={i} className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${a.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                        <span className={`font-bold ${a.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{a.severity.toUpperCase()}</span>
                        <span className="text-gray-600">{a.message || a.type.replace(/_/g, ' ')}</span>
                        <span className="ml-auto text-gray-400">{fmtTime(a.at)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Exam results */}
          {exams.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">Exam Results</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 font-semibold text-gray-600">Topic</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Score</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Correct</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Time Taken</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-800">{ex.topic}</td>
                      <td className={`px-3 py-2 font-bold ${ex.score >= 75 ? 'text-emerald-600' : ex.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{ex.score}%</td>
                      <td className="px-3 py-2 text-gray-600">{ex.correct}/{ex.total}</td>
                      <td className="px-3 py-2 text-gray-600">{fmtDuration(ex.time_sec)}</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{gradeFromScore(ex.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Homework submissions */}
          {hwSubs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">Homework</p>
              <div className="space-y-2">
                {hwSubs.map((sub, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-xs">
                    <span className="font-medium text-gray-800">{sub.hw_title}</span>
                    <span className={`font-semibold ${sub.completion_status === 'completed' ? 'text-emerald-600' : sub.completion_status === 'partial' ? 'text-amber-600' : 'text-red-600'}`}>{sub.completion_status}</span>
                    {sub.delay_days > 0 ? <span className="text-red-500">{sub.delay_days}d late</span> : <span className="text-emerald-600">On time</span>}
                    <span className="font-bold text-gray-700">{sub.grade || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher reports about this student */}
          {teacherReports.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider border-b border-red-200 pb-1 mb-3">Teacher Reports</p>
              <div className="space-y-2">
                {teacherReports.map((r, i) => (
                  <div key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-red-700">{r.category}</span>
                      <span className="text-red-500">{r.severity}</span>
                      <span className="ml-auto text-gray-400">{fmtTime(r.at)}</span>
                    </div>
                    <p className="text-gray-700">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student feedback given */}
          {feedback && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">Feedback Given</p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs space-y-1">
                <div className="text-amber-600 font-bold">{'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)} ({feedback.rating}/5)</div>
                {feedback.text && <p className="text-gray-700">{feedback.text}</p>}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-3 flex items-center justify-between text-[10px] text-gray-400">
            <span>{session.batch_name} · {session.subject}</span>
            <span>Generated by {platformName} Portal · {generatedDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── KPI Card ──────────────────────────────────────────── */

function KpiCard({ label, value, sub, alert, icon: Icon, tone = 'indigo' }: {
  label: string; value: string; sub?: string; alert?: boolean; icon?: React.ComponentType<{ className?: string }>;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
}) {
  const tones: Record<string, { iconBg: string; iconText: string }> = {
    indigo:  { iconBg: 'bg-indigo-50',  iconText: 'text-indigo-600' },
    emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
    amber:   { iconBg: 'bg-amber-50',   iconText: 'text-amber-600' },
    rose:    { iconBg: 'bg-rose-50',    iconText: 'text-rose-600' },
    purple:  { iconBg: 'bg-purple-50',  iconText: 'text-purple-600' },
    slate:   { iconBg: 'bg-slate-100',  iconText: 'text-slate-600' },
  };
  const t = alert
    ? { iconBg: 'bg-red-50', iconText: 'text-red-600' }
    : tones[tone];
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${alert ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</div>
          <div className={`mt-1.5 text-[26px] leading-none font-bold tracking-tight ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
          {sub && <div className={`mt-1.5 text-[11px] font-medium ${alert ? 'text-red-500' : 'text-slate-500'}`}>{sub}</div>}
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.iconBg}`}>
            <Icon className={`h-4 w-4 ${t.iconText}`} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────── */

export default function SessionReportView({
  roomId,
  onClose,
}: {
  roomId: string;
  onClose: () => void;
}) {
  const platformName = usePlatformName();
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<AttendanceDetail | null>(null);

  const fetchReport = useCallback(async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/v1/room/${roomId}/report${refresh ? '?refresh=1' : ''}`;
      const res = await fetch(url);
      const d = await res.json();
      if (!d.success) { setError(d.error || 'Failed to load report'); return; }
      setReport(d.data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const s = report?.data?.sessions?.[0];

  const handleDownloadPDF = () => {
    const el = document.getElementById('session-full-report-print');
    if (!el || !s) return;
    const pageStyles = Array.from(
      document.head.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')
    ).map(n => n.outerHTML).join('\n');
    const popup = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes');
    if (!popup) return;
    const title = `${s.batch_name} \u2014 ${s.subject} Session Report`;
    popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${pageStyles}
  <style>
    body { background: white !important; padding: 24px; font-family: Arial, sans-serif; }
    button { display: none !important; }
    .overflow-hidden, .overflow-auto, .overflow-y-auto { overflow: visible !important; }
    @page { margin: 12mm; size: A4 portrait; }
    @media print {
      body { padding: 0; }
      table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 8pt; }
      th, td { border: 1px solid #ccc; padding: 3pt 5pt; vertical-align: top; }
      thead tr { background: #e8e8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${el.innerHTML}
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</body>
</html>`);
    popup.document.close();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Classroom</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">Session Report</span>
                </div>
                {s && (
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {s.batch_name} · <span className="font-medium text-slate-600">{s.subject}</span>
                  </h2>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => fetchReport(true)} disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {s && (
                <button onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-sm">
                  <Download className="h-3.5 w-3.5" />
                  Export PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div id="session-full-report-print" className="p-6 space-y-5 max-w-6xl mx-auto">
            {loading && (
              <div className="flex items-center justify-center py-32">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
            )}
            {s && (
              <>
                {/* Hero Card */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-lg">
                  <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
                  <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Session Ended
                        </span>
                        {s.batch_type && (
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                            {s.batch_type}
                          </span>
                        )}
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                          Grade {s.grade}
                        </span>
                      </div>
                      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{s.batch_name}</h1>
                      <p className="mt-1 text-sm text-slate-300">{s.subject}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200 ring-1 ring-inset ring-indigo-400/30">
                            {(s.teacher.name || 'T').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Teacher</p>
                            <p className="text-sm font-medium text-white">{s.teacher.name}</p>
                          </div>
                        </div>
                        <div className="hidden h-8 w-px bg-white/10 sm:block" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date</p>
                          <p className="text-sm font-medium text-white">{fmtDate(s.scheduled_start)}</p>
                        </div>
                        <div className="hidden h-8 w-px bg-white/10 sm:block" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Scheduled</p>
                          <p className="text-sm font-medium text-white">{fmtTime(s.scheduled_start)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-400">
                      <p>Generated</p>
                      <p className="text-slate-200 font-medium">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  {(s.session_topic || s.session_notes || s.class_portion) && (
                    <div className="relative mt-5 rounded-xl bg-white/5 backdrop-blur-sm p-4 ring-1 ring-inset ring-white/10">
                      {s.session_topic && (
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Topic</p>
                            <p className="text-sm font-semibold text-white">{s.session_topic}</p>
                          </div>
                        </div>
                      )}
                      {s.class_portion && (
                        <p className="mt-2 text-xs text-slate-300"><span className="font-semibold text-slate-400">Portion: </span>{s.class_portion}</p>
                      )}
                      {s.session_notes && (
                        <p className="mt-2 text-xs text-slate-300">{s.session_notes}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Recording ── */}
                {s.recording && (s.recording.url || s.recording.status !== 'none') && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 p-4 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-md shrink-0">
                        <Video className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">Session Recording</p>
                        <p className="text-xs text-slate-500 capitalize">Status: {s.recording.status.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    {s.recording.url ? (
                      <a href={s.recording.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 shrink-0 shadow-sm">
                        <Video className="h-4 w-4" />
                        Watch
                      </a>
                    ) : (
                      <span className="text-xs text-purple-700 font-semibold">{s.recording.status === 'processing' ? 'Processing…' : 'Unavailable'}</span>
                    )}
                  </div>
                )}

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard icon={Clock}
                    tone={s.teacher_late ? 'amber' : 'emerald'}
                    label="Go Live"
                    value={fmtTime(s.go_live_at)}
                    sub={s.teacher_late ? `${Math.round(s.go_live_delay_sec / 60)}m late` : 'On time'}
                    alert={s.teacher_late}
                  />
                  <KpiCard icon={Activity}
                    tone="indigo"
                    label="Duration"
                    value={`${s.actual_duration_min}m`}
                    sub={`of ${s.scheduled_duration_min}m scheduled`}
                  />
                  <KpiCard icon={Users}
                    tone="emerald"
                    label="Attendance"
                    value={`${s.attendance.present}/${s.attendance.total_students}`}
                    sub={`${s.attendance.attendance_rate}% · ${s.attendance.late} late`}
                  />
                  <KpiCard icon={AlertTriangle}
                    tone={s.ai_monitoring.alert_summary.critical > 0 ? 'rose' : 'slate'}
                    label="AI Alerts"
                    value={String(s.ai_monitoring.alert_summary.total)}
                    sub={`${s.ai_monitoring.alert_summary.critical} critical · ${s.ai_monitoring.alert_summary.warnings} warning`}
                    alert={s.ai_monitoring.alert_summary.critical > 0}
                  />
                </div>

                {/* ── Teacher Timing ── */}
                <Section title="Teacher Timing" icon={Clock} accent="slate">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Scheduled: </span><strong>{fmtTime(s.scheduled_start)}</strong></div>
                    <div>
                      <span className="text-gray-500">Go Live: </span><strong>{fmtTime(s.go_live_at)}</strong>
                      {' '}{s.teacher_late
                        ? <Badge color="red">Late by {fmtDuration(s.go_live_delay_sec)}</Badge>
                        : <Badge color="green">On time</Badge>}
                    </div>
                    <div><span className="text-gray-500">Ended: </span><strong>{fmtTime(s.ended_at)}</strong></div>
                    <div><span className="text-gray-500">Actual Duration: </span><strong>{s.actual_duration_min}m</strong> / {s.scheduled_duration_min}m</div>
                    {s.class_portion && <div className="col-span-2"><span className="text-gray-500">Portion Covered: </span>{s.class_portion}</div>}
                    {s.class_remarks && <div className="col-span-2"><span className="text-gray-500">Remarks: </span>{s.class_remarks}</div>}
                  </div>
                </Section>

                {/* ── Attendance ── */}
                <Section title={`Attendance (${s.attendance.present}/${s.attendance.total_students} · ${s.attendance.attendance_rate}%)`} icon={Users} accent="emerald">
                  {s.attendance.details.length === 0 ? (
                    <p className="text-sm text-gray-400">No student data</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 font-semibold text-gray-600">Student</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Status</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Joined</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Time in Class</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Rejoins</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Attention</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.attendance.details.map((st, i) => (
                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800">{st.name || st.email}</td>
                              <td className="px-3 py-2">
                                <Badge color={st.status === 'present' ? 'green' : st.status === 'late' ? 'yellow' : 'red'}>
                                  {st.status === 'present' ? 'Present' : st.status === 'late' ? `Late${st.late_by_sec > 0 ? ` (${fmtDuration(st.late_by_sec)})` : ''}` : 'Absent'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{fmtTime(st.first_join)}</td>
                              <td className="px-3 py-2 text-gray-600">{fmtDuration(st.time_in_class_sec)}</td>
                              <td className="px-3 py-2 text-gray-600">{Math.max(0, st.join_count - 1)}</td>
                              <td className="px-3 py-2">
                                {st.attention_avg != null
                                  ? <span className={`font-semibold ${attColor(st.attention_avg)}`}>{Math.round(st.attention_avg)}%</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => setSelectedStudent(st)}
                                  className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                                >
                                  <Printer className="h-3 w-3" />
                                  Report
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                {/* ── Join/Leave Log ── */}
                {s.join_leave_log.length > 0 && (
                  <Section title={`Join/Leave Log (${s.join_leave_log.length} events)`} icon={Users} defaultOpen={false} accent="slate">
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {s.join_leave_log.map((l, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${l.event === 'join' || l.event === 'rejoin' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          <span className="text-gray-400 w-16 shrink-0">{fmtTime(l.at)}</span>
                          <span className="font-medium text-gray-700">{l.name || l.email}</span>
                          <Badge color={l.event === 'join' || l.event === 'rejoin' ? 'green' : l.event === 'leave' ? 'red' : 'gray'}>{l.event}</Badge>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── AI Monitoring ── */}
                <Section
                  title={`AI Monitoring (${s.ai_monitoring.alert_summary.total} alerts · ${s.ai_monitoring.alert_summary.critical} critical)`}
                  icon={Brain}
                  accent="purple"
                  defaultOpen={s.ai_monitoring.alert_summary.total > 0}
                >
                  {Object.keys(s.ai_monitoring.per_student).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(s.ai_monitoring.per_student).map(([email, data]) => (
                        <div key={email} className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                          <p className="text-sm font-semibold text-gray-800 mb-2">{data.name || email}</p>
                          <div className="flex flex-wrap gap-2">
                            {data.events.map((e, i) => (
                              <Badge key={i} color={['eyes_closed', 'tab_switched', 'multiple_faces', 'phone_detected'].includes(e.type) ? 'red' : ['looking_away', 'head_turned', 'distracted'].includes(e.type) ? 'yellow' : e.type === 'writing_notes' ? 'blue' : 'gray'}>
                                {e.type.replace(/_/g, ' ')} ×{e.occurrences} ({fmtDuration(e.total_duration_sec)})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No monitoring data recorded</p>
                  )}
                  {s.ai_monitoring.alerts.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Alert Log</p>
                      {s.ai_monitoring.alerts.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100">
                          <Badge color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'gray'}>{a.severity}</Badge>
                          <span className="font-medium text-gray-700">{a.student_name}</span>
                          <span className="text-gray-400">{a.message || a.type}</span>
                          <span className="ml-auto text-gray-400">{fmtTime(a.at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* ── Exam Results ── */}
                {s.exam_results.length > 0 && (
                  <Section title={`Exam Results (${s.exam_results.length} submissions)`} icon={Award} defaultOpen={true} accent="indigo">
                    {s.exam_summary && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Class Avg</div>
                          <div className="text-2xl font-bold text-emerald-700 mt-1">{s.exam_summary.class_avg}%</div>
                        </div>
                        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Pass Rate</div>
                          <div className="text-2xl font-bold text-blue-700 mt-1">{s.exam_summary.pass_rate}%</div>
                          <div className="text-[10px] text-blue-600">{s.exam_summary.pass_count}/{s.exam_summary.attempts} passed</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center justify-center gap-1"><Trophy className="h-3 w-3" /> Top</div>
                          <div className="text-sm font-bold text-amber-800 mt-1 truncate">{s.exam_summary.top_scorer.name}</div>
                          <div className="text-xs text-amber-600">{s.exam_summary.top_scorer.score}%</div>
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Needs Help</div>
                          <div className="text-sm font-bold text-red-800 mt-1 truncate">{s.exam_summary.low_scorer.name}</div>
                          <div className="text-xs text-red-600">{s.exam_summary.low_scorer.score}%</div>
                        </div>
                      </div>
                    )}
                    {s.exam_summary && s.exam_summary.by_topic.length > 1 && (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-3">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Average by Topic</p>
                        <div className="space-y-1.5">
                          {s.exam_summary.by_topic.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="min-w-[140px] truncate font-medium text-gray-700">{t.topic}</span>
                              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div className={`h-full ${t.avg >= 75 ? 'bg-emerald-500' : t.avg >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${t.avg}%` }} />
                              </div>
                              <span className="w-12 text-right font-bold text-gray-800">{t.avg}%</span>
                              <span className="w-12 text-right text-gray-400">n={t.attempts}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 font-semibold text-gray-600">Student</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Topic</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Score</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Correct</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Time</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.exam_results.map((e, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-2 font-medium text-gray-800">{e.student}</td>
                              <td className="px-3 py-2 text-gray-600">{e.topic}</td>
                              <td className="px-3 py-2"><span className={`font-bold ${e.score >= 75 ? 'text-emerald-600' : e.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{e.score}%</span></td>
                              <td className="px-3 py-2 text-gray-600">{e.correct}/{e.total}</td>
                              <td className="px-3 py-2 text-gray-600">{fmtDuration(e.time_sec)}</td>
                              <td className="px-3 py-2 font-bold text-gray-800">{gradeFromScore(e.score)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                )}

                {/* ── Chat ── */}
                {s.chat.message_count > 0 && (
                  <Section title={`Chat (${s.chat.message_count} messages)`} icon={MessageSquare} defaultOpen={false} accent="slate">
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {s.chat.messages.map((m, i) => (
                        <div key={i} className="text-xs border-b border-gray-100 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{fmtTime(m.at)}</span>
                            <span className="font-medium text-gray-800">{m.sender}</span>
                            <Badge color={m.role === 'teacher' ? 'blue' : 'gray'}>{m.role}</Badge>
                          </div>
                          <p className="mt-0.5 text-gray-500">{m.text}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Doubts (Q&A) ── */}
                {s.doubts.list && s.doubts.list.length > 0 && (
                  <Section title={`Doubts & Questions (${s.doubts.total} · ${s.doubts.answered} answered · ${s.doubts.open} open)`} icon={HelpCircle} defaultOpen={s.doubts.open > 0} accent="amber">
                    <div className="space-y-2">
                      {s.doubts.list.map((d, i) => (
                        <div key={i} className={`rounded-xl border p-3 text-xs ${d.status === 'answered' ? 'bg-emerald-50 border-emerald-200' : d.status === 'open' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge color={d.status === 'answered' ? 'green' : d.status === 'open' ? 'yellow' : 'gray'}>{d.status}</Badge>
                            {d.subject && <span className="text-gray-500">{d.subject}</span>}
                            <span className="ml-auto text-gray-400">{fmtTime(d.at)}</span>
                          </div>
                          <p className="text-gray-500 mb-1"><span className="font-medium">{d.student}:</span></p>
                          <p className="text-gray-800">{d.text}</p>
                          {d.reply && (
                            <div className="mt-2 pl-3 border-l-2 border-emerald-300">
                              <p className="text-[11px] text-emerald-700 font-semibold">Teacher reply ({d.replied_by || ''}{d.replied_at ? ` · ${fmtTime(d.replied_at)}` : ''}):</p>
                              <p className="text-gray-700 mt-0.5">{d.reply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Materials Shared ── */}
                {s.materials && s.materials.length > 0 && (
                  <Section title={`Materials Shared (${s.materials.length})`} icon={Paperclip} defaultOpen={false} accent="indigo">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {s.materials.map((m, i) => (
                        <a key={i} href={m.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 transition">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 truncate">{m.title || m.file_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{m.file_name} · {(m.file_size_bytes / 1024).toFixed(0)} KB · {m.file_type}</p>
                            {m.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Teacher Fraud Reports ── */}
                {s.teacher_reports.length > 0 && (
                  <Section title={`Fraud Reports by Students (${s.teacher_reports.length})`} icon={ShieldAlert} accent="rose">
                    <div className="space-y-2">
                      {s.teacher_reports.map((r, i) => (
                        <div key={i} className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge color="red">{r.category}</Badge>
                            <Badge color={r.severity === 'critical' ? 'red' : 'yellow'}>{r.severity}</Badge>
                            <span className="ml-auto text-gray-400">{fmtTime(r.at)}</span>
                          </div>
                          <p className="text-gray-500">By: {r.student}</p>
                          <p className="text-gray-700">{r.description}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Student Feedback ── */}
                {s.student_feedback.length > 0 && (
                  <Section title={`Student Feedback (${s.student_feedback.length})`} icon={Star} defaultOpen={false} accent="amber">
                    <div className="space-y-2">
                      {s.student_feedback.map((f, i) => (
                        <div key={i} className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                            <span className="text-gray-500">{f.student}</span>
                          </div>
                          {f.text && <p className="mt-1 text-gray-700">{f.text}</p>}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Homework ── */}
                {s.homework && s.homework.total_assigned > 0 && (
                  <Section title={`Homework (${s.homework.total_assigned} assigned)`} icon={BookOpen} defaultOpen={false} accent="emerald">
                    <div className="space-y-4">
                      {s.homework.assignments.map((hw, i) => (
                        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800">{hw.title}</p>
                            <Badge color={hw.status === 'active' ? 'green' : 'gray'}>{hw.status}</Badge>
                          </div>
                          {hw.description && <p className="text-xs text-gray-400">{hw.description}</p>}
                          {hw.due_date && <p className="text-xs text-gray-400">Due: {fmtDate(hw.due_date)}{hw.due_time ? ` ${hw.due_time}` : ''}</p>}
                          {hw.questions.length > 0 && (
                            <div className="space-y-0.5">
                              {hw.questions.map((q, qi) => (
                                <p key={qi} className="text-xs"><span className="font-medium text-gray-600">{q.number}.</span> {q.text}</p>
                              ))}
                            </div>
                          )}
                          {hw.submissions.length > 0 && (
                            <div className="overflow-x-auto mt-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 text-left">
                                    <th className="px-3 py-1.5 font-semibold text-gray-600">Student</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-600">Status</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-600">Delay</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-600">Files</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-600">Grade</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hw.submissions.map((sub, si) => (
                                    <tr key={si} className="border-t border-gray-100">
                                      <td className="px-3 py-1.5 font-medium text-gray-800">{sub.student}</td>
                                      <td className="px-3 py-1.5"><Badge color={sub.completion_status === 'completed' ? 'green' : sub.completion_status === 'partial' ? 'yellow' : 'red'}>{sub.completion_status}</Badge></td>
                                      <td className="px-3 py-1.5">{sub.delay_days > 0 ? <span className="text-red-500">{sub.delay_days}d late</span> : <span className="text-emerald-600">On time</span>}</td>
                                      <td className="px-3 py-1.5 text-gray-600">{sub.file_count > 0 ? `${sub.file_count} file${sub.file_count > 1 ? 's' : ''}` : '—'}</td>
                                      <td className="px-3 py-1.5 font-bold text-gray-800">{sub.grade || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Summary ── */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <KpiCard icon={ShieldAlert} tone={s.contact_violations > 0 ? 'rose' : 'slate'}
                    label="Contact Violations" value={String(s.contact_violations)}
                    sub={s.contact_violations > 0 ? 'Policy breach detected' : 'No violations'}
                    alert={s.contact_violations > 0}
                  />
                  <KpiCard icon={HelpCircle} tone="amber"
                    label="Doubts" value={String(s.doubts.total)}
                    sub={`${s.doubts.answered} answered · ${s.doubts.open} open`}
                  />
                  <KpiCard icon={MessageSquare} tone="indigo"
                    label="Chat Messages" value={String(s.chat.message_count)}
                    sub={s.chat.message_count > 0 ? 'Class engagement active' : 'No messages'}
                  />
                </div>

                {report?.data?.narrative_summary && (
                  <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                        <Brain className="h-3.5 w-3.5 text-white" />
                      </div>
                      <p className="text-xs font-bold text-indigo-900 uppercase tracking-[0.08em]">AI Summary</p>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{report.data.narrative_summary}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Per-student report overlay */}
      {selectedStudent && s && (
        <SessionStudentReportOverlay
          student={selectedStudent}
          session={s}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </>
  );
}
