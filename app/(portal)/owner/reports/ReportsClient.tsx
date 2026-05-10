// ═══════════════════════════════════════════════════════════════
// Reports — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  FormPanel, FormField, FormGrid, FormActions,
  Input, Select,
  LoadingState, EmptyState, Badge,
  useToast,
} from '@/components/dashboard/shared';
import {
  BarChart3, FileText, Plus, Calendar,
  TrendingUp, Users, GraduationCap, Briefcase,
  BookOpen, X,
} from 'lucide-react';
import StudentReportsBrowser from '@/components/dashboard/StudentReportsBrowser';

// ── Types ────────────────────────────────────────────────────

interface Report {
  id: string;
  report_type: string;
  title: string;
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const REPORT_TYPES = [
  { value: 'attendance',          label: 'Attendance',          icon: Users,        variant: 'info' as const },
  { value: 'revenue',             label: 'Revenue',             icon: TrendingUp,   variant: 'success' as const },
  { value: 'teacher_performance', label: 'Teacher Performance', icon: BookOpen,      variant: 'primary' as const },
  { value: 'student_progress',    label: 'Student Progress',    icon: GraduationCap, variant: 'primary' as const },
  { value: 'batch_summary',       label: 'Batch Summary',       icon: Calendar,     variant: 'warning' as const },
  { value: 'exam_analytics',      label: 'Exam Analytics',      icon: FileText,     variant: 'danger' as const },
  { value: 'payroll_summary',     label: 'Payroll Summary',     icon: Briefcase,    variant: 'info' as const },
  { value: 'session_report',      label: 'Session Report',      icon: Calendar,     variant: 'info' as const },
  { value: 'parent_monthly',      label: 'Parent Monthly',      icon: Users,        variant: 'primary' as const },
];

const VARIANT_ICON_COLORS: Record<string, string> = {
  primary: 'text-primary',
  success: 'text-primary',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  info: 'text-teal-600',
};

export default function ReportsClient({ userName, userEmail, userRole }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Form
  const [formType, setFormType] = useState('attendance');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [showForm, setShowForm] = useState(false);

  const toast = useToast();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/reports');
      const json = await res.json();
      if (json.success) setReports(json.data?.reports || []);
    } catch (e) { console.error('Failed to load reports', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const generateReport = async () => {
    if (!formType || !formStart || !formEnd) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: formType, periodStart: formStart, periodEnd: formEnd }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        toast.success('Report generated successfully');
        fetchReports();
      } else {
        toast.error(json.error || 'Failed to generate report');
      }
    } catch (e) { console.error('Generate report failed', e); }
    setGenerating(false);
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        <PageHeader icon={BarChart3} title="Reports" subtitle="Generate and review system reports">
          <RefreshButton loading={loading} onClick={fetchReports} />
          <Button variant="primary" icon={Plus} onClick={() => setShowForm(!showForm)}>
            Generate
          </Button>
        </PageHeader>

        {/* Generate Form */}
        {showForm && (
          <FormPanel title="Generate New Report" icon={BarChart3} onClose={() => setShowForm(false)}>
            <FormGrid cols={4}>
              <FormField label="Report Type">
                <Select value={formType} onChange={setFormType}
                  options={REPORT_TYPES.map(rt => ({ value: rt.value, label: rt.label }))} />
              </FormField>
              <FormField label="Period Start">
                <Input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
              </FormField>
              <FormField label="Period End">
                <Input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </FormField>
              <FormActions onCancel={() => setShowForm(false)} onSubmit={generateReport}
                submitLabel="Generate" submitDisabled={!formStart || !formEnd} submitting={generating} />
            </FormGrid>
          </FormPanel>
        )}

        {/* Report Type Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            const iconColor = VARIANT_ICON_COLORS[rt.variant] || 'text-gray-500';
            return (
              <button key={rt.value}
                onClick={() => { setFormType(rt.value); setShowForm(true); }}
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm">
                <Icon className={`h-6 w-6 ${iconColor}`} />
                <span className="text-xs text-gray-600 text-center font-medium">{rt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Report Detail */}
        {selectedReport && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{selectedReport.title}</h3>
              <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-4 overflow-auto max-h-96 border border-gray-100">
              {JSON.stringify(selectedReport.data, null, 2)}
            </pre>
          </div>
        )}

        {/* Student Reports Browser */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Individual Student Reports
          </h3>
          <StudentReportsBrowser />
        </div>

        {/* Report List */}
        {loading ? (
          <LoadingState />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} message="No reports generated yet" />
        ) : (
          <div className="space-y-2">
            {reports.map(report => {
              const rt = REPORT_TYPES.find(r => r.value === report.report_type);
              const Icon = rt?.icon || FileText;
              const iconColor = rt ? (VARIANT_ICON_COLORS[rt.variant] || 'text-gray-400') : 'text-gray-400';
              return (
                <button key={report.id} onClick={() => setSelectedReport(report)}
                  className="w-full flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 text-left transition shadow-sm">
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{report.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(report.period_start).toLocaleDateString('en-IN')} — {new Date(report.period_end).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <Badge label={report.report_type.replace(/_/g, ' ')} variant={rt?.variant || 'default'} />
                  <span className="text-xs text-gray-400">
                    {new Date(report.created_at).toLocaleDateString('en-IN')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
