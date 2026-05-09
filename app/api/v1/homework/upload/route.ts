// ────────────────────────────────────────────────────────
// Homework File Upload API — POST /api/v1/homework/upload
// Students upload homework files (JPEG, PNG, PDF, DOCX, PPTX)
// Returns array of { url, name } for storing in homework_submissions
// ────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifyAuth } from '@/lib/auth';
import type { ApiResponse } from '@/types';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/msword', // doc
  'application/vnd.ms-powerpoint', // ppt
  'application/vnd.ms-excel', // xls
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'audio/mpeg',
]);

const ALLOWED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf',
  '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.csv', '.txt', '.zip', '.mp4', '.mp3',
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES = 5;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No files uploaded' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    // Validate all files first
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `File "${file.name}" exceeds 20 MB limit`,
        }, { status: 400 });
      }
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(file.type)) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `File type not allowed: ${file.name}. Allowed: images, PDF, Office docs, CSV, TXT, ZIP, MP4`,
        }, { status: 400 });
      }
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'homework');
    await mkdir(uploadDir, { recursive: true });

    const results: { url: string; name: string }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase() || '.bin';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      const uniqueName = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      results.push({
        url: `/uploads/homework/${uniqueName}`,
        name: safeName,
      });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: results });
  } catch (err) {
    console.error('[homework/upload] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
