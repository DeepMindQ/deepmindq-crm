/**
 * Phase 7.6: Account Intelligence Brief Generator
 *
 * Produces a holistic, executive-ready AccountBrief for a company by
 * combining deterministic signal extraction, account scoring, and
 * knowledge-fabric data.  LLM is used ONLY for the executive summary
 * and engagement approach narrative — everything else is rule-based.
 *
 * Critical invariant: the system MUST always return a brief, even if
 * every LLM provider is down.  Template fallbacks guarantee this.
 */

import { db } from '@/lib/db';
import { detectSignalsForCompany, getSignalsForCompany } from './signal-extraction';
import { calculateAccountScore } from './account-scoring';
import {
  generateExecutiveSummary,
  generateEngagementApproach,
} from './llm-helper';
import { ALL_CATEGORIES, FRESHNESS_CONFIG } from '@/lib/intelligence-sources';
import { getCompanyKnowledge } from '@/lib/intelligence-sources/knowledge-fabric';

// ─── Exported Interface ──────────────────────────────────────────

/** Structured representation of an Account Intelligence Brief. */
export interface BriefData {
  company: { id: string; rawName: string; industry: string | null; domain: string | null };
  accountHealth: string;
  keySignals: Array<{ signal: string; type: string; confidence: number }>;
  themes: Array<{ name: string; description: string; evidenceIds: string[] }>;
  recentChanges: Array<{ change: string; date: Date; source: string }>;
  opportunityAreas: string[];
  risks: string[];
  evidenceReferences: Array<{ evidenceId: string; snippet: string }>;
  confidence: number;
  summary: string;
  recommendedEngagement: string;
}

// ─── Internal Constants ──────────────────────────────────────────

/** Mapping from detected signal types to human-readable opportunity areas. */
const SIGNAL_TYPE_TO_OPPORTUNITY: Record<string, string> = {
  technology: 'AI/Data Services',
  growth: 'Growth Advisory',
  partnership: 'Strategic Partnerships',
  leadership: 'Executive Advisory',
  pain: 'Transformation Consulting',
};

/** Mapping from account score category to health label. */
const CATEGORY_TO_HEALTH: Record<string, string> = {
  HOT_ACCOUNT: 'high',
  WARM_ACCOUNT: 'medium',
  NURTURE: 'low',
  AT_RISK: 'low',
};

/** Intelligence statuses considered active / usable for brief generation. */
const ACTIVE_STATUSES = ['active', 'new', 'processing', 'stale'] as const;

/** Timeline event types considered system-generated (excluded from recentChanges). */
const SYSTEM_EVENT_TYPES = new Set([
  'connector_run',
  'alert_triggered',
  'alert_resolved',
  'source_health_changed',
  'confidence_updated',
]);

// ─── Internal Helpers ────────────────────────────────────────────

/**
 * Truncate a string to a maximum length, appending "\u2026" if truncated.
 */
function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '\u2026';
}

/**
 * Compute the average originalConfidence across intelligence objects.
 * Returns 0 when the array is empty.
 */
function averageConfidence(
  objects: Array<{ originalConfidence: number }>,
): number {
  if (objects.length === 0) return 0;
  const sum = objects.reduce((acc, o) => acc + o.originalConfidence, 0);
  return Math.round((sum / objects.length) * 1000) / 1000;
}

/**
 * Build a deterministic fallback executive summary when the LLM is
 * unavailable or returns an empty string.
 */
function buildFallbackSummary(
  companyName: string,
  industry: string | null,
  signalCount: number,
  themeCount: number,
  opportunityAreas: string[],
  lifecycleStage: string,
): string {
  const isActive =
    lifecycleStage === 'proposal' ||
    lifecycleStage === 'negotiation' ||
    lifecycleStage === 'closed';
  const statusLabel = isActive ? 'active' : 'monitored';
  const areas =
    opportunityAreas.length > 0
      ? ` Key opportunity areas include ${opportunityAreas.slice(0, 3).join(', ')}.`
      : '';

  return `${companyName} is ${statusLabel} in ${industry ?? 'an unspecified industry'}. ${signalCount} intelligence signal${signalCount !== 1 ? 's' : ''} detected across ${themeCount} categor${themeCount !== 1 ? 'ies' : 'y'}.${areas}`;
}

/**
 * Build a deterministic fallback engagement approach when the LLM is
 * unavailable or returns an empty string.
 */
function buildFallbackEngagement(
  opportunityAreas: string[],
  topSignalTitle: string,
): string {
  const topArea = opportunityAreas[0] ?? 'general advisory';
  return `Engage around ${topArea}. Recent intelligence shows ${topSignalTitle}.`;
}

