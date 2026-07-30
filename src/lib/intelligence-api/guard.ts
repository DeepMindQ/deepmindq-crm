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
  createResponse,
} from './middleware';
import type { IntelligenceInclude } from './types';
import { IntelligenceErrors } from './types';
import { companyIdSchema, includeSchema } from './validators';
import { z } from 'zod';
import { logger } from '@/lib/logger';

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
  endpoint: string,
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
      JSON.stringify(createErrorResponse(endpoint as 'company', '', 'Invalid route parameters', IntelligenceErrors.MISSING_COMPANY_ID, Date.now() - startedAt)),
      { status: 400, headers: responseHeaders },
    );
  }

  // ── Validate companyId with Zod ───────────────────────────────────────
  const companyIdResult = companyIdSchema.safeParse(companyId);
  if (!companyIdResult.success) {
    const message = companyIdResult.error.issues[0]?.message || 'Invalid company ID';
    logger.warn('[intelligence-guard] Company ID validation failed', { correlationId, endpoint, companyId, message });
    return new Response(
      JSON.stringify(createErrorResponse(endpoint as 'company', companyId, message, IntelligenceErrors.MISSING_COMPANY_ID, Date.now() - startedAt)),
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
        JSON.stringify(createErrorResponse(endpoint as 'company', companyId, message, IntelligenceErrors.INVALID_INCLUDE, Date.now() - startedAt)),
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
      JSON.stringify(createErrorResponse(endpoint as 'company', companyId, 'Rate limit exceeded', IntelligenceErrors.RATE_LIMITED, Date.now() - startedAt)),
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
      createErrorResponse(endpoint as 'company', '', 'Rate limit exceeded', IntelligenceErrors.RATE_LIMITED, 0),
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

/**
 * Build a success response with correlation headers.
 */
export function intelligenceSuccessResponse(
  data: unknown,
  guard: IntelligenceGuardResult,
  meta: { durationMs: number; cached: boolean; confidence: number; freshness?: import('./types').FreshnessInfo },
): Response {
  const envelope = createResponse('company' as never, guard.companyId, data, {
    ...meta,
    includes: guard.includes,
    requestedAt: new Date(),
    respondedAt: new Date(),
  });
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: guard.responseHeaders,
  });
}
