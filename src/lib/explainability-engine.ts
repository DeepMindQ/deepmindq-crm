/**
 * WI-17D — Explainability Layer
 *
 * The goal of WI-17D is not more AI.
 * The goal is enterprise trust.
 *
 * Every recommendation must have a visible intelligence trail:
 *
 *   Recommendation
 *       ↓
 *   Reasoning          → Why this score? (score decomposition, weight explanation)
 *       ↓
 *   Evidence            → What data supports this? (signals, opportunities, matches)
 *       ↓
 *   Sources             → Where did the data come from? (source type, reliability, date)
 *       ↓
 *   Confidence Factors  → How reliable is each input? (6 dimensions, per-factor)
 *       ↓
 *   Risk Factors        → What could be wrong? (data gaps, contradictions, staleness)
 *       ↓
 *   Recommended Action   → What should the user do? (action + timeline + conversation angle)
 *
 * Architecture Principle: DO NOT build new intelligence.
 * This layer EXPOSES and STRUCTURES the intelligence that already exists
 * inside the recommendation engine, confidence engine, and evidence framework.
 *
 * Integration:
 *   - Consumes AccountRecommendation from WI-17C
 *   - Consumes ConfidenceResult from WI-16C (Unified Confidence)
 *   - Consumes AIEvidenceOutput from Evidence Framework
 *   - Reads raw DB records for source provenance
 *   - Produces ExplainabilityReport — the full intelligence trail
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeUnifiedConfidence, type ConfidenceResult } from '@/lib/ai-unified-confidence';
import { generateCompanyRecommendation, type AccountRecommendation } from '@/lib/recommendation-engine';
import { EVIDENCE_QUALITY_SCORES, type EvidenceQuality } from '@/lib/ai-evidence-framework';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * The complete explainability report for a single recommendation.
 * This is what enterprise users see when they ask "Why should I trust this?"
 */
export interface ExplainabilityReport {
  /** The company this report explains */
  companyId: string;
  companyName: string;

  // ── Recommendation Summary ──
  /** The recommendation being explained */
  recommendation: {
    priority: AccountRecommendation['priority'];
    opportunityScore: number;
    confidenceGrade: string;
    confidenceScore: number;
    enterpriseReady: boolean;
    dataDepthIndicator: AccountRecommendation['dataDepthIndicator'];
  };

  // ── 1. Reasoning ──
  /** Full score decomposition — why this score? */
  reasoning: ReasoningSection;

  // ── 2. Evidence ──
  /** All evidence items that support this recommendation */
  evidence: EvidenceSection;

  // ── 3. Sources ──
  /** Where did the data come from? */
  sources: SourcesSection;

  // ── 4. Confidence Factors ──
  /** How reliable is each input? */
  confidence: ConfidenceSection;

  // ── 5. Risk Factors ──
  /** What could be wrong? */
  risks: RiskSection;

  // ── 6. Recommended Action ──
  /** What should the user do? */
  action: ActionSection;

  // ── Explanation Quality (Phase 3.3) ──
  /** Quality scoring of the explanation itself */
  explanationQuality: {
    score: number;
    grade: 'excellent' | 'good' | 'adequate' | 'poor';
    issues: string[];
  };

  // ── Natural Language Summary (Phase 3.5) ──
  /** Plain English summary of the full report */
  naturalLanguageSummary: string;

  // ── Metadata ──
  /** When this report was generated */
  generatedAt: string;
  /** How long the report took to generate */
  latencyMs: number;
}

// ── Section 1: Reasoning ──

export interface ReasoningSection {
  /** Human-readable summary of why this score was assigned */
  summary: string;
  /** The weighted score decomposition */
  scoreDecomposition: ScoreFactor[];
  /** How the score maps to priority */
  priorityMapping: {
    score: number;
    threshold: string;
    range: string;
  };
  /** The "Why this account?" narrative */
  whyThisAccount: string;
}

export interface ScoreFactor {
  /** Factor name (e.g. "Account Score (ICP Fit)") */
  name: string;
  /** Raw value (0-100) */
  rawValue: number;
  /** Weight in composite (0-1) */
  weight: number;
  /** Contribution to final score */
  contribution: number;
  /** Source of this factor */
  source: string;
  /** How this factor was determined */
  method: string;
}

// ── Section 2: Evidence ──

export interface EvidenceSection {
  /** Total evidence items across all categories */
  totalCount: number;
  /** Evidence by category */
  categories: EvidenceCategory[];
  /** Evidence quality assessment */
  qualityAssessment: {
    overallQuality: EvidenceQuality;
    verifiedCount: number;
    corroboratedCount: number;
    inferredCount: number;
    estimatedCount: number;
    speculativeCount: number;
  };
}

export interface EvidenceCategory {
  /** Category name (e.g. "Buying Signals", "Technology Fit") */
  category: string;
  /** Number of items in this category */
  count: number;
  /** Top evidence items */
  items: EvidenceItem[];
  /** How strong this category is for the recommendation */
  strength: 'strong' | 'moderate' | 'weak';
}

export interface EvidenceItem {
  /** What was detected */
  detected: string;
  /** Specific evidence detail */
  detail: string;
  /** When it was detected */
  detectedAt: string | null;
  /** How long ago (human-readable) */
  recency: string | null;
  /** Confidence in this specific evidence (0-100) */
  confidence: number;
  /** Quality level */
  quality: EvidenceQuality;
  /** Source ID for drill-down */
  sourceId: string;
  /** Source type for drill-down */
  sourceType: string;
  /** Is this a positive or negative signal? */
  sentiment: 'positive' | 'negative' | 'neutral';
}

// ── Section 3: Sources ──

export interface SourcesSection {
  /** All unique data sources used in this recommendation */
  items: SourceItem[];
  /** Reliability assessment of the overall source mix */
  overallReliability: number;
  /** How diverse the source base is */
  diversityScore: number;
}

export interface SourceItem {
  /** Source name/type */
  name: string;
  /** Source type (manual_entry, data_import, ai_analysis, signal_detection, etc.) */
  type: string;
  /** Reliability score (0-1) */
  reliability: number;
  /** Number of data points from this source */
  dataPoints: number;
  /** When data was last received from this source */
  lastActivity: string | null;
  /** Human-readable reliability explanation */
  reliabilityExplanation: string;
}

// ── Section 4: Confidence ──

export interface ConfidenceSection {
  /** Overall confidence */
  overall: {
    score: number;
    grade: string;
    trustClassification: string;
    enterpriseReady: boolean;
  };
  /** Per-dimension breakdown */
  dimensions: ConfidenceDimensionDetail[];
  /** What would improve confidence */
  improvementOpportunities: string[];
  /** What reduces confidence */
  detractors: string[];
}

export interface ConfidenceDimensionDetail {
  /** Dimension name */
  dimension: string;
  /** Score 0-100 */
  score: number;
  /** Weight in composite */
  weight: number;
  /** Human-readable explanation */
  explanation: string;
  /** What's helping this dimension */
  positiveSignals: string[];
  /** What's hurting this dimension */
  negativeSignals: string[];
}

// ── Section 5: Risks ──

export interface RiskSection {
  /** Total identified risks */
  totalRisks: number;
  /** Risk by severity */
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Detailed risk items */
  items: RiskDetail[];
  /** Overall risk assessment */
  overallAssessment: 'low_risk' | 'moderate_risk' | 'elevated_risk' | 'high_risk';
}

