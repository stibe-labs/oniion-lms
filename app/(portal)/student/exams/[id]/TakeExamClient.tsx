// =================================================================
// Take Exam - Learner's Test Style (30 s per MCQ)
// One question at a time, auto-advance on answer, no going back
// =================================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, ArrowLeft, Loader2, Trophy, Target,
} from 'lucide-react';

const QUESTION_TIME = 30; // seconds per question
const ADVANCE_DELAY = 600; // ms pause after answer before next question
const TIMEOUT_DELAY = 800; // ms pause after timeout before next question

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'descriptive';
  options: string[];
  marks: number;
  sort_order: number;
}

interface ExamData {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  questions: Question[];
}

interface AttemptData {
  id: string;
  started_at: string;
  status: string;
}

interface ResultData {
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
}

interface AnswerRecord {
  question_id: string;
  selected_option: number | null;
  time_taken: number;
}

interface Props {
  examId: string;
  userName: string;
  userEmail: string;
}

export default function TakeExamClient({ examId, userName, userEmail }: Props) {
  const router = useRouter();

  // -- State --
  const [exam, setExam] = useState<ExamData | null>(null);
  const [, setAttempt] = useState<AttemptData | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [phase, setPhase] = useState<'loading' | 'instructions' | 'exam' | 'transition' | 'submitting' | 'result'>('loading');
  const [result, setResult] = useState<ResultData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // -- Refs (for stable callbacks inside timers) --
  const examRef = useRef<ExamData | null>(null);
  const currentQRef = useRef(0);
  const answersRef = useRef<AnswerRecord[]>([]);
  const answeredRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { examRef.current = exam; }, [exam]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);

  // -- Helpers --
  const addAnswer = useCallback((qId: string, option: number | null, timeTaken: number) => {
    const record: AnswerRecord = { question_id: qId, selected_option: option, time_taken: timeTaken };
    answersRef.current = [...answersRef.current, record];
    setAnswers(answersRef.current);
  }, []);

  const doSubmit = useCallback(async () => {
    setPhase('submitting');
    try {
      const res = await fetch(`/api/v1/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          answers: answersRef.current.map(a => ({
            question_id: a.question_id,
            selected_option: a.selected_option,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setPhase('result');
      }
    } catch (err) {
      console.error('Failed to submit exam:', err);
    }
  }, [examId]);

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

  // -- Load exam --
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/exams/${examId}`);
        const json = await res.json();
        if (json.success) { setExam(json.data); setPhase('instructions'); }
      } catch (err) { console.error('Failed to load exam:', err); }
    })();
  }, [examId]);

  // -- Timer countdown (restarts on each new question) --
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

  // -- Handle time-up (fires when timeLeft hits 0) --
  useEffect(() => {
    if (timeLeft !== 0 || phase !== 'exam' || answeredRef.current) return;
    answeredRef.current = true;
    const questions = exam?.questions || [];
    const q = questions[currentQ];
    if (q) addAnswer(q.id, null, QUESTION_TIME);
    setPhase('transition');
    const tid = setTimeout(() => nextQuestion(), TIMEOUT_DELAY);
    return () => clearTimeout(tid);
  }, [timeLeft, phase, exam, currentQ, addAnswer, nextQuestion]);

  // -- Start exam --
  const startExam = async () => {
    try {
      const res = await fetch(`/api/v1/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const json = await res.json();
      if (json.success) {
        setAttempt(json.data);
        answeredRef.current = false;
        setPhase('exam');
        setTimeLeft(QUESTION_TIME);
      }
    } catch (err) { console.error('Failed to start exam:', err); }
  };

  // -- Select answer --
  const selectAnswer = (optionIdx: number) => {
    if (answeredRef.current || phase !== 'exam') return;
    answeredRef.current = true;
    setSelectedOption(optionIdx);
    const questions = exam?.questions || [];
    const q = questions[currentQ];
    if (q) addAnswer(q.id, optionIdx, QUESTION_TIME - timeLeft);
    setPhase('transition');
    setTimeout(() => nextQuestion(), ADVANCE_DELAY);
  };

  // ==============================================================
  // RENDER
  // ==============================================================

  // -- Loading --
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // -- Instructions --
  if (phase === 'instructions' && exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-border p-8 max-w-lg w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-violet-900/40 flex items-center justify-center">
              <Target className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{exam.title}</h1>
              <p className="text-sm text-muted-foreground">{exam.subject} &middot; Grade {exam.grade}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <InfoRow label="Questions" value={`${exam.questions?.length || 0}`} />
            <InfoRow label="Time per Question" value="30 seconds" />
            <InfoRow label="Total Marks" value={`${exam.total_marks}`} />
            <InfoRow label="Passing Marks" value={`${exam.passing_marks}`} />
          </div>

          <div className="rounded-lg bg-amber-900/20 border border-amber-800/50 p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> How It Works
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>&bull; Each question has <strong className="text-amber-300">30 seconds</strong> to answer</li>
              <li>&bull; Select an option to lock your answer and move to the next question</li>
              <li>&bull; If time runs out, the question is marked as <strong className="text-amber-300">unanswered (0 marks)</strong></li>
              <li>&bull; You <strong className="text-amber-300">cannot go back</strong> to previous questions</li>
              <li>&bull; No negative marking — unanswered questions simply get 0 marks</li>
              <li>&bull; Results are shown immediately after the last question</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push('/student/exams')}
              className="flex-1 rounded-lg border border-border bg-muted py-2.5 text-sm text-foreground/80 hover:bg-accent transition">
              <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
            </button>
            <button onClick={startExam}
              className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
              Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -- Submitting --
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Grading your exam...</p>
        </div>
      </div>
    );
  }

  // -- Result Screen --
  if (phase === 'result' && result && exam) {
    const passed = result.percentage >= ((exam.passing_marks / exam.total_marks) * 100);
    const totalQ = exam.questions?.length || 0;
    const answered = answers.filter(a => a.selected_option !== null).length;
    const skipped = totalQ - answered;
    const avgTime = answers.length > 0
      ? (answers.reduce((s, a) => s + a.time_taken, 0) / answers.length).toFixed(1)
      : '0';

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-border p-8 max-w-md w-full">
          {/* Pass / Fail hero */}
          <div className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-4 ${passed ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
            {passed ? <Trophy className="h-10 w-10 text-green-400" /> : <AlertTriangle className="h-10 w-10 text-red-400" />}
          </div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-1">
            {passed ? 'Congratulations!' : 'Keep Trying!'}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {passed ? 'You passed the exam!' : 'You did not meet the passing criteria'}
          </p>

          {/* Score grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <ResultCard label="Score" value={`${result.score}/${result.total_marks}`} />
            <ResultCard label="Percentage" value={`${result.percentage}%`} />
            <ResultCard label="Grade" value={result.grade_letter} accent />
            <ResultCard label="Status" value={passed ? 'PASS' : 'FAIL'} cn={passed ? 'text-green-400' : 'text-red-400'} />
          </div>

          {/* Quick stats */}
          <div className="flex justify-between rounded-lg bg-muted p-3 mb-6 text-xs">
            <span className="text-muted-foreground">Answered: <strong className="text-foreground">{answered}</strong></span>
            <span className="text-muted-foreground">Skipped: <strong className="text-foreground">{skipped}</strong></span>
            <span className="text-muted-foreground">Avg time: <strong className="text-foreground">{avgTime}s</strong></span>
          </div>

          {/* Answer review */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Answer Review</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {exam.questions?.map((q, idx) => {
                const ans = answers.find(a => a.question_id === q.id);
                const wasAnswered = ans && ans.selected_option !== null;
                return (
                  <div key={q.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                      wasAnswered ? 'bg-violet-900/40 text-violet-400' : 'bg-muted text-muted-foreground'
                    }`}>{idx + 1}</span>
                    <p className="flex-1 text-xs text-foreground/80 truncate">{q.question_text}</p>
                    <div className="shrink-0">
                      {wasAnswered ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-400">
                          <CheckCircle2 className="h-3 w-3" /> {ans!.time_taken}s
                        </span>
                      ) : (
                        <span className="text-[10px] text-red-400/80">skipped</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={() => router.push('/student/exams')}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  // ==============================================================
  // EXAM SCREEN -- one question at a time + 30 s circular timer
  // ==============================================================

  const questions = exam?.questions ?? [];
  const q = questions[currentQ];
  const progress = ((currentQ) / questions.length) * 100;
  const circum = 2 * Math.PI * 24;
  const timerPct = timeLeft / QUESTION_TIME;
  const isTransition = phase === 'transition';

  // Color-coded option backgrounds
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Top bar */}
      <div className="border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-foreground">{exam?.title}</h1>
            <p className="text-xs text-muted-foreground">
              Question {currentQ + 1} of {questions.length} &middot; {q?.marks} mark{(q?.marks || 0) > 1 ? 's' : ''}
            </p>
          </div>
          {/* Circular timer */}
          <div className="relative h-14 w-14">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
              <circle cx="28" cy="28" r="24" fill="none" strokeWidth="3"
                strokeDasharray={`${circum}`}
                strokeDashoffset={`${circum * (1 - timerPct)}`}
                strokeLinecap="round"
                className={`transition-all duration-1000 ease-linear ${
                  timeLeft <= 10 ? 'text-red-500' : timeLeft <= 20 ? 'text-amber-500' : 'text-violet-500'
                }`} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
              timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-foreground'
            }`}>{timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Question + Options */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {q && (
            <>
              <p className="text-lg font-medium text-foreground mb-8 leading-relaxed">{q.question_text}</p>

              {q.question_type === 'mcq' && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {q.options.map((opt: string, idx: number) => {
                    const isSel = selectedOption === idx;
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <button key={idx}
                        onClick={() => selectAnswer(idx)}
                        disabled={isTransition || answeredRef.current}
                        className={`group relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200
                          ${isSel ? optBgSel[idx % 4] : optBg[idx % 4]}
                          ${(isTransition || answeredRef.current) && !isSel ? 'opacity-40' : ''}
                          disabled:cursor-default`}
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shrink-0 transition-colors ${
                          isSel ? 'bg-white/20 text-white' : 'bg-white/10 text-foreground/70 group-hover:bg-white/20'
                        }`}>{letter}</span>
                        <span className="text-sm text-foreground flex-1">{opt}</span>
                        {isSel && <CheckCircle2 className="h-5 w-5 text-white ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-10">
            {questions.map((qItem, idx) => {
              const ans = answers.find(a => a.question_id === qItem.id);
              const isCurrent = idx === currentQ;
              const wasAnswered = ans && ans.selected_option !== null;
              const wasSkipped = ans && ans.selected_option === null;
              return (
                <div key={idx} className={`h-2 rounded-full transition-all duration-300 ${
                  isCurrent ? 'w-6 bg-violet-500'
                  : wasAnswered ? 'w-2 bg-violet-400/60'
                  : wasSkipped ? 'w-2 bg-red-400/60'
                  : 'w-2 bg-muted-foreground/20'
                }`} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Helper components --

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ResultCard({ label, value, accent, cn }: { label: string; value: string; accent?: boolean; cn?: string }) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${cn || (accent ? 'text-violet-400' : 'text-foreground')}`}>{value}</p>
    </div>
  );
}