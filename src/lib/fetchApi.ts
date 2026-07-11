interface FetchApiOptions extends RequestInit {
  params?: Record<string, string | number | undefined>
}

export async function fetchApi<T = any>(
  url: string,
  options: FetchApiOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    let fullUrl = url

    // Build query string from params
    if (options.params) {
      const params = new URLSearchParams()
      for (const [key, val] of Object.entries(options.params)) {
        if (val !== undefined && val !== null && val !== '') {
          params.set(key, String(val))
        }
      }
      const qs = params.toString()
      if (qs) fullUrl += (url.includes('?') ? '&' : '?') + qs
    }

    // Destructure so params don't leak into fetch init
    const { params: _params, ...fetchOpts } = options

    const res = await fetch(fullUrl, { ...fetchOpts, credentials: 'include' })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return {
        data: null,
        error: body.error || `Request failed with status ${res.status}`,
      }
    }

    const data = await res.json()
    return { data, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return { data: null, error: msg }
  }
}