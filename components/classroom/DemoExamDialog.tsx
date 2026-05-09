'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * DemoExamDialog — Shown 5 minutes before a demo session ends.
 *
 * For teachers: informational — "Student will be invited to take a quick sample exam."
 * For students: call-to-action — "Start Exam" button opens the exam in a new tab.
 *
 * The dialog fetches the demo_request_id from the room_id via the API,
 * then constructs the exam URL.
 */

export interface DemoExamDialogProps {
  roomId: string;
  role: 'teacher' | 'student';
  onDismiss: (examOpened?: boolean) => void;
}

export default function DemoExamDialog({ roomId, role, onDismiss }: DemoExamDialogProps) {
  const [visible, setVisible] = useState(true);
  const [demoRequestId, setDemoRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [examOpened, setExamOpened] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch demo request ID from room
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/demo/requests?room_id=${roomId}`);
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setDemoRequestId(data.data[0].id);
        }
      } catch {
        // If we can't find the demo request, dialog stays informational
      }
      setLoading(false);
    })();
  }, [roomId]);

  // Auto-dismiss after 60 seconds for teacher (student keeps it until action)
  useEffect(() => {
    if (role === 'teacher') {
      autoDismissRef.current = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 60_000);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [role, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    onDismiss(false);
  };

  const handleStartExam = () => {
    if (!demoRequestId) return;
    setExamOpened(true);
    // Open exam in new tab
    window.open(`/demo-exam/${demoRequestId}`, '_blank');
    // Auto-dismiss after opening
    setTimeout(() => {
      setVisible(false);
      onDismiss(true);
    }, 2000);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-teal-500 to-emerald-500 px-6 py-4 text-center">
          <div className="text-4xl mb-2">📝</div>
          <h2 className="text-xl font-bold text-white">Sample Assessment</h2>
          <p className="text-sm text-white/80 mt-1">Quick test based on today&apos;s demo session</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {role === 'teacher' ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">👨‍🏫</span>
                <div>
                  <p className="text-sm font-semibold text-white">Student Assessment</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    The student has been invited to take a quick 10-question sample exam based on today&apos;s demo session.
                    This helps evaluate their current level.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📊</span>
                <div>
                  <p className="text-sm font-semibold text-white">Results on Dashboard</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    The exam results will appear on the AO dashboard alongside the student&apos;s demo session details.
                  </p>
                </div>
              </div>
              <div className="bg-teal-500/10 rounded-xl px-4 py-3 border border-teal-500/20">
                <p className="text-xs text-teal-300 font-medium">
                  ⏱ 10 questions · 30 seconds each · 5 minutes total
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🎯</span>
                <div>
                  <p className="text-sm font-semibold text-white">Quick Assessment Time!</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Take a quick 10-question quiz based on today&apos;s demo session.
                    This helps us understand your current level and customize future classes for you.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⏰</span>
                <div>
                  <p className="text-sm font-semibold text-white">5 Minutes · 10 Questions</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Multiple-choice questions with 30 seconds per question.
                    No negative marking — just do your best!
                  </p>
                </div>
              </div>
              {examOpened && (
                <div className="bg-emerald-500/10 rounded-xl px-4 py-3 border border-emerald-500/20 text-center">
                  <p className="text-xs text-emerald-300 font-medium">
                    ✅ Exam opened in a new tab. Good luck!
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 space-y-2">
          {role === 'student' && !examOpened && (
            <button
              onClick={handleStartExam}
              disabled={loading || !demoRequestId}
              className="w-full rounded-xl bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-colors"
            >
              {loading ? 'Loading…' : !demoRequestId ? 'Exam not available' : '🚀 Start Sample Exam'}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="w-full rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3 text-sm font-medium text-white/80 transition-colors"
          >
            {role === 'teacher' ? 'Got it' : examOpened ? 'Close' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
