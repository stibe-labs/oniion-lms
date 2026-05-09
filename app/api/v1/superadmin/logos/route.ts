import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

const LOGO_TYPES = ['small', 'full', 'favicon', 'character'] as const;
type LogoType = typeof LOGO_TYPES[number];

const CONFIG_KEY: Record<LogoType, string> = {
  small:     'logo_small_url',
  full:      'logo_full_url',
  favicon:   'favicon_url',
  character: 'loading_character_url',
};

const DESCRIPTION: Record<LogoType, string> = {
  small:     'Small/icon logo shown in sidebar and nav',
  full:      'Full/wide logo shown on login page and public pages',
  favicon:   'Favicon shown in browser tab',
  character: 'Loading character/mascot shown in loading states and splash screen',
};

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif', 'image/apng']);
const MAX_SIZE_DEFAULT = 2 * 1024 * 1024; // 2 MB
const MAX_SIZE_CHARACTER = 5 * 1024 * 1024; // 5 MB (allow animated GIF/APNG)

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'logos');

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const logoType = form.get('type') as string | null;

  if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  if (!logoType || !LOGO_TYPES.includes(logoType as LogoType)) {
    return NextResponse.json({ success: false, error: 'Invalid logo type. Must be: small, full, or favicon' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ success: false, error: 'Invalid file type. Use PNG, JPG, SVG, WebP, ICO, or GIF' }, { status: 400 });
  }
  const maxSize = logoType === 'character' ? MAX_SIZE_CHARACTER : MAX_SIZE_DEFAULT;
  if (file.size > maxSize) {
    return NextResponse.json({ success: false, error: `File too large. Max ${logoType === 'character' ? '5' : '2'} MB` }, { status: 400 });
  }

  // Delete old file if it exists in our uploads dir
  const existing = await db.query<{ value: string }>(
    `SELECT value FROM school_config WHERE key = $1`,
    [CONFIG_KEY[logoType as LogoType]]
  );
  if (existing.rows[0]?.value?.startsWith('/uploads/logos/')) {
    const oldPath = path.join(process.cwd(), 'public', existing.rows[0].value);
    unlink(oldPath).catch(() => {});
  }

  // Save new file
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(await file.arrayBuffer()));
  const url = `/uploads/logos/${fileName}`;

  // Store in school_config
  await db.query(
    `INSERT INTO school_config (key, value, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [CONFIG_KEY[logoType as LogoType], url, DESCRIPTION[logoType as LogoType]]
  );

  return NextResponse.json({ success: true, data: { url, type: logoType } });
}

export async function DELETE(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { type: logoType } = await req.json();
  if (!logoType || !LOGO_TYPES.includes(logoType as LogoType)) {
    return NextResponse.json({ success: false, error: 'Invalid logo type' }, { status: 400 });
  }

  const existing = await db.query<{ value: string }>(
    `SELECT value FROM school_config WHERE key = $1`,
    [CONFIG_KEY[logoType as LogoType]]
  );
  if (existing.rows[0]?.value?.startsWith('/uploads/logos/')) {
    const oldPath = path.join(process.cwd(), 'public', existing.rows[0].value);
    unlink(oldPath).catch(() => {});
  }
  await db.query(`DELETE FROM school_config WHERE key = $1`, [CONFIG_KEY[logoType as LogoType]]);

  return NextResponse.json({ success: true });
}
