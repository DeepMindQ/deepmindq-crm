/**
 * POST /api/intelligence/capability-pipeline
 * ==========================================
 *
 * The orchestrator API for the Internal Intelligence Graph.
 * Handles:
 *   - POST: Ingest capabilities + trigger full pipeline
 *   - GET: Graph status + search
 */

import { NextRequest, NextResponse } from 'next/server';
import { CapabilityIntelligenceEngine, type CapabilityInput } from '@/lib/capability-intelligence-engine';

// ═══════════════════════════════════════════════════════════════════════
// POST — Ingest capabilities or trigger pipeline
// ═══════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // ── Action: Ingest single capability ──
    if (action === 'ingest') {
      const result = await CapabilityIntelligenceEngine.ingest(body.data as CapabilityInput);
      return NextResponse.json(result);
    }

    // ── Action: Bulk ingest ──
    if (action === 'bulk-ingest') {
      const inputs = (body.data || body.capabilities || []) as CapabilityInput[];
      const result = await CapabilityIntelligenceEngine.bulkIngest(inputs);
      return NextResponse.json(result);
    }

    // ── Action: Match signal to capabilities ──
    if (action === 'match-signal') {
      const { companyId, signalId } = body;
      if (!companyId || !signalId) {
        return NextResponse.json({ error: 'companyId and signalId required' }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.matchSignalToCapabilities(companyId, signalId);
      return NextResponse.json(result);
    }

    // ── Action: Generate opportunity ──
    if (action === 'generate-opportunity') {
      const { companyId, signalId, capabilityMatchId } = body;
      if (!companyId || !signalId || !capabilityMatchId) {
        return NextResponse.json({ error: 'companyId, signalId, and capabilityMatchId required' }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.generateOpportunity(companyId, signalId, capabilityMatchId);
      return NextResponse.json(result);
    }

    // ── Action: Calculate win probability ──
    if (action === 'win-probability') {
      const { companyId } = body;
      if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.calculateWinProbability(companyId);
      return NextResponse.json(result);
    }

    // ── Action: Run full pipeline for a company ──
    if (action === 'run-pipeline') {
      const { companyId } = body;
      if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
      }
      const result = await CapabilityIntelligenceEngine.runFullPipeline(companyId);
      return NextResponse.json(result);
    }

    return NextResponse.json({
      error: `Unknown action: ${action}. Use: ingest, bulk-ingest, match-signal, generate-opportunity, win-probability, run-pipeline`,
    }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[capability-pipeline]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GET — Graph status, search, list capabilities
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    // ── Graph status ──
    if (action === 'status') {
      const status = await CapabilityIntelligenceEngine.getGraphStatus();
      return NextResponse.json(status);
    }

    // ── Search capabilities ──
    if (action === 'search') {
      const query = searchParams.get('q') || '';
      const topK = parseInt(searchParams.get('topK') || '5', 10);
      if (!query) {
        return NextResponse.json({ error: 'q parameter required for search' }, { status: 400 });
      }
      const results = await CapabilityIntelligenceEngine.searchCapabilities(query, topK);
      return NextResponse.json({ query, results });
    }

    // ── List capabilities ──
    if (action === 'list') {
      const category = searchParams.get('category') || undefined;
      const assets = await CapabilityIntelligenceEngine.getAssets(category);
      return NextResponse.json(assets);
    }

    return NextResponse.json({ error: `Unknown action: ${action}. Use: status, search, list` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[capability-pipeline]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
