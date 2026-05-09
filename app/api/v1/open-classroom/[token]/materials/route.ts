import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const AO_ROLES = ['academic_operator', 'owner', 'batch_coordinator'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

/**
 * POST /api/v1/open-classroom/[token]/materials — Upload materials for an open classroom
 * GET  /api/v1/open-classroom/[token]/materials — List materials for an open classroom
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !AO_ROLES.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { token } = await params;
    // Find classroom by host_token
    const ocRes = await db.query(
      `SELECT id, subject FROM open_classrooms WHERE host_token = $1 OR join_token = $1 LIMIT 1`,
      [token]
    );
    if (ocRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }
    const oc = ocRes.rows[0] as { id: string; subject: string };

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid form data' }, { status: 400 });
    }

    const files = formData.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'At least one file required' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
    await mkdir(uploadDir, { recursive: true });

    const saved: { id: string; file_url: string; file_name: string; file_size: number; mime_type: string }[] = [];

    for (const file of files) {
      if (!file.size) continue;
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json<ApiResponse>({ success: false, error: `File too large (max 200 MB): ${file.name}` }, { status: 400 });
      }

      const ext = path.extname(file.name).toLowerCase() || '';
      const safeName = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, safeName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const fileUrl = `/uploads/materials/${safeName}`;
      const title = file.name.replace(/\.[^.]+$/, '');

      const result = await db.query(
        `INSERT INTO teaching_materials
           (subject, title, file_url, file_name, file_size, mime_type, material_type, uploaded_by, open_classroom_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'notes', $7, $8)
         RETURNING id, file_url, file_name, file_size, mime_type, title`,
        [oc.subject || 'General', title, fileUrl, file.name, file.size, file.type || 'application/octet-stream', user.id, oc.id]
      );
      saved.push(result.rows[0] as typeof saved[0]);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: saved,
      message: `${saved.length} material(s) uploaded`,
    });
  } catch (err) {
    console.error('[oc-materials/post]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const ocRes = await db.query(
      `SELECT id FROM open_classrooms WHERE host_token = $1 OR join_token = $1 LIMIT 1`,
      [token]
    );
    if (ocRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }
    const ocId = ocRes.rows[0].id as string;

    const result = await db.query(
      `SELECT id, subject, title, description, file_url, file_name, file_size, mime_type, material_type, created_at
       FROM teaching_materials
       WHERE open_classroom_id = $1
       ORDER BY created_at`,
      [ocId]
    );

    return NextResponse.json<ApiResponse>({ success: true, data: { materials: result.rows } });
  } catch (err) {
    console.error('[oc-materials/get]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
