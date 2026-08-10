/**
 * P3.5 — Evidence Chain Validation
 *
 * Proactively validates evidence citations for freshness and accuracy.
 * Runs as a scheduled job to maintain evidence quality.
 *
 * Architecture:
 *   Scheduled Job → Scan Evidence → Mark Decay → Recalc Confidence → Alert
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { FRESHNESS_LIFECYCLE_DAYS } from '@/lib/ai-governance';

const EVIDENCE_STALE_DAYS = 30; // Evidence older than 30 days is decayed
const DECAY_ALERT_THRESHOLD = 0.20; // Alert if > 20% of evidence is decayed

// In-memory store for the last validation report (served by GET endpoint)
let _lastReport: EvidenceValidationReport | null = null;

export interface EvidenceValidationReport {
  runAt: string;
  totalEvidence: number;
  freshCount: number;
  agingCount: number;
  decayedCount: number;
  supersededCount: number;
  expiredCount: number;
  decayRate: number;
  needsAttention: boolean;
  domainBreakdown: Array<{
    domain: string;
    total: number;
    decayed: number;
    decayRate: number;
  }>;
  updatedEvidenceIds: string[];
  confidenceRecalculated: number;
}

/**
 * Return the last validation report (or null if never run).
 * Used by the GET /api/ai/evidence/validation endpoint.
 */
export function getLastValidationReport(): EvidenceValidationReport | null {
  return _lastReport;
}

/**
 * Run evidence chain validation across all active evidence.
 * Marks stale evidence, recalculates confidence, triggers alerts.
 */
export async function validateEvidenceChains(): Promise<EvidenceValidationReport> {
  const report: EvidenceValidationReport = {
    runAt: new Date().toISOString(),
    totalEvidence: 0,
    freshCount: 0,
    agingCount: 0,
    decayedCount: 0,
    supersededCount: 0,
    expiredCount: 0,
    decayRate: 0,
    needsAttention: false,
    domainBreakdown: [],
    updatedEvidenceIds: [],
    confidenceRecalculated: 0,
  };

  try {
    // 1. Get all active evidence
    const activeEvidence = await db.evidence.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        companyId: true,
        sourceUrl: true,
        sourceDate: true,
        createdAt: true,
        extractedField: true,
        relevanceScore: true,
        confidence: true,
      },
      take: 10000, // Batch limit to avoid memory issues
    });

    report.totalEvidence = activeEvidence.length;
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

    const domainCounts: Record<string, { total: number; decayed: number }> = {};

    // 2. Classify and update evidence status
    for (const evidence of activeEvidence) {
      const ageDays = (now.getTime() - new Date(evidence.createdAt).getTime()) / msPerDay;
      const sourceAge = evidence.sourceDate
        ? (now.getTime() - new Date(evidence.sourceDate).getTime()) / msPerDay
        : ageDays;

      const domain = evidence.extractedField || 'general';
      if (!domainCounts[domain]) domainCounts[domain] = { total: 0, decayed: 0 };
      domainCounts[domain].total++;

      let newStatus: string | null = null;

      if (sourceAge > EVIDENCE_STALE_DAYS) {
        // Evidence source is old — mark as expired
        report.expiredCount++;
        newStatus = 'expired';
        domainCounts[domain].decayed++;
      } else if (ageDays > EVIDENCE_STALE_DAYS) {
        // Evidence record is old but source is still recent
        report.decayedCount++;
        newStatus = 'aging';
        domainCounts[domain].decayed++;
        report.updatedEvidenceIds.push(evidence.id);
      } else if (ageDays > EVIDENCE_STALE_DAYS * 0.6) {
        report.agingCount++;
      } else {
        report.freshCount++;
      }

      // Batch update evidence status and reduce confidence for decayed evidence
      if (newStatus) {
        const confidenceDecay = newStatus === 'expired' ? 0.3 : 0.5;
        try {
          await db.evidence.update({
            where: { id: evidence.id },
            data: {
              status: newStatus,
              confidence: Math.max(0.1, (evidence.confidence ?? 0.5) * confidenceDecay),
            },
          });
        } catch (updateErr) {
          logger.error(`[evidence-validator] Failed to update evidence ${evidence.id}`, { error: updateErr });
        }
      }
    }

    // 3. Recalculate confidence for company research cards affected by decayed evidence
    report.confidenceRecalculated = await recalculateAffectedConfidence(report.updatedEvidenceIds);

    // 4. Build domain breakdown
    report.domainBreakdown = Object.entries(domainCounts).map(([domain, counts]) => ({
      domain,
      total: counts.total,
      decayed: counts.decayed,
      decayRate: counts.total > 0 ? Math.round((counts.decayed / counts.total) * 10000) / 100 : 0,
    }));

    // 5. Calculate overall decay rate
    report.decayRate = report.totalEvidence > 0
      ? Math.round(((report.decayedCount + report.expiredCount) / report.totalEvidence) * 10000) / 100
      : 0;
    report.needsAttention = report.decayRate > DECAY_ALERT_THRESHOLD * 100;

    // 6. Log results
    if (report.needsAttention) {
      logger.warn(
        `[evidence-validator] Evidence decay rate ${report.decayRate}% exceeds ${DECAY_ALERT_THRESHOLD * 100}% threshold`,
        { report: JSON.stringify(report) },
      );
    } else {
      logger.info(
        `[evidence-validator] Validation complete: ${report.totalEvidence} evidence checked, ` +
        `${report.decayedCount} decayed, ${report.expiredCount} expired, rate=${report.decayRate}%`,
      );
    }
  } catch (err) {
    logger.error('[evidence-validator] Evidence chain validation failed', { error: err });
  }

  // Always cache the report regardless of errors
  _lastReport = report;
  return report;
}

/**
 * Recalculate confidence for company research cards affected by decayed evidence.
 * Best-effort — individual company failures do not block the main validation.
 */
async function recalculateAffectedConfidence(decayedEvidenceIds: string[]): Promise<number> {
  if (decayedEvidenceIds.length === 0) return 0;

  try {
    // Find companies that have these evidence IDs
    const affectedCompanies = await db.evidence.groupBy({
      by: ['companyId'],
      where: { id: { in: decayedEvidenceIds } },
    });

    let recalculated = 0;
    for (const { companyId } of affectedCompanies) {
      try {
        // Recalculate average evidence confidence for this company
        const companyEvidence = await db.evidence.findMany({
          where: { companyId, status: { in: ['active', 'aging'] } },
          select: { confidence: true },
        });

        if (companyEvidence.length > 0) {
          const avgConfidence = companyEvidence.reduce((sum, e) => sum + (e.confidence ?? 0.5), 0) / companyEvidence.length;
          logger.info(
            `[evidence-validator] Company ${companyId}: recalculated evidence confidence to ${(avgConfidence * 100).toFixed(1)}%`,
          );
        }
        recalculated++;
      } catch {
        // Skip individual company failures — best effort
      }
    }
    return recalculated;
  } catch {
    return 0;
  }
}
