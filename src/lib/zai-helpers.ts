/**
 * Shared ZAI SDK helpers — single source of truth for
 * SDK init, web search, LLM calls, and company research.
 *
 * ALL AI engines MUST use these helpers — never create
 * your own SDK instance or LLM wrapper.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  name?: string
  host_name?: string
  description?: string
  date?: string
  rank?: number
  favicon?: string
}

export interface KeyPerson {
  name: string
  title: string
  department?: string
  linkedInUrl?: string
  source?: string
}

export interface NewsSignal {
  title: string
  snippet: string
  source: string
  url: string
  date?: string
  signalType: 'funding' | 'hiring' | 'leadership' | 'expansion' | 'technology' | 'product' | 'partnership' | 'other'
  impact: 'high' | 'medium' | 'low'
}

export interface CompanyResearch {
  businessOverview: string
  revenue: string
  employeeCount: string
  fundingStage: string
  techStack: string
  socialProfiles: Record<string, string>
  keyPeople: KeyPerson[]
  recentNews: NewsSignal[]
  industry: string
  website: string
  confidence: number
}

// ---------------------------------------------------------------------------
// Singleton SDK instance (one per serverless invocation)
// ---------------------------------------------------------------------------

let _zai: Awaited<ReturnType<typeof createZAIInstance>> | null = null;

async function createZAIInstance() {
  const { ensureZaiConfig } = await import('@/lib/zai-config');
  await ensureZaiConfig();
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
  return ZAI.create();
}

export async function getZAI() {
  if (!_zai) {
    _zai = await createZAIInstance();
  }
  return _zai;
}

// ---------------------------------------------------------------------------
// Web search — robust response parsing
// ---------------------------------------------------------------------------

/**
 * Invoke web_search and return a normalized array of results.
 */
