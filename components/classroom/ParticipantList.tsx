'use client';

import React, { useState, useCallback } from 'react';
import {
  useParticipants,
  useDataChannel,
} from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * ParticipantList — Shows all room participants with role badges.
 * Teacher can locally mute/unmute each student's audio playback.
 * Ghost participants (hidden: true) are NOT shown.
 */

export interface ParticipantListProps {
  role: 'teacher' | 'student' | 'ghost';
  /** LiveKit room name (used for kick API). For batch sessions == roomId; for OC rooms use roomName prop from TeacherView. */
  roomId: string;
  onClose?: () => void;
  className?: string;
  /** Set of student identities that are locally muted (teacher only) */
  mutedStudents?: Set<string>;
  /** Toggle local mute for a student (teacher only) */
  onToggleMute?: (identity: string) => void;
  /** Map of raised hand identities from TeacherView (optional — falls back to internal listener) */
  raisedHands?: Map<string, { name: string; time: number }>;
}

interface HandRaiseState {
  [identity: string]: boolean;
}

export default function ParticipantList({
  role,
  roomId,
  onClose,
  className,
  mutedStudents,
  onToggleMute,
  raisedHands: raisedHandsProp,
}: ParticipantListProps) {
  const participants = useParticipants();
  const [handRaisesInternal, setHandRaisesInternal] = useState<HandRaiseState>({});
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [kickError, setKickError] = useState<string | null>(null);

  // Listen for hand raise data channel (internal fallback when prop not provided)
  const onHandRaiseReceived = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.student_id && data.action) {
        setHandRaisesInternal((prev) => ({
          ...prev,
          [data.student_id]: data.action === 'raise',
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  useDataChannel('hand_raise', onHandRaiseReceived);

  // Use prop if provided (from TeacherView's authoritative state), else internal
  const isHandRaised = (identity: string) =>
    raisedHandsProp ? raisedHandsProp.has(identity) : !!handRaisesInternal[identity];

  // Determine role from metadata or identity
  const getParticipantRole = (p: Participant): string => {
    try {
      const meta = JSON.parse(p.metadata || '{}');
      return meta.effective_role || meta.portal_role || 'student';
    } catch {
      if (p.identity.startsWith('teacher')) return 'teacher';
      if (p.identity.startsWith('ghost')) return 'observer';
      return 'student';
    }
  };

  // Filter out ghost/hidden participants and teacher screen devices (tablet)
  const visibleParticipants = participants.filter((p) => {
    const pRole = getParticipantRole(p);
    if (pRole.startsWith('ghost') || pRole === 'observer') return false;
    // Hide teacher tablet (screen device)
    if (pRole === 'teacher_screen') return false;
    try {
      const meta = JSON.parse(p.metadata || '{}');
      if (meta.device === 'screen') return false;
    } catch {}
    if (p.identity.endsWith('_screen')) return false;
    return true;
  });

  // Sort: teacher first, then raised-hand students, then rest alphabetically
  const sorted = [...visibleParticipants].sort((a, b) => {
    const aRole = getParticipantRole(a);
    const bRole = getParticipantRole(b);
    if (aRole === 'teacher' && bRole !== 'teacher') return -1;
    if (bRole === 'teacher' && aRole !== 'teacher') return 1;
    const aRaised = isHandRaised(a.identity) ? 0 : 1;
    const bRaised = isHandRaised(b.identity) ? 0 : 1;
    if (aRaised !== bRaised) return aRaised - bRaised;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

  const handleKick = async (identity: string) => {
    setKickError(null);
    try {
      const res = await fetch(`/api/v1/room/participants/${encodeURIComponent(identity)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setKickError(data.error || `Failed (${res.status})`);
        return;
      }
      setConfirmKick(null);
    } catch (err) {
      console.error('Failed to kick participant:', err);
      setKickError('Network error — please try again');
    }
  };

  return (
    <div className={cn('flex h-full flex-col bg-[#202124]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-2">
        <span className="text-sm font-medium text-[#e8eaed]">
          Participants ({sorted.length})
        </span>
        {onClose && (
          <button onClick={onClose} className="text-[#9aa0a6] hover:text-[#e8eaed] text-sm">
            ×
          </button>
        )}
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {sorted.map((p, idx) => {
          const pRole = getParticipantRole(p);
          const displayName = p.name || p.identity;
          const isRaised = isHandRaised(p.identity);
          const isStudent = pRole === 'student';
          const isMuted = (isStudent || pRole === 'teacher') && mutedStudents?.has(p.identity);

          // Insert a "Raised Hands" divider before the first raised-hand student
          const prevP = idx > 0 ? sorted[idx - 1] : null;
          const prevRole = prevP ? getParticipantRole(prevP) : null;
          const showRaisedHeader =
            isRaised && (!prevP || prevRole === 'teacher' || !isHandRaised(prevP.identity));
          // Insert an "Others" divider when transitioning from raised to non-raised students
          const showOthersHeader =
            !isRaised && prevP && prevRole !== 'teacher' && isHandRaised(prevP.identity);

          return (
            <React.Fragment key={p.identity}>
              {showRaisedHeader && (
                <div className="flex items-center gap-1.5 px-1 pt-1 pb-0.5">
                  <svg className="h-3 w-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Raised Hands</span>
                </div>
              )}
              {showOthersHeader && (
                <div className="flex items-center gap-1.5 px-1 pt-2 pb-0.5">
                  <div className="flex-1 h-px bg-[#3c4043]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9aa0a6] px-1">Others</span>
                  <div className="flex-1 h-px bg-[#3c4043]" />
                </div>
              )}
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                isRaised
                  ? 'bg-amber-500/10 ring-1 ring-amber-500/40 hover:bg-amber-500/15'
                  : 'hover:bg-[#3c4043]/40',
              )}
            >
              {/* Name + role badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm text-[#e8eaed]">{displayName}</span>
                  <RoleBadge role={pRole} />
                  {isRaised && (
                    <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                {/* Local mute/unmute button (available when onToggleMute provided) */}
                {(isStudent || pRole === 'teacher') && onToggleMute && (
                  <button
                    onClick={() => onToggleMute(p.identity)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors',
                      isMuted && isRaised
                        ? 'bg-amber-500 text-white hover:bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                        : isMuted
                          ? 'bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/25'
                          : 'bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/25',
                    )}
                    title={isMuted && isRaised ? 'Student raised hand — unmute to let them speak' : undefined}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                )}

                {/* Teacher-only kick control */}
                {role === 'teacher' && pRole !== 'teacher' && (
                  <button
                    onClick={() => setConfirmKick(p.identity)}
                    className="rounded bg-[#3c4043]/50 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-[#3c4043]"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Kick confirmation */}
              {confirmKick === p.identity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                  <div className="rounded-xl bg-[#292a2d] p-5 text-center shadow-xl ring-1 ring-white/10 min-w-[260px]">
                    <p className="mb-4 text-sm text-[#e8eaed]">
                      Remove <strong>{displayName}</strong> from the session?
                    </p>
                    {kickError && (
                      <p className="mb-3 text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{kickError}</p>
                    )}
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => { setConfirmKick(null); setKickError(null); }}
                        className="rounded-lg bg-[#3c4043] px-3 py-1.5 text-sm text-[#e8eaed] hover:bg-[#5f6368] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleKick(p.identity)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    teacher: 'bg-emerald-600',
    student: 'bg-blue-600',
    observer: 'bg-purple-600',
    batch_coordinator: 'bg-indigo-600',
    academic_operator: 'bg-teal-600',
    academic: 'bg-teal-600',
    parent: 'bg-orange-600',
    owner: 'bg-purple-600',
  };
  return (
    <span
      className={cn(
        'rounded px-1 py-0.5 text-[9px] font-bold uppercase text-white',
        colors[role] || 'bg-muted'
      )}
    >
      {role}
    </span>
  );
}
