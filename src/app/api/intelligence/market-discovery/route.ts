/**
 * POST /api/intelligence/market-discovery
 *
 * M5 WOW #2 — Market Intelligence Discovery API
 *
 * Accepts a natural language market query and returns ranked companies
 * scored by ICP alignment, account scoring, and buying intent.
 * Every result carries TRUST metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  discoverMarket,
  type MarketDiscoveryResponse,
} from '@/lib/market-discovery';
import { utilityGuard, utilityError, utilitySuccess, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';

// ─── Input Validation ─────────────────────────────────────────────

interface MarketDiscoveryInput {
  query: string;
  maxResults?: number;
}

function validateInput(body: unknown): { data: MarketDiscoveryInput; error: string | null } {
  if (!body || typeof body !== 'object') {
    return { data: { query: '', maxResults: 10 }, error: 'Request body must be a JSON object' };
  }
  const obj = body as Record<string, unknown>;

  const query = obj.query;
  if (typeof query !== 'string' || query.trim().length < 3) {
    return { data: { query: '', maxResults: 10 }, error: 'Field "query" is required and must be at least 3 characters' };
  }

  let maxResults = 10;
  if (obj.maxResults !== undefined) {
    if (typeof obj.maxResults !== 'number' || obj.maxResults < 1 || obj.maxResults > 50) {
      return { data: { query: '', maxResults: 10 }, error: 'Field "maxResults" must be a number between 1 and 50' };
    }
    maxResults = Math.round(obj.maxResults);
  }

  return { data: { query: query.trim(), maxResults }, error: null };
}

// ─── POST Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // ── Auth + RBAC guard ──
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  // ── Correlation-id + rate limiting guard ──
  let ctx;
  try {
    ctx = utilityGuard(req, 'market-discovery');
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return NextResponse.json({ error: 'Rate limited', code: 'RATE_LIMITED' }, { status: 429, headers: e.headers });
    }
    throw e;
  }

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return utilityError(ctx, 400, 'Invalid JSON in request body', 'VALIDATION_FAILED');
    }

    // Validate input
    const { data, error } = validateInput(body);
    if (error) {
      return utilityError(ctx, 400, error, 'VALIDATION_FAILED');
    }

    logger.info('[market-discovery] Processing request', {
      query: data.query,
      maxResults: data.maxResults,
    });

    // Run the market discovery composition
    const result: MarketDiscoveryResponse = await discoverMarket(data.query, data.maxResults);

    logger.info('[market-discovery] Request complete', {
      resultCount: result.results.length,
      latencyMs: result.latencyMs,
    });

    return utilitySuccess(ctx, result, 'market-discovery', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 500, 'INTERNAL_ERROR', 'Market discovery failed', Date.now() - startedAt);
  }
}
