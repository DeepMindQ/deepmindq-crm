import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

// ── Types ──

interface SuggestedContact {
  name: string | null;
  role: string;
  whyRelevant: string;
  influence: string;
  priority: number;
  recommendedAction: string;
}

interface WebResult { title: string; url: string; snippet: string; }
interface CacheEntry { data: Record<string, unknown>; expiresAt: number; }

// ── In-memory cache (2-hour TTL) ──

const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCached(companyId: string): Record<string, unknown> | null {
  const entry = cache.get(companyId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(companyId); return null; }
  return entry.data;
}

function setCache(companyId: string, data: Record<string, unknown>) {
  cache.set(companyId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Z-AI SDK helpers ──

async function webSearch(query: string, num = 10): Promise<WebResult[]> {
  try {
    const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create());
    const results = await ZAI.functions.invoke('web_search', { query, num });
    return (results || [])
      .slice(0, num)
      .map((r: Record<string, string>) => ({
        title: r.name || '',
        url: r.url || '',
        snippet: r.snippet || '',
      }));
  } catch (e) {
    console.error('[suggested-contacts] Web search failed:', e);
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

// ── JSON parsing with regex fallback ──

function parseContacts(raw: string): SuggestedContact[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return validateContacts(arr);
  } catch {
    // fall through to regex
  }

  const contacts: SuggestedContact[] = [];
  const re = /\{\s*"role"\s*:\s*"([^"]+)"[\s\S]*?"whyRelevant"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"influence"\s*:\s*"([^"]+)"[\s\S]*?"priority"\s*:\s*(\d)[\s\S]*?"recommendedAction"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"name"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|null)\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    contacts.push({
      role: match[1],
      whyRelevant: match[2].replace(/\\"/g, '"'),
      influence: match[3],
      priority: Math.min(5, Math.max(1, parseInt(match[4], 10) || 3)),
      recommendedAction: match[5].replace(/\\"/g, '"'),
      name: match[6] ? match[6].replace(/\\"/g, '"') : null,
    });
  }
  return validateContacts(contacts);
}

const VALID_INFLUENCE = ['Decision Maker', 'Technical Influencer', 'Business Sponsor', 'Champion', 'Blocker'];

function validateContacts(arr: unknown[]): SuggestedContact[] {
  return arr
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null && c.role)
    .map((c) => ({
      name: typeof c.name === 'string' ? c.name : null,
      role: String(c.role),
      whyRelevant: String(c.whyRelevant ?? ''),
      influence: VALID_INFLUENCE.includes(String(c.influence)) ? String(c.influence) : 'Technical Influencer',
      priority: Math.min(5, Math.max(1, typeof c.priority === 'number' ? c.priority : 3)),
      recommendedAction: String(c.recommendedAction ?? ''),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
}

// GET /api/ai/suggested-contacts?companyId=xxx

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter is required', 400);

  const cached = getCached(companyId);
  if (cached) return apiSuccess(cached);

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: {
          select: { id: true, rawName: true, title: true, role: true, email: true, leadScore: true },
          orderBy: { leadScore: 'desc' },
          take: 20,
        },
      },
    });

    if (!company) return apiError('Company not found', 404);

    const companyName = company.rawName;

    // 3 parallel web searches
    const [leadership, linkedin, orgStructure] = await Promise.all([
      webSearch(`${companyName} leadership team CIO CTO CEO executives`, 10),
      webSearch(`${companyName} VP director management team LinkedIn`, 10),
      webSearch(`${companyName} organizational structure department heads`, 10),
    ]);

    const allResults = [leadership, linkedin, orgStructure].flat();
    const seenUrls = new Set<string>();
    const uniqueResults = allResults.filter((r) => {
      if (!r.url || seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    const sourceUrls = uniqueResults.map((r) => r.url);
    const webContext = uniqueResults
      .slice(0, 15)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   URL: ${r.url}`)
      .join('\n\n');

    // Build LLM prompt with existing contacts for comparison
    const existingContactSummary = company.contacts.length > 0
      ? company.contacts.map((c) => `  - ${c.rawName} (${c.title || c.role || 'Unknown role'})`).join('\n')
      : 'None';

    const systemPrompt =
      'You are a B2B stakeholder identification expert. Analyze search results to identify key decision-makers and influencers within a company. Always respond with valid JSON only.';

    const userPrompt = `Based on the search results about ${companyName}, identify the key stakeholders who would be relevant for a technology/AI consulting engagement.

For each stakeholder, determine:
- Name (if found in search results, otherwise use role only)
- Role/Title
- Why they're relevant
- Influence level: Decision Maker / Technical Influencer / Business Sponsor / Champion / Blocker
- Priority (1-5 stars)
- Recommended action to engage them

Existing contacts in CRM:\n${existingContactSummary}

Search results:
${webContext || 'No web results found.'}

Return ONLY valid JSON array:
[
  {
    "name": "Name or null if not found",
    "role": "Chief Information Officer",
    "whyRelevant": "Leads technology strategy...",
    "influence": "Decision Maker",
    "priority": 5,
    "recommendedAction": "Direct executive introduction"
  }
]

Identify 5-8 stakeholders. Focus on C-suite, VPs, and Directors relevant to technology, digital transformation, and operations.`;

    const raw = await aiChat(systemPrompt, userPrompt);
    const contacts = parseContacts(raw);

    const response = {
      companyId,
      companyName,
      contacts,
      existingContacts: company.contacts.map((c) => ({
        id: c.id,
        name: c.rawName,
        title: c.title ?? c.role ?? null,
        email: c.email,
        leadScore: c.leadScore,
      })),
      sources: sourceUrls,
      generatedAt: new Date().toISOString(),
    };

    setCache(companyId, response);
    return apiSuccess(response);
  } catch (e) {
    console.error('[suggested-contacts] Error:', e);
    return apiError('Failed to generate suggested contacts');
  }
}