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

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Safely parse a JSON string, returning an array or empty array on failure */
function safeJsonParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

    // FIX EI-1: Fuzzy domain matching — check for same SLD with different TLDs
    const sld = extractSLD(query.domain);
    if (sld && sld.length > 1) {
      const allOrgs = await db.organization.findMany({
        where: { domain: { not: null } },
        select: { id: true, name: true, domain: true },
        take: 50,
      });
      for (const o of allOrgs) {
        if (matches.some((m) => m.nodeId === o.id) || !o.domain) continue;
        const oSLD = extractSLD(o.domain);
        if (oSLD === sld && o.domain !== query.domain.toLowerCase()) {
          const queryRoot = extractRootDomain(query.domain);
          const oRoot = extractRootDomain(o.domain);
          const fuzzyScore = queryRoot === oRoot ? 90 : 70;
          matches.push({
            nodeId: o.id,
            nodeType: 'organization',
            label: o.name,
            score: fuzzyScore,
            matchedFields: ['domain_fuzzy'],
          });
        }
      }
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
          { name: { contains: query.name } },
          { name: { contains: normalized } },
          { aliases: { contains: query.name } },
          { aliases: { contains: normalized } },
        ],
      },
      take: 10,
    });

    for (const org of orgs) {
      if (matches.some((m) => m.nodeId === org.id)) continue;

      const score = calculateOrgMatchScore(query.name, org as { name: string; aliases: string });
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
        fullName: { contains: query.name },
      },
      take: 10,
    });

    for (const person of people) {
      if (matches.some((m) => m.nodeId === person.id)) continue;

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
  mergedBy?: string,
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

  await db.$transaction(async (tx) => {
    // Move people from source to target
    await tx.person.updateMany({
      where: { organizationId: sourceId },
      data: { organizationId: targetId },
    });

    // Move signals
    await tx.signal.updateMany({
      where: { organizationId: sourceId },
      data: { organizationId: targetId },
    });

    // Move evidence
    await tx.evidence.updateMany({
      where: { organizationId: sourceId },
      data: { organizationId: targetId },
    });

    // Move insights
    await tx.insight.updateMany({
      where: { organizationId: sourceId },
      data: { organizationId: targetId },
    });

    // Move briefings
    await tx.briefing.updateMany({
      where: { organizationId: sourceId },
      data: { organizationId: targetId },
    });

    // Re-point relationships (source → target)
    await tx.relationship.updateMany({
      where: { sourceOrgId: sourceId },
      data: { sourceOrgId: targetId },
    });
    await tx.relationship.updateMany({
      where: { targetOrgId: sourceId },
      data: { targetOrgId: targetId },
    });

    // Add source name as alias to target
    const currentAliases: string[] = safeJsonParse(target.aliases);
    if (source.name && !currentAliases.includes(source.name)) {
      await tx.organization.update({
        where: { id: targetId },
        data: { aliases: JSON.stringify([...currentAliases, source.name]) },
      });
    }

    // Delete the source
    await tx.organization.delete({ where: { id: sourceId } });
  });
}

// ─── Relationship Extraction ──────────────────────────────────────────────

/**
 * Auto-discover relationships from existing data.
 * Called after ingestion to build graph connections automatically.
 *
 * Optimized: fetches all existing relationships for the target orgs in a
 * single batch query, then checks existence in-memory — eliminating N+1
 * individual DB round-trips per potential relationship.
 */
