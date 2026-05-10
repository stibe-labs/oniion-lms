'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlatformContext } from '@/components/providers/PlatformProvider';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload, X, ImageIcon, Building2, ToggleLeft, Palette,
  Sparkles, Layout, Plug, ChevronRight, Settings2,
} from 'lucide-react';
import type { PortalUser } from '@/types';
import type { SplashConfig } from '@/lib/splash-config';
import { SPLASH_CONFIG_DEFAULTS } from '@/lib/splash-config';
import type { AuthConfig } from '@/lib/auth-config';
import { AUTH_CONFIG_DEFAULTS } from '@/lib/auth-config';
import SplashConfigSection from './SplashConfigSection';
import AuthConfigSection from './AuthConfigSection';
import ThemeConfigSection from './ThemeConfigSection';
import IntegrationsSection from './IntegrationsSection';

// ── Types ──────────────────────────────────────────────────────

interface Props { user: PortalUser }

type TabId = 'identity' | 'features' | 'logos' | 'colors' | 'splash' | 'login' | 'integrations';

type LogoType = 'small' | 'full' | 'favicon' | 'character';

interface LogoSlot {
  type: LogoType;
  label: string;
  description: string;
  hint: string;
}

// ── Static data ────────────────────────────────────────────────

const LOGO_SLOTS: LogoSlot[] = [
  { type: 'full',      label: 'Full Logo',          description: 'Wide logo on login page and public pages.',               hint: 'PNG/SVG, transparent bg, landscape. Max 2 MB' },
  { type: 'small',     label: 'Small Logo',          description: 'Square icon logo in the sidebar navigation.',             hint: 'PNG/SVG, transparent bg, square 1:1. Max 2 MB' },
  { type: 'favicon',   label: 'Favicon',             description: 'Icon shown in the browser tab.',                          hint: 'PNG or ICO, 32×32 or 64×64 px. Max 2 MB' },
  { type: 'character', label: 'Loading Character',   description: 'Mascot in loading states, splash screen, and chatbot.',   hint: 'Animated GIF or PNG, square, transparent. Max 5 MB' },
];

const NAV: { label: string; items: { id: TabId; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'General',
    items: [
      { id: 'identity',     label: 'Platform Identity', icon: Building2  },
      { id: 'features',     label: 'Features',          icon: ToggleLeft },
    ],
  },
  {
    label: 'Branding',
    items: [
      { id: 'logos',  label: 'Logos & Assets', icon: ImageIcon },
      { id: 'colors', label: 'Brand Colors',   icon: Palette   },
    ],
  },
  {
    label: 'Appearance',
    items: [
      { id: 'splash', label: 'Splash Screen', icon: Sparkles },
      { id: 'login',  label: 'Login Screen',  icon: Layout   },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'integrations', label: 'Services', icon: Plug },
    ],
  },
];

// ── Shared sub-components ──────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-3 mb-1.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
          <Icon className="h-[18px] w-[18px] text-primary" />
        </div>
        <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">{title}</h1>
      </div>
      <p className="text-sm text-gray-500 pl-12">{subtitle}</p>
    </div>
  );
}

