/**
 * Unified LLM Client — The SINGLE entry point for all AI calls in DeepMindQ.
 *
 * Phase 1: Merges 3 competing callers into one module:
 *   - ai-caller.ts  → callAI, webSearch (Z.ai SDK), parallelWebSearch, getZAI
 *   - zai-helpers.ts → callLLM, webSearch (Tavily), extractJSON, tavilyAIAnswer
 *   - llm-helper.ts  → revenueLLMCall, generateExecutiveSummary, generateEngagementApproach
 *
 * DESIGN PRINCIPLES:
 *   1. Every function signature from all 3 callers is preserved exactly.
 *   2. Consumer migration is a pure import-path change — zero logic changes needed.
 *   3. callAI uses Z.ai SDK with quality gates (was ai-caller.ts).
 *   4. callLLM uses direct provider chain via ai-config (was zai-helpers.ts).
 *   5. webSearch uses Tavily for external routes, Z.ai SDK for Sprint routes.
 *   6. Quality gates, usage tracking, retry, timeout — all included.
 *
 * CONVENTIONS:
 *   - Prefer callLLM for new code (works without Z.ai SDK, uses free-tier providers).
 *   - Use callAI when you need quality gates + Z.ai SDK.
 *   - Use revenueLLMCall for internal narrative generation (never throws, returns '').
 */

import { getLLMChain, getSearchProvider } from '@/lib/ai-config'
import { runQualityGates, formatQualityReportForLog } from '@/lib/ai-copilot/quality-gates'
import type { QualityReport } from '@/lib/ai-copilot/quality-gates'
import { logger } from '@/lib/logger'

// ─── Type Exports (from zai-helpers.ts — consumed by 20+ files) ─────────────

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

// ─── Z.ai SDK Singleton (from ai-caller.ts) ──────────────────────────────

let _zaiInstance: any = null
let _zaiCreatedAt = 0
const SDK_INSTANCE_TTL_MS = 5 * 60 * 1000

export async function getZAI(): Promise<any> {
  const now = Date.now()
  if (_zaiInstance && (now - _zaiCreatedAt) < SDK_INSTANCE_TTL_MS) {
    return _zaiInstance
  }
  const { ensureZaiConfig } = await import('@/lib/zai-config')
  await ensureZaiConfig()
  const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default)
  _zaiInstance = await ZAI.create()
  _zaiCreatedAt = now
  return _zaiInstance
}

export function resetZAI(): void {
  _zaiInstance = null
  _zaiCreatedAt = 0
}

// ─── callAI — Z.ai SDK with quality gates (from ai-caller.ts) ─────────────

interface CallAIOptions {
  systemPrompt: string
  userPrompt: string
  feature: string
  companyId?: string
  contactId?: string
  maxRetries?: number
  timeoutMs?: number
  temperature?: number
  runQualityCheck?: boolean
  previousVerdict?: boolean
}

interface CallAIResult {
  raw: string
  parsed: Record<string, unknown> | null
  quality?: QualityReport
  success: boolean
  error?: string
  latencyMs: number
}

