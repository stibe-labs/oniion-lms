'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useConnectionState,
  useTracks,
  useDataChannel,
  VideoTrack,
  AudioTrack,
} from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

// ── Egress Layout ───────────────────────────────────────────
// Custom recording layout for LiveKit Room Composite Egress.
// Shows: screen share (full screen) + teacher camera PiP with
//        lightweight MediaPipe background removal (CPU-optimised).
//
// Optimised for headless Chrome (no GPU):
//   - Tiny 250KB selfie_segmenter model (not 16MB multiclass)
//   - CPU delegate only (no GPU attempt)
//   - Throttled to ~10 FPS to avoid CPU overload
// ─────────────────────────────────────────────────────────────

const LIGHT_MODEL = '/mediapipe/models/selfie_segmenter.tflite';
const WASM_PATH = '/mediapipe';
const PERSON_THRESHOLD = 0.35;
const EDGE_FEATHER = 0.15;       // soft-edge transition width around threshold
const TEMPORAL_BLEND = 0.3;      // blend 30% of previous mask to reduce flicker
const TARGET_FPS = 15;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

function EgressLayoutInner() {
  const params = useSearchParams();
  const serverUrl = params.get('url') || '';
  const token = params.get('token') || '';

  if (!serverUrl || !token) {
    return <div className="h-screen w-screen bg-black" />;
  }

  return (
    <LiveKitRoom serverUrl={serverUrl} token={token} connect={true}>
      <RecordingComposite />
    </LiveKitRoom>
  );
}

