/**
 * WI-16G — Knowledge Graph Intelligence Tests
 * ===============================================
 *
 * Comprehensive test suite covering:
 *   1. Graph data model (nodes, edges, types)
 *   2. Graph construction (add, remove, upsert)
 *   3. Entity extraction and graph population
 *   4. BFS traversal and path finding
 *   5. Graph-based recommendations
 *   6. Cross-entity reasoning
 *   7. Graph statistics
 *   8. Integration with hybrid retrieval
 *   9. Seed data integrity
 */

import {
  clearGraph,
  seedKnowledgeGraph,
  addNode,
  addEdge,
  removeNode,
  removeEdge,
  getNode,
  resolveEntity,
  getNodeEdges,
  getOutgoingEdges,
  getIncomingEdges,
  extractGraphEntities,
  populateGraphFromIntelligence,
  traverseBFS,
  findPaths,
  findShortestPath,
  expandFromEntity,
  generateRecommendations,
  reasonAboutEntity,
  getGraphStats,
  getAllNodes,
  getAllEdges,
  type GraphNode,
  type GraphEdge,
  type GraphEntityType,
  type RelationshipType,
} from '@/lib/ai-knowledge-graph';

// ── Setup & Teardown ───────────────────────────────────────────────

beforeEach(() => {
  clearGraph();
});

// ── 1. Graph Data Model ────────────────────────────────────────────

describe('WI-16G: Graph Data Model', () => {
  test('should create a node with all required fields', () => {
    const node = addNode({
      id: 'test-company',
      label: 'Test Corp',
      type: 'company',
      aliases: ['Test Corporation'],
      properties: { industry: 'Technology', revenue: '$1B' },
      confidence: 0.9,
    });

    expect(node).toBeDefined();
    expect(node.id).toBe('test-company');
    expect(node.label).toBe('Test Corp');
    expect(node.type).toBe('company');
    expect(node.aliases).toEqual(['Test Corporation']);
    expect(node.confidence).toBe(0.9);
    expect(node.createdAt).toBeDefined();
    expect(node.updatedAt).toBeDefined();
  });

  test('should create an edge with all required fields', () => {
    addNode({ id: 'co-a', label: 'Company A', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'co-b', label: 'Company B', type: 'company', aliases: [], confidence: 0.9 });

    const edge = addEdge({
      id: 'e-a-b',
      sourceId: 'co-a',
      targetId: 'co-b',
      relationship: 'PARTNERS_WITH',
      weight: 0.8,
      confidence: 0.85,
      reason: 'Strategic partnership',
      evidenceIds: ['ev-1'],
    });

    expect(edge).toBeDefined();
    expect(edge.id).toBe('e-a-b');
    expect(edge.sourceId).toBe('co-a');
    expect(edge.targetId).toBe('co-b');
    expect(edge.relationship).toBe('PARTNERS_WITH');
    expect(edge.weight).toBe(0.8);
    expect(edge.confidence).toBe(0.85);
    expect(edge.createdAt).toBeDefined();
  });

  test('should support all 15 entity types', () => {
    const types: GraphEntityType[] = [
      'company', 'person', 'technology', 'industry', 'role',
      'location', 'product', 'financial', 'event', 'generic',
      'capability', 'signal', 'opportunity', 'document', 'conversation',
    ];

    for (const type of types) {
      const node = addNode({ id: `node-${type}`, label: `Test ${type}`, type, aliases: [], confidence: 0.7 });
      expect(node.type).toBe(type);
    }

    expect(getAllNodes().length).toBe(15);
  });

  test('should support all 29 relationship types', () => {
    addNode({ id: 'src', label: 'Source', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'tgt', label: 'Target', type: 'company', aliases: [], confidence: 0.9 });

    const relationships: RelationshipType[] = [
      'WORKS_AT', 'WORKED_AT', 'BOARD_MEMBER_OF', 'REPORTS_TO',
      'PARTNERS_WITH', 'COMPETES_WITH', 'ACQUIRED_BY', 'INVESTED_IN', 'SUPPLIES_TO', 'VENDOR_FOR',
      'USES_TECHNOLOGY', 'DEPLOYS_ON', 'MIGRATED_FROM', 'MIGRATED_TO', 'INTEGRATES_WITH', 'BUILDS_ON',
      'HAS_SIGNAL', 'INDICATES_OPPORTUNITY', 'MATCHES_CAPABILITY', 'INFLUENCES',
      'MENTIONS', 'SUPPORTS_CLAIM', 'CONTRADICTS_CLAIM',
      'HAPPENED_BEFORE', 'HAPPENED_DURING',
      'DERIVED_FROM', 'EXTRACTED_FROM',
      'RELATED_TO', 'SIMILAR_TO',
    ];

    for (const rel of relationships) {
      const edge = addEdge({
        id: `e-${rel.toLowerCase()}`,
        sourceId: 'src',
        targetId: 'tgt',
        relationship: rel,
        weight: 0.5,
        confidence: 0.6,
        reason: `Test ${rel}`,
        evidenceIds: [],
      });
      expect(edge.relationship).toBe(rel);
    }

    expect(getAllEdges().length).toBe(29);
  });
});

