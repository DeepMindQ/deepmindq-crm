'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
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
  Zap,
  CheckCircle2,
  BarChart3,
  Timer,
  Play,
  Pause,
  RotateCcw,
  MoreHorizontal,
  TrendingUp,
  Signal,
  Monitor,
  Globe,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

/* ── Types ── */

interface QueueRow {
  id: number | string;
  company: string;
  domain: string;
  industry: string;
  status: 'Active' | 'Completed' | 'Pending' | 'Failed';
  progress: number;
}

interface ActivationRule {
  id: string;
  name: string;
  description: string;
  icon: typeof TrendingUp;
  enabled: boolean;
  color: string;
  liveCount?: number;
}

interface TimelineEntry {
  time: string;
  company: string;
  action: string;
}

const ICON_MAP: Record<string, typeof TrendingUp> = {
  TrendingUp,
  Signal,
  Monitor,
  Globe,
};

const FALLBACK_RULES: ActivationRule[] = [];
const FALLBACK_TIMELINE: TimelineEntry[] = [];
const FALLBACK_QUEUE: QueueRow[] = [];

/* ── Status Badge ── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; dot: string }> = {
    Pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
    Active: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
    Completed: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', dot: '#10B981' },
    Failed: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', dot: '#EF4444' },
  };
  const c = config[status] || config.Pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: c.color, background: c.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

/* ── Main Component ── */

