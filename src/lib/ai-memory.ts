/**
 * WI-16H — AI Memory Architecture
 * ==================================
 *
 * Transforms DeepMindQ from stateless AI calls into an AI with
 * persistent, layered memory across sessions, companies, and contexts.
 *
 * PROBLEM SOLVED:
 *   Without memory, every AI interaction starts from zero.
 *   The AI cannot recall previous analysis, learn from outcomes,
 *   or build cumulative intelligence about accounts.
 *
 * ARCHITECTURE:
 *   ┌─────────────────────────────────────────────┐
 *   │           AI Memory Architecture             │
 *   │                                             │
 *   │  Layer 1: Working Memory                   │
 *   │    Active session context, current query     │
 *   │    state, immediate recall buffer            │
 *   │                                             │
 *   │  Layer 2: Conversation Memory               │
 *   │    Conversation history, user preferences,   │
 *   │    interaction patterns, feedback history   │
 *   │                                             │
 *   │  Layer 3: Enterprise Memory                  │
 *   │    Company intelligence, signal history,     │
 *   │    knowledge entries, cross-account patterns │
 *   │                                             │
 *   │  Layer 4: Institutional Memory              │
 *   │    Learning events, win/loss patterns,       │
 *   │    capability refinements, organizational   │
 *   │    knowledge that improves all future work    │
 *   │                                             │
 *   └─────────────────────────────────────────────┘
 *
 * INTEGRATION POINTS:
 *   - Enhances hybrid retrieval with memory-aware context
 *   - Feeds into confidence scoring with memory-backed evidence
 *   - Connects to knowledge graph for relationship-aware recall
 *   - Consumed by evaluation framework for memory quality metrics
 *
 * RELATIONSHIP TO OTHER WI-16 COMPONENTS:
 *   WI-16B (Hallucination Prevention): Memory provides grounded facts
 *   WI-16C (Confidence Engine): Memory-backed evidence boosts confidence
 *   WI-16E (Evaluation): Memory quality is an evaluation dimension
 *   WI-16F (Retrieval): Memory enriches retrieval context
 *   WI-16G (Knowledge Graph): Memory feeds graph with entity relationships
 */

import { logger } from '@/lib/logger';
import { persistWrite, persistDelete } from '@/lib/persistence/persistence-integration';

// ── Memory Types ─────────────────────────────────────────────────────

/** Memory layer classification — determines persistence and scope. */
export type MemoryLayer = 'working' | 'conversation' | 'enterprise' | 'institutional';

/** Memory categories for classification and retrieval. */
export type MemoryCategory =
  | 'company_intelligence'
  | 'contact_intelligence'
  | 'signal_analysis'
  | 'conversation_history'
  | 'user_preference'
  | 'reasoning_chain'
  | 'learning_insight'
  | 'capability_knowledge'
  | 'competitive_intelligence'
  | 'market_knowledge'
  | 'feedback'
  | 'error_correction';

/** Memory item priority — determines retention and recall priority. */
export type MemoryPriority = 'critical' | 'high' | 'medium' | 'low' | 'ephemeral';

/** A single memory item stored in the AI memory system. */
export interface MemoryItem {
  /** Unique memory identifier. */
  id: string;
  /** Memory layer (working, conversation, enterprise, institutional). */
  layer: MemoryLayer;
  /** Category classification. */
  category: MemoryCategory;
  /** Priority level. */
  priority: MemoryPriority;
  /** Scope: global or scoped to a specific entity. */
  scope: 'global' | { entityType: string; entityId: string };
  /** Memory content — the actual knowledge/information. */
  content: string;
  /** Summary — condensed version for quick scanning. */
  summary?: string;
  /** Key tags for retrieval. */
  tags: string[];
  /** Related entity IDs this memory references. */
  referencedEntityIds: string[];
  /** Source of this memory. */
  source: MemorySource;
  /** Confidence in this memory's accuracy (0-1). */
  confidence: number;
  /** Importance score (0-1) — determines consolidation priority. */
  importance: number;
  /** Access count — how often this memory has been recalled. */
  accessCount: number;
  /** Last access timestamp. */
  lastAccessedAt: number;
  /** Creation timestamp. */
  createdAt: number;
  /** Last update timestamp. */
  updatedAt: number;
  /** Expiry timestamp — ephemeral memories expire. */
  expiresAt?: number;
  /** Version — memories can be updated, versioning preserves history. */
  version: number;
  /** Parent memory ID — for consolidated memories. */
  parentMemoryId?: string;
  /** Child memory IDs — consolidated from these sources. */
  childMemoryIds: string[];
  /** Metadata — arbitrary key-value data. */
  metadata: Record<string, unknown>;
}

/** Memory source — where did this knowledge come from. */
export interface MemorySource {
  /** Source type. */
  type: 'ai_generation' | 'user_input' | 'system_detection' | 'external_intelligence'
    | 'human_intelligence' | 'learning_event' | 'conversation' | 'api_call';
  /** Source description. */
  description: string;
  /** Original source ID if applicable. */
  sourceId?: string;
  /** Timestamp of original source event. */
  sourceTimestamp?: number;
}

/** Memory recall result — a retrieved memory with relevance scoring. */
export interface MemoryRecallResult {
  memory: MemoryItem;
  /** Relevance score for this recall (0-1). */
  relevanceScore: number;
  /** How the memory matched the query. */
  matchReason: string;
  /** Which memory layer this came from. */
  layer: MemoryLayer;
}

/** Memory consolidation result. */
export interface MemoryConsolidation {
  /** New consolidated memory. */
  consolidatedMemory: MemoryItem;
  /** Source memories that were consolidated. */
  sourceMemories: MemoryItem[];
  /** Memories that were too old/low-importance and were archived. */
  archivedMemories: MemoryItem[];
  /** Compression ratio achieved. */
  compressionRatio: number;
  /** Timestamp. */
  timestamp: string;
}

