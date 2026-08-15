import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

// ── Status Mapping ──────────────────────────────────────
// Recommendation-facing statuses → Insight DB statuses
const REC_TO_DB: Record<string, string> = {
  pending: 'active',
  accepted: 'acted_upon',
  dismissed: 'dismissed',
  expired: 'expired',
};

const DB_TO_REC: Record<string, string> = {
  active: 'pending',
  acted_upon: 'accepted',
  dismissed: 'dismissed',
  expired: 'expired',
};

// ── Validation Schemas ──────────────────────────────────
const idParamSchema = z.string().min(1);

const feedbackSchema = z.object({
  sentiment: z.enum(['positive', 'negative']),
  comment: z.string().max(1000).optional(),
});

const updateRecommendationSchema = z.object({
  status: z.enum(['accepted', 'dismissed', 'expired']).optional(),
  feedback: feedbackSchema.optional(),
});

/**
 * PATCH /api/recommendations/[id]
 *
 * Update a recommendation's status (accept/dismiss/expire)
 * and optionally attach user feedback.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        { error: 'Invalid recommendation ID', details: idParsed.error.flatten() },
        { status: 400 },
      );
    }
    const validId = idParsed.data;

    const body = await request.json();
    const parsed = updateRecommendationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify the insight exists and is a recommendation
    const existing = await db.insight.findUnique({
      where: { id: validId },
    });

    if (!existing || existing.category !== 'recommendation') {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};

    if (parsed.data.status) {
      updateData.status = REC_TO_DB[parsed.data.status];
      // Store dismiss reason if feedback is provided
      if (parsed.data.feedback?.comment) {
        updateData.dismissedReason = parsed.data.feedback.comment;
      }
    }

    // If feedback provided without status change, still store it
    if (parsed.data.feedback && !parsed.data.status) {
      if (parsed.data.feedback.comment) {
        updateData.dismissedReason = parsed.data.feedback.comment;
      }
    }

    const updated = await db.insight.update({
      where: { id: validId },
      data: updateData,
      include: {
        organization: { select: { name: true, domain: true, industry: true } },
        signal: { select: { id: true, title: true, signalType: true } },
      },
    });

    // Store feedback in audit log if sentiment was provided
    if (parsed.data.feedback) {
      await db.auditLog.create({
        data: {
          action: 'feedback',
          resource: `recommendation:${validId}`,
          details: JSON.stringify({
            sentiment: parsed.data.feedback.sentiment,
            comment: parsed.data.feedback.comment || null,
          }),
        },
      });
    }

    return NextResponse.json({
      data: {
        id: updated.id,
        title: updated.title,
        narrative: updated.narrative,
        recommendation: updated.recommendation,
        suggestedMessage: updated.suggestedMessage,
        confidence: updated.confidence,
        confidenceScore: updated.confidenceScore,
        status: DB_TO_REC[updated.status] || updated.status,
        dismissedReason: updated.dismissedReason,
        evidenceIds: updated.evidenceIds,
        signalIds: updated.signalIds,
        reasoningMethod: updated.reasoningMethod,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        organization: updated.organization,
        signal: updated.signal,
        feedback: parsed.data.feedback ?? undefined,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 });
  }
}
