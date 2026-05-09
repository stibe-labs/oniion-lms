// ═══════════════════════════════════════════════════════════════
// Student Status API — PATCH /api/v1/student-status
// Manages student enrollment status within batches:
//   active, discontinued, on_break, rejoined
// GET returns discontinued/on_break students for dashboard panels
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status'); // discontinued, on_break, rejoined
    const batchId = url.searchParams.get('batch_id');

    let sql = `
      SELECT bs.id, bs.batch_id, bs.student_email, bs.parent_email,
             bs.student_status, bs.discontinued_at, bs.rejoined_at, bs.status_note, bs.added_at,
             b.batch_name, b.grade, b.section, b.status AS batch_status,
             u.full_name AS student_name, u.profile_image
      FROM batch_students bs
      JOIN batches b ON b.batch_id = bs.batch_id
      LEFT JOIN portal_users u ON u.email = bs.student_email
      WHERE bs.student_status != 'active'
    `;
    const params: unknown[] = [];

    if (statusFilter && ['discontinued', 'on_break', 'rejoined'].includes(statusFilter)) {
      params.push(statusFilter);
      sql += ` AND bs.student_status = $${params.length}`;
    }

    if (batchId) {
      params.push(batchId);
      sql += ` AND bs.batch_id = $${params.length}`;
    }

    // AO data isolation: only show students from AO's batches
    if (user.role === 'academic_operator') {
      params.push(user.id);
      sql += ` AND b.academic_operator_email = $${params.length}`;
    }

    sql += ` ORDER BY COALESCE(bs.discontinued_at, bs.rejoined_at, bs.added_at) DESC LIMIT 200`;

    const result = await db.query(sql, params);
    return NextResponse.json({ success: true, data: { students: result.rows } });
  } catch (err) {
    console.error('[student-status] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { batch_id, student_email, status, note } = body as {
      batch_id: string; student_email: string; status: string; note?: string;
    };

    if (!batch_id || !student_email || !status) {
      return NextResponse.json({ success: false, error: 'batch_id, student_email, and status required' }, { status: 400 });
    }

    const validStatuses = ['active', 'discontinued', 'on_break', 'rejoined'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Check if student exists in batch
    const check = await db.query(
      `SELECT id, student_status FROM batch_students WHERE batch_id = $1 AND student_email = $2`,
      [batch_id, student_email]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Student not found in this batch' }, { status: 404 });
    }

    const current = (check.rows[0] as Record<string, unknown>).student_status;

    // Build dynamic update
    const sets: string[] = ['student_status = $3', 'status_note = $4'];
    const params: unknown[] = [batch_id, student_email, status, note || null];

    if (status === 'discontinued' || status === 'on_break') {
      sets.push(`discontinued_at = NOW()`);
    }
    if (status === 'rejoined' || status === 'active') {
      sets.push(`rejoined_at = NOW()`);
    }

    await db.query(
      `UPDATE batch_students SET ${sets.join(', ')} WHERE batch_id = $1 AND student_email = $2`,
      params
    );

    // Log event for audit
    try {
      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          `batch:${batch_id}`,
          'student_status_change',
          student_email,
          JSON.stringify({ from: current, to: status, note, changed_by: user.id }),
        ]
      );
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      message: `Student ${student_email} status changed to ${status}`,
    });
  } catch (err) {
    console.error('[student-status] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