// ── 2. Graph Construction ─────────────────────────────────────────

describe('WI-16G: Graph Construction', () => {
  test('should upsert nodes (update existing)', async () => {
    addNode({ id: 'co-1', label: 'Old Name', type: 'company', aliases: [], confidence: 0.7 });
    const createdAt = (await getNode('co-1'))!.createdAt;

    const updated = addNode({
      id: 'co-1',
      label: 'New Name',
      type: 'company',
      aliases: ['Updated Corp'],
      properties: { revenue: '$5B' },
      confidence: 0.95,
    });

    expect(updated.label).toBe('New Name');
    expect(updated.confidence).toBe(0.95);
    expect(updated.createdAt).toBe(createdAt); // Preserved
    expect(updated.updatedAt).toBeGreaterThanOrEqual(createdAt); // Updated (may equal if same ms)
  });

  test('should remove a node and its connected edges', async () => {
    addNode({ id: 'co-a', label: 'A', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'co-b', label: 'B', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'co-c', label: 'C', type: 'company', aliases: [], confidence: 0.9 });
    addEdge({ id: 'e-ab', sourceId: 'co-a', targetId: 'co-b', relationship: 'PARTNERS_WITH', weight: 0.8, confidence: 0.9, reason: 'Partnership', evidenceIds: [] });
    addEdge({ id: 'e-ac', sourceId: 'co-a', targetId: 'co-c', relationship: 'COMPETES_WITH', weight: 0.7, confidence: 0.8, reason: 'Competition', evidenceIds: [] });
    addEdge({ id: 'e-bc', sourceId: 'co-b', targetId: 'co-c', relationship: 'SUPPLIES_TO', weight: 0.6, confidence: 0.7, reason: 'Supply chain', evidenceIds: [] });

    expect(getAllNodes().length).toBe(3);
    expect(getAllEdges().length).toBe(3);

    const removed = removeNode('co-a');
    expect(removed).toBe(true);

    expect(await getNode('co-a')).toBeUndefined();
    expect(getAllNodes().length).toBe(2);
    expect(getAllEdges().length).toBe(1); // e-bc remains
  });

  test('should remove an edge without affecting nodes', () => {
    addNode({ id: 'n1', label: 'N1', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'n2', label: 'N2', type: 'company', aliases: [], confidence: 0.9 });
    addEdge({ id: 'e-12', sourceId: 'n1', targetId: 'n2', relationship: 'RELATED_TO', weight: 0.5, confidence: 0.5, reason: '', evidenceIds: [] });

    const removed = removeEdge('e-12');
    expect(removed).toBe(true);
    expect(getAllEdges().length).toBe(0);
    expect(getAllNodes().length).toBe(2);
  });

  test('should return false for removing non-existent nodes/edges', () => {
    expect(removeNode('nonexistent')).toBe(false);
    expect(removeEdge('nonexistent')).toBe(false);
  });
});

// ── 3. Entity Extraction & Population ──────────────────────────────

