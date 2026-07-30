/**
 * POST /api/intelligence/capability-pipeline
 * GET  /api/intelligence/capability-pipeline
 *
 * Intelligence API — Capability Pipeline Endpoint
 *
 * Orchestrates the Internal Intelligence Graph:
 *   POST: ingest, bulk-ingest, match-signal, generate-opportunity, win-probability, run-pipeline
 *   GET:  status, search, list capabilities
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { CapabilityIntelligenceEngine, type CapabilityInput } from '@/lib/capability-intelligence-engine';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'ingest') {
      const result = await CapabilityIntelligenceEngine.ingest(body.data as CapabilityInput);
      return Response.json({ success: true, data: result, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'bulk-ingest') {
      const inputs = (body.data || body.capabilities || []) as CapabilityInput[];
      const result = await CapabilityIntelligenceEngine.bulkIngest(inputs);
      return Response.json({ success: true, data: result, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'match-signal') {
      const { companyId, signalId } = body;
      if (!companyId || !signalId) {
        return Response.json({ success: false, error: 'companyId and signalId required', meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.matchSignalToCapabilities(companyId, signalId);
      return Response.json({ success: true, data: result, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'generate-opportunity') {
      const { companyId, signalId, capabilityMatchId } = body;
      if (!companyId || !signalId || !capabilityMatchId) {
        return Response.json({ success: false, error: 'companyId, signalId, and capabilityMatchId required', meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.generateOpportunity(companyId, signalId, capabilityMatchId);
      return Response.json({ success: true, data: result, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'win-probability') {
      const { companyId } = body;
      if (!companyId) {
        return Response.json({ success: false, error: 'companyId required', meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.calculateWinProbability(companyId);
      return Response.json({ success: true, data: result, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'run-pipeline') {
      const { companyId } = body;
      if (!companyId) {
        return Response.json({ success: false, error: 'companyId required', meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.runFullPipeline(companyId);
      return Response.json({ success: true, data: result, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    return Response.json({
      success: false,
      error: `Unknown action: ${action}. Use: ingest, bulk-ingest, match-signal, generate-opportunity, win-probability, run-pipeline`,
      meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt },
    }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/capability-pipeline] POST Error', { detail: message });
    return Response.json(
      { success: false, error: message, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const action = request.nextUrl.searchParams.get('action') || 'status';

    if (action === 'status') {
      const status = await CapabilityIntelligenceEngine.getGraphStatus();
      return Response.json({ success: true, data: status, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'search') {
      const query = request.nextUrl.searchParams.get('q') || '';
      const topK = parseInt(request.nextUrl.searchParams.get('topK') || '5', 10);
      if (!query) {
        return Response.json({ success: false, error: 'q parameter required for search', meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } }, { status: 400 });
      }
      const results = await CapabilityIntelligenceEngine.searchCapabilities(query, topK);
      return Response.json({ success: true, data: { query, results }, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    if (action === 'list') {
      const category = request.nextUrl.searchParams.get('category') || undefined;
      const assets = await CapabilityIntelligenceEngine.getAssets(category);
      return Response.json({ success: true, data: assets, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } });
    }

    return Response.json({
      success: false,
      error: `Unknown action: ${action}. Use: status, search, list`,
      meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt },
    }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/capability-pipeline] GET Error', { detail: message });
    return Response.json(
      { success: false, error: message, meta: { endpoint: 'capability-pipeline', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
