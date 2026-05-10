'use client';

import { Tag } from 'lucide-react';
import { computeFeeBreakdown, fmtPaise, type FeeDisplayRow } from '@/lib/fee-display';

interface Props {
  feeRow: FeeDisplayRow;
  /** compact = small inline version for table cells */
  compact?: boolean;
}

export function FeeBreakdownCard({ feeRow, compact = false }: Props) {
  const { regularFee, ebAnnual, hasEB, offerActive, isPerClass, otpTotal, spoTotal, q123, q4, unitLabel } = computeFeeBreakdown(feeRow);
  const currency = feeRow.currency || 'INR';
  const fmt = (p: number) => fmtPaise(p, currency);
  const discPct = hasEB && regularFee > 0 ? Math.round((regularFee - ebAnnual) / regularFee * 100) : 0;

  if (compact) {
    return (
      <div className="space-y-0.5">
        {hasEB && (
          <span className="block text-xs line-through text-gray-400">{fmt(regularFee)}{unitLabel}</span>
        )}
        <span className={`font-semibold text-sm ${offerActive ? 'text-primary' : 'text-gray-800'}`}>
          {fmt(ebAnnual)}{unitLabel}
        </span>
        {feeRow.offer_label && hasEB && (
          <span className={`block text-[10px] font-medium px-1 py-0.5 rounded w-fit ${offerActive ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-500'}`}>
            {offerActive ? `🏷 ${feeRow.offer_label}` : '⚠ Offer expired'}
          </span>
        )}
        {!isPerClass && (
          <span className="block text-[10px] text-gray-400">OTP {fmt(otpTotal)} · SPO {fmt(spoTotal)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/5 border-b border-primary/20 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          {feeRow.offer_label && hasEB && (
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-0.5 ${
                offerActive ? 'bg-primary text-white' : 'bg-red-100 text-red-600'
              }`}>
                <Tag className="w-3 h-3" />
                {offerActive ? feeRow.offer_label : 'Offer Expired'}
              </span>
              {feeRow.offer_expires_at && offerActive && (
                <span className="text-[11px] text-primary">
                  Expires {new Date(feeRow.offer_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-primary font-semibold uppercase tracking-wide">
            {isPerClass ? 'Per Class — Early Bird' : 'Annual Fee — Early Bird'}
          </p>
        </div>
        {hasEB && discPct > 0 && (
          <div className="shrink-0 text-right">
            <span className="block text-xs font-bold text-primary bg-primary/20 rounded-lg px-2.5 py-1">{discPct}% OFF</span>
            <span className="block text-[10px] text-primary mt-0.5">Save {fmt(regularFee - ebAnnual)}{unitLabel}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Big unit price */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
            {isPerClass ? 'Per Class Fee' : 'Annual Fee'}
            {hasEB && <span className="ml-2 normal-case text-primary">· Early Bird</span>}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-primary tracking-tight">{fmt(ebAnnual)}</span>
            <span className="text-base font-semibold text-primary">{unitLabel}</span>
          </div>
          {hasEB && (
            <p className="text-sm text-gray-400 line-through mt-1.5">
              {fmt(regularFee)}{unitLabel} <span className="no-underline not-italic text-xs text-gray-400">regular</span>
            </p>
          )}
        </div>

        {/* Payment options — annual batch types only */}
        {!isPerClass && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Options</p>

            {/* OTP */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-primary">OTP — One Time Payment</p>
                  <p className="text-xs text-primary mt-0.5">
                    {offerActive ? '25% off regular annual (Launching Offer)' : '10% off early bird annual'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-primary">{fmt(otpTotal)}</p>
                  <p className="text-[11px] text-gray-400">full year</p>
                </div>
              </div>
            </div>

            {/* SPO + Quarterly grid */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">SPO — Split Payment</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {offerActive ? '20% off regular annual (Launching Offer)' : '5% off early bird annual'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{fmt(spoTotal)}</p>
                  <p className="text-[11px] text-gray-400">total · 4 installments</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { label: 'Q1', amt: q123, pct: '30%' },
                  { label: 'Q2', amt: q123, pct: '30%' },
                  { label: 'Q3', amt: q123, pct: '30%' },
                  { label: 'Q4', amt: q4,   pct: '10%' },
                ] as const).map(({ label, amt, pct }) => (
                  <div key={label} className="rounded-lg bg-white border border-gray-200 p-2 text-center">
                    <p className="text-[11px] font-semibold text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{fmt(amt)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{pct}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
