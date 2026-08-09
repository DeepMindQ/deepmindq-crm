'use client';
import { useEffect, useRef } from 'react';

/**
 * Hook that subscribes to SSE events for real-time data updates.
 * Falls back to polling if SSE is unavailable.
 */
export function useEventSubscription(
  eventType: string,
  onData: (_data: unknown) => void,
  options?: { enabled?: boolean; fallbackIntervalMs?: number }
) {
  const enabled = options?.enabled !== false;
  const fallbackMs = options?.fallbackIntervalMs || 30000;
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });

  useEffect(() => {
    if (!enabled) return;

    const eventSource = new EventSource('/api/realtime');
    
    eventSource.addEventListener(eventType, (e) => {
      try {
        const data = JSON.parse(e.data);
        onDataRef.current(data);
      } catch { return; }
    });

    // Fallback polling if SSE disconnects
    const pollInterval = setInterval(() => {
      if (eventSource.readyState === EventSource.CLOSED) {
        // Reconnect and fetch latest data
        onDataRef.current({ _poll: true });
      }
    }, fallbackMs);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [eventType, enabled, fallbackMs]);
}
