'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * AttendancePanel — Enhanced live attendance tracker.
 *
 * Features:
 *   - Shows ALL enrolled students (including those who haven't joined)
 *   - Contact info: student phone, WhatsApp, parent email/phone
 *   - Live connection indicator (green dot = connected)
 *   - Auto-mark absent 5 min before class ends + notifications
 *   - Manual "Mark Absent & Notify" button
 *   - Status: present, late, absent, left_early, not_joined
 *   - Expandable contact details per student
 *   - Join timeline in Logs tab
 */

interface AttendanceRecord {
  participant_email: string;
  participant_name: string;
  participant_role: string;
  status: string;
  first_join_at: string | null;
  last_leave_at: string | null;
  total_duration_sec: number;
  join_count: number;
  late_join: boolean;
  late_by_sec: number;
  leave_approved: boolean | null;
  teacher_remarks: string | null;
  // Enhanced fields
  student_phone?: string | null;
  student_whatsapp?: string | null;
  parent_email?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_whatsapp?: string | null;
  is_guest?: boolean;
}

interface JoinLogEntry {
  participant_email: string;
  participant_name: string | null;
  participant_role: string | null;
  event_type: string;
  event_at: string;
  payload: Record<string, unknown> | null;
}

interface AttendanceSummary {
  total_students: number;
  present: number;
  late: number;
  absent: number;
  not_joined: number;
  left_early: number;
  avg_duration_sec: number;
}

interface RoomSchedule {
  scheduled_start: string;
  duration_minutes: number;
}

export interface AttendancePanelProps {
  roomId: string;
  className?: string;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch { return '—'; }
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'join': return <svg className="h-3.5 w-3.5 text-[#34a853]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>;
    case 'rejoin': return <svg className="h-3.5 w-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
    case 'leave': return <svg className="h-3.5 w-3.5 text-[#ea4335]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>;
    case 'late_join': return <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'leave_request': return <svg className="h-3.5 w-3.5 text-[#f9ab00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'leave_approved': return <svg className="h-3.5 w-3.5 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
    case 'leave_denied': return <svg className="h-3.5 w-3.5 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'kicked': return <svg className="h-3.5 w-3.5 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
    case 'absent_marked': return <svg className="h-3.5 w-3.5 text-[#ea4335]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>;
    default: return <svg className="h-3.5 w-3.5 text-[#9aa0a6]" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>;
  }
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  present:    { bg: 'bg-[#34a853]/15', text: 'text-[#34a853]', label: 'On Time' },
  late:       { bg: 'bg-[#f9ab00]/15', text: 'text-[#f9ab00]', label: 'Late' },
  absent:     { bg: 'bg-[#ea4335]/15', text: 'text-[#ea4335]', label: 'Absent' },
  not_joined: { bg: 'bg-[#ea4335]/10', text: 'text-[#ff6b6b]', label: 'Not Joined' },
  left_early: { bg: 'bg-[#8ab4f8]/15', text: 'text-[#8ab4f8]', label: 'Left Early' },
  excused:    { bg: 'bg-[#9aa0a6]/15', text: 'text-[#9aa0a6]', label: 'Excused' },
};

