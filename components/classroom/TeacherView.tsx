'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useDataChannel,
  useRoomContext,
} from '@livekit/components-react';
import { Track, VideoQuality, ConnectionQuality, RoomEvent, type Participant, type RemoteParticipant, type RemoteTrackPublication, type LocalVideoTrack } from 'livekit-client';
import { BackgroundProcessor, supportsBackgroundProcessors, type BackgroundProcessorWrapper } from '@livekit/track-processors';
import HeaderBar from './HeaderBar';
import ControlBar from './ControlBar';
import VideoTile from './VideoTile';
import TimeWarningDialog from './TimeWarningDialog';
import DemoExamDialog from './DemoExamDialog';
import SessionExamDialog from './SessionExamDialog';
import VideoQualitySelector, { type VideoQualityOption, QUALITY_MAP } from './VideoQualitySelector';
import ChatPanel from './ChatPanel';
import ParticipantList from './ParticipantList';
import AttendancePanel from './AttendancePanel';
import HomeworkPanel from './HomeworkPanel';
import ExamResultsPanel from './ExamResultsPanel';
import WhiteboardComposite from './WhiteboardComposite';
import VirtualBackgroundPanel, { type VBGMode } from './VirtualBackgroundPanel';
import StudentDetailPanel from './StudentDetailPanel';
import SessionMaterialsPanel from './SessionMaterialsPanel';
import { useAINotifications } from '@/hooks/useAINotifications';
import { cn } from '@/lib/utils';
import { useAttentionMonitor, ATTENTION_TOPIC, type AttentionMessage, type AttentionData, type MonitorConfig } from '@/hooks/useAttentionMonitor';
import { sfxHandRaise, sfxHandLower, sfxParticipantJoin, sfxParticipantLeave, sfxMediaRequest, sfxMediaControl, sfxTabSwitch, hapticTap } from '@/lib/sounds';

/**
 * TeacherView — Google Meet-style teacher classroom.
 *
 * Professional layout:
 *   ┌──────────────────────────────────────────┬──────────┐
 *   │  Header  (room • LIVE • timer • count)   │          │
 *   ├──────────────────────────────────────────┤ Sidebar  │
 *   │                                          │ Chat /   │
 *   │  MAIN CONTENT                            │ Users    │
 *   │  (student grid OR whiteboard + strip)    │ (320px)  │
 *   │                                          │          │
 *   │  [Self PIP]                              │          │
 *   │                                          │          │
 *   ├──────────────────────────────────────────┴──────────┤
 *   │  🎤  📷  🖥️  📋  💬           [End Class]          │
 *   └─────────────────────────────────────────────────────┘
 *
 * Features:
 *   - Responsive student grid (auto-cols, object-fit cover, no rotation)
 *   - Whiteboard mode: fullscreen whiteboard + student thumbnail strip
 *   - Self-cam floating PIP (top-left, mirrored)
 *   - Collapsible sidebar with chat/participant tabs
 *   - Professional Go Live setup banner
 *   - Tablet connection status indicator
 *   - Google Meet dark theme (#202124 base)
 */

export interface TeacherViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
  scheduledStart: string;
  durationMinutes: number;
  roomStatus: string;
  topic?: string;
  onEndClass: () => void;
  onTimeExpired?: () => void;
  onDurationUpdate?: (newDurationMinutes: number) => void;
}

