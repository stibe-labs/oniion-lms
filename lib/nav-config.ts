// ═══════════════════════════════════════════════════════════════
// stibe Portal — Centralized Navigation Config
// ═══════════════════════════════════════════════════════════════
// Single source of truth for sidebar nav items per role.
// DashboardShell auto-resolves the active item from pathname.
// ═══════════════════════════════════════════════════════════════

import {
  LayoutDashboard,
  Database,
  Users,
  CreditCard,
  BarChart3,
  BookOpen,
  Eye,
  Shield,
  GraduationCap,
  XCircle,
  Award,
  Briefcase,
  Monitor,
  UserCog,
  MessageSquare,
  ClipboardList,
  Calendar,
  CalendarClock,
  Bell,
  FileText,
  Brain,
  Activity,
  User,
  Star,
  FolderOpen,
  CheckCircle2,
  Trophy,
  ListChecks,
  DollarSign,
  Send,
  Layers,
  PlayCircle,
  Flag,
  ClipboardCheck,
  UserPlus,
  Video,
  Radio,
  Tv,
  Settings,
  Settings2,
  Palette,
  Sparkles,
  Plug,
  type LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If set, this nav item is only shown when the user has this permission */
  permissionKey?: string;
  /** If set, renders a section divider label above this item in the sidebar */
  sectionLabel?: string;
}

/* ── Per-role nav definitions ── */

const OWNER_NAV: NavItemConfig[] = [
  { label: 'Overview',        href: '/owner',                 icon: LayoutDashboard },
  { label: 'Live Monitor',    href: '/owner/live',            icon: Tv },
  { label: 'Sessions',        href: '/owner#sessions',        icon: BookOpen },
  { label: 'Meetings',        href: '/owner#meetings',        icon: Radio },
  { label: 'Users',           href: '/owner#users',           icon: Users },
  { label: 'Finance',         href: '/owner#finance',         icon: CreditCard },
  { label: 'Invoices',        href: '/owner/invoices',        icon: FileText },
  { label: 'Enrollment Fees', href: '/owner/invoices?section=enrollment', icon: DollarSign },
  { label: 'Payroll Monitor', href: '/owner#payroll',         icon: Briefcase },
  { label: 'Approvals',       href: '/owner#approvals',       icon: CheckCircle2 },
  { label: 'Reports',         href: '/owner/reports',         icon: BarChart3 },
  { label: 'Admins',          href: '/owner/admins',          icon: UserPlus },
  { label: 'Roles',           href: '/owner/roles',           icon: UserCog },
  { label: 'System',          href: '/owner/system',          icon: Shield },
];

const BATCH_COORDINATOR_NAV: NavItemConfig[] = [
  { label: 'Overview',        href: '/batch-coordinator',                 icon: LayoutDashboard },
  { label: 'Live Monitor',    href: '/batch-coordinator/live',            icon: Activity },
  { label: 'Batches',         href: '/batch-coordinator#batches',         icon: BookOpen },
  { label: 'Students',        href: '/batch-coordinator#students',        icon: GraduationCap },
  { label: 'Teachers',        href: '/batch-coordinator#teachers',        icon: Users },
  { label: 'Student Reports', href: '/batch-coordinator#student-reports', icon: BarChart3 },
  { label: 'Teacher Reports', href: '/batch-coordinator#teacher-reports', icon: Flag },
];

const ACADEMIC_OPERATOR_NAV: NavItemConfig[] = [
  { label: 'Overview',    href: '/academic-operator',                   icon: LayoutDashboard },
  { label: "Today's Live",   href: '/academic-operator#todays-live',    icon: Tv },
  { label: 'Students',    href: '/academic-operator#students',          icon: GraduationCap },
  { label: 'Teachers',    href: '/academic-operator#teachers',          icon: Users },
  { label: 'Batches',     href: '/academic-operator#batches',           icon: BookOpen },
  { label: 'Leave Requests', href: '/academic-operator#requests',          icon: ClipboardList },
  { label: 'Materials',   href: '/academic-operator#materials',         icon: FolderOpen },
  { label: 'Exam Questions', href: '/academic-operator#exam-topics',       icon: ClipboardCheck },
  { label: 'Teacher Reports', href: '/academic-operator#teacher-reports', icon: Flag },
  { label: 'Payments',        href: '/academic-operator#payments',        icon: CreditCard },
  { label: 'Demo',        href: '/academic-operator#demo',              icon: PlayCircle },
  { label: 'Conference',   href: '/academic-operator#conference',        icon: Video },
  { label: 'Open Classroom', href: '/academic-operator#open-classroom',  icon: Radio },
  { label: 'Settings',      href: '/academic-operator#settings',        icon: Settings },
];

