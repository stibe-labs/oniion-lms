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

  useEffect(() => {
    fetch('/api/v1/superadmin/settings')
      .then(r => r.json())
      .then(d => { if (d.success) setValue(d.data.platform_name); })
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

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Superadmin — Platform Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure platform-wide settings.</p>
      </div>

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
    </div>
  );
}
