/**
 * Task 4.7 — Data Enrichment API Integration
 *
 * Unified enrichment provider interface and result types.
 * All enrichment providers implement this abstraction, enabling
 * provider fallback, rate limiting, and credit tracking.
 */

// ─── Provider Type ────────────────────────────────────────────────────

export type EnrichmentProviderType = 'clearbit' | 'apollo' | 'zoominfo' | 'proxycurl';

// ─── Provider Interface ───────────────────────────────────────────────

export interface EnrichmentProvider {
  id: string;
  name: string;
  type: EnrichmentProviderType;
  priority: number; // lower = tried first
  enrichCompany(domain: string): Promise<EnrichmentResult>;
  enrichContact(email: string): Promise<ContactEnrichmentResult>;
  isAvailable(): Promise<boolean>;
  getRemainingCredits(): Promise<number>;
}

// ─── Company Enrichment Result ────────────────────────────────────────

export interface EnrichmentResult {
  provider: string;
  confidence: number; // 0-1
  data: {
    name?: string;
    domain?: string;
    industry?: string;
    employees?: number;
    revenue?: number;
    linkedin?: string;
    twitter?: string;
    description?: string;
    logo?: string;
    location?: string;
    technologies?: string[];
    foundedYear?: number;
    alexaRank?: number;
  };
  rawResponse?: unknown;
  creditsUsed: number;
}

// ─── Contact Enrichment Result ────────────────────────────────────────

export interface ContactEnrichmentResult {
  provider: string;
  confidence: number;
  data: {
    fullName?: string;
    email?: string;
    title?: string;
    company?: string;
    linkedin?: string;
    seniority?: string;
    department?: string;
    location?: string;
  };
  rawResponse?: unknown;
  creditsUsed: number;
}

// ─── Enrichment Job Status ────────────────────────────────────────────

export type EnrichmentJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';

export type EnrichmentEntityType = 'company' | 'contact';

// ─── Provider Registry Entry ──────────────────────────────────────────

export interface ProviderStatus {
  id: string;
  name: string;
  type: EnrichmentProviderType;
  priority: number;
  available: boolean;
  remainingCredits: number;
}

// ─── Queue Configuration ──────────────────────────────────────────────

export interface EnrichmentQueueConfig {
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  deduplicationWindowMs: number;
  rateLimitPerMinute: Record<string, number>; // providerId -> max requests/min
  batchSize: number;
  batchIntervalMs: number;
}

export const DEFAULT_ENRICHMENT_QUEUE_CONFIG: EnrichmentQueueConfig = {
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  deduplicationWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  rateLimitPerMinute: {
    clearbit: 30,
    apollo: 60,
    zoominfo: 30,
    proxycurl: 20,
  },
  batchSize: 10,
  batchIntervalMs: 1000,
};
