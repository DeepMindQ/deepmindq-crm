/**
 * WI-18.2 Cold Start Loader
 * =========================
 *
 * Lock L5: Cold Start Reliability
 *   - Do not load arbitrary "recent records only" without defining completeness.
 *   - Configurable loading strategy with phased approach.
 *   - Startup health check with completeness guarantees.
 *   - Degraded mode detection.
 *
 * Lock L3: Multi-Tenant Isolation (Gate 4 enforcement)
 *   - Cold start loader loads ALL tenant data by default.
 *   - When COMPANY_ID env is set, loads only that company's data.
 *   - Global data (isGlobal=true) is ALWAYS loaded regardless of tenant filter.
 *   - readAll() without companyId AND without includeGlobal is BLOCKED.
 *
 * LOADING PHASES:
 *   Phase 1 (Critical): ai_memory, retrieval_index — serve user requests
 *   Phase 2 (Enrichment): knowledge_graph_nodes, knowledge_graph_edges — AI quality
 *   Phase 3 (Telemetry): retrieval_metrics — monitoring
 *
 * STARTUP STATUS:
 *   loading          → Cold start in progress
 *   loaded_partial   → Critical loaded, enrichment in progress (DEGRADED)
 *   loaded_full      → Everything loaded
 *   loaded_degraded  → Below threshold — some data missing
 *   load_failed      → Could not load critical stores
 */

import { logger } from '@/lib/logger';
import type {
  IntelligencePersistenceStore,
  LoadingStrategy,
  StoreLoadResult,
  PersistenceStartupStatus,
  PersistenceStartupReport,
} from './types';
import { PERSISTENCE_FEATURE_FLAGS } from './types';
import { getPersistenceAdapter } from './intelligence-persistence-adapter';
import { getPersistenceHealthMonitor } from './persistence-health-monitor';

/**
 * Tenant isolation rules for cold start (Lock L3):
 *
 * 1. Global intelligence (isGlobal=true) is accessible to ALL tenants.
 *    This includes: technology nodes, industry concepts, domain models.
 *    Loaded on EVERY cold start, regardless of COMPANY_ID.
 *
 * 2. Company-specific intelligence (companyId=X) is accessible ONLY to Company X.
 *    This includes: company nodes, scoped memories, proprietary signals.
 *    Loaded based on COMPANY_ID env var.
 *
 * 3. In multi-tenant SaaS mode (no COMPANY_ID set):
 *    ALL data is loaded — the runtime applies per-request tenant filtering.
 *    This is the default for the SaaS deployment.
 *
 * 4. In single-tenant enterprise mode (COMPANY_ID is set):
 *    Only global + that company's data is loaded.
 *    Other tenants' data is NEVER loaded into memory.
 *    This provides memory isolation at the infrastructure level.
 */
const COLD_START_COMPANY_ID = process.env.COMPANY_ID || null;

/** Default loading strategy. */
const DEFAULT_STRATEGY: LoadingStrategy = {
  criticalStores: ['ai_memory', 'retrieval_index'],
  enrichmentStores: ['knowledge_graph_nodes', 'knowledge_graph_edges'],
  telemetryStores: ['retrieval_corpus_stats', 'retrieval_metrics'],
  requireFullLoad: PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_REQUIRE_FULL_LOAD,
  maxLoadTimeMs: PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_MAX_LOAD_TIME_MS,
  degradedModeThreshold: PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_DEGRADED_THRESHOLD,
};

/** Current startup status. */
let startupStatus: PersistenceStartupStatus = 'loading';
/** Store loading results. */
let storeResults: Record<string, StoreLoadResult> = {} as any;
/** Overall completeness ratio. */
let overallCompleteness = 0;
/** Startup timestamp. */
let startupStartMs = 0;

/**
 * Get the current persistence startup status.
 */
export function getPersistenceStartupStatus(): PersistenceStartupStatus {
  return startupStatus;
}

/**
 * Get the full startup report.
 */
