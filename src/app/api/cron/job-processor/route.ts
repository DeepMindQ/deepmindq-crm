import { NextResponse } from 'next/server';
import { processNextJobs, recoverStaleJobs } from '@/lib/workflow-engine';

/**
 * GET /api/cron/job-processor
 *
 * Called by Vercel Cron every 2 minutes to auto-process pending/queued jobs.
 * Also recovers stale jobs (running > 30 min, likely from a serverless timeout).
 *
 * Vercel Cron config is in vercel.json (crons array).
 * This endpoint is also safe to call manually for testing.
 */
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (Authorization header)
  // Vercel sets the "Authorization" header with the cron secret
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Step 1: Recover stale jobs (running > 30 min without completion)
    const recovered = await recoverStaleJobs(30);

    // Step 2: Process next batch of pending/queued jobs
    const result = await processNextJobs(5);

    const duration = Date.now() - startTime;

    console.log(
      `[cron/job-processor] ${duration}ms — processed: ${result.processed}, ` +
      `succeeded: ${result.succeeded}, failed: ${result.failed}, ` +
      `recovered: ${recovered}`
    );

    return NextResponse.json({
      ok: true,
      duration_ms: duration,
      recovered,
      ...result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[cron/job-processor] Failed (${Date.now() - startTime}ms):`, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}