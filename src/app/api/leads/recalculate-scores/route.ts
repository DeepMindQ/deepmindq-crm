import { NextResponse } from 'next/server';
import { recalculateAllScores, getScoreBreakdown } from '@/lib/lead-scoring';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function POST(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { contactId } = body;

    // If contactId provided, return breakdown for a single contact
    if (contactId) {
      const breakdown = await getScoreBreakdown(contactId);
      if (!breakdown) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      return NextResponse.json({ breakdown });
    }

    // Otherwise recalculate all scores
    const result = await recalculateAllScores();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error('Recalculate scores error:', { error: error });
    return NextResponse.json({ error: 'Failed to recalculate scores' }, { status: 500 });
  }
}