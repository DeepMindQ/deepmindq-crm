/**
 * Confidence Score Explainability (Phase 6.1)
 *
 * Explains WHY a confidence score is what it is by producing
 * positive and negative contributing factors.
 */

import { db } from '@/lib/db';
import type { Prisma as PrismaNS } from '@prisma/client';

export interface ConfidenceFactor {
  factor: string;
  impact: string; // e.g. "+12", "-5"
  category: 'signal' | 'evidence' | 'capability' | 'data';
}

export interface ConfidenceFactorsResult {
  positiveFactors: ConfidenceFactor[];
  negativeFactors: ConfidenceFactor[];
}

function fmt(delta: number): string {
  return delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`;
}

export async function computeConfidenceFactors(
  companyId: string,
  signalId: string,
  matchScore: number,
): Promise<ConfidenceFactorsResult> {
  const positiveFactors: ConfidenceFactor[] = [];
  const negativeFactors: ConfidenceFactor[] = [];

  // ── Signal dimension ──
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
    select: { signalType: true, confidence: true, impact: true, signalDate: true },
  });

  if (signal) {
    const sigScore = Math.round(signal.confidence * 100);
    if (sigScore >= 80) {
      positiveFactors.push({
        factor: `${signal.signalType || 'Buying'} signal has high confidence (${sigScore}%)`,
        impact: fmt(sigScore * 0.30 * 0.15),
        category: 'signal',
      });
    } else if (sigScore < 50) {
      negativeFactors.push({
        factor: `${signal.signalType || 'Buying'} signal has low confidence (${sigScore}%)`,
        impact: fmt((sigScore - 70) * 0.30 * 0.15),
        category: 'signal',
      });
    }

    // Signal freshness
    if (signal.signalDate) {
      const ageDays = Math.floor((Date.now() - signal.signalDate.getTime()) / 86400000);
      if (ageDays > 60) {
        negativeFactors.push({
          factor: `Signal is ${ageDays} days old (stale data)`,
          impact: fmt(-8),
          category: 'signal',
        });
      } else if (ageDays <= 14) {
        positiveFactors.push({
          factor: `Recent signal (${ageDays} days old)`,
          impact: fmt(+6),
          category: 'signal',
        });
      }
    }

    // Signal impact
    if (signal.impact === 'high') {
      positiveFactors.push({
        factor: 'High-impact signal detected',
        impact: fmt(+5),
        category: 'signal',
      });
    }
  }

  // ── Evidence dimension ──
  const evidence = await db.evidence.findMany({
    where: { companyId },
    select: { sourceUrl: true, sourceQualityTier: true, relevanceScore: true },
    take: 50,
  });

  const highQualityCount = evidence.filter(e => e.sourceQualityTier === 'primary' || e.sourceQualityTier === 'high').length;
  const domains = new Set(evidence.map(e => {
    try { return new URL(e.sourceUrl).hostname.replace(/^www\./, ''); } catch { return 'unknown'; }
  }));

  if (highQualityCount >= 3) {
    positiveFactors.push({
      factor: `${highQualityCount} high-quality evidence sources`,
      impact: fmt(+highQualityCount * 2),
      category: 'evidence',
    });
  }

  if (domains.size >= 3) {
    positiveFactors.push({
      factor: `Evidence from ${domains.size} distinct sources`,
      impact: fmt(+5),
      category: 'evidence',
    });
  } else if (evidence.length > 0 && domains.size === 1) {
    negativeFactors.push({
      factor: 'Single source evidence',
      impact: fmt(-5),
      category: 'evidence',
    });
  }

  if (evidence.length === 0) {
    negativeFactors.push({
      factor: 'No evidence found for this company',
      impact: fmt(-15),
      category: 'evidence',
    });
  }

  // ── Capability dimension ──
  const capScore = Math.round(matchScore * 100);
  if (capScore >= 85) {
    positiveFactors.push({
      factor: `Strong capability match (${capScore}%)`,
      impact: fmt(+8),
      category: 'capability',
    });
  } else if (capScore < 50) {
    negativeFactors.push({
      factor: `Weak capability fit (${capScore}%)`,
      impact: fmt(-6),
      category: 'capability',
    });
  }

  // ── Data completeness dimension ──
  const health = await db.companyIntelligenceHealth.findUnique({
    where: { companyId },
    select: { dataCompletenessScore: true, signalQualityScore: true },
  });

  const completeness = health?.dataCompletenessScore ?? 0;
  if (completeness >= 70) {
    positiveFactors.push({
      factor: `Complete intelligence profile (${completeness}%)`,
      impact: fmt(+4),
      category: 'data',
    });
  } else if (completeness < 30) {
    negativeFactors.push({
      factor: `Incomplete company data (${completeness}%)`,
      impact: fmt(-6),
      category: 'data',
    });
  }

  // ── Conflicts penalty ──
  const conflictCount = await db.intelligenceConflict.count({
    where: { companyId, resolutionStatus: 'open' },
  });

  if (conflictCount > 0) {
    negativeFactors.push({
      factor: `${conflictCount} unresolved intelligence conflict${conflictCount > 1 ? 's' : ''}`,
      impact: fmt(-conflictCount * 4),
      category: 'evidence',
    });
  }

  // ── Source reliability bonus ──
  for (const d of domains) {
    const reliability = await db.evidenceSourceReliability.findUnique({
      where: { domain: d },
    });
    if (reliability && reliability.reliabilityScore >= 0.8) {
      positiveFactors.push({
        factor: `High-reliability source: ${d} (${Math.round(reliability.reliabilityScore * 100)}%)`,
        impact: fmt(+3),
        category: 'evidence',
      });
      break; // Only add top one
    }
  }

  return { positiveFactors, negativeFactors };
}

export async function populateConfidenceFactors(
  recommendationId: string,
): Promise<void> {
  const rec = await db.opportunityRecommendation.findUnique({
    where: { id: recommendationId },
    select: { companyId: true, signalId: true, matchScore: true },
  });
  if (!rec) return;

  const factors = await computeConfidenceFactors(rec.companyId, rec.signalId, rec.matchScore);

  await db.opportunityRecommendation.update({
    where: { id: recommendationId },
    data: { confidenceFactors: factors as unknown as PrismaNS.InputJsonValue },
  });
}