export default function AttendancePanel({ roomId, className }: AttendancePanelProps) {
  const [tab, setTab] = useState<'live' | 'logs'>('live');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<JoinLogEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [roomSchedule, setRoomSchedule] = useState<RoomSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [remindedEmails, setRemindedEmails] = useState<Set<string>>(new Set());
  const [remindingEmail, setRemindingEmail] = useState<string | null>(null);
  const [absentMarked, setAbsentMarked] = useState(false);
  const [autoAbsentTriggered, setAutoAbsentTriggered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remotes = useRemoteParticipants();

  const connectedIds = useMemo(
    () => new Set(remotes.map((p) => p.identity)),
    [remotes],
  );

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/attendance`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setAttendance(json.data.attendance || []);
        setLogs(json.data.logs || []);
        setSummary(json.data.summary || null);
        if (json.data.room_schedule) setRoomSchedule(json.data.room_schedule);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchAttendance();
    intervalRef.current = setInterval(fetchAttendance, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAttendance]);

  // Auto-mark absent 5 minutes before class ends
  useEffect(() => {
    if (!roomSchedule || autoAbsentTriggered || absentMarked) return;
    const endTime = new Date(roomSchedule.scheduled_start).getTime() + roomSchedule.duration_minutes * 60_000;
    const triggerTime = endTime - 5 * 60_000; // 5 min before end

    const check = () => {
      const notJoined = (summary?.not_joined ?? 0) + (summary?.absent ?? 0);
      if (Date.now() >= triggerTime && notJoined > 0 && !autoAbsentTriggered) {
        setAutoAbsentTriggered(true);
        handleMarkAbsent();
      }
    };

    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [roomSchedule, summary, autoAbsentTriggered, absentMarked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemind = useCallback(async (email: string) => {
    if (remindedEmails.has(email) || remindingEmail) return;
    setRemindingEmail(email);
    try {
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/attendance/remind`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.success) {
        setRemindedEmails(prev => new Set(prev).add(email));
      }
    } catch {
      // silently ignore
    } finally {
      setRemindingEmail(null);
    }
  }, [roomId, remindedEmails, remindingEmail]);

  const handleMarkAbsent = useCallback(async () => {
    setMarkingAbsent(true);
    try {
      const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/attendance/mark-absent`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setAbsentMarked(true);
        fetchAttendance(); // Refresh to show updated statuses
      }
    } catch {
      // silently ignore
    } finally {
      setMarkingAbsent(false);
    }
  }, [roomId, fetchAttendance]);

  const studentRecords = useMemo(
    () => attendance.filter((a) => a.participant_role === 'student' && !a.is_guest),
    [attendance],
  );

  const guestRecords = useMemo(
    () => attendance.filter((a) => a.participant_role === 'student' && a.is_guest),
    [attendance],
  );

  const teacherRecord = useMemo(
    () => attendance.find((a) => a.participant_role === 'teacher') ?? null,
    [attendance],
  );

  // Sort: not_joined first, then absent, then others
  const sortedStudents = useMemo(() => {
    const order: Record<string, number> = { not_joined: 0, absent: 1, left_early: 2, late: 3, present: 4 };
    return [...studentRecords].sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  }, [studentRecords]);

  const notJoinedCount = useMemo(
    () => studentRecords.filter(s => s.status === 'not_joined').length,
    [studentRecords],
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Summary bar */}
      {summary && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#3c4043] bg-[#292a2d]">
          <StatBadge label="On Time" count={summary.present} color="text-[#34a853]" />
          <StatBadge label="Late" count={summary.late} color="text-[#f9ab00]" />
          {(summary.not_joined > 0) && (
            <StatBadge label="Not Joined" count={summary.not_joined} color="text-[#ff6b6b]" />
          )}
          <StatBadge label="Absent" count={summary.absent} color="text-[#ea4335]" />
          <StatBadge label="Left" count={summary.left_early} color="text-[#8ab4f8]" />
          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg className={cn('h-3 w-3', loading && 'animate-spin')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      )}

      {/* Mark absent button — shown when there are unjoined students */}
      {notJoinedCount > 0 && !absentMarked && (
        <div className="px-3 py-2 border-b border-[#3c4043] bg-[#ea4335]/5">
          <button
            onClick={handleMarkAbsent}
            disabled={markingAbsent}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#ea4335]/15 px-3 py-2 text-xs font-semibold text-[#ea4335] hover:bg-[#ea4335]/25 transition-colors disabled:opacity-60"
          >
            {markingAbsent ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
            )}
            {markingAbsent ? 'Marking & Sending Alerts…' : `Mark ${notJoinedCount} Absent & Notify`}
          </button>
        </div>
      )}

      {/* Absent notification sent confirmation */}
      {absentMarked && (
        <div className="px-3 py-2 border-b border-[#3c4043] bg-[#34a853]/5">
          <div className="flex items-center gap-2 text-xs text-[#34a853]">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            Absent notifications sent to students & parents
          </div>
        </div>
      )}

      {/* Tab buttons */}
      <div className="flex border-b border-[#3c4043]">
        {(['live', 'logs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-[11px] font-medium capitalize transition-colors',
              tab === t
                ? 'bg-[#3c4043] text-[#e8eaed]'
                : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]',
            )}
          >
            {t === 'live' ? (
              <span className="flex items-center justify-center gap-1"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg> Attendance</span>
            ) : (
              <span className="flex items-center justify-center gap-1"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Join Logs</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
        {tab === 'live' ? (
          sortedStudents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-[#9aa0a6]">
              No attendance data yet
            </div>
          ) : (
            <div className="divide-y divide-[#3c4043]/30">
              {teacherRecord && (
                <AttendanceRow
                  record={teacherRecord}
                  isConnected={connectedIds.has(teacherRecord.participant_email)}
                  isTeacher
                />
              )}
              {sortedStudents.map((rec) => (
                <AttendanceRow
                  key={rec.participant_email}
                  record={rec}
                  isConnected={connectedIds.has(rec.participant_email)}
                  reminded={remindedEmails.has(rec.participant_email)}
                  reminding={remindingEmail === rec.participant_email}
                  onRemind={() => handleRemind(rec.participant_email)}
                />
              ))}
              {guestRecords.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20">
                    <svg className="h-3 w-3 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-400">Guests ({guestRecords.length})</span>
                  </div>
                  {guestRecords.map((rec) => (
                    <AttendanceRow
                      key={rec.participant_email}
                      record={rec}
                      isConnected={connectedIds.has(rec.participant_email)}
                      isGuest
                    />
                  ))}
                </>
              )}
            </div>
          )
        ) : (
          logs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-[#9aa0a6]">
              No join logs yet
            </div>
          ) : (
            <div className="divide-y divide-[#3c4043]/30">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 hover:bg-[#3c4043]/20 transition-colors">
                  <span className="text-sm mt-0.5 shrink-0"><EventIcon type={log.event_type} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[#e8eaed] truncate">
                        {log.participant_name || log.participant_email}
                      </span>
                      <span className="text-[10px] text-[#9aa0a6]">
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9aa0a6]">{fmtTime(log.event_at)}</span>
                    {log.payload && log.event_type === 'late_join' && (
                      <span className="ml-1.5 text-[10px] text-[#f9ab00]">
                        ({fmtDuration(Number((log.payload as Record<string, number>).late_by_sec || 0))} late)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function AttendanceRow({
  record: r,
  isConnected,
  isTeacher,
  isGuest,
  reminded,
  reminding,
  onRemind,
}: {
  record: AttendanceRecord;
  isConnected: boolean;
  isTeacher?: boolean;
  isGuest?: boolean;
  reminded?: boolean;
  reminding?: boolean;
  onRemind?: () => void;
}) {
  const st = STATUS_COLORS[r.status] || STATUS_COLORS.absent;
  const isNotJoined = r.status === 'not_joined';
  const showRemind = !isTeacher && !isGuest && (isNotJoined || r.status === 'absent') && onRemind;

  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#3c4043]/20 transition-colors',
      isNotJoined && 'bg-[#ea4335]/[0.03]',
    )}>
      {/* Avatar + connection indicator */}
      <div className="relative shrink-0">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
          isTeacher ? 'bg-[#1a73e8]/20 text-[#8ab4f8]'
            : isGuest ? 'bg-purple-900/40 text-purple-300'
            : isNotJoined ? 'bg-[#ea4335]/10 text-[#ea4335]/60'
            : 'bg-[#5f6368]/30 text-[#e8eaed]',
        )}>
          {(r.participant_name || '?').charAt(0).toUpperCase()}
        </div>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#202124]',
            isConnected ? 'bg-[#34a853]' : isNotJoined ? 'bg-[#ea4335]/40' : 'bg-[#5f6368]',
          )}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs font-medium truncate', isNotJoined ? 'text-[#9aa0a6]' : 'text-[#e8eaed]')}>
            {r.participant_name}
          </span>
          {isTeacher && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#1a73e8]/15 text-[#8ab4f8]">
              TEACHER
            </span>
          )}
          {isGuest && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-purple-900/40 text-purple-300">
              GUEST
            </span>
          )}
          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold', st.bg, st.text)}>
            {st.label}
          </span>
          {r.late_join && (
            <span className="flex items-center gap-0.5 text-[9px] text-[#f9ab00]">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {fmtDuration(r.late_by_sec)} late
            </span>
          )}
        </div>
        {/* Second row: timing details */}
        {isNotJoined && !isGuest ? (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[#ea4335]/60">
              {r.participant_email}
            </span>
          </div>
        ) : isNotJoined && isGuest ? (
          <div className="mt-0.5">
            <span className="text-[10px] text-purple-400/60">Joined via guest link — not yet connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-[#9aa0a6]">In: {fmtTime(r.first_join_at)}</span>
            {r.last_leave_at && <span className="text-[10px] text-[#9aa0a6]">Out: {fmtTime(r.last_leave_at)}</span>}
            <span className="flex items-center gap-0.5 text-[10px] text-[#9aa0a6]">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {fmtDuration(r.total_duration_sec)}
            </span>
            {r.join_count > 1 && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#f9ab00]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                {r.join_count}x
              </span>
            )}
            {r.leave_approved && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#34a853]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Excused
              </span>
            )}
          </div>
        )}
      </div>

      {/* Remind button — only for not-joined / absent students */}
      {showRemind && (
        reminded ? (
          <span className="shrink-0 rounded-full p-1.5 bg-[#34a853]/10" title="Reminder sent">
            <svg className="h-3.5 w-3.5 text-[#34a853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
        ) : (
          <button
            onClick={onRemind}
            disabled={reminding}
            className="shrink-0 rounded-full p-1.5 text-[#f9ab00] hover:bg-[#f9ab00]/15 transition-colors disabled:opacity-50"
            title="Send join reminder (email + WhatsApp)"
          >
            {reminding ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            )}
          </button>
        )
      )}
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn('text-sm font-bold', color)}>{count}</span>
      <span className="text-[9px] text-[#9aa0a6]">{label}</span>
    </div>
  );
}
