/**
 * Job Queue — Workflow Automation Engine (Phase 2)
 *
 * Database-backed job queue. All state persisted in the Job table.
 * Survives server restarts, crashes, and cold starts.
 *
 * Job lifecycle: pending → queued → running → completed | failed | cancelled
 * Retries: failed jobs with retryable errors get nextRetryAt set by retry.ts
 */

import { db } from '@/lib/db';
import { logJobEvent } from './index';

// ── Types ──

export type JobType =
  | 'enrichment'
  | 'research'
  | 'scoring'
  | 'signal_detection'
  | 'email_generation';

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CreateJobParams {
  type: JobType;
  companyId?: string;
  contactId?: string;
  batchId?: string;
  priority?: number;       // 1 (highest) – 10 (lowest)
  maxAttempts?: number;
  payload?: Record<string, unknown>;
}

export interface JobSummary {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: number;
  companyId: string | null;
  progress: number;
  currentStep: string | null;
  error: string | null;
  errorCode: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface JobDetail extends JobSummary {
  contactId: string | null;
  batchId: string | null;
  stepDetail: string | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  nextRetryAt: string | null;
  queuedAt: string | null;
  logs: Array<{
    id: string;
    level: string;
    step: string | null;
    message: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface QueueStats {
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
  retryable: number;       // failed jobs with nextRetryAt set
}

// ── Create Job ──

export async function createJob(params: CreateJobParams): Promise<string> {
  const job = await db.job.create({
    data: {
      type: params.type,
      companyId: params.companyId || null,
      contactId: params.contactId || null,
      batchId: params.batchId || null,
      priority: params.priority ?? 5,
      maxAttempts: params.maxAttempts ?? 3,
      payload: params.payload ? JSON.stringify(params.payload) : null,
      status: 'pending',
    },
  });

  return job.id;
}

// ── Queue Jobs (transition pending → queued) ──

export async function queuePendingJobs(limit: number = 10): Promise<number> {
  // Get pending jobs ordered by priority (1 = highest first), then createdAt
  const pendingJobs = await db.job.findMany({
    where: { status: 'pending' },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'asc' },
    ],
    take: limit,
    select: { id: true },
  });

  if (pendingJobs.length === 0) return 0;

  const now = new Date();
  await db.job.updateMany({
    where: {
      id: { in: pendingJobs.map(j => j.id) },
    },
    data: {
      status: 'queued',
      queuedAt: now,
    },
  });

  return pendingJobs.length;
}

// ── Start Job (transition queued → running) ──

export async function startJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== 'queued') throw new Error(`Job ${jobId} is not queued (current: ${job.status})`);

  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      progress: 0,
      error: null,
      errorCode: null,
    },
  });

  await logJobEvent(jobId, 'info', 'job_started', `Job started: ${job.type}`);
}

// ── Complete Job ──

export async function completeJob(
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      result: result ? JSON.stringify(result) : null,
      currentStep: 'completed',
      stepDetail: null,
    },
  });

  await logJobEvent(jobId, 'info', 'job_completed', 'Job completed successfully');
}

// ── Fail Job ──

export async function failJob(
  jobId: string,
  error: string,
  errorCode: string,
  isRetryable: boolean = false,
  nextRetryAt?: Date
): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  const newAttemptCount = job.attemptCount + 1;
  const isPermanentlyFailed = !isRetryable || newAttemptCount >= job.maxAttempts;

  await db.job.update({
    where: { id: jobId },
    data: {
      status: isPermanentlyFailed ? 'failed' : 'failed',
      error: error,
      errorCode: errorCode,
      attemptCount: newAttemptCount,
      completedAt: isPermanentlyFailed ? new Date() : null,
      nextRetryAt: isPermanentlyFailed ? null : (nextRetryAt || null),
    },
  });

  await logJobEvent(jobId, 'error', 'job_failed', error, {
    errorCode,
    isRetryable,
    attempt: newAttemptCount,
    maxAttempts: job.maxAttempts,
  });
}

// ── Cancel Job ──

export async function cancelJob(jobId: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw new Error(`Cannot cancel job in ${job.status} state`);
  }

  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
    },
  });

  await logJobEvent(jobId, 'info', 'job_cancelled', 'Job cancelled');
}

// ── Update Progress ──

export async function updateJobProgress(
  jobId: string,
  progress: number,
  currentStep: string,
  stepDetail?: { step: string; progress: number; message?: string }
): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: {
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      currentStep,
      stepDetail: stepDetail ? JSON.stringify(stepDetail) : null,
    },
  });
}

// ── Get Jobs ──

