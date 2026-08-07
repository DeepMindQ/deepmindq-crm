/**
 * API: /api/security/rate-limits — Rate Limiting Management
 *
 * GET  — Rate limit registry, health status
 * POST — Blacklist/whitelist IP, reset limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  getRateLimitRegistry,
  getHealthStatus,
  blacklistIp,
  whitelistIp,
  removeIpFromWhitelist,
  resetLimits,
} from '@/lib/rate-limit-middleware';

export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const registry = getRateLimitRegistry();
    const health = getHealthStatus();

    return NextResponse.json({
      success: true,
      data: {
        registry,
        health,
      },
    });
  } catch (error) {
    logger.error('[API:rate-limits] GET failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to load rate limit status' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminCheck = requireAdminRole(session!);
  if (adminCheck) return adminCheck;

  try {
    const body = await request.json();
    const { action, ip } = body;

    switch (action) {
      case 'blacklist':
        if (!ip) {
          return NextResponse.json(
            { success: false, error: 'Missing ip' },
            { status: 400 },
          );
        }
        blacklistIp(ip);
        return NextResponse.json({ success: true, data: { ip, action: 'blacklisted' } });

      case 'whitelist':
        if (!ip) {
          return NextResponse.json(
            { success: false, error: 'Missing ip' },
            { status: 400 },
          );
        }
        whitelistIp(ip);
        return NextResponse.json({ success: true, data: { ip, action: 'whitelisted' } });

      case 'remove_whitelist':
        if (!ip) {
          return NextResponse.json(
            { success: false, error: 'Missing ip' },
            { status: 400 },
          );
        }
        removeIpFromWhitelist(ip);
        return NextResponse.json({ success: true, data: { ip, action: 'removed_from_whitelist' } });

      case 'reset':
        if (!body.key) {
          return NextResponse.json(
            { success: false, error: 'Missing key' },
            { status: 400 },
          );
        }
        await resetLimits(body.key);
        return NextResponse.json({ success: true, data: { key: body.key, action: 'reset' } });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error('[API:rate-limits] POST failed', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to update rate limits' },
      { status: 500 },
    );
  }
}
