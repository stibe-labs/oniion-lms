'use client';

import { useState } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layout, Eye, EyeOff } from 'lucide-react';
import type { AuthConfig, AuthTemplate, AuthBgPattern } from '@/lib/auth-config';

// ── Template picker ────────────────────────────────────────────────────────────

const TEMPLATES: { id: AuthTemplate; label: string; desc: string }[] = [
  { id: 'classic',  label: 'Classic',  desc: 'Card on a soft patterned background' },
  { id: 'minimal',  label: 'Minimal',  desc: 'Borderless form on pure white' },
  { id: 'bold',     label: 'Bold',     desc: 'Gradient accent behind a white card' },
  { id: 'dark',     label: 'Dark',     desc: 'Deep dark bg with white card' },
  { id: 'split',    label: 'Split',    desc: 'Brand panel left, form right' },
  { id: 'branded',  label: 'Branded',  desc: 'Full accent bg with white card' },
];

function TemplateThumbnail({ id, accent, bg }: { id: AuthTemplate; accent: string; bg: string }) {
  const base: React.CSSProperties = { width: '100%', height: 56, borderRadius: 6, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const card = (extra?: React.CSSProperties) => (
    <div style={{ width: '40%', height: '70%', background: '#fff', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4, ...extra }}>
      <span style={{ width: '60%', height: 4, background: accent, borderRadius: 2, opacity: 0.9 }} />
      <span style={{ width: '80%', height: 2, background: '#e5e7eb', borderRadius: 1 }} />
      <span style={{ width: '80%', height: 2, background: '#e5e7eb', borderRadius: 1 }} />
    </div>
  );

  if (id === 'classic') return (
    <div style={{ ...base, background: bg || '#f0fdf4' }}>
      <span style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${accent}33 1px, transparent 1px)`, backgroundSize: '10px 10px' }} />
      {card()}
    </div>
  );
  if (id === 'minimal') return (
    <div style={{ ...base, background: '#fff' }}>
      {card({ boxShadow: 'none', border: 'none' })}
      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: accent, opacity: 0.8 }} />
    </div>
  );
  if (id === 'bold') return (
    <div style={{ ...base, background: `linear-gradient(150deg, ${accent} 0%, ${accent}99 40%, ${bg || '#f0fdf4'} 100%)` }}>
      {card()}
    </div>
  );
  if (id === 'dark') return (
    <div style={{ ...base, background: '#0f172a' }}>
      <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${accent}22 0, transparent 70%)` }} />
      {card()}
    </div>
  );
  if (id === 'split') return (
    <div style={{ ...base, background: '#fff', flexDirection: 'row', alignItems: 'stretch', gap: 0 }}>
      <div style={{ width: '40%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.8)' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {card({ boxShadow: 'none', width: '70%', height: '80%' })}
      </div>
    </div>
  );
  if (id === 'branded') return (
    <div style={{ ...base, background: accent }}>
      {card()}
    </div>
  );
  return null;
}

// ── Background pattern options ─────────────────────────────────────────────────

const BG_PATTERNS: { id: AuthBgPattern; label: string }[] = [
  { id: 'none',    label: 'None' },
  { id: 'dots',    label: 'Dots' },
  { id: 'grid',    label: 'Grid' },
  { id: 'circles', label: 'Circles' },
];

// ── Full-screen preview ────────────────────────────────────────────────────────

function patternStyle(pattern: string, color: string): React.CSSProperties {
  if (pattern === 'dots') return { backgroundImage: `radial-gradient(circle, ${color}33 1px, transparent 1px)`, backgroundSize: '20px 20px' };
  if (pattern === 'grid') return { backgroundImage: `linear-gradient(${color}1a 1px, transparent 1px), linear-gradient(90deg, ${color}1a 1px, transparent 1px)`, backgroundSize: '24px 24px' };
  if (pattern === 'circles') return { backgroundImage: `radial-gradient(ellipse at 25% 60%, ${color}22 0, transparent 50%), radial-gradient(ellipse at 75% 40%, ${color}22 0, transparent 50%)` };
  return {};
}

function AuthPreview({ cfg, logoUrl, logoHeight, onClose }: {
  cfg: AuthConfig; logoUrl: string | null; logoHeight: number; onClose: () => void;
}) {
  const a = cfg.accentColor;
  const logo = logoUrl ?? '/logo/full.png';

  function bg() {
    if (cfg.template === 'bold')    return `linear-gradient(150deg, ${a} 0%, ${a}bb 40%, ${cfg.bgColor} 100%)`;
    if (cfg.template === 'dark')    return '#0f172a';
    if (cfg.template === 'branded') return a;
    if (cfg.template === 'minimal') return '#ffffff';
    return cfg.bgColor;
  }

  // Card mock
  const card = (
    <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.15)', padding: '36px 32px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="Logo" style={{ height: logoHeight, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 24px' }} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>Welcome back</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Sign in to continue to your dashboard</div>
      </div>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, height: 48, marginBottom: 10 }} />
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, height: 48, marginBottom: 16 }} />
      <div style={{ height: 44, borderRadius: 10, background: `linear-gradient(135deg, ${a}, ${a}dd)` }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'auto' }}>
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <EyeOff style={{ width: 14, height: 14 }} /> Close Preview
      </button>

      {cfg.template === 'split' ? (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Left brand panel */}
          <div style={{ width: '42%', background: a, ...patternStyle(cfg.bgPattern, '#ffffff'), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', gap: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Logo" style={{ height: logoHeight * 1.8, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            {cfg.showTagline && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{cfg.headline}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>{cfg.subheadline}</div>
              </div>
            )}
          </div>
          {/* Right form panel */}
          <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            {card}
          </div>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', background: bg(), ...patternStyle(cfg.bgPattern, cfg.template === 'bold' || cfg.template === 'branded' ? '#ffffff' : a), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', position: 'relative' }}>
          {cfg.template === 'dark' && (
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${a}1e 0, transparent 70%)`, pointerEvents: 'none' }} />
          )}
          {cfg.template === 'minimal' && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${a}55, ${a})` }} />
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>{card}</div>
        </div>
      )}

      <p style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
        Preview — this is how your auth screen will look
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  initial: AuthConfig;
  logoFullUrl: string | null;
  logoAuthHeight: number;
}

