/**
 * WI-17B — Company Activation Lifecycle Status
 *
 * GET /api/companies/[id]/activation-status
 *
 * Returns the intelligence activation lifecycle for a company.
 * This tells the user:
 *   - Has intelligence been activated for this company?
 *   - What steps completed/failed/skipped?
 *   - When was it last activated?
 *   - What is the overall confidence score?
 *
 * The activation status is derived from multiple signals:
 *   1. Company.lastEnrichedAt → signal extraction ran
 *   2. CompanySignal records → signals exist
 *   3. CompanyResearchCard → research completed
 *   4. Evidence records → evidence collected
 *   5. Knowledge Graph → company node exists
 *   6. Memory → enterprise memory exists
 *   7. Retrieval Index → company indexed
 *   8. Confidence → computed from data
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  getNode,
  getGraphStats,
} from '@/lib/ai-knowledge-graph';
import {
  computeUnifiedConfidence,
} from '@/lib/ai-unified-confidence';
import {
  searchMemories,
} from '@/lib/ai-memory';
import {
  quickSearch,
} from '@/lib/ai-hybrid-retrieval';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    // Fetch company with key relationships
    const company = await db.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contacts: true,
            signals: true,
            evidence: true,
          },
        },
        researchCard: { select: { id: true, enrichmentDate: true, enrichmentSource: true } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // ── Derive activation status from data signals ──

    // Step 1: Entity Resolution — check if KG has company node
    let entityResolutionStatus: 'completed' | 'pending' | 'unknown' = 'pending';
    let entityResolutionDetail = '';
    try {
      const kgNode = await getNode(`company-${company.id}`);
      if (kgNode) {
        entityResolutionStatus = 'completed';
        entityResolutionDetail = `KG node exists (label: ${kgNode.label}, type: ${kgNode.type})`;
      } else {
        entityResolutionDetail = 'No knowledge graph node found — activation may not have run';
      }
    } catch {
      entityResolutionStatus = 'unknown';
      entityResolutionDetail = 'Knowledge graph not accessible';
    }

    // Step 2: Knowledge Graph — check edges (relationships)
    let knowledgeGraphStatus: 'completed' | 'pending' | 'unknown' = 'pending';
    let knowledgeGraphDetail = '';
    let kgNodeCount = 0;
    let kgEdgeCount = 0;
    try {
      const stats = getGraphStats();
      kgNodeCount = stats.totalNodes;
      kgEdgeCount = stats.totalEdges;
      // Count nodes related to this company
      const { getAllNodes, getAllEdges } = await import('@/lib/ai-knowledge-graph');
      const allNodes = getAllNodes();
      const companyNodes = allNodes.filter(n =>
        n.id === `company-${company.id}` ||
        n.properties?.companyId === company.id
      );
      const allEdges = getAllEdges();
      const companyEdges = allEdges.filter(e =>
        e.sourceId === `company-${company.id}` ||
        e.targetId === `company-${company.id}`
      );
      if (companyNodes.length > 0) {
        knowledgeGraphStatus = 'completed';
        knowledgeGraphDetail = `${companyNodes.length} nodes, ${companyEdges.length} edges`;
      } else {
        knowledgeGraphDetail = 'No graph entities for this company';
      }
    } catch {
      knowledgeGraphStatus = 'unknown';
      knowledgeGraphDetail = 'Knowledge graph not accessible';
    }

    // Step 3: Retrieval Indexing
    let retrievalStatus: 'completed' | 'pending' | 'unknown' = 'pending';
    let retrievalDetail = '';
    try {
      const results = quickSearch(company.rawName, 1);
      const companyResult = results.find(r =>
        r.entityId === company.id || r.entityType === 'company'
      );
      if (companyResult) {
        retrievalStatus = 'completed';
        retrievalDetail = `Indexed (fusedScore: ${companyResult.fusedScore?.toFixed(3)})`;
      } else {
        retrievalDetail = 'Not found in retrieval index';
      }
    } catch {
      retrievalStatus = 'unknown';
      retrievalDetail = 'Retrieval engine not accessible';
    }

    // Step 4: Memory Creation
    let memoryStatus: 'completed' | 'pending' | 'unknown' = 'pending';
    let memoryDetail = '';
    let memoryCount = 0;
    try {
      const memResults = await searchMemories({
        query: company.rawName,
        minConfidence: 0.3,
        scopeEntityType: 'company',
        scopeEntityId: company.id,
      });
      const companyMems = memResults.filter(m =>
        m.memory.scope !== 'global' &&
        (m.memory.scope as { entityType: string; entityId: string }).entityType === 'company' &&
        (m.memory.scope as { entityType: string; entityId: string }).entityId === company.id
      );
      memoryCount = companyMems.length;
      if (memoryCount > 0) {
        memoryStatus = 'completed';
        memoryDetail = `${memoryCount} memories (enterprise: ${companyMems.filter(m => m.memory.layer === 'enterprise').length}, working: ${companyMems.filter(m => m.memory.layer === 'working').length})`;
      } else {
        memoryDetail = 'No enterprise memories found';
      }
    } catch {
      memoryStatus = 'unknown';
      memoryDetail = 'Memory system not accessible';
    }

    // Step 5: Signal Extraction
    const signalCount = company._count.signals;
    const evidenceCount = company._count.evidence;
    const hasResearchCard = !!company.researchCard;
    const signalExtractionStatus = company.lastEnrichedAt
      ? 'completed' as const
      : 'pending' as const;
    const signalExtractionDetail = company.lastEnrichedAt
      ? `${signalCount} signals, ${evidenceCount} evidence items, research=${hasResearchCard ? 'yes' : 'no'}. Last enriched: ${company.lastEnrichedAt.toISOString()}`
      : 'Not yet enriched — no signals extracted';

    // Step 6: Confidence Scoring
    let confidenceStatus: 'completed' | 'pending' | 'unknown' = 'pending';
    let confidenceScore = 0;
    let confidenceGrade = 'F';
    let confidenceDetail = '';
    try {
      const daysSinceEnrichment = company.lastEnrichedAt
        ? Math.floor((Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const result = computeUnifiedConfidence({
        entityId: company.id,
        entityType: 'company',
        fieldConfidence: {
          name: 1.0,
          domain: company.domain ? 0.9 : 0.2,
          industry: company.industry ? 0.8 : 0.1,
          size: company.sizeRange ? 0.7 : 0.1,
          location: company.location ? 0.8 : 0.1,
          contacts: Math.min(1.0, company._count.contacts / 5),
        },
        dataCompleteness: [
          company.rawName ? 1 : 0,
          company.domain ? 1 : 0,
          company.industry ? 1 : 0,
          company.location ? 1 : 0,
          company._count.contacts > 0 ? 1 : 0,
          hasResearchCard ? 1 : 0,
          signalCount > 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0) / 7,
        sources: company.source === 'manual'
          ? [{ name: 'manual_entry', reliability: 0.95, type: 'internal' }]
          : [{ name: 'data_import', reliability: 0.75, type: 'csv_import' }],
        averageSourceReliability: company.source === 'manual' ? 0.95 : 0.75,
        daysSinceResearch: daysSinceEnrichment,
        freshnessScore: company.lastEnrichedAt ? Math.max(0, 100 - daysSinceEnrichment * 2) : 0,
        crossValidatedFacts: hasResearchCard ? 3 : 0,
        totalFacts: hasResearchCard ? 5 : 1,
        contradictions: 0,
        evidenceCount,
        evidenceCoverage: signalCount > 0 ? Math.min(1.0, evidenceCount / 5) : 0,
        coveredDimensions: [
          company.rawName ? 1 : 0,
          company.domain ? 1 : 0,
          company.industry ? 1 : 0,
          company.sizeRange ? 1 : 0,
          company.location ? 1 : 0,
          company._count.contacts > 0 ? 1 : 0,
          signalCount > 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0),
        expectedDimensions: 7,
        evidenceGaps: [
          !company.domain ? 1 : 0,
          !company.industry ? 1 : 0,
          signalCount === 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0),
        aiOutputConfidence: signalCount > 0 ? 0.8 : 0.5,
        hallucinationRiskScore: signalCount > 0 ? 15 : 40,
        qualityGateScore: signalCount > 0 ? 85 : 50,
      });

      confidenceScore = result.score;
      confidenceGrade = result.grade;
      confidenceStatus = 'completed';
      confidenceDetail = `${result.summary}${result.recommendations.length > 0 ? '. Recommendations: ' + result.recommendations.slice(0, 2).join('; ') : ''}`;
    } catch (err) {
      confidenceStatus = 'unknown';
      confidenceDetail = `Confidence calculation failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // ── Overall status ──
    const steps = [
      { step: 'entity_resolution', label: 'Entity Resolution', status: entityResolutionStatus, detail: entityResolutionDetail },
      { step: 'knowledge_graph', label: 'Knowledge Graph', status: knowledgeGraphStatus, detail: knowledgeGraphDetail },
      { step: 'retrieval_indexing', label: 'Retrieval Index', status: retrievalStatus, detail: retrievalDetail },
      { step: 'memory_creation', label: 'Memory Context', status: memoryStatus, detail: memoryDetail },
      { step: 'signal_extraction', label: 'Signal Intelligence', status: signalExtractionStatus, detail: signalExtractionDetail },
      { step: 'confidence_scoring', label: 'Confidence Score', status: confidenceStatus, detail: confidenceDetail },
    ];

    const completedCount = steps.filter(s => s.status === 'completed').length;
    const overallStatus = completedCount >= 5 ? 'activated' : completedCount >= 3 ? 'partial' : completedCount > 0 ? 'processing' : 'pending';

    return NextResponse.json({
      companyId: company.id,
      companyName: company.rawName,
      overallStatus, // 'activated' | 'partial' | 'processing' | 'pending'
      activationLevel: completedCount, // 0-6
      lastEnrichedAt: company.lastEnrichedAt,
      source: company.source,
      confidence: {
        score: confidenceScore,
        grade: confidenceGrade,
      },
      intelligenceSummary: {
        signals: signalCount,
        evidence: evidenceCount,
        contacts: company._count.contacts,
        hasResearchCard,
        kgNodes: kgNodeCount,
        kgEdges: kgEdgeCount,
        memories: memoryCount,
      },
      steps,
    });
  } catch (error) {
    logger.error('[ActivationStatus] Failed:', { error, companyId: id });
    return NextResponse.json({ error: 'Failed to fetch activation status' }, { status: 500 });
  }
}