// ── Lightweight egress-specific segmentation hook ──
function useEgressOverlay(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const activeRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const hasFirstFrameRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-allocated mask buffer + previous mask for temporal smoothing
  const maskBufRef = useRef<{ buf: Uint8ClampedArray; w: number; h: number } | null>(null);
  const prevAlphaRef = useRef<Float32Array | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const maskImgDataRef = useRef<ImageData | null>(null);

  // Load lightweight segmenter — CPU only
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled) return;
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: LIGHT_MODEL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
        if (cancelled) { segmenter.close(); return; }
        segmenterRef.current = segmenter;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      segmenterRef.current?.close();
      segmenterRef.current = null;
      setHasFirstFrame(false);
      hasFirstFrameRef.current = false;
    };
  }, [enabled]);

  const processFrame = useCallback((ts: number) => {
    if (!activeRef.current) return;

    // Throttle to TARGET_FPS
    if (ts - lastFrameTimeRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameTimeRef.current = ts;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const segmenter = segmenterRef.current;

    if (!video || !canvas || !segmenter || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) { rafRef.current = requestAnimationFrame(processFrame); return; }
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = requestAnimationFrame(processFrame); return; }

    try {
      const result = segmenter.segmentForVideo(video, ts);
      const masks = result.confidenceMasks;

      if (masks && masks.length > 0) {
        const mask = masks[0];
        const mw = mask.width;
        const mh = mask.height;
        const data = mask.getAsFloat32Array();
        const totalPx = mw * mh;

        // Ensure mask buffer
        let cur = maskBufRef.current;
        if (!cur || cur.w !== mw || cur.h !== mh) {
          const buf = new Uint8ClampedArray(totalPx * 4);
          buf.fill(255);
          maskBufRef.current = { buf, w: mw, h: mh };
          cur = maskBufRef.current;
        }
        const buf = cur.buf;

        // Soft feathered alpha mask with temporal smoothing
        const lo = PERSON_THRESHOLD - EDGE_FEATHER;
        const hi = PERSON_THRESHOLD + EDGE_FEATHER;
        const range = hi - lo;
        let prevAlpha = prevAlphaRef.current;
        if (!prevAlpha || prevAlpha.length !== totalPx) {
          prevAlpha = new Float32Array(totalPx);
          prevAlphaRef.current = prevAlpha;
        }
        for (let i = 0; i < totalPx; i++) {
          const conf = data[i];
          // Smooth alpha: 0 below lo, 1 above hi, linear ramp in between
          const raw = conf <= lo ? 0 : conf >= hi ? 1 : (conf - lo) / range;
          // Temporal blend: reduce frame-to-frame flicker
          const blended = raw * (1 - TEMPORAL_BLEND) + prevAlpha[i] * TEMPORAL_BLEND;
          prevAlpha[i] = blended;
          buf[i * 4 + 3] = (blended * 255 + 0.5) | 0;
        }

        // Off-screen mask canvas
        let mc = maskCanvasRef.current;
        if (!mc || mc.width !== mw || mc.height !== mh) {
          mc = document.createElement('canvas');
          mc.width = mw;
          mc.height = mh;
          maskCanvasRef.current = mc;
          maskCtxRef.current = mc.getContext('2d', { willReadFrequently: true });
          maskImgDataRef.current = null;
        }
        const mctx = maskCtxRef.current!;
        let imgData = maskImgDataRef.current;
        if (!imgData || imgData.width !== mw || imgData.height !== mh) {
          imgData = mctx.createImageData(mw, mh);
          maskImgDataRef.current = imgData;
        }
        imgData.data.set(buf);
        mctx.putImageData(imgData, 0, 0);

        // Composite: video frame × mask
        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(video, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mc, 0, 0, vw, vh);
        ctx.globalCompositeOperation = 'source-over';

        if (!hasFirstFrameRef.current) {
          hasFirstFrameRef.current = true;
          setHasFirstFrame(true);
        }
      }

      result.close();
    } catch {
      // skip frame
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, []);

  // Start/stop loop
  useEffect(() => {
    if (enabled && segmenterRef.current) {
      activeRef.current = true;
      rafRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      activeRef.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [enabled, processFrame]);

  // Also start when segmenter loads after enabled is already true
  useEffect(() => {
    if (enabled && segmenterRef.current && !activeRef.current) {
      activeRef.current = true;
      rafRef.current = requestAnimationFrame(processFrame);
    }
  });

  return { videoRef, canvasRef, hasFirstFrame, error };
}

function RecordingComposite() {
  // Signal LiveKit Egress that the page is ready to record
  const connectionState = useConnectionState();
  const signalledRef = useRef(false);
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && !signalledRef.current) {
      signalledRef.current = true;
      console.log('START_RECORDING');
    }
  }, [connectionState]);

  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true });
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const audioTracks = useTracks(
    [Track.Source.Microphone, Track.Source.ScreenShareAudio],
    { onlySubscribed: true },
  );

  // ── Identify teacher participants ──
  // Separate laptop screen tracks from tablet screen tracks
  const isTeacherPrimary = (p: { metadata?: string | null; identity: string }) => {
    try {
      const m = JSON.parse(p.metadata || '{}');
      if (m.device || m.portal_role) return m.portal_role === 'teacher' && m.device !== 'screen';
    } catch {}
    return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
  };

  const laptopScreenTrack = screenTracks.find((t) => isTeacherPrimary(t.participant));
  const tabletScreenTrack = screenTracks.find((t) => !isTeacherPrimary(t.participant));

  // Screen source preference via data channel
  const [screenSourcePref, setScreenSourcePref] = useState<'tablet' | 'laptop'>('tablet');
  const onScreenSource = useCallback((msg: unknown) => {
    try {
      const raw = msg as { payload?: ArrayBuffer };
      const text = new TextDecoder().decode(raw?.payload);
      const data = JSON.parse(text) as { source: 'laptop' | 'tablet' };
      if (data.source === 'laptop' || data.source === 'tablet') setScreenSourcePref(data.source);
    } catch {}
  }, []);
  useDataChannel('screen_source', onScreenSource);

  // Auto-detect for initial state
  useEffect(() => {
    if (laptopScreenTrack && !tabletScreenTrack) setScreenSourcePref('laptop');
    else if (!laptopScreenTrack && tabletScreenTrack) setScreenSourcePref('tablet');
  }, [laptopScreenTrack, tabletScreenTrack]);

  // Pick the screen track based on preference (with fallback)
  const screenTrack = screenSourcePref === 'laptop'
    ? (laptopScreenTrack || tabletScreenTrack || screenTracks[0])
    : (tabletScreenTrack || laptopScreenTrack || screenTracks[0]);
  const hasScreenShare = !!screenTrack;

  const teacherCamera = cameraTracks.find((t) => {
    const p = t.participant;
    if (!p) return false;
    try {
      const m = JSON.parse(p.metadata || '{}');
      if (m.device || m.portal_role) {
        return m.portal_role === 'teacher' && m.device !== 'screen';
      }
    } catch { /* fall through */ }
    return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
  });

  // ── Lightweight egress segmentation ──
  const [videoAttached, setVideoAttached] = useState(false);
  const { videoRef, canvasRef, hasFirstFrame, error: segError } = useEgressOverlay(videoAttached);

  // Attach teacher camera track to hidden video element
  useEffect(() => {
    const videoEl = videoRef.current;
    const track = teacherCamera?.publication?.track;
    if (!videoEl || !track) {
      setVideoAttached(false);
      return;
    }
    track.attach(videoEl);
    setVideoAttached(true);
    return () => {
      track.detach(videoEl);
      setVideoAttached(false);
    };
  }, [teacherCamera?.publication?.track, videoRef]);

  const mediapipeActive = hasFirstFrame && !segError;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* ── Main: Screen Share (full screen) ── */}
      {hasScreenShare && (
        <div className="absolute inset-0">
          <VideoTrack trackRef={screenTrack} className="h-full w-full object-contain" />
        </div>
      )}

      {/* ── No screen share fallbacks ── */}
      {!hasScreenShare && !teacherCamera && cameraTracks[0] && (
        <div className="absolute inset-0">
          <VideoTrack trackRef={cameraTracks[0]} className="h-full w-full object-contain" />
        </div>
      )}
      {!hasScreenShare && !teacherCamera && !cameraTracks[0] && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/40 text-2xl font-medium">Waiting for teacher...</div>
        </div>
      )}
      {!hasScreenShare && teacherCamera && (
        <div className="absolute inset-0">
          <VideoTrack trackRef={teacherCamera} className="h-full w-full object-contain" />
        </div>
      )}

      {/* ── Teacher PiP with Background Removal ── */}
      {teacherCamera && (
        <>
          {/* Hidden video element — feeds segmentation */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          />

          {/* Canvas: background-removed teacher cutout */}
          <div
            className="absolute z-10"
            style={{
              bottom: 0,
              left: '16px',
              width: '280px',
              height: '210px',
              opacity: mediapipeActive ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
                background: 'transparent',
              }}
            />
          </div>

          {/* No fallback PiP — teacher only appears after background removal is ready */}
        </>
      )}

      {/* ── Audio: all tracks ── */}
      {audioTracks.map((trackRef) => (
        <AudioTrack key={trackRef.participant.identity + trackRef.source} trackRef={trackRef} />
      ))}
    </div>
  );
}

export default function EgressLayoutPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <EgressLayoutInner />
    </Suspense>
  );
}
