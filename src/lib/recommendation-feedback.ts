/**
 * Recommendation Feedback Service (Phase 6.1)
 *
 * Captures human validation decisions on recommendations
 * for future scoring calibration.
 *
 * TODO: Re-enable once recommendationFeedback table is added to Prisma schema.
 */

import { db } from '@/lib/db';

export type UserDecision = 'confirmed_accurate' | 'partially_accurate' | 'incorrect' | 'needs_more_evidence';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rf = () => (db as any).recommendationFeedback;

export async function submitFeedback(params: {
  recommendationId: string;
  companyId: string;
  userDecision: UserDecision;
  feedbackReason?: string;
}) {
  return rf().create({
    data: {
      recommendationId: params.recommendationId,
      companyId: params.companyId,
      userDecision: params.userDecision,
      feedbackReason: params.feedbackReason,
    },
  });
}

export async function getFeedbackForRecommendation(recommendationId: string) {
  return rf().findMany({
    where: { recommendationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFeedbackSummaryForCompany(companyId: string) {
  const feedbacks = await rf().findMany({
    where: { companyId },
    select: { userDecision: true },
  });

  const summary: Record<string, number> = {
    confirmed_accurate: 0,
    partially_accurate: 0,
    incorrect: 0,
    needs_more_evidence: 0,
  };

  for (const f of feedbacks) {
    if (f.userDecision in summary) {
      summary[f.userDecision]++;
    }
  }

  return {
    total: feedbacks.length,
    accuracyRate: feedbacks.length > 0
      ? ((summary.confirmed_accurate + summary.partially_accurate * 0.5) / feedbacks.length * 100).toFixed(1)
      : 'N/A',
    breakdown: summary,
  };
}

/**
 * Apply feedback to source reliability.
 * If a recommendation is marked incorrect, penalize source domains.
 * If confirmed accurate, boost them.
 */
export async function applyFeedbackToSources(recommendationId: string, isCorrect: boolean) {
  const { updateSourceReliability } = await import('./source-reliability');

  const rec = await db.opportunityRecommendation.findUnique({
    where: { id: recommendationId },
    select: { evidenceIds: true },
  });
  if (!rec) return;

  let evidenceIds: string[] = [];
  try {
    evidenceIds = JSON.parse(rec.evidenceIds);
  } catch {
    return;
  }

  const evidenceItems = await db.evidence.findMany({
    where: { id: { in: evidenceIds } },
    select: { sourceUrl: true },
  });

  for (const e of evidenceItems) {
    try {
      const domain = new URL(e.sourceUrl).hostname.replace(/^www\./, '');
      await updateSourceReliability(domain, isCorrect);
    } catch {
      // Skip invalid URLs
    }
  }
}