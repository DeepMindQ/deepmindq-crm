/**
 * Phase 7.6: Executive Recommendations — Revenue Intelligence Layer
 *
 * Generates deterministic, rule-based engagement recommendations from
 * opportunity signals. LLM is used ONLY for polishing the "reason"
 * wording — all WHAT to recommend, priority, and timing are computed
 * by fixed rules so the system is fully auditable.
 */

import { db } from '@/lib/db';
import { getSignalsForCompany } from './signal-extraction';
import { getAccountScore } from './account-scoring';
import { revenueLLMCall } from './llm-helper';
import { KEYWORD_TO_CATEGORY } from './signal-patterns';

// ─── Exported Interfaces ───────────────────────────────────────────────

/** A single actionable recommendation for an account. */
export interface Recommendation {
  type: 'solution' | 'engagement' | 'monitoring' | 'timing';
  focus: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  suggestedConversation?: string;
  timing: string;
  expectedOpportunity: string;
  supportingSignalIds: string[];
}

/** The full recommendation set for a single company. */
export interface RecommendationResult {
  companyId: string;
  recommendations: Recommendation[];
  score: number | null;
  category: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────

/** System prompt for the LLM wording pass — engagement focus. */
const ENGAGEMENT_WORDING_PROMPT = `You are a revenue intelligence analyst. Convert the following structured facts about a company's signals into a concise reason for engagement (1-3 sentences, professional, action-oriented).

CRITICAL RULES:
- Only reference signals and facts explicitly provided. Do NOT invent or assume anything.
- Be specific about WHAT to discuss — not WHO to contact (no specific names/titles).
- Good: "Detected AI modernization signals suggest readiness for data transformation services."
- Bad: "Contact CIO John Smith about their AI strategy."
- Output the reason text only, nothing else.`;

// ─── Internal Helpers ──────────────────────────────────────────────────

/**
 * Determine priority label from a numeric score.
 */
function scoreToPriority(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Build a map of signal type → array of signal records for fast lookups.
 */
function indexSignalsByType(
  signals: Array<{
    id: string;
    signalType: string;
    confidence: number;
    score: number;
    title: string;
    createdAt: Date;
  }>,
): Record<string, typeof signals> {
  const map: Record<string, typeof signals> = {};
  for (const sig of signals) {
    if (!map[sig.signalType]) map[sig.signalType] = [];
    map[sig.signalType].push(sig);
  }
  return map;
}

/**
 * Determine the timing recommendation based on signal freshness
 * and average confidence.
 */
function determineTiming(
  signals: Array<{ confidence: number; createdAt: Date }>,
): string {
  if (signals.length === 0) return 'Monitor and reassess quarterly';

  const avgConfidence =
    signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

  const mostRecent = new Date(
    Math.max(...signals.map((s) => s.createdAt.getTime())),
  );
  const daysSinceMostRecent =
    (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);

  if (avgConfidence > 0.7 && daysSinceMostRecent < 14) {
    return 'Engage within 30 days';
  }
  if (avgConfidence > 0.5) {
    return 'Engage within 60 days';
  }
  return 'Monitor and reassess quarterly';
}

/**
 * Use LLM to improve the wording of a reason string.
 * On any failure, silently falls back to the template.
 */
async function polishReason(
  signalTypes: string[],
  focusArea: string,
): Promise<string> {
  const template = `Based on detected ${signalTypes.join(', ')} signals, ${focusArea.toLowerCase()} engagement is recommended.`;

  try {
    const userPrompt = [
      `Signal types detected: ${signalTypes.join(', ')}`,
      `Recommended focus: ${focusArea}`,
    ].join('\n');

    const result = await revenueLLMCall(ENGAGEMENT_WORDING_PROMPT, userPrompt);
    if (result && result.trim().length > 0) return result.trim();
    return template;
  } catch {
    return template;
  }
}

/**
 * Derive an expected-opportunity description from a recommendation's focus area.
 */
function expectedOpportunityFromFocus(focus: string): string {
  const mapping: Record<string, string> = {
    'AI/Data modernization services': 'AI & Data Modernization — potential $200K-$1M+ engagement',
    'Transformation consulting': 'Business Transformation Consulting — strategic advisory engagement',
    'Strategic partnership discussion': 'Strategic Partnership — long-term revenue multiplier',
    'Executive relationship building': 'Executive Advisory — relationship-driven opportunity pipeline',
    'Ecosystem integration': 'Ecosystem Integration — partner/channel co-sell opportunity',
    'Technology-led transformation': 'Technology-Led Transformation — end-to-end modernization program',
    'Continue intelligence gathering': 'Intelligence gathering — no immediate revenue opportunity identified',
  };
  return mapping[focus] ?? `${focus} — follow up for scoping`;
}

// ─── Recommendation Rules Engine ────────────────────────────────────────

interface RuleMatch {
  type: Recommendation['type'];
  focus: string;
  signalIds: string[];
}

/**
 * Apply the deterministic rule set to determine which recommendations
 * to generate. Rules are evaluated in order; a signal can trigger
 * multiple rules, but duplicates (same type+focus) are deduplicated.
 */
function applyRules(
  signalsByType: Record<string, Array<{ id: string; confidence: number; score: number; createdAt: Date }>>,
  score: number | null,
): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const seen = new Set<string>();

  const addMatch = (type: Recommendation['type'], focus: string, ids: string[]) => {
    const key = `${type}:${focus}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ type, focus, signalIds: ids });
  };

  const ids = (type: string): string[] =>
    (signalsByType[type] ?? []).map((s) => s.id);

  const has = (type: string): boolean =>
    (signalsByType[type] ?? []).length > 0;

  // Rule 7 (checked first — compound rule takes precedence)
  if (has('pain') && has('technology')) {
    addMatch('solution', 'Technology-led transformation', [...ids('pain'), ...ids('technology')]);
  }

  // Rule 1: Technology signals + decent score
  if (has('technology') && score !== null && score >= 50) {
    addMatch('solution', 'AI/Data modernization services', ids('technology'));
  }

  // Rule 2: Pain signals + modest score
  if (has('pain') && score !== null && score >= 40) {
    addMatch('solution', 'Transformation consulting', ids('pain'));
  }

  // Rule 3: Growth signals + strong score
  if (has('growth') && score !== null && score >= 60) {
    addMatch('engagement', 'Strategic partnership discussion', ids('growth'));
  }

  // Rule 4: Leadership signals — always recommend engagement
  if (has('leadership')) {
    addMatch('engagement', 'Executive relationship building', ids('leadership'));
  }

  // Rule 5: Partnership signals — always recommend engagement
  if (has('partnership')) {
    addMatch('engagement', 'Ecosystem integration', ids('partnership'));
  }

  // Rule 6: No signals at all
  if (matches.length === 0) {
    addMatch('monitoring', 'Continue intelligence gathering', []);
  }

  return matches;
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Generate executive recommendations for a specific company.
 *
 * Process:
 * 1. Fetch non-DISMISSED signals and the account score.
 * 2. Apply deterministic rules to determine recommendation types.
 * 3. Set priority based on score thresholds.
 * 4. Set timing based on signal freshness and confidence.
 * 5. Use LLM to polish the "reason" field wording only.
 * 6. Return structured recommendations.
 *
 * @param companyId  The Company.id to generate recommendations for.
 */
export async function generateRecommendations(
  companyId: string,
): Promise<RecommendationResult> {
  // a) Fetch signals and score in parallel
  const [signals, accountScore] = await Promise.all([
    getSignalsForCompany(companyId),
    getAccountScore(companyId),
  ]);

  const score = accountScore?.score ?? null;
  const category = accountScore?.category ?? null;

  // Index signals by type for rule evaluation
  const signalsByType = indexSignalsByType(signals);
  const allSignalIds = signals.map((s) => s.id);

  // b) Apply deterministic rules
  const ruleMatches = applyRules(signalsByType, score);

  // c–e) Build recommendations
  const recommendations: Recommendation[] = [];
  const activeSignalTypes = Object.keys(signalsByType);

  for (const match of ruleMatches) {
    const priority = scoreToPriority(score ?? 0);
    const timing = determineTiming(
      match.signalIds
        .map((id) => signals.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s),
    );

    // LLM polish for the reason field only
    const reason = await polishReason(
      activeSignalTypes.length > 0 ? activeSignalTypes : ['none'],
      match.focus,
    );

    // f) Expected opportunity from focus
    const expectedOpportunity = expectedOpportunityFromFocus(match.focus);

    // Suggested conversation: a brief talking-point hint (deterministic)
    const suggestedConversation = buildSuggestedConversation(match.type, match.focus);

    recommendations.push({
      type: match.type,
      focus: match.focus,
      priority,
      reason,
      suggestedConversation,
      timing,
      expectedOpportunity,
      supportingSignalIds: match.signalIds,
    });
  }

  return {
    companyId,
    recommendations,
    score,
    category,
  };
}

/**
 * Alias for {@link generateRecommendations}. Recommendations are always
 * generated fresh to reflect the latest signals — no caching.
 */
export async function getRecommendations(
  companyId: string,
): Promise<RecommendationResult> {
  return generateRecommendations(companyId);
}

// ─── Internal: Suggested Conversation Builder ───────────────────────────

/**
 * Build a deterministic suggested-conversation line based on
 * recommendation type and focus. No LLM involvement.
 */
function buildSuggestedConversation(
  type: Recommendation['type'],
  focus: string,
): string | undefined {
  if (type === 'monitoring') return undefined;

  const conversationHints: Record<string, string> = {
    'AI/Data modernization services':
      'Open with recent AI/data investments, then explore current platform limitations and roadmap alignment.',
    'Transformation consulting':
      'Discuss operational challenges they face and how structured transformation can address them.',
    'Strategic partnership discussion':
      'Explore growth trajectory and how a strategic partnership could accelerate their objectives.',
    'Executive relationship building':
      'Share relevant industry insights and establish credibility before any commercial discussion.',
    'Ecosystem integration':
      'Identify technology stack overlaps and discuss integration opportunities in their ecosystem.',
    'Technology-led transformation':
      'Connect their pain points to technology solutions, positioning modernization as the path forward.',
  };

  return conversationHints[focus];
}
