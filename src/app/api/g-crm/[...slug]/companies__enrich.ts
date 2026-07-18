import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { enqueueEnrichment } from '@/lib/workflow-engine';
import { runResearch } from '@/lib/research-engine';

/* ═══════════════════════════════════════════════════
   Company Data Enrichment via Research Engine
   Supports two modes:
   - async=true (default): Creates a workflow job and returns jobId immediately
   - async=false: Sync mode — delegates to Phase 3 research engine
   ═══════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, domain, force, async: asyncMode } = body as { companyId?: string; domain?: string; force?: boolean; async?: boolean };

    if (!companyId && !domain) {
      return NextResponse.json({ error: 'Provide companyId or domain' }, { status: 400 });
    }

    // Resolve companyId from domain if needed
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && domain) {
      const companyByDomain = await db.company.findFirst({
        where: { domain: domain.toLowerCase() },
        select: { id: true },
      });
      if (companyByDomain) resolvedCompanyId = companyByDomain.id;
    }

    // ── Async mode: create a workflow job ──
    if (asyncMode !== false && resolvedCompanyId) {
      const jobId = await enqueueEnrichment(resolvedCompanyId, { force });
      return NextResponse.json({ success: true, mode: 'async', jobId, message: 'Enrichment job queued' });
    }

    // Find company
    let company: any = null;
    if (companyId) {
      company = await db.company.findUnique({
        where: { id: companyId },
      });
    } else if (domain) {
      company = await db.company.findFirst({
        where: { domain: domain.toLowerCase() },
      });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check if already enriched recently (within 24h) unless force=true
    if (!force && company.lastEnrichedAt) {
      const hoursSince = (Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const researchCard = await db.companyResearchCard.findUnique({
          where: { companyId: company.id },
        });
        return NextResponse.json({
          success: true,
          message: 'Company was enriched recently',
          researchCard,
        });
      }
    }

    // Sync mode: delegate to Phase 3 research engine (evidence + confidence + signals)
    try {
      const result = await runResearch({
        companyId: company.id,
        companyName: company.rawName || company.normalizedName,
        domain: company.domain,
        industry: company.industry,
        force: true,
      });

      const researchCard = await db.companyResearchCard.findUnique({
        where: { companyId: company.id },
      });

      return NextResponse.json({
        success: true,
        mode: 'sync_research_engine',
        researchCard,
        evidenceCount: result.evidenceCount,
        overallConfidence: result.overallConfidence,
        signalsDetected: result.signals.signalCount,
      });
    } catch (researchError) {
      console.error('[companies/enrich] Research engine failed:', researchError);
      return NextResponse.json({ error: 'Research engine failed', detail: researchError instanceof Error ? researchError.message : 'Unknown' }, { status: 500 });
    }
  } catch (error) {
    console.error('Company enrichment error:', error);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}