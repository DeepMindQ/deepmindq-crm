/**
 * Central AI Provider Configuration Store
 *
 * This module is the single source of truth for all AI API keys and model settings.
 * Keys are resolved in this priority order:
 *   1. Runtime override (set via Settings UI → API → updateAiConfig())
 *   2. Environment variable (process.env.*)
 *   3. Empty string (provider disabled)
 *
 * PERSISTENCE: Settings are saved to the SystemSetting DB table.
 * On cold start (Vercel serverless), config is loaded from DB first,
 * then overlaid with env vars for any missing keys.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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

/* ── API Key Encryption ─────────────────────────────────── */
const ENCRYPTION_KEY_ENV = 'ENCRYPTION_KEY';

function getEncryptionKey(): string | null {
  const key = process.env[ENCRYPTION_KEY_ENV];
  if (!key || key.length < 32) return null;
  return key.slice(0, 32); // AES-256 needs 32 bytes
}

async function encrypt(text: string): Promise<string> {
  const key = getEncryptionKey();
  if (!key) return text; // No encryption key = store as-is (dev mode)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoder.encode(text));
  // Combine iv + ciphertext as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(combined).toString('base64');
}

async function decrypt(encryptedText: string): Promise<string> {
  const key = getEncryptionKey();
  if (!key) return encryptedText; // Not encrypted
  try {
    const combined = Buffer.from(encryptedText, 'base64');
    const iv = combined.subarray(0, 12);
    const ciphertext = combined.subarray(12);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, treat as plaintext (backward compatibility for existing unencrypted values)
    return encryptedText;
  }
}

const AI_CONFIG_KEY = 'ai_config';

/* ── In-memory runtime store ─────────────────────────────── */

let runtimeConfig: AIFullConfig | null = null;
let dbLoaded = false;

/**
 * Build the initial config from defaults + env vars.
 * This is always the base layer.
 */
function buildFromDefaultsAndEnv(): AIFullConfig {
  const config: AIFullConfig = {
    providers: {} as Record<string, AIProviderConfig>,
    llmPriority: [...DEFAULT_LLM_PRIORITY],
    searchProvider: DEFAULT_SEARCH_PROVIDER,
  };

  const envKeyMap: Record<string, string> = {
    nvidia: 'NVIDIA_API_KEY',
    fireworks: 'FIREWORKS_API_KEY',
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    tavily: 'TAVILY_API_KEY',
  };

  for (const [key, defaults] of Object.entries(DEFAULT_PROVIDERS)) {
    const envKey = envKeyMap[key] || '';
    config.providers[key] = {
      ...defaults,
      apiKey: process.env[envKey] || defaults.apiKey,
    };
  }

  return config;
}

/**
 * Ensure config is loaded. Tries DB first, falls back to defaults+env.
 */
async function ensureLoaded(): Promise<void> {
  if (dbLoaded && runtimeConfig) return;

  // Start with defaults + env vars as base
  runtimeConfig = buildFromDefaultsAndEnv();

  // Try to load from DB
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: AI_CONFIG_KEY },
    });
    if (setting?.value) {
      const saved = JSON.parse(setting.value) as Partial<AIFullConfig>;
      // Overlay DB values on top of defaults (preserves env var base)
      if (saved.providers) {
        for (const [key, savedProvider] of Object.entries(saved.providers)) {
          if (runtimeConfig.providers[key] && savedProvider) {
            const sp = savedProvider as Partial<AIProviderConfig>;
            // Only update fields that were explicitly saved (not empty defaults)
            if (sp.apiKey && !sp.apiKey.startsWith('•')) {
              runtimeConfig.providers[key].apiKey = await decrypt(sp.apiKey);
            }
            if (sp.model) runtimeConfig.providers[key].model = sp.model;
            if (sp.baseUrl) runtimeConfig.providers[key].baseUrl = sp.baseUrl;
            if (sp.enabled !== undefined) runtimeConfig.providers[key].enabled = sp.enabled;
            if (sp.label) runtimeConfig.providers[key].label = sp.label;
          }
        }
      }
      if (saved.llmPriority) {
        runtimeConfig.llmPriority = saved.llmPriority;
      }
      if (saved.searchProvider) {
        runtimeConfig.searchProvider = saved.searchProvider;
      }
    }
  } catch {
    // DB not available yet (first deploy) — use defaults + env
  }

  dbLoaded = true;
}

/**
 * Initialize synchronously from env vars for fast cold start.
 * DB load happens lazily on first real use.
 */
function initFromEnv(): void {
  runtimeConfig = buildFromDefaultsAndEnv();
  dbLoaded = false;
}

// Initialize synchronously from env on module load
initFromEnv();

/* ── Public API ─────────────────────────────────────────── */

/**
 * Get the full AI configuration (for Settings UI display).
 * API keys are masked for security.
 */
export async function getAIConfig(): Promise<AIFullConfig> {
  await ensureLoaded();
  const cfg = runtimeConfig!;
  return {
    ...cfg,
    providers: Object.fromEntries(
      Object.entries(cfg.providers).map(([k, v]) => [
        k,
        { ...v, apiKey: maskKey(v.apiKey) },
      ])
    ),
  };
}

