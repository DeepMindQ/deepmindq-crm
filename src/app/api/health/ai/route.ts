/**
 * GET /api/health/ai — AI Provider Health (unauthenticated)
 *
 * Reports AI provider configuration and cache status.
 */
import { NextResponse } from 'next/server';
import { getAIProviderStatus } from '@/lib/validate-env';
import { AICacheLayer } from '@/lib/ai-cache-layer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ai = getAIProviderStatus();
  let cacheStats = { totalEntries: 0, totalHits: 0, totalCostSaved: 0 };

  try {
    cacheStats = await AICacheLayer.getStats();
  } catch { /* cache check is best-effort */ }

  return NextResponse.json(
    {
      status: ai.count > 0 ? 'healthy' : 'degraded',
      providers: {
        configured: ai.providers,
        count: ai.count,
      },
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    },
    {
      status: ai.count > 0 ? 200 : 200, // Always 200 — degraded is still operational
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
