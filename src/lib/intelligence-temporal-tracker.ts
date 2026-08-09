/**
 * Phase 4 — Item 7.4: Temporal Intelligence Tracking
 *
 * Tracks intelligence velocity and signal-to-decision latency for each company.
 *
 * Metrics tracked:
 *   1. Intelligence Velocity: Rate of new signals/opportunities over time
 *   2. Signal-to-Decision Latency: Time from signal detection to first opportunity
 *   3. Data Refresh Rate: How often intelligence is updated
 *   4. Intelligence Growth Trend: Growing, stable, or declining coverage
 *
 * Usage:
 *   import { computeTemporalMetrics } from '@/lib/intelligence-temporal-tracker';
 *   const temporal = await computeTemporalMetrics('company-id');
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface TemporalIntelligenceMetrics {
  /** Company ID */
  companyId: string;

  // ── Velocity Metrics ──
  /** New signals detected in the last 7 days */
  signalsLast7Days: number;
  /** New signals detected in the last 30 days */
  signalsLast30Days: number;
  /** Average signals per week over the last 90 days */
  signalsPerWeek: number;
  /** Intelligence velocity trend: accelerating, stable, or decelerating */
  velocityTrend: 'accelerating' | 'stable' | 'decelerating';

  // ── Latency Metrics ──
  /** Average time from signal detection to opportunity creation (hours) */
  signalToDecisionLatencyHours: number | null;
  /** Median signal-to-decision latency (hours) */
  medianSignalToDecisionLatencyHours: number | null;

  // ── Refresh Metrics ──
  /** Most recent intelligence update timestamp */
  lastIntelligenceUpdate: string | null;
  /** Days since last intelligence update */
  daysSinceLastUpdate: number | null;

  // ── Growth Metrics ──
  /** Intelligence growth trend over the last 90 days */
  growthTrend: 'growing' | 'stable' | 'declining';
  /** Percentage change in signal count (30d vs 60d) */
  growthRatePercent: number | null;

  // ── Metadata ──
  computedAt: string;
}

/** Time windows for trend analysis (in days) */
const RECENT_WINDOW_DAYS = 7;
const MID_WINDOW_DAYS = 30;
const LONG_WINDOW_DAYS = 90;

/**
 * Compute temporal intelligence metrics for a company.
 *
 * @param companyId - The company to analyze
 * @returns TemporalIntelligenceMetrics with velocity, latency, and growth data
 */
