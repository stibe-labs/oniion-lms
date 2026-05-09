'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import RoomMonitor, {
  type RoomData,
  type MonitorAlert,
  type MediaRequest,
  type LeaveRequest,
  type RejoinRequest,
  type StudentAttentionState,
} from '@/components/classroom/RoomMonitor';
import WhiteboardComposite from '@/components/classroom/WhiteboardComposite';
import VideoTile from '@/components/classroom/VideoTile';
import StudentDetailPanel from '@/components/classroom/StudentDetailPanel';
import HeaderBar from '@/components/classroom/HeaderBar';
import ChatPanel from '@/components/classroom/ChatPanel';
import ParticipantList from '@/components/classroom/ParticipantList';
import AttendancePanel from '@/components/classroom/AttendancePanel';
import { useTracks, useRoomContext, useLocalParticipant, useRemoteParticipants, useDataChannel } from '@livekit/components-react';
import { Track, RoomEvent, type RemoteTrackPublication, type RemoteParticipant, type Participant } from 'livekit-client';
import { useTeacherOverlay } from '@/hooks/useTeacherOverlay';
import { useAINotifications } from '@/hooks/useAINotifications';
import { sfxWarning, sfxMediaRequest } from '@/lib/sounds';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   LiveMonitorClient — BC Command Center

   Two modes:
     1. Lobby   — All sessions as cards (scheduled + live). No LiveKit.
     2. Session — Single session deep-dive with teacher + student tiles.

   Features:
     - Go-live approval on session cards + snackbar popups
     - End-class request handling
     - "Enter Session" to monitor any live room
     - Real-time AI attention monitoring (session mode only)
     - Teacher abuse report handling
   ═══════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────
interface LiveSession {
  session_id: string;
  batch_id: string;
  batch_name: string;
  subject: string;
  teacher_email: string;
  teacher_name: string;
  room_name: string;
  status: string;
  started_at: string;
  scheduled_start: string;
  duration_minutes: number;
  student_count: number;
}

interface ScheduledSession {
  session_id: string;
  batch_id: string;
  batch_name: string;
  subject: string;
  teacher_email: string;
  teacher_name: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  student_count: number;
  room_exists: boolean;
  room_name: string | null;
  go_live_status: string | null;
  go_live_requested_at: string | null;
  batch_type: string | null;
  waiting_students: number;
}

interface RoomToken {
  token: string;
  wsUrl: string;
  roomName: string;
}

interface EndClassReq {
  room_name: string;
  batch_name: string;
  teacher_name: string;
  reason: string;
  requested_at: string;
}

interface Snackbar {
  id: string;
  type: 'end-class' | 'go-live';
  teacherName: string;
  batchName: string;
  roomName: string;
  reason?: string;
}

type ViewMode = 'lobby' | 'session';

interface ExtensionReq { id: string; student_email: string; student_name: string; requested_minutes: number; extension_fee_paise: number; status: string; created_at: string; room_name?: string }

// ── Helpers ──────────────────────────────────────────────────
function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function scheduledStartMs(s: ScheduledSession): number {
  const date = typeof s.scheduled_date === 'string' ? s.scheduled_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return new Date(`${date}T${s.start_time}`).getTime();
}

function teacherStatus(s: ScheduledSession, nowMs: number): { label: string; color: string; icon: 'pending' | 'denied' | 'classroom' | 'delayed' | 'waiting' | 'approved'; glow?: boolean } {
  if (s.go_live_status === 'pending') return { label: 'Requesting Go Live', color: 'text-amber-400', icon: 'pending', glow: true };
  if (s.go_live_status === 'denied')  return { label: 'Go Live Denied', color: 'text-red-400', icon: 'denied' };
  if (s.go_live_status === 'approved') return { label: 'Approved — Going Live', color: 'text-emerald-400', icon: 'approved', glow: true };
  if (s.room_exists) return { label: 'In Classroom', color: 'text-emerald-400', icon: 'classroom' };
  const startMs = scheduledStartMs(s);
  const delayMin = Math.floor((nowMs - startMs) / 60_000);
  if (delayMin > 0) return { label: `Delayed ${delayMin} min`, color: 'text-red-400', icon: 'delayed', glow: true };
  return { label: 'Not Entered', color: 'text-[#9aa0a6]', icon: 'waiting' };
}

function timeStatus(s: ScheduledSession, nowMs: number): { label: string; countdown: string | null; urgent: boolean } {
  const startMs = scheduledStartMs(s);
  const diffMs = startMs - nowMs;
  const diffMin = Math.round(diffMs / 60_000);
  let countdown: string | null = null;
  if (diffMs > 0 && diffMs <= 3600_000) {
    const m = Math.floor(diffMs / 60_000);
    const sec = Math.floor((diffMs % 60_000) / 1000);
    countdown = `${m}:${String(sec).padStart(2, '0')}`;
  } else if (diffMs <= 0) {
    const elapsed = Math.abs(diffMs);
    const m = Math.floor(elapsed / 60_000);
    const sec = Math.floor((elapsed % 60_000) / 1000);
    countdown = `+${m}:${String(sec).padStart(2, '0')}`;
  }
  if (diffMin > 60) return { label: `In ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`, countdown: null, urgent: false };
  if (diffMin > 0) return { label: `In ${diffMin} min`, countdown, urgent: diffMin <= 5 };
  if (diffMin === 0) return { label: 'Starting now', countdown, urgent: true };
  return { label: `${Math.abs(diffMin)} min overdue`, countdown, urgent: true };
}

const BATCH_TYPE_LABELS: Record<string, string> = { one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15', one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture', improvement_batch: 'Improvement', custom: 'Custom' };

