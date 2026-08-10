import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody } from './apiHelpers'

type ZodSchema = z.ZodTypeAny

type HandlerWithValidation<T = unknown> = (
  _req: NextRequest,
  _ctx: { params?: Record<string, string> },
  _body: T
) => Promise<Response>

type HandlerWithoutValidation = (
  _req: NextRequest,
  _ctx?: { params?: Record<string, string> }
) => Promise<Response>

/**
 * Wraps a POST/PUT/PATCH handler with Zod body validation.
 * For GET handlers, just passes through (no body to validate).
 */
export function withValidation<T extends ZodSchema>(
  schema: T,
  handler: HandlerWithValidation<z.infer<T>>
) {
  return async (req: NextRequest, ctx?: { params?: Record<string, string> }): Promise<Response> => {
    // Skip validation for GET/HEAD/OPTIONS (safe methods)
    const method = req.method.toUpperCase()
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return (handler as HandlerWithoutValidation)(req, ctx)
    }

    try {
      const body = await req.json()
      const parsed = validateBody(schema, body)
      if (parsed instanceof Response) return parsed
      return handler(req, ctx!, parsed as z.infer<T>)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', timestamp: new Date().toISOString() },
        { status: 400 }
      )
    }
  }
}

/**
 * Quick validation middleware that just validates and returns parsed body or error.
 * Use for routes that need custom handling after validation.
 */
export async function validateRequest<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): Promise<{ data: z.infer<T> } | Response> {
  try {
    const body = await req.json()
    const parsed = validateBody(schema, body)
    if (parsed instanceof Response) return parsed
    return { data: parsed as z.infer<T> }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', timestamp: new Date().toISOString() },
      { status: 400 }
    )
  }
}