/** Memory statistics for monitoring. */
export interface MemoryStats {
  totalMemories: number;
  byLayer: Record<MemoryLayer, number>;
  byCategory: Partial<Record<MemoryCategory, number>>;
  byPriority: Record<MemoryPriority, number>;
  averageConfidence: number;
  averageImportance: number;
  totalAccessCount: number;
  oldestMemory: number | null;
  newestMemory: number | null;
  expiringSoon: number;
  expired: number;
  consolidationCandidates: number;
}

/** Memory search query. */
export interface MemorySearchQuery {
  /** Search text. */
  query: string;
  /** Filter by memory layer. */
  layer?: MemoryLayer[];
  /** Filter by category. */
  category?: MemoryCategory[];
  /** Filter by scope. */
  scopeEntityType?: string;
  /** Filter by scope entity ID. */
  scopeEntityId?: string;
  /** Filter by tags. */
  tags?: string[];
  /** Minimum confidence. */
  minConfidence?: number;
  /** Minimum importance. */
  minImportance?: number;
  /** Maximum results. */
  limit?: number;
  /** Include expired memories. */
  includeExpired?: boolean;
}

/** Memory context for AI generation — what the AI "remembers" about the current context. */
export interface MemoryContext {
  /** Working memory — current session state. */
  working: Array<{ content: string; confidence: number }>;
  /** Conversation memory — recent interaction history. */
  conversation: Array<{ content: string; confidence: number; timestamp: number }>;
  /** Enterprise memory — company/account intelligence. */
  enterprise: Array<{ content: string; confidence: number; source: string }>;
  /** Institutional memory — organizational knowledge. */
  institutional: Array<{ content: string; confidence: number; source: string }>;
  /** Total memories used for this context. */
  totalMemories: number;
  /** Context confidence — how reliable is this memory context. */
  contextConfidence: number;
  /** Latency in milliseconds. */
  latencyMs: number;
}

// ── In-Memory Store ───────────────────────────────────────────────

const memoryStore = new Map<string, MemoryItem>();

/** Index: layer → memory IDs. */
const layerIndex = new Map<MemoryLayer, Set<string>>();

/** Index: category → memory IDs. */
const categoryIndex = new Map<MemoryCategory, Set<string>>();

/** Index: scope entity ID → memory IDs. */
const scopeIndex = new Map<string, Set<string>>();

/** Index: tag → memory IDs. */
const tagIndex = new Map<string, Set<string>>();

/** Seed flag. */
let seeded = false;

// ── Memory Operations ─────────────────────────────────────────────

/**
 * Store a memory item. If a memory with the same ID exists, it is
 * updated (version incremented).
 */
export function storeMemory(item: Omit<MemoryItem, 'createdAt' | 'updatedAt' | 'version' | 'accessCount' | 'childMemoryIds'> & { childMemoryIds?: string[] }): MemoryItem {
  const now = Date.now();
  const existing = memoryStore.get(item.id);

  const fullItem: MemoryItem = {
    ...item,
    accessCount: existing?.accessCount ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: existing ? existing.version + 1 : 1,
    childMemoryIds: item.childMemoryIds || [],
  };

  memoryStore.set(item.id, fullItem);
  updateIndices(fullItem);

  // WI-18.2: Persist to DB (non-blocking, fire-and-forget)
  // companyId from scope if company-scoped (Lock L3)
  const memCompanyId = fullItem.scope !== 'global' ? fullItem.scope.entityId : undefined;
  persistWrite('ai_memory', item.id, fullItem as unknown as Record<string, unknown>, memCompanyId).catch(() => {});

  return fullItem;
}

/**
 * Recall a specific memory by ID.
 */
export function recallMemory(id: string): MemoryItem | undefined {
  const memory = memoryStore.get(id);
  if (memory) {
    memory.accessCount++;
    memory.lastAccessedAt = Date.now();
    memoryStore.set(id, memory);
    // WI-18.2: Persist access count update (non-blocking)
    persistWrite('ai_memory', id, memory as unknown as Record<string, unknown>).catch(() => {});
  }
  return memory;
}

/**
 * Forget (delete) a memory item.
 */
export function forgetMemory(id: string): boolean {
  const memory = memoryStore.get(id);
  if (!memory) return false;

  memoryStore.delete(id);
  removeFromIndices(memory);

  // WI-18.2: Persist delete to DB (non-blocking)
  persistDelete('ai_memory', id).catch(() => {});

  return true;
}

/**
 * Update a memory item's content, incrementing its version.
 */
export function updateMemory(id: string, updates: Partial<Pick<MemoryItem, 'content' | 'summary' | 'tags' | 'confidence' | 'importance' | 'priority' | 'metadata' | 'expiresAt'>>): MemoryItem | undefined {
  const memory = memoryStore.get(id);
  if (!memory) return undefined;

  const updated: MemoryItem = {
    ...memory,
    ...updates,
    updatedAt: Date.now(),
    version: memory.version + 1,
  };

  memoryStore.set(id, updated);

  // WI-18.2: Persist update to DB (non-blocking)
  persistWrite('ai_memory', id, updated as unknown as Record<string, unknown>).catch(() => {});

  return updated;
}

// ── Memory Search & Recall ─────────────────────────────────────────

/**
 * Search memories by query text.
 * Uses tag matching, content keyword matching, and scope filtering.
 */