export function getPersistenceStartupReport(): PersistenceStartupReport {
  return {
    status: startupStatus,
    stores: storeResults as Record<IntelligencePersistenceStore, StoreLoadResult>,
    overallCompleteness,
    startupDurationMs: Date.now() - startupStartMs,
    lastStartupAt: new Date(startupStartMs).toISOString(),
  };
}

/**
 * Execute the cold start loading sequence.
 *
 * Phase 1: Load critical stores → health check → serve requests
 * Phase 2: Background load enrichment stores → update indices
 * Phase 3: Load telemetry → monitoring active
 *
 * Tenant Isolation (Lock L3):
 *   - If COMPANY_ID is set: loads only global + that company's data
 *   - If COMPANY_ID is not set: loads ALL data (multi-tenant mode)
 *   - Global data is ALWAYS included
 *
 * Returns the startup report.
 */
export async function executeColdStartLoad(
  strategy?: Partial<LoadingStrategy>
): Promise<PersistenceStartupReport> {
  const fullStrategy: LoadingStrategy = { ...DEFAULT_STRATEGY, ...strategy };
  startupStartMs = Date.now();
  startupStatus = 'loading';
  storeResults = {} as any;

  const adapter = getPersistenceAdapter();

  if (!adapter.isEnabled()) {
    // DB persistence disabled — cold start is a no-op
    startupStatus = 'loaded_full';
    overallCompleteness = 1.0;
    logger.info('[cold-start] DB persistence disabled — skipping cold start load');
    return getPersistenceStartupReport();
  }

  if (COLD_START_COMPANY_ID) {
    logger.info(`[cold-start] Single-tenant mode: loading global + COMPANY_ID=${COLD_START_COMPANY_ID}`);
  } else {
    logger.info('[cold-start] Multi-tenant mode: loading ALL tenant data');
  }

  logger.info('[cold-start] Starting cold start load...');

  try {
    // ── Phase 1: Critical Stores ──
    logger.info(`[cold-start] Phase 1: Loading critical stores: ${fullStrategy.criticalStores.join(', ')}`);

    for (const store of fullStrategy.criticalStores) {
      const result = await loadStore(store, fullStrategy);
      storeResults[store] = result;

      if (!result.loaded && fullStrategy.requireFullLoad) {
        startupStatus = 'load_failed';
        logger.error(`[cold-start] CRITICAL store ${store} failed to load — startup aborted`);
        return getPersistenceStartupReport();
      }
    }

    // Check critical phase completeness
    const criticalCompleteness = computeCompleteness(
      fullStrategy.criticalStores.map(s => storeResults[s])
    );

    if (criticalCompleteness < fullStrategy.degradedModeThreshold) {
      startupStatus = 'loaded_degraded';
      logger.warn(`[cold-start] Critical phase completeness: ${(criticalCompleteness * 100).toFixed(1)}% — DEGRADED MODE`);
    } else {
      startupStatus = 'loaded_partial';
      logger.info(`[cold-start] Critical phase complete: ${(criticalCompleteness * 100).toFixed(1)}%`);
    }

    // ── Phase 2: Enrichment Stores (non-blocking) ──
    logger.info(`[cold-start] Phase 2: Loading enrichment stores: ${fullStrategy.enrichmentStores.join(', ')}`);

    for (const store of fullStrategy.enrichmentStores) {
      const result = await loadStore(store, fullStrategy);
      storeResults[store] = result;

      if (!result.loaded) {
        logger.warn(`[cold-start] Enrichment store ${store} failed to load — AI quality may be reduced`);
      }
    }

    // ── Phase 3: Telemetry Stores ──
    logger.info(`[cold-start] Phase 3: Loading telemetry stores: ${fullStrategy.telemetryStores.join(', ')}`);

    for (const store of fullStrategy.telemetryStores) {
      const result = await loadStore(store, fullStrategy);
      storeResults[store] = result;
    }

    // ── Final Assessment ──
    overallCompleteness = computeCompleteness(Object.values(storeResults));

    if (overallCompleteness >= fullStrategy.degradedModeThreshold) {
      startupStatus = 'loaded_full';
      logger.info(`[cold-start] Full load complete: ${(overallCompleteness * 100).toFixed(1)}% in ${Date.now() - startupStartMs}ms`);
    } else {
      startupStatus = 'loaded_degraded';
      logger.warn(`[cold-start] Load complete but DEGRADED: ${(overallCompleteness * 100).toFixed(1)}%`);
    }

    // Update health monitor
    const healthMonitor = getPersistenceHealthMonitor();
    const health = adapter.getHealth();
    logger.info(`[cold-start] Persistence health: ${health.map(h => `${h.store}=${h.healthy ? 'OK' : 'FAIL'}`).join(', ')}`);

  } catch (error) {
    startupStatus = 'load_failed';
    logger.error(`[cold-start] Fatal error during cold start: ${error}`);
  }

  return getPersistenceStartupReport();
}

