'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import ChatPanel, { type ChatPanelProps } from './ChatPanel';
import HomeworkPanel from './HomeworkPanel';

/**
 * StudentSidePanel — Tabbed sidebar for students: Chat | Homework | My Attendance.
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
}

interface JoinLogEntry {
  participant_email: string;
  participant_name: string | null;
  participant_role: string | null;
  event_type: string;
  event_at: string;
  payload: Record<string, unknown> | null;
}

interface StudentSidePanelProps extends ChatPanelProps {
  roomId: string;
  participantEmail?: string;
}

function fmtDuration(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtTimer(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch { return '—'; }
}

/* ── SVG Icons ─────────────────────────────────────────────── */

function IcChat({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10h.01M10 10h.01M14 10h.01" /><path d="M3 10a7 7 0 1 1 3.1 5.81L3 17l1.19-3.1A6.96 6.96 0 0 1 3 10Z" />
  </svg>);
}
function IcBook({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M7 3v14" /><path d="M10 7h4M10 10h4" />
  </svg>);
}
function IcClock({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2.5" />
  </svg>);
}
function IcClose({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>);
}
function IcChevron({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 6 4 4 4-4" />
  </svg>);
}
function IcRefresh({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10a7 7 0 0 1 12.9-3.7M17 10a7 7 0 0 1-12.9 3.7" /><path d="M16 3v4h-4M4 17v-4h4" />
  </svg>);
}
function IcTimeline({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h14M3 10h10M3 16h6" />
  </svg>);
}
function IcCheck({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 8 3.5 3.5L13 5" />
  </svg>);
}
function IcX({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="m4 4 8 8M12 4 4 12" />
  </svg>);
}
function IcPause({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <rect x="3" y="3" width="3.5" height="10" rx="1" /><rect x="9.5" y="3" width="3.5" height="10" rx="1" />
  </svg>);
}

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  present:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'On Time' },
  late:       { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Late' },
  absent:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Absent' },
  left_early: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',    label: 'Left Early' },
};

/* ── Live Duration Timer Hook ──────────────────────────────── */

function useLiveTimer(record: AttendanceRecord | null, logs: JoinLogEntry[]) {
  const [liveSec, setLiveSec] = useState(0);

  useEffect(() => {
    if (!record?.first_join_at) { setLiveSec(0); return; }

    const lastJoin = [...logs]
      .filter(l => l.event_type === 'join' || l.event_type === 'rejoin')
      .sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime())[0];
    const lastLeave = [...logs]
      .filter(l => l.event_type === 'leave')
      .sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime())[0];

    const lastJoinTime = lastJoin ? new Date(lastJoin.event_at).getTime() : 0;
    const lastLeaveTime = lastLeave ? new Date(lastLeave.event_at).getTime() : 0;
    const isConnected = lastJoinTime > lastLeaveTime;

    if (!isConnected) {
      setLiveSec(record.total_duration_sec);
      return;
    }

    const segmentStart = lastJoinTime;
    const serverTotal = record.total_duration_sec;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - segmentStart) / 1000);
      setLiveSec(serverTotal + elapsed);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [record, logs]);

  return liveSec;
}

/* ── Main Component ────────────────────────────────────────── */

