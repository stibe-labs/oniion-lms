// ═══════════════════════════════════════════════════════════════
// Teacher Avatar Upload — POST /api/v1/hr/users/[email]/avatar
// Accepts multipart/form-data with an "image" file field.
// Saves to /public/avatars/ and updates portal_users.profile_image.
// Also: POST /api/v1/teacher/profile/avatar (self-upload, see below)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const ALLOWED_ROLES = ['owner', 'hr', 'academic_operator'];
const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const caller = await verifySession(token);
    // Allow admin roles OR the teacher themselves
    if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { email: rawEmail } = await params;
    const targetEmail = decodeURIComponent(rawEmail).toLowerCase().trim();

    const isAdmin = ALLOWED_ROLES.includes(caller.role);
    const isSelf  = caller.id === targetEmail && caller.role === 'teacher';
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No image file provided' }, { status: 400 });
    }

    const mimeType = file.type;
    const ext = ALLOWED_TYPES[mimeType];
    if (!ext) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image must be under 3 MB' }, { status: 400 });
    }

    // Build safe filename from email
    const safeEmail = targetEmail.replace(/[^a-z0-9._-]/g, '_');
    const filename  = `${safeEmail}.${ext}`;
    const avatarDir = path.join(process.cwd(), 'public', 'avatars');
    const filePath  = path.join(avatarDir, filename);

    // Ensure directory exists
    await mkdir(avatarDir, { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Update DB
    const avatarUrl = `/avatars/${filename}`;
    await db.query(
      `UPDATE portal_users SET profile_image = $1, updated_at = NOW() WHERE email = $2`,
      [avatarUrl, targetEmail]
    );

    return NextResponse.json({ success: true, url: avatarUrl });
  } catch (err) {
    console.error('[avatar] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
