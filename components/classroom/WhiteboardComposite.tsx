'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  useTracks,
  useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent, type RemoteTrackPublication, type RemoteParticipant, type Participant } from 'livekit-client';
import TeacherOverlay from './TeacherOverlay';
import { cn } from '@/lib/utils';

/**
 * WhiteboardComposite — Displays tablet screen share as the full whiteboard
 * background, with teacher's camera overlaid as a background-removed cutout.
 *
 * Two-device setup:
 *   - Screen share can come from the teacher_screen participant (tablet)
 *     OR from the teacher's primary participant (single-device screen share)
 *   - Camera track always comes from the primary teacher participant
 *
 * The composite renders:
 *   1. Screen share video → full area, object-fit: contain (never cropped)
 *   2. TeacherOverlay (MediaPipe) → draggable corner, transparent bg
 */

export interface WhiteboardCompositeProps {
  /** The primary teacher participant (laptop — camera + mic) */
  teacher: Participant;
  /** Optional: the teacher's screen device participant */
  teacherScreenDevice?: RemoteParticipant | null;
  /** Hide the teacher camera overlay (when shown elsewhere, e.g. sidebar) */
  hideOverlay?: boolean;
  /** When true, prefer teacher's laptop screen share over tablet */
  preferLaptopScreen?: boolean;
  /** Class name for sizing */
  className?: string;
  /** Callback to expose the screen share <video> element to the parent */
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}

export default function WhiteboardComposite({
  teacher,
  teacherScreenDevice,
  hideOverlay = false,
  preferLaptopScreen = false,
  className,
  onVideoRef,
}: WhiteboardCompositeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [teacherVideoEl, setTeacherVideoEl] = useState<HTMLVideoElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const room = useRoomContext();
  const [trackVer, setTrackVer] = useState(0);

  // Reactive track detection via useTracks — triggers re-render when publications change
  const allTracks = useTracks(
    [Track.Source.ScreenShare, Track.Source.Camera],
    { onlySubscribed: false },
  );

  // Priority: preferLaptopScreen overrides default tablet-first
  // Fallback: if preferred source has no screen track, try the other
  const preferredSource = preferLaptopScreen ? teacher : (teacherScreenDevice || teacher);
  const fallbackSource = preferLaptopScreen ? (teacherScreenDevice || null) : teacher;

  const preferredTrackRef = allTracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.participant.identity === preferredSource.identity,
  );
  const fallbackTrackRef = fallbackSource ? allTracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.participant.identity === fallbackSource.identity,
  ) : undefined;

  const screenTrackRef = preferredTrackRef || fallbackTrackRef;
  const screenSource = screenTrackRef ? screenTrackRef.participant : preferredSource;
  const screenSharePub = screenTrackRef?.publication as RemoteTrackPublication | undefined;

  // Camera track: always from primary teacher (reactive)
  const cameraTrackRef = allTracks.find(
    (t) =>
      t.source === Track.Source.Camera &&
      t.participant.identity === teacher.identity,
  );
  const cameraPub = cameraTrackRef?.publication as RemoteTrackPublication | undefined;
  const hasCameraTrack = !!cameraPub && !cameraPub.isMuted && !!cameraPub.track;

  // Force re-render when tracks get subscribed (useTracks may not re-render for this)
  useEffect(() => {
    const onSubscribed = () => setTrackVer((v) => v + 1);
    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackPublished, onSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackPublished, onSubscribed);
    };
  }, [room]);

  // Explicitly subscribe to screen share + audio tracks
  useEffect(() => {
    if (!screenSharePub) return;
    if (!screenSharePub.isSubscribed) screenSharePub.setSubscribed(true);
    const audioPub = screenSource.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
    if (audioPub && !audioPub.isSubscribed) audioPub.setSubscribed(true);
  }, [screenSharePub, screenSource, trackVer]);

  // Explicitly subscribe to teacher camera track (needed for remote viewers like BC)
  useEffect(() => {
    if (hideOverlay || !cameraPub) return;
    if ('setSubscribed' in cameraPub && !cameraPub.isSubscribed) {
      (cameraPub as RemoteTrackPublication).setSubscribed(true);
    }
  }, [cameraPub, hideOverlay, trackVer]);

  // Attach camera track to the hidden <video> element for MediaPipe input
  useEffect(() => {
    const track = cameraPub?.track;
    if (!teacherVideoEl || !track || hideOverlay) return;
    track.attach(teacherVideoEl);
    return () => { track.detach(teacherVideoEl); };
  }, [cameraPub?.track, hideOverlay, teacherVideoEl]);

  // Measure container for overlay sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Capture the teacher's camera <video> element — useState ensures re-render
  const captureTeacherVideoRef = useCallback((node: HTMLVideoElement | null) => {
    setTeacherVideoEl(node);
  }, []);

  // Manual screen share video ref — direct track.attach() for iOS Safari compatibility.
  // The <VideoTrack> component can fail to render on iOS Safari inside CSS-transformed
  // containers. Using track.attach() directly with explicit playsInline/autoplay ensures
  // the video element gets proper GPU compositing and inline playback on all platforms.
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = screenVideoRef.current;
    const track = screenSharePub?.track;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [screenSharePub?.track]);

  // Expose the screen share <video> element to the parent for iOS native fullscreen
  useEffect(() => {
    onVideoRef?.(screenVideoRef.current);
    return () => { onVideoRef?.(null); };
  }, [onVideoRef, screenSharePub?.track]);

  if (!screenTrackRef || !screenSharePub) {
    return (
      <div className={cn('flex items-center justify-center bg-background', className)}>
        <div className="text-center">
          <div className="mb-2 text-3xl">🖥️</div>
          <p className="text-muted-foreground text-sm">Waiting for teacher to share screen...</p>
          <p className="text-muted-foreground/80 text-xs mt-1">The whiteboard will appear when screen sharing starts</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden bg-black', className)}>
      {/* Layer 1: Screen share — manual <video> + track.attach() for iOS Safari compat */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={screenVideoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
      />

      {/* Hidden video element: teacher's camera for MediaPipe input */}
      {!hideOverlay && (
        <video
          ref={captureTeacherVideoRef}
          autoPlay
          playsInline
          muted
          className="sr-only"
        />
      )}

      {/* Layer 2: Teacher overlay — AI background removed cutout (falls back to regular PIP) */}
      {!hideOverlay && (
        <TeacherOverlay
          active={hasCameraTrack}
          videoElement={teacherVideoEl}
          teacher={teacher}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      )}
    </div>
  );
}
