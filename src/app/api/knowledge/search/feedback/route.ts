import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getVectorIndex } from '@/lib/vector-index';

/* ═══════════════════════════════════════════════════
   POST /api/knowledge/search/feedback

   Record user feedback (upvote/downvote) on a search result.
   Increments CapabilityAsset.upvotes or downvotes.
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assetId, type } = body;

    if (!assetId || !type) {
      return NextResponse.json(
        { error: 'assetId and type ("upvote"|"downvote") are required' },
        { status: 400 }
      );
    }

    if (type !== 'upvote' && type !== 'downvote') {
      return NextResponse.json(
        { error: 'type must be "upvote" or "downvote"' },
        { status: 400 }
      );
    }

    const updateField = type === 'upvote' ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } };

    const updated = await db.capabilityAsset.update({
      where: { id: assetId },
      data: updateField,
    });

    return NextResponse.json({
      success: true,
      assetId: updated.id,
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
    });
  } catch (error) {
    console.error('Search feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}