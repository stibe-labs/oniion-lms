// ═══════════════════════════════════════════════════════════════
// stibe Portal — AI Attention Monitor Hook v3
// ═══════════════════════════════════════════════════════════════
// Classroom-aware student engagement monitoring.
//
// v3 Redesign: Models real student behavior in a live class:
//  - Students naturally look down to write notes (head pitch ≤35°)
//  - Brief glances sideways, yawns, or blinks are normal
//  - Only SUSTAINED off-states (>3s) are flagged as problems
//  - Head-down + eyes-down = note-taking (not distraction)
//  - Context-aware scoring: engagement vs distraction patterns
//
// Pipeline:
//  1. MediaPipe FaceLandmarker detects face + blendshapes (1.5s)
//  2. Raw metrics extracted (blink, gaze, head pose, jaw)
//  3. Context classifier decides if behavior is engaged or not
//  4. Score computed with temporal smoothing (sustained states only)
//  5. Broadcast via LiveKit data channel + batched server events
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE_PATH = '/mediapipe';
const FACE_LANDMARK_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

// ── Tuning constants ────────────────────────────────────────
const DETECTION_INTERVAL = 1500;      // ms between detections
const SERVER_SEND_INTERVAL = 30_000;  // batch events to server every 30s
const SCORE_WINDOW = 40;              // rolling window (~60s at 1.5s interval)
const INACTIVITY_TIMEOUT = 300_000;   // 5 min without mouse/key = inactive (liberal — short pauses normal)

// Blendshape thresholds (0–1 range from MediaPipe)
const EYE_BLINK_THRESHOLD = 0.55;    // both eyes closed
const GAZE_AWAY_THRESHOLD = 0.4;     // looking away from center (relaxed from 0.35)
const JAW_OPEN_THRESHOLD = 0.6;      // yawning (raised from 0.55 — less sensitive)

// Head pose thresholds — classroom-aware
// Students regularly tilt head 15-30° to write notes or read
const HEAD_YAW_THRESHOLD = 35;       // degrees sideways
const HEAD_PITCH_THRESHOLD = 30;     // degrees up/down

// v3.1 — stricter writing posture (was -10 which triggered too easily)
// Real note-taking requires clear head-down tilt AND eyes looking down
const NOTE_TAKING_PITCH_MIN = -15;   // head must be ≥ 15° down
const NOTE_TAKING_PITCH_MAX = -45;   // but not more than 45° (too far = lying down)
const NOTE_TAKING_YAW_MAX = 15;      // head must be roughly centered (not turned)
const NOTE_TAKING_EYES_DOWN_THRESHOLD = 0.25; // eyesDown blendshape required

// Thinking / reflection posture (head slightly up or eyes looking up briefly)
const THINKING_PITCH_MIN = 8;        // head tilted up ≥8°
const THINKING_PITCH_MAX = 25;       // but not staring at ceiling
const THINKING_EYES_UP_THRESHOLD = 0.35;

// Reading-material posture (head mildly down, eyes down, sustained) — same detection as writing
// but labeled differently if sustained >20s without absence
const READING_SUSTAINED_TICKS = 14;  // ~21s of continuous head-down = reading

// Mobile-relaxed thresholds (applied when device is mobile)
const HEAD_YAW_MOBILE = 45;
const HEAD_PITCH_MOBILE = 40;

// Temporal gating — how many consecutive detections before flagging
// At 1.5s intervals: 2 = 3s, 4 = 6s, 8 = 12s, 10 = 15s
// v4 LIBERAL: real students look around, yawn, glance away — only sustained issues matter
const SUSTAINED_HEAD_COUNT = 8;      // ~12s before head_turned counts (was 3)
const SUSTAINED_EYES_COUNT = 6;      // ~9s before eyes_closed counts (was 2) — blinks are normal
const SUSTAINED_GAZE_COUNT = 8;      // ~12s before looking_away counts (was 3) — glances normal
const SUSTAINED_YAWN_COUNT = 10;     // ~15s yawning is normal classroom behavior (was 3)
const SUSTAINED_MULTI_FACE_COUNT = 6; // ~9s — ignore someone walking by (was 4)
const SUSTAINED_WRITING_COUNT = 2;   // ~3s of head-down posture before label fires
const SUSTAINED_THINKING_COUNT = 1;  // ~1.5s — thinking is brief by nature

