/**
 * Signal-to-Capability Matching Engine (Phase 3 Hardening)
 *
 * Matches detected buying signals against the capability knowledge base
 * to identify relevant capabilities, solutions, and sales angles for each company.
 *
 * Scoring: category match (30%) + keyword match (30%) + business problem alignment (20%) + impact bonus (5%)
 * LLM-enhanced matching for low-confidence signals as a fallback.
 */

import { db } from '@/lib/db';

// ── Types ──

export interface SignalCapabilityMatchResult {
  signalId: string;
  signalType: string;
  signalTitle: string;
  capabilityId: string;
  capabilityTitle: string;
  matchScore: number;
  reason: string;
  businessProblem: string | null;
  expectedOutcome: string | null;
  salesAngle: string | null;
}

export interface MatchConfig {
  categoryWeight: number;
  keywordWeight: number;
  businessProblemWeight: number;
  impactBonusWeight: number;
  minMatchScore: number;
  useLLMEnhancement: boolean;
  llmEnhancementThreshold: number;
}

// ── Signal Type to Capability Category Mapping ──

const SIGNAL_CAPABILITY_MAP: Record<string, {
  capabilityCategories: string[];
  businessProblems: string[];
  salesAngles: string[];
  keywords: string[];
}> = {
  funding_round: {
    capabilityCategories: ['cloud_migration', 'data_platform', 'digital_transformation', 'scalable_infrastructure'],
    businessProblems: ['scaling infrastructure', 'rapid growth management', 'data platform maturity'],
    salesAngles: ['New funding enables transformation investments', 'Scale-ready architecture for growth phase'],
    keywords: ['funding', 'investment', 'series', 'capital', 'growth', 'scale', 'expansion'],
  },
  hiring_spree: {
    capabilityCategories: ['talent_acquisition', 'digital_workplace', 'cloud_migration', 'data_platform'],
    businessProblems: ['talent retention', 'onboarding efficiency', 'collaboration at scale'],
    salesAngles: ['Support rapid team scaling with modern tooling', 'Reduce time-to-productivity for new hires'],
    keywords: ['hiring', 'recruiting', 'job opening', 'position', 'talent', 'headcount', 'team growth'],
  },
  product_launch: {
    capabilityCategories: ['cloud_migration', 'data_platform', 'customer_experience', 'application_modernization'],
    businessProblems: ['time-to-market pressure', 'reliability at launch', 'customer onboarding'],
    salesAngles: ['Ensure launch-day reliability and scalability', 'Accelerate go-to-market with proven patterns'],
    keywords: ['launch', 'release', 'new product', 'feature', 'go-to-market', 'rollout', 'announce'],
  },
  leadership_change: {
    capabilityCategories: ['digital_transformation', 'cloud_migration', 'data_analytics'],
    businessProblems: ['strategic alignment', 'technology modernization under new leadership', 'innovation acceleration'],
    salesAngles: ['New leadership often drives transformation mandates', 'Partner in the new strategic direction'],
    keywords: ['ceo', 'cto', 'cio', 'appointed', 'leadership', 'executive', 'joined', 'named'],
  },
  acquisition: {
    capabilityCategories: ['cloud_migration', 'data_platform', 'integration', 'application_modernization'],
    businessProblems: ['system integration', 'data consolidation', 'culture alignment', 'technology harmonization'],
    salesAngles: ['Post-acquisition integration expertise', 'Unify technology stacks across organizations'],
    keywords: ['acquired', 'acquisition', 'merger', 'buy', 'purchase', 'combine', 'integration'],
  },
  tech_stack_change: {
    capabilityCategories: ['cloud_migration', 'data_platform', 'application_modernization', 'devops'],
    businessProblems: ['legacy modernization', 'skill gap in new technology', 'migration risk'],
    salesAngles: ['Proven migration methodology reduces risk', 'Accelerate adoption of new technology stack'],
    keywords: ['migrating', 'adopting', 'switching', 'moving to', 'transitioning', 'cloud', 'kubernetes', 'microservices'],
  },
  expansion: {
    capabilityCategories: ['cloud_migration', 'scalable_infrastructure', 'data_platform', 'customer_experience'],
    businessProblems: ['multi-region deployment', 'localization', 'regulatory compliance', 'scale'],
    salesAngles: ['Global infrastructure for expansion', 'Compliance-ready platform for new markets'],
    keywords: ['expanding', 'new market', 'international', 'global', 'region', 'opening', 'launch in'],
  },
  partnership: {
    capabilityCategories: ['data_platform', 'integration', 'customer_experience'],
    businessProblems: ['data sharing', 'API integration', 'joint customer experience'],
    salesAngles: ['Enable seamless partner integrations', 'Build composable APIs for ecosystem growth'],
    keywords: ['partnership', 'partner', 'alliance', 'collaboration', 'joint', 'integrate with'],
  },
  regulatory: {
    capabilityCategories: ['data_governance', 'compliance', 'security'],
    businessProblems: ['compliance automation', 'data privacy', 'audit readiness', 'risk management'],
    salesAngles: ['Compliance-as-code approach', 'Automated audit trails and reporting'],
    keywords: ['regulation', 'compliance', 'gdpr', 'sox', 'hipaa', 'audit', 'privacy', 'security'],
  },
  financial_pressure: {
    capabilityCategories: ['cost_optimization', 'cloud_migration', 'automation'],
    businessProblems: ['cost reduction', 'operational efficiency', 'ROI pressure'],
    salesAngles: ['Proven cost reduction through optimization', 'Pay-as-you-grow model reduces upfront investment'],
    keywords: ['layoff', 'cost cutting', 'restructuring', 'efficiency', 'budget', 'downsize', 'optimize'],
  },
};

