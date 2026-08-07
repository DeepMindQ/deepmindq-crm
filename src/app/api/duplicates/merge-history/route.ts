/**
 * GET /api/duplicates/merge-history
 *
 * List all past merges with pagination.
 * Query: ?page=1&limit=20&entityType=company
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { getMergeHistory } from '@/lib/data-intelligence/dedup-engine';

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const entityType = url.searchParams.get('entityType') || undefined;

  try {
    const result = await getMergeHistory({ page, limit, entityType });
    return NextResponse.json({
      success: true,
      records: result.records,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    logger.error('Merge history fetch error:', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch merge history' },
      { status: 500 },
    );
  }
}