export function searchMemories(query: MemorySearchQuery): MemoryRecallResult[] {
  const results: MemoryRecallResult[] = [];
  const queryLower = query.query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
  const now = Date.now();

  // Gather candidate set based on filters
  let candidates = new Set<string>();

  // If no filters, search all memories
  if (!query.layer?.length && !query.category?.length && !query.tags?.length && !query.scopeEntityId) {
    candidates = new Set(memoryStore.keys());
  } else {
    // Filter by layer
    if (query.layer?.length) {
      for (const layer of query.layer) {
        const ids = layerIndex.get(layer);
        if (ids) for (const id of ids) candidates.add(id);
      }
    }

    // Filter by category
    if (query.category?.length) {
      const catCandidates = new Set<string>();
      for (const cat of query.category) {
        const ids = categoryIndex.get(cat);
        if (ids) for (const id of ids) catCandidates.add(id);
      }
      if (candidates.size > 0) {
        candidates = new Set([...candidates].filter(id => catCandidates.has(id)));
      } else {
        candidates = catCandidates;
      }
    }

    // Filter by scope entity
    if (query.scopeEntityId) {
      const scopeSet = new Set<string>();
      for (const [key, ids] of scopeIndex) {
        if (key.endsWith(`:${query.scopeEntityId}`)) {
          for (const id of ids) scopeSet.add(id);
        }
      }
      if (scopeSet.size > 0) {
        if (candidates.size > 0) {
          candidates = new Set([...candidates].filter(id => scopeSet.has(id)));
        } else {
          candidates = scopeSet;
        }
      }
    }

    // Filter by tags
    if (query.tags?.length) {
      const tagCandidates = new Set<string>();
      for (const tag of query.tags) {
        const ids = tagIndex.get(tag.toLowerCase());
        if (ids) for (const id of ids) tagCandidates.add(id);
      }
      if (candidates.size > 0) {
        candidates = new Set([...candidates].filter(id => tagCandidates.has(id)));
      } else {
        candidates = tagCandidates;
      }
    }
  }

  // Score and filter candidates
  for (const id of candidates) {
    const memory = memoryStore.get(id);
    if (!memory) continue;

    // Skip expired unless explicitly included
    if (memory.expiresAt && memory.expiresAt < now && !query.includeExpired) continue;

    // Skip if below confidence threshold
    if (query.minConfidence !== undefined && memory.confidence < query.minConfidence) continue;

    // Skip if below importance threshold
    if (query.minImportance !== undefined && memory.importance < query.minImportance) continue;

    // Score relevance
    let score = 0;
    let matchReasons: string[] = [];

    // Tag matching (highest signal)
    const memoryTags = memory.tags.map(t => t.toLowerCase());
    for (const term of queryTerms) {
      for (const tag of memoryTags) {
        if (tag.includes(term)) {
          score += 0.3;
          matchReasons.push(`tag match: "${term}" in tag "${tag}"`);
        }
      }
    }

    // Content keyword matching
    const contentLower = memory.content.toLowerCase();
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        score += 0.2;
        matchReasons.push(`content match: "${term}"`);
      }
    }

    // Summary matching (if available)
    if (memory.summary) {
      const summaryLower = memory.summary.toLowerCase();
      for (const term of queryTerms) {
        if (summaryLower.includes(term)) {
          score += 0.25;
          matchReasons.push(`summary match: "${term}"`);
        }
      }
    }

    // Boost by importance and confidence
    score *= 0.5 + 0.25 * memory.importance + 0.25 * memory.confidence;

    // Boost by access count (popular memories are more relevant)
    score *= 1 + Math.min(0.2, memory.accessCount * 0.02);

    if (score > 0.05) {
      results.push({
        memory,
        relevanceScore: Math.min(1, score),
        matchReason: matchReasons.slice(0, 3).join('; '),
        layer: memory.layer,
      });
    }
  }

  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, query.limit || 20);
}

/**
 * Get memories scoped to a specific entity.
 */
export function getEntityMemories(entityType: string, entityId: string): MemoryItem[] {
  const scopeKey = `${entityType}:${entityId}`;
  const ids = scopeIndex.get(scopeKey);
  if (!ids) return [];

  return Array.from(ids)
    .map(id => memoryStore.get(id))
    .filter((m): m is MemoryItem => m !== undefined)
    .sort((a, b) => b.importance - a.importance);
}

/**
 * Build a memory context for AI generation.
 * Aggregates relevant memories from all layers for a given scope.
 */
