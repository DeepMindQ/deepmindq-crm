/**
 * Workflow Engine — Public API & Utilities (Phase 2)
 *
 * Barrel export + shared utilities.
 */

import { db } from '@/lib/db';

// Re-export everything
export * from './queue';
export * from './retry';
export { processJob, processNextJobs } from './processor';

// ── Job Logging Utility ──

/**
 * Log an event to the JobLog table.
 * Lightweight — used by queue.ts and processor.ts.
 */
export async function logJobEvent(
  jobId: string,
  level: 'info' | 'warn' | 'error' | 'debug',
  step: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.jobLog.create({
      data: {
        jobId,
        level,
        step,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    // Don't let logging failures break the job pipeline
    console.error(`[workflow] Failed to log job event:`, err);
  }
}

// ── Get Retryable Jobs Due for Retry ──

export async function getRetryableJobs(): Promise<Array<{ id: string; type: string; attemptCount: number }>> {
  return db.job.findMany({
    where: {
      status: 'failed',
      nextRetryAt: { lte: new Date() },
    },
    select: { id: true, type: true, attemptCount: true },
    take: 20,
  });
}

// ── Cleanup: Mark Stale Running Jobs as Failed ──

export async function recoverStaleJobs(timeoutMinutes: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  const staleJobs = await db.job.findMany({
    where: {
      status: 'running',
      startedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (staleJobs.length === 0) return 0;

  for (const job of staleJobs) {
    await db.job.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: 'Job timed out — server likely restarted',
        errorCode: 'STALE_JOB',
      },
    });

    await logJobEvent(job.id, 'error', 'stale_job_recovered', 'Job was running but timed out (server restart?)');
  }

  return staleJobs.length;
}

// ── Create Enrichment Job (convenience wrapper) ──

export async function enqueueEnrichment(
  companyId: string,
  options?: { priority?: number; force?: boolean }
): Promise<string> {
  const { createJob } = await import('./queue');
  return createJob({
    type: 'enrichment',
    companyId,
    priority: options?.priority ?? 5,
    payload: { force: options?.force ?? false },
  });
}

// ── Bulk Enqueue ──

export async function enqueueBulkEnrichment(
  companyIds: string[],
  options?: { priority?: number; force?: boolean }
): Promise<{ created: number; skipped: number }> {
  const { createJob } = await import('./queue');

  // Check for existing active jobs for these companies
  const existingActiveJobs = await db.job.findMany({
    where: {
      companyId: { in: companyIds },
      status: { in: ['pending', 'queued', 'running'] },
      type: 'enrichment',
    },
    select: { companyId: true },
  });

  const activeCompanyIds = new Set(existingActiveJobs.map(j => j.companyId!));

  let created = 0;
  let skipped = 0;

  for (const companyId of companyIds) {
    if (activeCompanyIds.has(companyId)) {
      skipped++;
      continue;
    }
    await createJob({
      type: 'enrichment',
      companyId,
      priority: options?.priority ?? 5,
      payload: { force: options?.force ?? false },
    });
    created++;
  }

  return { created, skipped };
}