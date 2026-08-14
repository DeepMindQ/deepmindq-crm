/* ═══════════════════════════════════════════════════════════════
   MS8 §1 — Evidence & Trust Metadata Types
   
   Single source of truth for all MS8 Depth & Trust components.
   These types bridge the backend intelligence layer (ai-evidence-framework,
   confidence-explainability, intelligence-api) to the frontend presentation
   layer (evidence-chain, confidence-indicator, progressive-disclosure).
   
   Governance: Changes here affect all MS8 components. Review before modifying.
   ═══════════════════════════════════════════════════════════════ */

// ─── Trust Tier System (MS6 5-tier) ────────────────────────────────
// Maps directly to tokens.trust keys. Every trust-related component
// MUST use this enum — never hardcoded strings or numbers.
// These string literals match the keys in design-tokens.ts tokens.trust.

/** 5-tier trust scale from MS6 Phase 2 Design System Foundation */
export type TrustTier = 'verified' | 'high' | 'medium' | 'low' | 'unverified';

/** Numeric ranges for each trust tier (0-100) */
export const TRUST_TIER_THRESHOLDS = {
  verified: { min: 90, max: 100 },
  high: { min: 70, max: 89 },
  medium: { min: 45, max: 69 },
  low: { min: 25, max: 44 },
  unverified: { min: 0, max: 24 },
} as const;

/** Evidence quality levels — maps to existing ai-evidence-framework.EvidenceQuality */
export type EvidenceQuality =
  'verified' | 'corroborated' | 'inferred' | 'estimated' | 'speculative';

/** Map from EvidenceQuality → TrustTier for visual rendering */
export function evidenceQualityToTrustTier(quality: EvidenceQuality): TrustTier {
  switch (quality) {
    case 'verified':
      return 'verified';
    case 'corroborated':
      return 'high';
    case 'inferred':
      return 'medium';
    case 'estimated':
      return 'low';
    case 'speculative':
      return 'unverified';
  }
}

// ─── Source Type Classification ────────────────────────────────────
// Aligned with MS6 evidence chain color-coded dots:
//   Green (Verified) = SEC filings, official docs
//   Purple (AI) = AI inferences, pattern matching
//   Blue (CRM) = Internal CRM data
//   Cyan (Web) = Web signals, job postings, news
//   Teal (High) = High-reliability external sources

/** Source provenance categories — determines icon, color, and trust baseline */
export type SourceCategory =
  | 'verified_official' // SEC filings, regulatory documents, press releases
  | 'verified_external' // LinkedIn profiles, official company pages
  | 'crm_internal' // CRM data, contact records, deal history
  | 'web_signal' // Job postings, news articles, blog posts
  | 'ai_inference' // AI-generated insights, pattern matching
  | 'crm_analytics' // Computed from CRM data, historical patterns
  | 'external_database'; // Clearbit, Apollo, third-party enrichment

/** Color domain for each source category — maps to design-tokens.ts domain/trust keys */
export type SourceColorDomain =
  'action' | 'verified' | 'signal' | 'enrichment' | 'opportunity' | 'reasoning';

/** Configuration for each source category */
export const SOURCE_CATEGORY_CONFIG: Record<
  SourceCategory,
  {
    label: string;
    trustBaseline: TrustTier;
    colorDomain: SourceColorDomain;
  }
> = {
  verified_official: {
    label: 'Official Document',
    trustBaseline: 'verified',
    colorDomain: 'action',
  },
  verified_external: {
    label: 'Verified Source',
    trustBaseline: 'verified',
    colorDomain: 'verified',
  },
  crm_internal: { label: 'CRM Data', trustBaseline: 'high', colorDomain: 'signal' },
  web_signal: { label: 'Web Signal', trustBaseline: 'high', colorDomain: 'enrichment' },
  ai_inference: { label: 'AI Inference', trustBaseline: 'medium', colorDomain: 'opportunity' },
  crm_analytics: { label: 'CRM Analytics', trustBaseline: 'medium', colorDomain: 'reasoning' },
  external_database: { label: 'External Database', trustBaseline: 'high', colorDomain: 'signal' },
} as const;

