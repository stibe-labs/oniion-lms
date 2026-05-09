'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlatformContext } from '@/components/providers/PlatformProvider';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X, ImageIcon } from 'lucide-react';
import type { PortalUser } from '@/types';

interface Props {
  user: PortalUser;
}

type LogoType = 'small' | 'full' | 'favicon';

interface LogoSlot {
  type: LogoType;
  label: string;
  description: string;
  hint: string;
}

const LOGO_SLOTS: LogoSlot[] = [
  {
    type: 'full',
    label: 'Full Logo',
    description: 'Wide/horizontal logo shown on the login page and public pages.',
    hint: 'Recommended: PNG/SVG, transparent background, landscape orientation',
  },
  {
    type: 'small',
    label: 'Small Logo',
    description: 'Square/icon logo shown in the sidebar navigation.',
    hint: 'Recommended: PNG/SVG, transparent background, square (1:1 ratio)',
  },
  {
    type: 'favicon',
    label: 'Favicon',
    description: 'Icon shown in the browser tab.',
    hint: 'Recommended: PNG or ICO, 32×32 or 64×64 px',
  },
];

function LogoUploader({
  slot,
  currentUrl,
  onUploaded,
  onRemoved,
}: {
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
    if (!file) return;
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
    } catch {
      toast.error('Network error');
    } finally {
      setUploading(false);
    }
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
    } catch {
      toast.error('Network error');
    }
  }

  return (
    <div className="flex items-start gap-4">
      {/* Preview box */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300 transition-colors"
        style={{ width: slot.type === 'full' ? 160 : 72, height: 72 }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt={slot.label} className="max-w-full max-h-full object-contain p-1" />
        ) : (
          <ImageIcon className="h-6 w-6 text-gray-300" />
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Info + buttons */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-2">{slot.hint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-3 w-3" />
            {preview ? 'Replace' : 'Upload'}
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
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
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/x-icon"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

export default function SuperadminClient({ user: _user }: Props) {
  const { setPlatformName, setLogoSmallUrl, setLogoFullUrl } = usePlatformContext();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [bujiEnabled, setBujiEnabled] = useState(true);
  const [bujiSaving, setBujiSaving] = useState(false);
  const [logos, setLogos] = useState<{ small: string | null; full: string | null; favicon: string | null }>({
    small: null, full: null, favicon: null,
  });

  useEffect(() => {
    fetch('/api/v1/superadmin/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setValue(d.data.platform_name);
          setBujiEnabled(d.data.buji_enabled ?? true);
          setLogos({
            small:   d.data.logo_small_url ?? null,
            full:    d.data.logo_full_url  ?? null,
            favicon: d.data.favicon_url    ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_name: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Failed to save'); return; }
      setPlatformName(value.trim());
      toast.success('Platform name updated');
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleBujiToggle(enabled: boolean) {
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
    } catch {
      toast.error('Network error');
    } finally {
      setBujiSaving(false);
    }
  }

  function handleLogoUploaded(type: LogoType, url: string) {
    setLogos(prev => ({ ...prev, [type]: url }));
    if (type === 'small') setLogoSmallUrl(url);
    if (type === 'full')  setLogoFullUrl(url);
  }

  function handleLogoRemoved(type: LogoType) {
    setLogos(prev => ({ ...prev, [type]: null }));
    if (type === 'small') setLogoSmallUrl(null);
    if (type === 'full')  setLogoFullUrl(null);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Superadmin — Platform Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure platform-wide settings.</p>
      </div>

      {/* Platform Name */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Platform Name</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="platform-name" className="block text-xs font-medium text-gray-600 mb-1.5">
              Display name shown across the UI
            </label>
            <Input
              id="platform-name"
              value={value}
              onChange={e => setValue(e.target.value)}
              disabled={fetching || loading}
              placeholder="e.g. Oniion"
              className="w-full"
            />
          </div>
          <Button type="submit" disabled={fetching || loading || !value.trim()} className="w-full sm:w-auto">
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </div>

      {/* Logos */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Logos</h2>
        <p className="text-xs text-gray-500 mb-5">
          Upload PNG, JPG, SVG, or WebP. Max 2 MB each. Changes take effect immediately.
        </p>
        <div className="space-y-6">
          {LOGO_SLOTS.map(slot => (
            <div key={slot.type}>
              <p className="text-xs font-medium text-gray-600 mb-2">
                {slot.label}
                <span className="ml-1.5 font-normal text-gray-400">— {slot.description}</span>
              </p>
              <LogoUploader
                slot={slot}
                currentUrl={logos[slot.type]}
                onUploaded={url => handleLogoUploaded(slot.type, url)}
                onRemoved={() => handleLogoRemoved(slot.type)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Buji Chatbot */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Buji AI Chatbot</h2>
        <p className="text-xs text-gray-500 mb-4">
          Show or hide the Buji chatbot on the login page and student dashboard.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={bujiEnabled}
            disabled={fetching || bujiSaving}
            onClick={() => handleBujiToggle(!bujiEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              bujiEnabled ? 'bg-emerald-500 focus-visible:ring-emerald-500' : 'bg-gray-300 focus-visible:ring-gray-400'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                bujiEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">
            {bujiSaving ? 'Saving…' : bujiEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
}
