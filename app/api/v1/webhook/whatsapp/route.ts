// ═══════════════════════════════════════════════════════════════
// WhatsApp Cloud API Webhook — Auto-capture CTWA leads
// GET  — Meta webhook verification (hub.challenge)
// POST — Incoming messages → create CRM leads
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'stibe_wa_verify_2026';
const APP_SECRET = process.env.META_APP_SECRET || '';

// ── GET: Webhook verification ────────────────────────────────
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    console.log('[wa-webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ── POST: Incoming messages ──────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify signature if APP_SECRET is set
  if (APP_SECRET) {
    const signature = req.headers.get('x-hub-signature-256') || '';
    const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
    if (signature !== expected) {
      console.warn('[wa-webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Must respond 200 quickly to Meta
  try {
    await processWebhook(payload);
  } catch (err) {
    console.error('[wa-webhook] Processing error:', err);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// ── Types ────────────────────────────────────────────────────

interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          referral?: {
            source_url?: string;
            source_type?: string;      // 'ad' | 'post'
            source_id?: string;        // ad ID
            headline?: string;         // ad headline
            body?: string;             // ad body
            ctwa_clid?: string;        // click-to-whatsapp click ID
            media_type?: string;
          };
        }>;
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
}

// ── Process incoming webhook ─────────────────────────────────

async function processWebhook(payload: WebhookPayload) {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      for (const msg of messages) {
        const contact = contacts.find(c => c.wa_id === msg.from);
        const senderName = contact?.profile?.name || '';
        const senderPhone = '+' + msg.from; // wa_id is E.164 without +
        const referral = msg.referral;

        // Use the WhatsApp message ID as dedup key
        const waConversationId = `wa_${msg.from}_${value.metadata.phone_number_id}`;

        // Check if we already have this lead (by phone or conversation)
        const existing = await db.query(
          `SELECT id FROM crm_leads
           WHERE wa_conversation_id = $1
              OR (phone = $2 AND source = 'whatsapp_ctwa')
           LIMIT 1`,
          [waConversationId, senderPhone]
        );

        if (existing.rows.length > 0) {
          // Lead exists — log the message as an activity
          await db.query(
            `INSERT INTO crm_activities (lead_id, activity_type, title, description, performed_by)
             VALUES ($1, 'whatsapp_received', 'WhatsApp message received', $2, 'system')`,
            [existing.rows[0].id, msg.text?.body || `[${msg.type}]`]
          );
          continue;
        }

        // New lead — determine source details from referral
        let adId: string | null = null;
        let adName: string | null = null;
        let sourceDetail = 'WhatsApp direct message';

        if (referral) {
          adId = referral.source_id || null;
          adName = referral.headline || null;
          sourceDetail = referral.source_type === 'ad'
            ? `CTWA Ad: ${referral.headline || referral.source_id || 'unknown'}`
            : `WhatsApp via ${referral.source_type || 'unknown'}`;
        }

        // Look up campaign info from the ad if we have an ad_id
        let campaignName: string | null = null;
        if (adId) {
          try {
            const FB_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN || '';
            const resp = await fetch(
              `https://graph.facebook.com/v21.0/${adId}?fields=campaign{name}&access_token=${FB_TOKEN}`
            );
            const data = await resp.json() as { campaign?: { name: string } };
            campaignName = data.campaign?.name || null;
          } catch {
            // Non-critical — continue without campaign name
          }
        }

        // Create the lead
        await db.query(
          `INSERT INTO crm_leads (
             full_name, phone, whatsapp,
             source, source_detail,
             ad_id, ad_name, campaign_name,
             pipeline_stage, priority, tags,
             wa_conversation_id,
             utm_source, utm_medium,
             created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
          [
            senderName || `WhatsApp ${senderPhone}`,
            senderPhone,
            senderPhone,
            'whatsapp_ctwa',
            sourceDetail,
            adId,
            adName,
            campaignName,
            'new',
            referral ? 'high' : 'medium', // CTWA ad leads = high priority
            referral ? '{ctwa,whatsapp}' : '{whatsapp}',
            waConversationId,
            'whatsapp',
            referral?.source_type === 'ad' ? 'ctwa_ad' : 'direct',
          ]
        );

        // Create auto-activity for the first message
        const leadResult = await db.query(
          'SELECT id FROM crm_leads WHERE wa_conversation_id = $1',
          [waConversationId]
        );
        if (leadResult.rows[0]) {
          await db.query(
            `INSERT INTO crm_activities (lead_id, activity_type, title, description, performed_by)
             VALUES ($1, 'whatsapp_received', 'Lead created from WhatsApp', $2, 'system')`,
            [
              leadResult.rows[0].id,
              `First message: ${msg.text?.body || `[${msg.type}]`}${referral ? `\nAd: ${referral.headline || referral.source_id}` : ''}`,
            ]
          );
        }

        console.log(`[wa-webhook] New CTWA lead: ${senderName} (${senderPhone})${referral ? ' via ad' : ''}`);
      }
    }
  }
}
