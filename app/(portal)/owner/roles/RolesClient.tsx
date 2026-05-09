// ═══════════════════════════════════════════════════════════════
// Owner → Roles & Credentials — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FilterSelect, Toggle,
  FormField, Input, Modal, Alert,
  TableWrapper, THead, TH, TRow,
  InfoCard,
  LoadingState, EmptyState, Badge, RoleBadge, ActiveIndicator,
  useToast, useConfirm, Avatar, ROLE_CONFIG,
} from '@/components/dashboard/shared';
import {
  ROLE_DEFAULT_PERMISSIONS,
  PERMISSION_CATEGORIES,
  ALL_PERMISSIONS,
  getApplicablePermissions,
  getApplicableCategories,
  mergePermissions,
  countCustomOverrides,
  type PermissionMap,
} from '@/lib/permissions';
import type { PortalRole } from '@/types';
import {
  Shield, Users, Search, Pencil, X, Check,
  Eye, EyeOff, Filter, ChevronDown, ChevronUp,
  Loader2, Mail, User, KeyRound, AlertCircle,
  Settings2, RotateCcw, Save, Power,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface RoleUser {
  email: string;
  full_name: string;
  is_active: boolean;
  plain_password: string | null;
  has_password: boolean;
  custom_permissions: PermissionMap;
}

interface RoleData {
  role: string;
  total: number;
  active: number;
  inactive: number;
  users: RoleUser[];
}

interface RolesClientProps {
  userName: string;
  userEmail: string;
  userRole: PortalRole;
}

// ── Role display labels ──────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner:             'Owner',
  batch_coordinator: 'Batch Coordinator',
  academic_operator: 'Academic Operator',
  academic:          'Academic (Legacy)',
  hr:                'HR Associate',
  teacher:           'Teacher',
  teacher_screen:    'Teacher Screen',
  student:           'Student',
  parent:            'Parent',
  ghost:             'Ghost Observer',
};

// ── Edit Modal (uses shared Modal + FormField + Input + Button) ──

interface EditModalProps {
  user: RoleUser & { role: string };
  onClose: () => void;
  onSaved: (updatedEmail: string, oldEmail: string, newPassword?: string) => void;
}

