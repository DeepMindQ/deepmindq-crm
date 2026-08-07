/**
 * Knowledge API — Graph & Version History
 *
 * GET /api/knowledge/graph  — Knowledge graph (nodes + edges)
 *   ?category=service_line   — filter by category
 *   ?assetId=xxx&versions=true  — version history for one asset
 *
 * Standardized response: { success, data, meta: { endpoint, durationMs } }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET – graph data or version history
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const started = Date.now();
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');
  const versions = searchParams.get('versions');

  // ── Version history sub-endpoint ──
  if (assetId && versions === 'true') {
    return handleVersionHistory(assetId, started);
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

    // Group assets by serviceLine and industries
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

    // c) Same targetIndustries overlap
    byIndustry.forEach((group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          addEdge(group[i].id, group[j].id, 'industry', 0.5);
        }
      }
    });

    // Count categories & service lines
    const categories: Record<string, number> = {};
    assets.forEach((a: any) => {
      categories[a.category] = (categories[a.category] || 0) + 1;
    });

    const serviceLines: Record<string, number> = {};
    assets.forEach((a: any) => {
      const sl = a.serviceLine || 'Unassigned';
      serviceLines[sl] = (serviceLines[sl] || 0) + 1;
    });

    return Response.json({
      success: true,
      data: { nodes, edges, categories, serviceLines, totalAssets: assets.length },
      meta: { endpoint: 'knowledge:graph', durationMs: Date.now() - started },
    });
  } catch (error) {
    logger.error('[knowledge/graph] failed', { error });
    return Response.json(
      { success: false, data: { nodes: [], edges: [], categories: {}, serviceLines: {}, totalAssets: 0 }, error: 'Failed to build knowledge graph', meta: { endpoint: 'knowledge:graph', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Version History Handler
// ---------------------------------------------------------------------------

async function handleVersionHistory(assetId: string, started: number) {
  try {
    const asset = await db.capabilityAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return Response.json(
        { success: false, data: null, error: 'Asset not found', meta: { endpoint: 'knowledge:versions', durationMs: Date.now() - started } },
        { status: 404 },
      );
    }

    const currentVersion = (asset as any).version || 1;

    // Phase 0 (G10): Removed fabricated version history with random dates.
    // Version history requires a dedicated KnowledgeVersion tracking table
    // to be implemented in a future phase. Returning current version only.
    return Response.json({
      success: true,
      data: {
        currentVersion,
        assetTitle: (asset as any).title,
        history: [
          {
            version: currentVersion,
            updatedAt: new Date((asset as any).updatedAt).toISOString(),
            changes: 'Current version',
          },
        ],
        note: 'Full version history tracking will be available in a future release.',
      },
      meta: { endpoint: 'knowledge:versions', durationMs: Date.now() - started },
    });
  } catch (error) {
    logger.error('[knowledge/versions] failed', { error });
    return Response.json(
      { success: false, data: null, error: 'Failed to load version history', meta: { endpoint: 'knowledge:versions', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}
