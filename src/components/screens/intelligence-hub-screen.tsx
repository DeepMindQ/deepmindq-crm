'use client';

import { useState, useCallback, useEffect } from 'react';
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
  type TimelineEntry,
  C,
  fetchTopOrgs,
  fetchTimeline,
  fetchChartData,
  getMockSignals,
  getMockTopOrgs,
  getMockTimeline,
  getMockChartData,
  getMockHealth,
} from './intelligence-hub';

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

  const signals: SignalFeedItem[] = signalsData?.length ? signalsData : getMockSignals();
  const health = healthData || getMockHealth();

  const stats: StatCardData[] = [
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
      icon: <FileText className="h-4 w-4" />,
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

  const [topOrgs, setTopOrgs] = useState<TopOrg[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [chartData, setChartData] = useState<
    Array<{ day: string; signals: number; criticals: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTopOrgs(5), fetchTimeline(10), fetchChartData()]).then(
      ([orgs, tl, chart]) => {
        if (!cancelled) {
          setTopOrgs(orgs);
          setTimeline(tl);
          setChartData(chart);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const criticalSignalCount = signals.filter((s) => s.severity === 'critical').length;

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
        import: { view: 'data-import', message: 'Opening Data Import...' },
        pipeline: { view: 'ai-health', message: 'Intelligence pipeline triggered...' },
        signals: { view: 'signal-intelligence', message: 'Viewing all signals...' },
        briefing: { view: 'intelligence-briefing', message: 'Generating intelligence briefing...' },
      };
      const cfg = actionMap[action];
      if (cfg) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setActiveView(cfg.view as any);
        toast.success(cfg.message);
      }
    },
    [setActiveView],
  );

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
                <div
                  className="px-3 pb-3 max-h-[480px] overflow-y-auto space-y-1"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}
                >
                  {signalsLoading ? (
                    <SignalFeedSkeleton />
                  ) : (
                    signals.map((signal) => (
                      <SignalFeedCard key={signal.id} signal={signal} onClick={handleSignalClick} />
                    ))
                  )}
                </div>
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

              {/* Signals Chart */}
              <div
                className="rounded-xl p-4"
                style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              >
                <SectionHeader
                  title="Signals Over Time"
                  icon={<BarChart3 className="h-4 w-4" style={{ color: C.cyan }} />}
                  action={
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{ background: C.accentGhost, color: C.accent }}
                    >
                      Last 7 days
                    </span>
                  }
                />
                <SignalsChart chartData={chartData} />
              </div>

              {/* Health Indicator */}
              <HealthIndicator health={health} loading={healthLoading} />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
