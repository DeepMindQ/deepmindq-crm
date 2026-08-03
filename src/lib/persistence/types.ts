/**
 * WI-18.2 Intelligence Persistence Engine — Type Definitions
 * ==========================================================
 *
 * Lock L1: All Tier-1 persistence MUST use IIntelligencePersistenceAdapter.
 * Lock L2: PostgreSQL is source of truth; cache is acceleration only.
 * Lock L3: companyId required for tenant-scoped data.
 *
 * ARCHITECTURE:
 *   Map.set() → adapter.write() → PostgreSQL → confirm → update health
 *   Cache miss → adapter.read() → PostgreSQL → populate cache → return
 */

import type { IntelligencePersistenceStore } from '@prisma/client';
export type { IntelligencePersistenceStore };

// ── Core Operation Types ─────────────────────────────────────────────

/** A single persistence operation flowing through the adapter. */
export interface PersistenceOperation<T = unknown> {
  /** Which persistence store this targets. */
  store: IntelligencePersistenceStore;
  /** Operation type. */
  operation: 'upsert' | 'delete' | 'batch_upsert';
  /** The Map key that triggered this operation. */
  key: string;
  /** Full entity data to persist. */
  data: T;
  /**
   * Multi-tenant context (Lock L3).
   * NULL = global data (must have isGlobal=true).
   * Non-NULL = tenant-scoped data.
   */
  companyId?: string | null;
  /** Unix ms timestamp of the operation. */
  timestamp: number;
}

/** Result of a single persistence write. */
export interface PersistenceResult {
  /** Whether the write succeeded. */
  success: boolean;
  /** The database record ID (if applicable). */
  dbId?: string;
  /** Write latency in milliseconds. NULL if failed before DB call. */
  latencyMs: number | null;
  /** Whether this result came from a retry. */
  retried: boolean;
  /** Human-readable failure reason (if failed). */
  failureReason?: string;
}

/** Health status for a single persistence store. */
export interface PersistenceHealthStatus {
  /** Which store this status covers. */
  store: IntelligencePersistenceStore;
  /** Is this store healthy? */
  healthy: boolean;
  /** Unix ms of last successful write. */
  lastWriteAt: number | null;
  /** Whether the last write succeeded. */
  lastWriteSuccess: boolean;
  /** Latency of the last write in ms. */
  lastWriteLatencyMs: number;
  /** Consecutive failure count. */
  consecutiveFailures: number;
  /** Number of items in the failure queue. */
  failureQueueDepth: number;
  /** Total successful writes (session lifetime). */
  totalWrites: number;
  /** Total failed writes (session lifetime). */
  totalFailures: number;
}

// ── Adapter Interface (Lock L1: Contract Lock) ──────────────────────

/**
 * The persistence adapter contract.
 * ALL Tier-1 AI state persistence MUST go through this interface.
 * Direct Map.set() → DB writes scattered across modules are forbidden.
 */
export interface IIntelligencePersistenceAdapter {
  /** Write a single entity to the persistence store. */
  write<T = unknown>(operation: PersistenceOperation<T>): Promise<PersistenceResult>;

  /** Write multiple entities in a batch. */
  writeBatch<T = unknown>(operations: PersistenceOperation<T>[]): Promise<PersistenceResult[]>;

  /** Read a single entity by key from the persistence store. */
  read<T = unknown>(store: IntelligencePersistenceStore, key: string): Promise<T | null>;

  /** Read all entities for a given company (Lock L3: tenant isolation). */
  readByCompany<T = unknown>(store: IntelligencePersistenceStore, companyId: string): Promise<T[]>;

  /** Read all entities from a store with optional filters. */
  readAll<T = unknown>(store: IntelligencePersistenceStore, options?: LoadOptions): Promise<T[]>;

  /** Delete an entity by key. */
  delete(store: IntelligencePersistenceStore, key: string): Promise<PersistenceResult>;

  /** Get health status for all stores. */
  getHealth(): PersistenceHealthStatus[];

  /** Get health status for a specific store. */
  getStoreHealth(store: IntelligencePersistenceStore): PersistenceHealthStatus | null;

  /** Check if persistence is enabled (USE_DB_PERSISTENCE flag). */
  isEnabled(): boolean;

  /** Check if shadow mode is active (PERSISTENCE_SHADOW_MODE flag). */
  isShadowMode(): boolean;
}

// ── Loading Options ──────────────────────────────────────────────────

export interface LoadOptions {
  /** Filter by companyId (Lock L3). */
  companyId?: string;
  /** Include global entries alongside company-scoped. */
  includeGlobal?: boolean;
  /** Maximum number of records to load. */
  limit?: number;
  /** Offset for pagination. */
  offset?: number;
  /** Filter by entity type (for KG nodes and retrieval entries). */
  entityType?: string;
}

