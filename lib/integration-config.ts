/**
 * Integration configuration — reads from school_config DB (prefix: integration_*)
 * with automatic fallback to process.env.
 * 5-minute in-memory cache. Call invalidateIntegrationConfig() after saves.
 */
import { db } from '@/lib/db';

export interface LiveKitCfg {
  url: string; apiKey: string; apiSecret: string;
}
export interface EmailCfg {
  smtpHost: string; smtpPort: number; smtpSecure: boolean;
  smtpUser: string; smtpPass: string;
  fromName: string; fromAddress: string; mode: string;
}
export interface RazorpayCfg {
  keyId: string; keySecret: string; mode: string; callbackUrl: string;
}
export interface WhatsAppCfg {
  apiToken: string; phoneNumberId: string; businessAccountId: string;
  mode: string; metaVerifyToken: string; metaAppSecret: string;
}
export interface FacebookCfg {
  pageId: string; pageAccessToken: string; adAccountId: string;
}
export interface GroqCfg {
  apiKey: string; model: string; visionModel: string;
}
export interface YouTubeCfg {
  clientId: string; clientSecret: string; refreshToken: string;
}
export interface CRMCfg {
  webhookUrl: string; webhookSecret: string; apiKey: string;
}

export interface IntegrationConfig {
  livekit: LiveKitCfg;
  email: EmailCfg;
  razorpay: RazorpayCfg;
  whatsapp: WhatsAppCfg;
  facebook: FacebookCfg;
  groq: GroqCfg;
  youtube: YouTubeCfg;
  crm: CRMCfg;
}

let _cache: IntegrationConfig | null = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function invalidateIntegrationConfig() {
  _cache = null;
  _cacheAt = 0;
}

function e(key: string, fallback = '') {
  return process.env[key] || fallback;
}

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;

  let m: Record<string, string> = {};
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key LIKE 'integration_%' OR key = 'livekit_url'`
    );
    m = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
  } catch { /* fall back to env */ }

  const d = (k: string, envKey?: string, fallback = '') =>
    m[k] || (envKey ? e(envKey, fallback) : fallback);

  const livekitEnvUrl =
    e('LIVEKIT_URL') ||
    e('NEXT_PUBLIC_LIVEKIT_URL').replace('ws://', 'http://').replace('wss://', 'https://') ||
    'http://localhost:7880';

  _cache = {
    livekit: {
      url:       d('integration_livekit_url', undefined, m['livekit_url'] || livekitEnvUrl),
      apiKey:    d('integration_livekit_api_key', 'LIVEKIT_API_KEY'),
      apiSecret: d('integration_livekit_api_secret', 'LIVEKIT_API_SECRET'),
    },
    email: {
      smtpHost:    d('integration_smtp_host', 'SMTP_HOST', 'smtp.gmail.com'),
      smtpPort:    parseInt(d('integration_smtp_port', 'SMTP_PORT', '587'), 10),
      smtpSecure:  (d('integration_smtp_secure', 'SMTP_SECURE', 'false')) === 'true',
      smtpUser:    d('integration_smtp_user', 'SMTP_USER'),
      smtpPass:    d('integration_smtp_pass', 'SMTP_PASS').replace(/\s/g, ''),
      fromName:    d('integration_email_from_name', 'EMAIL_FROM_NAME', 'stibe Classes'),
      fromAddress: d('integration_email_from_address', 'EMAIL_FROM_ADDRESS', 'noreply@stibelearning.online'),
      mode:        d('integration_email_mode', 'EMAIL_MODE', 'smtp'),
    },
    razorpay: {
      keyId:       d('integration_razorpay_key_id', 'RAZORPAY_KEY_ID'),
      keySecret:   d('integration_razorpay_key_secret', 'RAZORPAY_KEY_SECRET'),
      mode:        d('integration_razorpay_mode', 'PAYMENT_MODE', 'test'),
      callbackUrl: d('integration_razorpay_callback_url', 'PAYMENT_CALLBACK_URL',
        `${e('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')}/api/v1/payment/callback`),
    },
    whatsapp: {
      apiToken:          d('integration_whatsapp_api_token', 'WHATSAPP_API_TOKEN'),
      phoneNumberId:     d('integration_whatsapp_phone_id', 'WHATSAPP_PHONE_NUMBER_ID'),
      businessAccountId: d('integration_whatsapp_business_id', 'WHATSAPP_BUSINESS_ACCOUNT_ID'),
      mode:              d('integration_whatsapp_mode', 'WHATSAPP_MODE', 'mock'),
      metaVerifyToken:   d('integration_meta_verify_token', 'META_WEBHOOK_VERIFY_TOKEN', 'stibe_wa_verify_2026'),
      metaAppSecret:     d('integration_meta_app_secret', 'META_APP_SECRET'),
    },
    facebook: {
      pageId:          d('integration_fb_page_id', 'FB_PAGE_ID'),
      pageAccessToken: d('integration_fb_page_token', 'FB_PAGE_ACCESS_TOKEN'),
      adAccountId:     d('integration_fb_ad_account_id', 'FB_AD_ACCOUNT_ID'),
    },
    groq: {
      apiKey:      d('integration_groq_api_key', 'GROQ_API_KEY'),
      model:       d('integration_groq_model', 'GROQ_MODEL', 'llama-3.3-70b-versatile'),
      visionModel: d('integration_groq_vision_model', 'GROQ_VISION_MODEL', 'meta-llama/llama-4-scout-17b-16e-instruct'),
    },
    youtube: {
      clientId:     d('integration_youtube_client_id', 'YOUTUBE_CLIENT_ID'),
      clientSecret: d('integration_youtube_client_secret', 'YOUTUBE_CLIENT_SECRET'),
      refreshToken: d('integration_youtube_refresh_token', 'YOUTUBE_REFRESH_TOKEN'),
    },
    crm: {
      webhookUrl:    d('integration_crm_webhook_url', 'STIBE_CRM_WEBHOOK_URL'),
      webhookSecret: d('integration_crm_webhook_secret', 'STIBE_CRM_WEBHOOK_SECRET'),
      apiKey:        d('integration_crm_api_key', 'CRM_INTEGRATION_API_KEY'),
    },
  };

  _cacheAt = now;
  return _cache;
}
