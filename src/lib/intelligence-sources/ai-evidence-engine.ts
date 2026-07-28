/**
 * Phase 2B — AI Evidence Engine
 *
 * Drop-in replacement for the rule-based evidence-classifier.
 * Uses LLM to classify evidence with superior accuracy and nuance.
 *
 * Architecture: Same interface (ClassifiedSignal), better classification.
 * Fallback: If LLM call fails, falls back to rule-based classifier.
 *
 * Zero dependency on downstream code — the Intelligence Object never
 * knows or cares how classification happened.
 */

import {
  classifyEvidence as ruleClassifyEvidence,
  type ClassifiedSignal,
  type RawEvidenceInput,
} from './evidence-classifier';

// ─── LLM Classification ─────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intelligence analyst for a B2B sales platform. Classify raw evidence into structured signals.

Signal types: funding, hiring, leadership_change, people_change, expansion, tech_change, technology_adoption, partnership, acquisition, news

Respond in JSON only:
{
  "signalType": "type",
  "confidence": 0.0-1.0,
  "severity": "low|medium|high|critical",
  "businessImpact": "Why this matters for B2B sales (1-2 sentences)",
  "recommendedAction": "What a salesperson should do (1-2 sentences)",
  "timingWindow": "immediate|within_7_days|within_14_days|within_21_days|within_30_days",
  "meaningCategory": "budget_available|growth_pressure|leadership_openness|organizational_shift|tech_dissatisfaction|vendor_evaluation"
}`;

async function classifyWithLLM(evidence: RawEvidenceInput): Promise<ClassifiedSignal | null> {
  try {
    const { getZAI } = await import('@/lib/ai-copilot/ai-caller');
    const zai = await getZAI();

    const userMessage = `Classify:\nHeadline: ${evidence.headline}\nSnippet: ${evidence.snippet}\nSource: ${evidence.sourceName || 'unknown'}\nURL: ${evidence.sourceUrl || 'unknown'}`;

    const response = await zai.chat.completions.create({
      model: 'default',
      messages: [
        { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.signalType || typeof parsed.confidence !== 'number') return null;

    return {
      signalType: parsed.signalType,
      title: evidence.headline,
      description: evidence.snippet,
      confidence: Math.min(0.99, Math.max(0.1, parsed.confidence)),
      severity: ['low', 'medium', 'high', 'critical'].includes(parsed.severity) ? parsed.severity : 'medium',
      businessImpact: parsed.businessImpact || 'Evidence classified via AI analysis',
      recommendedAction: parsed.recommendedAction || 'Further analysis recommended',
      timingWindow: parsed.timingWindow || 'within_30_days',
      meaningCategory: parsed.meaningCategory || 'growth_pressure',
    };
  } catch (error) {
    console.error('[ai-evidence-engine] LLM classification failed, falling back to rules:', error);
    return null;
  }
}

// ─── Public API (drop-in replacement) ────────────────────────────

/**
 * Classify evidence using AI with rule-based fallback.
 * Phase 2B: Try LLM first, fall back to rules if LLM fails.
 */
export async function classifyEvidenceWithAI(evidence: RawEvidenceInput): Promise<ClassifiedSignal | null> {
  const aiResult = await classifyWithLLM(evidence);
  if (aiResult) return aiResult;
  return ruleClassifyEvidence(evidence);
}

/**
 * Batch classify with AI. Sequential to avoid rate limits.
 */
export async function batchClassifyEvidenceWithAI(items: RawEvidenceInput[]): Promise<ClassifiedSignal[]> {
  const results: ClassifiedSignal[] = [];
  for (const item of items) {
    const classified = await classifyEvidenceWithAI(item);
    if (classified) results.push(classified);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return results;
}

// Re-export for backward compatibility
export { ruleClassifyEvidence as classifyEvidenceRule };
