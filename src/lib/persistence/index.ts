/**
 * WI-18.2 Intelligence Persistence Engine
 * =========================================
 *
 * Barrel export for the persistence service layer.
 *
 * Lock L1: All Tier-1 AI state persistence MUST go through the adapter.
 * Lock L2: PostgreSQL is source of truth; cache is acceleration only.
 *
 * USAGE:
 *   import { getPersistenceAdapter } from '@/lib/persistence';
 *   const adapter = getPersistenceAdapter();
 *   await adapter.write({ store: 'knowledge_graph_nodes', ... });
 */

export { getPersistenceAdapter } from './intelligence-persistence-adapter';
export { getPersistenceFailureQueue } from './persistence-failure-queue';
export { getPersistenceHealthMonitor } from './persistence-health-monitor';
export {
  persistWrite,
  persistDelete,
  isPersistenceEnabled,
  isShadowModeActive,
  serializeVector,
  deserializeVector,
} from './persistence-integration';
export {
  executeColdStartLoad,
  getPersistenceStartupStatus,
  getPersistenceStartupReport,
  isPersistenceDegraded,
  getColdStartTenantMode,
} from './cold-start-loader';
export {
  reconcileStore,
  reconcileAllStores,
  registerMapStateProvider,
  startShadowModeComparator,
} from './shadow-mode-comparator';
export {
  PERSISTENCE_REGISTRY,
  getPrimaryStores,
  getAllStores,
  isPrimaryStore,
  getRegistrationsForStore,
} from './persistence-registry';
export type {
  IIntelligencePersistenceAdapter,
  PersistenceOperation,
  PersistenceResult,
  PersistenceHealthStatus,
  LoadOptions,
  LoadingStrategy,
  StoreLoadResult,
  PersistenceStartupStatus,
  PersistenceStartupReport,
  ReconciliationResult,
  PersistentMapRegistration,
} from './types';
export { PERSISTENCE_FEATURE_FLAGS } from './types';
