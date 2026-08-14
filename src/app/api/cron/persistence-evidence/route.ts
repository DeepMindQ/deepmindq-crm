import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

function validateCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

/**
 * GET /api/cron/persistence-evidence — Collect and persist intelligence evidence.
 *
 * Fetches new intelligence evidence from external sources (OSINT feeds,
 * API integrations, webhooks) and persists them into the intelligence
 * store for downstream analysis and signal generation.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Every 15–30 minutes.
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/persistence-evidence: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/persistence-evidence: started');

  // TODO: Poll configured external sources, parse and deduplicate evidence, persist to store
  // Example:
  //   const sources = await evidenceSourceRegistry.listActive();
  //   let evidenceCollected = 0;
  //   for (const source of sources) {
  //     const items = await source.fetchNew();
  //     await evidenceStore.bulkInsert(items);
  //     evidenceCollected += items.length;
  //   }
  const evidenceCollected = 0;

  const durationMs = Date.now() - start;
  logger.info('cron/persistence-evidence: completed', { evidenceCollected, durationMs });

  return NextResponse.json({ evidenceCollected });
}
