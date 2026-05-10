'use client';

import { usePlatformContext, useAuthConfig } from '@/components/providers/PlatformProvider';
import type { AuthConfig } from '@/lib/auth-config';

// ── Deterministic values (SSR-safe — no Math.random) ─────────────────────────

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const PARTICLES = Array.from({ length: 38 }, (_, i) => ({
  x:        sr(i * 1.1)  * 100,
  y:        sr(i * 2.3)  * 100,
  size:     2.5 + sr(i * 3.7) * 5,
  delay:    sr(i * 4.1)  * 12,
  duration: 7  + sr(i * 5.3) * 9,
  opacity:  0.07 + sr(i * 6.7) * 0.18,
}));

const EDU_CHARS = ['π', '∑', '√', '∞', 'Δ', '∫', 'α', 'β', '≈', '∂', 'λ', 'Ω', 'μ', 'θ', '×', '÷'];
const EDU_SYMBOLS = Array.from({ length: 14 }, (_, i) => ({
  x:        4  + sr(i * 7.3)  * 92,
  y:        3  + sr(i * 8.1)  * 90,
  size:     15 + sr(i * 9.7)  * 20,
  delay:    sr(i * 10.3) * 9,
  duration: 9  + sr(i * 11.1) * 7,
  opacity:  0.06 + sr(i * 12.7) * 0.14,
  rotate:   sr(i * 13.3) * 40 - 20,
  char:     EDU_CHARS[i % EDU_CHARS.length],
}));

// ── CSS keyframes (injected once) ─────────────────────────────────────────────

const KEYFRAMES = `
@keyframes auth-particle {
  0%   { transform: translateY(0)    scale(1);   opacity: 0;   }
  12%  { opacity: 1; }
  88%  { opacity: 0.8; }
  100% { transform: translateY(-90px) scale(0.2); opacity: 0; }
}
@keyframes auth-symbol {
  0%, 100% { transform: translateY(0px);  }
  50%       { transform: translateY(-16px); }
}
@keyframes auth-card-in {
  from { opacity: 0; transform: translateY(28px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)     scale(1);   }
}
@keyframes auth-glow-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.9); }
  50%       { opacity: 0.55; transform: scale(1.1); }
}
@keyframes auth-bar-slide {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
`;

// ── Sub-components ────────────────────────────────────────────────────────────

