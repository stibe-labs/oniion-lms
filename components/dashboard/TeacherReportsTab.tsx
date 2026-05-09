'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { fmtSmartDateIST } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Search, RefreshCw,
  Filter, ChevronDown, ChevronUp, MessageSquare, Shield, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Teacher Reports Tab — shared by batch_coordinator, AO, owner
   ═══════════════════════════════════════════════════════════════ */

interface TeacherReport {
  id: string;
  room_id: string;
  batch_id: string | null;
  student_email: string;
  student_name: string | null;
  teacher_email: string;
  teacher_name: string | null;
  category: string;
  description: string;
  severity: string;
  status: string;
  assigned_to: string | null;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notified_roles: string[];
  created_at: string;
  updated_at: string;
  room_name?: string;
  batch_name?: string;
  grade?: string;
  section?: string;
}

interface Summary {
  open_count: number;
  investigating_count: number;
  resolved_count: number;
  dismissed_count: number;
  critical_active: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  sexual_abuse: 'Sexual Abuse / Harassment',
  inappropriate_behaviour: 'Inappropriate Behaviour',
  bad_performance: 'Bad Teaching Performance',
  doubt_not_cleared: 'Not Clearing Doubts',
  abusive_language: 'Abusive / Offensive Language',
  discrimination: 'Discrimination / Bias',
  unprofessional_conduct: 'Unprofessional Conduct',
  other: 'Other',
};

