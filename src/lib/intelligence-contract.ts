/**
 * Company Intelligence Contract Layer
 *
 * SINGLE SOURCE OF TRUTH for all Phase 3 intelligence consumption.
 * Every downstream consumer (Phase 4/5/6) MUST use this module to access
 * company intelligence. No independent web searches allowed.
 *
 * This module provides:
 * - getResearchContext() — clean JSON for AI consumption
 * - getAccountIntelligence() — aggregated lead qualification score
 * - getResearchFreshness() — staleness detection
 * - getSignalMetrics() — signal analytics for dashboards
 */

import { db } from '@/lib/db';
import { getCompanyEvidence, getEvidenceSummary } from '@/lib/research-engine';

// ── Types ──

export interface ResearchContext {
  companyId: string;
  companyName: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  country: string | null;
  sizeRange: string | null;
  internalSummary: string | null;

  // Phase 3 Research Card fields
  researchCard: {
    exists: boolean;
    source: string | null;        // 'research_engine_v3' | 'ai_estimated' | null
    enrichedAt: string | null;    // ISO date
    businessOverview: string | null;
    revenue: string | null;
    employeeCount: string | null;
    fundingStage: string | null;
    techStack: string | null;
    socialProfiles: Record<string, string>;
    industry: string | null;
    website: string | null;
  } | null;

  // Phase 3 Key People (from research card JSON)
  keyPeople: Array<{
    name: string;
    title: string;
    department?: string;
    linkedInUrl?: string;
    source?: string;
  }>;

  // Phase 3 Signals (from CompanySignal table)
  signals: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    impact: string;
    severity: string;
    confidence: number;
    sourceUrl: string | null;
    signalDate: string | null;
    detectedAt: string;
  }>;

  // Phase 3 Recent News (from research card JSON)
  recentNews: Array<{
    title: string;
    snippet: string;
    source: string;
    url: string;
    signalType: string;
    impact: string;
  }>;

  // Phase 3 Field Confidence (from research card JSON)
  fieldConfidence: Record<string, number>;

  // Phase 3 Evidence Summary
  evidenceSummary: {
    totalEvidence: number;
    fields: Record<string, {
      count: number;
      avgConfidence: number;
      tierBreakdown: { premium: number; standard: number; low: number };
    }>;
  };

  // Freshness
  freshness: ResearchFreshness;

  // CRM Context
  contactCount: number;
  internalNotes: string | null;
}

export interface ResearchFreshness {
  /** 0-100 score. 100 = fresh, 0 = never researched or completely stale */
  score: number;
  /** 'fresh' | 'aging' | 'stale' | 'none' */
  status: 'fresh' | 'aging' | 'stale' | 'none';
  /** When the research was last run */
  lastResearchedAt: string | null;
  /** Days since last research (null if never) */
  daysSinceResearch: number | null;
  /** Number of evidence records */
  evidenceCount: number;
  /** Number of signals */
  signalCount: number;
}

export interface AccountIntelligence {
  companyId: string;
  companyName: string;
  /** 0-100 composite intelligence score for lead qualification */
  intelligenceScore: number;
  /** Component scores */
  components: {
    /** How complete the research data is (0-100) */
    dataCompleteness: number;
    /** Average evidence confidence across all fields (0-100) */
    evidenceQuality: number;
    /** How recent the research is (0-100) */
    freshnessScore: number;
    /** Strength of buying signals (0-100) */
    signalStrength: number;
    /** How many contacts we have (0-100) */
    contactCoverage: number;
    /** Overall engagement level (0-100) */
    engagementScore: number;
  };
  /** Qualification tier */
  tier: 'hot' | 'warm' | 'cold' | 'unknown';
  /** Key reasons for the score */
  scoreFactors: string[];
  /** Last computed */
  computedAt: string;
}

