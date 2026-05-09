// ═══════════════════════════════════════════════════════════════
// Session Materials API
//
// POST /api/v1/session-materials  — teacher uploads a file for a session
// GET  /api/v1/session-materials?session_id=... — fetch materials for a session
// DELETE /api/v1/session-materials?id=...  — teacher deletes their own file
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'session-materials');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function mimeToFileType(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('excel') ||
    mime.includes('powerpoint') ||
    mime === 'text/plain'
  ) return 'document';
  return 'other';
}

// ── POST: Upload a file ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || user.role !== 'teacher') {
    return NextResponse.json({ success: false, error: 'Only teachers can upload session materials' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 });
  }

  const sessionId = formData.get('session_id')?.toString();
  const title = formData.get('title')?.toString() || null;
  const description = formData.get('description')?.toString() || null;
  const file = formData.get('file') as File | null;

  if (!sessionId || !file) {
    return NextResponse.json({ success: false, error: 'session_id and file are required' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ success: false, error: 'File too large — max 50 MB' }, { status: 400 });
  }

  // Verify the session exists and belongs to a batch the teacher teaches
  const sessionRes = await db.query(
    `SELECT bs.session_id, bs.batch_id FROM batch_sessions bs
     JOIN batch_teachers bt ON bt.batch_id = bs.batch_id
     WHERE bs.session_id = $1 AND bt.teacher_email = $2
     LIMIT 1`,
    [sessionId, user.id]
  );
  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found or not your session' }, { status: 403 });
  }
  const batchId = (sessionRes.rows[0] as { batch_id: string }).batch_id;

  // Write file to disk
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extname(file.name) || '';
  const safeFileName = `${randomUUID()}${ext}`;
  const filePath = join(UPLOAD_DIR, safeFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const fileUrl = `/uploads/session-materials/${safeFileName}`;
  const fileType = mimeToFileType(file.type);

  const insertRes = await db.query(
    `INSERT INTO session_materials
       (session_id, batch_id, uploaded_by, file_name, file_url, file_type, file_size_bytes, title, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, session_id, file_name, file_url, file_type, file_size_bytes, title, description, created_at`,
    [sessionId, batchId, user.id, file.name, fileUrl, fileType, file.size, title, description]
  );

  return NextResponse.json({ success: true, data: { material: insertRes.rows[0] } }, { status: 201 });
}

// ── GET: Fetch materials for a session ────────────────────────
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  const user = await verifySession(token);
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ success: false, error: 'session_id required' }, { status: 400 });

  // Access check: teacher of the batch, or enrolled student, or coordinator/AO/owner/hr/ghost
  const allowedRoles = ['owner', 'hr', 'academic_operator', 'batch_coordinator', 'ghost'];
  let hasAccess = allowedRoles.includes(user.role);

  if (!hasAccess && user.role === 'teacher') {
    const r = await db.query(
      `SELECT 1 FROM batch_sessions bs JOIN batch_teachers bt ON bt.batch_id = bs.batch_id
       WHERE bs.session_id = $1 AND bt.teacher_email = $2 LIMIT 1`,
      [sessionId, user.id]
    );
    hasAccess = r.rows.length > 0;
  }

  if (!hasAccess && user.role === 'student') {
    const r = await db.query(
      `SELECT 1 FROM batch_sessions bs JOIN batch_students bst ON bst.batch_id = bs.batch_id
       WHERE bs.session_id = $1 AND bst.student_email = $2 LIMIT 1`,
      [sessionId, user.id]
    );
    hasAccess = r.rows.length > 0;
  }

  if (!hasAccess && user.role === 'parent') {
    const r = await db.query(
      `SELECT 1 FROM batch_sessions bs
       JOIN batch_students bst ON bst.batch_id = bs.batch_id
       WHERE bs.session_id = $1 AND bst.parent_email = $2 LIMIT 1`,
      [sessionId, user.id]
    );
    hasAccess = r.rows.length > 0;
  }

  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const materialsRes = await db.query(
    `SELECT sm.id, sm.session_id, sm.file_name, sm.file_url, sm.file_type,
            sm.file_size_bytes, sm.title, sm.description, sm.created_at,
            pu.full_name AS uploaded_by_name
     FROM session_materials sm
     LEFT JOIN portal_users pu ON pu.email = sm.uploaded_by
     WHERE sm.session_id = $1
     ORDER BY sm.created_at ASC`,
    [sessionId]
  );

  return NextResponse.json({ success: true, data: { materials: materialsRes.rows } });
}

// ── DELETE: Teacher removes their own upload ───────────────────
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || user.role !== 'teacher') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const res = await db.query(
    `DELETE FROM session_materials WHERE id = $1 AND uploaded_by = $2 RETURNING file_url`,
    [id, user.id]
  );
  if (res.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Not found or not your file' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
