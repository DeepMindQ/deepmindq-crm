/**
 * Phase 2C — Learning Loop
 *
 * Captures user feedback on signal quality and uses it to improve
 * future signal classification and ranking.
 *
 * Feedback types: accuracy, relevance, actionability, surprise level.
 * The loop: Feedback → Insights → Better signals over time.
 */

import { db } from '@/lib/db';

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
 */
export async function recordSignalFeedback(feedback: SignalFeedback): Promise<void> {
  try {
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
    console.error('[learning-loop] Failed to record feedback:', error);
  }
}

// ─── Compute Learning Insights ─────────────────────────────────

/**
 * Analyze accumulated feedback to produce per-signal-type learning insights.
 */
export async function computeLearningInsights(companyId?: string): Promise<LearningInsight[]> {
  try {
    const where = companyId
      ? { companyId, extractedField: 'signal_feedback' }
      : { extractedField: 'signal_feedback' };

    const records = await db.evidence.findMany({ where, select: { extractedValue: true } });
    if (records.length === 0) return [];

    const bucket = new Map<string, {
      accurate: number; inaccurate: number;
      relevant: number; not_relevant: number;
      actionable: number; not_actionable: number;
      surprising: number; obvious: number;
      total: number; recentScores: number[];
    }>();

    for (const rec of records) {
      try {
        const p = JSON.parse(rec.extractedValue as string);
        const key = p.feedbackType || 'unknown';
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
      } catch { /* skip */ }
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
    console.error('[learning-loop] Failed to compute insights:', error);
    return [];
  }
}
