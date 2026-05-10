// ===============================================================
// Academic Operator Dashboard — Client Component (v3)
// Batch-centric: view batches, schedule sessions, create batches,
// change teachers, day-of-week recurring sessions,
// expanded batch detail with students & parents.
// ===============================================================

'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import DashboardShell from '@/components/dashboard/DashboardShell';
import DiscontinuedStudentsPanel from '@/components/dashboard/DiscontinuedStudentsPanel';
import ExtensionRequestsPanel from '@/components/dashboard/ExtensionRequestsPanel';
import TeacherReportsTab from '@/components/dashboard/TeacherReportsTab';
import StudentReportsTab from '@/components/dashboard/StudentReportsTab';
import DemoTab from '@/components/dashboard/DemoTab';
import ConferenceTab from '@/components/dashboard/ConferenceTab';
import OpenClassroomTab from '@/components/dashboard/OpenClassroomTab';
import TeacherControlsTab from '@/components/dashboard/TeacherControlsTab';
import AOManagementPanel from '@/components/dashboard/AOManagementPanel';
import SessionCalendar from '@/components/dashboard/SessionCalendar';
import SessionReportView from '@/components/dashboard/SessionReportView';
import BatchReportModal from '@/components/dashboard/BatchReportModal';
import AutoScheduleModal from '@/components/dashboard/AutoScheduleModal';
import {
  PageHeader, RefreshButton, Button, IconButton, TabBar,
  SearchInput, FilterSelect,
  FormField, FormGrid, Input, Select, Textarea,
  TableWrapper, THead, TH, TRow,
  StatCard, InfoCard, Badge, StatusBadge,
  LoadingState, EmptyState, Alert,
  useToast, useConfirm, Avatar,
  Modal, FormActions,
} from '@/components/dashboard/shared';
import { CreateUserModal, STUDENT_REGIONS } from '@/components/dashboard/CreateUserForm';
import UsersTab from '@/components/dashboard/UsersTab';
import EnrollmentLinkModal from '@/components/dashboard/EnrollmentLinkModal';
import ManualEnrollModal from '@/components/dashboard/ManualEnrollModal';
import QuestionViewer, { ViewQuestion } from '@/components/exam/QuestionViewer';
import { getChapters } from '@/lib/curriculum-data';
import { istToRegionTime, groupStudentsByTimezone } from '@/lib/region-timezone';
import {
  LayoutDashboard, Calendar, Clock, Users, BookOpen,
  GraduationCap, PlayCircle, PlusCircle, Eye, StopCircle,
  Radio, CheckCircle2, XCircle, ChevronDown, ChevronRight, ChevronLeft,
  Link2, Copy, ExternalLink, Video, MapPin, CalendarDays, ArrowRight,
  AlertTriangle, Zap, X, FileText, Plus, User, Pencil, TrendingUp,
  CheckCircle, AlertCircle, Layers, Trash2, RefreshCw, Repeat,
  Database, Save, Send, Table2, FolderOpen, Upload, Check,
  CalendarClock, Ban, ClipboardList, Briefcase, UserPlus, ArrowRightLeft, Flag,
  Sparkles, Loader2, Globe, MoreVertical, CreditCard, UserCheck, BarChart3, Tv, ArchiveRestore,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
  PieChart, Pie,
  AreaChart, Area,
} from 'recharts';

// --- Constants ----------------------------------------------
const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DEFAULT_GRADES = ['8', '9', '10', '11', '12'];

// Grades 8-10: subjects auto-assigned from academic calendar
const GRADE_SUBJECTS: Record<string, string[]> = {
  '8': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  '9': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  '10': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};
const DEFAULT_CATEGORIES = ['A', 'B', 'C'];
const DEFAULT_SECTIONS = DEFAULT_CATEGORIES;
const DEFAULT_BOARDS = [
  'CBSE',
  'ICSE',
  'ISC',
  'State Board',
  'IB (International Baccalaureate)',
  'IGCSE (Cambridge)',
  'NIOS',
  'SSC',
  'HSC',
  'Matriculation Board',
  'Anglo Indian Board',
];

const BATCH_TEMPLATES = [
  // ── 1:1 Individual (per-class fee) ─────────────────────────────────
  { id: 'one_to_one_Physics',     type: 'one_to_one' as const, subjectLabel: 'Physics',          subjects: ['Physics'],                                               label: '1:1 — Physics',          maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_Chemistry',   type: 'one_to_one' as const, subjectLabel: 'Chemistry',        subjects: ['Chemistry'],                                             label: '1:1 — Chemistry',        maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_Biology',     type: 'one_to_one' as const, subjectLabel: 'Biology',          subjects: ['Biology'],                                               label: '1:1 — Biology',          maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_Mathematics', type: 'one_to_one' as const, subjectLabel: 'Mathematics',      subjects: ['Mathematics'],                                           label: '1:1 — Mathematics',      maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_PCB',         type: 'one_to_one' as const, subjectLabel: 'PCB',              subjects: ['Physics', 'Chemistry', 'Biology'],                        label: '1:1 — PCB',              maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_PCM',         type: 'one_to_one' as const, subjectLabel: 'PCM',              subjects: ['Physics', 'Chemistry', 'Mathematics'],                   label: '1:1 — PCM',              maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_PCBM',        type: 'one_to_one' as const, subjectLabel: 'PCBM (All 4)',     subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],         label: '1:1 — PCBM',             maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  // ── 1:3 Small Group (per-class fee) ─────────────────────────────────
  { id: 'one_to_three_Physics',     type: 'one_to_three' as const, subjectLabel: 'Physics',        subjects: ['Physics'],                                               label: '1:3 — Physics',          maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_Chemistry',   type: 'one_to_three' as const, subjectLabel: 'Chemistry',      subjects: ['Chemistry'],                                             label: '1:3 — Chemistry',        maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_Biology',     type: 'one_to_three' as const, subjectLabel: 'Biology',        subjects: ['Biology'],                                               label: '1:3 — Biology',          maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_Mathematics', type: 'one_to_three' as const, subjectLabel: 'Mathematics',    subjects: ['Mathematics'],                                           label: '1:3 — Mathematics',      maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_PCB',         type: 'one_to_three' as const, subjectLabel: 'PCB',            subjects: ['Physics', 'Chemistry', 'Biology'],                        label: '1:3 — PCB',              maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_PCM',         type: 'one_to_three' as const, subjectLabel: 'PCM',            subjects: ['Physics', 'Chemistry', 'Mathematics'],                   label: '1:3 — PCM',              maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_PCBM',        type: 'one_to_three' as const, subjectLabel: 'PCBM (All 4)',   subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],         label: '1:3 — PCBM',             maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  // ── 1:15 GCC CBSE Group (monthly fee) ───────────────────────────────
  { id: 'one_to_fifteen_PCB',  type: 'one_to_fifteen' as const, subjectLabel: 'PCB',  subjects: ['Physics', 'Chemistry', 'Biology'],              label: '1:15 — PCB',  maxStudents: 15,  color: 'bg-teal-50 border-teal-200 text-teal-700',     selectedColor: 'bg-teal-100 border-teal-500 ring-2 ring-teal-300 text-teal-800' },
  { id: 'one_to_fifteen_PCM',  type: 'one_to_fifteen' as const, subjectLabel: 'PCM',  subjects: ['Physics', 'Chemistry', 'Mathematics'],          label: '1:15 — PCM',  maxStudents: 15,  color: 'bg-teal-50 border-teal-200 text-teal-700',     selectedColor: 'bg-teal-100 border-teal-500 ring-2 ring-teal-300 text-teal-800' },
  // ── 1:30 Kerala CBSE Group (monthly fee) ────────────────────────────
  { id: 'one_to_thirty_PCBM', type: 'one_to_thirty' as const, subjectLabel: 'PCBM', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],               label: '1:30 — PCBM', maxStudents: 30,  color: 'bg-purple-50 border-purple-200 text-purple-700', selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300 text-purple-800' },
  { id: 'one_to_thirty_PCSM', type: 'one_to_thirty' as const, subjectLabel: 'PCSM', subjects: ['Physics', 'Chemistry', 'Computer Science', 'Mathematics'], label: '1:30 — PCSM', maxStudents: 30,  color: 'bg-purple-50 border-purple-200 text-purple-700', selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300 text-purple-800' },
  // ── 1:M Kerala State Board (monthly fee) ────────────────────────────
  { id: 'one_to_many_Physics',      type: 'one_to_many' as const, subjectLabel: 'Physics',          subjects: ['Physics'],                                                label: '1:M — Physics',          maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_Chemistry',    type: 'one_to_many' as const, subjectLabel: 'Chemistry',        subjects: ['Chemistry'],                                              label: '1:M — Chemistry',        maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_Biology',      type: 'one_to_many' as const, subjectLabel: 'Biology',          subjects: ['Biology'],                                                label: '1:M — Biology',          maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_Mathematics',  type: 'one_to_many' as const, subjectLabel: 'Mathematics',      subjects: ['Mathematics'],                                            label: '1:M — Mathematics',      maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_CS',           type: 'one_to_many' as const, subjectLabel: 'Computer Science', subjects: ['Computer Science'],                                        label: '1:M — Computer Science', maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_PCB',          type: 'one_to_many' as const, subjectLabel: 'PCB',              subjects: ['Physics', 'Chemistry', 'Biology'],                         label: '1:M — PCB',              maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_PCM',          type: 'one_to_many' as const, subjectLabel: 'PCM',              subjects: ['Physics', 'Chemistry', 'Mathematics'],                     label: '1:M — PCM',              maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_PCBM',         type: 'one_to_many' as const, subjectLabel: 'PCBM',             subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],          label: '1:M — PCBM',             maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
  { id: 'one_to_many_PCSM',         type: 'one_to_many' as const, subjectLabel: 'PCSM',             subjects: ['Physics', 'Chemistry', 'Computer Science', 'Mathematics'],label: '1:M — PCSM',             maxStudents: 999, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300 text-indigo-800' },
];

type BatchType = 'one_to_one' | 'one_to_three' | 'one_to_fifteen' | 'one_to_thirty' | 'one_to_many' | 'lecture' | 'improvement_batch' | 'custom';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

// --- Types --------------------------------------------------
export interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  subjects: string[] | null;
  grade: string;
  section: string | null;
  board: string | null;
  coordinator_email: string | null;
  coordinator_name: string | null;
  academic_operator_email: string | null;
  academic_operator_name: string | null;
  max_students: number;
  status: string;
  notes: string | null;
  created_at: string;
  student_count: number;
  teacher_count: number;
  teachers: { teacher_email: string; teacher_name: string; teacher_image?: string | null; subject: string }[];
}

interface StudentAttendance {
  student_email: string;
  student_name: string;
  total_sessions: number;
  present: number;
  late: number;
  absent: number;
  left_early: number;
  not_joined: number;
  avg_attention: number;
  total_duration_sec: number;
}

interface BatchDetail {
  batch: Batch;
  students: BatchStudent[];
  teachers: { teacher_email: string; teacher_name: string | null; teacher_image?: string | null; subject: string; added_at?: string }[];
  attendance: StudentAttendance[];
}

interface BatchStudent {
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  student_region: string | null;
  added_at: string;
  total_classes: number | null;
  present: number | null;
  attendance_rate: number | null;
}

export interface Session {
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

interface JoinLink {
  email: string;
  name: string;
  role: string;
  token: string;
  join_url: string;
}

interface Person {
  email: string;
  full_name: string;
  portal_role: string;
  phone: string | null;
  subjects: string[] | null;
  grade: string | null;
  board: string | null;
  parent_email: string | null;
  parent_name: string | null;
  profile_image?: string | null;
  category?: string | null;
  assigned_region?: string | null;
  current_batches?: { batch_id: string; batch_name: string }[];
  preferred_batch_type?: string | null;
}

// -- Teacher Picker Dropdown (shows avatar + name + subjects) ------------
function TeacherPickerSelect({
  value, onChange, teachers,
}: {
  value: string;
  onChange: (val: string) => void;
  teachers: { email: string; full_name: string; subjects: string[] | null; profile_image?: string | null }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
  const ref = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const selected = teachers.find(t => t.email === value);

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen(o => !o);
  };

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 bg-white text-left transition-all ${
          open ? 'border-primary ring-2 ring-primary/15' : 'border-gray-200 hover:border-emerald-300'
        }`}
      >
        {selected ? (
          <>
            {selected.profile_image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={selected.profile_image} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
              : <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{selected.full_name.charAt(0)}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{selected.full_name}</p>
              {selected.subjects && <p className="text-xs text-gray-400 truncate">{selected.subjects.join(', ')}</p>}
            </div>
          </>
        ) : (
          <span className="text-sm text-gray-400 flex-1">Select Teacher…</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div style={dropdownStyle} className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full flex items-center px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 transition"
          >
            — Select Teacher —
          </button>
          {teachers.map(t => (
            <button
              key={t.email}
              type="button"
              onClick={() => { onChange(t.email); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 transition hover:bg-primary/5 ${t.email === value ? 'bg-primary/5' : ''}`}
            >
              {t.profile_image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.profile_image} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                : <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{t.full_name.charAt(0)}</div>
              }
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-800 truncate">{t.full_name}</p>
                {t.subjects && <p className="text-xs text-gray-400 truncate">{t.subjects.join(', ')}</p>}
              </div>
              {t.email === value && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface AcademicOperatorDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

// --- Helpers ------------------------------------------------
const BATCH_TYPE_LABELS: Record<string, string> = { one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15', one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture', improvement_batch: 'Improvement', custom: 'Custom' };
const BATCH_TYPE_VARIANTS: Record<string, 'info' | 'primary' | 'warning' | 'default'> = { one_to_one: 'info', one_to_three: 'primary', one_to_fifteen: 'primary', one_to_thirty: 'warning', one_to_many: 'warning', lecture: 'warning', improvement_batch: 'default', custom: 'default' };

function fmtTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  // Handle both "2026-02-26" and "2026-02-26T00:00:00.000Z" formats
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

// ── Session Actions Dropdown ────────────────────────────────
function SessionActionsDropdown({
  session,
  onEdit,
  onSwap,
  onCancel,
  onDelete,
  onEnd,
  onObserve,
  onViewReport,
}: {
  session: Session;
  onEdit?: () => void;
  onSwap?: () => void;
  onCancel?: (() => void) | ((s: Session) => void);
  onDelete?: (() => void) | ((s: Session) => void);
  onEnd?: (() => void) | ((s: Session) => void);
  onObserve?: () => void;
  onViewReport?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const es = effectiveSessionStatus(session);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && !btnRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const scrollHandler = () => setOpen(false);
    window.addEventListener('scroll', scrollHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', scrollHandler, true);
    };
  }, [open]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right - 160 });
    setOpen(v => !v);
  };

  const call = (fn?: (() => void) | ((s: Session) => void)) => {
    setOpen(false);
    if (!fn) return;
    (fn as (s: Session) => void)(session);
  };

  const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];

  if (es === 'scheduled') {
    if (onEdit) items.push({ label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => { setOpen(false); onEdit(); } });
    if (onSwap) items.push({ label: 'Swap with…', icon: <ArrowRightLeft className="h-3.5 w-3.5" />, onClick: () => { setOpen(false); onSwap(); } });
    if (onCancel) items.push({ label: 'Cancel Session', icon: <XCircle className="h-3.5 w-3.5" />, onClick: () => call(onCancel), danger: true });
    if (onDelete) items.push({ label: 'Delete Permanently', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => call(onDelete), danger: true });
  }
  if (es === 'live') {
    if (onObserve) items.push({ label: 'Observe', icon: <Eye className="h-3.5 w-3.5" />, onClick: () => { setOpen(false); onObserve(); } });
    if (onEnd) items.push({ label: 'End Session', icon: <StopCircle className="h-3.5 w-3.5" />, onClick: () => call(onEnd), danger: true });
  }
  if (es === 'ended' || es === 'cancelled') {
    if (onViewReport && es === 'ended') items.push({ label: 'View Report', icon: <FileText className="h-3.5 w-3.5" />, onClick: () => { setOpen(false); onViewReport!(); } });
    if (onDelete) items.push({ label: 'Delete Permanently', icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => call(onDelete), danger: true });
  }

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: Math.max(8, pos.left), zIndex: 9999 }}
          className="min-w-[168px] rounded-xl border border-gray-200 bg-white shadow-xl py-1"
          onMouseDown={e => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

/** Ended should only reflect explicit manual end persisted in DB status. */
function effectiveSessionStatus(s: Session): string {
  if (s.status === 'ended') return 'ended';
  if (s.status === 'live') return 'live';
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'scheduled') return 'scheduled';
  return s.status;
}

function todayISO(): string {
  const d = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + offset);
  return ist.toISOString().slice(0, 10);
}

/** Current IST time in minutes since midnight */
function nowISTMinutes(): number {
  const d = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + offset);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** IST now + 30 min, rounded up to nearest 5-min mark */
function defaultStartTime(): string {
  const raw = nowISTMinutes() + 30;
  const rounded = Math.ceil(raw / 5) * 5;
  const clamped = Math.min(rounded, 22 * 60); // cap at 10 PM
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format minutes since midnight to HH:MM */
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Subject group colors for visual distinction
const SUBJECT_COLORS: { bg: string; border: string; text: string; dot: string }[] = [
  { bg: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary', dot: 'bg-primary' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
];

function groupSessionsBySubject(sessions: Session[]): { subject: string; sessions: Session[]; color: typeof SUBJECT_COLORS[0] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = map.get(s.subject) || [];
    list.push(s);
    map.set(s.subject, list);
  }
  return Array.from(map.entries()).map(([subject, sessionsArr], idx) => ({
    subject,
    sessions: sessionsArr,
    color: SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
  }));
}

function batchTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    one_to_one: 'One-to-One', one_to_three: 'One-to-Three',
    one_to_fifteen: 'One-to-Fifteen', one_to_thirty: 'One-to-Thirty',
    one_to_many: 'Large Classroom', lecture: 'Lecture',
    improvement_batch: 'Improvement Batch', custom: 'Custom',
  };
  return labels[t] || t;
}

function batchTypeBadgeVariant(t: string): 'primary' | 'success' | 'info' | 'warning' | 'default' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = { one_to_one: 'primary', one_to_three: 'success', one_to_fifteen: 'info', one_to_thirty: 'info', one_to_many: 'info', lecture: 'warning', improvement_batch: 'warning', custom: 'warning' };
  return map[t] || 'default';
}

// Get dates for given day-of-week names from a start date for N weeks or N months
function getDatesForDays(days: string[], startDate: string, count: number, unit: 'weeks' | 'months' = 'months'): { day: string; date: string }[] {
  const dayToIdx: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const dates: { day: string; date: string }[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  if (unit === 'months') {
    end.setMonth(end.getMonth() + count);
  } else {
    end.setDate(end.getDate() + count * 7);
  }
  // Iterate week by week from start until end date
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7) + 1;
  for (let w = 0; w < totalWeeks; w++) {
    for (const day of days) {
      const target = dayToIdx[day];
      const d = new Date(start);
      d.setDate(d.getDate() + w * 7);
      const current = d.getDay();
      const diff = (target - current + 7) % 7;
      d.setDate(d.getDate() + diff);
      if (d >= start && d < end) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!dates.find(x => x.date === iso)) {
          dates.push({ day, date: iso });
        }
      }
    }
  }
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates;
}

// --- Tab Config ---------------------------------------------
type AOTab = 'overview' | 'batches' | 'sessions' | 'students' | 'teachers' | 'materials' | 'exam-topics' | 'monitoring' | 'requests' | 'demo' | 'teacher-reports' | 'payments' | 'conference' | 'open-classroom' | 'todays-live' | 'settings';

interface AOSessionRequest {
  id: string;
  request_type: 'reschedule' | 'cancel';
  requester_email: string;
  requester_name: string;
  requester_role: string;
  batch_session_id: string;
  batch_id: string;
  reason: string;
  proposed_date: string | null;
  proposed_time: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  batch_name?: string;
  subject?: string;
  session_date?: string;
}

interface AOLeaveRequest {
  id: string;
  teacher_email: string;
  teacher_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  ao_reviewed_by: string | null;
  ao_reviewed_at: string | null;
  hr_status: string;
  hr_notes: string | null;
  affected_sessions: string[];
  sessions_managed: boolean;
  requester_role: string;
  resolution_plan: { session_id: string; action: string; substitute_email?: string; substitute_name?: string; new_date?: string; new_time?: string; notes?: string; subject_override?: string; original_subject?: string }[];
  forwarded_at: string | null;
  confirmed_at: string | null;
  medical_certificate_url: string | null;
  medical_certificate_name: string | null;
  salary_adjustment: 'full_pay' | 'half_pay' | 'no_pay' | null;
  created_at: string;
}

interface MonitoringAlertAO {
  id: string;
  room_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  target_email: string | null;
  status: string;
  created_at: string;
}

interface VideoAccessRequestAO {
  id: string;
  room_id: string;
  student_email: string;
  student_name: string | null;
  reason: string;
  status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  recording_url: string | null;
  room_recording_url: string | null;
  room_name: string;
  subject: string;
  grade: string | null;
  teacher_name: string | null;
  scheduled_start: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const AO_TABS = ['overview', 'batches', 'sessions', 'students', 'teachers', 'materials', 'exam-topics', 'monitoring', 'requests', 'demo', 'teacher-reports', 'payments', 'conference', 'open-classroom', 'todays-live', 'settings'] as const;
function readHashTab(): AOTab {
  if (typeof window === 'undefined') return 'overview';
  const h = window.location.hash.replace('#', '');
  return (AO_TABS as readonly string[]).includes(h) ? h as AOTab : 'overview';
}

// --- Main Dashboard -----------------------------------------
export default function AcademicOperatorDashboardClient({ userName, userEmail, userRole }: AcademicOperatorDashboardClientProps) {
  const [tab, setTab] = useState<AOTab>(readHashTab);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [monitorAlerts, setMonitorAlerts] = useState<MonitoringAlertAO[]>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<AOSessionRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<AOLeaveRequest[]>([]);
  const [videoAccessRequests, setVideoAccessRequests] = useState<VideoAccessRequestAO[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [loadingVideoRequests, setLoadingVideoRequests] = useState(false);
  const toast = useToast();

  const fetchMonitorAlerts = useCallback(async (background = false) => {
    if (!background) setLoadingMonitor(true);
    try {
      const res = await fetch('/api/v1/monitoring/alerts');
      const data = await res.json();
      if (data.success) setMonitorAlerts(data.data?.alerts || []);
    } catch { /* ignore */ }
    finally { if (!background) setLoadingMonitor(false); }
  }, []);

  const fetchBatches = useCallback(async (q = '', isSearch = false, background = false) => {
    if (!isSearch && !background) setLoading(true);
    try {
      const url = q ? `/api/v1/batches?q=${encodeURIComponent(q)}` : '/api/v1/batches';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setBatches(data.data?.batches || []);
    } catch { if (!background) toast.error('Failed to load batches'); }
    finally { if (!isSearch && !background) setLoading(false); }
  }, [toast]);

  const fetchSessions = useCallback(async (background = false) => {
    if (!background) setLoadingSessions(true);
    try {
      const res = await fetch('/api/v1/batch-sessions');
      const data = await res.json();
      if (data.success) setSessions(data.data?.sessions || []);
    } catch { if (!background) toast.error('Failed to load sessions'); }
    finally { if (!background) setLoadingSessions(false); }
  }, [toast]);

  const [requestsFetched, setRequestsFetched] = useState(false);
  const [leaveFetched, setLeaveFetched] = useState(false);

  const fetchSessionRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.data?.requests ?? []);
      setRequestsFetched(true);
    } catch { /* */ }
    finally { setLoadingRequests(false); }
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    setLoadingLeave(true);
    try {
      const res = await fetch('/api/v1/teacher-leave');
      const data = await res.json();
      if (data.success) setLeaveRequests(data.data?.requests ?? []);
      setLeaveFetched(true);
    } catch { /* */ }
    finally { setLoadingLeave(false); }
  }, []);

  const [videoRequestsFetched, setVideoRequestsFetched] = useState(false);
  const fetchVideoAccessRequests = useCallback(async () => {
    setLoadingVideoRequests(true);
    try {
      const res = await fetch('/api/v1/recording/requests?status=all');
      const data = await res.json();
      if (data.success) setVideoAccessRequests(data.data ?? []);
      setVideoRequestsFetched(true);
    } catch { /* */ }
    finally { setLoadingVideoRequests(false); }
  }, []);

  useEffect(() => { fetchBatches(); fetchSessions(); fetchMonitorAlerts(); }, [fetchBatches, fetchSessions, fetchMonitorAlerts]);

  // Pause all background refresh intervals on form-heavy tabs (students, teachers)
  // to prevent parent re-renders that could disrupt open modals/forms
  const pauseRefresh = tab === 'students' || tab === 'teachers';

  // Auto-refresh monitoring alerts every 30s (background — no loading spinner)
  useEffect(() => {
    if (pauseRefresh) return;
    const iv = setInterval(() => fetchMonitorAlerts(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchMonitorAlerts, pauseRefresh]);

  // Auto-refresh sessions every 30s (background — no loading spinner)
  useEffect(() => {
    if (pauseRefresh) return;
    const iv = setInterval(() => fetchSessions(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchSessions, pauseRefresh]);

  // Auto-refresh batches every 60s (background)
  useEffect(() => {
    if (pauseRefresh) return;
    const iv = setInterval(() => fetchBatches('', false, true), 60_000);
    return () => clearInterval(iv);
  }, [fetchBatches, pauseRefresh]);

  // -- Auto-start polling: check every 60s for sessions whose prep window opened --
  useEffect(() => {
    if (pauseRefresh) return;
    let mounted = true;
    const autoStart = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/auto-start', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.started > 0) {
          toast.success(`Auto-started ${data.data.started} session${data.data.started > 1 ? 's' : ''} (prep time open)`);
          fetchSessions(true);
        }
      } catch { /* silent */ }
    };
    autoStart(); // run immediately on mount
    const iv = setInterval(autoStart, 60_000); // then every 60s
    return () => { mounted = false; clearInterval(iv); };
  }, [toast, fetchSessions, pauseRefresh]);

  // -- Daily timetable email: send once every morning --
  useEffect(() => {
    if (pauseRefresh) return;
    let mounted = true;
    const sendTimetable = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/daily-timetable', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.sent > 0) {
          toast.success(`Daily timetable sent to ${data.data.sent} recipient${data.data.sent > 1 ? 's' : ''}`);
        }
      } catch { /* silent */ }
    };
    sendTimetable(); // check on mount
    const iv = setInterval(sendTimetable, 5 * 60_000); // re-check every 5 min (deduped server-side)
    return () => { mounted = false; clearInterval(iv); };
  }, [toast, pauseRefresh]);

  // -- Session reminder email: 30 min before class, send join links --
  useEffect(() => {
    if (pauseRefresh) return;
    let mounted = true;
    const sendReminders = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/session-reminder', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.sent > 0) {
          toast.success(`Sent ${data.data.sent} session reminder${data.data.sent > 1 ? 's' : ''} (30 min before)`);
        }
      } catch { /* silent */ }
    };
    sendReminders(); // check on mount
    const iv = setInterval(sendReminders, 60_000); // every 60s (deduped server-side)
    return () => { mounted = false; clearInterval(iv); };
  }, [toast, pauseRefresh]);

  useEffect(() => {
    const syncHash = () => setTab(readHashTab());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (tab === 'requests' && !requestsFetched && !loadingRequests) fetchSessionRequests();
    if (tab === 'requests' && !leaveFetched && !loadingLeave) fetchLeaveRequests();
    if (tab === 'requests' && !videoRequestsFetched && !loadingVideoRequests) fetchVideoAccessRequests();
  }, [tab, requestsFetched, loadingRequests, leaveFetched, loadingLeave, videoRequestsFetched, loadingVideoRequests, fetchSessionRequests, fetchLeaveRequests, fetchVideoAccessRequests]);

  const stats = {
    totalBatches: batches.length,
    activeBatches: batches.filter(b => b.status === 'active').length,
    todaySessions: sessions.filter(s => isToday(s.scheduled_date) && effectiveSessionStatus(s) !== 'cancelled').length,
    liveSessions: sessions.filter(s => s.status === 'live').length,
    scheduledSessions: sessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length,
    totalStudents: batches.reduce((sum, b) => sum + Number(b.student_count || 0), 0),
  };

  const refreshAll = () => { fetchBatches('', false, true); fetchSessions(true); };

  // Create batch wizard state
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [showEnrollmentLink, setShowEnrollmentLink] = useState(false);
  const [showManualEnroll, setShowManualEnroll] = useState(false);

  // Track tab visits so CSS-hidden tabs only render after first visit
  const visitedTabs = useRef(new Set<string>());
  if (tab) visitedTabs.current.add(tab);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        {!['students', 'teachers', 'batches', 'requests', 'materials', 'exam-topics', 'demo', 'payments', 'conference'].includes(tab) && (
          <PageHeader icon={LayoutDashboard} title="Academic Operator" subtitle={`Welcome back, ${userName}`} />
        )}

        {/* TabBar hidden – navigation handled by sidebar */}

        {tab === 'overview' && (
          <OverviewTab stats={stats} sessions={sessions} batches={batches} loading={loading || loadingSessions} changeTab={(t: string) => { window.location.hash = t; }} onRefresh={refreshAll} />
        )}
        {tab === 'batches' && (
          <BatchesTab batches={batches} sessions={sessions} loading={loading} onRefresh={() => { fetchBatches('', false, true); fetchSessions(true); }} onSearch={(q: string) => fetchBatches(q, true)} userRole={userRole} onNewBatch={() => setShowCreateBatch(true)} />
        )}
        {tab === 'sessions' && (
          <SessionsTab sessions={sessions} batches={batches} loading={loadingSessions} onRefresh={refreshAll} />
        )}
        {tab === 'materials' && (
          <MaterialsTab userEmail={userEmail} userRole={userRole} batches={batches} />
        )}
        {tab === 'exam-topics' && (
          <ExamTopicsTab userEmail={userEmail} batches={batches} />
        )}
        {tab === 'monitoring' && (
          <>
            <AOMonitoringTab alerts={monitorAlerts} loading={loadingMonitor} onRefresh={fetchMonitorAlerts} />
            <ExtensionRequestsPanel />
          </>
        )}
        {/* Students & Teachers use CSS hiding instead of unmount to preserve form state */}
        {visitedTabs.current.has('students') && (
          <div style={{ display: tab === 'students' ? 'contents' : 'none' }}>
            <UsersTab
              role="student"
              label="Students"
              active={tab === 'students'}
              hideCreate
              extraHeaderActions={
                <div className="flex gap-2">
                  <Button variant="outline" icon={Send} onClick={() => setShowEnrollmentLink(true)}>
                    Enrollment Link
                  </Button>
                  <Button icon={UserPlus} onClick={() => setShowManualEnroll(true)}>
                    Manual Enroll
                  </Button>
                </div>
              }
            />
            <DiscontinuedStudentsPanel />
            <EnrollmentLinkModal open={showEnrollmentLink} onClose={() => setShowEnrollmentLink(false)} />
            <ManualEnrollModal open={showManualEnroll} onClose={() => setShowManualEnroll(false)} onSuccess={() => { setShowManualEnroll(false); }} />
          </div>
        )}
        {visitedTabs.current.has('teachers') && (
          <div style={{ display: tab === 'teachers' ? 'contents' : 'none' }}>
            <UsersTab role="teacher" label="Teachers" hideCreate hideActions active={tab === 'teachers'} />
          </div>
        )}
        {tab === 'requests' && (
          <AORequestsTab
            sessionRequests={sessionRequests}
            leaveRequests={leaveRequests}
            videoRequests={videoAccessRequests}
            loadingRequests={loadingRequests}
            loadingLeave={loadingLeave}
            loadingVideo={loadingVideoRequests}
            onRefresh={() => { fetchSessionRequests(); fetchLeaveRequests(); fetchVideoAccessRequests(); }}
            toast={toast}
          />
        )}
        {tab === 'demo' && (
          <DemoTab />
        )}
        {tab === 'teacher-reports' && (
          <TeacherReportsTab />
        )}
        {tab === 'payments' && (
          <AOPaymentsTab />
        )}
        {tab === 'conference' && (
          <ConferenceTab />
        )}
        {tab === 'open-classroom' && (
          <OpenClassroomTab />
        )}
        {tab === 'todays-live' && (
          <TodaysLiveTab sessions={sessions} loading={loadingSessions} onRefresh={refreshAll} />
        )}
        {tab === 'settings' && (
          <div className="space-y-6">
            {userRole === 'owner' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <AOManagementPanel />
              </div>
            )}
            <TeacherControlsTab />
          </div>
        )}
      </div>

      {/* Create Batch Wizard */}
      {showCreateBatch && (
        <CreateBatchWizard
          batches={batches}
          userRole={userRole}
          userEmail={userEmail}
          onClose={() => setShowCreateBatch(false)}
          onCreated={() => { setShowCreateBatch(false); refreshAll(); }}
        />
      )}
    </DashboardShell>
  );
}

// Chart colors
const CHART_COLORS = { emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b', purple: '#8b5cf6', teal: '#14b8a6', rose: '#f43f5e', red: '#ef4444' };

/** Get IST date strings for the last 7 days */
function getWeekDatesAO(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getDayLabelAO(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

// --- Overview Tab -------------------------------------------
type OverviewPaymentSummary = {
  total_invoiced_paise: number;
  total_paid_paise: number;
  total_pending_paise: number;
  total_overdue_paise: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  collected_30d: number;
};
type OverviewOverdueStudent = {
  student_email: string;
  student_name: string | null;
  due_amount: number;
  overdue_count: number;
  pending_count: number;
  total_invoices: number;
};
type OverviewReceipt = {
  receipt_number: string;
  student_name: string | null;
  student_email: string;
  amount_paise: number;
  currency: string;
  paid_at: string;
  payment_method: string | null;
};

function OverviewTab({ stats, sessions, batches, loading, changeTab, onRefresh }: {
  stats: { totalBatches: number; activeBatches: number; todaySessions: number; liveSessions: number; scheduledSessions: number; totalStudents: number };
  sessions: Session[];
  batches: Batch[];
  loading: boolean;
  changeTab: (t: string) => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [pendingCounts, setPendingCounts] = useState({ leave: 0, sessionReq: 0, demo: 0 });
  const [payData, setPayData] = useState<OverviewPaymentSummary | null>(null);
  const [overdueStudents, setOverdueStudents] = useState<OverviewOverdueStudent[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<OverviewReceipt[]>([]);
  const [zombieRooms, setZombieRooms] = useState<{ room_id: string; room_name: string; teacher_email: string | null; started_at: string | null }[]>([]);
  const [endingZombie, setEndingZombie] = useState<string | null>(null);

  const fetchZombies = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/academic-operator/zombie-rooms');
      const d = await res.json();
      if (d.success) setZombieRooms(d.data.zombies);
    } catch { /* silent */ }
  }, []);

  const forceEndZombie = useCallback(async (roomId: string) => {
    setEndingZombie(roomId);
    try {
      const res = await fetch('/api/v1/academic-operator/zombie-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      const d = await res.json();
      if (d.success) {
        setZombieRooms(prev => prev.filter(z => z.room_id !== roomId));
        toast.success('Zombie room cleared');
      } else {
        toast.error(d.error || 'Failed to end room');
      }
    } catch { toast.error('Network error'); }
    setEndingZombie(null);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetch('/api/v1/teacher-leave').then(r => r.json()),
      fetch('/api/v1/session-requests').then(r => r.json()),
      fetch('/api/v1/demo/requests').then(r => r.json()),
    ]).then(([leaveRes, reqRes, demoRes]) => {
      if (!alive) return;
      const leave = leaveRes.status === 'fulfilled' && leaveRes.value.success
        ? (leaveRes.value.data?.requests ?? []).filter((r: { status: string }) => r.status === 'pending_ao').length : 0;
      const sessionReq = reqRes.status === 'fulfilled' && reqRes.value.success
        ? (reqRes.value.data?.requests ?? []).filter((r: { status: string }) => r.status === 'pending').length : 0;
      const demo = demoRes.status === 'fulfilled' && demoRes.value.success
        ? (demoRes.value.data?.requests ?? demoRes.value.data ?? []).filter((d: { status: string }) => d.status === 'pending' || d.status === 'requested').length : 0;
      setPendingCounts({ leave, sessionReq, demo });
    });
    fetch('/api/v1/academic-operator/payments')
      .then(r => r.json())
      .then(d => {
        if (!alive || !d.success) return;
        setPayData(d.data.summary as OverviewPaymentSummary);
        setOverdueStudents(
          (d.data.studentSummary as OverviewOverdueStudent[])
            .filter(s => s.overdue_count > 0 || s.pending_count > 0)
            .slice(0, 8)
        );
        setRecentReceipts((d.data.receipts as OverviewReceipt[]).slice(0, 7));
      })
      .catch(() => {});
    fetchZombies();
    return () => { alive = false; };
  }, [fetchZombies]);

  // ── Hooks must all be called before any early return ────────
  // 7-day payment collection chart (derived from recentReceipts state)
  const collectionData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const collected = recentReceipts
        .filter(r => r.paid_at.slice(0, 10) === dateStr)
        .reduce((sum, r) => sum + Number(r.amount_paise || 0), 0) / 100;
      return { day: getDayLabelAO(dateStr), collected };
    });
  }, [recentReceipts]);

  if (loading) return <LoadingState />;

  const todaySessions = sessions
    .filter(s => isToday(s.scheduled_date) && effectiveSessionStatus(s) !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const liveSessions = sessions.filter(s => s.status === 'live');
  const endedSessions = sessions.filter(s => s.status === 'ended');
  const totalPending = pendingCounts.leave + pendingCounts.sessionReq + pendingCounts.demo;

  // Weekly session area chart
  const weekDates = getWeekDatesAO();
  const weeklyData = weekDates.map(dateStr => {
    const daySessions = sessions.filter(s => s.scheduled_date.slice(0, 10) === dateStr);
    return {
      day: getDayLabelAO(dateStr),
      Completed: daySessions.filter(s => s.status === 'ended' || (s.status !== 'live' && effectiveSessionStatus(s) === 'ended')).length,
      Upcoming: daySessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length,
      Live: daySessions.filter(s => s.status === 'live').length,
    };
  });

  // Payment donut
  const payPieData = payData ? [
    { name: 'Collected', value: payData.total_paid_paise, fill: CHART_COLORS.emerald },
    { name: 'Pending',   value: payData.total_pending_paise, fill: CHART_COLORS.amber },
    { name: 'Overdue',   value: payData.total_overdue_paise, fill: CHART_COLORS.red },
  ].filter(d => d.value > 0) : [];

  const collectionRate = payData && payData.total_invoiced_paise > 0
    ? Math.round((payData.total_paid_paise / payData.total_invoiced_paise) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 min-h-0">

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ROW 1 — ACADEMIC KPIs                                     */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Today's sessions */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex items-start gap-3">
          <div className="rounded-lg bg-blue-500 p-2 shrink-0">
            <CalendarDays className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Today</p>
            <p className="text-xl font-bold text-gray-900">{stats.todaySessions}</p>
            <p className="text-[11px] text-gray-400">
              {liveSessions.length > 0
                ? <span className="text-primary font-semibold">{liveSessions.length} live</span>
                : <span>{stats.scheduledSessions} upcoming</span>}
              {' · '}
              <span>{endedSessions.filter(s => isToday(s.scheduled_date)).length} done</span>
            </p>
          </div>
        </div>

        {/* Batches & Students */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex items-start gap-3">
          <div className="rounded-lg bg-primary p-2 shrink-0">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Batches</p>
            <p className="text-xl font-bold text-gray-900">{stats.activeBatches}</p>
            <p className="text-[11px] text-gray-400">{stats.totalStudents} students · {stats.totalBatches} total</p>
          </div>
        </div>

        {/* Sessions this week */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex items-start gap-3">
          <div className="rounded-lg bg-teal-500 p-2 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">This Week</p>
            <p className="text-xl font-bold text-gray-900">{weeklyData.reduce((s, d) => s + d.Completed + d.Upcoming + d.Live, 0)}</p>
            <p className="text-[11px] text-gray-400">{weeklyData.reduce((s, d) => s + d.Completed, 0)} completed</p>
          </div>
        </div>

        {/* Pending actions */}
        <div className={`rounded-xl bg-white border shadow-sm p-4 flex items-start gap-3 ${totalPending > 0 ? 'border-amber-200' : 'border-gray-100'}`}>
          <div className={`rounded-lg p-2 shrink-0 ${totalPending > 0 ? 'bg-amber-500' : 'bg-primary'}`}>
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Actions Needed</p>
            <p className={`text-xl font-bold ${totalPending > 0 ? 'text-amber-600' : 'text-primary'}`}>{totalPending}</p>
            <p className="text-[11px] text-gray-400">
              {totalPending > 0 ? `${pendingCounts.leave}L · ${pendingCounts.sessionReq}R · ${pendingCounts.demo}D` : 'All clear'}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ROW 2 — PAYMENT KPIs                                      */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border-l-4 border-l-gray-400 border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Total Invoiced</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{payData ? fmtMoney(payData.total_invoiced_paise) : '—'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{payData ? `${payData.paid_count + payData.pending_count + payData.overdue_count} invoices` : 'Loading…'}</p>
        </div>
        <div className="rounded-xl bg-white border-l-4 border-l-emerald-400 border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Collected</p>
          <p className="text-lg font-bold text-primary tabular-nums">{payData ? fmtMoney(payData.total_paid_paise) : '—'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{payData ? `${collectionRate}% collection rate · ${payData.paid_count} paid` : 'Loading…'}</p>
        </div>
        <div className="rounded-xl bg-white border-l-4 border-l-amber-400 border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium mb-1">Pending</p>
          <p className="text-lg font-bold text-amber-700 tabular-nums">{payData ? fmtMoney(payData.total_pending_paise) : '—'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{payData ? `${payData.pending_count} invoices due` : 'Loading…'}</p>
        </div>
        <div className={`rounded-xl bg-white border-l-4 border border-gray-100 shadow-sm p-4 ${payData && payData.overdue_count > 0 ? 'border-l-red-400' : 'border-l-gray-200'}`}>
          <p className="text-xs text-gray-400 font-medium mb-1">Overdue</p>
          <p className={`text-lg font-bold tabular-nums ${payData && payData.overdue_count > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {payData ? fmtMoney(payData.total_overdue_paise) : '—'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{payData ? `${payData.overdue_count} overdue invoices` : 'Loading…'}</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ALERT BARS                                                 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {liveSessions.length > 0 && (
        <div className="rounded-xl border border-green-300 bg-primary/5/60 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-primary/20/70">
            <Radio className="h-5 w-5 text-primary animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-green-800">{liveSessions.length} Live Now</span>
              <span className="text-xs text-primary ml-2 hidden sm:inline">
                Join any session as a silent observer
              </span>
            </div>
          </div>
          <div className="divide-y divide-green-200/60">
            {liveSessions
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map(s => {
                const startedMs = s.started_at ? new Date(s.started_at).getTime() : null;
                const elapsedMin = startedMs ? Math.max(0, Math.floor((Date.now() - startedMs) / 60000)) : null;
                return (
                  <div key={s.session_id} className="px-4 py-2.5 flex items-center gap-3 bg-white/40">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">{s.subject}</span>
                        <span className="text-xs text-gray-500">· {s.batch_name || s.batch_id}</span>
                        {s.teacher_name && <span className="text-xs text-gray-500">· {s.teacher_name}</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Started {s.start_time}{elapsedMin !== null ? ` · ${elapsedMin} min elapsed` : ''}
                        {s.topic ? ` · ${s.topic}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!s.livekit_room_name) { toast.error('Room not yet ready'); return; }
                        window.open('/academic-operator/live', '_blank');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 shrink-0"
                      title="Join as silent observer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Observe
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      {zombieRooms.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50/60 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-red-200/70">
            <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-red-800">
                {zombieRooms.length} Zombie Room{zombieRooms.length !== 1 ? 's' : ''} Detected
              </span>
              <span className="text-xs text-red-600 ml-2 hidden sm:inline">
                marked live in DB but no longer on media server
              </span>
            </div>
            <button
              onClick={fetchZombies}
              className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 font-medium hover:bg-red-50 shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 inline mr-1" />Recheck
            </button>
          </div>
          <div className="divide-y divide-red-200/60">
            {zombieRooms.map(z => {
              const elapsedMin = z.started_at ? Math.max(0, Math.floor((Date.now() - new Date(z.started_at).getTime()) / 60000)) : null;
              return (
                <div key={z.room_id} className="px-4 py-2.5 flex items-center gap-3 bg-white/40">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{z.room_name || z.room_id}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {z.teacher_email && <span>{z.teacher_email} · </span>}
                      {elapsedMin !== null ? `Stuck for ${elapsedMin} min` : 'Started time unknown'}
                    </div>
                  </div>
                  <button
                    disabled={endingZombie === z.room_id}
                    onClick={() => forceEndZombie(z.room_id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 shrink-0"
                  >
                    {endingZombie === z.room_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
                    Force End
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {pendingCounts.leave > 0 && (
        <div className="rounded-xl border border-orange-300 bg-orange-50/60 px-4 py-2.5 flex items-center gap-3">
          <Briefcase className="h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-orange-800">{pendingCounts.leave} Leave Request{pendingCounts.leave !== 1 ? 's' : ''}</span>
            <span className="text-xs text-orange-600 ml-2 hidden sm:inline">awaiting your review</span>
          </div>
          <button onClick={() => changeTab('requests')} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700 shrink-0">Review</button>
        </div>
      )}
      {pendingCounts.sessionReq > 0 && (
        <div className="rounded-xl border border-blue-300 bg-blue-50/60 px-4 py-2.5 flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-blue-800">{pendingCounts.sessionReq} Session Request{pendingCounts.sessionReq !== 1 ? 's' : ''}</span>
            <span className="text-xs text-blue-600 ml-2 hidden sm:inline">reschedule / cancel pending</span>
          </div>
          <button onClick={() => changeTab('requests')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shrink-0">Review</button>
        </div>
      )}
      {pendingCounts.demo > 0 && (
        <div className="rounded-xl border border-purple-300 bg-purple-50/60 px-4 py-2.5 flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-purple-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-purple-800">{pendingCounts.demo} Demo Request{pendingCounts.demo !== 1 ? 's' : ''}</span>
            <span className="text-xs text-purple-600 ml-2 hidden sm:inline">awaiting scheduling</span>
          </div>
          <button onClick={() => changeTab('demo')} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shrink-0">Manage</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ROW 3 — CHARTS                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Weekly Sessions area chart (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col" style={{ minHeight: 240 }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Weekly Sessions</h3>
              <p className="text-[11px] text-gray-400">This week by day</p>
            </div>
            <button onClick={() => changeTab('sessions')} className="text-[11px] text-primary hover:underline font-medium">View all →</button>
          </div>
          <div className="flex-1">
            {weeklyData.some(d => d.Completed + d.Upcoming + d.Live > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradUpcoming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={22} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="Completed" stroke={CHART_COLORS.emerald} strokeWidth={2.5} fill="url(#gradCompleted)" dot={{ r: 3, fill: CHART_COLORS.emerald }} />
                  <Area type="monotone" dataKey="Upcoming" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#gradUpcoming)" strokeDasharray="4 2" dot={{ r: 3, fill: CHART_COLORS.blue }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No sessions this week</div>
            )}
          </div>
        </div>

        {/* 7-day collection bar chart (4 cols) */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col" style={{ minHeight: 240 }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Daily Collections</h3>
              <p className="text-[11px] text-gray-400">Payments received last 7 days</p>
            </div>
            <button onClick={() => changeTab('payments')} className="text-[11px] text-primary hover:underline font-medium">Payments →</button>
          </div>
          <div className="flex-1">
            {collectionData.some(d => d.collected > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collectionData} barSize={22} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={32} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']) as any}
                  />
                  <Bar dataKey="collected" name="Collected" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No collections in last 7 days</div>
            )}
          </div>
        </div>

        {/* Payment status donut (3 cols) */}
        <div className="lg:col-span-3 rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col" style={{ minHeight: 240 }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Payment Status</h3>
              <p className="text-[11px] text-gray-400">Invoice breakdown</p>
            </div>
          </div>
          {payPieData.length > 0 ? (
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full" style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={payPieData} cx="50%" cy="50%" innerRadius={42} outerRadius={62}
                      dataKey="value" paddingAngle={2} stroke="none">
                      {payPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((v: number) => [fmtMoney(v), '']) as any}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-1.5 mt-1">
                {payPieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.fill }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800 tabular-nums">{fmtMoney(d.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 mt-1">
                  <span className="text-gray-500 font-medium">Collection Rate</span>
                  <span className={`font-bold tabular-nums ${collectionRate >= 80 ? 'text-primary' : collectionRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{collectionRate}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">No payment data</div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ROW 4 — TODAY'S AGENDA + OVERDUE STUDENTS + SIDE PANELS   */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* Today's Schedule — timeline (4 cols) */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Today&apos;s Schedule</h3>
            <button onClick={() => changeTab('sessions')} className="text-[11px] text-primary hover:underline font-medium">Full schedule →</button>
          </div>
          {todaySessions.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No sessions today</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.slice(0, 7).map(s => {
                const es = effectiveSessionStatus(s);
                const isLive = es === 'live';
                const isDone = es === 'ended';
                return (
                  <div key={s.session_id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${isLive ? 'bg-primary/5 border border-primary/20' : isDone ? 'bg-gray-50' : 'bg-blue-50/40'}`}>
                    <div className="shrink-0 text-center w-12">
                      <p className="font-bold text-gray-800">{fmtTime12(s.start_time)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.subject}</p>
                      <p className="text-gray-400 truncate">{s.batch_name || s.batch_id}{s.teacher_name ? ` · ${s.teacher_name.split(' ')[0]}` : ''}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="text-gray-400">{s.student_count ?? '?'}</span>
                      <Users className="h-3 w-3 text-gray-400" />
                      {isLive && <Radio className="h-3.5 w-3.5 text-red-500 animate-pulse" />}
                      {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </div>
                );
              })}
              {todaySessions.length > 7 && (
                <p className="text-[11px] text-gray-400 text-center pt-1">+{todaySessions.length - 7} more sessions</p>
              )}
            </div>
          )}
        </div>

        {/* Pending & Overdue Students — payment action panel (4 cols) */}
        <div className="lg:col-span-4 rounded-xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Pending Payments</h3>
              <p className="text-[11px] text-gray-400">
                {overdueStudents.filter(s => s.overdue_count > 0).length > 0 && (
                  <span className="text-red-500 font-semibold">{overdueStudents.filter(s => s.overdue_count > 0).length} overdue</span>
                )}
                {overdueStudents.filter(s => s.overdue_count > 0).length > 0 && overdueStudents.filter(s => s.pending_count > 0 && s.overdue_count === 0).length > 0 && ' · '}
                {overdueStudents.filter(s => s.pending_count > 0 && s.overdue_count === 0).length > 0 && (
                  <span className="text-amber-600 font-semibold">{overdueStudents.filter(s => s.pending_count > 0 && s.overdue_count === 0).length} pending</span>
                )}
              </p>
            </div>
            <button onClick={() => changeTab('payments')} className="text-[11px] text-primary hover:underline font-medium">View all →</button>
          </div>
          {overdueStudents.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-3 mt-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-primary font-medium">No pending payments — great collection!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueStudents.map(s => {
                const initials = (s.student_name || s.student_email).charAt(0).toUpperCase();
                const isOverdue = s.overdue_count > 0;
                return (
                  <div key={s.student_email} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    isOverdue ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/40 border-amber-200'
                  }`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{s.student_name || s.student_email}</p>
                      <p className={`text-[10px] ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                        {isOverdue
                          ? `${s.overdue_count} overdue${s.pending_count > 0 ? ` · ${s.pending_count} pending` : ''}`
                          : `${s.pending_count} invoice${s.pending_count !== 1 ? 's' : ''} pending`
                        }
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <p className={`text-xs font-bold tabular-nums ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>{fmtMoney(s.due_amount)}</p>
                      {isOverdue && <span className="text-[9px] font-bold uppercase text-red-500 tracking-wide">OVERDUE</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent receipts strip */}
          {recentReceipts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">Recent Payments</p>
              <div className="space-y-1.5">
                {recentReceipts.slice(0, 4).map(r => (
                  <div key={r.receipt_number} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-gray-600 truncate">{r.student_name || r.student_email}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-semibold text-primary tabular-nums">{fmtMoney(r.amount_paise, r.currency)}</span>
                      <span className="text-gray-400 text-[10px]">{new Date(r.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Active Batches + Attendance (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Active Batches */}
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Active Batches</h3>
              <button onClick={() => changeTab('batches')} className="text-[11px] text-primary hover:underline font-medium">View all →</button>
            </div>
            {batches.filter(b => b.status === 'active').length === 0 ? (
              <p className="text-xs text-gray-400">No active batches</p>
            ) : (
              <div className="space-y-1.5">
                {batches.filter(b => b.status === 'active').slice(0, 4).map(b => (
                  <div key={b.batch_id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                    <Badge label={BATCH_TYPE_LABELS[b.batch_type] || b.batch_type} variant={BATCH_TYPE_VARIANTS[b.batch_type] || 'default'} />
                    <span className="text-gray-800 font-medium truncate flex-1">{b.batch_name}</span>
                    <span className="text-gray-400 shrink-0">{b.student_count} <Users className="inline h-3 w-3" /></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Readiness */}
          <TeacherReadinessWidget />

          {/* Attendance Summary */}
          <AttendanceSummaryWidget />
        </div>
      </div>
    </div>
  );
}

/* Teacher Readiness Widget — shows online/offline status based on last_login */
function TeacherReadinessWidget() {
  const [teachers, setTeachers] = useState<Array<Record<string, unknown>>>([]);
  const [loadingT, setLoadingT] = useState(true);
  useEffect(() => {
    fetch('/api/v1/hr/users?role=teacher&limit=500')
      .then(r => r.json())
      .then(d => { if (d.success) setTeachers(d.data?.users || []); })
      .catch(() => {})
      .finally(() => setLoadingT(false));
  }, []);
  if (loadingT || teachers.length === 0) return null;

  const now = Date.now();
  const ONLINE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
  const online = teachers.filter(t => t.last_login && (now - new Date(t.last_login as string).getTime()) < ONLINE_THRESHOLD);
  const offline = teachers.filter(t => !t.last_login || (now - new Date(t.last_login as string).getTime()) >= ONLINE_THRESHOLD);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-700">Teacher Readiness</h3>
        <span className="text-[10px] text-gray-400">{online.length} online · {offline.length} offline</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {online.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-medium text-green-800">{(t.full_name as string)?.split(' ')[0] || (t.email as string)}</span>
          </div>
        ))}
        {offline.slice(0, 6).map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            <span className="text-[10px] text-gray-500">{(t.full_name as string)?.split(' ')[0] || (t.email as string)}</span>
          </div>
        ))}
        {offline.length > 6 && (
          <span className="text-[10px] text-gray-400 self-center">+{offline.length - 6} more</span>
        )}
      </div>
    </div>
  );
}

/* Global Attendance Summary Widget */
function AttendanceSummaryWidget() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loadingA, setLoadingA] = useState(true);
  useEffect(() => {
    fetch('/api/v1/coordinator/student-performance')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.students) {
          const students = d.data.students as Array<Record<string, unknown>>;
          const totalStudents = students.length;
          const avgAttendance = totalStudents > 0
            ? students.reduce((sum: number, s: Record<string, unknown>) => sum + Number(s.attendance_rate || 0), 0) / totalStudents
            : 0;
          const highAttendance = students.filter(s => Number(s.attendance_rate || 0) >= 75).length;
          const lowAttendance = students.filter(s => Number(s.attendance_rate || 0) < 50).length;
          setSummary({ totalStudents, avgAttendance, highAttendance, lowAttendance });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingA(false));
  }, []);
  if (loadingA || !summary) return null;
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-3 sm:px-4 py-3 shrink-0">
      <h3 className="text-xs font-semibold text-gray-700 mb-2">Attendance Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Students', value: String(summary.totalStudents), color: 'text-gray-900' },
          { label: 'Avg Rate', value: `${(summary.avgAttendance as number).toFixed(1)}%`, color: (summary.avgAttendance as number) >= 75 ? 'text-primary' : 'text-amber-600' },
          { label: 'Above 75%', value: String(summary.highAttendance), color: 'text-primary' },
          { label: 'Below 50%', value: String(summary.lowAttendance), color: (summary.lowAttendance as number) > 0 ? 'text-red-500' : 'text-primary' },
        ].map(s => (
          <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Batches Tab --------------------------------------------
export function BatchesTab({ batches, sessions, loading, onRefresh, onSearch, userRole, onNewBatch }: {
  batches: Batch[];
  sessions: Session[];
  loading: boolean;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  userRole: string;
  onNewBatch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [scheduleBatch, setScheduleBatch] = useState<Batch | null>(null);
  const [schedulePickerBatch, setSchedulePickerBatch] = useState<Batch | null>(null);
  const [autoScheduleBatch, setAutoScheduleBatch] = useState<Batch | null>(null);
  const [deleteBatch, setDeleteBatch] = useState<Batch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [timetableBatch, setTimetableBatch] = useState<Batch | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  const activeBatches = batches.filter(b => b.status === 'active').length;
  const inactiveBatches = batches.filter(b => b.status === 'inactive').length;
  const archivedBatches = batches.filter(b => b.status === 'archived').length;
  const totalStudents = batches.reduce((sum, b) => sum + Number(b.student_count || 0), 0);
  const totalTeachers = batches.reduce((sum, b) => sum + Number(b.teacher_count || 0), 0);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(val);
    }, 400);
  };

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleDelete = async (batch: Batch, permanent: boolean) => {
    setDeleting(true);
    try {
      const url = permanent
        ? `/api/v1/batches/${batch.batch_id}?permanent=true`
        : `/api/v1/batches/${batch.batch_id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(permanent ? 'Batch permanently deleted' : 'Batch archived');
        setDeleteBatch(null);
        if (expandedBatch === batch.batch_id) setExpandedBatch(null);
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to delete batch');
      }
    } catch { toast.error('Failed to delete batch'); }
    setDeleting(false);
  };

  const handleUnarchive = async (batch: Batch) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/batches/${batch.batch_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Batch restored to inactive');
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to unarchive batch');
      }
    } catch { toast.error('Failed to unarchive batch'); }
    setDeleting(false);
  };

  if (loading && batches.length === 0) return <LoadingState />;

  const filtered = batches
    .filter(b => statusFilter === 'all' || b.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* -- Header ----------------------------------- */}
      <PageHeader icon={BookOpen} title="Batches" subtitle={`${activeBatches} active · ${inactiveBatches} inactive`}>
        <RefreshButton loading={loading} onClick={onRefresh} />
        {userRole !== 'batch_coordinator' && (
          <Button variant="primary" icon={Plus} onClick={onNewBatch}>New Batch</Button>
        )}
      </PageHeader>

      {/* -- Stat Cards ------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={BookOpen} label="Total Batches" value={batches.length} variant="default" />
        <StatCard icon={Zap} label="Active" value={activeBatches} variant="success" />
        <StatCard icon={XCircle} label="Inactive" value={inactiveBatches} variant={inactiveBatches > 0 ? 'danger' : 'default'} />
        <StatCard icon={GraduationCap} label="Students" value={totalStudents} variant="info" />
        <StatCard icon={Users} label="Teachers" value={totalTeachers} variant="warning" />
      </div>

      {/* -- Search + Filter -------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search batches, students, teachers, parents..." />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {batches.length} batches</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message="No batches found" />
      ) : (
        <TableWrapper footer={<span>{filtered.length} batch{filtered.length !== 1 ? 'es' : ''}</span>}>
          <THead>
            <TH />
            <TH>Batch</TH>
            <TH>Type</TH>
            <TH>Grade</TH>
            <TH>Subjects</TH>
            <TH>Students</TH>
            <TH>Teachers</TH>
            <TH>Status</TH>
            <TH></TH>
          </THead>
          <tbody>
            {filtered.map(b => (
              <React.Fragment key={b.batch_id}>
                <TRow
                  selected={expandedBatch === b.batch_id}
                  onClick={() => setExpandedBatch(expandedBatch === b.batch_id ? null : b.batch_id)}
                >
                  <td className="px-3 py-3 w-8">
                    {expandedBatch === b.batch_id
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{b.batch_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{b.batch_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={BATCH_TYPE_LABELS[b.batch_type] || b.batch_type} variant={BATCH_TYPE_VARIANTS[b.batch_type] || 'default'} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {b.grade}{b.section ? ` - ${b.section}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(b.subjects || []).map(s => (
                        <span key={s} className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.student_count}</td>
                  <td className="px-4 py-3 text-gray-700">{b.teacher_count}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {b.status === 'active' && (
                        <Button
                          icon={CalendarDays}
                          size="xs"
                          variant="primary"
                          onClick={() => setSchedulePickerBatch(b)}
                        >
                          Schedule
                        </Button>
                      )}
                      {b.status === 'archived' && (
                        <button
                          type="button"
                          title="Restore batch"
                          disabled={deleting}
                          onClick={() => handleUnarchive(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="View Weekly Timetable"
                        onClick={() => setTimetableBatch(b)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Table2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Edit batch"
                        onClick={() => setEditBatch(b)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete batch"
                        onClick={() => setDeleteBatch(b)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </TRow>
                {expandedBatch === b.batch_id && (
                  <tr>
                    <td colSpan={9} className="p-0 bg-gray-50/80">
                      <BatchDetailInline
                        batch={b}
                        sessions={sessions.filter(s => s.batch_id === b.batch_id)}
                        onRefresh={onRefresh}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </TableWrapper>
      )}

      {scheduleBatch && (
        <ScheduleSessionModal
          batch={scheduleBatch}
          onClose={() => setScheduleBatch(null)}
          onCreated={() => { setScheduleBatch(null); onRefresh(); }}
        />
      )}

      {/* Schedule Picker Modal */}
      {schedulePickerBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Schedule Sessions</h3>
            <p className="text-xs text-gray-500 mb-5">{schedulePickerBatch.batch_name}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => { setAutoScheduleBatch(schedulePickerBatch); setSchedulePickerBatch(null); }}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-colors p-4 text-left"
              >
                <CalendarDays className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-primary">Auto Schedule</p>
                  <p className="text-[11px] text-primary mt-0.5">From academic calendar</p>
                </div>
              </button>
              <button
                onClick={() => { setScheduleBatch(schedulePickerBatch); setSchedulePickerBatch(null); }}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors p-4 text-left"
              >
                <PlusCircle className="h-7 w-7 text-gray-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Manual</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Schedule one session</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setSchedulePickerBatch(null)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Auto Schedule Modal (from header) */}
      {autoScheduleBatch && (
        <AutoScheduleModal
          open={true}
          onClose={() => setAutoScheduleBatch(null)}
          batchId={autoScheduleBatch.batch_id}
          batchGrade={autoScheduleBatch.grade}
          batchBoard={autoScheduleBatch.board}
          batchTeachers={autoScheduleBatch.teachers || []}
          batchSubjects={autoScheduleBatch.subjects || []}
          batchType={autoScheduleBatch.batch_type}
          onComplete={() => { setAutoScheduleBatch(null); onRefresh(); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Batch</h3>
                <p className="text-sm text-gray-500">{deleteBatch.batch_name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Choose how to remove this batch:
            </p>
            <div className="space-y-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteBatch, false)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left disabled:opacity-50"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Archive</p>
                  <p className="text-xs text-amber-600">Mark as archived. Can be restored later.</p>
                </div>
              </button>
              {userRole !== 'batch_coordinator' && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteBatch, true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left disabled:opacity-50"
              >
                <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Permanently Delete</p>
                  <p className="text-xs text-red-600">Remove all data including students & sessions. Cannot be undone.</p>
                </div>
              </button>
              )}
            </div>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteBatch(null)}
              className="w-full mt-4 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editBatch && (
        <EditBatchModal
          batch={editBatch}
          batches={batches}
          userRole={userRole}
          onClose={() => setEditBatch(null)}
          onSaved={() => { setEditBatch(null); onRefresh(); }}
        />
      )}

      {/* Weekly Timetable Modal */}
      {timetableBatch && (
        <WeeklyTimetableModal
          batch={timetableBatch}
          onClose={() => setTimetableBatch(null)}
        />
      )}
    </div>
  );
}

// ===============================================================
// Weekly Timetable Modal
// Shows batch timetable grouped by day-of-week with send button.
// ===============================================================

interface TimetableSlot {
  day: string;
  subject: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  duration: string;
}

const DAY_THEME_TT = { bg: 'bg-primary', text: 'text-primary', border: 'border-primary/20', light: 'bg-primary/5' };

const ALL_DAYS_TT = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function WeeklyTimetableModal({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [byDay, setByDay] = useState<Record<string, TimetableSlot[]>>({});
  const [sortedDays, setSortedDays] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ sent: number; total: number } | null>(null);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/batch-sessions/weekly-timetable?batch_id=${batch.batch_id}`);
        const data = await res.json();
        if (data.success) {
          setSlots(data.data.slots || []);
          setByDay(data.data.byDay || {});
          setSortedDays(data.data.sortedDays || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [batch.batch_id]);

  const handleSendTimetable = async (isUpdate: boolean) => {
    setSending(true);
    setSentResult(null);
    try {
      const res = await fetch('/api/v1/batch-sessions/weekly-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, is_update: isUpdate }),
      });
      const data = await res.json();
      if (data.success) {
        const sent = data.data?.sent || 0;
        const total = data.data?.total_recipients || 0;
        setSentResult({ sent, total });
        toast.success(`Timetable sent to ${sent} of ${total} recipient${total > 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to send timetable');
      }
    } catch {
      toast.error('Network error sending timetable');
    }
    setSending(false);
  };

  const uniqueSubjects = [...new Set(slots.map(s => s.subject))];
  const activeDays = sortedDays.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-primary to-secondary px-6 py-5 relative overflow-hidden shrink-0">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Table2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Weekly Timetable</h2>
                <p className="text-white/70 text-xs mt-0.5">
                  {batch.batch_name} · Grade {batch.grade}{batch.section ? ` - ${batch.section}` : ''} · Mon–Sat
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && slots.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-gray-500">Days:</span>
              <span className="font-semibold text-gray-800">{activeDays} / 6</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-gray-500">Sessions/Week:</span>
              <span className="font-semibold text-gray-800">{slots.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-teal-600" />
              <span className="text-gray-500">Subjects:</span>
              <span className="font-semibold text-gray-800">{uniqueSubjects.join(', ')}</span>
            </div>
          </div>
        )}

        {/* Timetable content — Mon to Sat grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 text-gray-300 animate-spin" />
              <span className="ml-3 text-sm text-gray-400">Loading timetable…</span>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No sessions scheduled for this batch</p>
              <p className="text-xs text-gray-300 mt-1">Schedule sessions to see the timetable here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ALL_DAYS_TT.map(day => {
                const daySlots = byDay[day] || [];
                const dc = DAY_THEME_TT;
                const hasClasses = daySlots.length > 0;
                return (
                  <div key={day} className={`rounded-xl border ${hasClasses ? dc.border : 'border-gray-100'} overflow-hidden`}>
                    {/* Day badge header */}
                    <div className={`flex items-center gap-2 px-4 py-2 ${hasClasses ? dc.light : 'bg-gray-50'}`}>
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${hasClasses ? dc.bg : 'bg-gray-300'} text-white text-[10px] font-bold`}>
                        {day.slice(0, 2).toUpperCase()}
                      </span>
                      <span className={`text-sm font-bold ${hasClasses ? dc.text : 'text-gray-400'}`}>{day}</span>
                      {!hasClasses && <span className="text-xs text-gray-300 italic ml-1">— No session</span>}
                      {hasClasses && <span className="text-xs text-gray-400 ml-auto">{daySlots.length} session{daySlots.length > 1 ? 's' : ''}</span>}
                    </div>
                    {/* Session rows */}
                    {hasClasses && (
                      <table className="w-full">
                        <tbody>
                          {daySlots.map((s, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 whitespace-nowrap w-40">
                                {s.startTime} – {s.endTime}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-sm font-semibold text-gray-800">{s.subject}</span>
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">{s.teacherName}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-400 w-20 text-right">{s.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with send buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
          {sentResult && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm text-primary">
                Timetable sent to {sentResult.sent} of {sentResult.total} recipient{sentResult.total > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Close
            </button>
            <div className="flex items-center gap-2">
              {slots.length > 0 && (
                <>
                  <Button
                    icon={Send}
                    size="sm"
                    variant="primary"
                    onClick={() => handleSendTimetable(false)}
                    disabled={sending}
                    loading={sending}
                  >
                    {sending ? 'Sending…' : 'Send Timetable'}
                  </Button>
                  <Button
                    icon={RefreshCw}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSendTimetable(true)}
                    disabled={sending}
                    loading={sending}
                  >
                    {sending ? 'Sending…' : 'Send as Update'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Edit Batch Modal (exact same design as CreateBatchWizard) ---
type EditStep = 'students' | 'details' | 'teachers' | 'review';
const EDIT_STEPS: { key: EditStep; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'teachers', label: 'Subjects & Teachers' },
  { key: 'students', label: 'Students' },
  { key: 'review', label: 'Review' },
];

function EditBatchModal({ batch, batches, userRole, onClose, onSaved }: {
  batch: Batch;
  batches: Batch[];
  userRole: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [wizardStep, setWizardStep] = useState<EditStep>('details');
  const [saving, setSaving] = useState(false);

  // Academic settings
  const [SUBJECTS, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [GRADES, setGrades] = useState<string[]>(DEFAULT_GRADES);
  const [BOARDS] = useState<string[]>(DEFAULT_BOARDS);

  // Form state — prefilled from batch
  const [formName, setFormName] = useState(batch.batch_name);
  const [formSubjects, setFormSubjects] = useState<string[]>(batch.subjects || []);
  const [formGrade, setFormGrade] = useState(batch.grade || '');
  const [formSection, setFormSection] = useState(batch.section || '');
  const [formCategory, setFormCategory] = useState(() => {
    const sec = batch.section || '';
    const m = sec.match(/^([A-Z])/i);
    return m ? m[1].toUpperCase() : '';
  });
  const [formBoard, setFormBoard] = useState(batch.board || '');
  const [formCoordinator, setFormCoordinator] = useState(batch.coordinator_email || '');
  const [formMaxStudents, setFormMaxStudents] = useState(String(batch.max_students || ''));
  const [formNotes, setFormNotes] = useState(batch.notes || '');
  const [formStatus, setFormStatus] = useState(batch.status);
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});
  const [selectedStudents, setSelectedStudents] = useState<{ email: string; name: string; parent_email: string | null; parent_name: string | null }[]>([]);

  // People
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [academicOperators, setAcademicOperators] = useState<Person[]>([]);
  const [formAO, setFormAO] = useState(batch.academic_operator_email || '');
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Create user modal (for parents)
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserRole, setCreateUserRole] = useState('parent');
  const [parentForStudent, setParentForStudent] = useState('');

  const toast = useToast();

  // Fetch settings
  useEffect(() => {
    fetch('/api/v1/academics/settings').then(r => r.json()).then(d => {
      if (d.success && d.data?.subjects?.length) setSubjects(d.data.subjects);
      if (d.success && d.data?.grades?.length) setGrades(d.data.grades);
    }).catch(() => {});
  }, []);

  // Fetch batch detail + people on mount
  useEffect(() => {
    const loadPeople = async () => {
      setPeopleLoading(true);
      try {
        const fetches: Promise<Response>[] = [
          fetch(`/api/v1/batches/${batch.batch_id}`),
          fetch('/api/v1/batches/people?role=student'),
          fetch('/api/v1/batches/people?role=teacher'),
          fetch('/api/v1/hr/users?role=batch_coordinator&limit=500'),
        ];
        if (userRole === 'owner') fetches.push(fetch('/api/v1/hr/users?role=academic_operator&limit=500'));
        const responses = await Promise.all(fetches.map(f => f.then(r => r.json())));
        const [detailRes, studRes, teachRes, coordRes] = responses;
        if (studRes.success) setStudents(studRes.data.people);
        if (teachRes.success) setTeachers(teachRes.data.people);
        if (coordRes.success) setCoordinators(coordRes.data.users);
        if (userRole === 'owner' && responses[4]?.success) setAcademicOperators(responses[4].data.users);
        if (detailRes.success) {
          const tMap: Record<string, string> = {};
          for (const t of detailRes.data.teachers || []) tMap[t.subject] = t.teacher_email;
          setSubjectTeachers(tMap);
          setSelectedStudents(
            (detailRes.data.students || []).map((s: BatchStudent) => ({
              email: s.student_email,
              name: s.student_name || s.student_email,
              parent_email: s.parent_email || null,
              parent_name: s.parent_name || null,
            }))
          );
        }
      } catch { toast.error('Failed to load batch details'); }
      setPeopleLoading(false);
    };
    loadPeople();
  }, [batch.batch_id, userRole, toast]);

  const stepIdx = EDIT_STEPS.findIndex(s => s.key === wizardStep);

  // Helpers — category-based section naming (A1, A2, B1, B2, etc.)
  const getSectionsForGradeCategory = (grade: string, category: string): string[] =>
    batches.filter(b => b.batch_id !== batch.batch_id && b.grade === grade && b.section && b.section.startsWith(category)).map(b => b.section as string);
  const getNextNumber = (grade: string, category: string): number => {
    const existing = getSectionsForGradeCategory(grade, category);
    const numbers = existing.map(s => parseInt(s.slice(category.length))).filter(n => !isNaN(n));
    return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  };
  const autoSection = (category: string, num: number) => category ? `${category}${num}` : '';
  const autoName = (grade: string, section: string) => {
    const prefix = BATCH_TYPE_LABELS[batch.batch_type] || '';
    const subj = formSubjects.length > 0 ? ` ${formSubjects.join('+')}` : '';
    const boardPart = formBoard ? ` ${formBoard}` : '';
    if (grade && section) return `${prefix}${subj} Class ${grade}${boardPart} ${section}`.trim();
    if (grade) return `${prefix}${subj} Class ${grade}${boardPart}`.trim();
    return '';
  };

  const handleGradeChange = (g: string) => {
    setFormGrade(g);
    const cat = formCategory || 'A';
    if (!formCategory) setFormCategory('A');
    const num = g ? getNextNumber(g, cat) : 0;
    const sec = g ? autoSection(cat, num) : '';
    setFormSection(sec);
    setFormName(autoName(g, sec));
  };

  const handleCategoryChange = (cat: string) => {
    setFormCategory(cat);
    const num = formGrade ? getNextNumber(formGrade, cat) : 0;
    const sec = formGrade ? autoSection(cat, num) : '';
    setFormSection(sec);
    setFormName(autoName(formGrade, sec));
  };

  const getMaxForType = (): number => {
    if (batch.batch_type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === batch.batch_type);
    return tpl?.maxStudents ?? 50;
  };

  // Regenerate name when board or subjects change (and grade is set)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!formGrade) return;
    setFormName(autoName(formGrade, formSection));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formBoard, formSubjects]);

  const canProceedFromDetails = formName.trim() !== '' && formGrade !== '';
  const canProceedFromTeachers = formSubjects.length > 0;
  const canSubmit = formName.trim() !== '' && formGrade !== '';

  // Student selection — filter by selected grade + region + search
  // normalizeGrade: students stored as 'Class 10', wizard grades are '10'
  const normalizeGrade = (g: string) => g.replace(/^Class\s+/i, '').trim();
  const filteredStudents = students.filter(s => {
    if (formGrade && normalizeGrade(s.grade || '') !== formGrade) return false;
    if (regionFilter && (s.assigned_region || '') !== regionFilter) return false;
    // Hide students already enrolled in another active batch, unless already selected (in this batch)
    const inOtherBatch = (s.current_batches ?? []).length > 0;
    if (inOtherBatch && !selectedStudents.some(sel => sel.email === s.email)) return false;
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const isStudentSelected = (email: string) => selectedStudents.some(s => s.email === email);
  const maxReached = selectedStudents.length >= getMaxForType();

  const toggleStudent = (person: Person) => {
    if (isStudentSelected(person.email)) {
      setSelectedStudents(prev => prev.filter(s => s.email !== person.email));
    } else {
      if (maxReached) { toast.error(`Max ${getMaxForType()} students for this batch type.`); return; }
      setSelectedStudents(prev => [...prev, { email: person.email, name: person.full_name, parent_email: person.parent_email || null, parent_name: person.parent_name || null }]);
    }
  };

  const removeStudent = (email: string) => setSelectedStudents(prev => prev.filter(s => s.email !== email));

  const toggleSubject = (subj: string) => {
    setFormSubjects(prev => {
      if (prev.includes(subj)) {
        setSubjectTeachers(st => { const copy = { ...st }; delete copy[subj]; return copy; });
        return prev.filter(s => s !== subj);
      }
      return [...prev, subj];
    });
  };

  // Create parent — same as CreateBatchWizard
  const openCreateParent = (studentEmail: string) => { setParentForStudent(studentEmail); setCreateUserRole('parent'); setShowCreateUser(true); };
  const handleUserCreated = async (data?: { email: string; full_name: string; temp_password: string }) => {
    if (data && parentForStudent) {
      setSelectedStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      setStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      try {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(parentForStudent)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_email: data.email }),
        });
      } catch { /* ignore */ }
    }
  };

  // Submit — PATCH instead of POST
  const submitBatch = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const body = {
        batch_name: formName.trim(),
        subjects: formSubjects.length > 0 ? formSubjects : null,
        grade: formGrade || null,
        section: formSection || null,
        board: formBoard || null,
        coordinator_email: formCoordinator || null,
        academic_operator_email: formAO || null,
        max_students: batch.batch_type === 'custom' ? (Number(formMaxStudents) || 50) : getMaxForType(),
        notes: formNotes || null,
        status: formStatus,
        teachers: formSubjects.filter(s => subjectTeachers[s]).map(s => ({ email: subjectTeachers[s], subject: s })),
        students: selectedStudents.map(s => ({ email: s.email, parent_email: s.parent_email })),
      };
      const res = await fetch(`/api/v1/batches/${batch.batch_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success('Batch updated successfully!'); onSaved(); }
      else toast.error(json.error || 'Failed to update batch');
    } catch { toast.error('Failed to update batch'); }
    setSaving(false);
  };

  // Navigation — same as CreateBatchWizard
  const goNext = () => { if (stepIdx < EDIT_STEPS.length - 1) setWizardStep(EDIT_STEPS[stepIdx + 1].key); };
  const goPrev = () => { if (stepIdx > 0) setWizardStep(EDIT_STEPS[stepIdx - 1].key); };
  const canGoNext = (): boolean => {
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'teachers') return canProceedFromTeachers;
    if (wizardStep === 'students') return true;
    return false;
  };

  // -- Step renderers — exact same as CreateBatchWizard --

  const renderStudentsStep = () => {
    const max = getMaxForType();
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Add Students</h3>
        <p className="text-gray-500 mb-6">
          {formGrade
            ? <>Showing students in <span className="font-semibold text-primary">Grade {formGrade}</span>{formSection ? <> · Section {formSection}</> : ''}</>
            : 'Select students for this batch'}
        </p>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-semibold text-primary">{selectedStudents.length}</span>
              <span className="text-xs text-primary ml-1">/ {max === 999 ? '∞' : max}</span>
            </div>
            <span className="text-sm text-gray-500">students selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={regionFilter} onChange={setRegionFilter} options={[
              { value: '', label: 'All Regions' },
              ...STUDENT_REGIONS.map(r => ({ value: r.value, label: r.label })),
            ]} className="w-44 text-xs!" />
            <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" className="w-72!" />
          </div>
        </div>

        {selectedStudents.length > 0 && (
          <div className="mb-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Students</h4>
            {selectedStudents.map(s => (
              <div key={s.email} className="rounded-xl border-2 border-primary/20 overflow-hidden">
                <div className="flex items-center justify-between bg-primary/5 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.parent_email ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                        <CheckCircle className="h-3.5 w-3.5" /> Parent: {s.parent_name || s.parent_email}
                      </span>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); openCreateParent(s.email); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-100 border-2 border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-200 transition-all cursor-pointer"
                      >
                        <AlertCircle className="h-4 w-4" /> No Parent — Click to Add
                      </button>
                    )}
                    <IconButton icon={X} onClick={() => removeStudent(s.email)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border rounded-xl max-h-72 overflow-y-auto">
          {peopleLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No students found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0"><tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Student</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Current Batch</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Region</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  const currentBatches: { batch_name: string }[] = Array.isArray(s.current_batches) ? s.current_batches : [];
                  return (
                    <tr key={s.email} className={`border-t hover:bg-primary/5/30 cursor-pointer transition-colors ${selected ? 'bg-primary/5/50' : ''}`} onClick={() => toggleStudent(s)}>
                      <td className="px-4 py-3"><p className="font-medium text-gray-800">{s.full_name}</p><p className="text-xs text-gray-400">{s.email}</p></td>
                      <td className="px-4 py-3 text-gray-500">{s.grade || '—'}</td>
                      <td className="px-4 py-3">{currentBatches.length > 0 ? <div className="flex flex-wrap gap-1">{currentBatches.map((b, i) => <span key={i} className="inline-block text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{b.batch_name}</span>)}</div> : <span className="text-xs text-gray-300">None</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.assigned_region || '—'}</td>
                      <td className="px-4 py-3">{s.parent_email ? <span className="text-xs text-primary">{s.parent_name || s.parent_email}</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded"><AlertCircle className="h-3 w-3" /> No parent</span>}</td>
                      <td className="px-4 py-3 text-right">{selected ? <span className="inline-flex items-center gap-1 text-xs text-primary font-medium"><CheckCircle className="h-3.5 w-3.5" /> Selected</span> : maxReached ? <span className="text-xs text-gray-300">Max reached</span> : <span className="text-xs text-gray-400 hover:text-primary">+ Add</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Batch Details</h3>
      <p className="text-gray-500 mb-8">Configure the basic information for this batch</p>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <FormField label="Grade" required>
            <Select value={formGrade} onChange={handleGradeChange}
              options={[{ value: '', label: 'Select Grade' }, ...GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]}
            />
          </FormField>
          <FormField label="Student Category" required>
            <Select value={formCategory} onChange={handleCategoryChange}
              options={[{ value: '', label: 'Select Category' }, ...DEFAULT_CATEGORIES.map(c => ({ value: c, label: `Category ${c}` }))]}
            />
          </FormField>
          <FormField label="Section (auto)">
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${formSection ? 'border-emerald-300 bg-primary/5' : 'border-gray-200 bg-gray-50'}`}>
              {formSection ? (
                <span className="text-lg font-bold text-primary">{formSection}</span>
              ) : <p className="text-sm text-gray-400">Select grade &amp; category</p>}
            </div>
          </FormField>
        </div>
        <FormField label="Batch Name" required>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Class 10 A1" />
        </FormField>
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Board">
            <Select value={formBoard} onChange={setFormBoard}
              options={[{ value: '', label: 'Select Board' }, ...BOARDS.map(b => ({ value: b, label: b }))]}
            />
          </FormField>
          <FormField label="Coordinator">
            <Select value={formCoordinator} onChange={setFormCoordinator}
              options={[
                { value: '', label: 'Select Coordinator' },
                ...coordinators.map(c => {
                  const bc = batches.filter(b => b.coordinator_email === c.email).length;
                  return { value: c.email, label: `${c.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        </div>
        {userRole === 'owner' && (
          <FormField label="Academic Operator">
            <Select value={formAO} onChange={setFormAO}
              options={[
                { value: '', label: 'Select Academic Operator' },
                ...academicOperators.map(ao => {
                  const bc = batches.filter(b => b.academic_operator_email === ao.email).length;
                  return { value: ao.email, label: `${ao.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Status">
            <Select value={formStatus} onChange={setFormStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </FormField>
          {batch.batch_type === 'custom' && (
            <FormField label="Max Students">
              <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} placeholder="50" />
            </FormField>
          )}
        </div>
        <FormField label="Notes">
          <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
        </FormField>
      </div>
    </div>
  );

  const renderTeachersStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Subjects &amp; Teachers</h3>
      <p className="text-gray-500 mb-8">Select subjects and assign a teacher to each one</p>
      <div className="mb-8">
        {GRADE_SUBJECTS[formGrade] ? (
          <>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Subjects <span className="text-xs font-normal text-primary ml-1">(auto-assigned for Grade {formGrade})</span></label>
            <div className="flex flex-wrap gap-2.5">
              {formSubjects.map(subj => (
                <div key={subj} className="px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-primary bg-primary/5 text-primary shadow-sm">
                  <span className="mr-1.5">✓</span>{subj}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{formSubjects.length} subjects from academic calendar</p>
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Select Subjects *</label>
            <div className="flex flex-wrap gap-2.5">
              {SUBJECTS.map(subj => {
                const isSelected = formSubjects.includes(subj);
                return (
                  <button key={subj} type="button" onClick={() => toggleSubject(subj)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      isSelected ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                    }`}
                  >
                    {isSelected && <span className="mr-1.5">✓</span>}{subj}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">{formSubjects.length} of {SUBJECTS.length} subjects selected</p>
          </>
        )}
      </div>
      {formSubjects.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Assign Teachers <span className="ml-2 text-xs font-normal text-gray-400">{formSubjects.filter(s => subjectTeachers[s]).length} / {formSubjects.length} assigned</span>
          </label>
          <div className="space-y-3">
            {formSubjects.map(subj => {
              const assigned = !!subjectTeachers[subj];
              return (
                <div key={subj} className={`flex items-center gap-4 rounded-xl px-5 py-4 border-2 transition-all ${assigned ? 'border-primary/20 bg-primary/5/50' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${assigned ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-30"><span className="text-sm font-semibold text-gray-800">{subj}</span></div>
                  <div className="flex-1">
                    <TeacherPickerSelect
                      value={subjectTeachers[subj] || ''}
                      onChange={(val) => setSubjectTeachers(prev => ({ ...prev, [subj]: val }))}
                      teachers={teachers.filter(t => { const ts = t.subjects || []; return ts.length === 0 || ts.some(x => x.toLowerCase() === subj.toLowerCase()); })}
                    />
                  </div>
                  {assigned && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Review &amp; Save</h3>
        <p className="text-gray-500 mb-6">Confirm the batch details before saving</p>
      </div>
      <div className="bg-linear-to-r from-primary/5 to-secondary/5 rounded-xl p-5 border border-primary/15">
        <h4 className="text-sm font-bold text-primary mb-4">Batch Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{formName}</span></div>
          <div><span className="text-gray-400">Type:</span> <Badge label={batchTypeLabel(batch.batch_type)} variant={batchTypeBadgeVariant(batch.batch_type)} /></div>
          <div><span className="text-gray-400">Grade / Section:</span> <span className="font-medium text-gray-800">Grade {formGrade}{formSection ? ` ${formSection}` : ''}</span></div>
          <div><span className="text-gray-400">Board:</span> <span className="font-medium text-gray-800">{formBoard || '—'}</span></div>
          <div><span className="text-gray-400">Status:</span> <StatusBadge status={formStatus} /></div>
          <div><span className="text-gray-400">Coordinator:</span> <span className="font-medium text-gray-800">{coordinators.find(c => c.email === formCoordinator)?.full_name || formCoordinator || '—'}</span></div>
          {userRole === 'owner' && <div><span className="text-gray-400">Academic Operator:</span> <span className="font-medium text-gray-800">{academicOperators.find(a => a.email === formAO)?.full_name || formAO || '—'}</span></div>}
          <div><span className="text-gray-400">Students:</span> <span className="font-medium text-gray-800">{selectedStudents.length}</span></div>
        </div>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subjects &amp; Teachers ({formSubjects.length})</h4>
          <div className="space-y-2">
            {formSubjects.map(subj => {
              const teacherEmail = subjectTeachers[subj];
              const teacher = teachers.find(t => t.email === teacherEmail);
              return (
                <div key={subj} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${teacher ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-gray-700 min-w-30">{subj}</span>
                  <span className="text-gray-300">→</span>
                  {teacher ? <span className="text-primary">{teacher.full_name}</span> : <span className="text-amber-500 italic">No teacher assigned</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedStudents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Enrolled Students ({selectedStudents.length})</h4>
          <div className="space-y-2">
            {selectedStudents.map(s => (
              <div key={s.email} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0).toUpperCase()}</div>
                <span className="font-semibold text-gray-700">{s.name}</span>
                <span className="text-gray-400 text-xs">{s.email}</span>
                {s.parent_email ? <span className="ml-auto text-xs text-primary">Parent: {s.parent_name || s.parent_email}</span> : <span className="ml-auto text-xs text-amber-500">No parent assigned</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {formNotes && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
          <p className="text-sm text-gray-600">{formNotes}</p>
        </div>
      )}
    </div>
  );

  // -- Wizard overlay — exact same as CreateBatchWizard --
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Left sidebar */}
          <div className="w-60 bg-linear-to-b from-primary via-primary/90 to-secondary p-6 flex flex-col shrink-0">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg">Edit Batch</h2>
              <p className="text-primary/60 text-xs mt-1">Step {stepIdx + 1} of {EDIT_STEPS.length}</p>
            </div>
            <div className="space-y-1 flex-1">
              {EDIT_STEPS.map((step, idx) => {
                const isDone = idx < stepIdx;
                const isCurrent = idx === stepIdx;
                return (
                  <div key={step.key}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-primary/60' : 'text-primary/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isDone ? 'bg-primary text-emerald-900' : isCurrent ? 'bg-white text-primary' : 'bg-primary/30 text-primary/80/70'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={onClose} className="mt-4 text-primary/60 hover:text-white text-xs flex items-center gap-2 transition">
              <X className="h-3.5 w-3.5" /> Cancel &amp; Close
            </button>
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
              {wizardStep === 'students' && renderStudentsStep()}
              {wizardStep === 'details' && renderDetailsStep()}
              {wizardStep === 'teachers' && renderTeachersStep()}
              {wizardStep === 'review' && renderReviewStep()}
            </div>
            <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
              <div>{stepIdx > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>}</div>
              <div className="flex items-center gap-3">
                {wizardStep !== 'review' ? (
                  <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">Continue</Button>
                ) : (
                  <Button variant="primary" icon={CheckCircle} onClick={submitBatch} disabled={!canSubmit || saving} size="lg">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create User Modal (for parents) */}
      <CreateUserModal
        role={createUserRole}
        open={showCreateUser}
        onClose={() => { setShowCreateUser(false); setParentForStudent(''); }}
        onCreated={handleUserCreated}
      />
    </>
  );
}


// =============================================================
// TAB: Materials (Academic Operator upload + manage)
// Library + Multi-Batch Assignment model
// =============================================================

interface MaterialBatchRef { batch_id: string; batch_name: string }

interface TeachingMaterial {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  material_type: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string | null;
  file_size: number | null;
  mime_type: string | null;
  batches: MaterialBatchRef[];
  // backward compat
  batch_id?: string | null;
  batch_name?: string | null;
}

const MATERIAL_TYPE_STYLE: Record<string, string> = {
  notes:      'bg-blue-50   text-blue-700   border-blue-200',
  assignment: 'bg-amber-50  text-amber-700  border-amber-200',
  resource:   'bg-primary/5 text-primary border-primary/20',
  video:      'bg-purple-50 text-purple-700  border-purple-200',
  other:      'bg-gray-50   text-gray-600   border-gray-200',
};

const MATERIAL_TYPES = ['notes', 'assignment', 'resource', 'video', 'other'];

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialsTab({
  userEmail, userRole, batches,
}: {
  userEmail: string;
  userRole: string;
  batches: Batch[];
}) {
  const toast   = useToast();
  const { confirm } = useConfirm();

  const [materials, setMaterials]        = useState<TeachingMaterial[]>([]);
  const [loading, setLoading]            = useState(true);
  const [submitting, setSubmitting]      = useState(false);
  const [showForm, setShowForm]          = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterBatch, setFilterBatch]     = useState('');
  const [filterType, setFilterType]       = useState('');
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [editMaterial, setEditMaterial]   = useState<TeachingMaterial | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  /* -- Upload form state ------------------------------------ */
  const emptyForm = { subject: '', title: '', description: '', material_type: 'notes', batch_ids: [] as string[] };
  const [form, setForm] = useState(emptyForm);

  /* -- Edit form state -------------------------------------- */
  const [editForm, setEditForm] = useState({ title: '', description: '', material_type: '', batch_ids: [] as string[] });

  /* -- Fetch materials -------------------------------------- */
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBatch) params.set('batch_id', filterBatch);
      const res = await fetch(`/api/v1/teaching-materials?${params}`);
      const data = await res.json();
      if (data.success) setMaterials(data.data.materials || []);
    } catch { toast.error('Failed to load materials'); }
    finally { setLoading(false); }
  }, [filterBatch, toast]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  /* -- Upload handler --------------------------------------- */
  const handleSubmit = async () => {
    if (!form.subject.trim())     { toast.error('Subject is required');           return; }
    if (!form.title.trim())       { toast.error('Title is required');             return; }
    if (!selectedFile)            { toast.error('Please select a file to upload'); return; }
    if (form.batch_ids.length === 0) { toast.error('Select at least one batch');  return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('batch_ids', JSON.stringify(form.batch_ids));
      fd.append('subject', form.subject);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('material_type', form.material_type);
      const res = await fetch('/api/v1/teaching-materials', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Upload failed'); return; }
      toast.success(`Uploaded to ${form.batch_ids.length} batch${form.batch_ids.length > 1 ? 'es' : ''}`);
      setForm(emptyForm);
      setSelectedFile(null);
      setShowForm(false);
      fetchMaterials();
    } catch { toast.error('Server error'); }
    finally { setSubmitting(false); }
  };

  /* -- Edit handler ----------------------------------------- */
  const handleEdit = async () => {
    if (!editMaterial) return;
    setEditSubmitting(true);
    try {
      const res = await fetch('/api/v1/teaching-materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editMaterial.id,
          title: editForm.title,
          description: editForm.description,
          material_type: editForm.material_type,
          batch_ids: editForm.batch_ids,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Update failed'); return; }
      toast.success('Material updated');
      setEditMaterial(null);
      fetchMaterials();
    } catch { toast.error('Server error'); }
    finally { setEditSubmitting(false); }
  };

  /* -- Delete handler --------------------------------------- */
  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({ title: 'Delete Material', message: `Delete "${title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/teaching-materials?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Delete failed'); return; }
      toast.success('Material deleted');
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch { toast.error('Server error'); }
  };

  /* -- Open edit modal -------------------------------------- */
  const openEdit = (m: TeachingMaterial) => {
    setEditMaterial(m);
    setEditForm({
      title: m.title,
      description: m.description || '',
      material_type: m.material_type,
      batch_ids: m.batches.map(b => b.batch_id),
    });
  };

  /* -- Computed --------------------------------------------- */
  const subjectOptions = Array.from(new Set(batches.flatMap(b => b.subjects ?? []))).sort();

  // Client-side filters (subject, type applied client-side; batch goes to API)
  const filteredMaterials = materials.filter(m => {
    if (filterSubject && m.subject !== filterSubject) return false;
    if (filterType && m.material_type !== filterType) return false;
    return true;
  });

  const totalMaterials = materials.length;
  const uniqueSubjects = new Set(materials.map(m => m.subject)).size;
  const assignedBatchIds = new Set(materials.flatMap(m => m.batches.map(b => b.batch_id)));
  const uniqueBatches = assignedBatchIds.size;
  const typeCount: Record<string, number> = {};
  for (const m of materials) typeCount[m.material_type] = (typeCount[m.material_type] || 0) + 1;

  /* -- Batch toggle helpers --------------------------------- */
  const toggleBatch = (batchId: string) => {
    setForm(f => ({
      ...f,
      batch_ids: f.batch_ids.includes(batchId)
        ? f.batch_ids.filter(id => id !== batchId)
        : [...f.batch_ids, batchId],
    }));
  };
  const toggleEditBatch = (batchId: string) => {
    setEditForm(f => ({
      ...f,
      batch_ids: f.batch_ids.includes(batchId)
        ? f.batch_ids.filter(id => id !== batchId)
        : [...f.batch_ids, batchId],
    }));
  };

  return (
    <div className="space-y-5">
      {/* -- Header ----------------------------------- */}
      <PageHeader icon={FolderOpen} title="Teaching Materials" subtitle={`${totalMaterials} files · ${uniqueSubjects} subjects · ${uniqueBatches} batches`}>
        <RefreshButton onClick={fetchMaterials} loading={loading} />
        <Button variant="primary" icon={showForm ? X : Upload} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : 'Upload Material'}
        </Button>
      </PageHeader>

      {/* -- Stat Cards ------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={FileText} label="Total Files" value={totalMaterials} variant="default" />
        <StatCard icon={BookOpen} label="Subjects" value={uniqueSubjects} variant="info" />
        <StatCard icon={Layers} label="Batches" value={uniqueBatches} variant="success" />
        <StatCard icon={FolderOpen} label="Notes" value={typeCount['notes'] || 0} variant="warning" />
      </div>

      {/* -- Upload Form ------------------------------ */}
      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-primary/5/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-primary">Upload New Material</p>
          <FormGrid>
            <FormField label="Subject *">
              <Select
                value={form.subject}
                onChange={v => setForm(f => ({ ...f, subject: v }))}
                options={[
                  { value: '', label: 'Select subject…' },
                  ...subjectOptions.map(s => ({ value: s, label: s })),
                ]}
              />
            </FormField>
            <FormField label="Material Type">
              <Select
                value={form.material_type}
                onChange={v => setForm(f => ({ ...f, material_type: v }))}
                options={MATERIAL_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              />
            </FormField>
            <FormField label="Title *">
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Chapter 5 Notes"
              />
            </FormField>
          </FormGrid>
          <FormField label="Description">
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes about this material…"
              rows={2}
            />
          </FormField>

          {/* -- Multi-batch selector ------------------- */}
          <FormField label={`Assign to Batches * (${form.batch_ids.length} selected)`}>
            <div className="space-y-2 mt-1">
              <div className="flex gap-2 items-center text-xs">
                <button type="button" className="text-primary hover:underline font-medium"
                  onClick={() => setForm(f => ({ ...f, batch_ids: batches.map(b => b.batch_id) }))}>
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button type="button" className="text-gray-500 hover:underline"
                  onClick={() => setForm(f => ({ ...f, batch_ids: [] }))}>
                  Clear
                </button>
                {form.subject && (
                  <>
                    <span className="text-gray-300">|</span>
                    <button type="button" className="text-blue-600 hover:underline"
                      onClick={() => setForm(f => ({
                        ...f,
                        batch_ids: batches.filter(b => (b.subjects ?? []).includes(f.subject)).map(b => b.batch_id),
                      }))}>
                      Select &quot;{form.subject}&quot; batches
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {batches.map(b => (
                  <label key={b.batch_id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${
                      form.batch_ids.includes(b.batch_id)
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <input type="checkbox" className="sr-only"
                      checked={form.batch_ids.includes(b.batch_id)}
                      onChange={() => toggleBatch(b.batch_id)} />
                    <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${form.batch_ids.includes(b.batch_id) ? 'text-primary' : 'text-gray-300'}`} />
                    <span className="truncate max-w-[200px]">{b.batch_name}</span>
                    {b.grade && <span className="text-[10px] text-gray-400 ml-0.5">Gr.{b.grade}</span>}
                  </label>
                ))}
              </div>
            </div>
          </FormField>

          {/* -- File picker ---------------------------- */}
          <FormField label="File * (PDF, Word, Excel, PowerPoint, images — max 50 MB)">
            <div className="mt-1">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer bg-white hover:bg-primary/5 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {selectedFile ? (
                    <>
                      <FileText className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-semibold text-primary">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtBytes(selectedFile.size)}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Click to select file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Word, PPT, Excel, images, videos, audio, Samsung Notes, ZIP &amp; more (max 200 MB)</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="*"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-1.5 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Remove file
                </button>
              )}
            </div>
          </FormField>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setForm(emptyForm); setSelectedFile(null); setShowForm(false); }}>Cancel</Button>
            <Button variant="primary" icon={Send} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Uploading…' : `Upload${form.batch_ids.length > 1 ? ` to ${form.batch_ids.length} batches` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* -- Filters ---------------------------------- */}
      <div className="flex gap-3 flex-wrap">
        <FilterSelect
          value={filterSubject}
          onChange={v => setFilterSubject(v)}
          options={[
            { value: '', label: 'All subjects' },
            ...subjectOptions.map(s => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          value={filterBatch}
          onChange={v => setFilterBatch(v)}
          options={[
            { value: '', label: 'All batches' },
            ...batches.map(b => ({ value: b.batch_id, label: b.batch_name })),
          ]}
        />
        <FilterSelect
          value={filterType}
          onChange={v => setFilterType(v)}
          options={[
            { value: '', label: 'All types' },
            ...MATERIAL_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
          ]}
        />
      </div>

      {/* -- Material cards --------------------------- */}
      {loading ? (
        <LoadingState />
      ) : filteredMaterials.length === 0 ? (
        <EmptyState icon={FolderOpen} message="No materials found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMaterials.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Type + subject badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${MATERIAL_TYPE_STYLE[m.material_type] ?? MATERIAL_TYPE_STYLE.other}`}>
                      {m.material_type}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.subject}</span>
                  </div>
                  {/* Batch pills (multiple) */}
                  {m.batches.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {m.batches.map(b => (
                        <span key={b.batch_id} className="text-[11px] bg-primary/5 text-primary border border-primary/15 px-1.5 py-0.5 rounded-full">
                          {b.batch_name}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.batches.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1 italic">Not assigned to any batch</p>
                  )}
                  <p className="text-sm font-semibold text-gray-800 truncate mt-1.5">{m.title}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(m)} className="text-gray-300 hover:text-blue-500 transition-colors p-1" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(m.id, m.title)} className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {m.file_size && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fmtBytes(m.file_size)}</span>
                  )}
                </div>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-emerald-900 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {m.file_name || 'Open file'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Edit Modal ------------------------------- */}
      {editMaterial && (
        <Modal open={!!editMaterial} onClose={() => setEditMaterial(null)} title="Edit Material" subtitle={editMaterial.file_name ?? undefined}>
          <div className="space-y-4">
            <FormGrid>
              <FormField label="Title *">
                <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </FormField>
              <FormField label="Material Type">
                <Select
                  value={editForm.material_type}
                  onChange={v => setEditForm(f => ({ ...f, material_type: v }))}
                  options={MATERIAL_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
                />
              </FormField>
            </FormGrid>
            <FormField label="Description">
              <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </FormField>
            <FormField label={`Assigned Batches (${editForm.batch_ids.length})`}>
              <div className="space-y-2 mt-1">
                <div className="flex gap-2 items-center text-xs">
                  <button type="button" className="text-primary hover:underline font-medium"
                    onClick={() => setEditForm(f => ({ ...f, batch_ids: batches.map(b => b.batch_id) }))}>
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button type="button" className="text-gray-500 hover:underline"
                    onClick={() => setEditForm(f => ({ ...f, batch_ids: [] }))}>
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {batches.map(b => (
                    <label key={b.batch_id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${
                        editForm.batch_ids.includes(b.batch_id)
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <input type="checkbox" className="sr-only"
                        checked={editForm.batch_ids.includes(b.batch_id)}
                        onChange={() => toggleEditBatch(b.batch_id)} />
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${editForm.batch_ids.includes(b.batch_id) ? 'text-primary' : 'text-gray-300'}`} />
                      <span className="truncate max-w-[200px]">{b.batch_name}</span>
                      {b.grade && <span className="text-[10px] text-gray-400 ml-0.5">Gr.{b.grade}</span>}
                    </label>
                  ))}
                </div>
              </div>
            </FormField>
            <FormActions onCancel={() => setEditMaterial(null)} onSubmit={handleEdit}
              submitLabel="Save Changes" submitting={editSubmitting} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===============================================================
// TAB: Exam Questions (structured upload with categorization)
// ===============================================================

interface ExamTopicFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

interface ExamTopic {
  id: string;
  title: string;
  subject: string;
  grade: string;
  board?: string;
  category?: 'question_paper' | 'topic';
  paper_type?: string;
  chapter_name?: string;
  topic_name?: string;
  question_count: number;
  generated_questions?: number;
  status: 'generating' | 'ready' | 'failed' | 'archived';
  generation_progress?: string | null;
  error_message?: string;
  pdf_url?: string;
  pdf_filename?: string;
  uploaded_by: string;
  created_at: string;
  files: ExamTopicFile[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(mime: string): string {
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📗';
  if (mime.includes('word') || mime.includes('document')) return '📘';
  return '📄';
}

function fileTypeLabel(mime: string): string {
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('word') || mime.includes('document')) return 'DOC';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'PPT';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'XLS';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.includes('csv') || mime.includes('text/plain')) return 'Text';
  return 'File';
}

const PAPER_TYPES = [
  'Previous Year Question Paper',
  'Model Question Paper',
  'Onam Exam',
  'Christmas Exam',
  'Annual Exam',
  'Quarterly Exam',
  'Half-Yearly Exam',
  'Unit Test',
  'Practice Paper',
  'Sample Paper',
  'Other',
];

function ExamTopicsTab({ userEmail, batches }: { userEmail: string; batches: Batch[] }) {
  const toast = useToast();
  const { confirm } = useConfirm();

  const [topics, setTopics] = useState<ExamTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [genStartTime, setGenStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [genCountPromptId, setGenCountPromptId] = useState<string | null>(null);
  const [genCountValue, setGenCountValue] = useState('10');
  const [viewTopicId, setViewTopicId] = useState<string | null>(null);
  const [viewTopicTitle, setViewTopicTitle] = useState('');
  const [viewQuestions, setViewQuestions] = useState<ViewQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emptyForm = {
    title: '', grade: '', board: '', subject: '',
    category: '' as '' | 'question_paper' | 'topic',
    paper_type: '', chapter_name: '', topic_name: '',
  };
  const [form, setForm] = useState(emptyForm);

  const gradeOptions = DEFAULT_GRADES;
  const boardList = DEFAULT_BOARDS;
  const subjectOptions = DEFAULT_SUBJECTS;

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.set('subject', filterSubject);
      if (filterGrade) params.set('grade', filterGrade);
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/v1/session-exam-topics?${params}`);
      const data = await res.json();
      if (data.success) setTopics(data.data || []);
    } catch { toast.error('Failed to load exam topics'); }
    finally { setLoading(false); }
  }, [filterSubject, filterGrade, filterCategory, toast]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  // Elapsed timer while generating
  useEffect(() => {
    if (!genStartTime) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - genStartTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [genStartTime]);

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const progressLabel = (stage?: string | null) => {
    switch (stage) {
      case 'extracting': return 'Extracting text from files…';
      case 'building_prompt': return 'Building AI prompt…';
      case 'generating_ai': return 'AI is generating questions…';
      case 'parsing': return 'Parsing AI response…';
      case 'saving': return 'Saving questions…';
      default: return 'Starting…';
    }
  };

  const progressPercent = (stage?: string | null) => {
    switch (stage) {
      case 'extracting': return 15;
      case 'building_prompt': return 25;
      case 'generating_ai': return 60;
      case 'parsing': return 85;
      case 'saving': return 95;
      default: return 5;
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      toast.error('Maximum 10 files allowed');
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.grade.trim())    { toast.error('Grade is required'); return; }
    if (!form.board.trim())    { toast.error('Board is required'); return; }
    if (!form.subject.trim())  { toast.error('Subject is required'); return; }
    if (!form.category)        { toast.error('Please select Question Paper or Topic'); return; }
    if (form.category === 'question_paper' && !form.paper_type.trim()) {
      toast.error('Paper type is required'); return;
    }
    // Clean sentinel values before validation
    const chapterName = form.chapter_name === '__other__' ? '' : form.chapter_name;
    const topicName = form.topic_name === '__other__' ? '' : form.topic_name;
    if (form.category === 'topic' && !chapterName.trim()) {
      toast.error('Chapter name is required'); return;
    }
    if (!form.title.trim())    { toast.error('Title is required'); return; }
    if (!selectedFiles.length) { toast.error('Please select at least one file'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      for (const f of selectedFiles) fd.append('files', f);
      fd.append('title', form.title);
      fd.append('grade', form.grade);
      fd.append('board', form.board);
      fd.append('subject', form.subject);
      fd.append('category', form.category);
      if (form.category === 'question_paper' && form.paper_type) fd.append('paper_type', form.paper_type);
      if (form.category === 'topic') {
        if (chapterName) fd.append('chapter_name', chapterName);
        if (topicName) fd.append('topic_name', topicName);
      }
      const res = await fetch('/api/v1/session-exam-topics', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Upload failed'); return; }
      toast.success('Questions uploaded successfully');
      setForm(emptyForm);
      setSelectedFiles([]);
      setShowForm(false);
      fetchTopics();
    } catch { toast.error('Server error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({ title: 'Delete Exam Topic', message: `Delete "${title}" and all its questions/results? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/session-exam-topics?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Delete failed'); return; }
      toast.success('Deleted');
      setTopics(prev => prev.filter(t => t.id !== id));
    } catch { toast.error('Server error'); }
  };

  const handleGenerate = async (topicId: string, count?: number) => {
    setGenCountPromptId(null);
    setGeneratingId(topicId);
    setGenStartTime(Date.now());
    try {
      const res = await fetch('/api/v1/session-exam-topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, ...(count ? { count } : {}) }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Generation failed'); setGeneratingId(null); setGenStartTime(null); return; }
      toast.success('Generation started — this may take a few minutes');
      // Poll for completion every 5 seconds (also picks up progress stage)
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`/api/v1/session-exam-topics?limit=100`);
          const d = await r.json();
          if (!d.success) return;
          setTopics(d.data || []);
          const topic = (d.data || []).find((t: { id: string }) => t.id === topicId);
          if (!topic || topic.status !== 'generating') {
            clearInterval(poll);
            pollRef.current = null;
            setGeneratingId(null);
            setGenStartTime(null);
            if (topic?.error_message) toast.error(topic.error_message);
            else if (topic?.generated_questions > 0) toast.success(`Generated ${topic.generated_questions} questions`);
          }
        } catch { /* ignore poll errors */ }
      }, 5_000);
      pollRef.current = poll;
    } catch { toast.error('Server error during generation'); setGeneratingId(null); setGenStartTime(null); }
  };

  const handleCancelGenerate = async (topicId: string) => {
    try {
      const res = await fetch('/api/v1/session-exam-topics/generate/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId }),
      });
      const data = await res.json();
      if (data.success) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setGeneratingId(null);
        setGenStartTime(null);
        toast.success('Generation cancelled');
        fetchTopics();
      } else {
        toast.error(data.error || 'Failed to cancel');
      }
    } catch { toast.error('Failed to cancel generation'); }
  };

  const handleViewQuestions = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    setViewTopicId(topicId);
    setViewTopicTitle(topic?.title || 'Questions');
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/v1/session-exam-topics/questions?topic_id=${topicId}`);
      const data = await res.json();
      if (data.success) setViewQuestions(data.data || []);
      else toast.error(data.error || 'Failed to load questions');
    } catch { toast.error('Failed to load questions'); }
    finally { setLoadingQuestions(false); }
  };

  const totalFiles = topics.reduce((sum, t) => sum + (t.files?.length || 0), 0);

  // derive whether each form step is complete to show progressive fields
  const gradeSelected = !!form.grade;
  const boardSelected = gradeSelected && !!form.board;
  const subjectSelected = boardSelected && !!form.subject;
  const categorySelected = subjectSelected && !!form.category;

  return (
    <div className="space-y-5">
      <PageHeader icon={ClipboardList} title="Exam Questions" subtitle={`${topics.length} uploads`}>
        <RefreshButton onClick={fetchTopics} loading={loading} />
        <Button variant="primary" icon={showForm ? X : Upload} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : 'Upload Questions'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Total Uploads" value={topics.length} variant="default" />
        <StatCard icon={FileText} label="Total Files" value={totalFiles} variant="success" />
        <StatCard icon={CheckCircle2} label="Ready" value={topics.filter(t => t.status === 'ready').length} variant="success" />
      </div>

      {/* ── Upload Form ── */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-blue-800">Upload Exam Questions</p>
          <p className="text-xs text-blue-600">Select grade, board, subject, then choose Question Paper or Topic.</p>

          {/* Step 1: Grade → Board → Subject */}
          <FormGrid>
            <FormField label="Grade *">
              <Select
                value={form.grade}
                onChange={v => setForm(f => ({ ...f, grade: v, board: '', subject: '', category: '' as const, paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                options={[
                  { value: '', label: 'Select grade...' },
                  ...gradeOptions.map(g => ({ value: g, label: `Grade ${g}` })),
                ]}
              />
            </FormField>
            {gradeSelected && (
              <FormField label="Board *">
                <Select
                  value={form.board}
                  onChange={v => setForm(f => ({ ...f, board: v, subject: '', category: '' as const, paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  options={[
                    { value: '', label: 'Select board...' },
                    ...DEFAULT_BOARDS.map(b => ({ value: b, label: b })),
                  ]}
                />
              </FormField>
            )}
            {boardSelected && (
              <FormField label="Subject *">
                <Select
                  value={form.subject}
                  onChange={v => setForm(f => ({ ...f, subject: v, category: '' as const, paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  options={[
                    { value: '', label: 'Select subject...' },
                    ...subjectOptions.map(s => ({ value: s, label: s })),
                  ]}
                />
              </FormField>
            )}
          </FormGrid>

          {/* Step 2: Category — Question Paper or Topic */}
          {subjectSelected && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-600">Choose type *</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, category: 'question_paper', paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.category === 'question_paper'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">📝 Question Paper</p>
                  <p className="text-xs text-gray-500 mt-0.5">Previous year, model, exam papers</p>
                </button>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, category: 'topic', paper_type: '', chapter_name: '', topic_name: '', title: '' }))}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.category === 'topic'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">📖 Topic / Chapter</p>
                  <p className="text-xs text-gray-500 mt-0.5">Chapter-wise questions by topic</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 3a: Question Paper sub-fields */}
          {form.category === 'question_paper' && (
            <FormGrid>
              <FormField label="Paper Type *">
                <Select
                  value={form.paper_type}
                  onChange={v => {
                    const autoTitle = `${v} — ${form.subject} Gr.${form.grade}`;
                    setForm(f => ({ ...f, paper_type: v, title: autoTitle }));
                  }}
                  options={[
                    { value: '', label: 'Select paper type...' },
                    ...PAPER_TYPES.map(p => ({ value: p, label: p })),
                  ]}
                />
              </FormField>
              <FormField label="Title *">
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. CBSE 2024 Mathematics Final"
                />
              </FormField>
            </FormGrid>
          )}

          {/* Step 3b: Topic sub-fields */}
          {form.category === 'topic' && (() => {
            const chapters = getChapters(form.board, form.grade, form.subject);
            const hasChapterData = chapters.length > 0;
            const selectedChapter = chapters.find(c => c.name === form.chapter_name);
            const hasTopicData = (selectedChapter?.topics?.length ?? 0) > 0;
            // Track "Other" state via special sentinel
            const isChapterOther = form.chapter_name === '__other__' || (!hasChapterData && form.chapter_name !== '');
            const isTopicOther = form.topic_name === '__other__';
            return (
            <FormGrid>
              <FormField label="Chapter Name *">
                {hasChapterData ? (
                  <>
                    <Select
                      value={isChapterOther ? '__other__' : form.chapter_name}
                      onChange={v => {
                        if (v === '__other__') {
                          setForm(f => ({ ...f, chapter_name: '__other__', topic_name: '', title: '' }));
                        } else {
                          const autoTitle = v ? `${v} — ${form.subject} Gr.${form.grade}` : '';
                          setForm(f => ({ ...f, chapter_name: v, topic_name: '', title: autoTitle }));
                        }
                      }}
                      options={[
                        { value: '', label: 'Select chapter...' },
                        ...chapters.map(c => ({ value: c.name, label: c.name })),
                        { value: '__other__', label: '— Other (enter manually) —' },
                      ]}
                    />
                    {isChapterOther && (
                      <Input
                        className="mt-2"
                        value={form.chapter_name === '__other__' ? '' : form.chapter_name}
                        onChange={e => setForm(f => ({ ...f, chapter_name: e.target.value || '__other__', topic_name: '', title: e.target.value ? `${e.target.value} — ${f.subject} Gr.${f.grade}` : '' }))}
                        placeholder="Enter chapter name..."
                      />
                    )}
                  </>
                ) : (
                  <Input
                    value={form.chapter_name}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, chapter_name: v, title: v ? `${v} — ${f.subject} Gr.${f.grade}` : '' }));
                    }}
                    placeholder="e.g. Chapter 4 — Quadratic Equations"
                  />
                )}
              </FormField>
              {form.chapter_name && form.chapter_name !== '__other__' && (
                <FormField label="Topic / Subtopic">
                  {hasTopicData ? (
                    <>
                      <Select
                        value={isTopicOther ? '__other__' : form.topic_name}
                        onChange={v => {
                          if (v === '__other__') {
                            setForm(f => ({ ...f, topic_name: '__other__' }));
                          } else {
                            setForm(f => ({
                              ...f, topic_name: v,
                              title: v ? `${f.chapter_name} — ${v} (${f.subject} Gr.${f.grade})` : `${f.chapter_name} — ${f.subject} Gr.${f.grade}`,
                            }));
                          }
                        }}
                        options={[
                          { value: '', label: 'Select topic...' },
                          { value: 'Full Chapter', label: '📚 Full Chapter' },
                          ...selectedChapter!.topics.map(t => ({ value: t, label: t })),
                          { value: '__other__', label: '— Other (enter manually) —' },
                        ]}
                      />
                      {isTopicOther && (
                        <Input
                          className="mt-2"
                          value={form.topic_name === '__other__' ? '' : form.topic_name}
                          onChange={e => setForm(f => ({ ...f, topic_name: e.target.value || '__other__' }))}
                          placeholder="Enter topic name..."
                        />
                      )}
                    </>
                  ) : (
                    <Input
                      value={form.topic_name}
                      onChange={e => setForm(f => ({ ...f, topic_name: e.target.value }))}
                      placeholder="e.g. Discriminant & Nature of Roots"
                    />
                  )}
                </FormField>
              )}
              <FormField label="Title *">
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Quadratic Equations — Practice Questions"
                />
              </FormField>
            </FormGrid>
            );
          })()}

          {/* Step 4: Files */}
          {categorySelected && (
            <FormField label="Question Files * (max 10 files, 20 MB each)">
              <div className="mt-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-white hover:bg-blue-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Click to select files</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, PPT, XLS, Images, Text — all formats (max 20 MB each)</p>
                  </div>
                  <input type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg"
                    onChange={handleFilesSelected} />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 rounded-lg bg-white border border-gray-100 p-2.5">
                        <span className="text-lg">{fileTypeIcon(f.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            <span>{formatFileSize(f.size)}</span>
                            <span>{fileTypeLabel(f.type)}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeFile(idx)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setForm(emptyForm); setSelectedFiles([]); setShowForm(false); }}>Cancel</Button>
            <Button variant="primary" icon={Send} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload Questions'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex gap-3 flex-wrap">
        <FilterSelect value={filterGrade} onChange={v => setFilterGrade(v)}
          options={[{ value: '', label: 'All grades' }, ...DEFAULT_GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]} />
        <FilterSelect value={filterSubject} onChange={v => setFilterSubject(v)}
          options={[{ value: '', label: 'All subjects' }, ...DEFAULT_SUBJECTS.map(s => ({ value: s, label: s }))]} />
        <FilterSelect value={filterCategory} onChange={v => setFilterCategory(v)}
          options={[{ value: '', label: 'All types' }, { value: 'question_paper', label: 'Question Papers' }, { value: 'topic', label: 'Topics' }]} />
      </div>

      {/* ── Topic Cards ── */}
      {loading ? (
        <LoadingState />
      ) : topics.length === 0 ? (
        <EmptyState icon={ClipboardList} message="No exam questions found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map(t => (
            <div key={t.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {t.category === 'question_paper' ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">📝 QP</span>
                    ) : t.category === 'topic' ? (
                      <span className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-full font-medium">📖 Topic</span>
                    ) : null}
                    <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{t.subject}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Gr.{t.grade}</span>
                    {t.board && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{t.board}</span>
                    )}
                    {t.files?.length > 0 && (
                      <span className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-full">{t.files.length} file{t.files.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate mt-1">{t.title}</p>
                  {/* Sub-info based on category */}
                  {t.category === 'question_paper' && t.paper_type && (
                    <p className="text-xs text-blue-600 mt-0.5">{t.paper_type}</p>
                  )}
                  {t.category === 'topic' && (t.chapter_name || t.topic_name) && (
                    <p className="text-xs text-primary mt-0.5">
                      {t.chapter_name}{t.topic_name ? ` → ${t.topic_name}` : ''}
                    </p>
                  )}
                </div>
                <button onClick={() => handleDelete(t.id, t.title)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Files list — MaterialsPanel style */}
              {t.files && t.files.length > 0 && (
                <div className="space-y-1.5">
                  {t.files.map(f => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 p-2.5 transition-colors group">
                      <span className="text-lg">{fileTypeIcon(f.mime_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{f.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span>{formatFileSize(f.file_size)}</span>
                          <span>{fileTypeLabel(f.mime_type)}</span>
                        </div>
                      </div>
                      <span className="text-gray-300 group-hover:text-blue-500 text-sm">↗</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Legacy: show old pdf_url if no files in new table */}
              {(!t.files || t.files.length === 0) && t.pdf_url && (
                <a href={t.pdf_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 p-2.5 transition-colors group">
                  <span className="text-lg">📕</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">{t.pdf_filename || 'PDF'}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-500 text-sm">↗</span>
                </a>
              )}

              {/* Generate button + progress + question count */}
              {(generatingId === t.id || t.status === 'generating') ? (
                <div className="space-y-2 bg-violet-50/60 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-violet-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{progressLabel(t.generation_progress)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-violet-500 tabular-nums">
                      <Clock className="h-3 w-3" />
                      <span>{fmtElapsed(elapsed)}</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-violet-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progressPercent(t.generation_progress)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-violet-400">AI question generation typically takes 2–4 minutes</p>
                  <button onClick={() => handleCancelGenerate(t.id)}
                    className="flex items-center justify-center gap-1.5 w-full text-xs font-medium py-1.5 rounded-lg bg-white/80 text-red-600 hover:bg-red-50 border border-red-200 transition-colors">
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              ) : (
                <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {(t.generated_questions ?? 0) > 0 ? (
                      <button
                        onClick={() => handleViewQuestions(t.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> {t.generated_questions} Qs
                      </button>
                    ) : null}
                    {t.error_message && (
                      <span className="text-xs text-red-500 truncate max-w-[180px]" title={t.error_message}>
                        ⚠️ {t.error_message.slice(0, 50)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (t.category === 'topic') {
                        setGenCountPromptId(t.id);
                        setGenCountValue('10');
                      } else {
                        handleGenerate(t.id);
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all bg-violet-50 text-violet-700 hover:bg-violet-100 hover:shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {(t.generated_questions ?? 0) > 0 ? 'Re-generate' : 'Generate'}
                  </button>
                </div>
                {/* Inline question count prompt for topic mode */}
                {genCountPromptId === t.id && (
                  <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <label className="text-xs text-primary font-medium whitespace-nowrap">How many questions?</label>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={genCountValue}
                      onChange={e => setGenCountValue(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = Math.min(50, Math.max(5, parseInt(genCountValue) || 10));
                          handleGenerate(t.id, n);
                        } else if (e.key === 'Escape') {
                          setGenCountPromptId(null);
                        }
                      }}
                      className="w-16 px-2 py-1 text-xs rounded-md border border-emerald-300 focus:ring-2 focus:ring-emerald-400 focus:border-primary outline-none text-center"
                    />
                    <button
                      onClick={() => {
                        const n = Math.min(50, Math.max(5, parseInt(genCountValue) || 10));
                        handleGenerate(t.id, n);
                      }}
                      className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      Go
                    </button>
                    <button
                      onClick={() => setGenCountPromptId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 p-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                </>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Question Viewer */}
      {viewTopicId && !loadingQuestions && viewQuestions.length > 0 && (
        <QuestionViewer
          questions={viewQuestions}
          topicTitle={viewTopicTitle}
          onClose={() => { setViewTopicId(null); setViewQuestions([]); }}
        />
      )}
      {viewTopicId && loadingQuestions && (
        <div className="fixed inset-0 z-[200] bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading questions...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchDetailInline({ batch, sessions, onRefresh }: {
  batch: Batch;
  sessions: Session[];
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'students' | 'attendance' | 'sessions'>('sessions');
  const [perfStudent, setPerfStudent] = useState<{ email: string; name: string } | null>(null);

  // Credits per student
  type CreditPool = {
    id: string; source: string; subject: string;
    total_sessions: number; used_sessions: number; remaining: number;
    fee_per_session_paise: number; currency: string;
    is_active: boolean; expires_at: string | null; is_expired: boolean; invoice_id: string | null;
  };
  type StudentCredit = {
    student_email: string; student_name: string;
    pools: CreditPool[]; total_remaining: number; total_used: number; total_sessions: number;
    upcoming_sessions: number; covered_by_credits: number; uncovered_sessions: number;
    credit_status: 'healthy' | 'low' | 'critical' | 'none' | 'no_pool';
    has_overdue_invoice: boolean; overdue_invoice_count: number; pending_invoice_count: number;
  };
  type CreditSummary = {
    total_students: number; healthy: number; low: number; critical: number; none: number;
    no_pool: number; has_overdue: number; has_pending_invoice: number; needs_attention: number;
  };
  const [batchCredits, setBatchCredits] = useState<{ students: StudentCredit[]; summary: CreditSummary; upcoming_sessions: number } | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [expandedCreditStudent, setExpandedCreditStudent] = useState<string | null>(null);

  // Per-student invoice list (paid / pending / overdue) for this batch — works for ALL batch types
  type StudentInvoiceEntry = {
    id: string; invoice_number: string; description: string | null;
    billing_period: string; status: string; amount_paise: number; currency: string;
    period_start: string | null; period_end: string | null;
    due_date: string | null; paid_at: string | null; created_at: string;
    schedule_group_id: string | null; batch_session_id: string | null;
  };
  type StudentInvoices = {
    student_email: string; invoices: StudentInvoiceEntry[];
    paid_count: number; pending_count: number; overdue_count: number; cancelled_count: number;
    total_paid_paise: number; total_outstanding_paise: number;
  };
  const [batchInvoices, setBatchInvoices] = useState<StudentInvoices[] | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Credits only apply to per-class batches (1:1, 1:3). Group batches (1:15, 1:30, 1:m, etc.)
  // use enrollment-based payments and do NOT use the session-credit pool.
  const isPerClassBatch = batch.batch_type === 'one_to_one' || batch.batch_type === 'one_to_three';

  // Multi-select & edit for sessions
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [swapSession, setSwapSession] = useState<Session | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [batchViewMode, setBatchViewMode] = useState<'table' | 'calendar'>('table');
  const [showBatchReport, setShowBatchReport] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject); else next.add(subject);
      return next;
    });
  };

  // Fetch full batch detail (students + parents + teachers)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/v1/batches/${batch.batch_id}`);
        const data = await res.json();
        if (!cancelled && data.success) setDetail(data.data);
      } catch { /* ignore */ }
      if (!cancelled) setDetailLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [batch.batch_id]);

  // Fetch credits when students tab is shown (only for per-class batches)
  useEffect(() => {
    if (detailTab !== 'students') return;
    if (!isPerClassBatch) { setBatchCredits(null); return; }
    let cancelled = false;
    const load = async () => {
      setCreditsLoading(true);
      try {
        const res = await fetch(`/api/v1/batches/${batch.batch_id}/credits`);
        const data = await res.json();
        if (!cancelled && data.success) setBatchCredits(data.data);
      } catch { /* ignore */ }
      if (!cancelled) setCreditsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [batch.batch_id, detailTab, isPerClassBatch]);

  // Fetch per-student invoices (works for ALL batch types) when students tab is shown
  useEffect(() => {
    if (detailTab !== 'students') return;
    let cancelled = false;
    const load = async () => {
      setInvoicesLoading(true);
      try {
        const res = await fetch(`/api/v1/batches/${batch.batch_id}/student-invoices`);
        const data = await res.json();
        if (!cancelled && data.success) setBatchInvoices(data.data.students);
      } catch { /* ignore */ }
      if (!cancelled) setInvoicesLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [batch.batch_id, detailTab]);

  const sortedSessions = [...sessions].sort((a, b) => {
    const statusOrder: Record<string, number> = { live: 0, scheduled: 1, ended: 2, cancelled: 3 };
    const sa = statusOrder[a.status] ?? 4;
    const sb = statusOrder[b.status] ?? 4;
    if (sa !== sb) return sa - sb;
    return (b.scheduled_date + b.start_time).localeCompare(a.scheduled_date + a.start_time);
  });

  const students = detail?.students || [];
  const teachers = detail?.teachers || batch.teachers;

  // Theme palette: emerald primary, teal secondary
  const tc = { bg: 'bg-primary', light: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary', accent: 'from-primary to-secondary' };

  const scheduledCount = sessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length;
  const liveCount = sessions.filter(s => effectiveSessionStatus(s) === 'live').length;

  return (
    <div className="m-4 mb-6 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      {/* -- Colored header banner -- */}
      <div className={`bg-linear-to-r ${tc.accent} px-6 py-5 relative overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/5" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{batch.batch_name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/70 text-xs font-mono">{batch.batch_id}</span>
                <span className="bg-white/20 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  {BATCH_TYPE_LABELS[batch.batch_type] || batch.batch_type}
                </span>
                <span className="text-white/70 text-xs">Grade {batch.grade}{batch.section ? ` - ${batch.section}` : ''}</span>
              </div>
            </div>
          </div>

          {/* Quick stats pills */}
          <div className="flex items-center gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{batch.student_count}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Students</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{batch.teacher_count}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Teachers</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{sessions.length}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Sessions</p>
            </div>
            {liveCount > 0 && (
              <div className="bg-primary/30 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center ring-1 ring-green-300/40">
                <p className="text-lg font-bold text-white flex items-center gap-1"><Radio className="h-3.5 w-3.5 animate-pulse" />{liveCount}</p>
                <p className="text-[10px] text-green-100 uppercase tracking-wider">Live</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -- Detail Tabs -- */}
      <div className={`${tc.light} px-6 py-2.5 border-b ${tc.border} flex items-center gap-1`}>
        {([
          { key: 'sessions' as const, label: 'Sessions', icon: Calendar, count: sessions.length },
          { key: 'info' as const, label: 'Info & Teachers', icon: Users, count: teachers.length },
          { key: 'students' as const, label: 'Students & Parents', icon: GraduationCap, count: batch.student_count },
          { key: 'attendance' as const, label: 'Attendance', icon: UserCheck, count: detail?.attendance?.length ?? 0 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              detailTab === t.key
                ? `bg-white ${tc.text} shadow-sm ring-1 ${tc.border}`
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              detailTab === t.key ? `${tc.light} ${tc.text}` : 'bg-gray-100 text-gray-400'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* -- Tab Content -- */}
      <div className="px-6 py-5">

        {/* Info & Teachers Tab */}
        {detailTab === 'info' && (
          <div className="space-y-5">
            {/* Coordinator card */}
            <div className={`rounded-xl border ${tc.border} ${tc.light} p-4 flex items-center gap-4`}>
              <div className={`w-11 h-11 rounded-xl ${tc.bg} text-white flex items-center justify-center shrink-0`}>
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Batch Coordinator</p>
                <p className="text-sm font-bold text-gray-900">{batch.coordinator_name || 'Not assigned'}</p>
                {batch.coordinator_email && <p className="text-xs text-gray-500">{batch.coordinator_email}</p>}
              </div>
              {batch.notes && (
                <div className="border-l border-gray-200 pl-4 max-w-xs">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Notes</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{batch.notes}</p>
                </div>
              )}
            </div>

            {/* Teachers grid */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" /> Assigned Teachers
              </h4>
              {teachers.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {teachers.map(t => (
                    <div key={t.teacher_email + t.subject} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                      <Avatar name={t.teacher_name || 'T'} src={t.teacher_image} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.teacher_name || t.teacher_email}</p>
                        <p className="text-xs text-gray-400 truncate">{t.teacher_email}</p>
                      </div>
                      <span className={`shrink-0 rounded-lg ${tc.light} ${tc.text} px-2.5 py-1 text-[10px] font-bold border ${tc.border}`}>
                        {t.subject}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
                  <BookOpen className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                  <p className="text-sm text-gray-400">No teachers assigned yet</p>
                </div>
              )}
            </div>

            {/* Subjects */}
            {(batch.subjects || []).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Subjects</h4>
                <div className="flex flex-wrap gap-2">
                  {(batch.subjects || []).map(s => (
                    <span key={s} className={`rounded-lg ${tc.light} border ${tc.border} px-3 py-1.5 text-xs font-semibold ${tc.text}`}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Students & Parents Tab */}
        {detailTab === 'students' && (() => {
          const creditMap = new Map((batchCredits?.students || []).map(c => [c.student_email, c]));
          const invoiceMap = new Map((batchInvoices || []).map(s => [s.student_email, s]));
          const summary = batchCredits?.summary;
          const isLoading = detailLoading || creditsLoading;

          const creditStatusColor = (status: string) => {
            if (status === 'healthy') return { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary', border: 'border-primary/20' };
            if (status === 'low') return { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500', border: 'border-amber-200' };
            if (status === 'critical') return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', border: 'border-red-200' };
            if (status === 'none') return { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-300', border: 'border-red-200' };
            return { bg: 'bg-gray-100', text: 'text-gray-500', bar: 'bg-gray-300', border: 'border-gray-200' };
          };

          const creditStatusLabel = (status: string) => {
            if (status === 'healthy') return 'Healthy';
            if (status === 'low') return 'Low';
            if (status === 'critical') return 'Critical';
            if (status === 'none') return 'Exhausted';
            return 'No Pool';
          };

          return (
            <div className="space-y-4">
              {/* Credit Summary Banner */}
              {isPerClassBatch && summary && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Session Credit Overview</span>
                    {summary.needs_attention > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                        <AlertCircle className="h-3 w-3" /> {summary.needs_attention} need attention
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Healthy', val: summary.healthy, color: 'text-primary bg-primary/5 border-primary/20' },
                      { label: 'Low (≤5)', val: summary.low, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                      { label: 'Critical (≤2)', val: summary.critical, color: 'text-orange-600 bg-orange-50 border-orange-200' },
                      { label: 'Exhausted', val: summary.none, color: 'text-red-600 bg-red-50 border-red-200' },
                      { label: 'No Pool', val: summary.no_pool, color: 'text-gray-500 bg-gray-100 border-gray-200' },
                    ].map(item => (
                      <div key={item.label} className={`rounded-lg border ${item.color.split(' ').slice(1).join(' ')} p-2.5 text-center`}>
                        <p className={`text-lg font-bold ${item.color.split(' ')[0]}`}>{item.val}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {(summary.has_overdue > 0 || summary.has_pending_invoice > 0) && (
                    <div className="flex gap-3 mt-3">
                      {summary.has_overdue > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                          <AlertCircle className="h-3.5 w-3.5" /> {summary.has_overdue} student{summary.has_overdue > 1 ? 's' : ''} with overdue invoice
                        </div>
                      )}
                      {summary.has_pending_invoice > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                          <AlertCircle className="h-3.5 w-3.5" /> {summary.has_pending_invoice} student{summary.has_pending_invoice > 1 ? 's' : ''} with pending invoice
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="text-center py-10"><div className="inline-flex items-center gap-2 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Loading students...</div></div>
              ) : students.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <GraduationCap className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No students in this batch</p>
                  <p className="text-xs text-gray-400 mt-1">Students can be added from the batch settings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((s, idx) => {
                    const credit = creditMap.get(s.student_email);
                    const inv = invoiceMap.get(s.student_email);
                    const sc = creditStatusColor(credit?.credit_status || 'no_pool');
                    const isExpanded = expandedCreditStudent === s.student_email;
                    const totalRemaining = credit?.total_remaining ?? 0;
                    const totalSess = credit?.total_sessions ?? 0;
                    const usedPct = totalSess > 0 ? Math.round((credit?.total_used ?? 0) / totalSess * 100) : 0;
                    const overdueCount = inv?.overdue_count ?? 0;
                    const pendingCount = inv?.pending_count ?? 0;
                    const paidCount = inv?.paid_count ?? 0;
                    const hasOverdue = overdueCount > 0 || (credit?.has_overdue_invoice ?? false);
                    const canExpand = (isPerClassBatch && (credit?.pools.length ?? 0) > 0) || (inv && inv.invoices.length > 0);

                    return (
                      <div key={s.student_email} className={`rounded-xl border ${hasOverdue ? 'border-red-300' : 'border-gray-200'} bg-white shadow-sm overflow-hidden`}>
                        {/* Student Row */}
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <div className="text-[10px] font-bold text-gray-300 w-5 text-center shrink-0">{idx + 1}</div>
                          <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${tc.accent} text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm`}>
                            {(s.student_name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900">{s.student_name || 'Unknown'}</p>
                              {overdueCount > 0 && (
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-[9px] font-bold">
                                  <AlertCircle className="h-2.5 w-2.5" /> {overdueCount} OVERDUE
                                </span>
                              )}
                              {pendingCount > 0 && overdueCount === 0 && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-[9px] font-bold">
                                  {pendingCount} PENDING
                                </span>
                              )}
                              {paidCount > 0 && (
                                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[9px] font-bold">
                                  {paidCount} PAID
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-gray-400">{s.student_email}</p>
                              {s.student_region && <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{s.student_region}</span>}
                            </div>
                          </div>

                          {/* Credit Status Block */}
                          <div className="flex items-center gap-3 shrink-0">
                            {!isPerClassBatch ? null : credit ? (
                              <div className="flex items-center gap-3">
                                {/* Progress bar */}
                                <div className="w-24">
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className={`font-bold ${sc.text}`}>{totalRemaining} left</span>
                                    <span className="text-gray-400">{totalSess} total</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${sc.bar} transition-all`}
                                      style={{ width: `${Math.max(0, 100 - usedPct)}%` }}
                                    />
                                  </div>
                                  {credit.uncovered_sessions > 0 && (
                                    <p className="text-[10px] text-red-500 font-semibold mt-0.5">
                                      {credit.uncovered_sessions} upcoming uncovered
                                    </p>
                                  )}
                                </div>
                                <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                                  {creditStatusLabel(credit.credit_status)}
                                </span>
                              </div>
                            ) : creditsLoading ? (
                              <span className="text-xs text-gray-400">Loading…</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">No Pool</span>
                            )}
                            {/* Attendance badge */}
                            {s.total_classes != null && s.total_classes > 0 && (
                              <div className="text-right">
                                <p className={`text-xs font-bold ${Number(s.attendance_rate) >= 75 ? 'text-primary' : Number(s.attendance_rate) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{s.attendance_rate}%</p>
                                <p className="text-[10px] text-gray-400">attend</p>
                              </div>
                            )}
                            {/* Outstanding amount */}
                            {inv && inv.total_outstanding_paise > 0 && (
                              <div className="text-right">
                                <p className="text-xs font-bold text-red-600">₹{(inv.total_outstanding_paise / 100).toLocaleString('en-IN')}</p>
                                <p className="text-[10px] text-gray-400">due</p>
                              </div>
                            )}
                            {/* Expand toggle */}
                            {canExpand && (
                              <button
                                onClick={() => setExpandedCreditStudent(isExpanded ? null : s.student_email)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                title="Show credits & invoices"
                              >
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Credit Pool Detail */}
                        {isPerClassBatch && isExpanded && credit && credit.pools.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Credit Pools</p>
                            <div className="space-y-2">
                              {credit.pools.map(pool => {
                                const poolPct = pool.total_sessions > 0 ? Math.round(pool.used_sessions / pool.total_sessions * 100) : 0;
                                const sourceColor = pool.source === 'enrollment' ? 'text-primary bg-primary/5 border-primary/20' :
                                  pool.source === 'invoice_payment' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                  'text-purple-600 bg-purple-50 border-purple-200';
                                return (
                                  <div key={pool.id} className={`rounded-lg border px-3 py-2 ${pool.is_expired ? 'opacity-50 border-gray-200 bg-white' : 'border-gray-200 bg-white'}`}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sourceColor}`}>
                                        {pool.source === 'enrollment' ? 'ENROLLMENT' : pool.source === 'invoice_payment' ? 'PAID' : 'TOP-UP'}
                                      </span>
                                      <span className="text-xs font-semibold text-gray-700">{pool.subject}</span>
                                      {pool.is_expired && <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">EXPIRED</span>}
                                      <span className="ml-auto text-xs font-bold text-gray-700">{pool.remaining} / {pool.total_sessions} left</span>
                                    </div>
                                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full" style={{ width: `${100 - poolPct}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                      <span>{pool.used_sessions} used</span>
                                      {pool.expires_at && <span>Expires {new Date(pool.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                                      {pool.fee_per_session_paise > 0 && <span>₹{(pool.fee_per_session_paise / 100).toFixed(0)}/session</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {credit.uncovered_sessions > 0 && (
                              <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-semibold flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                {credit.uncovered_sessions} of {credit.upcoming_sessions} upcoming session{credit.upcoming_sessions > 1 ? 's' : ''} not covered by credits — invoice needed
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expanded Invoice List */}
                        {isExpanded && inv && inv.invoices.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Invoices</p>
                              <div className="flex items-center gap-2 text-[10px] font-semibold">
                                {paidCount > 0 && <span className="text-primary">{paidCount} paid</span>}
                                {pendingCount > 0 && <span className="text-amber-600">{pendingCount} pending</span>}
                                {overdueCount > 0 && <span className="text-red-600">{overdueCount} overdue</span>}
                                {inv.cancelled_count > 0 && <span className="text-gray-400">{inv.cancelled_count} cancelled</span>}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {inv.invoices.map(invoice => {
                                const statusColor =
                                  invoice.status === 'paid' ? 'text-primary bg-primary/5 border-primary/20' :
                                  invoice.status === 'overdue' ? 'text-red-700 bg-red-50 border-red-200' :
                                  invoice.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                  'text-gray-500 bg-gray-100 border-gray-200';
                                const dateLabel = invoice.status === 'paid' && invoice.paid_at
                                  ? `Paid ${new Date(invoice.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                  : invoice.due_date
                                    ? `Due ${new Date(invoice.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                    : '';
                                return (
                                  <div key={invoice.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center gap-2">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusColor} uppercase`}>
                                      {invoice.status}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{invoice.invoice_number}</p>
                                        <span className="text-[9px] text-gray-400 uppercase">{invoice.billing_period.replace('_', ' ')}</span>
                                      </div>
                                      {invoice.description && (
                                        <p className="text-[10px] text-gray-500 truncate">{invoice.description}</p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-xs font-bold text-gray-800">{invoice.currency === 'INR' ? '₹' : invoice.currency + ' '}{(invoice.amount_paise / 100).toLocaleString('en-IN')}</p>
                                      {dateLabel && <p className="text-[10px] text-gray-400">{dateLabel}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {(inv.total_paid_paise > 0 || inv.total_outstanding_paise > 0) && (
                              <div className="flex items-center justify-end gap-4 mt-2 pt-2 border-t border-gray-200 text-[11px] font-semibold">
                                {inv.total_paid_paise > 0 && (
                                  <span className="text-primary">Paid: ₹{(inv.total_paid_paise / 100).toLocaleString('en-IN')}</span>
                                )}
                                {inv.total_outstanding_paise > 0 && (
                                  <span className="text-red-600">Outstanding: ₹{(inv.total_outstanding_paise / 100).toLocaleString('en-IN')}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {isExpanded && (!inv || inv.invoices.length === 0) && !invoicesLoading && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-400 italic">
                            No invoices for this student in this batch yet.
                          </div>
                        )}

                        {/* Parent Row */}
                        <div className="border-t border-gray-100 bg-linear-to-r from-teal-50/80 to-emerald-50/40 px-5 py-2.5 flex items-center gap-3">
                          <div className="w-5 shrink-0" />
                          <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-teal-200">
                            {s.parent_name ? s.parent_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          {s.parent_email ? (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-gray-800">{s.parent_name || s.parent_email}</p>
                                <span className="rounded bg-teal-100 text-teal-600 px-1.5 py-0.5 text-[9px] font-bold">PARENT</span>
                              </div>
                              <div className="flex gap-3 text-[11px] text-gray-400 mt-0.5">
                                <span>✉ {s.parent_email}</span>
                                {s.parent_phone && <span>☎ {s.parent_phone}</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1">
                                <AlertCircle className="h-3.5 w-3.5" /> No parent linked
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ ATTENDANCE ═══ */}
        {detailTab === 'attendance' && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Per-Student Attendance Summary
            </h4>
            {detailLoading ? <LoadingState /> : !detail || !detail.attendance || detail.attendance.length === 0 ? (
              <EmptyState icon={UserCheck} message="No attendance data yet — will appear after sessions are completed" />
            ) : (
              <TableWrapper>
                <THead>
                  <TH>Student</TH>
                  <TH>Sessions</TH>
                  <TH>Present</TH>
                  <TH>Late</TH>
                  <TH>Absent</TH>
                  <TH>Left Early</TH>
                  <TH>Rate</TH>
                  <TH>Avg Attention</TH>
                  <TH></TH>
                </THead>
                <tbody>
                  {detail.attendance.map(a => {
                    const total = Number(a.total_sessions);
                    const present = Number(a.present);
                    const late = Number(a.late);
                    const absent = Number(a.absent);
                    const notJoined = Number(a.not_joined);
                    const leftEarly = Number(a.left_early);
                    const avgAtt = Number(a.avg_attention);
                    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
                    return (
                      <TRow key={a.student_email}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={a.student_name || 'S'} size="sm" />
                            <p className="text-sm font-medium text-gray-800">{a.student_name}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-700 font-medium">{total}</td>
                        <td className="px-3 py-2.5 text-sm text-primary font-semibold">{present}</td>
                        <td className="px-3 py-2.5 text-sm text-amber-600 font-semibold">{late}</td>
                        <td className="px-3 py-2.5 text-sm text-red-600 font-semibold">{absent + notJoined}</td>
                        <td className="px-3 py-2.5 text-sm text-orange-600 font-semibold">{leftEarly}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${rate >= 75 ? 'bg-primary' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${rate >= 75 ? 'text-primary' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {rate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {avgAtt > 0
                            ? <span className={`text-xs font-bold ${avgAtt >= 70 ? 'text-primary' : avgAtt >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{avgAtt}%</span>
                            : <span className="text-xs text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => setPerfStudent({ email: a.student_email, name: a.student_name })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-md transition-colors"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Performance
                          </button>
                        </td>
                      </TRow>
                    );
                  })}
                </tbody>
              </TableWrapper>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {detailTab === 'sessions' && (() => {
          const scheduledIds = sortedSessions.filter(s => effectiveSessionStatus(s) === 'scheduled').map(s => s.session_id);
          const selectedScheduledCount = [...selectedSessions].filter(id => scheduledIds.includes(id)).length;
          const deletableIds = new Set(sortedSessions.filter(s => effectiveSessionStatus(s) !== 'live').map(s => s.session_id));
          const selectedDeletableCount = [...selectedSessions].filter(id => deletableIds.has(id)).length;

          const toggleSessionSelect = (id: string) => {
            setSelectedSessions(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };

          const toggleAllSessions = () => {
            if (selectedSessions.size === sortedSessions.length) setSelectedSessions(new Set());
            else setSelectedSessions(new Set(sortedSessions.map(s => s.session_id)));
          };

          const handleBulkCancel = async () => {
            const ids = [...selectedSessions].filter(id => scheduledIds.includes(id));
            if (ids.length === 0) { toast.error('No scheduled sessions selected'); return; }
            const ok = await confirm({
              title: 'Cancel Selected Sessions',
              message: `Cancel ${ids.length} scheduled session${ids.length > 1 ? 's' : ''}? They will remain visible as "Cancelled".`,
              confirmLabel: `Cancel ${ids.length} Session${ids.length > 1 ? 's' : ''}`,
              variant: 'danger',
            });
            if (!ok) return;
            setBulkCancelling(true);
            try {
              const res = await fetch('/api/v1/batch-sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_ids: ids, reason: 'Bulk cancelled by operator' }),
              });
              const data = await res.json();
              if (data.success) { toast.success(data.message || `${data.data?.cancelled} sessions cancelled`); setSelectedSessions(new Set()); onRefresh(); }
              else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
            finally { setBulkCancelling(false); }
          };

          const handleBulkDelete = async () => {
            const ids = [...selectedSessions].filter(id => deletableIds.has(id));
            if (ids.length === 0) { toast.error('No sessions selected to delete (live sessions cannot be deleted)'); return; }
            const ok = await confirm({
              title: 'Permanently Delete Sessions',
              message: `Permanently delete ${ids.length} session${ids.length > 1 ? 's' : ''}? This action cannot be undone. Live sessions will be skipped.`,
              confirmLabel: `Delete ${ids.length} Session${ids.length > 1 ? 's' : ''}`,
              variant: 'danger',
            });
            if (!ok) return;
            setBulkDeleting(true);
            try {
              const res = await fetch('/api/v1/batch-sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_ids: ids, permanent: true }),
              });
              const data = await res.json();
              if (data.success) { toast.success(data.message || `${data.data?.deleted} sessions deleted`); setSelectedSessions(new Set()); onRefresh(); }
              else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
            finally { setBulkDeleting(false); }
          };

          const handleSingleCancel = async (s: Session) => {
            const ok = await confirm({
              title: 'Cancel Session',
              message: `Cancel ${s.subject} on ${fmtDate(s.scheduled_date)} at ${fmtTime12(s.start_time)}? It will remain visible as "Cancelled".`,
              confirmLabel: 'Cancel Session',
              variant: 'danger',
            });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) { toast.success('Session cancelled'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          const handleSingleDelete = async (s: Session) => {
            const ok = await confirm({
              title: 'Permanently Delete Session',
              message: `Permanently delete ${s.subject} on ${fmtDate(s.scheduled_date)} at ${fmtTime12(s.start_time)}? This action cannot be undone.`,
              confirmLabel: 'Delete Permanently',
              variant: 'danger',
            });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}?permanent=true`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) { toast.success('Session permanently deleted'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          const handleSingleStart = async (s: Session) => {
            const ok = await confirm({ title: 'Start Session', message: `Start ${s.subject} now?`, confirmLabel: 'Start', variant: 'info' });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}/start`, { method: 'POST' });
              const data = await res.json();
              if (data.success) { toast.success('Session started!'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          const handleSingleEnd = async (s: Session) => {
            const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End', variant: 'warning' });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
              });
              const data = await res.json();
              if (data.success) { toast.success('Session ended'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          // Recording controls

          const handleStartRecording = async (s: Session) => {
            if (!s.livekit_room_name) { toast.error('No room linked'); return; }
            setRecordingLoading(s.session_id);
            try {
              const res = await fetch(`/api/v1/room/${s.livekit_room_name}/recording`, { method: 'POST' });
              const data = await res.json();
              if (data.success) { toast.success('Recording started'); onRefresh(); }
              else toast.error(data.error || 'Failed to start recording');
            } catch { toast.error('Network error'); }
            finally { setRecordingLoading(null); }
          };

          const handleStopRecording = async (s: Session) => {
            if (!s.livekit_room_name) return;
            const ok = await confirm({ title: 'Stop Recording', message: 'Stop the live recording? The video will be saved to YouTube.', confirmLabel: 'Stop Recording', variant: 'warning' });
            if (!ok) return;
            setRecordingLoading(s.session_id);
            try {
              const res = await fetch(`/api/v1/room/${s.livekit_room_name}/recording`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) { toast.success('Recording stopped'); onRefresh(); }
              else toast.error(data.error || 'Failed to stop recording');
            } catch { toast.error('Network error'); }
            finally { setRecordingLoading(null); }
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" /> Sessions
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {scheduledCount > 0 && <span className="text-teal-600 font-medium">{scheduledCount} upcoming</span>}
                    {scheduledCount > 0 && liveCount > 0 && <span> · </span>}
                    {liveCount > 0 && <span className="text-primary font-medium">{liveCount} live</span>}
                    {scheduledCount === 0 && liveCount === 0 && 'No active sessions'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSessions.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">{selectedSessions.size} selected</span>
                      {selectedScheduledCount > 0 && (
                        <Button icon={XCircle} size="xs" variant="outline" onClick={handleBulkCancel} loading={bulkCancelling}>
                          Cancel {selectedScheduledCount}
                        </Button>
                      )}
                      {selectedDeletableCount > 0 && (
                        <Button icon={Trash2} size="xs" variant="danger" onClick={handleBulkDelete} loading={bulkDeleting}>
                          Delete {selectedDeletableCount}
                        </Button>
                      )}
                      <button onClick={() => setSelectedSessions(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    </div>
                  )}
                  {/* View toggle */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <button onClick={() => setBatchViewMode('table')} className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${batchViewMode === 'table' ? 'bg-primary/5 text-primary border-r border-gray-200' : 'text-gray-500 hover:bg-gray-50 border-r border-gray-200'}`}>
                      <Table2 className="h-3 w-3" />
                      Table
                    </button>
                    <button onClick={() => setBatchViewMode('calendar')} className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${batchViewMode === 'calendar' ? 'bg-primary/5 text-primary' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <Calendar className="h-3 w-3" />
                      Calendar
                    </button>
                  </div>
                  {sortedSessions.some(s => s.status === 'ended') && (
                    <Button icon={BarChart3} onClick={() => setShowBatchReport(true)} size="sm" variant="outline">
                      Report
                    </Button>
                  )}
                </div>
              </div>

              {/* Session Highlight (live / today / next / latest) */}
              {(() => {
                if (sortedSessions.length === 0) return null;
                const liveSession = sortedSessions.find(s => effectiveSessionStatus(s) === 'live');
                const todaysScheduled = sortedSessions
                  .filter(s => isToday(s.scheduled_date) && effectiveSessionStatus(s) === 'scheduled')
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
                const todaysAny = sortedSessions
                  .filter(s => isToday(s.scheduled_date))
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
                const todayIso = todayISO();
                const nextUpcoming = sortedSessions
                  .filter(s => effectiveSessionStatus(s) === 'scheduled' && s.scheduled_date.slice(0, 10) >= todayIso)
                  .sort((a, b) => (a.scheduled_date + a.start_time).localeCompare(b.scheduled_date + b.start_time))[0];
                const lastEnded = [...sortedSessions]
                  .filter(s => effectiveSessionStatus(s) === 'ended')
                  .sort((a, b) => (b.scheduled_date + b.start_time).localeCompare(a.scheduled_date + a.start_time))[0];

                let highlight: Session | undefined;
                let label: string;
                let theme: { ring: string; bg: string; chipBg: string; chipText: string; pill: string; iconColor: string };
                if (liveSession) {
                  highlight = liveSession;
                  label = 'LIVE NOW';
                  theme = { ring: 'border-green-300 ring-2 ring-green-200', bg: 'bg-gradient-to-r from-primary/5 to-primary/5', chipBg: 'bg-primary', chipText: 'text-white', pill: 'bg-white/80 text-primary border-primary/20', iconColor: 'text-primary' };
                } else if (todaysScheduled) {
                  highlight = todaysScheduled;
                  label = "TODAY'S NEXT SESSION";
                  theme = { ring: 'border-blue-300', bg: 'bg-gradient-to-r from-blue-50 to-sky-50', chipBg: 'bg-blue-600', chipText: 'text-white', pill: 'bg-white/80 text-blue-700 border-blue-200', iconColor: 'text-blue-600' };
                } else if (todaysAny) {
                  highlight = todaysAny;
                  label = effectiveSessionStatus(todaysAny) === 'ended' ? "TODAY (COMPLETED)" : "TODAY";
                  theme = { ring: 'border-amber-300', bg: 'bg-gradient-to-r from-amber-50 to-yellow-50', chipBg: 'bg-amber-600', chipText: 'text-white', pill: 'bg-white/80 text-amber-700 border-amber-200', iconColor: 'text-amber-600' };
                } else if (nextUpcoming) {
                  highlight = nextUpcoming;
                  label = 'NEXT UPCOMING SESSION';
                  theme = { ring: 'border-teal-300', bg: 'bg-gradient-to-r from-teal-50 to-cyan-50', chipBg: 'bg-secondary', chipText: 'text-white', pill: 'bg-white/80 text-teal-700 border-teal-200', iconColor: 'text-teal-600' };
                } else if (lastEnded) {
                  highlight = lastEnded;
                  label = 'LATEST SESSION';
                  theme = { ring: 'border-gray-300', bg: 'bg-gradient-to-r from-gray-50 to-slate-50', chipBg: 'bg-gray-600', chipText: 'text-white', pill: 'bg-white/80 text-gray-700 border-gray-200', iconColor: 'text-gray-600' };
                } else {
                  return null;
                }
                const es = effectiveSessionStatus(highlight);
                return (
                  <div className={`rounded-2xl border ${theme.ring} ${theme.bg} px-4 py-3 mb-4 shadow-sm`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-flex items-center gap-1.5 ${theme.chipBg} ${theme.chipText} text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0`}>
                          {label === 'LIVE NOW' && <Radio className="h-3 w-3 animate-pulse" />}
                          {label}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 truncate">{highlight.subject}</span>
                            {highlight.topic && <span className="text-xs text-gray-500 truncate">— {highlight.topic}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-600 flex-wrap">
                            <span className="inline-flex items-center gap-1"><Calendar className={`h-3 w-3 ${theme.iconColor}`} />{fmtDate(highlight.scheduled_date)}</span>
                            <span className="inline-flex items-center gap-1"><Clock className={`h-3 w-3 ${theme.iconColor}`} />{fmtTime12(highlight.start_time)} · {highlight.duration_minutes}m</span>
                            {highlight.teacher_name && (
                              <span className="inline-flex items-center gap-1"><Users className={`h-3 w-3 ${theme.iconColor}`} />{highlight.teacher_name}</span>
                            )}
                            {(highlight.student_count ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1"><GraduationCap className={`h-3 w-3 ${theme.iconColor}`} />{highlight.student_count} student{(highlight.student_count ?? 0) !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${theme.pill}`}>
                          {es}
                        </span>
                        {es === 'live' && highlight.livekit_room_name && (
                          <Button
                            size="xs"
                            variant="primary"
                            icon={Eye}
                            onClick={() => window.open(`/coordinator/observe/${highlight!.livekit_room_name}`, '_blank')}
                          >
                            Observe
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {sortedSessions.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="h-7 w-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No sessions scheduled yet</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Schedule the first session for this batch</p>
                </div>
              ) : batchViewMode === 'calendar' ? (
                <SessionCalendar sessions={sortedSessions} onRefresh={onRefresh} onEditSession={setEditSession} />
              ) : (
                <div className="space-y-4">
                  {groupSessionsBySubject(sortedSessions).map(group => {
                    const groupIds = group.sessions.map(s => s.session_id);
                    const allGroupSelected = groupIds.every(id => selectedSessions.has(id));
                    const someGroupSelected = groupIds.some(id => selectedSessions.has(id));
                    const scheduledInGroup = group.sessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length;

                    const toggleGroupSelect = () => {
                      setSelectedSessions(prev => {
                        const next = new Set(prev);
                        if (allGroupSelected) groupIds.forEach(id => next.delete(id));
                        else groupIds.forEach(id => next.add(id));
                        return next;
                      });
                    };

                    return (
                      <div key={group.subject} className={`rounded-xl border ${group.color.border} overflow-hidden`}>
                        {/* Subject Group Header */}
                        <div className={`${group.color.bg} px-4 py-2.5 flex items-center justify-between cursor-pointer select-none`} onClick={() => toggleSubjectExpand(group.subject)}>
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={allGroupSelected} ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                              onChange={(e) => { e.stopPropagation(); toggleGroupSelect(); }} className="rounded border-gray-300 text-primary focus:ring-primary" />
                            {expandedSubjects.has(group.subject) ? <ChevronDown className={`h-4 w-4 ${group.color.text}`} /> : <ChevronRight className={`h-4 w-4 ${group.color.text}`} />}
                            <div className={`w-2 h-2 rounded-full ${group.color.dot}`} />
                            <span className={`text-sm font-bold ${group.color.text}`}>{group.subject}</span>
                            <span className="text-xs text-gray-400 font-medium">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {scheduledInGroup > 0 && <span className="text-teal-600 font-medium">{scheduledInGroup} upcoming</span>}
                            {group.sessions.some(s => effectiveSessionStatus(s) === 'live') && <span className="text-primary font-medium flex items-center gap-1"><Radio className="h-3 w-3 animate-pulse" />Live</span>}
                          </div>
                        </div>
                        {/* Table — collapsed by default */}
                        {expandedSubjects.has(group.subject) && (
                        <TableWrapper footer={<span>{group.sessions.length} {group.subject} session{group.sessions.length !== 1 ? 's' : ''}</span>}>
                          <THead>
                            <TH><span className="sr-only">Select</span></TH>
                            <TH>Date</TH>
                            <TH>Time</TH>
                            <TH>Duration</TH>
                            <TH>Teacher</TH>
                            <TH>Status</TH>
                            <TH>Recording</TH>
                            <TH>Actions</TH>
                          </THead>
                          <tbody>
                            {group.sessions.map(s => {
                              const es = effectiveSessionStatus(s);
                              const isSel = selectedSessions.has(s.session_id);
                              const isSessionToday = isToday(s.scheduled_date);
                              return (
                                <TRow key={s.session_id} selected={isSel}>
                                  <td className="px-3 py-3 w-8">
                                    <input type="checkbox" checked={isSel} onChange={() => toggleSessionSelect(s.session_id)}
                                      className="rounded border-gray-300 text-primary focus:ring-primary" />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-gray-700">{fmtDate(s.scheduled_date)}</div>
                                    {isSessionToday && es === 'scheduled' && (
                                      <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">TODAY</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{fmtTime12(s.start_time)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {s.duration_minutes}m
                                    <span className="text-xs text-gray-400 ml-1">({s.teaching_minutes}+{s.prep_buffer_minutes})</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {s.teacher_name ? (
                                      <div className="flex items-center gap-2">
                                        <Avatar name={s.teacher_name} src={s.teacher_image} size="sm" />
                                        <span className="text-sm text-gray-700">{s.teacher_name}</span>
                                      </div>
                                    ) : <span className="text-xs text-gray-400">—</span>}
                                  </td>
                                  <td className="px-4 py-3"><StatusBadge status={es} /></td>
                                  <td className="px-4 py-3">
                                    {es === 'live' && (
                                      <div className="flex items-center gap-1">
                                        {s.recording_status === 'recording' ? (
                                          <>
                                            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                                              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
                                              REC
                                            </span>
                                            <button onClick={() => handleStopRecording(s)} disabled={recordingLoading === s.session_id}
                                              title="Stop Recording" className="ml-1 p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                                              <StopCircle className="h-3.5 w-3.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <button onClick={() => handleStartRecording(s)} disabled={recordingLoading === s.session_id}
                                            title="Start Recording" className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                            <Video className="h-3.5 w-3.5" />
                                            <span>Record</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {es === 'ended' && s.recording_status === 'completed' && s.recording_url && (
                                      <a href={s.recording_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                                        <Video className="h-3.5 w-3.5" />
                                        <span>Watch</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                    {(es !== 'live' && !(es === 'ended' && s.recording_status === 'completed' && s.recording_url)) && (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <SessionActionsDropdown
                                      session={s}
                                      onEdit={() => setEditSession(s)}
                                      onSwap={() => setSwapSession(s)}
                                      onCancel={() => handleSingleCancel(s)}
                                      onDelete={() => handleSingleDelete(s)}
                                      onEnd={() => handleSingleEnd(s)}
                                      onObserve={() => window.open('/academic-operator/live', '_blank')}
                                    />
                                  </td>
                                </TRow>
                              );
                            })}
                          </tbody>
                        </TableWrapper>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-center text-xs text-gray-400 py-1">
                    {sortedSessions.length} total session{sortedSessions.length !== 1 ? 's' : ''} across {groupSessionsBySubject(sortedSessions).length} subject{groupSessionsBySubject(sortedSessions).length !== 1 ? 's' : ''}
                    {selectedSessions.size > 0 && ` · ${selectedSessions.size} selected`}
                  </div>
                </div>
              )}

              {/* Edit Session Modal */}
              {editSession && (
                <EditSessionModal
                  session={editSession}
                  batch={batch}
                  onClose={() => setEditSession(null)}
                  onSaved={() => { setEditSession(null); onRefresh(); }}
                />
              )}

              {/* Swap Session Modal */}
              {swapSession && (
                <SwapSessionModal
                  session={swapSession}
                  candidates={sessions.filter(x =>
                    x.batch_id === swapSession.batch_id &&
                    x.session_id !== swapSession.session_id &&
                    x.status === 'scheduled'
                  )}
                  onClose={() => setSwapSession(null)}
                  onSaved={() => { setSwapSession(null); onRefresh(); }}
                />
              )}
            </div>
          );
        })()}
      </div>

      {/* Student Performance Modal */}
      {perfStudent && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={perfStudent.name} size="md" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{perfStudent.name}&apos;s Performance</h3>
                <p className="text-xs text-gray-400">{perfStudent.email}</p>
              </div>
            </div>
            <button onClick={() => setPerfStudent(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 text-xs font-medium" title="Close">
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50/50">
            <StudentReportsTab studentEmail={perfStudent.email} batchId={batch.batch_id} showStudentHeader={false} />
          </div>
        </div>
      )}

      {/* Batch Report Modal */}
      {showBatchReport && (
        <BatchReportModal
          batchId={batch.batch_id}
          sessions={sortedSessions}
          onClose={() => setShowBatchReport(false)}
        />
      )}
    </div>
  );
}

// --- Session Card -------------------------------------------
function SessionCard({ session, batch, onRefresh }: {
  session: Session;
  batch: Batch;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinLinks, setJoinLinks] = useState<JoinLink[] | null>(null);
  const [ending, setEnding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const isSessionToday = isToday(session.scheduled_date);

  const handleStart = async () => {
    const ok = await confirm({
      title: 'Start Session',
      message: `Start the ${session.subject} session now? This will create the LiveKit room and generate join links for all participants.`,
      confirmLabel: 'Start Session',
      variant: 'info',
    });
    if (!ok) return;

    setStarting(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setJoinLinks(data.data?.participants || []);
        toast.success('Session started — join links generated!');
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to start session');
      }
    } catch { toast.error('Network error'); }
    finally { setStarting(false); }
  };

  const handleEnd = async () => {
    const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End Session', variant: 'warning' });
    if (!ok) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Session ended'); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setEnding(false); }
  };

  const handleCancel = async () => {
    const ok = await confirm({ title: 'Cancel Session', message: 'Cancel this scheduled session? This cannot be undone.', confirmLabel: 'Cancel Session', variant: 'danger' });
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session cancelled'); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setCancelling(false); }
  };

  const handleViewLinks = async () => {
    if (joinLinks) { setExpanded(!expanded); return; }
    setStarting(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { setJoinLinks(data.data?.participants || []); setExpanded(true); }
      else toast.error(data.error || 'Failed to get links');
    } catch { toast.error('Network error'); }
    finally { setStarting(false); }
  };

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); toast.success('Link copied!'); };

  const es = effectiveSessionStatus(session);
  const statusColor: Record<string, string> = { scheduled: 'border-teal-200 bg-teal-50/50', live: 'border-green-300 bg-primary/5/50', ended: 'border-gray-200 bg-gray-50/50', cancelled: 'border-red-200 bg-red-50/50' };
  const statusIcon: Record<string, React.ReactNode> = { scheduled: <Clock className="h-5 w-5 text-teal-600" />, live: <Radio className="h-5 w-5 text-primary animate-pulse" />, ended: <CheckCircle2 className="h-5 w-5 text-gray-400" />, cancelled: <XCircle className="h-5 w-5 text-red-400" /> };

  return (
    <div className={`rounded-xl border ${statusColor[es] || 'border-gray-200'} overflow-hidden`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-100">
          {statusIcon[es]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{session.subject}</span>
            <StatusBadge status={es} />
            {isSessionToday && es === 'scheduled' && (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">TODAY</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(session.scheduled_date)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(session.start_time)}</span>
            <span>{session.duration_minutes}m ({session.teaching_minutes}m + {session.prep_buffer_minutes}m prep)</span>
            {session.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.teacher_name}</span>}
          </div>
          {session.topic && <p className="text-xs text-gray-400 mt-0.5">Topic: {session.topic}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {es === 'live' && (
            <Button icon={Link2} onClick={handleViewLinks} loading={starting} size="xs" variant="outline">Links</Button>
          )}
          <SessionActionsDropdown
            session={session}
            onCancel={handleCancel}
            onEnd={handleEnd}
            onObserve={() => window.open('/academic-operator/live', '_blank')}
          />
        </div>
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 bg-white p-4 space-y-3">
          {joinLinks && joinLinks.length > 0 ? (
            <>
              <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-primary" /> Join Links ({joinLinks.length} participants)
              </h5>
              <div className="space-y-2 max-h-75 overflow-auto">
                {joinLinks.map(link => (
                  <div key={link.email} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
                    <Avatar name={link.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{link.name}</span>
                        <Badge label={link.role} variant={
                          link.role === 'teacher' ? 'info' : link.role === 'student' ? 'primary' : link.role === 'parent' ? 'success' : 'default'
                        } />
                      </div>
                      <p className="text-xs text-gray-400 truncate">{link.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => copyLink(link.join_url)} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" title="Copy join link">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a href={link.join_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" title="Open join link">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : es === 'scheduled' ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">Start the session to generate join links for all participants</p>
              <p className="text-xs text-gray-300 mt-1">
                Links will be auto-generated for: teacher, {batch.student_count} student{batch.student_count !== 1 ? 's' : ''},
                parents, coordinator{batch.coordinator_name ? ` (${batch.coordinator_name})` : ''}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">{es === 'ended' ? 'Session has ended' : 'Session was cancelled'}</p>
              {session.cancel_reason && <p className="text-xs text-gray-300 mt-1">Reason: {session.cancel_reason}</p>}
            </div>
          )}
          {session.notes && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{session.notes}</p>
            </div>
          )}
          {session.livekit_room_name && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1">LiveKit Room</p>
              <p className="text-sm font-mono text-gray-600">{session.livekit_room_name}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sessions Tab (All Sessions) ----------------------------
export function SessionsTab({ sessions, batches, loading, onRefresh, userRole }: {
  sessions: Session[];
  batches: Batch[];
  loading: boolean;
  onRefresh: () => void;
  userRole?: string;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleBatch, setScheduleBatch] = useState<Batch | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [swapSession, setSwapSession] = useState<Session | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  // Session Report
  const [reportRoomId, setReportRoomId] = useState<string | null>(null);
  // Recording controls (must be before early return)
  const [recordingLoading, setRecordingLoading] = useState<string | null>(null);

  const toast = useToast();
  const { confirm } = useConfirm();

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject); else next.add(subject);
      return next;
    });
  };

  if (loading) return <LoadingState />;

  let filtered = sessions
    .filter(s => statusFilter === 'all' || effectiveSessionStatus(s) === statusFilter)
    .filter(s => !search ||
      s.subject.toLowerCase().includes(search.toLowerCase()) ||
      (s.teacher_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.batch_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.topic || '').toLowerCase().includes(search.toLowerCase())
    );

  if (dateFilter === 'today') filtered = filtered.filter(s => isToday(s.scheduled_date));
  else if (dateFilter === 'upcoming') filtered = filtered.filter(s => s.scheduled_date >= todayISO() && effectiveSessionStatus(s) === 'scheduled');
  else if (dateFilter === 'past') filtered = filtered.filter(s => s.scheduled_date < todayISO() || effectiveSessionStatus(s) === 'ended');

  filtered.sort((a, b) => {
    const aEs = effectiveSessionStatus(a);
    const bEs = effectiveSessionStatus(b);
    if (aEs === 'live' && bEs !== 'live') return -1;
    if (bEs === 'live' && aEs !== 'live') return 1;
    const dateComp = b.scheduled_date.localeCompare(a.scheduled_date);
    if (dateComp !== 0) return dateComp;
    return b.start_time.localeCompare(a.start_time);
  });

  const activeBatches = batches.filter(b => b.status === 'active');

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.session_id)));
    }
  };

  const selectableIds = new Set(filtered.filter(s => effectiveSessionStatus(s) === 'scheduled').map(s => s.session_id));
  const selectedScheduled = [...selected].filter(id => selectableIds.has(id));
  const deletableIds = new Set(filtered.filter(s => effectiveSessionStatus(s) !== 'live').map(s => s.session_id));
  const selectedDeletable = [...selected].filter(id => deletableIds.has(id));

  // Bulk cancel (soft — marks as cancelled)
  const handleBulkCancel = async () => {
    if (selectedScheduled.length === 0) {
      toast.error('No scheduled sessions selected to cancel');
      return;
    }
    const ok = await confirm({
      title: 'Cancel Selected Sessions',
      message: `Cancel ${selectedScheduled.length} scheduled session${selectedScheduled.length > 1 ? 's' : ''}? They will remain visible as "Cancelled".`,
      confirmLabel: `Cancel ${selectedScheduled.length} Session${selectedScheduled.length > 1 ? 's' : ''}`,
      variant: 'danger',
    });
    if (!ok) return;

    setBulkCancelling(true);
    try {
      const res = await fetch('/api/v1/batch-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_ids: selectedScheduled, reason: 'Bulk cancelled by operator' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.data?.cancelled} sessions cancelled`);
        setSelected(new Set());
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to cancel sessions');
      }
    } catch { toast.error('Network error'); }
    finally { setBulkCancelling(false); }
  };

  // Bulk permanent delete (removes from DB)
  const handleBulkDelete = async () => {
    if (selectedDeletable.length === 0) {
      toast.error('No sessions selected to delete (live sessions cannot be deleted)');
      return;
    }
    const ok = await confirm({
      title: 'Permanently Delete Sessions',
      message: `Permanently delete ${selectedDeletable.length} session${selectedDeletable.length > 1 ? 's' : ''}? This action cannot be undone. Live sessions will be skipped.`,
      confirmLabel: `Delete ${selectedDeletable.length} Session${selectedDeletable.length > 1 ? 's' : ''}`,
      variant: 'danger',
    });
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/v1/batch-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_ids: selectedDeletable, permanent: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.data?.deleted} sessions deleted`);
        setSelected(new Set());
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to delete sessions');
      }
    } catch { toast.error('Network error'); }
    finally { setBulkDeleting(false); }
  };

  // Individual cancel
  const handleCancel = async (session: Session) => {
    const ok = await confirm({
      title: 'Cancel Session',
      message: `Cancel the ${session.subject} session on ${fmtDate(session.scheduled_date)} at ${fmtTime12(session.start_time)}? It will remain visible as "Cancelled".`,
      confirmLabel: 'Cancel Session',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session cancelled'); onRefresh(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  // Individual permanent delete
  const handleDelete = async (session: Session) => {
    const ok = await confirm({
      title: 'Permanently Delete Session',
      message: `Permanently delete the ${session.subject} session on ${fmtDate(session.scheduled_date)} at ${fmtTime12(session.start_time)}? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}?permanent=true`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session permanently deleted'); onRefresh(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  // Individual start
  const handleStart = async (session: Session) => {
    const ok = await confirm({
      title: 'Start Session',
      message: `Start the ${session.subject} session now?`,
      confirmLabel: 'Start Session',
      variant: 'info',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast.success('Session started!'); onRefresh(); }
      else toast.error(data.error || 'Failed to start');
    } catch { toast.error('Network error'); }
  };

  // Individual end
  const handleEnd = async (session: Session) => {
    const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End Session', variant: 'warning' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Session ended'); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  // ── Recording controls ──────────────────────────────────

  const handleStartRecording = async (session: Session) => {
    if (!session.livekit_room_name) { toast.error('No room linked to this session'); return; }
    setRecordingLoading(session.session_id);
    try {
      const res = await fetch(`/api/v1/room/${session.livekit_room_name}/recording`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast.success('Recording started'); onRefresh(); }
      else toast.error(data.error || 'Failed to start recording');
    } catch { toast.error('Network error'); }
    finally { setRecordingLoading(null); }
  };

  const handleStopRecording = async (session: Session) => {
    if (!session.livekit_room_name) return;
    const ok = await confirm({ title: 'Stop Recording', message: 'Stop the live recording? The video will be saved to YouTube.', confirmLabel: 'Stop Recording', variant: 'warning' });
    if (!ok) return;
    setRecordingLoading(session.session_id);
    try {
      const res = await fetch(`/api/v1/room/${session.livekit_room_name}/recording`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Recording stopped'); onRefresh(); }
      else toast.error(data.error || 'Failed to stop recording');
    } catch { toast.error('Network error'); }
    finally { setRecordingLoading(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search sessions..." />
          <FilterSelect value={statusFilter} onChange={setStatusFilter}
            options={[{ value: 'all', label: 'All Status' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'live', label: 'Live' }, { value: 'ended', label: 'Ended' }, { value: 'cancelled', label: 'Cancelled' }]}
          />
          <FilterSelect value={dateFilter} onChange={setDateFilter}
            options={[{ value: 'all', label: 'All Dates' }, { value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary/5 text-primary border-r border-gray-200' : 'text-gray-500 hover:bg-gray-50 border-r border-gray-200'}`}>
              <Table2 className="h-3.5 w-3.5" />
              Table
            </button>
            <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'calendar' ? 'bg-primary/5 text-primary' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </button>
          </div>
          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-medium text-gray-500">{selected.size} selected</span>
              {selectedScheduled.length > 0 && (
                <Button icon={XCircle} size="xs" variant="outline" onClick={handleBulkCancel} loading={bulkCancelling}>
                  Cancel {selectedScheduled.length}
                </Button>
              )}
              {selectedDeletable.length > 0 && (
                <Button icon={Trash2} size="xs" variant="danger" onClick={handleBulkDelete} loading={bulkDeleting}>
                  Delete {selectedDeletable.length}
                </Button>
              )}
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear</button>
            </div>
          )}
          {activeBatches.length > 0 && (
            <Button icon={PlusCircle} onClick={() => setShowSchedule(true)} size="sm">
              Schedule Session
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <SessionCalendar sessions={filtered} onRefresh={onRefresh} onEditSession={setEditSession} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Calendar} message="No sessions found" />
      ) : (
        <div className="space-y-4">
          {groupSessionsBySubject(filtered).map(group => {
            const groupIds = group.sessions.map(s => s.session_id);
            const allGroupSelected = groupIds.every(id => selected.has(id));
            const someGroupSelected = groupIds.some(id => selected.has(id));
            const scheduledInGroup = group.sessions.filter(s => effectiveSessionStatus(s) === 'scheduled').length;

            const toggleGroupSelect = () => {
              setSelected(prev => {
                const next = new Set(prev);
                if (allGroupSelected) groupIds.forEach(id => next.delete(id));
                else groupIds.forEach(id => next.add(id));
                return next;
              });
            };

            return (
              <div key={group.subject} className={`rounded-xl border ${group.color.border} overflow-hidden`}>
                {/* Subject Group Header */}
                <div className={`${group.color.bg} px-4 py-2.5 flex items-center justify-between cursor-pointer select-none`} onClick={() => toggleSubjectExpand(group.subject)}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={allGroupSelected} ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                      onChange={(e) => { e.stopPropagation(); toggleGroupSelect(); }} className="rounded border-gray-300 text-primary focus:ring-primary" />
                    {expandedSubjects.has(group.subject) ? <ChevronDown className={`h-4 w-4 ${group.color.text}`} /> : <ChevronRight className={`h-4 w-4 ${group.color.text}`} />}
                    <div className={`w-2 h-2 rounded-full ${group.color.dot}`} />
                    <span className={`text-sm font-bold ${group.color.text}`}>{group.subject}</span>
                    <span className="text-xs text-gray-400 font-medium">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {scheduledInGroup > 0 && <span className="text-teal-600 font-medium">{scheduledInGroup} upcoming</span>}
                    {group.sessions.some(s => effectiveSessionStatus(s) === 'live') && <span className="text-primary font-medium flex items-center gap-1"><Radio className="h-3 w-3 animate-pulse" />Live</span>}
                  </div>
                </div>
                {/* Table — collapsed by default */}
                {expandedSubjects.has(group.subject) && (
                <TableWrapper footer={<span>{group.sessions.length} {group.subject} session{group.sessions.length !== 1 ? 's' : ''}</span>}>
                  <THead>
                    <TH><span className="sr-only">Select</span></TH>
                    <TH>Batch</TH>
                    <TH>Date</TH>
                    <TH>Time</TH>
                    <TH>Duration</TH>
                    <TH>Teacher</TH>
                    <TH>Status</TH>
                    <TH>Recording</TH>
                    <TH>Actions</TH>
                  </THead>
                  <tbody>
                    {group.sessions.map(s => {
                      const es = effectiveSessionStatus(s);
                      const isSelected = selected.has(s.session_id);
                      const isSessionToday = isToday(s.scheduled_date);
                      return (
                        <TRow key={s.session_id} selected={isSelected}>
                          <td className="px-3 py-3 w-8">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.session_id)}
                              className="rounded border-gray-300 text-primary focus:ring-primary" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700">{s.batch_name || s.batch_id}</div>
                            {s.grade && <div className="text-xs text-gray-400">{s.grade}{s.section ? ` - ${s.section}` : ''}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700">{fmtDate(s.scheduled_date)}</div>
                            {isSessionToday && es === 'scheduled' && (
                              <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">TODAY</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{fmtTime12(s.start_time)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {s.duration_minutes}m
                            <span className="text-xs text-gray-400 ml-1">({s.teaching_minutes}+{s.prep_buffer_minutes})</span>
                          </td>
                          <td className="px-4 py-3">
                            {s.teacher_name ? (
                              <div className="flex items-center gap-2">
                                <Avatar name={s.teacher_name} src={s.teacher_image} size="sm" />
                                <span className="text-sm text-gray-700">{s.teacher_name}</span>
                              </div>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={es} /></td>
                          <td className="px-4 py-3">
                            {es === 'live' && (
                              <div className="flex items-center gap-1">
                                {s.recording_status === 'recording' ? (
                                  <>
                                    <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
                                      REC
                                    </span>
                                    <button onClick={() => handleStopRecording(s)} disabled={recordingLoading === s.session_id}
                                      title="Stop Recording" className="ml-1 p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                                      <StopCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => handleStartRecording(s)} disabled={recordingLoading === s.session_id}
                                    title="Start Recording" className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                    <Video className="h-3.5 w-3.5" />
                                    <span>Record</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {es === 'ended' && s.recording_status === 'completed' && s.recording_url && (
                              <a href={s.recording_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                                <Video className="h-3.5 w-3.5" />
                                <span>Watch</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {(es !== 'live' && !(es === 'ended' && s.recording_status === 'completed' && s.recording_url)) && (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <SessionActionsDropdown
                              session={s}
                              onEdit={() => setEditSession(s)}
                              onSwap={() => setSwapSession(s)}
                              onCancel={() => handleCancel(s)}
                              onDelete={() => handleDelete(s)}
                              onEnd={() => handleEnd(s)}
                              onObserve={() => window.open('/academic-operator/live', '_blank')}
                              onViewReport={() => setReportRoomId(s.session_id)}
                            />
                          </td>
                        </TRow>
                      );
                    })}
                  </tbody>
                </TableWrapper>
                )}
              </div>
            );
          })}
          <div className="text-center text-xs text-gray-400 py-1">
            {filtered.length} total session{filtered.length !== 1 ? 's' : ''} across {groupSessionsBySubject(filtered).length} subject{groupSessionsBySubject(filtered).length !== 1 ? 's' : ''}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editSession && (
        <EditSessionModal
          session={editSession}
          batch={batches.find(b => b.batch_id === editSession.batch_id) || null}
          onClose={() => setEditSession(null)}
          onSaved={() => { setEditSession(null); onRefresh(); }}
        />
      )}

      {/* Swap Session Modal */}
      {swapSession && (
        <SwapSessionModal
          session={swapSession}
          candidates={sessions.filter(x =>
            x.batch_id === swapSession.batch_id &&
            x.session_id !== swapSession.session_id &&
            x.status === 'scheduled'
          )}
          onClose={() => setSwapSession(null)}
          onSaved={() => { setSwapSession(null); onRefresh(); }}
        />
      )}

      {showSchedule && (
        <ScheduleSessionModal
          batches={batches}
          onClose={() => { setShowSchedule(false); setScheduleBatch(null); }}
          onCreated={() => { setShowSchedule(false); setScheduleBatch(null); onRefresh(); }}
        />
      )}

      {/* Session Report Modal */}
      {reportRoomId && (
        <SessionReportView roomId={reportRoomId} onClose={() => setReportRoomId(null)} />
      )}
    </div>
  );
}

// --- Edit Session Modal -------------------------------------
function EditSessionModal({ session, batch, onClose, onSaved }: {
  session: Session;
  batch: Batch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [allTeachers, setAllTeachers] = useState<Person[]>([]);
  useEffect(() => {
    fetch('/api/v1/batches/people?role=teacher').then(r => r.json()).then(d => {
      if (d.success) setAllTeachers(d.data?.people || []);
    }).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    subject: session.subject,
    teacher_email: session.teacher_email || '',
    teacher_name: session.teacher_name || '',
    scheduled_date: session.scheduled_date.slice(0, 10),
    start_time: session.start_time.slice(0, 5),
    duration_minutes: session.duration_minutes,
    teaching_minutes: session.teaching_minutes,
    prep_buffer_minutes: session.prep_buffer_minutes,
    topic: session.topic || '',
    notes: session.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const durations = [30, 45, 60, 75, 90, 120];

  // Auto-calculate teaching + prep from duration
  useEffect(() => {
    const prep = form.duration_minutes <= 45 ? 5 : form.duration_minutes <= 75 ? 10 : 15;
    const teaching = form.duration_minutes - prep;
    setForm(p => ({ ...p, teaching_minutes: teaching, prep_buffer_minutes: prep }));
  }, [form.duration_minutes]);

  const f = (key: string, val: string | number) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.subject || !form.scheduled_date || !form.start_time) {
      setError('Subject, date, and time are required');
      return;
    }
    // Reject sessions in the past (IST)
    const sessionDateTimeIST = new Date(`${form.scheduled_date}T${form.start_time}+05:30`);
    if (sessionDateTimeIST < new Date()) {
      setError('Session date and time cannot be in the past (Indian Standard Time).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          teacher_email: form.teacher_email || null,
          teacher_name: form.teacher_name || null,
          scheduled_date: form.scheduled_date,
          start_time: form.start_time,
          duration_minutes: form.duration_minutes,
          teaching_minutes: form.teaching_minutes,
          prep_buffer_minutes: form.prep_buffer_minutes,
          topic: form.topic || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Session updated');
        onSaved();
      } else {
        setError(data.error || 'Failed to update session');
      }
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const subjects = batch?.subjects || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b bg-linear-to-r from-primary to-secondary flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Session</h2>
            <p className="text-primary/60 text-xs mt-0.5">{session.subject} — {fmtDate(session.scheduled_date)}</p>
          </div>
          <button onClick={onClose} className="text-primary/60 hover:text-white transition"><X className="h-5 w-5" /></button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

          <FormGrid cols={2}>
            <FormField label="Subject" required>
              {subjects.length > 0 ? (
                <Select value={form.subject} onChange={(v) => f('subject', v)}
                  options={subjects.map(s => ({ value: s, label: s }))} />
              ) : (
                <Input value={form.subject} onChange={(e) => f('subject', e.target.value)} />
              )}
            </FormField>
            <FormField label="Teacher">
              <Select
                value={form.teacher_email}
                onChange={(v) => {
                  const t = allTeachers.find(t => t.email === v);
                  setForm(p => ({ ...p, teacher_email: v, teacher_name: t?.full_name || '' }));
                }}
                options={[
                  { value: '', label: 'Select Teacher...' },
                  ...allTeachers.map(t => ({ value: t.email, label: t.full_name })),
                ]}
              />
            </FormField>
          </FormGrid>

          <FormGrid cols={2}>
            <FormField label="Date" required>
              <Input type="date" value={form.scheduled_date} min={todayISO()} onChange={(e) => f('scheduled_date', e.target.value)} />
            </FormField>
            <FormField label="Start Time" required>
              <TimePicker12 value={form.start_time} onChange={(v) => f('start_time', v)}
                minTime={form.scheduled_date === todayISO() ? fmtMins(nowISTMinutes()) : undefined} />
            </FormField>
          </FormGrid>

          <FormField label="Duration" required>
            <div className="grid grid-cols-3 gap-2 mt-1 sm:grid-cols-6">
              {durations.map(d => (
                <button key={d} type="button" onClick={() => f('duration_minutes', d)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    form.duration_minutes === d
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </FormField>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500">Teaching</p>
                <p className="text-sm font-bold text-gray-900">{form.teaching_minutes}m</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500">Prep Buffer</p>
                <p className="text-sm font-bold text-gray-900">{form.prep_buffer_minutes}m</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-bold text-primary">{form.duration_minutes}m</p>
              </div>
            </div>
          </div>

          <FormField label="Topic">
            <Input value={form.topic} onChange={(e) => f('topic', e.target.value)} placeholder="e.g. Quadratic Equations" />
          </FormField>

          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => f('notes', e.target.value)} placeholder="Any special instructions..." rows={3} />
          </FormField>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/80 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Swap Session Modal -------------------------------------
function SwapSessionModal({ session, candidates, onClose, onSaved }: {
  session: Session;
  candidates: Session[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [targetId, setTargetId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionDateISO = String(session.scheduled_date).slice(0, 10);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates
      .filter(c => String(c.scheduled_date).slice(0, 10) !== sessionDateISO) // different date only
      .filter(c => {
        if (!q) return true;
        return (
          c.subject?.toLowerCase().includes(q) ||
          (c.teacher_name || '').toLowerCase().includes(q) ||
          (c.topic || '').toLowerCase().includes(q) ||
          String(c.scheduled_date).slice(0, 10).includes(q)
        );
      })
      .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)));
  }, [candidates, search, sessionDateISO]);

  const target = filtered.find(c => c.session_id === targetId) ?? null;

  const PRESET_REASONS = [
    'Teacher unavailable / on leave',
    'Teacher schedule conflict',
    'Curriculum re-sequencing',
    'Topic dependency change',
    'Other',
  ];

  async function handleSubmit() {
    setError(null);
    if (!targetId) { setError('Pick a session to swap with'); return; }
    if (!reason.trim()) { setError('Reason is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/batch-sessions/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionAId: session.session_id,
          sessionBId: targetId,
          reason: reason.trim(),
          remarks: remarks.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to swap sessions');
        return;
      }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Swap Session</h2>
              <p className="text-xs text-gray-500">Interchange curriculum content (subject, teacher, topic) between two scheduled sessions in the same batch.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-white hover:text-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Current session card */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Current session (cannot be taken)</div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{session.subject}</div>
                  <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(sessionDateISO)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(session.start_time)}</span>
                    <span>{session.duration_minutes}m</span>
                    {session.teacher_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{session.teacher_name}</span>}
                  </div>
                  {session.topic && <div className="text-xs text-gray-500 mt-1">Topic: {session.topic}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Target picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Pick a session on a different date to swap with</div>
              <div className="text-[11px] text-gray-400">{filtered.length} eligible</div>
            </div>
            <div className="relative mb-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by subject, teacher, topic or date..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  No other scheduled sessions on different dates in this batch.
                </div>
              ) : filtered.map(c => {
                const dISO = String(c.scheduled_date).slice(0, 10);
                const isSel = c.session_id === targetId;
                return (
                  <button
                    key={c.session_id}
                    type="button"
                    onClick={() => setTargetId(c.session_id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSel ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{c.subject}</span>
                          {isSel && <span className="rounded-full bg-amber-200 text-amber-900 text-[10px] font-semibold px-2 py-0.5">SELECTED</span>}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(dISO)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(c.start_time)}</span>
                          <span>{c.duration_minutes}m</span>
                          {c.teacher_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{c.teacher_name}</span>}
                        </div>
                        {c.topic && <div className="text-xs text-gray-500 mt-0.5 truncate">Topic: {c.topic}</div>}
                      </div>
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0 ${
                        isSel ? 'border-amber-600 bg-amber-600' : 'border-gray-300 bg-white'
                      }`}>
                        {isSel && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Swap preview */}
          {target && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Swap preview
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-white border border-amber-100 p-3">
                  <div className="text-xs text-gray-500 mb-1">{fmtDate(sessionDateISO)} @ {fmtTime12(session.start_time)}</div>
                  <div className="text-xs text-gray-400 line-through">{session.subject} {session.teacher_name && `· ${session.teacher_name}`}</div>
                  <div className="text-sm font-semibold text-amber-900 mt-0.5">{target.subject} {target.teacher_name && <span className="text-gray-700 font-normal">· {target.teacher_name}</span>}</div>
                </div>
                <div className="rounded-lg bg-white border border-amber-100 p-3">
                  <div className="text-xs text-gray-500 mb-1">{fmtDate(String(target.scheduled_date).slice(0, 10))} @ {fmtTime12(target.start_time)}</div>
                  <div className="text-xs text-gray-400 line-through">{target.subject} {target.teacher_name && `· ${target.teacher_name}`}</div>
                  <div className="text-sm font-semibold text-amber-900 mt-0.5">{session.subject} {session.teacher_name && <span className="text-gray-700 font-normal">· {session.teacher_name}</span>}</div>
                </div>
              </div>
              <p className="text-[11px] text-amber-800/80 mt-2">
                Date and time of both sessions remain unchanged. Only subject, teacher and topic are interchanged.
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Reason for swap *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    reason === r
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Teacher unavailable due to leave"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Additional remarks (optional)</label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Any context for stakeholders, audit trail, etc."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/80 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={ArrowRightLeft}
            onClick={handleSubmit}
            loading={saving}
            disabled={saving || !targetId || !reason.trim()}
          >
            Confirm Swap
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- 12-hour Time Picker ------------------------------------
// Per-subject scheduling slot
type SubjectSlot = {
  subject: string;
  enabled: boolean;
  teacher_email: string;
  teacher_name: string;
  override_teacher: boolean;
  days: string[];        // e.g. ['Mon', 'Wed', 'Fri']
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number;
  prep_buffer_minutes: number;
  topic: string;
};

function TimePicker12({ value, onChange, disabled, compact, minTime }: { value: string; onChange: (v: string) => void; disabled?: boolean; compact?: boolean; minTime?: string }) {
  const [h24, min] = (value || '09:00').split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const minMins = minTime ? minTime.split(':').map(Number).reduce((h, m) => h * 60 + m, 0) : -1;

  const to24 = (hr12: number, p: string) => {
    let h = hr12;
    if (p === 'AM') { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
    return h;
  };

  const update = (newH12: number, newMin: number, newPeriod: string) => {
    const h = to24(newH12, newPeriod);
    const totalMin = h * 60 + newMin;
    if (minMins >= 0 && totalMin < minMins) return; // block past times
    onChange(`${String(h).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`);
  };

  // Check if an hour option would be entirely in the past
  const isHourDisabled = (hr12: number, p: string): boolean => {
    if (minMins < 0) return false;
    const h = to24(hr12, p);
    return (h + 1) * 60 <= minMins; // even :55 of this hour is past
  };

  // Check if a minute option is in the past for the current hour
  const isMinDisabled = (m: number): boolean => {
    if (minMins < 0) return false;
    return h24 * 60 + m < minMins;
  };

  // Check if a period is fully past
  const isPeriodDisabled = (p: string): boolean => {
    if (minMins < 0) return false;
    if (p === 'AM') return minMins >= 12 * 60; // noon or later
    return false; // PM never fully disabled
  };

  const isPast = minMins >= 0 && h24 * 60 + min < minMins;

  const sel = compact
    ? 'rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700 focus:border-primary focus:outline-none disabled:opacity-50'
    : 'rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50';

  return (
    <div>
      <div className={`${compact ? '' : 'mt-1 '}flex items-center gap-1.5`}>
        <select value={h12} disabled={disabled} onChange={(e) => update(Number(e.target.value), min, period)} className={`${sel} ${isPast ? 'border-red-300 text-red-500' : ''}`}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h} disabled={isHourDisabled(h, period)}>{h}</option>
          ))}
        </select>
        <span className="text-gray-400 font-medium">:</span>
        <select value={min} disabled={disabled} onChange={(e) => update(h12, Number(e.target.value), period)} className={`${sel} ${isPast ? 'border-red-300 text-red-500' : ''}`}>
          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
            <option key={m} value={m} disabled={isMinDisabled(m)}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>
        <select value={period} disabled={disabled} onChange={(e) => update(h12, min, e.target.value)} className={`${sel} font-medium ${isPast ? 'border-red-300 text-red-500' : ''}`}>
          <option disabled={isPeriodDisabled('AM')}>AM</option>
          <option disabled={isPeriodDisabled('PM')}>PM</option>
        </select>
        <span className="text-[10px] text-gray-400 ml-1">IST</span>
      </div>
      {isPast && <p className="text-[10px] text-red-500 mt-0.5 ml-0.5">⚠ Time has passed</p>}
    </div>
  );
}

// --- Schedule Session Wizard --------------------------------
type ScheduleStep = 'batch' | 'class' | 'schedule' | 'review';

const SCHEDULE_STEPS_WITH_BATCH: { key: ScheduleStep; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'batch', label: 'Select Batch', desc: 'Choose a batch', icon: Layers },
  { key: 'class', label: 'Subjects & Days', desc: 'Subjects, days & teachers', icon: BookOpen },
  { key: 'schedule', label: 'Time & Schedule', desc: 'Set times & recurrence', icon: Calendar },
  { key: 'review', label: 'Review', desc: 'Confirm & schedule', icon: CheckCircle2 },
];

const SCHEDULE_STEPS_NO_BATCH: { key: ScheduleStep; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'class', label: 'Subjects & Days', desc: 'Subjects, days & teachers', icon: BookOpen },
  { key: 'schedule', label: 'Time & Schedule', desc: 'Set times & recurrence', icon: Calendar },
  { key: 'review', label: 'Review', desc: 'Confirm & schedule', icon: CheckCircle2 },
];

function ScheduleSessionModal({ batch: initialBatch, batches: availableBatches, onClose, onCreated }: {
  batch?: Batch | null;
  batches?: Batch[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const needsBatchSelect = !initialBatch;
  const SCHEDULE_STEPS = needsBatchSelect ? SCHEDULE_STEPS_WITH_BATCH : SCHEDULE_STEPS_NO_BATCH;

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(initialBatch || null);
  const batch = selectedBatch!; // used after batch step is done

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = SCHEDULE_STEPS[stepIdx].key;

  // Fetch all teachers for teacher override
  const [allTeachers, setAllTeachers] = useState<Person[]>([]);
  useEffect(() => {
    fetch('/api/v1/batches/people?role=teacher').then(r => r.json()).then(d => {
      if (d.success) setAllTeachers(d.data?.people || []);
    }).catch(() => {});
  }, []);

  // Fetch existing sessions for this batch (for time conflict detection)
  const [existingSessions, setExistingSessions] = useState<Session[]>([]);
  useEffect(() => {
    if (!selectedBatch) return;
    fetch(`/api/v1/batch-sessions?batch_id=${selectedBatch.batch_id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setExistingSessions(d.data?.sessions || []); })
      .catch(() => {});
  }, [selectedBatch]);

  // Fetch batch students with their regions (for timezone display)
  type TzStudent = { name: string; email: string; region: string | null };
  const [batchStudents, setBatchStudents] = useState<TzStudent[]>([]);
  const [showStudentTzPopup, setShowStudentTzPopup] = useState(false);
  useEffect(() => {
    if (!selectedBatch) return;
    fetch(`/api/v1/batches/${selectedBatch.batch_id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const students = (d.data?.students || []) as BatchStudent[];
          setBatchStudents(students.map(s => ({ name: s.student_name || s.student_email, email: s.student_email, region: s.student_region })));
        }
      })
      .catch(() => {});
  }, [selectedBatch]);

  const batchStudentRegions = batchStudents.map(s => s.region);
  const tzGroups = groupStudentsByTimezone(batchStudentRegions);

  const [subjectSlots, setSubjectSlots] = useState<SubjectSlot[]>([]);

  // Fetch cross-batch sessions for all assigned teachers (for conflict detection across batches)
  const [teacherCrossSessions, setTeacherCrossSessions] = useState<Session[]>([]);
  const teacherEmailsKey = subjectSlots.filter(s => s.enabled && s.teacher_email).map(s => s.teacher_email).sort().join(',');
  useEffect(() => {
    if (!teacherEmailsKey) { setTeacherCrossSessions([]); return; }
    const emails = [...new Set(teacherEmailsKey.split(',').filter(Boolean))];
    const currentBatchId = selectedBatch?.batch_id;
    Promise.all(
      emails.map(email =>
        fetch(`/api/v1/batch-sessions?teacher_email=${encodeURIComponent(email)}&status=scheduled`)
          .then(r => r.json())
          .then(d => (d.success ? d.data?.sessions || [] : []) as Session[])
          .catch(() => [] as Session[])
      )
    ).then(results => {
      const map = new Map<string, Session>();
      results.flat().forEach(s => {
        if (s.batch_id !== currentBatchId) map.set(s.session_id, s);
      });
      setTeacherCrossSessions(Array.from(map.values()));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherEmailsKey, selectedBatch?.batch_id]);

  const [form, setForm] = useState({
    scheduled_date: todayISO(),
    topic: '',
    notes: '',
    recurring: false,
    class_days: [] as string[],
    recurring_unit: 'months' as 'weeks' | 'months',
    recurring_count: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const durations = [30, 45, 60, 75, 90, 120];

  // -- Time helpers --
  const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const minutesToTime = (mins: number) => { const clamped = Math.min(Math.max(mins, 0), 23 * 60 + 59); const h = Math.floor(clamped / 60); const m = clamped % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  // Initialize subject slots when batch is selected
  useEffect(() => {
    if (!selectedBatch) return;
    const subjects = selectedBatch.subjects || [];
    // Default start = IST now + 30 min (rounded to 5 min), minimum 7:00 AM
    const defStart = Math.min(Math.max(nowISTMinutes() + 30, 7 * 60), 22 * 60);
    let nextTime = Math.ceil(defStart / 5) * 5;
    const slots: SubjectSlot[] = subjects.map(subj => {
      const teacher = selectedBatch.teachers.find(t => t.subject === subj);
      const duration = 90;
      const prep = duration <= 45 ? 5 : duration <= 75 ? 10 : 15;
      const teaching = duration - prep;
      const slot: SubjectSlot = {
        subject: subj,
        enabled: true,
        teacher_email: teacher?.teacher_email || '',
        teacher_name: teacher?.teacher_name || '',
        override_teacher: false,
        days: [],
        start_time: minutesToTime(nextTime),
        duration_minutes: duration,
        teaching_minutes: teaching,
        prep_buffer_minutes: prep,
        topic: '',
      };
      nextTime = Math.min(nextTime + duration, 22 * 60);
      return slot;
    });
    setSubjectSlots(slots);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch]);

  // Auto-fill topics from academic calendar when date changes
  useEffect(() => {
    if (!selectedBatch || !form.scheduled_date) return;
    fetch(`/api/v1/academic-calendars/next-topics?batch_id=${selectedBatch.batch_id}&date=${form.scheduled_date}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.topics) {
          const topics = d.data.topics as Record<string, string>;
          setSubjectSlots(prev => prev.map(s => {
            const calTopic = topics[s.subject];
            if (calTopic) return { ...s, topic: calTopic };
            return s;
          }));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch?.batch_id, form.scheduled_date]);

  // -- Subject slot helpers --
  const toggleSlot = (idx: number) => {
    setSubjectSlots(prev => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
  };

  const toggleSlotOverride = (idx: number) => {
    setSubjectSlots(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      if (s.override_teacher) {
        const teacher = selectedBatch?.teachers?.find(t => t.subject === s.subject);
        return { ...s, override_teacher: false, teacher_email: teacher?.teacher_email || '', teacher_name: teacher?.teacher_name || '' };
      }
      return { ...s, override_teacher: true };
    }));
  };

  const updateSlotTeacher = (idx: number, email: string) => {
    const t = allTeachers.find(at => at.email === email);
    setSubjectSlots(prev => prev.map((s, i) => i === idx ? { ...s, teacher_email: email, teacher_name: t?.full_name || '' } : s));
  };

  const toggleSlotDay = (idx: number, day: string) => {
    setSubjectSlots(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const days = s.days.includes(day) ? s.days.filter(d => d !== day) : [...s.days, day];
      return { ...s, days };
    }));
  };

  const updateSlotTime = (idx: number, time: string) => {
    setSubjectSlots(prev => prev.map((s, i) => i === idx ? { ...s, start_time: time } : s));
  };

  const updateSlotDuration = (idx: number, duration: number) => {
    const prep = duration <= 45 ? 5 : duration <= 75 ? 10 : 15;
    const teaching = duration - prep;
    setSubjectSlots(prev => prev.map((s, i) => i === idx ? { ...s, duration_minutes: duration, teaching_minutes: teaching, prep_buffer_minutes: prep } : s));
  };

  // -- Day-aware auto-arrange: for each day, space subjects that share that day --
  // Helper: get cross-batch sessions for a specific teacher on a specific day-of-week
  const getTeacherCrossSessionsForDay = (email: string, day: string) => {
    if (!email) return [];
    // day index in JS Date: Sun=0, Mon=1, etc.
    const jsDayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const jsDay = jsDayMap[day];
    return teacherCrossSessions.filter(s => {
      if (s.teacher_email !== email || s.status === 'cancelled') return false;
      const d = new Date(s.scheduled_date + 'T00:00');
      return d.getDay() === jsDay;
    });
  };

  const autoArrangeSlots = () => {
    setSubjectSlots(prev => {
      const updated = prev.map(s => ({ ...s }));
      const allDays = [...new Set(updated.filter(s => s.enabled).flatMap(s => s.days))];
      const subjectMinStart: Record<string, number> = {};

      for (const day of allDays) {
        const daySlots = updated.filter(s => s.enabled && s.days.includes(day));
        // Existing sessions in current batch
        const occupied = existingSessions
          .filter(s => s.status !== 'cancelled')
          .map(s => ({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.start_time) + (s.duration_minutes || 60) }))
          .sort((a, b) => a.start - b.start);

        let nextStart = 9 * 60;
        for (const slot of daySlots) {
          const dur = slot.duration_minutes;
          let candidate = Math.max(nextStart, subjectMinStart[slot.subject] || 0);
          // Build occupied: existing batch sessions + cross-batch teacher sessions + other placed subjects
          const crossOcc = getTeacherCrossSessionsForDay(slot.teacher_email, day)
            .map(s => ({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.start_time) + (s.duration_minutes || 60) }));
          const allOcc = [
            ...occupied,
            ...crossOcc,
            ...daySlots
              .filter(ds => ds.subject !== slot.subject && timeToMinutes(ds.start_time) > 0)
              .map(ds => ({ start: timeToMinutes(ds.start_time), end: timeToMinutes(ds.start_time) + ds.duration_minutes })),
          ].sort((a, b) => a.start - b.start);

          for (const o of allOcc) {
            if (candidate < o.end && (candidate + dur) > o.start) candidate = o.end;
          }
          if (candidate + dur > 22 * 60) candidate = 22 * 60 - dur;
          if (candidate < 0) candidate = 0;

          const idx = updated.findIndex(u => u.subject === slot.subject);
          updated[idx] = { ...updated[idx], start_time: minutesToTime(candidate) };
          subjectMinStart[slot.subject] = candidate;
          nextStart = candidate + dur;
        }
      }
      return updated;
    });
  };

  // -- Day-aware conflict detection (includes cross-batch teacher conflicts) --
  const getSlotConflicts = (idx: number): string[] => {
    const slot = subjectSlots[idx];
    if (!slot?.enabled || slot.days.length === 0) return [];
    const conflicts: string[] = [];
    const start = timeToMinutes(slot.start_time);
    const end = start + slot.duration_minutes;

    // 1. Check against other enabled slots on SHARED days (time overlap within this batch)
    subjectSlots.forEach((other, i) => {
      if (i === idx || !other.enabled) return;
      const sharedDays = slot.days.filter(d => other.days.includes(d));
      if (sharedDays.length === 0) return;
      const oStart = timeToMinutes(other.start_time);
      const oEnd = oStart + other.duration_minutes;
      if (start < oEnd && end > oStart) {
        conflicts.push(`Overlaps with ${other.subject} on ${sharedDays.join(', ')}`);
      }
    });

    // 2. Same-teacher conflicts within this batch on shared days
    subjectSlots.forEach((other, i) => {
      if (i === idx || !other.enabled || !slot.teacher_email) return;
      if (slot.teacher_email !== other.teacher_email) return;
      const sharedDays = slot.days.filter(d => other.days.includes(d));
      if (sharedDays.length === 0) return;
      const oStart = timeToMinutes(other.start_time);
      const oEnd = oStart + other.duration_minutes;
      if (start < oEnd && end > oStart) {
        conflicts.push(`Teacher ${slot.teacher_name} also in ${other.subject} on ${sharedDays.join(', ')}`);
      }
    });

    // 3. Cross-batch teacher conflicts: teacher has sessions in OTHER batches at overlapping times
    if (slot.teacher_email) {
      for (const day of slot.days) {
        const crossSessions = getTeacherCrossSessionsForDay(slot.teacher_email, day);
        for (const cs of crossSessions) {
          const csStart = timeToMinutes(cs.start_time);
          const csEnd = csStart + (cs.duration_minutes || 60);
          if (start < csEnd && end > csStart) {
            const batchLabel = cs.batch_name || 'another batch';
            conflicts.push(`${slot.teacher_name} teaches ${cs.subject} in ${batchLabel} (${fmtTime12(cs.start_time)}–${fmtTime12(minutesToTime(csEnd))}) on ${day}`);
          }
        }
      }
    }

    return [...new Set(conflicts)];
  };

  // -- Suggest best available time when a slot has conflicts --
  const suggestTime = (idx: number): string | null => {
    const slot = subjectSlots[idx];
    if (!slot?.enabled || slot.days.length === 0) return null;
    const dur = slot.duration_minutes;

    // Collect all occupied slots on shared days (other subjects + existing sessions + cross-batch teacher sessions)
    const occupied: { start: number; end: number }[] = [];
    subjectSlots.forEach((other, i) => {
      if (i === idx || !other.enabled) return;
      const sharedDays = slot.days.filter(d => other.days.includes(d));
      if (sharedDays.length === 0) return;
      occupied.push({ start: timeToMinutes(other.start_time), end: timeToMinutes(other.start_time) + other.duration_minutes });
    });
    existingSessions
      .filter(s => s.status !== 'cancelled')
      .forEach(s => {
        occupied.push({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.start_time) + (s.duration_minutes || 60) });
      });
    // Add cross-batch teacher sessions on shared days
    if (slot.teacher_email) {
      for (const day of slot.days) {
        getTeacherCrossSessionsForDay(slot.teacher_email, day).forEach(cs => {
          occupied.push({ start: timeToMinutes(cs.start_time), end: timeToMinutes(cs.start_time) + (cs.duration_minutes || 60) });
        });
      }
    }
    occupied.sort((a, b) => a.start - b.start);

    // Try slots starting from 7:00 AM in 15-min increments up to 10 PM
    for (let candidate = 7 * 60; candidate + dur <= 22 * 60; candidate += 15) {
      const cEnd = candidate + dur;
      const hasConflict = occupied.some(o => candidate < o.end && cEnd > o.start);
      if (!hasConflict) return minutesToTime(candidate);
    }
    return null;
  };

  const enabledSlots = subjectSlots.filter(s => s.enabled);
  const slotsWithDays = enabledSlots.filter(s => s.days.length > 0);
  const hasAnyConflict = slotsWithDays.some((s) => {
    const realIdx = subjectSlots.findIndex(ss => ss === s);
    return getSlotConflicts(realIdx).length > 0;
  });

  // All unique days across all enabled subject slots
  const allAssignedDays = [...new Set(enabledSlots.flatMap(s => s.days))].sort((a, b) =>
    DAY_NAMES.indexOf(a as typeof DAY_NAMES[number]) - DAY_NAMES.indexOf(b as typeof DAY_NAMES[number])
  );

  const f = (key: string, val: string | number | boolean | string[]) => setForm(p => ({ ...p, [key]: val }));

  // Compute recurring dates — use allAssignedDays instead of form.class_days
  const recurringDates = form.recurring && allAssignedDays.length > 0
    ? getDatesForDays(allAssignedDays, form.scheduled_date, form.recurring_count, form.recurring_unit)
    : [];

  const isStepValid = (step: ScheduleStep) => {
    switch (step) {
      case 'batch': return !!selectedBatch;
      case 'class': return enabledSlots.length > 0 && enabledSlots.some(s => s.days.length > 0);
      case 'schedule': return !!form.scheduled_date && slotsWithDays.every(s => !!s.start_time);

      case 'review': return true;
      default: return true;
    }
  };

  const canGoNext = () => isStepValid(currentStep);
  const goNext = () => { if (canGoNext() && stepIdx < SCHEDULE_STEPS.length - 1) setStepIdx(stepIdx + 1); };
  const goPrev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  const handleSubmit = async () => {
    if (slotsWithDays.length === 0) { setError('Select at least one subject with days assigned'); return; }
    if (!form.scheduled_date) { setError('Date is required'); return; }

    setError(''); setSubmitting(true);

    // Build list of (slot, date) pairs
    type SessionJob = { slot: SubjectSlot; date: string };
    const jobs: SessionJob[] = [];

    if (form.recurring && recurringDates.length > 0) {
      // For each recurring date, create sessions for subjects assigned to that day of week
      for (const rd of recurringDates) {
        for (const slot of slotsWithDays) {
          if (slot.days.includes(rd.day)) {
            jobs.push({ slot, date: rd.date });
          }
        }
      }
    } else {
      // Single date — which day of week is it?
      const d = new Date(form.scheduled_date + 'T00:00');
      const dayIdx = d.getDay(); // 0=Sun,...6=Sat
      const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayMap[dayIdx];
      for (const slot of slotsWithDays) {
        if (slot.days.includes(dayName)) {
          jobs.push({ slot, date: form.scheduled_date });
        }
      }
      // Also add subjects whose assigned days don't match the selected date (schedule anyway on the date)
      for (const slot of slotsWithDays) {
        if (!slot.days.includes(dayName) && !jobs.some(j => j.slot.subject === slot.subject)) {
          jobs.push({ slot, date: form.scheduled_date });
        }
      }
    }

    if (jobs.length === 0) { setError('No sessions to create for the selected date/days'); setSubmitting(false); return; }

    // Reject sessions in the past
    for (const job of jobs) {
      const dt = new Date(`${job.date}T${job.slot.start_time}+05:30`);
      if (dt < new Date()) {
        setError(`${job.slot.subject} on ${job.date} is in the past (IST). Please adjust.`);
        setSubmitting(false);
        return;
      }
    }

    let created = 0;
    let failed = 0;

    // Generate a unique group ID to tie all sessions + combined invoice together
    const scheduleGroupId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      for (const { slot, date } of jobs) {
        try {
          const payload = {
            batch_id: batch.batch_id,
            subject: slot.subject,
            teacher_email: slot.teacher_email || null,
            teacher_name: slot.teacher_name || null,
            scheduled_date: date,
            start_time: slot.start_time,
            duration_minutes: slot.duration_minutes,
            teaching_minutes: slot.teaching_minutes,
            prep_buffer_minutes: slot.prep_buffer_minutes,
            topic: slot.topic || form.topic || null,
            notes: form.notes || null,
            schedule_group_id: scheduleGroupId,
          };
          const res = await fetch('/api/v1/batch-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok && data.success) created++;
          else failed++;
        } catch { failed++; }
      }

      if (created > 0) {
        // Generate combined invoices for all sessions in this schedule group
        try {
          const invoiceRes = await fetch('/api/v1/batch-sessions/finalize-invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedule_group_id: scheduleGroupId }),
          });
          const invoiceData = await invoiceRes.json();
          if (invoiceRes.ok && invoiceData.success) {
            const d = invoiceData.data;
            const invCount = d?.invoices_created || 0;
            const creditCount = d?.credits_covered || 0;
            const amt = d?.total_amount;
            const amtStr = amt ? ` (${amt.currency} ${(amt.amountPaise / 100).toFixed(2)} each)` : '';

            if (invCount > 0 && creditCount > 0) {
              toast.success(
                `${created} session${created > 1 ? 's' : ''} scheduled — ${invCount} invoice${invCount > 1 ? 's' : ''} generated${amtStr}, ${creditCount} session${creditCount > 1 ? 's' : ''} covered by prepaid credits`
              );
            } else if (invCount > 0) {
              toast.success(
                `${created} session${created > 1 ? 's' : ''} scheduled — ${invCount} invoice${invCount > 1 ? 's' : ''} generated${amtStr}`
              );
            } else if (creditCount > 0) {
              toast.success(
                `${created} session${created > 1 ? 's' : ''} scheduled — all ${creditCount} session${creditCount > 1 ? 's' : ''} covered by prepaid credits, no invoice needed`
              );
            } else {
              toast.success(`${created} session${created > 1 ? 's' : ''} scheduled${failed > 0 ? ` (${failed} failed)` : ''}`);
            }
          } else {
            toast.success(`${created} session${created > 1 ? 's' : ''} scheduled${failed > 0 ? ` (${failed} failed)` : ''}`);
          }
        } catch {
          // Invoice generation failure is non-fatal
          toast.success(`${created} session${created > 1 ? 's' : ''} scheduled${failed > 0 ? ` (${failed} failed)` : ''}`);
        }
        onCreated();
      } else {
        setError('Failed to create any sessions');
      }
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  // -- Step renderers --

  const renderBatchStep = () => {
    const batchList = availableBatches?.filter(b => b.status === 'active') || [];
    return (
      <>
        <h2 className="text-xl font-bold text-gray-900">Select Batch</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Choose which batch to schedule a session for</p>

        {batchList.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">No active batches available</p>
            <p className="text-xs text-gray-400 mt-1">Create a batch first before scheduling sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchList.map(b => {
              const isSelected = selectedBatch?.batch_id === b.batch_id;
              return (
                <button
                  key={b.batch_id}
                  type="button"
                  onClick={() => {
                    setSelectedBatch(b);
                  }}
                  className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>{b.batch_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Grade {b.grade}{b.section ? ` - ${b.section}` : ''} · {b.subjects?.join(', ') || 'No subjects'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{b.student_count} student{b.student_count !== 1 ? 's' : ''}</span>
                      <span>{b.teacher_count} teacher{b.teacher_count !== 1 ? 's' : ''}</span>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const renderClassStep = () => (
    <>
      <h2 className="text-xl font-bold text-gray-900">Subjects, Days &amp; Teachers</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">Select subjects, assign each to specific days, and confirm teachers</p>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setSubjectSlots(prev => prev.map(s => ({ ...s, enabled: true })))}
            className="text-xs font-medium text-primary hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/5 transition">
            Select All
          </button>
          <button type="button" onClick={() => setSubjectSlots(prev => prev.map(s => ({ ...s, enabled: false })))}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
            Deselect All
          </button>
        </div>
        <span className="text-xs text-gray-400">{enabledSlots.length} of {subjectSlots.length} selected</span>
      </div>

      <div className="space-y-3">
        {subjectSlots.map((slot, idx) => (
          <div key={slot.subject}
            className={`rounded-xl border-2 px-5 py-4 transition-all ${
              slot.enabled ? 'border-emerald-300 bg-primary/5/30' : 'border-gray-200 bg-gray-50/50 opacity-60'
            }`}
          >
            {/* Subject header row */}
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={slot.enabled}
                onChange={() => toggleSlot(idx)}
                className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{slot.subject}</p>
                <div className="flex items-center gap-2 mt-1">
                  {slot.teacher_name ? (
                    <>
                      <Avatar name={slot.teacher_name} size="sm" />
                      <span className="text-xs text-gray-600">{slot.teacher_name}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </>
                  ) : (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> No teacher assigned
                    </span>
                  )}
                </div>
              </div>
              {slot.enabled && (
                <button type="button" onClick={() => toggleSlotOverride(idx)}
                  className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1 shrink-0">
                  <RefreshCw className="h-3 w-3" />
                  {slot.override_teacher ? 'Use default' : 'Change'}
                </button>
              )}
            </div>

            {/* Day selector — only when enabled */}
            {slot.enabled && (
              <div className="mt-3 pl-9">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Session Days</label>
                <div className="flex gap-1.5">
                  {DAY_NAMES.map(day => (
                    <button key={day} type="button" onClick={() => toggleSlotDay(idx, day)}
                      className={`w-10 h-10 rounded-lg text-[11px] font-bold transition-all ${
                        slot.days.includes(day)
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white border-2 border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-primary'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {slot.days.length === 0 && (
                  <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Pick at least one day
                  </p>
                )}
              </div>
            )}

            {/* Teacher override */}
            {slot.enabled && slot.override_teacher && (
              <div className="mt-3 pl-9">
                <Select
                  value={slot.teacher_email}
                  onChange={(v) => updateSlotTeacher(idx, v)}
                  options={[
                    { value: '', label: 'Select Teacher...' },
                    ...allTeachers
                      .filter(t => {
                        const tSubjects = t.subjects || [];
                        return tSubjects.length === 0 || tSubjects.some(ts => ts.toLowerCase() === slot.subject.toLowerCase());
                      })
                      .map(t => ({
                        value: t.email,
                        label: `${t.full_name}${t.subjects ? ` (${t.subjects.join(', ')})` : ''}`,
                      })),
                  ]}
                  placeholder="Select teacher"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {subjectSlots.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">No subjects in this batch</p>
          <p className="text-xs text-gray-400 mt-1">Add subjects to the batch first</p>
        </div>
      )}

      {/* Summary of day assignments */}
      {slotsWithDays.length > 0 && (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" /> Weekly Timetable Preview
          </h4>
          <div className="flex gap-2 flex-wrap">
            {DAY_NAMES.map(day => {
              const subjects = slotsWithDays.filter(s => s.days.includes(day));
              if (subjects.length === 0) return null;
              return (
                <div key={day} className="bg-white rounded-lg border border-gray-100 px-3 py-2 min-w-[100px]">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">{day}</p>
                  {subjects.map(s => (
                    <p key={s.subject} className="text-xs text-gray-700 mt-0.5">{s.subject}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  const renderScheduleStep = () => {
    // Sessions already on selected date (for reference)
    const sessionsOnDate = existingSessions
      .filter(s => s.scheduled_date.slice(0, 10) === form.scheduled_date && s.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    // Compute actual job count for recurring (subject × matching dates)
    const computeJobCount = () => {
      if (!form.recurring || recurringDates.length === 0) return slotsWithDays.length;
      let count = 0;
      for (const slot of slotsWithDays) {
        count += recurringDates.filter(rd => slot.days.includes(rd.day)).length;
      }
      return count;
    };
    const totalJobs = computeJobCount();

    return (
    <>
      <h2 className="text-xl font-bold text-gray-900">Time & Schedule</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">Set times per subject and configure recurrence</p>

      {/* Date picker */}
      <FormGrid cols={1}>
        <FormField label={form.recurring ? 'Start Date' : 'Date'} required>
          <Input type="date" value={form.scheduled_date} min={todayISO()} onChange={(e) => f('scheduled_date', e.target.value)} />
        </FormField>
      </FormGrid>

      {/* Existing sessions on this date */}
      {sessionsOnDate.length > 0 && (
        <div className="mt-4 mb-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Already scheduled on this date
          </p>
          <div className="space-y-1.5">
            {sessionsOnDate.map(s => {
              const sEnd = timeToMinutes(s.start_time) + (s.duration_minutes || 60);
              return (
                <div key={s.session_id} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-white border border-blue-100">
                  <span className="font-semibold text-gray-900">{s.subject}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-gray-600">{fmtTime12(s.start_time)} – {fmtTime12(minutesToTime(sEnd))}</span>
                  <span className="text-gray-400">({s.duration_minutes}m)</span>
                  {s.teacher_name && <span className="text-gray-400 ml-auto">{s.teacher_name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-subject time assignment */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Subject Timings
          </h3>
          <button type="button" onClick={autoArrangeSlots}
            className="text-xs font-medium text-primary hover:text-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition">
            <RefreshCw className="h-3 w-3" /> Auto-arrange
          </button>
        </div>

        {hasAnyConflict && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-700">Conflicts detected!</p>
              <p className="text-xs text-red-600 mt-0.5">Some subjects overlap on the same days or teachers have conflicts in other batches. Use &quot;Auto-arrange&quot; or click &quot;Suggest time&quot; per subject.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {(() => { let firstEnabledIdx = -1; return subjectSlots.map((slot, idx) => {
            if (!slot.enabled || slot.days.length === 0) return null;
            const isFirstEnabled = firstEnabledIdx === -1;
            if (isFirstEnabled) firstEnabledIdx = idx;
            const otherEnabledCount = subjectSlots.filter((s, i) => i !== idx && s.enabled && s.days.length > 0).length;
            const conflicts = getSlotConflicts(idx);
            const endTime = minutesToTime(timeToMinutes(slot.start_time) + slot.duration_minutes);
            const hasPast = form.scheduled_date && new Date(`${form.scheduled_date}T${slot.start_time}+05:30`) < new Date();

            return (
              <div key={slot.subject} className={`rounded-xl border-2 p-4 transition-all ${
                conflicts.length > 0 ? 'border-red-300 bg-red-50/50' : hasPast ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'
              }`}>
                {/* Header: subject + days + time summary */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${conflicts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900">{slot.subject}</span>
                      {slot.teacher_name && (
                        <span className="text-xs text-gray-500 ml-2">
                          <User className="h-3 w-3 inline" /> {slot.teacher_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-700">{fmtTime12(slot.start_time)} – {fmtTime12(endTime)}</p>
                    {batchStudents.length > 0 && (
                      <button type="button" onClick={() => setShowStudentTzPopup(true)}
                        className="text-[10px] font-medium text-blue-500 hover:text-blue-700 flex items-center gap-0.5 ml-auto mt-0.5">
                        <Globe className="h-2.5 w-2.5" /> Student times
                      </button>
                    )}
                  </div>
                </div>

                {/* Day badges */}
                <div className="flex gap-1.5 mb-3">
                  {slot.days.map(d => (
                    <span key={d} className="rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">{d}</span>
                  ))}
                </div>

                <div className="flex items-start gap-4 flex-wrap">
                  {/* Time picker */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Start Time</label>
                    <TimePicker12 value={slot.start_time} onChange={(v) => updateSlotTime(idx, v)} compact
                      minTime={form.scheduled_date === todayISO() ? fmtMins(nowISTMinutes()) : undefined} />
                    {isFirstEnabled && otherEnabledCount > 0 && (
                      <button type="button" onClick={() => {
                        setSubjectSlots(prev => prev.map(s =>
                          s.enabled && s.days.length > 0 ? { ...s, start_time: slot.start_time } : s
                        ));
                      }}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md px-2 py-0.5 transition"
                      >
                        <Copy className="h-2.5 w-2.5" /> Apply to all subjects
                      </button>
                    )}
                  </div>

                  {/* Duration buttons */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Duration</label>
                    <div className="flex gap-1 flex-wrap">
                      {durations.map(d => (
                        <button key={d} type="button" onClick={() => updateSlotDuration(idx, d)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                            slot.duration_minutes === d
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                      <span>{slot.teaching_minutes}m teaching</span>
                      <span>+</span>
                      <span>{slot.prep_buffer_minutes}m prep</span>
                    </div>
                  </div>
                </div>

                {/* Conflict display + suggest */}
                {conflicts.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="space-y-1">
                      {conflicts.map((c, ci) => (
                        <div key={ci} className="flex items-start gap-1.5 text-xs text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const suggested = suggestTime(idx);
                      if (!suggested) return null;
                      const sugEnd = minutesToTime(timeToMinutes(suggested) + slot.duration_minutes);
                      return (
                        <button type="button" onClick={() => updateSlotTime(idx, suggested)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition">
                          <Zap className="h-3 w-3" />
                          Use suggested: {fmtTime12(suggested)} – {fmtTime12(sugEnd)}
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* Topic input */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Topic {slot.topic ? '' : '(optional)'}
                    {slot.topic && <span className="ml-1 text-primary font-normal normal-case">— from calendar</span>}
                  </label>
                  <input
                    type="text"
                    value={slot.topic}
                    onChange={(e) => setSubjectSlots(prev => prev.map((s, i) => i === idx ? { ...s, topic: e.target.value } : s))}
                    placeholder={`e.g. Chapter 3 — Quadratic Equations`}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-emerald-400 outline-none transition"
                  />
                </div>

                {/* Past warning */}
                {hasPast && conflicts.length === 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>This time has already passed (IST)</span>
                  </div>
                )}
              </div>
            );
          }); })()}
        </div>

        {slotsWithDays.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-400">No subjects with days assigned yet.</p>
            <p className="text-xs text-gray-400 mt-1">Go back and assign days to each subject.</p>
          </div>
        )}
      </div>

      {/* Recurring Schedule */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" /> Recurring Schedule
          </label>
          <button type="button" onClick={() => f('recurring', !form.recurring)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.recurring ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.recurring ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {form.recurring && (
          <div className="rounded-xl border border-primary/20 bg-primary/5/50 p-4 space-y-4">
            {/* Days from subject assignments (read-only) */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Session Days (from subjects)</label>
              <div className="flex gap-2">
                {DAY_NAMES.map(day => (
                  <div key={day}
                    className={`w-11 h-11 rounded-xl text-xs font-bold flex items-center justify-center ${
                      allAssignedDays.includes(day)
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white border-2 border-gray-200 text-gray-300'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Days are set per subject in the previous step</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Duration Unit</label>
              <div className="flex gap-2 mb-3">
                {(['weeks', 'months'] as const).map(u => (
                  <button key={u} type="button" onClick={() => { f('recurring_unit', u); f('recurring_count', 1); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      form.recurring_unit === u
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-emerald-300'
                    }`}
                  >
                    {u === 'weeks' ? <><Calendar className="h-3.5 w-3.5" /> Weeks</> : <><CalendarDays className="h-3.5 w-3.5" /> Months</>}
                  </button>
                ))}
              </div>
            </div>

            <FormField label={form.recurring_unit === 'weeks' ? 'Number of Weeks' : 'Number of Months'}>
              <Select
                value={String(form.recurring_count)}
                onChange={(v) => f('recurring_count', Number(v))}
                options={
                  form.recurring_unit === 'weeks'
                    ? [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(w => ({ value: String(w), label: `${w} week${w > 1 ? 's' : ''}` }))
                    : [1, 2, 3, 4, 5, 6, 8, 10, 12].map(m => ({ value: String(m), label: `${m} month${m > 1 ? 's' : ''}` }))
                }
              />
            </FormField>

            {recurringDates.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  <span className="text-primary font-bold">{totalJobs} sessions</span> total
                  <span className="text-gray-400 ml-1">({slotsWithDays.length} subject{slotsWithDays.length > 1 ? 's' : ''} across {recurringDates.length} date{recurringDates.length > 1 ? 's' : ''})</span>
                </p>
                <div className="max-h-40 overflow-auto space-y-1">
                  {recurringDates.map((rd, i) => {
                    const subjectsOnDay = slotsWithDays.filter(s => s.days.includes(rd.day));
                    return (
                      <div key={rd.date} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-5 text-right text-gray-400">{i + 1}.</span>
                        <span className="font-medium w-16">{DAY_FULL[rd.day]}</span>
                        <span className="text-gray-400">—</span>
                        <span>{fmtDate(rd.date)}</span>
                        <span className="text-gray-300 ml-auto">
                          {subjectsOnDay.map(s => s.subject).join(', ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
    );
  };

  const renderReviewStep = () => {
    // Day-aware job count: sum of recurring dates matching each subject's days
    const computeTotalSessions = () => {
      if (!form.recurring || recurringDates.length === 0) return slotsWithDays.length || enabledSlots.length;
      let count = 0;
      for (const slot of slotsWithDays.length > 0 ? slotsWithDays : enabledSlots) {
        count += recurringDates.filter(rd => slot.days.length === 0 || slot.days.includes(rd.day)).length;
      }
      return count;
    };
    const totalSessions = computeTotalSessions();

    return (
      <>
        <h2 className="text-xl font-bold text-gray-900">Review &amp; Confirm</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Review all details before scheduling</p>

        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

        {/* Batch & Date info */}
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Batch</span>
            <span className="text-sm font-semibold text-gray-900">{batch.batch_name}</span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">{form.recurring ? 'Start Date' : 'Date'}</span>
            <span className="text-sm font-semibold text-gray-900">
              {new Date(form.scheduled_date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Subjects</span>
            <span className="text-sm font-semibold text-gray-900">{enabledSlots.length} subject{enabledSlots.length > 1 ? 's' : ''}</span>
          </div>
          {form.recurring && (
            <>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Session Days</span>
                <div className="flex gap-1">
                  {allAssignedDays.map(d => (
                    <span key={d} className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">{d}</span>
                  ))}
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Sessions</span>
                <span className="text-sm font-bold text-primary">{totalSessions} sessions</span>
              </div>
            </>
          )}

        </div>

        {/* Per-subject schedule */}
        <div className="mt-5">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary" /> Subject Schedule
          </h4>
          <div className="space-y-2">
            {enabledSlots.map(slot => {
              const endTime = minutesToTime(timeToMinutes(slot.start_time) + slot.duration_minutes);
              return (
                <div key={slot.subject} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">{slot.subject}</span>
                      {slot.teacher_name && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="h-3 w-3" /> {slot.teacher_name}
                          {slot.override_teacher && <Badge label="Changed" variant="warning" />}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{fmtTime12(slot.start_time)} – {fmtTime12(endTime)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {slot.days.length > 0 && (
                      <>
                        <span className="flex gap-1">
                          {slot.days.map(d => <span key={d} className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold">{d}</span>)}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span>{slot.duration_minutes}m total</span>
                    <span>·</span>
                    <span>{slot.teaching_minutes}m teaching</span>
                    <span>+</span>
                    <span>{slot.prep_buffer_minutes}m prep</span>
                  </div>
                  {slot.topic && (
                    <p className="mt-1 text-xs text-primary flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> {slot.topic}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Participants */}
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" /> Participants (auto-assigned)
          </h5>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { val: new Set(enabledSlots.filter(s => s.teacher_email).map(s => s.teacher_email)).size, label: 'Teachers' },
              { val: batch.student_count, label: 'Students' },
              { val: batch.coordinator_name ? 1 : 0, label: 'Coordinator' },
              { val: 'Auto', label: 'Parents' },
            ].map(p => (
              <div key={p.label} className="rounded-xl bg-white border border-gray-100 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">{p.val}</p>
                <p className="text-xs text-gray-400">{p.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2.5">LiveKit room &amp; join links are auto-generated when you start the session</p>

          {/* Student timezone distribution */}
          {tzGroups.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Student Timezones</p>
                <button type="button" onClick={() => setShowStudentTzPopup(true)}
                  className="text-[10px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md px-2 py-0.5 transition">
                  <Globe className="h-3 w-3" /> View all student times
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tzGroups.map(g => (
                  <div key={g.region} className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-100 px-2.5 py-1.5">
                    <span className="text-xs">{g.flag}</span>
                    <span className="text-[10px] font-medium text-gray-700">{g.region}</span>
                    <span className="text-[10px] text-gray-400">({g.tzLabel})</span>
                    <span className="text-[10px] font-bold text-primary">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm text-primary">
            <Zap className="h-4 w-4 inline-block mr-1.5 align-text-bottom" />
            {totalSessions > 1
              ? `${totalSessions} sessions will be created. Start each from the Sessions tab to generate LiveKit rooms.`
              : 'Once scheduled, start the session from the Sessions tab to generate LiveKit room & join links.'}
          </p>
        </div>
      </>
    );
  };

  // -- Full-screen step-by-step overlay --
  // Current reference time for the student timezone popup
  const refSlot = enabledSlots[0];
  const refTime = refSlot?.start_time || '09:00';
  const refEnd = refSlot ? minutesToTime(timeToMinutes(refSlot.start_time) + refSlot.duration_minutes) : '10:30';

  return (
    <>
    {/* Student Timezone Detail Popup */}
    {showStudentTzPopup && (
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowStudentTzPopup(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="h-4 w-4" /> Student Local Times
              </h3>
              <p className="text-blue-200 text-xs mt-0.5">{batchStudents.length} students · {refSlot ? `${refSlot.subject} ${fmtTime12(refTime)} IST` : 'No subjects set'}</p>
            </div>
            <button onClick={() => setShowStudentTzPopup(false)} className="text-blue-200 hover:text-white transition"><X className="h-5 w-5" /></button>
          </div>

          {/* Per-subject time tabs */}
          {enabledSlots.length > 1 && (
            <div className="px-5 pt-3 pb-1 border-b bg-gray-50 flex gap-2 overflow-x-auto">
              {enabledSlots.map(slot => {
                const end = minutesToTime(timeToMinutes(slot.start_time) + slot.duration_minutes);
                return (
                  <span key={slot.subject} className="shrink-0 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-[10px]">
                    <span className="font-bold text-gray-800">{slot.subject}</span>
                    <span className="text-gray-500 ml-1.5">{fmtTime12(slot.start_time)} – {fmtTime12(end)} IST</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Student list grouped by timezone */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {tzGroups.map(g => {
              const studentsInGroup = batchStudents.filter(s => (s.region || 'India') === g.region);
              return (
                <div key={g.region}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{g.flag}</span>
                    <span className="text-xs font-bold text-gray-800">{g.region}</span>
                    <span className="text-[10px] text-gray-400">({g.tzLabel})</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/5 rounded px-1.5 py-0.5">{g.count}</span>
                    <div className="flex-1 h-px bg-gray-200 ml-2" />
                  </div>
                  {/* Per-student rows */}
                  <div className="space-y-1 ml-1">
                    {studentsInGroup.map(st => (
                      <div key={st.email} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{st.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{st.email}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          {enabledSlots.map(slot => {
                            const end = minutesToTime(timeToMinutes(slot.start_time) + slot.duration_minutes);
                            const localStart = istToRegionTime(slot.start_time, st.region || 'India');
                            const localEnd = istToRegionTime(end, st.region || 'India');
                            return (
                              <p key={slot.subject} className="text-[10px] text-gray-600">
                                {enabledSlots.length > 1 && <span className="text-gray-400 mr-1">{slot.subject}:</span>}
                                <span className="font-medium">{localStart} – {localEnd}</span>
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {batchStudents.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">No students in this batch yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-[10px] text-gray-400">Times based on student region · IST is the reference timezone</p>
            <button onClick={() => setShowStudentTzPopup(false)}
              className="text-xs font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5 transition">
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Left sidebar */}
        <div className="w-60 bg-linear-to-b from-primary via-primary/90 to-secondary p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <Video className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Schedule Session</h2>
            <p className="text-primary/60 text-xs mt-1">Step {stepIdx + 1} of {SCHEDULE_STEPS.length}</p>
          </div>
          <div className="space-y-1 flex-1">
            {SCHEDULE_STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const StepIcon = step.icon;
              return (
                <button key={step.key} type="button" onClick={() => { if (idx < stepIdx) setStepIdx(idx); }}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all text-left ${
                    isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-primary/60 hover:bg-white/10 cursor-pointer' : 'text-primary/50 cursor-default'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-primary text-emerald-900' : isCurrent ? 'bg-white text-primary' : 'bg-primary/30 text-primary/80/70'
                  }`}>
                    {isDone ? '✓' : <StepIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium block">{step.label}</span>
                    <span className="text-[10px] opacity-70">{step.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="mt-4 text-primary/60 hover:text-white text-xs flex items-center gap-2 transition">
            <X className="h-3.5 w-3.5" /> Cancel &amp; Close
          </button>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
            {currentStep === 'batch' && renderBatchStep()}
            {currentStep === 'class' && renderClassStep()}
            {currentStep === 'schedule' && renderScheduleStep()}
            {currentStep === 'review' && renderReviewStep()}
          </div>
          <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
            <div>{stepIdx > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>}</div>
            <div className="flex items-center gap-3">
              {currentStep !== 'review' ? (
                <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">Continue</Button>
              ) : (
                <Button variant="primary" icon={PlusCircle} loading={submitting} disabled={submitting} onClick={handleSubmit} size="lg">
                  {(() => {
                    let total: number;
                    if (form.recurring && recurringDates.length > 0) {
                      total = 0;
                      const slots = slotsWithDays.length > 0 ? slotsWithDays : enabledSlots;
                      for (const slot of slots) {
                        total += recurringDates.filter(rd => slot.days.length === 0 || slot.days.includes(rd.day)).length;
                      }
                    } else {
                      total = enabledSlots.length;
                    }
                    return total > 1 ? `Schedule ${total} Sessions` : 'Schedule Session';
                  })()}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// --- Create Batch Wizard (same design as owner's) -----------
type WizardStep = 'template' | 'students' | 'details' | 'teachers' | 'review';

// Dynamic step order: 1:1 → students first; others → details first (to set grade filter)
function getWizardSteps(type: BatchType | ''): { key: WizardStep; label: string }[] {
  if (type === 'one_to_one') {
    return [
      { key: 'template', label: 'Template' },
      { key: 'students', label: 'Student' },
      { key: 'details', label: 'Details' },
      { key: 'teachers', label: 'Subjects & Teachers' },
      { key: 'review', label: 'Review' },
    ];
  }
  return [
    { key: 'template', label: 'Template' },
    { key: 'details', label: 'Details' },
    { key: 'students', label: 'Students' },
    { key: 'teachers', label: 'Subjects & Teachers' },
    { key: 'review', label: 'Review' },
  ];
}

function CreateBatchWizard({ batches, userRole, userEmail, onClose, onCreated }: {
  batches: Batch[];
  userRole: string;
  userEmail: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('template');
  const [creating, setCreating] = useState(false);

  // Academic settings
  const [SUBJECTS, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [GRADES, setGrades] = useState<string[]>(DEFAULT_GRADES);
  const [BOARDS] = useState<string[]>(DEFAULT_BOARDS);

  // Wizard form
  const [formType, setFormType] = useState<BatchType | ''>('');
  const [formName, setFormName] = useState('');
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formGrade, setFormGrade] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBoard, setFormBoard] = useState('');
  const [formCoordinator, setFormCoordinator] = useState('');
  const [formMaxStudents, setFormMaxStudents] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});
  const [selectedStudents, setSelectedStudents] = useState<{ email: string; name: string; parent_email: string | null; parent_name: string | null }[]>([]);

  // People
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [academicOperators, setAcademicOperators] = useState<Person[]>([]);
  const [formAO, setFormAO] = useState(userRole === 'academic_operator' ? userEmail : '');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserRole, setCreateUserRole] = useState('parent');
  const [parentForStudent, setParentForStudent] = useState('');

  const toast = useToast();

  // Fetch settings + people on mount
  useEffect(() => {
    fetch('/api/v1/academics/settings').then(r => r.json()).then(d => {
      if (d.success && d.data?.subjects?.length) setSubjects(d.data.subjects);
      if (d.success && d.data?.grades?.length) setGrades(d.data.grades);
    }).catch(() => {});
    // For owners: pre-fill the default AO
    if (userRole === 'owner') {
      fetch('/api/v1/owner/academic-operators').then(r => r.json()).then(d => {
        if (d.success && d.data?.defaultAO) setFormAO(d.data.defaultAO);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadPeople = async () => {
      setPeopleLoading(true);
      try {
        const fetches: Promise<Response>[] = [
          fetch('/api/v1/batches/people?role=student'),
          fetch('/api/v1/batches/people?role=teacher'),
          fetch('/api/v1/hr/users?role=batch_coordinator&limit=500'),
        ];
        if (userRole === 'owner') fetches.push(fetch('/api/v1/hr/users?role=academic_operator&limit=500'));
        const responses = await Promise.all(fetches.map(f => f.then(r => r.json())));
        const [studRes, teachRes, coordRes] = responses;
        if (studRes.success) setStudents(studRes.data.people);
        if (teachRes.success) setTeachers(teachRes.data.people);
        if (coordRes.success) setCoordinators(coordRes.data.users);
        if (userRole === 'owner' && responses[3]?.success) setAcademicOperators(responses[3].data.users);
      } catch { /* ignore */ }
      setPeopleLoading(false);
    };
    loadPeople();
  }, []);

  const wizardSteps = getWizardSteps(formType);
  const stepIdx = wizardSteps.findIndex(s => s.key === wizardStep);

  // Helpers — category-based section naming (A1, A2, B1, B2, etc.)
  const getSectionsForGradeCategory = (grade: string, category: string): string[] =>
    batches.filter(b => b.grade === grade && b.section && b.section.startsWith(category)).map(b => b.section as string);
  const getNextNumber = (grade: string, category: string): number => {
    const existing = getSectionsForGradeCategory(grade, category);
    const numbers = existing.map(s => parseInt(s.slice(category.length))).filter(n => !isNaN(n));
    return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  };
  const autoSection = (category: string, num: number) => category ? `${category}${num}` : '';
  const autoName = (grade: string, section: string) => {
    const prefix = BATCH_TYPE_LABELS[formType] || '';
    const tpl = BATCH_TEMPLATES.find(t => t.id === selectedTemplateId);
    // Prefer template's short label (e.g. 'PCBM (All 4)'); fall back to joined subjects
    const subjStr = tpl?.subjectLabel || (formSubjects.length > 0 ? formSubjects.join('+') : '');
    const subj = subjStr ? ` ${subjStr}` : '';
    const boardPart = formBoard ? ` ${formBoard}` : '';
    if (grade && section) return `${prefix}${subj} Class ${grade}${boardPart} ${section}`.trim();
    if (grade) return `${prefix}${subj} Class ${grade}${boardPart}`.trim();
    return '';
  };

  const handleGradeChange = (g: string) => {
    setFormGrade(g);
    const cat = formCategory || 'A';
    if (!formCategory) setFormCategory('A');
    const num = g ? getNextNumber(g, cat) : 0;
    const sec = g ? autoSection(cat, num) : '';
    setFormSection(sec);
    setFormName(autoName(g, sec));
    // Subjects are locked from template selection — do not auto-assign here
  };

  const handleCategoryChange = (cat: string) => {
    setFormCategory(cat);
    const num = formGrade ? getNextNumber(formGrade, cat) : 0;
    const sec = formGrade ? autoSection(cat, num) : '';
    setFormSection(sec);
    setFormName(autoName(formGrade, sec));
  };

  // 1:1 auto-fill: after selecting a student, populate grade/category/name from their profile
  useEffect(() => {
    if (formType !== 'one_to_one' || selectedStudents.length !== 1) return;
    const stu = students.find(s => s.email === selectedStudents[0].email);
    if (!stu) return;
    const stuGrade = (stu.grade || '').replace(/^Class\s+/i, '').trim();
    const stuCat = stu.category || 'A';
    if (stuGrade) setFormGrade(stuGrade);
    setFormCategory(stuCat);
    if (stu.board) setFormBoard(stu.board);
    const num = stuGrade ? getNextNumber(stuGrade, stuCat) : 1;
    const sec = stuGrade ? autoSection(stuCat, num) : '';
    setFormSection(sec);
    // Auto-generate batch name: "1:1 {Subject} Class 10 CBSE A1 — Student Name"
    const tpl = BATCH_TEMPLATES.find(t => t.id === selectedTemplateId);
    const subjLabel = tpl?.subjectLabel ? ` ${tpl.subjectLabel}` : '';
    const typeLabel = BATCH_TYPE_LABELS[formType] || '1:1';
    const boardLabel = stu.board ? ` ${stu.board}` : '';
    const base = stuGrade && sec ? `${typeLabel}${subjLabel} Class ${stuGrade}${boardLabel} ${sec}` : `${typeLabel}${subjLabel}`;
    setFormName(`${base} — ${selectedStudents[0].name}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formType, selectedStudents]);

  // Regenerate name when template (subject), board, or type changes (non-1:1)
  useEffect(() => {
    if (formType === 'one_to_one' || !formGrade) return;
    setFormName(autoName(formGrade, formSection));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, formBoard, formType]);

  const getMaxForType = (type: BatchType | ''): number => {
    if (!type) return 0;
    if (type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === type);
    return tpl?.maxStudents ?? 50;
  };

  const canProceedFromTemplate = selectedTemplateId !== '';
  const canProceedFromDetails = formName.trim() !== '' && formGrade !== '';
  const canProceedFromTeachers = formSubjects.length > 0;
  const canSubmit = formType !== '' && formName.trim() !== '' && formGrade !== '';

  // Student selection — filter by batch type, grade, category, region, search
  // normalizeGrade: students stored as 'Class 10', wizard grades are '10'
  const normalizeGrade = (g: string) => g.replace(/^Class\s+/i, '').trim();
  const filteredStudents = students.filter(s => {
    // Only show students enrolled for this batch type (if they have a paid enrollment link)
    if (formType && s.preferred_batch_type && s.preferred_batch_type !== formType) return false;
    // For 1:1, skip grade/category filter (student is selected first)
    if (formType !== 'one_to_one') {
      if (formGrade && normalizeGrade(s.grade || '') !== formGrade) return false;
      if (formCategory && s.category !== formCategory) return false;
    }
    if (regionFilter && (s.assigned_region || '') !== regionFilter) return false;
    // Hide students already enrolled in any active batch
    if ((s.current_batches ?? []).length > 0) return false;
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const isStudentSelected = (email: string) => selectedStudents.some(s => s.email === email);
  const maxReached = selectedStudents.length >= getMaxForType(formType);

  const toggleStudent = (person: Person) => {
    if (isStudentSelected(person.email)) {
      setSelectedStudents(prev => prev.filter(s => s.email !== person.email));
    } else {
      if (maxReached) { toast.error(`Max ${getMaxForType(formType)} students for this batch type.`); return; }
      // For 1:1 batches, auto-set grade + category from the selected student if not yet set
      if (formType === 'one_to_one' && person.grade) {
        const studentGrade = normalizeGrade(person.grade);
        if (!formGrade && studentGrade) handleGradeChange(studentGrade);
        if (!formCategory && person.category) handleCategoryChange(person.category);
      }
      setSelectedStudents(prev => [...prev, { email: person.email, name: person.full_name, parent_email: person.parent_email || null, parent_name: person.parent_name || null }]);
    }
  };

  const removeStudent = (email: string) => setSelectedStudents(prev => prev.filter(s => s.email !== email));

  const toggleSubject = (subj: string) => {
    setFormSubjects(prev => {
      if (prev.includes(subj)) {
        setSubjectTeachers(st => { const copy = { ...st }; delete copy[subj]; return copy; });
        return prev.filter(s => s !== subj);
      }
      return [...prev, subj];
    });
  };

  // Create parent
  const openCreateParent = (studentEmail: string) => { setParentForStudent(studentEmail); setCreateUserRole('parent'); setShowCreateUser(true); };
  const handleUserCreated = async (data?: { email: string; full_name: string; temp_password: string }) => {
    if (data && parentForStudent) {
      setSelectedStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      setStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      try {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(parentForStudent)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_email: data.email }),
        });
      } catch { /* ignore */ }
    }
  };

  // Submit
  const submitBatch = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const body = {
        batch_name: formName.trim(),
        batch_type: formType,
        subjects: formSubjects.length > 0 ? formSubjects : null,
        grade: formGrade || null,
        section: formSection || null,
        board: formBoard || null,
        coordinator_email: formCoordinator || null,
        academic_operator_email: formAO || null,
        max_students: formType === 'custom' ? (Number(formMaxStudents) || 50) : getMaxForType(formType),
        notes: formNotes || null,
        teachers: formSubjects.filter(s => subjectTeachers[s]).map(s => ({ email: subjectTeachers[s], subject: s })),
        students: selectedStudents.map(s => ({ email: s.email, parent_email: s.parent_email })),
      };
      const res = await fetch('/api/v1/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success('Batch created successfully!'); onCreated(); }
      else toast.error(json.error || 'Failed to create batch');
    } catch { toast.error('Failed to create batch'); }
    setCreating(false);
  };

  // Navigation
  const goNext = () => { if (stepIdx < wizardSteps.length - 1) setWizardStep(wizardSteps[stepIdx + 1].key); };
  const goPrev = () => { if (stepIdx > 0) setWizardStep(wizardSteps[stepIdx - 1].key); };
  const canGoNext = (): boolean => {
    if (wizardStep === 'template') return canProceedFromTemplate;
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'teachers') return canProceedFromTeachers;
    if (wizardStep === 'students') {
      // Per-class types (1:1, 1:3) require at least 1 student
      if (['one_to_one', 'one_to_three'].includes(formType)) return selectedStudents.length >= 1;
      return true; // Group types (1:15, 1:30, 1:M) allow 0 students — add later
    }
    return false;
  };

  // -- Step renderers --

  const renderTemplateStep = () => {
    const BATCH_TYPE_GROUPS = [
      { type: 'one_to_one',     title: '1:1 — Individual',   desc: '1 student · per-class fee · GCC & Kerala CBSE',           cols: 4 },
      { type: 'one_to_three',   title: '1:3 — Small Group',  desc: 'Up to 3 students · per-class fee · GCC & Kerala CBSE',    cols: 4 },
      { type: 'one_to_fifteen', title: '1:15 — Group Class', desc: 'Up to 15 students · monthly fee · GCC CBSE',              cols: 2 },
      { type: 'one_to_thirty',  title: '1:30 — Large Group', desc: 'Up to 30 students · monthly fee · Kerala CBSE',           cols: 2 },
      { type: 'one_to_many',    title: '1:M — Classroom',    desc: 'Unlimited students · monthly fee · Kerala State Board',   cols: 5 },
    ];
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Choose Batch Template</h3>
        <p className="text-gray-500 mb-6">Select a batch type and subject combination</p>
        <div className="space-y-5">
          {BATCH_TYPE_GROUPS.map(group => {
            const groupTemplates = BATCH_TEMPLATES.filter(t => t.type === group.type);
            return (
              <div key={group.type} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-gray-800">{group.title}</span>
                  <span className="text-xs text-gray-400">{group.desc}</span>
                </div>
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${group.cols}, minmax(0, 1fr))` }}>
                  {groupTemplates.map(tpl => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <button key={tpl.id} type="button"
                        onClick={() => {
                          const typeChanged = tpl.type !== formType;
                          setFormType(tpl.type);
                          setFormSubjects(tpl.subjects);
                          setSelectedTemplateId(tpl.id);
                          setSubjectTeachers({});
                          if (typeChanged) { setSelectedStudents([]); setFormName(''); }
                        }}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all hover:shadow-sm ${
                          isSelected ? tpl.selectedColor : `${tpl.color} hover:opacity-90`
                        }`}
                      >
                        {isSelected && <CheckCircle className="absolute top-2 right-2 h-3.5 w-3.5 opacity-70" />}
                        <p className="text-xs font-bold mb-2 pr-4 leading-tight">{tpl.subjectLabel}</p>
                        <div className="flex flex-wrap gap-0.5">
                          {tpl.subjects.map(s => (
                            <span key={s} className="text-[9px] px-1 py-0.5 rounded bg-white/50 font-medium leading-tight">{s.slice(0, 4)}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStudentsStep = () => {
    const max = getMaxForType(formType);
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Add Students</h3>
        <p className="text-gray-500 mb-6">
          {formGrade
            ? <>Grade <span className="font-semibold text-primary">{formGrade}</span>{formSection ? <> · {formSection}</> : ''} · <span className="font-semibold text-primary">{BATCH_TYPE_LABELS[formType] || formType}</span> students</>
            : <>Showing <span className="font-semibold text-primary">{BATCH_TYPE_LABELS[formType] || formType}</span> students</>}
          {['one_to_one', 'one_to_three'].includes(formType) && <span className="text-amber-600 text-xs ml-2">· At least 1 required</span>}
        </p>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-semibold text-primary">{selectedStudents.length}</span>
              <span className="text-xs text-primary ml-1">/ {max === 999 ? '∞' : max}</span>
            </div>
            <span className="text-sm text-gray-500">students selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={regionFilter} onChange={setRegionFilter} options={[
              { value: '', label: 'All Regions' },
              ...STUDENT_REGIONS.map(r => ({ value: r.value, label: r.label })),
            ]} className="w-44 text-xs!" />
            <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" className="w-72!" />
          </div>
        </div>

        {selectedStudents.length > 0 && (
          <div className="mb-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Students</h4>
            {selectedStudents.map(s => (
              <div key={s.email} className="rounded-xl border-2 border-primary/20 overflow-hidden">
                <div className="flex items-center justify-between bg-primary/5 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.parent_email ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                        <CheckCircle className="h-3.5 w-3.5" /> Parent: {s.parent_name || s.parent_email}
                      </span>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); openCreateParent(s.email); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-100 border-2 border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-200 transition-all cursor-pointer"
                      >
                        <AlertCircle className="h-4 w-4" /> No Parent — Click to Add
                      </button>
                    )}
                    <IconButton icon={X} onClick={() => removeStudent(s.email)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border rounded-xl max-h-72 overflow-y-auto">
          {peopleLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No students found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0"><tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Student</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Current Batch</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Region</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  const currentBatches: { batch_name: string }[] = Array.isArray(s.current_batches) ? s.current_batches : [];
                  return (
                    <tr key={s.email} className={`border-t hover:bg-primary/5/30 cursor-pointer transition-colors ${selected ? 'bg-primary/5/50' : ''}`} onClick={() => toggleStudent(s)}>
                      <td className="px-4 py-3"><p className="font-medium text-gray-800">{s.full_name}</p><p className="text-xs text-gray-400">{s.email}</p></td>
                      <td className="px-4 py-3 text-gray-500">{s.grade || '—'}</td>
                      <td className="px-4 py-3">{currentBatches.length > 0 ? <div className="flex flex-wrap gap-1">{currentBatches.map((b, i) => <span key={i} className="inline-block text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{b.batch_name}</span>)}</div> : <span className="text-xs text-gray-300">None</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.assigned_region || '—'}</td>
                      <td className="px-4 py-3">{s.parent_email ? <span className="text-xs text-primary">{s.parent_name || s.parent_email}</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded"><AlertCircle className="h-3 w-3" /> No parent</span>}</td>
                      <td className="px-4 py-3 text-right">{selected ? <span className="inline-flex items-center gap-1 text-xs text-primary font-medium"><CheckCircle className="h-3.5 w-3.5" /> Selected</span> : maxReached ? <span className="text-xs text-gray-300">Max reached</span> : <span className="text-xs text-gray-400 hover:text-primary">+ Add</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Batch Details</h3>
      <p className="text-gray-500 mb-8">Configure the basic information for this batch</p>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <FormField label="Grade" required>
            <Select value={formGrade} onChange={handleGradeChange}
              options={[{ value: '', label: 'Select Grade' }, ...GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]}
            />
          </FormField>
          <FormField label="Student Category" required>
            <Select value={formCategory} onChange={handleCategoryChange}
              options={[{ value: '', label: 'Select Category' }, ...DEFAULT_CATEGORIES.map(c => ({ value: c, label: `Category ${c}` }))]}
            />
          </FormField>
          <FormField label="Section (auto)">
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${formSection ? 'border-emerald-300 bg-primary/5' : 'border-gray-200 bg-gray-50'}`}>
              {formSection ? (
                <span className="text-lg font-bold text-primary">{formSection}</span>
              ) : <p className="text-sm text-gray-400">Select grade &amp; category</p>}
            </div>
          </FormField>
        </div>
        <FormField label="Batch Name" required>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Class 10 A1" />
        </FormField>
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Board">
            <Select value={formBoard} onChange={setFormBoard}
              options={[{ value: '', label: 'Select Board' }, ...BOARDS.map(b => ({ value: b, label: b }))]}
            />
          </FormField>
          <FormField label="Coordinator">
            <Select value={formCoordinator} onChange={setFormCoordinator}
              options={[
                { value: '', label: 'Select Coordinator' },
                ...coordinators.map(c => {
                  const bc = batches.filter(b => b.coordinator_email === c.email).length;
                  return { value: c.email, label: `${c.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        </div>
        {userRole === 'owner' && (
          <FormField label="Academic Operator">
            <Select value={formAO} onChange={setFormAO}
              options={[
                { value: '', label: 'Select Academic Operator' },
                ...academicOperators.map(ao => {
                  const bc = batches.filter(b => b.academic_operator_email === ao.email).length;
                  return { value: ao.email, label: `${ao.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        )}
        {formType === 'custom' && (
          <FormField label="Max Students">
            <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} placeholder="50" />
          </FormField>
        )}
        <FormField label="Notes">
          <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
        </FormField>
      </div>
    </div>
  );

  const renderTeachersStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Subjects &amp; Teachers</h3>
      <p className="text-gray-500 mb-8">Select subjects and assign a teacher to each one</p>
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Subjects <span className="text-xs font-normal text-primary ml-1">(locked from selected template)</span>
        </label>
        <div className="flex flex-wrap gap-2.5">
          {formSubjects.map(subj => (
            <div key={subj} className="px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-primary bg-primary/5 text-primary shadow-sm">
              <span className="mr-1.5">✓</span>{subj}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">{formSubjects.length} subject{formSubjects.length !== 1 ? 's' : ''} · assign a teacher to each below</p>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Assign Teachers <span className="ml-2 text-xs font-normal text-gray-400">{formSubjects.filter(s => subjectTeachers[s]).length} / {formSubjects.length} assigned</span>
          </label>
          <div className="space-y-3">
            {formSubjects.map(subj => {
              const assigned = !!subjectTeachers[subj];
              return (
                <div key={subj} className={`flex items-center gap-4 rounded-xl px-5 py-4 border-2 transition-all ${assigned ? 'border-primary/20 bg-primary/5/50' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${assigned ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-30"><span className="text-sm font-semibold text-gray-800">{subj}</span></div>
                  <div className="flex-1">
                    <TeacherPickerSelect
                      value={subjectTeachers[subj] || ''}
                      onChange={(val) => setSubjectTeachers(prev => ({ ...prev, [subj]: val }))}
                      teachers={teachers.filter(t => { const ts = t.subjects || []; return ts.length === 0 || ts.some(x => x.toLowerCase() === subj.toLowerCase()); })}
                    />
                  </div>
                  {assigned && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Review &amp; Create</h3>
        <p className="text-gray-500 mb-6">Confirm the batch details before creating</p>
      </div>
      <div className="bg-linear-to-r from-primary/5 to-secondary/5 rounded-xl p-5 border border-primary/15">
        <h4 className="text-sm font-bold text-primary mb-4">Batch Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{formName}</span></div>
          <div><span className="text-gray-400">Type:</span> <Badge label={batchTypeLabel(formType)} variant={batchTypeBadgeVariant(formType)} /></div>
          <div><span className="text-gray-400">Grade / Section:</span> <span className="font-medium text-gray-800">Grade {formGrade}{formSection ? ` ${formSection}` : ''}</span></div>
          <div><span className="text-gray-400">Board:</span> <span className="font-medium text-gray-800">{formBoard || '—'}</span></div>
          <div><span className="text-gray-400">Coordinator:</span> <span className="font-medium text-gray-800">{coordinators.find(c => c.email === formCoordinator)?.full_name || formCoordinator || '—'}</span></div>
          {userRole === 'owner' && <div><span className="text-gray-400">Academic Operator:</span> <span className="font-medium text-gray-800">{academicOperators.find(a => a.email === formAO)?.full_name || formAO || '—'}</span></div>}
          <div><span className="text-gray-400">Students:</span> <span className="font-medium text-gray-800">{selectedStudents.length}</span></div>
        </div>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subjects &amp; Teachers ({formSubjects.length})</h4>
          <div className="space-y-2">
            {formSubjects.map(subj => {
              const teacherEmail = subjectTeachers[subj];
              const teacher = teachers.find(t => t.email === teacherEmail);
              return (
                <div key={subj} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${teacher ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-gray-700 min-w-30">{subj}</span>
                  <span className="text-gray-300">→</span>
                  {teacher ? <span className="text-primary">{teacher.full_name}</span> : <span className="text-amber-500 italic">No teacher assigned</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedStudents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Enrolled Students ({selectedStudents.length})</h4>
          <div className="space-y-2">
            {selectedStudents.map(s => (
              <div key={s.email} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0).toUpperCase()}</div>
                <span className="font-semibold text-gray-700">{s.name}</span>
                <span className="text-gray-400 text-xs">{s.email}</span>
                {s.parent_email ? <span className="ml-auto text-xs text-primary">Parent: {s.parent_name || s.parent_email}</span> : <span className="ml-auto text-xs text-amber-500">No parent assigned</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {formNotes && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
          <p className="text-sm text-gray-600">{formNotes}</p>
        </div>
      )}
    </div>
  );

  // -- Wizard overlay --
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Left sidebar */}
          <div className="w-60 bg-linear-to-b from-primary via-primary/90 to-secondary p-6 flex flex-col shrink-0">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <Database className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg">New Batch</h2>
              <p className="text-primary/60 text-xs mt-1">Step {stepIdx + 1} of {wizardSteps.length}</p>
            </div>
            <div className="space-y-1 flex-1">
              {wizardSteps.map((step, idx) => {
                const isDone = idx < stepIdx;
                const isCurrent = idx === stepIdx;
                return (
                  <div key={step.key}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-primary/60' : 'text-primary/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isDone ? 'bg-primary text-emerald-900' : isCurrent ? 'bg-white text-primary' : 'bg-primary/30 text-primary/80/70'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={onClose} className="mt-4 text-primary/60 hover:text-white text-xs flex items-center gap-2 transition">
              <X className="h-3.5 w-3.5" /> Cancel &amp; Close
            </button>
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
              {wizardStep === 'template' && renderTemplateStep()}
              {wizardStep === 'students' && renderStudentsStep()}
              {wizardStep === 'details' && renderDetailsStep()}
              {wizardStep === 'teachers' && renderTeachersStep()}
              {wizardStep === 'review' && renderReviewStep()}
            </div>
            <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
              <div>{stepIdx > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>}</div>
              <div className="flex items-center gap-3">
                {wizardStep !== 'review' ? (
                  <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">Continue</Button>
                ) : (
                  <Button variant="primary" icon={CheckCircle} onClick={submitBatch} disabled={!canSubmit || creating} size="lg">
                    {creating ? 'Creating…' : 'Create Batch'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create User Modal (for parents) */}
      <CreateUserModal
        role={createUserRole}
        open={showCreateUser}
        onClose={() => { setShowCreateUser(false); setParentForStudent(''); }}
        onCreated={handleUserCreated}
      />
    </>
  );
}

/* ===============================================================
   AO MONITORING TAB
   =============================================================== */

const SEVERITY_STYLE: Record<string, { border: string; bg: string; text: string }> = {
  critical: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-600' },
  warning:  { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-600' },
  info:     { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600' },
};

function AOMonitoringTab({ alerts, loading, onRefresh }: {
  alerts: MonitoringAlertAO[]; loading: boolean; onRefresh: () => void;
}) {
  const [filterSev, setFilterSev] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const filtered = alerts
    .filter(a => filterSev === 'all' || a.severity === filterSev)
    .filter(a => filterType === 'all' || a.alert_type === filterType);

  const types = [...new Set(alerts.map(a => a.alert_type))];

  const dismissAlert = async (id: string) => {
    try {
      await fetch('/api/v1/monitoring/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', alert_id: id }),
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      {/* Alert counts */}
      <div className="grid grid-cols-3 gap-3">
        {(['critical', 'warning', 'info'] as const).map(sev => {
          const sty = SEVERITY_STYLE[sev];
          const count = alerts.filter(a => a.severity === sev).length;
          return (
            <div key={sev} className={`rounded-xl border ${sty.border} ${sty.bg} p-3`}>
              <div className="flex items-center justify-between">
                <AlertTriangle className={`h-4 w-4 ${sty.text}`} />
                <span className={`text-2xl font-bold ${sty.text}`}>{count}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 capitalize">{sev}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900">
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900">
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Alert list */}
      {loading && alerts.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="No active alerts — all sessions are running smoothly" />
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const sty = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info;
            return (
              <div key={alert.id} className={`rounded-xl border p-4 ${sty.border} ${sty.bg}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${sty.text}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${sty.text}`}>{alert.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${sty.text}`}>{alert.severity}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                      {alert.target_email && <span>{alert.target_email}</span>}
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => dismissAlert(alert.id)}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:text-gray-900 shrink-0">
                    <XCircle className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AO REQUESTS TAB — Session requests + Teacher/Coordinator leave
// NEW WORKFLOW: pending_ao → AO plans sessions → pending_hr → HR approves → approved → AO confirms → confirmed
// ═══════════════════════════════════════════════════════════════

interface AffectedSession {
  session_id: string;
  batch_id: string;
  subject: string;
  scheduled_date: string;
  start_time: string;
  batch_name: string;
  teacher_name: string;
  status: string;
  grade: string | null;
  board: string | null;
  duration_minutes: number;
}

interface LeaveAction {
  id: string;
  batch_session_id: string;
  action_type: string;
  substitute_teacher_email?: string;
  substitute_teacher_name?: string;
  new_date?: string;
  new_time?: string;
  acted_by: string;
  acted_by_name?: string;
  created_at: string;
}

interface AvailableTeacher {
  email: string;
  full_name: string;
  subjects: string[];
}

interface AISuggestion {
  freeTeachers: { email: string; name: string; inBatch: boolean; sameSubject: boolean; subjects: string[] }[];
  recommendation: string;
  sameSubjectCount: number;
  sessionSubject: string;
}

interface PlanItem {
  session_id: string;
  action: 'substitute' | 'reschedule' | 'cancel';
  substitute_email?: string;
  substitute_name?: string;
  new_date?: string;
  new_time?: string;
  notes?: string;
  subject_override?: string;
  original_subject?: string;
}

function AORequestsTab({ sessionRequests, leaveRequests, videoRequests, loadingRequests, loadingLeave, loadingVideo, onRefresh, toast }: {
  sessionRequests: AOSessionRequest[];
  leaveRequests: AOLeaveRequest[];
  videoRequests: VideoAccessRequestAO[];
  loadingRequests: boolean;
  loadingLeave: boolean;
  loadingVideo: boolean;
  onRefresh: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void };
}) {
  const [view, setView] = useState<'sessions' | 'leave' | 'video'>('sessions');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState<string | null>(null);
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // ── Manage / Plan Sessions state ──
  const [managingLeave, setManagingLeave] = useState<string | null>(null);
  const [affectedSessions, setAffectedSessions] = useState<AffectedSession[]>([]);
  const [leaveActions, setLeaveActions] = useState<LeaveAction[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestion>>({});
  const [loadingManage, setLoadingManage] = useState(false);
  const [sessionAction, setSessionAction] = useState<{ sessionId: string; type: 'substitute' | 'cancel' | 'reschedule' } | null>(null);
  const [substituteEmail, setSubstituteEmail] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const { confirm } = useConfirm();

  // ── Resolution plan (built locally before forwarding to HR) ──
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [forwardNotes, setForwardNotes] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [subjectOverride, setSubjectOverride] = useState('');

  // ── Video access request approve/reject ──
  const handleVideoAction = async (id: string, action: 'approve' | 'reject') => {
    setActionId(id);
    try {
      const res = await fetch('/api/v1/recording/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'approve' ? 'Access approved — student can now watch the recording' : 'Access denied');
        onRefresh();
      } else toast.error(data.error || 'Action failed');
    } catch { toast.error('Network error'); }
    finally { setActionId(null); }
  };

  // ── AO Forward to HR ──
  const handleForward = async (leaveId: string) => {
    const leave = leaveRequests.find(lr => lr.id === leaveId);
    if (!leave) return;
    const affCount = leave.affected_sessions?.length || 0;
    if (affCount > 0 && plan.length < affCount) {
      toast.error(`Plan all ${affCount} session(s) before forwarding`);
      return;
    }
    const ok = await confirm({
      title: 'Forward to HR',
      message: affCount > 0
        ? `Forward leave request with resolution plan for ${affCount} session(s) to HR for approval?`
        : `Forward leave request to HR for approval? (No sessions affected)`,
      confirmLabel: 'Forward to HR',
    });
    if (!ok) return;
    setForwarding(true);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ao_forward', request_id: leaveId, resolution_plan: plan, notes: forwardNotes || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Forwarded to HR');
        closeManageSessions();
        onRefresh();
      } else toast.error(data.error || 'Forward failed');
    } catch { toast.error('Network error'); }
    finally { setForwarding(false); }
  };

  // ── AO Reject ──
  const handleAOReject = async (leaveId: string, reason: string) => {
    setActionId(leaveId);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ao_reject', request_id: leaveId, notes: reason }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Leave rejected'); onRefresh(); setShowReject(null); setRejectReason(''); }
      else toast.error(data.error || 'Reject failed');
    } catch { toast.error('Network error'); }
    finally { setActionId(null); }
  };

  // ── AO Confirm (execute plan after HR approval) ──
  const handleConfirm = async (leaveId: string) => {
    const ok = await confirm({
      title: 'Execute Resolution Plan',
      message: 'Execute the resolution plan and confirm this leave? This will substitute teachers, reschedule, or cancel the affected sessions.',
      confirmLabel: 'Execute & Confirm',
    });
    if (!ok) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ao_confirm', request_id: leaveId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Leave confirmed — sessions managed');
        closeManageSessions();
        onRefresh();
      } else toast.error(data.error || 'Confirm failed');
    } catch { toast.error('Network error'); }
    finally { setConfirming(false); }
  };

  // ── Session request approve/reject (unchanged) ──
  const handleSessionAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setActionId(id);
    try {
      const body: Record<string, string> = { action, request_id: id, ...(reason ? { reason } : {}) };
      const res = await fetch('/api/v1/session-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { toast.success(`Request ${action}d`); onRefresh(); setShowReject(null); setRejectReason(''); }
      else toast.error(data.error || 'Action failed');
    } catch { toast.error('Network error'); }
    finally { setActionId(null); }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeaveIds.size === 0) return;
    const ok = await confirm({ title: 'Delete Leave Requests', message: `Delete ${selectedLeaveIds.size} leave request${selectedLeaveIds.size > 1 ? 's' : ''}? This action cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_ids: Array.from(selectedLeaveIds) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.data?.deleted || selectedLeaveIds.size} deleted`);
        setSelectedLeaveIds(new Set());
        onRefresh();
      } else toast.error(data.error || 'Delete failed');
    } catch { toast.error('Network error'); }
    finally { setDeleting(false); }
  };

  const toggleSelectLeave = (id: string) => {
    const s = new Set(selectedLeaveIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedLeaveIds(s);
  };
  const toggleSelectAll = () => {
    setSelectedLeaveIds(selectedLeaveIds.size === leaveRequests.length ? new Set() : new Set(leaveRequests.map(l => l.id)));
  };

  const openManageSessions = async (leaveId: string) => {
    setManagingLeave(leaveId);
    setLoadingManage(true);
    setPlan([]);
    setForwardNotes('');
    try {
      const res = await fetch(`/api/v1/teacher-leave?leave_id=${encodeURIComponent(leaveId)}`);
      const data = await res.json();
      if (data.success) {
        setAffectedSessions(data.data?.affectedSessions || []);
        setLeaveActions(data.data?.actions || []);
        setAvailableTeachers(data.data?.availableTeachers || []);
        setAiSuggestions(data.data?.aiSuggestions || {});
        // Pre-fill plan from saved resolution_plan if exists
        const leave = data.data?.leave;
        if (leave?.resolution_plan?.length > 0) {
          setPlan(leave.resolution_plan);
        }
      }
    } catch { toast.error('Failed to load session details'); }
    finally { setLoadingManage(false); }
  };

  const closeManageSessions = () => {
    setManagingLeave(null);
    setAffectedSessions([]);
    setLeaveActions([]);
    setAiSuggestions({});
    setSessionAction(null);
    setSubstituteEmail('');
    setRescheduleDate('');
    setRescheduleTime('');
    setActionNotes('');
    setPlan([]);
    setForwardNotes('');
    setSubjectOverride('');
  };

  // Add item to local plan
  const addToPlan = (item: PlanItem) => {
    setPlan(prev => [...prev.filter(p => p.session_id !== item.session_id), item]);
    setSessionAction(null);
    setSubstituteEmail('');
    setRescheduleDate('');
    setRescheduleTime('');
    setActionNotes('');
    setSubjectOverride('');
  };

  const removeFromPlan = (sessionId: string) => {
    setPlan(prev => prev.filter(p => p.session_id !== sessionId));
  };

  // ── PATCH: immediate per-session action (for approved state) ──
  const submitSessionAction = async () => {
    if (!sessionAction || !managingLeave) return;
    setSubmittingAction(true);
    try {
      const payload: Record<string, string> = {
        leave_request_id: managingLeave,
        session_id: sessionAction.sessionId,
        action_type: sessionAction.type,
      };
      if (sessionAction.type === 'substitute') payload.substitute_teacher_email = substituteEmail;
      if (sessionAction.type === 'reschedule') { payload.new_date = rescheduleDate; if (rescheduleTime) payload.new_time = rescheduleTime; }
      if (actionNotes) payload.notes = actionNotes;

      const res = await fetch('/api/v1/teacher-leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Session ${sessionAction.type === 'substitute' ? 'reassigned' : sessionAction.type === 'cancel' ? 'cancelled' : 'rescheduled'}`);
        setSessionAction(null); setSubstituteEmail(''); setRescheduleDate(''); setRescheduleTime(''); setActionNotes('');
        await openManageSessions(managingLeave);
        if (data.data?.allSessionsManaged) onRefresh();
      } else toast.error(data.error || 'Action failed');
    } catch { toast.error('Network error'); }
    finally { setSubmittingAction(false); }
  };

  // ── Computed stats ──
  const pendingSessionCount = sessionRequests.filter(r => r.status === 'pending').length;
  const approvedSessionCount = sessionRequests.filter(r => r.status === 'approved').length;
  const rejectedSessionCount = sessionRequests.filter(r => r.status === 'rejected').length;
  const pendingAOCount = leaveRequests.filter(r => r.status === 'pending_ao').length;
  const pendingHRCount = leaveRequests.filter(r => r.status === 'pending_hr').length;
  const approvedLeaveCount = leaveRequests.filter(r => r.status === 'approved').length;
  const confirmedLeaveCount = leaveRequests.filter(r => r.status === 'confirmed').length;
  const totalRequests = sessionRequests.length + leaveRequests.length;
  const totalPending = pendingSessionCount + pendingAOCount;

  // ═══════════════════════════════════════════════════════════
  // MANAGE SESSIONS PANEL — Plan builder (pending_ao) or execution view (approved)
  // ═══════════════════════════════════════════════════════════
  if (managingLeave) {
    const currentLeave = leaveRequests.find(lr => lr.id === managingLeave);
    const isPlanning = currentLeave?.status === 'pending_ao';
    const isApproved = currentLeave?.status === 'approved';
    const managedIds = new Set(leaveActions.map(a => a.batch_session_id));
    const plannedIds = new Set(plan.map(p => p.session_id));

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={closeManageSessions} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition">
            <ChevronLeft className="h-4 w-4" />Back to Requests
          </button>
        </div>

        <PageHeader icon={ClipboardList}
          title={isPlanning ? 'Plan Session Resolution' : isApproved ? 'Execute Resolution Plan' : 'Session Details'}
          subtitle={`${currentLeave?.teacher_name || currentLeave?.teacher_email} · ${currentLeave?.leave_type} leave · ${currentLeave?.start_date} to ${currentLeave?.end_date}`} />

        {loadingManage ? <LoadingState /> : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Layers} label="Total Affected" value={affectedSessions.length} variant="warning" />
              {isPlanning ? (
                <StatCard icon={ClipboardList} label="Planned" value={plan.length} variant={plan.length === affectedSessions.length ? 'success' : 'info'} />
              ) : (
                <StatCard icon={CheckCircle2} label="Executed" value={leaveActions.length} variant="success" />
              )}
              <StatCard icon={Clock} label="Remaining"
                value={isPlanning ? affectedSessions.length - plan.length : affectedSessions.length - leaveActions.length}
                variant={(isPlanning ? affectedSessions.length - plan.length : affectedSessions.length - leaveActions.length) > 0 ? 'danger' : 'default'} />
            </div>

            {/* ── PLANNING MODE (pending_ao) ── */}
            {isPlanning && (
              <>
                {affectedSessions.length === 0 && (
                  <Alert variant="success" message="No sessions affected by this leave. You can forward directly to HR." />
                )}

                {affectedSessions.map(s => {
                  const planned = plan.find(p => p.session_id === s.session_id);
                  const suggestion = aiSuggestions[s.session_id];
                  const sameSubjectTeachers = suggestion?.freeTeachers.filter(ft => ft.sameSubject) || [];
                  const otherTeachers = suggestion?.freeTeachers.filter(ft => !ft.sameSubject) || [];
                  const isActionOpen = sessionAction?.sessionId === s.session_id;
                  const isDiffSubject = isActionOpen && sessionAction?.type === 'substitute' && subjectOverride && subjectOverride.trim();
                  // Subjects of the currently selected substitute teacher (for the subject picker)
                  const selectedTeacherSubjects: string[] = isActionOpen && substituteEmail
                    ? Array.from(new Set(
                        (availableTeachers.find(t => t.email === substituteEmail)?.subjects
                          ?? suggestion?.freeTeachers.find(ft => ft.email === substituteEmail)?.subjects
                          ?? []
                        ).filter(sub => sub && sub.trim())
                      ))
                    : [];

                  return (
                    <div key={s.session_id} className={`rounded-xl border p-4 ${planned ? 'border-primary/30 bg-primary/5' : 'border-amber-200 bg-amber-50/50'}`}>
                      {/* Session header with grade, subject, batch */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {planned ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-amber-600" />}
                            <span className="text-sm font-bold text-gray-900">{s.subject}</span>
                            {s.grade && <Badge label={`Grade ${s.grade}`} variant="info" />}
                            <Badge label={s.batch_name} variant="secondary" />
                            {s.board && <span className="text-[10px] text-gray-400 font-medium uppercase">{s.board}</span>}
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(s.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                            {' at '}{s.start_time?.substring(0, 5)} · {s.duration_minutes || 90}min
                            {s.teacher_name && <span className="text-gray-400"> · {s.teacher_name}</span>}
                          </p>
                        </div>
                        {planned ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge label={planned.action === 'substitute' ? 'Substitute' : planned.action === 'reschedule' ? 'Reschedule' : 'Cancel'} variant={planned.action === 'substitute' ? 'info' : planned.action === 'cancel' ? 'danger' : 'warning'} />
                            {planned.substitute_name && <span className="text-xs text-blue-600">→ {planned.substitute_name}</span>}
                            {planned.subject_override && <span className="text-[10px] text-purple-600 font-medium">({planned.subject_override})</span>}
                            {planned.new_date && <span className="text-xs text-amber-600">→ {new Date(planned.new_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                            <button onClick={() => removeFromPlan(s.session_id)} className="text-xs text-red-500 hover:text-red-700">×</button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => { setSessionAction({ sessionId: s.session_id, type: 'substitute' }); setSubstituteEmail(''); setSubjectOverride(''); }}
                              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-blue-700 transition">
                              <UserPlus className="h-3 w-3" />Substitute
                            </button>
                            <button onClick={() => { setSessionAction({ sessionId: s.session_id, type: 'reschedule' }); setRescheduleDate(''); setRescheduleTime(''); }}
                              className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] text-white font-medium hover:bg-amber-700 transition">
                              <ArrowRightLeft className="h-3 w-3" />Reschedule
                            </button>
                            <button onClick={() => setSessionAction({ sessionId: s.session_id, type: 'cancel' })}
                              className="flex items-center gap-1 rounded-lg border border-red-600/50 px-2.5 py-1.5 text-[11px] text-red-600 font-medium hover:bg-red-50 transition">
                              <XCircle className="h-3 w-3" />Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* AI Suggestion — subject-aware */}
                      {!planned && suggestion && (
                        <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100 space-y-2">
                          <p className="text-xs font-medium text-blue-700">💡 AI Recommendation</p>
                          <p className="text-xs text-blue-600">{suggestion.recommendation}</p>

                          {/* Same-subject teachers */}
                          {sameSubjectTeachers.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-primary mb-1">
                                <Check className="h-3 w-3 inline" /> {s.subject} Teachers ({sameSubjectTeachers.length} free)
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {sameSubjectTeachers.slice(0, 6).map(ft => (
                                  <button key={ft.email}
                                    onClick={() => {
                                      setSessionAction({ sessionId: s.session_id, type: 'substitute' });
                                      setSubstituteEmail(ft.email);
                                      setSubjectOverride('');
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                                      ft.inBatch ? 'border-green-400 bg-primary/10 text-primary hover:bg-green-200 font-semibold' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    }`}>
                                    {ft.name}{ft.inBatch ? ' ★ batch' : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Other free teachers (different subjects) */}
                          {otherTeachers.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-500 mb-1">
                                Other Free Teachers ({otherTeachers.length}) — different subject
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {otherTeachers.slice(0, 5).map(ft => (
                                  <button key={ft.email}
                                    onClick={() => {
                                      setSessionAction({ sessionId: s.session_id, type: 'substitute' });
                                      setSubstituteEmail(ft.email);
                                      setSubjectOverride('');
                                    }}
                                    className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 transition">
                                    {ft.name} <span className="text-gray-400">({ft.subjects.length > 0 ? ft.subjects.join(', ') : '—'})</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No same-subject teacher warning */}
                          {suggestion.sameSubjectCount === 0 && suggestion.freeTeachers.length > 0 && (
                            <div className="p-2 rounded-md bg-amber-50 border border-amber-200">
                              <p className="text-[10px] text-amber-700 font-medium">
                                ⚠ No {s.subject} teacher available at this time. You can assign a different subject and pick a free teacher, or reschedule this session.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action form */}
                      {!planned && isActionOpen && (
                        <div className="mt-3 pt-3 border-t border-amber-200 space-y-3">
                          {sessionAction.type === 'substitute' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Select Substitute Teacher {isDiffSubject ? `(for ${subjectOverride.trim()})` : `(for ${s.subject})`}
                                </label>
                                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={substituteEmail}
                                  onChange={e => { setSubstituteEmail(e.target.value); setSubjectOverride(''); }}>
                                  <option value="">Choose teacher…</option>
                                  {/* Same-subject free teachers first */}
                                  {sameSubjectTeachers.length > 0 && !isDiffSubject && (
                                    <optgroup label={`${s.subject} Teachers (free)`}>
                                      {sameSubjectTeachers.map(ft => (
                                        <option key={ft.email} value={ft.email}>
                                          {ft.inBatch ? '★ ' : ''}{ft.name} ({ft.email}){ft.inBatch ? ' — in this batch' : ''}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {/* Other free teachers */}
                                  <optgroup label={isDiffSubject ? 'Free Teachers' : 'Other Subject Teachers (free)'}>
                                    {(isDiffSubject ? suggestion?.freeTeachers || [] : otherTeachers).map(ft => (
                                      <option key={ft.email} value={ft.email}>
                                        {ft.name} — {ft.subjects.length > 0 ? ft.subjects.join(', ') : 'subjects unspecified'}
                                      </option>
                                    ))}
                                  </optgroup>
                                  {/* All other teachers */}
                                  <optgroup label="All Other Teachers">
                                    {availableTeachers.filter(t => !suggestion?.freeTeachers.some(ft => ft.email === t.email)).map(t => (
                                      <option key={t.email} value={t.email}>
                                        {t.full_name} — {t.subjects.length > 0 ? t.subjects.join(', ') : 'subjects unspecified'} (may be busy)
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              </div>

                              {/* Subject for this session — dropdown from selected teacher's subjects */}
                              {substituteEmail && selectedTeacherSubjects.length > 0 && (
                                <div>
                                  <label className="block text-xs font-medium text-purple-700 mb-1">Subject for this Session</label>
                                  <select
                                    className="w-full rounded-lg border border-purple-300 bg-purple-50/50 px-3 py-2 text-sm"
                                    value={subjectOverride && subjectOverride.trim() ? subjectOverride.trim() : s.subject}
                                    onChange={e => setSubjectOverride(e.target.value === s.subject ? '' : e.target.value)}
                                  >
                                    <option value={s.subject}>{s.subject} — no change</option>
                                    {selectedTeacherSubjects
                                      .filter(sub => sub.toLowerCase() !== (s.subject || '').toLowerCase())
                                      .map(sub => <option key={sub} value={sub}>{sub}</option>)
                                    }
                                  </select>
                                </div>
                              )}

                              {/* Fallback: manual input when teacher has no known subjects */}
                              {substituteEmail && selectedTeacherSubjects.length === 0 && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setSubjectOverride(subjectOverride ? '' : ' ')}
                                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                                        subjectOverride ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium' : 'border-gray-300 text-gray-500 hover:border-purple-300 hover:bg-purple-50/50'
                                      }`}>
                                      <BookOpen className="h-3 w-3" />
                                      {subjectOverride && subjectOverride.trim() ? `Subject: ${subjectOverride.trim()}` : 'Change Subject'}
                                    </button>
                                  </div>
                                  {subjectOverride && (
                                    <div>
                                      <label className="block text-xs font-medium text-purple-700 mb-1">New Subject for this Session</label>
                                      <input className="w-full rounded-lg border border-purple-300 bg-purple-50/50 px-3 py-2 text-sm"
                                        placeholder="e.g. English, Science, Revision class…"
                                        value={subjectOverride} onChange={e => setSubjectOverride(e.target.value)} />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          {sessionAction.type === 'reschedule' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">New Date</label>
                                <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={rescheduleDate}
                                  onChange={e => setRescheduleDate(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">New Time (optional)</label>
                                <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={rescheduleTime}
                                  onChange={e => setRescheduleTime(e.target.value)} />
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Add a note…"
                              value={actionNotes} onChange={e => setActionNotes(e.target.value)} />
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={(sessionAction.type === 'substitute' && !substituteEmail) || (sessionAction.type === 'reschedule' && !rescheduleDate)}
                              onClick={() => {
                                const subTeacher = suggestion?.freeTeachers.find(ft => ft.email === substituteEmail) || availableTeachers.find(t => t.email === substituteEmail);
                                const overrideVal = sessionAction.type === 'substitute' && subjectOverride && subjectOverride.trim() && subjectOverride.trim() !== s.subject ? subjectOverride.trim() : undefined;
                                addToPlan({
                                  session_id: s.session_id,
                                  action: sessionAction.type,
                                  substitute_email: sessionAction.type === 'substitute' ? substituteEmail : undefined,
                                  substitute_name: sessionAction.type === 'substitute' ? (subTeacher && ('name' in subTeacher ? subTeacher.name : subTeacher.full_name)) || substituteEmail : undefined,
                                  new_date: sessionAction.type === 'reschedule' ? rescheduleDate : undefined,
                                  new_time: sessionAction.type === 'reschedule' && rescheduleTime ? rescheduleTime : undefined,
                                  notes: actionNotes || undefined,
                                  subject_override: overrideVal,
                                  original_subject: s.subject,
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-brand-green-dark disabled:opacity-50 transition">
                              Add to Plan
                            </button>
                            <button onClick={() => { setSessionAction(null); setSubjectOverride(''); }}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Forward to HR */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes for HR (optional)</label>
                    <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2}
                      placeholder="Any additional context for HR review…"
                      value={forwardNotes} onChange={e => setForwardNotes(e.target.value)} />
                  </div>
                  <div className="flex gap-3">
                    <button
                      disabled={forwarding || (affectedSessions.length > 0 && plan.length < affectedSessions.length)}
                      onClick={() => handleForward(managingLeave)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-brand-green-dark disabled:opacity-50 transition">
                      {forwarding ? 'Forwarding…' : `Forward to HR${affectedSessions.length > 0 ? ` (${plan.length}/${affectedSessions.length} planned)` : ''}`}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── APPROVED MODE (HR approved, AO executes) ── */}
            {isApproved && (
              <>
                {/* Show the saved resolution plan */}
                {currentLeave?.resolution_plan?.length ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">Resolution Plan (approved by HR)</h3>
                    {currentLeave.resolution_plan.map(item => {
                      const sess = affectedSessions.find(s => s.session_id === item.session_id);
                      const executed = leaveActions.some(a => a.batch_session_id === item.session_id);
                      return (
                        <div key={item.session_id} className={`rounded-xl border p-3 ${executed ? 'border-primary/20 bg-primary/5/30' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {executed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-gray-400" />}
                              <span className="text-sm font-medium">{item.subject_override || item.original_subject || sess?.subject || item.session_id}</span>
                              {item.subject_override && item.original_subject && item.subject_override !== item.original_subject && (
                                <span className="text-[10px] text-purple-500 line-through">{item.original_subject}</span>
                              )}
                              {sess?.grade && <Badge label={`Grade ${sess.grade}`} variant="info" />}
                              {sess && <Badge label={sess.batch_name} variant="secondary" />}
                              {sess && <span className="text-xs text-gray-500">{new Date(sess.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge label={item.action === 'substitute' ? 'Substitute' : item.action === 'reschedule' ? 'Reschedule' : 'Cancel'} variant={item.action === 'substitute' ? 'info' : item.action === 'cancel' ? 'danger' : 'warning'} />
                              {item.substitute_name && <span className="text-xs text-blue-600">→ {item.substitute_name}</span>}
                              {item.new_date && <span className="text-xs text-amber-600">→ {new Date(item.new_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                              {executed && <span className="text-[10px] text-primary font-medium"><Check className="h-3 w-3 inline" /> Done</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {currentLeave?.hr_notes && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-600">HR Notes:</p>
                    <p className="text-sm text-gray-800">{currentLeave.hr_notes}</p>
                  </div>
                )}

                {/* Confirm button */}
                {leaveActions.length < affectedSessions.length && (
                  <button
                    disabled={confirming}
                    onClick={() => handleConfirm(managingLeave)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-brand-green-dark disabled:opacity-50 transition">
                    {confirming ? 'Executing…' : `Execute Plan & Confirm Leave (${affectedSessions.length} sessions)`}
                  </button>
                )}

                {leaveActions.length >= affectedSessions.length && affectedSessions.length > 0 && (
                  <Alert variant="success" message="All sessions managed. Leave confirmed." />
                )}
              </>
            )}

            {/* ── VIEW MODE (confirmed, rejected, pending_hr) ── */}
            {!isPlanning && !isApproved && (
              <>
                {leaveActions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-500">Session Actions</h3>
                    {affectedSessions.map(s => {
                      const action = leaveActions.find(a => a.batch_session_id === s.session_id);
                      const planItem = currentLeave?.resolution_plan?.find(p => p.session_id === s.session_id);
                      const displaySubject = planItem?.subject_override || planItem?.original_subject || s.subject;
                      const hadSubjectChange = planItem?.subject_override && planItem?.original_subject && planItem.subject_override !== planItem.original_subject;
                      return (
                        <div key={s.session_id} className="rounded-xl border border-primary/20 bg-primary/5/30 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{displaySubject}</span>
                              {hadSubjectChange && (
                                <span className="text-[10px] text-purple-500 line-through">{planItem.original_subject}</span>
                              )}
                              {s.grade && <Badge label={`Grade ${s.grade}`} variant="info" />}
                              <Badge label={s.batch_name} variant="secondary" />
                              <span className="text-xs text-gray-500">{new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge label={action?.action_type === 'substitute' ? 'Substitute' : action?.action_type === 'reschedule' ? 'Reschedule' : action?.action_type === 'cancel' ? 'Cancel' : action?.action_type || 'planned'} variant={
                                action?.action_type === 'substitute' ? 'info' : action?.action_type === 'cancel' ? 'danger' : 'warning'
                              } />
                              {action?.substitute_teacher_name && <span className="text-xs text-blue-600">→ {action.substitute_teacher_name}</span>}
                              {action?.new_date && <span className="text-xs text-amber-600">→ {new Date(action.new_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(currentLeave?.resolution_plan?.length ?? 0) > 0 && leaveActions.length === 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-500">Resolution Plan (pending execution)</h3>
                    {currentLeave!.resolution_plan.map(item => {
                      const sess = affectedSessions.find(s => s.session_id === item.session_id);
                      return (
                        <div key={item.session_id} className="rounded-xl border border-gray-200 bg-white p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium">{item.subject_override || item.original_subject || sess?.subject || item.session_id}</span>
                              {item.subject_override && item.original_subject && item.subject_override !== item.original_subject && (
                                <span className="text-[10px] text-purple-500 line-through">{item.original_subject}</span>
                              )}
                              {sess?.grade && <Badge label={`Grade ${sess.grade}`} variant="info" />}
                              {sess && <Badge label={sess.batch_name} variant="secondary" />}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge label={item.action === 'substitute' ? 'Substitute' : item.action === 'reschedule' ? 'Reschedule' : 'Cancel'} variant={item.action === 'substitute' ? 'info' : item.action === 'cancel' ? 'danger' : 'warning'} />
                              {item.substitute_name && <span className="text-xs text-blue-600">→ {item.substitute_name}</span>}
                              {item.new_date && <span className="text-xs text-amber-600">→ {new Date(item.new_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN LIST VIEW
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      <PageHeader icon={ClipboardList} title="Requests" subtitle={`${totalPending} pending · ${totalRequests} total`}>
        <RefreshButton loading={loadingRequests || loadingLeave} onClick={onRefresh} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Layers} label="Total Requests" value={totalRequests} variant="default" />
        <StatCard icon={Clock} label="Pending AO" value={pendingAOCount} variant={pendingAOCount > 0 ? 'warning' : 'default'} />
        <StatCard icon={Briefcase} label="Pending HR" value={pendingHRCount} variant={pendingHRCount > 0 ? 'info' : 'default'} />
        <StatCard icon={CheckCircle2} label="Confirmed" value={confirmedLeaveCount} variant="success" />
        <StatCard icon={Briefcase} label="Leave Total" value={leaveRequests.length} variant="default" />
      </div>

      {approvedLeaveCount > 0 && (
        <Alert variant="warning" message={`${approvedLeaveCount} leave request${approvedLeaveCount > 1 ? 's' : ''} approved by HR — pending your confirmation to execute session plans.`} />
      )}

      <div className="flex gap-2">
        <button onClick={() => setView('sessions')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
          ${view === 'sessions' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
          <CalendarClock className="h-4 w-4" />Session Requests{pendingSessionCount > 0 && <Badge label={String(pendingSessionCount)} variant="warning" />}
        </button>
        <button onClick={() => setView('leave')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
          ${view === 'leave' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
          <Briefcase className="h-4 w-4" />Leave Requests
          {(pendingAOCount > 0 || approvedLeaveCount > 0) && (
            <Badge label={String(pendingAOCount + approvedLeaveCount)} variant="warning" />
          )}
        </button>
        <button onClick={() => setView('video')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
          ${view === 'video' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
          <Video className="h-4 w-4" />Video Requests
          {videoRequests.filter(v => v.status === 'pending').length > 0 && (
            <Badge label={String(videoRequests.filter(v => v.status === 'pending').length)} variant="warning" />
          )}
        </button>
      </div>

      {view === 'sessions' && (
        (loadingRequests ? <LoadingState /> : sessionRequests.length === 0 ? (
          <EmptyState icon={CalendarClock} message="No session requests" />
        ) : (
          <div className="space-y-3">
            {sessionRequests.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                      ${r.request_type === 'cancel' ? 'bg-red-100' : 'bg-blue-100'}`}>
                      {r.request_type === 'cancel'
                        ? <Ban className="h-4.5 w-4.5 text-red-600" />
                        : <CalendarClock className="h-4.5 w-4.5 text-blue-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold">{r.request_type === 'cancel' ? 'Cancel' : 'Reschedule'} Request</span>
                        <StatusBadge status={r.status} />
                        <Badge label={r.requester_role} variant={
                          r.requester_role === 'teacher' ? 'info' :
                          r.requester_role === 'batch_coordinator' ? 'warning' : 'secondary'
                        } />
                      </div>
                      <p className="text-xs text-gray-500">
                        By <span className="font-medium">{r.requester_name || r.requester_email}</span>
                        {r.batch_name && ` · ${r.batch_name}`}
                        {r.subject && ` · ${r.subject}`}
                        {r.session_date && ` · ${new Date(r.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                      </p>
                      {r.proposed_date && <p className="text-xs text-blue-500 mt-0.5">Proposed: {r.proposed_date}{r.proposed_time ? ` at ${r.proposed_time}` : ''}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejected: {r.rejection_reason}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button disabled={actionId === r.id} onClick={() => handleSessionAction(r.id, 'approve')}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] text-white font-medium hover:bg-green-700 disabled:opacity-50 transition">
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </button>
                        {showReject === r.id ? (
                          <div className="flex items-center gap-1">
                            <input placeholder="Reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                              className="w-32 rounded border border-gray-200 bg-white px-2 py-1 text-[11px]" />
                            <button disabled={actionId === r.id || !rejectReason} onClick={() => handleSessionAction(r.id, 'reject', rejectReason)}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] text-white font-medium hover:bg-red-700 disabled:opacity-50">Go</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowReject(r.id)}
                            className="flex items-center gap-1 rounded-lg border border-red-600/50 px-2.5 py-1 text-[11px] text-red-500 font-medium hover:bg-red-50 transition">
                            <XCircle className="h-3 w-3" />Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {view === 'leave' && (
        (loadingLeave ? <LoadingState /> : leaveRequests.length === 0 ? (
          <EmptyState icon={Briefcase} message="No leave requests" />
        ) : (
          <div className="space-y-3">
            {/* Selection toolbar */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selectedLeaveIds.size === leaveRequests.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-gray-700">
                  {selectedLeaveIds.size > 0 ? `${selectedLeaveIds.size} selected` : 'Select all'}
                </span>
              </div>
              {selectedLeaveIds.size > 0 && (
                <button disabled={deleting} onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition">
                  <XCircle className="h-3.5 w-3.5" />
                  {deleting ? 'Deleting…' : `Delete ${selectedLeaveIds.size}`}
                </button>
              )}
            </div>

            {leaveRequests.map(lr => {
              const getStatusConfig = () => {
                switch (lr.status) {
                  case 'pending_ao': return { border: 'border-amber-300', bg: 'bg-amber-50/30', label: 'Pending Your Review', color: 'text-amber-700' };
                  case 'pending_hr': return { border: 'border-blue-200', bg: 'bg-blue-50/20', label: 'Forwarded to HR', color: 'text-blue-600' };
                  case 'approved': return { border: 'border-emerald-300', bg: 'bg-primary/5/30', label: 'HR Approved — Sessions Managed', color: 'text-primary' };
                  case 'confirmed': return { border: 'border-primary/20', bg: 'bg-primary/5/20', label: 'Confirmed', color: 'text-primary' };
                  case 'rejected': return { border: 'border-red-200', bg: 'bg-red-50/20', label: 'Rejected', color: 'text-red-500' };
                  case 'withdrawn': return { border: 'border-gray-200', bg: 'bg-gray-50/20', label: 'Withdrawn', color: 'text-gray-500' };
                  default: return { border: 'border-gray-200', bg: 'bg-white', label: lr.status, color: 'text-gray-500' };
                }
              };
              const sc = getStatusConfig();

              return (
                <div key={lr.id} className={`rounded-xl border p-4 ${sc.border} ${sc.bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input type="checkbox" checked={selectedLeaveIds.has(lr.id)}
                        onChange={() => toggleSelectLeave(lr.id)}
                        className="mt-2.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                        <Briefcase className="h-4.5 w-4.5 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold">{lr.teacher_name || lr.teacher_email}</span>
                          <Badge label={lr.leave_type} variant="secondary" />
                          <StatusBadge status={lr.status} />
                          {lr.requester_role === 'batch_coordinator' && <Badge label="Coordinator" variant="info" />}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(lr.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(lr.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {lr.affected_sessions?.length > 0 && ` · ${lr.affected_sessions.length} sessions affected`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{lr.reason}</p>
                        {lr.medical_certificate_url && (
                          <a href={lr.medical_certificate_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800">
                            <FileText className="h-3 w-3" /> Medical Certificate
                          </a>
                        )}
                        <p className={`text-[10px] mt-1 font-medium ${sc.color}`}>{sc.label}</p>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <p className="text-[10px] text-gray-500">{new Date(lr.created_at).toLocaleDateString('en-IN')}</p>

                      {/* pending_ao: Review & Plan / Reject */}
                      {lr.status === 'pending_ao' && (
                        <div className="flex flex-col gap-1.5">
                          <button onClick={() => openManageSessions(lr.id)}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] text-white font-medium hover:bg-blue-700 transition">
                            <ClipboardList className="h-3 w-3" />{(lr.affected_sessions?.length || 0) > 0 ? 'Review & Plan' : 'Review & Forward'}
                          </button>
                          {showReject === lr.id ? (
                            <div className="flex items-center gap-1">
                              <input placeholder="Reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                className="w-32 rounded border border-gray-200 bg-white px-2 py-1 text-[11px]" />
                              <button disabled={actionId === lr.id || !rejectReason} onClick={() => handleAOReject(lr.id, rejectReason)}
                                className="rounded bg-red-600 px-2 py-1 text-[11px] text-white font-medium hover:bg-red-700 disabled:opacity-50">Go</button>
                            </div>
                          ) : (
                            <button onClick={() => setShowReject(lr.id)}
                              className="flex items-center gap-1 rounded-lg border border-red-600/50 px-2.5 py-1 text-[11px] text-red-500 font-medium hover:bg-red-50 transition">
                              <XCircle className="h-3 w-3" />Reject
                            </button>
                          )}
                        </div>
                      )}

                      {/* approved: View details (sessions auto-managed on HR approval) */}
                      {lr.status === 'approved' && (lr.affected_sessions?.length || 0) > 0 && (
                        <button onClick={() => openManageSessions(lr.id)}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] text-gray-600 font-medium hover:bg-gray-50 transition">
                          <Eye className="h-3 w-3" />View Details
                        </button>
                      )}

                      {/* pending_hr / confirmed: View details */}
                      {['pending_hr', 'confirmed'].includes(lr.status) && (lr.affected_sessions?.length || 0) > 0 && (
                        <button onClick={() => openManageSessions(lr.id)}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] text-gray-600 font-medium hover:bg-gray-50 transition">
                          <Eye className="h-3 w-3" />View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {view === 'video' && (
        loadingVideo ? <LoadingState /> : videoRequests.length === 0 ? (
          <EmptyState icon={Video} message="No video access requests" />
        ) : (
          <div className="space-y-3">
            {videoRequests.map(vr => (
              <div key={vr.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                      <Video className="h-4.5 w-4.5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold">Recording Access</span>
                        <StatusBadge status={vr.status} />
                      </div>
                      <p className="text-xs text-gray-500">
                        By <span className="font-medium">{vr.student_name || vr.student_email}</span>
                        {vr.room_name && ` · ${vr.room_name}`}
                        {vr.subject && ` · ${vr.subject}`}
                        {vr.grade && ` · Grade ${vr.grade}`}
                      </p>
                      {vr.teacher_name && <p className="text-xs text-gray-400 mt-0.5">Teacher: {vr.teacher_name}</p>}
                      {vr.scheduled_start && <p className="text-xs text-gray-400">{new Date(vr.scheduled_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                      {vr.reason && <p className="text-xs text-gray-400 mt-0.5">{vr.reason}</p>}
                      {vr.review_notes && <p className="text-xs text-gray-500 mt-1 italic">Note: {vr.review_notes}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[10px] text-gray-500">{new Date(vr.created_at).toLocaleDateString('en-IN')}</p>
                    {vr.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button disabled={actionId === vr.id} onClick={() => handleVideoAction(vr.id, 'approve')}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] text-white font-medium hover:bg-green-700 disabled:opacity-50 transition">
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </button>
                        <button disabled={actionId === vr.id} onClick={() => handleVideoAction(vr.id, 'reject')}
                          className="flex items-center gap-1 rounded-lg border border-red-600/50 px-2.5 py-1 text-[11px] text-red-500 font-medium hover:bg-red-50 disabled:opacity-50 transition">
                          <XCircle className="h-3 w-3" />Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AOPaymentsTab — Complete student payment workflow overview
// ─────────────────────────────────────────────────────────────

interface PaymentSummary {
  total_invoices: number;
  total_invoiced_paise: number;
  total_paid_paise: number;
  total_pending_paise: number;
  total_overdue_paise: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  cancelled_count: number;
  collected_30d: number;
}

interface PaymentInvoice {
  id: string;
  invoice_number: string;
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  description: string | null;
  billing_period: string | null;
  period_start: string | null;
  period_end: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
}

interface StudentPaymentSummary {
  student_email: string;
  student_name: string | null;
  total_invoices: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  overdue_count: number;
  pending_count: number;
  paid_count: number;
}

interface PaymentReceipt {
  receipt_number: string;
  invoice_id: string | null;
  student_email: string;
  student_name: string | null;
  amount_paise: number;
  currency: string;
  payment_method: string | null;
  paid_at: string;
  invoice_number: string | null;
  description: string | null;
}

interface RefundRequest {
  id: string;
  student_email: string;
  student_name: string;
  batch_session_id: string;
  invoice_id: string;
  session_payment_id: string | null;
  request_type: 'refund' | 'reschedule';
  amount_paise: number;
  currency: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  subject: string;
  scheduled_date: string;
  start_time: string;
  teacher_name: string | null;
  batch_name: string;
  grade: string | null;
  section: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  qr_code_url: string | null;
}

function fmtMoney(paise: number, currency = 'INR') {
  const amount = paise / 100;
  const symbols: Record<string, string> = { INR: '₹', AED: 'د.إ', USD: '$', SAR: '﷼', QAR: 'QR', KWD: 'KD', OMR: 'OMR', BHD: 'BHD' };
  const sym = symbols[currency] ?? currency;
  return `${sym}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function invoiceStatusColor(status: string) {
  if (status === 'paid') return 'bg-primary/10 text-primary';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  if (status === 'overdue') return 'bg-red-100 text-red-700';
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500';
  return 'bg-gray-100 text-gray-600';
}

function AOPaymentsTab() {
  const [view, setView] = useState<'overview' | 'invoices' | 'students' | 'receipts' | 'refunds'>('overview');
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [studentSummary, setStudentSummary] = useState<StudentPaymentSummary[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [refundStatusFilter, setRefundStatusFilter] = useState('pending');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsRes, refundsRes] = await Promise.all([
        fetch('/api/v1/academic-operator/payments'),
        fetch('/api/v1/academic-operator/refund-requests'),
      ]);
      const data = await paymentsRes.json();
      const refundsData = await refundsRes.json();
      if (data.success) {
        setSummary(data.data.summary);
        setInvoices(data.data.invoices);
        setStudentSummary(data.data.studentSummary);
        setReceipts(data.data.receipts);
      }
      if (refundsData.success) {
        setRefundRequests(refundsData.data);
      }
    } catch (err) {
      console.error('[AOPayments] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefundAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/v1/academic-operator/refund-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, review_notes: reviewNotes[id] || '' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      } else {
        alert(data.error || 'Action failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = !search || [inv.student_name, inv.student_email, inv.invoice_number, inv.description]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Filtered students
  const filteredStudents = studentSummary.filter(s => {
    if (!search) return true;
    return [s.student_name, s.student_email].some(v => v?.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Payment Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Invoice and payment status across all enrolled students</p>
        </div>
        <RefreshButton loading={loading} onClick={fetchData} />
      </div>

      {/* ── KPI CARDS ───────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: 'Total Invoiced',
              value: fmtMoney(summary.total_invoiced_paise),
              sub: `${summary.total_invoices} invoice${summary.total_invoices !== 1 ? 's' : ''}`,
              border: 'border-l-blue-500',
              icon: <FileText className="h-4 w-4 text-blue-500" />,
            },
            {
              label: 'Collected',
              value: fmtMoney(summary.total_paid_paise),
              sub: `${summary.paid_count} paid`,
              border: 'border-l-emerald-500',
              icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
            },
            {
              label: 'Pending',
              value: fmtMoney(summary.total_pending_paise),
              sub: `${summary.pending_count} invoice${summary.pending_count !== 1 ? 's' : ''}`,
              border: 'border-l-amber-500',
              icon: <Clock className="h-4 w-4 text-amber-500" />,
            },
            {
              label: 'Overdue',
              value: fmtMoney(summary.total_overdue_paise),
              sub: `${summary.overdue_count} invoice${summary.overdue_count !== 1 ? 's' : ''}`,
              border: summary.overdue_count > 0 ? 'border-l-red-500' : 'border-l-gray-300',
              icon: <AlertCircle className="h-4 w-4 text-red-500" />,
            },
            {
              label: 'Last 30 Days',
              value: fmtMoney(summary.collected_30d),
              sub: 'collected',
              border: 'border-l-violet-500',
              icon: <TrendingUp className="h-4 w-4 text-violet-500" />,
            },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border border-gray-200 bg-white border-l-4 ${card.border} px-4 py-3.5 shadow-sm`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
                {card.icon}
              </div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── OVERDUE ALERT BANNER ────────────────────────────────── */}
      {summary && summary.overdue_count > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{summary.overdue_count} overdue invoice{summary.overdue_count > 1 ? 's' : ''}</span>
            {' '}totalling <span className="font-semibold">{fmtMoney(summary.total_overdue_paise)}</span> — please send payment reminders.
          </p>
        </div>
      )}

      {/* ── NAV TABS ────────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {([
            { key: 'overview',  label: 'Overview',                           icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
            { key: 'invoices',  label: `Invoices`,  count: invoices.length,  icon: <FileText className="h-3.5 w-3.5" /> },
            { key: 'students',  label: `Students`,  count: studentSummary.length, icon: <Users className="h-3.5 w-3.5" /> },
            { key: 'receipts',  label: `Receipts`,  count: receipts.length,  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
            // { key: 'refunds',   label: `Refund Requests`, count: refundRequests.filter(r => r.status === 'pending').length, icon: <RefreshCw className="h-3.5 w-3.5" /> },
          ] as { key: typeof view; label: string; count?: number; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                view === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  view === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search + filter bar (invoices / students only) */}
      {(view === 'invoices' || view === 'students') && (
        <div className="flex gap-3 flex-wrap">
          <SearchInput placeholder={view === 'invoices' ? 'Search by student, invoice #, description…' : 'Search student…'} value={search} onChange={setSearch} className="flex-1 min-w-[200px] max-w-sm" />
          {view === 'invoices' && (
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'paid', label: 'Paid' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          )}
        </div>
      )}

      {view === 'refunds' && (
        <div className="flex gap-3 flex-wrap">
          <SearchInput placeholder="Search by student name or email…" value={search} onChange={setSearch} className="flex-1 min-w-[200px] max-w-sm" />
          <FilterSelect
            value={refundStatusFilter}
            onChange={setRefundStatusFilter}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
      )}

      {/* ── LOADING ─────────────────────────────────────────────── */}
      {loading && <LoadingState />}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* OVERVIEW                                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!loading && view === 'overview' && (
        <div className="space-y-5">

          {/* Row 1: Collection progress + Status distribution */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* Collection health */}
            {summary && (() => {
              const collPct = summary.total_invoiced_paise > 0
                ? Math.round((summary.total_paid_paise / summary.total_invoiced_paise) * 100)
                : 0;
              const pendPct = summary.total_invoiced_paise > 0
                ? Math.round((summary.total_pending_paise / summary.total_invoiced_paise) * 100)
                : 0;
              const overPct = summary.total_invoiced_paise > 0
                ? Math.round((summary.total_overdue_paise / summary.total_invoiced_paise) * 100)
                : 0;
              return (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Collection Health</p>

                  {/* Stacked progress bar */}
                  <div className="mb-5">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xl font-bold text-gray-900">{collPct}%</span>
                      <span className="text-xs text-gray-400">of total collected</span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="bg-primary h-full transition-all" style={{ width: `${collPct}%` }} title={`Collected ${collPct}%`} />
                      <div className="bg-amber-400 h-full transition-all" style={{ width: `${pendPct}%` }} title={`Pending ${pendPct}%`} />
                      <div className="bg-red-400 h-full transition-all" style={{ width: `${overPct}%` }} title={`Overdue ${overPct}%`} />
                    </div>
                  </div>

                  {/* Legend rows */}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Collected', paise: summary.total_paid_paise, pct: collPct, dot: 'bg-primary' },
                      { label: 'Pending',   paise: summary.total_pending_paise, pct: pendPct, dot: 'bg-amber-400' },
                      { label: 'Overdue',   paise: summary.total_overdue_paise, pct: overPct, dot: 'bg-red-400' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                          <span className="text-sm text-gray-600">{row.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900">{fmtMoney(row.paise)}</span>
                          <span className="ml-2 text-xs text-gray-400">{row.pct}%</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total Invoiced</span>
                      <span className="text-sm font-bold text-gray-900">{fmtMoney(summary.total_invoiced_paise)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Invoice status summary */}
            {summary && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Invoice Status</p>
                <div className="space-y-3">
                  {[
                    { label: 'Paid',      count: summary.paid_count,      amount: summary.total_paid_paise,    badge: 'bg-primary/10 text-primary' },
                    { label: 'Pending',   count: summary.pending_count,   amount: summary.total_pending_paise, badge: 'bg-amber-100 text-amber-700' },
                    { label: 'Overdue',   count: summary.overdue_count,   amount: summary.total_overdue_paise, badge: 'bg-red-100 text-red-700' },
                    { label: 'Cancelled', count: summary.cancelled_count, amount: 0,                           badge: 'bg-gray-100 text-gray-500' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex min-w-[52px] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${row.badge}`}>
                          {row.label}
                        </span>
                        <span className="text-sm text-gray-500">{row.count} invoice{row.count !== 1 ? 's' : ''}</span>
                      </div>
                      {row.amount > 0 && (
                        <span className="text-sm font-semibold text-gray-900">{fmtMoney(row.amount)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Overdue students + Recent activity */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* Overdue / needs attention */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Requires Action</p>
                {studentSummary.filter(s => s.due_amount > 0).length > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {studentSummary.filter(s => s.due_amount > 0).length}
                  </span>
                )}
              </div>
              {studentSummary.filter(s => s.due_amount > 0).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                  <p className="text-sm font-medium text-gray-500">All payments up to date</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {studentSummary.filter(s => s.due_amount > 0).slice(0, 8).map(s => (
                    <div key={s.student_email} className="flex items-center gap-3 px-5 py-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.overdue_count > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {(s.student_name || s.student_email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.student_name || s.student_email}</p>
                        <p className="text-[11px] text-gray-400">
                          {s.overdue_count > 0 ? (
                            <span className="text-red-500 font-medium">{s.overdue_count} overdue</span>
                          ) : (
                            <span className="text-amber-600">{s.pending_count} pending</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${s.overdue_count > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {fmtMoney(s.due_amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {studentSummary.filter(s => s.due_amount > 0).length > 8 && (
                    <div className="px-5 py-2 text-xs text-gray-400 text-center">
                      +{studentSummary.filter(s => s.due_amount > 0).length - 8} more — view Students tab
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent payments */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Recent Payments</p>
              </div>
              {receipts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <CreditCard className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No payments recorded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {receipts.slice(0, 8).map(r => (
                    <div key={r.receipt_number} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.student_name || r.student_email}</p>
                        <p className="text-[11px] text-gray-400 truncate font-mono">{r.receipt_number}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-primary">{fmtMoney(r.amount_paise, r.currency)}</p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(r.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* INVOICES                                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!loading && view === 'invoices' && (
        filteredInvoices.length === 0 ? (
          <EmptyState icon={FileText} message={search || statusFilter !== 'all' ? 'No invoices match your filters.' : 'No invoices found.'} />
        ) : (
          <TableWrapper>
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '148px' }} />{/* Invoice # */}
                <col style={{ width: '190px' }} />{/* Student */}
                <col />{/* Description – fills remaining */}
                <col style={{ width: '116px' }} />{/* Amount */}
                <col style={{ width: '96px' }} /> {/* Status */}
                <col style={{ width: '108px' }} />{/* Due Date */}
                <col style={{ width: '108px' }} />{/* Paid At */}
              </colgroup>
              <THead>
                <TH className="px-3 py-2.5">Invoice #</TH>
                <TH className="px-3 py-2.5">Student</TH>
                <TH className="px-3 py-2.5">Description</TH>
                <TH className="px-3 py-2.5 text-right">Amount</TH>
                <TH className="px-3 py-2.5">Status</TH>
                <TH className="px-3 py-2.5">Due Date</TH>
                <TH className="px-3 py-2.5">Paid At</TH>
              </THead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <TRow key={inv.id}>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-700">{inv.invoice_number}</td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      <p className="font-medium text-gray-900 truncate">{inv.student_name || inv.student_email}</p>
                      <p className="text-xs text-gray-400 truncate">{inv.student_email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 overflow-hidden">
                      <span className="line-clamp-2">{inv.description || '—'}</span>
                      {inv.billing_period && <span className="block text-gray-400 mt-0.5 truncate">{inv.billing_period}</span>}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-gray-900 text-right tabular-nums whitespace-nowrap">
                      {fmtMoney(inv.amount_paise, inv.currency)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${invoiceStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </TRow>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* STUDENTS                                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!loading && view === 'students' && (
        filteredStudents.length === 0 ? (
          <EmptyState icon={Users} message="No student payment records found." />
        ) : (
          <div className="space-y-2">
            {filteredStudents.map(s => {
              const isExpanded = expandedStudent === s.student_email;
              const studentInvoices = invoices.filter(i => i.student_email === s.student_email);
              const collectionPct = s.total_amount > 0 ? Math.round((s.paid_amount / s.total_amount) * 100) : 0;

              return (
                <div key={s.student_email} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50/80 transition-colors text-left"
                    onClick={() => setExpandedStudent(isExpanded ? null : s.student_email)}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.overdue_count > 0 ? 'bg-red-100 text-red-700' : s.due_amount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                      {(s.student_name || s.student_email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{s.student_name || s.student_email}</span>
                        {s.overdue_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700 font-bold">
                            <AlertTriangle className="h-2.5 w-2.5" />{s.overdue_count} overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{s.student_email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 max-w-[160px] overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${collectionPct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 tabular-nums">{collectionPct}% collected</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="text-sm font-bold text-primary tabular-nums">{fmtMoney(s.paid_amount)}</p>
                      {s.due_amount > 0 && (
                        <p className={`text-xs font-semibold tabular-nums ${s.overdue_count > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {fmtMoney(s.due_amount)} due
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">{s.total_invoices} invoice{s.total_invoices !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/60 divide-y divide-gray-100">
                      {studentInvoices.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400">No invoices found.</p>
                      ) : studentInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center gap-3 px-5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-blue-700">{inv.invoice_number}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${invoiceStatusColor(inv.status)}`}>
                                {inv.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{inv.description || '—'}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {inv.due_date && `Due: ${new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                              {inv.paid_at && ` · Paid: ${new Date(inv.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtMoney(inv.amount_paise, inv.currency)}</p>
                            {inv.payment_method && <p className="text-[10px] text-gray-400 capitalize">{inv.payment_method}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* RECEIPTS                                                   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!loading && view === 'receipts' && (
        receipts.length === 0 ? (
          <EmptyState icon={CheckCircle2} message="No payment receipts found." />
        ) : (
          <TableWrapper>
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '148px' }} />{/* Receipt # */}
                <col style={{ width: '210px' }} />{/* Student */}
                <col />{/* Description – fills remaining */}
                <col style={{ width: '116px' }} />{/* Amount */}
                <col style={{ width: '108px' }} />{/* Method */}
                <col style={{ width: '108px' }} />{/* Paid At */}
              </colgroup>
              <THead>
                <TH className="px-3 py-2.5">Receipt #</TH>
                <TH className="px-3 py-2.5">Student</TH>
                <TH className="px-3 py-2.5">Description</TH>
                <TH className="px-3 py-2.5 text-right">Amount</TH>
                <TH className="px-3 py-2.5">Method</TH>
                <TH className="px-3 py-2.5">Paid At</TH>
              </THead>
              <tbody>
                {receipts.map(r => (
                  <TRow key={r.receipt_number}>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary">{r.receipt_number}</td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      <p className="font-medium text-gray-900 truncate">{r.student_name || r.student_email}</p>
                      <p className="text-xs text-gray-400 truncate">{r.student_email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 overflow-hidden">
                      <span className="line-clamp-2">{r.description || r.invoice_number || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-primary text-right tabular-nums whitespace-nowrap">
                      {fmtMoney(r.amount_paise, r.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-xs capitalize">
                      {r.payment_method ? (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{r.payment_method}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </TRow>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        )
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* REFUND REQUESTS                                           */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === 'refunds' && !loading && (() => {
        const filtered = refundRequests
          .filter(r => refundStatusFilter === 'all' || r.status === refundStatusFilter)
          .filter(r => {
            if (!search) return true;
            const q = search.toLowerCase();
            return [r.student_name, r.student_email, r.subject, r.batch_name]
              .some(v => v?.toLowerCase().includes(q));
          });

        const pendingCount = refundRequests.filter(r => r.status === 'pending').length;

        return (
          <div className="space-y-4">
            {pendingCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">
                  <span className="font-semibold">{pendingCount} pending refund request{pendingCount > 1 ? 's' : ''}</span>
                  {' '}require your review.
                </p>
              </div>
            )}

            {filtered.length === 0 ? (
              <EmptyState icon={CheckCircle2} message={refundStatusFilter === 'pending' ? 'No pending refund requests' : 'No refund requests found'} />
            ) : (
              <div className="space-y-3">
                {filtered.map(r => (
                  <div key={r.id} className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                    r.status === 'pending' ? 'border-amber-200' : r.status === 'approved' ? 'border-primary/20' : 'border-gray-200'
                  }`}>
                    <div className="px-4 py-3 space-y-2">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">{r.student_name || r.student_email}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              r.request_type === 'refund' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {r.request_type}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              r.status === 'pending' ? 'bg-amber-100 text-amber-700'
                                : r.status === 'approved' ? 'bg-primary/10 text-primary'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {r.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{r.student_email}</p>
                        </div>
                        <span className="text-lg font-bold text-gray-900 whitespace-nowrap">{fmtMoney(r.amount_paise, r.currency)}</span>
                      </div>

                      {/* Session details */}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {r.subject}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {new Date(r.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {r.start_time?.slice(0, 5)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {r.batch_name}
                        </span>
                        {r.teacher_name && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" /> {r.teacher_name}
                          </span>
                        )}
                        {r.invoice_number && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <FileText className="h-3 w-3" /> {r.invoice_number}
                          </span>
                        )}
                      </div>

                      {/* Reason */}
                      {r.reason && (
                        <div className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-500 font-medium">Student's Reason:</p>
                          <p className="text-sm text-gray-700">{r.reason}</p>
                        </div>
                      )}

                      {/* Payment details for refund requests */}
                      {r.request_type === 'refund' && (r.upi_id || r.account_number || r.qr_code_url) && (
                        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 space-y-1">
                          <p className="text-xs text-blue-600 font-semibold">Refund Payment Details</p>
                          {r.upi_id && (
                            <p className="text-sm text-gray-700">UPI: <span className="font-mono font-medium">{r.upi_id}</span></p>
                          )}
                          {r.account_number && (
                            <div className="text-sm text-gray-700">
                              <p>Bank: <span className="font-medium">{r.account_holder_name}</span></p>
                              <p>A/C: <span className="font-mono font-medium">{r.account_number}</span></p>
                              <p>IFSC: <span className="font-mono font-medium">{r.ifsc_code}</span></p>
                            </div>
                          )}
                          {r.qr_code_url && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">QR Code:</span>
                              <a href={r.qr_code_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">View QR</a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Review info for processed requests */}
                      {r.status !== 'pending' && r.reviewed_at && (
                        <div className={`rounded-lg px-3 py-2 ${r.status === 'approved' ? 'bg-primary/5' : 'bg-red-50'}`}>
                          <p className="text-xs text-gray-500">
                            {r.status === 'approved' ? 'Approved' : 'Rejected'} by <span className="font-medium">{r.reviewed_by}</span>
                            {' '}on {new Date(r.reviewed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          {r.review_notes && <p className="text-sm text-gray-700 mt-1">{r.review_notes}</p>}
                        </div>
                      )}

                      {/* Requested date */}
                      <p className="text-[10px] text-gray-400">
                        Requested {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>

                      {/* Action area for pending requests */}
                      {r.status === 'pending' && (
                        <div className="border-t border-gray-100 pt-3 mt-1 space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Review Notes (optional)</label>
                            <input
                              type="text"
                              value={reviewNotes[r.id] || ''}
                              onChange={e => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                              placeholder="Add a note…"
                              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRefundAction(r.id, 'approve')}
                              disabled={actionLoading === r.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:bg-emerald-300 transition-colors"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {actionLoading === r.id ? 'Processing…' : `Approve ${r.request_type === 'refund' ? 'Refund' : 'Reschedule'}`}
                            </button>
                            <button
                              onClick={() => handleRefundAction(r.id, 'reject')}
                              disabled={actionLoading === r.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:bg-red-300 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TodaysLiveTab — shows all today's sessions, highlights live ones,
// lets the AO observe or copy a guest link.
// ─────────────────────────────────────────────────────────────────────────────

// Local status for TodaysLiveTab: trust DB status only.
function tlStatus(s: Session): 'live' | 'scheduled' | 'ended' | 'cancelled' {
  if (s.status === 'live') return 'live';
  if (s.status === 'scheduled') return 'scheduled';
  if (s.status === 'ended') return 'ended';
  return 'cancelled';
}

// Is the live session running past its scheduled duration?
function isOvertime(s: Session): boolean {
  if (s.status !== 'live') return false;
  const startMs = s.started_at
    ? new Date(s.started_at).getTime()
    : new Date(`${s.scheduled_date.slice(0, 10)}T${s.start_time}`).getTime();
  return Date.now() > startMs + s.duration_minutes * 60_000;
}

function TodaysLiveTab({ sessions, loading, onRefresh }: {
  sessions: Session[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const toast = useToast();

  const todaySessions = sessions
    .filter(s => isToday(s.scheduled_date) && s.status !== 'cancelled')
    .sort((a, b) => {
      const order = (s: Session) => {
        const st = tlStatus(s);
        if (st === 'live') return 0;
        if (st === 'scheduled') return 1;
        return 2;
      };
      const diff = order(a) - order(b);
      if (diff !== 0) return diff;
      return a.start_time.localeCompare(b.start_time);
    });

  const liveCount = todaySessions.filter(s => tlStatus(s) === 'live').length;
  const scheduledCount = todaySessions.filter(s => tlStatus(s) === 'scheduled').length;

  const copyGuestLink = async (s: Session) => {
    try {
      const res = await fetch(`/api/v1/batch-sessions/${s.session_id}/guest-link`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success && data.data?.join_link) {
        await navigator.clipboard.writeText(data.data.join_link);
        toast.success('Student join link copied! Anyone can join by entering their name.');
      } else {
        toast.error(data.error || 'Could not generate link');
      }
    } catch {
      toast.error('Failed to generate join link');
    }
  };

  const observe = (s: Session) => {
    window.open('/academic-operator/live', '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Tv className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Live</h2>
            <p className="text-sm text-gray-500">
              {loading ? 'Loading…' : (
                <>
                  {liveCount > 0 && <span className="text-primary font-medium">{liveCount} live</span>}
                  {liveCount > 0 && scheduledCount > 0 && <span className="mx-1 text-gray-300">·</span>}
                  {scheduledCount > 0 && <span>{scheduledCount} upcoming</span>}
                  {liveCount === 0 && scheduledCount === 0 && todaySessions.length > 0 && <span>All sessions ended</span>}
                  {todaySessions.length === 0 && 'No sessions today'}
                </>
              )}
            </p>
          </div>
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Live pulse banner */}
      {liveCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-medium text-green-800">
            {liveCount} session{liveCount > 1 ? 's' : ''} live right now
          </span>
        </div>
      )}

      {loading && (
        <LoadingState />
      )}

      {!loading && todaySessions.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          message="No sessions scheduled for today."
        />
      )}

      {!loading && todaySessions.length > 0 && (
        <div className="space-y-3">
          {todaySessions.map(s => {
            const st = tlStatus(s);
            const isLive = st === 'live';
            const isScheduled = st === 'scheduled';
            const isEnded = st === 'ended';
            const overtime = isLive && isOvertime(s);

            return (
              <div
                key={s.session_id}
                className={`rounded-xl border p-4 transition-shadow ${
                  isLive
                    ? overtime
                      ? 'border-amber-300 bg-amber-50/60 shadow-sm ring-1 ring-amber-200'
                      : 'border-green-300 bg-primary/5/60 shadow-sm ring-1 ring-green-200'
                    : isScheduled
                    ? 'border-teal-200 bg-teal-50/40'
                    : 'border-gray-200 bg-gray-50/50 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm">
                    {isLive && !overtime && <Radio className="h-4 w-4 text-primary animate-pulse" />}
                    {isLive && overtime && <Radio className="h-4 w-4 text-amber-500 animate-pulse" />}
                    {isScheduled && <Clock className="h-4 w-4 text-teal-600" />}
                    {isEnded && <CheckCircle2 className="h-4 w-4 text-gray-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{s.subject}</span>
                      {isLive && !overtime && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
                          Live
                        </span>
                      )}
                      {isLive && overtime && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                          Overtime
                        </span>
                      )}
                      {isScheduled && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">Upcoming</span>
                      )}
                      {isEnded && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Ended</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {s.batch_name && <span className="font-medium text-gray-700">{s.batch_name}</span>}
                      {s.grade && <span>Grade {s.grade}</span>}
                      {s.section && <span>§ {s.section}</span>}
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {s.start_time.slice(0, 5)}
                        {s.duration_minutes > 0 && ` · ${s.duration_minutes} min`}
                      </span>
                      {s.teacher_name && (
                        <span className="flex items-center gap-0.5">
                          <User className="h-3 w-3" />
                          {s.teacher_name}
                        </span>
                      )}
                      {s.student_count != null && (
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {s.student_count}
                        </span>
                      )}
                      {s.topic && <span className="italic truncate max-w-[200px]">{s.topic}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isLive && (
                      <>
                        <button
                          onClick={() => copyGuestLink(s)}
                          title="Copy student join link"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Student Link
                        </button>
                        <button
                          onClick={() => observe(s)}
                          title="Observe session in new tab"
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-sm ${overtime ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-green-700'}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Observe
                        </button>
                      </>
                    )}
                    {isScheduled && s.livekit_room_name && (
                      <button
                        onClick={() => copyGuestLink(s)}
                        title="Copy student join link for this room"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Student Link
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
