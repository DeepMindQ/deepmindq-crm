/**
 * Contact Engagement Prediction API (Wave 5.3)
 *
 * GET /api/contacts/engagement-prediction?contactId=xxx
 * GET /api/contacts/engagement-prediction?companyId=xxx
 *
 * Predicts response probability, optimal timing, channel, and message strategy.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { predictEngagement, type EngagementPrediction } from '@/lib/engagement-prediction-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const companyId = searchParams.get('companyId');

    if (contactId) {
      const prediction = await predictEngagement(contactId);
      return apiSuccess({ prediction });
    }

    if (companyId) {
      const contacts = await db.contact.findMany({
        where: { companyId, status: { notIn: ['archived', 'suppressed'] } },
        select: { id: true },
        orderBy: { leadScore: 'desc' },
        take: 20,
      });

      const predictions: EngagementPrediction[] = [];
      for (const c of contacts) {
        try {
          const p = await predictEngagement(c.id);
          predictions.push(p);
        } catch {
          // Skip failed predictions
        }
      }

      predictions.sort((a, b) => b.responseProbability - a.responseProbability);

      return apiSuccess({
        predictions,
        total: predictions.length,
        summary: {
          highProbability: predictions.filter(p => p.responseProbability >= 60).length,
          mediumProbability: predictions.filter(p => p.responseProbability >= 40 && p.responseProbability < 60).length,
          lowProbability: predictions.filter(p => p.responseProbability < 40).length,
          shouldContact: predictions.filter(p => p.shouldContact).length,
          avgProbability: predictions.length > 0 ? Math.round(predictions.reduce((s, p) => s + p.responseProbability, 0) / predictions.length) : 0,
        },
      });
    }

    return apiError('Provide contactId or companyId', 400);
  } catch (error) {
    logger.error('[contacts/engagement-prediction] Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError(message, message.includes('not found') ? 404 : 500);
  }
}