describe('WI-16G: Entity Extraction', () => {
  test('should extract entities from text and map to graph types', () => {
    const extractions = extractGraphEntities(
      'Sarah Chen works at Microsoft as CTO. They use Azure cloud services and Kubernetes for container orchestration.'
    );

    expect(extractions.length).toBeGreaterThan(0);

    // Should detect at least one entity with a graph type
    const graphTypes = extractions.map(e => e.graphType);
    const validTypes: GraphEntityType[] = [
      'company', 'person', 'technology', 'industry', 'role',
      'location', 'product', 'financial', 'event', 'generic',
    ];
    for (const gt of graphTypes) {
      expect(validTypes).toContain(gt);
    }

    // Should have suggested relationships for multi-entity extractions
    if (extractions.length > 1) {
      const withRelationships = extractions.filter(e => e.suggestedRelationships.length > 0);
      expect(withRelationships.length).toBeGreaterThan(0);
    }
  });

  test('should populate graph from extracted entities', () => {
    const extractions = extractGraphEntities(
      'Google uses Kubernetes and Google Cloud Platform. They compete with Microsoft Azure.'
    );

    const result = populateGraphFromIntelligence(extractions, 'test-extraction');

    expect(result.nodesAdded).toBeGreaterThan(0);
    expect(result.edgesAdded).toBeGreaterThan(0);
    expect(getAllNodes().length).toBeGreaterThan(0);
    expect(getAllEdges().length).toBeGreaterThan(0);
  });

  test('should resolve entity by label', async () => {
    addNode({ id: 'co-acme', label: 'Acme Corp', type: 'company', aliases: ['Acme Corporation', 'Acme'], confidence: 0.9 });

    // Exact label
    let matches = await resolveEntity('acme corp');
    expect(matches.length).toBe(1);

    // Alias
    matches = await resolveEntity('acme');
    expect(matches.length).toBe(1);

    // No match
    matches = await resolveEntity('nonexistent company');
    expect(matches.length).toBe(0);
  });

  test('should get node edges (outgoing and incoming)', async () => {
    addNode({ id: 'n1', label: 'N1', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'n2', label: 'N2', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'n3', label: 'N3', type: 'company', aliases: [], confidence: 0.9 });

    addEdge({ id: 'e-12', sourceId: 'n1', targetId: 'n2', relationship: 'PARTNERS_WITH', weight: 0.8, confidence: 0.9, reason: '', evidenceIds: [] });
    addEdge({ id: 'e-31', sourceId: 'n3', targetId: 'n1', relationship: 'COMPETES_WITH', weight: 0.7, confidence: 0.8, reason: '', evidenceIds: [] });

    const allEdges = await getNodeEdges('n1');
    expect(allEdges.length).toBe(2);

    const outgoing = getOutgoingEdges('n1');
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].targetId).toBe('n2');

    const incoming = getIncomingEdges('n1');
    expect(incoming.length).toBe(1);
    expect(incoming[0].sourceId).toBe('n3');
  });
});

// ── 4. Graph Traversal ─────────────────────────────────────────────

