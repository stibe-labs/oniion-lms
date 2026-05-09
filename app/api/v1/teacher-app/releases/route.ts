import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

type ReleaseRow = {
  id: string;
  platform: string;
  version_name: string;
  version_code: number;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  release_notes: string | null;
  uploaded_by: string;
  is_latest: boolean;
  is_force_update: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const ALLOWED_ROLES = ['academic_operator', 'academic', 'owner'];
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream',
]);

function getBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}` ||
    'https://stibelearning.online'
  ).replace(/\/$/, '');
}

function toReleaseResponse(row: ReleaseRow, request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  return {
    id: row.id,
    platform: row.platform,
    version_name: row.version_name,
    version_code: Number(row.version_code),
    file_url: row.file_url,
    download_url: `${baseUrl}${row.file_url}`,
    file_name: row.file_name,
    file_size: Number(row.file_size),
    mime_type: row.mime_type,
    release_notes: row.release_notes,
    uploaded_by: row.uploaded_by,
    is_latest: row.is_latest,
    is_force_update: row.is_force_update,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getLatestRelease() {
  const result = await db.query<ReleaseRow>(
    `SELECT *
     FROM teacher_app_releases
     WHERE platform = 'android' AND is_active = TRUE
     ORDER BY is_latest DESC, version_code DESC, created_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get('all') === '1';

    if (!all) {
      const latest = await getLatestRelease();
      return NextResponse.json({
        success: true,
        data: {
          release: latest ? toReleaseResponse(latest, request) : null,
        },
      });
    }

    const user = await verifyAuth(request);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.query<ReleaseRow>(
      `SELECT *
       FROM teacher_app_releases
       WHERE platform = 'android'
       ORDER BY is_latest DESC, version_code DESC, created_at DESC`
    );

    return NextResponse.json({
      success: true,
      data: {
        releases: result.rows.map((row) => toReleaseResponse(row, request)),
      },
    });
  } catch (err) {
    console.error('[teacher-app/releases] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('apk') as File | null;
    const versionName = String(formData.get('version_name') || '').trim();
    const versionCode = Number(String(formData.get('version_code') || '').trim());
    const releaseNotes = String(formData.get('release_notes') || '').trim();
    const isForceUpdate = String(formData.get('is_force_update') || 'false') === 'true';
    const makeLatest = String(formData.get('is_latest') || 'true') !== 'false';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Please choose an APK file' }, { status: 400 });
    }
    if (!versionName) {
      return NextResponse.json({ success: false, error: 'Version name is required' }, { status: 400 });
    }
    if (!Number.isInteger(versionCode) || versionCode <= 0) {
      return NextResponse.json({ success: false, error: 'Version code must be a positive integer' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.apk')) {
      return NextResponse.json({ success: false, error: 'Only .apk files are allowed' }, { status: 400 });
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Unsupported APK MIME type' }, { status: 400 });
    }

    const duplicate = await db.query<{ id: string }>(
      `SELECT id FROM teacher_app_releases
       WHERE platform = 'android' AND version_code = $1
       LIMIT 1`,
      [versionCode]
    );
    if (duplicate.rows[0]) {
      return NextResponse.json({ success: false, error: 'This version code already exists' }, { status: 409 });
    }

    const safeVersion = versionName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `stibe-teacher-${safeVersion}-${versionCode}-${Date.now()}.apk`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'apps', 'teacher');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, uniqueName), Buffer.from(await file.arrayBuffer()));
    const fileUrl = `/uploads/apps/teacher/${uniqueName}`;

    const inserted = await db.withTransaction(async (client) => {
      if (makeLatest) {
        await client.query(
          `UPDATE teacher_app_releases
           SET is_latest = FALSE
           WHERE platform = 'android'`
        );
      }

      const result = await client.query<ReleaseRow>(
        `INSERT INTO teacher_app_releases
         (platform, version_name, version_code, file_url, file_name, file_size, mime_type,
          release_notes, uploaded_by, is_latest, is_force_update, is_active)
         VALUES
         ('android', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
         RETURNING *`,
        [
          versionName,
          versionCode,
          fileUrl,
          file.name,
          file.size,
          file.type || 'application/vnd.android.package-archive',
          releaseNotes || null,
          user.id,
          makeLatest,
          isForceUpdate,
        ]
      );
      return result.rows[0];
    });

    return NextResponse.json({
      success: true,
      data: {
        release: toReleaseResponse(inserted, request),
      },
      message: 'Teacher APK uploaded successfully',
    });
  } catch (err) {
    console.error('[teacher-app/releases] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      id?: string;
      is_latest?: boolean;
      is_force_update?: boolean;
      is_active?: boolean;
      release_notes?: string;
    };

    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Release id is required' }, { status: 400 });
    }

    const existing = await db.query<ReleaseRow>(
      `SELECT * FROM teacher_app_releases WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!existing.rows[0]) {
      return NextResponse.json({ success: false, error: 'Release not found' }, { status: 404 });
    }

    const updated = await db.withTransaction(async (client) => {
      if (body.is_latest === true) {
        await client.query(
          `UPDATE teacher_app_releases
           SET is_latest = FALSE
           WHERE platform = 'android'`
        );
      }

      const fields: string[] = [];
      const values: unknown[] = [];

      if (typeof body.is_latest === 'boolean') {
        values.push(body.is_latest);
        fields.push(`is_latest = $${values.length}`);
      }
      if (typeof body.is_force_update === 'boolean') {
        values.push(body.is_force_update);
        fields.push(`is_force_update = $${values.length}`);
      }
      if (typeof body.is_active === 'boolean') {
        values.push(body.is_active);
        fields.push(`is_active = $${values.length}`);
      }
      if (typeof body.release_notes === 'string') {
        values.push(body.release_notes.trim() || null);
        fields.push(`release_notes = $${values.length}`);
      }

      if (fields.length === 0) return existing.rows[0];

      values.push(id);
      const result = await client.query<ReleaseRow>(
        `UPDATE teacher_app_releases
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING *`,
        values
      );
      return result.rows[0];
    });

    return NextResponse.json({
      success: true,
      data: {
        release: toReleaseResponse(updated, request),
      },
      message: 'Teacher app release updated',
    });
  } catch (err) {
    console.error('[teacher-app/releases] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
