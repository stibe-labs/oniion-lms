// ═══════════════════════════════════════════════════════════════
// Teacher Reports Management API — /api/v1/teacher-reports
// GET:   List reports (batch_coordinator, academic_operator, owner)
// PATCH: Update report status/resolution
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const ALLOWED_ROLES = ['batch_coordinator', 'academic_operator', 'owner'];

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const severity = url.searchParams.get('severity');
    const teacher_email = url.searchParams.get('teacher_email');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`tr.status = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`tr.category = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`tr.severity = $${params.length}`);
    }
    if (teacher_email) {
      params.push(teacher_email);
      conditions.push(`tr.teacher_email = $${params.length}`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count query
    const countRes = await db.query(
      `SELECT COUNT(*) AS total FROM teacher_reports tr ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.total || 0);

    // Data query
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT tr.*,
              r.room_name,
              b.batch_name,
              b.grade,
              b.section
       FROM teacher_reports tr
       LEFT JOIN rooms r ON r.room_id = tr.room_id
       LEFT JOIN batches b ON b.batch_id = tr.batch_id
       ${where}
       ORDER BY
         CASE tr.severity
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         tr.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    // Summary counts
    const summaryRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open') AS open_count,
         COUNT(*) FILTER (WHERE status = 'investigating') AS investigating_count,
         COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
         COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed_count,
         COUNT(*) FILTER (WHERE severity = 'critical' AND status IN ('open','investigating')) AS critical_active
       FROM teacher_reports`,
    );

    return NextResponse.json({
      success: true,
      data: {
        reports: dataRes.rows,
        total,
        summary: summaryRes.rows[0],
      },
    });
  } catch (err) {
    console.error('[teacher-reports] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { report_id, status, resolution, assigned_to } = body;

    if (!report_id) {
      return NextResponse.json({ success: false, error: 'report_id is required' }, { status: 400 });
    }

    const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      if (status === 'resolved' || status === 'dismissed') {
        updates.push(`resolved_at = NOW()`);
        params.push(user.id);
        updates.push(`resolved_by = $${params.length}`);
      }
    }
    if (resolution !== undefined) {
      params.push((resolution || '').slice(0, 2000));
      updates.push(`resolution = $${params.length}`);
    }
    if (assigned_to !== undefined) {
      params.push(assigned_to || null);
      updates.push(`assigned_to = $${params.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 });
    }

    updates.push('updated_at = NOW()');
    params.push(report_id);

    const result = await db.query(
      `UPDATE teacher_reports SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[teacher-reports] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
