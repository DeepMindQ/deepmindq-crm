/**
 * Enterprise Health — Readiness Check
 *
 * Checks all critical subsystems before reporting ready.
 * Used by /api/health/ready — must return actual system state.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

export async function getReadinessCheck(): Promise<{
  ready: boolean;
  checks: Record<string, HealthCheck>;
  timestamp: string;
}> {
  const checks: Record<string, HealthCheck> = {};

  // ── 1. Database connectivity ──
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1 as health_check`;
    checks.database = {
      name: 'Database',
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    checks.database = {
      name: 'Database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    logger.error('[Readiness] Database check failed', { error });
  }

  // ── 2. Required environment variables ──
  const requiredEnvVars = ['DATABASE_URL', 'SESSION_TOKEN_HMAC_SECRET'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  checks.environment = {
    name: 'Environment',
    status: missingVars.length === 0 ? 'healthy' : 'unhealthy',
    message: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : undefined,
  };

  // ── 3. Session table accessible ──
  try {
    const start = Date.now();
    await db.session.findFirst({ take: 1 });
    checks.sessionStore = {
      name: 'Session Store',
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    checks.sessionStore = {
      name: 'Session Store',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Session store inaccessible',
    };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

  return {
    ready: allHealthy,
    checks,
    timestamp: new Date().toISOString(),
  };
}
