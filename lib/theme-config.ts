export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
}

export const THEME_DEFAULTS: ThemeConfig = {
  primaryColor:   '#22c55e',
  secondaryColor: '#14b8a6',
};

export function buildThemeCss({ primaryColor, secondaryColor }: ThemeConfig): string {
  const rules = [
    `--primary: ${primaryColor}`,
    `--primary-foreground: #ffffff`,
    `--ring: ${primaryColor}`,
    `--brand-green: ${primaryColor}`,
    `--live: ${primaryColor}`,
    `--chart-1: ${primaryColor}`,
    `--sidebar-primary: ${primaryColor}`,
    `--sidebar-ring: ${primaryColor}`,
    `--secondary: ${secondaryColor}`,
    `--secondary-foreground: #ffffff`,
    `--brand-teal: ${secondaryColor}`,
    `--chart-2: ${secondaryColor}`,
  ];
  const block = rules.map(r => `  ${r};`).join('\n');
  return `:root {\n${block}\n}\n.dark {\n${block}\n}`;
}
