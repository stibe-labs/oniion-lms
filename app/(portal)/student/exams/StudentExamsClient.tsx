// ═══════════════════════════════════════════════════════════════
// Student Exams — Client Component
// Lists available exams, results, and links to take exam
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, BookOpen, User, FileText, Clock, Trophy, AlertCircle,
  CheckCircle2, XCircle, RefreshCw, GraduationCap, ArrowRight,
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  scheduled_at: string | null;
  ends_at: string | null;
  attempt_status: string | null;
  attempt_score: number | null;
  attempt_percentage: number | null;
  attempt_grade: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-400', A: 'text-green-400',
  'B+': 'text-blue-400', B: 'text-blue-400',
  'C+': 'text-yellow-400', C: 'text-yellow-400',
  D: 'text-orange-400', F: 'text-red-400',
};

export default function StudentExamsClient({ userName, userEmail, userRole }: Props) {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'completed'>('available');



  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/exams?role=student');
      const json = await res.json();
      if (json.success) setExams(json.data.exams || []);
    } catch (e) { console.error('Failed to load exams', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const available = exams.filter(e => !e.attempt_status || e.attempt_status === 'in_progress');
  const completed = exams.filter(e => e.attempt_status === 'graded' || e.attempt_status === 'submitted');

  const currentList = tab === 'available' ? available : completed;

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-violet-400" /> My Exams
            </h1>
            <p className="text-sm text-muted-foreground mt-1">View and take your assigned exams</p>
          </div>
          <button onClick={fetchExams} disabled={loading}
            className="flex items-center gap-1 rounded border border-border bg-muted px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {[
            { key: 'available' as const, label: 'Available', count: available.length },
            { key: 'completed' as const, label: 'Completed', count: completed.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition
                ${tab === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Exam Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">No {tab} exams</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentList.map(exam => (
              <div key={exam.id} className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{exam.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{exam.subject} · Grade {exam.grade}</p>
                  </div>
                  {exam.attempt_status === 'graded' && (
                    <span className={`text-xl font-bold ${GRADE_COLORS[exam.attempt_grade || ''] || 'text-gray-400'}`}>
                      {exam.attempt_grade}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.duration_minutes}m</span>
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {exam.total_marks} marks</span>
                  <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Pass: {exam.passing_marks}</span>
                </div>

                {exam.scheduled_at && (
                  <p className="text-xs text-gray-500 mb-3">
                    Scheduled: {new Date(exam.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                )}

                {exam.attempt_status === 'graded' ? (
                  <div className="mt-auto">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <div>
                        <p className="text-xs text-gray-400">Score</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {exam.attempt_score}/{exam.total_marks}
                          <span className="text-gray-400 ml-1">({exam.attempt_percentage}%)</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {Number(exam.attempt_percentage) >= (exam.passing_marks / exam.total_marks * 100)
                          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                          : <XCircle className="h-5 w-5 text-red-500" />
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <button
                      onClick={() => router.push(`/student/exams/${exam.id}`)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
                      {exam.attempt_status === 'in_progress' ? 'Continue Exam' : 'Start Exam'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
