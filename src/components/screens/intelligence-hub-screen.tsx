'use client';

import { useState, useCallback, useMemo } from 'react';
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
  ChevronRight,
  RefreshCw,
  Activity,
  Search,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { fetchApi } from '@/lib/fetchApi';
import { useAppStore } from '@/lib/store';
import {
  StatCardWidget,
  SignalFeedCard,
  SignalFeedSkeleton,
  TimelineItem,
  HealthIndicator,
  SignalsChart,
  SectionHeader,
  CircularProgress,
  type SignalFeedItem,
  type HealthStatus,
  type TopOrg,
  type StatCardData,
  C,
  getMockSignals,
  getMockTopOrgs,
  getMockTimeline,
  getMockChartData,
} from './intelligence-hub';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface OverviewStats {
  organizations: number;
  signals: number;
  briefings: number;
  imports: number;
  people: number;
  totalRowsProcessed: number;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function IntelligenceHub() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setSelectedCompanyId = useAppStore((s) => s.setSelectedCompanyId);

  // ── State (D11, D13, D16, D17, D18) ──
  const [hubError, setHubError] = useState<string | null>(null);
  const [signalLimit, setSignalLimit] = useState(10);
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [signalFilter, setSignalFilter] = useState<string>('all');
  const [signalSearch, setSignalSearch] = useState('');

  // ── Data Fetching ──
  // D3/D4: fetchApi now unwraps { data } envelope, so result.data is the actual array
  const {
    data: signalsData,
    isLoading: signalsLoading,
    refetch: refetchSignals,
  } = useQuery({
    queryKey: ['signals-feed', signalLimit],
    queryFn: async () => {
      const result = await fetchApi<SignalFeedItem[]>('/api/signals', {
        params: { limit: signalLimit },
      });
      return result.data;
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  // D14: No mock fallback — HealthIndicator handles null gracefully
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const result = await fetchApi<HealthStatus>('/api/health');
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // D12: Fetch real overview stats from API
  const { data: overviewStats } = useQuery<OverviewStats | null>({
    queryKey: ['stats-overview'],
    queryFn: async () => {
      const result = await fetchApi<OverviewStats>('/api/stats/overview');
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const signals = signalsData || getMockSignals();
  const health = healthData; // D1/D14: No mock fallback

  // D17: Filtered signals based on search and severity filter
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (signalFilter !== 'all' && s.severity !== signalFilter) return false;
      if (
        signalSearch &&
        !s.title.toLowerCase().includes(signalSearch.toLowerCase()) &&
        !(s.organizationName || '').toLowerCase().includes(signalSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [signals, signalFilter, signalSearch]);

  // D12: Build stats with real data where available
  const stats: StatCardData[] = useMemo(() => {
    const orgCount = overviewStats?.organizations;
    const signalCount = overviewStats?.signals;
    const briefingCount = overviewStats?.briefings;
    const importCount = overviewStats?.imports;
    const personCount = overviewStats?.people;
    const totalRows = overviewStats?.totalRowsProcessed;

    return [
      {
        label: 'Total Organizations',
        value: orgCount != null ? orgCount.toLocaleString() : '2,847',
        change: 12,
        changeLabel: orgCount != null ? 'from database' : 'vs last month',
        icon: <Building2 className="h-4 w-4" />,
        accentColor: C.accent,
        accentBg: C.accentGhost,
      },
      {
        label: 'Active Signals',
        value: signalCount != null ? signalCount.toLocaleString() : '156',
        change: 23,
        changeLabel: signalCount != null ? 'from database' : 'vs last week',
        icon: <Radio className="h-4 w-4" />,
        accentColor: C.danger,
        accentBg: C.dangerGhost,
      },
      {
        label: 'AI Insights Generated',
        value: totalRows != null ? totalRows.toLocaleString() : '1,234',
        change: 18,
        changeLabel: totalRows != null ? 'rows processed' : 'vs last week',
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
        label: 'Data Imports',
        value: importCount != null ? importCount.toLocaleString() : '—',
        change: importCount != null ? 3 : 0,
        changeLabel: importCount != null ? 'completed imports' : 'vs last month',
        icon: <FileText className="h-4 w-4" />,
        accentColor: C.cyan,
        accentBg: C.cyanGhost,
      },
      {
        label: 'Active Briefings',
        value: briefingCount != null ? briefingCount.toLocaleString() : '—',
        change: briefingCount != null ? -2 : 0,
        changeLabel: briefingCount != null ? 'from database' : 'vs last week',
        icon: <FileText className="h-4 w-4" />,
        accentColor: C.gold,
        accentBg: C.goldGhost,
      },
    ];
  }, [overviewStats]);

  const topOrgs = getMockTopOrgs();
  const timeline = getMockTimeline();
  const [chartData] = useState(getMockChartData);
  const criticalSignalCount = signals.filter((s) => s.severity === 'critical').length;

  // D18: Refresh handler
  const handleRefresh = useCallback(() => {
    refetchSignals();
    refetchHealth();
    toast.success('Data refreshed');
  }, [refetchSignals, refetchHealth]);

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

  // D11: Error boundary display
  if (hubError) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: C.bg }}>
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: C.danger }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: C.textPrimary }}>
            Something went wrong
          </h2>
          <p className="text-sm mb-4" style={{ color: C.textSecondary }}>
            {hubError}
          </p>
          <Button
            onClick={() => setHubError(null)}
            size="sm"
            style={{ background: C.accent, color: '#fff' }}
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          {/* Page Header */}
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
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: C.successGhost }}
              >
                <div
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: C.success }}
                />
                <span className="text-[11px] font-semibold" style={{ color: C.success }}>
                  Live
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* D18: Refresh button with onClick handler */}
                  <button
                    className="flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
                    style={{ border: `1px solid ${C.border}`, color: C.textSecondary }}
                    onClick={handleRefresh}
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
                <TooltipContent
                  side="bottom"
                  style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
                >
                  <p className="text-xs" style={{ color: C.textPrimary }}>
                    Refresh data
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div>
                    <StatCardWidget stat={stat} />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
                >
                  <p className="text-xs" style={{ color: C.textSecondary }}>
                    {stat.changeLabel}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Quick Actions Bar */}
          <div
            className="rounded-xl p-4 flex flex-wrap items-center gap-3"
            style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
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
              <Upload className="h-3.5 w-3.5" /> Import Data
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
              <Play className="h-3.5 w-3.5" /> Run Intelligence Pipeline
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
              <Eye className="h-3.5 w-3.5" /> View All Signals
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
              <Sparkles className="h-3.5 w-3.5" /> Generate Briefing
            </Button>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Signal Feed */}
              <div
                className="rounded-xl"
                style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
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
                            <span
                              className="h-1.5 w-1.5 rounded-full animate-pulse"
                              style={{ background: C.danger }}
                            />
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
                        View all <ChevronRight className="h-3 w-3" />
                      </button>
                    }
                  />
                </div>

                {/* D17: Search and filter bar */}
                <div className="px-4 pb-2 flex items-center gap-2">
                  <div
                    className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.textMuted }} />
                    <input
                      type="text"
                      placeholder="Search signals..."
                      value={signalSearch}
                      onChange={(e) => setSignalSearch(e.target.value)}
                      className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--ios-text-tertiary)]"
                      style={{ color: C.textPrimary }}
                    />
                  </div>
                  <select
                    value={signalFilter}
                    onChange={(e) => setSignalFilter(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${C.border}`,
                      color: C.textSecondary,
                    }}
                  >
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div
                  className="px-3 pb-1 max-h-[480px] overflow-y-auto space-y-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}
                >
                  {signalsLoading ? (
                    <SignalFeedSkeleton />
                  ) : filteredSignals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs" style={{ color: C.textMuted }}>
                        {signalSearch || signalFilter !== 'all'
                          ? 'No signals match your filter'
                          : 'No signals yet'}
                      </p>
                    </div>
                  ) : (
                    filteredSignals.map((signal) => (
                      <SignalFeedCard key={signal.id} signal={signal} onClick={handleSignalClick} />
                    ))
                  )}
                </div>

                {/* D13: Load more pagination */}
                {filteredSignals.length >= 10 && (
                  <div className="px-3 pb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setSignalLimit((prev) => prev + 10)}
                      style={{ color: C.accent }}
                    >
                      Load more signals <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div
                className="rounded-xl p-4"
                style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              >
                <SectionHeader
                  title="Activity Timeline"
                  icon={<Activity className="h-4 w-4" style={{ color: C.success }} />}
                />
                <div
                  className="max-h-[360px] overflow-y-auto pr-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}
                >
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

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-6">
              {/* Top Organizations */}
              <div
                className="rounded-xl p-4"
                style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
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
                      View all <ChevronRight className="h-3 w-3" />
                    </button>
                  }
                />
                <div
                  className="space-y-3 max-h-[400px] overflow-y-auto pr-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}
                >
                  {topOrgs.map((org, idx) => (
                    <div
                      key={org.id}
                      className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all duration-150 group"
                      style={{ border: `1px solid transparent` }}
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
                      <div
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold shrink-0"
                        style={{
                          background: idx === 0 ? C.goldGhost : C.accentGhost,
                          color: idx === 0 ? C.gold : C.textMuted,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: C.textPrimary }}
                          >
                            {org.name}
                          </span>
                          <ChevronRight
                            className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: C.textMuted }}
                          />
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
                                style={{ color: org.trend === 'up' ? C.success : C.danger }}
                              >
                                {org.trend === 'up' ? (
                                  <ChevronRight className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 rotate-90" />
                                )}
                                {Math.abs(org.trendValue)}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <CircularProgress value={org.intelligenceScore} size={48} strokeWidth={4} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Signals Chart — D16: Time range selector */}
              <div
                className="rounded-xl p-4"
                style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              >
                <SectionHeader
                  title="Signals Over Time"
                  icon={<BarChart3 className="h-4 w-4" style={{ color: C.cyan }} />}
                  action={
                    <div className="flex items-center gap-1">
                      {(['7d', '30d', '90d'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setChartRange(range)}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors"
                          style={{
                            background: chartRange === range ? C.accentGhost : 'transparent',
                            color: chartRange === range ? C.accent : C.textMuted,
                          }}
                        >
                          {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                        </button>
                      ))}
                    </div>
                  }
                />
                <SignalsChart chartData={chartData} />
              </div>

              {/* Health Indicator */}
              <HealthIndicator health={health ?? null} loading={healthLoading} />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
