'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────── */

interface GradedAnswer {
  question_text: string;
  options: string[];
  correct_answer: number;
  selected_option: number | null;
  is_correct: boolean;
  marks: number;
  marks_awarded: number;
  topic: string;
}

interface ExamResult {
  id: string;
  topic_id: string;
  session_id: string;
  room_id: string;
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
  answers: GradedAnswer[];
  tab_switch_count?: number;
  auto_submitted?: boolean;
  violations?: { type: string; timestamp: number; detail?: string }[];
  completed_at: string;
}

export interface ExamTopic {
  id: string;
  title: string;
  subject: string;
  grade: string;
  question_count: number;
  generated_questions?: number;
  status: string;
  category?: string;
  chapter_name?: string;
  topic_name?: string;
}

export interface StudentInfo {
  identity: string;
  name: string;
}

interface SessionExamStudentTelemetry {
  sent_at?: number;
  reached_at?: number;
  started_at?: number;
  completed_at?: number;
  waiting_camera?: boolean;
  can_start?: boolean;
  student_name?: string;
  updated_at: number;
}

interface Props {
  roomId: string;
  sessionId?: string;
  className?: string;
  // Exam sending
  students: StudentInfo[];
  examTopics: ExamTopic[];
  selectedTopicId: string;
  onSelectTopic: (id: string) => void;
  onSendExam: (studentIdentities: string[]) => Promise<void>;
  examSent: boolean;
  lastSentTopicId?: string;
  telemetryByTopic?: Record<string, Record<string, SessionExamStudentTelemetry>>;
  isLive: boolean;
}

/* ── Icons ─────────────────────────────────────────── */

