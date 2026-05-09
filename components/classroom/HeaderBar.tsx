'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParticipants } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * HeaderBar — Room info, live countdown timer, participant count, sidebar toggle.
 * Sits at the top of TeacherView and StudentView.
 *
 * Shows a COUNTDOWN to class end time (scheduled_start + duration_minutes).
 * At 5 minutes remaining, shows a warning banner.
 * At 0:00, shows overtime indicator. Session continues until manual end.
 */

export interface HeaderBarProps {
  roomName: string;
  role: 'teacher' | 'student' | 'ghost';
  /** ISO string of when the class was scheduled to start */
  scheduledStart?: string;
  /** ISO string when class went live (used for overtime detection, optional) */
  goLiveAt?: string | null;
  /** Total class duration in minutes */
  durationMinutes?: number;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  /** Fires once when the class timer reaches 0:00 */
  onTimeExpired?: () => void;
  /** When false, the LIVE badge is hidden (teacher pre-live state) */
  isLive?: boolean;
  /** Show coordinator (BC) online/offline status in the header */
  coordinatorOnline?: boolean | null;
  /** Session topic (e.g. "Quadratic Equations") */
  topic?: string;
  /** Critical AI monitoring alerts to display in header (teacher view) */
  criticalAlerts?: unknown[];
  /** Clear all displayed alerts */
  onClearAlerts?: () => void;
  /** Total pending student requests count (teacher view) */
  requestCount?: number;
  /** Callback when the Files button is clicked (teacher view) */
  onFilesClick?: () => void;
  /** How many materials have been uploaded (shows badge) */
  materialsCount?: number;
  /** Ref forwarded to the requests bell button for portal positioning */
  requestsBellRef?: React.RefObject<HTMLButtonElement | null>;
  /** Called when the requests bell button is clicked */
  onRequestsBellClick?: () => void;
  /** Extra content rendered in the right section before the sidebar toggle */
  extraRightContent?: React.ReactNode;
  className?: string;
}

