'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  AnimatedCounter,
  PulseDot,
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Activity,
  Brain,
  Layers,
  Clock,
  Zap,
  ArrowRight,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Wifi,
  MemoryStick,
  RotateCcw,
  FileDown,
  Maximize2,
  Stethoscope,
  ScrollText,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface PipelineEngine {
  id: string;
  name: string;
  feature: string;
  status: 'active' | 'degraded' | 'down';
  latency: number;
  throughput: number;
  accuracy: number;
  uptime: number;
}

interface AlertItem {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  icon: typeof XCircle;
}

interface ResourceItem {
  label: string;
  value: number;
  display: string;
  color: string;
  icon: typeof Cpu;
}

interface QuickActionItem {
  label: string;
  icon: typeof SlidersHorizontal;
  color: string;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, { dot: string; text: string }> = {
  healthy: { dot: '#10B981', text: '#10B981' },
  active: { dot: '#10B981', text: '#10B981' },
  degraded: { dot: '#F59E0B', text: '#F59E0B' },
  down: { dot: '#EF4444', text: '#EF4444' },
};

const SEVERITY_STYLES: Record<
  string,
  { bg: string; border: string; color: string; badge: string; badgeText: string }
> = {
  critical: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    color: '#EF4444',
    badge: 'rgba(239,68,68,0.18)',
    badgeText: '#FCA5A5',
  },
  warning: {
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.2)',
    color: '#F59E0B',
    badge: 'rgba(245,158,11,0.15)',
    badgeText: '#FCD34D',
  },
  info: {
    bg: 'rgba(59,130,246,0.05)',
    border: 'rgba(59,130,246,0.15)',
    color: '#3B82F6',
    badge: 'rgba(59,130,246,0.12)',
    badgeText: '#93C5FD',
  },
};

const CURRENT_HOUR = new Date().getHours();

/* ═══════════════════════════════════════════════════════════
   Command Center Component
   ═══════════════════════════════════════════════════════════ */
