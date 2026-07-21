// GET /api/g-intelligence/companies/[id]/validation-report
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeEvidenceQuality } from '@/lib/research-engine/evidence-quality';
import { getSignalValidationSummary } from '@/lib/signal-validation';
import { computeFullConfidenceBreakdown } from '@/lib/intelligence-confidence';

// Helper: safely extract number from unknown JSON
function num(val: unknown, fallback: number = 0): number {
  return typeof val === 'number' ? val : fallback;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const company = await db.company.findUnique({ where: { id }, select: { rawName: true, normalizedName: true } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // Get the best opportunity recommendation for confidence breakdown
  const bestOpp = await db.opportunityRecommendation.findFirst({
    where: { companyId: id },
    orderBy: { opportunityScore: 'desc' },
    select: { id: true, signalId: true, matchScore: true, confidenceBreakdown: true },
  });

  const [evidenceQuality, signalSummary, health, topConflicts] = await Promise.all([
    computeEvidenceQuality(id),
    getSignalValidationSummary(id),
    db.companyIntelligenceHealth.findUnique({ where: { companyId: id } }),
    db.intelligenceConflict.findMany({
      where: { companyId: id, status: 'open' },
      orderBy: { severity: 'desc' },
      take: 10,
    }),
  ]);

  let intelligenceConfidence = 0;
  let confidenceBreakdown: Record<string, number> | null = null;

  if (bestOpp) {
    if (bestOpp.confidenceBreakdown && typeof bestOpp.confidenceBreakdown === 'object') {
      const cb = bestOpp.confidenceBreakdown as Record<string, unknown>;
      intelligenceConfidence = num(cb.overall);
      confidenceBreakdown = {
        signalQuality: num(cb.signalQuality),
        evidenceQuality: num(cb.evidenceQuality),
        capabilityFit: num(cb.capabilityFit),
        dataCompleteness: num(cb.dataCompleteness),
      };
    } else {
      // Compute on-the-fly if not populated
      const breakdown = await computeFullConfidenceBreakdown(id, bestOpp.signalId, bestOpp.matchScore, evidenceQuality.overall);
      intelligenceConfidence = breakdown.overall;
      confidenceBreakdown = {
        signalQuality: breakdown.signalQuality,
        evidenceQuality: breakdown.evidenceQuality,
        capabilityFit: breakdown.capabilityFit,
        dataCompleteness: breakdown.dataCompleteness,
      };
    }
  }

  return NextResponse.json({
    companyId: id,
    companyName: company.rawName || company.normalizedName,
    intelligenceConfidence,
    confidenceBreakdown,
    signalValidationSummary: signalSummary,
    topConflicts: topConflicts.map(c => ({
      id: c.id,
      conflictType: c.conflictType,
      description: c.description,
      severity: c.severity,
      relatedSignals: c.relatedSignals,
      detectedAt: c.detectedAt.toISOString(),
      status: c.status,
    })),
    evidenceQualitySummary: {
      overall: evidenceQuality.overall,
      coverage: evidenceQuality.coverage,
      freshness: evidenceQuality.freshness,
      sourceQuality: evidenceQuality.sourceQuality,
      corroboration: evidenceQuality.corroboration,
      volume: evidenceQuality.volume,
    },
    healthScore: health?.overallHealthScore ?? null,
    lastCalculatedAt: health?.lastCalculatedAt?.toISOString() ?? null,
  });
}