// ═══════════════════════════════════════════════════════════════
// StudentReportsBrowser — Batch → Student picker + report view
// For admin roles: Teacher, BC, AO, Owner
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card, LoadingState, EmptyState, SearchInput,
} from '@/components/dashboard/shared';
import {
  BookOpen, Users, ChevronRight, ArrowLeft, BarChart2,
} from 'lucide-react';
import StudentReportsTab from '@/components/dashboard/StudentReportsTab';

interface Batch {
  batch_id: string;
  batch_name: string;
  grade: string;
  subjects: string[];
  student_count?: number;
}

interface Student {
  student_email: string;
  student_name: string;
  student_status: string;
  parent_email?: string;
}

interface Props {
  /** API to fetch batches. Default: /api/v1/batches */
  batchesApi?: string;
}

export default function StudentReportsBrowser({ batchesApi = '/api/v1/batches' }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch(batchesApi);
      const json = await res.json();
      const list = json.data?.batches || json.batches || json.data || [];
      setBatches(Array.isArray(list) ? list : []);
    } catch { /* ignore */ }
    setLoadingBatches(false);
  }, [batchesApi]);

  const fetchStudents = useCallback(async (batchId: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/v1/batches/${encodeURIComponent(batchId)}`);
      const json = await res.json();
      const list = json.data?.students || [];
      setStudents(Array.isArray(list) ? list : []);
    } catch { /* ignore */ }
    setLoadingStudents(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const selectBatch = (b: Batch) => {
    setSelectedBatch(b);
    setSelectedStudent(null);
    setSearch('');
    fetchStudents(b.batch_id);
  };

  const goBack = () => {
    if (selectedStudent) {
      setSelectedStudent(null);
    } else if (selectedBatch) {
      setSelectedBatch(null);
      setStudents([]);
    }
  };

  // ── Viewing a student's report ──
  if (selectedStudent && selectedBatch) {
    return (
      <div className="space-y-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-emerald-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to students
        </button>
        <StudentReportsTab
          studentEmail={selectedStudent.student_email}
          batchId={selectedBatch.batch_id}
          showStudentHeader
        />
      </div>
    );
  }

  // ── Viewing students in a batch ──
  if (selectedBatch) {
    const filtered = students.filter(s =>
      s.student_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_email.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="space-y-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-emerald-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to batches
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedBatch.batch_name}</p>
            <p className="text-xs text-gray-500">Grade {selectedBatch.grade} · Select a student to view reports</p>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student…" />
        </div>

        {loadingStudents ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState icon={Users} message="No students found in this batch." />
        ) : (
          <div className="grid gap-2">
            {filtered.map(s => (
              <button
                key={s.student_email}
                onClick={() => setSelectedStudent(s)}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/50 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 font-bold text-sm">{s.student_name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.student_name}</p>
                    <p className="text-xs text-gray-500">{s.student_email}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Batch list ──
  if (loadingBatches) return <LoadingState />;
  if (batches.length === 0) return <EmptyState icon={BookOpen} message="No batches found." />;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-700">Select a batch to view student reports</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {batches.map(b => (
          <button
            key={b.batch_id}
            onClick={() => selectBatch(b)}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/50 transition text-left"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{b.batch_name}</p>
              <p className="text-xs text-gray-500">
                Grade {b.grade} · {b.subjects?.join(', ') || 'No subjects'}
                {b.student_count !== undefined && ` · ${b.student_count} students`}
              </p>
            </div>
            <BarChart2 className="w-5 h-5 text-emerald-500" />
          </button>
        ))}
      </div>
    </div>
  );
}
