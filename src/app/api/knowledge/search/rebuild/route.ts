import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getVectorIndex } from '@/lib/vector-index';

/* ═══════════════════════════════════════════════════
   POST /api/knowledge/search/rebuild

   Force-rebuild the in-memory TF-IDF vector index
   from all active capability assets.
   ═══════════════════════════════════════════════════ */
export async function POST() {
  try {
    const index = getVectorIndex();

    // Load all active assets from DB
    const assets = await db.capabilityAsset.findMany({
      where: { isActive: true },
    });

    // Build the vector index
    const info = index.build(assets);

    return NextResponse.json({
      success: true,
      message: `Vector index rebuilt with ${info.assetCount} assets and ${info.vocabSize} vocabulary terms`,
      info,
    });
  } catch (error) {
    console.error('Vector index rebuild error:', error);
    return NextResponse.json(
      { error: 'Failed to rebuild vector index' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   GET /api/knowledge/search/rebuild

   Return current index status without rebuilding.
   ═══════════════════════════════════════════════════ */
export async function GET() {
  try {
    const index = getVectorIndex();
    return NextResponse.json({
      ready: index.isReady(),
      info: index.getInfo(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get index status' },
      { status: 500 }
    );
  }
}