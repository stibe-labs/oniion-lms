// ---------------------------------------------------------------
// Teaching Materials API - /api/v1/teaching-materials
// Library + Multi-Batch Assignment model.
//
// Materials live independently; a junction table
// (material_batch_assignments) links them to one-or-many batches.
// Academic Operators upload & manage; Teachers + Students read.
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const AO_ROLES = ['academic_operator', 'owner', 'batch_coordinator'];
const ALLOWED_MIME = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/epub+zip',
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff',
  // Video
  'video/mp4', 'video/webm', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska',
  'video/3gpp', 'video/x-flv', 'video/mpeg',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/aac', 'audio/flac',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/gzip', 'application/x-tar',
  // Samsung Notes / Android note apps
  'application/octet-stream',  // Samsung .snb / generic binary
  'application/x-snb',
  'application/vnd.samsung.sdoc',  // Samsung Notes .sdocx
];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

/* ── helpers ──────────────────────────────────────────────── */

/** Core SELECT + aggregate batches array */
const MATERIALS_SELECT = `
  SELECT tm.id, tm.subject, tm.title, tm.description,
         tm.file_url, tm.file_name, tm.file_size, tm.mime_type,
         tm.material_type, tm.uploaded_by, tm.created_at, tm.updated_at,
         COALESCE(
           json_agg(
             json_build_object('batch_id', mba.batch_id, 'batch_name', b.batch_name)
           ) FILTER (WHERE mba.batch_id IS NOT NULL),
           '[]'::json
         ) AS batches
  FROM   teaching_materials tm
  LEFT JOIN material_batch_assignments mba ON mba.material_id = tm.id
  LEFT JOIN batches b ON b.batch_id = mba.batch_id
`;

/** Add backward-compat batch_name (first batch) for Flutter clients */
function addLegacyBatchName(rows: Record<string, unknown>[]) {
  for (const r of rows) {
    const bs = r.batches as { batch_id: string; batch_name: string }[];
    r.batch_name = bs.length > 0 ? bs[0].batch_name : null;
    r.batch_id   = bs.length > 0 ? bs[0].batch_id   : null;
  }
  return rows;
}

