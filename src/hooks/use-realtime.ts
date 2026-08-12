'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NotificationItem } from '@/lib/types'

// ── Hook return type ─────────────────────────────────────────────────

interface UseRealtimeReturn {
  /** Whether the SSE connection is currently open. */
  connected: boolean
  /** Notifications received over SSE (accumulated in session). */
  notifications: NotificationItem[]
  /** Raw email-open events received. */
  emailOpens: Array<{ eventId: string; contactId: string; timestamp: string }>
  /** Raw email-click events received. */
  emailClicks: Array<{ eventId: string; contactId: string; targetUrl: string | null; timestamp: string }>
  /** Clear all accumulated real-time events. */
  clear: () => void
}

// ── Reconnection backoff config ───────────────────────────────────────
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

// ── Hook ─────────────────────────────────────────────────────────────

export function useRealtime(): UseRealtimeReturn {
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [emailOpens, setEmailOpens] = useState<UseRealtimeReturn['emailOpens']>([])
  const [emailClicks, setEmailClicks] = useState<UseRealtimeReturn['emailClicks']>([])

  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalClose = useRef(false)
  const reconnectAttempts = useRef(0)
  /** Tracks the last event ID received, used for reconnection catch-up. */
  const lastEventIdRef = useRef<string>('')
  const consecutiveErrors = useRef(0)

  const clear = useCallback(() => {
    setNotifications([])
    setEmailOpens([])
    setEmailClicks([])
  }, [])

  useEffect(() => {
    intentionalClose.current = false

    function getBackoffMs(): number {
      const attempt = reconnectAttempts.current;
      // Exponential backoff with jitter
      const base = Math.min(BASE_RECONNECT_MS * Math.pow(2, attempt), MAX_RECONNECT_MS);
      const jitter = base * 0.2 * Math.random();
      return Math.floor(base + jitter);
    }

    function connect() {
      // Avoid opening a second connection
      if (esRef.current) return

      // Build URL with Last-Event-ID for reconnection catch-up
      const url = new URL('/api/realtime', window.location.origin)
      if (lastEventIdRef.current) {
        url.searchParams.set('lastEventId', lastEventIdRef.current)
      }

      const es = new EventSource(url.toString())
      esRef.current = es

      es.addEventListener('connected', () => {
        setConnected(true)
        // Reset reconnection state on successful connection
        reconnectAttempts.current = 0
        consecutiveErrors.current = 0
      })

      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as NotificationItem
          setNotifications((prev) => [data, ...prev].slice(0, 100)) // keep max 100
        } catch {
          // ignore malformed
        }
      })

      es.addEventListener('email_opened', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as UseRealtimeReturn['emailOpens'][number]
          setEmailOpens((prev) => [data, ...prev].slice(0, 100))
        } catch {
          // ignore malformed
        }
      })

      es.addEventListener('email_clicked', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as UseRealtimeReturn['emailClicks'][number]
          setEmailClicks((prev) => [data, ...prev].slice(0, 100))
        } catch {
          // ignore malformed
        }
      })

      es.addEventListener('heartbeat', () => {
        // No-op — keeps connection alive, resets error counter
        consecutiveErrors.current = 0
      })

      // Track last event ID for reconnection
      es.onmessage = (e) => {
        if (e.lastEventId) {
          lastEventIdRef.current = e.lastEventId
        }
      }

      es.onerror = () => {
        setConnected(false)
        consecutiveErrors.current++
        es.close()
        esRef.current = null
        reconnectAttempts.current++

        // Reconnect with exponential backoff unless intentionally closed
        if (!intentionalClose.current) {
          const delay = getBackoffMs()
          reconnectTimer.current = setTimeout(connect, delay)
        }
      }
    }

    connect()

    // Cleanup on unmount
    return () => {
      intentionalClose.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [])

  return { connected, notifications, emailOpens, emailClicks, clear }
}