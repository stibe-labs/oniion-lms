'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { SplashConfig } from '@/lib/splash-config';
import { TAGLINE_WEIGHT_MAP } from '@/lib/splash-config';

const SPLASH_DURATION = 3500;
const FADE_DURATION   = 500;

const DASHBOARD_PREFIXES = [
  '/owner', '/teacher', '/student', '/parent', '/hr',
  '/academic-operator', '/batch-coordinator', '/ghost', '/superadmin', '/sales',
];
function isDashboardRoute(path: string) {
  return DASHBOARD_PREFIXES.some(p => path.startsWith(p));
}

// ─── Progress indicators ─────────────────────────────────────────────────────

function ProgressBar({ progress, accent }: { progress: number; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 180, height: 4, background: '#e8ecf0', borderRadius: 99, position: 'relative', overflow: 'visible' }}>
        <div style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${accent}99, ${accent})`, width: `${progress}%`, transition: 'width 80ms linear' }} />
        <div style={{ position: 'absolute', top: '50%', left: `${progress}%`, width: 8, height: 8, borderRadius: '50%', background: accent, transform: 'translate(-50%,-50%)', boxShadow: `0 0 10px ${accent}99`, transition: 'left 80ms linear', pointerEvents: 'none' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#9ca3af', minWidth: 28, fontFamily: 'system-ui' }}>{Math.round(progress)}%</span>
    </div>
  );
}

function ProgressDots({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: accent, display: 'inline-block', animation: `splashDot 0.7s ${i * 0.16}s ease-in-out infinite alternate` }} />
        ))}
      </div>
      <style>{`@keyframes splashDot{from{transform:translateY(0);opacity:.35}to{transform:translateY(-10px);opacity:1}}`}</style>
    </>
  );
}

function ProgressRing({ accent }: { accent: string }) {
  return (
    <>
      <svg width="40" height="40" style={{ animation: 'splashSpin 0.9s linear infinite' }}>
        <circle cx="20" cy="20" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle cx="20" cy="20" r="15" fill="none" stroke={accent} strokeWidth="3" strokeDasharray="55 40" strokeLinecap="round" />
      </svg>
      <style>{`@keyframes splashSpin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function ProgressPulse({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ position: 'relative', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1].map(i => (
          <span key={i} style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: `2px solid ${accent}`, animation: `splashPulse 1.4s ${i * 0.5}s ease-out infinite` }} />
        ))}
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, zIndex: 1 }} />
      </div>
      <style>{`@keyframes splashPulse{0%{transform:scale(.15);opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
    </>
  );
}

function ProgressWave({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 28 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} style={{ width: 5, background: accent, borderRadius: 3, animation: `splashWave 0.8s ${i * 0.12}s ease-in-out infinite alternate`, display: 'inline-block' }} />
        ))}
      </div>
      <style>{`@keyframes splashWave{from{height:6px;opacity:.4}to{height:24px;opacity:1}}`}</style>
    </>
  );
}

function ProgressIndicator({ style, progress, accent }: { style: string; progress: number; accent: string }) {
  if (style === 'bar')   return <ProgressBar progress={progress} accent={accent} />;
  if (style === 'dots')  return <ProgressDots accent={accent} />;
  if (style === 'ring')  return <ProgressRing accent={accent} />;
  if (style === 'pulse') return <ProgressPulse accent={accent} />;
  if (style === 'wave')  return <ProgressWave accent={accent} />;
  return null;
}

// ─── Letter tagline animation ─────────────────────────────────────────────────

function AnimatedTagline({ text, color = '#6b7280', fontSize = 13, fontWeight = 600, letterSpacing = 4 }: { text: string; color?: string; fontSize?: number; fontWeight?: number; letterSpacing?: number }) {
  return (
    <>
      <p style={{ margin: 0, fontSize, fontWeight, letterSpacing, textTransform: 'uppercase', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', fontFamily: 'system-ui', gap: 0 }}>
        {text.split('').map((ch, i) => (
          <span key={i} style={{ display: 'inline-block', opacity: 0, transform: 'translateY(8px)', animation: `splashLetter 0.4s ${i * 0.05}s cubic-bezier(.22,1,.36,1) forwards`, color }}>
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
      </p>
      <style>{`@keyframes splashLetter{to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  );
}

// ─── Templates ───────────────────────────────────────────────────────────────

type TemplateProps = {
  cfg: SplashConfig;
  progress: number;
  logoUrl: string;
  logoHeight: number;
  displayText: string;
  characterUrl: string | null;
};

