/**
 * AI Revenue Copilot — Reasoning Engine (Main Orchestrator)
 *
 * The central orchestrator for the AI reasoning pipeline. Coordinates:
 *   1. Context gathering — queries DB for all intelligence data for a company.
 *   2. Prompt construction — builds structured prompts for the LLM.
 *   3. LLM invocation — calls through the governance layer.
 *   4. Response parsing — extracts and validates structured JSON output.
 *   5. Guardrail checking — validates output quality and grounding.
 *   6. Persistence — saves insights to the StrategicInsight table.
 *   7. Usage logging — tracks costs via AIUsageLog.
 *
 * Error handling: functions wrap errors with context and never throw
 * unhandled exceptions from library boundaries.
 */

import { db } from '@/lib/db';
import { governedAICall } from '@/lib/ai-governance';
import type {
  ReasoningContext,
  StrategicInsightOutput,
  GuardrailCheck,
} from './types';
import { buildReasoningPrompt } from './prompt-builder';
import { parseReasoningResponse } from './response-parser';
import {
  checkReasoningOutput,
  guardrailsAllowOutput,
  MIN_INTELLIGENCE_THRESHOLD,
} from './guardrails';
import { logAIUsage, estimateCost } from './usage-tracker';

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Recency window in days for counting "recent" knowledge entries. */
const RECENT_ENTRY_WINDOW_DAYS = 90;

/** Default model identifier used when the active model cannot be determined. */
const DEFAULT_MODEL = 'governed-llm';

/** Approximate characters per token for cost estimation (conservative). */
const CHARS_PER_TOKEN = 4;

/**
 * Number of days until a strategic insight expires.
 * Set to null for no expiration.
 */
const INSIGHT_EXPIRY_DAYS = 30;

// ═══════════════════════════════════════════════════════════════════════════════
//  TOKEN ESTIMATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rough token count estimation based on character length.
 * This is intentionally conservative (overestimates) for cost tracking.
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTEXT GATHERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gathers all intelligence data for a company from the database and
 * constructs a ReasoningContext with quality metrics.
 *
 * This is the foundation for all AI reasoning operations — every
 * prompt builder, guardrail, and output validator depends on this context.
 *
 * @param companyId - The company ID to gather intelligence for
 * @returns Fully populated ReasoningContext
 * @throws Error with context if the company is not found
 */
