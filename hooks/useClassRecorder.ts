'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * useClassRecorder — client-side class recording on the student's browser.
 *
 * Composites teacher screen share + teacher cutout canvas into a single
 * recording canvas, captures audio, records via MediaRecorder.
 *
 * Flow:
 *   1. When session goes live → auto-starts recording
 *   2. Draws screen share (full) + teacher cutout (bottom-left) at ~24 fps
 *   3. On session end → stops recording, uploads blob to server → YouTube
 *   4. If interrupted (reconnect), resumes with a new segment
 *
 * Only records: teacher screen share + teacher cutout + teacher audio.
 * No student camera is included.
 */

interface UseClassRecorderOptions {
  roomId: string;
  /** The <video> element rendering the screen share track */
  screenVideoEl: HTMLVideoElement | null;
  /** The cutout <canvas> from useTeacherOverlay (background-removed teacher) */
  cutoutCanvas: HTMLCanvasElement | null;
  /** The teacher's audio track (MediaStreamTrack) */
  teacherAudioTrack: MediaStreamTrack | null;
  /** Whether the session is live */
  isLive: boolean;
  /** Whether the room has ended */
  roomEnded: boolean;
}

interface UseClassRecorderReturn {
  isRecording: boolean;
  /** Whether recording was ever started this session */
  wasStarted: boolean;
  /** Upload status: idle | uploading | uploaded | error */
  uploadStatus: 'idle' | 'uploading' | 'uploaded' | 'error';
}

// Target recording framerate (drawing fps, not encode fps — browser manages actual encode)
const DRAW_FPS = 15;
const DRAW_INTERVAL = 1000 / DRAW_FPS;

// Recording settings
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

export function useClassRecorder({
  roomId,
  screenVideoEl,
  cutoutCanvas,
  teacherAudioTrack,
  isLive,
  roomEnded,
}: UseClassRecorderOptions): UseClassRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [wasStarted, setWasStarted] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const drawTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedRef = useRef(false);
  const uploadedRef = useRef(false);

  // Create offscreen canvas once
  useEffect(() => {
    if (!recCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = CANVAS_WIDTH;
      c.height = CANVAS_HEIGHT;
      recCanvasRef.current = c;
    }
  }, []);

  // ── Draw composited frame ───────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = recCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear frame
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw screen share (full canvas, maintain aspect ratio)
    if (screenVideoEl && screenVideoEl.readyState >= 2) {
      const vw = screenVideoEl.videoWidth || CANVAS_WIDTH;
      const vh = screenVideoEl.videoHeight || CANVAS_HEIGHT;
      const scale = Math.min(CANVAS_WIDTH / vw, CANVAS_HEIGHT / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (CANVAS_WIDTH - dw) / 2;
      const dy = (CANVAS_HEIGHT - dh) / 2;
      ctx.drawImage(screenVideoEl, dx, dy, dw, dh);
    }

    // 2. Draw teacher cutout (bottom-left corner)
    if (cutoutCanvas && cutoutCanvas.width > 0 && cutoutCanvas.height > 0) {
      const maxH = CANVAS_HEIGHT * 0.35; // cutout is ~35% of canvas height
      const ratio = cutoutCanvas.width / cutoutCanvas.height;
      const ch = maxH;
      const cw = ch * ratio;
      ctx.drawImage(cutoutCanvas, 0, CANVAS_HEIGHT - ch, cw, ch);
    }
  }, [screenVideoEl, cutoutCanvas]);

  // ── Start recording ─────────────────────────────────────
  const startRecording = useCallback(() => {
    const canvas = recCanvasRef.current;
    if (!canvas || startedRef.current) return;

    // Need at least screen video to start
    if (!screenVideoEl || screenVideoEl.readyState < 2) return;

    try {
      // Canvas stream (video)
      const canvasStream = canvas.captureStream(DRAW_FPS);

      // Combine with teacher audio if available
      const combined = new MediaStream();
      for (const track of canvasStream.getVideoTracks()) {
        combined.addTrack(track);
      }
      if (teacherAudioTrack) {
        combined.addTrack(teacherAudioTrack);
      }

      // Choose codec
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 750_000, // 750 kbps — optimized for screen share content
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        setIsRecording(false);
      };

      recorder.onerror = () => {
        console.error('[ClassRecorder] MediaRecorder error');
        setIsRecording(false);
      };

      // Start drawing loop
      drawTimerRef.current = setInterval(drawFrame, DRAW_INTERVAL);

      // Start recording with 10s timeslice (periodic ondataavailable)
      recorder.start(10_000);
      recorderRef.current = recorder;
      startedRef.current = true;
      setWasStarted(true);
      setIsRecording(true);
      console.log('[ClassRecorder] Recording started');
    } catch (err) {
      console.error('[ClassRecorder] Failed to start:', err);
    }
  }, [screenVideoEl, teacherAudioTrack, drawFrame]);

  // ── Stop recording ──────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (drawTimerRef.current) {
      clearInterval(drawTimerRef.current);
      drawTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    recorderRef.current = null;
    console.log('[ClassRecorder] Recording stopped');
  }, []);

  // ── Upload recording to server ──────────────────────────
  const uploadRecording = useCallback(async () => {
    if (uploadedRef.current || chunksRef.current.length === 0) return;
    uploadedRef.current = true;
    setUploadStatus('uploading');

    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = []; // free memory

      const formData = new FormData();
      formData.append('recording', blob, `recording-${roomId}.webm`);

      const res = await fetch(`/api/v1/room/${roomId}/recording/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadStatus('uploaded');
        console.log('[ClassRecorder] Upload complete:', data.data?.youtubeUrl);
      } else if (data.error === 'Recording already exists') {
        // Another student already uploaded — that's fine
        setUploadStatus('uploaded');
        console.log('[ClassRecorder] Recording already uploaded by another student');
      } else {
        console.error('[ClassRecorder] Upload failed:', data.error);
        setUploadStatus('error');
      }
    } catch (err) {
      console.error('[ClassRecorder] Upload error:', err);
      setUploadStatus('error');
    }
  }, [roomId]);

  // ── Auto-start when session goes live + screen share available ──
  useEffect(() => {
    if (isLive && !startedRef.current && screenVideoEl && screenVideoEl.readyState >= 2) {
      startRecording();
    }
  }, [isLive, screenVideoEl, startRecording]);

  // Retry start when screen video becomes ready
  useEffect(() => {
    if (!isLive || startedRef.current || !screenVideoEl) return;
    const onReady = () => {
      if (!startedRef.current) startRecording();
    };
    screenVideoEl.addEventListener('loadeddata', onReady);
    return () => screenVideoEl.removeEventListener('loadeddata', onReady);
  }, [isLive, screenVideoEl, startRecording]);

  // ── Auto-stop + upload when room ends ───────────────────
  useEffect(() => {
    if (roomEnded && startedRef.current) {
      stopRecording();
      // Set uploading immediately so consumer knows to wait
      setUploadStatus('uploading');
      // Small delay to let final chunks arrive via ondataavailable
      setTimeout(() => {
        if (chunksRef.current.length > 0) {
          uploadRecording();
        } else {
          // Nothing recorded — reset status
          setUploadStatus('idle');
        }
      }, 500);
    }
  }, [roomEnded, stopRecording, uploadRecording]);

  // ── Cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (drawTimerRef.current) clearInterval(drawTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    };
  }, []);

  return { isRecording, wasStarted, uploadStatus };
}