function formatTimer(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function HeaderBar({
  roomName,
  role,
  scheduledStart,
  durationMinutes = 60,
  sidebarOpen = true,
  onToggleSidebar,
  onTimeExpired,
  isLive = true,
  coordinatorOnline = null,
  topic,
  criticalAlerts,
  onClearAlerts,
  requestCount,
  requestsBellRef,
  onRequestsBellClick,
  onFilesClick,
  materialsCount,
  extraRightContent,
  className,
}: HeaderBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [alertDropdownOpen, setAlertDropdownOpen] = useState(false);
  const alertDropdownRef = useRef<HTMLDivElement>(null);
  const alertBellRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const participants = useParticipants();
  const expiredFired = useRef(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!alertDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        alertDropdownRef.current && !alertDropdownRef.current.contains(e.target as Node) &&
        alertBellRef.current && !alertBellRef.current.contains(e.target as Node)
      ) {
        setAlertDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [alertDropdownOpen]);

  // Count only visible participants: exclude ghost, observer, teacher screen/tablet
  const visibleCount = participants.filter((p) => {
    try {
      const meta = JSON.parse(p.metadata || '{}');
      const pRole = meta.effective_role || meta.portal_role || '';
      if (pRole.startsWith('ghost') || pRole === 'observer') return false;
      if (pRole === 'teacher_screen') return false;
      if (meta.device === 'screen') return false;
    } catch {}
    if (p.identity.endsWith('_screen')) return false;
    return true;
  }).length;

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 9999 is the sentinel value for "unlimited duration" (open classrooms with no time limit)
  const isUnlimitedDuration = durationMinutes >= 9999;

  // Compute class end time from scheduled_start + duration
  const endTime = useMemo(() => {
    if (!scheduledStart || isUnlimitedDuration) return null;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return null;
    return start + durationMinutes * 60 * 1000;
  }, [scheduledStart, durationMinutes, isUnlimitedDuration]);

  // Remaining seconds (negative = overtime)
  const remainingSeconds = endTime ? Math.floor((endTime - now) / 1000) : null;
  const isExpired = remainingSeconds !== null && remainingSeconds <= 0;
  const isWarning = remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5 * 60; // last 5 min
  const overtimeSeconds = isExpired ? Math.abs(remainingSeconds!) : 0;

  // Elapsed since scheduled start
  const elapsedSeconds = useMemo(() => {
    if (!scheduledStart) return 0;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return 0;
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [scheduledStart, now]);

  // Fire onTimeExpired exactly once when timer hits 0
  useEffect(() => {
    if (isExpired && !expiredFired.current && onTimeExpired) {
      expiredFired.current = true;
      onTimeExpired();
    }
  }, [isExpired, onTimeExpired]);

  return (
    <div className={cn('relative', className)}>
      {/* 5-minute warning banner */}
      {isWarning && !warningDismissed && (
        <div className="flex items-center justify-center gap-3 bg-[#f9ab00] px-4 py-1.5 text-xs font-semibold text-[#202124]">
          <span className="flex items-center gap-1.5"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Session ends in {Math.ceil((remainingSeconds ?? 0) / 60)} minute{Math.ceil((remainingSeconds ?? 0) / 60) !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setWarningDismissed(true)}
            className="rounded bg-black/15 px-2 py-0.5 text-[10px] hover:bg-black/25 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Time expired — overtime banner */}
      {isExpired && (
        <div className="flex items-center justify-center bg-[#f9ab00] px-4 py-1.5 text-xs font-semibold text-[#202124]">
          <span className="flex items-center justify-center gap-1.5"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {role === 'teacher'
              ? `Overtime +${formatTimer(overtimeSeconds)} — End class manually when ready`
              : `Overtime +${formatTimer(overtimeSeconds)} — Class still in session`}
          </span>
        </div>
      )}

      <div className="flex h-12 items-center justify-between border-b border-[#3c4043] bg-[#202124]/95 backdrop-blur-sm px-4">
        {/* Left: stibe + Room name */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#34a853]">S</span>
          <span className="truncate text-sm font-medium text-[#e8eaed]">
            {roomName}
          </span>
          {topic && (
            <span className="truncate text-xs text-[#9aa0a6] ml-1">
              — {topic}
            </span>
          )}
          {/* Files button — teacher only, shown when onFilesClick provided */}
          {onFilesClick && (
            <button
              onClick={onFilesClick}
              className="relative ml-2 flex h-7 items-center gap-1.5 rounded-lg border border-[#3c4043] bg-[#292a2d] px-2.5 text-[11px] font-medium text-[#9aa0a6] hover:border-[#8ab4f8]/40 hover:text-[#8ab4f8] transition-colors"
              title="Session materials"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Files
              {!!materialsCount && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8ab4f8] px-0.5 text-[9px] font-bold text-[#202124] leading-none">
                  {materialsCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Center: Live badge + countdown + elapsed + participants */}
        <div className="flex items-center gap-4">
          {/* Live badge */}
          {isLive && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-semibold uppercase text-red-400">Live</span>
          </div>
          )}

          {/* Countdown timer (shows overtime when past end; "Unlimited" for open classrooms) */}
          {isUnlimitedDuration ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold text-[#9aa0a6]">
                <span>Unlimited</span>
              </div>
              <span className="text-xs text-[#5f6368]" title="Elapsed time">{formatTimer(elapsedSeconds)}</span>
            </div>
          ) : remainingSeconds !== null ? (
            <div className="flex items-center gap-2">
              {/* Remaining or overtime display */}
              <div
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-sm font-semibold',
                  isExpired
                    ? 'bg-[#f9ab00]/15 text-[#f9ab00]'
                    : isWarning
                      ? 'bg-[#f9ab00]/15 text-[#f9ab00]'
                      : 'text-[#e8eaed]'
                )}
              >
                <span>{isExpired ? `+${formatTimer(overtimeSeconds)}` : formatTimer(remainingSeconds)}</span>
              </div>

              {/* Elapsed (smaller, secondary) */}
              <span className="text-xs text-[#5f6368]" title="Elapsed time">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
          ) : (
            /* Fallback: just elapsed if no schedule info */
            <span className="font-mono text-sm text-[#9aa0a6]">{formatTimer(elapsedSeconds)}</span>
          )}

          {/* Participant count */}
          <div className="flex items-center gap-1.5 text-sm text-[#9aa0a6]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>{visibleCount}</span>
          </div>

          {/* Coordinator (BC) status */}
          {coordinatorOnline !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={cn('h-2 w-2 rounded-full', coordinatorOnline ? 'bg-[#34a853] animate-pulse' : 'bg-[#5f6368]')} />
              <svg className="h-3.5 w-3.5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className={coordinatorOnline ? 'text-[#e8eaed]' : 'text-[#9aa0a6]'}>
                {coordinatorOnline ? 'BC Online' : 'BC Offline'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Alert bell + Sidebar toggle */}
        <div className="flex items-center gap-1">
          {/* Requests bell — shown when there are pending requests (teacher + coordinator) */}
          {!!requestCount && onRequestsBellClick && (
            <div className="relative">
              <button
                ref={requestsBellRef}
                onClick={onRequestsBellClick}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#8ab4f8] hover:bg-[#8ab4f8]/20 animate-pulse transition-colors"
                title="Student requests"
              >
                {/* Inbox tray icon */}
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4285f4] px-0.5 text-[9px] font-bold text-white leading-none">
                  {requestCount > 9 ? '9+' : requestCount}
                </span>
              </button>
            </div>
          )}

          {/* Critical alerts bell */}
          {criticalAlerts && criticalAlerts.length > 0 && (
            <div className="relative">
              <button
                ref={alertBellRef}
                onClick={() => {
                  if (!alertDropdownOpen && alertBellRef.current) {
                    const rect = alertBellRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                  }
                  setAlertDropdownOpen(o => !o);
                }}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  alertDropdownOpen
                    ? 'bg-red-600/30 text-red-400'
                    : 'text-red-400 hover:bg-red-600/20 animate-pulse',
                )}
                title="Critical AI alerts"
              >
                {/* Bell icon */}
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {/* Count badge */}
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
                  {criticalAlerts.length > 9 ? '9+' : criticalAlerts.length}
                </span>
              </button>

              {/* Alert dropdown — rendered via portal at document.body to escape LiveKit video GPU compositing layers */}
              {alertDropdownOpen && typeof document !== 'undefined' && createPortal(
                <div
                  ref={alertDropdownRef}
                  className="fixed z-[99999] w-80 rounded-xl border border-[#3c4043] bg-[#202124] shadow-2xl"
                  style={{ top: dropdownPos.top, right: dropdownPos.right }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span className="text-xs font-semibold text-[#e8eaed]">Critical Alerts</span>
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">{criticalAlerts.length}</span>
                    </div>
                    <button
                      onClick={() => { onClearAlerts?.(); setAlertDropdownOpen(false); }}
                      className="text-[10px] text-[#9aa0a6] hover:text-[#e8eaed] transition-colors px-1.5 py-0.5 rounded hover:bg-[#3c4043]"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Alert list */}
                  <div className="max-h-72 overflow-y-auto">
                    {(criticalAlerts as Array<{id: string; studentName?: string; message: string; severity?: string; time?: number; category?: string}>)
                      .slice()
                      .reverse()
                      .map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          'flex items-start gap-2.5 border-b border-[#3c4043]/60 px-3 py-2.5 last:border-0',
                          alert.severity === 'danger'
                            ? 'bg-red-950/20'
                            : alert.severity === 'warning'
                              ? 'bg-amber-950/20'
                              : 'bg-transparent',
                        )}
                      >
                        {/* Severity dot */}
                        <span className={cn(
                          'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                          alert.severity === 'danger' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500',
                        )} />
                        <div className="flex-1 min-w-0">
                          {alert.studentName && (
                            <p className="text-[11px] font-semibold text-[#e8eaed] truncate">{alert.studentName}</p>
                          )}
                          <p className="text-[11px] text-[#9aa0a6] leading-snug">{alert.message}</p>
                          {alert.time && (
                            <p className="text-[9px] text-[#5f6368] mt-0.5">
                              {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}

          {extraRightContent}

          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={cn(
                'rounded px-2 py-1 text-sm transition-colors',
                sidebarOpen
                  ? 'bg-[#3c4043] text-[#e8eaed]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed]'
              )}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              ) : (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
