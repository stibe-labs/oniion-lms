// ═══════════════════════════════════════════════════════════════
// HR Users API — GET + POST
// GET  /api/v1/hr/users?role=teacher|student|coordinator|parent|all
// POST /api/v1/hr/users — Create user + profile + send credentials
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { hash } from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { credentialsTemplate } from '@/lib/email-templates';
import type { PortalRole } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const ROLE_LABELS: Record<string, string> = {
  teacher:     'Teacher',
  student:     'Student',
  batch_coordinator: 'Batch Coordinator',
  parent:      'Parent',
  hr:          'HR Associate',
  academic_operator: 'Academic Operator',
};

async function getHR(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['hr', 'owner', 'academic_operator'].includes(user.role)) return null;
  return user;
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ── GET — List users ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const role = url.searchParams.get('role') || 'all';
  const search = url.searchParams.get('q') || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 500);
  const offset = Number(url.searchParams.get('offset')) || 0;
  const categoryFilter = url.searchParams.get('category') || '';
  const gradeFilter = url.searchParams.get('grade') || '';
  const emailsFilter = url.searchParams.get('emails') || '';

  // Fast path: batch email existence check — returns only { existing: string[] }
  if (emailsFilter) {
    const emailList = emailsFilter.split(',').map(e => e.trim().toLowerCase()).filter(Boolean).slice(0, 200);
    if (emailList.length === 0) {
      return NextResponse.json({ success: true, data: { existing: [] } });
    }
    const placeholders = emailList.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `SELECT email FROM portal_users WHERE email IN (${placeholders})`,
      emailList
    );
    return NextResponse.json({
      success: true,
      data: { existing: result.rows.map((r: Record<string, unknown>) => r.email) },
    });
  }

  const allowedRoles: PortalRole[] = ['teacher', 'student', 'batch_coordinator', 'parent', 'hr', 'academic_operator', 'ghost'];

  let sql = `
    SELECT
      u.email, u.full_name, u.portal_role, u.is_active, u.created_at, u.profile_image,
      p.phone, p.whatsapp, p.subjects, p.grade, p.section, p.board,
      p.parent_email, p.qualification, p.experience_years, p.per_hour_rate, p.assigned_region,
      p.admission_date, p.notes, p.address, p.category,
      par.full_name AS parent_name,
      (
        SELECT COALESCE(json_agg(json_build_object('name', cu.full_name, 'email', cu.email)), '[]'::json)
        FROM user_profiles cp
        JOIN portal_users cu ON cu.email = cp.email
        WHERE cp.parent_email = u.email
      ) AS children,
      COALESCE(
        (SELECT el.source FROM enrollment_links el
         WHERE el.status = 'paid'
           AND (el.student_email = u.email OR el.student_parent_email = u.email)
         ORDER BY el.created_at DESC LIMIT 1),
        CASE WHEN u.created_by IS NOT NULL THEN 'manual' ELSE 'manual' END
      ) AS enrollment_source,
      COALESCE(
        (SELECT ao.full_name FROM enrollment_links el
         JOIN portal_users ao ON ao.email = el.created_by
         WHERE el.status = 'paid'
           AND (el.student_email = u.email OR el.student_parent_email = u.email)
         ORDER BY el.created_at DESC LIMIT 1),
        (SELECT ao.full_name FROM portal_users ao WHERE ao.email = u.created_by LIMIT 1)
      ) AS enrolled_by_name,
      (SELECT el.preferred_batch_type FROM enrollment_links el
       WHERE el.status = 'paid' AND el.student_email = u.email
       ORDER BY el.created_at DESC LIMIT 1) AS enrollment_batch_type,
      (SELECT el.selected_subjects FROM enrollment_links el
       WHERE el.status = 'paid' AND el.student_email = u.email
       ORDER BY el.created_at DESC LIMIT 1) AS enrollment_subjects,
      (SELECT el.enrollment_category FROM enrollment_links el
       WHERE el.status = 'paid' AND el.student_email = u.email
       ORDER BY el.created_at DESC LIMIT 1) AS enrollment_category,
      COALESCE((
        SELECT json_agg(json_build_object('batch_id', b.batch_id, 'batch_name', b.batch_name, 'batch_type', b.batch_type))
        FROM batch_students bs
        JOIN batches b ON b.batch_id = bs.batch_id
        WHERE bs.student_email = u.email AND b.status = 'active' AND bs.student_status = 'active'
      ), '[]') AS current_batches
    FROM portal_users u
    LEFT JOIN user_profiles p ON p.email = u.email
    LEFT JOIN portal_users par ON par.email = p.parent_email
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (role !== 'all' && allowedRoles.includes(role as PortalRole)) {
    params.push(role);
    sql += ` AND u.portal_role = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  if (categoryFilter && ['A', 'B', 'C'].includes(categoryFilter)) {
    params.push(categoryFilter);
    sql += ` AND p.category = $${params.length}`;
  }

  if (gradeFilter) {
    params.push(gradeFilter);
    sql += ` AND p.grade = $${params.length}`;
  }

  // AO sees all students (no isolation — full visibility for batch planning)

  sql += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(sql, params);

  // Count
  let countSql = `SELECT COUNT(*) FROM portal_users u LEFT JOIN user_profiles p ON p.email = u.email WHERE 1=1`;
  const countParams: unknown[] = [];
  if (role !== 'all' && allowedRoles.includes(role as PortalRole)) {
    countParams.push(role);
    countSql += ` AND u.portal_role = $${countParams.length}`;
  }
  if (search) {
    countParams.push(`%${search}%`);
    countSql += ` AND (u.full_name ILIKE $${countParams.length} OR u.email ILIKE $${countParams.length})`;
  }
  if (categoryFilter && ['A', 'B', 'C'].includes(categoryFilter)) {
    countParams.push(categoryFilter);
    countSql += ` AND p.category = $${countParams.length}`;
  }
  if (gradeFilter) {
    countParams.push(gradeFilter);
    countSql += ` AND p.grade = $${countParams.length}`;
  }
  const countResult = await db.query(countSql, countParams);

  return NextResponse.json({
    success: true,
    data: {
      users: result.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
    },
  });
}

