/**
 * Phase 5.7 — API Rate Limiting & Abuse Prevention
 *
 * Production-grade rate limiting middleware providing:
 *   - Per-endpoint rate limit registry
 *   - Per-user and per-IP rate limiting
 *   - Abuse pattern detection (burst, sustained)
 *   - Rate limit headers in responses (X-RateLimit-*)
 *   - Whitelist/blacklist management
 *   - Admin override capabilities
 *   - Rate limit status API
 *
 * DEPENDS ON: rate-limit.ts, distributed-rate-limit.ts
 *
 * DESIGN:
 *   - Uses distributed-rate-limit.ts for Redis-backed limiting
 *   - Falls back to in-memory if Redis is unavailable
 *   - Endpoint-specific limits configured in LIMIT_REGISTRY
 *   - Users with 'admin' role are exempt from rate limiting
 */

import { logger } from '@/lib/logger';
import { audit, AuditCategory } from '@/lib/audit-logger';
import { distributedRateLimit, getRateLimitHealth } from '@/lib/distributed-rate-limit';

// ── Types ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Requests allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Description of what this limit protects */
  description: string;
  /** Whether admins are exempt */
  adminExempt?: boolean;
}

export interface RateLimitMiddlewareResult {
  allowed: boolean;
  headers: Record<string, string>;
  status?: number;
  body?: Record<string, unknown>;
}

