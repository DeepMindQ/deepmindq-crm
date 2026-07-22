/**
 * AI Revenue Copilot — Response Parser
 *
 * Parses LLM JSON output with strict validation and sanitization.
 * Each parser:
 * 1. Extracts JSON from the raw LLM response (handles markdown code blocks).
 * 2. Validates the structure against the expected schema.
 * 3. Sanitizes all strings (truncates, strips HTML, removes XSS vectors).
 * 4. Clamps numeric values to valid ranges.
 * 5. Returns null if parsing or validation fails — never throws.
 *
 * Design principle: be liberal in what we accept from the LLM but strict
 * in what we pass to downstream consumers. Every string is sanitized,
 * every number is bounded.
 */

import { extractJSON } from '@/lib/zai-helpers';
import type {
  StrategicInsightOutput,
  EngagementStrategyOutput,
  EnhancedBriefOutput,
  InsightType,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  SANITIZATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strips HTML tags, angle brackets, and truncates to maxLength.
 * Returns an empty string if input is not a string or is empty after sanitization.
 */
export function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') {
    if (input === null || input === undefined) return '';
    return sanitizeString(String(input), maxLength);
  }

  let sanitized = input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>]/g, '') // Remove stray angle brackets
    .replace(/&[^;\s]+;/g, '') // Remove HTML entities
    .replace(/javascript:/gi, '') // Remove JS protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim() + '…';
  }

  return sanitized;
}

/**
 * Clamps a confidence score to the 0-100 range.
 * Returns 0 for NaN, negative, or non-numeric values.
 */