/** Classic — white bg, character, logo, tagline, progress */
function ClassicTemplate({ cfg, progress, logoUrl, logoHeight, displayText, characterUrl }: TemplateProps) {
  const accent = cfg.accentColor;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {cfg.loadingAnim === 'character' && characterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={characterUrl} alt="" style={{ width: 160, height: 'auto', objectFit: 'contain', pointerEvents: 'none' }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="Logo" style={{ height: logoHeight, width: 'auto', objectFit: 'contain', pointerEvents: 'none' }} />
      <AnimatedTagline text={displayText} color={accent} fontSize={cfg.taglineSize} fontWeight={TAGLINE_WEIGHT_MAP[cfg.taglineWeight]} letterSpacing={cfg.taglineLetterSpacing} />
      <div style={{ marginTop: 2 }}>
        <ProgressIndicator style={cfg.progressStyle} progress={progress} accent={accent} />
      </div>
    </div>
  );
}

/** Minimal — off-white, no character, logo + thin bar at bottom */
function MinimalTemplate({ cfg, progress, logoUrl, logoHeight, displayText }: TemplateProps) {
  const accent = cfg.accentColor;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo" style={{ height: logoHeight * 1.4, width: 'auto', objectFit: 'contain', animation: 'splashFadeUp 0.6s ease-out forwards' }} />
        <p style={{ margin: 0, fontSize: cfg.taglineSize, fontWeight: TAGLINE_WEIGHT_MAP[cfg.taglineWeight], color: '#9ca3af', letterSpacing: cfg.taglineLetterSpacing, textTransform: 'uppercase', fontFamily: 'system-ui', animation: 'splashFadeUp 0.6s 0.2s ease-out both' }}>{displayText}</p>
      </div>
      {/* thin bar pinned to bottom */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 3, background: '#f3f4f6' }}>
        <div style={{ height: '100%', background: `linear-gradient(90deg,${accent}66,${accent})`, width: `${progress}%`, transition: 'width 80ms linear' }} />
      </div>
      <style>{`@keyframes splashFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  );
}

/** Bold — large logo, gradient accent background */
function BoldTemplate({ cfg, progress, logoUrl, logoHeight, displayText }: TemplateProps) {
  const accent = cfg.accentColor;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -20, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', filter: 'blur(24px)' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo" style={{ height: logoHeight * 1.6, width: 'auto', objectFit: 'contain', position: 'relative', filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.2))', animation: 'splashScale 0.5s cubic-bezier(.22,1,.36,1) forwards' }} />
      </div>
      <p style={{ margin: 0, fontSize: cfg.taglineSize, fontWeight: TAGLINE_WEIGHT_MAP[cfg.taglineWeight], color: '#fff', letterSpacing: cfg.taglineLetterSpacing, textTransform: 'uppercase', fontFamily: 'system-ui', textShadow: '0 2px 8px rgba(0,0,0,0.2)', animation: 'splashFadeUp 0.5s 0.3s ease-out both' }}>{displayText}</p>
      <div style={{ marginTop: 8, animation: 'splashFadeUp 0.5s 0.5s ease-out both' }}>
        <ProgressIndicator style={cfg.progressStyle} progress={progress} accent="#ffffff" />
      </div>
      <style>{`@keyframes splashScale{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}@keyframes splashFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/** Dark — dark #0f172a background, glowing accent elements */
function DarkTemplate({ cfg, progress, logoUrl, logoHeight, displayText, characterUrl }: TemplateProps) {
  const accent = cfg.accentColor;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {cfg.loadingAnim === 'character' && characterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={characterUrl} alt="" style={{ width: 130, height: 'auto', objectFit: 'contain', opacity: 0.9 }} />
      )}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -16, background: accent, opacity: 0.15, borderRadius: '50%', filter: 'blur(20px)', animation: 'splashPulseGlow 2s ease-in-out infinite alternate' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo" style={{ height: logoHeight, width: 'auto', objectFit: 'contain', position: 'relative', filter: `drop-shadow(0 0 12px ${accent}66)` }} />
      </div>
      <p style={{ margin: 0, fontSize: cfg.taglineSize, fontWeight: TAGLINE_WEIGHT_MAP[cfg.taglineWeight], color: '#64748b', letterSpacing: cfg.taglineLetterSpacing, textTransform: 'uppercase', fontFamily: 'system-ui' }}>{displayText}</p>
      <ProgressIndicator style={cfg.progressStyle} progress={progress} accent={accent} />
      <style>{`@keyframes splashPulseGlow{from{opacity:.1;transform:scale(.9)}to{opacity:.25;transform:scale(1.1)}}`}</style>
    </div>
  );
}

