/**
 * In-memory rate limiter for API endpoints.
 * Provides both a simple check interface and a structured result interface.
 */

import { registerTimer } from '@/lib/timer-registry';

// ── Structured rate limiter (original interface) ─────────────

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: string;
  limit: number; // max requests
  windowMs: number; // time window in milliseconds
}

// Store: key -> { count: number, resetAt: number }
const MAX_STORE_SIZE = 100_000;
const structuredStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const { key, limit, windowMs } = options;

  let entry = structuredStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    structuredStore.set(key, entry);
  }

  // Evict oldest entries if store exceeds max size
  if (structuredStore.size > MAX_STORE_SIZE) {
    let oldestKey: string | undefined;
    let oldestReset = Infinity;
    for (const [k, e] of structuredStore.entries()) {
      if (e.resetAt < oldestReset) {
        oldestReset = e.resetAt;
        oldestKey = k;
      }
    }
    if (oldestKey) structuredStore.delete(oldestKey);
  }

  entry.count++;

  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

// Pre-configured limiters for common use cases
export const apiRateLimit = (ip: string, endpoint: string) =>
  rateLimit({ key: `api:${ip}:${endpoint}`, limit: 100, windowMs: 60_000 });

export const emailSendRateLimit = (userId: string) =>
  rateLimit({ key: `email:send:${userId}`, limit: 50, windowMs: 60_000 * 60 }); // 50 per hour per user

// ── Simple sliding-window rate limiter (new interface) ────────

interface RateLimitEntry {
  timestamps: number[];
}

const slidingStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // 1 minute window

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (IP address or user ID)
 * @param maxRequests - Maximum requests allowed per window
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(key: string, maxRequests: number = 30): boolean {
  const now = Date.now();
  let entry = slidingStore.get(key);

  if (!entry) {
    entry = { timestamps: [now] };
    slidingStore.set(key, entry);
    return true;
  }

  // Clean old timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (entry.timestamps.length >= maxRequests) {
    return false; // Rate limited
  }

  entry.timestamps.push(now);
  return true;
}

/**
 * Get remaining requests for a key within the current window.
 */
export function getRemainingRequests(key: string, maxRequests: number = 30): number {
  const now = Date.now();
  const entry = slidingStore.get(key);
  if (!entry) return maxRequests;
  const recent = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);
  return Math.max(0, maxRequests - recent.length);
}

// Cleanup old entries every 5 minutes
registerTimer(
  setInterval(
    () => {
      const now = Date.now();
      // Cleanup structured store
      for (const [key, entry] of structuredStore.entries()) {
        if (entry.resetAt <= now) structuredStore.delete(key);
      }
      // Cleanup sliding window store
      for (const [key, entry] of slidingStore.entries()) {
        entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);
        if (entry.timestamps.length === 0) {
          slidingStore.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  ),
);
