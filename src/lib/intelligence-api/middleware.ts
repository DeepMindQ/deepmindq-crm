/**
 * Intelligence API Middleware — Shared utilities for all /api/intelligence/* endpoints
 *
 * Provides:
 * - parseIncludeParams: Parse ?include= query param
 * - createResponse: Wrap data in IntelligenceResponse envelope
 * - createErrorResponse: Standardized error responses
 * - getFreshness: Compute freshness from company data
 * - getCompanyFreshness: Fetch freshness from DB
 */

import { NextRequest } from 'next/server';
import { IntelligenceResponse, IntelligenceMeta, IntelligenceInclude, FreshnessInfo, IntelligenceErrors } from './types';

// ── Include Parameter Parsing ───────────────────────────────────────────────────

// Single source of truth for valid include keys — mirrors IntelligenceInclude union type.
// NOTE: If you add a new IntelligenceInclude variant in types.ts, add it here too.
const VALID_INCLUDES: Set<string> = new Set<string>([
  // Company endpoint includes
  'signals', 'scores', 'contacts', 'timeline', 'actions', 'brief',
  'knowledge', 'mindmap', 'data_health', 'people_changes',
  'reasoning', 'opportunities', 'learning',
  // Reasoning endpoint includes
  'steps', 'impact', 'recommendations',
  // Opportunity endpoint includes
  'fusion', 'capabilities',
  // Action endpoint includes
  'sequences',
  // Conversation endpoint includes
  'talkingPoints', 'objections', 'buyerProfiles',
  // Mindmap endpoint includes
  'nodes', 'edges', 'knowledgeConnections',
  // Knowledge endpoint includes
  'ingestion',
]);

/**
 * Parse the ?include= query parameter from the request.
 * Returns a set of valid includes (invalid ones are silently dropped).
 */
export function parseIncludeParams(
  request: NextRequest,
): { includes: Set<IntelligenceInclude>; raw: string | null } {
  const raw = request.nextUrl.searchParams.get('include');
  if (!raw) return { includes: new Set(), raw: null };

  const requested = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const valid = requested.filter(s => VALID_INCLUDES.has(s)) as IntelligenceInclude[];

  return { includes: new Set(valid), raw };
}

/**
 * Check if a specific include is requested.
 */
export function shouldInclude(includes: Set<IntelligenceInclude>, key: IntelligenceInclude): boolean {
  return includes.has(key);
}

/**
 * Check if ANY of the given includes are requested.
 */
export function shouldIncludeAny(includes: Set<IntelligenceInclude>, ...keys: IntelligenceInclude[]): boolean {
  return keys.some(k => includes.has(k));
}

// ── Response Builders ────────────────────────────────────────────────────────────

type EndpointName = 'company' | 'reasoning' | 'opportunity' | 'action' | 'conversation' | 'mindmap' | 'brief' | 'grounding' | 'retrieval' | 'knowledge';

/**
 * Create a successful IntelligenceResponse envelope.
 */
export function createResponse<T>(
  endpoint: EndpointName,
  companyId: string,
  data: T,
  meta: {
    durationMs: number;
    includes: Set<IntelligenceInclude>;
    cached: boolean;
    confidence: number;
    freshness?: FreshnessInfo;
    requestedAt?: Date;
    respondedAt?: Date;
  },
): IntelligenceResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      endpoint,
      companyId,
      requestedAt: (meta.requestedAt || new Date()).toISOString(),
      respondedAt: (meta.respondedAt || new Date()).toISOString(),
      durationMs: meta.durationMs,
      cached: meta.cached,
      includes: Array.from(meta.includes),
      confidence: meta.confidence,
      freshness: meta.freshness || { level: 'unknown', lastEnriched: null, lastSignal: null, score: 0 },
    },
  };
}

/**
 * Create an error IntelligenceResponse envelope.
 */
export interface IntelligenceErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Create an error response following the Ticket 1 exit-criteria format:
 * `{ error: string, code: string, details?: object }`
 *
 * Used by all Intelligence API error paths (400, 429, 500).
 */
export function createErrorResponse(
  _endpoint: EndpointName,
  companyId: string,
  error: string,
  errorCode: string = IntelligenceErrors.INTELLIGENCE_UNAVAILABLE,
  durationMs?: number,
  includes?: Set<IntelligenceInclude>,
): IntelligenceErrorResponse {
  const details: Record<string, unknown> = {};
  if (companyId) details.companyId = companyId;
  if (durationMs !== undefined && durationMs > 0) details.durationMs = durationMs;
  if (includes && includes.size > 0) details.requestedIncludes = Array.from(includes);
  const detailKeys = Object.keys(details);
  return { error, code: errorCode, details: detailKeys.length > 0 ? details : undefined };
}

// ── Freshness Computation ─────────────────────────────────────────────────────────

/**
 * Compute freshness info from a company record.
 */
export function computeFreshness(company: {
  lastEnrichedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
  intelligenceScore?: number | null;
}): FreshnessInfo {
  const lastEnriched = company.lastEnrichedAt
    ? new Date(company.lastEnrichedAt)
    : company.lastActivityAt
      ? new Date(company.lastActivityAt)
      : null;

  if (!lastEnriched) {
    return { level: 'unknown', lastEnriched: null, lastSignal: null, score: 0 };
  }

  const hoursSince = (Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60);

  let level: FreshnessInfo['level'] = 'stale';
  let score = 0;
  if (hoursSince < 1) { level = 'realtime'; score = 95; }
  else if (hoursSince < 6) { level = 'fresh'; score = 80; }
  else if (hoursSince < 24) { level = 'fresh'; score = 65; }
  else if (hoursSince < 72) { level = 'aging'; score = 40; }
  else if (hoursSince < 168) { level = 'stale'; score = 20; }

  const lastActivity = company.lastActivityAt ? new Date(company.lastActivityAt) : lastEnriched;
  return {
    level,
    lastEnriched: lastEnriched.toISOString(),
    lastSignal: lastActivity.toISOString(),
    score,
  };
}
