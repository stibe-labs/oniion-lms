// ────────────────────────────────────────────────────────
// Medical Certificate Upload — POST /api/v1/teacher-leave/upload
// Teachers upload medical certificates (PDF, JPEG, PNG) for sick leave
// Returns { url, name } for storing in teacher_leave_requests
// ────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import type { ApiResponse } from '@/types';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
]);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (!['teacher', 'batch_coordinator'].includes(String(user.role))) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only teachers can upload medical certificates' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'File exceeds 10 MB limit' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File type not allowed. Allowed: JPEG, PNG, PDF',
      }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'medical-certs');
    await mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        url: `/uploads/medical-certs/${uniqueName}`,
        name: safeName,
      },
    });
  } catch (error) {
    console.error('[medical-cert upload] Error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
