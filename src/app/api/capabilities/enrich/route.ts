import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/capabilities/enrich
   C-12: Auto-enrich knowledge base from a website URL
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, serviceLine: suggestedServiceLine } = body;

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Step 1: Fetch website content
    let pageContent = '';
    let pageTitle = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'DeepMindQ-Bot/1.0 (Knowledge Enrichment)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return NextResponse.json({ error: `Failed to fetch URL: HTTP ${res.status}` }, { status: 400 });
      }

      const html = await res.text();

      // Simple HTML to text: remove scripts, styles, then extract text
      const cleanHtml = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '');

      // Extract title
      const titleMatch = cleanHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
      pageTitle = titleMatch ? titleMatch[1].trim() : url;

      // Extract text from body
      const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyText = bodyMatch ? bodyMatch[1] : cleanHtml;

      pageContent = bodyText
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      // Truncate to manageable size for AI
      if (pageContent.length > 8000) {
        pageContent = pageContent.slice(0, 8000) + '\n\n[...truncated...]';
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to fetch website: ${err instanceof Error ? err.message : 'Timeout or network error'}` },
        { status: 400 }
      );
    }

    if (pageContent.length < 50) {
      return NextResponse.json({ error: 'Website content too short to extract meaningful knowledge' }, { status: 400 });
    }

    // Step 2: Use AI to extract structured capability assets
    let ZAI: any;
    let aiAvailable = false;
    try {
      ZAI = (await import('z-ai-web-dev-sdk')).default;
      aiAvailable = true;
    } catch { /* SDK not available */ }

    if (!aiAvailable) {
      return NextResponse.json({
        success: false,
        error: 'AI SDK not available for enrichment',
        pageTitle,
        contentLength: pageContent.length,
      }, { status: 500 });
    }

    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are a knowledge extraction engine for a B2B technology services company. Analyze the following website content and extract structured knowledge assets.

${suggestedServiceLine ? `The suggested service line is: "${suggestedServiceLine}"` : ''}

Extract up to 6 knowledge assets from the page. Categories:
- "service_line" — Services or capabilities mentioned
- "case_study" — Client stories, success stories, or results
- "proof_point" — Statistics, metrics, certifications, or claims
- "objection_response" — FAQ answers, trust signals, guarantee statements
- "cta" — Calls-to-action or engagement offers

For each asset:
- title: Short descriptive title
- summary: 1-2 sentence summary
- content: Relevant text from the page
- category: One of the 5 categories
- serviceLine: Related service line
- targetIndustries: Comma-separated industries
- targetRoles: Comma-separated target roles
- problems: Comma-separated problems addressed
- evidence: Key metrics or proof points

CRITICAL: Respond with valid JSON only. Format:
{"pageTitle":"...","overallSummary":"...","assets":[{"title":"...","summary":"...","content":"...","category":"service_line","serviceLine":"...","targetIndustries":"...","targetRoles":"...","problems":"...","evidence":"..."}]}`,
          },
          {
            role: 'user',
            content: `Extract knowledge assets from this website:\n\nURL: ${url}\nPage Title: ${pageTitle}\n\nContent:\n${pageContent}`,
          },
        ],
        thinking: { type: 'disabled' },
      });

      let aiResponse = completion.choices[0]?.message?.content || '';
      aiResponse = aiResponse.trim();
      if (aiResponse.startsWith('```')) {
        aiResponse = aiResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(aiResponse);
      const assets = (parsed.assets || []).map((a: Record<string, unknown>) => ({
        title: String(a.title || 'Untitled'),
        summary: String(a.summary || ''),
        content: String(a.content || ''),
        category: ['service_line', 'case_study', 'proof_point', 'objection_response', 'cta'].includes(String(a.category)) ? String(a.category) : 'service_line',
        serviceLine: String(a.serviceLine || suggestedServiceLine || ''),
        targetIndustries: String(a.targetIndustries || ''),
        targetRoles: String(a.targetRoles || ''),
        problems: String(a.problems || ''),
        evidence: String(a.evidence || ''),
      }));

      return NextResponse.json({
        success: true,
        url,
        pageTitle: parsed.pageTitle || pageTitle,
        overallSummary: parsed.overallSummary || '',
        assetsGenerated: assets.length,
        assets,
      });
    } catch (err) {
      console.error('AI enrichment failed:', err);
      return NextResponse.json({
        success: false,
        error: 'AI extraction failed: ' + (err instanceof Error ? err.message : 'Unknown'),
        pageTitle,
        contentLength: pageContent.length,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Enrich error:', error);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}