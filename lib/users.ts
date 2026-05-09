// ═══════════════════════════════════════════════════════════════
// stibe Portal — User Database Operations
// ═══════════════════════════════════════════════════════════════
// CRUD for portal_users table.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { PortalUser, PortalRole } from '@/types';

// ── Types ───────────────────────────────────────────────────

export interface PortalUser {
  email: string;
  full_name: string;
  portal_role: PortalRole;
  phone: string | null;
  profile_image: string | null;
  batch_ids: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ── Upsert on login ─────────────────────────────────────────

export async function upsertUser(user: PortalUser): Promise<PortalUser> {
  const result = await db.query<PortalUser>(
    `INSERT INTO portal_users (email, full_name, portal_role, last_login_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       portal_role = EXCLUDED.portal_role,
       last_login_at = NOW(),
       is_active = TRUE
     RETURNING *`,
    [user.id, user.name, user.role]
  );
  return result.rows[0];
}

// ── Get user by email ───────────────────────────────────────

export async function getUserByEmail(email: string): Promise<PortalUser | null> {
  const result = await db.query<PortalUser>(
    `SELECT * FROM portal_users WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

// ── List users by role ──────────────────────────────────────

export async function getUsersByRole(role: PortalRole): Promise<PortalUser[]> {
  const result = await db.query<PortalUser>(
    `SELECT * FROM portal_users WHERE portal_role = $1 AND is_active = TRUE ORDER BY full_name`,
    [role]
  );
  return result.rows;
}

// ── Search users (for coordinator assign flow) ──────────────

export async function searchUsers(
  query: string,
  role?: PortalRole
): Promise<PortalUser[]> {
  const params: unknown[] = [`%${query}%`];
  let sql = `SELECT * FROM portal_users WHERE is_active = TRUE AND (full_name ILIKE $1 OR email ILIKE $1)`;

  if (role) {
    params.push(role);
    sql += ` AND portal_role = $${params.length}`;
  }

  sql += ' ORDER BY full_name LIMIT 50';
  const result = await db.query<PortalUser>(sql, params);
  return result.rows;
}

// ── Search teachers with subject priority ───────────────────
// Returns all teachers matching query, with those who teach the
// given subject sorted first. Includes subjects array from user_profiles.

export async function searchTeachersBySubject(
  query: string,
  subject: string
): Promise<(PortalUser & { subjects: string[] | null; matches_subject: boolean })[]> {
  const params: unknown[] = [subject];
  let whereParts = `u.is_active = TRUE AND u.portal_role = 'teacher'`;

  if (query) {
    params.push(`%${query}%`);
    whereParts += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  const sql = `
    SELECT u.*, p.subjects,
           CASE WHEN p.subjects @> ARRAY[$1]::text[] THEN true ELSE false END AS matches_subject
    FROM portal_users u
    LEFT JOIN user_profiles p ON p.email = u.email
    WHERE ${whereParts}
    ORDER BY
      CASE WHEN p.subjects @> ARRAY[$1]::text[] THEN 0 ELSE 1 END,
      u.full_name
    LIMIT 50
  `;

  const result = await db.query(sql, params);
  return result.rows as (PortalUser & { subjects: string[] | null; matches_subject: boolean })[];
}

// ── Search coordinators with active batch count ─────────────
// Returns coordinators with a count of their currently active
// (scheduled or live) rooms so the operator can balance workload.

export async function searchCoordinatorsWithBatchCount(
  query: string
): Promise<(PortalUser & { batch_count: number })[]> {
  const params: unknown[] = [];
  let whereParts = `u.is_active = TRUE AND u.portal_role = 'batch_coordinator'`;

  if (query) {
    params.push(`%${query}%`);
    whereParts += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  const sql = `
    SELECT u.*,
           COALESCE(rc.batch_count, 0)::int AS batch_count
    FROM portal_users u
    LEFT JOIN (
      SELECT coordinator_email, COUNT(*) AS batch_count
      FROM rooms
      WHERE status IN ('scheduled', 'live')
      GROUP BY coordinator_email
    ) rc ON rc.coordinator_email = u.email
    WHERE ${whereParts}
    ORDER BY u.full_name
    LIMIT 50
  `;

  const result = await db.query(sql, params);
  return result.rows as (PortalUser & { batch_count: number })[];
}

// ── Deactivate user ─────────────────────────────────────────

export async function deactivateUser(email: string): Promise<void> {
  await db.query(
    `UPDATE portal_users SET is_active = FALSE, updated_at = NOW() WHERE email = $1`,
    [email]
  );
}

// ── Get all active users (for admin views) ──────────────────

export async function getAllActiveUsers(): Promise<PortalUser[]> {
  const result = await db.query<PortalUser>(
    `SELECT * FROM portal_users WHERE is_active = TRUE ORDER BY portal_role, full_name`
  );
  return result.rows;
}
