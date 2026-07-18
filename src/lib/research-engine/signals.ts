/**
 * Signal Detection — Research Intelligence Engine (Phase 3)
 *
 * Analyzes web search results for buying signals:
 * funding, hiring, leadership change, expansion, technology, product, partnership.
 *
 * Each signal is stored with:
 * - Type classification
 * - Impact assessment (high/medium/low on sales opportunity)
 * - Confidence score
 * - Links to supporting evidence
 * - Signal date (when the event happened, not when we found it)
 */

import { db } from '@/lib/db';
import { callLLM, extractJSON, type NewsSignal } from '@/lib/zai-helpers';

// ── Types ──

export interface DetectedSignal {
  signalType: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  impact: 'high' | 'medium' | 'low';
  severity: 'high' | 'medium' | 'low';
  signalDate: string | null; // ISO date of the event
  confidence: number; // 0-1
  evidenceSnippet: string; // the snippet that triggered this signal
}

export interface SignalDetectionResult {
  signals: DetectedSignal[];
  signalCount: number;
  highImpactCount: number;
}

// ── Signal Detection ──

/**
 * Analyze search results for buying signals using LLM.
 * Returns structured signals with impact assessment.
 */
export async function detectSignals(
  companyName: string,
  snippets: Array<{ title: string; snippet: string; url: string; source: string }>,
): Promise<SignalDetectionResult> {
  if (snippets.length === 0) {
    return { signals: [], signalCount: 0, highImpactCount: 0 };
  }

  const context = snippets.slice(0, 25).map((s, i) =>
    `[${i + 1}] ${s.title}\n${s.snippet}\nSource: ${s.source} (${s.url})`
  ).join('\n\n');

  const systemPrompt = `You are a B2B sales intelligence analyst specializing in buying signal detection.

Analyze the news/search results about "${companyName}" and identify buying signals that indicate sales opportunity.

SIGNAL TYPES:
- funding: New funding round, investment, valuation change
- hiring: Significant hiring (especially in IT, sales, new departments)
- leadership_change: New CEO, CTO, VP hire, executive departure
- expansion: New office, new market, new product line
- technology: Tech stack change, new platform adoption, cloud migration
- product: New product launch, feature release, beta program
- partnership: Strategic partnership, integration, channel partnership

IMPACT ASSESSMENT:
- high: Direct buying signal (e.g., "raised $50M to expand", "hiring VP of Sales", "migrating to cloud")
- medium: Indirect signal (e.g., general growth, new office in adjacent market)
- low: Tangential (e.g., minor news, general industry trend)

For each signal, also estimate when the event occurred (signalDate) if mentioned.

Return ONLY valid JSON array:
[{
  "signalType": "funding|hiring|leadership_change|expansion|technology|product|partnership",
  "title": "concise signal headline",
  "description": "1-2 sentence explanation of the signal and why it matters",
  "source": "source publication",
  "sourceUrl": "url or empty",
  "impact": "high|medium|low",
  "severity": "high|medium|low",
  "signalDate": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0,
  "evidenceIndex": <index of the source snippet from the input, 0-based>
}]

Maximum 10 signals. Only include signals clearly supported by the results. Empty array if none found.`;

  const userPrompt = `Company: ${companyName}\n\nSearch Results:\n${context}`;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    const parsed = extractJSON(response);

    if (Array.isArray(parsed)) {
      const signals: DetectedSignal[] = (parsed as Record<string, unknown>[])
        .map((s, i) => {
          const evidenceIndex = typeof s.evidenceIndex === 'number' ? s.evidenceIndex : -1;
          const evidenceSnippet = evidenceIndex >= 0 && evidenceIndex < snippets.length
            ? snippets[evidenceIndex].snippet
            : '';

          return {
            signalType: (['funding', 'hiring', 'leadership_change', 'expansion', 'technology', 'product', 'partnership'].includes(String(s.signalType))
              ? String(s.signalType) : 'expansion') as string,
            title: String(s.title || ''),
            description: String(s.description || ''),
            source: String(s.source || 'web_search'),
            sourceUrl: String(s.sourceUrl || ''),
            impact: (['high', 'medium', 'low'].includes(String(s.impact))
              ? String(s.impact) : 'medium') as 'high' | 'medium' | 'low',
            severity: (['high', 'medium', 'low'].includes(String(s.severity))
              ? String(s.severity) : 'medium') as 'high' | 'medium' | 'low',
            signalDate: s.signalDate ? String(s.signalDate) : null,
            confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.6,
            evidenceSnippet,
          };
        })
        .filter(s => s.title && s.description);

      return {
        signals,
        signalCount: signals.length,
        highImpactCount: signals.filter(s => s.impact === 'high').length,
      };
    }
  } catch (err) {
    console.error('[signals] LLM signal detection failed:', err instanceof Error ? err.message : err);
  }

  // Fallback: rule-based signal detection from snippets
  return ruleBasedSignalDetection(companyName, snippets);
}

