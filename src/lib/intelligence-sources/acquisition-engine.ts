/**
 * Phase 7.5: Acquisition Engine — Orchestrator
 *
 * Ties connectors → company resolution → intelligence objects →
 * knowledge fabric → evidence adapter.
 * This is the main pipeline coordinator.
 */

import { db } from '@/lib/db';
import { RawIntelligenceObject, SOURCE_RELIABILITY } from './types';
import { resolveCompany, createUnverifiedCompany } from './company-resolution';
import { adaptToEvidence } from './evidence-adapter';
import { createKnowledgeEntry } from './knowledge-fabric';
import { intelligenceObjectToSignalInput, createSignalFromIntelligenceObject } from './signal-creator';
import type { IConnector } from './connector-interface';

export interface AcquisitionContext {
  connectorId: string;
  connectorRunId: string;
  connector: IConnector;
  defaultCategory?: string;
}

export interface ProcessingOutcome {
  success: boolean;
  intelligenceObjectId?: string;
  knowledgeEntryId?: string;
  evidenceId?: string;
  error?: string;
  companyCreated?: boolean;
}

/**
 * Process a single raw intelligence object through the full pipeline:
 * Company Resolution → IntelligenceObject → KnowledgeEntry → Evidence
 */
export async function processIntelligenceObject(
  raw: RawIntelligenceObject,
  ctx: AcquisitionContext
): Promise<ProcessingOutcome> {
  try {
    // Step 1: Company Resolution
    const resolution = await resolveCompany(raw.companyIdentifier);

    let companyId: string;
    let companyCreated = false;

    if (resolution.resolved && resolution.candidate) {
      companyId = resolution.candidate.companyId;
    } else if (resolution.needsNewCompany) {
      const newCompany = await createUnverifiedCompany(raw.companyIdentifier);
      companyId = newCompany.id;
      companyCreated = true;
    } else {
      // Ambiguous — requires user confirmation
      return {
        success: false,
        error: `Ambiguous company match for "${raw.companyIdentifier}": ${resolution.candidates?.map(c => `${c.name} (${Math.round(c.confidence * 100)}%)`).join(', ') ?? 'none'}`,
      };
    }

    // Step 2: Create IntelligenceObject
    const sourceType = ctx.connector.sourceType;
    const confidence = SOURCE_RELIABILITY[sourceType] ?? 0.5;

    const intelObj = await db.intelligenceObject.create({
      data: {
        companyId,
        connectorId: ctx.connectorId,
        connectorRunId: ctx.connectorRunId,
        sourceType,
        sourceName: ctx.connector.name,
        origin: `${sourceType}_upload`,
        content: raw.content,
        summary: raw.summary,
        metadata: JSON.stringify(raw.metadata || {}),
        sourceUrl: raw.sourceUrl,
        capturedAt: raw.capturedAt || new Date(),
        originalConfidence: confidence,
        confidenceBreakdown: JSON.stringify({
          sourceQuality: confidence,
          freshness: 1.0,
          validation: 1.0,
          evidenceAgreement: 0.5,
        }),
        status: 'processing',
      },
    });

    // Step 3: Create Knowledge Entry (non-fatal failure)
    const category = raw.category || ctx.defaultCategory || 'Strategy';
    let knowledgeEntryId: string | undefined;
    try {
      const ke = await createKnowledgeEntry({
        companyId,
        category,
        content: raw.content,
        source: `${sourceType}:${raw.sourceUrl || 'upload'}`,
        intelligenceObjectId: intelObj.id,
        confidence,
      });
      knowledgeEntryId = ke.id;
    } catch (keError) {
      console.warn('Knowledge entry creation failed:', keError);
    }

    // Step 4: Evidence Adapter
    let evidenceId: string | undefined;
    const evidenceResult = await adaptToEvidence({
      intelligenceObjectId: intelObj.id,
      companyId,
      sourceType,
      sourceName: ctx.connector.name,
      sourceUrl: raw.sourceUrl,
      content: raw.content,
      summary: raw.summary,
      capturedAt: raw.capturedAt || new Date(),
      originalConfidence: confidence,
      metadata: raw.metadata || {},
    });

    if (evidenceResult.success && evidenceResult.evidenceId) {
      evidenceId = evidenceResult.evidenceId;
      await db.intelligenceObject.update({
        where: { id: intelObj.id },
        data: { status: 'active', evidenceId },
      });
    } else {
      await db.intelligenceObject.update({
        where: { id: intelObj.id },
        data: { status: 'pending_evidence_mapping' },
      });
    }

    // Step 5 (Wave 8B): Create CompanySignal from IntelligenceObject
    const signalInput = intelligenceObjectToSignalInput({
      companyId,
      content: raw.content,
      summary: raw.summary ?? null,
      sourceType,
      sourceName: ctx.connector.name,
      sourceUrl: raw.sourceUrl ?? null,
      originalConfidence: confidence,
      capturedAt: raw.capturedAt || new Date(),
      metadata: JSON.stringify(raw.metadata || {}),
    })
    createSignalFromIntelligenceObject(signalInput).catch(err =>
      console.warn(`[acquisition] Signal creation failed for company ${companyId}:`, err)
    )

    // Update run and connector counters
    await db.connectorRun.update({
      where: { id: ctx.connectorRunId },
      data: { recordsAcquired: { increment: 1 } },
    });
    await db.connector.update({
      where: { id: ctx.connectorId },
      data: { recordsAcquired: { increment: 1 } },
    });

    return {
      success: true,
      intelligenceObjectId: intelObj.id,
      knowledgeEntryId,
      evidenceId,
      companyCreated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    return { success: false, error: message };
  }
}

/**
 * Process all raw objects from a connector acquisition result.
 */
export async function processAcquisitionResult(
  result: { intelligenceObjects: RawIntelligenceObject[]; errors: string[]; metadata: Record<string, unknown> },
  ctx: AcquisitionContext
) {
  const outcomes: ProcessingOutcome[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const raw of result.intelligenceObjects) {
    const outcome = await processIntelligenceObject(raw, ctx);
    outcomes.push(outcome);
    if (outcome.success) successCount++;
    else failCount++;
  }

  // Update run with final counts
  await db.connectorRun.update({
    where: { id: ctx.connectorRunId },
    data: {
      recordsAcquired: successCount,
      errorsCount: failCount + result.errors.length,
      metadata: JSON.stringify(result.metadata),
    },
  });

  return { outcomes, successCount, failCount, totalErrors: result.errors.length };
}
