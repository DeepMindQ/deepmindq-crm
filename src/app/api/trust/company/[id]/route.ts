/**
 * AI Trust — Company-Level TRUST Details
 *
 * GET /api/trust/company/[id]
 *
 * Returns per-company TRUST breakdown: field-by-field scores,
 * lineage timeline, and improvement recommendations.
 */

import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { queryLineage } from '@/lib/data-lineage-service';
import {
  SOURCE_RELIABILITY_SCORES,
  type TrustSource,
  type TrustConfidence,
} from '@/lib/intelligence-sources/trust-metadata';

const FRESHNESS_THRESHOLD_DAYS = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    // Fetch the company
    const company = await db.company.findUnique({
      where: { id },
      select: { id: true, rawName: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Fetch all evidence for this company
    const evidence = await db.evidence.findMany({
      where: {
        companyId: id,
        status: 'active',
      },
      select: {
        id: true,
        extractedField: true,
        extractedValue: true,
        sourceQualityTier: true,
        confidence: true,
        createdAt: true,
        sourceName: true,
        sourceTitle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch lineage records
    const lineageRecords = await queryLineage({
      companyId: id,
      limit: 50,
    });

    // Build field-level trust breakdown
    const fieldTrust: Record<string, {
      source: string;
      confidence: string;
      lastUpdated: string;
      ageDays: number;
    }> = {};

    const now = Date.now();

    for (const ev of evidence) {
      // Skip lineage records for field breakdown
      if (ev.extractedField?.startsWith('lineage:')) continue;
      const field = ev.extractedField || 'unknown';

      if (!fieldTrust[field]) {
        const ageDays = Math.round(
          (now - ev.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        fieldTrust[field] = {
          source: tierToSourceLabel(ev.sourceQualityTier),
          confidence: confidenceLabel(ev.confidence),
          lastUpdated: ev.createdAt.toISOString(),
          ageDays,
        };
      }
    }

    // Compute company-level trust score
    const fieldCount = Object.keys(fieldTrust).length || 1;
    let totalScore = 0;

    for (const ev of evidence) {
      if (ev.extractedField?.startsWith('lineage:')) continue;
      const sourceScore = tierToScore(ev.sourceQualityTier);
      const ageDays = (now - ev.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const freshnessScore = Math.max(0, 1 - ageDays / 90) * 100;
      const confScore = ev.confidence * 100;
      totalScore += (sourceScore * 0.3) + (confScore * 0.4) + (freshnessScore * 0.3);
    }

    const trustScore = Math.round(totalScore / fieldCount);
    const trustGrade = scoreToGrade(trustScore);

    // Generate recommendations
    const recommendations: string[] = [];
    const staleFields: string[] = [];
    const lowConfFields: string[] = [];

    for (const [field, info] of Object.entries(fieldTrust)) {
      if (info.ageDays > FRESHNESS_THRESHOLD_DAYS) {
        staleFields.push(field);
      }
      if (info.confidence === 'low') {
        lowConfFields.push(field);
      }
    }

    if (staleFields.length > 0) {
      recommendations.push(
        `Re-enrich stale fields: ${staleFields.slice(0, 3).join(', ')}${staleFields.length > 3 ? ` and ${staleFields.length - 3} more` : ''}. Data is older than ${FRESHNESS_THRESHOLD_DAYS} days.`
      );
    }
    if (lowConfFields.length > 0) {
      recommendations.push(
        `Improve confidence for: ${lowConfFields.slice(0, 3).join(', ')}${lowConfFields.length > 3 ? ` and ${lowConfFields.length - 3} more` : ''}. Consider adding verified API sources.`
      );
    }
    if (lineageRecords.length === 0) {
      recommendations.push(
        'No data lineage records found. Enable lineage tracking to improve transparency and auditability.'
      );
    }
    if (fieldCount < 5) {
      recommendations.push(
        'Limited field coverage. Consider enriching the company profile with additional data sources.'
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Data quality looks good. Continue monitoring for freshness degradation.');
    }

    return NextResponse.json({
      companyId: id,
      companyName: company.rawName,
      trustScore,
      trustGrade,
      fieldTrust,
      lineageRecords,
      recommendations,
    });
  } catch (error) {
    console.error(`[TRUST COMPANY] Error for ${id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute company trust details' },
      { status: 500 }
    );
  }
}

function tierToSourceLabel(tier: string): string {
  switch (tier) {
    case 'premium': return 'verified_api';
    case 'standard': return 'web_intelligence';
    case 'low': return 'ai_inference';
    default: return 'platform_computed';
  }
}

function tierToScore(tier: string): number {
  return SOURCE_RELIABILITY_SCORES[(tierToSourceLabel(tier) as TrustSource)] ?? 50;
}

function confidenceLabel(confidence: number): TrustConfidence {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
