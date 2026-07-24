/**
 * Phase 5: Account Prioritization Engine
 *
 * Three-component composite scoring:
 * 1. Static Fit (40%) — ICP alignment: industry, size, geography, tech stack
 * 2. Dynamic Intelligence (40%) — Evidence quality, signal activity, capability match strength
 * 3. Timing/Urgency (20%) — Signal recency, opportunity window, engagement velocity
 *
 * Architecture Guardrails:
 * - SEPARATE from intelligenceScore (intelligence-contract.ts) — that measures data quality
 * - accountPriorityScore measures sales-readiness and ICP fit
 * - Uses SystemSetting key "icp_profile" for ICP configuration (no new model)
 * - Pure DB computation, NO LLM calls needed
 */

import { db } from '@/lib/db';

// ── Types ──

export interface ICPProfile {
  targetIndustries: string[];
  targetSizeRanges: string[];
  targetCountries: string[];
  preferredTechnologies: string[];
  minRevenue?: string;
  maxRevenue?: string;
  minEmployees?: number;
  maxEmployees?: number;
  excludeIndustries?: string[];
}

export interface AccountPriorityBreakdown {
  staticFit: {
    score: number;
    industry: number;
    size: number;
    geography: number;
    techAlignment: number;
  };
  dynamicIntelligence: {
    score: number;
    evidenceQuality: number;
    signalStrength: number;
    capabilityMatch: number;
    contactCoverage: number;
  };
  timingUrgency: {
    score: number;
    signalRecency: number;
    opportunityWindow: number;
    engagementVelocity: number;
  };
  composite: number;
  tier: 'HOT' | 'ACTIVE' | 'NURTURE' | 'LOW';
}

export interface ComputeResult {
  companyId: string;
  priority: AccountPriorityBreakdown;
  computedAt: string;
}

// ── ICP Profile Loader ──

const DEFAULT_ICP: ICPProfile = {
  targetIndustries: [],
  targetSizeRanges: [],
  targetCountries: [],
  preferredTechnologies: [],
  excludeIndustries: [],
};

export async function getICPProfile(): Promise<ICPProfile> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'icp_profile' },
    });
    if (setting?.value) {
      return { ...DEFAULT_ICP, ...JSON.parse(setting.value) };
    }
  } catch (e) {
    console.error('[ICP] Failed to load profile, using defaults:', e);
  }
  return DEFAULT_ICP;
}

// ── Tier Classification ──

export function classifyTier(score: number): 'HOT' | 'ACTIVE' | 'NURTURE' | 'LOW' {
  if (score >= 90) return 'HOT';
  if (score >= 70) return 'ACTIVE';
  if (score >= 50) return 'NURTURE';
  return 'LOW';
}

// ── Parse employee count from string like "500-1000" or "10000+" ──

function parseEmployeeRange(range: string | null | undefined): { min: number; max: number } | null {
  if (!range) return null;
  const cleaned = range.replace(/[^0-9\-+]/g, '').trim();
  if (!cleaned) return null;
  if (cleaned.includes('-')) {
    const [min, max] = cleaned.split('-').map(Number);
    if (!isNaN(min) && !isNaN(max)) return { min, max };
  } else if (cleaned.includes('+')) {
    const min = parseInt(cleaned.replace('+', ''), 10);
    if (!isNaN(min)) return { min, max: Infinity };
  } else {
    const n = parseInt(cleaned, 10);
    if (!isNaN(n)) return { min: n, max: n };
  }
  return null;
}

// ── Static Fit Scorer (0-100) ──

