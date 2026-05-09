'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track, RoomEvent, type RemoteParticipant, type LocalParticipant, type TrackPublication } from 'livekit-client';
import { VideoTrack, AudioTrack } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-core';

interface ConferenceHostViewProps {
  conferenceTitle: string;
  conferenceToken: string;
  onEndConference: () => void;
  onLeave: () => void;
}

/* ── Helpers ── */

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

interface ParsedMeta {
  conference_role: 'admin' | 'user';
  student_names?: string[];
}

function parseMeta(p: RemoteParticipant | LocalParticipant): ParsedMeta {
  try {
    const m = JSON.parse(p.metadata || '{}');
    return {
      conference_role: m.conference_role === 'admin' ? 'admin' : 'user',
      student_names: Array.isArray(m.student_names) ? m.student_names : undefined,
    };
  } catch {
    return { conference_role: p.identity.startsWith('admin_') ? 'admin' : 'user' };
  }
}

/** Compute optimal grid columns to fill the container with ~16:9 tiles. */
function computeGridCols(count: number, containerW: number, containerH: number): number {
  if (count <= 0) return 1;
  if (count === 1) return 1;
  if (count === 2) return 2;

  let bestCols = 1;
  let bestArea = 0;

  for (let cols = 1; cols <= Math.min(count, 6); cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = containerW / cols;
    const tileH = containerH / rows;
    const aspect = tileW / tileH;
    const targetAspect = 16 / 9;
    const ratio = aspect > targetAspect ? targetAspect / aspect : aspect / targetAspect;
    const area = tileW * tileH * ratio;
    if (area > bestArea) {
      bestArea = area;
      bestCols = cols;
    }
  }
  return bestCols;
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function ConferenceHostView({
  conferenceTitle,
  conferenceToken,
  onEndConference,
  onLeave,
}: ConferenceHostViewProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [spotlightIdentity, setSpotlightIdentity] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [peersVisible, setPeersVisible] = useState(false);

  // Grid container ref for measuring
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setGridSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Detect screen share tracks (any participant)
  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: true }
  );
  const hasScreenShare = screenShareTracks.length > 0;

  // Separate admins and users
  const { admins, users } = useMemo(() => {
    const admins: RemoteParticipant[] = [];
    const users: RemoteParticipant[] = [];
    for (const p of remoteParticipants) {
      if (parseMeta(p).conference_role === 'admin') admins.push(p);
      else users.push(p);
    }
    return { admins, users };
  }, [remoteParticipants]);

  const allParticipants = useMemo(
    () => [localParticipant, ...admins, ...users] as (LocalParticipant | RemoteParticipant)[],
    [localParticipant, admins, users]
  );
  const totalCount = allParticipants.length;

  // Grid columns (normal mode only)
  const gridCols = useMemo(
    () => hasScreenShare ? Math.min(totalCount, 3) : computeGridCols(totalCount, gridSize.w, gridSize.h),
    [totalCount, gridSize, hasScreenShare]
  );

  // Spotlight
  const spotlightParticipant = useMemo(() => {
    if (!spotlightIdentity) return null;
    if (localParticipant.identity === spotlightIdentity) return localParticipant;
    return remoteParticipants.find(p => p.identity === spotlightIdentity) || null;
  }, [spotlightIdentity, localParticipant, remoteParticipants]);

  useEffect(() => {
    if (!spotlightIdentity) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSpotlightIdentity(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spotlightIdentity]);

  /* ── Hand raise data channel ── */
  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'hand_raise' && msg.identity) {
          setRaisedHands(prev => {
            const next = new Set(prev);
            if (msg.raised) next.add(msg.identity);
            else next.delete(msg.identity);
            return next;
          });
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  const lowerAllHands = useCallback(() => {
    setRaisedHands(new Set());
    const msg = JSON.stringify({ type: 'lower_all_hands' });
    localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
  }, [localParticipant]);

  const togglePeersVisible = useCallback(() => {
    const next = !peersVisible;
    setPeersVisible(next);
    const msg = JSON.stringify({ type: 'peers_visible', enabled: next });
    localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
  }, [peersVisible, localParticipant]);

  const toggleMic = useCallback(async () => {
    try { await localParticipant.setMicrophoneEnabled(!isMicOn); setIsMicOn(!isMicOn); }
    catch (err) { console.error('[ConferenceHost] Mic:', err); }
  }, [localParticipant, isMicOn]);

  const toggleCam = useCallback(async () => {
    try { await localParticipant.setCameraEnabled(!isCamOn); setIsCamOn(!isCamOn); }
    catch (err) { console.error('[ConferenceHost] Cam:', err); }
  }, [localParticipant, isCamOn]);

  const toggleScreenShare = useCallback(async () => {
    try { await localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled); }
    catch (err) { console.error('[ConferenceHost] Screen:', err); }
  }, [localParticipant]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* ── Top Bar ── */}
      <div className="flex h-11 sm:h-12 items-center justify-between border-b border-zinc-800/60 px-3 sm:px-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-emerald-600/20 shrink-0">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.6 11.6L22 7v10l-6.4-4.5v-1Z" /><rect width="14" height="10" x="2" y="7" rx="2" ry="2" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">{conferenceTitle}</h1>
            <p className="text-[9px] sm:text-[10px] text-zinc-500">{totalCount} participant{totalCount !== 1 ? 's' : ''}</p>
          </div>
          {raisedHands.size > 0 && (
            <button onClick={lowerAllHands} className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-amber-500/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-amber-400 hover:bg-amber-500/30 transition-colors shrink-0" title="Lower all hands">
              <span>✋</span>
              <span className="hidden xs:inline">{raisedHands.size}</span>
              <svg className="w-3 h-3 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          )}
        </div>
        <span className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-emerald-600/15 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-400 shrink-0 ml-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">

        {/* Spotlight overlay */}
        {spotlightParticipant && !hasScreenShare && (
          <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950/95 backdrop-blur-sm p-1 sm:p-2">
            <div className="flex-1 min-h-0 relative overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-900 ring-2 ring-white/10">
              <ParticipantTile
                participant={spotlightParticipant}
                isLocal={spotlightParticipant.identity === localParticipant.identity}
                isAdmin={parseMeta(spotlightParticipant).conference_role === 'admin'}
                meta={parseMeta(spotlightParticipant)}
                size="large"
                label={spotlightParticipant.identity === localParticipant.identity ? 'You (Host)' : undefined}
              />
            </div>
            <button
              onClick={() => setSpotlightIdentity(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-zinc-300 hover:bg-zinc-700 transition-colors backdrop-blur-sm"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              <span className="hidden sm:inline">Exit fullscreen · Esc</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        )}

        {/* Screen share layout */}
        {hasScreenShare ? (
          <div className="flex flex-col sm:flex-row h-full gap-1 sm:gap-1.5 p-1 sm:p-1.5">
            {/* Main screen share */}
            <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden rounded-lg sm:rounded-xl bg-black">
              <ScreenShareTile trackRef={screenShareTracks[0] as TrackReference} />
            </div>
            {/* Participant strip — horizontal on mobile, vertical sidebar on desktop */}
            <div className="flex sm:flex-col gap-1 sm:gap-1.5 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto h-20 sm:h-auto sm:w-48 shrink-0">
              {allParticipants.map((p) => {
                const isLocal = p.identity === localParticipant.identity;
                const meta = parseMeta(p);
                return (
                  <div
                    key={p.identity}
                    className={`relative overflow-hidden rounded-lg bg-zinc-900 aspect-video shrink-0 w-28 sm:w-auto cursor-pointer hover:ring-2 hover:ring-white/20 transition-all ${
                      meta.conference_role === 'admin' ? 'ring-1 ring-emerald-500/30' : ''
                    } ${isLocal ? 'ring-2 ring-emerald-500/40' : ''}`}
                    onClick={() => setSpotlightIdentity(p.identity)}
                  >
                    <ParticipantTile participant={p} isLocal={isLocal} isAdmin={meta.conference_role === 'admin'} meta={meta} size="small" label={isLocal ? 'You' : undefined} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Normal grid — fills all space */
          <div ref={gridRef} className="h-full p-1 sm:p-1.5 overflow-y-auto">
            <div
              className="grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                minHeight: '100%',
                gridAutoRows: totalCount <= gridCols * Math.ceil(totalCount / gridCols) ? '1fr' : 'minmax(100px, 1fr)',
              }}
            >
              {allParticipants.map((p) => {
                const isLocal = p.identity === localParticipant.identity;
                const meta = parseMeta(p);
                return (
                  <div
                    key={p.identity}
                    className={`relative overflow-hidden rounded-lg sm:rounded-xl bg-zinc-900 min-h-[80px] sm:min-h-[120px] cursor-pointer hover:ring-2 hover:ring-white/20 transition-all ${
                      meta.conference_role === 'admin' ? 'ring-1 ring-emerald-500/30' : ''
                    } ${isLocal ? 'ring-2 ring-emerald-500/40' : ''}`}
                    onClick={() => setSpotlightIdentity(p.identity)}
                  >
                    <ParticipantTile participant={p} isLocal={isLocal} isAdmin={meta.conference_role === 'admin'} meta={meta} size="medium" label={isLocal ? 'You (Host)' : undefined} isHandRaised={raisedHands.has(p.identity)} />
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {remoteParticipants.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <svg className="w-14 h-14 mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <p className="text-sm">Waiting for participants to join...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Control Bar ── */}
      <div className="flex h-14 sm:h-16 items-center justify-center gap-1.5 sm:gap-2.5 border-t border-zinc-800/60 bg-zinc-900/50 px-2 sm:px-4 shrink-0">
        <ControlBtn on={isMicOn} danger={!isMicOn} onClick={toggleMic} tip={isMicOn ? 'Mute' : 'Unmute'}>
          {isMicOn ? <MicOnIcon /> : <MicOffIcon />}
        </ControlBtn>
        <ControlBtn on={isCamOn} danger={!isCamOn} onClick={toggleCam} tip={isCamOn ? 'Camera off' : 'Camera on'}>
          {isCamOn ? <CamOnIcon /> : <CamOffIcon />}
        </ControlBtn>
        <ControlBtn on={localParticipant.isScreenShareEnabled} accent onClick={toggleScreenShare} tip="Screen share" className="hidden sm:flex">
          <ScreenShareIcon />
        </ControlBtn>
        <ControlBtn on={peersVisible} accent onClick={togglePeersVisible} tip={peersVisible ? 'Hide peers from participants' : 'Show peers to participants'}>
          <PeersIcon />
        </ControlBtn>
        <div className="h-7 w-px bg-zinc-700/50 mx-0.5" />
        <button onClick={() => setShowEndConfirm(true)} title="End conference" className="flex h-10 sm:h-11 items-center gap-1.5 rounded-full bg-red-600 px-3 sm:px-4 text-[12px] sm:text-[13px] font-medium text-white hover:bg-red-500 active:scale-95 transition-all">
          <PhoneOffIcon /><span className="hidden sm:inline">End</span>
        </button>
        <ControlBtn onClick={onLeave} tip="Leave"><LeaveIcon /></ControlBtn>
      </div>

      {/* ── End Confirm ── */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm mx-4 border border-zinc-800">
            <h3 className="text-lg font-semibold text-white mb-2">End Conference?</h3>
            <p className="text-sm text-zinc-400 mb-6">This will disconnect all {totalCount} participant{totalCount !== 1 ? 's' : ''} and end the conference.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={() => { setShowEndConfirm(false); onEndConference(); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors">End for All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ParticipantTile — Video + avatar + name overlay
   ═══════════════════════════════════════════════════════════════ */

function ParticipantTile({
  participant, isLocal = false, label, isAdmin = false, meta, size = 'medium', isHandRaised = false,
}: {
  participant: LocalParticipant | RemoteParticipant;
  isLocal?: boolean;
  label?: string;
  isAdmin?: boolean;
  meta?: ParsedMeta;
  size?: 'small' | 'medium' | 'large';
  isHandRaised?: boolean;
}) {
  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const hasCam = !!camPub && !camPub.isMuted && !!camPub.track;
  const hasMic = !!micPub && !micPub.isMuted;
  const displayName = label || participant.name || participant.identity;
  const subtitle = meta?.student_names?.length ? `Parent of ${meta.student_names.join(', ')}` : null;
  const avatarSize = size === 'large' ? 'h-16 w-16 text-2xl sm:h-20 sm:w-20 sm:text-3xl' : size === 'medium' ? 'h-10 w-10 text-base sm:h-14 sm:w-14 sm:text-xl' : 'h-8 w-8 text-xs sm:h-9 sm:w-9';

  return (
    <div className="relative h-full w-full group">
      {hasCam ? (
        <VideoTrack
          trackRef={{ participant, publication: camPub, source: Track.Source.Camera } as TrackReference}
          className={`h-full w-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
          <div className={`flex items-center justify-center rounded-full font-semibold text-white ${avatarSize} ${isAdmin ? 'bg-emerald-700' : 'bg-zinc-600'}`}>
            {getInitials(displayName)}
          </div>
        </div>
      )}

      {/* Audio (remote only) */}
      {!isLocal && micPub?.track && (
        <AudioTrack trackRef={{ participant, publication: micPub, source: Track.Source.Microphone } as TrackReference} />
      )}

      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-1.5 sm:px-2.5 pb-1.5 sm:pb-2 pt-4 sm:pt-6">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0">
            {hasMic ? (
              <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
            ) : (
              <svg className="h-3 w-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5.29"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/></svg>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <span className={`block truncate font-medium text-white drop-shadow-sm ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>{displayName}</span>
            {subtitle && size !== 'small' && (
              <span className="block truncate text-[10px] text-emerald-300/80 drop-shadow-sm">{subtitle}</span>
            )}
          </div>
          {isAdmin && size !== 'small' && (
            <span className="ml-auto shrink-0 rounded bg-emerald-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">Host</span>
          )}
        </div>
      </div>

      {/* Hand raised indicator */}
      {isHandRaised && (
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-10 animate-bounce">
          <div className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-amber-500/90 backdrop-blur-sm shadow-lg">
            <span className="text-xs sm:text-sm">✋</span>
          </div>
        </div>
      )}

      {/* Fullscreen hint on hover */}
      <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
          <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ScreenShareTile
   ═══════════════════════════════════════════════════════════════ */

function ScreenShareTile({ trackRef }: { trackRef: TrackReference }) {
  const displayName = trackRef.participant.name || trackRef.participant.identity;
  return (
    <div className="relative h-full w-full">
      <VideoTrack trackRef={trackRef} className="h-full w-full object-contain bg-black" />
      {trackRef.participant.getTrackPublication?.(Track.Source.ScreenShareAudio)?.track && (
        <AudioTrack trackRef={{ participant: trackRef.participant, publication: trackRef.participant.getTrackPublication(Track.Source.ScreenShareAudio)!, source: Track.Source.ScreenShareAudio } as TrackReference} />
      )}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/60 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5">
        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/><polyline points="8 21 12 21 16 21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
        <span className="text-[10px] sm:text-xs font-medium text-white truncate max-w-[120px] sm:max-w-none">{displayName}&apos;s screen</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Control helpers + Icons
   ═══════════════════════════════════════════════════════════════ */

function ControlBtn({ children, onClick, tip, on = false, danger = false, accent = false, className = '' }: {
  children: React.ReactNode; onClick: () => void; tip: string; on?: boolean; danger?: boolean; accent?: boolean; className?: string;
}) {
  let bg = 'bg-zinc-800 text-white hover:bg-zinc-700';
  if (danger) bg = 'bg-red-600/90 text-white hover:bg-red-500';
  else if (accent && on) bg = 'bg-emerald-600 text-white hover:bg-emerald-500';
  else if (on) bg = 'bg-zinc-700 text-white hover:bg-zinc-600';
  return <button onClick={onClick} title={tip} className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full transition-all active:scale-90 ${bg} ${className}`}>{children}</button>;
}

function MicOnIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>; }
function MicOffIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5.29"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>; }
function CamOnIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.6 11.6L22 7v10l-6.4-4.5v-1Z"/><rect width="14" height="10" x="2" y="7" rx="2" ry="2"/></svg>; }
function CamOffIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.66 5H14a2 2 0 0 1 2 2v2.34l1 .86 5-3.2v10l-4-2.57"/><path d="M14 15.88V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><line x1="2" x2="22" y1="2" y2="22"/></svg>; }
function ScreenShareIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/><polyline points="8 21 12 21 16 21"/><line x1="12" x2="12" y1="17" y2="21"/><path d="m17 8 5-5"/><path d="M17 3h5v5"/></svg>; }
function PhoneOffIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" x2="1" y1="1" y2="23"/></svg>; }
function LeaveIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>; }
function PeersIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
