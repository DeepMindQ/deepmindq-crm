/**
 * Intelligence Activation Orchestrator
 * =====================================
 * WI-17A — The bridge between data entry and the AI brain.
 *
 * MISSION: Every company/contact entering DeepMindQ should automatically
 * activate intelligence. No data should remain "dark" after creation.
 *
 * THIS MODULE DOES NOT REBUILD WI-16.
 * It orchestrates existing WI-16 engines in sequence:
 *   1. Entity Resolution     → ai-knowledge-graph (extractGraphEntities)
 *   2. Knowledge Graph Update → ai-knowledge-graph (populateGraphFromIntelligence)
 *   3. Retrieval Indexing     → ai-hybrid-retrieval (addToIndex)
 *   4. Memory Creation        → ai-memory (storeMemory)
 *   5. Signal Extraction       → intelligence-pipeline (enrichCompany)
 *   6. Confidence Scoring     → ai-unified-confidence (computeUnifiedConfidence)
 *
 * Integration Points (5 import paths + 2 creation paths):
 *   ─ /api/companies POST  → manual company creation
 *   ─ /api/contacts POST   → manual contact creation
 *   ─ /api/data-import     → ticket 11 pipeline commit
 *   ─ /api/data-import/[id] → advanced data intelligence commit
 *   ─ /api/imports         → legacy batch import
 *   ─ /api/batches         → chunked batch import
 *   ─ /api/seed            → database seeding
 *
 * Design Principles:
 *   - Non-blocking: Intelligence activation fires-and-forgets from import paths
 *   - Graceful degradation: If any AI step fails, data is still persisted
 *   - Observable: Every activation is tracked via in-memory history
 *   - No UI redesign: This is purely backend intelligence wiring
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  storeMemory,
  type MemoryLayer,
  type MemoryCategory,
  type MemoryPriority,
} from '@/lib/ai-memory';
import {
  addNode,
  addEdge,
  resolveEntity,
  extractGraphEntities,
  populateGraphFromIntelligence,
  type GraphEntityType,
  type RelationshipType,
} from '@/lib/ai-knowledge-graph';
import {
  addToIndex,
  extractEntities,
} from '@/lib/ai-hybrid-retrieval';
import { computeUnifiedConfidence } from '@/lib/ai-unified-confidence';
import { enrichCompany } from '@/lib/intelligence-pipeline';

// ─── Types ──────────────────────────────────────────────────────────────

export type ActivationTrigger =
  | 'import_legacy'
  | 'import_batch'
  | 'import_pipeline'
  | 'import_intelligence'
  | 'company_manual'
  | 'contact_manual'
  | 'seed'
  | 'webhook'
  | 'enrichment_callback'
  | 'manual_trigger';

export interface ActivationRequest {
  companyId: string;
  trigger: ActivationTrigger;
  contactIds?: string[];
  skipExpensiveSteps?: boolean;
  priority?: number;
  correlationId?: string;
}

export interface ActivationResult {
  companyId: string;
  success: boolean;
  steps: ActivationStepResult[];
  totalDurationMs: number;
  error?: string;
}

export interface ActivationStepResult {
  step: IntelligenceStep;
  status: 'completed' | 'skipped' | 'failed';
  durationMs: number;
  detail?: string;
  error?: string;
}

export type IntelligenceStep =
  | 'entity_resolution'
  | 'knowledge_graph_update'
  | 'retrieval_indexing'
  | 'memory_creation'
  | 'signal_extraction'
  | 'confidence_scoring';

export interface ActivationStats {
  totalActivations: number;
  byTrigger: Record<string, number>;
  byStepSuccess: Record<IntelligenceStep, { completed: number; failed: number; skipped: number }>;
  averageDurationMs: number;
  recentActivations: ActivationResult[];
}

// ─── Constants ───────────────────────────────────────────────────────────

const STEPS_ORDER: IntelligenceStep[] = [
  'entity_resolution',
  'knowledge_graph_update',
  'retrieval_indexing',
  'memory_creation',
  'signal_extraction',
  'confidence_scoring',
];

// ─── In-Memory Stats (app lifetime) ──────────────────────────────────────

const activationHistory: ActivationResult[] = [];
const MAX_HISTORY = 200;

// ─── Core Activation Function ──────────────────────────────────────────

/**
 * Activate intelligence for a company.
 *
 * Non-blocking per step: each step has its own try/catch.
 * Idempotent: safe to call multiple times for the same company.
 */
