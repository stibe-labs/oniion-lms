// ═══════════════════════════════════════════════════════════════
// Owner Permissions API — GET & PATCH /api/v1/owner/permissions/[email]
// Get or update custom permissions for a specific user.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { ROLE_DEFAULT_PERMISSIONS, mergePermissions } from '@/lib/permissions';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

// ── GET — Fetch permissions for a user ───────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const caller = await getOwner(req);
  if (!caller) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  const result = await db.query(
    'SELECT portal_role, custom_permissions FROM portal_users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const row = result.rows[0] as { portal_role: string; custom_permissions: Record<string, boolean> };
  const role = row.portal_role;
  const customPermissions = row.custom_permissions ?? {};
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? {};
  const effective = mergePermissions(role, customPermissions);

  return NextResponse.json({
    success: true,
    role,
    defaults,
    customPermissions,
    effective,
  });
}

// ── PATCH — Update custom permissions for a user ─────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const caller = await getOwner(req);
  if (!caller) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  // Verify user exists
  const existing = await db.query(
    'SELECT portal_role FROM portal_users WHERE email = $1',
    [email]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const role = (existing.rows[0] as { portal_role: string }).portal_role;

  // Don't allow modifying owner permissions
  if (role === 'owner') {
    return NextResponse.json({ success: false, error: 'Cannot modify owner permissions' }, { status: 400 });
  }

  const body: { permissions: Record<string, boolean> } = await req.json();
  const { permissions } = body;

  if (!permissions || typeof permissions !== 'object') {
    return NextResponse.json({ success: false, error: 'Invalid permissions object' }, { status: 400 });
  }

  // Only store overrides — remove entries that match the default value
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] ?? {};
  const overrides: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(permissions)) {
    // Only store if this key is applicable to the role AND differs from default
    if (key in defaults && defaults[key] !== value) {
      overrides[key] = value;
    }
  }

  // Update the custom_permissions column
  await db.query(
    `UPDATE portal_users SET custom_permissions = $1, updated_at = NOW() WHERE email = $2`,
    [JSON.stringify(overrides), email]
  );

  const effective = mergePermissions(role, overrides);

  return NextResponse.json({
    success: true,
    message: 'Permissions updated',
    role,
    customPermissions: overrides,
    effective,
  });
}
