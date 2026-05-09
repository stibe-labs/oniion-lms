'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  /** Seconds since connection was lost (0 if online) */
  offlineSince: number;
  /** Effective connection type from Navigator API (4g/3g/2g/slow-2g) */
  effectiveType: string | null;
  /** Estimated downlink bandwidth in Mbps */
  downlink: number | null;
  /** Estimated round-trip time in ms */
  rtt: number | null;
}

/**
 * useNetworkStatus — detects browser online/offline state and network quality.
 * Uses `navigator.onLine` + `online`/`offline` events + Network Information API.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineAt, setOfflineAt] = useState<number | null>(null);
  const [offlineSince, setOfflineSince] = useState(0);
  const [effectiveType, setEffectiveType] = useState<string | null>(null);
  const [downlink, setDownlink] = useState<number | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);

  const readNetworkInfo = useCallback(() => {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection;
    if (conn) {
      setEffectiveType(conn.effectiveType ?? null);
      setDownlink(conn.downlink ?? null);
      setRtt(conn.rtt ?? null);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOfflineAt(null);
      setOfflineSince(0);
      readNetworkInfo();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineAt(Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    readNetworkInfo();

    // Listen for Network Information API changes
    const conn = (navigator as unknown as { connection?: { addEventListener?: (evt: string, fn: () => void) => void } }).connection;
    if (conn?.addEventListener) {
      conn.addEventListener('change', readNetworkInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [readNetworkInfo]);

  // Tick the offline counter every second when offline
  useEffect(() => {
    if (!offlineAt) return;
    const iv = setInterval(() => {
      setOfflineSince(Math.floor((Date.now() - offlineAt) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [offlineAt]);

  return { isOnline, offlineSince, effectiveType, downlink, rtt };
}
