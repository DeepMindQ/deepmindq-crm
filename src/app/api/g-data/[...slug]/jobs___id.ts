import { NextRequest, NextResponse } from 'next/server';
import { getJobDetail, retryJob, cancelJob } from '@/lib/workflow-engine';

/**
 * GET /api/g-data/jobs/[id]
 * POST /api/g-data/jobs/[id]/retry
 * POST /api/g-data/jobs/[id]/cancel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const jobId = slug[1];
    if (!jobId) return NextResponse.json({ error: 'Job ID required' }, { status: 400 });

    const job = await getJobDetail(jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('[jobs/:id]', error.message);
    return NextResponse.json({ error: 'Failed to get job', detail: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const jobId = slug[1];
    const action = slug[2]; // 'retry' or 'cancel'

    if (!jobId || !action) {
      return NextResponse.json({ error: 'Job ID and action required' }, { status: 400 });
    }

    if (action === 'retry') {
      const result = await retryJob(jobId);
      return NextResponse.json(result);
    }

    if (action === 'cancel') {
      await cancelJob(jobId);
      return NextResponse.json({ success: true, message: 'Job cancelled' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[jobs/:id/action]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}