function IcCheck({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="12 5 6.5 11 4 8.5" /></svg>);
}
function IcX({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg>);
}
function IcMinus({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="4" y1="8" x2="12" y2="8" /></svg>);
}
function IcChevron({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 4 10 8 6 12" /></svg>);
}
function IcAlert({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5L1.5 13h13L8 1.5z" /><line x1="8" y1="6" x2="8" y2="9" /><line x1="8" y1="11" x2="8.01" y2="11" /></svg>);
}
function IcRefresh({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 2v4h4" /><path d="M14.5 14v-4h-4" /><path d="M2.3 10.3A6 6 0 0 0 13.7 5.7" /><path d="M13.7 5.7A6 6 0 0 0 2.3 10.3" /></svg>);
}
function IcSend({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 1.5l-6 13-2.5-5.5L.5 6.5z" /><path d="M14.5 1.5L6 9" /></svg>);
}

/* ── Component ─────────────────────────────────────── */

export default function ExamResultsPanel({
  roomId, sessionId, className,
  students, examTopics, selectedTopicId, onSelectTopic, onSendExam, examSent, lastSentTopicId, telemetryByTopic, isLive,
}: Props) {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  // Student selection for send/resend
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roomId) params.set('room_id', roomId);
      if (sessionId) params.set('session_id', sessionId);
      const res = await fetch(`/api/v1/session-exam/results?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setResults(json.data || []);
        setError(null);
      } else {
        setError(json.error || 'Unknown error');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, [roomId, sessionId]);

  useEffect(() => {
    fetchResults();
    const iv = setInterval(fetchResults, 15_000);
    return () => clearInterval(iv);
  }, [fetchResults]);

  useEffect(() => {
    setSelectedStudents(new Set());
  }, [selectedTopicId]);

  // ── Derived data ──
  const selectedTopicResults = useMemo(
    () => selectedTopicId ? results.filter(r => String(r.topic_id) === String(selectedTopicId)) : results,
    [results, selectedTopicId],
  );
  const completedEmails = useMemo(() => new Set(selectedTopicResults.map(r => r.student_email)), [selectedTopicResults]);
  const readyTopics = useMemo(() => examTopics.filter(t => t.status === 'ready'), [examTopics]);
  const telemetryForSelectedTopic = useMemo(
    () => (selectedTopicId && telemetryByTopic?.[selectedTopicId]) || {},
    [selectedTopicId, telemetryByTopic],
  );
  const isNewTopicSend = useMemo(
    () => Boolean(selectedTopicId && lastSentTopicId && selectedTopicId !== lastSentTopicId),
    [selectedTopicId, lastSentTopicId],
  );

  // Students who haven't completed (for resend)
  const pendingStudents = useMemo(() =>
    students.filter(s => !completedEmails.has(s.identity)),
    [students, completedEmails]
  );
  const completedCount = completedEmails.size;
  const reachedCount = students.filter(s => Boolean(telemetryForSelectedTopic[s.identity]?.reached_at)).length;
  const startedCount = students.filter(s => Boolean(telemetryForSelectedTopic[s.identity]?.started_at)).length;
  const waitingCameraCount = students.filter(s => Boolean(telemetryForSelectedTopic[s.identity]?.waiting_camera)).length;

  const toggleStudent = (identity: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(identity)) next.delete(identity);
      else next.add(identity);
      return next;
    });
  };

  const toggleAll = (list: StudentInfo[]) => {
    const allSelected = list.every(s => selectedStudents.has(s.identity));
    if (allSelected) {
      setSelectedStudents(prev => {
        const next = new Set(prev);
        list.forEach(s => next.delete(s.identity));
        return next;
      });
    } else {
      setSelectedStudents(prev => {
        const next = new Set(prev);
        list.forEach(s => next.add(s.identity));
        return next;
      });
    }
  };

  const handleSend = async () => {
    if (selectedStudents.size === 0 || !selectedTopicId) return;
    setSending(true);
    try {
      await onSendExam(Array.from(selectedStudents));
      setSelectedStudents(new Set());
    } catch { /* handled by parent */ }
    setSending(false);
  };

  // ── Helpers ──
  const gradeColor = (pct: number) =>
    pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-teal-400' : pct >= 35 ? 'text-amber-400' : 'text-red-400';
  const gradeBg = (pct: number) =>
    pct >= 75 ? 'bg-emerald-900/30' : pct >= 50 ? 'bg-teal-900/30' : pct >= 35 ? 'bg-amber-900/30' : 'bg-red-900/30';
  const fmtTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const fmtAt = (ts?: number) => ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

  // Group by topic (or selected topic only)
  const topicGroups = selectedTopicResults.reduce((acc, r) => {
    const key = r.topic_id || r.topic_title;
    if (!acc[key]) acc[key] = { title: r.topic_title, subject: r.subject, results: [] };
    acc[key].results.push(r);
    return acc;
  }, {} as Record<string, { title: string; subject: string; results: ExamResult[] }>);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-6', className)}>
        <div className="text-center">
          <div className="h-5 w-5 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[10px] text-[#9aa0a6]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══ SECTION 1: Send / Resend Exam ═══ */}
        {isLive && readyTopics.length > 0 && (
          <div className="border-b border-[#3c4043] p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <IcSend className="h-3 w-3 text-[#8ab4f8]" />
              <span className="text-[10px] font-semibold text-[#8ab4f8] uppercase tracking-wider">
                {examSent ? (isNewTopicSend ? 'Send New Topic Exam' : 'Resend Exam') : 'Send Exam'}
              </span>
            </div>

            {/* Topic selector */}
            <select
              value={selectedTopicId}
              onChange={e => onSelectTopic(e.target.value)}
              className="w-full bg-[#3c4043] text-[#e8eaed] text-[10px] rounded px-2 py-1.5 outline-none border border-[#3c4043] focus:border-[#8ab4f8] transition-colors"
            >
              <option value="">Select exam topic…</option>
              {readyTopics.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({t.question_count}Q)</option>
              ))}
            </select>

            {/* Student selection */}
            {selectedTopicId && (() => {
              const targetList = students;
              if (targetList.length === 0) return (
                <p className="text-[9px] text-[#9aa0a6] italic py-1">
                  No students in the room
                </p>
              );
              const allSelected = targetList.every(s => selectedStudents.has(s.identity));
              return (
                <div className="space-y-1">
                  {/* Select all toggle */}
                  <button
                    onClick={() => toggleAll(targetList)}
                    className="flex items-center gap-1.5 text-[9px] text-[#9aa0a6] hover:text-[#e8eaed] transition-colors w-full"
                  >
                    <span className={cn(
                      'flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors',
                      allSelected ? 'bg-[#8ab4f8] border-[#8ab4f8]' : 'border-[#9aa0a6]/50'
                    )}>
                      {allSelected && <IcCheck className="h-2.5 w-2.5 text-[#202124]" />}
                    </span>
                    {allSelected ? 'Deselect all' : `Select all (${targetList.length})`}
                  </button>

                  {/* Student checkboxes */}
                  <div className="max-h-[120px] overflow-y-auto space-y-0.5 scrollbar-thin">
                    {targetList.map(s => {
                      const checked = selectedStudents.has(s.identity);
                      const completed = completedEmails.has(s.identity);
                      return (
                        <button
                          key={s.identity}
                          onClick={() => toggleStudent(s.identity)}
                          className={cn(
                            'flex items-center gap-1.5 w-full rounded px-1.5 py-1 text-left transition-colors',
                            checked ? 'bg-[#8ab4f8]/10' : 'hover:bg-[#3c4043]/50'
                          )}
                        >
                          <span className={cn(
                            'flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors shrink-0',
                            checked ? 'bg-[#8ab4f8] border-[#8ab4f8]' : 'border-[#9aa0a6]/50'
                          )}>
                            {checked && <IcCheck className="h-2.5 w-2.5 text-[#202124]" />}
                          </span>
                          <span className="text-[10px] text-[#e8eaed] truncate flex-1">{s.name}</span>
                          {completed && (
                            <span className="text-[8px] text-emerald-400 bg-emerald-900/30 px-1 py-0.5 rounded shrink-0">Done</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleSend}
                    disabled={selectedStudents.size === 0 || !selectedTopicId || sending}
                    className={cn(
                      'w-full flex items-center justify-center gap-1.5 rounded py-1.5 text-[10px] font-semibold transition-all',
                      selectedStudents.size > 0 && selectedTopicId
                        ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                        : 'bg-[#3c4043] text-[#9aa0a6] cursor-not-allowed'
                    )}
                  >
                    {sending ? (
                      <div className="h-3 w-3 border-2 border-[#202124] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <IcSend className="h-3 w-3" />
                    )}
                    {(examSent && !isNewTopicSend) ? 'Resend' : 'Send'} to {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''}
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ SECTION 2: Student Exam Lifecycle Tracker ═══ */}
        {selectedTopicId && (
          <div className="border-b border-[#3c4043] px-2.5 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#8ab4f8] uppercase tracking-wider">Exam Tracker</span>
              <span className="text-[9px] text-[#9aa0a6]">Reached {reachedCount}/{students.length} · Started {startedCount}/{students.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[9px]">
              <div className="rounded bg-[#3c4043]/50 px-1.5 py-1 text-center text-[#9aa0a6]">Sent {students.filter(s => telemetryForSelectedTopic[s.identity]?.sent_at).length}</div>
              <div className="rounded bg-[#3c4043]/50 px-1.5 py-1 text-center text-[#9aa0a6]">Reached {reachedCount}</div>
              <div className="rounded bg-[#3c4043]/50 px-1.5 py-1 text-center text-[#9aa0a6]">Started {startedCount}</div>
              <div className="rounded bg-[#3c4043]/50 px-1.5 py-1 text-center text-[#9aa0a6]">Done {completedCount}</div>
            </div>
            {waitingCameraCount > 0 && (
              <p className="text-[9px] text-amber-400">{waitingCameraCount} student{waitingCameraCount !== 1 ? 's are' : ' is'} waiting for camera to start.</p>
            )}
            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-0.5">
              {students.map((s) => {
                const t = telemetryForSelectedTopic[s.identity];
                const result = selectedTopicResults.find(r => r.student_email === s.identity);
                const fullscreenExits = result?.violations?.filter(v => v.type === 'fullscreen_exit').length || 0;
                return (
                  <div key={s.identity} className="rounded bg-[#292a2d] border border-[#3c4043]/70 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[#e8eaed] truncate">{s.name}</span>
                      <div className="flex items-center gap-1">
                        {result ? <span className="text-[8px] bg-emerald-900/40 text-emerald-300 px-1 py-0.5 rounded">Completed</span> : null}
                        {t?.started_at && !result ? <span className="text-[8px] bg-teal-900/40 text-teal-300 px-1 py-0.5 rounded">In Exam</span> : null}
                        {t?.waiting_camera ? <span className="text-[8px] bg-amber-900/40 text-amber-300 px-1 py-0.5 rounded">Camera Needed</span> : null}
                        {!t?.reached_at && !result ? <span className="text-[8px] bg-[#3c4043] text-[#9aa0a6] px-1 py-0.5 rounded">Not Reached</span> : null}
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] text-[#9aa0a6]">
                      <span>Sent: {fmtAt(t?.sent_at)}</span>
                      <span>Reached: {fmtAt(t?.reached_at)}</span>
                      <span>Started: {fmtAt(t?.started_at)}</span>
                      <span>Done: {result?.completed_at ? new Date(result.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : fmtAt(t?.completed_at)}</span>
                      <span>Can Start: {t?.can_start ? 'Yes' : t?.can_start === false ? 'No' : '—'}</span>
                      <span>Fullscreen exits: {fullscreenExits}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ SECTION 3: Pending Status ═══ */}
        {examSent && !isNewTopicSend && pendingStudents.length > 0 && (
          <div className="border-b border-[#3c4043] px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                <div className="h-1.5 w-1.5 bg-amber-400 rounded-full animate-pulse" />
                Waiting ({pendingStudents.length} pending)
              </span>
              <span className="text-[9px] text-[#9aa0a6]">
                {completedCount}/{students.length} done
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {pendingStudents.map(s => (
                <span key={s.identity} className="text-[9px] bg-amber-900/20 text-amber-400/80 px-1.5 py-0.5 rounded">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 4: Results ═══ */}
        {selectedTopicResults.length > 0 ? (
          <div className="p-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span className="text-[10px] font-semibold text-[#8ab4f8] uppercase tracking-wider">Results</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#9aa0a6]">{selectedTopicResults.length} submission{selectedTopicResults.length !== 1 ? 's' : ''}</span>
                <button onClick={fetchResults} className="text-[#9aa0a6] hover:text-[#e8eaed] transition-colors">
                  <IcRefresh className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {Object.entries(topicGroups).map(([key, group]) => {
              const avg = group.results.length ? Math.round(group.results.reduce((s, r) => s + (Number(r.percentage) || 0), 0) / group.results.length) : 0;
              const topCorrect = Math.max(...group.results.map(r => r.score));

              return (
                <div key={key} className="rounded-lg bg-[#292a2d] overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#3c4043]">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#e8eaed] truncate">{group.title}</p>
                        <p className="text-[9px] text-[#9aa0a6]">{group.subject} · {group.results.length} student{group.results.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-center">
                          <p className={cn('text-sm font-bold', gradeColor(avg))}>{avg}%</p>
                          <p className="text-[8px] text-[#9aa0a6]">Avg</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-emerald-400">{topCorrect}</p>
                          <p className="text-[8px] text-[#9aa0a6]">Top</p>
                        </div>
                      </div>
                    </div>
                  </div>
                {/* ── Stats Summary ── */}
                {(() => {
                  const rs = group.results;
                  const best = rs.reduce((a, b) => Number(b.percentage) > Number(a.percentage) ? b : a, rs[0]);
                  const worst = rs.reduce((a, b) => Number(b.percentage) < Number(a.percentage) ? b : a, rs[0]);
                  const passCount = rs.filter(r => (Number(r.percentage) || 0) >= 35).length;
                  const avgTime = rs.length ? Math.round(rs.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / rs.length) : 0;
                  const gradeMap: Record<string, number> = {};
                  rs.forEach(r => { gradeMap[r.grade_letter] = (gradeMap[r.grade_letter] || 0) + 1; });
                  const GRADE_ORDER = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'];
                  const gradeColors: Record<string, string> = {
                    'A+': 'bg-emerald-900/50 text-emerald-300', 'A': 'bg-emerald-900/30 text-emerald-400',
                    'B+': 'bg-teal-900/50 text-teal-300', 'B': 'bg-teal-900/30 text-teal-400',
                    'C': 'bg-amber-900/40 text-amber-300', 'D': 'bg-orange-900/40 text-orange-300',
                    'F': 'bg-red-900/40 text-red-300',
                  };
                  const sortedGrades = GRADE_ORDER.filter(g => gradeMap[g]);
                  const questionMissCounts: Record<string, number> = {};
                  rs.forEach(r => r.answers.forEach((a, i) => { if (!a.is_correct) questionMissCounts[i] = (questionMissCounts[i] || 0) + 1; }));
                  const mostMissedEntry = Object.entries(questionMissCounts).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <div className="px-3 py-2 bg-[#202124]/60 border-b border-[#3c4043] space-y-2">
                      {/* Quick stats */}
                      <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                        <div className="rounded bg-[#3c4043]/60 px-1.5 py-1.5 text-center">
                          <p className="text-[#9aa0a6]">Pass Rate</p>
                          <p className={cn('font-bold text-[12px]', rs.length && passCount / rs.length >= 0.6 ? 'text-emerald-400' : 'text-amber-400')}>
                            {rs.length ? Math.round(passCount / rs.length * 100) : 0}%
                          </p>
                          <p className="text-[#9aa0a6] text-[8px]">{passCount}/{rs.length}</p>
                        </div>
                        <div className="rounded bg-[#3c4043]/60 px-1.5 py-1.5 text-center">
                          <p className="text-[#9aa0a6]">Avg Time</p>
                          <p className="font-bold text-[12px] text-[#8ab4f8]">{fmtTime(avgTime)}</p>
                        </div>
                        <div className="rounded bg-[#3c4043]/60 px-1.5 py-1.5 text-center">
                          <p className="text-[#9aa0a6]">Hardest Q</p>
                          <p className="font-bold text-[12px] text-amber-400">
                            {mostMissedEntry ? `Q${Number(mostMissedEntry[0]) + 1}` : '—'}
                          </p>
                          <p className="text-[#9aa0a6] text-[8px]">{mostMissedEntry ? `missed ${mostMissedEntry[1]}×` : ''}</p>
                        </div>
                      </div>
                      {/* Grade distribution */}
                      <div className="space-y-1">
                        <p className="text-[8px] text-[#9aa0a6] uppercase tracking-wider font-medium">Grade Distribution</p>
                        <div className="flex flex-wrap gap-1">
                          {sortedGrades.map(g => (
                            <span key={g} className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded', gradeColors[g] || 'bg-[#3c4043] text-[#9aa0a6]')}>
                              {g} = {gradeMap[g]}
                            </span>
                          ))}
                          {sortedGrades.length === 0 && <span className="text-[9px] text-[#9aa0a6] italic">No grades yet</span>}
                        </div>
                      </div>
                      {/* Best performer */}
                      <div className="rounded bg-[#8ab4f8]/8 border border-[#8ab4f8]/20 px-2 py-1.5 flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 text-yellow-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] text-[#9aa0a6]">Best Performer</p>
                          <p className="text-[10px] font-semibold text-[#e8eaed] truncate">{best.student_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-[11px] font-bold', gradeColor(best.percentage))}>{best.score}/{best.total_marks}</p>
                          <p className={cn('text-[9px] font-medium', gradeColor(best.percentage))}>{best.grade_letter} · {best.percentage}%</p>
                        </div>
                      </div>
                      {/* Lowest performer (only when > 1 student) */}
                      {rs.length > 1 && worst.student_email !== best.student_email && (
                        <div className="rounded bg-[#3c4043]/40 border border-[#3c4043] px-2 py-1.5 flex items-center gap-2">
                          <svg className="h-3.5 w-3.5 text-[#9aa0a6] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] text-[#9aa0a6]">Needs Support</p>
                            <p className="text-[10px] font-medium text-[#e8eaed]/80 truncate">{worst.student_name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn('text-[11px] font-bold', gradeColor(worst.percentage))}>{worst.score}/{worst.total_marks}</p>
                            <p className={cn('text-[9px]', gradeColor(worst.percentage))}>{worst.grade_letter} · {worst.percentage}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                  <div className="divide-y divide-[#3c4043]/60">
                    {group.results
                      .sort((a, b) => b.percentage - a.percentage)
                      .map((r) => {
                      const isExpanded = expandedStudent === r.id;
                      const correctCount = r.answers.filter(a => a.is_correct).length;
                      const wrongCount = r.answers.filter(a => a.selected_option !== null && !a.is_correct).length;

                      return (
                        <div key={r.id}>
                          <button
                            onClick={() => setExpandedStudent(isExpanded ? null : r.id)}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#3c4043]/40 transition-colors text-left"
                          >
                            <IcChevron className={cn('h-3 w-3 text-[#9aa0a6] shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-[#e8eaed] truncate">{r.student_name}</p>
                              <div className="flex items-center gap-2 text-[9px] text-[#9aa0a6]">
                                <span className="flex items-center gap-0.5"><IcCheck className="h-2.5 w-2.5 text-emerald-400" />{correctCount}</span>
                                <span className="flex items-center gap-0.5"><IcX className="h-2.5 w-2.5 text-red-400" />{wrongCount}</span>
                                <span className="flex items-center gap-0.5"><IcMinus className="h-2.5 w-2.5 text-[#9aa0a6]" />{r.skipped}</span>
                                <span>{fmtTime(r.time_taken_seconds)}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={cn('text-sm font-bold', gradeColor(r.percentage))}>
                                {r.score}/{r.total_marks}
                              </p>
                              <div className="flex items-center gap-1 justify-end">
                                <span className={cn('text-[9px] font-semibold px-1 py-0.5 rounded', gradeBg(r.percentage), gradeColor(r.percentage))}>
                                  {r.grade_letter}
                                </span>
                                <span className={cn('text-[9px]', gradeColor(r.percentage))}>{r.percentage}%</span>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-2 space-y-1.5">
                              {(r.auto_submitted || (r.tab_switch_count ?? 0) > 0) && (
                                <div className={cn(
                                  'flex items-center gap-1.5 rounded px-2 py-1 text-[9px]',
                                  r.auto_submitted ? 'bg-red-900/30 text-red-400' : 'bg-amber-900/30 text-amber-400'
                                )}>
                                  <IcAlert className="h-3 w-3 shrink-0" />
                                  {r.auto_submitted
                                    ? `Auto-submitted — ${r.tab_switch_count ?? 0} tab switches`
                                    : `${r.tab_switch_count} tab switch${(r.tab_switch_count ?? 0) > 1 ? 'es' : ''} detected`
                                  }
                                </div>
                              )}

                              {r.answers.map((a, qIdx) => {
                                const qKey = `${r.id}-${qIdx}`;
                                const isQExp = expandedQuestion === qKey;
                                return (
                                  <div key={qIdx} className={cn(
                                    'rounded overflow-hidden',
                                    a.selected_option === null ? 'bg-[#3c4043]/40'
                                      : a.is_correct ? 'bg-emerald-900/15' : 'bg-red-900/15'
                                  )}>
                                    <button
                                      onClick={() => setExpandedQuestion(isQExp ? null : qKey)}
                                      className="w-full px-2 py-1.5 flex items-center gap-1.5 text-left"
                                    >
                                      <span className={cn(
                                        'flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold shrink-0',
                                        a.selected_option === null ? 'bg-[#3c4043] text-[#9aa0a6]'
                                          : a.is_correct ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'
                                      )}>{qIdx + 1}</span>
                                      <span className="flex-1 text-[10px] text-[#e8eaed]/80 truncate">{a.question_text}</span>
                                      {a.selected_option === null ? (
                                        <IcMinus className="h-3 w-3 text-[#9aa0a6] shrink-0" />
                                      ) : a.is_correct ? (
                                        <IcCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                                      ) : (
                                        <IcX className="h-3 w-3 text-red-400 shrink-0" />
                                      )}
                                    </button>
                                    {isQExp && (
                                      <div className="px-2 pb-2 space-y-1">
                                        <p className="text-[10px] text-[#e8eaed]/90 leading-relaxed">{a.question_text}</p>
                                        {a.options.map((opt, oIdx) => {
                                          const isCorrect = oIdx === a.correct_answer;
                                          const isSelected = oIdx === a.selected_option;
                                          return (
                                            <div key={oIdx} className={cn(
                                              'flex items-center gap-1.5 rounded px-2 py-1 text-[10px]',
                                              isCorrect ? 'bg-emerald-900/30 text-emerald-300'
                                                : isSelected ? 'bg-red-900/30 text-red-300'
                                                : 'text-[#9aa0a6]'
                                            )}>
                                              <span className="font-bold text-[9px] w-3 shrink-0">{String.fromCharCode(65 + oIdx)}</span>
                                              <span className="flex-1">{opt}</span>
                                              {isCorrect && <IcCheck className="h-3 w-3 shrink-0" />}
                                              {isSelected && !isCorrect && <IcX className="h-3 w-3 shrink-0" />}
                                            </div>
                                          );
                                        })}
                                        {a.selected_option === null && (
                                          <p className="text-[9px] text-[#9aa0a6] italic">Not attempted (timed out)</p>
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
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !examSent ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="h-10 w-10 rounded-full bg-[#3c4043] flex items-center justify-center mb-3">
              <svg className="h-5 w-5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            {error ? (
              <>
                <p className="text-xs font-medium text-red-400 mb-1">Failed to load results</p>
                <p className="text-[10px] text-[#9aa0a6]">{error}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-[#e8eaed] mb-1">No Exam Results Yet</p>
                <p className="text-[10px] text-[#9aa0a6]">
                  {readyTopics.length > 0
                    ? 'Select a topic above and send the exam to students.'
                    : 'Generate exam questions first, then send to students.'}
                </p>
              </>
            )}
            <button onClick={fetchResults} className="mt-3 flex items-center gap-1 text-[10px] text-[#8ab4f8] hover:text-[#aecbfa]">
              <IcRefresh className="h-3 w-3" /> Refresh
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="h-8 w-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium text-teal-400 mb-1">Exam in Progress</p>
            <p className="text-[10px] text-[#9aa0a6]">Waiting for students to complete…</p>
            <button onClick={fetchResults} className="mt-3 flex items-center gap-1 text-[10px] text-[#8ab4f8] hover:text-[#aecbfa]">
              <IcRefresh className="h-3 w-3" /> Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
