// ═══════════════════════════════════════════════════════════════
// Owner — Teacher Management Module
// Full teacher overview: list, stats, schedule, cancellations
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, SearchInput, Button,
  StatCard, Card, Badge, StatusBadge, Avatar,
  LoadingState, EmptyState, Alert,
} from '@/components/dashboard/shared';
import { fmtSmartDateIST, fmtTimeIST } from '@/lib/utils';
import {
  BookOpen, Users, Radio, Calendar, Clock, CheckCircle2,
  XCircle, ChevronDown, ChevronRight, Timer, Info,
  UserCheck, UserX, Phone, GraduationCap, Briefcase,
  Award, Mail, MapPin, Activity, Eye, AlertTriangle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface Teacher {
  email: string;
  name: string;
  profile_image: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  phone: string | null;
  whatsapp: string | null;
  subjects: string[] | null;
  qualification: string | null;
  experience_years: number | null;
  assigned_region: string | null;
  total_classes: number;
  live_classes: number;
  upcoming_classes: number;
  completed_classes: number;
  cancelled_classes: number;
  today_classes: number;
  pending_cancellations: number;
}

interface Summary {
  total_teachers: number;
  active_teachers: number;
  teaching_today: number;
  total_live_classes: number;
  total_pending_cancellations: number;
}

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  notes_for_teacher: string | null;
  max_participants: number;
  student_count: number;
}

interface CancellationRequest {
  id: string;
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  scheduled_start: string;
  requested_by: string;
  requester_role: string;
  reason: string | null;
  cancellation_type: string;
  status: string;
  created_at: string;
}

interface AttendanceSummary {
  total_students: number;
  present: number;
  late: number;
  absent: number;
  left_early: number;
  avg_duration_sec: number;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
    return 'live';
  }
  if (room.status === 'ended') return 'ended';
  if (room.status === 'cancelled') return 'cancelled';
  // scheduled -> cancelled if scheduled end passed without going live
  if (room.status === 'scheduled') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'cancelled';
  }
  return room.status;
}

// ═══ Main Component ═══════════════════════════════════════════