export default function TeacherView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  roomStatus,
  topic,
  onEndClass,
  onTimeExpired,
  onDurationUpdate,
}: TeacherViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'homework' | 'participants' | 'attendance' | 'monitoring' | 'exam_results' | 'approvals'>('approvals');
  const [showMaterialsOverlay, setShowMaterialsOverlay] = useState(false);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onSidebarDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return;
      const delta = sidebarDragRef.current.startX - ev.clientX;
      setSidebarWidth(Math.min(520, Math.max(240, sidebarDragRef.current.startW + delta)));
    };
    const onUp = () => { sidebarDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [isLive, setIsLive] = useState(roomStatus === 'live');
  const [goingLive, setGoingLive] = useState(false);
  const [goLiveError, setGoLiveError] = useState('');
  const [goLiveAt, setGoLiveAt] = useState<string | null>(null); // actual go-live timestamp
  const [goLiveApproval, setGoLiveApproval] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const goLivePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasCoordinator, setHasCoordinator] = useState(false);
  const [allowGoLiveBeforeSchedule, setAllowGoLiveBeforeSchedule] = useState(false);
  const [allowRecording, setAllowRecording] = useState(true);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [showAnnouncementBar, setShowAnnouncementBar] = useState(false);

  // ── Student detail zoom panel ──
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // ── Self-cam PIP hide/show ──
  const [selfieHidden, setSelfieHidden] = useState(false);
  const [studentSharePreviewHidden, setStudentSharePreviewHidden] = useState(false);

  // ── Recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [showRecordingPrompt, setShowRecordingPrompt] = useState(false);
  const recordingPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once the prompt has been shown (and either skipped or acted upon) we never show it again
  // for this session — prevents the prompt from re-arming when polling toggles `isRecording`.
  const recordingPromptShownRef = useRef<boolean>(false);

  // ── Check server for room status on mount (handles page refresh after go-live) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data?.status === 'live') {
          setIsLive(true);
          sessionStorage.setItem('room_status', 'live');
          if (data.data.go_live_at) {
            setGoLiveAt(data.data.go_live_at);
          }
        } else if (data.success && data.data?.status !== 'live') {
          setIsLive(false);
          sessionStorage.setItem('room_status', data.data.status || 'scheduled');
        }
        // Check recording status
        if (data.success && data.data?.recording_status === 'recording') {
          setIsRecording(true);
        }
      } catch {
        // Non-critical — fall back to sessionStorage value
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // ── AI toast notifications ──
  const { alerts, addAlert, clearAlerts } = useAINotifications({ rateLimitMs: 5000 });
  const lastAlertedRef = useRef<Map<string, number>>(new Map()); // throttle: email → last alert time

  // ── 5-minute warning dialog ──
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const timeWarningShown = useRef(false);

  // ── Demo exam dialog (only for demo rooms) ──
  const isDemo = roomId.startsWith('demo_');
  const [showDemoExam, setShowDemoExam] = useState(false);
  const demoExamShown = useRef(false);
  const [teacherNow, setTeacherNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setTeacherNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const teacherEndTime = useMemo(() => {
    // Always use scheduled start so late-joining teachers see remaining time, not full duration
    if (!scheduledStart || durationMinutes === 0) return null; // 0 = unlimited
    const s = new Date(scheduledStart).getTime();
    return isNaN(s) ? null : s + durationMinutes * 60_000;
  }, [scheduledStart, durationMinutes]);
  const teacherRemaining = teacherEndTime ? Math.max(0, Math.floor((teacherEndTime - teacherNow) / 1000)) : null;
  useEffect(() => {
    if (teacherRemaining !== null && teacherRemaining <= 5 * 60 && teacherRemaining > 0 && !timeWarningShown.current) {
      timeWarningShown.current = true;
      // For demo rooms, show demo exam dialog
      if (isDemo && !demoExamShown.current) {
        demoExamShown.current = true;
        setShowDemoExam(true);
      }
      // Normal sessions: no popup (teacher manages via exam button)
    }
  }, [teacherRemaining]);

  // ── Lobby student count (polled before Go Live) ──
  const [lobbyCount, setLobbyCount] = useState(0);
  useEffect(() => {
    if (isLive || isDemo) return;            // stop once live (or demo)
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/v1/room/${roomId}/lobby`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled && d.success) setLobbyCount(d.data.count);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 5_000);     // match student poll cadence
    return () => { cancelled = true; clearInterval(iv); };
  }, [roomId, isLive, isDemo]);

  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  // ── Force re-render when any participant's connection quality changes ──
  // Throttled to 2s — at 100+ participants quality events fire frequently
  // and would otherwise re-render the entire grid on every event.
  const [, setConnQualityTick] = useState(0);
  useEffect(() => {
    let pending = false;
    const handler = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        setConnQualityTick((t) => t + 1);
      }, 2000);
    };
    room.on(RoomEvent.ConnectionQualityChanged, handler);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handler); };
  }, [room]);

  // ── Whisper audio renderer for BC / Academic Operator ──
  // Teacher's UI normally only renders audio for student tiles. BC and AO
  // are hidden observers, so their published mic tracks never get attached
  // to a player. This effect attaches their audio tracks to hidden <audio>
  // elements so the teacher can hear private push-to-talk / announcements.
  useEffect(() => {
    const container = document.createElement('div');
    container.style.display = 'none';
    container.setAttribute('data-whisper-audio', '');
    document.body.appendChild(container);
    const elements = new Map<string, HTMLMediaElement[]>();

    // BC/AO identities are ghost-formatted: ghost_{role}_{name}_{ts}
    // Also match the stable email-based format in case it changes.
    const isWhisperer = (identity: string) =>
      identity.startsWith('batch_coordinator') ||
      identity.startsWith('ghost_batch_coordinator') ||
      identity.startsWith('academic_operator') ||
      identity.startsWith('ghost_academic_operator') ||
      identity.startsWith('ghost_academic_') ||
      identity.startsWith('academic_');

    const attachExisting = () => {
      room.remoteParticipants.forEach((p) => {
        if (!isWhisperer(p.identity)) return;
        p.audioTrackPublications.forEach((pub) => {
          if (pub.track && !elements.has(pub.trackSid)) {
            const els = pub.track.attach();
            const arr = Array.isArray(els) ? els : [els];
            arr.forEach((el) => container.appendChild(el));
            elements.set(pub.trackSid, arr);
          }
        });
      });
    };

    const onSubscribed = (
      track: { kind: string; attach: () => HTMLMediaElement | HTMLMediaElement[] },
      publication: { trackSid: string },
      participant: { identity: string },
    ) => {
      if (track.kind !== 'audio') return;
      if (!isWhisperer(participant.identity)) return;
      if (elements.has(publication.trackSid)) return;
      const els = track.attach();
      const arr = Array.isArray(els) ? els : [els];
      arr.forEach((el) => container.appendChild(el));
      elements.set(publication.trackSid, arr);
    };

    const onUnsubscribed = (
      track: { detach: () => HTMLMediaElement[] | void },
      publication: { trackSid: string },
    ) => {
      try { track.detach(); } catch {}
      const arr = elements.get(publication.trackSid);
      if (arr) { arr.forEach((el) => el.remove()); elements.delete(publication.trackSid); }
    };

    attachExisting();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackSubscribed, onSubscribed as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed as any);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackSubscribed, onSubscribed as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed as any);
      elements.forEach((arr) => arr.forEach((el) => el.remove()));
      elements.clear();
      container.remove();
    };
  }, [room]);

  // ── Detect rejoin via participant metadata (reliable — metadata is always present on join) ──
  useEffect(() => {
    const handler = (participant: Participant) => {
      try {
        const meta = JSON.parse(participant.metadata || '{}');
        console.log('[TeacherView] ParticipantConnected:', participant.identity, 'meta:', meta);
        if (!meta.is_rejoin) return;
        const studentId = participant.identity;
        const studentName = participant.name || participant.identity;
        console.log('[TeacherView] Rejoin detected for:', studentId, studentName);
        sfxMediaRequest();
        setRejoinRequests((prev) => [
          ...prev.filter((r) => r.student_id !== studentId),
          { student_id: studentId, student_name: studentName, time: Date.now() },
        ]);
        setSidebarOpen(true);
        setSidebarTab('approvals');
      } catch {}
    };
    room.on(RoomEvent.ParticipantConnected, handler);
    return () => { room.off(RoomEvent.ParticipantConnected, handler); };
  }, [room]);

  // ── Session exam state (for non-demo academic sessions) ──
  interface ExamTopic { id: string; title: string; subject: string; grade: string; question_count: number; generated_questions?: number; status: string; category?: string; chapter_name?: string; topic_name?: string; }
  interface TeachingMaterial { id: string; title: string; subject: string; file_url: string; file_name: string; material_type: string; }
  const [sessionExamTopics, setSessionExamTopics] = useState<ExamTopic[]>([]);
  const [teachingMaterials, setTeachingMaterials] = useState<TeachingMaterial[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [showSessionExam, setShowSessionExam] = useState(false);
  const [sessionExamSent, setSessionExamSent] = useState(false);
  const [lastSentTopicId, setLastSentTopicId] = useState('');
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
  const [sessionExamTelemetryByTopic, setSessionExamTelemetryByTopic] = useState<
    Record<string, Record<string, SessionExamStudentTelemetry>>
  >({});
  const [sessionExamResults, setSessionExamResults] = useState<Array<{ student_name: string; score: number; total_marks: number; percentage: number; grade_letter: string }>>([]);
  const [roomSubject, setRoomSubject] = useState('');
  const [roomGrade, setRoomGrade] = useState('');
  const [roomSessionId, setRoomSessionId] = useState('');
  const [resolvedRoomId, setResolvedRoomId] = useState('');

  // ── Exam flow state ──
  type ExamFlowStep = 'closed' | 'open' | 'generating' | 'preview' | 'ready';
  const [examFlow, setExamFlow] = useState<ExamFlowStep>('closed');
  const [previewQuestions, setPreviewQuestions] = useState<Array<{ id: string; question_text: string; options: string[]; correct_answer: number; marks: number; difficulty: string; image_url?: string | null }>>([]);
  const [regeneratingQId, setRegeneratingQId] = useState<string | null>(null);
  const [examType, setExamType] = useState<'daily' | 'weekly' | 'model' | null>(null);
  const [examSource, setExamSource] = useState<'question_paper' | 'topic' | 'material' | 'upload' | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [pageNumbers, setPageNumbers] = useState('');
  const [genCount, setGenCount] = useState(10);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState('');
  const [genElapsed, setGenElapsed] = useState(0);
  const genStartTimeRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  // Fetch room metadata (subject, grade) + exam topics on mount
  useEffect(() => {
    if (isDemo) return;
    (async () => {
      try {
        // Get room subject & grade
        const roomRes = await fetch(`/api/v1/room/${roomId}`);
        const roomJson = await roomRes.json();
        if (roomJson.success && roomJson.data) {
          const r = roomJson.data;
          setRoomSubject(r.subject || '');
          setRoomGrade(r.grade || '');
          setRoomSessionId(r.batch_session_id || '');
          setResolvedRoomId(r.room_id || '');
        }
      } catch { /* non-critical */ }
    })();
  }, [roomId, isDemo]);

  // Fetch available exam topics when subject known (grade optional — workshops/training may not have one)
  useEffect(() => {
    if (!roomSubject || isDemo) return;
    (async () => {
      try {
        const params = new URLSearchParams({ subject: roomSubject, status: 'ready' });
        if (roomGrade) params.set('grade', roomGrade);
        const res = await fetch(`/api/v1/session-exam-topics?${params}`);
        const json = await res.json();
        if (json.success) setSessionExamTopics(json.data || []);
      } catch { /* non-critical */ }
    })();
  }, [roomSubject, roomGrade, isDemo]);

  // Fetch teaching materials for teacher's batches (+ OC materials if in open classroom)
  useEffect(() => {
    if (isDemo) return;
    (async () => {
      try {
        const isOC = roomId.startsWith('oc_');
        const url = isOC ? `/api/v1/teaching-materials?room_id=${encodeURIComponent(roomId)}` : '/api/v1/teaching-materials';
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) setTeachingMaterials(json.data?.materials || []);
      } catch { /* non-critical */ }
    })();
  }, [isDemo, roomId]);

  // ── Virtual Background processor ──
  const [vbgMode, setVbgMode] = useState<VBGMode>('disabled');
  const [vbgPanelOpen, setVbgPanelOpen] = useState(false);
  const [vbgLoading, setVbgLoading] = useState(false);
  const [cutoutActive, setCutoutActive] = useState(false);
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null);
  const vbgSupported = typeof window !== 'undefined' && supportsBackgroundProcessors();

  // Initialize processor lazily (once) and attach to camera track
  const ensureProcessor = useCallback(async (): Promise<BackgroundProcessorWrapper | null> => {
    if (processorRef.current) return processorRef.current;
    if (!vbgSupported) return null;
    try {
      const p = BackgroundProcessor({
        mode: 'disabled',
        assetPaths: {
          tasksVisionFileSet: '/mediapipe/',
          modelAssetPath: '/mediapipe/models/selfie_segmenter.tflite',
        },
      });
      processorRef.current = p;
      return p;
    } catch (err) {
      console.error('[VBG] Failed to create BackgroundProcessor:', err);
      return null;
    }
  }, [vbgSupported]);

  // Attach processor to camera track when camera is enabled
  useEffect(() => {
    if (!localParticipant.isCameraEnabled || !processorRef.current) return;
    const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = camPub?.track as LocalVideoTrack | undefined;
    if (track && !track.getProcessor()) {
      track.setProcessor(processorRef.current).catch((err) => {
        console.error('[VBG] Failed to attach processor to camera track:', err);
      });
    }
  }, [localParticipant, localParticipant.isCameraEnabled]);

  const handleVBGSelect = useCallback(async (mode: VBGMode, options?: { blurRadius?: number; imagePath?: string }) => {
    setVbgLoading(true);
    try {
      const p = await ensureProcessor();
      if (!p) return;

      // Attach to current camera track if not already attached
      const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = camPub?.track as LocalVideoTrack | undefined;
      if (track && !track.getProcessor()) {
        await track.setProcessor(p);
      }

      if (mode === 'disabled') {
        await p.switchTo({ mode: 'disabled' });
      } else if (mode.startsWith('blur-')) {
        await p.switchTo({ mode: 'background-blur', blurRadius: options?.blurRadius ?? 10 });
      } else if (mode === 'cutout' || options?.imagePath) {
        const imgPath = options?.imagePath ?? '/backgrounds/cutout-black.svg';
        await p.switchTo({ mode: 'virtual-background', imagePath: imgPath });
      }
      setVbgMode(mode);
    } catch (err) {
      console.error('[VBG] switchTo failed:', err);
    } finally {
      setVbgLoading(false);
    }
  }, [ensureProcessor, localParticipant]);

  const handleToggleCutout = useCallback(async () => {
    const next = !cutoutActive;
    setCutoutActive(next);
    if (next) {
      await handleVBGSelect('cutout', { imagePath: '/backgrounds/cutout-black.svg' });
    } else {
      await handleVBGSelect('disabled');
    }
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'teacher_cutout', enabled: next })),
        { reliable: true, topic: 'teacher_cutout' },
      );
    } catch (err) {
      console.error('[Cutout] Failed to broadcast cutout state:', err);
    }
  }, [cutoutActive, handleVBGSelect, localParticipant]);

  // ── BC Whisper alert ──────────────────────────────────────────────
  const [bcWhisperActive, setBcWhisperActive] = useState(false);
  const [bcWhisperName, setBcWhisperName] = useState('Batch Coordinator');
  const [bcReplyActive, setBcReplyActive] = useState(false);

  // Detect BC or AO presence for the standalone reply button
  const bcIdentity = useMemo(() => {
    return remoteParticipants.find(
      (p) =>
        p.identity.startsWith('ghost_batch_coordinator') ||
        p.identity.startsWith('batch_coordinator') ||
        p.identity.startsWith('ghost_academic_operator') ||
        p.identity.startsWith('academic_operator')
    )?.identity ?? null;
  }, [remoteParticipants]);

  // Label for the hold-to-talk button ('BC', 'AO', or 'BC/AO')
  const bcLabel = useMemo(() => {
    const hasBc = remoteParticipants.some(
      (p) => p.identity.startsWith('ghost_batch_coordinator') || p.identity.startsWith('batch_coordinator')
    );
    const hasAo = remoteParticipants.some(
      (p) => p.identity.startsWith('ghost_academic_operator') || p.identity.startsWith('academic_operator')
    );
    if (hasBc && hasAo) return 'BC/AO';
    if (hasAo) return 'AO';
    return 'BC';
  }, [remoteParticipants]);

  const onWhisperSignal = useCallback((msg: { payload?: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as { type?: string; name?: string };
      if (data.type === 'whisper_start') {
        setBcWhisperActive(true);
        if (data.name) setBcWhisperName(data.name);
      } else if (data.type === 'whisper_stop') {
        setBcWhisperActive(false);
      }
    } catch {}
  }, []);
  useDataChannel('whisper_signal', onWhisperSignal);

  const startBcReply = useCallback(async () => {
    setBcReplyActive(true);
    try {
      // NOTE: Do NOT call setTrackSubscriptionPermissions here — it drops all student
      // subscriptions (video + audio) causing blank screens and audio cuts in StudentView.
      // The whisper is signalled via data channel only; BC hears the teacher through
      // the normal LiveKit audio track (teacher remains visible/audible to all).
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'teacher_whisper_start', name: participantName })),
        { reliable: true, topic: 'whisper_signal' },
      );
    } catch {}
  }, [localParticipant, participantName]);

  const stopBcReply = useCallback(async () => {
    setBcReplyActive(false);
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'teacher_whisper_stop' })),
        { reliable: true, topic: 'whisper_signal' },
      );
    } catch {}
  }, [localParticipant]);

  // ── Hand-raise tracking ──
  const [raisedHands, setRaisedHands] = useState<Map<string, { name: string; time: number }>>(new Map());
  const processedHandIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandRaise = useCallback((msg: any) => {
    try {
      const payload = msg?.payload;
      if (!payload) return;
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; action: 'raise' | 'lower' };
      // Simple dedup
      const key = `${data.student_id}_${data.action}_${Math.floor(Date.now() / 500)}`;
      if (processedHandIds.current.has(key)) return;
      processedHandIds.current.add(key);
      // Trim old dedup keys
      if (processedHandIds.current.size > 200) {
        const arr = Array.from(processedHandIds.current);
        processedHandIds.current = new Set(arr.slice(-100));
      }

      // Play sound + haptic for hand raise/lower
      if (data.action === 'raise') sfxHandRaise(); else sfxHandLower();

      setRaisedHands((prev) => {
        const next = new Map(prev);
        if (data.action === 'raise') {
          next.set(data.student_id, { name: data.student_name, time: Date.now() });
          // Auto-unmute in teacher UI only if student is muted and teacher hasn't manually unmuted them
          if (mutedStudentsRef.current.has(data.student_id) && !manuallyUnmuted.current.has(data.student_id)) {
            autoUnmuted.current.add(data.student_id);
            setMutedStudents((ms) => {
              const n = new Set(ms);
              n.delete(data.student_id);
              return n;
            });
          }
        } else {
          next.delete(data.student_id);
          // If we previously auto-unmuted this student, re-mute them in teacher UI
          if (autoUnmuted.current.has(data.student_id)) {
            autoUnmuted.current.delete(data.student_id);
            setMutedStudents((ms) => {
              const n = new Set(ms);
              n.add(data.student_id);
              return n;
            });
          }
        }
        return next;
      });
    } catch {}
  }, []);

  const { message: handMsg } = useDataChannel('hand_raise', onHandRaise);

  const [remotePerms, setRemotePerms] = useState<Record<string, { audio: string; video: string }>>({});
  const onPermissionUpdate = useCallback((msg: any) => {
    try {
      const payload = msg?.payload;
      if (!payload) return;
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text) as { action?: string; identity?: string; audio?: string; video?: string };
      if (data.action !== 'permission_update' || !data.identity) return;
      const id = String(data.identity);
      setRemotePerms((prev) => ({ ...(prev || {}), [id]: { audio: data.audio || 'unknown', video: data.video || 'unknown' } }));
    } catch { /* ignore */ }
  }, []);
  useDataChannel('permission_update', onPermissionUpdate);

  // Fallback: also process via message observable
  useEffect(() => {
    if (!handMsg) return;
    onHandRaise(handMsg);
  }, [handMsg, onHandRaise]);

  // Clean up hands for students who left
  useEffect(() => {
    setRaisedHands((prev) => {
      const activeIds = new Set(remoteParticipants.map((p) => p.identity));
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [remoteParticipants]);

  // Dismiss individual hand or all — also notifies the student's device to lower hand
  const dismissHand = useCallback((studentId: string) => {
    hapticTap();
    setRaisedHands((prev) => { const n = new Map(prev); n.delete(studentId); return n; });
    // If this student was auto-unmuted due to hand raise, re-mute them in teacher UI
    if (autoUnmuted.current.has(studentId)) {
      autoUnmuted.current.delete(studentId);
      setMutedStudents((ms) => {
        const n = new Set(ms);
        n.add(studentId);
        return n;
      });
    }
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ target_id: studentId })),
        { topic: 'hand_dismiss', reliable: true, destinationIdentities: [studentId] },
      );
    } catch {}
  }, [localParticipant]);

  const dismissAllHands = useCallback(() => {
    hapticTap();
    setRaisedHands((prev) => {
      prev.forEach((_, id) => {
        try {
          localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({ target_id: id })),
            { topic: 'hand_dismiss', reliable: true, destinationIdentities: [id] },
          );
        } catch {}
      });
      // Re-mute any students that were auto-unmuted
      if (autoUnmuted.current.size) {
        setMutedStudents((ms) => {
          const n = new Set(ms);
          for (const id of autoUnmuted.current) n.add(id);
          return n;
        });
        autoUnmuted.current.clear();
      }
      return new Map();
    });
  }, [localParticipant]);

  const handCount = raisedHands.size;
  const sortedHands = useMemo(() => {
    return Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time);
  }, [raisedHands]);

  // ── Requests bell portal state ──
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
      ) {
        setRequestsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [requestsDropdownOpen]);

  // ── Media request tracking ──
  interface MediaRequest {
    student_id: string;
    student_name: string;
    type: 'mic' | 'camera';
    desired: boolean;
    time: number;
    bcHandled?: 'approved' | 'denied';
  }
  const [mediaRequests, setMediaRequests] = useState<MediaRequest[]>([]);
  const processedRequestIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; type: 'mic' | 'camera'; desired: boolean };
      const key = `${data.student_id}_${data.type}_${Math.floor(Date.now() / 500)}`;
      if (processedRequestIds.current.has(key)) return;
      processedRequestIds.current.add(key);
      if (processedRequestIds.current.size > 200) {
        const arr = Array.from(processedRequestIds.current);
        processedRequestIds.current = new Set(arr.slice(-100));
      }
      sfxMediaRequest();
      setMediaRequests((prev) => [
        ...prev.filter((r) => !(r.student_id === data.student_id && r.type === data.type)),
        { ...data, time: Date.now() },
      ]);
    } catch {}
  }, []);

  const { message: mediaReqMsg } = useDataChannel('media_request', onMediaRequest);
  useEffect(() => { if (mediaReqMsg) onMediaRequest(mediaReqMsg); }, [mediaReqMsg, onMediaRequest]);

  // Dismiss a media notification (info-only, no action on student)
  const dismissRequest = useCallback((req: MediaRequest) => {
    hapticTap();
    setMediaRequests((prev) => prev.filter((r) => !(r.student_id === req.student_id && r.type === req.type)));
  }, []);

  // Send media_control command to a student (approve their request)
  const sendMediaControl = useCallback(async (targetId: string, type: 'mic' | 'camera', enabled: boolean) => {
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: targetId,
          type,
          enabled,
        })),
        { topic: 'media_control', reliable: true },
      );
    } catch {}
    // Remove matching pending request
    setMediaRequests((prev) => prev.filter((r) => !(r.student_id === targetId && r.type === type)));
  }, [localParticipant]);

  // Approve a media request — sends control command to toggle student device
  const approveRequest = useCallback((req: MediaRequest) => {
    sendMediaControl(req.student_id, req.type, req.desired);
    // Notify BC that teacher handled this request
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          action_type: 'media_control', student_id: req.student_id,
          student_name: req.student_name, action: 'approved',
          type: req.type, desired: req.desired,
        })),
        { topic: 'teacher_request_action', reliable: true },
      );
    } catch {}
  }, [sendMediaControl, localParticipant]);

  // Deny a media request — just dismiss, no command sent
  const denyRequest = useCallback((req: MediaRequest) => {
    hapticTap();
    setMediaRequests((prev) => prev.filter((r) => !(r.student_id === req.student_id && r.type === req.type)));
    // Notify BC
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          action_type: 'media_control', student_id: req.student_id,
          student_name: req.student_name, action: 'denied', type: req.type,
        })),
        { topic: 'teacher_request_action', reliable: true },
      );
    } catch {}
  }, [localParticipant]);

  // Clean up requests for students who left
  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map((p) => p.identity));
    setMediaRequests((prev) => prev.filter((r) => activeIds.has(r.student_id)));
    setLeaveRequests((prev) => prev.filter((r) => activeIds.has(r.student_id)));
  }, [remoteParticipants]);

  // ── Leave request tracking ──
  interface LeaveRequest {
    student_id: string;
    student_name: string;
    time: number;
    bcHandled?: 'approved' | 'denied';
  }
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const processedLeaveIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string };
      const key = `${data.student_id}_${Math.floor(Date.now() / 500)}`;
      if (processedLeaveIds.current.has(key)) return;
      processedLeaveIds.current.add(key);
      if (processedLeaveIds.current.size > 200) {
        const arr = Array.from(processedLeaveIds.current);
        processedLeaveIds.current = new Set(arr.slice(-100));
      }
      sfxMediaRequest();
      setLeaveRequests((prev) => [
        ...prev.filter((r) => r.student_id !== data.student_id),
        { ...data, time: Date.now() },
      ]);
    } catch {}
  }, []);

  const { message: leaveReqMsg } = useDataChannel('leave_request', onLeaveRequest);
  useEffect(() => { if (leaveReqMsg) onLeaveRequest(leaveReqMsg); }, [leaveReqMsg, onLeaveRequest]);

  // Send leave_control command to student
  const sendLeaveControl = useCallback(async (targetId: string, approved: boolean) => {
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: targetId,
          approved,
        })),
        { topic: 'leave_control', reliable: true },
      );
    } catch {}
    setLeaveRequests((prev) => prev.filter((r) => r.student_id !== targetId));
  }, [localParticipant]);

  const approveLeave = useCallback((req: LeaveRequest) => {
    sendLeaveControl(req.student_id, true);
    // Notify BC
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          action_type: 'leave_control', student_id: req.student_id,
          student_name: req.student_name, action: 'approved',
        })),
        { topic: 'teacher_request_action', reliable: true },
      );
    } catch {}
  }, [sendLeaveControl, localParticipant]);

  const denyLeave = useCallback((req: LeaveRequest) => {
    sendLeaveControl(req.student_id, false);
    // Notify BC
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          action_type: 'leave_control', student_id: req.student_id,
          student_name: req.student_name, action: 'denied',
        })),
        { topic: 'teacher_request_action', reliable: true },
      );
    } catch {}
  }, [sendLeaveControl, localParticipant]);

  // ── Rejoin request tracking ──
  // Students who left and are trying to rejoin need teacher approval
  interface RejoinRequest {
    student_id: string;
    student_name: string;
    time: number;
    bcHandled?: 'approved' | 'denied';
  }
  const [rejoinRequests, setRejoinRequests] = useState<RejoinRequest[]>([]);
  const processedRejoinIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onRejoinRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string };
      const key = `${data.student_id}_${Math.floor(Date.now() / 500)}`;
      if (processedRejoinIds.current.has(key)) return;
      processedRejoinIds.current.add(key);
      if (processedRejoinIds.current.size > 200) {
        const arr = Array.from(processedRejoinIds.current);
        processedRejoinIds.current = new Set(arr.slice(-100));
      }
      sfxMediaRequest();
      setRejoinRequests((prev) => [
        ...prev.filter((r) => r.student_id !== data.student_id),
        { ...data, time: Date.now() },
      ]);
    } catch {}
  }, []);

  const { message: rejoinReqMsg } = useDataChannel('rejoin_request', onRejoinRequest);
  useEffect(() => { if (rejoinReqMsg) onRejoinRequest(rejoinReqMsg); }, [rejoinReqMsg, onRejoinRequest]);

  // Send rejoin_control command to student
  const sendRejoinControl = useCallback(async (targetId: string, approved: boolean) => {
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: targetId,
          approved,
        })),
        { topic: 'rejoin_control', reliable: true },
      );
    } catch {}
    setRejoinRequests((prev) => prev.filter((r) => r.student_id !== targetId));
  }, [localParticipant]);

  const approveRejoin = useCallback((req: RejoinRequest) => {
    sendRejoinControl(req.student_id, true);
    // Notify BC
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          action_type: 'rejoin_control', student_id: req.student_id,
          student_name: req.student_name, action: 'approved',
        })),
        { topic: 'teacher_request_action', reliable: true },
      );
    } catch {}
  }, [sendRejoinControl, localParticipant]);

  const denyRejoin = useCallback((req: RejoinRequest) => {
    sendRejoinControl(req.student_id, false);
    // Notify BC
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          action_type: 'rejoin_control', student_id: req.student_id,
          student_name: req.student_name, action: 'denied',
        })),
        { topic: 'teacher_request_action', reliable: true },
      );
    } catch {}
  }, [sendRejoinControl, localParticipant]);

  // ── BC request action listener ──
  // When BC (batch coordinator) approves/denies a request, auto-dismiss it here
  // and show a toast so the teacher knows what happened.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onBcRequestAction = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as {
        action_type: string; student_id: string; student_name?: string;
        action: 'approved' | 'denied' | 'dismissed';
        type?: 'mic' | 'camera'; desired?: boolean;
      };
      const name = data.student_name || 'Student';
      const verb = data.action === 'approved' ? 'approved' : 'denied';

      // Mark request with BC action badge, then auto-dismiss after 2.5s
      if (data.action_type === 'media_control') {
        setMediaRequests(prev => prev.map(r =>
          (r.student_id === data.student_id && r.type === data.type)
            ? { ...r, bcHandled: data.action === 'approved' ? 'approved' : 'denied' }
            : r
        ));
        setTimeout(() => {
          setMediaRequests(prev => prev.filter(r => !(r.student_id === data.student_id && r.type === data.type)));
        }, 2500);
        addAlert(`BC Action: ${name}`, `${verb} ${data.type || 'media'} request`, { severity: 'warning', category: 'request' });
      } else if (data.action_type === 'leave_control') {
        setLeaveRequests(prev => prev.map(r =>
          r.student_id === data.student_id
            ? { ...r, bcHandled: data.action === 'approved' ? 'approved' : 'denied' }
            : r
        ));
        setTimeout(() => {
          setLeaveRequests(prev => prev.filter(r => r.student_id !== data.student_id));
        }, 2500);
        addAlert(`BC Action: ${name}`, `${verb} leave request`, { severity: 'warning', category: 'request' });
      } else if (data.action_type === 'rejoin_control') {
        setRejoinRequests(prev => prev.map(r =>
          r.student_id === data.student_id
            ? { ...r, bcHandled: data.action === 'approved' ? 'approved' : 'denied' }
            : r
        ));
        setTimeout(() => {
          setRejoinRequests(prev => prev.filter(r => r.student_id !== data.student_id));
        }, 2500);
        addAlert(`BC Action: ${name}`, `${verb} rejoin request`, { severity: 'warning', category: 'request' });
      } else if (data.action_type === 'hand_dismiss') {
        setRaisedHands(prev => { const n = new Map(prev); n.delete(data.student_id); return n; });
        // If BC dismissed the hand and we had auto-unmuted the student, re-mute in teacher UI
        if (autoUnmuted.current.has(data.student_id)) {
          autoUnmuted.current.delete(data.student_id);
          setMutedStudents((ms) => {
            const n = new Set(ms);
            n.add(data.student_id);
            return n;
          });
        }
      }
    } catch {}
  }, []);
  const { message: bcActionMsg } = useDataChannel('bc_request_action', onBcRequestAction);
  useEffect(() => { if (bcActionMsg) onBcRequestAction(bcActionMsg); }, [bcActionMsg, onBcRequestAction]);

  // ── Full view request tracking ──
  // Students can request to see teacher's full camera view (with virtual background option)
  interface FullviewRequest {
    student_id: string;
    student_name: string;
    time: number;
  }
  const [fullviewRequest, setFullviewRequest] = useState<FullviewRequest | null>(null);
  const processedFullviewIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onFullviewRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string };
      const key = `${data.student_id}_${Math.floor(Date.now() / 500)}`;
      if (processedFullviewIds.current.has(key)) return;
      processedFullviewIds.current.add(key);
      if (processedFullviewIds.current.size > 200) {
        const arr = Array.from(processedFullviewIds.current);
        processedFullviewIds.current = new Set(arr.slice(-100));
      }
      sfxMediaRequest();
      setFullviewRequest({ ...data, time: Date.now() });
    } catch {}
  }, []);

  const { message: fullviewReqMsg } = useDataChannel('fullview_request', onFullviewRequest);
  useEffect(() => { if (fullviewReqMsg) onFullviewRequest(fullviewReqMsg); }, [fullviewReqMsg, onFullviewRequest]);

  const acceptFullview = useCallback(async () => {
    if (!fullviewRequest) return;
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: fullviewRequest.student_id,
          action: 'accept',
        })),
        { topic: 'fullview_control', reliable: true },
      );
    } catch {}
    setFullviewRequest(null);
  }, [fullviewRequest, localParticipant]);

  const declineFullview = useCallback(async () => {
    if (!fullviewRequest) return;
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: fullviewRequest.student_id,
          action: 'decline',
        })),
        { topic: 'fullview_control', reliable: true },
      );
    } catch {}
    setFullviewRequest(null);
  }, [fullviewRequest, localParticipant]);

  // ── Session extension request tracking ──
  interface ExtensionRequest {
    student_id: string;
    student_name: string;
    request_id: string;
    requested_minutes: number;
    fee_paise: number;
    time: number;
  }
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([]);
  const [extensionActionLoading, setExtensionActionLoading] = useState<string | null>(null);
  const processedExtIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onExtensionRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as {
        student_id: string; student_name: string;
        request_id: string; requested_minutes: number; fee_paise: number;
      };
      const key = `${data.request_id}`;
      if (processedExtIds.current.has(key)) return;
      processedExtIds.current.add(key);
      sfxMediaRequest();
      setExtensionRequests(prev => [
        ...prev.filter(r => r.request_id !== data.request_id),
        { ...data, time: Date.now() },
      ]);
    } catch {}
  }, []);

  const { message: extReqMsg } = useDataChannel('extension_request', onExtensionRequest);
  useEffect(() => { if (extReqMsg) onExtensionRequest(extReqMsg); }, [extReqMsg, onExtensionRequest]);

  const handleExtensionAction = useCallback(async (req: ExtensionRequest, action: 'approve' | 'reject') => {
    setExtensionActionLoading(req.request_id);
    try {
      const res = await fetch('/api/v1/session-extension', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.request_id, action }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        addAlert('Extension Error', `Failed: ${json.error || 'Server error'}`, { severity: 'danger', category: 'request' });
        setExtensionRequests(prev => prev.filter(r => r.request_id !== req.request_id));
        setExtensionActionLoading(null);
        return;
      }

      // Send extension_control to student
      if (action === 'approve') {
        const resultStatus = json.data?.status as string;
        if (resultStatus === 'approved') {
          // No coordinator — teacher approval directly applied extension
          await localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({
              target_id: req.student_id,
              approved: true,
              new_duration: json.data?.new_duration,
              requested_minutes: req.requested_minutes,
            })),
            { topic: 'extension_control', reliable: true },
          );
          addAlert(`Extension: ${req.student_name}`, `+${req.requested_minutes}min approved`, { severity: 'warning', category: 'request' });
          if (json.data?.new_duration && onDurationUpdate) {
            onDurationUpdate(json.data.new_duration);
          }
        } else {
          // Forwarded to coordinator
          await localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({
              target_id: req.student_id,
              status: 'forwarded',
              requested_minutes: req.requested_minutes,
            })),
            { topic: 'extension_control', reliable: true },
          );
          addAlert(`Extension: ${req.student_name}`, `+${req.requested_minutes}min forwarded to coordinator`, { severity: 'warning', category: 'request' });
        }
      } else {
        // Teacher rejects
        await localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            target_id: req.student_id,
            approved: false,
          })),
          { topic: 'extension_control', reliable: true },
        );
      }
    } catch {}
    setExtensionRequests(prev => prev.filter(r => r.request_id !== req.request_id));
    setExtensionActionLoading(null);
  }, [localParticipant, onDurationUpdate]);

  // ── Poll for coordinator-approved extensions (update teacher timer) ──
  const notifiedExtensions = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Only poll when there's been at least one extension request forwarded
    if (extensionRequests.length === 0 && notifiedExtensions.current.size === 0) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/session-extension?room_id=${roomId}&status=approved`);
        const json = await res.json();
        const approved = (json.data?.requests || []) as Array<{ id: string; student_name?: string; requested_minutes: number; extended_duration?: number }>;
        for (const ext of approved) {
          if (notifiedExtensions.current.has(ext.id)) continue;
          notifiedExtensions.current.add(ext.id);
          // Notify teacher
          addAlert(`Extension Approved`, `${ext.student_name || 'Student'} +${ext.requested_minutes}min`, { severity: 'warning', category: 'request' });
          // Update ClassroomWrapper timer to match extended room duration
          if (ext.extended_duration && onDurationUpdate) {
            onDurationUpdate(ext.extended_duration);
          }
        }
      } catch {}
    }, 8_000);
    return () => clearInterval(iv);
  }, [roomId, extensionRequests.length, onDurationUpdate]);

  // ── Student join/leave sound ──
  const prevStudentIds = useRef<Set<string>>(new Set());

  // ── Student Attention Monitoring (receives data-channel from students) ──
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
  const [studentAttention, setStudentAttention] = useState<Map<string, StudentAttentionState>>(new Map());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAttentionUpdate = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as {
        studentEmail: string;
        studentName: string;
        attentionScore: number;
        isAttentive: boolean;
        faceDetected: boolean;
        faceCount?: number;
        monitorState?: string;
        eyesClosed?: boolean;
        gazeAway?: boolean;
        headYaw?: number;
        headPitch?: number;
        yawning?: boolean;
        tabVisible?: boolean;
        isInactive?: boolean;
        isMobile?: boolean;
      };
      setStudentAttention((prev) => {
        const next = new Map(prev);
        next.set(data.studentEmail, {
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
        });
        return next;
      });

      // ── AI toast alerts for critical states ──
      const now = Date.now();
      const lastAlert = lastAlertedRef.current.get(data.studentEmail) ?? 0;
      const THROTTLE_MS = 15_000;
      if (now - lastAlert > THROTTLE_MS) {
        const state = data.monitorState?.toLowerCase() ?? '';
        const score = data.attentionScore;
        let toastMsg = '';
        let severity: 'warning' | 'danger' = 'warning';

        if (state === 'eyes_closed') {
          toastMsg = `${data.studentName} appears to be sleeping`;
          severity = 'danger';
        } else if (state === 'in_exam') {
          // Student is taking the session exam — not a violation, skip alert
        } else if (state === 'tab_switched') {
          toastMsg = `${data.studentName} switched to another tab/app`;
          severity = 'danger';
          sfxTabSwitch();
        } else if (state === 'not_in_frame') {
          toastMsg = `${data.studentName} is not in frame`;
          severity = 'danger';
        } else if (state === 'multiple_faces') {
          toastMsg = `Multiple faces detected at ${data.studentName}'s screen`;
          severity = 'warning';
        } else if (state === 'yawning') {
          toastMsg = `${data.studentName} is yawning`;
          severity = 'warning';
        } else if (state === 'head_turned') {
          toastMsg = `${data.studentName} is not looking at screen`;
          severity = 'warning';
        } else if (state === 'inactive') {
          toastMsg = `${data.studentName} appears inactive`;
          severity = 'warning';
        } else if (score < 30) {
          toastMsg = `${data.studentName} has low attention (${Math.round(score)}%)`;
          severity = 'warning';
        }

        if (toastMsg) {
          lastAlertedRef.current.set(data.studentEmail, now);
          addAlert(data.studentName, toastMsg, { severity, category: 'attention' });
        }
      }
    } catch {}
  }, []);

  const { message: attentionMsg } = useDataChannel('attention_update', onAttentionUpdate);
  useEffect(() => { if (attentionMsg) onAttentionUpdate(attentionMsg); }, [attentionMsg, onAttentionUpdate]);

  // Clean up attention data for departed students
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
  }, [remoteParticipants]);

  // Live monitoring alerts from server (polled every 15s)
  const [monitoringAlerts, setMonitoringAlerts] = useState<Array<{ id: string; title: string; message: string; severity: string; alert_type: string; created_at: string }>>([]);
  useEffect(() => {
    if (!isLive) return;
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/v1/monitoring/session/${roomId}`);
        const data = await res.json();
        if (data.success && data.data?.alerts) {
          setMonitoringAlerts(data.data.alerts.slice(0, 5));
        }
      } catch {}
    };
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(iv);
  }, [isLive, roomId]);

  useEffect(() => {
    const currentIds = new Set(remoteParticipants.filter((p) => {
      try { const m = JSON.parse(p.metadata || '{}'); return (m.effective_role || m.portal_role) === 'student'; }
      catch { return p.identity.startsWith('student'); }
    }).map((p) => p.identity));
    if (prevStudentIds.current.size > 0) {
      for (const id of currentIds) {
        if (!prevStudentIds.current.has(id)) {
          sfxParticipantJoin();
          // Check if this is a returning student (was discontinued/on_break)
          const participant = remoteParticipants.find(p => p.identity === id);
          if (participant) {
            try {
              const meta = JSON.parse(participant.metadata || '{}');
              if (meta.is_returning_student) {
                const name = participant.name || id;
                addAlert(name, 'is a returning student (previously discontinued/on break)', { severity: 'warning', category: 'info' });
              }
            } catch { /* ignore parse error */ }
          }
          break;
        }
      }
      for (const id of prevStudentIds.current) {
        if (!currentIds.has(id)) { sfxParticipantLeave(); break; }
      }
    }
    prevStudentIds.current = currentIds;
  }, [remoteParticipants]);

  // ── Teacher screen device (tablet) ──
  const teacherScreenDevice = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        if (m.device) {
          return m.device === 'screen' && m.portal_role === 'teacher';
        }
      } catch { /* JSON parse error — fall through */ }
      // Fallback: identity pattern (handles metadata-not-yet-loaded race)
      return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
    }) ?? null;
  }, [remoteParticipants]);

  // ── Coordinator presence (heartbeat-based — BC pings from Live Monitor) ──
  const [coordinatorOnline, setCoordinatorOnline] = useState(false);
  useEffect(() => {
    if (!hasCoordinator || isDemo) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/coordinator-status`);
        const data = await res.json();
        if (!cancelled && data.success) setCoordinatorOnline(data.data?.coordinator_online ?? false);
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [roomId, hasCoordinator, isDemo]);

  // ── Students (filter out ghost/screen device participants) ──
  const students = useMemo(() => {
    return remoteParticipants.filter((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        if (m.effective_role || m.portal_role) {
          return (m.effective_role || m.portal_role) === 'student';
        }
      } catch { /* JSON parse error — fall through */ }
      // Fallback: identity pattern (handles metadata-not-yet-loaded race)
      return p.identity.startsWith('student');
    });
  }, [remoteParticipants]);

  // ── Demo agent (Academic Counselor) detection ──
  const demoAgent = useMemo(() =>
    remoteParticipants.find((p) => p.identity.startsWith('demo_agent')) ?? null,
  [remoteParticipants]);

  // ── Teacher self attention monitoring ──
  // Broadcasts via data channel (topic ATTENTION_TOPIC) with role='teacher' so
  // AO/BC dashboards can surface alerts when the teacher leaves frame, looks
  // away, etc. Server persistence is disabled (empty roomId) — this is for
  // live alerts only, not exam-style reports.
  const selfVideoPipRef = useRef<HTMLDivElement>(null);
  const [teacherVideoEl, setTeacherVideoEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!localParticipant.isCameraEnabled) { setTeacherVideoEl(null); return; }
    const timer = setTimeout(() => {
      const container = selfVideoPipRef.current;
      if (container) {
        const video = container.querySelector('video');
        if (video) { setTeacherVideoEl(video); return; }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [localParticipant.isCameraEnabled, isLive]);

  const teacherMonitorConfig = useMemo<MonitorConfig>(() => ({
    // Empty roomId skips server persistence; only realtime broadcast is used.
    roomId: '',
    tuning: {
      writing_aware_mode: true,
      mobile_relaxed_thresholds: true,
      exam_strict_mode: false,
      low_visibility_fallback: true,
    },
  }), []);

  // ── Teacher liberal monitoring — 5-minute sustained threshold ──
  // Teachers naturally walk away from the camera, look at boards, etc.
  // We only broadcast a "bad" state after it has been CONTINUOUSLY present
  // for 5 minutes. Until then we emit 'attentive' to AO/BC dashboards.
  // Positive / neutral states (attentive, writing_notes, brief_absence, etc.)
  // are always emitted immediately.
  const TEACHER_BAD_STATE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const TEACHER_ALERT_STATES = new Set<string>([
    'not_in_frame', 'tab_switched', 'looking_away', 'head_turned',
    'eyes_closed', 'low_engagement', 'distracted', 'inactive',
  ]);
  const teacherBadStateStartRef = useRef<number | null>(null);
  const teacherBadStateRef = useRef<string | null>(null);

  useAttentionMonitor(
    teacherVideoEl,
    useCallback((data: AttentionData) => {
      try {
        const isAlert = TEACHER_ALERT_STATES.has(data.monitorState);

        let publishedState = data.monitorState;
        let publishedScore = data.attentionScore;
        let publishedAttentive = data.isAttentive;

        if (isAlert) {
          // Start or continue timing this bad state
          if (teacherBadStateRef.current !== data.monitorState) {
            // State changed — restart timer
            teacherBadStateRef.current = data.monitorState;
            teacherBadStateStartRef.current = Date.now();
          }
          const elapsedMs = Date.now() - (teacherBadStateStartRef.current ?? Date.now());
          if (elapsedMs < TEACHER_BAD_STATE_THRESHOLD_MS) {
            // Not yet 5 minutes — publish as attentive so AO/BC aren't spammed
            publishedState = 'attentive' as AttentionData['monitorState'];
            publishedScore = Math.max(data.attentionScore, 70);
            publishedAttentive = true;
          }
          // else: threshold reached — publish the real alert state
        } else {
          // Good state — reset bad-state timer
          teacherBadStateRef.current = null;
          teacherBadStateStartRef.current = null;
        }

        const msg: AttentionMessage & { role?: string } = {
          type: 'attention_update',
          studentEmail: localParticipant.identity,
          studentName: (localParticipant.name || 'Teacher') + ' (Teacher)',
          attentionScore: publishedScore,
          isAttentive: publishedAttentive,
          faceDetected: data.faceDetected,
          faceCount: data.faceCount,
          monitorState: publishedState,
          eyesClosed: data.eyesClosed,
          gazeAway: data.gazeAway,
          headYaw: data.headYaw,
          headPitch: data.headPitch,
          yawning: data.yawning,
          tabVisible: data.tabVisible,
          isInactive: data.isInactive,
          isMobile: data.isMobile,
          timestamp: Date.now(),
          role: 'teacher',
        };
        localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(msg)),
          { topic: ATTENTION_TOPIC, reliable: false },
        ).catch(() => {});
      } catch {}
    }, [localParticipant]),
    !!teacherVideoEl && isLive,
    teacherMonitorConfig,
  );

  // Track agent camera state reactively — agent hides by disabling camera
  const [hasAgentCam, setHasAgentCam] = useState(false);
  useEffect(() => {
    if (!demoAgent) { setHasAgentCam(false); return; }
    const check = () => {
      const pub = demoAgent.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
      setHasAgentCam(!!pub?.track && !pub.isMuted);
    };
    check();
    demoAgent.on('trackSubscribed', check);
    demoAgent.on('trackUnsubscribed', check);
    demoAgent.on('trackMuted', check);
    demoAgent.on('trackUnmuted', check);
    return () => {
      demoAgent.off('trackSubscribed', check);
      demoAgent.off('trackUnsubscribed', check);
      demoAgent.off('trackMuted', check);
      demoAgent.off('trackUnmuted', check);
    };
  }, [demoAgent]);

  // Only show agent when camera is active (agent uses "Hide from Class" to toggle)
  const visibleAgent = hasAgentCam ? demoAgent : null;

  // ── Remote mute tracking — sends data channel commands to student devices ──
  // Teacher can mute/unmute individual students (affects their actual mic)
  // Students are UNMUTED by default when they join; teacher must explicitly mute.
  const [mutedStudents, setMutedStudents] = useState<Set<string>>(new Set());
  const manuallyUnmuted = useRef<Set<string>>(new Set());
  const autoUnmuted = useRef<Set<string>>(new Set());
  const mutedStudentsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mutedStudentsRef.current = mutedStudents;
  }, [mutedStudents]);

  // Sync mutedStudents — all students are muted by default on join.
  // Teacher can explicitly unmute; those students stay unmuted on re-renders.
  useEffect(() => {
    setMutedStudents((prev) => {
      const next = new Set<string>();
      for (const s of students) {
        // Teacher explicitly unmuted this student — keep unmuted
        if (manuallyUnmuted.current.has(s.identity)) continue;
        // If we auto-unmuted this student due to hand raise, keep them unmuted
        if (autoUnmuted.current.has(s.identity)) continue;
        // Otherwise mute (default: all students start muted)
        next.add(s.identity);
      }
      // Only update if changed
      if (next.size !== prev.size || [...next].some(id => !prev.has(id))) return next;
      return prev;
    });
  }, [students]);

  // Mute/unmute a student — updates local playback AND sends actual mic command to student device.
  const toggleStudentMute = useCallback((studentId: string) => {
    hapticTap();
    const isMuted = mutedStudents.has(studentId);
    // Track manual state so participant-sync and hand-raise auto-unmute respect it
    if (isMuted) {
      manuallyUnmuted.current.add(studentId);    // teacher chose to hear this student
      autoUnmuted.current.delete(studentId);
      // Clear raised hand — teacher unmuted them, their request is answered
      setRaisedHands((prev) => {
        if (!prev.has(studentId)) return prev;
        const next = new Map(prev);
        next.delete(studentId);
        return next;
      });
      // Tell student to lower their hand in their own UI
      try {
        localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ target_id: studentId })),
          { topic: 'hand_dismiss', reliable: true, destinationIdentities: [studentId] },
        );
      } catch {}
      // Turn ON student's actual mic
      try {
        localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ target_id: studentId, type: 'mic', enabled: true })),
          { topic: 'media_control', reliable: true, destinationIdentities: [studentId] },
        );
      } catch {}
    } else {
      manuallyUnmuted.current.delete(studentId); // teacher chose to stop hearing this student
      autoUnmuted.current.delete(studentId);
      // Turn OFF student's actual mic
      try {
        localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ target_id: studentId, type: 'mic', enabled: false })),
          { topic: 'media_control', reliable: true, destinationIdentities: [studentId] },
        );
      } catch {}
    }
    // Update local playback — playAudio={!mutedStudents.has(identity)} on AudioTrack
    setMutedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }, [mutedStudents, localParticipant]);

  // Sync mutedStudents when student mic tracks mute/unmute on their own device
  // so the teacher's Mute/Unmute button reflects actual student mic state.
  useEffect(() => {
    const onTrackMuted = (pub: { source: string }, participant: Participant) => {
      if (pub.source !== Track.Source.Microphone) return;
      if (!participant.identity.startsWith('student')) return;
      setMutedStudents(prev => new Set([...prev, participant.identity]));
    };
    const onTrackUnmuted = (pub: { source: string }, participant: Participant) => {
      if (pub.source !== Track.Source.Microphone) return;
      if (!participant.identity.startsWith('student')) return;
      setMutedStudents(prev => { const next = new Set(prev); next.delete(participant.identity); return next; });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackMuted, onTrackMuted as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted as any);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackMuted, onTrackMuted as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted as any);
    };
  }, [room]);

  const sendAnnouncement = useCallback((priority: 'normal' | 'urgent' = 'normal') => {
    const text = announcementInput.trim();
    if (!text) return;
    localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ text, from: participantName, priority })),
      { topic: 'announcement', reliable: true },
    );
    setAnnouncementInput('');
    setShowAnnouncementBar(false);
  }, [announcementInput, localParticipant, participantName]);

  // ── Recording indicator — poll server for actual recording_status ──
  useEffect(() => {
    if (!isLive) { setIsRecording(false); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setIsRecording(data.data?.recording_status === 'recording');
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isLive, roomId]);

  const handleToggleRecording = useCallback(async () => {
    if (!isLive || recordingLoading || !allowRecording) return;
    setRecordingLoading(true);
    try {
      if (isRecording) {
        const res = await fetch(`/api/v1/room/${roomId}/recording`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) setIsRecording(false);
      } else {
        const res = await fetch(`/api/v1/room/${roomId}/recording`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) setIsRecording(true);
      }
    } catch {
      // Non-blocking; polling loop reconciles state.
    } finally {
      setRecordingLoading(false);
    }
  }, [allowRecording, isLive, isRecording, recordingLoading, roomId]);

  // ── BC-style recording prompt: ask after class has been live for 1 minute ──
  useEffect(() => {
    // Never re-arm once the prompt has already been shown this session
    if (recordingPromptShownRef.current) return;

    if (!isLive || isRecording || !allowRecording) {
      if (recordingPromptTimerRef.current) {
        clearTimeout(recordingPromptTimerRef.current);
        recordingPromptTimerRef.current = null;
      }
      setShowRecordingPrompt(false);
      return;
    }

    if (recordingPromptTimerRef.current) {
      clearTimeout(recordingPromptTimerRef.current);
    }

    recordingPromptTimerRef.current = setTimeout(() => {
      recordingPromptShownRef.current = true;
      setShowRecordingPrompt(true);
      recordingPromptTimerRef.current = null;
    }, 60_000);

    return () => {
      if (recordingPromptTimerRef.current) {
        clearTimeout(recordingPromptTimerRef.current);
        recordingPromptTimerRef.current = null;
      }
    };
  }, [allowRecording, isLive, isRecording]);

  // ── Screen share detection ──
  const isLocalScreenShare = localParticipant.isScreenShareEnabled;
  const isTabletScreenShare = !!teacherScreenDevice?.getTrackPublication(Track.Source.ScreenShare)?.track;
  const hasScreenShare = isLocalScreenShare || isTabletScreenShare;

  // ── Screen source preference (laptop vs tablet) ──
  const [screenSourcePref, setScreenSourcePref] = useState<'tablet' | 'laptop'>('tablet');
  const canSwitchSource = isLocalScreenShare && isTabletScreenShare;

  // Auto-switch to laptop when teacher starts laptop screen share (and tablet is connected)
  useEffect(() => {
    if (isLocalScreenShare && isTabletScreenShare) {
      setScreenSourcePref('laptop');
    } else if (!isLocalScreenShare && isTabletScreenShare) {
      setScreenSourcePref('tablet');
    } else if (isLocalScreenShare && !isTabletScreenShare) {
      setScreenSourcePref('laptop');
    }
  }, [isLocalScreenShare, isTabletScreenShare]);

  // Broadcast screen source preference to all participants
  useEffect(() => {
    if (!hasScreenShare) return;
    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ source: screenSourcePref, timestamp: Date.now() })),
        { topic: 'screen_source', reliable: true },
      );
    } catch (err) {
      console.error('[TeacherView] Failed to broadcast screen_source:', err);
    }
  }, [screenSourcePref, hasScreenShare, localParticipant]);

  // ── Actually transition room to live (shared helper) ──
  const doGoLive = useCallback(async () => {
    const res = await fetch(`/api/v1/room/${roomId}/go-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to go live');
    }
    setIsLive(true);
    sessionStorage.setItem('room_status', 'live');
    if (data.data?.go_live_at) {
      setGoLiveAt(data.data.go_live_at);
    } else {
      setGoLiveAt(new Date().toISOString());
    }
    // Notify students that session is live via data channel
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ action: 'go_live' })),
        { topic: 'session_control', reliable: true },
      );
    } catch (err) {
      console.error('[TeacherView] Failed to broadcast go_live:', err);
    }
    // Auto-enable teacher camera and mic after going live
    try {
      await localParticipant.setCameraEnabled(true);
      await localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      console.error('[TeacherView] Auto-enable media after Go Live failed:', err);
    }
  }, [roomId, localParticipant]);

  // ── Poll for BC approval, then go live ──
  const startApprovalPoll = useCallback((sessionId: string) => {
    if (goLivePollRef.current) return; // already polling
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/batch-sessions/${sessionId}/go-live-request`);
        const data = await res.json();
        if (!data.success) return;
        const status = data.data?.go_live_status;
        if (status === 'approved') {
          clearInterval(iv);
          goLivePollRef.current = null;
          setGoLiveApproval('approved');
          setGoingLive(true);
          try {
            await doGoLive();
          } catch (err) {
            setGoLiveError(err instanceof Error ? err.message : 'Failed to go live');
          } finally {
            setGoingLive(false);
          }
        } else if (status === 'denied') {
          clearInterval(iv);
          goLivePollRef.current = null;
          setGoLiveApproval('denied');
          setGoLiveError('Your Go Live request was denied by the coordinator.');
        }
      } catch { /* ignore poll errors */ }
    }, 5_000);
    goLivePollRef.current = iv;
  }, [doGoLive]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (goLivePollRef.current) {
        clearInterval(goLivePollRef.current);
        goLivePollRef.current = null;
      }
    };
  }, []);

  // Resume polling if a go-live request was pending (e.g. page refresh)
  // Also detect if batch has a coordinator for the status indicator
  useEffect(() => {
    if (!roomSessionId || isLive || isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/batch-sessions/${roomSessionId}/go-live-request`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        if (data.data?.has_coordinator) setHasCoordinator(true);
        if (data.data?.go_live_status === 'pending') {
          setGoLiveApproval('pending');
          startApprovalPoll(roomSessionId);
        }
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [roomSessionId, isLive, isDemo, startApprovalPoll]);

  // ── Teacher controls (Go Live behavior toggles) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctrlRes = await fetch('/api/v1/teacher-controls');
        const ctrlData = await ctrlRes.json();
        if (!cancelled && ctrlData.success) {
          setAllowGoLiveBeforeSchedule(!!ctrlData.data?.allow_go_live_before_schedule);
          setAllowRecording(ctrlData.data?.allow_recording !== false);
        }
      } catch {
        // Keep defaults when controls API is unavailable
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Go Live (routes through BC approval if coordinator exists) ──
  const handleGoLive = useCallback(async () => {
    setGoingLive(true);
    setGoLiveError('');
    try {
      // Check if teacher controls allow skipping coordinator approval
      let skipCoordinator = false;
      try {
        const ctrlRes = await fetch('/api/v1/teacher-controls');
        const ctrlData = await ctrlRes.json();
        if (ctrlData.success && ctrlData.data?.go_live_skip_coordinator) {
          skipCoordinator = true;
        }
      } catch { /* fallback to normal flow */ }

      // Check if batch has a coordinator (using roomSessionId from room metadata)
      if (roomSessionId && !skipCoordinator) {
        const checkRes = await fetch(`/api/v1/batch-sessions/${roomSessionId}/go-live-request`);
        const checkData = await checkRes.json();
        const currentStatus = checkData.data?.go_live_status;
        const hasCoordinator = checkData.data?.has_coordinator;

        if (hasCoordinator) {
          if (currentStatus === 'approved') {
            await doGoLive();
            return;
          }
          if (currentStatus === 'pending') {
            setGoLiveApproval('pending');
            setGoingLive(false);
            startApprovalPoll(roomSessionId);
            return;
          }
          // Request approval
          const reqRes = await fetch(`/api/v1/batch-sessions/${roomSessionId}/go-live-request`, { method: 'POST' });
          const reqData = await reqRes.json();
          if (!reqData.success) {
            if (reqData.error === 'A request is already pending') {
              setGoLiveApproval('pending');
              setGoingLive(false);
              startApprovalPoll(roomSessionId);
              return;
            }
            setGoLiveError(reqData.error || 'Failed to request Go Live');
            return;
          }
          setGoLiveApproval('pending');
          setGoingLive(false);
          startApprovalPoll(roomSessionId);
          return;
        }
      }
      // No coordinator or skip enabled — go live directly
      await doGoLive();
    } catch {
      setGoLiveError('Network error — please try again');
    } finally {
      setGoingLive(false);
    }
  }, [roomSessionId, doGoLive, startApprovalPoll]);

  // ── Manual demo exam trigger ──
  const [examSent, setExamSent] = useState(false);
  const [examInProgress, setExamInProgress] = useState(false);
  const [examResult, setExamResult] = useState<{ score: number; total: number; percentage: number; grade: string } | null>(null);
  const handleStartExam = useCallback(async () => {
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ action: 'start' })),
        { topic: 'start_demo_exam', reliable: true },
      );
    } catch (err) {
      console.error('[TeacherView] Failed to send exam start:', err);
    }
    setExamSent(true);
    setExamInProgress(true);
    // Also show the teacher's exam dialog
    if (!demoExamShown.current) {
      demoExamShown.current = true;
    }
    setShowDemoExam(true);
  }, [localParticipant]);

  // ── Listen for exam completion from student ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onExamComplete = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text);
      if (data.action === 'complete') {
        setExamInProgress(false);
        // Fetch exam results from API (with retry for timing)
        const fetchResult = async (attempt = 0) => {
          try {
            const res = await fetch(`/api/v1/demo/requests?room_id=${roomId}`);
            const json = await res.json();
            const demo = json.data?.[0];
            if (demo?.exam_score != null) {
              setExamResult({
                score: demo.exam_score,
                total: demo.exam_total_marks,
                percentage: demo.exam_percentage,
                grade: demo.exam_grade,
              });
            } else if (attempt < 3) {
              // Result may not be saved yet, retry after 2s
              setTimeout(() => fetchResult(attempt + 1), 2000);
            }
          } catch { /* ignore fetch errors */ }
        };
        fetchResult();
      }
    } catch {}
  }, [roomId]);
  const { message: examCompleteMsg } = useDataChannel('exam_complete', onExamComplete);
  useEffect(() => { if (examCompleteMsg) onExamComplete(examCompleteMsg); }, [examCompleteMsg, onExamComplete]);

  // ── Exam flow: upload topic document ──
  const handleUploadAndGenerate = useCallback(async () => {
    if (!uploadFile || !roomSubject) return;
    if (uploadFile.size > 50 * 1024 * 1024) {
      alert('⚠️ File too large. Maximum allowed size is 50 MB.');
      return;
    }
    const title = uploadTitle.trim() || uploadFile.name.replace(/\.[^.]+$/, '');
    setIsGeneratingExam(true);
    try {
      // 1. Upload the file as a new topic
      const formData = new FormData();
      formData.append('title', title);
      formData.append('subject', roomSubject);
      formData.append('grade', roomGrade || 'General');
      formData.append('category', 'topic');
      formData.append('files', uploadFile);
      const uploadRes = await fetch('/api/v1/session-exam-topics', { method: 'POST', body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) throw new Error(uploadJson.error || 'Upload failed');
      const newTopicId = uploadJson.data.id as string;

      // 2. Trigger generation
      const genBody: Record<string, unknown> = { topic_id: newTopicId, count: genCount };
      if (pageNumbers.trim()) genBody.page_numbers = pageNumbers.trim();
      const genRes = await fetch('/api/v1/session-exam-topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genBody),
      });
      const genJson = await genRes.json();
      if (!genJson.success) throw new Error(genJson.error || 'Generation failed');

      setGeneratingTopicId(newTopicId);
      genStartTimeRef.current = Date.now();
      setGenElapsed(0);
      setExamFlow('generating');
      setUploadFile(null);
      setUploadTitle('');
    } catch (err) {
      console.error('[TeacherView] Upload+generate failed:', err);
      const msg = err instanceof Error ? err.message : 'Upload or generation failed';
      alert(`⚠️ ${msg}`);
    } finally {
      setIsGeneratingExam(false);
    }
  }, [uploadFile, uploadTitle, roomSubject, roomGrade, genCount, pageNumbers]);

  // ── Exam flow: generate from existing topic ──
  const handleGenerateExisting = useCallback(async (topicId: string) => {
    setIsGeneratingExam(true);
    try {
      const genBody: Record<string, unknown> = { topic_id: topicId, count: genCount };
      if (pageNumbers.trim()) genBody.page_numbers = pageNumbers.trim();
      const res = await fetch('/api/v1/session-exam-topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genBody),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Generation failed');
      setGeneratingTopicId(topicId);
      genStartTimeRef.current = Date.now();
      setGenElapsed(0);
      setExamFlow('generating');
    } catch (err) {
      console.error('[TeacherView] Generate failed:', err);
      const msg = err instanceof Error ? err.message : 'Generation failed';
      alert(`⚠️ ${msg}`);
    } finally {
      setIsGeneratingExam(false);
    }
  }, [genCount, pageNumbers]);

  // ── Exam flow: generate from teaching material ──
  const handleGenerateFromMaterial = useCallback(async () => {
    const mat = teachingMaterials.find(m => m.id === selectedMaterialId);
    if (!mat || !roomSubject) return;
    setIsGeneratingExam(true);
    try {
      // Fetch the material file and re-upload as an exam topic
      const fileRes = await fetch(mat.file_url);
      const blob = await fileRes.blob();
      const file = new File([blob], mat.file_name || 'material.pdf', { type: blob.type });

      const formData = new FormData();
      formData.append('title', mat.title);
      formData.append('subject', roomSubject);
      formData.append('grade', roomGrade || 'General');
      formData.append('category', 'topic');
      formData.append('files', file);
      const uploadRes = await fetch('/api/v1/session-exam-topics', { method: 'POST', body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) throw new Error(uploadJson.error || 'Upload failed');
      const newTopicId = uploadJson.data.id as string;

      const genBody: Record<string, unknown> = { topic_id: newTopicId, count: genCount };
      if (pageNumbers.trim()) genBody.page_numbers = pageNumbers.trim();
      const genRes = await fetch('/api/v1/session-exam-topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genBody),
      });
      const genJson = await genRes.json();
      if (!genJson.success) throw new Error(genJson.error || 'Generation failed');

      setGeneratingTopicId(newTopicId);
      genStartTimeRef.current = Date.now();
      setGenElapsed(0);
      setExamFlow('generating');
      setSelectedMaterialId('');
    } catch (err) {
      console.error('[TeacherView] Material generate failed:', err);
      const msg = err instanceof Error ? err.message : 'Generation from material failed';
      alert(`⚠️ ${msg}`);
    } finally {
      setIsGeneratingExam(false);
    }
  }, [selectedMaterialId, teachingMaterials, roomSubject, roomGrade, genCount, pageNumbers]);

  // ── Poll generation progress ──
  useEffect(() => {
    if (examFlow !== 'generating' || !generatingTopicId) return;
    const iv = setInterval(async () => {
      try {
        const pollParams = new URLSearchParams({ subject: roomSubject });
        if (roomGrade) pollParams.set('grade', roomGrade);
        const res = await fetch(`/api/v1/session-exam-topics?${pollParams}`);
        const json = await res.json();
        if (!json.success) return;
        const topic = (json.data as Array<{ id: string; status: string; generation_progress: string; question_count: number }>)
          .find((t: { id: string }) => t.id === generatingTopicId);
        if (!topic) return;
        if (topic.status === 'ready' && topic.question_count > 0) {
          setSessionExamTopics(json.data);
          setSelectedTopicId(generatingTopicId);
          setGeneratingTopicId(null);
          setGenProgress('');
          // Auto-fetch questions for preview
          try {
            const qRes = await fetch(`/api/v1/session-exam-topics/questions?topic_id=${generatingTopicId}`);
            const qJson = await qRes.json();
            if (qJson.success && qJson.data?.length > 0) {
              setPreviewQuestions(qJson.data);
              setExamFlow('preview');
            } else {
              setExamFlow('ready');
            }
          } catch {
            setExamFlow('ready');
          }
        } else if (topic.status === 'error' || (topic.status === 'ready' && topic.question_count === 0)) {
          const errMsg = (topic as { error_message?: string }).error_message || 'Question generation failed. Please try again.';
          setExamFlow('open');
          setGeneratingTopicId(null);
          setGenProgress('');
          alert(`⚠️ ${errMsg}`);
        } else {
          setGenProgress(topic.generation_progress || 'Processing…');
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [examFlow, generatingTopicId, roomSubject, roomGrade]);

  // ── Elapsed timer for generation ──
  useEffect(() => {
    if (examFlow !== 'generating') { genStartTimeRef.current = null; return; }
    const iv = setInterval(() => {
      if (genStartTimeRef.current) setGenElapsed(Math.floor((Date.now() - genStartTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [examFlow]);

  // ── Session exam: regenerate single question ──
  const handleRegenerateQuestion = useCallback(async (questionId: string) => {
    setRegeneratingQId(questionId);
    try {
      const res = await fetch('/api/v1/session-exam-topics/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to regenerate');
      setPreviewQuestions(prev => prev.map(q => q.id === questionId ? { ...q, ...json.data } : q));
    } catch (err) {
      console.error('[TeacherView] Regenerate question failed:', err);
    } finally {
      setRegeneratingQId(null);
    }
  }, []);

  // ── Session exam: start handler ──
  const handleStartSessionExam = useCallback(async (targetIdentities?: string[]) => {
    const topic = sessionExamTopics.find(t => String(t.id) === String(selectedTopicId));
    if (!topic) {
      console.error('[TeacherView] Session exam topic not found — id:', selectedTopicId, 'topics:', sessionExamTopics.map(t => t.id));
      return;
    }
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        action: 'start',
        topic_id: topic.id,
        topic_title: topic.title,
        subject: topic.subject,
        question_count: topic.question_count || genCount,
      }));
      const opts: { topic: string; reliable: boolean; destinationIdentities?: string[] } = { topic: 'start_session_exam', reliable: true };
      if (targetIdentities && targetIdentities.length > 0) {
        opts.destinationIdentities = targetIdentities;
      }
      await localParticipant.publishData(payload, opts);
      console.log('[TeacherView] Session exam sent to:', targetIdentities || 'all students', topic.id, topic.title);
    } catch (err) {
      console.error('[TeacherView] Failed to send session exam start:', err);
    }
    const resolvedTargets = (targetIdentities && targetIdentities.length > 0)
      ? targetIdentities
      : students.map(s => s.identity);
    setSessionExamTelemetryByTopic(prev => {
      const topicMap = { ...(prev[topic.id] || {}) };
      const now = Date.now();
      for (const identity of resolvedTargets) {
        topicMap[identity] = {
          ...(topicMap[identity] || { updated_at: now }),
          sent_at: now,
          updated_at: now,
        };
      }
      return { ...prev, [topic.id]: topicMap };
    });
    setLastSentTopicId(topic.id);
    setSessionExamSent(true);
    setShowSessionExam(true);
    setExamFlow('closed');
  }, [localParticipant, selectedTopicId, sessionExamTopics, genCount, students]);

  // Student info list for ExamResultsPanel
  const studentInfoList = useMemo(() =>
    students.map(s => ({ identity: s.identity, name: s.name || s.identity })),
    [students]
  );

  // ── Listen for session exam completion ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSessionExamComplete = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSessionExamStatus = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
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

  // ── Google Meet-style adaptive grid (cols × rows) ──
  // Measure container and pick the (cols, rows) that maximise per-tile area
  // assuming a 16:9 tile. Incomplete last row is centred via place-content.
  // Uses a callback ref so ResizeObserver (re)attaches whenever the grid div
  // mounts — critical because the grid only renders after teacher goes live.
  const [gridSize, setGridSize] = useState({ w: 0, h: 0 });
  const gridRoRef = useRef<ResizeObserver | null>(null);

  const gridContainerRef = useCallback((node: HTMLDivElement | null) => {
    gridRoRef.current?.disconnect();
    if (!node) { gridRoRef.current = null; return; }
    // Seed with current dimensions so first render is already sized
    setGridSize({ w: node.clientWidth, h: node.clientHeight });
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setGridSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(node);
    gridRoRef.current = ro;
  }, []);

  useEffect(() => () => gridRoRef.current?.disconnect(), []);

  const SCROLL_THRESHOLD = 20;
  const TILE_ASPECT = 16 / 9;
  const GAP_PX = 8; // matches Tailwind gap-2

  // ── IntersectionObserver for off-screen camera unsubscription ──
  // All students are rendered in one scrollable grid (GMeet-style).
  // When a tile scrolls out of view, we unsubscribe its camera track so
  // LiveKit stops delivering RTP for that participant → 0 decode cost.
  // Audio tracks are never touched — teacher always hears everyone.
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  // Stable combined ref: feeds both gridContainerRef (ResizeObserver) and gridScrollRef.
  // MUST be stable (no changing deps) — if the ref function identity changes each render,
  // React calls oldRef(null) then newRef(node) on every render, which disconnects and
  // reconnects the ResizeObserver, setting gridSize → {0,0} momentarily on every state
  // update (mic, hand-raise, attention score) causing constant grid-layout flicker.
  const gridRef = useCallback((node: HTMLDivElement | null) => {
    gridScrollRef.current = node;
    gridContainerRef(node);
  }, [gridContainerRef]); // gridContainerRef is useCallback([]) → always stable

  // Stable identity-string derived from the student list — changes ONLY when a student
  // actually joins or leaves, NOT on every LiveKit event (mute, quality, attention score).
  // Used as dep in both the IO and video-quality effects to prevent spurious re-runs.
  const studentKey = students.map(s => s.identity).join(',');
  const agentId = visibleAgent?.identity ?? '';

  useEffect(() => {
    const container = gridScrollRef.current;
    if (!container) return;

    ioRef.current?.disconnect();
    ioRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const identity = (entry.target as HTMLElement).dataset.identity;
          if (!identity) continue;
          const participant = room.remoteParticipants.get(identity);
          if (!participant) continue;
          const camPub = participant.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
          if (!camPub) continue;
          if (entry.isIntersecting) {
            if (!camPub.isSubscribed) camPub.setSubscribed(true);
          } else {
            if (camPub.isSubscribed) camPub.setSubscribed(false);
          }
        }
      },
      { root: container, rootMargin: '200px 0px', threshold: 0 },
    );

    container.querySelectorAll<HTMLElement>('[data-identity]').forEach((el) => {
      ioRef.current!.observe(el);
    });

    return () => ioRef.current?.disconnect();
  // Re-run when student identities change (joins/leaves) OR when agent appears/disappears.
  // Using identity-string key avoids firing on every LiveKit event while still catching
  // same-count identity swaps (student A leaves, student B joins simultaneously).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentKey, agentId, room]);

  const gridLayout = useMemo(() => {
    const n = students.length + (visibleAgent ? 1 : 0);
    const { w, h } = gridSize;
    if (n <= 0 || w <= 0 || h <= 0) {
      return { cols: 1, rows: 1, tileW: 0, tileH: 0, shouldScroll: false };
    }

    // Beyond threshold → fixed columns with vertical scroll
    if (n > SCROLL_THRESHOLD) {
      const cols = n <= 30 ? 6 : n <= 49 ? 7 : 8;
      const rows = Math.ceil(n / cols);
      const tileW = Math.max(120, (w - GAP_PX * (cols - 1)) / cols);
      const tileH = tileW / TILE_ASPECT;
      return { cols, rows, tileW, tileH, shouldScroll: true };
    }

    // Search for layout that maximises 16:9 tile area
    let best = { cols: 1, rows: n, tileW: 0, tileH: 0, area: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cellW = (w - GAP_PX * (cols - 1)) / cols;
      const cellH = (h - GAP_PX * (rows - 1)) / rows;
      if (cellW <= 0 || cellH <= 0) continue;
      const tileW = Math.min(cellW, cellH * TILE_ASPECT);
      const tileH = tileW / TILE_ASPECT;
      const area = tileW * tileH;
      if (area > best.area) best = { cols, rows, tileW, tileH, area };
    }
    return {
      cols: best.cols,
      rows: best.rows,
      tileW: best.tileW,
      tileH: best.tileH,
      shouldScroll: false,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length, !!visibleAgent, gridSize]);

  const shouldScroll = gridLayout.shouldScroll;

  // ── Video quality for student feeds ──
  const [videoQuality, setVideoQuality] = useState<VideoQualityOption>('auto');

  // Apply quality to all student camera tracks.
  // Deps use studentKey (not raw students array) — LiveKit returns a new array reference
  // on every mic/quality/attention event, causing this to fire hundreds of times per minute
  // if we dep on the array itself. studentKey only changes when students join or leave.
  // Also guards camPub.isSubscribed — no point setting quality on off-screen unsubscribed tracks.
  useEffect(() => {
    const quality = QUALITY_MAP[videoQuality];
    for (const student of students) {
      const camPub = student.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
      if (camPub?.isSubscribed) {
        camPub.setVideoQuality(quality ?? VideoQuality.HIGH);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentKey, videoQuality]);

  // ── OC Join Request Approval (only for open classroom rooms) ──
  const isOcRoom = roomId.startsWith('oc_');
  const [ocJoinRequests, setOcJoinRequests] = useState<{ id: string; name: string; email: string | null; created_at: string }[]>([]);
  const [ocAutoApprove, setOcAutoApprove] = useState(true);

  useEffect(() => {
    if (!isOcRoom) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/open-classroom/join-requests?room_id=${roomId}`);
        const data = await res.json();
        if (data.success) {
          setOcJoinRequests(data.data.requests || []);
          setOcAutoApprove(data.data.auto_approve);
        }
      } catch { /* retry */ }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [isOcRoom, roomId]);

  const handleOcJoinAction = useCallback(async (participantId: string, action: 'approve' | 'deny') => {
    try {
      await fetch('/api/v1/open-classroom/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, participant_id: participantId, action }),
      });
      setOcJoinRequests(prev => prev.filter(r => r.id !== participantId));
    } catch { /* ignore */ }
  }, [roomId]);

  const toggleOcAutoApprove = useCallback(async () => {
    const newVal = !ocAutoApprove;
    setOcAutoApprove(newVal);
    try {
      await fetch('/api/v1/open-classroom/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, auto_approve: newVal }),
      });
      if (newVal) setOcJoinRequests([]);
    } catch {
      setOcAutoApprove(!newVal); // revert on error
    }
  }, [roomId, ocAutoApprove]);

  // Auto-close requests dropdown when all requests are cleared
  useEffect(() => {
    const total = handCount + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length + (isOcRoom ? ocJoinRequests.length : 0);
    if (total === 0) setRequestsDropdownOpen(false);
  }, [handCount, mediaRequests.length, leaveRequests.length, rejoinRequests.length, extensionRequests.length, ocJoinRequests.length, isOcRoom]);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="flex h-dvh flex-col bg-[#202124] text-[#e8eaed]">

      {/* ── Demo exam dialog ─── */}
      {showDemoExam && (
        <DemoExamDialog
          roomId={roomId}
          role="teacher"
          onDismiss={() => setShowDemoExam(false)}
        />
      )}
      {showSessionExam && selectedTopicId && (
        <SessionExamDialog
          topicId={selectedTopicId}
          topicTitle={sessionExamTopics.find(t => t.id === selectedTopicId)?.title || ''}
          subject={roomSubject}
          roomId={roomId}
          sessionId={roomSessionId}
          studentEmail=""
          studentName=""
          role="teacher"
          questionCount={sessionExamTopics.find(t => t.id === selectedTopicId)?.question_count}
          onDismiss={() => setShowSessionExam(false)}
        />
      )}

      {/* ── Header ───────────────────────────────────────── */}
      <HeaderBar
        roomName={roomName}
        role="teacher"
        scheduledStart={scheduledStart}
        goLiveAt={goLiveAt}
        durationMinutes={durationMinutes}
        sidebarOpen={sidebarOpen}
        isLive={isLive}
        topic={topic}
        onFilesClick={() => setShowMaterialsOverlay(true)}
        materialsCount={materialsCount > 0 ? materialsCount : undefined}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onTimeExpired={onTimeExpired}
        coordinatorOnline={isLive && !isDemo && hasCoordinator ? coordinatorOnline : null}
        criticalAlerts={alerts}
        onClearAlerts={clearAlerts}
        extraRightContent={bcIdentity !== null ? (
          <button
            onMouseDown={startBcReply}
            onMouseUp={stopBcReply}
            onMouseLeave={() => { if (bcReplyActive) stopBcReply(); }}
            onTouchStart={(e) => { e.preventDefault(); startBcReply(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopBcReply(); }}
            onTouchCancel={stopBcReply}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none',
              bcReplyActive
                ? 'bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/60'
                : 'bg-[#292a2d] text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]',
            )}
            title={`Hold to talk privately to the ${bcLabel === 'AO' ? 'academic operator' : bcLabel === 'BC/AO' ? 'coordinator / academic operator' : 'batch coordinator'}`}
            aria-pressed={bcReplyActive}
          >
            <span className={cn('h-2 w-2 rounded-full shrink-0', bcReplyActive ? 'bg-emerald-400 animate-pulse' : 'bg-[#5f6368]')} />
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            {bcReplyActive ? `Talking to ${bcLabel}…` : `Hold to talk to ${bcLabel}`}
          </button>
        ) : undefined}
      />

      {/* ── Go Live Setup Banner ────────────────────────── */}
      {!isLive && (
        <div className="border-b border-[#3c4043] bg-[#292a2d]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            {/* Connection status indicators */}
            <div className="flex items-center gap-5 text-xs">
              <StatusDot active label="Laptop" icon="laptop" />
              <StatusDot active={!!teacherScreenDevice} label="Tablet" pendingLabel="Tablet (optional)" icon="tablet" />
              {!isDemo && hasCoordinator && (
                <span className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', coordinatorOnline ? 'bg-[#34a853] animate-pulse' : 'bg-[#5f6368]')} />
                  <svg className="h-3.5 w-3.5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className={coordinatorOnline ? 'text-[#e8eaed]' : 'text-[#9aa0a6]'}>
                    {coordinatorOnline ? 'Coordinator online' : 'Coordinator offline'}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1.5 text-[#9aa0a6]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {lobbyCount} student{lobbyCount !== 1 ? 's' : ''} waiting
              </span>
            </div>

            {/* Go Live button + error — demos can go live with 0 students */}
            <div className="flex items-center gap-3">
              {goLiveError && (
                <span className="text-xs text-[#ea4335]">{goLiveError}</span>
              )}
              {goLiveApproval === 'pending' ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-400 font-medium animate-pulse">
                    Waiting for coordinator approval…
                  </span>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                </div>
              ) : goLiveApproval === 'denied' ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#ea4335] font-medium">
                    Go Live denied by coordinator
                  </span>
                  <button
                    onClick={() => { setGoLiveApproval('none'); setGoLiveError(''); }}
                    className="text-xs text-[#8ab4f8] hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {!teacherScreenDevice && (
                    <span className="hidden text-xs text-[#9aa0a6] sm:inline">
                      Tablet optional
                    </span>
                  )}
                  {(() => {
                    return (
                      <>
                        <button
                          onClick={handleGoLive}
                          disabled={goingLive}
                          className={cn(
                            'flex items-center gap-2 rounded-full px-6 py-2.5',
                            'text-sm font-bold text-white shadow-lg',
                            'transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                            'bg-[#ea4335] shadow-red-900/20 hover:bg-[#c5221f]',
                          )}
                        >
                          {goingLive ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Going live…
                            </>
                          ) : (
                            <>
                              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                              GO LIVE
                            </>
                          )}
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Body (main + sidebar) ───────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main content area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-2">

            {/* === Pre-live: teacher monitors students' A/V before going live === */}
            {!isLive ? (
              <div className="flex h-full flex-col overflow-hidden">
                {/* Top status row */}
                <div className="shrink-0 flex items-center gap-2 px-1 pb-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30 animate-pulse" />
                  <span className="text-sm font-medium text-[#e8eaed]">
                    {students.length > 0
                      ? `${students.length} student${students.length !== 1 ? 's' : ''} in lobby`
                      : isDemo ? 'Ready to start' : isOcRoom ? 'Waiting for participants…' : 'Waiting for students…'}
                  </span>
                  {students.length > 0 && (
                    <span className="ml-auto text-xs text-[#9aa0a6]">Click GO LIVE to start the class</span>
                  )}
                </div>
                {/* Student video grid — teacher can see/hear each student */}
                {students.length > 0 ? (
                  <div
                    className="flex-1 min-h-0 grid gap-2 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(students.length, 3)}, minmax(0, 1fr))`,
                      alignContent: 'start',
                    }}
                  >
                    {students.map((s) => (
                      <div
                        key={s.identity}
                        className="relative min-h-0 overflow-hidden rounded-xl bg-[#292a2d]"
                        style={{ aspectRatio: '16/9' }}
                      >
                        <VideoTile
                          participant={s}
                          size="large"
                          showName={true}
                          showMicIndicator={true}
                          playAudio={true}
                          className="rounded-xl!"
                        />
                        {remotePerms[s.identity] && (remotePerms[s.identity].audio === 'denied' || remotePerms[s.identity].video === 'denied') && (
                          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 p-2 text-center">
                            <div className="text-sm font-semibold text-white">Permissions blocked</div>
                            <div className="text-xs text-white/80 mt-1">
                              {remotePerms[s.identity].video === 'denied' ? 'Camera blocked' : ''}
                              {remotePerms[s.identity].video === 'denied' && remotePerms[s.identity].audio === 'denied' ? ' • ' : ''}
                              {remotePerms[s.identity].audio === 'denied' ? 'Microphone blocked' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043]">
                        <svg className="h-10 w-10 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-[#9aa0a6]">
                        {isDemo
                          ? 'Click GO LIVE to start — the student will join once the session is live.'
                          : isOcRoom ? 'Participants will appear here once they join' : 'Students will appear here once they join'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

            /* === Whiteboard mode: whiteboard + student strip === */
            ) : whiteboardActive && hasScreenShare ? (
              <div className="flex h-full flex-col gap-2">
                {/* Source toggle — only when both laptop + tablet are sharing */}
                {canSwitchSource && (
                  <div className="flex items-center justify-center gap-1 shrink-0">
                    <div className="inline-flex items-center rounded-full bg-[#292a2d] border border-[#3c4043] p-0.5">
                      <button
                        onClick={() => setScreenSourcePref('laptop')}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
                          screenSourcePref === 'laptop'
                            ? 'bg-[#8ab4f8] text-[#1a1a2e] shadow-sm'
                            : 'text-[#9aa0a6] hover:text-white',
                        )}
                      >
                        🖥️ Laptop
                      </button>
                      <button
                        onClick={() => setScreenSourcePref('tablet')}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
                          screenSourcePref === 'tablet'
                            ? 'bg-[#8ab4f8] text-[#1a1a2e] shadow-sm'
                            : 'text-[#9aa0a6] hover:text-white',
                        )}
                      >
                        📱 Tablet
                      </button>
                    </div>
                  </div>
                )}
                {/* Whiteboard */}
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl">
                  <WhiteboardComposite
                    teacher={localParticipant as unknown as Participant}
                    teacherScreenDevice={teacherScreenDevice}
                    preferLaptopScreen={screenSourcePref === 'laptop'}
                    className="h-full w-full"
                  />
                </div>
                {/* Student thumbnail strip (scrollable) */}
                {(students.length > 0 || visibleAgent) && (
                  <div className="flex h-25 gap-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
                    {visibleAgent && (
                      <div className="relative group h-full w-32.5 shrink-0 overflow-hidden rounded-lg ring-1 ring-purple-500/40">
                        <VideoTile
                          participant={visibleAgent}
                          size="small"
                          showName={false}
                          showMicIndicator={true}
                          playAudio={true}
                          className="w-full! h-full! rounded-lg!"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                          <span className="text-[10px] font-medium text-purple-300 truncate block">Academic Counselor</span>
                        </div>
                      </div>
                    )}
                    {students.map((s) => (
                      <div
                        key={s.identity}
                        className="relative group h-full w-32.5 shrink-0 overflow-hidden rounded-lg"
                      >
                        <VideoTile
                          participant={s}
                          size="small"
                          showName={true}
                          showMicIndicator={true}
                          playAudio={!mutedStudents.has(s.identity)}
                          handRaised={raisedHands.has(s.identity)}
                          connectionQuality={s.connectionQuality}
                          className="w-full! h-full! rounded-lg!"
                        />
                        {remotePerms[s.identity] && (remotePerms[s.identity].audio === 'denied' || remotePerms[s.identity].video === 'denied') && (
                          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 p-2 text-center">
                            <div className="text-xs font-semibold text-white">Permissions blocked</div>
                            <div className="text-[10px] text-white/80 mt-1">
                              {remotePerms[s.identity].video === 'denied' ? 'Camera' : ''}
                              {remotePerms[s.identity].video === 'denied' && remotePerms[s.identity].audio === 'denied' ? ' • ' : ''}
                              {remotePerms[s.identity].audio === 'denied' ? 'Microphone' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            /* === No students: waiting state === */
            ) : students.length === 0 && !visibleAgent ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043]">
                    <svg className="h-10 w-10 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-medium text-[#e8eaed]">{isOcRoom ? 'Waiting for participants…' : 'Waiting for students…'}</h2>
                  <p className="mt-2 text-sm text-[#9aa0a6]">
                    {isLive ? (isOcRoom ? 'Class is live — participants can join now' : 'Batch is live — students can join now') : (isOcRoom ? 'Go live to let participants join' : 'Go live to let students join')}
                  </p>
                </div>
              </div>

            /* === Student grid (responsive, no rotation) === */
            ) : (
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-[#9aa0a6]">
                    {students.length} {isOcRoom ? 'participant' : 'student'}{students.length !== 1 ? 's' : ''}{visibleAgent ? ' + 1 counselor' : ''}
                  </span>
                  <VideoQualitySelector
                    quality={videoQuality}
                    onChange={setVideoQuality}
                    variant="panel"
                  />
                </div>
                {/* Grid — GMeet-style: all tiles in one scrollable view, IntersectionObserver manages camera subscriptions */}
                <div
                  ref={gridRef}
                  className={cn(
                    'grid flex-1 min-h-0 gap-2',
                    shouldScroll
                      ? 'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]'
                      : 'overflow-hidden',
                  )}
                  style={{
                    gridTemplateColumns:
                      gridLayout.tileW > 0
                        ? `repeat(${gridLayout.cols}, ${gridLayout.tileW}px)`
                        : `repeat(${gridLayout.cols}, minmax(0, 1fr))`,
                    gridAutoRows:
                      gridLayout.tileH > 0 ? `${gridLayout.tileH}px` : 'minmax(0, 1fr)',
                    placeContent: 'center',
                  }}
                >
                  {students.map((s) => {
                    const att = studentAttention.get(s.identity);
                    const attScore = att?.attentionScore ?? 100;
                    const attState = att?.monitorState;
                    const isLowAtt = attScore < 50;
                    const isSleeping = attState === 'eyes_closed';
                    const isNotLooking = attState === 'looking_away';

                    return (
                    <div
                      key={s.identity}
                      data-identity={s.identity}
                      className={cn(
                        'relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d] transition-shadow duration-200',
                        isSleeping && 'ring-2 ring-red-500/60',
                        isNotLooking && !isSleeping && 'ring-2 ring-amber-500/60',
                      )}
                    >
                      <VideoTile
                        participant={s}
                        size="large"
                        showName={true}
                        showMicIndicator={true}
                        playAudio={!mutedStudents.has(s.identity)}
                        handRaised={raisedHands.has(s.identity)}
                        connectionQuality={s.connectionQuality}
                        className="rounded-xl!"
                        onClick={() => setSelectedStudentId(s.identity)}
                      />
                      {remotePerms[s.identity] && (remotePerms[s.identity].audio === 'denied' || remotePerms[s.identity].video === 'denied') && (
                        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 p-2 text-center">
                          <div className="text-sm font-semibold text-white">Permissions blocked</div>
                          <div className="text-xs text-white/80 mt-1">
                            {remotePerms[s.identity].video === 'denied' ? 'Camera blocked' : ''}
                            {remotePerms[s.identity].video === 'denied' && remotePerms[s.identity].audio === 'denied' ? ' • ' : ''}
                            {remotePerms[s.identity].audio === 'denied' ? 'Microphone blocked' : ''}
                          </div>
                        </div>
                      )}
                      {/* AI Attention indicator badge — hidden when hand is raised to avoid overlap */}
                      {att && !raisedHands.has(s.identity) && (
                        <div className={cn(
                          'absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm pointer-events-none',
                          isSleeping ? 'bg-red-600/80 text-white' :
                          isLowAtt ? 'bg-amber-500/80 text-white' :
                          'bg-green-600/70 text-white'
                        )}>
                          {isSleeping ? (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h4l2-2"/><path d="M6 8h4l2-2"/><path d="M10 12h4l2-2"/></svg>
                          ) : isNotLooking ? (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          ) : attScore >= 75 ? 'OK' : '!'}
                          <span>{attScore}%</span>
                        </div>
                      )}
                    </div>
                    );
                  })}
                  {/* Academic Counselor (demo agent) tile */}
                  {visibleAgent && (
                    <div
                      data-identity={visibleAgent.identity}
                      className="relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d] ring-1 ring-purple-500/30"
                    >
                      <VideoTile
                        participant={visibleAgent}
                        size="large"
                        showName={false}
                        showMicIndicator={true}
                        playAudio={true}
                        className="rounded-xl!"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <span className="text-xs font-medium text-purple-300 truncate block">Academic Counselor</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Self-cam floating PIP (top-left) — always visible when live */}
          {isLive && (
          <div
            className={cn(
              'absolute top-4 z-30 transition-all duration-500 ease-in-out',
              selfieHidden ? '-translate-x-[calc(100%+1.5rem)]' : 'translate-x-0',
              'left-4',
            )}
          >
            {/* Hide/show toggle arrow */}
            <button
              onClick={() => setSelfieHidden(h => !h)}
              className="absolute -right-5 top-1/2 -translate-y-1/2 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/20 text-white/70 hover:text-white transition-colors"
              title={selfieHidden ? 'Show self cam' : 'Hide self cam'}
            >
              <svg className={cn('h-3 w-3 transition-transform duration-300', selfieHidden && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div ref={selfVideoPipRef} className="overflow-hidden rounded-xl shadow-xl ring-1 ring-white/8 transition-shadow hover:ring-white/20">
              <VideoTile
                participant={localParticipant}
                size="small"
                mirror={true}
                showName={false}
                showMicIndicator={true}
                className="w-35! h-26.25! rounded-xl!"
              />
            </div>
          </div>
          )}

          {/* Student-view verification preview (top-right) — slide-to-hide */}
          {isLive && whiteboardActive && hasScreenShare && (
            <div
              className={cn(
                'absolute top-4 right-4 z-30 transition-all duration-500 ease-in-out',
                studentSharePreviewHidden ? 'translate-x-[calc(100%+1.5rem)]' : 'translate-x-0',
              )}
            >
              <button
                onClick={() => setStudentSharePreviewHidden((h) => !h)}
                className="absolute -left-5 top-1/2 -translate-y-1/2 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/20 text-white/70 hover:text-white transition-colors"
                title={studentSharePreviewHidden ? 'Show student share preview' : 'Hide student share preview'}
              >
                <svg className={cn('h-3 w-3 transition-transform duration-300', studentSharePreviewHidden && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div className="w-80 overflow-hidden rounded-xl bg-[#202124]/95 shadow-xl ring-1 ring-white/10 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-2">
                  <span className="text-[11px] font-semibold text-[#e8eaed]">Student Share Preview</span>
                  <span className="text-[10px] text-[#9aa0a6]">{screenSourcePref === 'laptop' ? 'Laptop source' : 'Tablet source'}</span>
                </div>
                <div className="h-44 bg-[#1a1a1d]">
                  <WhiteboardComposite
                    teacher={localParticipant as unknown as Participant}
                    teacherScreenDevice={teacherScreenDevice}
                    preferLaptopScreen={screenSourcePref === 'laptop'}
                    hideOverlay={true}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Student detail zoom panel ── */}
          {selectedStudentId && (() => {
            const selStudent = students.find(s => s.identity === selectedStudentId);
            if (!selStudent) return null;
            return (
              <StudentDetailPanel
                participant={selStudent}
                attention={studentAttention.get(selectedStudentId)}
                isMuted={mutedStudents.has(selectedStudentId)}
                onToggleMute={() => toggleStudentMute(selectedStudentId)}
                onClose={() => setSelectedStudentId(null)}
                handRaised={raisedHands.has(selectedStudentId)}
                connectionQuality={selStudent.connectionQuality}
              />
            );
          })()}

          {/* ── Exam in-progress overlay ── */}
          {examInProgress && isLive && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center space-y-5 animate-in fade-in duration-500">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-teal-500/20 ring-2 ring-teal-500/40">
                  <svg className="h-12 w-12 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Student is taking the exam</h2>
                  <p className="mt-2 text-sm text-[#9aa0a6]">
                    The student is completing the sample assessment.
                  </p>
                  <p className="mt-1 text-xs text-[#9aa0a6]">
                    10 questions · 30 seconds each
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce [animation-delay:300ms]" />
                </div>
                <button
                  onClick={() => setExamInProgress(false)}
                  className="mt-2 text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Exam result overlay (shown after student completes exam) ── */}
          {examResult && !examInProgress && isLive && (
            <div className="absolute bottom-4 right-4 z-40 animate-in slide-in-from-right duration-300">
              <div className="flex items-center gap-3 rounded-xl bg-[#303134] px-4 py-3 shadow-xl border border-white/10">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
                  examResult.percentage >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                  examResult.percentage >= 50 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {examResult.grade}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Exam Complete</p>
                  <p className="text-xs text-[#9aa0a6]">
                    {examResult.score}/{examResult.total} ({Math.round(examResult.percentage)}%)
                  </p>
                </div>
                <button onClick={() => setExamResult(null)} className="ml-2 text-white/40 hover:text-white/80 transition-colors">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Requests portal dropdown (all student requests consolidated) ── */}
          {requestsDropdownOpen && typeof document !== 'undefined' && createPortal(
            <div
              ref={requestsDropdownRef}
              className="fixed z-[99999] w-84 max-h-[80vh] rounded-xl border border-[#3c4043] bg-[#202124] shadow-2xl flex flex-col overflow-hidden"
              style={{ top: requestsDropdownPos.top, right: requestsDropdownPos.right }}
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
                    {handCount + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length + (isOcRoom ? ocJoinRequests.length : 0)}
                  </span>
                </div>
                <button
                  onClick={() => setRequestsDropdownOpen(false)}
                  className="text-[10px] text-[#9aa0a6] hover:text-[#e8eaed] transition-colors px-1.5 py-0.5 rounded hover:bg-[#3c4043]"
                >
                  Close
                </button>
              </div>

              <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">

                {/* ── Hand raises section ── */}
                {handCount > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#f9ab00]/8 border-b border-[#3c4043]">
                      <div className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                        <span className="text-[11px] font-semibold text-[#f9ab00]">Raised Hands ({handCount})</span>
                      </div>
                      <button onClick={dismissAllHands} className="text-[10px] text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] rounded px-1.5 py-0.5 transition-colors">Lower all</button>
                    </div>
                    {sortedHands.map(([id, info]) => (
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

                {/* ── Media requests section ── */}
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
                      <div key={`${req.student_id}_${req.type}`} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="flex items-center mt-0.5 shrink-0">{req.type === 'mic' ? (
                            req.desired ? (
                              <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12L9 9z"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            ) : (
                              <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            )
                          ) : (
                            req.desired ? (
                              <svg className="h-3 w-3 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                            ) : (
                              <svg className="h-3 w-3 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/><path d="M21 13V7l-7 5"/></svg>
                            )
                          )}</span>
                          <span className="text-xs text-[#e8eaed] break-words">
                            <strong>{req.student_name}</strong>{' '}wants to {req.desired ? 'turn on' : 'turn off'} {req.type}
                          </span>
                        </div>
                        <div className="flex gap-1.5 ml-2 shrink-0">
                          {req.bcHandled ? (
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1',
                              req.bcHandled === 'approved' ? 'bg-[#34a853]/20 text-[#34a853]' : 'bg-[#ea4335]/20 text-[#ea4335]'
                            )}>
                              {req.bcHandled === 'approved' ? '✓' : '✗'} BC {req.bcHandled === 'approved' ? 'Approved' : 'Denied'}
                            </span>
                          ) : (
                            <>
                              <button onClick={() => approveRequest(req)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Approve</button>
                              <button onClick={() => denyRequest(req)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Leave requests section ── */}
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
                      <div key={req.student_id} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                        <span className="text-xs text-[#e8eaed]"><strong>{req.student_name}</strong> wants to leave</span>
                        <div className="flex gap-1.5 ml-2 shrink-0">
                          {req.bcHandled ? (
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1',
                              req.bcHandled === 'approved' ? 'bg-[#34a853]/20 text-[#34a853]' : 'bg-[#ea4335]/20 text-[#ea4335]'
                            )}>
                              {req.bcHandled === 'approved' ? '✓' : '✗'} BC {req.bcHandled === 'approved' ? 'Approved' : 'Denied'}
                            </span>
                          ) : (
                            <>
                              <button onClick={() => approveLeave(req)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Allow</button>
                              <button onClick={() => denyLeave(req)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Rejoin requests section ── */}
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
                      <div key={req.student_id} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                        <span className="text-xs text-[#e8eaed]"><strong>{req.student_name}</strong> wants to rejoin</span>
                        <div className="flex gap-1.5 ml-2 shrink-0">
                          {req.bcHandled ? (
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1',
                              req.bcHandled === 'approved' ? 'bg-[#34a853]/20 text-[#34a853]' : 'bg-[#ea4335]/20 text-[#ea4335]'
                            )}>
                              {req.bcHandled === 'approved' ? '✓' : '✗'} BC {req.bcHandled === 'approved' ? 'Approved' : 'Denied'}
                            </span>
                          ) : (
                            <>
                              <button onClick={() => approveRejoin(req)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Allow</button>
                              <button onClick={() => denyRejoin(req)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Extension requests section ── */}
                {extensionRequests.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/8 border-b border-[#3c4043]">
                      <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span className="text-[11px] font-semibold text-blue-400">Extension Requests ({extensionRequests.length})</span>
                    </div>
                    {extensionRequests.map((req) => (
                      <div key={req.request_id} className="px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#e8eaed]"><strong>{req.student_name}</strong> wants <strong>+{req.requested_minutes}min</strong></span>
                          {req.fee_paise > 0 && <span className="text-[10px] text-[#9aa0a6]">₹{(req.fee_paise / 100).toFixed(0)} fee</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleExtensionAction(req, 'approve')} disabled={extensionActionLoading === req.request_id} className="flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 disabled:opacity-50 transition-colors">
                            {extensionActionLoading === req.request_id ? '…' : 'Approve & Forward'}
                          </button>
                          <button onClick={() => handleExtensionAction(req, 'reject')} disabled={extensionActionLoading === req.request_id} className="flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 disabled:opacity-50 transition-colors">Deny</button>
                        </div>
                        <p className="mt-1 text-[9px] text-[#9aa0a6]/70">Approval forwarded to coordinator</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── OC join requests section ── */}
                {isOcRoom && ocJoinRequests.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[#8ab4f8]/8 border-b border-[#3c4043]">
                      <div className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        <span className="text-[11px] font-semibold text-[#8ab4f8]">Join Requests ({ocJoinRequests.length})</span>
                      </div>
                      <button onClick={() => ocJoinRequests.forEach(r => handleOcJoinAction(r.id, 'approve'))} className="text-[10px] text-[#34a853] hover:bg-[#34a853]/15 rounded px-1.5 py-0.5 transition-colors">Approve all</button>
                    </div>
                    {ocJoinRequests.map((req) => (
                      <div key={req.id} className="flex items-start justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 border-b border-[#3c4043]/30 last:border-0 transition-colors">
                        <span className="text-xs text-[#e8eaed]"><strong>{req.name}</strong> wants to join</span>
                        <div className="flex gap-1.5 ml-2 shrink-0">
                          <button onClick={() => handleOcJoinAction(req.id, 'approve')} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors">Approve</button>
                          <button onClick={() => handleOcJoinAction(req.id, 'deny')} className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors">Deny</button>
                        </div>
                      </div>
                    ))}
                    {/* Auto-approve toggle */}
                    <div className="flex items-center justify-between px-3 py-2 border-t border-[#3c4043]">
                      <span className="text-[10px] text-[#9aa0a6]">Auto-approve new joiners</span>
                      <button
                        onClick={toggleOcAutoApprove}
                        className={cn('relative w-8 h-4.5 rounded-full transition-colors', ocAutoApprove ? 'bg-[#34a853]' : 'bg-[#5f6368]')}
                      >
                        <span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all', ocAutoApprove ? 'left-4' : 'left-0.5')} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {handCount + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length + (isOcRoom ? ocJoinRequests.length : 0) === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-[#9aa0a6]">No pending requests</div>
                )}
              </div>
            </div>,
            document.body
          )}

          {/* ── Tablet connection badge ── */}
          {teacherScreenDevice && isLive && (
            <div className="mx-2 mb-1 flex items-center gap-2 rounded-lg bg-[#34a853]/10 px-3 py-1.5 text-xs text-[#34a853]">
              <span className="h-2 w-2 rounded-full bg-[#34a853] animate-pulse" />
              Tablet connected{canSwitchSource ? ` · Showing ${screenSourcePref}` : ` — screen share from ${teacherScreenDevice.name || 'tablet'}`}
            </div>
          )}

          {/* Demo: manual Start Exam button */}
          {isDemo && isLive && students.length > 0 && (
            <div className="mx-2 mb-1">
              <button
                onClick={handleStartExam}
                disabled={examSent}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all',
                  examSent
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 cursor-default'
                    : 'bg-teal-500 text-white hover:bg-teal-400 active:scale-95 shadow-lg shadow-teal-900/20',
                )}
              >
                <span className="flex items-center">{examSent ? (
                  <svg className="h-4 w-4 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                )}</span>
                {examSent ? 'Exam Sent to Student' : 'Start Sample Exam'}
              </button>
            </div>
          )}

          {/* Exam results moved to exam_results sidebar tab */}
        </div>

        {/* ── Right Sidebar ─────────────────────────────── */}
        {sidebarOpen && (
          <div className="flex flex-col border-l border-[#3c4043] bg-[#1a1b1e] relative" style={{ width: sidebarWidth }}>
            {/* Drag handle */}
            <div
              onMouseDown={onSidebarDragStart}
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#8ab4f8]/30 transition-colors z-10 group"
              title="Drag to resize"
            />
            {/* ── Premium Tab Bar ── */}
            {(() => {
              const totalApprovals = handCount + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length + (isOcRoom ? ocJoinRequests.length : 0);
              const tabs = [
                { id: 'approvals' as const, label: 'Approvals', badge: totalApprovals > 0 ? totalApprovals : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>) },
                { id: 'participants' as const, label: 'People', badge: null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },
                { id: 'chat' as const, label: 'Chat', badge: unreadChatCount > 0 ? unreadChatCount : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>) },
                { id: 'monitoring' as const, label: 'Monitor', badge: monitoringAlerts.length > 0 ? monitoringAlerts.length : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z"/><line x1="9" y1="22" x2="15" y2="22"/></svg>) },
                { id: 'homework' as const, label: 'Tasks', badge: null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>) },
                { id: 'attendance' as const, label: 'Attend', badge: null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>) },
                { id: 'exam_results' as const, label: 'Exams', badge: sessionExamSent ? sessionExamResults.length : null, icon: (<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>) },
              ];
              return (
                <div className="flex border-b border-[#2d2e32] bg-[#1a1b1e] overflow-x-auto scrollbar-none">
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
                        {/* Active indicator */}
                        {isActive && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-t-full bg-gradient-to-r from-[#4285f4] to-[#8ab4f8]" />
                        )}
                        {/* Icon with badge */}
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
                        {/* Label */}
                        <span className="text-[9px] font-medium leading-none tracking-wide">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Announcement bar hidden — replaced by direct messaging */}

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {/* ChatPanel is always mounted so real-time messages are never missed.
                  CSS hide/show keeps it in the DOM when on other tabs. */}
              <div className={sidebarTab === 'chat' ? 'h-full' : 'hidden'}>
                <ChatPanel
                  roomId={roomId}
                  participantName={participantName}
                  participantRole="teacher"
                  onNewMessage={() => { if (sidebarTab !== 'chat') setUnreadChatCount(c => c + 1); }}
                />
              </div>
              {sidebarTab === 'participants' ? (
                <ParticipantList
                  role="teacher"
                  roomId={roomName || roomId}
                  mutedStudents={mutedStudents}
                  onToggleMute={toggleStudentMute}
                  raisedHands={raisedHands}
                />
              ) : sidebarTab === 'attendance' ? (
                <AttendancePanel roomId={roomId} />
              ) : sidebarTab === 'homework' ? (
                <HomeworkPanel
                  roomId={roomId}
                  role="teacher"
                  participantEmail={localParticipant.identity || ''}
                  participantName={participantName}
                  className="flex-1"
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
                  isLive={isLive}
                />
              ) : sidebarTab === 'approvals' ? (
                <div className="flex flex-col h-full overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2d2e32] bg-[#1e1f23]">
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      <span className="text-[11px] font-semibold text-[#e8eaed]">Student Approvals</span>
                    </div>
                    {(() => {
                      const n = handCount + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length + (isOcRoom ? ocJoinRequests.length : 0);
                      return n > 0 ? <span className="rounded-full bg-[#f9ab00]/20 text-[#f9ab00] text-[9px] font-bold px-1.5 py-0.5">{n} pending</span> : null;
                    })()}
                  </div>

                  {/* ── Raised Hands ── */}
                  {handCount > 0 && (
                    <div className="border-b border-[#2d2e32]">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#f9ab00]/6">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#f9ab00] animate-pulse" />
                          <svg className="h-3 w-3 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
                          <span className="text-[11px] font-semibold text-[#f9ab00]">Raised Hands</span>
                          <span className="bg-[#f9ab00]/20 text-[#f9ab00] text-[9px] font-bold rounded-full px-1.5">{handCount}</span>
                        </div>
                        <button onClick={dismissAllHands} className="text-[9px] text-[#9aa0a6] hover:text-[#f9ab00] transition-colors">Lower all</button>
                      </div>
                      {sortedHands.map(([id, info]) => (
                        <div key={id} className="flex items-center justify-between px-3 py-2 border-b border-[#2d2e32]/60 last:border-0 hover:bg-[#2d2e32]/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-[#f9ab00]/15 flex items-center justify-center text-[10px] font-bold text-[#f9ab00]">{info.name.charAt(0).toUpperCase()}</span>
                            <span className="text-[11px] text-[#e8eaed] truncate max-w-[160px]">{info.name}</span>
                          </div>
                          <button onClick={() => dismissHand(id)} className="flex h-6 w-6 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Media Requests ── */}
                  {mediaRequests.length > 0 && (
                    <div className="border-b border-[#2d2e32]">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#4285f4]/6">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8ab4f8] animate-pulse" />
                          <svg className="h-3 w-3 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                          <span className="text-[11px] font-semibold text-[#8ab4f8]">Media Requests</span>
                          <span className="bg-[#4285f4]/20 text-[#8ab4f8] text-[9px] font-bold rounded-full px-1.5">{mediaRequests.length}</span>
                        </div>
                        <button onClick={() => setMediaRequests([])} className="text-[9px] text-[#9aa0a6] hover:text-[#8ab4f8] transition-colors">Clear all</button>
                      </div>
                      {mediaRequests.map((req) => (
                        <div key={`${req.student_id}_${req.type}`} className="px-3 py-2.5 border-b border-[#2d2e32]/60 last:border-0 hover:bg-[#2d2e32]/40 transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-6 w-6 rounded-full bg-[#4285f4]/15 flex items-center justify-center text-[10px] font-bold text-[#8ab4f8]">{req.student_name.charAt(0).toUpperCase()}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-[#e8eaed] truncate">{req.student_name}</p>
                              <p className="text-[9px] text-[#9aa0a6]">{req.desired ? 'wants to turn on' : 'wants to turn off'} {req.type}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {req.bcHandled ? (
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', req.bcHandled === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400')}>
                                BC {req.bcHandled === 'approved' ? '✓ Approved' : '✗ Denied'}
                              </span>
                            ) : (
                              <>
                                <button onClick={() => approveRequest(req)} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition-colors">Approve</button>
                                <button onClick={() => denyRequest(req)} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">Deny</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Leave Requests ── */}
                  {leaveRequests.length > 0 && (
                    <div className="border-b border-[#2d2e32]">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#ea4335]/6">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#f28b82] animate-pulse" />
                          <svg className="h-3 w-3 text-[#f28b82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                          <span className="text-[11px] font-semibold text-[#f28b82]">Leave Requests</span>
                          <span className="bg-[#ea4335]/20 text-[#f28b82] text-[9px] font-bold rounded-full px-1.5">{leaveRequests.length}</span>
                        </div>
                        <button onClick={() => setLeaveRequests([])} className="text-[9px] text-[#9aa0a6] hover:text-[#f28b82] transition-colors">Clear all</button>
                      </div>
                      {leaveRequests.map((req) => (
                        <div key={req.student_id} className="px-3 py-2.5 border-b border-[#2d2e32]/60 last:border-0 hover:bg-[#2d2e32]/40 transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-6 w-6 rounded-full bg-[#ea4335]/15 flex items-center justify-center text-[10px] font-bold text-[#f28b82]">{req.student_name.charAt(0).toUpperCase()}</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-medium text-[#e8eaed]">{req.student_name}</p>
                              <p className="text-[9px] text-[#9aa0a6]">Requesting to leave session</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {req.bcHandled ? (
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', req.bcHandled === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400')}>
                                BC {req.bcHandled === 'approved' ? '✓ Approved' : '✗ Denied'}
                              </span>
                            ) : (
                              <>
                                <button onClick={() => approveLeave(req)} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition-colors">Allow</button>
                                <button onClick={() => denyLeave(req)} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">Deny</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Rejoin Requests ── */}
                  {rejoinRequests.length > 0 && (
                    <div className="border-b border-[#2d2e32]">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#4285f4]/6">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8ab4f8] animate-pulse" />
                          <svg className="h-3 w-3 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                          <span className="text-[11px] font-semibold text-[#8ab4f8]">Rejoin Requests</span>
                          <span className="bg-[#4285f4]/20 text-[#8ab4f8] text-[9px] font-bold rounded-full px-1.5">{rejoinRequests.length}</span>
                        </div>
                        <button onClick={() => setRejoinRequests([])} className="text-[9px] text-[#9aa0a6] hover:text-[#8ab4f8] transition-colors">Clear all</button>
                      </div>
                      {rejoinRequests.map((req) => (
                        <div key={req.student_id} className="px-3 py-2.5 border-b border-[#2d2e32]/60 last:border-0 hover:bg-[#2d2e32]/40 transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-6 w-6 rounded-full bg-[#4285f4]/15 flex items-center justify-center text-[10px] font-bold text-[#8ab4f8]">{req.student_name.charAt(0).toUpperCase()}</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-medium text-[#e8eaed]">{req.student_name}</p>
                              <p className="text-[9px] text-[#9aa0a6]">Wants to rejoin the session</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {req.bcHandled ? (
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', req.bcHandled === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400')}>
                                BC {req.bcHandled === 'approved' ? '✓ Approved' : '✗ Denied'}
                              </span>
                            ) : (
                              <>
                                <button onClick={() => approveRejoin(req)} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition-colors">Allow</button>
                                <button onClick={() => denyRejoin(req)} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">Deny</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Extension Requests ── */}
                  {extensionRequests.length > 0 && (
                    <div className="border-b border-[#2d2e32]">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/6">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <svg className="h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span className="text-[11px] font-semibold text-blue-400">Extension Requests</span>
                        <span className="bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded-full px-1.5">{extensionRequests.length}</span>
                      </div>
                      {extensionRequests.map((req) => (
                        <div key={req.request_id} className="px-3 py-2.5 border-b border-[#2d2e32]/60 last:border-0 hover:bg-[#2d2e32]/40 transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-6 w-6 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">{req.student_name.charAt(0).toUpperCase()}</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-medium text-[#e8eaed]">{req.student_name}</p>
                              <p className="text-[9px] text-[#9aa0a6]">+{req.requested_minutes} min extension{req.fee_paise > 0 ? ` · ₹${(req.fee_paise / 100).toFixed(0)}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleExtensionAction(req, 'approve')} disabled={extensionActionLoading === req.request_id} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-50 transition-colors">{extensionActionLoading === req.request_id ? '…' : 'Approve'}</button>
                            <button onClick={() => handleExtensionAction(req, 'reject')} disabled={extensionActionLoading === req.request_id} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50 transition-colors">Deny</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── OC Join Requests ── */}
                  {isOcRoom && ocJoinRequests.length > 0 && (
                    <div className="border-b border-[#2d2e32]">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#8ab4f8]/6">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8ab4f8] animate-pulse" />
                          <svg className="h-3 w-3 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                          <span className="text-[11px] font-semibold text-[#8ab4f8]">Join Requests</span>
                          <span className="bg-[#4285f4]/20 text-[#8ab4f8] text-[9px] font-bold rounded-full px-1.5">{ocJoinRequests.length}</span>
                        </div>
                        <button onClick={() => ocJoinRequests.forEach(r => handleOcJoinAction(r.id, 'approve'))} className="text-[9px] text-emerald-400 hover:text-emerald-300 transition-colors">Approve all</button>
                      </div>
                      {ocJoinRequests.map((req) => (
                        <div key={req.id} className="px-3 py-2.5 border-b border-[#2d2e32]/60 last:border-0 hover:bg-[#2d2e32]/40 transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-6 w-6 rounded-full bg-[#4285f4]/15 flex items-center justify-center text-[10px] font-bold text-[#8ab4f8]">{req.name.charAt(0).toUpperCase()}</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-medium text-[#e8eaed]">{req.name}</p>
                              <p className="text-[9px] text-[#9aa0a6]">Wants to join the session</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleOcJoinAction(req.id, 'approve')} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition-colors">Approve</button>
                            <button onClick={() => handleOcJoinAction(req.id, 'deny')} className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">Deny</button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] text-[#9aa0a6]">Auto-approve new joiners</span>
                        <button onClick={toggleOcAutoApprove} className={cn('relative w-8 h-4.5 rounded-full transition-colors', ocAutoApprove ? 'bg-[#34a853]' : 'bg-[#5f6368]')}>
                          <span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all', ocAutoApprove ? 'left-4' : 'left-0.5')} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Empty state ── */}
                  {handCount + mediaRequests.length + leaveRequests.length + rejoinRequests.length + extensionRequests.length + (isOcRoom ? ocJoinRequests.length : 0) === 0 && (
                    <div className="flex flex-col items-center justify-center flex-1 py-12 text-center">
                      <div className="h-12 w-12 rounded-full bg-[#2d2e32] flex items-center justify-center mb-3">
                        <svg className="h-6 w-6 text-[#5f6368]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      </div>
                      <p className="text-xs font-medium text-[#9aa0a6]">All clear</p>
                      <p className="text-[10px] text-[#5f6368] mt-1">No pending approvals</p>
                    </div>
                  )}
                </div>
              ) : (
                /* AI Monitoring Panel */
                <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                  <div className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z"/><line x1="9" y1="22" x2="15" y2="22"/></svg>
                    AI Session Monitor
                  </div>

                  {/* Class engagement score + stats */}
                  {(() => {
                    const allStudents = Array.from(studentAttention.values());
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

                  {/* Per-student attention — sorted worst first */}
                  {Array.from(studentAttention.values())
                    .sort((a, b) => a.attentionScore - b.attentionScore)
                    .map((att) => {
                    const stateConfig: Record<string, { label: string; color: string }> = {
                      eyes_closed:    { label: 'Sleeping', color: 'text-red-400' },
                      tab_switched:   { label: 'Tab Switched', color: 'text-purple-400' },
                      in_exam:        { label: 'Taking Exam', color: 'text-teal-400' },
                      not_in_frame:   { label: 'Not in Frame', color: 'text-red-400' },
                      multiple_faces: { label: 'Multiple Faces', color: 'text-amber-400' },
                      head_turned:    { label: 'Not Looking', color: 'text-amber-400' },
                      looking_away:   { label: 'Looking Away', color: 'text-amber-400' },
                      yawning:        { label: 'Yawning', color: 'text-amber-400' },
                      inactive:       { label: 'Inactive', color: 'text-amber-400' },
                      distracted:     { label: 'Distracted', color: 'text-amber-400' },
                      low_engagement: { label: 'Low Engagement', color: 'text-amber-400' },
                      attentive:      { label: 'Attentive', color: 'text-green-400' },
                      // v3 positive/neutral states — NOT critical, NOT distracted
                      writing_notes:  { label: '📝 Writing', color: 'text-blue-400' },
                      brief_absence:  { label: 'Briefly Away', color: 'text-sky-400' },
                      low_visibility: { label: 'Low Visibility', color: 'text-slate-400' },
                      // v3.1 positive states
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
                      {/* Detail indicators row */}
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
                  );})}

                  {studentAttention.size === 0 && (
                    <div className="text-center py-8 text-xs text-[#9aa0a6]">
                      {isDemo
                        ? 'AI monitoring is not available for demo sessions.'
                        : 'Waiting for student attention data...'}
                    </div>
                  )}

                  {/* Server alerts */}
                  {monitoringAlerts.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide">Alerts</div>
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
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Full view request modal ── */}
      {fullviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[440px] max-w-[90vw] rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#3c4043]/50 bg-[#8ab4f8]/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8ab4f8]/20">
                  <svg className="h-5 w-5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 3h6v6" /><path d="m9 21H3v-6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#e8eaed]">Full View Request</h3>
                  <p className="text-[11px] text-[#9aa0a6]">
                    <strong>{fullviewRequest.student_name}</strong> wants to see your full camera view
                  </p>
                </div>
              </div>
              <button
                onClick={declineFullview}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Virtual Background option */}
            <div className="px-5 py-3">
              <button
                onClick={() => { setVbgPanelOpen(true); }}
                className="flex w-full items-center gap-3 rounded-xl bg-[#3c4043]/50 px-4 py-3 text-left hover:bg-[#3c4043] transition-colors"
              >
                <svg className="h-5 w-5 text-[#9aa0a6] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M12 13c-3 0-5 1.5-5 3v2h10v-2c0-1.5-2-3-5-3z" />
                </svg>
                <div>
                  <span className="text-xs font-medium text-[#e8eaed]">Set Virtual Background</span>
                  <span className="block text-[10px] text-[#9aa0a6]">
                    {vbgMode === 'disabled' ? 'None selected' : `Active: ${vbgMode}`}
                  </span>
                </div>
                <svg className="ml-auto h-4 w-4 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-[#3c4043]/50">
              <button
                onClick={declineFullview}
                className="flex-1 rounded-full bg-[#3c4043] py-2.5 text-sm font-medium text-[#e8eaed] hover:bg-[#5f6368] transition-colors"
              >
                Decline
              </button>
              <button
                onClick={acceptFullview}
                className="flex-1 rounded-full bg-[#8ab4f8] py-2.5 text-sm font-medium text-[#202124] hover:bg-[#aecbfa] transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Control Bar ─────────────────────────────────── */}
      <div className="relative">
        {vbgPanelOpen && (
          <VirtualBackgroundPanel
            activeMode={vbgMode}
            onSelect={handleVBGSelect}
            onClose={() => setVbgPanelOpen(false)}
            loading={vbgLoading}
          />
        )}

        {/* ── Exam Dialog (popup) ── */}
        {examFlow !== 'closed' && !isDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { if (examFlow !== 'generating') setExamFlow('closed'); }}>
            <div className={cn(
              'max-w-[92vw] max-h-[85vh] overflow-y-auto rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 fade-in duration-200',
              examFlow === 'preview' || examFlow === 'ready' ? 'w-[600px]' : 'w-[480px]',
            )} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#3c4043]/50 bg-indigo-500/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20">
                    <svg className="h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#e8eaed]">
                      {examFlow === 'generating' ? 'Generating Questions…' : examFlow === 'preview' ? 'Review Questions' : examFlow === 'ready' ? 'Exam Ready' : 'Start Exam'}
                    </h3>
                    <p className="text-[11px] text-[#9aa0a6]">{roomSubject} • Grade {roomGrade}</p>
                  </div>
                </div>
                {examFlow !== 'generating' && (
                  <button onClick={() => setExamFlow('closed')} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                )}
              </div>

              <div className="px-5 py-4 space-y-4">
                {examFlow === 'open' && (
                  <>
                    {/* Exam Type */}
                    <div>
                      <label className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider mb-2 block">Exam Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([['daily', 'Daily Test', '📝'], ['weekly', 'Weekly Test', '📋'], ['model', 'Model Exam', '🏆']] as const).map(([type, label, icon]) => (
                          <button
                            key={type}
                            onClick={() => setExamType(type)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-all',
                              examType === type
                                ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                                : 'border-[#3c4043] bg-[#292a2d] text-[#e8eaed] hover:border-indigo-500/50 hover:bg-indigo-500/5',
                            )}
                          >
                            <span className="text-xl">{icon}</span>
                            <span className="text-[11px]">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Source selection dropdown */}
                    <div>
                      <label className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider mb-1.5 block">Select Material</label>
                      <select
                        value={examSource || ''}
                        onChange={e => {
                          const v = e.target.value as typeof examSource;
                          setExamSource(v || null);
                          setSelectedTopicId('');
                          setSelectedMaterialId('');
                          setUploadFile(null);
                          setUploadTitle('');
                          setPageNumbers('');
                        }}
                        className="w-full rounded-lg bg-[#292a2d] border border-[#3c4043] text-xs text-[#e8eaed] px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="">Choose source…</option>
                        {sessionExamTopics.some(t => t.category === 'question_paper') && (
                          <option value="question_paper">📄 Question Paper</option>
                        )}
                        {sessionExamTopics.some(t => t.category === 'topic' || !t.category) && (
                          <option value="topic">📚 Topic / Chapter Document</option>
                        )}
                        {teachingMaterials.length > 0 && (
                          <option value="material">📖 Teaching Material</option>
                        )}
                        <option value="upload">📤 Upload New Document</option>
                      </select>
                    </div>

                    {/* Step 2: Pick specific item based on source */}
                    {examSource === 'question_paper' && (
                      <div>
                        <label className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider mb-1.5 block">📄 Select Question Paper</label>
                        <select
                          value={selectedTopicId}
                          onChange={e => setSelectedTopicId(e.target.value)}
                          className="w-full rounded-lg bg-[#292a2d] border border-[#3c4043] text-xs text-[#e8eaed] px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="">Select…</option>
                          {sessionExamTopics.filter(t => t.category === 'question_paper').map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.question_count} Q)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {examSource === 'topic' && (
                      <div>
                        <label className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider mb-1.5 block">📚 Select Topic / Chapter</label>
                        <select
                          value={selectedTopicId}
                          onChange={e => setSelectedTopicId(e.target.value)}
                          className="w-full rounded-lg bg-[#292a2d] border border-[#3c4043] text-xs text-[#e8eaed] px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="">Select…</option>
                          {sessionExamTopics.filter(t => t.category === 'topic' || !t.category).map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title} {t.chapter_name ? `— ${t.chapter_name}` : ''} ({t.question_count} Q)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {examSource === 'material' && (
                      <div>
                        <label className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider mb-1.5 block">📖 Select Teaching Material</label>
                        <select
                          value={selectedMaterialId}
                          onChange={e => setSelectedMaterialId(e.target.value)}
                          className="w-full rounded-lg bg-[#292a2d] border border-[#3c4043] text-xs text-[#e8eaed] px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="">Select…</option>
                          {teachingMaterials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.title} ({m.material_type})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {examSource === 'upload' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={uploadTitle}
                          onChange={e => setUploadTitle(e.target.value)}
                          placeholder="Title (optional)"
                          className="w-full rounded-lg bg-[#292a2d] border border-[#3c4043] text-xs text-[#e8eaed] px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder:text-[#5f6368]"
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="*/*"
                          onChange={e => setUploadFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs w-full transition-all',
                            uploadFile
                              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                              : 'border-[#3c4043] text-[#9aa0a6] hover:border-indigo-500/30 hover:text-[#e8eaed]',
                          )}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          {uploadFile ? uploadFile.name : 'Upload document (PDF, DOC, image)'}
                        </button>
                        <p className="text-[10px] text-[#9aa0a6]">Max file size: 50 MB. Office, PDF, image, and text formats supported.</p>
                      </div>
                    )}

                    {/* Generation settings — shown once a source item is selected */}
                    {examSource && (examSource === 'upload' ? uploadFile : examSource === 'material' ? selectedMaterialId : selectedTopicId) && (
                      <div className="space-y-2 rounded-lg bg-[#292a2d]/60 border border-[#3c4043]/50 p-3">
                        <label className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider block">Generation Settings</label>
                        <input
                          type="text"
                          value={pageNumbers}
                          onChange={e => setPageNumbers(e.target.value)}
                          placeholder="Page numbers (e.g. 1-3, 5, 7-9) — optional"
                          className="w-full rounded-lg bg-[#202124] border border-[#3c4043] text-xs text-[#e8eaed] px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder:text-[#5f6368]"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-[#9aa0a6] whitespace-nowrap">Questions:</label>
                          <input
                            type="number"
                            min={5}
                            max={50}
                            value={genCount}
                            onChange={e => setGenCount(Math.max(5, Math.min(50, Number(e.target.value) || 10)))}
                            className="w-20 rounded-lg bg-[#202124] border border-[#3c4043] text-xs text-center text-[#e8eaed] px-2 py-2 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[11px] text-[#5f6368]">(5–50)</span>
                        </div>
                      </div>
                    )}

                    {/* Generate button — always generate first */}
                    {examSource && (examSource === 'upload' ? uploadFile : examSource === 'material' ? selectedMaterialId : selectedTopicId) && (
                      <button
                        disabled={isGeneratingExam}
                        onClick={() => {
                          if (isGeneratingExam) return;
                          if (examSource === 'upload') handleUploadAndGenerate();
                          else if (examSource === 'material') handleGenerateFromMaterial();
                          else if (selectedTopicId) handleGenerateExisting(selectedTopicId);
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-400 active:scale-95 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        {isGeneratingExam ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" strokeOpacity={0.3}/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                            Preparing…
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z"/><line x1="9" y1="22" x2="15" y2="22"/></svg>
                            Generate Questions
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}

                {examFlow === 'generating' && (() => {
                  const stages = ['Extracting text', 'Analyzing content', 'Generating questions', 'Validating answers', 'Finalizing'];
                  const progress = genProgress.toLowerCase();
                  let activeIdx = 0;
                  if (progress.includes('analyz')) activeIdx = 1;
                  else if (progress.includes('generat')) activeIdx = 2;
                  else if (progress.includes('validat')) activeIdx = 3;
                  else if (progress.includes('final')) activeIdx = 4;
                  const pct = Math.min(((activeIdx + 0.5) / stages.length) * 100, 95);
                  const mm = Math.floor(genElapsed / 60);
                  const ss = genElapsed % 60;
                  return (
                    <div className="py-4 space-y-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/buji/4 second thinking.gif" alt="Thinking" width={80} className="mx-auto" style={{ objectFit: 'contain' }} />
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[#e8eaed]">Generating Questions…</p>
                        <span className="text-xs font-mono text-teal-400">{mm}:{ss.toString().padStart(2, '0')}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-linear-to-r from-teal-500 to-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between">
                        {stages.map((s, i) => (
                          <div key={s} className="flex flex-col items-center gap-1">
                            <div className={`h-2.5 w-2.5 rounded-full transition-colors ${
                              i < activeIdx ? 'bg-teal-400' : i === activeIdx ? 'bg-teal-400 animate-pulse' : 'bg-white/20'
                            }`} />
                            <span className={`text-[9px] leading-tight text-center max-w-[52px] ${
                              i <= activeIdx ? 'text-teal-300' : 'text-[#5f6368]'
                            }`}>{s}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-[#5f6368] text-center">AI is crafting {genCount} questions. Please wait.</p>
                    </div>
                  );
                })()}

                {(examFlow === 'preview' || examFlow === 'ready') && (() => {
                  const topicInfo = sessionExamTopics.find(t => t.id === selectedTopicId);
                  const questions = previewQuestions;
                  return (
                    <div className="space-y-3">
                      {/* Topic header */}
                      <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 px-4 py-3">
                        <p className="text-sm font-semibold text-teal-300">
                          {topicInfo?.title || 'Questions ready'}
                        </p>
                        <p className="text-xs text-[#9aa0a6] mt-1">
                          {questions.length || topicInfo?.question_count || '?'} questions
                          {examType && (<> • {examType === 'daily' ? '📝 Daily' : examType === 'weekly' ? '📋 Weekly' : '🏆 Model'}</>)}
                        </p>
                      </div>

                      {/* Question paper preview */}
                      {questions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider">Question Paper Preview</h4>
                            <span className="text-[10px] text-[#5f6368]">{questions.reduce((s, q) => s + (q.marks || 1), 0)} marks total</span>
                          </div>
                          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                            {questions.map((q, idx) => (
                              <div key={q.id || idx} className={cn('rounded-lg bg-[#292a2d] border border-[#3c4043]/50 p-3', regeneratingQId === q.id && 'opacity-50 pointer-events-none')}>
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-300 shrink-0 mt-0.5">{idx + 1}</span>
                                  <p className="text-xs text-[#e8eaed] leading-relaxed flex-1">{q.question_text}</p>
                                  <span className="text-[9px] text-[#5f6368] shrink-0">{q.marks}m</span>
                                  <button
                                    onClick={() => handleRegenerateQuestion(q.id)}
                                    disabled={!!regeneratingQId}
                                    title="Regenerate this question"
                                    className="shrink-0 rounded-md p-1 text-[#9aa0a6] hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                                  >
                                    {regeneratingQId === q.id ? (
                                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>
                                    ) : (
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6" /><path d="M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                                    )}
                                  </button>
                                </div>
                                {q.image_url && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={q.image_url} alt="" className="max-h-28 rounded-md mb-2 ml-7" />
                                )}
                                <div className="grid grid-cols-2 gap-1.5 ml-7">
                                  {(q.options as string[]).map((opt, oi) => (
                                    <div
                                      key={oi}
                                      className={cn(
                                        'rounded-md px-2.5 py-1.5 text-[11px] border',
                                        oi === q.correct_answer
                                          ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300'
                                          : 'border-[#3c4043]/50 bg-[#202124] text-[#9aa0a6]',
                                      )}
                                    >
                                      <span className="font-semibold mr-1">{String.fromCharCode(65 + oi)}.</span>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setExamFlow('open'); setSelectedTopicId(''); setExamSource(null); setPreviewQuestions([]); }}
                          className="flex items-center gap-1.5 rounded-lg border border-[#3c4043] px-4 py-2.5 text-xs font-medium text-[#9aa0a6] hover:border-[#5f6368] hover:text-[#e8eaed] transition-all"
                        >
                          ← Change
                        </button>
                        <button
                          onClick={() => handleStartSessionExam()}
                          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-400 active:scale-95 shadow-lg shadow-teal-900/20 transition-all"
                        >
                          ✓ Approve &amp; Start Exam
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── BC whisper alert banner ─────────────────────────── */}
        {bcWhisperActive && (
          <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-[#1a2e1e]/95 px-5 py-3 shadow-2xl backdrop-blur-sm">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-emerald-300">{bcWhisperName} is talking to you</span>
              <span className="text-[10px] text-emerald-400/70">Private message — only you can hear this</span>
            </div>
          </div>
        )}

        <ControlBar
          role="teacher"
          roomId={roomId}
          isLive={isLive}
          whiteboardActive={whiteboardActive}
          onToggleWhiteboard={() => setWhiteboardActive(!whiteboardActive)}
          onEndClass={onEndClass}
          scheduledStart={scheduledStart}
          goLiveAt={goLiveAt}
          durationMinutes={durationMinutes}
          vbgSupported={vbgSupported}
          vbgActive={vbgMode !== 'disabled'}
          onToggleVBG={() => setVbgPanelOpen(!vbgPanelOpen)}
          cutoutActive={cutoutActive}
          onToggleCutout={handleToggleCutout}
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          recordingLoading={recordingLoading}
          allowRecording={allowRecording}
          examActive={examFlow !== 'closed'}
          onToggleExam={() => setExamFlow(examFlow === 'closed' ? 'open' : 'closed')}
        />

        {showRecordingPrompt && allowRecording && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
                  <svg className="h-7 w-7 text-red-400" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>
                </span>
              </div>
              <h3 className="text-center text-lg font-semibold text-[#e8eaed]">Start YouTube Recording?</h3>
              <p className="mt-2 text-center text-sm text-[#9aa0a6]">
                This class is live. Would you like to start recording now?
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { recordingPromptShownRef.current = true; setShowRecordingPrompt(false); }}
                  className="flex-1 rounded-lg border border-[#3c4043] px-4 py-2.5 text-sm font-medium text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed] transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    setShowRecordingPrompt(false);
                    if (!isRecording) await handleToggleRecording();
                  }}
                  disabled={recordingLoading}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {recordingLoading ? 'Starting...' : 'Start Recording'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Session Materials floating overlay ─────────────── */}
      {showMaterialsOverlay && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-14 pointer-events-none">
          <div
            className="pointer-events-auto w-80 max-h-[calc(100vh-5rem)] rounded-2xl bg-[#202124] border border-[#3c4043] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#8ab4f8]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Session Materials
              </div>
              <button
                onClick={() => setShowMaterialsOverlay(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed] transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <SessionMaterialsPanel
                sessionId={roomSessionId ?? null}
                teacherEmail={localParticipant.identity || ''}
                onMaterialsChange={(count) => setMaterialsCount(count)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper sub-component ─────────────────────────────────

/** Status indicator dot + label for the Go Live banner */
function StatusDot({
  active,
  label,
  pendingLabel,
  icon,
}: {
  active: boolean;
  label: string;
  pendingLabel?: string;
  icon?: 'laptop' | 'tablet';
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          active ? 'bg-[#34a853] animate-pulse' : 'bg-[#5f6368]',
        )}
      />
      {icon === 'laptop' ? (
        <svg className="h-3.5 w-3.5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
      ) : icon === 'tablet' ? (
        <svg className="h-3.5 w-3.5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      ) : null}
      <span className={active ? 'text-[#e8eaed]' : 'text-[#9aa0a6]'}>
        {active ? label : (pendingLabel ?? label)}
      </span>
    </span>
  );
}
