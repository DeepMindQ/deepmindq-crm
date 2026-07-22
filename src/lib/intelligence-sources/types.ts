/**
 * Intelligence Sources — Shared Types
 *
 * Core type definitions for the intelligence acquisition layer.
 * Used by all connectors and the ingestion pipeline.
 */

// ─── Source Types ──────────────────────────────────────────────

/** The kind of source intelligence was acquired from */
export type SourceType = 'csv' | 'excel' | 'website' | 'rss' | 'document' | 'human';

/** How intelligence was originally acquired (more granular than SourceType) */
export type IntelligenceOrigin =
  | 'csv_upload'
  | 'excel_upload'
  | 'website_scrape'
  | 'rss_feed'
  | 'human_submission';

// ─── Connector Lifecycle ───────────────────────────────────────

/** Current operational state of a connector */
export type ConnectorStatus = 'active' | 'paused' | 'disabled' | 'failed';

/** Status of a single connector run */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// ─── Intelligence Object Lifecycle ─────────────────────────────

export type IntelligenceStatus =
  | 'new'
  | 'processing'
  | 'active'
  | 'stale'
  | 'superseded'
  | 'archived'
  | 'rejected'
  | 'pending_evidence_mapping';

// ─── Knowledge Categories (14 total, 4 groups) ────────────────

export const KNOWLEDGE_CATEGORIES = {
  company: ['Strategy', 'Products', 'Technology', 'Leadership'],
  sales: ['Opportunities', 'Stakeholders', 'Conversations'],
  technical: ['Platforms', 'Architecture', 'Patents'],
  competitive: ['Competitors', 'Partnerships', 'Market'],
} as const;

export type KnowledgeCategory =
  (typeof KNOWLEDGE_CATEGORIES)[keyof typeof KNOWLEDGE_CATEGORIES][number];

export type KnowledgeGroup = keyof typeof KNOWLEDGE_CATEGORIES;

/** Flat list of all 13 categories */
export const ALL_CATEGORIES: KnowledgeCategory[] = [
  'Strategy',
  'Products',
  'Technology',
  'Leadership',
  'Opportunities',
  'Stakeholders',
  'Conversations',
  'Platforms',
  'Architecture',
  'Patents',
  'Competitors',
  'Partnerships',
  'Market',
];

// ─── Source Reliability (static, no ML) ────────────────────────

export const SOURCE_RELIABILITY: Record<SourceType, number> = {
  csv: 0.95,
  excel: 0.95,
  website: 0.85,
  rss: 0.75,
  document: 0.9,
  human: 0.85,
};

/**
 * Map a source type to an Evidence model quality tier.
 * Premium ≥ 0.9, Standard ≥ 0.7, Low < 0.7.
 */
export function sourceTypeToQualityTier(
  sourceType: SourceType
): 'premium' | 'standard' | 'low' {
  const reliability = SOURCE_RELIABILITY[sourceType];
  if (reliability >= 0.9) return 'premium';
  if (reliability >= 0.7) return 'standard';
  return 'low';
}

// ─── Freshness Decay Config ────────────────────────────────────

/** Max lifetime in days before intelligence is considered stale, per source kind */
export const FRESHNESS_CONFIG: Record<string, number> = {
  news: 60,
  job_posting: 60,
  patent: 365,
  website: 180,
  customer_upload: 365,
  rss: 90,
  document: 365,
  human: 365,
};

// ─── Column Mapping ────────────────────────────────────────────

export interface ColumnMapping {
  sourceColumn: string;
  targetField:
    | 'company'
    | 'content'
    | 'category'
    | 'date'
    | 'revenue'
    | 'industry'
    | 'notes'
    | 'owner'
    | 'custom';
  customKey?: string;
}

// ─── Company Resolution ────────────────────────────────────────

export type ResolutionConfidence =
  | 'domain_match'
  | 'exact_name'
  | 'alias_match'
  | 'partial_name'
  | 'no_match';

export interface CompanyResolutionCandidate {
  companyId: string;
  name: string;
  domain?: string;
  industry?: string;
  country?: string;
  confidence: number;
  matchType: ResolutionConfidence;
}

// ─── Connector Acquisition Results (new IConnector pattern) ────

export interface ConnectorAcquisitionResult {
  success: boolean;
  intelligenceObjects: RawIntelligenceObject[];
  errors: string[];
  metadata: Record<string, unknown>;
}

// ─── Connector Config / Result / Message (legacy BaseConnector pattern) ──
// Used by website-connector and rss-connector.

export interface ConnectorConfig extends Record<string, unknown> {
  companyIdentifier?: string;
  category?: string;
  urls?: unknown[];
  feedUrl?: string;
  discoverFromUrl?: string;
  [key: string]: unknown;
}

export interface ConnectorMessage {
  level: 'info' | 'warn' | 'error';
  message: string;
  url?: string;
}

export interface ConnectorResult {
  status: 'success' | 'partial' | 'error';
  intelligenceObjects: RawIntelligenceObject[];
  messages: ConnectorMessage[];
}

// ─── Raw Intelligence Object ───────────────────────────────────
/** A single intelligence object produced by a connector before company resolution */
export interface RawIntelligenceObject {
  /** Company name to resolve against the CRM database */
  companyIdentifier: string;
  /** The actual intelligence content (e.g. concatenated row fields) */
  content: string;
  /** Optional short summary */
  summary?: string;
  /** URL where this intelligence was found (if applicable) */
  sourceUrl?: string;
  /** When this intelligence was captured or published */
  capturedAt?: Date;
  /** Knowledge category if known from context */
  category?: string;
  /** Arbitrary extra data from the source */
  metadata?: Record<string, unknown>;
}