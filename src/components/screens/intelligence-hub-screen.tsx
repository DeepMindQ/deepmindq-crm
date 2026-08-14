'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Radio,
  Brain,
  TrendingUp,
  BarChart3,
  FileText,
  Upload,
  Play,
  Eye,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
  Zap,
  Activity,
  CircleDot,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { fetchApi } from '@/lib/fetchApi';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface SignalFeedItem {
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

interface HealthStatus {
  aiProvider: string;
  database: string;
  lastPipelineRun: string;
  pipelineStatus: string;
  overallStatus: string;
  uptime?: number;
  errors?: number;
}

interface TimelineEntry {
  id: string;
  type: 'signal' | 'insight' | 'import' | 'pipeline' | 'briefing';
  message: string;
  detail: string;
  timestamp: Date;
}

interface TopOrg {
  id: string;
  name: string;
  industry: string;
  intelligenceScore: number;
  signalCount: number;
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
}

interface StatCard {
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

const C = {
  bg: '#0B0F19',
  bgCard: '#111827',
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

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  critical: { color: C.danger, bg: C.dangerGhost, icon: <AlertTriangle className="h-4 w-4" /> },
  high: { color: '#F97316', bg: 'rgba(249, 115, 22, 0.1)', icon: <AlertTriangle className="h-4 w-4" /> },
  medium: { color: C.warning, bg: C.warningGhost, icon: <CircleDot className="h-4 w-4" /> },
  low: { color: C.success, bg: C.successGhost, icon: <CheckCircle2 className="h-4 w-4" /> },
};

const SIGNAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
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

function timeAgo(dateStr: string): string {
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

function formatTimestamp(date: Date): string {
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

function getMockSignals(): SignalFeedItem[] {
  const now = Date.now();
  return [
    { id: 's1', signalType: 'risk', severity: 'critical', title: 'Executive leadership shakeup detected', description: 'CFO departure signals potential instability', confidenceScore: 92, detectedAt: new Date(now - 1000 * 60 * 12).toISOString(), organizationName: 'Acme Corp', organizationId: 'org-1' },
    { id: 's2', signalType: 'opportunity', severity: 'high', title: 'Major funding round announced', description: 'Series C funding of $85M closed', confidenceScore: 88, detectedAt: new Date(now - 1000 * 60 * 45).toISOString(), organizationName: 'TechCo Industries', organizationId: 'org-2' },
    { id: 's3', signalType: 'market', severity: 'medium', title: 'Market expansion into APAC region', description: 'New office openings in Singapore and Tokyo', confidenceScore: 76, detectedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(), organizationName: 'GlobalNet Solutions', organizationId: 'org-3' },
    { id: 's4', signalType: 'technology', severity: 'high', title: 'AI platform launch announced', description: 'New enterprise AI product targeting Fortune 500', confidenceScore: 84, detectedAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(), organizationName: 'NovaTech Solutions', organizationId: 'org-4' },
    { id: 's5', signalType: 'financial', severity: 'medium', title: 'Revenue growth acceleration', description: 'Q3 revenue up 34% year-over-year', confidenceScore: 79, detectedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(), organizationName: 'Meridian Fintech', organizationId: 'org-5' },
    { id: 's6', signalType: 'regulatory', severity: 'low', title: 'Compliance certification renewed', description: 'ISO 27001 and SOC 2 Type II renewed', confidenceScore: 95, detectedAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(), organizationName: 'Atlas Cyberdefense', organizationId: 'org-6' },
    { id: 's7', signalType: 'growth', severity: 'medium', title: 'Headcount surge in engineering', description: '42 new engineering hires in last 90 days', confidenceScore: 72, detectedAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(), organizationName: 'Stratoscale AI', organizationId: 'org-7' },
    { id: 's8', signalType: 'risk', severity: 'high', title: 'Patent infringement lawsuit filed', description: 'Competitor filed suit in Eastern District of Texas', confidenceScore: 81, detectedAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(), organizationName: 'DataForge Inc', organizationId: 'org-8' },
    { id: 's9', signalType: 'opportunity', severity: 'low', title: 'Partnership with major cloud provider', description: 'AWS Marketplace listing and co-sell agreement', confidenceScore: 90, detectedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(), organizationName: 'CloudPlex Systems', organizationId: 'org-9' },
    { id: 's10', signalType: 'technology', severity: 'medium', title: 'Open source community contribution spike', description: 'GitHub stars grew 200% in last quarter', confidenceScore: 68, detectedAt: new Date(now - 1000 * 60 * 60 * 36).toISOString(), organizationName: 'DevStack Labs', organizationId: 'org-10' },
  ];
}

function getMockTopOrgs(): TopOrg[] {
  return [
    { id: 'org-7', name: 'Stratoscale AI', industry: 'AI / Machine Learning', intelligenceScore: 92, signalCount: 14, trend: 'up', trendValue: 8 },
    { id: 'org-2', name: 'TechCo Industries', industry: 'Enterprise Software', intelligenceScore: 87, signalCount: 11, trend: 'up', trendValue: 5 },
    { id: 'org-3', name: 'GlobalNet Solutions', industry: 'Telecommunications', intelligenceScore: 84, signalCount: 9, trend: 'up', trendValue: 3 },
    { id: 'org-5', name: 'Meridian Fintech', industry: 'FinTech', intelligenceScore: 79, signalCount: 7, trend: 'neutral', trendValue: 0 },
    { id: 'org-4', name: 'NovaTech Solutions', industry: 'Cloud SaaS', intelligenceScore: 74, signalCount: 6, trend: 'down', trendValue: -2 },
  ];
}

function getMockTimeline(): TimelineEntry[] {
  const now = Date.now();
  return [
    { id: 't1', type: 'signal', message: 'New signal detected for Acme Corp', detail: 'Executive leadership shakeup — severity: critical', timestamp: new Date(now - 1000 * 60 * 12) },
    { id: 't2', type: 'insight', message: 'AI insight generated for TechCo', detail: 'Funding round analysis — confidence 88%', timestamp: new Date(now - 1000 * 60 * 45) },
    { id: 't3', type: 'pipeline', message: 'Intelligence pipeline completed', detail: 'Processed 42 organizations, 156 signals', timestamp: new Date(now - 1000 * 60 * 60 * 2) },
    { id: 't4', type: 'import', message: 'Data import completed — 150 rows', detail: 'CRM sync from Salesforce, 0 errors', timestamp: new Date(now - 1000 * 60 * 60 * 3) },
    { id: 't5', type: 'signal', message: 'New signal detected for NovaTech', detail: 'AI platform launch — severity: high', timestamp: new Date(now - 1000 * 60 * 60 * 4) },
    { id: 't6', type: 'briefing', message: 'Weekly intelligence briefing generated', detail: '12 actionable insights across 8 accounts', timestamp: new Date(now - 1000 * 60 * 60 * 6) },
    { id: 't7', type: 'insight', message: 'AI insight generated for GlobalNet', detail: 'Market expansion analysis — confidence 76%', timestamp: new Date(now - 1000 * 60 * 60 * 8) },
    { id: 't8', type: 'import', message: 'Data import completed — 320 rows', detail: 'Enrichment data from Apollo.io, 2 warnings', timestamp: new Date(now - 1000 * 60 * 60 * 12) },
    { id: 't9', type: 'pipeline', message: 'Intelligence pipeline completed', detail: 'Processed 38 organizations, 142 signals', timestamp: new Date(now - 1000 * 60 * 60 * 18) },
    { id: 't10', type: 'signal', message: 'New signal detected for DataForge', detail: 'Patent infringement lawsuit — severity: high', timestamp: new Date(now - 1000 * 60 * 60 * 20) },
  ];
}

function getMockChartData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => ({
    day,
    signals: Math.floor(Math.random() * 20) + 8 + (i === 5 ? -5 : 0),
    criticals: Math.floor(Math.random() * 5) + 1,
  }));
}

function getMockHealth(): HealthStatus {
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

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function StatCardWidget({ stat }: { stat: StatCard }) {
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl transition-colors duration-200"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bgCardHover;
        (e.currentTarget as HTMLElement).style.borderColor = C.borderLight;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bgCard;
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-lg"
          style={{ background: stat.accentBg, color: stat.accentColor }}
        >
          {stat.icon}
        </div>
        <div className="flex items-center gap-1">
          {stat.change > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" style={{ color: C.success }} />
          ) : stat.change < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" style={{ color: C.danger }} />
          ) : null}
          <span
            className="text-xs font-medium"
            style={{
              color: stat.change > 0 ? C.success : stat.change < 0 ? C.danger : C.textMuted,
            }}
          >
            {stat.change > 0 ? '+' : ''}
            {stat.change}%
          </span>
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: C.textPrimary }}>
          {stat.value}
        </div>
        <div className="text-xs mt-0.5" style={{ color: C.textSecondary }}>
          {stat.label}
        </div>
      </div>
    </div>
  );
}

