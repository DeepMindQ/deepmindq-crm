/**
 * MS9 Integration Layer — Briefing Adapter
 * ===========================================
 *
 * Translates existing backend intelligence outputs into the MS9
 * StructuredBriefing contract. This is the CORE missing layer that
 * connects the completed MS9 UI with the existing intelligence backend.
 *
 * Input sources:
 *   - SynthesisEngine Brief (Markdown sections + citations + evidence chain)
 *   - Recommendation Engine (AccountRecommendation with reasons + risks)
 *   - Confidence Engine (ConfidenceResult with composite breakdown)
 *   - Company Signals (CompanySignal records)
 *   - Company Intelligence (Company model + AccountScore)
 *
 * Output: StructuredBriefing consumed directly by MS9 renderer.
 *
 * Design Principle:
 *   Backend adapts to MS9 contract.
 *   MS9 UI remains untouched.
 */

import type {
  StructuredBriefing,
  BriefingBlock,
  BriefingBlockType,
  BriefingBlockContent,
  SignalPill,
  TrustSourceReference,
  TrustFooter,
  ConfidenceFooter,
  ConfidenceDirection,
  InlineReasoning,
  ReasoningStep,
  AdvisorAccountContext,
  KeyFindingsContent,
  SignalsContent,
  RecommendationsContent,
  RiskFlagsContent,
  NarrativeContent,
  DataSummaryContent,
  TrustTier,
  PriorityLevel,
  SourceCategory,
  SignalType,
} from '@/types/ms9-advisor';

import type { Brief, BriefSection } from '@/lib/engines/synthesis-engine';
import type { AccountRecommendation } from '@/lib/recommendation-engine';
import type { ConfidenceResult } from '@/lib/intelligence-sources/confidence-engine';

import { signalTypeToPillVariant } from '@/types/ms9-advisor';

// ─── Adapter Configuration ─────────────────────────────────────────

export interface BriefingAdapterConfig {
  /** Company ID for this briefing */
  companyId: string;
  /** Company name */
  companyName: string;
  /** Domain (optional) */
  domain?: string | null;
  /** Industry (optional) */
  industry?: string | null;
  /** Maximum evidence items to include in trust footer */
  maxEvidenceItems?: number;
  /** Whether to include the inline reasoning chain */
  includeReasoning?: boolean;
}

// ─── Adapter Input ─────────────────────────────────────────────────

export interface BriefingAdapterInput {
  /** Synthesis engine brief (primary intelligence output) */
  brief: Brief;
  /** Recommendation engine output (optional enrichment) */
  recommendation?: AccountRecommendation | null;
  /** Confidence result (optional, derived from brief if not provided) */
  confidence?: ConfidenceResult | null;
  /** Account context for sidebar data */
  accountContext: AdvisorAccountContext;
  /** User query that triggered this briefing */
  query: string;
  /** Processing duration in ms */
  durationMs: number;
  /** Model used for generation */
  modelUsed: string;
  /** Token usage */
  tokensUsed?: { prompt: number; completion: number; total: number };
}

// ─── Trust Tier Mapping ────────────────────────────────────────────

function scoreToTrustTier(score: number): TrustTier {
  if (score >= 0.9) return 'verified';
  if (score >= 0.7) return 'high';
  if (score >= 0.45) return 'medium';
  if (score >= 0.25) return 'low';
  return 'unverified';
}

