/**
 * M5 Phase 5 — Decision Intelligence Learning System
 *
 * Implements the feedback loop that improves AI recommendations over time.
 * Users rate recommendations, outcomes are tracked, and the system
 * adjusts confidence scores based on accumulated learning data.
 *
 * Storage: Uses the existing Evidence model (extractedField = `feedback:${agentType}`)
 * No schema migrations required.
 *
 * Learning Pipeline:
 *   1. Collect feedback (ratings + outcomes) on recommendations
 *   2. Aggregate into per-agent effectiveness scores
 *   3. Detect trends (improving / stable / declining)
 *   4. Adjust future confidence scores based on historical performance
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { aiInferenceTrust } from '@/lib/intelligence-sources/trust-metadata';

// ─── Types ──────────────────────────────────────────────────────────

export interface RecommendationFeedback {
  id: string;
  agentType: string;
  companyId: string;
  recommendation: string;
  userRating: 1 | 2 | 3 | 4 | 5;
  outcome?: 'positive' | 'neutral' | 'negative';
  context: string;
  timestamp: string;
  userId?: string;
}

export interface LearningStats {
  totalFeedback: number;
  averageRating: number;
  agentStats: Record<string, {
    totalRecommendations: number;
    averageRating: number;
    positiveOutcomes: number;
    negativeOutcomes: number;
    effectivenessScore: number; // 0-100
  }>;
  learningAccuracy: number; // percentage of recommendations rated 4+
  trend: 'improving' | 'stable' | 'declining';
}

export interface RecommendationWithFeedback {
  recommendation: string;
  confidence: number;
  source: string;
  historicalRating?: number;
  historicalOutcomeCount?: number;
  adjustedConfidence: number; // confidence adjusted by learning
}

interface SubmitFeedbackParams {
  agentType: string;
  companyId: string;
  recommendation: string;
  rating: 1 | 2 | 3 | 4 | 5;
  outcome?: 'positive' | 'neutral' | 'negative';
  context?: string;
  userId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

/** Prefix used in Evidence.extractedField for recommendation feedback */
const FEEDBACK_FIELD_PREFIX = 'recommendation_feedback';

/**
 * Build the extractedField value for storing recommendation feedback.
 * Format: `recommendation_feedback:${agentType}`
 */
function buildFeedbackField(agentType: string): string {
  return `${FEEDBACK_FIELD_PREFIX}:${agentType}`;
}

/**
 * Check whether an extractedField value belongs to the recommendation feedback system.
 */
function isRecommendationFeedbackField(field: string | null | undefined): boolean {
  if (!field) return false;
  return field.startsWith(FEEDBACK_FIELD_PREFIX);
}

// ─── 1. Submit Feedback ─────────────────────────────────────────────

/**
 * Store feedback on a recommendation in the Evidence table.
 *
 * Storage strategy:
 *   - extractedField = `recommendation_feedback:{agentType}`
 *   - extractedValue  = JSON of full feedback payload
 *   - relevanceScore  = rating mapped to 0-1 (1→0.2, 2→0.4, 3→0.6, 4→0.8, 5→1.0)
 *   - confidence      = 1.0 (user feedback is ground truth)
 *
 * @returns The ID of the created Evidence record
 */
export async function submitFeedback(params: SubmitFeedbackParams): Promise<string> {
  try {
    const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const feedbackPayload: Omit<RecommendationFeedback, 'id'> & { _id: string } = {
      _id: id,
      agentType: params.agentType,
      companyId: params.companyId,
      recommendation: params.recommendation,
      userRating: params.rating,
      outcome: params.outcome,
      context: params.context || '{}',
      timestamp: new Date().toISOString(),
      userId: params.userId,
    };

    await db.evidence.create({
      data: {
        companyId: params.companyId,
        sourceUrl: `feedback://${id}`,
        sourceTitle: `Recommendation feedback: ${params.agentType}`,
        sourceName: 'decision_learning',
        snippet: params.recommendation.substring(0, 500),
        extractedField: buildFeedbackField(params.agentType),
        extractedValue: JSON.stringify(feedbackPayload),
        relevanceScore: params.rating / 5,
        confidence: 1.0,
        status: 'active',
      },
    });

    logger.info('[decision-learning] Feedback submitted', {
      feedbackId: id,
      agentType: params.agentType,
      companyId: params.companyId,
      rating: params.rating,
    });

    return id;
  } catch (error) {
    logger.error('[decision-learning] Failed to submit feedback', { error });
    throw new Error('Failed to submit feedback');
  }
}

