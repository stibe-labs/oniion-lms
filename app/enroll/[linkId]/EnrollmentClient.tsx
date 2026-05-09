'use client';

import { useState, useCallback } from 'react';
import Script from 'next/script';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { usePlatformName } from '@/components/providers/PlatformProvider';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

// ── Types ────────────────────────────────────────────────────


interface FeeRow {
  id: string;
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
  fee_type: string | null;
  batch_name: string | null;
}

interface LinkData {
  student_name: string;
  student_email: string;
  student_phone: string;
  student_grade: string | null;
  student_board: string | null;
  student_region: string | null;
  student_whatsapp: string | null;
  student_dob: string | null;
  student_section: string | null;
  student_parent_name: string | null;
  student_parent_email: string | null;
  student_parent_phone: string | null;
  preferred_batch_type: string | null;
  enrollment_category: string | null;
  minimum_sessions: number;
  status: string;
}

interface SubjectPackage { id: string; label: string; subjects: string[] }

interface Constants {
  student_regions: { value: string; label: string }[];
  boards: string[];
  eligible_grades: string[];
  batch_type_labels: Record<string, string>;
  perClassSubjectsByGrade: Record<string, string[]>;
  oneToFifteenPackages: SubjectPackage[];
  oneToThirtyPackages: SubjectPackage[];
  oneToManySubjectsByGrade: Record<string, string[]>;
  minSessionsDefault: number;
  minSessionsMinimum: number;
}

export interface Props {
  linkId: string;
  initialLink: LinkData;
  feeStructure: FeeRow[];
  constants: Constants;
  isPaid: boolean;
  isExpired: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function formatRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// HSS covers Class 11 and Class 12 — both map to the same fee row
function toFeeGrade(grade: string): string {
  return (grade === '11' || grade === '12') ? 'HSS' : grade;
}

const GCC_REGIONS = new Set([
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
  'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
]);

// Non-GCC regions that map to the 'Kerala' fee group
const KERALA_REGIONS = new Set(['India']);

function getCategory(region: string, board: string) {
  if (GCC_REGIONS.has(region)) return 'GCC_CBSE';
  if (board === 'State Board') return 'KERALA_STATE';
  return 'KERALA_CBSE';
}

const SESSION_BASED = new Set(['one_to_one', 'one_to_three']);

function isOfferActive(row: Pick<FeeRow, 'early_bird_fee_paise' | 'offer_expires_at'>): boolean {
  if (!row.early_bird_fee_paise) return false;
  if (!row.offer_expires_at) return true;
  return new Date(row.offer_expires_at) > new Date();
}

function getActiveFee(row: Pick<FeeRow, 'fee_paise' | 'early_bird_fee_paise' | 'offer_expires_at'>): number {
  return isOfferActive(row) ? (row.early_bird_fee_paise ?? row.fee_paise) : row.fee_paise;
}

const CATEGORY_MAP: Record<string, { rg: string; b: string }> = {
  GCC_CBSE:     { rg: 'GCC', b: 'CBSE' },
  KERALA_CBSE:  { rg: 'Kerala', b: 'CBSE' },
  KERALA_STATE: { rg: 'Kerala', b: 'State Board' },
};

const BATCH_TYPE_ORDER = ['one_to_one', 'one_to_three', 'one_to_fifteen', 'one_to_thirty', 'one_to_many', 'improvement_batch', 'special', 'custom', 'lecture'];
const SPECIAL_BATCH_TYPES_SET = new Set(['improvement_batch', 'special', 'custom', 'lecture']);

function normalizeGrade(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  const cm = s.match(/^(?:Class|Grade)\s+(\d+)$/i);
  if (cm) return cm[1];
  const om = s.match(/^(\d+)(?:st|nd|rd|th)?$/i);
  if (om) return om[1];
  if (/^hss$/i.test(s)) return '11';
  return s;
}

// ── Shared style constants ───────────────────────────────────

const INPUT_BASE = 'peer w-full h-14 px-4 pt-4 rounded-xl border bg-gray-50 text-gray-900 text-[15px] outline-none transition-all duration-200 sm:bg-white/10 sm:text-white';
const INPUT_FOCUS = 'border-emerald-500 ring-2 ring-emerald-500/10 sm:border-emerald-400/60 sm:ring-emerald-400/15';
const INPUT_IDLE = 'border-gray-200 hover:border-gray-300 sm:border-white/15 sm:hover:border-white/25';
const INPUT_FILLED = 'border-emerald-500/40 sm:border-emerald-400/30';
const LABEL_ACTIVE = 'top-1.5 text-[11px] font-medium text-emerald-600 sm:text-emerald-300';
const LABEL_IDLE = 'top-1/2 -translate-y-1/2 text-[15px] text-gray-400 sm:text-emerald-200/50';
const SELECT_ARROW = (
  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
    <svg className="size-4 text-gray-400 sm:text-emerald-200/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </div>
);

// ── Main Component ───────────────────────────────────────────

export default function EnrollmentClient({
  linkId, initialLink, feeStructure, constants, isPaid, isExpired,
}: Props) {
  const platformName = usePlatformName();
  // Step state
  const [step, setStep] = useState(1);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(isPaid);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  void razorpayLoaded;

  // Focus states for floating labels
  const [focused, setFocused] = useState<Record<string, boolean>>({});
  const setFocus = (field: string, val: boolean) => setFocused(prev => ({ ...prev, [field]: val }));

  // Personal (Step 1)
  const [name, setName] = useState(initialLink.student_name || '');
  const [email, setEmail] = useState(initialLink.student_email || '');
  const [phone, setPhone] = useState(initialLink.student_phone || '');
  const [whatsapp, setWhatsapp] = useState(initialLink.student_whatsapp || '');
  const [dob, setDob] = useState(initialLink.student_dob || '');

  // Guardian (Step 2)
  const [grade, setGrade] = useState(normalizeGrade(initialLink.student_grade));
  const [board, setBoard] = useState(initialLink.student_board || '');
  const [region, setRegion] = useState(initialLink.student_region || '');
  const [section, setSection] = useState(initialLink.student_section || '');
  const [batchType, setBatchType] = useState(initialLink.preferred_batch_type || '');

  // Academic (Step 3)
  const [parentName, setParentName] = useState(initialLink.student_parent_name || '');
  const [parentEmail, setParentEmail] = useState(initialLink.student_parent_email || '');
  const [parentPhone, setParentPhone] = useState(initialLink.student_parent_phone || '');

  // Subjects & session count
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showPerSubject, setShowPerSubject] = useState(false);
  const [subjectsInitialized, setSubjectsInitialized] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [sessionCount, setSessionCount] = useState(constants.minSessionsDefault);
  const [sessionCountStr, setSessionCountStr] = useState(String(constants.minSessionsDefault));

  // Payment plan — OTP or SPO (quarterly); only relevant for annual batches
  const [paymentPlan, setPaymentPlan] = useState<'otp' | 'quarterly'>('otp');

