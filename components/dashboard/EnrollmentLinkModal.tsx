'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Modal, Button, FormField, FormGrid, Input, Select, Alert,
} from '@/components/dashboard/shared';
import { Send, Copy, CheckCircle2, Link2, ExternalLink, Loader2, IndianRupee } from 'lucide-react';
import {
  STUDENT_REGIONS, ENROLLMENT_BOARDS, ELIGIBLE_GRADES, BATCH_TYPE_LABELS,
  getEnrollmentCategory, getAvailableBatchTypes, isSessionBased, normalizeGrade,
  SPECIAL_BATCH_TYPES,
} from '@/lib/enrollment-fee';

const GRADE_OPTIONS = ELIGIBLE_GRADES.map(g => ({ value: `Class ${g}`, label: `Class ${g}` }));
const BOARD_OPTIONS = ENROLLMENT_BOARDS.map(b => ({ value: b, label: b }));
const REGION_OPTIONS = STUDENT_REGIONS.map(r => ({ value: r.value, label: r.label }));

interface FeeRow {
  region_group: string;
  board: string;
  batch_type: string;
  grade: string;
  fee_paise: number;
  fee_unit: string;
}

interface EnrollmentLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export default function EnrollmentLinkModal({ open, onClose }: EnrollmentLinkModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [board, setBoard] = useState('');
  const [region, setRegion] = useState('');
  const [batchType, setBatchType] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; linkId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fee structure loaded from DB
  const [feeRows, setFeeRows] = useState<FeeRow[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);

  // Load fee structure on mount
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingFees(true);
    fetch('/api/v1/payment/enrollment-fees')
      .then(r => r.json())
      .then(data => { if (!cancelled && data.success) setFeeRows(data.data.fees || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingFees(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Derive category + available batch types when region/board change
  const category = useMemo(() => {
    if (!region || !board) return null;
    return getEnrollmentCategory(region, board);
  }, [region, board]);

  const availableBatchTypes = useMemo(() => {
    const regular = category
      ? getAvailableBatchTypes(category).map(bt => ({ value: bt, label: BATCH_TYPE_LABELS[bt] || bt }))
      : [];
    const special = SPECIAL_BATCH_TYPES.map(bt => ({ value: bt, label: BATCH_TYPE_LABELS[bt] || bt }));
    return [...regular, ...special];
  }, [category]);

  // Reset batch type if not available in new category (special types always valid)
  useEffect(() => {
    if (category && batchType) {
      const available = getAvailableBatchTypes(category);
      const isSpecial = (SPECIAL_BATCH_TYPES as readonly string[]).includes(batchType);
      if (!available.includes(batchType) && !isSpecial) setBatchType('');
    }
  }, [category, batchType]);

  // Find matching fee row
  const matchedFee = useMemo(() => {
    if (!category || !batchType || !grade) return null;
    const g = normalizeGrade(grade);
    return feeRows.find(
      r => r.region_group === (category.startsWith('GCC') ? 'GCC' : 'Kerala')
        && r.board === board
        && r.batch_type === batchType
        && r.grade === g,
    ) || null;
  }, [feeRows, category, batchType, grade, board]);

  const reset = useCallback(() => {
    setName(''); setPhone(''); setEmail(''); setGrade('');
    setBoard(''); setRegion(''); setBatchType('');
    setSendWhatsApp(true); setSending(false); setError(''); setResult(null); setCopied(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Student name and phone number are required');
      return;
    }
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/v1/enrollment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: name.trim(),
          student_phone: phone.trim(),
          student_email: email.trim() || undefined,
          student_grade: grade || undefined,
          student_board: board || undefined,
          student_region: region || undefined,
          preferred_batch_type: batchType || undefined,
          send_whatsapp: sendWhatsApp,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to create enrollment link');
        return;
      }
      setResult({ url: data.data.enrollment_url, linkId: data.data.enrollment_link_id });
    } catch {
      setError('Network error — please try again');
    } finally {
      setSending(false);
    }
  }, [name, phone, email, grade, board, region, batchType, sendWhatsApp]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleCreateAnother = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <Modal open={open} onClose={handleClose} title="Send Enrollment Link" subtitle="Generate an enrollment form link for a new student" maxWidth="lg">
      {result ? (
        <div className="space-y-4">
          <Alert variant="success" message={`Enrollment link created${sendWhatsApp ? ' and sent via WhatsApp' : ''}!`} />

          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">Enrollment Link</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.url}
                className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 select-all"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopy}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
            </a>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClose}>Done</Button>
            <Button variant="primary" icon={Link2} onClick={handleCreateAnother}>Create Another</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert variant="error" message={error} />}

          {/* Basic info */}
          <FormGrid cols={2}>
            <FormField label="Student Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter student's full name"
                disabled={sending}
              />
            </FormField>
            <FormField label="Phone Number" required>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                disabled={sending}
              />
            </FormField>
            <FormField label="Email" hint="Optional — student can fill this in the form">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                type="email"
                disabled={sending}
              />
            </FormField>
            <FormField label="Grade">
              <Select
                value={grade}
                onChange={setGrade}
                options={GRADE_OPTIONS}
                placeholder="Select grade…"
              />
            </FormField>
          </FormGrid>

          {/* Fee structure fields */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Fee Details <span className="text-gray-400 font-normal">(optional — pre-fills the enrollment form)</span></div>
            <FormGrid cols={3}>
              <FormField label="Region">
                <Select
                  value={region}
                  onChange={setRegion}
                  options={REGION_OPTIONS}
                  placeholder="Select region…"
                />
              </FormField>
              <FormField label="Board">
                <Select
                  value={board}
                  onChange={setBoard}
                  options={BOARD_OPTIONS}
                  placeholder="Select board…"
                />
              </FormField>
              <FormField label="Batch Type">
                <Select
                  value={batchType}
                  onChange={setBatchType}
                  options={availableBatchTypes}
                  placeholder={!category ? 'Select region & board first…' : 'Select batch type…'}
                />
              </FormField>
            </FormGrid>
          </div>

          {/* Fee preview */}
          {matchedFee && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-800">
                  ₹{(matchedFee.fee_paise / 100).toLocaleString('en-IN')}
                  <span className="font-normal text-emerald-600">
                    {matchedFee.fee_unit === 'session' ? ' per session' : ' per year'}
                  </span>
                </div>
                <div className="text-xs text-emerald-600">
                  {category} · {BATCH_TYPE_LABELS[batchType] || batchType} · Grade {normalizeGrade(grade)}
                  {isSessionBased(batchType) && ' · 50 sessions min advance'}
                  {!isSessionBased(batchType) && ' · All subjects included'}
                </div>
              </div>
            </div>
          )}
          {!matchedFee && category && batchType && grade && !loadingFees && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              No fee rate found for this combination. The student can still complete enrollment — fee will be determined from available rates.
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={sending}
            />
            Send enrollment link via WhatsApp
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={sending}>Cancel</Button>
            <Button variant="primary" icon={sending ? Loader2 : Send} onClick={handleSubmit} disabled={sending}>
              {sending ? 'Sending…' : 'Generate & Send'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
