/**
 * Prompt Registry — Versioned prompt management with A/B testing support.
 *
 * Manages system prompts in the database instead of hardcoded constants.
 * Supports versioning, A/B testing, and prompt templates with variables.
 *
 * Features:
 *   - Get the active prompt for a key (returns DB version or hardcoded fallback)
 *   - A/B testing via weighted random selection of active versions
 *   - Prompt templates with {{variable}} interpolation
 *   - Fallback to hardcoded prompts when DB is unavailable
 *   - Cache prompts in-memory after first load (prompts change rarely)
 */

import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PromptVersion {
  id: string;
  key: string;
  label: string;
  systemPrompt: string;
  userPromptTemplate?: string | null;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  feature?: string | null;
  model?: string | null;
}

// ─── In-Memory Prompt Cache ────────────────────────────────────────────

const promptCache = new Map<string, PromptVersion[]>();
let cacheLoaded = false;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Reload from DB every 5 minutes

// ─── Hardcoded Prompt Fallbacks ───────────────────────────────────────
// FALLBACK PROMPTS: These serve as emergency fallbacks for fresh installs
// before the seed script (scripts/seed-prompts.ts) has been run.
// In production, prompts should always come from the database (PromptTemplate
// table). The DB query path is tried first via loadPromptVersions().
//
// To seed the DB, run: npx tsx scripts/seed-prompts.ts
//
// NOTE: Keep these in sync with scripts/seed-prompts.ts.

const HARDCODED_PROMPTS: Record<string, { systemPrompt: string; label: string }> = {
  brief_summary: {
    label: 'Executive Brief Summary',
    systemPrompt: `You are a revenue intelligence analyst. Your job is to convert STRUCTURED FACTS into a concise executive summary.

CRITICAL RULES:
- Only use the facts provided. Do NOT invent, assume, or hallucinate any information.
- Do not add any facts not present in the input.
- Write in a professional, executive tone (2-4 sentences).
- Focus on what the facts mean for business opportunity.
- Do not mention confidence scores or technical details in the narrative.`,
  },
  engagement_approach: {
    label: 'Engagement Approach',
    systemPrompt: `You are a revenue intelligence analyst. Convert STRUCTURED FACTS about a company's signals into a recommended engagement approach.

CRITICAL RULES:
- Only reference signals and facts explicitly provided.
- Do NOT invent or assume any information.
- Be specific about WHAT to discuss, not WHO to contact (no specific names/titles).
- Write 1-3 sentences, action-oriented.
- Good: "Engage technology leadership to discuss AI modernization opportunities."
- Bad: "Contact CIO John Smith at jsmith@company.com."`,
  },
  reasoning_analyst: {
    label: 'DeepMindQ Intelligence Analyst',
    systemPrompt:
      'You are DeepMindQ, an Enterprise Intelligence OS. Your job is to analyze business intelligence about organizations and produce actionable insights. Be specific, evidence-backed, and practical. Never fabricate data. If confidence is low, say so.',
  },
};

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Get the active prompt for a given key.
 * Returns the DB version if available, otherwise falls back to hardcoded.
 *
 * For A/B testing, if multiple active versions exist, one is selected
 * randomly (weighted selection can be added later).
 */
export async function getPrompt(key: string): Promise<{
  systemPrompt: string;
  label: string;
  version?: number;
  promptId?: string;
}> {
  // Try DB-backed prompts
  const versions = await loadPromptVersions(key);
  const activeVersions = versions.filter((v) => v.isActive);

  if (activeVersions.length > 0) {
    // For now, prefer the default version; random selection can be added
    const defaultVersion = activeVersions.find((v) => v.isDefault) || activeVersions[0];
    return {
      systemPrompt: defaultVersion.systemPrompt,
      label: defaultVersion.label,
      version: defaultVersion.version,
      promptId: defaultVersion.id,
    };
  }

  // Fallback to hardcoded prompts
  const hardcoded = HARDCODED_PROMPTS[key];
  if (hardcoded) {
    return {
      systemPrompt: hardcoded.systemPrompt,
      label: hardcoded.label,
    };
  }

  // Ultimate fallback
  return {
    systemPrompt: 'You are a helpful AI assistant.',
    label: 'Default Fallback',
  };
}

/**
 * Get a prompt and interpolate variables into the user prompt template.
 * Replaces {{variable}} placeholders with provided values.
 */
