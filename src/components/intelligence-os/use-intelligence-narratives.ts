/**
 * useIntelligenceNarratives — Client-side hook for real intelligence data
 *
 * Fetches narratives from /api/intelligence/narratives and provides:
 *   - Narrative data with real confidence, evidence, and reasoning
 *   - Loading/error states
 *   - Refetch capability
 *   - Individual signal narrative drill-down
 *   - Confidence detail drill-down
 *
 * This is the BRIDGE between the Intelligence Engine and the UI.
 * Without this hook, IntelligenceNarrative is just a visual shell.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  IntelligenceNarrativeData,
  NarrativeConfidence,
  NarrativeServiceResult,
} from '@/lib/intelligence-narrative-service';

export interface UseIntelligenceNarrativesOptions {
  /** Max narratives to fetch (default 10) */
  limit?: number;
  /** Filter to specific company */
  companyId?: string;
  /** Minimum confidence threshold 0-100 */
  minConfidence?: number;
  /** Minimum severity: 'critical' | 'high' | 'medium' | 'low' */
  minSeverity?: string;
  /** Auto-fetch on mount (default true) */
  enabled?: boolean;
  /** Polling interval in ms (default: no polling) */
  pollingInterval?: number;
}

export interface UseIntelligenceNarrativesReturn {
  /** Fetched narratives */
  narratives: IntelligenceNarrativeData[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Service metadata */
  meta: NarrativeServiceResult['meta'] | null;
  /** Manually trigger refetch */
  refetch: () => Promise<void>;
  /** Drill into a specific signal */
  getSignalNarrative: (signalId: string) => Promise<IntelligenceNarrativeData | null>;
  /** Get confidence details for a signal */
  getConfidenceDetail: (signalId: string) => Promise<{
    confidence: NarrativeConfidence;
    evidenceCount: number;
    evidenceSources: string[];
  } | null>;
}

export function useIntelligenceNarratives(
  options: UseIntelligenceNarrativesOptions = {},
): UseIntelligenceNarrativesReturn {
  const {
    limit = 10,
    companyId,
    minConfidence,
    minSeverity,
    enabled = true,
    pollingInterval,
  } = options;

  const [narratives, setNarratives] = useState<IntelligenceNarrativeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<NarrativeServiceResult['meta'] | null>(null);

  const fetchNarratives = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (companyId) params.set('companyId', companyId);
      if (minConfidence && minConfidence > 0) params.set('minConfidence', String(minConfidence));
      if (minSeverity) params.set('minSeverity', minSeverity);

      const response = await fetch(`/api/intelligence/narratives?${params.toString()}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setNarratives(result.data);
        setMeta(result.meta);
      } else {
        setError(result.error || 'Failed to fetch narratives');
        setNarratives([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setNarratives([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit, companyId, minConfidence, minSeverity]);

  // Auto-fetch on mount and when options change
  useEffect(() => {
    if (!enabled) return;
    fetchNarratives();
  }, [enabled, fetchNarratives]);

  // Polling
  useEffect(() => {
    if (!enabled || !pollingInterval || pollingInterval < 5000) return;
    const interval = setInterval(fetchNarratives, pollingInterval);
    return () => clearInterval(interval);
  }, [enabled, pollingInterval, fetchNarratives]);

  // Drill-down: single signal narrative
  const getSignalNarrative = useCallback(async (signalId: string): Promise<IntelligenceNarrativeData | null> => {
    try {
      const response = await fetch(`/api/intelligence/narratives?signalId=${signalId}`);
      const result = await response.json();
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }, []);

  // Drill-down: confidence detail
  const getConfidenceDetail = useCallback(async (signalId: string) => {
    try {
      const response = await fetch(`/api/intelligence/narratives?confidenceDetail=${signalId}`);
      const result = await response.json();
      if (result.success && result.data) {
        return {
          confidence: result.data.confidence,
          evidenceCount: result.data.evidenceCount,
          evidenceSources: result.data.evidenceSources,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    narratives,
    isLoading,
    error,
    meta,
    refetch: fetchNarratives,
    getSignalNarrative,
    getConfidenceDetail,
  };
}