// ─── 2. Get Learning Stats ──────────────────────────────────────────

/**
 * Aggregate all recommendation feedback into learning statistics.
 *
 * Computes:
 *   - Total feedback count and average rating
 *   - Per-agent effectiveness scores (weighted blend of rating + outcome)
 *   - Learning accuracy (% of recommendations rated 4+)
 *   - Trend: compare last 30 days vs prior 30 days
 */
export async function getLearningStats(): Promise<LearningStats> {
  try {
    // Query all recommendation feedback records from Evidence table
    const records = await db.evidence.findMany({
      where: {
        status: 'active',
      },
      select: {
        extractedField: true,
        extractedValue: true,
        createdAt: true,
      },
    });

    // Filter to only recommendation feedback records
    const feedbackRecords = records.filter((r) =>
      isRecommendationFeedbackField(r.extractedField)
    );

    // Parse all feedback
    const parsedFeedback: Array<{
      agentType: string;
      userRating: number;
      outcome?: string;
      timestamp: string;
      companyId: string;
    }> = [];

    for (const rec of feedbackRecords) {
      try {
        const parsed = JSON.parse(rec.extractedValue as string);
        parsedFeedback.push({
          agentType: parsed.agentType || 'unknown',
          userRating: parsed.userRating || 3,
          outcome: parsed.outcome,
          timestamp: parsed.timestamp || rec.createdAt.toISOString(),
          companyId: parsed.companyId,
        });
      } catch {
        // Skip unparseable records
      }
    }

    if (parsedFeedback.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        agentStats: {},
        learningAccuracy: 0,
        trend: 'stable',
      };
    }

    // ── Aggregate stats ──

    const totalFeedback = parsedFeedback.length;
    const averageRating =
      parsedFeedback.reduce((sum, f) => sum + f.userRating, 0) / totalFeedback;

    // Learning accuracy: % rated 4 or 5
    const rated4Plus = parsedFeedback.filter(
      (f) => f.userRating >= 4
    ).length;
    const learningAccuracy = (rated4Plus / totalFeedback) * 100;

    // ── Per-agent stats ──

    const agentBuckets = new Map<
      string,
      {
        ratings: number[];
        positiveOutcomes: number;
        negativeOutcomes: number;
        total: number;
      }
    >();

    for (const f of parsedFeedback) {
      if (!agentBuckets.has(f.agentType)) {
        agentBuckets.set(f.agentType, {
          ratings: [],
          positiveOutcomes: 0,
          negativeOutcomes: 0,
          total: 0,
        });
      }
      const bucket = agentBuckets.get(f.agentType)!;
      bucket.ratings.push(f.userRating);
      bucket.total++;
      if (f.outcome === 'positive') bucket.positiveOutcomes++;
      if (f.outcome === 'negative') bucket.negativeOutcomes++;
    }

    const agentStats: LearningStats['agentStats'] = {};

    for (const [agentType, bucket] of agentBuckets) {
      const avgRating =
        bucket.ratings.reduce((a, b) => a + b, 0) / bucket.ratings.length;

      // Effectiveness score: weighted blend of avg rating (60%) + outcome ratio (40%)
      const ratingComponent = (avgRating / 5) * 100; // 0-100
      const outcomeComponent =
        bucket.positiveOutcomes + bucket.negativeOutcomes > 0
          ? (bucket.positiveOutcomes /
              (bucket.positiveOutcomes + bucket.negativeOutcomes)) *
            100
          : 50; // default neutral if no outcome data

      const effectivenessScore = Math.round(
        ratingComponent * 0.6 + outcomeComponent * 0.4
      );

      agentStats[agentType] = {
        totalRecommendations: bucket.total,
        averageRating: Math.round(avgRating * 100) / 100,
        positiveOutcomes: bucket.positiveOutcomes,
        negativeOutcomes: bucket.negativeOutcomes,
        effectivenessScore: Math.min(100, Math.max(0, effectivenessScore)),
      };
    }

    // ── Trend detection ──
    const trend = computeTrend(parsedFeedback);

    return {
      totalFeedback,
      averageRating: Math.round(averageRating * 100) / 100,
      agentStats,
      learningAccuracy: Math.round(learningAccuracy * 100) / 100,
      trend,
    };
  } catch (error) {
    logger.error('[decision-learning] Failed to compute learning stats', { error });
    return {
      totalFeedback: 0,
      averageRating: 0,
      agentStats: {},
      learningAccuracy: 0,
      trend: 'stable',
    };
  }
}

