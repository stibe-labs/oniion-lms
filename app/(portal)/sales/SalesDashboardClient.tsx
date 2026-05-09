'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  Card, StatCard, SearchInput, Button, Badge, Modal,
  Input, Textarea, Select, FormField, FormGrid, FormActions,
  TableWrapper, THead, TH, TRow,
} from '@/components/dashboard/shared';
import {
  Users, TrendingUp, UserCheck, UserX, Clock,
  Plus, Phone, MessageSquare, FileText, AlertCircle,
  CheckCircle2, Calendar, BarChart3, Layers,
  ChevronLeft, ChevronRight, Eye, Edit2, Archive,
  Bell, RefreshCw, Download, Loader2, Facebook,
  Filter, X, ArrowUpDown, ArrowUp, ArrowDown,
  Mail, SlidersHorizontal, Megaphone, Search,
  ExternalLink, Save, PhoneCall, MessageCircle,
  Copy, Check, Hash, Star, Tag, Wifi, Radio,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  source: string;
  pipeline_stage: string;
  lead_score: number;
  priority: string;
  tags: string[];
  assigned_to: string | null;
  student_grade: string | null;
  student_board: string | null;
  subjects_interested: string[] | null;
  batch_type_pref: string | null;
  source_detail: string | null;
  lost_reason: string | null;
  campaign_name: string | null;
  ad_name: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadDetail extends Lead {
  ad_id: string | null;
  ad_name: string | null;
  campaign_id: string | null;
  converted_at: string | null;
  student_email: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

interface Activity {
  id: string;
  lead_id: string;
  lead_name?: string;
  activity_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  call_duration_sec: number | null;
  call_direction: string | null;
  performed_by: string;
  created_at: string;
}

interface Reminder {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  title: string;
  description: string | null;
  due_at: string;
  reminder_type: string;
  status: string;
  snoozed_until: string | null;
  completed_at: string | null;
  assigned_to: string;
  created_by: string;
  created_at: string;
}

interface DashboardStats {
  pipeline: { pipeline_stage: string; count: number }[];
  sources: { source: string; count: number }[];
  todayReminders: Reminder[];
  recentLeads: Lead[];
  totals: { total: number; today: number; enrolled: number; lost: number };
  overdueReminders: number;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

// ── Constants ────────────────────────────────────────────────

const STAGES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'interested', label: 'Interested', color: 'bg-purple-100 text-purple-800' },
  { value: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'demo_completed', label: 'Demo Completed', color: 'bg-teal-100 text-teal-800' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-amber-100 text-amber-800' },
  { value: 'enrolled', label: 'Enrolled', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
  { value: 'disqualified', label: 'Disqualified', color: 'bg-gray-100 text-gray-600' },
];

const SOURCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'whatsapp_ctwa', label: 'WhatsApp CTWA' },
  { value: 'facebook_lead', label: 'Facebook Lead' },
  { value: 'instagram_lead', label: 'Instagram Lead' },
  { value: 'demo_request', label: 'Demo Request' },
  { value: 'admission', label: 'Admission' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'walkin', label: 'Walk-in' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-gray-500' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
];

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Phone Call' },
  { value: 'whatsapp_sent', label: 'WhatsApp Sent' },
  { value: 'whatsapp_received', label: 'WhatsApp Received' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'follow_up', label: 'Follow Up' },
];

function stageInfo(stage: string) {
  return STAGES.find(s => s.value === stage) || { value: stage, label: stage, color: 'bg-gray-100 text-gray-600' };
}

function sourceLabel(src: string) {
  return SOURCES.find(s => s.value === src)?.label || src;
}

function priorityInfo(p: string) {
  return PRIORITIES.find(pr => pr.value === p) || { value: p, label: p, color: 'text-gray-500' };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════════════
// Main Dashboard Component
// ═══════════════════════════════════════════════════════════════

export default function SalesDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const [activeTab, setActiveTab] = useState('overview');

  // Listen for hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveTab(hash);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <div className="p-6 space-y-6">
        {activeTab === 'overview' && <OverviewTab userEmail={userEmail} />}
        {activeTab === 'leads' && <LeadsTab userEmail={userEmail} />}
        {activeTab === 'pipeline' && <PipelineTab userEmail={userEmail} />}
        {activeTab === 'activities' && <ActivitiesTab userEmail={userEmail} />}
        {activeTab === 'reminders' && <RemindersTab userEmail={userEmail} />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ userEmail }: { userEmail: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ leads_imported: number; leads_fetched: number; leads_skipped: number; campaigns_scanned: number } | null>(null);
  const [fbStats, setFbStats] = useState<{ fb_leads: number; fb_today: number; last_fb_lead: string | null; campaigns: number } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, fbRes] = await Promise.all([
        fetch('/api/v1/sales/dashboard'),
        fetch('/api/v1/sales/fb-sync'),
      ]);
      const dashData = await dashRes.json();
      const fbData = await fbRes.json();
      if (dashData.success) setStats(dashData.data);
      if (fbData.success) setFbStats(fbData.data);
    } catch (e) { console.error('Failed to fetch stats:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleFBSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/v1/sales/fb-sync', { method: 'POST' });
      const data = await res.json();
      if (data.success || data.data) {
        setSyncResult(data.data);
        fetchStats(); // Refresh dashboard after sync
      }
    } catch (e) { console.error('Sync failed:', e); }
    finally { setSyncing(false); }
  };

  if (loading || !stats) {
    return <div className="text-center py-12 text-gray-500">Loading dashboard…</div>;
  }

  const inPipeline = stats.pipeline
    .filter(p => !['enrolled', 'lost', 'disqualified'].includes(p.pipeline_stage))
    .reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Total Leads" value={stats.totals.total} variant="default" />
        <StatCard icon={Plus} label="Today" value={stats.totals.today} variant="info" />
        <StatCard icon={TrendingUp} label="In Pipeline" value={inPipeline} variant="warning" />
        <StatCard icon={UserCheck} label="Enrolled" value={stats.totals.enrolled} variant="success" />
        <StatCard icon={UserX} label="Lost" value={stats.totals.lost} variant="danger" />
      </div>

      {/* Facebook Sync Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Facebook className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Facebook Lead Ads</h3>
              <p className="text-xs text-gray-500">
                {fbStats ? (
                  <>
                    {fbStats.fb_leads} leads synced · {fbStats.campaigns} campaigns
                    {fbStats.last_fb_lead && <> · Last: {fmtDate(fbStats.last_fb_lead)}</>}
                  </>
                ) : 'No leads synced yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {syncResult && (
              <span className="text-xs text-green-700 bg-green-50 px-3 py-1 rounded-full">
                +{syncResult.leads_imported} imported, {syncResult.leads_skipped} skipped
              </span>
            )}
            <button
              onClick={handleFBSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
              ) : (
                <><Download className="w-4 h-4" /> Sync from Facebook</>
              )}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline Breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pipeline Breakdown</h3>
          <div className="space-y-2">
            {STAGES.map(stage => {
              const count = stats.pipeline.find(p => p.pipeline_stage === stage.value)?.count || 0;
              const maxCount = Math.max(...stats.pipeline.map(p => p.count), 1);
              return (
                <div key={stage.value} className="flex items-center gap-3">
                  <span className="text-xs w-28 text-gray-600">{stage.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage.color.split(' ')[0].replace('100', '400')} transition-all`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Lead Sources</h3>
          <div className="space-y-2">
            {stats.sources.map(src => {
              const total = stats.sources.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? ((src.count / total) * 100).toFixed(0) : '0';
              return (
                <div key={src.source} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{sourceLabel(src.source)}</span>
                  <span className="font-medium">{src.count} <span className="text-gray-400">({pct}%)</span></span>
                </div>
              );
            })}
            {stats.sources.length === 0 && <p className="text-gray-400 text-sm">No leads yet</p>}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Reminders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Today&apos;s Reminders
              {stats.overdueReminders > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                  {stats.overdueReminders} overdue
                </span>
              )}
            </h3>
          </div>
          <div className="space-y-2">
            {stats.todayReminders.map(r => {
              const overdue = new Date(r.due_at) < new Date();
              return (
                <div key={r.id} className={`flex items-center justify-between p-2 rounded text-sm ${overdue ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div>
                    <span className={overdue ? 'text-red-700 font-medium' : 'text-gray-700'}>{r.title}</span>
                    {r.lead_name && <span className="text-gray-400 ml-2">— {r.lead_name}</span>}
                  </div>
                  <span className="text-xs text-gray-500">{fmtDateTime(r.due_at)}</span>
                </div>
              );
            })}
            {stats.todayReminders.length === 0 && <p className="text-gray-400 text-sm">No reminders today</p>}
          </div>
        </Card>

        {/* Recent Leads */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Leads</h3>
          <div className="space-y-2">
            {stats.recentLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div>
                  <span className="font-medium text-gray-800">{lead.full_name}</span>
                  <span className="text-gray-400 ml-2">{lead.phone || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${stageInfo(lead.pipeline_stage).color}`}>
                    {stageInfo(lead.pipeline_stage).label}
                  </span>
                  <span className="text-xs text-gray-400">{timeAgo(lead.created_at)}</span>
                </div>
              </div>
            ))}
            {stats.recentLeads.length === 0 && <p className="text-gray-400 text-sm">No leads yet</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Leads Tab — Professional CRM
// ═══════════════════════════════════════════════════════════════

interface LeadFilters {
  search: string;
  stage: string;
  source: string;
  priority: string;
  campaign: string;
  adName: string;
  sourceType: string; // '' | 'online' | 'offline'
  dateFrom: string;
  dateTo: string;
  hasPhone: string; // '' | 'true' | 'false'
  hasEmail: string;
  sort: string;
  order: 'desc' | 'asc';
}

const defaultFilters: LeadFilters = {
  search: '', stage: '', source: '', priority: '', campaign: '', adName: '', sourceType: '',
  dateFrom: '', dateTo: '', hasPhone: '', hasEmail: '',
  sort: 'created_at', order: 'desc',
};

function LeadsTab({ userEmail }: { userEmail: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<{ lead: LeadDetail; activities: Activity[]; reminders: Reminder[] } | null>(null);
  const [campaigns, setCampaigns] = useState<{ campaign_name: string; count: number }[]>([]);
  const [adSets, setAdSets] = useState<{ ad_name: string; count: number }[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Live polling state
  const [livePolling, setLivePolling] = useState(true);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [lastKnownTotal, setLastKnownTotal] = useState<number | null>(null);

  // Fetch campaign list on mount
  useEffect(() => {
    fetch('/api/v1/sales/leads?meta=campaigns')
      .then(r => r.json())
      .then(d => { if (d.success) setCampaigns(d.data); })
      .catch(() => {});
  }, []);

  // Fetch ad sets — filtered by campaign when one is selected
  useEffect(() => {
    setAdSetsLoading(true);
    const url = filters.campaign
      ? `/api/v1/sales/leads?meta=adsets&campaign=${encodeURIComponent(filters.campaign)}`
      : '/api/v1/sales/leads?meta=adsets';
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.success) setAdSets(d.data); })
      .catch(() => {})
      .finally(() => setAdSetsLoading(false));
  }, [filters.campaign]);

  const buildParams = useCallback((overrides?: Partial<LeadFilters & { page: number; limit: number; meta?: string }>) => {
    const f = { ...filters, ...overrides };
    const params = new URLSearchParams();
    params.set('page', String(overrides?.page ?? page));
    params.set('limit', String(overrides?.limit ?? perPage));
    if (f.search) params.set('search', f.search);
    if (f.stage) params.set('stage', f.stage);
    if (f.source) params.set('source', f.source);
    if (f.priority) params.set('priority', f.priority);
    if (f.campaign) params.set('campaign', f.campaign);
    if (f.adName) params.set('ad_name', f.adName);
    if (f.sourceType) params.set('source_type', f.sourceType);
    if (f.dateFrom) params.set('date_from', f.dateFrom);
    if (f.dateTo) params.set('date_to', f.dateTo);
    if (f.hasPhone) params.set('has_phone', f.hasPhone);
    if (f.hasEmail) params.set('has_email', f.hasEmail);
    if (f.sort) params.set('sort', f.sort);
    if (f.order) params.set('order', f.order);
    if (overrides?.meta) params.set('meta', overrides.meta);
    return params;
  }, [filters, page, perPage]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sales/leads?${buildParams()}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.data.leads);
        setTotal(data.data.pagination.total);
        setPages(data.data.pagination.pages);
        // Initialize lastKnownTotal on first load
        setLastKnownTotal(prev => prev === null ? data.data.pagination.total : prev);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Live polling — check for new leads every 30s
  useEffect(() => {
    if (!livePolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/sales/leads?${buildParams({ page: 1, limit: 1 })}`);
        const data = await res.json();
        if (data.success && lastKnownTotal !== null) {
          const currentTotal = data.data.pagination.total;
          if (currentTotal > lastKnownTotal) {
            setNewLeadCount(currentTotal - lastKnownTotal);
          }
        }
      } catch { /* ignore polling errors */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [livePolling, lastKnownTotal, buildParams]);

  const handleRefreshNewLeads = () => {
    setNewLeadCount(0);
    setLastKnownTotal(null); // will reset on next fetch
    setPage(1);
    // fetchLeads will be called by the page change
  };

  const fetchLeadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/sales/leads/${id}`);
      const data = await res.json();
      if (data.success) setLeadDetail(data.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (selectedLead) fetchLeadDetail(selectedLead);
    else setLeadDetail(null);
  }, [selectedLead, fetchLeadDetail]);

  const setFilter = (key: keyof LeadFilters, value: string) => {
    setFilters(f => {
      const next = { ...f, [key]: value };
      // When campaign changes, reset the ad set filter (it will re-fetch)
      if (key === 'campaign') next.adName = '';
      return next;
    });
    setPage(1);
  };

  const toggleSort = (col: string) => {
    setFilters(f => ({
      ...f,
      sort: col,
      order: f.sort === col && f.order === 'desc' ? 'asc' : 'desc',
    }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  const activeFilterCount = [
    filters.stage, filters.source, filters.priority, filters.campaign,
    filters.adName, filters.sourceType,
    filters.dateFrom, filters.dateTo, filters.hasPhone, filters.hasEmail,
  ].filter(Boolean).length;

  const handleStageChange = async (leadId: string, newStage: string) => {
    await fetch(`/api/v1/sales/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage }),
    });
    fetchLeads();
    if (selectedLead === leadId) fetchLeadDetail(leadId);
  };

  const handleArchive = async (leadId: string) => {
    await fetch(`/api/v1/sales/leads/${leadId}`, { method: 'DELETE' });
    setSelectedLead(null);
    fetchLeads();
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = buildParams({ page: 1, limit: 10000, meta: 'export' });
      const res = await fetch(`/api/v1/sales/leads?${params}`);
      const data = await res.json();
      if (!data.success) return;
      const rows = data.data.leads as Lead[];
      const headers = ['Name', 'Phone', 'Email', 'WhatsApp', 'Source', 'Campaign', 'Stage', 'Priority', 'Score', 'Created'];
      const csv = [
        headers.join(','),
        ...rows.map(r => [
          `"${(r.full_name || '').replace(/"/g, '""')}"`,
          `"${r.phone || ''}"`,
          `"${r.email || ''}"`,
          `"${r.whatsapp || ''}"`,
          sourceLabel(r.source),
          `"${(r.campaign_name || '').replace(/"/g, '""')}"`,
          stageInfo(r.pipeline_stage).label,
          r.priority,
          r.lead_score,
          r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
        ].join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (filters.sort !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return filters.order === 'asc'
      ? <ArrowUp className="w-3 h-3 text-emerald-600" />
      : <ArrowDown className="w-3 h-3 text-emerald-600" />;
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
          />
          {filters.search && (
            <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting || total === 0}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export
        </button>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Lead
        </Button>
        <button
          onClick={() => setLivePolling(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
            livePolling
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-gray-50 border border-gray-200 text-gray-400'
          }`}
          title={livePolling ? 'Live updates ON (30s)' : 'Live updates OFF'}
        >
          <Radio className={`w-3.5 h-3.5 ${livePolling ? 'animate-pulse' : ''}`} />
          Live
        </button>
      </div>

      {/* New leads snackbar */}
      {newLeadCount > 0 && (
        <button
          onClick={handleRefreshNewLeads}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition shadow-sm animate-in fade-in duration-300"
        >
          <Wifi className="w-4 h-4" />
          {newLeadCount} new lead{newLeadCount > 1 ? 's' : ''} arrived — Click to refresh
        </button>
      )}

      {/* Row 2: Stage pills (quick filter) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilter('stage', '')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            !filters.stage ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Stages
        </button>
        {STAGES.map(s => (
          <button
            key={s.value}
            onClick={() => setFilter('stage', filters.stage === s.value ? '' : s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filters.stage === s.value ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setFilter('sourceType', filters.sourceType === 'online' ? '' : 'online')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filters.sourceType === 'online' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Online Ads
          </button>
          <button
            onClick={() => setFilter('sourceType', filters.sourceType === 'offline' ? '' : 'offline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filters.sourceType === 'offline' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Offline
          </button>
        </div>
      </div>

      {/* Row 3: Campaign → Ad Set (always visible) + Advanced toggle */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 max-w-xs">
          <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
            <Megaphone className="w-3 h-3" /> Campaign
          </label>
          <select
            value={filters.campaign}
            onChange={e => setFilter('campaign', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Campaigns</option>
            {campaigns.map(c => (
              <option key={c.campaign_name} value={c.campaign_name}>
                {c.campaign_name} ({c.count})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1 max-w-xs">
          <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
            <Tag className="w-3 h-3" /> Ad Set
            {adSetsLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          </label>
          <select
            value={filters.adName}
            onChange={e => setFilter('adName', e.target.value)}
            disabled={adSetsLoading}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
          >
            <option value="">{filters.campaign ? 'All Ad Sets in Campaign' : 'All Ad Sets'}</option>
            {adSets.map(a => (
              <option key={a.ad_name} value={a.ad_name}>
                {a.ad_name} ({a.count})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-xs text-gray-500 mb-1 block">Priority</label>
          <select
            value={filters.priority}
            onChange={e => setFilter('priority', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-xs text-gray-500 mb-1 block">Source</label>
          <select
            value={filters.source}
            onChange={e => setFilter('source', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Sources</option>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition ${
            showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {showFilters ? 'Less' : 'More'}
        </button>
      </div>

      {/* Row 4: Advanced filters (collapsed by default) */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilter('dateFrom', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilter('dateTo', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
              <Phone className="w-3 h-3" /> Has Phone
            </label>
            <select
              value={filters.hasPhone}
              onChange={e => setFilter('hasPhone', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Any</option>
              <option value="true">Has phone</option>
              <option value="false">No phone</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
              <Mail className="w-3 h-3" /> Has Email
            </label>
            <select
              value={filters.hasEmail}
              onChange={e => setFilter('hasEmail', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Any</option>
              <option value="true">Has email</option>
              <option value="false">No email</option>
            </select>
          </div>
        </div>
      )}

      {/* Active Filter Chips + Results bar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilterCount > 0 && (
            <>
              {filters.stage && (
                <FilterChip label={`Stage: ${stageInfo(filters.stage).label}`} onRemove={() => setFilter('stage', '')} />
              )}
              {filters.source && (
                <FilterChip label={`Source: ${sourceLabel(filters.source)}`} onRemove={() => setFilter('source', '')} />
              )}
              {filters.priority && (
                <FilterChip label={`Priority: ${priorityInfo(filters.priority).label}`} onRemove={() => setFilter('priority', '')} />
              )}
              {filters.campaign && (
                <FilterChip label={`Campaign: ${filters.campaign}`} onRemove={() => setFilter('campaign', '')} />
              )}
              {filters.adName && (
                <FilterChip label={`Ad Set: ${filters.adName}`} onRemove={() => setFilter('adName', '')} />
              )}
              {filters.sourceType && (
                <FilterChip label={filters.sourceType === 'online' ? 'Online Ads' : 'Offline'} onRemove={() => setFilter('sourceType', '')} />
              )}
              {filters.dateFrom && (
                <FilterChip label={`From: ${filters.dateFrom}`} onRemove={() => setFilter('dateFrom', '')} />
              )}
              {filters.dateTo && (
                <FilterChip label={`To: ${filters.dateTo}`} onRemove={() => setFilter('dateTo', '')} />
              )}
              {filters.hasPhone && (
                <FilterChip label={filters.hasPhone === 'true' ? 'Has Phone' : 'No Phone'} onRemove={() => setFilter('hasPhone', '')} />
              )}
              {filters.hasEmail && (
                <FilterChip label={filters.hasEmail === 'true' ? 'Has Email' : 'No Email'} onRemove={() => setFilter('hasEmail', '')} />
              )}
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 ml-1">
                Clear all
              </button>
            </>
          )}
          <span className="text-xs text-gray-400 ml-1">
            {total.toLocaleString()} lead{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Per page:</label>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Leads Table */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading leads…
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No leads found</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="mt-2 text-xs text-emerald-600 hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <button onClick={() => toggleSort('full_name')} className="flex items-center gap-1 hover:text-gray-800 transition">
                        Name <SortIcon col="full_name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <button onClick={() => toggleSort('source')} className="flex items-center gap-1 hover:text-gray-800 transition">
                        Source <SortIcon col="source" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Campaign</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Ad Set</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <button onClick={() => toggleSort('pipeline_stage')} className="flex items-center gap-1 hover:text-gray-800 transition">
                        Stage <SortIcon col="pipeline_stage" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 hover:text-gray-800 transition">
                        Priority <SortIcon col="priority" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <button onClick={() => toggleSort('lead_score')} className="flex items-center gap-1 hover:text-gray-800 transition">
                        Score <SortIcon col="lead_score" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-gray-800 transition">
                        Created <SortIcon col="created_at" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead.id)}
                      className={`border-b border-gray-50 hover:bg-emerald-50/30 cursor-pointer transition ${
                        selectedLead === lead.id ? 'bg-emerald-50 border-emerald-100' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{lead.full_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {lead.phone && (
                            <span className="text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {lead.phone}
                            </span>
                          )}
                          {lead.email && (
                            <span className="text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="truncate max-w-[140px]">{lead.email}</span>
                            </span>
                          )}
                          {!lead.phone && !lead.email && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{sourceLabel(lead.source)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate" title={lead.campaign_name || ''}>
                        {lead.campaign_name ? (
                          <span className="inline-flex items-center gap-1">
                            <Megaphone className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="truncate">{lead.campaign_name}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate" title={lead.ad_name || ''}>
                        {lead.ad_name ? (
                          <span className="truncate">{lead.ad_name}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${stageInfo(lead.pipeline_stage).color}`}>
                          {stageInfo(lead.pipeline_stage).label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${priorityInfo(lead.priority).color}`}>
                          {priorityInfo(lead.priority).label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${lead.lead_score >= 61 ? 'text-green-600' : lead.lead_score >= 31 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {lead.lead_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap" title={timeAgo(lead.created_at)}>{fmtDateTime(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
                <span>
                  Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} of {total.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)} disabled={page <= 1}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition text-xs"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    let pageNum: number;
                    if (pages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= pages - 2) pageNum = pages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded text-xs transition ${
                          pageNum === page
                            ? 'bg-emerald-600 text-white font-medium'
                            : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(pages)} disabled={page >= pages}
                    className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition text-xs"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lead Detail Drawer — fixed overlay */}
        {selectedLead && leadDetail && (
          <LeadDetailPanel
            detail={leadDetail}
            userEmail={userEmail}
            onClose={() => setSelectedLead(null)}
            onStageChange={(stage) => handleStageChange(selectedLead, stage)}
            onArchive={() => handleArchive(selectedLead)}
            onRefresh={() => fetchLeadDetail(selectedLead)}
            onUpdate={async (fields) => {
              await fetch(`/api/v1/sales/leads/${selectedLead}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
              });
              fetchLeadDetail(selectedLead);
              fetchLeads();
            }}
          />
        )}
      </div>

      {/* Create Lead Modal */}
      {showCreate && (
        <CreateLeadModal
          userEmail={userEmail}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchLeads(); }}
        />
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
      {label}
      <button onClick={onRemove} className="hover:text-red-600 transition">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Lead Detail Drawer (Fixed Slide-Over) ────────────────────

function LeadDetailPanel({
  detail, userEmail, onClose, onStageChange, onArchive, onRefresh, onUpdate,
}: {
  detail: { lead: LeadDetail; activities: Activity[]; reminders: Reminder[] };
  userEmail: string;
  onClose: () => void;
  onStageChange: (stage: string) => void;
  onArchive: () => void;
  onRefresh: () => void;
  onUpdate: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const { lead, activities, reminders } = detail;
  const [activeSection, setActiveSection] = useState<'details' | 'timeline' | 'reminders'>('details');
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [editForm, setEditForm] = useState({
    full_name: lead.full_name,
    phone: lead.phone || '',
    email: lead.email || '',
    whatsapp: lead.whatsapp || '',
    priority: lead.priority,
    student_grade: lead.student_grade || '',
    student_board: lead.student_board || '',
  });

  // Reset form when lead changes
  useEffect(() => {
    setEditForm({
      full_name: lead.full_name,
      phone: lead.phone || '',
      email: lead.email || '',
      whatsapp: lead.whatsapp || '',
      priority: lead.priority,
      student_grade: lead.student_grade || '',
      student_board: lead.student_board || '',
    });
    setEditing(false);
  }, [lead.id, lead.full_name, lead.phone, lead.email, lead.whatsapp, lead.priority, lead.student_grade, lead.student_board]);

  const handleSaveEdit = async () => {
    setSaving(true);
    await onUpdate({
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      email: editForm.email || null,
      whatsapp: editForm.whatsapp || null,
      priority: editForm.priority,
      student_grade: editForm.student_grade || null,
      student_board: editForm.student_board || null,
    });
    setSaving(false);
    setEditing(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  const sectionTab = (key: typeof activeSection, label: string, count?: number) => (
    <button
      onClick={() => setActiveSection(key)}
      className={`px-3 py-2 text-xs font-medium rounded-lg transition ${
        activeSection === key
          ? 'bg-emerald-100 text-emerald-700'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1.5 bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{count}</span>
      )}
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header — Lead Identity */}
        <div className="border-b border-gray-100 px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {lead.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                {editing ? (
                  <input
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    className="text-lg font-bold text-gray-900 border-b-2 border-emerald-400 outline-none bg-transparent w-full"
                  />
                ) : (
                  <h2 className="text-lg font-bold text-gray-900 truncate">{lead.full_name}</h2>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${stageInfo(lead.pipeline_stage).color}`}>
                    {stageInfo(lead.pipeline_stage).label}
                  </span>
                  <span className="text-[10px] text-gray-400">{timeAgo(lead.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={handleSaveEdit} disabled={saving} className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick contact actions */}
          <div className="flex gap-2 mt-2">
            {(lead.phone || editForm.phone) && (
              <a href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
                <PhoneCall className="w-3.5 h-3.5" /> Call
              </a>
            )}
            {(lead.whatsapp || lead.phone) && (
              <a href={`https://wa.me/${(lead.whatsapp || lead.phone || '').replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition">
                <Mail className="w-3.5 h-3.5" /> Email
              </a>
            )}
          </div>
        </div>

        {/* Stage + Priority Row */}
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3 flex-shrink-0">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">Stage</label>
            <select
              value={lead.pipeline_stage}
              onChange={e => onStageChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">Priority</label>
            {editing ? (
              <select
                value={editForm.priority}
                onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            ) : (
              <div className={`px-2.5 py-1.5 text-sm font-medium ${priorityInfo(lead.priority).color}`}>
                {priorityInfo(lead.priority).label}
              </div>
            )}
          </div>
          <div className="w-16 text-center">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">Score</label>
            <div className={`py-1.5 text-sm font-bold ${lead.lead_score >= 61 ? 'text-green-600' : lead.lead_score >= 31 ? 'text-amber-600' : 'text-gray-400'}`}>
              {lead.lead_score}
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="px-5 py-2 border-b border-gray-100 flex gap-1 flex-shrink-0">
          {sectionTab('details', 'Details')}
          {sectionTab('timeline', 'Timeline', activities.length)}
          {sectionTab('reminders', 'Reminders', reminders.filter(r => r.status === 'pending').length)}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Details Section ── */}
          {activeSection === 'details' && (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="space-y-2">
                <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Contact Information</h4>
                {editing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Phone</label>
                      <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="+91..." />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Email</label>
                      <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="email@..." />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">WhatsApp</label>
                      <input value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="WhatsApp" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {lead.phone && (
                      <ContactRow icon={<Phone className="w-3.5 h-3.5 text-blue-500" />} label="Phone" value={lead.phone}
                        onCopy={() => copyToClipboard(lead.phone!, 'phone')} copied={copied === 'phone'} />
                    )}
                    {lead.email && (
                      <ContactRow icon={<Mail className="w-3.5 h-3.5 text-purple-500" />} label="Email" value={lead.email}
                        onCopy={() => copyToClipboard(lead.email!, 'email')} copied={copied === 'email'} />
                    )}
                    {lead.whatsapp && (
                      <ContactRow icon={<MessageCircle className="w-3.5 h-3.5 text-green-500" />} label="WhatsApp" value={lead.whatsapp}
                        onCopy={() => copyToClipboard(lead.whatsapp!, 'wa')} copied={copied === 'wa'} />
                    )}
                    {!lead.phone && !lead.email && !lead.whatsapp && (
                      <p className="text-xs text-gray-400 italic">No contact info available</p>
                    )}
                  </div>
                )}
              </div>

              {/* Academic info */}
              {(lead.student_grade || lead.student_board || (lead.subjects_interested && lead.subjects_interested.length > 0)) && (
                <div className="space-y-2">
                  <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Academic</h4>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Grade</label>
                        <input value={editForm.student_grade} onChange={e => setEditForm(f => ({ ...f, student_grade: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Board</label>
                        <input value={editForm.student_board} onChange={e => setEditForm(f => ({ ...f, student_board: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {lead.student_grade && <InfoChip icon={<Hash className="w-3 h-3" />} label={`Grade ${lead.student_grade}`} />}
                      {lead.student_board && <InfoChip icon={<Tag className="w-3 h-3" />} label={lead.student_board} />}
                      {lead.subjects_interested?.map(subj => <InfoChip key={subj} icon={<Star className="w-3 h-3" />} label={subj} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Source / Campaign info */}
              <div className="space-y-2">
                <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Source</h4>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <span className="font-medium text-gray-700">{sourceLabel(lead.source)}</span>
                  </div>
                  {lead.campaign_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Campaign</span>
                      <span className="font-medium text-gray-700 text-right max-w-[60%] truncate" title={lead.campaign_name}>
                        {lead.campaign_name}
                      </span>
                    </div>
                  )}
                  {lead.ad_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ad</span>
                      <span className="font-medium text-gray-700 text-right max-w-[60%] truncate text-xs" title={lead.ad_name}>
                        {lead.ad_name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span className="font-medium text-gray-700">{fmtDate(lead.created_at)}</span>
                  </div>
                  {lead.updated_at !== lead.created_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Updated</span>
                      <span className="font-medium text-gray-700">{fmtDate(lead.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FB Form Responses */}
              {lead.source_detail && (
                <div className="space-y-2">
                  <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Form Responses</h4>
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-line border border-blue-100">
                    {lead.source_detail}
                  </div>
                </div>
              )}

              {/* UTM Tracking */}
              {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
                <div className="space-y-2">
                  <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">UTM Tracking</h4>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-xs">
                    {lead.utm_source && <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="font-medium">{lead.utm_source}</span></div>}
                    {lead.utm_medium && <div className="flex justify-between"><span className="text-gray-500">Medium</span><span className="font-medium">{lead.utm_medium}</span></div>}
                    {lead.utm_campaign && <div className="flex justify-between"><span className="text-gray-500">Campaign</span><span className="font-medium">{lead.utm_campaign}</span></div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Timeline Section ── */}
          {activeSection === 'timeline' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs text-gray-500 font-medium">{activities.length} activities</h4>
                <button onClick={() => setShowLogActivity(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">
                  <Plus className="w-3 h-3" /> Log Activity
                </button>
              </div>
              {activities.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No activities yet</p>
                  <button onClick={() => setShowLogActivity(true)} className="mt-2 text-xs text-emerald-600 hover:underline">
                    Log first activity
                  </button>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gray-200" />
                  <div className="space-y-4">
                    {activities.map(act => (
                      <div key={act.id} className="flex gap-3 relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          act.activity_type === 'call' ? 'bg-blue-100' :
                          act.activity_type.includes('whatsapp') ? 'bg-green-100' :
                          act.activity_type === 'stage_change' ? 'bg-purple-100' :
                          act.activity_type === 'system' ? 'bg-gray-100' :
                          act.activity_type === 'meeting' ? 'bg-amber-100' :
                          'bg-gray-100'
                        }`}>
                          {act.activity_type === 'call' ? <PhoneCall className="w-3.5 h-3.5 text-blue-600" /> :
                           act.activity_type.includes('whatsapp') ? <MessageCircle className="w-3.5 h-3.5 text-green-600" /> :
                           act.activity_type === 'stage_change' ? <Layers className="w-3.5 h-3.5 text-purple-600" /> :
                           act.activity_type === 'meeting' ? <Calendar className="w-3.5 h-3.5 text-amber-600" /> :
                           <FileText className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-3">
                          <p className="text-sm font-medium text-gray-700">{act.title}</p>
                          {act.description && <p className="text-xs text-gray-500 mt-1">{act.description}</p>}
                          {act.outcome && <p className="text-xs text-emerald-700 mt-1">Outcome: {act.outcome}</p>}
                          <p className="text-[10px] text-gray-400 mt-1.5">{fmtDateTime(act.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Reminders Section ── */}
          {activeSection === 'reminders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs text-gray-500 font-medium">
                  {reminders.filter(r => r.status === 'pending').length} pending
                </h4>
                <button onClick={() => setShowAddReminder(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition">
                  <Plus className="w-3 h-3" /> Add Reminder
                </button>
              </div>
              {reminders.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No reminders set</p>
                  <button onClick={() => setShowAddReminder(true)} className="mt-2 text-xs text-amber-600 hover:underline">
                    Set first reminder
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {reminders.map(r => {
                    const overdue = r.status === 'pending' && new Date(r.due_at) < new Date();
                    const done = r.status === 'completed';
                    return (
                      <div key={r.id} className={`rounded-xl p-3 border ${
                        done ? 'bg-gray-50 border-gray-100 opacity-60' :
                        overdue ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-2">
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            ) : overdue ? (
                              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${done ? 'line-through text-gray-400' : overdue ? 'text-red-700' : 'text-gray-700'}`}>{r.title}</p>
                              {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{fmtDateTime(r.due_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <div className="flex gap-2">
            <button onClick={() => { setActiveSection('timeline'); setShowLogActivity(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition shadow-sm">
              <FileText className="w-3.5 h-3.5" /> Log Activity
            </button>
            <button onClick={() => { setActiveSection('reminders'); setShowAddReminder(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition shadow-sm">
              <Bell className="w-3.5 h-3.5" /> Reminder
            </button>
          </div>
          <button onClick={onArchive}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition">
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>
        </div>

        {/* Inline modals */}
        {showLogActivity && (
          <LogActivityModal
            leadId={lead.id}
            userEmail={userEmail}
            onClose={() => setShowLogActivity(false)}
            onCreated={() => { setShowLogActivity(false); onRefresh(); }}
          />
        )}
        {showAddReminder && (
          <AddReminderModal
            leadId={lead.id}
            userEmail={userEmail}
            onClose={() => setShowAddReminder(false)}
            onCreated={() => { setShowAddReminder(false); onRefresh(); }}
          />
        )}
      </div>
    </>
  );
}

function ContactRow({ icon, label, value, onCopy, copied }: {
  icon: React.ReactNode; label: string; value: string; onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 group transition">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-sm font-medium text-gray-700">{value}</p>
        </div>
      </div>
      <button onClick={onCopy} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
      {icon} {label}
    </span>
  );
}

// ── Create Lead Modal ────────────────────────────────────────

function CreateLeadModal({
  userEmail, onClose, onCreated,
}: {
  userEmail: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', whatsapp: '',
    student_grade: '', student_board: '', source: 'manual',
    priority: 'medium', pipeline_stage: 'new',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/sales/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, assigned_to: userEmail }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="New Lead" maxWidth="lg">
      <FormGrid cols={2}>
        <FormField label="Full Name" required>
          <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Lead full name" />
        </FormField>
        <FormField label="Phone">
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
        </FormField>
        <FormField label="Email">
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@gmail.com" />
        </FormField>
        <FormField label="WhatsApp">
          <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="WhatsApp number" />
        </FormField>
        <FormField label="Grade">
          <Input value={form.student_grade} onChange={e => setForm(f => ({ ...f, student_grade: e.target.value }))} placeholder="e.g., 10" />
        </FormField>
        <FormField label="Board">
          <Select
            value={form.student_board}
            onChange={v => setForm(f => ({ ...f, student_board: v }))}
            options={[{ value: '', label: 'Select board' }, { value: 'CBSE', label: 'CBSE' }, { value: 'ICSE', label: 'ICSE' }, { value: 'State', label: 'State Board' }]}
          />
        </FormField>
        <FormField label="Source">
          <Select
            value={form.source}
            onChange={v => setForm(f => ({ ...f, source: v }))}
            options={SOURCES.map(s => ({ value: s.value, label: s.label }))}
          />
        </FormField>
        <FormField label="Priority">
          <Select
            value={form.priority}
            onChange={v => setForm(f => ({ ...f, priority: v }))}
            options={PRIORITIES.map(p => ({ value: p.value, label: p.label }))}
          />
        </FormField>
      </FormGrid>
      <FormActions onCancel={onClose} onSubmit={handleSave} submitting={saving} submitLabel="Create Lead" />
    </Modal>
  );
}

// ── Log Activity Modal ───────────────────────────────────────

function LogActivityModal({
  leadId, userEmail, onClose, onCreated,
}: {
  leadId: string;
  userEmail: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ activity_type: 'note', title: '', description: '', outcome: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/sales/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, ...form }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Log Activity">
      <div className="space-y-4">
        <FormField label="Type">
          <Select
            value={form.activity_type}
            onChange={v => setForm(f => ({ ...f, activity_type: v }))}
            options={ACTIVITY_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />
        </FormField>
        <FormField label="Title" required>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What happened?" />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details…" rows={3} />
        </FormField>
        <FormField label="Outcome">
          <Input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} placeholder="Result of this interaction" />
        </FormField>
      </div>
      <FormActions onCancel={onClose} onSubmit={handleSave} submitting={saving} submitLabel="Log Activity" />
    </Modal>
  );
}

// ── Add Reminder Modal ───────────────────────────────────────

function AddReminderModal({
  leadId, userEmail, onClose, onCreated,
}: {
  leadId: string;
  userEmail: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: '', description: '', due_at: '', reminder_type: 'follow_up' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim() || !form.due_at) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/sales/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, ...form, assigned_to: userEmail }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Set Reminder">
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Follow up call" />
        </FormField>
        <FormField label="Due At" required>
          <Input type="datetime-local" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} />
        </FormField>
        <FormField label="Type">
          <Select
            value={form.reminder_type}
            onChange={v => setForm(f => ({ ...f, reminder_type: v }))}
            options={[
              { value: 'follow_up', label: 'Follow Up' },
              { value: 'callback', label: 'Callback' },
              { value: 'demo_reminder', label: 'Demo Reminder' },
              { value: 'payment_follow', label: 'Payment Follow-up' },
              { value: 'general', label: 'General' },
            ]}
          />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
        </FormField>
      </div>
      <FormActions onCancel={onClose} onSubmit={handleSave} submitting={saving} submitLabel="Create Reminder" />
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pipeline Tab (Kanban View)
// ═══════════════════════════════════════════════════════════════

function PipelineTab({ userEmail }: { userEmail: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/sales/leads?limit=100');
      const data = await res.json();
      if (data.success) setLeads(data.data.leads);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDrop = async (leadId: string, newStage: string) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: newStage } : l));
    await fetch(`/api/v1/sales/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage }),
    });
  };

  const activeStages = STAGES.filter(s => !['disqualified'].includes(s.value));

  if (loading) return <div className="text-center py-12 text-gray-500">Loading pipeline…</div>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {activeStages.map(stage => {
        const stageLeads = leads.filter(l => l.pipeline_stage === stage.value);
        return (
          <div
            key={stage.value}
            className="flex-shrink-0 w-56 bg-gray-50 rounded-lg"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              const leadId = e.dataTransfer.getData('leadId');
              if (leadId) handleDrop(leadId, stage.value);
            }}
          >
            <div className={`px-3 py-2 rounded-t-lg ${stage.color} flex justify-between items-center`}>
              <span className="text-xs font-semibold">{stage.label}</span>
              <span className="text-xs font-bold">{stageLeads.length}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[200px]">
              {stageLeads.map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('leadId', lead.id)}
                  className="bg-white rounded-lg p-3 shadow-sm border cursor-grab hover:shadow-md transition-shadow"
                >
                  <p className="font-medium text-sm text-gray-800 truncate">{lead.full_name}</p>
                  <p className="text-xs text-gray-400 mt-1">{lead.phone || lead.email || '—'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{sourceLabel(lead.source)}</span>
                    <span className={`text-xs font-bold ${lead.lead_score >= 61 ? 'text-green-600' : lead.lead_score >= 31 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {lead.lead_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Activities Tab
// ═══════════════════════════════════════════════════════════════

function ActivitiesTab({ userEmail }: { userEmail: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '30' });
    if (typeFilter) params.set('type', typeFilter);
    try {
      const res = await fetch(`/api/v1/sales/activities?${params}`);
      const data = await res.json();
      if (data.success) {
        setActivities(data.data.activities);
        setTotal(data.data.pagination.total);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, typeFilter]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Types</option>
          {[...ACTIVITY_TYPES, { value: 'stage_change', label: 'Stage Change' }, { value: 'system', label: 'System' }].map(t =>
            <option key={t.value} value={t.value}>{t.label}</option>
          )}
        </select>
        <span className="text-sm text-gray-400">{total} activities</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No activities found</div>
      ) : (
        <div className="space-y-3">
          {activities.map(act => (
            <div key={act.id} className="flex gap-4 p-3 bg-white border rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                {act.activity_type === 'call' ? <Phone className="w-4 h-4 text-blue-500" /> :
                 act.activity_type.includes('whatsapp') ? <MessageSquare className="w-4 h-4 text-green-600" /> :
                 act.activity_type === 'stage_change' ? <Layers className="w-4 h-4 text-purple-500" /> :
                 act.activity_type === 'system' ? <AlertCircle className="w-4 h-4 text-gray-400" /> :
                 <FileText className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{act.title}</p>
                {act.lead_name && <p className="text-xs text-blue-600">Lead: {act.lead_name}</p>}
                {act.description && <p className="text-sm text-gray-500 mt-1">{act.description}</p>}
                {act.outcome && <p className="text-sm text-green-700 mt-1">Outcome: {act.outcome}</p>}
                <p className="text-xs text-gray-400 mt-1">{fmtDateTime(act.created_at)} · {act.performed_by}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 30 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30">Previous</button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={activities.length < 30}
            className="px-3 py-1 border rounded text-sm disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Reminders Tab
// ═══════════════════════════════════════════════════════════════

function RemindersTab({ userEmail }: { userEmail: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showCreate, setShowCreate] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sales/reminders?filter=${filter}`);
      const data = await res.json();
      if (data.success) setReminders(data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleAction = async (id: string, action: 'complete' | 'cancel') => {
    await fetch('/api/v1/sales/reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    fetchReminders();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Reminder
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No reminders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map(r => {
            const overdue = r.status === 'pending' && new Date(r.due_at) < new Date();
            return (
              <div key={r.id} className={`p-4 border rounded-lg ${overdue ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`font-medium ${overdue ? 'text-red-700' : 'text-gray-800'}`}>{r.title}</p>
                    {r.lead_name && <p className="text-sm text-blue-600 mt-0.5">Lead: {r.lead_name} {r.lead_phone ? `(${r.lead_phone})` : ''}</p>}
                    {r.description && <p className="text-sm text-gray-500 mt-1">{r.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Due: {fmtDateTime(r.due_at)}
                      {overdue && <span className="ml-2 text-red-600 font-medium">OVERDUE</span>}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(r.id, 'complete')}
                        className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      >
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />Complete
                      </button>
                      <button
                        onClick={() => handleAction(r.id, 'cancel')}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {r.status === 'completed' && (
                    <span className="text-xs text-green-600 font-medium">Completed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Reminder Modal (general, no specific lead) */}
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="New Reminder">
          <GeneralReminderForm
            userEmail={userEmail}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchReminders(); }}
          />
        </Modal>
      )}
    </div>
  );
}

function GeneralReminderForm({
  userEmail, onClose, onCreated,
}: {
  userEmail: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: '', description: '', due_at: '', reminder_type: 'general' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim() || !form.due_at) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/sales/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, assigned_to: userEmail }),
      });
      const data = await res.json();
      if (data.success) onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Reminder title" />
        </FormField>
        <FormField label="Due At" required>
          <Input type="datetime-local" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} />
        </FormField>
        <FormField label="Type">
          <Select
            value={form.reminder_type}
            onChange={v => setForm(f => ({ ...f, reminder_type: v }))}
            options={[
              { value: 'follow_up', label: 'Follow Up' },
              { value: 'callback', label: 'Callback' },
              { value: 'demo_reminder', label: 'Demo Reminder' },
              { value: 'payment_follow', label: 'Payment Follow-up' },
              { value: 'general', label: 'General' },
            ]}
          />
        </FormField>
        <FormField label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
        </FormField>
      </div>
      <FormActions onCancel={onClose} onSubmit={handleSave} submitting={saving} submitLabel="Create Reminder" />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Reports Tab
// ═══════════════════════════════════════════════════════════════

function ReportsTab() {
  const [data, setData] = useState<{
    funnel: { pipeline_stage: string; count: number }[];
    sources: { source: string; count: number; converted: number }[];
    dailyTrend: { date: string; count: number }[];
    activitySummary: { activity_type: string; count: number }[];
    avgConversionDays: number | null;
    period: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sales/reports?days=${days}`);
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  if (loading || !data) {
    return <div className="text-center py-12 text-gray-500">Loading reports…</div>;
  }

  const totalLeads = data.funnel.reduce((s, f) => s + f.count, 0);
  const enrolled = data.funnel.find(f => f.pipeline_stage === 'enrolled')?.count || 0;
  const convRate = totalLeads > 0 ? ((enrolled / totalLeads) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-400">Total Leads</p>
          <p className="text-2xl font-bold">{totalLeads}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Enrolled</p>
          <p className="text-2xl font-bold text-green-600">{enrolled}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Conversion Rate</p>
          <p className="text-2xl font-bold text-blue-600">{convRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Avg. Days to Convert</p>
          <p className="text-2xl font-bold">{data.avgConversionDays ?? '—'}</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Conversion Funnel</h3>
          <div className="space-y-2">
            {STAGES.map(stage => {
              const count = data.funnel.find(f => f.pipeline_stage === stage.value)?.count || 0;
              return (
                <div key={stage.value} className="flex items-center gap-3">
                  <span className="text-xs w-28 text-gray-600">{stage.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: totalLeads > 0 ? `${(count / totalLeads) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Source ROI */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Source Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b">
                <th className="pb-2">Source</th>
                <th className="pb-2 text-right">Leads</th>
                <th className="pb-2 text-right">Enrolled</th>
                <th className="pb-2 text-right">Conv %</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map(src => (
                <tr key={src.source} className="border-b last:border-0">
                  <td className="py-2">{sourceLabel(src.source)}</td>
                  <td className="py-2 text-right">{src.count}</td>
                  <td className="py-2 text-right text-green-600">{src.converted}</td>
                  <td className="py-2 text-right font-medium">
                    {src.count > 0 ? ((src.converted / src.count) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Daily trend */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily New Leads</h3>
        {data.dailyTrend.length === 0 ? (
          <p className="text-gray-400 text-sm">No data for this period</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.dailyTrend.map(day => {
              const max = Math.max(...data.dailyTrend.map(d => d.count), 1);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${day.count}`}>
                  <span className="text-[10px] text-gray-400">{day.count}</span>
                  <div
                    className="w-full bg-blue-400 rounded-t min-h-[2px] transition-all"
                    style={{ height: `${(day.count / max) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Activity summary */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Breakdown</h3>
        <div className="flex flex-wrap gap-3">
          {data.activitySummary.map(act => {
            const label = ACTIVITY_TYPES.find(t => t.value === act.activity_type)?.label || act.activity_type;
            return (
              <div key={act.activity_type} className="bg-gray-50 rounded-lg px-4 py-2 text-center">
                <p className="text-lg font-bold text-gray-800">{act.count}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            );
          })}
          {data.activitySummary.length === 0 && <p className="text-gray-400 text-sm">No activities in this period</p>}
        </div>
      </Card>
    </div>
  );
}