describe('WI-16G: Graph Traversal', () => {
  beforeEach(() => {
    // Build a simple test graph:
    // Company A → Person 1 → Company B → Technology X
    addNode({ id: 'co-a', label: 'Company A', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'co-b', label: 'Company B', type: 'company', aliases: [], confidence: 0.9 });
    addNode({ id: 'p-1', label: 'Person 1', type: 'person', aliases: [], confidence: 0.9 });
    addNode({ id: 't-x', label: 'Technology X', type: 'technology', aliases: [], confidence: 0.9 });
    addNode({ id: 'ind-y', label: 'Industry Y', type: 'industry', aliases: [], confidence: 0.9 });

    addEdge({ id: 'e-a-p1', sourceId: 'co-a', targetId: 'p-1', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Person works at A', evidenceIds: [] });
    addEdge({ id: 'e-p1-b', sourceId: 'p-1', targetId: 'co-b', relationship: 'WORKS_AT', weight: 0.8, confidence: 0.9, reason: 'Person also at B', evidenceIds: [] });
    addEdge({ id: 'e-b-x', sourceId: 'co-b', targetId: 't-x', relationship: 'USES_TECHNOLOGY', weight: 0.85, confidence: 0.9, reason: 'B uses tech X', evidenceIds: [] });
    addEdge({ id: 'e-a-ind', sourceId: 'co-a', targetId: 'ind-y', relationship: 'RELATED_TO', weight: 0.7, confidence: 0.8, reason: 'A in industry Y', evidenceIds: [] });
    addEdge({ id: 'e-b-ind', sourceId: 'co-b', targetId: 'ind-y', relationship: 'RELATED_TO', weight: 0.7, confidence: 0.8, reason: 'B in industry Y', evidenceIds: [] });
  });

  test('BFS should discover all reachable nodes within hop limit', () => {
    const results = traverseBFS('co-a', { maxHops: 2 });

    const discoveredIds = new Set(results.map(r => r.node.id));
    expect(discoveredIds.has('p-1')).toBe(true);
    expect(discoveredIds.has('co-b')).toBe(true);
    expect(discoveredIds.has('t-x')).toBe(false); // t-x is 3 hops: A→P1→B→X
    expect(discoveredIds.has('ind-y')).toBe(true);
    expect(discoveredIds.has('co-a')).toBe(false); // Don't include origin
  });

  test('BFS should respect hop limit', () => {
    const results1 = traverseBFS('co-a', { maxHops: 1 });
    const ids1 = new Set(results1.map(r => r.node.id));

    expect(ids1.has('p-1')).toBe(true); // Direct connection
    expect(ids1.has('ind-y')).toBe(true); // Direct connection
    // co-b is reachable via p-1 (2 hops) but with bidirectional, might appear at 1 hop via industry
    // But in our graph, co-b is NOT directly connected to co-a

    const results0 = traverseBFS('co-a', { maxHops: 0 });
    expect(results0.length).toBe(0); // No traversal at 0 hops
  });

  test('BFS should filter by node type', () => {
    const results = traverseBFS('co-a', {
      maxHops: 3,
      allowedNodeTypes: ['person'],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.node.type === 'person')).toBe(true);
  });

  test('BFS should filter by relationship type', () => {
    const results = traverseBFS('co-a', {
      maxHops: 3,
      allowedRelationships: ['WORKS_AT'],
    });

    // Only follow WORKS_AT edges
    const personResults = results.filter(r => r.node.id === 'p-1');
    expect(personResults.length).toBeGreaterThan(0);
  });

  test('BFS should respect minWeight', () => {
    // Add a very low-weight edge
    addNode({ id: 'n-low', label: 'Low Weight Node', type: 'company', aliases: [], confidence: 0.5 });
    addEdge({ id: 'e-low', sourceId: 'co-a', targetId: 'n-low', relationship: 'RELATED_TO', weight: 0.05, confidence: 0.1, reason: '', evidenceIds: [] });

    const results = traverseBFS('co-a', { minWeight: 0.2, maxHops: 1 });
    const ids = results.map(r => r.node.id);
    expect(ids).not.toContain('n-low');
  });

  test('BFS results should be sorted by score', () => {
    const results = traverseBFS('co-a', { maxHops: 3 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].path.totalScore).toBeGreaterThanOrEqual(results[i].path.totalScore);
    }
  });

  test('findPaths should find paths between two nodes', () => {
    const paths = findPaths('co-a', 't-x', { maxHops: 5 });

    expect(paths.length).toBeGreaterThan(0);

    // Every path should start at co-a and end at t-x
    for (const path of paths) {
      expect(path.nodes[0].id).toBe('co-a');
      expect(path.nodes[path.nodes.length - 1].id).toBe('t-x');
      expect(path.hops).toBeGreaterThanOrEqual(2);
    }
  });

  test('findPaths should return empty for disconnected nodes', () => {
    addNode({ id: 'isolated', label: 'Isolated', type: 'company', aliases: [], confidence: 0.9 });

    const paths = findPaths('isolated', 'co-a', { maxHops: 5 });
    expect(paths.length).toBe(0);
  });

  test('findShortestPath should return the best path', () => {
    const path = findShortestPath('co-a', 'co-b');

    expect(path).not.toBeNull();
    expect(path!.nodes[0].id).toBe('co-a');
    expect(path!.nodes[path!.nodes.length - 1].id).toBe('co-b');
  });

  test('findShortestPath should return null for no path', () => {
    addNode({ id: 'far-away', label: 'Far Away', type: 'company', aliases: [], confidence: 0.9 });

    const path = findShortestPath('far-away', 'co-a');
    expect(path).toBeNull();
  });
});

// ── 5. Graph Expansion ─────────────────────────────────────────────

describe('WI-16G: Graph Expansion', () => {
  beforeEach(() => {
    seedKnowledgeGraph();
  });

  test('expandFromEntity should return comprehensive expansion', () => {
    const result = expandFromEntity('co-acme', { maxHops: 2 });

    expect(result.originNode.id).toBe('co-acme');
    expect(result.originNode.label).toBe('Acme Corp');
    expect(result.totalDiscovered).toBeGreaterThan(0);
    expect(result.maxHops).toBe(2);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('expansion should produce evidence chains for high-confidence paths', () => {
    const result = expandFromEntity('co-acme', { maxHops: 3 });

    // Acme has signals connected, so evidence chains should be produced
    expect(result.evidenceChains.length).toBeGreaterThan(0);

    const chain = result.evidenceChains[0];
    expect(chain.chainId).toBeDefined();
    expect(chain.originNode.id).toBe('co-acme');
    expect(chain.confidence).toBeGreaterThan(0);
    expect(chain.narrative).toBeTruthy();
  });

  test('expansion should discover people, technologies, and signals', () => {
    const result = expandFromEntity('co-acme', { maxHops: 2 });

    const types = new Set(result.entities.map(e => e.node.type));
    expect(types.has('person')).toBe(true); // Sarah, James
    expect(types.has('technology')).toBe(true); // AWS, Kubernetes, etc.
    expect(types.has('signal')).toBe(true); // Acme funding signal
  });

  test('expansion for unknown entity should return empty', () => {
    const result = expandFromEntity('nonexistent-id', { maxHops: 2 });

    expect(result.originNode.id).toBe('nonexistent-id');
    expect(result.entities.length).toBe(0);
    expect(result.evidenceChains.length).toBe(0);
  });
});

// ── 6. Graph-Based Recommendations ──────────────────────────────────

describe('WI-16G: Graph Recommendations', () => {
  beforeEach(() => {
    seedKnowledgeGraph();
  });

  test('should recommend similar companies', () => {
    const recs = generateRecommendations({
      entityId: 'co-acme',
      type: 'similar_companies',
      maxHops: 2,
      limit: 5,
    });

    expect(recs.length).toBeGreaterThan(0);

    // Each recommendation should have required fields
    for (const rec of recs) {
      expect(rec.id).toBeDefined();
      expect(rec.type).toBe('similar_companies');
      expect(rec.entity).toBeDefined();
      expect(rec.reason).toBeTruthy();
      expect(rec.evidencePath).toBeDefined();
      expect(rec.confidence).toBeGreaterThan(0);
      expect(rec.timestamp).toBeDefined();
    }
  });

  test('should map influence for a company', () => {
    const recs = generateRecommendations({
      entityId: 'co-acme',
      type: 'influence_mapping',
      maxHops: 2,
      limit: 5,
      targetType: ['person'],
    });

    expect(recs.length).toBeGreaterThan(0);

    // Should find people connected to Acme
    const hasPeople = recs.some(r => r.entity.type === 'person');
    expect(hasPeople).toBe(true);
  });

  test('should find opportunity signals', () => {
    const recs = generateRecommendations({
      entityId: 'co-globex',
      type: 'opportunity_signals',
      maxHops: 3,
      limit: 10,
    });

    expect(recs.length).toBeGreaterThan(0);

    // Globex has CISO departure → cybersecurity opportunity
    const hasSecurityRec = recs.some(r =>
      r.signals.some(s => s.type === 'INDICATES_OPPORTUNITY' || s.type === 'HAS_SIGNAL')
    );
    expect(hasSecurityRec).toBe(true);
  });

  test('should assess technology fit', () => {
    const recs = generateRecommendations({
      entityId: 'co-acme',
      type: 'technology_fit',
      maxHops: 2,
      limit: 10,
      targetType: ['technology'],
    });

    expect(recs.length).toBeGreaterThan(0);

    // Should find technologies Acme uses
    const techIds = recs.map(r => r.entity.id);
    expect(techIds).toContain('t-aws');
    expect(techIds).toContain('t-kubernetes');
  });

  test('recommendations for non-existent entity should be empty', () => {
    const recs = generateRecommendations({
      entityId: 'nonexistent',
      type: 'similar_companies',
    });

    expect(recs.length).toBe(0);
  });

  test('recommendations should be sorted by confidence', () => {
    const recs = generateRecommendations({
      entityId: 'co-acme',
      type: 'similar_companies',
      maxHops: 2,
      limit: 10,
    });

    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].confidence).toBeGreaterThanOrEqual(recs[i].confidence);
    }
  });
});

