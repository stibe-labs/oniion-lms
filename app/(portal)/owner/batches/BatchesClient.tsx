// ═══════════════════════════════════════════════════════════════
// Batch Management — Class-based batches (Class 10 A, Class 10 B)
// Multi-subject and per-subject teacher assignment
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FilterSelect, Modal,
  FormField, FormGrid, FormActions, Input, Select, Textarea,
  TableWrapper, THead, TH, TRow,
  DetailPanel, DetailHeader, InfoCard,
  LoadingState, EmptyState, Badge, StatusBadge,
  useToast, useConfirm,
} from '@/components/dashboard/shared';
import {
  Database, Plus, Filter, Users, BookOpen,
  GraduationCap, User, X, Trash2,
  ChevronRight, ChevronLeft,
  CheckCircle, AlertCircle, Layers, Check,
  Settings, Save, Power, FileText,
} from 'lucide-react';
import { CreateUserModal, CATEGORY_STYLES } from '@/components/dashboard/CreateUserForm';
import { WizardShell, WizardFooterDots } from '@/components/dashboard/WizardShell';

// ── Default fallbacks (used until settings load) ────────────

const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DEFAULT_GRADES = Array.from({ length: 10 }, (_, i) => String(i + 1));

// Grades 8-10: subjects auto-assigned from academic calendar
const GRADE_SUBJECTS: Record<string, string[]> = {
  '8': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  '9': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  '10': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};
const DEFAULT_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];
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
  {
    type: 'one_to_one' as const,
    label: 'One-to-One',
    description: '1 Student — Personal tuition (per-class fee).',
    maxStudents: 1,
    icon: User,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300',
  },
  {
    type: 'one_to_three' as const,
    label: 'One-to-Three',
    description: 'Up to 3 Students — Small group (per-class fee).',
    maxStudents: 3,
    icon: Users,
    color: 'bg-primary/5 border-primary/20 text-primary',
    selectedColor: 'bg-primary/10 border-primary ring-2 ring-emerald-300',
  },
  {
    type: 'one_to_fifteen' as const,
    label: 'One-to-Fifteen',
    description: 'Up to 15 Students — Group class (monthly fee).',
    maxStudents: 15,
    icon: Users,
    color: 'bg-teal-50 border-teal-200 text-teal-700',
    selectedColor: 'bg-teal-100 border-teal-500 ring-2 ring-teal-300',
  },
  {
    type: 'one_to_thirty' as const,
    label: 'One-to-Thirty',
    description: 'Up to 30 Students — Large group (monthly fee).',
    maxStudents: 30,
    icon: GraduationCap,
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300',
  },
  {
    type: 'one_to_many' as const,
    label: 'Large Classroom',
    description: 'Unlimited students — Classroom batch (monthly fee).',
    maxStudents: 999,
    icon: GraduationCap,
    color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    selectedColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300',
  },
  {
    type: 'lecture' as const,
    label: 'Lecture',
    description: 'Up to 50 Students — Chat & hand-raise only (monthly fee).',
    maxStudents: 50,
    icon: BookOpen,
    color: 'bg-rose-50 border-rose-200 text-rose-700',
    selectedColor: 'bg-rose-100 border-rose-500 ring-2 ring-rose-300',
  },
  {
    type: 'improvement_batch' as const,
    label: 'Improvement Batch',
    description: 'Focused revision / improvement batch (custom fee).',
    maxStudents: 999,
    icon: Layers,
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    selectedColor: 'bg-orange-100 border-orange-500 ring-2 ring-orange-300',
  },
  {
    type: 'custom' as const,
    label: 'Custom',
    description: 'Custom configuration (manual fee entry).',
    maxStudents: 999,
    icon: Layers,
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    selectedColor: 'bg-amber-100 border-amber-500 ring-2 ring-amber-300',
  },
];

type BatchType = 'one_to_one' | 'one_to_three' | 'one_to_fifteen' | 'one_to_thirty' | 'one_to_many' | 'lecture' | 'improvement_batch' | 'custom';

const BATCH_TYPE_PREFIX: Record<string, string> = {
  one_to_one:        '1:1',
  one_to_three:      '1:3',
  one_to_fifteen:    '1:15',
  one_to_thirty:     '1:30',
  one_to_many:       '1:M',
  lecture:           'Lecture',
  improvement_batch: 'Improvement',
  custom:            'Custom',
};

// ── Types ────────────────────────────────────────────────────

interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: BatchType;
  subjects: string[] | null;
  subject: string | null;
  grade: string | null;
  section: string | null;
  board: string | null;
  coordinator_email: string | null;
  coordinator_name: string | null;
  academic_operator_email: string | null;
  academic_operator_name: string | null;
  max_students: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student_count: number;
  teacher_count: number;
  teachers: BatchTeacher[];
}

interface BatchTeacher {
  teacher_email: string;
  teacher_name: string | null;
  subject: string;
  added_at?: string;
}

interface BatchDetail {
  batch: Batch;
  students: BatchStudent[];
  teachers: BatchTeacher[];
}

interface BatchStudent {
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  added_at: string;
  total_classes: number | null;
  present: number | null;
  attendance_rate: number | null;
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
  category: string | null;
  current_batches?: { batch_id: string; batch_name: string }[];
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Wizard Step ──────────────────────────────────────────────

type BatchStep = 'template' | 'details' | 'teachers' | 'students' | 'review';

// Dynamic step order: 1:1 → students first; others → details first (to set grade filter)
function getWizardSteps(type: BatchType | ''): { key: BatchStep; label: string; desc: string; icon: React.ElementType }[] {
  if (type === 'one_to_one') {
    return [
      { key: 'template', label: 'Batch Type',         desc: 'Choose the type of batch',        icon: Layers },
      { key: 'students', label: 'Student',             desc: 'Select the student',               icon: Users },
      { key: 'details',  label: 'Details',             desc: 'Grade, name and configuration',   icon: FileText },
      { key: 'teachers', label: 'Subjects & Teachers', desc: 'Assign subjects and teachers',    icon: GraduationCap },
      { key: 'review',   label: 'Review',              desc: 'Confirm and create batch',        icon: CheckCircle },
    ];
  }
  return [
    { key: 'template', label: 'Batch Type',         desc: 'Choose the type of batch',        icon: Layers },
    { key: 'details',  label: 'Details',             desc: 'Grade, name and configuration',   icon: FileText },
    { key: 'students', label: 'Students',            desc: 'Select students for the batch',   icon: Users },
    { key: 'teachers', label: 'Subjects & Teachers', desc: 'Assign subjects and teachers',    icon: GraduationCap },
    { key: 'review',   label: 'Review',              desc: 'Confirm and create batch',        icon: CheckCircle },
  ];
}

// ── Helpers ──────────────────────────────────────────────────

function batchTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    one_to_one: 'One-to-One',
    one_to_three: 'One-to-Three',
    one_to_many: 'One-to-Many',
    custom: 'Custom',
  };
  return labels[t] || t;
}

