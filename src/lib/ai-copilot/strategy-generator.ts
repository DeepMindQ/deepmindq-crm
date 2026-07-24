/**
 * AI Revenue Copilot — Engagement Strategy Generator
 *
 * Generates an account-specific engagement strategy by:
 * 1. Building prompts from the strategic insight + reasoning context
 * 2. Calling the LLM via the governance layer
 * 3. Parsing, validating, and sanitizing the response
 * 4. Persisting to AIEngagementStrategy table
 * 5. Logging AI usage for cost tracking
 *
 * Also provides read helpers for strategy history.
 */

import { db } from '@/lib/db';
import { extractJSON } from '@/lib/zai-helpers';
import { governedAICall } from '@/lib/ai-governance';
import { buildStrategyPrompt } from './prompt-builder';
import type {
  ReasoningContext,
  StrategicInsightOutput,
  EngagementStrategyOutput,
  AIUsageFeature,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_OBJECTIVES = new Set<string>([
  'discovery',
  'technical',
  'executive_alignment',
]);

const VALID_SEVERITIES = new Set<string>([
  'low',
  'medium',
  'high',
  'critical',
]);

const DEFAULT_MODEL = 'gemini-2.0-flash';
const FEATURE: AIUsageFeature = 'STRATEGY';

/** Expiry window for generated strategies (7 days) */
const STRATEGY_EXPIRY_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════════
//  Sanitization helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Strip HTML tags, trim, and optionally truncate. */
function sanitizeString(str: unknown, maxLen = 2000): string {
  if (typeof str !== 'string') return '';
  const cleaned = str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned;
}

/** Clamp a number to [min, max]. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/** Validate and sanitize the firstMeetingObjective enum. */
function sanitizeObjective(raw: unknown): 'discovery' | 'technical' | 'executive_alignment' {
  if (typeof raw === 'string' && VALID_OBJECTIVES.has(raw)) {
    return raw as 'discovery' | 'technical' | 'executive_alignment';
  }
  return 'discovery';
}

/** Validate and sanitize severity. */
function sanitizeSeverity(raw: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (typeof raw === 'string' && VALID_SEVERITIES.has(raw)) {
    return raw as 'low' | 'medium' | 'high' | 'critical';
  }
  return 'medium';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Usage logging
// ═══════════════════════════════════════════════════════════════════════════════

async function logUsage(
  companyId: string,
  model: string,
  status: 'success' | 'failed' | 'rate_limited',
  errorMessage?: string,
): Promise<void> {
  try {
    await db.aIGenerationAudit.create({
      data: {
        companyId,
        generationType: FEATURE,
        modelUsed: model,
        outputSummary: `Engagement strategy generated (status: ${status})`,
        governancePassed: status === 'success',
        inputParams: JSON.stringify({}),
      },
    });
  } catch (err) {
    // Usage logging must never break the main flow
    console.error('[ai-copilot:strategy] Failed to log AI usage', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LLM response parsing and validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse raw LLM output into a validated EngagementStrategyOutput.
 * Returns null if the output cannot be parsed into a valid strategy.
 */
function parseAndValidate(raw: string): EngagementStrategyOutput | null {
  const parsed = extractJSON(raw);
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[ai-copilot:strategy] LLM output is not valid JSON', { rawLength: raw.length });
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Validate situationAssessment
  const rawSA = obj.situationAssessment;
  if (!rawSA || typeof rawSA !== 'object') return null;
  const sa = rawSA as Record<string, unknown>;

  const keyDrivers = Array.isArray(sa.keyDrivers)
    ? sa.keyDrivers.filter((d: unknown) => typeof d === 'string').map((d: string) => sanitizeString(d, 200)).slice(0, 10)
    : [];

  // Validate recommendedEntry
  const rawRE = obj.recommendedEntry;
  if (!rawRE || typeof rawRE !== 'object') return null;
  const re = rawRE as Record<string, unknown>;

  // Validate conversationAngles
  const rawAngles = obj.conversationAngles;
  if (!Array.isArray(rawAngles) || rawAngles.length < 2) return null;

  const conversationAngles = rawAngles
    .filter((a: unknown) => a && typeof a === 'object' && typeof (a as Record<string, unknown>).angle === 'string')
    .slice(0, 8)
    .map((a: unknown) => {
      const angle = a as Record<string, unknown>;
      const talkingPoints = Array.isArray(angle.talkingPoints)
        ? angle.talkingPoints
            .filter((tp: unknown) => typeof tp === 'string')
            .map((tp: string) => sanitizeString(tp, 300))
            .slice(0, 8)
        : [];
      return {
        angle: sanitizeString(angle.angle, 200),
        talkingPoints,
      };
    });

  if (conversationAngles.length < 2) return null;

  // Validate riskFactors — must have at least 1
  const rawRisks = obj.riskFactors;
  const riskFactors = Array.isArray(rawRisks)
    ? rawRisks
        .filter((r: unknown) => r && typeof r === 'object' && typeof (r as Record<string, unknown>).risk === 'string')
        .slice(0, 10)
        .map((r: unknown) => {
          const risk = r as Record<string, unknown>;
          return {
            risk: sanitizeString(risk.risk, 500),
            severity: sanitizeSeverity(risk.severity),
            mitigation: sanitizeString(risk.mitigation, 500),
          };
        })
    : [];

  const strategy: EngagementStrategyOutput = {
    situationAssessment: {
      currentPhase: sanitizeString(sa.currentPhase, 100),
      keyDrivers,
      maturityLevel: sanitizeString(sa.maturityLevel, 50),
    },
    recommendedEntry: {
      role: sanitizeString(re.role, 200),
      rationale: sanitizeString(re.rationale, 1000),
      department: sanitizeString(re.department, 200),
    },
    firstMeetingObjective: sanitizeObjective(obj.firstMeetingObjective),
    conversationAngles,
    riskFactors,
    priorityScore: clampNumber(obj.priorityScore, 0, 100, 50),
  };

  return strategy;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Core: generateEngagementStrategy
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates an AI-powered engagement strategy for a company.
 *
 * Flow:
 *  1. Build prompts from insight + context
 *  2. Call LLM
 *  3. Parse, validate, sanitize response
 *  4. Persist to AIEngagementStrategy table
 *  5. Log AI usage
 *  6. Return the strategy
 *
 * @throws Error if LLM call fails or response is unparseable
 */
export async function generateEngagementStrategy(
  companyId: string,
  insight: StrategicInsightOutput,
  ctx: ReasoningContext,
): Promise<{
  strategy: EngagementStrategyOutput;
  insightId: string;
  modelUsed: string;
}> {
  const startTime = Date.now();
  console.log('[ai-copilot:strategy] Generating engagement strategy', {
    companyId,
    insightType: insight.insightType,
    confidenceScore: insight.confidenceScore,
  });

  // ── Step 1: Build prompts ──
  const { system, user } = buildStrategyPrompt(ctx, insight);

  // ── Step 2: Call LLM ──
  let rawLLMOutput: string;
  let modelUsed = DEFAULT_MODEL;

  try {
    const governed = await governedAICall({
      generationType: 'ai_strategy',
      companyId,
      systemPrompt: system,
      userPrompt: user,
    });
    rawLLMOutput = governed.response || '';
    modelUsed = DEFAULT_MODEL;
    console.log('[ai-copilot:strategy] LLM response received', {
      companyId,
      outputLength: rawLLMOutput.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ai-copilot:strategy] LLM call failed', { companyId, error: message });
    await logUsage(companyId, modelUsed, 'failed', message);
    throw new Error(`Strategy generation failed: LLM call error — ${message}`);
  }

  // ── Step 3: Parse and validate ──
  const strategy = parseAndValidate(rawLLMOutput);

  if (!strategy) {
    const errMsg = 'LLM output could not be parsed into a valid engagement strategy';
    console.error('[ai-copilot:strategy] Validation failed', {
      companyId,
      rawOutputPreview: rawLLMOutput.slice(0, 500),
    });
    await logUsage(companyId, modelUsed, 'failed', errMsg);
    throw new Error(`Strategy generation failed: ${errMsg}`);
  }

  // ── Step 4: Persist to DB ──
  // We need the insightId from the StrategicInsight that was passed in.
  // The caller should provide the DB record ID. For now, we look up the most recent.
  let insightId: string;

  try {
    const existingInsight = await db.strategicInsight.findFirst({
      where: {
        companyId,
        insightType: insight.insightType,
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (existingInsight) {
      insightId = existingInsight.id;
    } else {
      // Create the insight record so we have a FK target
      const newInsight = await db.strategicInsight.create({
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
        },
      });
      insightId = newInsight.id;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + STRATEGY_EXPIRY_DAYS);

    await db.aIEngagementStrategy.create({
      data: {
        companyId,
        strategicInsightId: insightId,
        situationAssessment: JSON.stringify(strategy.situationAssessment),
        recommendedEntry: JSON.stringify(strategy.recommendedEntry),
        firstMeetingObjective: strategy.firstMeetingObjective,
        conversationAngles: JSON.stringify(strategy.conversationAngles),
        riskFactors: JSON.stringify(strategy.riskFactors),
        priorityScore: strategy.priorityScore,
        generatedBy: 'LLM',
        modelUsed,
        expiresAt,
      },
    });

    console.log('[ai-copilot:strategy] Strategy persisted', {
      companyId,
      insightId,
      priorityScore: strategy.priorityScore,
      phase: strategy.situationAssessment.currentPhase,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ai-copilot:strategy] DB persistence failed', { companyId, error: message });
    // Still log usage as success (LLM worked), and still return the strategy.
    // The caller gets the strategy even if persistence fails.
    await logUsage(companyId, modelUsed, 'success');
    // Set insightId to empty string since we couldn't resolve it
    insightId = '';
  }

  // ── Step 5: Log usage ──
  await logUsage(companyId, modelUsed, 'success');

  const durationMs = Date.now() - startTime;
  console.log('[ai-copilot:strategy] Strategy generation complete', {
    companyId,
    insightId,
    modelUsed,
    priorityScore: strategy.priorityScore,
    durationMs,
  });

  return { strategy, insightId, modelUsed };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Read helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retrieves the most recent (non-expired) engagement strategy for a company.
 * Returns null if no strategy exists or all have expired.
 */
export async function getLatestStrategy(
  companyId: string,
): Promise<EngagementStrategyOutput | null> {
  try {
    const record = await db.aIEngagementStrategy.findFirst({
      where: {
        companyId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) {
      console.log('[ai-copilot:strategy] No active strategy found', { companyId });
      return null;
    }

    const strategy: EngagementStrategyOutput = {
      situationAssessment: safeParseJSON(record.situationAssessment, {
        currentPhase: 'unknown',
        keyDrivers: [],
        maturityLevel: 'unknown',
      }),
      recommendedEntry: safeParseJSON(record.recommendedEntry, {
        role: 'unknown',
        rationale: '',
        department: 'unknown',
      }),
      firstMeetingObjective: sanitizeObjective(record.firstMeetingObjective),
      conversationAngles: safeParseJSONArray(record.conversationAngles),
      riskFactors: safeParseJSONArray(record.riskFactors),
      priorityScore: clampNumber(record.priorityScore, 0, 100, 0),
    };

    console.log('[ai-copilot:strategy] Retrieved latest strategy', {
      companyId,
      strategyId: record.id,
      priorityScore: strategy.priorityScore,
    });

    return strategy;
  } catch (err) {
    console.error('[ai-copilot:strategy] Failed to retrieve latest strategy', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Retrieves the engagement strategy history for a company.
 * Returns most recent strategies first.
 */
export async function getStrategyHistory(
  companyId: string,
  limit: number = 10,
): Promise<Array<EngagementStrategyOutput & { id: string; generatedAt: Date; modelUsed: string | null }>> {
  try {
    const records = await db.aIEngagementStrategy.findMany({
      where: { companyId },
      orderBy: { generatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return records.map((record) => {
      const strategy: EngagementStrategyOutput & { id: string; generatedAt: Date; modelUsed: string | null } = {
        id: record.id,
        situationAssessment: safeParseJSON(record.situationAssessment, {
          currentPhase: 'unknown',
          keyDrivers: [],
          maturityLevel: 'unknown',
        }),
        recommendedEntry: safeParseJSON(record.recommendedEntry, {
          role: 'unknown',
          rationale: '',
          department: 'unknown',
        }),
        firstMeetingObjective: sanitizeObjective(record.firstMeetingObjective),
        conversationAngles: safeParseJSONArray(record.conversationAngles),
        riskFactors: safeParseJSONArray(record.riskFactors),
        priorityScore: clampNumber(record.priorityScore, 0, 100, 0),
        generatedAt: record.generatedAt,
        modelUsed: record.modelUsed,
      };
      return strategy;
    });
  } catch (err) {
    console.error('[ai-copilot:strategy] Failed to retrieve strategy history', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JSON parse helpers (safe — never throw)
// ═══════════════════════════════════════════════════════════════════════════════

function safeParseJSON<T>(jsonStr: string, fallback: T): T {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
}

function safeParseJSONArray<T = unknown>(jsonStr: string): T[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed as T[];
    return [];
  } catch {
    return [];
  }
}