const HR_NAV: NavItemConfig[] = [
  { label: 'Overview',      href: '/hr',                icon: LayoutDashboard },
  { label: 'Teachers',      href: '/hr#teachers',       icon: BookOpen },
  { label: 'Coordinators',  href: '/hr#coordinators',   icon: Users },
  { label: 'Acad. Operators', href: '/hr#academic_operators', icon: Briefcase },
  { label: 'Ghost Observers', href: '/hr#ghost_observers', icon: Eye },
  { label: 'Cancellations', href: '/hr#cancellations',  icon: XCircle,       permissionKey: 'cancellations_manage' },
  { label: 'Attendance',    href: '/hr#attendance',     icon: ClipboardList, permissionKey: 'attendance_view' },
  { label: 'Payroll',       href: '/hr#payroll',        icon: CreditCard,    permissionKey: 'payroll_manage' },
  { label: 'Fee Rates',     href: '/hr#fee_rates',      icon: DollarSign },
  { label: 'Leave Requests', href: '/hr#leave_requests', icon: CalendarClock },
  // HR Credentials tab is owner-only — shown by owner-grouped tab bar, not sidebar nav
];

const TEACHER_NAV: NavItemConfig[] = [
  { label: 'Overview',       href: '/teacher',             icon: LayoutDashboard },
  { label: 'My Batches',        href: '/teacher#batches',  icon: BookOpen },
  { label: 'Weekly Schedule',    href: '/teacher#schedule', icon: Calendar },
  { label: 'Homework',       href: '/teacher#homework',    icon: ListChecks },
  { label: 'Exams',          href: '/teacher/exams',       icon: Award,          permissionKey: 'exams_create' },
  { label: 'Questions',      href: '/teacher#questions',   icon: ClipboardCheck },
  { label: 'Salary',         href: '/teacher#salary',      icon: CreditCard,     permissionKey: 'salary_view' },
  { label: 'Ratings',        href: '/teacher#ratings',     icon: Star },
  { label: 'Materials',      href: '/teacher#materials',   icon: FolderOpen },
  { label: 'Leave Requests', href: '/teacher#leave',       icon: CalendarClock },
  { label: 'Demo',           href: '/teacher#demo',        icon: PlayCircle },
];

const STUDENT_NAV: NavItemConfig[] = [
  { label: 'Overview',    href: '/student',              icon: LayoutDashboard },
  { label: 'Classes',     href: '/student#batches',      icon: BookOpen },
  { label: 'Attendance',  href: '/student#attendance',   icon: CheckCircle2 },
  { label: 'Exams',       href: '/student#exams',        icon: Trophy,         permissionKey: 'exams_view' },
  { label: 'Homework',    href: '/student#homework',     icon: ClipboardCheck },
  { label: 'Fees',        href: '/student#fees',         icon: CreditCard,     permissionKey: 'fees_view' },
];

const PARENT_NAV: NavItemConfig[] = [
  { label: 'Overview',    href: '/parent',             icon: LayoutDashboard },
  { label: 'Classes',     href: '/parent#classes',     icon: Calendar },
  { label: 'Attendance',  href: '/parent#attendance',  icon: ClipboardList,  permissionKey: 'attendance_view' },
  { label: 'Exams',       href: '/parent#exams',       icon: GraduationCap,  permissionKey: 'exams_view' },
  { label: 'Fee Ledger',  href: '/parent#fees',        icon: CreditCard,     permissionKey: 'fees_view' },
  { label: 'Reports',     href: '/parent#reports',     icon: BarChart3,      permissionKey: 'reports_view' },
];

