'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { logger } from '@/lib/logger';

// ── Types ──

interface UseRealtimeDataOptions<T> {
  /** API endpoint path (e.g. '/api/companies') */
  endpoint: string;
  /** Polling interval in ms, 0 = no polling (default: 30000) */
  interval?: number;
  /** Whether to fetch on mount (default: true) */
  enabled?: boolean;
  /** Transform response data */
  transform?: (data: any) => T;
  /** Initial data */
  initialData?: T;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

interface UseRealtimeDataResult<T> {
  data: T | undefined;
  rawData: any;
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  isPolling: boolean;
}

// ── Generic Hook ──

export function useRealtimeData<T = any>(
  options: UseRealtimeDataOptions<T>
): UseRealtimeDataResult<T> {
  const {
    endpoint,
    interval = 30000,
    enabled = true,
    transform,
    initialData,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [rawData, setRawData] = useState<any>(undefined);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isPolling = interval > 0 && enabled;
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    // Cancel previous in-flight request (deduplication)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`API ${endpoint} returned ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      
      if (!mountedRef.current) return;

      // Stale-while-revalidate: always update data on success
      const transformed = transform ? transform(json) : json;
      setData(transformed);
      setRawData(json);
      setLastUpdated(new Date());
      setLoading(false);
      onSuccess?.(transformed);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!mountedRef.current) return;
      
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      onError?.(error);
      logger.error(`[useRealtimeData] ${endpoint} error:`, { error });
    }
  }, [endpoint, transform, onSuccess, onError]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    fetchData();
    if (interval > 0) {
      const poll = setInterval(fetchData, interval);
      return () => { clearInterval(poll); };
    }
    return () => { mountedRef.current = false; };
  }, [fetchData, enabled, interval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  return { data, rawData, loading, error, lastUpdated, refetch: fetchData, isPolling };
}

// ── Domain-Specific Hooks ──

/** Dashboard stats (header counts, pipeline progress) */
export function useDashboardStats(interval = 30000) {
  return useRealtimeData({
    endpoint: '/api/dashboard',
    interval,
    transform: (data) => ({
      importedCount: data.importedCount ?? 0,
      totalLeads: data.totalLeads ?? 0,
      draftCount: data.draftCount ?? 0,
      queueCount: data.queueCount ?? 0,
      replyCount: data.replyCount ?? 0,
      bounceCount: data.bounceCount ?? 0,
      totalCompanies: data.totalCompanies ?? 0,
      activeOpportunities: data.activeOpportunities ?? 0,
      aiSignalsToday: data.aiSignalsToday ?? 0,
      intelligenceScore: data.intelligenceScore ?? 0,
    }),
  });
}

/** Company list with optional status filter */
export function useCompanies(status?: string, interval = 30000) {
  const endpoint = status && status !== 'all' 
    ? `/api/companies?status=${status}` 
    : '/api/companies';
  return useRealtimeData({
    endpoint,
    interval,
  });
}

/** Single company detail */
export function useCompanyDetail(companyId: string | null, interval = 60000) {
  return useRealtimeData({
    endpoint: companyId ? `/api/companies/${companyId}` : '/api/companies',
    interval: companyId ? interval : 0,
    enabled: !!companyId,
  });
}

/** Company intelligence signals */
export function useCompanySignals(companyId: string | null, interval = 45000) {
  return useRealtimeData({
    endpoint: companyId ? `/api/companies/${companyId}/signals` : '/api/signals/list',
    interval: companyId ? interval : 0,
    enabled: !!companyId,
  });
}

/** Company score + breakdown */
export function useCompanyScore(companyId: string | null) {
  return useRealtimeData({
    endpoint: companyId ? `/api/companies/${companyId}/score` : '/api/ai/score-companies',
    enabled: !!companyId,
    interval: companyId ? 60000 : 0,
  });
}

/** Opportunities list */
export function useOpportunities(interval = 30000) {
  return useRealtimeData({
    endpoint: '/api/opportunities/list',
    interval,
  });
}

/** AI Recommendations */
export function useRecommendations(companyId?: string | null, interval = 30000) {
  const endpoint = companyId 
    ? `/api/recommendations/${companyId}` 
    : '/api/recommendations/list';
  return useRealtimeData({
    endpoint,
    interval,
  });
}

/** AI Advisor conversations */
export function useAdvisorConversations(interval = 15000) {
  return useRealtimeData({
    endpoint: '/api/ai/advisor',
    interval,
  });
}

/** AI Health / System status */
export function useAIHealth(interval = 30000) {
  return useRealtimeData({
    endpoint: '/api/ai/health',
    interval,
    transform: (data) => ({
      status: data.status ?? 'unknown',
      modelLatency: data.modelLatency ?? 0,
      cacheHitRate: data.cacheHitRate ?? 0,
      activeRequests: data.activeRequests ?? 0,
      uptime: data.uptime ?? 0,
      lastCheck: data.lastCheck ?? null,
    }),
  });
}

/** Signal Intelligence */
export function useSignals(interval = 20000) {
  return useRealtimeData({
    endpoint: '/api/signals/list',
    interval,
  });
}

/** Pipeline data */
export function usePipeline(interval = 30000) {
  return useRealtimeData({
    endpoint: '/api/pipeline/list',
    interval,
  });
}

/** Pipeline forecast */
export function usePipelineForecast(interval = 60000) {
  return useRealtimeData({
    endpoint: '/api/pipeline/forecast',
    interval,
  });
}

/** Notifications */
export function useNotifications(interval = 30000) {
  return useRealtimeData<any[]>({
    endpoint: '/api/notifications',
    interval,
    initialData: [],
  });
}

/** Data health metrics */
export function useDataHealth(interval = 60000) {
  return useRealtimeData({
    endpoint: '/api/data-health/list',
    interval,
  });
}

/** Trust dashboard */
export function useTrustDashboard(interval = 60000) {
  return useRealtimeData({
    endpoint: '/api/trust/dashboard',
    interval,
  });
}

/** Contacts list */
export function useContacts(interval = 30000) {
  return useRealtimeData({
    endpoint: '/api/contacts',
    interval,
  });
}

/** Intelligence stats */
export function useIntelligenceStats(interval = 30000) {
  return useRealtimeData({
    endpoint: '/api/intelligence/stats',
    interval,
  });
}

// ── Mutation hooks (for write operations) ──

interface UseMutationOptions<TData, TVariables> {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables?: TVariables) => Promise<TData | null>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMutation<TData = any, TVariables = any>(
  options: UseMutationOptions<TData, TVariables>
): UseMutationResult<TData, TVariables> {
  const { endpoint, method = 'POST', onSuccess, onError } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables?: TVariables): Promise<TData | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: variables ? JSON.stringify(variables) : undefined,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Mutation ${method} ${endpoint} failed: ${res.status} - ${errorBody}`);
      }

      const data: TData = await res.json();
      onSuccess?.(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      logger.error(`[useMutation] ${method} ${endpoint} error:`, { error });
      return null;
    } finally {
      setLoading(false);
    }
  }, [endpoint, method, onSuccess, onError]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, loading, error, reset };
}
