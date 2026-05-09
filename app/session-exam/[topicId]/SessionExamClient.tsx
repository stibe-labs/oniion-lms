// =================================================================
// Session Exam Client — Daily Topic Assessment (60 s per MCQ)
// Dynamic question count, auto-advance, no going back
// Follows the same UX as DemoExamClient but for academic sessions
// + Anti-cheat: tab switching, screenshot prevention, fullscreen,
//                watermark, violation recording, beforeunload guard
// =================================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  AlertTriangle, CheckCircle2, Loader2, Trophy, Target, XCircle,
} from 'lucide-react';

const QUESTION_TIME = 60;
const ADVANCE_DELAY = 600;
const TIMEOUT_DELAY = 800;
const MAX_TAB_VIOLATIONS = 3; // Auto-submit after 3 tab switches

interface Question {
  index: number;
  question_text: string;
  options: string[];
  marks: number;
  topic: string;
  image_url?: string | null;
}

interface ExamData {
  topic_id: string;
  subject: string;
  topic_title: string;
  student_name: string;
  student_grade: string;
  total_questions: number;
  total_marks: number;
  duration_seconds: number;
  questions: Question[];
  _question_ids: string[];
}

interface GradedAnswer {
  question_text: string;
  options: string[];
  correct_answer: number;
  selected_option: number | null;
  is_correct: boolean;
  marks: number;
  marks_awarded: number;
  topic: string;
}

interface ResultData {
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
  answered: number;
  skipped: number;
  total_questions: number;
  answers: GradedAnswer[];
}

interface AnswerRecord {
  question_index: number;
  selected_option: number | null;
  time_taken: number;
}

interface Props {
  topicId: string;
  sessionId: string;
  studentEmail: string;
  studentName: string;
  roomId: string;
  inline?: boolean;
  onComplete?: (result: ResultData | null) => void;
  onStatusEvent?: (event: { type: string; detail?: string; timestamp: number }) => void;
}

