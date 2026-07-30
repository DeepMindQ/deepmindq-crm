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
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import type { IntelligenceMindmap, MindmapNode } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  const guardResult = await intelligenceGuard(request, params, 'mindmap');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  logger.info('[intelligence/mindmap] Processing', {
    companyId,
    includes: Array.from(guardResult.includes),
  });

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'mindmap', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'mindmap',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

  // ── Step 1: Load company from DB (for freshness + center node label) ─────
  let company: Record<string, unknown> | null = null;
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
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('mindmap', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, guardResult.includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Determine selective loading flags ─────────────────────────
  const loadNodes = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'nodes');
  const loadEdges = guardResult.includes.size === 0 || shouldInclude(guardResult.includes, 'edges');
  const loadKnowledgeConnections = shouldInclude(guardResult.includes, 'knowledgeConnections');

  // ── Step 3: Load entities in parallel (only when nodes are requested) ─────
  const centerLabel = (company.normalizedName as string) || (company.rawName as string) || 'Company';
  const centerNodeId = 'company-center';

  let nodes: MindmapNode[] = [];

  if (loadNodes) {
    const [contacts, capabilities, signals] = await Promise.all([
      db.contact.findMany({
        where: { companyId },
        select: { id: true, rawName: true, title: true, role: true, leadScore: true },
        take: 30,
      }).catch(() => []),
      db.capabilityAsset.findMany({
        where: { isActive: true },
        select: { id: true, title: true, category: true },
        take: 30,
      }).catch(() => []),
      db.companySignal.findMany({
        where: { companyId },
        select: { id: true, signalType: true, title: true, confidence: true },
        take: 20,
      }).catch(() => []),
    ]);

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
        confidence: Math.max(0, Math.min(1, (c.leadScore || 0) / 100)),
        metadata: { title: c.title, role: c.role },
      })),
      // Knowledge/capability nodes
      ...capabilities.map((cap) => ({
        id: cap.id,
        label: (cap.title || '').slice(0, 100),
        type: 'knowledge' as const,
        confidence: 0.7,
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
  const edges: IntelligenceMindmap['edges'] = [];

  if (loadEdges) {
    for (const node of nodes) {
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
    // Placeholder — not yet fully implemented
    ...(loadKnowledgeConnections ? { knowledgeConnections: [] } : {}),
  };

  const confidence = nodes.length > 0 ? Math.min(0.9, 0.5 + nodes.length * 0.02) : 0.1;
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
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
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