// ── v4 Liberal absence gating ──────────────────────────────
// Real students step away briefly, adjust camera, pick up pen, etc.
//   0–8 ticks  (0–12s):  completely ignored — micro-absence
//   8–12 ticks (12–18s): writing_notes (if writing session active)
//   8–40 ticks (12–60s): brief_absence (neutral — student just stepped back)
//   40+ ticks  (>60s):   not_in_frame (genuine sustained absence)
const ABSENCE_MICRO_TICKS = 8;       // <12s — ignore completely (was 4)
const ABSENCE_WRITING_TICKS = 12;    // 12–18s — writing_notes (was 10)
const ABSENCE_BRIEF_TICKS = 40;      // 12–60s — neutral brief_absence (was 20)
// Mobile tolerance: even longer before hard flag
const ABSENCE_HARD_MOBILE_TICKS = 60;

// Writing-session context: if student entered note-taking state ≥3 times
// in last 90s, unlock absence-tolerance + score maintenance for the next window.
// NOTE (v3.1): writing session NO LONGER overrides the label when face is visible.
// It only affects (a) absence gating (notebook raised = writing, not away) and
// (b) score maintenance (don't decay score while writing in progress).
const WRITING_SESSION_WINDOW_MS = 90_000;
const WRITING_SESSION_ENTRIES_NEEDED = 3;
const WRITING_SESSION_DURATION_MS = 180_000; // 3 min absence-tolerance window
const WRITING_SESSION_SCORE_FLOOR = 80;      // min score during writing session (raised from 65)

// Low-visibility detection
const LOW_VISIBILITY_WINDOW = 20;    // rolling 30s of confidence samples
const LOW_VISIBILITY_THRESHOLD = 0.45;

// Score carry-forward decay (per tick while face absent):
//   micro-absence (<12s): 0 — no penalty at all
//   brief-absence (12–60s): 1 — very slow decay
//   sustained (>60s): 4 — meaningful decay
const CARRY_FORWARD_DECAY = 4;              // used for sustained absence >60s (was 5)
const CARRY_FORWARD_DECAY_BRIEF = 1;        // used for brief absence 12–60s
const CARRY_FORWARD_DECAY_WRITING = 1;      // writing session — same as brief

// ── Types ───────────────────────────────────────────────────

export type MonitorEventType =
  | 'attentive'
  | 'looking_away'
  | 'eyes_closed'
  | 'not_in_frame'
  | 'low_engagement'
  | 'distracted'
  | 'tab_switched'
  | 'multiple_faces'
  | 'yawning'
  | 'inactive'
  | 'head_turned'
  | 'in_exam'
  // v3 positive/neutral states
  | 'writing_notes'
  | 'brief_absence'
  | 'low_visibility'
  // v3.1 additions
  | 'thinking'          // brief head-up / eyes-up reflection
  | 'reading_material'; // sustained head-down reading (not writing)

export interface AttentionData {
  attentionScore: number;       // 0-100
  isAttentive: boolean;
  faceDetected: boolean;
  faceCount: number;
  lastCheck: number;
  monitorState: MonitorEventType;
  // Rich details
  eyesClosed: boolean;
  gazeAway: boolean;
  headYaw: number;
  headPitch: number;
  yawning: boolean;
  tabVisible: boolean;
  isInactive: boolean;
  isMobile: boolean;
}

export interface MonitorConfig {
  roomId: string;
  sessionId?: string;
  /** v3 — overrides from Academic Operator "monitoring_tuning" settings */
  tuning?: {
    writing_aware_mode?: boolean;       // default true — treat note-taking as engaged
    mobile_relaxed_thresholds?: boolean; // default true — relax thresholds on mobile
    exam_strict_mode?: boolean;          // default false — disable writing-aware during exams
    low_visibility_fallback?: boolean;   // default true — emit low_visibility instead of noise
  };
  /** When true, hook treats current session as an exam (applies strict mode regardless of AO setting) */
  inExam?: boolean;
}

interface MonitorEventBatch {
  event_type: MonitorEventType;
  confidence: number;
  duration_seconds: number;
  details?: Record<string, unknown>;
}

// ── Blendshape lookup helper ────────────────────────────────

function getBlendshape(
  categories: Array<{ categoryName?: string; displayName?: string; score: number }>,
  name: string,
): number {
  const cat = categories.find(c => (c.categoryName || c.displayName) === name);
  return cat?.score ?? 0;
}

// ── Euler angles from 4×4 transformation matrix ─────────────

