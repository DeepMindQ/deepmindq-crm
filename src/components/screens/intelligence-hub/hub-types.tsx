'use client';

import { AlertTriangle, CheckCircle2, CircleDot } from 'lucide-react';
import React from 'react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface SignalFeedItem {
  id: string;
  signalType: string;
  severity: string;
  title: string;
  description: string;
  confidenceScore: number;
  detectedAt: string;
  organizationName?: string;
  organizationId?: string;
}

export interface HealthStatus {
  aiProvider: string;
  database: string;
  lastPipelineRun: string;
  pipelineStatus: string;
  overallStatus: string;
  uptime?: number;
  errors?: number;
}

export interface TimelineEntry {
  id: string;
  type: 'signal' | 'insight' | 'import' | 'pipeline' | 'briefing';
  message: string;
  detail: string;
  timestamp: Date;
}

export interface TopOrg {
  id: string;
  name: string;
  industry: string;
  intelligenceScore: number;
  signalCount: number;
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
}

export interface StatCardData {
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
}

// ═══════════════════════════════════════════════════════════════
// Constants & Colors
// ═══════════════════════════════════════════════════════════════

export const C = {
  bg: 'var(--ios-bg-primary)',
  bgCard: 'var(--ios-bg-card)',
  bgCardHover: '#1a2236',
  border: '#1E293B',
  borderLight: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accent: '#3B82F6',
  accentDim: '#1D4ED8',
  accentGhost: 'rgba(59, 130, 246, 0.08)',
  success: '#10B981',
  successGhost: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',
  warningGhost: 'rgba(245, 158, 11, 0.1)',
  danger: '#EF4444',
  dangerGhost: 'rgba(239, 68, 68, 0.1)',
  purple: '#8B5CF6',
  purpleGhost: 'rgba(139, 92, 246, 0.1)',
  cyan: '#06B6D4',
  cyanGhost: 'rgba(6, 182, 212, 0.1)',
  gold: '#EAB308',
  goldGhost: 'rgba(234, 179, 8, 0.1)',
};

export const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> =
  {
    critical: { color: C.danger, bg: C.dangerGhost, icon: <AlertTriangle className="h-4 w-4" /> },
    high: {
      color: '#F97316',
      bg: 'rgba(249, 115, 22, 0.1)',
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    medium: { color: C.warning, bg: C.warningGhost, icon: <CircleDot className="h-4 w-4" /> },
    low: { color: C.success, bg: C.successGhost, icon: <CheckCircle2 className="h-4 w-4" /> },
  };

export const SIGNAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  opportunity: { color: C.purple, bg: C.purpleGhost },
  risk: { color: C.danger, bg: C.dangerGhost },
  growth: { color: C.success, bg: C.successGhost },
  market: { color: C.cyan, bg: C.cyanGhost },
  financial: { color: C.gold, bg: C.goldGhost },
  technology: { color: C.accent, bg: C.accentGhost },
  regulatory: { color: C.warning, bg: C.warningGhost },
};

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════════════
// Data Fetching (API-backed with mock fallbacks)
// ═══════════════════════════════════════════════════════════════

// ── API-backed fetchers (return empty arrays on error — no fake data) ──

export async function fetchSignals(limit = 10): Promise<SignalFeedItem[]> {
  try {
    const res = await fetch('/api/signals?limit=' + limit, { credentials: 'include' });
    if (!res.ok) return [];
    const json = await res.json();
    const data: SignalFeedItem[] = (json.data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      signalType: (s.signalType as string) || 'unknown',
      severity: (s.severity as string) || 'medium',
      title: (s.title as string) || '',
      description: (s.description as string) || '',
      confidenceScore: (s.confidenceScore as number) ?? 0,
      detectedAt: (s.detectedAt as string) || new Date().toISOString(),
      organizationName: (s.organization as Record<string, string> | null)?.name,
      organizationId: (s.organizationId as string) || undefined,
    }));
    return data;
  } catch {
    return [];
  }
}

