/**
 * POST /api/intelligence/internal-memory
 *
 * Intelligence API — Internal Memory Endpoint
 *
 * Extracts intelligence signals from internal CRM data (notes, meetings,
 * timeline, human intel, account strategy) and optionally persists them.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractInternalMemorySignals, computeInternalMemoryDepth } from '@/lib/intelligence-sources/internal-memory-connector';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const { companyId } = await request.json() as { companyId?: string };

    if (!companyId || typeof companyId !== 'string') {
      return Response.json(
        { success: false, error: 'companyId is required (string)', meta: { endpoint: 'internal-memory', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, normalizedName: true, industry: true, sizeRange: true },
    });

    if (!company) {
      return Response.json(
        { success: false, error: 'Company not found', meta: { endpoint: 'internal-memory', durationMs: Date.now() - startedAt } },
        { status: 404 },
      );
    }

    const result = await extractInternalMemorySignals(companyId);
    const depth = await computeInternalMemoryDepth(companyId);

    return Response.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.normalizedName || company.rawName,
          industry: company.industry,
          sizeRange: company.sizeRange,
        },
        signals: result.signals.slice(0, 20),
        sources: result.sources,
        memoryDepth: depth,
        meta: {
          totalSignalsExtracted: result.signalsExtracted,
          signalsPersisted: result.signalsPersisted,
          pipelineLatencyMs: Date.now() - startedAt,
        },
      },
      meta: { endpoint: 'internal-memory', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/internal-memory] Pipeline error', { detail: message });
    return Response.json(
      { success: false, error: `Internal memory extraction failed: ${message}`, meta: { endpoint: 'internal-memory', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
