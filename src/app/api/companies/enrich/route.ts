import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { governedAICall } from '@/lib/ai-governance';
import { logger } from '@/lib/logger';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { clearbitConnector } from '@/lib/intelligence-sources/connectors/clearbit-connector';
import { computeTrustScore, type TrustMetadata } from '@/lib/intelligence-sources/trust-metadata';

/* ═══════════════════════════════════════════════════
   M5 Phase 1: Company Data Enrichment

   Priority Order:
   1. Verified external API (Clearbit/Apollo)
   2. AI estimation (fallback, labeled as estimated)

   CRITICAL: Every data point must carry TRUST metadata.
   The platform must NEVER present AI-estimated data as verified fact.
   ═══════════════════════════════════════════════════ */

export async function POST(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const enrichSchema = z.object({
      companyId: z.string().min(1).optional(),
      domain: z.string().min(1).optional(),
      source: z.enum(['auto', 'api', 'ai_fallback']).optional().default('auto'),
    }).refine(d => d.companyId || d.domain, { message: 'companyId or domain is required' });

    const body = await request.json();
    const parsed = validateBody(enrichSchema, body);
    if (parsed instanceof Response) return parsed;
    const { companyId, domain, source } = parsed;

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

    // ── Phase 1: Try verified external API first ──
    let enrichmentData: Record<string, any>;
    let enrichmentSource: string;
    let trustMetadata: Record<string, TrustMetadata> = {};

    if (source === 'auto' || source === 'api') {
      try {
        const apiResult = await clearbitConnector.acquire({
          domain: company.domain || '',
          companyName: company.rawName,
          enrichTech: true,
        });

        if (apiResult.success && apiResult.intelligenceObjects.length > 0) {
          enrichmentData = extractEnrichmentFromAPI(apiResult.intelligenceObjects);
          enrichmentSource = 'clearbit_verified';
          // Extract trust metadata from each intelligence object
          for (const obj of apiResult.intelligenceObjects) {
            if (obj.metadata?.enrichmentType && obj.metadata?.trust) {
              trustMetadata[obj.metadata.enrichmentType as string] = obj.metadata.trust as TrustMetadata;
            }
          }
          logger.info('[enrich] Clearbit API enrichment successful', {
            companyId: company.id,
            objectsFound: apiResult.intelligenceObjects.length,
          });
        } else {
          // API returned no data — fall through to AI
          logger.info('[enrich] Clearbit returned no data, falling back to AI', {
            companyId: company.id,
            errors: apiResult.errors,
          });
          enrichmentData = await aiEnrichCompany(company.id, company.rawName, company.domain, company.industry);
          enrichmentSource = 'ai_estimated';
          trustMetadata = {
            overall: {
              source: 'ai_inference' as const,
              confidence: 'low' as const,
              freshness: new Date().toISOString(),
              reasoning: 'All fields AI-estimated. No verified external data available. Treat as signals only, not facts.',
            },
          };
        }
      } catch (err) {
        logger.warn('[enrich] Clearbit API failed, falling back to AI', { error: err });
        enrichmentData = await aiEnrichCompany(company.id, company.rawName, company.domain, company.industry);
        enrichmentSource = 'ai_estimated';
        trustMetadata = {
          overall: {
            source: 'ai_inference' as const,
            confidence: 'low' as const,
            freshness: new Date().toISOString(),
            reasoning: 'Clearbit API unavailable. All fields AI-estimated.',
          },
        };
      }
    } else {
      // Explicit AI fallback request
      enrichmentData = await aiEnrichCompany(company.id, company.rawName, company.domain, company.industry);
      enrichmentSource = 'ai_estimated';
      trustMetadata = {
        overall: {
          source: 'ai_inference' as const,
          confidence: 'low' as const,
          freshness: new Date().toISOString(),
          reasoning: 'User requested AI estimation. All fields are estimates, not verified data.',
        },
      };
    }

    // ── Upsert research card with enrichment data + TRUST ──
    const researchCard = await db.companyResearchCard.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...enrichmentData,
        enrichmentSource,
        enrichmentDate: new Date(),
      },
      update: {
        ...enrichmentData,
        enrichmentSource,
        enrichmentDate: new Date(),
      },
    });

    // Update enrichmentScore for all contacts at this company
    const enrichmentScore = enrichmentSource === 'clearbit_verified' ? 25 : 10;
    await db.contact.updateMany({
      where: { companyId: company.id },
      data: {
        enrichmentScore,
        enrichmentData: JSON.stringify({
          ...enrichmentData,
          source: enrichmentSource,
          trust: trustMetadata,
        }),
      },
    });

    // Compute composite TRUST score for the enrichment
    const trustEntries = Object.values(trustMetadata);
    const compositeTrust = trustEntries.length > 0
      ? computeTrustScore(trustEntries[0]!)
      : null;

    return NextResponse.json({
      success: true,
      researchCard,
      enrichmentSource,
      trust: {
        metadata: trustMetadata,
        compositeScore: compositeTrust ? compositeTrust.score : null,
        grade: compositeTrust ? compositeTrust.grade : null,
      },
    });
  } catch (error) {
    logger.error('Company enrichment error:', { error: error });
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}

/* ── Extract enrichment data from API intelligence objects ── */
function extractEnrichmentFromAPI(objects: any[]): Record<string, any> {
  const result: Record<string, any> = {
    businessOverview: '',
    revenue: 'Unknown',
    employeeCount: 'Unknown',
    fundingStage: 'Unknown',
    techStack: '',
    socialProfiles: '{}',
  };

  for (const obj of objects) {
    const type = obj.metadata?.enrichmentType;
    const content = obj.content || '';

    if (type === 'company_profile') {
      // Parse profile content
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('Description: ')) result.businessOverview = line.replace('Description: ', '');
        if (line.startsWith('Type: ')) result.fundingStage = mapTypeToFunding(line.replace('Type: ', ''));
      }
    } else if (type === 'tech_stack') {
      result.techStack = content.replace('Technologies: ', '').replace('Technology Categories: ', '');
    } else if (type === 'financial_intelligence') {
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('Employee Range: ')) result.employeeCount = line.replace('Employee Range: ', '');
        if (line.startsWith('Employees: ')) result.employeeCount = line.replace('Employees: ', '');
        if (line.startsWith('Revenue Range: ')) result.revenue = line.replace('Revenue Range: ', '');
      }
    }
  }

  return result;
}

function mapTypeToFunding(type: string): string {
  const mapping: Record<string, string> = {
    'public': 'Public',
    'private': 'Private',
    'non_profit': 'Non-Profit',
    'government': 'Government',
    'education': 'Education',
  };
  return mapping[type.toLowerCase()] || type || 'Unknown';
}

/* ── AI-powered enrichment (FALLBACK ONLY — labeled as estimated) ── */
async function aiEnrichCompany(
  companyId: string,
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
    const result = await governedAICall({
      generationType: 'enrichment',
      companyId,
      enforceGovernance: false,
      systemPrompt: 'You are a business intelligence assistant. Return valid JSON only, no markdown, no code fences.',
      userPrompt: prompt,
      tier: 'smart',
      maxTokens: 4096,
      temperature: 0.3,
    });
    const response = result.success ? result.response ?? '' : '';

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
    logger.error('AI enrichment failed, using defaults:', { error: err });
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