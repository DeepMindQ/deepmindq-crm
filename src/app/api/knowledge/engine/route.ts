/**
 * Knowledge Engine — Health / status of the knowledge engine
 *
 * GET  /api/knowledge/engine     — Return engine health status
 * POST /api/knowledge/engine     — Handle coverage_v2 action (screen sends POST)
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

export async function GET(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    return buildHealthResponse();
  } catch (error) {
    logger.error('[knowledge/engine] GET failed', { error });
    return apiError('Failed to fetch knowledge engine status');
  }
}

export async function POST(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'coverage_v2') {
      return buildHealthResponse();
    }

    return apiError('Unknown action', 400);
  } catch (error) {
    logger.error('[knowledge/engine] POST failed', { error });
    return apiError('Failed to process knowledge engine request');
  }
}

async function buildHealthResponse() {
  const [totalEntries, withEmbeddings, lastUpdatedRaw] = await Promise.all([
    // Total knowledge entries
    db.knowledgeEntry.count(),

    // Entries that have a corresponding embedding
    db.embedding.count({
      where: { entityType: 'knowledge_entry' },
    }),

    // Most recently updated knowledge entry
    db.knowledgeEntry.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
  ]);

  const lastUpdated = lastUpdatedRaw?.updatedAt ?? null;

  return apiSuccess({
    status: 'active' as const,
    totalEntries,
    coverage: {
      withEmbeddings,
      withoutEmbeddings: Math.max(0, totalEntries - withEmbeddings),
    },
    lastUpdated,
    // Extra fields the knowledge-library-screen may consume
    embeddingRate: totalEntries > 0 ? Math.round((withEmbeddings / totalEntries) * 100) : 0,
  });
}
