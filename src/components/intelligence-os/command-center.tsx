'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Data — AI Engines
   ═══════════════════════════════════════════════════════════ */
const AI_ENGINES = [
  {
    name: 'Ingestion',
    status: 'healthy' as const,
    throughput: 234,
    bars: [40, 65, 80, 55, 90, 70, 85, 60],
  },
  {
    name: 'Parsing',
    status: 'healthy' as const,
    throughput: 198,
    bars: [50, 75, 60, 85, 70, 90, 45, 80],
  },
  {
    name: 'NLP',
    status: 'healthy' as const,
    throughput: 167,
    bars: [70, 55, 90, 60, 80, 45, 75, 65],
  },
  {
    name: 'Reasoning',
    status: 'degraded' as const,
    throughput: 89,
    bars: [80, 60, 40, 55, 35, 50, 45, 60],
  },
  {
    name: 'Scoring',
    status: 'healthy' as const,
    throughput: 156,
    bars: [45, 70, 85, 60, 75, 90, 55, 80],
  },
  {
    name: 'Enrichment',
    status: 'healthy' as const,
    throughput: 142,
    bars: [60, 80, 55, 70, 90, 65, 75, 50],
  },
  {
    name: 'Dispatch',
    status: 'healthy' as const,
    throughput: 128,
    bars: [55, 65, 80, 90, 70, 60, 85, 75],
  },
];

const STATUS_COLORS: Record<string, { dot: string; text: string }> = {
  healthy: { dot: '#10B981', text: '#10B981' },
  degraded: { dot: '#F59E0B', text: '#F59E0B' },
  down: { dot: '#EF4444', text: '#EF4444' },
};

/* ═══════════════════════════════════════════════════════════
   Data — Alerts
   ═══════════════════════════════════════════════════════════ */
// Fallback alerts used when API is unavailable
const FALLBACK_ALERTS = [
  {
    id: 1,
    severity: 'critical' as const,
    message: 'Model latency exceeding 5s threshold on Reasoning engine',
    timestamp: '2 min ago',
    icon: XCircle,
  },
  {
    id: 2,
    severity: 'warning' as const,
    message: 'Data source API rate limit reached (98% of quota)',
    timestamp: '8 min ago',
    icon: AlertTriangle,
  },
  {
    id: 3,
    severity: 'info' as const,
    message: 'Cache hit ratio dropped below 85% — auto-scaling triggered',
    timestamp: '14 min ago',
    icon: Info,
  },
  {
    id: 4,
    severity: 'info' as const,
    message: 'Scheduled model retraining completed successfully',
    timestamp: '23 min ago',
    icon: CheckCircle2,
  },
  {
    id: 5,
    severity: 'warning' as const,
    message: 'Memory usage on Node-3 approaching 90% capacity',
    timestamp: '31 min ago',
    icon: AlertTriangle,
  },
];

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

/* ═══════════════════════════════════════════════════════════
   Data — Performance Timeline (24 hours)
   ═══════════════════════════════════════════════════════════ */
const HOURLY_VOLUME = [
  320, 180, 90, 65, 45, 60, 210, 580, 920, 1050, 1120, 980, 870, 780, 890, 1020, 1150, 1080, 920,
  750, 620, 480, 390, 440,
];
const CURRENT_HOUR = new Date().getHours();
const MAX_VOLUME = Math.max(...HOURLY_VOLUME);

/* ═══════════════════════════════════════════════════════════
   Data — Quick Actions
   ═══════════════════════════════════════════════════════════ */
const QUICK_ACTIONS = [
  { label: 'Run Calibration', icon: SlidersHorizontal, color: '#8B5CF6' },
  { label: 'Clear Queue', icon: RotateCcw, color: '#F59E0B' },
  { label: 'Export Report', icon: FileDown, color: '#06B6D4' },
  { label: 'Scale Resources', icon: Maximize2, color: '#10B981' },
  { label: 'Run Diagnostics', icon: Stethoscope, color: '#3B82F6' },
  { label: 'View Logs', icon: ScrollText, color: '#8892A8' },
];

/* ═══════════════════════════════════════════════════════════
   Data — Resource Allocation
   ═══════════════════════════════════════════════════════════ */
const RESOURCES = [
  { label: 'CPU Usage', value: 67, display: '67%', color: '#3B82F6', icon: Cpu },
  { label: 'Memory', value: 52.5, display: '4.2 / 8 GB', color: '#8B5CF6', icon: HardDrive },
  { label: 'Storage', value: 60, display: '1.2 / 2 TB', color: '#06B6D4', icon: Layers },
  { label: 'Network', value: 68, display: '340 Mbps', color: '#10B981', icon: Wifi },
];

