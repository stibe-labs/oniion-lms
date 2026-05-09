// ═══════════════════════════════════════════════════════════════
// Sales CRM — Dashboard Stats API
// GET — overview stats (pipeline counts, today's reminders, recent leads)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || (user.role !== 'sales' && user.role !== 'owner')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Pipeline stage counts
  const pipelineRes = await db.query(`
    SELECT pipeline_stage, COUNT(*)::int AS count
    FROM crm_leads
    WHERE is_archived = FALSE
    GROUP BY pipeline_stage
    ORDER BY CASE pipeline_stage
      WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'interested' THEN 3
      WHEN 'demo_scheduled' THEN 4 WHEN 'demo_completed' THEN 5
      WHEN 'negotiation' THEN 6 WHEN 'enrolled' THEN 7
      WHEN 'lost' THEN 8 WHEN 'disqualified' THEN 9
    END
  `);

  // Source breakdown
  const sourceRes = await db.query(`
    SELECT source, COUNT(*)::int AS count
    FROM crm_leads
    WHERE is_archived = FALSE
    GROUP BY source
    ORDER BY count DESC
  `);

  // Today's reminders
  const remindersRes = await db.query(`
    SELECT r.id, r.title, r.due_at, r.reminder_type, r.status,
           l.full_name AS lead_name, l.id AS lead_id
    FROM crm_reminders r
    LEFT JOIN crm_leads l ON l.id = r.lead_id
    WHERE r.status = 'pending'
      AND r.due_at::date <= CURRENT_DATE
    ORDER BY r.due_at ASC
    LIMIT 10
  `);

  // Recent leads (last 10)
  const recentRes = await db.query(`
    SELECT id, full_name, phone, source, pipeline_stage, lead_score, created_at
    FROM crm_leads
    WHERE is_archived = FALSE
    ORDER BY created_at DESC
    LIMIT 10
  `);

  // Total counts
  const totalsRes = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today,
      COUNT(*) FILTER (WHERE pipeline_stage = 'enrolled')::int AS enrolled,
      COUNT(*) FILTER (WHERE pipeline_stage = 'lost')::int AS lost
    FROM crm_leads
    WHERE is_archived = FALSE
  `);

  // Overdue reminders count
  const overdueRes = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM crm_reminders
    WHERE status = 'pending' AND due_at < NOW()
  `);

  return NextResponse.json({
    success: true,
    data: {
      pipeline: pipelineRes.rows,
      sources: sourceRes.rows,
      todayReminders: remindersRes.rows,
      recentLeads: recentRes.rows,
      totals: totalsRes.rows[0],
      overdueReminders: (overdueRes.rows[0] as { count: number }).count,
    },
  });
}