/**
 * Compare the average rating of the most recent 30 days vs the prior 30 days.
 * Returns 'improving' if recent is notably better, 'declining' if worse, else 'stable'.
 */
function computeTrend(
  feedback: Array<{ userRating: number; timestamp: string }>
): 'improving' | 'stable' | 'declining' {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recent = feedback.filter(
    (f) => new Date(f.timestamp) >= thirtyDaysAgo
  );
  const prior = feedback.filter((f) => {
    const d = new Date(f.timestamp);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  // Not enough data to determine trend
  if (recent.length < 3 || prior.length < 3) return 'stable';

  const recentAvg =
    recent.reduce((sum, f) => sum + f.userRating, 0) / recent.length;
  const priorAvg =
    prior.reduce((sum, f) => sum + f.userRating, 0) / prior.length;

  const delta = recentAvg - priorAvg;

  if (delta > 0.3) return 'improving';
  if (delta < -0.3) return 'declining';
  return 'stable';
}

// ─── 3. Get Recommendation History ───────────────────────────────────

/**
 * Query past recommendations with feedback data.
 *
 * @param agentType - Optional agent type filter
 * @param companyId - Optional company filter
 * @param limit     - Maximum records to return (default 50)
 * @returns Feedback records ordered most recent first
 */
export async function getRecommendationHistory(
  agentType?: string,
  companyId?: string,
  limit: number = 50
): Promise<RecommendationFeedback[]> {
  try {
    // Build the filter
    const where: Record<string, unknown> = {
      status: 'active',
      extractedField: agentType
        ? { startsWith: FEEDBACK_FIELD_PREFIX }
        : { startsWith: FEEDBACK_FIELD_PREFIX },
    };

    if (companyId) {
      where.companyId = companyId;
    }

    const records = await db.evidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200), // cap at 200 for safety
    });

    const results: RecommendationFeedback[] = [];

    for (const rec of records) {
      try {
        const parsed = JSON.parse(rec.extractedValue as string);

        // If agentType is specified, filter records by it
        if (agentType && parsed.agentType !== agentType) continue;

        results.push({
          id: parsed._id || rec.id,
          agentType: parsed.agentType || 'unknown',
          companyId: parsed.companyId || rec.companyId,
          recommendation: parsed.recommendation || '',
          userRating: parsed.userRating || 3,
          outcome: parsed.outcome,
          context: parsed.context || '{}',
          timestamp: parsed.timestamp || rec.createdAt.toISOString(),
          userId: parsed.userId,
        });
      } catch {
        // Skip unparseable
      }
    }

    return results;
  } catch (error) {
    logger.error('[decision-learning] Failed to get recommendation history', {
      error,
    });
    return [];
  }
}