export function ActivationWorkspace() {
  const [rules, setRules] = useState<ActivationRule[]>(FALLBACK_RULES);
  const [queueData, setQueueData] = useState<QueueRow[]>(FALLBACK_QUEUE);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(FALLBACK_TIMELINE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingAll, setActivatingAll] = useState(false);

  const fetchAllData = useCallback(async () => {
    let cancelled = false;
    try {
      setLoading(true);
      setError(null);

      // Fetch queue, rules, and timeline in parallel
      const [queueRes, rulesRes, timelineRes] = await Promise.all([
        fetchApi('/api/organizations', { params: { limit: 10, status: 'active' } }),
        fetchApi('/api/activation-rules'),
        fetchApi('/api/activation-timeline', { params: { limit: 10 } }),
      ]);

      if (cancelled) return;

      // Process queue data
      if (!queueRes.error && queueRes.data) {
        const payload = queueRes.data as { data?: Record<string, unknown>[] };
        if (payload.data?.length) {
          const mapped: QueueRow[] = payload.data.map((o, i) => ({
            id: (o.id as number) ?? i + 1,
            company: (o.name as string) ?? '',
            domain: (o.domain as string) ?? '',
            industry: (o.industry as string) ?? '',
            status: (o.trackingStatus === 'active'
              ? 'Active'
              : o.trackingStatus === 'completed'
                ? 'Completed'
                : 'Pending') as QueueRow['status'],
            progress: (o.intelligenceScore as number) ?? 0,
          }));
          setQueueData(mapped);
        }
      }

      // Process rules data
      if (!rulesRes.error && rulesRes.data) {
        const rulesPayload = rulesRes.data as {
          data?: {
            id: string;
            name: string;
            description: string;
            iconName: string;
            enabled: boolean;
            color: string;
            liveCount?: number;
          }[];
        };
        if (rulesPayload.data?.length) {
          const mappedRules: ActivationRule[] = rulesPayload.data.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            icon: ICON_MAP[r.iconName] ?? TrendingUp,
            enabled: r.enabled,
            color: r.color,
            liveCount: r.liveCount,
          }));
          setRules(mappedRules);
        }
      }

      // Process timeline data
      if (!timelineRes.error && timelineRes.data) {
        const timelinePayload = timelineRes.data as {
          data?: TimelineEntry[];
        };
        if (timelinePayload.data?.length) {
          setTimeline(timelinePayload.data);
        }
      }
    } catch (err) {
      if (!cancelled)
        setError(err instanceof Error ? err.message : 'Failed to load activation workspace');
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Compute stats from API data
  const activeCount = queueData.filter((r) => r.status === 'Active').length;
  const completedCount = queueData.filter((r) => r.status === 'Completed').length;
  const queuedCount = queueData.length;
  const successRate =
    queueData.length > 0
      ? (((activeCount + completedCount) / queueData.length) * 100).toFixed(1)
      : '0.0';

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleActivateAll = async () => {
    setActivatingAll(true);
    try {
      const res = await fetchApi('/api/activations/run-all', { method: 'POST' });
      if (res.error) {
        toast.error(`Activation failed: ${res.error}`);
      } else {
        toast.success('All activations triggered successfully');
        await fetchAllData();
      }
    } catch {
      toast.error('Failed to activate all accounts');
    } finally {
      setActivatingAll(false);
    }
  };

  const handleToggleActivation = async (orgId: number | string) => {
    try {
      const res = await fetchApi(`/api/activations/${orgId}/toggle`, { method: 'POST' });
      if (res.error) {
        toast.error(`Toggle failed: ${res.error}`);
        return;
      }
      // Update local state: flip the status
      setQueueData((prev) =>
        prev.map((row) => {
          if (row.id !== orgId) return row;
          let nextStatus: QueueRow['status'];
          switch (row.status) {
            case 'Pending':
              nextStatus = 'Active';
              break;
            case 'Active':
              nextStatus = 'Pending';
              break;
            case 'Failed':
              nextStatus = 'Active';
              break;
            default:
              nextStatus = row.status;
          }
          return { ...row, status: nextStatus };
        }),
      );
      toast.success(
        `Toggled activation for ${queueData.find((r) => r.id === orgId)?.company ?? 'account'}`,
      );
    } catch {
      toast.error('Failed to toggle activation');
    }
  };

  return (
    <div role="region" aria-label="Activation Workspace">
      <PageTransition className="p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                Loading activation workspace…
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-4" role="status" aria-live="polite">
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
          <>
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Activation Workspace
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
                  Configure &amp; activate intelligence gathering for target accounts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PulseDot color="#3B82F6" />
                <span className="text-xs font-medium" style={{ color: '#3B82F6' }}>
                  {activeCount} active scans running
                </span>
              </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div aria-label={`Accounts Queued: ${queuedCount}`}>
                <StatCard
                  label="Accounts Queued"
                  value={queuedCount}
                  icon={Timer}
                  color="#F59E0B"
                />
              </div>
              <div aria-label={`Active Scannings: ${activeCount}`}>
                <StatCard label="Active Scannings" value={activeCount} icon={Zap} color="#3B82F6" />
              </div>
              <div aria-label={`Completed: ${completedCount}`}>
                <StatCard
                  label="Completed"
                  value={completedCount}
                  icon={CheckCircle2}
                  color="#10B981"
                />
              </div>
              <div aria-label={`Success Rate: ${successRate}%`}>
                <StatCard
                  label="Success Rate"
                  value={`${successRate}%`}
                  icon={BarChart3}
                  color="#8B5CF6"
                />
              </div>
            </div>

            {/* ── Main 2-Column Layout ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Activation Queue Table */}
              <div className="xl:col-span-2">
                <GlassPanel className="p-0 overflow-hidden">
                  <div
                    className="px-5 py-4 flex items-center justify-between border-b"
                    style={{ borderBottomColor: 'var(--ios-border)' }}
                  >
                    <div>
                      <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        Activation Queue
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>
                        {queueData.length} accounts in current batch
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleActivateAll}
                        disabled={activatingAll}
                        aria-label="Activate All"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
                      >
                        {activatingAll ? (
                          <div className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        {activatingAll ? 'Activating…' : 'Activate All'}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr
                          className="text-xs font-medium uppercase tracking-wider"
                          style={{
                            color: 'var(--ios-text-secondary)',
                            background: 'var(--ios-bg-secondary)',
                          }}
                        >
                          <th className="px-5 py-3">Company</th>
                          <th className="px-5 py-3">Industry</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Progress</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queueData.map((row, i) => (
                          <motion.tr
                            key={row.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="border-t transition-colors hover:bg-[var(--ios-bg-elevated)]"
                            style={{ borderTopColor: 'var(--ios-border)' }}
                          >
                            <td className="px-5 py-3">
                              <div>
                                <p
                                  className="text-sm font-medium"
                                  style={{ color: 'var(--ios-text-primary)' }}
                                >
                                  {row.company}
                                </p>
                                <p
                                  className="text-xs"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {row.domain}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className="text-xs px-2 py-0.5 rounded-md"
                                style={{
                                  color: 'var(--ios-text-secondary)',
                                  background: 'var(--ios-bg-elevated)',
                                }}
                              >
                                {row.industry}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex-1 h-1.5 rounded-full"
                                  style={{ background: 'var(--ios-bg-elevated)' }}
                                >
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                      background:
                                        row.status === 'Completed'
                                          ? '#10B981'
                                          : row.status === 'Failed'
                                            ? '#EF4444'
                                            : '#3B82F6',
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${row.progress}%` }}
                                    transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                                  />
                                </div>
                                <span
                                  className="text-xs tabular-nums w-8 text-right"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {row.progress}%
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {row.status === 'Pending' && (
                                  <button
                                    onClick={() => handleToggleActivation(row.id)}
                                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                                    style={{ color: '#10B981' }}
                                    title="Start activation"
                                    aria-label={`Toggle tracking for ${row.company}`}
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {row.status === 'Active' && (
                                  <button
                                    onClick={() => handleToggleActivation(row.id)}
                                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                                    style={{ color: '#F59E0B' }}
                                    title="Pause"
                                    aria-label={`Toggle tracking for ${row.company}`}
                                  >
                                    <Pause className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {row.status === 'Failed' && (
                                  <button
                                    onClick={() => handleToggleActivation(row.id)}
                                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                                    style={{ color: '#3B82F6' }}
                                    title="Retry"
                                    aria-label={`Toggle tracking for ${row.company}`}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  className="p-1.5 rounded-md transition-colors hover:bg-[var(--ios-bg-elevated)]"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassPanel>
              </div>

              {/* Right: Activation Rules Panel */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                  Activation Rules
                </h2>
                <StaggerGrid className="space-y-3" stagger={0.08}>
                  {rules.map((rule) => {
                    const Icon = rule.icon;
                    return (
                      <StaggerItem key={rule.id}>
                        <AnimatedCard delay={0} className="p-4" glow={`${rule.color}20`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: `${rule.color}15` }}
                              >
                                <Icon className="w-4 h-4" style={{ color: rule.color }} />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-semibold"
                                  style={{ color: 'var(--ios-text-primary)' }}
                                >
                                  {rule.name}
                                </p>
                                <p
                                  className="text-xs mt-1 leading-relaxed"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                  {rule.description}
                                </p>
                                {rule.liveCount !== undefined && (
                                  <p
                                    className="text-[11px] mt-1.5 font-medium"
                                    style={{ color: rule.color }}
                                  >
                                    {rule.liveCount} live signals
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleRule(rule.id)}
                              className="shrink-0 mt-0.5"
                              aria-label={`Toggle ${rule.name}`}
                            >
                              {rule.enabled ? (
                                <ToggleRight className="w-7 h-7" style={{ color: rule.color }} />
                              ) : (
                                <ToggleLeft
                                  className="w-7 h-7"
                                  style={{ color: 'var(--ios-text-secondary)' }}
                                />
                              )}
                            </button>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    );
                  })}
                </StaggerGrid>
              </div>
            </div>

            {/* ── Bottom: Activation Timeline ── */}
            <GlassPanel className="p-5">
              <h2
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--ios-text-primary)' }}
              >
                Recent Activations
              </h2>
              {timeline.length > 0 ? (
                <div className="space-y-0">
                  {timeline.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
                      className="flex items-center gap-4 py-2.5"
                      style={{
                        borderBottom:
                          i < timeline.length - 1 ? '1px solid var(--ios-border)' : 'none',
                      }}
                    >
                      <span
                        className="text-xs tabular-nums w-20 shrink-0"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      >
                        {item.time}
                      </span>
                      <ChevronRight
                        className="w-3 h-3 shrink-0"
                        style={{ color: 'var(--ios-border)' }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        {item.company}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                        {item.action}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p
                  className="text-xs text-center py-8"
                  style={{ color: 'var(--ios-text-secondary)' }}
                >
                  No recent activations
                </p>
              )}
            </GlassPanel>
          </>
        )}
      </PageTransition>
    </div>
  );
}
