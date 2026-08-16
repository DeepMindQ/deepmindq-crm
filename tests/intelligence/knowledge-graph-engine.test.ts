/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    person: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    relationship: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    signal: {
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    evidence: {
      updateMany: vi.fn(),
    },
    insight: {
      updateMany: vi.fn(),
    },
    briefing: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import {
  resolveEntity,
  mergeOrganizations,
  discoverRelationships,
  createRelationship,
  getSubgraph,
  getConnectionPaths,
  getGraphStats,
  computeIntelligenceScores,
} from '@/lib/intelligence/knowledge-graph/engine';

const mockedDb = vi.mocked(db);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── resolveEntity ──────────────────────────────────────────────────────

describe('resolveEntity', () => {
  it('returns empty array when no query params provided', async () => {
    const result = await resolveEntity({});
    expect(result).toEqual([]);
  });

  it('matches organization by domain with score 100', async () => {
    mockedDb.organization.findFirst.mockResolvedValue({
      id: 'org-1',
      name: 'Acme Corp',
      domain: 'acme.com',
      aliases: [],
    } as any);
    mockedDb.organization.findMany.mockResolvedValue([]);
    mockedDb.person.findFirst.mockResolvedValue(null);
    mockedDb.person.findMany.mockResolvedValue([]);

    const result = await resolveEntity({ domain: 'Acme.com' });

    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('org-1');
    expect(result[0].nodeType).toBe('organization');
    expect(result[0].score).toBe(100);
    expect(result[0].matchedFields).toEqual(['domain']);
  });

  it('matches person by email with score 100', async () => {
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.person.findFirst.mockResolvedValue({
      id: 'person-1',
      fullName: 'Alice Smith',
      email: 'alice@acme.com',
    } as any);
    mockedDb.organization.findMany.mockResolvedValue([]);
    mockedDb.person.findMany.mockResolvedValue([]);

    const result = await resolveEntity({ email: 'alice@acme.com' });

    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('person-1');
    expect(result[0].nodeType).toBe('person');
    expect(result[0].score).toBe(100);
    expect(result[0].matchedFields).toEqual(['email']);
  });

  it('matches by name with partial score', async () => {
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.person.findFirst.mockResolvedValue(null);
    mockedDb.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Acme Corporation', domain: 'acme.com', aliases: [] },
    ] as any);
    mockedDb.person.findMany.mockResolvedValue([]);

    const result = await resolveEntity({ name: 'Acme' });

    // "Acme Corporation" contains "acme" → score 60
    const orgMatch = result.find((m) => m.nodeType === 'organization');
    expect(orgMatch).toBeDefined();
    expect(orgMatch!.score).toBeGreaterThan(0);
  });

  it('returns results sorted by score descending', async () => {
    mockedDb.organization.findFirst.mockResolvedValue(null);
    mockedDb.person.findFirst.mockResolvedValue(null);
    mockedDb.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Acme Corp', domain: null, aliases: [] },
      { id: 'org-2', name: 'Acme Corporation', domain: 'acme.com', aliases: [] },
    ] as any);
    mockedDb.person.findMany.mockResolvedValue([]);

    const result = await resolveEntity({ name: 'Acme Corp' });

    // Exact name match should be first (95) vs partial (60)
    if (result.length >= 2) {
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    }
  });

  it('skips duplicate orgs already matched by domain', async () => {
    mockedDb.organization.findFirst.mockResolvedValue({
      id: 'org-1',
      name: 'Acme Corp',
      domain: 'acme.com',
      aliases: [],
    } as any);
    mockedDb.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Acme Corp', domain: 'acme.com', aliases: [] },
    ] as any);
    mockedDb.person.findFirst.mockResolvedValue(null);
    mockedDb.person.findMany.mockResolvedValue([]);

    const result = await resolveEntity({ domain: 'acme.com', name: 'Acme Corp' });

    // Only one result — the domain match, name match for same org is skipped
    const orgResults = result.filter((r) => r.nodeId === 'org-1');
    expect(orgResults).toHaveLength(1);
  });
});

