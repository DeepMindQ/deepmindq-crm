import { db } from '@/lib/db';
import { getIcpProfile, getIcpProfileSync, industryMatch, sizeMatch, regionMatch, techMatch, parseEmployeeCount } from './icp-config';

/* ═══════════════════════════════════════════════════════════════
   Account Prioritization Engine — Phase 5 (Gap Closures)

   Three nested scoring dimensions → composite 0-100 → tier:
     1. Static Fit Score       (40% weight) — Company attributes vs ICP
     2. Dynamic Intelligence   (40% weight) — Intelligence quality & depth
     3. Timing / Urgency       (20% weight) — Signal recency & engagement

   Tier classification:
     HOT     ≥ 90
     ACTIVE  70–89
     NURTURE 50–69
     LOW     < 50

   Phase 5 Gap Closures add:
     - whyNowReasons:    Rule-based "Why this account now?" explanations
     - topSignals:       Top contributing signals with titles and ages
     - recommendedFocus: Capability relevance layer from CapabilityAsset data

   IMPORTANT: This produces `accountPriorityScore` (sales priority),
   which is SEPARATE from the existing `intelligenceScore` (research
   intelligence composite).
   ═══════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────

export type PriorityTier = 'HOT' | 'ACTIVE' | 'NURTURE' | 'LOW';

export interface StaticFitBreakdown {
  industryScore: number;     // 0-100
  companySizeScore: number;  // 0-100
  geographyScore: number;    // 0-100
  revenueScore: number;      // 0-100
  techFitScore: number;      // 0-100
  total: number;             // weighted 0-100
}

export interface DynamicIntelBreakdown {
  intelligenceScoreNorm: number;   // 0-100
  researchDepthScore: number;      // 0-100
  signalQualityScore: number;      // 0-100
  contactCoverageScore: number;    // 0-100
  total: number;                   // weighted 0-100
}

export interface TimingUrgencyBreakdown {
  signalRecencyScore: number;   // 0-100
  engagementRecencyScore: number; // 0-100
  growthIndicatorScore: number;  // 0-100
  total: number;                 // weighted 0-100
}

/** A single signal with human-readable age */
export interface SignalEvidence {
  signalId: string;
  title: string;
  signalType: string;
  severity: string;
  daysAgo: number;
  source: string | null;
}

/** A capability/service line recommendation */
export interface CapabilityRecommendation {
  assetId: string;
  serviceLine: string;
  summary: string;
  matchScore: number;   // 0-100
  reasons: string[];
}

/** Full account priority result with gap closure fields */
export interface AccountPriorityResult {
  companyId: string;
  companyName: string;
  accountPriorityScore: number;
  priorityTier: PriorityTier;
  staticFit: StaticFitBreakdown;
  dynamicIntelligence: DynamicIntelBreakdown;
  timingUrgency: TimingUrgencyBreakdown;
  computedAt: string;
  // ── Gap Closure Fields ──
  /** Rule-based reasons explaining why this account is a priority NOW */
  whyNowReasons: string[];
  /** Top signals contributing to the score */
  topSignals: SignalEvidence[];
  /** Recommended service lines / capabilities to position */
  recommendedFocus: CapabilityRecommendation[];
}

// ── Company data shape needed for scoring ────────────────────

interface CompanyScoringData {
  id: string;
  rawName: string;
  industry: string | null;
  sizeRange: string | null;
  location: string | null;
  country: string | null;
  intelligenceScore: number;
  engagementScore: number;
  lastActivityAt: Date | null;
  lastEnrichedAt: Date | null;
  lifecycleStage: string;
  status: string;
  // Related data counts
  _contactCount: number;
  _signalCount: number;
  _highSeveritySignalCount: number;
  _recentSignalCount: number;     // signals in last 30 days
  _noteCount: number;
  _hasResearchCard: boolean;
  // Enrichment data
  researchRevenue: string | null;
  researchEmployeeCount: string | null;
  researchTechStack: string | null;
  researchFundingStage: string | null;
  // ── Gap closure: actual signal objects ──
  _topSignals: SignalEvidence[];
}

// ── Capability matching types ──

interface CapabilityAssetRow {
  id: string;
  serviceLine: string | null;
  summary: string;
  targetIndustries: string | null;    // JSON array string
  targetCompanySizes: string | null;  // JSON array string or comma-separated
  tags: string | null;                // JSON array string
  problems: string | null;
}

// ── Severity weight for signal sorting ──

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ── Signal-to-capability topic mapping ──

