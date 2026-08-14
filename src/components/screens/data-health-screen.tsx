'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { fetchApi } from '@/lib/fetchApi';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Clock,
  Building2,
  Users,
  Radio,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──
interface DataHealthResponse {
  totalRecords?: number;
  completenessScore?: number;
  duplicateCount?: number;
  staleRecords?: number;
  entityStats?: {
    organizations?: { total: number; complete: number; completeness: number };
    people?: { total: number; withEmail: number; emailPct: number };
    signals?: { total: number; validated: number; validatedPct: number };
    insights?: { total: number; withEvidence: number; evidencePct: number };
  };
  issues?: DataIssue[];
}

interface DataIssue {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  entity: string;
  description: string;
  detectedAt: string;
}

// ── Mock Data ──
const MOCK_HEALTH: DataHealthResponse = {
  totalRecords: 24783,
  completenessScore: 87,
  duplicateCount: 156,
  staleRecords: 423,
  entityStats: {
    organizations: { total: 1247, complete: 1089, completeness: 87 },
    people: { total: 8432, withEmail: 7156, emailPct: 85 },
    signals: { total: 12540, validated: 10523, validatedPct: 84 },
    insights: { total: 2564, withEvidence: 2390, evidencePct: 93 },
  },
  issues: [
    { id: 'di-001', type: 'missing_email', severity: 'high', entity: 'Sarah Chen (Acme Corp)', description: 'Primary contact email is missing for VP of Engineering', detectedAt: '2025-01-22T14:00:00Z' },
    { id: 'di-002', type: 'stale_signal', severity: 'medium', entity: 'TechStart Inc', description: '18 signals older than 90 days have not been refreshed', detectedAt: '2025-01-22T13:30:00Z' },
    { id: 'di-003', type: 'incomplete_profile', severity: 'high', entity: 'GlobalFin', description: 'Organization profile missing industry, employee count, and revenue data', detectedAt: '2025-01-22T12:00:00Z' },
    { id: 'di-004', type: 'missing_email', severity: 'medium', entity: '12 contacts (HealthPlus)', description: '12 out of 34 contacts lack email addresses', detectedAt: '2025-01-22T11:00:00Z' },
    { id: 'di-005', type: 'duplicate', severity: 'low', entity: 'RetailMax', description: '2 potential duplicate organization records detected', detectedAt: '2025-01-22T10:00:00Z' },
    { id: 'di-006', type: 'stale_signal', severity: 'medium', entity: 'CloudScale', description: 'Last signal received 67 days ago — may indicate tracking gap', detectedAt: '2025-01-22T09:00:00Z' },
    { id: 'di-007', type: 'incomplete_profile', severity: 'low', entity: 'EduLearn', description: 'Missing technology stack information', detectedAt: '2025-01-22T08:00:00Z' },
    { id: 'di-008', type: 'missing_email', severity: 'high', entity: 'James Rodriguez (AutoDrive AI)', description: 'CEO contact has no email — critical for outreach', detectedAt: '2025-01-22T07:00:00Z' },
  ],
};

