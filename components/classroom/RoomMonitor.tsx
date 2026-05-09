'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useRemoteParticipants,
  useTracks,
  useDataChannel,
  useRoomContext,
  VideoTrack,
  AudioTrack,
} from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { Track, RoomEvent, ConnectionQuality, type RemoteParticipant } from 'livekit-client';
import { sfxTabSwitch, sfxDangerAlert } from '@/lib/sounds';

/* ═══════════════════════════════════════════════════════════════
   RoomMonitor — Per-room LiveKit wrapper for the BC Live Monitor.

   Wraps a single <LiveKitRoom> connection. Extracts:
     - Teacher participant (camera + screen share tracks)
     - Student participants (video tracks + count)
     - Data channel messages (attention, hand raise, media, etc.)
   Reports all data upward via callbacks to the parent aggregator.
   ═══════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────
export interface StudentAttentionState {
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

export interface MonitorAlert {
  id: string;
  roomName: string;
  batchName: string;
  message: string;
  severity: 'danger' | 'warning' | 'info';
  type: 'ai' | 'report' | 'request';
  time: number;
  studentEmail?: string;
  studentName?: string;
  data?: Record<string, unknown>;
}

export interface MediaRequest {
  id: string;
  roomName: string;
  batchName: string;
  studentId: string;
  studentName: string;
  type: 'mic' | 'camera';
  desired: boolean;
  time: number;
  teacherHandled?: 'approved' | 'denied';
}

export interface EndClassRequest {
  roomName: string;
  batchName: string;
  status: 'pending' | 'approved' | 'denied' | 'none';
  reason?: string;
  requestedAt?: string;
}

export interface LeaveRequest {
  studentId: string;
  studentName: string;
  time: number;
  teacherHandled?: 'approved' | 'denied';
}

export interface RejoinRequest {
  studentId: string;
  studentName: string;
  time: number;
  teacherHandled?: 'approved' | 'denied';
}

export interface RoomData {
  roomName: string;
  batchName: string;
  teacher: RemoteParticipant | null;
  teacherScreen: RemoteParticipant | null;
  students: RemoteParticipant[];
  attention: Map<string, StudentAttentionState>;
  avgEngagement: number;
  raisedHands: Map<string, { name: string; time: number }>;
  /** Dismiss a single raised hand (modifies source-of-truth state) */
  dismissHand: (studentId: string) => void;
  /** Dismiss all raised hands */
  dismissAllHands: () => void;
  endClassRequest: EndClassRequest;
  connectionQuality: ConnectionQuality;
}

export interface RoomMonitorCallbacks {
  onRoomData: (roomName: string, data: RoomData) => void;
  onAlert: (alert: MonitorAlert) => void;
  onMediaRequest: (req: MediaRequest) => void;
  onLeaveRequest?: (req: LeaveRequest) => void;
  onRejoinRequest?: (req: RejoinRequest) => void;
}

interface RoomMonitorProps {
  token: string;
  wsUrl: string;
  roomName: string;
  batchName: string;
  callbacks: RoomMonitorCallbacks;
  /** Render prop: receives extracted room data for inline rendering */
  children?: (data: RoomData) => React.ReactNode;
}