export async function webSearch(query: string, num = 10): Promise<WebSearchResult[]> {
  try {
    const zai = await getZAI();
    const raw = await zai.functions.invoke('web_search', { query, num });

    let items: unknown[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      for (const key of ['results', 'data', 'items', 'hits', 'organic_results']) {
        if (Array.isArray(obj[key])) {
          items = obj[key] as unknown[];
          break;
        }
      }
    }

    return items.slice(0, num).map((r: unknown) => {
      const item = r as Record<string, unknown>;
      return {
        title: String(item.title ?? item.name ?? ''),
        url: String(item.url ?? ''),
        snippet: String(item.snippet ?? item.description ?? item.content ?? ''),
        name: item.name ? String(item.name) : undefined,
        host_name: item.host_name ? String(item.host_name) : undefined,
        description: item.description ? String(item.description) : undefined,
        date: item.date ? String(item.date) : undefined,
      };
    }).filter(r => r.title || r.url || r.snippet);
  } catch (err) {
    console.error('[zai-helpers] web_search failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// LLM chat completion
// ---------------------------------------------------------------------------

/**
 * Call the LLM with a proper system + user message pair.
 */
export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const zai = await getZAI();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices?.[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// JSON extraction from LLM output
// ---------------------------------------------------------------------------

export function extractJSON(raw: string): unknown {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Company Research — comprehensive web search + LLM extraction
// ---------------------------------------------------------------------------

/**
 * Full company research using multiple web searches + LLM extraction.
 * Returns structured data: overview, revenue, headcount, tech stack,
 * key people, recent news, social profiles.
 */
export async function researchCompany(
  companyName: string,
  domain?: string | null,
  existingIndustry?: string | null,
): Promise<CompanyResearch> {
  const domainStr = domain || '';
  const industryStr = existingIndustry || '';

  // Run 4 parallel web searches for comprehensive data
  const [bizResults, techResults, peopleResults, newsResults] = await Promise.allSettled([
    webSearch(`${companyName} ${domainStr} revenue employees funding 2024 2025 overview`, 8),
    webSearch(`${companyName} technology stack products services digital`, 6),
    webSearch(`${companyName} CEO CTO CIO COO CFO leadership team executives LinkedIn`, 8),
    webSearch(`${companyName} news 2025 funding hiring expansion partnership`, 8),
  ]);

  // Collect all snippets
  const allSnippets: string[] = [];
  let linkedInUrl = '';
  let twitterUrl = '';
  let websiteUrl = domainStr ? `https://${domainStr}` : '';

  for (const result of [bizResults, techResults, peopleResults, newsResults]) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet}`);
        if (r.url?.includes('linkedin.com/company') && !linkedInUrl) {
          linkedInUrl = r.url;
        }
        if ((r.url?.includes('twitter.com') || r.url?.includes('x.com')) && !twitterUrl) {
          twitterUrl = r.url;
        }
        // Find official website if we don't have one
        if (!websiteUrl && r.url && !r.url.includes('linkedin.com') && !r.url.includes('twitter.com') && !r.url.includes('wikipedia.org')) {
          const urlObj = new URL(r.url);
          if (urlObj.hostname !== 'www.google.com' && urlObj.hostname !== 'news.google.com') {
            websiteUrl = r.url;
          }
        }
      }
    }
  }

  const searchContext = allSnippets.slice(0, 30).join('\n');

  // Extract structured data with LLM
  const systemPrompt = `You are a senior business intelligence analyst. Based ONLY on the web search results provided, extract accurate, factual company data.

CRITICAL RULES:
- Only include information DIRECTLY supported by the search results
- If a field cannot be determined from search results, write "Not found"
- NEVER fabricate or guess values
- Use real numbers and data from the search results
- For employee count, use exact numbers or ranges from the search results

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "businessOverview": "2-3 sentence factual description",
  "revenue": "revenue or range from search results, or 'Not found'",
  "employeeCount": "employee count or range, or 'Not found'",
  "fundingStage": "Bootstrap/Seed/Series A/Series B/Series C+/PE-backed/Public/Not found",
  "techStack": "comma-separated technologies mentioned",
  "industry": "primary industry",
  "website": "official website URL",
  "keyPeople": [
    {"name": "full name", "title": "exact title", "department": "department", "linkedInUrl": "url or empty"}
  ],
  "recentNews": [
    {"title": "headline", "snippet": "summary", "signalType": "funding|hiring|leadership|expansion|technology|product|partnership|other", "impact": "high|medium|low"}
  ]
}`;

  const userPrompt = `Company: ${companyName}
Domain: ${domainStr || 'Unknown'}
Current Industry: ${industryStr || 'Unknown'}

Web Search Results:
${searchContext || 'No results found.'}

Extract accurate company data as JSON. Ground everything in the search results above.`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const parsed = extractJSON(response) as Record<string, unknown> | null;

    if (parsed && typeof parsed === 'object') {
      const keyPeople = Array.isArray(parsed.keyPeople)
        ? (parsed.keyPeople as Record<string, unknown>[]).map(p => ({
            name: String(p.name || ''),
            title: String(p.title || ''),
            department: p.department ? String(p.department) : undefined,
            linkedInUrl: p.linkedInUrl ? String(p.linkedInUrl) : undefined,
            source: 'web_search',
          })).filter(p => p.name)
        : [];

      const recentNews = Array.isArray(parsed.recentNews)
        ? (parsed.recentNews as Record<string, unknown>[]).map(n => ({
            title: String(n.title || ''),
            snippet: String(n.snippet || ''),
            source: 'web_search',
            url: '',
            signalType: (['funding','hiring','leadership','expansion','technology','product','partnership','other'].includes(String(n.signalType))
              ? String(n.signalType) : 'other') as NewsSignal['signalType'],
            impact: (['high','medium','low'].includes(String(n.impact))
              ? String(n.impact) : 'medium') as NewsSignal['impact'],
          })).filter(n => n.title)
        : [];

      const socialProfiles: Record<string, string> = {};
      if (linkedInUrl) socialProfiles.linkedin = linkedInUrl;
      if (twitterUrl) socialProfiles.twitter = twitterUrl;

      return {
        businessOverview: String(parsed.businessOverview || `${companyName} operates in the ${industryStr || 'technology'} sector.`),
        revenue: String(parsed.revenue || 'Not found'),
        employeeCount: String(parsed.employeeCount || 'Not found'),
        fundingStage: String(parsed.fundingStage || 'Not found'),
        techStack: String(parsed.techStack || ''),
        socialProfiles,
        keyPeople,
        recentNews,
        industry: String(parsed.industry || industryStr || 'Not found'),
        website: String(parsed.website || websiteUrl || ''),
        confidence: searchContext ? 80 : 20,
      };
    }
  } catch (err) {
    console.error('[researchCompany] LLM extraction failed:', err);
  }

  // Fallback — return minimal data with whatever URLs we found
  const socialProfiles: Record<string, string> = {};
  if (linkedInUrl) socialProfiles.linkedin = linkedInUrl;
  if (twitterUrl) socialProfiles.twitter = twitterUrl;

  return {
    businessOverview: `${companyName} operates in the ${industryStr || 'technology'} sector.`,
    revenue: 'Not found',
    employeeCount: 'Not found',
    fundingStage: 'Not found',
    techStack: '',
    socialProfiles,
    keyPeople: [],
    recentNews: [],
    industry: industryStr || 'Not found',
    website: websiteUrl,
    confidence: 10,
  };
}

// ---------------------------------------------------------------------------
// Find Key People — LinkedIn-safe search
// ---------------------------------------------------------------------------

/**
 * Find key executives at a company via web search.
 * Uses search engine results (LinkedIn-safe, no scraping).
 */
export async function findKeyPeople(companyName: string): Promise<KeyPerson[]> {
  const [execResults, vpResults] = await Promise.allSettled([
    webSearch(`${companyName} CEO CTO CIO COO CFO president executives LinkedIn`, 8),
    webSearch(`${companyName} VP director head of management team LinkedIn`, 6),
  ]);

  const allSnippets: string[] = [];
  for (const result of [execResults, vpResults]) {
    if (result.status === 'fulfilled') {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet}`);
      }
    }
  }

  if (allSnippets.length === 0) return [];

  const systemPrompt = `You are an executive research specialist. From the web search results below, identify key people at "${companyName}".

Extract ONLY people who are clearly mentioned in the search results.
Return valid JSON array: [{"name": "Full Name", "title": "Exact Title", "department": "department", "linkedInUrl": "url or empty"}]

Include C-suite, VPs, Directors, and Heads. Maximum 10 people.
If no people are found, return an empty array [].`;

  const userPrompt = `Company: ${companyName}\n\nSearch Results:\n${allSnippets.slice(0, 20).join('\n')}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const parsed = extractJSON(response);

    if (Array.isArray(parsed)) {
      return (parsed as Record<string, unknown>[])
        .map(p => ({
          name: String(p.name || ''),
          title: String(p.title || ''),
          department: p.department ? String(p.department) : undefined,
          linkedInUrl: p.linkedInUrl ? String(p.linkedInUrl) : undefined,
          source: 'web_search',
        }))
        .filter(p => p.name && p.title);
    }
  } catch (err) {
    console.error('[findKeyPeople] failed:', err);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Company News & Signals
// ---------------------------------------------------------------------------

/**
 * Get recent news and buying signals for a company.
 */
export async function getCompanyNews(companyName: string): Promise<NewsSignal[]> {
  const [newsResults, signalResults] = await Promise.allSettled([
    webSearch(`${companyName} news 2025`, 8),
    webSearch(`${companyName} funding hiring expansion acquisition digital transformation`, 6),
  ]);

  const allSnippets: string[] = [];
  for (const result of [newsResults, signalResults]) {
    if (result.status === 'fulfilled') {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet} (source: ${r.url})`);
      }
    }
  }

  if (allSnippets.length === 0) return [];

  const systemPrompt = `You are a B2B sales intelligence analyst. Analyze the news/search results about "${companyName}" and identify buying signals.

For each signal, classify the type and assess impact on sales opportunity.

Return valid JSON array:
[{
  "title": "headline",
  "snippet": "1-2 sentence summary",
  "source": "source name",
  "url": "source url or empty",
  "signalType": "funding|hiring|leadership|expansion|technology|product|partnership|other",
  "impact": "high|medium|low"
}]

Maximum 8 signals. Only include signals clearly supported by the results.
If no relevant signals, return empty array [].`;

  const userPrompt = `Company: ${companyName}\n\nSearch Results:\n${allSnippets.slice(0, 20).join('\n')}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const parsed = extractJSON(response);

    if (Array.isArray(parsed)) {
      return (parsed as Record<string, unknown>[])
        .map(n => ({
          title: String(n.title || ''),
          snippet: String(n.snippet || ''),
          source: String(n.source || 'web_search'),
          url: String(n.url || ''),
          signalType: (['funding','hiring','leadership','expansion','technology','product','partnership','other'].includes(String(n.signalType))
            ? String(n.signalType) : 'other') as NewsSignal['signalType'],
          impact: (['high','medium','low'].includes(String(n.impact))
            ? String(n.impact) : 'medium') as NewsSignal['impact'],
        }))
        .filter(n => n.title);
    }
  } catch (err) {
    console.error('[getCompanyNews] failed:', err);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Email Verification (basic — no external API)
// ---------------------------------------------------------------------------

/**
 * Basic email verification: syntax + domain MX check.
 * Returns { valid, reason, score }.
 */
export async function verifyEmailBasic(email: string): Promise<{ valid: boolean; reason: string; score: number }> {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: 'Invalid email format', score: 0 };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email syntax', score: 10 };
  }

  const domain = email.split('@')[1].toLowerCase();

  // Check for disposable email providers
  const disposableDomains = ['guerrillamail.com', 'mailinator.com', 'throwaway.email', 'yopmail.com', 'tempmail.com'];
  if (disposableDomains.some(d => domain.includes(d))) {
    return { valid: false, reason: 'Disposable email provider', score: 5 };
  }

  // Check for free providers
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com'];
  const isFree = freeProviders.includes(domain);

  // DNS MX lookup
  try {
    const dns = await import('dns/promises');
    const records = await dns.resolveMx(domain);
    if (records && records.length > 0) {
      return { valid: true, reason: 'MX record found', score: isFree ? 60 : 85 };
    }
  } catch {
    // No MX record
  }

  return { valid: false, reason: 'No MX record found', score: 20 };
}