// ─── 4. Adjust Confidence ────────────────────────────────────────────

/**
 * Adjust a confidence score based on accumulated learning data.
 *
 * Rules:
 *   - Agent effectiveness > 70: boost confidence by up to 10%
 *   - Agent effectiveness < 40: reduce confidence by up to 15%
 *   - If the specific company has feedback history, weight that more heavily
 *   - Result is clamped to 0-100
 *
 * @param baseConfidence - Original confidence score (0-100)
 * @param agentType      - The agent that made the recommendation
 * @param companyId      - Optional company for company-specific weighting
 * @returns Adjusted confidence score (0-100)
 */
export async function adjustConfidence(
  baseConfidence: number,
  agentType: string,
  companyId?: string
): Promise<number> {
  try {
    // If no feedback exists, return base unchanged
    const stats = await getLearningStats();
    const agentStat = stats.agentStats[agentType];

    if (!agentStat || agentStat.totalRecommendations < 3) {
      // Not enough data — return base unchanged
      return Math.min(100, Math.max(0, baseConfidence));
    }

    const effectiveness = agentStat.effectivenessScore;

    // ── Agent-level adjustment ──

    let adjustment = 0;

    if (effectiveness > 70) {
      // High effectiveness: boost by up to 10%, proportional to how high
      adjustment = ((effectiveness - 70) / 30) * 10; // 0-10 range
    } else if (effectiveness < 40) {
      // Low effectiveness: reduce by up to 15%, proportional to how low
      adjustment = -((40 - effectiveness) / 40) * 15; // 0 to -15 range
    }

    // ── Company-specific override ──

    if (companyId) {
      const companyFeedback = await getRecommendationHistory(
        agentType,
        companyId,
        10
      );

      if (companyFeedback.length >= 2) {
        const companyAvgRating =
          companyFeedback.reduce((sum, f) => sum + f.userRating, 0) /
          companyFeedback.length;

        // Company-specific rating maps to an adjustment:
        // Rating 5 → +8, Rating 4 → +4, Rating 3 → 0, Rating 2 → -5, Rating 1 → -10
        const companyAdjustmentMap: Record<number, number> = {
          5: 8,
          4: 4,
          3: 0,
          2: -5,
          1: -10,
        };

        const companyAdjustment =
          companyAdjustmentMap[companyAvgRating] || 0;

        // Blend: 60% agent-level, 40% company-specific
        adjustment = adjustment * 0.6 + companyAdjustment * 0.4;
      }
    }

    const adjusted = baseConfidence + adjustment;
    return Math.min(100, Math.max(0, Math.round(adjusted * 100) / 100));
  } catch (error) {
    logger.error('[decision-learning] Failed to adjust confidence', { error });
    return Math.min(100, Math.max(0, baseConfidence));
  }
}

// ─── 5. Feedback Summary ────────────────────────────────────────────

/**
 * Generate a human-readable summary of learning progress.
 *
 * Examples:
 *   "The system has collected 42 feedback items with an average rating of 4.2/5"
 *   "Sales Strategy Agent recommendations have 78% positive outcomes"
 *   "Overall system accuracy is trending improving"
 */