/** Branded — solid brand color background, white everything */
function BrandedTemplate({ cfg, progress, logoUrl, logoHeight, displayText }: TemplateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="Logo" style={{ height: logoHeight * 1.5, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', animation: 'splashFadeUp 0.5s ease-out forwards' }} />
      <p style={{ margin: 0, fontSize: cfg.taglineSize, fontWeight: TAGLINE_WEIGHT_MAP[cfg.taglineWeight], color: 'rgba(255,255,255,0.7)', letterSpacing: cfg.taglineLetterSpacing, textTransform: 'uppercase', fontFamily: 'system-ui' }}>{displayText}</p>
      <ProgressIndicator style={cfg.progressStyle} progress={progress} accent="rgba(255,255,255,0.9)" />
      <style>{`@keyframes splashFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function SplashTemplate(props: TemplateProps) {
  switch (props.cfg.template) {
    case 'minimal':  return <MinimalTemplate  {...props} />;
    case 'bold':     return <BoldTemplate     {...props} />;
    case 'dark':     return <DarkTemplate     {...props} />;
    case 'branded':  return <BrandedTemplate  {...props} />;
    default:         return <ClassicTemplate  {...props} />;
  }
}

// ─── Background per template ─────────────────────────────────────────────────

function getBackground(cfg: SplashConfig): string {
  switch (cfg.template) {
    case 'bold':    return `linear-gradient(135deg, ${cfg.accentColor}cc, ${cfg.accentColor}ff)`;
    case 'dark':    return '#0f172a';
    case 'branded': return cfg.accentColor;
    case 'minimal': return '#f8fafc';
    default:        return cfg.bgColor || '#fafbfc';
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase]         = useState<'init' | 'splash' | 'fading' | 'done'>('init');
  const [progress, setProgress]   = useState(0);
  const progressRef               = useRef<ReturnType<typeof setInterval>>(null);
  const [logoUrl, setLogoUrl]     = useState('/logo/full.png');
  const [logoHeight, setLogoHeight] = useState(36);
  const [characterUrl, setCharacterUrl] = useState<string | null>(null);
  const [cfg, setCfg]             = useState<SplashConfig>({
    template: 'classic', progressStyle: 'bar', loadingAnim: 'character',
    tagline: 'Crafting Future', taglineSize: 13, taglineWeight: 'semibold', taglineLetterSpacing: 4,
    accentColor: '#10b981', bgColor: '#fafbfc',
    showQuotes: false, quotes: [],
  });
  const [displayText, setDisplayText] = useState('Crafting Future');

  // Fetch platform + splash config
  useEffect(() => {
    fetch('/api/v1/platform/config')
      .then(r => r.json())
      .then(d => {
        if (d.logo_full_url)           setLogoUrl(d.logo_full_url);
        if (d.logo_splash_height)      setLogoHeight(d.logo_splash_height);
        if (d.loading_character_url)   setCharacterUrl(d.loading_character_url);
        const splashCfg: SplashConfig = {
          template:             d.splash_template      ?? 'classic',
          progressStyle:        d.splash_progress_style ?? 'bar',
          loadingAnim:          (d.splash_loading_anim === 'buji' ? 'character' : (d.splash_loading_anim ?? 'character')),
          tagline:              d.splash_tagline        ?? 'Crafting Future',
          taglineSize:          d.splash_tagline_size  ?? 13,
          taglineWeight:        d.splash_tagline_weight ?? 'semibold',
          taglineLetterSpacing: d.splash_tagline_letter_spacing ?? 4,
          accentColor:          d.splash_accent_color  ?? '#10b981',
          bgColor:              d.splash_bg_color       ?? '#fafbfc',
          showQuotes:           d.splash_show_quotes    ?? false,
          quotes:               d.splash_quotes         ?? [],
        };
        setCfg(splashCfg);
        if (splashCfg.showQuotes && splashCfg.quotes.length > 0) {
          setDisplayText(splashCfg.quotes[Math.floor(Math.random() * splashCfg.quotes.length)]);
        } else {
          setDisplayText(splashCfg.tagline);
        }
      })
      .catch(() => {});
  }, []);

  // Splash phase logic
  useEffect(() => {
    if (isDashboardRoute(pathname)) { setPhase('done'); return; }
    if (sessionStorage.getItem('splash_shown')) { setPhase('done'); return; }
    sessionStorage.setItem('splash_shown', '1');

    setPhase('splash');
    const step = 50;
    const increment = (step / SPLASH_DURATION) * 100;
    progressRef.current = setInterval(() => {
      setProgress(p => { const n = p + increment; return n >= 100 ? 100 : n; });
    }, step);
    const splashTimer = setTimeout(() => {
      setPhase('fading');
      setProgress(100);
      if (progressRef.current) clearInterval(progressRef.current);
    }, SPLASH_DURATION);
    return () => { clearTimeout(splashTimer); if (progressRef.current) clearInterval(progressRef.current); };
  }, []);

  useEffect(() => {
    if (phase !== 'fading') return;
    const t = setTimeout(() => setPhase('done'), FADE_DURATION);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return <>{children}</>;
  if (phase === 'init') return null;

  const bg = getBackground(cfg);

  return (
    <>
      <div style={{ visibility: 'hidden', position: 'fixed', inset: 0, zIndex: 0 }}>{children}</div>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg, overflow: 'hidden',
        transition: `opacity ${FADE_DURATION}ms cubic-bezier(.4,0,0,1)`,
        opacity: phase === 'fading' ? 0 : 1,
      }}>
        <SplashTemplate cfg={cfg} progress={progress} logoUrl={logoUrl} logoHeight={logoHeight} displayText={displayText} characterUrl={characterUrl} />
      </div>
    </>
  );
}
