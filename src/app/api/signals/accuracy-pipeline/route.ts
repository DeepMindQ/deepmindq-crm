/**
 * Signal Accuracy Pipeline API
 *
 * Runs the complete signal accuracy hardening pipeline for a company:
 *   1. Meaning Inference — populate meaningCategory on all signals
 *   2. Validation — classify signals as VALID/WEAK/CONFLICTING/EXPIRED
 *   3. Contradiction Detection — find conflicting signals
 *
 * POST /api/signals/accuracy-pipeline
 *   { companyId: string }
 *
 * Returns combined results from all three stages.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inferSignalMeaning, batchInferMeaning } from '@/lib/research-engine/signal-meaning';
import { validateCompanySignals, getSignalValidationSummary } from '@/lib/signal-validation';
import { detectContradictions } from '@/lib/contradiction-detection';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 },
      );
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 },
      );
    }

    const startTime = Date.now();
    const pipelineResults: Record<string, unknown> = {};

    // ── Stage 1: Meaning Inference ──
    // Populate meaningCategory on all signals that lack it
    try {
      const signalsNeedingMeaning = await db.companySignal.findMany({
        where: {
          companyId,
          OR: [
            { meaningCategory: null },
            { meaningCategory: 'unknown' },
          ],
        },
        select: {
          id: true,
          signalType: true,
          severity: true,
          impact: true,
          opportunityType: true,
          title: true,
          description: true,
          meaningCategory: true,
        },
      });

      const batchResult = batchInferMeaning(signalsNeedingMeaning);
      let meaningUpdated = 0;

      for (const result of batchResult.results) {
        await db.companySignal.update({
          where: { id: result.signalId },
          data: { meaningCategory: result.newCategory as any },
        });
        meaningUpdated++;
      }

      pipelineResults.meaningInference = {
        signalsScanned: signalsNeedingMeaning.length,
        meaningsAssigned: meaningUpdated,
        results: batchResult.results.map(r => ({
          signalId: r.signalId,
          previousCategory: r.previousCategory,
          newCategory: r.newCategory,
          confidence: r.confidence,
        })),
      };
    } catch (err) {
      logger.warn('[accuracy-pipeline] Meaning inference failed:', 
        { error: err instanceof Error ? err.message : String(err) });
      pipelineResults.meaningInference = { error: 'failed', reason: String(err) };
    }

    // ── Stage 2: Signal Validation ──
    // Classify all signals as VALID/WEAK/CONFLICTING/EXPIRED
    try {
      const validationResult = await validateCompanySignals(companyId);
      pipelineResults.validation = {
        signalsValidated: validationResult.validated,
        results: validationResult.results.map(r => ({
          signalId: r.signalId,
          status: r.validationStatus,
          confidence: r.confidenceScore,
          reason: r.reason,
          evidenceCount: r.evidenceCount,
          sourceDomainCount: r.sourceDomainCount,
          signalAge: r.signalAge,
        })),
      };

      // Get summary
      const summary = await getSignalValidationSummary(companyId);
      pipelineResults.validationSummary = summary;
    } catch (err) {
      logger.warn('[accuracy-pipeline] Validation failed:', 
        { error: err instanceof Error ? err.message : String(err) });
      pipelineResults.validation = { error: 'failed', reason: String(err) };
    }

    // ── Stage 3: Contradiction Detection ──
    // Find conflicting signals
    try {
      const contradictionResult = await detectContradictions(companyId);
      pipelineResults.contradictions = {
        conflictsDetected: contradictionResult.detected,
        results: contradictionResult.results.map(r => ({
          type: r.conflictType,
          description: r.description,
          relatedSignals: r.relatedSignals,
          severity: r.severity,
        })),
      };
    } catch (err) {
      logger.warn('[accuracy-pipeline] Contradiction detection failed:', 
        { error: err instanceof Error ? err.message : String(err) });
      pipelineResults.contradictions = { error: 'failed', reason: String(err) };
    }

    return NextResponse.json({
      companyId,
      companyName: company.rawName,
      pipeline: pipelineResults,
      durationMs: Date.now() - startTime,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[accuracy-pipeline] Pipeline failed:', 
      { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: 'Pipeline execution failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
