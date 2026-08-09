/**
 * GET /api/intelligence/unified-score?companyId=xxx&tenantId=xxx
 *
 * 5.2 — Unified Score API
 *
 * Returns ONE composite score per company instead of 6 separate scores.
 * Computes the unified score from the scoring orchestrator and returns
 * a simplified response with grade and per-dimension breakdown.
 *
 * If tenantId is provided, applies tenant-specific weights from TenantScoringConfig.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeUnifiedConfidence, type ConfidenceInput, type ConfidenceDimension } from '@/lib/ai-unified-confidence';
import { getTenantConfig } from '@/lib/tenant-scoring-config';

// ── GET ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const tenantId = url.searchParams.get('tenantId') || undefined;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId query parameter is required' },
        { status: 400 },
      );
    }

    // Fetch company and related data in parallel
    const [company, , evidenceCount, signalCount, researchCard] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: {
          id: true, rawName: true, industry: true, domain: true,
          lastEnrichedAt: true, intelligenceScore: true, sizeRange: true,
        },
      }),
      db.accountScore.findFirst({
        where: { companyId },
        select: { score: true, scoreBreakdown: true },
      }),
      db.evidence.count({ where: { companyId, status: 'active' } }),
      db.companySignal.count({ where: { companyId, status: { in: ['detected', 'validated', 'active'] } } }),
      db.companyResearchCard.findUnique({
        where: { companyId },
        select: { businessOverview: true, techStack: true, keyPeople: true, recentNews: true, revenue: true, employeeCount: true },
      }),
    ]);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 },
      );
    }

    // Compute days since last enrichment
    const daysSinceResearch = company.lastEnrichedAt
      ? Math.floor((Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // Build confidence input from available data
    const confidenceInput: ConfidenceInput = {
      entityId: companyId,
      entityType: 'company',
      dataCompleteness: researchCard ? (
        (researchCard.businessOverview ? 0.2 : 0) +
        (researchCard.techStack ? 0.2 : 0) +
        (researchCard.keyPeople ? 0.2 : 0) +
        (researchCard.revenue ? 0.2 : 0) +
        (researchCard.employeeCount ? 0.2 : 0)
      ) : 0,
      evidenceCount,
      daysSinceResearch,
      freshnessScore: daysSinceResearch !== undefined
        ? Math.max(0, 100 - daysSinceResearch * 0.5)
        : undefined,
      totalFacts: evidenceCount + signalCount,
      crossValidatedFacts: Math.floor(evidenceCount * 0.4), // Assume 40% are cross-validated
    };

    // Apply tenant-specific weights if tenantId is provided
    if (tenantId) {
      try {
        const tenantConfig = await getTenantConfig(tenantId);
        if (tenantConfig && Object.keys(tenantConfig.confidenceWeights).length > 0) {
          confidenceInput.customWeights = tenantConfig.confidenceWeights;
        }
      } catch {
        // Non-blocking — use defaults
      }
    }

    // Compute unified confidence
    const result = computeUnifiedConfidence(confidenceInput);

    // Build dimension scores map
    const dimensions: Record<ConfidenceDimension, { score: number; weight: number }> = {
      data_quality: { score: 0, weight: 0 },
      source_reliability: { score: 0, weight: 0 },
      freshness: { score: 0, weight: 0 },
      cross_validation: { score: 0, weight: 0 },
      evidence_coverage: { score: 0, weight: 0 },
      ai_certainty: { score: 0, weight: 0 },
    };

    for (const factor of result.factors) {
      const dim = factor.dimension as ConfidenceDimension;
      if (dimensions[dim]) {
        dimensions[dim].score = factor.score;
        dimensions[dim].weight = factor.weight;
      }
    }

    const response = {
      companyId,
      companyName: company.rawName,
      unifiedScore: result.score,
      grade: result.grade,
      trustClass: result.trustClass,
      enterpriseReady: result.enterpriseReady,
      dimensions,
      computedAt: result.timestamp,
      modelVersion: result.modelVersion,
      ...(tenantId ? { tenantId } : {}),
    };

    logger.info('[unified-score] Computed', {
      companyId,
      score: result.score,
      grade: result.grade,
      ...(tenantId ? { tenantId } : {}),
    });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[unified-score] GET failed', { error: message });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
