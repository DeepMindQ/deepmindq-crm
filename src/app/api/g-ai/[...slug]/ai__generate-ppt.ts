import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { researchCompany, callLLM, webSearch, getZAI, type CompanyResearch } from '@/lib/zai-helpers';

/* ═══════════════════════════════════════════════════
   PPT/Slide Generation via Z.AI SDK
   
   Uses Z.AI's built-in PPT generation to create
   professional presentation files for companies.
   
   POST /api/ai/generate-ppt
   Body: { 
     companyId, 
     type: 'account_brief' | 'capability_pitch' | 'custom',
     customPrompt?  // only for type='custom'
   }
   ═══════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, type = 'account_brief', customPrompt } = body as { 
      companyId?: string; 
      type?: string; 
      customPrompt?: string;
    };

    if (!companyId && type !== 'custom') {
      return NextResponse.json({ error: 'companyId is required (unless type=custom)' }, { status: 400 });
    }

    // Fetch company data if companyId provided
    let company: any = null;
    let research: CompanyResearch | null = null;

    if (companyId) {
      company = await db.company.findUnique({
        where: { id: companyId },
        include: {
          researchCard: true,
          contacts: {
            where: { status: { not: 'archived' } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!company) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
    }

    // Get real-time research for the company
    if (company) {
      try {
        research = await researchCompany(
          company.rawName || company.normalizedName,
          company.domain,
          company.industry,
        );
      } catch (err) {
        console.warn('[generate-ppt] Research failed, using cached:', err);
      }
    }

    // Build the PPT generation prompt based on type
    let pptPrompt: string;

    if (type === 'account_brief' && company) {
      pptPrompt = buildAccountBriefPrompt(company, research);
    } else if (type === 'capability_pitch' && company) {
      pptPrompt = await buildCapabilityPitchPrompt(company, research);
    } else if (type === 'custom' && customPrompt) {
      pptPrompt = customPrompt;
    } else {
      return NextResponse.json({ error: 'Invalid type or missing customPrompt' }, { status: 400 });
    }

    // Generate PPT using Z.AI SDK
    console.log(`[generate-ppt] Generating ${type} PPT for: ${company?.rawName || 'custom'}`);

    try {
      const zai = await getZAI();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (zai as any).functions.invoke('ppt_generation', {
        prompt: pptPrompt,
      });

      // Return the result — could be a URL, base64, or file reference
      return NextResponse.json({
        success: true,
        type,
        companyId: company?.id || null,
        companyName: company?.rawName || 'Custom',
        result,
        generatedAt: new Date().toISOString(),
        researchConfidence: research?.confidence || 0,
      });
    } catch (sdkErr: any) {
      console.error('[generate-ppt] Z.AI PPT generation failed:', sdkErr?.message);
      
      // Fallback: Generate markdown-based PPT content via LLM
      // This ensures we always return something useful
      console.log('[generate-ppt] Falling back to LLM-based slide content');
      const fallbackContent = await callLLM(
        'You are a presentation designer. Create a professional slide deck outline in markdown format. Each slide should be separated by ---. Include slide titles, bullet points, and speaker notes.',
        pptPrompt,
      );

      return NextResponse.json({
        success: true,
        type,
        companyId: company?.id || null,
        companyName: company?.rawName || 'Custom',
        content: fallbackContent,
        fallback: true,
        message: 'Generated as markdown content. Z.AI PPT service may be temporarily unavailable.',
        generatedAt: new Date().toISOString(),
        researchConfidence: research?.confidence || 0,
      });
    }
  } catch (error) {
    console.error('[generate-ppt] Error:', error);
    return NextResponse.json({ error: 'PPT generation failed' }, { status: 500 });
  }
}

/* ── Build Account Brief PPT Prompt ── */
function buildAccountBriefPrompt(
  company: any,
  research: CompanyResearch | null,
): string {
  const overview = research?.businessOverview || company.researchCard?.businessOverview || '';
  const revenue = research?.revenue || company.researchCard?.revenue || 'Unknown';
  const employees = research?.employeeCount || company.researchCard?.employeeCount || 'Unknown';
  const funding = research?.fundingStage || company.researchCard?.fundingStage || 'Unknown';
  const techStack = research?.techStack || company.researchCard?.techStack || '';
  const keyPeople = research?.keyPeople?.length ? research.keyPeople :
    (company.researchCard?.keyPeople ? JSON.parse(String(company.researchCard.keyPeople)) : []);
  const recentNews = research?.recentNews?.length ? research.recentNews :
    (company.researchCard?.recentNews ? JSON.parse(String(company.researchCard.recentNews)) : []);

  return `Create a professional 8-10 slide presentation: Account Intelligence Brief for ${company.rawName}

Slide 1 (Title): "${company.rawName} — Account Intelligence Brief" with subtitle "${company.industry || 'Technology'} Industry" and today's date

Slide 2 (Executive Summary): 2-3 sentence overview. ${overview}

Slide 3 (Company Profile): Revenue: ${revenue}. Employees: ${employees}. Funding: ${funding}. Industry: ${company.industry || 'Unknown'}. Website: ${company.website || company.domain || 'Unknown'}.

Slide 4 (Technology & Digital Footprint): Tech stack: ${techStack || 'Not identified'}. Social profiles: ${research?.socialProfiles ? Object.entries(research.socialProfiles).map(([k,v]) => `${k}: ${v}`).join(', ') : 'Not found'}.

Slide 5 (Key Decision Makers): ${keyPeople.slice(0, 6).map(p => `${p.name} — ${p.title}`).join('; ') || 'Not identified'}

Slide 6 (Recent Developments): ${recentNews.slice(0, 5).map(n => `${n.title} (${n.signalType})`).join('; ') || 'No recent developments found'}

Slide 7 (CRM Intelligence): ${company.contacts?.length || 0} contacts in CRM. ${company.contacts?.slice(0, 3).map((c: any) => `${c.rawName} (${c.title || 'Unknown'})`).join(', ') || 'No contacts'}

Slide 8 (Opportunity Assessment): Based on the company data, identify 3-4 potential opportunities for DeepMindQ's services. Be specific to this company.

Slide 9 (Recommended Next Steps): 3-5 actionable next steps for the sales team.

Use professional design with data-driven content. No generic filler.`;
}

