import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/capabilities/dedup-check
   C-06: Scan all assets for duplicates by contentHash
   ═══════════════════════════════════════════════════ */
export async function POST() {
  try {
    const assets = await db.capabilityAsset.findMany({
      select: { id: true, title: true, contentHash: true, category: true, version: true },
    });

    const hashGroups: Record<string, typeof assets> = {};
    for (const asset of assets) {
      const hash = (asset as any).contentHash;
      if (hash) {
        if (!hashGroups[hash]) hashGroups[hash] = [];
        hashGroups[hash].push(asset);
      }
    }

    const duplicates = Object.entries(hashGroups)
      .filter(([, group]) => group.length > 1)
      .map(([hash, group]) => ({
        contentHash: hash,
        count: group.length,
        assets: group.map(a => ({ id: a.id, title: a.title, category: a.category, version: a.version })),
      }));

    const totalAssets = assets.length;
    const uniqueHashes = Object.keys(hashGroups).length;
    const duplicateCount = duplicates.reduce((sum, d) => sum + d.count, 0);
    const savingsCount = duplicateCount - uniqueHashes + (totalAssets - Object.keys(hashGroups).length);

    return NextResponse.json({
      totalAssets,
      assetsWithHash: assets.filter(a => (a as any).contentHash).length,
      uniqueHashes,
      duplicateGroups: duplicates.length,
      duplicateAssets: duplicateCount,
      potentialSavings: Math.max(0, savingsCount),
      duplicates,
    });
  } catch (error) {
    console.error('Dedup check error:', error);
    return NextResponse.json({ error: 'Dedup check failed' }, { status: 500 });
  }
}