export function validateConfidenceScore(score: number): number {
  if (typeof score !== 'number' || !isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Clamps a priority score to the 0-100 range.
 * Returns 0 for NaN, negative, or non-numeric values.
 */
export function validatePriorityScore(score: number): number {
  if (typeof score !== 'number' || !isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Validates an insight type string against allowed values.
 */
function validateInsightType(raw: unknown): InsightType | null {
  const validTypes: InsightType[] = [
    'STRATEGIC_SHIFT',
    'OPPORTUNITY',
    'RISK',
    'PATTERN_EMERGED',
  ];
  if (typeof raw === 'string' && validTypes.includes(raw as InsightType)) {
    return raw as InsightType;
  }
  // Case-insensitive fallback
  if (typeof raw === 'string') {
    const upper = raw.toUpperCase();
    const match = validTypes.find(v => v === upper);
    return match ?? null;
  }
  return null;
}

/**
 * Validates a meeting objective string against allowed values.
 */
function validateMeetingObjective(
  raw: unknown
): 'discovery' | 'technical' | 'executive_alignment' | null {
  const valid: Array<'discovery' | 'technical' | 'executive_alignment'> = [
    'discovery',
    'technical',
    'executive_alignment',
  ];
  if (typeof raw === 'string' && valid.includes(raw as typeof valid[number])) {
    return raw as typeof valid[number];
  }
  return null;
}

/**
 * Validates a risk severity string against allowed values.
 */
function validateSeverity(
  raw: unknown
): 'low' | 'medium' | 'high' | 'critical' | null {
  const valid: Array<'low' | 'medium' | 'high' | 'critical'> = [
    'low',
    'medium',
    'high',
    'critical',
  ];
  if (typeof raw === 'string' && valid.includes(raw as typeof valid[number])) {
    return raw as typeof valid[number];
  }
  return null;
}

/**
 * Validates an impact level string.
 */
function validateImpact(raw: unknown): 'high' | 'medium' | 'low' | null {
  const valid: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
  if (typeof raw === 'string' && valid.includes(raw as typeof valid[number])) {
    return raw as typeof valid[number];
  }
  return null;
}

/**
 * Safe array extraction from an unknown value.
 * Returns empty array if input is not an array.
 */
function safeArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  return [];
}

/**
 * Safe object extraction from an unknown value.
 * Returns null if input is not a plain object.
 */
function safeObject(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return null;
}

/**
 * Safe string extraction with sanitization.
 */
function safeString(input: unknown, maxLength: number): string {
  return sanitizeString(input, maxLength);
}

/**
 * Safe number extraction.
 */
function safeNumber(input: unknown, fallback: number = 0): number {
  if (typeof input === 'number' && isFinite(input)) return input;
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PARSERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parses LLM raw text response into a StrategicInsightOutput.
 * Returns null if the response cannot be parsed or fails validation.
 */
export function parseReasoningResponse(raw: string): StrategicInsightOutput | null {
  try {
    console.log('[ai-copilot:response-parser] Parsing reasoning response');

    const parsed = extractJSON(raw);
    if (!parsed) {
      console.warn('[ai-copilot:response-parser] No JSON found in reasoning response');
      return null;
    }

    const obj = safeObject(parsed);
    if (!obj) {
      console.warn('[ai-copilot:response-parser] Parsed JSON is not an object');
      return null;
    }

    // Validate insightType
    const insightType = validateInsightType(obj.insightType);
    if (!insightType) {
      console.warn(
        `[ai-copilot:response-parser] Invalid insightType: ${String(obj.insightType)}`
      );
      return null;
    }

    // Validate summary (50-500 chars)
    const summary = sanitizeString(obj.summary, 500);
    if (summary.length < 10) {
      console.warn('[ai-copilot:response-parser] Summary too short');
      return null;
    }

    // Validate keyThemes
    const rawThemes = safeArray(obj.keyThemes);
    const keyThemes = rawThemes
      .slice(0, 10)
      .map(t => sanitizeString(t, 100))
      .filter(t => t.length > 0);

    // Validate reasoningSummary
    const rawReasoning = safeObject(obj.reasoningSummary);
    if (!rawReasoning) {
      console.warn('[ai-copilot:response-parser] Missing reasoningSummary');
      return null;
    }

    const observations = safeArray(rawReasoning.observations)
      .slice(0, 20)
      .map(o => sanitizeString(o, 300))
      .filter(o => o.length > 0);

    const interpretation = sanitizeString(rawReasoning.interpretation, 1000);

    const confidenceFactors = safeArray(rawReasoning.confidenceFactors)
      .slice(0, 10)
      .map(f => sanitizeString(f, 200))
      .filter(f => f.length > 0);

    // Validate supportingEvidence
    const rawEvidence = safeArray(obj.supportingEvidence);
    const supportingEvidence = rawEvidence
      .slice(0, 10)
      .map(ev => {
        const evObj = safeObject(ev);
        if (!evObj) return null;
        const evidenceId = sanitizeString(evObj.evidenceId, 100);
        const relevance = sanitizeString(evObj.relevance, 200);
        const quote = sanitizeString(evObj.quote, 300);
        if (!evidenceId) return null;
        return { evidenceId, relevance, quote };
      })
      .filter((ev): ev is NonNullable<typeof ev> => ev !== null);

    // Validate confidenceScore
    const confidenceScore = validateConfidenceScore(safeNumber(obj.confidenceScore));

    const result: StrategicInsightOutput = {
      insightType,
      summary,
      keyThemes,
      reasoningSummary: {
        observations,
        interpretation,
        confidenceFactors,
      },
      supportingEvidence,
      confidenceScore,
    };

    console.log(
      `[ai-copilot:response-parser] Successfully parsed reasoning insight (type=${insightType}, confidence=${confidenceScore})`
    );
    return result;
  } catch (err) {
    console.error(
      '[ai-copilot:response-parser] Error parsing reasoning response:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Parses LLM raw text response into an EngagementStrategyOutput.
 * Returns null if the response cannot be parsed or fails validation.
 */
export function parseStrategyResponse(raw: string): EngagementStrategyOutput | null {
  try {
    console.log('[ai-copilot:response-parser] Parsing strategy response');

    const parsed = extractJSON(raw);
    if (!parsed) {
      console.warn('[ai-copilot:response-parser] No JSON found in strategy response');
      return null;
    }

    const obj = safeObject(parsed);
    if (!obj) {
      console.warn('[ai-copilot:response-parser] Parsed JSON is not an object');
      return null;
    }

    // Validate situationAssessment
    const rawSituation = safeObject(obj.situationAssessment);
    if (!rawSituation) {
      console.warn('[ai-copilot:response-parser] Missing situationAssessment');
      return null;
    }

    const currentPhase = sanitizeString(rawSituation.currentPhase, 100);
    const keyDrivers = safeArray(rawSituation.keyDrivers)
      .slice(0, 10)
      .map(d => sanitizeString(d, 150))
      .filter(d => d.length > 0);
    const maturityLevel = sanitizeString(rawSituation.maturityLevel, 50);

    // Validate recommendedEntry
    const rawEntry = safeObject(obj.recommendedEntry);
    if (!rawEntry) {
      console.warn('[ai-copilot:response-parser] Missing recommendedEntry');
      return null;
    }

    const role = sanitizeString(rawEntry.role, 100);
    const rationale = sanitizeString(rawEntry.rationale, 300);
    const department = sanitizeString(rawEntry.department, 100);

    // Validate firstMeetingObjective
    const firstMeetingObjective = validateMeetingObjective(obj.firstMeetingObjective);
    if (!firstMeetingObjective) {
      console.warn(
        `[ai-copilot:response-parser] Invalid firstMeetingObjective: ${String(obj.firstMeetingObjective)}`
      );
      return null;
    }

    // Validate conversationAngles
    const rawAngles = safeArray(obj.conversationAngles);
    const conversationAngles = rawAngles
      .slice(0, 8)
      .map(angle => {
        const angleObj = safeObject(angle);
        if (!angleObj) return null;
        const a = sanitizeString(angleObj.angle, 100);
        const talkingPoints = safeArray(angleObj.talkingPoints)
          .slice(0, 6)
          .map(tp => sanitizeString(tp, 200))
          .filter(tp => tp.length > 0);
        if (!a || talkingPoints.length === 0) return null;
        return { angle: a, talkingPoints };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // Validate riskFactors
    const rawRisks = safeArray(obj.riskFactors);
    const riskFactors = rawRisks
      .slice(0, 10)
      .map(risk => {
        const riskObj = safeObject(risk);
        if (!riskObj) return null;
        const r = sanitizeString(riskObj.risk, 200);
        const severity = validateSeverity(riskObj.severity) ?? 'medium';
        const mitigation = sanitizeString(riskObj.mitigation, 200);
        if (!r) return null;
        return { risk: r, severity, mitigation };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Validate priorityScore
    const priorityScore = validatePriorityScore(safeNumber(obj.priorityScore));

    const result: EngagementStrategyOutput = {
      situationAssessment: {
        currentPhase,
        keyDrivers,
        maturityLevel,
      },
      recommendedEntry: {
        role,
        rationale,
        department,
      },
      firstMeetingObjective,
      conversationAngles,
      riskFactors,
      priorityScore,
    };

    console.log(
      `[ai-copilot:response-parser] Successfully parsed strategy (priority=${priorityScore}, objective=${firstMeetingObjective})`
    );
    return result;
  } catch (err) {
    console.error(
      '[ai-copilot:response-parser] Error parsing strategy response:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Parses LLM raw text response into an EnhancedBriefOutput.
 * Returns null if the response cannot be parsed or fails validation.
 */
export function parseBriefResponse(raw: string): EnhancedBriefOutput | null {
  try {
    console.log('[ai-copilot:response-parser] Parsing brief response');

    const parsed = extractJSON(raw);
    if (!parsed) {
      console.warn('[ai-copilot:response-parser] No JSON found in brief response');
      return null;
    }

    const obj = safeObject(parsed);
    if (!obj) {
      console.warn('[ai-copilot:response-parser] Parsed JSON is not an object');
      return null;
    }

    // Validate narrative (200-1000 chars)
    const narrative = sanitizeString(obj.narrative, 1000);
    if (narrative.length < 50) {
      console.warn('[ai-copilot:response-parser] Narrative too short');
      return null;
    }

    // Validate keyTakeaways
    const rawTakeaways = safeArray(obj.keyTakeaways);
    const keyTakeaways = rawTakeaways
      .slice(0, 10)
      .map(t => sanitizeString(t, 200))
      .filter(t => t.length > 0);

    // Validate strategicImplications
    const rawImplications = safeArray(obj.strategicImplications);
    const strategicImplications = rawImplications
      .slice(0, 10)
      .map(imp => {
        const impObj = safeObject(imp);
        if (!impObj) return null;
        const implication = sanitizeString(impObj.implication, 300);
        const impact = validateImpact(impObj.impact) ?? 'medium';
        const action = sanitizeString(impObj.action, 200);
        if (!implication) return null;
        return { implication, impact, action };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    const result: EnhancedBriefOutput = {
      narrative,
      keyTakeaways,
      strategicImplications,
    };

    console.log(
      `[ai-copilot:response-parser] Successfully parsed brief (narrative=${narrative.length} chars, takeaways=${keyTakeaways.length})`
    );
    return result;
  } catch (err) {
    console.error(
      '[ai-copilot:response-parser] Error parsing brief response:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
