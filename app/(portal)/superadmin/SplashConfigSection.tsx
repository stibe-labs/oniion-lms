'use client';

import { useState } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Sparkles } from 'lucide-react';
import type { SplashConfig, SplashTemplate, SplashProgressStyle, SplashLoadingAnim } from '@/lib/splash-config';

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
  { id: 'buji', label: 'Buji Character', desc: 'Animated Buji thinking GIF' },
  { id: 'none', label: 'None',          desc: 'Logo only, no character' },
];

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initial: SplashConfig;
  logoFullUrl: string | null;
}

export default function SplashConfigSection({ initial, logoFullUrl }: Props) {
  const toast = useToast();
  const [cfg, setCfg]         = useState<SplashConfig>(initial);
  const [saving, setSaving]   = useState(false);
  const [newQuote, setNewQuote] = useState('');

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
          splash_template:      cfg.template,
          splash_progress_style: cfg.progressStyle,
          splash_loading_anim:  cfg.loadingAnim,
          splash_tagline:       cfg.tagline,
          splash_accent_color:  cfg.accentColor,
          splash_bg_color:      cfg.bgColor,
          splash_show_quotes:   cfg.showQuotes,
          splash_quotes:        cfg.quotes,
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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-0.5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          Splash Screen Design
        </h2>
        <p className="text-xs text-gray-500">Customize the first-load screen shown to users. Changes take effect on next fresh tab open.</p>
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
              className={`rounded-lg border-2 p-2 text-left transition-all ${cfg.template === t.id ? 'border-emerald-500 shadow-sm shadow-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <TemplateThumbnail id={t.id} accent={accent} bg={cfg.bgColor} />
              <p className={`mt-2 text-[11px] font-semibold ${cfg.template === t.id ? 'text-emerald-600' : 'text-gray-600'}`}>{t.label}</p>
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
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${cfg.progressStyle === p.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              style={{ color: cfg.progressStyle === p.id ? accent : undefined }}
            >
              <span style={{ color: cfg.progressStyle === p.id ? accent : '#9ca3af' }}>{p.preview}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading animation ── */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Loading Character</p>
        <div className="flex flex-wrap gap-3">
          {LOADING_ANIMS.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => set('loadingAnim', a.id)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all w-44 ${cfg.loadingAnim === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              {a.id === 'buji' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/buji/4 second thinking.gif" alt="" className="h-8 w-8 object-contain shrink-0" />
              )}
              {a.id === 'none' && <span className="h-8 w-8 shrink-0 flex items-center justify-center text-gray-300 text-xl">—</span>}
              <div>
                <p className={`text-xs font-semibold ${cfg.loadingAnim === a.id ? 'text-emerald-700' : 'text-gray-600'}`}>{a.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
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
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${cfg.showQuotes ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${cfg.showQuotes ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {cfg.showQuotes && (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-400">When enabled, a random quote from the list below replaces the tagline. One new random quote is picked each time the splash shows.</p>

            {/* Custom quotes list */}
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

            {/* Add quote */}
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

            {/* Preset quotes */}
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
      <div className="pt-2 border-t border-gray-100">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? 'Saving…' : 'Save Splash Config'}
        </Button>
        <p className="text-[10px] text-gray-400 mt-2">Clear sessionStorage in browser devtools to preview changes immediately.</p>
      </div>
    </div>
  );
}
