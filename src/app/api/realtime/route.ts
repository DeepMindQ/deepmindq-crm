import { eventBus } from '@/lib/event-bus'
import { checkApiAuth } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

// ── Event types we forward over SSE ──────────────────────────────────
const FORWARDED_EVENTS = [
  'notification', 'email_opened', 'email_clicked',
  'dashboard_update', 'signals_update', 'recommendations_update',
  'company_update', 'opportunity_update',
] as const

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Per-user connection tracking
const sseConnections = new Map<string, number>();
const MAX_SSE_CONNECTIONS_PER_USER = 3;

// ── GET handler (SSE stream) ─────────────────────────────────────────

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // Check per-user connection limit
  const sessionToken = request.cookies.get('dmq_session')?.value || crypto.randomUUID();
  if ((sseConnections.get(sessionToken) || 0) >= MAX_SSE_CONNECTIONS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SSE_CONNECTIONS_PER_USER} concurrent SSE connections allowed` },
      { status: 429 }
    );
  }
  sseConnections.set(sessionToken, (sseConnections.get(sessionToken) || 0) + 1);

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

      // Subscribe to all forwarded events (in-memory eventBus)
      // Note: Redis pub/sub events from other instances are relayed to
      // the eventBus by initPubSub() (called from instrumentation.ts).
      // So this single subscription point handles both local and cross-instance events.
      const unsubscribers = FORWARDED_EVENTS.map((eventName) =>
        eventBus.on(eventName, (evt) => {
          try {
            send(evt.data, evt.type)
          } catch {
            // If enqueue fails the stream is likely closed — cleanup happens in cancel
          }
        }),
      )

      // Also subscribe via onAny so any future event types are automatically forwarded
      const unsubAny = eventBus.onAny((evt) => {
        // Only forward if not already handled by a specific listener
        if (!(FORWARDED_EVENTS as readonly string[]).includes(evt.type)) {
          try {
            send(evt.data, evt.type)
          } catch {
            // Stream likely closed
          }
        }
      })

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
        unsubAny()
        sseConnections.set(sessionToken, Math.max(0, (sseConnections.get(sessionToken) || 0) - 1));
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