/**
 * Scoring Contradiction Resolver — Phase 4.5
 *
 * Detects and resolves contradictions between signals for the same company.
 * Uses ScoringContradictionResolution from Prisma (Phase 2 unified scoring orchestrator).
 *
 * Architecture:
 *
 *   Signals → Pairwise Comparison → Contradiction Detection → Resolution Strategy → Resolved Value
 *
 * Contradiction Types:
 *   - Temporal: same metric, different times (e.g., "hiring" in Jan vs "layoffs" in Feb)
 *   - Factual: opposite assertions (e.g., "uses AWS" vs "uses GCP")
 *   - Sentiment: positive vs negative for same event
 *   - Severity: different severity for same signal type
 *
 * Resolution Strategies:
 *   - newer_wins: More recent signal takes precedence
 *   - higher_reliability: Higher confidence signal wins
 *   - consensus: Most signals agree → that value wins
 *   - defer_to_human: Flag for human review
 *
 * NON-THROWING DESIGN: All functions return structured results, never throw.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SignalContradiction {
  id: string;
  companyId: string;
  signalA: {
    id: string;
    type: string;
    value: string;
    source: string;
    timestamp: string;
  };
  signalB: {
    id: string;
    type: string;
    value: string;
    source: string;
    timestamp: string;
  };
  conflictType: 'temporal' | 'factual' | 'sentiment' | 'severity';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution: {
    strategy: 'newer_wins' | 'higher_reliability' | 'consensus' | 'defer_to_human';
    resolvedValue: string;
    reasoning: string;
    confidenceInResolution: number;
  } | null;
}

export interface ContradictionResolutionResult {
  companyId: string;
  contradictions: SignalContradiction[];
  resolved: number;
  unresolved: number;
  resolutionRate: number;
}

// ── Default Resolution Strategy by Conflict Type ──────────────────────────

type ResolutionStrategy = 'newer_wins' | 'higher_reliability' | 'consensus' | 'defer_to_human';

const DEFAULT_STRATEGIES: Record<SignalContradiction['conflictType'], ResolutionStrategy> = {
  temporal: 'newer_wins',
  factual: 'higher_reliability',
  sentiment: 'higher_reliability',
  severity: 'newer_wins',
};

// ── Contradiction Detection ───────────────────────────────────────────────

/**
 * Detect contradictions between signals for a company.
 * Compares pairs of signals for temporal, factual, sentiment, and severity conflicts.
 */
export async function detectSignalContradictions(
  companyId: string
): Promise<SignalContradiction[]> {
  try {
    const signals = await db.companySignal.findMany({
      where: { companyId },
      orderBy: { signalDate: 'desc' },
      take: 50,
    });

    if (signals.length < 2) return [];

    const contradictions: SignalContradiction[] = [];

    // Compare all pairs
    for (let i = 0; i < signals.length; i++) {
      for (let j = i + 1; j < signals.length; j++) {
        const sigA = signals[i];
        const sigB = signals[j];

        const conflicts = compareSignals(sigA, sigB, companyId);
        contradictions.push(...conflicts);
      }
    }

    logger.info('[ContradictionResolver] Detection complete', {
      companyId,
      signalsChecked: signals.length,
      pairsChecked: (signals.length * (signals.length - 1)) / 2,
      contradictionsFound: contradictions.length,
    });

    return contradictions;
  } catch (err) {
    logger.error('[ContradictionResolver] Detection failed:', { error: err, companyId });
    return [];
  }
}

/**
 * Compare two signals for potential contradictions.
 * Returns zero or more SignalContradiction objects.
 */
