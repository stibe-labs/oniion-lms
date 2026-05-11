'use client';
import React from 'react';
import { X, Check } from 'lucide-react';

export interface WizardStep {
  label: string;
  desc?: string;
  icon?: React.ElementType;
}

interface WizardShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (idx: number) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  sidebarBottom?: React.ReactNode;
  maxWidth?: string;
}

export function WizardShell({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  steps,
  currentStep,
  onStepClick,
  children,
  footer,
  sidebarBottom,
  maxWidth = 'max-w-5xl',
}: WizardShellProps) {
  if (!open) return null;
  const total = steps.length;
  const pct = total > 1 ? Math.round((currentStep / (total - 1)) * 100) : 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className={`relative bg-white rounded-3xl w-full ${maxWidth} flex overflow-hidden`}
        style={{ maxHeight: '90vh', boxShadow: '0 32px 100px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left sidebar ── */}
        <div className="w-64 relative flex flex-col shrink-0 overflow-hidden" style={{ background: '#0d1117' }}>
          {/* Primary gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(160deg, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 55%, color-mix(in oklab, var(--secondary) 12%, transparent) 100%)' }}
          />
          {/* Dot grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          />

          <div className="relative flex flex-col h-full p-6">
            {/* Header */}
            <div className="mb-8">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg tracking-tight leading-tight">{title}</h2>
              <p className="text-white/40 text-xs mt-1">
                {subtitle ?? `Step ${currentStep + 1} of ${total}`}
              </p>
            </div>

            {/* Step track */}
            <div className="flex-1 relative">
              {/* Vertical connecting line */}
              <div
                className="absolute pointer-events-none"
                style={{ left: 27, top: 20, bottom: 20, width: 1, background: 'rgba(255,255,255,0.07)' }}
              />
              <div className="space-y-0.5">
                {steps.map((step, idx) => {
                  const done = idx < currentStep;
                  const active = idx === currentStep;
                  const StepIcon = step.icon;
                  const clickable = onStepClick && idx < currentStep;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onStepClick(idx)}
                      className={`w-full flex items-start gap-3.5 px-2.5 py-2.5 rounded-xl transition-all text-left ${
                        active
                          ? 'bg-white/[0.07]'
                          : clickable
                          ? 'hover:bg-white/[0.04] cursor-pointer'
                          : 'cursor-default'
                      }`}
                    >
                      {/* Circle */}
                      <div
                        className="w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 relative z-10 transition-all"
                        style={{
                          background: done
                            ? 'var(--primary)'
                            : active
                            ? 'white'
                            : 'rgba(255,255,255,0.06)',
                          border: done || active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                          boxShadow: done
                            ? '0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent)'
                            : active
                            ? '0 0 0 4px rgba(255,255,255,0.08)'
                            : 'none',
                        }}
                      >
                        {done ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : active && StepIcon ? (
                          <StepIcon className="h-4 w-4 text-gray-900" />
                        ) : (
                          <span
                            className={`text-xs font-bold ${active ? 'text-gray-900' : 'text-white/20'}`}
                          >
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Label */}
                      <div className="pt-1.5 min-w-0">
                        <p
                          className={`text-sm font-semibold leading-tight truncate ${
                            active ? 'text-white' : done ? 'text-white/55' : 'text-white/22'
                          }`}
                        >
                          {step.label}
                        </p>
                        {active && step.desc && (
                          <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{step.desc}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-white/25 uppercase tracking-wider">Progress</span>
                <span className="text-[10px] font-bold text-white/30">{pct}%</span>
              </div>
              <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: 'var(--primary)' }}
                />
              </div>
            </div>

            {sidebarBottom}

            {/* Cancel */}
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-white/25 hover:text-white/60 text-xs transition-colors mt-1"
            >
              <X className="h-3.5 w-3.5" />
              Cancel &amp; Close
            </button>
          </div>
        </div>

        {/* ── Right content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-10 pt-8 pb-4">{children}</div>
          <div className="border-t border-gray-100 px-10 py-4 bg-white flex items-center justify-between">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Step footer dots — use inside `footer` prop */
export function WizardFooterDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            height: 6,
            width: i === current ? 20 : 6,
            background:
              i < current
                ? 'color-mix(in oklab, var(--primary) 35%, transparent)'
                : i === current
                ? 'var(--primary)'
                : '#e5e7eb',
          }}
        />
      ))}
    </div>
  );
}
