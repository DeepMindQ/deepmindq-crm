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
import { IntelligenceResponse, IntelligenceMeta, IntelligenceInclude, FreshnessInfo, IntelligenceErrors, IntelligenceEndpoint } from './types';

/** Shared security headers applied to all intelligence API responses */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Vary': 'Accept, Include',
};

/** Safe number helper — catches NaN/Infinity, clamps to fallback */
export function safeNumber(value: unknown, fallback: number = 0, min?: number, max?: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || fallback;
  return min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, n) : n) : n;
}

/** Shared company DB loader — used by all 7 intelligence routes to avoid duplication */
export async function loadCompanyForFreshness(
  companyId: string,
): Promise<Record<string, unknown> | null> {
  return (await import('@/lib/db')).db.company.findUnique({
    where: { id: companyId },
    select: { id: true, lastEnrichedAt: true, lastActivityAt: true, intelligenceScore: true },
  }).catch(() => null);
}

// ── Include Parameter Parsing ───────────────────────────────────────────────────

// Single source of truth for valid include keys — mirrors IntelligenceInclude union type.
// NOTE: If you add a new IntelligenceInclude variant in types.ts, add it here too.
// Exported so validators.ts can import instead of duplicating.
export const VALID_INCLUDES: Set<IntelligenceInclude> = new Set<IntelligenceInclude>([
  // Company endpoint includes
  'signals', 'scores', 'contacts', 'timeline', 'actions', 'brief',
  'knowledge', 'mindmap', 'learning',
  // Reasoning endpoint includes
  'steps', 'impact', 'recommendations',
  // Opportunity endpoint includes
  'fusion', 'capabilities',
  // Action endpoint includes
  'sequences', 'recommendations',
  // Conversation endpoint includes
  'talkingPoints', 'objections', 'buyerProfiles',
  // Mindmap endpoint includes
  'nodes', 'edges', 'knowledgeConnections',
  // Brief endpoint includes
  'citations',
  // Knowledge endpoint includes
  'ingestion',
]);

// Ghost entries REMOVED: 'people_changes', 'data_health', 'reasoning', 'opportunities'
// These were defined but had zero route implementations. See K1-K4 in gap analysis.
// If adding new include keys, you MUST also add a route implementation.

/**
 * Parse the ?include= query parameter from the request.
 * Returns a set of valid includes (invalid ones are silently dropped).
 */
export function parseIncludeParams(
  request: NextRequest,
): { includes: Set<IntelligenceInclude>; raw: string | null; rejected: string[] } {
  const raw = request.nextUrl.searchParams.get('include');
  if (!raw) return { includes: new Set(), raw: null, rejected: [] };

  const requested = raw.split(',').map(s => s.trim()).filter(Boolean);
  const valid: IntelligenceInclude[] = [];
  const rejected: string[] = [];
  for (const s of requested) {
    if (VALID_INCLUDES.has(s as IntelligenceInclude)) {
      valid.push(s as IntelligenceInclude);
    } else {
      rejected.push(s);
    }
  }

  return { includes: new Set(valid), raw, rejected };
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

import type { IntelligenceErrorCode } from './types';

// Re-export EndpointName as a type alias for convenience
type EndpointName = IntelligenceEndpoint;

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
    /** Ticket 3: Governance metadata from governedAICall */
    governance?: {
      passed: boolean;
      generationType?: string;
      checks?: Record<string, { passed: boolean; message: string }>;
    };
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
      ...(meta.governance ? { governance: meta.governance } : {}),
    },
  };
}

/** Shared governance helper — eliminates 12-line duplication across all routes */
export async function runGovernanceMetadata(
  companyId: string,
  generationType: string,
): Promise<{ passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined> {
  try {
    if (!process.env.DATABASE_URL?.startsWith('postgres')) return undefined;
    const { getResearchContext } = await import('@/lib/intelligence-contract');
    const { runGovernanceChecks } = await import('@/lib/ai-governance');
    const researchCtx = await getResearchContext(companyId);
    const govResult = await runGovernanceChecks({ companyId, generationType, researchContext: researchCtx });
    return {
      passed: govResult.passed,
      generationType,
      checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
    };
  } catch {
    return undefined;
  }
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
  endpoint: IntelligenceEndpoint,
  companyId: string,
  error: string,
  errorCode: IntelligenceErrorCode = IntelligenceErrors.INTELLIGENCE_UNAVAILABLE,
  durationMs?: number,
  includes?: Set<IntelligenceInclude>,
): IntelligenceErrorResponse {
  const details: Record<string, unknown> = {};
  if (companyId) details.companyId = companyId;
  if (durationMs !== undefined && durationMs > 0) details.durationMs = durationMs;
  if (includes && includes.size > 0) details.requestedIncludes = Array.from(includes);
  const detailKeys = Object.keys(details);
  return { error, code: errorCode, ...(detailKeys.length > 0 && { details }) };
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
    lastSignal: lastActivity.toISOString(),  // falls back to lastActivityAt
    score,
  };
}
