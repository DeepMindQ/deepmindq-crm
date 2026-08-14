'use client';

import {
  Activity,
  Cpu,
  Database,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { C, timeAgo, type HealthStatus } from './hub-types';

// ═══════════════════════════════════════════════════════════════
// HEALTH INDICATOR
// ═══════════════════════════════════════════════════════════════

export function HealthIndicator({
  health,
  loading,
}: {
  health: HealthStatus | null;
  loading: boolean;
}) {
  const statusMap: Record<
    string,
    { color: string; bg: string; icon: React.ReactNode; label: string }
  > = {
    operational: {
      color: C.success,
      bg: C.successGhost,
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Operational',
    },
    healthy: {
      color: C.success,
      bg: C.successGhost,
      icon: <ShieldCheck className="h-4 w-4" />,
      label: 'Healthy',
    },
    degraded: {
      color: C.warning,
      bg: C.warningGhost,
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Degraded',
    },
    down: {
      color: C.danger,
      bg: C.dangerGhost,
      icon: <XCircle className="h-4 w-4" />,
      label: 'Down',
    },
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
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: overallStatus.bg }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: overallStatus.color }}
          />
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
              <span className="text-xs" style={{ color: C.textSecondary }}>
                AI Provider
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {aiStatus.icon}
              <span className="text-xs font-medium" style={{ color: aiStatus.color }}>
                {aiStatus.label}
              </span>
            </div>
          </div>
          <div className="w-full h-px" style={{ background: C.border }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <span className="text-xs" style={{ color: C.textSecondary }}>
                Database
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {dbStatus.icon}
              <span className="text-xs font-medium" style={{ color: dbStatus.color }}>
                {dbStatus.label}
              </span>
            </div>
          </div>
          <div className="w-full h-px" style={{ background: C.border }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <span className="text-xs" style={{ color: C.textSecondary }}>
                Last Pipeline Run
              </span>
            </div>
            <span className="text-xs font-medium" style={{ color: C.textSecondary }}>
              {pipelineTime}
            </span>
          </div>
          {health?.uptime !== undefined && (
            <>
              <div className="w-full h-px" style={{ background: C.border }} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
                  <span className="text-xs" style={{ color: C.textSecondary }}>
                    Uptime (30d)
                  </span>
                </div>
                <span className="text-xs font-medium" style={{ color: C.success }}>
                  {health.uptime}%
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