const SIGNAL_CAPABILITY_TOPICS: Record<string, string[]> = {
  tech_change: ['cloud', 'migration', 'modernization', 'engineering', 'devops', 'platform', 'infrastructure', 'digital transformation', 'data engineering'],
  funding: ['digital transformation', 'cloud', 'engineering', 'analytics', 'ai', 'machine learning'],
  hiring: ['engineering', 'development', 'analytics', 'data', 'ai', 'cloud'],
  leadership_change: ['digital transformation', 'strategy', 'consulting', 'advisory'],
  news: ['transformation', 'modernization', 'platform', 'analytics', 'automation'],
  mention: ['consulting', 'advisory', 'strategy', 'implementation'],
  partnership: ['integration', 'implementation', 'engineering', 'cloud', 'platform'],
  expansion: ['scalability', 'cloud', 'engineering', 'infrastructure', 'digital transformation'],
};

// ── Dimension 1: Static Fit Score (0-100) ────────────────────

function computeStaticFit(company: CompanyScoringData): StaticFitBreakdown {
  const icp = getIcpProfileSync();

  // 1. Industry fit (weighted by icp.weights.industry, default 0.3)
  const industryScore = industryMatch(company.industry, icp) ? 100 : 0;

  // 2. Company size fit (weighted by icp.weights.companySize, default 0.25)
  let companySizeScore = 0;
  if (sizeMatch(company.sizeRange, icp)) {
    companySizeScore = 80; // Good match
    // Bonus for larger companies
    const empCount = parseEmployeeCount(company.sizeRange, company.researchEmployeeCount);
    if (empCount >= 1000) companySizeScore = 100;
    else if (empCount >= 500) companySizeScore = 90;
  } else if (company.sizeRange) {
    // Partial: has size data but doesn't match ICP
    companySizeScore = 30;
  }

  // 3. Geography fit (weighted by icp.weights.geography, default 0.15)
  const geographyScore = regionMatch(company.country, company.location, icp) ? 100 : 0;

  // 4. Revenue fit (weighted by icp.weights.revenue, default 0.15)
  let revenueScore = 0;
  if (company.researchRevenue) {
    // Simple heuristic: if we have revenue data at all, that's meaningful
    const revLower = company.researchRevenue.toLowerCase();
    const revNum = parseFloat(revLower.replace(/[^0-9.]/g, ''));
    if (revNum >= 1) revenueScore = 60; // $1M+
    if (revNum >= 10) revenueScore = 75; // $10M+
    if (revNum >= 50) revenueScore = 85; // $50M+
    if (revNum >= 100) revenueScore = 95; // $100M+
    if (revNum >= 500) revenueScore = 100; // $500M+
    // Handle "$" + "B" patterns
    if (revLower.includes('b') && revNum >= 1) revenueScore = 100;
  } else {
    revenueScore = 20; // Unknown but not penalized heavily
  }

  // 5. Tech fit (weighted by icp.weights.techFit, default 0.15)
  const techRatio = techMatch(company.researchTechStack, icp);
  const techFitScore = Math.round(techRatio * 100);

  // Weighted total
  const w = icp.weights;
  const total = Math.round(
    industryScore * w.industry +
    companySizeScore * w.companySize +
    geographyScore * w.geography +
    revenueScore * w.revenue +
    techFitScore * w.techFit
  );

  return {
    industryScore,
    companySizeScore,
    geographyScore,
    revenueScore,
    techFitScore,
    total,
  };
}

// ── Dimension 2: Dynamic Intelligence Score (0-100) ──────────

function computeDynamicIntelligence(company: CompanyScoringData): DynamicIntelBreakdown {
  // 1. Intelligence score normalization (30% of dimension)
  const intelligenceScoreNorm = Math.min(company.intelligenceScore || 0, 100);

  // 2. Research depth score (25% of dimension)
  let researchDepthScore = 0;
  if (company._hasResearchCard) {
    researchDepthScore = 40; // Has a research card
    if (company.researchRevenue) researchDepthScore += 15;
    if (company.researchTechStack) researchDepthScore += 15;
    if (company.researchFundingStage) researchDepthScore += 10;
    if (company.researchEmployeeCount) researchDepthScore += 10;
    if (company.lastEnrichedAt) {
      const daysSinceEnrich = daysBetween(company.lastEnrichedAt, new Date());
      if (daysSinceEnrich <= 30) researchDepthScore += 10;
      else if (daysSinceEnrich <= 90) researchDepthScore += 5;
    }
  }
  researchDepthScore = Math.min(researchDepthScore, 100);

  // 3. Signal quality score (25% of dimension)
  let signalQualityScore = 0;
  if (company._signalCount > 0) {
    signalQualityScore = Math.min(company._signalCount * 10, 50);
    signalQualityScore += Math.min(company._highSeveritySignalCount * 15, 30);
    signalQualityScore += Math.min(company._recentSignalCount * 10, 20);
  }
  signalQualityScore = Math.min(signalQualityScore, 100);

  // 4. Contact coverage score (20% of dimension)
  let contactCoverageScore = 0;
  if (company._contactCount >= 1) contactCoverageScore = 20;
  if (company._contactCount >= 3) contactCoverageScore = 40;
  if (company._contactCount >= 5) contactCoverageScore = 60;
  if (company._contactCount >= 8) contactCoverageScore = 80;
  if (company._contactCount >= 12) contactCoverageScore = 100;

  // Weighted total
  const total = Math.round(
    intelligenceScoreNorm * 0.30 +
    researchDepthScore * 0.25 +
    signalQualityScore * 0.25 +
    contactCoverageScore * 0.20
  );

  return {
    intelligenceScoreNorm,
    researchDepthScore,
    signalQualityScore,
    contactCoverageScore,
    total,
  };
}

