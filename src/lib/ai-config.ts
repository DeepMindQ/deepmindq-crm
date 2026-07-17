/**
 * Central AI Provider Configuration Store
 *
 * This module is the single source of truth for all AI API keys and model settings.
 * Keys are resolved in this priority order:
 *   1. Runtime override (set via Settings UI → API → updateAiConfig())
 *   2. Environment variable (process.env.*)
 *   3. Empty string (provider disabled)
 *
 * Both the Settings API and zai-helpers.ts import from here,
 * so any change made in the UI takes effect immediately for
 * all subsequent AI calls — no restart needed.
 */

export interface AIProviderConfig {
  /** Display label */
  label: string;
  /** API key (masked in GET responses) */
  apiKey: string;
  /** Base URL for the API */
  baseUrl: string;
  /** Model identifier */
  model: string;
  /** Is this provider enabled? */
  enabled: boolean;
  /** Free tier note */
  tier: string;
  /** Provider category */
  category: 'llm' | 'search';
}

export interface AIFullConfig {
  providers: Record<string, AIProviderConfig>;
  /** Priority order for LLM fallback chain */
  llmPriority: string[];
  /** Active search provider */
  searchProvider: string;
}

/* ── Default provider definitions ────────────────────────── */

const DEFAULT_PROVIDERS: Record<string, AIProviderConfig> = {
  nvidia: {
    label: 'NVIDIA NIM',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
    enabled: true,
    tier: 'Free credits (~40 RPM)',
    category: 'llm',
  },
  fireworks: {
    label: 'Fireworks AI',
    apiKey: '',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    enabled: true,
    tier: 'Free tier available',
    category: 'llm',
  },
  groq: {
    label: 'Groq',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    enabled: true,
    tier: 'Free tier (may block India)',
    category: 'llm',
  },
  gemini: {
    label: 'Google Gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    enabled: true,
    tier: 'Free tier (may block India)',
    category: 'llm',
  },
  tavily: {
    label: 'Tavily Search',
    apiKey: '',
    baseUrl: 'https://api.tavily.com',
    model: '',
    enabled: true,
    tier: 'Free (1000 searches/mo)',
    category: 'search',
  },
};

const DEFAULT_LLM_PRIORITY = ['nvidia', 'fireworks', 'groq', 'gemini'];
const DEFAULT_SEARCH_PROVIDER = 'tavily';

/* ── In-memory runtime store ─────────────────────────────── */

let runtimeConfig: AIFullConfig = {
  providers: {} as Record<string, AIProviderConfig>,
  llmPriority: [...DEFAULT_LLM_PRIORITY],
  searchProvider: DEFAULT_SEARCH_PROVIDER,
};

/**
 * Initialize the config from environment variables.
 * Called once at module load.
 */
function initFromEnv(): void {
  for (const [key, defaults] of Object.entries(DEFAULT_PROVIDERS)) {
    const envKeyMap: Record<string, string> = {
      nvidia: 'NVIDIA_API_KEY',
      fireworks: 'FIREWORKS_API_KEY',
      groq: 'GROQ_API_KEY',
      gemini: 'GEMINI_API_KEY',
      tavily: 'TAVILY_API_KEY',
    };
    const envKey = envKeyMap[key] || '';
    runtimeConfig.providers[key] = {
      ...defaults,
      apiKey: process.env[envKey] || defaults.apiKey,
    };
  }
}

// Initialize on first import
initFromEnv();

/* ── Public API ─────────────────────────────────────────── */

/**
 * Get the full AI configuration (for Settings UI display).
 * API keys are masked for security.
 */
export function getAIConfig(): AIFullConfig {
  return {
    ...runtimeConfig,
    providers: Object.fromEntries(
      Object.entries(runtimeConfig.providers).map(([k, v]) => [
        k,
        { ...v, apiKey: maskKey(v.apiKey) },
      ])
    ),
  };
}

/**
 * Get the full AI configuration with real keys (for internal use).
 */
export function getAIConfigWithKeys(): AIFullConfig {
  return { ...runtimeConfig };
}

/**
 * Update AI provider configuration (called by Settings API).
 * Accepts partial updates — only provided fields are changed.
 */
export function updateAIConfig(updates: Partial<AIFullConfig>): AIFullConfig {
  if (updates.providers) {
    for (const [key, newConfig] of Object.entries(updates.providers)) {
      const existing = runtimeConfig.providers[key];
      if (existing) {
        // If apiKey is the masked version, don't overwrite the real key
        if (newConfig.apiKey && !newConfig.apiKey.startsWith('•')) {
          existing.apiKey = newConfig.apiKey;
        }
        if (newConfig.model !== undefined) existing.model = newConfig.model;
        if (newConfig.baseUrl !== undefined) existing.baseUrl = newConfig.baseUrl;
        if (newConfig.enabled !== undefined) existing.enabled = newConfig.enabled;
        if (newConfig.label !== undefined) existing.label = newConfig.label;
      }
    }
  }
  if (updates.llmPriority) {
    runtimeConfig.llmPriority = updates.llmPriority;
  }
  if (updates.searchProvider) {
    runtimeConfig.searchProvider = updates.searchProvider;
  }
  return getAIConfig();
}

/**
 * Get a specific provider's real API key.
 * Used by zai-helpers.ts for actual AI calls.
 */
export function getProviderKey(providerId: string): string {
  return runtimeConfig.providers[providerId]?.apiKey || '';
}

/**
 * Get a specific provider's full config.
 */
export function getProviderConfig(providerId: string): AIProviderConfig | undefined {
  return runtimeConfig.providers[providerId];
}

/**
 * Get the LLM fallback chain (enabled providers in priority order).
 */
export function getLLMChain(): AIProviderConfig[] {
  return runtimeConfig.llmPriority
    .filter(id => runtimeConfig.providers[id]?.enabled && runtimeConfig.providers[id]?.apiKey)
    .map(id => runtimeConfig.providers[id]);
}

/**
 * Get the active search provider config.
 */
export function getSearchProvider(): AIProviderConfig | undefined {
  const id = runtimeConfig.searchProvider;
  if (runtimeConfig.providers[id]?.enabled && runtimeConfig.providers[id]?.apiKey) {
    return runtimeConfig.providers[id];
  }
  return undefined;
}

/**
 * Test a provider connection by making a minimal API call.
 */
export async function testProviderConnection(providerId: string): Promise<{ success: boolean; message: string }> {
  const provider = runtimeConfig.providers[providerId];
  if (!provider || !provider.apiKey) {
    return { success: false, message: 'No API key configured' };
  }

  try {
    if (provider.category === 'search' && providerId === 'tavily') {
      // Test Tavily with a minimal search
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: provider.apiKey,
          query: 'test',
          max_results: 1,
        }),
      });
      if (res.ok) {
        return { success: true, message: 'Connection successful' };
      }
      const err = await res.text();
      return { success: false, message: `Error ${res.status}: ${err.slice(0, 100)}` };
    } else {
      // Test LLM providers with a minimal chat completion
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
          temperature: 0,
        }),
      });
      if (res.ok) {
        return { success: true, message: 'Connection successful' };
      }
      const err = await res.text();
      return { success: false, message: `Error ${res.status}: ${err.slice(0, 100)}` };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

/* ── Helpers ────────────────────────────────────────────── */

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
}