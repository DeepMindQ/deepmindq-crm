import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { scanForDuplicates } from '@/lib/data-intelligence/dedup-engine';

/* ═══════════════════════════════════════════════════════════════
   POST /api/duplicates/scan

   Trigger a full company dedup scan. Returns scan results
   including clusters of duplicate candidates.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const result = await scanForDuplicates();
    return NextResponse.json({
      success: true,
      scanId: result.scanId,
      totalCompaniesScanned: result.totalCompaniesScanned,
      clustersFound: result.clustersFound,
      clusters: result.clusters,
      scannedAt: result.scannedAt,
      durationMs: result.durationMs,
    });
  } catch (error) {
    logger.error('Dedup scan API error:', { error });
    return NextResponse.json(
      { success: false, error: 'Dedup scan failed' },
      { status: 500 },
    );
  }
}
