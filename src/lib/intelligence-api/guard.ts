/**
 * Intelligence API — Shared Route Middleware
 *
 * Applied at the top of every /api/intelligence/* GET handler.
 * Provides:
 *   1. Correlation ID propagation
 *   2. Rate limiting (per IP per endpoint)
 *   3. Zod validation of companyId + include params
 *   4. Returns early Response if validation/rate-limit fails, or null if OK.
 *
 * Usage:
 *   const guard = await intelligenceGuard(request, params, 'company');
 *   if (guard) return guard; // early return with error
 *   // proceed — guard is null
 */

import { NextRequest } from 'next/server';
import { getCorrelationId, createResponseHeaders } from '@/lib/correlation-id';
import { rateLimit } from '@/lib/rate-limit';
import {
  parseIncludeParams,
  createErrorResponse,
} from './middleware';
import type { IntelligenceInclude, IntelligenceEndpoint } from './types';
import type { IntelligenceErrorResponse } from './middleware';
import { IntelligenceErrors } from './types';
import { companyIdSchema, includeSchema } from './validators';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { scrubError } from './handler';

const INTELLIGENCE_RATE_LIMIT = 60;
const INTELLIGENCE_RATE_WINDOW_MS = 60_000;
const UTILITY_RATE_LIMIT = 120;
const UTILITY_RATE_WINDOW_MS = 60_000;

export interface IntelligenceGuardResult {
  companyId: string;
  correlationId: string;
  responseHeaders: Record<string, string>;
  includes: Set<IntelligenceInclude>;
}

/**
 * Run intelligence route guard checks.
 * Returns a Response (early error exit) or null (proceed).
 */
