// ═══════════════════════════════════════════════════════════════
// Sales CRM — Facebook Leads Sync API
// POST — trigger sync of leads from Facebook Lead Ads
// GET  — get sync status / last sync info
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

function isSalesOrOwner(role: string) {
  return role === 'sales' || role === 'owner';
}

const GRAPH_API = 'https://graph.facebook.com/v21.0';

interface FBFieldData {
  name: string;
  values: string[];
}

interface FBLead {
  id: string;
  created_time: string;
  field_data: FBFieldData[];
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  form_id?: string;
}

// Field name normalization — FB forms have inconsistent field names
function extractField(fieldData: FBFieldData[], ...possibleNames: string[]): string {
  for (const name of possibleNames) {
    const field = fieldData.find(f => f.name.toLowerCase().includes(name.toLowerCase()));
    if (field && field.values[0]) return field.values[0];
  }
  return '';
}

function classifyCampaign(campaignName: string): { source: string; category: string } {
  const lower = campaignName.toLowerCase();
  if (lower.includes('hiring') || lower.includes('recruit')) {
    return { source: 'facebook_lead', category: 'hiring' };
  }
  if (lower.includes('admission') || lower.includes('adm') || lower.includes('cbse')) {
    return { source: 'facebook_lead', category: 'admission' };
  }
  if (lower.includes('sales') || lower.includes('lead')) {
    return { source: 'facebook_lead', category: 'sales' };
  }
  return { source: 'facebook_lead', category: 'other' };
}

function buildNotesFromFields(fieldData: FBFieldData[], skipFields: string[]): string {
  const notes: string[] = [];
  for (const field of fieldData) {
    const name = field.name.toLowerCase();
    if (skipFields.some(s => name.includes(s))) continue;
    const value = field.values?.[0];
    if (value) {
      const label = field.name.replace(/_/g, ' ').replace(/\?/g, '');
      notes.push(`${label}: ${value}`);
    }
  }
  return notes.join('\n');
}