function scoreStaticFit(
  company: { industry: string | null; sizeRange: string | null; country: string | null },
  icp: ICPProfile,
  techStack: string[] = [],
): AccountPriorityBreakdown['staticFit'] {
  // Industry match (0-35)
  let industryScore = 0;
  if (company.industry && icp.targetIndustries.length > 0) {
    const normalized = company.industry.toLowerCase();
    if (icp.targetIndustries.some(i => i.toLowerCase() === normalized)) {
      industryScore = 35;
    } else {
      const keywords = normalized.split(/[\s&\/]+/);
      if (keywords.some(k => k.length > 2 && icp.targetIndustries.some(i => i.toLowerCase().includes(k)))) {
        industryScore = 20;
      } else {
        industryScore = 5;
      }
    }
    if (icp.excludeIndustries?.some(e => e.toLowerCase() === normalized)) {
      industryScore = 0;
    }
  } else if (!icp.targetIndustries.length) {
    industryScore = 15;
  }

  // Size match (0-25)
  let sizeScore = 0;
  const companySize = parseEmployeeRange(company.sizeRange);
  if (companySize && icp.targetSizeRanges.length > 0) {
    for (const icpSize of icp.targetSizeRanges) {
      const icpRange = parseEmployeeRange(icpSize);
      if (icpRange && companySize.min <= icpRange.max && companySize.max >= icpRange.min) {
        sizeScore = 25;
        break;
      }
    }
    if (sizeScore === 0) sizeScore = 8;
  } else if (!icp.targetSizeRanges.length) {
    sizeScore = 12;
  }

  // Geography match (0-20)
  let geoScore = 0;
  if (company.country && icp.targetCountries.length > 0) {
    if (icp.targetCountries.some(c => c.toUpperCase() === company.country!.toUpperCase())) {
      geoScore = 20;
    } else {
      geoScore = 5;
    }
  } else if (!icp.targetCountries.length) {
    geoScore = 10;
  }

  // Tech alignment (0-20)
  let techScore = 0;
  if (techStack.length > 0 && icp.preferredTechnologies.length > 0) {
    const matches = techStack.filter(t =>
      icp.preferredTechnologies.some(p => p.toLowerCase() === t.toLowerCase())
    ).length;
    techScore = Math.round((matches / Math.max(techStack.length, 1)) * 20);
  } else if (techStack.length > 0 && icp.preferredTechnologies.length === 0) {
    techScore = 10;
  }

  return {
    score: industryScore + sizeScore + geoScore + techScore,
    industry: industryScore,
    size: sizeScore,
    geography: geoScore,
    techAlignment: techScore,
  };
}

// ── Dynamic Intelligence Scorer (0-100) ──

function scoreDynamicIntelligence(
  signalCount: number,
  highImpactSignals: number,
  evidenceCount: number,
  avgEvidenceConfidence: number,
  avgCapabilityMatch: number,
  contactCount: number,
): AccountPriorityBreakdown['dynamicIntelligence'] {
  // Evidence quality (0-30)
  const evidenceQuality = evidenceCount > 0
    ? Math.min(30, Math.round((avgEvidenceConfidence * 0.6 + Math.min(evidenceCount / 5, 1) * 0.4) * 30))
    : 0;

  // Signal strength (0-30)
  const signalStrength = signalCount > 0
    ? Math.min(30, Math.round((highImpactSignals / Math.max(signalCount, 1)) * 15 + Math.min(signalCount / 5, 1) * 15))
    : 0;

  // Capability match (0-25)
  const capabilityMatch = Math.min(25, Math.round(avgCapabilityMatch * 25));

  // Contact coverage (0-15)
  const contactCoverage = Math.min(15, Math.round(Math.min(contactCount / 3, 1) * 15));

  return {
    score: evidenceQuality + signalStrength + capabilityMatch + contactCoverage,
    evidenceQuality,
    signalStrength,
    capabilityMatch,
    contactCoverage,
  };
}

// ── Timing/Urgency Scorer (0-100) ──

function scoreTimingUrgency(
  latestSignalDaysAgo: number | null,
  activeOpportunities: number,
  recentEngagementEvents: number,
): AccountPriorityBreakdown['timingUrgency'] {
  // Signal recency (0-40)
  let signalRecency = 0;
  if (latestSignalDaysAgo !== null) {
    if (latestSignalDaysAgo <= 7) signalRecency = 40;
    else if (latestSignalDaysAgo <= 14) signalRecency = 30;
    else if (latestSignalDaysAgo <= 30) signalRecency = 20;
    else if (latestSignalDaysAgo <= 60) signalRecency = 10;
    else signalRecency = 3;
  }

  // Opportunity window (0-35)
  const opportunityWindow = Math.min(35, activeOpportunities * 18);

  // Engagement velocity (0-25)
  const engagementVelocity = Math.min(25, recentEngagementEvents * 8);

  return {
    score: signalRecency + opportunityWindow + engagementVelocity,
    signalRecency,
    opportunityWindow,
    engagementVelocity,
  };
}

// ── Main: Compute Account Priority ──

