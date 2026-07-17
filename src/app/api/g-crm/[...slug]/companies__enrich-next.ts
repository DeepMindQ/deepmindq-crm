/**
 * Batch Company Enrichment — DB-Driven, No Server State
 *
 * POST /api/g-crm/companies/enrich-next
 *   Finds the next unenriched company, enriches it, returns result.
 *   Client calls this in a loop. No server-side job tracking needed.
 *   The database IS the state (company.researchCard exists = enriched).
 *
 * GET /api/g-crm/companies/enrich-status
 *   Returns count of enriched vs total companies (for progress display).
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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
      select: { id: true, rawName: true, normalizedName: true, domain: true, industry: true, website: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      // Count remaining
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

    // ── Enrich this company ──
    const { webSearch, callLLM, extractJSON, tavilyAIAnswer } = await import('@/lib/zai-helpers');
    const companyName = company.rawName || company.normalizedName;
    let companyIndustry: string | null = null;
    let companyWebsite: string | null = null;

    // Lightweight: 2 parallel searches + 1 LLM call (fits Vercel 10s)
    const [bizResults, peopleResults] = await Promise.allSettled([
      webSearch(`${companyName} ${company.domain || ''} revenue employees industry funding 2024 2025`, 5),
      webSearch(`${companyName} CEO CTO executives leadership team`, 4),
    ]);

    const snippets: string[] = [];
    for (const result of [bizResults, peopleResults]) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        for (const r of result.value) {
          snippets.push(`[${r.title}] ${r.snippet}`);
        }
      }
    }
    const searchContext = snippets.slice(0, 20).join('\n');

    // LLM extraction
    let enrichmentData: Record<string, string> | null = null;

    try {
      const systemPrompt = `Extract company data from search results. Return ONLY JSON:
{"businessOverview":"2 sentences","revenue":"value or Not found","employeeCount":"value or Not found","fundingStage":"stage or Not found","techStack":"comma-sep or empty","industry":"industry","website":"url"}`;

      const userPrompt = `Company: ${companyName}\nDomain: ${company.domain || 'Unknown'}\n\nSearch Results:\n${searchContext || 'No results.'}`;

      const response = await callLLM(systemPrompt, userPrompt);
      const parsed = extractJSON(response) as Record<string, unknown> | null;

    if (parsed && typeof parsed === 'object') {
        enrichmentData = {
          businessOverview: String(parsed.businessOverview || ''),
          revenue: String(parsed.revenue || 'Not found'),
          employeeCount: String(parsed.employeeCount || 'Not found'),
          fundingStage: String(parsed.fundingStage || 'Not found'),
          techStack: String(parsed.techStack || ''),
          socialProfiles: '{}',
          keyPeople: '[]',
          recentNews: '[]',
        };
        // Store industry/website for company backfill
        if (parsed.industry && String(parsed.industry) !== 'Not found') companyIndustry = String(parsed.industry);
        if (parsed.website) companyWebsite = String(parsed.website);
      }
    } catch (err) {
      console.warn(`[enrich-next] LLM failed for ${companyName}, trying Tavily AI`);
    }

    // Tavily AI fallback
    if (!enrichmentData?.businessOverview) {
      try {
        const answer = await tavilyAIAnswer(`${companyName} ${company.domain || ''} revenue employees industry overview`);
        if (answer) {
          enrichmentData = {
            businessOverview: answer.slice(0, 500),
            revenue: 'Not found',
            employeeCount: 'Not found',
            fundingStage: 'Not found',
            techStack: '',
            socialProfiles: '{}',
            keyPeople: '[]',
            recentNews: '[]',
          };
        }
      } catch { /* fall through */ }
    }

    // Final fallback
    if (!enrichmentData) {
      enrichmentData = {
        businessOverview: snippets.slice(0, 3).join(' ') || `${companyName} — enrichment unavailable`,
        revenue: 'Not found',
        employeeCount: 'Not found',
        fundingStage: 'Not found',
        techStack: '',
        socialProfiles: '{}',
        keyPeople: '[]',
        recentNews: '[]',
      };
    }

    // Upsert research card
    await db.companyResearchCard.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...enrichmentData,
        enrichmentSource: 'batch_ai_web_search',
        enrichmentDate: new Date(),
      },
      update: {
        ...enrichmentData,
        enrichmentSource: 'batch_ai_web_search',
        enrichmentDate: new Date(),
      },
    });

    // Backfill company fields from enrichment
    const companyUpdate: Record<string, string> = {};
    if (companyIndustry && !company.industry) companyUpdate.industry = companyIndustry;
    if (companyWebsite && !company.website) companyUpdate.website = companyWebsite;
    if (Object.keys(companyUpdate).length > 0) {
      await db.company.update({ where: { id: company.id }, data: companyUpdate });
    }

    // Update contact enrichment scores
    await db.contact.updateMany({
      where: { companyId: company.id },
      data: { enrichmentScore: 50 },
    });

    // Count progress
    const remaining = await db.company.count({ where: { researchCard: null } });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[enrich-next] ${companyName} done in ${elapsed}s. ${remaining} remaining.`);

    return NextResponse.json({
      enriched: true,
      done: false,
      companyId: company.id,
      companyName,
      remaining,
      elapsedSeconds: parseFloat(elapsed),
    });

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