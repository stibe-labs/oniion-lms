// ═══════════════════════════════════════════════════════════════
// Exams Management — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  SearchInput, FilterSelect, FormPanel, FormField, FormGrid, FormActions,
  Input, Select, Modal,
  TableWrapper, THead, TH, TRow,
  DetailPanel, DetailHeader, InfoCard,
  StatCard, StatCardSmall,
  LoadingState, EmptyState, Badge, Alert,
  useToast,
} from '@/components/dashboard/shared';
import {
  BookOpen, Plus, Search, Calendar, Clock, CheckCircle, XCircle,
  X, GraduationCap, FileText, PenTool, Laptop,
  BarChart, Award, AlertCircle, Hash, Percent,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  exam_type: string;
  duration_minutes: number;
  passing_marks: number;
  total_marks: number;
  scheduled_at: string | null;
  ends_at: string | null;
  published: boolean;
  results_published: boolean;
  created_by: string;
  created_at: string;
  question_count?: number;
  attempt_count?: number;
  avg_score?: number;
}

interface ExamDetail {
  exam: Exam;
  questions: Question[];
  attempts?: Attempt[];
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  difficulty: string | null;
  topic: string | null;
  sort_order: number;
}

interface Attempt {
  id: string;
  student_email: string;
  student_name: string;
  status: string;
  score: number | null;
  total_marks: number;
  percentage: number | null;
  grade_letter: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Social Science', 'Languages'];
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));

// ── Local badges (exam-specific, not generic enough for shared) ──

function ExamTypeBadge({ type }: { type: string }) {
  return type === 'online' ? (
    <Badge icon={Laptop} label="Online MCQ" variant="info" />
  ) : (
    <Badge icon={PenTool} label="Offline" variant="warning" />
  );
}

function StatusChip({ published, resultsPublished }: { published: boolean; resultsPublished: boolean }) {
  if (resultsPublished) return <Badge icon={Award} label="Results Out" variant="success" />;
  if (published) return <Badge icon={CheckCircle} label="Published" variant="primary" />;
  return <Badge icon={Clock} label="Draft" variant="default" />;
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-gray-400">—</span>;
  const variantMap: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
    A: 'success', B: 'info', C: 'warning', D: 'warning', F: 'danger',
  };
  return <Badge label={grade} variant={variantMap[grade] || 'default'} />;
}

// ── Main Component ───────────────────────────────────────────