export function buildMemoryContext(options: {
  query?: string;
  scopeEntityType?: string;
  scopeEntityId?: string;
  maxPerLayer?: number;
}): MemoryContext {
  const startTime = Date.now();
  const maxPerLayer = options.maxPerLayer || 10;
  const now = Date.now();

  // Collect relevant memories per layer
  const working: Array<{ content: string; confidence: number }> = [];
  const conversation: Array<{ content: string; confidence: number; timestamp: number }> = [];
  const enterprise: Array<{ content: string; confidence: number; source: string }> = [];
  const institutional: Array<{ content: string; confidence: number; source: string }> = [];

  let searchResults: MemoryRecallResult[] = [];

  if (options.query) {
    searchResults = searchMemories({
      query: options.query,
      limit: maxPerLayer * 4,
      scopeEntityType: options.scopeEntityType,
      scopeEntityId: options.scopeEntityId,
    });
  } else {
    // If no query, get top memories by importance for the scope
    const allMemories = Array.from(memoryStore.values())
      .filter(m => {
        if (m.expiresAt && m.expiresAt < now) return false;
        if (options.scopeEntityId && options.scopeEntityType) {
          return m.scope !== 'global' &&
            m.scope.entityType === options.scopeEntityType &&
            m.scope.entityId === options.scopeEntityId;
        }
        return true;
      })
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxPerLayer * 4);

    searchResults = allMemories.map(m => ({
      memory: m,
      relevanceScore: m.importance,
      matchReason: `top importance: ${m.importance.toFixed(2)}`,
      layer: m.layer,
    }));
  }

  // Distribute into layers
  for (const result of searchResults) {
    const m = result.memory;

    switch (m.layer) {
      case 'working':
        working.push({ content: m.summary || m.content, confidence: m.confidence });
        break;
      case 'conversation':
        conversation.push({
          content: m.summary || m.content,
          confidence: m.confidence,
          timestamp: m.createdAt,
        });
        break;
      case 'enterprise':
        enterprise.push({
          content: m.summary || m.content,
          confidence: m.confidence,
          source: m.source.description,
        });
        break;
      case 'institutional':
        institutional.push({
          content: m.summary || m.content,
          confidence: m.confidence,
          source: m.source.description,
        });
        break;
    }
  }

  // Trim to max per layer
  working.splice(maxPerLayer);
  conversation.splice(maxPerLayer);
  enterprise.splice(maxPerLayer);
  institutional.splice(maxPerLayer);

  const totalMemories = working.length + conversation.length + enterprise.length + institutional.length;

  // Calculate context confidence (weighted by memory confidence)
  const allConfidences = [
    ...working.map(w => w.confidence),
    ...conversation.map(c => c.confidence),
    ...enterprise.map(e => e.confidence),
    ...institutional.map(i => i.confidence),
  ];
  const contextConfidence = allConfidences.length > 0
    ? allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length
    : 0;

  return {
    working: working.slice(0, maxPerLayer),
    conversation: conversation.slice(0, maxPerLayer),
    enterprise: enterprise.slice(0, maxPerLayer),
    institutional: institutional.slice(0, maxPerLayer),
    totalMemories,
    contextConfidence,
    latencyMs: Date.now() - startTime,
  };
}

// ── Memory Consolidation ───────────────────────────────────────────

/**
 * Consolidate memories: merge related memories, archive old/low-importance
 * memories, and produce compressed summaries.
 *
 * This is the "sleep" function of AI memory — it compresses and organizes
 * accumulated knowledge for efficient storage and recall.
 */
