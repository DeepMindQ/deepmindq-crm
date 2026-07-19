/**
 * Evidence Quality Intelligence (Phase 4 B2)
 *
 * Computes a comprehensive evidence quality score for a company
 * based on multiple dimensions:
 *
 *   1. Coverage (25%): How many key fields have evidence backing
 *   2. Freshness (25%): How recent the evidence sources are
 *   3. Source Quality (20%): Premium vs standard vs low tier distribution
 *   4. Corroboration (15%): Multi-source confirmation
 *   5. Volume (15%): Total evidence count (capped benefit)
 *
 * Returns a 0-100 overall score plus per-dimension breakdown.
 */
import { db } from '@/lib/db';

export interface EvidenceQualityScore {
  overall: number;          // 0-100
  coverage: number;         // 0-100
  freshness: number;        // 0-100
  sourceQuality: number;    // 0-100
  corroboration: number;    // 0-100
  volume: number;           // 0-100
  totalEvidence: number;
  activeEvidence: number;
  fieldsCovered: number;
  totalFields: number;
  premiumSourceCount: number;
  lowSourceCount: number;
  avgRecencyDays: number;
}

const KEY_FIELDS = ['revenue', 'employeeCount', 'fundingStage', 'techStack', 'industry', 'businessOverview'];

export async function computeEvidenceQuality(companyId: string): Promise<EvidenceQualityScore> {
  // 1. Load all evidence for this company
  const evidence = await db.evidence.findMany({
    where: { companyId },
    select: {
      sourceQualityTier: true,
      sourceDate: true,
      extractedField: true,
      sourceUrl: true,
      status: true,
      relevanceScore: true,
      confidence: true,
      createdAt: true,
    },
  });

  const activeEvidence = evidence.filter(e => e.status === 'active' || e.status === 'aging');
  const totalEvidence = evidence.length;

  if (totalEvidence === 0) {
    return {
      overall: 0, coverage: 0, freshness: 0, sourceQuality: 0,
      corroboration: 0, volume: 0, totalEvidence: 0, activeEvidence: 0,
      fieldsCovered: 0, totalFields: KEY_FIELDS.length,
      premiumSourceCount: 0, lowSourceCount: 0, avgRecencyDays: 999,
    };
  }

  // 2. Coverage: How many key fields have at least one evidence backing
  const fieldsWithEvidence = new Set(
    activeEvidence.filter(e => e.extractedField && KEY_FIELDS.includes(e.extractedField)).map(e => e.extractedField)
  );
  const coverage = Math.round((fieldsWithEvidence.size / KEY_FIELDS.length) * 100);

  // 3. Freshness: Average age of evidence sources (in days), inverted to 0-100
  const now = Date.now();
  const agesInDays = activeEvidence
    .map(e => {
      const ref = e.sourceDate ? new Date(e.sourceDate).getTime() : e.createdAt.getTime();
      return (now - ref) / (1000 * 60 * 60 * 24);
    })
    .filter(d => d >= 0 && d < 1000);
  const avgRecencyDays = agesInDays.length > 0
    ? Math.round(agesInDays.reduce((a, b) => a + b, 0) / agesInDays.length)
    : 999;
  // 0 days = 100, 30 days = 80, 90 days = 50, 180 days = 30, 365+ days = 10
  const freshness = avgRecencyDays === 999 ? 0 : Math.round(Math.max(0, 100 - (avgRecencyDays / 365) * 90));

  // 4. Source Quality: Premium ratio
  const premiumCount = activeEvidence.filter(e => e.sourceQualityTier === 'premium').length;
  const lowCount = activeEvidence.filter(e => e.sourceQualityTier === 'low').length;
  const standardCount = activeEvidence.length - premiumCount - lowCount;
  const sourceQuality = activeEvidence.length > 0
    ? Math.round(((premiumCount * 1.0 + standardCount * 0.7 + lowCount * 0.4) / activeEvidence.length) * 100)
    : 0;

  // 5. Corroboration: How many unique domains provide evidence
  const uniqueDomains = new Set(
    activeEvidence.map(e => {
      try { return new URL(e.sourceUrl).hostname; } catch { return e.sourceUrl; }
    })
  );
  // 1 domain = 30, 2 = 55, 3 = 72, 5+ = 90+
  const corroboration = Math.min(100, Math.round(30 + (uniqueDomains.size - 1) * 20));

  // 6. Volume: Evidence count (diminishing returns)
  const volume = Math.min(100, Math.round(Math.sqrt(activeEvidence.length) * 20));

  // Weighted overall
  const overall = Math.round(
    coverage * 0.25 +
    freshness * 0.25 +
    sourceQuality * 0.20 +
    corroboration * 0.15 +
    volume * 0.15
  );

  return {
    overall, coverage, freshness, sourceQuality, corroboration, volume,
    totalEvidence, activeEvidence,
    fieldsCovered: fieldsWithEvidence.size,
    totalFields: KEY_FIELDS.length,
    premiumSourceCount: premiumCount,
    lowSourceCount: lowCount,
    avgRecencyDays,
  };
}