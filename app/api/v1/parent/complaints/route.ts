// ═══════════════════════════════════════════════════════════════
// Parent Complaints API — /api/v1/parent/complaints
// GET: list complaints for parent
// POST: submit new complaint
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    // Parents see their own complaints
    if (user.role === 'parent') {
      let sql = `SELECT * FROM parent_complaints WHERE parent_email = $1`;
      const params: unknown[] = [user.id];
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      sql += ` ORDER BY created_at DESC`;
      const result = await db.query(sql, params);
      return NextResponse.json({ success: true, data: { complaints: result.rows } });
    }

    // Admin roles see all complaints
    if (['owner', 'batch_coordinator', 'academic_operator', 'hr'].includes(user.role)) {
      let sql = `SELECT c.*, pu.full_name AS parent_name
                 FROM parent_complaints c
                 LEFT JOIN portal_users pu ON pu.email = c.parent_email
                 WHERE 1=1`;
      const params: unknown[] = [];
      if (status) {
        params.push(status);
        sql += ` AND c.status = $${params.length}`;
      }
      sql += ` ORDER BY c.created_at DESC LIMIT 200`;
      const result = await db.query(sql, params);
      return NextResponse.json({ success: true, data: { complaints: result.rows } });
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  } catch (err) {
    console.error('[parent/complaints] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // Only parents and coordinators/admins can create complaints
    if (!['parent', 'batch_coordinator', 'owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { subject, category, description, priority, student_email } = body;

    if (!subject || !description) {
      return NextResponse.json({
        success: false,
        error: 'Subject and description are required',
      }, { status: 400 });
    }

    const validCategories = ['general', 'teaching', 'fee', 'facility', 'behaviour', 'academic', 'other'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    const result = await db.query(
      `INSERT INTO parent_complaints (
         parent_email, student_email, subject, category, description, priority
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user.role === 'parent' ? user.id : (body.parent_email || user.id),
        student_email || null,
        subject,
        validCategories.includes(category) ? category : 'general',
        description,
        validPriorities.includes(priority) ? priority : 'medium',
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[parent/complaints] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['batch_coordinator', 'owner', 'academic_operator', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Admin roles only' }, { status: 403 });
    }

    const body = await req.json();
    const { complaint_id, status, resolution, assigned_to } = body;

    if (!complaint_id) {
      return NextResponse.json({ success: false, error: 'complaint_id required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (status) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }
      params.push(status);
      updates.push(`status = $${params.length}`);

      if (status === 'resolved' || status === 'closed') {
        updates.push(`resolved_at = NOW()`);
        params.push(user.id);
        updates.push(`resolved_by = $${params.length}`);
      }
    }

    if (resolution) {
      params.push(resolution);
      updates.push(`resolution = $${params.length}`);
    }

    if (assigned_to) {
      params.push(assigned_to);
      updates.push(`assigned_to = $${params.length}`);
    }

    updates.push(`updated_at = NOW()`);

    params.push(complaint_id);
    const result = await db.query(
      `UPDATE parent_complaints SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Complaint not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[parent/complaints] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
