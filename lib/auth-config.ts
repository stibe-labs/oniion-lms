// Auth screen types and defaults — no DB imports, safe for client components

export type AuthTemplate  = 'classic' | 'minimal' | 'bold' | 'dark' | 'split' | 'branded';
export type AuthBgPattern = 'none' | 'dots' | 'grid' | 'circles';

export interface AuthConfig {
  template:    AuthTemplate;
  accentColor: string;   // hex — buttons, labels, highlights
  bgColor:     string;   // hex — background for classic/minimal
  textColor:   string;   // hex — heading/body text ('' = auto dark)
  headline:    string;   // brand headline shown in split panel
  subheadline: string;   // brand subheadline
  showTagline: boolean;  // show headline/subheadline in brand panel
  bgPattern:   AuthBgPattern;
}

export const AUTH_CONFIG_DEFAULTS: AuthConfig = {
  template:    'classic',
  accentColor: '#22c55e',
  bgColor:     '#f0fdf4',
  textColor:   '',
  headline:    'Empowering every learner',
  subheadline: 'Sign in to continue learning',
  showTagline: true,
  bgPattern:   'dots',
};