/**
 * Store detected signals in the database.
 * Deduplicates against existing signals for the same company.
 * Returns the IDs of newly created signals.
 */
export async function storeSignals(
  companyId: string,
  signals: DetectedSignal[],
  jobId: string | null,
): Promise<string[]> {
  if (signals.length === 0) return [];

  // Get existing signal titles for dedup
  const existing = await db.companySignal.findMany({
    where: { companyId },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map(s => s.title.toLowerCase()));

  const newSignals = signals.filter(s => !existingTitles.has(s.title.toLowerCase()));

  if (newSignals.length === 0) return [];

  // Find supporting evidence IDs
  const evidenceRecords = await db.evidence.findMany({
    where: {
      companyId,
      snippet: { in: newSignals.map(s => s.evidenceSnippet).filter(Boolean) },
    },
    select: { id: true, snippet: true },
  });

  const snippetToEvidenceId = new Map<string, string>();
  for (const e of evidenceRecords) {
    if (e.snippet) snippetToEvidenceId.set(e.snippet.slice(0, 100), e.id);
  }

  const created = await db.companySignal.createMany({
    data: newSignals.map(s => {
      const evidenceId = s.evidenceSnippet
        ? snippetToEvidenceId.get(s.evidenceSnippet.slice(0, 100))
        : null;
      return {
        companyId,
        signalType: s.signalType,
        title: s.title,
        description: s.description,
        source: s.source,
        sourceUrl: s.sourceUrl || null,
        severity: s.severity,
        impact: s.impact,
        signalDate: s.signalDate ? new Date(s.signalDate) : null,
        confidence: s.confidence,
        evidenceIds: JSON.stringify(evidenceId ? [evidenceId] : []),
      };
    }),
  });

  // Add timeline events for high-impact signals
  const highImpactSignals = newSignals.filter(s => s.impact === 'high');
  if (highImpactSignals.length > 0) {
    await db.companyTimelineEvent.createMany({
      data: highImpactSignals.map(s => ({
        companyId,
        eventType: 'signal',
        title: `Signal: ${s.title}`,
        description: s.description,
        metadata: JSON.stringify({ signalType: s.signalType, impact: s.impact, confidence: s.confidence }),
      })),
    });
  }

  // Log count of created signals (createMany doesn't return IDs)
  return newSignals.map((_, i) => `signal_${i}`);
}

// ── Rule-Based Fallback ──

function ruleBasedSignalDetection(
  companyName: string,
  snippets: Array<{ title: string; snippet: string; url: string; source: string }>,
): SignalDetectionResult {
  const signals: DetectedSignal[] = [];
  const lowerName = companyName.toLowerCase();

  const patterns: Array<{
    type: string;
    regex: RegExp;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }> = [
    { type: 'funding', regex: /\$[\d,.]+[BMK]?\s*(series|funding|investment|raised|valuation)/i, impact: 'high', description: 'Funding activity detected' },
    { type: 'hiring', regex: /hiring|(looking for|seeking)\s+\d+\s+(engineers|developers|sales|people)/i, impact: 'medium', description: 'Significant hiring activity' },
    { type: 'leadership_change', regex: /(new|appointed|named)\s+(CEO|CTO|CFO|COO|CMO|VP|president|head)/i, impact: 'high', description: 'Leadership change detected' },
    { type: 'expansion', regex: /(expand|opening|launch|new office|new market|new location)/i, impact: 'medium', description: 'Business expansion detected' },
    { type: 'technology', regex: /(migrat|adopt|implement|deploy|launch)\s+(cloud|AI|ML|data|platform|kubernetes|aws|azure)/i, impact: 'medium', description: 'Technology adoption signal' },
    { type: 'partnership', regex: /(partner|integrat|collaborat)\s+(with|and)/i, impact: 'medium', description: 'Partnership signal detected' },
  ];

  for (const s of snippets) {
    const combined = `${s.title} ${s.snippet}`.toLowerCase();
    if (!combined.includes(lowerName.split(' ')[0])) continue; // must mention company

    for (const pattern of patterns) {
      if (pattern.regex.test(combined)) {
        signals.push({
          signalType: pattern.type,
          title: `${pattern.type}: ${s.title}`,
          description: `${pattern.description}. Source: ${s.source}`,
          source: s.source,
          sourceUrl: s.url,
          impact: pattern.impact,
          severity: pattern.impact,
          signalDate: null,
          confidence: 0.5,
          evidenceSnippet: s.snippet,
        });
        break; // one signal per snippet
      }
    }
  }

  return {
    signals: signals.slice(0, 8),
    signalCount: signals.length,
    highImpactCount: signals.filter(s => s.impact === 'high').length,
  };
}

// ── Re-export for backward compat ──
export type { NewsSignal };