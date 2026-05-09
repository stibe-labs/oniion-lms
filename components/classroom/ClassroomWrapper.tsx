'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
} from '@livekit/components-react';
import { Room, RoomEvent, DisconnectReason, VideoPresets, ScreenSharePresets } from 'livekit-client';
import { useRouter } from 'next/navigation';
import TeacherView from './TeacherView';
import StudentView from './StudentView';
import GhostView from './GhostView';
import CoordinatorLiveView from './CoordinatorLiveView';
import ScreenDeviceView from './ScreenDeviceView';
import AgentDemoView from './AgentDemoView';

/**
 * ClassroomWrapper — Main LiveKit room provider + role-based view router.
 *
 * Reads session data from sessionStorage (set during join flow):
 *   - lk_token: LiveKit access token
 *   - lk_url: LiveKit WebSocket URL
 *   - room_id: Room identifier
 *   - room_name: Display name
 *   - participant_name: User display name
 *   - participant_role: Portal role
 *
 * Mounts <LiveKitRoom> with the token, then renders
 * TeacherView / StudentView / GhostView based on role.
 */

export interface ClassroomWrapperProps {
  roomId: string;
}

// Ghost roles that use the GhostView
const GHOST_ROLES = ['ghost', 'owner', 'academic_operator', 'academic', 'parent'];

