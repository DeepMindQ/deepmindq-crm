/**
 * S4-2.1 — Knowledge Graph Cold-Start Hydration
 * ==============================================
 *
 * When the knowledge graph is empty after DB-based cold-start loading,
 * this module auto-constructs initial nodes and edges from existing
 * company/signal/contact/evidence data in the database.
 *
 * DESIGN PRINCIPLES:
 *   1. Reuse-first: uses existing db, ai-knowledge-graph exports
 *   2. Non-blocking: failures don't crash startup
 *   3. Idempotent: safe to call multiple times (checks if graph already populated)
 *   4. Incremental: only runs when nodeStore.size === 0
 *
 * HYDRATION SEQUENCE:
 *   Phase 1: Company nodes (from Company table)
 *   Phase 2: Signal nodes (from CompanySignal table)
 *   Phase 3: Technology nodes (extracted from signals + company tech stack)
 *   Phase 4: Industry nodes (from company industries)
 *   Phase 5: Edges (company→signal, company→industry, company→technology, signal→opportunity)
 *
 * Called from cold-start-loader.ts after DB hydration completes.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  addNodeSync,
  addEdgeSync,
  getNode,
  getGraphStats,
  type GraphEntityType,
  type RelationshipType,
} from '@/lib/ai-knowledge-graph';

// ─── Configuration ──────────────────────────────────────────────────

/** Minimum number of companies to trigger auto-hydration (avoid running on empty DBs) */
const MIN_COMPANIES_THRESHOLD = 3;

/** Maximum companies/signals to process in a single hydration run */
const MAX_ENTITIES_PER_BATCH = 200;

// ─── Types ───────────────────────────────────────────────────────────

export interface KGColdStartResult {
  hydrated: boolean;
  reason: string;
  companyNodesCreated: number;
  signalNodesCreated: number;
  technologyNodesCreated: number;
  industryNodesCreated: number;
  edgesCreated: number;
  totalNodesBefore: number;
  totalNodesAfter: number;
  durationMs: number;
}

// ─── Main Hydration Function ─────────────────────────────────────────

/**
 * Auto-hydrate the knowledge graph from existing DB data.
 *
 * Only runs when the graph is empty (nodeStore.size === 0).
 * Creates company, signal, technology, and industry nodes,
 * then connects them with typed edges.
 *
 * Returns immediately if:
 *   - Graph already has nodes (hydrated from DB or previous run)
 *   - DB has fewer than MIN_COMPANIES_THRESHOLD companies
 */
