/**
 * WI-17C — Recommendations API
 *
 * GET /api/recommendations
 *   Query params:
 *     ?limit=50              — max recommendations (default 50)
 *     ?tier=HOT_ACCOUNT      — filter by tier
 *     ?minScore=40           — filter by minimum score
 *     ?activeSignalsOnly=true — only companies with active signals
 *     ?sortBy=opportunityScore|confidenceScore|signalCount|recentActivity
 *     ?view=stats             — return engine stats instead of recommendations
 *
 * Returns prioritized list of account recommendations.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  generateAllRecommendations,
  getRecommendationStats,
  type RecommendationListOptions,
} from '@/lib/recommendation-engine';

const VALID_TIERS = ['HOT_ACCOUNT', 'WARM_ACCOUNT', 'NURTURE', 'AT_RISK'];
const VALID_SORT_FIELDS = ['opportunityScore', 'confidenceScore', 'signalCount', 'recentActivity'];

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  // Stats view
  if (view === 'stats') {
    try {
      const stats = await getRecommendationStats();
      return NextResponse.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[RecommendationsAPI] Stats failed:', { error });
      return NextResponse.json({ error: 'Failed to fetch recommendation stats' }, { status: 500 });
    }
  }

  // Recommendations view
  try {
    const options: RecommendationListOptions = {
      limit: parseInt(searchParams.get('limit') || '50', 10),
    };

    const tier = searchParams.get('tier');
    if (tier && VALID_TIERS.includes(tier)) {
      options.tier = tier as RecommendationListOptions['tier'];
    }

    const minScore = parseInt(searchParams.get('minScore') || '0', 10);
    if (minScore > 0) options.minScore = minScore;

    const activeSignalsOnly = searchParams.get('activeSignalsOnly');
    if (activeSignalsOnly === 'true') options.activeSignalsOnly = true;

    const sortBy = searchParams.get('sortBy');
    if (sortBy && VALID_SORT_FIELDS.includes(sortBy)) {
      options.sortBy = sortBy as RecommendationListOptions['sortBy'];
    }

    const result = await generateAllRecommendations(options);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('[RecommendationsAPI] Failed:', { error });
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}
