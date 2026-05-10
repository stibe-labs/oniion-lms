// ═══════════════════════════════════════════════════════════════
// Reusable Create User Form — used by HR Module & Batch Wizard
// Contains all role-specific fields, email check, credentials panel
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ImageCropModal from '@/components/dashboard/ImageCropModal';
import {
  FormField, FormGrid, Input, Textarea, Select, Alert, Button,
  RoleBadge,
} from '@/components/dashboard/shared';
import {
  UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2, CheckCircle, Check,
  ChevronDown, ChevronLeft, ChevronRight, X, GraduationCap, Users, User, BookOpen, Shield, Ghost,
  FileText, Camera,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────

export const SUBJECTS = [
  // Sciences
  'Physics', 'Chemistry', 'Biology', 'Mathematics',
  // Social Sciences
  'Social Science', 'History', 'Geography', 'Political Science', 'Sociology', 'Psychology',
  // Commerce
  'Accountancy', 'Business Studies', 'Economics',
  // Computer & Tech
  'Computer Science', 'Informatics Practices',
  // Languages
  'English', 'Hindi', 'Malayalam', 'Arabic', 'Sanskrit', 'Urdu', 'Tamil', 'Kannada',
  // Others
  'Physical Education', 'Home Science', 'Fine Arts', 'Music',
];

export const CATEGORIES = ['A', 'B', 'C'] as const;
export type StudentCategory = (typeof CATEGORIES)[number];

/** Map demo exam grade letter → A/B/C category */
export function examGradeToCategory(grade: string): StudentCategory {
  if (['A+', 'A'].includes(grade)) return 'A';
  if (['B+', 'B'].includes(grade)) return 'B';
  return 'C'; // C+, C, D, F
}

export const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  A: { bg: 'bg-primary/5', text: 'text-primary', border: 'border-primary/20', label: 'Category A' },
  B: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    label: 'Category B' },
  C: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Category C' },
};
export const GRADES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
export const BOARDS = [
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
  'Others',
];
export const STUDENT_REGIONS = [
  { value: 'Dubai', label: '🇦🇪 Dubai (GST, UTC+4)' },
  { value: 'Abu Dhabi', label: '🇦🇪 Abu Dhabi (GST, UTC+4)' },
  { value: 'Sharjah', label: '🇦🇪 Sharjah (GST, UTC+4)' },
  { value: 'Ajman', label: '🇦🇪 Ajman (GST, UTC+4)' },
  { value: 'Saudi Arabia', label: '🇸🇦 Saudi Arabia (AST, UTC+3)' },
  { value: 'Qatar', label: '🇶🇦 Qatar (AST, UTC+3)' },
  { value: 'Kuwait', label: '🇰🇼 Kuwait (AST, UTC+3)' },
  { value: 'Bahrain', label: '🇧🇭 Bahrain (AST, UTC+3)' },
  { value: 'Oman', label: '🇴🇲 Oman (GST, UTC+4)' },
  { value: 'India', label: '🇮🇳 India (IST, UTC+5:30)' },
  { value: 'Malaysia', label: '🇲🇾 Malaysia (MYT, UTC+8)' },
  { value: 'Singapore', label: '🇸🇬 Singapore (SGT, UTC+8)' },
  { value: 'UK', label: '🇬🇧 United Kingdom (GMT/BST)' },
  { value: 'USA', label: '🇺🇸 United States (multiple)' },
  { value: 'Other', label: '🌍 Other' },
];
export const QUALIFICATIONS = [
  'B.Ed', 'M.Ed', 'B.Sc', 'M.Sc', 'B.A', 'M.A', 'B.Com', 'M.Com',
  'MBA', 'BBA', 'Ph.D', 'D.El.Ed', 'B.Tech', 'M.Tech', 'PGDM',
];

export const ROLE_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  batch_coordinator: 'Batch Coordinator',
  academic_operator: 'Academic Operator',
  hr: 'HR Associate',
  ghost: 'Ghost Observer',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  teacher: GraduationCap,
  student: BookOpen,
  parent: Users,
  batch_coordinator: Shield,
  academic_operator: Shield,
  hr: User,
  ghost: Ghost,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  teacher: 'Teach subjects, conduct sessions, grade students',
  student: 'Enroll in batches, attend sessions, view grades',
  parent: 'Monitor student progress, receive notifications',
  batch_coordinator: 'Manage batches, coordinate teachers & students',
  academic_operator: 'Oversee academic operations and quality',
  hr: 'Manage users, onboarding, accounts',
  ghost: 'Silent observer, audit & monitoring access',
};

