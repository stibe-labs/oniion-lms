// ═══════════════════════════════════════════════════════════════
// Enrollment Fee Helpers — region/board → category → fee lookup
// ═══════════════════════════════════════════════════════════════

const GCC_REGIONS = new Set([
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
  'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
]);

export type RegionGroup = 'GCC' | 'Kerala';

export type EnrollmentCategory = 'GCC_CBSE' | 'KERALA_CBSE' | 'KERALA_STATE';

export function getRegionGroup(region: string): RegionGroup {
  return GCC_REGIONS.has(region) ? 'GCC' : 'Kerala';
}

export function getEnrollmentCategory(region: string, board: string): EnrollmentCategory {
  if (GCC_REGIONS.has(region)) return 'GCC_CBSE';
  if (board === 'State Board') return 'KERALA_STATE';
  return 'KERALA_CBSE';
}

const BATCH_TYPES_BY_CATEGORY: Record<EnrollmentCategory, string[]> = {
  GCC_CBSE:     ['one_to_one', 'one_to_three', 'one_to_fifteen'],
  KERALA_CBSE:  ['one_to_one', 'one_to_three', 'one_to_thirty'],
  KERALA_STATE: ['one_to_many'],
};

export function getAvailableBatchTypes(category: EnrollmentCategory): string[] {
  return BATCH_TYPES_BY_CATEGORY[category] || [];
}

const SESSION_BASED = new Set(['one_to_one', 'one_to_three']);

export function isSessionBased(batchType: string): boolean {
  return SESSION_BASED.has(batchType);
}

/** Returns true for batch types where fee is shown per-class only (never as a total). */
export function isPerClassBatchType(batchType: string): boolean {
  return batchType === 'one_to_one' || batchType === 'one_to_three';
}

/** Returns the active fee in paise — early bird if offer not expired, else annual fee. */
export function getActiveFee(row: {
  fee_paise: number;
  early_bird_fee_paise?: number | null;
  offer_expires_at?: string | null;
}): number {
  if (
    row.early_bird_fee_paise &&
    (!row.offer_expires_at || new Date(row.offer_expires_at) > new Date())
  ) {
    return row.early_bird_fee_paise;
  }
  return row.fee_paise;
}

/** Returns true if the launching offer is currently active (not expired). */
export function isOfferActive(row: {
  early_bird_fee_paise?: number | null;
  offer_expires_at?: string | null;
}): boolean {
  return !!(
    row.early_bird_fee_paise &&
    (!row.offer_expires_at || new Date(row.offer_expires_at) > new Date())
  );
}

export const BATCH_TYPE_LABELS: Record<string, string> = {
  one_to_one:        '1:1 — Individual',
  one_to_three:      '1:3 — Small Group',
  one_to_five:       '1:5 — Group',
  one_to_fifteen:    '1:15 — Group Class',
  one_to_many:       '1:15+ — Group Class',
  one_to_thirty:     '1:30 — Large Group',
  lecture:           '1:50–1:100 — Lecture',
  improvement_batch: 'Improvement Batch',
  special:           'Special Batch',
  custom:            'Custom / Special Batch',
};

/** Batch types that use a flat one-time fee (paid at class entry via gate). No annual/per-class structure. */
export const SPECIAL_BATCH_TYPES = ['improvement_batch', 'special', 'custom', 'lecture'] as const;
export type SpecialBatchType = typeof SPECIAL_BATCH_TYPES[number];

export function isSpecialBatchType(bt: string): boolean {
  return (SPECIAL_BATCH_TYPES as readonly string[]).includes(bt);
}

export const ELIGIBLE_GRADES = ['8', '9', '10', '11', '12'];

export const ENROLLMENT_BOARDS = ['CBSE', 'State Board'];

