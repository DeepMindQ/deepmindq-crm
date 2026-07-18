import { NextRequest, NextResponse } from 'next/server';
import { webSearch, callLLM, extractJSON, tavilyAIAnswer } from '@/lib/zai-helpers';
import { db } from '@/lib/db';
import { getResearchContext, type ResearchContext } from '@/lib/intelligence-contract';
import { runGovernanceChecks, recordGeneration, HALLUCINATION_PREVENTION_RULES } from '@/lib/ai-governance';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapSectionToField(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('financial') || t.includes('revenue') || t.includes('funding')) return 'revenue';
  if (t.includes('technology') || t.includes('tech stack') || t.includes('product')) return 'techStack';
  if (t.includes('leadership') || t.includes('executive') || t.includes('management') || t.includes('people')) return 'keyPeople';
  if (t.includes('overview') || t.includes('company') || t.includes('business')) return 'businessOverview';
  if (t.includes('news') || t.includes('recent') || t.includes('signal')) return 'recentNews';
  if (t.includes('competitive') || t.includes('market') || t.includes('position')) return 'businessOverview';
  return 'businessOverview';
}

// POST /api/research-agent — Deep research on company or person
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, type, companyId } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const isCompany = type === 'company';

    // ── Intelligence-contract: freshness check (only for company with companyId) ──
    let researchContext: ResearchContext | null = null;
    let freshnessWarning: string | null = null;

    if (companyId && isCompany) {
      try {
        researchContext = await getResearchContext(companyId);
        const { freshness } = researchContext;

        if (freshness.status === 'fresh' || freshness.status === 'aging') {
          const daysAgo = freshness.daysSinceResearch ?? 0;
          freshnessWarning = `Recent research exists (last researched ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago). Consider refreshing via the Research Engine instead. Proceeding with deep research...`;
        }
      } catch (ctxErr) {
        // Non-blocking — if we can't load context, just proceed without it
        console.warn('[research-agent] Could not load research context for freshness check:', ctxErr instanceof Error ? ctxErr.message : ctxErr);
      }
    }

    // Step 1: Web search (always works — Tavily)
    const searchResults = await webSearch(query, 10);
    const searchContext = searchResults
      .map((r) => `[${r.title}] ${r.snippet} (Source: ${r.url})`)
      .join('\n');

    if (searchResults.length === 0) {
      return NextResponse.json(
        { error: 'No search results found. Try a more specific query.' },
        { status: 404 }
      );
    }

    // Step 2: Try full LLM-based research (best quality)
    let aiResult: string | null = null;
    try {
      const systemContext = isCompany
        ? `You are a senior business intelligence analyst at a top-tier strategy firm. Your research reports are used by sales teams to prepare for high-value B2B outreach. You write with specificity, citing exact figures, dates, names, and sources. You never use vague filler like "the company has demonstrated consistent growth" — instead you say "Revenue grew 34% YoY to $180M in FY2024 per their Q4 earnings filing." If you cannot find specific data, explicitly say "Not publicly available" rather than guessing.

${HALLUCINATION_PREVENTION_RULES}`
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

      aiResult = await callLLM(
        `You have access to the following web search results for context:\n\n${searchContext}\n\nUse this context to provide specific, verifiable information. If the search results don't contain enough detail, say so explicitly.`,
        prompt,
      );
    } catch (llmErr) {
      console.warn('[research-agent] LLM failed, using Tavily AI fallback:', llmErr instanceof Error ? llmErr.message : llmErr);
    }

    // Step 3: If LLM failed, use Tavily AI answer as fallback
    if (!aiResult) {
      try {
        const tavilyAnswer = await tavilyAIAnswer(
          isCompany
            ? `Provide a detailed business intelligence report on ${query}. Include: overview, revenue, employees, leadership, recent news, technology stack, and competitive position.`
            : `Provide a detailed professional profile of ${query}. Include: current role, career history, education, accomplishments, and recent activity.`
        );

        if (tavilyAnswer) {
          // Wrap Tavily's answer into the expected JSON structure
          const sections = searchResults.slice(0, 5).map((r) => {
            let domain = '';
            try { domain = new URL(r.url).hostname; } catch { /* ignore */ }
            return {
              title: r.title,
              icon: 'FileText' as const,
              content: r.snippet,
              sources: [{ title: r.title, url: r.url, domain }],
            };
          });

          // Extract key insights from search result titles/snippets
          const insights = searchResults
            .slice(0, 5)
            .map((r) => r.snippet || r.title)
            .filter(Boolean);

          // ── Record generation audit for fallback ──
          if (companyId) {
            const governanceResult = researchContext
              ? await runGovernanceChecks({
                  companyId,
                  generationType: 'research_agent',
                  researchContext,
                })
              : { passed: true, checks: {}, overallMessage: 'No research context available — audit only.', canProceed: true, rejectionReason: null };

            await recordGeneration({
              generationType: 'research_agent',
              companyId,
              researchContext,
              governanceResult,
              outputSummary: tavilyAnswer?.substring(0, 500),
              inputParams: { query, type, _fallback: 'tavily_ai' },
            });
          }

          return NextResponse.json({
            query,
            type,
            companyId: companyId || undefined,
            generatedAt: new Date().toLocaleString(),
            executiveSummary: tavilyAnswer,
            keyInsights: insights,
            riskFactors: [],
            opportunitySignals: insights.slice(0, 3),
            sections,
            _fallback: 'tavily_ai',
            ...(freshnessWarning ? { _freshnessWarning: freshnessWarning } : {}),
          });
        }
      } catch (tavilyErr) {
        console.warn('[research-agent] Tavily AI fallback also failed:', tavilyErr);
      }

      // Step 4: Last resort — return raw search results structured
      const sections = searchResults.slice(0, 6).map((r) => {
        let domain = '';
        try { domain = new URL(r.url).hostname; } catch { /* ignore */ }
        return {
          title: r.title,
          icon: 'FileText' as const,
          content: r.snippet,
          sources: [{ title: r.title, url: r.url, domain }],
        };
      });

      // ── Record generation audit for raw search fallback ──
      if (companyId) {
        const governanceResult = researchContext
          ? await runGovernanceChecks({
              companyId,
              generationType: 'research_agent',
              researchContext,
            })
          : { passed: true, checks: {}, overallMessage: 'No research context available — audit only.', canProceed: true, rejectionReason: null };

        await recordGeneration({
          generationType: 'research_agent',
          companyId,
          researchContext,
          governanceResult,
          outputSummary: `Raw search fallback: ${searchResults.length} results`,
          inputParams: { query, type, _fallback: 'raw_search' },
        });
      }

      return NextResponse.json({
        query,
        type,
        companyId: companyId || undefined,
        generatedAt: new Date().toLocaleString(),
        executiveSummary: `Research results for "${query}" based on ${searchResults.length} web sources. Note: AI analysis is currently unavailable — configure NVIDIA_API_KEY or FIREWORKS_API_KEY in Vercel env vars.`,
        keyInsights: searchResults.slice(0, 5).map((r) => r.snippet || r.title).filter(Boolean),
        riskFactors: [],
        opportunitySignals: [],
        sections,
        _fallback: 'raw_search',
        ...(freshnessWarning ? { _freshnessWarning: freshnessWarning } : {}),
      });
    }

    // Parse the LLM response
    const parsed = extractJSON(aiResult) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== 'object') {
      // LLM returned non-JSON — return raw text as summary

      // ── Record generation audit for raw text fallback ──
      if (companyId) {
        const governanceResult = researchContext
          ? await runGovernanceChecks({
              companyId,
              generationType: 'research_agent',
              researchContext,
            })
          : { passed: true, checks: {}, overallMessage: 'No research context available — audit only.', canProceed: true, rejectionReason: null };

        await recordGeneration({
          generationType: 'research_agent',
          companyId,
          researchContext,
          governanceResult,
          outputSummary: aiResult?.substring(0, 500),
          inputParams: { query, type, _fallback: 'llm_raw_text' },
        });
      }

      return NextResponse.json({
        query,
        type,
        companyId: companyId || undefined,
        generatedAt: new Date().toLocaleString(),
        executiveSummary: aiResult,
        keyInsights: searchResults.slice(0, 5).map((r) => r.snippet || r.title).filter(Boolean),
        riskFactors: [],
        opportunitySignals: [],
        sections: searchResults.slice(0, 4).map((r) => ({
          title: r.title,
          icon: 'FileText' as const,
          content: r.snippet,
          sources: [{ title: r.title, url: r.url, domain: (() => { try { return new URL(r.url).hostname; } catch { return ''; } })() }],
        })),
        _fallback: 'llm_raw_text',
        ...(freshnessWarning ? { _freshnessWarning: freshnessWarning } : {}),
      });
    }

    const sections = Array.isArray(parsed.sections)
      ? parsed.sections.map((s: any) => ({
          title: s.title || 'Research Section',
          icon: s.icon || 'FileText',
          content: s.content || 'No content available.',
          sources: Array.isArray(s.sources) ? s.sources : [],
        }))
      : [];

    // ── Evidence Storage: store each section's sources as Evidence records ──
    if (companyId && isCompany && parsed.sections) {
      try {
        const sectionList = Array.isArray(parsed.sections) ? parsed.sections : [];
        for (const section of sectionList) {
          const sectionSources = Array.isArray(section.sources) ? section.sources : [];
          if (sectionSources.length > 0) {
            for (const source of sectionSources) {
              await db.evidence.create({
                data: {
                  companyId,
                  searchQuery: query,
                  sourceUrl: source.url || '',
                  sourceTitle: source.title || section.title,
                  sourceName: source.domain || '',
                  snippet: section.content?.substring(0, 500) || '',
                  extractedField: mapSectionToField(section.title),
                  extractedValue: section.content?.substring(0, 200) || null,
                  relevanceScore: 0.7,
                  confidence: 0.6,  // research-agent outputs are user-triggered, moderate confidence
                  sourceQualityTier: 'standard',
                }
              });
            }
          }
        }
      } catch (evidenceErr) {
        // Non-blocking — evidence storage failure should not break the response
        console.error('[research-agent] Evidence storage failed:', evidenceErr instanceof Error ? evidenceErr.message : evidenceErr);
      }
    }

    // ── Store executive summary as CompanyNote ──
    if (companyId && isCompany && parsed.executiveSummary) {
      try {
        const insightsList = Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [];
        await db.companyNote.create({
          data: {
            companyId,
            title: `Deep Research: ${query}`,
            category: 'research',
            body: `## Research Agent Output\n\n${parsed.executiveSummary}\n\n${insightsList.map((i: string) => `- ${i}`).join('\n') || ''}`,
            author: 'research-agent',
          }
        });
      } catch (noteErr) {
        // Non-blocking — note storage failure should not break the response
        console.error('[research-agent] CompanyNote storage failed:', noteErr instanceof Error ? noteErr.message : noteErr);
      }
    }

    // ── Record generation audit for successful LLM result ──
    if (companyId) {
      const governanceResult = researchContext
        ? await runGovernanceChecks({
            companyId,
            generationType: 'research_agent',
            researchContext,
          })
        : { passed: true, checks: {}, overallMessage: 'No research context available — audit only.', canProceed: true, rejectionReason: null };

      await recordGeneration({
        generationType: 'research_agent',
        companyId,
        researchContext,
        governanceResult,
        outputSummary: (parsed.executiveSummary as string)?.substring(0, 500),
        inputParams: { query, type },
      });
    }

    return NextResponse.json({
      query,
      type,
      companyId: companyId || undefined,
      generatedAt: new Date().toLocaleString(),
      executiveSummary: parsed.executiveSummary || `Research analysis for "${query}".`,
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      opportunitySignals: Array.isArray(parsed.opportunitySignals) ? parsed.opportunitySignals : [],
      sections,
      ...(freshnessWarning ? { _freshnessWarning: freshnessWarning } : {}),
    });
  } catch (error) {
    console.error('Research agent error:', error);
    return NextResponse.json(
      { error: 'Research failed unexpectedly' },
      { status: 500 }
    );
  }
}