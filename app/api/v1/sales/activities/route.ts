// ═══════════════════════════════════════════════════════════════
// Sales CRM — Activities API
// GET  — list activities (by lead or global, paginated)
// POST — log a new activity (call, note, follow-up, etc.)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

function isSalesOrOwner(role: string) {
  return role === 'sales' || role === 'owner';
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = req.nextUrl;
  const leadId = url.searchParams.get('lead_id');
  const activityType = url.searchParams.get('type');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30')));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (leadId) {
    conditions.push(`a.lead_id = $${paramIdx}`);
    params.push(leadId);
    paramIdx++;
  }
  if (activityType) {
    conditions.push(`a.activity_type = $${paramIdx}`);
    params.push(activityType);
    paramIdx++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM crm_activities a ${where}`,
    params
  );
  const total = (countRes.rows[0] as { total: number }).total;

  const activitiesRes = await db.query(
    `SELECT a.*, l.full_name AS lead_name
     FROM crm_activities a
     LEFT JOIN crm_leads l ON l.id = a.lead_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return NextResponse.json({
    success: true,
    data: {
      activities: activitiesRes.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    lead_id, activity_type, title, description, outcome,
    call_duration_sec, call_direction,
  } = body as {
    lead_id: string;
    activity_type: string;
    title: string;
    description?: string;
    outcome?: string;
    call_duration_sec?: number;
    call_direction?: string;
  };

  if (!lead_id || !activity_type || !title?.trim()) {
    return NextResponse.json({ success: false, error: 'lead_id, activity_type, and title are required' }, { status: 400 });
  }

  // Verify lead exists
  const leadCheck = await db.query('SELECT id FROM crm_leads WHERE id = $1', [lead_id]);
  if (leadCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
  }

  const result = await db.query(
    `INSERT INTO crm_activities (lead_id, activity_type, title, description, outcome,
       call_duration_sec, call_direction, performed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      lead_id,
      activity_type,
      title.trim(),
      description || null,
      outcome || null,
      call_duration_sec || null,
      call_direction || null,
      user.id,
    ]
  );

  // Update lead's updated_at
  await db.query(
    'UPDATE crm_leads SET updated_at = NOW() WHERE id = $1',
    [lead_id]
  );

  return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
}
