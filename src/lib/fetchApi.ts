/* ═══════════════════════════════════════════════════
   fetchApi — Client-side API Fetch Wrapper
   WI-18.1-02: Added CSRF token header for state-changing requests
   ═══════════════════════════════════════════════════ */

interface FetchApiOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
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

export async function fetchApi<T = any>(
  url: string,
  options: FetchApiOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    let fullUrl = url;

    // Build query string from params
    if (options.params) {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(options.params)) {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val));
        }
      }
      const qs = params.toString();
      if (qs) fullUrl += (url.includes('?') ? '&' : '?') + qs;
    }

    // Destructure so params don't leak into fetch init
    const { params: _params, ...fetchOpts } = options;

    // Inject CSRF token for state-changing requests (WI-18.1-02)
    const headers = new Headers(fetchOpts.headers);
    if (isStateChangingMethod(fetchOpts.method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers.set('x-csrf-token', csrfToken);
      }
    }

    const res = await fetch(fullUrl, { ...fetchOpts, credentials: 'include', headers });

    // FIX F6: Handle session expiry (401) — dispatch event and redirect
    if (res.status === 401) {
      document.dispatchEvent(new CustomEvent('session-expired', { detail: { status: 401 } }));
      // Redirect to login page (only if not already there)
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return { data: null, error: 'Session expired. Please log in again.' };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        data: null,
        error: body.error || `Request failed with status ${res.status}`,
      };
    }

    const body = await res.json();
    // Unwrap the standard API envelope: most routes return { data: <payload> }
    // or { success: true, data: <payload>, timestamp: "..." } (apiSuccess).
    // We unwrap so callers get the inner payload directly.
    const data = body?.data !== undefined ? body.data : body;
    return { data, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: msg };
  }
}