/* ── Build Capability Pitch PPT Prompt ── */
async function buildCapabilityPitchPrompt(
  company: any,
  research: CompanyResearch | null,
): Promise<string> {
  // Fetch relevant capabilities from knowledge base
  let capabilities: Array<{ title: string; summary: string; category: string }> = [];
  try {
    const baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const kbResponse = await fetch(`${baseUrl}/api/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `${company.industry || ''} ${company.rawName || ''}`,
        industry: company.industry || undefined,
        searchMode: 'hybrid',
        limit: 6,
        includeContent: true,
      }),
    });
    const kbData = await kbResponse.json();
    capabilities = kbData.results || [];
  } catch { /* non-critical */ }

  const overview = research?.businessOverview || company.researchCard?.businessOverview || '';
  const keyPeople = research?.keyPeople?.length ? research.keyPeople :
    (company.researchCard?.keyPeople ? JSON.parse(String(company.researchCard.keyPeople)) : []);

  return `Create a professional 8-10 slide presentation: Tailored Capability Pitch for ${company.rawName}

Slide 1 (Title): "DeepMindQ — Solutions for ${company.rawName}" with subtitle "Tailored Technology Services Proposal"

Slide 2 (Understanding Your Business): ${overview}. Industry: ${company.industry || 'Unknown'}. Size: ${research?.employeeCount || 'Unknown'}.

Slide 3 (Your Challenges): Based on ${company.industry || 'their'} industry, identify 3-4 specific challenges this company likely faces. Reference any recent news: ${research?.recentNews?.slice(0, 3).map(n => n.title).join('; ') || 'None found'}.

Slide 4 (Our Solution — AI & Machine Learning): ${capabilities.filter(c => c.category === 'service_line').slice(0, 2).map(c => `${c.title}: ${c.summary}`).join('. ') || 'End-to-end AI/ML solutions'}

Slide 5 (Our Solution — Cloud & Data Engineering): ${capabilities.filter(c => c.category === 'service_line').slice(2, 4).map(c => `${c.title}: ${c.summary}`).join('. ') || 'Cloud migration, data engineering, and analytics'}

Slide 6 (Proven Results): ${capabilities.filter(c => c.category === 'case_study' || c.category === 'proof_point').slice(0, 3).map(c => `${c.title}: ${c.summary}`).join('. ') || '150+ enterprise deployments across Fortune 500 companies'}

Slide 7 (Why DeepMindQ): Key differentiators — industry expertise, proven methodology, zero-breach security record, dedicated support.

Slide 8 (Implementation Approach): Proposed 3-phase approach: Discovery (Week 1-2), Implementation (Week 3-8), Optimization (Ongoing).

Slide 9 (Next Steps): Contact ${keyPeople[0]?.name || 'the relevant stakeholder'}. Schedule a 30-minute discovery call to discuss specific requirements.

Professional B2B sales pitch design. Data-driven. Company-specific.`;
}