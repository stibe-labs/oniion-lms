'use client';
/**
 * BatchReportModal — Multi-session performance report generator
 * Renders inside the AO Dashboard Batches → Sessions tab.
 *
 * Steps:
 *  1. select   → checkbox list of ended sessions
 *  2. loading  → spinner while API fetches aggregated data
 *  3. report   → full report preview + PDF download via window.print()
 */

import React, { useState, useMemo, useCallback } from 'react';
import { usePlatformName } from '@/components/providers/PlatformProvider';
import {
  Modal, Button, Avatar, TableWrapper, THead, TH, TRow,
  Badge, EmptyState, useToast,
} from '@/components/dashboard/shared';
import {
  FileText, CheckSquare, Square, Download, ChevronDown,
  ChevronUp, Users, Calendar, BarChart3, Award, BookOpen,
  TrendingUp, Clock, Star, AlertTriangle, Printer, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionStub {
  session_id: string;
  subject: string;
  scheduled_date: string;
  start_time: string;
  status: string;
  teacher_name?: string | null;
  duration_minutes?: number | null;
  livekit_room_name?: string | null;
}

interface SessionSummary {
  session_id: string;
  subject: string;
  scheduled_date: string;
  start_time: string;
  teacher_name: string;
  actual_duration_min: number;
  scheduled_duration_min?: number;
  overtime_min?: number;
  present_count: number;
  total_students: number;
  avg_exam_score: number | null;
  topic: string | null;
  teacher_rating: number | null;
}

interface StudentMonitoring {
  engagedSec: number;
  writingNotesCount: number;
  writingNotesSec: number;
  tabSwitchCount: number;
  tabSwitchedSec: number;
  phoneDetectedSec: number;
  distractedSec: number;
  inactiveSec: number;
  multipleFacesSec: number;
}

interface StudentReportRow {
  email: string;
  name: string;
  grade: string;
  board: string;
  attendance: { present: number; late: number; absent: number; total: number; rate: number };
  avgAttention: number | null;
  monitoring: StudentMonitoring | null;
  exams: { session_id: string; topic: string; score: number; total: number; percentage: number; grade_letter: string }[];
  avgExamScore: number | null;
  overallGrade: string | null;
}

interface BatchReportData {
  batch: { batch_id: string; batch_name: string; grade: string; board: string; subjects: string[]; batch_type: string };
  sessions: SessionSummary[];
  students: StudentReportRow[];
  overallStats: {
    totalSessions: number;
    totalStudents: number;
    avgAttendanceRate: number;
    avgExamScore: number | null;
    totalClassTimeMin: number;
    dateRange: { from: string; to: string };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime12(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function fmtDuration(min: number) {
  if (!min) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function fmtSec(sec: number) {
  if (!sec) return '—';
  const m = Math.round(sec / 60);
  if (m < 1) return '<1 min';
  return fmtDuration(m);
}

function gradeColor(g: string | null) {
  if (!g) return 'bg-gray-100 text-gray-500';
  if (g === 'A') return 'bg-emerald-100 text-emerald-700';
  if (g === 'B') return 'bg-teal-100 text-teal-700';
  if (g === 'C') return 'bg-amber-100 text-amber-700';
  if (g === 'D') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}
function attColor(rate: number) {
  if (rate >= 75) return 'text-emerald-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-600';
}
function attColorBg(rate: number) {
  if (rate >= 75) return 'bg-emerald-500';
  if (rate >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Mini bar for monitoring ──────────────────────────────────────────────────
function MonBar({ label, sec, color, warn }: { label: string; sec: number; color: string; warn?: boolean }) {
  if (!sec) return <span className="text-gray-300 text-[10px]">—</span>;
  const min = Math.round(sec / 60);
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${warn && min >= 3 ? 'text-red-600' : warn && min >= 1 ? 'text-amber-600' : color}`}>
      {min}m
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  batchId: string;
  sessions: SessionStub[];
  onClose: () => void;
}

export default function BatchReportModal({ batchId, sessions, onClose }: Props) {
  const platformName = usePlatformName();
  const toast = useToast();

  const endedSessions = useMemo(() =>
    sessions.filter(s => s.status === 'ended'),
  [sessions]);

  // ── State ──────────────────────────────────────────────────────
  const [step, setStep] = useState<'select' | 'loading' | 'report'>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set(endedSessions.map(s => s.session_id)));
  const [report, setReport] = useState<BatchReportData | null>(null);
  const [sortKey, setSortKey] = useState<'name' | 'attendance' | 'exam' | 'grade'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentReport, setStudentReport] = useState<StudentReportRow | null>(null);

  // ── Selection ─────────────────────────────────────────────────
  const allSelected = selected.size === endedSessions.length && endedSessions.length > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(endedSessions.map(s => s.session_id)));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Generate report ───────────────────────────────────────────
  const generate = useCallback(async () => {
    if (selected.size === 0) return;
    setStep('loading');
    try {
      const ids = Array.from(selected).join(',');
      const res = await fetch(`/api/v1/batches/${batchId}/report?sessions=${ids}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to generate report');
      setReport(data.data as BatchReportData);
      setStep('report');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report');
      setStep('select');
    }
  }, [batchId, selected, toast]);

  // ── Sorted students ───────────────────────────────────────────
  const sortedStudents = useMemo(() => {
    if (!report) return [];
    return [...report.students].sort((a, b) => {
      if (sortKey === 'name') return sortAsc
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
      let va: number, vb: number;
      if (sortKey === 'attendance') { va = a.attendance.rate; vb = b.attendance.rate; }
      else if (sortKey === 'exam') { va = a.avgExamScore ?? -1; vb = b.avgExamScore ?? -1; }
      else { va = 'ABCDF'.indexOf(a.overallGrade || 'F'); vb = 'ABCDF'.indexOf(b.overallGrade || 'F'); }
      return sortAsc ? va - vb : vb - va;
    });
  }, [report, sortKey, sortAsc]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(a => !a); else { setSortKey(key); setSortAsc(false); }
  };

  // ── PDF download via popup window (avoids modal overflow clipping) ────────
  const handleDownloadBatchPDF = useCallback(() => {
    const el = document.getElementById('batch-report-print');
    if (!el || !report) return;

    const pageStyles = Array.from(
      document.head.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')
    ).map(n => n.outerHTML).join('\n');

    const popup = window.open('', '_blank', 'width=1280,height=900,scrollbars=yes');
    if (!popup) { window.print(); return; }

    const title = `${report.batch.batch_name} — ${platformName} Performance Report`;
    popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${pageStyles}
  <style>
    body { background: white !important; padding: 24px; font-family: Arial, sans-serif; }
    /* Hide screen-only elements */
    .no-print { display: none !important; }
    /* Show print-only elements */
    .hidden.print-show { display: block !important; }
    .hidden.print-show-flex { display: flex !important; }
    .hidden.print-kpi-grid { display: grid !important; grid-template-columns: repeat(5,1fr); gap: 6pt; margin-bottom: 10pt; }
    .hidden.print-section-title { display: block !important; }
    /* Remove overflow constraints */
    .overflow-hidden, .overflow-auto, .overflow-y-auto { overflow: visible !important; }
    @page { margin: 12mm; size: A4 landscape; }
    @media print {
      body { padding: 0; }
      .print-break { page-break-before: always !important; }
      table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10pt; }
      th, td { border: 1px solid #999; padding: 3pt 5pt; vertical-align: top; }
      thead tr { background: #e8e8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      tfoot tr { background: #f0f0f0 !important; print-color-adjust: exact; font-weight: bold; }
      .at-risk-row td { background: #fff8e1 !important; print-color-adjust: exact; }
      .mon-ok { color: #1a7a4a; } .mon-warn { color: #c07800; } .mon-bad { color: #c0392b; }
    }
  </style>
</head>
<body>
  ${el.innerHTML}
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});<\/script>
</body>
</html>`);
    popup.document.close();
  }, [report]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Print styles — proper A4 document layout ───────────────────────── */}
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 landscape; }
          body * { visibility: hidden !important; }
          #batch-report-print, #batch-report-print * { visibility: visible !important; }
          #batch-report-print {
            position: fixed !important; inset: 0 !important;
            background: white !important; overflow: visible !important;
            font-family: Arial, sans-serif !important; font-size: 9pt !important;
            color: #111 !important; padding: 0 !important;
          }
          .no-print { display: none !important; }
          .print-show { display: block !important; }
          .print-show-flex { display: flex !important; }
          /* Section page breaks */
          .print-break { page-break-before: always !important; }
          /* Proper bordered tables */
          #batch-report-print table {
            width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10pt;
          }
          #batch-report-print th, #batch-report-print td {
            border: 1px solid #999; padding: 3pt 5pt; vertical-align: top;
          }
          #batch-report-print thead tr { background: #e8e8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          #batch-report-print tfoot tr { background: #f0f0f0 !important; print-color-adjust: exact; font-weight: bold; }
          /* KPI boxes for print */
          .print-kpi-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 6pt; margin-bottom: 10pt; }
          .print-kpi-box { border: 1px solid #bbb; padding: 5pt 7pt; }
          .print-kpi-label { font-size: 7pt; color: #555; text-transform: uppercase; letter-spacing: 0.4pt; }
          .print-kpi-value { font-size: 14pt; font-weight: bold; }
          /* Section title */
          .print-section-title { font-size: 10pt; font-weight: bold; margin: 8pt 0 4pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
          /* Grade badge */
          .print-grade { display: inline-block; border: 1px solid #999; padding: 0 4pt; font-weight: bold; font-size: 9pt; }
          /* Monitoring mini badge */
          .mon-ok { color: #1a7a4a; } .mon-warn { color: #c07800; } .mon-bad { color: #c0392b; }
          /* At-risk table */
          .at-risk-row td { background: #fff8e1 !important; print-color-adjust: exact; }
          /* Hide scrollbars etc. */
          .overflow-auto, .overflow-y-auto { overflow: visible !important; }
        }
      `}</style>

      <Modal
        open={true}
        title={step === 'report' && report
          ? `${report.batch.batch_name} — Performance Report`
          : 'Generate Batch Report'}
        subtitle={step === 'report' && report
          ? `Grade ${report.batch.grade} · ${report.batch.board}${
              report.overallStats.dateRange.from
                ? ` · ${fmtDate(report.overallStats.dateRange.from)} → ${fmtDate(report.overallStats.dateRange.to)}`
                : ''
            } · ${report.overallStats.totalSessions} session${report.overallStats.totalSessions !== 1 ? 's' : ''}`
          : undefined}
        onClose={onClose}
        fullScreen={step === 'report'}
        maxWidth="xl"
      >
        {/* ── Step 1: Session selection ──────────────────────────────────────── */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  Generate Batch Report
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Select ended sessions to include.</p>
              </div>
              {endedSessions.length > 0 && (
                <button onClick={toggleAll} className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 mt-1">
                  {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            {endedSessions.length === 0 ? (
              <EmptyState icon={Calendar} message="No ended sessions for this batch yet." />
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {endedSessions.map(s => {
                  const checked = selected.has(s.session_id);
                  return (
                    <button key={s.session_id} onClick={() => toggleOne(s.session_id)}
                      className={`w-full text-left rounded-xl border px-4 py-3 flex items-start gap-3 transition-all ${checked ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className={`mt-0.5 shrink-0 ${checked ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{s.subject}</span>
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${checked ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>Ended</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtDate(s.scheduled_date)} · {fmtTime12(s.start_time)}
                          {s.teacher_name && ` · ${s.teacher_name}`}
                          {s.duration_minutes && ` · ${s.duration_minutes} min`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button icon={BarChart3} variant="primary" onClick={generate} disabled={selected.size === 0}>
                Generate Report ({selected.size})
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Loading ────────────────────────────────────────────────── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center animate-pulse">
              <BarChart3 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">Generating report…</p>
            <p className="text-xs text-gray-400">Aggregating attendance, AI monitoring & exams</p>
          </div>
        )}

        {/* ── Step 3: Report ────────────────────────────────────────────────── */}
        {step === 'report' && report && (
          <div className="space-y-5">

            {/* Action bar — screen only */}
            <div className="flex items-center justify-end gap-2 no-print">
              <Button variant="outline" size="sm" onClick={() => setStep('select')}>← Back</Button>
              <Button icon={Download} size="sm" variant="primary" onClick={handleDownloadBatchPDF}>
                Download PDF
              </Button>
            </div>

            {/* ═══ PRINTABLE DOCUMENT ═══════════════════════════════════════ */}
            <div id="batch-report-print" className="space-y-5">

              {/* Print document header */}
              <div className="hidden print-show border-b-2 border-gray-800 pb-3 mb-4">
                <div className="print-show-flex items-start justify-between">
                  <div>
                    <div style={{fontSize:'14pt', fontWeight:'bold'}}>{report.batch.batch_name}</div>
                    <div style={{fontSize:'9pt', color:'#444'}}>
                      Student Performance Report &nbsp;·&nbsp; Grade {report.batch.grade} &nbsp;·&nbsp; {report.batch.board}
                    </div>
                  </div>
                  <div style={{fontSize:'8pt', color:'#666', textAlign:'right'}}>
                    {fmtDate(report.overallStats.dateRange.from)} – {fmtDate(report.overallStats.dateRange.to)}<br />
                    {report.overallStats.totalSessions} Sessions &nbsp;·&nbsp; Generated {new Date().toLocaleDateString('en-IN')}
                  </div>
                </div>
              </div>

              {/* KPI cards — screen */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 no-print">
                {[
                  { label: 'Sessions',       value: report.overallStats.totalSessions,                                                 icon: Calendar,   color: 'text-teal-600 bg-teal-50' },
                  { label: 'Students',        value: report.overallStats.totalStudents,                                                icon: Users,      color: 'text-emerald-600 bg-emerald-50' },
                  { label: 'Total Class Time',value: fmtDuration(report.overallStats.totalClassTimeMin),                              icon: Clock,      color: 'text-sky-600 bg-sky-50' },
                  { label: 'Avg Attendance',  value: `${report.overallStats.avgAttendanceRate}%`,                                     icon: TrendingUp, color: report.overallStats.avgAttendanceRate >= 75 ? 'text-emerald-600 bg-emerald-50' : report.overallStats.avgAttendanceRate >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50' },
                  { label: 'Avg Exam Score',  value: report.overallStats.avgExamScore != null ? `${report.overallStats.avgExamScore}%` : '—', icon: Award, color: 'text-purple-600 bg-purple-50' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* KPI boxes — print only */}
              <div className="hidden print-kpi-grid">
                {[
                  ['Sessions',        String(report.overallStats.totalSessions)],
                  ['Students',        String(report.overallStats.totalStudents)],
                  ['Total Class Time',fmtDuration(report.overallStats.totalClassTimeMin)],
                  ['Avg Attendance',  `${report.overallStats.avgAttendanceRate}%`],
                  ['Avg Exam Score',  report.overallStats.avgExamScore != null ? `${report.overallStats.avgExamScore}%` : 'N/A'],
                ].map(([l, v]) => (
                  <div key={l} className="print-kpi-box">
                    <div className="print-kpi-label">{l}</div>
                    <div className="print-kpi-value">{v}</div>
                  </div>
                ))}
              </div>

              {/* ── Session Summary ───────────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2 no-print">
                  <BookOpen className="h-4 w-4 text-emerald-600" /> Session Summary
                </h3>
                <div className="hidden print-section-title">1. Session Summary</div>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <TableWrapper>
                    <THead>
                      <TH>Date &amp; Time</TH>
                      <TH>Subject</TH>
                      <TH>Topic</TH>
                      <TH>Teacher</TH>
                      <TH>Duration</TH>
                      <TH>Attendance</TH>
                      <TH>Avg Exam</TH>
                      <TH>Rating</TH>
                    </THead>
                    <tbody>
                      {report.sessions.map(s => (
                        <TRow key={s.session_id}>
                          <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                            {fmtDate(s.scheduled_date)}<br /><span className="text-gray-400">{fmtTime12(s.start_time)}</span>
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{s.subject}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 max-w-[130px] truncate">{s.topic || '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{s.teacher_name}</td>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                            <span className="flex items-center gap-1 no-print">
                              <Clock className="h-3 w-3 text-gray-400" />{s.actual_duration_min} min
                              {s.overtime_min && s.overtime_min > 0 ? (
                                <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                  +{s.overtime_min}m OT
                                </span>
                              ) : null}
                            </span>
                            <span className="hidden print-show">
                              {s.actual_duration_min} min{s.overtime_min && s.overtime_min > 0 ? ` (+${s.overtime_min}m OT)` : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                            <span className={attColor(s.total_students > 0 ? Math.round(s.present_count / s.total_students * 100) : 0)}>
                              {s.present_count}/{s.total_students}
                              <span className="text-gray-400 font-normal ml-1">({s.total_students > 0 ? Math.round(s.present_count / s.total_students * 100) : 0}%)</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold">
                            {s.avg_exam_score != null ? <span className={attColor(s.avg_exam_score)}>{s.avg_exam_score}%</span> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {s.teacher_rating != null
                              ? <span className="flex items-center gap-1 text-amber-600 font-semibold no-print"><Star className="h-3 w-3 fill-amber-500 stroke-amber-500" />{s.teacher_rating}</span>
                              : <span className="text-gray-400">—</span>}
                            <span className="hidden print-show">{s.teacher_rating != null ? `★ ${s.teacher_rating}` : '—'}</span>
                          </td>
                        </TRow>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td className="px-3 py-2 text-xs text-gray-700" colSpan={4}>
                          Total — {report.sessions.length} sessions
                        </td>
                        <td className="px-3 py-2 text-xs text-sky-700 font-bold">{fmtDuration(report.overallStats.totalClassTimeMin)}</td>
                        <td className="px-3 py-2 text-xs font-semibold">
                          <span className={attColor(report.overallStats.avgAttendanceRate)}>{report.overallStats.avgAttendanceRate}% avg</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold">
                          {report.overallStats.avgExamScore != null
                            ? <span className={attColor(report.overallStats.avgExamScore)}>{report.overallStats.avgExamScore}% avg</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </TableWrapper>
                </div>
              </div>

              {/* ── Student Performance (with AI monitoring) ──────────────── */}
              <div className="print-break">
                <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2 no-print">
                  <Users className="h-4 w-4 text-emerald-600" /> Student Performance
                  <span className="text-xs font-normal text-gray-400">
                    {report.overallStats.avgExamScore != null ? '· Grade = 60% exam + 40% attendance' : '· Grade = attendance only'}
                  </span>
                </h3>
                <div className="hidden print-section-title">2. Student Performance &amp; AI Monitoring</div>

                {/* Legend — screen only */}
                <div className="flex flex-wrap items-center gap-4 mb-2 text-[10px] text-gray-500 no-print">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Writing Notes</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Tab Switches</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Phone Detected</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Distracted</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Inactive</span>
                </div>

                {sortedStudents.length === 0 ? (
                  <EmptyState icon={Users} message="No active students found for this batch." />
                ) : (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <TableWrapper>
                      <THead>
                        <TH>
                          <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-emerald-700 no-print">
                            Student {sortKey === 'name' && (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                          </button>
                          <span className="hidden print-show">Student</span>
                        </TH>
                        <TH>
                          <button onClick={() => handleSort('attendance')} className="flex items-center gap-1 hover:text-emerald-700 no-print">
                            Attend. {sortKey === 'attendance' && (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                          </button>
                          <span className="hidden print-show">Attend.</span>
                        </TH>
                        <TH>Attn%</TH>
                        <TH className="text-sky-700">Writing</TH>
                        <TH className="text-amber-700">Tab Sw.</TH>
                        <TH className="text-red-600">Phone</TH>
                        <TH className="text-orange-600">Distract.</TH>
                        <TH className="text-gray-600">Inactive</TH>
                        <TH>
                          <button onClick={() => handleSort('exam')} className="flex items-center gap-1 hover:text-emerald-700 no-print">
                            Exam {sortKey === 'exam' && (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                          </button>
                          <span className="hidden print-show">Exam</span>
                        </TH>
                        <TH>
                          <button onClick={() => handleSort('grade')} className="flex items-center gap-1 hover:text-emerald-700 no-print">
                            Grade {sortKey === 'grade' && (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                          </button>
                          <span className="hidden print-show">Grade</span>
                        </TH>
                        <TH className="no-print">Exams</TH>
                      </THead>
                      <tbody>
                        {sortedStudents.map(st => (
                          <React.Fragment key={st.email}>
                            <TRow>
                              {/* Student */}
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2 no-print">
                                  <Avatar name={st.name} size="sm" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-800">{st.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{st.email}</p>
                                  </div>
                                </div>
                                <div className="hidden print-show">
                                  <div style={{fontWeight:'600'}}>{st.name}</div>
                                  <div style={{fontSize:'7pt', color:'#666'}}>{st.grade} · {st.board}</div>
                                </div>
                              </td>
                              {/* Attendance */}
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 no-print">
                                  <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${attColorBg(st.attendance.rate)}`} style={{ width: `${Math.min(st.attendance.rate, 100)}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold ${attColor(st.attendance.rate)}`}>{st.attendance.rate}%</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5 no-print">{st.attendance.present}P {st.attendance.late > 0 ? `${st.attendance.late}L ` : ''}{st.attendance.absent}A</p>
                                <span className="hidden print-show" style={{fontSize:'8pt'}}>{st.attendance.rate}% ({st.attendance.present}P/{st.attendance.absent}A)</span>
                              </td>
                              {/* Attention */}
                              <td className="px-3 py-2 text-xs font-semibold">
                                {st.avgAttention != null ? <span className={attColor(st.avgAttention)}>{st.avgAttention}%</span> : <span className="text-gray-400">—</span>}
                              </td>
                              {/* Writing Notes */}
                              <td className="px-3 py-2">
                                {st.monitoring ? (
                                  <div>
                                    <span className="text-sky-700 font-semibold text-xs">{st.monitoring.writingNotesCount}×</span>
                                    <span className="text-gray-400 text-[10px] ml-1">{fmtSec(st.monitoring.writingNotesSec)}</span>
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              {/* Tab Switches */}
                              <td className="px-3 py-2">
                                {st.monitoring ? (
                                  <div>
                                    <span className={`font-semibold text-xs ${st.monitoring.tabSwitchCount >= 5 ? 'text-red-600' : st.monitoring.tabSwitchCount >= 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                                      {st.monitoring.tabSwitchCount}×
                                    </span>
                                    {st.monitoring.tabSwitchedSec > 0 && <span className="text-gray-400 text-[10px] ml-1">{fmtSec(st.monitoring.tabSwitchedSec)}</span>}
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              {/* Phone */}
                              <td className="px-3 py-2">
                                <MonBar label="Phone" sec={st.monitoring?.phoneDetectedSec ?? 0} color="text-red-500" warn />
                              </td>
                              {/* Distracted */}
                              <td className="px-3 py-2">
                                <MonBar label="Dist." sec={st.monitoring?.distractedSec ?? 0} color="text-orange-500" warn />
                              </td>
                              {/* Inactive */}
                              <td className="px-3 py-2">
                                <MonBar label="Inact." sec={st.monitoring?.inactiveSec ?? 0} color="text-gray-500" warn />
                              </td>
                              {/* Avg Exam */}
                              <td className="px-3 py-2 text-xs font-bold">
                                {st.avgExamScore != null ? <span className={attColor(st.avgExamScore)}>{st.avgExamScore}%</span> : <span className="text-gray-400">—</span>}
                              </td>
                              {/* Overall Grade */}
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold no-print ${gradeColor(st.overallGrade)}`}>{st.overallGrade || '—'}</span>
                                <span className="hidden print-show print-grade">{st.overallGrade || '—'}</span>
                              </td>
                              {/* Expand — screen only */}
                              <td className="px-3 py-2 no-print">
                                <div className="flex items-center gap-2">
                                  {st.exams.length > 0 ? (
                                    <button onClick={() => setExpandedStudent(expandedStudent === st.email ? null : st.email)}
                                      className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900">
                                      {st.exams.length} exam{st.exams.length !== 1 ? 's' : ''}
                                      {expandedStudent === st.email ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>
                                  ) : <span className="text-xs text-gray-400">—</span>}
                                  <button
                                    onClick={() => setStudentReport(st)}
                                    title="Generate individual student report"
                                    className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                                  >
                                    <Printer className="h-3 w-3" />
                                    Report
                                  </button>
                                </div>
                              </td>
                            </TRow>

                            {/* Expanded detail row — screen + print */}
                            {expandedStudent === st.email && (
                              <tr className="bg-gray-50 no-print">
                                <td colSpan={11} className="px-5 py-3">
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* Exams */}
                                    {st.exams.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Exam Results</p>
                                        <div className="space-y-1">
                                          {st.exams.map((ex, i) => (
                                            <div key={i} className="flex items-center gap-3 text-xs">
                                              <span className="text-gray-600 flex-1 truncate">{ex.topic}</span>
                                              <span className="text-gray-700 font-medium">{ex.score}/{ex.total}</span>
                                              <span className={`font-bold ${attColor(ex.percentage)}`}>{ex.percentage.toFixed(1)}%</span>
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${gradeColor(ex.grade_letter)}`}>{ex.grade_letter}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Monitoring detail */}
                                    {st.monitoring && (
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">AI Monitoring Breakdown</p>
                                        <div className="space-y-1.5">
                                          {[
                                            { label: 'Engaged / Attentive',  val: fmtSec(st.monitoring.engagedSec),       cls: 'text-emerald-700' },
                                            { label: 'Writing Notes',        val: `${st.monitoring.writingNotesCount}× · ${fmtSec(st.monitoring.writingNotesSec)}`, cls: 'text-sky-700' },
                                            { label: 'Tab Switches',         val: `${st.monitoring.tabSwitchCount}× · ${fmtSec(st.monitoring.tabSwitchedSec)}`, cls: st.monitoring.tabSwitchCount >= 5 ? 'text-red-600' : 'text-amber-600' },
                                            { label: 'Phone Detected',       val: fmtSec(st.monitoring.phoneDetectedSec),  cls: 'text-red-600' },
                                            { label: 'Distracted',           val: fmtSec(st.monitoring.distractedSec),     cls: 'text-orange-600' },
                                            { label: 'Inactive / Away',      val: fmtSec(st.monitoring.inactiveSec),       cls: 'text-gray-600' },
                                            ...(st.monitoring.multipleFacesSec > 0 ? [{ label: 'Multiple Faces', val: fmtSec(st.monitoring.multipleFacesSec), cls: 'text-red-700' }] : []),
                                          ].map(({ label, val, cls }) => (
                                            <div key={label} className="flex items-center justify-between text-xs">
                                              <span className="text-gray-500">{label}</span>
                                              <span className={`font-semibold ${cls}`}>{val}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Print: exam + monitoring rows inline under student */}
                            {(st.exams.length > 0 || st.monitoring) && (
                              <tr className="hidden print-show" style={{fontSize:'7.5pt'}}>
                                <td colSpan={11} style={{paddingLeft:'18pt', paddingRight:'6pt', paddingTop:'2pt', paddingBottom:'3pt', borderTop:'none', background:'#fafafa'}}>
                                  <div style={{display:'flex', gap:'24pt'}}>
                                    {st.exams.length > 0 && (
                                      <div style={{flex:1}}>
                                        <div style={{fontWeight:'bold', marginBottom:'2pt'}}>Exams:</div>
                                        {st.exams.map((ex, i) => (
                                          <div key={i}>{ex.topic} — {ex.score}/{ex.total} ({ex.percentage.toFixed(0)}%) [{ex.grade_letter}]</div>
                                        ))}
                                      </div>
                                    )}
                                    {st.monitoring && (
                                      <div style={{flex:1}}>
                                        <div style={{fontWeight:'bold', marginBottom:'2pt'}}>AI Monitoring:</div>
                                        <div>Engaged: {fmtSec(st.monitoring.engagedSec)} &nbsp;|&nbsp; Writing: {st.monitoring.writingNotesCount}× {fmtSec(st.monitoring.writingNotesSec)}</div>
                                        <div>Tab switches: {st.monitoring.tabSwitchCount}× ({fmtSec(st.monitoring.tabSwitchedSec)}) &nbsp;|&nbsp; Phone: {fmtSec(st.monitoring.phoneDetectedSec)}</div>
                                        <div>Distracted: {fmtSec(st.monitoring.distractedSec)} &nbsp;|&nbsp; Inactive: {fmtSec(st.monitoring.inactiveSec)}</div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </TableWrapper>
                  </div>
                )}
              </div>

              {/* ── At-risk students ──────────────────────────────────────── */}
              {(() => {
                const atRisk = sortedStudents.filter(s =>
                  s.attendance.rate < 50 ||
                  (s.avgExamScore != null && s.avgExamScore < 40) ||
                  (s.monitoring && (s.monitoring.tabSwitchCount >= 5 || s.monitoring.phoneDetectedSec >= 120))
                );
                if (atRisk.length === 0) return null;
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-2 mb-3 no-print">
                      <AlertTriangle className="h-4 w-4" />
                      {atRisk.length} student{atRisk.length !== 1 ? 's' : ''} need attention
                    </p>
                    <div className="hidden print-section-title" style={{borderColor:'#c07800', color:'#c07800'}}>3. Students Needing Attention</div>
                    <div className="overflow-hidden rounded-lg border border-amber-200 no-print">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-amber-100">
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Student</th>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Attend.</th>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Exam</th>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Tab Sw.</th>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Phone</th>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Flags</th>
                        </tr></thead>
                        <tbody>
                          {atRisk.map(s => (
                            <tr key={s.email} className="border-t border-amber-200 bg-white">
                              <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                              <td className={`px-3 py-2 font-semibold ${attColor(s.attendance.rate)}`}>{s.attendance.rate}%</td>
                              <td className={`px-3 py-2 font-semibold ${s.avgExamScore != null ? attColor(s.avgExamScore) : 'text-gray-400'}`}>
                                {s.avgExamScore != null ? `${s.avgExamScore}%` : '—'}
                              </td>
                              <td className={`px-3 py-2 font-semibold ${s.monitoring && s.monitoring.tabSwitchCount >= 5 ? 'text-red-600' : 'text-amber-600'}`}>
                                {s.monitoring ? `${s.monitoring.tabSwitchCount}×` : '—'}
                              </td>
                              <td className={`px-3 py-2 font-semibold ${s.monitoring && s.monitoring.phoneDetectedSec >= 120 ? 'text-red-600' : 'text-gray-500'}`}>
                                {s.monitoring ? fmtSec(s.monitoring.phoneDetectedSec) : '—'}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {s.attendance.rate < 50 && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Low Attendance</span>}
                                  {s.avgExamScore != null && s.avgExamScore < 40 && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Low Exam</span>}
                                  {s.monitoring && s.monitoring.tabSwitchCount >= 5 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Tab Abuse</span>}
                                  {s.monitoring && s.monitoring.phoneDetectedSec >= 120 && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Phone Use</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Print version of at-risk */}
                    <div className="hidden print-show">
                      <table>
                        <thead><tr><th>Student</th><th>Attendance</th><th>Exam</th><th>Tab Switches</th><th>Phone Detected</th><th>Flags</th></tr></thead>
                        <tbody>
                          {atRisk.map(s => (
                            <tr key={s.email} className="at-risk-row">
                              <td>{s.name}</td>
                              <td>{s.attendance.rate}%</td>
                              <td>{s.avgExamScore != null ? `${s.avgExamScore}%` : '—'}</td>
                              <td>{s.monitoring ? `${s.monitoring.tabSwitchCount}×` : '—'}</td>
                              <td>{s.monitoring ? fmtSec(s.monitoring.phoneDetectedSec) : '—'}</td>
                              <td>
                                {s.attendance.rate < 50 ? 'Low Attendance ' : ''}
                                {s.avgExamScore != null && s.avgExamScore < 40 ? 'Low Exam ' : ''}
                                {s.monitoring && s.monitoring.tabSwitchCount >= 5 ? 'Tab Abuse ' : ''}
                                {s.monitoring && s.monitoring.phoneDetectedSec >= 120 ? 'Phone Use' : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>{/* /printable */}
          </div>
        )}
      </Modal>

      {/* ── Individual Student Report Overlay ─────────────────────────────── */}
      {studentReport && report && (
        <IndividualStudentReport
          student={studentReport}
          batch={report.batch}
          sessions={report.sessions}
          dateRange={report.overallStats.dateRange}
          onClose={() => setStudentReport(null)}
        />
      )}
    </>
  );
}

// ─── Individual Student Report ────────────────────────────────────────────────

function IndividualStudentReport({
  student,
  batch,
  sessions,
  dateRange,
  onClose,
}: {
  student: StudentReportRow;
  batch: BatchReportData['batch'];
  sessions: SessionSummary[];
  dateRange: { from: string; to: string };
  onClose: () => void;
}) {
  const platformName = usePlatformName();
  // Map sessions for quick join
  const sessionMap = useMemo(() =>
    Object.fromEntries(sessions.map(s => [s.session_id, s])),
  [sessions]);

  const atRisk =
    student.attendance.rate < 50 ||
    (student.avgExamScore != null && student.avgExamScore < 40) ||
    (student.monitoring != null && (
      student.monitoring.tabSwitchCount >= 5 ||
      student.monitoring.phoneDetectedSec >= 120
    ));

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── PDF download via popup window (avoids fixed-overlay clipping) ─────────
  const handleDownloadStudentPDF = () => {
    const el = document.getElementById('student-report-print');
    if (!el) return;

    const pageStyles = Array.from(
      document.head.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')
    ).map(n => n.outerHTML).join('\n');

    const popup = window.open('', '_blank', 'width=900,height=800,scrollbars=yes');
    if (!popup) { window.print(); return; }

    const title = `${student.name} — ${batch.batch_name} Student Report`;
    popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${pageStyles}
  <style>
    body { background: white !important; padding: 24px; font-family: Arial, sans-serif; }
    .sr-no-print { display: none !important; }
    .overflow-hidden, .overflow-auto, .overflow-y-auto { overflow: visible !important; }
    @page { margin: 12mm; size: A4 portrait; }
    @media print {
      body { padding: 0; }
      table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10pt; }
      th, td { border: 1px solid #999; padding: 3pt 5pt; vertical-align: top; }
      thead tr { background: #e8e8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      tfoot tr { background: #f0f0f0 !important; print-color-adjust: exact; font-weight: bold; }
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
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 portrait; }
          body * { visibility: hidden !important; }
          #student-report-print, #student-report-print * { visibility: visible !important; }
          #student-report-print {
            position: fixed !important; inset: 0 !important;
            background: white !important; overflow: visible !important;
            font-family: Arial, sans-serif !important; font-size: 9pt !important;
            color: #111 !important; padding: 0 !important;
          }
          .sr-no-print { display: none !important; }
          #student-report-print table {
            width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 10pt;
          }
          #student-report-print th, #student-report-print td {
            border: 1px solid #999; padding: 3pt 5pt; vertical-align: top;
          }
          #student-report-print thead tr { background: #e8e8e8 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .sr-section-title { font-size: 10pt; font-weight: bold; margin: 8pt 0 4pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
          .sr-grade-badge { display: inline-block; border: 1px solid #999; padding: 0 4pt; font-weight: bold; }
          .sr-flag { display: inline-block; border: 1px solid #c07800; background: #fff8e1; padding: 1pt 4pt; margin-right: 3pt; font-size: 7.5pt; }
        }
      `}</style>

      <div className="fixed inset-0 z-[60] bg-gray-950/80 backdrop-blur-sm flex flex-col">
        {/* Toolbar — screen only */}
        <div className="sr-no-print flex items-center justify-between bg-white border-b border-gray-200 px-5 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={student.name} size="md" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{student.name}</p>
              <p className="text-xs text-gray-400">{student.email} · Grade {student.grade} · {student.board}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadStudentPDF}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
            >
              <Printer className="h-4 w-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>

        {/* Scrollable report body */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div id="student-report-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-3xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
              <div>
                <p className="text-lg font-bold text-gray-900">{student.name}</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {batch.batch_name} &nbsp;·&nbsp; Grade {batch.grade} &nbsp;·&nbsp; {batch.board}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{student.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Individual Student Report</p>
                <p className="text-xs text-gray-400 mt-1">
                  {fmtDate(dateRange.from)} – {fmtDate(dateRange.to)}
                </p>
                <p className="text-xs text-gray-400">Generated {generatedDate}</p>
              </div>
            </div>

            {/* KPI Summary */}
            <div className="sr-section-title">Performance Summary</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Attendance',
                  value: `${student.attendance.rate}%`,
                  sub: `${student.attendance.present}P / ${student.attendance.absent}A${student.attendance.late > 0 ? ` / ${student.attendance.late}L` : ''}`,
                  color: student.attendance.rate >= 75 ? 'border-emerald-200 bg-emerald-50' : student.attendance.rate >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50',
                  textColor: student.attendance.rate >= 75 ? 'text-emerald-700' : student.attendance.rate >= 50 ? 'text-amber-700' : 'text-red-700',
                },
                {
                  label: 'Avg Exam Score',
                  value: student.avgExamScore != null ? `${student.avgExamScore}%` : '—',
                  sub: `${student.exams.length} exam${student.exams.length !== 1 ? 's' : ''} taken`,
                  color: student.avgExamScore == null ? 'border-gray-200 bg-gray-50' : student.avgExamScore >= 75 ? 'border-emerald-200 bg-emerald-50' : student.avgExamScore >= 50 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50',
                  textColor: student.avgExamScore == null ? 'text-gray-500' : student.avgExamScore >= 75 ? 'text-emerald-700' : student.avgExamScore >= 50 ? 'text-amber-700' : 'text-red-700',
                },
                {
                  label: 'Overall Grade',
                  value: student.overallGrade || '—',
                  sub: student.avgExamScore != null ? '60% exam + 40% att.' : 'Attendance based',
                  color: 'border-purple-200 bg-purple-50',
                  textColor: 'text-purple-700',
                },
                {
                  label: 'Avg Attention',
                  value: student.avgAttention != null ? `${student.avgAttention}%` : '—',
                  sub: 'AI monitored',
                  color: 'border-sky-200 bg-sky-50',
                  textColor: 'text-sky-700',
                },
              ].map(({ label, value, sub, color, textColor }) => (
                <div key={label} className={`rounded-xl border p-3 ${color}`}>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Sessions attended & exam breakdown */}
            <div>
              <div className="sr-section-title">Session &amp; Exam Breakdown</div>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Subject</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Topic</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Teacher</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Duration</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Exam Score</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const exam = student.exams.find(e => e.session_id === s.session_id);
                      return (
                        <tr key={s.session_id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                            {fmtDate(s.scheduled_date)}<br />
                            <span className="text-gray-400">{fmtTime12(s.start_time)}</span>
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{s.subject}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 max-w-[110px] truncate">{s.topic || '—'}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{s.teacher_name}</td>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{s.actual_duration_min} min</td>
                          <td className="px-3 py-2 text-xs font-semibold">
                            {exam
                              ? <span className={attColor(exam.percentage)}>{exam.score}/{exam.total} ({exam.percentage.toFixed(0)}%)</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {exam
                              ? <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${gradeColor(exam.grade_letter)} sr-grade-badge`}>{exam.grade_letter}</span>
                              : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                      <td className="px-3 py-2 text-xs text-gray-700" colSpan={5}>
                        Total — {sessions.length} session{sessions.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                        Attended {student.attendance.present}/{student.attendance.total} ({student.attendance.rate}%)
                      </td>
                      <td className="px-3 py-2 text-xs font-bold">
                        {student.avgExamScore != null
                          ? <span className={attColor(student.avgExamScore)}>{student.avgExamScore}% avg</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${gradeColor(student.overallGrade)} sr-grade-badge`}>
                          {student.overallGrade || '—'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* AI Monitoring */}
            {student.monitoring && (
              <div>
                <div className="sr-section-title">AI Monitoring Breakdown</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Engaged / Attentive', val: fmtSec(student.monitoring.engagedSec), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                    { label: 'Writing Notes', val: `${student.monitoring.writingNotesCount}× · ${fmtSec(student.monitoring.writingNotesSec)}`, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
                    { label: 'Tab Switches', val: `${student.monitoring.tabSwitchCount}× · ${fmtSec(student.monitoring.tabSwitchedSec)}`, color: student.monitoring.tabSwitchCount >= 5 ? 'text-red-700' : 'text-amber-700', bg: student.monitoring.tabSwitchCount >= 5 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200' },
                    { label: 'Phone Detected', val: fmtSec(student.monitoring.phoneDetectedSec), color: student.monitoring.phoneDetectedSec >= 120 ? 'text-red-700' : 'text-orange-700', bg: student.monitoring.phoneDetectedSec >= 120 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200' },
                    { label: 'Distracted', val: fmtSec(student.monitoring.distractedSec), color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                    { label: 'Inactive / Away', val: fmtSec(student.monitoring.inactiveSec), color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
                    ...(student.monitoring.multipleFacesSec > 0
                      ? [{ label: 'Multiple Faces', val: fmtSec(student.monitoring.multipleFacesSec), color: 'text-red-700', bg: 'bg-red-50 border-red-200' }]
                      : []),
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className={`rounded-lg border p-2.5 ${bg}`}>
                      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${color}`}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* At-risk flags */}
            {atRisk && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Attention Required
                </p>
                <div className="flex flex-wrap gap-2">
                  {student.attendance.rate < 50 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md sr-flag">Low Attendance ({student.attendance.rate}%)</span>
                  )}
                  {student.avgExamScore != null && student.avgExamScore < 40 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md sr-flag">Low Exam Score ({student.avgExamScore}%)</span>
                  )}
                  {student.monitoring && student.monitoring.tabSwitchCount >= 5 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md sr-flag">Excessive Tab Switching ({student.monitoring.tabSwitchCount}×)</span>
                  )}
                  {student.monitoring && student.monitoring.phoneDetectedSec >= 120 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md sr-flag">Phone Usage ({fmtSec(student.monitoring.phoneDetectedSec)})</span>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between text-[10px] text-gray-400">
              <span>{batch.batch_name} &nbsp;·&nbsp; {batch.board}</span>
              <span>Generated by {platformName} Portal &nbsp;·&nbsp; {generatedDate}</span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
