'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { cn } from '@/lib/utils';
import {
  MicOnIcon, MicOffIcon,
  CameraOnIcon, CameraOffIcon,
  ScreenShareIcon, ScreenShareOffIcon,
  WhiteboardIcon,
  HandRaiseIcon,
  ChatIcon,
  EndCallIcon,
  LeaveIcon,
  VirtualBgIcon,
  RecordIcon,
} from './icons';

/**
 * ControlBar — classroom media controls (Google Meet style).
 * Teacher: mic, camera, screen share, whiteboard toggle, chat, end class.
 * Student: mic, camera, hand raise, chat toggle, leave.
 * Ghost: no controls (read-only observe).
 */

export interface ControlBarProps {
  role: 'teacher' | 'student' | 'ghost';
  roomId: string;
  isLive?: boolean;
  whiteboardActive?: boolean;
  onToggleWhiteboard?: () => void;
  onToggleChat?: () => void;
  handRaised?: boolean;
  onToggleHandRaise?: () => void;
  onEndClass?: () => void;
  onLeave?: () => void;
  className?: string;
  scheduledStart?: string;
  goLiveAt?: string | null;
  durationMinutes?: number;
  vbgSupported?: boolean;
  vbgActive?: boolean;
  onToggleVBG?: () => void;
  cutoutActive?: boolean;
  onToggleCutout?: () => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  recordingLoading?: boolean;
  allowRecording?: boolean;
  examActive?: boolean;
  onToggleExam?: () => void;
}

