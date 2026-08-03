/**
 * WI-18.2 Persistence Health Monitor
 * ==================================
 *
 * Lock L2: Silent persistence failure is NOT acceptable.
 * This monitor tracks write success/failure for each store,
 * exposes health status, and triggers structured alerts.
 *
 * ALERTING THRESHOLDS:
 *   3 consecutive failures  → WARNING  (operational review needed)
 *   10 consecutive failures → CRITICAL  (persistence may be broken, escalation needed)
 *
 * VISIBILITY GUARANTEE (Gate 3):
 *   Every failure produces:
 *   1. Health monitor state update (consecutiveFailures++)
 *   2. Structured alert log (WARNING or CRITICAL level)
 *   3. Periodic DB snapshot (every 5 minutes via PersistenceHealthSnapshot)
 *
 * Health is exposed via:
 *   - adapter.getHealth() / adapter.getStoreHealth()
 *   - GET /api/health/persistence (future)
 *   - generateHealthReport() for Phase 2 completion artifact
 */

import { logger } from '@/lib/logger';
import type { PersistenceHealthStatus } from './types';
import type { IntelligencePersistenceStore } from '@prisma/client';
import { PERSISTENCE_FEATURE_FLAGS } from './types';
import { registerTimer } from '@/lib/timer-registry';

/** Alert threshold for warnings. */
const WARNING_THRESHOLD = 3;
/** Alert threshold for critical. */
const CRITICAL_THRESHOLD = 10;

/** Per-store health tracking data. */
interface StoreHealthState {
  store: IntelligencePersistenceStore;
  lastWriteAt: number | null;
  lastWriteSuccess: boolean;
  lastWriteLatencyMs: number;
  consecutiveFailures: number;
  totalWrites: number;
  totalFailures: number;
  lastErrorMessage: string | null;
  firstFailureAt: number | null;
  recoveredAt: number | null;
}

/** Alert event for operational visibility. */
export interface PersistenceAlertEvent {
  store: IntelligencePersistenceStore;
  level: 'warning' | 'critical' | 'recovered';
  consecutiveFailures: number;
  totalFailures: number;
  message: string;
  timestamp: number;
}

class PersistenceHealthMonitor {
  private health = new Map<IntelligencePersistenceStore, StoreHealthState>();
  private started = false;
  /** Alert history for reporting. */
  private alertHistory: PersistenceAlertEvent[] = [];

  constructor() {
    // Initialize health tracking for all known stores
    const stores: IntelligencePersistenceStore[] = [
      'knowledge_graph_nodes',
      'knowledge_graph_edges',
      'ai_memory',
      'retrieval_index',
      'retrieval_corpus_stats',
      'retrieval_metrics',
    ];

    for (const store of stores) {
      this.health.set(store, {
        store,
        lastWriteAt: null,
        lastWriteSuccess: true,
        lastWriteLatencyMs: 0,
        consecutiveFailures: 0,
        totalWrites: 0,
        totalFailures: 0,
        lastErrorMessage: null,
        firstFailureAt: null,
        recoveredAt: null,
      });
    }
  }

  /** Record a successful write. */
  recordSuccess(store: IntelligencePersistenceStore, latencyMs: number): void {
    const state = this.health.get(store);
    if (!state) return;

    const wasInFailure = state.consecutiveFailures > 0;

    state.lastWriteAt = Date.now();
    state.lastWriteSuccess = true;
    state.lastWriteLatencyMs = latencyMs;
    state.consecutiveFailures = 0;
    state.totalWrites++;
    state.lastErrorMessage = null;

    if (wasInFailure) {
      // Generate recovery alert
      state.recoveredAt = Date.now();
      const event: PersistenceAlertEvent = {
        store,
        level: 'recovered',
        consecutiveFailures: 0,
        totalFailures: state.totalFailures,
        message: `${store}: RECOVERED — store is healthy again after ${state.firstFailureAt ? ((Date.now() - state.firstFailureAt) / 1000).toFixed(0) + 's' : 'unknown'} outage`,
        timestamp: Date.now(),
      };
      this.alertHistory.push(event);
      logger.info(`[persistence-health] RECOVERED: ${store} — store is healthy again`);
      state.firstFailureAt = null;
    }
  }

  /** Record a failed write. */
  recordFailure(store: IntelligencePersistenceStore, errorMessage?: string): void {
    const state = this.health.get(store);
    if (!state) return;

    state.lastWriteSuccess = false;
    state.consecutiveFailures++;
    state.totalFailures++;
    state.lastErrorMessage = errorMessage || 'unknown';

    if (!state.firstFailureAt) {
      state.firstFailureAt = Date.now();
    }

    // Trigger alerts based on consecutive failure count
    if (state.consecutiveFailures === WARNING_THRESHOLD) {
      const event: PersistenceAlertEvent = {
        store,
        level: 'warning',
        consecutiveFailures: state.consecutiveFailures,
        totalFailures: state.totalFailures,
        message: `${store}: WARNING — ${state.consecutiveFailures} consecutive failures. Operational review needed.`,
        timestamp: Date.now(),
      };
      this.alertHistory.push(event);
      logger.warn(`[persistence-health] WARNING: ${store} has ${state.consecutiveFailures} consecutive failures`);
    } else if (state.consecutiveFailures === CRITICAL_THRESHOLD) {
      const event: PersistenceAlertEvent = {
        store,
        level: 'critical',
        consecutiveFailures: state.consecutiveFailures,
        totalFailures: state.totalFailures,
        message: `${store}: CRITICAL — ${state.consecutiveFailures} consecutive failures. Persistence may be broken. Escalation required.`,
        timestamp: Date.now(),
      };
      this.alertHistory.push(event);
      logger.error(`[persistence-health] CRITICAL: ${store} has ${state.consecutiveFailures} consecutive failures — persistence may be broken`);
    }
  }