const GHOST_NAV: NavItemConfig[] = [
  { label: 'Overview',  href: '/ghost',          icon: LayoutDashboard },
  { label: 'Observe',   href: '/ghost',          icon: Eye, permissionKey: 'ghost_observe' },
  { label: 'Oversight',  href: '/ghost/monitor',  icon: Monitor, permissionKey: 'ghost_observe' },
  { label: 'By Batch',   href: '/ghost#batch',    icon: BookOpen, permissionKey: 'ghost_observe' },
  { label: 'By Teacher',  href: '/ghost#teacher',  icon: User, permissionKey: 'ghost_observe' },
];

const SALES_NAV: NavItemConfig[] = [
  { label: 'Overview',    href: '/sales',              icon: LayoutDashboard },
  { label: 'Leads',       href: '/sales#leads',        icon: Users },
  { label: 'Pipeline',    href: '/sales#pipeline',     icon: Layers },
  { label: 'Activities',  href: '/sales#activities',   icon: ClipboardList },
  { label: 'Reminders',   href: '/sales#reminders',    icon: Bell },
  { label: 'Reports',     href: '/sales#reports',      icon: BarChart3 },
];

const SUPERADMIN_NAV: NavItemConfig[] = [
  { label: 'Overview',      href: '/superadmin',                          icon: LayoutDashboard },
  { label: 'General',       href: '/superadmin/settings#general',         icon: Settings2,  sectionLabel: 'Settings' },
  { label: 'Branding',      href: '/superadmin/settings#branding',        icon: Palette },
  { label: 'Appearance',    href: '/superadmin/settings#appearance',      icon: Sparkles },
  { label: 'Integrations',  href: '/superadmin/settings#integrations',    icon: Plug },
];

const ROLE_NAV: Record<string, NavItemConfig[]> = {
  superadmin:        SUPERADMIN_NAV,
  owner:             OWNER_NAV,
  batch_coordinator: BATCH_COORDINATOR_NAV,
  academic_operator: ACADEMIC_OPERATOR_NAV,
  hr:                HR_NAV,
  teacher:           TEACHER_NAV,
  student:           STUDENT_NAV,
  parent:            PARENT_NAV,
  ghost:             GHOST_NAV,
  sales:             SALES_NAV,
};

/** Get the nav items for a given role, optionally filtered by permissions */
export function getNavForRole(
  role: string,
  permissions?: Record<string, boolean>,
): NavItemConfig[] {
  const items = ROLE_NAV[role] ?? [];
  if (!permissions) return items;
  return items.filter(item => {
    if (!item.permissionKey) return true;
    return permissions[item.permissionKey] !== false;
  });
}

/** Resolve the active nav item based on current pathname.
 *  Picks the item whose base href (sans hash) is the longest prefix match. */
export function resolveActiveNav(
  items: NavItemConfig[],
  pathname: string,
  currentHash?: string,
  currentSearch?: string,
): (NavItemConfig & { active: boolean })[] {
  const fullPath = pathname + (currentHash || '');
  let bestIdx = 0;
  let bestLen = 0;

  items.forEach((item, idx) => {
    const hasQuery = item.href.includes('?') && !item.href.includes('#');
    const hasHash = item.href.includes('#');
    if (hasQuery) {
      // For query-param nav items, match pathname + search exactly
      const [base, query] = item.href.split('?');
      if ((pathname === base || pathname.startsWith(base + '/')) && currentSearch === '?' + query) {
        const matchLen = item.href.length + 10; // boost so it wins over plain pathname match
        if (matchLen > bestLen) { bestLen = matchLen; bestIdx = idx; }
      }
    } else if (hasHash) {
      // For hash-based nav items, match pathname + hash exactly
      const [base, hash] = item.href.split('#');
      if ((pathname === base || pathname.startsWith(base + '/')) && currentHash === '#' + hash) {
        const matchLen = item.href.length;
        if (matchLen > bestLen) { bestLen = matchLen; bestIdx = idx; }
      }
    } else {
      // For non-hash nav items, match by pathname prefix
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        // Only pick this if no hash-based item matched and no hash is present
        if (item.href.length > bestLen && !currentHash) {
          bestLen = item.href.length;
          bestIdx = idx;
        } else if (item.href.length > bestLen && bestLen === 0) {
          // Fallback: if nothing matched yet, use this as default
          bestLen = item.href.length;
          bestIdx = idx;
        }
      }
    }
  });

  return items.map((item, idx) => ({ ...item, active: idx === bestIdx }));
}
