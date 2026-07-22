import { eventBus } from '@/lib/event-bus'

// ── Event types we forward over SSE ──────────────────────────────────
const FORWARDED_EVENTS = ['notification', 'email_opened', 'email_clicked'] as const

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── GET handler (SSE stream) ─────────────────────────────────────────

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Helper to push an SSE-formatted message
      function send(data: unknown, event?: string) {
        const lines: string[] = []
        if (event) lines.push(`event: ${event}`)
        lines.push(`data: ${JSON.stringify(data)}`)
        lines.push('')
        lines.push('')
        controller.enqueue(encoder.encode(lines.join('\n')))
      }

      // Send initial connection confirmation
      send({ connected: true, timestamp: new Date().toISOString() }, 'connected')

      // Subscribe to all forwarded events
      const unsubscribers = FORWARDED_EVENTS.map((eventName) =>
        eventBus.on(eventName, (data) => {
          try {
            send(data, eventName)
          } catch {
            // If enqueue fails the stream is likely closed — cleanup happens in cancel
          }
        }),
      )

      // Heartbeat every 30 seconds to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          send({ ping: true }, 'heartbeat')
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Store cleanup references for the cancel handler
      ;(stream as unknown as { _cleanup: () => void })._cleanup = () => {
        clearInterval(heartbeat)
        unsubscribers.forEach((unsub) => unsub())
      }
    },

    cancel() {
      const cleanup = (stream as unknown as { _cleanup?: () => void })._cleanup
      cleanup?.()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering (if present)
    },
  })
}