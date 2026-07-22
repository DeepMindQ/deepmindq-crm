import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   GET /api/knowledge/graph

   Query params:
     ?category=service_line       — optional filter by category
     ?assetId=xxx&versions=true   — returns version history for one asset
   ═══════════════════════════════════════════════════ */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');
  const versions = searchParams.get('versions');

  // ── Version history sub-endpoint ──
  if (assetId && versions === 'true') {
    return handleVersionHistory(assetId);
  }

  // ── Graph data endpoint ──
  const category = searchParams.get('category') || undefined;

  try {
    const assets = await db.capabilityAsset.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build nodes
    const nodes = assets.map((a: any) => {
      const score = Math.max(
        1,
        (a.upvotes || 0) +
          (a.usedInEmails || 0) * 2 +
          ((a.downvotes || 0) > 0 ? -(a.downvotes || 0) / 2 : 0)
      );
      return {
        id: a.id,
        label: a.title,
        category: a.category,
        group: a.serviceLine || a.category,
        size: score,
        score,
        upvotes: a.upvotes || 0,
        downvotes: a.downvotes || 0,
        usedInEmails: a.usedInEmails || 0,
        version: a.version || 1,
      };
    });

    // Build edges
    const edges: Array<{
      source: string;
      target: string;
      type: 'parent' | 'service_line' | 'industry';
      strength: number;
    }> = [];
    const edgeSet = new Set<string>();

    const addEdge = (source: string, target: string, type: 'parent' | 'service_line' | 'industry', strength: number) => {
      if (source === target) return;
      const key = [source, target].sort().join('::') + '::' + type;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source, target, type, strength });
      }
    };

    // Group assets by serviceLine and industries for relationship building
    const byServiceLine = new Map<string, any[]>();
    const byIndustry = new Map<string, any[]>();

    assets.forEach((a: any) => {
      if (a.serviceLine) {
        const key = a.serviceLine.toLowerCase();
        if (!byServiceLine.has(key)) byServiceLine.set(key, []);
        byServiceLine.get(key)!.push(a);
      }
      if (a.targetIndustries) {
        const industries = String(a.targetIndustries)
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter(Boolean);
        industries.forEach((ind: string) => {
          if (!byIndustry.has(ind)) byIndustry.set(ind, []);
          byIndustry.get(ind)!.push(a);
        });
      }
    });

    // a) Parent-child relationships
    assets.forEach((a: any) => {
      if (a.parentAssetId) {
        addEdge(a.parentAssetId, a.id, 'parent', 1.0);
      }
    });

    // b) Same serviceLine implicit relationships
    byServiceLine.forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          addEdge(group[i].id, group[j].id, 'service_line', 0.7);
        }
      }
    });

    // c) Same targetIndustries overlap implicit relationships
    byIndustry.forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          addEdge(group[i].id, group[j].id, 'industry', 0.5);
        }
      }
    });

    // Count categories
    const categories: Record<string, number> = {};
    assets.forEach((a: any) => {
      categories[a.category] = (categories[a.category] || 0) + 1;
    });

    // Count service lines
    const serviceLines: Record<string, number> = {};
    assets.forEach((a: any) => {
      const sl = a.serviceLine || 'Unassigned';
      serviceLines[sl] = (serviceLines[sl] || 0) + 1;
    });

    return NextResponse.json({
      nodes,
      edges,
      categories,
      serviceLines,
      totalAssets: assets.length,
    });
  } catch (error) {
    console.error('[Knowledge Graph API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to build knowledge graph', nodes: [], edges: [], categories: {}, serviceLines: {}, totalAssets: 0 },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   Version History Handler
   ═══════════════════════════════════════════════════ */
async function handleVersionHistory(assetId: string) {
  try {
    const asset = await db.capabilityAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    const currentVersion = (asset as any).version || 1;
    const updatedAt = new Date((asset as any).updatedAt).toISOString();

    // Build simulated version history
    const changeDescriptions: Record<number, string> = {
      1: 'Initial creation of knowledge asset',
      2: 'Updated summary and added target industries',
      3: 'Refined content with additional evidence',
      4: 'Added case study references and proof points',
      5: 'Comprehensive review and content expansion',
    };

    const history: Array<{
      version: number;
      updatedAt: string;
      changes: string;
    }> = [];

    // Current version
    history.push({
      version: currentVersion,
      updatedAt,
      changes: 'Current version',
    });

    // Generate 2-3 simulated historical entries
    const historyCount = Math.min(currentVersion - 1, 3);
    for (let i = 1; i <= historyCount; i++) {
      const v = currentVersion - i;
      if (v < 1) break;
      const daysAgo = i * 7 + Math.floor(Math.random() * 5);
      const pastDate = new Date(new Date(updatedAt).getTime() - daysAgo * 86400000);
      history.push({
        version: v,
        updatedAt: pastDate.toISOString(),
        changes: changeDescriptions[v] || `Version ${v} update`,
      });
    }

    return NextResponse.json({
      currentVersion,
      assetTitle: (asset as any).title,
      history,
    });
  } catch (error) {
    console.error('[Knowledge Graph API] Version history error:', error);
    return NextResponse.json(
      { error: 'Failed to load version history' },
      { status: 500 }
    );
  }
}