export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const {
    systemPrompt,
    userPrompt,
    feature,
    companyId,
    contactId,
    maxRetries = 2,
    timeoutMs = 60000,
    runQualityCheck = true,
    previousVerdict,
  } = options

  const startTime = Date.now()
  let lastError = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const zai = await getZAI()

      const completion = await Promise.race([
        zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          thinking: { type: 'disabled' },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM call timed out')), timeoutMs)
        ),
      ])

      const raw = completion.choices?.[0]?.message?.content ?? ''
      const latencyMs = Date.now() - startTime

      // Parse JSON if possible
      let parsed: Record<string, unknown> | null = null
      try {
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        }
      } catch {
        // Not JSON — that's ok
      }

      // Run quality gates on parsed output
      let quality: QualityReport | undefined
      if (runQualityCheck && parsed) {
        quality = runQualityGates(parsed, previousVerdict)
        console.log(formatQualityReportForLog(quality))
        if (quality.overallStatus === 'fail') {
          console.warn(`[llm-client] Quality gate FAILED for feature="${feature}". Score: ${quality.overallScore}`)
        }
      }

      // Track usage (fire and forget)
      trackUsage(feature, companyId, contactId, raw, latencyMs, quality).catch(() => {})

      return { raw, parsed, quality, success: true, latencyMs }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error(`[llm-client] callAI attempt ${attempt + 1}/${maxRetries + 1} failed for feature="${feature}": ${lastError}`)

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        resetZAI()
      }
    }
  }

  const latencyMs = Date.now() - startTime
  trackUsage(feature, companyId, contactId, '', latencyMs, undefined, lastError).catch(() => {})

  return { raw: '', parsed: null, success: false, error: lastError, latencyMs }
}

// ─── callLLM — Direct provider chain (from zai-helpers.ts) ───────────────

const GEMINI_FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']

async function callLLMProvider(
  baseURL: string,
  apiKey: string,
  model: string,
  userMessages: Array<{ role: string; content: string }>,
): Promise<string> {
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

// ─── Revenue LLM Call — never throws, returns '' (from llm-helper.ts) ────

async function callProviderForRevenue(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 2048 }),
  })
  if (!res.ok) throw new Error(`${model}: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function revenueLLMCall(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const chain = await getLLMChain()
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    for (const provider of chain) {
      try {
        if (provider.label.includes('Gemini')) {
          for (const m of GEMINI_FALLBACK_MODELS) {
            try { return await callProviderForRevenue(provider.baseUrl, provider.apiKey, m, messages) }
            catch { continue }
          }
          continue
        }
        return await callProviderForRevenue(provider.baseUrl, provider.apiKey, provider.model, messages)
      } catch { continue }
    }
    return ''
  } catch {
    return ''
  }
}

const BRIEF_SYSTEM = `You are a revenue intelligence analyst. Your job is to convert STRUCTURED FACTS into a concise executive summary.

CRITICAL RULES:
- Only use the facts provided. Do NOT invent, assume, or hallucinate any information.
- Do not add any facts not present in the input.
- Write in a professional, executive tone (2-4 sentences).
- Focus on what the facts mean for business opportunity.
- Do not mention confidence scores or technical details in the narrative.`

const ENGAGEMENT_SYSTEM = `You are a revenue intelligence analyst. Convert STRUCTURED FACTS about a company's signals into a recommended engagement approach.

CRITICAL RULES:
- Only reference signals and facts explicitly provided.
- Do NOT invent or assume any information.
- Be specific about WHAT to discuss, not WHO to contact (no specific names/titles).
- Write 1-3 sentences, action-oriented.
- Good: "Engage technology leadership to discuss AI modernization opportunities."
- Bad: "Contact CIO John Smith at jsmith@company.com."`

export async function generateExecutiveSummary(structuredContext: string): Promise<string> {
  return revenueLLMCall(BRIEF_SYSTEM, structuredContext)
}

export async function generateEngagementApproach(structuredContext: string): Promise<string> {
  return revenueLLMCall(ENGAGEMENT_SYSTEM, structuredContext)
}

// ─── Web Search — Tavily (from zai-helpers.ts) ───────────────────────────

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
  raw_content?: string
  answer?: string
}

const TAVILY_MAX_RETRIES = 3
const TAVILY_BASE_DELAY_MS = 1000

async function tavilyFetchWithBackoff(body: Record<string, unknown>): Promise<Response | null> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < TAVILY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) return response

      if (response.status === 429 || response.status >= 500) {
        const delay = TAVILY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200
        console.warn(`[tavily] ${response.status} on attempt ${attempt + 1}/${TAVILY_MAX_RETRIES}, retrying in ${Math.round(delay)}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const delay = TAVILY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200
      console.warn(`[tavily] network error on attempt ${attempt + 1}/${TAVILY_MAX_RETRIES}: ${lastError.message}, retrying in ${Math.round(delay)}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return null
}

export async function webSearch(query: string, num = 10): Promise<WebSearchResult[]> {
  const searchProvider = await getSearchProvider()
  if (!searchProvider) {
    console.error('[webSearch] No search provider configured. Add Tavily API key in Settings > AI Providers.')
    return []
  }

  try {
    const response = await tavilyFetchWithBackoff({
      api_key: searchProvider.apiKey,
      query,
      max_results: Math.min(num, 10),
      search_depth: 'basic',
      include_answer: false,
    })

    if (!response) {
      console.error('[webSearch] Tavily unavailable after retries')
      return []
    }
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

// ─── Web Search — Z.ai SDK (from ai-caller.ts — parallelWebSearch) ───────

/**
 * Search the web using the ZAI SDK. Returns deduplicated results.
 */
export async function sdkWebSearch(query: string, num = 5): Promise<WebSearchResult[]> {
  const zai = await getZAI()
  try {
    const results = await zai.functions.invoke('web_search', { query, num })
    const items = results?.results ?? results?.data ?? results
    if (!Array.isArray(items)) return []

    const seen = new Set<string>()
    return items
      .filter((r: Record<string, unknown>) => r.title || r.url)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ''),
        url: String(r.url ?? ''),
        snippet: String(r.snippet ?? r.description ?? r.content ?? ''),
      }))
      .filter(r => {
        if (seen.has(r.url)) return false
        seen.add(r.url)
        return true
      })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[llm-client] SDK web search failed for "${query}": ${msg}`)
    return []
  }
}

