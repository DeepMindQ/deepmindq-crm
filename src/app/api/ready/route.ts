import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api-logging-middleware';

interface DependencyCheck {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

const READINESS_TIMEOUT_MS = 5_000;

async function readyHandler(_request: Request) {
  const checks: DependencyCheck[] = [];

  // ── Database readiness ──
  if (process.env.DATABASE_URL) {
    const dbStart = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB readiness timeout')), READINESS_TIMEOUT_MS)
        ),
      ]);
      checks.push({ name: 'database', healthy: true, latencyMs: Date.now() - dbStart });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      checks.push({ name: 'database', healthy: false, error: msg });
    }
  } else {
    checks.push({ name: 'database', healthy: false, error: 'DATABASE_URL not configured' });
  }

  // ── Redis readiness (via unified redis-client abstraction) ──
  try {
    const { getRedisClient, getClientType } = await import('@/lib/redis-client');
    const clientType = getClientType();
    if (clientType !== 'none') {
      const client = await getRedisClient();
      if (client) {
        const redisStart = Date.now();
        try {
          const pong = await Promise.race([
            client.ping(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Redis readiness timeout')), READINESS_TIMEOUT_MS)
            ),
          ]);
          checks.push({ name: 'redis', healthy: pong === 'PONG', latencyMs: Date.now() - redisStart, error: undefined });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          checks.push({ name: 'redis', healthy: false, error: msg });
        }
      } else {
        checks.push({ name: 'redis', healthy: false, error: 'Redis client initialization failed' });
      }
    }
    // If clientType === 'none', Redis is not configured — skip the check
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    checks.push({ name: 'redis', healthy: false, error: msg });
  }

  // ── Evaluate overall readiness ──
  const allHealthy = checks.every(c => c.healthy);
  const failedChecks = checks.filter(c => !c.healthy);

  const body = {
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
    ...(failedChecks.length > 0 ? { failedDependencies: failedChecks.map(c => c.name) } : {}),
  };

  if (!allHealthy) {
    return NextResponse.json(body, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Retry-After': '5',
      },
    });
  }

  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export const GET = withApiLogging(readyHandler, '/api/ready');