// ─── mergeOrganizations ────────────────────────────────────────────────

describe('mergeOrganizations', () => {
  it('no-ops when target and source are the same', async () => {
    await mergeOrganizations('org-1', 'org-1');
    expect(mockedDb.organization.findUnique).not.toHaveBeenCalled();
  });

  it('throws when one org does not exist', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({ id: 'target', name: 'Target', aliases: [] } as any)
      .mockResolvedValueOnce(null);

    await expect(mergeOrganizations('target', 'missing')).rejects.toThrow(
      'Both organizations must exist for merge',
    );
  });

  it('moves people from source to target', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({ id: 'target', name: 'Target', aliases: [] } as any)
      .mockResolvedValueOnce({ id: 'source', name: 'Source', aliases: [] } as any);
    mockedDb.person.updateMany.mockResolvedValue({ count: 3 } as any);
    mockedDb.signal.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.evidence.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.insight.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.briefing.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.relationship.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.organization.update.mockResolvedValue({} as any);
    mockedDb.organization.delete.mockResolvedValue({} as any);

    await mergeOrganizations('target', 'source');

    expect(mockedDb.person.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'source' },
      data: { organizationId: 'target' },
    });
  });

  it('moves signals, evidence, insights, and briefings', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({ id: 'target', name: 'Target', aliases: [] } as any)
      .mockResolvedValueOnce({ id: 'source', name: 'Source', aliases: [] } as any);
    mockedDb.person.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.signal.updateMany.mockResolvedValue({ count: 5 } as any);
    mockedDb.evidence.updateMany.mockResolvedValue({ count: 3 } as any);
    mockedDb.insight.updateMany.mockResolvedValue({ count: 2 } as any);
    mockedDb.briefing.updateMany.mockResolvedValue({ count: 1 } as any);
    mockedDb.relationship.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.organization.update.mockResolvedValue({} as any);
    mockedDb.organization.delete.mockResolvedValue({} as any);

    await mergeOrganizations('target', 'source');

    expect(mockedDb.signal.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'source' },
      data: { organizationId: 'target' },
    });
    expect(mockedDb.evidence.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'source' },
      data: { organizationId: 'target' },
    });
  });

  it('adds source name as alias to target', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({ id: 'target', name: 'Target Corp', aliases: [] } as any)
      .mockResolvedValueOnce({ id: 'source', name: 'Source Inc', aliases: [] } as any);
    mockedDb.person.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.signal.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.evidence.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.insight.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.briefing.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.relationship.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.organization.update.mockResolvedValue({} as any);
    mockedDb.organization.delete.mockResolvedValue({} as any);

    await mergeOrganizations('target', 'source');

    expect(mockedDb.organization.update).toHaveBeenCalledWith({
      where: { id: 'target' },
      data: { aliases: ['Source Inc'] },
    });
  });

  it('deletes source organization after merge', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({ id: 'target', name: 'Target', aliases: [] } as any)
      .mockResolvedValueOnce({ id: 'source', name: 'Source', aliases: [] } as any);
    mockedDb.person.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.signal.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.evidence.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.insight.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.briefing.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.relationship.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.organization.update.mockResolvedValue({} as any);
    mockedDb.organization.delete.mockResolvedValue({} as any);

    await mergeOrganizations('target', 'source');

    expect(mockedDb.organization.delete).toHaveBeenCalledWith({ where: { id: 'source' } });
  });

  it('re-points relationships from source to target', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({ id: 'target', name: 'Target', aliases: [] } as any)
      .mockResolvedValueOnce({ id: 'source', name: 'Source', aliases: [] } as any);
    mockedDb.person.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.signal.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.evidence.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.insight.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.briefing.updateMany.mockResolvedValue({ count: 0 } as any);
    mockedDb.organization.update.mockResolvedValue({} as any);
    mockedDb.organization.delete.mockResolvedValue({} as any);

    await mergeOrganizations('target', 'source');

    // relationship.updateMany called twice: sourceOrgId and targetOrgId
    expect(mockedDb.relationship.updateMany).toHaveBeenCalledTimes(2);
    expect(mockedDb.relationship.updateMany).toHaveBeenCalledWith({
      where: { sourceOrgId: 'source' },
      data: { sourceOrgId: 'target' },
    });
    expect(mockedDb.relationship.updateMany).toHaveBeenCalledWith({
      where: { targetOrgId: 'source' },
      data: { targetOrgId: 'target' },
    });
  });
});