/**
 * Run multiple web searches in parallel via Z.ai SDK and deduplicate by URL.
 */
export async function parallelWebSearch(queries: string[], numPerQuery = 5): Promise<WebSearchResult[]> {
  const batches = await Promise.all(queries.map(q => sdkWebSearch(q, numPerQuery)))
  const seen = new Set<string>()
  const results: WebSearchResult[] = []

  for (const batch of batches) {
    for (const item of batch) {
      if (item.url && !seen.has(item.url)) {
        seen.add(item.url)
        results.push(item)
      }
    }
  }

  return results
}

// ─── Tavily AI Answer (from zai-helpers.ts) ───────────────────────────────

export async function tavilyAIAnswer(query: string): Promise<string> {
  const searchProvider = await getSearchProvider()
  if (!searchProvider) return ''

  try {
    const response = await tavilyFetchWithBackoff({
      api_key: searchProvider.apiKey,
      query,
      max_results: 5,
      search_depth: 'advanced',
      include_answer: true,
    })

    if (!response || !response.ok) return ''

    const data = await response.json()
    return data.answer || ''
  } catch (err) {
    console.warn('[tavilyAIAnswer] failed:', err instanceof Error ? err.message : err)
    return ''
  }
}

// ─── JSON Extraction (from zai-helpers.ts) ──────────────────────────────────

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

// ─── Email Verification (from zai-helpers.ts) ──────────────────────────────

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

// ─── Usage Tracking (from ai-caller.ts) ──────────────────────────────────

async function trackUsage(
  feature: string,
  companyId: string | undefined,
  contactId: string | undefined,
  rawOutput: string,
  latencyMs: number,
  quality?: QualityReport,
  errorMessage?: string,
): Promise<void> {
  try {
    const { logAIUsage } = await import('@/lib/ai-copilot/usage-tracker')
    await logAIUsage({
      feature: feature as any,
      model: 'unknown',
      companyId: companyId ?? null,
      contactId: contactId ?? null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      status: errorMessage ? 'failed' : 'success',
      errorMessage: errorMessage ?? undefined,
    } as any)
  } catch {
    // Usage tracking is best-effort — never throw
  }
}