export default function StudentSidePanel(props: StudentSidePanelProps) {
  const { roomId, onClose, ...chatProps } = props;
  const [tab, setTab] = useState<'chat' | 'homework' | 'attendance'>('chat');
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [logs, setLogs] = useState<JoinLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const fetched = useRef(false);
  const liveSec = useLiveTimer(record, logs);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/room/${roomId}/attendance`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        const att = json.data.attendance as AttendanceRecord[];
        setRecord(att[0] ?? null);
        setLogs(json.data.logs ?? []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => {
    if (tab === 'chat' || tab === 'homework') return;
    if (!fetched.current) { fetchData(); fetched.current = true; }
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [tab, fetchData]);

  const tabItems: { key: typeof tab; label: string; icon: (p: { className?: string }) => React.JSX.Element }[] = [
    { key: 'chat', label: 'Chat', icon: IcChat },
    { key: 'homework', label: 'Tasks', icon: IcBook },
    { key: 'attendance', label: 'Duration', icon: IcClock },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#16181d]">
      {/* ── Tab header ─────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-2 py-1">
        <div className="flex gap-0.5">
          {tabItems.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                  active ? 'bg-white/[0.08] text-white' : 'text-[#8b8fa3] hover:text-white hover:bg-white/[0.04]',
                )}>
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        {onClose && (
          <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-md text-[#8b8fa3] hover:text-white hover:bg-white/[0.08] transition-colors">
            <IcClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Tab content ────────────────────────────── */}
      {tab === 'chat' && (
        <ChatPanel roomId={roomId} onClose={undefined} {...chatProps} className="flex-1 min-h-0" />
      )}

      {tab === 'homework' && (
        <HomeworkPanel roomId={roomId} role="student"
          participantEmail={chatProps.participantEmail || ''}
          participantName={chatProps.participantName}
          className="flex-1" />
      )}

      {tab === 'attendance' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loading && !record ? (
            <div className="text-center text-xs text-[#8b8fa3] mt-8">Loading...</div>
          ) : !record ? (
            <div className="text-center text-xs text-[#8b8fa3] mt-8">No attendance data yet</div>
          ) : (
            <>
              {/* ── Live Duration Timer ────────── */}
              <div className="rounded-lg bg-[#1c1f26] p-4 border border-white/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-[#8b8fa3] uppercase tracking-widest">Active Duration</span>
                  </div>
                  {(() => {
                    const st = STATUS_CFG[record.status] || STATUS_CFG.absent;
                    return (
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-semibold border', st.bg, st.text, st.border)}>
                        {st.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-center py-1">
                  <div className="font-mono text-[32px] font-bold text-white tracking-[0.15em] tabular-nums leading-none">
                    {fmtTimer(liveSec)}
                  </div>
                  <div className="text-[10px] text-[#8b8fa3] mt-2 font-medium">Total time in session</div>
                </div>
              </div>

              {/* ── Stats ──────────────────────── */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={<IcClock className="w-3.5 h-3.5 text-[#8b8fa3]" />} label="Joined At" value={fmtTime(record.first_join_at)} />
                <StatCard icon={<IcRefresh className="w-3.5 h-3.5 text-[#8b8fa3]" />} label="Connections"
                  value={record.join_count === 1 ? '1 (stable)' : `${record.join_count} (${record.join_count - 1} rejoin${record.join_count > 2 ? 's' : ''})`}
                  warn={record.join_count > 1} />
                <StatCard icon={record.late_join ? <IcClock className="w-3.5 h-3.5 text-amber-400" /> : <IcCheck className="w-3.5 h-3.5 text-emerald-400" />}
                  label="Punctuality"
                  value={record.late_join ? `Late by ${fmtDuration(record.late_by_sec)}` : 'On Time'}
                  warn={record.late_join} />
                <StatCard icon={<IcTimeline className="w-3.5 h-3.5 text-[#8b8fa3]" />} label="Active Time"
                  value={fmtDuration(liveSec)} />
              </div>

              {/* ── Leave Status ────────────────── */}
              {record.leave_approved !== null && (
                <div className={cn('rounded-lg px-3 py-2 text-xs flex items-center gap-2 border',
                  record.leave_approved
                    ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/5 text-red-400 border-red-500/20',
                )}>
                  {record.leave_approved ? <IcCheck className="w-3.5 h-3.5" /> : <IcX className="w-3.5 h-3.5" />}
                  <span className="font-medium">Leave {record.leave_approved ? 'Approved' : 'Denied'}</span>
                </div>
              )}

              {/* ── Activity Timeline ──────────── */}
              <div className="rounded-lg bg-[#1c1f26] border border-white/[0.06] overflow-hidden">
                <button onClick={() => setShowTimeline(!showTimeline)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-2">
                    <IcTimeline className="w-3.5 h-3.5 text-[#8b8fa3]" />
                    <span className="text-[11px] font-semibold text-white">Activity Timeline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#8b8fa3]">{logs.length}</span>
                    <IcChevron className={cn('w-3.5 h-3.5 text-[#8b8fa3] transition-transform', showTimeline && 'rotate-180')} />
                  </div>
                </button>
                {showTimeline && (
                  <div className="border-t border-white/[0.06]">
                    {logs.length === 0 ? (
                      <div className="text-center text-[10px] text-[#8b8fa3] py-4">No events yet</div>
                    ) : (
                      <div className="relative pl-6 pr-3 py-2.5">
                        <div className="absolute left-[14px] top-2.5 bottom-2.5 w-px bg-white/[0.08]" />
                        {logs.map((log, i) => {
                          const isJoin = log.event_type === 'join' || log.event_type === 'rejoin';
                          const isLeave = log.event_type === 'leave';
                          let gapDuration: number | null = null;
                          if (isJoin && i > 0) {
                            const prev = logs[i - 1];
                            if (prev?.event_type === 'leave') {
                              gapDuration = Math.floor((new Date(log.event_at).getTime() - new Date(prev.event_at).getTime()) / 1000);
                            }
                          }
                          return (
                            <div key={i} className="relative flex items-start gap-2.5 pb-3 last:pb-0">
                              <div className={cn(
                                'absolute -left-[16px] top-[5px] h-2 w-2 rounded-full ring-2 ring-[#1c1f26]',
                                isJoin ? 'bg-emerald-400' : isLeave ? 'bg-red-400' :
                                log.event_type === 'late_join' ? 'bg-amber-400' :
                                log.event_type === 'leave_approved' ? 'bg-emerald-400' :
                                log.event_type === 'leave_denied' ? 'bg-red-400' : 'bg-[#8b8fa3]',
                              )} />
                              <div className="flex-1 min-w-0">
                                {gapDuration !== null && gapDuration > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] text-red-400/60 mb-0.5 -mt-0.5">
                                    <IcPause className="w-2.5 h-2.5" />
                                    <span>Offline {fmtDuration(gapDuration)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium text-white/90 capitalize">
                                    {log.event_type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] text-[#8b8fa3] ml-auto shrink-0">{fmtTime(log.event_at)}</span>
                                </div>
                                {log.payload && log.event_type === 'late_join' && (
                                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                                    Late by {fmtDuration(Number((log.payload as Record<string, number>).late_by_sec || 0))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Refresh ────────────────────── */}
              <button onClick={fetchData} disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] py-2 text-[11px] text-[#8b8fa3] hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40">
                <IcRefresh className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function StatCard({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-[#1c1f26] border border-white/[0.06] px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-[#8b8fa3] font-medium">{label}</span>
      </div>
      <div className={cn('text-xs font-semibold', warn ? 'text-amber-400' : 'text-white/90')}>
        {value}
      </div>
    </div>
  );
}
