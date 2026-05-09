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
}

export async function getLogoConfig(): Promise<LogoConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN ('logo_small_url', 'logo_full_url', 'favicon_url')`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    return {
      logoSmallUrl: map['logo_small_url'] ?? null,
      logoFullUrl:  map['logo_full_url']  ?? null,
      faviconUrl:   map['favicon_url']    ?? null,
    };
  } catch {
    return { logoSmallUrl: null, logoFullUrl: null, faviconUrl: null };
  }
}
