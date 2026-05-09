'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useRemoteParticipants,
  useLocalParticipant,
  useDataChannel,
  AudioTrack,
  useRoomContext,
  type TrackReference,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import VideoTile from './VideoTile';
import WhiteboardComposite from './WhiteboardComposite';
import ChatPanel from './ChatPanel';
import AttendancePanel from './AttendancePanel';
import ParticipantList from './ParticipantList';
import StudentDetailPanel from './StudentDetailPanel';
import AINotificationCenter from './AINotificationCenter';
import { useAINotifications } from '@/hooks/useAINotifications';
import { cn, fmtDateLongIST } from '@/lib/utils';
import { usePlatformName } from '@/components/providers/PlatformProvider';

/* =================================================================
   GhostView — Silent observation view for Academic Operators,
   Academics, Owners, Parents and Ghost roles.
   Redesigned to match CoordinatorLiveView UI.
   ================================================================= */

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

export interface GhostViewProps {
  roomId: string;
  roomName: string;
  observerName: string;
  observerRole: string;
  scheduledStart?: string;
  liveStartedAt?: string;
  durationMinutes?: number;
  topic?: string;
  onLeave: () => void;
}

type ViewMode = 'control' | 'teacher' | 'student';
type SidebarTab = 'monitoring' | 'chat' | 'participants' | 'attendance' | 'requests';

function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function useAdaptiveGrid(count: number, scrollThreshold = 20, gapPx = 8) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const roRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    if (!node) { roRef.current = null; return; }
    setSize({ w: node.clientWidth, h: node.clientHeight });
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);
  const layout = useMemo(() => {
    const { w, h } = size;
    const n = count;
    const TILE_ASPECT = 16 / 9;
    if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, rows: 1, tileW: 0, tileH: 0, shouldScroll: false };
    if (n > scrollThreshold) {
      const cols = n <= 30 ? 6 : n <= 49 ? 7 : 8;
      const tileW = Math.max(120, (w - gapPx * (cols - 1)) / cols);
      return { cols, rows: Math.ceil(n / cols), tileW, tileH: tileW / TILE_ASPECT, shouldScroll: true };
    }
    let best = { cols: 1, rows: n, tileW: 0, tileH: 0, area: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cellW = (w - gapPx * (cols - 1)) / cols;
      const cellH = (h - gapPx * (rows - 1)) / rows;
      if (cellW <= 0 || cellH <= 0) continue;
      const tileW = Math.min(cellW, cellH * TILE_ASPECT);
      const area = tileW * (tileW / TILE_ASPECT);
      if (area > best.area) best = { cols, rows, tileW, tileH: tileW / TILE_ASPECT, area };
    }
    return { cols: best.cols, rows: best.rows, tileW: best.tileW, tileH: best.tileH, shouldScroll: false };
  }, [count, size, scrollThreshold, gapPx]);
  return { containerRef, layout };
}