export interface RiskDetail {
  /** Risk description */
  description: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Category of the risk */
  category: 'data_gap' | 'staleness' | 'contradiction' | 'competition' | 'confidence' | 'coverage';
  /** Suggested mitigation */
  mitigation: string;
  /** Source ID if applicable */
  sourceId?: string;
  /** How this risk affects the recommendation */
  impact: string;
}

// ── Section 6: Action ──

export interface ActionSection {
  /** The recommended action */
  text: string;
  /** Suggested timeline */
  timeline: string;
  /** Who to engage */
  targetRole?: string;
  /** Phase 1: Dynamic target roles */
  targetRoles?: string[];
  /** Conversation angle / approach */
  conversationAngle?: string;
  /** Why this action is recommended */
  rationale: string;
  /** Alternative actions if the primary is not feasible */
  alternatives: string[];
  /** Prerequisites before taking action */
  prerequisites: string[];
}

// ── Explainability Summary (for list view) ──

export interface ExplainabilitySummary {
  companyId: string;
  companyName: string;
  /** Top 3 evidence items */
  topEvidence: Array<{ detected: string; confidence: number }>;
  /** Total risk count by severity */
  riskSummary: { critical: number; high: number; medium: number; low: number };
  /** Overall data quality */
  dataQuality: EvidenceQuality;
  /** Source diversity score */
  sourceDiversity: number;
  /** Top improvement opportunity */
  topImprovement: string;
}

// ── Core Engine ────────────────────────────────────────────────────────────

/**
 * Generate the full explainability report for a single company recommendation.
 * This is the main entry point for the explainability layer.
 */
export async function generateExplainabilityReport(
  companyId: string
): Promise<ExplainabilityReport | null> {
  const startTime = Date.now();

  // ── Step 1: Generate the base recommendation ──
  const recommendation = await generateCompanyRecommendation(companyId);
  if (!recommendation) return null;

  // ── Step 2: Fetch raw data for source provenance ──
  const rawData = await fetchRawIntelligenceData(companyId);

  // ── Step 3: Build each section ──
  const reasoning = buildReasoningSection(recommendation, rawData);
  const evidence = buildEvidenceSection(recommendation, rawData);
  const sources = buildSourcesSection(recommendation, rawData);
  const confidence = await buildConfidenceSection(companyId, recommendation, rawData);
  const risks = buildRiskSection(recommendation, rawData, confidence);
  const action = buildActionSection(recommendation, rawData, risks);

  // ── Phase 3.3: Score explanation quality ──
  const partialReport = {
    companyId,
    companyName: recommendation.companyName,
    recommendation: {
      priority: recommendation.priority,
      opportunityScore: recommendation.opportunityScore,
      confidenceGrade: recommendation.confidenceGrade,
      confidenceScore: recommendation.confidenceScore,
      enterpriseReady: recommendation.enterpriseReady,
      dataDepthIndicator: recommendation.dataDepthIndicator,
    },
    reasoning,
    evidence,
    sources,
    confidence,
    risks,
    action,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  } as ExplainabilityReport;

  // ── Phase 3.3: Explanation Quality Scoring ──
  const explanationQuality = scoreExplanationQuality(partialReport);
  partialReport.explanationQuality = explanationQuality;

  // ── Phase 3.5: Natural Language Summary ──
  partialReport.naturalLanguageSummary = generateNaturalLanguageSummary(partialReport);

  return partialReport;
}

// ── Raw Data Fetcher ──

interface RawIntelligenceData {
  company: {
    id: string;
    rawName: string;
    domain: string | null;
    industry: string | null;
    sizeRange: string | null;
    location: string | null;
    country: string | null;
    source: string | null;
    lastEnrichedAt: Date | null;
    status: string | null;
    intelligenceScore: number | null;
  };
  signals: Array<{
    id: string;
    signalType: string;
    title: string;
    severity: string;
    confidence: number;
    impact: string;
    signalDate: Date | null;
    evidenceSummary: string | null;
    recommendedAction: string | null;
    timingWindow: string | null;
  }>;
  opportunities: Array<{
    id: string;
    opportunityTitle: string;
    opportunityScore: number;
    priority: string;
    whyNow: string;
    businessProblem: string;
    recommendedCapability: string;
    confidenceScore: number;
  }>;
  capabilityMatches: Array<{
    id: string;
    matchScore: number;
    capability: { title: string; category: string | null } | null;
  }>;
  evidence: Array<{
    id: string;
    sourceName: string | null;
    sourceTitle: string | null;
    sourceUrl: string;
    snippet: string;
    relevanceScore: number;
    confidence: number;
    sourceDate: Date | null;
    createdAt: Date;
  }>;
  contacts: Array<{
    id: string;
    rawName: string;
    role: string | null;
    title: string | null;
    emailHealthScore: number;
  }>;
  insights: Array<{
    id: string;
    insightType: string;
    summary: string;
    confidenceScore: number;
  }>;
  accountScore: {
    score: number;
    scoreBreakdown: any;
    category: string;
  } | null;
}

async function fetchRawIntelligenceData(companyId: string): Promise<RawIntelligenceData> {
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        location: true,
        country: true,
        source: true,
        lastEnrichedAt: true,
        status: true,
        intelligenceScore: true,
      },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const [signals, opportunities, capabilityMatches, evidence, contacts, insights, accountScore] = await Promise.all([
      db.companySignal.findMany({
        where: { companyId },
        orderBy: { signalDate: 'desc' },
        take: 20,
      }),
      db.opportunityRecommendation.findMany({
        where: { companyId },
        orderBy: { opportunityScore: 'desc' },
        take: 10,
      }),
      db.signalCapabilityMatch.findMany({
        where: { companyId },
        include: { capability: { select: { title: true, category: true } } },
        orderBy: { matchScore: 'desc' },
        take: 10,
      }),
      db.evidence.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.contact.findMany({
        where: { companyId },
        select: { id: true, rawName: true, role: true, title: true, emailHealthScore: true },
        take: 15,
      }),
      db.strategicInsight.findMany({
        where: { companyId },
        orderBy: { confidenceScore: 'desc' },
        take: 5,
      }),
      db.accountScore.findFirst({ where: { companyId } }),
    ]);

    return {
      company: company as RawIntelligenceData['company'],
      signals: signals as any,
      opportunities: opportunities as any,
      capabilityMatches: capabilityMatches as any,
      evidence: evidence as any,
      contacts: contacts as any,
      insights: insights as any,
      accountScore: accountScore as any,
    };
  } catch (error) {
    logger.error('[ExplainabilityEngine] Failed to fetch raw data:', { error, companyId });
    return {
      company: {
        id: companyId,
        rawName: 'Unknown',
        domain: null,
        industry: null,
        sizeRange: null,
        location: null,
        country: null,
        source: null,
        lastEnrichedAt: null,
        status: null,
        intelligenceScore: null,
      },
      signals: [],
      opportunities: [],
      capabilityMatches: [],
      evidence: [],
      contacts: [],
      insights: [],
      accountScore: null,
    };
  }
}

// ── Section 1 Builder: Reasoning ──