  // Derived state
  const category = (region && board) ? getCategory(region, board) : null;
  const sessionBased = SESSION_BASED.has(batchType);
  const feeGrade = toFeeGrade(grade);

  // Derive regions that actually have fee data (GCC countries + India only)
  const availableRegions = (() => {
    const feeGroups = new Set(feeStructure.map(f => f.region_group));
    return constants.student_regions.filter(r => {
      if (GCC_REGIONS.has(r.value)) return feeGroups.has('GCC');
      if (KERALA_REGIONS.has(r.value)) return feeGroups.has('Kerala');
      return false; // Malaysia, Singapore, UK, USA, Other — no fee data
    });
  })();

  // Derive available boards for the selected region from fee structure
  // GCC regions → only CBSE; Kerala/India → CBSE + State Board (whatever is in the fee data)
  const availableBoards = (() => {
    if (!region) return constants.boards;
    const rg = GCC_REGIONS.has(region) ? 'GCC' : 'Kerala';
    const boards = [...new Set(feeStructure.filter(f => f.region_group === rg).map(f => f.board))].sort();
    return boards.length > 0 ? boards : constants.boards;
  })();

  // Derive available batch types from fee structure for the selected region/board (/grade)
  // Also always include preferred_batch_type if it's a special (flat-fee) type
  const availableBatchTypes = (() => {
    const seen = new Set<string>();
    const types: string[] = [];

    // Regular rows: match region+board (and optionally grade)
    if (category) {
      const { rg, b } = CATEGORY_MAP[category] || {};
      if (rg && b) {
        const rows = grade
          ? feeStructure.filter(f => f.region_group === rg && f.board === b && f.grade === feeGrade)
          : feeStructure.filter(f => f.region_group === rg && f.board === b);
        for (const r of rows) {
          if (!seen.has(r.batch_type)) { seen.add(r.batch_type); types.push(r.batch_type); }
        }
      }
    }

    // Flat-fee rows (region_group='all') — always shown regardless of region/board
    const flatRows = feeStructure.filter(f => f.fee_type === 'batch_flat');
    for (const r of flatRows) {
      if (!seen.has(r.batch_type)) { seen.add(r.batch_type); types.push(r.batch_type); }
    }

    // Include the preferred_batch_type from the link if it's a special type and not already added
    const preferred = initialLink.preferred_batch_type;
    if (preferred && SPECIAL_BATCH_TYPES_SET.has(preferred) && !seen.has(preferred)) {
      seen.add(preferred); types.push(preferred);
    }
    return types.sort((a, z) => BATCH_TYPE_ORDER.indexOf(a) - BATCH_TYPE_ORDER.indexOf(z));
  })();

  // 1:M + HSS (Class 11/12) needs package selection (PCB+M or PCS+M); lower grades auto-set
  const isOneToManyHSS = batchType === 'one_to_many' && feeGrade === 'HSS';
  // Package-selection batches: 1:15, 1:30, and 1:M for HSS
  const isPackageBatch = batchType === 'one_to_fifteen' || batchType === 'one_to_thirty' || isOneToManyHSS;
  // 1:M auto-sets all subjects only for non-HSS grades
  const isAutoSubjectBatch = batchType === 'one_to_many' && !isOneToManyHSS;
  // Any batch that needs a Step 4 before payment
  const hasSelectionStep = sessionBased || isPackageBatch;

  // Per-class (1:1/1:3) available subjects
  const perClassSubjects = sessionBased
    ? (constants.perClassSubjectsByGrade[feeGrade] || constants.perClassSubjectsByGrade['10'])
    : [];

  // Packages for the current batch type
  const availablePackages: SubjectPackage[] = batchType === 'one_to_fifteen'
    ? constants.oneToFifteenPackages
    : (batchType === 'one_to_thirty' || isOneToManyHSS)
      ? constants.oneToThirtyPackages
      : [];

  // Auto-select all per-class subjects by default
  if (sessionBased && perClassSubjects.length > 0 && !subjectsInitialized && selectedSubjects.length === 0) {
    setSelectedSubjects(perClassSubjects);
    setSubjectsInitialized(true);
  }

  // Auto-set 1:M subjects when grade changes
  if (isAutoSubjectBatch && grade) {
    const auto = constants.oneToManySubjectsByGrade[feeGrade] || constants.oneToManySubjectsByGrade['10'];
    if (auto.join(',') !== selectedSubjects.join(',')) {
      setSelectedSubjects(auto);
    }
  }

  // Look up annual fee from structure
  const annualFee = (() => {
    if (!category || sessionBased || !grade || !batchType) return null;
    const { rg, b } = CATEGORY_MAP[category] || {};
    return feeStructure.find(
      f => f.region_group === rg && f.board === b && f.batch_type === batchType && f.grade === toFeeGrade(grade),
    ) || null;
  })();

  // Session fee per subject (same rate for all subjects — from fee structure)
  const sessionFeeRow = (() => {
    if (!category || !sessionBased || !grade || !batchType) return null;
    const { rg, b } = CATEGORY_MAP[category] || {};
    return feeStructure.find(
      f => f.region_group === rg && f.board === b && f.batch_type === batchType && f.grade === toFeeGrade(grade),
    ) || null;
  })();
  const perSessionRate = sessionFeeRow ? getActiveFee(sessionFeeRow) : 0;

  // Session-based total (flat advance for N sessions, regardless of subject count)
  const sessionTotal = perSessionRate * sessionCount;

  // For annual batches, student pays OTP (one-time) = EB × 90% or Regular × 75% with offer
  const annualOtpAmount = (() => {
    if (!annualFee) return 0;
    const base = isOfferActive(annualFee) ? annualFee.fee_paise : (annualFee.early_bird_fee_paise ?? annualFee.fee_paise);
    const rate = isOfferActive(annualFee) ? 0.75 : 0.90;
    return Math.round(base * rate);
  })();
  const annualSpoTotal = (() => {
    if (!annualFee) return 0;
    const base = isOfferActive(annualFee) ? annualFee.fee_paise : (annualFee.early_bird_fee_paise ?? annualFee.fee_paise);
    return Math.round(base * (isOfferActive(annualFee) ? 0.80 : 0.95));
  })();
  const annualQ123 = Math.round(annualSpoTotal * 0.30);
  const annualQ4   = annualSpoTotal - annualQ123 * 3;

  // For annual: OTP = full OTP amount; SPO = Q1 only (30% of SPO total)
  const totalAmount = sessionBased
    ? sessionTotal
    : paymentPlan === 'quarterly'
      ? annualQ123  // Q1 = 30% of SPO total
      : annualOtpAmount;

