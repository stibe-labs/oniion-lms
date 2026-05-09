// ═══════════════════════════════════════════════════════════════
// Sales CRM — Leads API
// GET  — list leads (paginated, filter, search, sort)
// POST — create a new lead (manual entry)
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

  // Special endpoint: ?meta=campaigns returns distinct campaign list
  if (url.searchParams.get('meta') === 'campaigns') {
    const res = await db.query(
      `SELECT campaign_name, COUNT(*)::int AS count
       FROM crm_leads
       WHERE campaign_name IS NOT NULL AND is_archived = FALSE
       GROUP BY campaign_name ORDER BY count DESC`
    );
    return NextResponse.json({ success: true, data: res.rows });
  }

  // Special endpoint: ?meta=adsets returns distinct ad_name list (optionally filtered by campaign)
  if (url.searchParams.get('meta') === 'adsets') {
    const filterCampaign = url.searchParams.get('campaign') || '';
    if (filterCampaign) {
      const res = await db.query(
        `SELECT ad_name, COUNT(*)::int AS count
         FROM crm_leads
         WHERE ad_name IS NOT NULL AND is_archived = FALSE AND campaign_name = $1
         GROUP BY ad_name ORDER BY count DESC`,
        [filterCampaign]
      );
      return NextResponse.json({ success: true, data: res.rows });
    }
    const res = await db.query(
      `SELECT ad_name, COUNT(*)::int AS count
       FROM crm_leads
       WHERE ad_name IS NOT NULL AND is_archived = FALSE
       GROUP BY ad_name ORDER BY count DESC`
    );
    return NextResponse.json({ success: true, data: res.rows });
  }

  // Special endpoint: ?meta=export returns ALL matching leads as CSV-ready JSON (no pagination)
  const isExport = url.searchParams.get('meta') === 'export';

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = isExport ? 10000 : Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));
  const offset = isExport ? 0 : (page - 1) * limit;
  const search = url.searchParams.get('search')?.trim() || '';
  const stage = url.searchParams.get('stage') || '';
  const source = url.searchParams.get('source') || '';
  const priority = url.searchParams.get('priority') || '';
  const campaign = url.searchParams.get('campaign') || '';
  const adName = url.searchParams.get('ad_name') || '';
  const sourceType = url.searchParams.get('source_type') || '';
  const dateFrom = url.searchParams.get('date_from') || '';
  const dateTo = url.searchParams.get('date_to') || '';
  const hasPhone = url.searchParams.get('has_phone');
  const hasEmail = url.searchParams.get('has_email');
  const sort = url.searchParams.get('sort') || 'created_at';
  const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

  // Whitelist sort columns
  const sortCols: Record<string, string> = {
    created_at: 'l.created_at',
    full_name: 'l.full_name',
    lead_score: 'l.lead_score',
    pipeline_stage: 'l.pipeline_stage',
    updated_at: 'l.updated_at',
    priority: 'l.priority',
    source: 'l.source',
    campaign_name: 'l.campaign_name',
  };
  const sortCol = sortCols[sort] || 'l.created_at';

  const conditions: string[] = ['l.is_archived = FALSE'];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(l.full_name ILIKE $${paramIdx} OR l.phone ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (stage) {
    conditions.push(`l.pipeline_stage = $${paramIdx}`);
    params.push(stage);
    paramIdx++;
  }
  if (source) {
    conditions.push(`l.source = $${paramIdx}`);
    params.push(source);
    paramIdx++;
  }
  if (priority) {
    conditions.push(`l.priority = $${paramIdx}`);
    params.push(priority);
    paramIdx++;
  }
  if (campaign) {
    conditions.push(`l.campaign_name = $${paramIdx}`);
    params.push(campaign);
    paramIdx++;
  }
  if (adName) {
    conditions.push(`l.ad_name = $${paramIdx}`);
    params.push(adName);
    paramIdx++;
  }
  if (sourceType === 'online') {
    conditions.push(`l.source IN ('facebook_lead','instagram_lead','website','whatsapp_ctwa')`);
  } else if (sourceType === 'offline') {
    conditions.push(`l.source IN ('manual','walkin','phone_call','referral','other')`);
  }
  if (dateFrom) {
    conditions.push(`l.created_at >= $${paramIdx}::date`);
    params.push(dateFrom);
    paramIdx++;
  }
  if (dateTo) {
    conditions.push(`l.created_at < ($${paramIdx}::date + INTERVAL '1 day')`);
    params.push(dateTo);
    paramIdx++;
  }
  if (hasPhone === 'true') {
    conditions.push(`l.phone IS NOT NULL AND l.phone <> ''`);
  } else if (hasPhone === 'false') {
    conditions.push(`(l.phone IS NULL OR l.phone = '')`);
  }
  if (hasEmail === 'true') {
    conditions.push(`l.email IS NOT NULL AND l.email <> ''`);
  } else if (hasEmail === 'false') {
    conditions.push(`(l.email IS NULL OR l.email = '')`);
  }

  const where = conditions.join(' AND ');

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM crm_leads l WHERE ${where}`,
    params
  );
  const total = (countRes.rows[0] as { total: number }).total;

  const leadsRes = await db.query(
    `SELECT l.id, l.full_name, l.phone, l.email, l.whatsapp,
            l.source, l.pipeline_stage, l.lead_score, l.priority,
            l.tags, l.assigned_to, l.student_grade, l.student_board,
            l.campaign_name, l.ad_name, l.created_at, l.updated_at
     FROM crm_leads l
     WHERE ${where}
     ORDER BY ${sortCol} ${order}
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return NextResponse.json({
    success: true,
    data: {
      leads: leadsRes.rows,
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
    full_name, phone, email, whatsapp, student_grade, student_board,
    subjects_interested, batch_type_pref, source, source_detail,
    pipeline_stage, priority, tags, assigned_to,
  } = body as {
    full_name: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    student_grade?: string;
    student_board?: string;
    subjects_interested?: string[];
    batch_type_pref?: string;
    source?: string;
    source_detail?: string;
    pipeline_stage?: string;
    priority?: string;
    tags?: string[];
    assigned_to?: string;
  };

  if (!full_name?.trim()) {
    return NextResponse.json({ success: false, error: 'full_name is required' }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO crm_leads (
       full_name, phone, email, whatsapp, student_grade, student_board,
       subjects_interested, batch_type_pref, source, source_detail,
       pipeline_stage, priority, tags, assigned_to
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      full_name.trim(),
      phone?.trim() || null,
      email?.trim() || null,
      whatsapp?.trim() || null,
      student_grade || null,
      student_board || null,
      subjects_interested || '{}',
      batch_type_pref || null,
      source || 'manual',
      source_detail || null,
      pipeline_stage || 'new',
      priority || 'medium',
      tags || '{}',
      assigned_to || user.id,
    ]
  );

  // Auto-create activity
  await db.query(
    `INSERT INTO crm_activities (lead_id, activity_type, title, performed_by)
     VALUES ($1, 'system', 'Lead created manually', $2)`,
    [result.rows[0].id, user.id]
  );

  return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
}
