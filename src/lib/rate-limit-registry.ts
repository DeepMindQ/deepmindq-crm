/**
 * Rate Limit Registry — Per-endpoint rate limit definitions.
 *
 * Defines granular rate limits for different API endpoint categories.
 * Used by the proxy layer (proxy.ts) to apply tighter limits on
 * expensive or sensitive operations beyond the general 100/min default.
 *
 * DESIGN:
 *   - Each entry defines { windowMs, maxRequests, name }
 *   - getRateLimitConfig(path) matches paths using prefix patterns
 *   - Public/auth paths are NOT matched (handled separately)
 *   - Returns undefined for paths with no specific config (uses general default)
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Human-readable name for logging/metrics */
  name: string
  /** Time window in milliseconds */
  windowMs: number
  /** Maximum requests allowed in the window */
  maxRequests: number
}

export interface RateLimitEntry {
  /** Path prefix pattern to match (supports glob-style trailing *) */
  pattern: string
  /** Rate limit configuration for matching paths */
  config: RateLimitConfig
}

// ─── Registry ───────────────────────────────────────────────────────────

/**
 * Per-endpoint rate limit definitions.
 *
 * Categories:
 *   - AI endpoints: Expensive LLM calls, rate limited tightly
 *   - Imports: Heavy data processing operations
 *   - Exports: Resource-intensive data generation
 *   - Search: Computationally expensive queries
 *   - Bulk/Batch: Mass operations that can overwhelm the system
 */
export const RATE_LIMITS: RateLimitEntry[] = [
  // ── AI Endpoints (/api/ai/*) ──
  // AI calls are expensive (LLM API costs + latency). Tight limits.
  {
    pattern: '/api/ai/chat-stream',
    config: {
      name: 'ai-chat-stream',
      windowMs: 60_000, // 1 minute
      maxRequests: 20,
    },
  },
  {
    pattern: '/api/ai/chat',
    config: {
      name: 'ai-chat',
      windowMs: 60_000,
      maxRequests: 30,
    },
  },
  {
    pattern: '/api/ai/enrich',
    config: {
      name: 'ai-enrich',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/generate',
    config: {
      name: 'ai-generate',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/contact-intelligence',
    config: {
      name: 'ai-contact-intelligence',
      windowMs: 60_000,
      maxRequests: 20,
    },
  },
  {
    pattern: '/api/ai/account-brief',
    config: {
      name: 'ai-account-brief',
      windowMs: 60_000,
      maxRequests: 10,
    },
  },
  {
    pattern: '/api/ai/revenue-score',
    config: {
      name: 'ai-revenue-score',
      windowMs: 60_000,
      maxRequests: 20,
    },
  },
  {
    pattern: '/api/ai/score-leads',
    config: {
      name: 'ai-score-leads',
      windowMs: 60_000,
      maxRequests: 10,
    },
  },
  {
    pattern: '/api/ai/score-contacts',
    config: {
      name: 'ai-score-contacts',
      windowMs: 60_000,
      maxRequests: 10,
    },
  },
  {
    pattern: '/api/ai/email-intelligence',
    config: {
      name: 'ai-email-intelligence',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/deal-coaching',
    config: {
      name: 'ai-deal-coaching',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/conversation-plan',
    config: {
      name: 'ai-conversation-plan',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/buying-intent',
    config: {
      name: 'ai-buying-intent',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/signals',
    config: {
      name: 'ai-signals',
      windowMs: 60_000,
      maxRequests: 20,
    },
  },
  {
    pattern: '/api/ai/insights',
    config: {
      name: 'ai-insights',
      windowMs: 60_000,
      maxRequests: 20,
    },
  },
  {
    pattern: '/api/ai/summarize',
    config: {
      name: 'ai-summarize',
      windowMs: 60_000,
      maxRequests: 20,
    },
  },
  {
    pattern: '/api/ai/recommendations',
    config: {
      name: 'ai-recommendations',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },
  {
    pattern: '/api/ai/query',
    config: {
      name: 'ai-query',
      windowMs: 60_000,
      maxRequests: 20,
    },
  },
  // Catch-all for other /api/ai/* endpoints
  {
    pattern: '/api/ai/',
    config: {
      name: 'ai-general',
      windowMs: 60_000,
      maxRequests: 30,
    },
  },

  // ── Import Endpoints (/api/imports) ──
  // Data imports are heavy — DB writes + potential AI enrichment.
  {
    pattern: '/api/imports',
    config: {
      name: 'imports',
      windowMs: 60_000,
      maxRequests: 10,
    },
  },

  // ── Export Endpoints (/api/export*) ──
  // Exports generate large files — rate limit to prevent abuse.
  {
    pattern: '/api/export',
    config: {
      name: 'exports',
      windowMs: 60_000,
      maxRequests: 15,
    },
  },

  // ── Search Endpoints (/api/search*) ──
  // Search queries can be computationally expensive.
  {
    pattern: '/api/search',
    config: {
      name: 'search',
      windowMs: 60_000,
      maxRequests: 30,
    },
  },

  // ── Bulk Operations (/api/bulk/*) ──
  // Mass operations — very resource intensive.
  {
    pattern: '/api/bulk/',
    config: {
      name: 'bulk-operations',
      windowMs: 60_000,
      maxRequests: 5,
    },
  },

  // ── Batch Operations (/api/batches) ──
  // Batch processing — resource intensive.
  {
    pattern: '/api/batches',
    config: {
      name: 'batch-operations',
      windowMs: 60_000,
      maxRequests: 5,
    },
  },
]

// ─── Path Matching ──────────────────────────────────────────────────────

// Public/auth paths that should never be matched by the registry.
// These are handled separately in proxy.ts.
const EXCLUDED_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/tracking/',
  '/api/unsubscribe',
  '/api/cron/',
]

/**
 * Get the rate limit configuration for a given API path.
 *
 * Matching rules:
 *   1. Public/auth paths return undefined (handled elsewhere)
 *   2. Exact matches are preferred
 *   3. Longest prefix match wins
 *   4. Returns undefined for paths with no specific config
 *
 * @param path - The request pathname (e.g., '/api/ai/chat')
 * @returns RateLimitConfig if a specific config exists, undefined otherwise
 */
export function getRateLimitConfig(path: string): RateLimitConfig | undefined {
  // Skip public/auth paths
  for (const excluded of EXCLUDED_PREFIXES) {
    if (path === excluded || path.startsWith(excluded)) {
      return undefined
    }
  }

  let bestMatch: RateLimitConfig | undefined
  let bestMatchLength = 0

  for (const entry of RATE_LIMITS) {
    const { pattern, config } = entry

    // Exact match
    if (path === pattern) {
      return config
    }

    // Prefix match (pattern ends with / or matches as directory prefix)
    if (path.startsWith(pattern)) {
      // Ensure it's a proper prefix (e.g., /api/ai/ matches /api/ai/chat
      // but /api/ai doesn't match /api/ai-extra)
      const nextChar = path.charAt(pattern.length)
      if (nextChar === '/' || nextChar === '' || pattern.endsWith('/')) {
        if (pattern.length > bestMatchLength) {
          bestMatchLength = pattern.length
          bestMatch = config
        }
      }
    }
  }

  return bestMatch
}
