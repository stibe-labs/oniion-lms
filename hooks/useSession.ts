'use client';

import { useState, useEffect } from 'react';
import type { PortalUser } from '@/types';

/**
 * Client-side auth hook.
 * Fetches the current user from GET /api/v1/auth/me on mount.
 */
export function useSession() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.data?.user ?? null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, logout };
}