export async function fetchTopOrgs(limit = 5): Promise<TopOrg[]> {
  try {
    const res = await fetch('/api/organizations?limit=' + limit, { credentials: 'include' });
    if (!res.ok) return [];
    const json = await res.json();
    const orgs = json.data || [];
    if (!Array.isArray(orgs) || orgs.length === 0) return [];
    // Sort by intelligenceScore descending
    const sorted = [...orgs]
      .sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          ((b.intelligenceScore as number) || 0) - ((a.intelligenceScore as number) || 0),
      )
      .slice(0, limit);
    return sorted.map((o: Record<string, unknown>) => ({
      id: o.id as string,
      name: (o.name as string) || 'Unknown',
      industry: (o.industry as string) || 'Unknown',
      intelligenceScore: (o.intelligenceScore as number) || 0,
      signalCount: (o.signalCount as number) || 0,
      // TODO: No trend/historical API available yet — hardcoded to neutral intentionally.
      // When a trend API exists (e.g. /api/organizations/trends), replace with real data.
      trend: 'neutral' as const,
      trendValue: 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchTimeline(limit = 10): Promise<TimelineEntry[]> {
  try {
    const [signalsRes, activityRes] = await Promise.all([
      fetch('/api/signals?limit=' + limit, { credentials: 'include' }),
      fetch('/api/team-activity?limit=' + limit, { credentials: 'include' }),
    ]);

    const entries: TimelineEntry[] = [];

    if (signalsRes.ok) {
      const json = await signalsRes.json();
      const signals = json.data || [];
      if (Array.isArray(signals)) {
        signals.forEach((s: Record<string, unknown>) => {
          entries.push({
            id: `t-${s.id}`,
            type: 'signal' as const,
            message: `New signal: ${(s.title as string) || 'Unknown'}`,
            detail: `${(s.signalType as string) || 'signal'} — severity: ${(s.severity as string) || 'medium'}`,
            timestamp: new Date((s.detectedAt as string) || Date.now()),
          });
        });
      }
    }

    if (activityRes.ok) {
      const json = await activityRes.json();
      const activities = json.data || [];
      if (Array.isArray(activities)) {
        activities.forEach((a: Record<string, unknown>) => {
          const action = (a.action as string) || '';
          let type: TimelineEntry['type'] = 'insight';
          if (action.includes('ingestion') || action.includes('import')) type = 'import';
          else if (action.includes('pipeline')) type = 'pipeline';
          else if (action.includes('briefing')) type = 'briefing';

          entries.push({
            id: `ta-${a.id}`,
            type,
            message: (a.actionLabel as string) || action,
            detail: (a.details as string) || (a.resource as string) || '',
            timestamp: new Date((a.timestamp as string) || Date.now()),
          });
        });
      }
    }

    if (entries.length === 0) return [];

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchChartData(): Promise<
  Array<{ day: string; signals: number; criticals: number }>
> {
  try {
    const res = await fetch('/api/signals/stats?period=7d', { credentials: 'include' });
    if (!res.ok) return [];
    const json = await res.json();
    const dailyTrend = json.data?.dailyTrend;
    if (!Array.isArray(dailyTrend) || dailyTrend.length === 0) return [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dailyTrend.map((d: { date: string; count: number }) => {
      const date = new Date(d.date);
      return {
        day: dayNames[date.getDay()],
        signals: d.count,
        criticals: 0,
      };
    });
  } catch {
    return [];
  }
}

// ── Synchronous empty-data helpers (no fake data — real empty state) ──

export function getMockSignals(): SignalFeedItem[] {
  return [];
}

export function getMockTopOrgs(): TopOrg[] {
  return [];
}

export function getMockTimeline(): TimelineEntry[] {
  return [];
}

export function getMockChartData() {
  return [];
}

export function getMockHealth(): HealthStatus | null {
  return null;
}
