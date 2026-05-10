'use client';

import { useState } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Sparkles, Eye, EyeOff } from 'lucide-react';
import type { SplashConfig, SplashTemplate, SplashProgressStyle, SplashLoadingAnim, SplashTaglineWeight } from '@/lib/splash-config';
import { TAGLINE_WEIGHT_MAP } from '@/lib/splash-config';

const PRESET_QUOTES = [
  'Education is the most powerful weapon you can use to change the world.',
  'Learning never exhausts the mind.',
  'The beautiful thing about learning is that nobody can take it away from you.',
  'Live as if you were to die tomorrow. Learn as if you were to live forever.',
  'An investment in knowledge pays the best interest.',
  'The more that you read, the more things you will know.',
  'Intelligence plus character — that is the goal of true education.',
  'Education is not the filling of a pail, but the lighting of a fire.',
  'The roots of education are bitter, but the fruit is sweet.',
  'Strive not to be a success, but rather to be of value.',
];

// ── Template thumbnails ───────────────────────────────────────────────────────

const TEMPLATES: { id: SplashTemplate; label: string; desc: string }[] = [
  { id: 'classic',  label: 'Classic',  desc: 'Logo + character + progress bar on white' },
  { id: 'minimal',  label: 'Minimal',  desc: 'Clean white, logo only, thin bottom bar' },
  { id: 'bold',     label: 'Bold',     desc: 'Large logo on gradient accent background' },
  { id: 'dark',     label: 'Dark',     desc: 'Dark slate background with glowing accents' },
  { id: 'branded',  label: 'Branded',  desc: 'Solid brand color fill, white logo & text' },
];

