/**
 * AI Configuration — Provider Chain
 *
 * Reads LLM provider configuration from environment variables and returns
 * an ordered chain of providers for failover. This unlocks the multi-provider
 * routing already built into llm-client.ts.
 *
 * Provider configuration priority:
 *   1. OPENAI_API_KEY  → OpenAI (gpt-4o-mini default)
 *   2. ANTHROPIC_API_KEY → Anthropic (claude-3.5-sonnet)
 *   3. GEMINI_API_KEY  → Google Gemini (gemini-2.0-flash)
 *   4. Custom OPENAI_BASE_URL → self-hosted / Azure OpenAI
 *   5. Z.ai SDK fallback (always available)
 *
 * Search provider:
 *   TAVILY_API_KEY → Tavily web search
 */

interface LLMProviderEntry {
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
}

interface SearchProviderConfig {
  apiKey: string;
  provider: string;
}

/**
 * Returns ordered provider chain for LLM failover.
 * Each entry has baseUrl, apiKey, model, label.
 * Returns empty array if no providers are configured (Z.ai SDK will be used).
 */
export function getLLMChain(): LLMProviderEntry[] | null {
  const chain: LLMProviderEntry[] = [];

  // 1. OpenAI (or compatible — supports Azure / self-hosted via OPENAI_BASE_URL)
  const openaiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (openaiKey) {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    chain.push({
      baseUrl,
      apiKey: openaiKey,
      model,
      label: 'OpenAI',
    });
  }

  // 2. Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    chain.push({
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      label: 'Anthropic',
    });
  }

  // 3. Google Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    chain.push({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      label: 'Gemini',
    });
  }

  return chain.length > 0 ? chain : null;
}

/**
 * Returns the search provider configuration.
 * Currently supports Tavily. Falls back to 'none' if no key is configured.
 */
export function getSearchProvider(): SearchProviderConfig | string {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    return {
      apiKey: tavilyKey,
      provider: 'tavily',
    };
  }

  return 'none';
}
