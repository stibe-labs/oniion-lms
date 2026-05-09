// ═══════════════════════════════════════════════════════════════
// Payroll Management — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  FilterSelect, FormPanel, FormField, FormGrid, FormActions,
  Input,
  TableWrapper, THead, TH, TRow,
  LoadingState, EmptyState, StatusBadge,
  useToast, money,
} from '@/components/dashboard/shared';
import {
  Briefcase, Users, Calendar, DollarSign,
  Plus, Check, ArrowRight, Settings, FileText, Download,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface PayConfig {
  id: string;
  teacher_email: string;
  teacher_name: string | null;
  rate_per_class: number;
  currency: string;
  incentive_rules: { bonus_threshold?: number; bonus_per_class?: number } | null;
  created_at: string;
}

interface PayrollPeriod {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  payslip_count: number;
  total_paise: number;
  created_at: string;
}

interface Payslip {
  id: string;
  payroll_period_id: string;
  teacher_email: string;
  teacher_name: string | null;
  classes_conducted: number;
  classes_cancelled: number;
  classes_missed: number;
  extension_sessions: number;
  base_pay_paise: number;
  incentive_paise: number;
  extension_paise: number;
  lop_paise: number;
  total_paise: number;
  status: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function PayrollClient({ userName, userEmail, userRole }: Props) {
  const [tab, setTab] = useState('periods');
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [configs, setConfigs] = useState<PayConfig[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Create period form
  const [newLabel, setNewLabel] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  // Config form
  const [cfgEmail, setCfgEmail] = useState('');
  const [cfgRate, setCfgRate] = useState('500');
  const [cfgBonus, setCfgBonus] = useState('100');
  const [cfgThreshold, setCfgThreshold] = useState('20');

  const toast = useToast();

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payroll?resource=periods');
      const json = await res.json();
      if (json.success) setPeriods(json.data?.periods || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payroll?resource=configs');
      const json = await res.json();
      if (json.success) setConfigs(json.data?.configs || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchPayslips = useCallback(async (periodId: string) => {
    try {
      const res = await fetch(`/api/v1/payroll?resource=payslips&periodId=${periodId}`);
      const json = await res.json();
      if (json.success) setPayslips(json.data?.payslips || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchPeriods(); fetchConfigs(); }, [fetchPeriods, fetchConfigs]);
  useEffect(() => { if (selectedPeriod) fetchPayslips(selectedPeriod); }, [selectedPeriod, fetchPayslips]);

  const refresh = () => { fetchPeriods(); fetchConfigs(); };

  const createPeriod = async () => {
    if (!newLabel || !newStart || !newEnd) return;
    setActing(true);
    try {
      const res = await fetch('/api/v1/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_period', periodLabel: newLabel, startDate: newStart, endDate: newEnd }),
      });
      const json = await res.json();
      if (json.success) {
        setTab('periods'); setNewLabel(''); setNewStart(''); setNewEnd('');
        toast.success('Payroll period created');
        fetchPeriods();
      } else {
        toast.error(json.error || 'Failed to create period');
      }
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setActing(true);
    try {
      const res = await fetch('/api/v1/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Action "${action.replace('_', ' ')}" completed`);
      } else {
        toast.error(json.error || 'Action failed');
      }
      fetchPeriods();
      if (selectedPeriod) fetchPayslips(selectedPeriod);
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const saveConfig = async () => {
    if (!cfgEmail) return;
    setActing(true);
    try {
      const res = await fetch('/api/v1/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_config',
          teacherEmail: cfgEmail,
          ratePerClass: Number(cfgRate) * 100,
          incentiveRules: {
            bonus_per_class: Number(cfgBonus) * 100,
            bonus_threshold: Number(cfgThreshold),
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCfgEmail('');
        toast.success('Pay config saved');
        fetchConfigs();
      } else {
        toast.error(json.error || 'Failed to save config');
      }
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const period = periods.find(p => p.id === selectedPeriod);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        <PageHeader icon={Briefcase} title="Payroll" subtitle="Manage teacher pay, generate payslips">
          <RefreshButton loading={loading} onClick={refresh} />
        </PageHeader>

        {/* Section selector */}
        <FilterSelect
          value={tab}
          onChange={setTab}
          options={[{ value: 'periods', label: 'Payroll Periods' }, { value: 'configs', label: 'Pay Configs' }, { value: 'create', label: 'New Period' }]}
        />

        {/* Create Period */}
        {tab === 'create' && (
          <FormPanel title="Create Payroll Period" icon={Plus} onClose={() => setTab('periods')}>
            <FormGrid cols={3}>
              <FormField label="Label">
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. June 2025" />
              </FormField>
              <FormField label="Start Date">
                <Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} />
              </FormField>
              <FormField label="End Date">
                <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
              </FormField>
            </FormGrid>
            <FormActions onCancel={() => setTab('periods')} onSubmit={createPeriod}
              submitLabel="Create Period" submitDisabled={!newLabel || !newStart || !newEnd} submitting={acting} />
          </FormPanel>
        )}

        {/* Pay Configs */}
        {tab === 'configs' && (
          <div className="space-y-4">
            <FormPanel title="Set Teacher Pay Config" icon={Settings} onClose={() => setTab('periods')}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <FormField label="Teacher Email">
                  <Input value={cfgEmail} onChange={e => setCfgEmail(e.target.value)} placeholder="teacher@example.com" />
                </FormField>
                <FormField label="Per Session (₹)">
                  <Input type="number" value={cfgRate} onChange={e => setCfgRate(e.target.value)} />
                </FormField>
                <FormField label="Bonus / Session (₹)">
                  <Input type="number" value={cfgBonus} onChange={e => setCfgBonus(e.target.value)} />
                </FormField>
                <FormField label="Bonus Threshold">
                  <Input type="number" value={cfgThreshold} onChange={e => setCfgThreshold(e.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button variant="primary" onClick={saveConfig} loading={acting} className="w-full">
                    Save
                  </Button>
                </div>
              </div>
            </FormPanel>

            {configs.length === 0 ? (
              <EmptyState icon={Settings} message="No pay configs set yet" />
            ) : (
              <TableWrapper>
                <THead>
                  <TH>Teacher</TH>
                  <TH>Per Session</TH>
                  <TH>Bonus / Session</TH>
                  <TH>Threshold</TH>
                </THead>
                <tbody>
                  {configs.map(c => (
                    <TRow key={c.id}>
                      <td className="px-4 py-3 text-gray-800 text-sm">{c.teacher_name || c.teacher_email}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{money(c.rate_per_class)}</td>
                      <td className="px-4 py-3 text-teal-700 font-medium">{money(c.incentive_rules?.bonus_per_class ?? 0)}</td>
                      <td className="px-4 py-3 text-gray-600">{c.incentive_rules?.bonus_threshold ?? '—'} sessions</td>
                    </TRow>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </div>
        )}

        {/* Periods */}
        {tab === 'periods' && (
          <div className="space-y-4">
            {loading ? (
              <LoadingState />
            ) : periods.length === 0 ? (
              <EmptyState icon={FileText} message="No payroll periods yet. Create one to get started." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {periods.map(p => (
                  <div key={p.id}
                    onClick={() => setSelectedPeriod(p.id)}
                    className={`rounded-xl border p-4 transition cursor-pointer shadow-sm ${
                      selectedPeriod === p.id
                        ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-200'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{p.period_label}</h4>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(p.period_start).toLocaleDateString('en-IN')} — {new Date(p.period_end).toLocaleDateString('en-IN')}
                    </p>
                    <div className="flex justify-between mt-3 text-xs">
                      <span className="text-gray-500"><Users className="h-3 w-3 inline mr-1" />{p.payslip_count} payslips</span>
                      <span className="text-green-700 font-semibold">{money(Number(p.total_paise) || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payslip detail for selected period */}
            {selectedPeriod && period && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{period.period_label} — Payslips</h3>
                  <div className="flex gap-2">
                    {period.status === 'draft' && (
                      <>
                        <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => doAction('generate', { periodId: selectedPeriod })} loading={acting}>
                          Generate
                        </Button>
                        <Button variant="primary" size="sm" icon={Check} onClick={() => doAction('finalize', { periodId: selectedPeriod })} loading={acting}>
                          Finalize
                        </Button>
                      </>
                    )}
                    {period.status === 'finalized' && (
                      <Button variant="success" size="sm" icon={DollarSign} onClick={() => doAction('mark_paid', { periodId: selectedPeriod })} loading={acting}>
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>

                {payslips.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No payslips. Click &quot;Generate&quot; to compute.</p>
                ) : (
                  <TableWrapper>
                    <THead>
                      <TH>Teacher</TH>
                      <TH className="text-center">Sessions</TH>
                      <TH className="text-center">Extensions</TH>
                      <TH className="text-center">Missed</TH>
                      <TH className="text-right">Base</TH>
                      <TH className="text-right">Extension</TH>
                      <TH className="text-right">Incentive</TH>
                      <TH className="text-right">LOP</TH>
                      <TH className="text-right">Total</TH>
                      <TH className="text-center">Status</TH>
                      <TH className="text-center">Payslip</TH>
                    </THead>
                    <tbody>
                      {payslips.map(s => (
                        <TRow key={s.id}>
                          <td className="px-3 py-2 text-gray-800 text-xs">{s.teacher_name || s.teacher_email}</td>
                          <td className="px-3 py-2 text-center text-gray-700">{s.classes_conducted}</td>
                          <td className="px-3 py-2 text-center text-teal-600">{s.extension_sessions || 0}</td>
                          <td className="px-3 py-2 text-center text-red-600">{s.classes_missed}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{money(s.base_pay_paise)}</td>
                          <td className="px-3 py-2 text-right text-teal-700">{money(s.extension_paise || 0)}</td>
                          <td className="px-3 py-2 text-right text-green-700">{money(s.incentive_paise)}</td>
                          <td className="px-3 py-2 text-right text-red-600">-{money(s.lop_paise)}</td>
                          <td className="px-3 py-2 text-right text-gray-900 font-semibold">{money(s.total_paise)}</td>
                          <td className="px-3 py-2 text-center"><StatusBadge status={s.status} /></td>
                          <td className="px-3 py-2 text-center">
                            <a href={`/api/v1/payroll/payslip-pdf/${s.id}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                              <Download className="h-3 w-3" /> View
                            </a>
                          </td>
                        </TRow>
                      ))}
                    </tbody>
                  </TableWrapper>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