export function consolidateMemories(options?: {
  scopeEntityType?: string;
  scopeEntityId?: string;
  maxAge?: number; // milliseconds
  minImportance?: number;
}): MemoryConsolidation {
  const now = Date.now();
  const maxAge = options?.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days
  const minImportance = options?.minImportance || 0.3;
  const consolidationThreshold = 3; // Minimum related memories to consolidate

  // Gather candidates for consolidation
  let candidates = Array.from(memoryStore.values())
    .filter(m => {
      if (m.layer === 'working') return false; // Don't consolidate working memory
      if (m.expiresAt && m.expiresAt < now) return false; // Don't consolidate already expired
      if (options?.scopeEntityId && options.scopeEntityType) {
        if (m.scope === 'global') return false;
        return m.scope.entityType === options.scopeEntityType && m.scope.entityId === options.scopeEntityId;
      }
      return true;
    });

  // Find groups of related memories (by category + tags overlap)
  const groups = findRelatedMemoryGroups(candidates);
  const consolidatedMemories: MemoryItem[] = [];
  const archivedMemories: MemoryItem[] = [];

  // Consolidate groups that meet threshold
  for (const group of groups) {
    if (group.length < consolidationThreshold) continue;

    // Sort by importance — most important becomes the base
    group.sort((a, b) => b.importance - a.importance);
    const base = group[0];
    const others = group.slice(1);

    // Build consolidated content
    const consolidatedContent = others
      .map(m => m.summary || m.content)
      .join(' | ');

    // Create consolidated memory
    const consolidated = storeMemory({
      id: `consolidated-${base.id}-${now}`,
      layer: base.layer,
      category: base.category,
      priority: base.priority,
      scope: base.scope,
      content: `[Consolidated from ${group.length} memories] ${base.content}`,
      summary: `${base.summary || base.content.slice(0, 100)} (+${others.length} related)`,
      tags: [...new Set([...base.tags, ...others.flatMap(m => m.tags)])],
      referencedEntityIds: [...new Set([...base.referencedEntityIds, ...others.flatMap(m => m.referencedEntityIds)])],
      source: { type: 'ai_generation', description: `Memory consolidation of ${group.length} items` },
      confidence: Math.min(0.95, base.confidence * 1.05), // Slight confidence boost from corroboration
      importance: Math.min(1, base.importance * 1.2), // Importance boost from consolidation
      lastAccessedAt: now,
      parentMemoryId: base.id,
      childMemoryIds: others.map(m => m.id),
      metadata: { consolidatedFrom: group.length, consolidatedAt: now },
    });

    consolidatedMemories.push(consolidated);

    // Archive source memories
    for (const m of others) {
      updateMemory(m.id, {
        importance: Math.max(0, m.importance - 0.3),
        expiresAt: now + 7 * 24 * 60 * 60 * 1000, // Archive expires in 7 days
      });
      archivedMemories.push(m);
    }
  }

  // Archive old, low-importance memories
  for (const m of candidates) {
    if (archivedMemories.includes(m)) continue;

    const age = now - m.createdAt;
    if (age > maxAge && m.importance < minImportance && m.priority === 'low') {
      updateMemory(m.id, { expiresAt: now + 24 * 60 * 60 * 1000 }); // Expire in 1 day
      archivedMemories.push(m);
    }
  }

  // Calculate compression ratio
  const sourceContentLength = consolidatedMemories.reduce((sum, c) =>
    sum + c.childMemoryIds.reduce((s2, id) => {
      const m = memoryStore.get(id);
      return s2 + (m ? m.content.length : 0);
    }, 0), 0);

  const consolidatedContentLength = consolidatedMemories.reduce((sum, c) => sum + c.content.length, 0);
  const compressionRatio = sourceContentLength > 0
    ? consolidatedContentLength / sourceContentLength
    : 1;

  return {
    consolidatedMemory: consolidatedMemories[0] || {
      id: 'none',
      layer: 'working',
      category: 'feedback',
      priority: 'low',
      scope: 'global',
      content: 'No consolidation needed',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: 'No consolidation' },
      confidence: 0,
      importance: 0,
      accessCount: 0,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
      childMemoryIds: [],
      metadata: {},
    },
    sourceMemories: archivedMemories,
    archivedMemories,
    compressionRatio,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Find groups of related memories by category and tag overlap.
 * Simple clustering: memories sharing category AND at least one tag.
 */
function findRelatedMemoryGroups(memories: MemoryItem[]): MemoryItem[][] {
  const groups: MemoryItem[][] = [];

  for (const memory of memories) {
    // Check if this memory fits into an existing group
    let placed = false;

    for (const group of groups) {
      const base = group[0];
      // Same category
      if (memory.category !== base.category) continue;
      // At least one shared tag
      const sharedTags = memory.tags.filter(t => base.tags.some(bt => bt.toLowerCase() === t.toLowerCase()));
      if (sharedTags.length === 0) continue;
      // Same scope type (both global or both same entity)
      if (memory.scope !== 'global' && base.scope !== 'global') {
        if (memory.scope.entityId !== base.scope.entityId) continue;
      }

      group.push(memory);
      placed = true;
      break;
    }

    if (!placed) {
      groups.push([memory]);
    }
  }

  return groups;
}

// ── Memory Decay ───────────────────────────────────────────────────

/**
 * Apply time-based decay to memory importance scores.
 * Ephemeral memories decay fastest; institutional memories decay slowest.
 */
export function applyMemoryDecay(): { decayed: number; expired: number } {
  const now = Date.now();
  let decayed = 0;
  let expired = 0;

  for (const [id, memory] of memoryStore) {
    // Check expiry
    if (memory.expiresAt && memory.expiresAt < now) {
      forgetMemory(id);
      expired++;
      continue;
    }

    // Apply decay based on layer
    const ageDays = (now - memory.updatedAt) / (24 * 60 * 60 * 1000);
    let decayRate: number;

    switch (memory.layer) {
      case 'working':
        decayRate = 0.1; // Fast decay — 10% per day
        break;
      case 'conversation':
        decayRate = 0.02; // Moderate — 2% per day
        break;
      case 'enterprise':
        decayRate = 0.005; // Slow — 0.5% per day
        break;
      case 'institutional':
        decayRate = 0.001; // Very slow — 0.1% per day
        break;
    }

    // Don't decay critical or high-priority memories as fast
    if (memory.priority === 'critical') decayRate *= 0.3;
    else if (memory.priority === 'high') decayRate *= 0.6;

    // Access count reduces decay (frequently accessed memories persist)
    const accessBoost = Math.min(0.9, memory.accessCount * 0.05);
    decayRate *= (1 - accessBoost);

    // Apply decay
    const newImportance = memory.importance * (1 - decayRate * ageDays);
    if (newImportance < 0.05) {
      forgetMemory(id);
      expired++;
    } else if (newImportance < memory.importance - 0.001) {
      updateMemory(id, { importance: Math.max(0.05, newImportance) });
      decayed++;
    }
  }

  return { decayed, expired };
}

// ── Memory Statistics ──────────────────────────────────────────────

/**
 * Get comprehensive memory statistics.
 */
export function getMemoryStats(): MemoryStats {
  const now = Date.now();
  let totalConfidence = 0;
  let totalImportance = 0;
  let totalAccess = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  let expiringSoon = 0;
  let expired = 0;
  let consolidationCandidates = 0;

  const byLayer: Record<MemoryLayer, number> = { working: 0, conversation: 0, enterprise: 0, institutional: 0 };
  const byCategory = {} as Partial<Record<MemoryCategory, number>>;
  const byPriority: Record<MemoryPriority, number> = { critical: 0, high: 0, medium: 0, low: 0, ephemeral: 0 };

  for (const memory of memoryStore.values()) {
    byLayer[memory.layer]++;
    byCategory[memory.category] = (byCategory[memory.category] || 0) + 1;
    byPriority[memory.priority]++;

    totalConfidence += memory.confidence;
    totalImportance += memory.importance;
    totalAccess += memory.accessCount;

    if (oldest === null || memory.createdAt < oldest) oldest = memory.createdAt;
    if (newest === null || memory.createdAt > newest) newest = memory.createdAt;

    if (memory.expiresAt) {
      if (memory.expiresAt < now) {
        expired++;
      } else if (memory.expiresAt < now + 7 * 24 * 60 * 60 * 1000) {
        expiringSoon++;
      }
    }

    if (memory.importance > 0.3 && memory.layer !== 'working') {
      consolidationCandidates++;
    }
  }

  const total = memoryStore.size;

  return {
    totalMemories: total,
    byLayer,
    byCategory,
    byPriority,
    averageConfidence: total > 0 ? totalConfidence / total : 0,
    averageImportance: total > 0 ? totalImportance / total : 0,
    totalAccessCount: totalAccess,
    oldestMemory: oldest,
    newestMemory: newest,
    expiringSoon,
    expired,
    consolidationCandidates,
  };
}

/**
 * Clear all memories.
 */
export function clearAllMemories(): void {
  memoryStore.clear();
  layerIndex.clear();
  categoryIndex.clear();
  scopeIndex.clear();
  tagIndex.clear();
  seeded = false;
}

/**
 * Get all memories.
 */
export function getAllMemories(): MemoryItem[] {
  return Array.from(memoryStore.values());
}

/**
 * WI-18.2 Phase 3: Get raw Map references for cold-start hydration and
 * shadow-mode reconciliation.
 */
export function getMemoryMaps(): {
  memoryStore: ReadonlyMap<string, MemoryItem>;
  layerIndex: ReadonlyMap<MemoryLayer, Set<string>>;
  categoryIndex: ReadonlyMap<MemoryCategory, Set<string>>;
  scopeIndex: ReadonlyMap<string, Set<string>>;
  tagIndex: ReadonlyMap<string, Set<string>>;
} {
  return { memoryStore, layerIndex, categoryIndex, scopeIndex, tagIndex };
}

/**
 * WI-18.2 Phase 3: Bulk-insert memories during cold-start hydration.
 * Rebuilds derived indices. Skips persistence writes.
 */
export function hydrateMemories(memories: MemoryItem[]): void {
  for (const memory of memories) {
    memoryStore.set(memory.id, memory);
    // Rebuild indices inline (same as updateIndices but without persist)
    let layerIds = layerIndex.get(memory.layer);
    if (!layerIds) { layerIds = new Set(); layerIndex.set(memory.layer, layerIds); }
    layerIds.add(memory.id);

    let catIds = categoryIndex.get(memory.category);
    if (!catIds) { catIds = new Set(); categoryIndex.set(memory.category, catIds); }
    catIds.add(memory.id);

    if (memory.scope !== 'global' && memory.scope?.entityId) {
      let scopeIds = scopeIndex.get(memory.scope.entityId);
      if (!scopeIds) { scopeIds = new Set(); scopeIndex.set(memory.scope.entityId, scopeIds); }
      scopeIds.add(memory.id);
    }

    for (const tag of memory.tags || []) {
      let tagIds = tagIndex.get(tag);
      if (!tagIds) { tagIds = new Set(); tagIndex.set(tag, tagIds); }
      tagIds.add(memory.id);
    }
  }
  logger.info(`[cold-start] Hydrated ${memories.length} memories (indices rebuilt)`);
}

// ── Index Management ───────────────────────────────────────────────

function updateIndices(memory: MemoryItem): void {
  // Layer index
  let layerIds = layerIndex.get(memory.layer);
  if (!layerIds) { layerIds = new Set(); layerIndex.set(memory.layer, layerIds); }
  layerIds.add(memory.id);

  // Category index
  let catIds = categoryIndex.get(memory.category);
  if (!catIds) { catIds = new Set(); categoryIndex.set(memory.category, catIds); }
  catIds.add(memory.id);

  // Scope index
  if (memory.scope !== 'global') {
    const scopeKey = `${memory.scope.entityType}:${memory.scope.entityId}`;
    let scopeIds = scopeIndex.get(scopeKey);
    if (!scopeIds) { scopeIds = new Set(); scopeIndex.set(scopeKey, scopeIds); }
    scopeIds.add(memory.id);
  }

  // Tag index
  for (const tag of memory.tags) {
    const tagKey = tag.toLowerCase();
    let tagIds = tagIndex.get(tagKey);
    if (!tagIds) { tagIds = new Set(); tagIndex.set(tagKey, tagIds); }
    tagIds.add(memory.id);
  }
}

function removeFromIndices(memory: MemoryItem): void {
  const layerIds = layerIndex.get(memory.layer);
  if (layerIds) layerIds.delete(memory.id);

  const catIds = categoryIndex.get(memory.category);
  if (catIds) catIds.delete(memory.id);

  if (memory.scope !== 'global') {
    const scopeKey = `${memory.scope.entityType}:${memory.scope.entityId}`;
    const scopeIds = scopeIndex.get(scopeKey);
    if (scopeIds) scopeIds.delete(memory.id);
  }

  for (const tag of memory.tags) {
    const tagKey = tag.toLowerCase();
    const tagIds = tagIndex.get(tagKey);
    if (tagIds) tagIds.delete(memory.id);
  }
}

// ── Seed Data ──────────────────────────────────────────────────────

/**
 * Seed the memory system with realistic enterprise AI memory data.
 */
export function seedMemorySystem(): void {
  if (seeded) return;
  seeded = true;

  const now = Date.now();

  // ── Working Memory ──
  const workingMemories: Array<Omit<MemoryItem, 'createdAt' | 'updatedAt' | 'version' | 'accessCount' | 'childMemoryIds'>> = [
    {
      id: 'wm-active-query',
      layer: 'working',
      category: 'signal_analysis',
      priority: 'high',
      scope: 'global',
      content: 'Active analysis: Acme Corp cloud migration opportunity assessment in progress',
      tags: ['acme', 'cloud', 'migration', 'active'],
      referencedEntityIds: ['co-acme'],
      source: { type: 'user_input', description: 'Current user query' },
      confidence: 0.9,
      importance: 0.85,
      lastAccessedAt: now,
      expiresAt: now + 30 * 60 * 1000, // 30 minutes
      metadata: { sessionId: 'current' },
    },
    {
      id: 'wm-recent-retrieval',
      layer: 'working',
      category: 'company_intelligence',
      priority: 'medium',
      scope: { entityType: 'company', entityId: 'co-acme' },
      content: 'Retrieved: Acme Corp uses AWS, Kubernetes, Terraform, Docker, PostgreSQL. CTO is Sarah Chen. Series D funding raised.',
      tags: ['acme', 'technology', 'aws', 'kubernetes'],
      referencedEntityIds: ['co-acme', 't-aws', 't-kubernetes'],
      source: { type: 'ai_generation', description: 'Hybrid retrieval result' },
      confidence: 0.85,
      importance: 0.7,
      lastAccessedAt: now,
      expiresAt: now + 60 * 60 * 1000, // 1 hour
      metadata: {},
    },
  ];

  // ── Conversation Memory ──
  const conversationMemories: Array<Omit<MemoryItem, 'createdAt' | 'updatedAt' | 'version' | 'accessCount' | 'childMemoryIds'>> = [
    {
      id: 'cm-user-pref-industry',
      layer: 'conversation',
      category: 'user_preference',
      priority: 'high',
      scope: 'global',
      content: 'User prefers detailed technology stack analysis before outreach recommendations',
      tags: ['preference', 'technology', 'analysis', 'workflow'],
      referencedEntityIds: [],
      source: { type: 'conversation', description: 'User feedback pattern' },
      confidence: 0.9,
      importance: 0.8,
      lastAccessedAt: now,
      metadata: { preferenceType: 'workflow', detectedAt: now - 7 * 24 * 60 * 60 * 1000 },
    },
    {
      id: 'cm-prev-acme-analysis',
      layer: 'conversation',
      category: 'conversation_history',
      priority: 'medium',
      scope: { entityType: 'company', entityId: 'co-acme' },
      content: 'Previous session: User asked about Acme Corp competitive position. Identified Initech as main competitor.',
      tags: ['acme', 'competitive', 'previous_session'],
      referencedEntityIds: ['co-acme', 'co-initech'],
      source: { type: 'conversation', description: 'Previous session analysis' },
      confidence: 0.8,
      importance: 0.6,
      lastAccessedAt: now - 2 * 24 * 60 * 60 * 1000,
      metadata: { sessionId: 'prev-session-001' },
    },
    {
      id: 'cm-feedback-accuracy',
      layer: 'conversation',
      category: 'feedback',
      priority: 'medium',
      scope: 'global',
      content: 'User confirmed signal detection accuracy for funding events was high. Suggested adding more context to technology change signals.',
      tags: ['feedback', 'accuracy', 'signal_detection', 'improvement'],
      referencedEntityIds: [],
      source: { type: 'user_input', description: 'Direct user feedback' },
      confidence: 0.95,
      importance: 0.65,
      lastAccessedAt: now - 3 * 24 * 60 * 60 * 1000,
      metadata: {},
    },
  ];

  // ── Enterprise Memory ──
  const enterpriseMemories: Array<Omit<MemoryItem, 'createdAt' | 'updatedAt' | 'version' | 'accessCount' | 'childMemoryIds'>> = [
    {
      id: 'em-acme-tech-stack',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'critical',
      scope: { entityType: 'company', entityId: 'co-acme' },
      content: 'Acme Corp technology stack: AWS (primary cloud), Kubernetes (container orchestration), Terraform (IaC), Docker (containerization), PostgreSQL (primary database). Full stack confirmed by multiple sources.',
      summary: 'Acme: AWS + K8s + Terraform + Docker + PostgreSQL',
      tags: ['acme', 'technology', 'aws', 'kubernetes', 'terraform', 'docker', 'postgresql'],
      referencedEntityIds: ['co-acme', 't-aws', 't-kubernetes', 't-terraform', 't-docker', 't-postgresql'],
      source: { type: 'external_intelligence', description: 'Aggregated from multiple signal sources' },
      confidence: 0.92,
      importance: 0.9,
      lastAccessedAt: now - 1 * 24 * 60 * 60 * 1000,
      metadata: { sourceCount: 5, lastVerified: now - 1 * 24 * 60 * 60 * 1000 },
    },
    {
      id: 'em-globex-ciso-departure',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'critical',
      scope: { entityType: 'company', entityId: 'co-globex' },
      content: 'Globex Inc CISO departed. This creates an urgent cybersecurity opportunity. Previous engagement history shows Globex values comprehensive security assessments.',
      summary: 'Globex: CISO departed → cybersecurity opportunity',
      tags: ['globex', 'ciso', 'departure', 'security', 'opportunity', 'urgent'],
      referencedEntityIds: ['co-globex', 'cap-cybersecurity'],
      source: { type: 'external_intelligence', description: 'Signal detection + historical analysis' },
      confidence: 0.95,
      importance: 0.95,
      lastAccessedAt: now - 12 * 60 * 60 * 1000,
      metadata: { signalSeverity: 'critical', opportunityScore: 0.92 },
    },
    {
      id: 'em-initech-cloud-migration',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'high',
      scope: { entityType: 'company', entityId: 'co-initech' },
      content: 'Initech Systems announced cloud migration initiative. Currently using legacy ERP system. Migrating to Kubernetes architecture. This is a significant modernization opportunity for cloud migration and DevOps capabilities.',
      summary: 'Initech: cloud migration, legacy ERP → Kubernetes',
      tags: ['initech', 'cloud', 'migration', 'erp', 'kubernetes', 'modernization'],
      referencedEntityIds: ['co-initech', 'cap-cloud-migration', 'cap-devops'],
      source: { type: 'external_intelligence', description: 'Signal detection' },
      confidence: 0.9,
      importance: 0.88,
      lastAccessedAt: now - 2 * 24 * 60 * 60 * 1000,
      metadata: { migrationPhase: 'early' },
    },
    {
      id: 'em-umbrella-breach',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'critical',
      scope: { entityType: 'company', entityId: 'co-umbrella' },
      content: 'Umbrella Corp suffered a security breach. This is an immediate cybersecurity need. Lisa Wang (Head of IT) is a key contact. Umbrella uses GCP.',
      summary: 'Umbrella: security breach → urgent cybersecurity need',
      tags: ['umbrella', 'breach', 'security', 'urgent', 'gcp'],
      referencedEntityIds: ['co-umbrella', 'sig-umbrella-breach', 'p-lisa'],
      source: { type: 'external_intelligence', description: 'News monitoring + signal detection' },
      confidence: 0.98,
      importance: 0.95,
      lastAccessedAt: now - 6 * 60 * 60 * 1000,
      metadata: { breachSeverity: 'critical' },
    },
    {
      id: 'em-sarah-chen-cto',
      layer: 'enterprise',
      category: 'contact_intelligence',
      priority: 'high',
      scope: { entityType: 'person', entityId: 'p-sarah' },
      content: 'Sarah Chen is CTO at Acme Corp. Key decision maker for technology initiatives. Reported to have strong influence on cloud strategy. Previous interactions show preference for data-driven proposals.',
      summary: 'Sarah Chen: Acme CTO, cloud decision maker',
      tags: ['sarah-chen', 'cto', 'acme', 'decision-maker', 'cloud'],
      referencedEntityIds: ['p-sarah', 'co-acme'],
      source: { type: 'human_intelligence', description: 'CRM data + interaction history' },
      confidence: 0.88,
      importance: 0.82,
      lastAccessedAt: now - 5 * 24 * 60 * 60 * 1000,
      metadata: { seniority: 'executive', influenceScore: 0.85 },
    },
  ];

  // ── Institutional Memory ──
  const institutionalMemories: Array<Omit<MemoryItem, 'createdAt' | 'updatedAt' | 'version' | 'accessCount' | 'childMemoryIds'>> = [
    {
      id: 'im-cloud-migration-pattern',
      layer: 'institutional',
      category: 'learning_insight',
      priority: 'high',
      scope: 'global',
      content: 'Pattern: Companies announcing cloud migration initiatives typically have 3-6 month decision windows. CTO and CIO are primary decision makers. Legacy ERP presence increases conversion probability by 40%. Successful engagement requires technology fit assessment within first 2 weeks.',
      summary: 'Cloud migration opportunity pattern: 3-6 month windows, CTO/CIO targets, legacy ERP = +40% conversion',
      tags: ['pattern', 'cloud', 'migration', 'enterprise', 'win-pattern'],
      referencedEntityIds: [],
      source: { type: 'learning_event', description: 'Aggregated from 15 cloud migration deals' },
      confidence: 0.85,
      importance: 0.9,
      lastAccessedAt: now - 10 * 24 * 60 * 60 * 1000,
      metadata: { dealCount: 15, successRate: 0.67, avgDealSize: '$2.5M' },
    },
    {
      id: 'im-security-breach-response',
      layer: 'institutional',
      category: 'learning_insight',
      priority: 'critical',
      scope: 'global',
      content: 'Pattern: Security breach incidents create immediate cybersecurity assessment opportunities. Best response time is within 48 hours of breach news. Head of IT/CISO are key contacts. Average deal conversion rate for breach-triggered opportunities is 72% higher than cold outreach.',
      summary: 'Security breach → immediate opportunity, 48hr response, 72% higher conversion',
      tags: ['pattern', 'security', 'breach', 'opportunity', 'urgent', 'win-pattern'],
      referencedEntityIds: [],
      source: { type: 'learning_event', description: 'Aggregated from 8 security incident responses' },
      confidence: 0.9,
      importance: 0.95,
      lastAccessedAt: now - 5 * 24 * 60 * 60 * 1000,
      metadata: { dealCount: 8, responseWindow: '48 hours', conversionBoost: 0.72 },
    },
    {
      id: 'im-technology-competitor-eco',
      layer: 'institutional',
      category: 'competitive_intelligence',
      priority: 'medium',
      scope: 'global',
      content: 'AWS and Azure are direct competitors. AWS has larger market share in pure cloud. Azure has advantage in enterprise/microsoft-ecosystem shops. GCP is strong in data/ML workloads. Companies using AWS are more likely to adopt Kubernetes than those using Azure.',
      summary: 'Cloud competitive landscape: AWS vs Azure vs GCP positioning',
      tags: ['competitive', 'aws', 'azure', 'gcp', 'cloud', 'market'],
      referencedEntityIds: ['t-aws', 't-azure', 't-gcp'],
      source: { type: 'system_detection', description: 'Market intelligence aggregation' },
      confidence: 0.82,
      importance: 0.75,
      lastAccessedAt: now - 15 * 24 * 60 * 60 * 1000,
      metadata: {},
    },
    {
      id: 'im-error-false-signal',
      layer: 'institutional',
      category: 'error_correction',
      priority: 'medium',
      scope: 'global',
      content: 'Correction: AI previously reported funding for a company that had not raised. Root cause: news article mentioned funding round from previous year. Fix: Always verify signal date recency before presenting as current intelligence.',
      summary: 'Error correction: verify signal date recency to prevent stale data',
      tags: ['error', 'correction', 'signal', 'false-positive', 'stale-data'],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: 'Self-detected hallucination correction' },
      confidence: 0.95,
      importance: 0.7,
      lastAccessedAt: now - 20 * 24 * 60 * 60 * 1000,
      metadata: { errorType: 'stale_signal', correctionDate: now - 20 * 24 * 60 * 60 * 1000 },
    },
  ];

  // Store all memories
  const allMemories = [
    ...workingMemories,
    ...conversationMemories,
    ...enterpriseMemories,
    ...institutionalMemories,
  ];

  for (const memory of allMemories) {
    storeMemory(memory);
  }

  logger.info('[WI-16H] Memory system seeded', {
    totalMemories: allMemories.length,
    working: workingMemories.length,
    conversation: conversationMemories.length,
    enterprise: enterpriseMemories.length,
    institutional: institutionalMemories.length,
  });
}
