'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { THEME_DEFAULTS } from '@/lib/theme-config';

interface Props {
  initialPrimary: string;
  initialSecondary: string;
  initialTextColor: string;
  initialMutedColor: string;
}

const PRESET_PALETTES = [
  { label: 'Green (Default)', primary: '#22c55e', secondary: '#14b8a6' },
  { label: 'Blue',            primary: '#3b82f6', secondary: '#06b6d4' },
  { label: 'Purple',          primary: '#8b5cf6', secondary: '#ec4899' },
  { label: 'Orange',          primary: '#f97316', secondary: '#eab308' },
  { label: 'Rose',            primary: '#f43f5e', secondary: '#8b5cf6' },
  { label: 'Indigo',          primary: '#6366f1', secondary: '#0ea5e9' },
];

export default function ThemeConfigSection({ initialPrimary, initialSecondary, initialTextColor, initialMutedColor }: Props) {
  const toast = useToast();
  const [primary,   setPrimary]   = useState(initialPrimary   || THEME_DEFAULTS.primaryColor);
  const [secondary, setSecondary] = useState(initialSecondary || THEME_DEFAULTS.secondaryColor);
  const [textColor,  setTextColor]  = useState(initialTextColor  || '');
  const [mutedColor, setMutedColor] = useState(initialMutedColor || '');
  const [saving, setSaving] = useState(false);
  const liveRef = useRef({ primary, secondary });

  function applyLive(p: string, s: string, tc?: string, mc?: string) {
    const root = document.documentElement;
    root.style.setProperty('--primary',   p);
    root.style.setProperty('--ring',      p);
    root.style.setProperty('--brand-green', p);
    root.style.setProperty('--sidebar-primary', p);
    root.style.setProperty('--sidebar-ring', p);
    root.style.setProperty('--live',      p);
    root.style.setProperty('--chart-1',   p);
    root.style.setProperty('--secondary', s);
    root.style.setProperty('--brand-teal', s);
    root.style.setProperty('--chart-2',   s);
    if (tc !== undefined) {
      if (tc) root.style.setProperty('--foreground', tc);
      else root.style.removeProperty('--foreground');
    }
    if (mc !== undefined) {
      if (mc) root.style.setProperty('--muted-foreground', mc);
      else root.style.removeProperty('--muted-foreground');
    }
    liveRef.current = { primary: p, secondary: s };
  }

  function handlePrimary(color: string) {
    setPrimary(color);
    applyLive(color, secondary, textColor, mutedColor);
  }

  function handleSecondary(color: string) {
    setSecondary(color);
    applyLive(primary, color, textColor, mutedColor);
  }

  function handleTextColor(color: string) {
    setTextColor(color);
    applyLive(primary, secondary, color, mutedColor);
  }

  function handleMutedColor(color: string) {
    setMutedColor(color);
    applyLive(primary, secondary, textColor, color);
  }

  function applyPreset(p: string, s: string) {
    setPrimary(p);
    setSecondary(s);
    applyLive(p, s, textColor, mutedColor);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme_primary:    primary,
          theme_secondary:  secondary,
          theme_text_color: textColor,
          theme_muted_color: mutedColor,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Failed to save'); return; }
      toast.success('Theme saved — reload to apply server-rendered changes');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  // Reset live preview if component re-mounts with new initial values
  useEffect(() => {
    setPrimary(initialPrimary || THEME_DEFAULTS.primaryColor);
    setSecondary(initialSecondary || THEME_DEFAULTS.secondaryColor);
    setTextColor(initialTextColor || '');
    setMutedColor(initialMutedColor || '');
  }, [initialPrimary, initialSecondary, initialTextColor, initialMutedColor]);

  const swatchStyle = (color: string): React.CSSProperties => ({
    background: color,
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '2px solid rgba(0,0,0,0.08)',
    cursor: 'pointer',
    flexShrink: 0,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Brand Colors</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Changes preview live. Save to persist across page loads.
        </p>
      </div>

      {/* Preset palettes */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Quick Palettes</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PALETTES.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.primary, preset.secondary)}
              title={preset.label}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition"
            >
              <span style={swatchStyle(preset.primary)} />
              <span style={swatchStyle(preset.secondary)} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Primary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primary}
              onChange={e => handlePrimary(e.target.value)}
              className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <div className="flex-1">
              <input
                type="text"
                value={primary}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                    setPrimary(v);
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLive(v, secondary);
                  }
                }}
                className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm font-mono text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                maxLength={7}
                placeholder="#22c55e"
              />
            </div>
          </div>
          {/* Live preview swatch */}
          <div className="mt-2 flex gap-2">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: primary }}>
              Button
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border" style={{ color: primary, borderColor: primary + '40', background: primary + '15' }}>
              Badge
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Secondary / Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={secondary}
              onChange={e => handleSecondary(e.target.value)}
              className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <div className="flex-1">
              <input
                type="text"
                value={secondary}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                    setSecondary(v);
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLive(primary, v);
                  }
                }}
                className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm font-mono text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                maxLength={7}
                placeholder="#14b8a6"
              />
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: secondary }}>
              Button
            </span>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border" style={{ color: secondary, borderColor: secondary + '40', background: secondary + '15' }}>
              Badge
            </span>
          </div>
        </div>
      </div>

      {/* Text colors */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-3">Text Colors <span className="text-gray-400 font-normal">(dashboard — leave blank for defaults)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Heading / Body Text</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={textColor || '#1a1a2e'}
                onChange={e => handleTextColor(e.target.value)}
                className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={textColor}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
                      setTextColor(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLive(primary, secondary, v, mutedColor);
                      if (v === '') applyLive(primary, secondary, '', mutedColor);
                    }
                  }}
                  className="flex-1 rounded-lg border border-gray-200 py-2 px-3 text-sm font-mono text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  maxLength={7}
                  placeholder="#1a1a2e (blank=default)"
                />
                {textColor && (
                  <button type="button" onClick={() => handleTextColor('')} className="text-xs text-gray-400 hover:text-gray-600 px-2">reset</button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Muted / Secondary Text</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={mutedColor || '#6b7280'}
                onChange={e => handleMutedColor(e.target.value)}
                className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={mutedColor}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
                      setMutedColor(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) applyLive(primary, secondary, textColor, v);
                      if (v === '') applyLive(primary, secondary, textColor, '');
                    }
                  }}
                  className="flex-1 rounded-lg border border-gray-200 py-2 px-3 text-sm font-mono text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  maxLength={7}
                  placeholder="#6b7280 (blank=default)"
                />
                {mutedColor && (
                  <button type="button" onClick={() => handleMutedColor('')} className="text-xs text-gray-400 hover:text-gray-600 px-2">reset</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Saving…' : 'Save Theme Colors'}
      </Button>
    </div>
  );
}