function eulerFromMatrix(m: { rows: number; columns: number; data: number[] }): { yaw: number; pitch: number; roll: number } {
  const d = m.data;
  if (!d || d.length < 16) return { yaw: 0, pitch: 0, roll: 0 };

  const r00 = d[0], r10 = d[4], r20 = d[8];
  const r21 = d[9], r22 = d[10];

  const RAD2DEG = 180 / Math.PI;
  const pitch = Math.asin(-clamp(r20, -1, 1)) * RAD2DEG;
  const yaw = Math.atan2(r10, r00) * RAD2DEG;
  const roll = Math.atan2(r21, r22) * RAD2DEG;

  return { yaw, pitch, roll };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Detect mobile device ────────────────────────────────────

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

// ═══════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════

export function useAttentionMonitor(
  videoElement: HTMLVideoElement | null,
  onAttentionUpdate?: (data: AttentionData) => void,
  enabled: boolean = true,
  monitorConfig?: MonitorConfig,
) {
  const [attentionScore, setAttentionScore] = useState(100);
  const [isAttentive, setIsAttentive] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [monitorState, setMonitorState] = useState<MonitorEventType>('attentive');

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoresRef = useRef<number[]>([]);

  // Server monitoring: state tracking & batched events
  const lastMonitorStateRef = useRef<MonitorEventType>('attentive');
  const lastMonitorStateStartRef = useRef<number>(Date.now());
  const pendingEventsRef = useRef<MonitorEventBatch[]>([]);

  // Sustained state counters — incremented each detection, reset when state changes
  const sustainedHeadRef = useRef(0);   // consecutive head_turned detections
  const sustainedEyesRef = useRef(0);   // consecutive eyes_closed detections
  const sustainedGazeRef = useRef(0);   // consecutive looking_away detections
  const sustainedYawnRef = useRef(0);   // consecutive yawning detections
  const sustainedMultiFaceRef = useRef(0); // consecutive multi-face detections

  // v3 — Absence tracking (face not detected)
  const absenceTicksRef = useRef(0);     // consecutive ticks with no face
  const lastKnownScoreRef = useRef(100); // last score while face was visible
  const carryForwardRef = useRef(100);   // decaying score during absence

  // v3 — Writing session context
  // Track timestamps of recent "note-taking entry" events (head-down while face visible)
  const writingEntriesRef = useRef<number[]>([]);
  const writingSessionUntilRef = useRef<number>(0); // epoch ms when writing session expires

  // v3.1 — Sustained posture trackers
  const sustainedWritingRef = useRef(0);  // consecutive ticks in note-taking posture
  const sustainedThinkingRef = useRef(0); // consecutive ticks in thinking posture
  const lastWritingPostureAtRef = useRef(0); // epoch ms of last head-down detection

  // v3 — Confidence samples for low-visibility detection
  const confidenceSamplesRef = useRef<number[]>([]);

  // Tab visibility tracking
  const tabVisibleRef = useRef(true);
  const tabSwitchCountRef = useRef(0);
  const lastTabHiddenRef = useRef<number>(0);
  const tabAwaySecondsRef = useRef(0);

  // Inactivity tracking
  const lastActivityRef = useRef<number>(Date.now());
  const isInactiveRef = useRef(false);

  // Device detection
  const isMobileRef = useRef(false);

  // ── Initialize FaceLandmarker ──────────────────────────────

  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return;
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARK_MODEL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 3,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      landmarkerRef.current = landmarker;
    } catch (err) {
      console.warn('[attention] Failed to init FaceLandmarker:', err);
    }
  }, []);

  // ── Send batched events to server ──────────────────────────

  const sendMonitoringEvents = useCallback(async () => {
    if (!monitorConfig?.roomId) return;

    // Flush current state duration
    const now = Date.now();
    const currentDuration = Math.round((now - lastMonitorStateStartRef.current) / 1000);
    if (currentDuration > 0) {
      pendingEventsRef.current.push({
        event_type: lastMonitorStateRef.current,
        confidence: 90,
        duration_seconds: currentDuration,
      });
      lastMonitorStateStartRef.current = now;
    }

    // Include tab-away time if significant
    if (tabAwaySecondsRef.current > 0) {
      pendingEventsRef.current.push({
        event_type: 'tab_switched',
        confidence: 100,
        duration_seconds: tabAwaySecondsRef.current,
        details: { switch_count: tabSwitchCountRef.current },
      });
      tabAwaySecondsRef.current = 0;
      tabSwitchCountRef.current = 0;
    }

    const events = [...pendingEventsRef.current];
    if (events.length === 0) return;
    pendingEventsRef.current = [];

    try {
      await fetch('/api/v1/monitoring/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: monitorConfig.roomId,
          session_id: monitorConfig.sessionId,
          events,
        }),
      });
    } catch {
      pendingEventsRef.current.unshift(...events);
    }
  }, [monitorConfig]);

  // ── Classify state — classroom-aware with temporal gating ───
  //
  // v3.1 Real classroom behavior modeling:
  //  - Writing = head clearly tilted down (≥15°) + eyes looking down + yaw centered
  //    AND sustained ≥3s (not instant) — prevents flicker and false positives
  //  - Thinking = head slightly up or eyes looking up, brief (<3s) — positive
  //  - Reading material = sustained head-down (>21s) without absence — positive
  //  - Writing session: only affects absence-labeling & score-maintain, does NOT
  //    override the label when the student is clearly looking at the screen
  //  - Brief glances sideways / yawns / blinks → normal, not flagged
  //  - Only SUSTAINED off-states (multiple consecutive detections) matter
  //  - Head-sideways + NOT looking at screen = actual distraction

  const classifyState = useCallback((
    faceCount: number,
    eyesClosed: boolean,
    gazeAway: boolean,
    headYaw: number,
    headPitch: number,
    yawning: boolean,
    tabVisible: boolean,
    isInactive: boolean,
    score: number,
    eyesDownward: boolean,
    eyesUpward: boolean,
    avgConfidence: number,
  ): MonitorEventType => {
    const now = Date.now();
    const tuning = monitorConfig?.tuning || {};
    const writingAware = tuning.writing_aware_mode !== false; // default true
    const mobileRelaxed = tuning.mobile_relaxed_thresholds !== false; // default true
    const lowVisFallback = tuning.low_visibility_fallback !== false; // default true
    const strictMode = tuning.exam_strict_mode === true || monitorConfig?.inExam === true;

    // Apply device-relaxed thresholds if mobile + relaxed-mode
    const isMobile = isMobileRef.current && mobileRelaxed && !strictMode;
    const yawLimit = isMobile ? HEAD_YAW_MOBILE : HEAD_YAW_THRESHOLD;
    const pitchLimit = isMobile ? HEAD_PITCH_MOBILE : HEAD_PITCH_THRESHOLD;
    const absenceHardLimit = isMobile ? ABSENCE_HARD_MOBILE_TICKS : ABSENCE_BRIEF_TICKS;

    // Is the session currently within a "writing session" absence-tolerance window?
    const inWritingSession = writingAware && !strictMode && now < writingSessionUntilRef.current;

    // Tab switch is always immediate (anti-cheat signal)
    if (!tabVisible) return 'tab_switched';

    // ── v3: Temporal gating on no-face (writing-aware absence) ──
    if (faceCount === 0) {
      absenceTicksRef.current++;
      // Reset active-face sustained counters — stale data
      sustainedHeadRef.current = 0;
      sustainedGazeRef.current = 0;
      sustainedYawnRef.current = 0;
      sustainedEyesRef.current = 0;
      sustainedWritingRef.current = 0;
      sustainedThinkingRef.current = 0;

      // Micro absence: ignore (keep last state)
      if (absenceTicksRef.current <= ABSENCE_MICRO_TICKS) {
        return lastMonitorStateRef.current;
      }

      // Absence while in writing session OR immediately after writing posture (<15s ago)
      // → label as writing_notes (student lowered notebook / hand to write)
      const recentlyWriting = writingAware && !strictMode
        && now - lastWritingPostureAtRef.current < 15_000;
      if (writingAware && !strictMode
          && (inWritingSession || recentlyWriting)
          && absenceTicksRef.current <= ABSENCE_WRITING_TICKS) {
        return 'writing_notes';
      }

      // 3–15s absence (or 3–33s on mobile) — neutral brief absence
      if (absenceTicksRef.current <= absenceHardLimit) {
        return 'brief_absence';
      }

      // Sustained absence — genuine not_in_frame
      return 'not_in_frame';
    }

    // Face is present — reset absence counter
    absenceTicksRef.current = 0;

    // Multi-face requires sustained detection (avoid sibling-walk-by false positives)
    if (faceCount > 1) {
      sustainedMultiFaceRef.current++;
      if (sustainedMultiFaceRef.current >= SUSTAINED_MULTI_FACE_COUNT) return 'multiple_faces';
      return lastMonitorStateRef.current === 'multiple_faces' ? 'multiple_faces' : 'attentive';
    }
    sustainedMultiFaceRef.current = 0;

    // ── Low-visibility detection (camera/lighting issue, not behavior) ──
    if (lowVisFallback && !strictMode && confidenceSamplesRef.current.length >= 10) {
      if (avgConfidence < LOW_VISIBILITY_THRESHOLD) return 'low_visibility';
    }

    // ── v3.1 STRICTER POSTURE DETECTION ──

    // Writing posture: head clearly down (≥15°) + eyes down + yaw centered (ALL required)
    const isWritingPosture = writingAware && !strictMode
      && headPitch <= NOTE_TAKING_PITCH_MIN
      && headPitch >= NOTE_TAKING_PITCH_MAX
      && Math.abs(headYaw) <= NOTE_TAKING_YAW_MAX
      && eyesDownward;

    // Thinking posture: brief head-up OR pure eyes-up (without horizontal gaze)
    const isThinkingPosture = writingAware && !strictMode
      && !isWritingPosture
      && (
        (headPitch >= THINKING_PITCH_MIN && headPitch <= THINKING_PITCH_MAX && Math.abs(headYaw) < 20)
        || (eyesUpward && !gazeAway && Math.abs(headYaw) < 20)
      );

    // Track sustained writing posture
    if (isWritingPosture) {
      sustainedWritingRef.current++;
      lastWritingPostureAtRef.current = now;
      // Record entry once per sustained session
      if (sustainedWritingRef.current === SUSTAINED_WRITING_COUNT) {
        writingEntriesRef.current.push(now);
        writingEntriesRef.current = writingEntriesRef.current.filter(
          t => now - t < WRITING_SESSION_WINDOW_MS,
        );
        if (writingEntriesRef.current.length >= WRITING_SESSION_ENTRIES_NEEDED) {
          writingSessionUntilRef.current = now + WRITING_SESSION_DURATION_MS;
        }
      }
    } else {
      sustainedWritingRef.current = 0;
    }

    if (isThinkingPosture) sustainedThinkingRef.current++;
    else sustainedThinkingRef.current = 0;

    // ── Temporal gating: sustained off-states ──
    const headOff = Math.abs(headYaw) > yawLimit || Math.abs(headPitch) > pitchLimit;

    if (eyesClosed) sustainedEyesRef.current++;
    else sustainedEyesRef.current = 0;

    // Don't count head-off or gaze-away against students in writing/thinking posture
    if (headOff && !isWritingPosture && !isThinkingPosture) sustainedHeadRef.current++;
    else sustainedHeadRef.current = 0;

    if (gazeAway && !isWritingPosture && !isThinkingPosture) sustainedGazeRef.current++;
    else sustainedGazeRef.current = 0;

    if (yawning) sustainedYawnRef.current++;
    else sustainedYawnRef.current = 0;

    // ── Classification order (highest priority first) ──
    if (sustainedEyesRef.current >= SUSTAINED_EYES_COUNT) return 'eyes_closed';
    if (sustainedHeadRef.current >= SUSTAINED_HEAD_COUNT) return 'head_turned';
    if (sustainedGazeRef.current >= SUSTAINED_GAZE_COUNT) return 'looking_away';
    if (sustainedYawnRef.current >= SUSTAINED_YAWN_COUNT) return 'yawning';

    // Reading vs writing: sustained head-down for >21s = reading material
    if (sustainedWritingRef.current >= READING_SUSTAINED_TICKS) return 'reading_material';

    // Active note-taking (head clearly down + sustained 3s)
    if (sustainedWritingRef.current >= SUSTAINED_WRITING_COUNT) return 'writing_notes';

    // Thinking (head slightly up / eyes up briefly)
    if (sustainedThinkingRef.current >= SUSTAINED_THINKING_COUNT
        && sustainedThinkingRef.current < 4 /* >6s = looking up = distraction */) {
      return 'thinking';
    }

    if (isInactive) return 'inactive';
    if (score < 40) return 'low_engagement';
    if (score < 50) return 'distracted';
    return 'attentive';
  }, [monitorConfig]);

  // ── Track state transitions for batched server events ──────

  const trackStateTransition = useCallback((newState: MonitorEventType) => {
    if (newState !== lastMonitorStateRef.current) {
      const durationSec = Math.round((Date.now() - lastMonitorStateStartRef.current) / 1000);
      if (durationSec > 0) {
        pendingEventsRef.current.push({
          event_type: lastMonitorStateRef.current,
          confidence: 90,
          duration_seconds: durationSec,
        });
      }
      lastMonitorStateRef.current = newState;
      lastMonitorStateStartRef.current = Date.now();
    }
  }, []);

  // ── Run detection ──────────────────────────────────────────

  const runDetection = useCallback(() => {
    if (!landmarkerRef.current || !videoElement) return;
    if (videoElement.readyState < 2) return;

    const tabVisible = tabVisibleRef.current;
    const isInactive = isInactiveRef.current;

    // If tab is hidden, skip face detection — just report tab_switched
    // v4: push 30 (not 0) — tab switch is bad but doesn't mean 100% disengaged
    // (student might have their textbook as another tab, etc.)
    if (!tabVisible) {
      scoresRef.current.push(30);
      if (scoresRef.current.length > SCORE_WINDOW) scoresRef.current = scoresRef.current.slice(-SCORE_WINDOW);
      const avg = scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length;
      const score = Math.round(avg);
      setAttentionScore(score);
      setIsAttentive(false);
      setFaceDetected(false);
      setMonitorState('tab_switched');
      trackStateTransition('tab_switched');
      onAttentionUpdate?.({
        attentionScore: score, isAttentive: false, faceDetected: false,
        faceCount: 0, lastCheck: Date.now(), monitorState: 'tab_switched',
        eyesClosed: false, gazeAway: false, headYaw: 0, headPitch: 0,
        yawning: false, tabVisible: false, isInactive, isMobile: isMobileRef.current,
      });
      return;
    }

    try {
      const result = landmarkerRef.current.detectForVideo(videoElement, Date.now());
      const faceCount = result.faceLandmarks?.length ?? 0;

      let eyesClosed = false;
      let gazeAway = false;
      let headYaw = 0;
      let headPitch = 0;
      let yawning = false;
      let eyesDownward = false;
      let eyesUpward = false;
      let faceScore = 0;
      let frameConfidence = 0; // average detection confidence for this frame

      if (faceCount > 0) {
        setFaceDetected(true);

        // Analyze primary face (index 0)
        const blendshapes = result.faceBlendshapes?.[0]?.categories;
        // MediaPipe doesn't directly expose face detection confidence per-frame in FaceLandmarker,
        // but blendshape presence is a strong proxy. Treat "blendshapes present" as high confidence.
        frameConfidence = blendshapes && blendshapes.length > 0 ? 0.9 : 0.5;
        if (blendshapes && blendshapes.length > 0) {
          // Eye closure
          const blinkL = getBlendshape(blendshapes, 'eyeBlinkLeft');
          const blinkR = getBlendshape(blendshapes, 'eyeBlinkRight');
          eyesClosed = blinkL > EYE_BLINK_THRESHOLD && blinkR > EYE_BLINK_THRESHOLD;

          // Gaze direction
          const lookOutL = getBlendshape(blendshapes, 'eyeLookOutLeft');
          const lookOutR = getBlendshape(blendshapes, 'eyeLookOutRight');
          const lookUpL = getBlendshape(blendshapes, 'eyeLookUpLeft');
          const lookUpR = getBlendshape(blendshapes, 'eyeLookUpRight');
          const lookDownL = getBlendshape(blendshapes, 'eyeLookDownLeft');
          const lookDownR = getBlendshape(blendshapes, 'eyeLookDownRight');
          const maxHoriz = Math.max(lookOutL, lookOutR);
          const maxUp = Math.max(lookUpL, lookUpR);
          // Looking DOWN is normal (note-taking) — only horizontal + upward = away
          gazeAway = maxHoriz > GAZE_AWAY_THRESHOLD || maxUp > GAZE_AWAY_THRESHOLD;

          // Eyes looking down — note-taking indicator
          eyesDownward = Math.max(lookDownL, lookDownR) > NOTE_TAKING_EYES_DOWN_THRESHOLD;
          // Eyes looking up — thinking indicator (without horizontal gaze)
          eyesUpward = maxUp > THINKING_EYES_UP_THRESHOLD && maxHoriz < 0.3;

          // Yawning vs. eating/drinking: require jaw open + NOT rapidly moving head horizontally
          // (a student sipping water typically tilts head up, moves jaw — a yawn is still)
          const jawOpen = getBlendshape(blendshapes, 'jawOpen');
          const mouthFunnel = getBlendshape(blendshapes, 'mouthFunnel');
          const mouthPucker = getBlendshape(blendshapes, 'mouthPucker');
          // Drinking/eating has funnel/pucker shape — suppress yawn flag in that case
          const isDrinkingShape = mouthFunnel > 0.3 || mouthPucker > 0.3;
          yawning = jawOpen > JAW_OPEN_THRESHOLD && !isDrinkingShape;

          // ── v4 Liberal classroom scoring (0-100) ──
          // Only sustained eyes-closed matters; gaze and jaw have minimal impact
          // (looking around and yawning are completely normal classroom behaviors)
          const blinkPenalty = eyesClosed ? Math.max(blinkL, blinkR) * 25 : 0;
          const horizGaze = maxHoriz > GAZE_AWAY_THRESHOLD ? (maxHoriz - GAZE_AWAY_THRESHOLD) * 8 : 0;  // was ×30 — gaze barely penalizes
          const jawPenalty = yawning ? (jawOpen - JAW_OPEN_THRESHOLD) * 10 : 0;  // was ×20
          faceScore = Math.max(0, Math.round(100 - blinkPenalty - horizGaze - jawPenalty));
        } else {
          faceScore = 75; // fallback if no blendshapes — assume engaged
        }

        // Head pose from transformation matrix
        const matrix = result.facialTransformationMatrixes?.[0];
        if (matrix) {
          const euler = eulerFromMatrix(matrix);
          headYaw = Math.round(euler.yaw);
          headPitch = Math.round(euler.pitch);

          // ── Classroom-aware head penalty ──
          const absYaw = Math.abs(euler.yaw);
          const absPitch = Math.abs(euler.pitch);
          // Note-taking zone: clearly head-down (≥15°), yaw centered, and eyes looking down
          const isInNoteTakingZone = euler.pitch <= NOTE_TAKING_PITCH_MIN
            && euler.pitch >= NOTE_TAKING_PITCH_MAX
            && absYaw <= NOTE_TAKING_YAW_MAX
            && eyesDownward;

          if (isInNoteTakingZone) {
            // Active note-taking — reward with high engagement score
            faceScore = Math.max(faceScore, 90);
          } else {
            // v4: very small head penalty — turning head is normal (reaching, adjusting, talking)
            const yawExcess = Math.max(0, absYaw - 20);
            const pitchExcess = Math.max(0, absPitch - 20);
            const headPenalty = Math.min(8, (yawExcess + pitchExcess) * 0.1);  // was min(25, ×0.4)
            faceScore = Math.max(0, faceScore - Math.round(headPenalty));
          }
        }

        if (faceCount > 1) faceScore = Math.max(0, faceScore - 20);
        if (isInactive) faceScore = Math.max(0, faceScore - 15);

        // Cache last-known score & reset carry-forward
        lastKnownScoreRef.current = faceScore;
        carryForwardRef.current = faceScore;
      } else {
        setFaceDetected(false);
        frameConfidence = 0;

        // v3.1 — Smart carry-forward during absence.
        // If we're within a writing session OR writing posture was active in the
        // last 15s, the student is likely still engaged (just out of frame while
        // writing). Decay very slowly. Otherwise decay normally.
        const tuningCF = monitorConfig?.tuning || {};
        const writingAwareCF = tuningCF.writing_aware_mode !== false;
        const strictCF = tuningCF.exam_strict_mode === true || monitorConfig?.inExam === true;
        const now = Date.now();
        const inWritingSession = writingAwareCF && !strictCF && now < writingSessionUntilRef.current;
        const recentlyWriting = writingAwareCF && !strictCF
          && now - lastWritingPostureAtRef.current < 15_000;

        // v4 Tiered absence decay:
        //   micro (<12s): no penalty — natural short-term absence
        //   brief (12–60s): very slow decay — student just stepped back
        //   sustained (>60s): normal decay — genuine absence
        let decay: number;
        if (inWritingSession || recentlyWriting) {
          decay = CARRY_FORWARD_DECAY_WRITING;
        } else if (absenceTicksRef.current < ABSENCE_MICRO_TICKS) {
          decay = 0;  // micro-absence: no score penalty at all
        } else if (absenceTicksRef.current < ABSENCE_BRIEF_TICKS) {
          decay = CARRY_FORWARD_DECAY_BRIEF;  // brief absence: very slow
        } else {
          decay = CARRY_FORWARD_DECAY;  // sustained absence: meaningful decay
        }
        carryForwardRef.current = Math.max(0, carryForwardRef.current - decay);
        faceScore = carryForwardRef.current;
      }

      // Track confidence samples for low-visibility detection
      confidenceSamplesRef.current.push(frameConfidence);
      if (confidenceSamplesRef.current.length > LOW_VISIBILITY_WINDOW) {
        confidenceSamplesRef.current = confidenceSamplesRef.current.slice(-LOW_VISIBILITY_WINDOW);
      }
      const avgConfidence = confidenceSamplesRef.current.reduce((a, b) => a + b, 0)
        / Math.max(1, confidenceSamplesRef.current.length);

      // Update rolling score window
      scoresRef.current.push(faceScore);
      if (scoresRef.current.length > SCORE_WINDOW) {
        scoresRef.current = scoresRef.current.slice(-SCORE_WINDOW);
      }

      let avg = scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length;

      // v3 — Writing session score floor
      const tuning = monitorConfig?.tuning || {};
      const writingAware = tuning.writing_aware_mode !== false;
      const strictMode = tuning.exam_strict_mode === true || monitorConfig?.inExam === true;
      const inWritingSession = writingAware && !strictMode && Date.now() < writingSessionUntilRef.current;
      if (inWritingSession && avg < WRITING_SESSION_SCORE_FLOOR) {
        avg = WRITING_SESSION_SCORE_FLOOR;
      }

      const score = Math.round(avg);
      const attentive = score >= 50;

      setAttentionScore(score);
      setIsAttentive(attentive);

      const curState = classifyState(
        faceCount, eyesClosed, gazeAway, headYaw, headPitch,
        yawning, tabVisible, isInactive, score, eyesDownward, eyesUpward,
        avgConfidence,
      );
      setMonitorState(curState);
      trackStateTransition(curState);

      onAttentionUpdate?.({
        attentionScore: score, isAttentive: attentive, faceDetected: faceCount > 0,
        faceCount, lastCheck: Date.now(), monitorState: curState,
        eyesClosed, gazeAway, headYaw, headPitch,
        yawning, tabVisible, isInactive, isMobile: isMobileRef.current,
      });
    } catch {
      // Silently skip detection errors
    }
  }, [videoElement, onAttentionUpdate, classifyState, trackStateTransition, monitorConfig]);

  // ── Tab Visibility / Focus tracking ────────────────────────

  useEffect(() => {
    if (!enabled) return;
    isMobileRef.current = detectMobile();

    const onVisChange = () => {
      const visible = !document.hidden;
      if (!visible && tabVisibleRef.current) {
        lastTabHiddenRef.current = Date.now();
        tabSwitchCountRef.current++;
      } else if (visible && !tabVisibleRef.current && lastTabHiddenRef.current > 0) {
        const awaySec = Math.round((Date.now() - lastTabHiddenRef.current) / 1000);
        tabAwaySecondsRef.current += awaySec;
      }
      tabVisibleRef.current = visible;
    };

    const onFocusChange = () => {
      if (!document.hasFocus() && tabVisibleRef.current) {
        lastTabHiddenRef.current = Date.now();
        tabSwitchCountRef.current++;
        tabVisibleRef.current = false;
      } else if (document.hasFocus() && !tabVisibleRef.current) {
        const awaySec = Math.round((Date.now() - lastTabHiddenRef.current) / 1000);
        tabAwaySecondsRef.current += awaySec;
        tabVisibleRef.current = true;
      }
    };

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onFocusChange);
    window.addEventListener('focus', onFocusChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', onFocusChange);
      window.removeEventListener('focus', onFocusChange);
    };
  }, [enabled]);

  // ── User inactivity tracking ──────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      isInactiveRef.current = false;
    };

    const checkInactivity = setInterval(() => {
      isInactiveRef.current = Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT;
    }, 10_000);

    document.addEventListener('mousemove', resetActivity, { passive: true });
    document.addEventListener('keydown', resetActivity, { passive: true });
    document.addEventListener('touchstart', resetActivity, { passive: true });
    document.addEventListener('scroll', resetActivity, { passive: true });

    return () => {
      clearInterval(checkInactivity);
      document.removeEventListener('mousemove', resetActivity);
      document.removeEventListener('keydown', resetActivity);
      document.removeEventListener('touchstart', resetActivity);
      document.removeEventListener('scroll', resetActivity);
    };
  }, [enabled]);

  // ── Main lifecycle ─────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !videoElement) return;

    initLandmarker();
    intervalRef.current = setInterval(runDetection, DETECTION_INTERVAL);

    if (monitorConfig?.roomId) {
      sendIntervalRef.current = setInterval(sendMonitoringEvents, SERVER_SEND_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      sendMonitoringEvents();
    };
  }, [enabled, videoElement, initLandmarker, runDetection, monitorConfig, sendMonitoringEvents]);

  return { attentionScore, isAttentive, faceDetected, monitorState };
}

// ═══════════════════════════════════════════════════════════════
// DATA CHANNEL TYPES
// ═══════════════════════════════════════════════════════════════

export const ATTENTION_TOPIC = 'attention_update';

export interface AttentionMessage {
  type: 'attention_update';
  studentEmail: string;
  studentName: string;
  attentionScore: number;
  isAttentive: boolean;
  faceDetected: boolean;
  faceCount: number;
  monitorState: MonitorEventType;
  eyesClosed: boolean;
  gazeAway: boolean;
  headYaw: number;
  headPitch: number;
  yawning: boolean;
  tabVisible: boolean;
  isInactive: boolean;
  isMobile: boolean;
  timestamp: number;
}
