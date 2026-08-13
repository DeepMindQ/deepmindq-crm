// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Knowledge Graph Engine
//
// Connects organizations, people, and signals into a queryable graph.
// The graph is the "brain" — it finds hidden relationships that static
// data tables can never reveal.
//
// Pipeline: Entity Resolution → Relationship Extraction → Graph Enrichment
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: 'organization' | 'person';
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string | null;
  weight: number;
  evidenceId: string | null;
}

export interface GraphSubgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerNodeId?: string;
}

export interface EntityMatch {
  nodeId: string;
  nodeType: 'organization' | 'person';
  label: string;
  score: number; // 0-100 match confidence
  matchedFields: string[];
}

export interface ConnectionPath {
  source: GraphNode;
  target: GraphNode;
  path: GraphEdge[];
  totalWeight: number;
  hops: number;
}

// ─── Entity Resolution ────────────────────────────────────────────────────

/**
 * Find matching entities in the graph by name, domain, or email.
 * Used during ingestion to prevent duplicates and during search.
 */
export async function resolveEntity(query: {
  name?: string;
  domain?: string;
  email?: string;
  fuzzy?: boolean;
}): Promise<EntityMatch[]> {
  const matches: EntityMatch[] = [];

  if (!query.name && !query.domain && !query.email) return matches;

  // Exact domain match — highest confidence
  if (query.domain) {
    const org = await db.organization.findFirst({
      where: { domain: query.domain.toLowerCase() },
    });
    if (org) {
      matches.push({
        nodeId: org.id,
        nodeType: 'organization',
        label: org.name,
        score: 100,
        matchedFields: ['domain'],
      });
    }
  }

  // Exact email match — highest confidence for people
  if (query.email) {
    const person = await db.person.findFirst({
      where: { email: query.email.toLowerCase() },
    });
    if (person) {
      matches.push({
        nodeId: person.id,
        nodeType: 'person',
        label: person.fullName,
        score: 100,
        matchedFields: ['email'],
      });
    }
  }

  // Name-based matching for organizations
  if (query.name) {
    const normalized = normalizeName(query.name);
    const orgs = await db.organization.findMany({
      where: {
        OR: [
          { name: { contains: query.name, mode: 'insensitive' } },
          { aliases: { has: query.name } },
          { aliases: { has: normalized } },
        ],
      },
      take: 10,
    });

    for (const org of orgs) {
      if (matches.some(m => m.nodeId === org.id)) continue;

      const score = calculateOrgMatchScore(query.name, org);
      if (score >= 50 || query.fuzzy) {
        matches.push({
          nodeId: org.id,
          nodeType: 'organization',
          label: org.name,
          score,
          matchedFields: score > 80 ? ['name'] : ['name_fuzzy'],
        });
      }
    }
  }

  // Name-based matching for people
  if (query.name) {
    const people = await db.person.findMany({
      where: {
        fullName: { contains: query.name, mode: 'insensitive' },
      },
      take: 10,
    });

    for (const person of people) {
      if (matches.some(m => m.nodeId === person.id)) continue;

      const score = calculatePersonMatchScore(query.name, person);
      if (score >= 50 || query.fuzzy) {
        matches.push({
          nodeId: person.id,
          nodeType: 'person',
          label: person.fullName,
          score,
          matchedFields: score > 80 ? ['fullName'] : ['fullName_fuzzy'],
        });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Merge two organizations when duplicate is detected.
 * Moves all relationships, signals, evidence, people from source to target.
 */
export async function mergeOrganizations(
  targetId: string,
  sourceId: string,
  mergedBy?: string
): Promise<void> {
  if (targetId === sourceId) return;

  const [target, source] = await Promise.all([
    db.organization.findUnique({ where: { id: targetId } }),
    db.organization.findUnique({ where: { id: sourceId } }),
  ]);

  if (!target || !source) {
    throw new Error('Both organizations must exist for merge');
  }

  logger.info('[KG] Merging organizations', {
    target: target.name,
    source: source.name,
    mergedBy,
  });

  // Move people from source to target
  await db.person.updateMany({
    where: { organizationId: sourceId },
    data: { organizationId: targetId },
  });

  // Move signals
  await db.signal.updateMany({
    where: { organizationId: sourceId },
    data: { organizationId: targetId },
  });

  // Move evidence
  await db.evidence.updateMany({
    where: { organizationId: sourceId },
    data: { organizationId: targetId },
  });

  // Move insights
  await db.insight.updateMany({
    where: { organizationId: sourceId },
    data: { organizationId: targetId },
  });

  // Move briefings
  await db.briefing.updateMany({
    where: { organizationId: sourceId },
    data: { organizationId: targetId },
  });

  // Re-point relationships (source → target)
  await db.relationship.updateMany({
    where: { sourceOrgId: sourceId },
    data: { sourceOrgId: targetId },
  });
  await db.relationship.updateMany({
    where: { targetOrgId: sourceId },
    data: { targetOrgId: targetId },
  });

  // Add source name as alias to target
  if (source.name && !target.aliases.includes(source.name)) {
    await db.organization.update({
      where: { id: targetId },
      data: { aliases: [...target.aliases, source.name] },
    });
  }

  // Delete the source
  await db.organization.delete({ where: { id: sourceId } });
}

// ─── Relationship Extraction ──────────────────────────────────────────────

/**
 * Auto-discover relationships from existing data.
 * Called after ingestion to build graph connections automatically.
 */
export async function discoverRelationships(orgId?: string): Promise<number> {
  let created = 0;

  // Find organizations in the same domain family
  const orgs = orgId
    ? await db.organization.findMany({ where: { id: orgId } })
    : await db.organization.findMany({ where: { trackingStatus: 'active' } });

  for (const org of orgs) {
    // 1. People → Organization relationships (works_at)
    const people = await db.person.findMany({
      where: { organizationId: org.id },
    });
    for (const person of people) {
      const exists = await db.relationship.findFirst({
        where: {
          type: 'works_at',
          sourcePersonId: person.id,
          targetOrgId: org.id,
        },
      });
      if (!exists) {
        await db.relationship.create({
          data: {
            type: 'works_at',
            label: `${person.fullName} works at ${org.name}`,
            weight: 1.0,
            sourcePersonId: person.id,
            targetOrgId: org.id,
          },
        });
        created++;
      }
    }

    // 2. Co-worker relationships (person ↔ person via same org)
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const exists = await db.relationship.findFirst({
          where: {
            type: 'coworker',
            OR: [
              { sourcePersonId: people[i].id, targetPersonId: people[j].id },
              { sourcePersonId: people[j].id, targetPersonId: people[i].id },
            ],
          },
        });
        if (!exists) {
          await db.relationship.create({
            data: {
              type: 'coworker',
              label: `${people[i].fullName} and ${people[j].fullName} are coworkers at ${org.name}`,
              weight: 0.7,
              sourcePersonId: people[i].id,
              targetPersonId: people[j].id,
              targetOrgId: org.id,
            },
          });
          created++;
        }
      }
    }

    // 3. Same industry = potential competitors
    if (org.industry) {
      const sameIndustry = await db.organization.findMany({
        where: {
          id: { not: org.id },
          industry: { contains: org.industry, mode: 'insensitive' },
          trackingStatus: 'active',
        },
      });
      for (const peer of sameIndustry) {
        const exists = await db.relationship.findFirst({
          where: {
            type: 'competes_with',
            OR: [
              { sourceOrgId: org.id, targetOrgId: peer.id },
              { sourceOrgId: peer.id, targetOrgId: org.id },
            ],
          },
        });
        if (!exists) {
          await db.relationship.create({
            data: {
              type: 'competes_with',
              label: `${org.name} and ${peer.name} compete in ${org.industry}`,
              weight: 0.4,
              sourceOrgId: org.id,
              targetOrgId: peer.id,
            },
          });
          created++;
        }
      }
    }

    // 4. Same headquarters region = geographic proximity
    if (org.headquarters) {
      const sameRegion = await db.organization.findMany({
        where: {
          id: { not: org.id },
          headquarters: { contains: org.headquarters, mode: 'insensitive' },
          trackingStatus: 'active',
        },
      });
      for (const neighbor of sameRegion) {
        const exists = await db.relationship.findFirst({
          where: {
            type: 'same_region',
            OR: [
              { sourceOrgId: org.id, targetOrgId: neighbor.id },
              { sourceOrgId: neighbor.id, targetOrgId: org.id },
            ],
          },
        });
        if (!exists) {
          await db.relationship.create({
            data: {
              type: 'same_region',
              label: `Both in ${org.headquarters}`,
              weight: 0.3,
              sourceOrgId: org.id,
              targetOrgId: neighbor.id,
            },
          });
          created++;
        }
      }
    }
  }

  logger.info('[KG] Relationship discovery complete', { created });
  return created;
}

/**
 * Create a manual relationship between two entities.
 */
export async function createRelationship(data: {
  type: string;
  label?: string;
  weight?: number;
  sourceOrgId?: string;
  targetOrgId?: string;
  sourcePersonId?: string;
  targetPersonId?: string;
  evidenceId?: string;
}): Promise<GraphEdge> {
  const rel = await db.relationship.create({
    data: {
      type: data.type,
      label: data.label || null,
      weight: data.weight || 1.0,
      sourceOrgId: data.sourceOrgId || null,
      targetOrgId: data.targetOrgId || null,
      sourcePersonId: data.sourcePersonId || null,
      targetPersonId: data.targetPersonId || null,
      evidenceId: data.evidenceId || null,
    },
  });

  return {
    id: rel.id,
    source: data.sourceOrgId || data.sourcePersonId || '',
    target: data.targetOrgId || data.targetPersonId || '',
    type: rel.type,
    label: rel.label,
    weight: rel.weight || 1.0,
    evidenceId: rel.evidenceId,
  };
}

// ─── Graph Queries ─────────────────────────────────────────────────────────

/**
 * Get the full subgraph around a node (organizations + people + relationships).
 * Used to render the knowledge graph visualization.
 */
export async function getSubgraph(
  centerNodeId: string,
  depth: number = 2
): Promise<GraphSubgraph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const visited = new Set<string>();

  // Determine if center is an org or person
  const org = await db.organization.findUnique({ where: { id: centerNodeId } });
  const person = !org ? await db.person.findUnique({ where: { id: centerNodeId } }) : null;

  if (org) {
    nodes.push(orgToNode(org));
    visited.add(org.id);
    await expandOrg(org.id, depth, nodes, edges, visited);
  } else if (person) {
    nodes.push(personToNode(person));
    visited.add(person.id);
    await expandPerson(person.id, depth, nodes, edges, visited);
  }

  return { nodes, edges, centerNodeId };
}

/**
 * Get connections between two specific entities.
 */
export async function getConnectionPaths(
  sourceId: string,
  targetId: string,
  maxHops: number = 4
): Promise<ConnectionPath[]> {
  const paths: ConnectionPath[] = [];
  const queue: Array<{ current: string; path: GraphEdge[]; visited: Set<string> }> = [];

  queue.push({ current: sourceId, path: [], visited: new Set([sourceId]) });

  while (queue.length > 0 && paths.length < 10) {
    const { current, path, visited } = queue.shift()!;

    if (current === targetId && path.length > 0) {
      const sourceNode = await fetchNode(sourceId);
      const targetNode = await fetchNode(targetId);
      if (sourceNode && targetNode) {
        paths.push({
          source: sourceNode,
          target: targetNode,
          path,
          totalWeight: path.reduce((sum, e) => sum + e.weight, 0),
          hops: path.length,
        });
      }
      continue;
    }

    if (path.length >= maxHops) continue;

    // Find all relationships involving current node
    const rels = await db.relationship.findMany({
      where: {
        OR: [
          { sourceOrgId: current },
          { targetOrgId: current },
          { sourcePersonId: current },
          { targetPersonId: current },
        ],
      },
    });

    for (const rel of rels) {
      const nextNode = getNextNodeId(rel, current);
      if (nextNode && !visited.has(nextNode)) {
        const edge = relToEdge(rel, current);
        visited.add(nextNode);
        queue.push({
          current: nextNode,
          path: [...path, edge],
          visited: new Set(visited),
        });
      }
    }
  }

  return paths.sort((a, b) => a.hops - b.hops || b.totalWeight - a.totalWeight);
}

/**
 * Get all entities connected to a node, with relationship details.
 */
export async function getConnections(nodeId: string): Promise<{
  organizations: Array<{
    org: Record<string, unknown>;
    relationship: GraphEdge;
  }>;
  people: Array<{
    person: Record<string, unknown>;
    relationship: GraphEdge;
  }>;
}> {
  const orgConnections: Array<{ org: Record<string, unknown>; relationship: GraphEdge }> = [];
  const personConnections: Array<{ person: Record<string, unknown>; relationship: GraphEdge }> = [];

  // Find relationships where this node is source
  const asSource = await db.relationship.findMany({
    where: {
      OR: [
        { sourceOrgId: nodeId },
        { sourcePersonId: nodeId },
      ],
    },
  });

  for (const rel of asSource) {
    if (rel.targetOrgId) {
      const org = await db.organization.findUnique({ where: { id: rel.targetOrgId } });
      if (org) orgConnections.push({ org: org as unknown as Record<string, unknown>, relationship: relToEdge(rel, nodeId) });
    }
    if (rel.targetPersonId) {
      const person = await db.person.findUnique({ where: { id: rel.targetPersonId } });
      if (person) personConnections.push({ person: person as unknown as Record<string, unknown>, relationship: relToEdge(rel, nodeId) });
    }
  }

  // Find relationships where this node is target
  const asTarget = await db.relationship.findMany({
    where: {
      OR: [
        { targetOrgId: nodeId },
        { targetPersonId: nodeId },
      ],
    },
  });

  for (const rel of asTarget) {
    if (rel.sourceOrgId) {
      const org = await db.organization.findUnique({ where: { id: rel.sourceOrgId } });
      if (org) orgConnections.push({ org: org as unknown as Record<string, unknown>, relationship: relToEdge(rel, nodeId) });
    }
    if (rel.sourcePersonId) {
      const person = await db.person.findUnique({ where: { id: rel.sourcePersonId } });
      if (person) personConnections.push({ person: person as unknown as Record<string, unknown>, relationship: relToEdge(rel, nodeId) });
    }
  }

  return { organizations: orgConnections, people: personConnections };
}

/**
 * Get the full knowledge graph summary (counts, top clusters, graph density).
 */
export async function getGraphStats(): Promise<{
  totalNodes: number;
  totalEdges: number;
  organizations: number;
  people: number;
  relationshipTypes: Record<string, number>;
  avgConnectionsPerNode: number;
  isolatedNodes: number;
  largestCluster: number;
}> {
  const [orgCount, personCount, edgeCount] = await Promise.all([
    db.organization.count({ where: { trackingStatus: 'active' } }),
    db.person.count(),
    db.relationship.count(),
  ]);

  // Count by relationship type
  const typeGroups = await db.relationship.groupBy({
    by: ['type'],
    _count: true,
  });
  const relationshipTypes: Record<string, number> = {};
  for (const group of typeGroups) {
    relationshipTypes[group.type] = group._count;
  }

  // Find connected nodes (nodes with at least one relationship)
  const connectedOrgs = await db.relationship.findMany({
    where: { sourceOrgId: { not: null } },
    select: { sourceOrgId: true },
    distinct: ['sourceOrgId'],
  });
  const connectedPeople = await db.relationship.findMany({
    where: { sourcePersonId: { not: null } },
    select: { sourcePersonId: true },
    distinct: ['sourcePersonId'],
  });

  const connectedNodeCount = connectedOrgs.length + connectedPeople.length;
  const totalNodes = orgCount + personCount;
  const isolatedNodes = totalNodes - connectedNodeCount;
  const avgConnectionsPerNode = totalNodes > 0
    ? Math.round((edgeCount * 2) / totalNodes * 100) / 100
    : 0;

  // BFS to find largest connected cluster
  const largestCluster = await findLargestCluster(orgCount, personCount);

  return {
    totalNodes,
    totalEdges: edgeCount,
    organizations: orgCount,
    people: personCount,
    relationshipTypes,
    avgConnectionsPerNode,
    isolatedNodes,
    largestCluster,
  };
}

// ─── Graph Enrichment ──────────────────────────────────────────────────────

/**
 * Compute and update intelligence scores for all organizations.
 * Score is based on: data richness, relationship count, signal count, insight quality.
 */
export async function computeIntelligenceScores(orgId?: string): Promise<number> {
  const orgs = orgId
    ? await db.organization.findMany({ where: { id: orgId } })
    : await db.organization.findMany({ where: { trackingStatus: 'active' } });

  let updated = 0;

  for (const org of orgs) {
    // Data richness: how much do we know?
    const dataFields = [
      org.domain, org.industry, org.description, org.website,
      org.headquarters, org.employeeCount, org.revenue, org.foundedYear,
    ].filter(Boolean).length;
    const dataScore = Math.round((dataFields / 8) * 25); // 0-25

    // Relationship score: how connected is this org?
    const relCount = await db.relationship.count({
      where: {
        OR: [
          { sourceOrgId: org.id },
          { targetOrgId: org.id },
        ],
      },
    });
    const relScore = Math.min(25, relCount * 3);

    // Signal score: how much intelligence activity?
    const signalCount = await db.signal.count({
      where: { organizationId: org.id, status: { in: ['detected', 'validated', 'analyzed'] } },
    });
    const signalScore = Math.min(25, signalCount * 5);

    // People score: contact coverage
    const personCount = await db.person.count({
      where: { organizationId: org.id },
    });
    const peopleScore = Math.min(25, personCount * 5);

    const totalScore = dataScore + relScore + signalScore + peopleScore;

    await db.organization.update({
      where: { id: org.id },
      data: {
        intelligenceScore: totalScore,
        lastEnrichedAt: new Date(),
      },
    });

    updated++;
  }

  logger.info('[KG] Intelligence scores computed', { updated });
  return updated;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

async function expandOrg(
  orgId: string,
  depth: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visited: Set<string>
): Promise<void> {
  if (depth <= 0) return;

  // Get people at this org
  const people = await db.person.findMany({
    where: { organizationId: orgId },
    take: 50,
  });
  for (const person of people) {
    if (!visited.has(person.id)) {
      nodes.push(personToNode(person));
      visited.add(person.id);

      const worksAtRel = await db.relationship.findFirst({
        where: { type: 'works_at', sourcePersonId: person.id, targetOrgId: orgId },
      });
      edges.push({
        id: worksAtRel?.id || `works_${person.id}_${orgId}`,
        source: person.id,
        target: orgId,
        type: 'works_at',
        label: worksAtRel?.label || `${person.fullName} works at`,
        weight: worksAtRel?.weight || 1.0,
        evidenceId: null,
      });
    }
  }

  // Get org-to-org relationships
  const orgRels = await db.relationship.findMany({
    where: {
      OR: [
        { sourceOrgId: orgId },
        { targetOrgId: orgId },
      ],
    },
    take: 50,
  });

  for (const rel of orgRels) {
    const peerId = rel.sourceOrgId === orgId ? rel.targetOrgId : rel.sourceOrgId;
    if (peerId && !visited.has(peerId)) {
      const peer = await db.organization.findUnique({ where: { id: peerId } });
      if (peer) {
        nodes.push(orgToNode(peer));
        visited.add(peerId);
        edges.push(relToEdge(rel, orgId));
        await expandOrg(peerId, depth - 1, nodes, edges, visited);
      }
    } else if (peerId && visited.has(peerId)) {
      edges.push(relToEdge(rel, orgId));
    }
  }
}

async function expandPerson(
  personId: string,
  depth: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visited: Set<string>
): Promise<void> {
  if (depth <= 0) return;

  // Get person's org
  const person = await db.person.findUnique({ where: { id: personId } });
  if (person?.organizationId && !visited.has(person.organizationId)) {
    const org = await db.organization.findUnique({ where: { id: person.organizationId } });
    if (org) {
      nodes.push(orgToNode(org));
      visited.add(org.id);
      await expandOrg(org.id, depth - 1, nodes, edges, visited);
    }
  }

  // Get person-to-person relationships
  const personRels = await db.relationship.findMany({
    where: {
      OR: [
        { sourcePersonId: personId },
        { targetPersonId: personId },
      ],
    },
    take: 30,
  });

  for (const rel of personRels) {
    const peerId = rel.sourcePersonId === personId ? rel.targetPersonId : rel.sourcePersonId;
    if (peerId && !visited.has(peerId)) {
      const peer = await db.person.findUnique({ where: { id: peerId } });
      if (peer) {
        nodes.push(personToNode(peer));
        visited.add(peerId);
        edges.push(relToEdge(rel, personId));
        await expandPerson(peerId, depth - 1, nodes, edges, visited);
      }
    } else if (peerId && visited.has(peerId)) {
      edges.push(relToEdge(rel, personId));
    }
  }
}

async function fetchNode(id: string): Promise<GraphNode | null> {
  const org = await db.organization.findUnique({ where: { id } });
  if (org) return orgToNode(org);

  const person = await db.person.findUnique({ where: { id } });
  if (person) return personToNode(person);

  return null;
}

function orgToNode(org: { id: string; name: string; industry?: string | null; domain?: string | null; employeeCount?: number | null; intelligenceScore?: number | null }): GraphNode {
  return {
    id: org.id,
    type: 'organization',
    label: org.name,
    properties: {
      industry: org.industry,
      domain: org.domain,
      employeeCount: org.employeeCount,
      intelligenceScore: org.intelligenceScore,
    },
  };
}

function personToNode(person: { id: string; fullName: string; title?: string | null; department?: string | null; role?: string }): GraphNode {
  return {
    id: person.id,
    type: 'person',
    label: person.fullName,
    properties: {
      title: person.title,
      department: person.department,
      role: person.role,
    },
  };
}

function relToEdge(rel: { id: string; type: string; label: string | null; weight: number | null; sourceOrgId?: string | null; targetOrgId?: string | null; sourcePersonId?: string | null; targetPersonId?: string | null; evidenceId?: string | null }, _currentNodeId: string): GraphEdge {
  const source = rel.sourceOrgId || rel.sourcePersonId || '';
  const target = rel.targetOrgId || rel.targetPersonId || '';
  return {
    id: rel.id,
    source,
    target,
    type: rel.type,
    label: rel.label,
    weight: rel.weight || 1.0,
    evidenceId: rel.evidenceId || null,
  };
}

function getNextNodeId(rel: { sourceOrgId?: string | null; targetOrgId?: string | null; sourcePersonId?: string | null; targetPersonId?: string | null }, currentId: string): string | null {
  if (rel.sourceOrgId === currentId) return rel.targetOrgId ?? null;
  if (rel.targetOrgId === currentId) return rel.sourceOrgId ?? null;
  if (rel.sourcePersonId === currentId) return rel.targetPersonId ?? null;
  if (rel.targetPersonId === currentId) return rel.sourcePersonId ?? null;
  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)\s*$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

function calculateOrgMatchScore(query: string, org: { name: string; domain?: string | null; aliases: string[] }): number {
  let score = 0;
  const q = normalizeName(query);

  // Exact name match
  if (normalizeName(org.name) === q) return 95;
  // Name contains query
  if (normalizeName(org.name).includes(q) || q.includes(normalizeName(org.name))) score += 60;
  // Alias match
  for (const alias of org.aliases) {
    if (normalizeName(alias) === q) return 90;
    if (normalizeName(alias).includes(q)) score += 50;
  }
  return Math.min(score, 85);
}

function calculatePersonMatchScore(query: string, person: { fullName: string; email?: string | null }): number {
  let score = 0;
  const q = query.toLowerCase().trim();

  if (person.fullName.toLowerCase() === q) return 95;
  if (person.fullName.toLowerCase().includes(q)) score += 60;

  return Math.min(score, 85);
}

async function findLargestCluster(_orgCount: number, _personCount: number): Promise<number> {
  // Simplified: return the total connected nodes count as an approximation
  const connectedOrgs = await db.relationship.findMany({
    where: { sourceOrgId: { not: null } },
    select: { sourceOrgId: true },
    distinct: ['sourceOrgId'],
  });
  const connectedPeople = await db.relationship.findMany({
    where: { sourcePersonId: { not: null } },
    select: { sourcePersonId: true },
    distinct: ['sourcePersonId'],
  });

  return connectedOrgs.length + connectedPeople.length;
}