/* ── Inner component: runs inside <LiveKitRoom> context ────── */
function RoomMonitorInner({
  roomName,
  batchName,
  callbacks,
  children,
}: Omit<RoomMonitorProps, 'token' | 'wsUrl'>) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();

  // Subscribe to all track sources reactively so AudioTrack elements stay in sync
  // when tracks are published/subscribed/muted after initial render.
  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.ScreenShareAudio, Track.Source.Microphone],
    { onlySubscribed: true },
  );

  // ── State ──────────────────────────────────────────────────
  const [attention, setAttention] = useState<Map<string, StudentAttentionState>>(new Map());
  const [raisedHands, setRaisedHands] = useState<Map<string, { name: string; time: number }>>(new Map());
  const [endClassReq, setEndClassReq] = useState<EndClassRequest>({ roomName, batchName, status: 'none' });
  const [connQuality, setConnQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const lastAlertedRef = useRef<Map<string, number>>(new Map());
  const processedHandIds = useRef(new Set<string>());

  // ── Participants classification ────────────────────────────
  // Uses the same detection logic as StudentView's isTeacherPrimary / isTeacherScreen
  // to handle both metadata-based and identity-based detection correctly.
  const teacher = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        if (m.effective_role || m.portal_role) {
          return (m.effective_role || m.portal_role) === 'teacher' && m.device !== 'screen';
        }
      } catch {}
      return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
    }) ?? null;
  }, [remoteParticipants]);

  const teacherScreen = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        if (m.device) {
          return m.device === 'screen' && (m.portal_role === 'teacher' || m.effective_role === 'teacher_screen');
        }
        if (m.effective_role || m.portal_role) {
          return (m.effective_role || m.portal_role) === 'teacher_screen';
        }
      } catch {}
      return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
    }) ?? null;
  }, [remoteParticipants]);

  const students = useMemo(() => {
    return remoteParticipants.filter((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        return (meta.effective_role || meta.portal_role) === 'student';
      } catch {}
      return p.identity.startsWith('student');
    });
  }, [remoteParticipants]);

  // ── Average engagement ─────────────────────────────────────
  const avgEngagement = useMemo(() => {
    const scores = Array.from(attention.values());
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((s, a) => s + a.attentionScore, 0) / scores.length);
  }, [attention]);

  // ── Connection quality ─────────────────────────────────────
  useEffect(() => {
    const handler = () => setConnQuality(room.localParticipant.connectionQuality);
    room.on(RoomEvent.ConnectionQualityChanged, handler);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handler); };
  }, [room]);

  // ── Hand dismiss helpers (so consumers can modify source-of-truth) ──
  const dismissHand = useCallback((studentId: string) => {
    setRaisedHands(prev => { const n = new Map(prev); n.delete(studentId); return n; });
  }, []);
  const dismissAllHands = useCallback(() => {
    setRaisedHands(new Map());
  }, []);

  // ── Report data upward ─────────────────────────────────────
  const roomData = useMemo<RoomData>(() => ({
    roomName,
    batchName,
    teacher,
    teacherScreen,
    students,
    attention,
    avgEngagement,
    raisedHands,
    dismissHand,
    dismissAllHands,
    endClassRequest: endClassReq,
    connectionQuality: connQuality,
  }), [roomName, batchName, teacher, teacherScreen, students, attention, avgEngagement, raisedHands, dismissHand, dismissAllHands, endClassReq, connQuality]);

  useEffect(() => {
    callbacks.onRoomData(roomName, roomData);
  }, [roomData, roomName, callbacks]);

  // ── Data channel: attention_update ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAttentionUpdate = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text);
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

      setAttention(prev => {
        const next = new Map(prev);
        next.set(state.email, state);
        return next;
      });

      // AI alerts
      const now = Date.now();
      const lastAlert = lastAlertedRef.current.get(state.email) ?? 0;
      if (now - lastAlert > 15_000) {
        let msg = '';
        let severity: 'warning' | 'danger' = 'warning';
        const st = state.monitorState.toLowerCase();

        if (st === 'eyes_closed') { msg = `${state.name} appears to be sleeping`; severity = 'danger'; }
        else if (st === 'tab_switched') { msg = `${state.name} switched to another tab`; severity = 'danger'; sfxTabSwitch(); }
        else if (!state.faceDetected) { msg = `${state.name} is not in frame`; severity = 'danger'; }
        else if (state.faceCount > 1) { msg = `${state.name} — multiple faces detected`; severity = 'danger'; }
        else if (state.attentionScore < 30) { msg = `${state.name} has low attention (${Math.round(state.attentionScore)}%)`; severity = 'warning'; }

        if (msg) {
          lastAlertedRef.current.set(state.email, now);
          callbacks.onAlert({
            id: `ai-${state.email}-${now}`,
            roomName, batchName,
            message: msg,
            severity,
            type: 'ai',
            time: now,
            studentEmail: state.email,
            studentName: state.name,
          });
        }
      }
    } catch {}
  }, [roomName, batchName, callbacks]);
  useDataChannel('attention_update', onAttentionUpdate);

  // ── Data channel: hand_raise ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandRaise = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; action: 'raise' | 'lower' };
      const key = `${data.student_id}_${data.action}_${Math.floor(Date.now() / 500)}`;
      if (processedHandIds.current.has(key)) return;
      processedHandIds.current.add(key);
      if (processedHandIds.current.size > 200) {
        processedHandIds.current = new Set(Array.from(processedHandIds.current).slice(-100));
      }

      setRaisedHands(prev => {
        const next = new Map(prev);
        if (data.action === 'raise') {
          next.set(data.student_id, { name: data.student_name, time: Date.now() });
          callbacks.onAlert({
            id: `hand-${data.student_id}-${Date.now()}`,
            roomName, batchName,
            message: `${data.student_name} raised their hand`,
            severity: 'info',
            type: 'request',
            time: Date.now(),
            studentName: data.student_name,
          });
        } else {
          next.delete(data.student_id);
        }
        return next;
      });
    } catch {}
  }, [roomName, batchName, callbacks]);
  useDataChannel('hand_raise', onHandRaise);

  // ── Data channel: media_request ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaReq = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; type: 'mic' | 'camera'; desired: boolean };
      callbacks.onMediaRequest({
        id: `${data.student_id}-${data.type}-${Date.now()}`,
        roomName, batchName,
        studentId: data.student_id,
        studentName: data.student_name,
        type: data.type,
        desired: data.desired,
        time: Date.now(),
      });
    } catch {}
  }, [roomName, batchName, callbacks]);
  useDataChannel('media_request', onMediaReq);

  // ── Data channel: leave_request ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveReq = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text);
      callbacks.onAlert({
        id: `leave-${Date.now()}`,
        roomName, batchName,
        message: `${data.student_name || 'Student'} requested to leave`,
        severity: 'info',
        type: 'request',
        time: Date.now(),
        studentName: data.student_name,
      });
      callbacks.onLeaveRequest?.({
        studentId: data.student_id,
        studentName: data.student_name || 'Student',
        time: Date.now(),
      });
    } catch {}
  }, [roomName, batchName, callbacks]);
  useDataChannel('leave_request', onLeaveReq);

  // ── Data channel: rejoin_request ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onRejoinReq = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text);
      callbacks.onAlert({
        id: `rejoin-${Date.now()}`,
        roomName, batchName,
        message: `${data.student_name || 'Student'} wants to rejoin`,
        severity: 'info',
        type: 'request',
        time: Date.now(),
        studentName: data.student_name,
      });
      callbacks.onRejoinRequest?.({
        studentId: data.student_id,
        studentName: data.student_name || 'Student',
        time: Date.now(),
      });
    } catch {}
  }, [roomName, batchName, callbacks]);
  useDataChannel('rejoin_request', onRejoinReq);

  // ── Data channel: teacher_report ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTeacherReport = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(text);
      callbacks.onAlert({
        id: `report-${Date.now()}`,
        roomName, batchName,
        message: `⚠️ ${data.student_name || 'Student'} reported the teacher: ${data.category || 'misconduct'}`,
        severity: 'danger',
        type: 'report',
        time: Date.now(),
        studentName: data.student_name,
      });
      sfxDangerAlert();
    } catch {}
  }, [roomName, batchName, callbacks]);
  useDataChannel('teacher_report', onTeacherReport);

  // ── End-class request polling ──────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomName}/end-request`);
        const data = await res.json();
        if (data.success && data.data) {
          const status = data.data.status ?? 'none';
          setEndClassReq(prev => {
            if (prev.status === status) return prev;
            if (status === 'pending') {
              callbacks.onAlert({
                id: `endclass-${roomName}-${Date.now()}`,
                roomName, batchName,
                message: `Teacher requested to end class early${data.data.reason ? `: ${data.data.reason}` : ''}`,
                severity: 'warning',
                type: 'request',
                time: Date.now(),
                data: { action: 'end_class', reason: data.data.reason },
              });
            }
            return { roomName, batchName, status, reason: data.data.reason, requestedAt: data.data.requested_at };
          });
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 8_000);
    return () => clearInterval(iv);
  }, [roomName, batchName, callbacks]);

  // ── Clean up departed participants ─────────────────────────
  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map(p => p.identity));
    setAttention(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!activeIds.has(key)) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
    setRaisedHands(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [remoteParticipants]);

  // ── Audio playback for teacher + all students ───────────────
  // Driven by useTracks (reactive) so new mic publications / subscriptions
  // are picked up immediately without waiting for a parent re-render.
  const audioElements = useMemo(() => {
    return allTracks
      .filter(t => t.source === Track.Source.Microphone)
      .map(t => (
        <AudioTrack
          key={`audio-${t.participant.identity}`}
          trackRef={t}
        />
      ));
  }, [allTracks]);

  // ── Render children with room data ─────────────────────────
  return <>{audioElements}{children?.(roomData)}</>;
}

/* ── Outer wrapper: provides <LiveKitRoom> context ──────────── */
export default function RoomMonitor({ token, wsUrl, roomName, batchName, callbacks, children }: RoomMonitorProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      connect={true}
      audio={false}
      video={false}
      style={{ height: '100%', width: '100%' }}
      options={{
        adaptiveStream: false, // BC monitor must subscribe to ALL tracks eagerly
        dynacast: true,
      }}
    >
      <RoomMonitorInner roomName={roomName} batchName={batchName} callbacks={callbacks}>
        {children}
      </RoomMonitorInner>
    </LiveKitRoom>
  );
}
