'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useParticipants,
  useTracks,
  useDataChannel,
  useRoomContext,
  useAudioPlayback,
  VideoTrack,
  AudioTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track, VideoQuality, ConnectionQuality, ConnectionState, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import VideoTile from './VideoTile';
import VideoQualitySelector, { type VideoQualityOption, QUALITY_MAP } from './VideoQualitySelector';
import WhiteboardComposite from './WhiteboardComposite';
import StudentSidePanel from './StudentSidePanel';
import FeedbackDialog from './FeedbackDialog';
import ReportTeacherDialog from './ReportTeacherDialog';
import DemoExamDialog from './DemoExamDialog';
import SessionExamDialog from './SessionExamDialog';
import SessionExamClient from '@/app/session-exam/[topicId]/SessionExamClient';
import TimeWarningDialog from './TimeWarningDialog';
import { useTeacherOverlay } from '@/hooks/useTeacherOverlay';
import { cn } from '@/lib/utils';
import { safePublish } from '@/lib/livekit-safe-publish';
import {
  MicOnIcon, MicOffIcon,
  CameraOnIcon, CameraOffIcon,
  HandRaiseIcon,
  HandRaisedIcon,
  ChatIcon,
  LeaveIcon,
} from './icons';

/**
 * StudentView — YouTube-fullscreen-style immersive classroom.
 *
 * The whiteboard / teacher video fills the ENTIRE screen.
 * All UI — header info, controls, PIPs, chat — float as overlays
 * that auto-hide after 3 seconds of inactivity.
 * Tap / move mouse anywhere to reveal overlays.
 *
 * Features:
 *   - Browser Fullscreen API on entry (with fallback)
 *   - 100% viewport content — no layout chrome
 *   - Overlay header: room name + LIVE badge + countdown + participants
 *   - Overlay controls: Google Meet-style bottom bar
 *   - Floating teacher PIP + self-cam PIP (fade with overlays)
 *   - Chat slides from right (keeps overlays visible while open)
 *   - CSS landscape rotation for mobile portrait
 *   - Cross-browser: Chrome, Safari, Firefox, Edge, mobile, desktop
 */

export interface StudentViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
  scheduledStart: string;
  durationMinutes: number;
  topic?: string;
  isRejoin?: boolean;
  observeOnly?: boolean; // Parent observe mode — no mic/cam/chat/hand-raise
  onLeave: () => void;
  onTimeExpired?: () => void;
  onDurationUpdate?: (newDurationMinutes: number) => void;
}

// ─── helpers ──────────────────────────────────────────────
function isTeacherPrimary(p: RemoteParticipant): boolean {
  try {
    const m = JSON.parse(p.metadata || '{}');
    // If metadata has role info, use it as authoritative
    if (m.effective_role || m.portal_role) {
      return (m.effective_role || m.portal_role) === 'teacher' && m.device !== 'screen';
    }
  } catch { /* JSON parse error — fall through */ }
  // Fallback: identity pattern (handles metadata-not-yet-loaded race condition)
  return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
}

