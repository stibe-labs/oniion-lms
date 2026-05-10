'use client';

import { useRef, useState, useEffect } from 'react';
import {
  VideoTrack,
  AudioTrack,
  useIsSpeaking,
  useTrackMutedIndicator,
  TrackReference,
} from '@livekit/components-react';
import { Track, Participant, ConnectionQuality } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * VideoTile — Reusable participant video tile.
 * Fills its parent container (no fixed sizes). Parent controls dimensions.
 * Renders live video when camera is on, initials avatar when off.
 * Shows green border glow when participant is speaking.
 */

export interface VideoTileProps {
  participant: Participant;
  /** @deprecated — tile now fills parent. Only 'small' shrinks avatar. */
  size?: 'small' | 'medium' | 'large';
  /** Mirror video (true for local self-view) */
  mirror?: boolean;
  /** Show name label at bottom */
  showName?: boolean;
  /** Show mic muted indicator on tile */
  showMicIndicator?: boolean;
  /** Show audio track (defaults to false for grid layouts) */
  playAudio?: boolean;
  /** Show animated hand-raise badge */
  handRaised?: boolean;
  /** LiveKit connection quality for this participant */
  connectionQuality?: ConnectionQuality;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function VideoTile({
  participant,
  size = 'medium',
  mirror = false,
  showName = true,
  showMicIndicator = true,
  playAudio = false,
  handRaised = false,
  connectionQuality,
  className,
  onClick,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useIsSpeaking(participant);

  // Force re-render when track subscription state changes.
  // useRemoteParticipants() does not emit on TrackSubscribed/TrackUnsubscribed,
  // so without this the tile stays stuck on the avatar after a mid-session join.
  const [, setTrackTick] = useState(0);
  useEffect(() => {
    const update = () => setTrackTick((t) => t + 1);
    participant.on('trackSubscribed', update);
    participant.on('trackUnsubscribed', update);
    participant.on('trackMuted', update);
    participant.on('trackUnmuted', update);
    participant.on('trackPublished', update);
    participant.on('trackUnpublished', update);
    return () => {
      participant.off('trackSubscribed', update);
      participant.off('trackUnsubscribed', update);
      participant.off('trackMuted', update);
      participant.off('trackUnmuted', update);
      participant.off('trackPublished', update);
      participant.off('trackUnpublished', update);
    };
  }, [participant]);

  // Get camera track reference
  const cameraTrack = participant.getTrackPublication(Track.Source.Camera);
  const isCameraOn = !!cameraTrack && !cameraTrack.isMuted;
  const micTrack = participant.getTrackPublication(Track.Source.Microphone);
  const isMicOn = !!micTrack && !micTrack.isMuted;

  const displayName = participant.name || participant.identity;
  const isSmall = size === 'small';

  // Detect guest participants (joined via guest link)
  const isGuest = (() => {
    try { return !!JSON.parse(participant.metadata || '{}').is_guest; } catch { return false; }
  })();

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg bg-[#1a1c20] border-2 transition-all duration-200',
        isSpeaking ? 'border-[#34a853] shadow-[0_0_12px_rgba(52,168,83,0.3)]' : 'border-transparent',
        onClick && 'cursor-pointer group',
        className
      )}
      onClick={onClick}
    >
      {/* Video track or avatar fallback */}
      {isCameraOn && cameraTrack?.track ? (
        <VideoTrack
          trackRef={{
            participant,
            publication: cameraTrack,
            source: Track.Source.Camera,
          } as TrackReference}
          className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#1a1c20]">
          <div className={cn(
            'flex items-center justify-center rounded-full bg-[#5f6368] font-semibold text-white',
            isSmall ? 'h-8 w-8 text-xs' : 'h-14 w-14 text-xl',
          )}>
            {getInitials(displayName)}
          </div>
        </div>
      )}

      {/* Audio track (optionally played) */}
      {playAudio && micTrack?.track && (
        <AudioTrack
          trackRef={{
            participant,
            publication: micTrack,
            source: Track.Source.Microphone,
          } as TrackReference}
        />
      )}

      {/* Hand-raised badge (top-right, animated) — z-20 to render above attention badge */}
      {handRaised && (
        <div className="absolute top-1.5 right-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#f9ab00] shadow-lg animate-bounce">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
        </div>
      )}

      {/* Guest badge (top-left) */}
      {isGuest && (
        <div className="absolute top-1 left-1 z-10 flex items-center gap-1 rounded-full bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm shadow-sm">
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Guest
        </div>
      )}

      {/* Network quality badge (top-left, shifted down when guest badge is present) */}
      {connectionQuality !== undefined && (
        <div
          className={cn(
            'absolute left-1 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm',
            isGuest ? 'top-6' : 'top-1',
            connectionQuality === ConnectionQuality.Excellent && 'bg-primary/70 text-white',
            connectionQuality === ConnectionQuality.Good && 'bg-amber-500/70 text-white',
            connectionQuality === ConnectionQuality.Poor && 'bg-red-600/80 text-white',
            connectionQuality === ConnectionQuality.Lost && 'bg-red-800/90 text-white animate-pulse',
          )}
          title={
            connectionQuality === ConnectionQuality.Excellent ? 'Excellent connection' :
            connectionQuality === ConnectionQuality.Good ? 'Good connection' :
            connectionQuality === ConnectionQuality.Poor ? 'Poor connection' :
            'Connection lost'
          }
        >
          <NetworkIcon quality={connectionQuality} />
          <span>
            {connectionQuality === ConnectionQuality.Excellent ? 'Good' :
             connectionQuality === ConnectionQuality.Good ? 'Fair' :
             connectionQuality === ConnectionQuality.Poor ? 'Weak' :
             'Lost'}
          </span>
        </div>
      )}

      {/* Bottom overlay: name + mic indicator */}
      {(showName || showMicIndicator) && (
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            {showMicIndicator && (
              <span className="flex items-center">
                {isMicOn ? (
                  <svg className="h-3.5 w-3.5 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                ) : (
                  <svg className="h-3.5 w-3.5 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12L9 9z"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v1.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                )}
              </span>
            )}
            {showName && (
              <span className="truncate text-xs font-medium text-white drop-shadow-sm">
                {displayName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Hover overlay — click affordance */}
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 pointer-events-none flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="h-8 w-8 text-white/80 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 3h6v6"/><path d="m9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></svg>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tiny wifi-signal bars icon sized for the network badge */
function NetworkIcon({ quality }: { quality: ConnectionQuality }) {
  const bars = quality === ConnectionQuality.Excellent ? 3
    : quality === ConnectionQuality.Good ? 2
    : quality === ConnectionQuality.Poor ? 1
    : 0;
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="shrink-0">
      <rect x="0" y="7" width="3" height="3" rx="0.5" fill={bars >= 1 ? 'currentColor' : 'rgba(255,255,255,0.3)'} />
      <rect x="4.5" y="4" width="3" height="6" rx="0.5" fill={bars >= 2 ? 'currentColor' : 'rgba(255,255,255,0.3)'} />
      <rect x="9" y="0" width="3" height="10" rx="0.5" fill={bars >= 3 ? 'currentColor' : 'rgba(255,255,255,0.3)'} />
    </svg>
  );
}