export default function OwnerTeachersClient({ userName, userEmail, userRole }: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'live' | 'today'>('all');
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [teacherRooms, setTeacherRooms] = useState<Record<string, Room[]>>({});
  const [teacherCancellations, setTeacherCancellations] = useState<Record<string, CancellationRequest[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'schedule' | 'cancellations'>('schedule');

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/owner/teachers');
      const data = await res.json();
      if (data.success) {
        setTeachers(data.data?.teachers || []);
        setSummary(data.data?.summary || null);
      }
    } catch (err) {
      console.error('[OwnerTeachers] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeacherDetail = useCallback(async (email: string) => {
    setLoadingDetail(email);
    try {
      // Fetch the teacher's rooms (use the teacher rooms API as owner)
      // We'll get all rooms for this teacher from the general rooms listing
      const [roomsRes, cancelRes] = await Promise.all([
        fetch(`/api/v1/owner/dashboard`),
        fetch(`/api/v1/cancellations`),
      ]);
      const roomsData = await roomsRes.json();
      const cancelData = await cancelRes.json();

      if (roomsData.success) {
        const allRooms = (roomsData.data?.rooms || []) as (Room & { teacher_email?: string })[];
        const filtered = allRooms.filter((r) =>
          r.teacher_email === email
        );
        setTeacherRooms((prev) => ({ ...prev, [email]: filtered }));
      }

      if (cancelData.success) {
        const allRequests = (cancelData.data?.requests || []) as CancellationRequest[];
        const filtered = allRequests.filter((r) => r.requested_by === email);
        setTeacherCancellations((prev) => ({ ...prev, [email]: filtered }));
      }
    } catch (err) {
      console.error('[OwnerTeachers] detail fetch failed:', err);
    } finally {
      setLoadingDetail(null);
    }
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleExpand = (email: string) => {
    if (expandedEmail === email) {
      setExpandedEmail(null);
    } else {
      setExpandedEmail(email);
      setDetailTab('schedule');
      if (!teacherRooms[email]) {
        fetchTeacherDetail(email);
      }
    }
  };

  // Filter teachers
  const q = search.toLowerCase();
  const filtered = teachers.filter((t) => {
    const matchSearch = !q ||
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.subjects || []).some((s) => s.toLowerCase().includes(q));
    let matchFilter = true;
    if (filter === 'active') matchFilter = t.is_active;
    else if (filter === 'inactive') matchFilter = !t.is_active;
    else if (filter === 'live') matchFilter = t.live_classes > 0;
    else if (filter === 'today') matchFilter = t.today_classes > 0;
    return matchSearch && matchFilter;
  });

  const filterCounts = {
    all: teachers.length,
    active: teachers.filter((t) => t.is_active).length,
    inactive: teachers.filter((t) => !t.is_active).length,
    live: teachers.filter((t) => t.live_classes > 0).length,
    today: teachers.filter((t) => t.today_classes > 0).length,
  };

  if (loading && teachers.length === 0) {
    return (
      <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <PageHeader
            icon={BookOpen}
            title="Teacher Management"
            subtitle="Monitor all teachers, schedules, and cancellations"
          />
          <RefreshButton loading={loading} onClick={fetchTeachers} />
        </div>

        {/* Stats */}
        {summary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={Users} label="Total Teachers" value={summary.total_teachers} />
            <StatCard icon={UserCheck} label="Active" value={summary.active_teachers} variant="success" />
            <StatCard icon={Calendar} label="Teaching Today" value={summary.teaching_today} variant="info" />
            <StatCard icon={Radio} label="Live Now" value={summary.total_live_classes} variant="success" />
            <StatCard icon={AlertTriangle} label="Pending Cancellations" value={summary.total_pending_cancellations} variant="warning" />
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search teachers…" className="w-72" />
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'inactive', 'live', 'today'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
                {f === 'all' ? 'All' : f === 'today' ? 'Teaching Today' : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                  filter === f ? 'bg-white/20' : 'bg-white'
                }`}>
                  {filterCounts[f]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Teacher List */}
        {filtered.length === 0 ? (
          <EmptyState icon={Users} message={search ? 'No teachers match your search' : 'No teachers found'} />
        ) : (
          <div className="space-y-2">
            {filtered.map((teacher) => {
              const isExpanded = expandedEmail === teacher.email;
              const rooms = teacherRooms[teacher.email] || [];
              const cancellations = teacherCancellations[teacher.email] || [];
              const isLoadingDetail = loadingDetail === teacher.email;

              return (
                <Card key={teacher.email} className={`overflow-hidden transition-all ${isExpanded ? 'ring-1 ring-emerald-300' : ''}`}>
                  {/* Teacher row */}
                  <button
                    className="flex w-full items-center gap-4 p-4 text-left"
                    onClick={() => handleExpand(teacher.email)}
                  >
                    <Avatar name={teacher.name} src={teacher.profile_image} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{teacher.name}</p>
                        {!teacher.is_active && (
                          <Badge label="Inactive" variant="danger" />
                        )}
                        {teacher.live_classes > 0 && (
                          <Badge label={`${teacher.live_classes} Live`} variant="success" />
                        )}
                        {teacher.pending_cancellations > 0 && (
                          <Badge label={`${teacher.pending_cancellations} Pending`} variant="warning" />
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {teacher.email}
                        </span>
                        {teacher.subjects && teacher.subjects.length > 0 && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> {teacher.subjects.join(', ')}
                          </span>
                        )}
                        {teacher.assigned_region && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {teacher.assigned_region}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats mini */}
                    <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">{teacher.total_classes}</p>
                        <p className="text-[10px]">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-primary">{teacher.completed_classes}</p>
                        <p className="text-[10px]">Done</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-teal-600">{teacher.upcoming_classes}</p>
                        <p className="text-[10px]">Upcoming</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-red-500">{teacher.cancelled_classes}</p>
                        <p className="text-[10px]">Cancelled</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-amber-600">{teacher.today_classes}</p>
                        <p className="text-[10px]">Today</p>
                      </div>
                    </div>

                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {/* Profile details */}
                      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-b border-gray-100">
                        <ProfileField icon={Phone} label="Phone" value={teacher.phone} />
                        <ProfileField icon={Phone} label="WhatsApp" value={teacher.whatsapp} />
                        <ProfileField icon={GraduationCap} label="Qualification" value={teacher.qualification} />
                        <ProfileField icon={Briefcase} label="Experience" value={
                          teacher.experience_years != null
                            ? `${teacher.experience_years} year${teacher.experience_years !== 1 ? 's' : ''}`
                            : null
                        } />
                      </div>

                      {/* Detail sub-tabs */}
                      <div className="px-4 pt-3 flex items-center gap-2">
                        <button
                          onClick={() => setDetailTab('schedule')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            detailTab === 'schedule'
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> Sessions ({rooms.length})
                          </span>
                        </button>
                        <button
                          onClick={() => setDetailTab('cancellations')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            detailTab === 'cancellations'
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <XCircle className="h-3 w-3" /> Cancellations ({cancellations.length})
                          </span>
                        </button>
                        <a
                          href={`/classroom/${rooms.find((r) => effectiveStatus(r) === 'live')?.room_id}?mode=ghost`}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 ${
                            !rooms.some((r) => effectiveStatus(r) === 'live') ? 'pointer-events-none opacity-40' : ''
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Eye className="h-3 w-3" /> Ghost View
                          </span>
                        </a>
                      </div>

                      {/* Detail content */}
                      <div className="px-4 py-3">
                        {isLoadingDetail ? (
                          <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
                        ) : detailTab === 'schedule' ? (
                          <TeacherClassesPanel rooms={rooms} />
                        ) : (
                          <TeacherCancellationsPanel cancellations={cancellations} />
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ── Sub-components ────────────────────────────────────────────

function ProfileField({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value?: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className={`text-xs ${value ? 'text-gray-700' : 'text-gray-300 italic'}`}>
          {value || 'Not set'}
        </p>
      </div>
    </div>
  );
}

function TeacherClassesPanel({ rooms }: { rooms: Room[] }) {
  if (rooms.length === 0) {
    return <EmptyState icon={Calendar} message="No sessions found for this teacher" />;
  }

  // Sort: live first, then scheduled, then ended
  const sorted = [...rooms].sort((a, b) => {
    const order = { live: 0, scheduled: 1, ended: 2, cancelled: 3 };
    const oa = order[effectiveStatus(a) as keyof typeof order] ?? 2;
    const ob = order[effectiveStatus(b) as keyof typeof order] ?? 2;
    if (oa !== ob) return oa - ob;
    return new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime();
  });

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {sorted.slice(0, 20).map((room) => {
        const es = effectiveStatus(room);
        return (
          <div
            key={room.room_id}
            className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              es === 'live' ? 'bg-primary/5' :
              es === 'scheduled' ? 'bg-teal-50' :
              es === 'cancelled' ? 'bg-red-50' : 'bg-gray-100'
            }`}>
              {es === 'live' && <Radio className="h-4 w-4 text-primary" />}
              {es === 'scheduled' && <Calendar className="h-4 w-4 text-teal-600" />}
              {es === 'ended' && <CheckCircle2 className="h-4 w-4 text-gray-400" />}
              {es === 'cancelled' && <XCircle className="h-4 w-4 text-red-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{room.room_name}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{room.subject}</span>
                <span>·</span>
                <span>{room.grade}{room.section ? ` · ${room.section}` : ''}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {fmtSmartDateIST(room.scheduled_start)}
                </span>
                <span>·</span>
                <span>{fmtDuration(room.duration_minutes)}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {room.student_count}
                </span>
              </div>
            </div>
            <StatusBadge status={es} />
            {es === 'live' && (
              <a
                href={`/classroom/${room.room_id}?mode=ghost`}
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Ghost</span>
              </a>
            )}
          </div>
        );
      })}
      {rooms.length > 20 && (
        <p className="text-center text-xs text-gray-400 py-2">
          Showing 20 of {rooms.length} sessions
        </p>
      )}
    </div>
  );
}

function TeacherCancellationsPanel({ cancellations }: { cancellations: CancellationRequest[] }) {
  if (cancellations.length === 0) {
    return <EmptyState icon={XCircle} message="No cancellation requests from this teacher" />;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {cancellations.map((req) => (
        <div
          key={req.id}
          className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5"
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            req.status === 'approved' ? 'bg-primary/5' :
            req.status === 'rejected' ? 'bg-red-50' :
            'bg-amber-50'
          }`}>
            {req.status === 'approved' && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {req.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
            {!['approved', 'rejected'].includes(req.status) && <Clock className="h-4 w-4 text-amber-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{req.room_name}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{req.subject} · {req.grade}</span>
              <span>·</span>
              <span>{fmtSmartDateIST(req.scheduled_start)}</span>
              {req.reason && (
                <>
                  <span>·</span>
                  <span className="italic truncate max-w-48">{req.reason}</span>
                </>
              )}
            </div>
          </div>
          <StatusBadge status={req.status} />
          <Badge
            label={req.cancellation_type.replace(/_/g, ' ')}
            variant={req.cancellation_type === 'teacher_initiated' ? 'warning' : 'default'}
          />
        </div>
      ))}
    </div>
  );
}
