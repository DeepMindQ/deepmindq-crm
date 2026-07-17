import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { webSearch, callLLM, extractJSON } from '@/lib/zai-helpers';

/* ═══════════════════════════════════════════════════
   L-03: Company Data Enrichment via AI + Web Search
   ═══════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, domain } = body as { companyId?: string; domain?: string };

    if (!companyId && !domain) {
      return NextResponse.json({ error: 'Provide companyId or domain' }, { status: 400 });
    }

    // Find company
    let company: any = null;
    if (companyId) {
      company = await db.company.findUnique({
        where: { id: companyId },
        include: { researchCard: true },
      });
    } else if (domain) {
      company = await db.company.findFirst({
        where: { domain: domain.toLowerCase() },
        include: { researchCard: true },
      });
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check if already enriched recently (within 24h)
    if (company.researchCard?.enrichmentDate) {
      const enrichedAt = new Date(company.researchCard.enrichmentDate);
      const hoursSince = (Date.now() - enrichedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return NextResponse.json({
          success: true,
          message: 'Company was enriched recently',
          researchCard: company.researchCard,
        });
      }
    }

    // Use AI + web search to get REAL data about the company
    const enrichmentData = await aiEnrichCompany(company.rawName || company.normalizedName, company.domain, company.industry);

    // Upsert research card with enrichment data
    const researchCard = await db.companyResearchCard.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...enrichmentData,
        enrichmentSource: 'ai_web_search',
        enrichmentDate: new Date(),
      },
      update: {
        ...enrichmentData,
        enrichmentSource: 'ai_web_search',
        enrichmentDate: new Date(),
      },
    });

    // Update enrichmentScore for all contacts at this company
    await db.contact.updateMany({
      where: { companyId: company.id },
      data: { enrichmentScore: 50, enrichmentData: JSON.stringify(enrichmentData) },
    });

    return NextResponse.json({ success: true, researchCard });
  } catch (error) {
    console.error('Company enrichment error:', error);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}

/* ── AI + Web Search enrichment ── */
async function aiEnrichCompany(
  companyName: string,
  domain: string | null,
  existingIndustry: string | null,
): Promise<{
  businessOverview: string;
  revenue: string;
  employeeCount: string;
  fundingStage: string;
  techStack: string;
  socialProfiles: string;
}> {
  // Step 1: Run web searches for REAL external data
  const searchQueries = [
    `${companyName} ${domain || ''} revenue employees funding 2024 2025`,
    `${companyName} technology stack products services`,
    `${companyName} LinkedIn company profile overview`,
  ];

  console.log(`[companies/enrich] Searching for: ${companyName}`);

  const searchResults = await Promise.allSettled(
    searchQueries.map(q => webSearch(q, 8)),
  );

  // Collect all search results into context
  const allSnippets: string[] = [];
  let linkedInUrl = '';
  let twitterUrl = '';

  for (const result of searchResults) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet}`);
        if (r.url?.includes('linkedin.com/company') && !linkedInUrl) {
          linkedInUrl = r.url;
        }
        if ((r.url?.includes('twitter.com') || r.url?.includes('x.com')) && !twitterUrl) {
          twitterUrl = r.url;
        }
      }
    }
  }

  const searchContext = allSnippets.slice(0, 30).join('\n');

  // Step 2: Ask LLM with real search context
  const systemPrompt = `You are a business intelligence research assistant. Based on the web search results provided, extract accurate, factual information about the company. Only include information that is directly supported by the search results. If the search results don't contain specific data, say "Not found in search results" rather than guessing.

Return ONLY valid JSON (no markdown, no code fences) with these fields:
{
  "businessOverview": "2-3 sentence factual description based on search results",
  "revenue": "exact or estimated revenue from search results, e.g. '$10M-$50M' or 'Not found in search results'",
  "employeeCount": "employee count from search results, e.g. '51-200' or 'Not found in search results'",
  "fundingStage": "one of: Bootstrap, Seed, Series A, Series B, Series C+, PE-backed, Public, Unknown",
  "techStack": "comma-separated technologies mentioned in search results, or empty string if none found",
  "socialProfiles": "JSON string with any social URLs found, e.g. {\\"linkedin\\": \\"https://...\\", \\"twitter\\": \\"https://...\\"}"
}`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || 'Unknown'}
Current Industry: ${existingIndustry || 'Unknown'}

Web Search Results:
${searchContext || 'No web search results found.'}

Based on the above search results, provide accurate company data as JSON.`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const parsed = extractJSON(response) as Record<string, unknown> | null;

    if (parsed && typeof parsed === 'object') {
      console.log(`[companies/enrich] Successfully enriched ${companyName} with web data`);
      return {
        businessOverview: String(parsed.businessOverview || `${companyName} operates in the ${existingIndustry || 'technology'} sector.`),
        revenue: String(parsed.revenue || 'Unknown'),
        employeeCount: String(parsed.employeeCount || 'Unknown'),
        fundingStage: String(parsed.fundingStage || 'Unknown'),
        techStack: String(parsed.techStack || ''),
        socialProfiles: parsed.socialProfiles ? JSON.stringify(parsed.socialProfiles) : JSON.stringify(Object.fromEntries(
          Object.entries({ linkedin: linkedInUrl, twitter: twitterUrl }).filter(([, v]) => v)
        )),
      };
    }
  } catch (err) {
    console.error('[companies/enrich] AI enrichment failed:', err);
  }

  // Fallback — at least include any social URLs found
  return {
    businessOverview: `${companyName} operates in the ${existingIndustry || 'technology'} sector.`,
    revenue: 'Unknown',
    employeeCount: 'Unknown',
    fundingStage: 'Unknown',
    techStack: '',
    socialProfiles: JSON.stringify(Object.fromEntries(
      Object.entries({ linkedin: linkedInUrl, twitter: twitterUrl }).filter(([, v]) => v)
    )),
  };
}