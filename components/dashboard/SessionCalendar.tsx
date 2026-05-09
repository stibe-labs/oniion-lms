'use client';

import React, { useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventContentArg, EventDropArg } from '@fullcalendar/core';
import { useToast, useConfirm, Modal, StatusBadge, Avatar, Button } from '@/components/dashboard/shared';
import { PlayCircle, Eye, StopCircle, Pencil, XCircle, Trash2, Video, X, Clock, Users, BookOpen, User, Calendar, MoreVertical } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────
interface Session {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string | null;
  teacher_name: string | null;
  teacher_image?: string | null;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number;
  prep_buffer_minutes: number;
  status: string;
  livekit_room_name: string | null;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  batch_name?: string;
  batch_type?: string;
  grade?: string;
  section?: string;
  student_count?: number;
  recording_status?: string | null;
  recording_url?: string | null;
}

// ── Subject → hex color mapping (matches SUBJECT_COLORS in AO dashboard) ──
const SUBJECT_HEX: { bg: string; border: string; text: string }[] = [
  { bg: '#ecfdf5', border: '#10b981', text: '#047857' }, // emerald
  { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' }, // blue
  { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' }, // purple
  { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' }, // amber
  { bg: '#fff1f2', border: '#f43f5e', text: '#be123c' }, // rose
  { bg: '#ecfeff', border: '#06b6d4', text: '#0e7490' }, // cyan
  { bg: '#eef2ff', border: '#6366f1', text: '#4338ca' }, // indigo
  { bg: '#fff7ed', border: '#f97316', text: '#c2410c' }, // orange
];

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  live: { bg: '#dcfce7', border: '#22c55e' },
  ended: { bg: '#f3f4f6', border: '#9ca3af' },
  cancelled: { bg: '#fef2f2', border: '#ef4444' },
};

function effectiveSessionStatus(s: Session): string {
  if (s.status === 'ended') return 'ended';
  if (s.status === 'live') return 'live';
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'scheduled') return 'scheduled';
  return s.status;
}

function fmtTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function fmtDate(dateStr: string): string {
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Main Component ──────────────────────────────────────────
export default function SessionCalendar({
  sessions,
  onRefresh,
  onEditSession,
  readOnly = false,
}: {
  sessions: Session[];
  onRefresh: () => void;
  onEditSession: (session: Session) => void;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const calRef = useRef<FullCalendar>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Build a stable subject→color index
  const subjectColorMap = React.useMemo(() => {
    const map = new Map<string, typeof SUBJECT_HEX[0]>();
    const subjects = [...new Set(sessions.map(s => s.subject))];
    subjects.forEach((subj, idx) => {
      map.set(subj, SUBJECT_HEX[idx % SUBJECT_HEX.length]);
    });
    return map;
  }, [sessions]);

  // Convert sessions to FullCalendar events
  const events = React.useMemo(() => {
    return sessions.map(s => {
      const es = effectiveSessionStatus(s);
      const subjectColor = subjectColorMap.get(s.subject) || SUBJECT_HEX[0];
      const statusColor = STATUS_COLORS[es];

      // Use status color override for non-scheduled
      const bgColor = statusColor?.bg || subjectColor.bg;
      const borderColor = statusColor?.border || subjectColor.border;
      const textColor = statusColor ? '#374151' : subjectColor.text;

      // Build start/end datetime strings
      const start = `${s.scheduled_date}T${s.start_time.slice(0, 5)}:00`;
      const endDate = new Date(new Date(start).getTime() + s.duration_minutes * 60000);

      return {
        id: s.session_id,
        title: `${s.subject} — ${s.batch_name || s.batch_id}`,
        start,
        end: endDate.toISOString(),
        backgroundColor: bgColor,
        borderColor,
        textColor,
        editable: es === 'scheduled', // only scheduled sessions can be dragged
        extendedProps: { session: s, status: es },
      };
    });
  }, [sessions, subjectColorMap]);

  // ── Event click → show detail popup ──
  const handleEventClick = useCallback((info: EventClickArg) => {
    const session = info.event.extendedProps.session as Session;
    setSelectedSession(session);
  }, []);

  // ── Drag-drop → reschedule ──
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const session = info.event.extendedProps.session as Session;
    const newStart = info.event.start;
    if (!newStart) { info.revert(); return; }

    // Extract new date and time in IST
    const offset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(newStart.getTime() + offset);
    const newDate = ist.toISOString().slice(0, 10);
    const newTime = ist.toISOString().slice(11, 16);

    // Reject past
    if (newStart < new Date()) {
      toast.error('Cannot move session to the past');
      info.revert();
      return;
    }

    const ok = await confirm({
      title: 'Reschedule Session',
      message: `Move "${session.subject}" from ${fmtDate(session.scheduled_date)} ${fmtTime12(session.start_time)} to ${fmtDate(newDate)} ${fmtTime12(newTime)}?`,
      confirmLabel: 'Reschedule',
      variant: 'info',
    });

    if (!ok) { info.revert(); return; }

    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: newDate, start_time: newTime }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Session rescheduled to ${fmtDate(newDate)} at ${fmtTime12(newTime)}`);
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to reschedule');
        info.revert();
      }
    } catch {
      toast.error('Network error');
      info.revert();
    }
  }, [confirm, toast, onRefresh]);

  // ── Custom event rendering ──
  const renderEventContent = useCallback((arg: EventContentArg) => {
    const session = arg.event.extendedProps.session as Session;
    const es = arg.event.extendedProps.status as string;
    const isMonth = arg.view.type === 'dayGridMonth';

    if (isMonth) {
      return (
        <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] leading-tight overflow-hidden w-full">
          {es === 'live' && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
          {es === 'cancelled' && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-red-400" />}
          <span className="truncate font-medium">{session.subject}</span>
          <span className="truncate text-gray-500 hidden sm:inline">· {fmtTime12(session.start_time)}</span>
        </div>
      );
    }

    // Week/Day view — more detail
    return (
      <div className="px-1.5 py-1 text-[11px] leading-tight overflow-hidden w-full h-full">
        <div className="flex items-center gap-1">
          {es === 'live' && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
          <span className="font-semibold truncate">{session.subject}</span>
        </div>
        <div className="text-[10px] opacity-75 truncate">{session.batch_name}</div>
        {session.teacher_name && (
          <div className="text-[10px] opacity-60 truncate">{session.teacher_name}</div>
        )}
      </div>
    );
  }, []);

  // ── Session actions ──
  const handleStart = async (session: Session) => {
    const ok = await confirm({ title: 'Start Session', message: `Start the ${session.subject} session now?`, confirmLabel: 'Start Session', variant: 'info' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast.success('Session started!'); setSelectedSession(null); onRefresh(); }
      else toast.error(data.error || 'Failed to start');
    } catch { toast.error('Network error'); }
  };

  const handleEnd = async (session: Session) => {
    const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End Session', variant: 'warning' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Session ended'); setSelectedSession(null); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const handleCancel = async (session: Session) => {
    const ok = await confirm({
      title: 'Cancel Session',
      message: `Cancel the ${session.subject} session on ${fmtDate(session.scheduled_date)}?`,
      confirmLabel: 'Cancel Session', variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session cancelled'); setSelectedSession(null); onRefresh(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const handleDelete = async (session: Session) => {
    const ok = await confirm({
      title: 'Delete Session',
      message: `Permanently delete this session? This cannot be undone.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}?permanent=true`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session deleted'); setSelectedSession(null); onRefresh(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const detailSession = selectedSession;
  const detailStatus = detailSession ? effectiveSessionStatus(detailSession) : '';

  return (
    <div className="session-calendar">
      {/* Calendar */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventContent={renderEventContent}
          editable={!readOnly}
          droppable={false}
          eventDurationEditable={false}
          height="auto"
          contentHeight={640}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          allDaySlot={false}
          nowIndicator={true}
          weekends={false}
          firstDay={1}
          eventOverlap={true}
          dayMaxEvents={4}
          moreLinkText={(n) => `+${n} more`}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Status:</span>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-50" />
          Scheduled
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-green-500 bg-green-50 animate-pulse" />
          Live
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-gray-400 bg-gray-100" />
          Ended
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-red-400 bg-red-50" />
          Cancelled
        </div>
        <span className="text-[9px] text-gray-300 ml-2">Drag scheduled sessions to reschedule</span>
      </div>

      {/* Session Detail Popup */}
      {detailSession && (
        <Modal open={true} title="Session Details" onClose={() => setSelectedSession(null)}>
          <div className="space-y-4">
            {/* Subject + Status */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{detailSession.subject}</h3>
                {detailSession.topic && <p className="text-sm text-gray-500">{detailSession.topic}</p>}
              </div>
              <StatusBadge status={detailStatus} />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{fmtDate(detailSession.scheduled_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{fmtTime12(detailSession.start_time)} · {detailSession.duration_minutes}min</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span>{detailSession.batch_name || detailSession.batch_id}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="h-4 w-4 text-gray-400" />
                <span>{detailSession.student_count ?? 0} students</span>
              </div>
              {detailSession.teacher_name && (
                <div className="flex items-center gap-2 col-span-2 text-gray-600">
                  <User className="h-4 w-4 text-gray-400" />
                  <Avatar name={detailSession.teacher_name} src={detailSession.teacher_image} size="sm" />
                  <span>{detailSession.teacher_name}</span>
                </div>
              )}
              {detailSession.grade && (
                <div className="text-gray-500 text-xs col-span-2">
                  Grade {detailSession.grade}{detailSession.section ? ` - ${detailSession.section}` : ''} · {detailSession.batch_type}
                </div>
              )}
            </div>

            {detailSession.notes && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{detailSession.notes}</div>
            )}

            {/* Actions */}
            {!readOnly && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {/* Dropdown for all actions — no Start button (teacher controls that) */}
                {(() => {
                  const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];
                  if (detailStatus === 'scheduled') {
                    items.push({ label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => { setSelectedSession(null); onEditSession(detailSession); } });
                    items.push({ label: 'Cancel Session', icon: <XCircle className="h-3.5 w-3.5" />, onClick: () => handleCancel(detailSession), danger: true });
                    items.push({ label: 'Delete Permanently', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(detailSession), danger: true });
                  }
                  if (detailStatus === 'live') {
                    items.push({ label: 'Observe', icon: <Eye className="h-3.5 w-3.5" />, onClick: () => { setSelectedSession(null); window.open(`/classroom/${detailSession.session_id}?mode=observe`, '_blank'); } });
                    items.push({ label: 'End Session', icon: <StopCircle className="h-3.5 w-3.5" />, onClick: () => handleEnd(detailSession), danger: true });
                  }
                  if (detailStatus === 'ended' || detailStatus === 'cancelled') {
                    items.push({ label: 'Delete Permanently', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(detailSession), danger: true });
                  }
                  return items.map(item => (
                    <button key={item.label} onClick={item.onClick}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                        item.danger
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}>
                      {item.icon}{item.label}
                    </button>
                  ));
                })()}
                {detailSession.recording_url && (
                  <a href={detailSession.recording_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 ml-auto">
                    <Video className="h-3.5 w-3.5" /> Watch Recording
                  </a>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* FullCalendar CSS overrides for dark theme consistency */}
      <style>{`
        .session-calendar .fc {
          --fc-border-color: #e5e7eb;
          --fc-today-bg-color: #f0fdf4;
          --fc-now-indicator-color: #10b981;
          --fc-button-bg-color: #f9fafb;
          --fc-button-border-color: #d1d5db;
          --fc-button-text-color: #374151;
          --fc-button-hover-bg-color: #f3f4f6;
          --fc-button-hover-border-color: #9ca3af;
          --fc-button-active-bg-color: #10b981;
          --fc-button-active-border-color: #059669;
          --fc-button-active-text-color: #fff;
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-size: 13px;
        }
        .session-calendar .fc .fc-toolbar-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
        }
        .session-calendar .fc .fc-button {
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          transition: all 0.15s;
        }
        .session-calendar .fc .fc-button-group > .fc-button {
          border-radius: 0;
        }
        .session-calendar .fc .fc-button-group > .fc-button:first-child {
          border-radius: 8px 0 0 8px;
        }
        .session-calendar .fc .fc-button-group > .fc-button:last-child {
          border-radius: 0 8px 8px 0;
        }
        .session-calendar .fc .fc-col-header-cell {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          padding: 8px 0;
        }
        .session-calendar .fc .fc-timegrid-slot {
          height: 2.5em;
        }
        .session-calendar .fc .fc-timegrid-slot-label-cushion {
          font-size: 10px;
          color: #9ca3af;
        }
        .session-calendar .fc .fc-event {
          border-radius: 6px;
          border-width: 2px;
          border-left-width: 3px;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.1s;
        }
        .session-calendar .fc .fc-event:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          transform: translateY(-1px);
        }
        .session-calendar .fc .fc-daygrid-event {
          border-radius: 4px;
          padding: 0;
        }
        .session-calendar .fc .fc-scrollgrid {
          border-radius: 12px;
          overflow: hidden;
        }
        .session-calendar .fc .fc-more-link {
          font-size: 10px;
          font-weight: 600;
          color: #10b981;
        }
      `}</style>
    </div>
  );
}
