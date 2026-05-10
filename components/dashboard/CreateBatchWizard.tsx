// ═══════════════════════════════════════════════════════════════
// CreateBatchWizard — extracted from AcademicOperatorDashboardClient
// Reusable multi-step batch creation wizard.
// Supports prefillStudent prop to auto-populate from a known student.
// ═══════════════════════════════════════════════════════════════
'use client';

import React, { useState, useEffect } from 'react';
import {
  Button, IconButton, SearchInput, Select, Input, Textarea,
  FormField, Badge, useToast,
} from '@/components/dashboard/shared';
import { CreateUserModal, STUDENT_REGIONS } from '@/components/dashboard/CreateUserForm';
import {
  CheckCircle, ChevronLeft, ChevronRight, X, Database,
  AlertCircle, BookOpen, ChevronDown,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DEFAULT_GRADES = ['8', '9', '10', '11', '12'];
const DEFAULT_BOARDS = [
  'CBSE', 'ICSE', 'ISC', 'State Board', 'IB (International Baccalaureate)',
  'IGCSE (Cambridge)', 'NIOS', 'SSC', 'HSC', 'Matriculation Board', 'Anglo Indian Board',
];
const DEFAULT_CATEGORIES = ['A', 'B', 'C'];

export const BATCH_TYPE_LABELS: Record<string, string> = {
  one_to_one: '1:1', one_to_three: '1:3', one_to_fifteen: '1:15',
  one_to_thirty: '1:30', one_to_many: '1:M', lecture: 'Lecture',
  improvement_batch: 'Improvement', custom: 'Custom',
};

export const BATCH_TEMPLATES = [
  // ── 1:1 Individual ──────────────────────────────────────────────
  { id: 'one_to_one_Physics',     type: 'one_to_one' as const, subjectLabel: 'Physics',          subjects: ['Physics'],                                               label: '1:1 — Physics',          maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_Chemistry',   type: 'one_to_one' as const, subjectLabel: 'Chemistry',        subjects: ['Chemistry'],                                             label: '1:1 — Chemistry',        maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_Biology',     type: 'one_to_one' as const, subjectLabel: 'Biology',          subjects: ['Biology'],                                               label: '1:1 — Biology',          maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_Mathematics', type: 'one_to_one' as const, subjectLabel: 'Mathematics',      subjects: ['Mathematics'],                                           label: '1:1 — Mathematics',      maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_PCB',         type: 'one_to_one' as const, subjectLabel: 'PCB',              subjects: ['Physics', 'Chemistry', 'Biology'],                        label: '1:1 — PCB',              maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_PCM',         type: 'one_to_one' as const, subjectLabel: 'PCM',              subjects: ['Physics', 'Chemistry', 'Mathematics'],                   label: '1:1 — PCM',              maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  { id: 'one_to_one_PCBM',        type: 'one_to_one' as const, subjectLabel: 'PCBM (All 4)',     subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],         label: '1:1 — PCBM',             maxStudents: 1,   color: 'bg-blue-50 border-blue-200 text-blue-700',       selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300 text-blue-800' },
  // ── 1:3 Small Group ─────────────────────────────────────────────
  { id: 'one_to_three_Physics',     type: 'one_to_three' as const, subjectLabel: 'Physics',        subjects: ['Physics'],                                               label: '1:3 — Physics',          maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_Chemistry',   type: 'one_to_three' as const, subjectLabel: 'Chemistry',      subjects: ['Chemistry'],                                             label: '1:3 — Chemistry',        maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_Biology',     type: 'one_to_three' as const, subjectLabel: 'Biology',        subjects: ['Biology'],                                               label: '1:3 — Biology',          maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_Mathematics', type: 'one_to_three' as const, subjectLabel: 'Mathematics',    subjects: ['Mathematics'],                                           label: '1:3 — Mathematics',      maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_PCB',         type: 'one_to_three' as const, subjectLabel: 'PCB',            subjects: ['Physics', 'Chemistry', 'Biology'],                        label: '1:3 — PCB',              maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_PCM',         type: 'one_to_three' as const, subjectLabel: 'PCM',            subjects: ['Physics', 'Chemistry', 'Mathematics'],                   label: '1:3 — PCM',              maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  { id: 'one_to_three_PCBM',        type: 'one_to_three' as const, subjectLabel: 'PCBM (All 4)',   subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],         label: '1:3 — PCBM',             maxStudents: 3,   color: 'bg-primary/5 border-primary/20 text-primary', selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300 text-primary' },
  // ── 1:15 Group ──────────────────────────────────────────────────
  { id: 'one_to_fifteen_PCB',  type: 'one_to_fifteen' as const, subjectLabel: 'PCB',  subjects: ['Physics', 'Chemistry', 'Biology'],              label: '1:15 — PCB',  maxStudents: 15,  color: 'bg-teal-50 border-teal-200 text-teal-700',     selectedColor: 'bg-teal-100 border-teal-500 ring-2 ring-teal-300 text-teal-800' },
  { id: 'one_to_fifteen_PCM',  type: 'one_to_fifteen' as const, subjectLabel: 'PCM',  subjects: ['Physics', 'Chemistry', 'Mathematics'],          label: '1:15 — PCM',  maxStudents: 15,  color: 'bg-teal-50 border-teal-200 text-teal-700',     selectedColor: 'bg-teal-100 border-teal-500 ring-2 ring-teal-300 text-teal-800' },
  // ── 1:30 Large Group ────────────────────────────────────────────
  { id: 'one_to_thirty_PCBM', type: 'one_to_thirty' as const, subjectLabel: 'PCBM', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],               label: '1:30 — PCBM', maxStudents: 30,  color: 'bg-purple-50 border-purple-200 text-purple-700', selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300 text-purple-800' },
  { id: 'one_to_thirty_PCSM', type: 'one_to_thirty' as const, subjectLabel: 'PCSM', subjects: ['Physics', 'Chemistry', 'Computer Science', 'Mathematics'], label: '1:30 — PCSM', maxStudents: 30,  color: 'bg-purple-50 border-purple-200 text-purple-700', selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300 text-purple-800' },
  // ── 1:M Classroom ───────────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────

type BatchType = 'one_to_one' | 'one_to_three' | 'one_to_fifteen' | 'one_to_thirty' | 'one_to_many' | 'lecture' | 'improvement_batch' | 'custom';
type WizardStep = 'template' | 'students' | 'details' | 'teachers' | 'review';

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

interface BatchItem {
  grade: string;
  section: string | null;
  coordinator_email: string | null;
  academic_operator_email: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

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
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = {
    one_to_one: 'primary', one_to_three: 'success', one_to_fifteen: 'info',
    one_to_thirty: 'info', one_to_many: 'info', lecture: 'warning',
    improvement_batch: 'warning', custom: 'warning',
  };
  return map[t] || 'default';
}

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

// ── TeacherPickerSelect ──────────────────────────────────────

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

// ── PrefillStudent prop ──────────────────────────────────────

export interface PrefillStudent {
  email: string;
  name: string;
  parent_email: string | null;
  grade?: string;
  board?: string;
  batch_type?: string;
  subjects?: string[];
  category?: string;
}

// ── CreateBatchWizard ────────────────────────────────────────

export function CreateBatchWizard({
  batches = [],
  userRole = 'academic_operator',
  userEmail = '',
  onClose,
  onCreated,
  prefillStudent,
}: {
  batches?: BatchItem[];
  userRole?: string;
  userEmail?: string;
  onClose: () => void;
  onCreated: () => void;
  prefillStudent?: PrefillStudent;
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
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserRole, setCreateUserRole] = useState('parent');
  const [parentForStudent, setParentForStudent] = useState('');

  const toast = useToast();

  // ── Prefill from student data ──────────────────────────────
  useEffect(() => {
    if (!prefillStudent) return;

    // Pre-add student to selected list
    setSelectedStudents([{
      email: prefillStudent.email,
      name: prefillStudent.name,
      parent_email: prefillStudent.parent_email,
      parent_name: null,
    }]);

    // Auto-select template from batch_type + subjects (exact match only)
    const subjects = prefillStudent.subjects || [];
    let matchedType: BatchType | undefined;
    if (prefillStudent.batch_type) {
      // Exact match: batch_type + same subjects
      const tpl = BATCH_TEMPLATES.find(t =>
        t.type === prefillStudent.batch_type &&
        subjects.length > 0 &&
        t.subjects.length === subjects.length &&
        t.subjects.every(s => subjects.includes(s)),
      );
      if (tpl) {
        setFormType(tpl.type as BatchType);
        matchedType = tpl.type as BatchType;
        setFormSubjects(tpl.subjects);
        setSelectedTemplateId(tpl.id);
      } else {
        // No exact template match — pre-set batch type and subjects from enrolled data.
        // Template chips will show the type selected; user can refine subjects in teachers step.
        setFormType(prefillStudent.batch_type as BatchType);
        matchedType = prefillStudent.batch_type as BatchType;
        if (subjects.length > 0) setFormSubjects(subjects);
      }
    }

    // Pre-set grade, category, section, name
    if (prefillStudent.grade) {
      const g = prefillStudent.grade.replace(/^Class\s+/i, '').trim();
      setFormGrade(g);
      const cat = prefillStudent.category || 'A';
      setFormCategory(cat);
      setFormSection(`${cat}1`);
      // Auto-generate batch name — use actual subjects directly to avoid wrong template match
      const typeLabel = matchedType ? (BATCH_TYPE_LABELS[matchedType] || '') : '';
      const subjectLabel = subjects.length > 0 ? subjects.join('+') : '';
      const boardPart = prefillStudent.board ? ` ${prefillStudent.board}` : '';
      if (g) {
        setFormName(`${typeLabel}${subjectLabel ? ' ' + subjectLabel : ''} Class ${g}${boardPart} ${cat}1`.trim());
      }
    }
    if (prefillStudent.board) setFormBoard(prefillStudent.board);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch settings + people ────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/academics/settings').then(r => r.json()).then(d => {
      if (d.success && d.data?.subjects?.length) setSubjects(d.data.subjects);
      if (d.success && d.data?.grades?.length) setGrades(d.data.grades);
    }).catch(() => {});
    if (userRole === 'owner') {
      fetch('/api/v1/owner/academic-operators').then(r => r.json()).then(d => {
        if (d.success && d.data?.defaultAO) setFormAO(d.data.defaultAO);
      }).catch(() => {});
    }
    // If userEmail was not passed but we're acting as an AO, resolve it from session
    if (userRole === 'academic_operator' && !userEmail) {
      fetch('/api/v1/auth/me').then(r => r.json()).then(d => {
        if (d.success && d.data?.user?.id) setFormAO(d.data.user.id);
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

  // ── Helpers ───────────────────────────────────────────────
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

  // Regenerate name when template, subjects, or board changes
  useEffect(() => {
    if (!formGrade) return;
    setFormName(autoName(formGrade, formSection));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, formSubjects, formBoard, formType]);

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
    const tpl = BATCH_TEMPLATES.find(t => t.id === selectedTemplateId);
    const subjLabel = tpl?.subjectLabel ? ` ${tpl.subjectLabel}` : '';
    const typeLabel = BATCH_TYPE_LABELS[formType] || '1:1';
    const batchName = `${typeLabel}${subjLabel} Class ${stuGrade} ${sec} — ${stu.full_name}`.trim();
    setFormName(batchName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudents, students, formType]);

  // ── Student selection ──────────────────────────────────────
  const getMaxForType = (type: BatchType | ''): number => {
    if (!type) return 0;
    if (type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === type);
    return tpl?.maxStudents ?? 50;
  };

  const canProceedFromTemplate = formType !== '' && formSubjects.length > 0;
  const canProceedFromDetails = formName.trim() !== '' && formGrade !== '';
  const canProceedFromTeachers = formSubjects.length > 0;
  const canSubmit = formType !== '' && formName.trim() !== '' && formGrade !== '';

  const normalizeGrade = (g: string) => g.replace(/^Class\s+/i, '').trim();
  const filteredStudents = students.filter(s => {
    if (formType !== 'one_to_one') {
      if (formGrade && normalizeGrade(s.grade || '') !== formGrade) return false;
      if (formCategory && s.category !== formCategory) return false;
    }
    if (regionFilter && (s.assigned_region || '') !== regionFilter) return false;
    if (unassignedOnly && (s.current_batches ?? []).length > 0) return false;
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

  // ── Create parent ──────────────────────────────────────────
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

  // ── Submit ─────────────────────────────────────────────────
  const submitBatch = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      // If formAO was never set (wizard opened without userEmail prop), resolve from session now
      let resolvedAO = formAO;
      if (!resolvedAO && userRole === 'academic_operator') {
        try {
          const meRes = await fetch('/api/v1/auth/me');
          const meJson = await meRes.json();
          if (meJson.success && meJson.data?.user?.id) {
            resolvedAO = meJson.data.user.id;
            setFormAO(resolvedAO);
          }
        } catch { /* ignore */ }
      }
      const body = {
        batch_name: formName.trim(),
        batch_type: formType,
        subjects: formSubjects.length > 0 ? formSubjects : null,
        grade: formGrade || null,
        section: formSection || null,
        board: formBoard || null,
        coordinator_email: formCoordinator || null,
        academic_operator_email: resolvedAO || null,
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

  // ── Navigation ─────────────────────────────────────────────
  const goNext = () => { if (stepIdx < wizardSteps.length - 1) setWizardStep(wizardSteps[stepIdx + 1].key); };
  const goPrev = () => { if (stepIdx > 0) setWizardStep(wizardSteps[stepIdx - 1].key); };
  const canGoNext = (): boolean => {
    if (wizardStep === 'template') return canProceedFromTemplate;
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'teachers') return canProceedFromTeachers;
    if (wizardStep === 'students') {
      if (['one_to_one', 'one_to_three'].includes(formType)) return selectedStudents.length >= 1;
      return true;
    }
    return false;
  };

  // ── Step renderers ─────────────────────────────────────────

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
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${group.cols}, minmax(0, 1fr))` }}>
                  {groupTemplates.map(tpl => {
                    // A template chip is "active" when all its subjects are in formSubjects
                    const isSelected = tpl.type === formType && tpl.subjects.every(s => formSubjects.includes(s));
                    return (
                      <button key={tpl.id} type="button"
                        onClick={() => {
                          const typeChanged = tpl.type !== formType;
                          if (typeChanged) {
                            // Switching to a different batch type: reset everything
                            setFormType(tpl.type);
                            setFormSubjects(tpl.subjects);
                            setSelectedTemplateId(tpl.id);
                            setSubjectTeachers({});
                            setSelectedStudents([]);
                            setFormName('');
                          } else {
                            // Same batch type: toggle this template's subjects
                            setFormSubjects(prev => {
                              const allPresent = tpl.subjects.every(s => prev.includes(s));
                              if (allPresent) {
                                // Deselect: remove these subjects
                                const next = prev.filter(s => !tpl.subjects.includes(s));
                                tpl.subjects.forEach(s => {
                                  setSubjectTeachers(st => { const c = { ...st }; delete c[s]; return c; });
                                });
                                return next;
                              } else {
                                // Select: add these subjects (union, no duplicates)
                                return [...new Set([...prev, ...tpl.subjects])];
                              }
                            });
                            setSelectedTemplateId(tpl.id);
                          }
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
            <button
              type="button"
              onClick={() => setUnassignedOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                unassignedOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                unassignedOnly ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
              }`}>
                {unassignedOnly && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              Unassigned only
            </button>
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
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Enrolled As</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Current Batches</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  const currentBatches: { batch_name: string }[] = Array.isArray(s.current_batches) ? s.current_batches : [];
                  const alreadyInBatch = currentBatches.length > 0;
                  const enrolledAs = s.preferred_batch_type ? (BATCH_TYPE_LABELS[s.preferred_batch_type] || s.preferred_batch_type) : null;
                  const enrolledAsMismatch = enrolledAs && formType && s.preferred_batch_type !== formType;
                  return (
                    <tr
                      key={s.email}
                      className={`border-t cursor-pointer transition-colors ${
                        selected
                          ? 'bg-primary/5/60'
                          : alreadyInBatch
                          ? 'bg-amber-50/40 hover:bg-amber-50/70'
                          : 'hover:bg-primary/5/30'
                      }`}
                      onClick={() => toggleStudent(s)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{s.full_name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.grade || '—'}</td>
                      <td className="px-4 py-3">
                        {enrolledAs ? (
                          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            enrolledAsMismatch
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-primary/5 text-primary border-primary/20'
                          }`}>{enrolledAs}</span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {currentBatches.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {currentBatches.map((b, i) => (
                              <span key={i} title={b.batch_name} className="inline-block text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 max-w-[120px] truncate">
                                {b.batch_name}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-gray-300">None</span>}
                      </td>
                      <td className="px-4 py-3">
                        {s.parent_email
                          ? <span className="text-xs text-primary">{s.parent_name || s.parent_email}</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded"><AlertCircle className="h-3 w-3" /> No parent</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {selected
                          ? <span className="inline-flex items-center gap-1 text-xs text-primary font-medium"><CheckCircle className="h-3.5 w-3.5" /> Selected</span>
                          : maxReached
                          ? <span className="text-xs text-gray-300">Max reached</span>
                          : alreadyInBatch
                          ? <span className="text-xs text-amber-600 hover:text-amber-700">+ Add (in batch)</span>
                          : <span className="text-xs text-gray-400 hover:text-primary">+ Add</span>}
                      </td>
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
          Subjects <span className="text-xs font-normal text-gray-400 ml-1">— click to toggle</span>
        </label>
        <div className="flex flex-wrap gap-2.5">
          {SUBJECTS.map(subj => {
            const selected = formSubjects.includes(subj);
            return (
              <button
                key={subj}
                type="button"
                onClick={() => toggleSubject(subj)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  selected
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-emerald-300 hover:text-primary'
                }`}
              >
                {selected && <span className="mr-1.5">✓</span>}{subj}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">{formSubjects.length} subject{formSubjects.length !== 1 ? 's' : ''} selected · assign a teacher to each below</p>
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

  // ── Wizard overlay ─────────────────────────────────────────
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
