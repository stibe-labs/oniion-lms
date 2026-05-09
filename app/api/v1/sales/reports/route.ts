// ═══════════════════════════════════════════════════════════════
// Sales CRM — Reports API
// GET — aggregated analytics (funnel, source breakdown, trends)
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

  const url = req.nextUrl;
  const days = Math.min(365, Math.max(7, parseInt(url.searchParams.get('days') || '30')));

  // Conversion funnel
  const funnelRes = await db.query(`
    SELECT pipeline_stage, COUNT(*)::int AS count
    FROM crm_leads
    WHERE is_archived = FALSE AND created_at >= NOW() - INTERVAL '1 day' * $1
    GROUP BY pipeline_stage
  `, [days]);

  // Source breakdown
  const sourceRes = await db.query(`
    SELECT source, COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE pipeline_stage = 'enrolled')::int AS converted
    FROM crm_leads
    WHERE is_archived = FALSE AND created_at >= NOW() - INTERVAL '1 day' * $1
    GROUP BY source
    ORDER BY count DESC
  `, [days]);

  // Daily trend (leads created per day)
  const trendRes = await db.query(`
    SELECT created_at::date AS date, COUNT(*)::int AS count
    FROM crm_leads
    WHERE created_at >= NOW() - INTERVAL '1 day' * $1
    GROUP BY created_at::date
    ORDER BY date
  `, [days]);

  // Activity summary
  const activityRes = await db.query(`
    SELECT activity_type, COUNT(*)::int AS count
    FROM crm_activities
    WHERE created_at >= NOW() - INTERVAL '1 day' * $1
    GROUP BY activity_type
    ORDER BY count DESC
  `, [days]);

  // Avg time in pipeline (new → enrolled)
  const conversionTimeRes = await db.query(`
    SELECT
      AVG(EXTRACT(EPOCH FROM (converted_at - created_at)) / 86400)::numeric(10,1) AS avg_days
    FROM crm_leads
    WHERE pipeline_stage = 'enrolled' AND converted_at IS NOT NULL
      AND created_at >= NOW() - INTERVAL '1 day' * $1
  `, [days]);

  return NextResponse.json({
    success: true,
    data: {
      funnel: funnelRes.rows,
      sources: sourceRes.rows,
      dailyTrend: trendRes.rows,
      activitySummary: activityRes.rows,
      avgConversionDays: conversionTimeRes.rows[0]?.avg_days ?? null,
      period: days,
    },
  });
}
