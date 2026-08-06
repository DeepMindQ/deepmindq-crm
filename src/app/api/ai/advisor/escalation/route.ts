/**
 * POST /api/ai/advisor/escalation
 *
 * Create a human assistance escalation request.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { advisorConversationApi } from '@/lib/advisor/advisor-persistence';

const EscalationSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  reason: z.enum(['low_confidence', 'conflicting_evidence', 'complex_analysis', 'data_gap', 'user_request']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional().default('medium'),
  description: z.string().min(1).max(2000),
  contextSnapshot: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EscalationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const escalation = await advisorConversationApi.createEscalation({
      conversationId: parsed.data.conversationId,
      messageId: parsed.data.messageId,
      reason: parsed.data.reason,
      priority: parsed.data.priority,
      description: parsed.data.description,
      contextSnapshot: parsed.data.contextSnapshot,
    });

    return NextResponse.json({ escalation }, { status: 201 });
  } catch (error) {
    logger.error('advisor:escalation:create-failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to create escalation' },
      { status: 500 },
    );
  }
}
