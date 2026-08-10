/**
 * WI-17E — Learning Analytics API
 *
 * GET /api/feedback/learning
 *   ?view=analytics          — system-wide learning analytics
 *   ?view=calibration        — confidence calibration adjustments
 *   ?companyId=id             — company-specific calibration
 *   ?view=memories           — search feedback learning memories
 *   ?query=search+text        — search query for memories (with view=memories)
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  getLearningAnalytics,
  getCalibrationAdjustments,
  searchFeedbackMemories,
} from '@/lib/feedback-learning-loop';

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'analytics';

  try {
    switch (view) {
      case 'analytics': {
        const analytics = await getLearningAnalytics();
        return NextResponse.json({ success: true, data: analytics });
      }

      case 'calibration': {
        const companyId = searchParams.get('companyId') || undefined;
        const adjustments = await getCalibrationAdjustments(companyId);
        return NextResponse.json({ success: true, data: { adjustments, generatedAt: new Date().toISOString() } });
      }

      case 'memories': {
        const query = searchParams.get('query') || '';
        const companyId = searchParams.get('companyId') || undefined;
        const memories = await searchFeedbackMemories(query, { companyId, limit: 20 });
        return NextResponse.json({ success: true, data: { memories, total: memories.length } });
      }

      default:
        return NextResponse.json({ error: `Unknown view: ${view}. Use analytics, calibration, or memories.` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[FeedbackAPI] Learning endpoint failed:', { error });
    return NextResponse.json({ error: 'Failed to fetch learning data' }, { status: 500 });
  }
}
