// ═══════════════════════════════════════════════════════════════
// Admissions Management — Client Component
// View and manage student admission requests through the workflow:
// enquiry → registered → fee_confirmed → allocated → active
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, GraduationCap, XCircle, UserPlus, Search,
  RefreshCw, Loader2, ChevronRight, CheckCircle2, AlertCircle,
  Clock, ArrowRight, Filter,
} from 'lucide-react';

interface Admission {
  id: string;
  student_name: string;
  student_email: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  grade: string;
  subjects: string[];
  board: string;
  batch_type_pref: string;
  status: string;
  notes: string;
  processed_by: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const STATUS_COLORS: Record<string, string> = {
  enquiry: 'bg-yellow-500/20 text-yellow-400',
  registered: 'bg-blue-500/20 text-blue-400',
  fee_confirmed: 'bg-cyan-500/20 text-cyan-400',
  allocated: 'bg-purple-500/20 text-purple-400',
  active: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const STATUS_FLOW = ['enquiry', 'registered', 'fee_confirmed', 'allocated', 'active'];

export default function AdmissionsClient({ userName, userEmail, userRole }: Props) {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAdmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/v1/admissions?${params}`);
      const data = await res.json();
      if (data.success) setAdmissions(data.data.admissions || []);
    } catch (err) {
      console.error('Failed to fetch admissions:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchAdmissions(); }, [fetchAdmissions]);

  const advanceStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/v1/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance', admission_id: id, new_status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAdmissions();
      } else {
        alert(data.error || 'Failed to advance status');
      }
    } catch {
      alert('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const getNextStatus = (current: string): string | null => {
    const idx = STATUS_FLOW.indexOf(current);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) return STATUS_FLOW[idx + 1];
    return null;
  };

  const filtered = admissions.filter(a =>
    a.student_name.toLowerCase().includes(search.toLowerCase()) ||
    a.student_email.toLowerCase().includes(search.toLowerCase()) ||
    a.parent_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    all: admissions.length,
    enquiry: admissions.filter(a => a.status === 'enquiry').length,
    registered: admissions.filter(a => a.status === 'registered').length,
    fee_confirmed: admissions.filter(a => a.status === 'fee_confirmed').length,
    allocated: admissions.filter(a => a.status === 'allocated').length,
    active: admissions.filter(a => a.status === 'active').length,
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Student Admissions</h1>
        <p className="text-sm text-muted-foreground">Manage admission workflow: enquiry → registered → fee confirmed → allocated → active</p>
      </div>

      {/* Status filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', ...STATUS_FLOW].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')} ({statusCounts[s as keyof typeof statusCounts] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Refresh */}
      <div className="mb-4 flex justify-end">
        <button onClick={fetchAdmissions} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No admissions found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const nextStatus = getNextStatus(a.status);
            return (
              <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{a.student_name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-muted text-muted-foreground'}`}>
                        {a.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.student_email}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Grade: {a.grade}</span>
                      <span>Board: {a.board || '—'}</span>
                      <span>Pref: {a.batch_type_pref?.replace('_', ' ') || '—'}</span>
                      {a.subjects?.length > 0 && <span>Subjects: {a.subjects.join(', ')}</span>}
                    </div>
                    {a.parent_name && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Parent: {a.parent_name} ({a.parent_email}) {a.parent_phone && `· ${a.parent_phone}`}
                      </p>
                    )}
                    {a.notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic">{a.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {nextStatus && a.status !== 'rejected' && (
                      <button
                        onClick={() => advanceStatus(a.id, nextStatus)}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {actionLoading === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        → {nextStatus.replace('_', ' ')}
                      </button>
                    )}
                    {a.status !== 'rejected' && a.status !== 'active' && (
                      <button
                        onClick={() => advanceStatus(a.id, 'rejected')}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    {a.status === 'active' && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