// ─── Main Functions ─────────────────────────────────────────────

/**
 * Generate a full Account Intelligence Brief for a company.
 *
 * This is the primary entry point.  The process is:
 * 1. Gather all intelligence data (deterministic)
 * 2. Build structured context: health, signals, themes, risks, etc. (deterministic)
 * 3. Generate LLM narrative for summary & engagement (with template fallbacks)
 * 4. Persist the brief via upsert
 * 5. Return the persisted AccountBrief record
 *
 * @param companyId   - The Prisma Company ID to generate a brief for.
 * @param generatedBy - Optional identifier of who/what triggered generation.
 * @returns The persisted AccountBrief database record.
 * @throws {Error} If the company does not exist.
 */
export async function generateBrief(
  companyId: string,
  generatedBy: string = 'system',
) {
  // ────────────────────────────────────────────────────────────────
  // Step 1a: Gather intelligence data (all deterministic)
  // ────────────────────────────────────────────────────────────────

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      rawName: true,
      industry: true,
      domain: true,
      lifecycleStage: true,
    },
  });

  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Fetch active intelligence objects (limit 50, newest first)
  const intelObjects = await db.intelligenceObject.findMany({
    where: {
      companyId,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { capturedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      content: true,
      originalConfidence: true,
      evidenceId: true,
    },
  });

  // Fetch knowledge entries grouped by category
  const { grouped: knowledgeGrouped } = await getCompanyKnowledge(companyId);

  // Detect signals (do NOT persist)
  const detectedSignals = await detectSignalsForCompany(companyId);

  // Calculate account score (do NOT persist)
  const scoreResult = await calculateAccountScore(companyId);

  // Fetch recent timeline events (last 20)
  const timelineEvents = await db.intelligenceTimeline.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      title: true,
      eventType: true,
      createdAt: true,
      actor: true,
    },
  });

  // Fetch evidence records linked to the intelligence objects
  const evidenceIds = intelObjects
    .map((o) => o.evidenceId)
    .filter((id): id is string => id !== null);

  const evidenceRecords =
    evidenceIds.length > 0
      ? await db.evidence.findMany({
          where: { id: { in: evidenceIds } },
          select: {
            id: true,
            extractedValue: true,
            snippet: true,
          },
          take: 10,
        })
      : [];

  // ────────────────────────────────────────────────────────────────
  // Step 1b: Build structured context (deterministic)
  // ────────────────────────────────────────────────────────────────

  // accountHealth
  const accountHealth = CATEGORY_TO_HEALTH[scoreResult.category] ?? 'unknown';

  // keySignals — top 6 detected signals
  const keySignals = detectedSignals.slice(0, 6).map((s) => ({
    signal: s.title,
    type: s.signalType,
    confidence: Math.round(s.confidence * 1000) / 1000,
  }));

  // themes — grouped by knowledge category
  const themes: Array<{
    name: string;
    description: string;
    evidenceIds: string[];
  }> = [];
  for (const [category, entries] of Object.entries(knowledgeGrouped)) {
    if (!entries || entries.length === 0) continue;
    const firstEntry = entries[0];
    // Collect intelligenceObjectIds from entries that have them
    const entryEvidenceIds = entries
      .map((e) => e.intelligenceObjectId)
      .filter((id): id is string => id !== null);
    themes.push({
      name: category,
      description: truncate(firstEntry.content, 200),
      evidenceIds: entryEvidenceIds,
    });
  }

  // recentChanges — last 5 non-system timeline events
  const recentChanges = timelineEvents
    .filter((ev) => !SYSTEM_EVENT_TYPES.has(ev.eventType))
    .slice(0, 5)
    .map((ev) => ({
      change: ev.title,
      date: ev.createdAt,
      source: ev.actor ?? 'system',
    }));

  // opportunityAreas — derived from detected signal types, deduplicated, max 5
  const opportunityAreaSet = new Set<string>();
  for (const signal of detectedSignals) {
    const area = SIGNAL_TYPE_TO_OPPORTUNITY[signal.signalType];
    if (area) opportunityAreaSet.add(area);
    if (opportunityAreaSet.size >= 5) break;
  }
  const opportunityAreas = Array.from(opportunityAreaSet).slice(0, 5);

  // risks — from pain-category signals and knowledge entries with risk keywords
  const riskItems: string[] = [];
  const RISK_KEYWORDS = ['risk', 'challenge', 'concern'];

  // Extract from pain-category signals
  for (const signal of detectedSignals) {
    if (signal.signalType === 'pain' && riskItems.length < 5) {
      riskItems.push(signal.title);
    }
  }

  // Extract from knowledge entries containing risk keywords
  if (riskItems.length < 5) {
    for (const entries of Object.values(knowledgeGrouped)) {
      if (!entries) continue;
      for (const entry of entries) {
        if (riskItems.length >= 5) break;
        const contentLower = entry.content.toLowerCase();
        if (RISK_KEYWORDS.some((kw) => contentLower.includes(kw))) {
          const item = truncate(entry.content, 120);
          if (!riskItems.includes(item)) {
            riskItems.push(item);
          }
        }
      }
      if (riskItems.length >= 5) break;
    }
  }

  const risks =
    riskItems.length > 0
      ? riskItems
      : ['Insufficient intelligence data for risk assessment'];

  // evidenceReferences — from fetched evidence records, max 10
  const evidenceReferences = evidenceRecords.slice(0, 10).map((ev) => ({
    evidenceId: ev.id,
    snippet: truncate(ev.extractedValue || ev.snippet, 150),
  }));

  // confidence — average of all intelligence objects' originalConfidence
  const confidence = averageConfidence(intelObjects);

  // ────────────────────────────────────────────────────────────────
  // Step 1c: LLM narrative generation (with fallback)
  // ────────────────────────────────────────────────────────────────

  const structuredContext = JSON.stringify({
    companyName: company.rawName,
    industry: company.industry,
    keySignals: keySignals.map((s) => s.signal),
    themes: themes.map((t) => t.name),
    opportunityAreas,
    evidenceSnippets: evidenceReferences.slice(0, 3).map((e) => e.snippet),
  });

  // Executive summary
  let summary = await generateExecutiveSummary(structuredContext);
  if (!summary || summary.trim().length === 0) {
    summary = buildFallbackSummary(
      company.rawName,
      company.industry,
      detectedSignals.length,
      themes.length,
      opportunityAreas,
      company.lifecycleStage,
    );
  }

  // Engagement approach
  let recommendedEngagement = await generateEngagementApproach(
    structuredContext,
  );
  if (!recommendedEngagement || recommendedEngagement.trim().length === 0) {
    const topSignalTitle =
      keySignals.length > 0
        ? keySignals[0].signal
        : 'no recent signals detected';
    recommendedEngagement = buildFallbackEngagement(
      opportunityAreas,
      topSignalTitle,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Step 1d: Persist (upsert on companyId)
  // ────────────────────────────────────────────────────────────────

  const persisted = await db.accountBrief.upsert({
    where: { companyId },
    create: {
      companyId,
      summary,
      accountHealth,
      keySignals: JSON.stringify(keySignals),
      themes: JSON.stringify(themes),
      recentChanges: JSON.stringify(recentChanges),
      opportunityAreas: JSON.stringify(opportunityAreas),
      risks: JSON.stringify(risks),
      recommendedEngagement,
      evidenceReferences: JSON.stringify(evidenceReferences),
      confidence,
      generatedBy,
    },
    update: {
      summary,
      accountHealth,
      keySignals: JSON.stringify(keySignals),
      themes: JSON.stringify(themes),
      recentChanges: JSON.stringify(recentChanges),
      opportunityAreas: JSON.stringify(opportunityAreas),
      risks: JSON.stringify(risks),
      recommendedEngagement,
      evidenceReferences: JSON.stringify(evidenceReferences),
      confidence,
      generatedBy,
    },
  });

  // ────────────────────────────────────────────────────────────────
  // Step 1e: Return the persisted AccountBrief
  // ────────────────────────────────────────────────────────────────

  return persisted;
}

/**
 * Retrieve an existing AccountBrief for a company.
 *
 * Returns null if no brief has been generated yet.  The caller
 * decides whether to trigger a fresh generation.
 *
 * @param companyId - The Prisma Company ID.
 * @returns The AccountBrief record, or null if none exists.
 */
export async function getBrief(companyId: string) {
  return db.accountBrief.findUnique({
    where: { companyId },
  });
}

/**
 * Get an existing AccountBrief, or generate a fresh one if it is
 * missing or stale (older than 24 hours).
 *
 * This is the recommended entry point for UI components that want
 * to display a brief without unnecessary regeneration.
 *
 * @param companyId - The Prisma Company ID.
 * @returns A current AccountBrief record.
 */
export async function getOrCreateBrief(companyId: string) {
  const existing = await getBrief(companyId);

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (
    existing &&
    existing.generatedAt &&
    now - new Date(existing.generatedAt).getTime() < TWENTY_FOUR_HOURS_MS
  ) {
    return existing;
  }

  return generateBrief(companyId);
}