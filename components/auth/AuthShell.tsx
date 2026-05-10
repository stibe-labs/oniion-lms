'use client';

import { useState, useEffect } from 'react';
import { usePlatformContext, useAuthConfig } from '@/components/providers/PlatformProvider';
import type { AuthConfig } from '@/lib/auth-config';

// ── Educational quotes ─────────────────────────────────────────────────────────

const QUOTES = [
  { text: 'The beautiful thing about learning is that no one can take it away from you.', author: 'B.B. King' },
  { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', author: 'Mahatma Gandhi' },
  { text: 'The mind is not a vessel to be filled, but a fire to be kindled.', author: 'Plutarch' },
  { text: 'Education is not the filling of a pail, but the lighting of a fire.', author: 'W.B. Yeats' },
  { text: 'Curiosity is the engine of achievement.', author: 'Sir Ken Robinson' },
  { text: 'The roots of education are bitter, but the fruit is sweet.', author: 'Aristotle' },
  { text: 'Knowledge is power. Information is liberating.', author: 'Kofi Annan' },
  { text: 'Tell me and I forget. Teach me and I remember. Involve me and I learn.', author: 'Benjamin Franklin' },
  { text: 'Every expert was once a beginner. Every master was once a student.', author: '' },
  { text: 'Education breeds confidence. Confidence breeds hope. Hope breeds peace.', author: 'Confucius' },
];

// ── Deterministic values (SSR-safe — no Math.random) ──────────────────────────

function sr(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  x:        sr(i * 1.3)  * 100,
  y:        sr(i * 2.7)  * 100,
  size:     1.5 + sr(i * 3.9) * 3.5,
  delay:    sr(i * 4.3)  * 16,
  duration: 9  + sr(i * 5.1) * 12,
  opacity:  0.04 + sr(i * 6.9) * 0.11,
}));

const EDU_CHARS = ['π', '∑', '√', '∞', 'Δ', '∫', 'α', 'β', '≈', '∂', 'λ', 'Ω', 'μ', 'θ', 'σ', 'φ'];
const EDU_SYMBOLS = Array.from({ length: 12 }, (_, i) => ({
  x:        3  + sr(i * 7.1)  * 94,
  y:        3  + sr(i * 8.3)  * 92,
  size:     13 + sr(i * 9.1)  * 18,
  delay:    sr(i * 10.7) * 12,
  duration: 10 + sr(i * 11.3) * 9,
  opacity:  0.04 + sr(i * 12.1) * 0.08,
  rotate:   sr(i * 13.7) * 50 - 25,
  char:     EDU_CHARS[i % EDU_CHARS.length],
}));

