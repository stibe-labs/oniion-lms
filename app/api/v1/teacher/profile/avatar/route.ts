// ═══════════════════════════════════════════════════════════════
// Teacher Self Avatar Upload — POST /api/v1/teacher/profile/avatar
// Allows a logged-in teacher to upload their own profile photo.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const MAX_SIZE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !['teacher', 'owner'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No image file provided' }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image must be under 3 MB' }, { status: 400 });
    }

    const safeEmail = user.id.replace(/[^a-z0-9._-]/g, '_');
    const filename  = `${safeEmail}.${ext}`;
    const avatarDir = path.join(process.cwd(), 'public', 'avatars');
    const filePath  = path.join(avatarDir, filename);

    await mkdir(avatarDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const avatarUrl = `/avatars/${filename}`;
    await db.query(
      `UPDATE portal_users SET profile_image = $1, updated_at = NOW() WHERE email = $2`,
      [avatarUrl, user.id]
    );

    return NextResponse.json({ success: true, url: avatarUrl });
  } catch (err) {
    console.error('[teacher/profile/avatar] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
