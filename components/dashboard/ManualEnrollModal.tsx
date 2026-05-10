'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button, FormField, FormGrid, Input, Select, Alert } from '@/components/dashboard/shared';
import { UserPlus, ChevronRight, ChevronLeft, CheckCircle2, Loader2, IndianRupee, X } from 'lucide-react';
import { WizardShell, WizardFooterDots } from '@/components/dashboard/WizardShell';
import { FeeBreakdownCard } from '@/components/dashboard/FeeBreakdownCard';
import { computeFeeBreakdown, fmtPaise } from '@/lib/fee-display';
import {
  ONE_TO_FIFTEEN_PACKAGES, ONE_TO_THIRTY_PACKAGES,
  PER_CLASS_SUBJECTS_BY_GRADE, MIN_SESSIONS_DEFAULT, MIN_SESSIONS_MINIMUM,
} from '@/lib/enrollment-fee';

// ── Interfaces ────────────────────────────────────────────────

interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  grade: string | null;
  board: string | null;
  student_count: number;
  max_students: number;
  status: string;
}

interface FeeRow {
  fee_paise: number;
  early_bird_fee_paise?: number | null;
  fee_unit: string;
  currency: string;
  offer_label?: string | null;
  offer_expires_at?: string | null;
  show_per_class_only: boolean;
}

interface FeeStructureRow {
  region_group: string;
  board: string;
  batch_type: string;
  grade: string;
  fee_paise: number;
  early_bird_fee_paise: number | null;
  offer_label: string | null;
  offer_expires_at: string | null;
  show_per_class_only: boolean;
  fee_unit: string;
  currency: string;
}

interface BatchFlatFeeRow {
  id: string;
  batch_type: string;
  batch_name: string;
  fee_paise: number;
  currency: string;
  payment_gate_enabled: boolean;
  applicable_grades: string[];
  applicable_regions: string[];
  applicable_boards: string[];
}

interface ManualEnrollModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Constants ─────────────────────────────────────────────────

