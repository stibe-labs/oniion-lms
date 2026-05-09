// Splash screen types and defaults — no DB imports, safe for client components

export type SplashTemplate     = 'classic' | 'minimal' | 'bold' | 'dark' | 'branded';
export type SplashProgressStyle = 'bar' | 'dots' | 'ring' | 'pulse' | 'wave' | 'none';
export type SplashLoadingAnim  = 'character' | 'none';
export type SplashTaglineWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export interface SplashConfig {
  template:            SplashTemplate;
  progressStyle:       SplashProgressStyle;
  loadingAnim:         SplashLoadingAnim;
  tagline:             string;
  taglineSize:         number;          // px: 10–32
  taglineWeight:       SplashTaglineWeight;
  taglineLetterSpacing: number;         // px: 0–12
  accentColor:         string;
  bgColor:             string;
  showQuotes:          boolean;
  quotes:              string[];
}

export const SPLASH_CONFIG_DEFAULTS: SplashConfig = {
  template:             'classic',
  progressStyle:        'bar',
  loadingAnim:          'character',
  tagline:              'Crafting Future',
  taglineSize:          13,
  taglineWeight:        'semibold',
  taglineLetterSpacing: 4,
  accentColor:          '#10b981',
  bgColor:              '#fafbfc',
  showQuotes:           false,
  quotes:               [],
};

export const TAGLINE_WEIGHT_MAP: Record<SplashTaglineWeight, number> = {
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
};
