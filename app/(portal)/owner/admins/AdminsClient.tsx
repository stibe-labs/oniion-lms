// ═══════════════════════════════════════════════════════════════
// Admin Management — Client Component
// List, create, toggle, and remove admin (owner) accounts.
// All admins share the same owner dashboard & data.
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton,
  TableWrapper, THead, TH, TRow,
  Button, LoadingState, Avatar, Badge,
} from '@/components/dashboard/shared';
import {
  Shield, UserPlus, CheckCircle, XCircle,
  Trash2, Eye, EyeOff, Copy, Check, Pencil, X,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface Admin {
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Main Component ───────────────────────────────────────────

export default function AdminsClient({ userName, userEmail, userRole }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit state
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Fetch admins ──
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/owner/admins');
      const json = await res.json();
      if (json.success) setAdmins(json.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // Clear messages after 4s
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  // ── Create admin ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await fetch('/api/v1/owner/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          full_name: formName,
          phone: formPhone || undefined,
          password: formPassword,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to create admin');
      } else {
        setSuccess(json.message || 'Admin created successfully');
        setFormEmail('');
        setFormName('');
        setFormPhone('');
        setFormPassword('');
        setShowForm(false);
        fetchAdmins();
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──
  const handleToggle = async (admin: Admin) => {
    if (admin.email === userEmail) return;
    try {
      const res = await fetch(`/api/v1/owner/admins/${encodeURIComponent(admin.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !admin.is_active }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(`${admin.full_name} ${admin.is_active ? 'deactivated' : 'activated'}`);
        fetchAdmins();
      } else {
        setError(json.error || 'Failed to update');
      }
    } catch {
      setError('Network error');
    }
  };

  // ── Delete admin ──
  const handleDelete = async (admin: Admin) => {
    if (admin.email === userEmail) return;
    if (!confirm(`Remove admin "${admin.full_name}" (${admin.email})? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/v1/owner/admins/${encodeURIComponent(admin.email)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(`Admin ${admin.email} removed`);
        fetchAdmins();
      } else {
        setError(json.error || 'Failed to delete');
      }
    } catch {
      setError('Network error');
    }
  };

  // ── Copy password ──
  const copyPassword = () => {
    if (!formPassword) return;
    navigator.clipboard.writeText(formPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Start editing ──
  const startEdit = (admin: Admin) => {
    setEditingEmail(admin.email);
    setEditName(admin.full_name);
    setEditPhone(admin.phone || '');
  };

  const cancelEdit = () => {
    setEditingEmail(null);
    setEditName('');
    setEditPhone('');
  };

  // ── Save edit ──
  const handleEdit = async () => {
    if (!editingEmail) return;
    setEditSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/owner/admins/${encodeURIComponent(editingEmail)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: editName, phone: editPhone || null }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess('Admin updated successfully');
        setEditingEmail(null);
        fetchAdmins();
      } else {
        setError(json.error || 'Failed to update');
      }
    } catch {
      setError('Network error');
    }
    setEditSaving(false);
  };

  // ── Format date ──
  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* Header */}
        <PageHeader
          icon={Shield}
          title="Admin Management"
          subtitle="Manage admin (owner) accounts — all admins see the same dashboard & data"
        >
          <div className="flex items-center gap-3">
            <RefreshButton loading={loading} onClick={fetchAdmins} />
            <Button icon={UserPlus} onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'Add Admin'}
            </Button>
          </div>
        </PageHeader>

        {/* Alerts */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-primary">{success}</p>
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Create New Admin Account
            </h3>
            <p className="text-xs text-gray-500">
              The new admin will log in with these credentials and have full owner-level access to the same dashboard & data.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  required
                  placeholder="e.g. admin2@stibe.in"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm pr-10 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={copyPassword}
                  disabled={!formPassword}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  title="Copy password"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Share this password securely with the new admin.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" icon={UserPlus} loading={saving}>
                Create Admin
              </Button>
            </div>
          </form>
        )}

        {/* Admin Table */}
        {loading ? (
          <LoadingState />
        ) : (
          <TableWrapper footer={<span>{admins.length} admin account{admins.length !== 1 ? 's' : ''}</span>}>
            <THead>
              <TH>Admin</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH>Last Login</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody>
              {admins.map((admin) => {
                const isSelf = admin.email === userEmail;
                const isEditing = editingEmail === admin.email;
                return (
                  <TRow key={admin.email}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={admin.full_name} size="sm" />
                        <div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full max-w-[200px] rounded-lg border border-emerald-300 px-2 py-1 text-sm font-medium text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                          ) : (
                            <p className="text-sm font-medium text-gray-900">
                              {admin.full_name}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          placeholder="9876543210"
                          className="w-full max-w-[140px] rounded-lg border border-emerald-300 px-2 py-1 text-xs text-gray-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      ) : (
                        <span className="text-xs text-gray-500">
                          {admin.phone || <span className="text-gray-300">&mdash;</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        icon={admin.is_active ? CheckCircle : XCircle}
                        label={admin.is_active ? 'Active' : 'Inactive'}
                        variant={admin.is_active ? 'success' : 'danger'}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {fmtDate(admin.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {fmtDate(admin.last_login_at)}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                          <button
                            onClick={handleEdit}
                            disabled={editSaving}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 transition"
                          >
                            <Check className="h-3.5 w-3.5" /> {editSaving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : !isSelf ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(admin)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                            title="Edit admin"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleToggle(admin)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                              admin.is_active
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-primary bg-primary/5 hover:bg-primary/10'
                            }`}
                            title={admin.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {admin.is_active ? (
                              <><EyeOff className="h-3.5 w-3.5" /> Deactivate</>
                            ) : (
                              <><CheckCircle className="h-3.5 w-3.5" /> Activate</>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(admin)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition"
                            title="Remove admin"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(admin)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                            title="Edit your info"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <span className="text-xs text-gray-400 italic">You</span>
                        </div>
                      )}
                    </td>
                  </TRow>
                );
              })}

              {admins.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    No admin accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </TableWrapper>
        )}

        {/* Info card */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> All admin accounts have the <strong>owner</strong> role and see the exact same dashboard, data, and settings.
            Adding a new admin only creates login credentials — no separate data partition is created.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
