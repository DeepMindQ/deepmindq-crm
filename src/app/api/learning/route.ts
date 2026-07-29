import { NextRequest, NextResponse } from 'next/server';
import { ContinuousLearningLoop } from '@/lib/continuous-learning-loop';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// POST /api/learning — Record a learning event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, eventType, source, description, learnedInsight, applicableContext, applicableTags, confidence } = body;
    if (!eventType || !learnedInsight) {
      return apiError('eventType and learnedInsight are required', 400);
    }

    const eventId = await ContinuousLearningLoop.record({
      companyId,
      eventType,
      source: source || 'system',
      description: description || learnedInsight.slice(0, 200),
      learnedInsight,
      applicableContext,
      applicableTags,
      confidence,
    });
    return apiSuccess({ eventId });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

// GET /api/learning?companyId=xxx — Find reusable learnings
export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter required', 400);

  try {
    // Get company context for matching
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) return apiError('Company not found', 404);

    const learnings = await ContinuousLearningLoop.findReusableLearnings({
      industry: company.industry || undefined,
      companySize: company.sizeRange || undefined,
    });
    return apiSuccess(learnings);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
