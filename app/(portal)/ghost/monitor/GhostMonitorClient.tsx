// ═══════════════════════════════════════════════════════════════
// Ghost Monitor Client — Oversight Console
// Batch-wise monitoring, combined multi-view, per-teacher views
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  Eye,
  Monitor,
  Radio,
  RefreshCw,
  Grid3X3,
  List,
  BookOpen,
  User,
  Layers,
  LayoutGrid,
  ArrowLeft,
} from 'lucide-react';

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  teacher_email: string | null;
  teacher_name: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  batch_id: string | null;
  batch_name: string | null;
  batch_type: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

type GroupMode = 'all' | 'batch' | 'teacher';

function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
    return 'live';
  }
  if (room.status === 'ended') return 'ended';
  if (room.status === 'cancelled') return 'cancelled';
  const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
  if (Date.now() >= endMs) return 'cancelled';
  return room.status;
}

export default function GhostMonitorClient({ userName, userEmail, userRole }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupMode, setGroupMode] = useState<GroupMode>('all');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // Parse URL params for combined/teacher mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'combined') {
      setGroupMode('all');
    }
    if (params.get('teacher')) {
      setGroupMode('teacher');
      setSelectedFilter(params.get('teacher'));
    }
    if (params.get('batch')) {
      setGroupMode('batch');
      setSelectedFilter(params.get('batch'));
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ghost/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const live = rooms.filter((r) => effectiveStatus(r) === 'live');

  // Group by batch
  const batchGroups = useMemo(() => {
    const map = new Map<string, { batch_id: string; batch_name: string; rooms: Room[] }>();
    for (const r of live) {
      const bid = r.batch_id || 'unlinked';
      if (!map.has(bid)) map.set(bid, { batch_id: bid, batch_name: r.batch_name || 'Standalone', rooms: [] });
      map.get(bid)!.rooms.push(r);
    }
    return Array.from(map.values());
  }, [live]);

  // Group by teacher
  const teacherGroups = useMemo(() => {
    const map = new Map<string, { email: string; name: string; rooms: Room[] }>();
    for (const r of live) {
      const email = r.teacher_email || 'unassigned';
      if (!map.has(email)) map.set(email, { email, name: r.teacher_name || email, rooms: [] });
      map.get(email)!.rooms.push(r);
    }
    return Array.from(map.values());
  }, [live]);

  // Filtered rooms for display
  const displayRooms = useMemo(() => {
    if (selectedFilter && groupMode === 'teacher') {
      return live.filter(r => r.teacher_email === selectedFilter);
    }
    if (selectedFilter && groupMode === 'batch') {
      return live.filter(r => r.batch_id === selectedFilter);
    }
    return live;
  }, [live, selectedFilter, groupMode]);

  const groupModeButtons: { mode: GroupMode; label: string; icon: typeof LayoutGrid }[] = [
    { mode: 'all', label: 'All', icon: LayoutGrid },
    { mode: 'batch', label: 'By Batch', icon: BookOpen },
    { mode: 'teacher', label: 'By Teacher', icon: User },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <a href="/ghost" className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
              <ArrowLeft className="h-4 w-4" />
            </a>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Monitor className="h-6 w-6 text-primary" /> Oversight Console
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 ml-10">
            Monitor all live sessions — auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 transition ${viewMode === 'grid' ? 'bg-primary/5 text-primary' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg p-2 transition ${viewMode === 'list' ? 'bg-primary/5 text-primary' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={fetchRooms}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live count banner */}
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
        </div>
        <span className="text-sm text-green-800">
          <span className="font-bold">{live.length}</span>{' '}
          {live.length === 1 ? 'session' : 'sessions'} live right now
        </span>
        {selectedFilter && (
          <button
            onClick={() => setSelectedFilter(null)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            Clear filter · Showing {displayRooms.length}/{live.length}
          </button>
        )}
      </div>

      {/* Group mode selector */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {groupModeButtons.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => { setGroupMode(mode); setSelectedFilter(null); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              groupMode === mode ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}

        {/* Quick filter chips */}
        {groupMode === 'batch' && !selectedFilter && batchGroups.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-2">
            {batchGroups.map(bg => (
              <button
                key={bg.batch_id}
                onClick={() => setSelectedFilter(bg.batch_id)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition"
              >
                {bg.batch_name} ({bg.rooms.length})
              </button>
            ))}
          </div>
        )}
        {groupMode === 'teacher' && !selectedFilter && teacherGroups.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-2">
            {teacherGroups.map(tg => (
              <button
                key={tg.email}
                onClick={() => setSelectedFilter(tg.email)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition"
              >
                {tg.name} ({tg.rooms.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading rooms...
        </div>
      ) : displayRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Monitor className="mb-3 h-12 w-12 opacity-40" />
          <p className="text-sm">No live sessions{selectedFilter ? ' matching filter' : ' at the moment'}</p>
          <p className="mt-1 text-xs text-gray-400">
            Live sessions will appear here automatically
          </p>
        </div>
      ) : groupMode !== 'all' && !selectedFilter ? (
        /* ── Grouped cards view ── */
        <div className="space-y-6">
          {(groupMode === 'batch' ? batchGroups : teacherGroups).map((group) => {
            const g = group as { batch_id?: string; batch_name?: string; email?: string; name?: string; rooms: Room[] };
            const key = g.batch_id || g.email || 'unknown';
            const label = g.batch_name || g.name || key;
            return (
              <div key={key} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    {groupMode === 'batch' ? (
                      <BookOpen className="h-4 w-4 text-primary" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/5 text-primary flex items-center justify-center text-xs font-bold">
                        {label.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-sm text-gray-800">{label}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Radio className="h-2.5 w-2.5 animate-pulse" /> {g.rooms.length} live
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedFilter(key)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary/90 shadow-sm transition"
                  >
                    <Layers className="h-3 w-3" /> Focus
                  </button>
                </div>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.rooms.map((room) => <RoomCard key={room.room_id} room={room} />)}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {g.rooms.map((room) => <RoomListItem key={room.room_id} room={room} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Flat grid view ── */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayRooms.map((room) => <RoomCard key={room.room_id} room={room} />)}
        </div>
      ) : (
        /* ── Flat list view ── */
        <div className="space-y-3">
          {displayRooms.map((room) => <RoomListItem key={room.room_id} room={room} />)}
        </div>
      )}
    </DashboardShell>
  );
}

/* ── Room grid card ── */
function RoomCard({ room }: { room: Room }) {
  const elapsed = Math.round((Date.now() - new Date(room.scheduled_start).getTime()) / 60000);
  return (
    <div className="rounded-xl border border-primary/20 bg-white shadow-sm overflow-hidden">
      <div className="relative bg-primary/5 h-36 flex items-center justify-center">
        <Radio className="h-8 w-8 text-green-500 animate-pulse" />
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
          <Radio className="h-2.5 w-2.5" /> LIVE
        </div>
        <div className="absolute top-2 right-2 text-[10px] text-gray-500 bg-white/80 border border-gray-200 rounded px-1.5 py-0.5">
          {elapsed}m elapsed
        </div>
        {room.batch_name && (
          <div className="absolute bottom-2 left-2 text-[10px] text-gray-600 bg-white/80 border border-gray-200 rounded px-1.5 py-0.5">
            {room.batch_name}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm text-gray-800 truncate">{room.room_name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {room.subject} · {room.grade}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {room.teacher_name || room.teacher_email || '—'}
        </p>
        <a
          href={`/classroom/${room.room_id}?mode=ghost`}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-medium text-white hover:bg-primary/90 shadow-sm transition"
        >
          <Eye className="h-3.5 w-3.5" /> Enter Ghost Mode
        </a>
      </div>
    </div>
  );
}

/* ── Room list item ── */
function RoomListItem({ room }: { room: Room }) {
  const elapsed = Math.round((Date.now() - new Date(room.scheduled_start).getTime()) / 60000);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-white shadow-sm p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <Radio className="h-4 w-4 text-primary animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 truncate">{room.room_name}</h3>
        <p className="text-xs text-gray-500">
          {room.subject} · {room.grade} · {room.teacher_name || room.teacher_email || '—'}
          {room.batch_name && <span className="text-gray-400"> · {room.batch_name}</span>}
        </p>
      </div>
      <span className="text-xs text-gray-500 shrink-0">{elapsed}m</span>
      <a
        href={`/classroom/${room.room_id}?mode=ghost`}
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 shadow-sm shrink-0 transition"
      >
        <Eye className="h-3.5 w-3.5" /> Enter Ghost
      </a>
    </div>
  );
}
