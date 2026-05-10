'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useRemoteParticipants,
  useDataChannel,
  AudioTrack,
  VideoTrack,
  useRoomContext,
  type TrackReference,
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionQuality, type RemoteParticipant } from 'livekit-client';
import VideoTile from './VideoTile';
import StudentDetailPanel from './StudentDetailPanel';
import WhiteboardComposite from './WhiteboardComposite';
import ChatPanel from './ChatPanel';
import AttendancePanel from './AttendancePanel';
import ParticipantList from './ParticipantList';
import HomeworkPanel from './HomeworkPanel';
import ExamResultsPanel from './ExamResultsPanel';
import { cn, fmtDateLongIST } from '@/lib/utils';
import { usePlatformName } from '@/components/providers/PlatformProvider';

/* ═════════════════════════════════════════════════════════════════
   CoordinatorLiveView — Full-powered BC session monitoring & control.

   Three view modes:
     - Control  — Split: teacher feed + student grid + action panel
     - Teacher  — Mirrors teacher UI: adaptive grid, attention badges
     - Student  — Mirrors student UI: screen share / whiteboard view

   Features beyond GhostView:
     - Recording start/stop (YouTube)
     - End-class request approve/deny
     - Media request handling
     - Click-to-zoom student detail panel
     - All communications visible (chat, alerts, requests)
   ═════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────
interface StudentAttentionState {
  email: string;
  name: string;
  attentionScore: number;
  isAttentive: boolean;
  faceDetected: boolean;
  faceCount: number;
  monitorState: string;
  eyesClosed: boolean;
  gazeAway: boolean;
  headYaw: number;
  headPitch: number;
  yawning: boolean;
  tabVisible: boolean;
  isInactive: boolean;
  isMobile: boolean;
  lastUpdate: number;
}

interface AIToast {
  id: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
  time: number;
}

interface MonitoringAlert {
  id: string;
  title: string;
  message: string;
  severity: string;
  alert_type: string;
  created_at: string;
}

interface EndClassRequest {
  status: 'pending' | 'approved' | 'denied' | 'none';
  reason?: string;
  requested_at?: string;
}

type ViewMode = 'control' | 'teacher' | 'student';
type SidebarTab = 'approvals' | 'chat' | 'participants' | 'attendance' | 'monitoring' | 'homework' | 'exam_results';

export interface CoordinatorLiveViewProps {
  roomId: string;
  roomName: string;
  observerName: string;
  scheduledStart?: string;
  liveStartedAt?: string;
  durationMinutes?: number;
  topic?: string;
  onLeave: () => void;
}

// ── Helpers ────────────────────────────────────────────────────
function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Meet-style adaptive grid: measures container and picks (cols, rows) that
 * maximise per-tile area assuming 16:9. Beyond `scrollThreshold` participants,
 * switches to fixed-column vertical scroll.
 */
function useAdaptiveGrid(count: number, scrollThreshold = 20, gapPx = 8) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const roRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!node) { roRef.current = null; return; }
    setSize({ w: node.clientWidth, h: node.clientHeight });
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  const layout = useMemo(() => {
    const { w, h } = size;
    const n = count;
    const TILE_ASPECT = 16 / 9;
    if (n <= 0 || w <= 0 || h <= 0) {
      return { cols: 1, rows: 1, tileW: 0, tileH: 0, shouldScroll: false };
    }
    if (n > scrollThreshold) {
      const cols = n <= 30 ? 6 : n <= 49 ? 7 : 8;
      const rows = Math.ceil(n / cols);
      const tileW = Math.max(120, (w - gapPx * (cols - 1)) / cols);
      const tileH = tileW / TILE_ASPECT;
      return { cols, rows, tileW, tileH, shouldScroll: true };
    }
    let best = { cols: 1, rows: n, tileW: 0, tileH: 0, area: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cellW = (w - gapPx * (cols - 1)) / cols;
      const cellH = (h - gapPx * (rows - 1)) / rows;
      if (cellW <= 0 || cellH <= 0) continue;
      const tileW = Math.min(cellW, cellH * TILE_ASPECT);
      const tileH = tileW / TILE_ASPECT;
      const area = tileW * tileH;
      if (area > best.area) best = { cols, rows, tileW, tileH, area };
    }
    return { cols: best.cols, rows: best.rows, tileW: best.tileW, tileH: best.tileH, shouldScroll: false };
  }, [count, size, scrollThreshold, gapPx]);

  return { containerRef, layout };
}

