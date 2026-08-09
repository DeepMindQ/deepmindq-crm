/**
 * Knowledge API — Ingestion Pipeline
 *
 * POST /api/knowledge/ingest  — Ingest a document into the AI knowledge graph
 * GET  /api/knowledge/ingest  — Get ingestion pipeline statistics
 *
 * Standardized response: { success, data, meta: { endpoint, durationMs } }
 */

import { NextRequest } from 'next/server';
import { KnowledgeIngestionPipeline } from '@/lib/knowledge-ingestion-pipeline';
import { logger } from '@/lib/logger';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';

// POST — Ingest a document
export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const started = Date.now();
  try {
    const ingestSchema = z.object({
      title: z.string().trim().min(1, 'Title is required').max(500),
      documentType: z.string().min(1, 'Document type is required').max(100),
      content: z.string().min(1, 'Content is required').max(100_000, 'Content exceeds maximum size'),
      sourceUrl: z.string().max(2000).optional(),
      sourceType: z.string().max(50).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      capabilityAssetId: z.string().max(100).optional(),
    });

    const body = await request.json();
    const parsed = validateBody(ingestSchema, body);
    if (parsed instanceof Response) return parsed;
    const { title, documentType, content, sourceUrl, sourceType, metadata, capabilityAssetId } = parsed;

    const result = await KnowledgeIngestionPipeline.ingest({
      title,
      documentType,
      content,
      sourceUrl,
      sourceType,
      metadata,
      capabilityAssetId,
    });

    return Response.json({
      success: true,
      data: result,
      meta: { endpoint: 'knowledge:ingest', durationMs: Date.now() - started },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[knowledge/ingest] failed', { error: msg });
    return Response.json(
      { success: false, data: null, error: msg, meta: { endpoint: 'knowledge:ingest', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

// GET — Ingestion statistics
export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const started = Date.now();
  try {
    const stats = await KnowledgeIngestionPipeline.getStats();
    return Response.json({
      success: true,
      data: stats,
      meta: { endpoint: 'knowledge:ingest-stats', durationMs: Date.now() - started },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[knowledge/ingest-stats] failed', { error: msg });
    return Response.json(
      { success: false, data: null, error: msg, meta: { endpoint: 'knowledge:ingest-stats', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}
