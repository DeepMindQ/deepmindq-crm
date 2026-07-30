/**
 * Intelligence API — Request Handler Wrapper
 *
 * Provides a unified handler wrapper for all /api/intelligence/* endpoints.
 * Each wrapped handler automatically gets:
 *   1. Correlation ID propagation (x-correlation-id header)
 *   2. Rate limiting (per IP, per endpoint)
 *   3. Zod validation (companyId + include params)
 *   4. Structured error responses (never leaks stack traces or internal data)
 *   5. Request/response timing
 *
 * Usage:
 *   import { withIntelligenceHandler } from '@/lib/intelligence-api/handler';
 *   import { companyIntelligenceSchema } from '@/lib/intelligence-api/validators';
 *
 *   export const GET = withIntelligenceHandler('company', companyIntelligenceSchema, async (params) => {
 *     // params.companyId — validated, non-empty string
 *     // params.include — validated string or undefined
 *     // params.correlationId — correlation ID string
 *     // params.request — original NextRequest
 *     // params.responseHeaders — mutable headers object (set correlation-id, rate-limit headers)
 *     return { data: myData, confidence: 0.85, freshness: { level: 'fresh', ... } };
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCorrelationId, createResponseHeaders, CORRELATION_HEADER } from '@/lib/correlation-id';
import { rateLimit } from '@/lib/rate-limit';
import type { RateLimitResult } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
} from './middleware';
import type {
  IntelligenceResponse,
  IntelligenceInclude,
  FreshnessInfo,
} from './types';
import { IntelligenceErrors } from './types';

// ── Rate limit config ───────────────────────────────────────────────────────

const INTELLIGENCE_RATE_LIMIT = 60; // requests per minute per IP per endpoint
const INTELLIGENCE_RATE_WINDOW_MS = 60_000; // 1 minute

// ── Types ──────────────────────────────────────────────────────────────────

type IntelligenceEndpointName = 'company' | 'reasoning' | 'opportunity' | 'action' | 'conversation' | 'mindmap' | 'brief' | 'grounding' | 'retrieval' | 'knowledge';

interface ValidatedParams {
  companyId: string;
  include: string | undefined;
  correlationId: string;
  request: NextRequest;
  responseHeaders: Record<string, string>;
}

interface HandlerResult<T> {
  data: T;
  confidence: number;
  freshness?: FreshnessInfo;
  cached?: boolean;
  durationMs?: number;
}

type IntelligenceSchema = z.ZodObject<{
  companyId: z.ZodString;
  include: z.ZodOptional<z.ZodString>;
}>;

type IntelligenceHandler<T> = (params: ValidatedParams) => Promise<HandlerResult<T>>;

// ── Sensitive data patterns to scrub from error messages ────────────────────

const SENSITIVE_PATTERNS = [
  /password[=\s][^\s]*/gi,
  /secret[=\s][^\s]*/gi,
  /token[=\s][^\s]*/gi,
  /api[_-]?key[=\s][^\s]*/gi,
  /connection[_-]?string[=\s][^\s]*/gi,
  /database[_-]?url[=\s][^\s]*/gi,
  /postgresql:\/\/[^\s]+/gi,
  /postgres:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /mongodb:\/\/[^\s]+/gi,
  /bearer\s+\S+/gi,
  /authorization:\s*\S+/gi,
];

/**
 * Scrub sensitive data from error messages to prevent leaking in API responses.
 */
function scrubError(message: string): string {
  let scrubbed = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  // Truncate long error messages
  return scrubbed.length > 500 ? scrubbed.substring(0, 500) + '...' : scrubbed;
}

// ── Main wrapper function ────────────────────────────────────────────────────

/**
 * Wrap an Intelligence API handler with validation, rate limiting,
 * correlation ID tracking, and structured error responses.
 */