function TemplateThumbnail({ id, accent, bg }: { id: SplashTemplate; accent: string; bg: string }) {
  const base: React.CSSProperties = { width: '100%', height: 56, borderRadius: 6, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 5 };
  const dot = (c: string) => <span style={{ width: 18, height: 3, background: c, borderRadius: 2, opacity: 0.9 }} />;
  const circle = (c: string, s = 10) => <span style={{ width: s, height: s, borderRadius: '50%', background: c, opacity: 0.85 }} />;
  const bar = (c: string, w = '55%') => <span style={{ width: w, height: 2, background: c, borderRadius: 2 }} />;

  if (id === 'classic') return (
    <div style={{ ...base, background: bg || '#fafbfc' }}>
      {circle('#d1fae5', 12)}{dot(accent)}{bar(accent)}
    </div>
  );
  if (id === 'minimal') return (
    <div style={{ ...base, background: '#f8fafc' }}>
      {dot('#94a3b8')}{dot('#cbd5e1')}
      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: accent, opacity: 0.8 }} />
    </div>
  );
  if (id === 'bold') return (
    <div style={{ ...base, background: `linear-gradient(135deg, ${accent}cc, ${accent})` }}>
      {circle('rgba(255,255,255,0.9)', 16)}{dot('rgba(255,255,255,0.8)')}
    </div>
  );
  if (id === 'dark') return (
    <div style={{ ...base, background: '#0f172a' }}>
      <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, ${accent}22, transparent 70%)` }} />
      {circle(accent, 14)}{dot('#64748b')}
    </div>
  );
  if (id === 'branded') return (
    <div style={{ ...base, background: accent }}>
      {circle('rgba(255,255,255,0.9)', 16)}{dot('rgba(255,255,255,0.6)')}
    </div>
  );
  return null;
}

// ── Progress style options ────────────────────────────────────────────────────

const PROGRESS_STYLES: { id: SplashProgressStyle; label: string; preview: React.ReactNode }[] = [
  { id: 'bar',   label: 'Bar',   preview: <span style={{ width: 36, height: 3, background: 'currentColor', borderRadius: 2, display: 'block' }} /> },
  { id: 'dots',  label: 'Dots',  preview: <span style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i=><span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'block' }} />)}</span> },
  { id: 'ring',  label: 'Ring',  preview: <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid currentColor', display: 'block', borderTopColor: 'transparent' }} /> },
  { id: 'pulse', label: 'Pulse', preview: <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', display: 'block', opacity: 0.6 }} /> },
  { id: 'wave',  label: 'Wave',  preview: <span style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16 }}>{[6,14,10,14,6].map((h,i)=><span key={i} style={{ width: 3, height: h, background: 'currentColor', borderRadius: 2, display: 'block' }} />)}</span> },
  { id: 'none',  label: 'None',  preview: <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>—</span> },
];

const LOADING_ANIMS: { id: SplashLoadingAnim; label: string; desc: string }[] = [
  { id: 'character', label: 'Character',  desc: 'Your uploaded loading character/mascot' },
  { id: 'none',      label: 'None',       desc: 'Logo only, no character' },
];

// ── Inline splash preview ─────────────────────────────────────────────────────

function SplashPreview({ cfg, logoUrl, characterUrl, splashLogoHeight, onClose }: {
  cfg: SplashConfig;
  logoUrl: string | null;
  characterUrl: string | null;
  splashLogoHeight: number;
  onClose: () => void;
}) {
  const accent = cfg.accentColor;
  const bg = cfg.template === 'bold'
    ? `linear-gradient(135deg, ${accent}cc, ${accent}ff)`
    : cfg.template === 'dark'    ? '#0f172a'
    : cfg.template === 'branded' ? accent
    : cfg.template === 'minimal' ? '#f8fafc'
    : cfg.bgColor || '#fafbfc';

  const textColor = cfg.template === 'bold' || cfg.template === 'branded' ? '#fff'
    : cfg.template === 'dark' ? '#64748b'
    : accent;

  const logoSrc = logoUrl ?? '/logo/full.png';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: cfg.template === 'dark' || cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : '#374151', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <EyeOff style={{ width: 14, height: 14 }} /> Close Preview
      </button>

      {/* Character */}
      {cfg.loadingAnim === 'character' && characterUrl && (cfg.template === 'classic' || cfg.template === 'dark') && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={characterUrl} alt="" style={{ width: cfg.template === 'dark' ? 130 : 160, height: 'auto', objectFit: 'contain', opacity: cfg.template === 'dark' ? 0.9 : 1 }} />
      )}

      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt="Logo"
        style={{
          height: splashLogoHeight,
          width: 'auto',
          objectFit: 'contain',
          filter: (cfg.template === 'bold' || cfg.template === 'branded') ? 'brightness(0) invert(1)' : undefined,
        }}
      />

      {/* Tagline */}
      <p style={{ margin: 0, fontSize: cfg.taglineSize, fontWeight: TAGLINE_WEIGHT_MAP[cfg.taglineWeight], letterSpacing: cfg.taglineLetterSpacing, textTransform: 'uppercase', fontFamily: 'system-ui', color: textColor }}>
        {cfg.tagline || 'Crafting Future'}
      </p>

      {/* Progress indicator preview */}
      {cfg.progressStyle !== 'none' && (
        <div style={{ color: cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : accent }}>
          {cfg.progressStyle === 'bar' && (
            <div style={{ width: 180, height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 99 }}>
              <div style={{ height: '100%', borderRadius: 99, background: cfg.template === 'bold' || cfg.template === 'branded' ? 'rgba(255,255,255,0.9)' : accent, width: '65%' }} />
            </div>
          )}
          {cfg.progressStyle === 'dots' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : accent, display: 'inline-block' }} />)}
            </div>
          )}
          {cfg.progressStyle === 'ring' && (
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${cfg.template === 'bold' || cfg.template === 'branded' ? 'rgba(255,255,255,0.3)' : '#e5e7eb'}`, borderTopColor: cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : accent }} />
          )}
          {cfg.progressStyle === 'pulse' && (
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : accent}`, opacity: 0.6 }} />
          )}
          {cfg.progressStyle === 'wave' && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 28 }}>
              {[6,14,10,14,6].map((h,i) => <span key={i} style={{ width: 5, height: h, background: cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : accent, borderRadius: 3, display: 'inline-block' }} />)}
            </div>
          )}
        </div>
      )}

      {/* Minimal bottom bar */}
      {cfg.template === 'minimal' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#f3f4f6' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg,${accent}66,${accent})`, width: '65%' }} />
        </div>
      )}

      <p style={{ position: 'absolute', bottom: 16, fontSize: 11, opacity: 0.4, fontFamily: 'system-ui', color: cfg.template === 'dark' || cfg.template === 'bold' || cfg.template === 'branded' ? '#fff' : '#374151' }}>
        Preview — this is how your splash screen will look
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initial: SplashConfig;
  logoFullUrl: string | null;
  characterUrl: string | null;
  splashLogoHeight: number;
}