export interface AbuseDetectionResult {
  isAbuse: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface RateLimitStatus {
  endpoint: string;
  limit: number;
  windowMs: number;
  currentUsage: number;
  remaining: number;
  resetAt: number;
  backend: 'redis' | 'memory' | 'disabled';
}

// ── Endpoint Limit Registry ──────────────────────────────────────────

/**
 * Registry of per-endpoint rate limits.
 * Wildcard patterns supported (e.g., '/api/ai/*').
 * More specific paths take precedence over wildcards.
 */
const LIMIT_REGISTRY: Array<{
  pattern: string;
  config: RateLimitConfig;
  regex: RegExp;
}> = [
  // AI endpoints (expensive)
  {
    pattern: '/api/ai/chat',
    config: { limit: 30, windowMs: 60_000, description: 'AI chat', adminExempt: true },
    regex: /^\/api\/ai\/chat/,
  },
  {
    pattern: '/api/ai/advisor',
    config: { limit: 20, windowMs: 60_000, description: 'AI advisor', adminExempt: true },
    regex: /^\/api\/ai\/advisor/,
  },
  {
    pattern: '/api/research',
    config: { limit: 15, windowMs: 60_000, description: 'AI research', adminExempt: true },
    regex: /^\/api\/research/,
  },
  {
    pattern: '/api/reasoning',
    config: { limit: 10, windowMs: 60_000, description: 'AI reasoning', adminExempt: true },
    regex: /^\/api\/reasoning/,
  },

  // Email endpoints (rate-limited to prevent spam)
  {
    pattern: '/api/replies',
    config: { limit: 50, windowMs: 60_000 * 60, description: 'Email replies', adminExempt: true },
    regex: /^\/api\/replies/,
  },
  {
    pattern: '/api/drafts',
    config: { limit: 100, windowMs: 60_000, description: 'Draft operations', adminExempt: true },
    regex: /^\/api\/drafts/,
  },

  // Data import/export
  {
    pattern: '/api/imports',
    config: { limit: 10, windowMs: 60_000 * 60, description: 'Data imports', adminExempt: true },
    regex: /^\/api\/imports/,
  },
  {
    pattern: '/api/export',
    config: { limit: 20, windowMs: 60_000 * 60, description: 'Data exports', adminExempt: true },
    regex: /^\/api\/export/,
  },

  // Auth endpoints (prevent brute force)
  {
    pattern: '/api/request-otp',
    config: { limit: 5, windowMs: 60_000 * 15, description: 'OTP requests', adminExempt: false },
    regex: /^\/api\/request-otp/,
  },
  {
    pattern: '/api/verify-otp',
    config: {
      limit: 10,
      windowMs: 60_000 * 15,
      description: 'OTP verification',
      adminExempt: false,
    },
    regex: /^\/api\/verify-otp/,
  },

  // Admin endpoints
  {
    pattern: '/api/seed',
    config: { limit: 2, windowMs: 60_000 * 60, description: 'Seed data', adminExempt: false },
    regex: /^\/api\/seed/,
  },
  {
    pattern: '/api/settings',
    config: { limit: 50, windowMs: 60_000, description: 'Settings changes', adminExempt: false },
    regex: /^\/api\/settings/,
  },

  // Default for all other API endpoints
  {
    pattern: '/api/*',
    config: { limit: 200, windowMs: 60_000, description: 'General API', adminExempt: true },
    regex: /^\/api\//,
  },
];

// ── IP Whitelist/Blacklist ───────────────────────────────────────────

const IP_BLACKLIST = new Set<string>();
const IP_WHITELIST = new Set<string>();

/**
 * Add an IP to the blacklist (permanent rate block).
 */
export function blacklistIp(ip: string): void {
  IP_BLACKLIST.add(ip);
  logger.warn(`[RateLimit] IP blacklisted: ${ip}`);
}

/**
 * Remove an IP from the blacklist.
 */
export function whitelistIp(ip: string): void {
  IP_BLACKLIST.delete(ip);
  IP_WHITELIST.add(ip);
  logger.info(`[RateLimit] IP whitelisted: ${ip}`);
}

/**
 * Remove an IP from the whitelist.
 */
export function removeIpFromWhitelist(ip: string): void {
  IP_WHITELIST.delete(ip);
}

// ── Core Rate Limit Check ────────────────────────────────────────────

/**
 * Find the most specific rate limit config for a path.
 */
function findLimitConfig(pathname: string): {
  pattern: string;
  config: RateLimitConfig;
} | null {
  // Try exact matches first, then wildcards
  let bestMatch: { pattern: string; config: RateLimitConfig; regex: RegExp } | null = null;
  let bestMatchLength = 0;

  for (const entry of LIMIT_REGISTRY) {
    if (entry.regex.test(pathname)) {
      // More specific (longer) patterns take precedence
      if (entry.pattern.length > bestMatchLength) {
        bestMatchLength = entry.pattern.length;
        bestMatch = entry;
      }
    }
  }

  return bestMatch ? { pattern: bestMatch.pattern, config: bestMatch.config } : null;
}

/**
 * Perform rate limit check for a request.
 *
 * @param pathname - Request path (e.g., '/api/companies')
 * @param ip - Client IP address
 * @param userId - Authenticated user ID (optional)
 * @param userRole - User role (optional, for admin exemption)
 */
export async function checkRateLimit(
  pathname: string,
  ip: string,
  userId?: string,
  userRole?: string,
): Promise<RateLimitMiddlewareResult> {
  // Check IP blacklist FIRST — always enforced even when rate limiting is disabled
  if (IP_BLACKLIST.has(ip)) {
    await audit({
      action: `Blocked request from blacklisted IP`,
      category: 'rate_limit',
      severity: 'warn',
      ip,
      path: pathname,
    });

    return {
      allowed: false,
      headers: {
        'Retry-After': '3600',
        'X-RateLimit-Blocked': 'blacklist',
      },
      status: 429,
      body: {
        success: false,
        error: 'Too many requests. Your access has been restricted.',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Feature flag: disable rate limiting entirely (but after blacklist check)
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': '-1',
        'X-RateLimit-Remaining': '-1',
        'X-RateLimit-Reset': '-1',
        'X-RateLimit-Backend': 'disabled',
      },
    };
  }

  // Check IP whitelist (skip rate limiting)
  if (IP_WHITELIST.has(ip)) {
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': '-1',
        'X-RateLimit-Remaining': '-1',
        'X-RateLimit-Backend': 'whitelisted',
      },
    };
  }

  // Find limit config
  const limitMatch = findLimitConfig(pathname);
  if (!limitMatch) {
    return { allowed: true, headers: {} };
  }

  const { config } = limitMatch;

  // Admin exemption
  if (config.adminExempt && userRole === 'admin') {
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': String(config.limit),
        'X-RateLimit-Remaining': String(config.limit),
        'X-RateLimit-Reset': String(Date.now() + config.windowMs),
        'X-RateLimit-Backend': 'admin-exempt',
      },
    };
  }

  // Use userId as identifier if available, otherwise IP
  const identifier = userId || ip;

  // Perform distributed rate limit check
  const result = await distributedRateLimit({
    key: `endpoint:${pathname}`,
    limit: config.limit,
    windowMs: config.windowMs,
    identifier,
  });

  if (!result.success) {
    // Log rate limit event
    await audit({
      action: `Rate limit exceeded for ${config.description}`,
      category: 'rate_limit',
      severity: 'warn',
      ip,
      path: pathname,
      details: {
        limit: config.limit,
        windowMs: config.windowMs,
        userId: userId || undefined,
        backend: result.backend,
      },
    });

    // Check for abuse patterns
    const abuseCheck = detectAbusePattern(pathname, identifier, config);

    if (abuseCheck.isAbuse && abuseCheck.severity === 'critical') {
      await audit({
        action: `Critical abuse pattern detected: ${abuseCheck.reason}`,
        category: 'security',
        severity: 'critical',
        ip,
        path: pathname,
        details: abuseCheck as unknown as Record<string, unknown>,
      });
    }

    return {
      allowed: false,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
        'X-RateLimit-Backend': result.backend,
        'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
      status: 429,
      body: {
        success: false,
        error: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetAt),
      'X-RateLimit-Backend': result.backend,
    },
  };
}

