'use client';

// ═══════════════════════════════════════════════════════════════
// AOManagementPanel — Owner-only panel in AO dashboard settings
// Shows all academic operators, allows setting a default AO,
// and expands to show each AO's enrolled students.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Users, Star, StarOff, ChevronDown, ChevronRight, GraduationCap, RefreshCw, CheckCircle2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface AcademicOperator {
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  batch_count: number;
  active_batch_count: number;
  student_count: number;
}

interface AOStudent {
  email: string;
  full_name: string;
  grade: string | null;
  board: string | null;
  phone: string | null;
  batch_name: string | null;
  batch_status: string | null;
  student_status: string | null;
  is_active: boolean;
}

// ── Component ────────────────────────────────────────────────

export default function AOManagementPanel() {
  const [aos, setAos] = useState<AcademicOperator[]>([]);
  const [defaultAO, setDefaultAO] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [expandedAO, setExpandedAO] = useState<string | null>(null);
  const [studentsByAO, setStudentsByAO] = useState<Record<string, AOStudent[]>>({});
  const [studentsLoading, setStudentsLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAOs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/owner/academic-operators');
      const data = await res.json();
      if (data.success) {
        setAos(data.data.aos);
        setDefaultAO(data.data.defaultAO);
      }
    } catch {
      showToast('Failed to load academic operators', false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAOs(); }, [fetchAOs]);

  const handleSetDefault = async (email: string) => {
    const isClearing = defaultAO === email;
    setSettingDefault(email);
    try {
      const res = await fetch('/api/v1/owner/academic-operators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_email: isClearing ? null : email }),
      });
      const data = await res.json();
      if (data.success) {
        setDefaultAO(data.data.defaultAO);
        showToast(isClearing ? 'Default AO cleared' : `Default AO set to ${email}`);
      } else {
        showToast(data.error || 'Failed to update', false);
      }
    } catch {
      showToast('Request failed', false);
    }
    setSettingDefault(null);
  };

  const toggleExpand = async (email: string) => {
    if (expandedAO === email) {
      setExpandedAO(null);
      return;
    }
    setExpandedAO(email);
    if (studentsByAO[email]) return; // already cached

    setStudentsLoading(email);
    try {
      const res = await fetch(`/api/v1/owner/academic-operators/${encodeURIComponent(email)}/students`);
      const data = await res.json();
      if (data.success) {
        setStudentsByAO(prev => ({ ...prev, [email]: data.data.students }));
      }
    } catch {
      showToast('Failed to load students', false);
    }
    setStudentsLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
            <Users className="h-4 w-4 text-violet-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Academic Operators</h3>
            <p className="text-xs text-gray-500">{aos.length} operator{aos.length !== 1 ? 's' : ''} · Star to set as default for new batches</p>
          </div>
        </div>
        <button
          onClick={fetchAOs}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Default AO indicator */}
      {defaultAO && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
          <span className="text-xs text-amber-800">
            Default AO: <span className="font-semibold">{aos.find(a => a.email === defaultAO)?.full_name ?? defaultAO}</span> — pre-filled on new batch creation
          </span>
        </div>
      )}

      {/* AO list */}
      {aos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No academic operators found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {aos.map(ao => {
            const isDefault = defaultAO === ao.email;
            const isExpanded = expandedAO === ao.email;
            const students = studentsByAO[ao.email] ?? [];
            const isLoadingStudents = studentsLoading === ao.email;

            return (
              <div
                key={ao.email}
                className={cn(
                  'rounded-xl border transition-all',
                  isDefault ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'
                )}
              >
                {/* AO row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    isDefault ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
                  )}>
                    {(ao.full_name || ao.email).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{ao.full_name}</span>
                      {isDefault && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{ao.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">{ao.student_count}</p>
                      <p className="text-[10px] text-gray-400">students</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">{ao.active_batch_count}</p>
                      <p className="text-[10px] text-gray-400">batches</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Set/clear default */}
                    <button
                      onClick={() => handleSetDefault(ao.email)}
                      disabled={settingDefault === ao.email}
                      title={isDefault ? 'Clear default' : 'Set as default AO'}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                        isDefault
                          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                      )}
                    >
                      {settingDefault === ao.email ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : isDefault ? (
                        <Star className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Expand students */}
                    <button
                      onClick={() => toggleExpand(ao.email)}
                      title={isExpanded ? 'Hide students' : `Show students (${ao.student_count})`}
                      className="flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{ao.student_count}</span>
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Expanded students list */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-3 pt-2">
                    {isLoadingStudents ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : students.length === 0 ? (
                      <div className="py-4 text-center">
                        <GraduationCap className="mx-auto h-6 w-6 text-gray-300 mb-1" />
                        <p className="text-xs text-gray-400">No students in this AO's scope</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pb-1">
                          {students.length} student{students.length !== 1 ? 's' : ''}
                        </p>
                        {/* Mobile: cards / Desktop: compact list */}
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {students.map(s => (
                            <div
                              key={s.email}
                              className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
                                {(s.full_name || s.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium text-gray-900 truncate">
                                    {s.full_name || s.email}
                                  </p>
                                  {s.student_status === 'active' && (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {s.grade && <span className="text-[10px] text-gray-400">Gr {s.grade}</span>}
                                  {s.batch_name && (
                                    <>
                                      <span className="text-[10px] text-gray-300">·</span>
                                      <span className="text-[10px] text-gray-400 truncate flex items-center gap-0.5">
                                        <BookOpen className="h-2.5 w-2.5 shrink-0" />
                                        {s.batch_name}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-4 right-4 z-[9999] rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl',
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