export async function intelligenceGuard(
  request: NextRequest,
  paramsPromise: Promise<{ id: string }>,
  endpoint: IntelligenceEndpoint,
): Promise<Response | IntelligenceGuardResult> {
  const startedAt = Date.now();
  const correlationId = getCorrelationId(request);
  const responseHeaders = createResponseHeaders(correlationId);

  // ── Extract companyId from route params ────────────────────────────────
  let companyId: string;
  try {
    const { id } = await paramsPromise;
    companyId = id;
  } catch {
    logger.error('[intelligence-guard] Failed to extract route params', { correlationId });
    return new Response(
      JSON.stringify(createErrorResponse(endpoint, '', 'Invalid route parameters', IntelligenceErrors.MISSING_COMPANY_ID, Date.now() - startedAt)),
      { status: 400, headers: responseHeaders },
    );
  }

  // ── Validate companyId with Zod ───────────────────────────────────────
  const companyIdResult = companyIdSchema.safeParse(companyId);
  if (!companyIdResult.success) {
    const message = companyIdResult.error.issues[0]?.message || 'Invalid company ID';
    logger.warn('[intelligence-guard] Company ID validation failed', { correlationId, endpoint, companyId, message });
    return new Response(
      JSON.stringify(createErrorResponse(endpoint, companyId, message, IntelligenceErrors.MISSING_COMPANY_ID, Date.now() - startedAt)),
      { status: 400, headers: responseHeaders },
    );
  }

  // ── Validate include param with Zod ───────────────────────────────────
  const rawInclude = request.nextUrl.searchParams.get('include') ?? undefined;
  if (rawInclude !== undefined) {
    const includeResult = includeSchema.safeParse(rawInclude);
    if (!includeResult.success) {
      const message = includeResult.error.issues[0]?.message || 'Invalid include parameter';
      logger.warn('[intelligence-guard] Include validation failed', { correlationId, endpoint, companyId, message });
      return new Response(
        JSON.stringify(createErrorResponse(endpoint, companyId, message, IntelligenceErrors.INVALID_INCLUDE, Date.now() - startedAt)),
        { status: 400, headers: responseHeaders },
      );
    }
  }

  // ── Rate limiting ────────────────────────────────────────────────────
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const rl = rateLimit({
    key: `intelligence:${clientIp}:${endpoint}`,
    limit: INTELLIGENCE_RATE_LIMIT,
    windowMs: INTELLIGENCE_RATE_WINDOW_MS,
  });

  responseHeaders['X-RateLimit-Remaining'] = String(rl.remaining);
  responseHeaders['X-RateLimit-Reset'] = String(Math.ceil(rl.resetAt / 1000));

  if (!rl.success) {
    logger.warn('[intelligence-guard] Rate limited', { correlationId, endpoint, clientIp });
    return new Response(
      JSON.stringify(createErrorResponse(endpoint, companyId, 'Rate limit exceeded', IntelligenceErrors.RATE_LIMITED, Date.now() - startedAt)),
      {
        status: 429,
        headers: {
          ...responseHeaders,
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  // ── All checks passed ────────────────────────────────────────────────
  const { includes } = parseIncludeParams(request);
  return {
    companyId,
    correlationId,
    responseHeaders,
    includes,
  };
}

/**
 * Lightweight guard for utility endpoints (no companyId validation).
 * Provides: correlation-id, rate limiting, response headers.
 *
 * Usage:
 *   const ctx = utilityGuard(request, 'refresh');
 *   // ctx.correlationId, ctx.responseHeaders available
 */
export function utilityGuard(
  request: NextRequest,
  endpoint: string,
): { correlationId: string; responseHeaders: Record<string, string> } {
  const correlationId = getCorrelationId(request);
  const responseHeaders = createResponseHeaders(correlationId);

  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const rl = rateLimit({
    key: `intelligence:${clientIp}:${endpoint}`,
    limit: UTILITY_RATE_LIMIT,
    windowMs: UTILITY_RATE_WINDOW_MS,
  });

  responseHeaders['X-RateLimit-Remaining'] = String(rl.remaining);
  responseHeaders['X-RateLimit-Reset'] = String(Math.ceil(rl.resetAt / 1000));

  if (!rl.success) {
    logger.warn('[intelligence-utility] Rate limited', { correlationId, endpoint, clientIp });
    throw new RateLimitedError(
      createErrorResponse(endpoint as IntelligenceEndpoint, '', 'Rate limit exceeded', IntelligenceErrors.RATE_LIMITED, 0),
      responseHeaders,
    );
  }

  return { correlationId, responseHeaders };
}

/** Error thrown by utilityGuard when rate-limited */
export class RateLimitedError extends Error {
  constructor(
    public errorBody: ReturnType<typeof createErrorResponse>,
    public headers: Record<string, string>,
  ) {
    super('Rate limited');
    this.name = 'RateLimitedError';
  }
}

// ── Utility Route Helpers ──────────────────────────────────────────────────────
//
// Used by all /api/intelligence/* utility routes (unified, refresh, stats, etc.)
// Ensures: correct error format { error, code, details }, correlation-id headers,
// sensitive data scrubbing, and consistent success envelope.
//

export type UtilityErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'INTELLIGENCE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'ENGINE_TIMEOUT'
  | 'VALIDATION_FAILED';

/**
 * Build a structured error Response for utility routes.
 * Guarantees: { error: string, code: string, details?: object } format + correlation-id headers.
 *
 * @param ctx - From utilityGuard(): { correlationId, responseHeaders }
 * @param status - HTTP status code (400, 404, 429, 500, 502)
 * @param message - Human-readable error message (will be scrubbed if rawError is provided)
 * @param code - Error code string
 * @param durationMs - Optional request duration for details
 */
export function utilityError(
  ctx: { correlationId: string; responseHeaders: Record<string, string> },
  status: number,
  message: string,
  code: UtilityErrorCode = 'INTELLIGENCE_UNAVAILABLE',
  durationMs?: number,
): Response {
  const details: Record<string, unknown> = {};
  if (durationMs !== undefined && durationMs > 0) details.durationMs = durationMs;
  const detailKeys = Object.keys(details);
  const body: IntelligenceErrorResponse = {
    error: message,
    code,
    details: detailKeys.length > 0 ? details : undefined,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: ctx.responseHeaders,
  });
}

/**
 * Build a structured error Response for utility routes from a caught error.
 * Automatically scrubs sensitive data from error messages.
 *
 * @param ctx - From utilityGuard()
 * @param err - The caught error
 * @param status - HTTP status code (default 502)
 * @param code - Error code (default INTELLIGENCE_UNAVAILABLE)
 * @param prefix - Human-readable prefix (e.g., 'Enrichment failed')
 * @param durationMs - Optional request duration
 */
export function utilityCatchError(
  ctx: { correlationId: string; responseHeaders: Record<string, string> },
  err: unknown,
  status: number = 502,
  code: UtilityErrorCode = 'INTELLIGENCE_UNAVAILABLE',
  prefix: string = 'Operation failed',
  durationMs?: number,
): Response {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const safeMessage = scrubError(rawMessage);
  logger.error(`[intelligence-utility] ${prefix}`, { error: rawMessage, correlationId: ctx.correlationId });
  return utilityError(ctx, status, `${prefix}: ${safeMessage}`, code, durationMs);
}

/**
 * Build a success Response for utility routes.
 * Uses the flat IntelligenceResponse envelope with correlation-id headers.
 *
 * @param ctx - From utilityGuard()
 * @param data - Response data
 * @param endpoint - Endpoint name for metadata
 * @param durationMs - Request duration in ms
 */
export function utilitySuccess(
  ctx: { correlationId: string; responseHeaders: Record<string, string> },
  data: unknown,
  endpoint: string,
  durationMs?: number,
): Response {
  return new Response(JSON.stringify({
    success: true,
    data,
    meta: { endpoint, durationMs: durationMs ?? 0 },
  }), {
    status: 200,
    headers: ctx.responseHeaders,
  });
}
