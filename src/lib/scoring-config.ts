/* ═══════════════════════════════════════════════════════════════
   Scoring Configuration — centralized, configurable scoring weights,
   tier thresholds, signal recency window, and sub-dimension weights.

   Fixes: GAP-20 (hardcoded 40/40/20 dimension weights + sub-dim
   weights), GAP-21 (hardcoded tier thresholds), GAP-22 (hardcoded
   30-day recency), GAP-26 (score change event emitter).

   Config is persisted in the SystemSetting table under the key
   'scoring_config' as a JSON string. Falls back to defaults when
   no stored config exists.

   This module is the single source of truth for ALL scoring weights
   used by the account-prioritization engine. The scoring engine
   calls `getScoringConfig()` (async) to load weights; for sync
   contexts, `getCachedScoringConfig()` returns the last-loaded
   config (initialised to defaults on first import).
   ═══════════════════════════════════════════════════════════════ */

import { db } from '@/lib/db';

// ── Types ──

/** Top-level dimension weights (must sum to 1.0) */
export interface ScoringWeights {
  staticFit: number;            // default 0.40
  dynamicIntelligence: number;  // default 0.40
  timingUrgency: number;        // default 0.20
}

/** Tier classification thresholds */
export interface TierThresholds {
  hot: number;    // default 90
  active: number; // default 70
  nurture: number; // default 50
}

/** Sub-dimension weights for Dynamic Intelligence (must sum to 1.0) */
export interface DynamicIntelSubWeights {
  intelligenceScore: number;  // default 0.30
  researchDepth: number;      // default 0.25
  signalQuality: number;      // default 0.25
  contactCoverage: number;    // default 0.20
}

/** Sub-dimension weights for Timing / Urgency (must sum to 1.0) */
export interface TimingUrgencySubWeights {
  signalRecency: number;       // default 0.40
  engagementRecency: number;   // default 0.35
  growthIndicator: number;     // default 0.25
}

export interface ScoringConfig {
  weights: ScoringWeights;
  tierThresholds: TierThresholds;
  signalRecencyDays: number; // default 30
  subDimensionWeights: {
    dynamicIntelligence: DynamicIntelSubWeights;
    timingUrgency: TimingUrgencySubWeights;
  };
}

// ── Defaults ──

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    staticFit: 0.40,
    dynamicIntelligence: 0.40,
    timingUrgency: 0.20,
  },
  tierThresholds: {
    hot: 90,
    active: 70,
    nurture: 50,
  },
  signalRecencyDays: 30,
  subDimensionWeights: {
    dynamicIntelligence: {
      intelligenceScore: 0.30,
      researchDepth: 0.25,
      signalQuality: 0.25,
      contactCoverage: 0.20,
    },
    timingUrgency: {
      signalRecency: 0.40,
      engagementRecency: 0.35,
      growthIndicator: 0.25,
    },
  },
};

const CONFIG_KEY = 'scoring_config';

// ── In-process cache (for sync access in scoring functions) ──

let _cachedConfig: ScoringConfig = { ...DEFAULT_SCORING_CONFIG };

/** Return the in-memory cached config (safe for sync contexts). */
export function getCachedScoringConfig(): ScoringConfig {
  return _cachedConfig;
}

// ── Config Accessors ──

export async function getScoringConfig(): Promise<ScoringConfig> {
  try {
    const stored = await db.systemSetting.findUnique({
      where: { key: CONFIG_KEY },
    });
    if (stored?.value) {
      const parsed = JSON.parse(stored.value) as Partial<ScoringConfig>;
      const config: ScoringConfig = {
        weights: { ...DEFAULT_SCORING_CONFIG.weights, ...parsed.weights },
        tierThresholds: { ...DEFAULT_SCORING_CONFIG.tierThresholds, ...parsed.tierThresholds },
        signalRecencyDays: parsed.signalRecencyDays ?? DEFAULT_SCORING_CONFIG.signalRecencyDays,
        subDimensionWeights: {
          dynamicIntelligence: {
            ...DEFAULT_SCORING_CONFIG.subDimensionWeights.dynamicIntelligence,
            ...parsed.subDimensionWeights?.dynamicIntelligence,
          },
          timingUrgency: {
            ...DEFAULT_SCORING_CONFIG.subDimensionWeights.timingUrgency,
            ...parsed.subDimensionWeights?.timingUrgency,
          },
        },
      };
      // Update in-process cache
      _cachedConfig = config;
      return config;
    }
  } catch (err) {
    console.error('[scoring-config] Failed to load config from DB, using defaults:', err);
  }
  _cachedConfig = { ...DEFAULT_SCORING_CONFIG };
  return _cachedConfig;
}