// ── CSS keyframes ──────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes ap {
  0%   { opacity: 0; transform: translateY(0) scale(1); }
  12%  { opacity: 1; }
  88%  { opacity: 0.65; }
  100% { opacity: 0; transform: translateY(-90px) scale(0.12); }
}
@keyframes ae {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-13px); }
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(22px) scale(0.977); filter: blur(2px); }
  to   { opacity: 1; transform: translateY(0)   scale(1);     filter: blur(0); }
}
@keyframes glow {
  0%, 100% { opacity: 0.18; transform: scale(0.88) translate(0%,  0%); }
  33%       { opacity: 0.42; transform: scale(1.07) translate(3%, -2%); }
  66%       { opacity: 0.26; transform: scale(0.95) translate(-2%, 3%); }
}
@keyframes bar-in {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes mesh-a {
  0%, 100% { transform: translate(0%,  0%)  scale(1);    }
  40%       { transform: translate(4%, -3%) scale(1.09); }
  70%       { transform: translate(-3%, 4%) scale(0.94); }
}
@keyframes mesh-b {
  0%, 100% { transform: translate(0%,   0%) scale(1);    }
  40%       { transform: translate(-5%, 3%) scale(1.07); }
  70%       { transform: translate(3%, -2%) scale(0.96); }
}
`;

// ── Quote cycler — smooth crossfade ───────────────────────────────────────────

function QuoteCycler({ textColor, authorColor, label }: { textColor: string; authorColor: string; label?: string }) {
  const [idx,  setIdx]  = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    const iid = setInterval(() => {
      setShow(false);
      tid = setTimeout(() => { setIdx(i => (i + 1) % QUOTES.length); setShow(true); }, 420);
    }, 6500);
    return () => { clearInterval(iid); clearTimeout(tid); };
  }, []);

  const q = QUOTES[idx];
  return (
    <div>
      {label && (
        <div style={{
          fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase',
          fontWeight: 700, color: authorColor, opacity: 0.55, marginBottom: 10,
        }}>
          {label}
        </div>
      )}
      <div style={{
        transition: 'opacity 0.42s ease, transform 0.42s ease',
        opacity:   show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(8px)',
        minHeight: 68,
      }}>
        <p style={{
          margin: '0 0 8px', fontSize: 13, lineHeight: 1.85,
          color: textColor, fontStyle: 'italic', fontWeight: 400,
        }}>
          &ldquo;{q.text}&rdquo;
        </p>
        {q.author && (
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: authorColor }}>
            — {q.author}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Particle field ─────────────────────────────────────────────────────────────

function ParticleField({ color, count = 32 }: { color: string; count?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {PARTICLES.slice(0, count).map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size, borderRadius: '50%',
          background: color, opacity: p.opacity,
          animation: `ap ${p.duration}s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Edu symbol field — outer div handles rotation, inner div handles float ─────

function EduField({ color, count = 12 }: { color: string; count?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {EDU_SYMBOLS.slice(0, count).map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, transform: `rotate(${s.rotate}deg)` }}>
          <div style={{
            fontSize: s.size, color, opacity: s.opacity,
            fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 300, userSelect: 'none',
            animation: `ae ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}>
            {s.char}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Logo ───────────────────────────────────────────────────────────────────────

function AuthLogo({ url, height, invert = false }: { url: string; height: number; invert?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Logo" style={{ height, width: 'auto', objectFit: 'contain', filter: invert ? 'brightness(0) invert(1)' : undefined }} />
    </div>
  );
}

// ── Glassmorphic card ──────────────────────────────────────────────────────────

function Card({ children, accent, glass = false }: { children: React.ReactNode; accent: string; glass?: boolean }) {
  return (
    <div style={{
      width: '100%', maxWidth: 430,
      background:           glass ? 'rgba(255,255,255,0.93)' : '#ffffff',
      backdropFilter:       glass ? 'blur(28px) saturate(180%)' : undefined,
      WebkitBackdropFilter: glass ? 'blur(28px) saturate(180%)' : undefined,
      borderRadius: 22,
      border:    glass ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(0,0,0,0.05)',
      boxShadow: glass
        ? `0 0 0 1px ${accent}10, 0 28px 80px rgba(0,0,0,0.22), 0 10px 28px rgba(0,0,0,0.12)`
        : `0 24px 72px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05)`,
      padding: '44px 40px',
      animation: 'card-in 0.7s cubic-bezier(0.22,1,0.36,1) both',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Accent top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
        animation: 'bar-in 0.8s 0.3s cubic-bezier(0.22,1,0.36,1) both',
        transformOrigin: 'left',
      }} />
      {children}
    </div>
  );
}

// ── Animated mesh background ───────────────────────────────────────────────────

function MeshBg({ base, c1, c2 }: { base: string; c1: string; c2: string }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: base }} />
      <div style={{ position: 'absolute', top: '-18%', left: '-12%', width: '62%', height: '62%', borderRadius: '50%', background: c1, filter: 'blur(90px)', animation: 'mesh-a 22s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-18%', right: '-12%', width: '58%', height: '58%', borderRadius: '50%', background: c2, filter: 'blur(80px)', animation: 'mesh-b 26s ease-in-out infinite', pointerEvents: 'none' }} />
    </>
  );
}

// ── Template shells ────────────────────────────────────────────────────────────

type P = { children: React.ReactNode; cfg: AuthConfig; logoUrl: string; logoHeight: number; platformName: string };

// CLASSIC — animated mesh + glassmorphic card + quote below
function ClassicShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a  = cfg.accentColor;
  const bg = cfg.bgColor || '#f0fdf4';
  return (
    <div style={{ minHeight: '100dvh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px' }}>
      <style>{KEYFRAMES}</style>
      <MeshBg base={bg} c1={`${a}1e`} c2={`${a}12`} />
      <ParticleField color={a} count={22} />
      <EduField color={a} count={9} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <Card accent={a} glass>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
        <div style={{ width: '100%', maxWidth: 390, padding: '0 4px' }}>
          <QuoteCycler textColor="rgba(0,0,0,0.45)" authorColor={a} label="THOUGHT OF THE DAY" />
        </div>
      </div>
    </div>
  );
}

// MINIMAL — clean white + soft particles + quote with accent separator
function MinimalShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px' }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color={a} count={12} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 430 }}>
        <AuthLogo url={logoUrl} height={logoHeight} />
        <div style={{ animation: 'card-in 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
          {children}
        </div>
        <div style={{ marginTop: 32, paddingTop: 22, borderTop: `1.5px solid ${a}22` }}>
          <QuoteCycler textColor="rgba(0,0,0,0.4)" authorColor={a} label="DAILY WISDOM" />
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${a}, transparent)`, animation: 'bar-in 1.1s ease both', transformOrigin: 'left' }} />
    </div>
  );
}

