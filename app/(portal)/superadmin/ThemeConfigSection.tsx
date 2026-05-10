'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { THEME_DEFAULTS } from '@/lib/theme-config';

interface Props {
  initialPrimary: string;
  initialSecondary: string;
}

const PRESET_PALETTES = [
  { label: 'Green (Default)', primary: '#22c55e', secondary: '#14b8a6' },
  { label: 'Blue',            primary: '#3b82f6', secondary: '#06b6d4' },
  { label: 'Purple',          primary: '#8b5cf6', secondary: '#ec4899' },
  { label: 'Orange',          primary: '#f97316', secondary: '#eab308' },
  { label: 'Rose',            primary: '#f43f5e', secondary: '#8b5cf6' },
  { label: 'Indigo',          primary: '#6366f1', secondary: '#0ea5e9' },
];

export default function ThemeConfigSection({ initialPrimary, initialSecondary }: Props) {
  const toast = useToast();
  const [primary,   setPrimary]   = useState(initialPrimary   || THEME_DEFAULTS.primaryColor);
  const [secondary, setSecondary] = useState(initialSecondary || THEME_DEFAULTS.secondaryColor);
  const [saving, setSaving] = useState(false);
  const liveRef = useRef({ primary, secondary });

  function applyLive(p: string, s: string) {
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
    liveRef.current = { primary: p, secondary: s };
  }

  function handlePrimary(color: string) {
    setPrimary(color);
    applyLive(color, secondary);
  }

  function handleSecondary(color: string) {
    setSecondary(color);
    applyLive(primary, color);
  }

  function applyPreset(p: string, s: string) {
    setPrimary(p);
    setSecondary(s);
    applyLive(p, s);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_primary: primary, theme_secondary: secondary }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Failed to save'); return; }
      toast.success('Theme colors saved — reload pages to see server-rendered updates');
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
  }, [initialPrimary, initialSecondary]);

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

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Saving…' : 'Save Theme Colors'}
      </Button>
    </div>
  );
}
