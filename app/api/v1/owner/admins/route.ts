// ═══════════════════════════════════════════════════════════════
// Owner Admins API — GET + POST
// GET  /api/v1/owner/admins — List all owner accounts
// POST /api/v1/owner/admins — Create a new owner account
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { hash } from 'bcryptjs';

async function requireOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

// ── GET — List all owner accounts ───────────────────────────
export async function GET(req: NextRequest) {
  const caller = await requireOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT email, full_name, phone, is_active, created_at, last_login_at
     FROM portal_users
     WHERE portal_role = 'owner'
     ORDER BY created_at ASC`
  );

  return NextResponse.json({ success: true, data: result.rows });
}

// ── POST — Create a new owner account ───────────────────────
export async function POST(req: NextRequest) {
  const caller = await requireOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email, full_name, password, phone } = body;

  if (!email || !full_name || !password) {
    return NextResponse.json(
      { success: false, error: 'Email, name, and password are required' },
      { status: 400 }
    );
  }

  const trimmedEmail = email.toLowerCase().trim();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json(
      { success: false, error: 'Invalid email format' },
      { status: 400 }
    );
  }

  // Validate password strength
  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  // Check if email already exists
  const existing = await db.query(
    'SELECT email FROM portal_users WHERE email = $1',
    [trimmedEmail]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'An account with this email already exists' },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);

  const trimmedPhone = phone ? String(phone).trim() : null;

  await db.query(
    `INSERT INTO portal_users (email, full_name, portal_role, password_hash, phone, is_active)
     VALUES ($1, $2, 'owner', $3, $4, TRUE)`,
    [trimmedEmail, full_name.trim(), passwordHash, trimmedPhone]
  );

  return NextResponse.json({
    success: true,
    message: `Admin account created for ${trimmedEmail}`,
  });
}
