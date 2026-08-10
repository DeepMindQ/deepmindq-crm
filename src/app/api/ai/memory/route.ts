/**
 * GET/POST /api/ai/memory
 *
 * WI-16H — AI Memory Architecture API
 *
 * Provides enterprise-grade memory operations:
 *   - Memory storage and retrieval
 *   - Layer-scoped search
 *   - Entity-scoped memory queries
 *   - Memory context building for AI generation
 *   - Memory consolidation
 *   - Memory statistics and monitoring
 *
 * GET Endpoints:
 *   ?view=stats               — Memory statistics
 *   ?view=search&query=xxx     — Search memories
 *   ?view=context&entity=xxx  — Build memory context for entity
 *   ?view=entity&type=xxx&id=xxx — Get entity memories
 *   ?view=recall&id=xxx       — Recall specific memory
 *
 * POST Endpoints:
 *   ?action=store              — Store a new memory
 *   ?action=update             — Update existing memory
 *   ?action=forget             — Delete a memory
 *   ?action=consolidate        — Run memory consolidation
 *   ?action=decay              — Apply time-based decay
 *   ?action=seed               — Seed with enterprise data
 *   ?action=clear              — Clear all memories
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  seedMemorySystem,
  clearAllMemories,
  getMemoryStats,
  storeMemory,
  recallMemory,
  forgetMemory,
  updateMemory,
  searchMemories,
  getEntityMemories,
  buildMemoryContext,
  consolidateMemories,
  applyMemoryDecay,
  getAllMemories,
  type MemorySearchQuery,
} from '@/lib/ai-memory';

const VALID_VIEWS = new Set(['stats', 'search', 'context', 'entity', 'recall']);
const VALID_ACTIONS = new Set(['store', 'update', 'forget', 'consolidate', 'decay', 'seed', 'clear']);

export async function GET(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const view = request.nextUrl.searchParams.get('view') || 'stats';

    if (!VALID_VIEWS.has(view)) {
      return Response.json({ error: `Invalid view: ${view}. Valid: ${Array.from(VALID_VIEWS).join(', ')}` }, { status: 400 });
    }

    const startTime = Date.now();

    switch (view) {
      case 'stats': {
        const stats = await getMemoryStats();
        return Response.json({ view: 'stats', data: stats, latencyMs: Date.now() - startTime });
      }

      case 'search': {
        const query = request.nextUrl.searchParams.get('query');
        if (!query) return Response.json({ error: 'Missing required parameter: query' }, { status: 400 });

        const searchQuery: MemorySearchQuery = {
          query,
          layer: parseArrayParam(request.nextUrl.searchParams.get('layer')) as any,
          category: parseArrayParam(request.nextUrl.searchParams.get('category')) as any,
          tags: parseArrayParam(request.nextUrl.searchParams.get('tags')),
          scopeEntityId: request.nextUrl.searchParams.get('entityId') || undefined,
          limit: parseInt(request.nextUrl.searchParams.get('limit') || '20', 10),
        };

        const results = await searchMemories(searchQuery);
        return Response.json({ view: 'search', data: { results, count: results.length }, latencyMs: Date.now() - startTime });
      }

      case 'context': {
        const entityType = request.nextUrl.searchParams.get('entityType');
        const entityId = request.nextUrl.searchParams.get('entityId');
        const query = request.nextUrl.searchParams.get('query') || undefined;

        const context = await buildMemoryContext({
          query,
          scopeEntityType: entityType || undefined,
          scopeEntityId: entityId || undefined,
        });

        return Response.json({ view: 'context', data: context, latencyMs: Date.now() - startTime });
      }

      case 'entity': {
        const entityType = request.nextUrl.searchParams.get('type');
        const entityId = request.nextUrl.searchParams.get('id');
        if (!entityType || !entityId) return Response.json({ error: 'Missing required parameters: type, id' }, { status: 400 });

        const memories = getEntityMemories(entityType, entityId);
        return Response.json({ view: 'entity', data: { memories, count: memories.length }, latencyMs: Date.now() - startTime });
      }

      case 'recall': {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return Response.json({ error: 'Missing required parameter: id' }, { status: 400 });

        const memory = await recallMemory(id);
        if (!memory) return Response.json({ error: `Memory not found: ${id}` }, { status: 404 });

        return Response.json({ view: 'recall', data: memory, latencyMs: Date.now() - startTime });
      }

      default:
        return Response.json({ error: `Unknown view: ${view}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[WI-16H] GET /api/ai/memory error', { error, view: request.nextUrl.searchParams.get('view') });
    return Response.json({ error: 'Internal memory query error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const action = request.nextUrl.searchParams.get('action');

    if (!action || !VALID_ACTIONS.has(action)) {
      return Response.json({ error: `Invalid or missing action: ${action}. Valid: ${Array.from(VALID_ACTIONS).join(', ')}` }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const startTime = Date.now();

    switch (action) {
      case 'store': {
        if (!body.content) return Response.json({ error: 'Missing required field: content' }, { status: 400 });

        const memory = await storeMemory({
          id: body.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          layer: body.layer || 'enterprise',
          category: body.category || 'company_intelligence',
          priority: body.priority || 'medium',
          scope: body.scopeEntityType && body.scopeEntityId
            ? { entityType: body.scopeEntityType, entityId: body.scopeEntityId }
            : 'global',
          content: body.content,
          summary: body.summary,
          tags: body.tags || [],
          referencedEntityIds: body.referencedEntityIds || [],
          source: body.source || { type: 'api_call', description: 'API memory store' },
          confidence: body.confidence ?? 0.7,
          importance: body.importance ?? 0.5,
          lastAccessedAt: Date.now(),
          expiresAt: body.expiresAt,
          parentMemoryId: body.parentMemoryId,
          childMemoryIds: body.childMemoryIds || [],
          metadata: body.metadata || {},
        });

        return Response.json({ action: 'store', data: memory, latencyMs: Date.now() - startTime });
      }

      case 'update': {
        if (!body.id) return Response.json({ error: 'Missing required field: id' }, { status: 400 });

        const updated = await updateMemory(body.id, {
          content: body.content,
          summary: body.summary,
          tags: body.tags,
          confidence: body.confidence,
          importance: body.importance,
          priority: body.priority,
          metadata: body.metadata,
          expiresAt: body.expiresAt,
        });

        if (!updated) return Response.json({ error: `Memory not found: ${body.id}` }, { status: 404 });
        return Response.json({ action: 'update', data: updated, latencyMs: Date.now() - startTime });
      }

      case 'forget': {
        if (!body.id) return Response.json({ error: 'Missing required field: id' }, { status: 400 });

        const forgotten = await forgetMemory(body.id);
        if (!forgotten) return Response.json({ error: `Memory not found: ${body.id}` }, { status: 404 });

        return Response.json({ action: 'forget', message: `Memory ${body.id} forgotten`, latencyMs: Date.now() - startTime });
      }

      case 'consolidate': {
        const result = await consolidateMemories({
          scopeEntityType: body.scopeEntityType,
          scopeEntityId: body.scopeEntityId,
          maxAge: body.maxAge,
          minImportance: body.minImportance,
        });

        return Response.json({ action: 'consolidate', data: result, latencyMs: Date.now() - startTime });
      }

      case 'decay': {
        const result = await applyMemoryDecay();
        const stats = await getMemoryStats();

        return Response.json({
          action: 'decay',
          data: { decayed: result.decayed, expired: result.expired },
          stats,
          latencyMs: Date.now() - startTime,
        });
      }

      case 'seed': {
        await seedMemorySystem();
        const stats = await getMemoryStats();

        return Response.json({
          action: 'seed',
          message: 'Memory system seeded with enterprise data',
          stats,
          latencyMs: Date.now() - startTime,
        });
      }

      case 'clear': {
        clearAllMemories();
        return Response.json({ action: 'clear', message: 'All memories cleared', latencyMs: Date.now() - startTime });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('[WI-16H] POST /api/ai/memory error', { error, action: request.nextUrl.searchParams.get('action') });
    return Response.json({ error: 'Internal memory operation error' }, { status: 500 });
  }
}

function parseArrayParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
