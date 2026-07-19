import { NextRequest, NextResponse } from 'next/server';
import { getJobs, getQueueStats } from '@/lib/workflow-engine';

/**
 * GET /api/g-data/jobs
 *
 * List jobs with optional filters.
 * Query params: status, type, companyId, page, pageSize
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';
    const companyId = searchParams.get('companyId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const includeStats = searchParams.get('stats') === 'true';

    const result = await getJobs({
      status: status as any,
      type: type as any,
      companyId,
      page,
      pageSize: Math.min(pageSize, 100),
    });

    const response: Record<string, unknown> = { ...result };

    if (includeStats) {
      response.stats = await getQueueStats();
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[jobs]', error.message);
    return NextResponse.json({ error: 'Failed to list jobs', detail: error.message }, { status: 500 });
  }
}