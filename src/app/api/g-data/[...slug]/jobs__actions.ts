import { NextResponse } from 'next/server';
import { retryAllFailed, processNextJobs, recoverStaleJobs, getQueueStats, queuePendingJobs, enqueueBulkEnrichment } from '@/lib/workflow-engine';

/**
 * POST /api/g-data/jobs/actions
 *
 * Actions:
 * - retry-all-failed: Retry all failed jobs that haven't exhausted attempts
 * - process-next: Queue pending jobs and process next N queued jobs
 * - recover-stale: Mark long-running jobs as failed (server restart recovery)
 * - enqueue-enrichment: Bulk-create enrichment jobs for given company IDs
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

      case 'enqueue-enrichment': {
        const companyIds = body.companyIds as string[];
        if (!Array.isArray(companyIds) || companyIds.length === 0) {
          return NextResponse.json({ error: 'companyIds array required' }, { status: 400 });
        }
        const result = await enqueueBulkEnrichment(companyIds, {
          force: body.force === true,
          priority: body.priority ?? 5,
        });

        // Auto-trigger processing: fire-and-forget the first batch so jobs start immediately.
        // The Vercel Cron endpoint handles ongoing polling for remaining jobs.
        if (result.created > 0) {
          processNextJobs(Math.min(result.created, 3)).catch(err => {
            console.error('[jobs/action] Auto-process after enqueue failed (non-blocking):', err.message);
          });
        }

        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[jobs/action]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}