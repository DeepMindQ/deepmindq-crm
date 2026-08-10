/**
 * POST /api/duplicates/merge
 *
 * Merge a duplicate company into a survivor.
 * Body: { survivorId, duplicateId, strategy: 'keep_survivor' | 'keep_duplicate' | 'keep_most_recent' }
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { mergeDuplicate, skipDuplicate } from '@/lib/data-intelligence/dedup-engine';
import type { MergeStrategy } from '@/lib/data-intelligence/dedup-engine';
// Note: mergeDuplicate() already wraps its multi-step DB writes in db.$transaction() internally.
// skipDuplicate() is a single DB write and is inherently atomic.
// No additional transaction wrapper is needed at the route level.

const VALID_STRATEGIES: MergeStrategy[] = ['keep_survivor', 'keep_duplicate', 'keep_most_recent'];

export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const body = await request.json().catch(() => ({}));
  const { survivorId, duplicateId, strategy, action, reason } = body;
  const actor = session?.email || session?.id || 'unknown';

  // Handle skip action
  if (action === 'skip') {
    if (!duplicateId || !survivorId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: survivorId, duplicateId' },
        { status: 400 },
      );
    }

    try {
      const result = await skipDuplicate(survivorId, duplicateId, reason || 'Manually marked as not duplicate', actor);
      if (result.success) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    } catch (error) {
      logger.error('Skip duplicate API error:', { error });
      return NextResponse.json({ success: false, error: 'Skip failed' }, { status: 500 });
    }
  }

  // Handle merge action
  if (!survivorId || !duplicateId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: survivorId, duplicateId' },
      { status: 400 },
    );
  }

  if (strategy && !VALID_STRATEGIES.includes(strategy)) {
    return NextResponse.json(
      { success: false, error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const result = await mergeDuplicate(
      { survivorId, duplicateId, strategy: strategy || 'keep_survivor' },
      actor,
      'manual_merge',
    );

    if (result.success) {
      const { success: _s, ...rest } = result;
      return NextResponse.json({ success: true, ...rest });
    }
    const { success: _s2, ...errRest } = result;
    return NextResponse.json({ success: false, ...errRest }, { status: 400 });
  } catch (error) {
    logger.error('Merge API error:', { error, survivorId, duplicateId });
    return NextResponse.json({ success: false, error: 'Merge failed' }, { status: 500 });
  }
}
