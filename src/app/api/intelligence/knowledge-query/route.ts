/**
 * POST /api/intelligence/knowledge-query
 *
 * M5 WOW #4 — Enterprise Knowledge Intelligence API
 *
 * Accepts a natural language question and returns a structured
 * knowledge answer composed from hybrid retrieval, knowledge graph,
 * memory, confidence scoring, and TRUST metadata.
 *
 * Input:  { query: string, companyId?: string, maxResults?: number }
 * Output: { success: true, answer: KnowledgeAnswer, trust: TrustMetadata, trustScore: TrustScore }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import {
  queryKnowledgeIntelligence,
  type KnowledgeQueryInput,
} from '@/lib/m5-wow4-knowledge-intelligence';
import { utilityGuard, utilityError, utilitySuccess, utilityCatchError, RateLimitedError } from '@/lib/intelligence-api/guard';

export async function POST(request: NextRequest): Promise<Response> {
  // ── Auth guard ─────────────────────────────────────────────────────
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // ── Correlation-id + rate limiting guard ──
  let ctx;
  try {
    ctx = utilityGuard(request, 'knowledge-query');
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return NextResponse.json({ error: 'Rate limited', code: 'RATE_LIMITED' }, { status: 429, headers: e.headers });
    }
    throw e;
  }

  try {
    // ── Parse body ───────────────────────────────────────────────────
    const body = await request.json();
    const { query, companyId, maxResults } = body as {
      query?: string;
      companyId?: string;
      maxResults?: number;
    };

    // ── Validate ─────────────────────────────────────────────────────
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return utilityError(ctx, 400, 'Missing required field: query (non-empty string)', 'VALIDATION_FAILED');
    }

    if (query.length > 2000) {
      return utilityError(ctx, 400, 'Query too long (max 2000 characters)', 'VALIDATION_FAILED');
    }

    const input: KnowledgeQueryInput = {
      query: query.trim(),
      companyId,
      maxResults: maxResults
        ? Math.min(Math.max(1, maxResults), 50)
        : undefined,
    };

    // ── Execute ─────────────────────────────────────────────────────
    const result = await queryKnowledgeIntelligence(input);

    return utilitySuccess(ctx, {
      answer: result.answer,
      trust: result.trust,
      trustScore: result.trustScore,
    }, 'knowledge-query');
  } catch (error) {
    return utilityCatchError(ctx, error, 500, 'INTERNAL_ERROR', 'Knowledge query failed');
  }
}