// ── Dimension 3: Timing / Urgency Score (0-100) ──────────────

function computeTimingUrgency(company: CompanyScoringData): TimingUrgencyBreakdown {
  const now = new Date();

  // 1. Signal recency score (40% of dimension)
  let signalRecencyScore = 0;
  if (company._recentSignalCount > 0) {
    signalRecencyScore = Math.min(company._recentSignalCount * 25, 100);
  } else if (company._signalCount > 0) {
    signalRecencyScore = 15;
  }

  // 2. Engagement recency score (35% of dimension)
  let engagementRecencyScore = 0;
  if (company.engagementScore > 0) {
    engagementRecencyScore = Math.min(company.engagementScore, 100);
  }
  if (company.lastActivityAt) {
    const daysSinceActivity = daysBetween(company.lastActivityAt, now);
    if (daysSinceActivity <= 7) engagementRecencyScore = Math.max(engagementRecencyScore, 80);
    else if (daysSinceActivity <= 14) engagementRecencyScore = Math.max(engagementRecencyScore, 60);
    else if (daysSinceActivity <= 30) engagementRecencyScore = Math.max(engagementRecencyScore, 40);
    else if (daysSinceActivity <= 90) engagementRecencyScore = Math.max(engagementRecencyScore, 20);
  }

  // 3. Growth indicator score (25% of dimension)
  let growthIndicatorScore = 0;
  const advancedStages = ['qualification', 'proposal', 'negotiation'];
  if (advancedStages.includes(company.lifecycleStage)) {
    growthIndicatorScore = 70;
    if (company.lifecycleStage === 'proposal') growthIndicatorScore = 85;
    if (company.lifecycleStage === 'negotiation') growthIndicatorScore = 95;
  }
  if (company.status === 'active' || company.status === 'engaged') {
    growthIndicatorScore = Math.max(growthIndicatorScore, 50);
  }
  if (company.researchFundingStage) {
    const fundingLower = company.researchFundingStage.toLowerCase();
    if (fundingLower.includes('series b') || fundingLower.includes('series c') ||
        fundingLower.includes('series d') || fundingLower.includes('late')) {
      growthIndicatorScore = Math.max(growthIndicatorScore, 60);
    }
  }

  // Weighted total
  const total = Math.round(
    signalRecencyScore * 0.40 +
    engagementRecencyScore * 0.35 +
    growthIndicatorScore * 0.25
  );

  return {
    signalRecencyScore,
    engagementRecencyScore,
    growthIndicatorScore,
    total,
  };
}

// ── Composite & Tier ─────────────────────────────────────────

function classifyTier(score: number): PriorityTier {
  if (score >= 90) return 'HOT';
  if (score >= 70) return 'ACTIVE';
  if (score >= 50) return 'NURTURE';
  return 'LOW';
}

function computeComposite(
  staticFit: StaticFitBreakdown,
  dynamicIntelligence: DynamicIntelBreakdown,
  timingUrgency: TimingUrgencyBreakdown,
): number {
  const composite = Math.round(
    staticFit.total * 0.40 +
    dynamicIntelligence.total * 0.40 +
    timingUrgency.total * 0.20
  );
  return Math.min(Math.max(composite, 0), 100);
}

// ── Gap 1: "Why This Account Now?" Rule-Based Reasons ───────

