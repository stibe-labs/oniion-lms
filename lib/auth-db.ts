// ═══════════════════════════════════════════════════════════════
// stibe Portal — PostgreSQL-based Authentication
// ═══════════════════════════════════════════════════════════════
// Authenticates users against portal_users table.
// ═══════════════════════════════════════════════════════════════

import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import type { PortalUser } from '@/types';

interface DbLoginResult {
  user?: PortalUser;
  error?: string;
}

interface DbUserRow extends Record<string, unknown> {
  email: string;
  full_name: string;
  portal_role: string;
  password_hash: string | null;
  is_active: boolean;
}

export async function dbLogin(email: string, password: string): Promise<DbLoginResult> {
  // Lookup user by email
  let result: Awaited<ReturnType<typeof db.query<DbUserRow>>>;
  try {
    result = await db.query<DbUserRow>(
      `SELECT email, full_name, portal_role, password_hash, is_active
       FROM portal_users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
  } catch (err) {
    console.error('[dbLogin] DB query failed:', err);
    return { error: 'Database error — could not verify credentials' };
  }

  if (result.rows.length === 0) {
    return { error: 'Invalid email or password' };
  }

  const row = result.rows[0];

  if (!row.is_active) {
    return { error: 'Account is disabled. Contact your administrator.' };
  }

  if (!row.password_hash) {
    return { error: 'Password not set for this account. Contact your administrator.' };
  }

  let valid = false;
  try {
    valid = await compare(password, row.password_hash);
  } catch (err) {
    console.error('[dbLogin] bcrypt compare failed:', err);
    return { error: 'Authentication error — please try again' };
  }

  if (!valid) {
    return { error: 'Invalid email or password' };
  }

  return {
    user: {
      id: row.email,
      name: row.full_name,
      role: row.portal_role as PortalUser['role'],
    },
  };
}