export default function SplashConfigSection({ initial, logoFullUrl, characterUrl, splashLogoHeight }: Props) {
  const toast = useToast();
  const [cfg, setCfg]           = useState<SplashConfig>(initial);
  const [saving, setSaving]     = useState(false);
  const [newQuote, setNewQuote] = useState('');
  const [previewing, setPreviewing] = useState(false);

  function set<K extends keyof SplashConfig>(key: K, val: SplashConfig[K]) {
    setCfg(prev => ({ ...prev, [key]: val }));
  }

  function addQuote(text: string) {
    const t = text.trim();
    if (!t || cfg.quotes.includes(t)) return;
    set('quotes', [...cfg.quotes, t]);
    setNewQuote('');
  }

  function removeQuote(i: number) {
    set('quotes', cfg.quotes.filter((_, idx) => idx !== i));
  }

  function addPreset(q: string) {
    if (!cfg.quotes.includes(q)) set('quotes', [...cfg.quotes, q]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splash_template:               cfg.template,
          splash_progress_style:         cfg.progressStyle,
          splash_loading_anim:           cfg.loadingAnim,
          splash_tagline:                cfg.tagline,
          splash_tagline_size:           cfg.taglineSize,
          splash_tagline_weight:         cfg.taglineWeight,
          splash_tagline_letter_spacing: cfg.taglineLetterSpacing,
          splash_accent_color:           cfg.accentColor,
          splash_bg_color:               cfg.bgColor,
          splash_text_color:             cfg.textColor,
          splash_show_quotes:            cfg.showQuotes,
          splash_quotes:                 cfg.quotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error('Failed to save'); return; }
      toast.success('Splash screen updated — refresh to preview');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  const accent = cfg.accentColor;

  return (
    <>
      {previewing && (
        <SplashPreview cfg={cfg} logoUrl={logoFullUrl} characterUrl={characterUrl} splashLogoHeight={splashLogoHeight} onClose={() => setPreviewing(false)} />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-0.5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Splash Screen Design
            </h2>
            <p className="text-xs text-gray-500">Customize the first-load screen shown to users. Changes take effect on next fresh tab open.</p>
          </div>
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>

        {/* ── Template picker ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Template</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => set('template', t.id)}
                className={`rounded-lg border-2 p-2 text-left transition-all ${cfg.template === t.id ? 'border-primary shadow-sm shadow-primary/10' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <TemplateThumbnail id={t.id} accent={accent} bg={cfg.bgColor} />
                <p className={`mt-2 text-[11px] font-semibold ${cfg.template === t.id ? 'text-primary' : 'text-gray-600'}`}>{t.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Progress style ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Progress Indicator</p>
          <div className="flex flex-wrap gap-2">
            {PROGRESS_STYLES.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => set('progressStyle', p.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${cfg.progressStyle === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                style={{ color: cfg.progressStyle === p.id ? accent : undefined }}
              >
                <span style={{ color: cfg.progressStyle === p.id ? accent : '#9ca3af' }}>{p.preview}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading character ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Loading Character</p>
          <div className="flex flex-wrap gap-3">
            {LOADING_ANIMS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => set('loadingAnim', a.id)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all w-52 ${cfg.loadingAnim === a.id ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-gray-300'}`}
              >
                {a.id === 'character' && characterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={characterUrl} alt="" className="h-10 w-10 object-contain shrink-0 rounded" />
                ) : a.id === 'character' ? (
                  <span className="h-10 w-10 shrink-0 flex items-center justify-center rounded border-2 border-dashed border-gray-200 text-gray-300 text-[10px] font-medium text-center leading-tight">No char.</span>
                ) : (
                  <span className="h-10 w-10 shrink-0 flex items-center justify-center text-gray-300 text-xl">—</span>
                )}
                <div>
                  <p className={`text-xs font-semibold ${cfg.loadingAnim === a.id ? 'text-primary' : 'text-gray-600'}`}>{a.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.desc}</p>
                  {a.id === 'character' && !characterUrl && (
                    <p className="text-[10px] text-amber-500 mt-0.5">Upload a character in Logos above</p>
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Only shown in Classic and Dark templates.</p>
        </div>

        {/* ── Colors ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Colors</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="color" value={cfg.accentColor} onChange={e => set('accentColor', e.target.value)} className="h-9 w-14 rounded cursor-pointer border border-gray-200 p-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-700">Accent Color</p>
                <p className="text-[10px] text-gray-400">Progress bars, glows, tagline</p>
                <p className="text-[10px] text-gray-400 font-mono">{cfg.accentColor}</p>
              </div>
            </label>
            {(cfg.template === 'classic' || cfg.template === 'minimal') && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="color" value={cfg.bgColor} onChange={e => set('bgColor', e.target.value)} className="h-9 w-14 rounded cursor-pointer border border-gray-200 p-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-700">Background Color</p>
                  <p className="text-[10px] text-gray-400">Classic & Minimal templates only</p>
                  <p className="text-[10px] text-gray-400 font-mono">{cfg.bgColor}</p>
                </div>
              </label>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="color"
                value={cfg.textColor || (cfg.template === 'bold' || cfg.template === 'branded' ? '#ffffff' : cfg.template === 'dark' ? '#64748b' : cfg.accentColor)}
                onChange={e => set('textColor', e.target.value)}
                className="h-9 w-14 rounded cursor-pointer border border-gray-200 p-0.5"
              />
              <div>
                <p className="text-xs font-medium text-gray-700">Tagline Text Color</p>
                <p className="text-[10px] text-gray-400">Overrides per-template default</p>
                <p className="text-[10px] text-gray-400 font-mono">{cfg.textColor || '(template default)'}</p>
              </div>
            </label>
          </div>
        </div>

        {/* ── Tagline ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Tagline</p>
          <Input
            value={cfg.tagline}
            onChange={e => set('tagline', e.target.value)}
            placeholder="e.g. Crafting Future"
            className="max-w-xs text-sm"
            maxLength={60}
          />
          <p className="text-[10px] text-gray-400 mt-1">Shown below the logo. Max 60 characters.</p>

          {/* Typography controls */}
          <div className="mt-4 space-y-4">
            {/* Size */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-600">Font Size</p>
                <span className="text-xs font-semibold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md">{cfg.taglineSize}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={32}
                value={cfg.taglineSize}
                onChange={e => set('taglineSize', parseInt(e.target.value, 10))}
                className="w-full max-w-xs h-1.5 rounded-full appearance-none bg-gray-200 [accent-color:var(--primary)] cursor-pointer"
              />
            </div>

            {/* Weight */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Font Weight</p>
              <div className="flex flex-wrap gap-2">
                {(['normal', 'medium', 'semibold', 'bold'] as SplashTaglineWeight[]).map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => set('taglineWeight', w)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all capitalize ${cfg.taglineWeight === w ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    style={{ fontWeight: TAGLINE_WEIGHT_MAP[w] }}
                  >
                    {w.charAt(0).toUpperCase() + w.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Letter spacing */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-600">Letter Spacing</p>
                <span className="text-xs font-semibold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md">{cfg.taglineLetterSpacing}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                value={cfg.taglineLetterSpacing}
                onChange={e => set('taglineLetterSpacing', parseInt(e.target.value, 10))}
                className="w-full max-w-xs h-1.5 rounded-full appearance-none bg-gray-200 [accent-color:var(--primary)] cursor-pointer"
              />
            </div>

            {/* Live preview */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-center">
              <p style={{ margin: 0, fontSize: cfg.taglineSize, fontWeight: TAGLINE_WEIGHT_MAP[cfg.taglineWeight], letterSpacing: cfg.taglineLetterSpacing, textTransform: 'uppercase', color: accent, fontFamily: 'system-ui' }}>
                {cfg.tagline || 'Crafting Future'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Rotating quotes ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Rotating Quotes</p>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.showQuotes}
              onClick={() => set('showQuotes', !cfg.showQuotes)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${cfg.showQuotes ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${cfg.showQuotes ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {cfg.showQuotes && (
            <div className="space-y-3">
              <p className="text-[10px] text-gray-400">When enabled, a random quote from the list below replaces the tagline. One new random quote is picked each time the splash shows.</p>

              {cfg.quotes.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {cfg.quotes.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                      <p className="flex-1 text-xs text-gray-600 leading-snug">{q}</p>
                      <button type="button" onClick={() => removeQuote(i)} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors mt-0.5">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={newQuote}
                  onChange={e => setNewQuote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuote(newQuote); } }}
                  placeholder="Type a quote and press Enter or +"
                  className="flex-1 text-xs"
                  maxLength={200}
                />
                <button type="button" onClick={() => addQuote(newQuote)} disabled={!newQuote.trim()} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <details className="group">
                <summary className="text-[11px] text-emerald-600 cursor-pointer hover:text-emerald-700 select-none font-medium list-none flex items-center gap-1">
                  <span className="group-open:hidden">+ Add from presets</span>
                  <span className="hidden group-open:inline">− Hide presets</span>
                </summary>
                <div className="mt-2 space-y-1">
                  {PRESET_QUOTES.filter(q => !cfg.quotes.includes(q)).map((q, i) => (
                    <button key={i} type="button" onClick={() => addPreset(q)} className="w-full text-left text-[11px] text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded px-2 py-1 transition-colors leading-snug">
                      + {q}
                    </button>
                  ))}
                  {PRESET_QUOTES.every(q => cfg.quotes.includes(q)) && (
                    <p className="text-[10px] text-gray-400 px-2">All presets already added.</p>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* ── Save ── */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving…' : 'Save Splash Config'}
          </Button>
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <p className="text-[10px] text-gray-400 w-full sm:w-auto">Clear sessionStorage in browser devtools to preview changes immediately after saving.</p>
        </div>
      </div>
    </>
  );
}
