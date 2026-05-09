// Splash screen types and defaults — no DB imports, safe for client components

export type SplashTemplate     = 'classic' | 'minimal' | 'bold' | 'dark' | 'branded';
export type SplashProgressStyle = 'bar' | 'dots' | 'ring' | 'pulse' | 'wave' | 'none';
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
