/**
 * SynthesisEngine — Phase B Composition Engine #1
 * ================================================
 *
 * Depth-first long-form brief generator. The first composition engine
 * that orchestrates all 3 foundation engines:
 *
 *   1. GroundingEngine.collect() — gather evidence
 *   2. RetrievalEngine.search() — find relevant knowledge
 *   3. ModelRouter.complete({ tier: 'deep' }) — generate the brief
 *
 * Then parses the LLM output to extract:
 *   - Sections (with per-section confidence)
 *   - Citation markers [En] mapped to evidence IDs
 *   - Hallucinated citations (markers pointing to non-existent evidence)
 *   - Word count, model used, token usage, cost
 *
 * DEPTH-FIRST DESIGN
 * ------------------
 * 5 brief types, each with its own systemPrompt + section outline +
 * minWordCount + maxTokens. The deep tier produces 1200-2000 word briefs
 * for account_brief, 1000-1800 for deal_strategy, etc.
 *
 * HALLUCINATION PREVENTION
 * ------------------------
 * The system prompt mandates [En] citation for every factual claim. The
 * parser detects hallucinated citations (e.g. [E99] when only 8 evidences
 * exist) and flags them in warnings[]. Confidence is penalized per
 * hallucination found.
 *
 * NON-THROWING CONTRACT
 * ---------------------
 * Returns Brief with `success: boolean` + `error: string | null`. LLM
 * failures produce a Brief with success=false + the error message; the
 * composition engine caller decides how to surface this to the user.
 */

import { ModelRouter } from './model-router';
import { GroundingEngine, renderChainForPrompt } from './grounding-engine';
import { RetrievalEngine } from './retrieval-engine';
import type { EvidenceChain, EvidenceGap, GroundingContext } from './grounding-engine';
import { runQualityGates, formatQualityReportForLog } from '@/lib/ai-copilot/quality-gates';
import type { QualityReport } from '@/lib/ai-copilot/quality-gates';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export type BriefType =
  | 'account_brief' // Full company strategic narrative
  | 'deal_strategy' // Pursuit strategy for a specific opportunity
  | 'exec_summary' // 1-page exec summary for account
  | 'contact_brief' // Person intelligence brief
  | 'opportunity_brief'; // Specific opportunity deep-dive

export type BriefDepth = 'standard' | 'deep';

export interface BriefRequest {
  briefType: BriefType;
  context: GroundingContext;
  depth?: BriefDepth;
  /** Optional focus areas to emphasize (e.g. ['funding', 'tech_stack']) */
  focusAreas?: string[];
  /** Optional audience tone ('executive' | 'analyst' | 'sales') */
  audience?: 'executive' | 'analyst' | 'sales';
  /** Composition ID for engine-run audit linking */
  compositionId?: string;
}

export interface BriefSection {
  /** Section heading (e.g. "Strategic Situation") */
  heading: string;
  /** Section body — Markdown-formatted text */
  body: string;
  /** Per-section confidence (0-1), derived from evidence quality for this section */
  confidence: number;
  /** Evidence IDs cited in this section (e.g. ['signal:abc', 'news:def']) */
  citations: string[];
}

export interface BriefCitation {
  /** The citation marker as it appears in the brief (e.g. "E3") */
  marker: string;
  /** The evidence ID it maps to (e.g. "signal:abc123") */
  evidenceId: string;
  /** Evidence snippet (for hover/tooltips in UI) */
  snippet: string;
  /** Evidence source URL (for clickable citations) */
  url: string | null;
}

export interface Brief {
  /** Brief type */
  type: BriefType;
  /** Full Markdown-formatted brief text */
  content: string;
  /** Parsed sections */
  sections: BriefSection[];
  /** Citation index — maps markers to evidence IDs */
  citations: BriefCitation[];
  /** Overall brief confidence (0-1) — calibrated against evidence quality */
  confidence: number;
  /** Evidence chain used to ground this brief */
  evidenceChain: EvidenceChain;
  /** Coverage gaps acknowledged in the brief */
  gaps: EvidenceGap[];
  /** Word count */
  wordCount: number;
  /** Which model produced this brief */
  modelUsed: string;
  /** Time spent generating (ms) */
  durationMs: number;
  /** Token usage */
  tokensUsed: number;
  /** Estimated cost in USD */
  costUsd: number;
  /** Warnings (e.g. hallucinated citations, low evidence) */
  warnings: string[];
  /** Whether generation succeeded */
  success: boolean;
  /** Error message if !success */
  error: string | null;
  /** Quality gate report from ai-copilot quality gates (Phase 2 absorption) */
  qualityReport?: QualityReport;
}