export async function discoverRelationships(orgId?: string): Promise<number> {
  let created = 0;

  // Find organizations to process
  const orgs = orgId
    ? await db.organization.findMany({ where: { id: orgId } })
    : await db.organization.findMany({ where: { trackingStatus: 'active' } });

  if (orgs.length === 0) return 0;

  const orgIds = new Set(orgs.map((o) => o.id));

  // ── Batch 1: Fetch all existing relationships for these orgs in ONE query ──
  const existingRels = await db.relationship.findMany({
    where: {
      OR: [{ sourceOrgId: { in: [...orgIds] } }, { targetOrgId: { in: [...orgIds] } }],
    },
    select: {
      type: true,
      sourceOrgId: true,
      targetOrgId: true,
      sourcePersonId: true,
      targetPersonId: true,
    },
  });

  // Build lookup sets for O(1) existence checks
  const existingSet = new Set(
    existingRels.map(
      (r) =>
        `${r.type}:${r.sourceOrgId || ''}:${r.targetOrgId || ''}:${r.sourcePersonId || ''}:${r.targetPersonId || ''}`,
    ),
  );

  function relExists(
    type: string,
    sourceOrgId?: string | null,
    targetOrgId?: string | null,
    sourcePersonId?: string | null,
    targetPersonId?: string | null,
  ): boolean {
    return existingSet.has(
      `${type}:${sourceOrgId || ''}:${targetOrgId || ''}:${sourcePersonId || ''}:${targetPersonId || ''}`,
    );
  }

  // Batch-create accumulator: collect all new relationships, then createMany at once
  const newRels: Array<{
    type: string;
    label: string;
    weight: number;
    sourceOrgId?: string | null;
    targetOrgId?: string | null;
    sourcePersonId?: string | null;
    targetPersonId?: string | null;
    evidenceId?: string | null;
  }> = [];

  for (const org of orgs) {
    // 1. People → Organization relationships (works_at)
    const people = await db.person.findMany({
      where: { organizationId: org.id },
    });
    for (const person of people) {
      if (!relExists('works_at', null, org.id, person.id, null)) {
        newRels.push({
          type: 'works_at',
          label: `${person.fullName} works at ${org.name}`,
          weight: 1.0,
          sourcePersonId: person.id,
          targetOrgId: org.id,
        });
      }
    }

    // 2. Co-worker relationships (person ↔ person via same org)
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        if (
          !relExists('coworker', null, null, people[i].id, people[j].id) &&
          !relExists('coworker', null, null, people[j].id, people[i].id)
        ) {
          newRels.push({
            type: 'coworker',
            label: `${people[i].fullName} and ${people[j].fullName} are coworkers at ${org.name}`,
            weight: 0.7,
            sourcePersonId: people[i].id,
            targetPersonId: people[j].id,
            targetOrgId: org.id,
          });
        }
      }
    }

    // 3. Same industry = potential competitors
    if (org.industry) {
      const sameIndustry = await db.organization.findMany({
        where: {
          id: { not: org.id },
          industry: { contains: org.industry },
          trackingStatus: 'active',
        },
      });
      for (const peer of sameIndustry) {
        if (
          !relExists('competes_with', org.id, peer.id) &&
          !relExists('competes_with', peer.id, org.id)
        ) {
          // FIX EI-2: Weighted by sub-industry overlap and size similarity
          const subIndustryMatch =
            org.subIndustry && peer.subIndustry && org.subIndustry === peer.subIndustry;
          const sizeDiff = Math.abs((org.employeeCount || 0) - (peer.employeeCount || 0));
          const sizeSimilarity = sizeDiff < 50 ? 0.2 : 0;
          newRels.push({
            type: 'competes_with',
            label: `${org.name} and ${peer.name} compete in ${org.industry}${subIndustryMatch ? ` (${org.subIndustry})` : ''}`,
            weight: Math.min(0.8, 0.3 + (subIndustryMatch ? 0.3 : 0) + sizeSimilarity),
            sourceOrgId: org.id,
            targetOrgId: peer.id,
          });
        }
      }
    }

    // 4. Same headquarters region = geographic proximity
    if (org.headquarters) {
      const sameRegion = await db.organization.findMany({
        where: {
          id: { not: org.id },
          headquarters: { contains: org.headquarters },
          trackingStatus: 'active',
        },
      });
      for (const neighbor of sameRegion) {
        if (
          !relExists('same_region', org.id, neighbor.id) &&
          !relExists('same_region', neighbor.id, org.id)
        ) {
          // FIX EI-2: Weighted by HQ string similarity
          const hqSimilarity = org.headquarters === neighbor.headquarters ? 0.3 : 0.1;
          newRels.push({
            type: 'same_region',
            label: `Both in ${org.headquarters}`,
            weight: 0.2 + hqSimilarity,
            sourceOrgId: org.id,
            targetOrgId: neighbor.id,
          });
        }
      }
    }

    // 5. FIX EI-2: Technology-based relationships (orgs with similar descriptions)
    if (org.description && org.description.length > 20) {
      const techKeywords = extractTechKeywords(org.description);
      if (techKeywords.length > 0) {
        const techOrgs = await db.organization.findMany({
          where: {
            id: { not: org.id },
            description: { not: null },
            trackingStatus: 'active',
          },
          take: 30,
        });
        for (const peer of techOrgs) {
          if (
            !peer.description ||
            relExists('tech_overlap', org.id, peer.id) ||
            relExists('tech_overlap', peer.id, org.id)
          )
            continue;
          const peerKeywords = extractTechKeywords(peer.description);
          const overlap = techKeywords.filter((k) => peerKeywords.includes(k));
          if (overlap.length >= 2) {
            newRels.push({
              type: 'tech_overlap',
              label: `${org.name} and ${peer.name} share technology: ${overlap.slice(0, 3).join(', ')}`,
              weight: Math.min(0.7, 0.3 + overlap.length * 0.1),
              sourceOrgId: org.id,
              targetOrgId: peer.id,
            });
          }
        }
      }
    }

    // 6. FIX EI-2: Size-tier relationships (similar employee count = potential partners)
    if (org.employeeCount && org.employeeCount > 0) {
      const sizeTier = org.employeeCount < 50 ? 'small' : org.employeeCount < 500 ? 'mid' : 'large';
      const sameTier = await db.organization.findMany({
        where: {
          id: { not: org.id },
          employeeCount: { not: null },
          trackingStatus: 'active',
        },
        take: 30,
      });
      for (const peer of sameTier) {
        if (
          !peer.employeeCount ||
          relExists('size_peer', org.id, peer.id) ||
          relExists('size_peer', peer.id, org.id)
        )
          continue;
        const peerTier =
          peer.employeeCount < 50 ? 'small' : peer.employeeCount < 500 ? 'mid' : 'large';
        if (peerTier === sizeTier && org.industry !== peer.industry) {
          newRels.push({
            type: 'size_peer',
            label: `${org.name} (${org.employeeCount} employees) and ${peer.name} (${peer.employeeCount} employees) are similar-size organizations`,
            weight: 0.3,
            sourceOrgId: org.id,
            targetOrgId: peer.id,
          });
        }
      }
    }
  }

  // ── Batch create all new relationships in chunks of 100 ──
  if (newRels.length > 0) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < newRels.length; i += CHUNK_SIZE) {
      const chunk = newRels.slice(i, i + CHUNK_SIZE);
      const { count } = await db.relationship.createMany({ data: chunk });
      created += count;
    }
  }

  logger.info('[KG] Relationship discovery complete', { created, checked: orgs.length });
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
  validFrom?: Date | string;
  validUntil?: Date | string;
  sourceType?: string;
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
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      sourceType: data.sourceType || 'manual',
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
export async function getSubgraph(centerNodeId: string, depth: number = 2): Promise<GraphSubgraph> {
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
  maxHops: number = 4,
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

  // Find all relationships where this node is source or target (2 queries)
  const [asSource, asTarget] = await Promise.all([
    db.relationship.findMany({
      where: {
        OR: [{ sourceOrgId: nodeId }, { sourcePersonId: nodeId }],
      },
    }),
    db.relationship.findMany({
      where: {
        OR: [{ targetOrgId: nodeId }, { targetPersonId: nodeId }],
      },
    }),
  ]);

  // Collect all target IDs for batch fetch
  const orgIdsToFetch = new Set<string>();
  const personIdsToFetch = new Set<string>();

  for (const rel of [...asSource, ...asTarget]) {
    if (rel.targetOrgId && rel.targetOrgId !== nodeId) orgIdsToFetch.add(rel.targetOrgId);
    if (rel.sourceOrgId && rel.sourceOrgId !== nodeId) orgIdsToFetch.add(rel.sourceOrgId);
    if (rel.targetPersonId && rel.targetPersonId !== nodeId)
      personIdsToFetch.add(rel.targetPersonId);
    if (rel.sourcePersonId && rel.sourcePersonId !== nodeId)
      personIdsToFetch.add(rel.sourcePersonId);
  }

  // Batch fetch all orgs and people in 2 queries
  const [fetchedOrgs, fetchedPeople] = await Promise.all([
    orgIdsToFetch.size > 0
      ? db.organization.findMany({ where: { id: { in: [...orgIdsToFetch] } } })
      : Promise.resolve([]),
    personIdsToFetch.size > 0
      ? db.person.findMany({ where: { id: { in: [...personIdsToFetch] } } })
      : Promise.resolve([]),
  ]);

  // Build lookup maps
  const orgMap = new Map(fetchedOrgs.map((o) => [o.id, o as unknown as Record<string, unknown>]));
  const personMap = new Map(
    fetchedPeople.map((p) => [p.id, p as unknown as Record<string, unknown>]),
  );

  // Resolve asSource relationships
  for (const rel of asSource) {
    if (rel.targetOrgId) {
      const org = orgMap.get(rel.targetOrgId);
      if (org) orgConnections.push({ org, relationship: relToEdge(rel, nodeId) });
    }
    if (rel.targetPersonId) {
      const person = personMap.get(rel.targetPersonId);
      if (person) personConnections.push({ person, relationship: relToEdge(rel, nodeId) });
    }
  }

  // Resolve asTarget relationships
  for (const rel of asTarget) {
    if (rel.sourceOrgId) {
      const org = orgMap.get(rel.sourceOrgId);
      if (org) orgConnections.push({ org, relationship: relToEdge(rel, nodeId) });
    }
    if (rel.sourcePersonId) {
      const person = personMap.get(rel.sourcePersonId);
      if (person) personConnections.push({ person, relationship: relToEdge(rel, nodeId) });
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
  const avgConnectionsPerNode =
    totalNodes > 0 ? Math.round(((edgeCount * 2) / totalNodes) * 100) / 100 : 0;

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

  if (orgs.length === 0) return 0;

  // ── Batch: fetch all counts in 3 groupBy queries instead of N*4 ──
  const [relCounts, signalCounts, personCounts] = await Promise.all([
    db.relationship.groupBy({
      by: ['sourceOrgId', 'targetOrgId'],
      where: {
        OR: [
          { sourceOrgId: { in: orgs.map((o) => o.id) } },
          { targetOrgId: { in: orgs.map((o) => o.id) } },
        ],
      },
      _count: true,
    }),
    db.signal.groupBy({
      by: ['organizationId'],
      where: {
        organizationId: { in: orgs.map((o) => o.id) },
        status: { in: ['detected', 'validated', 'analyzed'] },
      },
      _count: true,
    }),
    db.person.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: orgs.map((o) => o.id) } },
      _count: true,
    }),
  ]);

  // Build lookup maps: orgId → count
  const relCountMap = new Map<string, number>();
  for (const group of relCounts) {
    const oid = group.sourceOrgId || group.targetOrgId;
    if (oid) relCountMap.set(oid, (relCountMap.get(oid) || 0) + group._count);
  }

  const signalCountMap = new Map(signalCounts.map((g) => [g.organizationId, g._count]));
  const personCountMap = new Map(personCounts.map((g) => [g.organizationId, g._count]));

  // Compute scores and batch update
  const updates = orgs.map((org) => {
    const dataFields = [
      org.domain,
      org.industry,
      org.description,
      org.website,
      org.headquarters,
      org.employeeCount,
      org.revenue,
      org.foundedYear,
    ].filter(Boolean).length;
    const dataScore = Math.round((dataFields / 8) * 25);
    const relScore = Math.min(25, (relCountMap.get(org.id) || 0) * 3);
    const signalScore = Math.min(25, (signalCountMap.get(org.id) || 0) * 5);
    const peopleScore = Math.min(25, (personCountMap.get(org.id) || 0) * 5);

    return {
      where: { id: org.id } as const,
      data: {
        intelligenceScore: dataScore + relScore + signalScore + peopleScore,
        lastEnrichedAt: new Date(),
      },
    };
  });

  // Batch update (Prisma doesn't have bulk update with per-row data,
  // so we run updates in a transaction for atomicity)
  await db.$transaction(updates.map((u) => db.organization.update(u)));

  logger.info('[KG] Intelligence scores computed', { updated: orgs.length });
  return orgs.length;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

