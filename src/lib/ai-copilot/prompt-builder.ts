/**
 * AI Revenue Copilot — Prompt Builder
 *
 * Constructs system and user prompts for LLM calls in the reasoning engine,
 * engagement strategy generation, and brief enhancement pipelines.
 *
 * Each builder produces a { system, user } tuple ready for the governance layer.
 * Prompts are deliberately structured to minimize hallucination by grounding
 * the LLM in the provided data and instructing explicit evidence citation.
 */

import type {
  ReasoningContext,
  StrategicInsightOutput,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Groups knowledge entries by category and formats them as a readable section.
 */
function formatKnowledgeByCategory(ctx: ReasoningContext): string {
  if (ctx.knowledgeEntries.length === 0) return '  (No knowledge entries available)';

  const byCategory = new Map<string, typeof ctx.knowledgeEntries>();
  for (const entry of ctx.knowledgeEntries) {
    const existing = byCategory.get(entry.category) ?? [];
    existing.push(entry);
    byCategory.set(entry.category, existing);
  }

  const lines: string[] = [];
  const categoryList = Array.from(byCategory.entries());
  for (const [category, catEntries] of categoryList) {
    lines.push(`  ## ${category} (${catEntries.length} entries)`);
    for (const entry of catEntries) {
      const confPct = Math.round(entry.confidence * 100);
      const src = entry.source ?? 'unknown';
      lines.push(
        `    - [${entry.id}] (confidence: ${confPct}%, source: ${src}): ${entry.content.slice(0, 300)}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Formats intelligence objects into a compact list.
 */
function formatIntelligenceObjects(ctx: ReasoningContext): string {
  if (ctx.intelligenceObjects.length === 0) return '  (No intelligence objects available)';

  const lines: string[] = ['  ## Intelligence Objects'];
  for (const obj of ctx.intelligenceObjects.slice(0, 50)) {
    const confPct = Math.round(obj.confidence * 100);
    const summary = obj.summary ?? obj.content.slice(0, 200);
    lines.push(
      `    - [${obj.id}] (${obj.sourceType}, confidence: ${confPct}%): ${summary}`
    );
  }
  if (ctx.intelligenceObjects.length > 50) {
    lines.push(`    ... and ${ctx.intelligenceObjects.length - 50} more objects`);
  }

  return lines.join('\n');
}

/**
 * Formats company signals and opportunity signals.
 */
function formatSignals(ctx: ReasoningContext): string {
  const lines: string[] = [];

  if (ctx.signals.length > 0) {
    lines.push('  ## Company Signals');
    for (const sig of ctx.signals.slice(0, 30)) {
      const confPct = Math.round(sig.confidence * 100);
      lines.push(
        `    - [${sig.id}] ${sig.signalType} | ${sig.severity} | confidence: ${confPct}%: ${sig.title}`
      );
    }
    if (ctx.signals.length > 30) {
      lines.push(`    ... and ${ctx.signals.length - 30} more signals`);
    }
  }

  if (ctx.opportunitySignals.length > 0) {
    lines.push('  ## Opportunity Signals');
    for (const opp of ctx.opportunitySignals.slice(0, 20)) {
      const confPct = Math.round(opp.confidence * 100);
      lines.push(
        `    - [${opp.id}] ${opp.signalType} | score: ${Math.round(opp.score)} | confidence: ${confPct}%: ${opp.title}`
      );
    }
    if (ctx.opportunitySignals.length > 20) {
      lines.push(`    ... and ${ctx.opportunitySignals.length - 20} more opportunity signals`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '  (No signals detected)';
}

/**
 * Formats evidence items.
 */
function formatEvidence(ctx: ReasoningContext): string {
  if (ctx.evidence.length === 0) return '  (No evidence items)';

  const lines: string[] = ['  ## Evidence'];
  for (const ev of ctx.evidence.slice(0, 30)) {
    const field = ev.extractedField ?? 'general';
    const relPct = Math.round(ev.relevanceScore * 100);
    lines.push(
      `    - [${ev.id}] (${field}, relevance: ${relPct}%): ${ev.snippet.slice(0, 200)}`
    );
  }
  if (ctx.evidence.length > 30) {
    lines.push(`    ... and ${ctx.evidence.length - 30} more evidence items`);
  }

  return lines.join('\n');
}

/**
 * Formats existing account brief and score.
 */
function formatExistingBriefAndScore(ctx: ReasoningContext): string {
  const lines: string[] = [];

  if (ctx.accountBrief) {
    lines.push('  ## Current Account Brief');
    lines.push(`    Summary: ${ctx.accountBrief.summary.slice(0, 500)}`);
    lines.push(`    Themes: ${ctx.accountBrief.themes}`);
    lines.push(`    Risks: ${ctx.accountBrief.risks}`);
    lines.push(`    Recommendations: ${ctx.accountBrief.recommendations}`);
    lines.push(`    Confidence: ${Math.round(ctx.accountBrief.confidence * 100)}%`);
  } else {
    lines.push('  ## Current Account Brief: Not available');
  }

  if (ctx.accountScore) {
    lines.push('  ## Account Score');
    lines.push(`    Score: ${ctx.accountScore.score}/100 (${ctx.accountScore.category})`);
    lines.push(`    Breakdown: ${ctx.accountScore.scoreBreakdown}`);
  } else {
    lines.push('  ## Account Score: Not available');
  }

  return lines.join('\n');
}

/**
 * Formats data quality metrics.
 */
function formatDataQuality(ctx: ReasoningContext): string {
  return [
    '  ## Data Quality Metrics',
    `    Total Knowledge Entries: ${ctx.dataQualityMetrics.totalKnowledgeEntries}`,
    `    Average Confidence: ${Math.round(ctx.dataQualityMetrics.avgConfidence * 100)}%`,
    `    Recent Entries (90 days): ${ctx.dataQualityMetrics.recentEntryCount}`,
    `    Source Health (avg): ${Math.round(ctx.dataQualityMetrics.sourceHealthAvg * 100)}%`,
    `    Total Intelligence Objects: ${ctx.intelligenceObjects.length}`,
    `    Total Signals: ${ctx.signals.length}`,
    `    Total Opportunity Signals: ${ctx.opportunitySignals.length}`,
    `    Total Evidence Items: ${ctx.evidence.length}`,
    `    Total Associations: ${ctx.associations.length}`,
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Builds the system + user prompts for strategic insight generation.
 *
 * The system prompt establishes the analyst persona and grounding rules.
 * The user prompt structures ALL available intelligence data and asks
 * the LLM to identify the dominant strategic pattern.
 */
export function buildReasoningPrompt(
  ctx: ReasoningContext
): { system: string; user: string } {
  const system = `You are a strategic intelligence analyst for an enterprise B2B sales organization. Your role is to analyze company intelligence data and synthesize actionable strategic insights.

CRITICAL RULES:
1. Only cite evidence that EXISTS in the provided data. Use the exact [id] references shown.
2. Never invent facts, numbers, dates, or source names not present in the input.
3. Be specific: reference actual data points, signal types, confidence scores, and source names.
4. If data is insufficient to draw a conclusion, state this explicitly — do not speculate.
5. Confidence scores must reflect the quality and quantity of underlying evidence.
6. Key themes must be directly observable in the provided intelligence data.

OUTPUT FORMAT: Return valid JSON matching this exact schema:
{
  "insightType": "STRATEGIC_SHIFT" | "OPPORTUNITY" | "RISK" | "PATTERN_EMERGED",
  "summary": "2-3 sentence narrative summary (50-500 characters)",
  "keyThemes": ["theme1", "theme2", ...],
  "reasoningSummary": {
    "observations": ["observation1", "observation2", ...],
    "interpretation": "your analytical interpretation",
    "confidenceFactors": ["factor1", "factor2", ...]
  },
  "supportingEvidence": [
    {"evidenceId": "exact-id-from-data", "relevance": "why relevant", "quote": "verbatim excerpt"}
  ],
  "confidenceScore": 0-100
}`;

  const user = [
    `# COMPANY: ${ctx.companyName}`,
    `Industry: ${ctx.industry ?? 'Unknown'}`,
    `Size: ${ctx.sizeRange ?? 'Unknown'}`,
    '',
    '## Knowledge Entries (grouped by category)',
    formatKnowledgeByCategory(ctx),
    '',
    formatIntelligenceObjects(ctx),
    '',
    formatSignals(ctx),
    '',
    formatEvidence(ctx),
    '',
    formatExistingBriefAndScore(ctx),
    '',
    formatDataQuality(ctx),
    '',
    '## TASK',
    'Analyze ALL the intelligence data above and identify the dominant strategic pattern for this company.',
    '',
    'Consider:',
    '1. What is the primary strategic direction or shift indicated by the data?',
    '2. Which themes recur across multiple intelligence sources?',
    '3. What are the strongest signals and what do they indicate?',
    '4. How does the existing account brief and score align with the intelligence?',
    '5. What is the overall data quality and how does it affect confidence?',
    '',
    'Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.',
  ].join('\n');

  return { system, user };
}

/**
 * Builds the system + user prompts for engagement strategy generation.
 *
 * Takes a completed strategic insight plus the reasoning context to produce
 * a sales-specific engagement plan.
 */
export function buildStrategyPrompt(
  ctx: ReasoningContext,
  insight: StrategicInsightOutput
): { system: string; user: string } {
  const system = `You are an enterprise sales strategist specializing in B2B account engagement. Given a company's strategic insight and intelligence data, generate an account-specific engagement strategy.

CRITICAL RULES:
1. Base ALL recommendations on the provided intelligence data. Do not hallucinate competitors, market data, or contact names.
2. Be specific about WHO to approach (role, department), WHAT to discuss, and WHAT risks to watch.
3. Conversation talking points must reference actual signals, knowledge entries, or evidence from the data.
4. Risk factors must be grounded in the intelligence — not generic sales risks.
5. Priority score (0-100) must reflect both opportunity strength and data confidence.

OUTPUT FORMAT: Return valid JSON matching this exact schema:
{
  "situationAssessment": {
    "currentPhase": "e.g. exploration, active_evaluation, procurement, renewal",
    "keyDrivers": ["driver1", "driver2", ...],
    "maturityLevel": "early|mid|late"
  },
  "recommendedEntry": {
    "role": "e.g. VP of Engineering, CTO, Director of Product",
    "rationale": "why this role based on data",
    "department": "e.g. Engineering, Product, Operations"
  },
  "firstMeetingObjective": "discovery" | "technical" | "executive_alignment",
  "conversationAngles": [
    {"angle": "angle name", "talkingPoints": ["point1", "point2", ...]}
  ],
  "riskFactors": [
    {"risk": "description", "severity": "low|medium|high|critical", "mitigation": "how to handle"}
  ],
  "priorityScore": 0-100
}`;

  const user = [
    `# COMPANY: ${ctx.companyName}`,
    `Industry: ${ctx.industry ?? 'Unknown'}`,
    `Size: ${ctx.sizeRange ?? 'Unknown'}`,
    '',
    '## Strategic Insight',
    `Type: ${insight.insightType}`,
    `Summary: ${insight.summary}`,
    `Confidence: ${insight.confidenceScore}/100`,
    `Key Themes: ${insight.keyThemes.join(', ')}`,
    `Observations: ${insight.reasoningSummary.observations.join('; ')}`,
    `Interpretation: ${insight.reasoningSummary.interpretation}`,
    '',
    '## Key Signals',
    formatSignals(ctx),
    '',
    '## Top Knowledge Themes',
    formatKnowledgeByCategory(ctx),
    '',
    formatExistingBriefAndScore(ctx),
    '',
    formatDataQuality(ctx),
    '',
    '## TASK',
    'Based on the strategic insight and intelligence data above, generate an engagement strategy for this account.',
    '',
    'Your strategy should:',
    '1. Assess the current buying phase and what is driving it.',
    '2. Identify the best entry point (role, department) with rationale.',
    '3. Define the first meeting objective and conversation angles.',
    '4. Flag risks specific to this account based on evidence.',
    '5. Score the priority (0-100) based on opportunity + data confidence.',
    '',
    'Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.',
  ].join('\n');

  return { system, user };
}

/**
 * Builds the system + user prompts for executive brief enhancement.
 *
 * Takes the existing account brief and a strategic insight to produce
 * a richer narrative for senior sales leadership.
 */
export function buildBriefEnhancementPrompt(
  ctx: ReasoningContext,
  insight: StrategicInsightOutput
): { system: string; user: string } {
  const system = `You are writing an executive intelligence brief for a senior sales leader. Your task is to enhance an existing account brief with deeper strategic narrative, key takeaways, and actionable implications.

CRITICAL RULES:
1. Enhance based on the provided intelligence data ONLY. Do not add outside information.
2. Be concise: narrative should be 200-1000 characters. Bullet points over prose.
3. Be specific: reference actual signals, knowledge entries, and evidence IDs.
4. Be actionable: every implication must have a concrete action.
5. Do not duplicate the existing brief — build upon it with new analytical depth.

OUTPUT FORMAT: Return valid JSON matching this exact schema:
{
  "narrative": "Enhanced 200-1000 character strategic narrative",
  "keyTakeaways": ["takeaway1", "takeaway2", ...],
  "strategicImplications": [
    {"implication": "what this means", "impact": "high|medium|low", "action": "what to do"}
  ]
}`;

  const user = [
    `# COMPANY: ${ctx.companyName}`,
    `Industry: ${ctx.industry ?? 'Unknown'}`,
    `Size: ${ctx.sizeRange ?? 'Unknown'}`,
    '',
    '## Existing Account Brief',
    ...(ctx.accountBrief
      ? [
          `Summary: ${ctx.accountBrief.summary}`,
          `Themes: ${ctx.accountBrief.themes}`,
          `Risks: ${ctx.accountBrief.risks}`,
          `Recommendations: ${ctx.accountBrief.recommendations}`,
        ]
      : ['(No existing brief available)']),
    '',
    '## Strategic Insight',
    `Type: ${insight.insightType}`,
    `Summary: ${insight.summary}`,
    `Confidence: ${insight.confidenceScore}/100`,
    `Themes: ${insight.keyThemes.join(', ')}`,
    `Interpretation: ${insight.reasoningSummary.interpretation}`,
    '',
    '## Supporting Intelligence',
    formatSignals(ctx),
    '',
    formatKnowledgeByCategory(ctx),
    '',
    '## TASK',
    'Enhance the account brief for a senior sales leader. Provide:',
    '1. A strategic narrative that connects the insight to business opportunity.',
    '2. 3-6 key takeaways that are immediately actionable.',
    '3. Strategic implications with impact level and concrete actions.',
    '',
    'Return ONLY valid JSON. No markdown, no code blocks, no explanatory text.',
  ].join('\n');

  return { system, user };
}
