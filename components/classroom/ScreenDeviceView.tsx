'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalParticipant, useDataChannel } from '@livekit/components-react';
import { Track, LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { Monitor, MonitorOff, Wifi, WifiOff, Clock } from 'lucide-react';

/**
 * ScreenDeviceView — Minimal tablet/screen device UI.
 *
 * This view is shown when the teacher joins from their tablet (device=screen).
 * Its only purpose is to share the tablet screen, which becomes
 * the whiteboard background in the main teacher + student views.
 *
 * ┌──────────────────────────────────┐
 * │  Connected as screen device      │
 * │                                  │
 * │    [ SHARE SCREEN ]  big btn     │
 * │                                  │
 * │  Status: sharing / not sharing   │
 * └──────────────────────────────────┘
 */

export interface ScreenDeviceViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
}

export default function ScreenDeviceView({
  roomId,
  roomName,
  participantName,
}: ScreenDeviceViewProps) {
  const { localParticipant } = useLocalParticipant();
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  // ── Gate screen sharing behind Go Live ──
  const [isLive, setIsLive] = useState(false);

  // Poll room status until live
  useEffect(() => {
    if (isLive) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}`);
        const data = await res.json();
        if (!cancelled && data.success && data.data?.status === 'live') setIsLive(true);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 5_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [roomId, isLive]);

  // Real-time Go Live signal via data channel
  const onSessionControl = useCallback((msg: unknown) => {
    try {
      const raw = msg as { payload?: ArrayBuffer };
      const text = new TextDecoder().decode(raw?.payload);
      const data = JSON.parse(text);
      if (data.action === 'go_live') setIsLive(true);
    } catch {}
  }, []);
  useDataChannel('session_control', onSessionControl);

  const screenTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const [sharing, setSharing] = useState(false);

  const toggleScreenShare = useCallback(async () => {
    setToggling(true);
    setError('');
    try {
      if (sharing) {
        // Stop sharing — unpublish and stop tracks
        if (screenTrackRef.current) {
          await localParticipant.unpublishTrack(screenTrackRef.current);
          screenTrackRef.current.stop();
          screenTrackRef.current = null;
        }
        if (audioTrackRef.current) {
          await localParticipant.unpublishTrack(audioTrackRef.current);
          audioTrackRef.current.stop();
          audioTrackRef.current = null;
        }
        setSharing(false);
      } else {
        // Start sharing — call getDisplayMedia directly (bypasses LiveKit's internal check)
        // Try multiple ways to access getDisplayMedia for maximum compatibility
        let stream: MediaStream;
        // Request high-resolution screen capture for crisp whiteboard/text
        const displayConstraints = {
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 15, max: 30 },
          },
          audio: true,
        };
        if (navigator.mediaDevices?.getDisplayMedia) {
          stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
        } else if ((navigator as unknown as Record<string, unknown>).getDisplayMedia) {
          // Older API — some Android browsers expose it on navigator directly
          stream = await (navigator as unknown as { getDisplayMedia: (c: typeof displayConstraints) => Promise<MediaStream> }).getDisplayMedia(displayConstraints);
        } else {
          // Last resort — try calling it anyway and let the error propagate
          stream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
        }

        // Publish video track as screen share
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const localVideo = new LocalVideoTrack(videoTrack, undefined, false);
          await localParticipant.publishTrack(localVideo, {
            source: Track.Source.ScreenShare,
            // High bitrate for clear whiteboard text/drawings
            videoEncoding: {
              maxBitrate: 3_000_000, // 3 Mbps
              maxFramerate: 15,
            },
            simulcast: false,
          });
          screenTrackRef.current = localVideo;

          // Listen for browser-level "Stop sharing" click
          videoTrack.onended = () => {
            localParticipant.unpublishTrack(localVideo).catch(() => {});
            localVideo.stop();
            screenTrackRef.current = null;
            if (audioTrackRef.current) {
              localParticipant.unpublishTrack(audioTrackRef.current).catch(() => {});
              audioTrackRef.current.stop();
              audioTrackRef.current = null;
            }
            setSharing(false);
          };
        }

        // Publish audio track if available
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const localAudio = new LocalAudioTrack(audioTrack, undefined, false);
          await localParticipant.publishTrack(localAudio, {
            source: Track.Source.ScreenShareAudio,
          });
          audioTrackRef.current = localAudio;
        }

        setSharing(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ScreenDevice] Screen share error:', err);
      // User cancelled the picker — not a real error
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError') || msg.includes('AbortError') || msg.includes('cancel')) {
        console.log('[ScreenDevice] User cancelled screen share');
      } else {
        setError(msg);
      }
    } finally {
      setToggling(false);
    }
  }, [localParticipant, sharing]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-6">
      {/* Connection status badge */}
      <div className="mb-8 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
        {localParticipant.connectionQuality !== undefined ? (
          <Wifi className="h-4 w-4 text-emerald-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-400" />
        )}
        <span className="text-sm text-foreground/80">
          Connected to <strong className="text-foreground">{roomName}</strong>
        </span>
      </div>

      {/* Icon */}
      <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ${
        sharing
          ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50'
          : 'bg-muted ring-2 ring-border'
      }`}>
        {sharing ? (
          <Monitor className="h-12 w-12 text-emerald-400" />
        ) : (
          <MonitorOff className="h-12 w-12 text-muted-foreground" />
        )}
      </div>

      {/* Status text */}
      <h1 className="mb-2 text-xl font-bold text-foreground">
        {sharing ? 'Screen is being shared' : isLive ? 'Screen Device Ready' : 'Waiting for Go Live'}
      </h1>
      <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
        {sharing
          ? 'Your tablet screen is now visible to students as the whiteboard background. Keep this tab open.'
          : isLive
            ? 'Tap the button below to share your tablet screen. Students will see it as the whiteboard background.'
            : 'The session has not started yet. Click Go Live on your main device first.'}
      </p>

      {/* Share / Stop button */}
      <button
        onClick={toggleScreenShare}
        disabled={toggling || (!sharing && !isLive)}
        className={`flex items-center gap-3 rounded-2xl px-10 py-5 text-lg font-bold shadow-lg transition-all active:scale-95 ${
          sharing
            ? 'bg-red-600 text-white hover:bg-red-700'
            : isLive
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
        } disabled:opacity-50`}
      >
        {sharing ? (
          <>
            <MonitorOff className="h-6 w-6" />
            {toggling ? 'Stopping...' : 'Stop Sharing'}
          </>
        ) : !isLive ? (
          <>
            <Clock className="h-6 w-6" />
            Waiting for Go Live…
          </>
        ) : (
          <>
            <Monitor className="h-6 w-6" />
            {toggling ? 'Starting...' : 'Share Screen'}
          </>
        )}
      </button>

      {/* Pre-Go-Live hint */}
      {!isLive && !sharing && (
        <p className="mt-4 text-sm text-amber-400/80">
          Screen sharing will be available after the teacher clicks Go Live.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sharing indicator pulse */}
      {sharing && (
        <div className="mt-8 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm text-emerald-400">Live — sharing to classroom</span>
        </div>
      )}

      {/* Footer: identity */}
      <p className="mt-auto mb-6 text-xs text-muted-foreground/80">
        {participantName} • screen device
      </p>
    </div>
  );
}
