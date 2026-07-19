/**
 * POST /api/g-crm/companies/research
 *   Trigger Phase 3 full research pipeline for a company (async job).
 *   Returns jobId immediately. Research runs: search→evidence→extract→validate→score→store.
 *
 * POST /api/g-crm/companies/bulk-research
 *   Trigger Phase 3 research for multiple companies at once.
 */

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { enqueueResearch, enqueueBulkResearch } from '@/lib/workflow-engine';

/* ═══════════════════════════════════════════════════
   POST — Trigger Phase 3 Research for a Company
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, domain, force } = body as { companyId?: string; domain?: string; force?: boolean };

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

    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const jobId = await enqueueResearch(resolvedCompanyId, { force });

    return NextResponse.json({
      success: true,
      mode: 'research',
      jobId,
      message: 'Phase 3 research job queued (6-step pipeline: search→evidence→extract→validate→score→store)',
    });
  } catch (error) {
    console.error('[companies/research] Error:', error);
    return NextResponse.json({ error: 'Failed to queue research' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST (bulk) — Bulk Research for Multiple Companies
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { companyIds, force } = body as { companyIds?: string[]; force?: boolean };

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json({ error: 'Provide companyIds array' }, { status: 400 });
    }

    if (companyIds.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 companies per bulk request' }, { status: 400 });
    }

    const result = await enqueueBulkResearch(companyIds, { force });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Queued ${result.created} research jobs (${result.skipped} skipped — already active)`,
    });
  } catch (error) {
    console.error('[companies/research] Bulk error:', error);
    return NextResponse.json({ error: 'Failed to queue bulk research' }, { status: 500 });
  }
}