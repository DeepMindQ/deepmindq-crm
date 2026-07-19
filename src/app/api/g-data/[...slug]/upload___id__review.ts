import { NextRequest, NextResponse } from 'next/server';
import { getReviewSummary, getReviewRows } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/upload/[id]/review
 *
 * Get review data: summary + filtered/paginated rows.
 * Query params: filter, page, pageSize
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const uploadId = slug[1];

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const filter = (url.searchParams.get('filter') || 'all') as any;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);
    const view = url.searchParams.get('view') || 'rows'; // 'summary' or 'rows'

    if (view === 'summary') {
      const summary = await getReviewSummary(uploadId);
      return NextResponse.json(summary);
    }

    const [summary, rowsData] = await Promise.all([
      getReviewSummary(uploadId),
      getReviewRows(uploadId, filter, page, Math.min(pageSize, 100)),
    ]);

    return NextResponse.json({ summary, ...rowsData });
  } catch (error: any) {
    console.error('[upload/review]', error.message);
    return NextResponse.json({ error: 'Review failed', detail: error.message }, { status: 500 });
  }
}