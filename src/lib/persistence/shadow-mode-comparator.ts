/**
 * WI-18.2 Shadow Mode Comparator
 * ==============================
 *
 * Lock L4: Migration Safety
 *   Before enabling USE_DB_PERSISTENCE globally, run shadow mode:
 *   - Existing Map behavior continues (unchanged).
 *   - DB writes happen in parallel (non-blocking).
 *   - This comparator periodically snapshots Map state vs DB state.
 *   - Generates reconciliation reports stored in ShadowModeReconciliation table.
 *
 * EXIT CRITERIA for shadow mode:
 *   - missingFromDb = 0 for all Tier-1 stores (all Map state captured in DB)
 *   - missingFromMap = 0 or explained (DB has archival data not in active Map)
 *   - mismatchedEntries = 0 for all stores (no data drift)
 */

import { logger } from '@/lib/logger';
import type { IntelligencePersistenceStore, ReconciliationResult } from './types';
import { PERSISTENCE_FEATURE_FLAGS } from './types';
import { getPersistenceAdapter } from './intelligence-persistence-adapter';
import { registerTimer } from '@/lib/timer-registry';

/**
 * Get the current Map state for a store.
 * This function is called by the comparator to snapshot the in-memory Maps.
 * It must be populated by the AI modules during integration.
 */
export type MapStateProvider = (store: IntelligencePersistenceStore) => {
  entries: Map<string, unknown>;
  hashEntry: (key: string, value: unknown) => string;
};

/** Registered Map state provider — set during integration. */
let mapStateProvider: MapStateProvider | null = null;

/**
 * Register the Map state provider.
 * Must be called during WI-18.2 Phase 3 integration.
 */
export function registerMapStateProvider(provider: MapStateProvider): void {
  mapStateProvider = provider;
  logger.info('[shadow-mode] Map state provider registered');
}

/**
 * Run a reconciliation comparison for a single store.
 */
export async function reconcileStore(store: IntelligencePersistenceStore): Promise<ReconciliationResult> {
  const startMs = Date.now();
  const adapter = getPersistenceAdapter();

  if (!adapter.isEnabled()) {
    return {
      store,
      mapCount: 0,
      dbCount: 0,
      missingFromDb: 0,
      missingFromMap: 0,
      mismatchedEntries: 0,
      mismatchDetails: [],
      durationMs: Date.now() - startMs,
    };
  }

  // Get Map state
  let mapEntries = new Map<string, unknown>();
  if (mapStateProvider) {
    const mapState = mapStateProvider(store);
    mapEntries = mapState.entries;
  }

  // Get DB state
  const dbRecords = await adapter.readAll(store, { includeGlobal: true, limit: 100000 });
  const dbMap = new Map<string, unknown>();
  for (const record of dbRecords) {
    const rec = record as Record<string, unknown>;
    dbMap.set(rec.id as string, rec);
  }

  const mapCount = mapEntries.size;
  const dbCount = dbMap.size;

  // Find entries in Map but not in DB
  const missingFromDb: string[] = [];
  for (const key of mapEntries.keys()) {
    if (!dbMap.has(key)) {
      missingFromDb.push(key);
    }
  }

  // Find entries in DB but not in Map
  const missingFromMap: string[] = [];
  for (const key of dbMap.keys()) {
    if (!mapEntries.has(key)) {
      missingFromMap.push(key);
    }
  }

  // Compare entries that exist in both
  const mismatchedEntries: Array<{ key: string; mapHash: string; dbHash: string }> = [];
  if (mapStateProvider) {
    const hashFn = mapStateProvider(store).hashEntry;
    for (const key of mapEntries.keys()) {
      if (dbMap.has(key)) {
        const mapHash = hashFn(key, mapEntries.get(key));
        const dbHash = hashFn(key, dbMap.get(key));
        if (mapHash !== dbHash) {
          mismatchedEntries.push({ key, mapHash, dbHash });
        }
      }
    }
  }

  const result: ReconciliationResult = {
    store,
    mapCount,
    dbCount,
    missingFromDb: missingFromDb.length,
    missingFromMap: missingFromMap.length,
    mismatchedEntries: mismatchedEntries.length,
    mismatchDetails: mismatchedEntries.slice(0, 100), // Cap at 100 for storage
    durationMs: Date.now() - startMs,
  };

  // Persist the reconciliation result
  await persistReconciliation(result).catch((err) => {
    logger.warn(`[shadow-mode] Failed to persist reconciliation: ${err}`);
  });

  return result;
}

/**
 * Run reconciliation for all Tier-1 stores.
 */
export async function reconcileAllStores(): Promise<ReconciliationResult[]> {
  if (!PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE) {
    return [];
  }

  const stores: IntelligencePersistenceStore[] = [
    'knowledge_graph_nodes',
    'knowledge_graph_edges',
    'ai_memory',
    'retrieval_index',
  ];

  const results: ReconciliationResult[] = [];

  for (const store of stores) {
    try {
      const result = await reconcileStore(store);
      results.push(result);

      if (result.missingFromDb > 0 || result.mismatchedEntries > 0) {
        logger.warn(
          `[shadow-mode] ${store}: ${result.missingFromDb} missing from DB, ` +
          `${result.mismatchedEntries} mismatches, ${result.missingFromMap} in DB only`
        );
      }
    } catch (error) {
      logger.error(`[shadow-mode] Reconciliation failed for ${store}: ${error}`);
    }
  }

  return results;
}

/**
 * Persist reconciliation result to DB.
 */
async function persistReconciliation(result: ReconciliationResult): Promise<void> {
  if (!PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) return;

  try {
    const { Prisma } = require('@prisma/client');
    const prisma = new Prisma();

    await prisma.shadowModeReconciliation.create({
      data: {
        store: result.store,
        mapCount: result.mapCount,
        dbCount: result.dbCount,
        missingFromDb: result.missingFromDb,
        missingFromMap: result.missingFromMap,
        mismatchedEntries: result.mismatchedEntries,
        mismatchDetails: JSON.stringify(result.mismatchDetails),
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    logger.warn(`[shadow-mode] DB persist failed: ${error}`);
  }
}

/**
 * Start the periodic reconciliation timer.
 * Runs every 5 minutes when shadow mode is active.
 */
export function startShadowModeComparator(): void {
  if (!PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE) {
    logger.info('[shadow-mode] Not active — skipping comparator start');
    return;
  }

  if (typeof setInterval !== 'undefined') {
    registerTimer(setInterval(async () => {
      try {
        const results = await reconcileAllStores();
        const hasIssues = results.some(
          r => r.missingFromDb > 0 || r.mismatchedEntries > 0
        );
        if (hasIssues) {
          logger.warn('[shadow-mode] Reconciliation found issues — review ShadowModeReconciliation table');
        }
      } catch (error) {
        logger.error(`[shadow-mode] Periodic reconciliation error: ${error}`);
      }
    }, 5 * 60 * 1000)); // Every 5 minutes
  }

  logger.info('[shadow-mode] Comparator started — interval: 5 minutes');
}
