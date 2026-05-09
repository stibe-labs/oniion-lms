'use client';

import { usePlatformContext, useAuthConfig } from '@/components/providers/PlatformProvider';
import type { AuthConfig } from '@/lib/auth-config';

// ── Background pattern ────────────────────────────────────────────────────────

function patternStyle(pattern: string, color: string): React.CSSProperties {
  if (pattern === 'dots') return {
    backgroundImage: `radial-gradient(circle, ${color}33 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
  };
  if (pattern === 'grid') return {
    backgroundImage: `linear-gradient(${color}1a 1px, transparent 1px), linear-gradient(90deg, ${color}1a 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
  };
  if (pattern === 'circles') return {
    backgroundImage: `radial-gradient(ellipse at 25% 60%, ${color}22 0, transparent 50%), radial-gradient(ellipse at 75% 40%, ${color}22 0, transparent 50%)`,
  };
  return {};
}

// ── Logo block ────────────────────────────────────────────────────────────────

function AuthLogo({ url, height, invert = false, center = true }: { url: string; height: number; invert?: boolean; center?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: center ? 'center' : 'flex-start', marginBottom: 32 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Logo"
        style={{
          height,
          width: 'auto',
          objectFit: 'contain',
          filter: invert ? 'brightness(0) invert(1)' : undefined,
        }}
      />
    </div>
  );
}

// ── White card ────────────────────────────────────────────────────────────────

function Card({ children, shadow = 'default' }: { children: React.ReactNode; shadow?: 'default' | 'heavy' | 'soft' }) {
  const shadows = {
    default: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
    heavy:   '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)',
    soft:    '0 8px 32px rgba(0,0,0,0.08)',
  };
  return (
    <div style={{
      width: '100%',
      maxWidth: 440,
      background: '#ffffff',
      borderRadius: 20,
      boxShadow: shadows[shadow],
      padding: '48px 40px',
    }}>
      {children}
    </div>
  );
}

// ── Shell types ───────────────────────────────────────────────────────────────

type P = {
  children: React.ReactNode;
  cfg: AuthConfig;
  logoUrl: string;
  logoHeight: number;
  platformName: string;
};

// ── Classic ───────────────────────────────────────────────────────────────────
// Soft bg color with optional dot/grid pattern. Centered white card.

function ClassicShell({ children, cfg, logoUrl, logoHeight }: P) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: cfg.bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      ...patternStyle(cfg.bgPattern, cfg.accentColor),
    }}>
      <Card shadow="default">
        <AuthLogo url={logoUrl} height={logoHeight} />
        {children}
      </Card>
    </div>
  );
}

// ── Minimal ───────────────────────────────────────────────────────────────────
// Pure white, no card border. Thin accent line at bottom.

function MinimalShell({ children, cfg, logoUrl, logoHeight }: P) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      position: 'relative',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <AuthLogo url={logoUrl} height={logoHeight} />
        {children}
      </div>
      {/* Accent line at bottom */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${cfg.accentColor}55, ${cfg.accentColor})`,
      }} />
    </div>
  );
}

// ── Bold ──────────────────────────────────────────────────────────────────────
// Gradient background (accent → light). White card centered.

function BoldShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(150deg, ${a} 0%, ${a}bb 40%, ${cfg.bgColor || '#f0fdf4'} 100%)`,
      ...patternStyle(cfg.bgPattern, '#ffffff'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <Card shadow="heavy">
        <AuthLogo url={logoUrl} height={logoHeight} />
        {children}
      </Card>
    </div>
  );
}

// ── Dark ──────────────────────────────────────────────────────────────────────
// Deep dark bg, radial glow, white card.

function DarkShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow behind card */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 700, height: 500,
        background: `radial-gradient(ellipse, ${a}1e 0, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Card shadow="heavy">
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
      </div>
    </div>
  );
}

// ── Split ─────────────────────────────────────────────────────────────────────
// Two-column: left brand panel (accent) + right white form. Mobile: form only.

function SplitShell({ children, cfg, logoUrl, logoHeight, platformName }: P) {
  const a = cfg.accentColor;
  return (
    <div className="flex min-h-dvh">
      {/* Left brand panel — desktop only */}
      <div
        className="hidden md:flex flex-col items-center justify-center shrink-0 p-14 gap-10"
        style={{
          width: '42%',
          background: a,
          ...patternStyle(cfg.bgPattern, '#ffffff'),
          position: 'relative',
        }}
      >
        {/* Decorative circle */}
        <div style={{
          position: 'absolute',
          bottom: -80, right: -80,
          width: 300, height: 300,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          top: -40, left: -40,
          width: 200, height: 200,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 300 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Logo"
            style={{ height: logoHeight * 1.8, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 40 }}
          />
          {cfg.showTagline && (
            <>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 12 }}>
                {cfg.headline}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                {cfg.subheadline}
              </p>
            </>
          )}
        </div>

        <p style={{ position: 'absolute', bottom: 20, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {platformName}
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-8 md:p-12">
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile: show logo (brand panel is hidden) */}
          <div className="md:hidden">
            <AuthLogo url={logoUrl} height={logoHeight} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Branded ───────────────────────────────────────────────────────────────────
// Full accent color bg. White card.

function BrandedShell({ children, cfg, logoUrl, logoHeight }: P) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: cfg.accentColor,
      ...patternStyle(cfg.bgPattern, '#ffffff'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <Card shadow="heavy">
        <AuthLogo url={logoUrl} height={logoHeight} />
        {children}
      </Card>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { logoFullUrl, logoAuthHeight, platformName } = usePlatformContext();
  const cfg = useAuthConfig();

  const logoUrl = logoFullUrl ?? '/logo/full.png';
  const props: P = { children, cfg, logoUrl, logoHeight: logoAuthHeight, platformName };

  switch (cfg.template) {
    case 'minimal':  return <MinimalShell  {...props} />;
    case 'bold':     return <BoldShell     {...props} />;
    case 'dark':     return <DarkShell     {...props} />;
    case 'split':    return <SplitShell    {...props} />;
    case 'branded':  return <BrandedShell  {...props} />;
    default:         return <ClassicShell  {...props} />;
  }
}
