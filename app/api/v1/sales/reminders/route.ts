// ═══════════════════════════════════════════════════════════════
// Sales CRM — Reminders API
// GET   — list reminders (today, overdue, upcoming)
// POST  — create a new reminder
// PATCH — complete/snooze/cancel a reminder
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
  const filter = url.searchParams.get('filter') || 'pending'; // pending | completed | all

  let statusCondition = '';
  if (filter === 'pending') statusCondition = "AND r.status = 'pending'";
  else if (filter === 'completed') statusCondition = "AND r.status = 'completed'";

  const result = await db.query(
    `SELECT r.*, l.full_name AS lead_name, l.phone AS lead_phone
     FROM crm_reminders r
     LEFT JOIN crm_leads l ON l.id = r.lead_id
     WHERE 1=1 ${statusCondition}
     ORDER BY
       CASE WHEN r.status = 'pending' AND r.due_at < NOW() THEN 0 ELSE 1 END,
       r.due_at ASC
     LIMIT 100`
  );

  return NextResponse.json({ success: true, data: result.rows });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { lead_id, title, description, due_at, reminder_type, assigned_to } = body as {
    lead_id?: string;
    title: string;
    description?: string;
    due_at: string;
    reminder_type?: string;
    assigned_to?: string;
  };

  if (!title?.trim() || !due_at) {
    return NextResponse.json({ success: false, error: 'title and due_at are required' }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO crm_reminders (lead_id, title, description, due_at, reminder_type, assigned_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      lead_id || null,
      title.trim(),
      description || null,
      due_at,
      reminder_type || 'follow_up',
      assigned_to || user.id,
      user.id,
    ]
  );

  return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { id, action, snoozed_until } = body as {
    id: string;
    action: 'complete' | 'snooze' | 'cancel';
    snoozed_until?: string;
  };

  if (!id || !action) {
    return NextResponse.json({ success: false, error: 'id and action are required' }, { status: 400 });
  }

  let sql = '';
  const params: unknown[] = [id];

  switch (action) {
    case 'complete':
      sql = `UPDATE crm_reminders SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`;
      break;
    case 'snooze':
      if (!snoozed_until) {
        return NextResponse.json({ success: false, error: 'snoozed_until is required for snooze' }, { status: 400 });
      }
      sql = `UPDATE crm_reminders SET status = 'snoozed', snoozed_until = $2 WHERE id = $1 RETURNING *`;
      params.push(snoozed_until);
      break;
    case 'cancel':
      sql = `UPDATE crm_reminders SET status = 'cancelled' WHERE id = $1 RETURNING *`;
      break;
    default:
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }

  const result = await db.query(sql, params);
  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result.rows[0] });
}