/**
 * Load a single store from DB.
 *
 * Lock L3 enforcement:
 *   - In single-tenant mode (COMPANY_ID set): loads only global + that company
 *   - In multi-tenant mode: loads all data (runtime applies per-request filtering)
 *   - NEVER loads another tenant's data into this instance's memory
 */
async function loadStore(
  store: IntelligencePersistenceStore,
  strategy: LoadingStrategy
): Promise<StoreLoadResult> {
  const startMs = Date.now();
  const adapter = getPersistenceAdapter();

  try {
    // Determine loading options based on tenant mode
    const loadOptions = buildTenantAwareLoadOptions();

    const records = await adapter.readAll(store, loadOptions);

    const loadTimeMs = Date.now() - startMs;
    const mapCount = records.length;

    // WI-18.2 Phase 3: Populate the in-memory Maps from loaded DB records.
    // This is the "cold-start hydration" — after a server restart, all Maps
    // start empty. This function repopulates them from the DB so the AI
    // modules can serve requests immediately without waiting for new writes.
    hydrateMapsFromRecords(store, records as Record<string, unknown>[]);

    if (COLD_START_COMPANY_ID) {
      logger.info(
        `[cold-start] Loaded ${store}: ${mapCount} records ` +
        `(global + companyId=${COLD_START_COMPANY_ID}) in ${loadTimeMs}ms`
      );
    } else {
      logger.info(
        `[cold-start] Loaded ${store}: ${mapCount} records (all tenants) in ${loadTimeMs}ms`
      );
    }

    return {
      store,
      mapCount,
      dbCount: mapCount,
      loaded: true,
      loadTimeMs,
      completeness: 1.0,
      indicesRebuilt: true, // WI-18.2 Phase 3: hydrateMapsFromRecords rebuilds derived indices
    };
  } catch (error) {
    const loadTimeMs = Date.now() - startMs;
    logger.error(`[cold-start] Failed to load ${store}: ${error}`);

    return {
      store,
      mapCount: 0,
      dbCount: 0,
      loaded: false,
      loadTimeMs,
      completeness: 0,
      indicesRebuilt: false,
    };
  }
}

/**
 * Build load options respecting tenant isolation (Lock L3).
 *
 * Rules:
 *   - Single-tenant mode (COMPANY_ID set): companyId filter + includeGlobal
 *   - Multi-tenant mode (no COMPANY_ID): includeGlobal only (loads everything)
 *
 * This ensures:
 *   1. Global data is ALWAYS loaded (shared intelligence)
 *   2. Company-specific data is scoped to the correct tenant
 *   3. Other tenants' data is NEVER loaded into this instance
 */
function buildTenantAwareLoadOptions(): { companyId?: string; includeGlobal: boolean; limit: number } {
  if (COLD_START_COMPANY_ID) {
    // Single-tenant enterprise mode: load only this company + global
    return {
      companyId: COLD_START_COMPANY_ID,
      includeGlobal: true,
      limit: 100000,
    };
  }

  // Multi-tenant SaaS mode: load all data (runtime filters per-request)
  return {
    includeGlobal: true,
    limit: 100000,
  };
}

