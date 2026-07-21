// GET /api/g-intelligence/companies/[id]/confidence
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeFullConfidenceBreakdown } from '@/lib/intelligence-confidence';
import { computeEvidenceQuality } from '@/lib/research-engine/evidence-quality';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Get query params
  const { searchParams } = new URL(req.url);
  const recommendationId = searchParams.get('recommendationId');

  if (recommendationId) {
    // Return confidence for a specific recommendation
    const rec = await db.opportunityRecommendation.findFirst({
      where: { id: recommendationId, companyId: id },
      select: { id: true, confidenceBreakdown: true, confidenceScore: true, opportunityScore: true },
    });
    if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    return NextResponse.json({
      companyId: id,
      recommendationId: rec.id,
      confidenceBreakdown: rec.confidenceBreakdown,
      legacyConfidenceScore: rec.confidenceScore,
      opportunityScore: rec.opportunityScore,
    });
  }

  // Aggregated confidence across all recommendations for this company
  const recs = await db.opportunityRecommendation.findMany({
    where: { companyId: id, status: { in: ['pending_review', 'accepted', 'monitored'] } },
    select: { id: true, signalId: true, matchScore: true, confidenceBreakdown: true, opportunityScore: true },
    orderBy: { opportunityScore: 'desc' },
  });

  if (recs.length === 0) {
    return NextResponse.json({ companyId: id, recommendations: [], avgConfidence: 0 } as const);
  }

  const eq = await computeEvidenceQuality(id);
  const results: Array<{ recommendationId: string; confidenceBreakdown: Record<string, number> | null; opportunityScore: number }> = [];
  let totalOverall = 0;

  for (const rec of recs) {
    let breakdown = rec.confidenceBreakdown as Record<string, number> | null;
    if (!breakdown) {
      const computed = await computeFullConfidenceBreakdown(id, rec.signalId, rec.matchScore, eq.overall);
      breakdown = {
        signalQuality: computed.signalQuality,
        evidenceQuality: computed.evidenceQuality,
        capabilityFit: computed.capabilityFit,
        dataCompleteness: computed.dataCompleteness,
        overall: computed.overall,
      };
    }
    totalOverall += (breakdown.overall ?? 0);
    results.push({
      recommendationId: rec.id,
      confidenceBreakdown: breakdown,
      opportunityScore: rec.opportunityScore,
    });
  }

  return NextResponse.json({
    companyId: id,
    recommendations: results,
    avgConfidence: Math.round(totalOverall / results.length),
  });
}