  // ── Validation ───────────────────────────────────────────

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!name.trim()) return 'Full name is required';
      if (!email.trim() || !email.includes('@')) return 'Valid email is required';
      if (!phone.trim()) return 'Phone number is required';
    }
    if (s === 2) {
      if (!parentName.trim()) return 'Parent / Guardian name is required';
      if (!parentEmail.trim() || !parentEmail.includes('@')) return 'Valid parent email is required';
    }
    if (s === 3) {
      if (!grade) return 'Grade is required';
      if (!board) return 'Board is required';
      if (!region) return 'Region is required';
      if (!batchType) return 'Batch type preference is required';
    }
    if (s === 4 && sessionBased) {
      if (selectedSubjects.length === 0) return 'Select at least one subject';
      if (sessionCount < constants.minSessionsMinimum) return `Minimum ${constants.minSessionsMinimum} sessions required`;
    }
    if (s === 4 && isPackageBatch) {
      if (!selectedPackageId) return 'Please select a subject package';
    }
    return null;
  };

  // ── Save profile (PATCH) ─────────────────────────────────

  const saveProfile = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/enroll/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: name.trim(),
          student_email: email.trim().toLowerCase(),
          student_phone: phone.trim(),
          student_whatsapp: whatsapp.trim() || null,
          student_dob: dob || null,
          student_grade: `Class ${grade}`,
          student_board: board,
          student_region: region,
          student_section: section.trim() || null,
          student_parent_name: parentName.trim(),
          student_parent_email: parentEmail.trim().toLowerCase(),
          student_parent_phone: parentPhone.trim() || null,
          preferred_batch_type: batchType,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to save profile');
        return false;
      }
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [linkId, name, email, phone, whatsapp, dob, grade, board, region, section, parentName, parentEmail, parentPhone, batchType]);

  // ── Navigation ───────────────────────────────────────────

  const goNext = async () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');

    if (step === 3) {
      const ok = await saveProfile();
      if (!ok) return;
    }

    // When a package is selected, lock in its subjects
    if (step === 4 && isPackageBatch && selectedPackageId) {
      const pkg = availablePackages.find(p => p.id === selectedPackageId);
      if (pkg) setSelectedSubjects([...pkg.subjects]);
    }

    setStep(step + 1);
  };

  const goBack = () => {
    setError('');
    setStep(step - 1);
  };

  // ── Payment ──────────────────────────────────────────────

  const handlePay = useCallback(async () => {
    if (sessionBased && selectedSubjects.length === 0) {
      setError('Please select at least one subject.');
      return;
    }
    setPaying(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/enroll/${linkId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_subjects: selectedSubjects,
          minimum_sessions: sessionBased ? sessionCount : undefined,
          payment_plan: sessionBased ? 'otp' : paymentPlan,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.paid) { setPaid(true); return; }
        setError(data.error || 'Failed to initiate payment');
        setPaying(false);
        return;
      }

      const { invoice_id, token, order } = data.data;

      // Mock / test mode
      if (order.mode === 'test' || order.mode === 'mock') {
        const verifyRes = await fetch(`/api/v1/payment/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            invoice_id,
            razorpay_payment_id: `mock_${Date.now()}`,
            razorpay_order_id: order.orderId || `mock_order_${Date.now()}`,
            razorpay_signature: 'mock_signature',
          }),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) setPaid(true);
        else setError(verifyData.error || 'Payment verification failed');
        setPaying(false);
        return;
      }

      // Live Razorpay
      if (!window.Razorpay) {
        setError('Payment gateway not loaded. Please refresh.');
        setPaying(false);
        return;
      }

      const razorpay = new window.Razorpay({
        key: order.gatewayKeyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: platformName,
        description: 'Enrollment Payment',
        order_id: order.orderId,
        prefill: {
          name: name.trim(),
          email: email.trim(),
          contact: phone.trim(),
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(`/api/v1/payment/callback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token,
                invoice_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) setPaid(true);
            else setError(verifyData.error || 'Payment verification failed');
          } catch {
            setError('Payment verification failed');
          }
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      razorpay.open();
    } catch {
      setError('Network error');
      setPaying(false);
    }
  }, [linkId, name, email, phone, sessionBased, sessionCount, selectedSubjects, paymentPlan]);

  // ── Error banner ──────────────────────────────────────────
  const errorBanner = error ? (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 sm:bg-red-500/15 sm:border-red-400/30 sm:text-red-300 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-red-100 sm:bg-red-400/25 flex items-center justify-center">
        <span className="text-red-500 sm:text-red-300 text-[10px] font-bold">!</span>
      </span>
      <span>{error}</span>
    </div>
  ) : null;

  // ── Paid screen ──────────────────────────────────────────

  if (paid) {
    return (
      <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
        <div className="sm:hidden mb-6">
          <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 sm:bg-emerald-400/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="size-8 text-emerald-600 sm:text-emerald-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-500 sm:text-emerald-200/70 text-[14px] mb-8">
            Thank you, <strong className="text-gray-900 sm:text-white font-medium">{name || initialLink.student_name}</strong>! Your enrollment is confirmed.
          </p>

          <div className="rounded-xl bg-gray-50 border border-gray-200 sm:bg-white/5 sm:border-white/10 p-5 text-left">
            <p className="font-medium text-gray-900 sm:text-white text-sm mb-3">Enrollment Details</p>
            <div className="space-y-2 text-[13px]">
              {grade && (
                <div className="flex justify-between">
                  <span className="text-gray-500 sm:text-emerald-200/60">Grade</span>
                  <span className="font-medium text-gray-900 sm:text-white">Class {grade}</span>
                </div>
              )}
              {board && (
                <div className="flex justify-between">
                  <span className="text-gray-500 sm:text-emerald-200/60">Board</span>
                  <span className="font-medium text-gray-900 sm:text-white">{board}</span>
                </div>
              )}
              {batchType && (
                <div className="flex justify-between">
                  <span className="text-gray-500 sm:text-emerald-200/60">Batch Type</span>
                  <span className="font-medium text-gray-900 sm:text-white">{constants.batch_type_labels[batchType] || batchType}</span>
                </div>
              )}
              {totalAmount > 0 && (
                <div className="flex justify-between pt-2 border-t border-gray-200 sm:border-white/10">
                  <span className="text-gray-500 sm:text-emerald-200/60">Amount Paid</span>
                  <span className="font-bold text-emerald-700 sm:text-emerald-300">{formatRupees(totalAmount)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 sm:bg-white/5 sm:border-white/10 p-5 text-left mt-4">
            <p className="font-medium text-gray-900 sm:text-white text-sm mb-3">What happens next?</p>
            <ol className="list-decimal list-inside space-y-2 text-[13px] text-gray-500 sm:text-emerald-200/60">
              <li>Our team will review your enrollment within <strong className="text-gray-900 sm:text-white font-medium">24 hours</strong></li>
              <li>You&apos;ll be assigned to the right batch and receive a <strong className="text-gray-900 sm:text-white font-medium">welcome email</strong></li>
              <li>Login credentials will be shared for accessing <strong className="text-gray-900 sm:text-white font-medium">{platformName} classes</strong></li>
            </ol>
          </div>

          <p className="mt-6 text-[13px] text-gray-400 sm:text-emerald-200/40">
            Check your email for updates from {platformName}.
          </p>
        </div>
      </div>
    );
  }

  // ── Expired screen ───────────────────────────────────────

  if (isExpired) {
    return (
      <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
        <div className="sm:hidden mb-6">
          <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-red-50 sm:bg-red-400/15 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="size-8 text-red-500 sm:text-red-300" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Link Expired</h1>
          <p className="text-gray-500 sm:text-emerald-200/60 text-[14px]">
            This enrollment link has expired. Please contact our team for a new link.
          </p>
        </div>
      </div>
    );
  }

  // ── Step labels ──────────────────────────────────────────

  const selectionLabel = sessionBased ? 'Subjects' : isPackageBatch ? 'Package' : null;
  const stepLabels = hasSelectionStep
    ? ['Personal', 'Guardian', 'Academic', selectionLabel ?? 'Subjects', 'Payment']
    : ['Personal', 'Guardian', 'Academic', 'Payment'];
  const currentStepIdx = step - 1;
  const isPaymentStep = hasSelectionStep ? step === 5 : step === 4;
  const isSubjectStep = sessionBased && step === 4;
  const isPackageStep = isPackageBatch && step === 4;

  // ── Processing payment screen ────────────────────────────

  if (paying) {
    return (
      <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
        <div className="sm:hidden mb-6">
          <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-emerald-600 sm:text-emerald-300" />
          <p className="mt-4 text-gray-900 sm:text-white font-medium text-[15px]">Processing payment…</p>
          <p className="mt-1 text-[13px] text-gray-400 sm:text-emerald-200/40">Please complete the payment in the popup</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // MULTI-STEP ENROLLMENT FORM
  // ════════════════════════════════════════════════════════════

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} />

      <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
        {/* Logo — mobile only */}
        <div className="mb-6 sm:hidden">
          <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-white mb-2">Enrollment</h1>
          <p className="text-gray-500 sm:text-emerald-200/70 text-[15px]">
            Complete your enrollment to start <strong className="text-gray-900 sm:text-white font-medium">learning with {platformName}</strong>.
          </p>
        </div>

        {/* Step progress bar */}
        <div className="flex items-center gap-1.5 mb-6">
          {stepLabels.map((label, idx) => {
            const done = idx < currentStepIdx;
            const active = idx === currentStepIdx;
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`h-1.5 w-full rounded-full transition-colors ${
                  done ? 'bg-emerald-500 sm:bg-emerald-400' : active ? 'bg-emerald-500 sm:bg-emerald-400' : 'bg-gray-200 sm:bg-white/15'
                }`} />
                <span className={`text-[10px] font-medium transition-colors ${
                  active ? 'text-emerald-600 sm:text-emerald-300' : done ? 'text-gray-500 sm:text-emerald-200/50' : 'text-gray-400 sm:text-emerald-200/30'
                }`}>{label}</span>
              </div>
            );
          })}
        </div>

        {errorBanner}
        {error && <div className="h-3" />}

        {/* ── Step 1: Personal Details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <FloatingInput id="enroll-name" label="Full Name" value={name} onChange={setName}
              focused={!!focused.name} onFocus={() => setFocus('name', true)} onBlur={() => setFocus('name', false)} />
            <FloatingInput id="enroll-email" label="Email Address" type="email" value={email} onChange={setEmail}
              focused={!!focused.email} onFocus={() => setFocus('email', true)} onBlur={() => setFocus('email', false)} />
            <FloatingInput id="enroll-phone" label="Phone Number" type="tel" value={phone} onChange={setPhone}
              focused={!!focused.phone} onFocus={() => setFocus('phone', true)} onBlur={() => setFocus('phone', false)} />
            <FloatingInput id="enroll-whatsapp" label="WhatsApp (if different)" type="tel" value={whatsapp} onChange={setWhatsapp}
              focused={!!focused.whatsapp} onFocus={() => setFocus('whatsapp', true)} onBlur={() => setFocus('whatsapp', false)} />
            <FloatingInput id="enroll-dob" label="Date of Birth" type="date" value={dob} onChange={setDob}
              focused={!!focused.dob} onFocus={() => setFocus('dob', true)} onBlur={() => setFocus('dob', false)} alwaysActive />
            <PrimaryButton onClick={goNext} label="Continue" />
          </div>
        )}

        {/* ── Step 2: Guardian Details ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="mb-2">
              <p className="text-[13px] font-medium text-gray-500 sm:text-emerald-200/60 uppercase tracking-wider">
                Parent / Guardian
              </p>
              <p className="text-[12px] text-gray-400 sm:text-emerald-200/40 mt-0.5">
                We&apos;ll create a parent account for progress updates
              </p>
            </div>

            <FloatingInput id="enroll-parent-name" label="Parent / Guardian Name" value={parentName} onChange={setParentName}
              focused={!!focused.parentName} onFocus={() => setFocus('parentName', true)} onBlur={() => setFocus('parentName', false)} />
            <FloatingInput id="enroll-parent-email" label="Parent Email" type="email" value={parentEmail} onChange={setParentEmail}
              focused={!!focused.parentEmail} onFocus={() => setFocus('parentEmail', true)} onBlur={() => setFocus('parentEmail', false)} />
            <FloatingInput id="enroll-parent-phone" label="Parent Phone (optional)" type="tel" value={parentPhone} onChange={setParentPhone}
              focused={!!focused.parentPhone} onFocus={() => setFocus('parentPhone', true)} onBlur={() => setFocus('parentPhone', false)} />

            <div className="flex gap-3 pt-1">
              <SecondaryButton onClick={goBack} label="Back" />
              <PrimaryButton onClick={goNext} disabled={false} label="Continue" />
            </div>
          </div>
        )}

        {/* ── Step 3: Academic Details ── */}
        {step === 3 && (
          <div className="space-y-4">
            <FloatingSelect id="enroll-region" label="Region / Location" value={region}
              onChange={v => {
                setRegion(v);
                setBatchType('');
                // GCC regions always use CBSE — auto-set and skip board picker
                setBoard(GCC_REGIONS.has(v) ? 'CBSE' : '');
              }}
              options={availableRegions.map(r => ({ value: r.value, label: r.label }))} />
            <FloatingSelect id="enroll-grade" label="Grade / Class" value={grade}
              onChange={v => { setGrade(v); setBatchType(''); setSelectedSubjects([]); setSubjectsInitialized(false); setShowPerSubject(false); }}
              options={constants.eligible_grades.map(g => ({ value: g, label: `Class ${g}` }))} />
            {region && availableBoards.length === 1 ? (
              // Single board for this region (e.g. GCC → CBSE) — show as read-only
              <div className="relative">
                <div className={`${INPUT_BASE} ${INPUT_FILLED} flex items-end pb-3`}>
                  <span className="text-[15px] text-gray-900 sm:text-white">{availableBoards[0]}</span>
                </div>
                <label className={`absolute left-4 pointer-events-none ${LABEL_ACTIVE}`}>Board</label>
              </div>
            ) : (
              <FloatingSelect id="enroll-board" label="Board" value={board}
                onChange={v => { setBoard(v); setBatchType(''); setSelectedSubjects([]); setSubjectsInitialized(false); setShowPerSubject(false); }}
                options={availableBoards.map(b => ({ value: b, label: b }))} />
            )}
            <FloatingInput id="enroll-section" label="Section (optional)" value={section} onChange={setSection}
              focused={!!focused.section} onFocus={() => setFocus('section', true)} onBlur={() => setFocus('section', false)} />

            {/* Batch Type Selection */}
            {(category || feeStructure.some(f => f.fee_type === 'batch_flat')) && (
              <div className="space-y-2.5">
                <p className="text-[13px] font-medium text-gray-500 sm:text-emerald-200/60 uppercase tracking-wider">
                  Batch Type Preference
                </p>
                <div className="space-y-2">
                  {availableBatchTypes.map(bt => {
                    const isFlatType = feeStructure.some(f => f.fee_type === 'batch_flat' && f.batch_type === bt);
                    const flatRow = isFlatType ? feeStructure.find(f => f.fee_type === 'batch_flat' && f.batch_type === bt) : null;
                    const label = flatRow?.batch_name || constants.batch_type_labels[bt] || bt;
                    const feeRow = (!isFlatType && grade && category) ? feeStructure.find(f => {
                      const { rg, b } = CATEGORY_MAP[category] || {};
                      return f.region_group === rg && f.board === b && f.batch_type === bt && f.grade === feeGrade;
                    }) : null;
                    const selected = batchType === bt;
                    return (
                      <button key={bt} type="button" onClick={() => setBatchType(bt)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10 sm:bg-emerald-400/15 sm:border-emerald-400/40 sm:ring-emerald-400/15'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300 sm:border-white/10 sm:bg-white/5 sm:hover:border-white/20'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm font-medium ${selected ? 'text-emerald-700 sm:text-emerald-300' : 'text-gray-900 sm:text-white'}`}>
                              {label}
                            </span>
                            {isFlatType ? (
                              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 sm:bg-amber-400/15 sm:text-amber-300">
                                Flat Fee
                              </span>
                            ) : (
                              <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                !SESSION_BASED.has(bt)
                                  ? 'bg-blue-100 text-blue-700 sm:bg-blue-400/15 sm:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-700 sm:bg-emerald-400/15 sm:text-emerald-300'
                              }`}>
                                {!SESSION_BASED.has(bt) ? 'Annual' : 'Per Class'}
                              </span>
                            )}
                          </div>
                          {flatRow ? (
                            <div className="text-right shrink-0">
                              <div className={`text-sm font-bold ${selected ? 'text-amber-700 sm:text-amber-300' : 'text-gray-600 sm:text-emerald-200/60'}`}>
                                {formatRupees(flatRow.fee_paise)} flat
                              </div>
                              <div className="text-[9px] text-gray-400 sm:text-emerald-200/35">paid at class entry</div>
                            </div>
                          ) : feeRow ? (() => {
                            const offerOn = isOfferActive(feeRow);
                            const activeFee = getActiveFee(feeRow);
                            const isPerClass = SESSION_BASED.has(bt);
                            const expiryDate = feeRow.offer_expires_at
                              ? new Date(feeRow.offer_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              : null;
                            if (isPerClass) {
                              // Advance hint: minSessionsDefault × activeFee
                              const advanceAmt = activeFee * constants.minSessionsDefault;
                              return (
                                <div className="text-right shrink-0 space-y-0.5">
                                  {offerOn && feeRow.offer_label && (
                                    <div className="text-[9px] font-bold text-white bg-amber-500 sm:bg-amber-500/80 px-1.5 py-0.5 rounded-full inline-block mb-0.5">
                                      {feeRow.offer_label}
                                    </div>
                                  )}
                                  {offerOn && (
                                    <div className="text-[10px] line-through text-gray-400 sm:text-emerald-200/35 leading-tight">{formatRupees(feeRow.fee_paise)}/class</div>
                                  )}
                                  <div className={`text-sm font-bold ${offerOn ? 'text-emerald-600 sm:text-emerald-300' : selected ? 'text-emerald-700 sm:text-emerald-300' : 'text-gray-600 sm:text-emerald-200/60'}`}>
                                    {formatRupees(activeFee)}/class
                                  </div>
                                  {expiryDate && <div className="text-[9px] text-gray-400 sm:text-emerald-200/35">ends {expiryDate}</div>}
                                  <div className="text-[9px] text-gray-500 sm:text-emerald-200/40 mt-0.5">
                                    {constants.minSessionsDefault} cls → <span className="font-semibold text-emerald-700 sm:text-emerald-300">{formatRupees(advanceAmt)}</span>
                                  </div>
                                </div>
                              );
                            }
                            // Annual batch — show offer badge + annual fee + OTP + savings
                            const otpBase = offerOn ? feeRow.fee_paise : (feeRow.early_bird_fee_paise ?? feeRow.fee_paise);
                            const otpAmount = Math.round(otpBase * (offerOn ? 0.75 : 0.90));
                            const savings = feeRow.fee_paise - otpAmount;
                            const hasEb = !!feeRow.early_bird_fee_paise && !offerOn;
                            return (
                              <div className="text-right shrink-0 space-y-0.5">
                                {(offerOn || hasEb) && feeRow.offer_label && (
                                  <div className="text-[9px] font-bold text-white bg-amber-500 sm:bg-amber-500/80 px-1.5 py-0.5 rounded-full inline-block mb-0.5">
                                    {feeRow.offer_label}
                                  </div>
                                )}
                                {(offerOn || hasEb) && (
                                  <div className="text-[10px] line-through text-gray-400 sm:text-emerald-200/35 leading-tight">{formatRupees(feeRow.fee_paise)}/yr</div>
                                )}
                                <div className={`text-sm font-bold ${(offerOn || hasEb) ? 'text-emerald-600 sm:text-emerald-300' : selected ? 'text-emerald-700 sm:text-emerald-300' : 'text-gray-600 sm:text-emerald-200/60'}`}>
                                  {formatRupees(getActiveFee(feeRow))}/yr
                                </div>
                                {expiryDate && <div className="text-[9px] text-gray-400 sm:text-emerald-200/35">ends {expiryDate}</div>}
                                <div className="text-[10px] text-gray-500 sm:text-emerald-200/50">
                                  OTP: <span className="font-bold text-emerald-700 sm:text-emerald-300">{formatRupees(otpAmount)}</span>
                                </div>
                                {savings > 0 && (
                                  <div className="text-[9px] font-bold text-emerald-600 sm:text-emerald-400 bg-emerald-100 sm:bg-emerald-400/15 px-1.5 py-0.5 rounded-full inline-block">
                                    Save {formatRupees(savings)}
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
                            <span className="text-[11px] text-gray-400 sm:text-emerald-200/30 italic">Select grade for fee</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <SecondaryButton onClick={goBack} label="Back" />
              <PrimaryButton onClick={goNext} disabled={!batchType || saving} label={saving ? 'Saving…' : 'Continue'} />
            </div>
          </div>
        )}

        {/* ── (Academic moved to step 3 above) ── */}

        {/* ── Step 4 (1:1 / 1:3): Subject + Session Count ── */}
        {isSubjectStep && (
          <div className="space-y-5">
            <div>
              <p className="text-[13px] font-medium text-gray-500 sm:text-emerald-200/60 uppercase tracking-wider">Subjects</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {sessionFeeRow && isOfferActive(sessionFeeRow) && (
                  <span className="text-[11px] line-through text-gray-400 sm:text-emerald-200/35">{formatRupees(sessionFeeRow.fee_paise)}/class</span>
                )}
                <span className="text-[12px] text-gray-400 sm:text-emerald-200/40">{formatRupees(perSessionRate)}/class</span>
                {sessionFeeRow && isOfferActive(sessionFeeRow) && sessionFeeRow.offer_label && (
                  <span className="text-[10px] font-medium text-amber-600 sm:text-amber-400">{sessionFeeRow.offer_label}</span>
                )}
              </div>
            </div>

            {/* All subjects card */}
            <button type="button"
              onClick={() => { setShowPerSubject(false); setSelectedSubjects(perClassSubjects); }}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                !showPerSubject
                  ? 'border-emerald-500 bg-emerald-50 sm:bg-emerald-400/15 sm:border-emerald-400/50'
                  : 'border-gray-200 bg-gray-50 hover:border-emerald-300 sm:border-white/10 sm:bg-white/5'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!showPerSubject ? 'border-emerald-500 bg-emerald-500 sm:border-emerald-400 sm:bg-emerald-400' : 'border-gray-300 sm:border-white/30'}`}>
                    {!showPerSubject && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className={`text-sm font-semibold ${!showPerSubject ? 'text-emerald-800 sm:text-emerald-200' : 'text-gray-700 sm:text-white/80'}`}>
                      All {perClassSubjects.length} Subjects
                    </span>
                    <span className="block text-[11px] text-gray-500 sm:text-emerald-200/40 mt-0.5">{perClassSubjects.join(' · ')}</span>
                  </div>
                </div>
                {!showPerSubject && <span className="text-sm font-bold text-emerald-700 sm:text-emerald-300 shrink-0 ml-2">{formatRupees(sessionTotal)}</span>}
              </div>
            </button>

            {/* Choose specific subjects */}
            <button type="button"
              onClick={() => { setShowPerSubject(true); if (selectedSubjects.length === perClassSubjects.length) setSelectedSubjects([]); }}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                showPerSubject
                  ? 'border-emerald-500 bg-emerald-50 sm:bg-emerald-400/15 sm:border-emerald-400/50'
                  : 'border-gray-200 bg-gray-50 hover:border-emerald-300 sm:border-white/10 sm:bg-white/5'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${showPerSubject ? 'border-emerald-500 bg-emerald-500 sm:border-emerald-400 sm:bg-emerald-400' : 'border-gray-300 sm:border-white/30'}`}>
                  {showPerSubject && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className={`text-sm font-semibold ${showPerSubject ? 'text-emerald-800 sm:text-emerald-200' : 'text-gray-700 sm:text-white/80'}`}>
                  Choose specific subjects
                </span>
              </div>
            </button>

            {showPerSubject && (
              <div className="space-y-2 ml-1">
                {perClassSubjects.map(subj => {
                  const sel = selectedSubjects.includes(subj);
                  return (
                    <button key={subj} type="button"
                      onClick={() => setSelectedSubjects(prev => sel ? prev.filter(x => x !== subj) : [...prev, subj])}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${sel ? 'border-emerald-500 bg-emerald-50 sm:bg-emerald-400/15 sm:border-emerald-400/40' : 'border-gray-200 bg-gray-50 hover:border-gray-300 sm:border-white/10 sm:bg-white/5 sm:hover:border-white/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${sel ? 'bg-emerald-600 border-emerald-600 sm:bg-emerald-400 sm:border-emerald-400' : 'border-gray-300 sm:border-white/30'}`}>
                            {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-[13px] font-medium ${sel ? 'text-emerald-700 sm:text-emerald-300' : 'text-gray-700 sm:text-white/80'}`}>{subj}</span>
                        </div>
                        <span className="text-[11px] text-gray-400 sm:text-emerald-200/40">{formatRupees(perSessionRate)}/class</span>
                      </div>
                    </button>
                  );
                })}
                {selectedSubjects.length > 0 && showPerSubject && (
                  <div className="flex items-center justify-between pt-1 px-1">
                    <span className="text-[12px] text-gray-500 sm:text-emerald-200/50">{selectedSubjects.length} selected</span>
                    <button type="button" onClick={() => setSelectedSubjects(perClassSubjects)} className="text-[11px] text-emerald-600 sm:text-emerald-400 hover:underline">Select all</button>
                  </div>
                )}
              </div>
            )}

            {/* Session count stepper */}
            <div className="rounded-xl border border-gray-200 sm:border-white/10 p-4 bg-gray-50 sm:bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800 sm:text-white">Sessions Advance</p>
                  <p className="text-[11px] text-gray-500 sm:text-emerald-200/40 mt-0.5">Min {constants.minSessionsMinimum} · adjust as needed</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => { const n = Math.max(constants.minSessionsMinimum, sessionCount - 5); setSessionCount(n); setSessionCountStr(String(n)); }}
                    className="w-8 h-8 rounded-lg border border-gray-300 sm:border-white/20 bg-white sm:bg-white/10 text-gray-700 sm:text-white font-bold text-lg flex items-center justify-center hover:bg-gray-100 sm:hover:bg-white/15 disabled:opacity-30 transition"
                    disabled={sessionCount <= constants.minSessionsMinimum}>−</button>
                  <div className="text-center">
                    <input
                      type="number"
                      min={constants.minSessionsMinimum}
                      value={sessionCountStr}
                      onChange={e => {
                        setSessionCountStr(e.target.value);
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= constants.minSessionsMinimum) setSessionCount(v);
                      }}
                      onBlur={() => {
                        const v = parseInt(sessionCountStr, 10);
                        const clamped = isNaN(v) || v < constants.minSessionsMinimum ? constants.minSessionsMinimum : v;
                        setSessionCount(clamped);
                        setSessionCountStr(String(clamped));
                      }}
                      className="w-16 text-center text-xl font-extrabold text-emerald-700 sm:text-emerald-300 bg-transparent border border-gray-300 sm:border-white/20 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <p className="text-[10px] text-gray-400 sm:text-emerald-200/40 mt-0.5">sessions</p>
                  </div>
                  <button type="button"
                    onClick={() => { const n = sessionCount + 5; setSessionCount(n); setSessionCountStr(String(n)); }}
                    className="w-8 h-8 rounded-lg border border-gray-300 sm:border-white/20 bg-white sm:bg-white/10 text-gray-700 sm:text-white font-bold text-lg flex items-center justify-center hover:bg-gray-100 sm:hover:bg-white/15 transition">+</button>
                </div>
              </div>
              {selectedSubjects.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 sm:border-white/10 flex items-center justify-between">
                  <span className="text-[12px] text-gray-500 sm:text-emerald-200/50">{selectedSubjects.join(', ')} · {sessionCount} sessions</span>
                  <span className="text-base font-bold text-emerald-700 sm:text-emerald-300">{formatRupees(sessionTotal)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <SecondaryButton onClick={goBack} label="Back" />
              <PrimaryButton onClick={goNext} disabled={selectedSubjects.length === 0 || sessionCount < constants.minSessionsMinimum} label="Continue to Payment" />
            </div>
          </div>
        )}

        {/* ── Step 4 (1:15 / 1:30): Package Selection ── */}
        {isPackageStep && (
          <div className="space-y-4">
            <div>
              <p className="text-[13px] font-medium text-gray-500 sm:text-emerald-200/60 uppercase tracking-wider">Subject Package</p>
              <p className="text-[12px] text-gray-400 sm:text-emerald-200/40 mt-0.5">Choose the subject group for your batch</p>
            </div>

            <div className="space-y-3">
              {availablePackages.map(pkg => {
                const sel = selectedPackageId === pkg.id;
                return (
                  <button key={pkg.id} type="button" onClick={() => setSelectedPackageId(pkg.id)}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                      sel
                        ? 'border-emerald-500 bg-emerald-50 sm:bg-emerald-400/15 sm:border-emerald-400/60'
                        : 'border-gray-200 bg-gray-50 hover:border-emerald-300 sm:border-white/10 sm:bg-white/5 sm:hover:border-emerald-400/30'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${sel ? 'border-emerald-500 bg-emerald-500 sm:border-emerald-400 sm:bg-emerald-400' : 'border-gray-300 sm:border-white/30'}`}>
                        {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${sel ? 'text-emerald-800 sm:text-emerald-200' : 'text-gray-800 sm:text-white/80'}`}>{pkg.label}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {pkg.subjects.map(s => (
                            <span key={s} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sel ? 'bg-emerald-100 text-emerald-700 sm:bg-emerald-400/20 sm:text-emerald-300' : 'bg-gray-100 text-gray-600 sm:bg-white/10 sm:text-white/60'}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-1">
              <SecondaryButton onClick={goBack} label="Back" />
              <PrimaryButton onClick={goNext} disabled={!selectedPackageId} label="Continue to Payment" />
            </div>
          </div>
        )}

        {/* ── Payment Step (final) ── */}
        {isPaymentStep && (
          <div className="space-y-4">
            <p className="text-[13px] font-medium text-gray-500 sm:text-emerald-200/60 uppercase tracking-wider">
              Fee Summary
            </p>

            <div className="rounded-xl bg-gray-50 border border-gray-200 sm:bg-white/5 sm:border-white/10 divide-y divide-gray-200 sm:divide-white/10 overflow-hidden">
              <SummaryRow label="Student" value={name} />
              <SummaryRow label="Grade" value={`Class ${grade}`} />
              <SummaryRow label="Board" value={board} />
              <SummaryRow label="Region" value={region} />
              <SummaryRow label="Batch Type" value={constants.batch_type_labels[batchType] || batchType} />
              <SummaryRow label="Parent" value={parentName} />
              {sessionBased ? (
                <>
                  <SummaryRow label="Subjects" value={selectedSubjects.join(', ')} />
                  <SummaryRow label="Sessions" value={`${sessionCount} sessions advance`} />
                </>
              ) : isPackageBatch ? (
                (() => {
                  const pkg = availablePackages.find(p => p.id === selectedPackageId);
                  return <SummaryRow label="Package" value={pkg ? pkg.label : '—'} />;
                })()
              ) : isAutoSubjectBatch ? (
                <SummaryRow label="Subjects" value={selectedSubjects.join(', ')} />
              ) : (
                <SummaryRow label="Includes" value="All subjects — annual fee" />
              )}
            </div>

            {/* ── Per-class fee ── */}
            {sessionBased && sessionFeeRow && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 sm:bg-emerald-400/10 sm:border-emerald-400/25 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 sm:text-white">Session Advance</span>
                  <span className="text-xl font-bold text-emerald-700 sm:text-emerald-300">{formatRupees(totalAmount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isOfferActive(sessionFeeRow) && (
                    <span className="text-[11px] line-through text-gray-400 sm:text-emerald-200/35">
                      {formatRupees(sessionFeeRow.fee_paise)}/class
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500 sm:text-emerald-200/50">
                    {formatRupees(perSessionRate)}/class × {sessionCount} sessions
                  </span>
                  {isOfferActive(sessionFeeRow) && sessionFeeRow.offer_label && (
                    <span className="text-[10px] font-medium text-amber-600 sm:text-amber-400">{sessionFeeRow.offer_label}</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Annual batch: OTP / SPO breakdown ── */}
            {!sessionBased && annualFee && (
              <div className="rounded-xl overflow-hidden border border-emerald-200 sm:border-emerald-400/30">
                {/* EB annual price */}
                <div className="bg-emerald-50 sm:bg-emerald-400/10 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 sm:text-emerald-300 uppercase tracking-wider">
                        Annual Fee · Early Bird
                        {isOfferActive(annualFee) && annualFee.offer_label && (
                          <span className="ml-2 normal-case font-bold text-amber-600 sm:text-amber-400">
                            🏷 {annualFee.offer_label}
                          </span>
                        )}
                      </p>
                      {isOfferActive(annualFee) && annualFee.offer_expires_at && (
                        <p className="text-[10px] text-emerald-500 sm:text-emerald-400/60 mt-0.5">
                          Expires {new Date(annualFee.offer_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-emerald-700 sm:text-emerald-300">
                        {formatRupees(annualFee.early_bird_fee_paise ?? annualFee.fee_paise)}
                      </p>
                      {isOfferActive(annualFee) && (
                        <p className="text-xs line-through text-gray-400 sm:text-emerald-200/35">
                          {formatRupees(annualFee.fee_paise)} regular
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment options — selectable */}
                <div className="px-4 py-3 space-y-2.5 bg-white/80 sm:bg-white/5">
                  <p className="text-[10px] font-semibold text-gray-400 sm:text-emerald-200/40 uppercase tracking-wider">Choose Payment Option</p>

                  {/* OTP card */}
                  <button type="button" onClick={() => setPaymentPlan('otp')}
                    className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                      paymentPlan === 'otp'
                        ? 'border-emerald-500 bg-emerald-50 sm:bg-emerald-400/15 sm:border-emerald-400/70'
                        : 'border-gray-200 bg-gray-50 hover:border-emerald-300 sm:border-white/10 sm:bg-white/5 sm:hover:border-emerald-400/30'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentPlan === 'otp'
                            ? 'border-emerald-500 bg-emerald-500 sm:border-emerald-400 sm:bg-emerald-400'
                            : 'border-gray-300 sm:border-white/30'
                        }`}>
                          {paymentPlan === 'otp' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${paymentPlan === 'otp' ? 'text-emerald-800 sm:text-emerald-200' : 'text-gray-700 sm:text-white/80'}`}>
                            OTP — One Time Payment
                          </p>
                          <p className="text-[11px] text-gray-500 sm:text-emerald-200/50 mt-0.5">
                            {isOfferActive(annualFee) ? '25% off regular · Launching Offer' : '10% off early bird'} · Pay once, access all year
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-xl font-extrabold ${paymentPlan === 'otp' ? 'text-emerald-700 sm:text-emerald-300' : 'text-gray-600 sm:text-white/60'}`}>
                          {formatRupees(annualOtpAmount)}
                        </p>
                        <p className="text-[10px] text-gray-400 sm:text-emerald-200/40">full year</p>
                      </div>
                    </div>
                  </button>

                  {/* SPO card */}
                  <button type="button" onClick={() => setPaymentPlan('quarterly')}
                    className={`w-full text-left rounded-lg border-2 p-3 space-y-2 transition-all ${
                      paymentPlan === 'quarterly'
                        ? 'border-blue-500 bg-blue-50 sm:bg-blue-400/15 sm:border-blue-400/70'
                        : 'border-gray-200 bg-gray-50 hover:border-blue-300 sm:border-white/10 sm:bg-white/5 sm:hover:border-blue-400/30'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentPlan === 'quarterly'
                            ? 'border-blue-500 bg-blue-500 sm:border-blue-400 sm:bg-blue-400'
                            : 'border-gray-300 sm:border-white/30'
                        }`}>
                          {paymentPlan === 'quarterly' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${paymentPlan === 'quarterly' ? 'text-blue-800 sm:text-blue-200' : 'text-gray-700 sm:text-white/80'}`}>
                            SPO — Split Payment
                          </p>
                          <p className="text-[11px] text-gray-500 sm:text-emerald-200/50 mt-0.5">
                            {isOfferActive(annualFee) ? '20% off regular' : '5% off early bird'} · 4 quarterly installments
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-base font-bold ${paymentPlan === 'quarterly' ? 'text-blue-700 sm:text-blue-300' : 'text-gray-600 sm:text-white/60'}`}>
                          {formatRupees(annualSpoTotal)}
                        </p>
                        <p className="text-[10px] text-gray-400 sm:text-emerald-200/40">total</p>
                      </div>
                    </div>
                    {/* Quarterly grid — always visible inside SPO card */}
                    <div className="grid grid-cols-4 gap-1.5 ml-7">
                      {([
                        { label: 'Q1', amt: annualQ123, note: 'Pay now' },
                        { label: 'Q2', amt: annualQ123, note: '~3 mo' },
                        { label: 'Q3', amt: annualQ123, note: '~6 mo' },
                        { label: 'Q4', amt: annualQ4,   note: '~9 mo' },
                      ] as const).map(({ label, amt, note }) => (
                        <div key={label} className={`rounded-lg border p-1.5 text-center ${
                          label === 'Q1' && paymentPlan === 'quarterly'
                            ? 'bg-blue-100 border-blue-300 sm:bg-blue-400/20 sm:border-blue-400/40'
                            : 'bg-white border-gray-200 sm:bg-white/10 sm:border-white/10'
                        }`}>
                          <p className={`text-[10px] font-semibold ${label === 'Q1' && paymentPlan === 'quarterly' ? 'text-blue-700 sm:text-blue-300' : 'text-gray-500 sm:text-emerald-200/50'}`}>{label}</p>
                          <p className={`text-xs font-bold mt-0.5 ${label === 'Q1' && paymentPlan === 'quarterly' ? 'text-blue-800 sm:text-blue-200' : 'text-gray-700 sm:text-white/70'}`}>{formatRupees(amt)}</p>
                          <p className="text-[9px] text-gray-400 sm:text-emerald-200/30">{note}</p>
                        </div>
                      ))}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {sessionBased && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 sm:bg-blue-400/10 sm:border-blue-400/20">
                <p className="text-[12px] text-blue-700 sm:text-blue-300 leading-relaxed">
                  <strong>Note:</strong> This is an advance payment for {sessionCount} classes. Once you are added to a batch and your timetable is set, the final bill will be generated. You can attend these {sessionCount} classes and make further payments to continue your learning.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <SecondaryButton onClick={goBack} label="Back" />
              <button onClick={handlePay} disabled={paying || totalAmount === 0}
                className="group relative flex-1 h-13 rounded-xl text-emerald-950 font-medium text-[15px] bg-linear-to-r from-emerald-300 to-teal-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 overflow-hidden shadow-lg shadow-emerald-400/15">
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/10 to-transparent" />
                <span className="relative flex items-center justify-center gap-2">
                  {!sessionBased && paymentPlan === 'quarterly'
                    ? `Pay Q1 — ${formatRupees(totalAmount)}`
                    : `Pay ${formatRupees(totalAmount)}`}
                  <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                </span>
              </button>
            </div>

            <p className="text-center text-[12px] text-gray-400 sm:text-emerald-200/40">
              Secured by Razorpay · SSL encrypted
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-xs text-gray-400 sm:text-emerald-200/40">
          {platformName} · Empowering education
        </p>
      </div>
    </>
  );
}

// ── Sub-components (demo-style) ────────────────────────────────

function FloatingInput({ id, label, value, onChange, type = 'text', focused, onFocus, onBlur, alwaysActive }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; focused: boolean; onFocus: () => void; onBlur: () => void; alwaysActive?: boolean;
}) {
  const active = alwaysActive || focused || value.length > 0;
  return (
    <div className="relative">
      <input
        id={id} type={type} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus} onBlur={onBlur}
        className={`${INPUT_BASE} ${focused ? INPUT_FOCUS : value ? INPUT_FILLED : INPUT_IDLE}`}
      />
      <label htmlFor={id}
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${active ? LABEL_ACTIVE : LABEL_IDLE}`}>
        {label}
      </label>
    </div>
  );
}

function FloatingSelect({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select id={id} value={value}
        onChange={e => onChange(e.target.value)}
        className={`${INPUT_BASE} appearance-none ${value ? INPUT_FILLED : INPUT_IDLE}`}>
        <option value="" disabled hidden></option>
        {options.map(o => <option key={o.value} value={o.value} className="text-gray-900 bg-white">{o.label}</option>)}
      </select>
      <label htmlFor={id}
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${value ? LABEL_ACTIVE : LABEL_IDLE}`}>
        {label}
      </label>
      {SELECT_ARROW}
    </div>
  );
}

function PrimaryButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="group relative flex-1 w-full h-13 rounded-xl text-emerald-950 font-medium text-[15px] bg-linear-to-r from-emerald-300 to-teal-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 overflow-hidden shadow-lg shadow-emerald-400/15">
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/10 to-transparent" />
      <span className="relative flex items-center justify-center gap-2">
        {label}
        <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
      </span>
    </button>
  );
}

function SecondaryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="flex-1 h-13 rounded-xl border border-gray-300 sm:border-white/20 text-gray-700 sm:text-emerald-200/70 font-medium text-[15px] hover:bg-gray-50 sm:hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-2">
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between">
      <span className="text-[12px] text-gray-500 sm:text-emerald-200/50">{label}</span>
      <span className="text-[13px] font-medium text-gray-900 sm:text-white text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
