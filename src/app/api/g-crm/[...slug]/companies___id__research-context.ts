import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getResearchContext, buildResearchContextText } from '@/lib/intelligence-contract';

/**
 * GET /api/g-crm/companies/[id]/research-context
 *
 * THE SINGLE INTELLIGENCE CONTRACT — all downstream consumers use this.
 *
 * Returns clean, structured JSON with all Phase 3 intelligence for a company.
 * This is the ONLY API that AI routes should consume for company data.
 * No independent web searches should be done when this returns data.
 *
 * Query params:
 *   ?format=text — returns plain text context for LLM prompt injection
 *   ?format=json — (default) returns structured JSON
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Quick existence check
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const ctx = await getResearchContext(companyId);

    if (format === 'text') {
      // Return plain text for LLM prompt injection
      return new Response(buildResearchContextText(ctx), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      // Structured context
      context: ctx,

      // Convenience: has enough data for AI consumption?
      readyForAI: ctx.researchCard !== null && ctx.freshness.score >= 20,

      // Convenience: should research be triggered?
      needsRefresh: ctx.freshness.status === 'stale' || ctx.freshness.status === 'none',
    });
  } catch (error) {
    console.error('[research-context] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch research context' },
      { status: 500 },
    );
  }
}