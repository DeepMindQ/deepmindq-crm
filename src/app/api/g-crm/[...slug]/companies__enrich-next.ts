/**
 * Batch Company Enrichment — DB-Driven, No Server State
 *
 * POST /api/g-crm/companies/enrich-next
 *   Finds the next unenriched company, enriches it via Phase 3 research engine, returns result.
 *   Client calls this in a loop. No server-side job tracking needed.
 *   The database IS the state (company.researchCard exists = enriched).
 *
 * GET /api/g-crm/companies/enrich-status
 *   Returns count of enriched vs total companies (for progress display).
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { runResearch } from '@/lib/research-engine';

// ── POST: Enrich next unenriched company ──

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { force = false } = body as { force?: boolean };

    // Find next unenriched company (or any if force)
    const whereClause = force
      ? {}
      : { researchCard: null };

    const company = await db.company.findFirst({
      where: whereClause,
      select: { id: true, rawName: true, normalizedName: true, domain: true, industry: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      const total = await db.company.count();
      const enriched = await db.companyResearchCard.count();
      return NextResponse.json({
        enriched: false,
        done: true,
        totalCompanies: total,
        enrichedCount: enriched,
        message: enriched > 0 ? 'All companies enriched!' : 'No companies in database.',
      });
    }

    // Delegate to Phase 3 research engine
    const companyName = company.rawName || company.normalizedName;
    
    try {
      const result = await runResearch({
        companyId: company.id,
        companyName,
        domain: company.domain,
        industry: company.industry,
        force: true,
      });

      const remaining = await db.company.count({ where: { researchCard: null } });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      return NextResponse.json({
        enriched: true,
        done: false,
        companyId: company.id,
        companyName,
        remaining,
        elapsedSeconds: parseFloat(elapsed),
        evidenceCount: result.evidenceCount,
        confidence: Math.round(result.overallConfidence * 100),
        signalsDetected: result.signals.signalCount,
        mode: 'research_engine_v3',
      });
    } catch (err) {
      console.error(`[enrich-next] Research engine failed for ${companyName}:`, err);
      return NextResponse.json(
        { enriched: false, error: 'Research engine failed', detail: err instanceof Error ? err.message : 'Unknown', companyId: company.id, companyName },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[enrich-next] Error:', error);
    return NextResponse.json(
      { enriched: false, error: 'Enrichment failed', detail: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// ── GET: Enrichment status overview ──

export async function GET() {
  try {
    const total = await db.company.count();
    const enriched = await db.companyResearchCard.count();
    const remaining = total - enriched;
    const progress = total > 0 ? Math.round((enriched / total) * 100) : 0;

    return NextResponse.json({
      totalCompanies: total,
      enrichedCount: enriched,
      remaining,
      progress,
      etaSeconds: remaining * 6, // ~6s per company
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}