function EditModal({ user, onClose, onSaved }: EditModalProps) {
  const [newEmail, setNewEmail]       = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const toast = useToast();

  const emailChanged    = newEmail.trim().toLowerCase() !== user.email.toLowerCase();
  const passwordChanged = newPassword.trim().length > 0;
  const hasChanges      = emailChanged || passwordChanged;

  async function handleSave() {
    setError('');
    if (!hasChanges) { setError('No changes to save.'); return; }

    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (emailChanged)    body.new_email    = newEmail.trim().toLowerCase();
      if (passwordChanged) body.new_password = newPassword.trim();
      const res = await fetch(
        `/api/v1/owner/users/${encodeURIComponent(user.email)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!data.success) { setError(data.error ?? 'Save failed'); return; }
      toast.success('Credentials updated successfully');
      onSaved(
        emailChanged ? newEmail.trim().toLowerCase() : user.email,
        user.email,
        passwordChanged ? newPassword.trim() : undefined
      );
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Credentials" maxWidth="lg">
      <div className="space-y-5">
        {/* ── User identity header ── */}
        <div className="flex items-center gap-4 rounded-xl bg-gray-50 border border-gray-100 p-4">
          <Avatar name={user.full_name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
          <ActiveIndicator active={user.is_active} />
        </div>

        {/* ── Email section ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
              <Mail className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Email Address</span>
            {emailChanged && (
              <span className="ml-auto text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Changed</span>
            )}
          </div>
          <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" />
        </div>

        {/* ── Password section ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
              <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Password</span>
          </div>

          {/* Current password display */}
          {user.plain_password ? (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Current Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-gray-800 select-all">
                  {showCurrent ? user.plain_password : '•'.repeat(Math.max(user.plain_password.length, 8))}
                </code>
                <button
                  onClick={() => setShowCurrent(v => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition"
                >
                  {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 text-center">
              <p className="text-xs text-gray-400">{user.has_password ? 'Password is set (hash only)' : 'No password set'}</p>
            </div>
          )}

          {/* New password input */}
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">New Password</p>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition font-mono"
              />
              <button
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {passwordChanged && (
              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Password will be updated on save
              </p>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

        {/* ── Actions ── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            {hasChanges && (
              <p className="text-[11px] text-gray-400">
                {[emailChanged && 'email', passwordChanged && 'password'].filter(Boolean).join(' & ')} will be updated
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon={Check} onClick={handleSave} loading={saving} disabled={!hasChanges}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Permissions Panel (inline in expanded row) ───────────────

interface PermissionsPanelProps {
  userEmail: string;
  userRole: string;
  customPermissions: PermissionMap;
  onSaved: (updated: PermissionMap) => void;
}

function PermissionsPanel({ userEmail, userRole, customPermissions, onSaved }: PermissionsPanelProps) {
  const defaults = ROLE_DEFAULT_PERMISSIONS[userRole] ?? {};
  const applicablePerms = getApplicablePermissions(userRole);
  const applicableCats = getApplicableCategories(userRole);
  const toast = useToast();

  // Local editable state — starts from the effective (merged) values
  const [localPerms, setLocalPerms] = useState<PermissionMap>(() =>
    mergePermissions(userRole, customPermissions)
  );
  const [saving, setSaving] = useState(false);

  // Detect changes: compare localPerms against the effective perms based on stored custom_permissions
  const currentEffective = mergePermissions(userRole, customPermissions);
  const hasChanges = applicablePerms.some(
    p => localPerms[p.key] !== currentEffective[p.key]
  );

  // Count how many differ from role defaults
  const customCount = applicablePerms.filter(
    p => localPerms[p.key] !== defaults[p.key]
  ).length;

  function handleToggle(key: string, value: boolean) {
    setLocalPerms(prev => ({ ...prev, [key]: value }));
  }

  function handleResetToDefaults() {
    setLocalPerms({ ...defaults });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/owner/permissions/${encodeURIComponent(userEmail)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: localPerms }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error ?? 'Failed to save permissions');
        return;
      }
      toast.success('Permissions updated');
      onSaved(data.customPermissions);
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (applicablePerms.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
        <p className="text-xs text-gray-400">No configurable permissions for this role</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
            <Settings2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Permissions</span>
          {customCount > 0 && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              {customCount} customized
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {customCount > 0 && (
            <button
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to defaults
            </button>
          )}
        </div>
      </div>

      {/* ── Permission categories ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {applicableCats.map(cat => {
          const catPerms = applicablePerms.filter(p => p.category === cat.key);
          if (catPerms.length === 0) return null;
          const CatIcon = cat.icon;
          return (
            <div key={cat.key} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <CatIcon className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{cat.label}</span>
              </div>
              <div className="space-y-2">
                {catPerms.map(perm => {
                  const isEnabled = localPerms[perm.key] === true;
                  const isDefault = defaults[perm.key];
                  const isCustomized = isEnabled !== isDefault;
                  return (
                    <label
                      key={perm.key}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer transition hover:bg-white ${
                        isCustomized ? 'bg-amber-50/60 ring-1 ring-amber-200/60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={e => handleToggle(perm.key, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 leading-tight">{perm.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{perm.description}</p>
                      </div>
                      {isCustomized && (
                        <span className="shrink-0 text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                          Custom
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Save bar ── */}
      {hasChanges && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5">
          <p className="text-xs text-emerald-700">
            <AlertCircle className="inline-block h-3.5 w-3.5 mr-1 -mt-0.5" />
            Unsaved permission changes — this will affect the user&apos;s dashboard immediately.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocalPerms(mergePermissions(userRole, customPermissions))}
              className="text-xs text-gray-500 hover:text-gray-700 transition px-2 py-1"
            >
              Discard
            </button>
            <Button variant="primary" size="sm" icon={Save} onClick={handleSave} loading={saving}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function RolesClient({ userName, userEmail, userRole }: RolesClientProps) {
  const [roles, setRoles]             = useState<RoleData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [editingUser, setEditingUser] = useState<(RoleUser & { role: string }) | null>(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Sort
  const [sortField, setSortField]     = useState<'full_name' | 'email' | 'role'>('role');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('asc');

  // Selected user detail
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/v1/owner/roles');
      const data = await res.json();
      if (data.success) setRoles(data.roles);
      else setError(data.error ?? 'Failed to load roles');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  function handleSaved(newEmail: string, oldEmail: string, newPassword?: string) {
    setRoles(prev => prev.map(roleData => ({
      ...roleData,
      users: roleData.users.map(u => {
        if (u.email !== oldEmail) return u;
        return { ...u, email: newEmail, plain_password: newPassword ?? u.plain_password };
      }),
    })));
    setEditingUser(null);
  }

  // Status toggle
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const toast = useToast();

  const { confirm } = useConfirm();

  async function handleStatusToggle(email: string, currentActive: boolean) {
    const action = currentActive ? 'deactivate' : 'activate';
    const ok = await confirm({
      title: currentActive ? 'Deactivate User' : 'Activate User',
      message: `Are you sure you want to ${action} this user?`,
      confirmLabel: currentActive ? 'Deactivate' : 'Activate',
      variant: currentActive ? 'danger' : 'info',
    });
    if (!ok) return;

    setTogglingStatus(email);
    try {
      const res = await fetch(
        `/api/v1/owner/users/${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !currentActive }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error ?? `Failed to ${action} user`);
        return;
      }
      toast.success(`User ${currentActive ? 'deactivated' : 'activated'} successfully`);
      // Update local state
      setRoles(prev => prev.map(rd => ({
        ...rd,
        active: rd.users.some(u => u.email === email)
          ? (currentActive ? rd.active - 1 : rd.active + 1) : rd.active,
        inactive: rd.users.some(u => u.email === email)
          ? (currentActive ? rd.inactive + 1 : rd.inactive - 1) : rd.inactive,
        users: rd.users.map(u =>
          u.email === email ? { ...u, is_active: !currentActive } : u
        ),
      })));
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setTogglingStatus(null);
    }
  }

  // Flatten all users with role info
  const allUsers = roles.flatMap(r =>
    r.users.map(u => ({ ...u, role: r.role }))
  );

  // Counts
  const totalUsers  = allUsers.length;
  const totalActive = allUsers.filter(u => u.is_active).length;
  const roleCounts = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = r.total;
    return acc;
  }, {});

  // Filter & sort
  const filtered = allUsers.filter(u => {
    const matchSearch = !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (ROLE_LABEL[u.role] ?? u.role).toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? u.is_active : !u.is_active);
    return matchSearch && matchRole && matchStatus;
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'full_name') return dir * a.full_name.localeCompare(b.full_name);
    if (sortField === 'email') return dir * a.email.localeCompare(b.email);
    return dir * a.role.localeCompare(b.role);
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const availableRoles = roles.map(r => r.role);

  // Build tab items from available roles
  const roleTabs = [
    { key: 'all', label: `All (${totalUsers})` },
    ...availableRoles.map(r => ({
      key: r,
      label: `${ROLE_LABEL[r] ?? r} (${roleCounts[r] ?? 0})`,
    })),
  ];

  return (
    <>
      <DashboardShell userName={userName} userEmail={userEmail} role={userRole}>
        <div className="space-y-6">

          {/* ── Header ── */}
          <PageHeader icon={Shield} title="Roles & Credentials" subtitle="View all roles, manage user credentials and access">
            <RefreshButton loading={loading} onClick={loadRoles} />
          </PageHeader>

          {/* ── Role filter ── */}
          <FilterSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleTabs.map(t => ({ value: t.key, label: t.label }))}
          />

          {/* ── Search + status filter ── */}
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, email, or role…"
            />
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <FilterSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'inactive', label: 'Inactive Only' },
                ]}
              />
            </div>
          </div>

          {/* ── Error ── */}
          {!loading && error && (
            <Alert variant="error" message={error} onDismiss={() => setError('')} />
          )}

          {/* ── Table ── */}
          {loading && allUsers.length === 0 ? (
            <LoadingState />
          ) : !error && filtered.length === 0 ? (
            <EmptyState icon={Users} message="No users found" />
          ) : !error && (
            <TableWrapper
              footer={
                <>
                  <span>Showing {filtered.length} of {totalUsers} users</span>
                  <span>{totalActive} active · {totalUsers - totalActive} inactive</span>
                </>
              }
            >
              <THead>
                <TH>
                  <button onClick={() => toggleSort('full_name')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Name {sortField === 'full_name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </TH>
                <TH>
                  <button onClick={() => toggleSort('email')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Email {sortField === 'email' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </TH>
                <TH>
                  <button onClick={() => toggleSort('role')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Role {sortField === 'role' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </TH>
                <TH>Password</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </THead>
              <tbody>
                {filtered.map(u => {
                  const isExpanded = selectedEmail === u.email;
                  return (
                    <React.Fragment key={`${u.role}-${u.email}`}>
                      <TRow
                        selected={isExpanded}
                        onClick={() => setSelectedEmail(isExpanded ? null : u.email)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={u.full_name} size="sm" className="bg-gray-100 text-gray-600" />
                            <p className="font-medium text-gray-800 truncate max-w-40">{u.full_name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-48">{u.email}</td>
                        <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-100">
                            {u.plain_password ?? (u.has_password ? '••••••' : '—')}
                          </code>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {u.role === 'owner' ? (
                            <ActiveIndicator active={u.is_active} />
                          ) : (
                            <button
                              onClick={() => handleStatusToggle(u.email, u.is_active)}
                              disabled={togglingStatus === u.email}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer border ${
                                u.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                              } ${togglingStatus === u.email ? 'opacity-50 cursor-wait' : ''}`}
                              title={u.is_active ? 'Click to deactivate' : 'Click to activate'}
                            >
                              {togglingStatus === u.email ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Power className="h-3 w-3" />
                              )}
                              {u.is_active ? 'Active' : 'Inactive'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <IconButton
                            icon={Pencil}
                            onClick={() => setEditingUser(u)}
                            className="text-emerald-600 hover:bg-emerald-50"
                            title="Edit credentials"
                          />
                        </td>
                      </TRow>
                      {/* Inline expanded detail row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-emerald-50/40 border-b border-emerald-100 px-4 py-4">
                            <div className="rounded-xl border border-emerald-200/60 bg-white p-4 shadow-sm space-y-4">
                              {/* ── Header ── */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar name={u.full_name} size="md" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{u.full_name}</p>
                                    <p className="text-xs text-gray-500">{u.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="primary" size="sm" icon={Pencil} onClick={() => setEditingUser(u)}>
                                    Edit Credentials
                                  </Button>
                                  <IconButton icon={X} onClick={() => setSelectedEmail(null)} className="text-gray-400 hover:text-gray-600" />
                                </div>
                              </div>

                              {/* ── Info Cards ── */}
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <InfoCard label="Role">
                                  <RoleBadge role={u.role} />
                                </InfoCard>
                                <InfoCard label="Status">
                                  {u.role === 'owner' ? (
                                    <ActiveIndicator active={u.is_active} />
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <ActiveIndicator active={u.is_active} />
                                      <button
                                        onClick={() => handleStatusToggle(u.email, u.is_active)}
                                        disabled={togglingStatus === u.email}
                                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all border ${
                                          u.is_active
                                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                        } ${togglingStatus === u.email ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                      >
                                        {togglingStatus === u.email ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Power className="h-3 w-3" />
                                        )}
                                        {u.is_active ? 'Deactivate' : 'Activate'}
                                      </button>
                                    </div>
                                  )}
                                </InfoCard>
                                <InfoCard label="Email" icon={Mail}>
                                  <p className="text-sm font-medium text-gray-800 truncate">{u.email}</p>
                                </InfoCard>
                                <InfoCard label="Password" icon={KeyRound}>
                                  <p className="text-sm font-mono text-gray-800">
                                    {u.plain_password ?? (u.has_password ? '(set)' : '—')}
                                  </p>
                                </InfoCard>
                              </div>

                              {/* ── Permissions Panel ── */}
                              {u.role !== 'owner' && (
                                <PermissionsPanel
                                  userEmail={u.email}
                                  userRole={u.role}
                                  customPermissions={u.custom_permissions}
                                  onSaved={(updated) => {
                                    setRoles(prev => prev.map(rd => ({
                                      ...rd,
                                      users: rd.users.map(usr =>
                                        usr.email === u.email
                                          ? { ...usr, custom_permissions: updated }
                                          : usr
                                      ),
                                    })));
                                  }}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </TableWrapper>
          )}
        </div>
      </DashboardShell>

      {/* Edit modal rendered outside DashboardShell */}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
