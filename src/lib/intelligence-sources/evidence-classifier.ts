/**
 * Phase 2A — Evidence Classification Layer (Replaceable)
 *
 * Architecture principle: The classification layer ISOLATES how raw evidence
 * becomes a structured signal. The downstream Intelligence Object never
 * knows or cares how classification happened.
 *
 * Phase 2A: Rule-based keyword classifier (this file)
 * Phase B:   AI Evidence Engine + Knowledge Graph (drop-in replacement)
 *
 * Input:  Raw Evidence (headline, snippet, sourceName, sourceUrl, publishedDate)
 * Output: Classified signal data (signalType, title, description, confidence,
 *         severity, businessImpact, recommendedAction, timingWindow, meaningCategory)
 *
 * The classifier is stateless — pure functions, no DB access.
 */

// ─── Classification Result ────────────────────────────────────

export interface ClassifiedSignal {
  signalType: string;
  title: string;
  description: string;
  confidence: number;        // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: string;    // Why this matters (reasoning chain step 2)
  recommendedAction: string; // What to do about it (reasoning chain step 5)
  timingWindow: string;      // When to act
  meaningCategory: string;    // Buying-stage implication
}

// ─── Signal Type Keyword Patterns ─────────────────────────────

interface SignalPattern {
  type: string;
  keywords: string[];
  titlePhrases: string[];
  confidence: number;
  severity: string;
  timingWindow: string;
  meaningCategory: string;
  businessImpactTemplate: string;
  actionTemplate: string;
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    type: 'funding',
    keywords: ['funding', 'funded', 'investment', 'raised', 'raise', 'series a', 'series b', 'series c', 'venture', 'capital', 'valuation', 'ipo', 'seed round', 'seed funding', 'investment round', 'fundraise'],
    titlePhrases: ['raises', 'raised', 'secures', 'closes', 'announces funding', 'funding round'],
    confidence: 0.85,
    severity: 'high',
    timingWindow: 'within_30_days',
    meaningCategory: 'budget_available',
    businessImpactTemplate: 'Recent funding indicates available budget and growth investment phase — prime opportunity for vendor engagement',
    actionTemplate: 'Engage decision-makers to position solutions during budget allocation phase',
  },
  {
    type: 'hiring',
    keywords: ['hiring', 'job', 'jobs', 'career', 'opening', 'openings', 'recruiting', 'looking for', 'seeking', 'joining', 'hire', 'talent', 'position', 'roles'],
    titlePhrases: ['is hiring', 'hiring for', 'job opening', 'career opportunity', 'looking to hire'],
    confidence: 0.75,
    severity: 'medium',
    timingWindow: 'within_30_days',
    meaningCategory: 'growth_pressure',
    businessImpactTemplate: 'Active hiring signals growth trajectory and potential resource gaps — may indicate upcoming project needs',
    actionTemplate: 'Research specific role requirements to identify capability alignment and outreach timing',
  },
  {
    type: 'leadership_change',
    keywords: ['ceo', 'cto', 'cio', 'cfo', 'coo', 'chief', 'appointed', 'promoted', 'named', 'joins as', 'steps down', 'succeeds', 'new leader', 'leadership', 'executive', 'president', 'vp', 'vice president', 'head of'],
    titlePhrases: ['appointed', 'named', 'joins', 'promoted', 'steps down', 'new ceo', 'new cto', 'new cfo'],
    confidence: 0.80,
    severity: 'high',
    timingWindow: 'within_14_days',
    meaningCategory: 'leadership_openness',
    businessImpactTemplate: 'Leadership change often creates strategic shifts and new technology evaluation windows — key inflection point for vendor engagement',
    actionTemplate: 'Monitor new leader background and priorities for capability alignment; prepare tailored outreach',
  },
  {
    type: 'expansion',
    keywords: ['expansion', 'expanding', 'new office', 'opens office', 'growth', 'entering', 'launches in', 'new market', 'geographic', 'global', 'international', 'new location', 'new facility'],
    titlePhrases: ['expands to', 'opens new office', 'enters market', 'launches in', 'growing operations'],
    confidence: 0.80,
    severity: 'high',
    timingWindow: 'within_30_days',
    meaningCategory: 'growth_pressure',
    businessImpactTemplate: 'Geographic or operational expansion signals infrastructure and service needs — strong opportunity for scalable solutions',
    actionTemplate: 'Position relevant capabilities for new market requirements; identify local stakeholder contacts',
  },
  {
    type: 'tech_change',
    keywords: ['migration', 'cloud', 'ai', 'artificial intelligence', 'machine learning', 'digital transformation', 'moderniz', 'platform', 'infrastructure', 'technology', 'adopting', 'deploying', 'implementing', 'upgrading', 'kubernetes', 'docker', 'aws', 'azure', 'gcp', 'saas', 'erp', 'crm', 'data platform', 'devops', 'microservice'],
    titlePhrases: ['adopts', 'migrates to', 'implements', 'launches platform', 'upgrades', 'modernizes', 'transforms'],
    confidence: 0.75,
    severity: 'medium',
    timingWindow: 'within_30_days',
    meaningCategory: 'tech_dissatisfaction',
    businessImpactTemplate: 'Technology changes signal active evaluation and potential dissatisfaction with current solutions — window for competitive positioning',
    actionTemplate: 'Map technology change to relevant capabilities; prepare technical conversation with architecture team',
  },
  {
    type: 'partnership',
    keywords: ['partnership', 'partner', 'collaboration', 'collaborate', 'joint venture', 'alliance', 'integrates with', 'strategic partner', 'channel partner', 'co-sell'],
    titlePhrases: ['partners with', 'announces partnership', 'joins forces', 'strategic alliance'],
    confidence: 0.75,
    severity: 'medium',
    timingWindow: 'within_30_days',
    meaningCategory: 'vendor_evaluation',
    businessImpactTemplate: 'Partnership activity signals active ecosystem building and may indicate integration requirements or competitive positioning',
    actionTemplate: 'Assess partnership implications for competitive landscape; identify co-sell or integration opportunities',
  },
  {
    type: 'acquisition',
    keywords: ['acquires', 'acquired', 'acquisition', 'buyout', 'merger', 'merges', 'merger', 'takes over', 'purchase'],
    titlePhrases: ['acquires', 'acquired by', 'merger with', 'buys'],
    confidence: 0.85,
    severity: 'critical',
    timingWindow: 'immediate',
    meaningCategory: 'leadership_openness',
    businessImpactTemplate: 'Acquisition signals major organizational change — technology consolidation, budget restructuring, and new vendor evaluation likely',
    actionTemplate: 'Monitor acquisition impact on existing contracts; prepare for potential technology migration needs',
  },
  {
    type: 'news',
    keywords: ['announce', 'announced', 'launches', 'launched', 'release', 'released', 'unveils', 'unveiled', 'reveal', 'revealed', 'introduces', 'introduced', 'debut', 'update', 'updated', 'new feature', 'report', 'quarterly', 'earnings', 'revenue'],
    titlePhrases: ['announces', 'launches', 'unveils', 'introduces', 'reports'],
    confidence: 0.65,
    severity: 'medium',
    timingWindow: 'within_30_days',
    meaningCategory: 'growth_pressure',
    businessImpactTemplate: 'Company announcement may indicate strategic direction change, product evolution, or market positioning relevant to engagement',
    actionTemplate: 'Review announcement details for capability alignment; incorporate into account narrative',
  },
];

