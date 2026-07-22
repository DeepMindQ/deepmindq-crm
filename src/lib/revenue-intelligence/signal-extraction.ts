/**
 * Phase 7.6: Signal Extraction
 *
 * 100 % deterministic buying-signal detection.
 * Scans IntelligenceObjects for known keywords and scores the matches
 * using a weighted formula (freshness, source confidence, importance,
 * frequency).  No LLM — pure keyword matching and arithmetic.
 */

import { db } from '@/lib/db';
import {
  KEYWORD_TO_CATEGORY,
  SIGNAL_SCORING_WEIGHTS,
  IMPORTANCE_WEIGHTS,
} from './signal-patterns';
import type { SignalCategory } from './signal-patterns';
import { FRESHNESS_CONFIG, SOURCE_RELIABILITY } from '@/lib/intelligence-sources';
import type { SourceType } from '@/lib/intelligence-sources';

// ─── Exported Interfaces ──────────────────────────────────────────

/** A signal detected from one or more intelligence objects (not yet persisted). */
export interface DetectedSignal {
  /** The signal category (growth, technology, leadership, partnership, pain). */
  signalType: SignalCategory;
  /** Human-readable title, e.g. "AI investment detected". */
  title: string;
  /** Short content snippet from the originating intelligence object. */
  description: string;
  /** The keyword / phrase that triggered the match. */
  matchedPattern: string;
  /** IDs of all IntelligenceObjects that contributed to this signal. */
  sourceIntelligenceIds: string[];
  /** Composite score 0–100. */
  score: number;
  /** Confidence 0–1 derived from freshness and source reliability. */
  confidence: number;
  /** How many intelligence objects contained this signal type. */
  frequency: number;
}

/** Aggregated signal statistics for a company. */
export interface SignalSummary {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  avgScore: number;
  maxScore: number;
  topSignals: Array<{ id: string; signalType: string; title: string; score: number }>;
}

// ─── Internal Helpers ─────────────────────────────────────────────

/** Maximum number of days before intelligence is considered fully stale (fallback). */
const DEFAULT_MAX_DAYS = 90;

/** Accepted statuses when querying intelligence for signal detection. */
const QUERYABLE_STATUSES: string[] = ['new', 'processing', 'active', 'stale'];

/** Accepted statuses for OpportunitySignal updates. */
const VALID_SIGNAL_STATUSES = ['NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED'] as const;

/**
 * Look up the max-days freshness window for a source type.
 * Falls back to `DEFAULT_MAX_DAYS` when the source type is not
 * present in `FRESHNESS_CONFIG`.
 */
function getMaxDays(sourceType: string): number {
  return FRESHNESS_CONFIG[sourceType] ?? DEFAULT_MAX_DAYS;
}

/**
 * Compute the freshness score (0–100).
 *
 * @param capturedAt - When the intelligence was captured (may be null).
 * @param sourceType  - The source kind, used to look up the max-days window.
 */
function computeFreshness(capturedAt: Date | null, sourceType: string): number {
  if (!capturedAt) return 30;

  const maxDays = getMaxDays(sourceType);
  const daysElapsed =
    (Date.now() - new Date(capturedAt).getTime()) / (1000 * 60 * 60 * 24);
  const ratio = Math.max(0, 1 - daysElapsed / maxDays);
  return ratio * 100;
}

/**
 * Compute source confidence (0–100) from the static reliability table.
 */
function computeSourceConfidence(sourceType: string): number {
  const reliability = SOURCE_RELIABILITY[sourceType as SourceType] ?? 0.5;
  return reliability * 100;
}

/**
 * Compute signal importance (0–100) based on the keyword's importance level.
 */
function computeSignalImportance(importance: number): number {
  const weight = IMPORTANCE_WEIGHTS[importance] ?? 0.5;
  return weight * 100;
}

/**
 * Compute signal frequency (0–100).
 * Normalises against a cap of 5 occurrences so that 5+ mentions ≈ 100.
 */
function computeSignalFrequency(count: number): number {
  return Math.min(count / 5, 1) * 100;
}

/**
 * Build a single searchable text blob from an intelligence object's
 * content, summary, and metadata fields.
 */
