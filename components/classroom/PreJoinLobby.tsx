'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * PreJoinLobby — Camera/mic preview before joining the LiveKit room.
 * Shows camera preview, device selectors, role badge, and join button.
 * Used on the join/[room_id] page before entering the classroom.
 */

export interface PreJoinLobbyProps {
  roomName: string;
  participantName: string;
  role: string;
  onJoin: () => void;
  isJoining?: boolean;
  className?: string;
}

export default function PreJoinLobby({
  roomName,
  participantName,
  role,
  onJoin,
  isJoining = false,
  className,
}: PreJoinLobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(role !== 'student'); // students start muted
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ video: MediaDeviceInfo[]; audio: MediaDeviceInfo[] }>({
    video: [],
    audio: [],
  });

  const isGhost = ['ghost', 'owner', 'batch_coordinator', 'academic_operator', 'academic', 'parent'].includes(role);

  // Request camera access on mount (unless ghost)
  useEffect(() => {
    if (isGhost) return;

    let currentStream: MediaStream | null = null;

    async function setupMedia() {
      try {
        // mediaDevices is undefined on plain HTTP (non-localhost)
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError(
            window.location.protocol === 'http:' && window.location.hostname !== 'localhost'
              ? 'Camera requires HTTPS. You can still join — LiveKit will request access inside the classroom.'
              : 'Camera/mic not available on this device.'
          );
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        currentStream = mediaStream;
        setStream(mediaStream);

        // Enumerate devices
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          video: deviceList.filter((d) => d.kind === 'videoinput'),
          audio: deviceList.filter((d) => d.kind === 'audioinput'),
        });
      } catch (err) {
        setCameraError('Camera/mic access denied. You can still join.');
      }
    }

    setupMedia();

    return () => {
      // Cleanup: stop all tracks
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isGhost]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = cameraOn ? stream : null;
    }
  }, [stream, cameraOn]);

  // Toggle camera track
  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !cameraOn));
    }
    setCameraOn(!cameraOn);
  };

  // Toggle mic track
  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    }
    setMicOn(!micOn);
  };

  const roleColors: Record<string, string> = {
    teacher: 'bg-emerald-600',
    student: 'bg-blue-600',
    ghost: 'bg-purple-600',
    owner: 'bg-purple-600',
    batch_coordinator: 'bg-indigo-600',
    academic_operator: 'bg-teal-600',
    academic: 'bg-teal-600',
    parent: 'bg-orange-600',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-6', className)}>
      {/* Room info */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{roomName}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">{participantName}</span>
          <span
            className={cn(
              'rounded px-2 py-0.5 text-xs font-bold uppercase text-white',
              roleColors[role] || 'bg-muted'
            )}
          >
            {role.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Camera preview */}
      {!isGhost && (
        <div className="relative w-100 overflow-hidden rounded-xl bg-muted">
          {cameraOn && !cameraError ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-75 w-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex h-75 items-center justify-center">
              <div className="text-center">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-foreground mx-auto">
                  {participantName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {cameraError || 'Camera is off'}
                </p>
              </div>
            </div>
          )}

          {/* Camera/mic toggles on preview */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            <button
              onClick={toggleCamera}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm',
                cameraOn ? 'bg-accent text-foreground' : 'bg-red-600 text-white'
              )}
            >
              {cameraOn ? '📷' : '🚫'}
            </button>
            <button
              onClick={toggleMic}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm',
                micOn ? 'bg-accent text-foreground' : 'bg-red-600 text-white'
              )}
            >
              {micOn ? '🎤' : '🔇'}
            </button>
          </div>
        </div>
      )}

      {/* Ghost info */}
      {isGhost && (
        <div className="w-100 rounded-xl bg-muted p-6 text-center">
          <div className="mb-3 text-4xl">👻</div>
          <h3 className="text-lg font-semibold text-foreground">Ghost Mode</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You will observe silently. No camera or microphone will be used.
            You are invisible to all participants.
          </p>
        </div>
      )}

      {/* Join button */}
      <button
        onClick={onJoin}
        disabled={isJoining}
        className="rounded-lg bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {isJoining ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Joining...
          </span>
        ) : isGhost ? (
          '👁 Start Observing'
        ) : (
          '🎬 Enter Classroom'
        )}
      </button>
    </div>
  );
}
