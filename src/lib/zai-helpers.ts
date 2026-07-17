/**
 * Shared AI helpers — LLM + Tavily Web Search
 *
 * Replaces Z.AI internal SDK (unreachable from Vercel) with:
 *   - NVIDIA NIM (primary), Fireworks (backup), Groq, Gemini for LLM
 *   - Tavily API for web search
 *
 * ALL 27 downstream files import from here — fixing this file
 * fixes the entire AI pipeline.
 *
 * Env vars (set on Vercel + local .env.local):
 *   NVIDIA_API_KEY    — NVIDIA NIM API key (build.nvidia.com)
 *   FIREWORKS_API_KEY — Fireworks AI API key (fireworks.ai)
 *   GROQ_API_KEY      — Groq API key
 *   GEMINI_API_KEY    — Google AI Studio API key
 *   TAVILY_API_KEY    — Tavily search API key
 */

// ---------------------------------------------------------------------------
// Types (unchanged — consumed by 27+ files)
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
// Config — supports multiple LLM providers with automatic fallback
// Priority: NVIDIA NIM > Fireworks > Groq > Gemini (tries multiple models)
// ---------------------------------------------------------------------------

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct'

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY || ''
const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1'
const FIREWORKS_MODEL = 'accounts/fireworks/models/llama-v3p3-70b-instruct'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
// Try multiple Gemini models — some keys have quota on specific models
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || ''

// ---------------------------------------------------------------------------
// LLM — Gemini via OpenAI-compatible endpoint
// ---------------------------------------------------------------------------

/**
 * Call a single LLM provider endpoint.
 * Returns the text content or throws.
 */
async function callLLMProvider(baseURL: string, apiKey: string, model: string, userMessages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: userMessages,
      temperature: 0.7,
      max_tokens: 8192,
    }),
    timeout: 15000, // 15s fetch timeout (Vercel Hobby kills at 10s total)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${model}: ${response.status} — ${errorText.slice(0, 150)}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  // Try NVIDIA NIM first (primary — free credits, fast)
  if (NVIDIA_API_KEY) {
    try {
      return await callLLMProvider(NVIDIA_BASE_URL, NVIDIA_API_KEY, NVIDIA_MODEL, messages)
    } catch (err) {
      console.warn('[callLLM] NVIDIA failed, trying Fireworks:', err instanceof Error ? err.message : err)
    }
  }

  // Try Fireworks (backup)
  if (FIREWORKS_API_KEY) {
    try {
      return await callLLMProvider(FIREWORKS_BASE_URL, FIREWORKS_API_KEY, FIREWORKS_MODEL, messages)
    } catch (err) {
      console.warn('[callLLM] Fireworks failed, trying Groq:', err instanceof Error ? err.message : err)
    }
  }

  // Try Groq
  if (GROQ_API_KEY) {
    try {
      return await callLLMProvider(GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL, messages)
    } catch (err) {
      console.warn('[callLLM] Groq failed, trying Gemini:', err instanceof Error ? err.message : err)
    }
  }

  // Try Gemini models in order
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        return await callLLMProvider(GEMINI_BASE_URL, GEMINI_API_KEY, model, messages)
      } catch (err) {
        console.warn(`[callLLM] Gemini ${model} failed:`, err instanceof Error ? err.message : err)
      }
    }
  }

  throw new Error('All LLM providers failed. Set NVIDIA_API_KEY or FIREWORKS_API_KEY in Vercel env vars.')
}

/**
 * Multi-turn chat with provider fallback.
 */
