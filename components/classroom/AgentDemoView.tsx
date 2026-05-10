'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  useRemoteParticipants,
  useLocalParticipant,
  useDataChannel,
} from '@livekit/components-react';
import VideoTile from './VideoTile';
import HeaderBar from './HeaderBar';
import ControlBar from './ControlBar';
import ChatPanel from './ChatPanel';

/* ═══════════════════════════════════════════════════════════════
   AgentDemoView — CRM Sales Agent view for demo sessions.
   Split layout: teacher (left/top) + student (right/bottom).
   Agent can see/hear both, publish own camera+mic, chat.
   ═══════════════════════════════════════════════════════════════ */

export interface AgentDemoViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
  scheduledStart?: string;
  durationMinutes?: number;
  onLeave: () => void;
}

export default function AgentDemoView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes = 30,
  onLeave,
}: AgentDemoViewProps) {
  const [showChat, setShowChat] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [fullviewRequest, setFullviewRequest] = useState<{ student_id: string; student_name: string } | null>(null);
  const processedFullviewIds = useRef(new Set<string>());
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Hide/show from class — toggles camera+mic so teacher & student views hide the agent
  const toggleHidden = async () => {
    const lp = localParticipant.localParticipant;
    if (!lp) return;
    if (hidden) {
      // Unhide — turn camera and mic back on
      await lp.setCameraEnabled(true);
      await lp.setMicrophoneEnabled(true);
      setHidden(false);
    } else {
      // Hide — turn camera and mic off
      await lp.setCameraEnabled(false);
      await lp.setMicrophoneEnabled(false);
      setHidden(true);
    }
  };

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Identify teacher + student from remote participants
  const teacher = useMemo(
    () => remoteParticipants.find((p) => p.identity.startsWith('teacher')),
    [remoteParticipants],
  );
  const student = useMemo(
    () => remoteParticipants.find((p) => p.identity.startsWith('student')),
    [remoteParticipants],
  );

  // Format elapsed
  const fmtElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  };

  // ── Fullview request from student ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFullviewRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string };
      if (processedFullviewIds.current.has(data.student_id)) return;
      processedFullviewIds.current.add(data.student_id);
      setFullviewRequest(data);
      // Auto-dismiss after 15 seconds
      setTimeout(() => {
        setFullviewRequest((prev) => {
          if (prev?.student_id === data.student_id) {
            processedFullviewIds.current.delete(data.student_id);
            return null;
          }
          return prev;
        });
      }, 15_000);
    } catch {}
  }, []);

  useDataChannel('agent_fullview_request', onFullviewRequest);

  const respondFullview = useCallback(async (action: 'accept' | 'decline') => {
    if (!fullviewRequest) return;
    const lp = localParticipant.localParticipant;
    if (!lp) return;
    try {
      await lp.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: fullviewRequest.student_id,
          action,
        })),
        { topic: 'agent_fullview_control', reliable: true },
      );
    } catch {}
    processedFullviewIds.current.delete(fullviewRequest.student_id);
    setFullviewRequest(null);
  }, [fullviewRequest, localParticipant]);

  return (
    <div className="flex h-screen flex-col bg-[#111214] text-white">
      {/* Header */}
      <HeaderBar
        roomName={roomName}
        role="ghost"
        scheduledStart={scheduledStart}
        durationMinutes={durationMinutes}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex flex-1 flex-col gap-2 p-2">
          {/* Participant grid — faces only */}
          <div className={`grid gap-2 flex-1 ${
            teacher && student ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
            {/* Teacher tile */}
            {teacher ? (
              <div className="relative h-full min-h-0">
                <VideoTile participant={teacher} showName playAudio />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900">
                <div className="text-center">
                  <div className="mb-1 text-2xl">👨‍🏫</div>
                  <p className="text-sm text-zinc-400">Waiting for teacher…</p>
                </div>
              </div>
            )}

            {/* Student tile */}
            {student ? (
              <div className="relative h-full min-h-0">
                <VideoTile participant={student} showName playAudio />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900">
                <div className="text-center">
                  <div className="mb-1 text-2xl">🎓</div>
                  <p className="text-sm text-zinc-400">Waiting for student…</p>
                </div>
              </div>
            )}
          </div>

          {/* Self-view pip (bottom-right) */}
          {localParticipant.localParticipant && !hidden && (
            <div className="absolute bottom-16 right-3 z-20 h-28 w-40 rounded-lg overflow-hidden shadow-lg border border-zinc-600">
              <VideoTile
                participant={localParticipant.localParticipant}
                mirror
                showName={false}
                showMicIndicator
                size="small"
              />
              <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                You ({participantName})
              </div>
            </div>
          )}

          {hidden && (
            <div className="absolute bottom-16 right-3 z-20 rounded-lg bg-amber-600/90 backdrop-blur-sm px-4 py-2.5 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🙈</span>
                <div>
                  <p className="text-xs font-semibold text-white">Hidden from class</p>
                  <p className="text-[10px] text-amber-100/80">Teacher & student can&apos;t see you</p>
                </div>
              </div>
            </div>
          )}

          {/* Fullview request dialog */}
          {fullviewRequest && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="rounded-xl bg-zinc-800/95 backdrop-blur-md border border-purple-500/30 shadow-2xl px-5 py-4 w-80">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                    <svg className="h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                      <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{fullviewRequest.student_name}</p>
                    <p className="text-xs text-zinc-400">wants to see your full camera view</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondFullview('accept')}
                    className="flex-1 rounded-lg bg-purple-600 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondFullview('decline')}
                    className="flex-1 rounded-lg bg-zinc-700 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-600 transition"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900">
            <ChatPanel
              roomId={roomId}
              participantName={participantName}
              participantRole="demo_agent"
              onClose={() => setShowChat(false)}
            />
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="flex h-14 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">⏱ {fmtElapsed(elapsed)}</span>
          <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            Sales Agent
          </span>
        </div>

        <ControlBar
          roomId={roomId}
          role="student"
          onEndClass={onLeave}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleHidden}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              hidden ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {hidden ? '👁 Show to Class' : '🙈 Hide from Class'}
          </button>
          <button
            onClick={() => setShowChat((s) => !s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              showChat ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={onLeave}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