// ══════════════════════════════════════════════════════════════
export default function CoordinatorLiveView({
  roomId,
  roomName,
  observerName,
  scheduledStart,
  liveStartedAt,
  durationMinutes,
  topic,
  onLeave,
}: CoordinatorLiveViewProps) {
  const platformName = usePlatformName();
  // ── View state ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('control');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('approvals');
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  interface ExamTopic { id: string; title: string; subject: string; grade: string; question_count: number; generated_questions?: number; status: string; category?: string; chapter_name?: string; topic_name?: string; }
  type SessionExamStudentTelemetry = {
    sent_at?: number;
    reached_at?: number;
    started_at?: number;
    completed_at?: number;
    waiting_camera?: boolean;
    can_start?: boolean;
    student_name?: string;
    updated_at: number;
  };
  const [sessionExamTopics, setSessionExamTopics] = useState<ExamTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [sessionExamSent, setSessionExamSent] = useState(false);
  const [lastSentTopicId, setLastSentTopicId] = useState('');
  const [sessionExamTelemetryByTopic, setSessionExamTelemetryByTopic] = useState<Record<string, Record<string, SessionExamStudentTelemetry>>>({});
  const [sessionExamResults, setSessionExamResults] = useState<Array<{ student_name: string; score: number; total_marks: number; percentage: number; grade_letter: string }>>([]);
  const [roomSubject, setRoomSubject] = useState('');
  const [roomGrade, setRoomGrade] = useState('');
  const [roomSessionId, setRoomSessionId] = useState('');
  const [resolvedRoomId, setResolvedRoomId] = useState('');

  // ── Recording state ────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);

  // ── End-class request state ────────────────────────────────
  const [endClassRequest, setEndClassRequest] = useState<EndClassRequest>({ status: 'none' });
  const [endClassLoading, setEndClassLoading] = useState(false);

  // ── LiveKit ────────────────────────────────────────────────
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  // ── Connection quality re-render ───────────────────────────
  const [, setConnTick] = useState(0);
  useEffect(() => {
    const handler = () => setConnTick((t) => t + 1);
    room.on(RoomEvent.ConnectionQualityChanged, handler);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handler); };
  }, [room]);

  // ── AI state ───────────────────────────────────────────────
  const [studentAttention, setStudentAttention] = useState<Map<string, StudentAttentionState>>(new Map());
  const [teacherAttention, setTeacherAttention] = useState<StudentAttentionState | null>(null);
  const [aiToasts, setAiToasts] = useState<AIToast[]>([]);
  const lastAlertedRef = useRef<Map<string, number>>(new Map());
  // Tracks when each participant's face first went absent — for 5-min gate
  const absenceSinceRef = useRef<Map<string, number>>(new Map());
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([]);

  // ── Hand raise state ───────────────────────────────────────
  const [raisedHands, setRaisedHands] = useState<Map<string, { name: string; time: number }>>(new Map());
  const processedHandIds = useRef(new Set<string>());

  // ── Media requests from students ───────────────────────────
  const [mediaRequests, setMediaRequests] = useState<Array<{
    id: string;
    student_id: string;
    student_name: string;
    type: 'mic' | 'camera';
    desired: boolean;
    time: number;
  }>>([])

  // ── Leave requests from students ─────────────────────────
  const [leaveRequests, setLeaveRequests] = useState<Array<{
    id: string;
    student_id: string;
    student_name: string;
    time: number;
  }>>([]);

  // ── Timer ──────────────────────────────────────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const onSidebarDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return;
      const delta = sidebarDragRef.current.startX - ev.clientX;
      setSidebarWidth(Math.min(520, Math.max(240, sidebarDragRef.current.startW + delta)));
    };
    const onUp = () => {
      sidebarDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const elapsedSec = useMemo(() => {
    // Use liveStartedAt as the authoritative start (early, on-time, or late)
    const liveMs = liveStartedAt ? new Date(liveStartedAt).getTime() : NaN;
    const scheduledMs = scheduledStart ? new Date(scheduledStart).getTime() : NaN;
    const effectiveStart = !isNaN(liveMs) ? liveMs : scheduledMs;
    if (isNaN(effectiveStart)) return 0;
    return Math.max(0, Math.floor((now - effectiveStart) / 1000));
  }, [scheduledStart, liveStartedAt, now]);

  const remainingSec = useMemo(() => {
    if (!durationMinutes) return null;
    // Use liveStartedAt as the authoritative start (early, on-time, or late)
    const liveMs = liveStartedAt ? new Date(liveStartedAt).getTime() : NaN;
    const scheduledMs = scheduledStart ? new Date(scheduledStart).getTime() : NaN;
    const effectiveStart = !isNaN(liveMs) ? liveMs : scheduledMs;
    if (isNaN(effectiveStart)) return null;
    const end = effectiveStart + durationMinutes * 60_000;
    return Math.max(0, Math.floor((end - now) / 1000));
  }, [scheduledStart, liveStartedAt, durationMinutes, now]);

  // ── Participants ───────────────────────────────────────────
  const teacher = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        if (meta.effective_role || meta.portal_role)
          return (meta.effective_role || meta.portal_role) === 'teacher';
      } catch {}
      return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
    });
  }, [remoteParticipants]);

  const students = useMemo(() => {
    return remoteParticipants.filter((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        if (meta.effective_role || meta.portal_role)
          return (meta.effective_role || meta.portal_role) === 'student';
      } catch {}
      return p.identity.startsWith('student');
    });
  }, [remoteParticipants]);

  // ── Track publications ─────────────────────────────────────
  // Tablet screen device
  const screenDevice = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        if (m.device) return m.device === 'screen' && (m.portal_role === 'teacher' || m.effective_role === 'teacher_screen');
      } catch {}
      return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
    }) ?? null;
  }, [remoteParticipants]);

  const teacherScreen = teacher?.getTrackPublication(Track.Source.ScreenShare);
  const tabletScreen = screenDevice?.getTrackPublication(Track.Source.ScreenShare);
  const hasScreenShare = (!!teacherScreen && !teacherScreen.isMuted) || (!!tabletScreen && !tabletScreen.isMuted);
  const teacherCamera = teacher?.getTrackPublication(Track.Source.Camera);
  const hasTeacherCamera = !!teacherCamera && !teacherCamera.isMuted;

  // ── Screen source preference (laptop vs tablet) — controlled by teacher ──
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

  // Auto-detect for late joiners
  useEffect(() => {
    const hasLaptop = !!teacherScreen && !teacherScreen.isMuted;
    const hasTablet = !!tabletScreen && !tabletScreen.isMuted;
    if (hasLaptop && !hasTablet) setScreenSourcePref('laptop');
    else if (!hasLaptop && hasTablet) setScreenSourcePref('tablet');
  }, [teacherScreen, tabletScreen]);

  // ── AI Attention data channel ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAttentionUpdate = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      const isTeacher = data.role === 'teacher';
      const state: StudentAttentionState = {
        email: data.studentEmail,
        name: data.studentName,
        attentionScore: data.attentionScore,
        isAttentive: data.isAttentive,
        faceDetected: data.faceDetected,
        faceCount: data.faceCount ?? (data.faceDetected ? 1 : 0),
        monitorState: data.monitorState ?? 'attentive',
        eyesClosed: data.eyesClosed ?? false,
        gazeAway: data.gazeAway ?? false,
        headYaw: data.headYaw ?? 0,
        headPitch: data.headPitch ?? 0,
        yawning: data.yawning ?? false,
        tabVisible: data.tabVisible ?? true,
        isInactive: data.isInactive ?? false,
        isMobile: data.isMobile ?? false,
        lastUpdate: Date.now(),
      };
      if (isTeacher) {
        setTeacherAttention(state);
      } else {
        setStudentAttention((prev) => {
          const next = new Map(prev);
          next.set(data.studentEmail, state);
          return next;
        });
      }

      // AI toast alerts for critical states
      const alertNow = Date.now();
      const lastAlert = lastAlertedRef.current.get(data.studentEmail) ?? 0;

      // Track face absence start time — only fire "not in frame" toast after 5 min
      if (!data.faceDetected) {
        if (!absenceSinceRef.current.has(data.studentEmail)) {
          absenceSinceRef.current.set(data.studentEmail, alertNow);
        }
      } else {
        absenceSinceRef.current.delete(data.studentEmail);
      }
      const absenceDuration = data.faceDetected ? 0 : alertNow - (absenceSinceRef.current.get(data.studentEmail) ?? alertNow);

      if (alertNow - lastAlert > 15_000) {
        const stateKey = (data.monitorState ?? '').toLowerCase();
        const score = data.attentionScore;
        const subject = isTeacher ? `⚠️ Teacher ${data.studentName.replace(' (Teacher)', '')}` : data.studentName;
        let toastMsg = '';
        let severity: 'warning' | 'danger' = 'warning';

        if (stateKey === 'eyes_closed') {
          toastMsg = `${subject} appears to be ${isTeacher ? 'not looking at screen' : 'sleeping'}`;
          severity = 'danger';
        } else if (stateKey === 'tab_switched') {
          toastMsg = `${subject} switched to another tab/app`;
          severity = 'danger';
        } else if (!data.faceDetected && absenceDuration >= 300_000) {
          // Only fire "not in frame" toast after 5 continuous minutes of absence
          toastMsg = `${subject} ${isTeacher ? 'left the screen' : 'is not in frame'}`;
          severity = 'danger';
        } else if (score < 30) {
          toastMsg = `${subject} has low attention (${Math.round(score)}%)`;
          severity = 'warning';
        }

        if (toastMsg) {
          lastAlertedRef.current.set(data.studentEmail, alertNow);
          setAiToasts(prev => [
            ...prev.slice(-4),
            { id: `${data.studentEmail}-${alertNow}`, message: toastMsg, severity, time: alertNow },
          ]);
        }
      }
    } catch {}
  }, []);
  useDataChannel('attention_update', onAttentionUpdate);

  // ── Hand raise data channel ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandRaise = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; action: 'raise' | 'lower' };
      const key = `${data.student_id}_${data.action}_${Math.floor(Date.now() / 500)}`;
      if (processedHandIds.current.has(key)) return;
      processedHandIds.current.add(key);
      if (processedHandIds.current.size > 200) {
        const arr = Array.from(processedHandIds.current);
        processedHandIds.current = new Set(arr.slice(-100));
      }
      setRaisedHands((prev) => {
        const next = new Map(prev);
        if (data.action === 'raise') {
          next.set(data.student_id, { name: data.student_name, time: Date.now() });
          // Toast for hand raise
          setAiToasts(prev2 => [...prev2.slice(-4), {
            id: `hand-${data.student_id}-${Date.now()}`,
            message: `${data.student_name} raised their hand`,
            severity: 'info',
            time: Date.now(),
          }]);
        } else {
          next.delete(data.student_id);
        }
        return next;
      });
    } catch {}
  }, []);
  useDataChannel('hand_raise', onHandRaise);

  // ── Media request data channel ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; type: 'mic' | 'camera'; desired: boolean };
      setMediaRequests(prev => [...prev.slice(-19), {
        id: `${data.student_id}-${data.type}-${Date.now()}`,
        student_id: data.student_id,
        student_name: data.student_name,
        type: data.type,
        desired: data.desired,
        time: Date.now(),
      }]);
      setAiToasts(prev => [...prev.slice(-4), {
        id: `media-req-${Date.now()}`,
        message: `${data.student_name} requested ${data.type} ${data.desired ? 'on' : 'off'}`,
        severity: 'info',
        time: Date.now(),
      }]);
    } catch {}
  }, []);
  useDataChannel('media_request', onMediaRequest);

  // ── Leave request data channel ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      const id = `${data.student_id || data.student_name}-leave-${Date.now()}`;
      setLeaveRequests(prev => [...prev.slice(-9), {
        id,
        student_id: data.student_id || data.student_name || 'unknown',
        student_name: data.student_name || 'Student',
        time: Date.now(),
      }]);
      setAiToasts(prev => [...prev.slice(-4), {
        id: `leave-${Date.now()}`,
        message: `${data.student_name || 'Student'} requested to leave`,
        severity: 'info',
        time: Date.now(),
      }]);
    } catch {}
  }, []);
  useDataChannel('leave_request', onLeaveRequest);

  // ── Fullview request data channel ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFullviewRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      setAiToasts(prev => [...prev.slice(-4), {
        id: `fullview-${Date.now()}`,
        message: `${data.student_name || 'Student'} requested full view`,
        severity: 'info',
        time: Date.now(),
      }]);
    } catch {}
  }, []);
  useDataChannel('fullview_request', onFullviewRequest);

  // Auto-dismiss toasts after 6s
  useEffect(() => {
    if (aiToasts.length === 0) return;
    const timer = setTimeout(() => {
      setAiToasts(prev => prev.filter(t => Date.now() - t.time < 6000));
    }, 6000);
    return () => clearTimeout(timer);
  }, [aiToasts]);

  // Clean up departed participants
  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map((p) => p.identity));
    setStudentAttention((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!activeIds.has(key)) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
    setRaisedHands((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
    setMediaRequests((prev) => prev.filter((r) => activeIds.has(r.student_id)));
    setLeaveRequests((prev) => prev.filter((r) => activeIds.has(r.student_id)));
  }, [remoteParticipants]);

  // ── Server monitoring alerts polling ───────────────────────
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/v1/monitoring/session/${roomId}`);
        const data = await res.json();
        if (data.success && data.data?.alerts) setMonitoringAlerts(data.data.alerts.slice(0, 10));
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 15_000);
    return () => clearInterval(iv);
  }, [roomId]);

  // ── Recording status polling ───────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/recording`);
        const data = await res.json();
        if (data.success) setIsRecording(data.data?.recording_status === 'recording');
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 10_000);
    return () => clearInterval(iv);
  }, [roomId]);

  // ── End-class request polling ──────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/end-request`);
        const data = await res.json();
        if (data.success && data.data) {
          setEndClassRequest({
            status: data.data.status ?? 'none',
            reason: data.data.reason,
            requested_at: data.data.requested_at,
          });
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 8_000);
    return () => clearInterval(iv);
  }, [roomId]);

  // ── Recording toggle ───────────────────────────────────────
  const toggleRecording = useCallback(async () => {
    setRecordingLoading(true);
    try {
      if (isRecording) {
        await fetch(`/api/v1/room/${roomId}/recording`, { method: 'DELETE' });
        setIsRecording(false);
      } else {
        await fetch(`/api/v1/room/${roomId}/recording`, { method: 'POST' });
        setIsRecording(true);
      }
    } catch {}
    setRecordingLoading(false);
  }, [isRecording, roomId]);

  // ── End-class request approve/deny ─────────────────────────
  const handleEndClassAction = useCallback(async (action: 'approve' | 'deny') => {
    setEndClassLoading(true);
    try {
      await fetch(`/api/v1/room/${roomId}/end-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setEndClassRequest(prev => ({ ...prev, status: action === 'approve' ? 'approved' : 'denied' }));
      setAiToasts(prev => [...prev.slice(-4), {
        id: `endclass-${Date.now()}`,
        message: action === 'approve' ? 'End-class request approved' : 'End-class request denied',
        severity: action === 'approve' ? 'danger' : 'info',
        time: Date.now(),
      }]);
    } catch {}
    setEndClassLoading(false);
  }, [roomId]);

  // ── Lower hand actions (coordinator can lower hands like teacher) ──
  const lowerHand = useCallback(async (studentId: string) => {
    const hand = raisedHands.get(studentId);
    if (!hand) return;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ student_id: studentId, student_name: hand.name, action: 'lower' })),
        { topic: 'hand_raise', reliable: true },
      );
    } catch {}
    setRaisedHands(prev => { const n = new Map(prev); n.delete(studentId); return n; });
  }, [raisedHands, room]);

  const lowerAllHands = useCallback(async () => {
    for (const [id] of raisedHands) await lowerHand(id);
  }, [raisedHands, lowerHand]);

  // ── Computed metrics ───────────────────────────────────────
  const avgEngagement = useMemo(() => {
    const scores = Array.from(studentAttention.values());
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((s, a) => s + a.attentionScore, 0) / scores.length);
  }, [studentAttention]);

  const camerasOn = useMemo(() => {
    return students.filter((s) => {
      const cam = s.getTrackPublication(Track.Source.Camera);
      return cam && !cam.isMuted;
    }).length;
  }, [students]);

  const handCount = raisedHands.size;

  const sortedHands = useMemo(() => {
    return Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time);
  }, [raisedHands]);

  const totalRequestCount = handCount + mediaRequests.length + leaveRequests.length + (endClassRequest.status === 'pending' ? 1 : 0);

  useEffect(() => {
    (async () => {
      try {
        const roomRes = await fetch(`/api/v1/room/${roomId}`);
        const roomJson = await roomRes.json();
        if (roomJson.success && roomJson.data) {
          const r = roomJson.data;
          setRoomSubject(r.subject || '');
          setRoomGrade(r.grade || '');
          setRoomSessionId(r.batch_session_id || '');
          setResolvedRoomId(r.room_id || '');
        }
      } catch {}
    })();
  }, [roomId]);

  useEffect(() => {
    if (!roomSubject) return;
    (async () => {
      try {
        const params = new URLSearchParams({ subject: roomSubject, status: 'ready' });
        if (roomGrade) params.set('grade', roomGrade);
        const res = await fetch(`/api/v1/session-exam-topics?${params}`);
        const json = await res.json();
        if (json.success) setSessionExamTopics(json.data || []);
      } catch {}
    })();
  }, [roomSubject, roomGrade]);

  const { containerRef: controlGridRef, layout: controlLayout } = useAdaptiveGrid(students.length);
  const { containerRef: teacherGridRef, layout: teacherLayout } = useAdaptiveGrid(students.length);

  // Notes download
  const downloadNotes = () => {
    const content = `${platformName} Coordinator Session Notes\nBatch: ${roomName} (${roomId})\nObserver: ${observerName}\nDate: ${fmtDateLongIST(new Date())}\n${'─'.repeat(50)}\n${notes}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stibe_bc_notes_${roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartSessionExam = useCallback(async (targetIdentities?: string[]) => {
    const topicInfo = sessionExamTopics.find(t => String(t.id) === String(selectedTopicId));
    if (!topicInfo) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        action: 'start',
        topic_id: topicInfo.id,
        topic_title: topicInfo.title,
        subject: topicInfo.subject,
        question_count: topicInfo.question_count,
      }));
      const opts: { topic: string; reliable: boolean; destinationIdentities?: string[] } = { topic: 'start_session_exam', reliable: true };
      if (targetIdentities && targetIdentities.length > 0) opts.destinationIdentities = targetIdentities;
      await room.localParticipant.publishData(payload, opts);
    } catch {}
    const resolvedTargets = (targetIdentities && targetIdentities.length > 0) ? targetIdentities : students.map(s => s.identity);
    setSessionExamTelemetryByTopic(prev => {
      const topicMap = { ...(prev[topicInfo.id] || {}) };
      const now = Date.now();
      for (const identity of resolvedTargets) {
        topicMap[identity] = {
          ...(topicMap[identity] || { updated_at: now }),
          sent_at: now,
          updated_at: now,
        };
      }
      return { ...prev, [topicInfo.id]: topicMap };
    });
    setLastSentTopicId(topicInfo.id);
    setSessionExamSent(true);
  }, [room, selectedTopicId, sessionExamTopics, students]);

  const studentInfoList = useMemo(() =>
    students.map(s => ({ identity: s.identity, name: s.name || s.identity })),
    [students],
  );

  const onSessionExamComplete = useCallback((msg: unknown) => {
    try {
      const raw = msg as { payload?: ArrayBuffer };
      const text = new TextDecoder().decode(raw?.payload);
      const data = JSON.parse(text);
      if (data.action === 'complete' && data.result) {
        setSessionExamResults(prev => [...prev, {
          student_name: data.result.student_name || 'Student',
          score: data.result.score,
          total_marks: data.result.total_marks,
          percentage: data.result.percentage,
          grade_letter: data.result.grade_letter,
        }]);
        const topicId = String(data.result.topic_id || selectedTopicId || '');
        const studentId = String(data.result.student_identity || data.result.student_email || '').trim();
        if (topicId && studentId) {
          setSessionExamTelemetryByTopic(prev => {
            const topicMap = { ...(prev[topicId] || {}) };
            const now = Date.now();
            topicMap[studentId] = {
              ...(topicMap[studentId] || { updated_at: now }),
              completed_at: now,
              waiting_camera: false,
              updated_at: now,
            };
            return { ...prev, [topicId]: topicMap };
          });
        }
      }
    } catch {}
  }, [selectedTopicId]);
  useDataChannel('session_exam_complete', onSessionExamComplete);

  const onSessionExamStatus = useCallback((msg: unknown) => {
    try {
      const raw = msg as { payload?: ArrayBuffer };
      const text = new TextDecoder().decode(raw?.payload);
      const data = JSON.parse(text) as {
        action?: string;
        topic_id?: string;
        student_identity?: string;
        student_name?: string;
        can_start?: boolean;
        waiting_camera?: boolean;
        at?: number;
      };
      const topicId = String(data.topic_id || '').trim();
      const studentId = String(data.student_identity || '').trim();
      if (!topicId || !studentId) return;
      const now = typeof data.at === 'number' ? data.at : Date.now();
      setSessionExamTelemetryByTopic(prev => {
        const topicMap = { ...(prev[topicId] || {}) };
        const existing = topicMap[studentId] || { updated_at: now };
        const next: SessionExamStudentTelemetry = {
          ...existing,
          student_name: data.student_name || existing.student_name,
          can_start: typeof data.can_start === 'boolean' ? data.can_start : existing.can_start,
          waiting_camera: typeof data.waiting_camera === 'boolean' ? data.waiting_camera : existing.waiting_camera,
          updated_at: now,
        };
        if (data.action === 'received') next.reached_at = now;
        if (data.action === 'started') next.started_at = now;
        if (data.action === 'completed') next.completed_at = now;
        topicMap[studentId] = next;
        return { ...prev, [topicId]: topicMap };
      });
    } catch {}
  }, []);
  useDataChannel('session_exam_status', onSessionExamStatus);

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen flex-col bg-[#1a1a1d] text-white select-none">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex h-13 items-center justify-between border-b border-[#3c4043] bg-[#202124] px-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* BC icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8ab4f8]/20">
            <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-[#e8eaed]">{roomName}</span>
            {topic && <span className="text-xs text-[#9aa0a6] ml-1">— {topic}</span>}
            <span className="ml-2 text-xs text-[#9aa0a6]">— Coordinator</span>
          </div>
          {/* Timer */}
          {scheduledStart && (
            <div className="flex items-center gap-2 ml-3 text-xs text-[#9aa0a6]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span className="font-mono">{fmtElapsed(elapsedSec)}</span>
              {remainingSec !== null && (
                <span className={cn('font-mono', remainingSec <= 300 ? 'text-red-400 font-bold' : '')}>
                  ({fmtElapsed(remainingSec)} left)
                </span>
              )}
            </div>
          )}
        </div>

        {/* View mode tabs */}
        <div className="flex items-center rounded-lg bg-[#292a2d] p-0.5">
          {(['control', 'teacher', 'student'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                viewMode === mode
                  ? 'bg-[#8ab4f8] text-[#202124]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed]',
              )}
            >
              {mode === 'control' ? 'Control' : mode === 'teacher' ? 'Teacher View' : 'Student View'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Stats chips */}
          <span className="flex items-center gap-1.5 rounded-full bg-[#292a2d] px-2.5 py-1 text-xs text-[#9aa0a6]">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {students.length}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#292a2d] px-2.5 py-1 text-xs text-[#9aa0a6]">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            {camerasOn}
          </span>
          {handCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-600/20 px-2.5 py-1 text-xs text-amber-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              {handCount}
            </span>
          )}
          {/* Engagement chip */}
          {studentAttention.size > 0 && (
            <span className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
              avgEngagement >= 70 ? 'bg-primary/20 text-primary' :
              avgEngagement >= 40 ? 'bg-amber-600/20 text-amber-400' :
              'bg-red-600/20 text-red-400',
            )}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {avgEngagement}%
            </span>
          )}
          {/* Recording indicator */}
          <button
            onClick={toggleRecording}
            disabled={recordingLoading}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors',
              isRecording
                ? 'bg-red-600/30 text-red-400 hover:bg-red-600/40'
                : 'bg-[#292a2d] text-[#9aa0a6] hover:text-[#e8eaed]',
              recordingLoading && 'opacity-50 pointer-events-none',
            )}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                REC
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-[#5f6368]" />
                REC OFF
              </>
            )}
          </button>
          <div className="h-5 w-px bg-[#3c4043]" />

          {/* ── Right action cluster: audio + sidebar + leave ── */}
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-xs text-primary">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Invisible
            </span>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                audioEnabled ? 'text-blue-400 hover:bg-blue-600/20' : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]'
              )}
              title={audioEnabled ? 'Mute audio' : 'Unmute audio'}
            >
              {audioEnabled ? (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              ) : (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              )}
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                sidebarOpen ? 'bg-[#3c4043] text-[#e8eaed]' : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              )}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              ) : (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              )}
            </button>
            <button
              onClick={onLeave}
              className="rounded-lg bg-[#ea4335] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#c5221f] transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* ── END-CLASS REQUEST BANNER ──────────────────────── */}
      {endClassRequest.status === 'pending' && (
        <div className="flex items-center justify-between border-b border-amber-600/30 bg-amber-950/40 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-500/40">
              <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-200">Teacher requested to end class early</p>
              {endClassRequest.reason && (
                <p className="text-xs text-amber-300/60 mt-0.5">Reason: {endClassRequest.reason}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEndClassAction('deny')}
              disabled={endClassLoading}
              className="rounded-lg bg-[#3c4043] px-4 py-1.5 text-xs font-medium text-[#e8eaed] hover:bg-[#5f6368] disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={() => handleEndClassAction('approve')}
              disabled={endClassLoading}
              className="rounded-lg bg-[#ea4335] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#c5221f] disabled:opacity-50"
            >
              Approve End
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN BODY ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Content area ───────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ═══ CONTROL VIEW ═══ */}
          {viewMode === 'control' && (
            <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
              {/* Teacher tile */}
              <div className="shrink-0 flex gap-3">
                {hasTeacherCamera && teacher ? (
                  <div className="relative rounded-xl overflow-hidden bg-[#292a2d]" style={{ width: 320, height: 200 }}>
                    <VideoTile participant={teacher} size="large" showName showMicIndicator playAudio={audioEnabled} className="w-full! h-full!" />
                    <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-blue-600/80 px-2 py-0.5 text-[9px] text-white font-semibold flex items-center gap-1">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      Teacher
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl bg-[#292a2d] text-[#9aa0a6]" style={{ width: 320, height: 200 }}>
                    <div className="text-center">
                      <svg className="h-8 w-8 mx-auto mb-2 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      <span className="text-xs">{teacher ? 'Camera off' : 'Waiting for teacher…'}</span>
                    </div>
                  </div>
                )}
                {/* Whiteboard / screen share preview */}
                {hasScreenShare && teacher && (
                  <div className="relative rounded-xl overflow-hidden bg-[#292a2d] flex-1" style={{ maxHeight: 200 }}>
                    <WhiteboardComposite teacher={teacher} teacherScreenDevice={screenDevice} preferLaptopScreen={screenSourcePref === 'laptop'} className="h-full w-full rounded-xl" />
                    <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-primary/80 px-2 py-0.5 text-[9px] text-white font-semibold flex items-center gap-1">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      Screen Share
                    </div>
                  </div>
                )}
              </div>

              {/* Student grid */}
              <div className="flex-1 overflow-hidden">
                <div
                  ref={controlGridRef}
                  className={cn(
                    'grid h-full w-full gap-2',
                    controlLayout.shouldScroll ? 'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]' : 'overflow-hidden',
                  )}
                  style={{
                    gridTemplateColumns:
                      controlLayout.tileW > 0
                        ? `repeat(${controlLayout.cols}, ${controlLayout.tileW}px)`
                        : `repeat(${controlLayout.cols}, minmax(0, 1fr))`,
                    gridAutoRows: controlLayout.tileH > 0 ? `${controlLayout.tileH}px` : 'minmax(0, 1fr)',
                    placeContent: 'center',
                  }}
                >
                  {students.map((s) => {
                    const att = studentAttention.get(s.identity);
                    const attScore = att?.attentionScore ?? 100;
                    const isSleeping = att?.monitorState === 'eyes_closed';
                    const isNotLooking = att?.monitorState === 'looking_away';
                    const isLowAtt = attScore < 50;
                    return (
                      <div
                        key={s.identity}
                        className={cn(
                          'relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d] transition-shadow duration-200',
                          isSleeping && 'ring-2 ring-red-500/60',
                          isNotLooking && !isSleeping && 'ring-2 ring-amber-500/60',
                        )}
                      >
                        <VideoTile
                          participant={s}
                          size="large"
                          showName
                          showMicIndicator
                          playAudio={audioEnabled}
                          handRaised={raisedHands.has(s.identity)}
                          connectionQuality={s.connectionQuality}
                          className="rounded-xl!"
                          onClick={() => setSelectedStudentId(s.identity)}
                        />
                        {att && (
                          <div className={cn(
                            'absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm pointer-events-none',
                            isSleeping ? 'bg-red-600/80 text-white' :
                            isLowAtt ? 'bg-amber-500/80 text-white' :
                            'bg-primary/70 text-white'
                          )}>
                            {isSleeping ? (
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M2 4h4l2-2"/><path d="M6 8h4l2-2"/><path d="M10 12h4l2-2"/></svg>
                            ) : isNotLooking ? (
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            ) : attScore >= 75 ? 'OK' : '!'}
                            <span>{attScore}%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <div className="col-span-full flex items-center justify-center text-[#9aa0a6] py-16">
                      <div className="text-center">
                        <svg className="h-10 w-10 mx-auto mb-3 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        No students have joined yet
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TEACHER VIEW ═══ */}
          {viewMode === 'teacher' && (
            <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden relative">
              {/* Info bar */}
              <div className="flex items-center justify-between px-1 shrink-0">
                <span className="text-xs text-[#9aa0a6]">
                  {students.length} student{students.length !== 1 ? 's' : ''} — Teacher perspective
                </span>
              </div>

              {hasScreenShare && teacher ? (
                /* Whiteboard + student strip — like TeacherView */
                <div className="flex flex-1 flex-col gap-2 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-hidden rounded-xl">
                    <WhiteboardComposite teacher={teacher} teacherScreenDevice={screenDevice} preferLaptopScreen={screenSourcePref === 'laptop'} className="h-full w-full" />
                  </div>
                  {students.length > 0 && (
                    <div className="flex h-25 gap-2 overflow-x-auto overflow-y-hidden shrink-0">
                      {students.map((s) => (
                        <div key={s.identity} className="relative h-full w-32.5 shrink-0 overflow-hidden rounded-lg">
                          <VideoTile
                            participant={s}
                            size="small"
                            showName
                            showMicIndicator
                            playAudio={audioEnabled}
                            handRaised={raisedHands.has(s.identity)}
                            connectionQuality={s.connectionQuality}
                            className="w-full! h-full! rounded-lg!"
                            onClick={() => setSelectedStudentId(s.identity)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Student grid — like TeacherView adaptive grid */
                <div
                  ref={teacherGridRef}
                  className={cn(
                    'grid flex-1 w-full gap-2',
                    teacherLayout.shouldScroll ? 'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]' : 'overflow-hidden',
                  )}
                  style={{
                    gridTemplateColumns:
                      teacherLayout.tileW > 0
                        ? `repeat(${teacherLayout.cols}, ${teacherLayout.tileW}px)`
                        : `repeat(${teacherLayout.cols}, minmax(0, 1fr))`,
                    gridAutoRows: teacherLayout.tileH > 0 ? `${teacherLayout.tileH}px` : 'minmax(0, 1fr)',
                    placeContent: 'center',
                  }}
                >
                  {students.map((s) => {
                    const att = studentAttention.get(s.identity);
                    const attScore = att?.attentionScore ?? 100;
                    const isSleeping = att?.monitorState === 'eyes_closed';
                    const isNotLooking = att?.monitorState === 'looking_away';
                    const isLowAtt = attScore < 50;
                    return (
                      <div
                        key={s.identity}
                        className={cn(
                          'relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d] transition-shadow',
                          isSleeping && 'ring-2 ring-red-500/60',
                          isNotLooking && !isSleeping && 'ring-2 ring-amber-500/60',
                        )}
                      >
                        <VideoTile
                          participant={s}
                          size="large"
                          showName
                          showMicIndicator
                          playAudio={audioEnabled}
                          handRaised={raisedHands.has(s.identity)}
                          connectionQuality={s.connectionQuality}
                          className="rounded-xl!"
                          onClick={() => setSelectedStudentId(s.identity)}
                        />
                        {att && (
                          <div className={cn(
                            'absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm pointer-events-none',
                            isSleeping ? 'bg-red-600/80 text-white' :
                            isLowAtt ? 'bg-amber-500/80 text-white' :
                            'bg-primary/70 text-white'
                          )}>
                            {isSleeping ? (
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M2 4h4l2-2"/><path d="M6 8h4l2-2"/><path d="M10 12h4l2-2"/></svg>
                            ) : isNotLooking ? (
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            ) : attScore >= 75 ? 'OK' : '!'}
                            <span>{attScore}%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <div className="col-span-full flex items-center justify-center text-[#9aa0a6] py-16">
                      No students have joined yet
                    </div>
                  )}
                </div>
              )}

              {/* Teacher self-cam PIP (top-left) */}
              {hasTeacherCamera && teacher && (
                <div className="absolute top-7 left-7 z-30 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/8">
                  <VideoTile participant={teacher} size="small" mirror={false} showName={false} showMicIndicator className="w-35! h-26.25! rounded-xl!" />
                </div>
              )}
            </div>
          )}

          {/* ═══ STUDENT VIEW ═══ */}
          {viewMode === 'student' && (
            <div className="flex-1 flex flex-col overflow-hidden relative bg-black">
              {hasScreenShare && teacher ? (
                /* Whiteboard — what students see */
                <div className="flex-1 overflow-hidden p-2">
                  <WhiteboardComposite teacher={teacher} teacherScreenDevice={screenDevice} preferLaptopScreen={screenSourcePref === 'laptop'} className="h-full w-full rounded-xl" />
                </div>
              ) : hasTeacherCamera && teacher ? (
                /* Teacher camera full — what students see when no screen share */
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="relative rounded-2xl overflow-hidden bg-[#292a2d] shadow-2xl" style={{ maxWidth: '80%', maxHeight: '80%', aspectRatio: '16/9' }}>
                    <VideoTile participant={teacher} size="large" showName showMicIndicator playAudio={audioEnabled} className="w-full! h-full!" />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#9aa0a6]">
                  <div className="text-center">
                    <svg className="h-12 w-12 mx-auto mb-3 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <p className="text-sm">Waiting for teacher to share screen or camera…</p>
                  </div>
                </div>
              )}

              {/* Teacher camera PIP on screen share (like student view) */}
              {hasScreenShare && hasTeacherCamera && teacher && (
                <div className="absolute bottom-4 left-4 z-30 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/10" style={{ width: 200, height: 140 }}>
                  <VideoTile participant={teacher} size="small" showName showMicIndicator className="w-full! h-full!" />
                </div>
              )}

              {/* Student count badge */}
              <div className="absolute top-4 right-4 z-20 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white/80 ring-1 ring-white/10">
                Student perspective — {students.length} student{students.length !== 1 ? 's' : ''} in session
              </div>
            </div>
          )}

          {/* Audio tracks (always render if enabled) */}
          {audioEnabled && teacher && teacher.getTrackPublication(Track.Source.Microphone)?.track && (
            <AudioTrack
              trackRef={{
                participant: teacher,
                publication: teacher.getTrackPublication(Track.Source.Microphone)!,
                source: Track.Source.Microphone,
              } as TrackReference}
            />
          )}
          {audioEnabled && students.map((s) => {
            const mic = s.getTrackPublication(Track.Source.Microphone);
            if (!mic || mic.isMuted || !mic.track) return null;
            return (
              <AudioTrack
                key={`audio-${s.identity}`}
                trackRef={{
                  participant: s, publication: mic,
                  source: Track.Source.Microphone,
                } as TrackReference}
              />
            );
          })}
        </div>

        {/* ── RIGHT: Sidebar ───────────────────────────────── */}
        {sidebarOpen && (
          <div className="shrink-0 flex flex-col border-l border-[#3c4043] bg-[#1a1b1e] relative" style={{ width: sidebarWidth }}>
            <div
              onMouseDown={onSidebarDragStart}
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#8ab4f8]/30 transition-colors z-10"
              title="Drag to resize"
            />

            {/* Premium tabs */}
            {(() => {
              const tabs = [
                { id: 'approvals' as const, label: 'Approvals', badge: totalRequestCount > 0 ? totalRequestCount : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>) },
                { id: 'participants' as const, label: 'People', badge: null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },
                { id: 'chat' as const, label: 'Chat', badge: unreadChatCount > 0 ? unreadChatCount : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>) },
                { id: 'monitoring' as const, label: 'Monitor', badge: monitoringAlerts.length > 0 ? monitoringAlerts.length : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z"/><line x1="9" y1="22" x2="15" y2="22"/></svg>) },
                { id: 'homework' as const, label: 'Tasks', badge: null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>) },
                { id: 'attendance' as const, label: 'Attend', badge: null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>) },
                { id: 'exam_results' as const, label: 'Exams', badge: sessionExamSent ? sessionExamResults.length : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>) },
              ];
              return (
                <div className="flex border-b border-[#2d2e32] bg-[#1a1b1e] overflow-x-auto scrollbar-none shrink-0">
                  {tabs.map((tab) => {
                    const isActive = sidebarTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setSidebarTab(tab.id); if (tab.id === 'chat') setUnreadChatCount(0); }}
                        className={cn(
                          'relative flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 min-w-[44px] flex-1 transition-all duration-200 shrink-0',
                          isActive ? 'text-[#8ab4f8]' : 'text-[#6b7280] hover:text-[#9aa0a6]',
                        )}
                      >
                        {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-t-full bg-gradient-to-r from-[#4285f4] to-[#8ab4f8]" />}
                        <span className="relative">
                          {tab.icon}
                          {tab.badge !== null && tab.badge !== undefined && tab.badge > 0 && (
                            <span className={cn(
                              'absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center px-0.5',
                              tab.id === 'approvals' ? 'bg-[#f9ab00]' : tab.id === 'chat' ? 'bg-[#ea4335]' : 'bg-[#4285f4]'
                            )}>
                              {(tab.badge ?? 0) > 9 ? '9+' : tab.badge}
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] font-medium leading-none tracking-wide">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              <div className={sidebarTab === 'chat' ? 'h-full' : 'hidden'}>
                <ChatPanel
                  roomId={roomId}
                  participantName={observerName}
                  participantRole="ghost"
                  onNewMessage={() => { if (sidebarTab !== 'chat') setUnreadChatCount(c => c + 1); }}
                />
              </div>
              {sidebarTab === 'approvals' ? (
                <div className="flex h-full flex-col overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#3c4043] bg-[#1f2023] shrink-0">
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                      <span className="text-xs font-semibold text-[#e8eaed]">Approvals</span>
                    </div>
                    {totalRequestCount > 0 && (
                      <span className="rounded-full bg-[#4285f4]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#8ab4f8]">{totalRequestCount} pending</span>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
                    {endClassRequest.status === 'pending' && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-600/8 border-b border-[#3c4043]">
                          <div className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <span className="text-[11px] font-semibold text-amber-400">End-Class Request</span>
                          </div>
                        </div>
                        <div className="px-3 py-2.5 border-b border-[#3c4043]/30">
                          <p className="text-xs text-[#e8eaed] mb-1">Teacher requested to end class early</p>
                          {endClassRequest.reason && (
                            <p className="text-[10px] text-[#9aa0a6] mb-2">Reason: {endClassRequest.reason}</p>
                          )}
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { handleEndClassAction('approve'); }}
                              disabled={endClassLoading}
                              className="flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 disabled:opacity-50 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { handleEndClassAction('deny'); }}
                              disabled={endClassLoading}
                              className="flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 disabled:opacity-50 transition-colors"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {handCount > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#f9ab00]/8 border-b border-[#3c4043]">
                          <div className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                            <span className="text-[11px] font-semibold text-[#f9ab00]">Raised Hands ({handCount})</span>
                          </div>
                          <button onClick={lowerAllHands} className="text-[10px] text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] rounded px-1.5 py-0.5 transition-colors">Lower all</button>
                        </div>
                        {sortedHands.map(([id, info]) => (
                          <div key={id} className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f9ab00]/20">
                                <svg className="h-3 w-3 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                              </span>
                              <span className="text-xs text-[#e8eaed] truncate">{info.name}</span>
                            </div>
                            <button onClick={() => lowerHand(id)} title="Lower hand" className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {mediaRequests.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a73e8]/8 border-b border-[#3c4043]">
                          <div className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            <span className="text-[11px] font-semibold text-[#8ab4f8]">Media Requests ({mediaRequests.length})</span>
                          </div>
                          <button onClick={() => setMediaRequests([])} className="text-[10px] text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] rounded px-1.5 py-0.5 transition-colors">Clear all</button>
                        </div>
                        {mediaRequests.map((req) => (
                          <div key={req.id} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <span className="flex items-center mt-0.5 shrink-0">
                                {req.type === 'mic' ? (
                                  req.desired
                                    ? <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                    : <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12L9 9z"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                ) : (
                                  req.desired
                                    ? <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                                    : <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/><path d="M21 13V7l-7 5"/></svg>
                                )}
                              </span>
                              <span className="text-xs text-[#e8eaed] break-words"><strong>{req.student_name}</strong> wants to {req.desired ? 'turn on' : 'turn off'} {req.type}</span>
                            </div>
                            <div className="flex gap-1.5 ml-2 shrink-0">
                              <button
                                onClick={async () => {
                                  try {
                                    await room.localParticipant.publishData(
                                      new TextEncoder().encode(JSON.stringify({ target_id: req.student_id, type: req.type, enabled: req.desired })),
                                      { topic: 'media_control', reliable: true },
                                    );
                                  } catch {}
                                  setMediaRequests(prev => prev.filter(r => r.id !== req.id));
                                }}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                              >
                                Approve
                              </button>
                              <button onClick={() => setMediaRequests(prev => prev.filter(r => r.id !== req.id))} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {leaveRequests.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#ea4335]/8 border-b border-[#3c4043]">
                          <div className="flex items-center gap-1.5">
                            <svg className="h-3.5 w-3.5 text-[#f28b82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span className="text-[11px] font-semibold text-[#f28b82]">Leave Requests ({leaveRequests.length})</span>
                          </div>
                          <button onClick={() => setLeaveRequests([])} className="text-[10px] text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] rounded px-1.5 py-0.5 transition-colors">Clear all</button>
                        </div>
                        {leaveRequests.map((req) => (
                          <div key={req.id} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                            <span className="text-xs text-[#e8eaed]"><strong>{req.student_name}</strong> wants to leave</span>
                            <div className="flex gap-1.5 ml-2 shrink-0">
                              <button
                                onClick={async () => {
                                  try {
                                    await room.localParticipant.publishData(
                                      new TextEncoder().encode(JSON.stringify({ target_id: req.student_id, action: 'approve' })),
                                      { topic: 'leave_control', reliable: true },
                                    );
                                  } catch {}
                                  setLeaveRequests(prev => prev.filter(r => r.id !== req.id));
                                }}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                              >
                                Allow
                              </button>
                              <button onClick={() => setLeaveRequests(prev => prev.filter(r => r.id !== req.id))} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {totalRequestCount === 0 && (
                      <div className="flex items-center justify-center px-4 py-8">
                        <p className="text-xs text-[#9aa0a6]">No active requests</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : sidebarTab === 'participants' ? (
                <ParticipantList role="ghost" roomId={roomId} />
              ) : sidebarTab === 'attendance' ? (
                <AttendancePanel roomId={roomId} />
              ) : sidebarTab === 'homework' ? (
                <HomeworkPanel
                  roomId={roomId}
                  role="teacher"
                  participantEmail={room.localParticipant.identity || ''}
                  participantName={observerName}
                  className="h-full"
                />
              ) : sidebarTab === 'exam_results' ? (
                <ExamResultsPanel
                  roomId={resolvedRoomId || roomId}
                  sessionId={roomSessionId || undefined}
                  className="h-full"
                  students={studentInfoList}
                  examTopics={sessionExamTopics}
                  selectedTopicId={selectedTopicId}
                  onSelectTopic={setSelectedTopicId}
                  onSendExam={handleStartSessionExam}
                  examSent={sessionExamSent}
                  lastSentTopicId={lastSentTopicId}
                  telemetryByTopic={sessionExamTelemetryByTopic}
                  isLive={true}
                />
              ) : (
                /* ── AI Monitoring Panel ─────────────────────── */
                <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                  <div className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    AI Session Monitor
                  </div>

                  {/* Engagement score */}
                  <div className="rounded-lg bg-[#292a2d] p-3">
                    <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide">Session Engagement</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 rounded-full bg-[#3c4043] overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', avgEngagement >= 70 ? 'bg-primary' : avgEngagement >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${avgEngagement}%` }}
                        />
                      </div>
                      <span className={cn('text-sm font-bold', avgEngagement >= 70 ? 'text-primary' : avgEngagement >= 40 ? 'text-amber-400' : 'text-red-400')}>
                        {avgEngagement}%
                      </span>
                    </div>
                  </div>

                  {/* Teacher attention card (distinct styling) */}
                  {teacherAttention && (() => {
                    const att = teacherAttention;
                    const isCritical = ['eyes_closed', 'tab_switched', 'not_in_frame'].includes(att.monitorState);
                    const stateLabel: Record<string, string> = {
                      eyes_closed: 'Not looking', tab_switched: 'Tab switched',
                      not_in_frame: 'Left screen', multiple_faces: 'Multiple faces',
                      head_turned: 'Head turned', looking_away: 'Looking away',
                      yawning: 'Yawning', inactive: 'Inactive', distracted: 'Distracted',
                      attentive: 'Engaged', writing_notes: '📝 Writing', thinking: '💡 Thinking',
                      reading_material: '📖 Reading', brief_absence: 'Briefly away',
                    };
                    return (
                      <div className={cn(
                        'rounded-lg border-2 p-2.5',
                        isCritical ? 'border-red-500 bg-red-950/50' :
                        att.attentionScore < 50 ? 'border-amber-500 bg-amber-950/40' :
                        'border-indigo-500/70 bg-indigo-950/30',
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-200 flex items-center gap-1">
                            🎓 {att.name.replace(' (Teacher)', '')}
                          </span>
                          <span className={cn('text-xs font-bold',
                            att.attentionScore >= 70 ? 'text-primary' :
                            att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400',
                          )}>{att.attentionScore}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-indigo-100/80">
                          {stateLabel[att.monitorState] ?? 'Engaged'}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {!att.faceDetected && <span className="rounded bg-red-900/50 px-1 py-0.5 text-[9px] text-red-200 font-semibold">Left Screen</span>}
                          {!att.tabVisible && <span className="rounded bg-purple-900/50 px-1 py-0.5 text-[9px] text-purple-200 font-semibold">Tab Away</span>}
                          {att.eyesClosed && <span className="rounded bg-red-900/40 px-1 py-0.5 text-[9px] text-red-300">Eyes Closed</span>}
                          {att.isInactive && <span className="rounded bg-gray-700/50 px-1 py-0.5 text-[9px] text-gray-300">Inactive</span>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Per-student attention cards */}
                  {Array.from(studentAttention.values())
                    .sort((a, b) => a.attentionScore - b.attentionScore)
                    .map((att) => {
                      const stateConfig: Record<string, { label: string; color: string }> = {
                        eyes_closed:    { label: 'Sleeping', color: 'text-red-400' },
                        tab_switched:   { label: 'Tab Switched', color: 'text-purple-400' },
                        not_in_frame:   { label: 'Not in Frame', color: 'text-red-400' },
                        multiple_faces: { label: 'Multiple Faces', color: 'text-amber-400' },
                        head_turned:    { label: 'Head Turned', color: 'text-amber-400' },
                        looking_away:   { label: 'Looking Away', color: 'text-amber-400' },
                        yawning:        { label: 'Yawning', color: 'text-amber-400' },
                        inactive:       { label: 'Inactive', color: 'text-amber-400' },
                        distracted:     { label: 'Distracted', color: 'text-amber-400' },
                        low_engagement: { label: 'Low Engagement', color: 'text-amber-400' },
                        attentive:      { label: 'Attentive', color: 'text-primary' },
                        writing_notes:  { label: '📝 Writing', color: 'text-blue-400' },
                        brief_absence:  { label: 'Briefly Away', color: 'text-sky-400' },
                        low_visibility: { label: 'Low Visibility', color: 'text-slate-400' },
                        thinking:         { label: '💡 Thinking', color: 'text-cyan-400' },
                        reading_material: { label: '📖 Reading', color: 'text-blue-400' },
                      };
                      const sc = stateConfig[att.monitorState] ?? stateConfig.attentive;
                      const isCritical = ['eyes_closed', 'tab_switched', 'not_in_frame'].includes(att.monitorState);
                      return (
                        <div key={att.email} className={cn(
                          'rounded-lg border p-2.5',
                          isCritical ? 'border-red-600/50 bg-red-950/30' :
                          att.attentionScore < 50 ? 'border-amber-600/50 bg-amber-950/30' :
                          'border-[#3c4043] bg-[#292a2d]',
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#e8eaed] truncate">{att.name}</span>
                            <span className={cn('text-xs font-bold',
                              att.attentionScore >= 70 ? 'text-primary' :
                              att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400',
                            )}>{att.attentionScore}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                            <span className={sc.color}>{sc.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {att.eyesClosed && <span className="rounded bg-red-900/40 px-1 py-0.5 text-[9px] text-red-300">Eyes Closed</span>}
                            {att.gazeAway && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Gaze Away</span>}
                            {(Math.abs(att.headYaw) > 20 || Math.abs(att.headPitch) > 15) && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Head {Math.abs(att.headYaw).toFixed(0)}°</span>}
                            {att.yawning && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Yawning</span>}
                            {!att.tabVisible && <span className="rounded bg-purple-900/40 px-1 py-0.5 text-[9px] text-purple-300">Tab Away</span>}
                            {att.isInactive && <span className="rounded bg-gray-700/50 px-1 py-0.5 text-[9px] text-gray-300">Inactive</span>}
                            {att.faceCount > 1 && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">{att.faceCount} Faces</span>}
                            {att.isMobile && <span className="rounded bg-blue-900/40 px-1 py-0.5 text-[9px] text-blue-300">Mobile</span>}
                          </div>
                        </div>
                      );
                    })}

                  {studentAttention.size === 0 && (
                    <div className="text-center py-8 text-xs text-[#9aa0a6]">Waiting for student attention data...</div>
                  )}

                  {/* Server alerts */}
                  {monitoringAlerts.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide font-semibold">Server Alerts</div>
                      {monitoringAlerts.map((alert) => (
                        <div key={alert.id} className={cn(
                          'rounded-lg border p-2 text-[11px]',
                          alert.severity === 'critical' ? 'border-red-600/50 bg-red-950/30 text-red-300' :
                          'border-amber-600/50 bg-amber-950/30 text-amber-300',
                        )}>
                          <div className="font-semibold">{alert.title}</div>
                          <div className="text-[10px] mt-0.5 opacity-80">{alert.message}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mt-3 pt-3 border-t border-[#3c4043]">
                    <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      Private Notes
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 5000))}
                      placeholder="Type observation notes…"
                      className="h-24 w-full rounded-lg bg-[#292a2d] p-2 text-sm text-[#e8eaed] placeholder:text-[#5f6368] outline-none focus:ring-1 focus:ring-[#8ab4f8] resize-none"
                      maxLength={5000}
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#5f6368]">{notes.length}/5000</span>
                      <button
                        onClick={downloadNotes}
                        disabled={!notes.trim()}
                        className="text-xs text-[#8ab4f8] hover:text-blue-300 disabled:opacity-30 flex items-center gap-1"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save .txt
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Student Detail Zoom Panel ─────────────────────── */}
      {selectedStudentId && (() => {
        const s = students.find(st => st.identity === selectedStudentId);
        if (!s) return null;
        return (
          <StudentDetailPanel
            participant={s}
            attention={studentAttention.get(selectedStudentId)}
            isMuted={false}
            onToggleMute={() => {}}
            onClose={() => setSelectedStudentId(null)}
            handRaised={raisedHands.has(selectedStudentId)}
            connectionQuality={s.connectionQuality}
          />
        );
      })()}

      {/* ── AI Monitoring Toasts (bottom-right, separate from request bell) ── */}
      {aiToasts.length > 0 && (
        <div className="fixed bottom-4 right-3 z-[100] flex flex-col-reverse gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
          {aiToasts.slice(-3).map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto rounded-lg px-4 py-2.5 shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right-5 fade-in duration-300',
                toast.severity === 'danger'
                  ? 'bg-red-600/90 text-white border border-red-500/50'
                  : toast.severity === 'info'
                  ? 'bg-blue-600/90 text-white border border-blue-500/50'
                  : 'bg-amber-600/90 text-white border border-amber-500/50'
              )}
            >
              <span className="flex items-center shrink-0">
                {toast.severity === 'danger' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                ) : toast.severity === 'info' ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                )}
              </span>
              <span className="flex-1 text-xs">{toast.message}</span>
              <button
                onClick={() => setAiToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-2 text-white/70 hover:text-white text-lg leading-none pointer-events-auto"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