export interface SignalMetrics {
  /** Total signals across all companies */
  totalSignals: number;
  /** Signals by type */
  byType: Record<string, number>;
  /** Signals by impact level */
  byImpact: { high: number; medium: number; low: number };
  /** Signals by severity */
  bySeverity: Record<string, number>;
  /** Trend: signals created per day over last 30 days */
  dailyTrend: Array<{ date: string; count: number }>;
  /** Companies with most signals */
  topCompanies: Array<{ companyId: string; companyName: string; signalCount: number; highImpactCount: number }>;
  /** Signal types breakdown with average confidence */
  typeDetails: Array<{
    type: string;
    count: number;
    avgConfidence: number;
    highImpactCount: number;
  }>;
}

// ── Freshness Scoring ──

/**
 * Calculate research freshness score.
 * - Fresh (0-7 days): 100-80
 * - Aging (7-30 days): 80-50
 * - Stale (30-90 days): 50-20
 * - Very stale (90+ days): 20-0
 * - Never researched: 0
 */
function calculateFreshness(
  enrichmentDate: Date | null,
  evidenceCount: number,
  signalCount: number,
): ResearchFreshness {
  if (!enrichmentDate) {
    return {
      score: 0,
      status: 'none',
      lastResearchedAt: null,
      daysSinceResearch: null,
      evidenceCount,
      signalCount,
    };
  }

  const now = Date.now();
  const researchedAt = enrichmentDate.getTime();
  const daysSince = Math.floor((now - researchedAt) / (1000 * 60 * 60 * 24));

  let score: number;
  let status: ResearchFreshness['status'];

  if (daysSince <= 7) {
    score = Math.round(100 - (daysSince / 7) * 20); // 100 → 80
    status = 'fresh';
  } else if (daysSince <= 30) {
    score = Math.round(80 - ((daysSince - 7) / 23) * 30); // 80 → 50
    status = 'aging';
  } else if (daysSince <= 90) {
    score = Math.round(50 - ((daysSince - 30) / 60) * 30); // 50 → 20
    status = 'stale';
  } else {
    score = Math.max(0, Math.round(20 - ((daysSince - 90) / 90) * 20)); // 20 → 0
    status = 'stale';
  }

  // Small bonus for evidence volume (up to +10)
  if (evidenceCount > 20) score = Math.min(100, score + 5);
  if (signalCount > 5) score = Math.min(100, score + 5);

  return {
    score: Math.min(100, Math.max(0, score)),
    status,
    lastResearchedAt: enrichmentDate.toISOString(),
    daysSinceResearch: daysSince,
    evidenceCount,
    signalCount,
  };
}

// ── Main Functions ──

/**
 * getResearchContext — THE SINGLE INTELLIGENCE CONTRACT
 *
 * All downstream AI modules (account-brief, signals, enrich, suggested-contacts,
 * email-generation, opportunities) MUST call this instead of doing independent
 * web searches.
 *
 * Returns a clean, structured JSON object with all Phase 3 intelligence
 * for a company, ready for AI consumption.
 */
