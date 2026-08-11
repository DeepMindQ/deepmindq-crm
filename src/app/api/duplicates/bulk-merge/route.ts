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
import { validateBody } from '@/lib/apiHelpers';
import { duplicateBulkMergePostSchema } from '@/lib/validation-schemas';

export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const rawBody = await request.json().catch(() => ({}));
  const parsed = validateBody(duplicateBulkMergePostSchema, rawBody);
  if (parsed instanceof Response) return parsed;
  const { merges } = parsed;
  const actor = session?.email || session?.id || 'unknown';

  try {
    const normalizedMerges = merges.map((m) => ({
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