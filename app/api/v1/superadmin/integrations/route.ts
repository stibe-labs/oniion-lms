import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { getIntegrationConfig, invalidateIntegrationConfig } from '@/lib/integration-config';

// Keys that hold secrets and should be masked in GET response
const SECRET_KEYS = new Set([
  'integration_livekit_api_secret',
  'integration_smtp_pass',
  'integration_razorpay_key_secret',
  'integration_whatsapp_api_token',
  'integration_meta_app_secret',
  'integration_fb_page_token',
  'integration_groq_api_key',
  'integration_youtube_client_secret',
  'integration_youtube_refresh_token',
  'integration_crm_webhook_secret',
  'integration_crm_api_key',
]);

// All configurable integration keys
const ALL_KEYS = [
  'integration_livekit_url', 'integration_livekit_api_key', 'integration_livekit_api_secret',
  'integration_smtp_host', 'integration_smtp_port', 'integration_smtp_secure',
  'integration_smtp_user', 'integration_smtp_pass',
  'integration_email_from_name', 'integration_email_from_address', 'integration_email_mode',
  'integration_razorpay_key_id', 'integration_razorpay_key_secret',
  'integration_razorpay_mode', 'integration_razorpay_callback_url',
  'integration_whatsapp_api_token', 'integration_whatsapp_phone_id',
  'integration_whatsapp_business_id', 'integration_whatsapp_mode',
  'integration_meta_verify_token', 'integration_meta_app_secret',
  'integration_fb_page_id', 'integration_fb_page_token', 'integration_fb_ad_account_id',
  'integration_groq_api_key', 'integration_groq_model', 'integration_groq_vision_model',
  'integration_youtube_client_id', 'integration_youtube_client_secret', 'integration_youtube_refresh_token',
  'integration_crm_webhook_url', 'integration_crm_webhook_secret', 'integration_crm_api_key',
];

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Fetch current DB values for all integration keys
  const result = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM school_config WHERE key = ANY($1)`,
    [ALL_KEYS]
  );
  const dbMap: Record<string, string> = Object.fromEntries(result.rows.map(r => [r.key, r.value]));

  // Build response: for each key include db value (masked if secret), env value, and source
  const cfg = await getIntegrationConfig();

  const data: Record<string, { value: string; source: 'db' | 'env' | 'default'; hasDbValue: boolean }> = {};

  for (const key of ALL_KEYS) {
    const inDb = key in dbMap;
    const rawValue = inDb ? dbMap[key] : '';
    const isSecret = SECRET_KEYS.has(key);
    data[key] = {
      value: isSecret && rawValue ? '••••••••' : rawValue,
      source: inDb ? 'db' : 'env',
      hasDbValue: inDb,
    };
  }

  return NextResponse.json({ success: true, data, config: {
    livekit: { url: cfg.livekit.url, apiKey: cfg.livekit.apiKey },
    email: { smtpHost: cfg.email.smtpHost, smtpPort: cfg.email.smtpPort, smtpUser: cfg.email.smtpUser, fromName: cfg.email.fromName, fromAddress: cfg.email.fromAddress, mode: cfg.email.mode },
    razorpay: { keyId: cfg.razorpay.keyId, mode: cfg.razorpay.mode, callbackUrl: cfg.razorpay.callbackUrl },
    whatsapp: { phoneNumberId: cfg.whatsapp.phoneNumberId, mode: cfg.whatsapp.mode, metaVerifyToken: cfg.whatsapp.metaVerifyToken },
    facebook: { pageId: cfg.facebook.pageId, adAccountId: cfg.facebook.adAccountId },
    groq: { model: cfg.groq.model, visionModel: cfg.groq.visionModel },
    youtube: { clientId: cfg.youtube.clientId },
    crm: { webhookUrl: cfg.crm.webhookUrl },
  }});
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as Record<string, string>;

  const validKeys = new Set(ALL_KEYS);
  const toSave = Object.entries(body).filter(([k]) => validKeys.has(k));

  if (toSave.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid keys provided' }, { status: 400 });
  }

  for (const [key, value] of toSave) {
    if (value === '' || value === null) {
      // Empty string = delete (revert to env)
      await db.query(`DELETE FROM school_config WHERE key = $1`, [key]);
    } else {
      await db.query(
        `INSERT INTO school_config (key, value, description) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value), `Integration config — ${key}`]
      );
    }
  }

  invalidateIntegrationConfig();
  return NextResponse.json({ success: true });
}
