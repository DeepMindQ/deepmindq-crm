'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* ═══════════════════════════════════════════════════
   useScreenData — Unified data fetching hook with
   loading / error / empty state management
   
   Wraps any async fetcher and provides ready-to-use
   state for LoadingSkeleton, ErrorPanel, and EmptyState.
   
   Usage:
     const { data, loading, error, empty, refetch } = useScreenData(
       () => fetch('/api/companies').then(r => r.json()),
       { isEmpty: (d) => d.companies?.length === 0 }
     );
     
     if (loading) return <LoadingSkeleton variant="table" />;
     if (error) return <ErrorPanel error={error} onRetry={refetch} />;
     if (empty) return <EmptyState icon="building" title="No companies" />;
     return <CompanyTable data={data} />;
   
   ═══════════════════════════════════════════════════ */

export interface UseScreenDataOptions<T> {
  /** Async function that returns data */
  fetcher: () => Promise<T>;
  /** Determine if the returned data represents "empty" */
  isEmpty?: (_data: T) => boolean;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Deps that trigger re-fetch when changed */
  deps?: unknown[];
  /** Transform/error mapper — convert thrown errors */
  mapError?: (_err: unknown) => Error;
}

export interface UseScreenDataResult<T> {
  /** Fetched data (null until first success) */
  data: T | null;
  /** True while fetching */
  loading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** True if data exists but isEmpty(data) === true */
  empty: boolean;
  /** Manually trigger refetch */
  refetch: () => void;
  /** Number of completed fetches (for debugging) */
  fetchCount: number;
}

/**
 * Unified data fetching hook with built-in loading/error/empty state tracking.
 * Designed to be the single source of truth for screen data state.
 */
export function useScreenData<T>(options: UseScreenDataOptions<T>): UseScreenDataResult<T> {
  const { fetcher, isEmpty, autoFetch = true, deps = [], mapError } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const mountedRef = useRef(true);

  // Stable ref to fetcher (avoids re-renders from dep changes)
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(() => {
    setLoading(true);
    setError(null);

    const currentFetcher = fetcherRef.current;

    Promise.resolve()
      .then(() => currentFetcher())
      .then((result) => {
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
          setError(null);
          setFetchCount((c) => c + 1);
        }
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          const normalizedError = mapError
            ? mapError(err)
            : err instanceof Error
              ? err
              : new Error(typeof err === 'string' ? err : 'An unexpected error occurred');
          setError(normalizedError);
          setLoading(false);
          setFetchCount((c) => c + 1);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch on mount and when deps change
  useEffect(() => {
    mountedRef.current = true;
    if (autoFetch) {
      doFetch();
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, doFetch, ...deps]);

  const empty = data !== null && isEmpty ? isEmpty(data) : false;

  return {
    data,
    loading,
    error,
    empty,
    refetch: doFetch,
    fetchCount,
  };
}