export async function computeAccountPriority(companyId: string): Promise<ComputeResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      industry: true,
      sizeRange: true,
      country: true,
    },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  const icp = await getICPProfile();

  // Load supporting data in parallel
  const [
    researchCard,
    signals,
    evidence,
    contacts,
    capabilityMatches,
    opportunities,
    recentEvents,
  ] = await Promise.all([
    db.companyResearchCard.findUnique({
      where: { companyId },
      select: {
        techStack: true,
        structuredTechLandscape: true,
      },
    }),
    db.companySignal.findMany({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
      select: { impact: true, signalDate: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.evidence.aggregate({
      where: { companyId, status: 'active' },
      _count: true,
      _avg: { confidence: true },
    }),
    db.contact.count({ where: { companyId, isSuppressed: false } }),
    db.signalCapabilityMatch.aggregate({
      where: { companyId },
      _count: true,
      _avg: { matchScore: true },
    }),
    db.opportunityRecommendation.count({
      where: { companyId, status: { in: ['pending_review', 'accepted', 'monitored'] } },
    }),
    db.companyTimelineEvent.count({
      where: {
        companyId,
        eventType: { in: ['email_replied', 'email_opened', 'email_sent'] },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Parse tech stack
  let techStack: string[] = [];
  try {
    const raw = researchCard?.techStack;
    if (raw) techStack = JSON.parse(raw);
  } catch { /* ignore */ }
  if (techStack.length === 0 && researchCard?.structuredTechLandscape) {
    try {
      const landscape = JSON.parse(researchCard.structuredTechLandscape);
      techStack = [...(landscape.cloud || []), ...(landscape.data || []), ...(landscape.ai || [])];
    } catch { /* ignore */ }
  }

  // Compute the three dimensions
  const staticFit = scoreStaticFit(company, icp, techStack);

  const highImpactSignals = signals.filter(s => s.impact === 'high').length;
  const dynamicIntelligence = scoreDynamicIntelligence(
    signals.length,
    highImpactSignals,
    evidence._count,
    evidence._avg?.confidence ?? 0,
    capabilityMatches._avg?.matchScore ?? 0,
    contacts,
  );

  const latestSignalDaysAgo = signals.length > 0
    ? Math.floor((Date.now() - new Date(signals[0].signalDate ?? signals[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const timingUrgency = scoreTimingUrgency(
    latestSignalDaysAgo,
    opportunities,
    recentEvents,
  );

  // Weighted composite: Static 40% + Dynamic 40% + Timing 20%
  const composite = Math.round(
    staticFit.score * 0.4 +
    dynamicIntelligence.score * 0.4 +
    timingUrgency.score * 0.2
  );

  const tier = classifyTier(composite);
  const computedAt = new Date().toISOString();

  // Persist to Company
  await db.company.update({
    where: { id: companyId },
    data: {
      accountPriorityScore: composite,
      priorityTier: tier,
      priorityComputedAt: new Date(),
    },
  });

  return {
    companyId,
    priority: {
      staticFit,
      dynamicIntelligence,
      timingUrgency,
      composite,
      tier,
    },
    computedAt,
  };
}

// ── Batch Compute ──

export async function computeAllAccountPriorities(): Promise<{
  computed: number;
  results: ComputeResult[];
}> {
  const companies = await db.company.findMany({
    select: { id: true },
    where: { status: { not: 'archived' } },
  });

  const results: ComputeResult[] = [];
  for (let i = 0; i < companies.length; i += 10) {
    const batch = companies.slice(i, i + 10);
    const batchResults = await Promise.allSettled(
      batch.map(c => computeAccountPriority(c.id))
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }

  return { computed: results.length, results };
}

// ── Get prioritized company list ──

export async function getPrioritizedCompanies(options: {
  tier?: string;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'priorityScore' | 'intelligenceScore' | 'engagementScore' | 'name';
  sortOrder?: 'asc' | 'desc';
}) {
  const {
    tier,
    limit = 50,
    offset = 0,
    search,
    sortBy = 'priorityScore',
    sortOrder = 'desc',
  } = options;

  const where: Record<string, unknown> = {};
  if (tier && tier !== 'ALL') {
    where.priorityTier = tier;
  }
  if (search) {
    where.OR = [
      { rawName: { contains: search, mode: 'insensitive' } },
      { domain: { contains: search, mode: 'insensitive' } },
      { industry: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Record<string, string> = {};
  if (sortBy === 'priorityScore') orderBy.accountPriorityScore = sortOrder;
  else if (sortBy === 'intelligenceScore') orderBy.intelligenceScore = sortOrder;
  else if (sortBy === 'engagementScore') orderBy.engagementScore = sortOrder;
  else orderBy.rawName = sortOrder;

  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        country: true,
        status: true,
        intelligenceScore: true,
        engagementScore: true,
        accountPriorityScore: true,
        priorityTier: true,
        priorityComputedAt: true,
        _count: {
          select: {
            contacts: true,
            signals: true,
            opportunityRecommendations: true,
            pursuits: true,
          },
        },
      },
    }),
    db.company.count({ where }),
  ]);

  // Tier distribution
  const tierDist = await db.company.groupBy({
    by: ['priorityTier'],
    _count: true,
  });

  return {
    companies,
    total,
    tierDistribution: tierDist.reduce((acc, t) => {
      acc[t.priorityTier ?? "unknown"] = t._count;
      return acc;
    }, {} as Record<string, number>),
  };
}