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

import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  queryKnowledgeIntelligence,
  type KnowledgeQueryInput,
} from '@/lib/m5-wow4-knowledge-intelligence';

export async function POST(request: Request): Promise<Response> {
  // ── Auth guard ─────────────────────────────────────────────────────
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

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
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: query (non-empty string)',
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    if (query.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query too long (max 2000 characters)',
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const input: KnowledgeQueryInput = {
      query: query.trim(),
      companyId,
      maxResults: maxResults
        ? Math.min(Math.max(1, maxResults), 50)
        : undefined,
    };

    // ── Execute ─────────────────────────────────────────────────────
    const result = queryKnowledgeIntelligence(input);

    return NextResponse.json({
      success: true,
      answer: result.answer,
      trust: result.trust,
      trustScore: result.trustScore,
    });
  } catch (error) {
    logger.error('[M5-WOW4] Knowledge query failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error processing knowledge query',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