/**
 * Get the full AI configuration with real keys (for internal use).
 */
export async function getAIConfigWithKeys(): Promise<AIFullConfig> {
  await ensureLoaded();
  return { ...runtimeConfig! };
}

/**
 * Update AI provider configuration (called by Settings API).
 * Persists to DB so it survives cold starts.
 * Accepts partial updates — only provided fields are changed.
 */
export async function updateAIConfig(updates: Partial<AIFullConfig>): Promise<AIFullConfig> {
  await ensureLoaded();

  if (updates.providers) {
    for (const [key, newConfig] of Object.entries(updates.providers)) {
      const existing = runtimeConfig!.providers[key];
      if (existing && newConfig) {
        // If apiKey is the masked version, don't overwrite the real key
        if (newConfig.apiKey && !newConfig.apiKey.startsWith('•')) {
          existing.apiKey = newConfig.apiKey;
        }
        if (newConfig.model !== undefined) existing.model = newConfig.model;
        if (newConfig.baseUrl !== undefined) {
          // Validate baseUrl — only allow known AI provider domains
          const ALLOWED_BASE_URL_PATTERNS = [
            /^https:\/\/integrate\.api\.nvidia\.com/,
            /^https:\/\/api\.fireworks\.ai/,
            /^https:\/\/api\.groq\.com/,
            /^https:\/\/generativelanguage\.googleapis\.com/,
            /^https:\/\/api\.tavily\.com/,
            /^https:\/\/api\.openai\.com/,
          ];
          if (newConfig.baseUrl && !ALLOWED_BASE_URL_PATTERNS.some(p => p.test(newConfig.baseUrl))) {
            logger.warn(`[ai-config] Rejected baseUrl for ${key}: ${newConfig.baseUrl} (not in allowlist)`);
            continue; // Skip this provider update
          }
          existing.baseUrl = newConfig.baseUrl;
        }
        if (newConfig.enabled !== undefined) existing.enabled = newConfig.enabled;
        if (newConfig.label !== undefined) existing.label = newConfig.label;
      }
    }
  }
  if (updates.llmPriority) {
    runtimeConfig!.llmPriority = updates.llmPriority;
  }
  if (updates.searchProvider) {
    runtimeConfig!.searchProvider = updates.searchProvider;
  }

  // Persist to DB (fire-and-forget, don't block the response)
  try {
    // Encrypt API keys before persisting to DB
    const configToSave: AIFullConfig = { ...runtimeConfig! };
    for (const [k, provider] of Object.entries(configToSave.providers)) {
      if (provider.apiKey && !provider.apiKey.startsWith('•')) {
        configToSave.providers[k] = { ...provider, apiKey: await encrypt(provider.apiKey) };
      }
    }
    await db.systemSetting.upsert({
      where: { key: AI_CONFIG_KEY },
      update: { value: JSON.stringify(configToSave) },
      create: { key: AI_CONFIG_KEY, value: JSON.stringify(configToSave) },
    });
  } catch {
    // Log but don't fail — in-memory still works
    logger.warn('[ai-config] Failed to persist to DB');
  }

  return {
    ...runtimeConfig!,
    providers: Object.fromEntries(
      Object.entries(runtimeConfig!.providers).map(([k, v]) => [
        k,
        { ...v, apiKey: maskKey(v.apiKey) },
      ])
    ),
  };
}

/**
 * Get a specific provider's real API key.
 * Used by llm-client.ts for actual AI calls.
 */
export async function getProviderKey(providerId: string): Promise<string> {
  await ensureLoaded();
  return runtimeConfig!.providers[providerId]?.apiKey || '';
}

/**
 * Get a specific provider's full config.
 */
export async function getProviderConfig(providerId: string): Promise<AIProviderConfig | undefined> {
  await ensureLoaded();
  return runtimeConfig!.providers[providerId];
}

/**
 * Get the LLM fallback chain (enabled providers in priority order).
 */
export async function getLLMChain(): Promise<AIProviderConfig[]> {
  await ensureLoaded();
  return runtimeConfig!.llmPriority
    .filter(id => runtimeConfig!.providers[id]?.enabled && runtimeConfig!.providers[id]?.apiKey)
    .map(id => runtimeConfig!.providers[id]);
}

/**
 * Get the active search provider config.
 */
export async function getSearchProvider(): Promise<AIProviderConfig | undefined> {
  await ensureLoaded();
  const id = runtimeConfig!.searchProvider;
  if (runtimeConfig!.providers[id]?.enabled && runtimeConfig!.providers[id]?.apiKey) {
    return runtimeConfig!.providers[id];
  }
  return undefined;
}

/**
 * Test a provider connection by making a minimal API call.
 */
export async function testProviderConnection(providerId: string): Promise<{ success: boolean; message: string }> {
  await ensureLoaded();
  const provider = runtimeConfig!.providers[providerId];
  if (!provider || !provider.apiKey) {
    return { success: false, message: 'No API key configured' };
  }

  try {
    if (provider.category === 'search' && providerId === 'tavily') {
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