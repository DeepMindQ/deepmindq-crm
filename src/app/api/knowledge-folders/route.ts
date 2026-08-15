import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Build folders from Briefing categories and Signal types
    const [briefingCategories, signalTypeCounts] = await Promise.all([
      db.briefing.groupBy({
        by: ['organizationId'],
        _count: true,
      }),
      db.signal.groupBy({
        by: ['signalType'],
        _count: true,
      }),
    ]);

    // Folders derived from signal types
    const signalTypeIcons: Record<string, string> = {
      hiring_change: 'users',
      leadership_change: 'user_cog',
      technology_change: 'code',
      funding_event: 'trending_up',
      market_expansion: 'globe',
      partnership: 'handshake',
      competitor_move: 'swords',
      financial_indicator: 'bar_chart',
      product_launch: 'rocket',
      regulatory: 'shield',
      customer_signal: 'message_circle',
      social_mention: 'at_sign',
    };

    const signalTypeNames: Record<string, string> = {
      hiring_change: 'Hiring Changes',
      leadership_change: 'Leadership Changes',
      technology_change: 'Technology Changes',
      funding_event: 'Funding Events',
      market_expansion: 'Market Expansion',
      partnership: 'Partnerships',
      competitor_move: 'Competitor Moves',
      financial_indicator: 'Financial Indicators',
      product_launch: 'Product Launches',
      regulatory: 'Regulatory',
      customer_signal: 'Customer Signals',
      social_mention: 'Social Mentions',
    };

    const folders = [
      {
        id: 'briefings',
        name: 'Intelligence Briefings',
        count: briefingCategories.length,
        icon: 'file_text',
      },
      ...signalTypeCounts.map((st) => ({
        id: st.signalType,
        name: signalTypeNames[st.signalType] || st.signalType,
        count: st._count,
        icon: signalTypeIcons[st.signalType] || 'folder',
      })),
    ];

    // Nodes: top organizations by intelligence score
    const nodes = await db.organization.findMany({
      take: 12,
      orderBy: { intelligenceScore: 'desc' },
      select: {
        id: true,
        name: true,
        industry: true,
        intelligenceScore: true,
        trackingStatus: true,
      },
    });

    // Edges: recent relationships
    const edges = await db.relationship.findMany({
      take: 20,
      select: {
        id: true,
        type: true,
        sourceOrgId: true,
        targetOrgId: true,
        weight: true,
      },
    });

    return NextResponse.json({ data: { folders, nodes, edges } });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch knowledge folders' }, { status: 500 });
  }
}
