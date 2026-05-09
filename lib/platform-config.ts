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

export type SplashTemplate     = 'classic' | 'minimal' | 'bold' | 'dark' | 'branded';
export type SplashProgressStyle = 'bar' | 'dots' | 'ring' | 'pulse' | 'none';
export type SplashLoadingAnim  = 'buji' | 'none';

export interface SplashConfig {
  template:      SplashTemplate;
  progressStyle: SplashProgressStyle;
  loadingAnim:   SplashLoadingAnim;
  tagline:       string;
  accentColor:   string;
  bgColor:       string;
  showQuotes:    boolean;
  quotes:        string[];
}

export const SPLASH_CONFIG_DEFAULTS: SplashConfig = {
  template:      'classic',
  progressStyle: 'bar',
  loadingAnim:   'buji',
  tagline:       'Crafting Future',
  accentColor:   '#10b981',
  bgColor:       '#fafbfc',
  showQuotes:    false,
  quotes:        [],
};

export async function getSplashConfig(): Promise<SplashConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN (
        'splash_template', 'splash_progress_style', 'splash_loading_anim',
        'splash_tagline', 'splash_accent_color', 'splash_bg_color',
        'splash_show_quotes', 'splash_quotes'
      )`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    let quotes: string[] = [];
    try { quotes = JSON.parse(map['splash_quotes'] ?? '[]'); } catch {}
    return {
      template:      (map['splash_template']        ?? 'classic')     as SplashTemplate,
      progressStyle: (map['splash_progress_style']  ?? 'bar')         as SplashProgressStyle,
      loadingAnim:   (map['splash_loading_anim']    ?? 'buji')        as SplashLoadingAnim,
      tagline:       map['splash_tagline']       ?? 'Crafting Future',
      accentColor:   map['splash_accent_color']  ?? '#10b981',
      bgColor:       map['splash_bg_color']      ?? '#fafbfc',
      showQuotes:    map['splash_show_quotes'] === 'true',
      quotes,
    };
  } catch {
    return { ...SPLASH_CONFIG_DEFAULTS };
  }
}