export async function callChatLLM(systemPrompt: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string> {
  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  // Try NVIDIA NIM first (primary)
  if (NVIDIA_API_KEY) {
    try {
      return await callLLMProvider(NVIDIA_BASE_URL, NVIDIA_API_KEY, NVIDIA_MODEL, allMessages)
    } catch (err) {
      console.warn('[callChatLLM] NVIDIA failed, trying Fireworks:', err instanceof Error ? err.message : err)
    }
  }

  // Try Fireworks (backup)
  if (FIREWORKS_API_KEY) {
    try {
      return await callLLMProvider(FIREWORKS_BASE_URL, FIREWORKS_API_KEY, FIREWORKS_MODEL, allMessages)
    } catch (err) {
      console.warn('[callChatLLM] Fireworks failed, trying Groq:', err instanceof Error ? err.message : err)
    }
  }

  // Try Groq
  if (GROQ_API_KEY) {
    try {
      return await callLLMProvider(GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL, allMessages)
    } catch (err) {
      console.warn('[callChatLLM] Groq failed, trying Gemini:', err instanceof Error ? err.message : err)
    }
  }

  // Try Gemini models in order
  if (GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        return await callLLMProvider(GEMINI_BASE_URL, GEMINI_API_KEY, model, allMessages)
      } catch (err) {
        console.warn(`[callChatLLM] Gemini ${model} failed:`, err instanceof Error ? err.message : err)
      }
    }
  }

  throw new Error('All LLM providers failed. Set NVIDIA_API_KEY or FIREWORKS_API_KEY in Vercel env vars.')
}

// ---------------------------------------------------------------------------
// Tavily AI Answer — lightweight LLM substitute for extraction tasks
// Uses Tavily's built-in AI to answer questions from search results.
// Much cheaper/faster than a full LLM call, good for structured extraction.
// ---------------------------------------------------------------------------

/**
 * Get an AI-generated answer from Tavily search.
 * Returns empty string if Tavily is unavailable.
 */
export async function tavilyAIAnswer(query: string): Promise<string> {
  if (!TAVILY_API_KEY) return ''

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: 5,
        search_depth: 'advanced',
        include_answer: true,
      }),
    })

    if (!response.ok) return ''

    const data = await response.json()
    return data.answer || ''
  } catch (err) {
    console.warn('[tavilyAIAnswer] failed:', err instanceof Error ? err.message : err)
    return ''
  }
}

// ---------------------------------------------------------------------------
// Web Search — Tavily API
// ---------------------------------------------------------------------------

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
  raw_content?: string
  answer?: string
}

/**
 * Invoke Tavily web search and return normalized results.
 * Drop-in replacement for the old Z.AI web_search function.
 */
export async function webSearch(query: string, num = 10): Promise<WebSearchResult[]> {
  if (!TAVILY_API_KEY) {
    console.error('[webSearch] TAVILY_API_KEY not configured')
    return []
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: Math.min(num, 10),
        search_depth: 'basic',
        include_answer: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[webSearch] Tavily API error:', response.status, errorText)
      return []
    }

    const data = await response.json()
    const results: TavilyResult[] = data.results || []

    return results.slice(0, num).map((r, i) => {
      let hostName = ''
      try { hostName = new URL(r.url).hostname } catch { /* ignore */ }

      return {
        title: r.title || '',
        url: r.url || '',
        snippet: r.content || '',
        name: r.title || '',
        host_name: hostName,
        description: r.content || '',
        date: '',
        rank: i,
        favicon: '',
      }
    }).filter(r => r.title || r.url || r.snippet)
  } catch (err) {
    console.error('[webSearch] failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ---------------------------------------------------------------------------
// JSON extraction from LLM output
// ---------------------------------------------------------------------------

export function extractJSON(raw: string): unknown {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try { return JSON.parse(cleaned) } catch { /* fall through */ }

  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch { /* fall through */ }
  }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) } catch { /* fall through */ }
  }

  return null
}

// ---------------------------------------------------------------------------
// Company Research — Tavily search + Gemini extraction
// ---------------------------------------------------------------------------

/**
 * Full company research using multiple Tavily searches + Gemini extraction.
 * Returns structured data: overview, revenue, headcount, tech stack,
 * key people, recent news, social profiles.
 */