// ── POST — Create new user ──────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    email, full_name, portal_role, password: manualPassword,
    // Profile fields
    phone, whatsapp, address, qualification, notes, experience_years, per_hour_rate, assigned_region, admission_date,
    // Teacher
    subjects,
    // Student
    grade, section, board, parent_email, parent_name, parent_password,
    // Category (A/B/C) — for students and teachers
    category,
  } = body as Record<string, unknown>;

  if (!email || !full_name || !portal_role) {
    return NextResponse.json({ success: false, error: 'email, full_name, and portal_role are required' }, { status: 400 });
  }

  const emailStr = (email as string).trim().toLowerCase();
  const roleStr = portal_role as PortalRole;

  const allowedRoles: PortalRole[] = ['teacher', 'student', 'batch_coordinator', 'parent', 'academic_operator', 'hr', 'ghost'];
  if (!allowedRoles.includes(roleStr)) {
    return NextResponse.json({ success: false, error: 'Invalid role. Allowed: teacher, student, batch_coordinator, parent, academic_operator, hr, ghost' }, { status: 400 });
  }

  // Check duplicate
  const existing = await db.query('SELECT email FROM portal_users WHERE email = $1', [emailStr]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
  }

  // Auto-create parent for students if parent_email provided and doesn't exist
  let parentCreated = false;
  let parentTempPassword = '';
  if (roleStr === 'student' && parent_email) {
    const parentEmailStr = (parent_email as string).trim().toLowerCase();
    const parentCheck = await db.query(
      `SELECT email, portal_role FROM portal_users WHERE email = $1`,
      [parentEmailStr]
    );
    if (parentCheck.rows.length === 0) {
      // Auto-create parent account
      const pName = (parent_name as string | undefined)?.trim() || 'Parent';
      parentTempPassword = (parent_password as string | undefined)?.trim() || generatePassword();
      const parentHash = await hash(parentTempPassword, 12);
      await db.query(
        `INSERT INTO portal_users (email, full_name, portal_role, password_hash, plain_password, is_active, created_by)
         VALUES ($1, $2, 'parent', $3, $4, TRUE, $5)`,
        [parentEmailStr, pName, parentHash, parentTempPassword, caller.id]
      );
      await db.query(
        `INSERT INTO user_profiles (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
        [parentEmailStr]
      );
      parentCreated = true;

      // Send credentials to parent
      const parentTpl = credentialsTemplate({
        recipientEmail: parentEmailStr,
        recipientName: pName,
        role: 'Parent',
        loginEmail: parentEmailStr,
        tempPassword: parentTempPassword,
        loginUrl: `${BASE_URL}/login`,
      });
      sendEmail({
        to: parentEmailStr, subject: parentTpl.subject, html: parentTpl.html, text: parentTpl.text,
        waTemplate: 'stibe_user_setup',
        waParams: [pName, 'Parent', `${BASE_URL}/login`, parentEmailStr],
      })
        .catch((err) => console.error('[HR] parent credentials email failed:', err));
    } else if (parentCheck.rows[0].portal_role !== 'parent') {
      return NextResponse.json({ success: false, error: `Email ${parentEmailStr} exists but is not a parent account (role: ${parentCheck.rows[0].portal_role})` }, { status: 400 });
    }
  }

  const tempPassword = (manualPassword as string | undefined)?.trim() || generatePassword();
  const passwordHash = await hash(tempPassword, 12);

  await db.withTransaction(async (client) => {
    // 1. Create portal_user
    await client.query(
      `INSERT INTO portal_users (email, full_name, portal_role, password_hash, plain_password, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
      [emailStr, (full_name as string).trim(), roleStr, passwordHash, tempPassword, caller.id]
    );

    // 2. Build profile fields
    const profileSubjects = Array.isArray(subjects) && subjects.length > 0 ? subjects : null;
    const profileParent = parent_email ? (parent_email as string).trim().toLowerCase() : null;

    const profileCategory = category && ['A', 'B', 'C'].includes(category as string) ? category : null;

    await client.query(
      `INSERT INTO user_profiles (
         email, phone, whatsapp, address, qualification, notes,
         subjects, experience_years, per_hour_rate,
         grade, section, board, parent_email, admission_date,
         assigned_region, category
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9,
         $10, $11, $12, $13, $14,
         $15, $16
       )`,
      [
        emailStr,
        phone || null, whatsapp || null,
        address || null,
        qualification || null, notes || null,
        profileSubjects, experience_years || null, per_hour_rate ? Math.round(Number(per_hour_rate)) : null,
        grade || null, section || null, board || null,
        profileParent,
        admission_date || null,
        assigned_region || null,
        profileCategory,
      ]
    );
  });

  // 3. Send credentials email (non-blocking — don't fail if email fails)
  const roleLabel = ROLE_LABELS[roleStr] || roleStr;
  let additionalInfo = '';
  if (roleStr === 'teacher' && Array.isArray(subjects) && subjects.length > 0) {
    additionalInfo = `Subjects: ${(subjects as string[]).join(', ')}`;
  }
  if (roleStr === 'student') {
    const parts: string[] = [];
    if (grade) parts.push(`Grade: ${grade}`);
    if (section) parts.push(`Section: ${section}`);
    if (board) parts.push(`Board: ${board}`);
    additionalInfo = parts.join(' | ');
  }

  const tpl = credentialsTemplate({
    recipientEmail: emailStr,
    recipientName: (full_name as string).trim(),
    role: roleLabel,
    loginEmail: emailStr,
    tempPassword,
    loginUrl: `${BASE_URL}/login`,
    additionalInfo: additionalInfo || undefined,
  });

  sendEmail({
    to: emailStr, subject: tpl.subject, html: tpl.html, text: tpl.text,
    waTemplate: 'stibe_user_setup',
    waParams: [(full_name as string).trim(), roleLabel, `${BASE_URL}/login`, emailStr],
  })
    .catch((err) => console.error('[HR] credentials email failed:', err));

  const responseData: Record<string, unknown> = {
    email: emailStr,
    full_name: (full_name as string).trim(),
    portal_role: roleStr,
    temp_password: tempPassword,
    email_sent: true,
  };

  let message = `${roleLabel} account created. Credentials sent to ${emailStr}`;

  if (parentCreated && parent_email) {
    const parentEmailStr = (parent_email as string).trim().toLowerCase();
    responseData.parent_created = true;
    responseData.parent_email = parentEmailStr;
    responseData.parent_temp_password = parentTempPassword;
    message += `. Parent account also created for ${parentEmailStr}`;
  }

  return NextResponse.json({
    success: true,
    data: responseData,
    message,
  }, { status: 201 });
}
