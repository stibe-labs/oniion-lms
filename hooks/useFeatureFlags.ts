'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_FLAGS } from '@/lib/feature-flags-shared';
import type { FeatureFlags } from '@/lib/feature-flags-shared';

export function useFeatureFlags(): { flags: FeatureFlags; loaded: boolean } {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/v1/platform/feature-flags')
      .then(r => r.json())
      .then(d => { if (d.success) setFlags(d.data); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return { flags, loaded };
}