function isTeacherScreen(p: RemoteParticipant): boolean {
  try {
    const m = JSON.parse(p.metadata || '{}');
    // If metadata has device info, use it as authoritative
    if (m.device) {
      return m.device === 'screen' && (m.portal_role === 'teacher' || m.effective_role === 'teacher_screen');
    }
  } catch { /* JSON parse error — fall through */ }
  // Fallback: identity pattern (handles metadata-not-yet-loaded race condition)
  return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const prefix = sec < 0 ? '+' : '';
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${prefix}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${prefix}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── constants ────────────────────────────────────────────
const HIDE_DELAY = 3500;          // ms before overlays auto-hide
const WARNING_THRESHOLD = 5 * 60; // 5 min warning

import { sfxHandRaise, sfxHandLower, sfxParticipantJoin, sfxParticipantLeave, sfxWarning, sfxExpired, sfxMediaControl, hapticTap, hapticToggle } from '@/lib/sounds';
import { useAttentionMonitor, ATTENTION_TOPIC, type AttentionMessage, type AttentionData, type MonitorConfig } from '@/hooks/useAttentionMonitor';

// ─── component ────────────────────────────────────────────
export default function StudentView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  topic,
  isRejoin = false,
  observeOnly = false,
  onLeave,
  onTimeExpired,
  onDurationUpdate,
}: StudentViewProps) {
  // ── session live detection ──
  const [isSessionLive, setIsSessionLive] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const roomEndedRef = useRef(false);
  // go_live_at: when teacher actually clicked Go Live (null = not yet live)
  const [goLiveAt, setGoLiveAt] = useState<string | null>(null);

  // Poll room status on mount + every 10s to detect live/ended state
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data?.status === 'live') {
          setIsSessionLive(true);
          // Capture when teacher went live (used for timer start)
          if (data.data?.go_live_at) setGoLiveAt(data.data.go_live_at as string);
        } else if (data.success && data.data?.status === 'ended') {
          if (!roomEndedRef.current) {
            roomEndedRef.current = true;
            setRoomEnded(true);
            console.log('[StudentView] Room status is ended');
            onLeave();
          }
        }
      } catch {}
    };
    poll();
    // Slow poll: data-channel `go_live` is the primary live signal; this is just
    // a safety fallback for missed signals. At 100+ students, 10s polling = 600
    // req/min/room hammering /api/v1/room/[roomId]. 30s = 200 req/min.
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [roomId]);

  // Listen for go_live data channel from teacher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSessionControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      if (data.action === 'go_live') {
        setIsSessionLive(true);
      }
    } catch {}
  }, []);
  const { message: sessionCtrlMsg } = useDataChannel('session_control', onSessionControl);
  useEffect(() => { if (sessionCtrlMsg) onSessionControl(sessionCtrlMsg); }, [sessionCtrlMsg, onSessionControl]);

  // ── overlay visibility ──
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveRequestPending, setLeaveRequestPending] = useState(false);
  const [leaveDenied, setLeaveDenied] = useState(false);
  const [teacherPopup, setTeacherPopup] = useState(false);
  const [studentPopupId, setStudentPopupId] = useState<string | null>(null);
  const [fullviewPending, setFullviewPending] = useState(false);
  const [agentPopup, setAgentPopup] = useState(false);
  const [agentFullviewPending, setAgentFullviewPending] = useState(false);
  const [videoQuality, setVideoQuality] = useState<VideoQualityOption>('480p');
  // Track whether student manually selected quality (prevents auto-override)
  const manualQualityRef = useRef(false);
  const handleQualityChange = useCallback((q: VideoQualityOption) => {
    manualQualityRef.current = true;
    setVideoQuality(q);
  }, []);
  const [chatOpen, setChatOpen] = useState(false);
  const [selfieHidden, setSelfieHidden] = useState(false);
  const [teacherTileHidden, setTeacherTileHidden] = useState(false);
  const [teacherBigScreen, setTeacherBigScreen] = useState(false);
  const [teacherCutoutActive, setTeacherCutoutActive] = useState(false);
  const [teacherWhispering, setTeacherWhispering] = useState(false);
  // Resizable teacher tile — width in px (height = width * 3/4), position bottom-left anchor
  const [teacherTileW, setTeacherTileW] = useState(144);
  const teacherTileDragRef = useRef<{ active: boolean; startX: number; startW: number } | null>(null);

  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Rejoin gating ──
  const [rejoinBlocked, setRejoinBlocked] = useState(isRejoin);
  const [rejoinDenied, setRejoinDenied] = useState(false);
  const [rejoinAttempt, setRejoinAttempt] = useState(0);

  // ── Student feedback ──
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackShownRef = useRef(false);

  // ── Report teacher ──
  const [showReportTeacher, setShowReportTeacher] = useState(false);

  // ── Announcements ──
  const [announcement, setAnnouncement] = useState<{ text: string; from: string; priority: string } | null>(null);
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Upcoming exam alert ──
  const [examAlert, setExamAlert] = useState<{ title: string; subject: string; date: string } | null>(null);
  // examFetched ref removed — on-mount exam fetch was causing spurious notifications

  // ── 5-minute warning dialog ──
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const timeWarningShown = useRef(false);

  // ── Engagement enforcement alerts ──
  // tab_switched: immediate critical alert + cumulative 3-min decay + 20-min total exit
  // not_in_frame: alert after 30s absence + 3-min decay + 20-min total exit
  const [engagementAlert, setEngagementAlert] = useState<{
    type: 'tab_switched' | 'not_in_frame' | 'exit_warning';
    message: string;
  } | null>(null);


  // Cumulative tracking refs (persist across renders)
  const tabSwitchedStartRef = useRef<number | null>(null);   // epoch ms when current tab-switch began
  const notInFrameStartRef = useRef<number | null>(null);    // epoch ms when current absence began
  const cumTabSwitchedMs = useRef(0);                        // total tab-switched ms this session
  const cumNotInFrameMs = useRef(0);                         // total not-in-frame ms this session
  const engagementAlertShownRef = useRef<'tab_switched' | 'not_in_frame' | 'exit_warning' | null>(null); // which alert is showing
  const exitWarningShownRef = useRef(false);                  // exit warning was shown
  const ABSENCE_ALERT_MS = 30_000;    // show not_in_frame alert after 30s
  const DECAY_THRESHOLD_MS = 180_000; // 3 min continuous → attention penalty
  const EXIT_THRESHOLD_MS = 1_200_000; // 20 min cumulative → exit warning

  // ── Demo exam dialog (only for demo rooms) ──
  const isDemo = roomId.startsWith('demo_');
  const [showDemoExam, setShowDemoExam] = useState(false);
  const demoExamShown = useRef(false);

  // ── Session exam state (for non-demo academic sessions) ──
  const [showSessionExam, setShowSessionExam] = useState(false);
  const sessionExamShown = useRef<string>(''); // last dedup key: "topic_id:recv_ts_bucket"
  const [sessionExamTopicId, setSessionExamTopicId] = useState('');
  const [sessionExamTopicTitle, setSessionExamTopicTitle] = useState('');
  const [sessionExamSubject, setSessionExamSubject] = useState('');
  const [sessionExamSessionId, setSessionExamSessionId] = useState('');
  const [sessionExamQuestionCount, setSessionExamQuestionCount] = useState<number | undefined>();
  const [examInProgress, setExamInProgress] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');

  // Fetch session metadata (session_id, student email)
  useEffect(() => {
    if (isDemo) return;
    (async () => {
      try {
        const roomRes = await fetch(`/api/v1/room/${roomId}`);
        const roomJson = await roomRes.json();
        if (roomJson.success && roomJson.data) {
          setSessionExamSessionId(roomJson.data.batch_session_id || '');
        }
      } catch { /* non-critical */ }
      // Get student email from session cookie
      try {
        const authRes = await fetch('/api/v1/auth/me');
        const authJson = await authRes.json();
        if (authJson.success) setStudentEmail(authJson.data?.user?.email || authJson.data?.email || '');
      } catch { /* non-critical */ }
    })();
  }, [roomId, isDemo]);

  // ── Session extension request ──
  const [extensionMinutes, setExtensionMinutes] = useState(0);
  const [extensionStatus, setExtensionStatus] = useState<'idle'|'checking'|'available'|'unavailable'|'choosing'|'pending'|'approved'|'rejected'>('idle');
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionFeePaise, setExtensionFeePaise] = useState(0);
  const [extensionRequestId, setExtensionRequestId] = useState<string|null>(null);
  const [extensionTiers, setExtensionTiers] = useState<Array<{ duration_minutes: number; rate_paise: number; currency: string; label: string }>>([]);
  const extensionChecked = useRef(false);

  // ── attendance badge (computed once on mount) ──
  const joinedAt = useRef(new Date());
  const lateInfo = useMemo(() => {
    if (!scheduledStart) return null;
    const start = new Date(scheduledStart);
    const diff = Math.floor((joinedAt.current.getTime() - start.getTime()) / 1000);
    if (diff > 120) { // More than 2 minutes late
      const mins = Math.floor(diff / 60);
      return { late: true, minutes: mins };
    }
    return { late: false, minutes: 0 };
  }, [scheduledStart]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── timer state ──
  const [now, setNow] = useState(Date.now());
  const expiredFired = useRef(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // ── orientation / device ──
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [vpHeight, setVpHeight] = useState(0);
  const [pseudoFs, setPseudoFs] = useState(false);
  // Screen share <video> element ref from WhiteboardComposite — for iOS native fullscreen
  const [screenVideoEl, setScreenVideoEl] = useState<HTMLVideoElement | null>(null);
  // Teacher camera <video> element ref — used for iOS composite fullscreen
  const [teacherVideoEl, setTeacherVideoEl] = useState<HTMLVideoElement | null>(null);
  const iosCompositeRef = useRef<{ canvas: HTMLCanvasElement; video: HTMLVideoElement; raf: number } | null>(null);
  // The composite <video> element shown in the DOM overlay during iOS pseudo-FS
  const [compositeVideoEl, setCompositeVideoEl] = useState<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);

  // ── Split-screen state (when both laptop + Flutter screens are live) ──
  const [screenView, setScreenView] = useState<'split' | 'laptop' | 'tablet'>('split');
  const [splitRatio, setSplitRatio] = useState(0.5); // 0 = all left, 1 = all right
  const splitDragRef = useRef<{ active: boolean; startX: number; startRatio: number }>({ active: false, startX: 0, startRatio: 0.5 });
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // ── detect mobile & iOS ──
  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const ua = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(touch && ua);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
  }, []);

  // ── detect portrait ──
  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // ── orientation lock helper (works only in fullscreen on most browsers) ──
  const lockLandscape = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (screen.orientation as any)?.lock?.('landscape');
    } catch {}
  }, []);

  const unlockOrientation = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { (screen.orientation as any)?.unlock?.(); } catch {}
  }, []);

  // ── viewport height tracking (for iOS dynamic toolbar) ──
  useEffect(() => {
    const update = () => setVpHeight(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (vv) vv.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (vv) vv.removeEventListener('resize', update);
    };
  }, []);

  // ── keyboard height (CSS-rotated mode) ──
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const fn = () => { const d = window.innerHeight - vv.height; setKbHeight(d > 50 ? d : 0); };
    vv.addEventListener('resize', fn);
    return () => vv.removeEventListener('resize', fn);
  }, []);

  // ── Lock body scroll on mount (prevents iOS rubber-banding & pull-to-refresh) ──
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('classroom-active');
    // Prevent pinch-zoom on the document
    const preventPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchmove', preventPinch, { passive: false });
    return () => {
      html.classList.remove('classroom-active');
      html.classList.remove('classroom-fullscreen');
      html.classList.remove('classroom-scroll-trick');
      // Cleanup iOS composite fullscreen if active
      if (iosCompositeRef.current) {
        cancelAnimationFrame(iosCompositeRef.current.raf);
        iosCompositeRef.current = null;
      }
      document.removeEventListener('touchmove', preventPinch);
    };
  }, []);

  // ── Wake Lock — prevent screen from sleeping during class ──
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    // Re-acquire when tab becomes visible (browser releases on hide)
    const onVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    };
  }, []);

  // ── Auto-enter fullscreen on mount ──
  const autoFsTriggered = useRef(false);
  useEffect(() => {
    const enterFs = async () => {
      if (autoFsTriggered.current) return;
      autoFsTriggered.current = true;
      try {
        if (isIOS) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vid = screenVideoEl as any;
          if (vid?.webkitSupportsFullscreen) {
            vid.webkitEnterFullscreen();
          }
          // iOS: no document fullscreen, nothing else to do
          return;
        }
        const el = document.documentElement;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
        if (fsEl) return; // already fullscreen
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          (el as any).webkitRequestFullscreen();
        }
      } catch {
        // Browser may block automatic fullscreen — user can tap the button
      }
    };
    // Only attempt fullscreen if user has already interacted (gesture required by browsers)
    // We try once with a small delay; if blocked, user can tap the fullscreen button
    const t = setTimeout(() => {
      if (document.hasFocus()) enterFs();
    }, 800);
    return () => clearTimeout(t);
  }, [isIOS, screenVideoEl]);

  // ── fullscreen state (native + pseudo for iOS) ──
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iosVideoFs, setIosVideoFs] = useState(false);

  useEffect(() => {
    const onChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const entering = !!fsEl;
      setIsFullscreen(entering);
      // Bump teacher tile to a larger default when entering fullscreen on non-iOS
      if (!isIOS) setTeacherTileW(entering ? 192 : 144);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Track iOS native video fullscreen state via webkitbeginfullscreen / webkitendfullscreen
  useEffect(() => {
    const vid = screenVideoEl;
    if (!vid) return;
    const onBegin = () => setIosVideoFs(true);
    const onEnd = () => setIosVideoFs(false);
    vid.addEventListener('webkitbeginfullscreen', onBegin);
    vid.addEventListener('webkitendfullscreen', onEnd);
    return () => {
      vid.removeEventListener('webkitbeginfullscreen', onBegin);
      vid.removeEventListener('webkitendfullscreen', onEnd);
    };
  }, [screenVideoEl]);

  const effectiveFullscreen = isFullscreen || pseudoFs || iosVideoFs;

  // ── tick every second for countdown timer ──
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // compute end time, remaining, warning, expired
  // durationMinutes is updated by ClassroomWrapper when extension is approved (via onDurationUpdate)
  const effectiveDuration = durationMinutes;
  const endTime = useMemo(() => {
    if (!scheduledStart || effectiveDuration === 0) return null; // 0 = unlimited
    // Timer rule (matches teacher HeaderBar):
    // - Always count from goLiveAt when available (teacher early/on-time/late → full duration from live start)
    // - Fall back to scheduledStart only if goLiveAt is not yet set (pre-live polling)
    if (goLiveAt) {
      const t = new Date(goLiveAt).getTime();
      if (!isNaN(t)) return t + effectiveDuration * 60_000;
    }
    const scheduledMs = new Date(scheduledStart).getTime();
    if (isNaN(scheduledMs)) return null;
    return scheduledMs + effectiveDuration * 60_000;
  }, [scheduledStart, effectiveDuration, goLiveAt]);

  const remaining = endTime ? Math.floor((endTime - now) / 1000) : null;
  const isExpired = remaining !== null && remaining <= 0;
  const isWarning = remaining !== null && remaining > 0 && remaining <= WARNING_THRESHOLD;

  // fire onTimeExpired once
  useEffect(() => {
    if (isExpired && !expiredFired.current && onTimeExpired) {
      expiredFired.current = true;
      onTimeExpired();
    }
  }, [isExpired, onTimeExpired]);

  // ── overlay auto-hide logic ──
  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    // don't auto-hide while dialog or chat is open
    if (!showLeaveDialog && !chatOpen) {
      hideRef.current = setTimeout(() => setOverlayVisible(false), HIDE_DELAY);
    }
  }, [showLeaveDialog, chatOpen]);

  // ── fullscreen toggle (native → iOS video fullscreen → pseudo-fullscreen fallback) ──
  const toggleFullscreen = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;

      if (!fsEl && !pseudoFs && !iosVideoFs) {
        // ── ENTER fullscreen ──

        // iOS: build a composite canvas (screen share + teacher PiP), feed it to a
        // hidden <video>, then call webkitEnterFullscreen() — hides Safari chrome.
        if (isIOS) {
          const screenVid = screenVideoEl;
          const teacherVid = teacherVideoEl;

          if (screenVid && (screenVid as any).webkitSupportsFullscreen) {
            const W = screenVid.videoWidth  || window.screen.width  || 1280;
            const H = screenVid.videoHeight || window.screen.height || 720;
            const canvas = document.createElement('canvas');
            canvas.width  = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d')!;

            const stream = canvas.captureStream(30);
            const compVid = document.createElement('video');
            compVid.srcObject = stream;
            compVid.muted = true;
            compVid.playsInline = true;
            compVid.setAttribute('playsinline', '');
            compVid.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:0;left:0;';
            document.body.appendChild(compVid);

            const pipW = Math.round(W * 0.2);
            const pipH = Math.round(pipW * 0.75);
            const margin = Math.round(W * 0.012);
            const draw = () => {
              try {
                ctx.clearRect(0, 0, W, H);
                ctx.drawImage(screenVid as HTMLVideoElement, 0, 0, W, H);
                if (teacherVid && teacherVid.readyState >= 2) {
                  const pip_x = margin;
                  const pip_y = H - pipH - margin;
                  ctx.save();
                  ctx.beginPath();
                  ctx.roundRect(pip_x, pip_y, pipW, pipH, 8);
                  ctx.clip();
                  ctx.drawImage(teacherVid, pip_x, pip_y, pipW, pipH);
                  ctx.restore();
                  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.roundRect(pip_x, pip_y, pipW, pipH, 8);
                  ctx.stroke();
                }
              } catch { /* ignore stale frame */ }
              if (iosCompositeRef.current) {
                iosCompositeRef.current.raf = requestAnimationFrame(draw);
              }
            };
            iosCompositeRef.current = { canvas, video: compVid, raf: 0 };
            draw();

            const onEnd = () => {
              if (iosCompositeRef.current) {
                cancelAnimationFrame(iosCompositeRef.current.raf);
                iosCompositeRef.current.video.remove();
                iosCompositeRef.current = null;
              }
              setCompositeVideoEl(null);
              setIosVideoFs(false);
            };
            (compVid as any).addEventListener('webkitendfullscreen', onEnd, { once: true });

            setIosVideoFs(true);
            compVid.play().then(() => {
              (compVid as any).webkitEnterFullscreen();
            }).catch(() => {
              try { (compVid as any).webkitEnterFullscreen(); } catch { /* ignore */ }
            });
          } else {
            // No screen share video — fall back to pseudo-fullscreen
            setPseudoFs(true);
            document.documentElement.classList.add('classroom-fullscreen');
          }
        } else {
          // Non-iOS: standard Fullscreen API
          const el = document.documentElement;
          let nativeOk = false;
          if (el.requestFullscreen) {
            await el.requestFullscreen();
            nativeOk = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } else if ((el as any).webkitRequestFullscreen) {
            (el as any).webkitRequestFullscreen();
            nativeOk = true;
          }

          if (nativeOk) {
            if (isMobile) await lockLandscape();
          } else {
            // Non-iOS fallback (unlikely) — pseudo-fullscreen
            setPseudoFs(true);
            document.documentElement.classList.add('classroom-fullscreen');
            window.scrollTo(0, 1);
          }
        }
      } else {
        // ── EXIT fullscreen ──
        if (iosVideoFs) {
          if (iosCompositeRef.current) {
            const comp = iosCompositeRef.current.video as any;
            if (comp?.webkitDisplayingFullscreen) comp.webkitExitFullscreen();
          }
        } else if (pseudoFs) {
          setPseudoFs(false);
          document.documentElement.classList.remove('classroom-fullscreen');
          document.documentElement.classList.remove('classroom-scroll-trick');
        } else {
          if (isMobile) unlockOrientation();
          if (document.exitFullscreen) await document.exitFullscreen();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        }
      }
    } catch {}
    showOverlay();
  }, [showOverlay, isMobile, isIOS, pseudoFs, iosVideoFs, screenVideoEl, lockLandscape, unlockOrientation]);

  // keep overlays visible while dialog or chat is open
  useEffect(() => {
    if (showLeaveDialog || chatOpen) {
      setOverlayVisible(true);
      if (hideRef.current) clearTimeout(hideRef.current);
    } else {
      // restart auto-hide
      showOverlay();
    }
  }, [showLeaveDialog, chatOpen, showOverlay]);

  // initial show
  useEffect(() => {
    showOverlay();
    return () => { if (hideRef.current) clearTimeout(hideRef.current); };
  }, [showOverlay]);

  // ── participants ──
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  // Safe publish helper — guards against "PC manager is closed" by waiting for Connected state
  const publish = useCallback(
    (payload: Uint8Array, opts?: { topic: string; reliable?: boolean; destinationIdentities?: string[] }) =>
      safePublish(room, localParticipant, payload, opts),
    [room, localParticipant],
  );
  const sendSessionExamStatus = useCallback((payload: Record<string, unknown>) => {
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          ...payload,
          student_identity: localParticipant.identity,
          student_name: participantName,
          at: Date.now(),
        })),
        { topic: 'session_exam_status', reliable: true },
      );
    } catch (err) {
      console.error('[StudentView] Failed to publish session_exam_status:', err);
    }
  }, [localParticipant, participantName]);
  // Auto-start audio after first user gesture (fixes Chrome AudioContext autoplay block)
  const { startAudio, canPlayAudio } = useAudioPlayback(room);
  useEffect(() => {
    if (!canPlayAudio) {
      const handleGesture = () => { startAudio().catch(() => {}); };
      window.addEventListener('click', handleGesture, { once: true, capture: true });
      window.addEventListener('keydown', handleGesture, { once: true, capture: true });
      return () => {
        window.removeEventListener('click', handleGesture, { capture: true });
        window.removeEventListener('keydown', handleGesture, { capture: true });
      };
    }
  }, [canPlayAudio, startAudio]);
  const remotes = useRemoteParticipants();
  const allParticipants = useParticipants();

  const teacher = useMemo(() => remotes.find(isTeacherPrimary) ?? null, [remotes]);
  const screenDevice = useMemo(() => remotes.find(isTeacherScreen) ?? null, [remotes]);
  const demoAgent = useMemo(() => remotes.find(p => p.identity.startsWith('demo_agent')) ?? null, [remotes]);
  // Students list — used by observeOnly (parent) filmstrip
  const otherStudents = useMemo(() => remotes.filter((p) => {
    try { const m = JSON.parse(p.metadata || '{}'); if (m.effective_role || m.portal_role) return (m.effective_role || m.portal_role) === 'student'; } catch { /* ignore */ }
    return p.identity.startsWith('student');
  }), [remotes]);

  // ── useTracks for reactive track detection ──
  // This properly subscribes to track publish/subscribe/mute events
  const remoteTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.ScreenShareAudio],
    { onlySubscribed: false },
  );

  const hasScreenShare = useMemo(() => {
    return remoteTracks.some((t) => {
      if (t.source !== Track.Source.ScreenShare) return false;
      const p = t.participant as RemoteParticipant;
      return isTeacherPrimary(p) || isTeacherScreen(p);
    });
  }, [remoteTracks]);

  // ── Screen source preference (laptop vs tablet) — controlled by teacher ──
  const [screenSourcePref, setScreenSourcePref] = useState<'tablet' | 'laptop'>('tablet');
  const onScreenSource = useCallback((msg: unknown) => {
    try {
      const raw = msg as { payload?: ArrayBuffer };
      const text = new TextDecoder().decode(raw?.payload);
      const data = JSON.parse(text) as { source: 'laptop' | 'tablet' };
      if (data.source === 'laptop' || data.source === 'tablet') {
        setScreenSourcePref(data.source);
      }
    } catch { /* ignore */ }
  }, []);
  useDataChannel('screen_source', onScreenSource);

  // ── Detect both screens live simultaneously ──
  const hasBothScreens = useMemo(() => {
    if (!teacher || !screenDevice) return false;
    const teacherHasScreen = remoteTracks.some(
      (t) => t.source === Track.Source.ScreenShare && t.participant.identity === teacher.identity,
    );
    const tabletHasScreen = remoteTracks.some(
      (t) => t.source === Track.Source.ScreenShare && t.participant.identity === screenDevice.identity,
    );
    return teacherHasScreen && tabletHasScreen;
  }, [teacher, screenDevice, remoteTracks]);

  // Auto-enable split mode when both screens detected for the first time
  const splitAutoEnabled = useRef(false);
  useEffect(() => {
    if (hasBothScreens && !splitAutoEnabled.current) {
      splitAutoEnabled.current = true;
      setScreenView('split');
    }
    if (!hasBothScreens) {
      splitAutoEnabled.current = false;
      // Don't reset screenView here — keep user's last choice if they rejoin
    }
  }, [hasBothScreens]);

  // Auto-detect for late joiners: if teacher's primary has screen share → laptop
  useEffect(() => {
    if (!teacher || !isSessionLive) return;
    const teacherHasLaptop = !!remoteTracks.find(
      (t) => t.source === Track.Source.ScreenShare && t.participant.identity === teacher.identity && isTeacherPrimary(t.participant as RemoteParticipant),
    );
    const tabletHasScreen = !!screenDevice && !!remoteTracks.find(
      (t) => t.source === Track.Source.ScreenShare && t.participant.identity === screenDevice.identity,
    );
    // If only one source exists, auto-select it
    if (teacherHasLaptop && !tabletHasScreen) setScreenSourcePref('laptop');
    else if (!teacherHasLaptop && tabletHasScreen) setScreenSourcePref('tablet');
    // If both exist, split mode handles it
  }, [teacher, screenDevice, remoteTracks, isSessionLive]);

  // Active screen host can be primary teacher OR tablet screen participant.
  // This prevents blank state when only teacher_screen is connected and sharing.
  const activeScreenHost = useMemo(() => {
    const teacherHasScreen = !!teacher && remoteTracks.some(
      (t) => t.source === Track.Source.ScreenShare && t.participant.identity === teacher.identity,
    );
    const tabletHasScreen = !!screenDevice && remoteTracks.some(
      (t) => t.source === Track.Source.ScreenShare && t.participant.identity === screenDevice.identity,
    );

    if (screenSourcePref === 'laptop') {
      if (teacherHasScreen && teacher) return teacher;
      if (tabletHasScreen && screenDevice) return screenDevice;
    } else {
      if (tabletHasScreen && screenDevice) return screenDevice;
      if (teacherHasScreen && teacher) return teacher;
    }

    return teacher ?? screenDevice ?? null;
  }, [teacher, screenDevice, remoteTracks, screenSourcePref]);

  const hasTeacherCam = useMemo(() => {
    if (!teacher) return false;
    return remoteTracks.some(
      (t) => t.source === Track.Source.Camera && t.participant.identity === teacher.identity,
    );
  }, [remoteTracks, teacher]);

  // Detect active screen-share audio track from whichever source is currently selected.
  const activeScreenAudioPub = useMemo(() => {
    if (!activeScreenHost) return null;
    const pub = activeScreenHost.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
    return pub && pub.track && !pub.isMuted ? pub : null;
  }, [activeScreenHost, remoteTracks]);

  // Robustness: if teacher media is already flowing but session status sync lags,
  // treat the session as live to avoid blank/waiting UI.
  useEffect(() => {
    if (isSessionLive) return;
    if (hasScreenShare || hasTeacherCam || !!screenDevice) {
      setIsSessionLive(true);
    }
  }, [isSessionLive, hasScreenShare, hasTeacherCam, screenDevice]);

  const teacherCamPub = useMemo(() => {
    if (!teacher) return null;
    const tr = remoteTracks.find(
      (t) => t.source === Track.Source.Camera && t.participant.identity === teacher.identity,
    );
    if (!tr) return null;
    const p = tr.publication as RemoteTrackPublication | undefined;
    return p && p.track ? p : null;
  }, [remoteTracks, teacher]);

  // Agent camera detection — must have a real subscribed track, not just a placeholder
  const hasAgentCam = useMemo(() => {
    if (!demoAgent) return false;
    return remoteTracks.some((t) => {
      if (t.source !== Track.Source.Camera || t.participant.identity !== demoAgent.identity) return false;
      const pub = t.publication as RemoteTrackPublication | undefined;
      return !!pub?.track && !pub.isMuted;
    });
  }, [remoteTracks, demoAgent]);

  // Agent camera publication (for fullscreen modal)
  const agentCamPub = useMemo(() => {
    if (!demoAgent) return null;
    const tr = remoteTracks.find(
      (t) => t.source === Track.Source.Camera && t.participant.identity === demoAgent.identity,
    );
    if (!tr) return null;
    const p = tr.publication as RemoteTrackPublication | undefined;
    return p && p.track && !p.isMuted ? p : null;
  }, [remoteTracks, demoAgent]);

  // Selected student fullscreen popup target
  const selectedStudent = useMemo(() => {
    if (!studentPopupId) return null;
    return remotes.find((p) => p.identity === studentPopupId) ?? null;
  }, [studentPopupId, remotes]);

  const selectedStudentCamPub = useMemo(() => {
    if (!selectedStudent) return null;
    const tr = remoteTracks.find(
      (t) => t.source === Track.Source.Camera && t.participant.identity === selectedStudent.identity,
    );
    if (!tr) return null;
    const p = tr.publication as RemoteTrackPublication | undefined;
    return p && p.track && !p.isMuted ? p : null;
  }, [remoteTracks, selectedStudent]);

  // ── Local connection quality monitoring — adaptive video quality ──
  // Tracks the student's own upload/download quality to auto-switch quality.
  // When connection is Poor → drops to 144p to reduce bandwidth pressure.
  // When it recovers → restores 480p (unless student manually overrode).
  const [localConnQuality, setLocalConnQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  useEffect(() => {
    const handler = (quality: ConnectionQuality) => setLocalConnQuality(quality);
    localParticipant.on('connectionQualityChanged', handler);
    return () => { localParticipant.off('connectionQualityChanged', handler); };
  }, [localParticipant]);
  useEffect(() => {
    if (manualQualityRef.current) return; // don't override manual selection
    if (localConnQuality === ConnectionQuality.Poor) {
      setVideoQuality('144p');
    } else if (localConnQuality === ConnectionQuality.Good || localConnQuality === ConnectionQuality.Excellent) {
      setVideoQuality('480p');
    }
  }, [localConnQuality]);

  // ── Teacher connection quality monitoring ──
  const [teacherConnQuality, setTeacherConnQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  useEffect(() => {
    if (!teacher) { setTeacherConnQuality(ConnectionQuality.Unknown); return; }
    // Read initial
    setTeacherConnQuality(teacher.connectionQuality);
    const handler = (quality: ConnectionQuality) => setTeacherConnQuality(quality);
    teacher.on('connectionQualityChanged', handler);
    return () => { teacher.off('connectionQualityChanged', handler); };
  }, [teacher]);

  // ── Teacher overlay hook disabled — segmentation removed, plain tile used instead ──
  const teacherOverlayVideoRef = useRef<HTMLVideoElement>(null);
  const teacherOverlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Unsubscribe from screen share tracks until Go Live ──
  // Prevents the student's browser from decoding tablet video before the session starts.
  useEffect(() => {
    if (isSessionLive) return;              // already live — let auto-subscribe handle it
    const unsub = () => {
      for (const p of [teacher, screenDevice]) {
        if (!p) continue;
        const pub = p.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
        if (pub?.isSubscribed) pub.setSubscribed(false);
        const audioPub = p.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
        if (audioPub?.isSubscribed) audioPub.setSubscribed(false);
      }
    };
    unsub();
    // Re-check after short delay (track may arrive after participant)
    const timer = setTimeout(unsub, 2000);
    return () => clearTimeout(timer);
  }, [teacher, screenDevice, isSessionLive]);

  // Re-subscribe to screen share tracks once Go Live fires
  useEffect(() => {
    if (!isSessionLive) return;
    for (const p of [teacher, screenDevice]) {
      if (!p) continue;
      const pub = p.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
      if (pub && !pub.isSubscribed) pub.setSubscribed(true);
      const audioPub = p.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
      if (audioPub && !audioPub.isSubscribed) audioPub.setSubscribed(true);
    }
  }, [teacher, screenDevice, isSessionLive]);

  // ── Apply video quality to teacher's remote tracks ──
  // Uses setVideoQuality() to directly select simulcast layer (LOW/MEDIUM/HIGH).
  // This is NOT overridden by adaptive stream, unlike setVideoDimensions().
  useEffect(() => {
    if (!teacher || !isSessionLive) return;
    const quality = QUALITY_MAP[videoQuality];
    // Apply to camera track
    const camPub = teacher.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
    if (camPub) {
      camPub.setVideoQuality(quality ?? VideoQuality.HIGH);
    }
    // Apply to screen share track (if any)
    const screenPub = teacher.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
    if (screenPub) {
      screenPub.setVideoQuality(quality ?? VideoQuality.HIGH);
    }
  }, [teacher, videoQuality, isSessionLive]);

  // Also apply quality to screen device (separate participant for tablet)
  useEffect(() => {
    if (!screenDevice || !isSessionLive) return;
    const quality = QUALITY_MAP[videoQuality];
    const screenPub = screenDevice.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
    if (screenPub) {
      screenPub.setVideoQuality(quality ?? VideoQuality.HIGH);
    }
  }, [screenDevice, videoQuality, isSessionLive]);

  // ── local media ──
  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;
  const [permCamera, setPermCamera] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('unsupported');
  const [permMicrophone, setPermMicrophone] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('unsupported');

  const checkPermissions = useCallback(async () => {
    try {
      if (!navigator.permissions) {
        setPermCamera('unsupported');
        setPermMicrophone('unsupported');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - some browsers have 'camera' and 'microphone' PermissionName
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const camState = cam.state === 'granted' ? 'granted' : cam.state === 'denied' ? 'denied' : 'prompt';
      const micState = mic.state === 'granted' ? 'granted' : mic.state === 'denied' ? 'denied' : 'prompt';
      setPermCamera(camState);
      setPermMicrophone(micState);
      // listen for changes
      cam.onchange = async () => {
        const s = cam.state === 'granted' ? 'granted' : cam.state === 'denied' ? 'denied' : 'prompt';
        setPermCamera(s);
        const payload = JSON.stringify({ action: 'permission_update', identity: localParticipant.identity, video: s, audio: permMicrophone });
        publish(new TextEncoder().encode(payload), { topic: 'permission_update', reliable: true });
      };
      mic.onchange = async () => {
        const s = mic.state === 'granted' ? 'granted' : mic.state === 'denied' ? 'denied' : 'prompt';
        setPermMicrophone(s);
        const payload = JSON.stringify({ action: 'permission_update', identity: localParticipant.identity, video: permCamera, audio: s });
        publish(new TextEncoder().encode(payload), { topic: 'permission_update', reliable: true });
      };
      // emit initial state to teacher(s)
      const payload = JSON.stringify({ action: 'permission_update', identity: localParticipant.identity, video: camState, audio: micState });
      publish(new TextEncoder().encode(payload), { topic: 'permission_update', reliable: true });
    } catch {
      setPermCamera('unsupported');
      setPermMicrophone('unsupported');
    }
  }, []);

  useEffect(() => { checkPermissions(); }, [checkPermissions]);

  const requestPermissions = useCallback(async (opts: { audio?: boolean; video?: boolean } = { audio: true, video: true }) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // nothing to do
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: !!opts.audio, video: !!opts.video });
      // immediately stop tracks — LiveKit will handle publishing when teacher requests
      stream.getTracks().forEach(t => t.stop());
      // re-check permissions
      checkPermissions();
      return true;
    } catch (err) {
      // Permission denied or other error
      await checkPermissions();
      return false;
    }
  }, [checkPermissions]);

  // ── AI Attention Monitoring (MediaPipe) ──
  // We maintain a low-res (320×240 @ 10fps) local camera stream specifically
  // for AI face detection. This stream is NEVER published to LiveKit — it's
  // local-only and only used by MediaPipe. This allows monitoring to run even
  // when the student's camera is turned off (not publishing to the room).
  //
  // Lifecycle:
  //   camera OFF → local monitor stream runs (getUserMedia @ 320×240)
  //   camera ON  → local stream stops, LiveKit takes over camera hardware;
  //                monitoring switches to LiveKit's rendered <video> element
  const monitorStreamRef = useRef<MediaStream | null>(null);
  const monitorVideoRef = useRef<HTMLVideoElement | null>(null);
  const [monitorVideoEl, setMonitorVideoEl] = useState<HTMLVideoElement | null>(null);

  // LiveKit-element resolver (used when camera IS published)
  const [localVideoEl, setLocalVideoEl] = useState<HTMLVideoElement | null>(null);
  const selfVideoContainerRef = useRef<HTMLDivElement>(null);
  const selfVideoPipRef = useRef<HTMLDivElement>(null);

  // Start/stop local monitor stream based on camera publish state
  useEffect(() => {
    if (isCamOn) {
      // Camera is publishing via LiveKit — stop the local monitor stream so
      // both streams don't compete for the same camera hardware
      if (monitorStreamRef.current) {
        monitorStreamRef.current.getTracks().forEach(t => t.stop());
        monitorStreamRef.current = null;
      }
      setMonitorVideoEl(null);
      return;
    }
    // Camera is off — start a low-res local stream for AI monitoring only
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240, frameRate: 10 }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        monitorStreamRef.current = stream;
        const vid = monitorVideoRef.current;
        if (vid) {
          vid.srcObject = stream;
          vid.play().catch(() => {});
          setMonitorVideoEl(vid);
        }
      })
      .catch(() => {
        // Camera permission denied — monitoring won't work but class continues
      });
    return () => {
      cancelled = true;
      monitorStreamRef.current?.getTracks().forEach(t => t.stop());
      monitorStreamRef.current = null;
    };
  }, [isCamOn]);

  // Resolve LiveKit's rendered <video> element when camera IS publishing
  // (split-layout right panel OR PIP overlay — only one renders at a time)
  useEffect(() => {
    if (!isCamOn) { setLocalVideoEl(null); return; }
    // Short delay to allow VideoTrack to mount
    const timer = setTimeout(() => {
      // Try split-layout container first, then PIP container
      const container = selfVideoContainerRef.current ?? selfVideoPipRef.current;
      if (container) {
        const video = container.querySelector('video');
        if (video) { setLocalVideoEl(video); return; }
      }
      // Fallback: search the entire classroom root for local participant video
      const root = document.querySelector('.classroom-root');
      if (root) {
        const videos = root.querySelectorAll('video');
        // The local participant video is the mirrored (scaleX(-1)) one
        for (const v of videos) {
          const parent = v.closest('[style*="scaleX(-1)"]') || v.closest('[style*="scaleX"]');
          if (parent) { setLocalVideoEl(v); return; }
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isCamOn, hasScreenShare]);

  // Effective video element for AI monitoring:
  // — camera ON:  use LiveKit's published video element (full quality)
  // — camera OFF: use hidden local monitor stream (low-res, not published)
  const effectiveMonitorEl = isCamOn ? localVideoEl : monitorVideoEl;

  // Monitor config — sends batched events to server every 30s
  // v3 — fetch AO monitoring tuning config once
  const [monitoringTuning, setMonitoringTuning] = useState<MonitorConfig['tuning']>({
    writing_aware_mode: true,
    mobile_relaxed_thresholds: true,
    exam_strict_mode: false,
    low_visibility_fallback: true,
  });
  useEffect(() => {
    let alive = true;
    fetch('/api/v1/monitoring-tuning')
      .then(r => r.json())
      .then(d => { if (alive && d?.success && d.data) setMonitoringTuning(d.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const monitorConfig: MonitorConfig | undefined = useMemo(() => ({
    roomId: roomId,
    tuning: monitoringTuning,
  }), [roomId, monitoringTuning]);

  // Attention monitoring — broadcasts via data channel + sends to server API
  // AI monitoring only starts AFTER Go Live — prevents wasting resources before class begins
  // Track whether student has opened the exam tab (stays true until they return)
  const examActiveRef = useRef(false);

  const { attentionScore: selfAttentionScore, isAttentive: selfIsAttentive } = useAttentionMonitor(
    effectiveMonitorEl,
    useCallback((data: AttentionData) => {
      // When student is taking an exam in another tab, override tab_switched → in_exam
      const inExam = examActiveRef.current;
      const effectiveState = (inExam && data.monitorState === 'tab_switched') ? 'in_exam' as const : data.monitorState;

      // ── Engagement enforcement logic ──────────────────────────────
      // Runs every 1.5s (DETECTION_INTERVAL); does not affect exam mode.
      if (!inExam && isSessionLive) {
        const nowMs = Date.now();
        const isTabSwitched = effectiveState === 'tab_switched';
        const isAbsent = effectiveState === 'not_in_frame';

        // --- TAB SWITCHED ---
        if (isTabSwitched) {
          if (tabSwitchedStartRef.current === null) {
            tabSwitchedStartRef.current = nowMs;
            // Do not show a visible warning to the student UI for tab switches; track cumulatively only.
          } else {
            const elapsed = nowMs - tabSwitchedStartRef.current;
            // 3-min continuous tab switch → score is already penalized by hook (pushes 30)
            // but we also force the cumulative counter up
            if (elapsed >= DECAY_THRESHOLD_MS) {
              // Update cumulative with this continuous block (once per tick)
              cumTabSwitchedMs.current = Math.max(cumTabSwitchedMs.current, elapsed);
            }
            // Check cumulative 20-min threshold
            const totalBad = cumTabSwitchedMs.current + cumNotInFrameMs.current;
            if (!exitWarningShownRef.current && totalBad >= EXIT_THRESHOLD_MS) {
              exitWarningShownRef.current = true;
            }
          }
            // Reset not-in-frame tracker when tab switched (mutually exclusive)
          if (notInFrameStartRef.current !== null) {
            cumNotInFrameMs.current += nowMs - notInFrameStartRef.current;
            notInFrameStartRef.current = null;
          }
        } else {
          // Tab is visible — close tab-switch window, accumulate
          if (tabSwitchedStartRef.current !== null) {
            cumTabSwitchedMs.current += nowMs - tabSwitchedStartRef.current;
            tabSwitchedStartRef.current = null;
            // We do not display a tab-switch alert in the student UI; nothing to dismiss here.
          }

          // --- NOT IN FRAME ---
          if (isAbsent) {
            if (notInFrameStartRef.current === null) {
              notInFrameStartRef.current = nowMs;
            } else {
              const elapsed = nowMs - notInFrameStartRef.current;
              // Do not show a visible "not in frame" alert to the student UI; track cumulatively only.
              // Show exit warning if cumulative thresholds are met (handled below).
              // Check cumulative 20-min threshold
              const totalBad = cumTabSwitchedMs.current + cumNotInFrameMs.current + elapsed;
              if (!exitWarningShownRef.current && totalBad >= EXIT_THRESHOLD_MS) {
                exitWarningShownRef.current = true;
              }
            }
          } else {
            // Student returned to frame
            if (notInFrameStartRef.current !== null) {
              cumNotInFrameMs.current += nowMs - notInFrameStartRef.current;
              notInFrameStartRef.current = null;
              // No student-visible alert to clear here because we don't display not_in_frame warnings.
            }
          }
        }
      }
      // ── End engagement enforcement ──────────────────────────────

      try {
        const msg: AttentionMessage = {
          type: 'attention_update',
          studentEmail: localParticipant.identity,
          studentName: localParticipant.name || localParticipant.identity,
          attentionScore: inExam ? 100 : data.attentionScore,
          isAttentive: inExam ? true : data.isAttentive,
          faceDetected: data.faceDetected,
          faceCount: data.faceCount,
          monitorState: effectiveState,
          eyesClosed: data.eyesClosed,
          gazeAway: data.gazeAway,
          headYaw: data.headYaw,
          headPitch: data.headPitch,
          yawning: data.yawning,
          tabVisible: data.tabVisible,
          isInactive: data.isInactive,
          isMobile: data.isMobile,
          timestamp: Date.now(),
        };
        publish(
          new TextEncoder().encode(JSON.stringify(msg)),
          { topic: ATTENTION_TOPIC, reliable: false },
        );
      } catch {}
    }, [localParticipant, isSessionLive, ABSENCE_ALERT_MS, DECAY_THRESHOLD_MS, EXIT_THRESHOLD_MS]),
    isSessionLive, // AI monitoring active whenever session is live, regardless of camera publish state
    monitorConfig,
  );

  // Auto-enable on mount (or after rejoin approval)
  // Both mic AND camera start OFF by default.
  // Camera permission is requested separately via the local monitor stream (AI monitoring).
  const autoEnabled = useRef(false);
  useEffect(() => {
    if (autoEnabled.current) return;
    if (rejoinBlocked) return;
    autoEnabled.current = true;
    // Nothing to auto-enable — mic and camera both start OFF.
    // The local monitor stream (getUserMedia) will request camera permission
    // for AI monitoring without publishing to the room.
  }, [rejoinBlocked]);

  // ── Notification system (slide-in from top-right) ──
  interface Notification {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'chat';
    exiting?: boolean;
  }
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifIdRef = useRef(0);
  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'warning' | 'error' | 'chat' = 'info') => {
    const id = ++notifIdRef.current;
    setNotifications(prev => [...prev.slice(-4), { id, message: msg, type }]);
    // Start exit animation after 3.5s, remove after 4s
    setTimeout(() => setNotifications(prev => prev.map(n => n.id === id ? { ...n, exiting: true } : n)), 3500);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);
  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, exiting: true } : n));
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 300);
  }, []);

  // ── Media approval request system ──
  // Student sends request → teacher approves/denies → media_control response toggles device
  const [micRequestPending, setMicRequestPending] = useState(false);
  const [camRequestPending, setCamRequestPending] = useState(false);

  // Listen for media_control responses from teacher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; type: 'mic' | 'camera'; enabled: boolean };
      if (data.target_id !== 'all' && data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.type === 'mic') {
        setMicRequestPending(false);
        localParticipant.setMicrophoneEnabled(data.enabled).catch(() => {});
        showToast(data.enabled ? 'Microphone turned on by teacher' : 'Microphone turned off by teacher', 'info');
      } else if (data.type === 'camera') {
        setCamRequestPending(false);
        localParticipant.setCameraEnabled(data.enabled).catch(() => {});
        showToast(data.enabled ? 'Camera turned on' : 'Teacher approved — camera turned off', 'success');
      }
    } catch {}
  }, [localParticipant, showToast]);

  useDataChannel('media_control', onMediaControl);

  // ── Leave approval system ──
  // Student sends leave_request → teacher approves/denies → leave_control response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; approved: boolean };
      if (data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.approved) {
        showToast('Teacher approved — please rate your session', 'success');
        setShowLeaveDialog(false);
        setLeaveRequestPending(false);
        if (!feedbackShownRef.current) {
          feedbackShownRef.current = true;
          setShowFeedback(true); // Show feedback dialog before leaving
        }
      } else {
        setLeaveRequestPending(false);
        setLeaveDenied(true);
        showToast('Teacher denied your leave request', 'error');
        setTimeout(() => setLeaveDenied(false), 4000);
      }
    } catch {}
  }, [localParticipant, showToast]);

  useDataChannel('leave_control', onLeaveControl);

  // ── Rejoin approval system ──
  // When student is rejoining (isRejoin=true), they are blocked until teacher approves.
  // Auto-sends rejoin_request on connect → teacher approve/deny → rejoin_control response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onRejoinControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; approved: boolean };
      if (data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.approved) {
        setRejoinBlocked(false);
        setRejoinDenied(false);
        showToast('Teacher approved your rejoin', 'success');
      } else {
        setRejoinDenied(true);
        showToast('Teacher denied your rejoin request', 'error');
      }
    } catch {}
  }, [localParticipant, showToast, onLeave]);

  useDataChannel('rejoin_control', onRejoinControl);

  // ── Full view request system ──
  // Student clicks cutout → sends fullview_request → teacher accepts/declines → fullview_control response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFullviewControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; action: 'accept' | 'decline' };
      if (data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.action === 'accept') {
        setFullviewPending(false);
        setTeacherPopup(true);
        showToast('Teacher accepted — showing full view', 'success');
      } else {
        setFullviewPending(false);
        showToast('Teacher declined the full view request', 'warning');
      }
    } catch {}
  }, [localParticipant, showToast]);

  useDataChannel('fullview_control', onFullviewControl);

  const requestFullview = useCallback(async () => {
    hapticTap();
    if (fullviewPending) return;
    setFullviewPending(true);
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
        })),
        { topic: 'fullview_request', reliable: true },
      );
    } catch {}
    // Auto-cancel after 30 seconds if no response
    setTimeout(() => {
      setFullviewPending(prev => {
        if (prev) showToast('Full view request timed out', 'warning');
        return false;
      });
    }, 30_000);
  }, [fullviewPending, localParticipant, showToast]);

  // ── Agent full view request system ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAgentFullviewControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; action: 'accept' | 'decline' };
      if (data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.action === 'accept') {
        setAgentFullviewPending(false);
        setAgentPopup(true);
        showToast('Counselor accepted — showing full view', 'success');
      } else {
        setAgentFullviewPending(false);
        showToast('Counselor declined the full view request', 'warning');
      }
    } catch {}
  }, [localParticipant, showToast]);

  useDataChannel('agent_fullview_control', onAgentFullviewControl);

  const requestAgentFullview = useCallback(async () => {
    hapticTap();
    if (agentFullviewPending) return;
    setAgentFullviewPending(true);
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
        })),
        { topic: 'agent_fullview_request', reliable: true },
      );
    } catch {}
    setTimeout(() => {
      setAgentFullviewPending(prev => {
        if (prev) showToast('Counselor full view request timed out', 'warning');
        return false;
      });
    }, 30_000);
  }, [agentFullviewPending, localParticipant, showToast]);

  // Auto-send rejoin_request with retry until teacher responds
  // Only send when room is fully connected — publishing before Connected causes
  // "PC manager is closed" UnexpectedConnectionState errors which crash the room.
  useEffect(() => {
    if (!isRejoin || !rejoinBlocked || rejoinDenied) return;
    let cancelled = false;
    const sendRequest = async () => {
      // Guard: only publish when LiveKit room is fully connected
      if (room.state !== ConnectionState.Connected) return;
      try {
        await localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            student_id: localParticipant.identity,
            student_name: localParticipant.name || localParticipant.identity,
          })),
          { topic: 'rejoin_request', reliable: true },
        );
      } catch { /* data channel not ready — retry will handle it */ }
    };
    // Initial send after 3s (give room time to fully connect), then retry every 5s
    const initialTimer = setTimeout(() => {
      if (cancelled) return;
      sendRequest();
    }, 3000);
    const retryInterval = setInterval(() => {
      if (cancelled) return;
      sendRequest();
    }, 5000);
    return () => { cancelled = true; clearTimeout(initialTimer); clearInterval(retryInterval); };
  }, [isRejoin, rejoinBlocked, rejoinDenied, localParticipant, room, rejoinAttempt]);

  const requestLeave = useCallback(async () => {
    hapticTap();
    if (leaveRequestPending) return;
    setLeaveRequestPending(true);
    setLeaveDenied(false);
    showToast('Waiting for teacher approval…', 'warning');
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
        })),
        { topic: 'leave_request', reliable: true },
      );
    } catch {}
    // Auto-cancel after 30 seconds if no response
    setTimeout(() => {
      setLeaveRequestPending((prev) => {
        if (prev) showToast('Leave request timed out — try again', 'warning');
        return false;
      });
    }, 30000);
  }, [leaveRequestPending, localParticipant, showToast]);

  // Request mic toggle — sends to teacher for approval
  const requestToggleMic = useCallback(async () => {
    hapticTap();
    // Turning ON/OFF directly, no teacher approval needed for mic
    if (!isMicOn) {
      try { await localParticipant.setMicrophoneEnabled(true); } catch {}
    } else {
      try { await localParticipant.setMicrophoneEnabled(false); } catch {}
    }
  }, [isMicOn, localParticipant]);

  // Camera toggle — turning ON is immediate; turning OFF needs teacher approval
  const requestToggleCam = useCallback(async () => {
    hapticTap();
    // Turning ON: do it directly, no teacher approval needed
    if (!isCamOn) {
      try { await localParticipant.setCameraEnabled(true); } catch {}
      return;
    }
    // Turning OFF: request teacher approval
    if (camRequestPending) return;
    setCamRequestPending(true);
    showToast('Waiting for teacher approval…', 'warning');
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
          type: 'camera',
          desired: false,
        })),
        { topic: 'media_request', reliable: true },
      );
    } catch {}
    setTimeout(() => setCamRequestPending(false), 15000);
  }, [isCamOn, camRequestPending, localParticipant, showToast]);

  // ── Participant join/leave sound ──
  const prevRemoteIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(remotes.map((p) => p.identity));
    if (prevRemoteIds.current.size > 0) {
      for (const id of currentIds) {
        if (!prevRemoteIds.current.has(id)) { sfxParticipantJoin(); break; }
      }
      for (const id of prevRemoteIds.current) {
        if (!currentIds.has(id)) { sfxParticipantLeave(); break; }
      }
    }
    prevRemoteIds.current = currentIds;
  }, [remotes]);

  // ── Check teacher availability for extension ──
  const checkExtensionAvailability = useCallback(async () => {
    if (extensionChecked.current || extensionStatus !== 'idle') return;
    extensionChecked.current = true;
    setExtensionStatus('checking');
    try {
      const res = await fetch('/api/v1/session-extension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, requested_minutes: 30, check_only: true }),
      });
      if (res.status === 409) {
        const json = await res.json();
        if (json.data?.teacher_busy) {
          setExtensionStatus('unavailable');
          return;
        }
      }
      if (res.ok) {
        const json = await res.json();
        if (json.data?.tiers?.length) setExtensionTiers(json.data.tiers);
        setExtensionStatus('available');
      } else {
        setExtensionStatus('unavailable');
      }
    } catch {
      setExtensionStatus('unavailable');
    }
  }, [roomId, extensionStatus]);

  // ── Submit extension request ──
  const requestExtension = useCallback(async (minutes: 30 | 60 | 120) => {
    setExtensionStatus('pending');
    setShowExtensionModal(false);
    try {
      const res = await fetch('/api/v1/session-extension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, requested_minutes: minutes }),
      });
      const json = await res.json();
      if (json.success) {
        setExtensionRequestId(json.data.request_id);
        setExtensionFeePaise(json.data.extension_fee_paise || 0);
        showToast(`Extension request sent to teacher (+${minutes}min)`, 'info');
        // Notify teacher via data channel
        try {
          await localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({
              student_id: localParticipant.identity,
              student_name: localParticipant.name || localParticipant.identity,
              request_id: json.data.request_id,
              requested_minutes: minutes,
              fee_paise: json.data.extension_fee_paise || 0,
            })),
            { topic: 'extension_request', reliable: true },
          );
        } catch {}
      } else {
        showToast(json.error || 'Extension request failed', 'error');
        setExtensionStatus('available');
      }
    } catch {
      showToast('Network error — try again', 'error');
      setExtensionStatus('available');
    }
  }, [roomId, localParticipant, showToast]);

  // ── Listen for extension_control from teacher ──
  const onExtensionControl = useCallback((msg: unknown) => {
    try {
      const m = msg as { payload?: BufferSource };
      const text = new TextDecoder().decode(m?.payload as ArrayBuffer);
      const data = JSON.parse(text) as { target_id: string; approved?: boolean; status?: string; new_duration?: number; requested_minutes?: number };
      if (data.target_id !== localParticipant.identity) return;
      if (data.approved === true) {
        // Teacher directly approved (no coordinator) — extension applied
        const addedMins = Number(data.requested_minutes) || 0;
        setExtensionMinutes(prev => prev + addedMins);
        setExtensionStatus('approved');
        timeWarningShown.current = false;
        warningSoundedRef.current = false;
        setWarningDismissed(false);
        showToast(`Session extended by ${addedMins} minutes!`, 'success');
        if (data.new_duration && onDurationUpdate) {
          onDurationUpdate(data.new_duration);
        }
      } else if (data.status === 'forwarded') {
        // Teacher approved, now waiting for coordinator
        setExtensionStatus('pending');
        showToast('Teacher approved — waiting for coordinator…', 'info');
      } else if (data.approved === false) {
        setExtensionStatus('rejected');
        showToast('Extension request was denied', 'error');
        setTimeout(() => setExtensionStatus('available'), 5000);
      }
    } catch {}
  }, [localParticipant, showToast, onDurationUpdate]);

  useDataChannel('extension_control', onExtensionControl);

  // ── Poll for coordinator approval when status is 'pending' ──
  useEffect(() => {
    if (extensionStatus !== 'pending' || !extensionRequestId) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/session-extension?room_id=${roomId}`);
        const json = await res.json();
        const reqs = json.data?.requests || [];
        const myReq = reqs.find((r: { id: string }) => r.id === extensionRequestId);
        if (!myReq) return;
        if (myReq.status === 'approved') {
          const addedMins = Number(myReq.requested_minutes) || 0;
          setExtensionMinutes(prev => prev + addedMins);
          setExtensionStatus('approved');
          timeWarningShown.current = false;
          warningSoundedRef.current = false;
          setWarningDismissed(false);
          showToast(`Session extended by ${addedMins} minutes!`, 'success');
          // Notify ClassroomWrapper to update its safety timer
          onDurationUpdate?.(durationMinutes + addedMins);
        } else if (myReq.status === 'rejected_by_coordinator') {
          setExtensionStatus('rejected');
          showToast('Coordinator denied the extension request', 'error');
          setTimeout(() => setExtensionStatus('available'), 5000);
        }
      } catch {}
    }, 5_000);
    return () => clearInterval(iv);
  }, [extensionStatus, extensionRequestId, roomId, showToast, durationMinutes, onDurationUpdate]);

  // ── Check extension availability on mount (non-demo) ──
  useEffect(() => {
    if (!isDemo) checkExtensionAvailability();
  }, [isDemo, checkExtensionAvailability]);

  // ── Warning / expired sound (fire once each) ──
  const warningSoundedRef = useRef(false);
  const expiredSounded = useRef(false);
  useEffect(() => {
    if (isWarning && !warningSoundedRef.current) {
      warningSoundedRef.current = true;
      sfxWarning();
      // Show the warning dialog once
      if (!timeWarningShown.current) {
        timeWarningShown.current = true;
        // For demo rooms, show demo exam dialog
        if (isDemo && !demoExamShown.current) {
          demoExamShown.current = true;
          setShowDemoExam(true);
        }
        // Normal sessions: no popup dialog (warning banner still shows)
      }
      // Check teacher availability for extension
      checkExtensionAvailability();
    }
  }, [isWarning, checkExtensionAvailability]);

  // ── Listen for teacher-initiated exam start (data channel) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onExamStart = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      if (data.action === 'start' && isDemo && !demoExamShown.current) {
        demoExamShown.current = true;
        setShowDemoExam(true);
      }
    } catch {}
  }, [isDemo]);

  const { message: examStartMsg } = useDataChannel('start_demo_exam', onExamStart);
  useEffect(() => { if (examStartMsg) onExamStart(examStartMsg); }, [examStartMsg, onExamStart]);

  // ── Listen for session exam start (data channel) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSessionExamStart = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      // Dedup: ignore identical sends within 3s window but allow resends after that
      const recvBucket = Math.floor(Date.now() / 3000);
      const dedupKey = `${data.topic_id}:${recvBucket}`;
      if (data.action === 'start' && data.topic_id && sessionExamShown.current !== dedupKey) {
        sendSessionExamStatus({
          action: 'received',
          topic_id: data.topic_id,
          can_start: true,
          waiting_camera: false,
        });
        sessionExamShown.current = dedupKey;
        setSessionExamTopicId(data.topic_id);
        setSessionExamTopicTitle(data.topic_title || '');
        setSessionExamSubject(data.subject || '');
        setSessionExamQuestionCount(data.question_count || undefined);
        setShowSessionExam(true);
      }
    } catch {}
  }, [isCamOn, sendSessionExamStatus]);

  const { message: sessionExamStartMsg } = useDataChannel('start_session_exam', onSessionExamStart);
  useEffect(() => { if (sessionExamStartMsg) onSessionExamStart(sessionExamStartMsg); }, [sessionExamStartMsg, onSessionExamStart]);

  useEffect(() => {
    if (!showSessionExam || !sessionExamTopicId || examInProgress) return;
    sendSessionExamStatus({
      action: 'camera_status',
      topic_id: sessionExamTopicId,
      can_start: true,
      waiting_camera: false,
    });
  }, [showSessionExam, sessionExamTopicId, examInProgress, isCamOn, sendSessionExamStatus]);

  // ── Chat message popup notifications (when chat panel is closed) ──
  const chatOpenRef = useRef(chatOpen);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onChatNotify = useCallback((msg: any) => {
    if (chatOpenRef.current) return; // Don't show popup if chat is open
    try {
      const payload = msg?.payload;
      if (!payload) return;
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text);
      // Don't show notification for own messages or other students
      if (data.sender === participantName) return;
      if (data.role && data.role !== 'teacher') return;
      const sender = data.sender || 'Someone';
      const preview = data.text?.length > 60 ? data.text.slice(0, 60) + '…' : data.text;
      showToast(`${sender}: ${preview}`, 'chat');
    } catch {}
  }, [participantName, showToast]);
  useDataChannel('chat', onChatNotify);

  // ── Announcement data channel ──
  const onAnnouncement = useCallback((msg: { payload: Uint8Array | undefined }) => {
    try {
      const payload = msg?.payload;
      if (!payload) return;
      const data = JSON.parse(new TextDecoder().decode(payload));
      if (!data.text) return;
      setAnnouncement({ text: data.text, from: data.from || 'Teacher', priority: data.priority || 'normal' });
      if (announcementTimer.current) clearTimeout(announcementTimer.current);
      const duration = data.priority === 'urgent' ? 30000 : 15000;
      announcementTimer.current = setTimeout(() => setAnnouncement(null), duration);
    } catch {}
  }, []);
  useDataChannel('announcement', onAnnouncement);

  useEffect(() => {
    if (isExpired && !expiredSounded.current) { expiredSounded.current = true; sfxExpired(); }
  }, [isExpired]);

  const handRaisedMicRef = useRef(false); // true if we auto-enabled mic due to hand raise

  const toggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    // Sound + haptic
    if (next) sfxHandRaise(); else sfxHandLower();
    // Auto-manage mic: on raise turn mic on; on lower turn off only if we auto-enabled it
    if (next) {
      const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
      const micAlreadyOn = micPub?.isMuted === false && micPub?.track;
      if (!micAlreadyOn) {
        handRaisedMicRef.current = true;
        localParticipant.setMicrophoneEnabled(true).catch(() => {});
      }
    } else {
      if (handRaisedMicRef.current) {
        handRaisedMicRef.current = false;
        localParticipant.setMicrophoneEnabled(false).catch(() => {});
      }
    }
    await publish(
      new TextEncoder().encode(JSON.stringify({
        student_id: localParticipant.identity,
        student_name: localParticipant.name || localParticipant.identity,
        action: next ? 'raise' : 'lower',
      })),
      { topic: 'hand_raise', reliable: true },
    );
  }, [handRaised, localParticipant, publish]);

  // ── Teacher-initiated hand dismiss ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandDismiss = useCallback((msg: any) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg?.payload));
      // Clear hand if targeted at this student (or broadcast with no target)
      if (!data.target_id || data.target_id === localParticipant.identity) {
        setHandRaised(false);
        // If we auto-enabled mic due to the hand raise, turn it back off
        if (handRaisedMicRef.current) {
          handRaisedMicRef.current = false;
          localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
      }
    } catch {}
  }, [localParticipant]);
  useDataChannel('hand_dismiss', onHandDismiss);

  // ── Teacher cutout overlay ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTeacherCutout = useCallback((msg: any) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg?.payload));
      if (data.type === 'teacher_cutout') setTeacherCutoutActive(!!data.enabled);
    } catch {}
  }, []);
  useDataChannel('teacher_cutout', onTeacherCutout);

  // ── Teacher whisper (private talk to BC/AO) — mute teacher audio for students ──
  const onWhisperSignal = useCallback((msg: any) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg?.payload));
      if (data.type === 'teacher_whisper_start') setTeacherWhispering(true);
      else if (data.type === 'teacher_whisper_stop') setTeacherWhispering(false);
    } catch {}
  }, []);
  useDataChannel('whisper_signal', onWhisperSignal);

  // ── CSS rotation for mobile portrait ──
  const forceRotate = hasScreenShare && isPortrait && isMobile;

  // Use computed viewport height for iOS (100vh lies when Safari toolbar is visible)
  const safeVpH = vpHeight > 0 ? `${vpHeight}px` : '100dvh';

  const wrapStyle: React.CSSProperties = forceRotate
    ? {
        position: 'fixed', top: 0, left: 0,
        width: vpHeight > 0 ? `${vpHeight - kbHeight}px` : `calc(100dvh - ${kbHeight}px)`,
        height: '100vw',
        transform: 'rotate(90deg)', transformOrigin: 'top left',
        marginLeft: '100vw', overflow: 'hidden',
      }
    : { position: 'fixed', inset: 0, height: safeVpH };

  const show = overlayVisible;       // shorthand
  const compact = forceRotate;        // smaller elements when rotated
  const fsCompact = effectiveFullscreen || compact;  // even smaller in fullscreen

  // ─────── RENDER ─────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="bg-black text-white select-none classroom-root"
      style={wrapStyle}
      onPointerDown={showOverlay}
      onPointerMove={showOverlay}
    >
      {/* Hidden local monitor video — used by AI attention monitoring when camera is OFF.
          Never shown to the user; feeds MediaPipe face detection only. */}
      <video
        ref={monitorVideoRef}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        muted
        playsInline
        aria-hidden="true"
      />
      {/* === LAYER 0 — Full-screen content (always visible) === */}
      <div className="absolute inset-0">
        {hasScreenShare && activeScreenHost ? (
          /* ── Immersive layout: Whiteboard FULL SCREEN, cameras as floating overlays ── */
          <div className="relative h-full w-full">
            {/* ── Split-screen layout when both laptop + Flutter screens are live ── */}
            {hasBothScreens && screenView === 'split' && teacher && screenDevice ? (
              <div ref={splitContainerRef} className="relative h-full w-full flex overflow-hidden"
                onPointerMove={(e) => {
                  if (!splitDragRef.current.active) return;
                  const rect = splitContainerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const delta = e.clientX - splitDragRef.current.startX;
                  const newRatio = Math.min(0.85, Math.max(0.15, splitDragRef.current.startRatio + delta / rect.width));
                  setSplitRatio(newRatio);
                }}
                onPointerUp={() => { splitDragRef.current.active = false; }}
                onPointerLeave={() => { splitDragRef.current.active = false; }}
              >
                {/* Left pane — laptop screen share */}
                <div className="relative overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 ring-1 ring-white/20">
                    <svg className="h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                    <span className="text-[10px] font-semibold text-white/80">Laptop</span>
                  </div>
                  <WhiteboardComposite
                    teacher={teacher}
                    teacherScreenDevice={null}
                    hideOverlay={true}
                    preferLaptopScreen={true}
                    className="h-full w-full"
                    onVideoRef={setScreenVideoEl}
                  />
                </div>
                {/* Draggable divider */}
                <div
                  className="relative z-20 flex items-center justify-center cursor-col-resize shrink-0 select-none"
                  style={{ width: '10px', background: 'rgba(255,255,255,0.08)' }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    splitDragRef.current = { active: true, startX: e.clientX, startRatio: splitRatio };
                  }}
                >
                  <div className="h-16 w-1 rounded-full bg-white/40" />
                </div>
                {/* Right pane — Flutter (tablet) screen share */}
                <div className="relative overflow-hidden" style={{ width: `${(1 - splitRatio) * 100 - 10 / (splitContainerRef.current?.offsetWidth || 1000)}%`, flex: 1 }}>
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 ring-1 ring-white/20">
                    <svg className="h-3 w-3 text-primary" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>
                    <span className="text-[10px] font-semibold text-white/80">Whiteboard</span>
                  </div>
                  <WhiteboardComposite
                    teacher={screenDevice}
                    teacherScreenDevice={null}
                    hideOverlay={true}
                    preferLaptopScreen={false}
                    className="h-full w-full"
                  />
                </div>
              </div>
            ) : (
              /* ── Single source layout (default) ── */
              <WhiteboardComposite
                teacher={hasBothScreens && screenView === 'tablet' && screenDevice ? screenDevice : activeScreenHost}
                teacherScreenDevice={hasBothScreens && screenView === 'tablet' ? null : screenDevice}
                hideOverlay={true}
                preferLaptopScreen={hasBothScreens ? screenView === 'laptop' : screenSourcePref === 'laptop'}
                className="h-full w-full"
                onVideoRef={setScreenVideoEl}
              />
            )}

            {/* ── Teacher — cutout overlay OR small PiP tile (hidden during iOS FS — canvas handles it) ── */}
            {teacher && !iosVideoFs && teacherCutoutActive && hasTeacherCam && teacherCamPub ? (
              /* ── CUTOUT MODE: teacher floats as large transparent overlay on screen share ── */
              <div
                className={cn(
                  'absolute z-[200] bottom-0 right-0 pointer-events-none',
                  compact ? 'h-[55%] w-[28%]' : 'h-[65%] w-[28%]',
                )}
                style={{ mixBlendMode: 'screen' }}
                ref={(el) => {
                  if (el) { const v = el.querySelector('video'); if (v) setTeacherVideoEl(v); }
                }}
              >
                <VideoTile
                  participant={teacher}
                  showName={false}
                  playAudio={false}
                  size="small"
                  className="w-full! h-full! rounded-none! border-0! !bg-transparent [&_video]:object-contain [&>div]:!bg-transparent"
                />
              </div>
            ) : teacher && !iosVideoFs && (
              /* ── NORMAL MODE: resizable PiP tile bottom-left ── */
              <div
                className={cn(
                  'absolute z-[51] transition-[transform] duration-500 ease-in-out',
                  fsCompact ? 'bottom-2 left-2' : 'bottom-3 left-3',
                  teacherTileHidden ? '-translate-x-[calc(100%+0.75rem)]' : 'translate-x-0',
                )}
                style={{ width: compact ? 64 : teacherTileW, height: compact ? 64 : Math.round(teacherTileW * 0.75) }}
              >
                {/* Hide/show toggle arrow */}
                <button
                  onClick={() => setTeacherTileHidden(h => !h)}
                  className="absolute -right-6 top-1/2 -translate-y-1/2 z-[52] flex h-7 w-7 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm ring-1 ring-white/30 text-white/80 hover:text-white hover:bg-black/90 transition-colors"
                  title={teacherTileHidden ? 'Show teacher' : 'Hide teacher'}
                >
                  <svg className={cn('h-3.5 w-3.5 transition-transform duration-300', teacherTileHidden && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {hasTeacherCam && teacherCamPub ? (
                  <div
                    className="relative w-full h-full overflow-hidden rounded-xl shadow-2xl shadow-black/50 cursor-pointer"
                    ref={(el) => {
                      if (el) { const v = el.querySelector('video'); if (v) setTeacherVideoEl(v); }
                    }}
                    onClick={() => setTeacherBigScreen(true)}
                  >
                    <VideoTile participant={teacher} showName={false} playAudio={false} size="small" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 ring-1 ring-white/10 max-w-[90%]">
                      <span className="block truncate text-center font-medium text-white/90 text-[10px]">
                        {teacher.name || teacher.identity}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="relative w-full h-full flex items-center justify-center rounded-xl bg-[#202124]/80 backdrop-blur-sm shadow-2xl shadow-black/50 cursor-pointer"
                    onClick={() => setTeacherBigScreen(true)}
                  >
                    <div className="flex items-center justify-center rounded-full bg-[#5f6368] font-semibold text-white h-14 w-14 text-lg">
                      {(teacher.name || teacher.identity || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 ring-1 ring-white/10 max-w-[90%]">
                      <span className="block truncate text-center font-medium text-white/90 text-[10px]">
                        {teacher.name || teacher.identity}
                      </span>
                    </div>
                  </div>
                )}

                {/* Resize handle — bottom-right corner, drag to resize */}
                {!compact && (
                  <div
                    className="absolute bottom-0 right-0 z-[53] h-5 w-5 cursor-se-resize flex items-end justify-end pb-0.5 pr-0.5 opacity-60 hover:opacity-100 transition-opacity"
                    title="Drag to resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      teacherTileDragRef.current = { active: true, startX: e.clientX, startW: teacherTileW };
                    }}
                    onPointerMove={(e) => {
                      if (!teacherTileDragRef.current?.active) return;
                      const delta = e.clientX - teacherTileDragRef.current.startX;
                      const next = Math.min(420, Math.max(120, teacherTileDragRef.current.startW + delta));
                      setTeacherTileW(next);
                    }}
                    onPointerUp={(e) => {
                      if (teacherTileDragRef.current) teacherTileDragRef.current.active = false;
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                  >
                    <svg viewBox="0 0 10 10" className="h-3.5 w-3.5 text-white drop-shadow" fill="currentColor">
                      <path d="M9 1L1 9M5 1L1 5M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* ── Agent (Academic Counselor) cutout — bottom-right ── */}
            {demoAgent && hasAgentCam && (
              <div
                onClick={requestAgentFullview}
                className={cn(
                  'absolute z-40 transition-all duration-300 overflow-hidden rounded-xl shadow-2xl shadow-black/50 cursor-pointer hover:ring-2 hover:ring-purple-400/60',
                  compact
                    ? 'bottom-2 right-2 h-24 w-20'
                    : 'bottom-3 right-3 h-32 w-28 sm:h-36 sm:w-32',
                  agentFullviewPending && 'ring-2 ring-purple-400 animate-pulse',
                )}
              >
                <VideoTile
                  participant={demoAgent}
                  showName={false}
                  playAudio={false}
                  size="small"
                />
                <div className={cn(
                  'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-2 py-0.5 ring-1 ring-white/10',
                  compact ? 'max-w-18' : 'max-w-28',
                )}>
                  <span className={cn('block truncate text-center font-medium text-white/90', compact ? 'text-[7px]' : 'text-[10px]')}>
                    {agentFullviewPending ? 'Requesting…' : 'Academic Counselor'}
                  </span>
                </div>
              </div>
            )}

            {/* ── Teacher big-screen overlay — shown when student taps the teacher PIP tile ── */}
            {teacherBigScreen && teacher && (
              <div
                className="absolute inset-0 z-[60] bg-black flex items-center justify-center cursor-pointer"
                onClick={() => setTeacherBigScreen(false)}
              >
                {hasTeacherCam && teacherCamPub ? (
                  <VideoTile
                    participant={teacher}
                    size="large"
                    showName={false}
                    showMicIndicator={false}
                    playAudio={false}
                    className="h-full w-full border-0! rounded-none!"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#5f6368] text-4xl font-bold text-white">
                      {(teacher.name || teacher.identity || 'T').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-lg font-medium text-white/80">{teacher.name || teacher.identity}</span>
                    <span className="text-sm text-white/50">Camera is off</span>
                  </div>
                )}
                {/* Teacher name label */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-4 py-1.5 ring-1 ring-white/10">
                  <span className="text-sm font-medium text-white/90">{teacher.name || teacher.identity}</span>
                </div>
                {/* Close hint */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/60">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                  Tap anywhere to close
                </div>
              </div>
            )}

            {/* ── Student self-cam — hidden for observe-only (parent) ── */}
            {!observeOnly && <div
              ref={selfVideoContainerRef}
              className={cn(
                'absolute z-40 transition-all duration-500 ease-in-out',
                compact
                  ? 'top-10 h-14 w-20'
                  : 'top-14 h-20 w-28 sm:h-22 sm:w-30',
                selfieHidden ? '-translate-x-[calc(100%+0.75rem)]' : 'translate-x-0',
                compact ? 'left-2' : 'left-3',
              )}
            >
              {/* Hide/show toggle arrow */}
              <button
                onClick={() => setSelfieHidden(h => !h)}
                className="absolute -right-5 top-1/2 -translate-y-1/2 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/20 text-white/70 hover:text-white transition-colors"
              >
                <svg className={cn('h-3 w-3 transition-transform duration-300', selfieHidden && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {isCamOn ? (
                <div className="relative h-full w-full rounded-lg overflow-hidden ring-1 ring-white/20 shadow-xl shadow-black/40">
                  <div className="h-full w-full" style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}>
                    <VideoTile participant={localParticipant} size="small" mirror={false} showName={false} showMicIndicator={false} className="w-full! h-full! rounded-none! border-0! object-cover" />
                  </div>
                  {/* Muted indicator */}
                  {!isMicOn && (
                    <div className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 ring-1 ring-black/20">
                      <MicOffIcon className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  {/* Attention score indicator */}
                  {selfAttentionScore < 60 && (
                    <div className="absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/90 ring-1 ring-black/20">
                      <span className="text-[7px] font-bold text-white">{selfAttentionScore}</span>
                    </div>
                  )}
                  {/* Permission warning overlay (local student) */}
                  {(permCamera === 'denied' || permMicrophone === 'denied') && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-2">
                      <div className="text-sm font-bold text-white mb-2">Camera / Microphone Permission Blocked</div>
                      <div className="text-xs text-white/80 mb-3 text-center">Please allow camera and microphone access for this site in your browser settings.</div>
                      <div className="flex gap-2">
                        <button onClick={() => requestPermissions({ audio: true, video: true })} className="rounded bg-white/90 px-3 py-1 text-sm font-semibold">Allow</button>
                        <button onClick={() => checkPermissions()} className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">Check</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full w-full rounded-lg bg-[#202124] ring-1 ring-white/15 shadow-xl shadow-black/40 flex items-center justify-center">
                  <div className={cn(
                    'flex items-center justify-center rounded-full bg-[#5f6368] font-semibold text-white',
                    compact ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs',
                  )}>
                    {(participantName || 'S').charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              {/* "You" label */}
              <div className={cn(
                'absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur-sm px-1.5 py-px',
                compact ? 'max-w-12' : 'max-w-16',
              )}>
                <span className={cn('block truncate text-center font-medium text-white/80', compact ? 'text-[6px]' : 'text-[8px]')}>
                  You
                </span>
              </div>
            </div>}

            {/* ── Student filmstrip — observe-only (parent) mode ── */}
            {observeOnly && otherStudents.length > 0 && (
              <div className="absolute top-14 left-0 right-0 z-50 px-3">
                <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1" style={{ scrollbarWidth: 'none' }}>
                  {otherStudents.map((s) => (
                    <div key={s.identity} onClick={() => setStudentPopupId(s.identity)} className="relative h-20 w-28 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-[#292a2d] ring-1 ring-white/10 hover:ring-white/25 transition">
                      <VideoTile participant={s} size="small" showName showMicIndicator playAudio={false} className="w-full! h-full! rounded-lg!" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : hasTeacherCam && teacher ? (
          observeOnly ? (
            /* ── Observe-only (parent): split screen — teacher left, students right ── */
            <div className="flex h-full bg-[#202124]">
              {/* Teacher — left 50% */}
              <div className="relative w-1/2 min-w-0 h-full">
                <VideoTile
                  participant={teacher}
                  size="large"
                  showName={false}
                  showMicIndicator={false}
                  playAudio={true}
                  className="h-full w-full border-0! rounded-none!"
                />
                {/* Teacher name label */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 ring-1 ring-white/10">
                  <span className="text-xs font-medium text-white/90">{teacher.name || teacher.identity}</span>
                </div>
              </div>
              {/* Students panel — right 50% */}
              {otherStudents.length > 0 ? (
                <div className="w-1/2 min-w-0 flex flex-col bg-[#181818] border-l border-white/5 overflow-hidden">
                  <div className="shrink-0 px-3 py-2 border-b border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-[#9aa0a6] uppercase tracking-wider">Live Classroom</span>
                      <span className="text-[10px] text-[#9aa0a6]">Teacher + {otherStudents.length} Student{otherStudents.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex-1 min-h-0 grid gap-1 p-1',
                      otherStudents.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                    )}
                    style={{
                      gridAutoRows: '1fr',
                    }}
                  >
                    {otherStudents.map((s) => (
                      <div key={s.identity} onClick={() => setStudentPopupId(s.identity)} className="relative min-h-0 cursor-pointer overflow-hidden rounded-lg bg-[#292a2d] ring-1 ring-white/10 hover:ring-white/25 transition">
                        <VideoTile participant={s} size="small" showName showMicIndicator playAudio={false} className="w-full! h-full! rounded-lg!" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* No students yet — teacher fills full width */
                <div className="w-1/2 min-w-0 flex items-center justify-center bg-[#181818] border-l border-white/5">
                  <div className="text-center text-[#9aa0a6]">
                    <svg className="h-10 w-10 mx-auto mb-3 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    <p className="text-sm">No students have joined yet</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
          <div className="relative flex h-full items-center justify-center bg-[#202124]">
            <VideoTile
              participant={teacher}
              size="large"
              showName={false}
              showMicIndicator={false}
              playAudio={true}
              className="h-full w-full border-0! rounded-none!"
            />
            {/* Agent (Academic Counselor) cutout overlay */}
            {demoAgent && hasAgentCam && (
              <div
                onClick={requestAgentFullview}
                className={cn(
                  'absolute z-40 transition-all duration-300 overflow-hidden rounded-xl shadow-2xl shadow-black/50 cursor-pointer hover:ring-2 hover:ring-purple-400/60',
                  compact
                    ? 'bottom-2 right-2 h-24 w-20'
                    : 'bottom-3 right-3 h-32 w-28 sm:h-36 sm:w-32',
                  agentFullviewPending && 'ring-2 ring-purple-400 animate-pulse',
                )}
              >
                <VideoTile
                  participant={demoAgent}
                  showName={false}
                  playAudio={false}
                  size="small"
                />
                <div className={cn(
                  'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-2 py-0.5 ring-1 ring-white/10',
                  compact ? 'max-w-18' : 'max-w-28',
                )}>
                  <span className={cn('block truncate text-center font-medium text-white/90', compact ? 'text-[7px]' : 'text-[10px]')}>
                    {agentFullviewPending ? 'Requesting…' : 'Academic Counselor'}
                  </span>
                </div>
              </div>
            )}
          </div>
          )
        ) : roomEnded ? (
          <div className="flex h-full items-center justify-center bg-[#202124]">
            <div className="text-center px-8">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043]">
                <svg className="h-10 w-10 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-[#e8eaed]">
                Session has ended
              </h2>
              <p className="mt-2 text-sm text-[#9aa0a6]">
                The class session has finished. You will be redirected shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#202124] px-8">
            {/* Self-cam preview — teacher can see this */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/10" style={{ width: '280px', height: '157.5px' }}>
              <VideoTile
                participant={localParticipant}
                size="large"
                mirror={true}
                showName={false}
                showMicIndicator={false}
                className="w-full! h-full! rounded-2xl!"
              />
              {(permCamera === 'denied' || permMicrophone === 'denied') && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 p-3 rounded-2xl">
                  <div className="text-sm font-semibold text-white mb-1">Camera / Microphone Blocked</div>
                  <div className="text-xs text-white/80 mb-3 text-center">Click below to allow camera & mic for this site.</div>
                  <div className="flex gap-2">
                    <button onClick={() => requestPermissions({ audio: true, video: true })} className="rounded bg-white/90 px-3 py-1 text-sm font-semibold">Allow</button>
                    <button onClick={() => checkPermissions()} className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">Check</button>
                  </div>
                </div>
              )}
            </div>
            {/* Status text */}
            <div className="text-center">
              <h2 className="text-lg font-medium text-[#e8eaed]">
                {teacher ? 'Teacher is preparing the class\u2026' : 'Waiting for teacher\u2026'}
              </h2>
              <p className="mt-1.5 text-sm text-[#9aa0a6]">
                Your camera &amp; mic are on — teacher can see and hear you
              </p>
            </div>
            {/* Mic / Camera status pills */}
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                isMicOn ? 'bg-primary/15 text-primary ring-1 ring-green-500/30' : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
              )}>
                {isMicOn ? <MicOnIcon className="h-3.5 w-3.5" /> : <MicOffIcon className="h-3.5 w-3.5" />}
                {isMicOn ? 'Mic on' : 'Mic off'}
              </div>
              <div className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                isCamOn ? 'bg-primary/15 text-primary ring-1 ring-green-500/30' : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
              )}>
                {isCamOn ? <CameraOnIcon className="h-3.5 w-3.5" /> : <CameraOffIcon className="h-3.5 w-3.5" />}
                {isCamOn ? 'Camera on' : 'Camera off'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Teacher audio — muted to 0 during private whisper to BC/AO */}
      {teacher?.getTrackPublication(Track.Source.Microphone)?.track && (
        <AudioTrack
          trackRef={{ participant: teacher, publication: teacher.getTrackPublication(Track.Source.Microphone)!, source: Track.Source.Microphone } as TrackReference}
          volume={teacherWhispering ? 0 : 1}
        />
      )}

      {/* Screen-share audio (tablet/laptop) */}
      {activeScreenHost && activeScreenAudioPub && (
        <AudioTrack
          trackRef={{ participant: activeScreenHost, publication: activeScreenAudioPub, source: Track.Source.ScreenShareAudio } as TrackReference}
        />
      )}

      {/* === NOTIFICATIONS — slide-in from top-right === */}
      <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '22rem' }}>
        {/* Persistent fullview request snackbar */}
        {fullviewPending && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600/30 to-indigo-600/20 px-4 py-3 shadow-2xl ring-1 ring-blue-400/30 backdrop-blur-xl animate-in slide-in-from-right-full fade-in duration-300">
            <div className="relative shrink-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 ring-1 ring-blue-400/30">
                <svg className="h-4 w-4 text-blue-300 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-blue-200 leading-tight">Requesting full view</p>
              <p className="text-[11px] text-blue-300/60 leading-tight mt-0.5">Waiting for teacher approval…</p>
            </div>
            <button
              onClick={() => setFullviewPending(false)}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50 hover:text-white/80 hover:bg-white/20 transition-colors"
              title="Cancel request"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}
        {notifications.map((n) => {
          const colors = {
            info: 'from-blue-500/20 to-blue-600/10 ring-blue-400/30 text-blue-300',
            success: 'from-emerald-500/20 to-emerald-600/10 ring-emerald-400/30 text-primary/80',
            warning: 'from-amber-500/20 to-amber-600/10 ring-amber-400/30 text-amber-300',
            error: 'from-red-500/20 to-red-600/10 ring-red-400/30 text-red-300',
            chat: 'from-indigo-500/20 to-indigo-600/10 ring-indigo-400/30 text-indigo-300',
          }[n.type];
          const icons = {
            info: '💡',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            chat: '💬',
          }[n.type];
          return (
            <div
              key={n.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-xl bg-gradient-to-r px-4 py-3 shadow-2xl ring-1 backdrop-blur-xl transition-all duration-300',
                colors,
                n.exiting
                  ? 'opacity-0 translate-x-full'
                  : 'opacity-100 translate-x-0 animate-in slide-in-from-right-full fade-in duration-300',
              )}
              onClick={() => dismissNotification(n.id)}
            >
              <span className="text-base mt-px shrink-0">{icons}</span>
              <span className="text-[13px] font-medium leading-snug">{n.message}</span>
            </div>
          );
        })}
      </div>

      {/* === ENGAGEMENT ENFORCEMENT ALERTS === */}
      {engagementAlert && engagementAlert.type !== 'exit_warning' && (
        <div className="pointer-events-auto fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92vw] max-w-lg">
          <div className={cn(
            'flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl ring-2 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300',
            engagementAlert.type === 'tab_switched'
              ? 'bg-red-700/95 ring-red-400 text-white'
              : 'bg-amber-600/95 ring-amber-400 text-white',
          )}>
            <span className="text-2xl shrink-0 mt-0.5">
              {engagementAlert.type === 'tab_switched' ? '⚠️' : '👤'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight mb-0.5">
                {engagementAlert.type === 'tab_switched' ? 'Tab Switched Detected' : 'Not Visible on Camera'}
              </p>
              <p className="text-xs leading-snug opacity-90">{engagementAlert.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* === LAYER 1 — Warning / expired banner (always visible) === */}
      {/* TimeWarningDialog hidden for student UI — teacher manages session end */}
      {false && showTimeWarning && remaining !== null && (
        <TimeWarningDialog
          remainingSeconds={remaining ?? 0}
          role="student"
          onDismiss={() => setShowTimeWarning(false)}
        />
      )}
      {showDemoExam && (
        <DemoExamDialog
          roomId={roomId}
          role="student"
          onDismiss={(examOpened) => {
            setShowDemoExam(false);
            // Track whether exam_complete was already sent to prevent duplicates
            let examCompleteSent = false;
            const sendExamComplete = () => {
              if (examCompleteSent) return;
              examCompleteSent = true;
              try {
                localParticipant.publishData(
                  new TextEncoder().encode(JSON.stringify({ action: 'complete' })),
                  { topic: 'exam_complete', reliable: true },
                );
              } catch (err) {
                console.error('[StudentView] Failed to send exam_complete:', err);
              }
            };
            if (!examOpened) {
              // Student skipped exam — notify teacher immediately
              sendExamComplete();
            } else {
              // Student opened exam in new tab — notify teacher when they return
              const onFocus = () => {
                window.removeEventListener('focus', onFocus);
                sendExamComplete();
              };
              window.addEventListener('focus', onFocus);
              // Safety: auto-send after 8 minutes in case focus event never fires
              setTimeout(() => {
                window.removeEventListener('focus', onFocus);
                sendExamComplete();
              }, 8 * 60_000);
            }
          }}
        />
      )}
      {showSessionExam && sessionExamTopicId && (
        <SessionExamDialog
          topicId={sessionExamTopicId}
          topicTitle={sessionExamTopicTitle}
          subject={sessionExamSubject}
          roomId={roomId}
          sessionId={sessionExamSessionId}
          studentEmail={studentEmail}
          studentName={participantName}
          role="student"
          isCameraOn={isCamOn}
          questionCount={sessionExamQuestionCount}
          onEnableCamera={() => { localParticipant.setCameraEnabled(true).catch(() => {}); }}
          onDismiss={(examOpened) => {
            setShowSessionExam(false);
            if (examOpened) {
              sendSessionExamStatus({
                action: 'started',
                topic_id: sessionExamTopicId,
                can_start: true,
                waiting_camera: false,
              });
              examActiveRef.current = true;
              setExamInProgress(true);
            }
          }}
        />
      )}
      {examInProgress && sessionExamTopicId && createPortal(
        <SessionExamClient
          topicId={sessionExamTopicId}
          sessionId={sessionExamSessionId}
          studentEmail={studentEmail}
          studentName={participantName}
          roomId={roomId}
          inline
          onComplete={(resultData) => {
            setExamInProgress(false);
            examActiveRef.current = false;
            sendSessionExamStatus({
              action: 'completed',
              topic_id: sessionExamTopicId,
            });
            try {
              localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify({
                  action: 'complete',
                  result: {
                    ...(resultData || { student_name: participantName }),
                    student_identity: localParticipant.identity,
                    student_email: studentEmail || localParticipant.identity,
                    topic_id: sessionExamTopicId,
                  },
                })),
                { topic: 'session_exam_complete', reliable: true },
              );
            } catch (err) {
              console.error('[StudentView] Failed to send session_exam_complete:', err);
            }
          }}
        />,
        document.body
      )}
      {/* Warning banner hidden for student UI — teacher manages session end */}
      {false && isWarning && !warningDismissed && (
        <div className="absolute top-0 inset-x-0 z-60 flex items-center justify-center gap-3 bg-[#f9ab00] px-4 py-1.5">
          <span className="text-xs font-bold text-[#202124]">
            {'\u26A0'} Session ends in {Math.ceil((remaining ?? 0) / 60)} min
          </span>
          {extensionStatus === 'available' && (
            <button
              onClick={() => setShowExtensionModal(true)}
              className="rounded bg-[#202124] px-2.5 py-0.5 text-[10px] font-bold text-[#f9ab00] hover:bg-[#303134] transition-colors"
            >
              ⏱ Request Extra Time
            </button>
          )}
          {extensionStatus === 'checking' && (
            <span className="text-[10px] font-medium text-[#202124]/70 animate-pulse">Checking availability…</span>
          )}
          {extensionStatus === 'pending' && (
            <span className="text-[10px] font-medium text-[#202124]/70 animate-pulse">⏳ Waiting for approval…</span>
          )}
          {extensionStatus === 'approved' && (
            <span className="text-[10px] font-bold text-[#137333]">✅ Extended!</span>
          )}
          <button onClick={() => setWarningDismissed(true)} className="rounded bg-black/15 px-2 py-0.5 text-[10px] font-medium text-[#202124] hover:bg-black/25">
            Dismiss
          </button>
        </div>
      )}

      {/* Extension button moved to bottom control bar */}

      {/* === Extension Request Modal — hidden for student UI === */}
      {false && showExtensionModal && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden">
            <div className="bg-linear-to-r from-blue-500 to-indigo-500 px-5 py-4 text-center">
              <div className="text-3xl mb-1">⏱</div>
              <h2 className="text-lg font-bold text-white">Request Extra Time</h2>
              <p className="text-xs text-white/70 mt-1">Choose how much additional time you need</p>
            </div>
            <div className="px-5 py-4 space-y-2">
              {([30, 60, 120] as const).map(mins => {
                const label = mins === 30 ? '30 Minutes' : mins === 60 ? '1 Hour' : '2 Hours';
                const tier = extensionTiers.find(t => t.duration_minutes === mins);
                const feeDisplay = tier ? `₹${(tier.rate_paise / 100).toFixed(0)}` : null;
                return (
                  <button
                    key={mins}
                    onClick={() => requestExtension(mins)}
                    className="w-full flex items-center justify-between rounded-xl bg-[#3c4043] hover:bg-[#4a4d51] px-4 py-3 text-left transition-colors"
                  >
                    <div>
                      <span className="text-sm font-semibold text-white">{label}</span>
                      <span className="block text-[10px] text-[#9aa0a6] mt-0.5">+{mins} min extension</span>
                    </div>
                    <div className="text-right">
                      {feeDisplay && <span className="block text-xs font-bold text-primary">{feeDisplay}</span>}
                      <span className="text-[10px] font-medium text-blue-400">Select →</span>
                    </div>
                  </button>
                );
              })}
              <p className="text-[10px] text-[#9aa0a6] text-center pt-1">
                Requires teacher &amp; coordinator approval. An invoice will be generated.
              </p>
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={() => setShowExtensionModal(false)}
                className="w-full rounded-xl bg-[#3c4043]/50 hover:bg-[#3c4043] px-4 py-2.5 text-xs font-medium text-[#9aa0a6] transition-colors"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
      {false && isExpired && !roomEnded && (
        <div className="absolute top-0 inset-x-0 z-60 flex flex-wrap items-center justify-center gap-2 bg-[#f9ab00] px-4 py-1.5">
          {/* Overtime banner hidden — class continues until teacher manually ends it */}
        </div>
      )}

      {/* ── Announcement banner ── */}
      {announcement && (
        <div className={cn(
          'absolute top-0 inset-x-0 z-55 flex items-center gap-3 px-4 py-2.5 animate-in slide-in-from-top duration-300',
          announcement.priority === 'urgent' ? 'bg-red-600' : 'bg-amber-500',
        )}>
          <span className="text-sm font-bold text-white flex-1">
            📢 {announcement.from}: {announcement.text}
          </span>
          <button
            onClick={() => { setAnnouncement(null); if (announcementTimer.current) clearTimeout(announcementTimer.current); }}
            className="text-white/80 hover:text-white text-lg leading-none"
          >×</button>
        </div>
      )}

      {/* ── Exam alert banner ── */}
      {examAlert && !announcement && (
        <div className="absolute top-0 inset-x-0 z-54 flex items-center gap-3 px-4 py-2 bg-indigo-600 animate-in slide-in-from-top duration-300">
          <span className="text-xs font-medium text-white flex-1">
            📝 Upcoming Exam: <strong>{examAlert.title}</strong> ({examAlert.subject}) — {examAlert.date}
          </span>
          <button
            onClick={() => setExamAlert(null)}
            className="text-white/80 hover:text-white text-sm leading-none"
          >×</button>
        </div>
      )}

      {/* === LAYER 2 — Overlay UI (auto-hide) === */}

      {/* -- Top overlay: gradient + info bar -- */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-50 transition-all duration-500 ease-out',
          show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none',
        )}
      >
        <div className={cn(
          'flex items-center justify-between bg-linear-to-b from-black/70 via-black/40 to-transparent',
          compact ? 'px-3 pt-2 pb-8' : 'px-4 pt-3 pb-10',
        )}>
          {/* Left: room name + live */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className={cn('truncate font-medium text-white/95 drop-shadow-sm', compact ? 'text-xs' : 'text-sm')}>
              {roomName}
            </span>
            {topic && (
              <span className={cn('truncate text-white/60 drop-shadow-sm', compact ? 'text-[10px]' : 'text-xs')}>
                — {topic}
              </span>
            )}
          </div>

          {/* Right: countdown + attendance + report + settings */}
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 font-mono font-semibold drop-shadow-sm',
                  compact ? 'text-xs' : 'text-sm',
                  isExpired ? 'bg-amber-500/20 text-amber-300' : isWarning ? 'bg-amber-500/20 text-amber-300' : 'text-white/90',
                )}
              >
                {fmtCountdown(remaining)}
              </span>
            )}
            {lateInfo && (
              <span className={cn(
                'rounded px-1.5 py-0.5 font-medium',
                compact ? 'text-[9px]' : 'text-[10px]',
                lateInfo.late ? 'bg-amber-500/20 text-amber-300' : 'bg-primary/20 text-primary/80',
              )}>
                {lateInfo.late ? `⏰ Late ${lateInfo.minutes}m` : 'On Time'}
              </span>
            )}
            {/* Report + Settings pinned to top-right */}
            <OvBtn on={false} onClick={() => setShowReportTeacher(true)} title="Report Teacher"
              onIcon={<ReportIcon className="w-4 h-4" />} offIcon={<ReportIcon className="w-4 h-4" />}
              compact />
            <VideoQualitySelector quality={videoQuality} onChange={handleQualityChange} compact variant="overlay" dropDirection="down" />
          </div>
        </div>
      </div>

      {/* -- Teacher camera PIP — hidden: teacher camera already visible in main view or split panel --
      {hasTeacherCam && teacher && teacherCamPub && (
        <div
          className={cn(
            'absolute z-40 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 transition-all duration-500 cursor-pointer',
            show ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
            compact ? 'top-2 right-2 w-25 h-17' : 'top-14 right-3 w-40 h-25 sm:w-50 sm:h-31.5',
          )}
          onClick={() => setTeacherPopup(true)}
        >
          <VideoTrack
            trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-2 py-0.5">
            <span className="text-[10px] font-medium text-white/90 drop-shadow-sm">
              {teacher.name || teacher.identity}
            </span>
          </div>
        </div>
      )}
      -- */}

      {/* -- Self-cam PIP (only when NO screen share — circular bubble at top-right) -- */}
      {!hasScreenShare && isCamOn && (
        <div
          ref={selfVideoPipRef}
          className={cn(
            'absolute z-40 overflow-hidden rounded-full ring-2 ring-white/20 shadow-xl shadow-black/40 transition-all duration-500',
            show ? 'opacity-100 scale-100' : 'opacity-40 scale-95',
            compact ? 'top-10 right-2 w-14 h-14' : 'top-14 right-3 w-20 h-20 sm:w-22 sm:h-22',
          )}
        >
          <div className="h-full w-full" style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}>
            <VideoTile participant={localParticipant} size="small" mirror={false} showName={false} showMicIndicator={false} className="w-full! h-full! rounded-none! border-0!" />
          </div>
          {/* Muted indicator */}
          {!isMicOn && (
            <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 ring-1 ring-black/20">
              <MicOffIcon className="h-2.5 w-2.5 text-white" />
            </div>
          )}
          {(permCamera === 'denied' || permMicrophone === 'denied') && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-2">
              <div className="text-[10px] font-semibold text-white mb-1">Camera / Microphone Blocked</div>
              <button onClick={() => requestPermissions({ audio: true, video: true })} className="rounded bg-white/90 px-2 py-0.5 text-xs font-medium">Allow</button>
            </div>
          )}
        </div>
      )}

      {/* -- Hand raised badge (always visible) -- */}
      {handRaised && !observeOnly && (
        <div className={cn(
          'absolute z-40 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-2 shadow-xl shadow-amber-500/20 ring-1 ring-amber-400/40 animate-in slide-in-from-right fade-in duration-300',
          compact ? 'top-10 right-2' : 'top-14 right-3',
        )}>
          <span className="text-sm animate-bounce">{'\u270B'}</span>
          <span className="text-[11px] font-bold text-white tracking-wide">Hand Raised</span>
        </div>
      )}

      {/* -- Bottom overlay: gradient + controls -- */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-50 transition-all duration-500 ease-out',
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className={cn(
          'relative flex items-center bg-linear-to-t from-black/70 via-black/40 to-transparent',
          compact ? 'gap-2.5 px-3 pt-8 pb-2.5' : 'gap-3 px-5 pt-10 pb-4',
        )}>
          {/* ── Centre group: primary controls ── */}
          <div className={cn('flex items-center flex-1 justify-center', compact ? 'gap-2.5' : 'gap-3')}>
            {/* Mic, Camera — hidden for observe-only (parent) */}
            {!observeOnly && (
              <>
                <OvBtn on={isCamOn} onClick={requestToggleCam}
                  title={camRequestPending ? 'Waiting for approval…' : isCamOn ? 'Request camera off' : 'Request camera on'}
                  onIcon={<CameraOnIcon className="w-5 h-5" />} offIcon={<CameraOffIcon className="w-5 h-5" />}
                  offDanger compact={compact} pending={camRequestPending} />
                <OvBtn on={isMicOn} onClick={requestToggleMic}
                  title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
                  onIcon={<MicOnIcon className="w-5 h-5" />} offIcon={<MicOffIcon className="w-5 h-5" />}
                  offDanger compact={compact} />

                <div className="h-7 w-px bg-white/15" />

                <OvBtn on={handRaised} onClick={toggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}
                  onIcon={<HandRaisedIcon className="w-5 h-5" />} offIcon={<HandRaiseIcon className="w-5 h-5" />}
                  onWarn compact={compact} />
                <OvBtn on={chatOpen} onClick={() => setChatOpen(!chatOpen)} title={chatOpen ? 'Close chat' : 'Chat'}
                  onIcon={<ChatIcon className="w-5 h-5" />} offIcon={<ChatIcon className="w-5 h-5" />}
                  onPrimary compact={compact} />
              </>
            )}

            {/* Screen-view selector */}
            {hasBothScreens && (
              <div className={cn(
                'flex items-center rounded-full overflow-hidden ring-1 ring-white/20 bg-white/10 backdrop-blur-md shadow-lg shrink-0',
                compact ? 'h-10' : 'h-12',
              )}>
                {([
                  { key: 'laptop', label: '1', title: 'Laptop screen only', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  )},
                  { key: 'split', label: '⫶', title: 'Split view (Laptop + Whiteboard)', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                  )},
                  { key: 'tablet', label: '2', title: 'Whiteboard (Flutter) only', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>
                  )},
                ] as { key: 'laptop' | 'split' | 'tablet'; label: string; title: string; icon: React.ReactNode }[]).map((opt, i, arr) => (
                  <button
                    key={opt.key}
                    title={opt.title}
                    onClick={() => setScreenView(opt.key)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-90 px-3',
                      compact ? 'h-10' : 'h-12',
                      screenView === opt.key
                        ? 'bg-[#1a73e8] text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10',
                      i < arr.length - 1 ? 'border-r border-white/15' : '',
                    )}
                  >
                    {opt.icon}
                    <span className="text-[9px] font-bold leading-none">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            <OvBtn on={effectiveFullscreen} onClick={toggleFullscreen}
              title={effectiveFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onIcon={<FullscreenExitIcon className="w-5 h-5" />}
              offIcon={<FullscreenIcon className="w-5 h-5" />}
              compact={compact} />

            <div className="h-7 w-px bg-white/15" />

            {/* Leave */}
            <button
              onClick={() => observeOnly ? onLeave() : setShowLeaveDialog(true)}
              className={cn(
                'flex items-center gap-2 rounded-full bg-[#ea4335] font-medium text-white',
                'transition-all duration-150 hover:bg-[#c5221f] active:scale-95 shadow-lg shadow-red-900/30',
                compact ? 'h-10 px-4 text-xs' : 'h-12 px-5 text-sm',
              )}
            >
              <LeaveIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              <span className={compact ? 'hidden' : 'hidden sm:inline'}>Leave</span>
            </button>
          </div>

        </div>
      </div>

      {/* === LAYER 3 — Panels & dialogs === */}

      {/* Student side panel — slides from right (hidden for observe-only) */}
      {!observeOnly && <div
        className={cn(
          'fixed top-0 right-0 z-80 h-[100dvh] w-80 max-w-[85vw] bg-[#202124] shadow-2xl ring-1 ring-white/8 transition-transform duration-300 ease-out flex flex-col',
          chatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <StudentSidePanel
          roomId={roomId}
          participantName={participantName}
          participantRole="student"
          participantEmail={studentEmail || localParticipant.identity}
          onClose={() => setChatOpen(false)}
          className="flex-1"
        />
      </div>}

      {/* Student feedback dialog — shown after leave approval, before actual leave */}
      {showFeedback && (
        <FeedbackDialog
          roomId={roomId}
          studentEmail={localParticipant.identity}
          studentName={participantName}
          onComplete={() => {
            setShowFeedback(false);
            // Mark feedback as done so /ended page skips the rating form
            try { sessionStorage.setItem(`feedback_submitted_${roomId}`, 'true'); } catch {}
            onLeave();
          }}
        />
      )}

      {/* Report teacher dialog */}
      {showReportTeacher && (
        <ReportTeacherDialog
          roomId={roomId}
          studentEmail={localParticipant.identity}
          studentName={participantName}
          onClose={() => setShowReportTeacher(false)}
          onSubmitted={(category) => {
            try {
              localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify({
                  action: 'teacher_report',
                  student_name: participantName,
                  student_email: localParticipant.identity,
                  category,
                })),
                { topic: 'teacher_report', reliable: true },
              );
            } catch {}
          }}
        />
      )}

      {/* Rejoin blocked overlay — shown when student is rejoining and awaiting teacher approval */}
      {rejoinBlocked && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/6">
            {rejoinDenied ? (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ea4335]/10">
                  <svg className="h-7 w-7 text-[#ea4335]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Rejoin Rejected</h3>
                <p className="mt-2 text-sm text-muted-foreground">Teacher rejected your rejoin request.</p>
                <div className="mt-5 flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setRejoinDenied(false);
                      setRejoinAttempt(a => a + 1);
                    }}
                    className="rounded-xl bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1557b0]"
                  >
                    🔄 Request Again
                  </button>
                  <button
                    onClick={onLeave}
                    className="rounded-xl bg-[#3c4043] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4a4e52]"
                  >
                    Leave
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f9ab00]/10">
                  <svg className="h-7 w-7 text-[#f9ab00] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Waiting for Teacher Approval</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  You left the session earlier. Your rejoin request has been sent to the teacher.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Please wait…</p>
                <button
                  onClick={onLeave}
                  className="mt-6 rounded-xl bg-[#3c4043] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4a4e52]"
                >
                  Cancel & Leave
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leave dialog */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { if (!leaveRequestPending) setShowLeaveDialog(false); }}>
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/6" onClick={(e) => e.stopPropagation()}>
            <div className={cn('mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full', leaveRequestPending ? 'bg-[#f9ab00]/10' : leaveDenied ? 'bg-[#ea4335]/10' : 'bg-[#ea4335]/10')}>
              {leaveRequestPending ? (
                <svg className="h-7 w-7 text-[#f9ab00] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <LeaveIcon className={cn('h-7 w-7', leaveDenied ? 'text-[#ea4335]' : 'text-[#ea4335]')} />
              )}
            </div>
            <h3 className="text-lg font-semibold text-[#e8eaed]">
              {leaveRequestPending ? 'Waiting for teacher…' : leaveDenied ? 'Request denied' : 'Leave this session?'}
            </h3>
            <p className="mt-1 text-sm text-[#9aa0a6]">
              {leaveRequestPending
                ? 'Your leave request has been sent to the teacher.'
                : leaveDenied
                  ? 'The teacher denied your leave request. Try again later.'
                  : 'Teacher will be notified and must approve.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowLeaveDialog(false); setLeaveRequestPending(false); setLeaveDenied(false); }}
                className="flex-1 rounded-full bg-[#3c4043] py-2.5 text-sm font-medium text-[#e8eaed] hover:bg-[#4a4d51]"
              >
                {leaveRequestPending ? 'Cancel' : leaveDenied ? 'OK' : 'Cancel'}
              </button>
              {!leaveRequestPending && !leaveDenied && (
                <button
                  onClick={requestLeave}
                  className="flex-1 rounded-full bg-[#ea4335] py-2.5 text-sm font-medium text-white hover:bg-[#c5221f]"
                >
                  Request Leave
                </button>
              )}
              {leaveDenied && (
                <button
                  onClick={() => { setLeaveDenied(false); requestLeave(); }}
                  className="flex-1 rounded-full bg-[#ea4335] py-2.5 text-sm font-medium text-white hover:bg-[#c5221f]"
                >
                  Request Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Teacher camera enlarged popup */}
      {teacherPopup && teacher && teacherCamPub && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setTeacherPopup(false)}
        >
          <div
            className="relative w-[90vw] max-w-200 aspect-video overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoTrack
              trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-4 py-3">
              <span className="text-sm font-medium text-white drop-shadow-sm">
                {teacher.name || teacher.identity}
              </span>
            </div>
            {/* Close button */}
            <button
              onClick={() => setTeacherPopup(false)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm hover:bg-black/70 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Student camera enlarged popup */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setStudentPopupId(null)}
        >
          <div
            className="relative w-[90vw] max-w-200 aspect-video overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedStudentCamPub ? (
              <VideoTrack
                trackRef={{ participant: selectedStudent, publication: selectedStudentCamPub, source: Track.Source.Camera } as TrackReference}
                className="h-full w-full object-cover"
              />
            ) : (
              <VideoTile participant={selectedStudent} size="large" showName={false} showMicIndicator={false} playAudio={false} className="h-full! w-full! rounded-none!" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-4 py-3">
              <span className="text-sm font-medium text-white drop-shadow-sm">
                {selectedStudent.name || selectedStudent.identity}
              </span>
            </div>
            {/* Close button */}
            <button
              onClick={() => setStudentPopupId(null)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm hover:bg-black/70 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Agent (Counselor) camera enlarged popup */}
      {agentPopup && demoAgent && agentCamPub && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setAgentPopup(false)}
        >
          <div
            className="relative w-[90vw] max-w-200 aspect-video overflow-hidden rounded-2xl shadow-2xl ring-1 ring-purple-400/30"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoTrack
              trackRef={{ participant: demoAgent, publication: agentCamPub, source: Track.Source.Camera } as TrackReference}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-4 py-3">
              <span className="text-sm font-medium text-white drop-shadow-sm">
                Academic Counselor
              </span>
            </div>
            <button
              onClick={() => setAgentPopup(false)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm hover:bg-black/70 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen icons ─────────────────────────────────────
function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FullscreenExitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

// ─── Report icon (flag/shield) ────────────────────────────
function ReportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

// ─── Overlay round button ─────────────────────────────────
function OvBtn({ on, onClick, title, onIcon, offIcon, offDanger, onWarn, onPrimary, compact, pending }: {
  on: boolean; onClick: () => void; title: string;
  onIcon: React.ReactNode; offIcon: React.ReactNode;
  offDanger?: boolean; onWarn?: boolean; onPrimary?: boolean; compact?: boolean; pending?: boolean;
}) {
  const sz = compact ? 'h-10 w-10' : 'h-12 w-12';
  let clr: string;
  if (pending) {
    clr = 'bg-[#f9ab00]/80 text-[#202124] hover:bg-[#e09c00] animate-pulse';
  } else if (on) {
    if (onWarn)    clr = 'bg-[#f9ab00] text-[#202124] hover:bg-[#e09c00]';
    else if (onPrimary) clr = 'bg-[#1a73e8] text-white hover:bg-[#1557b0]';
    else clr = 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md';
  } else {
    clr = offDanger ? 'bg-[#ea4335] text-white hover:bg-[#c5221f]' : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md';
  }
  return (
    <button onClick={onClick} title={title}
      className={cn('relative flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 shadow-lg', sz, clr)}>
      {on ? onIcon : offIcon}
      {pending && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f9ab00] opacity-75" />
          <span className="inline-flex h-3 w-3 rounded-full bg-[#f9ab00]" />
        </span>
      )}
    </button>
  );
}
