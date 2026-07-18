import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { researchCompany, callLLM, webSearch, type CompanyResearch } from '@/lib/zai-helpers';

/* ═══════════════════════════════════════════════════
   PDF Report Generation with Real-Time AI Intelligence
   
   Generates company intelligence PDFs using:
   - Real-time web search (Z.AI)
   - AI analysis (Z.AI LLM)
   - Company CRM data + research card
   - Knowledge base capabilities
   
   POST /api/ai/generate-pdf
   Body: { companyId, type: 'account_brief' | 'stakeholder_map' | 'outreach_playbook' }
   ═══════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, type = 'account_brief' } = body as { companyId?: string; type?: string };

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    // Fetch company with all related data
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        researchCard: true,
        contacts: {
          where: { status: { not: 'archived' } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        notes: { orderBy: { createdAt: 'desc' }, take: 5 },
        signals: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Fetch knowledge base capabilities for context
    let capabilities: Array<{ title: string; summary: string; category: string; content?: string }> = [];
    try {
      const baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const kbResponse = await fetch(`${baseUrl}/api/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${company.industry || ''} ${company.rawName || ''}`,
          industry: company.industry || undefined,
          searchMode: 'hybrid',
          limit: 5,
          includeContent: true,
        }),
      });
      const kbData = await kbResponse.json();
      capabilities = kbData.results || [];
    } catch { /* non-critical */ }

    // Get real-time company research (web search + LLM)
    console.log(`[generate-pdf] Generating ${type} for: ${company.rawName}`);
    let research: CompanyResearch | null = null;
    try {
      research = await researchCompany(
        company.rawName || company.normalizedName,
        company.domain,
        company.industry,
      );
    } catch (err) {
      console.warn('[generate-pdf] Research failed, using cached data:', err);
    }

    // Use research or fall back to cached research card
    const overview = research?.businessOverview || company.researchCard?.businessOverview || 'No overview available';
    const revenue = research?.revenue || company.researchCard?.revenue || 'Unknown';
    const employees = research?.employeeCount || company.researchCard?.employeeCount || 'Unknown';
    const funding = research?.fundingStage || company.researchCard?.fundingStage || 'Unknown';
    const techStack = research?.techStack || company.researchCard?.techStack || '';
    const keyPeople = research?.keyPeople?.length ? research.keyPeople :
      (company.researchCard?.keyPeople ? JSON.parse(String(company.researchCard.keyPeople)) : []);
    const recentNews = research?.recentNews?.length ? research.recentNews :
      (company.researchCard?.recentNews ? JSON.parse(String(company.researchCard.recentNews)) : []);
    const socialProfiles = research?.socialProfiles || 
      (company.researchCard?.socialProfiles ? JSON.parse(String(company.researchCard.socialProfiles)) : {});

    // Generate the PDF content using AI
    let pdfContent: string;

    if (type === 'account_brief') {
      pdfContent = await generateAccountBrief({
        companyName: company.rawName,
        domain: company.domain,
        industry: company.industry,
        country: company.country,
        location: company.location,
        overview,
        revenue,
        employees,
        funding,
        techStack,
        keyPeople,
        recentNews,
        socialProfiles,
        contacts: company.contacts,
        signals: company.signals,
        notes: company.notes,
        capabilities,
        website: company.website || (company.domain ? `https://${company.domain}` : ''),
      });
    } else if (type === 'stakeholder_map') {
      pdfContent = await generateStakeholderMap({
        companyName: company.rawName,
        industry: company.industry,
        keyPeople,
        contacts: company.contacts,
        overview,
      });
    } else if (type === 'outreach_playbook') {
      pdfContent = await generateOutreachPlaybook({
        companyName: company.rawName,
        domain: company.domain,
        industry: company.industry,
        overview,
        revenue,
        employees,
        techStack,
        keyPeople,
        recentNews,
        contacts: company.contacts,
        capabilities,
        signals: company.signals,
      });
    } else {
      pdfContent = await generateAccountBrief({
        companyName: company.rawName,
        domain: company.domain,
        industry: company.industry,
        country: company.country,
        location: company.location,
        overview,
        revenue,
        employees,
        funding,
        techStack,
        keyPeople,
        recentNews,
        socialProfiles,
        contacts: company.contacts,
        signals: company.signals,
        notes: company.notes,
        capabilities,
        website: company.website || (company.domain ? `https://${company.domain}` : ''),
      });
    }

    return NextResponse.json({
      success: true,
      type,
      companyId: company.id,
      companyName: company.rawName,
      content: pdfContent,
      generatedAt: new Date().toISOString(),
      researchConfidence: research?.confidence || 0,
    });
  } catch (error) {
    console.error('[generate-pdf] Error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}

/* ── Account Intelligence Brief ── */
async function generateAccountBrief(data: {
  companyName: string; domain: string | null; industry: string | null;
  country: string | null; location: string | null; overview: string;
  revenue: string; employees: string; funding: string; techStack: string;
  keyPeople: Array<{ name: string; title: string; linkedInUrl?: string }>;
  recentNews: Array<{ title: string; snippet: string; signalType: string; impact: string }>;
  socialProfiles: Record<string, string>;
  contacts: Array<{ rawName: string; title: string; email: string; role: string }>;
  signals: Array<{ signalType: string; title: string; description: string }>;
  notes: Array<{ content: string; createdAt: Date }>;
  capabilities: Array<{ title: string; summary: string; category: string }>;
  website: string;
}): Promise<string> {
  const systemPrompt = `You are a senior business intelligence analyst creating an Account Intelligence Brief for a sales team. Generate a comprehensive, professionally formatted brief using markdown.

The brief should be data-driven, specific, and actionable. Use real data from the intelligence provided.
Format with clear sections, bullet points, and emphasis on actionable insights.`;

  const userPrompt = `Generate an Account Intelligence Brief for:

## Company Profile
- **Name:** ${data.companyName}
- **Domain:** ${data.domain || 'Unknown'}
- **Industry:** ${data.industry || 'Unknown'}
- **Country:** ${data.country || 'Unknown'}
- **Location:** ${data.location || 'Unknown'}
- **Website:** ${data.website || 'Unknown'}
- **Revenue:** ${data.revenue}
- **Employees:** ${data.employees}
- **Funding Stage:** ${data.funding}
- **Tech Stack:** ${data.techStack || 'Not identified'}

## Business Overview
${data.overview}

## Key People (${data.keyPeople.length} found)
${data.keyPeople.map(p => `- **${p.name}** — ${p.title}${p.linkedInUrl ? ` (${p.linkedInUrl})` : ''}`).join('\n') || 'No key people identified'}

## Recent News & Signals (${data.recentNews.length} found)
${data.recentNews.slice(0, 5).map(n => `- **[${n.signalType?.toUpperCase()}] ${n.title}** — ${n.snippet}`).join('\n') || 'No recent news found'}

## Existing Contacts in CRM (${data.contacts.length})
${data.contacts.slice(0, 10).map(c => `- **${c.rawName}** — ${c.title || 'No title'} — ${c.email || 'No email'} (${c.role || 'unknown role'})`).join('\n') || 'No contacts in CRM'}

## Buying Signals (${data.signals.length})
${data.signals.slice(0, 5).map(s => `- **${s.signalType}:** ${s.title} — ${s.description}`).join('\n') || 'No signals detected'}

## Internal Notes (${data.notes.length})
${data.notes.slice(0, 3).map(n => `- ${n.content}`).join('\n') || 'No internal notes'}

## Our Relevant Capabilities
${data.capabilities.slice(0, 5).map(c => `- **[${c.category}] ${c.title}:** ${c.summary}`).join('\n') || 'No capabilities mapped'}

Generate the brief now. Use markdown formatting with headers, bullet points, and bold text. Include:
1. Executive Summary (2-3 sentences)
2. Company Profile (all data above)
3. Business Overview
4. Key Decision Makers
5. Recent Developments & Buying Signals
6. Recommended Approach (based on their industry, needs, and our capabilities)
7. Risk Factors & Objections to Prepare For`;

  return await callLLM(systemPrompt, userPrompt);
}

/* ── Stakeholder Map ── */
async function generateStakeholderMap(data: {
  companyName: string; industry: string | null; overview: string;
  keyPeople: Array<{ name: string; title: string; department?: string; linkedInUrl?: string }>;
  contacts: Array<{ rawName: string; title: string; email: string; role: string }>;
}): Promise<string> {
  const systemPrompt = `You are an organizational intelligence analyst. Create a Stakeholder Map showing the key people at a target company. Organize by department/role hierarchy. Use markdown with clear structure.`;

  const userPrompt = `Create a Stakeholder Map for ${data.companyName}:

## Company Context
- **Industry:** ${data.industry || 'Unknown'}
- **Overview:** ${data.overview}

## Identified Key People (from web research)
${data.keyPeople.map(p => `- ${p.name} — ${p.title}${p.department ? ` (${p.department})` : ''}${p.linkedInUrl ? ` — ${p.linkedInUrl}` : ''}`).join('\n') || 'No key people found via web search'}

## Existing CRM Contacts
${data.contacts.map(c => `- ${c.rawName} — ${c.title || 'Unknown'} — ${c.email || 'No email'} — Role: ${c.role || 'unknown'}`).join('\n') || 'No CRM contacts'}

Generate a stakeholder map organized by:
1. C-Suite (CEO, CTO, CIO, CFO, COO, etc.)
2. VP Level
3. Director Level
4. Other Key Contacts

For each person, indicate:
- Influence level (High/Medium/Low)
- Relevance to outreach (Primary/Secondary/Tertiary)
- Recommended approach angle
- Any gaps (roles we should target but haven't identified)`;

  return await callLLM(systemPrompt, userPrompt);
}

/* ── Outreach Playbook ── */
async function generateOutreachPlaybook(data: {
  companyName: string; domain: string | null; industry: string | null;
  overview: string; revenue: string; employees: string; techStack: string;
  keyPeople: Array<{ name: string; title: string }>;
  recentNews: Array<{ title: string; snippet: string; signalType: string }>;
  contacts: Array<{ rawName: string; title: string; email: string; role: string }>;
  capabilities: Array<{ title: string; summary: string; category: string }>;
  signals: Array<{ signalType: string; title: string; description: string }>;
}): Promise<string> {
  const systemPrompt = `You are a senior sales strategist creating a company-specific Outreach Playbook. This playbook should give a sales rep everything they need to approach this company effectively. Be specific, data-driven, and actionable.`;

  const userPrompt = `Create an Outreach Playbook for ${data.companyName}:

## Target Company
- **Industry:** ${data.industry || 'Unknown'}
- **Revenue:** ${data.revenue}
- **Employees:** ${data.employees}
- **Tech Stack:** ${data.techStack || 'Not identified'}
- **Overview:** ${data.overview}

## Key People
${data.keyPeople.map(p => `- ${p.name} — ${p.title}`).join('\n') || 'Not identified'}

## Recent Signals
${data.recentNews.slice(0, 5).map(n => `- [${n.signalType}] ${n.title}: ${n.snippet}`).join('\n') || 'No signals'}

## CRM Contacts
${data.contacts.slice(0, 5).map(c => `- ${c.rawName} — ${c.title} — ${c.email}`).join('\n') || 'No contacts'}

## Our Capabilities
${data.capabilities.slice(0, 5).map(c => `- [${c.category}] ${c.title}: ${c.summary}`).join('\n') || 'No capabilities'}

## Buying Signals
${data.signals.slice(0, 5).map(s => `- ${s.signalType}: ${s.description}`).join('\n') || 'No signals'}

Generate the playbook with these sections:
1. **Target Profile Summary** (2-3 sentences on why this company is a good fit)
2. **Best Entry Points** (who to contact first and why, based on signals and org structure)
3. **Opening Angles** (3 specific, personalized opening lines for different stakeholders)
4. **Value Proposition Alignment** (which of our capabilities match their needs, with evidence)
5. **Objection Handling** (3-5 likely objections and how to address them)
6. **Timing & Triggers** (best time to reach out based on recent signals)
7. **Multi-Threading Strategy** (how to approach multiple stakeholders in parallel)
8. **Success Metrics** (what a successful engagement looks like for this account)`;

  return await callLLM(systemPrompt, userPrompt);
}