/**
 * Unified AI Caller — Centralized LLM Access with Quality Gates
 *
 * Wave 8A: Every AI route MUST use this caller instead of direct SDK access.
 * Provides:
 *   - Single point of SDK initialization
 *   - Automatic usage tracking (AIGenerationAudit)
 *   - Quality gate integration
 *   - Retry with backoff
 *   - Timeout protection
 *   - Structured prompt/response logging
 */

import type { ZAIInstance } from './types'
import { runQualityGates, formatQualityReportForLog } from './quality-gates'
import type { QualityReport } from './quality-gates'

// ── SDK Singleton ──────────────────────────────────────────────────────

let _zaiInstance: ZAIInstance | null = null
let _zaiCreatedAt = 0
const SDK_INSTANCE_TTL_MS = 5 * 60 * 1000 // Recreate SDK instance every 5 min

/**
 * Get or create a ZAI SDK instance. Singleton with TTL.
 * This avoids creating a new SDK client for every API call.
 */
export async function getZAI(): Promise<ZAIInstance> {
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

/**
 * Reset the SDK singleton (for testing or error recovery)
 */
export function resetZAI(): void {
  _zaiInstance = null
  _zaiCreatedAt = 0
}

// ── Core Functions ───────────────────────────────────────────────────

interface CallAIOptions {
  /** System prompt (required) */
  systemPrompt: string
  /** User prompt (required) */
  userPrompt: string
  /** Feature name for usage tracking */
  feature: string
  /** Company ID for usage tracking (optional) */
  companyId?: string
  /** Contact ID for usage tracking (optional) */
  contactId?: string
  /** Max retries on failure (default: 2) */
  maxRetries?: number
  /** Timeout in ms (default: 60000) */
  timeoutMs?: number
  /** Whether to run quality gates on the response (default: true) */
  runQualityCheck?: boolean
  /** Previous human accuracy verdict for quality gates */
  previousVerdict?: boolean
}

interface CallAIResult {
  /** The raw LLM response text */
  raw: string
  /** Parsed JSON if the response was valid JSON (null otherwise) */
  parsed: Record<string, unknown> | null
  /** Quality gate report (if runQualityCheck enabled) */
  quality?: QualityReport
  /** Whether the call succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Latency in ms */
  latencyMs: number
}

/**
 * Call the LLM with quality gates, usage tracking, and retry logic.
 *
 * This is the PRIMARY function that all AI routes should use.
 */
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
        // Not JSON — that's ok, raw text response
      }

      // Run quality gates on parsed output
      let quality: QualityReport | undefined
      if (runQualityCheck && parsed) {
        quality = runQualityGates(parsed, previousVerdict)
        console.log(formatQualityReportForLog(quality))

        if (quality.overallStatus === 'fail') {
          console.warn(`[ai-caller] Quality gate FAILED for feature="${feature}". Score: ${quality.overallScore}`)
        }
      }

      // Track usage (fire and forget)
      trackUsage(feature, companyId, contactId, raw, latencyMs, quality).catch(() => {})

      return {
        raw,
        parsed,
        quality,
        success: true,
        latencyMs,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error(`[ai-caller] Attempt ${attempt + 1}/${maxRetries + 1} failed for feature="${feature}": ${lastError}`)

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        resetZAI() // Reset SDK on failure for fresh connection
      }
    }
  }

  const latencyMs = Date.now() - startTime

  // Track failed usage
  trackUsage(feature, companyId, contactId, '', latencyMs, undefined, lastError).catch(() => {})

  return {
    raw: '',
    parsed: null,
    success: false,
    error: lastError,
    latencyMs,
  }
}

// ── Web Search Wrapper ────────────────────────────────────────────────

interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Search the web using the ZAI SDK. Returns deduplicated results.
 */
export async function webSearch(query: string, num = 5): Promise<WebSearchResult[]> {
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
    console.error(`[ai-caller] Web search failed for "${query}": ${msg}`)
    return []
  }
}

/**
 * Run multiple web searches in parallel and deduplicate by URL.
 */
export async function parallelWebSearch(queries: string[], numPerQuery = 5): Promise<WebSearchResult[]> {
  const batches = await Promise.all(queries.map(q => webSearch(q, numPerQuery)))
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

// ── Usage Tracking ─────────────────────────────────────────────────────

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
    const { logAIUsage } = await import('./usage-tracker')
    await logAIUsage({
      feature: feature as any, // usage tracker accepts string feature names
      model: 'unknown', // SDK doesn't expose model name
      companyId: companyId ?? null,
      contactId: contactId ?? null,
      promptTokens: 0, // SDK doesn't expose token counts
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0, // SDK doesn't expose cost
      status: errorMessage ? 'failed' : 'success',
      errorMessage: errorMessage ?? undefined,
    } as any)
  } catch {
    // Usage tracking is best-effort — never throw
  }
}
