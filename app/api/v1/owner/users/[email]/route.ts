// ═══════════════════════════════════════════════════════════════
// Owner Users API — PATCH /api/v1/owner/users/[email]
// Update a user's email and/or password (owner only)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email: rawEmail } = await params;
  const currentEmail = decodeURIComponent(rawEmail).toLowerCase().trim();

  // Verify user exists
  const existing = await db.query(
    'SELECT email, full_name, portal_role FROM portal_users WHERE email = $1',
    [currentEmail]
  );
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const body: { new_email?: string; new_password?: string; is_active?: boolean } = await req.json();
  const { new_email, new_password, is_active } = body;

  if (!new_email && !new_password && is_active === undefined) {
    return NextResponse.json({ success: false, error: 'Provide new_email, new_password, and/or is_active' }, { status: 400 });
  }

  // Prevent deactivating owners
  const targetRole = (existing.rows[0] as { portal_role: string }).portal_role;
  if (is_active !== undefined && targetRole === 'owner') {
    return NextResponse.json({ success: false, error: 'Cannot change status of owner accounts' }, { status: 400 });
  }

  // Prevent self-deactivation
  if (is_active === false && currentEmail === caller.id) {
    return NextResponse.json({ success: false, error: 'Cannot deactivate your own account' }, { status: 400 });
  }

  // Build update fields
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let idx = 1;

  if (new_email) {
    const newEmailStr = new_email.toLowerCase().trim();
    // Check uniqueness
    const conflict = await db.query(
      'SELECT 1 FROM portal_users WHERE email = $1 AND email != $2',
      [newEmailStr, currentEmail]
    );
    if (conflict.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Email already in use by another user' }, { status: 409 });
    }
    sets.push(`email = $${idx++}`);
    vals.push(newEmailStr);
  }

  if (new_password) {
    const pw = new_password.trim();
    if (pw.length < 4) {
      return NextResponse.json({ success: false, error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    const passwordHash = await hash(pw, 12);
    sets.push(`password_hash = $${idx++}`);
    vals.push(passwordHash);
    sets.push(`plain_password = $${idx++}`);
    vals.push(pw);
  }

  if (is_active !== undefined) {
    sets.push(`is_active = $${idx++}`);
    vals.push(is_active);
  }

  vals.push(currentEmail);
  await db.query(
    `UPDATE portal_users SET ${sets.join(', ')} WHERE email = $${idx}`,
    vals
  );

  return NextResponse.json({
    success: true,
    message: 'User updated successfully',
    updated: {
      email: new_email ? new_email.toLowerCase().trim() : currentEmail,
      password_changed: !!new_password,
      is_active: is_active,
    },
  });
}
