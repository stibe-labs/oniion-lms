// ---------------------------------------------------------------
// Session Exam Topics API — /api/v1/session-exam-topics
// AO uploads question files per topic → stored for teacher use
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const AO_ROLES = ['academic_operator', 'owner', 'batch_coordinator', 'teacher'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file
const MAX_FILES = 10;

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

function getExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

// ── GET: List exam topics with files ─────────────────────────
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);

  const url = req.nextUrl;
  const subject = url.searchParams.get('subject');
  const grade = url.searchParams.get('grade');
  const status = url.searchParams.get('status');
  const board = url.searchParams.get('board');
  const category = url.searchParams.get('category');

  let where = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (subject) { params.push(subject); where += ` AND t.subject = $${params.length}`; }
  if (grade) { params.push(grade); where += ` AND t.grade = $${params.length}`; }
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  if (board) { params.push(board); where += ` AND t.board = $${params.length}`; }
  if (category) { params.push(category); where += ` AND t.category = $${params.length}`; }

  // Non-AO users only see 'ready' topics
  if (!AO_ROLES.includes(session.role)) {
    where += ` AND t.status = 'ready'`;
  }

  // Teachers only see their own uploads
  if (session.role === 'teacher') {
    params.push(String(session.id));
    where += ` AND t.uploaded_by = $${params.length}`;
  }

  const topicsResult = await db.query(`
    SELECT t.*,
           COUNT(q.id)::int AS generated_questions
    FROM   session_exam_topics t
    LEFT JOIN session_exam_questions q ON q.topic_id = t.id
    ${where}
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `, params);

  const topics = topicsResult.rows;

  // Fetch files for all returned topics in one query
  if (topics.length > 0) {
    const topicIds = topics.map(t => t.id as string);
    const filesResult = await db.query(`
      SELECT id, topic_id, file_url, file_name, file_size, mime_type, created_at
      FROM   exam_topic_files
      WHERE  topic_id = ANY($1)
      ORDER BY created_at
    `, [topicIds]);

    const filesByTopic = new Map<string, Record<string, unknown>[]>();
    for (const f of filesResult.rows) {
      const tid = f.topic_id as string;
      const arr = filesByTopic.get(tid) || [];
      arr.push(f);
      filesByTopic.set(tid, arr);
    }
    for (const t of topics) {
      (t as Record<string, unknown>).files = filesByTopic.get(t.id as string) || [];
    }
  }

  return NextResponse.json({ success: true, data: topics });
}

// ── POST: Upload topic with question files ───────────────────
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!AO_ROLES.includes(session.role)) return fail('Permission denied', 403);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('Invalid form data');
  }

  const title = (formData.get('title') as string)?.trim();
  const subject = (formData.get('subject') as string)?.trim();
  const grade = (formData.get('grade') as string)?.trim();
  const board = (formData.get('board') as string)?.trim() || null;
  const category = (formData.get('category') as string)?.trim() || 'question_paper';
  const paperType = (formData.get('paper_type') as string)?.trim() || null;
  const chapterName = (formData.get('chapter_name') as string)?.trim() || null;
  const topicName = (formData.get('topic_name') as string)?.trim() || null;
  const description = (formData.get('description') as string)?.trim() || null;
  const files = formData.getAll('files') as File[];

  if (!title || !subject || !grade) {
    return fail('Title, subject, and grade are required');
  }
  if (!['question_paper', 'topic'].includes(category)) {
    return fail('Category must be question_paper or topic');
  }
  if (!files.length) {
    return fail('At least one file is required');
  }
  if (files.length > MAX_FILES) {
    return fail(`Maximum ${MAX_FILES} files allowed`);
  }

  // Validate each file
  for (const f of files) {
    if (!f.size) return fail(`Empty file: ${f.name}`);
    if (f.size > MAX_FILE_SIZE) return fail(`File too large (max 50 MB): ${f.name}`);
    const ext = getExtension(f.name);
    if (!ext) return fail(`File must have an extension: ${f.name}`);
  }

  // Save files to disk
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'exam-topics');
  await mkdir(uploadDir, { recursive: true });

  const savedFiles: { url: string; name: string; size: number; mime: string }[] = [];
  for (const f of files) {
    const safeName = `${randomUUID()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await f.arrayBuffer());
    await writeFile(filePath, buffer);
    savedFiles.push({
      url: `/uploads/exam-topics/${safeName}`,
      name: f.name,
      size: f.size,
      mime: f.type || 'application/octet-stream',
    });
  }

  // Insert topic record with 'ready' status
  const topicResult = await db.query(`
    INSERT INTO session_exam_topics
      (title, subject, grade, board, category, paper_type, chapter_name, topic_name,
       topic_description, pdf_url, pdf_filename, uploaded_by, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ready')
    RETURNING id
  `, [title, subject, grade, board, category, paperType, chapterName, topicName,
      description, savedFiles[0].url, savedFiles[0].name, session.id]);

  const topicId = topicResult.rows[0].id as string;

  // Insert file records
  for (const sf of savedFiles) {
    await db.query(`
      INSERT INTO exam_topic_files (topic_id, file_url, file_name, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5)
    `, [topicId, sf.url, sf.name, sf.size, sf.mime]);
  }

  return NextResponse.json({
    success: true,
    data: { id: topicId, status: 'ready' },
    message: 'Questions uploaded successfully.',
  });
}

// ── DELETE: Delete topic(s) and their files ─────────────────
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!AO_ROLES.includes(session.role)) return fail('Permission denied', 403);

  const singleId = req.nextUrl.searchParams.get('id');
  const bulkIds = req.nextUrl.searchParams.get('ids');
  const ids: string[] = bulkIds ? bulkIds.split(',').map(s => s.trim()).filter(Boolean) : singleId ? [singleId] : [];
  if (!ids.length) return fail('Topic ID(s) required');

  let deleted = 0;
  for (const id of ids) {
    const filesResult = await db.query(
      `SELECT file_url FROM exam_topic_files WHERE topic_id = $1`, [id]
    );
    const existing = await db.query(
      `SELECT pdf_url, uploaded_by FROM session_exam_topics WHERE id = $1`, [id]
    );
    if (existing.rows.length === 0) continue;

    // Teachers can only delete their own uploads
    if (session.role === 'teacher' && existing.rows[0].uploaded_by !== String(session.id)) {
      continue;
    }

    for (const row of filesResult.rows) {
      const fileUrl = row.file_url as string;
      if (fileUrl?.startsWith('/uploads/exam-topics/')) {
        try { await unlink(path.join(process.cwd(), 'public', fileUrl)); } catch { /* ok */ }
      }
    }
    const legacyUrl = existing.rows[0].pdf_url as string | null;
    if (legacyUrl?.startsWith('/uploads/exam-topics/') &&
        !filesResult.rows.some(r => (r.file_url as string) === legacyUrl)) {
      try { await unlink(path.join(process.cwd(), 'public', legacyUrl)); } catch { /* ok */ }
    }

    await db.query(`DELETE FROM session_exam_topics WHERE id = $1`, [id]);
    deleted++;
  }

  return NextResponse.json({ success: true, message: `Deleted ${deleted} topic(s)` });
}
