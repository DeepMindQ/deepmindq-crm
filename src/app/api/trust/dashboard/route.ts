/**
 * AI Trust Dashboard — Aggregated TRUST Statistics
 *
 * GET /api/trust/dashboard
 *
 * Returns platform-wide TRUST metrics aggregated from the Evidence table.
 * Read-only analytics — safe to expose.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import {
  SOURCE_RELIABILITY_SCORES,
  type TrustSource,
  type TrustConfidence,
} from '@/lib/intelligence-sources/trust-metadata';

const FRESHNESS_THRESHOLD_DAYS = 30;
const STALE_THRESHOLD_DAYS = 90;

export async function GET() {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    // Fetch all evidence records (non-lineage)
    const allEvidence = await db.evidence.findMany({
      where: {
        status: 'active',
        extractedField: { not: { startsWith: 'lineage:' } },
      },
      select: {
        sourceQualityTier: true,
        confidence: true,
        createdAt: true,
        extractedField: true,
        companyId: true,
      },
    });

    // Fetch lineage records for coverage
    const lineageRecords = await db.evidence.findMany({
      where: {
        status: 'active',
        extractedField: { startsWith: 'lineage:' },
      },
      select: {
        extractedField: true,
        companyId: true,
      },
    });

    // Source breakdown: map sourceQualityTier to TRUST source classification
    const sourceMap: Record<string, { count: number; totalScore: number }> = {};
    for (const ev of allEvidence) {
      const source = tierToSource(ev.sourceQualityTier);
      if (!sourceMap[source]) sourceMap[source] = { count: 0, totalScore: 0 };
      sourceMap[source].count++;
      sourceMap[source].totalScore += ev.confidence * 100;
    }

    const sourceBreakdown = Object.entries(sourceMap).map(([source, data]) => ({
      source,
      count: data.count,
      avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
    }));

    // Confidence distribution
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const ev of allEvidence) {
      const c = ev.confidence;
      if (c >= 0.75) high++;
      else if (c >= 0.45) medium++;
      else low++;
    }

    // Freshness stats
    const now = Date.now();
    let fresh = 0;
    let stale = 0;
    let unknown = 0;
    for (const ev of allEvidence) {
      const ageDays = (now - ev.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= FRESHNESS_THRESHOLD_DAYS) fresh++;
      else if (ageDays <= STALE_THRESHOLD_DAYS) stale++;
      else unknown++; // older than threshold → treat as unknown freshness
    }

    // Top issues: find stale, low-confidence fields
    const fieldStats: Record<string, { count: number; avgConfidence: number; maxAgeDays: number }> = {};
    for (const ev of allEvidence) {
      const field = ev.extractedField || 'unknown';
      const ageDays = (now - ev.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (!fieldStats[field]) {
        fieldStats[field] = { count: 0, avgConfidence: 0, maxAgeDays: 0 };
      }
      fieldStats[field].count++;
      fieldStats[field].avgConfidence += ev.confidence;
      fieldStats[field].maxAgeDays = Math.max(fieldStats[field].maxAgeDays, ageDays);
    }

    const topIssues: { field: string; issue: string; severity: string }[] = [];
    for (const [field, stats] of Object.entries(fieldStats)) {
      stats.avgConfidence = stats.count > 0 ? stats.avgConfidence / stats.count : 0;

      if (stats.avgConfidence < 0.45) {
        topIssues.push({
          field,
          issue: `Low confidence: ${Math.round(stats.avgConfidence * 100)}% across ${stats.count} records`,
          severity: 'high',
        });
      }
      if (stats.maxAgeDays > STALE_THRESHOLD_DAYS) {
        topIssues.push({
          field,
          issue: `Stale data: oldest record is ${Math.round(stats.maxAgeDays)} days old`,
          severity: stats.maxAgeDays > 180 ? 'high' : 'medium',
        });
      }
    }

    // Sort issues by severity, take top 10
    topIssues.sort((a, b) => {
      const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
    });

    // Lineage coverage
    const allFields = new Set<string>();
    for (const ev of allEvidence) {
      if (ev.extractedField) allFields.add(ev.extractedField);
    }
    const fieldsWithLineage = new Set<string>();
    for (const rec of lineageRecords) {
      const field = rec.extractedField?.replace('lineage:', '') || '';
      if (field) fieldsWithLineage.add(field);
    }
    const totalFields = allFields.size || 1;
    const lineageCoveragePercent = Math.round((fieldsWithLineage.size / totalFields) * 100);

    // Overall trust score: weighted average across dimensions
    const totalRecords = allEvidence.length || 1;
    const avgConfidence = allEvidence.reduce((sum, e) => sum + e.confidence, 0) / totalRecords;
    const freshPct = fresh / totalRecords;
    const highPct = high / totalRecords;
    const sourceScore = sourceBreakdown.length > 0
      ? sourceBreakdown.reduce((sum, s) => sum + (SOURCE_RELIABILITY_SCORES[s.source as TrustSource] ?? 50) * s.count, 0) / totalRecords
      : 0;

    const overallTrustScore = Math.round(
      (avgConfidence * 100 * 0.3) +
      (sourceScore * 0.25) +
      (freshPct * 100 * 0.25) +
      (lineageCoveragePercent * 0.2)
    );

    const trustGrade = scoreToGrade(overallTrustScore);

    return NextResponse.json({
      overallTrustScore,
      trustGrade,
      sourceBreakdown,
      confidenceDistribution: { high, medium, low },
      freshnessStats: { fresh, stale, unknown },
      topIssues: topIssues.slice(0, 10),
      lineageCoverage: {
        totalFields: allFields.size,
        fieldsWithLineage: fieldsWithLineage.size,
        coveragePercent: lineageCoveragePercent,
      },
    });
  } catch (error) {
    logger.error('[TRUST DASHBOARD] Error', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to compute trust dashboard stats',
        overallTrustScore: 0,
        trustGrade: 'F',
        sourceBreakdown: [],
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
        freshnessStats: { fresh: 0, stale: 0, unknown: 0 },
        topIssues: [],
        lineageCoverage: { totalFields: 0, fieldsWithLineage: 0, coveragePercent: 0 },
      },
      { status: 500 }
    );
  }
}

function tierToSource(tier: string): TrustSource {
  switch (tier) {
    case 'premium': return 'verified_api';
    case 'standard': return 'web_intelligence';
    case 'low': return 'ai_inference';
    default: return 'platform_computed';
  }
}

function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