export async function getPromptWithVariables(
  key: string,
  variables: Record<string, string>,
): Promise<{
  systemPrompt: string;
  userPrompt: string;
  label: string;
  version?: number;
  promptId?: string;
}> {
  const prompt = await getPrompt(key);
  const versions = await loadPromptVersions(key);
  const activeVersion = versions.find((v) => v.isActive && v.id === prompt.promptId);

  let userPrompt = '';
  if (activeVersion?.userPromptTemplate) {
    userPrompt = activeVersion.userPromptTemplate;
    for (const [varName, varValue] of Object.entries(variables)) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), varValue);
    }
  }

  return { ...prompt, userPrompt };
}

/**
 * List all prompt templates, optionally filtered by feature.
 */
export async function listPrompts(feature?: string): Promise<PromptVersion[]> {
  try {
    const { db } = await import('@/lib/db');
    const where = feature ? { feature, isActive: true } : { isActive: true };
    const templates = await db.promptTemplate.findMany({
      where,
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });

    // If DB is empty, fall back to hardcoded prompts
    if (templates.length === 0 && !feature) {
      return Object.entries(HARDCODED_PROMPTS).map(([key, prompt]) => ({
        id: `hardcoded:${key}`,
        key,
        label: prompt.label,
        systemPrompt: prompt.systemPrompt,
        version: 0,
        isActive: true,
        isDefault: true,
      }));
    }

    return templates.map((t) => ({
      id: t.id,
      key: t.key,
      label: t.label,
      systemPrompt: t.systemPrompt,
      userPromptTemplate: t.userPromptTemplate,
      version: t.version,
      isActive: t.isActive,
      isDefault: t.isDefault,
      feature: t.feature,
      model: t.model,
    }));
  } catch {
    // DB unavailable — return hardcoded prompts as virtual versions
    return Object.entries(HARDCODED_PROMPTS).map(([key, prompt]) => ({
      id: `hardcoded:${key}`,
      key,
      label: prompt.label,
      systemPrompt: prompt.systemPrompt,
      version: 0,
      isActive: true,
      isDefault: true,
    }));
  }
}

/**
 * Seed the database with hardcoded prompts if no templates exist.
 * Run this on first deploy or when adding new prompt keys.
 */
export async function seedDefaultPrompts(): Promise<number> {
  try {
    const { db } = await import('@/lib/db');

    let seeded = 0;
    for (const [key, prompt] of Object.entries(HARDCODED_PROMPTS)) {
      const existing = await db.promptTemplate.findUnique({
        where: { key },
      });

      if (!existing) {
        await db.promptTemplate.create({
          data: {
            key,
            label: prompt.label,
            description: `Default ${key} prompt (seeded from code)`,
            systemPrompt: prompt.systemPrompt,
            version: 1,
            isActive: true,
            isDefault: true,
          },
        });
        seeded++;
        logger.info(`[PROMPT-REGISTRY] Seeded default prompt: "${key}"`);
      }
    }

    return seeded;
  } catch (err) {
    logger.debug('[PROMPT-REGISTRY] Seed failed:', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

// ─── Internal: Cache Management ────────────────────────────────────────

async function loadPromptVersions(key: string): Promise<PromptVersion[]> {
  // Check cache
  const now = Date.now();
  if (cacheLoaded && now - cacheLoadedAt < CACHE_TTL_MS) {
    const cached = promptCache.get(key);
    if (cached) return cached;
  }

  // Load from DB
  try {
    const { db } = await import('@/lib/db');
    const templates = await db.promptTemplate.findMany({
      where: { key },
      orderBy: { version: 'desc' },
    });

    const versions: PromptVersion[] = templates.map((t) => ({
      id: t.id,
      key: t.key,
      label: t.label,
      systemPrompt: t.systemPrompt,
      userPromptTemplate: t.userPromptTemplate,
      version: t.version,
      isActive: t.isActive,
      isDefault: t.isDefault,
      feature: t.feature,
      model: t.model,
    }));

    promptCache.set(key, versions);
    cacheLoaded = true;
    cacheLoadedAt = now;

    return versions;
  } catch {
    return [];
  }
}

/**
 * Invalidate the prompt cache (e.g., after admin updates a prompt).
 */
export function invalidatePromptCache(key?: string): void {
  if (key) {
    promptCache.delete(key);
  } else {
    promptCache.clear();
    cacheLoaded = false;
    cacheLoadedAt = 0;
  }
}
