import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { webSearch, callLLM, extractJSON, findKeyPeople, getCompanyNews, tavilyAIAnswer } from '@/lib/zai-helpers';
import { enqueueEnrichment } from '@/lib/workflow-engine';

/* ═══════════════════════════════════════════════════
   Company Data Enrichment via AI + Web Search
   Supports two modes:
   - async=true (default): Creates a workflow job and returns jobId immediately
   - async=false: Direct processing (legacy behavior)
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

    // Check if already enriched recently (within 24h) unless force=true
    if (!force && company.researchCard?.enrichmentDate) {
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

    // Use AI + web search to get REAL data
    const companyName = company.rawName || company.normalizedName;
    console.log(`[companies/enrich] Starting enrichment for: ${companyName}`);

    const enrichmentData = await aiEnrichCompany(companyName, company.domain, company.industry);

    // Upsert research card — only fields that exist in Prisma schema
    const { keyPeople: _kp, recentNews: _rn, industry: _ind, website: _web, ...prismaFields } = enrichmentData;
    const researchCard = await db.companyResearchCard.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...prismaFields,
        enrichmentSource: 'ai_web_search',
        enrichmentDate: new Date(),
      },
      update: {
        ...prismaFields,
        enrichmentSource: 'ai_web_search',
        enrichmentDate: new Date(),
      },
    });

    // Update company fields from research if they were missing
    const companyUpdate: Record<string, string | number> = {};
    if (!company.industry && enrichmentData.industry && enrichmentData.industry !== 'Not found') {
      companyUpdate.industry = enrichmentData.industry;
    }
    if (!company.website && enrichmentData.website) {
      companyUpdate.website = enrichmentData.website;
    }

    // Calculate real intelligence score from enrichment data (#26)
    let score = 10; // base score for having a company record
    if (enrichmentData.businessOverview && enrichmentData.businessOverview !== `${companyName} operates in the ${company.industry || 'technology'} sector.`) score += 15;
    if (enrichmentData.revenue && enrichmentData.revenue !== 'Not found' && enrichmentData.revenue !== 'Unknown') score += 15;
    if (enrichmentData.employeeCount && enrichmentData.employeeCount !== 'Not found' && enrichmentData.employeeCount !== 'Unknown') score += 10;
    if (enrichmentData.fundingStage && enrichmentData.fundingStage !== 'Not found' && enrichmentData.fundingStage !== 'Unknown') score += 10;
    if (enrichmentData.techStack && enrichmentData.techStack.length > 0) score += 10;
    if (enrichmentData.industry && enrichmentData.industry !== 'Not found') score += 10;
    if (company.domain) score += 10;
    if (company.website) score += 5;
    if (enrichmentData.socialProfiles && enrichmentData.socialProfiles !== '{}' && enrichmentData.socialProfiles !== '{}') score += 5;
    companyUpdate.intelligenceScore = Math.min(100, score);

    if (Object.keys(companyUpdate).length > 0) {
      await db.company.update({ where: { id: company.id }, data: companyUpdate });
    }

    // Update enrichment score for contacts
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

/* ── AI + Web Search enrichment with key people and news ── */
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
  keyPeople: string;
  recentNews: string;
  industry: string;
  website: string;
}> {
  // Run multiple parallel web searches
  const searchQueries = [
    `${companyName} ${domain || ''} revenue employees funding 2024 2025`,
    `${companyName} technology stack products services`,
    `${companyName} LinkedIn company profile overview`,
    `${companyName} CEO CTO CIO executives leadership team`,
    `${companyName} news 2025 funding hiring expansion`,
  ];

  console.log(`[companies/enrich] Searching for: ${companyName}`);

  const searchResults = await Promise.allSettled(
    searchQueries.map(q => webSearch(q, 6)),
  );

  // Collect all search results
  const allSnippets: string[] = [];
  let linkedInUrl = '';
  let twitterUrl = '';
  let websiteUrl = '';

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
        if (!websiteUrl && r.url && !r.url.includes('linkedin.com') && !r.url.includes('twitter.com') && !r.url.includes('wikipedia.org') && !r.url.includes('google.com')) {
          websiteUrl = r.url;
        }
      }
    }
  }

  const searchContext = allSnippets.slice(0, 30).join('\n');

  // Extract key people via dedicated search
  let keyPeopleData: string = '[]';
  try {
    const people = await findKeyPeople(companyName);
    if (people.length > 0) {
      keyPeopleData = JSON.stringify(people.slice(0, 10));
    }
  } catch (err) {
    console.warn('[companies/enrich] Key people search failed:', err);
  }

  // Extract news/signals via dedicated search
  let newsData: string = '[]';
  try {
    const news = await getCompanyNews(companyName);
    if (news.length > 0) {
      newsData = JSON.stringify(news.slice(0, 8));
    }
  } catch (err) {
    console.warn('[companies/enrich] News search failed:', err);
  }

  // Ask LLM with real search context
  const systemPrompt = `You are a business intelligence research assistant. Based ONLY on the web search results provided, extract accurate, factual information.

CRITICAL: Only include information directly supported by the search results. If something is not found, write "Not found".

Return ONLY valid JSON:
{
  "businessOverview": "2-3 sentence factual description",
  "revenue": "revenue or range, or 'Not found'",
  "employeeCount": "employee count or range, or 'Not found'",
  "fundingStage": "Bootstrap/Seed/Series A/Series B/Series C+/PE-backed/Public/Not found",
  "techStack": "comma-separated technologies, or empty string",
  "industry": "primary industry",
  "website": "official website URL"
}`;

  const userPrompt = `Company: ${companyName}
Domain: ${domain || 'Unknown'}
Current Industry: ${existingIndustry || 'Unknown'}

Web Search Results:
${searchContext || 'No results found.'}

Provide accurate company data as JSON.`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const parsed = extractJSON(response) as Record<string, unknown> | null;

    if (parsed && typeof parsed === 'object') {
      console.log(`[companies/enrich] Successfully enriched ${companyName}`);
      const socialProfiles: Record<string, string> = {};
      if (linkedInUrl) socialProfiles.linkedin = linkedInUrl;
      if (twitterUrl) socialProfiles.twitter = twitterUrl;

      return {
        businessOverview: String(parsed.businessOverview || `${companyName} operates in the ${existingIndustry || 'technology'} sector.`),
        revenue: String(parsed.revenue || 'Not found'),
        employeeCount: String(parsed.employeeCount || 'Not found'),
        fundingStage: String(parsed.fundingStage || 'Not found'),
        techStack: String(parsed.techStack || ''),
        socialProfiles: JSON.stringify(socialProfiles),
        keyPeople: keyPeopleData,
        recentNews: newsData,
        industry: String(parsed.industry || existingIndustry || 'Not found'),
        website: String(parsed.website || websiteUrl || domain ? `https://${domain}` : ''),
      };
    }
  } catch (err) {
    console.error('[companies/enrich] LLM extraction failed, trying Tavily AI fallback:', err);
    // Try Tavily AI answer as LLM substitute
    try {
      const tavilyAnswer = await tavilyAIAnswer(
        `${companyName} ${domain || ''} revenue employees funding industry technology overview`
      );
      if (tavilyAnswer) {
        const socialProfiles: Record<string, string> = {};
        if (linkedInUrl) socialProfiles.linkedin = linkedInUrl;
        if (twitterUrl) socialProfiles.twitter = twitterUrl;

        return {
          businessOverview: tavilyAnswer.slice(0, 500),
          revenue: 'Not found',
          employeeCount: 'Not found',
          fundingStage: 'Not found',
          techStack: '',
          socialProfiles: JSON.stringify(socialProfiles),
          keyPeople: keyPeopleData,
          recentNews: newsData,
          industry: existingIndustry || 'Not found',
          website: websiteUrl || domain ? `https://${domain}` : '',
        };
      }
    } catch { /* fall through to basic fallback */ }
  }

  // Final fallback — search-only, no AI
  const socialProfiles: Record<string, string> = {};
  if (linkedInUrl) socialProfiles.linkedin = linkedInUrl;
  if (twitterUrl) socialProfiles.twitter = twitterUrl;

  // Build a basic overview from search snippets
  const snippetOverview = allSnippets.slice(0, 3).join(' ');

  return {
    businessOverview: snippetOverview || `${companyName} operates in the ${existingIndustry || 'technology'} sector.`,
    revenue: 'Not found',
    employeeCount: 'Not found',
    fundingStage: 'Not found',
    techStack: '',
    socialProfiles: JSON.stringify(socialProfiles),
    keyPeople: keyPeopleData,
    recentNews: newsData,
    industry: existingIndustry || 'Not found',
    website: websiteUrl || domain ? `https://${domain}` : '',
  };
}