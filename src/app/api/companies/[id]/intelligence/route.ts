// @ts-nocheck
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface AiInsights {
  businessOverview: string;
  keyDevelopments: string[];
  potentialChallenges: string[];
  outreachAngle: string;
  techStack: string[];
  competitors: string[];
  webFindings: Array<{ title: string; url: string; snippet: string }>;
}

/* ═══════════════════════════════════════════════════════════════
   Z-AI SDK helpers
   ═══════════════════════════════════════════════════════════════ */

async function webSearch(query: string, num = 5) {
  try {
    const { ensureZaiConfig } = await import('@/lib/zai-config');
    await ensureZaiConfig();
    const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create());
    const results = await Z.functions.invoke('web_search', { query, num });
    return (results || []).slice(0, num).map((r: any) => ({
      title: r.name || '',
      url: r.url || '',
      snippet: r.snippet || '',
    }));
  } catch (e) {
    console.error('[intelligence] Web search failed:', e);
    return [];
  }
}

async function aiChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create());
  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content ?? '';
}

/**
 * Parse the LLM text response into the AiInsights shape.
 */
function parseAiResponse(raw: string): AiInsights | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      businessOverview: String(parsed.businessOverview ?? ''),
      keyDevelopments: Array.isArray(parsed.keyDevelopments) ? parsed.keyDevelopments.map(String) : [],
      potentialChallenges: Array.isArray(parsed.potentialChallenges) ? parsed.potentialChallenges.map(String) : [],
      outreachAngle: String(parsed.outreachAngle ?? ''),
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack.map(String) : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map(String) : [],
      webFindings: Array.isArray(parsed.webFindings) ? parsed.webFindings : [],
    };
  } catch {
    // Regex fallback
  }

  const insights: AiInsights = {
    businessOverview: '', keyDevelopments: [], potentialChallenges: [],
    outreachAngle: '', techStack: [], competitors: [], webFindings: [],
  };

  const boMatch = cleaned.match(/"businessOverview"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (boMatch) insights.businessOverview = boMatch[1].replace(/\\"/g, '"');

  const oaMatch = cleaned.match(/"outreachAngle"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (oaMatch) insights.outreachAngle = oaMatch[1].replace(/\\"/g, '"');

  const extractArr = (key: string, target: string[]) => {
    const re = new RegExp('"' + key + '"\\s*:\\s*\\[([^\\]]*)\\]', 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      const items = m[1].match(/"((?:[^"\\]|\\.)*)"/g);
      if (items) target.push(...items.map(s => s.replace(/"/g, '').replace(/\\"/g, '"')));
    }
  };

  extractArr('keyDevelopments', insights.keyDevelopments);
  extractArr('potentialChallenges', insights.potentialChallenges);
  extractArr('techStack', insights.techStack);
  extractArr('competitors', insights.competitors);

  return insights.businessOverview ? insights : null;
}

/**
 * Full pipeline: web search → AI analysis with live context
 */
async function generateIntelligence(
  companyName: string,
  industry: string | null,
  domain: string | null,
  location: string | null,
  country: string | null,
  sizeRange: string | null,
  existingResearch: string,
  signalSummaries: string,
  contactSummaries: string,
): Promise<AiInsights | null> {
  try {
    // Step 1: Search the web for real-time company data
    const searchQueries = [
      `${companyName} ${industry || ''} company overview recent news`,
      `${companyName || ''} ${domain || ''} technology stack`,
      `${companyName || ''} competitors ${industry || ''}`,
    ];

    const searchResults = await Promise.all(
      searchQueries.map(q => webSearch(q, 5)),
    );

    // Flatten and deduplicate
    const allResults = searchResults.flat();
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // Step 2: Build context from web results
    const webContext = uniqueResults
      .slice(0, 10)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`)
      .join('\n\n');

    // Step 3: AI analysis using web data + DB data
    const userPrompt = `Analyze this company using BOTH the web search results and the CRM data below.

── CRM DATA ──
Company Name: ${companyName}
Industry: ${industry || 'Unknown'}
Domain: ${domain || 'Unknown'}
Location: ${location || 'Unknown'}, ${country || 'Unknown'}
Size: ${sizeRange || 'Unknown'}

Existing Research:
${existingResearch}

Recent Signals:
${signalSummaries || 'No recent signals.'}

Top Contacts:
${contactSummaries || 'No contacts.'}

── LIVE WEB RESULTS ──
${webContext || 'No web results found.'}

── TASK ──
Generate actionable B2B sales intelligence. Use the web results for REAL, CURRENT information about this company's developments, tech, and competitive landscape. If web results mention specific news, funding, product launches, or leadership changes, include them in keyDevelopments.

Respond ONLY with valid JSON:
{
  "businessOverview": "2-3 sentence overview based on web + CRM data",
  "keyDevelopments": ["recent development 1 from web", "development 2", "development 3", "development 4", "development 5"],
  "potentialChallenges": ["challenge 1", "challenge 2", "challenge 3"],
  "outreachAngle": "Best B2B outreach angle based on their current situation (1-2 sentences)",
  "techStack": ["technology 1", "technology 2", "technology 3", "technology 4"],
  "competitors": ["competitor 1", "competitor 2", "competitor 3", "competitor 4", "competitor 5"]
}

Be specific. Reference real information from web results when available.`;

    const systemPrompt =
      'You are a B2B sales intelligence analyst. Analyze company data combined with live web search results. Generate actionable, specific, data-driven insights. Always respond with valid JSON only.';

    const raw = await aiChat(systemPrompt, userPrompt);
    const insights = parseAiResponse(raw);

    if (insights) {
      insights.webFindings = uniqueResults.slice(0, 10);
    }

    return insights;
  } catch (e) {
    console.error('[intelligence] AI generation failed:', e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/companies/[id]/intelligence
   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    // 1. Fetch the company
    const company = await db.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 2. Fetch related data in parallel
    const [researchCard, contacts, signals, notes, timeline] = await Promise.all([
      db.companyResearchCard.findUnique({ where: { companyId } }),
      db.contact.findMany({
        where: { companyId },
        take: 5,
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
    ]);

    // 3. AI Intelligence via z-ai-web-dev-sdk (web search + LLM)
    const signalSummaries = signals
      .map((s) => `[${s.signalType}] ${s.title}${s.description ? ': ' + s.description : ''}`)
      .join('\n');

    const existingResearch = researchCard
      ? [
          researchCard.businessOverview && `Business Overview: ${researchCard.businessOverview}`,
          researchCard.techLandscape && `Tech Landscape: ${researchCard.techLandscape}`,
          researchCard.potentialChallenges && `Challenges: ${researchCard.potentialChallenges}`,
          researchCard.techStack && `Known Tech: ${researchCard.techStack}`,
        ]
          .filter(Boolean)
          .join('\n')
      : 'No existing research card.';

    const contactSummaries = contacts
      .map((c) => `${c.rawName} — ${c.title || c.role || 'Unknown role'} (score: ${c.leadScore})`)
      .join('\n');

    const aiInsights = await generateIntelligence(
      company.rawName,
      company.industry,
      company.domain,
      company.location,
      company.country,
      company.sizeRange,
      existingResearch,
      signalSummaries,
      contactSummaries,
    );

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
      contacts,
      signals,
      notes,
      timeline,
      aiInsights,
    });
  } catch (error) {
    console.error('[intelligence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate company intelligence' },
      { status: 500 },
    );
  }
}