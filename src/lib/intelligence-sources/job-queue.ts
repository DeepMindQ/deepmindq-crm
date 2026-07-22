/**
 * Phase 7.5: Database-Backed Async Job Queue
 *
 * Sequential in-process worker. No Redis, no BullMQ.
 * Uses ConnectorRun records for persistence.
 */

import { db } from '@/lib/db';

export interface JobPayload {
  connectorId: string;
  action: 'acquire' | 'test' | 'sync';
  config: Record<string, unknown>;
}

export interface QueuedJob {
  id: string;
  connectorId: string;
  status: string;
  payload: JobPayload;
}

// In-memory queue for sequential processing
let isProcessing = false;
const pendingJobs: QueuedJob[] = [];
let jobProcessor: ((job: QueuedJob) => Promise<void>) | null = null;

/**
 * Register the job processor function.
 * Called from the API layer to wire up connector execution.
 */
export function registerJobProcessor(processor: (job: QueuedJob) => Promise<void>): void {
  jobProcessor = processor;
}

/**
 * Enqueue a job for async processing.
 * Creates a ConnectorRun record and adds to in-memory queue.
 */
export async function enqueueJob(payload: JobPayload): Promise<string> {
  const run = await db.connectorRun.create({
    data: {
      connectorId: payload.connectorId,
      status: 'pending',
    },
  });

  const job: QueuedJob = {
    id: run.id,
    connectorId: payload.connectorId,
    status: 'pending',
    payload,
  };

  pendingJobs.push(job);

  // Trigger processing if not already running
  if (!isProcessing) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    processQueue();
  }

  return run.id;
}

/**
 * Process jobs sequentially from the queue.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (pendingJobs.length > 0) {
    const job = pendingJobs.shift()!;

    try {
      await db.connectorRun.update({
        where: { id: job.id },
        data: { status: 'running', startedAt: new Date() },
      });

      if (jobProcessor) {
        await jobProcessor(job);
      }

      await db.connectorRun.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Update connector health
      await db.connector.update({
        where: { id: job.connectorId },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          totalRuns: { increment: 1 },
          failureCount: 0,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await db.connectorRun.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: message,
          errorsCount: { increment: 1 },
        },
      });

      await db.connector.update({
        where: { id: job.connectorId },
        data: {
          lastRunAt: new Date(),
          totalRuns: { increment: 1 },
          failureCount: { increment: 1 },
          errorMessage: message,
        },
      });
    }
  }

  isProcessing = false;
}

/** Get job status */
export async function getJobStatus(runId: string) {
  return db.connectorRun.findUnique({ where: { id: runId } });
}

/** Get all runs for a connector */
export async function getConnectorRuns(connectorId: string, limit = 20) {
  return db.connectorRun.findMany({
    where: { connectorId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/** Get pending job count (for status display) */
export function getPendingCount(): number {
  return pendingJobs.length;
}

/** Check if queue is processing */
export function isQueueProcessing(): boolean {
  return isProcessing;
}