async function fetchWithRetry(url: string, retries = 2): Promise<unknown> {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429 && i < retries) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw new Error(`Graph API ${resp.status}: ${JSON.stringify(err)}`);
      }
      return resp.json();
    } catch (e) {
      clearTimeout(timeout);
      if (i >= retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const FB_TOKEN = process.env.WHATSAPP_API_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
  const AD_ACCOUNT = process.env.FB_AD_ACCOUNT_ID;

  if (!FB_TOKEN || !AD_ACCOUNT) {
    return NextResponse.json({ success: false, error: 'Facebook API credentials not configured' }, { status: 500 });
  }

  const results = {
    campaigns_scanned: 0,
    ads_scanned: 0,
    leads_fetched: 0,
    leads_imported: 0,
    leads_skipped: 0,
    errors: [] as string[],
  };

  try {
    // Step 1: Get all campaigns
    const campaignsData = await fetchWithRetry(
      `${GRAPH_API}/${AD_ACCOUNT}/campaigns?fields=name,id,status,objective&limit=50&access_token=${FB_TOKEN}`
    ) as { data: Array<{ id: string; name: string; status: string; objective: string }> };

    const campaigns = campaignsData.data || [];
    results.campaigns_scanned = campaigns.length;

    for (const campaign of campaigns) {
      // Step 2: Get ads for each campaign
      let adsData: { data: Array<{ id: string; name: string }> };
      try {
        adsData = await fetchWithRetry(
          `${GRAPH_API}/${campaign.id}/ads?fields=name,id&limit=50&access_token=${FB_TOKEN}`
        ) as typeof adsData;
      } catch (e) {
        results.errors.push(`Campaign ${campaign.name}: failed to fetch ads`);
        continue;
      }

      const ads = adsData.data || [];
      results.ads_scanned += ads.length;

      for (const ad of ads) {
        // Step 3: Get leads from each ad (with pagination)
        let nextUrl: string | null = `${GRAPH_API}/${ad.id}/leads?fields=created_time,field_data,ad_id,ad_name,campaign_id,form_id&limit=500&access_token=${FB_TOKEN}`;

        while (nextUrl) {
          let leadsPage: { data: FBLead[]; paging?: { next?: string } };
          try {
            leadsPage = await fetchWithRetry(nextUrl) as typeof leadsPage;
          } catch {
            results.errors.push(`Ad ${ad.name}: failed to fetch leads`);
            break;
          }

          const leads = leadsPage.data || [];
          results.leads_fetched += leads.length;

          for (const lead of leads) {
            try {
              // Check if already imported
              const existing = await db.query(
                'SELECT id FROM crm_leads WHERE fb_lead_id = $1',
                [lead.id]
              );
              if (existing.rows.length > 0) {
                results.leads_skipped++;
                continue;
              }

              const { source, category } = classifyCampaign(campaign.name);
              const fullName = extractField(lead.field_data, 'full_name', 'name');
              const phone = extractField(lead.field_data, 'phone', 'phone_number', 'mobile');
              const email = extractField(lead.field_data, 'email', 'e-mail');

              if (!fullName && !phone) {
                results.leads_skipped++;
                continue;
              }

              // Build extra notes from all other fields
              const notes = buildNotesFromFields(lead.field_data, [
                'full_name', 'name', 'phone', 'phone_number', 'mobile', 'email',
              ]);

              // Determine tags based on campaign category
              const tags: string[] = [category];
              if (campaign.name.toLowerCase().includes('cbse')) tags.push('cbse');

              await db.query(
                `INSERT INTO crm_leads (
                   full_name, phone, email, whatsapp,
                   source, source_detail,
                   ad_id, ad_name, campaign_id, campaign_name, form_id, fb_lead_id,
                   pipeline_stage, priority, tags, assigned_to,
                   utm_source, utm_medium, utm_campaign,
                   created_at
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
                [
                  fullName || `Lead ${phone}`,
                  phone || null,
                  email || null,
                  phone || null, // whatsapp = phone by default
                  source,
                  notes || null,
                  lead.ad_id || ad.id,
                  lead.ad_name || ad.name,
                  lead.campaign_id || campaign.id,
                  campaign.name,
                  lead.form_id || null,
                  lead.id, // fb_lead_id for dedup
                  'new',
                  category === 'admission' || category === 'sales' ? 'high' : 'medium',
                  `{${tags.join(',')}}`,
                  user.id,
                  'facebook',
                  'lead_ad',
                  campaign.name,
                  lead.created_time,
                ]
              );

              // Auto-create activity
              await db.query(
                `INSERT INTO crm_activities (lead_id, activity_type, title, description, performed_by)
                 VALUES (
                   (SELECT id FROM crm_leads WHERE fb_lead_id = $1),
                   'system',
                   'Lead imported from Facebook',
                   $2,
                   $3
                 )`,
                [lead.id, `Campaign: ${campaign.name}\nAd: ${ad.name}`, user.id]
              );

              results.leads_imported++;
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (!msg.includes('duplicate')) {
                results.errors.push(`Lead ${lead.id}: ${msg}`);
              } else {
                results.leads_skipped++;
              }
            }
          }

          nextUrl = leadsPage.paging?.next || null;
        }
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg, data: results }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !isSalesOrOwner(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Return stats about FB-sourced leads
  const stats = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE source = 'facebook_lead') AS fb_leads,
      COUNT(*) FILTER (WHERE source = 'facebook_lead' AND created_at > NOW() - INTERVAL '24 hours') AS fb_today,
      MAX(created_at) FILTER (WHERE source = 'facebook_lead') AS last_fb_lead,
      COUNT(DISTINCT campaign_name) FILTER (WHERE source = 'facebook_lead') AS campaigns
    FROM crm_leads
    WHERE is_archived = FALSE
  `);

  return NextResponse.json({ success: true, data: stats.rows[0] });
}