function buildSearchText(
  content: string,
  summary: string | null,
  metadataJson: string | null
): string {
  const parts: string[] = [content];

  if (summary) parts.push(summary);

  if (metadataJson) {
    try {
      const meta = JSON.parse(metadataJson) as {
        category?: string;
        title?: string;
        tags?: string[];
      };
      if (meta.title) parts.push(meta.title);
      if (meta.category) parts.push(meta.category);
      if (Array.isArray(meta.tags)) parts.push(meta.tags.join(' '));
    } catch {
      // Non-parseable metadata — skip gracefully.
    }
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Truncate a string to a maximum length, appending "…" if truncated.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Generate a human-readable title for a detected signal.
 */
function buildTitle(signalType: SignalCategory, matchedKeyword: string): string {
  const titles: Record<SignalCategory, string> = {
    growth: 'Growth signal detected',
    technology: 'Technology signal detected',
    leadership: 'Leadership change detected',
    partnership: 'Partnership signal detected',
    pain: 'Pain point identified',
  };
  return `${titles[signalType]}: ${matchedKeyword}`;
}

// ─── Public Functions ─────────────────────────────────────────────

/**
 * Detect buying signals for a company by scanning all queryable
 * IntelligenceObjects for known keywords.
 *
 * The algorithm is fully deterministic:
 * 1.  Fetch intelligence objects with a queryable status.
 * 2.  Build a searchable text blob for each object.
 * 3.  For every keyword in `KEYWORD_TO_CATEGORY`, check for a
 *     case-insensitive substring match.
 * 4.  Score each match with the weighted formula.
 * 5.  Deduplicate by (signalType + matchedKeyword), keeping the
 *     highest-scoring match and accumulating source IDs.
 *
 * @returns Detected signals **before** persistence.
 */
export async function detectSignalsForCompany(
  companyId: string
): Promise<DetectedSignal[]> {
  const objects = await db.intelligenceObject.findMany({
    where: {
      companyId,
      status: { in: QUERYABLE_STATUSES },
    },
    select: {
      id: true,
      content: true,
      summary: true,
      metadata: true,
      sourceType: true,
      capturedAt: true,
      originalConfidence: true,
    },
  });

  if (objects.length === 0) return [];

  // ── Phase 1: find every (object, keyword) match ──────────────

  interface RawMatch {
    objectId: string;
    signalType: SignalCategory;
    keyword: string;
    importance: number;
    content: string;
    sourceType: string;
    capturedAt: Date | null;
  }

  const matches: RawMatch[] = [];

  for (const obj of objects) {
    const searchText = buildSearchText(
      obj.content ?? '',
      obj.summary,
      obj.metadata as string | null
    );

    for (const [keyword, info] of KEYWORD_TO_CATEGORY) {
      if (searchText.includes(keyword.toLowerCase())) {
        matches.push({
          objectId: obj.id,
          signalType: info.category,
          keyword,
          importance: info.importance,
          content: obj.content ?? '',
          sourceType: obj.sourceType ?? '',
          capturedAt: obj.capturedAt,
        });
      }
    }
  }

  if (matches.length === 0) return [];

  // ── Phase 2: count frequency per signalType ───────────────────

  const frequencyByType = new Map<string, number>();
  for (const m of matches) {
    frequencyByType.set(m.signalType, (frequencyByType.get(m.signalType) ?? 0) + 1);
  }

  // ── Phase 3: score & deduplicate ─────────────────────────────

  /** Key = `${signalType}::${keyword}` */
  const best = new Map<string, DetectedSignal>();

  for (const m of matches) {
    const freshness = computeFreshness(m.capturedAt, m.sourceType);
    const sourceConfidence = computeSourceConfidence(m.sourceType);
    const importance = computeSignalImportance(m.importance);
    const frequency = computeSignalFrequency(
      frequencyByType.get(m.signalType) ?? 1
    );

    const score =
      freshness * SIGNAL_SCORING_WEIGHTS.freshness +
      sourceConfidence * SIGNAL_SCORING_WEIGHTS.sourceConfidence +
      importance * SIGNAL_SCORING_WEIGHTS.signalImportance +
      frequency * SIGNAL_SCORING_WEIGHTS.signalFrequency;

    const confidence = Math.min(
      1,
      Math.max(0, (freshness / 100 + sourceConfidence / 100) / 2)
    );

    const key = `${m.signalType}::${m.keyword}`;
    const existing = best.get(key);

    if (!existing || score > existing.score) {
      best.set(key, {
        signalType: m.signalType,
        title: buildTitle(m.signalType, m.keyword),
        description: truncate(m.content, 300),
        matchedPattern: m.keyword,
        sourceIntelligenceIds: [m.objectId],
        score,
        confidence,
        frequency: frequencyByType.get(m.signalType) ?? 1,
      });
    } else {
      // Accumulate source IDs but keep the higher-scoring entry
      if (!existing.sourceIntelligenceIds.includes(m.objectId)) {
        existing.sourceIntelligenceIds.push(m.objectId);
      }
    }
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score);
}

/**
 * Persist detected signals as `OpportunitySignal` records.
 *
 * Any existing **NEW** signals for the same company are deleted first
 * so that re-detection produces a clean slate.  Signals that have
 * already been REVIEWED, ACTIONED, or DISMISSED are left untouched.
 *
 * @returns The count of created records and the records themselves.
 */
export async function persistSignals(
  companyId: string,
  signals: DetectedSignal[]
): Promise<{ created: number; signals: any[] }> {
  // Clean slate: remove only NEW signals for this company
  await db.opportunitySignal.deleteMany({
    where: { companyId, status: 'NEW' },
  });

  if (signals.length === 0) {
    return { created: 0, signals: [] };
  }

  const created = await db.opportunitySignal.createMany({
    data: signals.map((s) => ({
      companyId,
      signalType: s.signalType,
      title: s.title,
      description: s.description,
      matchedPattern: s.matchedPattern,
      sourceIntelligenceIds: JSON.stringify(s.sourceIntelligenceIds),
      score: Math.round(s.score * 100) / 100,
      confidence: Math.round(s.confidence * 1000) / 1000,
      status: 'NEW',
    })),
  });

  const persisted = await db.opportunitySignal.findMany({
    where: { companyId, status: 'NEW' },
    orderBy: { score: 'desc' },
  });

  return { created: created.count, signals: persisted };
}

/**
 * Convenience helper: detect signals for a company and immediately
 * persist them.  Equivalent to calling `detectSignalsForCompany`
 * followed by `persistSignals`.
 *
 * @returns The count of created records and the persisted records.
 */
export async function detectAndPersistSignals(
  companyId: string
): Promise<{ created: number; signals: any[] }> {
  const detected = await detectSignalsForCompany(companyId);
  return persistSignals(companyId, detected);
}

/**
 * Retrieve persisted signals for a company with optional filters.
 *
 * Results are ordered by score descending, then by creation date
 * descending (most recent first).
 */
export async function getSignalsForCompany(
  companyId: string,
  filters?: { signalType?: string; status?: string; minScore?: number }
): Promise<any[]> {
  const where: Record<string, unknown> = { companyId };

  if (filters?.signalType) {
    where.signalType = filters.signalType;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.minScore !== undefined && filters.minScore !== null) {
    where.score = { gte: filters.minScore };
  }

  return db.opportunitySignal.findMany({
    where,
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Transition a signal to a new status.
 *
 * @throws Error if the requested status is not in the allowed set.
 */
export async function updateSignalStatus(
  signalId: string,
  status: string
): Promise<any> {
  const upper = status.toUpperCase();

  if (!VALID_SIGNAL_STATUSES.includes(upper as (typeof VALID_SIGNAL_STATUSES)[number])) {
    throw new Error(
      `Invalid signal status "${status}". Must be one of: ${VALID_SIGNAL_STATUSES.join(', ')}`
    );
  }

  return db.opportunitySignal.update({
    where: { id: signalId },
    data: { status: upper, updatedAt: new Date() },
  });
}

/**
 * Produce an aggregated signal summary for a company.
 *
 * Includes total count, breakdowns by type and status, average /
 * maximum score, and the top 5 signals by score.
 */
export async function getCompanySignalSummary(
  companyId: string
): Promise<SignalSummary> {
  const signals = await db.opportunitySignal.findMany({
    where: { companyId },
    orderBy: { score: 'desc' },
  });

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalScore = 0;
  let maxScore = 0;

  for (const s of signals) {
    byType[s.signalType] = (byType[s.signalType] ?? 0) + 1;
    const st = s.status as string;
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    totalScore += s.score;
    if (s.score > maxScore) maxScore = s.score;
  }

  const topSignals = signals.slice(0, 5).map((s) => ({
    id: s.id,
    signalType: s.signalType as string,
    title: s.title as string,
    score: s.score as number,
  }));

  return {
    total: signals.length,
    byType,
    byStatus,
    avgScore: signals.length > 0 ? Math.round((totalScore / signals.length) * 100) / 100 : 0,
    maxScore,
    topSignals,
  };
}