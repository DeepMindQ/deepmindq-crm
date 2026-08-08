/**
 * Task 4.7 — Data Enrichment Module
 *
 * Barrel export for the enrichment system:
 *   - Provider abstraction & types
 *   - Clearbit provider (company enrichment)
 *   - Apollo provider (contact + company enrichment)
 *   - Enrichment queue (rate limit, retry, dedup)
 *   - Enrichment orchestrator (full flow orchestration)
 */

// Types
export type {
  EnrichmentProvider,
  EnrichmentResult,
  ContactEnrichmentResult,
  EnrichmentProviderType,
  EnrichmentJobStatus,
  EnrichmentEntityType,
  ProviderStatus,
  EnrichmentQueueConfig,
} from './enrichment-provider';

export { DEFAULT_ENRICHMENT_QUEUE_CONFIG } from './enrichment-provider';

// Providers
export { ClearbitProvider, clearbitProvider } from './providers/clearbit-provider';
export { ApolloProvider, apolloProvider } from './providers/apollo-provider';

// Queue
export { EnrichmentQueue, enrichmentQueue } from './enrichment-queue';
export type { EnrichmentQueueItem } from './enrichment-queue';

// Orchestrator
export {
  enrichCompany,
  enrichContact,
  enrichBatch,
  getEnrichmentStatus,
  getProviderStatuses,
  getRecentJobs,
  registerProvider,
  getProviders,
} from './enrichment-orchestrator';
export type { EnrichmentStatusResult } from './enrichment-orchestrator';