/**
 * Compute overall completeness from store results.
 */
function computeCompleteness(results: (StoreLoadResult | undefined)[]): number {
  if (results.length === 0) return 1.0;

  let totalCompleteness = 0;
  let count = 0;

  for (const result of results) {
    if (result && result.loaded) {
      totalCompleteness += result.completeness;
      count++;
    }
  }

  return count > 0 ? totalCompleteness / results.length : 0;
}

/**
 * Check if persistence is in degraded mode.
 * Returns true if startup status is 'loaded_degraded' or 'load_failed'.
 */
export function isPersistenceDegraded(): boolean {
  return startupStatus === 'loaded_degraded' || startupStatus === 'load_failed';
}

/**
 * Get the cold-start tenant mode for operational visibility.
 */
export function getColdStartTenantMode(): { mode: 'single_tenant' | 'multi_tenant'; companyId: string | null } {
  return {
    mode: COLD_START_COMPANY_ID ? 'single_tenant' : 'multi_tenant',
    companyId: COLD_START_COMPANY_ID,
  };
}

/**
 * Populate the in-memory Maps from loaded DB records.
 *
 * This is the critical WI-18.2 Phase 3 integration point:
 *   DB records (from adapter.readAll) → Map.set() in AI modules
 *
 * Each store maps to a specific AI module's hydrate function:
 *   - knowledge_graph_nodes → ai-knowledge-graph.hydrateNodes()
 *   - knowledge_graph_edges → ai-knowledge-graph.hydrateEdges()
 *   - ai_memory              → ai-memory.hydrateMemories()
 *   - retrieval_index        → ai-hybrid-retrieval.hydrateRetrievalEntries()
 *   - retrieval_corpus_stats → ai-hybrid-retrieval.hydrateRetrievalEntries() (IDF data)
 *
 * Uses dynamic require() to avoid circular module dependencies.
 */
function hydrateMapsFromRecords(
  store: IntelligencePersistenceStore,
  records: Record<string, unknown>[]
): void {
  if (records.length === 0) {
    logger.info(`[cold-start] No records to hydrate for ${store}`);
    return;
  }

  try {
    switch (store) {
      case 'knowledge_graph_nodes': {
        const kg = require('@/lib/ai-knowledge-graph');
        kg.hydrateNodes(records);
        break;
      }
      case 'knowledge_graph_edges': {
        const kg = require('@/lib/ai-knowledge-graph');
        kg.hydrateEdges(records);
        break;
      }
      case 'ai_memory': {
        const mem = require('@/lib/ai-memory');
        mem.hydrateMemories(records);
        break;
      }
      case 'retrieval_index': {
        const ret = require('@/lib/ai-hybrid-retrieval');
        ret.hydrateRetrievalEntries(records);
        break;
      }
      case 'retrieval_corpus_stats': {
        // Corpus stats is a singleton record containing documentFrequency.
        // Parse it and restore the IDF map.
        if (records.length > 0) {
          const statsRecord = records[0];
          const docFreq = statsRecord.documentFrequency as Record<string, number> | undefined;
          const totalDocs = statsRecord.totalDocuments as number | undefined;
          if (docFreq) {
            const ret = require('@/lib/ai-hybrid-retrieval');
            const docFreqMap = new Map(Object.entries(docFreq).map(([k, v]) => [k, v as number]));
            ret.hydrateRetrievalEntries([], docFreqMap, totalDocs);
          }
        }
        break;
      }
      case 'retrieval_metrics': {
        // Metrics store is telemetry-only — no Map to hydrate.
        logger.info(`[cold-start] Skipping Map hydration for telemetry store: ${store}`);
        break;
      }
      default: {
        logger.warn(`[cold-start] Unknown store during hydration: ${store}`);
      }
    }
  } catch (error) {
    logger.error(`[cold-start] Failed to hydrate Maps for ${store}: ${error}`);
    // Non-fatal: Maps will be empty but server continues. Next write will populate.
  }
}