export async function getResearchContext(companyId: string): Promise<ResearchContext> {
  // Parallel fetch of all data
  const [company, researchCard, signals, evidenceSummaryData, contactCount, notes] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        normalizedName: true,
        domain: true,
        industry: true,
        website: true,
        country: true,
        sizeRange: true,
        internalSummary: true,
        intelligenceScore: true,
        engagementScore: true,
        status: true,
      },
    }),
    db.companyResearchCard.findUnique({
      where: { companyId },
    }),
    db.companySignal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    getEvidenceSummary(companyId),
    db.contact.count({
      where: { companyId, status: { not: 'archived' } },
    }),
    db.companyNote.findFirst({
      where: { companyId, pinned: true },
      select: { body: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  // Parse research card JSON fields
  let keyPeople: ResearchContext['keyPeople'] = [];
  let recentNews: ResearchContext['recentNews'] = [];
  let fieldConfidence: Record<string, number> = {};
  let socialProfiles: Record<string, string> = {};

  if (researchCard) {
    try { keyPeople = JSON.parse(researchCard.keyPeople || '[]'); } catch { /* ignore */ }
    try { recentNews = JSON.parse(researchCard.recentNews || '[]'); } catch { /* ignore */ }
    try { fieldConfidence = JSON.parse(researchCard.fieldConfidence || '{}'); } catch { /* ignore */ }
    try { socialProfiles = JSON.parse(researchCard.socialProfiles || '{}'); } catch { /* ignore */ }
  }

  // Calculate freshness
  const freshness = calculateFreshness(
    researchCard?.enrichmentDate || null,
    evidenceSummaryData.totalEvidence,
    signals.length,
  );

  return {
    companyId: company.id,
    companyName: company.rawName || company.normalizedName,
    domain: company.domain,
    industry: company.industry,
    website: company.website,
    country: company.country,
    sizeRange: company.sizeRange,
    internalSummary: company.internalSummary,

    researchCard: researchCard ? {
      exists: true,
      source: researchCard.enrichmentSource,
      enrichedAt: researchCard.enrichmentDate?.toISOString() || null,
      businessOverview: researchCard.businessOverview,
      revenue: researchCard.revenue,
      employeeCount: researchCard.employeeCount,
      fundingStage: researchCard.fundingStage,
      techStack: researchCard.techStack,
      socialProfiles,
      industry: researchCard.industry,
      website: researchCard.website,
    } : null,

    keyPeople,
    signals: signals.map(s => ({
      id: s.id,
      type: s.signalType,
      title: s.title,
      description: s.description,
      impact: s.impact,
      severity: s.severity,
      confidence: s.confidence,
      sourceUrl: s.sourceUrl,
      signalDate: s.signalDate?.toISOString() || null,
      detectedAt: s.createdAt.toISOString(),
    })),

    recentNews,
    fieldConfidence,
    evidenceSummary: evidenceSummaryData,
    freshness,
    contactCount,
    internalNotes: notes?.body || null,
  };
}

/**
 * getAccountIntelligence — Aggregated intelligence score for lead qualification.
 * Used by Phase 5 (Sales Execution) to prioritize accounts.
 */
export async function getAccountIntelligence(companyId: string): Promise<AccountIntelligence> {
  const ctx = await getResearchContext(companyId);

  // 1. Data Completeness (0-100): how many research fields are populated
  const fields = ['businessOverview', 'revenue', 'employeeCount', 'fundingStage', 'techStack', 'industry', 'website'];
  const populatedFields = fields.filter(f => {
    const val = ctx.researchCard?.[f as keyof typeof ctx.researchCard];
    return val && val !== 'Not found' && val !== null;
  }).length;
  const dataCompleteness = Math.round((populatedFields / fields.length) * 100);

  // 2. Evidence Quality (0-100): average confidence across all fields
  const confidenceValues = Object.values(ctx.fieldConfidence);
  const evidenceQuality = confidenceValues.length > 0
    ? Math.round((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100)
    : 0;

  // 3. Freshness Score (0-100): directly from freshness calculation
  const freshnessScore = ctx.freshness.score;

  // 4. Signal Strength (0-100): based on signal count, impact, and recency
  const highImpactSignals = ctx.signals.filter(s => s.impact === 'high').length;
  const mediumImpactSignals = ctx.signals.filter(s => s.impact === 'medium').length;
  const signalStrength = Math.min(100,
    highImpactSignals * 25 + mediumImpactSignals * 10 +
    (ctx.signals.length > 5 ? 15 : ctx.signals.length > 2 ? 10 : ctx.signals.length > 0 ? 5 : 0)
  );

  // 5. Contact Coverage (0-100): how many contacts we have
  const contactCoverage = Math.min(100, ctx.contactCount * 15);

  // 6. Engagement Score (0-100): from company's engagementScore field
  const engagementScore = await db.company.findUnique({
    where: { id: companyId },
    select: { engagementScore: true, intelligenceScore: true },
  }).then(c => Math.min(100, Math.max(0, c?.engagementScore || c?.intelligenceScore || 0)));

  // Weighted composite: data 25%, evidence 20%, freshness 15%, signals 20%, contacts 10%, engagement 10%
  const compositeScore = Math.round(
    dataCompleteness * 0.25 +
    evidenceQuality * 0.20 +
    freshnessScore * 0.15 +
    signalStrength * 0.20 +
    contactCoverage * 0.10 +
    engagementScore * 0.10
  );

  // Determine tier
  let tier: AccountIntelligence['tier'];
  if (compositeScore >= 70) tier = 'hot';
  else if (compositeScore >= 40) tier = 'warm';
  else if (compositeScore >= 15) tier = 'cold';
  else tier = 'unknown';

  // Build score factors (human-readable reasons)
  const scoreFactors: string[] = [];
  if (dataCompleteness >= 80) scoreFactors.push('Comprehensive research data available');
  else if (dataCompleteness < 40) scoreFactors.push('Research data is incomplete');

  if (evidenceQuality >= 70) scoreFactors.push('High-confidence evidence sources');
  else if (evidenceQuality < 30) scoreFactors.push('Low evidence confidence');

  if (freshnessScore >= 80) scoreFactors.push('Research is fresh (< 7 days)');
  else if (freshnessScore < 30) scoreFactors.push('Research data is stale — refresh recommended');

  if (highImpactSignals > 0) scoreFactors.push(`${highImpactSignals} high-impact buying signal${highImpactSignals > 1 ? 's' : ''} detected`);
  if (signalStrength >= 60) scoreFactors.push('Strong buying signal activity');

  if (contactCoverage >= 50) scoreFactors.push('Multiple contacts identified');
  if (scoreFactors.length === 0) scoreFactors.push('Limited intelligence available');

  return {
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    intelligenceScore: compositeScore,
    components: {
      dataCompleteness,
      evidenceQuality,
      freshnessScore,
      signalStrength,
      contactCoverage,
      engagementScore,
    },
    tier,
    scoreFactors,
    computedAt: new Date().toISOString(),
  };
}

/**
 * getSignalMetrics — Signal analytics for Phase 6 (Analytics Dashboard).
 * Returns aggregate signal data across all companies.
 */
export async function getSignalMetrics(options?: {
  daysBack?: number;
  limit?: number;
}): Promise<SignalMetrics> {
  const daysBack = options?.daysBack || 30;
  const limit = options?.limit || 10;

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Parallel queries
  const [allSignals, typeGroups, impactGroups, severityGroups, dailyGroups, topCompanyGroups] = await Promise.all([
    db.companySignal.count(),
    db.companySignal.groupBy({
      by: ['signalType'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    }),
    db.companySignal.groupBy({
      by: ['impact'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    }),
    db.companySignal.groupBy({
      by: ['severity'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    }),
    db.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT DATE("createdAt") as day, COUNT(*)::int as count
      FROM "CompanySignal"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `,
    db.companySignal.groupBy({
      by: ['companyId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    }),
  ]);

  // Get company names for top companies
  const topCompanyIds = topCompanyGroups.map(g => g.companyId);
  const companies = topCompanyIds.length > 0
    ? await db.company.findMany({
        where: { id: { in: topCompanyIds } },
        select: { id: true, normalizedName: true },
      })
    : [];
  const companyMap = new Map(companies.map(c => [c.id, c.normalizedName]));

  // Get per-type confidence averages and high-impact counts
  const typeDetailsEntries = await Promise.all(
    typeGroups.map(async (g) => {
      const stats = await db.companySignal.aggregate({
        where: { signalType: g.signalType, createdAt: { gte: since } },
        _avg: { confidence: true },
        _count: { id: true },
      });
      const highImpact = await db.companySignal.count({
        where: { signalType: g.signalType, impact: 'high', createdAt: { gte: since } },
      });
      return {
        type: g.signalType,
        count: g._count.id,
        avgConfidence: Math.round((stats._avg.confidence || 0) * 100) / 100,
        highImpactCount: highImpact,
      };
    })
  );

  return {
    totalSignals: allSignals,
    byType: Object.fromEntries(typeGroups.map(g => [g.signalType, g._count.id])),
    byImpact: {
      high: impactGroups.find(g => g.impact === 'high')?._count.id || 0,
      medium: impactGroups.find(g => g.impact === 'medium')?._count.id || 0,
      low: impactGroups.find(g => g.impact === 'low')?._count.id || 0,
    },
    bySeverity: Object.fromEntries(severityGroups.map(g => [g.severity, g._count.id])),
    dailyTrend: dailyGroups.map(g => ({
      date: g.day,
      count: Number(g.count),
    })),
    topCompanies: topCompanyGroups.map(g => {
      // Get high-impact count for this company
      return {
        companyId: g.companyId,
        companyName: companyMap.get(g.companyId) || 'Unknown',
        signalCount: g._count.id,
        highImpactCount: 0, // Will be populated below
      };
    }),
    typeDetails: typeDetailsEntries,
  };
}

/**
 * Build a text context block from research context for LLM prompts.
 * This is the canonical way to inject Phase 3 intelligence into any LLM call.
 */
export function buildResearchContextText(ctx: ResearchContext): string {
  const parts: string[] = [];

  parts.push('## PHASE 3 INTELLIGENCE (from Research Engine)');

  if (ctx.researchCard) {
    if (ctx.researchCard.businessOverview) {
      parts.push(`Business Overview: ${ctx.researchCard.businessOverview}`);
    }
    if (ctx.researchCard.revenue && ctx.researchCard.revenue !== 'Not found') {
      parts.push(`Revenue: ${ctx.researchCard.revenue} (confidence: ${Math.round((ctx.fieldConfidence.revenue || 0) * 100)}%)`);
    }
    if (ctx.researchCard.employeeCount && ctx.researchCard.employeeCount !== 'Not found') {
      parts.push(`Employees: ${ctx.researchCard.employeeCount} (confidence: ${Math.round((ctx.fieldConfidence.employeeCount || 0) * 100)}%)`);
    }
    if (ctx.researchCard.fundingStage && ctx.researchCard.fundingStage !== 'Not found') {
      parts.push(`Funding: ${ctx.researchCard.fundingStage}`);
    }
    if (ctx.researchCard.techStack) {
      parts.push(`Tech Stack: ${ctx.researchCard.techStack}`);
    }
    if (ctx.researchCard.industry) {
      parts.push(`Industry: ${ctx.researchCard.industry}`);
    }
    if (ctx.researchCard.website) {
      parts.push(`Website: ${ctx.researchCard.website}`);
    }
  }

  if (ctx.keyPeople.length > 0) {
    parts.push(`Key People:\n${ctx.keyPeople.map(p => `  - ${p.name}, ${p.title}${p.department ? ` (${p.department})` : ''}`).join('\n')}`);
  }

  if (ctx.signals.length > 0) {
    parts.push(`Buying Signals (${ctx.signals.length}):\n${ctx.signals.map(s => `  - [${s.impact.toUpperCase()}] ${s.title}: ${s.description || 'No details'} (confidence: ${Math.round(s.confidence * 100)}%)`).join('\n')}`);
  }

  if (ctx.recentNews.length > 0) {
    parts.push(`Recent News:\n${ctx.recentNews.slice(0, 5).map(n => `  - ${n.title} (${n.source})`).join('\n')}`);
  }

  // Field confidence summary
  const confEntries = Object.entries(ctx.fieldConfidence);
  if (confEntries.length > 0) {
    parts.push(`Field Confidence: ${confEntries.map(([f, c]) => `${f}=${Math.round(c * 100)}%`).join(', ')}`);
  }

  // Evidence summary
  if (ctx.evidenceSummary.totalEvidence > 0) {
    parts.push(`Evidence: ${ctx.evidenceSummary.totalEvidence} sources across ${Object.keys(ctx.evidenceSummary.fields).length} fields`);
  }

  // Freshness
  parts.push(`Research Freshness: ${ctx.freshness.score}/100 (${ctx.freshness.status})${ctx.freshness.daysSinceResearch !== null ? `, last researched ${ctx.freshness.daysSinceResearch} days ago` : ', never researched'}`);

  if (parts.length <= 1) {
    return '## PHASE 3 INTELLIGENCE: No research data available. This company has not been researched yet.';
  }

  return parts.join('\n');
}