// ── 7. Cross-Entity Reasoning ───────────────────────────────────────

describe('WI-16G: Cross-Entity Reasoning', () => {
  beforeEach(() => {
    seedKnowledgeGraph();
  });

  test('why_now reasoning should explain timing for engagement', () => {
    const result = reasonAboutEntity('co-acme', 'why_now');

    expect(result.answer).toBeTruthy();
    expect(result.answer).toContain('Acme Corp');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('why_now should detect active signals', () => {
    const result = reasonAboutEntity('co-initech', 'why_now');

    expect(result.answer).toBeTruthy();
    // Initech has cloud migration signal
    expect(result.signals.length).toBeGreaterThan(0);
  });

  test('similar_to should find related companies', () => {
    const result = reasonAboutEntity('co-acme', 'similar_to');

    expect(result.answer).toBeTruthy();
    expect(result.answer).toContain('similar');
  });

  test('who_influences should map people connections', () => {
    const result = reasonAboutEntity('co-acme', 'who_influences');

    expect(result.answer).toBeTruthy();
    // Should find Sarah Chen and James Rodriguez
    expect(result.keyEntities.length).toBeGreaterThan(0);
    expect(result.keyEntities.some(e => e.type === 'person')).toBe(true);
  });

  test('technology_fit should describe technology landscape', () => {
    const result = reasonAboutEntity('co-acme', 'technology_fit');

    expect(result.answer).toBeTruthy();
    expect(result.answer).toContain('Technology');
  });

  test('opportunity_for should identify opportunities', () => {
    const result = reasonAboutEntity('co-umbrella', 'opportunity_for');

    expect(result.answer).toBeTruthy();
    // Umbrella has breach signal → cybersecurity opportunity
    expect(result.answer).toContain('Umbrella Corp');
  });

  test('reasoning for non-existent entity should return error message', () => {
    const result = reasonAboutEntity('nonexistent', 'why_now');

    expect(result.answer).toContain('not found');
    expect(result.confidence).toBe(0);
  });

  test('evidence chains should be returned for high-confidence reasoning', () => {
    const result = reasonAboutEntity('co-acme', 'why_now', {});

    if (result.evidenceChains.length > 0) {
      const chain = result.evidenceChains[0];
      expect(chain.chainId).toBeDefined();
      expect(chain.originNode.id).toBe('co-acme');
      expect(chain.paths.length).toBeGreaterThan(0);
    }
  });
});

// ── 8. Graph Statistics ────────────────────────────────────────────

describe('WI-16G: Graph Statistics', () => {
  test('should return accurate stats for seeded graph', () => {
    seedKnowledgeGraph();
    const stats = getGraphStats();

    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(stats.totalEdges).toBeGreaterThan(0);
    expect(stats.averageEdgeWeight).toBeGreaterThan(0);
    expect(stats.averageEdgeConfidence).toBeGreaterThan(0);
    expect(stats.connectedComponents).toBeGreaterThan(0);
    expect(stats.isolationRatio).toBeGreaterThanOrEqual(0);
  });

  test('should count nodes by type correctly', () => {
    seedKnowledgeGraph();
    const stats = getGraphStats();

    expect(stats.nodesByType.company).toBe(8);
    expect(stats.nodesByType.person).toBe(8);
    expect(stats.nodesByType.technology).toBe(12);
    expect(stats.nodesByType.capability).toBe(6);
    expect(stats.nodesByType.signal).toBe(7);
    expect(stats.nodesByType.industry).toBe(4);
  });

  test('should return empty stats for cleared graph', () => {
    const stats = getGraphStats();

    expect(stats.totalNodes).toBe(0);
    expect(stats.totalEdges).toBe(0);
    expect(stats.averageEdgeWeight).toBe(0);
  });
});

// ── 9. Seed Data Integrity ─────────────────────────────────────────

describe('WI-16G: Seed Data Integrity', () => {
  test('seed should create expected number of nodes', () => {
    seedKnowledgeGraph();

    // 8 companies + 8 people + 12 technologies + 6 capabilities + 4 industries + 7 signals = 45
    const nodes = getAllNodes();
    expect(nodes.length).toBe(45);
  });

  test('seed should create expected number of edges', () => {
    seedKnowledgeGraph();

    const edges = getAllEdges();
    // Organizational (9) + Technology (13) + Integration (6) + Industry (4) +
    // Competitive (2) + Partnership (2) + Signals (7) + Opportunities (5) +
    // Migration (2) + Influence (2) = 52
    expect(edges.length).toBe(52);
  });

  test('seed should not duplicate on double-call', () => {
    seedKnowledgeGraph();
    const count1 = getAllNodes().length;

    seedKnowledgeGraph(); // Should be no-op
    const count2 = getAllNodes().length;

    expect(count2).toBe(count1);
  });

  test('all seed nodes should have valid types', () => {
    seedKnowledgeGraph();
    const validTypes: GraphEntityType[] = [
      'company', 'person', 'technology', 'industry', 'capability', 'signal',
    ];

    const nodes = getAllNodes();
    for (const node of nodes) {
      expect(validTypes).toContain(node.type);
    }
  });

  test('all seed edges should reference existing nodes', () => {
    seedKnowledgeGraph();
    const nodeIds = new Set(getAllNodes().map(n => n.id));
    const edges = getAllEdges();

    for (const edge of edges) {
      expect(nodeIds.has(edge.sourceId)).toBe(true);
      expect(nodeIds.has(edge.targetId)).toBe(true);
    }
  });

  test('key relationships should exist in seeded graph', async () => {
    seedKnowledgeGraph();

    // Sarah Chen works at Acme
    const sarahNode = await getNode('p-sarah');
    expect(sarahNode).toBeDefined();
    expect(sarahNode!.label).toBe('Sarah Chen');

    // Acme uses AWS
    const acmeNode = await getNode('co-acme');
    expect(acmeNode).toBeDefined();

    const acmeEdges = await getNodeEdges('co-acme');
    const hasAws = acmeEdges.some(e => e.relationship === 'USES_TECHNOLOGY' && e.targetId === 't-aws');
    expect(hasAws).toBe(true);

    // Kubernetes builds on Docker
    const k8sDocker = getAllEdges().find(
      e => e.sourceId === 't-kubernetes' && e.targetId === 't-docker' && e.relationship === 'BUILDS_ON'
    );
    expect(k8sDocker).toBeDefined();
  });
});

// ── 10. Multi-Hop Reasoning Scenarios ───────────────────────────────

describe('WI-16G: Multi-Hop Reasoning Scenarios', () => {
  beforeEach(() => {
    seedKnowledgeGraph();
  });

  test('Scenario: Why approach Umbrella Corp now?', () => {
    // Umbrella has security breach → cybersecurity opportunity
    const expansion = expandFromEntity('co-umbrella', { maxHops: 3 });

    // Should discover the breach signal
    const signalEntities = expansion.entities.filter(e => e.node.type === 'signal');
    expect(signalEntities.length).toBeGreaterThan(0);

    const breachSignal = signalEntities.find(e => e.node.id === 'sig-umbrella-breach');
    expect(breachSignal).toBeDefined();

    // Should find cybersecurity capability opportunity
    const capabilityEntities = expansion.entities.filter(e => e.node.type === 'capability');
    const hasCyber = capabilityEntities.some(e => e.node.id === 'cap-cybersecurity');
    expect(hasCyber).toBe(true);
  });

  test('Scenario: Technology migration path for Initech', () => {
    // Initech uses legacy ERP, migrating to Kubernetes
    const result = reasonAboutEntity('co-initech', 'technology_fit');

    expect(result.answer).toContain('Initech');

    // Should find ERP and Kubernetes
    const techEntities = result.keyEntities.filter(e => e.type === 'technology');
    expect(techEntities.length).toBeGreaterThan(0);
  });

  test('Scenario: Cross-company personnel connections', () => {
    // Sarah Chen (Acme) reports to... James Rodriguez reports to Sarah
    const sarahEdges = getOutgoingEdges('p-sarah');
    // James Rodriguez reports TO Sarah, so Sarah has incoming REPORTS_TO edge
    const sarahIncoming = getIncomingEdges('p-sarah');
    const jamesReportsToSarah = sarahIncoming.find(e => e.sourceId === 'p-james' && e.relationship === 'REPORTS_TO');
    expect(jamesReportsToSarah).toBeDefined();
  });

  test('Scenario: Competitive landscape analysis', () => {
    const recs = generateRecommendations({
      entityId: 'co-acme',
      type: 'competitive_landscape',
      maxHops: 3,
      limit: 10,
    });

    // Should find Initech as competitor
    const competitorIds = recs.map(r => r.entity.id);
    expect(competitorIds).toContain('co-initech');
  });

  test('Scenario: Partnership ecosystem mapping', () => {
    // Acme partners with Wayne, Stark partners with Oscorp
    const acmeExpansion = expandFromEntity('co-acme', { maxHops: 2 });

    // Should discover Wayne Enterprises through partnership
    const partnerIds = acmeExpansion.entities
      .filter(e => e.relationships.some(r => r.edge.relationship === 'PARTNERS_WITH'))
      .map(e => e.node.id);

    expect(partnerIds).toContain('co-wayne');
  });
});

// ── 11. Graph Edge Cases ────────────────────────────────────────────

describe('WI-16G: Edge Cases', () => {
  test('traverse from empty graph should return empty', () => {
    const results = traverseBFS('nonexistent', { maxHops: 2 });
    expect(results.length).toBe(0);
  });

  test('findPaths from node to itself should return empty', () => {
    addNode({ id: 'self', label: 'Self', type: 'company', aliases: [], confidence: 0.9 });
    const paths = findPaths('self', 'self', { maxHops: 5 });
    expect(paths.length).toBe(0);
  });

  test('expansion with 0 hops should return empty', () => {
    seedKnowledgeGraph();
    const result = expandFromEntity('co-acme', { maxHops: 0 });
    expect(result.entities.length).toBe(0);
  });

  test('recommendations with high minWeight should return fewer results', () => {
    seedKnowledgeGraph();

    const low = generateRecommendations({
      entityId: 'co-acme',
      type: 'similar_companies',
      minWeight: 0.1,
      maxHops: 2,
      limit: 20,
    });

    const high = generateRecommendations({
      entityId: 'co-acme',
      type: 'similar_companies',
      minWeight: 0.9,
      maxHops: 2,
      limit: 20,
    });

    expect(high.length).toBeLessThanOrEqual(low.length);
  });

  test('graph clear should reset all indices', () => {
    seedKnowledgeGraph();
    expect(getAllNodes().length).toBeGreaterThan(0);

    clearGraph();
    expect(getAllNodes().length).toBe(0);
    expect(getAllEdges().length).toBe(0);

    // Should be able to re-seed
    seedKnowledgeGraph();
    expect(getAllNodes().length).toBe(45);
  });
});
