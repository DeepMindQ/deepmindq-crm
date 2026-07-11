// Combined API middleware: auth + rate limit + audit logging
import { auth } from './auth'
import { rateLimit } from './rate-limit'
import { createAuditLog } from './audit'
import { logRequest } from './logger'
import { apiError } from './apiHelpers'

interface ApiMiddlewareOptions {
  requireAuth?: boolean      // default true
  rateLimitKey?: string      // custom rate limit key prefix
  rateLimitMax?: number      // default 100
  rateLimitWindowMs?: number // default 60000
  auditEntity?: string       // entity name for audit logging
  auditAction?: string       // action for audit logging
}

export async function withApiMiddleware(
  request: Request,
  options: ApiMiddlewareOptions = {},
): Promise<{ authorized: boolean; userId?: string; rateLimited: boolean; response?: Response }> {
  const {
    requireAuth = true,
    rateLimitKey,
    rateLimitMax = 100,
    rateLimitWindowMs = 60_000,
  } = options

  const startTime = Date.now()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
              request.headers.get('x-real-ip') || 'unknown'
  const path = new URL(request.url).pathname

  try {
    // Rate limiting
    const key = rateLimitKey || `api:${ip}:${path}`
    const rl = rateLimit({ key, limit: rateLimitMax, windowMs: rateLimitWindowMs })

    if (!rl.success) {
      logRequest(request.method, path, 429, Date.now() - startTime, ip)
      return { authorized: false, rateLimited: true, response: apiError('Too many requests. Please try again later.', 429) }
    }

    // Auth check
    if (requireAuth) {
      try {
        const session = await auth()
        if (!session?.user) {
          logRequest(request.method, path, 401, Date.now() - startTime, ip)
          return { authorized: false, rateLimited: false, response: apiError('Authentication required', 401) }
        }

        // Audit logging (fire and forget)
        if (options.auditEntity && options.auditAction) {
          createAuditLog({
            userId: session.user.id,
            action: options.auditAction,
            entity: options.auditEntity,
            request,
          }).catch(() => {}) // never block on audit
        }

        logRequest(request.method, path, 200, Date.now() - startTime, ip)
        return { authorized: true, userId: session.user.id, rateLimited: false }
      } catch {
        // Auth not configured yet - allow through in development
        if (process.env.NODE_ENV !== 'production') {
          logRequest(request.method, path, 200, Date.now() - startTime, ip)
          return { authorized: true, userId: 'dev-user', rateLimited: false }
        }
        logRequest(request.method, path, 401, Date.now() - startTime, ip)
        return { authorized: false, rateLimited: false, response: apiError('Authentication required', 401) }
      }
    }

    logRequest(request.method, path, 200, Date.now() - startTime, ip)
    return { authorized: true, rateLimited: false }
  } catch (error) {
    logRequest(request.method, path, 500, Date.now() - startTime, ip)
    return { authorized: false, rateLimited: false, response: apiError('Internal server error', 500) }
  }
}