export async function researchCompany(
  companyName: string,
  domain?: string | null,
  existingIndustry?: string | null,
): Promise<CompanyResearch> {
  const domainStr = domain || ''
  const industryStr = existingIndustry || ''

  // Run 4 parallel Tavily searches
  const [bizResults, techResults, peopleResults, newsResults] = await Promise.allSettled([
    webSearch(`${companyName} ${domainStr} revenue employees funding 2024 2025 overview`, 8),
    webSearch(`${companyName} technology stack products services digital`, 6),
    webSearch(`${companyName} CEO CTO CIO COO CFO leadership team executives LinkedIn`, 8),
    webSearch(`${companyName} news 2025 funding hiring expansion partnership`, 8),
  ])

  // Collect all snippets
  const allSnippets: string[] = []
  let linkedInUrl = ''
  let twitterUrl = ''
  let websiteUrl = domainStr ? `https://${domainStr}` : ''

  for (const result of [bizResults, techResults, peopleResults, newsResults]) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet}`)
        if (r.url?.includes('linkedin.com/company') && !linkedInUrl) {
          linkedInUrl = r.url
        }
        if ((r.url?.includes('twitter.com') || r.url?.includes('x.com')) && !twitterUrl) {
          twitterUrl = r.url
        }
        if (!websiteUrl && r.url && !r.url.includes('linkedin.com') && !r.url.includes('twitter.com') && !r.url.includes('wikipedia.org')) {
          const urlObj = new URL(r.url)
          if (urlObj.hostname !== 'www.google.com' && urlObj.hostname !== 'news.google.com') {
            websiteUrl = r.url
          }
        }
      }
    }
  }

  const searchContext = allSnippets.slice(0, 30).join('\n')

  // Extract structured data with Gemini
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
}`

  const userPrompt = `Company: ${companyName}
Domain: ${domainStr || 'Unknown'}
Current Industry: ${industryStr || 'Unknown'}

Web Search Results:
${searchContext || 'No results found.'}

Extract accurate company data as JSON. Ground everything in the search results above.`

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const parsed = extractJSON(response) as Record<string, unknown> | null

    if (parsed && typeof parsed === 'object') {
      const keyPeople = Array.isArray(parsed.keyPeople)
        ? (parsed.keyPeople as Record<string, unknown>[]).map(p => ({
            name: String(p.name || ''),
            title: String(p.title || ''),
            department: p.department ? String(p.department) : undefined,
            linkedInUrl: p.linkedInUrl ? String(p.linkedInUrl) : undefined,
            source: 'web_search',
          })).filter(p => p.name)
        : []

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
        : []

      const socialProfiles: Record<string, string> = {}
      if (linkedInUrl) socialProfiles.linkedin = linkedInUrl
      if (twitterUrl) socialProfiles.twitter = twitterUrl

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
      }
    }
  } catch (err) {
    console.error('[researchCompany] LLM extraction failed:', err)
  }

  // Fallback
  const socialProfiles: Record<string, string> = {}
  if (linkedInUrl) socialProfiles.linkedin = linkedInUrl
  if (twitterUrl) socialProfiles.twitter = twitterUrl

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
  }
}

// ---------------------------------------------------------------------------
// Find Key People — Tavily search
// ---------------------------------------------------------------------------

/**
 * Find key executives at a company via Tavily search.
 */
