// ═══════════════════════════════════════════════════════════════
// Sales CRM — Single Lead API
// GET    — get lead detail + activities + reminders
// PATCH  — update lead (stage, info, assignment)
// DELETE — archive lead (soft delete)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

function isSalesOrOwner(role: string) {
  return role === 'sales' || role === 'owner';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const leadRes = await db.query(
    'SELECT * FROM crm_leads WHERE id = $1',
    [id]
  );
  if (leadRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  const activitiesRes = await db.query(
    `SELECT * FROM crm_activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [id]
  );

  const remindersRes = await db.query(
    `SELECT * FROM crm_reminders WHERE lead_id = $1 ORDER BY due_at ASC`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: {
      lead: leadRes.rows[0],
      activities: activitiesRes.rows,
      reminders: remindersRes.rows,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Whitelist allowed fields
  const allowed: Record<string, string> = {
    full_name: 'full_name',
    phone: 'phone',
    email: 'email',
    whatsapp: 'whatsapp',
    student_grade: 'student_grade',
    student_board: 'student_board',
    subjects_interested: 'subjects_interested',
    batch_type_pref: 'batch_type_pref',
    pipeline_stage: 'pipeline_stage',
    priority: 'priority',
    tags: 'tags',
    assigned_to: 'assigned_to',
    lost_reason: 'lost_reason',
    source_detail: 'source_detail',
  };

  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, col] of Object.entries(allowed)) {
    if (key in body) {
      sets.push(`${col} = $${idx}`);
      vals.push(body[key]);
      idx++;
    }
  }

  if (sets.length === 1) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  vals.push(id);
  const result = await db.query(
    `UPDATE crm_leads SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  // Log stage change as activity
  if ('pipeline_stage' in body) {
    await db.query(
      `INSERT INTO crm_activities (lead_id, activity_type, title, performed_by)
       VALUES ($1, 'stage_change', $2, $3)`,
      [id, `Stage changed to ${body.pipeline_stage}`, user.id]
    );
  }

  return NextResponse.json({ success: true, data: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const result = await db.query(
    `UPDATE crm_leads SET is_archived = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