export async function updateScoringConfig(
  partial: Partial<ScoringConfig>
): Promise<ScoringConfig> {
  const current = await getScoringConfig();
  const updated: ScoringConfig = {
    weights: { ...current.weights, ...partial.weights },
    tierThresholds: { ...current.tierThresholds, ...partial.tierThresholds },
    signalRecencyDays: partial.signalRecencyDays ?? current.signalRecencyDays,
    subDimensionWeights: {
      dynamicIntelligence: {
        ...current.subDimensionWeights.dynamicIntelligence,
        ...partial.subDimensionWeights?.dynamicIntelligence,
      },
      timingUrgency: {
        ...current.subDimensionWeights.timingUrgency,
        ...partial.subDimensionWeights?.timingUrgency,
      },
    },
  };

  // Validate dimension weights sum to ~1.0 (tolerance 0.01)
  const weightSum = updated.weights.staticFit + updated.weights.dynamicIntelligence + updated.weights.timingUrgency;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `Dimension weights must sum to 1.0 (got ${weightSum.toFixed(4)}). ` +
      `Current: staticFit=${updated.weights.staticFit}, dynamicIntelligence=${updated.weights.dynamicIntelligence}, timingUrgency=${updated.weights.timingUrgency}`
    );
  }

  // Validate each dimension weight is non-negative
  if (updated.weights.staticFit < 0 || updated.weights.dynamicIntelligence < 0 || updated.weights.timingUrgency < 0) {
    throw new Error('Dimension weights must be non-negative.');
  }

  // Validate sub-dimension weights: dynamic intelligence
  const diW = updated.subDimensionWeights.dynamicIntelligence;
  const diSum = diW.intelligenceScore + diW.researchDepth + diW.signalQuality + diW.contactCoverage;
  if (Math.abs(diSum - 1.0) > 0.01) {
    throw new Error(
      `Dynamic Intelligence sub-weights must sum to 1.0 (got ${diSum.toFixed(4)}).`
    );
  }
  if (diW.intelligenceScore < 0 || diW.researchDepth < 0 || diW.signalQuality < 0 || diW.contactCoverage < 0) {
    throw new Error('Dynamic Intelligence sub-weights must be non-negative.');
  }

  // Validate sub-dimension weights: timing urgency
  const tuW = updated.subDimensionWeights.timingUrgency;
  const tuSum = tuW.signalRecency + tuW.engagementRecency + tuW.growthIndicator;
  if (Math.abs(tuSum - 1.0) > 0.01) {
    throw new Error(
      `Timing Urgency sub-weights must sum to 1.0 (got ${tuSum.toFixed(4)}).`
    );
  }
  if (tuW.signalRecency < 0 || tuW.engagementRecency < 0 || tuW.growthIndicator < 0) {
    throw new Error('Timing Urgency sub-weights must be non-negative.');
  }

  // Validate thresholds are in 0–100 range and hot > active > nurture
  const { hot, active, nurture } = updated.tierThresholds;
  if (hot < 0 || hot > 100 || active < 0 || active > 100 || nurture < 0 || nurture > 100) {
    throw new Error('Tier thresholds must be between 0 and 100.');
  }
  if (hot <= active) {
    throw new Error(`hot threshold (${hot}) must be greater than active threshold (${active}).`);
  }
  if (active <= nurture) {
    throw new Error(`active threshold (${active}) must be greater than nurture threshold (${nurture}).`);
  }

  // Validate recency days
  if (updated.signalRecencyDays < 1 || updated.signalRecencyDays > 365) {
    throw new Error('signalRecencyDays must be between 1 and 365.');
  }

  await db.systemSetting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(updated) },
    create: { key: CONFIG_KEY, value: JSON.stringify(updated) },
  });

  // Update in-process cache
  _cachedConfig = updated;

  return updated;
}

// ── Helpers ──

/**
 * Compute the date cutoff for "recent" signals based on config.
 * Signals with signalDate (or createdAt fallback) after this date
 * are considered "recent" for scoring purposes.
 */
export function getRecencyCutoff(config: ScoringConfig): Date {
  const d = new Date();
  d.setDate(d.getDate() - config.signalRecencyDays);
  return d;
}

/**
 * Convenience: get recency cutoff using the cached config (sync).
 */
export function getRecencyCutoffSync(): Date {
  return getRecencyCutoff(_cachedConfig);
}

// ── Score Change Event Emitter (GAP-26) ──

/**
 * Typed callback for score change events.
 *
 * NOTE: This is an in-process event emitter. In a Next.js context,
 * this works for same-request notifications (e.g. a batch compute
 * handler notifying listeners within the same serverless invocation).
 * For cross-request notifications, the frontend polls (already the
 * default pattern). For production scale with multiple server
 * instances, this could be replaced with a proper event bus
 * (Redis pub/sub, Kafka, etc.) or webhook delivery.
 */
export interface ScoreChangeData {
  companyId: string;
  previousScore: number | null;
  newScore: number;
  previousTier: string | null;
  newTier: string | null;
}

type ScoreChangeCallback = (data: ScoreChangeData) => void;

class ScoreChangeEventEmitter {
  private listeners: ScoreChangeCallback[] = [];

  /** Subscribe to score change events. Returns an unsubscribe function. */
  on(callback: ScoreChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /** Emit a score change event to all subscribers. */
  emit(data: ScoreChangeData): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(data);
      } catch (err) {
        console.error('[ScoreChangeEventEmitter] Error in listener:', err);
      }
    }
  }

  /** Remove all listeners (useful for testing). */
  removeAllListeners(): void {
    this.listeners = [];
  }
}

/** Singleton instance for score change events. */
export const scoreChangeEvents = new ScoreChangeEventEmitter();