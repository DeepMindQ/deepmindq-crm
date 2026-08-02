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
import { logger } from '@/lib/logger';
import { registerTimer } from '@/lib/timer-registry';
import { Prisma } from '@prisma/client';

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

// F8: Simple in-memory ICP cache (5 minute TTL)
let icpCache: { profile: ICPProfile; fetchedAt: number } | null = null;
const ICP_CACHE_TTL_MS = 5 * 60 * 1000;

// F9: Supporting data cache (2-minute TTL) to avoid 9 repeated DB queries per request
const _supportingDataCache = new Map<string, { data: unknown[]; fetchedAt: number }>();
const SUPPORTING_DATA_CACHE_TTL = 2 * 60 * 1000;
const SUPPORTING_DATA_CACHE_MAX = 500;

// Periodic cleanup of expired cache entries
if (typeof setInterval !== 'undefined') {
  registerTimer(setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of _supportingDataCache.entries()) {
      if (now - entry.fetchedAt > SUPPORTING_DATA_CACHE_TTL) {
        _supportingDataCache.delete(key);
      }
    }
  }, 5 * 60 * 1000));
}

/** Invalidate supporting data cache (call after data mutations) */
export function invalidateSupportingDataCache(companyId?: string): void {
  if (companyId) _supportingDataCache.delete(companyId);
  else _supportingDataCache.clear();
}

export async function getICPProfile(): Promise<ICPProfile> {
  // Return cached profile if still valid
  if (icpCache && Date.now() - icpCache.fetchedAt < ICP_CACHE_TTL_MS) {
    return icpCache.profile;
  }
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'icp_profile' },
    });
    if (setting?.value) {
      const profile = { ...DEFAULT_ICP, ...JSON.parse(setting.value) };
      icpCache = { profile, fetchedAt: Date.now() };
      return profile;
    }
  } catch (e) {
    logger.error('[ICP] Failed to load profile, using defaults', { error: e instanceof Error ? e.message : String(e), errorType: e instanceof Error ? e.constructor.name : typeof e });
  }
  // Cache default profile too to avoid repeated DB misses
  icpCache = { profile: DEFAULT_ICP, fetchedAt: Date.now() };
  return DEFAULT_ICP;
}