export default function ClassroomWrapper({ roomId }: ClassroomWrapperProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [scheduledStart, setScheduledStart] = useState<string>('');
  const [liveStartedAt, setLiveStartedAt] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [device, setDevice] = useState<string>('primary');
  const [roomStatus, setRoomStatus] = useState<string>('scheduled');
  const [isRejoin, setIsRejoin] = useState<boolean>(false);
  const [topic, setTopic] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [room] = useState(() => {
    // Read role early from sessionStorage so we can tune quality per role.
    // Teachers/BCs publish high quality (their stream goes to many viewers).
    // Students/parents are small tiles on the teacher side — low quality is fine
    // and saves critical WiFi upload bandwidth when many are on the same network.
    const earlyRole = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('participant_role') : null) ?? '';
    const isPublisher = earlyRole === 'teacher' || earlyRole === 'batch_coordinator' || earlyRole === 'academic_operator';
    return new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        // Teachers capture at 720p (good quality, visible to all students).
        // Students capture at 540p — appears as small tiles on teacher's screen;
        // 540p with 480p effective quality is sufficient and saves upload bandwidth.
        resolution: isPublisher ? VideoPresets.h720.resolution : VideoPresets.h540.resolution,
      },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: isPublisher
          // Teacher: 3 quality tiers — LOW(180p) for slow networks, MEDIUM(540p≈480p)
          // as default student subscription, HIGH(720p) for manual selection only.
          ? [VideoPresets.h180, VideoPresets.h540, VideoPresets.h720]
          // Student: 2 tiers — LOW(180p) and MEDIUM(540p); teacher sees student
          // tiles at low-to-medium quality which is sufficient for small PIP tiles.
          : [VideoPresets.h180, VideoPresets.h540],
        // VP8 for maximum browser compatibility
        videoCodec: 'vp8',
        // Screen share: 720p @ 15fps (1.5 Mbps) — reduced from 1080p (2.5 Mbps)
        // to lower bandwidth while keeping whiteboard/text sharp enough.
        screenShareEncoding: ScreenSharePresets.h720fps15.encoding,
        screenShareSimulcastLayers: [],
      },
    });
  });

  // Read session data on mount
  useEffect(() => {
    try {
      let lkToken = sessionStorage.getItem('lk_token');
      let lkUrl = sessionStorage.getItem('lk_url');
      let storedRoomName = sessionStorage.getItem('room_name');
      let storedRole = sessionStorage.getItem('participant_role');
      let storedName = sessionStorage.getItem('participant_name');
      let storedScheduledStart = sessionStorage.getItem('scheduled_start');
      let storedDuration = sessionStorage.getItem('duration_minutes');
      let storedDevice = sessionStorage.getItem('device');

      // Dev mode bridge: check localStorage if sessionStorage is empty
      if (!lkToken && localStorage.getItem('dev_bridge_ready')) {
        lkToken = localStorage.getItem('dev_lk_token');
        lkUrl = localStorage.getItem('dev_lk_url');
        storedRoomName = localStorage.getItem('dev_room_name');
        storedRole = localStorage.getItem('dev_participant_role');
        storedName = localStorage.getItem('dev_participant_name');
        storedScheduledStart = localStorage.getItem('dev_scheduled_start');
        storedDuration = localStorage.getItem('dev_duration_minutes');
        const devRoomStatus = localStorage.getItem('dev_room_status');

        // Copy to sessionStorage and clear localStorage bridge
        if (lkToken) {
          sessionStorage.setItem('lk_token', lkToken);
          sessionStorage.setItem('lk_url', lkUrl || '');
          sessionStorage.setItem('room_name', storedRoomName || '');
          sessionStorage.setItem('participant_role', storedRole || '');
          sessionStorage.setItem('participant_name', storedName || '');
          sessionStorage.setItem('scheduled_start', storedScheduledStart || '');
          sessionStorage.setItem('duration_minutes', storedDuration || '60');
          sessionStorage.setItem('room_status', devRoomStatus || 'scheduled');
        }
        // Clear bridge data
        localStorage.removeItem('dev_lk_token');
        localStorage.removeItem('dev_lk_url');
        localStorage.removeItem('dev_room_name');
        localStorage.removeItem('dev_participant_role');
        localStorage.removeItem('dev_participant_name');
        localStorage.removeItem('dev_scheduled_start');
        localStorage.removeItem('dev_duration_minutes');
        localStorage.removeItem('dev_room_status');
        localStorage.removeItem('dev_bridge_ready');
      }

      if (!lkToken || !lkUrl) {
        // ── Email link fallback ─────────────────────────────────────
        // Session-reminder emails embed a LiveKit JWT in the URL:
        //   /classroom/[sessionId]?token=<LK_JWT>&ws=<ws_url>
        // When clicked, sessionStorage is empty — read from URL params and
        // decode the JWT payload to get participant name + role.
        try {
          const sp = new URLSearchParams(window.location.search);
          const urlToken = sp.get('token');
          const urlWs = sp.get('ws');
          if (urlToken && urlWs) {
            const parts = urlToken.split('.');
            if (parts.length === 3) {
              // base64url decode the JWT payload
              const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
              const meta = payload.metadata
                ? (typeof payload.metadata === 'string'
                    ? (JSON.parse(payload.metadata) as Record<string, unknown>)
                    : (payload.metadata as Record<string, unknown>))
                : {};
              lkToken = urlToken;
              lkUrl = decodeURIComponent(urlWs);
              storedName = (payload.name as string) || (payload.sub as string) || 'Participant';
              storedRole = (meta.portal_role as string) || 'student';
              storedScheduledStart = new Date().toISOString();
              storedDuration = '90';
              // Store in sessionStorage so page refreshes still work
              sessionStorage.setItem('lk_token', lkToken);
              sessionStorage.setItem('lk_url', lkUrl);
              sessionStorage.setItem('room_name', roomId);
              sessionStorage.setItem('participant_name', storedName);
              sessionStorage.setItem('participant_role', storedRole);
              sessionStorage.setItem('scheduled_start', storedScheduledStart);
              sessionStorage.setItem('duration_minutes', storedDuration);
              // Don't hardcode 'live' — will verify actual status below
              sessionStorage.setItem('room_status', 'scheduled');
            }
          }
        } catch {
          // JWT decode failed — fall through to error state
        }
      }

      if (!lkToken || !lkUrl) {
        // Auto-rejoin: fetch a fresh token instead of showing an error.
        // Handles: new tab, page refresh, sessionStorage cleared, direct URL navigation.
        // The loading spinner shows while token is null.
        (async () => {
          try {
            if (roomId.startsWith('oc_')) {
              // ── Open Classroom: no account needed ──
              // Look up the public join_token from room_id, then redirect to join page.
              const res = await fetch(`/api/v1/open-classroom/room/${roomId}`);
              const data = await res.json();
              if (res.ok && data.success && data.data?.join_token) {
                router.push(`/open-classroom/${data.data.join_token}`);
              } else {
                // Room ended or not found
                router.push('/');
              }
            } else {
              // ── Batch Classroom: use cookie auth ──
              const res = await fetch('/api/v1/room/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id: roomId }),
              });
              const data = await res.json();
              if (res.ok && data.success && data.data?.livekit_token) {
                const result = data.data as Record<string, unknown>;
                // Populate sessionStorage so refreshes also work
                sessionStorage.setItem('lk_token', result.livekit_token as string);
                sessionStorage.setItem('lk_url', (result.livekit_url as string) || '');
                sessionStorage.setItem('room_name', (result.room_name as string) || roomId);
                sessionStorage.setItem('participant_role', (result.role as string) || 'student');
                sessionStorage.setItem('participant_name', (result.participant_name as string) || '');
                sessionStorage.setItem('participant_email', (result.participant_email as string) || '');
                sessionStorage.setItem('scheduled_start', (result.scheduled_start as string) || new Date().toISOString());
                sessionStorage.setItem('duration_minutes', String(result.duration_minutes ?? 60));
                sessionStorage.setItem('device', (result.device as string) || 'primary');
                sessionStorage.setItem('room_status', (result.room_status as string) || 'scheduled');
                sessionStorage.setItem('is_rejoin', result.is_rejoin ? 'true' : 'false');
                sessionStorage.setItem('topic', (result.topic as string) || '');
                // Apply to component state
                setToken(result.livekit_token as string);
                setLivekitUrl((result.livekit_url as string) || '');
                setRoomName((result.room_name as string) || roomId);
                setRole((result.role as string) || 'student');
                setParticipantName((result.participant_name as string) || 'Participant');
                setScheduledStart((result.scheduled_start as string) || new Date().toISOString());
                const dur = parseInt(String(result.duration_minutes ?? 60), 10);
                setDurationMinutes(isNaN(dur) ? 60 : dur);
                setDevice((result.device as string) || 'primary');
                setRoomStatus((result.room_status as string) || 'scheduled');
                setIsRejoin(!!result.is_rejoin);
                setTopic((result.topic as string) || '');
              } else {
                // Not logged in, room not live, or other error — send to join page
                router.push(`/join/${roomId}`);
              }
            }
          } catch {
            router.push(roomId.startsWith('oc_') ? '/' : `/join/${roomId}`);
          }
        })();
        return;
      }

      // ── Verify room status from server (authoritative) then proceed ──
      // Always check the server first. Client-side time check alone is not reliable
      // because sessions can run overtime. Only block if server confirms 'ended'.
      const resolvedRole = storedRole || 'student';

      (async () => {
        // For all roles: fetch server status to check if ended (and update cached status)
        let serverStatus: string | null = null;
        let goLiveAt: string | null = null;
        try {
          const statusRes = await fetch(`/api/v1/room/${roomId}`);
          const statusData = await statusRes.json();
          if (statusData.success && statusData.data?.status) {
            serverStatus = statusData.data.status as string;
            sessionStorage.setItem('room_status', serverStatus);
          }
          if (statusData.success && statusData.data?.go_live_at) {
            goLiveAt = statusData.data.go_live_at as string;
          }
        } catch {
          // Non-critical — fall through to client-side check
        }

        if (serverStatus === 'ended' || serverStatus === 'cancelled') {
          setError('This session has ended. The join link is no longer valid.');
          return;
        }

        // ── Fallback: client-side time check (only when server is unreachable) ──
        if (serverStatus === null) {
          const parsedStart = new Date(storedScheduledStart || '').getTime();
          const rawDuration = parseInt(storedDuration || '60', 10);
          const parsedDuration = isNaN(rawDuration) ? 60 : rawDuration; // 0 = unlimited
          if (!isNaN(parsedStart) && parsedDuration > 0) {
            const sessionEndTime = parsedStart + parsedDuration * 60 * 1000;
            if (Date.now() > sessionEndTime) {
              setError('This session has ended. The join link is no longer valid.');
              return;
            }
          }
        }

        setToken(lkToken!);
        setLivekitUrl(lkUrl!);
        setRoomName(storedRoomName || roomId);
        setRole(resolvedRole);
        setParticipantName(storedName || 'Participant');
        setScheduledStart(storedScheduledStart || new Date().toISOString());
        const durationVal = parseInt(storedDuration || '60', 10);
        setDurationMinutes(isNaN(durationVal) ? 60 : durationVal); // 0 = unlimited
        setDevice(storedDevice || 'primary');
        setRoomStatus(sessionStorage.getItem('room_status') || 'scheduled');
        setIsRejoin(sessionStorage.getItem('is_rejoin') === 'true');
        setTopic(sessionStorage.getItem('topic') || '');
        if (goLiveAt) setLiveStartedAt(goLiveAt);
      })();
    } catch {
      setError('Failed to read session data.');
    }
  }, [roomId]);

  // Guard: set to true when handleLeave fires, prevents handleDisconnected from double-navigating
  const leftRef = useRef(false);

  // Handle room disconnection — only redirect for intentional/server-side disconnects
  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      console.log('[ClassroomWrapper] Disconnected, reason:', reason);

      // Reasons that should redirect to the "ended" page:
      // CLIENT_INITIATED = user clicked leave / teacher ended class
      // SERVER_SHUTDOWN = LiveKit server stopped the room
      // ROOM_DELETED = room was destroyed server-side
      // PARTICIPANT_REMOVED = kicked from room
      const endReasons: (DisconnectReason | undefined)[] = [
        DisconnectReason.CLIENT_INITIATED,
        DisconnectReason.SERVER_SHUTDOWN,
        DisconnectReason.ROOM_DELETED,
        DisconnectReason.PARTICIPANT_REMOVED,
      ];

      if (endReasons.includes(reason)) {
        // Skip if handleLeave already navigated (prevents double navigation)
        if (leftRef.current) return;
        router.push(`/classroom/${roomId}/ended`);
        return;
      }

      // For unexpected disconnects (UNKNOWN, SIGNAL_DISCONNECTED, undefined, etc.)
      // Check room status in DB — if room is ended, redirect instead of waiting for reconnect.
      console.warn('[ClassroomWrapper] Unexpected disconnect — checking room status. Reason:', reason);
      (async () => {
        try {
          const res = await fetch(`/api/v1/room/${roomId}`);
          const data = await res.json();
          if (data.success && data.data?.status === 'ended') {
            console.log('[ClassroomWrapper] Room is ended in DB — redirecting');
            if (!leftRef.current) router.push(`/classroom/${roomId}/ended`);
          }
          // If room is still live/scheduled, let LiveKit SDK attempt reconnection
        } catch {
          // Network error — let reconnection continue
        }
      })();
    },
    [router, roomId]
  );

  // Handle end class (teacher) — ControlBar already called DELETE API, just disconnect + navigate
  const handleEndClass = useCallback(async () => {
    room.disconnect();
    router.push(`/classroom/${roomId}/ended`);
  }, [room, router, roomId]);

  // Handle leave (student) — navigate directly, suppress the onDisconnected handler
  const handleLeave = useCallback(() => {
    if (leftRef.current) return; // prevent double-fire
    leftRef.current = true;
    router.push(`/classroom/${roomId}/ended`);
    room.disconnect();
  }, [room, router, roomId]);

  // Handle time expired — show overtime indicator only, NO auto-disconnect.
  // Sessions stay live until teacher manually clicks "End Class".
  const timeExpiredFired = useRef(false);
  const selectiveEndDone = useRef(false);
  const handleTimeExpired = useCallback(async () => {
    if (timeExpiredFired.current) return;

    // ── Teacher: check for active extensions before selective-end ──
    // If extensions exist, kick non-extension students but keep the session alive.
    if (role === 'teacher' && !selectiveEndDone.current) {
      try {
        const res = await fetch(`/api/v1/room/${roomId}`);
        const data = await res.json();
        const origDuration = data.data?.original_duration_minutes;
        const newDuration = data.data?.duration_minutes;
        if (origDuration && newDuration && newDuration > origDuration) {
          // Extensions active — selective end: kick non-extension students
          selectiveEndDone.current = true;
          console.log(`[ClassroomWrapper] Extensions active — selective end (${origDuration} → ${newDuration} min)`);
          fetch(`/api/v1/room/${roomId}/selective-end`, { method: 'POST' }).catch(err =>
            console.error('[ClassroomWrapper] Selective end failed:', err)
          );
          // Update local timer to the extended duration
          setDurationMinutes(newDuration);
          sessionStorage.setItem('duration_minutes', String(newDuration));
          return; // useEffect will reschedule timer with new durationMinutes
        }
      } catch (err) {
        console.error('[ClassroomWrapper] Extension check failed:', err);
      }
    }

    // ── Time expired — log but do NOT auto-disconnect ──
    // Teacher must manually end the session via "End Class" button.
    timeExpiredFired.current = true;
    console.log('[ClassroomWrapper] Scheduled time expired — session continues until manual end');
  }, [room, router, roomId, role]);

  // ── Callback for child views to update duration when extension is approved ──
  const handleDurationUpdate = useCallback((newDurationMinutes: number) => {
    console.log(`[ClassroomWrapper] Duration updated: ${durationMinutes} → ${newDurationMinutes}`);
    setDurationMinutes(newDurationMinutes);
    sessionStorage.setItem('duration_minutes', String(newDurationMinutes));
  }, [durationMinutes]);

  // Overtime detection: fire handleTimeExpired once when scheduled time passes.
  // This only sets the overtime flag — does NOT auto-disconnect or end the session.
  useEffect(() => {
    if (!scheduledStart || !durationMinutes) return;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return;
    const endTime = start + durationMinutes * 60 * 1000;
    const msUntilEnd = endTime - Date.now();

    // If already past end time, fire immediately (sets overtime flag only)
    if (msUntilEnd <= 0) {
      handleTimeExpired();
      return;
    }

    // Schedule overtime flag at exact end time (no disconnect)
    const timer = setTimeout(() => {
      handleTimeExpired();
    }, msUntilEnd);

    return () => clearTimeout(timer);
  }, [scheduledStart, durationMinutes, handleTimeExpired]);

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{error}</h2>
          <button
            onClick={() => router.push(`/join/${roomId}`)}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Rejoin Batch
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!token || !livekitUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Connecting to classroom...</p>
        </div>
      </div>
    );
  }

  const isGhost = GHOST_ROLES.includes(role);
  const isScreenDevice = device === 'screen';
  // navigator.mediaDevices is undefined on insecure (HTTP) contexts
  const isSecure = typeof window !== 'undefined' && (window.isSecureContext ?? location.protocol === 'https:');

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      room={room}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={handleDisconnected}
      onError={(err) => {
        console.error('[LiveKitRoom] Error:', err);
        // Don't disconnect/error for permission-denied — user just needs to click mic button
        if (err?.message?.includes('Permission denied') || err?.message?.includes('NotAllowedError')) {
          console.warn('[ClassroomWrapper] Media permission denied — user can enable mic/camera manually');
          return;
        }
        // Don't show fatal error for getUserMedia failures on HTTP
        if (err?.message?.includes('getUserMedia') || err?.message?.includes('mediaDevices')) {
          console.warn('[ClassroomWrapper] Media not available (HTTP context) — continuing without local tracks');
          return;
        }
        // Don't show fatal error for client-initiated disconnects
        if (err?.message?.includes('Client initiated disconnect')) return;
        setError(`Connection error: ${err.message}`);
      }}
      className="h-screen"
    >
      {/* HTTP warning banner */}
      {!isSecure && !isGhost && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 px-3 py-1.5 text-center text-xs font-medium text-white">
          ⚠ HTTP mode — camera/mic unavailable. Use <strong>https://</strong> or <strong>localhost</strong> for full media.
        </div>
      )}

      {/* Role-based view */}
      {isScreenDevice ? (
        <ScreenDeviceView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
        />
      ) : role === 'teacher' ? (
        <TeacherView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
          scheduledStart={scheduledStart}
          durationMinutes={durationMinutes}
          roomStatus={roomStatus}
          topic={topic}
          onEndClass={handleEndClass}
          onTimeExpired={handleTimeExpired}
          onDurationUpdate={handleDurationUpdate}
        />
      ) : role === 'batch_coordinator' ? (
        <CoordinatorLiveView
          roomId={roomId}
          roomName={roomName}
          observerName={participantName}
          scheduledStart={scheduledStart}
          liveStartedAt={liveStartedAt}
          durationMinutes={durationMinutes}
          topic={topic}
          onLeave={handleLeave}
        />
      ) : role === 'demo_agent' ? (
        <AgentDemoView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
          scheduledStart={scheduledStart}
          durationMinutes={durationMinutes}
          onLeave={handleLeave}
        />
      ) : role === 'parent' ? (
        <StudentView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
          scheduledStart={scheduledStart}
          durationMinutes={durationMinutes}
          topic={topic}
          isRejoin={isRejoin}
          observeOnly={true}
          onLeave={handleLeave}
          onTimeExpired={handleTimeExpired}
          onDurationUpdate={handleDurationUpdate}
        />
      ) : isGhost ? (
        <GhostView
          roomId={roomId}
          roomName={roomName}
          observerName={participantName}
          observerRole={role}
          scheduledStart={scheduledStart}
          liveStartedAt={liveStartedAt}
          durationMinutes={durationMinutes}
          topic={topic}
          onLeave={handleLeave}
        />
      ) : (
        <StudentView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
          scheduledStart={scheduledStart}
          durationMinutes={durationMinutes}
          topic={topic}
          isRejoin={isRejoin}
          onLeave={handleLeave}
          onTimeExpired={handleTimeExpired}
          onDurationUpdate={handleDurationUpdate}
        />
      )}
    </LiveKitRoom>
  );
}
