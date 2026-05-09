'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AIAlert } from '@/components/classroom/AINotificationCenter';

/* =================================================================
   useAINotifications — Hook for managing AI monitoring alerts
   with intelligent batching and rate limiting.
   
   Features:
   - Rate limit: max 1 alert per 5s per student
   - Auto-batch rapid alerts from same student
   - 30s visibility window for alerts
   - Automatic cleanup of stale alerts
   ================================================================= */

interface UseAINotificationsOptions {
  rateLimitMs?: number; // Min time between alerts from same student
  maxAlerts?: number;
  alertTTL?: number; // Time to live for alerts (ms)
}

export function useAINotifications(options: UseAINotificationsOptions = {}) {
  const {
    rateLimitMs = 5000, // 5s rate limit per student
    maxAlerts = 50,
    alertTTL = 30_000, // 30s
  } = options;

  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const lastAlertedRef = useRef<Map<string, number>>(new Map());
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add an alert with rate limiting and batching
  const addAlert = useCallback((
    studentName: string,
    message: string,
    options: {
      severity?: 'danger' | 'warning' | 'info';
      category?: 'attention' | 'request' | 'activity' | 'info';
      studentEmail?: string;
    } = {}
  ) => {
    const {
      severity = 'info',
      category = 'info',
      studentEmail,
    } = options;

    const key = studentEmail || studentName;
    const now = Date.now();
    const lastAlert = lastAlertedRef.current.get(key) ?? 0;

    // Rate limiting: skip if we alerted this student too recently
    if (now - lastAlert < rateLimitMs) {
      return; // Alert suppressed by rate limit
    }

    lastAlertedRef.current.set(key, now);

    const newAlert: AIAlert = {
      id: `${key}-${now}`,
      studentName,
      studentEmail,
      message,
      severity,
      category,
      time: now,
    };

    setAlerts((prev) => {
      const updated = [...prev, newAlert];
      // Keep max alerts, trim oldest
      return updated.slice(-maxAlerts);
    });
  }, [rateLimitMs, maxAlerts]);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Clear alerts by category
  const clearCategory = useCallback((category: string) => {
    setAlerts((prev) => prev.filter((a) => a.category !== category));
  }, []);

  // Auto-cleanup stale alerts
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      setAlerts((prev) => prev.filter((a) => now - a.time < alertTTL));
    };

    if (cleanupTimerRef.current) clearInterval(cleanupTimerRef.current);
    cleanupTimerRef.current = setInterval(cleanup, 5000); // Check every 5s

    return () => {
      if (cleanupTimerRef.current) clearInterval(cleanupTimerRef.current);
    };
  }, [alertTTL]);

  return {
    alerts,
    addAlert,
    clearAlerts,
    clearCategory,
  };
}