function ParticleField({ color, count = 38 }: { color: string; count?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {PARTICLES.slice(0, count).map((p, i) => (
        <div key={i} style={{
          position:     'absolute',
          left:         `${p.x}%`,
          top:          `${p.y}%`,
          width:         p.size,
          height:        p.size,
          borderRadius: '50%',
          background:    color,
          opacity:       p.opacity,
          animation:    `auth-particle ${p.duration}s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

function EduSymbolField({ color, count = 14 }: { color: string; count?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {EDU_SYMBOLS.slice(0, count).map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%` }}>
          <div style={{
            fontSize:   s.size,
            color,
            opacity:    s.opacity,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 300,
            transform:  `rotate(${s.rotate}deg)`,
            userSelect: 'none',
            animation:  `auth-symbol ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}>
            {s.char}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuthLogo({ url, height, invert = false }: { url: string; height: number; invert?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Logo"
        style={{ height, width: 'auto', objectFit: 'contain', filter: invert ? 'brightness(0) invert(1)' : undefined }}
      />
    </div>
  );
}

function Card({ children, accent, glow = false }: { children: React.ReactNode; accent: string; glow?: boolean }) {
  return (
    <div style={{
      width:        '100%',
      maxWidth:      440,
      background:   '#ffffff',
      borderRadius:  24,
      boxShadow:     glow
        ? `0 0 0 1px ${accent}20, 0 24px 64px ${accent}28, 0 8px 24px rgba(0,0,0,0.08)`
        : '0 24px 64px rgba(0,0,0,0.11), 0 4px 16px rgba(0,0,0,0.06)',
      padding:      '48px 40px',
      animation:    'auth-card-in 0.55s cubic-bezier(0.22,1,0.36,1) both',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Accent top border */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}66, ${accent}ff, ${accent}66)`,
        animation: 'auth-bar-slide 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both',
        transformOrigin: 'left',
      }} />
      {children}
    </div>
  );
}

// ── Template shells ───────────────────────────────────────────────────────────

type P = { children: React.ReactNode; cfg: AuthConfig; logoUrl: string; logoHeight: number; platformName: string };

// Classic — gradient bg, particles, edu symbols, white card
function ClassicShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  const bg = cfg.bgColor || '#f0fdf4';
  return (
    <div style={{
      minHeight:  '100dvh',
      background: `linear-gradient(145deg, ${bg} 0%, #ffffff 55%, ${a}0d 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color={a} />
      <EduSymbolField color={a} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Card accent={a} glow>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
      </div>
    </div>
  );
}

// Minimal — pure white, ghost particles, strong bottom accent
function MinimalShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{
      minHeight: '100dvh', background: '#ffffff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color={a} count={18} />
      <EduSymbolField color={a} count={8} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <AuthLogo url={logoUrl} height={logoHeight} />
        <div style={{ animation: 'auth-card-in 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
          {children}
        </div>
      </div>
      {/* Bottom accent bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${a}44, ${a}, ${a}44)`,
        animation: 'auth-bar-slide 0.8s cubic-bezier(0.22,1,0.36,1) both',
        transformOrigin: 'left',
      }} />
    </div>
  );
}

// Bold — vivid gradient, visible edu symbols, white card with glow
function BoldShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  const bg = cfg.bgColor || '#f0fdf4';
  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(150deg, ${a} 0%, ${a}bb 35%, ${bg} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>
      {/* Bright particles on colored bg */}
      <ParticleField color="rgba(255,255,255,0.7)" />
      <EduSymbolField color="rgba(255,255,255,0.5)" />
      {/* Large soft orb */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)', filter: 'blur(60px)',
        animation: 'auth-glow-pulse 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Card accent={a} glow>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
      </div>
    </div>
  );
}

// Dark — deep dark, glowing particles (constellation vibe), white card
function DarkShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 30% 20%, ${a}22 0, transparent 55%), radial-gradient(ellipse at 70% 80%, ${a}18 0, transparent 50%), #080d18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>
      {/* Stars / glowing particles */}
      <ParticleField color={a} />
      {/* White tiny particles (stars) */}
      <ParticleField color="rgba(255,255,255,0.9)" count={22} />
      <EduSymbolField color={a} />
      {/* Center glow orb */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 600, height: 400, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${a}18 0, transparent 70%)`,
        animation: 'auth-glow-pulse 5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Card accent={a} glow>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
      </div>
    </div>
  );
}

// Split — left: animated brand panel, right: clean white form
function SplitShell({ children, cfg, logoUrl, logoHeight, platformName }: P) {
  const a = cfg.accentColor;
  return (
    <div className="flex min-h-dvh">
      <style>{KEYFRAMES}</style>

      {/* Left brand panel — desktop only */}
      <div
        className="hidden md:flex flex-col items-center justify-center shrink-0 p-14"
        style={{
          width: '44%',
          background: `linear-gradient(155deg, ${a} 0%, ${a}cc 60%, ${a}99 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Particles + edu symbols on brand panel */}
        <ParticleField color="rgba(255,255,255,0.75)" />
        <EduSymbolField color="rgba(255,255,255,0.6)" />

        {/* Large decorative orbs */}
        <div style={{ position: 'absolute', bottom: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

        {/* Brand content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 300 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl} alt="Logo"
            style={{ height: logoHeight * 1.9, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 40 }}
          />
          {cfg.showTagline && (
            <>
              <h2 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                {cfg.headline}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>
                {cfg.subheadline}
              </p>
            </>
          )}
        </div>

        <p style={{ position: 'absolute', bottom: 20, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
          {platformName}
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-8 md:p-12" style={{ position: 'relative', overflow: 'hidden' }}>
        <ParticleField color={a} count={14} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
          <div className="md:hidden" style={{ marginBottom: 32 }}>
            <AuthLogo url={logoUrl} height={logoHeight} />
          </div>
          <div style={{ animation: 'auth-card-in 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Branded — full accent bg, particle burst, white card
function BrandedShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{
      minHeight: '100dvh', background: a,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color="rgba(255,255,255,0.75)" />
      <EduSymbolField color="rgba(255,255,255,0.5)" />
      {/* Center halo */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0, transparent 70%)',
        animation: 'auth-glow-pulse 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Card accent={a} glow>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
      </div>
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
