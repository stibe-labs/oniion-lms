import { db } from '@/lib/db';

export async function getPlatformName(): Promise<string> {
  try {
    const result = await db.query<{ value: string }>(
      "SELECT value FROM school_config WHERE key = 'platform_name'",
      []
    );
    return result.rows[0]?.value ?? 'Stibe';
  } catch {
    return 'Stibe';
  }
}

export async function getBujiEnabled(): Promise<boolean> {
  try {
    const result = await db.query<{ value: string }>(
      "SELECT value FROM school_config WHERE key = 'buji_enabled'",
      []
    );
    // Default true if not set
    return result.rows[0]?.value !== 'false';
  } catch {
    return true;
  }
}

export interface LogoConfig {
  logoSmallUrl: string | null;
  logoFullUrl: string | null;
  faviconUrl: string | null;
  authHeight: number;
  splashHeight: number;
  sidebarHeight: number;
  emailHeight: number;
}

export async function getLogoConfig(): Promise<LogoConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN (
        'logo_small_url', 'logo_full_url', 'favicon_url',
        'logo_auth_height', 'logo_splash_height', 'logo_sidebar_height', 'logo_email_height'
      )`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    return {
      logoSmallUrl:  map['logo_small_url'] ?? null,
      logoFullUrl:   map['logo_full_url']  ?? null,
      faviconUrl:    map['favicon_url']    ?? null,
      authHeight:    parseInt(map['logo_auth_height']    ?? '40', 10),
      splashHeight:  parseInt(map['logo_splash_height']  ?? '36', 10),
      sidebarHeight: parseInt(map['logo_sidebar_height'] ?? '20', 10),
      emailHeight:   parseInt(map['logo_email_height']   ?? '36', 10),
    };
  } catch {
    return { logoSmallUrl: null, logoFullUrl: null, faviconUrl: null, authHeight: 40, splashHeight: 36, sidebarHeight: 20, emailHeight: 36 };
  }
}
