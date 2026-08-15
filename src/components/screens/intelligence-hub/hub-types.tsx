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
// Mock Data
// ═══════════════════════════════════════════════════════════════

export function getMockSignals(): SignalFeedItem[] {
  const now = Date.now();
  return [
    {
      id: 's1',
      signalType: 'risk',
      severity: 'critical',
      title: 'Executive leadership shakeup detected',
      description: 'CFO departure signals potential instability',
      confidenceScore: 92,
      detectedAt: new Date(now - 1000 * 60 * 12).toISOString(),
      organizationName: 'Acme Corp',
      organizationId: 'org-1',
    },
    {
      id: 's2',
      signalType: 'opportunity',
      severity: 'high',
      title: 'Major funding round announced',
      description: 'Series C funding of $85M closed',
      confidenceScore: 88,
      detectedAt: new Date(now - 1000 * 60 * 45).toISOString(),
      organizationName: 'TechCo Industries',
      organizationId: 'org-2',
    },
    {
      id: 's3',
      signalType: 'market',
      severity: 'medium',
      title: 'Market expansion into APAC region',
      description: 'New office openings in Singapore and Tokyo',
      confidenceScore: 76,
      detectedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      organizationName: 'GlobalNet Solutions',
      organizationId: 'org-3',
    },
    {
      id: 's4',
      signalType: 'technology',
      severity: 'high',
      title: 'AI platform launch announced',
      description: 'New enterprise AI product targeting Fortune 500',
      confidenceScore: 84,
      detectedAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
      organizationName: 'NovaTech Solutions',
      organizationId: 'org-4',
    },
    {
      id: 's5',
      signalType: 'financial',
      severity: 'medium',
      title: 'Revenue growth acceleration',
      description: 'Q3 revenue up 34% year-over-year',
      confidenceScore: 79,
      detectedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      organizationName: 'Meridian Fintech',
      organizationId: 'org-5',
    },
    {
      id: 's6',
      signalType: 'regulatory',
      severity: 'low',
      title: 'Compliance certification renewed',
      description: 'ISO 27001 and SOC 2 Type II renewed',
      confidenceScore: 95,
      detectedAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
      organizationName: 'Atlas Cyberdefense',
      organizationId: 'org-6',
    },
    {
      id: 's7',
      signalType: 'growth',
      severity: 'medium',
      title: 'Headcount surge in engineering',
      description: '42 new engineering hires in last 90 days',
      confidenceScore: 72,
      detectedAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
      organizationName: 'Stratoscale AI',
      organizationId: 'org-7',
    },
    {
      id: 's8',
      signalType: 'risk',
      severity: 'high',
      title: 'Patent infringement lawsuit filed',
      description: 'Competitor filed suit in Eastern District of Texas',
      confidenceScore: 81,
      detectedAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
      organizationName: 'DataForge Inc',
      organizationId: 'org-8',
    },
    {
      id: 's9',
      signalType: 'opportunity',
      severity: 'low',
      title: 'Partnership with major cloud provider',
      description: 'AWS Marketplace listing and co-sell agreement',
      confidenceScore: 90,
      detectedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      organizationName: 'CloudPlex Systems',
      organizationId: 'org-9',
    },
    {
      id: 's10',
      signalType: 'technology',
      severity: 'medium',
      title: 'Open source community contribution spike',
      description: 'GitHub stars grew 200% in last quarter',
      confidenceScore: 68,
      detectedAt: new Date(now - 1000 * 60 * 60 * 36).toISOString(),
      organizationName: 'DevStack Labs',
      organizationId: 'org-10',
    },
  ];
}

export function getMockTopOrgs(): TopOrg[] {
  return [
    {
      id: 'org-7',
      name: 'Stratoscale AI',
      industry: 'AI / Machine Learning',
      intelligenceScore: 92,
      signalCount: 14,
      trend: 'up',
      trendValue: 8,
    },
    {
      id: 'org-2',
      name: 'TechCo Industries',
      industry: 'Enterprise Software',
      intelligenceScore: 87,
      signalCount: 11,
      trend: 'up',
      trendValue: 5,
    },
    {
      id: 'org-3',
      name: 'GlobalNet Solutions',
      industry: 'Telecommunications',
      intelligenceScore: 84,
      signalCount: 9,
      trend: 'up',
      trendValue: 3,
    },
    {
      id: 'org-5',
      name: 'Meridian Fintech',
      industry: 'FinTech',
      intelligenceScore: 79,
      signalCount: 7,
      trend: 'neutral',
      trendValue: 0,
    },
    {
      id: 'org-4',
      name: 'NovaTech Solutions',
      industry: 'Cloud SaaS',
      intelligenceScore: 74,
      signalCount: 6,
      trend: 'down',
      trendValue: -2,
    },
  ];
}

export function getMockTimeline(): TimelineEntry[] {
  const now = Date.now();
  return [
    {
      id: 't1',
      type: 'signal',
      message: 'New signal detected for Acme Corp',
      detail: 'Executive leadership shakeup — severity: critical',
      timestamp: new Date(now - 1000 * 60 * 12),
    },
    {
      id: 't2',
      type: 'insight',
      message: 'AI insight generated for TechCo',
      detail: 'Funding round analysis — confidence 88%',
      timestamp: new Date(now - 1000 * 60 * 45),
    },
    {
      id: 't3',
      type: 'pipeline',
      message: 'Intelligence pipeline completed',
      detail: 'Processed 42 organizations, 156 signals',
      timestamp: new Date(now - 1000 * 60 * 60 * 2),
    },
    {
      id: 't4',
      type: 'import',
      message: 'Data import completed — 150 rows',
      detail: 'CRM sync from Salesforce, 0 errors',
      timestamp: new Date(now - 1000 * 60 * 60 * 3),
    },
    {
      id: 't5',
      type: 'signal',
      message: 'New signal detected for NovaTech',
      detail: 'AI platform launch — severity: high',
      timestamp: new Date(now - 1000 * 60 * 60 * 4),
    },
    {
      id: 't6',
      type: 'briefing',
      message: 'Weekly intelligence briefing generated',
      detail: '12 actionable insights across 8 accounts',
      timestamp: new Date(now - 1000 * 60 * 60 * 6),
    },
    {
      id: 't7',
      type: 'insight',
      message: 'AI insight generated for GlobalNet',
      detail: 'Market expansion analysis — confidence 76%',
      timestamp: new Date(now - 1000 * 60 * 60 * 8),
    },
    {
      id: 't8',
      type: 'import',
      message: 'Data import completed — 320 rows',
      detail: 'Enrichment data from Apollo.io, 2 warnings',
      timestamp: new Date(now - 1000 * 60 * 60 * 12),
    },
    {
      id: 't9',
      type: 'pipeline',
      message: 'Intelligence pipeline completed',
      detail: 'Processed 38 organizations, 142 signals',
      timestamp: new Date(now - 1000 * 60 * 60 * 18),
    },
    {
      id: 't10',
      type: 'signal',
      message: 'New signal detected for DataForge',
      detail: 'Patent infringement lawsuit — severity: high',
      timestamp: new Date(now - 1000 * 60 * 60 * 20),
    },
  ];
}

export function getMockChartData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => ({
    day,
    signals: Math.floor(Math.random() * 20) + 8 + (i === 5 ? -5 : 0),
    criticals: Math.floor(Math.random() * 5) + 1,
  }));
}

export function getMockHealth(): HealthStatus {
  return {
    aiProvider: 'operational',
    database: 'operational',
    lastPipelineRun: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    pipelineStatus: 'completed',
    overallStatus: 'healthy',
    uptime: 99.97,
    errors: 0,
  };
}