// ══════════════════════════════════════════════════════════════
export default function LiveMonitorClient({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('lobby');
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);

  const [endClassRequests, setEndClassRequests] = useState<EndClassReq[]>([]);
  const [snackbars, setSnackbars] = useState<Snackbar[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Session monitor state
  const [enteredSession, setEnteredSession] = useState<LiveSession | null>(null);
  const [sessionToken, setSessionToken] = useState<RoomToken | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [alerts, setAlerts] = useState<MonitorAlert[]>([]);
  const [mediaRequests, setMediaRequests] = useState<MediaRequest[]>([]);

  // Session UI state (teacher-like layout)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants' | 'attendance' | 'monitoring'>('monitoring');
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // ── AI critical alert toasts (mirrors teacher UI) ─────────
  const { alerts: aiAlerts, addAlert, clearAlerts } = useAINotifications({ rateLimitMs: 5000 });
  const lastAlertedRef = useRef<Map<string, number>>(new Map());

  // ── Requests bell dropdown (mirrors teacher UI) ────────────
  const requestsBellRef = useRef<HTMLButtonElement>(null);
  const [requestsDropdownOpen, setRequestsDropdownOpen] = useState(false);
  const [requestsDropdownPos, setRequestsDropdownPos] = useState({ top: 0, right: 0 });
  const requestsDropdownRef = useRef<HTMLDivElement>(null);

  const onRequestsBellClick = useCallback(() => {
    if (!requestsDropdownOpen && requestsBellRef.current) {
      const rect = requestsBellRef.current.getBoundingClientRect();
      setRequestsDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setRequestsDropdownOpen(o => !o);
  }, [requestsDropdownOpen]);

  useEffect(() => {
    if (!requestsDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        requestsDropdownRef.current && !requestsDropdownRef.current.contains(e.target as Node) &&
        requestsBellRef.current && !requestsBellRef.current.contains(e.target as Node)
      ) setRequestsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [requestsDropdownOpen]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sessionViewTab, setSessionViewTab] = useState<'class' | 'students'>('class');
  const [showTeacherBigTile, setShowTeacherBigTile] = useState(false);
  const [localMutedStudents, setLocalMutedStudents] = useState<Set<string>>(new Set());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [rejoinRequests, setRejoinRequests] = useState<RejoinRequest[]>([]);

  // Extension request state (polled from API for coordinator approval)
  const [extensionRequests, setExtensionRequests] = useState<ExtensionReq[]>([]);
  const [extensionActionLoading, setExtensionActionLoading] = useState<string | null>(null);

  const [sessionEnded, setSessionEnded] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [showRecordingPrompt, setShowRecordingPrompt] = useState(false);
  // Track which room_names have already shown the recording prompt — never re-show for the same room.
  const promptedRoomsRef = useRef<Set<string>>(new Set());
  const recordingPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const knownEndClassRooms = useRef<Set<string>>(new Set());
  const knownGoLiveIds = useRef<Set<string>>(new Set());

  // ── Timer ──────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-close requests dropdown when all requests are cleared
  useEffect(() => {
    const total = mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length;
    if (total === 0) setRequestsDropdownOpen(false);
  }, [mediaRequests.length, leaveRequests.length, rejoinRequests.length, extensionRequests.length]);

  // ── Fetch sessions ─────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/batch-coordinator/live-sessions');
      const data = await res.json();
      if (data.success) {
        if (data.data?.sessions) setSessions(data.data.sessions);
        if (data.data?.scheduled) setScheduledSessions(data.data.scheduled);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSessions().then(() => setLoading(false));
    const iv = setInterval(fetchSessions, 10_000);
    return () => clearInterval(iv);
  }, [fetchSessions]);

  // ── Heartbeat — tells teachers this BC is online ───────────
  useEffect(() => {
    const ping = () => {
      fetch('/api/v1/batch-coordinator/heartbeat', { method: 'POST' }).catch(() => {});
    };
    ping();
    const iv = setInterval(ping, 15_000);
    return () => clearInterval(iv);
  }, []);


  // ── Recording status polling (session mode only) ───────────
  useEffect(() => {
    if (viewMode !== 'session' || !enteredSession) {
      setIsRecording(false);
      return;
    }
    const roomId = enteredSession.room_name;
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
  }, [viewMode, enteredSession]);

  // ── Extension request polling (session mode — coordinator approval) ──
  useEffect(() => {
    if (viewMode !== 'session' || !enteredSession) {
      setExtensionRequests([]);
      return;
    }
    const roomId = enteredSession.room_name;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/session-extension?room_id=${roomId}&status=pending_coordinator`);
        const data = await res.json();
        if (data.success) setExtensionRequests(data.data?.requests || []);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 8_000);
    return () => clearInterval(iv);
  }, [viewMode, enteredSession]);

  const handleExtensionAction = useCallback(async (reqId: string, action: 'approve' | 'reject') => {
    setExtensionActionLoading(reqId);
    try {
      const res = await fetch('/api/v1/session-extension', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: reqId, action }),
      });
      const json = await res.json();
      if (json.success) {
        setExtensionRequests(prev => prev.filter(r => r.id !== reqId));
      }
    } catch {}
    setExtensionActionLoading(null);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (!enteredSession) return;
    setRecordingLoading(true);
    try {
      if (isRecording) {
        const res = await fetch(`/api/v1/room/${enteredSession.room_name}/recording`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) setIsRecording(false);
      } else {
        const res = await fetch(`/api/v1/room/${enteredSession.room_name}/recording`, { method: 'POST' });
        const data = await res.json();
        if (data.success) setIsRecording(true);
      }
    } catch {}
    setRecordingLoading(false);
  }, [isRecording, enteredSession]);

  // ── End-class request polling ──────────────────────────────
  const fetchEndClassRequests = useCallback(async () => {
    if (sessions.length === 0) return;
    const requests: EndClassReq[] = [];
    await Promise.all(sessions.map(async (s) => {
      try {
        const res = await fetch(`/api/v1/room/${s.room_name}/end-request`);
        const data = await res.json();
        if (data?.data?.status === 'pending') {
          requests.push({
            room_name: s.room_name,
            batch_name: s.batch_name,
            teacher_name: data.data.teacher_name || s.teacher_name || 'Teacher',
            reason: data.data.reason || '',
            requested_at: data.data.requested_at || new Date().toISOString(),
          });
        }
      } catch {}
    }));
    setEndClassRequests(requests);
  }, [sessions]);

  useEffect(() => {
    fetchEndClassRequests();
    const iv = setInterval(fetchEndClassRequests, 5_000);
    return () => clearInterval(iv);
  }, [fetchEndClassRequests]);

  // ── Snackbar: detect new end-class requests ───────────────
  useEffect(() => {
    for (const req of endClassRequests) {
      if (!knownEndClassRooms.current.has(req.room_name)) {
        knownEndClassRooms.current.add(req.room_name);
        sfxWarning();
        setSnackbars(prev => [...prev, { id: `end-${req.room_name}`, type: 'end-class', teacherName: req.teacher_name, batchName: req.batch_name, roomName: req.room_name, reason: req.reason }]);
      }
    }
    const activeRooms = new Set(endClassRequests.map(r => r.room_name));
    for (const k of knownEndClassRooms.current) {
      if (!activeRooms.has(k)) knownEndClassRooms.current.delete(k);
    }
  }, [endClassRequests]);

  // ── Snackbar: detect new go-live requests ──────────────────
  useEffect(() => {
    for (const ss of scheduledSessions) {
      if (ss.go_live_status === 'pending' && !knownGoLiveIds.current.has(ss.session_id)) {
        knownGoLiveIds.current.add(ss.session_id);
        sfxMediaRequest();
        setSnackbars(prev => [...prev, { id: `golive-${ss.session_id}`, type: 'go-live', teacherName: ss.teacher_name || 'Teacher', batchName: ss.batch_name, roomName: ss.session_id }]);
      }
    }
    const activePending = new Set(scheduledSessions.filter(s => s.go_live_status === 'pending').map(s => s.session_id));
    for (const k of knownGoLiveIds.current) {
      if (!activePending.has(k)) knownGoLiveIds.current.delete(k);
    }
  }, [scheduledSessions]);

  // ── Auto-dismiss snackbars after 20s ───────────────────────
  useEffect(() => {
    if (snackbars.length === 0) return;
    const timers = snackbars.map(s => setTimeout(() => {
      setSnackbars(prev => prev.filter(x => x.id !== s.id));
    }, 20_000));
    return () => timers.forEach(clearTimeout);
  }, [snackbars]);

  // ── End-class action ───────────────────────────────────────
  const handleEndClassAction = useCallback(async (roomName: string, action: 'approve' | 'deny') => {
    try {
      await fetch(`/api/v1/room/${roomName}/end-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setEndClassRequests(prev => prev.filter(r => r.room_name !== roomName));
      setSnackbars(prev => prev.filter(s => s.roomName !== roomName));
      fetchEndClassRequests();
    } catch {}
  }, [fetchEndClassRequests]);

  // ── Go-live action ─────────────────────────────────────────
  const handleGoLiveAction = useCallback(async (sessionId: string, action: 'approve' | 'deny') => {
    try {
      await fetch(`/api/v1/batch-sessions/${sessionId}/go-live-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setScheduledSessions(prev => prev.map(s =>
        s.session_id === sessionId
          ? { ...s, go_live_status: action === 'approve' ? 'approved' : 'denied' }
          : s,
      ));
      setSnackbars(prev => prev.filter(s => s.roomName !== sessionId));
      setTimeout(fetchSessions, 2_000);
    } catch {}
  }, [fetchSessions]);

  // ── Enter session ──────────────────────────────────────────
  const enterSession = useCallback(async (session: LiveSession) => {
    setSessionEnded(false);
    setEnteredSession(session);
    setViewMode('session');
    setRoomData(null);
    setAlerts([]);
    setMediaRequests([]);
    try {
      const res = await fetch('/api/v1/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: session.room_name }),
      });
      const data = await res.json();
      if (data.success && data.data?.livekit_token) {
        setSessionToken({
          token: data.data.livekit_token,
          wsUrl: data.data.livekit_url,
          roomName: session.room_name,
        });
        // Show recording prompt 1 minute after entering a live session — fire only once per room.
        if (recordingPromptTimerRef.current) clearTimeout(recordingPromptTimerRef.current);
        if (!promptedRoomsRef.current.has(session.room_name)) {
          recordingPromptTimerRef.current = setTimeout(() => {
            if (!promptedRoomsRef.current.has(session.room_name)) {
              promptedRoomsRef.current.add(session.room_name);
              setShowRecordingPrompt(true);
            }
            recordingPromptTimerRef.current = null;
          }, 60_000);
        }
      }
    } catch {}
  }, []);

  // ── Exit session back to lobby ─────────────────────────────
  const exitSession = useCallback(() => {
    setViewMode('lobby');
    setEnteredSession(null);
    setSessionToken(null);
    setRoomData(null);
    setAlerts([]);
    setMediaRequests([]);
    setLeaveRequests([]);
    setRejoinRequests([]);
    setShowRecordingPrompt(false);
    if (recordingPromptTimerRef.current) {
      clearTimeout(recordingPromptTimerRef.current);
      recordingPromptTimerRef.current = null;
    }
  }, []);

  // ── RoomMonitor callbacks (session mode) ───────────────────
  const handleRoomData = useCallback((_roomName: string, data: RoomData) => {
    setRoomData(data);
  }, []);

  const handleAlert = useCallback((alert: MonitorAlert) => {
    setAlerts(prev => [...prev.slice(-49), alert]);
    // Mirror teacher AI toast for critical student states
    const now = Date.now();
    const studentKey = alert.studentEmail || alert.studentName || alert.message;
    const lastAlert = lastAlertedRef.current.get(studentKey) ?? 0;
    if (now - lastAlert > 15_000 && alert.severity === 'danger') {
      lastAlertedRef.current.set(studentKey, now);
      addAlert(alert.studentName || 'Student', alert.message, { severity: 'danger', category: 'attention' });
    }
  }, [addAlert]);

  const handleMediaRequest = useCallback((req: MediaRequest) => {
    // De-duplicate by studentId + type (only keep latest per student+type)
    setMediaRequests(prev => {
      const filtered = prev.filter(r => !(r.studentId === req.studentId && r.type === req.type));
      return [...filtered.slice(-19), req];
    });
  }, []);

  const handleLeaveRequest = useCallback((req: LeaveRequest) => {
    setLeaveRequests(prev => {
      const filtered = prev.filter(r => r.studentId !== req.studentId);
      return [...filtered, req];
    });
  }, []);

  const handleRejoinRequest = useCallback((req: RejoinRequest) => {
    setRejoinRequests(prev => {
      const filtered = prev.filter(r => r.studentId !== req.studentId);
      return [...filtered, req];
    });
  }, []);

  const monitorCallbacks = useMemo(() => ({
    onRoomData: handleRoomData,
    onAlert: handleAlert,
    onMediaRequest: handleMediaRequest,
    onLeaveRequest: handleLeaveRequest,
    onRejoinRequest: handleRejoinRequest,
  }), [handleRoomData, handleAlert, handleMediaRequest, handleLeaveRequest, handleRejoinRequest]);

  // ── Computed ───────────────────────────────────────────────
  const pendingGoLiveCount = useMemo(() =>
    scheduledSessions.filter(s => s.go_live_status === 'pending').length,
  [scheduledSessions]);

  const delayedCount = useMemo(() =>
    scheduledSessions.filter(s => {
      if (s.room_exists || s.go_live_status === 'pending') return false;
      return scheduledStartMs(s) < now;
    }).length,
  [scheduledSessions, now]);

  const sortedScheduled = useMemo(() => {
    return [...scheduledSessions].sort((a, b) => {
      const aPending = a.go_live_status === 'pending' ? 0 : 1;
      const bPending = b.go_live_status === 'pending' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      const aOverdue = scheduledStartMs(a) < now && !a.room_exists ? 0 : 1;
      const bOverdue = scheduledStartMs(b) < now && !b.room_exists ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return scheduledStartMs(a) - scheduledStartMs(b);
    });
  }, [scheduledSessions, now]);

  // If the session we're monitoring ended, auto-exit to lobby
  useEffect(() => {
    if (viewMode === 'session' && enteredSession) {
      const stillLive = sessions.some(s => s.room_name === enteredSession.room_name);
      if (!stillLive) {
        setSessionEnded(true);
        exitSession();
      }
    }
  }, [sessions, viewMode, enteredSession, exitSession]);

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1d]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-[#9aa0a6]">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#1a1a1d] text-white select-none">

      {/* ── HEADER (lobby only — session is immersive) ─── */}
      {viewMode === 'lobby' && (
      <div className="flex h-13 items-center justify-between border-b border-[#3c4043] bg-[#202124] px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#e8eaed]">Live Monitor</span>
            <span className="ml-2 text-xs text-[#9aa0a6]">
              {sessions.length} live{scheduledSessions.length > 0 ? ` · ${scheduledSessions.length} upcoming` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingGoLiveCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-400 font-bold animate-pulse">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              {pendingGoLiveCount} Go Live
            </span>
          )}
          {delayedCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs text-red-400 font-bold">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {delayedCount} delayed
            </span>
          )}
          {endClassRequests.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-400 font-bold animate-pulse">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
              {endClassRequests.length} End Request
            </span>
          )}
          <div className="h-5 w-px bg-[#3c4043]" />
          <button
            onClick={() => router.push('/batch-coordinator')}
            className="rounded-full bg-[#3c4043] px-3 py-1 text-xs font-medium text-[#e8eaed] hover:bg-[#5f6368]"
          >
            Dashboard
          </button>
        </div>
      </div>
      )}

      {/* ── MAIN BODY ──────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">

        {/* ═══════════════ LOBBY MODE ═══════════════ */}
        {viewMode === 'lobby' && (
          <div className="h-full overflow-auto p-4 space-y-6">

            {/* Empty */}
            {sessions.length === 0 && scheduledSessions.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#292a2d]">
                    {sessionEnded ? (
                      <svg className="h-8 w-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                    ) : (
                      <svg className="h-8 w-8 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-[#e8eaed] mb-1">{sessionEnded ? 'Session Ended' : 'No Sessions Today'}</h2>
                  <p className="text-sm text-[#9aa0a6]">{sessionEnded ? 'The class has ended. You can close this page.' : 'Sessions will appear here automatically when scheduled.'}</p>
                  <button onClick={fetchSessions} className="mt-4 rounded-lg bg-[#292a2d] px-4 py-2 text-sm text-[#8ab4f8] hover:bg-[#3c4043]">Refresh</button>
                </div>
              </div>
            )}

            {/* ── Live Sessions ──────────────────────── */}
            {sessions.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute h-3 w-3 rounded-full bg-red-500 animate-ping opacity-50" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-[#e8eaed] uppercase tracking-wider">
                    Live Sessions ({sessions.length})
                  </h2>
                </div>
                <div className={cn(
                  'grid gap-4',
                  sessions.length === 1 ? 'grid-cols-1 max-w-xl' :
                  sessions.length <= 4 ? 'grid-cols-2' :
                  'grid-cols-3',
                )}>
                  {sessions.map(session => (
                    <LiveSessionCard
                      key={session.session_id}
                      session={session}
                      now={now}
                      endClassReq={endClassRequests.find(r => r.room_name === session.room_name)}
                      onEnter={() => enterSession(session)}
                      onEndClassAction={handleEndClassAction}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Scheduled Sessions ─────────────────── */}
            {scheduledSessions.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <h2 className="text-sm font-semibold text-[#e8eaed] uppercase tracking-wider">
                    Upcoming ({scheduledSessions.length})
                  </h2>
                </div>
                <div className={cn(
                  'grid gap-3',
                  sortedScheduled.length === 1 ? 'grid-cols-1 max-w-xl' :
                  sortedScheduled.length <= 4 ? 'grid-cols-2' :
                  'grid-cols-3',
                )}>
                  {sortedScheduled.map(ss => (
                    <ScheduledCard
                      key={ss.session_id}
                      ss={ss}
                      now={now}
                      onApprove={(id) => handleGoLiveAction(id, 'approve')}
                      onDeny={(id) => handleGoLiveAction(id, 'deny')}
                    />
                  ))}
                </div>
              </div>
            )}


          </div>
        )}

        {/* ═══════════════ SESSION MONITOR MODE ═══════════════ */}
        {viewMode === 'session' && enteredSession && (
          <div className="h-full relative">
            {sessionToken ? (
              <RoomMonitor
                token={sessionToken.token}
                wsUrl={sessionToken.wsUrl}
                roomName={sessionToken.roomName}
                batchName={enteredSession.batch_name}
                callbacks={monitorCallbacks}
              >
                {(data) => (
                  <div className="flex h-full flex-col bg-[#202124]">

                    {/* ── HEADER BAR ── */}
                    <HeaderBar
                      roomName={`${enteredSession.batch_name} · ${enteredSession.subject}`}
                      role="ghost"
                      scheduledStart={enteredSession.scheduled_start || enteredSession.started_at}
                      durationMinutes={enteredSession.duration_minutes}
                      sidebarOpen={sidebarOpen}
                      onToggleSidebar={() => setSidebarOpen(prev => !prev)}
                      isLive={true}
                      requestsBellRef={requestsBellRef}
                      onRequestsBellClick={onRequestsBellClick}
                      requestCount={(data.raisedHands.size + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length) || undefined}
                      criticalAlerts={aiAlerts}
                      onClearAlerts={clearAlerts}
                    />

                    {/* ── View tab bar (Class View / Students) ── */}
                    <div className="flex items-center gap-1 border-b border-[#3c4043] px-3 py-1.5 bg-[#202124] shrink-0">
                      {(['class', 'students'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSessionViewTab(tab)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            sessionViewTab === tab
                              ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                              : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]',
                          )}
                        >
                          {tab === 'class' ? (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          )}
                          {tab === 'class' ? 'Class View' : 'Students'}
                          {tab === 'students' && data.students.length > 0 && (
                            <span className="rounded-full bg-[#3c4043] px-1.5 py-0.5 text-[10px] tabular-nums text-[#9aa0a6]">{data.students.length}</span>
                          )}
                        </button>
                      ))}

                      {/* ── Talk to Teacher (push-to-talk, private audio) ── */}
                      <TalkToTeacherButton />

                      {/* Sync teacher approval/denial back to BC panels */}
                      <TeacherActionSyncer
                        setMediaRequests={setMediaRequests}
                        setLeaveRequests={setLeaveRequests}
                        setRejoinRequests={setRejoinRequests}
                      />

                      {/* ── Recording toggle ── */}
                      <button
                        onClick={toggleRecording}
                        disabled={recordingLoading}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          recordingLoading && 'opacity-60 cursor-wait',
                          isRecording
                            ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                            : 'bg-[#292a2d] text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]',
                        )}
                        title={isRecording ? 'Stop YouTube recording' : 'Start YouTube recording'}
                      >
                        <span className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#5f6368]',
                        )} />
                        {recordingLoading ? 'Working…' : isRecording ? 'REC' : 'REC OFF'}
                      </button>
                    </div>

                    {/* ── End-class request banner ── */}
                    {(() => {
                      const ecr = endClassRequests.find(r => r.room_name === enteredSession.room_name);
                      if (!ecr) return null;
                      return (
                        <div className="flex items-center justify-center gap-3 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 shrink-0">
                          <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" /></span>
                          <span className="text-xs text-amber-200">{ecr.teacher_name} wants to end class{ecr.reason ? `: ${ecr.reason}` : ''}</span>
                          <button onClick={() => handleEndClassAction(ecr.room_name, 'approve')} className="rounded-lg bg-red-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-red-500">Approve End</button>
                          <button onClick={() => handleEndClassAction(ecr.room_name, 'deny')} className="rounded-lg bg-[#3c4043] px-3 py-1 text-[11px] text-[#9aa0a6] hover:text-white">Deny</button>
                        </div>
                      );
                    })()}

                    {/* ── BODY: Main content + sidebar ── */}
                    <div className="flex flex-1 overflow-hidden">

                      {/* ── MAIN CONTENT AREA ── */}
                      <div className="relative flex flex-1 flex-col overflow-hidden">
                        <div className="flex-1 overflow-hidden p-2">
                        {sessionViewTab === 'class' ? (
                          /* ── CLASS VIEW: whiteboard + teacher cutout ── */
                          data.teacher ? (
                            <BCWhiteboardArea
                              teacher={data.teacher}
                              teacherScreen={data.teacherScreen}
                              showTeacherBigTile={showTeacherBigTile}
                              onToggleTeacherBigTile={() => setShowTeacherBigTile(prev => !prev)}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <div className="text-center">
                                <svg className="h-14 w-14 text-[#3c4043] mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                                <p className="text-sm text-[#5f6368]">Waiting for teacher to join...</p>
                                <p className="text-xs text-[#3c4043] mt-1">{enteredSession.teacher_name} · {enteredSession.subject}</p>
                              </div>
                            </div>
                          )
                        ) : (
                          /* ── STUDENTS VIEW: video tile grid ── */
                          <BCStudentGrid
                            students={data.students}
                            attention={data.attention}
                            raisedHands={data.raisedHands}
                            onSelectStudent={setSelectedStudentId}
                          />
                        )}
                        </div>

                        {/* Student detail panel */}
                        {selectedStudentId && (() => {
                          const student = data.students.find(s => s.identity === selectedStudentId);
                          if (!student) return null;
                          const email = student.identity.replace('student_', '');
                          const att = data.attention.get(student.identity) ?? data.attention.get(email);
                          return (
                            <StudentDetailPanel
                              participant={student}
                              attention={att}
                              isMuted={false}
                              onToggleMute={() => {}}
                              onClose={() => setSelectedStudentId(null)}
                              handRaised={data.raisedHands.has(student.identity)}
                              connectionQuality={student.connectionQuality}
                              readOnly
                            />
                          );
                        })()}
                      </div>

                      {/* ── SIDEBAR (teacher-style tabs) ── */}
                      {sidebarOpen && (
                        <div className="flex w-[340px] shrink-0 flex-col border-l border-[#3c4043] bg-[#202124]">

                          {/* Tab buttons — text labels matching teacher UI */}
                          <div className="flex border-b border-[#3c4043]">
                            {([
                              { id: 'chat', label: 'Chat' },
                              { id: 'participants', label: 'People' },
                              { id: 'attendance', label: 'Attend.' },
                              { id: 'monitoring', label: 'AI Monitor' },
                            ] as const).map(({ id, label }) => (
                              <button
                                key={id}
                                onClick={() => { setSidebarTab(id); if (id === 'chat') setUnreadChatCount(0); }}
                                className={cn(
                                  'flex-1 py-2.5 text-[10px] font-medium transition-colors',
                                  sidebarTab === id
                                    ? 'bg-[#3c4043] text-[#e8eaed]'
                                    : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]',
                                )}
                              >
                                {id === 'chat' ? (
                                  <span className="relative flex items-center justify-center">
                                    Chat
                                    {unreadChatCount > 0 && <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>}
                                  </span>
                                ) : label}
                              </button>
                            ))}
                          </div>

                          {/* Tab content */}
                          <div className="flex-1 overflow-hidden">
                            {/* ChatPanel always mounted to never miss messages */}
                            <div className={sidebarTab === 'chat' ? 'h-full' : 'hidden'}>
                              <ChatPanel
                                roomId={enteredSession.room_name}
                                participantName={userName}
                                participantRole="batch_coordinator"
                                participantEmail={userEmail}
                                targetIdentities={data.teacher ? [data.teacher.identity] : undefined}
                                onNewMessage={() => { if (sidebarTab !== 'chat') setUnreadChatCount(c => c + 1); }}
                              />
                            </div>
                            {sidebarTab === 'participants' ? (
                              <ParticipantList
                                role="ghost"
                                roomId={enteredSession.room_name}
                                mutedStudents={localMutedStudents}
                                raisedHands={data.raisedHands}
                                onToggleMute={(id) => setLocalMutedStudents(prev => {
                                  const next = new Set(prev);
                                  if (next.has(id)) next.delete(id); else next.add(id);
                                  return next;
                                })}
                              />
                            ) : sidebarTab === 'attendance' ? (
                              <AttendancePanel roomId={enteredSession.room_name} />
                            ) : (
                              /* ── Monitoring tab — AI attention (teacher-style) ── */
                              <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                                {/* Header */}
                                <div className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z"/><line x1="9" y1="22" x2="15" y2="22"/></svg>
                                  AI Session Monitor
                                </div>

                                {/* Session engagement bar + stats */}
                                {(() => {
                                  const allStudents = Array.from(data.attention.values());
                                  const avg = allStudents.length > 0
                                    ? Math.round(allStudents.reduce((s, a) => s + a.attentionScore, 0) / allStudents.length)
                                    : 0;
                                  const attentiveCount = allStudents.filter(s => s.isAttentive).length;
                                  const sleepingCount = allStudents.filter(s => s.monitorState === 'eyes_closed').length;
                                  const tabSwitched = allStudents.filter(s => !s.tabVisible).length;
                                  const notInFrame = allStudents.filter(s => s.monitorState === 'not_in_frame').length;
                                  return (
                                    <div className="rounded-lg bg-[#292a2d] p-3 space-y-2">
                                      <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide">Session Engagement</div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 rounded-full bg-[#3c4043] overflow-hidden">
                                          <div
                                            className={cn('h-full rounded-full transition-all', avg >= 70 ? 'bg-green-500' : avg >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                                            style={{ width: `${avg}%` }}
                                          />
                                        </div>
                                        <span className={cn('text-sm font-bold', avg >= 70 ? 'text-green-400' : avg >= 40 ? 'text-amber-400' : 'text-red-400')}>
                                          {avg}%
                                        </span>
                                      </div>
                                      {allStudents.length > 0 && (
                                        <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                                          <div className="rounded bg-green-900/30 px-1 py-0.5 text-green-400 flex items-center justify-center gap-0.5">{attentiveCount} <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                                          <div className="rounded bg-red-900/30 px-1 py-0.5 text-red-400 flex items-center justify-center gap-0.5">{sleepingCount} <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h4l2-2"/><path d="M6 8h4l2-2"/><path d="M10 12h4l2-2"/></svg></div>
                                          <div className="rounded bg-purple-900/30 px-1 py-0.5 text-purple-400 flex items-center justify-center gap-0.5">{tabSwitched} <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>
                                          <div className="rounded bg-amber-900/30 px-1 py-0.5 text-amber-400 flex items-center justify-center gap-0.5">{notInFrame} <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Per-student attention cards (sorted by lowest score) */}
                                <div className="space-y-2">
                                  {Array.from(data.attention.values()).length > 0 ? (
                                    Array.from(data.attention.values())
                                      .sort((a, b) => a.attentionScore - b.attentionScore)
                                      .map((att) => {
                                        const stateConfig: Record<string, { label: string; color: string }> = {
                                          eyes_closed:    { label: 'Sleeping', color: 'text-red-400' },
                                          tab_switched:   { label: 'Tab Switched', color: 'text-purple-400' },
                                          not_in_frame:   { label: 'Not in Frame', color: 'text-red-400' },
                                          multiple_faces: { label: 'Multiple Faces', color: 'text-amber-400' },
                                          head_turned:    { label: 'Not Looking', color: 'text-amber-400' },
                                          looking_away:   { label: 'Looking Away', color: 'text-amber-400' },
                                          yawning:        { label: 'Yawning', color: 'text-amber-400' },
                                          inactive:       { label: 'Inactive', color: 'text-amber-400' },
                                          distracted:     { label: 'Distracted', color: 'text-amber-400' },
                                          low_engagement: { label: 'Low Engagement', color: 'text-amber-400' },
                                          attentive:      { label: 'Attentive', color: 'text-green-400' },
                                        };
                                        const sc = stateConfig[att.monitorState] ?? stateConfig.attentive;
                                        const isCritical = ['eyes_closed', 'tab_switched', 'not_in_frame'].includes(att.monitorState);
                                        return (
                                          <div key={att.email} className={cn(
                                            'rounded-lg border p-2.5 cursor-pointer hover:brightness-110 transition-all',
                                            isCritical ? 'border-red-600/50 bg-red-950/30' :
                                            att.attentionScore < 50 ? 'border-amber-600/50 bg-amber-950/30' :
                                            'border-[#3c4043] bg-[#292a2d]',
                                          )} onClick={() => {
                                            const student = data.students.find(s => s.identity.includes(att.email));
                                            if (student) setSelectedStudentId(student.identity);
                                          }}>
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-[#e8eaed] truncate">{att.name}</span>
                                              <span className={cn('text-xs font-bold',
                                                att.attentionScore >= 70 ? 'text-green-400' :
                                                att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400',
                                              )}>{att.attentionScore}%</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                              <span className={cn('flex items-center gap-1', sc.color)}>
                                                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>
                                                {sc.label}
                                              </span>
                                            </div>
                                            {/* Detail badges */}
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {att.eyesClosed && <span className="rounded bg-red-900/40 px-1 py-0.5 text-[9px] text-red-300">Eyes Closed</span>}
                                              {att.gazeAway && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Gaze Away</span>}
                                              {(Math.abs(att.headYaw) > 20 || Math.abs(att.headPitch) > 15) && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Head {Math.abs(att.headYaw)}°</span>}
                                              {att.yawning && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Yawning</span>}
                                              {!att.tabVisible && <span className="rounded bg-purple-900/40 px-1 py-0.5 text-[9px] text-purple-300">Tab Away</span>}
                                              {att.isInactive && <span className="rounded bg-gray-700/50 px-1 py-0.5 text-[9px] text-gray-300">Inactive</span>}
                                              {att.faceCount > 1 && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">{att.faceCount} Faces</span>}
                                              {att.isMobile && <span className="rounded bg-blue-900/40 px-1 py-0.5 text-[9px] text-blue-300">Mobile</span>}
                                            </div>
                                          </div>
                                        );
                                      })
                                  ) : (
                                    <div className="text-center py-8 text-xs text-[#9aa0a6]">
                                      Waiting for student attention data...
                                    </div>
                                  )}
                                </div>

                                {/* Recent alerts */}
                                {alerts.filter(a => now - a.time < 60_000).length > 0 && (
                                  <div className="space-y-1">
                                    <h4 className="text-[10px] font-semibold text-[#9aa0a6] uppercase tracking-wider">Recent Alerts</h4>
                                    {alerts.filter(a => now - a.time < 60_000).slice().reverse().slice(0, 8).map(alert => (
                                      <div key={alert.id} className="flex items-center gap-2 rounded bg-[#292a2d] px-2 py-1.5">
                                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0',
                                          alert.severity === 'danger' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500',
                                        )} />
                                        <p className="text-[10px] text-[#9aa0a6] truncate">{alert.message}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Sidebar footer: back to lobby + session switcher */}
                          <div className="shrink-0 border-t border-[#3c4043] px-3 py-2 flex items-center gap-2">
                            <button
                              onClick={exitSession}
                              className="flex items-center gap-1.5 rounded-lg bg-[#3c4043] px-3 py-1.5 text-xs text-[#e8eaed] hover:bg-[#5f6368] transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                              Lobby
                            </button>
                            {sessions.length > 1 && (
                              <div className="flex gap-1 overflow-x-auto">
                                {sessions.map(s => (
                                  <button
                                    key={s.session_id}
                                    onClick={() => enterSession(s)}
                                    className={cn(
                                      'rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap transition-colors',
                                      s.room_name === enteredSession.room_name
                                        ? 'bg-[#8ab4f8]/20 text-[#8ab4f8] font-bold'
                                        : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]',
                                    )}
                                  >
                                    {s.batch_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    {/* ── Requests dropdown (proper component with LiveKit context) ── */}
                    <BCRequestsDropdown
                      open={requestsDropdownOpen}
                      pos={requestsDropdownPos}
                      dropdownRef={requestsDropdownRef}
                      raisedHands={data.raisedHands}
                      dismissHand={data.dismissHand}
                      dismissAllHands={data.dismissAllHands}
                      mediaRequests={mediaRequests}
                      setMediaRequests={setMediaRequests}
                      leaveRequests={leaveRequests}
                      setLeaveRequests={setLeaveRequests}
                      rejoinRequests={rejoinRequests}
                      setRejoinRequests={setRejoinRequests}
                      extensionRequests={extensionRequests}
                      extensionActionLoading={extensionActionLoading}
                      handleExtensionAction={handleExtensionAction}
                      onClose={() => setRequestsDropdownOpen(false)}
                    />

                    </div>
                  </div>
                )}
              </RoomMonitor>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#202124]">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8ab4f8] border-t-transparent mx-auto mb-3" />
                  <p className="text-sm text-[#9aa0a6]">Connecting to session...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── YouTube Recording Prompt Dialog ── */}
      {showRecordingPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
                <svg className="h-7 w-7 text-red-400" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
              </span>
              <div>
                <h3 className="text-lg font-semibold text-[#e8eaed]">Start YouTube Recording?</h3>
                <p className="mt-1 text-sm text-[#9aa0a6]">This class is live. Would you like to start recording to YouTube now?</p>
              </div>
              <div className="flex w-full gap-3 mt-2">
                <button
                  onClick={() => {
                    if (enteredSession) promptedRoomsRef.current.add(enteredSession.room_name);
                    setShowRecordingPrompt(false);
                  }}
                  className="flex-1 rounded-lg border border-[#3c4043] bg-[#292a2d] px-4 py-2.5 text-sm font-medium text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed] transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    if (enteredSession) promptedRoomsRef.current.add(enteredSession.room_name);
                    setShowRecordingPrompt(false);
                    if (!isRecording) await toggleRecording();
                  }}
                  disabled={recordingLoading}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {recordingLoading ? 'Starting…' : 'Start Recording'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating snackbar notifications (only in session view — lobby uses card banners) ── */}
      {snackbars.length > 0 && viewMode === 'session' && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-col-reverse gap-2">
          {snackbars.slice(-3).map((sb) => (
            <div key={sb.id} className="animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className={cn(
                'flex items-center gap-3 rounded-xl px-5 py-3 shadow-2xl border backdrop-blur-sm',
                sb.type === 'end-class'
                  ? 'bg-amber-950/90 border-amber-500/50'
                  : 'bg-emerald-950/90 border-emerald-500/50',
              )}>
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  sb.type === 'end-class' ? 'bg-amber-500/20' : 'bg-emerald-500/20',
                )}>
                  {sb.type === 'end-class' ? (
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                  ) : (
                    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold', sb.type === 'end-class' ? 'text-amber-200' : 'text-emerald-200')}>
                    {sb.type === 'end-class'
                      ? `${sb.teacherName} wants to end class`
                      : `${sb.teacherName} requests Go Live`}
                  </p>
                  <p className="text-xs text-[#9aa0a6]">
                    {sb.batchName}{sb.reason ? ` — ${sb.reason}` : ''}
                  </p>
                </div>
                {sb.type === 'end-class' ? (
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => { handleEndClassAction(sb.roomName, 'approve'); setSnackbars(prev => prev.filter(s => s.id !== sb.id)); }}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 active:scale-95 transition-all"
                    >Approve End</button>
                    <button
                      onClick={() => { handleEndClassAction(sb.roomName, 'deny'); setSnackbars(prev => prev.filter(s => s.id !== sb.id)); }}
                      className="rounded-lg bg-[#3c4043] px-3 py-1.5 text-xs font-medium text-[#9aa0a6] hover:text-white transition-colors"
                    >Deny</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => { handleGoLiveAction(sb.roomName, 'approve'); setSnackbars(prev => prev.filter(s => s.id !== sb.id)); }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all"
                    >Approve</button>
                    <button
                      onClick={() => { handleGoLiveAction(sb.roomName, 'deny'); setSnackbars(prev => prev.filter(s => s.id !== sb.id)); }}
                      className="rounded-lg bg-[#3c4043] px-3 py-1.5 text-xs font-medium text-[#9aa0a6] hover:text-white transition-colors"
                    >Deny</button>
                  </div>
                )}
                <button onClick={() => setSnackbars(prev => prev.filter(s => s.id !== sb.id))} className="ml-1 rounded-full p-1 text-[#5f6368] hover:text-[#e8eaed] hover:bg-[#3c4043] transition-colors">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// LiveSessionCard — Live session card in the lobby
// ═══════════════════════════════════════════════════════════════

function LiveSessionCard({
  session,
  now,
  endClassReq,
  onEnter,
  onEndClassAction,
}: {
  session: LiveSession;
  now: number;
  endClassReq?: EndClassReq;
  onEnter: () => void;
  onEndClassAction: (roomName: string, action: 'approve' | 'deny') => void;
}) {
  const elapsed = Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000));
  const isOvertime = elapsed > session.duration_minutes * 60;
  const [linkCopied, setLinkCopied] = useState(false);

  const copyGuestLink = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/guest-link`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success && data.data?.join_link) {
        await navigator.clipboard.writeText(data.data.join_link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      }
    } catch {}
  }, [session.session_id]);

  return (
    <div className={cn('rounded-xl border bg-[#202124] overflow-hidden transition-colors', isOvertime ? 'border-amber-500/60 hover:border-amber-400/80' : 'border-[#3c4043] hover:border-[#8ab4f8]/50')}>
      {endClassReq && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <span className="text-xs text-amber-200 flex-1">End class requested{endClassReq.reason ? `: ${endClassReq.reason}` : ''}</span>
          <button onClick={() => onEndClassAction(endClassReq.room_name, 'approve')} className="rounded bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-500">Approve End</button>
          <button onClick={() => onEndClassAction(endClassReq.room_name, 'deny')} className="rounded bg-[#3c4043] px-2.5 py-1 text-[10px] text-[#9aa0a6] hover:text-white">Deny</button>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
              <span className="text-xs font-mono text-[#9aa0a6] tabular-nums">{fmtElapsed(elapsed)}</span>
              {isOvertime && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 animate-pulse">OVERTIME</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-[#e8eaed] truncate">{session.batch_name}</h3>
            <p className="text-xs text-[#9aa0a6]">{session.subject}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-xs font-bold text-[#e8eaed]">
            {(session.teacher_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#e8eaed] truncate">{session.teacher_name}</p>
            <p className="text-[10px] text-emerald-400">Teaching</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-[11px] text-[#9aa0a6]">
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {session.student_count} students
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {session.duration_minutes} min
          </span>
        </div>

        <button
          onClick={onEnter}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#8ab4f8] px-4 py-2.5 text-sm font-semibold text-[#202124] hover:bg-[#aecbfa] active:scale-[0.98] transition-all mb-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Enter Session
        </button>
        <button
          onClick={copyGuestLink}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#3c4043] px-3 py-1.5 text-xs transition-colors"
          style={linkCopied ? { borderColor: 'rgb(52 168 83 / 0.5)', color: 'rgb(52 168 83)' } : { color: '#9aa0a6' }}
        >
          {linkCopied ? (
            <><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
          ) : (
            <><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Guest Link</>
          )}
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// ScheduledCard — Upcoming session card in the lobby
// ═══════════════════════════════════════════════════════════════

function ScheduledCard({
  ss,
  now,
  onApprove,
  onDeny,
}: {
  ss: ScheduledSession;
  now: number;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const ts = teacherStatus(ss, now);
  const tTime = timeStatus(ss, now);
  const isOverdue = tTime.label.includes('overdue');
  const isPending = ss.go_live_status === 'pending';
  const pendingSecs = isPending && ss.go_live_requested_at
    ? Math.max(0, Math.floor((now - new Date(ss.go_live_requested_at).getTime()) / 1000))
    : 0;

  return (
    <div className={cn(
      'rounded-xl border bg-[#202124] overflow-hidden transition-colors',
      isPending ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]' :
      isOverdue ? 'border-red-500/50' :
      'border-[#3c4043]',
    )}>
      {isPending && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-300">Go Live Request</p>
            <p className="text-[10px] text-amber-400/70">
              Waiting {Math.floor(pendingSecs / 60)}:{String(pendingSecs % 60).padStart(2, '0')}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(ss.session_id); }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 active:scale-95 transition-all"
          >Approve</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeny(ss.session_id); }}
            className="rounded-lg bg-[#3c4043] px-3 py-1.5 text-[11px] font-medium text-[#9aa0a6] hover:text-white hover:bg-[#5f6368] transition-colors"
          >Deny</button>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#e8eaed] truncate">{ss.batch_name}</h3>
              {ss.batch_type && (
                <span className="shrink-0 rounded bg-[#3c4043] px-1.5 py-0.5 text-[9px] font-medium text-[#9aa0a6]">
                  {BATCH_TYPE_LABELS[ss.batch_type] || ss.batch_type}
                </span>
              )}
            </div>
            <p className="text-xs text-[#9aa0a6]">{ss.subject}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-xs font-medium text-[#e8eaed]">{fmtTime12(ss.start_time)}</p>
            {tTime.countdown ? (
              <p className={cn('text-sm font-mono font-bold tabular-nums', tTime.urgent ? 'text-red-400' : 'text-[#8ab4f8]')}>
                {tTime.countdown}
              </p>
            ) : (
              <p className={cn('text-[10px] font-semibold', tTime.urgent ? 'text-red-400' : 'text-[#9aa0a6]')}>
                {tTime.label}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <div className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-[#e8eaed]',
            ts.icon === 'classroom' || ts.icon === 'approved' ? 'bg-emerald-600/30' :
            ts.icon === 'pending' ? 'bg-amber-600/30' :
            ts.icon === 'delayed' ? 'bg-red-600/30' :
            'bg-[#3c4043]',
          )}>
            {(ss.teacher_name || '?').charAt(0).toUpperCase()}
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#202124]',
              ts.icon === 'classroom' || ts.icon === 'pending' || ts.icon === 'approved' ? 'bg-emerald-500' :
              ts.icon === 'delayed' ? 'bg-red-500 animate-pulse' :
              'bg-[#5f6368]',
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#e8eaed] truncate">{ss.teacher_name || 'Unassigned'}</p>
            <p className={cn('text-[10px] font-medium', ts.color, ts.glow && 'animate-pulse')}>{ts.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-[#9aa0a6]">
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {ss.student_count} enrolled
          </span>
          {ss.room_exists && ss.waiting_students > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {ss.waiting_students} waiting
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {ss.duration_minutes} min
          </span>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// BCStudentGrid — Adaptive student video tile grid
// ═══════════════════════════════════════════════════════════════

function BCStudentGrid({
  students,
  attention,
  raisedHands,
  onSelectStudent,
}: {
  students: RemoteParticipant[];
  attention: Map<string, StudentAttentionState>;
  raisedHands: Map<string, { name: string; time: number }>;
  onSelectStudent: (id: string) => void;
}) {
  // Compute grid columns based on student count
  const count = students.length;
  const gridCols =
    count <= 1 ? 'grid-cols-1' :
    count <= 4 ? 'grid-cols-2' :
    count <= 9 ? 'grid-cols-3' :
    count <= 16 ? 'grid-cols-4' :
    count <= 25 ? 'grid-cols-5' :
    'grid-cols-6';

  if (count === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <svg className="h-12 w-12 text-[#3c4043] mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p className="text-sm text-[#5f6368]">No students connected</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('grid h-full w-full gap-1.5 auto-rows-fr p-1', gridCols)}>
      {students.map((student) => {
        const email = student.identity.replace('student_', '');
        const att = attention.get(student.identity) ?? attention.get(email);
        const score = att?.attentionScore ?? -1;
        const handRaised = raisedHands.has(student.identity);
        const isSleeping = att?.eyesClosed || att?.monitorState === 'eyes_closed';
        const isNotLooking = att?.gazeAway || att?.monitorState === 'looking_away' || att?.monitorState === 'head_turned';
        const isTabAway = !att?.tabVisible && att?.monitorState === 'tab_switched';
        const isNotInFrame = att?.monitorState === 'not_in_frame';
        const isLowAtt = score >= 0 && score < 50;

        return (
          <div
            key={student.identity}
            onClick={() => onSelectStudent(student.identity)}
            className={cn(
              'relative rounded-lg overflow-hidden cursor-pointer transition-all',
              isSleeping ? 'ring-2 ring-red-500/60' :
              isTabAway || isNotInFrame ? 'ring-2 ring-red-500/40' :
              isNotLooking ? 'ring-2 ring-amber-500/60' :
              'ring-1 ring-white/5 hover:ring-[#8ab4f8]/40',
            )}
          >
            <VideoTile
              participant={student}
              showName={true}
              showMicIndicator={true}
              handRaised={handRaised}
              connectionQuality={student.connectionQuality}
              className="h-full w-full"
              onClick={() => onSelectStudent(student.identity)}
            />

            {/* AI attention badge (top-right) */}
            {att && (
              <div className={cn(
                'absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm pointer-events-none',
                isSleeping ? 'bg-red-600/80 text-white' :
                isTabAway ? 'bg-purple-600/80 text-white' :
                isNotInFrame ? 'bg-red-600/70 text-white' :
                isLowAtt ? 'bg-amber-500/80 text-white' :
                'bg-green-600/70 text-white',
              )}>
                {isSleeping ? (
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><text x="2" y="18" fontSize="16" fontWeight="bold">Z</text><text x="10" y="12" fontSize="10" fontWeight="bold">z</text><text x="15" y="8" fontSize="7" fontWeight="bold">z</text></svg>
                ) : isTabAway ? (
                  <span>📱</span>
                ) : isNotInFrame ? (
                  <span>⊘</span>
                ) : isNotLooking ? (
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : score >= 75 ? (
                  <span className="text-[8px]">OK</span>
                ) : (
                  <span className="text-[8px]">!</span>
                )}
                {score >= 0 && <span className="tabular-nums">{Math.round(score)}%</span>}
              </div>
            )}

            {/* State detail pills (bottom-right, only for concerning states) */}
            {att && (isSleeping || isTabAway || isNotInFrame || isNotLooking || att.yawning || (att.faceCount > 1)) && (
              <div className="absolute bottom-6 right-1 z-10 flex flex-wrap justify-end gap-0.5 pointer-events-none max-w-[70%]">
                {att.eyesClosed && <span className="rounded-full bg-red-600/80 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-sm">Eyes Closed</span>}
                {att.gazeAway && <span className="rounded-full bg-amber-500/80 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-sm">Gaze Away</span>}
                {isTabAway && <span className="rounded-full bg-purple-600/80 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-sm">Tab Away</span>}
                {isNotInFrame && <span className="rounded-full bg-red-600/70 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-sm">Not in Frame</span>}
                {att.yawning && <span className="rounded-full bg-amber-500/70 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-sm">Yawning</span>}
                {att.faceCount > 1 && <span className="rounded-full bg-amber-500/70 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur-sm">{att.faceCount} Faces</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// BCWhiteboardArea — Whiteboard + teacher cutout (StudentView pattern)
//
// Must be a proper component (not a render prop callback) so hooks
// can be called. Uses useTeacherOverlay directly — the same pattern
// that works in StudentView — instead of relying on WhiteboardComposite's
// built-in TeacherOverlay component which has ref-timing issues.
// ═══════════════════════════════════════════════════════════════

function BCWhiteboardArea({
  teacher,
  teacherScreen,
  showTeacherBigTile,
  onToggleTeacherBigTile,
}: {
  teacher: Participant;
  teacherScreen?: RemoteParticipant | null;
  showTeacherBigTile?: boolean;
  onToggleTeacherBigTile?: () => void;
}) {
  const room = useRoomContext();
  const [, setTick] = useState(0);

  // Force re-render when tracks are published/subscribed — ensures screen share is detected
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    room.on(RoomEvent.TrackSubscribed, bump);
    room.on(RoomEvent.TrackPublished, bump);
    room.on(RoomEvent.TrackUnpublished, bump);
    return () => {
      room.off(RoomEvent.TrackSubscribed, bump);
      room.off(RoomEvent.TrackPublished, bump);
      room.off(RoomEvent.TrackUnpublished, bump);
    };
  }, [room]);

  // Eagerly subscribe to screen share + audio from the screen device (or teacher)
  useEffect(() => {
    const screenSource = teacherScreen || teacher;
    if (!screenSource) return;
    const pub = screenSource.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
    if (pub && !pub.isSubscribed) pub.setSubscribed(true);
    const audioPub = screenSource.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
    if (audioPub && !audioPub.isSubscribed) audioPub.setSubscribed(true);
  });

  // Get teacher camera publication (same as StudentView)
  const remoteTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false },
  );

  const teacherCamPub = useMemo(() => {
    const tr = remoteTracks.find(
      (t) => t.source === Track.Source.Camera && t.participant.identity === teacher.identity,
    );
    if (!tr) return null;
    const p = tr.publication as RemoteTrackPublication | undefined;
    return p && p.track ? p : null;
  }, [remoteTracks, teacher]);

  const hasTeacherCam = !!teacherCamPub && !teacherCamPub.isMuted;

  // Use the hook directly — hook owns the videoRef (the pattern that works)
  const {
    videoRef: teacherOverlayVideoRef,
    canvasRef: teacherOverlayCanvasRef,
    hasFirstFrame: teacherCutoutReady,
  } = useTeacherOverlay({ enabled: hasTeacherCam && !!teacherCamPub });

  // Attach teacher camera track to the hook's own video ref
  useEffect(() => {
    const videoEl = teacherOverlayVideoRef.current;
    if (!videoEl || !teacherCamPub?.track) return;
    const track = teacherCamPub.track;
    track.attach(videoEl);
    return () => { track.detach(videoEl); };
  }, [teacherCamPub, teacherOverlayVideoRef]);

  return (
    <div className="relative flex h-full flex-col gap-2">
      {/* Whiteboard / screen share — hideOverlay so we handle cutout ourselves */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl">
        <WhiteboardComposite
          teacher={teacher}
          teacherScreenDevice={teacherScreen}
          hideOverlay={true}
          className="h-full w-full"
        />
      </div>

      {/* Hidden video for MediaPipe input — the hook's OWN ref */}
      <video
        ref={teacherOverlayVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      {/* Teacher cutout overlay (bottom-left, clickable to expand) */}
      {hasTeacherCam && teacherCamPub ? (
        <div
          onClick={onToggleTeacherBigTile}
          className={cn(
            'absolute z-40 transition-all duration-300 overflow-hidden cursor-pointer',
            'bottom-0 left-0 h-[16rem] w-[14rem] md:h-[20rem] md:w-[17rem]',
            !teacherCutoutReady && 'invisible',
          )}
          title="Click to expand teacher view"
        >
          <canvas
            ref={teacherOverlayCanvasRef}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 ring-1 ring-white/10 max-w-28">
            <span className="block truncate text-center text-[10px] font-medium text-white/90">
              {teacher.name || teacher.identity}
            </span>
          </div>
        </div>
      ) : teacher && (
        <div
          onClick={onToggleTeacherBigTile}
          className="absolute z-40 bottom-24 left-3 flex h-32 w-32 items-center justify-center rounded-xl bg-[#202124]/80 backdrop-blur-sm shadow-2xl shadow-black/50 cursor-pointer"
          title="Click to expand teacher view"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#5f6368] text-lg font-semibold text-white">
            {(teacher.name || teacher.identity || 'T').charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 ring-1 ring-white/10 max-w-28">
            <span className="block truncate text-center text-[10px] font-medium text-white/90">
              {teacher.name || teacher.identity}
            </span>
          </div>
        </div>
      )}

      {/* Teacher big tile overlay (no background removal — raw camera) */}
      {showTeacherBigTile && hasTeacherCam && teacherCamPub && (
        <div
          className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={onToggleTeacherBigTile}
        >
          <div className="relative w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="aspect-video rounded-xl overflow-hidden ring-1 ring-white/20">
              <VideoTile participant={teacher} showName={true} showMicIndicator={true} size="large" />
            </div>
            <button
              onClick={onToggleTeacherBigTile}
              className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#3c4043] text-white/70 hover:text-white hover:bg-[#5f6368] transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// BCRequestsDropdown — Requests bell dropdown portal
// Must render inside LiveKitRoom context so useLocalParticipant works.
// Sends actual LiveKit data channel messages on approve/deny.
// ═══════════════════════════════════════════════════════════════

function BCRequestsDropdown({
  open,
  pos,
  dropdownRef,
  raisedHands,
  dismissHand,
  dismissAllHands,
  mediaRequests,
  setMediaRequests,
  leaveRequests,
  setLeaveRequests,
  rejoinRequests,
  setRejoinRequests,
  extensionRequests,
  extensionActionLoading,
  handleExtensionAction,
  onClose,
}: {
  open: boolean;
  pos: { top: number; right: number };
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  raisedHands: Map<string, { name: string; time: number }>;
  dismissHand: (id: string) => void;
  dismissAllHands: () => void;
  mediaRequests: MediaRequest[];
  setMediaRequests: React.Dispatch<React.SetStateAction<MediaRequest[]>>;
  leaveRequests: LeaveRequest[];
  setLeaveRequests: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  rejoinRequests: RejoinRequest[];
  setRejoinRequests: React.Dispatch<React.SetStateAction<RejoinRequest[]>>;
  extensionRequests: ExtensionReq[];
  extensionActionLoading: string | null;
  handleExtensionAction: (id: string, action: 'approve' | 'reject') => void;
  onClose: () => void;
}) {
  const { localParticipant } = useLocalParticipant();

  const notifyTeacher = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { topic: 'bc_request_action', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendMediaControl = useCallback(async (targetId: string, type: 'mic' | 'camera', enabled: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, type, enabled })),
        { topic: 'media_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendLeaveControl = useCallback(async (targetId: string, approved: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, approved })),
        { topic: 'leave_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendRejoinControl = useCallback(async (targetId: string, approved: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, approved })),
        { topic: 'rejoin_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[99999] w-84 max-h-[80vh] rounded-xl border border-[#3c4043] bg-[#202124] shadow-2xl flex flex-col overflow-hidden"
      style={{ top: pos.top, right: pos.right }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          <span className="text-xs font-semibold text-[#e8eaed]">Student Requests</span>
          <span className="rounded-full bg-[#4285f4]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#8ab4f8]">
            {raisedHands.size + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-[#9aa0a6] hover:text-[#e8eaed] transition-colors px-1.5 py-0.5 rounded hover:bg-[#3c4043]"
        >
          Close
        </button>
      </div>

      <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">

        {/* ── Raised hands ── */}
        {raisedHands.size > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#f9ab00]/8 border-b border-[#3c4043]">
              <div className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                <span className="text-[11px] font-semibold text-[#f9ab00]">Raised Hands ({raisedHands.size})</span>
              </div>
              <button onClick={dismissAllHands} className="text-[10px] text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] rounded px-1.5 py-0.5 transition-colors">Lower all</button>
            </div>
            {Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time).map(([id, info]) => (
              <div key={id} className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f9ab00]/20">
                    <svg className="h-3 w-3 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                  </span>
                  <span className="text-xs text-[#e8eaed] truncate">{info.name}</span>
                </div>
                <button onClick={() => dismissHand(id)} title="Lower hand" className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Media requests ── */}
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
              <div key={`${req.studentId}_${req.type}`} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="flex items-center mt-0.5 shrink-0">
                    {req.type === 'mic' ? (
                      req.desired ? <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                               : <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12L9 9z"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    ) : (
                      req.desired ? <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                               : <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/><path d="M21 13V7l-7 5"/></svg>
                    )}
                  </span>
                  <span className="text-xs text-[#e8eaed] break-words">
                    <strong>{req.studentName}</strong> wants to {req.desired ? 'turn on' : 'turn off'} {req.type}
                  </span>
                </div>
                <div className="flex gap-1.5 ml-2 shrink-0">
                  <button
                    onClick={() => {
                      sendMediaControl(req.studentId, req.type, req.desired);
                      notifyTeacher({ action_type: 'media_control', student_id: req.studentId, student_name: req.studentName, action: 'approved', type: req.type, desired: req.desired });
                      setMediaRequests(prev => prev.filter(r => !(r.studentId === req.studentId && r.type === req.type)));
                    }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      notifyTeacher({ action_type: 'media_control', student_id: req.studentId, student_name: req.studentName, action: 'denied', type: req.type });
                      setMediaRequests(prev => prev.filter(r => !(r.studentId === req.studentId && r.type === req.type)));
                    }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Leave requests ── */}
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
              <div key={req.studentId} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                <span className="text-xs text-[#e8eaed]"><strong>{req.studentName}</strong> wants to leave</span>
                <div className="flex gap-1.5 ml-2 shrink-0">
                  <button
                    onClick={() => {
                      sendLeaveControl(req.studentId, true);
                      notifyTeacher({ action_type: 'leave_control', student_id: req.studentId, student_name: req.studentName, action: 'approved' });
                      setLeaveRequests(prev => prev.filter(r => r.studentId !== req.studentId));
                    }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => {
                      sendLeaveControl(req.studentId, false);
                      notifyTeacher({ action_type: 'leave_control', student_id: req.studentId, student_name: req.studentName, action: 'denied' });
                      setLeaveRequests(prev => prev.filter(r => r.studentId !== req.studentId));
                    }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rejoin requests ── */}
        {rejoinRequests.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#4285f4]/8 border-b border-[#3c4043]">
              <div className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                <span className="text-[11px] font-semibold text-[#8ab4f8]">Rejoin Requests ({rejoinRequests.length})</span>
              </div>
              <button onClick={() => setRejoinRequests([])} className="text-[10px] text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] rounded px-1.5 py-0.5 transition-colors">Clear all</button>
            </div>
            {rejoinRequests.map((req) => (
              <div key={req.studentId} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                <span className="text-xs text-[#e8eaed]"><strong>{req.studentName}</strong> wants to rejoin</span>
                <div className="flex gap-1.5 ml-2 shrink-0">
                  <button
                    onClick={() => {
                      sendRejoinControl(req.studentId, true);
                      notifyTeacher({ action_type: 'rejoin_control', student_id: req.studentId, student_name: req.studentName, action: 'approved' });
                      setRejoinRequests(prev => prev.filter(r => r.studentId !== req.studentId));
                    }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => {
                      sendRejoinControl(req.studentId, false);
                      notifyTeacher({ action_type: 'rejoin_control', student_id: req.studentId, student_name: req.studentName, action: 'denied' });
                      setRejoinRequests(prev => prev.filter(r => r.studentId !== req.studentId));
                    }}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Extension requests ── */}
        {extensionRequests.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/8 border-b border-[#3c4043]">
              <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="text-[11px] font-semibold text-blue-400">Extension Requests ({extensionRequests.length})</span>
            </div>
            {extensionRequests.map((req) => (
              <div key={req.id} className="px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#e8eaed]"><strong>{req.student_name}</strong> wants <strong>+{req.requested_minutes}min</strong></span>
                  {req.extension_fee_paise > 0 && <span className="text-[10px] text-[#9aa0a6]">₹{(req.extension_fee_paise / 100).toFixed(0)} fee</span>}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleExtensionAction(req.id, 'approve')}
                    disabled={extensionActionLoading === req.id}
                    className="flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 disabled:opacity-50 transition-colors"
                  >
                    {extensionActionLoading === req.id ? '…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleExtensionAction(req.id, 'reject')}
                    disabled={extensionActionLoading === req.id}
                    className="flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 disabled:opacity-50 transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {raisedHands.size === 0 && mediaRequests.length === 0 && leaveRequests.length === 0 && rejoinRequests.length === 0 && extensionRequests.length === 0 && (
          <div className="flex items-center justify-center px-4 py-8">
            <p className="text-xs text-[#9aa0a6]">No active requests</p>
          </div>
        )}

      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════
// BCRequestPanels — Floating request panels (teacher-style)
// Uses useLocalParticipant for sending control messages.
// Must render inside LiveKitRoom context.
// ═══════════════════════════════════════════════════════════════

function BCRequestPanels({
  raisedHands,
  mediaRequests,
  leaveRequests,
  rejoinRequests,
  onDismissHand,
  onDismissAllHands,
  onMediaRequestHandled,
  onLeaveRequestHandled,
  onRejoinRequestHandled,
}: {
  raisedHands: Map<string, { name: string; time: number }>;
  mediaRequests: MediaRequest[];
  leaveRequests: LeaveRequest[];
  rejoinRequests: RejoinRequest[];
  onDismissHand: (id: string) => void;
  onDismissAllHands: () => void;
  onMediaRequestHandled: (req: MediaRequest) => void;
  onLeaveRequestHandled: (req: LeaveRequest) => void;
  onRejoinRequestHandled: (req: RejoinRequest) => void;
}) {
  const { localParticipant } = useLocalParticipant();

  // Notify teacher that BC handled a request (auto-dismisses in teacher UI)
  const notifyTeacher = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { topic: 'bc_request_action', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendMediaControl = useCallback(async (targetId: string, type: 'mic' | 'camera', enabled: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, type, enabled })),
        { topic: 'media_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendLeaveControl = useCallback(async (targetId: string, approved: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, approved })),
        { topic: 'leave_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendRejoinControl = useCallback(async (targetId: string, approved: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, approved })),
        { topic: 'rejoin_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const handCount = raisedHands.size;
  const sortedHands = Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time);

  return (
    <>
      {/* ── Hand-raise queue (floating bottom-right) ── */}
      {handCount > 0 && (
        <div className="absolute bottom-3 right-3 z-40 w-65 rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#f9ab00]/10 border-b border-[#3c4043]">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
              <span className="text-xs font-semibold text-[#f9ab00]">{handCount} hand{handCount !== 1 ? 's' : ''} raised</span>
            </div>
            <button onClick={onDismissAllHands} className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] transition-colors">Lower all</button>
          </div>
          <div className="max-h-45 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
            {sortedHands.map(([id, info]) => (
              <div key={id} className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/40 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f9ab00]/20">
                    <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                  </span>
                  <span className="truncate text-xs font-medium text-[#e8eaed]">{info.name}</span>
                </div>
                <button onClick={() => onDismissHand(id)} title="Lower hand" className="ml-2 flex h-6 w-6 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Media approval requests (floating bottom-left) ── */}
      {mediaRequests.length > 0 && (
        <div className="absolute bottom-3 left-3 z-40 w-75 rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a73e8]/10 border-b border-[#3c4043]">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              <span className="text-xs font-semibold text-[#8ab4f8]">{mediaRequests.length} request{mediaRequests.length !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={() => mediaRequests.forEach(r => onMediaRequestHandled(r))} className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] transition-colors">Clear all</button>
          </div>
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
            {mediaRequests.map((req) => (
              <div key={`${req.studentId}_${req.type}`} className="flex items-center justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 transition-colors border-b border-[#3c4043]/30 last:border-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="flex items-center">{req.type === 'mic' ? (
                    req.desired ? (
                      <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    ) : (
                      <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12L9 9z"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v1.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    )
                  ) : (
                    req.desired ? (
                      <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    ) : (
                      <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/><path d="M21 13V7l-7 5"/></svg>
                    )
                  )}</span>
                  <span className="truncate text-xs text-[#e8eaed]">
                    <strong>{req.studentName}</strong>{' '}wants to {req.desired ? 'turn on' : 'turn off'} {req.type}
                  </span>
                </div>
                <div className="flex gap-1.5 ml-2 shrink-0">
                  {req.teacherHandled ? (
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-semibold',
                      req.teacherHandled === 'approved' ? 'bg-[#34a853]/15 text-[#34a853]' : 'bg-[#ea4335]/15 text-[#ea4335]',
                    )}>
                      Teacher {req.teacherHandled}
                    </span>
                  ) : (
                    <>
                      <button onClick={() => { sendMediaControl(req.studentId, req.type, req.desired); notifyTeacher({ action_type: 'media_control', student_id: req.studentId, student_name: req.studentName, action: 'approved', type: req.type, desired: req.desired }); onMediaRequestHandled(req); }} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Approve</button>
                      <button onClick={() => { notifyTeacher({ action_type: 'media_control', student_id: req.studentId, student_name: req.studentName, action: 'denied', type: req.type }); onMediaRequestHandled(req); }} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Leave requests (floating, stacked above media) ── */}
      {leaveRequests.length > 0 && (
        <div className={cn(
          'absolute left-3 z-40 w-75 rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/8 overflow-hidden',
          mediaRequests.length > 0 ? 'bottom-73' : 'bottom-3',
        )}>
          <div className="flex items-center justify-between px-3 py-2 bg-[#ea4335]/10 border-b border-[#3c4043]">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#f28b82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="text-xs font-semibold text-[#f28b82]">{leaveRequests.length} leave request{leaveRequests.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="max-h-50 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
            {leaveRequests.map((req) => (
              <div key={req.studentId} className="flex items-center justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 transition-colors border-b border-[#3c4043]/30 last:border-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <svg className="h-3 w-3 text-[#f28b82] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span className="truncate text-xs text-[#e8eaed]"><strong>{req.studentName}</strong> wants to leave</span>
                </div>
                <div className="flex gap-1.5 ml-2 shrink-0">
                  {req.teacherHandled ? (
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-semibold',
                      req.teacherHandled === 'approved' ? 'bg-[#34a853]/15 text-[#34a853]' : 'bg-[#ea4335]/15 text-[#ea4335]',
                    )}>
                      Teacher {req.teacherHandled}
                    </span>
                  ) : (
                    <>
                      <button onClick={() => { sendLeaveControl(req.studentId, true); notifyTeacher({ action_type: 'leave_control', student_id: req.studentId, student_name: req.studentName, action: 'approved' }); onLeaveRequestHandled(req); }} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Allow</button>
                      <button onClick={() => { sendLeaveControl(req.studentId, false); notifyTeacher({ action_type: 'leave_control', student_id: req.studentId, student_name: req.studentName, action: 'denied' }); onLeaveRequestHandled(req); }} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rejoin requests (floating, stacked above leaves) ── */}
      {rejoinRequests.length > 0 && (
        <div className={cn(
          'absolute left-3 z-40 w-70 rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/8 overflow-hidden',
          leaveRequests.length > 0 ? 'bottom-133' :
          mediaRequests.length > 0 ? 'bottom-73' : 'bottom-3',
        )}>
          <div className="flex items-center justify-between px-3 py-2 bg-[#4285f4]/10 border-b border-[#3c4043]">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span className="text-xs font-semibold text-[#8ab4f8]">{rejoinRequests.length} rejoin request{rejoinRequests.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="max-h-50 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
            {rejoinRequests.map((req) => (
              <div key={req.studentId} className="flex items-center justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 transition-colors border-b border-[#3c4043]/30 last:border-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <svg className="h-3 w-3 text-[#8ab4f8] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  <span className="truncate text-xs text-[#e8eaed]"><strong>{req.studentName}</strong> wants to rejoin</span>
                </div>
                <div className="flex gap-1.5 ml-2 shrink-0">
                  {req.teacherHandled ? (
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-semibold',
                      req.teacherHandled === 'approved' ? 'bg-[#34a853]/15 text-[#34a853]' : 'bg-[#ea4335]/15 text-[#ea4335]',
                    )}>
                      Teacher {req.teacherHandled}
                    </span>
                  ) : (
                    <>
                      <button onClick={() => { sendRejoinControl(req.studentId, true); notifyTeacher({ action_type: 'rejoin_control', student_id: req.studentId, student_name: req.studentName, action: 'approved' }); onRejoinRequestHandled(req); }} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Allow</button>
                      <button onClick={() => { sendRejoinControl(req.studentId, false); notifyTeacher({ action_type: 'rejoin_control', student_id: req.studentId, student_name: req.studentName, action: 'denied' }); onRejoinRequestHandled(req); }} className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════
// BCRequestsTab — Sidebar tab showing all student requests
// Uses useLocalParticipant for sending control messages.
// ═══════════════════════════════════════════════════════════════

function BCRequestsTab({
  raisedHands,
  mediaRequests,
  leaveRequests,
  rejoinRequests,
  extensionRequests,
  extensionActionLoading,
  onDismissHand,
  onDismissAllHands,
  onMediaRequestHandled,
  onLeaveRequestHandled,
  onRejoinRequestHandled,
  onExtensionAction,
}: {
  raisedHands: Map<string, { name: string; time: number }>;
  mediaRequests: MediaRequest[];
  leaveRequests: LeaveRequest[];
  rejoinRequests: RejoinRequest[];
  extensionRequests: Array<{ id: string; student_email: string; student_name: string; requested_minutes: number; extension_fee_paise: number; status: string }>;
  extensionActionLoading: string | null;
  onDismissHand: (id: string) => void;
  onDismissAllHands: () => void;
  onMediaRequestHandled: (req: MediaRequest) => void;
  onLeaveRequestHandled: (req: LeaveRequest) => void;
  onRejoinRequestHandled: (req: RejoinRequest) => void;
  onExtensionAction: (reqId: string, action: 'approve' | 'reject') => void;
}) {
  const { localParticipant } = useLocalParticipant();

  // Notify teacher that BC handled a request (auto-dismisses in teacher UI)
  const notifyTeacher = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { topic: 'bc_request_action', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendMediaControl = useCallback(async (targetId: string, type: 'mic' | 'camera', enabled: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, type, enabled })),
        { topic: 'media_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendLeaveControl = useCallback(async (targetId: string, approved: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, approved })),
        { topic: 'leave_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const sendRejoinControl = useCallback(async (targetId: string, approved: boolean) => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: targetId, approved })),
        { topic: 'rejoin_control', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  const handCount = raisedHands.size;
  const sortedHands = Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time);
  const hasAny = handCount > 0 || mediaRequests.length > 0 || leaveRequests.length > 0 || rejoinRequests.length > 0 || extensionRequests.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-2">
        <span className="text-sm font-medium text-[#e8eaed]">Student Requests</span>
      </div>

      {!hasAny && (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <svg className="h-10 w-10 text-[#3c4043] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
            <p className="text-xs text-[#9aa0a6]">No pending requests</p>
          </div>
        </div>
      )}

      <div className="p-2 space-y-3">
        {/* ── Hand raises ── */}
        {handCount > 0 && (
          <div className="rounded-lg border border-[#f9ab00]/30 bg-[#f9ab00]/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#f9ab00]/20">
              <span className="text-xs font-semibold text-[#f9ab00] flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                {handCount} Hand{handCount !== 1 ? 's' : ''} Raised
              </span>
              <button onClick={onDismissAllHands} className="text-[10px] text-[#9aa0a6] hover:text-white">Lower all</button>
            </div>
            {sortedHands.map(([id, info]) => (
              <div key={id} className="flex items-center justify-between px-3 py-1.5 hover:bg-[#3c4043]/30">
                <span className="truncate text-xs text-[#e8eaed]">{info.name}</span>
                <button onClick={() => onDismissHand(id)} className="text-[10px] text-[#9aa0a6] hover:text-white px-1.5">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Media requests ── */}
        {mediaRequests.length > 0 && (
          <div className="rounded-lg border border-[#8ab4f8]/30 bg-[#8ab4f8]/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#8ab4f8]/20">
              <span className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                {mediaRequests.length} Media Request{mediaRequests.length !== 1 ? 's' : ''}
              </span>
            </div>
            {mediaRequests.map((req) => (
              <div key={`${req.studentId}_${req.type}`} className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/30 border-b border-[#3c4043]/20 last:border-0">
                <span className="truncate text-xs text-[#e8eaed] flex-1">
                  <strong>{req.studentName}</strong> — {req.desired ? 'on' : 'off'} {req.type}
                </span>
                <div className="flex gap-1 ml-2 shrink-0">
                  {req.teacherHandled ? (
                    <span className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-semibold',
                      req.teacherHandled === 'approved' ? 'bg-[#34a853]/15 text-[#34a853]' : 'bg-[#ea4335]/15 text-[#ea4335]',
                    )}>Teacher {req.teacherHandled}</span>
                  ) : (
                    <>
                      <button onClick={() => { sendMediaControl(req.studentId, req.type, req.desired); notifyTeacher({ action_type: 'media_control', student_id: req.studentId, student_name: req.studentName, action: 'approved', type: req.type, desired: req.desired }); onMediaRequestHandled(req); }} className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30">✓</button>
                      <button onClick={() => { notifyTeacher({ action_type: 'media_control', student_id: req.studentId, student_name: req.studentName, action: 'denied', type: req.type }); onMediaRequestHandled(req); }} className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30">✕</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Leave requests ── */}
        {leaveRequests.length > 0 && (
          <div className="rounded-lg border border-[#f28b82]/30 bg-[#f28b82]/5 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#f28b82]/20">
              <span className="text-xs font-semibold text-[#f28b82] flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {leaveRequests.length} Leave Request{leaveRequests.length !== 1 ? 's' : ''}
              </span>
            </div>
            {leaveRequests.map((req) => (
              <div key={req.studentId} className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/30 border-b border-[#3c4043]/20 last:border-0">
                <span className="truncate text-xs text-[#e8eaed]"><strong>{req.studentName}</strong> wants to leave</span>
                <div className="flex gap-1 ml-2 shrink-0">
                  {req.teacherHandled ? (
                    <span className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-semibold',
                      req.teacherHandled === 'approved' ? 'bg-[#34a853]/15 text-[#34a853]' : 'bg-[#ea4335]/15 text-[#ea4335]',
                    )}>Teacher {req.teacherHandled}</span>
                  ) : (
                    <>
                      <button onClick={() => { sendLeaveControl(req.studentId, true); notifyTeacher({ action_type: 'leave_control', student_id: req.studentId, student_name: req.studentName, action: 'approved' }); onLeaveRequestHandled(req); }} className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30">Allow</button>
                      <button onClick={() => { sendLeaveControl(req.studentId, false); notifyTeacher({ action_type: 'leave_control', student_id: req.studentId, student_name: req.studentName, action: 'denied' }); onLeaveRequestHandled(req); }} className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30">Deny</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rejoin requests ── */}
        {rejoinRequests.length > 0 && (
          <div className="rounded-lg border border-[#8ab4f8]/30 bg-[#4285f4]/5 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#8ab4f8]/20">
              <span className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                {rejoinRequests.length} Rejoin Request{rejoinRequests.length !== 1 ? 's' : ''}
              </span>
            </div>
            {rejoinRequests.map((req) => (
              <div key={req.studentId} className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/30 border-b border-[#3c4043]/20 last:border-0">
                <span className="truncate text-xs text-[#e8eaed]"><strong>{req.studentName}</strong> wants to rejoin</span>
                <div className="flex gap-1 ml-2 shrink-0">
                  {req.teacherHandled ? (
                    <span className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-semibold',
                      req.teacherHandled === 'approved' ? 'bg-[#34a853]/15 text-[#34a853]' : 'bg-[#ea4335]/15 text-[#ea4335]',
                    )}>Teacher {req.teacherHandled}</span>
                  ) : (
                    <>
                      <button onClick={() => { sendRejoinControl(req.studentId, true); notifyTeacher({ action_type: 'rejoin_control', student_id: req.studentId, student_name: req.studentName, action: 'approved' }); onRejoinRequestHandled(req); }} className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30">Allow</button>
                      <button onClick={() => { sendRejoinControl(req.studentId, false); notifyTeacher({ action_type: 'rejoin_control', student_id: req.studentId, student_name: req.studentName, action: 'denied' }); onRejoinRequestHandled(req); }} className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30">Deny</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Extension requests (coordinator approval) ── */}
        {extensionRequests.length > 0 && (
          <div className="rounded-lg border border-blue-400/30 bg-blue-500/5 overflow-hidden">
            <div className="px-3 py-2 border-b border-blue-400/20">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {extensionRequests.length} Extension Request{extensionRequests.length !== 1 ? 's' : ''}
              </span>
            </div>
            {extensionRequests.map((req) => (
              <div key={req.id} className="px-3 py-2 hover:bg-[#3c4043]/30 border-b border-[#3c4043]/20 last:border-0 space-y-1.5">
                <div className="text-xs text-[#e8eaed]">
                  <strong>{req.student_name || req.student_email}</strong> wants <strong>+{req.requested_minutes}min</strong>
                </div>
                {req.extension_fee_paise > 0 && (
                  <div className="text-[10px] text-[#9aa0a6]">
                    Fee: ₹{(req.extension_fee_paise / 100).toFixed(0)} (invoiced as overdue on approval)
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onExtensionAction(req.id, 'approve')}
                    disabled={extensionActionLoading === req.id}
                    className="rounded px-2.5 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 disabled:opacity-50"
                  >
                    {extensionActionLoading === req.id ? '…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => onExtensionAction(req.id, 'reject')}
                    disabled={extensionActionLoading === req.id}
                    className="rounded px-2.5 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
                <p className="text-[9px] text-[#9aa0a6]/60">Teacher already approved</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TalkToTeacherButton — BC press-and-hold private audio to teacher.
// • Mic is muted by default and only enabled while the button is held.
// • SFU-level track-subscription permissions are tightened so BC's
//   published mic track is forwarded ONLY to the teacher participant —
//   students, parents, and ghost observers cannot subscribe.
// • Teacher is detected by participant identity prefix `teacher_`
//   (excluding the `_screen` tablet device).
// Must render inside a <LiveKitRoom> context.
// ═══════════════════════════════════════════════════════════════
function TalkToTeacherButton() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [active, setActive] = useState(false);

  // Derive teacher identity reactively from the participant list.
  // useRemoteParticipants() updates whenever participants join/leave,
  // so this will never show "offline" when the teacher is present.
  const teacherIdentity = useMemo(() => {
    const teacher = remoteParticipants.find(
      (p) => p.identity.startsWith('teacher_') && !p.identity.endsWith('_screen')
    );
    return teacher?.identity ?? null;
  }, [remoteParticipants]);

  // Ensure mic starts muted on mount and on unmount.
  useEffect(() => {
    localParticipant.setMicrophoneEnabled(false).catch(() => {});
    return () => {
      localParticipant.setMicrophoneEnabled(false).catch(() => {});
    };
  }, [localParticipant]);

  // Listen for teacher's reply signal
  const [teacherReplying, setTeacherReplying] = useState(false);
  const [teacherReplyName, setTeacherReplyName] = useState('Teacher');
  const onTeacherReply = useCallback((msg: { payload?: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as { type?: string; name?: string };
      if (data.type === 'teacher_whisper_start') {
        setTeacherReplying(true);
        if (data.name) setTeacherReplyName(data.name);
      } else if (data.type === 'teacher_whisper_stop') {
        setTeacherReplying(false);
      }
    } catch {}
  }, []);
  useDataChannel('whisper_signal', onTeacherReply);

  const start = useCallback(async () => {
    if (!teacherIdentity) return;
    setActive(true);
    try {
      await localParticipant.setMicrophoneEnabled(true);
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'whisper_start', name: localParticipant.name || 'Batch Coordinator' })),
        { reliable: true, topic: 'whisper_signal' },
      );
    } catch {
      setActive(false);
    }
  }, [localParticipant, teacherIdentity]);

  const stop = useCallback(async () => {
    setActive(false);
    try {
      await localParticipant.setMicrophoneEnabled(false);
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'whisper_stop' })),
        { reliable: true, topic: 'whisper_signal' },
      );
    } catch {}
  }, [localParticipant]);

  const disabled = !teacherIdentity;

  return (
    <>
    <button
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={() => { if (active) stop(); }}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={(e) => { e.preventDefault(); stop(); }}
      onTouchCancel={stop}
      disabled={disabled}
      className={cn(
        'ml-auto mr-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none',
        disabled && 'opacity-40 cursor-not-allowed bg-[#292a2d] text-[#9aa0a6]',
        !disabled && (active
          ? 'bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/60'
          : 'bg-[#292a2d] text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]'),
      )}
      title={
        disabled
          ? 'Waiting for teacher to join…'
          : 'Hold to talk privately to the teacher'
      }
      aria-pressed={active}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', active ? 'bg-emerald-400 animate-pulse' : 'bg-[#5f6368]')} />
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
      {disabled ? 'Teacher offline' : active ? 'Talking…' : 'Hold to talk'}
    </button>

    {/* Teacher-replying alert */}
    {teacherReplying && (
      <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-blue-500/40 bg-[#1a1e2e]/95 px-5 py-3 shadow-2xl backdrop-blur-sm">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-400" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-blue-300">{teacherReplyName} is responding</span>
          <span className="text-[10px] text-blue-400/70">Teacher is talking back to you</span>
        </div>
      </div>
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// TeacherActionSyncer — listens for teacher approval/denial of student
// requests and marks them with teacherHandled so the BC panels update.
// Must be rendered inside a LiveKitRoom context (RoomMonitor render prop).
// ─────────────────────────────────────────────────────────────
function TeacherActionSyncer({
  setMediaRequests,
  setLeaveRequests,
  setRejoinRequests,
}: {
  setMediaRequests: React.Dispatch<React.SetStateAction<MediaRequest[]>>;
  setLeaveRequests: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  setRejoinRequests: React.Dispatch<React.SetStateAction<RejoinRequest[]>>;
}) {
  const onTeacherAction = useCallback((msg: { payload?: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as {
        action_type?: string;
        student_id?: string;
        action?: 'approved' | 'denied';
        type?: 'mic' | 'camera';
      };
      const { action_type, student_id, action } = data;
      if (!action_type || !student_id || !action) return;

      if (action_type === 'media_control' && data.type) {
        const mediaType = data.type;
        setMediaRequests(prev =>
          prev.map(r => r.studentId === student_id && r.type === mediaType ? { ...r, teacherHandled: action } : r)
        );
        setTimeout(() => {
          setMediaRequests(prev => prev.filter(r => !(r.studentId === student_id && r.type === mediaType)));
        }, 2500);
      } else if (action_type === 'leave_control') {
        setLeaveRequests(prev =>
          prev.map(r => r.studentId === student_id ? { ...r, teacherHandled: action } : r)
        );
        setTimeout(() => {
          setLeaveRequests(prev => prev.filter(r => r.studentId !== student_id));
        }, 2500);
      } else if (action_type === 'rejoin_control') {
        setRejoinRequests(prev =>
          prev.map(r => r.studentId === student_id ? { ...r, teacherHandled: action } : r)
        );
        setTimeout(() => {
          setRejoinRequests(prev => prev.filter(r => r.studentId !== student_id));
        }, 2500);
      }
    } catch {}
  }, [setMediaRequests, setLeaveRequests, setRejoinRequests]);

  useDataChannel('teacher_request_action', onTeacherAction);
  return null;
}