export const STUDENT_REGIONS = [
  { value: 'Dubai', label: '🇦🇪 Dubai' },
  { value: 'Abu Dhabi', label: '🇦🇪 Abu Dhabi' },
  { value: 'Sharjah', label: '🇦🇪 Sharjah' },
  { value: 'Ajman', label: '🇦🇪 Ajman' },
  { value: 'Saudi Arabia', label: '🇸🇦 Saudi Arabia' },
  { value: 'Qatar', label: '🇶🇦 Qatar' },
  { value: 'Kuwait', label: '🇰🇼 Kuwait' },
  { value: 'Bahrain', label: '🇧🇭 Bahrain' },
  { value: 'Oman', label: '🇴🇲 Oman' },
  { value: 'India', label: '🇮🇳 India' },
  { value: 'Malaysia', label: '🇲🇾 Malaysia' },
  { value: 'Singapore', label: '🇸🇬 Singapore' },
  { value: 'UK', label: '🇬🇧 United Kingdom' },
  { value: 'USA', label: '🇺🇸 United States' },
  { value: 'Other', label: '🌍 Other' },
];

/** Normalize grade strings like "Class 10" → "10", "HSS" → "11", "Class 12" → "12" */
export function normalizeGrade(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  const classMatch = s.match(/^(?:Class|Grade)\s+(\d+)$/i);
  if (classMatch) return classMatch[1];
  const ordMatch = s.match(/^(\d+)(?:st|nd|rd|th)?$/i);
  if (ordMatch) return ordMatch[1];
  if (/^hss$/i.test(s)) return '11';
  return s;
}

/**
 * Map a student grade to the fee-structure grade key.
 * HSS covers both Class 11 and Class 12 — they share the same fee row in the DB.
 */
export function toFeeGrade(grade: string): string {
  if (grade === '11' || grade === '12') return 'HSS';
  return grade;
}

// ── 1:1 and 1:3 subjects (CBSE, per-class) ────────────────────
// Students select individual subjects; default = all
export const PER_CLASS_SUBJECTS_BY_GRADE: Record<string, string[]> = {
  '8':   ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
  '9':   ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
  '10':  ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
  'HSS': ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science'],
};

// ── 1:15 packages (GCC CBSE) ──────────────────────────────────
export const ONE_TO_FIFTEEN_PACKAGES = [
  { id: 'pcb', label: 'Physics, Chemistry & Biology', subjects: ['Physics', 'Chemistry', 'Biology'] },
  { id: 'pcm', label: 'Physics, Chemistry & Mathematics', subjects: ['Physics', 'Chemistry', 'Mathematics'] },
] as const;
export type OneToFifteenPackageId = typeof ONE_TO_FIFTEEN_PACKAGES[number]['id'];

// ── 1:30 packages (Kerala CBSE) ───────────────────────────────
export const ONE_TO_THIRTY_PACKAGES = [
  { id: 'pcbm', label: 'Physics, Chemistry, Biology & Mathematics', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'] },
  { id: 'pcsm', label: 'Physics, Chemistry, CS & Mathematics', subjects: ['Physics', 'Chemistry', 'Computer Science', 'Mathematics'] },
] as const;
export type OneToThirtyPackageId = typeof ONE_TO_THIRTY_PACKAGES[number]['id'];

// ── 1:M subjects by grade (Kerala State — auto, no student selection) ──
export const ONE_TO_MANY_SUBJECTS_BY_GRADE: Record<string, string[]> = {
  '8':   ['Malayalam', 'Hindi', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Mathematics'],
  '9':   ['Malayalam', 'Hindi', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Mathematics'],
  '10':  ['Malayalam', 'Hindi', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Mathematics'],
  'HSS': ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
};

export const MIN_SESSIONS_DEFAULT = 50;
export const MIN_SESSIONS_MINIMUM = 5;

/** Get the auto-set subjects for a given batch type + grade (for non-selectable batches). */
export function getAutoSubjects(batchType: string, grade: string): string[] {
  if (batchType === 'one_to_many') {
    return ONE_TO_MANY_SUBJECTS_BY_GRADE[grade] || ONE_TO_MANY_SUBJECTS_BY_GRADE['10'];
  }
  return [];
}

/** Legacy: kept for server-side subject fallback if needed. */
export function getSubjectsForGradeBoard(grade: string, board: string): string[] {
  if (board === 'State Board') {
    return ONE_TO_MANY_SUBJECTS_BY_GRADE[grade] || ONE_TO_MANY_SUBJECTS_BY_GRADE['10'];
  }
  return PER_CLASS_SUBJECTS_BY_GRADE[grade] || PER_CLASS_SUBJECTS_BY_GRADE['10'];
}
