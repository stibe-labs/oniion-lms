'use client';

import { useState, useCallback } from 'react';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * OfflineOverlay — Full-screen opaque overlay shown when the browser loses internet.
 * Completely covers all content to prevent raw errors from showing through.
 * Auto-dismisses when connection is restored.
 */
export default function OfflineOverlay() {
  const { isOnline, offlineSince } = useNetworkStatus();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    // Attempt a real network check by fetching a tiny resource
    try {
      await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      // If it succeeds, the browser will fire the 'online' event naturally
      window.location.reload();
    } catch {
      // Still offline — let the overlay stay
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  if (isOnline) return null;

  const mins = Math.floor(offlineSince / 60);
  const secs = offlineSince % 60;
  const elapsed = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center text-center px-6 max-w-sm">
        {/* Icon circle */}
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/25">
          <WifiOff className="h-14 w-14 text-destructive" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h2 className="mb-2.5 text-2xl font-bold tracking-tight text-foreground">
          No Internet Connection
        </h2>

        {/* Subtitle */}
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Please check your WiFi or network connection and try again
        </p>

        {/* Elapsed timer */}
        {offlineSince > 0 && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            Disconnected for <strong>{elapsed}</strong>
          </div>
        )}

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {retrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {retrying ? 'Checking…' : 'Retry'}
        </button>
      </div>
    </div>
  );
}
