/**
 * AI Email Intelligence API (Wave 6.1)
 *
 * GET /api/ai/email-intelligence?contactId=xxx
 *
 * Returns evidence-backed email recommendations:
 * - Suggested message and subject
 * - Why this message (evidence chain)
 * - Signal drivers used
 * - AI quality metrics
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { generateEmailIntelligence } from '@/lib/email-intelligence-engine';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { withApiLogging } from '@/lib/api-logging-middleware';

async function getHandler(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) return apiError('contactId is required', 400);

    const intelligence = await generateEmailIntelligence(contactId);

    // Persist as AI insight
    try {
      await createInsights([{
        contactId,
        companyId: undefined, // Will be set from contact data
        type: 'RECOMMENDATION',
        title: `Email Intelligence: ${intelligence.contactName} at ${intelligence.companyName}`,
        description: `Evidence-backed email recommendation generated. ${intelligence.evidenceUsed.filter(e => e.usedInMessage).length} evidence signals used. Confidence: ${intelligence.aiConfidence}%. Message angle: ${intelligence.messageAngle}`,
        evidence: intelligence.evidenceUsed.filter(e => e.usedInMessage).map(e => ({
          source: e.source,
          snippet: `${e.signal}: ${e.evidence}`,
          reliability: e.reliability,
        })),
        confidenceScore: intelligence.aiConfidence,
        impactScore: intelligence.responseProbability,
        urgencyScore: intelligence.responseProbability >= 60 ? 60 : 30,
        reasoning: intelligence.whyThisMessage,
        recommendedAction: intelligence.recommendedNextSteps[0] || 'Review and send suggested message',
        sourceType: 'email_intelligence_engine',
        sourceRoute: '/api/ai/email-intelligence',
        metadata: {
          signalDrivers: intelligence.signalDrivers,
          buyingRole: intelligence.buyingRole,
          buyingInfluence: intelligence.buyingInfluence,
          hallucinationRisk: intelligence.hallucinationRisk,
          evidenceQuality: intelligence.evidenceQuality,
        },
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3-day expiry for time-sensitive emails
      }]);
    } catch (e) {
      logger.warn('[ai/email-intelligence] Failed to persist insight:', { error: e });
    }

    return apiSuccess(intelligence);
  } catch (error) {
    logger.error('[ai/email-intelligence] Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError(message, message.includes('not found') ? 404 : 500);
  }
}

export const GET = withApiLogging(getHandler, '/api/ai/email-intelligence');