export default function ExamsClient({ userName, userEmail, userRole }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Detail
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'questions' | 'results'>('questions');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('Mathematics');
  const [formGrade, setFormGrade] = useState('10');
  const [formType, setFormType] = useState<'online' | 'offline'>('online');
  const [formDuration, setFormDuration] = useState('60');
  const [formTotalMarks, setFormTotalMarks] = useState('100');
  const [formPassingMarks, setFormPassingMarks] = useState('35');
  const [formSchedule, setFormSchedule] = useState('');

  const toast = useToast();

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/exams');
      const json = await res.json();
      if (json.success) setExams(json.data?.exams || []);
    } catch (e) { console.error('Failed to fetch exams:', e); }
    setLoading(false);
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const [examRes, resultsRes] = await Promise.all([
        fetch(`/api/v1/exams/${id}`),
        fetch(`/api/v1/exams/${id}?action=results`),
      ]);
      const examJson = await examRes.json();
      const resultsJson = await resultsRes.json();
      if (examJson.success) {
        setDetail({
          exam: examJson.data?.exam || examJson.data,
          questions: examJson.data?.questions || [],
          attempts: resultsJson.data?.attempts || [],
        });
      }
    } catch (e) { console.error('Failed to fetch detail:', e); }
    setDetailLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);
  useEffect(() => {
    if (selectedExam) { fetchDetail(selectedExam); setDetailTab('questions'); }
    else setDetail(null);
  }, [selectedExam, fetchDetail]);

  const createExam = async () => {
    if (!formTitle.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: formTitle,
        subject: formSubject,
        grade: formGrade,
        exam_type: formType,
        duration_minutes: parseInt(formDuration) || 60,
        total_marks: parseInt(formTotalMarks) || 100,
        passing_marks: parseInt(formPassingMarks) || 35,
      };
      if (formSchedule) body.scheduled_at = formSchedule;
      const res = await fetch('/api/v1/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setFormTitle('');
        toast.success('Exam created successfully');
        fetchExams();
      } else {
        toast.error(json.error || 'Failed to create exam');
      }
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const publishExam = async (id: string, field: 'published' | 'results_published') => {
    try {
      const res = await fetch(`/api/v1/exams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(field === 'published' ? 'Exam published' : 'Results released');
        fetchExams();
        if (selectedExam === id) fetchDetail(id);
      } else {
        toast.error(json.error || 'Failed to update');
      }
    } catch (e) { console.error(e); }
  };

  const filtered = exams.filter((e) => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.subject.toLowerCase().includes(search.toLowerCase());
    const matchSubject = subjectFilter === 'all' || e.subject === subjectFilter;
    const matchType = typeFilter === 'all' || e.exam_type === typeFilter;
    return matchSearch && matchSubject && matchType;
  });

  const stats = {
    total: exams.length,
    online: exams.filter((e) => e.exam_type === 'online').length,
    offline: exams.filter((e) => e.exam_type === 'offline').length,
    published: exams.filter((e) => e.published).length,
    draft: exams.filter((e) => !e.published).length,
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* ── Header ── */}
        <PageHeader icon={BookOpen} title="Exam Management"
          subtitle={`${stats.total} exams · ${stats.online} online · ${stats.offline} offline · ${stats.published} published`}>
          <RefreshButton loading={loading} onClick={fetchExams} />
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>New Exam</Button>
        </PageHeader>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCardSmall icon={FileText} label="Total Exams" value={stats.total} variant="default" />
          <StatCardSmall icon={Laptop} label="Online MCQ" value={stats.online} variant="info" />
          <StatCardSmall icon={PenTool} label="Offline" value={stats.offline} variant="warning" />
          <StatCardSmall icon={CheckCircle} label="Published" value={stats.published} variant="success" />
          <StatCardSmall icon={Clock} label="Drafts" value={stats.draft} variant="default" />
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search exams by title or subject…" />
          <FilterSelect
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={[{ value: 'all', label: 'All Subjects' }, ...SUBJECTS.map((s) => ({ value: s, label: s }))]}
          />
          <FilterSelect
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as typeof typeFilter)}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'online', label: 'Online MCQ' },
              { value: 'offline', label: 'Offline' },
            ]}
          />
        </div>

        {/* ── Create form (modal) ── */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Exam" maxWidth="lg">
          <FormGrid cols={3}>
            <FormField label="Exam Title" required className="sm:col-span-3">
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Physics Unit Test — Grade 10 — February 2026" />
            </FormField>
            <FormField label="Subject">
              <Select value={formSubject} onChange={setFormSubject} options={SUBJECTS.map((s) => ({ value: s, label: s }))} />
            </FormField>
            <FormField label="Grade">
              <Select value={formGrade} onChange={setFormGrade} options={GRADES.map((g) => ({ value: g, label: `Grade ${g}` }))} />
            </FormField>
            <FormField label="Type">
              <Select value={formType} onChange={(v) => setFormType(v as 'online' | 'offline')} options={[
                { value: 'online', label: 'Online MCQ' },
                { value: 'offline', label: 'Offline Descriptive' },
              ]} />
            </FormField>
            <FormField label="Duration (min)">
              <Input type="number" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} />
            </FormField>
            <FormField label="Total Marks">
              <Input type="number" value={formTotalMarks} onChange={(e) => setFormTotalMarks(e.target.value)} />
            </FormField>
            <FormField label="Passing Marks">
              <Input type="number" value={formPassingMarks} onChange={(e) => setFormPassingMarks(e.target.value)} />
            </FormField>
            <FormField label="Scheduled At">
              <Input type="datetime-local" value={formSchedule} onChange={(e) => setFormSchedule(e.target.value)} />
            </FormField>
          </FormGrid>
          <FormActions onCancel={() => setShowCreate(false)} onSubmit={createExam} submitLabel="Create Exam" submitDisabled={!formTitle.trim()} submitting={creating} />
        </Modal>

        {/* ── Exams table ── */}
        {loading && exams.length === 0 ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState icon={BookOpen} message="No exams found" />
        ) : (
          <TableWrapper footer={<span>Showing {filtered.length} of {exams.length} exams</span>}>
            <THead>
              <TH>Exam</TH>
              <TH>Subject</TH>
              <TH>Grade</TH>
              <TH>Type</TH>
              <TH>Marks</TH>
              <TH>Duration</TH>
              <TH>Schedule</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody>
              {filtered.map((exam) => (
                <TRow
                  key={exam.id}
                  selected={selectedExam === exam.id}
                  onClick={() => setSelectedExam(selectedExam === exam.id ? null : exam.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-52">{exam.title}</p>
                    {exam.question_count !== undefined && (
                      <p className="text-xs text-gray-400">{exam.question_count} questions · {exam.attempt_count || 0} attempts</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{exam.subject}</td>
                  <td className="px-4 py-3 text-gray-700">{exam.grade}</td>
                  <td className="px-4 py-3"><ExamTypeBadge type={exam.exam_type} /></td>
                  <td className="px-4 py-3 text-gray-700">{exam.total_marks} <span className="text-gray-400 text-xs">(pass: {exam.passing_marks})</span></td>
                  <td className="px-4 py-3 text-gray-600">{exam.duration_minutes}m</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {exam.scheduled_at ? new Date(exam.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusChip published={exam.published} resultsPublished={exam.results_published} /></td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {!exam.published && (
                        <Button variant="primary" size="xs" onClick={() => publishExam(exam.id, 'published')}>Publish</Button>
                      )}
                      {exam.published && !exam.results_published && (
                        <Button variant="outline" size="xs" onClick={() => publishExam(exam.id, 'results_published')}>Release Results</Button>
                      )}
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </TableWrapper>
        )}

        {/* ── Detail panel ── */}
        {selectedExam && (
          <DetailPanel loading={detailLoading} emptyMessage="Could not load exam details">
            {detail && (
              <>
                <DetailHeader title={detail.exam.title} onClose={() => setSelectedExam(null)}>
                  <ExamTypeBadge type={detail.exam.exam_type} />
                  <StatusChip published={detail.exam.published} resultsPublished={detail.exam.results_published} />
                  <span className="text-xs text-gray-400">{detail.exam.subject} · Grade {detail.exam.grade}</span>
                </DetailHeader>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <InfoCard label="Total Marks">
                    <p className="text-lg font-bold text-gray-900">{detail.exam.total_marks}</p>
                  </InfoCard>
                  <InfoCard label="Passing">
                    <p className="text-lg font-bold text-gray-900">{detail.exam.passing_marks}</p>
                  </InfoCard>
                  <InfoCard label="Questions">
                    <p className="text-lg font-bold text-gray-900">{detail.questions.length}</p>
                  </InfoCard>
                  <InfoCard label="Attempts">
                    <p className="text-lg font-bold text-gray-900">{detail.attempts?.length || 0}</p>
                  </InfoCard>
                </div>

                {/* Section selector */}
                <FilterSelect
                  value={detailTab}
                  onChange={(k) => setDetailTab(k as typeof detailTab)}
                  options={[{ value: 'questions', label: `Questions (${detail.questions.length})` }, { value: 'results', label: `Results (${detail.attempts?.length || 0})` }]}
                />

                {/* Questions tab */}
                {detailTab === 'questions' && (
                  <div className="space-y-3">
                    {detail.questions.length === 0 ? (
                      <EmptyState message="No questions added yet" />
                    ) : detail.questions.map((q, i) => (
                      <div key={q.id} className="rounded-lg border border-gray-100 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">
                              <span className="text-gray-400 mr-2">Q{i + 1}.</span>{q.question_text}
                            </p>
                            {q.options && (
                              <div className="mt-2 grid grid-cols-2 gap-1.5">
                                {(q.options as string[]).map((opt, oi) => (
                                  <span key={oi} className={`text-xs rounded px-2 py-1 ${opt === q.correct_answer ? 'bg-primary/5 text-primary font-medium' : 'bg-gray-50 text-gray-600'}`}>
                                    {String.fromCharCode(65 + oi)}. {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 text-right shrink-0">
                            <span className="text-xs text-gray-400">{q.marks} marks</span>
                            {q.difficulty && <p className="text-xs text-gray-400">{q.difficulty}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Results tab */}
                {detailTab === 'results' && (
                  <div>
                    {!detail.attempts || detail.attempts.length === 0 ? (
                      <EmptyState message="No attempts yet" />
                    ) : (
                      <TableWrapper>
                        <THead>
                          <TH>Student</TH>
                          <TH>Email</TH>
                          <TH>Status</TH>
                          <TH className="text-right">Score</TH>
                          <TH className="text-right">%</TH>
                          <TH className="text-center">Grade</TH>
                        </THead>
                        <tbody>
                          {detail.attempts.map((a) => (
                            <TRow key={a.id}>
                              <td className="px-3 py-2 font-medium text-gray-800">{a.student_name}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{a.student_email}</td>
                              <td className="px-3 py-2">
                                <Badge
                                  label={a.status}
                                  variant={a.status === 'graded' ? 'success' : a.status === 'submitted' ? 'info' : 'warning'}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800">{a.score ?? '—'} / {a.total_marks}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{a.percentage != null ? `${a.percentage.toFixed(1)}%` : '—'}</td>
                              <td className="px-3 py-2 text-center"><GradeBadge grade={a.grade_letter} /></td>
                            </TRow>
                          ))}
                        </tbody>
                      </TableWrapper>
                    )}
                  </div>
                )}
              </>
            )}
          </DetailPanel>
        )}
      </div>
    </DashboardShell>
  );
}
