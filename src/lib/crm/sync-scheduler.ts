/**
 * Task 4.5 — CRM Scheduled Sync Worker
 *
 * Manages periodic scheduled syncs for CRM connections with syncMode='scheduled'.
 * Uses a simple setInterval-based approach. In production, this would use
 * a proper job scheduler (BullMQ, Agenda) or cron.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { syncFromCRM } from './crm-sync-service';

// Active sync timers
const activeTimers = new Map<string, NodeJS.Timeout>();

/**
 * Start the scheduled sync worker.
 * Checks for connections with syncMode='scheduled' and sets up intervals.
 */
export function startSyncScheduler(): void {
  logger.info('[sync-scheduler] Starting scheduled sync worker');

  // Check every 60 seconds for scheduled connections
  const checkInterval = setInterval(async () => {
    try {
      await refreshScheduledSyncs();
    } catch (error) {
      logger.error('[sync-scheduler] Check failed', { error: String(error) });
    }
  }, 60 * 1000);

  // Store the main checker timer
  activeTimers.set('__scheduler__', checkInterval);

  // Do an initial check
  refreshScheduledSyncs().catch(err => {
    logger.error('[sync-scheduler] Initial check failed', { error: String(err) });
  });
}

/**
 * Stop all scheduled sync timers.
 */
export function stopSyncScheduler(): void {
  for (const [id, timer] of activeTimers.entries()) {
    clearInterval(timer);
    logger.info('[sync-scheduler] Stopped timer', { connectionId: id });
  }
  activeTimers.clear();
}

/**
 * Refresh scheduled syncs based on current DB state.
 */
async function refreshScheduledSyncs(): Promise<void> {
  const connections = await db.cRMConnection.findMany({
    where: {
      isActive: true,
      syncMode: 'scheduled',
      accessToken: { not: null },
    },
  });

  for (const conn of connections) {
    const existingTimer = activeTimers.get(conn.id);
    const intervalMs = (conn.syncInterval || 3600) * 1000;

    if (!existingTimer) {
      // Start a new timer
      logger.info('[sync-scheduler] Starting scheduled sync', {
        connectionId: conn.id,
        provider: conn.provider,
        intervalSeconds: conn.syncInterval,
      });

      const timer = setInterval(async () => {
        try {
          const minsAgo = new Date(Date.now() - intervalMs);
          await syncFromCRM(conn.id, {
            modifiedAfter: minsAgo.toISOString(),
            conflictResolution: 'local_wins',
            limit: 100,
          });
          logger.info('[sync-scheduler] Scheduled sync completed', { connectionId: conn.id });
        } catch (error) {
          logger.error('[sync-scheduler] Scheduled sync failed', {
            connectionId: conn.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }, intervalMs);

      activeTimers.set(conn.id, timer);
    }
  }

  // Clean up timers for connections that are no longer scheduled
  for (const [id, timer] of activeTimers.entries()) {
    if (id === '__scheduler__') continue;
    const stillActive = connections.some(c => c.id === id);
    if (!stillActive) {
      clearInterval(timer);
      activeTimers.delete(id);
      logger.info('[sync-scheduler] Removed timer for inactive connection', { connectionId: id });
    }
  }
}

/**
 * Get status of all scheduled syncs.
 */
export function getSchedulerStatus(): { active: number; connections: { id: string; provider: string; interval: number }[] } {
  const connections: { id: string; provider: string; interval: number }[] = [];
  for (const [id] of activeTimers.entries()) {
    if (id === '__scheduler__') continue;
    connections.push({ id, provider: 'unknown', interval: 0 });
  }
  return { active: connections.length, connections };
}
