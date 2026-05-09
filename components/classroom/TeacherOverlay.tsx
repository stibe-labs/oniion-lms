'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { VideoTrack, type TrackReference } from '@livekit/components-react';
import { Track, type Participant, type RemoteTrackPublication } from 'livekit-client';
import { useTeacherOverlay } from '@/hooks/useTeacherOverlay';
import { cn } from '@/lib/utils';

/**
 * TeacherOverlay — AI background-removed camera cutout.
 *
 * Takes the teacher's camera video element, runs MediaPipe segmentation
 * to remove the background, and renders only the teacher's body as a
 * floating overlay. Draggable to four corners with safe-zone enforcement.
 *
 * Rendering pipeline:
 *   Camera Track → hidden <video> → MediaPipe segmentation → <canvas> (transparent bg)
 *
 * The canvas is positioned absolutely over the whiteboard (screen share).
 */

export interface TeacherOverlayProps {
  /** Whether the overlay is active / visible */
  active: boolean;
  /** The teacher's camera <video> element to process (can be local or remote) */
  videoElement?: HTMLVideoElement | null;
  /** The teacher participant — used for fallback PIP when MediaPipe fails */
  teacher?: Participant | null;
  /** Container dimensions for safe-zone calculation */
  containerWidth?: number;
  containerHeight?: number;
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNER_POSITIONS: Record<Corner, { top?: string; bottom?: string; left?: string; right?: string }> = {
  'top-left': { top: '12px', left: '12px' },
  'top-right': { top: '12px', right: '12px' },
  'bottom-left': { bottom: '12px', left: '12px' },
  'bottom-right': { bottom: '12px', right: '12px' },
};

export default function TeacherOverlay({
  active,
  videoElement,
  teacher,
  containerWidth = 0,
  containerHeight = 0,
}: TeacherOverlayProps) {
  const {
    videoRef: hookVideoRef,
    canvasRef,
    isReady,
    isProcessing,
    fps,
    error,
  } = useTeacherOverlay({ enabled: active && !!videoElement });

  const [corner, setCorner] = useState<Corner>(() => {
    // Restore saved position from session
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('teacher_overlay_corner');
      if (saved && saved in CORNER_POSITIONS) return saved as Corner;
    }
    return 'bottom-right';
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync external video element into the hook's videoRef
  useEffect(() => {
    if (videoElement && hookVideoRef) {
      (hookVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = videoElement;
    }
  }, [videoElement, hookVideoRef]);

  // Save corner preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('teacher_overlay_corner', corner);
    }
  }, [corner]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setDragPos({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !overlayRef.current) {
      setIsDragging(false);
      setDragPos(null);
      return;
    }

    // Determine which corner is nearest to the drop position
    const parent = overlayRef.current.parentElement;
    if (!parent) {
      setIsDragging(false);
      setDragPos(null);
      return;
    }

    const rect = parent.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const midX = rect.width / 2;
    const midY = rect.height / 2;

    let newCorner: Corner;
    if (relX < midX && relY < midY) newCorner = 'top-left';
    else if (relX >= midX && relY < midY) newCorner = 'top-right';
    else if (relX < midX && relY >= midY) newCorner = 'bottom-left';
    else newCorner = 'bottom-right';

    setCorner(newCorner);
    setIsDragging(false);
    setDragPos(null);
  }, [isDragging]);

  if (!active) return null;

  // Build camera PIP fallback (used when MediaPipe fails or is loading)
  const cameraPub = teacher?.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
  const hasFallbackTrack = !!cameraPub && !cameraPub.isMuted && !!cameraPub.track;

  // Camera PIP fallback renderer — shows regular camera in a rounded overlay
  const renderCameraFallback = () => {
    const overlayW = Math.min(320, Math.max(180, containerWidth * 0.22 || 240));
    const overlayH = overlayW * 0.75;
    if (!hasFallbackTrack || !teacher) return null;
    return (
      <div
        className="absolute z-20 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/20"
        style={{ width: overlayW, height: overlayH, ...CORNER_POSITIONS[corner] }}
      >
        <VideoTrack
          trackRef={{
            participant: teacher,
            publication: cameraPub!,
            source: Track.Source.Camera,
          } as TrackReference}
          className="h-full w-full object-cover"
        />
      </div>
    );
  };

  // Error fallback — show teacher camera as a normal PIP (no background removal)
  if (error) {
    return renderCameraFallback();
  }

  // Loading state — show camera PIP while model loads
  if (!isReady) {
    return renderCameraFallback();
  }

  // Overlay size: 22% of container width, clamped between 180–320px
  const overlayWidth = Math.min(320, Math.max(180, containerWidth * 0.22 || 240));
  const overlayHeight = overlayWidth * 0.75; // 4:3 aspect ratio

  const posStyle = isDragging && dragPos
    ? {
        position: 'fixed' as const,
        left: dragPos.x - overlayWidth / 2,
        top: dragPos.y - overlayHeight / 2,
        cursor: 'grabbing',
      }
    : {
        ...CORNER_POSITIONS[corner],
        cursor: 'grab',
      };

  return (
    <div
      ref={overlayRef}
      className={cn(
        'absolute z-20 select-none',
        isDragging && 'opacity-80',
      )}
      style={{
        width: overlayWidth,
        height: overlayHeight,
        ...posStyle,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* The canvas: transparent background, only teacher body visible */}
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-lg"
        style={{
          filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
          background: 'transparent',
        }}
      />

      {/* FPS indicator (dev mode only) */}
      {process.env.NODE_ENV === 'development' && isProcessing && (
        <div className="absolute -top-5 left-0 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-green-400">
          {fps} FPS
        </div>
      )}
    </div>
  );
}
