'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────── */

interface Question {
  id: string;
  homework_id: string;
  question_number: number;
  question_text: string;
}

interface Assignment {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  assigned_by_name: string;
  status: string;
  created_at: string;
  questions: Question[];
  attachment_urls: string[];
  attachment_names: string[];
}

interface Submission {
  id: string;
  homework_id: string;
  student_email: string;
  student_name: string;
  submission_text: string | null;
  file_urls: string[];
  file_names: string[];
  completion_status: string;
  delay_days: number;
  submitted_at: string;
  grade: string | null;
  teacher_comment: string | null;
  graded_at: string | null;
}

interface Props {
  roomId: string;
  role: 'student' | 'teacher';
  participantEmail: string;
  participantName: string;
  className?: string;
}

/* ── SVG Icons ─────────────────────────────────────── */

function IcPlus({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>);
}
function IcX({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="m4 4 8 8M12 4 4 12" />
  </svg>);
}
function IcPaperclip({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 7.5 8 13a3.5 3.5 0 0 1-5-5l5.5-5.5a2.12 2.12 0 0 1 3 3L6 11a.71.71 0 0 1-1-1l4.5-4.5" />
  </svg>);
}
function IcSend({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="m14 2-6 12-2.5-5.5L0 6l14-4Z" /><path d="M14 2 5.5 8.5" />
  </svg>);
}
function IcEdit({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 2a1.41 1.41 0 0 1 2 0l1 1a1.41 1.41 0 0 1 0 2L5.5 13.5 2 14l.5-3.5Z" />
  </svg>);
}
function IcFile({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2Z" /><path d="M9 2v4h4" />
  </svg>);
}
function IcComment({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V4a1 1 0 0 1 1-1Z" />
  </svg>);
}
function IcDownload({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v9M4.5 7.5 8 11l3.5-3.5M3 13h10" />
  </svg>);
}

