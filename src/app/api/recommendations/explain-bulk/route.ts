/**
 * WI-17D — Bulk Explainability Summary API
 *
 * GET /api/recommendations/explain-bulk
 *   Query params:
 *     ?companyIds=id1,id2,id3  — specific company IDs (required)
 *     ?limit=50                — limit for batch processing
 *
 * Returns lightweight explainability summaries for multiple companies.
 * Used in the recommendation list view to show trust indicators at a glance.
 *
 * Each summary includes:
 *   - Top 3 evidence items
 *   - Risk summary by severity
 *   - Overall data quality
 *   - Source diversity score
 *   - Top improvement opportunity
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { generateBulkExplainabilitySummaries, getExplainabilityStats } from '@/lib/explainability-engine';

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  // Stats view
  if (view === 'stats') {
    try {
      const stats = getExplainabilityStats();
      return NextResponse.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[ExplainabilityBulkAPI] Stats failed:', { error });
      return NextResponse.json({ error: 'Failed to fetch explainability stats' }, { status: 500 });
    }
  }

  // Bulk summaries view
  try {
    const companyIdsParam = searchParams.get('companyIds');
    if (!companyIdsParam) {
      return NextResponse.json(
        { error: 'companyIds query parameter is required (comma-separated IDs)' },
        { status: 400 }
      );
    }

    const companyIds = companyIdsParam.split(',').map(id => id.trim()).filter(Boolean);

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one company ID is required' },
        { status: 400 }
      );
    }

    if (companyIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 company IDs per request' },
        { status: 400 }
      );
    }

    const summaries = await generateBulkExplainabilitySummaries(companyIds);

    return NextResponse.json({
      success: true,
      data: {
        summaries: Array.from(summaries.entries()).map(([companyId, summary]) => ({
          ...summary,
        })),
        total: summaries.size,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[ExplainabilityBulkAPI] Failed:', { error });
    return NextResponse.json({ error: 'Failed to generate explainability summaries' }, { status: 500 });
  }
}
