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

// ── Hook ─────────────────────────────────────────────────────────────

export function useRealtime(): UseRealtimeReturn {
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [emailOpens, setEmailOpens] = useState<UseRealtimeReturn['emailOpens']>([])
  const [emailClicks, setEmailClicks] = useState<UseRealtimeReturn['emailClicks']>([])

  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalClose = useRef(false)

  const clear = useCallback(() => {
    setNotifications([])
    setEmailOpens([])
    setEmailClicks([])
  }, [])

  useEffect(() => {
    intentionalClose.current = false

    function connect() {
      // Avoid opening a second connection
      if (esRef.current) return

      const es = new EventSource('/api/realtime')
      esRef.current = es

      es.addEventListener('connected', () => {
        setConnected(true)
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
        // No-op — keeps connection alive
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        esRef.current = null

        // Reconnect after 3 seconds unless intentionally closed
        if (!intentionalClose.current) {
          reconnectTimer.current = setTimeout(connect, 3_000)
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