import { NextResponse } from 'next/server';
import { retryAllFailed, processNextJobs, recoverStaleJobs, getQueueStats, queuePendingJobs } from '@/lib/workflow-engine';

/**
 * POST /api/g-data/jobs/retry-all-failed
 * POST /api/g-data/jobs/process-next
 * POST /api/g-data/jobs/recover-stale
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'retry-all-failed': {
        const result = await retryAllFailed();
        return NextResponse.json({ success: true, ...result });
      }

      case 'process-next': {
        const limit = body.limit || 5;
        // Recover stale jobs first
        await recoverStaleJobs(30);
        // Queue pending jobs
        await queuePendingJobs(limit);
        // Process
        const result = await processNextJobs(limit);
        return NextResponse.json({ success: true, ...result });
      }

      case 'recover-stale': {
        const timeoutMinutes = body.timeoutMinutes || 30;
        const recovered = await recoverStaleJobs(timeoutMinutes);
        return NextResponse.json({ success: true, recovered });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[jobs/action]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}