function scoreToPriorityLevel(score: number): PriorityLevel {
  if (score >= 0.85) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

// ─── Action Type Mapping ───────────────────────────────────────────

function inferActionType(action: string): 'review' | 'save' | 'monitor' | 'schedule' | 'export' | 'escalate' {
  const normalized = action.toLowerCase();
  if (/escalat|urgent|critical|immediate/i.test(normalized)) return 'escalate';
  if (/schedule|meeting|call|demo/i.test(normalized)) return 'schedule';
  if (/save|bookmark|flag/i.test(normalized)) return 'save';
  if (/monitor|watch|track|follow/i.test(normalized)) return 'monitor';
  if (/export|download|report|share/i.test(normalized)) return 'export';
  return 'review';
}

// ─── Signal Type Mapping ───────────────────────────────────────────

function inferSignalType(section: BriefSection): SignalType {
  const heading = section.heading.toLowerCase();
  const body = section.body.toLowerCase();
  const text = `${heading} ${body}`;

  if (/leadership|executive|ceo|cto|cfo|vp|director|appointed|departed|joined|left/i.test(text)) return 'leadership_change';
  if (/funding|raised|series [abc]|investment round|venture|capital/i.test(text)) return 'funding_event';
  if (/technology|stack|infrastructure|cloud|migration|adopted|implemented/i.test(text)) return 'technology_investment';
  if (/expand|entered|launched in|new market|geograph|region/i.test(text)) return 'market_expansion';
  if (/partner|alliance|joint venture|collaboration|integration/i.test(text)) return 'partnership';
  if (/product|launch|release|announced|unveiled|rolled out/i.test(text)) return 'product_launch';
  if (/hiring|recruit|job|openings|headcount|talent|grew.*team/i.test(text)) return 'hiring_surge';
  if (/revenue|earnings|financial|profit|loss|acquisition|acquired/i.test(text)) return 'financial_signal';
  if (/competitor|competitive|market share|lost.*to|gained.*from/i.test(text)) return 'competitive_move';
  return 'risk_indicator';
}

// ─── Risk Category Mapping ─────────────────────────────────────────

function inferRiskCategory(risk: ExtractedRisk): 'financial' | 'operational' | 'competitive' | 'timing' | 'data_quality' {
  const text = `${risk.title} ${risk.description}`.toLowerCase();
  if (/financial|revenue|budget|cost|spend|fiscal|earnings/i.test(text)) return 'financial';
  if (/operational|process|workflow|capacity|resource|team|staffing/i.test(text)) return 'operational';
  if (/competitor|competitive|market share|position|threat/i.test(text)) return 'competitive';
  if (/timing|window|deadline|urgency|delay|timeline/i.test(text)) return 'timing';
  return 'data_quality';
}

// ─── Briefing Block Factory ───────────────────────────────────────

function createBlock(
  type: BriefingBlockType,
  title: string,
  content: BriefingBlockContent,
  sortOrder: number,
  confidence: number,
  options?: { defaultCollapsed?: boolean; evidenceCount?: number },
): BriefingBlock {
  return {
    id: `block-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    sortOrder,
    defaultCollapsed: options?.defaultCollapsed ?? false,
    content,
    trust: {
      confidenceScore: Math.round(confidence * 100),
      trustTier: scoreToTrustTier(confidence),
      sourceCount: options?.evidenceCount ?? 0,
      hasHumanVerification: false,
    },
  };
}

// ─── Signal Pill Factory ────────────────────────────────────────────

function signalFromBriefSection(
  section: BriefSection,
  index: number,
): SignalPill | null {
  const firstCitation = section.citations[0];
  if (!firstCitation) return null;

  return {
    signalId: `signal-${index}`,
    label: section.heading.length > 40
      ? section.heading.slice(0, 40) + '…'
      : section.heading,
    variant: signalTypeToPillVariant(inferSignalType(section)),
    signalType: inferSignalType(section),
    priority: scoreToPriorityLevel(section.confidence),
    confidenceScore: Math.round(section.confidence * 100),
    trustTier: scoreToTrustTier(section.confidence),
    detectedAt: new Date().toISOString(),
    expandable: true,
  };
}

// ─── Core Adapter Function ─────────────────────────────────────────

/**
 * Translates backend intelligence outputs into a StructuredBriefing
 * that the MS9 UI can render directly.
 *
 * This is the primary translation function — it takes the SynthesisEngine's
 * Markdown-based Brief and converts it into MS9's typed block structure.
 */
export function adaptBriefToStructuredBriefing(
  input: BriefingAdapterInput,
  config: BriefingAdapterConfig,
): StructuredBriefing {
  const { brief, recommendation, accountContext, query, durationMs, modelUsed, tokensUsed } = input;
  const confidence = input.confidence ?? deriveConfidenceFromBrief(brief);

  // ── 1. Build Briefing Blocks ──
  const blocks = buildBriefingBlocks(brief, recommendation, confidence, config.companyId);

  // ── 2. Build Signal Pills from top sections ──
  const signalPills = buildSignalPills(brief.sections);

  // ── 3. Build Trust Footer ──
  const trustFooter = buildTrustFooter(brief, config.maxEvidenceItems);

  // ── 4. Build Confidence Footer ──
  const overallConfidence = confidence.composite;
  const confidenceFooter: ConfidenceFooter = {
    score: Math.round(overallConfidence * 100),
    trustTier: scoreToTrustTier(overallConfidence),
    direction: 'stable' as ConfidenceDirection,
    delta: 0,
    deltaExplanation: 'Initial briefing — no prior confidence baseline',
    hasReasoningChain: brief.sections.length > 0,
  };

  // ── 5. Build Inline Reasoning Chain ──
  const inlineReasoning = config.includeReasoning !== false
    ? buildReasoningChain(brief, recommendation)
    : undefined;

  // ── 6. Compose StructuredBriefing ──
  return {
    id: `briefing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: generateBriefingTitle(config, query),
    summary: generateBriefingSummary(brief, confidence),
    blocks,
    signalPills,
    trustFooter,
    confidence: confidenceFooter,
    inlineReasoning,
    accountContext,
    generatedAt: new Date().toISOString(),
    modelUsed,
    processingDurationMs: durationMs,
    tokensUsed,
  };
}

// ─── Block Builders ───────────────────────────────────────────────

function buildBriefingBlocks(
  brief: Brief,
  recommendation: AccountRecommendation | null | undefined,
  confidence: ConfidenceResult,
  companyId: string,
): BriefingBlock[] {
  const blocks: BriefingBlock[] = [];
  let sortOrder = 0;

  // Block 1: Key Findings — extracted from brief sections
  if (brief.sections.length > 0) {
    const findings: KeyFindingsContent['findings'] = brief.sections.slice(0, 6).map((section, idx) => ({
      id: `finding-${idx}`,
      headline: section.heading,
      description: section.body.length > 500
        ? section.body.slice(0, 500) + '…'
        : section.body,
      confidenceScore: Math.round(section.confidence * 100),
      trustTier: scoreToTrustTier(section.confidence),
      evidenceCount: section.citations.length,
      signalId: section.citations[0] || undefined,
    }));

    blocks.push(createBlock(
      'key_findings',
      'Key Findings',
      { type: 'key_findings', findings } as KeyFindingsContent,
      sortOrder++,
      brief.confidence,
      { evidenceCount: brief.citations.length },
    ));
  }

  // Block 2: Signals — signal pills from brief sections
  if (brief.citations.length > 0) {
    const pills = buildSignalPillsFromCitations(brief);
    const signalsContent: SignalsContent = {
      type: 'signals',
      pills,
      totalSignals: brief.citations.length,
      hasMore: brief.citations.length > pills.length,
    };

    blocks.push(createBlock(
      'signals',
      'Active Signals',
      signalsContent,
      sortOrder++,
      brief.confidence * 0.95,
      { evidenceCount: brief.citations.length },
    ));
  }

  // Block 3: Recommendations — from recommendation engine or brief
  const recs = extractRecommendations(brief, recommendation);
  if (recs.length > 0) {
    const recommendationsContent: RecommendationsContent = {
      type: 'recommendations',
      recommendations: recs.map((rec, i) => ({
        id: `rec-${i}`,
        title: rec.title,
        description: rec.description,
        actionType: inferActionType(rec.action),
        priority: scoreToPriorityLevel(rec.confidence),
        confidenceScore: Math.round(rec.confidence * 100),
        trustTier: scoreToTrustTier(rec.confidence),
        reasoning: rec.reasoning,
        signalId: rec.signalId,
        accountId: companyId,
      })),
    };

    blocks.push(createBlock(
      'recommendations',
      'Recommendations',
      recommendationsContent,
      sortOrder++,
      confidence.composite,
      { evidenceCount: recs.length },
    ));
  }

  // Block 4: Risk Flags — extracted from brief warnings and recommendation risks
  const risks = extractRiskFlags(brief, recommendation);
  if (risks.length > 0) {
    const riskSummary = risks.length === 1
      ? `${risks.length} risk identified: ${risks[0].title}`
      : `${risks.length} risks identified across ${new Set(risks.map(inferRiskCategory)).size} categories`;

    const riskContent: RiskFlagsContent = {
      type: 'risk_flags',
      flags: risks.map((risk, i) => ({
        id: `risk-${i}`,
        category: inferRiskCategory(risk),
        severity: risk.severity,
        headline: risk.title,
        description: risk.description,
        mitigation: risk.mitigation || 'Review and validate with additional intelligence sources',
        confidenceScore: Math.round(risk.confidence * 100),
        trustTier: scoreToTrustTier(risk.confidence),
      })),
      riskSummary,
    };

    blocks.push(createBlock(
      'risk_flags',
      'Risk Flags',
      riskContent,
      sortOrder++,
      confidence.composite * 0.85,
      { evidenceCount: risks.length, defaultCollapsed: true },
    ));
  }

  // Block 5: Narrative — full brief content as structured paragraphs
  if (brief.content) {
    const paragraphs = splitIntoParagraphs(brief.content).slice(0, 8).map((text, idx) => ({
      id: `paragraph-${idx}`,
      text,
      hasEmphasis: idx === 0, // First paragraph gets emphasis
    }));

    const narrativeContent: NarrativeContent = {
      type: 'narrative',
      paragraphs,
    };

    blocks.push(createBlock(
      'narrative',
      'Intelligence Narrative',
      narrativeContent,
      sortOrder++,
      brief.confidence,
      { evidenceCount: brief.citations.length, defaultCollapsed: true },
    ));
  }

  // Block 6: Data Summary — meta information about the briefing
  const dataSummary: DataSummaryContent = {
    type: 'data_summary',
    metrics: [
      {
        id: 'metric-evidence-sources',
        label: 'Evidence Sources',
        value: String(brief.citations.length),
        context: `Across ${brief.sections.length} intelligence domains`,
        confidenceScore: 95,
        trustTier: 'verified',
        sourceCategory: 'verified_official',
        trend: 'stable',
      },
      {
        id: 'metric-confidence-score',
        label: 'Confidence Score',
        value: `${Math.round(confidence.composite * 100)}%`,
        context: confidence.composite >= 0.7 ? 'Above threshold for action' : 'Below action threshold — gather more evidence',
        confidenceScore: Math.round(confidence.composite * 100),
        trustTier: scoreToTrustTier(confidence.composite),
        sourceCategory: 'ai_inference',
        trend: confidence.composite >= 0.7 ? 'up' : 'stable',
      },
      {
        id: 'metric-word-count',
        label: 'Word Count',
        value: String(brief.wordCount),
        context: brief.wordCount > 500 ? 'Comprehensive analysis' : 'Concise summary',
        confidenceScore: 95,
        trustTier: 'verified',
        sourceCategory: 'ai_inference',
        trend: 'stable',
      },
      {
        id: 'metric-sections-analyzed',
        label: 'Sections Analyzed',
        value: String(brief.sections.length),
        context: 'Intelligence domains covered',
        confidenceScore: 95,
        trustTier: 'verified',
        sourceCategory: 'ai_inference',
        trend: 'stable',
      },
      {
        id: 'metric-gaps-identified',
        label: 'Gaps Identified',
        value: String(brief.gaps.length),
        context: brief.gaps.length > 0 ? 'Areas requiring additional intelligence' : 'No significant gaps detected',
        confidenceScore: 90,
        trustTier: 'high',
        sourceCategory: 'ai_inference',
        trend: brief.gaps.length > 0 ? 'down' : 'stable',
      },
    ],
  };

  blocks.push(createBlock(
    'data_summary',
    'Data Summary',
    dataSummary,
    sortOrder++,
    0.95,
    { defaultCollapsed: true },
  ));

  return blocks;
}

// ─── Signal Pills from Citations ───────────────────────────────────

function buildSignalPillsFromCitations(brief: Brief): SignalPill[] {
  return brief.citations.slice(0, 10).map((citation, i) => {
    const pillVariant = brief.confidence >= 0.7 ? 'green' as const
      : brief.confidence >= 0.5 ? 'amber' as const
      : 'red' as const;

    return {
      signalId: citation.evidenceId || `citation-signal-${i}`,
      label: citation.marker,
      variant: pillVariant,
      signalType: 'financial_signal' as SignalType,
      priority: 'medium' as PriorityLevel,
      confidenceScore: Math.round(brief.confidence * 100),
      trustTier: scoreToTrustTier(brief.confidence),
      detectedAt: new Date().toISOString(),
      expandable: false,
    };
  });
}

// ─── Recommendation Extraction ─────────────────────────────────────

interface ExtractedRecommendation {
  title: string;
  description: string;
  action: string;
  confidence: number;
  reasoning: string;
  signalId?: string;
}

function extractRecommendations(
  brief: Brief,
  recommendation: AccountRecommendation | null | undefined,
): ExtractedRecommendation[] {
  const recs: ExtractedRecommendation[] = [];

  // From recommendation engine
  if (recommendation) {
    for (const reason of recommendation.reasons.slice(0, 4)) {
      recs.push({
        title: reason.category,
        description: reason.text,
        action: recommendation.recommendedAction?.text || 'Investigate further',
        confidence: reason.strength,
        reasoning: `${reason.category}: ${reason.text}`,
        signalId: reason.sourceId,
      });
    }
  }

  // Fallback: derive from brief sections with relevant headings
  if (recs.length === 0) {
    const relevantSections = brief.sections.filter(
      (s) => /recommend|strategy|action|next.step|approach/i.test(s.heading),
    );
    for (const section of relevantSections.slice(0, 3)) {
      recs.push({
        title: section.heading,
        description:
          section.body.length > 300
            ? section.body.slice(0, 300) + '…'
            : section.body,
        action: 'Review intelligence findings',
        confidence: section.confidence,
        reasoning: `Derived from intelligence section: ${section.heading}`,
        signalId: section.citations[0] || undefined,
      });
    }
  }

  return recs;
}

// ─── Risk Flag Extraction ──────────────────────────────────────────

interface ExtractedRisk {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation?: string;
  confidence: number;
}

function extractRiskFlags(
  brief: Brief,
  recommendation: AccountRecommendation | null | undefined,
): ExtractedRisk[] {
  const risks: ExtractedRisk[] = [];

  // From recommendation risks
  if (recommendation?.risks) {
    for (const risk of recommendation.risks.slice(0, 4)) {
      risks.push({
        title: risk.severity,
        description: risk.text,
        severity:
          risk.severity === 'critical'
            ? ('critical' as const)
            : risk.severity === 'high'
              ? ('high' as const)
              : risk.severity === 'medium'
                ? ('medium' as const)
                : ('low' as const),
        mitigation: risk.mitigation || undefined,
        confidence: 0.7,
      });
    }
  }

  // From brief warnings (hallucinated citations count as risks)
  for (const warning of brief.warnings.slice(0, 3)) {
    risks.push({
      title: 'Data Quality Warning',
      description: warning,
      severity: 'medium' as const,
      mitigation: 'Verify with primary sources',
      confidence: 0.6,
    });
  }

  // From evidence gaps
  for (const gap of brief.gaps.slice(0, 3)) {
    risks.push({
      title: 'Evidence Gap',
      description: gap.description || 'Missing evidence for key claim',
      severity: 'medium' as const,
      mitigation: 'Gather additional intelligence data',
      confidence: 0.5,
    });
  }

  return risks;
}

// ─── Signal Pill Builder ──────────────────────────────────────────

function buildSignalPills(sections: BriefSection[]): SignalPill[] {
  const pills: SignalPill[] = [];
  for (let i = 0; i < Math.min(sections.length, 8); i++) {
    const pill = signalFromBriefSection(sections[i], i);
    if (pill) pills.push(pill);
  }
  return pills;
}

// ─── Trust Footer Builder ──────────────────────────────────────────

function buildTrustFooter(
  brief: Brief,
  maxItems?: number,
): TrustFooter {
  const limit = maxItems ?? 10;
  const sources: TrustSourceReference[] = brief.citations.slice(0, limit).map((citation) => ({
    sourceName: citation.marker,
    trustTier: 'high' as TrustTier,
    sourceCategory: 'verified_external' as SourceCategory,
    hasEvidenceChain: true,
    sourceUrl: citation.url || undefined,
    evidenceCount: 1,
  }));

  return {
    sources,
    totalEvidenceCount: brief.citations.length,
    hasExplorationLink: (brief.evidenceChain as any)?.evidences?.length > 0,
  };
}

// ─── Reasoning Chain Builder ──────────────────────────────────────

function buildReasoningChain(
  brief: Brief,
  recommendation: AccountRecommendation | null | undefined,
): InlineReasoning {
  const steps: ReasoningStep[] = [];

  // Step 1: Evidence collection
  steps.push({
    claim: `Collected ${brief.citations.length} evidence sources across ${brief.sections.length} intelligence domains`,
    supportingEvidence: brief.citations.slice(0, 3).map((c) => c.marker).join(', '),
    source: 'Grounding Engine',
    stepConfidence: Math.round(brief.confidence * 100),
    expandable: false,
  });

  // Step 2: Analysis synthesis
  steps.push({
    claim: 'Synthesized evidence into structured intelligence assessment',
    supportingEvidence: `Processed ${brief.wordCount} words of intelligence content`,
    source: 'Synthesis Engine',
    stepConfidence: Math.round(brief.confidence * 95),
    expandable: true,
  });

  // Step 3: Quality validation
  const qualityNote =
    brief.warnings.length > 0
      ? `${brief.warnings.length} quality warnings identified`
      : 'All quality gates passed';
  steps.push({
    claim: qualityNote,
    supportingEvidence:
      brief.warnings.slice(0, 2).join('; ') || 'No hallucinated citations detected',
    source: 'Quality Gates',
    stepConfidence: brief.warnings.length === 0 ? 95 : 70,
    expandable: true,
  });

  // Step 4: Recommendation generation (if available)
  if (recommendation) {
    steps.push({
      claim: `Generated ${recommendation.reasons.length} evidence-backed recommendations`,
      supportingEvidence: recommendation.reasons
        .slice(0, 2)
        .map((r) => r.text)
        .join('; '),
      source: 'Recommendation Engine',
      stepConfidence: recommendation.confidenceScore,
      expandable: true,
    });
  }

  return {
    id: `reasoning-${Date.now()}`,
    defaultExpanded: false,
    toggleLabel: 'Show reasoning chain',
    content: `This briefing was generated using ${brief.citations.length} evidence sources. The synthesis engine processed ${brief.wordCount} words of intelligence content across ${brief.sections.length} domains.`,
    steps,
    sourceCount: brief.citations.length,
  };
}

// ─── Confidence Derivation ────────────────────────────────────────

/**
 * Derives a ConfidenceResult from a Brief when no explicit
 * confidence calculation is available.
 */
function deriveConfidenceFromBrief(brief: Brief): ConfidenceResult {
  const composite = brief.confidence;
  return {
    composite,
    sourceQuality: Math.min(1, composite * 1.1),
    freshness: { score: 0.8, daysElapsed: 0, maxDays: 30 },
    contentValidation: brief.wordCount > 500 ? 0.9 : brief.wordCount > 200 ? 0.7 : 0.5,
    breakdown: {
      sourceQuality: Math.min(1, composite * 1.1),
      freshness: 0.8,
      contentValidation: brief.wordCount > 500 ? 0.9 : brief.wordCount > 200 ? 0.7 : 0.5,
    },
  };
}

// ─── Title & Summary Generation ────────────────────────────────────

function generateBriefingTitle(config: BriefingAdapterConfig, query: string): string {
  return query.length > 80
    ? `${config.companyName} — ${query.slice(0, 80)}…`
    : `${config.companyName} — ${query}`;
}

function generateBriefingSummary(brief: Brief, confidence: ConfidenceResult): string {
  const confidencePct = Math.round(confidence.composite * 100);
  const evidenceCount = brief.citations.length;
  const sectionCount = brief.sections.length;

  if (brief.sections.length > 0) {
    const firstSection = brief.sections[0];
    const summary =
      firstSection.body.length > 300
        ? firstSection.body.slice(0, 300) + '…'
        : firstSection.body;
    return `${summary} (Confidence: ${confidencePct}%, ${evidenceCount} sources, ${sectionCount} sections)`;
  }

  return `Intelligence briefing with ${confidencePct}% confidence based on ${evidenceCount} evidence sources across ${sectionCount} sections.`;
}

// ─── Paragraph Splitting ──────────────────────────────────────────

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
}
