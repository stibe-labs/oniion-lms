'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * useTeacherOverlay — MediaPipe background removal for teacher camera.
 *
 * Pipeline optimised for zero-lag tracking:
 * 1. `requestVideoFrameCallback` triggers ONLY on new video frames (no wasted work)
 * 2. Exact frame captured as ImageBitmap BEFORE segmentation — guarantees mask/video sync
 * 3. Binary threshold at model resolution (256×256) with pre-allocated buffer
 * 4. GPU-composited mask upscale via canvas destination-in
 *
 * Exposes `hasFirstFrame` so the UI can hide the cutout until
 * the first successful segmentation completes.
 */

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

const WASM_BASE_PATH = '/mediapipe';

const PERSON_THRESHOLD = 0.45;

// Check if requestVideoFrameCallback is available
const hasRVFC = typeof HTMLVideoElement !== 'undefined' &&
  'requestVideoFrameCallback' in HTMLVideoElement.prototype;

interface UseTeacherOverlayOptions {
  enabled?: boolean;
}

interface UseTeacherOverlayReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  isProcessing: boolean;
  hasFirstFrame: boolean;
  fps: number;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useTeacherOverlay(
  options: UseTeacherOverlayOptions = {}
): UseTeacherOverlayReturn {
  const { enabled = true } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const activeRef = useRef(false);           // controls the loop
  const rafRef = useRef<number | null>(null); // rAF fallback handle
  const rvfcRef = useRef<number | null>(null); // requestVideoFrameCallback handle
  const fpsCounterRef = useRef<{ frames: number; lastCheck: number }>({ frames: 0, lastCheck: 0 });

  // Pre-allocated mask buffer
  const maskBufRef = useRef<{ buf: Uint8ClampedArray; w: number; h: number } | null>(null);

  // Off-screen mask canvas + reusable ImageData
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const maskImgDataRef = useRef<ImageData | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasFirstFrameRef = useRef(false);

  // ── Load MediaPipe segmenter ────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
        if (cancelled) return;

        let segmenter: ImageSegmenter | null = null;

        // Try GPU delegate first, fall back to CPU (needed for headless Chrome / egress)
        try {
          segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
          });
        } catch {
          if (cancelled) return;
          console.warn('[MediaPipe] GPU delegate failed, falling back to CPU');
          segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
          });
        }

        if (cancelled) { segmenter.close(); return; }
        segmenterRef.current = segmenter;
        setIsReady(true);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Background removal not available: ${msg}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      segmenterRef.current?.close();
      segmenterRef.current = null;
      setIsReady(false);
      setHasFirstFrame(false);
      hasFirstFrameRef.current = false;
    };
  }, [enabled]);

  // ── Ensure off-screen mask canvas ───────────────────────
  const ensureMaskCanvas = useCallback((w: number, h: number) => {
    let mc = maskCanvasRef.current;
    if (!mc || mc.width !== w || mc.height !== h) {
      mc = document.createElement('canvas');
      mc.width = w;
      mc.height = h;
      maskCanvasRef.current = mc;
      maskCtxRef.current = mc.getContext('2d', { willReadFrequently: true });
      maskImgDataRef.current = null; // reset cached ImageData on resize
    }
    return { canvas: mc, ctx: maskCtxRef.current! };
  }, []);

  // ── Ensure pre-allocated RGBA buffer ────────────────────
  const ensureMaskBuf = useCallback((totalPixels: number, w: number, h: number) => {
    const cur = maskBufRef.current;
    if (!cur || cur.w !== w || cur.h !== h) {
      const buf = new Uint8ClampedArray(totalPixels * 4);
      buf.fill(255); // init R/G/B to white
      maskBufRef.current = { buf, w, h };
    }
    return maskBufRef.current!.buf;
  }, []);

  // ── Core: process a single frame ───────────────────────
  const processOnce = useCallback(async (timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const segmenter = segmenterRef.current;

    if (!video || !canvas || !segmenter || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture the EXACT current frame as a bitmap — won't change while we process
    let frameBitmap: ImageBitmap | null = null;
    try {
      frameBitmap = await createImageBitmap(video);
    } catch {
      return; // video not ready
    }

    try {
      const result = segmenter.segmentForVideo(video, timestamp);
      const masks = result.confidenceMasks;

      if (!masks || masks.length === 0) {
        result.close();
        frameBitmap.close();
        return;
      }

      const bgMask = masks[0];
      const mw = bgMask.width;
      const mh = bgMask.height;
      const bgData = bgMask.getAsFloat32Array();
      const totalPx = mw * mh;

      // Build binary alpha mask
      const buf = ensureMaskBuf(totalPx, mw, mh);
      for (let i = 0; i < totalPx; i++) {
        buf[i * 4 + 3] = (1.0 - bgData[i]) > PERSON_THRESHOLD ? 255 : 0;
      }

      // Write to mask canvas (reuse ImageData object when possible)
      const { canvas: mc, ctx: mctx } = ensureMaskCanvas(mw, mh);
      let imgData = maskImgDataRef.current;
      if (!imgData || imgData.width !== mw || imgData.height !== mh) {
        imgData = mctx.createImageData(mw, mh);
        maskImgDataRef.current = imgData;
      }
      imgData.data.set(buf);
      mctx.putImageData(imgData, 0, 0);

      // Composite: captured frame × mask (perfect sync — same exact frame)
      ctx.clearRect(0, 0, vw, vh);
      ctx.drawImage(frameBitmap, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(mc, 0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';

      result.close();

      if (!hasFirstFrameRef.current) {
        hasFirstFrameRef.current = true;
        setHasFirstFrame(true);
      }

      // FPS counter
      const now = performance.now();
      fpsCounterRef.current.frames++;
      if (now - fpsCounterRef.current.lastCheck >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastCheck = now;
      }
    } catch {
      // skip frame
    } finally {
      frameBitmap.close();
    }
  }, [ensureMaskCanvas, ensureMaskBuf]);

  // ── Loop using requestVideoFrameCallback (preferred) ────
  const scheduleNext = useCallback(() => {
    if (!activeRef.current) return;
    const video = videoRef.current;

    if (hasRVFC && video) {
      // Fires exactly once per new decoded video frame — no wasted work
      rvfcRef.current = (video as any).requestVideoFrameCallback(
        async (_now: number, metadata: { mediaTime: number }) => {
          if (!activeRef.current) return;
          await processOnce(metadata.mediaTime * 1000);
          scheduleNext();
        }
      );
    } else {
      // Fallback: rAF
      rafRef.current = requestAnimationFrame(async (ts) => {
        if (!activeRef.current) return;
        await processOnce(ts);
        scheduleNext();
      });
    }
  }, [processOnce]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setIsProcessing(true);
    fpsCounterRef.current = { frames: 0, lastCheck: performance.now() };
    scheduleNext();
  }, [scheduleNext]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (rvfcRef.current && videoRef.current && hasRVFC) {
      (videoRef.current as any).cancelVideoFrameCallback(rvfcRef.current);
      rvfcRef.current = null;
    }
    setIsProcessing(false);
    setFps(0);
  }, []);

  useEffect(() => {
    if (isReady && enabled) start();
    return () => { stop(); };
  }, [isReady, enabled, start, stop]);

  return { videoRef, canvasRef, isReady, isProcessing, hasFirstFrame, fps, error, start, stop };
}