// ─── Evidence Chain Item (Enriched) ─────────────────────────────────
// Extends the existing ai-evidence-framework.AIEvidenceItem with
// frontend-specific metadata for MS8 evidence rendering.

/** A single evidence item in the evidence chain */
export interface EvidenceChainItem {
  /** Unique identifier for this evidence item */
  id: string;

  /** What the evidence shows (headline) */
  title: string;

  /** Detailed description or excerpt */
  description: string;

  /** Source category — determines visual treatment */
  sourceCategory: SourceCategory;

  /** Human-readable source name (e.g., "SEC Filing", "LinkedIn", "Greenhouse") */
  sourceName: string;

  /** Direct URL to source material (if available) */
  sourceUrl?: string;

  /** When this evidence was detected/collected (ISO 8601) */
  detectedAt: string;

  /** How old this evidence is, human-readable (e.g., "3 days ago") */
  freshnessLabel: string;

  /** Trust tier for this specific evidence item */
  trustTier: TrustTier;

  /** Trust score 0-100 for this evidence item */
  trustScore: number;

  /** Evidence quality from the AI evidence framework */
  evidenceQuality: EvidenceQuality;

  /** Relevance score 0-100 for the parent intelligence conclusion */
  relevanceScore: number;

  /** Key data points extracted from this evidence */
  keyDataPoints?: string[];

  /** Whether this evidence has been human-verified */
  humanVerified: boolean;
}

// ─── Evidence Footprint (Summary) ──────────────────────────────────
// Compact summary shown at L1/L2 level indicating evidence depth.

/** Summary of evidence supporting an intelligence conclusion */
export interface EvidenceFootprint {
  /** Total number of evidence sources */
  totalSources: number;

  /** Number of verified sources (trust score >= 90) */
  verifiedCount: number;

  /** Number of high-confidence sources (trust score >= 70) */
  highConfidenceCount: number;

  /** Most recent evidence timestamp (ISO 8601) */
  mostRecentAt: string | null;

  /** Oldest evidence timestamp (ISO 8601) */
  oldestAt: string | null;

  /** Aggregate freshness level */
  freshnessLevel: 'realtime' | 'fresh' | 'aging' | 'stale' | 'unknown';

  /** Source category breakdown (counts per category) */
  sourceBreakdown: Partial<Record<SourceCategory, number>>;

  /** Whether AI inference is a contributing source */
  hasAIInference: boolean;
}

// ─── Confidence Breakdown ──────────────────────────────────────────
// Decomposes a confidence score into contributing factors.
// Extends the existing confidence-explainability.ConfidenceFactor
// with UI-specific structure.

/** Categories of factors contributing to a confidence score */
export type ConfidenceFactorCategory =
  | 'source_quality' // How reliable are the underlying sources
  | 'freshness' // How recent is the intelligence
  | 'evidence_strength' // How much evidence supports the conclusion
  | 'signal_convergence' // How many independent signals agree
  | 'data_completeness' // How complete is the company profile
  | 'conflict_penalty'; // Unresolved conflicts reduce confidence

/** A single factor contributing to the confidence score */
export interface ConfidenceFactor {
  /** Human-readable factor label */
  label: string;

  /** Category this factor belongs to */
  category: ConfidenceFactorCategory;

  /** Points contributed (positive or negative) */
  points: number;

  /** Maximum possible points for this factor */
  maxPoints: number;

  /** Human-readable explanation of why this score */
  explanation: string;

  /** Trust tier for this factor's contribution */
  tier: TrustTier;
}

/** Full confidence breakdown for an intelligence conclusion */
export interface ConfidenceBreakdown {
  /** Overall confidence score 0-100 */
  overallScore: number;