// ─── Brief Type Configurations ──────────────────────────────────────────

interface BriefTypeConfig {
  systemPrompt: string;
  sectionOutline: string[];
  minWordCount: number;
  maxTokens: number;
  defaultDepth: BriefDepth;
}

const BRIEF_TYPE_CONFIGS: Record<BriefType, BriefTypeConfig> = {
  account_brief: {
    systemPrompt: `You are a senior account strategist producing a comprehensive account brief for an executive audience.

Your brief must be:
- Depth-first: 1200-2000 words, structured into clearly headed sections
- Evidence-grounded: every factual claim cites evidence using [En] markers
  (e.g. "The company raised $50M Series C [E3]")
- Calibrated: explicitly acknowledge evidence gaps rather than papering over them
- Actionable: conclude with concrete next steps and recommended actions

CRITICAL RULES:
1. NEVER fabricate evidence markers. Only cite [En] for evidence that exists
   in the Evidence Chain provided. If you don't have evidence for a claim,
   either find supporting evidence or explicitly state it as an inference.
2. EVERY section must end with "> Section confidence: X/10" where X reflects
   the evidence quality for that specific section (10 = strong evidence,
   5 = limited evidence, 1 = speculation).
3. Acknowledge gaps: if the Evidence Chain lists gaps, mention them in the
   relevant section ("Note: limited data on funding history — see gap above").
4. Use Markdown formatting with ## for section headings.
5. Do NOT include a "Brief Generated" or "End of Brief" marker.`,
    sectionOutline: [
      'Strategic Situation',
      'Business Context',
      'Technology Landscape',
      'Key Signals & Triggers',
      'Pain Points & Opportunities',
      'Recommended Approach',
      'Next Steps',
    ],
    minWordCount: 1200,
    maxTokens: 8192,
    defaultDepth: 'deep',
  },
  deal_strategy: {
    systemPrompt: `You are a senior deal strategist producing a pursuit strategy.

Your brief must be:
- Depth-first: 1000-1800 words
- Evidence-grounded: cite [En] for every factual claim
- Include explicit go/no-go recommendation with rationale
- Identify win themes, risks, and key stakeholders
- Calibrate confidence per section

CRITICAL RULES:
1. NEVER fabricate evidence markers. Only cite [En] for evidence that exists.
2. EVERY section must end with "> Section confidence: X/10".
3. Acknowledge evidence gaps explicitly.
4. Use ## for section headings.`,
    sectionOutline: [
      'Opportunity Assessment',
      'Go/No-Go Recommendation',
      'Win Themes',
      'Competitive Position',
      'Key Stakeholders',
      'Risks & Mitigations',
      'Pursuit Plan',
    ],
    minWordCount: 1000,
    maxTokens: 6144,
    defaultDepth: 'deep',
  },
  exec_summary: {
    systemPrompt: `You are an executive assistant producing a tight 1-page executive summary.

Your brief must be:
- Concise: 400-600 words
- Evidence-grounded: cite [En] for key claims
- Front-loaded: lead with the most important insight
- Actionable: end with 2-3 concrete recommendations

CRITICAL RULES:
1. NEVER fabricate evidence markers.
2. End with "> Section confidence: X/10".
3. Acknowledge evidence gaps in a single sentence if relevant.
4. Use ## for section headings.`,
    sectionOutline: [
      'Bottom Line',
      'Key Insights',
      'Recommended Actions',
    ],
    minWordCount: 400,
    maxTokens: 2048,
    defaultDepth: 'standard',
  },
  contact_brief: {
    systemPrompt: `You are a sales intelligence analyst producing a contact brief.

Your brief must be:
- Depth-first: 800-1400 words
- Evidence-grounded: cite [En] for every claim about the contact
- Focus on role, influence, priorities, communication style
- Include conversation starters and topics to avoid
- Calibrate confidence per section

CRITICAL RULES:
1. NEVER fabricate evidence markers.
2. EVERY section must end with "> Section confidence: X/10".
3. Acknowledge evidence gaps explicitly.
4. Use ## for section headings.`,
    sectionOutline: [
      'Role & Influence',
      'Priorities & Goals',
      'Communication Style',
      'Conversation Starters',
      'Topics to Avoid',
      'Recommended Approach',
    ],
    minWordCount: 800,
    maxTokens: 4096,
    defaultDepth: 'deep',
  },
  opportunity_brief: {
    systemPrompt: `You are a senior opportunity analyst producing an opportunity deep-dive brief.

Your brief must be:
- Depth-first: 800-1400 words
- Evidence-grounded: cite [En] for every claim
- Focus on the specific opportunity (RFP/RFI/signal)
- Include timing, budget, decision criteria, competitive landscape
- Calibrate confidence per section

CRITICAL RULES:
1. NEVER fabricate evidence markers.
2. EVERY section must end with "> Section confidence: X/10".
3. Acknowledge evidence gaps explicitly.
4. Use ## for section headings.`,
    sectionOutline: [
      'Opportunity Overview',
      'Requirements & Criteria',
      'Budget & Timing',
      'Competitive Landscape',
      'Win Strategy',
      'Risks & Mitigations',
    ],
    minWordCount: 800,
    maxTokens: 4096,
    defaultDepth: 'deep',
  },
};

