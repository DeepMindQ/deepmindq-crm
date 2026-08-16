import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

// ── Validation Schema ──────────────────────────────────
const feedbackPostSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  context: z.string().max(500).optional(),
  itemId: z.string().max(100),
  itemType: z.string().max(50),
  comment: z.string().max(2000).optional(),
});

/**
 * POST /api/feedback
 *
 * Receive user feedback and persist it to the audit log.
 */
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = feedbackPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { sentiment, context, itemId, itemType, comment } = parsed.data;

    const entry = await db.auditLog.create({
      data: {
        action: 'feedback',
        resource: itemType,
        details: JSON.stringify({
          sentiment,
          context: context || null,
          itemId,
          itemType,
          comment: comment || null,
        }),
      },
    });

    return NextResponse.json({
      data: {
        id: entry.id,
        action: entry.action,
        sentiment,
        itemId,
        itemType,
        createdAt: entry.createdAt,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