// ── Default Config ──

const DEFAULT_CONFIG: MatchConfig = {
  categoryWeight: 0.30,
  keywordWeight: 0.30,
  businessProblemWeight: 0.20,
  impactBonusWeight: 0.05,
  minMatchScore: 0.25,
  useLLMEnhancement: true,
  llmEnhancementThreshold: 0.35,
};

// ── Core Matching Logic ──

/**
 * Calculate keyword overlap between two string arrays.
 * Returns a score 0-1 based on Jaccard-like similarity.
 */
function keywordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract keywords from a text string (simple tokenization + stopword removal).
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'as', 'until', 'while', 'of',
    'at', 'by', 'for', 'with', 'about', 'against', 'between', 'through',
    'during', 'before', 'after', 'above', 'below', 'to', 'from', 'in',
    'on', 'that', 'this', 'these', 'those', 'it', 'its', 'they', 'their',
    'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Score a single signal against a single capability asset.
 */
function scoreMatch(
  signal: { type: string; title: string; description: string | null; impact: string; keywords?: string[] },
  capability: {
    id: string;
    title: string;
    summary: string;
    category: string;
    problems: string | null;
    keywords: string | null;
    targetIndustries: string | null;
    technology: string | null;
    businessProblem: string | null;
    customerOutcome: string | null;
    differentiator: string | null;
  },
  config: MatchConfig,
): SignalCapabilityMatchResult {
  const signalMap = SIGNAL_CAPABILITY_MAP[signal.type];
  const capabilityProblems: string[] = capability.problems
    ? JSON.parse(capability.problems)
    : capability.businessProblem
      ? [capability.businessProblem]
      : [];
  const capabilityKeywords: string[] = capability.keywords
    ? JSON.parse(capability.keywords)
    : extractKeywords(`${capability.title} ${capability.summary} ${capability.technology || ''}`);

  // ── Category match (30%) ──
  let categoryScore = 0;
  if (signalMap) {
    categoryScore = signalMap.capabilityCategories.includes(capability.category) ? 1.0 : 0.0;
  }

  // ── Keyword match (30%) ──
  const signalKeywords = signal.keywords || [
    ...extractKeywords(signal.title),
    ...(signal.description ? extractKeywords(signal.description) : []),
    ...(signalMap ? signalMap.keywords : []),
  ];
  const keywordScore = keywordOverlap(signalKeywords, capabilityKeywords);

  // ── Business problem alignment (20%) ──
  let problemScore = 0;
  if (signalMap && capabilityProblems.length > 0) {
    problemScore = keywordOverlap(signalMap.businessProblems, capabilityProblems);
  }

  // ── Impact bonus (5%) ──
  let impactBonus = 0;
  if (signal.impact === 'high') impactBonus = 0.05;
  else if (signal.impact === 'medium') impactBonus = 0.025;

  // ── Weighted total ──
  const matchScore = Math.round(
    (categoryScore * config.categoryWeight +
     keywordScore * config.keywordWeight +
     problemScore * config.businessProblemWeight +
     impactBonus * config.impactBonusWeight) * 100,
  ) / 100;

  // ── Generate reason and sales angle ──
  const reasons: string[] = [];
  if (categoryScore > 0) reasons.push('capability category matches signal type');
  if (keywordScore > 0.3) reasons.push('strong keyword overlap');
  if (problemScore > 0.2) reasons.push('business problem alignment');
  if (impactBonus > 0) reasons.push(`high-impact signal (${signal.impact})`);

  let salesAngle: string | null = null;
  let businessProblem: string | null = null;
  let expectedOutcome: string | null = null;

  if (signalMap) {
    salesAngle = signalMap.salesAngles[0] || null;
    businessProblem = signalMap.businessProblems[0] || null;
  }
  if (capability.customerOutcome) {
    expectedOutcome = capability.customerOutcome;
  }

  return {
    signalId: '', // populated by caller
    signalType: signal.type,
    signalTitle: signal.title,
    capabilityId: capability.id,
    capabilityTitle: capability.title,
    matchScore,
    reason: reasons.length > 0 ? reasons.join('; ') : 'weak match',
    businessProblem,
    expectedOutcome,
    salesAngle,
  };
}