export async function findKeyPeople(companyName: string): Promise<KeyPerson[]> {
  const [execResults, vpResults] = await Promise.allSettled([
    webSearch(`${companyName} CEO CTO CIO COO CFO president executives LinkedIn`, 8),
    webSearch(`${companyName} VP director head of management team LinkedIn`, 6),
  ])

  const allSnippets: string[] = []
  for (const result of [execResults, vpResults]) {
    if (result.status === 'fulfilled') {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet}`)
      }
    }
  }

  if (allSnippets.length === 0) return []

  const systemPrompt = `You are an executive research specialist. From the web search results below, identify key people at "${companyName}".

Extract ONLY people who are clearly mentioned in the search results.
Return valid JSON array: [{"name": "Full Name", "title": "Exact Title", "department": "department", "linkedInUrl": "url or empty"}]

Include C-suite, VPs, Directors, and Heads. Maximum 10 people.
If no people are found, return an empty array [].`

  const userPrompt = `Company: ${companyName}\n\nSearch Results:\n${allSnippets.slice(0, 20).join('\n')}`

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const parsed = extractJSON(response)

    if (Array.isArray(parsed)) {
      return (parsed as Record<string, unknown>[])
        .map(p => ({
          name: String(p.name || ''),
          title: String(p.title || ''),
          department: p.department ? String(p.department) : undefined,
          linkedInUrl: p.linkedInUrl ? String(p.linkedInUrl) : undefined,
          source: 'web_search',
        }))
        .filter(p => p.name && p.title)
    }
  } catch (err) {
    console.error('[findKeyPeople] failed:', err)
  }

  return []
}

// ---------------------------------------------------------------------------
// Company News & Signals — Tavily search
// ---------------------------------------------------------------------------

/**
 * Get recent news and buying signals for a company.
 */
export async function getCompanyNews(companyName: string): Promise<NewsSignal[]> {
  const [newsResults, signalResults] = await Promise.allSettled([
    webSearch(`${companyName} news 2025`, 8),
    webSearch(`${companyName} funding hiring expansion acquisition digital transformation`, 6),
  ])

  const allSnippets: string[] = []
  for (const result of [newsResults, signalResults]) {
    if (result.status === 'fulfilled') {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet} (source: ${r.url})`)
      }
    }
  }

  if (allSnippets.length === 0) return []

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
If no relevant signals, return empty array [].`

  const userPrompt = `Company: ${companyName}\n\nSearch Results:\n${allSnippets.slice(0, 20).join('\n')}`

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const parsed = extractJSON(response)

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
        .filter(n => n.title)
    }
  } catch (err) {
    console.error('[getCompanyNews] failed:', err)
  }

  return []
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
    return { valid: false, reason: 'Invalid email format', score: 0 }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email syntax', score: 10 }
  }

  const domain = email.split('@')[1].toLowerCase()

  const disposableDomains = ['guerrillamail.com', 'mailinator.com', 'throwaway.email', 'yopmail.com', 'tempmail.com']
  if (disposableDomains.some(d => domain.includes(d))) {
    return { valid: false, reason: 'Disposable email provider', score: 5 }
  }

  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com']
  const isFree = freeProviders.includes(domain)

  try {
    const dns = await import('dns/promises')
    const records = await dns.resolveMx(domain)
    if (records && records.length > 0) {
      return { valid: true, reason: 'MX record found', score: isFree ? 60 : 85 }
    }
  } catch {
    // No MX record
  }

  return { valid: false, reason: 'No MX record found', score: 20 }
}

// ---------------------------------------------------------------------------
// Legacy getZAI() — backward compat for ai__chat.ts and ai__generate-ppt.ts
// Returns a minimal compatible object.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

let _compatZAI: any = null

/**
 * @deprecated Use callLLM() or webSearch() instead.
 * Provides a minimal Z.AI SDK-compatible object for legacy code.
 */
export async function getZAI(): Promise<any> {
  if (_compatZAI) return _compatZAI

  _compatZAI = {
    chat: {
      completions: {
        create: async (body: any) => {
          const msgs = body.messages || []
          // Separate system from user/assistant messages
          const systemMsg = msgs.find((m: any) => m.role === 'system')
          const chatMsgs = msgs.filter((m: any) => m.role !== 'system')

          const response = await callChatLLM(
            systemMsg?.content || 'You are a helpful assistant.',
            chatMsgs.map((m: any) => ({ role: m.role, content: m.content }))
          )

          return {
            choices: [{ message: { content: response } }],
            model: NVIDIA_API_KEY ? NVIDIA_MODEL : (FIREWORKS_API_KEY ? FIREWORKS_MODEL : GEMINI_MODELS[0]),
          }
        },
      },
    },
    // For PPT generation — not supported via Gemini, returns error
    functions: {
      invoke: async (functionName: string, args: any) => {
        console.warn(`[getZAI] functions.invoke("${functionName}") called — Z.AI SDK functions not available in production. Use direct API calls.`)
        throw new Error(`Z.AI function "${functionName}" is not available. The internal Z.AI SDK is not reachable from Vercel. For PPT generation, use a server-side library instead.`)
      },
    },
  }

  return _compatZAI
}