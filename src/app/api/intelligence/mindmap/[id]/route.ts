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
  parseIncludeParams,
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import type { IntelligenceMindmap, MindmapNode } from '@/lib/intelligence-api/types';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  const { id: companyId } = await params;

  if (!companyId) {
    return Response.json(
      createErrorResponse('mindmap', '', 'Company ID is required', 'MISSING_COMPANY_ID'),
      { status: 400 },
    );
  }

  const { includes } = parseIncludeParams(request);

  logger.info('[intelligence/mindmap] Processing', {
    companyId,
    includes: Array.from(includes),
  });

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
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/mindmap] DB lookup failed', { companyId, error: message });
    return Response.json(
      createErrorResponse('mindmap', companyId, `Company lookup failed: ${message}`, 'INTELLIGENCE_UNAVAILABLE', Date.now() - startedAt, includes),
      { status: 500 },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('mindmap', companyId, 'Company not found', 'COMPANY_NOT_FOUND', Date.now() - startedAt, includes),
      { status: 404 },
    );
  }

  // ── Step 2: Load entities in parallel (non-throwing) ──────────────────────
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

  // ── Step 3: Build nodes (hub-and-spoke: company center + entity nodes) ──
  const centerLabel = (company.normalizedName as string) || (company.rawName as string) || 'Company';
  const centerNodeId = 'company-center';

  const nodes: MindmapNode[] = [
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
      label: c.rawName,
      type: 'person' as const,
      confidence: c.leadScore / 100,
      metadata: { title: c.title, role: c.role },
    })),
    // Knowledge/capability nodes
    ...capabilities.map((cap) => ({
      id: cap.id,
      label: cap.title,
      type: 'knowledge' as const,
      confidence: 0.7,
      metadata: { category: cap.category },
    })),
    // Signal nodes
    ...signals.map((s) => ({
      id: s.id,
      label: s.title,
      type: 'signal' as const,
      confidence: s.confidence,
      metadata: { signalType: s.signalType },
    })),
  ];

  // ── Step 4: Build edges (hub-and-spoke from center — O(n), not O(n²)) ────
  const edges: IntelligenceMindmap['edges'] = [];

  for (const node of nodes) {
    if (node.id === centerNodeId) continue;
    // Weight: use node confidence (closer to 1 = stronger edge)
    edges.push({
      source: centerNodeId,
      target: node.id,
      weight: Math.max(0.1, node.confidence),
    });
  }

  // ── Step 5: Compose response ─────────────────────────────────────────────
  const data: IntelligenceMindmap = {
    companyId,
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      centerNode: centerLabel,
      lastGenerated: new Date().toISOString(),
    },
  };

  const confidence = nodes.length > 0 ? Math.min(0.9, 0.5 + nodes.length * 0.02) : 0.1;
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/mindmap] Response assembled', {
    companyId,
    durationMs,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    confidence,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('mindmap', companyId, data, {
      durationMs,
      includes,
      cached: false,
      confidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
    }),
  );
}