function generateWhyNowReasons(
  company: CompanyScoringData,
  staticFit: StaticFitBreakdown,
  dynamicIntelligence: DynamicIntelBreakdown,
  timingUrgency: TimingUrgencyBreakdown,
): string[] {
  const reasons: string[] = [];
  const icp = getIcpProfileSync();

  // --- Signal-based reasons (strongest "why now" drivers) ---
  if (company._recentSignalCount > 0) {
    const criticalOrHigh = company._topSignals.filter(
      s => s.severity === 'critical' || s.severity === 'high'
    );
    if (criticalOrHigh.length > 0) {
      const latest = criticalOrHigh[0];
      reasons.push(
        `Recent ${latest.severity}-severity ${formatSignalType(latest.signalType)} signal detected (${latest.daysAgo}d ago: "${latest.title}")`
      );
    } else {
      reasons.push(
        `${company._recentSignalCount} recent intelligence signal${company._recentSignalCount > 1 ? 's' : ''} detected in the last 30 days`
      );
    }
  }

  // --- Engagement-based reasons ---
  if (company.engagementScore >= 50 && company.lastActivityAt) {
    const daysAgo = daysBetween(company.lastActivityAt, new Date());
    reasons.push(`Active engagement detected (${daysAgo}d since last activity, engagement score: ${company.engagementScore})`);
  }

  // --- Lifecycle stage reasons ---
  const stageLabels: Record<string, string> = {
    qualification: 'qualification',
    proposal: 'proposal',
    negotiation: 'negotiation',
  };
  if (stageLabels[company.lifecycleStage]) {
    reasons.push(`Account is in ${company.lifecycleStage} stage — active buying cycle`);
  }

  // --- Capability alignment reasons (from topSignals) ---
  const signalTypes = new Set(company._topSignals.map(s => s.signalType));
  if (signalTypes.has('tech_change')) {
    reasons.push('Technology transformation signal indicates active modernization or migration');
  }
  if (signalTypes.has('funding')) {
    reasons.push('Recent funding activity suggests investment capacity and growth trajectory');
  }
  if (signalTypes.has('hiring')) {
    reasons.push('Aggressive hiring signals expansion and potential service need');
  }
  if (signalTypes.has('expansion')) {
    reasons.push('Geographic or business expansion indicates scaling requirements');
  }

  // --- Intelligence freshness ---
  if (company.lastEnrichedAt) {
    const daysSinceEnrich = daysBetween(company.lastEnrichedAt, new Date());
    if (daysSinceEnrich <= 14) {
      reasons.push(`Intelligence data is fresh (${daysSinceEnrich}d ago) — high confidence in assessment`);
    } else if (daysSinceEnrich <= 30) {
      reasons.push(`Intelligence enriched within the last month (${daysSinceEnrich}d ago)`);
    }
  }

  // --- Decision maker coverage ---
  if (company._contactCount >= 5) {
    reasons.push(`${company._contactCount} contacts identified — strong stakeholder coverage`);
  } else if (company._contactCount >= 2) {
    reasons.push(`${company._contactCount} contacts in database — initial stakeholder map exists`);
  }

  // --- Static fit reasons (ICP alignment) ---
  if (staticFit.industryScore === 100) {
    reasons.push(`Industry "${company.industry}" matches target ICP`);
  }
  if (staticFit.geographyScore === 100) {
    reasons.push(`Located in target region: ${company.country || company.location}`);
  }
  if (staticFit.techFitScore >= 70) {
    reasons.push(`Strong technology profile alignment (tech fit: ${staticFit.techFitScore}%)`);
  }
  if (staticFit.revenueScore >= 85) {
    reasons.push(`Revenue profile indicates enterprise budget capacity`);
  }

  // --- Research depth ---
  if (company._hasResearchCard && dynamicIntelligence.researchDepthScore >= 80) {
    reasons.push('Deep research coverage available — business context well understood');
  }

  // --- Funding stage reason ---
  if (company.researchFundingStage) {
    const fl = company.researchFundingStage.toLowerCase();
    if (fl.includes('series b') || fl.includes('series c') || fl.includes('series d') || fl.includes('late')) {
      reasons.push(`Funding stage "${company.researchFundingStage}" indicates growth-phase investment appetite`);
    }
  }

  // Deduplicate and return (max 8 to keep it focused)
  return [...new Set(reasons)].slice(0, 8);
}

/** Format signal type into human-readable label */
function formatSignalType(signalType: string): string {
  const labels: Record<string, string> = {
    tech_change: 'technology change',
    leadership_change: 'leadership change',
    funding: 'funding',
    hiring: 'hiring',
    expansion: 'expansion',
    partnership: 'partnership',
    news: 'news',
    mention: 'mention',
  };
  return labels[signalType] || signalType.replace(/_/g, ' ');
}

// ── Gap 2: Top Signals Fetching ─────────────────────────────

