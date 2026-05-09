// ═══════════════════════════════════════════════════════════════
// Cancellation Requests — Client Component
// View and process class cancellation requests.
// Workflows: parent_initiated, group_request, teacher_initiated
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, GraduationCap, XCircle, Search,
  RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock,
  Shield, User, Users as UsersIcon,
} from 'lucide-react';

interface CancellationRequest {
  id: string;
  room_id: string;
  room_name: string;
  requested_by: string;
  requester_role: string;
  reason: string;
  cancellation_type: string;
  status: string;
  coordinator_decision: string | null;
  coordinator_email: string | null;
  admin_decision: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const TYPE_COLORS: Record<string, string> = {
  parent_initiated: 'bg-orange-500/20 text-orange-400',
  group_request: 'bg-purple-500/20 text-purple-400',
  teacher_initiated: 'bg-blue-500/20 text-blue-400',
  auto: 'bg-gray-500/20 text-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  coordinator_approved: 'bg-cyan-500/20 text-cyan-400',
  admin_approved: 'bg-blue-500/20 text-blue-400',
  academic_approved: 'bg-indigo-500/20 text-indigo-400',
  hr_approved: 'bg-violet-500/20 text-violet-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export default function CancellationsClient({ userName, userEmail, userRole }: Props) {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/cancellations');
      const data = await res.json();
      if (data.success) setRequests(data.data.requests || []);
    } catch (err) {
      console.error('Failed to fetch cancellation requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (id: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/v1/cancellations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          cancellation_id: id,
          ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRequests();
      } else {
        alert(data.error || `Failed to ${action} request`);
      }
    } catch {
      alert('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter || r.cancellation_type === filter);

  const pendingCount = requests.filter(r => r.status === 'pending' || r.status === 'coordinator_approved').length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'parent_initiated': return <User className="h-3.5 w-3.5" />;
      case 'group_request': return <UsersIcon className="h-3.5 w-3.5" />;
      case 'teacher_initiated': return <Shield className="h-3.5 w-3.5" />;
      default: return <AlertCircle className="h-3.5 w-3.5" />;
    }
  };

  const canApprove = (req: CancellationRequest) => {
    if (req.status === 'approved' || req.status === 'rejected') return false;
    // Coordinator can approve pending parent_initiated and group_request directly
    if (req.cancellation_type === 'parent_initiated' && req.status === 'pending') return true;
    if (req.cancellation_type === 'group_request' && req.status === 'pending') return true;
    // For teacher_initiated, coordinator approves first step
    if (req.cancellation_type === 'teacher_initiated' && req.status === 'pending') return true;
    return false;
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cancellation Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve/reject session cancellation requests
          {pendingCount > 0 && <span className="ml-2 text-yellow-400">({pendingCount} pending action)</span>}
        </p>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'pending', 'parent_initiated', 'group_request', 'teacher_initiated', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Refresh */}
      <div className="mb-4 flex justify-end">
        <button onClick={fetchRequests} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No cancellation requests</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div key={req.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-white">{req.room_name || req.room_id}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[req.cancellation_type] || ''}`}>
                      {getTypeIcon(req.cancellation_type)}
                      {req.cancellation_type.replace('_', ' ')}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status] || ''}`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1">{req.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>By: {req.requested_by} ({req.requester_role})</span>
                    <span>Date: {new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                  {req.rejection_reason && (
                    <p className="mt-1 text-xs text-red-400">Rejection: {req.rejection_reason}</p>
                  )}
                  {/* Approval chain display for teacher_initiated */}
                  {req.cancellation_type === 'teacher_initiated' && req.coordinator_decision && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Coordinator: {req.coordinator_decision}
                      {req.admin_decision && <><span>→</span> Admin: {req.admin_decision}</>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {canApprove(req) && (
                    <>
                      <button
                        onClick={() => handleAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Rejection reason:');
                          if (reason) handleAction(req.id, 'reject', reason);
                        }}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-1 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {req.status === 'approved' && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> Rejected
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