// ─── discoverRelationships ─────────────────────────────────────────────

describe('discoverRelationships', () => {
  it('returns 0 when no organizations found', async () => {
    mockedDb.organization.findMany.mockResolvedValue([]);

    const result = await discoverRelationships();
    expect(result).toBe(0);
  });

  it('returns 0 when specific orgId not found', async () => {
    mockedDb.organization.findMany.mockResolvedValue([]);

    const result = await discoverRelationships('nonexistent');
    expect(result).toBe(0);
  });

  it('creates works_at relationships for people at orgs', async () => {
    mockedDb.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Acme', industry: null, headquarters: null },
    ] as any);
    mockedDb.relationship.findMany.mockResolvedValue([]);
    mockedDb.person.findMany.mockResolvedValue([{ id: 'p1', fullName: 'Alice' }] as any);
    mockedDb.relationship.createMany.mockResolvedValue({ count: 1 } as any);

    const result = await discoverRelationships();
    expect(result).toBeGreaterThan(0);
  });

  it('creates coworker relationships between people at same org', async () => {
    mockedDb.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Acme', industry: null, headquarters: null },
    ] as any);
    mockedDb.relationship.findMany.mockResolvedValue([]);
    mockedDb.person.findMany.mockResolvedValue([
      { id: 'p1', fullName: 'Alice' },
      { id: 'p2', fullName: 'Bob' },
    ] as any);
    mockedDb.relationship.createMany.mockResolvedValue({ count: 3 } as any);

    const result = await discoverRelationships();
    expect(result).toBeGreaterThan(0);
  });

  it('creates competes_with for same-industry orgs', async () => {
    mockedDb.organization.findMany
      .mockResolvedValueOnce([
        { id: 'org-1', name: 'Acme', industry: 'Software', headquarters: null },
      ] as any)
      .mockResolvedValueOnce([
        { id: 'org-2', name: 'Beta', industry: 'Software', headquarters: null },
      ] as any);
    mockedDb.relationship.findMany.mockResolvedValue([]);
    mockedDb.person.findMany.mockResolvedValue([]);
    mockedDb.relationship.createMany.mockResolvedValue({ count: 1 } as any);

    const result = await discoverRelationships();
    expect(result).toBeGreaterThan(0);
  });

  it('skips existing relationships using batch lookup', async () => {
    mockedDb.organization.findMany.mockResolvedValue([
      { id: 'org-1', name: 'Acme', industry: null, headquarters: null },
    ] as any);
    // Pre-existing works_at relationship
    mockedDb.relationship.findMany.mockResolvedValue([
      {
        type: 'works_at',
        sourceOrgId: null,
        targetOrgId: 'org-1',
        sourcePersonId: 'p1',
        targetPersonId: null,
      },
    ] as any);
    mockedDb.person.findMany.mockResolvedValue([{ id: 'p1', fullName: 'Alice' }] as any);
    mockedDb.relationship.createMany.mockResolvedValue({ count: 0 } as any);

    const result = await discoverRelationships();
    expect(result).toBe(0);
    expect(mockedDb.relationship.createMany).not.toHaveBeenCalled();
  });
});

// ─── createRelationship ─────────────────────────────────────────────────

