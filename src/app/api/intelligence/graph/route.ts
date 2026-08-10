/**
 * GET/POST /api/intelligence/graph
 *
 * WI-16G — Knowledge Graph Intelligence API
 *
 * Provides enterprise-grade graph operations:
 *   - Entity resolution and lookup
 *   - Graph expansion and traversal
 *   - Relationship discovery
 *   - Graph-based recommendations
 *   - Multi-hop reasoning
 *   - Evidence chain construction
 *
 * GET Endpoints:
 *   ?view=stats              — Graph statistics (nodes, edges, connectivity)
 *   ?view=entity&id=xxx      — Get entity details + edges
 *   ?view=resolve&label=xxx  — Resolve label to entity
 *   ?view=expand&id=xxx&hops=2 — Expand from entity (BFS traversal)
 *   ?view=path&from=xxx&to=xxx — Find paths between entities
 *   ?view=nodes              — List all nodes (paginated)
 *   ?view=edges              — List all edges (paginated)
 *
 * POST Endpoints:
 *   ?action=seed              — Seed the graph with enterprise data
 *   ?action=clear             — Clear the graph
 *   ?action=reason            — Run graph reasoning on an entity
 *   ?action=recommend         — Generate graph-based recommendations
 *   ?action=extract           — Extract entities from text and populate graph
 *   ?action=find-similar      — Find similar companies/entities
 *   ?action=influence-map     — Map influence chains for an entity
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  seedKnowledgeGraph,
  clearGraph,
  getGraphStats,
  getNode,
  resolveEntity,
  expandFromEntity,
  findPaths,
  findShortestPath,
  generateRecommendations,
  reasonAboutEntity,
  getAllNodes,
  getAllEdges,
  extractGraphEntities,
  populateGraphFromIntelligence,
  getNodeEdges,
  type GraphRecommendationInput,
} from '@/lib/ai-knowledge-graph';

const VALID_VIEWS = new Set([
  'stats', 'entity', 'resolve', 'expand', 'path', 'nodes', 'edges',
]);
const VALID_ACTIONS = new Set([
  'seed', 'clear', 'reason', 'recommend', 'extract', 'find-similar', 'influence-map',
]);

export async function GET(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const view = request.nextUrl.searchParams.get('view') || 'stats';

    if (!VALID_VIEWS.has(view)) {
      return Response.json(
        { error: `Invalid view: ${view}. Valid: ${Array.from(VALID_VIEWS).join(', ')}` },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    switch (view) {
      case 'stats': {
        const stats = getGraphStats();
        return Response.json({
          view: 'stats',
          data: stats,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      }

      case 'entity': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
          return Response.json({ error: 'Missing required parameter: id' }, { status: 400 });
        }
        const node = await getNode(id);
        if (!node) {
          return Response.json({ error: `Entity not found: ${id}` }, { status: 404 });
        }
        const edges = await getNodeEdges(id);
        return Response.json({
          view: 'entity',
          data: { node, edges, edgeCount: edges.length },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'resolve': {
        const label = request.nextUrl.searchParams.get('label');
        if (!label) {
          return Response.json({ error: 'Missing required parameter: label' }, { status: 400 });
        }
        const matches = await resolveEntity(label);
        return Response.json({
          view: 'resolve',
          data: { query: label, matches, count: matches.length },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'expand': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
          return Response.json({ error: 'Missing required parameter: id' }, { status: 400 });
        }
        const hops = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('hops') || '2', 10), 1), 4);
        const result = expandFromEntity(id, { maxHops: hops, maxResults: 50 });
        return Response.json({
          view: 'expand',
          data: result,
          latencyMs: Date.now() - startTime,
        });
      }

      case 'path': {
        const fromId = request.nextUrl.searchParams.get('from');
        const toId = request.nextUrl.searchParams.get('to');
        if (!fromId || !toId) {
          return Response.json({ error: 'Missing required parameters: from, to' }, { status: 400 });
        }
        const maxHops = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('maxHops') || '4', 10), 1), 6);
        const paths = findPaths(fromId, toId, { maxHops, maxResults: 10 });
        const shortest = findShortestPath(fromId, toId);
        return Response.json({
          view: 'path',
          data: { from: fromId, to: toId, paths, shortest, pathCount: paths.length },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'nodes': {
        const nodes = getAllNodes();
        const type = request.nextUrl.searchParams.get('type');
        const filtered = type ? nodes.filter(n => n.type === type) : nodes;
        const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200);
        return Response.json({
          view: 'nodes',
          data: { nodes: filtered.slice(0, limit), total: filtered.length, filteredByType: type || 'all' },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'edges': {
        const edges = getAllEdges();
        const rel = request.nextUrl.searchParams.get('relationship');
        const filtered = rel ? edges.filter(e => e.relationship === rel) : edges;
        const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200);
        return Response.json({
          view: 'edges',
          data: { edges: filtered.slice(0, limit), total: filtered.length, filteredByRelationship: rel || 'all' },
          latencyMs: Date.now() - startTime,
        });
      }

      default:
        return Response.json({ error: `Unknown view: ${view}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[WI-16G] GET /api/intelligence/graph error', { error, view: request.nextUrl.searchParams.get('view') });
    return Response.json({ error: 'Internal graph query error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const action = request.nextUrl.searchParams.get('action');

    if (!action || !VALID_ACTIONS.has(action)) {
      return Response.json(
        { error: `Invalid or missing action: ${action}. Valid: ${Array.from(VALID_ACTIONS).join(', ')}` },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const startTime = Date.now();

    switch (action) {
      case 'seed': {
        seedKnowledgeGraph();
        const stats = getGraphStats();
        return Response.json({
          action: 'seed',
          message: 'Knowledge graph seeded with enterprise data',
          stats,
          latencyMs: Date.now() - startTime,
        });
      }

      case 'clear': {
        clearGraph();
        return Response.json({
          action: 'clear',
          message: 'Knowledge graph cleared',
          latencyMs: Date.now() - startTime,
        });
      }

      case 'reason': {
        const { entityId, questionType, context } = body;
        if (!entityId) {
          return Response.json({ error: 'Missing required field: entityId' }, { status: 400 });
        }
        const validTypes = ['why_now', 'similar_to', 'opportunity_for', 'risk_from', 'who_influences', 'technology_fit'];
        const qType = validTypes.includes(questionType) ? questionType : 'why_now';
        const result = reasonAboutEntity(entityId, qType, context);
        return Response.json({ action: 'reason', data: result, latencyMs: Date.now() - startTime });
      }

      case 'recommend': {
        const input: GraphRecommendationInput = body;
        if (!input.entityId) {
          return Response.json({ error: 'Missing required field: entityId' }, { status: 400 });
        }
        if (!input.type) {
          input.type = 'similar_companies';
        }
        const recommendations = generateRecommendations(input);
        return Response.json({
          action: 'recommend',
          data: { recommendations, count: recommendations.length },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'extract': {
        const { text, sourceDescription } = body;
        if (!text || typeof text !== 'string') {
          return Response.json({ error: 'Missing required field: text (string)' }, { status: 400 });
        }
        const extractions = extractGraphEntities(text);
        const population = populateGraphFromIntelligence(extractions, sourceDescription);
        return Response.json({
          action: 'extract',
          data: {
            extractions: extractions.map(e => ({
              entity: e.entity,
              graphType: e.graphType,
              suggestedRelationships: e.suggestedRelationships,
            })),
            population,
            timestamp: new Date().toISOString(),
          },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'find-similar': {
        const { entityId, maxHops, limit } = body;
        if (!entityId) {
          return Response.json({ error: 'Missing required field: entityId' }, { status: 400 });
        }
        const recommendations = generateRecommendations({
          entityId,
          type: 'similar_companies',
          maxHops: maxHops || 2,
          limit: limit || 10,
        });
        return Response.json({
          action: 'find-similar',
          data: { recommendations, count: recommendations.length },
          latencyMs: Date.now() - startTime,
        });
      }

      case 'influence-map': {
        const { entityId, maxHops, limit } = body;
        if (!entityId) {
          return Response.json({ error: 'Missing required field: entityId' }, { status: 400 });
        }
        const recommendations = generateRecommendations({
          entityId,
          type: 'influence_mapping',
          maxHops: maxHops || 3,
          limit: limit || 10,
          targetType: ['person'],
        });
        return Response.json({
          action: 'influence-map',
          data: { recommendations, count: recommendations.length },
          latencyMs: Date.now() - startTime,
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[WI-16G] POST /api/intelligence/graph error', { error, action: request.nextUrl.searchParams.get('action') });
    return Response.json({ error: 'Internal graph operation error' }, { status: 500 });
  }
}
