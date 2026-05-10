// ═══════════════════════════════════════════════════════════════
// Extension Requests Panel — For Coordinator / AO / Owner dashboards
// Polls for pending_coordinator extension requests and lets them approve/reject
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  EmptyState, LoadingState, useToast,
} from '@/components/dashboard/shared';
import { Clock, CheckCircle, XCircle, RefreshCw, Timer } from 'lucide-react';

interface ExtRequest {
  id: string;
  room_id: string;
  batch_session_id: string | null;
  batch_id: string | null;
  student_email: string;
  student_name: string;
  requested_minutes: number;
  reason: string | null;
  status: string;
  teacher_email: string;
  teacher_responded_at: string | null;
  teacher_note: string | null;
  coordinator_email: string | null;
  extension_fee_paise: number;
  original_duration: number;
  created_at: string;
  room_name: string;
  subject: string;
  grade: string;
  batch_name: string;
}

export default function ExtensionRequestsPanel() {
  const [requests, setRequests] = useState<ExtRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToast();

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/session-extension?status=pending_coordinator');
      const json = await res.json();
      if (json.success) setRequests(json.data?.requests || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Poll every 15 seconds for new requests
  useEffect(() => {
    fetchRequests();
    const iv = setInterval(fetchRequests, 15_000);
    return () => clearInterval(iv);
  }, [fetchRequests]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject', note?: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch('/api/v1/session-extension', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action, note }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(action === 'approve'
          ? `Session extended — invoice generated`
          : 'Extension request rejected');
        fetchRequests();
      } else {
        toast.error(json.error || 'Failed');
      }
    } catch { toast.error('Network error'); }
    setActionLoading(null);
  };

  if (loading) return <LoadingState />;
  if (requests.length === 0) return null; // Don't render if no pending requests

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-200 bg-blue-50">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">
            Session Extension Requests
          </span>
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-[10px] font-bold text-white">
            {requests.length}
          </span>
        </div>
        <button onClick={fetchRequests} className="p-1 text-blue-400 hover:text-blue-600 rounded transition">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="divide-y divide-blue-100">
        {requests.map(req => {
          const isLoading = actionLoading === req.id;
          const feeStr = req.extension_fee_paise > 0 ? `₹${(req.extension_fee_paise / 100).toFixed(0)}` : 'Free';
          const minsLabel = req.requested_minutes === 30 ? '30min' : req.requested_minutes === 60 ? '1hr' : '2hrs';
          const timeAgo = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 60_000);

          return (
            <div key={req.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {req.student_name || req.student_email}
                  </span>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    +{minsLabel}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">{timeAgo < 1 ? 'just now' : `${timeAgo}m ago`}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                {req.room_name} · {req.subject} · {req.batch_name || 'N/A'}
                <span className="ml-2 font-medium text-gray-700">Fee: {feeStr}</span>
                {req.teacher_note && <span className="ml-2 italic">Teacher: "{req.teacher_note}"</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(req.id, 'approve')}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  <CheckCircle className="h-3 w-3" />
                  {isLoading ? '…' : 'Approve & Extend'}
                </button>
                <button
                  onClick={() => handleAction(req.id, 'reject')}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
                >
                  <XCircle className="h-3 w-3" />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
