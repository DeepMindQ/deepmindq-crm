/**
 * MS9 Integration Layer — Advisor API Route
 * =============================================
 *
 * POST /api/ai/advisor
 *
 * Receives a user query and returns a real, evidence-grounded,
 * confidence-scored StructuredBriefing.
 *
 * Pipeline:
 *   1. Validate request body
 *   2. Load company context
 *   3. Execute intelligence services
 *   4. Generate recommendations
 *   5. Collect evidence
 *   6. Calculate confidence
 *   7. Validate through governance
 *   8. Return StructuredBriefing response
 *
 * Additional endpoints:
 *   GET  /api/ai/advisor — list conversations
 *   GET  /api/ai/advisor/[id] — get conversation with messages
 *   POST /api/ai/advisor/workspace — save workspace
 *   POST /api/ai/advisor/escalation — create escalation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { orchestrateAdvisorQuery } from '@/lib/advisor/advisor-orchestrator';
import { advisorConversationApi } from '@/lib/advisor/advisor-persistence';
import { buildContextSidebarData } from '@/lib/advisor/context-builders';
import type {
  AdvisorQueryRequest,
  AdvisorQueryResponse,
  BriefingBlockType,
} from '@/types/ms9-advisor';
import { validateBriefing } from '@/types/ms9-advisor';

// ─── Request Validation ──────────────────────────────────────────

const AdvisorQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  accountId: z.string().optional(),
  depth: z.enum(['summary', 'standard', 'comprehensive']).optional().default('standard'),
  focusAreas: z.array(z.string()).optional(),
  includeReasoning: z.boolean().optional().default(true),
  maxEvidenceItems: z.number().min(1).max(50).optional().default(10),
});

// ─── POST /api/ai/advisor — Query Endpoint ────────────────────────

export async function POST(request: NextRequest) {
  const correlationId = `advisor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Parse and validate request
    const body = await request.json();
    const parsed = AdvisorQuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
          correlationId,
        },
        { status: 400 },
      );
    }

    const queryRequest: AdvisorQueryRequest = {
      query: parsed.data.query,
      conversationId: parsed.data.conversationId,
      accountId: parsed.data.accountId,
      depth: parsed.data.depth,
      focusAreas: parsed.data.focusAreas as BriefingBlockType[] | undefined,
      includeReasoning: parsed.data.includeReasoning,
      maxEvidenceItems: parsed.data.maxEvidenceItems,
    };

    logger.info('advisor:api:query-received', {
      correlationId,
      query: queryRequest.query.slice(0, 100),
      accountId: queryRequest.accountId,
      depth: queryRequest.depth,
    });

    // ── Persist user message ──
    let conversationId = queryRequest.conversationId;
    if (!conversationId) {
      conversationId = await advisorConversationApi.createConversation({
        title: queryRequest.query.slice(0, 80),
        scope: 'account_intelligence',
        companyId: queryRequest.accountId,
      });
    } else {
      // Update existing conversation
      await advisorConversationApi.updateConversation(conversationId, {
        lastActiveAt: new Date(),
      });
    }

    // Save user message
    await advisorConversationApi.addMessage({
      conversationId,
      role: 'user',
      content: queryRequest.query,
      queryText: queryRequest.query,
    });

    // ── Execute Intelligence Pipeline ──
    const result = await orchestrateAdvisorQuery({
      request: { ...queryRequest, conversationId },
      correlationId,
    });

    // ── Handle Orchestration Failure ──
    if (!result.success || !result.briefing) {
      // Save error message
      await advisorConversationApi.addMessage({
        conversationId,
        role: 'assistant',
        content: result.error || 'Intelligence synthesis failed',
        contentJson: JSON.stringify({
          type: 'error',
          error: result.error || 'Unknown error',
          recoverable: true,
        }),
      });

      return NextResponse.json(
        {
          error: result.error || 'Intelligence briefing generation failed',
          conversation: result.conversation,
          processing: result.processing,
          correlationId,
        },
        { status: 502 },
      );
    }

    // ── Validate Briefing ──
    const validation = validateBriefing(result.briefing);
    if (!validation.valid) {
      logger.warn('advisor:api:briefing-validation-failed', {
        correlationId,
        errors: validation.errors,
      });
    }

    // ── Persist assistant message with briefing ──
    await advisorConversationApi.addMessage({
      conversationId,
      role: 'assistant',
      content: result.briefing.summary,
      contentJson: JSON.stringify({
        type: 'structured_briefing',
        briefing: result.briefing,
      }),
      briefingId: result.briefing.id,
      processingDurationMs: result.processing.durationMs,
      modelUsed: result.processing.modelUsed,
    });

    // ── Build Response ──
    const response: AdvisorQueryResponse = {
      briefing: result.briefing,
      conversation: {
        id: result.conversation.id,
        messageCount: result.conversation.messageCount,
        lastActiveAt: result.conversation.lastActiveAt,
      },
      processing: result.processing,
      confidenceWarnings: result.confidenceWarnings,
    };

    logger.info('advisor:api:query-complete', {
      correlationId,
      durationMs: result.processing.durationMs,
      confidence: result.briefing.confidence.score,
      blocks: result.briefing.blocks.length,
    });

    return NextResponse.json(response, {
      headers: {
        'X-Correlation-Id': correlationId,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('advisor:api:unhandled-error', {
      correlationId,
      error: String(error),
    });

    return NextResponse.json(
      {
        error: 'Internal advisor error',
        correlationId,
      },
      { status: 500 },
    );
  }
}

// ─── GET /api/ai/advisor — List Conversations ─────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const conversations = await advisorConversationApi.listConversations({
      companyId: companyId || undefined,
      userId: undefined,
      limit,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    logger.error('advisor:api:list-failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 },
    );
  }
}