export async function getFeedbackSummary(): Promise<string> {
  try {
    const stats = await getLearningStats();

    if (stats.totalFeedback === 0) {
      return 'No feedback has been collected yet. As users rate recommendations, the system will learn and improve its suggestions over time.';
    }

    const lines: string[] = [];

    // Overall summary
    lines.push(
      `The system has collected ${stats.totalFeedback} feedback items with an average rating of ${stats.averageRating}/5.`
    );

    // Learning accuracy
    lines.push(
      `Overall system accuracy (recommendations rated 4+): ${Math.round(stats.learningAccuracy)}%.`
    );

    // Per-agent highlights
    const agentEntries = Object.entries(stats.agentStats);
    if (agentEntries.length > 0) {
      for (const [agent, aStats] of agentEntries) {
        const agentLabel = formatAgentLabel(agent);
        const totalOutcomes =
          aStats.positiveOutcomes + aStats.negativeOutcomes;
        const positiveRate =
          totalOutcomes > 0
            ? Math.round(
                (aStats.positiveOutcomes / totalOutcomes) * 100
              )
            : null;

        if (positiveRate !== null) {
          lines.push(
            `${agentLabel} recommendations have an average rating of ${aStats.averageRating}/5 and ${positiveRate}% positive outcomes (effectiveness: ${aStats.effectivenessScore}/100).`
          );
        } else {
          lines.push(
            `${agentLabel} recommendations have an average rating of ${aStats.averageRating}/5 (effectiveness: ${aStats.effectivenessScore}/100).`
          );
        }
      }
    }

    // Trend
    const trendPhrase =
      stats.trend === 'improving'
        ? 'is trending improving based on recent feedback patterns'
        : stats.trend === 'declining'
          ? 'is showing a declining trend — consider reviewing recent recommendations'
          : 'is stable';
    lines.push(`Overall system accuracy ${trendPhrase}.`);

    return lines.join(' ');
  } catch (error) {
    logger.error('[decision-learning] Failed to generate feedback summary', {
      error,
    });
    return 'Unable to generate learning summary at this time.';
  }
}

/**
 * Format an agent type string into a human-readable label.
 */