// -- GET -----------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch_id');
    const roomFilter = searchParams.get('room_id');

    // -- OC materials: fetch by room_id (open classroom) ------
    // This is used by TeacherView and Flutter to get materials for an OC session
    if (roomFilter && roomFilter.startsWith('oc_')) {
      const ocResult = await db.query(
        `SELECT tm.id, tm.subject, tm.title, tm.description,
                tm.file_url, tm.file_name, tm.file_size, tm.mime_type,
                tm.material_type, tm.uploaded_by, tm.created_at, tm.updated_at,
                '[]'::json AS batches
         FROM teaching_materials tm
         WHERE tm.open_classroom_id = (
           SELECT oc.id FROM open_classrooms oc WHERE oc.livekit_room_name = $1 OR oc.room_id = $1 LIMIT 1
         )
         ORDER BY tm.created_at`,
        [roomFilter]
      );
      const rows = ocResult.rows as Record<string, unknown>[];
      for (const r of rows) { r.batch_name = null; r.batch_id = null; }
      return NextResponse.json({ success: true, data: { materials: rows } });
    }

    // -- Teacher: materials assigned to their batches ---------
    if (user.role === 'teacher') {
      const params: string[] = [user.id];
      let where = `WHERE mba.batch_id IN (SELECT bt.batch_id FROM batch_teachers bt WHERE bt.teacher_email = $1)`;
      if (batchFilter) { params.push(batchFilter); where += ` AND mba.batch_id = $2`; }

      const result = await db.query(
        `${MATERIALS_SELECT} ${where} GROUP BY tm.id ORDER BY tm.created_at DESC`,
        params,
      );
      return NextResponse.json({ success: true, data: { materials: addLegacyBatchName(result.rows) } });
    }

    // -- Student: materials assigned to their batches ---------
    if (user.role === 'student') {
      const params: string[] = [user.id];
      let where = `WHERE mba.batch_id IN (SELECT bs.batch_id FROM batch_students bs WHERE bs.student_email = $1)`;
      if (batchFilter) { params.push(batchFilter); where += ` AND mba.batch_id = $2`; }

      const result = await db.query(
        `${MATERIALS_SELECT} ${where} GROUP BY tm.id ORDER BY tm.created_at DESC`,
        params,
      );
      return NextResponse.json({ success: true, data: { materials: addLegacyBatchName(result.rows) } });
    }

    // -- Academic Operator / Owner / Coordinator --------------
    if (AO_ROLES.includes(user.role ?? '')) {
      const isOwner = user.role === 'owner';
      const params: string[] = [];
      let where = 'WHERE 1=1';

      if (!isOwner) {
        params.push(user.id);
        where += ` AND tm.uploaded_by = $${params.length}`;
      }
      if (batchFilter) {
        params.push(batchFilter);
        where += ` AND mba.batch_id = $${params.length}`;
      }

      const [materialsResult, batchResult] = await Promise.all([
        db.query(
          `${MATERIALS_SELECT} ${where} GROUP BY tm.id ORDER BY tm.created_at DESC`,
          params,
        ),
        isOwner
          ? db.query(`SELECT batch_id, batch_name, subjects, grade FROM batches WHERE status = 'active' ORDER BY batch_name`)
          : db.query(
              `SELECT batch_id, batch_name, subjects, grade FROM batches WHERE academic_operator_email = $1 AND status = 'active' ORDER BY batch_name`,
              [user.id],
            ),
      ]);

      return NextResponse.json({
        success: true,
        data: { materials: addLegacyBatchName(materialsResult.rows), batches: batchResult.rows },
      });
    }

    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  } catch (err) {
    console.error('[teaching-materials GET]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// -- POST (multipart file upload) -----------------------------
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !AO_ROLES.includes(user.role ?? '')) {
      return NextResponse.json({ success: false, error: 'Academic Operator access only' }, { status: 403 });
    }

    const formData      = await req.formData();
    const file          = formData.get('file') as File | null;
    const subject       = (formData.get('subject')       as string | null)?.trim();
    const title         = (formData.get('title')         as string | null)?.trim();
    const description   = (formData.get('description')   as string | null)?.trim() || null;
    const material_type = (formData.get('material_type') as string | null) || 'notes';

    // Accept batch_ids (JSON array) OR legacy batch_id (single string)
    let batchIds: string[] = [];
    const rawBatchIds = formData.get('batch_ids') as string | null;
    if (rawBatchIds) {
      try { batchIds = JSON.parse(rawBatchIds); } catch { batchIds = [rawBatchIds]; }
    }
    const legacyBatch = (formData.get('batch_id') as string | null)?.trim();
    if (legacyBatch && batchIds.length === 0) batchIds = [legacyBatch];

    if (!subject)  return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
    if (!title)    return NextResponse.json({ success: false, error: 'Title is required' },   { status: 400 });
    if (!file)     return NextResponse.json({ success: false, error: 'File is required' },    { status: 400 });

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ success: false, error: `File type "${file.type}" not allowed. Supported: documents, images, videos, audio, archives, and Samsung Notes.` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 200 MB)' }, { status: 400 });
    }

    // Write file to disk
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'materials');
    await mkdir(uploadDir, { recursive: true });

    const ext      = path.extname(file.name) || '';
    const safeName = `${randomUUID()}${ext}`;
    await writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()));

    // Insert material row
    const result = await db.query(
      `INSERT INTO teaching_materials
         (subject, title, description, file_url, file_name, file_size, mime_type, material_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [subject, title, description,
       `/uploads/materials/${safeName}`, file.name, file.size, file.type,
       material_type, user.id],
    );
    const material = result.rows[0];

    // Create batch assignments
    if (batchIds.length > 0) {
      const valueSets = batchIds.map((_, i) => `($1, $${i + 2}, $${batchIds.length + 2})`);
      await db.query(
        `INSERT INTO material_batch_assignments (material_id, batch_id, assigned_by)
         VALUES ${valueSets.join(',')}
         ON CONFLICT DO NOTHING`,
        [material.id, ...batchIds, user.id],
      );
    }

    // Re-fetch with batches for response
    const full = await db.query(
      `${MATERIALS_SELECT} WHERE tm.id = $1 GROUP BY tm.id`,
      [material.id],
    );

    return NextResponse.json({ success: true, data: addLegacyBatchName(full.rows)[0] }, { status: 201 });
  } catch (err) {
    console.error('[teaching-materials POST]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// -- PATCH (update metadata + batch assignments) ---------------
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !AO_ROLES.includes(user.role ?? '')) {
      return NextResponse.json({ success: false, error: 'Academic Operator access only' }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, description, material_type, batch_ids } = body as {
      id: string;
      title?: string;
      description?: string;
      material_type?: string;
      batch_ids?: string[];
    };

    if (!id) return NextResponse.json({ success: false, error: 'Material ID required' }, { status: 400 });

    // Verify ownership (owner can edit any)
    const isOwner = user.role === 'owner';
    const existing = await db.query(
      isOwner
        ? `SELECT id FROM teaching_materials WHERE id = $1`
        : `SELECT id FROM teaching_materials WHERE id = $1 AND uploaded_by = $2`,
      isOwner ? [id] : [id, user.id],
    );
    if (existing.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Material not found or not yours' }, { status: 404 });
    }

    // Update metadata fields
    const sets: string[] = [];
    const params: (string | null)[] = [id];
    if (title !== undefined)         { params.push(title.trim());                     sets.push(`title = $${params.length}`); }
    if (description !== undefined)   { params.push(description?.trim() ?? null);      sets.push(`description = $${params.length}`); }
    if (material_type !== undefined)  { params.push(material_type);                    sets.push(`material_type = $${params.length}`); }

    if (sets.length > 0) {
      sets.push('updated_at = NOW()');
      await db.query(`UPDATE teaching_materials SET ${sets.join(', ')} WHERE id = $1`, params);
    }

    // Update batch assignments (full replace)
    if (batch_ids !== undefined) {
      await db.query(`DELETE FROM material_batch_assignments WHERE material_id = $1`, [id]);
      if (batch_ids.length > 0) {
        const valueSets = batch_ids.map((_: string, i: number) => `($1, $${i + 2}, $${batch_ids.length + 2})`);
        await db.query(
          `INSERT INTO material_batch_assignments (material_id, batch_id, assigned_by)
           VALUES ${valueSets.join(',')}
           ON CONFLICT DO NOTHING`,
          [id, ...batch_ids, user.id],
        );
      }
    }

    // Re-fetch
    const full = await db.query(
      `${MATERIALS_SELECT} WHERE tm.id = $1 GROUP BY tm.id`,
      [id],
    );

    return NextResponse.json({ success: true, data: addLegacyBatchName(full.rows)[0] });
  } catch (err) {
    console.error('[teaching-materials PATCH]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// -- DELETE ---------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !AO_ROLES.includes(user.role ?? '')) {
      return NextResponse.json({ success: false, error: 'Academic Operator access only' }, { status: 403 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Material ID required' }, { status: 400 });

    const isOwner = user.role === 'owner';
    const existing = await db.query(
      isOwner
        ? `SELECT id, file_url FROM teaching_materials WHERE id = $1`
        : `SELECT id, file_url FROM teaching_materials WHERE id = $1 AND uploaded_by = $2`,
      isOwner ? [id] : [id, user.id],
    );

    if (existing.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Material not found or not yours' }, { status: 404 });
    }

    const fileUrl = existing.rows[0].file_url as string;
    if (fileUrl?.startsWith('/uploads/materials/')) {
      try { await unlink(path.join(process.cwd(), 'public', fileUrl)); } catch { /* already gone */ }
    }

    await db.query(`DELETE FROM teaching_materials WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[teaching-materials DELETE]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
