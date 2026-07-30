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

// POST — Ingest a document
export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json();
    const { title, documentType, content, sourceUrl, sourceType, metadata, capabilityAssetId } = body;
    if (!title || !documentType || !content) {
      return Response.json(
        { success: false, data: null, error: 'title, documentType, and content are required', meta: { endpoint: 'knowledge:ingest', durationMs: Date.now() - started } },
        { status: 400 },
      );
    }

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
