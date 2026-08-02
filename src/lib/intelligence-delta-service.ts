/**
 * Intelligence Delta Service — "What changed since I last looked?"
 * ═══════════════════════════════════════════════════════════════
 *
 * Computes meaningful changes in account intelligence over time
 * by comparing consecutive IntelligenceSnapshot records.
 *
 * Delta types:
 *   - score_change: Intelligence score shifted significantly
 *   - new_signal: New signals detected since last snapshot
 *   - evidence_update: New evidence records added
 *   - priority_shift: Priority tier changed (HOT → ACTIVE, etc.)
 *   - confidence_change: High-severity signal count changed
 *
 * Non-throwing contract: Returns { success, deltas, error? }.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export type DeltaType =
  | 'score_change'
  | 'new_signal'
  | 'evidence_update'
  | 'priority_shift'
  | 'confidence_change';

export interface AccountDelta {
  id: string;
  companyId: string;
  companyName: string;
  deltaType: DeltaType;
  direction: 'up' | 'down' | 'new';
  previousValue: number;
  newValue: number;
  magnitude: number;
  reasoning: string;
  confidence: number;
  signalIds?: string[];
  evidence?: Array<{ source: string; snippet: string }>;
  detectedAt: string;
}

export interface DeltaServiceResult {
  success: boolean;
  deltas: AccountDelta[];
  meta?: {
    companiesScanned: number;
    snapshotsCompared: number;
    computationMs: number;
  };
  error?: string | null;
}

// ─── Thresholds ────────────────────────────────────────────────────────

const SCORE_CHANGE_THRESHOLD = 5;      // Minimum score change to report
const SIGNAL_COUNT_THRESHOLD = 2;      // Minimum new signals to report as "new_signal" delta
const EVIDENCE_COUNT_THRESHOLD = 3;     // Minimum new evidence to report
const HIGH_SEVERITY_THRESHOLD = 1;     // Minimum high-severity change

// ─── Core Functions ──────────────────────────────────────────────────────

/**
 * Compute intelligence deltas across all companies.
 * Compares the 2 most recent snapshots per company.
 */
