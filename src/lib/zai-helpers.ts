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
 * API keys are resolved dynamically from ai-config.ts:
 *   1. Runtime override (set via Settings UI → /api/settings)
 *   2. Environment variable (process.env.*)
 *   3. Empty string (provider disabled)
 *
 * Users can now manage all API keys from Settings > AI Providers.
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
// Dynamic config — reads from ai-config.ts (env vars → Settings UI overrides)
// ---------------------------------------------------------------------------

import { getLLMChain, getSearchProvider, getProviderConfig } from '@/lib/ai-config'

// Gemini-specific: try multiple models since some keys have per-model quotas
const GEMINI_FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']

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

  const chain = await getLLMChain()
  const errors: string[] = []

  for (const provider of chain) {
    try {
      // Gemini: try multiple model variants
      if (provider.label.includes('Gemini')) {
        for (const model of GEMINI_FALLBACK_MODELS) {
          try {
            return await callLLMProvider(provider.baseUrl, provider.apiKey, model, messages)
          } catch (err) {
            errors.push(`Gemini/${model}: ${err instanceof Error ? err.message : err}`)
          }
        }
        continue
      }
      return await callLLMProvider(provider.baseUrl, provider.apiKey, provider.model, messages)
    } catch (err) {
      errors.push(`${provider.label}: ${err instanceof Error ? err.message : err}`)
    }
  }

  const msg = errors.length > 0
    ? `All LLM providers failed:\n${errors.map(e => '  - ' + e).join('\n')}`
    : 'No LLM providers configured. Add API keys in Settings > AI Providers.'
  throw new Error(msg)
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
  const searchProvider = await getSearchProvider()
  if (!searchProvider) return ''

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: searchProvider.apiKey,
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
  const searchProvider = await getSearchProvider()
  if (!searchProvider) {
    console.error('[webSearch] No search provider configured. Add Tavily API key in Settings > AI Providers.')
    return []
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: searchProvider.apiKey,
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

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNANCE ARCHITECTURE RULE (Phase 3 Freeze + Phase 4 A2 Enforcement)
// ═══════════════════════════════════════════════════════════════════════════════
//
// DEPRECATED FUNCTIONS (removed in Phase 3 — do NOT re-add):
//   - researchCompany()    → use research-engine/researcher.ts
//   - findKeyPeople()      → inlined in research-engine/researcher.ts (governed)
//   - getCompanyNews()     → use research-engine/signals.ts
//   - getZAI()             → removed entirely
//   - callChatLLM()        → removed entirely
//
// ACTIVE EXPORTS (used by governed AI routes via ai-governance.ts):
//   - callLLM()            → ONLY for import by ai-governance.ts
//   - webSearch()          → for research engine, signal detection
//   - extractJSON()        → for parsing LLM responses
//   - tavilyAIAnswer()     → for lightweight extraction tasks
//   - verifyEmailBasic()   → for email validation
//   - Type exports: WebSearchResult, KeyPerson, NewsSignal, CompanyResearch
//
// ENFORCEMENT:
//   - ESLint rule: no-ungoverned-llm (blocks unauthorized callLLM imports)
//   - CI script: scripts/check-governance.sh
//   - Build fails if any violation detected
// ═══════════════════════════════════════════════════════════════════════════════

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