async function expandOrg(
  orgId: string,
  depth: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visited: Set<string>,
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
      OR: [{ sourceOrgId: orgId }, { targetOrgId: orgId }],
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
  visited: Set<string>,
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
      OR: [{ sourcePersonId: personId }, { targetPersonId: personId }],
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

function orgToNode(org: {
  id: string;
  name: string;
  industry?: string | null;
  domain?: string | null;
  employeeCount?: number | null;
  intelligenceScore?: number | null;
}): GraphNode {
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

function personToNode(person: {
  id: string;
  fullName: string;
  title?: string | null;
  department?: string | null;
  role?: string;
}): GraphNode {
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

function relToEdge(
  rel: {
    id: string;
    type: string;
    label: string | null;
    weight: number | null;
    sourceOrgId?: string | null;
    targetOrgId?: string | null;
    sourcePersonId?: string | null;
    targetPersonId?: string | null;
    evidenceId?: string | null;
  },
  _currentNodeId: string,
): GraphEdge {
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

function getNextNodeId(
  rel: {
    sourceOrgId?: string | null;
    targetOrgId?: string | null;
    sourcePersonId?: string | null;
    targetPersonId?: string | null;
  },
  currentId: string,
): string | null {
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
    .replace(
      /\s*(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?|gmbh|ag|s\.?a\.?|plc|pty|pvt)\s*$/i,
      '',
    )
    .replace(/[^a-z0-9]/g, '');
}

/** Compute Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** Extract root domain from a full domain (e.g. 'www.acme.co.uk' → 'acme.co.uk') */
function extractRootDomain(domain: string): string {
  const parts = domain.toLowerCase().trim().split('.');
  // Handle common TLD patterns
  if (
    parts.length >= 3 &&
    ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(parts[parts.length - 2])
  ) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/** Extract second-level domain for fuzzy matching (e.g. 'acme' from 'acme.com') */
function extractSLD(domain: string): string {
  const root = extractRootDomain(domain);
  return root.split('.')[0];
}

/** FIX EI-2: Extract technology keywords from organization descriptions for relationship detection */
function extractTechKeywords(description: string): string[] {
  const techTerms = [
    'ai',
    'machine learning',
    'ml',
    'deep learning',
    'nlp',
    'computer vision',
    'cloud',
    'aws',
    'azure',
    'gcp',
    'kubernetes',
    'docker',
    'containers',
    'react',
    'angular',
    'vue',
    'node',
    'python',
    'java',
    'golang',
    'rust',
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'elasticsearch',
    'saas',
    'paas',
    'iaas',
    'api',
    'microservices',
    'serverless',
    'blockchain',
    'crypto',
    'web3',
    'defi',
    'iot',
    'edge computing',
    '5g',
    'cybersecurity',
    'fintech',
    'crm',
    'erp',
    'bi',
    'analytics',
    'data pipeline',
    'etl',
    'mobile',
    'ios',
    'android',
    'flutter',
    'react native',
    'terraform',
    'devops',
    'ci/cd',
    'gitops',
    'infrastructure',
  ];
  const lower = description.toLowerCase();
  return techTerms.filter((t) => lower.includes(t));
}

function calculateOrgMatchScore(
  query: string,
  org: {
    name: string;
    domain?: string | null;
    aliases: string;
    headquarters?: string | null;
    industry?: string | null;
  },
): number {
  let score = 0;
  const q = normalizeName(query);

  // Exact name match
  if (normalizeName(org.name) === q) return 95;
  // Name contains query
  if (normalizeName(org.name).includes(q) || q.includes(normalizeName(org.name))) score += 60;

  // FIX EI-1: Fuzzy name matching via Levenshtein distance (max 2 edits = likely same org)
  const orgNorm = normalizeName(org.name);
  const editDist = levenshtein(q, orgNorm);
  if (editDist === 1 && q.length > 3) score += 75; // 1-char typo
  if (editDist === 2 && q.length > 5) score += 55; // 2-char difference

  // FIX EI-1: Fuzzy domain matching (acme.com vs acme.co, www.acme.com vs acme.com)
  if (org.domain && query.includes('.')) {
    const querySLD = extractSLD(query);
    const orgSLD = extractSLD(org.domain);
    if (querySLD && orgSLD && querySLD === orgSLD) {
      const queryRoot = extractRootDomain(query);
      const orgRoot = extractRootDomain(org.domain);
      if (queryRoot === orgRoot) {
        score += 90; // Same root domain (acme.com == acme.com)
      } else {
        score += 65; // Same SLD, different TLD (acme.com vs acme.co)
      }
    }
  }

  // Alias match
  const aliases: string[] = safeJsonParse(org.aliases);
  for (const alias of aliases) {
    if (normalizeName(alias) === q) return 90;
    if (normalizeName(alias).includes(q)) score += 50;
  }
  return Math.min(score, 95);
}

function calculatePersonMatchScore(
  query: string,
  person: { fullName: string; email?: string | null },
): number {
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
