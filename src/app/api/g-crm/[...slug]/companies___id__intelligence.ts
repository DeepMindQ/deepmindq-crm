import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getCompanyEvidence, getEvidenceSummary } from '@/lib/research-engine';

/**
 * GET /api/g-crm/companies/[id]/intelligence
 *
 * Phase 3: Returns company intelligence using EXISTING research engine data
 * (evidence, research card, signals, field confidence) instead of re-searching.
 *
 * For live AI analysis, use /api/g-ai/account-brief?companyId=xxx
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    // 1. Fetch the company with research card and related data in parallel
    const [company, contacts, signals, notes, timeline, evidenceResult] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
      }),
      db.contact.findMany({
        where: { companyId },
        take: 10,
        orderBy: { leadScore: 'desc' },
      }),
      db.companySignal.findMany({
        where: { companyId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      db.companyNote.findMany({
        where: { companyId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      db.companyTimelineEvent.findMany({
        where: { companyId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      getCompanyEvidence(companyId, { limit: 20 }),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 2. Get research card (may be null if not yet enriched)
    const researchCard = await db.companyResearchCard.findUnique({
      where: { companyId },
    });

    // 3. Parse field confidence from research card
    let fieldConfidence: Record<string, number> = {};
    if (researchCard?.fieldConfidence) {
      try { fieldConfidence = JSON.parse(researchCard.fieldConfidence); } catch { /* ignore */ }
    }

    // 4. Build intelligence summary from evidence
    const evidenceSummary = await getEvidenceSummary(companyId);

    // 5. Build enrichment status
    const intelligenceStatus = researchCard
      ? {
          enriched: true,
          evidenceCount: evidenceSummary.totalEvidence,
          fieldCount: Object.keys(evidenceSummary.fields).length,
          overallConfidence: researchCard.fieldConfidence
            ? Object.values(fieldConfidence).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(fieldConfidence).length)
            : 0,
          signalCount: signals.length,
          highImpactSignals: signals.filter((s: any) => s.impact === 'high').length,
          lastEnriched: researchCard.enrichmentDate,
          enrichmentSource: researchCard.enrichmentSource,
        }
      : {
          enriched: false,
          evidenceCount: 0,
          fieldCount: 0,
          overallConfidence: 0,
          signalCount: signals.length,
          highImpactSignals: 0,
          lastEnriched: null,
          enrichmentSource: null,
        };

    // 6. Extract key people from research card
    let keyPeople: any[] = [];
    if (researchCard?.keyPeople) {
      try { keyPeople = JSON.parse(researchCard.keyPeople); } catch { /* ignore */ }
    }

    // 7. Extract recent news from research card
    let recentNews: any[] = [];
    if (researchCard?.recentNews) {
      try { recentNews = JSON.parse(researchCard.recentNews); } catch { /* ignore */ }
    }

    return NextResponse.json({
      company: {
        id: company.id,
        rawName: company.rawName,
        industry: company.industry,
        domain: company.domain,
        location: company.location,
        country: company.country,
        sizeRange: company.sizeRange,
        status: company.status,
        intelligenceScore: company.intelligenceScore,
        engagementScore: company.engagementScore,
        website: company.website,
      },
      researchCard,
      fieldConfidence,
      evidenceSummary,
      evidence: evidenceResult.evidence.map(e => ({
        ...e,
        sourceDate: e.sourceDate?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
      contacts,
      signals,
      notes,
      timeline,
      keyPeople,
      recentNews,
      intelligenceStatus,
    });
  } catch (error) {
    console.error('[intelligence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate company intelligence' },
      { status: 500 },
    );
  }
}