export async function computeTemporalMetrics(
  companyId: string,
): Promise<TemporalIntelligenceMetrics> {
  const now = Date.now();
  const computedAt = new Date().toISOString();

  try {
    // Fetch signals with timestamps using actual Prisma field names:
    //   CompanySignal: extractedAt (when system detected/stored it)
    //   OpportunityRecommendation: createdAt (from @default(now()))
    const signals = await db.companySignal.findMany({
      where: { companyId },
      select: { extractedAt: true },
      orderBy: { extractedAt: 'desc' },
    }).catch(() => []);

    // Fetch opportunities with timestamps
    const opportunities = await db.opportunityRecommendation.findMany({
      where: { companyId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    // Extract timestamps into a uniform format for computation
    const signalTimestamps = signals
      .map(s => s.extractedAt)
      .filter((d): d is Date => d != null);

    const oppTimestamps = opportunities
      .map(o => o.createdAt)
      .filter((d): d is Date => d != null);

    // Compute velocity metrics
    const signalsLast7Days = countTimestampsInWindow(signalTimestamps, RECENT_WINDOW_DAYS);
    const signalsLast30Days = countTimestampsInWindow(signalTimestamps, MID_WINDOW_DAYS);
    const signalsLast90Days = countTimestampsInWindow(signalTimestamps, LONG_WINDOW_DAYS);
    const signalsPerWeek = LONG_WINDOW_DAYS > 0 ? Math.round((signalsLast90Days / (LONG_WINDOW_DAYS / 7)) * 10) / 10 : 0;

    // Compute velocity trend (compare recent 7d vs previous 7d)
    const prevWeekCount = countTimestampsBetween(signalTimestamps, 14, 7);
    const velocityTrend = computeVelocityTrend(signalsLast7Days, prevWeekCount);

    // Compute signal-to-decision latency
    const latencyMetrics = computeSignalToDecisionLatency(signalTimestamps, oppTimestamps);

    // Compute refresh metrics
    const allTimestamps = [...signalTimestamps, ...oppTimestamps].sort((a, b) => b.getTime() - a.getTime());
    const latestTimestamp = allTimestamps[0] ?? null;
    const daysSinceLastUpdate = latestTimestamp
      ? Math.round((now - latestTimestamp.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Compute growth trend (velocity trend and growth trend use same direction labels)
    const recent30 = countTimestampsBetween(signalTimestamps, 30, 0);
    const prev30 = countTimestampsBetween(signalTimestamps, 60, 30);
    const growthDirection = computeVelocityTrend(recent30, prev30);
    // Map velocity labels to growth labels
    const growthTrendMap: Record<string, 'growing' | 'stable' | 'declining'> = {
      accelerating: 'growing',
      stable: 'stable',
      decelerating: 'declining',
    };
    const growthTrend = growthTrendMap[growthDirection] ?? 'stable';
    const growthRatePercent = prev30 > 0
      ? Math.round(((recent30 - prev30) / prev30) * 100)
      : (recent30 > 0 ? 100 : null);

    return {
      companyId,
      signalsLast7Days,
      signalsLast30Days,
      signalsPerWeek,
      velocityTrend,
      signalToDecisionLatencyHours: latencyMetrics.avgHours,
      medianSignalToDecisionLatencyHours: latencyMetrics.medianHours,
      lastIntelligenceUpdate: latestTimestamp?.toISOString() ?? null,
      daysSinceLastUpdate,
      growthTrend,
      growthRatePercent,
      computedAt,
    };
  } catch (error) {
    logger.error(`[temporal-tracker] Computation failed for ${companyId}: ${error}`);
    return {
      companyId,
      signalsLast7Days: 0,
      signalsLast30Days: 0,
      signalsPerWeek: 0,
      velocityTrend: 'stable',
      signalToDecisionLatencyHours: null,
      medianSignalToDecisionLatencyHours: null,
      lastIntelligenceUpdate: null,
      daysSinceLastUpdate: null,
      growthTrend: 'stable',
      growthRatePercent: null,
      computedAt,
    };
  }
}

/**
 * Count timestamps within the last N days from now.
 */
function countTimestampsInWindow(
  timestamps: Date[],
  windowDays: number,
): number {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return timestamps.filter(d => d.getTime() >= cutoff).length;
}

/**
 * Count timestamps between two time windows (fromDaysAgo to toDaysAgo).
 */
function countTimestampsBetween(
  timestamps: Date[],
  fromDaysAgo: number,
  toDaysAgo: number,
): number {
  const now = Date.now();
  const fromCutoff = now - fromDaysAgo * 24 * 60 * 60 * 1000;
  const toCutoff = now - toDaysAgo * 24 * 60 * 60 * 1000;
  return timestamps.filter(d => {
    const time = d.getTime();
    return time >= fromCutoff && time < toCutoff;
  }).length;
}

/**
 * Compute velocity trend direction by comparing two values.
 */
function computeVelocityTrend(recent: number, previous: number): 'accelerating' | 'stable' | 'decelerating' {
  if (previous === 0) return recent > 0 ? 'accelerating' : 'stable';
  const ratio = recent / previous;
  if (ratio > 1.2) return 'accelerating';
  if (ratio < 0.8) return 'decelerating';
  return 'stable';
}

/**
 * Compute signal-to-decision latency.
 * Measures the time between a signal being detected and an opportunity being created.
 */
function computeSignalToDecisionLatency(
  signalTimes: Date[],
  oppTimes: Date[],
): { avgHours: number | null; medianHours: number | null } {
  if (signalTimes.length === 0 || oppTimes.length === 0) {
    return { avgHours: null, medianHours: null };
  }

  const sigMs = signalTimes.map(d => d.getTime()).sort();
  const oppMs = oppTimes.map(d => d.getTime()).sort();

  // For each opportunity, find the earliest signal that predates it
  const latencies: number[] = [];
  for (const oppTime of oppMs) {
    for (const sigTime of sigMs) {
      if (sigTime <= oppTime) {
        latencies.push((oppTime - sigTime) / (1000 * 60 * 60)); // Convert ms to hours
        break; // Use the closest preceding signal
      }
    }
  }

  if (latencies.length === 0) return { avgHours: null, medianHours: null };

  const avgHours = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const sorted = [...latencies].sort((a, b) => a - b);
  const medianHours = sorted.length % 2 === 0
    ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : sorted[Math.floor(sorted.length / 2)];

  return { avgHours, medianHours };
}