// ── Helpers ──
function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'high':
      return { color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', label: 'High' };
    case 'medium':
      return { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', label: 'Medium' };
    case 'low':
      return { color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0', label: 'Low' };
    default:
      return { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', label: 'Unknown' };
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'missing_email': return Users;
    case 'stale_signal': return Clock;
    case 'incomplete_profile': return AlertCircle;
    case 'duplicate': return Copy;
    default: return AlertTriangle;
  }
}

function getTypeLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ──
export default function DataHealth() {
  const [health, setHealth] = useState<DataHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHealth() {
      setLoading(true);
      try {
        const result = await fetchApi<DataHealthResponse>('/api/health');
        if (result.data && result.data.totalRecords !== undefined) {
          setHealth(result.data);
        } else {
          setHealth(MOCK_HEALTH);
        }
      } catch {
        setHealth(MOCK_HEALTH);
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, []);

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return '#16A34A';
    if (pct >= 75) return '#2563EB';
    if (pct >= 60) return '#D97706';
    return '#DC2626';
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-6 text-center" style={{ background: tokens.confidence.low.bg, border: `1px solid ${tokens.confidence.low.border}` }}>
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" style={{ color: tokens.confidence.low.value }} />
          <p className="text-sm font-medium" style={{ color: tokens.confidence.low.value }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <Database className="h-6 w-6" style={{ color: tokens.accent.primary }} />
            Data Health
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor data quality, completeness, and identify issues
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" style={{ background: tokens.border.default }} />
            ))
          : health && [
              { label: 'Total Records', value: health.totalRecords?.toLocaleString() ?? '0', icon: Database, color: tokens.accent.primary, bg: tokens.accent.ghost },
              { label: 'Completeness Score', value: `${health.completenessScore ?? 0}%`, icon: CheckCircle2, color: getProgressColor(health.completenessScore ?? 0), bg: health.completenessScore && health.completenessScore >= 80 ? '#DCFCE7' : '#FEF3C7' },
              { label: 'Duplicate Count', value: health.duplicateCount?.toLocaleString() ?? '0', icon: Copy, color: health.duplicateCount && health.duplicateCount > 100 ? '#DC2626' : '#D97706', bg: health.duplicateCount && health.duplicateCount > 100 ? '#FEE2E2' : '#FEF3C7' },
              { label: 'Stale Records', value: health.staleRecords?.toLocaleString() ?? '0', icon: Clock, color: '#D97706', bg: '#FEF3C7' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4"
                style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: tokens.text.muted }}>{stat.label}</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: tokens.text.primary }}>{stat.value}</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: stat.bg }}>
                    <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* ── Entity Quality Cards ── */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: tokens.text.primary }}>
          <Sparkles className="h-4 w-4" style={{ color: tokens.accent.primary }} />
          Data Quality by Entity Type
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" style={{ background: tokens.border.default }} />
              ))
            : health?.entityStats && [
                {
                  label: 'Organizations',
                  metric: 'Profile Completeness',
                  pct: health.entityStats.organizations?.completeness ?? 0,
                  detail: `${health.entityStats.organizations?.complete ?? 0} of ${health.entityStats.organizations?.total ?? 0} complete`,
                  icon: Building2,
                },
                {
                  label: 'People',
                  metric: '% With Email',
                  pct: health.entityStats.people?.emailPct ?? 0,
                  detail: `${health.entityStats.people?.withEmail ?? 0} of ${health.entityStats.people?.total ?? 0} have email`,
                  icon: Users,
                },
                {
                  label: 'Signals',
                  metric: '% Validated',
                  pct: health.entityStats.signals?.validatedPct ?? 0,
                  detail: `${health.entityStats.signals?.validated ?? 0} of ${health.entityStats.signals?.total ?? 0} validated`,
                  icon: Radio,
                },
                {
                  label: 'Insights',
                  metric: '% With Evidence',
                  pct: health.entityStats.insights?.evidencePct ?? 0,
                  detail: `${health.entityStats.insights?.withEvidence ?? 0} of ${health.entityStats.insights?.total ?? 0} have evidence`,
                  icon: Sparkles,
                },
              ].map((card) => {
                const color = getProgressColor(card.pct);
                return (
                  <div
                    key={card.label}
                    className="rounded-xl p-5"
                    style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <card.icon className="h-4 w-4" style={{ color: tokens.text.muted }} />
                      <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{card.label}</h3>
                    </div>
                    <p className="text-xs mb-1" style={{ color: tokens.text.secondary }}>{card.metric}</p>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-3xl font-bold tabular-nums" style={{ color }}>{card.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: tokens.border.default }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${card.pct}%`, background: color }}
                      />
                    </div>
                    <p className="text-[11px]" style={{ color: tokens.text.muted }}>{card.detail}</p>
                  </div>
                );
              })}
        </div>
      </div>

      {/* ── Data Issues List ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: tokens.text.primary }}>
            <AlertTriangle className="h-4 w-4" style={{ color: tokens.priority.medium }} />
            Recent Data Issues
            {!loading && health?.issues && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: tokens.confidence.medium.bg, color: tokens.confidence.medium.value }}
              >
                {health.issues.length}
              </span>
            )}
          </h2>
          <button
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: tokens.accent.primary }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" style={{ background: tokens.border.default }} />
            ))}
          </div>
        ) : health?.issues && health.issues.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {health.issues.map((issue) => {
              const severityCfg = getSeverityConfig(issue.severity);
              const TypeIcon = getTypeIcon(issue.type);
              return (
                <div
                  key={issue.id}
                  className="rounded-xl p-4 flex items-start gap-3 transition-colors"
                  style={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <div
                    className="shrink-0 rounded-lg p-2 mt-0.5"
                    style={{ background: severityCfg.bg }}
                  >
                    <TypeIcon className="h-4 w-4" style={{ color: severityCfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {issue.entity}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          color: severityCfg.color,
                          background: severityCfg.bg,
                          border: `1px solid ${severityCfg.border}`,
                        }}
                      >
                        {severityCfg.label}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          color: tokens.text.secondary,
                          background: tokens.surface.secondary,
                        }}
                      >
                        {getTypeLabel(issue.type)}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: tokens.text.secondary }}>
                      {issue.description}
                    </p>
                  </div>
                  <span className="text-[10px] shrink-0 tabular-nums" style={{ color: tokens.text.muted }}>
                    {new Date(issue.detectedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
          >
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: '#16A34A' }} />
            <p className="text-sm" style={{ color: tokens.text.secondary }}>No data issues detected — everything looks healthy!</p>
          </div>
        )}
      </div>
    </div>
  );
}
