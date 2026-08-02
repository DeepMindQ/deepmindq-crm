/* ═══════════════════════════════════════════════════
   In-Memory OTP Cache
   
   Used as fallback when DB is unavailable in serverless.
   Safe for single-user system (one authorized email).
   ═══════════════════════════════════════════════════ */

interface OtpCacheEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

// Module-level Map — persists across invocations in same serverless instance
export const otpCache = new Map<string, OtpCacheEntry>();

export function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return (Math.abs(num) % 1_000_000).toString().padStart(6, '0');
}

export function cleanupExpired() {
  const now = Date.now();
  for (const [key, val] of otpCache.entries()) {
    if (val.expiresAt < now) otpCache.delete(key);
  }
}

// Periodic cleanup every 5 minutes to prevent stale entries accumulating
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpired();
  }, 5 * 60 * 1000);
}
