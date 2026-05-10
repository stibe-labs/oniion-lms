/**
 * Stibe CRM webhook client.
 * Sends HMAC-SHA256 signed webhook notifications to CRM on demo lifecycle events.
 */
import { createHmac } from 'crypto';
import { getIntegrationConfig } from '@/lib/integration-config';

export type CRMWebhookEvent =
  | 'demo_registered'
  | 'demo_scheduled'
  | 'demo_completed'
  | 'demo_interest'
  | 'enrollment_paid'
  | 'oc_guest_joined';

interface CRMWebhookPayload {
  event: CRMWebhookEvent;
  crm_lead_id: string;
  crm_tenant_id: string;
  demo_request_id?: string;
  [key: string]: unknown;
}

/**
 * Send a signed webhook to Stibe CRM.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function notifyCRM(payload: CRMWebhookPayload): Promise<void> {
  const cfg = await getIntegrationConfig();
  const CRM_WEBHOOK_URL    = cfg.crm.webhookUrl;
  const CRM_WEBHOOK_SECRET = cfg.crm.webhookSecret;

  if (!CRM_WEBHOOK_URL || !CRM_WEBHOOK_SECRET) {
    console.log('[crm-webhook] Not configured, skipping:', payload.event);
    return;
  }
  if (!payload.crm_lead_id || !payload.crm_tenant_id) {
    console.log('[crm-webhook] Missing CRM IDs, skipping:', payload.event);
    return;
  }

  try {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', CRM_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const res = await fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[crm-webhook] CRM returned ${res.status}: ${errText}`);
    } else {
      console.log(`[crm-webhook] ${payload.event} sent to CRM for lead ${payload.crm_lead_id}`);
    }
  } catch (err) {
    console.error('[crm-webhook] Failed to notify CRM:', err);
  }
}
