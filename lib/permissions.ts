// ═══════════════════════════════════════════════════════════════
// stibe Portal — Permissions Configuration
// ═══════════════════════════════════════════════════════════════
// Defines all available permissions, default role permissions,
// and utility functions for merging and checking permissions.
// ═══════════════════════════════════════════════════════════════

import {
  Video, Users, ClipboardList, BookOpen,
  CreditCard, BarChart3, Eye, MessageSquare,
  type LucideIcon,
} from 'lucide-react';

// ── Permission Definition ────────────────────────────────────

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  category: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
  icon: LucideIcon;
}

// ── Categories ───────────────────────────────────────────────

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { key: 'rooms',         label: 'Room Management',     icon: Video },
  { key: 'users',         label: 'User Management',     icon: Users },
  { key: 'attendance',    label: 'Attendance',           icon: ClipboardList },
  { key: 'exams',         label: 'Exams',                icon: BookOpen },
  { key: 'finance',       label: 'Fees & Finance',       icon: CreditCard },
  { key: 'reports',       label: 'Reports & Analytics',  icon: BarChart3 },
  { key: 'observation',   label: 'Observation',          icon: Eye },
  { key: 'communication', label: 'Communication',        icon: MessageSquare },
];

// ── All Permission Definitions ───────────────────────────────

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Room Management
  { key: 'rooms_create',    label: 'Create Rooms',    description: 'Create new classroom rooms',      category: 'rooms' },
  { key: 'rooms_manage',    label: 'Manage Rooms',    description: 'Start, end, cancel rooms',        category: 'rooms' },
  { key: 'rooms_view',      label: 'View Rooms',      description: 'View scheduled and past rooms',   category: 'rooms' },
  { key: 'batches_create',  label: 'Create Batches',  description: 'Create new student batches',      category: 'rooms' },
  { key: 'batches_manage',  label: 'Manage Batches',  description: 'Edit, archive, delete batches',   category: 'rooms' },

  // User Management
  { key: 'users_create',          label: 'Create Users',      description: 'Create new user accounts',       category: 'users' },
  { key: 'users_edit',            label: 'Edit Users',        description: 'Edit user details and profiles', category: 'users' },
  { key: 'users_deactivate',      label: 'Activate / Deactivate', description: 'Toggle user active/inactive status', category: 'users' },
  { key: 'users_reset_password',  label: 'Reset Passwords',   description: 'Reset user passwords',           category: 'users' },
  { key: 'users_view',            label: 'View Users',        description: 'View user listing',              category: 'users' },
  { key: 'admissions_manage',     label: 'Manage Admissions', description: 'Handle student admissions',      category: 'users' },
  { key: 'cancellations_manage',  label: 'Manage Cancellations', description: 'Handle cancellations',        category: 'users' },

  // Attendance
  { key: 'attendance_view', label: 'View Attendance', description: 'View attendance records',  category: 'attendance' },
  { key: 'attendance_mark', label: 'Mark Attendance', description: 'Mark student attendance',  category: 'attendance' },

  // Exams
  { key: 'exams_create', label: 'Create Exams',  description: 'Create and manage exams',        category: 'exams' },
  { key: 'exams_grade',  label: 'Grade Exams',   description: 'Enter marks and grade exams',    category: 'exams' },
  { key: 'exams_view',   label: 'View Exams',    description: 'View exam schedules and results', category: 'exams' },
  { key: 'exams_take',   label: 'Take Exams',    description: 'Attempt assigned exams',          category: 'exams' },

  // Finance
  { key: 'fees_view',      label: 'View Fees',       description: 'View fee structures and invoices', category: 'finance' },
  { key: 'fees_manage',    label: 'Manage Fees',     description: 'Create and edit fee structures',   category: 'finance' },
  { key: 'payments_view',  label: 'View Payments',   description: 'View payment records',             category: 'finance' },
  { key: 'salary_view',    label: 'View Salary',     description: 'View salary / payroll information', category: 'finance' },
  { key: 'payroll_manage', label: 'Manage Payroll',  description: 'Process payroll',                   category: 'finance' },

  // Reports
  { key: 'reports_view', label: 'View Reports', description: 'Access analytics and reports', category: 'reports' },

  // Observation
  { key: 'ghost_observe', label: 'Observe Live', description: 'Silently observe live rooms', category: 'observation' },

  // Communication
  { key: 'complaints_file',    label: 'File Complaints',    description: 'File and manage complaints',  category: 'communication' },
  { key: 'notifications_send', label: 'Send Notifications', description: 'Send notifications to users', category: 'communication' },
];

// ── Default Role Permissions ─────────────────────────────────
// Which permissions each role gets by default.
// Only list permissions that are relevant to a role.
// `true` = enabled by default, `false` = disabled by default (can be turned on by owner).

