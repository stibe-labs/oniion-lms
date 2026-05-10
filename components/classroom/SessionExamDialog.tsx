'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * SessionExamDialog — Shown when teacher starts a session exam.
 *
 * For teachers: informational — auto-dismisses after 60s.
 * For students: call-to-action — "Start Exam" button, auto-starts after 30s.
 *   - No dismiss/skip option — students MUST take the exam.
 *   - Camera must be ON to start (auto-start waits for camera).
 */

export interface SessionExamDialogProps {
  topicId: string;
  topicTitle: string;
  subject: string;
  roomId: string;
  sessionId: string;
  studentEmail: string;
  studentName: string;
  role: 'teacher' | 'student';
  isCameraOn?: boolean;
  questionCount?: number;
  onEnableCamera?: () => void;
  onDismiss: (examOpened?: boolean) => void;
}

const AUTO_START_SECONDS = 30;

export default function SessionExamDialog({
  topicId, topicTitle, subject, roomId, sessionId,
  studentEmail, studentName, role, isCameraOn = false, questionCount, onEnableCamera, onDismiss,
}: SessionExamDialogProps) {
  const [visible, setVisible] = useState(true);
  const [examOpened, setExamOpened] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoStartCountdown, setAutoStartCountdown] = useState(AUTO_START_SECONDS);
  const autoStartTriggered = useRef(false);

  // Auto-dismiss after 60 seconds for teacher
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

  // Auto-start countdown for students (30s)
  useEffect(() => {
    if (role !== 'student' || examOpened) return;
    const id = setInterval(() => {
      setAutoStartCountdown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [role, examOpened]);

  // Auto-start when countdown reaches 0 (camera no longer required)
  useEffect(() => {
    if (role !== 'student' || autoStartCountdown > 0 || examOpened || autoStartTriggered.current) return;
    autoStartTriggered.current = true;
    handleStartExam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartCountdown, examOpened, role]);

  const handleDismiss = () => {
    setVisible(false);
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    onDismiss(false);
  };

  const handleStartExam = () => {
    if (!topicId) return;
    setExamOpened(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss(true);
    }, 500);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-200 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
      <div className="flex min-h-full items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden flex flex-col">
        {/* Header — compact on landscape mobile */}
        <div className="bg-linear-to-r from-secondary to-primary px-4 sm:px-6 py-3 sm:py-4 text-center shrink-0">
          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">📝</div>
          <h2 className="text-base sm:text-xl font-bold text-white">Session Exam</h2>
          <p className="text-xs sm:text-sm text-white/80 mt-0.5 sm:mt-1 truncate">{subject} — {topicTitle}</p>
        </div>

        {/* Body — scrollable for small screens */}
        <div className="px-4 sm:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1 min-h-0">
          {role === 'teacher' ? (
            <>
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl mt-0.5 shrink-0">👨‍🏫</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Exam Started</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Students have been invited to take the topic exam on <strong className="text-white">{topicTitle}</strong>.
                    Results will appear below as students complete.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl mt-0.5 shrink-0">📊</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Real-time Results</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    You&apos;ll see scores as each student finishes. Full results are also available on the dashboard.
                  </p>
                </div>
              </div>
              <div className="bg-secondary/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-secondary/20">
                <p className="text-xs text-secondary/80 font-medium">
                  ⏱ {questionCount || '?'} questions · 1 minute each · {questionCount || '?'} minutes total
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl mt-0.5 shrink-0">🎯</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Topic Assessment Time!</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Your teacher has started an exam on <strong className="text-white">{topicTitle}</strong>.
                    Test your understanding of today&apos;s lesson!
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl mt-0.5 shrink-0">⏰</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{questionCount || '?'} Minutes · {questionCount || '?'} Questions</p>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Multiple-choice questions with 1 minute per question.
                    No negative marking — just do your best!
                  </p>
                </div>
              </div>
              {examOpened && (
                <div className="bg-primary/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-primary/20 text-center">
                  <p className="text-xs text-primary/80 font-medium">
                    ✅ Starting exam… Good luck!
                  </p>
                </div>
              )}
              <div className="bg-amber-500/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-amber-500/20">
                <p className="text-xs text-amber-300 font-medium">
                  ⚠️ Anti-cheat: tab switching, screenshots, and screen recording will be detected.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-5 space-y-2 shrink-0">
          {role === 'student' && !examOpened && (
            <button
              onClick={handleStartExam}
              className="w-full rounded-xl px-4 py-2.5 sm:py-3 text-sm font-bold text-white transition-colors bg-linear-to-r from-secondary to-primary hover:from-secondary/90 hover:to-primary/90"
            >
              {autoStartCountdown > 0
                ? `🚀 Start Exam (auto-starts in ${autoStartCountdown}s)`
                : '🚀 Starting…'}
            </button>
          )}
          {role === 'teacher' && (
            <button
              onClick={handleDismiss}
              className="w-full rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 sm:py-3 text-sm font-medium text-white/80 transition-colors"
            >
              Got it
            </button>
          )}
          {role === 'student' && examOpened && (
            <button
              onClick={handleDismiss}
              className="w-full rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 sm:py-3 text-sm font-medium text-white/80 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
