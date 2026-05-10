// ═══════════════════════════════════════════════════════════════
// Fees & Invoices — Client Component
// Session-based fee model: per-session rates, not period billing
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  FilterSelect, FormPanel, FormField, FormGrid, FormActions,
  Input, Select,
  TableWrapper, THead, TH, TRow,
  StatCardSmall,
  LoadingState, EmptyState, StatusBadge, Badge, Alert,
  useToast, money,
} from '@/components/dashboard/shared';
import {
  CreditCard, Receipt, Plus, Trash2, Pencil, Check as CheckIcon,
  IndianRupee, Clock, AlertCircle, Download, ExternalLink,
  CheckCircle, Send, Loader2, Tag, ToggleLeft, ToggleRight, CalendarClock,
} from 'lucide-react';
import { FeeBreakdownCard } from '@/components/dashboard/FeeBreakdownCard';
import { parseDescription } from '@/lib/invoice-description';

/** Render a parsed description as formatted inline text (for table cells / headers) */
function DescriptionDisplay({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  const parsed = parseDescription(text);
  if (!parsed) return <span className={`line-clamp-2 ${className}`}>{text || '—'}</span>;
  return (
    <div className={className}>
      <span className="text-gray-900 font-medium">{parsed.header}</span>
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
        {parsed.items.map((li, i) => (
          <span key={i} className="text-gray-500 text-[11px]">
            {li.subject}: <span className="text-gray-700 font-medium">{li.sessions}</span> @ {li.rate}
          </span>
        ))}
      </span>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  student_email: string;
  student_name: string | null;
  description: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  batch_session_id: string | null;
  schedule_group_id: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function FeesClient({ userName, userEmail, userRole }: Props) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('section') === 'enrollment' ? 'enrollment' : 'invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Bulk invoice selection state
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const toggleInvoice = (id: string) => setSelectedInvoices(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAllInvoices = () => {
    if (selectedInvoices.size === invoices.length) setSelectedInvoices(new Set());
    else setSelectedInvoices(new Set(invoices.map(i => i.id)));
  };
  const bulkDeleteInvoices = async () => {
    if (selectedInvoices.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/v1/payment/invoices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedInvoices) }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${json.data.deleted} invoice${json.data.deleted > 1 ? 's' : ''} hidden from dashboard`);
        setSelectedInvoices(new Set());
        setConfirmBulkDelete(false);
        fetchInvoices();
      } else toast.error(json.error || 'Failed to delete');
    } catch { toast.error('Network error'); }
    setBulkDeleting(false);
  };

  const toast = useToast();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payment/invoices');
      const json = await res.json();
      if (json.success) setInvoices(json.data?.invoices || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const refresh = () => { fetchInvoices(); };

  const sendReminder = async (invoiceId: string) => {
    setSendingReminder(invoiceId);
    try {
      const res = await fetch('/api/v1/payment/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Reminder sent to ${json.data.count} recipient(s)`);
      } else {
        toast.error(json.error || 'Failed to send reminder');
      }
    } catch { toast.error('Network error'); }
    setSendingReminder(null);
  };

  // Stats
  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount_paise, 0);
  const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((a, i) => a + i.amount_paise, 0);
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + i.amount_paise, 0);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        <PageHeader icon={CreditCard} title="Fees & Invoices" subtitle="Per-session fee rates and payment tracking">
          <RefreshButton loading={loading} onClick={refresh} />
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSmall icon={IndianRupee} label="Collected" value={money(totalRevenue)} variant="success" />
          <StatCardSmall icon={Clock} label="Pending" value={money(pendingAmount)} variant="warning" />
          <StatCardSmall icon={AlertCircle} label="Overdue" value={money(overdueAmount)} variant="danger" />
        </div>

        {/* Section selector */}
        <FilterSelect
          value={tab}
          onChange={setTab}
          options={[{ value: 'invoices', label: 'All Invoices' }, { value: 'enrollment', label: 'Enrollment Fees' }]}
        />


        {/* Session Invoices */}
        {tab === 'invoices' && (
          loading ? (
            <LoadingState />
          ) : invoices.length === 0 ? (
            <EmptyState icon={Receipt} message="No session invoices found" />
          ) : (
            <>
              {/* Bulk action bar */}
              {selectedInvoices.size > 0 && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-3">
                  <span className="text-sm font-medium text-red-800">
                    {selectedInvoices.size} invoice{selectedInvoices.size > 1 ? 's' : ''} selected
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setSelectedInvoices(new Set())}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-white transition">
                      Clear
                    </button>
                    {confirmBulkDelete ? (
                      <>
                        <span className="text-xs text-red-600 font-medium">Hide from dashboard? Students/parents will still see them.</span>
                        <button onClick={bulkDeleteInvoices} disabled={bulkDeleting}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition">
                          {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> : <Trash2 className="h-3.5 w-3.5 inline mr-1" />}
                          Hide {selectedInvoices.size}
                        </button>
                        <button onClick={() => setConfirmBulkDelete(false)}
                          className="px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-white transition">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmBulkDelete(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 transition">
                        <Trash2 className="h-3.5 w-3.5" /> Hide Selected
                      </button>
                    )}
                  </div>
                </div>
              )}
              <TableWrapper footer={<><span>Showing {invoices.length} invoices</span><span>{invoices.filter(i => i.status === 'paid').length} paid</span></>}>
                <THead>
                  <TH className="w-10">
                    <input type="checkbox" checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                      onChange={toggleAllInvoices}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                  </TH>
                  <TH>Student</TH>
                  <TH>Description</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="text-center">Status</TH>
                  <TH>Due Date</TH>
                  <TH>Paid At</TH>
                  <TH className="text-center">Actions</TH>
                </THead>
                <tbody>
                  {invoices.map(inv => (
                    <TRow key={inv.id} className={selectedInvoices.has(inv.id) ? 'bg-red-50/50' : ''}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedInvoices.has(inv.id)}
                          onChange={() => toggleInvoice(inv.id)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 text-gray-800 text-xs">
                        <span className="font-medium">{inv.student_name || inv.student_email}</span>
                        {inv.student_name && <span className="block text-gray-400">{inv.student_email}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-sm">
                        <DescriptionDisplay text={inv.description} />
                      </td>
                      <td className="px-4 py-3 text-right text-primary font-medium">{money(inv.amount_paise, inv.currency)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={inv.status} icon={inv.status === 'paid' ? CheckCircle : inv.status === 'overdue' ? AlertCircle : Clock} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inv.due_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <a href={`/api/v1/payment/invoice-pdf/${inv.id}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mr-2">
                          <Download className="h-3 w-3" /> Invoice
                        </a>
                        {inv.status === 'paid' && (
                          <a href={`/api/v1/payment/receipt/${inv.id}?type=invoice`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary">
                            <ExternalLink className="h-3 w-3" /> Receipt
                          </a>
                        )}
                        {(inv.status === 'pending' || inv.status === 'overdue') && (
                          <button
                            onClick={() => sendReminder(inv.id)}
                            disabled={sendingReminder === inv.id}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 disabled:opacity-50 ml-2"
                          >
                            {sendingReminder === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Remind
                          </button>
                        )}
                      </td>
                    </TRow>
                  ))}
                </tbody>
              </TableWrapper>
            </>  
          )
        )}

        {/* ── Enrollment Fees Tab ── */}
        {tab === 'enrollment' && <EnrollmentFeesTab />}
      </div>
    </DashboardShell>
  );
}

// ── Enrollment Fees Sub-Component ──────────────────────────────

interface FeeRow {
  id: string;
  region_group: string;
  board: string;
  batch_type: string;
  grade: string;
  fee_paise: number;
  early_bird_fee_paise: number | null;
  fee_unit: string;
  currency: string;
  offer_label: string | null;
  offer_expires_at: string | null;
  show_per_class_only: boolean;
  is_active: boolean;
  // batch_flat fields (null for standard fees)
  fee_type?: string;
  batch_name?: string | null;
  payment_gate_enabled?: boolean;
  applicable_grades?: string[];
  applicable_regions?: string[];
  applicable_boards?: string[];
}

const BT_LABELS: Record<string, string> = {
  one_to_one: '1:1 Individual',
  one_to_three: '1:3 Small Group',
  one_to_fifteen: '1:15 Group',
  one_to_many: '1:M Large Class',
  one_to_thirty: '1:30 Large Group',
  lecture: 'Lecture',
  improvement_batch: 'Improvement Batch',
  custom: 'Custom / Special',
  special: 'Special Batch',
  all: 'All Batch Types',
};

const PER_CLASS_TYPES = new Set(['one_to_one', 'one_to_three']);

function isOfferExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function EnrollmentFeesTab() {
  const toast = useToast();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [batchFlatRows, setBatchFlatRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formRegion, setFormRegion] = useState('Kerala');
  const [formBoard, setFormBoard] = useState('CBSE');
  const [formBatchType, setFormBatchType] = useState('one_to_one');
  const [formGrade, setFormGrade] = useState('10');
  const [formFee, setFormFee] = useState('');
  const [formEarlyBird, setFormEarlyBird] = useState('');
  const [formUnit, setFormUnit] = useState('per_class');
  const [formCurrency, setFormCurrency] = useState('INR');
  const [formOfferLabel, setFormOfferLabel] = useState('Launching Offer');
  const [formOfferExpiry, setFormOfferExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Special / Improvement batch flat fee form state ──
  const [showFlatForm, setShowFlatForm] = useState(false);
  const [flatEditId, setFlatEditId] = useState<string | null>(null);
  const [flatBatchName, setFlatBatchName] = useState('');
  const [flatBatchType, setFlatBatchType] = useState('improvement_batch');
  const [flatFee, setFlatFee] = useState('');
  const [flatCurrency, setFlatCurrency] = useState('INR');
  const [flatNotes, setFlatNotes] = useState('');
  const [flatGate, setFlatGate] = useState(false);
  const [flatGrades, setFlatGrades] = useState<string[]>([]);
  const [flatRegions, setFlatRegions] = useState<string[]>([]);
  const [flatBoards, setFlatBoards] = useState<string[]>([]);
  const [flatSaving, setFlatSaving] = useState(false);
  const [togglingGateId, setTogglingGateId] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payment/enrollment-fees');
      const json = await res.json();
      if (json.success) {
        setRows(json.data.fees || []);
        setBatchFlatRows(json.data.batch_flat_fees || []);
      }
    } catch { toast.error('Failed to load enrollment fees'); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  // Offer control
  const [offerExpiry, setOfferExpiry] = useState('');
  const [offerPatching, setOfferPatching] = useState(false);

  const patchOffer = async (action: 'end_now' | 'set_expiry' | 'reenable', expiry?: string) => {
    setOfferPatching(true);
    try {
      const body: Record<string, string> = { action };
      if (expiry) body.offer_expires_at = expiry;
      const res = await fetch('/api/v1/payment/enrollment-fees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(action === 'end_now' ? 'Offer ended' : action === 'reenable' ? 'Offer re-enabled' : 'Offer expiry set');
        fetchFees();
      } else toast.error(json.error || 'Failed');
    } catch { toast.error('Network error'); }
    setOfferPatching(false);
  };

  const resetForm = () => {
    setEditId(null);
    setFormRegion('Kerala');
    setFormBoard('CBSE');
    setFormBatchType('one_to_one');
    setFormGrade('10');
    setFormFee('');
    setFormEarlyBird('');
    setFormUnit('per_class');
    setFormCurrency('INR');
    setFormOfferLabel('Launching Offer');
    setFormOfferExpiry('');
  };

  const resetFlatForm = () => {
    setFlatEditId(null);
    setFlatBatchName('');
    setFlatBatchType('improvement_batch');
    setFlatFee('');
    setFlatCurrency('INR');
    setFlatNotes('');
    setFlatGate(false);
    setFlatGrades([]);
    setFlatRegions([]);
    setFlatBoards([]);
  };

  const saveFlatFee = async () => {
    const num = Number(flatFee);
    if (!flatBatchName.trim()) { toast.error('Enter a batch name'); return; }
    if (isNaN(num) || num <= 0) { toast.error('Enter a valid positive fee'); return; }
    setFlatSaving(true);
    try {
      const res = await fetch('/api/v1/payment/enrollment-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(flatEditId ? { id: flatEditId } : {}),
          academic_year: '2026-27',
          fee_type: 'batch_flat',
          batch_type: flatBatchType,
          batch_name: flatBatchName.trim(),
          fee_paise: Math.round(num * 100),
          currency: flatCurrency,
          notes: flatNotes || null,
          payment_gate_enabled: flatGate,
          applicable_grades:  flatGrades.length  ? flatGrades  : ['all'],
          applicable_regions: flatRegions.length ? flatRegions : ['all'],
          applicable_boards:  flatBoards.length  ? flatBoards  : ['all'],
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(flatEditId ? 'Batch fee updated' : 'Batch fee added');
        setShowFlatForm(false);
        resetFlatForm();
        fetchFees();
      } else toast.error(json.error || 'Save failed');
    } catch { toast.error('Network error'); }
    setFlatSaving(false);
  };

  const toggleGate = async (id: string) => {
    setTogglingGateId(id);
    try {
      const res = await fetch('/api/v1/payment/enrollment-fees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_gate', id }),
      });
      const json = await res.json();
      if (json.success) {
        const enabled = json.data.payment_gate_enabled;
        toast.success(enabled ? 'Payment gate enabled — students must pay before joining' : 'Payment gate disabled — students enter freely');
        fetchFees();
      } else toast.error(json.error || 'Failed');
    } catch { toast.error('Network error'); }
    setTogglingGateId(null);
  };

  // Auto-set fee unit when batch type changes
  const handleBatchTypeChange = (bt: string) => {
    setFormBatchType(bt);
    if (PER_CLASS_TYPES.has(bt)) setFormUnit('per_class');
    else if (bt === 'one_to_fifteen' || bt === 'one_to_many' || bt === 'one_to_thirty') setFormUnit('monthly');
    else setFormUnit('annual');
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (row: FeeRow) => {
    setEditId(row.id);
    setFormRegion(row.region_group);
    setFormBoard(row.board);
    setFormBatchType(row.batch_type);
    setFormGrade(row.grade);
    setFormFee(String(row.fee_paise / 100));
    setFormEarlyBird(row.early_bird_fee_paise ? String(row.early_bird_fee_paise / 100) : '');
    setFormUnit(row.fee_unit);
    setFormCurrency(row.currency);
    setFormOfferLabel(row.offer_label || 'Launching Offer');
    setFormOfferExpiry(row.offer_expires_at ? row.offer_expires_at.slice(0, 10) : '');
    setShowForm(true);
  };

  const saveFee = async () => {
    const num = Number(formFee);
    if (isNaN(num) || num <= 0) { toast.error('Enter a valid positive fee'); return; }
    setSaving(true);
    try {
      const ebNum = formEarlyBird ? Number(formEarlyBird) : null;
      const res = await fetch('/api/v1/payment/enrollment-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editId ? { id: editId } : {}),
          academic_year: '2026-27',
          region_group: formRegion,
          board: formBoard,
          batch_type: formBatchType,
          grade: formGrade,
          fee_paise: Math.round(num * 100),
          early_bird_fee_paise: ebNum && ebNum > 0 ? Math.round(ebNum * 100) : null,
          fee_unit: formUnit,
          currency: formCurrency,
          offer_label: formOfferLabel || null,
          offer_expires_at: formOfferExpiry || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editId ? 'Fee updated' : 'Fee added');
        setShowForm(false);
        resetForm();
        fetchFees();
      } else toast.error(json.error || 'Save failed');
    } catch { toast.error('Network error'); }
    setSaving(false);
  };

  const deleteFee = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/payment/enrollment-fees?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { toast.success('Fee removed'); fetchFees(); }
      else toast.error(json.error || 'Delete failed');
    } catch { toast.error('Network error'); }
    setDeletingId(null);
  };

  // Group by region + board
  const categories = Array.from(new Set(rows.map(r => `${r.region_group}|${r.board}`)));

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Enrollment Fee Structure — 2026-27</h3>
          <p className="text-xs text-gray-500 mt-0.5">Fees by region, board, batch type, and grade. Early bird prices shown to students.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" label={`${rows.length} rate${rows.length !== 1 ? 's' : ''}`} />
          <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>Add Fee</Button>
        </div>
      </div>

      {/* ── Launching Offer Control ── */}
      {(() => {
        const offerRows = rows.filter(r => r.early_bird_fee_paise);
        if (offerRows.length === 0) return null;
        const now = new Date();
        const anyActive = offerRows.some(r => !r.offer_expires_at || new Date(r.offer_expires_at) > now);
        const anyExpired = offerRows.some(r => r.offer_expires_at && new Date(r.offer_expires_at) <= now);
        const sampleExpiry = offerRows.find(r => r.offer_expires_at)?.offer_expires_at;
        const offerLabel = offerRows[0]?.offer_label || 'Launching Offer';

        return (
          <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
            anyActive ? 'border-primary/20 bg-primary/5' : 'border-red-100 bg-red-50'
          }`}>
            {/* Status */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Tag className={`w-4 h-4 shrink-0 ${anyActive ? 'text-primary' : 'text-red-500'}`} />
              <div>
                <p className="text-sm font-semibold text-gray-800">{offerLabel}</p>
                <p className={`text-xs font-medium ${anyActive ? 'text-primary' : 'text-red-600'}`}>
                  {anyActive ? 'Active' : 'Ended'}
                  {sampleExpiry && anyActive && (
                    <> · expires {new Date(sampleExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                  {anyExpired && !anyActive && sampleExpiry && (
                    <> · ended {new Date(sampleExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Set end date */}
              <div className="flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-gray-500" />
                <input
                  type="date"
                  value={offerExpiry}
                  onChange={e => setOfferExpiry(e.target.value)}
                  className="h-8 text-xs border border-gray-300 rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
                <button
                  disabled={!offerExpiry || offerPatching}
                  onClick={() => { patchOffer('set_expiry', offerExpiry); setOfferExpiry(''); }}
                  className="h-8 px-3 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition"
                >
                  Set End Date
                </button>
              </div>

              {/* Toggle */}
              {anyActive ? (
                <button
                  disabled={offerPatching}
                  onClick={() => patchOffer('end_now')}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 transition"
                >
                  {offerPatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <ToggleRight className="w-3.5 h-3.5" />}
                  End Offer Now
                </button>
              ) : (
                <button
                  disabled={offerPatching}
                  onClick={() => patchOffer('reenable')}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-primary/20 text-primary bg-white hover:bg-primary/5 disabled:opacity-40 transition"
                >
                  {offerPatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  Re-enable Offer
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add / Edit Form */}
      {showForm && (
        <FormPanel title={editId ? 'Edit Enrollment Fee' : 'Add Enrollment Fee'} onClose={() => { setShowForm(false); resetForm(); }}>
          <FormGrid cols={4}>
            <FormField label="Region">
              <Select value={formRegion} onChange={setFormRegion} options={[
                { value: 'Kerala', label: 'Kerala' },
                { value: 'GCC', label: 'GCC' },
              ]} />
            </FormField>
            <FormField label="Board">
              <Select value={formBoard} onChange={setFormBoard} options={[
                { value: 'CBSE', label: 'CBSE' },
                { value: 'State Board', label: 'State Board' },
              ]} />
            </FormField>
            <FormField label="Batch Type">
              <Select value={formBatchType} onChange={handleBatchTypeChange} options={[
                { value: 'one_to_one', label: '1:1 — Individual' },
                { value: 'one_to_three', label: '1:3 — Small Group' },
                { value: 'one_to_fifteen', label: '1:15 — Group Class' },
                { value: 'one_to_thirty', label: '1:30 — Large Group' },
                { value: 'lecture', label: 'Lecture' },
                { value: 'improvement_batch', label: 'Improvement Batch' },
                { value: 'custom', label: 'Custom / Special' },
              ]} />
            </FormField>
            <FormField label="Grade">
              <Select value={formGrade} onChange={setFormGrade} options={
                ['8', '9', '10', 'HSS'].map(g => ({ value: g, label: g === 'HSS' ? 'HSS (Class 11 & 12)' : `Class ${g}` }))
              } />
            </FormField>
            <FormField label={`Annual Fee (${formCurrency}) — Original`} hint="Shown crossed-out to students">
              <Input type="number" placeholder="e.g. 800" value={formFee} onChange={e => setFormFee(e.target.value)} />
            </FormField>
            <FormField label={`Early Bird Fee (${formCurrency})`} hint="Offer price shown to students">
              <Input type="number" placeholder="e.g. 700" value={formEarlyBird} onChange={e => setFormEarlyBird(e.target.value)} />
            </FormField>
            <FormField label="Fee Unit">
              <Select value={formUnit} onChange={setFormUnit} options={[
                { value: 'per_class', label: 'Per Class' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'annual', label: 'Annual' },
                { value: 'session', label: 'Per Session (legacy)' },
              ]} />
            </FormField>
            <FormField label="Currency">
              <Select value={formCurrency} onChange={setFormCurrency} options={
                ['INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'].map(c => ({ value: c, label: c }))
              } />
            </FormField>
            <FormField label="Offer Label">
              <Input placeholder="e.g. Launching Offer" value={formOfferLabel} onChange={e => setFormOfferLabel(e.target.value)} />
            </FormField>
            <FormField label="Offer Expiry Date">
              <Input type="date" value={formOfferExpiry} onChange={e => setFormOfferExpiry(e.target.value)} />
            </FormField>
          </FormGrid>
          {PER_CLASS_TYPES.has(formBatchType) && (
            <Alert variant="info" message="1:1 and 1:3 fees are shown as per-class only — total is never displayed to students." />
          )}
          <FormActions>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button variant="primary" size="sm" icon={CheckIcon} loading={saving} onClick={saveFee}>
              {editId ? 'Update' : 'Add'} Fee
            </Button>
          </FormActions>
        </FormPanel>
      )}

      {rows.length === 0 && !showForm && (
        <EmptyState icon={IndianRupee} message="No enrollment fees configured. Click 'Add Fee' to set up the fee structure." />
      )}

      {categories.map(cat => {
        const [rg, bd] = cat.split('|');
        const catRows = rows.filter(r => r.region_group === rg && r.board === bd);
        const batchTypes = Array.from(new Set(catRows.map(r => r.batch_type)));
        const gradeOrder = (g: string) => g === 'HSS' ? 99 : Number(g);
        const grades = Array.from(new Set(catRows.map(r => r.grade))).sort((a, b) => gradeOrder(a) - gradeOrder(b));

        return (
          <div key={cat} className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{rg}</span>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-600">{bd}</span>
            </div>
            <TableWrapper>
              <THead>
                <TH>Grade</TH>
                {batchTypes.map(bt => <TH key={bt}>{BT_LABELS[bt] || bt}</TH>)}
              </THead>
              <tbody>
                {grades.map(g => (
                  <TRow key={g}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{g === 'HSS' ? 'HSS (11 & 12)' : `Class ${g}`}</td>
                    {batchTypes.map(bt => {
                      const fee = catRows.find(r => r.batch_type === bt && r.grade === g);
                      if (!fee) return <td key={bt} className="px-4 py-3 text-gray-300 text-sm">—</td>;

                      return (
                        <td key={bt} className="px-4 py-3 text-sm">
                          <div className="group flex flex-col gap-1">
                            <FeeBreakdownCard feeRow={fee} compact />
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                              <button onClick={() => openEdit(fee)} className="text-gray-400 hover:text-blue-600" title="Edit">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={() => deleteFee(fee.id)} disabled={deletingId === fee.id} className="text-gray-400 hover:text-red-600" title="Delete">
                                {deletingId === fee.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </TRow>
                ))}
              </tbody>
            </TableWrapper>
          </div>
        );
      })}

      {/* ── Special / Improvement Batch Fees ── */}
      <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Special &amp; Improvement Batch Fees</p>
            <p className="text-xs text-gray-500 mt-0.5">Flat one-time fees for improvement, crash course, or special batches. Optional payment gate blocks class entry until paid.</p>
          </div>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => { resetFlatForm(); setShowFlatForm(true); }}>Add Batch Fee</Button>
        </div>

        {showFlatForm && (
          <div className="px-4 py-4 border-b border-indigo-100 bg-white">
            <p className="text-xs font-semibold text-gray-700 mb-3">{flatEditId ? 'Edit Batch Fee' : 'New Special Batch Fee'}</p>
            <FormGrid cols={4}>
              <FormField label="Batch Name" hint="Displayed to students at payment">
                <Input placeholder="e.g. Improvement Batch — Maths Grade 10" value={flatBatchName} onChange={e => setFlatBatchName(e.target.value)} />
              </FormField>
              <FormField label="Batch Type">
                <Select value={flatBatchType} onChange={setFlatBatchType} options={[
                  { value: 'improvement_batch', label: 'Improvement Batch' },
                  { value: 'special', label: 'Special Batch' },
                  { value: 'custom', label: 'Custom / Special' },
                  { value: 'lecture', label: 'Lecture Series' },
                  { value: 'one_to_one', label: '1:1 — Individual' },
                  { value: 'one_to_three', label: '1:3 — Small Group' },
                  { value: 'one_to_fifteen', label: '1:15 — Group Class' },
                  { value: 'one_to_thirty', label: '1:30 — Large Group' },
                  { value: 'one_to_many', label: '1:M — Large Class' },
                  { value: 'all', label: 'All Batch Types' },
                ]} />
              </FormField>
              <FormField label="One-Time Fee">
                <Input type="number" placeholder="e.g. 2500" value={flatFee} onChange={e => setFlatFee(e.target.value)} />
              </FormField>
              <FormField label="Currency">
                <Select value={flatCurrency} onChange={setFlatCurrency} options={
                  ['INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'].map(c => ({ value: c, label: c }))
                } />
              </FormField>
              <FormField label="Notes" hint="Internal notes only">
                <Input placeholder="Optional internal note" value={flatNotes} onChange={e => setFlatNotes(e.target.value)} />
              </FormField>
            </FormGrid>

            {/* Applicability multi-selects */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              {/* Grades */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Applicable Grades <span className="text-gray-400 font-normal">(leave blank = all)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {['8', '9', '10', '11', '12'].map(g => (
                    <button key={g} type="button"
                      onClick={() => setFlatGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                        flatGrades.includes(g) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}>
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>
              {/* Regions */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Applicable Regions <span className="text-gray-400 font-normal">(leave blank = all)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {['Kerala', 'GCC'].map(r => (
                    <button key={r} type="button"
                      onClick={() => setFlatRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                        flatRegions.includes(r) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {/* Boards */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">Applicable Boards <span className="text-gray-400 font-normal">(leave blank = all)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {['CBSE', 'State Board'].map(b => (
                    <button key={b} type="button"
                      onClick={() => setFlatBoards(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                        flatBoards.includes(b) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFlatGate(g => !g)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  flatGate
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                {flatGate ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                Payment Gate: <span className="font-semibold">{flatGate ? 'ON — Block entry until paid' : 'OFF — Students enter freely'}</span>
              </button>
            </div>
            <FormActions>
              <Button variant="ghost" size="sm" onClick={() => { setShowFlatForm(false); resetFlatForm(); }}>Cancel</Button>
              <Button variant="primary" size="sm" icon={CheckIcon} loading={flatSaving} onClick={saveFlatFee}>
                {flatEditId ? 'Update' : 'Add'} Batch Fee
              </Button>
            </FormActions>
          </div>
        )}

        {batchFlatRows.length === 0 && !showFlatForm ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">No special batch fees yet. Click &quot;Add Batch Fee&quot; to create one.</div>
        ) : (
          <TableWrapper>
            <THead>
              <TH>Batch Name</TH>
              <TH>Type</TH>
              <TH>Applies To</TH>
              <TH>Fee</TH>
              <TH>Payment Gate</TH>
              <TH>Notes</TH>
              <TH></TH>
            </THead>
            <tbody>
              {batchFlatRows.map(row => {
                const ag = row.applicable_grades  ?? ['all'];
                const ar = row.applicable_regions ?? ['all'];
                const ab = row.applicable_boards  ?? ['all'];
                const appliesAll = ag.includes('all') && ar.includes('all') && ab.includes('all');
                return (
                <TRow key={row.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.batch_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{BT_LABELS[row.batch_type] || row.batch_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {appliesAll ? (
                      <span className="text-gray-400">All</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {!ag.includes('all') && <span>Grades: {ag.map(g => `${g}`).join(', ')}</span>}
                        {!ar.includes('all') && <span>Regions: {ar.join(', ')}</span>}
                        {!ab.includes('all') && <span>Boards: {ab.join(', ')}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {row.currency} {(row.fee_paise / 100).toLocaleString('en-IN')}
                    <span className="ml-1 text-[10px] text-gray-400 font-normal">one-time</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleGate(row.id)}
                      disabled={togglingGateId === row.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                        row.payment_gate_enabled
                          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                          : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10'
                      }`}
                      title={row.payment_gate_enabled ? 'Gate ON — click to allow free entry' : 'Gate OFF — click to require payment'}
                    >
                      {togglingGateId === row.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : row.payment_gate_enabled
                          ? <><ToggleRight className="w-3.5 h-3.5" /> Gate ON</>
                          : <><ToggleLeft className="w-3.5 h-3.5" /> Gate OFF</>
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{(row as { notes?: string }).notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        setFlatEditId(row.id);
                        setFlatBatchName(row.batch_name || '');
                        setFlatBatchType(row.batch_type);
                        setFlatFee(String(row.fee_paise / 100));
                        setFlatCurrency(row.currency);
                        setFlatNotes((row as { notes?: string }).notes || '');
                        setFlatGate(row.payment_gate_enabled ?? false);
                        const ag = row.applicable_grades ?? ['all'];
                        const ar = row.applicable_regions ?? ['all'];
                        const ab = row.applicable_boards ?? ['all'];
                        setFlatGrades(ag.includes('all') ? [] : ag);
                        setFlatRegions(ar.includes('all') ? [] : ar);
                        setFlatBoards(ab.includes('all') ? [] : ab);
                        setShowFlatForm(true);
                      }} className="text-gray-400 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteFee(row.id)} disabled={deletingId === row.id} className="text-gray-400 hover:text-red-600">
                        {deletingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </TRow>
                );
              })}
            </tbody>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
