// ── Shared fee display helpers ──────────────────────────────────
// Single source of truth for OTP/SPO calculations used across
// enrollment form, manual enrollment modal, and owner dashboard.

export const SESSIONS_PER_YEAR = 180;
export const MONTHS_PER_YEAR   = 10;
export const MIN_SESSIONS      = 50; // advance sessions for per-class batches

export interface FeeDisplayRow {
  fee_paise:             number;
  early_bird_fee_paise?: number | null;
  offer_label?:          string | null;
  offer_expires_at?:     string | null;
  show_per_class_only:   boolean;
  fee_unit:              string;
  currency?:             string;
}

export function isOfferActive(row: Pick<FeeDisplayRow, 'early_bird_fee_paise' | 'offer_expires_at'>): boolean {
  if (!row.early_bird_fee_paise) return false;
  if (!row.offer_expires_at) return true;
  return new Date(row.offer_expires_at) > new Date();
}

export function getActiveFeeUnit(row: FeeDisplayRow): number {
  return isOfferActive(row) ? (row.early_bird_fee_paise ?? row.fee_paise) : row.fee_paise;
}

export interface FeeBreakdown {
  regularFee:  number;   // fee_paise (original annual / per-class)
  ebAnnual:    number;   // early_bird_fee_paise or regularFee
  hasEB:       boolean;
  offerActive: boolean;
  isPerClass:  boolean;
  // OTP = full year one-time payment (extra discount on top of EB)
  otpTotal:    number;
  // SPO = split payment option (quarterly)
  spoTotal:    number;
  q123:        number;   // Q1 = Q2 = Q3 = 30% of SPO
  q4:          number;   // Q4 = 10% of SPO
  unitLabel:   string;   // '/class' or '/year'
}

export function computeFeeBreakdown(row: FeeDisplayRow): FeeBreakdown {
  const regularFee  = row.fee_paise;
  const ebAnnual    = row.early_bird_fee_paise ?? regularFee;
  const hasEB       = !!(row.early_bird_fee_paise);
  const offerActive = isOfferActive(row);
  const isPerClass  = row.show_per_class_only;

  // Formula (same as CRM fee checker):
  //   No offer:        OTP = EB × 90%,      SPO = EB × 95%
  //   Offer active:    OTP = Regular × 75%,  SPO = Regular × 80%
  const base = offerActive ? regularFee : ebAnnual;
  const otpRate = offerActive ? 0.75 : 0.90;
  const spoRate = offerActive ? 0.80 : 0.95;

  const otpTotal = isPerClass ? 0 : Math.round(base * otpRate);
  const spoTotal = isPerClass ? 0 : Math.round(base * spoRate);
  const q123     = Math.round(spoTotal * 0.30);
  const q4       = spoTotal - q123 * 3;

  return {
    regularFee, ebAnnual, hasEB, offerActive, isPerClass,
    otpTotal, spoTotal, q123, q4,
    unitLabel: isPerClass ? '/class' : '/year',
  };
}

export function fmtPaise(paise: number, currency = 'INR'): string {
  const sym = currency === 'AED' ? 'AED ' : currency === 'USD' ? '$' : '₹';
  return `${sym}${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