export async function hydrateKnowledgeGraphFromDB(): Promise<KGColdStartResult> {
  const startTime = Date.now();
  const statsBefore = getGraphStats();

  const result: KGColdStartResult = {
    hydrated: false,
    reason: 'not_started',
    companyNodesCreated: 0,
    signalNodesCreated: 0,
    technologyNodesCreated: 0,
    industryNodesCreated: 0,
    edgesCreated: 0,
    totalNodesBefore: statsBefore.totalNodes,
    totalNodesAfter: statsBefore.totalNodes,
    durationMs: 0,
  };

  // Check if graph is already populated
  if (statsBefore.totalNodes > 0) {
    result.reason = 'graph_already_populated';
    result.durationMs = Date.now() - startTime;
    return result;
  }

  try {
    // Check if we have enough data to justify hydration
    const companyCount = await db.company.count();
    if (companyCount < MIN_COMPANIES_THRESHOLD) {
      result.reason = `insufficient_data (${companyCount} companies, need ${MIN_COMPANIES_THRESHOLD})`;
      result.durationMs = Date.now() - startTime;
      logger.info(`[kg-cold-start] Skipping: ${result.reason}`);
      return result;
    }

    logger.info(`[kg-cold-start] Starting auto-hydration from ${companyCount} companies...`);

    // ── Phase 1: Company Nodes ──
    const companies = await db.company.findMany({
      take: MAX_ENTITIES_PER_BATCH,
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        location: true,
        tags: true,
      },
    });

    for (const company of companies) {
      const nodeId = `company:${company.id}`;
      if (await getNode(nodeId)) continue; // already exists

      addNodeSync({
        id: nodeId,
        label: company.rawName || company.domain || 'Unknown Company',
        type: 'company' as GraphEntityType,
        aliases: company.domain ? [company.domain] : [],
        properties: {
          industry: company.industry || null,
          sizeRange: company.sizeRange || null,
          location: company.location || null,
          domain: company.domain || null,
          dbCompanyId: company.id,
        },
        confidence: 0.9,
      });
      result.companyNodesCreated++;
    }

    // ── Phase 2: Signal Nodes ──
    const signals = await db.companySignal.findMany({
      take: MAX_ENTITIES_PER_BATCH,
      where: { companyId: { in: companies.map(c => c.id) } },
      select: {
        id: true,
        companyId: true,
        title: true,
        signalType: true,
        severity: true,
        confidence: true,
      },
    });

    for (const signal of signals) {
      const signalNodeId = `signal:${signal.id}`;
      if (await getNode(signalNodeId)) continue;

      addNodeSync({
        id: signalNodeId,
        label: signal.title || `Signal ${signal.id}`,
        type: 'signal' as GraphEntityType,
        aliases: [],
        properties: {
          signalType: signal.signalType,
          severity: signal.severity,
          dbSignalId: signal.id,
          dbCompanyId: signal.companyId,
        },
        confidence: (signal.confidence ?? 0.7),
      });
      result.signalNodesCreated++;
    }

    // ── Phase 3: Technology Nodes (extracted from company tags) ──
    const techNodeIds = new Set<string>();
    for (const company of companies) {
      const techs = parseTechnologies(company.tags);
      for (const tech of techs) {
        const techNodeId = `technology:${tech.toLowerCase().replace(/[\s\/]+/g, '-')}`;
        if (techNodeIds.has(techNodeId) || await getNode(techNodeId)) continue;

        addNodeSync({
          id: techNodeId,
          label: tech,
          type: 'technology' as GraphEntityType,
          aliases: [],
          properties: { category: inferTechCategory(tech) },
          confidence: 0.85,
        });
        techNodeIds.add(techNodeId);
        result.technologyNodesCreated++;
      }
    }

    // ── Phase 4: Industry Nodes ──
    const industryNodeIds = new Set<string>();
    for (const company of companies) {
      if (!company.industry) continue;
      const industryNodeId = `industry:${company.industry.toLowerCase().replace(/[\s\/]+/g, '-')}`;
      if (industryNodeIds.has(industryNodeId) || await getNode(industryNodeId)) continue;

      addNodeSync({
        id: industryNodeId,
        label: company.industry,
        type: 'industry' as GraphEntityType,
        aliases: [],
        properties: {},
        confidence: 0.9,
      });
      industryNodeIds.add(industryNodeId);
      result.industryNodesCreated++;
    }

    // ── Phase 5: Edges ──
    for (const company of companies) {
      const companyNodeId = `company:${company.id}`;
      if (!await getNode(companyNodeId)) continue;

      // Company → Signal edges
      for (const signal of signals) {
        if (signal.companyId !== company.id) continue;
        const signalNodeId = `signal:${signal.id}`;

        addEdgeSync({
          id: `edge:${companyNodeId}:HAS_SIGNAL:${signalNodeId}`,
          sourceId: companyNodeId,
          targetId: signalNodeId,
          relationship: 'HAS_SIGNAL' as RelationshipType,
          weight: Math.min(1.0, (signal.severity === 'critical' ? 0.95 : signal.severity === 'high' ? 0.85 : 0.7)),
          confidence: signal.confidence ?? 0.7,
          reason: `${company.rawName} has signal: ${signal.title}`,
          evidenceIds: [],
        });
        result.edgesCreated++;
      }

      // Company → Industry edges
      if (company.industry) {
        const industryNodeId = `industry:${company.industry.toLowerCase().replace(/[\s\/]+/g, '-')}`;
        if (await getNode(industryNodeId)) {
          addEdgeSync({
            id: `edge:${companyNodeId}:RELATED_TO:${industryNodeId}`,
            sourceId: companyNodeId,
            targetId: industryNodeId,
            relationship: 'RELATED_TO' as RelationshipType,
            weight: 0.9,
            confidence: 0.9,
            reason: `${company.rawName} operates in ${company.industry} sector`,
            evidenceIds: [],
          });
          result.edgesCreated++;
        }
      }

      // Company → Technology edges
      const techs = parseTechnologies(company.tags);
      for (const tech of techs) {
        const techNodeId = `technology:${tech.toLowerCase().replace(/[\s\/]+/g, '-')}`;
        if (await getNode(techNodeId)) {
          addEdgeSync({
            id: `edge:${companyNodeId}:USES_TECHNOLOGY:${techNodeId}`,
            sourceId: companyNodeId,
            targetId: techNodeId,
            relationship: 'USES_TECHNOLOGY' as RelationshipType,
            weight: 0.8,
            confidence: 0.85,
            reason: `${company.rawName} uses ${tech}`,
            evidenceIds: [],
          });
          result.edgesCreated++;
        }
      }
    }

    // ── Phase 6: Cross-company industry edges (connect companies in same industry) ──
    const industryCompanies = new Map<string, string[]>();
    for (const company of companies) {
      if (!company.industry) continue;
      const key = company.industry.toLowerCase();
      const list = industryCompanies.get(key) || [];
      list.push(company.id);
      industryCompanies.set(key, list);
    }

    for (const [, companyIds] of industryCompanies) {
      // Connect each pair within the same industry with COMPETES_WITH or SIMILAR_TO
      for (let i = 0; i < companyIds.length; i++) {
        for (let j = i + 1; j < companyIds.length; j++) {
          const nodeA = `company:${companyIds[i]}`;
          const nodeB = `company:${companyIds[j]}`;
          addEdgeSync({
            id: `edge:${nodeA}:SIMILAR_TO:${nodeB}`,
            sourceId: nodeA,
            targetId: nodeB,
            relationship: 'SIMILAR_TO' as RelationshipType,
            weight: 0.6,
            confidence: 0.7,
            reason: 'Companies in the same industry segment',
            evidenceIds: [],
          });
          result.edgesCreated++;
        }
      }
    }

    // ── Final stats ──
    const statsAfter = getGraphStats();
    result.totalNodesAfter = statsAfter.totalNodes;
    result.hydrated = true;
    result.reason = `auto_hydrated from ${companies.length} companies, ${signals.length} signals`;
    result.durationMs = Date.now() - startTime;

    logger.info(`[kg-cold-start] Hydration complete: ${result.companyNodesCreated} company nodes, ` +
      `${result.signalNodesCreated} signal nodes, ${result.technologyNodesCreated} tech nodes, ` +
      `${result.industryNodesCreated} industry nodes, ${result.edgesCreated} edges ` +
      `in ${result.durationMs}ms`);

  } catch (error) {
    result.reason = `error: ${error instanceof Error ? error.message : String(error)}`;
    result.durationMs = Date.now() - startTime;
    logger.error(`[kg-cold-start] Hydration failed: ${result.reason}`);
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Parse the technologies JSON/array field from a company record.
 * Handles stringified JSON arrays, comma-separated strings, and null.
 */
function parseTechnologies(technologies: unknown): string[] {
  if (!technologies) return [];
  if (Array.isArray(technologies)) {
    return technologies.filter((t): t is string => typeof t === 'string');
  }
  if (typeof technologies === 'string') {
    try {
      const parsed = JSON.parse(technologies);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === 'string');
      }
      // Comma-separated fallback
      return technologies.split(',').map(t => t.trim()).filter(Boolean);
    } catch {
      // Comma-separated fallback
      return technologies.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Infer a technology category from a technology name.
 * Uses simple heuristics for common patterns.
 */
function inferTechCategory(tech: string): string {
  const lower = tech.toLowerCase();
  const cloudProviders = ['aws', 'azure', 'gcp', 'google cloud', 'alibaba cloud', 'oracle cloud'];
  const databases = ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra'];
  const containers = ['kubernetes', 'docker', 'openshift', 'nomad'];
  const iac = ['terraform', 'cloudformation', 'pulumi', 'ansible', 'chef', 'puppet'];
  const ciCd = ['jenkins', 'gitlab', 'github actions', 'circleci', 'travis', 'argo'];
  const crm = ['salesforce', 'hubspot', 'dynamics', 'sap'];
  const languages = ['python', 'java', 'typescript', 'javascript', 'go', 'rust', 'c#'];

  if (cloudProviders.some(c => lower.includes(c))) return 'cloud';
  if (databases.some(d => lower.includes(d))) return 'database';
  if (containers.some(c => lower.includes(c))) return 'containerization';
  if (iac.some(i => lower.includes(i))) return 'iac';
  if (ciCd.some(c => lower.includes(c))) return 'cicd';
  if (crm.some(c => lower.includes(c))) return 'crm';
  if (languages.some(l => lower.includes(l))) return 'language';

  return 'general';
}