export function withIntelligenceHandler<T>(
  endpoint: IntelligenceEndpointName,
  schema: IntelligenceSchema,
  handler: IntelligenceHandler<T>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> => {
    const startedAt = Date.now();
    const correlationId = getCorrelationId(request);
    const responseHeaders = createResponseHeaders(correlationId);

    // ── Extract path param ──────────────────────────────────────────────
    let companyId: string;
    try {
      const { id } = await context.params;
      companyId = id;
    } catch (err) {
      logger.error('[intelligence-gateway] Failed to extract route params', {
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        createErrorResponse(endpoint, '', 'Invalid route parameters', IntelligenceErrors.MISSING_COMPANY_ID, Date.now() - startedAt),
        { status: 400, headers: responseHeaders },
      );
    }

    // ── Rate limiting ───────────────────────────────────────────────────
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rateLimitResult: RateLimitResult = rateLimit({
      key: `intelligence:${clientIp}:${endpoint}`,
      limit: INTELLIGENCE_RATE_LIMIT,
      windowMs: INTELLIGENCE_RATE_WINDOW_MS,
    });

    responseHeaders['X-RateLimit-Remaining'] = String(rateLimitResult.remaining);
    responseHeaders['X-RateLimit-Reset'] = String(Math.ceil(rateLimitResult.resetAt / 1000));

    if (!rateLimitResult.success) {
      logger.warn('[intelligence-gateway] Rate limited', {
        correlationId,
        endpoint,
        clientIp,
      });
      return NextResponse.json(
        createErrorResponse(endpoint, companyId || '', 'Rate limit exceeded. Try again later.', IntelligenceErrors.RATE_LIMITED, Date.now() - startedAt),
        {
          status: 429,
          headers: {
            ...responseHeaders,
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    // ── Zod validation ──────────────────────────────────────────────────
    const rawInclude = request.nextUrl.searchParams.get('include') ?? undefined;
    const validationResult = schema.safeParse({
      companyId,
      include: rawInclude,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn('[intelligence-gateway] Validation failed', {
        correlationId,
        endpoint,
        companyId,
        errors: validationResult.error.issues.map((e: z.ZodIssue) => e.message),
      });
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: firstError?.message || 'Invalid request parameters',
          meta: {
            endpoint,
            companyId: companyId || '',
            requestedAt: new Date().toISOString(),
            respondedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
            cached: false,
            includes: [],
            confidence: 0,
            freshness: { level: 'unknown', lastEnriched: null, lastSignal: null, score: 0 },
          },
        },
        { status: 400, headers: responseHeaders },
      );
    }

    // ── Execute handler ────────────────────────────────────────────────
    try {
      const result = await handler({
        companyId: validationResult.data.companyId,
        include: validationResult.data.include,
        correlationId,
        request,
        responseHeaders,
      });

      const durationMs = result.durationMs ?? (Date.now() - startedAt);

      return NextResponse.json(
        createResponse(endpoint, validationResult.data.companyId, result.data, {
          durationMs,
          includes: new Set<string>((rawInclude || '').split(',').map(s => s.trim()).filter(Boolean)) as Set<IntelligenceInclude>,
          cached: result.cached ?? false,
          confidence: result.confidence,
          freshness: result.freshness ?? { level: 'unknown', lastEnriched: null, lastSignal: null, score: 0 },
        }),
        { headers: responseHeaders },
      );
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = scrubError(rawMessage);

      logger.error('[intelligence-gateway] Unhandled error', {
        correlationId,
        endpoint,
        companyId: validationResult.data.companyId,
        error: rawMessage,
        durationMs: Date.now() - startedAt,
      });

      // NEVER leak stack traces, internal paths, or sensitive data
      return NextResponse.json(
        createErrorResponse(
          endpoint,
          validationResult.data.companyId,
          safeMessage,
          IntelligenceErrors.INTELLIGENCE_UNAVAILABLE,
          Date.now() - startedAt,
        ),
        { status: 500, headers: responseHeaders },
      );
    }
  };
}

export { SENSITIVE_PATTERNS, scrubError };