function buildReasoningSection(
  rec: AccountRecommendation,
  data: RawIntelligenceData
): ReasoningSection {
  const scoreDecomposition: ScoreFactor[] = [];

  // Account Score factor
  const accountScoreVal = data.accountScore?.score ?? data.company.intelligenceScore ?? 0;
  scoreDecomposition.push({
    name: 'Account Score (ICP Fit)',
    rawValue: accountScoreVal,
    weight: 0.30,
    contribution: Math.round(accountScoreVal * 0.30),
    source: 'AccountScore',
    method: 'Pre-computed ICP fit score from account scoring engine',
  });

  // Opportunity Score factor
  const bestOppScore = data.opportunities.length > 0 ? data.opportunities[0].opportunityScore : 0;
  scoreDecomposition.push({
    name: 'Best Opportunity Score',
    rawValue: bestOppScore,
    weight: 0.30,
    contribution: Math.round(bestOppScore * 0.30),
    source: 'OpportunityRecommendation',
    method: 'Highest-scoring opportunity from signal-based opportunity engine',
  });

  // Signal Strength factor
  const highSignals = data.signals.filter(s => ['critical', 'high'].includes(s.severity));
  const signalStrength = highSignals.length > 0
    ? Math.max(...highSignals.slice(0, 3).map(s => (s.confidence || 0.5) * 100))
    : 0;
  scoreDecomposition.push({
    name: 'Signal Strength',
    rawValue: signalStrength,
    weight: 0.15,
    contribution: Math.round(signalStrength * 0.15),
    source: 'CompanySignal',
    method: `Max confidence of top 3 high-severity signals (${highSignals.length} high-severity signals detected)`,
  });

  // Capability Match factor
  const bestCapScore = data.capabilityMatches.length > 0
    ? data.capabilityMatches[0].matchScore * 100
    : 0;
  scoreDecomposition.push({
    name: 'Capability Match',
    rawValue: Math.round(bestCapScore),
    weight: 0.10,
    contribution: Math.round(bestCapScore * 0.10),
    source: 'SignalCapabilityMatch',
    method: data.capabilityMatches.length > 0
      ? `Best fit: ${data.capabilityMatches[0].capability?.title || 'Unknown'} (${data.capabilityMatches.length} total matches)`
      : 'No capability matches detected',
  });

  // Engagement Readiness factor
  const engagementReadiness = Math.min(100,
    data.contacts.length * 20 +
    (data.company.lastEnrichedAt ? 30 : 0) +
    (data.evidence.length > 0 ? 20 : 0)
  );
  scoreDecomposition.push({
    name: 'Engagement Readiness',
    rawValue: engagementReadiness,
    weight: 0.15,
    contribution: Math.round(engagementReadiness * 0.15),
    source: 'Composite',
    method: `Contacts: ${data.contacts.length} (×20), Enriched: ${data.company.lastEnrichedAt ? 'yes (+30)' : 'no (+0)'}, Evidence: ${data.evidence.length} (${data.evidence.length > 0 ? '+20' : '+0'})`,
  });

  // Priority mapping
  const priorityThresholds: Record<string, { min: number; max: number; label: string }> = {
    critical: { min: 80, max: 100, label: '80-100' },
    high: { min: 60, max: 79, label: '60-79' },
    medium: { min: 35, max: 59, label: '35-59' },
    low: { min: 0, max: 34, label: '0-34' },
  };
  const threshold = priorityThresholds[rec.priority] || priorityThresholds.low;

  // Summary
  const topFactors = [...scoreDecomposition].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  const summary = `Score of ${rec.opportunityScore}/100 driven primarily by ${topFactors.map(f => `${f.name} (+${f.contribution})`).join(', ')}. ${rec.enterpriseReady ? 'Meets enterprise confidence threshold (≥70).' : 'Below enterprise confidence threshold — recommend enrichment before action.'}`;

  return {
    summary,
    scoreDecomposition,
    priorityMapping: {
      score: rec.opportunityScore,
      threshold: `${rec.priority.toUpperCase()}: ${threshold.label}`,
      range: `Critical: 80-100 | High: 60-79 | Medium: 35-59 | Low: 0-34`,
    },
    whyThisAccount: rec.whyThisAccount,
  };
}

// ── Section 2 Builder: Evidence ──

function buildEvidenceSection(
  rec: AccountRecommendation,
  data: RawIntelligenceData
): EvidenceSection {
  const categories: EvidenceCategory[] = [];
  let totalItems = 0;

  // Category: Buying Signals
  const signalItems: EvidenceItem[] = data.signals.slice(0, 10).map(s => ({
    detected: s.title,
    detail: s.evidenceSummary || `Signal type: ${s.signalType}, Severity: ${s.severity}`,
    detectedAt: s.signalDate?.toISOString() || null,
    recency: s.signalDate ? formatRecency(s.signalDate) : null,
    confidence: Math.round((s.confidence || 0.5) * 100),
    quality: (s.confidence || 0.5) >= 0.8 ? 'verified' : (s.confidence || 0.5) >= 0.6 ? 'corroborated' : (s.confidence || 0.5) >= 0.4 ? 'inferred' : 'estimated',
    sourceId: s.id,
    sourceType: 'CompanySignal',
    sentiment: ['risk', 'competitive'].includes(s.signalType) ? 'negative' : ['opportunity', 'growth_signal', 'intent_signal'].includes(s.signalType) ? 'positive' : 'neutral',
  }));
  if (signalItems.length > 0) {
    categories.push({
      category: 'Buying Signals',
      count: signalItems.length,
      items: signalItems.slice(0, 5),
      strength: signalItems.filter(s => s.confidence >= 70).length >= 3 ? 'strong' : signalItems.filter(s => s.confidence >= 50).length >= 2 ? 'moderate' : 'weak',
    });
    totalItems += signalItems.length;
  }

  // Category: Technology Fit
  const techItems: EvidenceItem[] = data.capabilityMatches.slice(0, 5).map(cm => ({
    detected: cm.capability?.title || 'Unknown Capability',
    detail: `Match score: ${Math.round(cm.matchScore * 100)}% — Category: ${cm.capability?.category || 'Unknown'}`,
    detectedAt: null,
    recency: null,
    confidence: Math.round(cm.matchScore * 100),
    quality: cm.matchScore >= 0.8 ? 'verified' : cm.matchScore >= 0.6 ? 'corroborated' : 'inferred',
    sourceId: cm.id,
    sourceType: 'SignalCapabilityMatch',
    sentiment: 'positive',
  }));
  if (techItems.length > 0) {
    categories.push({
      category: 'Technology Fit',
      count: techItems.length,
      items: techItems.slice(0, 5),
      strength: techItems.filter(t => t.confidence >= 70).length >= 2 ? 'strong' : techItems.some(t => t.confidence >= 50) ? 'moderate' : 'weak',
    });
    totalItems += techItems.length;
  }

  // Category: Opportunities
  const oppItems: EvidenceItem[] = data.opportunities.slice(0, 5).map(o => ({
    detected: o.opportunityTitle,
    detail: `Score: ${o.opportunityScore}/100 — ${o.whyNow || o.businessProblem || 'Signal-derived opportunity'}`,
    detectedAt: null,
    recency: null,
    confidence: o.confidenceScore || 50,
    quality: o.confidenceScore >= 80 ? 'verified' : o.confidenceScore >= 60 ? 'corroborated' : o.confidenceScore >= 40 ? 'inferred' : 'estimated',
    sourceId: o.id,
    sourceType: 'OpportunityRecommendation',
    sentiment: 'positive',
  }));
  if (oppItems.length > 0) {
    categories.push({
      category: 'Opportunities',
      count: oppItems.length,
      items: oppItems.slice(0, 5),
      strength: oppItems.filter(o => o.confidence >= 70).length >= 2 ? 'strong' : oppItems.some(o => o.confidence >= 50) ? 'moderate' : 'weak',
    });
    totalItems += oppItems.length;
  }

  // Category: Strategic Insights
  const insightItems: EvidenceItem[] = data.insights.filter(
    i => i.insightType === 'OPPORTUNITY' || i.insightType === 'STRATEGIC_SHIFT'
  ).map(i => ({
    detected: i.summary,
    detail: `Insight type: ${i.insightType}`,
    detectedAt: null,
    recency: null,
    confidence: i.confidenceScore || 50,
    quality: i.confidenceScore >= 80 ? 'verified' : i.confidenceScore >= 60 ? 'corroborated' : 'inferred',
    sourceId: i.id,
    sourceType: 'StrategicInsight',
    sentiment: i.insightType === 'OPPORTUNITY' ? 'positive' : 'neutral',
  }));
  if (insightItems.length > 0) {
    categories.push({
      category: 'Strategic Insights',
      count: insightItems.length,
      items: insightItems.slice(0, 5),
      strength: insightItems.some(i => i.confidence >= 70) ? 'strong' : insightItems.some(i => i.confidence >= 50) ? 'moderate' : 'weak',
    });
    totalItems += insightItems.length;
  }

  // Category: Corroborating Evidence
  const evidenceItems: EvidenceItem[] = data.evidence.slice(0, 10).map(e => ({
    detected: e.snippet || e.sourceTitle || 'Evidence record',
    detail: `Source: ${e.sourceName || e.sourceUrl} — Confidence: ${Math.round(e.confidence * 100)}%`,
    detectedAt: e.sourceDate?.toISOString() || e.createdAt?.toISOString() || null,
    recency: e.sourceDate ? formatRecency(e.sourceDate) : e.createdAt ? formatRecency(e.createdAt) : null,
    confidence: Math.round(e.confidence * 100),
    quality: e.confidence >= 0.8 ? 'verified' : e.confidence >= 0.6 ? 'corroborated' : e.confidence >= 0.4 ? 'inferred' : 'estimated',
    sourceId: e.id,
    sourceType: 'Evidence',
    sentiment: 'neutral',
  }));
  if (evidenceItems.length > 0) {
    categories.push({
      category: 'Corroborating Evidence',
      count: evidenceItems.length,
      items: evidenceItems.slice(0, 5),
      strength: evidenceItems.filter(e => e.confidence >= 70).length >= 3 ? 'strong' : evidenceItems.some(e => e.confidence >= 50) ? 'moderate' : 'weak',
    });
    totalItems += evidenceItems.length;
  }

  // Quality assessment
  const allItems = [...signalItems, ...techItems, ...oppItems, ...insightItems, ...evidenceItems];
  const qualityCounts = {
    verified: allItems.filter(i => i.quality === 'verified').length,
    corroborated: allItems.filter(i => i.quality === 'corroborated').length,
    inferred: allItems.filter(i => i.quality === 'inferred').length,
    estimated: allItems.filter(i => i.quality === 'estimated').length,
    speculative: allItems.filter(i => i.quality === 'speculative').length,
  };
  const overallQuality = determineOverallQuality(qualityCounts);

  return {
    totalCount: totalItems,
    categories,
    qualityAssessment: {
      overallQuality,
      verifiedCount: qualityCounts.verified,
      corroboratedCount: qualityCounts.corroborated,
      inferredCount: qualityCounts.inferred,
      estimatedCount: qualityCounts.estimated,
      speculativeCount: qualityCounts.speculative,
    },
  };
}

