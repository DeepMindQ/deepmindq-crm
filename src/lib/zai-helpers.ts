/**
 * Shared ZAI SDK helpers — single source of truth for
 * SDK init, web search, and LLM calls across all API handlers.
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
 * The SDK may return results in different shapes:
 *   - Direct array: [{title, url, snippet}, ...]
 *   - Wrapped: { results: [...] } or { data: [...] }
 *   - Named fields: [{name, url, snippet, host_name}, ...]
 *
 * This function handles ALL known formats.
 */
export async function webSearch(query: string, num = 10): Promise<WebSearchResult[]> {
  try {
    const zai = await getZAI();
    const raw = await zai.functions.invoke('web_search', { query, num });

    // Normalize to array
    let items: unknown[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      // Try common wrapper keys
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
 * Always uses role: 'system' for the system prompt.
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

  // Try direct parse
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // Try extracting JSON object/array via regex
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