// ── Public API ──

/**
 * Match all signals for a company against the capability knowledge base.
 * Stores results in SignalCapabilityMatch table and returns matches above threshold.
 *
 * This function is called after signal detection as part of the research pipeline,
 * or on-demand when the user views capability matches.
 */
export async function matchSignalsToCapabilities(
  companyId: string,
  config?: Partial<MatchConfig>,
): Promise<{
  totalMatches: number;
  highConfidence: number;
  results: SignalCapabilityMatchResult[];
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Phase 4 B1: Only match against active, validated, and aging signals.
  // Expired and archived signals MUST NOT influence capability matching.
  const signals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['active', 'validated', 'aging'] },
    },
    orderBy: { confidence: 'desc' },
  });

  if (signals.length === 0) {
    return { totalMatches: 0, highConfidence: 0, results: [] };
  }

  // Load all active capability assets
  const capabilities = await db.capabilityAsset.findMany({
    where: { isActive: true },
  });

  if (capabilities.length === 0) {
    return { totalMatches: 0, highConfidence: 0, results: [] };
  }

  // Score all signal-capability pairs
  const allMatches: SignalCapabilityMatchResult[] = [];
  for (const signal of signals) {
    for (const capability of capabilities) {
      const match = scoreMatch(
        {
          type: signal.signalType,
          title: signal.title,
          description: signal.description,
          impact: signal.impact,
        },
        capability,
        cfg,
      );
      match.signalId = signal.id;
      allMatches.push(match);
    }
  }

  // Filter to matches above threshold
  const validMatches = allMatches
    .filter(m => m.matchScore >= cfg.minMatchScore)
    .sort((a, b) => b.matchScore - a.matchScore);

  // Delete old matches and store new ones
  await db.signalCapabilityMatch.deleteMany({ where: { companyId } });

  if (validMatches.length > 0) {
    await db.signalCapabilityMatch.createMany({
      data: validMatches.map(m => ({
        companyId,
        signalId: m.signalId,
        capabilityId: m.capabilityId,
        matchScore: m.matchScore,
        reason: m.reason,
        businessProblem: m.businessProblem,
        expectedOutcome: m.expectedOutcome,
        salesAngle: m.salesAngle,
      })),
    });
  }

  const highConfidence = validMatches.filter(m => m.matchScore >= 0.6).length;

  return {
    totalMatches: validMatches.length,
    highConfidence,
    results: validMatches.slice(0, 50), // cap at 50 for performance
  };
}

/**
 * Get stored signal-capability matches for a company.
 * Does not re-run matching — returns previously computed results.
 */
export async function getSignalCapabilityMatches(
  companyId: string,
  options?: { minScore?: number; limit?: number },
): Promise<SignalCapabilityMatchResult[]> {
  const minScore = options?.minScore ?? 0;
  const limit = options?.limit ?? 50;

  const matches = await db.signalCapabilityMatch.findMany({
    where: {
      companyId,
      matchScore: { gte: minScore },
    },
    orderBy: { matchScore: 'desc' },
    take: limit,
  });

  return matches.map(m => ({
    signalId: m.signalId,
    signalType: '', // Not stored, would need join
    signalTitle: '', // Not stored, would need join
    capabilityId: m.capabilityId,
    capabilityTitle: '', // Not stored, would need join
    matchScore: m.matchScore,
    reason: m.reason,
    businessProblem: m.businessProblem,
    expectedOutcome: m.expectedOutcome,
    salesAngle: m.salesAngle,
  }));
}