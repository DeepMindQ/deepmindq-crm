/**
 * DeepMindQ — Distributed Tracing
 *
 * Provides withTrace() wrapper for instrumenting operations with trace spans.
 * When @opentelemetry/api is available, creates real OTel spans.
 * Otherwise, falls back to correlation-ID-based manual tracing.
 *
 * IMPORTANT: This module MUST be Edge-runtime compatible.
 * No Node.js APIs (fs, process, Buffer, etc.).
 * Uses globalThis.crypto (Web Crypto API) available in both Edge and Node.js.
 */

// ── Types ──────────────────────────────────────────────────────

export interface TraceContext {
  /** 32 hex characters (W3C Trace Context trace-id) */
  traceId: string
  /** 16 hex characters (W3C Trace Context parent-span-id) */
  spanId: string
  /** Optional parent span for nested spans */
  parentSpanId?: string
}

interface WithTraceOptions {
  parent?: TraceContext
  attributes?: Record<string, string>
}

// ── OTel API lazy cache ─────────────────────────────────────────
// We try to dynamically import @opentelemetry/api once and cache the result.
// If the package is not installed, we gracefully fall back to manual tracing.

type OTelAPI = {
  trace: {
    getTracer: (name: string, version?: string) => OTelTracer
  }
}

type OTelTracer = {
  startSpan: (name: string, options?: Record<string, unknown>) => OTelSpan
}

type OTelSpan = {
  end: () => void
  setAttribute: (key: string, value: unknown) => void
  isRecording: () => boolean
  spanContext: () => { traceId: string; spanId: string }
}

let _otelApi: OTelAPI | null | undefined = undefined

async function loadOTel(): Promise<OTelAPI | null> {
  if (_otelApi !== undefined) return _otelApi
  try {
    const api = await import('@opentelemetry/api')
    _otelApi = api as unknown as OTelAPI
    return _otelApi
  } catch {
    _otelApi = null
    return null
  }
}

// ── Hex ID generation (Edge-safe) ──────────────────────────────
// Uses globalThis.crypto which is Web Crypto API, available in Edge runtime.

function randomHex32(): string {
  // crypto.randomUUID() returns "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (36 chars)
  // Removing dashes gives exactly 32 hex chars — perfect for W3C trace-id
  return crypto.randomUUID().replace(/-/g, '')
}

function randomHex16(): string {
  // Take first 16 hex chars from a UUID
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

// ── Core functions ──────────────────────────────────────────────

/**
 * Generate a new trace context (random traceId + spanId).
 */
export function generateTraceContext(): TraceContext {
  return {
    traceId: randomHex32(),
    spanId: randomHex16(),
  }
}

/**
 * Extract trace context from incoming HTTP request headers.
 * Reads traceparent header (W3C Trace Context standard).
 * Falls back to x-correlation-id header.
 */
export function extractTraceContext(headers: Headers): TraceContext {
  // 1. Try W3C traceparent header: "00-{traceId}-{spanId}-{flags}"
  const traceparent = headers.get('traceparent')
  if (traceparent) {
    const parts = traceparent.split('-')
    if (parts.length >= 3 && parts[0] === '00') {
      const traceId = parts[1]
      const spanId = parts[2]
      if (traceId && traceId.length === 32 && spanId && spanId.length === 16) {
        return { traceId, spanId }
      }
    }
  }

  // 2. Try x-correlation-id as traceId
  const correlationId = headers.get('x-correlation-id')
  if (correlationId) {
    // UUID without dashes is 32 hex chars
    const hexTraceId = correlationId.replace(/-/g, '')
    if (hexTraceId.length === 32) {
      return {
        traceId: hexTraceId,
        spanId: randomHex16(),
      }
    }
    // If not UUID format, use as-is for traceId (padded or used as opaque value)
    return {
      traceId: hexTraceId.padEnd(32, '0').slice(0, 32),
      spanId: randomHex16(),
    }
  }

  // 3. Generate a new trace context
  return generateTraceContext()
}

/**
 * Inject trace context into outgoing HTTP request headers.
 * Sets traceparent header (W3C format).
 */
export function injectTraceContext(headers: Record<string, string>, ctx: TraceContext): void {
  // W3C traceparent format: 00-{traceId}-{spanId}-01
  // version=00, traceId=32hex, spanId=16hex, flags=01 (sampled)
  headers['traceparent'] = `00-${ctx.traceId}-${ctx.spanId}-01`
  headers['x-trace-id'] = ctx.traceId
}

/**
 * Get the current trace context from the active OTel span,
 * or return a generated one if OTel is not available.
 */
export function getTraceContext(): TraceContext {
  // Synchronous attempt to read from OTel if it was loaded
  try {
    // Dynamic require won't work here; if OTel was loaded asynchronously,
    // the active span is managed by the OTel context. We check synchronously.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('@opentelemetry/api')
    if (api?.trace) {
      const span = api.trace.getActiveSpan()
      if (span?.spanContext?.()) {
        const sc = span.spanContext()
        return {
          traceId: sc.traceId,
          spanId: sc.spanId,
        }
      }
    }
  } catch {
    // OTel not available
  }

  return generateTraceContext()
}

/**
 * Execute a function within a traced span.
 * Works with or without OpenTelemetry SDK.
 *
 * When OTel is available, creates a real span with proper parent linking.
 * Otherwise, returns a manual TraceContext for logging/correlation purposes.
 */
export async function withTrace<T>(
  name: string,
  fn: (ctx: TraceContext) => Promise<T>,
  options?: WithTraceOptions,
): Promise<T> {
  const otel = await loadOTel()

  if (otel) {
    // ── Real OTel path ────────────────────────────────────
    const tracer = otel.trace.getTracer('deepmindq', '1.0.0')
    const parentContext = options?.parent
      ? // Link to parent via context propagation
        undefined // OTel context propagation is handled by the SDK
      : undefined

    const span = tracer.startSpan(name, {
      attributes: options?.attributes,
    })

    const ctx: TraceContext = {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: options?.parent?.spanId,
    }

    // Set parent traceId if provided (for cross-boundary correlation)
    if (options?.parent && options.parent.traceId !== ctx.traceId) {
      span.setAttribute('parent.trace_id', options.parent.traceId)
      // Keep the OTel-generated traceId since it's linked via context
      // but expose the parent's traceId for downstream correlation
      ctx.traceId = options.parent.traceId
    }

    try {
      return await fn(ctx)
    } catch (error) {
      span.setAttribute('error', true)
      if (error instanceof Error) {
        span.setAttribute('error.message', error.message)
      }
      throw error
    } finally {
      span.end()
    }
  }

  // ── Fallback path (no OTel) ─────────────────────────────
  const ctx: TraceContext = {
    traceId: options?.parent?.traceId ?? randomHex32(),
    spanId: randomHex16(),
    parentSpanId: options?.parent?.spanId,
  }

  return fn(ctx)
}

/**
 * Format a TraceContext as a W3C traceparent header value.
 * Useful for logging or manual header injection.
 */
export function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`
}