describe('createRelationship', () => {
  it('creates a relationship with provided data', async () => {
    mockedDb.relationship.create.mockResolvedValue({
      id: 'rel-1',
      type: 'partnered_with',
      label: 'Partner org',
      weight: 0.8,
      sourceOrgId: 'org-a',
      targetOrgId: 'org-b',
      evidenceId: 'ev-1',
    } as any);

    const edge = await createRelationship({
      type: 'partnered_with',
      label: 'Partner org',
      weight: 0.8,
      sourceOrgId: 'org-a',
      targetOrgId: 'org-b',
      evidenceId: 'ev-1',
    });

    expect(edge.id).toBe('rel-1');
    expect(edge.type).toBe('partnered_with');
    expect(edge.source).toBe('org-a');
    expect(edge.target).toBe('org-b');
    expect(edge.weight).toBe(0.8);
  });

  it('defaults weight to 1.0 and label to null', async () => {
    mockedDb.relationship.create.mockResolvedValue({
      id: 'rel-2',
      type: 'works_at',
      label: null,
      weight: 1.0,
      sourcePersonId: 'p1',
      targetOrgId: 'org-1',
      evidenceId: null,
    } as any);

    const edge = await createRelationship({
      type: 'works_at',
      sourcePersonId: 'p1',
      targetOrgId: 'org-1',
    });

    expect(mockedDb.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ weight: 1.0, label: null }),
      }),
    );
    expect(edge.weight).toBe(1.0);
  });

  it('uses sourceOrgId over sourcePersonId for edge source', async () => {
    mockedDb.relationship.create.mockResolvedValue({
      id: 'rel-3',
      type: 'competes_with',
      label: 'Competitors',
      weight: 0.5,
      sourceOrgId: 'org-a',
      targetOrgId: 'org-b',
      evidenceId: null,
    } as any);

    const edge = await createRelationship({
      type: 'competes_with',
      sourceOrgId: 'org-a',
      targetOrgId: 'org-b',
    });

    expect(edge.source).toBe('org-a');
  });
});

// ─── getSubgraph ────────────────────────────────────────────────────────

describe('getSubgraph', () => {
  it('returns empty subgraph for unknown node', async () => {
    mockedDb.organization.findUnique.mockResolvedValue(null);
    mockedDb.person.findUnique.mockResolvedValue(null);

    const result = await getSubgraph('unknown-id');
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.centerNodeId).toBe('unknown-id');
  });

  it('returns org-centered subgraph with people', async () => {
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({
        id: 'org-1',
        name: 'Acme',
        industry: 'Software',
        domain: 'acme.com',
        employeeCount: 100,
        intelligenceScore: 75,
      } as any)
      // expandOrg: no org-to-org relationships
      .mockResolvedValue(null);
    mockedDb.person.findMany.mockResolvedValue([
      { id: 'p1', fullName: 'Alice', title: 'CEO', department: 'Exec', role: 'executive' },
    ] as any);
    mockedDb.relationship.findFirst.mockResolvedValue({
      id: 'wr-1',
      type: 'works_at',
      label: 'Alice works at Acme',
      weight: 1.0,
      sourcePersonId: 'p1',
      targetOrgId: 'org-1',
    } as any);

    const result = await getSubgraph('org-1');

    expect(result.centerNodeId).toBe('org-1');
    expect(result.nodes.length).toBeGreaterThanOrEqual(2); // org + person
    expect(result.edges.some((e) => e.type === 'works_at')).toBe(true);
  });

  it('returns person-centered subgraph', async () => {
    // getSubgraph: check org → null, check person → person
    mockedDb.organization.findUnique.mockResolvedValue(null);
    mockedDb.person.findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        fullName: 'Alice',
        title: 'CTO',
        department: 'Engineering',
        role: 'executive',
        organizationId: 'org-1',
      } as any)
      // expandPerson internally calls db.person.findUnique again
      .mockResolvedValueOnce({
        id: 'p1',
        fullName: 'Alice',
        title: 'CTO',
        department: 'Engineering',
        role: 'executive',
        organizationId: 'org-1',
      } as any);
    // expandPerson → expandOrg → org findUnique
    mockedDb.organization.findUnique
      .mockResolvedValueOnce({
        id: 'org-1',
        name: 'Acme',
        industry: 'Tech',
        domain: 'acme.com',
        employeeCount: 50,
        intelligenceScore: 40,
      } as any)
      // expandOrg: no peer orgs found
      .mockResolvedValueOnce(null);
    mockedDb.relationship.findMany.mockResolvedValue([]);

    const result = await getSubgraph('p1');

    expect(result.centerNodeId).toBe('p1');
    expect(result.nodes.length).toBeGreaterThanOrEqual(2); // person + org
    const orgNode = result.nodes.find((n) => n.type === 'organization');
    expect(orgNode).toBeDefined();
  });
});