function formatAgentLabel(agentType: string): string {
  const labels: Record<string, string> = {
    'sales-strategy': 'Sales Strategy Agent',
    'risk-assessment': 'Risk Assessment Agent',
    'opportunity-scoring': 'Opportunity Scoring Agent',
    'engagement': 'Engagement Agent',
    'retention': 'Retention Agent',
    'pricing': 'Pricing Agent',
    'expansion': 'Expansion Agent',
    'churn-prediction': 'Churn Prediction Agent',
    'decision-engine': 'Decision Engine',
    'competitive-intel': 'Competitive Intelligence Agent',
  };

  return labels[agentType] || agentType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Enrich Recommendation with Learning Data ────────────────────────

/**
 * Take a raw recommendation and enrich it with historical feedback data
 * and an adjusted confidence score.
 *
 * This is the primary integration point for recommendation pipelines.
 * Call this before surfacing recommendations to users.
 */
export async function enrichRecommendation(
  recommendation: string,
  confidence: number,
  source: string,
  agentType: string,
  companyId?: string
): Promise<RecommendationWithFeedback> {
  // Look up historical data for this agent (+ company if provided)
  const history = await getRecommendationHistory(
    agentType,
    companyId,
    5
  );

  const historicalRating =
    history.length > 0
      ? Math.round(
          (history.reduce((sum, f) => sum + f.userRating, 0) /
            history.length) *
            100
        ) / 100
      : undefined;

  const adjustedConfidence = await adjustConfidence(
    confidence,
    agentType,
    companyId
  );

  return {
    recommendation,
    confidence,
    source,
    historicalRating,
    historicalOutcomeCount: history.filter((f) => f.outcome).length,
    adjustedConfidence,
  };
}

// ─── Batch Enrichment ────────────────────────────────────────────────

/**
 * Enrich multiple recommendations at once with learning data.
 * Uses TRUST metadata framework for auditability.
 */
export async function enrichRecommendations(
  recommendations: Array<{
    recommendation: string;
    confidence: number;
    source: string;
    agentType: string;
    companyId?: string;
  }>
): Promise<RecommendationWithFeedback[]> {
  // Get all stats in one call for efficiency
  const stats = await getLearningStats();

  const results: RecommendationWithFeedback[] = [];

  for (const rec of recommendations) {
    const agentStat = stats.agentStats[rec.agentType];

    let adjustedConfidence = rec.confidence;

    if (agentStat && agentStat.totalRecommendations >= 3) {
      const effectiveness = agentStat.effectivenessScore;
      let adjustment = 0;

      if (effectiveness > 70) {
        adjustment = ((effectiveness - 70) / 30) * 10;
      } else if (effectiveness < 40) {
        adjustment = -((40 - effectiveness) / 40) * 15;
      }

      adjustedConfidence = Math.min(
        100,
        Math.max(0, rec.confidence + adjustment)
      );
    }

    results.push({
      recommendation: rec.recommendation,
      confidence: rec.confidence,
      source: rec.source,
      adjustedConfidence: Math.round(adjustedConfidence * 100) / 100,
    });
  }

  return results;
}

// ─── Export TRUST metadata helper for learning-adjusted confidence ──

/**
 * Generate TRUST metadata for a learning-adjusted recommendation.
 * Uses the ai_inference source with evidence count boosted by feedback volume.
 */
export function learningAdjustedTrust(
  agentType: string,
  adjustedConfidence: number,
  feedbackCount: number
) {
  const confidenceLevel =
    adjustedConfidence >= 80
      ? 'high' as const
      : adjustedConfidence >= 50
        ? 'medium' as const
        : 'low' as const;

  return aiInferenceTrust(
    `recommendation:${agentType}`,
    `Recommendation from ${formatAgentLabel(agentType)}, adjusted to ${adjustedConfidence}/100 based on ${feedbackCount} past feedback items.`,
    feedbackCount,
    confidenceLevel
  );
}

// ── Phase 2.11: Agent Effectiveness Audit ───────────────────────────

/**
 * Record agent effectiveness as a LearningEvent for audit trail.
 * This enables the feedback loop to be observable in the learning dashboard.
 *
 * Called after each feedback submission cycle (batched, not per-feedback).
 * Writes to LearningEvent table with:
 *   - eventType: 'lesson_learned' for agent effectiveness
 *   - source: 'ai_recommendation'
 *   - learnedInsight: Effectiveness summary
 *   - applicableContext: Agent type + time window
 *
 * @returns The ID of the created LearningEvent, or null if skipped
 */
export async function recordAgentEffectiveness(
  agentType: string
): Promise<string | null> {
  try {
    const stats = await getLearningStats();
    const agentStat = stats.agentStats[agentType];

    if (!agentStat || agentStat.totalRecommendations < 5) {
      // Not enough data to record meaningful effectiveness
      return null;
    }

    const effectiveness = agentStat.effectivenessScore;
    const trend = stats.trend;
    const insight = `${formatAgentLabel(agentType)} effectiveness: ${effectiveness}/100 (${agentStat.averageRating}/5 avg rating, ${agentStat.totalRecommendations} total, ${agentStat.positiveOutcomes} positive outcomes). System trend: ${trend}.`;

    const eventId = `effectiveness-${agentType}-${Date.now()}`;

    await db.learningEvent.create({
      data: {
        id: eventId,
        eventType: 'lesson_learned',
        source: 'ai_recommendation',
        description: `Agent effectiveness audit: ${agentType}`,
        learnedInsight: insight,
        applicableContext: JSON.stringify({
          agentType,
          effectivenessScore: effectiveness,
          averageRating: agentStat.averageRating,
          totalRecommendations: agentStat.totalRecommendations,
          positiveOutcomes: agentStat.positiveOutcomes,
          negativeOutcomes: agentStat.negativeOutcomes,
          trend,
          recordedAt: new Date().toISOString(),
        }),
        applicableTags: JSON.stringify([`agent:${agentType}`, 'effectiveness-audit', `effectiveness:${effectiveness >= 70 ? 'high' : effectiveness >= 40 ? 'medium' : 'low'}`]),
        confidence: effectiveness / 100,
        verified: false,
        reuseCount: 0,
      },
    });

    logger.info('[decision-learning] Agent effectiveness recorded', {
      eventId,
      agentType,
      effectiveness,
      trend,
    });

    return eventId;
  } catch (error) {
    logger.error('[decision-learning] Failed to record agent effectiveness:', { error });
    return null;
  }
}