export const ROLE_DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  // Batch Coordinator: manages assigned batches only.
  // Schedules sessions, assigns teachers, live monitoring, attendance, student support.
  // Cannot create batches, cannot access finance or global user management.
  batch_coordinator: {
    rooms_create:          true,
    rooms_manage:          true,
    rooms_view:            true,
    batches_create:        false,
    batches_manage:        true,   // assign teachers, manage sessions within batch
    attendance_view:       true,
    attendance_mark:       true,
    admissions_manage:     true,   // add/remove students within assigned batches
    cancellations_manage:  true,
    notifications_send:    true,
    ghost_observe:         true,   // can silently monitor live classes
    reports_view:          true,   // batch-level reports only
    fees_view:             false,
    users_view:            false,
    users_create:          false,
    users_edit:            false,
  },

  // Academic Operator: overall operations manager.
  // Adds students manually, verifies CRM-sourced students, verifies payments,
  // assigns students to batches, assigns coordinators, ghost monitors all batches, full reports.
  // Does NOT schedule sessions (BC does that) or teach.
  academic_operator: {
    rooms_create:          false,  // BC schedules/creates sessions, not AO
    rooms_manage:          false,
    rooms_view:            true,
    batches_create:        true,   // AO creates batches
    batches_manage:        true,   // AO assigns coordinators, edits batch config
    attendance_view:       true,
    admissions_manage:     true,   // add students manually, assign to batches
    cancellations_manage:  true,   // approve/reject refund and cancellation requests
    notifications_send:    true,
    ghost_observe:         true,   // ghost-monitor any live class
    reports_view:          true,   // full reports across all batches
    fees_view:             true,   // verify payments, view invoices
    fees_manage:           true,   // generate invoices, adjust credits
    payments_view:         true,   // verify payment status of students
    users_view:            true,
    users_create:          true,   // manually add new students/teachers
    users_edit:            true,
    users_deactivate:      true,   // block/unblock students
    users_reset_password:  true,
  },

  hr: {
    users_view:           true,
    users_create:         true,
    users_edit:           true,
    users_deactivate:     true,
    users_reset_password: true,
    cancellations_manage: true,
    attendance_view:      true,
    payroll_manage:       true,
    salary_view:          true,
    reports_view:         false,
  },

  teacher: {
    rooms_view:       true,
    attendance_view:  true,
    attendance_mark:  true,
    exams_create:     true,
    exams_grade:      true,
    salary_view:      true,
    reports_view:     false,
  },

  student: {
    rooms_view:       true,
    attendance_view:  true,
    exams_view:       true,
    exams_take:       true,
    fees_view:        true,
    reports_view:     false,
  },

  parent: {
    attendance_view:  true,
    exams_view:       true,
    fees_view:        true,
    complaints_file:  true,
    reports_view:     false,
  },

  ghost: {
    ghost_observe:    true,
    rooms_view:       true,
    attendance_view:  false,
    reports_view:     false,
  },

  sales: {
    reports_view:        true,
    users_view:          false,
    notifications_send:  true,  // sales team sends demo links via WhatsApp
  },
};

// ── Permission Types ─────────────────────────────────────────

export type PermissionMap = Record<string, boolean>;

// ── Utility Functions ────────────────────────────────────────

/**
 * Get the applicable permissions for a role.
 * Returns only the permission keys that are relevant to this role.
 */
export function getApplicablePermissions(role: string): PermissionDef[] {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role];
  if (!defaults) return [];
  const keys = new Set(Object.keys(defaults));
  return ALL_PERMISSIONS.filter(p => keys.has(p.key));
}

/**
 * Get the applicable categories for a role (only categories that have at least one permission).
 */
export function getApplicableCategories(role: string): PermissionCategory[] {
  const perms = getApplicablePermissions(role);
  const cats = new Set(perms.map(p => p.category));
  return PERMISSION_CATEGORIES.filter(c => cats.has(c.key));
}

/**
 * Merge role defaults with custom permission overrides.
 * Returns the effective permission map for a user.
 */
export function mergePermissions(
  role: string,
  customPermissions: PermissionMap = {},
): PermissionMap {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? {};
  return { ...defaults, ...customPermissions };
}

/**
 * Check if a user has a specific permission.
 * Owner always returns true.
 */
export function hasPermission(
  role: string,
  permissionKey: string,
  customPermissions: PermissionMap = {},
): boolean {
  if (role === 'owner') return true;
  const merged = mergePermissions(role, customPermissions);
  return merged[permissionKey] === true;
}

/**
 * Get the list of custom overrides (permissions that differ from defaults).
 */
export function getCustomOverrides(
  role: string,
  customPermissions: PermissionMap,
): PermissionMap {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? {};
  const overrides: PermissionMap = {};
  for (const [key, value] of Object.entries(customPermissions)) {
    if (key in defaults && defaults[key] !== value) {
      overrides[key] = value;
    }
  }
  return overrides;
}

/**
 * Count how many permissions are customized (differ from defaults).
 */
export function countCustomOverrides(
  role: string,
  customPermissions: PermissionMap,
): number {
  return Object.keys(getCustomOverrides(role, customPermissions)).length;
}
