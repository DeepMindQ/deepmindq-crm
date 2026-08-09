/**
 * Higher-order function that wraps a Next.js route handler with CSRF validation.
 * Provides defense-in-depth alongside the Edge middleware CSRF enforcement.
 * 
 * Usage:
 *   export const POST = withCsrf(async (req) => { ... })
 *   export const PUT = withCsrf(async (req) => { ... })
 */
import { csrfMiddleware } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';

type RouteHandler = (_req: NextRequest, _ctx?: { params?: Record<string, string> }) => Promise<Response>;

export function withCsrf(handler: RouteHandler) {
  return async (req: NextRequest, ctx?: { params?: Record<string, string> }): Promise<Response> => {
    // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return handler(req, ctx);
    }

    // Validate CSRF token
    const result = csrfMiddleware(req);
    if (!result.valid) {
      return result.response!;
    }

    return handler(req, ctx);
  };
}