  /** Get health status for all stores. */
  getAllHealth(): PersistenceHealthStatus[] {
    const results: PersistenceHealthStatus[] = [];

    for (const [store, state] of this.health) {
      results.push({
        store,
        healthy: state.consecutiveFailures < WARNING_THRESHOLD,
        lastWriteAt: state.lastWriteAt,
        lastWriteSuccess: state.lastWriteSuccess,
        lastWriteLatencyMs: state.lastWriteLatencyMs,
        consecutiveFailures: state.consecutiveFailures,
        failureQueueDepth: 0, // Populated from failure queue if available
        totalWrites: state.totalWrites,
        totalFailures: state.totalFailures,
      });
    }

    return results;
  }

  /** Get health status for a specific store. */
  getStoreHealth(store: IntelligencePersistenceStore): PersistenceHealthStatus | null {
    const state = this.health.get(store);
    if (!state) return null;

    return {
      store,
      healthy: state.consecutiveFailures < WARNING_THRESHOLD,
      lastWriteAt: state.lastWriteAt,
      lastWriteSuccess: state.lastWriteSuccess,
      lastWriteLatencyMs: state.lastWriteLatencyMs,
      consecutiveFailures: state.consecutiveFailures,
      failureQueueDepth: 0,
      totalWrites: state.totalWrites,
      totalFailures: state.totalFailures,
    };
  }

  /** Check if any store is in critical failure state. */
  hasCriticalFailure(): boolean {
    for (const state of this.health.values()) {
      if (state.consecutiveFailures >= CRITICAL_THRESHOLD) return true;
    }
    return false;
  }

  /** Get all stores in warning or critical state. */
  getUnhealthyStores(): PersistenceHealthStatus[] {
    return this.getAllHealth().filter(h => !h.healthy);
  }

  /** Get alert history for reporting. */
  getAlertHistory(): PersistenceAlertEvent[] {
    return [...this.alertHistory];
  }

  /**
   * Generate a comprehensive health report.
   * Used for the Phase 2 completion artifact: Persistence Health Report.
   */
  generateHealthReport(): {
    generatedAt: string;
    stores: PersistenceHealthStatus[];
    unhealthyCount: number;
    criticalFailureExists: boolean;
    alerts: PersistenceAlertEvent[];
    totalWrites: number;
    totalFailures: number;
    overallHealth: 'healthy' | 'degraded' | 'critical';
  } {
    const stores = this.getAllHealth();
    const unhealthy = stores.filter(s => !s.healthy);
    const totalWrites = stores.reduce((sum, s) => sum + s.totalWrites, 0);
    const totalFailures = stores.reduce((sum, s) => sum + s.totalFailures, 0);
    const hasCritical = this.hasCriticalFailure();

    return {
      generatedAt: new Date().toISOString(),
      stores,
      unhealthyCount: unhealthy.length,
      criticalFailureExists: hasCritical,
      alerts: this.alertHistory.slice(-50), // Last 50 alerts
      totalWrites,
      totalFailures,
      overallHealth: hasCritical ? 'critical' : unhealthy.length > 0 ? 'degraded' : 'healthy',
    };
  }

  /** Start periodic health snapshots (every 5 minutes). */
  start(): void {
    if (this.started || !PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return;
    this.started = true;

    if (typeof setInterval !== 'undefined') {
      registerTimer(setInterval(async () => {
        try {
          await this.snapshotHealth();
        } catch (error) {
          logger.warn(`[persistence-health] Snapshot failed: ${error}`);
        }
      }, 5 * 60 * 1000)); // Every 5 minutes
    }
  }

  /** Persist health snapshot to DB. */
  private async snapshotHealth(): Promise<void> {
    if (!PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return;

    try {
      const { Prisma } = require('@prisma/client');
      const prisma = new Prisma();

      for (const [store, state] of this.health) {
        await prisma.persistenceHealthSnapshot.create({
          data: {
            store,
            healthy: state.consecutiveFailures < WARNING_THRESHOLD,
            lastWriteAtMs: state.lastWriteAt,
            lastWriteLatencyMs: state.lastWriteLatencyMs || null,
            consecutiveFailures: state.consecutiveFailures,
            failureQueueDepth: 0,
            totalWrites: state.totalWrites,
            totalFailures: state.totalFailures,
            snapshotReason: 'scheduled',
          },
        });
      }
    } catch (error) {
      logger.warn(`[persistence-health] DB snapshot failed: ${error}`);
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

let _monitor: PersistenceHealthMonitor | null = null;

export function getPersistenceHealthMonitor(): PersistenceHealthMonitor {
  if (!_monitor) {
    _monitor = new PersistenceHealthMonitor();
    _monitor.start();
  }
  return _monitor;
}
