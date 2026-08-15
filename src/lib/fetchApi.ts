/* ═══════════════════════════════════════════════════
   fetchApi — Client-side API Fetch Wrapper
   WI-18.1-02: Added CSRF token header for state-changing requests
   ═══════════════════════════════════════════════════ */

interface FetchApiOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  /** Number of retries on network errors (default 0). */
  retry?: number;
}

/**
 * Read the CSRF token from cookies.
 * The Edge middleware injects this cookie on every page load.
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Determine if a request method requires CSRF protection.
 */
function isStateChangingMethod(method?: string): boolean {
  if (!method) return false;
  const m = method.toUpperCase();
  return !['GET', 'HEAD', 'OPTIONS'].includes(m);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchApi<T = any>(
  url: string,
  options: FetchApiOptions = {},
): Promise<{ data: T | null; error: string | null; isUnauthorized?: boolean }> {
  const maxRetries = options.retry ?? 0;
  // Destructure retry so it doesn't leak into fetch init
  const { retry: _retry, ...restOptions } = options;

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let fullUrl = url;

      // Build query string from params
      if (restOptions.params) {
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(restOptions.params)) {
          if (val !== undefined && val !== null && val !== '') {
            params.set(key, String(val));
          }
        }
        const qs = params.toString();
        if (qs) fullUrl += (url.includes('?') ? '&' : '?') + qs;
      }

      // Destructure so params don't leak into fetch init
      const { params: _params, ...fetchOpts } = restOptions;

      // Inject CSRF token for state-changing requests (WI-18.1-02)
      const headers = new Headers(fetchOpts.headers);
      if (isStateChangingMethod(fetchOpts.method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers.set('x-csrf-token', csrfToken);
        }
      }

      const res = await fetch(fullUrl, { ...fetchOpts, credentials: 'include', headers });

      // 429 Too Many Requests — include Retry-After in error message
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const retryMsg = retryAfter ? ` (Retry-After: ${retryAfter})` : '';
        return {
          data: null,
          error: `Too many requests${retryMsg}`,
        };
      }

      // 401 Unauthorized — session expired
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        return {
          data: null,
          error: body.error || 'Session expired. Please log in again.',
          isUnauthorized: true,
        };
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          data: null,
          error: body.error || `Request failed with status ${res.status}`,
        };
      }

      const body = await res.json();

      // Unwrap the { data } envelope when the API route returns { data: ... }
      // without an error property, to avoid double-wrapping for callers.
      if (body !== null && typeof body === 'object' && 'data' in body && !('error' in body)) {
        return { data: body.data as T, error: null };
      }

      return { data: body, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
      if (attempt < maxRetries) {
        await sleep(1000);
        continue;
      }
      return { data: null, error: lastError };
    }
  }

  // Unreachable, but TypeScript needs it
  return { data: null, error: lastError };
}