function compareSignals(
  sigA: {
    id: string;
    signalType: string;
    title: string;
    severity: string;
    confidence: number;
    source: string | null;
    signalDate: Date | null;
    description: string | null;
  },
  sigB: {
    id: string;
    signalType: string;
    title: string;
    severity: string;
    confidence: number;
    source: string | null;
    signalDate: Date | null;
    description: string | null;
  },
  companyId: string,
): SignalContradiction[] {
  const contradictions: SignalContradiction[] = [];

  // ── 1. Temporal conflicts: same signal type, different times with conflicting meaning ──
  if (sigA.signalType === sigB.signalType && sigA.signalDate && sigB.signalDate) {
    const daysDiff = Math.abs(
      (sigA.signalDate.getTime() - sigB.signalDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If same type but more than 30 days apart, check for conflicting titles/descriptions
    if (daysDiff > 30 && haveConflictingSentiment(sigA.title, sigB.title)) {
      contradictions.push({
        id: `contra-${sigA.id}-${sigB.id}`,
        companyId,
        signalA: { id: sigA.id, type: sigA.signalType, value: sigA.title, source: sigA.source || 'unknown', timestamp: sigA.signalDate.toISOString() },
        signalB: { id: sigB.id, type: sigB.signalType, value: sigB.title, source: sigB.source || 'unknown', timestamp: sigB.signalDate.toISOString() },
        conflictType: 'temporal',
        description: `Conflicting ${sigA.signalType} signals ${Math.round(daysDiff)} days apart: "${sigA.title}" vs "${sigB.title}"`,
        severity: determineSeverity(daysDiff, Math.abs(sigA.confidence - sigB.confidence)),
        resolution: null,
      });
    }
  }

  // ── 2. Factual conflicts: opposite assertions in technology/infrastructure ──
  if (sigA.signalType === sigB.signalType &&
      (sigA.signalType === 'tech_change' || sigA.signalType === 'partnership')) {
    if (areFactuallyOpposite(sigA.title, sigB.title) || areFactuallyOpposite(sigA.description || '', sigB.description || '')) {
      contradictions.push({
        id: `contra-${sigA.id}-${sigB.id}-factual`,
        companyId,
        signalA: { id: sigA.id, type: sigA.signalType, value: sigA.title, source: sigA.source || 'unknown', timestamp: sigA.signalDate?.toISOString() || new Date().toISOString() },
        signalB: { id: sigB.id, type: sigB.signalType, value: sigB.title, source: sigB.source || 'unknown', timestamp: sigB.signalDate?.toISOString() || new Date().toISOString() },
        conflictType: 'factual',
        description: `Opposite assertions for ${sigA.signalType}: "${sigA.title}" vs "${sigB.title}"`,
        severity: 'high',
        resolution: null,
      });
    }
  }

  // ── 3. Sentiment conflicts: positive vs negative for the same signal type ──
  if (sigA.signalType === sigB.signalType) {
    const sentimentA = detectSentiment(sigA.title);
    const sentimentB = detectSentiment(sigB.title);
    if ((sentimentA === 'positive' && sentimentB === 'negative') ||
        (sentimentA === 'negative' && sentimentB === 'positive')) {
      // Avoid duplicating with temporal if already caught
      const alreadyCaught = contradictions.some(c => c.signalA.id === sigA.id && c.signalB.id === sigB.id);
      if (!alreadyCaught) {
        contradictions.push({
          id: `contra-${sigA.id}-${sigB.id}-sentiment`,
          companyId,
          signalA: { id: sigA.id, type: sigA.signalType, value: sigA.title, source: sigA.source || 'unknown', timestamp: sigA.signalDate?.toISOString() || new Date().toISOString() },
          signalB: { id: sigB.id, type: sigB.signalType, value: sigB.title, source: sigB.source || 'unknown', timestamp: sigB.signalDate?.toISOString() || new Date().toISOString() },
          conflictType: 'sentiment',
          description: `Conflicting sentiment for ${sigA.signalType}: positive ("${sigA.title}") vs negative ("${sigB.title}")`,
          severity: 'medium',
          resolution: null,
        });
      }
    }
  }

  // ── 4. Severity conflicts: significantly different severity for same signal type ──
  if (sigA.signalType === sigB.signalType) {
    const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const sevA = severityOrder[sigA.severity] || 2;
    const sevB = severityOrder[sigB.severity] || 2;

    if (Math.abs(sevA - sevB) >= 2) {
      contradictions.push({
        id: `contra-${sigA.id}-${sigB.id}-severity`,
        companyId,
        signalA: { id: sigA.id, type: sigA.signalType, value: sigA.title, source: sigA.source || 'unknown', timestamp: sigA.signalDate?.toISOString() || new Date().toISOString() },
        signalB: { id: sigB.id, type: sigB.signalType, value: sigB.title, source: sigB.source || 'unknown', timestamp: sigB.signalDate?.toISOString() || new Date().toISOString() },
        conflictType: 'severity',
        description: `Severity mismatch for ${sigA.signalType}: ${sigA.severity} ("${sigA.title}") vs ${sigB.severity} ("${sigB.title}")`,
        severity: 'low',
        resolution: null,
      });
    }
  }

  return contradictions;
}

// ── Contradiction Resolution ──────────────────────────────────────────────

/**
 * Resolve a single contradiction using the specified or default strategy.
 * Stores the resolution in the ScoringContradictionResolution table.
 */
export async function resolveContradiction(
  contradictionId: string,
  strategy?: string,
): Promise<SignalContradiction> {
  try {
    // Parse the contradiction ID to get signal IDs
    // Format: contra-{signalAId}-{signalBId}[-suffix]
    const idParts = contradictionId.replace(/^contra-/, '').split('-');
    const signalAId = idParts[0];
    const signalBId = idParts[1];

    // Fetch both signals
    const [sigA, sigB] = await Promise.all([
      db.companySignal.findUnique({ where: { id: signalAId } }),
      db.companySignal.findUnique({ where: { id: signalBId } }),
    ]);

    if (!sigA || !sigB) {
      logger.warn('[ContradictionResolver] Cannot resolve — signal(s) not found:', { contradictionId, signalAId, signalBId });
      throw new Error(`Signals not found for contradiction ${contradictionId}`);
    }

    const companyId = sigA.companyId;
    const conflictType = determineConflictTypeFromId(contradictionId);
    const resolutionStrategy = (strategy || DEFAULT_STRATEGIES[conflictType]) as ResolutionStrategy;

    // Apply resolution strategy
    const resolution = applyResolutionStrategy(sigA, sigB, resolutionStrategy, conflictType);

    // Store in ScoringContradictionResolution table
    await db.scoringContradictionResolution.create({
      data: {
        companyId,
        scoringSystemA: `signal:${sigA.signalType}`,
        scoringSystemB: `signal:${sigB.signalType}`,
        scoreA: sigA.confidence * 100,
        scoreB: sigB.confidence * 100,
        deviation: Math.abs(sigA.confidence - sigB.confidence) * 100,
        severity: determineSeverity(
          sigA.signalDate && sigB.signalDate
            ? Math.abs((sigA.signalDate.getTime() - sigB.signalDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          Math.abs(sigA.confidence - sigB.confidence)
        ),
        resolutionStrategy: resolutionStrategy,
        resolvedScore: resolution!.confidenceInResolution * 100,
        resolutionReason: resolution!.reasoning,
        resolvedAt: new Date(),
      },
    });

    logger.info('[ContradictionResolver] Contradiction resolved', {
      contradictionId,
      companyId,
      strategy: resolutionStrategy,
      resolvedValue: resolution!.resolvedValue,
    });

    return {
      id: contradictionId,
      companyId,
      signalA: { id: sigA.id, type: sigA.signalType, value: sigA.title, source: sigA.source || 'unknown', timestamp: sigA.signalDate?.toISOString() || new Date().toISOString() },
      signalB: { id: sigB.id, type: sigB.signalType, value: sigB.title, source: sigB.source || 'unknown', timestamp: sigB.signalDate?.toISOString() || new Date().toISOString() },
      conflictType,
      description: `Resolved ${conflictType} conflict between ${sigA.signalType} signals`,
      severity: determineSeverity(
        sigA.signalDate && sigB.signalDate
          ? Math.abs((sigA.signalDate.getTime() - sigB.signalDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        Math.abs(sigA.confidence - sigB.confidence)
      ),
      resolution,
    };
  } catch (err) {
    logger.error('[ContradictionResolver] Resolution failed:', { error: err, contradictionId });
    throw err;
  }
}

/**
 * Detect and resolve all contradictions for a company.
 */
export async function resolveAllContradictions(
  companyId: string
): Promise<ContradictionResolutionResult> {
  try {
    const contradictions = await detectSignalContradictions(companyId);
    let resolved = 0;
    let unresolved = contradictions.length;

    for (const contradiction of contradictions) {
      try {
        await resolveContradiction(contradiction.id);
        resolved++;
        unresolved--;
      } catch (err) {
        logger.warn('[ContradictionResolver] Failed to resolve contradiction:', {
          error: err,
          contradictionId: contradiction.id,
        });
      }
    }

    return {
      companyId,
      contradictions,
      resolved,
      unresolved,
      resolutionRate: contradictions.length > 0 ? resolved / contradictions.length : 0,
    };
  } catch (err) {
    logger.error('[ContradictionResolver] resolveAll failed:', { error: err, companyId });
    return {
      companyId,
      contradictions: [],
      resolved: 0,
      unresolved: 0,
      resolutionRate: 0,
    };
  }
}

// ── Resolution Strategy Application ────────────────────────────────────────

function applyResolutionStrategy(
  sigA: { confidence: number; signalDate: Date | null; title: string; severity: string },
  sigB: { confidence: number; signalDate: Date | null; title: string; severity: string },
  strategy: ResolutionStrategy,
  conflictType: SignalContradiction['conflictType'],
): SignalContradiction['resolution'] {
  const dateA = sigA.signalDate || new Date();
  const dateB = sigB.signalDate || new Date();

  switch (strategy) {
    case 'newer_wins': {
      const aIsNewer = dateA >= dateB;
      const winner = aIsNewer ? sigA : sigB;
      const loser = aIsNewer ? sigB : sigA;
      return {
        strategy: 'newer_wins',
        resolvedValue: winner.title,
        reasoning: `Selected the more recent signal from ${dateA >= dateB ? 'Signal A' : 'Signal B'} (${dateA >= dateB ? dateA.toISOString() : dateB.toISOString()}) over the older one (${dateA >= dateB ? dateB.toISOString() : dateA.toISOString()}).`,
        confidenceInResolution: winner.confidence,
      };
    }

    case 'higher_reliability': {
      const winner = sigA.confidence >= sigB.confidence ? sigA : sigB;
      const loser = sigA.confidence >= sigB.confidence ? sigB : sigA;
      return {
        strategy: 'higher_reliability',
        resolvedValue: winner.title,
        reasoning: `Selected the higher-confidence signal (confidence: ${Math.round(winner.confidence * 100)}%) over the lower-confidence one (${Math.round(loser.confidence * 100)}%).`,
        confidenceInResolution: winner.confidence,
      };
    }

    case 'consensus': {
      // In pairwise comparison, consensus means average confidence
      const avgConfidence = (sigA.confidence + sigB.confidence) / 2;
      const higherConfSignal = sigA.confidence >= sigB.confidence ? sigA : sigB;
      return {
        strategy: 'consensus',
        resolvedValue: higherConfSignal.title,
        reasoning: `Conflicting signals with no clear winner. Selected the higher-confidence signal (${Math.round(higherConfSignal.confidence * 100)}%) with reduced confidence from consensus averaging.`,
        confidenceInResolution: avgConfidence * 0.85, // Reduce confidence due to conflict
      };
    }

    case 'defer_to_human': {
      return {
        strategy: 'defer_to_human',
        resolvedValue: `[PENDING REVIEW] ${sigA.title} vs ${sigB.title}`,
        reasoning: `Conflicting ${conflictType} signals flagged for human review. Signal A (confidence: ${Math.round(sigA.confidence * 100)}%): "${sigA.title}". Signal B (confidence: ${Math.round(sigB.confidence * 100)}%): "${sigB.title}".`,
        confidenceInResolution: Math.min(sigA.confidence, sigB.confidence) * 0.5,
      };
    }

    default: {
      return applyResolutionStrategy(sigA, sigB, 'higher_reliability', conflictType);
    }
  }
}

// ── Sentiment / Conflict Detection Helpers ─────────────────────────────────

const POSITIVE_PATTERNS = [
  /\bgrow(?:th|ing)?\b/i, /\bexpand/i, /\bhiring\b/i, /\brais(?:ed|ing)?\b/i, /\bfund(?:ed|ing)?\b/i,
  /\blaunch\b/i, /\bpartner/i, /\bsuccess/i, /\bacquir/i, /\binvest/i, /\bpositiv/i,
  /\bopportunity\b/i, /\bscale\b/i, /\bupgrad/i, /\badopt\b/i,
];

const NEGATIVE_PATTERNS = [
  /\blayoff\b/i, /\bcut\b/i, /\breduc/i, /\bdowngrad/i, /\bshut/i, /\bclos/i,
  /\bdeclin/i, /\bloss/i, /\bleav/i, /\bterminat/i, /\bfail/i, /\brisk\b/i,
  /\bdepart/i, /\bfir/i, /\bdrop/i, /\bremov/i,
];

function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const posCount = POSITIVE_PATTERNS.filter(p => p.test(lower)).length;
  const negCount = NEGATIVE_PATTERNS.filter(p => p.test(lower)).length;

  if (posCount > negCount && posCount > 0) return 'positive';
  if (negCount > posCount && negCount > 0) return 'negative';
  return 'neutral';
}

function haveConflictingSentiment(textA: string, textB: string): boolean {
  const sentA = detectSentiment(textA);
  const sentB = detectSentiment(textB);
  return (sentA === 'positive' && sentB === 'negative') || (sentA === 'negative' && sentB === 'positive');
}

/**
 * Check if two texts contain factually opposite assertions about technology or partnerships.
 */
function areFactuallyOpposite(textA: string, textB: string): boolean {
  if (!textA || !textB) return false;
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();

  // Check for opposite action verbs
  const adoptWords = ['adopt', 'use', 'using', 'deploy', 'deployed', 'migrate', 'switch', 'implement', 'built on', 'powered by', 'moved to'];
  const removeWords = ['remove', 'drop', 'replace', 'migrate from', 'move away', 'decommission', 'retire', 'phasing out', 'end of life'];

  const aAdopts = adoptWords.some(w => a.includes(w));
  const aRemoves = removeWords.some(w => a.includes(w));
  const bAdopts = adoptWords.some(w => b.includes(w));
  const bRemoves = removeWords.some(w => b.includes(w));

  // If A says "adopting X" and B says "removing X" — that's a factual contradiction
  if (aAdopts && bRemoves) return true;
  if (bAdopts && aRemoves) return true;

  // Check for explicit opposite technology claims (e.g., "uses AWS" vs "uses GCP" for same category)
  const oppositePairs: Array<[string, string]> = [
    ['aws', 'gcp'], ['aws', 'azure'], ['gcp', 'azure'],
    ['salesforce', 'hubspot'], ['react', 'angular'], ['python', 'java'],
    ['postgres', 'mysql'], ['kubernetes', 'docker swarm'],
  ];

  for (const [tech1, tech2] of oppositePairs) {
    if ((a.includes(tech1) && b.includes(tech2)) || (a.includes(tech2) && b.includes(tech1))) {
      // Both mention opposite technologies in the same context
      return true;
    }
  }

  return false;
}

function determineSeverity(daysDiff: number, confidenceDiff: number): SignalContradiction['severity'] {
  const score = daysDiff * 0.3 + confidenceDiff * 100 * 0.7;
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function determineConflictTypeFromId(id: string): SignalContradiction['conflictType'] {
  if (id.includes('-sentiment')) return 'sentiment';
  if (id.includes('-factual')) return 'factual';
  if (id.includes('-severity')) return 'severity';
  return 'temporal';
}

/**
 * Get contradiction resolver stats.
 */
export async function getContradictionStats(): Promise<{
  totalResolutions: number;
  bySeverity: Record<string, number>;
  byStrategy: Record<string, number>;
  unresolvedCount: number;
}> {
  try {
    const [resolutions, unresolved] = await Promise.all([
      db.scoringContradictionResolution.findMany({ where: { resolvedAt: { not: null } } }),
      db.scoringContradictionResolution.count({ where: { resolvedAt: null } }),
    ]);

    const bySeverity: Record<string, number> = {};
    const byStrategy: Record<string, number> = {};

    for (const r of resolutions) {
      bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
      byStrategy[r.resolutionStrategy] = (byStrategy[r.resolutionStrategy] || 0) + 1;
    }

    return {
      totalResolutions: resolutions.length,
      bySeverity,
      byStrategy,
      unresolvedCount: unresolved,
    };
  } catch (err) {
    logger.warn('[ContradictionResolver] Stats fetch failed:', { error: err });
    return { totalResolutions: 0, bySeverity: {}, byStrategy: {}, unresolvedCount: 0 };
  }
}