// ─── PwdInput ───────────────────────────────────────────────

export function PwdInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Leave blank to auto-generate'}
      />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── SubjectSelector ────────────────────────────────────────

export function SubjectSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (s: string) => {
    if (selected.includes(s)) onChange(selected.filter((x) => x !== s));
    else onChange([...selected, s]);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-left hover:border-gray-300 transition-colors">
        <span className={selected.length ? 'text-gray-900' : 'text-gray-400'}>
          {selected.length ? selected.join(', ') : 'Select subjects...'}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-52 overflow-y-auto">
          {SUBJECTS.map((s) => (
            <label key={s}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm text-gray-700">{s}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md bg-primary/5 text-primary px-2 py-0.5 text-xs font-medium">
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-emerald-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── QualificationSelector ──────────────────────────────────

export function QualificationSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPreset = QUALIFICATIONS.includes(value);
  const isOther = value !== '' && !isPreset;
  const [showCustom, setShowCustom] = useState(isOther);

  const handleSelect = (v: string) => {
    if (v === '__other__') {
      setShowCustom(true);
      onChange('');
    } else {
      setShowCustom(false);
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={showCustom ? '__other__' : value}
        onChange={handleSelect}
        options={[
          ...QUALIFICATIONS.map((q) => ({ value: q, label: q })),
          { value: '__other__', label: 'Other (type below)' },
        ]}
        placeholder="— Select qualification —"
      />
      {showCustom && (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your qualification..."
          autoFocus
        />
      )}
    </div>
  );
}

// ─── CredentialsPanel ───────────────────────────────────────

export function CredentialsPanel({
  name, email, password, role, onDone, onAddAnother,
}: {
  name: string; email: string; password: string; role: string;
  onDone: () => void; onAddAnother?: () => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const copy = async (text: string, which: 'email' | 'pwd') => {
    await navigator.clipboard.writeText(text);
    if (which === 'email') { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }
    else { setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 2000); }
  };

  return (
    <div className="space-y-5">
      <Alert variant="success" message={`Account created successfully — credentials emailed to ${name}`} />

      <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Account Holder</p>
            <p className="mt-0.5 font-medium text-gray-900">{name}</p>
          </div>
          <RoleBadge role={role} />
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Login Email</p>
            <p className="mt-0.5 font-mono text-sm text-primary truncate">{email}</p>
          </div>
          <Button variant={copiedEmail ? 'success' : 'secondary'} size="xs" onClick={() => copy(email, 'email')}>
            {copiedEmail ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Temporary Password</p>
            <p className="mt-0.5 font-mono text-base font-bold tracking-widest text-gray-900">{password}</p>
          </div>
          <Button variant={copiedPwd ? 'success' : 'secondary'} size="xs" onClick={() => copy(password, 'pwd')}>
            {copiedPwd ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      <Alert variant="info" message={`An email with these credentials has been sent to ${email}. The user should change their password after first login.`} />

      <div className="flex gap-3">
        {onAddAnother && (
          <Button variant="secondary" className="flex-1" icon={UserPlus} onClick={onAddAnother}>Add Another</Button>
        )}
        <Button variant="primary" className="flex-1" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

// ─── CreateUserModal — fully self-contained reusable modal ──

interface CreateUserModalProps {
  role: string;
  open: boolean;
  onClose: () => void;
  onCreated: (data?: { email: string; full_name: string; temp_password: string }) => void;
  /** If true, show a compact version without modal wrapper (for embedding) */
  embedded?: boolean;
  /** Pre-set role is fixed and cannot be changed */
  fixedRole?: boolean;
  /** Title override */
  title?: string;
  /** Subtitle override */
  subtitle?: string;
  /** Pre-fill form fields (e.g. from demo student data) */
  initialData?: {
    email?: string;
    full_name?: string;
    phone?: string;
    grade?: string;
    board?: string;
    subject?: string;
    category?: string;
    notes?: string;
  };
}

export function CreateUserModal({
  role: initialRole, open, onClose, onCreated, embedded, title, subtitle, initialData,
}: CreateUserModalProps) {
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({
    email: '', full_name: '', password: '',
    phone: '', phoneCode: '+91', whatsapp: '', address: '', qualification: '', notes: '', experience_years: '',
    per_hour_rate: '',
    subjects: [] as string[],
    grade: 'Class 10', section: '', board: 'CBSE', parent_email: '', parent_name: '', parent_password: '', admission_date: new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10),
    assigned_region: '',
    category: '' as string,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [parentEmailStatus, setParentEmailStatus] = useState<'idle' | 'checking' | 'exists' | 'new' | 'wrong_role'>('idle');
  const [parentEmailRole, setParentEmailRole] = useState<string>('');
  const parentEmailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ── Dynamic step definitions (per role) ──
  type StepKey = 'basic' | 'teaching' | 'academic' | 'guardian' | 'notes' | 'review';

  const STEPS: { key: StepKey; label: string; icon: React.ElementType; desc: string }[] = (() => {
    const s: { key: StepKey; label: string; icon: React.ElementType; desc: string }[] = [
      { key: 'basic', label: 'Basic Info', icon: User, desc: 'Name, email, password & contact' },
    ];
    if (role === 'teacher')
      s.push({ key: 'teaching', label: 'Teaching Details', icon: GraduationCap, desc: 'Subjects, qualification & experience' });
    if (role === 'student') {
      s.push({ key: 'academic', label: 'Academic Details', icon: BookOpen, desc: 'Grade, board & admission' });
      s.push({ key: 'guardian', label: 'Guardian Details', icon: Users, desc: 'Parent / guardian account' });
    }
    s.push({ key: 'notes', label: 'Internal Notes', icon: FileText, desc: 'HR notes & remarks' });
    s.push({ key: 'review', label: 'Review', icon: CheckCircle, desc: 'Confirm & create' });
    return s;
  })();

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx]?.key || 'basic';

  // Sync role if parent changes it
  useEffect(() => { setRole(initialRole); }, [initialRole]);

  // Reset step when opening
  useEffect(() => {
    if (open) { setStepIdx(0); setCreated(null); resetForm(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const f = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const resetForm = () => {
    // Parse phone: if starts with +91, split into code + number
    let phoneCode = '+91';
    let phoneNum = '';
    if (initialData?.phone) {
      const p = initialData.phone.replace(/[\s\-()]/g, '');
      if (p.startsWith('+')) {
        // Try to extract country code (assume +XX or +XXX)
        const match = p.match(/^(\+\d{1,3})(\d+)$/);
        if (match) { phoneCode = match[1]; phoneNum = match[2]; }
        else phoneNum = p.replace(/^\+/, '');
      } else {
        phoneNum = p;
      }
    }
    // Map grade string to "Class N" format
    let gradeStr = 'Class 10';
    if (initialData?.grade) {
      const g = initialData.grade.trim();
      if (/^\d+$/.test(g)) gradeStr = `Class ${g}`;
      else if (g.toLowerCase().startsWith('class')) gradeStr = g;
      else gradeStr = g;
    }
    setForm({
      email: initialData?.email || '', full_name: initialData?.full_name || '', password: '',
      phone: phoneNum, phoneCode, whatsapp: '', address: '', qualification: '',
      notes: initialData?.notes || '', experience_years: '',
      per_hour_rate: '',
      subjects: initialData?.subject ? [initialData.subject] : [], grade: gradeStr, section: '', board: initialData?.board || 'CBSE',
      parent_email: '', parent_name: '', parent_password: '', admission_date: new Date().toISOString().slice(0, 10), assigned_region: '',
      category: initialData?.category || '',
    });
    setEmailStatus('idle');
    setParentEmailStatus('idle');
    setParentEmailRole('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setCropSrc(null);
    setError('');
  };

  // Debounced email existence check
  useEffect(() => {
    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    emailTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`);
        const data = await res.json();
        setEmailStatus(data.success ? 'taken' : 'available');
      } catch {
        setEmailStatus('idle');
      }
    }, 500);
    return () => { if (emailTimerRef.current) clearTimeout(emailTimerRef.current); };
  }, [form.email]);

  // Debounced parent email existence check
  useEffect(() => {
    const email = form.parent_email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setParentEmailStatus('idle');
      return;
    }
    setParentEmailStatus('checking');
    if (parentEmailTimerRef.current) clearTimeout(parentEmailTimerRef.current);
    parentEmailTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success && data.data?.user) {
          const existingRole = data.data.user.role as string;
          if (existingRole === 'parent') {
            setParentEmailStatus('exists');
            setParentEmailRole('');
            f('parent_name', data.data.user.full_name || '');
          } else {
            // Email exists but is not a parent account
            setParentEmailStatus('wrong_role');
            setParentEmailRole(existingRole);
            f('parent_name', '');
          }
        } else {
          setParentEmailStatus('new');
          setParentEmailRole('');
          f('parent_name', '');
        }
      } catch {
        setParentEmailStatus('idle');
      }
    }, 500);
    return () => { if (parentEmailTimerRef.current) clearTimeout(parentEmailTimerRef.current); };
  }, [form.parent_email]);

  // ── Step validation ──
  const isStepValid = (step: StepKey): boolean => {
    switch (step) {
      case 'basic': {
        const baseValid = !!(form.full_name.trim() && form.email.trim() && form.email.includes('@') && emailStatus !== 'taken');
        if (role === 'student') return baseValid && !!form.phone.trim() && !!form.address.trim();
        if (role === 'teacher') return baseValid && !!form.phone.trim() && !!form.address.trim();
        return baseValid;
      }
      case 'teaching': return role !== 'teacher' || (
        form.subjects.length > 0 && !!form.qualification.trim() && !!form.experience_years.trim() && !!form.per_hour_rate.trim()
      );
      case 'academic': return true;
      case 'guardian': return role !== 'student' || (
        !!(form.parent_email.trim() && form.parent_email.includes('@') && form.parent_name.trim()) &&
        parentEmailStatus !== 'checking' && parentEmailStatus !== 'wrong_role'
      );
      case 'notes': return true;
      case 'review': return isStepValid('basic');
      default: return true;
    }
  };

  const canGoNext = () => isStepValid(currentStep);
  const goNext = () => { if (stepIdx < STEPS.length - 1 && canGoNext()) setStepIdx(stepIdx + 1); };
  const goPrev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  const handleSubmit = async () => {
    setError('');
    if (!form.email.trim() || !form.full_name.trim()) { setError('Email and name are required'); setStepIdx(0); return; }
    if (role === 'student' && !form.phone.trim()) { setError('Phone number is required for students'); setStepIdx(0); return; }
    if (role === 'student' && !form.address.trim()) { setError('Address is required for students'); setStepIdx(0); return; }
    if (role === 'teacher' && !form.phone.trim()) { setError('Mobile number is required for teachers'); setStepIdx(0); return; }
    if (role === 'teacher' && !form.address.trim()) { setError('Address is required for teachers'); setStepIdx(0); return; }
    // Profile photo is optional for teachers
    if (role === 'teacher' && form.subjects.length === 0) { setError('Please select at least one subject'); setStepIdx(1); return; }
    if (role === 'teacher' && !form.qualification.trim()) { setError('Qualification is required for teachers'); setStepIdx(1); return; }
    if (role === 'teacher' && !form.experience_years.trim()) { setError('Experience is required for teachers'); setStepIdx(1); return; }
    if (role === 'teacher' && !form.per_hour_rate.trim()) { setError('Per hour rate is required for teachers'); setStepIdx(1); return; }
    if (role === 'student' && (!form.parent_email.trim() || !form.parent_email.includes('@'))) { setError('Parent / Guardian email is required'); return; }
    if (role === 'student' && !form.parent_name.trim()) { setError('Parent / Guardian name is required'); return; }
    if (emailStatus === 'taken') { setError('This email already exists in the system'); setStepIdx(0); return; }

    const fullPhone = form.phone.trim() ? `${form.phoneCode} ${form.phone.trim()}` : '';

    const payload: Record<string, unknown> = {
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      portal_role: role,
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
      ...(fullPhone ? { phone: fullPhone } : {}),
      ...((role === 'student' || role === 'teacher') && fullPhone ? { whatsapp: fullPhone } : form.whatsapp.trim() ? { whatsapp: form.whatsapp.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
      ...(form.qualification.trim() ? { qualification: form.qualification.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    if (role === 'teacher') {
      if (form.subjects.length > 0) payload.subjects = form.subjects;
      if (form.experience_years) payload.experience_years = Number(form.experience_years);
      if (form.per_hour_rate) payload.per_hour_rate = Math.round(Number(form.per_hour_rate));
      if (form.category) payload.category = form.category;
    }
    if (role === 'student') {
      payload.grade = form.grade;
      if (form.section.trim()) payload.section = form.section.trim();
      payload.board = form.board;
      payload.parent_email = form.parent_email.trim().toLowerCase();
      payload.parent_name = form.parent_name.trim();
      if (form.parent_password.trim()) payload.parent_password = form.parent_password.trim();
      if (form.admission_date) payload.admission_date = form.admission_date;
      if (form.assigned_region) payload.assigned_region = form.assigned_region;
      if (form.category) payload.category = form.category;
    }
    if (role === 'academic_operator') {
      if (form.qualification.trim()) payload.qualification = form.qualification.trim();
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/hr/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to create account'); return; }
      // Upload avatar if one was selected (teachers)
      if (avatarFile && data.data?.email) {
        try {
          const fd = new FormData();
          fd.append('image', avatarFile);
          await fetch(`/api/v1/hr/users/${encodeURIComponent(data.data.email)}/avatar`, { method: 'POST', body: fd });
        } catch { /* non-critical */ }
      }
      onCreated({
        email: data.data.email,
        full_name: data.data.full_name,
        temp_password: data.data.temp_password || '(emailed)',
      });
      setCreated({
        name: data.data.full_name,
        email: data.data.email,
        password: data.data.temp_password || '(emailed)',
      });
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  if (!open) return null;

  const RoleIcon = ROLE_ICONS[role] || UserPlus;
  const roleLabel = title || (created ? 'Credentials Issued' : `New ${ROLE_LABELS[role] || role}`);
  const roleDesc = subtitle || ROLE_DESCRIPTIONS[role] || 'Fill in the details below';

  // ── Step content renderers ──

  const renderBasicStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
        <p className="text-sm text-gray-500 mt-1">Name, email, password &amp; contact details</p>
      </div>
      {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

      {/* Avatar upload — teacher only */}
      {role === 'teacher' && (
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Preview" className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center ring-2 ring-red-200">
                <Camera className="h-8 w-8 text-red-300" />
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 transition"
              title="Upload photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Profile Photo <span className="text-gray-400 text-xs font-normal">(optional)</span></p>
            <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG or WebP, max 3 MB</p>
            {avatarFile && (
              <button
                type="button"
                onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                className="mt-1.5 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Remove photo
              </button>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                setCropSrc(ev.target?.result as string);
                setCropFileName(file.name);
              };
              reader.readAsDataURL(file);
              if (avatarInputRef.current) avatarInputRef.current.value = '';
            }}
          />
        </div>
      )}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          fileName={cropFileName}
          onCropComplete={(file, previewUrl) => {
            setAvatarFile(file);
            setAvatarPreview(previewUrl);
            setCropSrc(null);
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <FormGrid cols={2}>
        <FormField label="Full Name" required>
          <Input type="text" required value={form.full_name} onChange={(e) => f('full_name', e.target.value)} placeholder="e.g. Priya Sharma" />
        </FormField>
        <FormField label="Email Address" required
          hint={emailStatus === 'checking' ? 'Checking...' : emailStatus === 'taken' ? 'Email already exists' : emailStatus === 'available' ? 'Available' : undefined}>
          <div className="relative">
            <Input type="email" required value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="e.g. priya@gmail.com"
              className={emailStatus === 'taken' ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : emailStatus === 'available' ? 'border-primary focus:border-primary focus:ring-primary/20' : ''} />
            {emailStatus === 'checking' && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            )}
            {emailStatus === 'taken' && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />}
            {emailStatus === 'available' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />}
          </div>
        </FormField>
      </FormGrid>
      <FormField label="Password" hint="Optional — a secure password will be auto-generated if left blank">
        <PwdInput value={form.password} onChange={(v) => f('password', v)} />
      </FormField>
      <FormGrid cols={role === 'student' || role === 'teacher' ? 1 : 2}>
        <FormField label={role === 'student' || role === 'teacher' ? 'Phone / WhatsApp *' : 'Phone / WhatsApp'}>
          <div className="flex gap-2">
            <select
              value={form.phoneCode}
              onChange={(e) => f('phoneCode', e.target.value)}
              className="w-24 shrink-0 rounded-lg border border-gray-200 bg-white py-2 px-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="+91">🇮🇳 +91</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+966">🇸🇦 +966</option>
              <option value="+974">🇶🇦 +974</option>
              <option value="+968">🇴🇲 +968</option>
              <option value="+973">🇧🇭 +973</option>
              <option value="+965">🇰🇼 +965</option>
              <option value="+60">🇲🇾 +60</option>
              <option value="+65">🇸🇬 +65</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+49">🇩🇪 +49</option>
              <option value="+33">🇫🇷 +33</option>
              <option value="+81">🇯🇵 +81</option>
              <option value="+86">🇨🇳 +86</option>
            </select>
            <Input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => f('phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" className="flex-1" />
          </div>
        </FormField>
        {role !== 'student' && role !== 'teacher' && (
          <FormField label="WhatsApp Number">
            <Input type="tel" value={form.whatsapp} onChange={(e) => f('whatsapp', e.target.value)} placeholder="+91 98765 43210" />
          </FormField>
        )}
      </FormGrid>
      <FormField label={role === 'student' || role === 'teacher' ? 'Address *' : 'Address'}>
        <Textarea rows={2} value={form.address} onChange={(e) => f('address', e.target.value)} placeholder="Full address..." />
      </FormField>
      {(role === 'batch_coordinator' || role === 'academic_operator') && (
        <FormField label="Qualification">
          <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
        </FormField>
      )}
    </div>
  );

  // ── Teaching Details step (teacher only) ──
  const renderTeachingStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Teaching Details</h2>
        <p className="text-sm text-gray-500 mt-1">Subjects, qualification, and experience</p>
      </div>
      <FormField label="Subjects *" hint="Select at least one">
        <SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} />
      </FormField>
      <FormGrid cols={2}>
        <FormField label="Qualification *">
          <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
        </FormField>
        <FormField label="Experience (years) *">
          <Input type="number" min={0} max={50} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)} placeholder="e.g. 5" />
        </FormField>
      </FormGrid>
      <FormGrid cols={2}>
        <FormField label="Per Hour Rate *" hint="Amount per teaching hour">
          <Input type="number" min={0} step={1} value={form.per_hour_rate} onChange={(e) => f('per_hour_rate', e.target.value)} placeholder="e.g. 500" />
        </FormField>
        <FormField label="Category" hint="Teacher performance tier">
          <Select value={form.category} onChange={(v) => f('category', v)} options={[
            { value: '', label: '— No Category —' },
            { value: 'A', label: 'Category A — Top Tier' },
            { value: 'B', label: 'Category B — Mid Tier' },
            { value: 'C', label: 'Category C — Entry Tier' },
          ]} />
        </FormField>
      </FormGrid>
    </div>
  );

  // ── Academic Details step (student only) ──
  const renderAcademicStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Academic Details</h2>
        <p className="text-sm text-gray-500 mt-1">Grade, board, and admission information</p>
      </div>
      <FormGrid cols={2}>
        <FormField label="Grade" required>
          <Select value={form.grade} onChange={(v) => f('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} />
        </FormField>
        <FormField label="Board" required>
          <Select value={form.board} onChange={(v) => f('board', v)} options={BOARDS.map(b => ({ value: b, label: b }))} />
        </FormField>
      </FormGrid>
      <FormGrid cols={2}>
        <FormField label="Admission Date">
          <Input type="date" value={form.admission_date} onChange={(e) => f('admission_date', e.target.value)} />
        </FormField>
        <FormField label="Category" hint={form.category ? undefined : 'Auto-set from demo exam if available'}>
          <Select value={form.category} onChange={(v) => f('category', v)} options={[
            { value: '', label: '— No Category —' },
            { value: 'A', label: 'Category A — High Performer' },
            { value: 'B', label: 'Category B — Average' },
            { value: 'C', label: 'Category C — Needs Support' },
          ]} />
        </FormField>
      </FormGrid>
      <FormField label="Region" required hint="Helps schedule sessions in the right timezone">
        <Select value={form.assigned_region} onChange={(v) => f('assigned_region', v)} options={[
          { value: '', label: '— Select Region —' },
          ...STUDENT_REGIONS.map(r => ({ value: r.value, label: r.label })),
        ]} />
      </FormField>

    </div>
  );

  // ── Guardian Details step (student only) ──
  const renderGuardianStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Guardian Details</h2>
        <p className="text-sm text-gray-500 mt-1">Parent or guardian account — will be auto-created if it doesn&apos;t exist</p>
      </div>
      <FormField label="Parent / Guardian Email *">
        <div className="relative">
          <Input
            type="email"
            value={form.parent_email}
            onChange={(e) => f('parent_email', e.target.value)}
            placeholder="parent@gmail.com"
            className="pr-9"
          />
          {parentEmailStatus === 'checking' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
          {parentEmailStatus === 'exists' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />}
          {parentEmailStatus === 'wrong_role' && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />}
          {parentEmailStatus === 'new' && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />}
        </div>
        {parentEmailStatus === 'exists' && (
          <p className="text-xs text-primary mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Existing parent account — student will be linked automatically</p>
        )}
        {parentEmailStatus === 'wrong_role' && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> This email belongs to a {parentEmailRole} account — please use a different email for the parent</p>
        )}
        {parentEmailStatus === 'new' && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> New parent account will be created and credentials emailed</p>
        )}
      </FormField>
      <FormField label="Parent Full Name *">
        <Input
          type="text"
          value={form.parent_name}
          onChange={(e) => f('parent_name', e.target.value)}
          placeholder="e.g. Rajesh Sharma"
          readOnly={parentEmailStatus === 'exists'}
          className={parentEmailStatus === 'exists' ? 'bg-gray-50 text-gray-500' : ''}
        />
        {parentEmailStatus === 'exists' && (
          <p className="text-xs text-gray-400 mt-1">Auto-filled from existing account</p>
        )}
      </FormField>
      {parentEmailStatus !== 'exists' && (
        <FormField label="Parent Password" hint="Leave blank to auto-generate">
          <PwdInput value={form.parent_password} onChange={(v) => f('parent_password', v)} />
        </FormField>
      )}
    </div>
  );



  const renderNotesStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Internal Notes</h3>
        <p className="text-sm text-gray-400 mt-1">Add any internal HR notes or remarks about this user.</p>
      </div>
      <FormField label="Notes (internal)">
        <Textarea rows={4} value={form.notes} onChange={(e) => f('notes', e.target.value)} placeholder="Any internal HR notes..." />
      </FormField>
    </div>
  );

  const renderReviewStep = () => {

    const rows: { label: string; value: string }[] = [
      { label: 'Full Name', value: form.full_name },
      { label: 'Email', value: form.email },
      { label: 'Role', value: ROLE_LABELS[role] || role },
      { label: 'Password', value: form.password ? '••••••••' : 'Auto-generated' },
    ];
    if (form.phone) rows.push({ label: 'Phone / WhatsApp', value: `${form.phoneCode} ${form.phone}` });
    if (role !== 'student' && role !== 'teacher' && form.whatsapp) rows.push({ label: 'WhatsApp', value: form.whatsapp });
    if (role === 'teacher') {
      if (form.subjects.length) rows.push({ label: 'Subjects', value: form.subjects.join(', ') });
      if (form.qualification) rows.push({ label: 'Qualification', value: form.qualification });
      if (form.experience_years) rows.push({ label: 'Experience', value: `${form.experience_years} years` });
      if (form.per_hour_rate) rows.push({ label: 'Per Hour Rate', value: `₹${form.per_hour_rate}` });
    }
    if (role === 'student') {
      rows.push({ label: 'Grade', value: form.grade });
      if (form.section) rows.push({ label: 'Section', value: form.section });
      rows.push({ label: 'Board', value: form.board });
      if (form.parent_email) {
        rows.push({ label: 'Parent Email', value: form.parent_email });
        if (form.parent_name) rows.push({ label: 'Parent Name', value: form.parent_name });
        rows.push({ label: 'Parent Password', value: form.parent_password ? '••••••••' : 'Auto-generated' });
      }
      if (form.admission_date) rows.push({ label: 'Admission Date', value: form.admission_date });
    }
    if (role === 'batch_coordinator' && form.qualification) {
      rows.push({ label: 'Qualification', value: form.qualification });
    }
    if (role === 'academic_operator' && form.qualification) {
      rows.push({ label: 'Qualification', value: form.qualification });
    }
    if (form.address) rows.push({ label: 'Address', value: form.address });
    if (form.notes) rows.push({ label: 'Notes', value: form.notes });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review &amp; Create</h2>
          <p className="text-sm text-gray-500 mt-1">Confirm the details below before creating the account</p>
        </div>
        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 divide-y divide-gray-100 overflow-hidden">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-500 font-medium">{r.label}</span>
              <span className="text-sm text-gray-900 font-semibold text-right max-w-xs truncate">{r.value || '—'}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
          <p className="text-sm text-primary">
            <strong>Ready to create!</strong> Credentials will be emailed to <strong>{form.email}</strong> automatically.
          </p>
        </div>
      </div>
    );
  };

  // ── Credentials screen (after creation) ──
  if (created) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="w-60 bg-linear-to-b from-primary via-primary/90 to-secondary p-6 flex flex-col shrink-0">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg">Account Created</h2>
              <p className="text-primary/60 text-xs mt-1">Credentials issued successfully</p>
            </div>
            <div className="flex-1" />
            <button onClick={onClose} className="mt-4 text-primary/60 hover:text-white text-xs flex items-center gap-2 transition">
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
              <CredentialsPanel
                name={created.name}
                email={created.email}
                password={created.password}
                role={role}
                onDone={onClose}
                onAddAnother={() => { setCreated(null); resetForm(); setStepIdx(0); }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Embedded mode ──
  if (embedded) {
    return (
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
        {renderBasicStep()}
        {role === 'teacher' && renderTeachingStep()}
        {role === 'student' && renderAcademicStep()}
        {role === 'student' && renderGuardianStep()}
        {renderNotesStep()}
      </form>
    );
  }

  // ── Full-screen step-by-step overlay (same design as batch wizard) ──
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left sidebar — step indicator ── */}
        <div className="w-60 bg-linear-to-b from-primary via-primary/90 to-secondary p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <RoleIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">{roleLabel}</h2>
            <p className="text-primary/60 text-xs mt-1">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>

          <div className="space-y-1 flex-1">
            {STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const StepIcon = step.icon;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => { if (idx < stepIdx) setStepIdx(idx); }}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all text-left ${
                    isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-primary/60 hover:bg-white/10 cursor-pointer' : 'text-primary/50 cursor-default'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-primary text-emerald-900' : isCurrent ? 'bg-white text-primary' : 'bg-primary/30 text-primary/80/70'
                  }`}>
                    {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
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

        {/* ── Right content area — one step at a time ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
            {currentStep === 'basic' && renderBasicStep()}
            {currentStep === 'teaching' && renderTeachingStep()}
            {currentStep === 'academic' && renderAcademicStep()}
            {currentStep === 'guardian' && renderGuardianStep()}
            {currentStep === 'notes' && renderNotesStep()}
            {currentStep === 'review' && renderReviewStep()}
          </div>

          {/* ── Footer navigation (matches batch wizard) ── */}
          <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
            <div>
              {stepIdx > 0 && (
                <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentStep !== 'review' ? (
                <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">
                  Continue
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={UserPlus}
                  loading={submitting}
                  disabled={submitting || emailStatus === 'taken' || !form.full_name.trim() || !form.email.trim()}
                  onClick={handleSubmit}
                  size="lg"
                >
                  Create &amp; Send Credentials
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}