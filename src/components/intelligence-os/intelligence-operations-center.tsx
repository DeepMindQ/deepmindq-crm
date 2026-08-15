'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  PulseDot,
  GlassPanel,
} from '@/components/ui/animated-components';
import {
  Radar,
  Shield,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  GitBranch,
  FileText,
  Building2,
  UserMinus,
  Cpu,
  Handshake,
  RefreshCw,
  Clock,
  Search,
  Zap,
  Target,
  MessageSquare,
  Eye,
  XCircle,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type FilterKey = 'ALL' | Severity;

interface IntelligenceSignal {
  id: string;
  type: string;
  icon: React.ComponentType<{ className?: string; color?: string }>;
  severity: Severity;
  source: string;
  description: string;
  timestamp: string;
  status: 'investigating' | 'analyzed' | undefined;
}

interface PipelineEngine {
  id: string;
  name: string;
  shortName: string;
  status: 'active' | 'degraded' | 'down';
  itemsProcessed: number;
  latency: string;
}

interface TeamAction {
  initials: string;
  name: string;
  action: string;
  timestamp: string;
}

interface CoverageDomain {
  domain: string;
  completeness: number;
  color: string;
}

/* ── API response types ── */

interface ApiSignal {
  id: string;
  signalType: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  detectedAt: string;
  source: string;
  sourceLabel: string | null;
  organization: {
    name: string;
    domain: string | null;
    industry: string | null;
  } | null;
  evidence: unknown[];
}

interface ApiPipelineEngine {
  id: string;
  name: string;
  feature: string;
  status: 'active' | 'degraded' | 'down';
  latency: number;
  throughput: number;
  accuracy: number;
  uptime: number;
}

interface ApiTeamActivity {
  id: string;
  user: { name: string; email: string } | null;
  action: string;
  actionLabel: string;
  icon: string;
  resource: string | null;
  details: string | null;
  timestamp: string;
}

interface ApiOrganization {
  id: string;
  name: string;
  industry: string | null;
  intelligenceScore: number | null;
}

/* ═══════════════════════════════════════════════════════════
   Severity Config
   ═══════════════════════════════════════════════════════════ */

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
  HIGH: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  MEDIUM: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' },
  LOW: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' },
};

/* ═══════════════════════════════════════════════════════════
   Pipeline Status Helpers
   ═══════════════════════════════════════════════════════════ */

const PIPELINE_STATUS: Record<string, { color: string; label: string; dotColor: string }> = {
  active: { color: '#10B981', label: 'Active', dotColor: '#10B981' },
  degraded: { color: '#F59E0B', label: 'Degraded', dotColor: '#F59E0B' },
  down: { color: '#EF4444', label: 'Down', dotColor: '#EF4444' },
};

/* ═══════════════════════════════════════════════════════════
   Filter Options
   ═══════════════════════════════════════════════════════════ */

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const signalIconMap: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  funding: DollarSign,
  funding_event: DollarSign,
  hiring: Users,
  hiring_change: Users,
  tech_stack_change: GitBranch,
  technology_change: Cpu,
  m_a: Building2,
  leadership_change: UserMinus,
  exec_departure: UserMinus,
  patent: FileText,
  partnership: Handshake,
  technology: Cpu,
  market: TrendingUp,
  market_expansion: TrendingUp,
  competitor_move: Target,
  financial_indicator: DollarSign,
  product_launch: Zap,
  regulatory: Shield,
  customer_signal: Users,
  social_mention: MessageSquare,
};

const severityNormalize = (s: string): Severity => {
  const upper = s.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW')
    return upper;
  return 'MEDIUM';
};

