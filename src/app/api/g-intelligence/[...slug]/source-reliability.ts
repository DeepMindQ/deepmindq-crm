import { NextRequest, NextResponse } from 'next/server';
import { getTopReliableSources, getUnreliableSources, getSourceReliability } from '@/lib/source-reliability';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const sort = searchParams.get('sort') || 'reliable';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (domain) {
      const score = await getSourceReliability(domain);
      return NextResponse.json({ domain, reliabilityScore: score, reliabilityPct: Math.round(score * 100) });
    }

    const sources = sort === 'unreliable'
      ? await getUnreliableSources(limit)
      : await getTopReliableSources(limit);

    return NextResponse.json({
      sources: sources.map(s => ({
        ...s,
        reliabilityPct: Math.round(s.reliabilityScore * 100),
      })),
      total: sources.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