export default function GhostView({
  roomId, roomName, observerName, observerRole,
  scheduledStart, liveStartedAt, durationMinutes, topic, onLeave,
}: GhostViewProps) {
  const platformName = usePlatformName();
  const isParent = observerRole === 'parent';
  const [viewMode, setViewMode] = useState<ViewMode>(isParent ? 'student' : 'control');
  const [sidebarOpen, setSidebarOpen] = useState(!isParent);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('monitoring');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const canAnnounce = observerRole === 'academic_operator' || observerRole === 'academic';
  const [announceOn, setAnnounceOn] = useState(false);
  const toggleAnnounce = useCallback(async () => {
    if (!canAnnounce) return;
    try { const next = !announceOn; await localParticipant.setMicrophoneEnabled(next); setAnnounceOn(next); }
    catch (err) { console.error('[GhostView] Announce toggle failed:', err); }
  }, [canAnnounce, announceOn, localParticipant]);

  const [, setConnTick] = useState(0);
  useEffect(() => {
    const handler = () => setConnTick((t) => t + 1);
    room.on(RoomEvent.ConnectionQualityChanged, handler);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handler); };
  }, [room]);

  const [studentAttention, setStudentAttention] = useState<Map<string, StudentAttentionState>>(new Map());
  const [teacherAttention, setTeacherAttention] = useState<StudentAttentionState | null>(null);
  const { alerts, addAlert, clearAlerts } = useAINotifications({ rateLimitMs: 5000 });
  const lastAlertedRef = useRef<Map<string, number>>(new Map());
  const absenceSinceRef = useRef<Map<string, number>>(new Map());
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([]);
  const [raisedHands, setRaisedHands] = useState<Map<string, { name: string; time: number }>>(new Map());
  const processedHandIds = useRef(new Set<string>());
  const [mediaRequests, setMediaRequests] = useState<Array<{ id: string; student_id: string; student_name: string; type: 'mic' | 'camera'; desired: boolean; time: number }>>([]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

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
    return Math.max(0, Math.floor((effectiveStart + durationMinutes * 60_000 - now) / 1000));
  }, [scheduledStart, liveStartedAt, durationMinutes, now]);

  const teacher = useMemo(() => remoteParticipants.find((p) => {
    try { const m = JSON.parse(p.metadata || '{}'); if (m.effective_role || m.portal_role) return (m.effective_role || m.portal_role) === 'teacher'; } catch { /* ignore */ }
    return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
  }), [remoteParticipants]);

  const students = useMemo(() => remoteParticipants.filter((p) => {
    try { const m = JSON.parse(p.metadata || '{}'); if (m.effective_role || m.portal_role) return (m.effective_role || m.portal_role) === 'student'; } catch { /* ignore */ }
    return p.identity.startsWith('student');
  }), [remoteParticipants]);

  const screenDevice = useMemo(() => remoteParticipants.find((p) => {
    try { const m = JSON.parse(p.metadata || '{}'); if (m.device) return m.device === 'screen' && (m.portal_role === 'teacher' || m.effective_role === 'teacher_screen'); } catch { /* ignore */ }
    return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
  }) ?? null, [remoteParticipants]);

  const teacherScreen = teacher?.getTrackPublication(Track.Source.ScreenShare);
  const tabletScreen = screenDevice?.getTrackPublication(Track.Source.ScreenShare);
  const hasScreenShare = (!!teacherScreen && !teacherScreen.isMuted) || (!!tabletScreen && !tabletScreen.isMuted);
  const hasTeacherCamera = !!(teacher?.getTrackPublication(Track.Source.Camera)) && !teacher?.getTrackPublication(Track.Source.Camera)?.isMuted;

  const [screenSourcePref, setScreenSourcePref] = useState<'tablet' | 'laptop'>('tablet');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onScreenSource = useCallback((msg: any) => {
    try { const data = JSON.parse(new TextDecoder().decode(msg?.payload)) as { source: 'laptop' | 'tablet' }; if (data.source === 'laptop' || data.source === 'tablet') setScreenSourcePref(data.source); } catch { /* ignore */ }
  }, []);
  useDataChannel('screen_source', onScreenSource);
  useEffect(() => {
    const hasLaptop = !!teacherScreen && !teacherScreen.isMuted;
    const hasTablet = !!tabletScreen && !tabletScreen.isMuted;
    if (hasLaptop && !hasTablet) setScreenSourcePref('laptop');
    else if (!hasLaptop && hasTablet) setScreenSourcePref('tablet');
  }, [teacherScreen, tabletScreen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAttentionUpdate = useCallback((msg: any) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg?.payload)) as {
        studentEmail: string; studentName: string; attentionScore: number; isAttentive: boolean; faceDetected: boolean;
        faceCount?: number; monitorState?: string; eyesClosed?: boolean; gazeAway?: boolean; headYaw?: number;
        headPitch?: number; yawning?: boolean; tabVisible?: boolean; isInactive?: boolean; isMobile?: boolean; role?: string;
      };
      const state: StudentAttentionState = {
        email: data.studentEmail, name: data.studentName, attentionScore: data.attentionScore, isAttentive: data.isAttentive,
        faceDetected: data.faceDetected, faceCount: data.faceCount ?? (data.faceDetected ? 1 : 0),
        monitorState: data.monitorState ?? 'attentive', eyesClosed: data.eyesClosed ?? false, gazeAway: data.gazeAway ?? false,
        headYaw: data.headYaw ?? 0, headPitch: data.headPitch ?? 0, yawning: data.yawning ?? false,
        tabVisible: data.tabVisible ?? true, isInactive: data.isInactive ?? false, isMobile: data.isMobile ?? false, lastUpdate: Date.now(),
      };
      if (data.role === 'teacher') { setTeacherAttention(state); }
      else { setStudentAttention((prev) => { const next = new Map(prev); next.set(data.studentEmail, state); return next; }); }
      const alertNow = Date.now();
      const lastAlert = lastAlertedRef.current.get(data.studentEmail) ?? 0;
      if (!data.faceDetected) { if (!absenceSinceRef.current.has(data.studentEmail)) absenceSinceRef.current.set(data.studentEmail, alertNow); }
      else { absenceSinceRef.current.delete(data.studentEmail); }
      const absenceDuration = data.faceDetected ? 0 : alertNow - (absenceSinceRef.current.get(data.studentEmail) ?? alertNow);
      if (alertNow - lastAlert > 15_000) {
        const stateKey = (data.monitorState ?? '').toLowerCase();
        const subject = data.role === 'teacher' ? `Teacher ${data.studentName.replace(' (Teacher)', '')}` : data.studentName;
        let msg2 = ''; let severity: 'warning' | 'danger' = 'warning'; let category: 'attention' | 'request' = 'attention';
        if (stateKey === 'eyes_closed') { msg2 = `${subject} appears to be ${data.role === 'teacher' ? 'not looking at screen' : 'sleeping'}`; severity = 'danger'; }
        else if (stateKey === 'tab_switched') { msg2 = `${subject} switched to another tab`; severity = 'danger'; }
        else if (!data.faceDetected && absenceDuration >= 300_000) { msg2 = `${subject} is not in frame`; severity = 'danger'; }
        else if (data.attentionScore < 30) { msg2 = `${subject} has low attention (${Math.round(data.attentionScore)}%)`; severity = 'warning'; }
        if (msg2) { addAlert(subject, msg2, { severity, category, studentEmail: data.studentEmail }); }
      }
    } catch { /* ignore */ }
  }, []);
  useDataChannel('attention_update', onAttentionUpdate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandRaise = useCallback((msg: any) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg?.payload)) as { student_id: string; student_name: string; action: 'raise' | 'lower' };
      const key = `${data.student_id}_${data.action}_${Math.floor(Date.now() / 500)}`;
      if (processedHandIds.current.has(key)) return;
      processedHandIds.current.add(key);
      if (processedHandIds.current.size > 200) { const arr = Array.from(processedHandIds.current); processedHandIds.current = new Set(arr.slice(-100)); }
      setRaisedHands((prev) => {
        const next = new Map(prev);
        if (data.action === 'raise') {
          next.set(data.student_id, { name: data.student_name, time: Date.now() });
          addAlert(data.student_name, 'raised their hand', { severity: 'info', category: 'activity' });
        } else { next.delete(data.student_id); }
        return next;
      });
    } catch { /* ignore */ }
  }, []);
  useDataChannel('hand_raise', onHandRaise);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaRequest = useCallback((msg: any) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg?.payload)) as { student_id: string; student_name: string; type: 'mic' | 'camera'; desired: boolean };
      setMediaRequests(prev => [...prev.slice(-19), { id: `${data.student_id}-${data.type}-${Date.now()}`, student_id: data.student_id, student_name: data.student_name, type: data.type, desired: data.desired, time: Date.now() }]);
      addAlert(data.student_name, `requested ${data.type} ${data.desired ? 'on' : 'off'}`, { severity: 'info', category: 'request' });
    } catch { /* ignore */ }
  }, []);
  useDataChannel('media_request', onMediaRequest);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveRequest = useCallback((msg: any) => {
    try { const data = JSON.parse(new TextDecoder().decode(msg?.payload)); addAlert(data.student_name || 'Student', 'requested to leave', { severity: 'info', category: 'request' }); } catch { /* ignore */ }
  }, [addAlert]);
  useDataChannel('leave_request', onLeaveRequest);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFullviewRequest = useCallback((msg: any) => {
    try { const data = JSON.parse(new TextDecoder().decode(msg?.payload)); addAlert(data.student_name || 'Student', 'requested full view', { severity: 'info', category: 'request' }); } catch { /* ignore */ }
  }, [addAlert]);
  useDataChannel('fullview_request', onFullviewRequest);

  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map((p) => p.identity));
    setStudentAttention((prev) => { let changed = false; const next = new Map(prev); for (const k of next.keys()) { if (!activeIds.has(k)) { next.delete(k); changed = true; } } return changed ? next : prev; });
    setRaisedHands((prev) => { let changed = false; const next = new Map(prev); for (const id of next.keys()) { if (!activeIds.has(id)) { next.delete(id); changed = true; } } return changed ? next : prev; });
  }, [remoteParticipants]);

  useEffect(() => {
    const fetch_ = async () => {
      try { const res = await fetch(`/api/v1/monitoring/session/${roomId}`); const data = await res.json(); if (data.success && data.data?.alerts) setMonitoringAlerts(data.data.alerts.slice(0, 10)); } catch { /* ignore */ }
    };
    fetch_(); const iv = setInterval(fetch_, 15_000); return () => clearInterval(iv);
  }, [roomId]);

  const avgEngagement = useMemo(() => {
    const scores = Array.from(studentAttention.values());
    return scores.length === 0 ? 0 : Math.round(scores.reduce((s, a) => s + a.attentionScore, 0) / scores.length);
  }, [studentAttention]);

  const camerasOn = useMemo(() => students.filter((s) => { const cam = s.getTrackPublication(Track.Source.Camera); return cam && !cam.isMuted; }).length, [students]);
  const handCount = raisedHands.size;
  const sortedHands = useMemo(() => Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time), [raisedHands]);

  const { containerRef: controlGridRef, layout: controlLayout } = useAdaptiveGrid(students.length);
  const { containerRef: teacherGridRef, layout: teacherLayout } = useAdaptiveGrid(students.length);

  const downloadNotes = () => {
    const noteContent = `${platformName} Observation Notes\nBatch: ${roomName} (${roomId})\nObserver: ${observerName} (${observerRole})\nDate: ${fmtDateLongIST(new Date())}\n${'\u2500'.repeat(50)}\n${notes}`;
    const blob = new Blob([noteContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stibe_notes_${roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const attBadge = (isSleeping: boolean, isNotLooking: boolean, isLowAtt: boolean, attScore: number) => (
    <div className={cn('absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm pointer-events-none',
      isSleeping ? 'bg-red-600/80 text-white' : isLowAtt ? 'bg-amber-500/80 text-white' : 'bg-green-600/70 text-white')}>
      {isSleeping ? (<svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M2 4h4l2-2"/><path d="M6 8h4l2-2"/><path d="M10 12h4l2-2"/></svg>)
      : isNotLooking ? (<svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>)
      : attScore >= 75 ? 'OK' : '!'}
      <span>{attScore}%</span>
    </div>
  );

  const renderStudentTile = (s: typeof students[0], _forGrid: boolean) => {
    const att = studentAttention.get(s.identity);
    const attScore = att?.attentionScore ?? 100;
    const isSleeping = att?.monitorState === 'eyes_closed';
    const isNotLooking = att?.monitorState === 'looking_away';
    const isLowAtt = attScore < 50;
    return (
      <div key={s.identity} className={cn('relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d] transition-shadow duration-200', isSleeping && 'ring-2 ring-red-500/60', isNotLooking && !isSleeping && 'ring-2 ring-amber-500/60')}>
        <VideoTile participant={s} size="large" showName showMicIndicator playAudio={audioEnabled} handRaised={raisedHands.has(s.identity)} connectionQuality={s.connectionQuality} className="rounded-xl!" onClick={() => setSelectedStudentId(s.identity)} />
        {att && attBadge(isSleeping, isNotLooking, isLowAtt, attScore)}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-[#1a1a1d] text-white select-none">

      {/* HEADER */}
      <div className="flex h-13 items-center justify-between border-b border-[#3c4043] bg-[#202124] px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-[#e8eaed]">{roomName}</span>
            {topic && <span className="text-xs text-[#9aa0a6] ml-1">— {topic}</span>}
            <span className="ml-2 text-xs text-[#9aa0a6]">— Observing</span>
          </div>
          {scheduledStart && (
            <div className="flex items-center gap-2 ml-3 text-xs text-[#9aa0a6]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span className="font-mono">{fmtElapsed(elapsedSec)}</span>
              {remainingSec !== null && (
                <span className={cn('font-mono', remainingSec <= 300 ? 'text-red-400 font-bold' : '')}>({fmtElapsed(remainingSec)} left)</span>
              )}
            </div>
          )}
        </div>

        {/* View mode tabs — hidden for parents */}
        {!isParent && (
          <div className="flex items-center rounded-lg bg-[#292a2d] p-0.5">
            {(['control', 'teacher', 'student'] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', viewMode === mode ? 'bg-[#8ab4f8] text-[#202124]' : 'text-[#9aa0a6] hover:text-[#e8eaed]')}>
                {mode === 'control' ? 'Control' : mode === 'teacher' ? 'Teacher View' : 'Student View'}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isParent && (
            <>
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
              {studentAttention.size > 0 && (
                <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', avgEngagement >= 70 ? 'bg-green-600/20 text-green-400' : avgEngagement >= 40 ? 'bg-amber-600/20 text-amber-400' : 'bg-red-600/20 text-red-400')}>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  {avgEngagement}%
                </span>
              )}
              <div className="h-5 w-px bg-[#3c4043]" />
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-600/20 px-2.5 py-1 text-xs text-emerald-400">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Invisible
              </span>
            </>
          )}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={cn('rounded-full px-2.5 py-1 text-xs transition-colors', audioEnabled ? 'bg-blue-600/20 text-blue-400' : 'bg-[#292a2d] text-[#9aa0a6]')}
            title={audioEnabled ? 'Mute audio' : 'Unmute audio'}
          >
            {audioEnabled
              ? <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              : <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>}
          </button>
          {canAnnounce && (
            <button onClick={toggleAnnounce} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors', announceOn ? 'bg-red-600/20 text-red-400 ring-1 ring-red-500/60 animate-pulse' : 'bg-[#292a2d] text-[#9aa0a6] hover:text-white')}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              {announceOn ? 'On Air' : 'Announce'}
            </button>
          )}
          {!isParent && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-full bg-[#292a2d] px-2.5 py-1 text-xs text-[#9aa0a6] hover:text-white" title="Toggle sidebar">
              {sidebarOpen
                ? <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                : <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>}
            </button>
          )}
          <button onClick={onLeave} className="rounded-full bg-[#ea4335] px-3 py-1 text-xs font-medium text-white hover:bg-[#c5221f]">Leave</button>
        </div>
      </div>

      {/* MAIN BODY */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* CONTROL VIEW */}
          {viewMode === 'control' && (
            <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
              <div className="shrink-0 flex gap-3">
                {hasTeacherCamera && teacher ? (
                  <div className="relative rounded-xl overflow-hidden bg-[#292a2d]" style={{ width: 320, height: 200 }}>
                    <VideoTile participant={teacher} size="large" showName showMicIndicator playAudio={audioEnabled} className="w-full! h-full!" />
                    <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-blue-600/80 px-2 py-0.5 text-[9px] text-white font-semibold flex items-center gap-1">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Teacher
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
                {hasScreenShare && teacher && (
                  <div className="relative rounded-xl overflow-hidden bg-[#292a2d] flex-1" style={{ maxHeight: 200 }}>
                    <WhiteboardComposite teacher={teacher} teacherScreenDevice={screenDevice} preferLaptopScreen={screenSourcePref === 'laptop'} className="h-full w-full rounded-xl" />
                    <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-emerald-600/80 px-2 py-0.5 text-[9px] text-white font-semibold flex items-center gap-1">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Screen Share
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <div
                  ref={controlGridRef}
                  className={cn('grid h-full w-full gap-2', controlLayout.shouldScroll ? 'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]' : 'overflow-hidden')}
                  style={{
                    gridTemplateColumns: controlLayout.tileW > 0 ? `repeat(${controlLayout.cols}, ${controlLayout.tileW}px)` : `repeat(${controlLayout.cols}, minmax(0, 1fr))`,
                    gridAutoRows: controlLayout.tileH > 0 ? `${controlLayout.tileH}px` : 'minmax(0, 1fr)',
                    placeContent: 'center',
                  }}
                >
                  {students.map((s) => renderStudentTile(s, true))}
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

          {/* TEACHER VIEW */}
          {viewMode === 'teacher' && (
            <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden relative">
              <div className="flex items-center px-1 shrink-0">
                <span className="text-xs text-[#9aa0a6]">{students.length} student{students.length !== 1 ? 's' : ''} — Teacher perspective</span>
              </div>
              {hasScreenShare && teacher ? (
                <div className="flex flex-1 flex-col gap-2 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-hidden rounded-xl">
                    <WhiteboardComposite teacher={teacher} teacherScreenDevice={screenDevice} preferLaptopScreen={screenSourcePref === 'laptop'} className="h-full w-full" />
                  </div>
                  {students.length > 0 && (
                    <div className="flex h-25 gap-2 overflow-x-auto overflow-y-hidden shrink-0">
                      {students.map((s) => (
                        <div key={s.identity} className="relative h-full w-[130px] shrink-0 overflow-hidden rounded-lg">
                          <VideoTile participant={s} size="small" showName showMicIndicator playAudio={audioEnabled} handRaised={raisedHands.has(s.identity)} connectionQuality={s.connectionQuality} className="w-full! h-full! rounded-lg!" onClick={() => setSelectedStudentId(s.identity)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={teacherGridRef}
                  className={cn('grid flex-1 w-full gap-2', teacherLayout.shouldScroll ? 'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]' : 'overflow-hidden')}
                  style={{
                    gridTemplateColumns: teacherLayout.tileW > 0 ? `repeat(${teacherLayout.cols}, ${teacherLayout.tileW}px)` : `repeat(${teacherLayout.cols}, minmax(0, 1fr))`,
                    gridAutoRows: teacherLayout.tileH > 0 ? `${teacherLayout.tileH}px` : 'minmax(0, 1fr)',
                    placeContent: 'center',
                  }}
                >
                  {students.map((s) => renderStudentTile(s, true))}
                  {students.length === 0 && <div className="col-span-full flex items-center justify-center text-[#9aa0a6] py-16">No students have joined yet</div>}
                </div>
              )}
              {hasTeacherCamera && teacher && (
                <div className="absolute top-7 left-7 z-30 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/8">
                  <VideoTile participant={teacher} size="small" mirror={false} showName={false} showMicIndicator className="w-[140px]! h-[105px]! rounded-xl!" />
                </div>
              )}
            </div>
          )}

          {/* STUDENT VIEW */}
          {viewMode === 'student' && (
            <div className="flex-1 flex flex-col overflow-hidden relative bg-black">
              {hasScreenShare && teacher ? (
                <div className="flex-1 overflow-hidden p-2">
                  <WhiteboardComposite teacher={teacher} teacherScreenDevice={screenDevice} preferLaptopScreen={screenSourcePref === 'laptop'} className="h-full w-full rounded-xl" />
                </div>
              ) : hasTeacherCamera && teacher ? (
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
              {hasScreenShare && hasTeacherCamera && teacher && (
                <div className="absolute bottom-4 left-4 z-30 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/10" style={{ width: 200, height: 140 }}>
                  <VideoTile participant={teacher} size="small" showName showMicIndicator className="w-full! h-full!" />
                </div>
              )}
              <div className="absolute top-4 right-4 z-20 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white/80 ring-1 ring-white/10">
                Student perspective — {students.length} student{students.length !== 1 ? 's' : ''} in session
              </div>
            </div>
          )}

          {/* Audio tracks */}
          {audioEnabled && teacher && teacher.getTrackPublication(Track.Source.Microphone)?.track && (
            <AudioTrack trackRef={{ participant: teacher, publication: teacher.getTrackPublication(Track.Source.Microphone)!, source: Track.Source.Microphone } as TrackReference} />
          )}
          {audioEnabled && students.map((s) => {
            const mic = s.getTrackPublication(Track.Source.Microphone);
            if (!mic || mic.isMuted || !mic.track) return null;
            return <AudioTrack key={`audio-${s.identity}`} trackRef={{ participant: s, publication: mic, source: Track.Source.Microphone } as TrackReference} />;
          })}
        </div>

        {/* SIDEBAR — hidden for parents */}
        {sidebarOpen && !isParent && (
          <div className="w-[340px] shrink-0 flex flex-col border-l border-[#3c4043] bg-[#202124]">
            <div className="flex border-b border-[#3c4043] shrink-0">
              {(['monitoring', 'chat', 'participants', 'attendance', 'requests'] as SidebarTab[]).map((tab) => (
                <button key={tab} onClick={() => setSidebarTab(tab)} className={cn('flex-1 py-2.5 text-[10px] font-medium transition-colors', sidebarTab === tab ? 'bg-[#3c4043] text-[#e8eaed]' : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]')}>
                  {tab === 'monitoring' ? 'AI Monitor' : tab === 'chat' ? 'Chat' : tab === 'participants' ? 'People' : tab === 'attendance' ? 'Attend.' : `Requests${(handCount + mediaRequests.length) > 0 ? ` (${handCount + mediaRequests.length})` : ''}`}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'chat' ? (
                <ChatPanel roomId={roomId} participantName={observerName} participantRole={observerRole || 'ghost'} />
              ) : sidebarTab === 'participants' ? (
                <ParticipantList role="ghost" roomId={roomId} />
              ) : sidebarTab === 'attendance' ? (
                <AttendancePanel roomId={roomId} />
              ) : sidebarTab === 'requests' ? (
                <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                  <div className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Session Requests
                  </div>
                  {sortedHands.length > 0 && (
                    <div className="rounded-lg border border-amber-600/30 bg-amber-950/20 p-2.5 space-y-1.5">
                      <div className="text-[10px] text-amber-400 uppercase tracking-wide font-semibold flex items-center gap-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                        Hands Raised ({handCount})
                      </div>
                      {sortedHands.map(([id, h]) => (
                        <div key={id} className="flex items-center justify-between text-xs text-[#e8eaed]">
                          <span className="truncate">{h.name}</span>
                          <span className="text-[10px] text-[#9aa0a6]">{fmtElapsed(Math.floor((now - h.time) / 1000))} ago</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {mediaRequests.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide font-semibold">Media Requests</div>
                      {mediaRequests.slice().reverse().map((req) => (
                        <div key={req.id} className="rounded-lg border border-[#3c4043] bg-[#292a2d] p-2 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[#e8eaed] font-medium">{req.student_name}</span>
                            <span className="text-[9px] text-[#9aa0a6]">{fmtElapsed(Math.floor((now - req.time) / 1000))} ago</span>
                          </div>
                          <p className="text-[10px] text-[#9aa0a6] mt-0.5">Requested {req.type} {req.desired ? 'on' : 'off'}</p>
                        </div>
                      ))}
                    </div>
                  ) : sortedHands.length === 0 && (
                    <div className="text-center py-8 text-xs text-[#9aa0a6]">No active requests</div>
                  )}
                </div>
              ) : (
                /* AI Monitoring Panel */
                <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                  <div className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    AI Session Monitor
                  </div>
                  <div className="rounded-lg bg-[#292a2d] p-3">
                    <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide">Session Engagement</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 rounded-full bg-[#3c4043] overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', avgEngagement >= 70 ? 'bg-green-500' : avgEngagement >= 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${avgEngagement}%` }} />
                      </div>
                      <span className={cn('text-sm font-bold', avgEngagement >= 70 ? 'text-green-400' : avgEngagement >= 40 ? 'text-amber-400' : 'text-red-400')}>{avgEngagement}%</span>
                    </div>
                  </div>
                  {teacherAttention && (() => {
                    const att = teacherAttention;
                    const isCritical = ['eyes_closed', 'tab_switched', 'not_in_frame'].includes(att.monitorState);
                    const stateLabel: Record<string, string> = { eyes_closed: 'Not looking', tab_switched: 'Tab switched', not_in_frame: 'Left screen', multiple_faces: 'Multiple faces', head_turned: 'Head turned', looking_away: 'Looking away', yawning: 'Yawning', inactive: 'Inactive', distracted: 'Distracted', attentive: 'Engaged', writing_notes: '\u{1F4DD} Writing', thinking: '\u{1F4A1} Thinking', reading_material: '\u{1F4D6} Reading', brief_absence: 'Briefly away' };
                    return (
                      <div className={cn('rounded-lg border-2 p-2.5', isCritical ? 'border-red-500 bg-red-950/50' : att.attentionScore < 50 ? 'border-amber-500 bg-amber-950/40' : 'border-indigo-500/70 bg-indigo-950/30')}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-200">{`\u{1F393} ${att.name.replace(' (Teacher)', '')}`}</span>
                          <span className={cn('text-xs font-bold', att.attentionScore >= 70 ? 'text-green-400' : att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400')}>{att.attentionScore}%</span>
                        </div>
                        <div className="text-[10px] text-indigo-100/80 mt-1">{stateLabel[att.monitorState] ?? 'Engaged'}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {!att.faceDetected && <span className="rounded bg-red-900/50 px-1 py-0.5 text-[9px] text-red-200 font-semibold">Left Screen</span>}
                          {!att.tabVisible && <span className="rounded bg-purple-900/50 px-1 py-0.5 text-[9px] text-purple-200 font-semibold">Tab Away</span>}
                          {att.eyesClosed && <span className="rounded bg-red-900/40 px-1 py-0.5 text-[9px] text-red-300">Eyes Closed</span>}
                          {att.isInactive && <span className="rounded bg-gray-700/50 px-1 py-0.5 text-[9px] text-gray-300">Inactive</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {Array.from(studentAttention.values()).sort((a, b) => a.attentionScore - b.attentionScore).map((att) => {
                    const stateConfig: Record<string, { label: string; color: string }> = {
                      eyes_closed: { label: 'Sleeping', color: 'text-red-400' }, tab_switched: { label: 'Tab Switched', color: 'text-purple-400' },
                      not_in_frame: { label: 'Not in Frame', color: 'text-red-400' }, multiple_faces: { label: 'Multiple Faces', color: 'text-amber-400' },
                      head_turned: { label: 'Head Turned', color: 'text-amber-400' }, looking_away: { label: 'Looking Away', color: 'text-amber-400' },
                      yawning: { label: 'Yawning', color: 'text-amber-400' }, inactive: { label: 'Inactive', color: 'text-amber-400' },
                      distracted: { label: 'Distracted', color: 'text-amber-400' }, low_engagement: { label: 'Low Engagement', color: 'text-amber-400' },
                      attentive: { label: 'Attentive', color: 'text-green-400' }, writing_notes: { label: '\u{1F4DD} Writing', color: 'text-blue-400' },
                      brief_absence: { label: 'Briefly Away', color: 'text-sky-400' }, low_visibility: { label: 'Low Visibility', color: 'text-slate-400' },
                      thinking: { label: '\u{1F4A1} Thinking', color: 'text-cyan-400' }, reading_material: { label: '\u{1F4D6} Reading', color: 'text-blue-400' },
                    };
                    const sc = stateConfig[att.monitorState] ?? stateConfig.attentive;
                    const isCritical = ['eyes_closed', 'tab_switched', 'not_in_frame'].includes(att.monitorState);
                    return (
                      <div key={att.email} className={cn('rounded-lg border p-2.5', isCritical ? 'border-red-600/50 bg-red-950/30' : att.attentionScore < 50 ? 'border-amber-600/50 bg-amber-950/30' : 'border-[#3c4043] bg-[#292a2d]')}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[#e8eaed] truncate">{att.name}</span>
                          <span className={cn('text-xs font-bold', att.attentionScore >= 70 ? 'text-green-400' : att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400')}>{att.attentionScore}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]"><span className={sc.color}>{sc.label}</span></div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {att.eyesClosed && <span className="rounded bg-red-900/40 px-1 py-0.5 text-[9px] text-red-300">Eyes Closed</span>}
                          {att.gazeAway && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Gaze Away</span>}
                          {(Math.abs(att.headYaw) > 20 || Math.abs(att.headPitch) > 15) && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Head {Math.abs(att.headYaw).toFixed(0)}\u00b0</span>}
                          {att.yawning && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">Yawning</span>}
                          {!att.tabVisible && <span className="rounded bg-purple-900/40 px-1 py-0.5 text-[9px] text-purple-300">Tab Away</span>}
                          {att.isInactive && <span className="rounded bg-gray-700/50 px-1 py-0.5 text-[9px] text-gray-300">Inactive</span>}
                          {att.faceCount > 1 && <span className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-300">{att.faceCount} Faces</span>}
                          {att.isMobile && <span className="rounded bg-blue-900/40 px-1 py-0.5 text-[9px] text-blue-300">Mobile</span>}
                        </div>
                      </div>
                    );
                  })}
                  {studentAttention.size === 0 && <div className="text-center py-8 text-xs text-[#9aa0a6]">Waiting for student attention data...</div>}
                  {monitoringAlerts.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide font-semibold">Server Alerts</div>
                      {monitoringAlerts.map((alert) => (
                        <div key={alert.id} className={cn('rounded-lg border p-2 text-[11px]', alert.severity === 'critical' ? 'border-red-600/50 bg-red-950/30 text-red-300' : 'border-amber-600/50 bg-amber-950/30 text-amber-300')}>
                          <div className="font-semibold">{alert.title}</div>
                          <div className="text-[10px] mt-0.5 opacity-80">{alert.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-[#3c4043]">
                    <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      Private Notes
                    </div>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 5000))} placeholder="Type observation notes\u2026" className="h-24 w-full rounded-lg bg-[#292a2d] p-2 text-sm text-[#e8eaed] placeholder:text-[#5f6368] outline-none focus:ring-1 focus:ring-[#8ab4f8] resize-none" maxLength={5000} />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#5f6368]">{notes.length}/5000</span>
                      <button onClick={downloadNotes} disabled={!notes.trim()} className="text-xs text-[#8ab4f8] hover:text-blue-300 disabled:opacity-30 flex items-center gap-1">
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

      {/* Student Detail Panel — hidden for parents */}
      {!isParent && selectedStudentId && (() => {
        const s = students.find((st) => st.identity === selectedStudentId);
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

      {/* AI Notification Center — hidden for parents */}
      {!isParent && <AINotificationCenter
        alerts={alerts}
        onClear={clearAlerts}
        position="bottom-right"
      />}
    </div>
  );
}