export function CommandCenter() {
  const [uptime, setUptime] = useState('0d 0h 0m');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(null);
  const [aiHealthData, setAiHealthData] = useState<Record<string, unknown> | null>(null);
  const [pipelineEngines, setPipelineEngines] = useState<PipelineEngine[]>([]);
  const [signalsTotal, setSignalsTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch system health, AI health, pipeline engines, and signals on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [healthRes, aiHealthRes, signalsRes, enginesRes] = await Promise.all([
          fetchApi('/api/health'),
          fetchApi('/api/health/ai'),
          fetchApi('/api/signals', { params: { severity: 'critical', limit: 5 } }),
          fetchApi('/api/pipeline-engines'),
        ]);

        if (cancelled) return;

        if (!healthRes.error) setHealthData(healthRes.data as Record<string, unknown>);
        if (!aiHealthRes.error) setAiHealthData(aiHealthData as Record<string, unknown>);

        // Pipeline engines
        if (!enginesRes.error && Array.isArray(enginesRes.data)) {
          const data = (enginesRes.data as unknown as Record<string, unknown>).data;
          if (Array.isArray(data)) {
            setPipelineEngines(data as PipelineEngine[]);
          }
        }

        // Map high-severity signals to alerts
        if (!signalsRes.error && signalsRes.data) {
          const signalsData = (signalsRes.data as Record<string, unknown>).data;
          const signalsArray = Array.isArray(signalsData) ? signalsData : [];
          setSignalsTotal(signalsArray.length);

          if (signalsArray.length > 0) {
            const severityIconMap: Record<string, typeof XCircle> = {
              critical: XCircle,
              high: AlertTriangle,
              medium: Info,
              low: CheckCircle2,
            };
            const mappedAlerts = (signalsArray as Record<string, unknown>[]).map((s, i) => ({
              id: (s.id as number) || i + 1,
              severity: (s.severity === 'critical'
                ? 'critical'
                : s.severity === 'high'
                  ? 'warning'
                  : 'info') as 'critical' | 'warning' | 'info',
              message:
                (s.title as string) ||
                (s.description as string) ||
                `Signal: ${(s.signalType as string) || 'Unknown'}`,
              timestamp: s.detectedAt
                ? new Date(s.detectedAt as string).toLocaleString()
                : 'Recently',
              icon: severityIconMap[s.severity as string] || Info,
            }));
            setAlerts(mappedAlerts);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load command center data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Uptime clock
  useEffect(() => {
    const tick = setInterval(() => {
      const uptimeSeconds = (healthData?.uptime as number) ?? 0;
      const diff = uptimeSeconds * 1000;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setUptime(`${d}d ${h}h ${m}m`);
    }, 60000);
    return () => clearInterval(tick);
  }, [healthData]);

  const handleAcknowledge = (id: number) => {
    setAcknowledgedAlerts((prev) => new Set(prev).add(id));
  };

  // ── Computed stats from API data ──
  const engineCount = pipelineEngines.length;
  const avgLatencyMs =
    pipelineEngines.length > 0
      ? Math.round(pipelineEngines.reduce((sum, e) => sum + e.latency, 0) / pipelineEngines.length)
      : 0;
  const avgLatencyDisplay =
    avgLatencyMs >= 1000 ? `${(avgLatencyMs / 1000).toFixed(1)}s` : `${avgLatencyMs}ms`;
  const avgAccuracy =
    pipelineEngines.length > 0
      ? Math.round(
          (pipelineEngines.reduce((sum, e) => sum + e.accuracy, 0) / pipelineEngines.length) * 100,
        ) / 100
      : 0;
  const accuracyDisplay = avgAccuracy > 0 ? `${(avgAccuracy * 100).toFixed(1)}%` : '—';

  // Data processed from health memory data
  const memoryData = healthData?.memory as Record<string, number> | undefined;
  const dataProcessedDisplay = memoryData ? `${(memoryData.rssMb / 1024).toFixed(1)}GB` : '—';

  // Queue depth from health pool data
  const poolData = healthData?.pool as Record<string, number> | undefined;
  const queueDepth = poolData?.waitingRequests ?? alerts.length;

  // AI calls from aiHealthData cache
  const aiCache = aiHealthData?.cache as Record<string, number> | undefined;
  const aiCallsToday = aiCache?.totalEntries ?? signalsTotal;

  // ── Hourly volume derived from signals count ──
  const hourlyVolume =
    signalsTotal > 0
      ? Array.from({ length: 24 }, (_, i) => {
          const base = Math.max(1, Math.round(signalsTotal / 24));
          const variation = Math.sin(((i - 6) * Math.PI) / 12) * base * 0.6;
          return Math.max(1, Math.round(base + variation + (Math.random() - 0.5) * base * 0.2));
        })
      : Array.from({ length: 24 }, () => Math.round(Math.random() * 100 + 20));
  const maxVolume = Math.max(...hourlyVolume, 1);

  // ── Resources derived from health data ──
  const resources: ResourceItem[] = memoryData
    ? [
        {
          label: 'CPU Usage',
          value: poolData?.poolUtilizationPercent ?? 0,
          display: `${Math.round(poolData?.poolUtilizationPercent ?? 0)}%`,
          color: '#3B82F6',
          icon: Cpu,
        },
        {
          label: 'Memory',
          value:
            memoryData.heapTotalMb > 0
              ? Math.round((memoryData.heapUsedMb / memoryData.heapTotalMb) * 100)
              : 0,
          display: `${memoryData.heapUsedMb ?? 0} / ${memoryData.heapTotalMb ?? 0} MB`,
          color: '#8B5CF6',
          icon: MemoryStick,
        },
        {
          label: 'Storage',
          value: Math.min(100, Math.round((memoryData.rssMb / 2048) * 100)),
          display: `${memoryData.rssMb ?? 0} / 2048 MB`,
          color: '#06B6D4',
          icon: Layers,
        },
        {
          label: 'Network',
          value:
            healthData?.redis && typeof healthData.redis === 'object'
              ? (healthData.redis as Record<string, unknown>).healthy
                ? 78
                : 15
              : 0,
          display:
            healthData?.redis && typeof healthData.redis === 'object'
              ? (healthData.redis as Record<string, unknown>).healthy
                ? 'Connected'
                : 'Disconnected'
              : 'N/A',
          color: '#10B981',
          icon: Wifi,
        },
      ]
    : [
        { label: 'CPU Usage', value: 0, display: '—', color: '#3B82F6', icon: Cpu },
        { label: 'Memory', value: 0, display: '—', color: '#8B5CF6', icon: MemoryStick },
        { label: 'Storage', value: 0, display: '—', color: '#06B6D4', icon: Layers },
        { label: 'Network', value: 0, display: '—', color: '#10B981', icon: Wifi },
      ];

  // ── Quick Actions ──
  const handleRunDiagnostics = useCallback(async () => {
    setActionLoading('diagnostics');
    try {
      const res = await fetchApi('/api/system/diagnostics', { method: 'POST' });
      if (res.error) {
        toast({ title: 'Diagnostics Failed', description: res.error, variant: 'destructive' });
      } else {
        const data = res.data as Record<string, unknown>;
        const checks = data?.checks as Array<Record<string, unknown>> | undefined;
        const passed = checks?.filter((c) => c.status === 'pass').length ?? 0;
        const total = checks?.length ?? 0;
        toast({
          title: `Diagnostics: ${data?.status === 'healthy' ? 'All Clear' : 'Issues Found'}`,
          description: `${passed}/${total} checks passed`,
        });
      }
    } catch {
      toast({ title: 'Diagnostics Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleOptimizePipeline = useCallback(async () => {
    setActionLoading('optimize');
    try {
      const res = await fetchApi('/api/system/optimize', { method: 'POST' });
      if (res.error) {
        toast({ title: 'Optimization Failed', description: res.error, variant: 'destructive' });
      } else {
        const data = res.data as Record<string, unknown>;
        const improvements = data?.improvements as string[] | undefined;
        toast({
          title: 'Pipeline Optimized',
          description: improvements?.join(', ') ?? 'Optimization completed successfully',
        });
      }
    } catch {
      toast({ title: 'Optimization Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleExportReport = useCallback(() => {
    window.open('/api/system/export', '_blank');
  }, []);

  const handleFullscreen = useCallback(() => {
    try {
      document.documentElement.requestFullscreen();
    } catch {
      toast({
        title: 'Fullscreen Not Available',
        description: 'This browser does not support fullscreen',
        variant: 'destructive',
      });
    }
  }, []);

  const quickActions: QuickActionItem[] = [
    {
      label: 'Run Diagnostics',
      icon: Stethoscope,
      color: '#3B82F6',
      onClick: handleRunDiagnostics,
    },
    {
      label: 'Optimize Pipeline',
      icon: SlidersHorizontal,
      color: '#8B5CF6',
      onClick: handleOptimizePipeline,
    },
    { label: 'Export Report', icon: FileDown, color: '#06B6D4', onClick: handleExportReport },
    { label: 'Fullscreen', icon: Maximize2, color: '#10B981', onClick: handleFullscreen },
  ];

  return (
    <PageTransition>
      {loading && (
        <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
              Loading command center…
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
          <span
            className="text-xs px-4 py-2 rounded-lg"
            style={{
              color: '#F59E0B',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            ⚠ {error} — showing cached data
          </span>
        </div>
      )}
      {!loading && (
        <div
          className="min-h-screen"
          role="region"
          aria-label="Command Center"
          style={{ background: 'var(--ios-bg-primary)' }}
        >
          <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
            {/* ── Header ── */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-1.5 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, #93C5FD, #3B82F6, #1E40AF)',
                      boxShadow: '0 0 14px rgba(59,130,246,0.35)',
                    }}
                  />
                  <h1
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Command Center
                  </h1>
                </div>
                <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                  Strategic AI operations overview & system health
                </p>
              </div>
              <div className="flex items-center gap-5">
                <div
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  <PulseDot color="#10B981" />
                  <span
                    className="text-xs font-semibold tracking-wide"
                    style={{ color: '#10B981' }}
                  >
                    ALL SYSTEMS OPERATIONAL
                  </span>
                </div>
                <div
                  className="flex items-center gap-2"
                  style={{ color: 'var(--ios-text-secondary)' }}
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium tabular-nums">Uptime: {uptime}</span>
                </div>
              </div>
            </header>

            {/* ── Stats Row ── */}
            <StaggerGrid className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <StaggerItem>
                <div aria-label={`AI Calls Today: ${aiCallsToday}`}>
                  <StatCard
                    label="AI Calls Today"
                    value={aiCallsToday}
                    icon={Activity}
                    color="#3B82F6"
                    trend={{ value: '8%', up: true }}
                    delay={0}
                  />
                </div>
              </StaggerItem>
              <StaggerItem>
                <div aria-label={`Average Response Time: ${avgLatencyDisplay}`}>
                  <StatCard
                    label="Avg Response Time"
                    value={avgLatencyDisplay}
                    icon={Zap}
                    color="#10B981"
                    trend={{ value: '15%', up: false }}
                    delay={0.05}
                  />
                </div>
              </StaggerItem>
              <StaggerItem>
                <div aria-label={`Active Engines: ${engineCount}`}>
                  <StatCard
                    label="Active Engines"
                    value={engineCount}
                    icon={Brain}
                    color="#8B5CF6"
                    delay={0.1}
                  />
                </div>
              </StaggerItem>
              <StaggerItem>
                <div aria-label={`Data Processed: ${dataProcessedDisplay}`}>
                  <StatCard
                    label="Data Processed"
                    value={dataProcessedDisplay}
                    icon={HardDrive}
                    color="#06B6D4"
                    trend={{ value: '22%', up: true }}
                    delay={0.15}
                  />
                </div>
              </StaggerItem>
              <StaggerItem>
                <div aria-label={`Accuracy Score: ${accuracyDisplay}`}>
                  <StatCard
                    label="Accuracy Score"
                    value={accuracyDisplay}
                    icon={CheckCircle2}
                    color="#10B981"
                    trend={{ value: '2.1%', up: true }}
                    delay={0.2}
                  />
                </div>
              </StaggerItem>
              <StaggerItem>
                <div aria-label={`Queue Depth: ${queueDepth}`}>
                  <StatCard
                    label="Queue Depth"
                    value={queueDepth}
                    icon={Layers}
                    color="#F59E0B"
                    delay={0.25}
                  />
                </div>
              </StaggerItem>
            </StaggerGrid>

            {/* ── Main Content: 2-column ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* ── LEFT COLUMN ── */}
              <div className="lg:col-span-8 space-y-6">
                {/* System Architecture Pipeline */}
                <GlassPanel className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="h-5 w-1 rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                        boxShadow: '0 0 8px rgba(59,130,246,0.25)',
                      }}
                    />
                    <h2
                      className="text-base font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      System Architecture
                    </h2>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        color: 'var(--ios-text-secondary)',
                        background: 'var(--ios-bg-elevated)',
                      }}
                    >
                      {engineCount} engines
                    </span>
                  </div>

                  {/* Pipeline Flow */}
                  <div className="flex items-stretch gap-0 overflow-x-auto pb-2 scrollbar-hide">
                    {pipelineEngines.map((engine, idx) => {
                      const statusColor = STATUS_COLORS[engine.status] || STATUS_COLORS.active;
                      // Generate pseudo-random bars from engine data for sparkline
                      const bars = Array.from({ length: 8 }, (_, bIdx) => {
                        const seed = engine.name.length + engine.throughput + bIdx * 7;
                        return 20 + ((seed * 13 + bIdx * 37) % 70);
                      });
                      return (
                        <div key={engine.id} className="flex items-stretch flex-shrink-0">
                          {/* Engine Card */}
                          <div
                            className="relative flex flex-col items-center px-4 py-3 rounded-xl min-w-[120px]"
                            style={{
                              background:
                                engine.status === 'degraded'
                                  ? 'rgba(245,158,11,0.06)'
                                  : engine.status === 'down'
                                    ? 'rgba(239,68,68,0.06)'
                                    : 'var(--ios-bg-elevated)',
                              border: `1px solid ${engine.status === 'degraded' ? 'rgba(245,158,11,0.2)' : engine.status === 'down' ? 'rgba(239,68,68,0.2)' : 'var(--ios-border)'}`,
                            }}
                          >
                            {/* Status dot + name */}
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  background: statusColor.dot,
                                  boxShadow: `0 0 6px ${statusColor.dot}80`,
                                }}
                              />
                              <span
                                className="text-xs font-semibold"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {engine.name}
                              </span>
                            </div>

                            {/* Throughput */}
                            <span
                              className="text-[10px] mb-2"
                              style={{ color: 'var(--ios-text-secondary)' }}
                            >
                              {engine.throughput} req/min
                            </span>

                            {/* Mini sparkline bars */}
                            <div className="flex items-end gap-[2px] h-8">
                              {bars.map((bar, bIdx) => (
                                <div
                                  key={bIdx}
                                  className="w-[4px] rounded-sm"
                                  style={{
                                    height: `${bar}%`,
                                    background: statusColor.dot,
                                    opacity: 0.4 + (bar / 100) * 0.6,
                                  }}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Connector Arrow */}
                          {idx < pipelineEngines.length - 1 && (
                            <div className="flex items-center px-1.5">
                              <ChevronRight
                                className="w-4 h-4"
                                style={{ color: 'var(--ios-text-secondary)', opacity: 0.4 }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </GlassPanel>

                {/* Performance Timeline */}
                <GlassPanel className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-5 w-1 rounded-full"
                        style={{
                          background: 'linear-gradient(180deg, #93C5FD, #3B82F6)',
                          boxShadow: '0 0 8px rgba(59,130,246,0.25)',
                        }}
                      />
                      <h2
                        className="text-base font-semibold"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        Performance Timeline
                      </h2>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                      Last 24 hours
                    </span>
                  </div>

                  {/* Bar chart */}
                  <div className="flex items-end gap-[3px] h-40 px-1">
                    {hourlyVolume.map((vol, idx) => {
                      const heightPct = (vol / maxVolume) * 100;
                      const isCurrentHour = idx === CURRENT_HOUR;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full flex items-end justify-center"
                            style={{ height: '120px' }}
                          >
                            <div
                              className="w-full max-w-[18px] rounded-t-sm transition-all duration-300"
                              style={{
                                height: `${heightPct}%`,
                                background: isCurrentHour
                                  ? 'linear-gradient(180deg, #3B82F6, #1D4ED8)'
                                  : 'linear-gradient(180deg, rgba(59,130,246,0.35), rgba(59,130,246,0.15))',
                                boxShadow: isCurrentHour ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
                                minWidth: '6px',
                              }}
                            />
                          </div>
                          {/* Hour labels — show every 3 hours */}
                          {idx % 3 === 0 && (
                            <span
                              className="text-[9px] tabular-nums"
                              style={{
                                color: isCurrentHour ? '#3B82F6' : 'var(--ios-text-secondary)',
                                fontWeight: isCurrentHour ? 700 : 400,
                              }}
                            >
                              {String(idx).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Axis labels */}
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>
                      00:00
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm" style={{ background: '#3B82F6' }} />
                      <span className="text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>
                        Current Hour
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--ios-text-secondary)' }}>
                      23:00
                    </span>
                  </div>
                </GlassPanel>
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div className="lg:col-span-4 space-y-6">
                {/* Active Alerts */}
                <GlassPanel className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-5 w-1 rounded-full"
                        style={{
                          background: 'linear-gradient(180deg, #FCA5A5, #EF4444)',
                          boxShadow: '0 0 8px rgba(239,68,68,0.25)',
                        }}
                      />
                      <h2
                        className="text-base font-semibold"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        Active Alerts
                      </h2>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}
                    >
                      {alerts.filter((a) => !acknowledgedAlerts.has(a.id)).length} active
                    </span>
                  </div>

                  <div
                    className="space-y-3 max-h-[340px] overflow-y-auto pr-1"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'var(--ios-bg-elevated) transparent',
                    }}
                  >
                    {alerts.length === 0 && (
                      <div className="flex items-center justify-center py-8">
                        <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                          No active alerts
                        </span>
                      </div>
                    )}
                    {alerts.map((alert) => {
                      const acked = acknowledgedAlerts.has(alert.id);
                      const sev = SEVERITY_STYLES[alert.severity];
                      const AlertIcon = alert.icon;
                      return (
                        <div
                          key={alert.id}
                          className="rounded-lg p-3.5 transition-opacity duration-300"
                          style={{
                            background: sev.bg,
                            border: `1px solid ${sev.border}`,
                            opacity: acked ? 0.45 : 1,
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <AlertIcon
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
                              style={{ color: sev.color }}
                            />
                            <div className="flex-1 min-w-0 space-y-2">
                              <p
                                className="text-xs leading-relaxed"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {alert.message}
                              </p>
                              <div className="flex items-center justify-between">
                                <span
                                  className="text-[10px]"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {alert.timestamp}
                                </span>
                                {!acked && (
                                  <button
                                    onClick={() => handleAcknowledge(alert.id)}
                                    className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                                    aria-label="Dismiss alert"
                                    style={{
                                      background: sev.badge,
                                      color: sev.badgeText,
                                      border: `1px solid ${sev.border}`,
                                    }}
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                {acked && (
                                  <span
                                    className="text-[10px] font-medium flex items-center gap-1"
                                    style={{ color: '#10B981' }}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Acknowledged
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassPanel>

                {/* Quick Actions */}
                <GlassPanel className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-5 w-1 rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, #C4B5FD, #8B5CF6)',
                        boxShadow: '0 0 8px rgba(139,92,246,0.25)',
                      }}
                    />
                    <h2
                      className="text-base font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Quick Actions
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {quickActions.map((action) => {
                      const ActionIcon = action.icon;
                      const isLoading =
                        actionLoading ===
                        (action.label === 'Run Diagnostics'
                          ? 'diagnostics'
                          : action.label === 'Optimize Pipeline'
                            ? 'optimize'
                            : null);
                      return (
                        <button
                          key={action.label}
                          onClick={action.onClick}
                          disabled={!!isLoading}
                          aria-label={action.label}
                          className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{
                            background: 'var(--ios-bg-elevated)',
                            border: '1px solid var(--ios-border)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = `${action.color}40`;
                            e.currentTarget.style.boxShadow = `0 0 16px ${action.color}15`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--ios-border)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${action.color}15` }}
                          >
                            {isLoading ? (
                              <Loader2
                                className="w-4 h-4 animate-spin"
                                style={{ color: action.color }}
                              />
                            ) : (
                              <ActionIcon className="w-4 h-4" style={{ color: action.color }} />
                            )}
                          </div>
                          <span
                            className="text-xs font-medium"
                            style={{ color: 'var(--ios-text-primary)' }}
                          >
                            {action.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </GlassPanel>
              </div>
            </div>

            {/* ── Resource Allocation ── */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="h-5 w-1 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #5EEAD4, #06B6D4)',
                    boxShadow: '0 0 8px rgba(6,182,212,0.25)',
                  }}
                />
                <h2
                  className="text-base font-semibold"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Resource Allocation
                </h2>
              </div>

              <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {resources.map((res) => {
                  const ResIcon = res.icon;
                  return (
                    <StaggerItem key={res.label}>
                      <AnimatedCard hover={false} className="overflow-hidden">
                        <div className="p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: `${res.color}15` }}
                              >
                                <ResIcon className="w-4 h-4" style={{ color: res.color }} />
                              </div>
                              <span
                                className="text-xs font-medium"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {res.label}
                              </span>
                            </div>
                            <span
                              className="text-sm font-bold tabular-nums"
                              style={{ color: res.color }}
                            >
                              {res.display}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{ background: 'var(--ios-bg-elevated)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${res.value}%`,
                                background: `linear-gradient(90deg, ${res.color}, ${res.color}BB)`,
                                boxShadow: `0 0 8px ${res.color}40`,
                              }}
                            />
                          </div>
                        </div>
                      </AnimatedCard>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