/* ── Helpers ───────────────────────────────────────── */

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return '—'; }
}

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  completed:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Completed' },
  partial:     { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Partial' },
  not_started: { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Not Started' },
};

/* ── Main Component ────────────────────────────────── */

export default function HomeworkPanel({ roomId, role, participantEmail, participantName, className }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Teacher: assign form state
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [assignDueTime, setAssignDueTime] = useState('');
  const [questions, setQuestions] = useState<{ text: string }[]>([{ text: '' }]);
  const [assigning, setAssigning] = useState(false);
  const [assignAttachments, setAssignAttachments] = useState<{ url: string; name: string }[]>([]);
  const [assignUploading, setAssignUploading] = useState(false);
  const assignFileRef = useRef<HTMLInputElement>(null);

  // Student: submit form state
  const [submitTarget, setSubmitTarget] = useState<string | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitStatus, setSubmitStatus] = useState<string>('completed');
  const [uploadedFiles, setUploadedFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitFormRef = useRef<HTMLDivElement>(null);

  // Teacher: grading
  const [gradeTarget, setGradeTarget] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState('');
  const [gradeComment, setGradeComment] = useState('');
  const [grading, setGrading] = useState(false);

  const fetchHomework = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/homework`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setAssignments(json.data.assignments || []);
        setSubmissions(json.data.submissions || []);
      }
    } catch {} finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { fetchHomework(); }, [fetchHomework]);
  useEffect(() => { const iv = setInterval(fetchHomework, 30_000); return () => clearInterval(iv); }, [fetchHomework]);

  // Auto-scroll to submit form on mobile when opened
  useEffect(() => {
    if (submitTarget && submitFormRef.current) {
      setTimeout(() => submitFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }, [submitTarget]);

  /* ── Teacher: Assign ──────────────────────────────── */

  const addQuestion = () => setQuestions(prev => [...prev, { text: '' }]);
  const removeQuestion = (idx: number) => setQuestions(prev => prev.filter((_, i) => i !== idx));
  const updateQuestion = (idx: number, text: string) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { text } : q));

  const handleAssignFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setAssignUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      const res = await fetch('/api/v1/homework/upload', { method: 'POST', credentials: 'include', body: formData });
      const json = await res.json();
      if (json.success) {
        setAssignAttachments(prev => [...prev, ...json.data]);
      } else {
        alert(json.error || 'Upload failed');
      }
    } catch { alert('Upload failed'); }
    finally { setAssignUploading(false); if (assignFileRef.current) assignFileRef.current.value = ''; }
  };

  const removeAssignAttachment = (idx: number) => setAssignAttachments(prev => prev.filter((_, i) => i !== idx));

  const handleAssign = async () => {
    if (!assignTitle.trim() || assigning) return;
    setAssigning(true);
    try {
      const validQuestions = questions
        .filter(q => q.text.trim())
        .map((q, i) => ({ question_number: i + 1, question_text: q.text.trim() }));

      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/homework`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'assign', title: assignTitle, description: assignDesc || undefined,
          due_date: assignDue || undefined, due_time: assignDueTime || undefined,
          questions: validQuestions.length > 0 ? validQuestions : undefined,
          attachment_urls: assignAttachments.map(f => f.url),
          attachment_names: assignAttachments.map(f => f.name),
        }),
      });
      if (res.ok) {
        setAssignTitle(''); setAssignDesc(''); setAssignDue(''); setAssignDueTime('');
        setQuestions([{ text: '' }]); setAssignAttachments([]); setShowAssignForm(false);
        fetchHomework();
      }
    } catch {} finally { setAssigning(false); }
  };

  /* ── Student: File Upload ─────────────────────────── */

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      const res = await fetch('/api/v1/homework/upload', { method: 'POST', credentials: 'include', body: formData });
      const json = await res.json();
      if (json.success) {
        setUploadedFiles(prev => [...prev, ...json.data]);
      } else {
        alert(json.error || 'Upload failed');
      }
    } catch { alert('Upload failed'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const removeFile = (idx: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));

  /* ── Student: Submit ──────────────────────────────── */

  const handleSubmit = async (homeworkId: string) => {
    if (submitting) return;
    if (!submitText.trim() && uploadedFiles.length === 0 && submitStatus === 'not_started') {
      // Allow "not started" status with no content
    } else if (!submitText.trim() && uploadedFiles.length === 0) {
      alert('Please add text or upload files'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/homework`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'submit', homework_id: homeworkId,
          submission_text: submitText || undefined,
          file_urls: uploadedFiles.map(f => f.url),
          file_names: uploadedFiles.map(f => f.name),
          completion_status: submitStatus,
        }),
      });
      if (res.ok) {
        setSubmitText(''); setSubmitTarget(null); setUploadedFiles([]); setSubmitStatus('completed');
        fetchHomework();
      }
    } catch {} finally { setSubmitting(false); }
  };

  /* ── Teacher: Grade ───────────────────────────────── */

  const handleGrade = async (submissionId: string) => {
    if (grading) return;
    setGrading(true);
    try {
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/homework`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'grade', submission_id: submissionId, grade: gradeValue, teacher_comment: gradeComment }),
      });
      if (res.ok) {
        setGradeTarget(null); setGradeValue(''); setGradeComment('');
        fetchHomework();
      }
    } catch {} finally { setGrading(false); }
  };

  const getSubmission = (hwId: string): Submission | undefined =>
    submissions.find(s => s.homework_id === hwId);

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className={cn('flex flex-col h-full bg-[#16181d] text-white', className)}>
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-white tracking-wide">Homework</h3>
        {role === 'teacher' && (
          <button onClick={() => setShowAssignForm(!showAssignForm)}
            className={cn('flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors',
              showAssignForm
                ? 'bg-white/[0.08] text-[#8b8fa3] hover:text-white'
                : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25')}>
            {showAssignForm ? <><IcX className="w-3 h-3" /> Cancel</> : <><IcPlus className="w-3 h-3" /> Assign</>}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-20 space-y-2.5">
        {/* ── Teacher Assign Form ────────────────────── */}
        {role === 'teacher' && showAssignForm && (
          <div className="rounded-lg bg-[#1c1f26] p-3 space-y-2 border border-blue-500/20">
            <input value={assignTitle} onChange={e => setAssignTitle(e.target.value)}
              placeholder="Homework title..."
              className="w-full bg-white/[0.06] text-white text-xs rounded-md px-2.5 py-1.5 outline-none border border-white/[0.06] placeholder:text-[#8b8fa3] focus:border-blue-500/40 transition-colors"
              maxLength={500} />
            <textarea value={assignDesc} onChange={e => setAssignDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full bg-white/[0.06] text-white text-xs rounded-md px-2.5 py-1.5 outline-none border border-white/[0.06] placeholder:text-[#8b8fa3] focus:border-blue-500/40 resize-none transition-colors"
              rows={2} maxLength={2000} />

            {/* Questions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8b8fa3] font-medium">Questions</span>
                <button onClick={addQuestion} className="flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  <IcPlus className="w-3 h-3" /> Add
                </button>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <span className="text-[10px] text-[#8b8fa3] mt-1.5 shrink-0 w-5 text-right">{i + 1}.</span>
                  <input value={q.text} onChange={e => updateQuestion(i, e.target.value)}
                    placeholder={`Question ${i + 1}...`}
                    className="flex-1 bg-white/[0.06] text-white text-xs rounded-md px-2.5 py-1.5 outline-none border border-white/[0.06] placeholder:text-[#8b8fa3] focus:border-blue-500/40 transition-colors"
                    maxLength={2000} />
                  {questions.length > 1 && (
                    <button onClick={() => removeQuestion(i)} className="mt-1 text-[#8b8fa3] hover:text-red-400 transition-colors">
                      <IcX className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Attachments */}
            <div>
              <input ref={assignFileRef} type="file" multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.mp4,.mp3"
                onChange={handleAssignFileUpload} className="hidden" />
              <button onClick={() => assignFileRef.current?.click()} disabled={assignUploading}
                className="flex items-center gap-1.5 text-[10px] bg-white/[0.06] text-blue-400 px-2.5 py-1 rounded-md border border-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 transition-colors">
                <IcPaperclip className="w-3 h-3" />
                {assignUploading ? 'Uploading...' : 'Attach Files'}
              </button>
              {assignAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {assignAttachments.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-white/80 px-2 py-0.5 rounded border border-blue-500/20">
                      <IcFile className="w-3 h-3 text-blue-400" /> {f.name}
                      <button onClick={() => removeAssignAttachment(i)} className="text-[#8b8fa3] hover:text-red-400 transition-colors">
                        <IcX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-[#8b8fa3]">Due:</label>
              <input type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)}
                className="bg-white/[0.06] text-white text-xs rounded-md px-2 py-1 outline-none border border-white/[0.06]" />
              <input type="time" value={assignDueTime} onChange={e => setAssignDueTime(e.target.value)}
                className="bg-white/[0.06] text-white text-xs rounded-md px-2 py-1 outline-none border border-white/[0.06]" />
            </div>

            <button onClick={handleAssign} disabled={!assignTitle.trim() || assigning}
              className="w-full bg-blue-500 text-white text-xs font-medium py-1.5 rounded-md hover:bg-blue-400 disabled:opacity-40 transition-colors">
              {assigning ? 'Assigning...' : 'Assign Homework'}
            </button>
          </div>
        )}

        {/* ── Assignments List ───────────────────────── */}
        {loading ? (
          <div className="text-xs text-[#8b8fa3] text-center py-8">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="text-xs text-[#8b8fa3] text-center py-8">No homework assigned</div>
        ) : (
          assignments.map((hw) => {
            const sub = role === 'student' ? getSubmission(hw.id) : undefined;
            const hwSubmissions = role === 'teacher' ? submissions.filter(s => s.homework_id === hw.id) : [];
            const isDue = hw.due_date && new Date(hw.due_date + 'T23:59:59+05:30') < new Date();

            return (
              <div key={hw.id} className="rounded-lg bg-[#1c1f26] border border-white/[0.06] overflow-hidden">
                <div className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">{hw.title}</div>
                      {hw.description && <div className="text-[10px] text-[#8b8fa3] mt-0.5 line-clamp-3">{hw.description}</div>}
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded border shrink-0 font-medium',
                      hw.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-white/[0.04] text-[#8b8fa3] border-white/[0.06]')}>
                      {hw.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-[#8b8fa3]">
                    <span>By: {hw.assigned_by_name}</span>
                    {hw.due_date && (
                      <span className={isDue ? 'text-red-400' : ''}>
                        Due: {fmtDate(hw.due_date)}{hw.due_time ? ` ${hw.due_time}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Attachments display */}
                  {hw.attachment_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {hw.attachment_names.map((name, i) => (
                        <a key={i} href={hw.attachment_urls[i]} target="_blank" rel="noreferrer" download
                          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors">
                          <IcDownload className="w-3 h-3" /> {name}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Questions display */}
                  {hw.questions.length > 0 && (
                    <div className="space-y-1 border-t border-white/[0.06] pt-2">
                      <span className="text-[10px] text-[#8b8fa3] font-medium">Questions:</span>
                      {hw.questions.map(q => (
                        <div key={q.id} className="flex gap-1.5 text-[10px]">
                          <span className="text-blue-400 shrink-0 font-medium">{q.question_number}.</span>
                          <span className="text-white/80">{q.question_text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Student submission area ────────── */}
                  {role === 'student' && (
                    <>
                      {sub ? (
                        <div className="rounded-md bg-white/[0.03] p-2.5 space-y-1.5 border-t border-white/[0.06]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded border font-medium',
                              STATUS_BADGE[sub.completion_status]?.bg || 'bg-white/[0.04]',
                              STATUS_BADGE[sub.completion_status]?.text || 'text-[#8b8fa3]',
                              STATUS_BADGE[sub.completion_status]?.border || 'border-white/[0.06]')}>
                              {STATUS_BADGE[sub.completion_status]?.label || sub.completion_status}
                            </span>
                            <span className="text-[10px] text-[#8b8fa3]">Submitted {fmtTime(sub.submitted_at)}</span>
                            {sub.delay_days > 0 && (
                              <span className="text-[10px] text-red-400 font-medium">({sub.delay_days}d late)</span>
                            )}
                          </div>
                          {sub.submission_text && <div className="text-[10px] text-white/80 line-clamp-3">{sub.submission_text}</div>}
                          {sub.file_urls?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {sub.file_names.map((name, i) => (
                                <a key={i} href={sub.file_urls[i]} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 transition-colors">
                                  <IcFile className="w-3 h-3" /> {name}
                                </a>
                              ))}
                            </div>
                          )}
                          {sub.grade && (
                            <div className="text-[10px] text-white/90">
                              Grade: <span className="font-bold text-emerald-400">{sub.grade}</span>
                            </div>
                          )}
                          {sub.teacher_comment && (
                            <div className="flex items-start gap-1.5 text-[10px] text-[#8b8fa3]">
                              <IcComment className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>{sub.teacher_comment}</span>
                            </div>
                          )}
                        </div>
                      ) : submitTarget === hw.id ? (
                        <div ref={submitFormRef} className="space-y-2 border-t border-white/[0.06] pt-2">
                          {/* Completion status */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#8b8fa3]">Status:</span>
                            {(['completed', 'partial', 'not_started'] as const).map(st => (
                              <button key={st} onClick={() => setSubmitStatus(st)}
                                className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors',
                                  submitStatus === st
                                    ? `${STATUS_BADGE[st].bg} ${STATUS_BADGE[st].text} ${STATUS_BADGE[st].border}`
                                    : 'bg-white/[0.04] text-[#8b8fa3] border-white/[0.06] hover:text-white')}>
                                {STATUS_BADGE[st].label}
                              </button>
                            ))}
                          </div>

                          {/* Text answer */}
                          <textarea value={submitText} onChange={e => setSubmitText(e.target.value)}
                            placeholder="Write your answer (optional if uploading files)..."
                            className="w-full bg-white/[0.06] text-white text-xs rounded-md px-2.5 py-2 outline-none border border-white/[0.06] placeholder:text-[#8b8fa3] focus:border-blue-500/40 resize-none transition-colors"
                            rows={3} maxLength={5000} />

                          {/* File upload */}
                          <div>
                            <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.mp4,.mp3"
                              onChange={handleFileUpload} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                              className="flex items-center gap-1.5 text-[10px] bg-white/[0.06] text-blue-400 px-2.5 py-1 rounded-md border border-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 transition-colors">
                              <IcPaperclip className="w-3 h-3" />
                              {uploading ? 'Uploading...' : 'Attach Files'}
                            </button>
                            {uploadedFiles.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {uploadedFiles.map((f, i) => (
                                  <span key={i} className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-white/80 px-2 py-0.5 rounded border border-blue-500/20">
                                    <IcFile className="w-3 h-3 text-blue-400" /> {f.name}
                                    <button onClick={() => removeFile(i)} className="text-[#8b8fa3] hover:text-red-400 transition-colors">
                                      <IcX className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Submit / Cancel */}
                          <div className="flex gap-1.5">
                            <button onClick={() => handleSubmit(hw.id)} disabled={submitting}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 text-white text-xs font-medium py-1.5 rounded-md hover:bg-blue-400 disabled:opacity-40 transition-colors">
                              <IcSend className="w-3 h-3" />
                              {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                            <button onClick={() => { setSubmitTarget(null); setSubmitText(''); setUploadedFiles([]); setSubmitStatus('completed'); }}
                              className="text-xs text-[#8b8fa3] hover:text-white px-2 transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : hw.status === 'active' ? (
                        <button onClick={() => setSubmitTarget(hw.id)}
                          className="w-full flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-blue-400 py-2 rounded-md border border-white/[0.06] transition-colors">
                          <IcSend className="w-3 h-3" /> Submit Homework
                        </button>
                      ) : null}
                    </>
                  )}

                  {/* ── Teacher submission review ──────── */}
                  {role === 'teacher' && (
                    <div className="border-t border-white/[0.06] pt-2">
                      <div className="text-[10px] text-[#8b8fa3] mb-1.5 font-medium">
                        {hwSubmissions.length} submission{hwSubmissions.length !== 1 ? 's' : ''}
                      </div>
                      {hwSubmissions.map(s => (
                        <div key={s.id} className="bg-white/[0.03] rounded-md p-2.5 mb-1.5 space-y-1.5 border border-white/[0.04]">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white font-medium">{s.student_name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border',
                                STATUS_BADGE[s.completion_status]?.bg || 'bg-white/[0.04]',
                                STATUS_BADGE[s.completion_status]?.text || 'text-[#8b8fa3]',
                                STATUS_BADGE[s.completion_status]?.border || 'border-white/[0.06]')}>
                                {STATUS_BADGE[s.completion_status]?.label || s.completion_status}
                              </span>
                              {s.delay_days > 0 && <span className="text-[10px] text-red-400 font-medium">{s.delay_days}d late</span>}
                              <span className={cn('text-[10px] font-medium', s.grade ? 'text-emerald-400' : 'text-amber-400')}>
                                {s.grade || 'Ungraded'}
                              </span>
                            </div>
                          </div>
                          {s.submission_text && <div className="text-[10px] text-[#8b8fa3] line-clamp-2">{s.submission_text}</div>}
                          {s.file_urls?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {s.file_names.map((name, i) => (
                                <a key={i} href={s.file_urls[i]} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 transition-colors">
                                  <IcFile className="w-3 h-3" /> {name}
                                </a>
                              ))}
                            </div>
                          )}
                          {/* Grade button */}
                          {gradeTarget === s.id ? (
                            <div className="flex gap-1.5 items-center mt-1">
                              <input value={gradeValue} onChange={e => setGradeValue(e.target.value)} placeholder="Grade"
                                className="w-16 bg-white/[0.06] text-white text-[10px] rounded-md px-1.5 py-1 outline-none border border-white/[0.06] focus:border-blue-500/40" maxLength={10} />
                              <input value={gradeComment} onChange={e => setGradeComment(e.target.value)} placeholder="Comment"
                                className="flex-1 bg-white/[0.06] text-white text-[10px] rounded-md px-1.5 py-1 outline-none border border-white/[0.06] focus:border-blue-500/40" maxLength={500} />
                              <button onClick={() => handleGrade(s.id)} disabled={grading}
                                className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded-md font-medium disabled:opacity-40 hover:bg-blue-400 transition-colors">
                                {grading ? '...' : 'Save'}
                              </button>
                              <button onClick={() => setGradeTarget(null)} className="text-[#8b8fa3] hover:text-white transition-colors">
                                <IcX className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setGradeTarget(s.id); setGradeValue(s.grade || ''); setGradeComment(s.teacher_comment || ''); }}
                              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-0.5 transition-colors">
                              <IcEdit className="w-3 h-3" />
                              {s.grade ? 'Edit Grade' : 'Grade'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
