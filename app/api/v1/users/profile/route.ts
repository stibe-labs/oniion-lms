// ═══════════════════════════════════════════════════════════════
// User Profile API — GET + PATCH
// GET  /api/v1/users/profile — Full profile for current user
// PATCH /api/v1/users/profile — Update own profile fields
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

// ── GET — Return full profile ────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await getUser(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT
       pu.email, pu.full_name, pu.portal_role, pu.phone, pu.is_active,
       pu.profile_image, pu.created_at, pu.last_login_at,
       up.whatsapp, up.date_of_birth, up.address, up.qualification,
       up.notes, up.subjects, up.experience_years, up.grade, up.section,
       up.board, up.parent_email, up.per_hour_rate, up.category
     FROM portal_users pu
     LEFT JOIN user_profiles up ON up.email = pu.email
     WHERE pu.email = $1`,
    [caller.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result.rows[0] });
}

// ── PATCH — Update own profile fields ────────────────────────
export async function PATCH(req: NextRequest) {
  const caller = await getUser(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { full_name, phone, whatsapp, address, qualification, date_of_birth } = body;

  // Update portal_users (name, phone)
  const portalUpdates: string[] = [];
  const portalValues: unknown[] = [];
  let idx = 1;

  if (full_name !== undefined && typeof full_name === 'string' && full_name.trim()) {
    portalUpdates.push(`full_name = $${idx++}`);
    portalValues.push(full_name.trim());
  }
  if (phone !== undefined) {
    portalUpdates.push(`phone = $${idx++}`);
    portalValues.push(phone ? String(phone).trim() : null);
  }

  if (portalUpdates.length > 0) {
    portalUpdates.push(`updated_at = NOW()`);
    portalValues.push(caller.id);
    await db.query(
      `UPDATE portal_users SET ${portalUpdates.join(', ')} WHERE email = $${idx}`,
      portalValues
    );
  }

  // Upsert user_profiles (whatsapp, address, qualification, dob)
  const profileFields: Record<string, unknown> = {};
  if (whatsapp !== undefined) profileFields.whatsapp = whatsapp ? String(whatsapp).trim() : null;
  if (address !== undefined) profileFields.address = address ? String(address).trim() : null;
  if (qualification !== undefined) profileFields.qualification = qualification ? String(qualification).trim() : null;
  if (date_of_birth !== undefined) profileFields.date_of_birth = date_of_birth || null;

  if (Object.keys(profileFields).length > 0) {
    // Ensure profile row exists
    await db.query(
      `INSERT INTO user_profiles (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [caller.id]
    );

    const setClauses: string[] = [];
    const setValues: unknown[] = [];
    let si = 1;
    for (const [key, val] of Object.entries(profileFields)) {
      setClauses.push(`${key} = $${si++}`);
      setValues.push(val);
    }
    setClauses.push('updated_at = NOW()');
    setValues.push(caller.id);

    await db.query(
      `UPDATE user_profiles SET ${setClauses.join(', ')} WHERE email = $${si}`,
      setValues
    );
  }

  // Return updated profile
  const result = await db.query(
    `SELECT
       pu.email, pu.full_name, pu.portal_role, pu.phone, pu.is_active,
       pu.profile_image, pu.created_at, pu.last_login_at,
       up.whatsapp, up.date_of_birth, up.address, up.qualification,
       up.notes, up.subjects, up.experience_years, up.grade, up.section,
       up.board, up.parent_email, up.per_hour_rate, up.category
     FROM portal_users pu
     LEFT JOIN user_profiles up ON up.email = pu.email
     WHERE pu.email = $1`,
    [caller.id]
  );

  return NextResponse.json({ success: true, data: result.rows[0], message: 'Profile updated' });
}
