'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateBriefIST, fmtTimeIST } from '@/lib/utils';
import {
  EyeOff,
  Eye,
  Radio,
  Calendar,
  Clock,
  RefreshCw,
  Monitor,
  Users,
  BookOpen,
  User,
  Layers,
  LayoutGrid,
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

interface BatchGroup {
  batch_id: string;
  batch_name: string;
  rooms: Room[];
}

interface TeacherGroup {
  teacher_email: string;
  teacher_name: string;
  rooms: Room[];
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

type ViewMode = 'all' | 'batch' | 'teacher';

function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
    return 'live';
  }
  if (room.status === 'ended') return 'ended';
  if (room.status === 'cancelled') return 'cancelled';
  // scheduled rooms that never went live -> cancelled after scheduled end
  const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
  if (Date.now() >= endMs) return 'cancelled';
  return room.status;
}

export default function GhostDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'batch') {
        const res = await fetch('/api/v1/ghost/rooms?view=batch');
        const data = await res.json();
        if (data.success) setBatchGroups(data.data?.batches || []);
      } else if (viewMode === 'teacher') {
        const res = await fetch('/api/v1/ghost/rooms?view=teacher');
        const data = await res.json();
        if (data.success) setTeacherGroups(data.data?.teachers || []);
      } else {
        const res = await fetch('/api/v1/ghost/rooms');
        const data = await res.json();
        if (data.success) setRooms(data.data?.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const allRooms = viewMode === 'batch'
    ? batchGroups.flatMap(b => b.rooms as Room[])
    : viewMode === 'teacher'
    ? teacherGroups.flatMap(t => t.rooms as Room[])
    : rooms;
  const live = allRooms.filter((r) => effectiveStatus(r) === 'live');
  const scheduled = allRooms.filter((r) => effectiveStatus(r) === 'scheduled');

  const viewButtons: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { mode: 'all', label: 'All Sessions', icon: LayoutGrid },
    { mode: 'batch', label: 'By Batch', icon: BookOpen },
    { mode: 'teacher', label: 'By Teacher', icon: User },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <EyeOff className="h-6 w-6 text-emerald-600" /> Ghost Observer
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Silent observation mode — invisible to all participants
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 shrink-0">
          <EyeOff className="h-4 w-4 text-teal-600" />
        </div>
        <p>
          Ghost mode: You will not appear in participant lists. Your camera and mic are disabled.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Live Now</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{live.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Scheduled</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{scheduled.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{allRooms.length}</p>
        </div>
      </div>

      {/* View mode selector */}
      <div className="mb-6 flex items-center gap-2">
        {viewButtons.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              viewMode === mode
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={fetchRooms}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Oversight Console + Combined Monitor shortcuts */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="/ghost/monitor"
          className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <Monitor className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-800 group-hover:text-emerald-700 transition-colors">Oversight Console</h3>
            <p className="text-xs text-gray-400 mt-0.5">Multi-view grid of all sessions</p>
          </div>
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">Open</span>
        </a>
        {live.length > 1 && (
          <a
            href={`/ghost/monitor?mode=combined&rooms=${live.map(r => r.room_id).join(',')}`}
            className="group flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
              <Layers className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800">Combined Monitor</h3>
              <p className="text-xs text-green-600/70 mt-0.5">Watch all {live.length} live sessions</p>
            </div>
            <span className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">Enter</span>
          </a>
        )}
      </div>

      {loading && allRooms.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : viewMode === 'batch' ? (
        /* ── Batch-wise view ── */
        <div className="space-y-6">
          {batchGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-sm">No active batches</p>
            </div>
          ) : (
            batchGroups.map((batch) => {
              const batchLive = (batch.rooms as Room[]).filter(r => effectiveStatus(r) === 'live');
              const batchScheduled = (batch.rooms as Room[]).filter(r => effectiveStatus(r) === 'scheduled');
              return (
                <div key={batch.batch_id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/80">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-sm text-gray-800">{batch.batch_name}</span>
                      {batchLive.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> {batchLive.length} live
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{batch.rooms.length} session{batch.rooms.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {(batch.rooms as Room[]).map((room) => (
                      <RoomRow key={room.room_id} room={room} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : viewMode === 'teacher' ? (
        /* ── Teacher-wise view ── */
        <div className="space-y-6">
          {teacherGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <User className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-sm">No active teachers</p>
            </div>
          ) : (
            teacherGroups.map((teacher) => {
              const tLive = (teacher.rooms as Room[]).filter(r => effectiveStatus(r) === 'live');
              return (
                <div key={teacher.teacher_email} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/80">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        {teacher.teacher_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-sm text-gray-800">{teacher.teacher_name}</span>
                        <p className="text-[11px] text-gray-400">{teacher.teacher_email}</p>
                      </div>
                      {tLive.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> {tLive.length} live
                        </span>
                      )}
                    </div>
                    {tLive.length > 0 && (
                      <a
                        href={`/ghost/monitor?teacher=${encodeURIComponent(teacher.teacher_email)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 shadow-sm transition"
                      >
                        <Monitor className="h-3 w-3" /> Monitor All
                      </a>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {(teacher.rooms as Room[]).map((room) => (
                      <RoomRow key={room.room_id} room={room} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── All sessions (flat) ── */
        <div className="space-y-6">
          {/* Live */}
          {live.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-2">
                <Radio className="h-4 w-4 animate-pulse" /> Live — Enter Silently
              </h2>
              <div className="space-y-3">
                {live.map((room) => (
                  <RoomRow key={room.room_id} room={room} />
                ))}
              </div>
            </div>
          )}
          {/* Scheduled */}
          <div>
            <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Scheduled Sessions
            </h2>
            {scheduled.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p className="text-sm">No scheduled sessions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map((room) => (
                  <RoomRow key={room.room_id} room={room} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

/* ── Shared room row component ── */
function RoomRow({ room }: { room: Room }) {
  const isLive = effectiveStatus(room) === 'live';
  const d = new Date(room.scheduled_start);
  const elapsed = isLive ? Math.round((Date.now() - d.getTime()) / 60000) : 0;

  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 transition ${isLive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      {isLive ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 shrink-0">
          <Radio className="h-4 w-4 text-green-600 animate-pulse" />
        </div>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 shrink-0">
          <Calendar className="h-4 w-4 text-gray-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm text-gray-800 truncate">{room.room_name}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
          {room.subject && <span>{room.subject}</span>}
          {room.grade && <span>· {room.grade}</span>}
          {room.teacher_name && <span>· {room.teacher_name}</span>}
          {room.batch_name && <span className="text-gray-400">· {room.batch_name}</span>}
        </div>
      </div>
      {isLive ? (
        <>
          <span className="text-xs text-gray-500 shrink-0">{elapsed}m</span>
          <a
            href={`/classroom/${room.room_id}?mode=ghost`}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm shrink-0 transition"
          >
            <Eye className="h-3.5 w-3.5" /> Enter Ghost
          </a>
        </>
      ) : (
        <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Clock className="h-3 w-3" />
          {fmtDateBriefIST(d)} {fmtTimeIST(d)}
        </span>
      )}
    </div>
  );
}
