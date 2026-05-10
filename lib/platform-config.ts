import { db } from '@/lib/db';
export type { SplashTemplate, SplashProgressStyle, SplashLoadingAnim, SplashConfig, SplashTaglineWeight } from './splash-config';
export { SPLASH_CONFIG_DEFAULTS } from './splash-config';
import type { SplashTemplate, SplashProgressStyle, SplashLoadingAnim, SplashConfig, SplashTaglineWeight } from './splash-config';
import { SPLASH_CONFIG_DEFAULTS } from './splash-config';
export type { AuthConfig, AuthTemplate, AuthBgPattern } from './auth-config';
export { AUTH_CONFIG_DEFAULTS } from './auth-config';
import type { AuthConfig } from './auth-config';
import { AUTH_CONFIG_DEFAULTS } from './auth-config';
export type { ThemeConfig } from './theme-config';
export { THEME_DEFAULTS } from './theme-config';
import type { ThemeConfig } from './theme-config';
import { THEME_DEFAULTS } from './theme-config';

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
  loadingCharacterUrl: string | null;
  authHeight: number;
  splashHeight: number;
  sidebarHeight: number;
  emailHeight: number;
}

export async function getLogoConfig(): Promise<LogoConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN (
        'logo_small_url', 'logo_full_url', 'favicon_url', 'loading_character_url',
        'logo_auth_height', 'logo_splash_height', 'logo_sidebar_height', 'logo_email_height'
      )`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    return {
      logoSmallUrl:        map['logo_small_url'] ?? null,
      logoFullUrl:         map['logo_full_url']  ?? null,
      faviconUrl:          map['favicon_url']    ?? null,
      loadingCharacterUrl: map['loading_character_url'] ?? null,
      authHeight:    parseInt(map['logo_auth_height']    ?? '40', 10),
      splashHeight:  parseInt(map['logo_splash_height']  ?? '36', 10),
      sidebarHeight: parseInt(map['logo_sidebar_height'] ?? '20', 10),
      emailHeight:   parseInt(map['logo_email_height']   ?? '36', 10),
    };
  } catch {
    return { logoSmallUrl: null, logoFullUrl: null, faviconUrl: null, loadingCharacterUrl: null, authHeight: 40, splashHeight: 36, sidebarHeight: 20, emailHeight: 36 };
  }
}

export async function getSplashConfig(): Promise<SplashConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN (
        'splash_template', 'splash_progress_style', 'splash_loading_anim',
        'splash_tagline', 'splash_tagline_size', 'splash_tagline_weight', 'splash_tagline_letter_spacing',
        'splash_accent_color', 'splash_bg_color',
        'splash_show_quotes', 'splash_quotes'
      )`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    let quotes: string[] = [];
    try { quotes = JSON.parse(map['splash_quotes'] ?? '[]'); } catch {}
    return {
      template:             (map['splash_template']        ?? 'classic')     as SplashTemplate,
      progressStyle:        (map['splash_progress_style']  ?? 'bar')         as SplashProgressStyle,
      loadingAnim:          (map['splash_loading_anim'] === 'buji' ? 'character' : (map['splash_loading_anim'] ?? 'character')) as SplashLoadingAnim,
      tagline:              map['splash_tagline']       ?? 'Crafting Future',
      taglineSize:          parseInt(map['splash_tagline_size'] ?? '13', 10),
      taglineWeight:        (map['splash_tagline_weight'] ?? 'semibold') as SplashTaglineWeight,
      taglineLetterSpacing: parseInt(map['splash_tagline_letter_spacing'] ?? '4', 10),
      accentColor:          map['splash_accent_color']  ?? '#10b981',
      bgColor:              map['splash_bg_color']      ?? '#fafbfc',
      showQuotes:           map['splash_show_quotes'] === 'true',
      quotes,
    };
  } catch {
    return { ...SPLASH_CONFIG_DEFAULTS };
  }
}

export async function getThemeConfig(): Promise<ThemeConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN ('theme_primary', 'theme_secondary')`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    return {
      primaryColor:   map['theme_primary']   ?? THEME_DEFAULTS.primaryColor,
      secondaryColor: map['theme_secondary']  ?? THEME_DEFAULTS.secondaryColor,
    };
  } catch {
    return { ...THEME_DEFAULTS };
  }
}

export async function getAuthConfig(): Promise<AuthConfig> {
  try {
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM school_config WHERE key IN (
        'auth_template', 'auth_accent_color', 'auth_bg_color',
        'auth_headline', 'auth_subheadline', 'auth_show_tagline', 'auth_bg_pattern'
      )`
    );
    const map = Object.fromEntries(result.rows.map(r => [r.key, r.value]));
    return {
      template:    (map['auth_template']    ?? 'classic') as AuthConfig['template'],
      accentColor:  map['auth_accent_color'] ?? '#10b981',
      bgColor:      map['auth_bg_color']     ?? '#f0fdf4',
      headline:     map['auth_headline']     ?? 'Empowering every learner',
      subheadline:  map['auth_subheadline']  ?? 'Sign in to continue learning',
      showTagline:  map['auth_show_tagline'] !== 'false',
      bgPattern:   (map['auth_bg_pattern']   ?? 'dots') as AuthConfig['bgPattern'],
    };
  } catch {
    return { ...AUTH_CONFIG_DEFAULTS };
  }
}

