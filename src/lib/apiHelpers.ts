import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sanitizeString } from './sanitize'

// ---------------------------------------------------------------------------
// Standardised JSON response helpers
// ---------------------------------------------------------------------------

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

// ---------------------------------------------------------------------------
// Request-body validation (Zod)
// Returns a NextResponse on validation failure, or the parsed & typed data.
// Usage:  const data = validateBody(schema, body)
//         if (data instanceof Response) return data
// ---------------------------------------------------------------------------

export function validateBody<T extends z.ZodTypeAny>(schema: T, body: unknown): NextResponse | z.infer<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const first = result.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'Validation failed' }, { status: 400 })
  }
  return result.data as z.infer<T>
}

// ---------------------------------------------------------------------------
// Sanitisation helpers
// ---------------------------------------------------------------------------

/** Sanitize a single string value */
export function sanitize(value: unknown): string {
  if (typeof value !== 'string') return ''
  return sanitizeString(value)
}

/** Sanitize specific string fields on an object, returning a new object */
export function sanitizeFields(
  obj: Record<string, unknown>,
  fields: string[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const field of fields) {
    if (typeof obj[field] === 'string') {
      result[field] = sanitizeString(obj[field] as string)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Safe integer parser
// ---------------------------------------------------------------------------

export function safeInt(value: unknown, fallback?: number, min?: number): number {
  const fb = fallback ?? 0
  let n: number
  if (typeof value === 'number') n = Number.isFinite(value) ? Math.round(value) : fb
  else if (typeof value === 'string') {
    n = parseInt(value, 10)
    if (!Number.isFinite(n)) n = fb
  } else {
    n = fb
  }
  if (min !== undefined) n = Math.max(min, n)
  return n
}