// ═══════════════════════════════════════════════════════════════
// Teacher Profile API — GET /api/v1/teacher/profile
// Returns the logged-in teacher's own profile from user_profiles
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !['teacher', 'owner'].includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const result = await db.query(
      `SELECT
         u.full_name AS name, u.email, u.profile_image,
         up.phone, up.whatsapp, up.date_of_birth, up.subjects,
         up.qualification, up.experience_years, up.assigned_region, up.notes
       FROM portal_users u
       LEFT JOIN user_profiles up ON up.email = u.email
       WHERE u.email = $1`,
      [user.id]
    );

    if (result.rows.length === 0)
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[teacher/profile] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH /api/v1/teacher/profile ───────────────────────────
// Editable by the teacher: phone, whatsapp, qualification,
//   experience_years, subjects, notes
// Admin-controlled (not editable here): name, email,
//   date_of_birth, assigned_region

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !['teacher', 'owner'].includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      phone,
      whatsapp,
      qualification,
      experience_years,
      subjects,
      assigned_region,
      notes,
    } = body;

    // Upsert user_profiles row
    await db.query(
      `INSERT INTO user_profiles (email, phone, whatsapp, qualification, experience_years, subjects, assigned_region, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (email) DO UPDATE SET
         phone             = COALESCE(EXCLUDED.phone, user_profiles.phone),
         whatsapp          = COALESCE(EXCLUDED.whatsapp, user_profiles.whatsapp),
         qualification     = COALESCE(EXCLUDED.qualification, user_profiles.qualification),
         experience_years  = COALESCE(EXCLUDED.experience_years, user_profiles.experience_years),
         subjects          = COALESCE(EXCLUDED.subjects, user_profiles.subjects),
         assigned_region   = COALESCE(EXCLUDED.assigned_region, user_profiles.assigned_region),
         notes             = EXCLUDED.notes,
         updated_at        = NOW()`,
      [
        user.id,
        phone    ?? null,
        whatsapp ?? null,
        qualification ?? null,
        experience_years != null ? Number(experience_years) : null,
        subjects && subjects.length > 0 ? subjects : null,
        assigned_region ?? null,
        notes ?? null,
      ]
    );

    // Return fresh profile
    const result = await db.query(
      `SELECT
         u.full_name AS name, u.email, u.profile_image,
         up.phone, up.whatsapp, up.date_of_birth, up.subjects,
         up.qualification, up.experience_years, up.assigned_region, up.notes
       FROM portal_users u
       LEFT JOIN user_profiles up ON up.email = u.email
       WHERE u.email = $1`,
      [user.id]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[teacher/profile] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
