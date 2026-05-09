'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * TimeWarningDialog — Shows a centered popup dialog when class is about to end.
 *
 * Appears at 5 minutes remaining with:
 *   - Countdown timer
 *   - Role-specific message (teacher: wrap up, student: ask doubts)
 *   - Dismiss button
 *   - Auto-dismiss after 30 seconds
 *
 * Only shows once per session (uses ref to track).
 */

export interface TimeWarningDialogProps {
  /** Seconds remaining until class ends */
  remainingSeconds: number;
  /** Participant role */
  role: 'teacher' | 'student';
  /** Called when dialog is dismissed */
  onDismiss: () => void;
}

export default function TimeWarningDialog({
  remainingSeconds,
  role,
  onDismiss,
}: TimeWarningDialogProps) {
  const [visible, setVisible] = useState(true);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    autoDismissRef.current = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 30_000);
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    onDismiss();
  };

  if (!visible) return null;

  const mins = Math.ceil(remainingSeconds / 60);

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* Pulsing header */}
        <div className="bg-linear-to-r from-amber-500 to-orange-500 px-6 py-4 text-center">
          <div className="text-4xl mb-2">⏰</div>
          <h2 className="text-xl font-bold text-white">
            {mins} Minute{mins !== 1 ? 's' : ''} Remaining
          </h2>
          <p className="text-sm text-white/80 mt-1">
            {role === 'teacher'
              ? 'Wrap up or extend the class when ready'
              : 'Class continues until your teacher ends it'}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {role === 'teacher' ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📋</span>
                <div>
                  <p className="text-sm font-semibold text-white">Wrap Up Your Session</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Please start wrapping up the current topic. Ask students if they have any remaining questions or doubts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">❓</span>
                <div>
                  <p className="text-sm font-semibold text-white">Doubt Clearing</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Open the floor for any last-minute questions before the session ends.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📝</span>
                <div>
                  <p className="text-sm font-semibold text-white">Homework / Next Steps</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Share any homework assignments or topics for the next session.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🙋</span>
                <div>
                  <p className="text-sm font-semibold text-white">Ask Your Doubts Now!</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    The scheduled time is almost up. If you have any questions, ask your teacher now — the class will continue until the teacher ends it.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📖</span>
                <div>
                  <p className="text-sm font-semibold text-white">Review Key Points</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Make sure you&apos;ve noted down the important points from today&apos;s session.
                  </p>
                </div>
              </div>
              <div className="bg-amber-500/10 rounded-xl px-4 py-3 border border-amber-500/20">
                <p className="text-xs text-amber-300 font-medium">
                  💡 Need more time? You can request Extra Time from the controls once the scheduled time ends.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5">
          <button
            onClick={handleDismiss}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-3 text-sm font-bold text-white transition-colors"
          >
            Got it, Continue Session
          </button>
        </div>
      </div>
    </div>
  );
}