function batchTypeBadgeVariant(t: string): 'primary' | 'success' | 'info' | 'warning' | 'default' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = {
    one_to_one: 'primary',
    one_to_three: 'success',
    one_to_many: 'info',
    custom: 'warning',
  };
  return map[t] || 'default';
}

// ── Main Component ───────────────────────────────────────────

export default function BatchesClient({ userName, userEmail, userRole }: Props) {
  // ── Top-level page tab ──
  const [pageTab, setPageTab] = useState<'batches' | 'academics'>('batches');

  // ── Academic settings (configurable) ──
  const [SUBJECTS, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [GRADES, setGrades] = useState<string[]>(DEFAULT_GRADES);
  const [SECTIONS, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [BOARDS, setBoards] = useState<string[]>(DEFAULT_BOARDS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);

  // Inline add inputs for each setting
  const [newSubject, setNewSubject] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newBoard, setNewBoard] = useState('');

  // ── List state ──
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // ── Detail state ──
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Create wizard state ──
  const [showCreate, setShowCreate] = useState(false);
  const [wizardStep, setWizardStep] = useState<BatchStep>('template');
  const [creating, setCreating] = useState(false);

  // Wizard form values
  const [formType, setFormType] = useState<BatchType | ''>('');
  const [formName, setFormName] = useState('');
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formGrade, setFormGrade] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formBoard, setFormBoard] = useState('');
  const [formCoordinator, setFormCoordinator] = useState('');
  const [formAcademicOperator, setFormAcademicOperator] = useState('');
  const [formMaxStudents, setFormMaxStudents] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Subject → Teacher assignments
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});

  // Selected students for the batch
  const [selectedStudents, setSelectedStudents] = useState<{ email: string; name: string; parent_email: string | null; parent_name: string | null }[]>([]);

  // People lists (fetched)
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [academicOperators, setAcademicOperators] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentCategoryFilter, setStudentCategoryFilter] = useState('all');
  const [subjectsDropdownOpen, setSubjectsDropdownOpen] = useState(false);
  const [formCategory, setFormCategory] = useState<string>('');  // Batch-level category (A/B/C)

  // Parent/user creation via reusable modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserRole, setCreateUserRole] = useState('parent');
  const [parentForStudent, setParentForStudent] = useState('');

  const toast = useToast();
  const { confirm } = useConfirm();

  // ── Data fetching ──────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/batches');
      const json = await res.json();
      if (json.success) setBatches(json.data?.batches || []);
    } catch (e) { console.error('Failed to fetch batches:', e); }
    setLoading(false);
  }, []);

  const fetchDetail = useCallback(async (batchId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/batches/${batchId}`);
      const json = await res.json();
      if (json.success) setDetail(json.data);
    } catch (e) { console.error('Failed to fetch detail:', e); }
    setDetailLoading(false);
  }, []);

  const fetchPeople = useCallback(async () => {
    setPeopleLoading(true);
    try {
      const [studRes, teachRes, coordRes, aoRes] = await Promise.all([
        // Students: use batches endpoint (excludes already-enrolled students)
        fetch('/api/v1/batches/people?role=student').then(r => r.json()),
        // Teachers: use batches endpoint
        fetch('/api/v1/batches/people?role=teacher').then(r => r.json()),
        // Coordinators + Academic Operators: use HR endpoint (same auth, no is_active filter issues)
        fetch('/api/v1/hr/users?role=batch_coordinator&limit=500').then(r => r.json()),
        fetch('/api/v1/hr/users?role=academic_operator&limit=500').then(r => r.json()),
      ]);
      if (studRes.success) setStudents(studRes.data.people);
      if (teachRes.success) setTeachers(teachRes.data.people);
      if (coordRes.success) setCoordinators(coordRes.data.users);
      if (aoRes.success) setAcademicOperators(aoRes.data.users);
    } catch (e) { console.error('Failed to fetch people:', e); }
    setPeopleLoading(false);
  }, []);

  // ── Fetch academic settings ──
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/v1/academics/settings');
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data as Record<string, string[]>;
        if (d.subjects?.length) setSubjects(d.subjects);
        if (d.grades?.length) setGrades(d.grades);
        if (d.sections?.length) setSections(d.sections);
        if (d.boards?.length) setBoards(d.boards);
      }
    } catch (e) { console.error('Failed to fetch academic settings:', e); }
    setSettingsLoading(false);
  }, []);

  const saveSetting = async (key: string, values: string[]) => {
    setSettingsSaving(key);
    try {
      const res = await fetch('/api/v1/academics/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, values }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} updated`);
      } else {
        toast.error(json.error || 'Failed to save');
      }
    } catch (e) { console.error(e); toast.error('Failed to save setting'); }
    setSettingsSaving(null);
  };

  const addSettingItem = (key: string, value: string) => {
    if (!value.trim()) return;
    const v = value.trim();
    if (key === 'subjects' && !SUBJECTS.includes(v)) {
      const next = [...SUBJECTS, v];
      setSubjects(next);
      saveSetting('subjects', next);
      setNewSubject('');
    } else if (key === 'grades' && !GRADES.includes(v)) {
      const next = [...GRADES, v];
      setGrades(next);
      saveSetting('grades', next);
      setNewGrade('');
    } else if (key === 'sections' && !SECTIONS.includes(v)) {
      const next = [...SECTIONS, v];
      setSections(next);
      saveSetting('sections', next);
      setNewSection('');
    } else if (key === 'boards' && !BOARDS.includes(v)) {
      const next = [...BOARDS, v];
      setBoards(next);
      saveSetting('boards', next);
      setNewBoard('');
    } else {
      toast.error('Already exists');
    }
  };

  const removeSettingItem = (key: string, value: string) => {
    if (key === 'subjects') {
      const next = SUBJECTS.filter(s => s !== value);
      if (next.length === 0) { toast.error('Must have at least one subject'); return; }
      setSubjects(next);
      saveSetting('subjects', next);
    } else if (key === 'grades') {
      const next = GRADES.filter(s => s !== value);
      if (next.length === 0) { toast.error('Must have at least one grade'); return; }
      setGrades(next);
      saveSetting('grades', next);
    } else if (key === 'sections') {
      const next = SECTIONS.filter(s => s !== value);
      if (next.length === 0) { toast.error('Must have at least one section'); return; }
      setSections(next);
      saveSetting('sections', next);
    } else if (key === 'boards') {
      const next = BOARDS.filter(s => s !== value);
      if (next.length === 0) { toast.error('Must have at least one board'); return; }
      setBoards(next);
      saveSetting('boards', next);
    }
  };

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (selectedBatch) fetchDetail(selectedBatch);
    else setDetail(null);
  }, [selectedBatch, fetchDetail]);

  useEffect(() => {
    if (showCreate) fetchPeople();
  }, [showCreate, fetchPeople]);

  // ── Wizard helpers ─────────────────────────────────────────

  const resetWizard = () => {
    setWizardStep('template');
    setFormType('');
    setFormName('');
    setFormSubjects([]);
    setFormGrade('');
    setFormSection('');
    setFormBoard('');
    setFormCoordinator('');
    setFormAcademicOperator('');
    setFormMaxStudents('');
    setFormNotes('');
    setSubjectTeachers({});
    setSelectedStudents([]);
    setStudentSearch('');
    setSubjectsDropdownOpen(false);
    setFormCategory('');
    setStudentCategoryFilter('all');
  };

  const openWizard = () => { resetWizard(); setShowCreate(true); };
  const closeWizard = () => { setShowCreate(false); resetWizard(); };

  // Category-based section naming: A1, A2, B1, B2, etc.
  const getSectionsForGradeCategory = (grade: string, category: string): string[] =>
    batches.filter(b => b.grade === grade && b.section && b.section.startsWith(category)).map(b => b.section as string);
  const getNextNumber = (grade: string, category: string): number => {
    const existing = getSectionsForGradeCategory(grade, category);
    const numbers = existing.map(s => parseInt(s.slice(category.length))).filter(n => !isNaN(n));
    return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  };
  const autoSection = (category: string, num: number) => category ? `${category}${num}` : '';

  // Auto-generate batch name: "1:3 Class 12 A1"
  const autoName = (grade: string, section: string, type?: string) => {
    const prefix = BATCH_TYPE_PREFIX[type || formType] || '';
    if (grade && section) return `${prefix} Class ${grade} ${section}`.trim();
    if (grade) return `${prefix} Class ${grade}`.trim();
    return '';
  };

  // Get sections already used for a given grade
  const getUsedSections = (grade: string): string[] =>
    batches
      .filter(b => b.grade === grade && b.section)
      .map(b => b.section as string);

  // Get the next available section for a grade + category
  const getNextSection = (grade: string, category?: string): string => {
    const cat = category || formCategory;
    if (!cat) return '';
    const num = getNextNumber(grade, cat);
    return autoSection(cat, num);
  };

  const handleGradeChange = (g: string) => {
    setFormGrade(g);
    const cat = formCategory || '';
    const nextSection = (g && cat) ? getNextSection(g, cat) : '';
    setFormSection(nextSection);
    setFormName(autoName(g, nextSection));
    // Auto-assign subjects for grades 8-10
    const gradeSubjects = GRADE_SUBJECTS[g];
    if (gradeSubjects) {
      setFormSubjects(gradeSubjects);
      setSubjectTeachers(prev => {
        const next: Record<string, string> = {};
        for (const s of gradeSubjects) { if (prev[s]) next[s] = prev[s]; }
        return next;
      });
    } else {
      setFormSubjects([]);
      setSubjectTeachers({});
    }
  };

  const handleCategoryChange = (cat: string) => {
    setFormCategory(cat);
    // Sync the students step filter
    setStudentCategoryFilter(cat || 'all');
    // Recompute section + name
    const sec = (formGrade && cat) ? getNextSection(formGrade, cat) : '';
    setFormSection(sec);
    if (formType !== 'one_to_one' && formGrade) {
      setFormName(autoName(formGrade, sec));
    }
  };

  // Auto-fill details for one_to_one when student is selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (formType !== 'one_to_one' || selectedStudents.length !== 1) return;
    const student = students.find(s => s.email === selectedStudents[0].email);
    if (!student) return;
    // Auto-fill grade from student profile
    const studentGrade = (student.grade || '').replace(/^Class\s*/i, '');
    const stuCat = student.category || 'A';
    if (studentGrade) {
      setFormGrade(studentGrade);
      // Auto-assign subjects for grades 8-10
      const gradeSubjects = GRADE_SUBJECTS[studentGrade];
      if (gradeSubjects) {
        setFormSubjects(gradeSubjects);
        setSubjectTeachers(prev => {
          const next: Record<string, string> = {};
          for (const s of gradeSubjects) { if (prev[s]) next[s] = prev[s]; }
          return next;
        });
      }
    }
    setFormCategory(stuCat);
    if (student.board) setFormBoard(student.board);
    // Section: category-based numbering
    const num = studentGrade ? getNextNumber(studentGrade, stuCat) : 1;
    const sec = autoSection(stuCat, num);
    setFormSection(sec);
    // Auto-generate batch name: "1:1 Class 12 C1 Student Name"
    const prefix = BATCH_TYPE_PREFIX['one_to_one'];
    const base = studentGrade ? `${prefix} Class ${studentGrade} ${sec}` : prefix;
    setFormName(`${base} ${selectedStudents[0].name}`.trim());
  }, [selectedStudents, formType, students]);


  const getMaxForType = (type: BatchType | ''): number => {
    if (!type) return 0;
    if (type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === type);
    return tpl?.maxStudents ?? 50;
  };

  const canProceedFromTemplate = formType !== '';
  const canProceedFromDetails = formName.trim() !== '' && formGrade !== '' && formCategory !== '';
  const canProceedFromTeachers = formSubjects.length > 0;
  const canSubmit = formType !== '' && formName.trim() !== '' && formGrade !== '';

  // ── Student selection ──────────────────────────────────────

  const filteredStudents = students.filter(s => {
    // For 1:1, don't filter by grade (student chooses first, grade auto-fills)
    // For other types, filter by batch grade if set
    if (formType !== 'one_to_one' && formGrade) {
      const batchGradeNum = formGrade; // e.g. "10"
      const studentGrade = s.grade || '';
      const studentGradeNum = studentGrade.replace(/^Class\s*/i, '');
      if (studentGradeNum !== batchGradeNum && studentGrade !== `Class ${batchGradeNum}`) {
        return false;
      }
    }
    // Filter by category (uses studentCategoryFilter which is synced with formCategory)
    if (studentCategoryFilter !== 'all' && s.category !== studentCategoryFilter) return false;
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
      if (maxReached) {
        toast.error(`Max ${getMaxForType(formType)} students for this batch type.`);
        return;
      }
      setSelectedStudents(prev => [
        ...prev,
        { email: person.email, name: person.full_name, parent_email: person.parent_email || null, parent_name: person.parent_name || null },
      ]);
    }
  };

  const removeStudent = (email: string) => {
    setSelectedStudents(prev => prev.filter(s => s.email !== email));
  };

  // ── Create user via reusable modal ────────────────────────

  const openCreateParent = (studentEmail: string) => {
    setParentForStudent(studentEmail);
    setCreateUserRole('parent');
    setShowCreateUser(true);
  };

  const handleUserCreated = async (data?: { email: string; full_name: string; temp_password: string }) => {
    if (data && parentForStudent) {
      // Auto-link created parent to the student (local state)
      setSelectedStudents(prev =>
        prev.map(s =>
          s.email === parentForStudent
            ? { ...s, parent_email: data.email, parent_name: data.full_name }
            : s
        )
      );
      setStudents(prev =>
        prev.map(s =>
          s.email === parentForStudent
            ? { ...s, parent_email: data.email, parent_name: data.full_name }
            : s
        )
      );
      // Link parent to student in the database
      try {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(parentForStudent)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_email: data.email }),
        });
      } catch (e) { console.error('Failed to link parent to student:', e); }
    }
    fetchPeople();
  };

  const handleCreateUserClose = () => {
    setShowCreateUser(false);
    setParentForStudent('');
  };

  // ── Create batch ──────────────────────────────────────────

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
        academic_operator_email: formAcademicOperator || null,
        max_students: formType === 'custom' ? (Number(formMaxStudents) || 50) : getMaxForType(formType),
        notes: formNotes || null,
        teachers: formSubjects
          .filter(s => subjectTeachers[s])
          .map(s => ({ email: subjectTeachers[s], subject: s })),
        students: selectedStudents.map(s => ({ email: s.email, parent_email: s.parent_email })),
      };
      const res = await fetch('/api/v1/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Batch created successfully!');
        closeWizard();
        fetchBatches();
      } else {
        toast.error(json.error || 'Failed to create batch');
      }
    } catch (e) { console.error(e); toast.error('Failed to create batch'); }
    setCreating(false);
  };

  // ── Delete batch ──────────────────────────────────────────

  const toggleBatchStatus = async (batchId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const ok = await confirm({
      title: newStatus === 'active' ? 'Activate Batch' : 'Deactivate Batch',
      message: newStatus === 'active'
        ? 'Mark this batch as active? Students and teachers will be able to access it.'
        : 'Mark this batch as inactive? It will be hidden from active views.',
      confirmLabel: newStatus === 'active' ? 'Activate' : 'Deactivate',
      variant: newStatus === 'active' ? 'info' : 'warning',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Batch marked as ${newStatus}`);
        fetchBatches();
        if (selectedBatch === batchId) fetchDetail(batchId);
      } else {
        toast.error(json.error || 'Failed to update status');
      }
    } catch (e) { console.error(e); toast.error('Failed to update status'); }
  };

  const deleteBatch = async (batchId: string) => {
    const ok = await confirm({
      title: 'Delete Batch',
      message: 'Permanently delete this batch and remove all student assignments?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batches/${batchId}?permanent=true`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Batch deleted');
        fetchBatches();
        if (selectedBatch === batchId) setSelectedBatch(null);
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch (e) { console.error(e); }
  };

  // ── Filtering ─────────────────────────────────────────────

  const filtered = batches.filter(b => {
    const matchSearch = !search ||
      b.batch_name.toLowerCase().includes(search.toLowerCase()) ||
      b.batch_id.toLowerCase().includes(search.toLowerCase()) ||
      (b.subjects || []).some(s => s.toLowerCase().includes(search.toLowerCase())) ||
      b.section?.toLowerCase().includes(search.toLowerCase()) ||
      b.coordinator_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.teachers?.some(t => t.teacher_name?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchType = typeFilter === 'all' || b.batch_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const counts = {
    all: batches.length,
    active: batches.filter(b => b.status === 'active').length,
    inactive: batches.filter(b => b.status === 'inactive').length,
    archived: batches.filter(b => b.status === 'archived').length,
  };

  // ── Wizard step indicator ─────────────────────────────────

  const wizardSteps = getWizardSteps(formType);
  const stepIdx = wizardSteps.findIndex(s => s.key === wizardStep);

  // ── Step 1: Template selection ─────────────────────────────

  const renderTemplateStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Choose Batch Type</h3>
      <p className="text-gray-500 mb-8">Select the type of batch you want to create</p>
      <div className="grid grid-cols-2 gap-5">
        {BATCH_TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          const isSelected = formType === tpl.type;
          return (
            <button
              key={tpl.type}
              type="button"
              onClick={() => setFormType(tpl.type)}
              className={`group relative p-6 rounded-2xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-primary/10 shadow-md ring-2 ring-primary/20'
                  : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-primary/5/30'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-primary/10 group-hover:text-primary'
              }`}>
                <Icon className="h-6 w-6" />
              </div>
              <h4 className={`text-base font-bold mb-1 ${isSelected ? 'text-primary' : 'text-gray-800'}`}>{tpl.label}</h4>
              <p className="text-sm text-gray-500 mb-3 leading-relaxed">{tpl.description}</p>
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                isSelected ? 'bg-primary/20 text-primary' : 'bg-gray-100 text-gray-600'
              }`}>
                Max: {tpl.maxStudents === 999 ? 'Custom' : `${tpl.maxStudents} student${tpl.maxStudents > 1 ? 's' : ''}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Step 2: Batch details ─────────────────────────────────

  const renderDetailsStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Batch Details</h3>
      <p className="text-gray-500 mb-8">Configure the basic information for this batch</p>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Grade" required>
            <Select value={formGrade} onChange={handleGradeChange}
              options={[{ value: '', label: 'Select Grade' }, ...GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]}
            />
          </FormField>
          <FormField label="Section (auto-assigned)">
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${
              formSection ? 'border-emerald-300 bg-primary/5' : 'border-gray-200 bg-gray-50'
            }`}>
              {formSection ? (
                <>
                  <span className="text-2xl font-bold text-primary">{formSection}</span>
                  <div className="text-sm">
                    <p className="font-semibold text-primary">Section {formSection}</p>
                    <p className="text-xs text-primary">
                      {getUsedSections(formGrade).length} section{getUsedSections(formGrade).length !== 1 ? 's' : ''} already used for Grade {formGrade}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">Select a grade to auto-assign section</p>
              )}
            </div>
          </FormField>
        </div>
        <FormField label="Batch Name" required>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Class 10 A" />
        </FormField>
        {/* Student category — A/B/C only, filters the Students step */}
        {formType !== 'one_to_one' && (
          <FormField label="Student Category" hint="Required. Determines section naming and filters student list.">
            <div className="flex gap-2">
              {[
                { value: 'A', label: 'Category A', color: 'border-primary/20 bg-primary/5 text-primary hover:border-primary' },
                { value: 'B', label: 'Category B', color: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400' },
                { value: 'C', label: 'Category C', color: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400' },
              ].map(opt => {
                const isActive = formCategory === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleCategoryChange(opt.value)}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      isActive
                        ? opt.value === 'A'
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-emerald-300'
                          : opt.value === 'B'
                          ? 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-300'
                          : 'border-amber-500 bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                        : opt.color
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </FormField>
        )}
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
                  const batchCount = batches.filter(b => b.coordinator_email === c.email).length;
                  return {
                    value: c.email,
                    label: `${c.full_name}${batchCount > 0 ? ` — ${batchCount} batch${batchCount > 1 ? 'es' : ''}` : ' — No batches'}`,
                  };
                }),
              ]}
            />
          </FormField>
        </div>
        <FormField label="Academic Operator">
          <Select value={formAcademicOperator} onChange={setFormAcademicOperator}
            options={[
              { value: '', label: 'Select Academic Operator' },
              ...academicOperators.map(ao => {
                const batchCount = batches.filter(b => b.academic_operator_email === ao.email).length;
                return {
                  value: ao.email,
                  label: `${ao.full_name}${batchCount > 0 ? ` — ${batchCount} batch${batchCount > 1 ? 'es' : ''}` : ' — No batches'}`,
                };
              }),
            ]}
          />
        </FormField>
        {formType === 'custom' && (
          <FormField label="Max Students">
            <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} placeholder="50" />
          </FormField>
        )}
        <FormField label="Notes">
          <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes about this batch…" rows={3} />
        </FormField>
      </div>
    </div>
  );

  // ── Step 3: Subjects & Teacher assignment ──────────────────

  const toggleSubject = (subj: string) => {
    setFormSubjects(prev => {
      if (prev.includes(subj)) {
        const next = prev.filter(s => s !== subj);
        // Also remove teacher assignment for removed subject
        setSubjectTeachers(st => {
          const copy = { ...st };
          delete copy[subj];
          return copy;
        });
        return next;
      }
      return [...prev, subj];
    });
  };

  const renderTeachersStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Subjects & Teachers</h3>
      <p className="text-gray-500 mb-8">Select subjects and assign a teacher to each one</p>

      {/* Subject display — auto-assigned for grades 8-10, manual toggle for others */}
      <div className="mb-8">
        {GRADE_SUBJECTS[formGrade] ? (
          <>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Subjects <span className="text-xs font-normal text-primary ml-1">(auto-assigned for Grade {formGrade})</span></label>
            <div className="flex flex-wrap gap-2.5">
              {formSubjects.map(subj => (
                <div key={subj} className="px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-primary bg-primary/5 text-primary shadow-sm">
                  <Check className="h-3.5 w-3.5 inline mr-1.5" />{subj}
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
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleSubject(subj)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all duration-150 ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:bg-primary/5/50'
                    }`}
                  >
                    {isSelected && <span className="mr-1.5"><Check className="h-3.5 w-3.5 inline" /></span>}
                    {subj}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">{formSubjects.length} of {SUBJECTS.length} subjects selected</p>
          </>
        )}
      </div>

      {/* Per-subject teacher assignment cards */}
      {formSubjects.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Assign Teachers
            <span className="ml-2 text-xs font-normal text-gray-400">
              {formSubjects.filter(s => subjectTeachers[s]).length} / {formSubjects.length} assigned
            </span>
          </label>
          <div className="space-y-3">
            {formSubjects.map(subj => {
              const assigned = !!subjectTeachers[subj];
              return (
                <div key={subj} className={`flex items-center gap-4 rounded-xl px-5 py-4 border-2 transition-all ${
                  assigned ? 'border-primary/20 bg-primary/5/50' : 'border-gray-200 bg-gray-50/50'
                }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    assigned ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-30">
                    <span className="text-sm font-semibold text-gray-800">{subj}</span>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={subjectTeachers[subj] || ''}
                      onChange={(val) => setSubjectTeachers(prev => ({ ...prev, [subj]: val }))}
                      options={[
                        { value: '', label: 'Select Teacher…' },
                        ...teachers
                          .filter(t => {
                            const tSubjects = t.subjects || [];
                            return tSubjects.length === 0 || tSubjects.some(ts => ts.toLowerCase() === subj.toLowerCase());
                          })
                          .map(t => ({
                            value: t.email,
                            label: `${t.full_name}${t.category ? ` [${t.category}]` : ''}${t.subjects ? ` (${t.subjects.join(', ')})` : ''}`,
                          })),
                      ]}
                    />
                  </div>
                  {assigned && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Teachers are filtered by their registered subjects.
          </p>
        </div>
      )}
    </div>
  );

  // ── Step 3: Add students + auto-assign parents ────────────

  const renderStudentsStep = () => {
    const max = getMaxForType(formType);
    const isOneToOne = formType === 'one_to_one';
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">{isOneToOne ? 'Select Student' : 'Add Students'}</h3>
        <p className="text-gray-500 mb-6">
          {isOneToOne
            ? 'Pick the student for this one-to-one batch. Details will auto-fill from their profile.'
            : 'Select students for this batch'}
        </p>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-semibold text-primary">{selectedStudents.length}</span>
              <span className="text-xs text-primary ml-1">/ {max === 999 ? '∞' : max}</span>
            </div>
            <span className="text-sm text-gray-500">{isOneToOne ? 'student selected' : 'students selected'}</span>
            {formGrade && !isOneToOne && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                Showing Class {formGrade} only
              </span>
            )}
            {formCategory && !isOneToOne && (
              <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                formCategory === 'A' ? 'bg-primary/10 text-primary' :
                formCategory === 'B' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                Cat {formCategory} pre-filtered
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FilterSelect
              value={studentCategoryFilter}
              onChange={setStudentCategoryFilter}
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'A', label: 'Category A' },
                { value: 'B', label: 'Category B' },
                { value: 'C', label: 'Category C' },
              ]}
            />
            <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" className="w-60!" />
          </div>
        </div>

        {/* Selected students with parent info */}
        {selectedStudents.length > 0 && (
          <div className="mb-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Students</h4>
            {selectedStudents.map(s => {
              const hasParent = !!s.parent_email;
              return (
                <div key={s.email} className="rounded-xl border-2 border-primary/20 overflow-hidden">
                  {/* Student row */}
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
                      {hasParent ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                          <CheckCircle className="h-3.5 w-3.5" /> Parent: {s.parent_name || s.parent_email}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openCreateParent(s.email); }}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-100 border-2 border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-200 hover:border-amber-400 transition-all shadow-sm cursor-pointer"
                        >
                          <AlertCircle className="h-4 w-4" /> No Parent — Click to Add
                        </button>
                      )}
                      <IconButton icon={X} onClick={() => removeStudent(s.email)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Available students list */}
        <div className="border rounded-xl max-h-72 overflow-y-auto">
          {peopleLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No students found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Current Batch</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Category</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  const catStyle = s.category ? CATEGORY_STYLES[s.category] : null;
                  const currentBatches: { batch_name: string }[] = Array.isArray(s.current_batches) ? s.current_batches : [];
                  return (
                    <tr
                      key={s.email}
                      className={`border-t hover:bg-primary/5/30 cursor-pointer transition-colors ${selected ? 'bg-primary/5/50' : ''}`}
                      onClick={() => toggleStudent(s)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{s.full_name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.grade || '—'}</td>
                      <td className="px-4 py-3">
                        {currentBatches.length > 0
                          ? <div className="flex flex-wrap gap-1">{currentBatches.map((b, i) => <span key={i} className="inline-block text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{b.batch_name}</span>)}</div>
                          : <span className="text-xs text-gray-300">None</span>}
                      </td>
                      <td className="px-4 py-3">
                        {catStyle ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {s.category}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.parent_email ? (
                          <span className="text-xs text-primary">{s.parent_name || s.parent_email}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            <AlertCircle className="h-3 w-3" /> No parent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {selected ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary font-medium"><CheckCircle className="h-3.5 w-3.5" /> Selected</span>
                        ) : maxReached ? (
                          <span className="text-xs text-gray-300">Max reached</span>
                        ) : (
                          <span className="text-xs text-gray-400 hover:text-primary">+ Add</span>
                        )}
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

  // ── Step 4: Review & submit ───────────────────────────────

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Review & Create</h3>
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
          <div><span className="text-gray-400">Acad. Operator:</span> <span className="font-medium text-gray-800">{academicOperators.find(a => a.email === formAcademicOperator)?.full_name || formAcademicOperator || '—'}</span></div>
          <div><span className="text-gray-400">Students:</span> <span className="font-medium text-gray-800">{selectedStudents.length}</span></div>
          <div><span className="text-gray-400">Category:</span> <span className="font-medium text-gray-800">{formCategory ? `Category ${formCategory}` : '—'}</span></div>
        </div>
      </div>

      {/* Subject → Teacher Assignments */}
      {formSubjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subjects & Teachers ({formSubjects.length})</h4>
          <div className="space-y-2">
            {formSubjects.map(subj => {
              const teacherEmail = subjectTeachers[subj];
              const teacher = teachers.find(t => t.email === teacherEmail);
              return (
                <div key={subj} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    teacher ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-gray-700 min-w-30">{subj}</span>
                  <span className="text-gray-300">→</span>
                  {teacher ? (
                    <span className="text-primary">{teacher.full_name}</span>
                  ) : (
                    <span className="text-amber-500 italic">No teacher assigned</span>
                  )}
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
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-gray-700">{s.name}</span>
                <span className="text-gray-400 text-xs">{s.email}</span>
                {s.parent_email ? (
                  <span className="ml-auto text-xs text-primary">Parent: {s.parent_name || s.parent_email}</span>
                ) : (
                  <span className="ml-auto text-xs text-amber-500">No parent assigned</span>
                )}
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

  // ── Wizard navigation ─────────────────────────────────────

  const goNext = () => {
    if (stepIdx < wizardSteps.length - 1) setWizardStep(wizardSteps[stepIdx + 1].key);
  };

  const goPrev = () => {
    if (stepIdx > 0) setWizardStep(wizardSteps[stepIdx - 1].key);
  };

  const canGoNext = (): boolean => {
    if (wizardStep === 'template') return canProceedFromTemplate;
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'teachers') return canProceedFromTeachers;
    if (wizardStep === 'students') {
      // For 1:1, require exactly 1 student before proceeding
      if (formType === 'one_to_one') return selectedStudents.length === 1;
      return true;
    }
    return false;
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* ── Header ── */}
        <PageHeader icon={Database} title="Batch Management" subtitle="Create and manage batches with template-based flow">
          {pageTab === 'batches' && (
            <>
              <RefreshButton loading={loading} onClick={fetchBatches} />
              <Button variant="primary" icon={Plus} onClick={openWizard}>New Batch</Button>
            </>
          )}
        </PageHeader>

        {/* ── Page section selector ── */}
        <FilterSelect
          value={pageTab}
          onChange={(k) => setPageTab(k as 'batches' | 'academics')}
          options={[{ value: 'batches', label: 'Batches' }, { value: 'academics', label: 'Academics' }]}
        />

        {/* ══════════════════════════════════════════════════════
            ACADEMICS TAB — Manage Subjects, Grades, Sections, Boards
           ══════════════════════════════════════════════════════ */}
        {pageTab === 'academics' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">Configure the academic options available when creating batches. Changes are saved instantly.</p>

            {settingsLoading ? (
              <LoadingState />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Subjects Card ── */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><BookOpen className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Subjects</h3>
                      <p className="text-xs text-gray-400">{SUBJECTS.length} subjects configured</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {SUBJECTS.map(s => (
                      <span key={s} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {s}
                        <button type="button" onClick={() => removeSettingItem('subjects', s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="New subject name…"
                      onKeyDown={e => { if (e.key === 'Enter') addSettingItem('subjects', newSubject); }} />
                    <Button variant="primary" size="sm" onClick={() => addSettingItem('subjects', newSubject)}
                      disabled={!newSubject.trim() || settingsSaving === 'subjects'}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* ── Grades Card ── */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><GraduationCap className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Grades</h3>
                      <p className="text-xs text-gray-400">{GRADES.length} grades configured</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {GRADES.map(g => (
                      <span key={g} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/5 text-primary border border-primary/20">
                        Grade {g}
                        <button type="button" onClick={() => removeSettingItem('grades', g)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="New grade (e.g. 13, KG)…"
                      onKeyDown={e => { if (e.key === 'Enter') addSettingItem('grades', newGrade); }} />
                    <Button variant="primary" size="sm" onClick={() => addSettingItem('grades', newGrade)}
                      disabled={!newGrade.trim() || settingsSaving === 'grades'}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* ── Sections Card ── */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center"><Layers className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Sections</h3>
                      <p className="text-xs text-gray-400">{SECTIONS.length} sections configured</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {SECTIONS.map(s => (
                      <span key={s} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        Section {s}
                        <button type="button" onClick={() => removeSettingItem('sections', s)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="New section (e.g. G, H)…"
                      onKeyDown={e => { if (e.key === 'Enter') addSettingItem('sections', newSection); }} />
                    <Button variant="primary" size="sm" onClick={() => addSettingItem('sections', newSection)}
                      disabled={!newSection.trim() || settingsSaving === 'sections'}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* ── Boards Card ── */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Settings className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Boards</h3>
                      <p className="text-xs text-gray-400">{BOARDS.length} boards configured</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {BOARDS.map(b => (
                      <span key={b} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {b}
                        <button type="button" onClick={() => removeSettingItem('boards', b)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newBoard} onChange={e => setNewBoard(e.target.value)} placeholder="New board name…"
                      onKeyDown={e => { if (e.key === 'Enter') addSettingItem('boards', newBoard); }} />
                    <Button variant="primary" size="sm" onClick={() => addSettingItem('boards', newBoard)}
                      disabled={!newBoard.trim() || settingsSaving === 'boards'}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            BATCHES TAB — Existing batch list + wizard
           ══════════════════════════════════════════════════════ */}
        {pageTab === 'batches' && (<>

        {/* ── Status filter ── */}
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: `All (${counts.all})` },
            { value: 'active', label: `Active (${counts.active})` },
            { value: 'inactive', label: `Inactive (${counts.inactive})` },
            { value: 'archived', label: `Archived (${counts.archived})` },
          ]}
        />

        {/* ── Filters row ── */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search batches by name, subject, teacher…" />
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all',              label: 'All Types' },
                { value: 'one_to_one',       label: '1:1 — Individual' },
                { value: 'one_to_three',     label: '1:3 — Small Group' },
                { value: 'one_to_fifteen',   label: '1:15 — Group Class' },
                { value: 'one_to_thirty',    label: '1:30 — Large Group' },
                { value: 'one_to_many',      label: '1:M — Large Classroom' },
                { value: 'lecture',          label: 'Lecture' },
                { value: 'improvement_batch', label: 'Improvement Batch' },
                { value: 'custom',           label: 'Custom' },
              ]}
            />
          </div>
        </div>

        {/* ── Create Wizard ── */}
        <WizardShell
          open={showCreate}
          onClose={closeWizard}
          title="New Batch"
          icon={Database}
          steps={wizardSteps.map(s => ({ label: s.label, desc: s.desc, icon: s.icon }))}
          currentStep={stepIdx}
          footer={
            <>
              <div>
                {stepIdx > 0 && (
                  <Button variant="outline" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>
                )}
              </div>
              <WizardFooterDots total={wizardSteps.length} current={stepIdx} />
              <div>
                {wizardStep !== 'review' ? (
                  <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">
                    Continue
                  </Button>
                ) : (
                  <Button variant="primary" icon={CheckCircle} onClick={submitBatch} disabled={!canSubmit || creating} size="lg">
                    {creating ? 'Creating…' : 'Create Batch'}
                  </Button>
                )}
              </div>
            </>
          }
        >
          {wizardStep === 'template' && renderTemplateStep()}
          {wizardStep === 'details' && renderDetailsStep()}
          {wizardStep === 'teachers' && renderTeachersStep()}
          {wizardStep === 'students' && renderStudentsStep()}
          {wizardStep === 'review' && renderReviewStep()}
        </WizardShell>

        {/* ── Table ── */}
        {loading && batches.length === 0 ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Database} message="No batches found" />
        ) : (
          <TableWrapper
            footer={
              <>
                <span>Showing {filtered.length} of {batches.length} batches</span>
                <span>{counts.active} active · {counts.inactive} inactive</span>
              </>
            }
          >
            <THead>
              <TH>Batch</TH>
              <TH>Type</TH>
              <TH>Subjects</TH>
              <TH>Grade</TH>
              <TH>Teachers</TH>
              <TH>Coordinator</TH>
              <TH>Acad. Operator</TH>
              <TH>Students</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody>
              {filtered.map(batch => {
                const isExpanded = selectedBatch === batch.batch_id;
                return (
                <React.Fragment key={batch.batch_id}>
                <TRow
                  selected={isExpanded}
                  onClick={() => setSelectedBatch(isExpanded ? null : batch.batch_id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-52">{batch.batch_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{batch.batch_id.slice(0, 18)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={batchTypeLabel(batch.batch_type)} variant={batchTypeBadgeVariant(batch.batch_type)} />
                  </td>
                  <td className="px-4 py-3">
                    {(batch.subjects && batch.subjects.length > 0) ? (
                      <div className="flex flex-wrap gap-1">
                        {batch.subjects.slice(0, 3).map(s => (
                          <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">{s}</span>
                        ))}
                        {batch.subjects.length > 3 && (
                          <span className="text-xs text-gray-400">+{batch.subjects.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> {batch.grade || '—'}{batch.section ? ` ${batch.section}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {batch.teachers && batch.teachers.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-700">{batch.teacher_count} teacher{batch.teacher_count !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-400 truncate max-w-36">
                          {batch.teachers.slice(0, 2).map(t => t.teacher_name || t.teacher_email).join(', ')}
                          {batch.teachers.length > 2 ? ` +${batch.teachers.length - 2}` : ''}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 truncate max-w-36">{batch.coordinator_name || '—'}</p>
                    {batch.coordinator_email && <p className="text-xs text-gray-400">{batch.coordinator_email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 truncate max-w-36">{batch.academic_operator_name || '—'}</p>
                    {batch.academic_operator_email && <p className="text-xs text-gray-400">{batch.academic_operator_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <Users className="h-3.5 w-3.5 text-gray-400" /> {batch.student_count}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={batch.status} /></td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={Power}
                        onClick={() => toggleBatchStatus(batch.batch_id, batch.status)}
                        className={batch.status === 'active' ? 'text-primary hover:bg-primary/5' : 'text-gray-400 hover:bg-gray-100'}
                        title={batch.status === 'active' ? 'Deactivate batch' : 'Activate batch'}
                      />
                      <IconButton
                        icon={Trash2}
                        onClick={() => deleteBatch(batch.batch_id)}
                        className="text-red-500 hover:bg-red-50"
                        title="Delete batch"
                      />
                    </div>
                  </td>
                </TRow>
                {/* Inline expanded detail row */}
                {isExpanded && (
                  <tr>
                    <td colSpan={10} className="bg-primary/5/40 border-b border-primary/15 px-6 py-5">
                      {detailLoading ? (
                        <div className="py-8 text-center text-sm text-gray-400">Loading batch details…</div>
                      ) : !detail ? (
                        <div className="py-8 text-center text-sm text-gray-400">Could not load batch details</div>
                      ) : (
                        <div className="space-y-5">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{detail.batch.batch_name}</h3>
                              <p className="text-xs text-gray-400 font-mono">{detail.batch.batch_id}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedBatch(null); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white transition">
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <InfoCard label="Status"><StatusBadge status={detail.batch.status} /></InfoCard>
                            <InfoCard label="Type"><Badge label={batchTypeLabel(detail.batch.batch_type)} variant={batchTypeBadgeVariant(detail.batch.batch_type)} /></InfoCard>
                            <InfoCard label="Grade / Section">
                              <p className="text-sm font-medium text-gray-800">Grade {detail.batch.grade || '—'}{detail.batch.section ? ` ${detail.batch.section}` : ''}</p>
                            </InfoCard>
                            <InfoCard label="Board">
                              <p className="text-sm font-medium text-gray-800">{detail.batch.board || '—'}</p>
                            </InfoCard>
                          </div>

                          {/* Subjects */}
                          <InfoCard label="Subjects">
                            {(detail.batch.subjects && detail.batch.subjects.length > 0) ? (
                              <div className="flex flex-wrap gap-1.5">
                                {detail.batch.subjects.map(s => (
                                  <span key={s} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{s}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">No subjects assigned</p>
                            )}
                          </InfoCard>

                          {/* Teachers — per-subject */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-blue-400" /> Subject Teachers ({detail.teachers?.length || 0})
                            </h4>
                            {(!detail.teachers || detail.teachers.length === 0) ? (
                              <EmptyState message="No teachers assigned yet" />
                            ) : (
                              <div className="space-y-2">
                                {detail.teachers.map(t => (
                                  <div key={`${t.subject}-${t.teacher_email}`} className="flex items-center gap-3 bg-white border rounded-lg px-4 py-2.5">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 min-w-25">{t.subject}</span>
                                    <span className="text-gray-400">→</span>
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{t.teacher_name || t.teacher_email}</p>
                                      <p className="text-xs text-gray-400">{t.teacher_email}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <InfoCard label="Coordinator">
                              <p className="text-sm font-medium text-gray-800">{detail.batch.coordinator_name || '—'}</p>
                              {detail.batch.coordinator_email && <p className="text-xs text-gray-400">{detail.batch.coordinator_email}</p>}
                            </InfoCard>
                            <InfoCard label="Academic Operator">
                              <p className="text-sm font-medium text-gray-800">{detail.batch.academic_operator_name || '—'}</p>
                              {detail.batch.academic_operator_email && <p className="text-xs text-gray-400">{detail.batch.academic_operator_email}</p>}
                            </InfoCard>
                            <InfoCard label="Max Students">
                              <p className="text-sm font-medium text-gray-800">{detail.batch.max_students}</p>
                            </InfoCard>
                          </div>

                          {/* Students */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-400" /> Students ({detail.students.length})
                            </h4>
                            {detail.students.length === 0 ? (
                              <EmptyState message="No students enrolled yet" />
                            ) : (
                              <TableWrapper>
                                <THead>
                                  <TH>Student</TH>
                                  <TH>Email</TH>
                                  <TH>Attendance</TH>
                                  <TH>Parent Name</TH>
                                  <TH>Parent Email</TH>
                                  <TH>Parent Phone</TH>
                                  <TH>Added</TH>
                                </THead>
                                <tbody>
                                  {detail.students.map(s => (
                                    <TRow key={s.student_email}>
                                      <td className="px-3 py-2 font-medium text-gray-800">{s.student_name || s.student_email}</td>
                                      <td className="px-3 py-2 text-gray-500 text-xs">{s.student_email}</td>
                                      <td className="px-3 py-2">
                                        {(s.total_classes ?? 0) > 0 ? (
                                          <div className="space-y-1">
                                            <span className={`text-xs font-semibold ${
                                              (s.attendance_rate ?? 0) >= 75 ? 'text-primary' :
                                              (s.attendance_rate ?? 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                                            }`}>{s.attendance_rate ?? 0}%</span>
                                            <p className="text-xs text-gray-400">{s.present}/{s.total_classes} attended</p>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-300">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        {s.parent_name ? (
                                          <span className="text-sm text-gray-800 font-medium">{s.parent_name}</span>
                                        ) : (
                                          <span className="text-xs text-amber-500">Not assigned</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        {s.parent_email ? (
                                          <span className="text-xs text-primary">{s.parent_email}</span>
                                        ) : (
                                          <span className="text-xs text-gray-300">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        {s.parent_phone ? (
                                          <span className="text-xs text-gray-600">{s.parent_phone}</span>
                                        ) : (
                                          <span className="text-xs text-gray-300">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-400">
                                        {new Date(s.added_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </td>
                                    </TRow>
                                  ))}
                                </tbody>
                              </TableWrapper>
                            )}
                          </div>

                          {detail.batch.notes && (
                            <InfoCard label="Notes">
                              <p className="text-sm text-gray-600">{detail.batch.notes}</p>
                            </InfoCard>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </TableWrapper>
        )}

        </>)}{/* end pageTab === 'batches' */}
      </div>

      {/* Reusable Create User Modal (parent creation from batch wizard) */}
      <CreateUserModal
        role={createUserRole}
        open={showCreateUser}
        onClose={handleCreateUserClose}
        onCreated={handleUserCreated}
        fixedRole
        title={parentForStudent ? `Create Parent for Student` : undefined}
        subtitle={parentForStudent ? `A parent account will be linked to ${parentForStudent}` : undefined}
      />
    </DashboardShell>
  );
}
