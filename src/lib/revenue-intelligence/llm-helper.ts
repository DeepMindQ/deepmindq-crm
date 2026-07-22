/**
 * Phase 7.6: Internal LLM Helper for Revenue Intelligence
 *
 * Lightweight LLM calls for narrative generation ONLY.
 * Facts, signals, scores, confidence are ALL determined by deterministic logic.
 * LLM only converts structured facts into executive language.
 *
 * Uses the same provider chain as the rest of the app (via ai-config.ts).
 * NOT governed by ai-governance.ts since this is internal analytics,
 * not customer-facing AI generation.
 */

import { getLLMChain } from '@/lib/ai-config';

const GEMINI_FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'];

async function callProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 2048 }),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Call LLM with system + user prompt. Returns empty string on failure (never throws).
 * This is intentional — revenue intelligence must work without LLM.
 */
export async function revenueLLMCall(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const chain = await getLLMChain();
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    for (const provider of chain) {
      try {
        if (provider.label.includes('Gemini')) {
          for (const m of GEMINI_FALLBACK_MODELS) {
            try { return await callProvider(provider.baseUrl, provider.apiKey, m, messages); }
            catch { continue; }
          }
          continue;
        }
        return await callProvider(provider.baseUrl, provider.apiKey, provider.model, messages);
      } catch { continue; }
    }
    return '';
  } catch {
    return '';
  }
}

const BRIEF_SYSTEM = `You are a revenue intelligence analyst. Your job is to convert STRUCTURED FACTS into a concise executive summary.

CRITICAL RULES:
- Only use the facts provided. Do NOT invent, assume, or hallucinate any information.
- Do not add any facts not present in the input.
- Write in a professional, executive tone (2-4 sentences).
- Focus on what the facts mean for business opportunity.
- Do not mention confidence scores or technical details in the narrative.`;

const ENGAGEMENT_SYSTEM = `You are a revenue intelligence analyst. Convert STRUCTURED FACTS about a company's signals into a recommended engagement approach.

CRITICAL RULES:
- Only reference signals and facts explicitly provided.
- Do NOT invent or assume any information.
- Be specific about WHAT to discuss, not WHO to contact (no specific names/titles).
- Write 1-3 sentences, action-oriented.
- Good: "Engage technology leadership to discuss AI modernization opportunities."
- Bad: "Contact CIO John Smith at jsmith@company.com."`;

export async function generateExecutiveSummary(structuredContext: string): Promise<string> {
  return revenueLLMCall(BRIEF_SYSTEM, structuredContext);
}

export async function generateEngagementApproach(structuredContext: string): Promise<string> {
  return revenueLLMCall(ENGAGEMENT_SYSTEM, structuredContext);
}
