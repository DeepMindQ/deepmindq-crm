/**
 * POST /api/duplicates/bulk-merge
 *
 * Merge multiple duplicate pairs at once.
 * Body: { merges: [{ survivorId, duplicateId, strategy? }] }
 * Maximum 50 merges per request.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { bulkMerge } from '@/lib/data-intelligence/dedup-engine';
import type { MergeStrategy } from '@/lib/data-intelligence/dedup-engine';

const VALID_STRATEGIES: MergeStrategy[] = ['keep_survivor', 'keep_duplicate', 'keep_most_recent'];

export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => ({}));
  const { merges } = body;
  const actor = session?.email || session?.id || 'unknown';

  if (!Array.isArray(merges) || merges.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: merges (array of {survivorId, duplicateId, strategy})' },
      { status: 400 },
    );
  }

  if (merges.length > 50) {
    return NextResponse.json(
      { success: false, error: 'Maximum 50 merges per bulk request' },
      { status: 400 },
    );
  }

  for (const m of merges) {
    if (!m.survivorId || !m.duplicateId) {
      return NextResponse.json(
        { success: false, error: 'Each merge must have survivorId and duplicateId' },
        { status: 400 },
      );
    }
    if (m.strategy && !VALID_STRATEGIES.includes(m.strategy)) {
      return NextResponse.json(
        { success: false, error: `Invalid strategy "${m.strategy}". Must be one of: ${VALID_STRATEGIES.join(', ')}` },
        { status: 400 },
      );
    }
  }

  try {
    const normalizedMerges = merges.map((m: { survivorId: string; duplicateId: string; strategy?: string }) => ({
      survivorId: m.survivorId,
      duplicateId: m.duplicateId,
      strategy: (m.strategy || 'keep_survivor') as MergeStrategy,
    }));
    const result = await bulkMerge(normalizedMerges, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error('Bulk merge API error:', { error });
    return NextResponse.json({ success: false, error: 'Bulk merge failed' }, { status: 500 });
  }
}