function determineOverallQuality(counts: { verified: number; corroborated: number; inferred: number; estimated: number; speculative: number }): EvidenceQuality {
  const total = counts.verified + counts.corroborated + counts.inferred + counts.estimated + counts.speculative;
  if (total === 0) return 'speculative';
  if (counts.verified >= 3) return 'verified';
  if (counts.verified + counts.corroborated >= 3) return 'corroborated';
  if (counts.inferred >= 2) return 'inferred';
  if (counts.estimated >= counts.verified + counts.corroborated) return 'estimated';
  return 'inferred';
}

// ── Section 3 Builder: Sources ──

function buildSourcesSection(
  rec: AccountRecommendation,
  data: RawIntelligenceData
): SourcesSection {
  const sourceMap = new Map<string, SourceItem>();

  // Company source
  const companyReliability = data.company.source === 'manual' ? 0.95 : 0.75;
  sourceMap.set('company_data', {
    name: 'Company Base Data',
    type: data.company.source || 'unknown',
    reliability: companyReliability,
    dataPoints: 1,
    lastActivity: data.company.lastEnrichedAt?.toISOString() || null,
    reliabilityExplanation: data.company.source === 'manual'
      ? 'Manually entered — highest reliability (95%)'
      : 'Imported from external source — moderate reliability (75%)',
  });

  // Signal source
  if (data.signals.length > 0) {
    sourceMap.set('signals', {
      name: 'Signal Detection',
      type: 'ai_analysis',
      reliability: 0.80,
      dataPoints: data.signals.length,
      lastActivity: data.signals[0]?.signalDate?.toISOString() || null,
      reliabilityExplanation: 'AI-detected buying signals — confidence varies per signal (shown in evidence section)',
    });
  }

  // Opportunity source
  if (data.opportunities.length > 0) {
    sourceMap.set('opportunities', {
      name: 'Opportunity Engine',
      type: 'ai_analysis',
      reliability: 0.75,
      dataPoints: data.opportunities.length,
      lastActivity: null,
      reliabilityExplanation: 'Signal-derived opportunity scores — based on pattern matching and AI reasoning',
    });
  }

  // Capability match source
  if (data.capabilityMatches.length > 0) {
    sourceMap.set('capabilities', {
      name: 'Capability Matching',
      type: 'ai_analysis',
      reliability: 0.70,
      dataPoints: data.capabilityMatches.length,
      lastActivity: null,
      reliabilityExplanation: 'Technology stack analysis — inferred from company data and signal patterns',
    });
  }

  // Evidence source
  if (data.evidence.length > 0) {
    const avgEvidenceReliability = data.evidence.reduce((s, e) => s + (e.confidence || 0.5), 0) / data.evidence.length;
    sourceMap.set('evidence', {
      name: 'Evidence Records',
      type: 'research',
      reliability: Math.round(avgEvidenceReliability * 100) / 100,
      dataPoints: data.evidence.length,
      lastActivity: data.evidence[0]?.createdAt?.toISOString() || null,
      reliabilityExplanation: `Corroborating evidence from research — average reliability ${Math.round(avgEvidenceReliability * 100)}%`,
    });
  }

  // Insight source
  if (data.insights.length > 0) {
    sourceMap.set('insights', {
      name: 'Strategic Insights',
      type: 'ai_reasoning',
      reliability: 0.70,
      dataPoints: data.insights.length,
      lastActivity: null,
      reliabilityExplanation: 'AI-generated strategic analysis — moderate reliability, best used as directional guidance',
    });
  }

  const items = Array.from(sourceMap.values());
  const totalDataPoints = items.reduce((s, i) => s + i.dataPoints, 0);
  const overallReliability = items.length > 0
    ? items.reduce((s, i) => s + (i.reliability * i.dataPoints), 0) / totalDataPoints
    : 0;

  // Diversity: how many different source types
  const uniqueTypes = new Set(items.map(i => i.type));
  const diversityScore = Math.min(1.0, uniqueTypes.size / 5);

  return {
    items,
    overallReliability: Math.round(overallReliability * 100) / 100,
    diversityScore: Math.round(diversityScore * 100) / 100,
  };
}

// ── Section 4 Builder: Confidence ──

