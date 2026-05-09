'use client';

import { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Trophy, XCircle,
} from 'lucide-react';

const sampleAnswers = [
  { question_text: 'What is the SI unit of force?', options: ['Joule', 'Newton', 'Watt', 'Pascal'], correct_answer: 1, selected_option: 1, is_correct: true, marks: 1, marks_awarded: 1, topic: 'Forces & Motion' },
  { question_text: 'Which of the following is a scalar quantity?', options: ['Velocity', 'Force', 'Speed', 'Displacement'], correct_answer: 2, selected_option: 0, is_correct: false, marks: 1, marks_awarded: 0, topic: 'Forces & Motion' },
  { question_text: 'Newton\'s third law states that for every action there is an equal and opposite ___?', options: ['Force', 'Reaction', 'Acceleration', 'Momentum'], correct_answer: 1, selected_option: 1, is_correct: true, marks: 1, marks_awarded: 1, topic: 'Newton\'s Laws' },
  { question_text: 'What is the acceleration due to gravity on Earth\'s surface?', options: ['8.9 m/s²', '9.8 m/s²', '10.2 m/s²', '11.0 m/s²'], correct_answer: 1, selected_option: null, is_correct: false, marks: 1, marks_awarded: 0, topic: 'Gravitation' },
  { question_text: 'Which law explains why we feel pushed back in an accelerating car?', options: ['Newton\'s First Law', 'Newton\'s Second Law', 'Newton\'s Third Law', 'Law of Conservation'], correct_answer: 0, selected_option: 0, is_correct: true, marks: 1, marks_awarded: 1, topic: 'Newton\'s Laws' },
  { question_text: 'The rate of change of velocity is called?', options: ['Speed', 'Displacement', 'Acceleration', 'Momentum'], correct_answer: 2, selected_option: 2, is_correct: true, marks: 1, marks_awarded: 1, topic: 'Kinematics' },
  { question_text: 'Which of these is NOT a fundamental force of nature?', options: ['Gravitational', 'Electromagnetic', 'Friction', 'Nuclear'], correct_answer: 2, selected_option: 3, is_correct: false, marks: 1, marks_awarded: 0, topic: 'Forces & Motion' },
  { question_text: 'What is the formula for momentum?', options: ['m × a', 'm × v', 'F × t', 'F × d'], correct_answer: 1, selected_option: 1, is_correct: true, marks: 1, marks_awarded: 1, topic: 'Momentum' },
  { question_text: 'A body at rest will remain at rest unless acted upon by an external force. This is:', options: ['Newton\'s First Law', 'Newton\'s Second Law', 'Newton\'s Third Law', 'Hooke\'s Law'], correct_answer: 0, selected_option: null, is_correct: false, marks: 1, marks_awarded: 0, topic: 'Newton\'s Laws' },
  { question_text: 'What happens to friction when surface area increases (for same normal force)?', options: ['Increases', 'Decreases', 'Remains same', 'Doubles'], correct_answer: 2, selected_option: 0, is_correct: false, marks: 1, marks_awarded: 0, topic: 'Friction' },
];

const mockResult = {
  score: 5,
  total_marks: 10,
  percentage: 50,
  grade_letter: 'C',
  answered: 8,
  skipped: 2,
  total_questions: 10,
  answers: sampleAnswers,
};

const mockExam = {
  subject: 'Physics',
  topic_title: 'FORCES AND MOTION PART 2',
};

const mockAnswerTimes = [12, 45, 8, 60, 22, 15, 38, 10, 60, 30];

export default function ExamResultTestPage() {
  const [scenario, setScenario] = useState<'pass' | 'fail' | 'excellent'>('pass');

  const scenarios = {
    pass: { ...mockResult, score: 5, percentage: 50, grade_letter: 'C' },
    fail: { ...mockResult, score: 2, percentage: 20, grade_letter: 'F' },
    excellent: { ...mockResult, score: 9, percentage: 90, grade_letter: 'A' },
  };

  const result = scenarios[scenario];
  const passed = result.percentage >= 35;
  const correctCount = result.answers.filter(a => a.is_correct).length;
  const wrongCount = result.answers.filter(a => a.selected_option !== null && !a.is_correct).length;
  const totalTimeSecs = mockAnswerTimes.reduce((s, t) => s + t, 0);
  const totalTimeFmt = totalTimeSecs >= 60
    ? `${Math.floor(totalTimeSecs / 60)}m ${totalTimeSecs % 60}s`
    : `${totalTimeSecs}s`;

  const violations = [{ type: 'tab_switch', timestamp: Date.now() }];
  const tabSwitchCount = 1;
  const autoSubmitted = false;
  const exam = mockExam;
  const inline = true;

  return (
    <>
      {/* Scenario picker (outside the result screen) */}
      <div className="fixed top-2 left-2 z-[400] flex gap-1.5">
        {(['pass', 'fail', 'excellent'] as const).map(s => (
          <button key={s} onClick={() => setScenario(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${scenario === s ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* ═══ Exact result screen from SessionExamClient ═══ */}
      <div className="fixed inset-0 z-[310] flex flex-col bg-[#1a1a2e]">
        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
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
            {autoSubmitted && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-center mb-3">
                <p className="text-[11px] text-red-300 font-medium">
                  🚫 Auto-submitted after {tabSwitchCount} tab switch violations. Reported to teacher.
                </p>
              </div>
            )}
            {violations.length > 0 && !autoSubmitted && (
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
              onClick={() => alert('Close clicked — would return to session')}
              className="w-full rounded-xl bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 py-3 text-sm font-bold text-white transition-all active:scale-[0.98]"
            >
              Close &amp; Return to Session
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