/** Invalidate ICP cache (call after ICP profile updates) */
export function invalidateICPCache(): void {
  icpCache = null;
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

export async function computeAccountPriority(companyId: string, triggerType: 'manual' | 'icp_change' | 'scheduled' | 'batch' = 'manual'): Promise<ComputeResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      industry: true,
      sizeRange: true,
      country: true,
      accountPriorityScore: true,
      priorityTier: true,
      intelligenceScore: true,
    },
  });

  if (!company) {
    // B10: Return structured zero-result instead of throwing — callers can handle gracefully
    logger.error('[account-priority] Company not found', { companyId });
    return {
      companyId,
      priority: {
        staticFit: { score: 0, industry: 0, size: 0, geography: 0, techAlignment: 0 },
        dynamicIntelligence: { score: 0, evidenceQuality: 0, signalStrength: 0, capabilityMatch: 0, contactCoverage: 0 },
        timingUrgency: { score: 0, signalRecency: 0, opportunityWindow: 0, engagementVelocity: 0 },
        composite: 0,
        tier: 'LOW',
      },
      computedAt: new Date().toISOString(),
    };
  }

  const icp = await getICPProfile();

  // F9: Check supporting data cache (2-min TTL) before hitting DB
  const cachedSupporting = _supportingDataCache.get(companyId);
  const cacheHit = cachedSupporting && Date.now() - cachedSupporting.fetchedAt < SUPPORTING_DATA_CACHE_TTL;

  // Load supporting data in parallel (skip if cache hit)
  type ResearchCardRow = { techStack: unknown; structuredTechLandscape: unknown } | null;
  type SignalRow = { impact: string; signalDate: Date | null; createdAt: Date }[];
  type EvidenceAgg = { _count: number; _avg: { confidence: number | null } | null };
  type CapMatchAgg = { _count: number; _avg: { matchScore: number | null } | null };
  type RevenueScoreRow = { score: number; category: string } | null;

  let researchCard: ResearchCardRow;
  let signals: SignalRow;
  let evidence: EvidenceAgg;
  let contacts: number;
  let capabilityMatches: CapMatchAgg;
  let opportunities: number;
  let recentEvents: number;
  let revenueScoreData: RevenueScoreRow;

  if (cacheHit) {
    [researchCard, signals, evidence, contacts, capabilityMatches, opportunities, recentEvents, revenueScoreData] =
      cachedSupporting.data as [ResearchCardRow, SignalRow, EvidenceAgg, number, CapMatchAgg, number, number, RevenueScoreRow];
  } else {
    [researchCard, signals, evidence, contacts, capabilityMatches, opportunities, recentEvents, revenueScoreData] =
      await Promise.all([
        db.companyResearchCard.findUnique({
          where: { companyId },
          select: { techStack: true, structuredTechLandscape: true },
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
        db.accountScore.findUnique({
          where: { companyId },
          select: { score: true, category: true },
        }).catch(() => null),
      ]);
    // F9: Store in cache (evict expired entries if at max capacity)
    if (_supportingDataCache.size >= SUPPORTING_DATA_CACHE_MAX) {
      const now = Date.now();
      for (const [key, entry] of _supportingDataCache.entries()) {
        if (now - entry.fetchedAt > SUPPORTING_DATA_CACHE_TTL) {
          _supportingDataCache.delete(key);
        }
      }
    }
    _supportingDataCache.set(companyId, { data: [researchCard, signals, evidence, contacts, capabilityMatches, opportunities, recentEvents, revenueScoreData], fetchedAt: Date.now() });
  }

  // Parse tech stack
  let techStack: string[] = [];
  try {
    const raw = researchCard?.techStack;
    if (raw) techStack = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { logger.warn('[engine] Failed to parse techStack for company', { companyId }) }
  if (techStack.length === 0 && researchCard?.structuredTechLandscape) {
    try {
      const landscape = typeof researchCard.structuredTechLandscape === 'string' ? JSON.parse(researchCard.structuredTechLandscape) : researchCard.structuredTechLandscape;
      techStack = [...(landscape.cloud || []), ...(landscape.data || []), ...(landscape.ai || [])];
    } catch { logger.warn('[engine] Failed to parse structuredTechLandscape for company', { companyId }) }
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

  // Capture previous score for history tracking (from initial read)
  const previousScore = company.accountPriorityScore ?? null;
  const previousTier = company.priorityTier ?? null;

  // Persist to Company + PriorityScoreHistory in a transaction
  await db.$transaction([
    db.company.update({
      where: { id: companyId },
      data: {
        accountPriorityScore: composite,
        priorityTier: tier,
        priorityComputedAt: new Date(),
      },
    }),
    db.priorityScoreHistory.create({
      data: {
        companyId,
        accountPriorityScore: composite,
        priorityTier: tier,
        // Note: staticFitTotal/dynamicIntelTotal/timingUrgencyTotal (Int) are deprecated duplicates of staticFitScore/dynamicIntelScore/timingUrgencyScore (Float). Kept for backward compatibility with existing history queries.
        staticFitTotal: staticFit.score,
        dynamicIntelTotal: dynamicIntelligence.score,
        timingUrgencyTotal: timingUrgency.score,
        previousScore,
        previousTier,
        newScore: composite,
        newTier: tier,
        triggerType,
        triggerDetails: JSON.stringify({
          staticFit,
          dynamicIntelligence,
          timingUrgency,
        }),
        staticFitScore: staticFit.score,
        dynamicIntelScore: dynamicIntelligence.score,
        timingUrgencyScore: timingUrgency.score,
        // Ticket 4: Unified 3-Score History — capture intelligence & revenue snapshots
        intelligenceScore: company.intelligenceScore ?? null,
        intelligenceTier: company.intelligenceScore != null
          ? (company.intelligenceScore >= 70 ? 'hot' : company.intelligenceScore >= 40 ? 'warm' : company.intelligenceScore >= 15 ? 'cold' : 'unknown')
          : null,
        revenueScore: revenueScoreData?.score ?? null,
        revenueCategory: revenueScoreData?.category ?? null,
        scoreTriggerType: 'priority',
        computedAt: new Date(),
      },
    }),
  ]);

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
      batch.map(c => computeAccountPriority(c.id, 'batch'))
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

  const where: Prisma.CompanyWhereInput = {};
  if (tier && tier !== 'ALL') {
    where.priorityTier = tier as 'HOT' | 'ACTIVE' | 'NURTURE' | 'LOW';
  }
  if (search) {
    where.OR = [
      { rawName: { contains: search, mode: 'insensitive' } },
      { domain: { contains: search, mode: 'insensitive' } },
      { industry: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
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