/**
 * M5 WOW #3 — Meeting Intelligence Brief API
 *
 * POST /api/intelligence/meeting-brief        — Generate a meeting brief
 * POST /api/intelligence/meeting-brief/capture — Capture post-meeting intelligence
 * GET  /api/intelligence/meeting-brief/[id]/html — Get brief as HTML (for PDF export)
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  generateMeetingBrief,
  capturePostMeetingIntelligence,
  type MeetingBriefRequest,
} from '@/lib/meeting-intelligence-brief';

// ── POST: Generate meeting brief ──

export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const {
      companyId,
      contactId,
      meetingType,
      briefingType,
      additionalContext,
    } = body as MeetingBriefRequest;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const result = await generateMeetingBrief({
      companyId,
      contactId,
      meetingType,
      briefingType,
      additionalContext,
    });

    if (!result.success || !result.brief) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate meeting brief' },
        { status: 500 }
      );
    }

    logger.info('[wow-3] Meeting brief generated', {
      companyId,
      durationMs: result.durationMs,
      trustGrade: result.trustGrade,
      confidence: result.brief.conversationResult.confidenceScore,
    });

    return NextResponse.json({
      success: true,
      brief: {
        ...result.brief,
        // Don't send raw conversationResult — send structured data instead
        conversationResult: undefined,
        meetingObjective: result.brief.conversationResult.meetingObjective,
        meetingType: result.brief.conversationResult.meetingType,
        suggestedDuration: result.brief.conversationResult.suggestedDuration,
        buyerProfile: result.brief.conversationResult.buyerProfile,
        talkingPoints: result.brief.conversationResult.talkingPoints,
        questionsToAsk: result.brief.conversationResult.questionsToAsk,
        objectionsToPrepare: result.brief.conversationResult.objectionsToPrepare,
        topicsToAvoid: result.brief.conversationResult.topicsToAvoid,
        recommendedPositioning: result.brief.conversationResult.recommendedPositioning,
        valuePropositionAngle: result.brief.conversationResult.valuePropositionAngle,
        postMeetingActions: result.brief.conversationResult.postMeetingActions,
        evidenceCount: result.brief.conversationResult.evidenceCount,
        confidenceScore: result.brief.conversationResult.confidenceScore,
      },
      trust: result.trust,
      trustScore: result.trustScore,
      trustGrade: result.trustGrade,
      durationMs: result.durationMs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[wow-3] API error', { error: msg });
    return NextResponse.json(
      { error: 'Failed to generate meeting brief', details: msg },
      { status: 500 }
    );
  }
}