// ── Cold Start Types ──────────────────────────────────────────────────

/** Phased loading strategy for cold start (Lock L5). */
export interface LoadingStrategy {
  /** Phase 1 stores — loaded first, serve user requests. */
  criticalStores: IntelligencePersistenceStore[];
  /** Phase 2 stores — background enrichment, improve AI quality. */
  enrichmentStores: IntelligencePersistenceStore[];
  /** Phase 3 stores — telemetry and monitoring. */
  telemetryStores: IntelligencePersistenceStore[];
  /** If true, startup fails if not all records loaded. */
  requireFullLoad: boolean;
  /** Timeout for full load in ms. */
  maxLoadTimeMs: number;
  /** Below this completeness ratio = degraded mode (0.0–1.0). */
  degradedModeThreshold: number;
}

/** Store loading result for a single store. */
export interface StoreLoadResult {
  store: IntelligencePersistenceStore;
  /** Number of entries loaded into the Map. */
  mapCount: number;
  /** Number of entries in the DB. */
  dbCount: number;
  /** Whether loading completed successfully. */
  loaded: boolean;
  /** Time taken to load in ms. */
  loadTimeMs: number;
  /** Completeness ratio: mapCount/dbCount (1.0 = perfect). */
  completeness: number;
  /** Whether index Maps were rebuilt from loaded data. */
  indicesRebuilt: boolean;
}

/** Overall cold start status (Lock L5). */
export type PersistenceStartupStatus =
  | 'loading'
  | 'loaded_partial'
  | 'loaded_full'
  | 'loaded_degraded'
  | 'load_failed';

/** Full startup health report. */
export interface PersistenceStartupReport {
  status: PersistenceStartupStatus;
  stores: Record<IntelligencePersistenceStore, StoreLoadResult>;
  overallCompleteness: number;
  startupDurationMs: number;
  lastStartupAt: string;
}

// ── Shadow Mode Types (Lock L4) ──────────────────────────────────────

/** Result of a shadow mode reconciliation comparison. */
export interface ReconciliationResult {
  store: IntelligencePersistenceStore;
  /** Number of entries in the Map at snapshot time. */
  mapCount: number;
  /** Number of entries in the DB at snapshot time. */
  dbCount: number;
  /** Entries in Map but not in DB. */
  missingFromDb: number;
  /** Entries in DB but not in Map. */
  missingFromMap: number;
  /** Entries where Map and DB data differ. */
  mismatchedEntries: number;
  /** Details of mismatches for debugging. */
  mismatchDetails: Array<{ key: string; mapHash: string; dbHash: string }>;
  /** Duration of the reconciliation in ms. */
  durationMs: number;
}

// ── Persistence Registry Types ────────────────────────────────────────

/** Registration entry for a Tier-1 persistent Map. */
export interface PersistentMapRegistration {
  /** The persistence store this Map belongs to. */
  store: IntelligencePersistenceStore;
  /** Source file where the Map is defined. */
  sourceFile: string;
  /** Variable name of the Map. */
  mapName: string;
  /** Human-readable description of what this Map stores. */
  description: string;
  /** Whether this is a primary store (data) or derived (index). */
  isPrimary: boolean;
  /**
   * If this is a derived store, which primary store it depends on.
   * Derived stores are recomputed on cold start, not loaded from DB.
   */
  dependsOn?: IntelligencePersistenceStore;
}

// ── Feature Flags ─────────────────────────────────────────────────────

export const PERSISTENCE_FEATURE_FLAGS = {
  /** Master switch: enables DB-backed persistence. */
  USE_DB_PERSISTENCE: process.env.USE_DB_PERSISTENCE === 'true',
  /** Shadow mode: writes go to both Map and DB, Map remains authoritative. */
  PERSISTENCE_SHADOW_MODE: process.env.PERSISTENCE_SHADOW_MODE === 'true',
  /** Cold start: require full load or allow degraded mode. */
  PERSISTENCE_REQUIRE_FULL_LOAD: process.env.PERSISTENCE_REQUIRE_FULL_LOAD !== 'false',
  /** Maximum cold start load time in ms. */
  PERSISTENCE_MAX_LOAD_TIME_MS: parseInt(process.env.PERSISTENCE_MAX_LOAD_TIME_MS || '60000', 10),
  /** Degraded mode threshold (0.0–1.0). */
  PERSISTENCE_DEGRADED_THRESHOLD: parseFloat(process.env.PERSISTENCE_DEGRADED_THRESHOLD || '0.8'),
} as const;
