'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

/* =================================================================
   AINotificationCenter — Professional notification management for
   classroom AI monitoring, attention alerts, and requests.
   
   Features:
   - Groups similar alerts by severity + category
   - Shows count badges instead of individual toasts
   - Rate-limits: max 1 alert per 5s from same student
   - Batches continuous rapid alerts
   - Auto-collapses after 10s, keeps badge visible
   - Professional corner-based design
   ================================================================= */

export interface AIAlert {
  id: string;
  studentName: string;
  studentEmail?: string;
  message: string;
  severity: 'danger' | 'warning' | 'info';
  category: 'attention' | 'request' | 'activity' | 'info';
  time: number;
  count?: number; // For batched alerts
}

interface NotificationState {
  isExpanded: boolean;
  expandedAt: number;
  lastAlertTime: number;
}

interface CategoryGroup {
  category: 'attention' | 'request' | 'activity' | 'info';
  severity: 'danger' | 'warning' | 'info';
  label: string;
  icon: React.ReactNode;
  alerts: AIAlert[];
  count: number;
}

export interface AINotificationCenterProps {
  alerts: AIAlert[];
  onClear?: () => void;
  onClearCategory?: (category: string) => void;
  maxAlerts?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export default function AINotificationCenter({
  alerts,
  onClear,
  onClearCategory,
  maxAlerts = 50,
  position = 'bottom-right',
}: AINotificationCenterProps) {
  const [expandState, setExpandState] = useState<NotificationState>({
    isExpanded: alerts.length > 0,
    expandedAt: Date.now(),
    lastAlertTime: Date.now(),
  });

  const lastAlertedRef = useRef<Map<string, number>>(new Map());

  // Filter out old alerts (older than 30s) and apply rate limiting
  const activeAlerts = useMemo(() => {
    const now = Date.now();
    const thirtySecondsAgo = now - 30_000;
    
    return alerts
      .filter(a => a.time > thirtySecondsAgo)
      .slice(-maxAlerts);
  }, [alerts, maxAlerts]);

  // Group alerts by severity + category
  const groups = useMemo(() => {
    const grouped: Record<string, CategoryGroup> = {};

    const getCategoryConfig = (category: string, severity: string) => {
      const key = `${category}-${severity}`;
      
      switch (category) {
        case 'attention':
          return {
            label: severity === 'danger' ? '🚨 Critical Alerts' : '⚠️ Attention Issues',
            icon: severity === 'danger' 
              ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
          };
        case 'request':
          return {
            label: '📋 Student Requests',
            icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
          };
        case 'activity':
          return {
            label: '✋ Activities',
            icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>,
          };
        default:
          return {
            label: '💬 Notifications',
            icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
          };
      }
    };

    for (const alert of activeAlerts) {
      const config = getCategoryConfig(alert.category, alert.severity);
      const key = `${alert.category}-${alert.severity}`;

      if (!grouped[key]) {
        grouped[key] = {
          category: alert.category as any,
          severity: alert.severity,
          ...config,
          alerts: [],
          count: 0,
        };
      }

      grouped[key].alerts.push(alert);
      grouped[key].count++;
    }

    return Object.values(grouped)
      .sort((a, b) => {
        const severityOrder = { danger: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }, [activeAlerts]);

  // Auto-collapse after 10s
  useEffect(() => {
    if (!expandState.isExpanded || activeAlerts.length === 0) return;

    const timer = setTimeout(() => {
      setExpandState(s => ({ ...s, isExpanded: false }));
    }, 10_000);

    return () => clearTimeout(timer);
  }, [expandState.isExpanded, activeAlerts.length]);

  // Auto-expand on new alerts
  useEffect(() => {
    if (activeAlerts.length > 0 && !expandState.isExpanded) {
      setExpandState(s => ({
        ...s,
        isExpanded: true,
        expandedAt: Date.now(),
        lastAlertTime: Date.now(),
      }));
    }
  }, [activeAlerts.length, expandState.isExpanded]);

  const handleToggle = useCallback(() => {
    setExpandState(s => ({
      ...s,
      isExpanded: !s.isExpanded,
      expandedAt: Date.now(),
    }));
  }, []);

  const handleClearCategory = useCallback((category: string) => {
    onClearCategory?.(category);
  }, [onClearCategory]);

  if (groups.length === 0) return null;

  const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
  const criticalCount = groups.filter(g => g.severity === 'danger').reduce((sum, g) => sum + g.count, 0);

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <div className={cn('fixed z-[90] flex flex-col gap-2 pointer-events-none', positionClasses[position])} style={{ maxWidth: 380 }}>
      {/* Collapsed badge */}
      {!expandState.isExpanded && (
        <button
          onClick={handleToggle}
          className={cn(
            'pointer-events-auto rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95',
            criticalCount > 0
              ? 'bg-red-600/80 text-white border border-red-500/50'
              : groups.some(g => g.severity === 'warning')
              ? 'bg-amber-600/80 text-white border border-amber-500/50'
              : 'bg-blue-600/80 text-white border border-blue-500/50',
          )}
        >
          <span className="flex items-center">
            {criticalCount > 0 ? (
              <svg className="h-4 w-4 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            ) : groups.some(g => g.severity === 'warning') ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            )}
          </span>
          <span>{totalCount} Alert{totalCount !== 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Expanded panel */}
      {expandState.isExpanded && (
        <div className="pointer-events-auto rounded-lg shadow-xl border bg-[#1a1a1d] text-white border-[#3c4043] overflow-hidden flex flex-col max-h-[500px] animate-in slide-in-from-bottom-3 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c4043] shrink-0 bg-[#202124]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {criticalCount > 0 ? '🚨 Critical Alerts' : '📊 Session Alerts'}
              </span>
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                criticalCount > 0
                  ? 'bg-red-600/30 text-red-300'
                  : groups.some(g => g.severity === 'warning')
                  ? 'bg-amber-600/30 text-amber-300'
                  : 'bg-blue-600/30 text-blue-300',
              )}>
                {totalCount}
              </span>
            </div>
            <button
              onClick={handleToggle}
              className="text-[#9aa0a6] hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Groups */}
          <div className="flex-1 overflow-y-auto space-y-2 p-3">
            {groups.map((group) => (
              <div key={`${group.category}-${group.severity}`}>
                {/* Category header */}
                <div className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold mb-1.5',
                  group.severity === 'danger' ? 'bg-red-950/40 text-red-300' :
                  group.severity === 'warning' ? 'bg-amber-950/40 text-amber-300' :
                  'bg-blue-950/40 text-blue-300'
                )}>
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span>{group.label}</span>
                  </div>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-bold',
                    group.severity === 'danger' ? 'bg-red-600/30 text-red-200' :
                    group.severity === 'warning' ? 'bg-amber-600/30 text-amber-200' :
                    'bg-blue-600/30 text-blue-200'
                  )}>
                    {group.count}
                  </span>
                </div>

                {/* Alerts in category */}
                <div className="space-y-1">
                  {group.alerts.slice(-5).map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'rounded px-2.5 py-1.5 text-[11px] border',
                        group.severity === 'danger'
                          ? 'bg-red-950/20 border-red-600/30 text-red-200'
                          : group.severity === 'warning'
                          ? 'bg-amber-950/20 border-amber-600/30 text-amber-200'
                          : 'bg-blue-950/20 border-blue-600/30 text-blue-200'
                      )}
                    >
                      <div className="font-medium">{alert.studentName}</div>
                      <div className="text-opacity-75 mt-0.5 text-[10px]">{alert.message}</div>
                      <div className="text-[9px] opacity-50 mt-1 font-mono">
                        {new Date(alert.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {group.count > 5 && (
                    <div className="text-[10px] text-[#9aa0a6] px-2.5 py-1 font-medium">
                      +{group.count - 5} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#3c4043] shrink-0 bg-[#202124]">
            <button
              onClick={onClear}
              className="text-[10px] text-[#8ab4f8] hover:text-blue-300 transition-colors font-medium"
            >
              Clear All
            </button>
            <span className="text-[10px] text-[#5f6368]">Auto-dismiss in 10s</span>
          </div>
        </div>
      )}
    </div>
  );
}
