'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * ReportTeacherDialog — Students report teacher misconduct from live classroom.
 *
 * Flow:
 *   1. "Are you sure?" confirmation
 *   2. Select category
 *   3. Optional description
 *   4. Submit → POST /api/v1/room/[room_id]/report-teacher
 *
 * Immediately notifies batch coordinator, academic operator, and owner
 * via email + WhatsApp.
 */

export interface ReportTeacherDialogProps {
  roomId: string;
  studentEmail: string;
  studentName: string;
  onClose: () => void;
  onSubmitted?: (category: string) => void;
}

const REPORT_CATEGORIES = [
  { id: 'sexual_abuse',             label: 'Sexual Abuse / Harassment',  icon: '🚫', severity: 'critical', desc: 'Any form of sexual misconduct, harassment, or inappropriate sexual behaviour' },
  { id: 'inappropriate_behaviour',  label: 'Inappropriate Behaviour',    icon: '⚠️', severity: 'high',     desc: 'Behaviour that is inappropriate or makes you uncomfortable' },
  { id: 'abusive_language',         label: 'Abusive / Offensive Language', icon: '🤬', severity: 'high',   desc: 'Use of abusive, vulgar, or offensive language' },
  { id: 'discrimination',           label: 'Discrimination / Bias',      icon: '🚷', severity: 'high',     desc: 'Unfair treatment based on gender, caste, religion, or other factors' },
  { id: 'unprofessional_conduct',   label: 'Unprofessional Conduct',     icon: '👔', severity: 'medium',   desc: 'Behaviour unbecoming of a teacher' },
  { id: 'bad_performance',          label: 'Bad Teaching Performance',   icon: '📉', severity: 'medium',   desc: 'Poor quality of teaching, unprepared, or ineffective' },
  { id: 'doubt_not_cleared',        label: 'Not Clearing Doubts',        icon: '❓', severity: 'low',      desc: 'Ignoring or not properly addressing student questions' },
  { id: 'other',                    label: 'Other Issue',                icon: '📋', severity: 'medium',   desc: 'Any other issue not listed above' },
] as const;

type Step = 'confirm' | 'category' | 'details' | 'submitting' | 'done';

const SEV_COLORS: Record<string, string> = {
  critical: 'border-red-400 bg-red-50',
  high: 'border-orange-300 bg-orange-50',
  medium: 'border-amber-300 bg-amber-50',
  low: 'border-blue-300 bg-blue-50',
};

export default function ReportTeacherDialog({
  roomId,
  studentEmail,
  studentName,
  onClose,
  onSubmitted,
}: ReportTeacherDialogProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const selectedCatObj = REPORT_CATEGORIES.find((c) => c.id === selectedCategory);

  const handleSubmit = useCallback(async () => {
    if (!selectedCategory) return;
    setStep('submitting');
    setError('');

    try {
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/report-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_email: studentEmail,
          student_name: studentName,
          category: selectedCategory,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStep('done');
        onSubmitted?.(selectedCategory);
      } else {
        setError(data.error || 'Failed to submit report');
        setStep('details');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('details');
    }
  }, [roomId, studentEmail, studentName, selectedCategory, description]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'submitting') onClose(); }}>
      <div className={cn(
        'mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 animate-in zoom-in-95 fade-in duration-300',
        'max-h-[90vh] overflow-y-auto',
      )}>

        {/* ── Step 1: Confirmation ── */}
        {step === 'confirm' && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Report Teacher</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Are you sure you want to report this teacher? This will be sent directly to the
              management for immediate review.
            </p>
            <p className="mt-2 text-xs text-red-500 font-medium">
              False reports may result in disciplinary action.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => setStep('category')}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors">
                Yes, Report
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Category selection ── */}
        {step === 'category' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">What happened?</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Select the category that best describes the issue</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {REPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setStep('details'); }}
                  className={cn(
                    'w-full text-left rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.98]',
                    SEV_COLORS[cat.severity] || 'border-gray-200 bg-gray-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{cat.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{cat.desc}</p>
                    </div>
                    <svg className="h-4 w-4 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('confirm')}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">
              ← Go back
            </button>
          </div>
        )}

        {/* ── Step 3: Details & submit ── */}
        {step === 'details' && selectedCatObj && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Add Details</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>

            {/* Selected category badge */}
            <div className={cn(
              'rounded-xl border p-3 mb-4',
              SEV_COLORS[selectedCatObj.severity],
            )}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedCatObj.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedCatObj.label}</p>
                  <p className="text-xs text-gray-500">{selectedCatObj.desc}</p>
                </div>
              </div>
            </div>

            {/* Description textarea */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Describe what happened <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more details about the incident..."
                rows={4}
                maxLength={2000}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 resize-none"
              />
              <p className="text-right text-[10px] text-gray-400 mt-1">{description.length}/2000</p>
            </div>

            {error && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setSelectedCategory(null); setStep('category'); }}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button onClick={handleSubmit}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors">
                Submit Report
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Submitting ── */}
        {step === 'submitting' && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 animate-pulse">
              <span className="text-3xl">📤</span>
            </div>
            <h2 className="text-base font-bold text-gray-900">Submitting Report...</h2>
            <p className="mt-2 text-xs text-gray-500">Please wait, notifying management team</p>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === 'done' && (
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-base font-bold text-gray-900">Report Submitted</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Your report has been sent to the management team. They will review it and take
              appropriate action.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Batch Coordinator, Academic Operator, and Owner have been notified via email and WhatsApp.
            </p>
            <button onClick={onClose}
              className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
