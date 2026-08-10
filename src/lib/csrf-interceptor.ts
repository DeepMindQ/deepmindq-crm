/* ═══════════════════════════════════════════════════
   Global CSRF Fetch Interceptor
   
   P0.4 DEEP FIX (third pass): 58+ components use raw fetch()
   instead of fetchApi(), which means x-csrf-token header is
   never sent. This breaks ALL POST/PUT/DELETE requests with 403.
   
   This module monkey-patches window.fetch to auto-inject
   the CSRF token header on all state-changing requests to
   /api/* URLs. Zero call-site changes needed.
   
   Must be imported ONCE at the app root (layout.tsx).
   Only runs client-side (guarded by typeof window).
   ═══════════════════════════════════════════════════ */

export function initCsrfInterceptor(): void {
  if (typeof window === 'undefined') return
  if (typeof window.fetch !== 'function') return

  // Prevent double-patching
  const marker = Symbol.for('dmq-csrf-patched')
  if ((window as any)[marker]) return
  ;(window as any)[marker] = true

  const originalFetch = window.fetch

  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    // Only intercept API calls
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const method = init?.method?.toUpperCase()
      if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const csrfToken = getCsrfTokenFromCookie()
        if (csrfToken) {
          const headers = new Headers(init?.headers)
          headers.set('x-csrf-token', csrfToken)
          return originalFetch.call(this, input, { ...init, headers })
        }
      }
    }

    return originalFetch.call(this, input, init)
  }
}

function getCsrfTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}
