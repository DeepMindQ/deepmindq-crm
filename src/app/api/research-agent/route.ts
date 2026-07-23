// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

// POST /api/research-agent — Deep research on company or person
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, type } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const isCompany = type === 'company';

    let aiResult: string;
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const { ensureZaiConfig } = await import('@/lib/zai-config');
      await ensureZaiConfig();
      const zai = await ZAI.create();

      // First do web search, then LLM synthesis
      const searchResult = await zai.functions.invoke('web_search', { query });
      const searchContext = Array.isArray(searchResult?.results)
        ? searchResult.results.map((r: any) => `${r.title}: ${r.snippet || r.content || ''}`).join('\n')
        : (typeof searchResult === 'string' ? searchResult : JSON.stringify(searchResult));

      const systemContext = isCompany
        ? `You are a senior business intelligence analyst at a top-tier strategy firm. Your research reports are used by sales teams to prepare for high-value B2B outreach. You write with specificity, citing exact figures, dates, names, and sources. You never use vague filler like "the company has demonstrated consistent growth" — instead you say "Revenue grew 34% YoY to $180M in FY2024 per their Q4 earnings filing." If you cannot find specific data, explicitly say "Not publicly available" rather than guessing.`
        : `You are a senior executive research analyst. Your profiles are used by account executives preparing for C-level outreach. You include specific role history with dates, board memberships, published articles or talks, educational credentials with years, and verifiable professional accomplishments. You never use vague phrases — instead of "recognized industry leader" you say "Keynote speaker at SaaStr Annual 2024, published in Harvard Business Review (March 2024)." If information is unavailable, say so explicitly.`;

      const researchDirectives = isCompany
        ? `Research and include:
1. COMPANY OVERVIEW: Full legal name, founded date, headquarters, CEO/founder name. Exact employee count from LinkedIn or recent press releases. One-sentence description of what they actually do (not marketing fluff).
2. FINANCIALS: Revenue (exact figure or best estimate with source), funding rounds (amounts, investors, dates), valuation if known, IPO status, profit/loss indicators. Cite sources.
3. TECHNOLOGY STACK: Specific tools and platforms detected from job postings, tech blogs, GitHub, or stack share. Name actual products (e.g., "runs on AWS with React/Next.js frontend, Python/Django backend, PostgreSQL").
4. LEADERSHIP TEAM: Names and titles of C-suite and VP-level executives. Include background highlights (previous companies, tenure).
5. RECENT NEWS & SIGNALS: Specific events from the last 6 months — product launches, partnerships, acquisitions, funding, leadership changes, awards. Include dates.
6. COMPETITIVE POSITION: Named competitors, differentiators, market share if available, Gartner/Forrester quadrant mentions.`
        : `Research and include:
1. PROFESSIONAL BACKGROUND: Current role with title, company, and start date. Previous 3-4 roles with companies, titles, and date ranges. Total years of experience.
2. EDUCATION: Degree(s), institution(s), year(s). Any certifications or executive education programs.
3. KEY ACCOMPLISHMENTS: Specific measurable achievements — revenue targets hit, products launched, teams built, awards won. Include numbers.
4. THOUGHT LEADERSHIP: Published articles, conference talks, podcast appearances, patent filings, board/advisory roles. Include dates and venues.
5. PROFESSIONAL NETWORK: Notable connections, co-investors, co-board members, alumni associations.
6. RECENT ACTIVITY: Posts, interviews, or moves from the last 3 months. Include dates and sources.`;

      const prompt = `${systemContext}

QUERY: "${query}"
TYPE: ${isCompany ? 'COMPANY RESEARCH' : 'PERSON RESEARCH'}

${researchDirectives}

CRITICAL RULES:
- Every claim must include a specific number, date, name, or source
- Never use phrases like "demonstrates consistent growth", "shows strong positioning", "is a recognized leader" — these are meaningless filler
- If you cannot find specific data, write "Specific data not publicly available" 
- Include 2-4 real source URLs per section where found
- Be concise but specific — aim for information density, not word count

Return a JSON object with this exact structure (no markdown fences, raw JSON only):
{
  "executiveSummary": "2-3 specific, information-dense paragraphs with exact figures and names. No filler.",
  "keyInsights": ["Specific insight 1 with data point", "Specific insight 2 with data point", "Specific insight 3", "Specific insight 4", "Specific insight 5"],
  "riskFactors": ["Specific risk 1 with reasoning", "Specific risk 2", "Specific risk 3"],
  "opportunitySignals": ["Specific opportunity 1 with evidence", "Specific opportunity 2", "Specific opportunity 3"],
  "sections": [
    {
      "title": "Section Title",
      "icon": "Building2",
      "content": "Detailed 2-3 paragraph analysis with specific data points, names, dates, and figures. High information density.",
      "sources": [{"title": "Source Title", "url": "https://real-url.com/article", "domain": "real-url.com"}]
    }
  ]
}

ICON OPTIONS for sections: "Building2" "DollarSign" "Cpu" "Users" "Newspaper" "TrendingUp" "User" "Briefcase" "Globe" "BarChart3" "Target" "FileText" "Shield"

Include 4-6 sections. Match the icon to the section topic.`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: `You have access to the following web search results for context:\n\n${searchContext}\n\nUse this context to provide specific, verifiable information. If the search results don't contain enough detail, say so explicitly.` },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
      });
      aiResult = completion.choices?.[0]?.message?.content || '';
    } catch (sdkError) {
      console.error('AI SDK error:', sdkError);
      return NextResponse.json(
        { error: 'AI research service unavailable. Please try again.' },
        { status: 503 }
      );
    }

    // Parse the AI response
    let jsonStr = aiResult;
    const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid data. Please try again.' },
        { status: 502 }
      );
    }

    const sections = (parsed.sections || []).map((s: any) => ({
      title: s.title || 'Research Section',
      icon: s.icon || 'FileText',
      content: s.content || 'No content available.',
      sources: Array.isArray(s.sources) ? s.sources : [],
    }));

    const result = {
      query,
      type,
      generatedAt: new Date().toLocaleString(),
      executiveSummary: parsed.executiveSummary || `Research analysis for "${query}". The AI service returned incomplete data — please try again.`,
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      opportunitySignals: Array.isArray(parsed.opportunitySignals) ? parsed.opportunitySignals : [],
      sections,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Research agent error:', error);
    return NextResponse.json(
      { error: 'Research failed unexpectedly' },
      { status: 500 }
    );
  }
}