export async function computeIntelligenceDeltas(options?: {
  limit?: number;
  companyId?: string;
  minMagnitude?: number;
}): Promise<DeltaServiceResult> {
  const startedAt = Date.now();
  const { limit = 20, companyId, minMagnitude = 3 } = options ?? {};

  try {
    // Get companies with at least 2 snapshots
    const companies = companyId
      ? await db.company.findMany({
          where: { id: companyId },
          select: { id: true, rawName: true },
        })
      : await db.$queryRaw<Array<{ id: string; rawName: string; snapshotCount: bigint }>>`
        SELECT c."id", c."rawName", COUNT(s.id)::bigint as "snapshotCount"
        FROM "Company" c
        INNER JOIN "IntelligenceSnapshot" s ON s."companyId" = c."id"
        WHERE c."status" != 'archived'
        GROUP BY c."id", c."rawName"
        HAVING COUNT(s.id) >= 2
        ORDER BY MAX(s."capturedAt") DESC
        LIMIT ${Math.min(limit * 3, 100)}
      `;

    if (!companies.length) {
      return {
        success: true,
        deltas: [],
        meta: { companiesScanned: 0, snapshotsCompared: 0, computationMs: Date.now() - startedAt },
      };
    }

    const companyIds = companies.map(c => (c as unknown as { id: string }).id);
    const companyMap = new Map(companies.map(c => [
      (c as unknown as { id: string }).id,
      (c as unknown as { rawName: string }).rawName,
    ]));

    // Batch-fetch the 2 most recent snapshots per company
    const snapshots = await db.intelligenceSnapshot.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { capturedAt: 'desc' },
    });

    // Group snapshots by company
    const byCompany = new Map<string, typeof snapshots>();
    for (const snap of snapshots) {
      const existing = byCompany.get(snap.companyId) ?? [];
      existing.push(snap);
      byCompany.set(snap.companyId, existing);
    }

    // Compute deltas for each company
    const allDeltas: AccountDelta[] = [];
    let snapshotsCompared = 0;

    for (const [cId, snaps] of byCompany) {
      // Need at least 2 snapshots to compute a delta
      if (snaps.length < 2) continue;

      // Sort by capturedAt descending — [0] is latest, [1] is previous
      snaps.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
      const latest = snaps[0];
      const previous = snaps[1];

      snapshotsCompared++;

      const companyName = companyMap.get(cId) ?? 'Unknown Company';
      const timeAgo = formatTimeAgo(latest.capturedAt);

      // ── Score Change Delta ──
      const scoreDiff = latest.intelligenceScore - previous.intelligenceScore;
      if (Math.abs(scoreDiff) >= SCORE_CHANGE_THRESHOLD) {
        allDeltas.push({
          id: `delta-score-${cId}`,
          companyId: cId,
          companyName,
          deltaType: 'score_change',
          direction: scoreDiff > 0 ? 'up' : 'down',
          previousValue: previous.intelligenceScore,
          newValue: latest.intelligenceScore,
          magnitude: Math.abs(scoreDiff),
          reasoning: buildScoreReasoning(
            scoreDiff,
            latest.activeSignalCount - previous.activeSignalCount,
            latest.activeEvidenceCount - previous.activeEvidenceCount,
          ),
          confidence: computeDeltaConfidence(Math.abs(scoreDiff), latest.activeSignalCount),
          evidence: buildDeltaEvidence(latest, previous, 'score'),
          detectedAt: timeAgo,
        });
      }

      // ── New Signal Delta ──
      const newSignalCount = latest.activeSignalCount - previous.activeSignalCount;
      if (newSignalCount >= SIGNAL_COUNT_THRESHOLD) {
        const newSignalIds = getNewSignalIds(latest.topSignalIds, previous.topSignalIds);
        allDeltas.push({
          id: `delta-signal-${cId}`,
          companyId: cId,
          companyName,
          deltaType: 'new_signal',
          direction: 'new',
          previousValue: previous.activeSignalCount,
          newValue: latest.activeSignalCount,
          magnitude: newSignalCount,
          reasoning: `${newSignalCount} new intelligence signals detected since last snapshot. Total active signals: ${latest.activeSignalCount}.`,
          confidence: Math.min(95, 50 + newSignalCount * 10),
          signalIds: newSignalIds,
          evidence: buildDeltaEvidence(latest, previous, 'signal'),
          detectedAt: timeAgo,
        });
      }

      // ── Evidence Update Delta ──
      const newEvidenceCount = latest.activeEvidenceCount - previous.activeEvidenceCount;
      if (newEvidenceCount >= EVIDENCE_COUNT_THRESHOLD) {
        allDeltas.push({
          id: `delta-evidence-${cId}`,
          companyId: cId,
          companyName,
          deltaType: 'evidence_update',
          direction: newEvidenceCount > 0 ? 'up' : 'down',
          previousValue: previous.activeEvidenceCount,
          newValue: latest.activeEvidenceCount,
          magnitude: Math.abs(newEvidenceCount),
          reasoning: `${Math.abs(newEvidenceCount)} evidence records ${newEvidenceCount > 0 ? 'added' : 'removed'}. Evidence coverage supports intelligence confidence.`,
          confidence: Math.min(80, 40 + Math.abs(newEvidenceCount) * 5),
          evidence: buildDeltaEvidence(latest, previous, 'evidence'),
          detectedAt: timeAgo,
        });
      }

      // ── Priority Shift Delta ──
      if (latest.priorityTier && previous.priorityTier && latest.priorityTier !== previous.priorityTier) {
        const tierOrder: Record<string, number> = { HOT: 4, ACTIVE: 3, NURTURE: 2, LOW: 1 };
        const direction = (tierOrder[latest.priorityTier] ?? 0) > (tierOrder[previous.priorityTier] ?? 0) ? 'up' : 'down';
        allDeltas.push({
          id: `delta-priority-${cId}`,
          companyId: cId,
          companyName,
          deltaType: 'priority_shift',
          direction,
          previousValue: tierOrder[previous.priorityTier] ?? 0,
          newValue: tierOrder[latest.priorityTier] ?? 0,
          magnitude: Math.abs((tierOrder[latest.priorityTier] ?? 0) - (tierOrder[previous.priorityTier] ?? 0)),
          reasoning: `Priority tier shifted from ${previous.priorityTier} to ${latest.priorityTier}. This reflects changes in intelligence scoring and strategic alignment.`,
          confidence: 85,
          evidence: buildDeltaEvidence(latest, previous, 'priority'),
          detectedAt: timeAgo,
        });
      }

      // ── Confidence/Severity Delta ──
      const severityDiff = latest.highSeverityCount - previous.highSeverityCount;
      if (Math.abs(severityDiff) >= HIGH_SEVERITY_THRESHOLD) {
        allDeltas.push({
          id: `delta-severity-${cId}`,
          companyId: cId,
          companyName,
          deltaType: 'confidence_change',
          direction: severityDiff > 0 ? 'up' : 'down',
          previousValue: previous.highSeverityCount,
          newValue: latest.highSeverityCount,
          magnitude: Math.abs(severityDiff),
          reasoning: `High-severity signal count ${severityDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(severityDiff)}. ${severityDiff > 0 ? 'Elevated risk or urgency detected.' : 'Reduced risk profile.'}`,
          confidence: Math.min(90, 60 + Math.abs(severityDiff) * 15),
          evidence: buildDeltaEvidence(latest, previous, 'severity'),
          detectedAt: timeAgo,
        });
      }
    }

    // Filter by minimum magnitude, sort by magnitude descending
    const filtered = allDeltas
      .filter(d => d.magnitude >= minMagnitude)
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, limit);

    return {
      success: true,
      deltas: filtered,
      meta: {
        companiesScanned: companies.length,
        snapshotsCompared,
        computationMs: Date.now() - startedAt,
      },
    };
  } catch (err) {
    logger.error('[intelligence-deltas] Computation failed', { error: err });
    return {
      success: false,
      deltas: [],
      error: err instanceof Error ? err.message : 'Delta computation failed',
    };
  }
}

