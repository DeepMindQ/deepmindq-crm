import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const [fundingCount, hiringCount, techCount, marketCount, partnershipCount, competitorCount] =
      await Promise.all([
        db.signal.count({ where: { signalType: 'funding_event' } }),
        db.signal.count({ where: { signalType: 'hiring_change' } }),
        db.signal.count({ where: { signalType: 'technology_change' } }),
        db.signal.count({ where: { signalType: 'market_expansion' } }),
        db.signal.count({ where: { signalType: 'partnership' } }),
        db.signal.count({ where: { signalType: 'competitor_move' } }),
      ]);

    const rules = [
      {
        id: 'funding',
        name: 'Funding Signals',
        description: 'Detect funding rounds, IPOs, and investment events',
        enabled: true,
        icon: 'trending_up',
        count: fundingCount,
      },
      {
        id: 'hiring',
        name: 'Hiring Patterns',
        description: 'Track significant hiring changes and team growth',
        enabled: true,
        icon: 'users',
        count: hiringCount,
      },
      {
        id: 'technology',
        name: 'Tech Stack Changes',
        description: 'Monitor technology adoption and migration patterns',
        enabled: true,
        icon: 'code',
        count: techCount,
      },
      {
        id: 'market',
        name: 'Market Signals',
        description: 'Identify market expansion, partnerships, and competitive moves',
        enabled: false,
        icon: 'globe',
        count: marketCount + partnershipCount + competitorCount,
      },
    ];

    return NextResponse.json({ data: rules });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch activation rules' }, { status: 500 });
  }
}
