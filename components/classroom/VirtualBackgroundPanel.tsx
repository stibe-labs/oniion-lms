'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type VBGMode = 'disabled' | 'blur-light' | 'blur-medium' | 'blur-heavy' | 'cutout' | string;

const BLUR_OPTIONS: { id: VBGMode; label: string; radius: number }[] = [
  { id: 'blur-light', label: 'Light', radius: 6 },
  { id: 'blur-medium', label: 'Medium', radius: 12 },
  { id: 'blur-heavy', label: 'Strong', radius: 20 },
];

const BACKGROUND_OPTIONS: { id: string; label: string; path: string }[] = [
  { id: 'classroom-green', label: 'Classroom', path: '/backgrounds/classroom-green.svg' },
  { id: 'office-dark', label: 'Office', path: '/backgrounds/office-dark.svg' },
  { id: 'studio-gray', label: 'Studio', path: '/backgrounds/studio-gray.svg' },
  { id: 'professional-blue', label: 'Blue', path: '/backgrounds/professional-blue.svg' },
  { id: 'studio-warm', label: 'Warm', path: '/backgrounds/studio-warm.svg' },
  { id: 'minimal-slate', label: 'Slate', path: '/backgrounds/minimal-slate.svg' },
];

interface VirtualBackgroundPanelProps {
  activeMode: VBGMode;
  onSelect: (mode: VBGMode, options?: { blurRadius?: number; imagePath?: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function VirtualBackgroundPanel({
  activeMode,
  onSelect,
  onClose,
  loading = false,
}: VirtualBackgroundPanelProps) {
  return (
    <div className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 w-[420px] rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043]/50">
        <h3 className="text-sm font-semibold text-[#e8eaed]">Virtual Background</h3>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8]/10 border-b border-[#3c4043]/30">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#5f6368] border-t-[#8ab4f8]" />
          <span className="text-xs text-[#8ab4f8]">Applying…</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* None option */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#9aa0a6] mb-2">Effect</p>
          <div className="flex gap-2 flex-wrap">
            <OptionButton
              active={activeMode === 'disabled'}
              onClick={() => onSelect('disabled')}
              label="None"
            >
              <svg className="h-5 w-5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </OptionButton>
            <OptionButton
              active={activeMode === 'cutout'}
              onClick={() => onSelect('cutout', { imagePath: '/backgrounds/cutout-black.svg' })}
              label="Cutout"
            >
              {/* Person silhouette icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="3"/><path d="M12 13c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z"/></svg>
            </OptionButton>
            {BLUR_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.id}
                active={activeMode === opt.id}
                onClick={() => onSelect(opt.id, { blurRadius: opt.radius })}
                label={opt.label}
              >
                {/* Blur icon with varying opacity to indicate strength */}
                <div className="relative h-5 w-5 flex items-center justify-center">
                  <div className={cn(
                    'h-4 w-4 rounded-full',
                    opt.id === 'blur-light' && 'bg-[#5f6368]/40',
                    opt.id === 'blur-medium' && 'bg-[#5f6368]/60',
                    opt.id === 'blur-heavy' && 'bg-[#5f6368]/80',
                  )} style={{ filter: `blur(${opt.radius / 6}px)` }} />
                </div>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Backgrounds */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#9aa0a6] mb-2">Backgrounds</p>
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUND_OPTIONS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => onSelect(bg.id, { imagePath: bg.path })}
                className={cn(
                  'group relative h-16 rounded-lg overflow-hidden transition-all duration-150',
                  'ring-2',
                  activeMode === bg.id
                    ? 'ring-[#8ab4f8] shadow-lg shadow-blue-900/30'
                    : 'ring-transparent hover:ring-[#5f6368]',
                )}
              >
                {/* Background preview */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${bg.path})` }}
                />
                {/* Label */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                  <span className="text-[10px] font-medium text-white/90">{bg.label}</span>
                </div>
                {/* Active check */}
                {activeMode === bg.id && (
                  <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8ab4f8]">
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all duration-150',
        active
          ? 'bg-[#8ab4f8]/20 ring-2 ring-[#8ab4f8] text-[#8ab4f8]'
          : 'bg-[#3c4043]/50 text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]',
      )}
    >
      {children}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
