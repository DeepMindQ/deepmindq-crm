import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   L-03: Company Data Enrichment via AI
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

    // Use AI to estimate company data
    const enrichmentData = await aiEnrichCompany(company.rawName, company.domain, company.industry);

    // Upsert research card with enrichment data
    const researchCard = await db.companyResearchCard.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...enrichmentData,
        enrichmentSource: 'ai_estimated',
        enrichmentDate: new Date(),
      },
      update: {
        ...enrichmentData,
        enrichmentSource: 'ai_estimated',
        enrichmentDate: new Date(),
      },
    });

    // Update enrichmentScore for all contacts at this company
    await db.contact.updateMany({
      where: { companyId: company.id },
      data: { enrichmentScore: 10, enrichmentData: JSON.stringify(enrichmentData) },
    });

    return NextResponse.json({ success: true, researchCard });
  } catch (error) {
    console.error('Company enrichment error:', error);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}

/* ── AI-powered enrichment ── */
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
  const prompt = `You are a business intelligence assistant. Based on the company name and domain provided, estimate the following information. Be concise and realistic.

Company: ${companyName}
Domain: ${domain || 'Unknown'}
Current Industry: ${existingIndustry || 'Unknown'}

Return ONLY valid JSON (no markdown, no code fences) with these fields:
{
  "businessOverview": "1-2 sentence business description",
  "revenue": "estimated revenue range like '$10M-$50M' or 'Self-funded' or '$1B+'",
  "employeeCount": "estimated like '51-200' or '1,000-5,000' or '10,000+'",
  "fundingStage": "one of: Bootstrap, Seed, Series A, Series B, Series C+, PE-backed, Public, Unknown",
  "techStack": "comma-separated list of likely technologies like 'React, AWS, Python, PostgreSQL'",
  "socialProfiles": "JSON string of likely social URLs like {\"linkedin\": \"https://linkedin.com/company/...\", \"twitter\": \"https://twitter.com/...\"}"
}`;

  try {
    const { generateText } = await import('z-ai-web-dev-sdk');
    const response = await generateText(prompt);

    // Parse the AI response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        businessOverview: parsed.businessOverview || '',
        revenue: parsed.revenue || 'Unknown',
        employeeCount: parsed.employeeCount || 'Unknown',
        fundingStage: parsed.fundingStage || 'Unknown',
        techStack: parsed.techStack || '',
        socialProfiles: parsed.socialProfiles ? JSON.stringify(parsed.socialProfiles) : '{}',
      };
    }
  } catch (err) {
    console.error('AI enrichment failed, using defaults:', err);
  }

  // Fallback defaults
  return {
    businessOverview: `${companyName} operates in the ${existingIndustry || 'technology'} sector.`,
    revenue: 'Unknown',
    employeeCount: 'Unknown',
    fundingStage: 'Unknown',
    techStack: '',
    socialProfiles: '{}',
  };
}