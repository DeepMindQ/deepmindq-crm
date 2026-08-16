import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Validate cron route authorization using timing-safe comparison.
 *
 * Compares the incoming `Authorization: Bearer <token>` header against
 * the server-side `CRON_SECRET` env var using `crypto.timingSafeEqual`
 * to prevent timing side-channel attacks.
 *
 * @returns `true` if the request is authorized, `false` otherwise.
 */
export function validateCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const expected = `Bearer ${secret}`;
  const actual = authHeader;

  // Timing-safe comparison to prevent side-channel attacks
  try {
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(actual);

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}