const PAYMENT_MODE_OPTIONS = [
  { value: 'none',    label: 'No payment now' },
  { value: 'advance', label: 'Advance payment' },
  { value: 'full',    label: 'Full payment' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer / NEFT' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

const GRADE_OPTIONS = [
  'Class 1','Class 2','Class 3','Class 4','Class 5','Class 6',
  'Class 7','Class 8','Class 9','Class 10','Class 11','Class 12',
].map(g => ({ value: g, label: g }));

const BOARD_OPTIONS = [
  'CBSE','ICSE','ISC','Kerala State','Other State Board','IB','IGCSE',
].map(b => ({ value: b, label: b }));

const REGION_OPTIONS = [
  { value: 'India',        label: 'India (Kerala)' },
  { value: 'Qatar',        label: 'Qatar (GCC)' },
  { value: 'Dubai',        label: 'Dubai (GCC)' },
  { value: 'Abu Dhabi',    label: 'Abu Dhabi (GCC)' },
  { value: 'Sharjah',      label: 'Sharjah (GCC)' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia (GCC)' },
  { value: 'Kuwait',       label: 'Kuwait (GCC)' },
  { value: 'Bahrain',      label: 'Bahrain (GCC)' },
  { value: 'Oman',         label: 'Oman (GCC)' },
];

const GCC_REGION_VALUES = new Set([
  'Qatar', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
  'Saudi Arabia', 'Kuwait', 'Bahrain', 'Oman',
]);

const CATEGORY_OPTIONS = [
  { value: 'A', label: 'Category A' },
  { value: 'B', label: 'Category B' },
  { value: 'C', label: 'Category C' },
];

// ── Helpers ───────────────────────────────────────────────────

function getRegionGroup(region: string): 'GCC' | 'Kerala' | null {
  if (GCC_REGION_VALUES.has(region)) return 'GCC';
  if (region === 'India') return 'Kerala';
  return null;
}

function toFeeGrade(grade: string): string {
  const n = grade.replace(/^Class\s+/i, '').trim();
  return (n === '11' || n === '12') ? 'HSS' : n;
}

function isFeeOfferActive(row: Pick<FeeStructureRow, 'early_bird_fee_paise' | 'offer_expires_at'>): boolean {
  if (!row.early_bird_fee_paise) return false;
  if (!row.offer_expires_at) return true;
  return new Date(row.offer_expires_at) > new Date();
}

function fmtRs(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const BATCH_TYPE_META: Record<string, {
  label: string; shortLabel: string; desc: string;
  color: string; selColor: string; feeType: 'per_class' | 'annual' | 'batch_flat';
}> = {
  one_to_one:        { label: '1:1 Individual',    shortLabel: '1:1',         desc: 'Personal tuition · per-class fee',           color: 'border-blue-200 bg-blue-50 text-blue-700',       selColor: 'border-blue-500 bg-blue-100 ring-2 ring-blue-300 text-blue-900',       feeType: 'per_class'  },
  one_to_three:      { label: '1:3 Small Group',   shortLabel: '1:3',         desc: 'Up to 3 students · per-class fee',           color: 'border-primary/20 bg-primary/5 text-primary', selColor: 'border-primary bg-primary/10 ring-2 ring-emerald-300 text-emerald-900', feeType: 'per_class'  },
  one_to_fifteen:    { label: '1:15 Group Class',  shortLabel: '1:15',        desc: 'Up to 15 students · annual fee',             color: 'border-teal-200 bg-teal-50 text-teal-700',       selColor: 'border-teal-500 bg-teal-100 ring-2 ring-teal-300 text-teal-900',       feeType: 'annual'     },
  one_to_thirty:     { label: '1:30 Large Group',  shortLabel: '1:30',        desc: 'Up to 30 students · annual fee',             color: 'border-purple-200 bg-purple-50 text-purple-700', selColor: 'border-purple-500 bg-purple-100 ring-2 ring-purple-300 text-purple-900', feeType: 'annual'     },
  one_to_many:       { label: '1:M Classroom',     shortLabel: '1:M',         desc: 'Large batch · annual fee',                   color: 'border-indigo-200 bg-indigo-50 text-indigo-700', selColor: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300 text-indigo-900', feeType: 'annual'     },
  improvement_batch: { label: 'Improvement Batch', shortLabel: 'Improvement', desc: 'Special improvement sessions · flat one-time fee', color: 'border-amber-200 bg-amber-50 text-amber-700',   selColor: 'border-amber-500 bg-amber-100 ring-2 ring-amber-300 text-amber-900',   feeType: 'batch_flat' },
  special:           { label: 'Special Batch',     shortLabel: 'Special',     desc: 'Special batch · flat one-time fee at entry', color: 'border-orange-200 bg-orange-50 text-orange-700', selColor: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300 text-orange-900', feeType: 'batch_flat' },
  custom:            { label: 'Custom / Special',  shortLabel: 'Custom',      desc: 'Custom fee structure · flat one-time fee',   color: 'border-rose-200 bg-rose-50 text-rose-700',       selColor: 'border-rose-500 bg-rose-100 ring-2 ring-rose-300 text-rose-900',       feeType: 'batch_flat' },
  lecture:           { label: 'Lecture',           shortLabel: 'Lecture',     desc: 'Large lecture batch · flat one-time fee',    color: 'border-violet-200 bg-violet-50 text-violet-700', selColor: 'border-violet-500 bg-violet-100 ring-2 ring-violet-300 text-violet-900', feeType: 'batch_flat' },
};

const SPECIAL_TYPES = new Set(['improvement_batch', 'special', 'custom', 'lecture']);
const BATCH_TYPE_ORDER = ['one_to_one', 'one_to_three', 'one_to_fifteen', 'one_to_thirty', 'one_to_many', 'improvement_batch', 'special', 'custom', 'lecture'];
const SESSION_BASED = new Set(['one_to_one', 'one_to_three']);

// ── StepIndicator ─────────────────────────────────────────────

// ── Main Component ────────────────────────────────────────────

export default function ManualEnrollModal({ open, onClose, onSuccess }: ManualEnrollModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    student_email: string;
    batch_name: string;
    invoice_number: string | null;
    receipt_number: string | null;
    amount_paid_paise: number;
    payment_mode: string;
    sessions_credited: number;
  } | null>(null);

  // ── Step 0: Personal ──────────────────────────────────────
  const [studentName, setStudentName]         = useState('');
  const [studentEmail, setStudentEmail]       = useState('');
  const [studentPhone, setStudentPhone]       = useState('');
  const [studentWhatsapp, setStudentWhatsapp] = useState('');
  const [studentDob, setStudentDob]           = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // ── Step 1: Guardian ──────────────────────────────────────
  const [parentName, setParentName]         = useState('');
  const [parentEmail, setParentEmail]       = useState('');
  const [parentPhone, setParentPhone]       = useState('');
  const [parentPassword, setParentPassword] = useState('');

  // ── Step 2: Academic + Batch Type ────────────────────────
  const [studentRegion, setStudentRegion]     = useState('');
  const [studentGrade, setStudentGrade]       = useState('');
  const [studentBoard, setStudentBoard]       = useState('');
  const [studentSection, setStudentSection]   = useState('');
  const [studentCategory, setStudentCategory] = useState('');
  const [preferredBatchType, setPreferredBatchType] = useState('');

  // ── Step 3 (conditional): Subjects / Package ─────────────
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showPerSubject, setShowPerSubject]       = useState(false);
  const [subjectsInitialized, setSubjectsInitialized] = useState(false);
  const [selectedPackageId, setSelectedPackageId]     = useState('');

  // ── Last Step: Batch & Payment ────────────────────────────
  const [batchId, setBatchId]               = useState('');
  const [batches, setBatches]               = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [paymentMode, setPaymentMode]       = useState('none');
  const [paymentMethod, setPaymentMethod]   = useState('cash');
  const [amountRs, setAmountRs]             = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes]                   = useState('');
  const [skipPaymentGate, setSkipPaymentGate] = useState(false);
  const [paymentType, setPaymentType]       = useState<'otp' | 'spo'>('otp');

  // ── Fee state ─────────────────────────────────────────────
  const [feeStructure, setFeeStructure]     = useState<FeeStructureRow[]>([]);
  const [batchFlatFees, setBatchFlatFees]   = useState<BatchFlatFeeRow[]>([]);
  const [feeStructureLoading, setFeeStructureLoading] = useState(false);
  const [feeRow, setFeeRow]                 = useState<FeeRow | null>(null);

  // ── Derived ───────────────────────────────────────────────
  const regionGroup = studentRegion ? getRegionGroup(studentRegion) : null;
  const feeGrade    = studentGrade  ? toFeeGrade(studentGrade) : '';
  const boardForFee = studentBoard === 'Kerala State' ? 'State Board' : studentBoard;

  const isSessionBased  = SESSION_BASED.has(preferredBatchType);
  const isBatchFlat     = SPECIAL_TYPES.has(preferredBatchType);
  const isPackageBatch  = !isBatchFlat && (preferredBatchType === 'one_to_fifteen' || preferredBatchType === 'one_to_thirty');
  const hasSubjectStep  = isSessionBased || isPackageBatch;

  // Per-session rate derived from the selected batch's feeRow (for last step auto-suggestion)
  const lastStepRate: number | null = (feeRow)
    ? (feeRow.early_bird_fee_paise != null && feeRow.offer_expires_at !== undefined && isFeeOfferActive({ early_bird_fee_paise: feeRow.early_bird_fee_paise ?? null, offer_expires_at: feeRow.offer_expires_at ?? null })
        ? feeRow.early_bird_fee_paise
        : feeRow.fee_paise)
    : null;

  const STEP_LABELS = hasSubjectStep
    ? ['Personal', 'Guardian', 'Academic', isSessionBased ? 'Subjects' : 'Package', 'Batch & Pay']
    : ['Personal', 'Guardian', 'Academic', 'Batch & Pay'];
  const LAST_STEP = STEP_LABELS.length - 1;

  // Available boards for selected region
  const availableBoardsForRegion: string[] | null = (() => {
    if (!regionGroup || !feeStructure.length) return null;
    const feeBds = [...new Set(feeStructure.filter(f => f.region_group === regionGroup).map(f => f.board))];
    if (!feeBds.length) return null;
    return feeBds.map(b => b === 'State Board' ? 'Kerala State' : b);
  })();
  const singleBoard = availableBoardsForRegion?.length === 1 ? availableBoardsForRegion[0] : null;

  // Helper: check if a batch_flat_fees entry applies to the current student
  const flatFeeApplies = (row: BatchFlatFeeRow): boolean => {
    const gradeOk   = !row.applicable_grades?.length  || row.applicable_grades.includes('all')  || row.applicable_grades.includes(feeGrade);
    const regionOk  = !row.applicable_regions?.length || row.applicable_regions.includes('all') || (!!studentRegion && row.applicable_regions.includes(studentRegion));
    const boardOk   = !row.applicable_boards?.length  || row.applicable_boards.includes('all')  || row.applicable_boards.includes(boardForFee);
    return gradeOk && regionOk && boardOk;
  };

  // Available batch types: regular from fee structure + only configured flat-fee types
  const availableBatchTypes = (() => {
    const seen = new Set<string>();
    const types: string[] = [];
    if (regionGroup && boardForFee && feeGrade) {
      const rows = feeStructure.filter(f =>
        f.region_group === regionGroup && f.board === boardForFee && f.grade === feeGrade
      );
      for (const r of rows) {
        if (!seen.has(r.batch_type)) { seen.add(r.batch_type); types.push(r.batch_type); }
      }
    }
    // Include flat-fee batch types ONLY if configured (and applicable to this student)
    for (const row of batchFlatFees) {
      if (!seen.has(row.batch_type) && flatFeeApplies(row)) {
        seen.add(row.batch_type); types.push(row.batch_type);
      }
    }
    return types.sort((a, z) => BATCH_TYPE_ORDER.indexOf(a) - BATCH_TYPE_ORDER.indexOf(z));
  })();

  const getBatchTypeFeeRow = (batchType: string): FeeStructureRow | null => {
    // For flat-fee types, look in batchFlatFees (separate API result)
    if (SPECIAL_TYPES.has(batchType)) {
      const flatRow = batchFlatFees.find(r => r.batch_type === batchType && flatFeeApplies(r));
      if (!flatRow) return null;
      return {
        region_group: 'all', board: 'all', batch_type: batchType, grade: 'all',
        fee_paise: flatRow.fee_paise,
        early_bird_fee_paise: null, offer_label: flatRow.batch_name, offer_expires_at: null,
        show_per_class_only: false, fee_unit: 'batch_flat', currency: flatRow.currency || 'INR',
      };
    }
    if (!regionGroup || !boardForFee || !feeGrade) return null;
    return feeStructure.find(f =>
      f.region_group === regionGroup && f.board === boardForFee &&
      f.batch_type === batchType && f.grade === feeGrade
    ) || null;
  };

  // Per-class subjects
  const perClassSubjects: string[] = PER_CLASS_SUBJECTS_BY_GRADE[feeGrade] || PER_CLASS_SUBJECTS_BY_GRADE['10'] || [];

  // Per-session rate for 1:1 / 1:3 subjects display (uses preferred batch type's fee row)
  const perSessionFeeRow = isSessionBased ? getBatchTypeFeeRow(preferredBatchType) : null;
  const perSessionOfferActive = perSessionFeeRow ? isFeeOfferActive(perSessionFeeRow) : false;
  const perSessionRate: number | null = perSessionFeeRow
    ? (perSessionOfferActive
        ? (perSessionFeeRow.early_bird_fee_paise ?? perSessionFeeRow.fee_paise)
        : perSessionFeeRow.fee_paise)
    : null;

  // Auto-initialize all subjects
  if (isSessionBased && perClassSubjects.length > 0 && !subjectsInitialized && selectedSubjects.length === 0) {
    setSelectedSubjects([...perClassSubjects]);
    setSubjectsInitialized(true);
  }

  const availablePackages: typeof ONE_TO_FIFTEEN_PACKAGES | typeof ONE_TO_THIRTY_PACKAGES | [] = preferredBatchType === 'one_to_fifteen'
    ? ONE_TO_FIFTEEN_PACKAGES
    : preferredBatchType === 'one_to_thirty'
      ? ONE_TO_THIRTY_PACKAGES
      : [];

  const selectedBatch = batches.find(b => b.batch_id === batchId);
  const isPerClassBatch = selectedBatch?.batch_type === 'one_to_one' || selectedBatch?.batch_type === 'one_to_three';
  const isGroupBatch = selectedBatch && !isPerClassBatch;

  // Effective values — work even without specific batch selection
  const effectiveBatchType = selectedBatch?.batch_type || preferredBatchType || '';
  const effectiveIsPerClass = effectiveBatchType === 'one_to_one' || effectiveBatchType === 'one_to_three';
  const effectiveFeeRate: number | null = lastStepRate ?? perSessionRate;
  // Derived sessions: floor(amountPaise / feeRate) — no manual stepper needed
  const derivedSessions = (effectiveIsPerClass && effectiveFeeRate && amountRs && parseFloat(amountRs) > 0)
    ? Math.floor(Math.round(parseFloat(amountRs) * 100) / effectiveFeeRate)
    : 0;

  // Group batch fee breakdown (for OTP/SPO selector and invoice preview)
  const effectiveIsGroup = !effectiveIsPerClass && !SPECIAL_TYPES.has(effectiveBatchType) && !!effectiveBatchType;
  const groupFeeRow = feeRow ?? (effectiveIsGroup ? getBatchTypeFeeRow(effectiveBatchType) : null);
  const groupBreakdown = (effectiveIsGroup && groupFeeRow) ? computeFeeBreakdown(groupFeeRow) : null;

  const batchOptions = batches.map(b => ({
    value: b.batch_id,
    label: `${b.batch_name}${b.grade ? ` • ${b.grade}` : ''}${b.board ? ` • ${b.board}` : ''} (${b.student_count}/${b.max_students})`,
  }));

  // ── Effects ───────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    setFeeStructureLoading(true);
    fetch('/api/v1/payment/enrollment-fees?academic_year=2026-27')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setFeeStructure(data.data?.fees || []);
          setBatchFlatFees(data.data?.batch_flat_fees || []);
        }
      })
      .catch(() => {})
      .finally(() => setFeeStructureLoading(false));
  }, [open]);

  useEffect(() => {
    if (!batchId || !batches.length) { setFeeRow(null); return; }
    const batch = batches.find(b => b.batch_id === batchId);
    if (!batch) { setFeeRow(null); return; }
    fetch('/api/v1/payment/enrollment-fees?academic_year=2026-27')
      .then(r => r.json())
      .then(data => {
        if (!data.success) return;
        const rows = (data.data?.fees || []) as (FeeRow & { batch_type: string; grade: string })[];
        const match = rows.find(r =>
          r.batch_type === batch.batch_type &&
          (!batch.grade || r.grade === batch.grade || r.grade === 'all')
        );
        setFeeRow(match ?? null);
      })
      .catch(() => setFeeRow(null));
  }, [batchId, batches]);

  useEffect(() => {
    const batchStep = hasSubjectStep ? 4 : 3;
    if (!open || step !== batchStep) return;
    setLoadingBatches(true);
    fetch('/api/v1/batches?status=active')
      .then(r => r.json())
      .then(data => {
        if (data.success) setBatches((data.data?.batches || data.data || []) as Batch[]);
      })
      .catch(() => {})
      .finally(() => setLoadingBatches(false));
  }, [step, open, hasSubjectStep]);

  useEffect(() => {
    if (singleBoard && studentBoard !== singleBoard) setStudentBoard(singleBoard);
  }, [singleBoard, studentBoard]);

  // When payment mode switches to 'none', clear amount
  useEffect(() => {
    if (paymentMode === 'none') setAmountRs('');
  }, [paymentMode]);

  // ── Handlers ──────────────────────────────────────────────

  const handleRegionChange = (v: string) => {
    setStudentRegion(v);
    setPreferredBatchType('');
    setSelectedSubjects([]);
    setSubjectsInitialized(false);
    if (GCC_REGION_VALUES.has(v)) {
      setStudentBoard('CBSE');
    } else if (v === 'India' && GCC_REGION_VALUES.has(studentRegion)) {
      setStudentBoard('');
    }
  };

  const reset = useCallback(() => {
    setStep(0); setError(''); setSuccess(null);
    setStudentName(''); setStudentEmail(''); setStudentPhone('');
    setStudentWhatsapp(''); setStudentDob(''); setStudentPassword('');
    setParentName(''); setParentEmail(''); setParentPhone(''); setParentPassword('');
    setStudentRegion(''); setStudentGrade(''); setStudentBoard('');
    setStudentSection(''); setStudentCategory(''); setPreferredBatchType('');
    setSelectedSubjects([]);
    setShowPerSubject(false); setSubjectsInitialized(false); setSelectedPackageId('');
    setBatchId(''); setBatches([]);
    setPaymentMode('none'); setPaymentMethod('cash');
    setAmountRs(''); setTransactionRef(''); setNotes('');
    setSkipPaymentGate(false); setPaymentType('otp'); setFeeRow(null);
    setBatchFlatFees([]);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const validateStep = (): string => {
    if (step === 0) {
      if (!studentName.trim()) return 'Student name is required';
      if (!studentEmail.trim()) return 'Student email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail.trim())) return 'Invalid email address';
      if (!studentPhone.trim()) return 'Phone number is required';
    }
    if (step === 1) {
      if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim()))
        return 'Invalid parent email address';
    }
    if (step === 2) {
      if (!studentRegion) return 'Region is required';
      if (!studentGrade)  return 'Grade is required';
      if (!studentBoard)  return 'Board is required';
      if (availableBatchTypes.length > 0 && !preferredBatchType)
        return 'Please select a preferred batch type';
    }
    if (step === 3 && hasSubjectStep) {
      if (isSessionBased && selectedSubjects.length === 0) return 'Select at least one subject';
      if (isPackageBatch && !selectedPackageId) return 'Please select a subject package';
    }
    if (step === LAST_STEP) {
      if (paymentMode !== 'none') {
        const amt = parseFloat(amountRs);
        if (!amountRs || isNaN(amt) || amt <= 0) return 'Enter a valid payment amount';
        if (effectiveIsPerClass && derivedSessions < MIN_SESSIONS_MINIMUM)
          return `Minimum ${MIN_SESSIONS_MINIMUM} sessions required (enter a higher amount)`;
      }
    }
    return '';
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const prevStep = () => { setError(''); setStep(s => s - 1); };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      const amountPaise = paymentMode !== 'none'
        ? Math.round(parseFloat(amountRs || '0') * 100)
        : 0;

      const getSubjects = () => {
        if (isSessionBased) return selectedSubjects.length > 0 ? selectedSubjects : undefined;
        if (preferredBatchType === 'one_to_fifteen')
          return ONE_TO_FIFTEEN_PACKAGES.find(p => p.id === selectedPackageId)?.subjects;
        if (preferredBatchType === 'one_to_thirty')
          return ONE_TO_THIRTY_PACKAGES.find(p => p.id === selectedPackageId)?.subjects;
        const bt = selectedBatch?.batch_type;
        if (bt === 'one_to_fifteen')
          return ONE_TO_FIFTEEN_PACKAGES.find(p => p.id === selectedPackageId)?.subjects;
        if (bt === 'one_to_thirty')
          return ONE_TO_THIRTY_PACKAGES.find(p => p.id === selectedPackageId)?.subjects;
        return undefined;
      };

      const res = await fetch('/api/v1/enrollment/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name:         studentName.trim(),
          student_email:        studentEmail.trim().toLowerCase(),
          student_phone:        studentPhone.trim() || undefined,
          student_whatsapp:     studentWhatsapp.trim() || undefined,
          student_grade:        studentGrade || undefined,
          student_board:        studentBoard || undefined,
          student_section:      studentSection.trim() || undefined,
          student_dob:          studentDob || undefined,
          student_password:     studentPassword.trim() || undefined,
          student_region:       studentRegion || undefined,
          student_category:     studentCategory || undefined,
          preferred_batch_type: preferredBatchType || undefined,
          parent_name:          parentName.trim() || undefined,
          parent_email:         parentEmail.trim().toLowerCase() || undefined,
          parent_phone:         parentPhone.trim() || undefined,
          parent_password:      parentPassword.trim() || undefined,
          batch_id:             batchId,
          payment_mode:         paymentMode,
          payment_method:       paymentMode !== 'none' ? paymentMethod : 'none',
          amount_paise:         amountPaise,
          transaction_ref:      transactionRef.trim() || undefined,
          notes:                notes.trim() || undefined,
          skip_payment_gate:    skipPaymentGate,
          payment_type:         effectiveIsGroup ? paymentType : 'otp',
          fee_otp_paise:        groupBreakdown?.otpTotal ?? 0,
          fee_spo_q123_paise:   groupBreakdown?.q123 ?? 0,
          fee_spo_q4_paise:     groupBreakdown?.q4 ?? 0,
          selected_subjects:    getSubjects(),
          minimum_sessions:     effectiveIsPerClass ? derivedSessions : undefined,
          fee_per_session_paise: (effectiveIsPerClass && effectiveFeeRate) ? effectiveFeeRate : undefined,
        }),
      });

      const data = await res.json() as {
        success: boolean;
        error?: string;
        data?: {
          student_email: string;
          batch_name: string;
          invoice_number: string | null;
          receipt_number: string | null;
          amount_paid_paise: number;
          payment_mode: string;
          sessions_credited: number;
        };
      };

      if (!data.success) { setError(data.error || 'Enrollment failed'); return; }
      setSuccess(data.data!);
      onSuccess?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────

  if (!open) return null;

  const wizardStepDefs = STEP_LABELS.map(l => ({ label: l }));

  return (
    <WizardShell
      open={open}
      onClose={handleClose}
      title="Enroll Student"
      icon={UserPlus}
      steps={wizardStepDefs}
      currentStep={success ? STEP_LABELS.length - 1 : step}
      footer={
        !success ? (
          <>
            <div>{step > 0 && <Button variant="outline" icon={ChevronLeft} onClick={prevStep} disabled={loading}>Back</Button>}</div>
            <WizardFooterDots total={STEP_LABELS.length} current={step} />
            <div>
              {step < LAST_STEP ? (
                <Button iconRight={ChevronRight} onClick={nextStep}>Continue</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading} icon={loading ? Loader2 : UserPlus}>
                  {loading ? 'Enrolling…' : 'Enroll Student'}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => reset()}>Enroll Another</Button>
            <Button className="flex-1" onClick={handleClose}>Done</Button>
          </div>
        )
      }
    >
      <div className="pb-2">

        {success ? (
          <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-primary dark:text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Student Enrolled!</p>
            <p className="text-sm text-muted-foreground mt-1">
              {success.batch_name
                ? <>{success.student_email} added to <span className="font-medium">{success.batch_name}</span></>
                : <>{success.student_email} registered — <span className="font-medium">no batch assigned yet</span></>}
            </p>
          </div>
              {success.payment_mode !== 'none' && success.invoice_number && (
            <div className="rounded-lg border bg-muted/30 p-4 text-left space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-mono font-medium">{success.invoice_number}</span>
              </div>
              {success.receipt_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt</span>
                  <span className="font-mono font-medium">{success.receipt_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium text-primary">₹{(success.amount_paid_paise / 100).toFixed(2)}</span>
              </div>
              {success.sessions_credited > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session Credits</span>
                  <span className="font-medium text-blue-600">{success.sessions_credited} sessions</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{success.payment_mode}</span>
              </div>
            </div>
          )}
          {success.payment_mode === 'none' && success.sessions_credited > 0 && (
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-300 text-left">
              <span className="font-semibold">{success.sessions_credited} free session credits</span> allocated — student can join {success.sessions_credited} classes.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {error && <Alert variant="error" message={error} />}

          {/* Step 0 — Personal */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Student Information</p>
              <FormGrid cols={1}>
                <FormField label="Full Name *">
                  <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Rahul Kumar" />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                <FormField label="Email *">
                  <Input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="student@email.com" />
                </FormField>
                <FormField label="Phone *">
                  <Input type="tel" value={studentPhone} onChange={e => setStudentPhone(e.target.value)} placeholder="+91 9876543210" />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                <FormField label="WhatsApp" hint="If different from phone">
                  <Input type="tel" value={studentWhatsapp} onChange={e => setStudentWhatsapp(e.target.value)} placeholder="+91 9876543210" />
                </FormField>
                <FormField label="Date of Birth">
                  <Input type="date" value={studentDob} onChange={e => setStudentDob(e.target.value)} />
                </FormField>
              </FormGrid>
              <FormGrid cols={1}>
                <FormField label="Password" hint="Login password for this student">
                  <Input type="password" value={studentPassword} onChange={e => setStudentPassword(e.target.value)} placeholder="Set a password" />
                </FormField>
              </FormGrid>
            </div>
          )}

          {/* Step 1 — Guardian */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Parent / Guardian</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">A parent account will be created for progress updates</p>
              </div>
              <FormGrid cols={1}>
                <FormField label="Parent / Guardian Name">
                  <Input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="e.g. Suresh Kumar" />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                <FormField label="Parent Email">
                  <Input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} placeholder="parent@email.com" />
                </FormField>
                <FormField label="Parent Phone">
                  <Input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="+91 9876543210" />
                </FormField>
              </FormGrid>
              <FormGrid cols={1}>
                <FormField label="Parent Password" hint="Login password for this parent account">
                  <Input type="password" value={parentPassword} onChange={e => setParentPassword(e.target.value)} placeholder="Set a password" />
                </FormField>
              </FormGrid>
            </div>
          )}

          {/* Step 2 — Academic + Batch Type */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Academic Details</p>
              <FormGrid cols={2}>
                <FormField label="Region *">
                  <Select value={studentRegion} onChange={handleRegionChange}
                    options={[{ value: '', label: '— Select —' }, ...REGION_OPTIONS]} />
                </FormField>
                <FormField label="Grade *">
                  <Select value={studentGrade} onChange={v => {
                    setStudentGrade(v);
                    setPreferredBatchType('');
                    setSelectedSubjects([]);
                    setSubjectsInitialized(false);
                  }} options={[{ value: '', label: '— Select —' }, ...GRADE_OPTIONS]} />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                {singleBoard ? (
                  <FormField label="Board">
                    <div className="flex h-9 items-center px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground">
                      {singleBoard} <span className="ml-1 text-xs opacity-60">(auto)</span>
                    </div>
                  </FormField>
                ) : (
                  <FormField label="Board *">
                    <Select value={studentBoard} onChange={v => {
                      setStudentBoard(v);
                      setPreferredBatchType('');
                      setSelectedSubjects([]);
                      setSubjectsInitialized(false);
                    }}
                      options={[
                        { value: '', label: '— Select —' },
                        ...(availableBoardsForRegion
                          ? availableBoardsForRegion.map(b => ({ value: b, label: b }))
                          : BOARD_OPTIONS),
                      ]} />
                  </FormField>
                )}
                <FormField label="Category">
                  <Select value={studentCategory} onChange={setStudentCategory}
                    options={[{ value: '', label: '— Select —' }, ...CATEGORY_OPTIONS]} />
                </FormField>
              </FormGrid>
              <FormGrid cols={1}>
                <FormField label="Section" hint="e.g. A, B, Science, Arts">
                  <Input value={studentSection} onChange={e => setStudentSection(e.target.value)} placeholder="Optional" />
                </FormField>
              </FormGrid>

              {(studentGrade && studentBoard && studentRegion) && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                      Batch Type Preference{availableBatchTypes.length > 0 ? ' *' : ''}
                    </p>
                    {feeStructureLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  {!feeStructureLoading && availableBatchTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No fee data for this combination — batch type is optional.
                    </p>
                  )}
                  <div className="space-y-2">
                    {availableBatchTypes.map(bt => {
                      const meta = BATCH_TYPE_META[bt];
                      if (!meta) return null;
                      const feeRowBt = getBatchTypeFeeRow(bt);
                      const isSelected = preferredBatchType === bt;
                      const offerActive = feeRowBt ? isFeeOfferActive(feeRowBt) : false;
                      const activeFeeVal = feeRowBt
                        ? (offerActive ? (feeRowBt.early_bird_fee_paise ?? feeRowBt.fee_paise) : feeRowBt.fee_paise)
                        : null;
                      const isAnnual = meta.feeType === 'annual';
                      const isFlatFee = meta.feeType === 'batch_flat';
                      const otpAmount = (feeRowBt && isAnnual && activeFeeVal !== null)
                        ? Math.round(activeFeeVal * (offerActive ? 0.75 : 0.90)) : null;
                      const savings = (feeRowBt && isAnnual && otpAmount !== null)
                        ? feeRowBt.fee_paise - otpAmount : 0;
                      const expiryDate = feeRowBt?.offer_expires_at
                        ? new Date(feeRowBt.offer_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : null;
                      return (
                        <button key={bt} type="button" onClick={() => setPreferredBatchType(bt)}
                          className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-gray-200 hover:border-emerald-300 bg-white'
                          }`}>
                          {/* Card header */}
                          <div className={`flex items-center gap-3 px-4 py-3 ${isSelected ? 'bg-primary/5' : 'bg-white'}`}>
                            <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              isSelected ? 'border-emerald-600 bg-primary' : 'border-gray-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-800'}`}>
                                  {meta.label}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  isFlatFee ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  isAnnual  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                             'bg-primary/5 text-primary border-primary/20'
                                }`}>{isFlatFee ? 'Flat Fee at Entry' : isAnnual ? 'Annual' : 'Per Class'}</span>
                                {offerActive && feeRowBt?.offer_label && (
                                  <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                                    {feeRowBt.offer_label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
                            </div>
                          </div>

                          {/* Fee strip */}
                          {(feeRowBt && activeFeeVal !== null) ? (
                            <div className={`border-t px-4 py-2.5 flex items-center gap-4 ${
                              isSelected ? 'bg-primary/10/60 border-primary/20' : 'bg-gray-50 border-gray-100'
                            }`}>
                              {isFlatFee ? (
                                /* Flat-fee: show amount with batch name */
                                <>
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-base font-bold text-amber-700">{fmtRs(activeFeeVal)}</span>
                                    <span className="text-xs text-gray-500">one-time</span>
                                  </div>
                                  {feeRowBt.offer_label && (
                                    <span className="text-xs text-gray-600 font-medium">{feeRowBt.offer_label}</span>
                                  )}
                                  <span className="ml-auto text-[11px] text-amber-600 font-medium">collected at class entry</span>
                                </>
                              ) : !isAnnual ? (
                                /* Per-class fee */
                                <>
                                  <div className="flex items-baseline gap-1.5">
                                    <span className={`text-base font-bold ${offerActive ? 'text-primary' : 'text-gray-800'}`}>
                                      {fmtRs(activeFeeVal)}<span className="text-xs font-normal text-gray-500">/class</span>
                                    </span>
                                  </div>
                                  {offerActive && (
                                    <span className="text-xs line-through text-gray-400">{fmtRs(feeRowBt.fee_paise)}/class</span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {MIN_SESSIONS_DEFAULT} classes = <span className="font-semibold text-gray-700">{fmtRs(activeFeeVal * MIN_SESSIONS_DEFAULT)}</span>
                                  </span>
                                  {expiryDate && <span className="ml-auto text-[11px] text-gray-400">Offer ends {expiryDate}</span>}
                                </>
                              ) : (
                                /* Annual fee */
                                <div className="flex items-center gap-5 w-full flex-wrap">
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Annual</p>
                                    <div className="flex items-baseline gap-1.5">
                                      <span className={`text-base font-bold ${offerActive ? 'text-primary' : 'text-gray-800'}`}>
                                        {fmtRs(activeFeeVal)}
                                      </span>
                                      <span className="text-xs text-gray-400">/yr</span>
                                    </div>
                                    {offerActive && <span className="text-xs line-through text-gray-400">{fmtRs(feeRowBt.fee_paise)}/yr</span>}
                                  </div>
                                  {otpAmount !== null && (
                                    <>
                                      <div className="w-px h-8 bg-gray-200" />
                                      <div>
                                        <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">OTP</p>
                                        <span className="text-base font-bold text-primary">{fmtRs(otpAmount)}</span>
                                      </div>
                                    </>
                                  )}
                                  {savings > 0 && (
                                    <span className="ml-auto text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">
                                      Save {fmtRs(savings)}
                                    </span>
                                  )}
                                  {expiryDate && !savings && <span className="ml-auto text-[11px] text-gray-400">Offer ends {expiryDate}</span>}
                                </div>
                              )}
                            </div>
                          ) : isFlatFee ? (
                            <div className={`border-t px-4 py-2 flex items-center gap-2 ${
                              isSelected ? 'bg-amber-50 border-amber-200' : 'bg-amber-50/50 border-amber-100'
                            }`}>
                              <span className="text-xs text-amber-600 font-medium">Fee amount set per-batch</span>
                              <span className="text-xs text-gray-400">· collected when student joins their first class</span>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {isBatchFlat && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <span className="font-semibold">Flat-fee batch selected.</span> No enrollment fee is collected now. Payment will be automatically requested when the student joins their first live class (if a fee gate is configured for this batch type).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 (conditional) — Subjects or Package */}
          {step === 3 && hasSubjectStep && (
            <div className="space-y-4">
              {isSessionBased && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Subjects *</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">Fee is charged per class, per subject</p>
                      {perSessionRate !== null && (
                        <span className="text-xs font-medium text-primary">· {fmtRs(perSessionRate)}/class</span>
                      )}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => { setShowPerSubject(false); setSelectedSubjects([...perClassSubjects]); }}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                      !showPerSubject ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/40'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        !showPerSubject ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}>
                        {!showPerSubject && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${!showPerSubject ? 'text-primary' : 'text-foreground'}`}>
                          All {perClassSubjects.length} Subjects
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{perClassSubjects.join(' · ')}</p>
                      </div>
                      {!showPerSubject && perSessionRate !== null && (
                        <span className="text-xs font-semibold text-primary shrink-0 ml-2">{fmtRs(perSessionRate)}/class</span>
                      )}
                    </div>
                  </button>
                  <button type="button"
                    onClick={() => { setShowPerSubject(true); if (!showPerSubject) setSelectedSubjects([]); }}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                      showPerSubject ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/40'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        showPerSubject ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}>
                        {showPerSubject && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <p className={`text-sm font-semibold ${showPerSubject ? 'text-primary' : 'text-foreground'}`}>
                        Choose specific subjects
                      </p>
                    </div>
                  </button>
                  {showPerSubject && (
                    <div className="space-y-2 pl-1">
                      {perClassSubjects.map(subj => {
                        const checked = selectedSubjects.includes(subj);
                        return (
                          <button key={subj} type="button"
                            onClick={() => setSelectedSubjects(prev =>
                              checked ? prev.filter(s => s !== subj) : [...prev, subj]
                            )}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                              checked
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border bg-muted/10 text-muted-foreground hover:border-primary/40'
                            }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                                  checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                                }`}>
                                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span>{subj}</span>
                              </div>
                              {perSessionRate !== null && (
                                <span className="text-xs text-muted-foreground font-normal">{fmtRs(perSessionRate)}/class</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {selectedSubjects.length > 0 && showPerSubject && (
                        <div className="flex items-center justify-between pt-1 px-1">
                          <span className="text-xs text-muted-foreground">{selectedSubjects.length} selected</span>
                          <button type="button" onClick={() => setSelectedSubjects(perClassSubjects)}
                            className="text-xs text-primary hover:underline">Select all</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {isPackageBatch && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Subject Package *</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Select the subject combination for this student</p>
                  </div>
                  {(availablePackages as readonly { id: string; label: string; subjects: readonly string[] }[]).map(pkg => {
                    const sel = selectedPackageId === pkg.id;
                    return (
                      <button key={pkg.id} type="button" onClick={() => setSelectedPackageId(pkg.id)}
                        className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                          sel ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/40'
                        }`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            sel ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          }`}>
                            {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${sel ? 'text-primary' : 'text-foreground'}`}>{pkg.label}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(pkg.subjects as readonly string[]).map((s: string) => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{s}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Last Step — Batch Assignment + Payment */}
          {step === LAST_STEP && (
            <div className="space-y-5">
              {/* ── Batch Assignment ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70 mb-3">
                  Batch Assignment <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                </p>
                {loadingBatches ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading batches…
                  </div>
                ) : (
                  <FormField label="Select Batch">
                    <Select value={batchId} onChange={v => setBatchId(v)}
                      options={[
                        { value: '', label: '— No batch (register only) —' },
                        ...batchOptions.filter(b => {
                          if (!preferredBatchType) return true;
                          const bt = batches.find(bb => bb.batch_id === b.value);
                          return !bt || bt.batch_type === preferredBatchType;
                        }),
                      ]} />
                  </FormField>
                )}
                {selectedBatch && (
                  <div className="mt-2 space-y-2">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="capitalize">{selectedBatch.batch_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Students</span>
                        <span>{selectedBatch.student_count} / {selectedBatch.max_students}</span>
                      </div>
                    </div>
                    {feeRow && <FeeBreakdownCard feeRow={feeRow} />}
                  </div>
                )}
              </div>

              {/* ── Payment & Credits ── */}
              <div className="border-t pt-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Payment & Credits</p>

                {/* Payment mode */}
                <FormGrid cols={1}>
                  <FormField label="Payment Mode">
                    <Select value={paymentMode} onChange={setPaymentMode} options={PAYMENT_MODE_OPTIONS} />
                  </FormField>
                </FormGrid>

                {/* Amount + method */}
                {paymentMode !== 'none' && (
                  <>
                    {/* Fee reference for group batches */}
                    {batchId && !effectiveIsPerClass && feeRow && (() => {
                      const bd = computeFeeBreakdown(feeRow);
                      const fmt = (p: number) => fmtPaise(p, feeRow.currency || 'INR');
                      return (
                        <div className="rounded-lg border bg-primary/5 border-primary/20 dark:bg-primary/30/20 dark:border-emerald-800 p-3 text-sm">
                          <p className="text-xs font-semibold text-primary dark:text-primary uppercase tracking-wide mb-2">Fee Reference</p>
                          <div className="flex gap-4 flex-wrap">
                            <div><p className="text-[10px] text-muted-foreground uppercase">OTP</p><p className="font-bold text-primary dark:text-primary">{fmt(bd.otpTotal)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase">SPO Q1</p><p className="font-bold text-foreground">{fmt(bd.q123)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase">SPO Q4</p><p className="font-bold text-foreground">{fmt(bd.q4)}</p></div>
                          </div>
                        </div>
                      );
                    })()}
                    <FormGrid cols={2}>
                      <FormField label="Payment Method">
                        <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} />
                      </FormField>
                      <FormField label="Amount (₹) *">
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input type="number" min="1" step="1"
                            value={amountRs} onChange={e => setAmountRs(e.target.value)}
                            placeholder="0" className="pl-7" />
                        </div>
                      </FormField>
                    </FormGrid>
                    {effectiveIsPerClass && effectiveFeeRate !== null && derivedSessions > 0 && (
                      <div className="rounded-lg bg-primary/5 dark:bg-primary/30/20 border border-primary/20 dark:border-emerald-700 px-3 py-2 text-sm flex items-center gap-1.5">
                        <span className="font-bold text-primary dark:text-primary">{derivedSessions} sessions</span>
                        <span className="text-muted-foreground">will be credited at {fmtPaise(effectiveFeeRate, 'INR')}/class</span>
                      </div>
                    )}
                    <FormGrid cols={1}>
                      <FormField label="Transaction Ref / Receipt No." hint="Cheque no., UTR, UPI ID, etc.">
                        <Input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="Optional" />
                      </FormField>
                    </FormGrid>
                  </>
                )}

                {/* Notes */}
                <FormGrid cols={1}>
                  <FormField label="Notes">
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional internal notes" />
                  </FormField>
                </FormGrid>

                {/* OTP / SPO payment plan selector (group batches only) */}
                {effectiveIsGroup && groupBreakdown && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Payment Plan</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* OTP card */}
                      <button type="button" onClick={() => setPaymentType('otp')}
                        className={`text-left rounded-xl border-2 p-3.5 transition-all ${
                          paymentType === 'otp'
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-emerald-300 bg-white'
                        }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            paymentType === 'otp' ? 'border-emerald-600 bg-primary' : 'border-gray-300'
                          }`}>
                            {paymentType === 'otp' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-bold text-foreground">OTP</span>
                          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-semibold ml-auto">One-Time</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Pay once, save more</p>
                        <p className="text-base font-bold text-primary">{fmtRs(groupBreakdown.otpTotal)}</p>
                        {groupBreakdown.otpTotal < groupBreakdown.regularFee && (
                          <p className="text-[11px] text-primary mt-0.5">Save {fmtRs(groupBreakdown.regularFee - groupBreakdown.otpTotal)}</p>
                        )}
                      </button>
                      {/* SPO card */}
                      <button type="button" onClick={() => setPaymentType('spo')}
                        className={`text-left rounded-xl border-2 p-3.5 transition-all ${
                          paymentType === 'spo'
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-border hover:border-blue-300 bg-white'
                        }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            paymentType === 'spo' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          }`}>
                            {paymentType === 'spo' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-bold text-foreground">SPO</span>
                          <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold ml-auto">Split</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Pay in quarterly installments</p>
                        <div className="space-y-0.5">
                          <p className="text-xs"><span className="font-semibold text-foreground">{fmtRs(groupBreakdown.q123)}</span> <span className="text-muted-foreground">× Q1/Q2/Q3</span></p>
                          <p className="text-xs"><span className="font-semibold text-foreground">{fmtRs(groupBreakdown.q4)}</span> <span className="text-muted-foreground">× Q4</span></p>
                        </div>
                      </button>
                    </div>
                    {/* Invoice generation note */}
                    <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700">
                      {paymentType === 'otp' ? (
                        paymentMode === 'none'
                          ? <>Pending invoice for <strong>{fmtRs(groupBreakdown.otpTotal)}</strong> will be created (due in 30 days). Student blocked until paid.</>
                          : paymentMode === 'advance' && amountRs && parseFloat(amountRs) > 0 && groupBreakdown.otpTotal > Math.round(parseFloat(amountRs) * 100)
                            ? <>Paid receipt + pending balance invoice for <strong>{fmtRs(groupBreakdown.otpTotal - Math.round(parseFloat(amountRs) * 100))}</strong> (due in 30 days).</>
                            : <>Single paid invoice for OTP amount. No payment gate.</>
                      ) : (
                        paymentMode === 'none'
                          ? <>Q1 pending invoice (<strong>{fmtRs(groupBreakdown.q123)}</strong>) + Q2/Q3/Q4 scheduled automatically.</>
                          : <>Q1 {paymentMode === 'full' ? 'fully paid' : 'partially paid'} + Q2/Q3/Q4 scheduled. Gate activates before Q2.</>
                      )}
                    </div>
                  </div>
                )}

                {/* Skip payment gate toggle */}
                {batchId && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Skip payment gate</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {skipPaymentGate
                            ? 'Student can join any live session without payment prompts'
                            : isPerClassBatch
                              ? 'Student uses session credits to join classes'
                              : 'Group batch — no per-session gate'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setSkipPaymentGate(v => !v)} aria-pressed={skipPaymentGate}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          skipPaymentGate ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          skipPaymentGate ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                    {skipPaymentGate && (
                      <p className="mt-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                        ⚠ This student will bypass all payment checks
                      </p>
                    )}
                  </div>
                )}

                {/* Payment summary */}
                {paymentMode !== 'none' && amountRs && parseFloat(amountRs) > 0 && (
                  <div className="rounded-lg border bg-primary/5 dark:bg-primary/30/20 border-primary/20 dark:border-emerald-800 p-4">
                    <p className="text-sm font-semibold text-primary dark:text-primary/80 mb-2">Payment Summary</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode</span>
                        <span className="font-medium capitalize">{paymentMode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold text-primary dark:text-primary">₹{parseFloat(amountRs || '0').toLocaleString('en-IN')}</span>
                      </div>
                      {effectiveIsPerClass && derivedSessions > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Session credits</span>
                          <span className="font-medium">{derivedSessions} sessions</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-medium">{PAYMENT_METHOD_OPTIONS.find(m => m.value === paymentMethod)?.label}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Invoice and receipt will be generated and shown in student &amp; parent dashboards.</p>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      )}
      </div>
    </WizardShell>
  );
}