// ─── Citation Parser ────────────────────────────────────────────────────

/**
 * Parse the LLM output to extract:
 *   - Citation markers ([E1], [E2], etc.)
 *   - Map them to evidence IDs from the chain
 *   - Flag hallucinated citations (markers pointing to non-existent evidence)
 */
function parseCitations(
  text: string,
  chain: EvidenceChain,
): { citations: BriefCitation[]; hallucinated: string[] } {
  const citations: BriefCitation[] = [];
  const hallucinated: string[] = [];
  const seen = new Set<string>();

  // Find all [En] markers
  const regex = /\[E(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const n = parseInt(match[1], 10);
    const marker = `E${n}`;

    if (seen.has(marker)) continue;
    seen.add(marker);

    if (n >= 1 && n <= chain.evidences.length) {
      const evidence = chain.evidences[n - 1];
      citations.push({
        marker,
        evidenceId: evidence.id,
        snippet: evidence.snippet,
        url: evidence.url,
      });
    } else {
      hallucinated.push(marker);
    }
  }

  return { citations, hallucinated };
}

// ─── Section Parser ─────────────────────────────────────────────────────

/**
 * Parse the brief into sections based on ## headings.
 * Extracts per-section confidence from "> Section confidence: X/10" markers.
 */
function parseSections(text: string, citations: BriefCitation[]): BriefSection[] {
  const sections: BriefSection[] = [];

  // Split on ## headings (but not ### or deeper)
  const parts = text.split(/^## (.+)$/m);
  if (parts.length < 2) {
    // No headings — treat entire text as one section
    return [
      {
        heading: 'Brief',
        body: text.trim(),
        confidence: 0.5,
        citations: citations.map((c) => c.evidenceId),
      },
    ];
  }

  // parts[0] is preamble (usually empty), then alternating heading/body
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const body = (parts[i + 1] ?? '').trim();

    // Extract section confidence
    const confMatch = body.match(/> Section confidence:\s*(\d+(?:\.\d+)?)\s*\/\s*10/);
    let confidence = 0.5;
    if (confMatch) {
      const val = parseFloat(confMatch[1]);
      confidence = Math.max(0, Math.min(1, val / 10));
    }

    // Find citations in this section
    const sectionCitations: string[] = [];
    const citeRegex = /\[E(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = citeRegex.exec(body)) !== null) {
      const marker = `E${m[1]}`;
      const citation = citations.find((c) => c.marker === marker);
      if (citation && !sectionCitations.includes(citation.evidenceId)) {
        sectionCitations.push(citation.evidenceId);
      }
    }

    sections.push({
      heading,
      body: body.replace(/> Section confidence:\s*\d+(?:\.\d+)?\s*\/\s*10.*/, '').trim(),
      confidence,
      citations: sectionCitations,
    });
  }

  return sections;
}

// ─── Prompt Builder ─────────────────────────────────────────────────────

function buildUserPrompt(
  briefType: BriefType,
  chain: EvidenceChain,
  retrievedKnowledge: { entityId: string; snippet: string; score: number }[],
  config: BriefTypeConfig,
  focusAreas?: string[],
  audience?: 'executive' | 'analyst' | 'sales',
): string {
  const lines: string[] = [];

  lines.push(`# Brief Type: ${briefType.replace(/_/g, ' ')}`);
  lines.push('');
  if (audience) lines.push(`**Audience:** ${audience}`);
  if (focusAreas && focusAreas.length > 0) {
    lines.push(`**Focus areas:** ${focusAreas.join(', ')}`);
  }
  lines.push(`**Target word count:** ${config.minWordCount}+ words`);
  lines.push(`**Required sections:** ${config.sectionOutline.join(' · ')}`);
  lines.push('');

  lines.push(renderChainForPrompt(chain));
  lines.push('');

  if (retrievedKnowledge.length > 0) {
    lines.push('## Retrieved Knowledge (semantic search)');
    lines.push('');
    retrievedKnowledge.forEach((k, i) => {
      lines.push(`### [K${i + 1}] ${k.entityId} (score: ${Math.round(k.score * 100)}%)`);
      lines.push(k.snippet);
      lines.push('');
    });
  }

  lines.push('## Instructions');
  lines.push('Produce the brief now. Remember:');
  lines.push('- Cite [En] for every factual claim');
  lines.push('- End every section with "> Section confidence: X/10"');
  lines.push('- Acknowledge evidence gaps explicitly');
  lines.push('- Do not fabricate evidence');

  return lines.join('\n');
}

// ─── EngineRun Audit ────────────────────────────────────────────────────

async function logEngineRun(args: {
  engine: string;
  compositionId?: string;
  inputSummary: string;
  outputSummary: string;
  confidence: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  context: GroundingContext;
  llmCallCount: number;
  llmTokensUsed: number;
  llmCostUsd: number;
}): Promise<void> {
  try {
    await db.engineRun.create({
      data: {
        engine: args.engine,
        compositionId: args.compositionId,
        inputSummary: args.inputSummary,
        outputSummary: args.outputSummary,
        confidence: args.confidence,
        durationMs: args.durationMs,
        success: args.success,
        errorMessage: args.errorMessage ?? null,
        companyId: args.context.companyId ?? null,
        contactId: args.context.contactId ?? null,
        opportunityId: args.context.opportunityId ?? null,
        llmCallCount: args.llmCallCount,
        llmTokensUsed: args.llmTokensUsed,
        llmCostUsd: args.llmCostUsd,
      },
    });
  } catch (err) {
    logger.error(`[synthesis-engine] logEngineRun failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── SynthesisEngine ────────────────────────────────────────────────────

export const SynthesisEngine = {
  /**
   * Generate a depth-first, evidence-grounded brief.
   * Non-throwing — returns Brief with success=false + error on failure.
   */
  async generate(request: BriefRequest): Promise<Brief> {
    const startedAt = Date.now();
    const config = BRIEF_TYPE_CONFIGS[request.briefType];
    const depth = request.depth ?? config.defaultDepth;
    const tier = depth === 'deep' ? 'deep' : 'smart';

    logger.info(`[synthesis-engine] generating ${request.briefType} depth=${depth} ` +
        `company=${request.context.companyId ?? '-'} contact=${request.context.contactId ?? '-'}`);

    // Step 1: Collect evidence
    const chain = await GroundingEngine.collect(request.context);

    if (chain.evidences.length === 0) {
      const durationMs = Date.now() - startedAt;
      const error = 'insufficient_evidence';
      logger.info(`[synthesis-engine] ${error} — no evidences collected`);
      await logEngineRun({
        engine: 'synthesis',
        compositionId: request.compositionId,
        inputSummary: JSON.stringify({ briefType: request.briefType, context: request.context }),
        outputSummary: JSON.stringify({ error }),
        confidence: 0,
        durationMs,
        success: false,
        errorMessage: error,
        context: request.context,
        llmCallCount: 0,
        llmTokensUsed: 0,
        llmCostUsd: 0,
      });
      return {
        type: request.briefType,
        content: '',
        sections: [],
        citations: [],
        confidence: 0,
        evidenceChain: chain,
        gaps: chain.gaps,
        wordCount: 0,
        modelUsed: 'none',
        durationMs,
        tokensUsed: 0,
        costUsd: 0,
        warnings: ['No evidence available — cannot generate brief'],
        success: false,
        error,
      };
    }

    // Step 2: Retrieve relevant knowledge (semantic search)
    let retrievedKnowledge: { entityId: string; snippet: string; score: number }[] = [];
    try {
      const query = `${request.briefType} ${request.focusAreas?.join(' ') ?? ''} ${chain.evidences.slice(0, 3).map((e) => e.snippet).join(' ')}`;
      const results = await RetrievalEngine.search(query, 5);
      retrievedKnowledge = results.map((r) => ({
        entityId: r.entityId,
        snippet: r.snippet,
        score: r.score,
      }));
    } catch (err) {
      logger.error(`[synthesis-engine] retrieval failed: ${err instanceof Error ? err.message : err}`);
    }

    // Step 3: Build prompt + call ModelRouter
    const userPrompt = buildUserPrompt(
      request.briefType,
      chain,
      retrievedKnowledge,
      config,
      request.focusAreas,
      request.audience,
    );

    const completion = await ModelRouter.complete({
      systemPrompt: config.systemPrompt,
      userPrompt,
      tier,
      maxTokens: config.maxTokens,
      temperature: 0.7,
      compositionId: request.compositionId,
      genType: `synthesis_${request.briefType}`,
      companyId: request.context.companyId,
      contactId: request.context.contactId,
    });

    const durationMs = Date.now() - startedAt;

    if (!completion.success) {
      await logEngineRun({
        engine: 'synthesis',
        compositionId: request.compositionId,
        inputSummary: JSON.stringify({ briefType: request.briefType, context: request.context }),
        outputSummary: JSON.stringify({ error: completion.error }),
        confidence: 0,
        durationMs,
        success: false,
        errorMessage: completion.error ?? 'unknown',
        context: request.context,
        llmCallCount: 1,
        llmTokensUsed: completion.totalTokens,
        llmCostUsd: completion.costUsd,
      });
      return {
        type: request.briefType,
        content: '',
        sections: [],
        citations: [],
        confidence: 0,
        evidenceChain: chain,
        gaps: chain.gaps,
        wordCount: 0,
        modelUsed: completion.modelUsed,
        durationMs,
        tokensUsed: completion.totalTokens,
        costUsd: completion.costUsd,
        warnings: [`LLM call failed: ${completion.error}`],
        success: false,
        error: completion.error,
      };
    }

    // Step 4: Parse output
    const { citations, hallucinated } = parseCitations(completion.text, chain);
    const sections = parseSections(completion.text, citations);
    const wordCount = completion.text.split(/\s+/).filter(Boolean).length;

    // Step 5: Compute warnings + adjust confidence
    const warnings: string[] = [];
    if (hallucinated.length > 0) {
      warnings.push(`Hallucinated citations detected: ${hallucinated.join(', ')} (these markers do not map to any evidence)`);
    }
    if (wordCount < config.minWordCount) {
      warnings.push(`Brief is ${wordCount} words — below the ${config.minWordCount} word target`);
    }
    if (chain.coverage < 0.5) {
      warnings.push(`Low evidence coverage (${Math.round(chain.coverage * 100)}%) — brief may contain inferences`);
    }
    if (chain.gaps.length > 3) {
      warnings.push(`${chain.gaps.length} evidence gaps acknowledged`);
    }

    // Penalize confidence for hallucinations
    const hallucinationPenalty = hallucinated.length * 0.1;
    const confidence = Math.max(0, chain.aggregateConfidence - hallucinationPenalty);

    logger.info(
      `[synthesis-engine] brief generated: ${wordCount} words, ${sections.length} sections, ` +
        `${citations.length} citations, confidence=${confidence.toFixed(2)}, ` +
        `warnings=${warnings.length}`,
    );

    await logEngineRun({
      engine: 'synthesis',
      compositionId: request.compositionId,
      inputSummary: JSON.stringify({ briefType: request.briefType, context: request.context }),
      outputSummary: JSON.stringify({
        wordCount,
        sections: sections.length,
        citations: citations.length,
        confidence,
        warnings: warnings.length,
      }),
      confidence,
      durationMs,
      success: true,
      context: request.context,
      llmCallCount: 1,
      llmTokensUsed: completion.totalTokens,
      llmCostUsd: completion.costUsd,
    });

    // Run quality gates on the output (Phase 2: absorbed from ai-copilot)
    let qualityReport: QualityReport | undefined;
    try {
      const outputObj = JSON.parse(completion.text) as Record<string, unknown>;
      qualityReport = runQualityGates(outputObj, warnings.length === 0);
      logger.info(formatQualityReportForLog(qualityReport));
      if (qualityReport?.overallStatus === 'fail') {
        warnings.push(`Quality gate FAILED (score: ${qualityReport?.overallScore}/100)`);
      }
    } catch {
      // Quality gates need parseable JSON — skip for non-JSON output
    }

    return {
      type: request.briefType,
      content: completion.text,
      sections,
      citations,
      confidence,
      evidenceChain: chain,
      gaps: chain.gaps,
      wordCount,
      modelUsed: completion.modelUsed,
      durationMs,
      tokensUsed: completion.totalTokens,
      costUsd: completion.costUsd,
      warnings,
      success: true,
      error: null,
      qualityReport,
    };
  },
};
