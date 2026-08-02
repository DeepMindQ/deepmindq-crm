/**
 * Phase 2C — Learning Loop (WI-5 activated)
 *
 * Captures user feedback on signal quality and uses it to improve
 * future signal classification and ranking.
 *
 * Feedback types: accuracy, relevance, actionability, surprise level.
 * The loop: Feedback → Insights → Better signals over time.
 *
 * WI-5 fixes:
 * - recordSignalFeedback() now resolves signalId → signalType for accurate grouping
 * - computeLearningInsights() groups by signalType (with legacy fallback)
 * - Added getAccuracyThreshold() for alerting integration
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Feedback Types ─────────────────────────────────────────────

export type FeedbackType = 'accurate' | 'inaccurate' | 'relevant' | 'not_relevant' | 'actionable' | 'not_actionable' | 'surprising' | 'obvious';

export interface SignalFeedback {
  signalId: string;
  companyId: string;
  type: FeedbackType;
  userId?: string;
  comment?: string;
}

export interface LearningInsight {
  signalType: string;
  accuracyScore: number;
  relevanceScore: number;
  actionabilityScore: number;
  totalFeedback: number;
  surpriseScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ─── Record Feedback ────────────────────────────────────────────

/**
 * Record user feedback on a signal. Persists in DB.
 *
 * WI-5 fix: resolves signalId → signalType and stores it in the
 * evidence JSON so that computeLearningInsights() can group by
 * the actual signal type (e.g., "funding") rather than the feedback
 * type (e.g., "accurate").
 */
export async function recordSignalFeedback(feedback: SignalFeedback): Promise<void> {
  try {
    // Resolve signalType from the signal record for accurate grouping
    let signalType: string | null = null;
    try {
      const signal = await db.companySignal.findUnique({
        where: { id: feedback.signalId },
        select: { signalType: true },
      });
      signalType = signal?.signalType ?? null;
    } catch {
      // Signal may have been deleted — continue without signalType
    }

    await db.evidence.create({
      data: {
        companyId: feedback.companyId,
        sourceUrl: `feedback://${feedback.signalId}`,
        sourceTitle: `Signal feedback: ${feedback.type}`,
        sourceName: 'user_feedback',
        snippet: feedback.comment || '',
        extractedField: 'signal_feedback',
        extractedValue: JSON.stringify({
          signalId: feedback.signalId,
          signalType, // WI-5: resolve and store for accurate grouping
          feedbackType: feedback.type,
          userId: feedback.userId,
          comment: feedback.comment,
          recordedAt: new Date().toISOString(),
        }),
        relevanceScore: ['accurate', 'relevant', 'actionable', 'surprising'].includes(feedback.type) ? 1.0 : 0.0,
        confidence: 1.0,
        status: 'active',
      },
    });
  } catch (error) {
    logger.error('[learning-loop] Failed to record feedback:', { error: error });
  }
}

// ─── Compute Learning Insights ─────────────────────────────────

/**
 * Analyze accumulated feedback to produce per-signal-type learning insights.
 *
 * WI-5 fix: groups by signalType (resolved from the signal record at
 * feedback recording time). Legacy records without signalType fall
 * back to grouping by feedbackType for backward compatibility.
 */
export async function computeLearningInsights(companyId?: string): Promise<LearningInsight[]> {
  try {
    const where = companyId
      ? { companyId, extractedField: 'signal_feedback' }
      : { extractedField: 'signal_feedback' };

    const records = await db.evidence.findMany({ where, select: { extractedValue: true } });
    if (records.length === 0) return [];

    interface FeedbackBucket {
      accurate: number; inaccurate: number;
      relevant: number; not_relevant: number;
      actionable: number; not_actionable: number;
      surprising: number; obvious: number;
      total: number; recentScores: number[];
    }

    const bucket = new Map<string, FeedbackBucket>();

    for (const rec of records) {
      try {
        const p = JSON.parse(rec.extractedValue as string);
        // WI-5 fix: use signalType for grouping; fallback to feedbackType for legacy records
        const key = p.signalType || p.feedbackType || 'unknown';
        const b = bucket.get(key) || {
          accurate: 0, inaccurate: 0, relevant: 0, not_relevant: 0,
          actionable: 0, not_actionable: 0, surprising: 0, obvious: 0,
          total: 0, recentScores: [],
        };
        b.total++;
        if (p.feedbackType === 'accurate') { b.accurate++; b.recentScores.push(1); }
        else if (p.feedbackType === 'inaccurate') { b.inaccurate++; b.recentScores.push(0); }
        else if (p.feedbackType === 'surprising') b.surprising++;
        else if (p.feedbackType === 'obvious') b.obvious++;
        else if (p.feedbackType === 'relevant') b.relevant++;
        else if (p.feedbackType === 'not_relevant') b.not_relevant++;
        else if (p.feedbackType === 'actionable') b.actionable++;
        else if (p.feedbackType === 'not_actionable') b.not_actionable++;
        if (b.recentScores.length > 10) b.recentScores = b.recentScores.slice(-10);
        bucket.set(key, b);
      } catch { /* skip unparseable records */ }
    }

    return Array.from(bucket.entries()).map(([signalType, data]) => {
      const acc = data.accurate + data.inaccurate > 0 ? data.accurate / (data.accurate + data.inaccurate) : 0.5;
      const rel = data.relevant + data.not_relevant > 0 ? data.relevant / (data.relevant + data.not_relevant) : 0.5;
      const act = data.actionable + data.not_actionable > 0 ? data.actionable / (data.actionable + data.not_actionable) : 0.5;
      const surp = data.surprising + data.obvious > 0 ? data.surprising / (data.surprising + data.obvious) : 0.5;
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (data.recentScores.length >= 3) {
        const ra = data.recentScores.reduce((a, b) => a + b, 0) / data.recentScores.length;
        if (ra > acc + 0.1) trend = 'improving';
        else if (ra < acc - 0.1) trend = 'declining';
      }
      return {
        signalType, accuracyScore: Math.round(acc * 100) / 100,
        relevanceScore: Math.round(rel * 100) / 100,
        actionabilityScore: Math.round(act * 100) / 100,
        totalFeedback: data.total, surpriseScore: Math.round(surp * 100) / 100, trend,
      };
    });
  } catch (error) {
    logger.error('[learning-loop] Failed to compute insights:', { error: error });
    return [];
  }
}

// ─── Quality Alert Thresholds ─────────────────────────────────

/**
 * Minimum feedback count required before a signal type is eligible
 * for a quality-declining alert. Prevents alerts on sparse data.
 */
export const MIN_FEEDBACK_FOR_ALERT = 3;

/**
 * Accuracy score threshold below which a signal type triggers
 * a quality-declining alert.
 */
export const ACCURACY_ALERT_THRESHOLD = 0.4;

/**
 * Check whether a learning insight warrants a quality-declining alert.
 * Returns true if the insight has enough feedback AND accuracy is below threshold.
 */
export function shouldAlertQualityDecline(insight: LearningInsight): boolean {
  return (
    insight.totalFeedback >= MIN_FEEDBACK_FOR_ALERT &&
    insight.accuracyScore < ACCURACY_ALERT_THRESHOLD
  );
}
