// ═══════════════════════════════════════════════════════════════
// Owner Roles API — GET /api/v1/owner/roles
// Returns per-role stats + full user list with credentials
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

const ROLE_ORDER = [
  'owner',
  'batch_coordinator',
  'academic_operator',
  'hr',
  'teacher',
  'teacher_screen',
  'student',
  'parent',
  'ghost',
];

export async function GET(req: NextRequest) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Stats per role
  const statsRes = await db.query(`
    SELECT
      portal_role,
      COUNT(*)                                    AS total,
      COUNT(*) FILTER (WHERE is_active = true)    AS active,
      COUNT(*) FILTER (WHERE is_active = false)   AS inactive
    FROM portal_users
    GROUP BY portal_role
    ORDER BY portal_role
  `);

  // All users with credential fields + permissions
  const usersRes = await db.query(`
    SELECT
      email,
      full_name,
      portal_role,
      is_active,
      plain_password,
      (password_hash IS NOT NULL AND password_hash != '') AS has_password,
      COALESCE(custom_permissions, '{}') AS custom_permissions
    FROM portal_users
    ORDER BY full_name ASC
  `);

  // Build role map
  const statsMap: Record<string, { total: number; active: number; inactive: number }> = {};
  for (const r of statsRes.rows) {
    const row = r as { portal_role: string; total: string; active: string; inactive: string };
    statsMap[row.portal_role] = {
      total:    Number(row.total),
      active:   Number(row.active),
      inactive: Number(row.inactive),
    };
  }

  // Group users by role
  const usersMap: Record<string, {
    email: string;
    full_name: string;
    is_active: boolean;
    plain_password: string | null;
    has_password: boolean;
    custom_permissions: Record<string, boolean>;
  }[]> = {};

  for (const r of usersRes.rows) {
    const row = r as { email: string; full_name: string; portal_role: string; is_active: boolean; plain_password: string | null; has_password: boolean | string; custom_permissions: Record<string, boolean> | string };
    if (!usersMap[row.portal_role]) usersMap[row.portal_role] = [];
    usersMap[row.portal_role].push({
      email:          row.email,
      full_name:      row.full_name,
      is_active:      row.is_active,
      plain_password: row.plain_password ?? null,
      has_password:   row.has_password === true || row.has_password === 't',
      custom_permissions: typeof row.custom_permissions === 'string'
        ? JSON.parse(row.custom_permissions)
        : (row.custom_permissions ?? {}),
    });
  }

  // Assemble ordered result
  const allRoles = [...ROLE_ORDER];
  // Add any roles in DB not in our list
  for (const role of Object.keys(statsMap)) {
    if (!allRoles.includes(role)) allRoles.push(role);
  }

  const roles = allRoles
    .filter(r => statsMap[r])
    .map(r => ({
      role:     r,
      ...statsMap[r],
      users:    usersMap[r] ?? [],
    }));

  return NextResponse.json({ success: true, roles });
}
