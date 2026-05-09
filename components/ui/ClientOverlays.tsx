'use client';

import dynamic from 'next/dynamic';

const OfflineOverlay = dynamic(() => import('@/components/ui/OfflineOverlay'), { ssr: false });

/**
 * ClientOverlays — Client-side overlays mounted from the root layout.
 * Renders the offline detection overlay globally.
 */
export default function ClientOverlays() {
  return <OfflineOverlay />;
}
