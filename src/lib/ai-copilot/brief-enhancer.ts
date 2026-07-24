// ── Phase 8: AI Brief Enhancer ──
// Enhances existing rule-generated AccountBrief with AI-generated strategic narrative,
// key takeaways, and strategic implications. Uses LLM to produce a deeper, more
// actionable executive brief based on strategic insight + raw intelligence data.

import { db } from '@/lib/db';
import { extractJSON } from '@/lib/zai-helpers';
import { governedAICall } from '@/lib/ai-governance';
import type {
  ReasoningContext,
  StrategicInsightOutput,
  EnhancedBriefOutput,
} from './types';
import { parseBriefResponse } from './response-parser';
import { logAIUsage } from './usage-tracker';

/* ── Prompt Construction ── */

function buildBriefEnhancementPrompt(
  ctx: ReasoningContext,
  insight: StrategicInsightOutput
): { system: string; user: string } {
  const system = [
    'You are writing an executive intelligence brief for a senior sales leader about to meet with a prospect.',
    'Your task is to enhance the existing account brief with deeper strategic narrative, key takeaways, and strategic implications.',
    '',
    'RULES (MANDATORY):',
    '1. Only reference facts from the provided intelligence data. Never invent or assume information.',
    '2. Be specific and actionable — every sentence should add value.',
    '3. Write in a professional but direct tone. No filler or hedging language.',
    '4. Every takeaway MUST be supported by evidence from the data.',
    '5. Every strategic implication must include a concrete action the sales team can take.',
    '6. The narrative should be 300-500 words, written as a coherent strategic assessment.',
    '',
    'OUTPUT FORMAT: Return valid JSON with exactly this structure:',
    '{',
    '  "narrative": "<300-500 word strategic narrative>",',
    '  "keyTakeaways": ["<takeaway 1>", "<takeaway 2>", ...],  // 5-7 items',
    '  "strategicImplications": [',
    '    {"implication": "<what this means>", "impact": "<why it matters>", "action": "<what to do>"}',
    '  ]  // 3-5 items',
    '}',
  ].join('\n');

  // Gather top intelligence data points
  const topKnowledge = ctx.knowledgeEntries
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15)
    .map((e, i) => `${i + 1}. [${e.category}] ${e.content} (confidence: ${(e.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  const topSignals = ctx.opportunitySignals
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s, i) => `${i + 1}. [${s.signalType}] ${s.title} (score: ${s.score}, confidence: ${(s.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  const topEvidence = ctx.evidence
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)
    .map((e, i) => `${i + 1}. "${e.snippet}" (relevance: ${(e.relevanceScore * 100).toFixed(0)}%)`)
    .join('\n');

  const briefSummary = ctx.accountBrief?.summary || 'No existing brief available.';
  const scoreInfo = ctx.accountScore
    ? `Account score: ${ctx.accountScore.score}/100 (${ctx.accountScore.category})`
    : 'No account score available.';
  const dataQuality = `Total knowledge entries: ${ctx.dataQualityMetrics.totalKnowledgeEntries}, Average confidence: ${(ctx.dataQualityMetrics.avgConfidence * 100).toFixed(0)}%, Recent entries (90d): ${ctx.dataQualityMetrics.recentEntryCount}`;

  const user = [
    `## Company: ${ctx.companyName}`,
    `Industry: ${ctx.industry || 'Unknown'}`,
    `Size: ${ctx.sizeRange || 'Unknown'}`,
    '',
    `## Strategic Insight`,
    `Type: ${insight.insightType}`,
    `Summary: ${insight.summary}`,
    `Key Themes: ${insight.keyThemes.join(', ')}`,
    `Confidence: ${insight.confidenceScore}/100`,
    '',
    `## Existing Account Brief`,
    briefSummary,
    scoreInfo,
    dataQuality,
    '',
    `## Top Intelligence Data (${ctx.knowledgeEntries.length} total entries)`,
    topKnowledge || 'No knowledge entries available.',
    '',
    `## Revenue Opportunity Signals (${ctx.opportunitySignals.length} total)`,
    topSignals || 'No opportunity signals available.',
    '',
    `## Key Evidence (${ctx.evidence.length} total)`,
    topEvidence || 'No evidence available.',
  ].join('\n');

  return { system, user };
}

/* ── Core Functions ── */

export async function enhanceBrief(
  companyId: string,
  insight: StrategicInsightOutput,
  ctx: ReasoningContext
): Promise<{
  narrative: string;
  keyTakeaways: string[];
  strategicImplications: Array<{ implication: string; impact: string; action: string }>;
  modelUsed: string;
}> {
  console.log(`[ai-copilot:brief-enhancer] Enhancing brief for company ${companyId}`);

  const startTime = Date.now();
  let modelUsed = 'unknown';

  try {
    // Build the prompt
    const { system, user } = buildBriefEnhancementPrompt(ctx, insight);

    // Call LLM via governance layer
    const governed = await governedAICall({
      generationType: 'ai_brief_enhancement',
      companyId,
      systemPrompt: system,
      userPrompt: user,
    });
    const rawResponse = governed.response || '';
    modelUsed = 'llm';

    // Estimate tokens (rough approximation)
    const promptTokens = Math.ceil((system.length + user.length) / 4);
    const completionTokens = Math.ceil(rawResponse.length / 4);

    // Parse response
    const parsed = parseBriefResponse(rawResponse);
    if (!parsed) {
      throw new Error('Failed to parse brief enhancement response from LLM');
    }

    // Log usage
    await logAIUsage({
      companyId,
      feature: 'BRIEF_ENHANCEMENT',
      model: modelUsed,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: 0, // Estimated by usage-tracker
      status: 'success',
    });

    // Update existing AccountBrief — map enhanced fields to existing schema columns
    const briefNarrative = `## Strategic Narrative\n${parsed.narrative}\n\n## Key Takeaways\n${parsed.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n## Strategic Implications\n${parsed.strategicImplications.map(s => `• ${s.implication}: ${s.action}`).join('\n')}`;

    const mergedThemes = (() => {
      try {
        const existing = ctx.accountBrief?.themes ? JSON.parse(ctx.accountBrief.themes) : [];
        return JSON.stringify([...(Array.isArray(existing) ? existing : []), ...parsed.keyTakeaways.slice(0, 5)]);
      } catch {
        return JSON.stringify(parsed.keyTakeaways.slice(0, 5));
      }
    })();

    const mergedRisks = (() => {
      try {
        const existing = ctx.accountBrief?.risks ? JSON.parse(ctx.accountBrief.risks) : [];
        const newRisks = parsed.strategicImplications
          .filter(s => s.impact.toLowerCase().includes('risk') || s.impact.toLowerCase().includes('threat'))
          .map(s => s.implication);
        return JSON.stringify([...(Array.isArray(existing) ? existing : []), ...newRisks]);
      } catch {
        return JSON.stringify([]);
      }
    })();

    await db.accountBrief.upsert({
      where: { companyId },
      create: {
        companyId,
        summary: briefNarrative,
        confidence: ctx.accountBrief?.confidence || 0.5,
        themes: mergedThemes,
        risks: mergedRisks,
        recommendedEngagement: parsed.strategicImplications[0]?.action || ctx.accountBrief?.recommendations || 'Not determined',
        generatedBy: 'HYBRID',
      },
      update: {
        summary: briefNarrative,
        themes: mergedThemes,
        risks: mergedRisks,
        recommendedEngagement: parsed.strategicImplications[0]?.action || ctx.accountBrief?.recommendations || 'Not determined',
        generatedBy: 'HYBRID',
      },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[ai-copilot:brief-enhancer] Brief enhanced in ${elapsed}ms. Narrative: ${parsed.narrative.length} chars.`);

    return {
      narrative: parsed.narrative,
      keyTakeaways: parsed.keyTakeaways,
      strategicImplications: parsed.strategicImplications,
      modelUsed,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[ai-copilot:brief-enhancer] Failed after ${elapsed}ms: ${message}`);

    // Log failed usage
    await logAIUsage({
      companyId,
      feature: 'BRIEF_ENHANCEMENT',
      model: modelUsed,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      status: 'failed',
      errorMessage: message,
    }).catch(() => {
      // Best effort logging
    });

    throw new Error(`Brief enhancement failed for company ${companyId}: ${message}`);
  }
}

/**
 * Get the current AI-enhanced brief for a company.
 */
export async function getEnhancedBrief(companyId: string) {
  return db.accountBrief.findUnique({
    where: { companyId },
    select: {
      id: true,
      summary: true,
      themes: true,
      risks: true,
      recommendedEngagement: true,
      evidenceReferences: true,
      generatedBy: true,
      generatedAt: true,
      confidence: true,
      opportunityAreas: true,
    },
  });
}
