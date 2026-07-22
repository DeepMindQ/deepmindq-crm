/**
 * Trust Report Builder — Extracted from API route.
 *
 * Assembles a comprehensive trust/intelligence report for an
 * opportunity recommendation, combining confidence, evidence,
 * validation, conflicts, and gaps into a single response.
 */

import { db } from '@/lib/db';
import { populateConfidenceFactors } from '@/lib/confidence-explainability';

export interface TrustReportData {
  recommendation: {
    id: string;
    title: string;
    company: string;
    confidenceScore: number;
  };
  overallConfidence: number;
  breakdown: unknown;
  factors: unknown;
  supportingEvidence: {
    total: number;
    avgRelevance: number;
    validatedSignals: number;
    weakSignals: number;
  };
  conflicts: Array<{ conflictType: string; severity: string; description: string }>;
  missingIntelligence: string[];
}

/**
 * Build a trust report for a recommendation ID.
 * Pure data assembly — no request/response handling.
 */
export async function buildTrustReport(recommendationId: string): Promise<TrustReportData | null> {
  const rec = await db.opportunityRecommendation.findUnique({
    where: { id: recommendationId },
    select: {
      id: true,
      opportunityTitle: true,
      confidenceScore: true,
      confidenceBreakdown: true,
      companyId: true,
      company: { select: { id: true, normalizedName: true } },
    },
  });

  if (!rec) return null;

  // Compute confidence factors if not yet computed
  let factors = rec.confidenceBreakdown as { positiveFactors?: unknown[]; negativeFactors?: unknown[] } | null;
  if (!factors) {
    await populateConfidenceFactors(recommendationId);
    const updated = await db.opportunityRecommendation.findUnique({
      where: { id: recommendationId },
      select: { confidenceBreakdown: true },
    });
    factors = (updated?.confidenceBreakdown as typeof factors) || null;
  }

  // Get validation status for this company
  const validations = await db.signalValidation.findMany({
    where: { companyId: rec.company.id },
    select: { signalId: true, validationStatus: true, confidenceScore: true },
  });

  // Get open conflicts
  const conflicts = await db.intelligenceConflict.findMany({
    where: { companyId: rec.company.id, status: 'open' },
    select: { conflictType: true, severity: true, description: true },
    take: 10,
  });

  // Get evidence summary
  const evidenceStats = await db.evidence.aggregate({
    where: { companyId: rec.company.id },
    _count: true,
    _avg: { relevanceScore: true },
  });

  // Identify missing intelligence gaps
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

  return {
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
  };
}