/**
 * GET /api/intelligence/mindmap/{id}
 *
 * Intelligence API — Mindmap Endpoint
 *
 * Returns the intelligence mind map for a company.
 * Composed from company contacts, capability assets, and signals.
 * Each entity type becomes a node; edges are hub-and-spoke from company center.
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 * Follows the same pattern as the company route (reference implementation).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
  shouldInclude,
  runGovernanceMetadata,
  SECURITY_HEADERS,
} from '@/lib/intelligence-api/intelligence-middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import type { IntelligenceMindmap, MindmapNode } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/** D9: Default confidence for knowledge/capability nodes.
 * CapabilityAsset schema has no confidence field — 0.7 is a reasonable
 * estimate for linked capabilities (already filtered by isActive=true and
 * fusion match score). This is intentionally a named constant rather
 * than magic number, but cannot be derived from actual data. */
const DEFAULT_CAPABILITY_CONFIDENCE = 0.7;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const startedAt = Date.now();
  const requestedAt = new Date();

  const guardResult = await intelligenceGuard(request, params, 'mindmap');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  logger.info('[intelligence/mindmap] Processing', {
    companyId,
    correlationId,
    includes: Array.from(guardResult.includes),
  });

  // E1: Use shared governance helper from middleware (replaces 12-line inline block)
  const governanceMeta = await runGovernanceMetadata(companyId, 'mindmap');

  // ── Step 1: Load company from DB (for freshness + center node label) ─────
  // A7: Properly typed company row — eliminates verbose type assertions downstream
  let company: {
    id: string;
    rawName: string | null;
    normalizedName: string | null;
    lastEnrichedAt: Date | null;
    lastActivityAt: Date | null;
  } | null = null;
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        normalizedName: true,
        lastEnrichedAt: true,
        lastActivityAt: true,
      },
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/mindmap] DB lookup failed', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse('mindmap', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, guardResult.includes),
      { status: 500, headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('mindmap', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: { ...SECURITY_HEADERS, ...responseHeaders, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  // ── Step 2: Determine selective loading flags ─────────────────────────
  // F4/F5: Pagination params for nodes and edges
  const nodePage = Math.max(1, parseInt(request.nextUrl.searchParams.get('nodePage') || '1', 10) || 1);
  const nodeLimit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('nodeLimit') || '50', 10) || 50));
  const edgePage = Math.max(1, parseInt(request.nextUrl.searchParams.get('edgePage') || '1', 10) || 1);
  const edgeLimit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('edgeLimit') || '50', 10) || 50));

  const loadNodes = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'nodes');
  const loadEdges = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'edges');
  const loadKnowledgeConnections = shouldInclude(guardResult.includes, 'knowledgeConnections');

  // ── Step 3: Load entities in parallel (only when nodes are requested) ─────
  const centerLabel = company.normalizedName || company.rawName || 'Company';
  const centerNodeId = 'company-center';

  let nodes: MindmapNode[] = [];
  let companyCapabilityIds: Set<string> = new Set();

  if (loadNodes) {
    const [contacts, fusionResults, signals] = await Promise.all([
      db.contact.findMany({
        where: { companyId },
        select: { id: true, rawName: true, title: true, role: true, leadScore: true },
        take: Math.min(nodeLimit, 50), // F4: Respect node pagination limit
      }).catch((err: unknown) => {
        logger.warn('[intelligence/mindmap] Failed to load contacts', { companyId, correlationId, error: err instanceof Error ? err.message : String(err) });
        return [];
      }),
      // Load company-linked capabilities via FusionResult (not all assets)
      db.fusionResult.findMany({
        where: { companyId },
        select: { capabilityIds: true },
        take: 100,
      }).catch((err: unknown) => {
        logger.warn('[intelligence/mindmap] Failed to load fusion results', { companyId, correlationId, error: err instanceof Error ? err.message : String(err) });
        return [];
      }),
      db.companySignal.findMany({
        where: { companyId },
        select: { id: true, signalType: true, title: true, confidence: true },
        take: Math.min(nodeLimit, 30), // F4: Respect node pagination limit
      }).catch((err: unknown) => {
        logger.warn('[intelligence/mindmap] Failed to load signals', { companyId, correlationId, error: err instanceof Error ? err.message : String(err) });
        return [];
      }),
    ]);

    // Extract unique capability IDs linked to this company
    for (const fr of fusionResults) {
      const ids = fr.capabilityIds as unknown[];
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id === 'string') companyCapabilityIds.add(id);
        }
      }
    }

      // Load only company-linked capability assets
      const allCaps = companyCapabilityIds.size > 0
        ? await db.capabilityAsset.findMany({
            where: { id: { in: Array.from(companyCapabilityIds) }, isActive: true },
            select: { id: true, title: true, category: true },
            take: nodeLimit, // F4: Respect limit for total nodes
          }).catch(() => [])
        : [];

    // Build nodes (hub-and-spoke: company center + entity nodes)
    nodes = [
      // Company center node
      {
        id: centerNodeId,
        label: centerLabel,
        type: 'company',
        confidence: 1.0,
      },
      // Person nodes
      ...contacts.map((c) => ({
        id: c.id,
        label: (c.rawName || '').slice(0, 100),
        type: 'person' as const,
        // D8: leadScore is 0-100 in the DB schema; clamp after normalising to 0-1
        confidence: Math.max(0, Math.min(1, (c.leadScore || 0) / 100)),
        metadata: { title: c.title, role: c.role },
      })),
      // Knowledge/capability nodes (company-linked only)
      ...allCaps.map((cap) => ({
        id: cap.id,
        label: (cap.title || '').slice(0, 100),
        type: 'knowledge' as const,
        confidence: DEFAULT_CAPABILITY_CONFIDENCE,
        metadata: { category: cap.category },
      })),
      // Signal nodes
      ...signals.map((s) => ({
        id: s.id,
        label: (s.title || '').slice(0, 100),
        type: 'signal' as const,
        confidence: Math.max(0, Math.min(1, s.confidence)),
        metadata: { signalType: s.signalType },
      })),
    ];
  }

  // ── Step 4: Build edges (hub-and-spoke from center — O(n), not O(n²)) ────
  // F5: Paginate edges based on paginated nodes
  const edges: IntelligenceMindmap['edges'] = [];

  if (loadEdges) {
    const paginatedNodes = nodes.slice(1); // exclude center node
    const edgeStart = (edgePage - 1) * edgeLimit;
    const edgeSlice = paginatedNodes.slice(edgeStart, edgeStart + edgeLimit);
    for (const node of edgeSlice) {
      if (node.id === centerNodeId) continue;
      // Weight: use node confidence (closer to 1 = stronger edge)
      edges.push({
        source: centerNodeId,
        target: node.id,
        weight: Math.max(0.1, node.confidence),
      });
    }
  }

  // ── Step 5: Compose response ─────────────────────────────────────────────
  const data: IntelligenceMindmap = {
    companyId,
    ...(loadNodes ? { nodes } : {}),
    ...(loadEdges ? { edges } : {}),
    // Always present — lightweight summary
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      centerNode: centerLabel,
      lastGenerated: new Date().toISOString(),
    },
    // knowledgeConnections: link signal nodes to capability nodes via fusion
    ...(loadKnowledgeConnections ? {
      // F7: await inside spread is fine — the IIFE is evaluated before the spread consumes the result
      knowledgeConnections: await (async () => {
        if (companyCapabilityIds.size === 0) return [];
        try {
          const fusionLinks = await db.fusionResult.findMany({
            where: { companyId },
            select: { signalIds: true, capabilityIds: true, fusionScore: true, businessProblem: true },
            take: 20,
          });
          return fusionLinks.map(fl => ({
            sourceNode: Array.isArray(fl.signalIds) && (fl.signalIds as unknown[]).length > 0
              ? String((fl.signalIds as unknown[])[0])
              : 'unknown-signal',
            targetNode: Array.isArray(fl.capabilityIds) && (fl.capabilityIds as unknown[]).length > 0
              ? String((fl.capabilityIds as unknown[])[0])
              : 'unknown-capability',
            type: 'fusion_match',
            description: String(fl.businessProblem || 'Signal-capability fusion'),
            confidence: Math.max(0, Math.min(1, fl.fusionScore)),
          }));
        } catch {
          return [];
        }
      })(),
    } : {}),
  };

  const confidence = nodes.length > 0 ? Math.min(0.9, 0.5 + nodes.length * 0.02) : 0.1;
  const freshness = computeFreshness(company);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/mindmap] Response assembled', {
    companyId,
    durationMs,
    includes: Array.from(guardResult.includes),
    nodeCount: loadNodes ? nodes.length : 0,
    edgeCount: loadEdges ? edges.length : 0,
    confidence,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('mindmap', companyId, data, {
      durationMs,
      includes: guardResult.includes,
      cached: false,
      confidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
        ...responseHeaders,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    },
  );
}