const CATEGORY_ICONS: Record<string, string> = {
  sexual_abuse: '🚫',
  inappropriate_behaviour: '⚠️',
  bad_performance: '📉',
  doubt_not_cleared: '❓',
  abusive_language: '🤬',
  discrimination: '🚷',
  unprofessional_conduct: '👔',
  other: '📋',
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; badge: string }> = {
  critical: { bg: 'bg-red-50',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700 ring-red-200' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 ring-orange-200' },
  medium:   { bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
  low:      { bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700 ring-blue-200' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  open:          { bg: 'bg-red-100',    text: 'text-red-700',    icon: AlertTriangle },
  investigating: { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: Eye },
  resolved:      { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
  dismissed:     { bg: 'bg-gray-100',   text: 'text-gray-500',   icon: X },
};

export default function TeacherReportsTab() {
  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterSeverity) params.set('severity', filterSeverity);
      params.set('limit', '100');
      const res = await fetch(`/api/v1/teacher-reports?${params}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.data.reports);
        setSummary(data.data.summary);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filterStatus, filterSeverity]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const updateReport = useCallback(async (reportId: string, updates: Record<string, string>) => {
    setActionLoading(reportId);
    try {
      const res = await fetch('/api/v1/teacher-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, ...data.data } : r));
        fetchReports(); // refresh summary
      }
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  }, [fetchReports]);

  const filtered = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.teacher_name?.toLowerCase().includes(q)) ||
      (r.teacher_email.toLowerCase().includes(q)) ||
      (r.student_name?.toLowerCase().includes(q)) ||
      (r.student_email.toLowerCase().includes(q)) ||
      (r.room_name?.toLowerCase().includes(q)) ||
      (CATEGORY_LABELS[r.category]?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryCard label="Open" count={summary.open_count} color="text-red-600" bg="bg-red-50" icon={AlertTriangle} />
          <SummaryCard label="Investigating" count={summary.investigating_count} color="text-amber-600" bg="bg-amber-50" icon={Eye} />
          <SummaryCard label="Resolved" count={summary.resolved_count} color="text-green-600" bg="bg-green-50" icon={CheckCircle2} />
          <SummaryCard label="Dismissed" count={summary.dismissed_count} color="text-gray-500" bg="bg-gray-50" icon={X} />
          <SummaryCard label="Critical Active" count={summary.critical_active} color="text-red-700" bg="bg-red-100" icon={Shield} />
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teacher, student, room..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-300 focus:outline-none">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-300 focus:outline-none">
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={fetchReports} className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Reports list */}
      {loading && reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Loading reports...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Shield className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">No teacher reports found</p>
          <p className="text-xs mt-1">Reports submitted by students will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => {
            const sev = SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.medium;
            const stat = STATUS_STYLES[report.status] || STATUS_STYLES.open;
            const StatIcon = stat.icon;
            const isExpanded = expandedId === report.id;
            const isActioning = actionLoading === report.id;

            return (
              <div key={report.id} className={cn(
                'rounded-xl border bg-white shadow-sm overflow-hidden transition-all',
                report.severity === 'critical' && report.status === 'open' && 'border-red-300 ring-1 ring-red-100',
              )}>
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{CATEGORY_ICONS[report.category] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">
                          {CATEGORY_LABELS[report.category] || report.category}
                        </p>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ring-1', sev.badge)}>
                          {report.severity.toUpperCase()}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', stat.bg, stat.text)}>
                          <StatIcon className="h-3 w-3" />
                          {report.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Teacher: <span className="font-medium text-gray-700">{report.teacher_name || report.teacher_email}</span></span>
                        <span>•</span>
                        <span>By: <span className="font-medium text-gray-700">{report.student_name || report.student_email}</span></span>
                        <span>•</span>
                        <span>{fmtSmartDateIST(report.created_at)}</span>
                      </div>
                      {report.room_name && (
                        <p className="text-xs text-gray-400 mt-0.5">Session: {report.room_name}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 mt-1" />}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/30">
                    {/* Description */}
                    {report.description && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Student&apos;s Description</p>
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                      <InfoCell label="Report ID" value={report.id.slice(0, 8).toUpperCase()} />
                      <InfoCell label="Teacher" value={report.teacher_name || report.teacher_email} />
                      <InfoCell label="Student" value={report.student_name || report.student_email} />
                      <InfoCell label="Session" value={report.room_name || report.room_id} />
                      {report.batch_name && <InfoCell label="Batch" value={`${report.batch_name}${report.grade ? ` (${report.grade}${report.section ? `-${report.section}` : ''})` : ''}`} />}
                      <InfoCell label="Reported" value={new Date(report.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} />
                      {report.resolved_at && <InfoCell label="Resolved" value={new Date(report.resolved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} />}
                      {report.resolved_by && <InfoCell label="Resolved By" value={report.resolved_by} />}
                      {report.assigned_to && <InfoCell label="Assigned To" value={report.assigned_to} />}
                    </div>

                    {/* Resolution */}
                    {report.resolution && (
                      <div className="mb-4">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Resolution</p>
                        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                          <p className="text-sm text-green-800 leading-relaxed">{report.resolution}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {(report.status === 'open' || report.status === 'investigating') && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {report.status === 'open' && (
                          <ActionBtn
                            label="Start Investigation"
                            loading={isActioning}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => updateReport(report.id, { status: 'investigating' })}
                          />
                        )}
                        <ActionBtn
                          label="Mark Resolved"
                          loading={isActioning}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            const resolution = prompt('Enter resolution notes:');
                            if (resolution !== null) {
                              updateReport(report.id, { status: 'resolved', resolution });
                            }
                          }}
                        />
                        <ActionBtn
                          label="Dismiss"
                          loading={isActioning}
                          className="bg-gray-500 hover:bg-gray-600 text-white"
                          onClick={() => {
                            const resolution = prompt('Reason for dismissal:');
                            if (resolution !== null) {
                              updateReport(report.id, { status: 'dismissed', resolution });
                            }
                          }}
                        />
                      </div>
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
}

/* ── Small helper components ─────────────────────────────── */

function SummaryCard({ label, count, color, bg, icon: Icon }: {
  label: string; count: number; color: string; bg: string; icon: typeof Clock;
}) {
  return (
    <div className={cn('rounded-xl border border-gray-100 p-3', bg)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold mt-1', color)}>{count}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white border border-gray-100 p-2">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">{value}</p>
    </div>
  );
}

function ActionBtn({ label, loading, className, onClick }: {
  label: string; loading: boolean; className: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
        className,
      )}
    >
      {loading ? '...' : label}
    </button>
  );
}