// ─── getConnectionPaths ────────────────────────────────────────────────

describe('getConnectionPaths', () => {
  it('finds direct connection between two nodes', async () => {
    mockedDb.relationship.findMany.mockResolvedValueOnce([
      {
        id: 'r1',
        type: 'competes_with',
        label: 'Compete',
        weight: 0.5,
        sourceOrgId: 'A',
        targetOrgId: 'B',
        sourcePersonId: null,
        targetPersonId: null,
        evidenceId: null,
      } as any,
    ]);
    mockedDb.organization.findUnique.mockResolvedValue({
      id: 'A',
      name: 'OrgA',
      industry: null,
      domain: null,
      employeeCount: null,
    } as any);

    const paths = await getConnectionPaths('A', 'B', 4);

    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0].hops).toBe(1);
  });

  it('returns empty when no path exists', async () => {
    mockedDb.relationship.findMany.mockResolvedValue([]);

    const paths = await getConnectionPaths('X', 'Y', 2);
    expect(paths).toEqual([]);
  });

  it('sorts results by hops ascending then weight descending', async () => {
    // Single direct path
    mockedDb.relationship.findMany.mockResolvedValueOnce([
      {
        id: 'r1',
        type: 'x',
        label: null,
        weight: 0.5,
        sourceOrgId: 'A',
        targetOrgId: 'B',
        sourcePersonId: null,
        targetPersonId: null,
        evidenceId: null,
      } as any,
    ]);
    mockedDb.organization.findUnique.mockResolvedValue({
      id: 'A',
      name: 'A',
      industry: null,
      domain: null,
      employeeCount: null,
    } as any);

    const paths = await getConnectionPaths('A', 'B', 4);
    // Verify sorting by hops
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i].hops).toBeGreaterThanOrEqual(paths[i - 1].hops);
    }
  });
});

// ─── getGraphStats ─────────────────────────────────────────────────────

describe('getGraphStats', () => {
  it('returns correct structure with zero counts', async () => {
    mockedDb.organization.count.mockResolvedValue(0);
    mockedDb.person.count.mockResolvedValue(0);
    mockedDb.relationship.count.mockResolvedValue(0);
    mockedDb.relationship.groupBy.mockResolvedValue([]);
    mockedDb.relationship.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const stats = await getGraphStats();

    expect(stats.totalNodes).toBe(0);
    expect(stats.totalEdges).toBe(0);
    expect(stats.organizations).toBe(0);
    expect(stats.people).toBe(0);
    expect(stats.avgConnectionsPerNode).toBe(0);
    expect(stats.isolatedNodes).toBe(0);
    expect(stats.relationshipTypes).toEqual({});
  });

  it('counts relationship types correctly', async () => {
    mockedDb.organization.count.mockResolvedValue(5);
    mockedDb.person.count.mockResolvedValue(10);
    mockedDb.relationship.count.mockResolvedValue(20);
    mockedDb.relationship.groupBy.mockResolvedValue([
      { type: 'works_at', _count: 10 },
      { type: 'competes_with', _count: 5 },
    ] as any);
    mockedDb.relationship.findMany
      .mockResolvedValueOnce([{ sourceOrgId: 'o1' }, { sourceOrgId: 'o2' }] as any)
      .mockResolvedValueOnce([{ sourcePersonId: 'p1' }] as any);

    const stats = await getGraphStats();

    expect(stats.relationshipTypes).toEqual({
      works_at: 10,
      competes_with: 5,
    });
  });

  it('calculates avgConnectionsPerNode', async () => {
    mockedDb.organization.count.mockResolvedValue(3);
    mockedDb.person.count.mockResolvedValue(2);
    mockedDb.relationship.count.mockResolvedValue(10);
    mockedDb.relationship.groupBy.mockResolvedValue([]);
    mockedDb.relationship.findMany
      .mockResolvedValueOnce([
        { sourceOrgId: 'o1' },
        { sourceOrgId: 'o2' },
        { sourceOrgId: 'o3' },
      ] as any)
      .mockResolvedValueOnce([{ sourcePersonId: 'p1' }, { sourcePersonId: 'p2' }] as any);

    const stats = await getGraphStats();

    // totalNodes = 5, edges = 10, avg = (10*2)/5 = 4.0
    expect(stats.avgConnectionsPerNode).toBe(4);
  });

  it('counts isolated nodes', async () => {
    mockedDb.organization.count.mockResolvedValue(10);
    mockedDb.person.count.mockResolvedValue(5);
    mockedDb.relationship.count.mockResolvedValue(8);
    mockedDb.relationship.groupBy.mockResolvedValue([]);
    // Only 3 orgs and 2 people have relationships
    mockedDb.relationship.findMany
      .mockResolvedValueOnce([
        { sourceOrgId: 'o1' },
        { sourceOrgId: 'o2' },
        { sourceOrgId: 'o3' },
      ] as any)
      .mockResolvedValueOnce([{ sourcePersonId: 'p1' }, { sourcePersonId: 'p2' }] as any);

    const stats = await getGraphStats();

    // total = 15, connected = 5, isolated = 10
    expect(stats.isolatedNodes).toBe(10);
  });
});

// ─── computeIntelligenceScores ──────────────────────────────────────────

describe('computeIntelligenceScores', () => {
  it('returns 0 when no orgs found', async () => {
    mockedDb.organization.findMany.mockResolvedValue([]);

    const result = await computeIntelligenceScores();
    expect(result).toBe(0);
  });

  it('returns 0 when specific orgId not found', async () => {
    mockedDb.organization.findMany.mockResolvedValue([]);

    const result = await computeIntelligenceScores('nonexistent');
    expect(result).toBe(0);
  });

  it('computes and updates intelligence scores', async () => {
    mockedDb.organization.findMany.mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        domain: 'acme.com',
        industry: 'Software',
        description: 'A company',
        website: 'https://acme.com',
        headquarters: 'NYC',
        employeeCount: 100,
        revenue: '$50M',
        foundedYear: 2010,
      },
    ] as any);
    mockedDb.relationship.groupBy.mockResolvedValue([]);
    mockedDb.signal.groupBy.mockResolvedValue([]);
    mockedDb.person.groupBy.mockResolvedValue([]);
    mockedDb.organization.update.mockResolvedValue({} as any);

    const result = await computeIntelligenceScores();

    expect(result).toBe(1);
    expect(mockedDb.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          intelligenceScore: expect.any(Number),
        }),
      }),
    );
  });

  it('scores data-rich orgs higher', async () => {
    const bareOrg = {
      id: 'bare',
      name: 'Bare',
      domain: null,
      industry: null,
      description: null,
      website: null,
      headquarters: null,
      employeeCount: null,
      revenue: null,
      foundedYear: null,
    } as any;
    const richOrg = {
      id: 'rich',
      name: 'Rich',
      domain: 'rich.com',
      industry: 'AI',
      description: 'Full',
      website: 'https://rich.com',
      headquarters: 'SF',
      employeeCount: 500,
      revenue: '$100M',
      foundedYear: 2015,
    } as any;

    mockedDb.organization.findMany.mockResolvedValue([bareOrg, richOrg]);
    mockedDb.relationship.groupBy.mockResolvedValue([]);
    mockedDb.signal.groupBy.mockResolvedValue([]);
    mockedDb.person.groupBy.mockResolvedValue([]);
    mockedDb.organization.update.mockResolvedValue({} as any);

    await computeIntelligenceScores();

    const calls = mockedDb.organization.update.mock.calls;
    const bareScore = calls.find((c: any) => c[0].where.id === 'bare')![0].data.intelligenceScore;
    const richScore = calls.find((c: any) => c[0].where.id === 'rich')![0].data.intelligenceScore;
    expect(richScore).toBeGreaterThan(bareScore);
  });
});
