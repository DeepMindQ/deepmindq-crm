/**
 * Company Hierarchy API
 * =====================
 * Phase 0 (G7a): Parent-subsidiary hierarchy queries.
 *
 * GET /api/companies/hierarchy?companyId=xxx     — Children of a parent
 * GET /api/companies/hierarchy?root=true         — All top-level companies (no parent)
 * GET /api/companies/hierarchy?family=xxx        — Full family tree (parent + siblings + children)
 *
 * Standardized response: { success, data, meta: { endpoint, durationMs } }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET — Company hierarchy queries
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const started = Date.now();
  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get('companyId');
  const root = searchParams.get('root');
  const family = searchParams.get('family');
  const depth = parseInt(searchParams.get('depth') || '3', 10);

  // ── Mode 1: Children of a parent company ──
  if (companyId) {
    return handleChildren(companyId, started);
  }

  // ── Mode 2: Root companies (no parent) ──
  if (root === 'true') {
    return handleRootCompanies(started);
  }

  // ── Mode 3: Full family tree ──
  if (family) {
    return handleFamilyTree(family, Math.min(depth, 5), started);
  }

  return Response.json(
    {
      success: false,
      error: 'Specify one of: companyId, root=true, or family=<id>',
      meta: { endpoint: 'companies:hierarchy', durationMs: Date.now() - started },
    },
    { status: 400 },
  );
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

interface CompanyHierarchyNode {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  parentId: string | null;
  subsidiaryType: string | null;
  intelligenceScore: number;
  status: string;
  children?: CompanyHierarchyNode[];
}

/** Get direct children of a parent company. */
async function handleChildren(companyId: string, started: number) {
  try {
    const children = await db.company.findMany({
      where: { parentId: companyId },
      orderBy: [{ subsidiaryType: 'asc' }, { rawName: 'asc' }],
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        parentId: true,
        subsidiaryType: true,
        intelligenceScore: true,
        status: true,
      },
    });

    return Response.json({
      success: true,
      data: {
        parentId: companyId,
        childCount: children.length,
        children,
      },
      meta: { endpoint: 'companies:hierarchy:children', durationMs: Date.now() - started },
    });
  } catch (error) {
    logger.error('[companies/hierarchy] children query failed', { error });
    return Response.json(
      { success: false, data: { parentId: companyId, childCount: 0, children: [] }, error: 'Failed to query company children', meta: { endpoint: 'companies:hierarchy:children', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

/** Get all root-level companies (those without a parent). */
async function handleRootCompanies(started: number) {
  try {
    const roots = await db.company.findMany({
      where: { parentId: null },
      orderBy: [{ rawName: 'asc' }],
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        parentId: true,
        subsidiaryType: true,
        intelligenceScore: true,
        status: true,
      },
    });

    return Response.json({
      success: true,
      data: {
        rootCount: roots.length,
        roots,
      },
      meta: { endpoint: 'companies:hierarchy:roots', durationMs: Date.now() - started },
    });
  } catch (error) {
    logger.error('[companies/hierarchy] roots query failed', { error });
    return Response.json(
      { success: false, data: { rootCount: 0, roots: [] }, error: 'Failed to query root companies', meta: { endpoint: 'companies:hierarchy:roots', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

/** Get the full family tree: walk up to root, then descend to max depth. */
async function handleFamilyTree(companyId: string, maxDepth: number, started: number) {
  try {
    // Step 1: Walk up the parent chain to find the root
    const ancestors: CompanyHierarchyNode[] = [];
    let currentId: string | null = companyId;

    while (currentId) {
      const company: any = await db.company.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          rawName: true,
          domain: true,
          industry: true,
          sizeRange: true,
          parentId: true,
          subsidiaryType: true,
          intelligenceScore: true,
          status: true,
        },
      });

      if (!company) break;
      ancestors.unshift(company as unknown as CompanyHierarchyNode);
      currentId = company.parentId;

      // Safety: prevent infinite loops
      if (ancestors.length > 20) break;
    }

    const rootId = ancestors[0]?.id ?? companyId;

    // Step 2: From root, descend recursively to maxDepth
    const tree = await buildSubtree(rootId, 0, maxDepth);

    return Response.json({
      success: true,
      data: {
        companyId,
        rootId,
        ancestorChain: ancestors.map(a => ({ id: a.id, rawName: a.rawName, subsidiaryType: a.subsidiaryType })),
        tree,
        depth: maxDepth,
      },
      meta: { endpoint: 'companies:hierarchy:family', durationMs: Date.now() - started },
    });
  } catch (error) {
    logger.error('[companies/hierarchy] family tree query failed', { error });
    return Response.json(
      { success: false, data: null, error: 'Failed to build family tree', meta: { endpoint: 'companies:hierarchy:family', durationMs: Date.now() - started } },
      { status: 500 },
    );
  }
}

/** Recursively build a subtree of children up to maxDepth. */
async function buildSubtree(
  parentId: string,
  currentDepth: number,
  maxDepth: number,
): Promise<CompanyHierarchyNode | null> {
  if (currentDepth >= maxDepth) return null;

  const company = await db.company.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      sizeRange: true,
      parentId: true,
      subsidiaryType: true,
      intelligenceScore: true,
      status: true,
    },
  });

  if (!company) return null;

  const children = await db.company.findMany({
    where: { parentId },
    orderBy: [{ subsidiaryType: 'asc' }, { rawName: 'asc' }],
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      sizeRange: true,
      parentId: true,
      subsidiaryType: true,
      intelligenceScore: true,
      status: true,
    },
  });

  const node: CompanyHierarchyNode = company as unknown as CompanyHierarchyNode;

  if (children.length > 0 && currentDepth + 1 < maxDepth) {
    node.children = [];
    for (const child of children) {
      const childSubtree = await buildSubtree(child.id, currentDepth + 1, maxDepth);
      if (childSubtree) {
        node.children.push(childSubtree);
      }
    }
  } else {
    node.children = children.map(c => c as unknown as CompanyHierarchyNode);
  }

  return node;
}
