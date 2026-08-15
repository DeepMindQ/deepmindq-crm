import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const createFolderSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Fetch real KnowledgeFolder records with entity counts
    const folders = await db.knowledgeFolder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { entities: true } },
      },
    });

    // Also build derived folders from signal types for backwards compatibility
    const [briefingCategories, signalTypeCounts] = await Promise.all([
      db.briefing.groupBy({ by: ['organizationId'], _count: true }),
      db.signal.groupBy({ by: ['signalType'], _count: true }),
    ]);

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

    const derivedFolders = [
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

    // Merge: real folders first, then derived
    const allFolders = [
      ...folders.map((f) => ({
        id: f.id,
        name: f.name,
        count: f._count.entities,
        icon: f.icon || 'folder',
        color: f.color || '#3B82F6',
        lastUpdated: f.updatedAt.toISOString(),
        description: f.description,
        isCustom: true,
      })),
      ...derivedFolders,
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

    return NextResponse.json({ data: { folders: allFolders, nodes, edges } });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch knowledge folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const folder = await db.knowledgeFolder.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        color: parsed.data.color,
        icon: parsed.data.icon,
      },
      include: { _count: { select: { entities: true } } },
    });

    return NextResponse.json(
      {
        data: {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          color: folder.color,
          icon: folder.icon,
          count: folder._count.entities,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to create knowledge folder' }, { status: 500 });
  }
}