  /** Trust tier derived from overall score */
  overallTier: TrustTier;

  /** Individual contributing factors */
  factors: ConfidenceFactor[];

  /** Human-readable confidence rationale (1-2 sentences) */
  rationale: string;

  /** When this breakdown was computed (ISO 8601) */
  computedAt: string;
}

// ─── Verification Status ────────────────────────────────────────────

/** Verification status for a piece of intelligence or evidence */
export interface VerificationStatus {
  /** Whether this intelligence has been human-verified */
  isVerified: boolean;

  /** Verified by whom (user name or "AI") */
  verifiedBy: string | null;

  /** When it was verified (ISO 8601) */
  verifiedAt: string | null;

  /** Verification method */
  method: 'human_review' | 'automated_check' | 'cross_reference' | 'not_verified';

  /** Any notes from the verification process */
  notes: string | null;
}

// ─── L3 Evidence Layer Data ────────────────────────────────────────
// Data structure for the L3 Evidence layer in progressive disclosure.

/** Complete data for rendering the L3 Evidence Layer */
export interface EvidenceLayerData {
  /** The evidence chain items to display */
  evidence: EvidenceChainItem[];

  /** Summary footprint for compact display */
  footprint: EvidenceFootprint;

  /** Impact statement connecting evidence to the conclusion */
  impactStatement: string;

  /** Verification status of the overall conclusion */
  verification: VerificationStatus;
}

// ─── L4 Exploration Layer Data ──────────────────────────────────────
// Data structure for the L4 Exploration layer in progressive disclosure.

/** A card in the L4 exploration grid */
export interface ExplorationCard {
  /** Card label (e.g., "Estimated Budget Range") */
  label: string;

  /** Primary value (e.g., "$2.4M — $8.1M") */
  value: string;

  /** Supplementary context (e.g., "Based on company size, sector, and growth rate") */
  context: string;

  /** Trust tier for this data point */
  trustTier: TrustTier;

  /** Source category that produced this data */
  sourceCategory: SourceCategory;
}

/** AI-generated context box for L4 */
export interface AIContextBox {
  /** AI context narrative — explicitly NOT a directive */
  narrative: string;

  /** How many evidence sources contributed */
  sourceCount: number;

  /** How many historical patterns analyzed */
  patternCount: number;

  /** Confidence of the overall analysis */
  confidenceScore: number;
}

/** Investigation paths the user can follow from L4 */
export interface InvestigationPath {
  /** Suggested next investigation action */
  title: string;

  /** Why this investigation is suggested */
  rationale: string;

  /** What type of investigation this represents */
  type:
    | 'company_research'
    | 'contact_discovery'
    | 'competitive_analysis'
    | 'market_research'
    | 'signal_tracking';

  /** Estimated value of this investigation */
  priority: 'high' | 'medium' | 'low';
}

/** Complete data for rendering the L4 Exploration Layer */
export interface ExplorationLayerData {
  /** Grid of exploration data cards */
  explorationCards: ExplorationCard[];

  /** AI context box */
  aiContext: AIContextBox;

  /** Suggested investigation paths */
  investigationPaths: InvestigationPath[];

  /** Related signals from other companies or time periods */
  relatedSignals: Array<{
    title: string;
    type: string;
    companyId?: string;
    date?: string;
    relevance: number;
  }>;
}

// ─── Account Intelligence Types ───────────────────────────────────

/** Intelligence grade for an account (A through F) */
export type IntelligenceGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Account-level trust visualization data */
export interface AccountTrustData {
  /** Overall account trust score 0-100 */
  overallScore: number;

  /** Overall trust tier */
  overallTier: TrustTier;

  /** Intelligence grade */
  grade: IntelligenceGrade;

  /** Confidence breakdown for this account */
  confidenceBreakdown: ConfidenceBreakdown;