function CircularProgress({ value, size = 56, strokeWidth = 5 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (v: number) => {
    if (v >= 80) return C.success;
    if (v >= 60) return C.accent;
    if (v >= 40) return C.warning;
    return C.danger;
  };

  const color = getColor(value);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.border}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function SignalFeedCard({
  signal,
  onClick,
}: {
  signal: SignalFeedItem;
  onClick: (_sig: SignalFeedItem) => void;
}) {
  const severityCfg = SEVERITY_CONFIG[signal.severity] || SEVERITY_CONFIG.low;
  const typeCfg = SIGNAL_TYPE_COLORS[signal.signalType] || { color: C.textSecondary, bg: C.accentGhost };

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 group"
      style={{
        background: 'transparent',
        border: `1px solid transparent`,
      }}
      onClick={() => onClick(signal)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bgCardHover;
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
      }}
    >
      <div
        className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5"
        style={{ background: severityCfg.bg, color: severityCfg.color }}
      >
        {severityCfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate" style={{ color: C.textPrimary }}>
            {signal.title}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.textMuted }} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {signal.organizationName && (
            <span className="text-xs" style={{ color: C.textSecondary }}>
              {signal.organizationName}
            </span>
          )}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
            style={{ color: typeCfg.color, background: typeCfg.bg }}
          >
            {signal.signalType}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: C.textMuted }}>
            <Clock className="h-3 w-3" />
            {timeAgo(signal.detectedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const iconMap: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    signal: { icon: <Radio className="h-3.5 w-3.5" />, color: C.accent, bg: C.accentGhost },
    insight: { icon: <Brain className="h-3.5 w-3.5" />, color: C.purple, bg: C.purpleGhost },
    import: { icon: <Database className="h-3.5 w-3.5" />, color: C.cyan, bg: C.cyanGhost },
    pipeline: { icon: <RefreshCw className="h-3.5 w-3.5" />, color: C.success, bg: C.successGhost },
    briefing: { icon: <FileText className="h-3.5 w-3.5" />, color: C.gold, bg: C.goldGhost },
  };
  const cfg = iconMap[entry.type] || iconMap.signal;

  return (
    <div className="flex items-start gap-3 py-2.5 group">
      <div
        className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: C.textPrimary }}>
          {entry.message}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>
          {entry.detail}
        </div>
      </div>
      <span className="text-[11px] shrink-0 mt-0.5" style={{ color: C.textMuted }}>
        {formatTimestamp(entry.timestamp)}
      </span>
    </div>
  );
}