// ── Abuse Detection ─────────────────────────────────────────────────

// Track per-identifier request counts for abuse detection
const requestHistory = new Map<string, { timestamps: number[] }>();
const ABUSE_WINDOW_MS = 60_000 * 5; // 5-minute window for burst detection
const ABUSE_SUSTAINED_MS = 60_000 * 60; // 1-hour sustained
const ABUSE_CLEANUP_INTERVAL = 60_000 * 10; // Clean up every 10 minutes

// Periodic cleanup of old request history
setInterval(() => {
  const now = Date.now();
  for (const [key, history] of requestHistory.entries()) {
    history.timestamps = history.timestamps.filter((t) => now - t < ABUSE_SUSTAINED_MS);
    if (history.timestamps.length === 0) {
      requestHistory.delete(key);
    }
  }
}, ABUSE_CLEANUP_INTERVAL);

/**
 * Detect abuse patterns based on request frequency.
 */
function detectAbusePattern(
  pathname: string,
  identifier: string,
  config: RateLimitConfig,
): AbuseDetectionResult {
  const now = Date.now();

  // Get or create history
  let history = requestHistory.get(identifier);
  if (!history) {
    history = { timestamps: [] };
    requestHistory.set(identifier, history);
  }

  history.timestamps.push(now);

  // Check burst (many requests in short time)
  const recentBurst = history.timestamps.filter((t) => now - t < ABUSE_WINDOW_MS).length;

  // Check sustained (consistent high rate)
  const sustainedRate = history.timestamps.filter((t) => now - t < ABUSE_SUSTAINED_MS).length;

  if (recentBurst > config.limit * 3) {
    return {
      isAbuse: true,
      reason: `Burst pattern: ${recentBurst} requests in 5 minutes (limit: ${config.limit}/min)`,
      severity: 'high',
      recommendation: 'Consider IP blacklist',
    };
  }

  if (sustainedRate > config.limit * 20) {
    return {
      isAbuse: true,
      reason: `Sustained high rate: ${sustainedRate} requests in 1 hour`,
      severity: 'medium',
      recommendation: 'Monitor for continued abuse',
    };
  }

  if (recentBurst > config.limit * 2) {
    return {
      isAbuse: true,
      reason: `Elevated burst: ${recentBurst} requests in 5 minutes`,
      severity: 'low',
      recommendation: 'No action needed',
    };
  }

  return {
    isAbuse: false,
    reason: 'Normal traffic pattern',
    severity: 'low',
    recommendation: 'None',
  };
}

// ── Status & Admin API ───────────────────────────────────────────────

/**
 * Get rate limit status for all configured endpoints.
 */
export function getRateLimitRegistry(): Array<{
  pattern: string;
  limit: number;
  windowMs: number;
  windowMinutes: number;
  description: string;
  adminExempt: boolean;
}> {
  return LIMIT_REGISTRY.map((entry) => ({
    pattern: entry.pattern,
    limit: entry.config.limit,
    windowMs: entry.config.windowMs,
    windowMinutes: Math.round(entry.config.windowMs / 60_000),
    description: entry.config.description,
    adminExempt: entry.config.adminExempt ?? true,
  }));
}

/**
 * Get current rate limit health (Redis status).
 */
export function getHealthStatus() {
  return {
    rateLimiter: getRateLimitHealth(),
    blacklistSize: IP_BLACKLIST.size,
    whitelistSize: IP_WHITELIST.size,
    abuseTrackingEntries: requestHistory.size,
  };
}

/**
 * Reset rate limits for a specific identifier (admin use).
 */
export async function resetLimits(key: string): Promise<boolean> {
  const { resetRateLimit } = await import('@/lib/distributed-rate-limit');
  return resetRateLimit(key);
}
