/**
 * Intelligence Confidence Score (Phase 6 — Module 2)
 *
 * Computes a 4-dimension confidence breakdown for opportunity recommendations:
 *   - Signal Quality (30%): Average confidence of contributing signals
 *   - Evidence Quality (30%): Company evidence quality score
 *   - Capability Fit (25%): Match score from capability match record
 *   - Data Completeness (15%): Company intelligence health data completeness
 *
 * Returns a 0-100 overall score plus per-dimension breakdown stored as JSON
 * on OpportunityRecommendation.confidenceBreakdown.
 */

import { Prisma } from '@prisma/client';
import type { Prisma as PrismaNS } from '@prisma/client';
import { db } from '@/lib/db';

export interface ConfidenceBreakdown {
  signalQuality: number;    // 0-100
  evidenceQuality: number;  // 0-100
  capabilityFit: number;    // 0-100
  dataCompleteness: number; // 0-100
  overall: number;          // 0-100 weighted composite
}

// ── Pure computation (no DB) ──

export function computeConfidenceScore(params: {
  signalQuality: number;
  evidenceQuality: number;
  capabilityFit: number;
  dataCompleteness: number;
}): ConfidenceBreakdown {
  const { signalQuality, evidenceQuality, capabilityFit, dataCompleteness } = params;

  const overall = Math.round(
    signalQuality * 0.30 +
    evidenceQuality * 0.30 +
    capabilityFit * 0.25 +
    dataCompleteness * 0.15,
  );

  return {
    signalQuality: Math.round(signalQuality),
    evidenceQuality: Math.round(evidenceQuality),
    capabilityFit: Math.round(capabilityFit),
    dataCompleteness: Math.round(dataCompleteness),
    overall: Math.min(100, Math.max(0, overall)),
  };
}

// ── DB-backed: compute signal quality for a specific opportunity ──

export async function computeSignalQualityForOpportunity(
  companyId: string,
  signalId: string,
): Promise<number> {
  // Get the primary signal's confidence
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
    select: { confidence: true, impact: true },
  });
  if (!signal) return 0;

  // Get all active signals for the same company to compute average
  const activeSignals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['active', 'validated'] },
    },
    select: { confidence: true, impact: true },
  });

  if (activeSignals.length === 0) return Math.round(signal.confidence * 100);

  // Weight by impact: high=1.0, medium=0.6, low=0.3
  const impactWeight: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.3 };
  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of activeSignals) {
    const w = impactWeight[s.impact || 'medium'] ?? 0.6;
    weightedSum += s.confidence * 100 * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ── DB-backed: full confidence breakdown for an opportunity recommendation ──

export async function computeFullConfidenceBreakdown(
  companyId: string,
  signalId: string,
  matchScore: number,
  evidenceQualityScore: number,
): Promise<ConfidenceBreakdown> {
  const [signalQuality, health] = await Promise.all([
    computeSignalQualityForOpportunity(companyId, signalId),
    db.companyIntelligenceHealth.findUnique({
      where: { companyId },
      select: { dataCompletenessScore: true },
    }),
  ]);

  const dataCompleteness = health?.dataCompletenessScore ?? 0;

  return computeConfidenceScore({
    signalQuality,
    evidenceQuality: evidenceQualityScore,
    capabilityFit: matchScore * 100, // matchScore is 0-1
    dataCompleteness,
  });
}

// ── DB-backed: compute and populate confidenceBreakdown on an existing recommendation ──

export async function populateConfidenceBreakdown(
  recommendationId: string,
): Promise<void> {
  const rec = await db.opportunityRecommendation.findUnique({
    where: { id: recommendationId },
    select: {
      companyId: true,
      signalId: true,
      matchScore: true,
    },
  });
  if (!rec) return;

  // Compute evidence quality for the company
  const { computeEvidenceQuality } = await import('./research-engine/evidence-quality');
  const eq = await computeEvidenceQuality(rec.companyId);

  const breakdown = await computeFullConfidenceBreakdown(
    rec.companyId,
    rec.signalId,
    rec.matchScore,
    eq.overall,
  );

  await db.opportunityRecommendation.update({
    where: { id: recommendationId },
    data: { confidenceBreakdown: breakdown as unknown as PrismaNS.InputJsonValue },
  });
}

// ── Batch: populate confidenceBreakdown for all recommendations missing it ──

export async function backfillConfidenceBreakdowns(): Promise<number> {
  const { computeEvidenceQuality } = await import('./research-engine/evidence-quality');

  const recs = await db.opportunityRecommendation.findMany({
    where: { NOT: [{ confidenceBreakdown: { not: Prisma.DbNull } }] },
    select: { id: true, companyId: true, signalId: true, matchScore: true },
    take: 100,
  });

  let updated = 0;
  for (const rec of recs) {
    try {
      const eq = await computeEvidenceQuality(rec.companyId);
      const breakdown = await computeFullConfidenceBreakdown(
        rec.companyId,
        rec.signalId,
        rec.matchScore,
        eq.overall,
      );
      await db.opportunityRecommendation.update({
        where: { id: rec.id },
        data: { confidenceBreakdown: breakdown as unknown as PrismaNS.InputJsonValue },
      });
      updated++;
    } catch (err) {
      console.error(`[intelligence-confidence] Failed for ${rec.id}:`, err);
    }
  }

  return updated;
}