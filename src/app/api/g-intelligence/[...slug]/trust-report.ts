import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { populateConfidenceFactors } from '@/lib/confidence-explainability';
import type { Prisma as PrismaNS } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: recommendationId } = await params;
  try {
    const rec = await db.opportunityRecommendation.findUnique({
      where: { id: recommendationId },
      select: {
        id: true,
        opportunityTitle: true,
        confidenceScore: true,
        confidenceBreakdown: true,
        confidenceFactors: true,
        company: { select: { id: true, normalizedName: true } },
      },
    });

    if (!rec) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    // If no factors computed yet, compute them now
    let factors = rec.confidenceFactors as { positiveFactors: unknown[]; negativeFactors: unknown[] } | null;
    if (!factors) {
      await populateConfidenceFactors(recommendationId);
      const updated = await db.opportunityRecommendation.findUnique({
        where: { id: recommendationId },
        select: { confidenceFactors: true },
      });
      factors = updated?.confidenceFactors as typeof factors | null;
    }

    // Get validation status for this company
    const validations = await db.signalValidation.findMany({
      where: { companyId: rec.company.id },
      select: { signalId: true, validationStatus: true, confidenceScore: true },
    });

    // Get conflicts
    const conflicts = await db.intelligenceConflict.findMany({
      where: { companyId: rec.company.id, resolutionStatus: 'open' },
      select: { conflictType: true, severity: true, description: true },
      take: 10,
    });

    // Get evidence summary
    const evidenceStats = await db.evidence.aggregate({
      where: { companyId: rec.company.id },
      _count: true,
      _avg: { relevanceScore: true },
    });

    // Missing intelligence gaps
    const company = await db.company.findUnique({
      where: { id: rec.company.id },
      select: { domain: true, industry: true, sizeRange: true, location: true, country: true, website: true },
    });

    const missingIntelligence: string[] = [];
    if (!company?.domain) missingIntelligence.push('Company domain');
    if (!company?.industry) missingIntelligence.push('Industry classification');
    if (!company?.sizeRange) missingIntelligence.push('Company size');
    if (!company?.location) missingIntelligence.push('Location data');
    if (!company?.country) missingIntelligence.push('Country');
    if (!company?.website) missingIntelligence.push('Website URL');
    if (evidenceStats._count === 0) missingIntelligence.push('Evidence records');
    if (validations.length === 0) missingIntelligence.push('Signal validation');

    return NextResponse.json({
      recommendation: {
        id: rec.id,
        title: rec.opportunityTitle,
        company: rec.company.normalizedName,
        confidenceScore: Math.round(rec.confidenceScore * 100),
      },
      overallConfidence: (rec.confidenceBreakdown as { overall: number } | null)?.overall ?? Math.round(rec.confidenceScore * 100),
      breakdown: rec.confidenceBreakdown,
      factors,
      supportingEvidence: {
        total: evidenceStats._count,
        avgRelevance: evidenceStats._avg.relevanceScore ? Math.round(evidenceStats._avg.relevanceScore * 100) : 0,
        validatedSignals: validations.filter(v => v.validationStatus === 'VALID').length,
        weakSignals: validations.filter(v => v.validationStatus === 'WEAK').length,
      },
      conflicts,
      missingIntelligence,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}