function SettingsCard({ title, description, children, footer }: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {(title || description) && (
        <div className="px-6 py-4 border-b border-gray-100">
          {title && <p className="text-sm font-semibold text-gray-800">{title}</p>}
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">{footer}</div>}
    </div>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ── Logo Uploader ──────────────────────────────────────────────

function LogoUploader({ slot, currentUrl, onUploaded, onRemoved }: {
  slot: LogoSlot;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  useEffect(() => { setPreview(currentUrl); }, [currentUrl]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', slot.type);
      const res = await fetch('/api/v1/superadmin/logos', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Upload failed'); return; }
      setPreview(data.data.url);
      onUploaded(data.data.url);
      toast.success(`${slot.label} updated`);
    } catch { toast.error('Network error'); }
    finally { setUploading(false); }
  }

  async function handleRemove() {
    try {
      const res = await fetch('/api/v1/superadmin/logos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: slot.type }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error('Remove failed'); return; }
      setPreview(null);
      onRemoved();
      toast.success(`${slot.label} removed`);
    } catch { toast.error('Network error'); }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
        style={{ width: slot.type === 'full' ? 148 : 64, height: 64 }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {preview
          ? <img src={preview} alt={slot.label} className="max-w-full max-h-full object-contain p-1.5" />
          : <ImageIcon className="h-5 w-5 text-gray-300" />
        }
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-2.5 leading-snug">{slot.hint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-3 w-3" />
            {preview ? 'Replace' : 'Upload'}
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={slot.type === 'character'
          ? 'image/png,image/jpeg,image/gif,image/webp,image/apng'
          : 'image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/x-icon'
        }
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function SuperadminClient({ user: _user }: Props) {
  const {
    setPlatformName, setLogoSmallUrl, setLogoFullUrl,
    setLogoAuthHeight, setLogoSplashHeight, setLogoSidebarHeight, setLogoEmailHeight,
    setLoadingCharacterUrl,
  } = usePlatformContext();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('identity');

  // ── Settings state ────────────────────────────────────────
  const [platformName, setPlatformNameLocal] = useState('');
  const [platformNameLoading, setPlatformNameLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [bujiEnabled, setBujiEnabled] = useState(true);
  const [bujiSaving, setBujiSaving] = useState(false);
  const [logos, setLogos] = useState<{ small: string | null; full: string | null; favicon: string | null; character: string | null }>({
    small: null, full: null, favicon: null, character: null,
  });
  const [sizes, setSizes] = useState({ auth: 40, splash: 36, sidebar: 20, email: 36 });
  const [sizesSaving, setSizesSaving] = useState(false);
  const [splashCfg, setSplashCfg] = useState<SplashConfig>({ ...SPLASH_CONFIG_DEFAULTS });
  const [authCfg, setAuthCfg] = useState<AuthConfig>({ ...AUTH_CONFIG_DEFAULTS });
  const [themePrimary,   setThemePrimary]   = useState('');
  const [themeSecondary, setThemeSecondary] = useState('');
  const [themeTextColor,  setThemeTextColor]  = useState('');
  const [themeMutedColor, setThemeMutedColor] = useState('');

  // ── Load ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/superadmin/settings')
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        setPlatformNameLocal(d.data.platform_name ?? '');
        setBujiEnabled(d.data.buji_enabled ?? true);
        setLogos({
          small:     d.data.logo_small_url       ?? null,
          full:      d.data.logo_full_url         ?? null,
          favicon:   d.data.favicon_url           ?? null,
          character: d.data.loading_character_url ?? null,
        });
        setSizes({
          auth:    d.data.logo_auth_height    ?? 40,
          splash:  d.data.logo_splash_height  ?? 36,
          sidebar: d.data.logo_sidebar_height ?? 20,
          email:   d.data.logo_email_height   ?? 36,
        });
        setSplashCfg({
          template:             d.data.splash_template               ?? 'classic',
          progressStyle:        d.data.splash_progress_style         ?? 'bar',
          loadingAnim:          d.data.splash_loading_anim           ?? 'character',
          tagline:              d.data.splash_tagline                ?? 'Crafting Future',
          taglineSize:          d.data.splash_tagline_size           ?? 13,
          taglineWeight:        d.data.splash_tagline_weight         ?? 'semibold',
          taglineLetterSpacing: d.data.splash_tagline_letter_spacing ?? 4,
          accentColor:          d.data.splash_accent_color           ?? '#10b981',
          bgColor:              d.data.splash_bg_color               ?? '#fafbfc',
          textColor:            d.data.splash_text_color             ?? '',
          showQuotes:           d.data.splash_show_quotes            ?? false,
          quotes:               d.data.splash_quotes                 ?? [],
        });
        setAuthCfg({
          template:    d.data.auth_template     ?? 'classic',
          accentColor: d.data.auth_accent_color ?? '#10b981',
          bgColor:     d.data.auth_bg_color     ?? '#f0fdf4',
          textColor:   d.data.auth_text_color   ?? '',
          headline:    d.data.auth_headline     ?? 'Empowering every learner',
          subheadline: d.data.auth_subheadline  ?? 'Sign in to continue learning',
          showTagline: d.data.auth_show_tagline ?? true,
          bgPattern:   d.data.auth_bg_pattern   ?? 'dots',
        });
        setThemePrimary(d.data.theme_primary      ?? '#22c55e');
        setThemeSecondary(d.data.theme_secondary  ?? '#14b8a6');
        setThemeTextColor(d.data.theme_text_color  ?? '');
        setThemeMutedColor(d.data.theme_muted_color ?? '');
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  async function savePlatformName(e: React.FormEvent) {
    e.preventDefault();
    if (!platformName.trim()) return;
    setPlatformNameLoading(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_name: platformName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Failed to save'); return; }
      setPlatformName(platformName.trim());
      toast.success('Platform name updated');
    } catch { toast.error('Network error'); }
    finally { setPlatformNameLoading(false); }
  }

  async function saveBuji(enabled: boolean) {
    setBujiSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buji_enabled: enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Failed to save'); return; }
      setBujiEnabled(enabled);
      toast.success(`Buji ${enabled ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Network error'); }
    finally { setBujiSaving(false); }
  }

  function handleLogoUploaded(type: LogoType, url: string) {
    setLogos(prev => ({ ...prev, [type]: url }));
    if (type === 'small')     setLogoSmallUrl(url);
    if (type === 'full')      setLogoFullUrl(url);
    if (type === 'character') setLoadingCharacterUrl(url);
  }

  function handleLogoRemoved(type: LogoType) {
    setLogos(prev => ({ ...prev, [type]: null }));
    if (type === 'small')     setLogoSmallUrl(null);
    if (type === 'full')      setLogoFullUrl(null);
    if (type === 'character') setLoadingCharacterUrl(null);
  }

  async function saveSizes() {
    setSizesSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_auth_height:    sizes.auth,
          logo_splash_height:  sizes.splash,
          logo_sidebar_height: sizes.sidebar,
          logo_email_height:   sizes.email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Failed to save'); return; }
      setLogoAuthHeight(sizes.auth);
      setLogoSplashHeight(sizes.splash);
      setLogoSidebarHeight(sizes.sidebar);
      setLogoEmailHeight(sizes.email);
      toast.success('Logo sizes updated');
    } catch { toast.error('Network error'); }
    finally { setSizesSaving(false); }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex min-h-full">

      {/* ── Left sidebar nav ── */}
      <aside className="w-[220px] shrink-0 border-r border-gray-200 bg-white flex flex-col self-stretch">
        {/* Header */}
        <div className="px-5 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <Settings2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Superadmin</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 pl-9">Platform Settings</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] px-2.5 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {active && <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 bg-[#f7f8fa] overflow-y-auto">
        <div className="px-8 py-8 max-w-[720px]">

          {/* ── Identity ── */}
          {activeTab === 'identity' && (
            <div className="space-y-5">
              <SectionHeader
                icon={Building2}
                title="Platform Identity"
                subtitle="Configure the name and public-facing identity of your platform."
              />

              <SettingsCard
                title="Platform Name"
                description="Shown across the dashboard, email templates, and the browser tab title."
              >
                <form onSubmit={savePlatformName} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Display name</label>
                    <Input
                      value={platformName}
                      onChange={e => setPlatformNameLocal(e.target.value)}
                      disabled={fetching || platformNameLoading}
                      placeholder="e.g. Oniion Learning"
                      className="w-full"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={fetching || platformNameLoading || !platformName.trim()}
                    className="shrink-0"
                  >
                    {platformNameLoading ? 'Saving…' : 'Save'}
                  </Button>
                </form>
              </SettingsCard>
            </div>
          )}

          {/* ── Features ── */}
          {activeTab === 'features' && (
            <div className="space-y-5">
              <SectionHeader
                icon={ToggleLeft}
                title="Features"
                subtitle="Enable or disable optional platform capabilities."
              />

              <SettingsCard>
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Buji AI Chatbot</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Show the Buji AI assistant on the login page and student dashboard.
                      When disabled, the chatbot is hidden for all users.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Toggle
                      enabled={bujiEnabled}
                      disabled={fetching || bujiSaving}
                      onChange={saveBuji}
                    />
                    <span className="text-[11px] text-gray-400">
                      {bujiSaving ? 'Saving…' : bujiEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* ── Logos & Assets ── */}
          {activeTab === 'logos' && (
            <div className="space-y-5">
              <SectionHeader
                icon={ImageIcon}
                title="Logos & Assets"
                subtitle="Upload brand assets and configure how they appear across the platform."
              />

              {/* Logo uploads */}
              <SettingsCard
                title="Brand Assets"
                description="PNG, JPG, SVG, or WebP. Max 2 MB each (5 MB for character)."
              >
                <div className="divide-y divide-gray-100">
                  {LOGO_SLOTS.map((slot, i) => (
                    <div key={slot.type} className={i > 0 ? 'pt-5 mt-5' : ''}>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-semibold text-gray-700">{slot.label}</p>
                        <span className="text-[10px] text-gray-400">—</span>
                        <p className="text-[11px] text-gray-400 flex-1">{slot.description}</p>
                      </div>
                      <LogoUploader
                        slot={slot}
                        currentUrl={logos[slot.type]}
                        onUploaded={url => handleLogoUploaded(slot.type, url)}
                        onRemoved={() => handleLogoRemoved(slot.type)}
                      />
                    </div>
                  ))}
                </div>
              </SettingsCard>

              {/* Logo sizes */}
              <SettingsCard
                title="Display Sizes"
                description="Logo height in pixels per context. Width scales automatically to preserve aspect ratio."
              >
                <div className="space-y-6">
                  {([
                    { key: 'auth'    as const, label: 'Login Screen',     desc: 'Full logo on the auth/login page',              min: 20, max: 80, logoUrl: logos.full  },
                    { key: 'splash'  as const, label: 'Splash Screen',    desc: 'Full logo shown during initial loading',         min: 20, max: 80, logoUrl: logos.full  },
                    { key: 'sidebar' as const, label: 'Sidebar',          desc: 'Small icon logo in the sidebar nav header',      min: 12, max: 36, logoUrl: logos.small },
                    { key: 'email'   as const, label: 'Email Header',     desc: 'Full logo in transactional email headers',       min: 24, max: 60, logoUrl: logos.full  },
                  ]).map(({ key, label, desc, min, max, logoUrl }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg tabular-nums">
                          {sizes[key]}px
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 flex items-center justify-center w-16 h-10 rounded-lg border border-gray-100 bg-gray-50">
                          {logoUrl
                            ? <img src={logoUrl} alt={label} style={{ height: sizes[key], maxWidth: 56 }} className="object-contain" />
                            : <ImageIcon className="h-3.5 w-3.5 text-gray-300" />
                          }
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={sizes[key]}
                          disabled={fetching}
                          onChange={e => setSizes(prev => ({ ...prev, [key]: parseInt(e.target.value, 10) }))}
                          className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 [accent-color:var(--primary)] cursor-pointer disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <Button onClick={saveSizes} disabled={fetching || sizesSaving}>
                    {sizesSaving ? 'Saving…' : 'Save Sizes'}
                  </Button>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* ── Brand Colors ── */}
          {activeTab === 'colors' && (
            <div className="space-y-5">
              <SectionHeader
                icon={Palette}
                title="Brand Colors"
                subtitle="Set your primary and accent colors. Changes preview live across the dashboard."
              />
              {!fetching && (
                <ThemeConfigSection
                  initialPrimary={themePrimary}
                  initialSecondary={themeSecondary}
                  initialTextColor={themeTextColor}
                  initialMutedColor={themeMutedColor}
                />
              )}
            </div>
          )}

          {/* ── Splash Screen ── */}
          {activeTab === 'splash' && (
            <div className="space-y-5">
              <SectionHeader
                icon={Sparkles}
                title="Splash Screen"
                subtitle="Customize the first-load screen shown while the app initializes."
              />
              {!fetching && (
                <SplashConfigSection
                  initial={splashCfg}
                  logoFullUrl={logos.full}
                  characterUrl={logos.character}
                  splashLogoHeight={sizes.splash}
                />
              )}
            </div>
          )}

          {/* ── Login Screen ── */}
          {activeTab === 'login' && (
            <div className="space-y-5">
              <SectionHeader
                icon={Layout}
                title="Login Screen"
                subtitle="Choose a template and customize colors for the authentication page."
              />
              {!fetching && (
                <AuthConfigSection
                  initial={authCfg}
                  logoFullUrl={logos.full}
                  logoAuthHeight={sizes.auth}
                />
              )}
            </div>
          )}

          {/* ── Integrations ── */}
          {activeTab === 'integrations' && (
            <div className="space-y-5">
              <SectionHeader
                icon={Plug}
                title="Services & Integrations"
                subtitle="Connect external services. Values saved here override environment variables at runtime — no restart required."
              />
              <IntegrationsSection />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
