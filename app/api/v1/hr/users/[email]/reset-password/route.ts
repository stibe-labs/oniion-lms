// ═══════════════════════════════════════════════════════════════
// HR Reset Password — POST /api/v1/hr/users/[email]/reset-password
// Generates a new password, updates hash, sends email
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { hash } from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { credentialsTemplate } from '@/lib/email-templates';
import { getPlatformName } from '@/lib/platform-config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Teacher', student: 'Student', batch_coordinator: 'Batch Coordinator',
  parent: 'Parent', hr: 'HR Associate', academic_operator: 'Academic Operator',
};

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
  for (let i = 4; i < 10; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const caller = await verifySession(token);
  if (!caller || !['hr', 'owner', 'academic_operator'].includes(caller.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email } = await params;
  const emailStr = decodeURIComponent(email).toLowerCase();

  const userResult = await db.query(
    'SELECT email, full_name, portal_role FROM portal_users WHERE email = $1',
    [emailStr]
  );
  if (userResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const user = userResult.rows[0] as { email: string; full_name: string; portal_role: string };

  let body: { password?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const newPassword = body.password?.trim() || generatePassword();
  const passwordHash = await hash(newPassword, 12);

  await db.query(
    'UPDATE portal_users SET password_hash = $1, plain_password = $2, updated_at = NOW() WHERE email = $3',
    [passwordHash, newPassword, emailStr]
  );

  const roleLabel = ROLE_LABELS[user.portal_role] || user.portal_role;
  const tpl = credentialsTemplate({
    recipientEmail: emailStr,
    recipientName: user.full_name,
    role: roleLabel,
    loginEmail: emailStr,
    tempPassword: newPassword,
    loginUrl: `${BASE_URL}/login`,
    additionalInfo: 'This is a password reset. Please change your password after logging in.',
  });

  const platformName = await getPlatformName();
  sendEmail({
    to: emailStr, subject: `${platformName} — Password Reset for ${user.full_name}`, html: tpl.html, text: tpl.text,
    waTemplate: 'stibe_user_setup',
    waParams: [user.full_name, roleLabel, `${BASE_URL}/login`, emailStr],
  })
    .catch((err) => console.error('[HR] reset password email failed:', err));

  return NextResponse.json({
    success: true,
    data: { new_password: newPassword },
    message: `Password reset and emailed to ${emailStr}`,
  });
}