export default function ControlBar({
  role,
  roomId,
  isLive = true,
  whiteboardActive = false,
  onToggleWhiteboard,
  onToggleChat,
  handRaised = false,
  onToggleHandRaise,
  onEndClass,
  onLeave,
  className,
  scheduledStart,
  goLiveAt,
  durationMinutes,
  vbgSupported = false,
  vbgActive = false,
  onToggleVBG,
  cutoutActive = false,
  onToggleCutout,
  isRecording = false,
  onToggleRecording,
  recordingLoading = false,
  allowRecording = true,
  examActive = false,
  onToggleExam,
}: ControlBarProps) {
  const { localParticipant } = useLocalParticipant();
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState('');

  // ── Early end approval state ──
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [earlyEndReason, setEarlyEndReason] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forceEndTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canEndDirectly, setCanEndDirectly] = useState(false);

  // Fetch teacher controls on mount to check end-class permission
  useEffect(() => {
    if (role !== 'teacher') return;
    (async () => {
      try {
        const res = await fetch('/api/v1/teacher-controls');
        const data = await res.json();
        if (data.success && data.data?.end_class_skip_coordinator) {
          setCanEndDirectly(true);
        }
      } catch { /* fallback to normal flow */ }
    })();
  }, [role]);

  // Cancel a pending end-class request on the server
  const cancelEndRequest = useCallback(() => {
    fetch(`/api/v1/room/${roomId}/end-request`, { method: 'DELETE' }).catch(() => {});
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (forceEndTimeout.current) { clearTimeout(forceEndTimeout.current); forceEndTimeout.current = null; }
    setApprovalPending(false);
    setApprovalStatus('none');
    setEndError('');
  }, [roomId]);

  if (role === 'ghost') return null;

  // ── Determine if ending early (based on goLiveAt + duration, same as HeaderBar timer) ──
  const isBeforeScheduledEnd = useCallback(() => {
    if (!durationMinutes) return false;
    // Use goLiveAt as the authoritative start (same logic as HeaderBar)
    const startStr = goLiveAt || scheduledStart;
    if (!startStr) return false;
    const start = new Date(startStr).getTime();
    if (isNaN(start)) return false;
    const endTime = start + durationMinutes * 60 * 1000;
    return Date.now() < endTime;
  }, [goLiveAt, scheduledStart, durationMinutes]);

  // Poll for approval status
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (forceEndTimeout.current) clearTimeout(forceEndTimeout.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/end-request`);
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.data?.status;
        if (status === 'approved') {
          setApprovalStatus('approved');
          setApprovalPending(false);
          if (pollRef.current) clearInterval(pollRef.current);
          // Class was ended by coordinator approval — just navigate
          onEndClass?.();
        } else if (status === 'denied') {
          setApprovalStatus('denied');
          setApprovalPending(false);
          if (pollRef.current) clearInterval(pollRef.current);
          setEndError(data?.data?.reason || 'Coordinator denied your end-class request');
        }
      } catch {}
    }, 5000);
  }, [roomId, onEndClass]);

  const handleEndClass = async () => {
    setIsEnding(true);
    setEndError('');

    // Demo rooms and open classrooms: teacher can end directly — no coordinator approval needed
    const isDemoRoom = roomId.startsWith('demo_');
    const isOpenClassroom = roomId.startsWith('oc_');

    // If before scheduled end AND not a demo/open classroom AND no direct-end permission → request coordinator approval
    if (isBeforeScheduledEnd() && !isDemoRoom && !isOpenClassroom && !canEndDirectly) {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/end-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: earlyEndReason }),
        });
        if (res.ok || res.status === 409) {
          // 409 = already pending
          setApprovalPending(true);
          setApprovalStatus('pending');
          startPolling();
          // Allow force-end after 3 minutes
          forceEndTimeout.current = setTimeout(() => {
            cancelEndRequest();
          }, 3 * 60 * 1000);
        } else {
          const data = await res.json().catch(() => null);
          setEndError(data?.error || 'Failed to request end-class approval');
        }
      } catch {
        setEndError('Network error — please try again');
      } finally {
        setIsEnding(false);
      }
      return;
    }

    // Time expired → end directly
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        onEndClass?.();
      } else {
        const data = await res.json().catch(() => null);
        setEndError(data?.error || 'Failed to end session — please try again');
      }
    } catch {
      setEndError('Network error — please try again');
    } finally {
      setIsEnding(false);
    }
  };

  // Force end — used after 3-min timeout or when teacher insists
  const handleForceEnd = async () => {
    setIsEnding(true);
    setEndError('');
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        onEndClass?.();
      } else {
        const data = await res.json().catch(() => null);
        setEndError(data?.error || 'Failed to end session');
      }
    } catch {
      setEndError('Network error');
    } finally {
      setIsEnding(false);
      setApprovalPending(false);
    }
  };

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenShareOn = localParticipant.isScreenShareEnabled;

  // Before Go Live, teacher cannot toggle media
  const mediaLocked = role === 'teacher' && !isLive;

  const toggleMic = async () => {
    try { await localParticipant.setMicrophoneEnabled(!isMicOn); }
    catch (err) { console.error('[ControlBar] Mic toggle failed:', err); }
  };

  const toggleCamera = async () => {
    try { await localParticipant.setCameraEnabled(!isCameraOn); }
    catch (err) { console.error('[ControlBar] Camera toggle failed:', err); }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenShareOn) {
        await localParticipant.setScreenShareEnabled(false);
      } else {
        // Cap frame rate + bitrate to prevent GPU/DWM overload on Windows.
        // Without these limits, capturing "Entire Screen" at native refresh rate
        // forces every shell window (Explorer, File Manager) through the DWM
        // capture pipeline simultaneously, causing them to hang on slower machines.
        await localParticipant.setScreenShareEnabled(true, {
          video: { displaySurface: 'browser' },
          audio: false,
          // 'detail' = text/UI optimised encoder (less motion blur, lower CPU than 'motion')
          contentHint: 'detail',
          // Exclude self to prevent the feedback loop if user picks 'entire screen'.
          // Note: cannot combine with preferCurrentTab — browsers reject as
          // "self-contradictory configuration".
          selfBrowserSurface: 'exclude',
        }, {
          videoEncoding: {
            maxBitrate:   2_500_000,  // 2.5 Mbps cap — same as tablet path
            maxFramerate: 15,         // 15 fps is plenty for slides/code; halves GPU load
          },
          simulcast: false,           // screen content doesn't benefit from simulcast
        });
      }
    } catch (err) {
      console.error('[ControlBar] Screen share toggle failed:', err);
    }
  };

  return (
    <div className={cn(
      'relative flex h-18 items-center justify-center gap-2 border-t border-[#3c4043]/50 bg-[#202124] px-6',
      className
    )}>
      {/* Camera */}
      <MeetButton
        on={isCameraOn}
        onClick={toggleCamera}
        disabled={mediaLocked}
        title={mediaLocked ? 'Go live first' : isCameraOn ? 'Turn off camera (Ctrl+E)' : 'Turn on camera (Ctrl+E)'}
        onIcon={<CameraOnIcon className="h-5 w-5" />}
        offIcon={<CameraOffIcon className="h-5 w-5" />}
        offColor="bg-[#ea4335]"
      />

      {/* Microphone */}
      <MeetButton
        on={isMicOn}
        onClick={toggleMic}
        disabled={mediaLocked}
        title={mediaLocked ? 'Go live first' : isMicOn ? 'Turn off microphone (Ctrl+D)' : 'Turn on microphone (Ctrl+D)'}
        onIcon={<MicOnIcon className="h-5 w-5" />}
        offIcon={<MicOffIcon className="h-5 w-5" />}
        offColor="bg-[#ea4335]"
      />

      {/* Virtual Background (teacher only) */}
      {role === 'teacher' && onToggleVBG && (
        <MeetButton
          on={vbgActive}
          onClick={onToggleVBG}
          disabled={mediaLocked || !vbgSupported}
          title={
            !vbgSupported
              ? 'Background effects are not supported on this browser/device'
              : vbgActive
                ? 'Change virtual background'
                : 'Apply virtual background'
          }
          onIcon={<VirtualBgIcon className="h-5 w-5" />}
          offIcon={<VirtualBgIcon className="h-5 w-5" />}
          onColor="bg-[#1a73e8]"
        />
      )}

      {/* Cutout mode hidden */}

      {/* Teacher: Screen share */}
      {role === 'teacher' && (
        <MeetButton
          on={isScreenShareOn}
          onClick={toggleScreenShare}
          disabled={mediaLocked}
          title={mediaLocked ? 'Go live first' : isScreenShareOn ? 'Stop sharing screen' : 'Share your screen'}
          onIcon={<ScreenShareIcon className="h-5 w-5" />}
          offIcon={<ScreenShareOffIcon className="h-5 w-5" />}
          onColor="bg-[#1a73e8]"
        />
      )}

      {/* Teacher: Whiteboard toggle */}
      {role === 'teacher' && onToggleWhiteboard && (
        <MeetButton
          on={whiteboardActive}
          onClick={onToggleWhiteboard}
          disabled={mediaLocked}
          title={whiteboardActive ? 'Exit whiteboard mode' : 'Enter whiteboard mode'}
          onIcon={<WhiteboardIcon className="h-5 w-5" />}
          offIcon={<WhiteboardIcon className="h-5 w-5" />}
          onColor="bg-[#1a73e8]"
        />
      )}

      {/* Teacher: Recording toggle (BC-style REC / REC OFF) */}
      {role === 'teacher' && isLive && (
        <button
          type="button"
          onClick={onToggleRecording}
          disabled={!onToggleRecording || recordingLoading || !allowRecording}
          title={
            !allowRecording
              ? 'Recording is disabled by Academic Operator settings'
              : isRecording
                ? 'Stop YouTube recording'
                : 'Start YouTube recording'
          }
          className={cn(
            'flex h-12 items-center gap-1.5 rounded-full px-3 transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-60',
            isRecording
              ? 'bg-[#ea4335]/20 text-red-400 hover:bg-[#ea4335]/30'
              : 'bg-[#5f6368]/20 text-[#aaa] hover:bg-[#5f6368]/30',
          )}
        >
          <RecordIcon className={cn('h-4 w-4', isRecording ? 'animate-pulse' : '')} />
          <span className="text-xs font-medium">
            {recordingLoading ? (isRecording ? 'Stopping...' : 'Starting...') : (isRecording ? 'REC' : 'REC OFF')}
          </span>
        </button>
      )}

      {/* Teacher: Exam */}
      {role === 'teacher' && onToggleExam && (
        <MeetButton
          on={examActive}
          onClick={onToggleExam}
          title={examActive ? 'Close exam panel' : 'Start exam'}
          onIcon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
          offIcon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
          onColor="bg-[#1a73e8]"
        />
      )}

      {/* Divider */}
      <div className="mx-1 h-8 w-px bg-[#5f6368]/30" />

      {/* Student: Hand raise */}
      {role === 'student' && onToggleHandRaise && (
        <MeetButton
          on={handRaised}
          onClick={onToggleHandRaise}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
          onIcon={<HandRaiseIcon className="h-5 w-5" />}
          offIcon={<HandRaiseIcon className="h-5 w-5" />}
          onColor="bg-[#fbbf24]"
          onTextColor="text-black"
        />
      )}

      {/* Chat */}
      {onToggleChat && (
        <MeetButton
          on={false}
          onClick={onToggleChat}
          title="Chat with everyone"
          onIcon={<ChatIcon className="h-5 w-5" />}
          offIcon={<ChatIcon className="h-5 w-5" />}
        />
      )}

      {/* Divider */}
      <div className="mx-1 h-8 w-px bg-[#5f6368]/30" />

      {/* Teacher: End Class */}
      {role === 'teacher' && (
        <button
          onClick={() => setShowEndConfirm(true)}
          title="End session for everyone"
          className="flex h-12 items-center gap-2 rounded-full bg-[#ea4335] px-5 text-sm font-medium text-white transition-all hover:bg-[#d33426] hover:shadow-lg hover:shadow-red-900/30 active:scale-95"
        >
          <EndCallIcon className="h-5 w-5" />
          <span className="hidden sm:inline">End</span>
        </button>
      )}

      {/* Student: Leave */}
      {role === 'student' && (
        <button
          onClick={() => setShowLeaveConfirm(true)}
          title="Leave session"
          className="flex h-12 items-center gap-2 rounded-full bg-[#ea4335] px-5 text-sm font-medium text-white transition-all hover:bg-[#d33426] hover:shadow-lg hover:shadow-red-900/30 active:scale-95"
        >
          <LeaveIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      )}

      {/* End class confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-90 rounded-2xl bg-[#2d2e30] p-6 text-center shadow-2xl ring-1 ring-white/10">
            {/* Approval pending state */}
            {approvalPending ? (
              <>
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#5f6368] border-t-[#8ab4f8]" />
                <h3 className="mb-2 text-lg font-semibold text-white">Waiting for Coordinator Approval</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Your request to end the session early has been sent to the batch coordinator.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { cancelEndRequest(); setShowEndConfirm(false); }}
                    className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              </>
            ) : approvalStatus === 'denied' ? (
              <>
                <h3 className="mb-2 text-lg font-semibold text-[#ea4335]">Request Denied</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  The coordinator denied your early end request.
                </p>
                {endError && <p className="mb-3 text-sm text-red-400">{endError}</p>}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowEndConfirm(false); setEndError(''); setApprovalStatus('none'); }}
                    className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
                  >
                    OK
                  </button>
                  <button
                    onClick={handleForceEnd}
                    disabled={isEnding}
                    className="rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium text-white hover:bg-[#d33426] disabled:opacity-50 transition-colors"
                  >
                    {isEnding ? 'Ending...' : 'Force End'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {isBeforeScheduledEnd() && !roomId.startsWith('demo_') && !roomId.startsWith('oc_') && !canEndDirectly ? 'End session early?' : 'End session for everyone?'}
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  {isBeforeScheduledEnd() && !roomId.startsWith('demo_') && !roomId.startsWith('oc_') && !canEndDirectly
                    ? 'The scheduled session time has not ended yet. This will require coordinator approval.'
                    : roomId.startsWith('demo_')
                      ? 'This will end the demo session and disconnect the student.'
                      : 'This will disconnect all students.'}
                </p>
                {isBeforeScheduledEnd() && !roomId.startsWith('demo_') && !roomId.startsWith('oc_') && !canEndDirectly && (
                  <input
                    type="text"
                    value={earlyEndReason}
                    onChange={(e) => setEarlyEndReason(e.target.value)}
                    placeholder="Reason for ending early (optional)"
                    className="mb-3 w-full rounded-lg bg-[#3c4043] px-3 py-2 text-sm text-white placeholder-[#9aa0a6] outline-none ring-1 ring-white/5 focus:ring-[#8ab4f8]/50"
                  />
                )}
                {endError && <p className="mb-3 text-sm text-red-400">{endError}</p>}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowEndConfirm(false); setEndError(''); }}
                    className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndClass}
                    disabled={isEnding}
                    className="rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium text-white hover:bg-[#d33426] disabled:opacity-50 transition-colors"
                  >
                    {isEnding ? (isBeforeScheduledEnd() && !roomId.startsWith('demo_') && !roomId.startsWith('oc_') && !canEndDirectly ? 'Requesting...' : 'Ending...') : (isBeforeScheduledEnd() && !roomId.startsWith('demo_') && !roomId.startsWith('oc_') && !canEndDirectly ? 'Request End' : 'End Session')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl bg-[#2d2e30] p-6 text-center shadow-2xl ring-1 ring-white/10">
            <h3 className="mb-2 text-lg font-semibold text-white">Leave this session?</h3>
            <p className="mb-4 text-sm text-muted-foreground">You can rejoin while the session is active.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
              >
                Stay
              </button>
              <button
                onClick={onLeave}
                className="rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium text-white hover:bg-[#d33426] transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Google Meet-style circular button ────────────────────────
function MeetButton({
  on,
  onClick,
  title,
  onIcon,
  offIcon,
  disabled = false,
  onColor = 'bg-[#3c4043]',
  offColor = 'bg-[#3c4043]',
  onTextColor = 'text-white',
  offTextColor = 'text-white',
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  disabled?: boolean;
  onColor?: string;
  offColor?: string;
  onTextColor?: string;
  offTextColor?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150',
        disabled
          ? 'opacity-40 cursor-not-allowed bg-[#3c4043] text-[#9aa0a6]'
          : cn(
              'active:scale-90',
              on ? `${onColor} ${onTextColor}` : `${offColor} ${offTextColor}`,
              on ? 'hover:bg-[#4a4d51]' : (offColor === 'bg-[#ea4335]' ? 'hover:bg-[#d33426]' : 'hover:bg-[#4a4d51]'),
            ),
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
