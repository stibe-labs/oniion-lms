// ═══════════════════════════════════════════════════════════════
// Discontinued / On-Break Students Panel
// Shared component for AO and Batch Coordinator dashboards
// ═══════════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState, useCallback } from 'react';
import {
  Badge, EmptyState, LoadingState, Alert, useToast,
} from '@/components/dashboard/shared';
import {
  UserX, UserCheck, Search, RefreshCw, ChevronDown,
} from 'lucide-react';

interface DiscontinuedStudent {
  id: number;
  batch_id: string;
  student_email: string;
  parent_email: string | null;
  student_status: string;
  discontinued_at: string | null;
  rejoined_at: string | null;
  status_note: string | null;
  added_at: string;
  batch_name: string;
  grade: string;
  section: string | null;
  batch_status: string;
  student_name: string | null;
  profile_image: string | null;
}

function DiscontinuedStudentsPanelInner() {
  const [students, setStudents] = useState<DiscontinuedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'discontinued' | 'on_break' | 'rejoined'>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const toast = useToast();

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/v1/student-status' : `/api/v1/student-status?status=${filter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setStudents(json.data?.students || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const updateStatus = async (batchId: string, email: string, status: string, note?: string) => {
    const key = `${batchId}:${email}`;
    setActionLoading(key);
    try {
      const res = await fetch('/api/v1/student-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, student_email: email, status, note }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Student status updated to ${status}`);
        setShowNoteFor(null);
        setNoteText('');
        fetchStudents();
      } else {
        toast.error(json.error || 'Failed to update');
      }
    } catch { toast.error('Network error'); }
    setActionLoading(null);
  };

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.student_name?.toLowerCase().includes(q) || s.student_email.toLowerCase().includes(q) || s.batch_name.toLowerCase().includes(q));
  });

  const statusColor: Record<string, string> = {
    discontinued: 'bg-red-100 text-red-700',
    on_break: 'bg-amber-100 text-amber-700',
    rejoined: 'bg-blue-100 text-blue-700',
  };

  const statusLabel: Record<string, string> = {
    discontinued: 'Discontinued',
    on_break: 'On Break',
    rejoined: 'Rejoined',
  };

  const dt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <UserX className="h-4 w-4 text-gray-500" />
          Discontinued / On-Break Students
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search student..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary w-48"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="discontinued">Discontinued</option>
            <option value="on_break">On Break</option>
            <option value="rejoined">Rejoined</option>
          </select>
          <button onClick={fetchStudents} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserCheck} message="No discontinued or on-break students found." />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {filtered.map(s => {
            const key = `${s.batch_id}:${s.student_email}`;
            const isLoading = actionLoading === key;
            return (
              <div key={key} className="px-4 py-3 flex items-center gap-3">
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0 overflow-hidden">
                  {s.profile_image ? (
                    <img src={s.profile_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (s.student_name || s.student_email).charAt(0).toUpperCase()
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{s.student_name || s.student_email}</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor[s.student_status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[s.student_status] || s.student_status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {s.batch_name} · Grade {s.grade}{s.section ? ` ${s.section}` : ''}
                    {s.discontinued_at && <span className="ml-2">Since {dt(s.discontinued_at)}</span>}
                    {s.status_note && <span className="ml-2 italic text-gray-400">— {s.status_note}</span>}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {(s.student_status === 'discontinued' || s.student_status === 'on_break') && (
                    <>
                      {showNoteFor === key ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Note (optional)"
                            className="text-xs border border-gray-200 rounded px-2 py-1 w-36"
                          />
                          <button
                            onClick={() => updateStatus(s.batch_id, s.student_email, 'rejoined', noteText)}
                            disabled={isLoading}
                            className="text-xs font-medium text-white bg-primary hover:bg-primary/90 px-2 py-1 rounded disabled:opacity-50 transition"
                          >
                            {isLoading ? '...' : 'Confirm Rejoin'}
                          </button>
                          <button onClick={() => { setShowNoteFor(null); setNoteText(''); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-1">×</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNoteFor(key)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-lg transition"
                        >
                          <UserCheck className="h-3 w-3" /> Rejoin
                        </button>
                      )}
                    </>
                  )}
                  {s.student_status === 'rejoined' && (
                    <button
                      onClick={() => updateStatus(s.batch_id, s.student_email, 'active')}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg disabled:opacity-50 transition"
                    >
                      <UserCheck className="h-3 w-3" /> {isLoading ? '...' : 'Mark Active'}
                    </button>
                  )}
                  <button className="relative group">
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(DiscontinuedStudentsPanelInner);
