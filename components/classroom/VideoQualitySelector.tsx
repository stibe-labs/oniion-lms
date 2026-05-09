'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoQuality } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * VideoQualitySelector — YouTube-style video quality picker.
 *
 * Shows a gear icon button that opens a floating menu with quality options:
 *   Auto · 144p · 480p · 720p · 1080p
 *
 * Designed to work in both overlay (StudentView) and standard (TeacherView) contexts.
 *
 * Quality → LiveKit simulcast layer mapping (teacher publishes h180 + h540 + h720):
 *   144p  → LOW   (h180, 320×180)  — slow network fallback
 *   480p  → MEDIUM (h540, 960×540) — default
 *   720p  → HIGH  (h720, 1280×720) — manual only
 *   1080p → HIGH  (h720, same layer) — manual only
 */

export type VideoQualityOption = 'auto' | '144p' | '480p' | '720p' | '1080p';

/**
 * Maps quality option → VideoQuality enum for setVideoQuality().
 * This directly selects which simulcast layer the SFU sends.
 * null = let adaptive stream manage automatically.
 */
export const QUALITY_MAP: Record<VideoQualityOption, VideoQuality | null> = {
  auto: null,
  '144p': VideoQuality.LOW,
  '480p': VideoQuality.MEDIUM,
  '720p': VideoQuality.HIGH,
  '1080p': VideoQuality.HIGH,
};

export const QUALITY_LABELS: Record<VideoQualityOption, string> = {
  auto: 'Auto',
  '144p': '144p (Slow)',
  '480p': '480p',
  '720p': '720p HD',
  '1080p': '1080p HD',
};

const QUALITY_OPTIONS: VideoQualityOption[] = ['auto', '144p', '480p', '720p', '1080p'];

export type CutoutSizeOption = '0.5x' | '1x' | '2x';
const CUTOUT_SIZES: CutoutSizeOption[] = ['0.5x', '1x', '2x'];

interface VideoQualitySelectorProps {
  /** Current quality */
  quality: VideoQualityOption;
  /** Called when user picks a new quality */
  onChange: (q: VideoQualityOption) => void;
  /** Current cutout size */
  cutoutSize?: CutoutSizeOption;
  /** Called when user picks a new cutout size */
  onCutoutSizeChange?: (s: CutoutSizeOption) => void;
  /** Compact mode (smaller button, used in rotated mobile overlay) */
  compact?: boolean;
  /** Style variant */
  variant?: 'overlay' | 'panel';
  /** Direction the dropdown opens; defaults to 'up' for overlay, 'down' for panel */
  dropDirection?: 'up' | 'down';
  className?: string;
}

export default function VideoQualitySelector({
  quality,
  onChange,
  cutoutSize,
  onCutoutSizeChange,
  compact = false,
  variant = 'overlay',
  dropDirection,
  className,
}: VideoQualitySelectorProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = useCallback((q: VideoQualityOption) => {
    onChange(q);
    setOpen(false);
  }, [onChange]);

  const isOverlay = variant === 'overlay';

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      {/* ── Trigger button ── */}
      {isOverlay ? (
        /* Overlay style — round button matching OvBtn in StudentView */
        <button
          onClick={() => setOpen(!open)}
          title={`Quality: ${QUALITY_LABELS[quality]}`}
          className={cn(
            'relative flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 shadow-lg',
            'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md',
            compact ? 'h-10 w-10' : 'h-12 w-12',
          )}
        >
          <GearIcon className="w-5 h-5" />
          {/* Current quality badge */}
          {quality !== 'auto' && (
            <span className="absolute -top-1 -right-1 rounded-full bg-[#1a73e8] px-1.5 py-0.5 text-[8px] font-bold text-white leading-none shadow">
              {quality}
            </span>
          )}
        </button>
      ) : (
        /* Panel style — compact text button for TeacherView */
        <button
          onClick={() => setOpen(!open)}
          title={`Quality: ${QUALITY_LABELS[quality]}`}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            'bg-[#3c4043] text-[#e8eaed] hover:bg-[#4a4d51]',
          )}
        >
          <GearIcon className="w-3.5 h-3.5" />
          <span>{QUALITY_LABELS[quality]}</span>
          <ChevronIcon className="w-3 h-3" open={open} />
        </button>
      )}

      {/* ── Dropdown menu ── */}
      {open && (
        <div
          className={cn(
            'absolute z-80 min-w-40 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/8 animate-in fade-in zoom-in-95 duration-150',
            'bg-[#2d2e30]/95 backdrop-blur-xl',
            (dropDirection === 'down' || (!dropDirection && !isOverlay)) ? 'top-full mt-1 right-0' : 'bottom-full mb-2 right-0',
          )}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/6">
            <span className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider">Quality</span>
          </div>

          {/* Options */}
          {QUALITY_OPTIONS.map((opt) => {
            const isActive = quality === opt;
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  isActive
                    ? 'bg-[#1a73e8]/15 text-[#8ab4f8]'
                    : 'text-[#e8eaed] hover:bg-white/6',
                )}
              >
                {/* Check mark */}
                <span className={cn('flex h-4 w-4 items-center justify-center', !isActive && 'invisible')}>
                  <CheckIcon className="w-3.5 h-3.5" />
                </span>
                {/* Label */}
                <span className="flex-1 text-sm font-medium">{QUALITY_LABELS[opt]}</span>
                {/* Description */}
                <span className="text-[10px] text-[#9aa0a6]">
                  {opt === 'auto' ? 'Adaptive' : opt === '144p' ? 'Very Low' : opt === '480p' ? 'Default' : opt === '720p' ? 'High' : 'Very High'}
                </span>
              </button>
            );
          })}

          {/* Teacher cutout size slider */}
          {cutoutSize && onCutoutSizeChange && (
            <>
              <div className="px-3 py-2 border-t border-white/6">
                <span className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider">Teacher Size</span>
              </div>
              <div className="px-3 pb-3 pt-1">
                <div className="flex items-center gap-2">
                  {CUTOUT_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onCutoutSizeChange(s)}
                      className={cn(
                        'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                        cutoutSize === s
                          ? 'bg-[#1a73e8] text-white shadow-md'
                          : 'bg-white/8 text-[#9aa0a6] hover:bg-white/12 hover:text-white',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronIcon({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg
      className={cn(className, 'transition-transform', open && 'rotate-180')}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
