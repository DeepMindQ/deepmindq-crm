/**
 * GET /api/intelligence/heatmap?industry=Technology&minScore=50&limit=100
 *
 * 5.5 — Intelligence Heatmap API
 *
 * Returns a Companies × Intelligence Dimensions matrix.
 * Each company has scores across the 6 confidence dimensions,
 * suitable for rendering a heatmap visualization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeUnifiedConfidence, type ConfidenceInput, type ConfidenceDimension } from '@/lib/ai-unified-confidence';
import { checkApiAuth } from '@/lib/api-auth';

// ── Dimensions ─────────────────────────────────────────────────────────

const DIMENSIONS: ConfidenceDimension[] = [
  'data_quality',
  'source_reliability',
  'freshness',
  'cross_validation',
  'evidence_coverage',
  'ai_certainty',
];

// ── GET ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const industry = url.searchParams.get('industry') || undefined;
    const minScoreParam = url.searchParams.get('minScore');
    const minScore = minScoreParam ? parseInt(minScoreParam, 10) : 0;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (industry) {
      where.industry = { contains: industry, mode: 'insensitive' };
    }
    if (minScore > 0) {
      where.intelligenceScore = { gte: minScore };
    }

    // Fetch companies with their scores
    const companies = await db.company.findMany({
      where,
      select: {
        id: true,
        rawName: true,
        industry: true,
        domain: true,
        lastEnrichedAt: true,
        intelligenceScore: true,
        _count: {
          select: {
            evidence: true,
            signals: true,
          },
        },
      },
      orderBy: { intelligenceScore: 'desc' },
      take: limit,
    });

    // Compute confidence dimensions for each company
    const heatmapCompanies = await Promise.all(
      companies.map(async (company) => {
        const evidenceCount = company._count.evidence;
        const signalCount = company._count.signals;
        const daysSinceResearch = company.lastEnrichedAt
          ? Math.floor((Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        const confidenceInput: ConfidenceInput = {
          entityId: company.id,
          entityType: 'company',
          evidenceCount,
          totalFacts: evidenceCount + signalCount,
          crossValidatedFacts: Math.floor(evidenceCount * 0.4),
          daysSinceResearch,
          freshnessScore: daysSinceResearch !== undefined
            ? Math.max(0, 100 - daysSinceResearch * 0.5)
            : undefined,
          dataCompleteness: Math.min(1, (evidenceCount + signalCount) / 20),
        };

        const result = computeUnifiedConfidence(confidenceInput);

        // Build dimension scores
        const scores: Record<string, number> = {};
        for (const factor of result.factors) {
          scores[factor.dimension] = factor.score;
        }

        return {
          id: company.id,
          name: company.rawName,
          industry: company.industry,
          domain: company.domain,
          scores,
          unifiedScore: result.score,
          grade: result.grade,
        };
      })
    );

    const response = {
      companies: heatmapCompanies,
      dimensions: DIMENSIONS,
      totalCompanies: companies.length,
      generatedAt: new Date().toISOString(),
    };

    logger.info('[heatmap] Generated', {
      industry: industry ?? 'all',
      minScore,
      companiesReturned: companies.length,
    });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[heatmap] GET failed', { error: message });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