export async function activateIntelligence(
  request: ActivationRequest,
): Promise<ActivationResult> {
  const startTime = Date.now();
  const correlationId = request.correlationId || `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const steps: ActivationStepResult[] = [];

  logger.info(`[IntelligenceActivation] Starting activation for company ${request.companyId}`, {
    trigger: request.trigger,
    correlationId,
    contactCount: request.contactIds?.length || 0,
    skipExpensive: request.skipExpensiveSteps || false,
  });

  // Fetch company data
  let company: {
    id: string;
    rawName: string;
    normalizedName: string;
    domain: string | null;
    industry: string | null;
    sizeRange: string | null;
    location: string | null;
    country: string | null;
    website: string | null;
    status: string;
    source: string | null;
    intelligenceScore: number | null;
    lastEnrichedAt: Date | null;
    createdAt: Date;
    contacts: Array<{ id: string; rawName: string; email: string; title: string | null }>;
  } | null = null;

  try {
    company = await db.company.findUnique({
      where: { id: request.companyId },
      include: {
        contacts: {
          select: { id: true, rawName: true, email: true, title: true },
          take: 20,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[IntelligenceActivation] Failed to fetch company ${request.companyId}: ${msg}`, { correlationId });
  }

  if (!company) {
    return {
      companyId: request.companyId,
      success: false,
      steps: [],
      totalDurationMs: Date.now() - startTime,
      error: 'Company not found in database',
    };
  }

  // ── Step 1: Entity Resolution ──
  const step1Start = Date.now();
  try {
    const entityText = `${company.rawName} ${company.industry || ''} ${company.domain || ''} ${company.location || ''}`.trim();
    const entities = extractEntities(entityText);
    const existingNodes = resolveEntity(company.rawName);

    steps.push({
      step: 'entity_resolution',
      status: 'completed',
      durationMs: Date.now() - step1Start,
      detail: `Extracted ${entities.length} entities, found ${existingNodes.length} existing KG nodes`,
    });
  } catch (err) {
    steps.push({
      step: 'entity_resolution',
      status: 'failed',
      durationMs: Date.now() - step1Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 2: Knowledge Graph Update ──
  const step2Start = Date.now();
  try {
    // Extract graph entities from company text
    const companyText = `${company.rawName} ${company.industry || ''} ${company.domain || ''}`.trim();
    const graphExtractions = extractGraphEntities(companyText);

    // Add company node directly
    try {
      addNode({
        id: `company-${company.id}`,
        label: company.rawName,
        type: 'company' as GraphEntityType,
        aliases: company.domain ? [company.domain] : [],
        properties: {
          domain: company.domain,
          industry: company.industry,
          sizeRange: company.sizeRange,
          source: company.source,
        },
        source: request.trigger,
        confidence: 0.9,
      });
    } catch {
      // Node may already exist — that's fine
    }

    // Add contact nodes and employee relationships
    for (const contact of company.contacts.slice(0, 10)) {
      try {
        addNode({
          id: `person-${contact.id}`,
          label: contact.rawName,
          type: 'person' as GraphEntityType,
          aliases: [contact.email],
          properties: {
            email: contact.email,
            title: contact.title,
          },
          source: request.trigger,
          confidence: 0.85,
        });
        // Create relationship: person → employed_by → company
        addEdge({
          id: `edge-emp-${contact.id}-${company.id}`,
          sourceId: `person-${contact.id}`,
          targetId: `company-${company.id}`,
          relationship: 'employed_by' as RelationshipType,
          weight: 0.8,
          reason: `${contact.rawName} works at ${company.rawName}${contact.title ? ` as ${contact.title}` : ''}`,
          evidenceIds: [],
          confidence: 0.85,
        });
      } catch {
        // May already exist
      }
    }

    steps.push({
      step: 'knowledge_graph_update',
      status: 'completed',
      durationMs: Date.now() - step2Start,
      detail: `Extracted ${graphExtractions.length} graph entities, added company + ${Math.min(company.contacts.length, 10)} contact nodes`,
    });
  } catch (err) {
    steps.push({
      step: 'knowledge_graph_update',
      status: 'failed',
      durationMs: Date.now() - step2Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 3: Retrieval Indexing ──
  const step3Start = Date.now();
  try {
    const indexContent = [
      company.rawName,
      company.industry || '',
      company.sizeRange || '',
      company.location || '',
      company.country || '',
      company.domain || '',
      company.website || '',
    ]
      .filter(Boolean)
      .join(' ');

    addToIndex({
      id: `company-${company.id}`,
      entityId: company.id,
      entityType: 'company',
      content: indexContent,
      snippet: `${company.rawName} — ${company.industry || 'Unknown industry'}`,
      source: 'internal',
      sourceDate: null,
      sourceTier: company.source === 'manual' ? 'premium' : 'standard',
      vector: null,
      metadata: {
        companyName: company.rawName,
        domain: company.domain,
        industry: company.industry,
        source: request.trigger,
      },
    });

    // Index contacts
    for (const contact of company.contacts) {
      const contactContent = `${contact.rawName} ${contact.title || ''} ${contact.email} ${company.rawName}`.trim();
      addToIndex({
        id: `contact-${contact.id}`,
        entityId: contact.id,
        entityType: 'person',
        content: contactContent,
        snippet: `${contact.rawName} — ${contact.title || 'Unknown role'} at ${company.rawName}`,
        source: 'internal',
        sourceDate: null,
        sourceTier: 'standard',
        vector: null,
        metadata: {
          contactName: contact.rawName,
          email: contact.email,
          company: company.rawName,
          companyId: company.id,
        },
      });
    }

    steps.push({
      step: 'retrieval_indexing',
      status: 'completed',
      durationMs: Date.now() - step3Start,
      detail: `Indexed 1 company + ${company.contacts.length} contacts in retrieval engine`,
    });
  } catch (err) {
    steps.push({
      step: 'retrieval_indexing',
      status: 'failed',
      durationMs: Date.now() - step3Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 4: Memory Creation ──
  const step4Start = Date.now();
  try {
    // Company-level memory (enterprise layer)
    storeMemory({
      id: `mem-company-${company.id}-${Date.now()}`,
      layer: 'enterprise' as MemoryLayer,
      category: 'company_intelligence' as MemoryCategory,
      priority: (company.contacts.length > 3 ? 'high' : 'medium') as MemoryPriority,
      scope: { entityType: 'company', entityId: company.id },
      content: `Company "${company.rawName}" activated via ${request.trigger}. Domain: ${company.domain || 'N/A'}, Industry: ${company.industry || 'N/A'}, Size: ${company.sizeRange || 'N/A'}, Location: ${company.location || 'N/A'}, Source: ${company.source || 'N/A'}, Contacts: ${company.contacts.length}`,
      summary: `${company.rawName} — ${company.industry || 'Unknown industry'} company with ${company.contacts.length} contacts`,
      tags: ['activation', request.trigger, company.industry || 'unknown_industry', company.source || 'unknown'],
      referencedEntityIds: [company.id],
      source: { type: 'api_call', description: `Intelligence activation via ${request.trigger}` },
      confidence: 0.9,
      importance: Math.min(1.0, 0.5 + company.contacts.length * 0.1),
      lastAccessedAt: Date.now(),
      metadata: {
        trigger: request.trigger,
        domain: company.domain,
        contactCount: company.contacts.length,
        correlationId,
      },
    });

    // Contact-level memories (working layer)
    if (request.contactIds && request.contactIds.length > 0) {
      for (const contactId of request.contactIds.slice(0, 50)) {
        const contact = company.contacts.find(c => c.id === contactId);
        if (contact) {
          storeMemory({
            id: `mem-contact-${contactId}-${Date.now()}`,
            layer: 'working' as MemoryLayer,
            category: 'contact_intelligence' as MemoryCategory,
            priority: 'medium' as MemoryPriority,
            scope: { entityType: 'person', entityId: contactId },
            content: `Contact "${contact.rawName}" at ${company.rawName}. Email: ${contact.email}, Title: ${contact.title || 'N/A'}. Added via ${request.trigger}.`,
            summary: `${contact.rawName} — ${contact.title || 'Unknown role'} at ${company.rawName}`,
            tags: ['contact_activation', request.trigger],
            referencedEntityIds: [contactId, company.id],
            source: { type: 'api_call', description: `Contact activation via ${request.trigger}` },
            confidence: 0.85,
            importance: 0.5,
            lastAccessedAt: Date.now(),
            metadata: {
              company: company.rawName,
              companyId: company.id,
              trigger: request.trigger,
            },
          });
        }
      }
    }

    steps.push({
      step: 'memory_creation',
      status: 'completed',
      durationMs: Date.now() - step4Start,
      detail: `Created 1 company memory + ${request.contactIds?.length || 0} contact memories`,
    });
  } catch (err) {
    steps.push({
      step: 'memory_creation',
      status: 'failed',
      durationMs: Date.now() - step4Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 5: Signal Extraction (Expensive — Web Search + LLM) ──
  const step5Start = Date.now();
  try {
    if (request.skipExpensiveSteps) {
      steps.push({
        step: 'signal_extraction',
        status: 'skipped',
        durationMs: Date.now() - step5Start,
        detail: 'Skipped — skipExpensiveSteps is true (bulk/seed operation)',
      });
    } else if (company.lastEnrichedAt && (Date.now() - company.lastEnrichedAt.getTime() < 24 * 60 * 60 * 1000)) {
      steps.push({
        step: 'signal_extraction',
        status: 'skipped',
        durationMs: Date.now() - step5Start,
        detail: `Skipped — enriched ${Math.round((Date.now() - company.lastEnrichedAt.getTime()) / 3600000)}h ago (within 24h cooldown)`,
      });
    } else {
      const enrichResult = await enrichCompany(company.id);

      steps.push({
        step: 'signal_extraction',
        status: enrichResult.success ? 'completed' : 'failed',
        durationMs: Date.now() - step5Start,
        detail: enrichResult.success
          ? `Created ${enrichResult.signalsCreated} signals, ${enrichResult.evidenceCreated} evidence, research=${enrichResult.researchCardUpdated}, capabilities=${enrichResult.capabilitiesMatched || 0}, opportunities=${enrichResult.opportunitiesGenerated || 0}`
          : `Enrichment failed: ${enrichResult.error}`,
        error: enrichResult.success ? undefined : enrichResult.error,
      });
    }
  } catch (err) {
    steps.push({
      step: 'signal_extraction',
      status: 'failed',
      durationMs: Date.now() - step5Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 6: Confidence Scoring ──
  const step6Start = Date.now();
  try {
    const signalCount = await db.companySignal.count({
      where: { companyId: company.id },
    });
    const evidenceCount = await db.evidence.count({
      where: { companyId: company.id },
    });
    const researchCard = await db.companyResearchCard.findUnique({
      where: { companyId: company.id },
    });

    const daysSinceEnrichment = company.lastEnrichedAt
      ? Math.floor((Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const confidenceResult = computeUnifiedConfidence({
      entityId: company.id,
      entityType: 'company',
      // Data Quality (20%)
      fieldConfidence: {
        name: 1.0,
        domain: company.domain ? 0.9 : 0.2,
        industry: company.industry ? 0.8 : 0.1,
        size: company.sizeRange ? 0.7 : 0.1,
        location: company.location ? 0.8 : 0.1,
        contacts: Math.min(1.0, company.contacts.length / 5),
      },
      dataCompleteness: [
        company.rawName ? 1 : 0,
        company.domain ? 1 : 0,
        company.industry ? 1 : 0,
        company.location ? 1 : 0,
        company.contacts.length > 0 ? 1 : 0,
        researchCard ? 1 : 0,
        signalCount > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0) / 7,
      // Source Reliability (20%)
      sources: company.source === 'manual'
        ? [{ name: 'manual_entry', reliability: 0.95, type: 'internal' }]
        : [{ name: 'data_import', reliability: 0.75, type: 'csv_import' }],
      averageSourceReliability: company.source === 'manual' ? 0.95 : 0.75,
      // Freshness (15%)
      daysSinceResearch: daysSinceEnrichment,
      freshnessScore: company.lastEnrichedAt ? Math.max(0, 100 - daysSinceEnrichment * 2) : 0,
      // Cross Validation (15%)
      crossValidatedFacts: researchCard ? 3 : 0,
      totalFacts: researchCard ? 5 : 1,
      contradictions: 0,
      // Evidence Coverage (15%)
      evidenceCount,
      evidenceCoverage: signalCount > 0 ? Math.min(1.0, evidenceCount / 5) : 0,
      coveredDimensions: [
        company.rawName ? 1 : 0,
        company.domain ? 1 : 0,
        company.industry ? 1 : 0,
        company.sizeRange ? 1 : 0,
        company.location ? 1 : 0,
        company.contacts.length > 0 ? 1 : 0,
        signalCount > 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      expectedDimensions: 7,
      evidenceGaps: [
        !company.domain ? 1 : 0,
        !company.industry ? 1 : 0,
        signalCount === 0 ? 1 : 0,
      ].reduce((a, b) => a + b, 0),
      // AI Certainty (15%)
      aiOutputConfidence: signalCount > 0 ? 0.8 : 0.5,
      hallucinationRiskScore: signalCount > 0 ? 15 : 40,
      qualityGateScore: signalCount > 0 ? 85 : 50,
    });

    steps.push({
      step: 'confidence_scoring',
      status: 'completed',
      durationMs: Date.now() - step6Start,
      detail: `Confidence: ${confidenceResult.score}/100 (grade ${confidenceResult.grade}), enterpriseReady=${confidenceResult.enterpriseReady}`,
    });
  } catch (err) {
    steps.push({
      step: 'confidence_scoring',
      status: 'failed',
      durationMs: Date.now() - step6Start,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Finalize ──
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalDurationMs = Date.now() - startTime;
  const success = completedSteps >= 3 || steps.every(s => s.status === 'completed' || s.status === 'skipped');

  const result: ActivationResult = {
    companyId: request.companyId,
    success,
    steps,
    totalDurationMs,
  };

  // Track in history
  activationHistory.unshift(result);
  if (activationHistory.length > MAX_HISTORY) {
    activationHistory.pop();
  }

  logger.info(`[IntelligenceActivation] Complete for ${company.rawName}: ${completedSteps}/${steps.length} steps in ${totalDurationMs}ms`, {
    trigger: request.trigger,
    correlationId,
    success,
  });

  return result;
}

// ─── Batch Activation ──────────────────────────────────────────────────

export async function activateIntelligenceBatch(
  requests: ActivationRequest[],
  options?: {
    skipExpensiveSteps?: boolean;
    onProgress?: (completed: number, total: number, result: ActivationResult) => void;
  },
): Promise<{ results: ActivationResult[]; totalDurationMs: number }> {
  const startTime = Date.now();
  const results: ActivationResult[] = [];

  for (let i = 0; i < requests.length; i++) {
    const result = await activateIntelligence({
      ...requests[i],
      skipExpensiveSteps: options?.skipExpensiveSteps ?? requests[i].skipExpensiveSteps,
    });
    results.push(result);

    if (options?.onProgress) {
      options.onProgress(i + 1, requests.length, result);
    }
  }

  return {
    results,
    totalDurationMs: Date.now() - startTime,
  };
}

// ─── Fire-and-Forget Wrapper ───────────────────────────────────────────

export function activateIntelligenceAsync(
  request: ActivationRequest,
): void {
  activateIntelligence(request).then(result => {
    logger.info(`[IntelligenceActivation] Async activation completed for ${request.companyId}: ${result.success ? 'success' : 'partial'}`, {
      trigger: request.trigger,
      stepsCompleted: result.steps.filter(s => s.status === 'completed').length,
      totalMs: result.totalDurationMs,
    });
  }).catch(err => {
    logger.error(`[IntelligenceActivation] Async activation failed for ${request.companyId}: ${err instanceof Error ? err.message : err}`, {
      trigger: request.trigger,
    });
  });
}

// ─── Stats & Observability ─────────────────────────────────────────────

export function getActivationStats(): ActivationStats {
  const byTrigger: Record<string, number> = {};
  const byStep: Record<IntelligenceStep, { completed: number; failed: number; skipped: number }> = {
    entity_resolution: { completed: 0, failed: 0, skipped: 0 },
    knowledge_graph_update: { completed: 0, failed: 0, skipped: 0 },
    retrieval_indexing: { completed: 0, failed: 0, skipped: 0 },
    memory_creation: { completed: 0, failed: 0, skipped: 0 },
    signal_extraction: { completed: 0, failed: 0, skipped: 0 },
    confidence_scoring: { completed: 0, failed: 0, skipped: 0 },
  };

  for (const result of activationHistory) {
    for (const step of result.steps) {
      byStep[step.step][step.status]++;
    }
  }

  const totalDuration = activationHistory.reduce((sum, r) => sum + r.totalDurationMs, 0);

  return {
    totalActivations: activationHistory.length,
    byTrigger: byTrigger as Record<ActivationTrigger, number>,
    byStepSuccess: byStep,
    averageDurationMs: activationHistory.length > 0 ? Math.round(totalDuration / activationHistory.length) : 0,
    recentActivations: activationHistory.slice(0, 20),
  };
}

// ─── Health Check ─────────────────────────────────────────────────────

export async function checkIntelligenceHealth(): Promise<{
  healthy: boolean;
  components: Record<string, { available: boolean; detail: string }>;
}> {
  const components: Record<string, { available: boolean; detail: string }> = {};

  // Check Knowledge Graph
  try {
    const stats = await import('@/lib/ai-knowledge-graph').then(m => m.getGraphStats());
    components['knowledge_graph'] = { available: true, detail: `${stats.totalNodes} nodes, ${stats.totalEdges} edges` };
  } catch {
    components['knowledge_graph'] = { available: false, detail: 'Failed to access knowledge graph' };
  }

  // Check Memory
  try {
    const stats = await import('@/lib/ai-memory').then(m => m.getMemoryStats());
    components['memory'] = { available: true, detail: `${stats.totalMemories} memories` };
  } catch {
    components['memory'] = { available: false, detail: 'Failed to access memory system' };
  }

  // Check Hybrid Retrieval
  try {
    const stats = await import('@/lib/ai-hybrid-retrieval').then(m => m.getHybridStats());
    components['hybrid_retrieval'] = { available: true, detail: `${stats.totalEntries} indexed entries` };
  } catch {
    components['hybrid_retrieval'] = { available: false, detail: 'Failed to access hybrid retrieval' };
  }

  // Check Confidence Engine
  try {
    const result = await import('@/lib/ai-unified-confidence').then(m =>
      m.computeUnifiedConfidence({
        entityId: 'health-check',
        entityType: 'company',
        fieldConfidence: { test: 0.5 },
        dataCompleteness: 0.5,
        sources: [{ name: 'test', reliability: 0.5, type: 'test' }],
        averageSourceReliability: 0.5,
        daysSinceResearch: 30,
        freshnessScore: 50,
        crossValidatedFacts: 1,
        totalFacts: 2,
        contradictions: 0,
        evidenceCount: 1,
        evidenceCoverage: 0.5,
        coveredDimensions: 3,
        expectedDimensions: 7,
        evidenceGaps: 4,
        aiOutputConfidence: 0.5,
        hallucinationRiskScore: 25,
        qualityGateScore: 70,
      })
    );
    components['confidence'] = { available: true, detail: `Score: ${result.score}, grade: ${result.grade}` };
  } catch {
    components['confidence'] = { available: false, detail: 'Failed to access confidence engine' };
  }

  // Check Intelligence Pipeline
  try {
    const stats = await import('@/lib/intelligence-pipeline').then(m => m.IntelligencePipeline.getStats());
    components['intelligence_pipeline'] = { available: true, detail: `${stats.totalCompanies} companies, ${stats.enriched} enriched` };
  } catch {
    components['intelligence_pipeline'] = { available: false, detail: 'Failed to access intelligence pipeline' };
  }

  return {
    healthy: Object.values(components).every(c => c.available),
    components,
  };
}