export default function SessionExamClient({ topicId, sessionId, studentEmail, studentName, roomId, inline, onComplete, onStatusEvent }: Props) {
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [phase, setPhase] = useState<'loading' | 'error' | 'instructions' | 'exam' | 'transition' | 'submitting' | 'result'>('loading');
  const [result, setResult] = useState<ResultData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [startTime] = useState(() => Date.now());

  const examRef = useRef<ExamData | null>(null);
  const currentQRef = useRef(0);
  const answersRef = useRef<AnswerRecord[]>([]);
  const answeredRef = useRef(false);

  // ── Anti-cheat state ──
  const [violations, setViolations] = useState<{ type: string; timestamp: number; detail?: string }[]>([]);
  const violationsRef = useRef<{ type: string; timestamp: number; detail?: string }[]>([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const tabSwitchCountRef = useRef(0);
  const [showViolationWarning, setShowViolationWarning] = useState('');
  // Mobile: skip fullscreen to avoid landscape orientation flip
  // isMobileRef: set in useEffect (not useRef init) so it works after SSR hydration
  const isMobileRef = useRef(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasEverEnteredFullscreenRef = useRef(false); // Prevents flash of fullscreen-required overlay on initial load
  const fsExitingRef = useRef(false); // Suppresses blur violations caused by fullscreen exit
  const autoSubmitTriggered = useRef(false);
  const beaconSentRef = useRef(false);
  const submittingRef = useRef(false); // Guard against double-submit
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Survives phase-change cleanup
  const timerAutoSubmitRef = useRef(false); // True when exam finished via timer exhaustion (last Q timed out)
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  // isLandscape: CSS media query based — always correct on iOS (no dimension timing issues)
  const [isLandscape, setIsLandscape] = useState(false);

  // ── Portrait lock on mobile ──
  const lockPortrait = useCallback(() => {
    if (!isMobileRef.current) return;
    try {
      const so = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
      so?.lock?.('portrait').catch(() => {});
    } catch { /* not supported — ignore */ }
  }, []);

  const unlockOrientation = useCallback(() => {
    if (!isMobileRef.current) return;
    try {
      const so = (screen as Screen & { orientation?: { unlock?: () => void } }).orientation;
      so?.unlock?.();
    } catch { /* not supported — ignore */ }
  }, []);

  // Lock portrait when exam becomes active, unlock when done
  useEffect(() => {
    if (phase === 'exam' || phase === 'transition' || phase === 'instructions') {
      lockPortrait();
    } else if (phase === 'result' || phase === 'error') {
      unlockOrientation();
    }
    return () => {
      if (phase === 'result' || phase === 'error') unlockOrientation();
    };
  }, [phase, lockPortrait, unlockOrientation]);

  // Also unlock on unmount
  useEffect(() => {
    return () => { unlockOrientation(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detect touch device client-side (fixes SSR: useRef init runs on server where window=undefined) ──
  // UA check required — touchscreen laptops also have maxTouchPoints > 0 but should not
  // get the mobile rotate overlay or skip fullscreen.
  useEffect(() => {
    const touch = navigator.maxTouchPoints > 0;
    const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMobile = touch && mobileUA;
    isMobileRef.current = isMobile;
    setIsTouchDevice(isMobile);
  }, []);

  // ── Landscape detection (for blocking overlay on iPhone) ──
  // No mobile guard here — the overlay condition uses isTouchDevice state
  // Uses matchMedia which is always accurate — window dimensions lag on iOS orientationchange
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const check = (e: MediaQueryListEvent | MediaQueryList) => setIsLandscape(e.matches);
    check(mq); // set initial value
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);

  const addViolation = useCallback((type: string, detail?: string) => {
    const v = { type, timestamp: Date.now(), detail };
    violationsRef.current = [...violationsRef.current, v];
    setViolations([...violationsRef.current]);
    onStatusEvent?.({ type, detail, timestamp: v.timestamp });
  }, [onStatusEvent]);

  useEffect(() => { examRef.current = exam; }, [exam]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);

  // ── Helpers ──
  const addAnswer = useCallback((qIndex: number, option: number | null, timeTaken: number) => {
    const record: AnswerRecord = { question_index: qIndex, selected_option: option, time_taken: timeTaken };
    answersRef.current = [...answersRef.current, record];
    setAnswers(answersRef.current);
  }, []);

  // ══════════════════════════════════════════════════════════════
  // ANTI-CHEAT MONITORING
  // ══════════════════════════════════════════════════════════════

  // ── Tab visibility / focus detection ──
  useEffect(() => {
    if (phase !== 'exam' && phase !== 'transition') return;

    const handleVisibility = () => {
      if (document.hidden && !submittingRef.current) {
        tabSwitchCountRef.current += 1;
        setTabSwitchCount(tabSwitchCountRef.current);
        addViolation('tab_switch', 'Tab became hidden');
        const remaining = MAX_TAB_VIOLATIONS - tabSwitchCountRef.current;
        if (remaining > 0) {
          setShowViolationWarning(
            `⚠️ Tab switch detected! (${tabSwitchCountRef.current}/${MAX_TAB_VIOLATIONS}) — ${remaining} more and your exam will be auto-submitted.`
          );
          setTimeout(() => setShowViolationWarning(''), 5000);
        }
      }
    };

    const handleBlur = () => {
      if (submittingRef.current) return; // Don't count blur during submit
      if (fsExitingRef.current) return; // Don't count blur caused by fullscreen exit/entry
      tabSwitchCountRef.current += 1;
      setTabSwitchCount(tabSwitchCountRef.current);
      addViolation('window_blur', 'Window lost focus');
      const remaining = MAX_TAB_VIOLATIONS - tabSwitchCountRef.current;
      if (remaining > 0) {
        setShowViolationWarning(
          `⚠️ Window focus lost! (${tabSwitchCountRef.current}/${MAX_TAB_VIOLATIONS}) — ${remaining} more and your exam will be auto-submitted.`
        );
        setTimeout(() => setShowViolationWarning(''), 5000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [phase, addViolation]);

  // ── Screenshot / copy prevention ──
  useEffect(() => {
    if (phase !== 'exam' && phase !== 'transition' && phase !== 'instructions') return;

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addViolation('context_menu', 'Right-click attempt');
    };

    const blockKeys = (e: KeyboardEvent) => {
      // Block screenshot / copy / print shortcuts
      if (
        (e.key === 'PrintScreen') ||
        (e.ctrlKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 'c') ||
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'a') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'S') ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'))
      ) {
        e.preventDefault();
        addViolation('keyboard_shortcut', `Blocked: ${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`);
        setShowViolationWarning('⚠️ Screenshots and copying are not allowed during the exam.');
        setTimeout(() => setShowViolationWarning(''), 3000);
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeys);
    };
  }, [phase, addViolation]);

  // ── Fullscreen enforcement (desktop only) ──
  const requestFullscreen = useCallback(() => {
    // Skip fullscreen on mobile — causes landscape orientation flip
    if (isMobileRef.current) { setIsFullscreen(true); return; }
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (phase !== 'exam' && phase !== 'transition') return;

    const handleFsChange = () => {
      if (isMobileRef.current) return; // Mobile doesn't use fullscreen
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (isFull) {
        hasEverEnteredFullscreenRef.current = true;
      } else {
        // Suppress window.blur violations that fire right after fullscreen exit
        fsExitingRef.current = true;
        setTimeout(() => { fsExitingRef.current = false; }, 1000);
      }
      onStatusEvent?.({
        type: isFull ? 'fullscreen_enter' : 'fullscreen_exit',
        detail: isFull ? 'Entered fullscreen' : 'Exited fullscreen during exam',
        timestamp: Date.now(),
      });
      if (!isFull && phase === 'exam') {
        addViolation('fullscreen_exit', 'Exited fullscreen during exam');
        setShowViolationWarning('⚠️ Please stay in fullscreen mode during the exam.');
        setTimeout(() => setShowViolationWarning(''), 4000);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [phase, addViolation, onStatusEvent]);

  // ── Auto-submit on too many violations ──
  const [forceSubmit, setForceSubmit] = useState(false);

  // ── beforeunload: warn + send partial answers via beacon ──
  useEffect(() => {
    if (phase !== 'exam' && phase !== 'transition' && phase !== 'instructions') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Always warn the student
      e.preventDefault();

      // Send partial answers via beacon if exam is in progress
      if ((phase === 'exam' || phase === 'transition') && !beaconSentRef.current && examRef.current) {
        beaconSentRef.current = true;
        const payload = {
          topic_id: topicId,
          session_id: sessionId || undefined,
          room_id: roomId || undefined,
          student_email: studentEmail,
          student_name: studentName,
          student_grade: examRef.current.student_grade,
          answers: answersRef.current,
          time_taken_seconds: Math.floor((Date.now() - startTime) / 1000),
          question_ids: examRef.current._question_ids || [],
          violations: [...violationsRef.current, { type: 'page_exit', timestamp: Date.now(), detail: 'Student refreshed or closed the browser' }],
          tab_switch_count: tabSwitchCountRef.current,
          auto_submitted: true,
        };
        navigator.sendBeacon('/api/v1/session-exam', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase, topicId, sessionId, roomId, studentEmail, studentName, startTime]);

  useEffect(() => {
    if (tabSwitchCount >= MAX_TAB_VIOLATIONS && !autoSubmitTriggered.current && (phase === 'exam' || phase === 'transition')) {
      autoSubmitTriggered.current = true;
      addViolation('auto_submit', `Auto-submitted after ${MAX_TAB_VIOLATIONS} tab switches`);
      setShowViolationWarning('🚫 Too many violations! Your exam is being auto-submitted.');
      setForceSubmit(true);
    }
  }, [tabSwitchCount, phase, addViolation]);

  const doSubmit = useCallback(async () => {
    // Prevent double-submit (beacon + normal, or forceSubmit + normal)
    if (submittingRef.current) return;
    submittingRef.current = true;
    beaconSentRef.current = true; // Also block beacon from firing
    setPhase('submitting');
    try {
      const res = await fetch('/api/v1/session-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId,
          session_id: sessionId || undefined,
          room_id: roomId || undefined,
          student_email: studentEmail,
          student_name: studentName,
          student_grade: exam?.student_grade,
          answers: answersRef.current,
          time_taken_seconds: Math.floor((Date.now() - startTime) / 1000),
          question_ids: examRef.current?._question_ids || [],
          violations: violationsRef.current,
          tab_switch_count: tabSwitchCountRef.current,
          auto_submitted: autoSubmitTriggered.current,
        }),
      });
      // Exit fullscreen AFTER fetch completes (avoids triggering blur → forceSubmit race)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (!res.ok && res.status >= 500) {
        const text = await res.text();
        console.error('[SessionExam] Server error:', res.status, text.slice(0, 200));
        setErrorMsg('Server error — your answers are safe, try refreshing');
        setPhase('error');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setPhase('result');
        // Student closes manually via button — no auto-dismiss
      } else {
        setErrorMsg(json.error || 'Failed to submit exam');
        setPhase('error');
      }
    } catch {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setErrorMsg('Network error — please try again');
      setPhase('error');
    }
  }, [topicId, sessionId, roomId, studentEmail, studentName, exam, startTime]);

  // ── Force-submit due to anti-cheat violations ──
  useEffect(() => {
    if (forceSubmit) doSubmit();
  }, [forceSubmit, doSubmit]);

  const nextQuestion = useCallback(() => {
    const questions = examRef.current?.questions || [];
    const idx = currentQRef.current;
    if (idx + 1 >= questions.length) {
      doSubmit();
    } else {
      setCurrentQ(idx + 1);
      setTimeLeft(QUESTION_TIME);
      setSelectedOption(null);
      answeredRef.current = false;
      setPhase('exam');
    }
  }, [doSubmit]);

  // ── Load exam ──
  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams({
          topic_id: topicId,
          ...(sessionId && { session_id: sessionId }),
          ...(studentEmail && { student_email: studentEmail }),
          ...(studentName && { student_name: studentName }),
          ...(roomId && { room_id: roomId }),
        });
        const res = await fetch(`/api/v1/session-exam?${qs}`);
        const json = await res.json();
        if (json.success) {
          setExam(json.data);
          if (inline) {
            // Skip instructions — dialog already showed exam info
            answeredRef.current = false;
            setPhase('exam');
            setTimeLeft(QUESTION_TIME);
            // requestFullscreen is a no-op on mobile; needed on desktop
            requestFullscreen();
          } else {
            setPhase('instructions');
          }
        } else {
          setErrorMsg(json.error || 'Failed to load exam');
          setPhase('error');
        }
      } catch {
        setErrorMsg('Network error — please check your connection');
        setPhase('error');
      }
    })();
  }, [topicId, sessionId, studentEmail, studentName, roomId]);

  // ── Timer countdown ──
  useEffect(() => {
    if (phase !== 'exam') return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, currentQ]);

  // ── Handle time-up ──
  // NOTE: We intentionally do NOT return a cleanup that clears advanceTimerRef.
  // If we did, calling setPhase('transition') inside this effect would trigger
  // React's cleanup immediately (because 'phase' is a dependency), canceling
  // the nextQuestion() call and leaving the exam stuck on the same question.
  useEffect(() => {
    if (timeLeft !== 0 || phase !== 'exam' || answeredRef.current) return;
    answeredRef.current = true;
    const questions = exam?.questions || [];
    const q = questions[currentQ];
    if (q) addAnswer(q.index, null, QUESTION_TIME);
    // Flag if this is the last question — we'll auto-close after submit
    if (currentQ + 1 >= (exam?.questions.length ?? 0)) {
      timerAutoSubmitRef.current = true;
    }
    setPhase('transition');
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => nextQuestion(), TIMEOUT_DELAY);
    // No cleanup return here — phase change must NOT cancel the advance timer
  }, [timeLeft, phase, exam, currentQ, addAnswer, nextQuestion]);

  // Cleanup advance timer on unmount
  useEffect(() => {
    return () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); };
  }, []);

  // ── Auto-close after timer-exhaustion submit ──
  // When the last question timed out and the exam auto-submitted, show a
  // 5-second countdown on the result screen and then close automatically.
  useEffect(() => {
    if (phase !== 'result' || !timerAutoSubmitRef.current || !result) return;
    let count = 5;
    setAutoCloseCountdown(count);
    const tick = setInterval(() => {
      count -= 1;
      setAutoCloseCountdown(count);
      if (count <= 0) {
        clearInterval(tick);
        if (inline && onComplete) onComplete(result);
        else window.close();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, result, inline, onComplete]);

  // ── Start exam ──
  const startExam = () => {
    answeredRef.current = false;
    setPhase('exam');
    setTimeLeft(QUESTION_TIME);
    requestFullscreen();
  };

  // ── Select answer ──
  const selectAnswer = (optionIdx: number) => {
    if (answeredRef.current || phase !== 'exam') return;
    answeredRef.current = true;
    setSelectedOption(optionIdx);
    const questions = exam?.questions || [];
    const q = questions[currentQ];
    if (q) addAnswer(q.index, optionIdx, QUESTION_TIME - timeLeft);
    setPhase('transition');
    setTimeout(() => nextQuestion(), ADVANCE_DELAY);
  };

  // ==============================================================
  // RENDER
  // ==============================================================

  // Wrapper for inline mode — renders as fixed fullscreen overlay
  // overflow-hidden here: the inner flex-col manages its own scroll via flex-1 child
  const Wrap = inline
    ? ({ children }: { children: React.ReactNode }) => (
        <div className="fixed inset-0 z-[300] bg-[#1a1a2e] overflow-hidden">{children}</div>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  if (phase === 'loading') {
    return (
      <Wrap>
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/buji/4 second thinking.gif" alt="Loading" width={100} className="mx-auto mb-3" style={{ objectFit: 'contain' }} />
          <p className="text-sm text-teal-200/60">Loading your exam…</p>
        </div>
      </div>
      </Wrap>
    );
  }

  if (phase === 'error') {
    return (
      <Wrap>
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="bg-[#16213e] rounded-2xl border border-red-500/20 p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Exam Not Available</h2>
          <p className="text-sm text-gray-400 mb-4">{errorMsg}</p>
          <button
            onClick={() => { if (inline && onComplete) onComplete(null); else window.close(); }}
            className="rounded-lg bg-white/10 hover:bg-white/15 px-6 py-2.5 text-sm text-white transition-colors"
          >
            {inline ? 'Close' : 'Close Tab'}
          </button>
        </div>
      </div>
      </Wrap>
    );
  }

  // ── Instructions ──
  if (phase === 'instructions' && exam) {
    return (
      <Wrap>
      <div className="min-h-[100dvh] bg-[#1a1a2e] flex items-start justify-center p-2 sm:p-4">
        <div className="bg-[#16213e] rounded-2xl border border-teal-500/20 p-4 sm:p-8 max-w-lg w-full my-auto">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-teal-900/40 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white">Session Exam</h1>
              <p className="text-xs sm:text-sm text-teal-300/60 truncate">{exam.subject} · {exam.topic_title}</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4">
            Hi <strong className="text-white">{exam.student_name || 'Student'}</strong>! Test your understanding of <strong className="text-teal-300">{exam.topic_title}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:space-y-3 sm:grid-cols-1 mb-4 sm:mb-6">
            <InfoRow label="Questions" value={`${exam.total_questions}`} />
            <InfoRow label="Time/Q" value="1 min" />
            <InfoRow label="Total Marks" value={`${exam.total_marks}`} />
            <InfoRow label="Total Time" value={`${Math.ceil(exam.duration_seconds / 60)}m`} />
          </div>

          <div className="rounded-lg bg-amber-900/20 border border-amber-800/50 p-3 sm:p-4 mb-3 sm:mb-6">
            <h3 className="text-xs sm:text-sm font-semibold text-amber-400 flex items-center gap-2 mb-1.5 sm:mb-2">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> How It Works
            </h3>
            <ul className="text-[11px] sm:text-xs text-gray-400 space-y-1 sm:space-y-1.5">
              <li>• <strong className="text-amber-300">1 minute</strong> per question</li>
              <li>• Select an option to lock and advance</li>
              <li>• Timeout = <strong className="text-amber-300">0 marks</strong>. No going back.</li>
              <li>• No negative marking</li>
            </ul>
          </div>

          <div className="rounded-lg bg-red-900/20 border border-red-800/50 p-3 sm:p-4 mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-sm font-semibold text-red-400 flex items-center gap-2 mb-1.5 sm:mb-2">
              🛡️ Anti-Cheat Active
            </h3>
            <ul className="text-[11px] sm:text-xs text-gray-400 space-y-1 sm:space-y-1.5">
              <li>• <strong className="text-red-300">Tab switching</strong> monitored — {MAX_TAB_VIOLATIONS} = auto-submit</li>
              <li>• <strong className="text-red-300">Screenshots & copying</strong> blocked</li>
              <li>• <strong className="text-red-300">Fullscreen</strong> required</li>
            </ul>
          </div>

          <button
            onClick={startExam}
            className="w-full rounded-xl bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 py-3 text-sm font-bold text-white transition-all"
          >
            Start Exam
          </button>
        </div>
      </div>
      </Wrap>
    );
  }

  // ── Submitting ──
  if (phase === 'submitting') {
    return (
      <Wrap>
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/buji/4 second thinking.gif" alt="Grading" width={120} className="mx-auto mb-4" style={{ objectFit: 'contain' }} />
          <p className="text-sm text-white font-medium">Grading your exam…</p>
          <p className="text-xs text-gray-400 mt-1">This will only take a moment</p>
        </div>
      </div>
      </Wrap>
    );
  }

  // ── Result Screen ──
  if (phase === 'result' && result) {
    const passed = result.percentage >= 35;
    const correctCount = result.answers.filter(a => a.is_correct).length;
    const wrongCount = result.answers.filter(a => a.selected_option !== null && !a.is_correct).length;
    const totalTimeSecs = answers.reduce((s, a) => s + a.time_taken, 0);
    const totalTimeFmt = totalTimeSecs >= 60
      ? `${Math.floor(totalTimeSecs / 60)}m ${totalTimeSecs % 60}s`
      : `${totalTimeSecs}s`;

    return (
      <div className="fixed inset-0 z-[310] flex flex-col bg-[#1a1a2e]">
        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="mx-auto max-w-lg px-3 pt-4 pb-6 sm:px-4 sm:pt-6 sm:pb-8">

            {/* Hero */}
            <div className="text-center mb-4 sm:mb-5">
              <div className={`h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full flex items-center justify-center mb-3 ${passed ? 'bg-emerald-900/40' : 'bg-red-900/40'}`}>
                {passed ? <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" /> : <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-red-400" />}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-0.5">
                {result.percentage >= 75 ? 'Excellent!' : result.percentage >= 50 ? 'Good Job!' : passed ? 'Keep Going!' : 'Don\'t Worry!'}
              </h2>
              <p className="text-xs text-gray-400">
                {passed ? 'Great effort on your session exam!' : 'Keep studying — you\'ll improve next time!'}
              </p>
              {exam && (
                <p className="text-[11px] text-teal-400/70 mt-1 truncate px-4">
                  {exam.subject} · {exam.topic_title}
                </p>
              )}
            </div>

            {/* Score row */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-white leading-none">
                  {result.score}<span className="text-sm text-white/40">/{result.total_marks}</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Score</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className={`text-2xl sm:text-3xl font-black leading-none ${result.percentage >= 75 ? 'text-emerald-400' : result.percentage >= 50 ? 'text-teal-400' : result.percentage >= 35 ? 'text-amber-400' : 'text-red-400'}`}>
                  {result.percentage}%
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Percentage</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className={`text-2xl sm:text-3xl font-black leading-none ${result.grade_letter === 'A' ? 'text-emerald-400' : result.grade_letter === 'B' ? 'text-teal-400' : result.grade_letter === 'C' ? 'text-amber-400' : 'text-red-400'}`}>
                  {result.grade_letter}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Grade</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-4">
              <div className="rounded-lg bg-emerald-900/20 border border-emerald-800/30 p-2 text-center">
                <p className="text-lg font-bold text-emerald-400">{correctCount}</p>
                <p className="text-[9px] text-gray-500">Correct</p>
              </div>
              <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-2 text-center">
                <p className="text-lg font-bold text-red-400">{wrongCount}</p>
                <p className="text-[9px] text-gray-500">Wrong</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-lg font-bold text-gray-400">{result.skipped}</p>
                <p className="text-[9px] text-gray-500">Skipped</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-lg font-bold text-teal-300">{totalTimeFmt}</p>
                <p className="text-[9px] text-gray-500">Time</p>
              </div>
            </div>

            {/* Violation notices */}
            {autoSubmitTriggered.current && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-center mb-3">
                <p className="text-[11px] text-red-300 font-medium">
                  🚫 Auto-submitted after {tabSwitchCount} tab switch violations. Reported to teacher.
                </p>
              </div>
            )}
            {violations.length > 0 && !autoSubmitTriggered.current && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-center mb-3">
                <p className="text-[11px] text-amber-300 font-medium">
                  ⚠️ {violations.length} monitoring event(s) recorded during your exam.
                </p>
              </div>
            )}

            {/* Answer review */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase">Answer Review</h3>
                <span className="text-[10px] text-gray-500">{correctCount}/{result.total_questions} correct</span>
              </div>
              <div className="space-y-1.5">
                {result.answers.map((a, idx) => (
                  <div key={idx} className={`rounded-lg p-2.5 ${
                    a.selected_option === null ? 'bg-white/5' :
                    a.is_correct ? 'bg-emerald-900/20 border border-emerald-800/20' : 'bg-red-900/15 border border-red-800/20'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shrink-0 mt-0.5 ${
                        a.selected_option !== null
                          ? a.is_correct ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'
                          : 'bg-white/10 text-gray-400'
                      }`}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/80 leading-snug">{a.question_text}</p>
                        {a.selected_option !== null && !a.is_correct && (
                          <div className="mt-1 space-y-0.5">
                            <p className="text-[10px] text-red-400/80 flex items-center gap-1">
                              <XCircle className="h-2.5 w-2.5 shrink-0" />
                              Your answer: {a.options[a.selected_option]}
                            </p>
                            <p className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                              Correct: {a.options[a.correct_answer]}
                            </p>
                          </div>
                        )}
                        {a.selected_option !== null && a.is_correct && (
                          <p className="text-[10px] text-emerald-400/70 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                            {a.options[a.selected_option]}
                          </p>
                        )}
                        {a.selected_option === null && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Not attempted · Correct: {a.options[a.correct_answer]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved info */}
            <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 p-2.5 text-center mt-4">
              <p className="text-[11px] text-teal-300 font-medium">
                Results saved! Your teacher and parents will be notified.
              </p>
            </div>
          </div>
        </div>

        {/* ── Sticky bottom button ── */}
        <div className="shrink-0 border-t border-white/10 bg-[#1a1a2e] px-3 py-3 sm:px-4 sm:py-4">
          <div className="mx-auto max-w-lg">
            <button
              onClick={() => { if (inline && onComplete) onComplete(result); else window.close(); }}
              className="w-full rounded-xl bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 py-3 text-sm font-bold text-white transition-all active:scale-[0.98]"
            >
              {autoCloseCountdown !== null
                ? `Closing in ${autoCloseCountdown}s…`
                : 'Close & Return to Session'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================
  // EXAM SCREEN — one question + 60s circular timer
  // ==============================================================

  const questions = exam?.questions ?? [];
  const q = questions[currentQ];
  const progress = (currentQ / questions.length) * 100;
  const circum = 2 * Math.PI * 24;
  const timerPct = timeLeft / QUESTION_TIME;
  const isTransition = phase === 'transition';

  const optBg = [
    'border-blue-500/30 bg-blue-900/20 hover:border-blue-400 hover:bg-blue-900/30',
    'border-emerald-500/30 bg-emerald-900/20 hover:border-emerald-400 hover:bg-emerald-900/30',
    'border-amber-500/30 bg-amber-900/20 hover:border-amber-400 hover:bg-amber-900/30',
    'border-purple-500/30 bg-purple-900/20 hover:border-purple-400 hover:bg-purple-900/30',
  ];
  const optBgSel = [
    'border-blue-400 bg-blue-800/40 ring-2 ring-blue-500/30',
    'border-emerald-400 bg-emerald-800/40 ring-2 ring-emerald-500/30',
    'border-amber-400 bg-amber-800/40 ring-2 ring-amber-500/30',
    'border-purple-400 bg-purple-800/40 ring-2 ring-purple-500/30',
  ];

  return (
    <Wrap>
    {/* ── Landscape blocking overlay ── */}
    {isTouchDevice && isLandscape && (phase === 'exam' || phase === 'transition' || phase === 'instructions') && (
      <div className="fixed inset-0 z-[9999] bg-[#0d1117] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-5" style={{ animation: 'spin 2s linear infinite', display: 'inline-block', transform: 'rotate(90deg)' }}>📱</div>
          <h3 className="text-xl font-bold text-white mt-3 mb-2">Rotate Your Phone</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Please hold your phone in<br /><strong className="text-teal-400">portrait (upright) mode</strong><br />to continue the exam.
          </p>
        </div>
      </div>
    )}
    {/* h-[100dvh] (not min-h) so flex-1 child gets exact remaining height — single scroll container */}
    <div className="h-[100dvh] bg-[#1a1a2e] flex flex-col select-none" style={{ WebkitUserSelect: 'none' }}>
      {/* Anti-cheat: Violation warning banner */}
      {showViolationWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600/95 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3 text-center animate-in slide-in-from-top duration-300">
          <p className="text-xs sm:text-sm font-bold text-white">{showViolationWarning}</p>
        </div>
      )}

      {/* Anti-cheat: Fullscreen re-entry prompt (only shown after student has already been in fullscreen once) */}
      {!isFullscreen && phase === 'exam' && hasEverEnteredFullscreenRef.current && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16213e] rounded-2xl border border-amber-500/30 p-6 sm:p-8 max-w-sm text-center">
            <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🖥️</div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-2">Fullscreen Required</h3>
            <p className="text-xs text-gray-400 mb-4">
              Return to fullscreen mode to continue.
            </p>
            <button
              onClick={requestFullscreen}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-2.5 text-sm font-bold text-white transition-colors"
            >
              Go Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Anti-cheat: Student watermark (makes phone photos traceable) */}
      <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden opacity-[0.03]" aria-hidden="true">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 100px,
            rgba(255,255,255,0.1) 100px,
            rgba(255,255,255,0.1) 101px
          )`,
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute text-white text-xs font-mono whitespace-nowrap"
              style={{
                top: `${(i * 120) % 600 + 20}px`,
                left: `${(i * 200) % 800 + 10}px`,
                transform: 'rotate(-30deg)',
              }}>
              {studentName} • {studentEmail} • {new Date().toLocaleDateString()}
            </div>
          ))}
        </div>
      </div>

      {/* Anti-cheat: Violation counter in top bar */}
      {violations.length > 0 && (
        <div className="fixed top-2 right-2 z-20 bg-red-900/80 backdrop-blur-sm rounded-full px-3 py-1 border border-red-500/30">
          <span className="text-[10px] font-bold text-red-300">
            ⚠️ {tabSwitchCount}/{MAX_TAB_VIOLATIONS} violations
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5">
        <div className="h-full bg-linear-to-r from-teal-500 to-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Top bar */}
      <div className="border-b border-white/10 px-3 sm:px-4 py-2 sm:py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate">Session Exam — {exam?.subject}</h1>
            <p className="text-[10px] sm:text-xs text-gray-400">
              Q {currentQ + 1}/{questions.length} · {q?.marks} mark{(q?.marks || 0) > 1 ? 's' : ''}
            </p>
          </div>
          {/* Circular timer */}
          <div className="relative h-11 w-11 sm:h-14 sm:w-14 shrink-0">
            <svg className="h-11 w-11 sm:h-14 sm:w-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
              <circle cx="28" cy="28" r="24" fill="none" strokeWidth="3"
                strokeDasharray={`${circum}`}
                strokeDashoffset={`${circum * (1 - timerPct)}`}
                strokeLinecap="round"
                className={`transition-all duration-1000 ease-linear ${
                  timeLeft <= 10 ? 'text-red-500' : timeLeft <= 20 ? 'text-amber-500' : 'text-teal-400'
                }`} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold ${
              timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'
            }`}>{timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Question + Options — single scroll container, iOS needs webkit-overflow-scrolling */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-2xl w-full mx-auto pb-4">
          {q && (
            <>
              {/* Topic chip */}
              <div className="mb-2 sm:mb-4">
                <span className="inline-flex items-center rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-teal-300">
                  {q.topic}
                </span>
              </div>

              <p className="text-sm sm:text-lg font-medium text-white mb-3 sm:mb-4 leading-relaxed">{q.question_text}</p>

              {q.image_url && (
                <div className="mb-4 sm:mb-6 flex justify-center">
                  <img src={q.image_url} alt={`Question ${currentQ + 1} reference`}
                    className="max-h-32 sm:max-h-56 w-auto rounded-xl border border-white/10 shadow-lg" />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:gap-2.5">
                {q.options.map((opt: string, idx: number) => {
                  const isSel = selectedOption === idx;
                  const letter = String.fromCharCode(65 + idx);
                  const disabled = isTransition || answeredRef.current;
                  return (
                    <label key={idx}
                      className={`flex items-center gap-2.5 sm:gap-3 rounded-xl border-2 px-3 sm:px-4 py-3 sm:py-3.5 cursor-pointer select-none transition-all duration-200
                        ${isSel ? optBgSel[idx % 4] : optBg[idx % 4]}
                        ${disabled && !isSel ? 'opacity-40 cursor-default' : ''}`}
                    >
                      {/* Hidden native radio — provides keyboard navigation + full-row click area */}
                      <input
                        type="radio"
                        name={`q-${currentQ}`}
                        value={idx}
                        checked={isSel}
                        disabled={disabled}
                        onChange={() => selectAnswer(idx)}
                        className="sr-only"
                      />
                      {/* Custom checkbox circle */}
                      <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isSel
                          ? 'border-white bg-white'
                          : 'border-white/40 bg-white/5'
                      }`}>
                        {isSel && <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-teal-600" />}
                      </span>
                      {/* Letter badge */}
                      <span className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg text-[10px] sm:text-xs font-bold ${
                        isSel ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                      }`}>{letter}</span>
                      {/* Option text — full width for easy tapping */}
                      <span className="text-xs sm:text-sm text-white flex-1 leading-snug">{opt}</span>
                      {isSel && <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white ml-1 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-6 sm:mt-10 flex-wrap">
            {questions.map((_, idx) => {
              const ans = answers.find(a => a.question_index === idx);
              const isCurrent = idx === currentQ;
              const wasAnswered = ans && ans.selected_option !== null;
              const wasSkipped = ans && ans.selected_option === null;
              return (
                <div key={idx} className={`h-2 rounded-full transition-all duration-300 ${
                  isCurrent ? 'w-6 bg-teal-400'
                  : wasAnswered ? 'w-2 bg-teal-400/60'
                  : wasSkipped ? 'w-2 bg-red-400/60'
                  : 'w-2 bg-white/10'
                }`} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </Wrap>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 sm:px-4 py-2 sm:py-3">
      <span className="text-xs sm:text-sm text-gray-400">{label}</span>
      <span className="text-xs sm:text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function ResultCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs text-gray-400">{label}</p>
      <p className={`text-lg sm:text-xl font-bold ${accent ? 'text-teal-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