export async function getJobs(filters?: {
  status?: JobStatus | 'all';
  type?: JobType | 'all';
  companyId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ jobs: JobSummary[]; total: number; pages: number }> {
  const where: Record<string, unknown> = {};
  if (filters?.status && filters.status !== 'all') where.status = filters.status;
  if (filters?.type && filters.type !== 'all') where.type = filters.type;
  if (filters?.companyId) where.companyId = filters.companyId;

  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;

  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, type: true, status: true, priority: true,
        companyId: true, progress: true, currentStep: true,
        error: true, errorCode: true, attemptCount: true, maxAttempts: true,
        createdAt: true, startedAt: true, completedAt: true,
      },
    }),
    db.job.count({ where }),
  ]);

  return {
    jobs: jobs.map(j => ({
      id: j.id,
      type: j.type as JobType,
      status: j.status as JobStatus,
      priority: j.priority,
      companyId: j.companyId,
      progress: j.progress,
      currentStep: j.currentStep ?? null,
      error: j.error ?? null,
      errorCode: j.errorCode ?? null,
      attemptCount: j.attemptCount,
      maxAttempts: j.maxAttempts,
      createdAt: j.createdAt.toISOString(),
      startedAt: j.startedAt?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
    total,
    pages: Math.ceil(total / pageSize),
  };
}

// ── Get Single Job Detail ──

export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      logs: {
        orderBy: { createdAt: 'asc' },
        take: 100,
      },
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    type: job.type as JobType,
    status: job.status as JobStatus,
    priority: job.priority,
    companyId: job.companyId,
    contactId: job.contactId,
    batchId: job.batchId,
    progress: job.progress,
    currentStep: job.currentStep,
    stepDetail: job.stepDetail,
    error: job.error,
    errorCode: job.errorCode,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    payload: job.payload ? JSON.parse(job.payload) : null,
    result: job.result ? JSON.parse(job.result) : null,
    nextRetryAt: job.nextRetryAt?.toISOString() || null,
    queuedAt: job.queuedAt?.toISOString() || null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
    logs: job.logs.map(l => ({
      id: l.id,
      level: l.level,
      step: l.step,
      message: l.message,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

// ── Get Queue Stats ──

export async function getQueueStats(): Promise<QueueStats> {
  const counts = await db.job.groupBy({
    by: ['status'],
    _count: true,
  });

  const stats: QueueStats = {
    pending: 0, queued: 0, running: 0,
    completed: 0, failed: 0, cancelled: 0,
    total: 0, retryable: 0,
  };

  for (const c of counts) {
    const count = c._count;
    stats.total += count;
    if (c.status === 'pending') stats.pending = count;
    else if (c.status === 'queued') stats.queued = count;
    else if (c.status === 'running') stats.running = count;
    else if (c.status === 'completed') stats.completed = count;
    else if (c.status === 'failed') stats.failed = count;
    else if (c.status === 'cancelled') stats.cancelled = count;
  }

  // Count retryable: failed jobs with nextRetryAt set and attempts < maxAttempts
  stats.retryable = await db.job.count({
    where: {
      status: 'failed',
      nextRetryAt: { not: null },
    },
  });

  return stats;
}

// ── Retry a Single Job ──

export async function retryJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) return { success: false, message: 'Job not found' };
  if (job.status !== 'failed') return { success: false, message: `Cannot retry job in ${job.status} state` };
  if (job.attemptCount >= job.maxAttempts) {
    return { success: false, message: `Job has reached max attempts (${job.maxAttempts})` };
  }

  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      error: null,
      errorCode: null,
      nextRetryAt: null,
      progress: 0,
      currentStep: null,
      stepDetail: null,
    },
  });

  await logJobEvent(jobId, 'info', 'job_retry_queued', 'Job queued for retry (manual)');

  return { success: true, message: 'Job queued for retry' };
}

// ── Retry All Failed Jobs ──

export async function retryAllFailed(): Promise<{ queued: number; skipped: number }> {
  const failedJobs = await db.job.findMany({
    where: {
      status: 'failed',
      attemptCount: { lt: 3 }, // don't retry already-exhausted
    },
    select: { id: true, attemptCount: true, maxAttempts: true },
  });

  let queued = 0;
  let skipped = 0;

  for (const job of failedJobs) {
    if (job.attemptCount >= job.maxAttempts) {
      skipped++;
      continue;
    }

    await db.job.update({
      where: { id: job.id },
      data: {
        status: 'pending',
        error: null,
        errorCode: null,
        nextRetryAt: null,
        progress: 0,
        currentStep: null,
        stepDetail: null,
      },
    });
    queued++;
  }

  return { queued, skipped };
}