// ─── Source Reliability Scoring ───────────────────────────────

const PREMIUM_SOURCES = [
  'reuters', 'bloomberg', 'wsj', 'wall street journal', 'ft.com', 'financial times',
  'techcrunch', 'theverge', 'arstechnica', 'wired', 'axios', 'cnbc', 'forbes',
  'bbc', 'nytimes', 'new york times', 'washington post', 'ap news',
];

const STANDARD_SOURCES = [
  'venturebeat', 'geekwire', 'business insider', 'zdnet', 'cnet', 'techcrunch',
  'the information', 'semi-analysis', 'stratechery',
];

/**
 * Score source reliability based on domain name.
 */
export function scoreSourceReliability(sourceName: string | null, sourceUrl: string | null): {
  score: number; // 0-1
  quality: 'premium' | 'standard' | 'low';
} {
  const domain = sourceUrl
    ? new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`).hostname.replace('www.', '')
    : '';
  const name = (sourceName || '').toLowerCase();
  const combined = `${name} ${domain}`.toLowerCase();

  if (PREMIUM_SOURCES.some(s => combined.includes(s))) {
    return { score: 0.9, quality: 'premium' };
  }
  if (STANDARD_SOURCES.some(s => combined.includes(s))) {
    return { score: 0.75, quality: 'standard' };
  }
  // Official company domain gets premium
  if (domain && !domain.includes('.news') && !domain.includes('blog.')) {
    return { score: 0.85, quality: 'premium' };
  }
  return { score: 0.5, quality: 'low' };
}

// ─── Main Classification Function ──────────────────────────────

export interface RawEvidenceInput {
  headline: string;
  snippet: string;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedDate: string | null;   // ISO date or null
  collectionDate: string;        // ISO date when we collected it
}

/**
 * Classify a raw evidence item into a structured signal.
 *
 * This is the REPLACEABLE classification layer.
 * Today: rule-based keyword matching.
 * Future: AI Evidence Engine (drop-in replacement — same interface).
 */
export function classifyEvidence(evidence: RawEvidenceInput): ClassifiedSignal | null {
  const text = `${evidence.headline} ${evidence.snippet}`.toLowerCase();

  // Find best matching pattern
  let bestMatch: SignalPattern | null = null;
  let bestScore = 0;

  for (const pattern of SIGNAL_PATTERNS) {
    const keywordHits = pattern.keywords.filter(kw => text.includes(kw)).length;
    const titleHits = pattern.titlePhrases.filter(tp => evidence.headline.toLowerCase().includes(tp)).length;

    // Score: title matches are worth 2x keyword matches
    const score = titleHits * 2 + keywordHits;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  // Minimum threshold: at least 1 keyword or title match
  if (!bestMatch || bestScore < 1) {
    return null;
  }

  // Adjust confidence based on source quality
  const sourceReliability = scoreSourceReliability(evidence.sourceName, evidence.sourceUrl);
  const adjustedConfidence = Math.min(0.95, bestMatch.confidence * (0.7 + sourceReliability.score * 0.3));

  // Adjust severity based on recency and source quality
  let severity = bestMatch.severity as 'low' | 'medium' | 'high' | 'critical';
  if (sourceReliability.quality === 'premium' && bestScore >= 3) {
    // Boost severity for strong signals from premium sources
    if (severity === 'medium') severity = 'high';
    if (severity === 'high') severity = 'critical';
  }

  return {
    signalType: bestMatch.type,
    title: evidence.headline,
    description: evidence.snippet,
    confidence: Math.round(adjustedConfidence * 100) / 100,
    severity,
    businessImpact: bestMatch.businessImpactTemplate,
    recommendedAction: bestMatch.actionTemplate,
    timingWindow: bestMatch.timingWindow,
    meaningCategory: bestMatch.meaningCategory,
  };
}

/**
 * Batch classify multiple evidence items.
 * Returns classified signals, skipping items that don't match any pattern.
 */
export function batchClassifyEvidence(items: RawEvidenceInput[]): ClassifiedSignal[] {
  return items
    .map(item => ({ item, classified: classifyEvidence(item) }))
    .filter(({ classified }) => classified !== null)
    .map(({ item, classified }) => classified!);
}

// ─── Reasoning Chain Builder ──────────────────────────────────

/**
 * Build the deterministic reasoning chain for a classified signal.
 *
 * The 5-step chain:
 *   1. What happened?       → signal title + description
 *   2. Why does it matter? → businessImpact from classifier
 *   3. Why are we relevant?→ derived from signal type + company context
 *   4. Who should act?     → derived from signal type + stakeholder mapping
 *   5. What should we do?  → recommendedAction from classifier
 */
export function buildReasoningChain(
  classified: ClassifiedSignal,
  companyName: string,
  evidence: RawEvidenceInput,
  hasCapabilityMatch: boolean = false,
  matchedCapability?: string
): {
  whatHappened: string;
  whyItMatters: string;
  whyWeRelevant: string;
  whoShouldAct: string;
  whatToDo: string;
} {
  // 1. What happened?
  const whatHappened = evidence.publishedDate
    ? `${evidence.headline} (${formatRelativeDate(evidence.publishedDate)})`
    : evidence.headline;

  // 2. Why does it matter?
  const whyItMatters = classified.businessImpact;

  // 3. Why are we relevant?
  const whyWeRelevant = hasCapabilityMatch && matchedCapability
    ? `Our ${matchedCapability} capability directly addresses the needs created by this ${classified.signalType.replace(/_/g, ' ')} signal at ${companyName}`
    : `This ${classified.signalType.replace(/_/g, ' ')} activity at ${companyName} indicates potential alignment with our solutions — further analysis recommended`;

  // 4. Who should act?
  const whoShouldAct = mapSignalToStakeholder(classified.signalType);

  // 5. What should we do?
  const whatToDo = classified.recommendedAction;

  return { whatHappened, whyItMatters, whyWeRelevant, whoShouldAct, whatToDo };
}

function mapSignalToStakeholder(signalType: string): string {
  const mapping: Record<string, string> = {
    funding: 'Account Executive — engage executive sponsors during budget allocation',
    hiring: 'Sales Development Rep — research role requirements and identify entry point',
    leadership_change: 'Account Executive — priority outreach to new leadership team',
    expansion: 'Account Executive — engage operations and infrastructure decision-makers',
    tech_change: 'Solution Architect — prepare technical evaluation and proof of concept',
    partnership: 'Business Development — assess partnership implications and co-sell potential',
    acquisition: 'Account Executive — immediate assessment of organizational impact on existing pipeline',
    news: 'Account Executive — incorporate into account narrative and next touchpoint',
  };
  return mapping[signalType] || 'Account Executive — assess and determine engagement strategy';
}

function formatRelativeDate(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 7) return `${days} days ago`;
  if (days <= 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
