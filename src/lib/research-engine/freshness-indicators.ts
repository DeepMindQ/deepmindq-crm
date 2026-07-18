/**
 * Freshness Indicators (Phase 4 B3)
 *
 * Provides per-company, per-domain freshness intelligence.
 * Each domain has a lifecycle:
 *   fresh (< 14 days) → aging (14-45 days) → stale (45-90 days) → expired (> 90 days)
 *
 * This data feeds:
 *   - Company profile UI (freshness badges)
 *   - Governance quality indicators
 *   - Research prioritization (stale companies first)
 */

import { db } from '@/lib/db';

export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'expired' | 'none';

export interface DomainFreshness {
  domain: string;
  label: string;
  status: FreshnessStatus;
  lastRefreshedAt: Date | null;
  daysSinceRefresh: number | null;
  score: number;  // 0-100
  description: string;
}

export interface CompanyFreshnessProfile {
  companyId: string;
  companyName: string | null;
  domains: DomainFreshness[];
  overallScore: number;       // 0-100 average across domains
  overallStatus: FreshnessStatus;
  domainsNeedingRefresh: string[];
}

const FRESHNESS_THRESHOLDS = {
  fresh: 14,    // days
  aging: 45,
  stale: 90,
};

const DOMAIN_LABELS: Record<string, string> = {
  profile: 'Company Profile',
  signals: 'Buying Signals',
  contacts: 'Key People',
  technology: 'Technology Landscape',
};

function evaluateStatus(daysSinceRefresh: number | null): { status: FreshnessStatus; score: number } {
  if (daysSinceRefresh === null) return { status: 'none', score: 0 };
  if (daysSinceRefresh <= FRESHNESS_THRESHOLDS.fresh) return { status: 'fresh', score: 100 };
  if (daysSinceRefresh <= FRESHNESS_THRESHOLDS.aging) {
    const pct = (daysSinceRefresh - FRESHNESS_THRESHOLDS.fresh) / (FRESHNESS_THRESHOLDS.aging - FRESHNESS_THRESHOLDS.fresh);
    return { status: 'aging', score: Math.round(70 - pct * 30) };
  }
  if (daysSinceRefresh <= FRESHNESS_THRESHOLDS.stale) {
    const pct = (daysSinceRefresh - FRESHNESS_THRESHOLDS.aging) / (FRESHNESS_THRESHOLDS.stale - FRESHNESS_THRESHOLDS.aging);
    return { status: 'stale', score: Math.round(40 - pct * 25) };
  }
  return { status: 'expired', score: Math.max(0, 15 - Math.round((daysSinceRefresh - 90) / 30 * 5)) };
}

function getStatusDescription(status: FreshnessStatus, days: number | null): string {
  switch (status) {
    case 'fresh': return 'Recently verified — intelligence is current';
    case 'aging': return `Verified ${days} days ago — consider refreshing`;
    case 'stale': return `Verified ${days} days ago — intelligence may be outdated`;
    case 'expired': return `Verified ${days} days ago — intelligence is likely outdated`;
    case 'none': return 'No refresh timestamp — research not yet run';
  }
}

/**
 * Get freshness profile for a single company.
 */
export async function getCompanyFreshnessProfile(companyId: string): Promise<CompanyFreshnessProfile> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { rawName: true, researchCard: { select: {
      profileFreshnessAt: true,
      signalFreshnessAt: true,
      contactFreshnessAt: true,
      techFreshnessAt: true,
    }}},
  });

  if (!company) throw new Error('Company not found');

  const card = company.researchCard;
  const now = Date.now();
  const DAY_MS = 86400000;

  const domainFields: Array<{ key: string; field: string }> = [
    { key: 'profile', field: 'profileFreshnessAt' },
    { key: 'signals', field: 'signalFreshnessAt' },
    { key: 'contacts', field: 'contactFreshnessAt' },
    { key: 'technology', field: 'techFreshnessAt' },
  ];

  const domains: DomainFreshness[] = domainFields.map(({ key, field }) => {
    const lastRefreshedAt = card ? (card as Record<string, unknown>)[field] as Date | null : null;
    const daysSinceRefresh = lastRefreshedAt ? Math.round((now - lastRefreshedAt.getTime()) / DAY_MS) : null;
    const { status, score } = evaluateStatus(daysSinceRefresh);

    return {
      domain: key,
      label: DOMAIN_LABELS[key] || key,
      status,
      lastRefreshedAt,
      daysSinceRefresh,
      score,
      description: getStatusDescription(status, daysSinceRefresh),
    };
  });

  const scores = domains.map(d => d.score);
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // Overall status based on worst domain
  const statusPriority: Record<FreshnessStatus, number> = { none: 0, expired: 1, stale: 2, aging: 3, fresh: 4 };
  const worstStatus = domains.reduce((worst, d) =>
    (statusPriority[d.status] ?? 0) < (statusPriority[worst] ?? 0) ? d.status : worst,
    'fresh' as FreshnessStatus
  );

  const domainsNeedingRefresh = domains
    .filter(d => d.status === 'stale' || d.status === 'expired' || d.status === 'none')
    .map(d => d.domain);

  return {
    companyId,
    companyName: company.rawName,
    domains,
    overallScore,
    overallStatus: worstStatus,
    domainsNeedingRefresh,
  };
}

/**
 * Get freshness profiles for multiple companies (batch).
 * Used for portfolio-level freshness overview.
 */
export async function getBatchFreshnessProfiles(companyIds: string[]): Promise<CompanyFreshnessProfile[]> {
  const results: CompanyFreshnessProfile[] = [];
  for (const id of companyIds) {
    try {
      results.push(await getCompanyFreshnessProfile(id));
    } catch { /* skip invalid */ }
  }
  return results;
}

/**
 * Get companies sorted by freshness (most stale first).
 * Useful for research prioritization.
 */
export async function getStaleCompanies(limit = 20): Promise<CompanyFreshnessProfile[]> {
  const companies = await db.company.findMany({
    where: {
      researchCard: { isNot: null },
    },
    select: { id: true },
    orderBy: { researchCard: { lastResearchedAt: 'asc' } },
    take: limit * 2, // fetch extra in case some fail
  });

  const profiles = await getBatchFreshnessProfiles(companies.map(c => c.id));
  return profiles
    .filter(p => p.overallStatus === 'stale' || p.overallStatus === 'expired' || p.overallStatus === 'none')
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, limit);
}