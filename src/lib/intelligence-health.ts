/**
 * Company Intelligence Health Calculator (Phase 6 — Module 5)
 *
 * Computes 5 health score dimensions for a company:
 *   - Data Completeness (30%): Field coverage (12 tracked fields)
 *   - Signal Coverage (25%): Active signals ratio
 *   - Evidence Coverage (25%): Active evidence ratio
 *   - Contact Coverage (20%): Contact presence
 *   - Overall Health: Weighted composite of the above
 *
 * Creates or upserts CompanyIntelligenceHealth records.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface FieldCoverageMap {
  [fieldName: string]: boolean;
}

export interface HealthScoreResult {
  overallHealthScore: number;
  dataCompletenessScore: number;
  signalCoverageScore: number;
  evidenceCoverageScore: number;
  contactCoverageScore: number;
  fieldCoverage: FieldCoverageMap;
  totalSignals: number;
  activeSignals: number;
  totalEvidence: number;
  activeEvidence: number;
  totalContacts: number;
  filledFields: number;
  totalTrackedFields: number;
}

// The 12 tracked intelligence fields
const TRACKED_FIELDS: (keyof {
  industry: true;
  revenue: true;
  employeeCount: true;
  techStack: true;
  fundingStage: true;
  businessOverview: true;
  website: true;
  location: true;
  country: true;
  contacts: true;
  signals: true;
  evidence: true;
})[] = [
  'industry', 'revenue', 'employeeCount', 'techStack',
  'fundingStage', 'businessOverview', 'website', 'location',
  'country', 'contacts', 'signals', 'evidence',
];

// ── Compute data completeness (field coverage) ──

function computeFieldCoverage(company: {
  industry?: string | null;
  revenue?: string | number | null;
  employeeCount?: number | string | null;
  techStack?: string | null;
  fundingStage?: string | null;
  businessOverview?: string | null;
  website?: string | null;
  location?: string | null;
  country?: string | null;
}): FieldCoverageMap {
  const cov: FieldCoverageMap = {
    industry: !!company.industry && company.industry.trim().length > 0,
    revenue: !!company.revenue && company.revenue.trim().length > 0,
    employeeCount: company.employeeCount != null && Number(company.employeeCount || 0) > 0,
    techStack: !!company.techStack && company.techStack.trim().length > 0,
    fundingStage: !!company.fundingStage && company.fundingStage.trim().length > 0,
    businessOverview: !!company.businessOverview && company.businessOverview.trim().length > 0,
    website: !!company.website && company.website.trim().length > 0,
    location: !!company.location && company.location.trim().length > 0,
    country: !!company.country && company.country.trim().length > 0,
    contacts: false,  // populated below
    signals: false,   // populated below
    evidence: false,  // populated below
  };
  return cov;
}

// ── Main computation ──

export async function computeCompanyHealth(companyId: string): Promise<HealthScoreResult> {
  // Load company
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      industry: true,
      revenue: true,
      employeeCount: true,
      techStack: true,
      fundingStage: true,
      businessOverview: true,
      website: true,
      location: true,
      country: true,
      rawName: true,
      normalizedName: true,
    },
  });
  if (!company) throw new Error(`Company ${companyId} not found`);

  // Load counts in parallel
  const [signalCounts, evidenceCounts, contactCounts] = await Promise.all([
    db.companySignal.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
    }),
    db.evidence.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
    }),
    db.contact.count({ where: { companyId } }),
  ]);

  const totalSignals = signalCounts.reduce((sum, g) => sum + g._count.id, 0);
  const activeSignals = signalCounts
    .filter(g => g.status === 'active' || g.status === 'validated')
    .reduce((sum, g) => sum + g._count.id, 0);

  const totalEvidence = evidenceCounts.reduce((sum, g) => sum + g._count.id, 0);
  const activeEvidence = evidenceCounts
    .filter(g => g.status === 'active' || g.status === 'aging')
    .reduce((sum, g) => sum + g._count.id, 0);

  const totalContacts = contactCounts;

  // Field coverage
  const fieldCoverage = computeFieldCoverage(company as {
    industry: company.industry as string | null;
    revenue: company.revenue as string | number | null;
    employeeCount: company.employeeCount as number | string | null;
    techStack: company.techStack as string | null;
    fundingStage: company.fundingStage as string | null;
    businessOverview: company.businessOverview as string | null;
    website: company.website as string | null;
    location: company.location as string | null;
    country: company.country as string | null;
  });
  fieldCoverage.contacts = totalContacts > 0;
  fieldCoverage.signals = totalSignals > 0;
  fieldCoverage.evidence = totalEvidence > 0;

  const filledFields = Object.values(fieldCoverage).filter(Boolean).length;
  const totalTrackedFields = TRACKED_FIELDS.length;

  // ── Score computations (0-100) ──

  // Data Completeness: filled / total
  const dataCompletenessScore = Math.round((filledFields / totalTrackedFields) * 100);

  // Signal Coverage: active / total (with minimum threshold)
  const signalCoverageScore = totalSignals > 0
    ? Math.round((activeSignals / totalSignals) * 100)
    : 0;

  // Evidence Coverage: active / total (with bonus for volume)
  let evidenceCoverageScore = totalEvidence > 0
    ? Math.round((activeEvidence / totalEvidence) * 100)
    : 0;
  // Volume bonus: having 10+ active evidence is excellent
  if (activeEvidence >= 10) evidenceCoverageScore = Math.min(100, evidenceCoverageScore + 10);
  else if (activeEvidence >= 5) evidenceCoverageScore = Math.min(100, evidenceCoverageScore + 5);

  // Evidence Coverage: active / total (with bonus for volume)
  let contactCoverageScore = 0;
  if (totalContacts >= 5) contactCoverageScore = 100;
  else if (totalContacts >= 3) contactCoverageScore = 80;
  else if (totalContacts >= 1) contactCoverageScore = 50;

  // Evidence Coverage: active / total (with bonus for volume)
  let evidenceCoverageScore = totalEvidence > 0
    ? Math.round((activeEvidence / totalEvidence) * 100)
    : 0;
  if (activeEvidence >= 10) evidenceCoverageScore = Math.min(100, evidenceCoverageScore + 10);
  else if (activeEvidence >= 5) evidenceCoverageScore = Math.min(100, evidenceCoverageScore + 5);

  // Overall: weighted composite
  const overallHealthScore = Math.round(
    dataCompletenessScore * 0.30 +
    signalCoverageScore * 0.25 +
    evidenceCoverageScore * 0.25 +
    contactCoverageScore * 0.20,
  );
  );

  return {
    overallHealthScore,
    dataCompletenessScore,
    signalCoverageScore,
    evidenceCoverageScore,
    contactCoverageScore,
    fieldCoverage,
    totalSignals,
    activeSignals,
    totalEvidence,
    activeEvidence,
    totalContacts,
    filledFields,
    totalTrackedFields,
  };
}

// ── Compute and persist health to DB ──

export async function computeAndPersistHealth(
  companyId: string,
): Promise<{ previousHealth: number | null; newHealth: number }> {
  // Check for existing health record
  const existing = await db.companyIntelligenceHealth.findUnique({
    where: { companyId },
    select: { overallHealthScore: true },
  });

  const result = await computeCompanyHealth(companyId);

  // Upsert health record
  await db.companyIntelligenceHealth.upsert({
    where: { companyId },
    create: {
      companyId,
      dataCompletenessScore: result.dataCompletenessScore,
      signalCoverageScore: result.signalCoverageScore,
      evidenceCoverageScore: result.evidenceCoverageScore,
      contactCoverageScore: result.contactCoverageScore,
      overallHealthScore: result.overallHealthScore,
      fieldCoverage: result.fieldCoverage as unknown as Prisma.InputJsonValue,
      totalSignals: result.totalSignals,
      activeSignals: result.activeSignals,
      totalEvidence: result.totalEvidence,
      activeEvidence: result.activeEvidence,
      totalContacts: result.totalContacts,
      filledFields: result.filledFields,
      totalTrackedFields: result.totalTrackedFields,
      lastCalculatedAt: new Date(),
    },
    update: {
      dataCompletenessScore: result.dataCompletenessScore,
      signalCoverageScore: result.signalCoverageScore,
      evidenceCoverageScore: result.evidenceCoverageScore,
      contactCoverageScore: result.contactCoverageScore,
      overallHealthScore: result.overallHealthScore,
      fieldCoverage: result.fieldCoverage as unknown as Prisma.InputJsonValue,
      totalSignals: result.totalSignals,
      activeSignals: result.activeSignals,
      totalEvidence: result.totalEvidence,
      activeEvidence: result.activeEvidence,
      totalContacts: result.totalContacts,
      filledFields: result.filledFields,
      lastCalculatedAt: new Date(),
    },
  });

  return {
    previousHealth: existing?.overallHealthScore ?? null,
    newHealth: result.overallHealthScore,
  };
}

// ── Get health tier label ──

export function getHealthTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

// ── Dashboard: get aggregated stats ──

export async function getDashboardHealthStats(): Promise<{
  totalCompanies: number;
  avgHealthScore: number;
  companiesByHealthTier: Record<string, number>;
  lowestHealthCompanies: Array<{ companyId: string; companyName: string; healthScore: number }>;
}> {
  // Get all health records
  const healthRecords = await db.companyIntelligenceHealth.findMany({
    select: {
      companyId: true,
      overallHealthScore: true,
      company: { select: { normalizedName: true, rawName: true } },
    },
    orderBy: { overallHealthScore: 'asc' },
  });

  const totalCompanies = healthRecords.length;
  const avgHealthScore = totalCompanies > 0
    ? Math.round(healthRecords.reduce((sum, h) => sum + h.overallHealthScore, 0) / totalCompanies)
    : 0;

  const companiesByHealthTier: Record<string, number> = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const h of healthRecords) {
    const tier = getHealthTier(h.overallHealthScore);
    companiesByHealthTier[tier]++;
  }

  // Lowest 10 companies by health score
  const lowestHealthCompanies = healthRecords.slice(0, 10).map(h => ({
    companyId: h.companyId,
    companyName: h.company.rawName || h.company.normalizedName || 'Unknown',
    healthScore: h.overallHealthScore,
  }));

  return { totalCompanies, avgHealthScore, companiesByHealthTier, lowestHealthCompanies };
}