export async function gatherReasoningContext(
  companyId: string
): Promise<ReasoningContext> {
  try {
    console.log(`[ai-copilot:reasoning] Gathering context for company: ${companyId}`);

    // Validate companyId
    if (!companyId || typeof companyId !== 'string') {
      throw new Error(`Invalid companyId: ${String(companyId)}`);
    }

    // Fetch company basic info
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        normalizedName: true,
        industry: true,
        sizeRange: true,
      },
    });

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // Fetch all intelligence data in parallel
    const [
      knowledgeEntries,
      intelligenceObjects,
      associations,
      signals,
      opportunitySignals,
      evidence,
      accountBrief,
      accountScore,
      sourceHealthRecords,
    ] = await Promise.all([
      // Knowledge entries (active, most recent first)
      db.knowledgeEntry.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          category: true,
          content: true,
          source: true,
          confidence: true,
          updatedAt: true,
        },
      }),

      // Intelligence objects (active status)
      db.intelligenceObject.findMany({
        where: { companyId, status: { in: ['new', 'active', 'processing'] } },
        orderBy: { capturedAt: 'desc' },
        select: {
          id: true,
          content: true,
          summary: true,
          originalConfidence: true,
          sourceType: true,
          capturedAt: true,
        },
      }),

      // Intelligence associations
      db.intelligenceAssociation.findMany({
        where: { companyId },
        select: {
          id: true,
          associationType: true,
          sourceId: true,
          targetId: true,
          confidence: true,
          metadata: true,
        },
      }),

      // Company signals (non-archived)
      db.companySignal.findMany({
        where: {
          companyId,
          status: { notIn: ['archived', 'expired'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          signalType: true,
          title: true,
          confidence: true,
          severity: true,
          createdAt: true,
        },
      }),

      // Opportunity signals (active/validated)
      db.opportunitySignal.findMany({
        where: {
          companyId,
          status: { in: ['new', 'validated'] },
        },
        orderBy: { score: 'desc' },
        select: {
          id: true,
          signalType: true,
          title: true,
          score: true,
          confidence: true,
        },
      }),

      // Evidence items (active)
      db.evidence.findMany({
        where: {
          companyId,
          status: { in: ['active', 'aging'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          snippet: true,
          extractedField: true,
          relevanceScore: true,
          confidence: true,
        },
      }),

      // Account brief (if exists)
      db.accountBrief.findUnique({
        where: { companyId },
        select: {
          summary: true,
          themes: true,
          risks: true,
          recommendedEngagement: true,
          evidenceReferences: true,
          confidence: true,
        },
      }),

      // Latest account score
      db.accountScore.findFirst({
        where: { companyId },
        orderBy: { calculatedAt: 'desc' },
        select: {
          score: true,
          category: true,
          scoreBreakdown: true,
        },
      }),

      // Source health (for data quality metrics)
      db.sourceHealth.findMany({
        select: {
          healthScore: true,
        },
      }),
    ]);

    // Calculate data quality metrics
    const totalKnowledgeEntries = knowledgeEntries.length;

    const avgConfidence =
      totalKnowledgeEntries > 0
        ? knowledgeEntries.reduce((sum, e) => sum + e.confidence, 0) / totalKnowledgeEntries
        : 0;

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - RECENT_ENTRY_WINDOW_DAYS);
    const recentEntryCount = knowledgeEntries.filter(
      e => e.updatedAt >= recentCutoff
    ).length;

    const sourceHealthAvg =
      sourceHealthRecords.length > 0
        ? sourceHealthRecords.reduce((sum, s) => sum + s.healthScore, 0) / sourceHealthRecords.length
        : 0;

    // Build the context
    const ctx: ReasoningContext = {
      companyId: company.id,
      companyName: company.normalizedName,
      industry: company.industry,
      sizeRange: company.sizeRange,

      knowledgeEntries: knowledgeEntries.map(e => ({
        id: e.id,
        category: e.category,
        content: e.content,
        confidence: e.confidence,
        source: e.source,
        updatedAt: e.updatedAt,
      })),

      intelligenceObjects: intelligenceObjects.map(o => ({
        id: o.id,
        content: o.content,
        summary: o.summary,
        confidence: o.originalConfidence,
        sourceType: o.sourceType,
        capturedAt: o.capturedAt,
      })),

      associations: associations.map(a => ({
        id: a.id,
        associationType: a.associationType,
        sourceId: a.sourceId,
        targetId: a.targetId,
        confidence: a.confidence,
        metadata: a.metadata,
      })),

      signals: signals.map(s => ({
        id: s.id,
        signalType: s.signalType,
        title: s.title,
        confidence: s.confidence,
        severity: s.severity,
        createdAt: s.createdAt,
      })),

      opportunitySignals: opportunitySignals.map(o => ({
        id: o.id,
        signalType: o.signalType,
        title: o.title,
        score: o.score,
        confidence: o.confidence,
      })),

      evidence: evidence.map(e => ({
        id: e.id,
        snippet: e.snippet,
        extractedField: e.extractedField,
        relevanceScore: e.relevanceScore,
        confidence: e.confidence,
      })),

      accountBrief: accountBrief
        ? {
            summary: accountBrief.summary,
            themes: accountBrief.themes,
            risks: accountBrief.risks,
            recommendations: accountBrief.recommendedEngagement,
            confidence: accountBrief.confidence,
          }
        : null,

      accountScore: accountScore
        ? {
            score: accountScore.score,
            category: accountScore.category,
            scoreBreakdown: accountScore.scoreBreakdown,
          }
        : null,

      dataQualityMetrics: {
        totalKnowledgeEntries,
        avgConfidence,
        recentEntryCount,
        sourceHealthAvg,
      },
    };

    console.log(
      `[ai-copilot:reasoning] Context gathered: ${totalKnowledgeEntries} knowledge entries, ` +
        `${intelligenceObjects.length} intel objects, ${signals.length} signals, ` +
        `${evidence.length} evidence items, avg confidence ${Math.round(avgConfidence * 100)}%`
    );

    return ctx;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      `[ai-copilot:reasoning] Failed to gather context for ${companyId}: ${message}`
    );
    throw new Error(
      `[ai-copilot:reasoning] Context gathering failed for company ${companyId}: ${message}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STRATEGIC INSIGHT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a strategic insight for a company by orchestrating the full
 * reasoning pipeline:
 *
 *   gather context → build prompt → call LLM → parse response → run guardrails → persist
 *
 * The insight is persisted to the StrategicInsight table regardless of
 * guardrail results (warnings are informational). Only critical errors
 * prevent persistence.
 *
 * @param companyId - The company to generate an insight for
 * @returns The generated insight, guardrail results, and model used
 * @throws Error if generation fails critically (no LLM response, parse failure)
 */
export async function generateStrategicInsight(companyId: string): Promise<{
  insight: StrategicInsightOutput;
  guardrailResults: GuardrailCheck[];
  modelUsed: string;
}> {
  let startTime = Date.now();
  let modelUsed = DEFAULT_MODEL;
  let status: 'success' | 'failed' = 'success';
  let errorMessage: string | undefined;

  try {
    console.log(
      `[ai-copilot:reasoning] Generating strategic insight for company: ${companyId}`
    );

    // Step 1: Gather context
    const ctx = await gatherReasoningContext(companyId);

    // Pre-flight check: minimum data threshold
    if (ctx.dataQualityMetrics.totalKnowledgeEntries < MIN_INTELLIGENCE_THRESHOLD) {
      console.warn(
        `[ai-copilot:reasoning] Low data volume: ${ctx.dataQualityMetrics.totalKnowledgeEntries} entries ` +
          `(threshold: ${MIN_INTELLIGENCE_THRESHOLD}). Proceeding with reduced confidence expectations.`
      );
    }

    // Step 2: Build prompt
    const { system, user } = buildReasoningPrompt(ctx);

    const promptTokens = estimateTokenCount(system + user);

    // Step 3: Call LLM through governance layer
    console.log('[ai-copilot:reasoning] Calling LLM for strategic reasoning...');
    const governedResult = await governedAICall({
      generationType: 'ai_reasoning',
      companyId,
      systemPrompt: system,
      userPrompt: user,
      enforceGovernance: false, // We run our own guardrails post-generation
    });

    if (!governedResult.success || !governedResult.response) {
      const llmError =
        governedResult.rejectionReason ??
        'Governed LLM call failed with no response';
      console.error(`[ai-copilot:reasoning] ${llmError}`);
      status = 'failed';
      errorMessage = llmError;

      await logAIUsage({
        companyId,
        feature: 'REASONING',
        model: modelUsed,
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
        estimatedCost: estimateCost(modelUsed, promptTokens, 0),
        status,
        errorMessage,
      });

      throw new Error(llmError);
    }

    const rawResponse = governedResult.response;
    const completionTokens = estimateTokenCount(rawResponse);
    const totalTokens = promptTokens + completionTokens;

    // Step 4: Parse response
    const insight = parseReasoningResponse(rawResponse);
    if (!insight) {
      const parseError = 'Failed to parse LLM response into valid StrategicInsightOutput';
      console.error(`[ai-copilot:reasoning] ${parseError}`);
      status = 'failed';
      errorMessage = parseError;

      // Log failed usage
      await logAIUsage({
        companyId,
        feature: 'REASONING',
        model: modelUsed,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost: estimateCost(modelUsed, promptTokens, completionTokens),
        status,
        errorMessage,
      });

      throw new Error(parseError);
    }

    // Step 5: Run guardrails
    const guardrailResults = checkReasoningOutput(insight, ctx);

    const hasErrors = guardrailResults.some(c => !c.passed && c.severity === 'error');
    if (hasErrors) {
      const errorChecks = guardrailResults.filter(c => !c.passed && c.severity === 'error');
      console.warn(
        `[ai-copilot:reasoning] Guardrail errors detected: ${errorChecks.map(c => c.rule).join(', ')}`
      );
      // Continue — insight is still persisted for audit trail
    }

    const warnings = guardrailResults.filter(c => c.severity === 'warning');
    if (warnings.length > 0) {
      console.log(
        `[ai-copilot:reasoning] Guardrail warnings: ${warnings.map(c => c.rule).join(', ')}`
      );
    }

    // Step 6: Persist to StrategicInsight
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INSIGHT_EXPIRY_DAYS);

    await db.strategicInsight.create({
      data: {
        companyId,
        insightType: insight.insightType,
        summary: insight.summary,
        keyThemes: JSON.stringify(insight.keyThemes),
        reasoningSummary: JSON.stringify(insight.reasoningSummary),
        supportingEvidence: JSON.stringify(insight.supportingEvidence),
        confidenceScore: insight.confidenceScore,
        generatedBy: 'LLM',
        modelUsed,
        expiresAt,
      },
    });

    console.log(
      `[ai-copilot:reasoning] Strategic insight persisted for company ${companyId} ` +
        `(type=${insight.insightType}, confidence=${insight.confidenceScore}, ` +
        `errors=${hasErrors ? 'yes' : 'no'})`
    );

    // Step 7: Log usage
    await logAIUsage({
      companyId,
      feature: 'REASONING',
      model: modelUsed,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: estimateCost(modelUsed, promptTokens, completionTokens),
      status: 'success',
    });

    const duration = Date.now() - startTime;
    console.log(
      `[ai-copilot:reasoning] Insight generation completed in ${duration}ms`
    );

    return {
      insight,
      guardrailResults,
      modelUsed,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      `[ai-copilot:reasoning] Strategic insight generation failed for ${companyId}: ${message}`
    );
    throw new Error(
      `[ai-copilot:reasoning] Generation failed: ${message}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INSIGHT RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retrieves the most recent strategic insight for a company.
 *
 * @param companyId - The company to look up
 * @returns The latest StrategicInsight record, or null if none exists
 */
export async function getLatestInsight(companyId: string): Promise<{
  id: string;
  companyId: string;
  insightType: string;
  summary: string;
  keyThemes: string[];
  reasoningSummary: {
    observations: string[];
    interpretation: string;
    confidenceFactors: string[];
  };
  supportingEvidence: Array<{
    evidenceId: string;
    relevance: string;
    quote: string;
  }>;
  confidenceScore: number;
  generatedBy: string;
  modelUsed: string;
  generatedAt: Date;
  expiresAt: Date | null;
} | null> {
  try {
    console.log(
      `[ai-copilot:reasoning] Fetching latest insight for company: ${companyId}`
    );

    const record = await db.strategicInsight.findFirst({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) {
      console.log(
        `[ai-copilot:reasoning] No insight found for company: ${companyId}`
      );
      return null;
    }

    // Parse JSON fields
    let keyThemes: string[] = [];
    try {
      const parsed = JSON.parse(record.keyThemes);
      if (Array.isArray(parsed)) keyThemes = parsed;
    } catch {
      /* keep empty array */
    }

    let reasoningSummary: {
      observations: string[];
      interpretation: string;
      confidenceFactors: string[];
    } = { observations: [], interpretation: '', confidenceFactors: [] };
    try {
      const parsed = JSON.parse(record.reasoningSummary);
      if (parsed && typeof parsed === 'object') {
        reasoningSummary = {
          observations: Array.isArray(parsed.observations) ? parsed.observations : [],
          interpretation: typeof parsed.interpretation === 'string' ? parsed.interpretation : '',
          confidenceFactors: Array.isArray(parsed.confidenceFactors)
            ? parsed.confidenceFactors
            : [],
        };
      }
    } catch {
      /* keep default */
    }

    let supportingEvidence: Array<{
      evidenceId: string;
      relevance: string;
      quote: string;
    }> = [];
    try {
      const parsed = JSON.parse(record.supportingEvidence);
      if (Array.isArray(parsed)) {
        supportingEvidence = parsed
          .filter(
            (e: unknown): e is { evidenceId: string; relevance: string; quote: string } =>
              e !== null &&
              typeof e === 'object' &&
              typeof (e as Record<string, unknown>).evidenceId === 'string'
          )
          .map(e => ({
            evidenceId: (e as { evidenceId: string }).evidenceId,
            relevance: (e as { relevance: string }).relevance ?? '',
            quote: (e as { quote: string }).quote ?? '',
          }));
      }
    } catch {
      /* keep empty array */
    }

    return {
      id: record.id,
      companyId: record.companyId,
      insightType: record.insightType,
      summary: record.summary,
      keyThemes,
      reasoningSummary,
      supportingEvidence,
      confidenceScore: record.confidenceScore,
      generatedBy: record.generatedBy,
      modelUsed: record.modelUsed ?? '',
      generatedAt: record.generatedAt,
      expiresAt: record.expiresAt,
    };
  } catch (err) {
    console.error(
      `[ai-copilot:reasoning] Failed to fetch latest insight for ${companyId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Retrieves the insight history for a company.
 *
 * @param companyId - The company to look up
 * @param limit - Maximum number of records to return (default: 10)
 * @returns Array of StrategicInsight records, newest first
 */
export async function getInsightHistory(
  companyId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    companyId: string;
    insightType: string;
    summary: string;
    confidenceScore: number;
    generatedBy: string;
    modelUsed: string | null;
    generatedAt: Date;
    expiresAt: Date | null;
  }>
> {
  try {
    console.log(
      `[ai-copilot:reasoning] Fetching insight history for company: ${companyId} (limit: ${limit})`
    );

    const records = await db.strategicInsight.findMany({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100), // Clamp 1-100
      select: {
        id: true,
        companyId: true,
        insightType: true,
        summary: true,
        confidenceScore: true,
        generatedBy: true,
        modelUsed: true,
        generatedAt: true,
        expiresAt: true,
      },
    });

    console.log(
      `[ai-copilot:reasoning] Found ${records.length} historical insights for company: ${companyId}`
    );

    return records;
  } catch (err) {
    console.error(
      `[ai-copilot:reasoning] Failed to fetch insight history for ${companyId}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