const DOMAIN_COLORS: Record<string, string> = {
  Technology: '#3B82F6',
  Financial: '#10B981',
  Legal: '#8B5CF6',
  Market: '#F59E0B',
  Competitive: '#EF4444',
  Regulatory: '#06B6D4',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return '';
  }
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export function IntelligenceOperationsCenter() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);
  const [coverageDomains, setCoverageDomains] = useState<CoverageDomain[]>([]);
  const [pipelineEngines, setPipelineEngines] = useState<PipelineEngine[]>([]);
  const [teamActions, setTeamActions] = useState<TeamAction[]>([]);
  const [investigatingIds, setInvestigatingIds] = useState<Set<string>>(new Set());

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [signalsRes, orgsRes, pipelineRes, teamRes] = await Promise.all([
          fetchApi<ApiSignal[]>('/api/signals', { params: { limit: 50 } }),
          fetchApi<ApiOrganization[]>('/api/organizations', { params: { limit: 10 } }),
          fetchApi<ApiPipelineEngine[]>('/api/pipeline-engines'),
          fetchApi<ApiTeamActivity[]>('/api/team-activity', { params: { limit: 15 } }),
        ]);

        if (cancelled) return;

        // Map API signals to local IntelligenceSignal type
        if (!signalsRes.error && signalsRes.data?.length) {
          const mapped: IntelligenceSignal[] = signalsRes.data.map((s: ApiSignal) => ({
            id: s.id,
            type: s.title || s.signalType || 'Signal',
            icon: signalIconMap[s.signalType] || Radar,
            severity: severityNormalize(s.severity || 'medium'),
            source: s.organization?.name || s.sourceLabel || s.source || 'System',
            description: s.description || '',
            timestamp: s.detectedAt ? formatRelativeTime(s.detectedAt) : '',
            status: undefined,
          }));
          setSignals(mapped);
        }

        // Derive coverage domains from organization industries
        if (!orgsRes.error && orgsRes.data?.length) {
          const orgs = orgsRes.data;
          const industryMap = new Map<string, number[]>();
          orgs.forEach((o) => {
            const ind = o.industry || 'Other';
            if (!industryMap.has(ind)) industryMap.set(ind, []);
            industryMap.get(ind)!.push(o.intelligenceScore ?? 0);
          });
          const domains: CoverageDomain[] = Array.from(industryMap.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 6)
            .map(([domain, scores]) => ({
              domain,
              completeness: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              color: DOMAIN_COLORS[domain] || '#8892A8',
            }));
          if (domains.length > 0) setCoverageDomains(domains);
        }

        // Map pipeline engines from API
        if (!pipelineRes.error && pipelineRes.data?.length) {
          const engines: PipelineEngine[] = (pipelineRes.data ?? []).map((e: ApiPipelineEngine) => {
            const words = e.name.split(' ');
            const shortName = words
              .filter((w: string) => !['and', 'the', 'of', 'for'].includes(w.toLowerCase()))
              .map((w: string) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 3);
            return {
              id: e.id,
              name: e.name,
              shortName: shortName || e.feature.slice(0, 3).toUpperCase(),
              status: e.status,
              itemsProcessed: e.throughput,
              latency: e.latency > 0 ? `${e.latency}ms` : '—',
            };
          });
          setPipelineEngines(engines);
        }

        // Map team activity from API
        if (!teamRes.error && teamRes.data?.length) {
          const actions: TeamAction[] = (teamRes.data ?? []).map((a: ApiTeamActivity) => ({
            initials: a.user ? getInitials(a.user.name) : '??',
            name: a.user?.name || 'Unknown',
            action: a.actionLabel || a.action,
            timestamp: a.timestamp ? formatRelativeTime(a.timestamp) : '',
          }));
          setTeamActions(actions);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load operations data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Simulated clock for "last updated"
  useEffect(() => {
    const now = new Date();
    setLastUpdated(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
  }, []);

  const filteredSignals =
    activeFilter === 'ALL' ? signals : signals.filter((s) => s.severity === activeFilter);

  const handleRefresh = useCallback(async () => {
    const now = new Date();
    setLastUpdated(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
    // Re-fetch all data
    setLoading(true);
    setError(null);
    try {
      const [signalsRes, orgsRes, pipelineRes, teamRes] = await Promise.all([
        fetchApi<ApiSignal[]>('/api/signals', { params: { limit: 50 } }),
        fetchApi<ApiOrganization[]>('/api/organizations', { params: { limit: 10 } }),
        fetchApi<ApiPipelineEngine[]>('/api/pipeline-engines'),
        fetchApi<ApiTeamActivity[]>('/api/team-activity', { params: { limit: 15 } }),
      ]);

      if (!signalsRes.error && signalsRes.data?.length) {
        const mapped: IntelligenceSignal[] = signalsRes.data.map((s: ApiSignal) => ({
          id: s.id,
          type: s.title || s.signalType || 'Signal',
          icon: signalIconMap[s.signalType] || Radar,
          severity: severityNormalize(s.severity || 'medium'),
          source: s.organization?.name || s.sourceLabel || s.source || 'System',
          description: s.description || '',
          timestamp: s.detectedAt ? formatRelativeTime(s.detectedAt) : '',
          status: undefined,
        }));
        setSignals(mapped);
      }

      if (!orgsRes.error && orgsRes.data?.length) {
        const orgs = orgsRes.data;
        const industryMap = new Map<string, number[]>();
        orgs.forEach((o) => {
          const ind = o.industry || 'Other';
          if (!industryMap.has(ind)) industryMap.set(ind, []);
          industryMap.get(ind)!.push(o.intelligenceScore ?? 0);
        });
        const domains: CoverageDomain[] = Array.from(industryMap.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 6)
          .map(([domain, scores]) => ({
            domain,
            completeness: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            color: DOMAIN_COLORS[domain] || '#8892A8',
          }));
        if (domains.length > 0) setCoverageDomains(domains);
      }

      if (!pipelineRes.error && pipelineRes.data?.length) {
        const engines: PipelineEngine[] = (pipelineRes.data ?? []).map((e: ApiPipelineEngine) => {
          const words = e.name.split(' ');
          const shortName = words
            .filter((w: string) => !['and', 'the', 'of', 'for'].includes(w.toLowerCase()))
            .map((w: string) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 3);
          return {
            id: e.id,
            name: e.name,
            shortName: shortName || e.feature.slice(0, 3).toUpperCase(),
            status: e.status,
            itemsProcessed: e.throughput,
            latency: e.latency > 0 ? `${e.latency}ms` : '—',
          };
        });
        setPipelineEngines(engines);
      }

      if (!teamRes.error && teamRes.data?.length) {
        const actions: TeamAction[] = (teamRes.data ?? []).map((a: ApiTeamActivity) => ({
          initials: a.user ? getInitials(a.user.name) : '??',
          name: a.user?.name || 'Unknown',
          action: a.actionLabel || a.action,
          timestamp: a.timestamp ? formatRelativeTime(a.timestamp) : '',
        }));
        setTeamActions(actions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInvestigate = useCallback(async (signalId: string) => {
    setInvestigatingIds((prev) => new Set(prev).add(signalId));
    const res = await fetchApi(`/api/signals/${signalId}/investigate`, { method: 'POST' });
    if (!res.error) {
      setSignals((prev) =>
        prev.map((s) => (s.id === signalId ? { ...s, status: 'analyzed' as const } : s)),
      );
    }
    setInvestigatingIds((prev) => {
      const next = new Set(prev);
      next.delete(signalId);
      return next;
    });
  }, []);

  const handleDismiss = useCallback(async (signalId: string) => {
    const res = await fetchApi(`/api/signals/${signalId}/dismiss`, { method: 'POST' });
    if (!res.error) {
      setSignals((prev) => prev.filter((s) => s.id !== signalId));
    }
  }, []);

  return (
    <PageTransition className="h-full">
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
              Loading operations center…
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-4">
          <span
            className="text-xs px-4 py-2 rounded-lg"
            style={{
              color: '#F59E0B',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            ⚠ {error}
          </span>
        </div>
      )}
      {!loading && (
        <div className="h-full flex flex-col gap-5 p-6 overflow-auto">
          {/* ── Header Row ── */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="h-7 w-1.5 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #93C5FD, #3B82F6, #1E40AF)',
                      boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)',
                    }}
                  />
                  <h1
                    className="text-xl font-bold tracking-tight"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Intelligence Operations Center
                  </h1>
                  <PulseDot color="#10B981" />
                  <span
                    className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    Live
                  </span>
                </div>
                <p className="text-sm ml-5" style={{ color: 'var(--ios-text-secondary)' }}>
                  Real-time signal processing &amp; investigation management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: 'var(--ios-text-secondary)' }}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Last updated: {lastUpdated || '—'}</span>
              </div>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  color: 'var(--ios-text-secondary)',
                  background: 'var(--ios-bg-elevated)',
                  border: '1px solid var(--ios-border)',
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </header>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Signals"
              value={signals.length}
              icon={Radar}
              color="#3B82F6"
              trend={{ value: '12%', up: true }}
              delay={0}
            />
            <StatCard
              label="Investigations"
              value={signals.filter((s) => s.status === 'analyzed').length}
              icon={Shield}
              color="#8B5CF6"
              trend={{ value: '3', up: true }}
              delay={0.08}
            />
            <StatCard
              label="Intel Generated"
              value={signals.length}
              icon={TrendingUp}
              color="#10B981"
              trend={{ value: `${signals.length} active`, up: true }}
              delay={0.16}
            />
            <StatCard
              label="Threat Level"
              value={
                signals.filter((s) => s.severity === 'CRITICAL').length >= 4
                  ? 'HIGH'
                  : signals.filter((s) => s.severity === 'CRITICAL').length >= 1
                    ? 'MODERATE'
                    : 'LOW'
              }
              icon={AlertTriangle}
              color={
                signals.filter((s) => s.severity === 'CRITICAL').length >= 4
                  ? '#EF4444'
                  : signals.filter((s) => s.severity === 'CRITICAL').length >= 1
                    ? '#F59E0B'
                    : '#10B981'
              }
              trend={{
                value: `${signals.filter((s) => s.severity === 'CRITICAL').length} critical`,
                up: false,
              }}
              delay={0.24}
            />
          </div>

          {/* ── Main Content: 2-Column Layout ── */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
            {/* LEFT: Active Signal Stream (7 cols) */}
            <section className="lg:col-span-7 flex flex-col gap-4 min-h-0">
              {/* Filter Bar + Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-5 w-1 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                    }}
                  />
                  <h2
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Active Signal Stream
                  </h2>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      color: 'var(--ios-text-secondary)',
                      background: 'var(--ios-bg-elevated)',
                      border: '1px solid var(--ios-border)',
                    }}
                  >
                    {filteredSignals.length} signals
                  </span>
                </div>

                {/* Filter Buttons */}
                <div
                  className="flex items-center gap-1.5 p-1 rounded-lg"
                  style={{
                    background: 'var(--ios-bg-secondary)',
                    border: '1px solid var(--ios-border)',
                  }}
                >
                  {FILTERS.map((f) => {
                    const isActive = activeFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setActiveFilter(f.key)}
                        className="relative px-3 py-1 rounded-md text-xs font-medium transition-colors"
                        style={{
                          color: isActive ? 'var(--ios-text-primary)' : 'var(--ios-text-secondary)',
                          background: isActive ? 'var(--ios-bg-elevated)' : 'transparent',
                          boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
                        }}
                      >
                        {isActive && f.key !== 'ALL' && (
                          <span
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                            style={{ background: SEVERITY_CONFIG[f.key as Severity].color }}
                          />
                        )}
                        <span className={isActive && f.key !== 'ALL' ? 'ml-2' : ''}>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Signal Cards */}
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[620px] pr-1 custom-scrollbar">
                <StaggerGrid stagger={0.06} className="flex flex-col gap-3">
                  {filteredSignals.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                      <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                        No signals to display
                      </span>
                    </div>
                  )}
                  {filteredSignals.map((signal) => {
                    const sevConfig = SEVERITY_CONFIG[signal.severity];
                    const SignalIcon = signal.icon;
                    const isInvestigating = investigatingIds.has(signal.id);
                    const isAnalyzed = signal.status === 'analyzed';
                    return (
                      <StaggerItem key={signal.id}>
                        <AnimatedCard delay={0} hover={false} glow={sevConfig.bg} className="">
                          <div
                            className="relative rounded-xl p-4 transition-all duration-200"
                            style={{
                              background: isAnalyzed
                                ? 'var(--ios-bg-elevated)'
                                : 'var(--ios-bg-card)',
                              borderLeft: isAnalyzed
                                ? `3px solid #10B981`
                                : `3px solid transparent`,
                              opacity: isInvestigating ? 0.6 : 1,
                            }}
                          >
                            {/* Top row: icon, type, severity, timestamp */}
                            <div className="flex items-start justify-between gap-3 mb-2.5">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                  style={{
                                    background: sevConfig.bg,
                                    border: `1px solid ${sevConfig.border}`,
                                  }}
                                >
                                  <span style={{ color: sevConfig.color }}>
                                    <SignalIcon className="w-4 h-4" />
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="text-sm font-semibold"
                                      style={{ color: 'var(--ios-text-primary)' }}
                                    >
                                      {signal.type}
                                    </span>
                                    <span
                                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{
                                        color: sevConfig.color,
                                        background: sevConfig.bg,
                                        border: `1px solid ${sevConfig.border}`,
                                      }}
                                    >
                                      {signal.severity}
                                    </span>
                                    {isAnalyzed && (
                                      <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                        style={{
                                          color: '#10B981',
                                          background: 'rgba(16, 185, 129, 0.12)',
                                          border: '1px solid rgba(16, 185, 129, 0.3)',
                                        }}
                                      >
                                        Analyzed
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className="text-xs mt-0.5 block"
                                    style={{ color: 'var(--ios-text-secondary)' }}
                                  >
                                    {signal.source}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className="text-[11px] whitespace-nowrap"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {signal.timestamp}
                                </span>
                                <span
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                  style={{
                                    color: 'var(--ios-text-secondary)',
                                    background: 'var(--ios-bg-secondary)',
                                  }}
                                >
                                  {signal.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>

                            {/* Description */}
                            <p
                              className="text-xs leading-relaxed mb-3 line-clamp-2"
                              style={{ color: 'var(--ios-text-secondary)' }}
                            >
                              {signal.description}
                            </p>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                disabled={isInvestigating || isAnalyzed}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInvestigate(signal.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  color: isAnalyzed ? '#10B981' : '#3B82F6',
                                  background: isAnalyzed
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : 'rgba(59, 130, 246, 0.1)',
                                  border: isAnalyzed
                                    ? '1px solid rgba(16, 185, 129, 0.2)'
                                    : '1px solid rgba(59, 130, 246, 0.2)',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isAnalyzed && !isInvestigating)
                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isAnalyzed)
                                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                }}
                              >
                                {isInvestigating ? (
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : isAnalyzed ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <Search className="w-3 h-3" />
                                )}
                                {isInvestigating
                                  ? 'Investigating…'
                                  : isAnalyzed
                                    ? 'Analyzed'
                                    : 'Investigate'}
                              </button>
                              <button
                                disabled={isInvestigating}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismiss(signal.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  color: 'var(--ios-text-secondary)',
                                  background: 'var(--ios-bg-secondary)',
                                  border: '1px solid var(--ios-border)',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isInvestigating)
                                    e.currentTarget.style.borderColor = 'var(--ios-text-secondary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--ios-border)';
                                }}
                              >
                                <XCircle className="w-3 h-3" />
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    );
                  })}
                </StaggerGrid>
              </div>
            </section>

            {/* RIGHT: Pipeline + Team (5 cols) */}
            <aside className="lg:col-span-5 flex flex-col gap-5 min-h-0">
              {/* Processing Pipeline */}
              <GlassPanel className="flex flex-col gap-4 p-5" style={{ minHeight: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="h-5 w-1 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                    }}
                  />
                  <h2
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Processing Pipeline
                  </h2>
                  <PulseDot color="#10B981" />
                </div>

                <div className="flex flex-col gap-2.5">
                  {pipelineEngines.length === 0 && (
                    <div className="flex items-center justify-center py-6">
                      <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                        No pipeline data available
                      </span>
                    </div>
                  )}
                  {pipelineEngines.map((engine, idx) => {
                    const statusConf = PIPELINE_STATUS[engine.status] || PIPELINE_STATUS.down;
                    const isLast = idx === pipelineEngines.length - 1;
                    return (
                      <div key={engine.id} className="relative">
                        <div
                          className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                          style={{
                            background: 'var(--ios-bg-secondary)',
                            border: '1px solid var(--ios-border)',
                          }}
                        >
                          {/* Engine initials badge */}
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{
                              color: statusConf.color,
                              background: `${statusConf.color}15`,
                              border: `1px solid ${statusConf.color}30`,
                            }}
                          >
                            {engine.shortName}
                          </div>

                          {/* Engine info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="text-xs font-medium truncate"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {engine.name}
                              </span>
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                                style={{
                                  color: statusConf.color,
                                  background: `${statusConf.color}15`,
                                }}
                              >
                                {statusConf.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span
                                className="text-[11px]"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {engine.itemsProcessed.toLocaleString()} items
                              </span>
                              <span
                                className="text-[11px]"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {engine.latency !== '—' ? (
                                  <span style={{ color: statusConf.color }}>{engine.latency}</span>
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Connector line between engines */}
                        {!isLast && (
                          <div className="flex justify-center" style={{ height: '8px' }}>
                            <div
                              className="w-px"
                              style={{
                                background: `linear-gradient(180deg, ${statusConf.color}40, var(--ios-border))`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassPanel>

              {/* Team Activity */}
              <GlassPanel className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="h-5 w-1 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #C4B5FD, #8B5CF6)',
                      boxShadow: '0 0 8px rgba(139, 92, 246, 0.3)',
                    }}
                  />
                  <h2
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Team Activity
                  </h2>
                </div>

                <div className="flex flex-col gap-3">
                  {teamActions.length === 0 && (
                    <div className="flex items-center justify-center py-6">
                      <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                        No team activity yet
                      </span>
                    </div>
                  )}
                  {teamActions.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-2.5 rounded-lg transition-colors"
                      style={{ background: 'var(--ios-bg-secondary)' }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{
                          color: 'var(--ios-text-primary)',
                          background: `linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))`,
                          border: '1px solid var(--ios-border)',
                        }}
                      >
                        {item.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--ios-text-secondary)' }}
                        >
                          <span
                            className="font-semibold"
                            style={{ color: 'var(--ios-text-primary)' }}
                          >
                            {item.name}
                          </span>{' '}
                          {item.action}
                        </p>
                        <span
                          className="text-[10px] mt-1 block"
                          style={{ color: 'var(--ios-text-muted, #5a6478)' }}
                        >
                          {item.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </aside>
          </div>

          {/* ── Bottom: Intelligence Coverage Map ── */}
          <GlassPanel className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="h-5 w-1 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                  boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
                }}
              />
              <h2
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--ios-text-primary)' }}
              >
                Intelligence Coverage Map
              </h2>
              <span
                className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  color: 'var(--ios-text-secondary)',
                  background: 'var(--ios-bg-elevated)',
                  border: '1px solid var(--ios-border)',
                }}
              >
                Collection Completeness
              </span>
            </div>

            {coverageDomains.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                  No coverage data available
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coverageDomains.map((domain) => (
                <div
                  key={domain.domain}
                  className="p-4 rounded-lg"
                  style={{
                    background: 'var(--ios-bg-secondary)',
                    border: '1px solid var(--ios-border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      {domain.domain}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: domain.color }}
                    >
                      {domain.completeness}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--ios-bg-elevated)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${domain.completeness}%`,
                        background: `linear-gradient(90deg, ${domain.color}, ${domain.color}CC)`,
                        boxShadow: `0 0 8px ${domain.color}40`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>
                      {domain.completeness >= 85
                        ? 'Well covered'
                        : domain.completeness >= 70
                          ? 'Gaps detected'
                          : 'Needs attention'}
                    </span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              i < Math.round(domain.completeness / 20)
                                ? domain.color
                                : 'var(--ios-bg-elevated)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      )}
    </PageTransition>
  );
}
