'use client';

import { useState, useEffect } from 'react';
import { usePlatformContext } from '@/components/providers/PlatformProvider';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PortalUser } from '@/types';

interface Props {
  user: PortalUser;
}

export default function SuperadminClient({ user: _user }: Props) {
  const { setPlatformName } = usePlatformContext();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [bujiEnabled, setBujiEnabled] = useState(true);
  const [bujiSaving, setBujiSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/superadmin/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setValue(d.data.platform_name);
          setBujiEnabled(d.data.buji_enabled ?? true);
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
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to save');
        return;
      }
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
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to save');
        return;
      }
      setBujiEnabled(enabled);
      toast.success(`Buji ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Network error');
    } finally {
      setBujiSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
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
              placeholder="e.g. Stibe"
              className="w-full"
            />
          </div>
          <Button type="submit" disabled={fetching || loading || !value.trim()} className="w-full sm:w-auto">
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
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