// BOLD — vivid gradient + white particles + glassmorphic card + light quote
function BoldShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a  = cfg.accentColor;
  const bg = cfg.bgColor || '#064e3b';
  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(148deg, ${a} 0%, ${a}cc 42%, ${bg} 100%)`,
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px',
    }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color="rgba(255,255,255,0.5)" count={26} />
      <EduField color="rgba(255,255,255,0.28)" count={9} />
      <div style={{ position: 'absolute', top: '-14%', right: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', filter: 'blur(72px)', animation: 'glow 6s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-12%', left: '-8%', width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(60px)', animation: 'glow 8s 2.5s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <Card accent={a} glass>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
        <div style={{ width: '100%', maxWidth: 390, textAlign: 'center', padding: '0 4px' }}>
          <QuoteCycler textColor="rgba(255,255,255,0.72)" authorColor="rgba(255,255,255,0.95)" label="DAILY WISDOM" />
        </div>
      </div>
    </div>
  );
}

// DARK — deep space constellation + star particles + glowing card + accent quote
function DarkShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{
      minHeight: '100dvh',
      background: `radial-gradient(ellipse at 22% 18%, ${a}1c 0, transparent 52%),
                   radial-gradient(ellipse at 80% 80%, ${a}12 0, transparent 48%),
                   #060c16`,
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px',
    }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color={a} count={18} />
      <ParticleField color="rgba(255,255,255,0.82)" count={18} />
      <EduField color={a} count={9} />
      <div style={{ position: 'absolute', top: '48%', left: '50%', transform: 'translate(-50%,-50%)', width: 580, height: 400, borderRadius: '50%', background: `radial-gradient(ellipse, ${a}12 0, transparent 68%)`, animation: 'glow 7s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <Card accent={a} glass>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
        <div style={{ width: '100%', maxWidth: 390, padding: '0 4px' }}>
          <QuoteCycler textColor="rgba(255,255,255,0.5)" authorColor={a} label="DAILY WISDOM" />
        </div>
      </div>
    </div>
  );
}

// SPLIT — brand panel (tagline + glassmorphic quote card) / form panel
function SplitShell({ children, cfg, logoUrl, logoHeight, platformName }: P) {
  const a = cfg.accentColor;
  return (
    <div className="flex min-h-dvh">
      <style>{KEYFRAMES}</style>

      {/* Left brand panel — desktop only */}
      <div
        className="hidden md:flex flex-col justify-between shrink-0 p-12"
        style={{
          width: '46%',
          background: `linear-gradient(158deg, ${a} 0%, ${a}cc 55%, ${a}99 100%)`,
          position: 'relative', overflow: 'hidden',
        }}
      >
        <ParticleField color="rgba(255,255,255,0.6)" />
        <EduField color="rgba(255,255,255,0.38)" />
        <div style={{ position: 'absolute', bottom: -100, right: -100, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Logo" style={{ height: logoHeight * 1.9, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', maxWidth: 240 }} />

          {cfg.showTagline && (
            <div style={{ maxWidth: 300 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.22, letterSpacing: -0.4 }}>
                {cfg.headline}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
                {cfg.subheadline}
              </p>
            </div>
          )}

          {/* Glassmorphic quote card */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 16, padding: '20px 22px', maxWidth: 300,
          }}>
            <QuoteCycler
              textColor="rgba(255,255,255,0.8)"
              authorColor="rgba(255,255,255,0.95)"
              label="DAILY INSPIRATION"
            />
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 1, fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 12 }}>
          {platformName}
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-8 md:p-12" style={{ position: 'relative', overflow: 'hidden' }}>
        <ParticleField color={a} count={8} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
          <div className="md:hidden" style={{ marginBottom: 28 }}>
            <AuthLogo url={logoUrl} height={logoHeight} />
          </div>
          <div style={{ animation: 'card-in 0.55s cubic-bezier(0.22,1,0.36,1) both' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// BRANDED — full accent bg + center halo + glassmorphic card + white quote
function BrandedShell({ children, cfg, logoUrl, logoHeight }: P) {
  const a = cfg.accentColor;
  return (
    <div style={{ minHeight: '100dvh', background: a, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px' }}>
      <style>{KEYFRAMES}</style>
      <ParticleField color="rgba(255,255,255,0.62)" />
      <EduField color="rgba(255,255,255,0.32)" count={9} />
      <div style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%,-50%)', width: 540, height: 540, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0, transparent 68%)', animation: 'glow 5.5s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <Card accent={a} glass>
          <AuthLogo url={logoUrl} height={logoHeight} />
          {children}
        </Card>
        <div style={{ width: '100%', maxWidth: 390, textAlign: 'center', padding: '0 4px' }}>
          <QuoteCycler textColor="rgba(255,255,255,0.68)" authorColor="rgba(255,255,255,0.95)" label="DAILY WISDOM" />
        </div>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { logoFullUrl, logoAuthHeight, platformName } = usePlatformContext();
  const cfg     = useAuthConfig();
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
