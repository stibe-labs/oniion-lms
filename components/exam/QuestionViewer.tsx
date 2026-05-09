// =================================================================
// QuestionViewer — Fullscreen advanced question viewer
// Shows cropped QP image + question + options + solution steps
// =================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Lightbulb, Loader2,
  BarChart3, Image, ZoomIn, ZoomOut,
} from 'lucide-react';

export interface ViewQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  marks: number;
  difficulty: string;
  sort_order: number;
  image_url?: string | null;
  solution_steps?: string | null;
}

interface Props {
  questions: ViewQuestion[];
  onClose: () => void;
  topicTitle?: string;
}

export default function QuestionViewer({ questions, onClose, topicTitle }: Props) {
  const [current, setCurrent] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [steps, setSteps] = useState<Record<string, string>>({});
  const [loadingSteps, setLoadingSteps] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const viewerRef = useRef<HTMLDivElement>(null);

  const q = questions[current];
  const total = questions.length;
  const easyCount = questions.filter(q => q.difficulty === 'easy').length;
  const medCount = questions.filter(q => q.difficulty === 'medium').length;
  const hardCount = questions.filter(q => q.difficulty === 'hard').length;
  const withImage = questions.filter(q => q.image_url).length;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrent(c => Math.min(c + 1, total - 1));
        setShowSteps(false);
        setImgZoom(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrent(c => Math.max(c - 1, 0));
        setShowSteps(false);
        setImgZoom(1);
      } else if (e.key === 'Escape') {
        if (showGrid) setShowGrid(false);
        else onClose();
      } else if (e.key === 'g') {
        setShowGrid(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [total, onClose, showGrid]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    setShowSteps(false);
    setShowGrid(false);
    setImgZoom(1);
  };

  // Fetch solution steps
  const fetchSteps = useCallback(async (questionId: string) => {
    if (steps[questionId]) {
      setShowSteps(true);
      return;
    }
    setLoadingSteps(questionId);
    setShowSteps(true);
    try {
      const res = await fetch('/api/v1/session-exam-topics/questions/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId }),
      });
      const data = await res.json();
      if (data.success && data.data?.steps) {
        setSteps(prev => ({ ...prev, [questionId]: data.data.steps }));
      }
    } catch { /* ignore */ }
    finally { setLoadingSteps(null); }
  }, [steps]);

  if (!q) return null;

  const diffColor = q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : q.difficulty === 'hard' ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <div ref={viewerRef} className="fixed inset-0 z-[200] bg-gray-950 flex flex-col animate-in fade-in duration-200">
      {/* ── Top Bar ────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-white">{topicTitle || 'Question Viewer'}</h2>
            <p className="text-[11px] text-gray-500">
              Question {current + 1} of {total}
              {withImage > 0 && <> · <Image className="h-3 w-3 inline -mt-0.5" /> {withImage} with images</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats chips */}
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">
              Easy {easyCount}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/50">
              Medium {medCount}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
              Hard {hardCount}
            </span>
          </div>

          {/* Grid toggle */}
          <button onClick={() => setShowGrid(v => !v)}
            className={`p-1.5 rounded-lg transition ${showGrid ? 'bg-violet-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
            title="Question grid (G)">
            <BarChart3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Question Grid Overlay ──────────────────── */}
      {showGrid && (
        <div className="absolute inset-0 z-10 bg-gray-950/95 flex items-center justify-center p-4" onClick={() => setShowGrid(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">All Questions ({total})</h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {questions.map((qt, idx) => (
                <button key={qt.id} onClick={() => goTo(idx)}
                  className={`relative h-10 w-full rounded-lg text-xs font-bold transition-all flex items-center justify-center
                    ${idx === current
                      ? 'bg-violet-600 text-white ring-2 ring-violet-400'
                      : qt.difficulty === 'easy' ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-800/40'
                      : qt.difficulty === 'hard' ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40'
                      : 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 border border-amber-800/40'
                    }`}>
                  {idx + 1}
                  {qt.image_url && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-400" />}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-3">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 mr-1" /> = has image ·
              Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400 text-[9px]">G</kbd> to toggle
            </p>
          </div>
        </div>
      )}

      {/* ── Main Content ──────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Image Panel */}
        {q.image_url ? (
          <div className="w-1/2 border-r border-gray-800 flex flex-col bg-gray-900/50">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50">
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Question Paper</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setImgZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition">
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] text-gray-500 w-10 text-center">{Math.round(imgZoom * 100)}%</span>
                <button onClick={() => setImgZoom(z => Math.min(3, z + 0.25))}
                  className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition">
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
              <img
                src={q.image_url}
                alt={`Question ${current + 1}`}
                className="rounded-lg shadow-2xl border border-gray-700 transition-transform duration-200"
                style={{ transform: `scale(${imgZoom})`, transformOrigin: 'top center' }}
              />
            </div>
          </div>
        ) : null}

        {/* Right: Question Panel */}
        <div className={`${q.image_url ? 'w-1/2' : 'w-full max-w-3xl mx-auto'} flex flex-col overflow-hidden`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-violet-600 text-white text-sm font-bold shrink-0">
                {current + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${diffColor}`}>
                    {q.difficulty}
                  </span>
                  <span className="text-[10px] text-gray-500">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                </div>
                <p className="text-base text-white leading-relaxed font-medium">
                  {q.question_text}
                </p>
              </div>
            </div>

            {/* If no image panel, show image inline */}
            {!q.image_url ? null : null}

            {/* Options */}
            <div className="space-y-2 pl-11">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.correct_answer;
                const letter = String.fromCharCode(65 + oi);
                return (
                  <div key={oi} className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
                    isCorrect
                      ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                      : 'bg-gray-900/60 border-gray-800 text-gray-300'
                  }`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold shrink-0 ${
                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
                    }`}>{letter}</span>
                    <span className="text-sm flex-1">{opt}</span>
                    {isCorrect && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Solution Steps */}
            <div className="pl-11">
              <button
                onClick={() => {
                  if (showSteps && steps[q.id]) {
                    setShowSteps(false);
                  } else {
                    fetchSteps(q.id);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  showSteps
                    ? 'bg-amber-900/30 text-amber-300 border border-amber-700/40'
                    : 'bg-gray-800/60 text-gray-300 border border-gray-700/50 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {loadingSteps === q.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
                {showSteps && steps[q.id] ? 'Hide Solution Steps' : 'Show Solution Steps'}
              </button>

              {showSteps && (
                <div className="mt-3 rounded-xl bg-gray-900/80 border border-gray-800 p-5 space-y-3">
                  {loadingSteps === q.id ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400 text-sm py-4 justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/buji/4 second thinking.gif" alt="Thinking" width={64} style={{ objectFit: 'contain' }} />
                      Generating solution steps...
                    </div>
                  ) : steps[q.id] ? (
                    <>
                      <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> Step-by-Step Solution
                      </h4>
                      <div className="space-y-2.5">
                        {steps[q.id].split('\n').filter(Boolean).map((line, li) => (
                          <div key={li} className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-900/50 text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">
                              {li + 1}
                            </span>
                            <p className="text-sm text-gray-300 leading-relaxed">{line.replace(/^\d+[\.\)]\s*/, '')}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">Failed to load steps</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 flex items-center justify-between shrink-0">
            <button
              onClick={() => { setCurrent(c => Math.max(c - 1, 0)); setShowSteps(false); setImgZoom(1); }}
              disabled={current === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            {/* Dot indicator (compact) */}
            <div className="flex items-center gap-1 max-w-[40%] overflow-hidden">
              {questions.length <= 30 ? questions.map((_, idx) => (
                <button key={idx} onClick={() => goTo(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === current ? 'w-5 bg-violet-500' : 'w-2 bg-gray-700 hover:bg-gray-600'
                  }`} />
              )) : (
                <span className="text-xs text-gray-500">{current + 1} / {total}</span>
              )}
            </div>

            <button
              onClick={() => { setCurrent(c => Math.min(c + 1, total - 1)); setShowSteps(false); setImgZoom(1); }}
              disabled={current === total - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed bg-violet-600 text-white hover:bg-violet-500"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
