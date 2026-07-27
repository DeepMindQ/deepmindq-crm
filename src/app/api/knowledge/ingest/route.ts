import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeIngestionPipeline } from '@/lib/knowledge-ingestion-pipeline';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// POST /api/knowledge/ingest — Ingest a document into the AI knowledge graph
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, documentType, content, sourceUrl, sourceType, metadata, capabilityAssetId } = body;
    if (!title || !documentType || !content) {
      return apiError('title, documentType, and content are required', 400);
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
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

// GET /api/knowledge/ingest — Get ingestion stats
export async function GET() {
  try {
    const stats = await KnowledgeIngestionPipeline.getStats();
    return apiSuccess(stats);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