  /** Evidence footprint across all intelligence for this account */
  evidenceFootprint: EvidenceFootprint;

  /** Number of active signals */
  activeSignalCount: number;

  /** Number of verified intelligence items */
  verifiedItemCount: number;

  /** Account-level verification status */
  verification: VerificationStatus;
}

/** Tab types for the Account Intelligence screen */
export type AccountIntelligenceTab = 'overview' | 'signals' | 'contacts' | 'recommendations';

/** Signal timeline entry for Account Intelligence */
export interface AccountSignalEntry {
  id: string;

  /** Signal headline */
  headline: string;

  /** Signal type/category */
  signalType: string;

  /** When the signal was detected */
  detectedAt: string;

  /** Freshness label */
  freshnessLabel: string;

  /** Signal impact level */
  impactLevel: 'critical' | 'high' | 'medium' | 'low';

  /** Signal confidence 0-100 */
  confidenceScore: number;

  /** Evidence supporting this signal */
  evidence: EvidenceChainItem[];

  /** Whether this signal has an expandable evidence chain */
  hasEvidenceChain: boolean;
}

// ─── Utility Functions ─────────────────────────────────────────────

/** Derive IntelligenceGrade from a numeric score */
export function scoreToGrade(score: number): IntelligenceGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

/** Format a trust score with tier label (e.g., "78% — High Confidence") */
export function formatTrustScore(score: number, tier: TrustTier): string {
  const labels: Record<TrustTier, string> = {
    verified: 'Verified',
    high: 'High Confidence',
    medium: 'Medium Confidence',
    low: 'Low Confidence',
    unverified: 'Unverified',
  };
  return `${score}% — ${labels[tier]}`;
}

/** Compute freshness level from a timestamp */
export function computeFreshnessLevel(ISODate: string | null): EvidenceFootprint['freshnessLevel'] {
  if (!ISODate) return 'unknown';
  const ageMs = Date.now() - new Date(ISODate).getTime();
  const ageHours = ageMs / 3600000;
  if (ageHours <= 1) return 'realtime';
  if (ageHours <= 48) return 'fresh';
  if (ageHours <= 168) return 'aging'; // 7 days
  return 'stale';
}

/** Build a source category breakdown from evidence items */
export function buildSourceBreakdown(
  items: EvidenceChainItem[],
): EvidenceFootprint['sourceBreakdown'] {
  const breakdown: EvidenceFootprint['sourceBreakdown'] = {};
  for (const item of items) {
    breakdown[item.sourceCategory] = (breakdown[item.sourceCategory] || 0) + 1;
  }
  return breakdown;
}

/** Build an evidence footprint from evidence items */
export function buildEvidenceFootprint(items: EvidenceChainItem[]): EvidenceFootprint {
  if (items.length === 0) {
    return {
      totalSources: 0,
      verifiedCount: 0,
      highConfidenceCount: 0,
      mostRecentAt: null,
      oldestAt: null,
      freshnessLevel: 'unknown',
      sourceBreakdown: {},
      hasAIInference: false,
    };
  }

  const dates = items.map((i) => new Date(i.detectedAt).getTime()).sort((a, b) => b - a);

  return {
    totalSources: items.length,
    verifiedCount: items.filter((i) => i.trustTier === 'verified').length,
    highConfidenceCount:
      items.filter((i) => {
        const s = i.trustScore;
        return s >= 90; // verified threshold
      }).length +
      items.filter((i) => {
        const s = i.trustScore;
        return s >= 70 && s < 90; // high threshold
      }).length,
    mostRecentAt: new Date(dates[0]).toISOString(),
    oldestAt: new Date(dates[dates.length - 1]).toISOString(),
    freshnessLevel: computeFreshnessLevel(new Date(dates[0]).toISOString()),
    sourceBreakdown: buildSourceBreakdown(items),
    hasAIInference: items.some((i) => i.sourceCategory === 'ai_inference'),
  };
}