async function buildConfidenceSection(
  companyId: string,
  rec: AccountRecommendation,
  data: RawIntelligenceData
): Promise<ConfidenceSection> {
  let confidenceResult: ConfidenceResult | null = null;

  try {
    const daysSinceEnrichment = data.company.lastEnrichedAt
      ? Math.floor((Date.now() - data.company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    confidenceResult = computeUnifiedConfidence({
      entityId: companyId,
      entityType: 'company',
      fieldConfidence: {
        name: 1.0,
        domain: data.company.domain ? 0.9 : 0.2,
        industry: data.company.industry ? 0.8 : 0.1,
        size: data.company.sizeRange ? 0.7 : 0.1,
        location: data.company.location ? 0.8 : 0.1,
        contacts: Math.min(1.0, data.contacts.length / 5),
      },
      dataCompleteness: [
        data.company.rawName ? 1 : 0,
        data.company.domain ? 1 : 0,
        data.company.industry ? 1 : 0,
        data.company.location ? 1 : 0,
        data.contacts.length > 0 ? 1 : 0,
        data.company.lastEnrichedAt ? 1 : 0,
        data.signals.length > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0) / 7,
      sources: data.company.source === 'manual'
        ? [{ name: 'manual_entry', reliability: 0.95, type: 'internal' }]
        : [{ name: 'data_import', reliability: 0.75, type: 'csv_import' }],
      averageSourceReliability: data.company.source === 'manual' ? 0.95 : 0.75,
      daysSinceResearch: daysSinceEnrichment,
      freshnessScore: data.company.lastEnrichedAt ? Math.max(0, 100 - daysSinceEnrichment * 2) : 0,
      crossValidatedFacts: data.evidence.length,
      totalFacts: data.signals.length + data.evidence.length,
      contradictions: 0,
      evidenceCount: data.evidence.length,
      evidenceCoverage: data.signals.length > 0
        ? Math.min(1.0, data.evidence.length / 5)
        : 0,
      coveredDimensions: [
        data.company.rawName ? 1 : 0,
        data.company.domain ? 1 : 0,
        data.company.industry ? 1 : 0,
        data.company.sizeRange ? 1 : 0,
        data.company.location ? 1 : 0,
        data.contacts.length > 0 ? 1 : 0,
        data.signals.length > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      expectedDimensions: 7,
      evidenceGaps: [
        !data.company.domain ? 1 : 0,
        !data.company.industry ? 1 : 0,
        data.signals.length === 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      aiOutputConfidence: data.signals.length > 0 ? 0.8 : 0.5,
      hallucinationRiskScore: data.signals.length > 0 ? 15 : 40,
      qualityGateScore: data.signals.length > 0 ? 85 : 50,
    });
  } catch (err) {
    logger.warn('[ExplainabilityEngine] Confidence computation failed:', { err });
  }

  // Build dimensions
  const dimensions: ConfidenceDimensionDetail[] = confidenceResult?.factors.map(f => ({
    dimension: formatDimensionName(f.dimension),
    score: f.score,
    weight: f.weight,
    explanation: f.explanation,
    positiveSignals: f.positiveSignals || [],
    negativeSignals: f.negativeSignals || [],
  })) || [];

  // Improvement opportunities
  const improvements: string[] = [];
  if (!data.company.domain) improvements.push('Add company domain for better data enrichment and technology detection');
  if (!data.company.industry) improvements.push('Add industry classification for ICP fit scoring');
  if (data.contacts.length === 0) improvements.push('Add contacts to enable outreach and improve engagement readiness');
  if (data.signals.length === 0) improvements.push('Run intelligence enrichment to detect buying signals');
  if (data.evidence.length < 3) improvements.push('Gather corroborating evidence to improve evidence coverage');
  if (data.company.lastEnrichedAt) {
    const days = Math.floor((Date.now() - data.company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 30) improvements.push(`Refresh intelligence — data is ${days} days old`);
  }
  if (data.capabilityMatches.length === 0) improvements.push('Add capability documents to enable capability matching');
  if (!data.company.sizeRange) improvements.push('Add company size for better account scoring');

  // Detractors
  const detractors: string[] = [];
  if (confidenceResult) {
    for (const factor of confidenceResult.factors) {
      if (factor.score < 50) {
        detractors.push(`${formatDimensionName(factor.dimension)} is low (${factor.score}/100): ${factor.explanation}`);
      }
    }
  }
  if (data.signals.filter(s => s.confidence < 0.5).length > 0) {
    detractors.push(`${data.signals.filter(s => s.confidence < 0.5).length} signals have low confidence (<50%)`);
  }

  return {
    overall: {
      score: confidenceResult?.score ?? rec.confidenceScore,
      grade: confidenceResult?.grade ?? rec.confidenceGrade,
      trustClassification: confidenceResult?.trustClass ?? 'speculative',
      enterpriseReady: confidenceResult?.enterpriseReady ?? rec.enterpriseReady,
    },
    dimensions,
    improvementOpportunities: improvements.slice(0, 5),
    detractors: detractors.slice(0, 5),
  };
}

// ── Section 5 Builder: Risks ──

function buildRiskSection(
  rec: AccountRecommendation,
  data: RawIntelligenceData,
  confidence: ConfidenceSection
): RiskSection {
  const items: RiskDetail[] = [];

  // Data gap risks
  if (!data.company.domain) {
    items.push({
      description: 'No company domain — limits technology detection and enrichment capability',
      severity: 'medium',
      category: 'data_gap',
      mitigation: 'Add company domain to enable automated technology stack analysis',
      impact: 'Reduces signal detection accuracy and capability matching potential',
    });
  }

  if (!data.company.industry) {
    items.push({
      description: 'No industry classification — ICP fit scoring is imprecise',
      severity: 'medium',
      category: 'data_gap',
      mitigation: 'Classify industry for accurate account scoring and segmentation',
      impact: 'Account score may not reflect true ICP alignment',
    });
  }

  if (data.contacts.length === 0) {
    items.push({
      description: 'No contacts identified — no clear path to decision makers',
      severity: 'high',
      category: 'coverage',
      mitigation: 'Enrich contacts via research or manual entry before outreach',
      impact: 'Recommended actions cannot be executed without contact targets',
    });
  }

  // Staleness risks
  if (!data.company.lastEnrichedAt) {
    items.push({
      description: 'Company has never been enriched — all intelligence may be incomplete or outdated',
      severity: 'high',
      category: 'staleness',
      mitigation: 'Run full intelligence enrichment to establish baseline intelligence',
      impact: 'Recommendation is based on minimal data — scores may change significantly after enrichment',
    });
  } else {
    const daysSince = Math.floor((Date.now() - data.company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 60) {
      items.push({
        description: `Data is ${daysSince} days old — signals and opportunities may have changed`,
        severity: daysSince > 90 ? 'high' : 'medium',
        category: 'staleness',
        mitigation: 'Re-run intelligence enrichment to refresh signals and verify current state',
        impact: 'Buying signals may have expired; new opportunities may exist that are not detected',
      });
    }
  }

  // Confidence risks
  if (confidence.overall.score < 50) {
    items.push({
      description: `Overall confidence is low (${confidence.overall.score}/100) — recommendation may not be reliable`,
      severity: 'high',
      category: 'confidence',
      mitigation: 'Improve data quality and coverage before acting on this recommendation',
      impact: 'Enterprise trust threshold not met — acting on low-confidence recommendations risks credibility',
    });
  }

  if (!confidence.overall.enterpriseReady) {
    items.push({
      description: 'Below enterprise confidence threshold (<70) — not recommended for direct outreach',
      severity: 'medium',
      category: 'confidence',
      mitigation: 'Focus on improvement opportunities listed in the confidence section first',
      impact: 'Recommendation should be used for monitoring, not immediate action',
    });
  }

  // Evidence risks
  if (data.signals.length > 0 && data.evidence.length === 0) {
    items.push({
      description: `${data.signals.length} signals detected but no corroborating evidence`,
      severity: 'medium',
      category: 'data_gap',
      mitigation: 'Verify signal accuracy through additional research and evidence collection',
      impact: 'Signals may be false positives without corroboration',
    });
  }

  // Competition risks
  const competitionSignals = data.signals.filter(s =>
    s.signalType === 'competitive' || s.title.toLowerCase().includes('compet') ||
    s.title.toLowerCase().includes('vendor') || s.title.toLowerCase().includes('incumbent')
  );
  for (const compSig of competitionSignals.slice(0, 2)) {
    items.push({
      description: compSig.title,
      severity: compSig.severity === 'critical' ? 'critical' : 'high',
      category: 'competition',
      mitigation: 'Research competitive landscape to position against existing vendor relationship',
      impact: 'Existing vendor relationship may reduce conversion probability',
      sourceId: compSig.id,
    });
  }

  // Low-confidence signals
  const lowConfSignals = data.signals.filter(s => (s.confidence || 0.5) < 0.5);
  if (lowConfSignals.length > 0) {
    items.push({
      description: `${lowConfSignals.length} signal${lowConfSignals.length > 1 ? 's' : ''} with low confidence (<50%) — verification recommended`,
      severity: 'low',
      category: 'confidence',
      mitigation: 'Cross-reference low-confidence signals with external sources before including in outreach strategy',
      impact: 'Low-confidence signals may inflate the recommendation score',
    });
  }

  // Severity breakdown
  const severityBreakdown = {
    critical: items.filter(r => r.severity === 'critical').length,
    high: items.filter(r => r.severity === 'high').length,
    medium: items.filter(r => r.severity === 'medium').length,
    low: items.filter(r => r.severity === 'low').length,
  };

  // Overall assessment
  let overallAssessment: RiskSection['overallAssessment'];
  if (severityBreakdown.critical > 0) overallAssessment = 'high_risk';
  else if (severityBreakdown.high >= 2) overallAssessment = 'elevated_risk';
  else if (severityBreakdown.high >= 1 || severityBreakdown.medium >= 3) overallAssessment = 'moderate_risk';
  else overallAssessment = 'low_risk';

  return {
    totalRisks: items.length,
    severityBreakdown,
    items: items.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    overallAssessment,
  };
}

// ── Section 6 Builder: Action ──

function buildActionSection(
  rec: AccountRecommendation,
  data: RawIntelligenceData,
  risks: RiskSection
): ActionSection {
  const alternatives: string[] = [];
  const prerequisites: string[] = [];

  // Build prerequisites based on gaps
  if (data.contacts.length === 0) {
    prerequisites.push('Identify at least one decision-maker contact before outreach');
  }
  if (risks.items.some(r => r.category === 'staleness' && r.severity === 'high')) {
    prerequisites.push('Refresh intelligence data — current data may be outdated');
  }
  if (data.evidence.length === 0 && data.signals.length > 0) {
    prerequisites.push('Verify signal accuracy through additional research');
  }
  if (rec.confidenceScore < 50) {
    prerequisites.push('Improve data quality before acting on this recommendation');
  }

  // Build alternatives based on priority
  if (rec.priority === 'critical' || rec.priority === 'high') {
    if (data.contacts.length === 0) {
      alternatives.push('Research company contacts first, then schedule discovery call');
    }
    alternatives.push('Add to monitoring list while preparing outreach strategy');
    if (data.capabilityMatches.length > 0) {
      alternatives.push(`Send targeted content about ${data.capabilityMatches[0].capability?.title || 'relevant capabilities'} to build awareness`);
    }
  } else {
    alternatives.push('Add to nurture sequence with relevant content');
    alternatives.push('Set up signal monitoring for trigger-based engagement');
    if (data.company.domain) {
      alternatives.push('Monitor website for technology changes or news announcements');
    }
  }

  // Build rationale
  const rationale = buildActionRationale(rec, data, risks);

  return {
    text: rec.recommendedAction.text,
    timeline: rec.recommendedAction.timeline,
    targetRole: rec.recommendedAction.targetRole,
    targetRoles: rec.recommendedAction.targetRoles,
    conversationAngle: rec.recommendedAction.conversationAngle,
    rationale,
    alternatives,
    prerequisites,
  };
}

function buildActionRationale(
  rec: AccountRecommendation,
  data: RawIntelligenceData,
  risks: RiskSection
): string {
  const parts: string[] = [];

  // Signal-based rationale
  const highSignals = data.signals.filter(s => ['critical', 'high'].includes(s.severity));
  if (highSignals.length > 0) {
    parts.push(`${highSignals.length} high-severity signal${highSignals.length > 1 ? 's' : ''} detected`);
  }

  // Opportunity-based rationale
  if (data.opportunities.length > 0 && data.opportunities[0].opportunityScore >= 60) {
    parts.push(`strong opportunity: ${data.opportunities[0].opportunityTitle}`);
  }

  // Capability rationale
  if (data.capabilityMatches.length > 0) {
    parts.push(`${data.capabilityMatches.length} capability match${data.capabilityMatches.length > 1 ? 'es' : ''}`);
  }

  // Timing rationale
  const recentSignal = highSignals.find(s =>
    s.signalDate && (Date.now() - s.signalDate.getTime()) < 30 * 24 * 60 * 60 * 1000
  );
  if (recentSignal) {
    parts.push('active signal within 30 days — optimal engagement window');
  }

  // Risk-adjusted rationale
  if (risks.totalRisks === 0) {
    parts.push('no significant risks identified');
  } else if (risks.overallAssessment === 'low_risk') {
    parts.push('minimal risks — good candidate for immediate action');
  } else if (risks.overallAssessment === 'high_risk') {
    parts.push('elevated risk profile — recommend enrichment before action');
  }

  // Confidence rationale
  if (rec.enterpriseReady) {
    parts.push('meets enterprise confidence threshold');
  } else {
    parts.push('below enterprise threshold — enrichment recommended first');
  }

  return parts.join('. ') + '.';
}

// ── Bulk Explainability (for list view) ──

/**
 * Generate lightweight explainability summaries for multiple companies.
 * Used in the recommendation list view to show trust indicators at a glance.
 */
export async function generateBulkExplainabilitySummaries(
  companyIds: string[]
): Promise<Map<string, ExplainabilitySummary>> {
  const results = new Map<string, ExplainabilitySummary>();

  // Batch fetch raw data for all companies
  const companies = await db.company.findMany({
    where: { id: { in: companyIds } },
    select: {
      id: true,
      rawName: true,
      lastEnrichedAt: true,
      source: true,
      _count: {
        select: {
          signals: true,
          evidence: true,
          contacts: true,
          opportunityRecommendations: true,
          signalCapabilityMatches: true,
        },
      },
    },
  });

  for (const company of companies) {
    try {
      // Quick assessment without full recommendation generation
      const hasSignals = company._count.signals > 0;
      const hasEvidence = company._count.evidence > 0;
      const hasContacts = company._count.contacts > 0;
      const hasOpportunities = company._count.opportunityRecommendations > 0;

      // Top evidence (simplified)
      const topEvidence: ExplainabilitySummary['topEvidence'] = [];
      if (hasOpportunities) topEvidence.push({ detected: `${company._count.opportunityRecommendations} opportunity(s) detected`, confidence: 75 });
      if (hasSignals) topEvidence.push({ detected: `${company._count.signals} buying signal(s)`, confidence: 70 });
      if (company._count.signalCapabilityMatches > 0) topEvidence.push({ detected: `${company._count.signalCapabilityMatches} capability match(es)`, confidence: 65 });
      if (hasEvidence) topEvidence.push({ detected: `${company._count.evidence} corroborating evidence`, confidence: 80 });

      // Risk summary (simplified)
      const riskSummary = { critical: 0, high: 0, medium: 0, low: 0 };
      if (!hasContacts) riskSummary.high++;
      if (!company.lastEnrichedAt) riskSummary.medium++;
      if (hasSignals && !hasEvidence) riskSummary.medium++;
      if (!hasSignals && !hasOpportunities) riskSummary.low++;

      // Data quality
      const dataQuality: EvidenceQuality = hasEvidence && company._count.evidence >= 3
        ? 'corroborated'
        : hasEvidence ? 'inferred'
        : hasSignals ? 'estimated'
        : 'speculative';

      // Source diversity
      const sourceTypes = new Set<string>();
      if (company.source) sourceTypes.add(company.source);
      if (hasSignals) sourceTypes.add('ai_analysis');
      if (hasEvidence) sourceTypes.add('research');
      if (hasOpportunities) sourceTypes.add('ai_reasoning');
      const sourceDiversity = Math.min(1.0, sourceTypes.size / 4);

      // Top improvement
      let topImprovement = 'Monitor for signal development';
      if (!hasContacts) topImprovement = 'Add contacts to enable outreach';
      else if (!company.lastEnrichedAt) topImprovement = 'Run intelligence enrichment';
      else if (!hasSignals) topImprovement = 'Enrich to detect buying signals';
      else if (!hasEvidence) topImprovement = 'Gather corroborating evidence';

      results.set(company.id, {
        companyId: company.id,
        companyName: company.rawName,
        topEvidence,
        riskSummary,
        dataQuality,
        sourceDiversity,
        topImprovement,
      });
    } catch (err) {
      logger.warn(`[ExplainabilityEngine] Bulk summary failed for ${company.rawName}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRecency(date: Date): string {
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo <= 7) return `${daysAgo} days ago`;
  if (daysAgo <= 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
  if (daysAgo <= 365) return `${Math.floor(daysAgo / 30)} months ago`;
  return `${Math.floor(daysAgo / 365)} years ago`;
}

function formatDimensionName(dimension: string): string {
  const names: Record<string, string> = {
    data_quality: 'Data Quality',
    source_reliability: 'Source Reliability',
    freshness: 'Data Freshness',
    cross_validation: 'Cross Validation',
    evidence_coverage: 'Evidence Coverage',
    ai_certainty: 'AI Certainty',
  };
  return names[dimension] || dimension;
}

// ── Phase 3.3: Explanation Quality Scoring ────────────────────────────────────

export interface ExplanationQualityResult {
  score: number;
  grade: 'excellent' | 'good' | 'adequate' | 'poor';
  issues: string[];
}

/**
 * Score the quality of an explainability report.
 * Evaluates five dimensions:
 *   - Evidence count and distribution (30%)
 *   - Source diversity (20%)
 *   - Confidence dimension coverage (20%)
 *   - Risk transparency (15%)
 *   - Action specificity (15%)
 */
export function scoreExplanationQuality(
  report: ExplainabilityReport
): ExplanationQualityResult {
  const issues: string[] = [];
  let totalScore = 0;

  // ── Dimension 1: Evidence count and distribution (30%) ──
  const evidenceTotal = report.evidence.totalCount;
  const categoryCount = report.evidence.categories.length;
  const strongCategories = report.evidence.categories.filter(c => c.strength === 'strong').length;
  const qualityVerified = report.evidence.qualityAssessment.verifiedCount;

  let evidenceScore = 0;
  // Ideal: 10+ evidence items, 3+ categories, at least 1 strong, verified items
  evidenceScore += Math.min(25, evidenceTotal * 2.5); // 10 items = 25pts
  evidenceScore += Math.min(20, categoryCount * 5); // 4 categories = 20pts
  evidenceScore += strongCategories > 0 ? 20 : 0;
  evidenceScore += Math.min(15, qualityVerified * 5); // 3 verified = 15pts
  evidenceScore += report.evidence.qualityAssessment.overallQuality === 'verified' ? 10
    : report.evidence.qualityAssessment.overallQuality === 'corroborated' ? 7
    : report.evidence.qualityAssessment.overallQuality === 'inferred' ? 4
    : 1;
  evidenceScore = Math.min(100, Math.round(evidenceScore));
  totalScore += evidenceScore * 0.30;

  if (evidenceTotal < 3) issues.push('Very few evidence items — recommendation may lack grounding');
  if (categoryCount < 2) issues.push('Evidence concentrated in few categories — limited perspective');
  if (strongCategories === 0) issues.push('No strong evidence categories — all evidence is weak or moderate');

  // ── Dimension 2: Source diversity (20%) ──
  const sourceDiversity = report.sources.diversityScore;
  const sourceReliability = report.sources.overallReliability;
  const sourceCount = report.sources.items.length;

  let diversityScore = 0;
  diversityScore += Math.min(50, sourceCount * 10); // 5 sources = 50pts
  diversityScore += Math.round(sourceDiversity * 30); // 0-1 → 0-30pts
  diversityScore += Math.round(sourceReliability * 20); // 0-1 → 0-20pts
  diversityScore = Math.min(100, Math.round(diversityScore));
  totalScore += diversityScore * 0.20;

  if (sourceCount < 2) issues.push('Single data source — recommendation relies on one perspective');
  if (sourceDiversity < 0.3) issues.push('Low source type diversity — may introduce bias');
  if (sourceReliability < 0.6) issues.push('Low overall source reliability — data may not be trustworthy');

  // ── Dimension 3: Confidence dimension coverage (20%) ──
  const dimCount = report.confidence.dimensions.length;
  const avgDimScore = dimCount > 0
    ? report.confidence.dimensions.reduce((s, d) => s + d.score, 0) / dimCount
    : 0;
  const hasImprovements = report.confidence.improvementOpportunities.length > 0;

  let confidenceScore = 0;
  confidenceScore += Math.min(40, dimCount * 8); // 5 dimensions = 40pts
  confidenceScore += Math.round(avgDimScore * 0.4); // avg 80+ → 32pts
  confidenceScore += hasImprovements ? 15 : 0;
  confidenceScore += report.confidence.overall.enterpriseReady ? 15 : 0;
  confidenceScore = Math.min(100, Math.round(confidenceScore));
  totalScore += confidenceScore * 0.20;

  if (dimCount < 4) issues.push('Incomplete confidence coverage — fewer than 4 dimensions scored');
  if (avgDimScore < 40) issues.push('Low average confidence across dimensions — high uncertainty');

  // ── Dimension 4: Risk transparency (15%) ──
  const riskCount = report.risks.totalRisks;
  const highRisks = report.risks.severityBreakdown.critical + report.risks.severityBreakdown.high;
  const hasMitigations = report.risks.items.filter(r => r.mitigation).length;
  const riskAssessment = report.risks.overallAssessment;

  let riskScore = 0;
  // Good risk transparency means risks are identified and mitigated
  riskScore += riskCount > 0 ? 25 : 0; // Having risks identified is good
  riskScore += Math.min(25, hasMitigations * 10); // Mitigations for each risk
  riskScore += riskAssessment === 'low_risk' ? 25 : riskAssessment === 'moderate_risk' ? 15 : 5;
  riskScore += highRisks > 0 ? 10 : 15; // No high risks = better, but identifying them = transparency
  riskScore += report.risks.items.length > 0 && report.risks.items.every(r => r.impact) ? 15 : 0;
  riskScore = Math.min(100, Math.round(riskScore));
  totalScore += riskScore * 0.15;

  if (riskCount > 0 && hasMitigations < riskCount / 2) {
    issues.push(`${riskCount - hasMitigations} risk(s) lack mitigation guidance`);
  }

  // ── Dimension 5: Action specificity (15%) ──
  const hasActionText = report.action.text.length > 20;
  const hasTimeline = report.action.timeline.length > 5;
  const hasTargetRoles = (report.action.targetRoles && report.action.targetRoles.length > 0) || !!report.action.targetRole;
  const hasConversationAngle = !!report.action.conversationAngle;
  const hasRationale = report.action.rationale.length > 30;
  const hasAlternatives = report.action.alternatives.length > 0;
  const hasPrerequisites = report.action.prerequisites.length > 0;

  let actionScore = 0;
  actionScore += hasActionText ? 15 : 0;
  actionScore += hasTimeline ? 15 : 0;
  actionScore += hasTargetRoles ? 15 : 0;
  actionScore += hasConversationAngle ? 15 : 0;
  actionScore += hasRationale ? 15 : 0;
  actionScore += hasAlternatives ? 13 : 0;
  actionScore += hasPrerequisites ? 12 : 0;
  actionScore = Math.min(100, Math.round(actionScore));
  totalScore += actionScore * 0.15;

  if (!hasTargetRoles) issues.push('No target roles specified — unclear who to engage');
  if (!hasConversationAngle) issues.push('No conversation angle — outreach may lack personalization');
  if (!hasRationale) issues.push('Action rationale is weak or missing');
  if (!hasAlternatives) issues.push('No alternative actions provided — limited flexibility');

  // ── Composite Score ──
  const compositeScore = Math.round(Math.min(100, Math.max(0, totalScore)));

  let grade: ExplanationQualityResult['grade'];
  if (compositeScore >= 80) grade = 'excellent';
  else if (compositeScore >= 60) grade = 'good';
  else if (compositeScore >= 40) grade = 'adequate';
  else grade = 'poor';

  return { score: compositeScore, grade, issues };
}

// ── Phase 3.5: Natural Language Explanation ─────────────────────────────────

/**
 * Generate a plain English summary of the full explainability report.
 * Designed to be human-readable without requiring understanding of the scoring system.
 */
export function generateNaturalLanguageSummary(
  report: ExplainabilityReport
): string {
  const parts: string[] = [];

  // Opening: What is this company and what's the recommendation?
  const score = report.recommendation.opportunityScore;
  const priority = report.recommendation.priority.toUpperCase();
  const enterpriseReady = report.recommendation.enterpriseReady;

  if (score >= 80) {
    parts.push(`${report.companyName} is a ${priority} priority account with a strong opportunity score of ${score}/100.`);
  } else if (score >= 60) {
    parts.push(`${report.companyName} shows meaningful potential with an opportunity score of ${score}/100.`);
  } else if (score >= 35) {
    parts.push(`${report.companyName} has moderate opportunity potential (score: ${score}/100).`);
  } else {
    parts.push(`${report.companyName} currently shows limited opportunity signals (score: ${score}/100).`);
  }

  // Evidence summary
  const evTotal = report.evidence.totalCount;
  const evQuality = report.evidence.qualityAssessment.overallQuality;
  if (evTotal > 0) {
    parts.push(`The recommendation is backed by ${evTotal} evidence items across ${report.evidence.categories.length} categories, with an overall evidence quality of ${evQuality}.`);
  } else {
    parts.push('This recommendation has limited evidence backing — additional research is recommended before taking action.');
  }

  // Top evidence highlights
  if (report.evidence.categories.length > 0) {
    const topItems = report.evidence.categories
      .filter(c => c.strength === 'strong' || c.strength === 'moderate')
      .slice(0, 2);
    if (topItems.length > 0) {
      const highlights = topItems.map(c => `${c.category} (${c.count} items, ${c.strength})`).join(' and ');
      parts.push(`The strongest evidence comes from ${highlights}.`);
    }
  }

  // Confidence assessment
  const confScore = report.recommendation.confidenceScore;
  const confGrade = report.recommendation.confidenceGrade;
  if (enterpriseReady) {
    parts.push(`Confidence is ${confGrade} (${confScore}/100), meeting the enterprise trust threshold — this recommendation is suitable for direct action.`);
  } else {
    parts.push(`Confidence is ${confGrade} (${confScore}/100), below the enterprise trust threshold — enrichment is recommended before outreach.`);
  }

  // Risk summary
  const riskTotal = report.risks.totalRisks;
  if (riskTotal === 0) {
    parts.push('No significant risks identified.');
  } else {
    const highRisks = report.risks.severityBreakdown.critical + report.risks.severityBreakdown.high;
    if (highRisks > 0) {
      parts.push(`${highRisks} high-severity risk(s) identified: ${report.risks.items.slice(0, 2).map(r => r.description).join('; ')}.`);
    } else {
      parts.push(`${riskTotal} risk(s) identified, primarily ${report.risks.severityBreakdown.medium} medium severity.`);
    }
  }

  // Recommended action
  parts.push(`Recommended action: ${report.action.text}.`);
  if (report.action.timeline) {
    parts.push(`Suggested timeline: ${report.action.timeline}.`);
  }
  if (report.action.targetRoles && report.action.targetRoles.length > 0) {
    parts.push(`Target roles: ${report.action.targetRoles.join(', ')}.`);
  } else if (report.action.targetRole) {
    parts.push(`Target role: ${report.action.targetRole}.`);
  }

  // Source diversity
  const sourceCount = report.sources.items.length;
  if (sourceCount > 1) {
    parts.push(`Data is sourced from ${sourceCount} different source types with ${Math.round(report.sources.diversityScore * 100)}% diversity and ${Math.round(report.sources.overallReliability * 100)}% overall reliability.`);
  }

  return parts.join(' ');
}

/**
 * Get explainability engine health/stats.
 */
export function getExplainabilityStats(): {
  engine: string;
  version: string;
  capabilities: string[];
  integrationPoints: string[];
} {
  return {
    engine: 'WI-17D Explainability Layer',
    version: '1.0.0',
    capabilities: [
      'Full intelligence trail generation',
      'Score decomposition with weight transparency',
      'Evidence categorization with quality assessment',
      'Source provenance and reliability tracking',
      'Confidence dimension breakdown',
      'Risk identification with mitigation guidance',
      'Action rationale with alternatives',
      'Bulk summary generation for list views',
      'Explanation quality scoring (Phase 3.3)',
      'Natural language summary generation (Phase 3.5)',
    ],
    integrationPoints: [
      'WI-17C Recommendation Engine (primary data source)',
      'WI-16C Unified Confidence Engine (6-dimension confidence)',
      'Evidence Framework (quality assessment)',
      'Direct DB queries (raw data provenance)',
    ],
  };
}
