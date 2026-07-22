import { NextResponse } from 'next/server';
import { recalculateAllScores, getScoreBreakdown } from '@/lib/lead-scoring';

export async function POST(request: Request) {
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
    console.error('Recalculate scores error:', error);
    return NextResponse.json({ error: 'Failed to recalculate scores' }, { status: 500 });
  }
}