function HealthIndicator({ health, loading }: { health: HealthStatus | null; loading: boolean }) {
  const statusMap: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    operational: { color: C.success, bg: C.successGhost, icon: <CheckCircle2 className="h-4 w-4" />, label: 'Operational' },
    healthy: { color: C.success, bg: C.successGhost, icon: <ShieldCheck className="h-4 w-4" />, label: 'Healthy' },
    degraded: { color: C.warning, bg: C.warningGhost, icon: <AlertTriangle className="h-4 w-4" />, label: 'Degraded' },
    down: { color: C.danger, bg: C.dangerGhost, icon: <XCircle className="h-4 w-4" />, label: 'Down' },
  };

  const aiStatus = statusMap[health?.aiProvider || 'operational'];
  const dbStatus = statusMap[health?.database || 'operational'];
  const overallStatus = statusMap[health?.overallStatus || 'healthy'];
  const pipelineTime = health?.lastPipelineRun ? timeAgo(health.lastPipelineRun) : 'Never';

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: overallStatus.color }} />
          <span className="text-sm font-semibold" style={{ color: C.textPrimary }}>
            System Health
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: overallStatus.bg }}>
          <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: overallStatus.color }} />
          <span className="text-[11px] font-semibold" style={{ color: overallStatus.color }}>
            {overallStatus.label}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full rounded" style={{ background: C.border }} />
          <Skeleton className="h-4 w-3/4 rounded" style={{ background: C.border }} />
          <Skeleton className="h-4 w-2/3 rounded" style={{ background: C.border }} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <span className="text-xs" style={{ color: C.textSecondary }}>AI Provider</span>
            </div>
            <div className="flex items-center gap-1.5">
              {aiStatus.icon}
              <span className="text-xs font-medium" style={{ color: aiStatus.color }}>{aiStatus.label}</span>
            </div>
          </div>
          <div
            className="w-full h-px"
            style={{ background: C.border }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <span className="text-xs" style={{ color: C.textSecondary }}>Database</span>
            </div>
            <div className="flex items-center gap-1.5">
              {dbStatus.icon}
              <span className="text-xs font-medium" style={{ color: dbStatus.color }}>{dbStatus.label}</span>
            </div>
          </div>
          <div
            className="w-full h-px"
            style={{ background: C.border }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <span className="text-xs" style={{ color: C.textSecondary }}>Last Pipeline Run</span>
            </div>
            <span className="text-xs font-medium" style={{ color: C.textSecondary }}>{pipelineTime}</span>
          </div>
          {health?.uptime !== undefined && (
            <>
              <div
                className="w-full h-px"
                style={{ background: C.border }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
                  <span className="text-xs" style={{ color: C.textSecondary }}>Uptime (30d)</span>
                </div>
                <span className="text-xs font-medium" style={{ color: C.success }}>{health.uptime}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: React.ReactNode;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold" style={{ color: C.textPrimary }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Custom Recharts Tooltip
// ═══════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
      }}
    >
      <p className="text-xs font-medium mb-1.5" style={{ color: C.textSecondary }}>{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: C.textPrimary }}>{entry.name}: </span>
          <span className="font-semibold" style={{ color: C.textPrimary }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}/* eslint-enable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function IntelligenceHub() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setSelectedCompanyId = useAppStore((s) => s.setSelectedCompanyId);

  // ── Data Fetching ──
  const { data: signalsData, isLoading: signalsLoading } = useQuery({
    queryKey: ['signals-feed', 10],
    queryFn: async () => {
      const result = await fetchApi<SignalFeedItem[]>('/api/signals', { params: { limit: 10 } });
      return result.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const result = await fetchApi<HealthStatus>('/api/health');
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Use fetched data or fall back to mock
  const signals = signalsData || getMockSignals();
  const health = healthData || getMockHealth();

  // Derived / mock data
  const stats: StatCard[] = [
    {
      label: 'Total Organizations',
      value: '2,847',
      change: 12,
      changeLabel: 'vs last month',
      icon: <Building2 className="h-4 w-4" />,
      accentColor: C.accent,
      accentBg: C.accentGhost,
    },
    {
      label: 'Active Signals',
      value: '156',
      change: 23,
      changeLabel: 'vs last week',
      icon: <Radio className="h-4 w-4" />,
      accentColor: C.danger,
      accentBg: C.dangerGhost,
    },
    {
      label: 'AI Insights Generated',
      value: '1,234',
      change: 18,
      changeLabel: 'vs last week',
      icon: <Brain className="h-4 w-4" />,
      accentColor: C.purple,
      accentBg: C.purpleGhost,
    },
    {
      label: 'Avg Intelligence Score',
      value: '73.2',
      change: 4,
      changeLabel: 'vs last month',
      icon: <TrendingUp className="h-4 w-4" />,
      accentColor: C.success,
      accentBg: C.successGhost,
    },
    {
      label: 'Data Completeness',
      value: '86%',
      change: 3,
      changeLabel: 'vs last month',
      icon: <Layers className="h-4 w-4" />,
      accentColor: C.cyan,
      accentBg: C.cyanGhost,
    },
    {
      label: 'Active Briefings',
      value: '12',
      change: -2,
      changeLabel: 'vs last week',
      icon: <FileText className="h-4 w-4" />,
      accentColor: C.gold,
      accentBg: C.goldGhost,
    },
  ];

  const topOrgs = getMockTopOrgs();
  const timeline = getMockTimeline();
  const [chartData] = useState(getMockChartData);

  const criticalSignalCount = signals.filter((s) => s.severity === 'critical').length;

  // ── Handlers ──
  const handleSignalClick = useCallback(
    (signal: SignalFeedItem) => {
      if (signal.organizationId) {
        setSelectedCompanyId(signal.organizationId);
        setActiveView('company-detail');
        toast.info(`Opening signal: ${signal.title}`);
      }
    },
    [setActiveView, setSelectedCompanyId],
  );

  const handleOrgClick = useCallback(
    (org: TopOrg) => {
      setSelectedCompanyId(org.id);
      setActiveView('company-detail');
      toast.info(`Opening workspace: ${org.name}`);
    },
    [setActiveView, setSelectedCompanyId],
  );

  const handleQuickAction = useCallback(
    (action: string) => {
      const actionMap: Record<string, { view: string; message: string }> = {
        import: { view: 'import', message: 'Opening Data Import...' },
        pipeline: { view: 'ai-health', message: 'Intelligence pipeline triggered...' },
        signals: { view: 'signal-intelligence', message: 'Viewing all signals...' },
        briefing: { view: 'intelligence-briefing', message: 'Generating intelligence briefing...' },
      };
      const cfg = actionMap[action];
      if (cfg) {
        setActiveView(cfg.view as any);
        toast.success(cfg.message);
      }
    },
    [setActiveView],
  );

  // ── Render ──
  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          {/* ═══ Page Header ═══ */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: C.textPrimary }}>
                Intelligence Hub
              </h1>
              <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
                Real-time overview of all intelligence operations and signals
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: C.successGhost }}>
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.success }} />
                <span className="text-[11px] font-semibold" style={{ color: C.success }}>Live</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
                    style={{ border: `1px solid ${C.border}`, color: C.textSecondary }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = C.bgCardHover;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" style={{ background: C.bgCard, border: `1px solid ${C.border}` }}>
                  <p className="text-xs" style={{ color: C.textPrimary }}>Refresh data</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ═══ 1. Top Stats Row ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div>
                    <StatCardWidget stat={stat} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" style={{ background: C.bgCard, border: `1px solid ${C.border}` }}>
                  <p className="text-xs" style={{ color: C.textSecondary }}>
                    {stat.changeLabel}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* ═══ 5. Quick Actions Bar ═══ */}
          <div
            className="rounded-xl p-4 flex flex-wrap items-center gap-3"
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
            }}
          >
            <span className="text-xs font-semibold mr-1" style={{ color: C.textMuted }}>
              QUICK ACTIONS
            </span>
            <div className="w-px h-5" style={{ background: C.border }} />
            <Button
              size="sm"
              onClick={() => handleQuickAction('import')}
              className="gap-2 text-xs font-medium rounded-lg h-8 px-3"
              style={{
                background: C.accentGhost,
                color: C.accent,
                border: `1px solid rgba(59, 130, 246, 0.2)`,
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              Import Data
            </Button>
            <Button
              size="sm"
              onClick={() => handleQuickAction('pipeline')}
              className="gap-2 text-xs font-medium rounded-lg h-8 px-3"
              style={{
                background: C.purpleGhost,
                color: C.purple,
                border: `1px solid rgba(139, 92, 246, 0.2)`,
              }}
            >
              <Play className="h-3.5 w-3.5" />
              Run Intelligence Pipeline
            </Button>
            <Button
              size="sm"
              onClick={() => handleQuickAction('signals')}
              className="gap-2 text-xs font-medium rounded-lg h-8 px-3"
              style={{
                background: C.warningGhost,
                color: C.warning,
                border: `1px solid rgba(245, 158, 11, 0.2)`,
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              View All Signals
            </Button>
            <Button
              size="sm"
              onClick={() => handleQuickAction('briefing')}
              className="gap-2 text-xs font-medium rounded-lg h-8 px-3"
              style={{
                background: C.cyanGhost,
                color: C.cyan,
                border: `1px solid rgba(6, 182, 212, 0.2)`,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate Briefing
            </Button>
          </div>

          {/* ═══ Main Grid ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── Left Column ── */}
            <div className="lg:col-span-7 space-y-6">
              {/* ═══ 2. Recent Signals Feed ═══ */}
              <div
                className="rounded-xl"
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div className="px-4 pt-4 pb-2">
                  <SectionHeader
                    title={
                      <span className="flex items-center gap-2">
                        Recent Signals
                        {criticalSignalCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: C.dangerGhost, color: C.danger }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.danger }} />
                            {criticalSignalCount} critical
                          </span>
                        )}
                      </span>
                    }
                    icon={<Radio className="h-4 w-4" style={{ color: C.accent }} />}
                    action={
                      <button
                        className="flex items-center gap-1 text-xs font-medium transition-colors"
                        style={{ color: C.accent }}
                        onClick={() => handleQuickAction('signals')}
                      >
                        View all
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    }
                  />
                </div>

                <div className="px-3 pb-3 max-h-[480px] overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
                  {signalsLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skeleton-signal-${i}`} className="flex items-center gap-3 p-3">
                        <Skeleton className="h-8 w-8 rounded-lg shrink-0" style={{ background: C.border }} />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3.5 w-3/4 rounded" style={{ background: C.border }} />
                          <Skeleton className="h-3 w-1/2 rounded" style={{ background: C.border }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    signals.map((signal) => (
                      <SignalFeedCard key={signal.id} signal={signal} onClick={handleSignalClick} />
                    ))
                  )}
                </div>
              </div>

              {/* ═══ 4. Intelligence Activity Timeline ═══ */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                }}
              >
                <SectionHeader
                  title="Activity Timeline"
                  icon={<Activity className="h-4 w-4" style={{ color: C.success }} />}
                />
                <div className="max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
                  <div>
                    {timeline.map((entry, idx) => (
                      <div key={entry.id}>
                        {idx > 0 && (
                          <div className="flex items-center gap-3">
                            <div className="w-7 flex justify-center">
                              <div className="w-px h-2" style={{ background: C.border }} />
                            </div>
                            <div className="flex-1">
                              <div className="h-px" style={{ background: C.border }} />
                            </div>
                            <div className="w-16" />
                          </div>
                        )}
                        <TimelineItem entry={entry} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column ── */}
            <div className="lg:col-span-5 space-y-6">
              {/* ═══ 3. Top Organizations ═══ */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                }}
              >
                <SectionHeader
                  title="Top Organizations"
                  icon={<Building2 className="h-4 w-4" style={{ color: C.purple }} />}
                  action={
                    <button
                      className="flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: C.accent }}
                      onClick={() => setActiveView('accounts')}
                    >
                      View all
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  }
                />

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
                  {topOrgs.map((org, idx) => (
                    <div
                      key={org.id}
                      className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all duration-150 group"
                      style={{
                        border: `1px solid transparent`,
                      }}
                      onClick={() => handleOrgClick(org)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = C.bgCardHover;
                        (e.currentTarget as HTMLElement).style.borderColor = C.border;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                      }}
                    >
                      {/* Rank Badge */}
                      <div
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold shrink-0"
                        style={{
                          background: idx === 0 ? C.goldGhost : C.accentGhost,
                          color: idx === 0 ? C.gold : C.textMuted,
                        }}
                      >
                        {idx + 1}
                      </div>

                      {/* Org Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: C.textPrimary }}>
                            {org.name}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.textMuted }} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px]" style={{ color: C.textMuted }}>
                            {org.industry}
                          </span>
                          <span className="text-[11px]" style={{ color: C.textMuted }}>
                            ·
                          </span>
                          <span className="text-[11px]" style={{ color: C.textMuted }}>
                            {org.signalCount} signals
                          </span>
                          {org.trend !== 'neutral' && (
                            <>
                              <span className="text-[11px]" style={{ color: C.textMuted }}>
                                ·
                              </span>
                              <span
                                className="flex items-center gap-0.5 text-[11px] font-medium"
                                style={{
                                  color: org.trend === 'up' ? C.success : C.danger,
                                }}
                              >
                                {org.trend === 'up' ? (
                                  <ArrowUpRight className="h-3 w-3" />
                                ) : (
                                  <ArrowDownRight className="h-3 w-3" />
                                )}
                                {Math.abs(org.trendValue)}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Circular Progress */}
                      <CircularProgress value={org.intelligenceScore} size={48} strokeWidth={4} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ═══ 7. Signals Over Time Chart ═══ */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                }}
              >
                <SectionHeader
                  title="Signals Over Time"
                  icon={<BarChart3 className="h-4 w-4" style={{ color: C.cyan }} />}
                  action={
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: C.accentGhost, color: C.accent }}>
                      Last 7 days
                    </span>
                  }
                />

                <div className="h-[200px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="signalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.danger} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={C.danger} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: C.textMuted, fontSize: 11 }}
                        axisLine={{ stroke: C.border }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: C.textMuted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        content={<ChartTooltipContent />}
                        cursor={{
                          stroke: C.border,
                          strokeDasharray: '3 3',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="signals"
                        stroke={C.accent}
                        strokeWidth={2}
                        fill="url(#signalGradient)"
                        name="All Signals"
                      />
                      <Area
                        type="monotone"
                        dataKey="criticals"
                        stroke={C.danger}
                        strokeWidth={2}
                        fill="url(#criticalGradient)"
                        name="Critical"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart legend */}
                <div className="flex items-center justify-center gap-6 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
                    <span className="text-[11px]" style={{ color: C.textSecondary }}>All Signals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: C.danger }} />
                    <span className="text-[11px]" style={{ color: C.textSecondary }}>Critical</span>
                  </div>
                </div>
              </div>

              {/* ═══ 6. Intelligence Health Indicator ═══ */}
              <HealthIndicator health={health} loading={healthLoading} />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