export default function AuthConfigSection({ initial, logoFullUrl, logoAuthHeight }: Props) {
  const toast = useToast();
  const [cfg, setCfg]         = useState<AuthConfig>(initial);
  const [saving, setSaving]   = useState(false);
  const [previewing, setPreviewing] = useState(false);

  function set<K extends keyof AuthConfig>(key: K, val: AuthConfig[K]) {
    setCfg(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_template:     cfg.template,
          auth_accent_color: cfg.accentColor,
          auth_bg_color:     cfg.bgColor,
          auth_headline:     cfg.headline,
          auth_subheadline:  cfg.subheadline,
          auth_show_tagline: cfg.showTagline,
          auth_bg_pattern:   cfg.bgPattern,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error('Failed to save'); return; }
      toast.success('Auth screen updated');
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
        <AuthPreview cfg={cfg} logoUrl={logoFullUrl} logoHeight={logoAuthHeight} onClose={() => setPreviewing(false)} />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-0.5 flex items-center gap-2">
              <Layout className="h-4 w-4 text-emerald-500" />
              Auth Screen Design
            </h2>
            <p className="text-xs text-gray-500">Customize the login, forgot-password, and reset-password screens.</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

        {/* ── Colors ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Colors</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="color"
                value={cfg.accentColor}
                onChange={e => set('accentColor', e.target.value)}
                className="h-9 w-14 rounded cursor-pointer border border-gray-200 p-0.5"
              />
              <div>
                <p className="text-xs font-medium text-gray-700">Accent Color</p>
                <p className="text-[10px] text-gray-400">Buttons, input focus, labels</p>
                <p className="text-[10px] text-gray-400 font-mono">{cfg.accentColor}</p>
              </div>
            </label>
            {(cfg.template === 'classic' || cfg.template === 'minimal' || cfg.template === 'bold') && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="color"
                  value={cfg.bgColor}
                  onChange={e => set('bgColor', e.target.value)}
                  className="h-9 w-14 rounded cursor-pointer border border-gray-200 p-0.5"
                />
                <div>
                  <p className="text-xs font-medium text-gray-700">Background Color</p>
                  <p className="text-[10px] text-gray-400">Classic, Minimal & Bold templates</p>
                  <p className="text-[10px] text-gray-400 font-mono">{cfg.bgColor}</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* ── Background pattern ── */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Background Pattern</p>
          <p className="text-[10px] text-gray-400 mb-3">Applied to Classic, Bold, Branded, and the Split panel.</p>
          <div className="flex flex-wrap gap-2">
            {BG_PATTERNS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => set('bgPattern', p.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${cfg.bgPattern === p.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Brand text (Split template headline) ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Brand Text</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Shown in the Split template brand panel. Save for future use in other templates.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cfg.showTagline}
              onClick={() => set('showTagline', !cfg.showTagline)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${cfg.showTagline ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${cfg.showTagline ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {cfg.showTagline && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Headline</label>
                <Input
                  value={cfg.headline}
                  onChange={e => set('headline', e.target.value)}
                  placeholder="e.g. Empowering every learner"
                  className="text-sm"
                  maxLength={60}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Subheadline</label>
                <Input
                  value={cfg.subheadline}
                  onChange={e => set('subheadline', e.target.value)}
                  placeholder="e.g. Sign in to continue learning"
                  className="text-sm"
                  maxLength={100}
                />
              </div>
              {/* Live preview of brand panel */}
              {cfg.template === 'split' && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ height: 100, background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 24px' }}
                >
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{cfg.headline || 'Headline'}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>{cfg.subheadline || 'Subheadline'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Save ── */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving…' : 'Save Auth Config'}
          </Button>
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>
      </div>
    </>
  );
}