/**
 * Capture an intelligence snapshot for a company.
 * Call this after enrichment, score refresh, or signal detection.
 */
export async function captureIntelligenceSnapshot(
  companyId: string,
  reason: 'enrichment' | 'score_refresh' | 'signal_detected' | 'scheduled' = 'scheduled',
): Promise<boolean> {
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        intelligenceScore: true,
        priorityTier: true,
      },
    });

    if (!company) return false;

    // Count active signals and evidence in parallel
    const [signalAgg, evidenceAgg] = await Promise.all([
      db.companySignal.aggregate({
        where: {
          companyId,
          status: { in: ['detected', 'validated', 'active'] },
        },
        _count: true,
      }),
      db.evidence.aggregate({
        where: { companyId, status: 'active' },
        _count: true,
      }),
    ]);

    // Get signal type distribution and latest signal IDs
    const recentSignals = await db.companySignal.findMany({
      where: {
        companyId,
        status: { in: ['detected', 'validated', 'active'] },
      },
      select: { id: true, signalType: true, severity: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const highSeverityCount = await db.companySignal.count({
      where: {
        companyId,
        status: { in: ['detected', 'validated', 'active'] },
        severity: { in: ['high', 'critical'] },
      },
    });

    // Deduplicate signal types
    const signalTypes = [...new Set(recentSignals.map(s => s.signalType))];
    const signalIds = recentSignals.map(s => s.id);

    await db.intelligenceSnapshot.create({
      data: {
        companyId,
        intelligenceScore: company.intelligenceScore ?? 0,
        priorityTier: company.priorityTier ?? null,
        activeSignalCount: signalAgg._count,
        activeEvidenceCount: evidenceAgg._count,
        highSeverityCount,
        topSignalTypes: JSON.stringify(signalTypes),
        topSignalIds: JSON.stringify(signalIds),
        captureReason: reason,
      },
    });

    logger.info('[intelligence-snapshot] Captured', {
      companyId,
      company: company.rawName,
      reason,
      score: company.intelligenceScore,
      signals: signalAgg._count,
      evidence: evidenceAgg._count,
    });

    return true;
  } catch (err) {
    logger.error('[intelligence-snapshot] Capture failed', { companyId, error: err });
    return false;
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────

function buildScoreReasoning(
  scoreDiff: number,
  signalDiff: number,
  evidenceDiff: number,
): string {
  const direction = scoreDiff > 0 ? 'increased' : 'decreased';
  const reasons: string[] = [];

  if (Math.abs(scoreDiff) >= 10) {
    reasons.push(`Intelligence score ${direction} by ${Math.abs(scoreDiff)} points — significant shift`);
  } else {
    reasons.push(`Intelligence score ${direction} by ${Math.abs(scoreDiff)} points`);
  }

  if (signalDiff > 0) reasons.push(`${signalDiff} new signals detected`);
  if (signalDiff < 0) reasons.push(`${Math.abs(signalDiff)} signals expired or resolved`);
  if (evidenceDiff > 0) reasons.push(`${evidenceDiff} new evidence records added`);

  return reasons.join('. ') + '.';
}

function computeDeltaConfidence(magnitude: number, signalCount: number): number {
  // Higher magnitude + more signals = higher confidence in the delta
  const base = Math.min(50 + magnitude * 3, 80);
  const signalBonus = Math.min(signalCount * 2, 15);
  return Math.min(base + signalBonus, 95);
}

function getNewSignalIds(latestJson: string | null, previousJson: string | null): string[] {
  try {
    const latest = latestJson ? JSON.parse(latestJson) : [];
    const previous = previousJson ? JSON.parse(previousJson) : [];
    return latest.filter((id: string) => !previous.includes(id));
  } catch {
    return [];
  }
}

function buildDeltaEvidence(
  latest: { topSignalTypes?: string | null; captureReason?: string; capturedAt: Date },
  previous: { topSignalTypes?: string | null },
  _type: string,
): Array<{ source: string; snippet: string }> {
  const evidence: Array<{ source: string; snippet: string }> = [];

  try {
    const latestTypes: string[] = latest.topSignalTypes ? JSON.parse(latest.topSignalTypes) : [];
    const previousTypes: string[] = previous.topSignalTypes ? JSON.parse(previous.topSignalTypes) : [];
    const newTypes = latestTypes.filter(t => !previousTypes.includes(t));

    for (const type of newTypes) {
      evidence.push({
        source: `Signal Detection (${type})`,
        snippet: `New ${type} signal category detected since last snapshot`,
      });
    }
  } catch { /* skip parsing errors */ }

  if (latest.captureReason) {
    evidence.push({
      source: 'Intelligence Snapshot',
      snippet: `Captured via ${latest.captureReason} at ${latest.capturedAt.toISOString()}`,
    });
  }

  return evidence;
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toISOString().split('T')[0];
}