/* ═══════════════════════════════════════════════════════════
   Command Center Component
   ═══════════════════════════════════════════════════════════ */
export function CommandCenter() {
  const [uptime, setUptime] = useState('14d 7h 23m');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(FALLBACK_ALERTS);
  const [healthData, setHealthData] = useState<any>(null);
  const [aiHealthData, setAiHealthData] = useState<any>(null);

  // Fetch system health and AI health on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [healthRes, aiHealthRes, signalsRes] = await Promise.all([
          fetchApi('/api/health'),
          fetchApi('/api/health/ai'),
          fetchApi('/api/signals', { params: { severity: 'critical', limit: 5 } }),
        ]);

        if (cancelled) return;

        if (!healthRes.error) setHealthData(healthRes.data);
        if (!aiHealthRes.error) setAiHealthData(aiHealthRes.data);

        // Map high-severity signals to alerts
        if (!signalsRes.error && signalsRes.data?.data?.length > 0) {
          const severityIconMap: Record<string, any> = {
            critical: XCircle,
            high: AlertTriangle,
            medium: Info,
            low: CheckCircle2,
          };
          const mappedAlerts = (signalsRes.data.data as any[]).map((s, i) => ({
            id: s.id || i + 1,
            severity: (s.severity === 'critical'
              ? 'critical'
              : s.severity === 'high'
                ? 'warning'
                : 'info') as 'critical' | 'warning' | 'info',
            message: s.title || s.description || `Signal: ${s.signalType || 'Unknown'}`,
            timestamp: s.detectedAt ? new Date(s.detectedAt).toLocaleString() : 'Recently',
            icon: severityIconMap[s.severity] || Info,
          }));
          setAlerts(mappedAlerts.length > 0 ? mappedAlerts : FALLBACK_ALERTS);
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
      const base = healthData?.timestamp
        ? new Date(healthData.timestamp).getTime()
        : new Date('2025-01-10T02:37:00').getTime();
      const diff = Date.now() - base;
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

  return (
    <PageTransition>
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
              Loading command center…
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-10">
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
        <div className="min-h-screen" style={{ background: 'var(--ios-bg-primary)' }}>
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
                <StatCard
                  label="AI Calls Today"
                  value={aiHealthData?.cache?.totalEntries ?? 14287}
                  icon={Activity}
                  color="#3B82F6"
                  trend={{ value: '8%', up: true }}
                  delay={0}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Avg Response Time"
                  value="1.2s"
                  icon={Zap}
                  color="#10B981"
                  trend={{ value: '15%', up: false }}
                  delay={0.05}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Active Models"
                  value={aiHealthData?.providers?.count ?? 7}
                  icon={Brain}
                  color="#8B5CF6"
                  delay={0.1}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Data Processed"
                  value="2.4TB"
                  icon={HardDrive}
                  color="#06B6D4"
                  trend={{ value: '22%', up: true }}
                  delay={0.15}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Accuracy Score"
                  value="94.7%"
                  icon={CheckCircle2}
                  color="#10B981"
                  trend={{ value: '2.1%', up: true }}
                  delay={0.2}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Queue Depth"
                  value={healthData?.pool?.waitingRequests ?? 42}
                  icon={Layers}
                  color="#F59E0B"
                  delay={0.25}
                />
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
                      7 engines
                    </span>
                  </div>

                  {/* Pipeline Flow */}
                  <div className="flex items-stretch gap-0 overflow-x-auto pb-2 scrollbar-hide">
                    {AI_ENGINES.map((engine, idx) => {
                      const statusColor = STATUS_COLORS[engine.status];
                      return (
                        <div key={engine.name} className="flex items-stretch flex-shrink-0">
                          {/* Engine Card */}
                          <div
                            className="relative flex flex-col items-center px-4 py-3 rounded-xl min-w-[120px]"
                            style={{
                              background:
                                engine.status === 'degraded'
                                  ? 'rgba(245,158,11,0.06)'
                                  : 'var(--ios-bg-elevated)',
                              border: `1px solid ${engine.status === 'degraded' ? 'rgba(245,158,11,0.2)' : 'var(--ios-border)'}`,
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
                              {engine.bars.map((bar, bIdx) => (
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
                          {idx < AI_ENGINES.length - 1 && (
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
                    {HOURLY_VOLUME.map((vol, idx) => {
                      const heightPct = (vol / MAX_VOLUME) * 100;
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
                    {QUICK_ACTIONS.map((action) => {
                      const ActionIcon = action.icon;
                      return (
                        <button
                          key={action.label}
                          className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
                            <ActionIcon className="w-4 h-4" style={{ color: action.color }} />
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
                {RESOURCES.map((res) => {
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

                          {/* Progress bar — simple div, no AnimatedBar */}
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
