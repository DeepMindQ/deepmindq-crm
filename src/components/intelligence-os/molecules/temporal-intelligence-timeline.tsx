/**
 * Phase 4 — Item 7.4: Temporal Intelligence Timeline
 *
 * Displays temporal intelligence metrics for a company:
 *   - Signal velocity (7d/30d)
 *   - Velocity trend (accelerating/stable/decelerating)
 *   - Signal-to-decision latency
 *   - Growth trend
 *   - Days since last update
 */
'use client';

import React from 'react';

export interface TemporalMetrics {
  companyId: string;
  signalsLast7Days: number;
  signalsLast30Days: number;
  signalsPerWeek: number;
  velocityTrend: 'accelerating' | 'stable' | 'decelerating';
  signalToDecisionLatencyHours: number | null;
  medianSignalToDecisionLatencyHours: number | null;
  lastIntelligenceUpdate: string | null;
  daysSinceLastUpdate: number | null;
  growthTrend: 'growing' | 'stable' | 'declining';
  growthRatePercent: number | null;
  computedAt: string;
}

interface TemporalTimelineProps {
  temporal: TemporalMetrics;
  compact?: boolean;
}

const TREND_INDICATORS: Record<string, { icon: string; color: string; label: string }> = {
  accelerating: { icon: '↑↑', color: 'text-emerald-600', label: 'Accelerating' },
  growing: { icon: '↑', color: 'text-emerald-600', label: 'Growing' },
  stable: { icon: '→', color: 'text-blue-600', label: 'Stable' },
  decelerating: { icon: '↓↓', color: 'text-amber-600', label: 'Decelerating' },
  declining: { icon: '↓', color: 'text-red-600', label: 'Declining' },
};

function formatLatency(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function TemporalIntelligenceTimeline({ temporal, compact = false }: TemporalTimelineProps) {
  const velocityIndicator = TREND_INDICATORS[temporal.velocityTrend];
  const growthIndicator = TREND_INDICATORS[temporal.growthTrend];

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Velocity:</span>
          <span className={velocityIndicator.color}>{velocityIndicator.icon}</span>
          <span className="font-medium">{temporal.signalsLast7Days}/7d</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Growth:</span>
          <span className={growthIndicator.color}>{growthIndicator.icon}</span>
          {temporal.growthRatePercent !== null && (
            <span className="font-medium">{temporal.growthRatePercent > 0 ? '+' : ''}{temporal.growthRatePercent}%</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Intelligence Timeline</h3>

      {/* Velocity Section */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-2 rounded bg-muted/50">
          <div className="text-2xl font-bold">{temporal.signalsLast7Days}</div>
          <div className="text-xs text-muted-foreground">Signals / 7d</div>
        </div>
        <div className="text-center p-2 rounded bg-muted/50">
          <div className="text-2xl font-bold">{temporal.signalsLast30Days}</div>
          <div className="text-xs text-muted-foreground">Signals / 30d</div>
        </div>
        <div className="text-center p-2 rounded bg-muted/50">
          <div className="text-2xl font-bold">{temporal.signalsPerWeek}</div>
          <div className="text-xs text-muted-foreground">Signals / week</div>
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Velocity Trend</div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${velocityIndicator.color}`}>
            <span>{velocityIndicator.icon}</span>
            <span>{velocityIndicator.label}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Growth Trend</div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${growthIndicator.color}`}>
            <span>{growthIndicator.icon}</span>
            <span>{growthIndicator.label}</span>
            {temporal.growthRatePercent !== null && (
              <span className="text-xs font-normal">({temporal.growthRatePercent > 0 ? '+' : ''}{temporal.growthRatePercent}%)</span>
            )}
          </div>
        </div>
      </div>

      {/* Latency & Freshness */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Signal → Decision Latency</div>
          <div className="font-medium">{formatLatency(temporal.signalToDecisionLatencyHours)}</div>
          {temporal.medianSignalToDecisionLatencyHours !== null && (
            <div className="text-xs text-muted-foreground">
              Median: {formatLatency(temporal.medianSignalToDecisionLatencyHours)}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Last Intelligence Update</div>
          <div className="font-medium">
            {temporal.daysSinceLastUpdate !== null
              ? temporal.daysSinceLastUpdate === 0
                ? 'Today'
                : `${temporal.daysSinceLastUpdate}d ago`
              : 'No data'}
          </div>
          {temporal.lastIntelligenceUpdate && (
            <div className="text-xs text-muted-foreground">
              {new Date(temporal.lastIntelligenceUpdate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemporalIntelligenceTimeline;
