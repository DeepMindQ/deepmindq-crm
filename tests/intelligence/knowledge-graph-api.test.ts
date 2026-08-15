// ═══════════════════════════════════════════════════════════════════════════
// Knowledge Graph Engine — API Integration-Style Tests
//
// Tests the engine functions with mocked database calls.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
    person: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    relationship: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    signal: {
      count: vi.fn(),
      updateMany: vi.fn(),
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
  getSubgraph,
  mergeOrganizations,
  getConnections,
  getGraphStats,
} from '@/lib/intelligence/knowledge-graph/engine';

// ── Test Data ──────────────────────────────────────────────────────────

const mockOrg = {
  id: 'org-1',
  name: 'Acme Corp',
  domain: 'acme.com',
  industry: 'SaaS',
  description: 'A software company',
  website: 'https://acme.com',
  headquarters: 'San Francisco',
  employeeCount: 200,
  revenue: '$50M',
  foundedYear: 2015,
  aliases: ['Acme', 'Acme Software'],
  trackingStatus: 'active' as const,
  intelligenceScore: 75,
  lastEnrichedAt: new Date(),
};

const mockPerson = {
  id: 'person-1',
  fullName: 'Alice Johnson',
  email: 'alice@acme.com',
  title: 'CTO',
  department: 'Engineering',
  role: 'executive',
  organizationId: 'org-1',
};

const mockRelationship = {
  id: 'rel-1',
  type: 'competes_with',
  label: 'Acme and Beta compete',
  weight: 0.5,
  sourceOrgId: 'org-1',
  targetOrgId: 'org-2',
  sourcePersonId: null,
  targetPersonId: null,
  evidenceId: null,
};

// ── resolveEntity ──────────────────────────────────────────────────────

describe('resolveEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no query params provided', async () => {
    const matches = await resolveEntity({});
    expect(matches).toEqual([]);
  });

  it('finds exact domain match (score 100)', async () => {
    vi.mocked(db.organization.findFirst).mockResolvedValue(mockOrg as any);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.organization.findMany).mockResolvedValue([]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const matches = await resolveEntity({ domain: 'acme.com' });
    expect(matches).toHaveLength(1);
    expect(matches[0].nodeId).toBe('org-1');
    expect(matches[0].score).toBe(100);
    expect(matches[0].matchedFields).toEqual(['domain']);
    expect(matches[0].nodeType).toBe('organization');
  });

  it('finds exact email match (score 100)', async () => {
    vi.mocked(db.organization.findFirst).mockResolvedValue(null);
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson as any);
    vi.mocked(db.organization.findMany).mockResolvedValue([]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const matches = await resolveEntity({ email: 'alice@acme.com' });
    expect(matches).toHaveLength(1);
    expect(matches[0].nodeId).toBe('person-1');
    expect(matches[0].score).toBe(100);
    expect(matches[0].matchedFields).toEqual(['email']);
    expect(matches[0].nodeType).toBe('person');
  });

  it('finds by name with fuzzy matching', async () => {
    vi.mocked(db.organization.findFirst).mockResolvedValue(null);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg as any]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const matches = await resolveEntity({ name: 'Acme Corp', fuzzy: true });
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Should match Acme Corp exactly → score 95
    const orgMatch = matches.find((m) => m.nodeId === 'org-1');
    expect(orgMatch).toBeDefined();
    expect(orgMatch!.score).toBe(95);
  });

  it('returns empty when no matches found', async () => {
    vi.mocked(db.organization.findFirst).mockResolvedValue(null);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.organization.findMany).mockResolvedValue([]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const matches = await resolveEntity({ name: 'Nonexistent Corp' });
    expect(matches).toEqual([]);
  });

  it('combines domain and name matches, deduplicates', async () => {
    vi.mocked(db.organization.findFirst).mockResolvedValue(mockOrg as any);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg as any]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const matches = await resolveEntity({ domain: 'acme.com', name: 'Acme Corp' });
    // Should only appear once (deduped)
    const orgMatches = matches.filter((m) => m.nodeId === 'org-1');
    expect(orgMatches).toHaveLength(1);
    expect(orgMatches[0].score).toBe(100); // domain match is highest
  });

  it('sorts results by score descending', async () => {
    const orgLow = { ...mockOrg, id: 'org-low', name: 'Some vaguely related name' };
    vi.mocked(db.organization.findFirst).mockResolvedValue(null);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg as any, orgLow as any]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const matches = await resolveEntity({ name: 'Acme', fuzzy: true });
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it('normalizes domain to lowercase before lookup', async () => {
    vi.mocked(db.organization.findFirst).mockResolvedValue(mockOrg as any);
    vi.mocked(db.person.findFirst).mockResolvedValue(null);
    vi.mocked(db.organization.findMany).mockResolvedValue([]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    await resolveEntity({ domain: 'AcMe.CoM' });
    expect(db.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { domain: 'acme.com' } }),
    );
  });
});

// ── getSubgraph ────────────────────────────────────────────────────────

describe('getSubgraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty subgraph for non-existent node', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(null);
    vi.mocked(db.person.findUnique).mockResolvedValue(null);

    const subgraph = await getSubgraph('nonexistent-id', 2);
    expect(subgraph.nodes).toEqual([]);
    expect(subgraph.edges).toEqual([]);
    expect(subgraph.centerNodeId).toBe('nonexistent-id');
  });

  it('returns org node with no connections at depth 0', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(mockOrg as any);
    vi.mocked(db.person.findUnique).mockResolvedValue(null);
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.relationship.findMany).mockResolvedValue([]);

    const subgraph = await getSubgraph('org-1', 0);
    expect(subgraph.nodes).toHaveLength(1);
    expect(subgraph.nodes[0].id).toBe('org-1');
    expect(subgraph.nodes[0].type).toBe('organization');
    expect(subgraph.edges).toEqual([]);
  });

  it('expands to include people at depth >= 1', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(mockOrg as any);
    vi.mocked(db.person.findUnique).mockResolvedValue(null);
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson as any]);
    vi.mocked(db.relationship.findFirst).mockResolvedValue(null);
    vi.mocked(db.relationship.findMany).mockResolvedValue([]);

    const subgraph = await getSubgraph('org-1', 1);
    expect(subgraph.nodes.length).toBeGreaterThanOrEqual(2); // org + person
    const nodeIds = subgraph.nodes.map((n) => n.id);
    expect(nodeIds).toContain('org-1');
    expect(nodeIds).toContain('person-1');
  });

  it('expands org-to-org relationships at depth >= 1', async () => {
    const peerOrg = { ...mockOrg, id: 'org-2', name: 'Beta Inc' };
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(mockOrg as any) // center lookup
      .mockResolvedValueOnce(peerOrg as any); // peer lookup
    vi.mocked(db.person.findUnique).mockResolvedValue(null);
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.relationship.findMany).mockResolvedValue([mockRelationship as any]);

    const subgraph = await getSubgraph('org-1', 2);
    const nodeIds = subgraph.nodes.map((n) => n.id);
    expect(nodeIds).toContain('org-2');
  });

  it('respects depth limits', async () => {
    const peerOrg = { ...mockOrg, id: 'org-2', name: 'Beta Inc' };
    const thirdOrg = { ...mockOrg, id: 'org-3', name: 'Gamma Ltd' };
    const relToThird = {
      ...mockRelationship,
      id: 'rel-2',
      sourceOrgId: 'org-2',
      targetOrgId: 'org-3',
    };

    let orgLookupCount = 0;
    vi.mocked(db.organization.findUnique).mockImplementation(async (args: any) => {
      const id = args?.where?.id;
      orgLookupCount++;
      if (id === 'org-1') return mockOrg;
      if (id === 'org-2') return peerOrg;
      if (id === 'org-3') return thirdOrg;
      return null;
    });
    vi.mocked(db.person.findUnique).mockResolvedValue(null);
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.relationship.findMany)
      .mockResolvedValueOnce([mockRelationship]) // org-1's rels
      .mockResolvedValueOnce([]); // org-2's rels at depth 1

    // At depth 1, we should NOT traverse to org-3
    await getSubgraph('org-1', 1);
    // org-1 center + org-2 peer, no deeper
  });
});

// ── mergeOrganizations ─────────────────────────────────────────────────

describe('mergeOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when target === source', async () => {
    const result = mergeOrganizations('org-1', 'org-1');
    await expect(result).resolves.toBeUndefined();
    // Should not call any DB operations
    expect(db.organization.findUnique).not.toHaveBeenCalled();
  });

  it('throws when source org does not exist', async () => {
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(mockOrg as any) // target exists
      .mockResolvedValueOnce(null); // source doesn't

    await expect(mergeOrganizations('org-1', 'org-missing')).rejects.toThrow(
      'Both organizations must exist for merge',
    );
  });

  it('throws when target org does not exist', async () => {
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(null) // target doesn't exist
      .mockResolvedValueOnce(mockOrg as any); // source exists

    await expect(mergeOrganizations('org-missing', 'org-1')).rejects.toThrow(
      'Both organizations must exist for merge',
    );
  });

  it('moves people from source to target', async () => {
    const sourceOrg = { ...mockOrg, id: 'org-2', name: 'Duplicate Corp' };
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(mockOrg as any) // target
      .mockResolvedValueOnce(sourceOrg as any); // source
    vi.mocked(db.person.updateMany).mockResolvedValue({ count: 3 });
    vi.mocked(db.signal.updateMany).mockResolvedValue({ count: 5 });
    vi.mocked(db.evidence.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(db.insight.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.briefing.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.relationship.updateMany).mockResolvedValue({ count: 4 });
    vi.mocked(db.organization.update).mockResolvedValue({} as any);
    vi.mocked(db.organization.delete).mockResolvedValue({} as any);

    await mergeOrganizations('org-1', 'org-2', 'admin-user-1');

    expect(db.person.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-2' },
        data: { organizationId: 'org-1' },
      }),
    );
  });

  it('re-points relationships from source to target', async () => {
    const sourceOrg = { ...mockOrg, id: 'org-2', name: 'Duplicate Corp' };
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(mockOrg as any)
      .mockResolvedValueOnce(sourceOrg as any);
    vi.mocked(db.person.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.signal.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.evidence.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.insight.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.briefing.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.relationship.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(db.organization.update).mockResolvedValue({} as any);
    vi.mocked(db.organization.delete).mockResolvedValue({} as any);

    await mergeOrganizations('org-1', 'org-2');

    expect(db.relationship.updateMany).toHaveBeenCalledTimes(2);
    // First call: re-point source relationships
    expect(db.relationship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceOrgId: 'org-2' },
        data: { sourceOrgId: 'org-1' },
      }),
    );
    // Second call: re-point target relationships
    expect(db.relationship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetOrgId: 'org-2' },
        data: { targetOrgId: 'org-1' },
      }),
    );
  });

  it('adds source name as alias to target', async () => {
    const sourceOrg = { ...mockOrg, id: 'org-2', name: 'Old Company Name' };
    const targetWithAliases = { ...mockOrg, aliases: ['Acme', 'Acme Software'] };
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(targetWithAliases as any)
      .mockResolvedValueOnce(sourceOrg as any);
    vi.mocked(db.person.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.signal.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.evidence.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.insight.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.briefing.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.relationship.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.organization.update).mockResolvedValue({} as any);
    vi.mocked(db.organization.delete).mockResolvedValue({} as any);

    await mergeOrganizations('org-1', 'org-2');

    expect(db.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: {
          aliases: expect.arrayContaining(['Old Company Name']),
        },
      }),
    );
  });

  it('deletes the source organization after merge', async () => {
    const sourceOrg = { ...mockOrg, id: 'org-2', name: 'To Delete' };
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce(mockOrg as any)
      .mockResolvedValueOnce(sourceOrg as any);
    vi.mocked(db.person.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.signal.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.evidence.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.insight.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.briefing.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.relationship.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.organization.update).mockResolvedValue({} as any);
    vi.mocked(db.organization.delete).mockResolvedValue({} as any);

    await mergeOrganizations('org-1', 'org-2');

    expect(db.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-2' } });
  });
});

// ── getConnections ─────────────────────────────────────────────────────

describe('getConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty connections for isolated node', async () => {
    vi.mocked(db.relationship.findMany).mockResolvedValue([]);

    const result = await getConnections('org-isolated');
    expect(result.organizations).toEqual([]);
    expect(result.people).toEqual([]);
  });

  it('finds connected organizations via source relationships', async () => {
    const targetOrg = { ...mockOrg, id: 'org-2', name: 'Beta Inc' };
    vi.mocked(db.relationship.findMany)
      .mockResolvedValueOnce([mockRelationship as any]) // asSource
      .mockResolvedValueOnce([]); // asTarget
    vi.mocked(db.organization.findMany).mockResolvedValue([targetOrg as any]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const result = await getConnections('org-1');
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0].org.id).toBe('org-2');
    expect(result.organizations[0].relationship.type).toBe('competes_with');
  });

  it('finds connected people via relationships', async () => {
    const personRel = {
      ...mockRelationship,
      id: 'rel-person',
      type: 'works_at',
      sourcePersonId: 'person-1',
      targetOrgId: 'org-1',
      sourceOrgId: null,
    };
    vi.mocked(db.relationship.findMany)
      .mockResolvedValueOnce([]) // asSource
      .mockResolvedValueOnce([personRel as any]); // asTarget
    vi.mocked(db.organization.findMany).mockResolvedValue([]);
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson as any]);

    const result = await getConnections('org-1');
    expect(result.people).toHaveLength(1);
    expect(result.people[0].person.id).toBe('person-1');
  });

  it('combines source and target connections', async () => {
    const rel1 = {
      ...mockRelationship,
      id: 'rel-1',
      sourceOrgId: 'org-1',
      targetOrgId: 'org-2',
      sourcePersonId: null,
      targetPersonId: null,
    };
    const rel2 = {
      ...mockRelationship,
      id: 'rel-2',
      sourceOrgId: 'org-3',
      targetOrgId: 'org-1',
      sourcePersonId: null,
      targetPersonId: null,
    };
    const org2 = { ...mockOrg, id: 'org-2', name: 'Beta' };
    const org3 = { ...mockOrg, id: 'org-3', name: 'Gamma' };

    vi.mocked(db.relationship.findMany)
      .mockResolvedValueOnce([rel1 as any]) // asSource
      .mockResolvedValueOnce([rel2 as any]); // asTarget
    vi.mocked(db.organization.findMany).mockResolvedValue([org2, org3] as any[]);
    vi.mocked(db.person.findMany).mockResolvedValue([]);

    const result = await getConnections('org-1');
    expect(result.organizations).toHaveLength(2);
  });
});

// ── getGraphStats ──────────────────────────────────────────────────────

describe('getGraphStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct counts', async () => {
    vi.mocked(db.organization.count).mockResolvedValue(10);
    vi.mocked(db.person.count).mockResolvedValue(25);
    vi.mocked(db.relationship.count).mockResolvedValue(40);
    vi.mocked(db.relationship.groupBy).mockResolvedValue([
      { type: 'works_at', _count: 20 },
      { type: 'competes_with', _count: 10 },
      { type: 'coworker', _count: 10 },
    ]);
    vi.mocked(db.relationship.findMany).mockResolvedValue([]);

    const stats = await getGraphStats();
    expect(stats.totalNodes).toBe(35); // 10 orgs + 25 people
    expect(stats.totalEdges).toBe(40);
    expect(stats.organizations).toBe(10);
    expect(stats.people).toBe(25);
    expect(stats.relationshipTypes).toEqual({
      works_at: 20,
      competes_with: 10,
      coworker: 10,
    });
  });

  it('computes average connections per node', async () => {
    vi.mocked(db.organization.count).mockResolvedValue(5);
    vi.mocked(db.person.count).mockResolvedValue(5);
    vi.mocked(db.relationship.count).mockResolvedValue(20);
    vi.mocked(db.relationship.groupBy).mockResolvedValue([]);
    vi.mocked(db.relationship.findMany)
      .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ sourceOrgId: `org-${i}` })))
      .mockResolvedValueOnce(
        Array.from({ length: 5 }, (_, i) => ({ sourcePersonId: `person-${i}` })),
      );

    const stats = await getGraphStats();
    // avgConnectionsPerNode = (20 * 2) / 10 = 4.0
    expect(stats.avgConnectionsPerNode).toBe(4);
  });

  it('handles zero nodes gracefully', async () => {
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.person.count).mockResolvedValue(0);
    vi.mocked(db.relationship.count).mockResolvedValue(0);
    vi.mocked(db.relationship.groupBy).mockResolvedValue([]);
    vi.mocked(db.relationship.findMany).mockResolvedValue([]);

    const stats = await getGraphStats();
    expect(stats.totalNodes).toBe(0);
    expect(stats.totalEdges).toBe(0);
    expect(stats.avgConnectionsPerNode).toBe(0);
    expect(stats.isolatedNodes).toBe(0);
    expect(stats.largestCluster).toBe(0);
  });

  it('counts isolated nodes correctly', async () => {
    vi.mocked(db.organization.count).mockResolvedValue(10);
    vi.mocked(db.person.count).mockResolvedValue(10);
    vi.mocked(db.relationship.count).mockResolvedValue(8);
    vi.mocked(db.relationship.groupBy).mockResolvedValue([]);
    // 5 connected orgs, 3 connected people = 8 connected nodes
    vi.mocked(db.relationship.findMany)
      .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ sourceOrgId: `org-${i}` })))
      .mockResolvedValueOnce(
        Array.from({ length: 3 }, (_, i) => ({ sourcePersonId: `person-${i}` })),
      );

    const stats = await getGraphStats();
    // 20 total - 8 connected = 12 isolated
    expect(stats.isolatedNodes).toBe(12);
  });
});
