/**
 * AI Revenue Copilot — Guardrails
 *
 * Validates and gates AI output quality before it reaches downstream consumers.
 * Each guardrail check returns a { passed, rule, message, severity } result.
 *
 * Checks are non-throwing: they return results for the caller to decide whether
 * to proceed, warn, or reject. Error-severity checks indicate critical failures
 * (hallucinated evidence, data corruption), while warning-severity checks flag
 * quality concerns (low data volume, borderline confidence).
 *
 * Design: every check receives both the AI output AND the original context,
 * enabling grounding verification against actual data.
 */

import type {
  GuardrailCheck,
  ReasoningContext,
  StrategicInsightOutput,
  EngagementStrategyOutput,
  EnhancedBriefOutput,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimum knowledge entries needed for reliable generation. */
export const MIN_INTELLIGENCE_THRESHOLD = 5;

/** Minimum average confidence (0-1) for reliable generation. */
export const MIN_CONFIDENCE_THRESHOLD = 0.3;

/** Maximum number of evidence citations allowed in output. */
export const MAX_EVIDENCE_CITATIONS = 10;

/** Maximum allowed insight confidence when data quality is low. */
export const LOW_DATA_MAX_CONFIDENCE = 70;

/** Minimum summary length (characters). */
export const MIN_SUMMARY_LENGTH = 50;

/** Maximum summary length (characters). */
export const MAX_SUMMARY_LENGTH = 500;

/** Minimum narrative length (characters). */
export const MIN_NARRATIVE_LENGTH = 200;

/** Maximum narrative length (characters). */
export const MAX_NARRATIVE_LENGTH = 1000;

// ═══════════════════════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Builds a set of all valid entity IDs from the context.
 * Used for evidence grounding checks.
 */
function buildValidIdSet(ctx: ReasoningContext): Set<string> {
  const ids = new Set<string>();

  for (const entry of ctx.knowledgeEntries) {
    ids.add(entry.id);
  }
  for (const obj of ctx.intelligenceObjects) {
    ids.add(obj.id);
  }
  for (const sig of ctx.signals) {
    ids.add(sig.id);
  }
  for (const opp of ctx.opportunitySignals) {
    ids.add(opp.id);
  }
  for (const ev of ctx.evidence) {
    ids.add(ev.id);
  }

  return ids;
}

/**
 * Builds a combined text corpus from all context data for theme matching.
 */
function buildContextCorpus(ctx: ReasoningContext): string {
  const parts: string[] = [];

  for (const entry of ctx.knowledgeEntries) {
    parts.push(entry.content.toLowerCase());
  }
  for (const obj of ctx.intelligenceObjects) {
    parts.push(obj.content.toLowerCase());
    if (obj.summary) parts.push(obj.summary.toLowerCase());
  }
  for (const sig of ctx.signals) {
    parts.push(sig.title.toLowerCase());
  }
  for (const opp of ctx.opportunitySignals) {
    parts.push(opp.title.toLowerCase());
  }
  for (const ev of ctx.evidence) {
    parts.push(ev.snippet.toLowerCase());
  }

  return parts.join(' ');
}

/**
 * Checks if a theme string appears as a substring in the context corpus.
 * Uses case-insensitive matching with minimal length requirements.
 */
function themeExistsInContext(theme: string, corpus: string): boolean {
  if (theme.length < 3) return true; // Too short to meaningfully check

  const normalizedTheme = theme.toLowerCase().trim();

  // Check direct substring match
  if (corpus.includes(normalizedTheme)) return true;

  // Check individual words (for multi-word themes)
  const words = normalizedTheme.split(/\s+/).filter(w => w.length >= 3);
  if (words.length === 0) return true;

  // At least 60% of significant words must appear
  const matchCount = words.filter(w => corpus.includes(w)).length;
  return matchCount / words.length >= 0.6;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REASONING OUTPUT GUARDRAILS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates a StrategicInsightOutput against the reasoning context.
 *
 * Checks performed:
 * - evidence_grounding: All supporting evidence IDs must exist in the context.
 * - confidence_calibration: Output confidence should correlate with data quality.
 * - data_sufficiency: Warning if too few knowledge entries.
 * - theme_consistency: Key themes should appear in the source data.
 * - content_length: Summary should be 50-500 characters.
 * - evidence_volume: No more than MAX_EVIDENCE_CITATIONS evidence items.
 */
export function checkReasoningOutput(
  output: StrategicInsightOutput,
  ctx: ReasoningContext
): GuardrailCheck[] {
  const checks: GuardrailCheck[] = [];
  const validIds = buildValidIdSet(ctx);
  const corpus = buildContextCorpus(ctx);

  // ── Evidence Grounding ──
  const hallucinatedIds: string[] = [];
  for (const ev of output.supportingEvidence) {
    if (!validIds.has(ev.evidenceId)) {
      hallucinatedIds.push(ev.evidenceId);
    }
  }
  if (hallucinatedIds.length > 0) {
    checks.push({
      passed: false,
      rule: 'evidence_grounding',
      message: `Hallucinated evidence IDs detected: ${hallucinatedIds.slice(0, 5).join(', ')}. These IDs do not exist in the provided intelligence data.`,
      severity: 'error',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'evidence_grounding',
      message: 'All cited evidence IDs exist in the provided intelligence data.',
      severity: 'error',
    });
  }

  // ── Confidence Calibration ──
  const totalEntries =
    ctx.knowledgeEntries.length +
    ctx.intelligenceObjects.length +
    ctx.signals.length;
  const avgConfidence = ctx.dataQualityMetrics.avgConfidence;

  // If we have very few low-confidence entries, insight confidence should be low
  if (totalEntries < MIN_INTELLIGENCE_THRESHOLD || avgConfidence < MIN_CONFIDENCE_THRESHOLD) {
    if (output.confidenceScore > LOW_DATA_MAX_CONFIDENCE) {
      checks.push({
        passed: false,
        rule: 'confidence_calibration',
        message: `Output confidence (${output.confidenceScore}) exceeds ${LOW_DATA_MAX_CONFIDENCE} despite limited data (${totalEntries} entries, avg confidence ${Math.round(avgConfidence * 100)}%). Confidence should reflect data quality.`,
        severity: 'error',
      });
    } else {
      checks.push({
        passed: true,
        rule: 'confidence_calibration',
        message: `Output confidence (${output.confidenceScore}) is appropriately calibrated for the available data quality.`,
        severity: 'warning',
      });
    }
  } else {
    checks.push({
      passed: true,
      rule: 'confidence_calibration',
      message: `Output confidence (${output.confidenceScore}) is within acceptable range for the data quality.`,
      severity: 'warning',
    });
  }

  // ── Data Sufficiency ──
  if (ctx.dataQualityMetrics.totalKnowledgeEntries < MIN_INTELLIGENCE_THRESHOLD) {
    checks.push({
      passed: true,
      rule: 'data_sufficiency',
      message: `Only ${ctx.dataQualityMetrics.totalKnowledgeEntries} knowledge entries available (threshold: ${MIN_INTELLIGENCE_THRESHOLD}). Insight may be less reliable.`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'data_sufficiency',
      message: `Sufficient data available: ${ctx.dataQualityMetrics.totalKnowledgeEntries} knowledge entries.`,
      severity: 'warning',
    });
  }

  // ── Theme Consistency ──
  const ungroundedThemes: string[] = [];
  for (const theme of output.keyThemes) {
    if (!themeExistsInContext(theme, corpus)) {
      ungroundedThemes.push(theme);
    }
  }
  if (ungroundedThemes.length > 0) {
    checks.push({
      passed: false,
      rule: 'theme_consistency',
      message: `Key themes not found in source data: ${ungroundedThemes.join(', ')}. Themes should be grounded in the intelligence data.`,
      severity: 'error',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'theme_consistency',
      message: 'All key themes are grounded in the source intelligence data.',
      severity: 'error',
    });
  }

  // ── Content Length ──
  if (output.summary.length < MIN_SUMMARY_LENGTH) {
    checks.push({
      passed: false,
      rule: 'content_length',
      message: `Summary is too short: ${output.summary.length} characters (minimum: ${MIN_SUMMARY_LENGTH}).`,
      severity: 'error',
    });
  } else if (output.summary.length > MAX_SUMMARY_LENGTH) {
    checks.push({
      passed: false,
      rule: 'content_length',
      message: `Summary is too long: ${output.summary.length} characters (maximum: ${MAX_SUMMARY_LENGTH}).`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'content_length',
      message: `Summary length is acceptable: ${output.summary.length} characters.`,
      severity: 'warning',
    });
  }

  // ── Evidence Volume ──
  if (output.supportingEvidence.length > MAX_EVIDENCE_CITATIONS) {
    checks.push({
      passed: false,
      rule: 'evidence_volume',
      message: `Too many evidence citations: ${output.supportingEvidence.length} (maximum: ${MAX_EVIDENCE_CITATIONS}).`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'evidence_volume',
      message: `Evidence citations within limit: ${output.supportingEvidence.length}/${MAX_EVIDENCE_CITATIONS}.`,
      severity: 'warning',
    });
  }

  return checks;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STRATEGY OUTPUT GUARDRAILS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates an EngagementStrategyOutput against the reasoning context.
 *
 * Checks performed:
 * - data_sufficiency: Warning if too few signals to inform strategy.
 * - content_grounding: Strategy elements should not contain hallucinated specifics.
 * - priority_calibration: Priority should reflect data confidence.
 * - structure_completeness: Required fields must be populated.
 * - risk_severity_balance: Risk factors should match signal severity.
 */
export function checkStrategyOutput(
  output: EngagementStrategyOutput,
  ctx: ReasoningContext
): GuardrailCheck[] {
  const checks: GuardrailCheck[] = [];
  const corpus = buildContextCorpus(ctx);

  // ── Data Sufficiency ──
  const totalSignals = ctx.signals.length + ctx.opportunitySignals.length;
  if (totalSignals < 2) {
    checks.push({
      passed: true,
      rule: 'data_sufficiency',
      message: `Only ${totalSignals} signals available. Strategy recommendations may be generic.`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'data_sufficiency',
      message: `Sufficient signals for strategy: ${totalSignals} signals.`,
      severity: 'warning',
    });
  }

  // ── Content Grounding ──
  const roleText = output.recommendedEntry.role.toLowerCase();
  const departmentText = output.recommendedEntry.department.toLowerCase();

  // Check if the recommended role/department is referenced in context data
  const roleGrounded =
    roleText.length < 4 ||
    corpus.includes(roleText) ||
    corpus.includes(roleText.split(' ')[0]);
  const deptGrounded =
    departmentText.length < 4 ||
    corpus.includes(departmentText) ||
    corpus.includes(departmentText.split(' ')[0]);

  if (!roleGrounded) {
    checks.push({
      passed: true,
      rule: 'content_grounding',
      message: `Recommended role "${output.recommendedEntry.role}" is not directly referenced in intelligence data. May be inferred.`,
      severity: 'warning',
    });
  }

  if (!deptGrounded) {
    checks.push({
      passed: true,
      rule: 'content_grounding',
      message: `Recommended department "${output.recommendedEntry.department}" is not directly referenced in intelligence data. May be inferred.`,
      severity: 'warning',
    });
  }

  if (roleGrounded && deptGrounded) {
    checks.push({
      passed: true,
      rule: 'content_grounding',
      message: 'Recommended role and department are grounded in intelligence data.',
      severity: 'warning',
    });
  }

  // ── Priority Calibration ──
  const avgConf = ctx.dataQualityMetrics.avgConfidence;
  const maxReasonablePriority = Math.round(avgConf * 100 + 20); // Some headroom
  if (output.priorityScore > maxReasonablePriority && avgConf < 0.5) {
    checks.push({
      passed: false,
      rule: 'priority_calibration',
      message: `Priority score (${output.priorityScore}) is disproportionately high given data confidence (${Math.round(avgConf * 100)}%). Expected max ~${maxReasonablePriority}.`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'priority_calibration',
      message: `Priority score (${output.priorityScore}) is calibrated for data quality.`,
      severity: 'warning',
    });
  }

  // ── Structure Completeness ──
  const missingFields: string[] = [];
  if (!output.recommendedEntry.role) missingFields.push('recommendedEntry.role');
  if (!output.recommendedEntry.rationale) missingFields.push('recommendedEntry.rationale');
  if (output.conversationAngles.length === 0) missingFields.push('conversationAngles');
  if (output.riskFactors.length === 0) missingFields.push('riskFactors');

  if (missingFields.length > 0) {
    checks.push({
      passed: false,
      rule: 'structure_completeness',
      message: `Missing required strategy elements: ${missingFields.join(', ')}.`,
      severity: 'error',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'structure_completeness',
      message: 'All required strategy elements are present.',
      severity: 'error',
    });
  }

  // ── Risk Severity Balance ──
  const highSeveritySignals = ctx.signals.filter(
    s => s.severity === 'high' || s.severity === 'critical'
  ).length;
  const highSeverityRisks = output.riskFactors.filter(
    r => r.severity === 'high' || r.severity === 'critical'
  ).length;

  if (highSeveritySignals > 0 && highSeverityRisks === 0) {
    checks.push({
      passed: true,
      rule: 'risk_severity_balance',
      message: `${highSeveritySignals} high/critical signals detected but no corresponding high/critical risks identified.`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'risk_severity_balance',
      message: 'Risk severity levels are balanced with signal severity.',
      severity: 'warning',
    });
  }

  return checks;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BRIEF OUTPUT GUARDRAILS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates an EnhancedBriefOutput against the reasoning context.
 *
 * Checks performed:
 * - content_length: Narrative should be 200-1000 characters.
 * - content_grounding: Takeaways should reference context data themes.
 * - structure_completeness: Required fields must be populated.
 * - data_sufficiency: Warning if brief was enhanced with limited data.
 */
export function checkBriefOutput(
  output: EnhancedBriefOutput,
  ctx: ReasoningContext
): GuardrailCheck[] {
  const checks: GuardrailCheck[] = [];
  const corpus = buildContextCorpus(ctx);

  // ── Content Length ──
  if (output.narrative.length < MIN_NARRATIVE_LENGTH) {
    checks.push({
      passed: false,
      rule: 'content_length',
      message: `Narrative is too short: ${output.narrative.length} characters (minimum: ${MIN_NARRATIVE_LENGTH}).`,
      severity: 'error',
    });
  } else if (output.narrative.length > MAX_NARRATIVE_LENGTH) {
    checks.push({
      passed: false,
      rule: 'content_length',
      message: `Narrative is too long: ${output.narrative.length} characters (maximum: ${MAX_NARRATIVE_LENGTH}).`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'content_length',
      message: `Narrative length is acceptable: ${output.narrative.length} characters.`,
      severity: 'warning',
    });
  }

  // ── Content Grounding ──
  const ungroundedTakeaways: string[] = [];
  for (const takeaway of output.keyTakeaways) {
    // Split into words and check if at least some appear in the corpus
    const words = takeaway
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 4);
    if (words.length > 0) {
      const matchedWords = words.filter(w => corpus.includes(w));
      if (matchedWords.length / words.length < 0.4) {
        ungroundedTakeaways.push(takeaway.slice(0, 50));
      }
    }
  }

  if (ungroundedTakeaways.length > 0) {
    checks.push({
      passed: true,
      rule: 'content_grounding',
      message: `Some takeaways may not be grounded in source data: "${ungroundedTakeaways[0]}..."`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'content_grounding',
      message: 'Key takeaways appear grounded in the intelligence data.',
      severity: 'warning',
    });
  }

  // ── Structure Completeness ──
  const missingFields: string[] = [];
  if (output.keyTakeaways.length === 0) missingFields.push('keyTakeaways');
  if (output.strategicImplications.length === 0) missingFields.push('strategicImplications');

  if (missingFields.length > 0) {
    checks.push({
      passed: false,
      rule: 'structure_completeness',
      message: `Missing required brief elements: ${missingFields.join(', ')}.`,
      severity: 'error',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'structure_completeness',
      message: 'All required brief elements are present.',
      severity: 'error',
    });
  }

  // ── Data Sufficiency ──
  if (ctx.dataQualityMetrics.totalKnowledgeEntries < MIN_INTELLIGENCE_THRESHOLD) {
    checks.push({
      passed: true,
      rule: 'data_sufficiency',
      message: `Brief enhanced with limited data (${ctx.dataQualityMetrics.totalKnowledgeEntries} entries). Content may be generic.`,
      severity: 'warning',
    });
  } else {
    checks.push({
      passed: true,
      rule: 'data_sufficiency',
      message: 'Brief enhanced with sufficient intelligence data.',
      severity: 'warning',
    });
  }

  return checks;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AGGREGATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluates whether a set of guardrail checks allows the output to proceed.
 * Returns true if all ERROR-severity checks passed. Warnings are advisory.
 */
export function guardrailsAllowOutput(checks: GuardrailCheck[]): boolean {
  return checks.every(c => c.passed || c.severity === 'warning');
}

/**
 * Returns only the error-severity failures from a set of checks.
 */
export function getGuardrailErrors(checks: GuardrailCheck[]): GuardrailCheck[] {
  return checks.filter(c => !c.passed && c.severity === 'error');
}

/**
 * Returns only the warning-severity items from a set of checks.
 */
export function getGuardrailWarnings(checks: GuardrailCheck[]): GuardrailCheck[] {
  return checks.filter(c => c.severity === 'warning');
}
