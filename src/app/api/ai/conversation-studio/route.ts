/**
 * AI Conversation Studio API (Wave 6.2)
 *
 * GET /api/ai/conversation-studio?companyId=xxx&contactId=xxx&pursuitId=xxx
 *
 * Returns evidence-backed meeting preparation briefing:
 * - Meeting objective and type
 * - Talking points with evidence
 * - Questions to ask
 * - Objection preparation
 * - Recommended positioning
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { generateConversationBriefing } from '@/lib/conversation-studio-engine';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const contactId = searchParams.get('contactId') || undefined;
    const pursuitId = searchParams.get('pursuitId') || undefined;

    if (!companyId) return apiError('companyId is required', 400);

    const briefing = await generateConversationBriefing({
      companyId,
      contactId,
      pursuitId,
    });

    // Persist as AI insight
    try {
      await createInsights([{
        companyId,
        contactId,
        type: 'RECOMMENDATION',
        title: `Conversation Briefing: ${briefing.contactName} at ${briefing.companyName}`,
        description: `Pre-meeting preparation generated. ${briefing.meetingType} meeting, ${briefing.talkingPoints.length} talking points, ${briefing.objectionsToPrepare.length} objections prepared. AI confidence: ${briefing.aiConfidence}%.`,
        evidence: briefing.talkingPoints.map(tp => ({
          source: tp.source,
          snippet: `${tp.point}: ${tp.evidence}`,
          reliability: 0.8,
        })),
        confidenceScore: briefing.aiConfidence,
        impactScore: 70,
        urgencyScore: 60,
        reasoning: `Briefing for ${briefing.meetingType} meeting. ${briefing.signalContext.length} signals analyzed. ${briefing.evidenceCount} total evidence items.`,
        recommendedAction: `Meeting objective: ${briefing.meetingObjective}`,
        sourceType: 'conversation_studio_engine',
        sourceRoute: '/api/ai/conversation-studio',
        metadata: {
          meetingType: briefing.meetingType,
          talkingPointsCount: briefing.talkingPoints.length,
          questionsCount: briefing.questionsToAsk.length,
          objectionsCount: briefing.objectionsToPrepare.length,
          hallucinationRisk: briefing.hallucinationRisk,
        },
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2-day expiry
      }]);
    } catch (e) {
      logger.warn('[ai/conversation-studio] Failed to persist insight:', { error: e });
    }

    return apiSuccess(briefing);
  } catch (error) {
    logger.error('[ai/conversation-studio] Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError(message, message.includes('not found') ? 404 : 500);
  }
}
