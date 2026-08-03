/**
 * WI-17E — Company Feedback Stats API
 *
 * GET /api/feedback/[companyId]
 *
 * Returns feedback statistics for a specific company.
 * Shows useful rate, top reasons, outcomes, and learning history.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { getCompanyFeedbackStats } from '@/lib/feedback-learning-loop';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const { companyId } = await params;

  try {
    const stats = await getCompanyFeedbackStats(companyId);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[FeedbackAPI] Company stats failed:', { error, companyId });
    return NextResponse.json({ error: 'Failed to fetch feedback stats' }, { status: 500 });
  }
}