function rankSignals(signals: SignalEvidence[]): SignalEvidence[] {
  return [...signals].sort((a, b) => {
    const aWeight = (SEVERITY_WEIGHT[a.severity] || 1) * 100 - a.daysAgo;
    const bWeight = (SEVERITY_WEIGHT[b.severity] || 1) * 100 - b.daysAgo;
    return bWeight - aWeight;
  });
}

/** Convert DB signal rows to SignalEvidence objects */
function toSignalEvidence(rows: Array<{
  id: string;
  title: string;
  signalType: string;
  severity: string;
  source: string | null;
  createdAt: Date;
}>, now: Date): SignalEvidence[] {
  return rows.map(r => ({
    signalId: r.id,
    title: r.title,
    signalType: r.signalType,
    severity: r.severity,
    daysAgo: daysBetween(r.createdAt, now),
    source: r.source,
  }));
}

// ── Gap 3: Capability Relevance Layer ───────────────────────

/** Match a company against service line capabilities */
function matchCapabilities(
  company: CompanyScoringData,
  capabilities: CapabilityAssetRow[],
): CapabilityRecommendation[] {
  if (!capabilities.length) return [];

  const results: CapabilityRecommendation[] = [];
  const companyIndustry = (company.industry || '').toLowerCase();
  const companySize = (company.sizeRange || '').toLowerCase().replace(/\s+/g, '');
  const companyTech = (company.researchTechStack || '').toLowerCase();
  const companySignalTypes = new Set(company._topSignals.map(s => s.signalType));
  const companySignalTitles = company._topSignals.map(s => s.title.toLowerCase());

  for (const cap of capabilities) {
    if (!cap.serviceLine) continue;

    const reasons: string[] = [];
    let score = 0;

    // 1. Industry match (40 points)
    let industryPoints = 0;
    if (cap.targetIndustries) {
      try {
        const targetIndustries: string[] = JSON.parse(cap.targetIndustries);
        if (targetIndustries.some(ti => companyIndustry.includes(ti.toLowerCase()) || ti.toLowerCase().includes(companyIndustry))) {
          industryPoints = 40;
          reasons.push('Industry matches capability target');
        } else if (targetIndustries.some(ti => companyIndustry.length > 0 && (
          ti.toLowerCase().split(' ').some(w => w.length > 3 && companyIndustry.includes(w))
        ))) {
          industryPoints = 15;
          reasons.push('Partial industry alignment');
        }
      } catch { /* skip */ }
    }
    // If no targetIndustries set but company has industry, give partial
    if (industryPoints === 0 && company.industry) {
      industryPoints = 5;
    }

    // 2. Size match (15 points)
    let sizePoints = 0;
    if (cap.targetCompanySizes && company.sizeRange) {
      try {
        const targetSizes: string[] = JSON.parse(cap.targetCompanySizes);
        if (targetSizes.some(ts => {
          const tsNorm = ts.toLowerCase().replace(/\s+/g, '');
          return companySize.includes(tsNorm) || tsNorm.includes(companySize);
        })) {
          sizePoints = 15;
          reasons.push('Company size matches capability target');
        }
      } catch {
        // Try comma-separated
        const parts = cap.targetCompanySizes.split(',').map(s => s.trim().toLowerCase());
        if (parts.some(ts => companySize.includes(ts.replace(/\s+/g, '')))) {
          sizePoints = 15;
          reasons.push('Company size matches capability target');
        }
      }
    }

    // 3. Technology/keyword match (25 points)
    let techPoints = 0;
    const capKeywords = [
      cap.serviceLine.toLowerCase(),
      cap.summary.toLowerCase(),
      ...(cap.tags ? (JSON.parse(cap.tags) as string[]).map(t => t.toLowerCase()) : []),
    ].join(' ');

    if (companyTech) {
      const techWords = companyTech.split(/[,;\[\]{}"]/).map(w => w.trim().toLowerCase()).filter(w => w.length > 2);
      let matchCount = 0;
      for (const tw of techWords) {
        if (capKeywords.includes(tw)) matchCount++;
      }
      if (matchCount >= 3) {
        techPoints = 25;
        reasons.push(`Technology profile overlaps (${matchCount} matching technologies)`);
      } else if (matchCount >= 1) {
        techPoints = 15;
        reasons.push(`Technology profile partially overlaps (${matchCount} matching technology)`);
      }
    }

    // 4. Signal-type relevance (20 points)
    let signalPoints = 0;
    for (const [sigType, topics] of Object.entries(SIGNAL_CAPABILITY_TOPICS)) {
      if (!companySignalTypes.has(sigType)) continue;
      const relevanceScore = topics.filter(t => capKeywords.includes(t.toLowerCase())).length;
      if (relevanceScore >= 2) {
        signalPoints = 20;
        const sigLabel = formatSignalType(sigType);
        reasons.push(`${sigLabel} signal detected — strong relevance to this capability`);
        break;
      } else if (relevanceScore >= 1) {
        signalPoints = Math.max(signalPoints, 12);
        const sigLabel = formatSignalType(sigType);
        reasons.push(`${sigLabel} signal detected — moderate relevance`);
      }
    }

    // 5. Problem-pain alignment bonus (from signal titles) (implicit in signal points above)
    // Also check if signal titles mention capability-relevant terms
    for (const title of companySignalTitles) {
      if (capKeywords.split(' ').some(w => w.length > 4 && title.includes(w))) {
        if (!reasons.some(r => r.includes('signal detected'))) {
          signalPoints = Math.max(signalPoints, 10);
          reasons.push('Signal content aligns with capability domain');
        }
        break;
      }
    }

    score = Math.min(industryPoints + sizePoints + techPoints + signalPoints, 100);

    if (score >= 25) { // Only include if minimum relevance threshold met
      results.push({
        assetId: cap.id,
        serviceLine: cap.serviceLine,
        summary: cap.summary,
        matchScore: score,
        reasons,
      });
    }
  }

  // Sort by match score descending, return top 5
  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

// ── Helpers ──────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ── Data Fetching ────────────────────────────────────────────

async function fetchCompanyScoringData(
  companyId: string,
  signalLimit: number = 10,
): Promise<CompanyScoringData | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      researchCard: {
        select: {
          revenue: true,
          employeeCount: true,
          techStack: true,
          fundingStage: true,
          enrichmentSource: true,
        },
      },
      _count: {
        select: {
          contacts: true,
          signals: true,
          notes: true,
          timeline: true,
        },
      },
    },
  });

  if (!company) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const now = new Date();

  const [highSeverityCount, recentSignalCount, topSignalRows] = await Promise.all([
    db.companySignal.count({
      where: { companyId, severity: { in: ['high', 'critical'] } },
    }),
    db.companySignal.count({
      where: { companyId, createdAt: { gte: thirtyDaysAgo } },
    }),
    // Gap 2: Fetch actual signal objects
    db.companySignal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: signalLimit,
      select: {
        id: true,
        title: true,
        signalType: true,
        severity: true,
        source: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    id: company.id,
    rawName: company.rawName,
    industry: company.industry,
    sizeRange: company.sizeRange,
    location: company.location,
    country: company.country,
    intelligenceScore: company.intelligenceScore || 0,
    engagementScore: company.engagementScore || 0,
    lastActivityAt: company.lastActivityAt,
    lastEnrichedAt: company.lastEnrichedAt,
    lifecycleStage: company.lifecycleStage,
    status: company.status,
    _contactCount: company._count.contacts,
    _signalCount: company._count.signals,
    _highSeveritySignalCount: highSeverityCount,
    _recentSignalCount: recentSignalCount,
    _noteCount: company._count.notes,
    _hasResearchCard: !!company.researchCard,
    researchRevenue: company.researchCard?.revenue ?? null,
    researchEmployeeCount: company.researchCard?.employeeCount ?? null,
    researchTechStack: company.researchCard?.techStack ?? null,
    researchFundingStage: company.researchCard?.fundingStage ?? null,
    _topSignals: rankSignals(toSignalEvidence(topSignalRows, now)),
  };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Compute the account priority score for a single company.
 * Returns the full breakdown + gap closure fields + persists score/tier to DB.
 */
export async function computeAccountPriority(companyId: string): Promise<AccountPriorityResult | null> {
  // Ensure ICP is loaded from DB
  await getIcpProfile();

  const data = await fetchCompanyScoringData(companyId);
  if (!data) return null;

  const staticFit = computeStaticFit(data);
  const dynamicIntelligence = computeDynamicIntelligence(data);
  const timingUrgency = computeTimingUrgency(data);

  const accountPriorityScore = computeComposite(staticFit, dynamicIntelligence, timingUrgency);
  const priorityTier = classifyTier(accountPriorityScore);
  const computedAt = new Date().toISOString();

  // Gap 1: Generate "Why now?" reasons
  const whyNowReasons = generateWhyNowReasons(data, staticFit, dynamicIntelligence, timingUrgency);

  // Gap 2: Top signals (already in data._topSignals)
  const topSignals = data._topSignals.slice(0, 5);

  // Gap 3: Capability relevance matching
  const serviceLineCapabilities = await fetchServiceLineCapabilities();
  const recommendedFocus = matchCapabilities(data, serviceLineCapabilities);

  // Persist to DB (only score/tier, not the gap closure fields — those are computed on demand)
  await db.company.update({
    where: { id: companyId },
    data: {
      accountPriorityScore,
      priorityTier,
      priorityComputedAt: new Date(),
    },
  });

  return {
    companyId: data.id,
    companyName: data.rawName,
    accountPriorityScore,
    priorityTier,
    staticFit,
    dynamicIntelligence,
    timingUrgency,
    computedAt,
    whyNowReasons,
    topSignals,
    recommendedFocus,
  };
}

/**
 * Batch compute account priority for all companies (or filtered set).
 * Returns array of results sorted by score descending.
 * Includes gap closure fields for each company.
 */
export async function computeAccountPriorityBatch(
  options?: {
    status?: string;
    industry?: string;
    limit?: number;
  },
): Promise<{
  results: AccountPriorityResult[];
  totalComputed: number;
  tierBreakdown: Record<PriorityTier, number>;
}> {
  // Ensure ICP is loaded from DB
  await getIcpProfile();

  // Build where clause
  const where: Record<string, unknown> = {};
  if (options?.status) where.status = options.status;
  if (options?.industry) where.industry = { contains: options.industry, mode: 'insensitive' };

  // Fetch all matching companies with their related data
  const companies = await db.company.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      researchCard: {
        select: {
          revenue: true,
          employeeCount: true,
          techStack: true,
          fundingStage: true,
          enrichmentSource: true,
        },
      },
      _count: {
        select: {
          contacts: true,
          signals: true,
          notes: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 500,
  });

  if (!companies.length) {
    return { results: [], totalComputed: 0, tierBreakdown: { HOT: 0, ACTIVE: 0, NURTURE: 0, LOW: 0 } };
  }

  const companyIds = companies.map(c => c.id);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const now = new Date();

  // Bulk fetch signal counts
  const [highSeverityMap, recentSignalMap] = await Promise.all([
    db.companySignal.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds }, severity: { in: ['high', 'critical'] } },
      _count: { id: true },
    }).then(rows => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(row.companyId, row._count.id);
      return map;
    }),
    db.companySignal.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds }, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }).then(rows => {
      const map = new Map<string, number>();
      for (const row of rows) map.set(row.companyId, row._count.id);
      return map;
    }),
  ]);

  // Gap 2: Bulk fetch signals for all companies (single query, group in-memory)
  const allSignals = await db.companySignal.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyId: true,
      title: true,
      signalType: true,
      severity: true,
      source: true,
      createdAt: true,
    },
  });

  // Group signals by companyId
  const signalsByCompany = new Map<string, SignalEvidence[]>();
  for (const sig of allSignals) {
    const existing = signalsByCompany.get(sig.companyId) || [];
    existing.push({
      signalId: sig.id,
      title: sig.title,
      signalType: sig.signalType,
      severity: sig.severity,
      daysAgo: daysBetween(sig.createdAt, now),
      source: sig.source,
    });
    signalsByCompany.set(sig.companyId, existing);
  }

  // Gap 3: Fetch service line capabilities once
  const serviceLineCapabilities = await fetchServiceLineCapabilities();

  // Compute scores for each company
  const results: AccountPriorityResult[] = [];

  for (const company of companies) {
    const topSignals = rankSignals(signalsByCompany.get(company.id) || []).slice(0, 5);

    const data: CompanyScoringData = {
      id: company.id,
      rawName: company.rawName,
      industry: company.industry,
      sizeRange: company.sizeRange,
      location: company.location,
      country: company.country,
      intelligenceScore: company.intelligenceScore || 0,
      engagementScore: company.engagementScore || 0,
      lastActivityAt: company.lastActivityAt,
      lastEnrichedAt: company.lastEnrichedAt,
      lifecycleStage: company.lifecycleStage,
      status: company.status,
      _contactCount: company._count.contacts,
      _signalCount: company._count.signals,
      _highSeveritySignalCount: highSeverityMap.get(company.id) || 0,
      _recentSignalCount: recentSignalMap.get(company.id) || 0,
      _noteCount: company._count.notes,
      _hasResearchCard: !!company.researchCard,
      researchRevenue: company.researchCard?.revenue ?? null,
      researchEmployeeCount: company.researchCard?.employeeCount ?? null,
      researchTechStack: company.researchCard?.techStack ?? null,
      researchFundingStage: company.researchCard?.fundingStage ?? null,
      _topSignals: topSignals,
    };

    const staticFit = computeStaticFit(data);
    const dynamicIntelligence = computeDynamicIntelligence(data);
    const timingUrgency = computeTimingUrgency(data);

    const accountPriorityScore = computeComposite(staticFit, dynamicIntelligence, timingUrgency);
    const priorityTier = classifyTier(accountPriorityScore);

    // Gap 1: Why now?
    const whyNowReasons = generateWhyNowReasons(data, staticFit, dynamicIntelligence, timingUrgency);

    // Gap 3: Capability relevance
    const recommendedFocus = matchCapabilities(data, serviceLineCapabilities);

    results.push({
      companyId: data.id,
      companyName: data.rawName,
      accountPriorityScore,
      priorityTier,
      staticFit,
      dynamicIntelligence,
      timingUrgency,
      computedAt: now.toISOString(),
      whyNowReasons,
      topSignals,
      recommendedFocus,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.accountPriorityScore - a.accountPriorityScore);

  // Batch persist to DB
  const persistNow = new Date();
  await db.$transaction(
    results.map(r =>
      db.company.update({
        where: { id: r.companyId },
        data: {
          accountPriorityScore: r.accountPriorityScore,
          priorityTier: r.priorityTier,
          priorityComputedAt: persistNow,
        },
      })
    )
  );

  // Tier breakdown
  const tierBreakdown: Record<PriorityTier, number> = { HOT: 0, ACTIVE: 0, NURTURE: 0, LOW: 0 };
  for (const r of results) {
    tierBreakdown[r.priorityTier]++;
  }

  return {
    results,
    totalComputed: results.length,
    tierBreakdown,
  };
}

/**
 * Get account rankings from DB (already computed).
 * Does NOT recompute — just reads persisted scores.
 */
export async function getAccountRankings(options?: {
  tier?: PriorityTier;
  limit?: number;
  offset?: number;
  search?: string;
  assignedTo?: string;
}): Promise<{
  rankings: Array<{
    companyId: string;
    companyName: string;
    domain: string | null;
    industry: string | null;
    sizeRange: string | null;
    accountPriorityScore: number | null;
    priorityTier: string | null;
    intelligenceScore: number;
    engagementScore: number;
    assignedTo: string | null;
    priorityComputedAt: Date | null;
  }>;
  total: number;
  tierBreakdown: Record<string, number>;
}> {
  // Build where clause
  const where: Record<string, unknown> = {
    accountPriorityScore: { not: null },
  };
  if (options?.tier) where.priorityTier = options.tier;
  if (options?.search) {
    where.OR = [
      { rawName: { contains: options.search, mode: 'insensitive' } },
      { domain: { contains: options.search, mode: 'insensitive' } },
    ];
  }
  if (options?.assignedTo) where.assignedTo = options.assignedTo;

  // Get total count
  const total = await db.company.count({ where });

  // Get tier breakdown
  const tierGroups = await db.company.groupBy({
    by: ['priorityTier'],
    where: { accountPriorityScore: { not: null } },
    _count: { id: true },
  });
  const tierBreakdown: Record<string, number> = { HOT: 0, ACTIVE: 0, NURTURE: 0, LOW: 0 };
  for (const g of tierGroups) {
    if (g.priorityTier) tierBreakdown[g.priorityTier] = g._count.id;
  }

  // Get rankings
  const rankings = await db.company.findMany({
    where,
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      sizeRange: true,
      accountPriorityScore: true,
      priorityTier: true,
      intelligenceScore: true,
      engagementScore: true,
      assignedTo: true,
      priorityComputedAt: true,
    },
    orderBy: { accountPriorityScore: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });

  return {
    rankings: rankings.map(r => ({
      companyId: r.id,
      companyName: r.rawName,
      domain: r.domain,
      industry: r.industry,
      sizeRange: r.sizeRange,
      accountPriorityScore: r.accountPriorityScore,
      priorityTier: r.priorityTier,
      intelligenceScore: r.intelligenceScore,
      engagementScore: r.engagementScore,
      assignedTo: r.assignedTo,
      priorityComputedAt: r.priorityComputedAt,
    })),
    total,
    tierBreakdown,
  };
}

// ── Capability data fetcher (cached per batch call) ──────────

/** Fetch all active service_line capabilities for matching */
async function fetchServiceLineCapabilities(): Promise<CapabilityAssetRow[]> {
  try {
    return await db.capabilityAsset.findMany({
      where: {
        isActive: true,
        category: 'service_line',
      },
      select: {
        id: true,
        serviceLine: true,
        summary: true,
        targetIndustries: true,
        targetCompanySizes: true,
        tags: true,
        problems: true,
      },
    });
  } catch {
    return [];
  }
}