/**
 * Connector Scheduler — Sprint 3
 *
 * Provides scheduled execution tracking for intelligence-source connectors:
 * calculating next runs, checking due connectors, manual triggers with
 * schedule awareness, and batch execution of all due connectors.
 */

import { db } from '@/lib/db';
import type { SourceType } from './types';
import { enqueueJob } from './job-queue';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** Supported schedule frequencies. */
export type ScheduleFrequency = 'manual' | 'hourly' | 'daily' | 'weekly';

/** A connector enriched with scheduling metadata. */
export interface ScheduledConnector {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  scheduleFrequency: string;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  nextRunAt: Date;
  due: boolean;
  healthScore: number | null;
}

/** High-level overview of the connector schedule landscape. */
export interface ScheduleOverview {
  totalConnectors: number;
  scheduledConnectors: number;
  manualConnectors: number;
  byFrequency: Record<string, number>;
  dueNow: number;
  nextScheduledRun: Date | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the next scheduled run time for a connector.
 *
 * - `manual`  → effectively never (1 year from now).
 * - `hourly`  → base + 1 hour.
 * - `daily`   → base + 24 hours (defaults to tomorrow 02:00 if never run).
 * - `weekly`  → base + 7 days (defaults to next Monday 02:00 if never run).
 */
function calculateNextRun(frequency: string, lastRunAt: Date | null): Date {
  const now = new Date();

  if (frequency === 'manual') {
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

  const base = lastRunAt ? new Date(lastRunAt.getTime()) : now;

  switch (frequency) {
    case 'hourly':
      base.setHours(base.getHours() + 1);
      break;

    case 'daily': {
      if (!lastRunAt) {
        base.setHours(2, 0, 0, 0);
        if (base <= now) base.setDate(base.getDate() + 1);
      } else {
        base.setDate(base.getDate() + 1);
      }
      break;
    }

    case 'weekly': {
      if (!lastRunAt) {
        base.setHours(2, 0, 0, 0);
        const day = base.getDay();
        const daysUntilMon = day === 1 ? 7 : ((8 - day) % 7);
        base.setDate(base.getDate() + daysUntilMon);
        if (base <= now) base.setDate(base.getDate() + 7);
      } else {
        base.setDate(base.getDate() + 7);
      }
      break;
    }

    default:
      base.setTime(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

  return base;
}

/**
 * Map a raw connector row (with optional sourceHealth) to a ScheduledConnector.
 */
function toScheduledConnector(
  row: {
    id: string;
    name: string;
    sourceType: string;
    status: string;
    scheduleFrequency: string | null;
    lastRunAt: Date | null;
    lastSuccessAt: Date | null;
    sourceHealth?: { healthScore: number } | null;
  },
  now: Date,
): ScheduledConnector {
  const nextRunAt = calculateNextRun(row.scheduleFrequency ?? 'manual', row.lastRunAt);
  return {
    id: row.id,
    name: row.name,
    sourceType: row.sourceType,
    status: row.status,
    scheduleFrequency: row.scheduleFrequency ?? 'manual',
    lastRunAt: row.lastRunAt,
    lastSuccessAt: row.lastSuccessAt,
    nextRunAt,
    due: nextRunAt <= now,
    healthScore: row.sourceHealth?.healthScore ?? null,
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Fetch all connectors with a non-manual schedule frequency that are active,
 * enriched with their calculated next-run time and due status.
 *
 * Results are sorted by `nextRunAt` ascending so the most overdue connectors
 * appear first.
 */
export async function getScheduledConnectors(): Promise<ScheduledConnector[]> {
  const now = new Date();

  const connectors = await db.connector.findMany({
    where: {
      scheduleFrequency: { not: 'manual' },
      status: 'active',
    },
    include: { sourceHealth: { select: { healthScore: true } } },
    orderBy: { lastRunAt: 'asc' },
  });

  const scheduled = connectors.map((c) => toScheduledConnector(c, now));

  scheduled.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());

  return scheduled;
}

/**
 * Return only the scheduled connectors whose `nextRunAt` has passed (i.e. they
 * are due for execution right now).
 */
export async function getDueConnectors(): Promise<ScheduledConnector[]> {
  const all = await getScheduledConnectors();
  return all.filter((c) => c.due);
}

/**
 * Immediately trigger a connector run via the job queue.
 *
 * Validates that the connector exists and is active, then enqueues an
 * `acquire` job and stamps `lastRunAt` to prevent immediate re-triggering.
 *
 * @param connectorId - The ID of the connector to run.
 * @returns The ID of the created job run and the connector ID.
 * @throws {Error} If the connector does not exist or is not active.
 */
export async function triggerScheduledRun(
  connectorId: string,
): Promise<{ runId: string; connectorId: string }> {
  const connector = await db.connector.findUnique({
    where: { id: connectorId },
  });

  if (!connector) {
    throw new Error(`Connector with id "${connectorId}" not found`);
  }

  if (connector.status !== 'active') {
    throw new Error(
      `Connector "${connector.name}" (${connectorId}) is not active (status: ${connector.status})`,
    );
  }

  let parsedConfig: Record<string, unknown> = {};
  try {
    parsedConfig =
      typeof connector.config === 'string'
        ? JSON.parse(connector.config)
        : (connector.config as Record<string, unknown>);
  } catch {
    parsedConfig = {};
  }

  const runId = await enqueueJob({
    connectorId,
    action: 'acquire',
    config: {
      ...parsedConfig,
      sourceType: connector.sourceType,
    },
  });

  // Stamp lastRunAt immediately so the scheduler does not re-trigger
  // before the async job completes.
  await db.connector.update({
    where: { id: connectorId },
    data: { lastRunAt: new Date() },
  });

  return { runId, connectorId };
}

/**
 * Trigger all connectors that are currently due for execution.
 *
 * Individual failures are caught and reported so that one bad connector
 * does not prevent the rest of the batch from running.
 *
 * @returns A summary with the total number triggered and per-connector results.
 */
export async function runAllDueConnectors(): Promise<{
  triggered: number;
  results: Array<{ connectorId: string; success: boolean; error?: string }>;
}> {
  const due = await getDueConnectors();
  const results: Array<{ connectorId: string; success: boolean; error?: string }> = [];

  for (const connector of due) {
    try {
      await triggerScheduledRun(connector.id);
      results.push({ connectorId: connector.id, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ connectorId: connector.id, success: false, error: message });
    }
  }

  return {
    triggered: results.filter((r) => r.success).length,
    results,
  };
}

/**
 * Return a high-level overview of the connector schedule landscape: total
 * counts, per-frequency breakdowns, number currently due, and the next
 * upcoming scheduled run time.
 */
export async function getScheduleOverview(): Promise<ScheduleOverview> {
  const now = new Date();

  const [allConnectors, activeScheduled] = await Promise.all([
    db.connector.findMany(),
    db.connector.findMany({
      where: {
        scheduleFrequency: { not: 'manual' },
        status: 'active',
      },
      include: { sourceHealth: { select: { healthScore: true } } },
    }),
  ]);

  const totalConnectors = allConnectors.length;
  const scheduledConnectors = activeScheduled.length;
  const manualConnectors = allConnectors.filter(
    (c) => c.scheduleFrequency === 'manual',
  ).length;

  // Per-frequency counts (all connectors, not just active)
  const byFrequency: Record<string, number> = {};
  for (const c of allConnectors) {
    const freq = c.scheduleFrequency ?? 'manual';
    byFrequency[freq] = (byFrequency[freq] ?? 0) + 1;
  }

  // Build scheduled list to compute due count and next run
  const scheduled = activeScheduled.map((c) => toScheduledConnector(c, now));
  scheduled.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());

  const dueNow = scheduled.filter((c) => c.due).length;
  const nextScheduledRun = scheduled.length > 0 ? scheduled[0].nextRunAt : null;

  return {
    totalConnectors,
    scheduledConnectors,
    manualConnectors,
    byFrequency,
    dueNow,
    nextScheduledRun,
  };
}

/**
 * Update the schedule frequency of an existing connector.
 *
 * @param connectorId - The ID of the connector to update.
 * @param frequency  - The new schedule frequency.
 * @returns The updated connector record.
 * @throws {Error} If the connector does not exist.
 * @throws {Error} If the frequency value is invalid.
 */
export async function updateScheduleFrequency(
  connectorId: string,
  frequency: ScheduleFrequency,
): Promise<import('@prisma/client').Connector> {
  const validFrequencies: ScheduleFrequency[] = ['manual', 'hourly', 'daily', 'weekly'];
  if (!validFrequencies.includes(frequency)) {
    throw new Error(
      `Invalid schedule frequency "${frequency}". Must be one of: ${validFrequencies.join(', ')}`,
    );
  }

  const connector = await db.connector.findUnique({
    where: { id: connectorId },
  });

  if (!connector) {
    throw new Error(`Connector with id "${connectorId}" not found`);
  }

  return db.connector.update({
    where: { id: connectorId },
    data: { scheduleFrequency: frequency },
  });
}