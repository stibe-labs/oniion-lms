'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useLocalParticipant,
  useDataChannel,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────── */
/*  DoubtPanel — Students raise doubts, teachers answer them.   */
/*  Uses data channel topic 'doubt' for real-time sync.         */
/* ──────────────────────────────────────────────────────────── */

interface Doubt {
  id: string;
  student_email: string;
  student_name: string;
  subject: string;
  doubt_text: string;
  status: 'open' | 'answered' | 'deferred' | 'closed';
  teacher_reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
}

interface DoubtPanelProps {
  roomId: string;
  role: 'student' | 'teacher';
  participantEmail: string;
  participantName: string;
  className?: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Open' },
  answered: { bg: 'bg-primary/15', text: 'text-primary', label: 'Answered' },
  deferred: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Deferred' },
  closed: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: 'Closed' },
};

export default function DoubtPanel({
  roomId,
  role,
  participantEmail,
  participantName,
  className,
}: DoubtPanelProps) {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [input, setInput] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedIds = useRef(new Set<string>());

  const { localParticipant } = useLocalParticipant();

  // ── Fetch doubts from API ──────────────────────────────
  const fetchDoubts = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/room/${roomId}/doubts`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data?.doubts) {
        setDoubts(json.data.doubts);
        json.data.doubts.forEach((d: Doubt) => processedIds.current.add(d.id));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchDoubts();
    const iv = setInterval(fetchDoubts, 15_000);
    return () => clearInterval(iv);
  }, [fetchDoubts]);

  // ── Data channel for real-time doubt notifications ─────
  const onDoubtMessage = useCallback((msg: { payload: Uint8Array } | undefined) => {
    if (!msg?.payload) return;
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === 'new_doubt' || data.type === 'doubt_reply') {
        const doubt = data.doubt as Doubt;
        if (processedIds.current.has(doubt.id) && data.type === 'new_doubt') return;
        processedIds.current.add(doubt.id);
        setDoubts(prev => {
          const idx = prev.findIndex(d => d.id === doubt.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = doubt;
            return copy;
          }
          return [...prev, doubt];
        });
      }
    } catch { /* ignore malformed */ }
  }, []);

  const { send: sendDoubtChannel } = useDataChannel('doubt', onDoubtMessage);

  // ── Scroll to bottom on new doubts ─────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [doubts.length]);

  // ── Student: Raise a doubt ─────────────────────────────
  const handleRaiseDoubt = async () => {
    const text = input.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/room/${roomId}/doubts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'raise', doubt_text: text }),
      });
      const json = await res.json();
      if (json.success && json.data?.doubt) {
        const newDoubt = json.data.doubt as Doubt;
        processedIds.current.add(newDoubt.id);
        setDoubts(prev => [...prev, newDoubt]);
        setInput('');
        // Broadcast via data channel
        try {
          sendDoubtChannel(
            new TextEncoder().encode(JSON.stringify({ type: 'new_doubt', doubt: newDoubt })),
            { reliable: true },
          );
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  // ── Teacher: Reply to a doubt ──────────────────────────
  const handleReply = async (doubtId: string, status: string = 'answered') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/room/${roomId}/doubts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          doubt_id: doubtId,
          reply_text: replyText.trim(),
          status,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.doubt) {
        const updated = json.data.doubt as Doubt;
        processedIds.current.add(updated.id);
        setDoubts(prev => prev.map(d => d.id === updated.id ? updated : d));
        setReplyingId(null);
        setReplyText('');
        // Broadcast update
        try {
          sendDoubtChannel(
            new TextEncoder().encode(JSON.stringify({ type: 'doubt_reply', doubt: updated })),
            { reliable: true },
          );
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  const openDoubts = doubts.filter(d => d.status === 'open');
  const answeredDoubts = doubts.filter(d => d.status !== 'open');

  // ── Time format ────────────────────────────────────────
  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    } catch { return ''; }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Doubts list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-xs text-[#9aa0a6] mt-8">Loading doubts...</div>
        ) : doubts.length === 0 ? (
          <div className="text-center text-xs text-[#9aa0a6] mt-8">
            {role === 'student' ? 'No doubts yet. Ask your question below!' : 'No doubts raised yet.'}
          </div>
        ) : (
          <>
            {/* Open doubts first */}
            {openDoubts.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1.5 px-1">
                  Open ({openDoubts.length})
                </p>
                {openDoubts.map(d => (
                  <DoubtCard
                    key={d.id}
                    doubt={d}
                    role={role}
                    isReplying={replyingId === d.id}
                    replyText={replyText}
                    submitting={submitting}
                    onStartReply={() => { setReplyingId(d.id); setReplyText(''); }}
                    onCancelReply={() => setReplyingId(null)}
                    onReplyTextChange={setReplyText}
                    onSubmitReply={(status) => handleReply(d.id, status)}
                    fmtTime={fmtTime}
                  />
                ))}
              </div>
            )}

            {/* Answered/deferred/closed */}
            {answeredDoubts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9aa0a6] font-semibold mb-1.5 px-1">
                  Resolved ({answeredDoubts.length})
                </p>
                {answeredDoubts.map(d => (
                  <DoubtCard
                    key={d.id}
                    doubt={d}
                    role={role}
                    isReplying={false}
                    replyText=""
                    submitting={false}
                    onStartReply={() => {}}
                    onCancelReply={() => {}}
                    onReplyTextChange={() => {}}
                    onSubmitReply={() => {}}
                    fmtTime={fmtTime}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Student input — raise a doubt */}
      {role === 'student' && (
        <div className="border-t border-[#3c4043] p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRaiseDoubt()}
              placeholder="Type your doubt..."
              maxLength={2000}
              className="flex-1 bg-[#292a2d] rounded-lg px-3 py-2 text-sm text-[#e8eaed] placeholder:text-[#9aa0a6] outline-none ring-1 ring-[#3c4043] focus:ring-[#8ab4f8] transition-colors"
            />
            <button
              onClick={handleRaiseDoubt}
              disabled={!input.trim() || submitting}
              className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {submitting ? '...' : 'Ask'}
            </button>
          </div>
          <p className="text-[10px] text-[#9aa0a6] mt-1 px-1">
            {input.length}/2000
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  Individual doubt card                                       */
/* ──────────────────────────────────────────────────────────── */

function DoubtCard({
  doubt,
  role,
  isReplying,
  replyText,
  submitting,
  onStartReply,
  onCancelReply,
  onReplyTextChange,
  onSubmitReply,
  fmtTime,
}: {
  doubt: Doubt;
  role: 'student' | 'teacher';
  isReplying: boolean;
  replyText: string;
  submitting: boolean;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReplyTextChange: (v: string) => void;
  onSubmitReply: (status: string) => void;
  fmtTime: (iso: string) => string;
}) {
  const st = STATUS_STYLE[doubt.status] || STATUS_STYLE.open;

  return (
    <div className="rounded-lg bg-[#292a2d] ring-1 ring-[#3c4043]/50 overflow-hidden mb-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c4043]/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs">❓</span>
          <span className="text-[11px] font-medium text-[#e8eaed] truncate">
            {doubt.student_name}
          </span>
          <span className="text-[10px] text-[#9aa0a6]">{fmtTime(doubt.created_at)}</span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0', st.bg, st.text)}>
          {st.label}
        </span>
      </div>

      {/* Doubt text */}
      <div className="px-3 py-2">
        <p className="text-[13px] text-[#e8eaed] leading-relaxed break-words">{doubt.doubt_text}</p>
      </div>

      {/* Teacher reply (if exists) */}
      {doubt.teacher_reply && (
        <div className="mx-3 mb-2 rounded-lg bg-primary/10 ring-1 ring-primary/20 px-3 py-2">
          <p className="text-[10px] text-primary font-semibold mb-0.5">Teacher Reply</p>
          <p className="text-[12px] text-[#e8eaed] leading-relaxed break-words">{doubt.teacher_reply}</p>
          {doubt.replied_at && (
            <p className="text-[10px] text-[#9aa0a6] mt-1">{fmtTime(doubt.replied_at)}</p>
          )}
        </div>
      )}

      {/* Teacher actions */}
      {role === 'teacher' && doubt.status === 'open' && !isReplying && (
        <div className="flex gap-1.5 px-3 pb-2">
          <button
            onClick={onStartReply}
            className="rounded-md bg-primary/80 hover:bg-primary text-white px-3 py-1 text-[11px] font-medium transition-colors"
          >
            Reply
          </button>
          <button
            onClick={() => onSubmitReply('deferred')}
            className="rounded-md bg-blue-600/60 hover:bg-blue-500 text-white px-3 py-1 text-[11px] font-medium transition-colors"
          >
            Defer
          </button>
        </div>
      )}

      {/* Reply input */}
      {isReplying && (
        <div className="px-3 pb-2 space-y-2">
          <textarea
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            placeholder="Type your answer..."
            rows={2}
            maxLength={2000}
            className="w-full bg-[#202124] rounded-lg px-3 py-2 text-[12px] text-[#e8eaed] placeholder:text-[#9aa0a6] outline-none ring-1 ring-[#3c4043] focus:ring-primary/50 resize-none transition-colors"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => onSubmitReply('answered')}
              disabled={submitting}
              className="rounded-md bg-primary hover:bg-primary text-white px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
            >
              {submitting ? '...' : 'Send Answer'}
            </button>
            <button
              onClick={onCancelReply}
              className="rounded-md bg-[#3c4043] hover:bg-[#5f6368] text-[#e8eaed] px-3 py-1 text-[11px] font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
