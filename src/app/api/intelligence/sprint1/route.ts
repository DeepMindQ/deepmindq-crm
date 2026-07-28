/**
 * Sprint 1 — Unified Intelligence API
 *
 * POST /api/intelligence/sprint1
 *
 * The single entry point for Sprint 1 intelligence collection + reasoning.
 * This API combines:
 *   1. External intelligence collection (size-adaptive)
 *   2. Mid-market sensor (for 200-5000 employee companies)
 *   3. Signal type normalization (unified 10-type taxonomy)
 *   4. Reasoning engine (evidence → understanding → recommendations)
 *   5. Adaptive intelligence density (external/internal balance)
 *
 * Request:
 *   { companyIds: string[], useAIClassification?: boolean }
 *
 * Response:
 *   { results: CompanyIntelligenceResult[], meta: {...} }
 */

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { collectIntelligenceForCompany } from '@/lib/intelligence-sources/external-intelligence-collector';
import { generateCompanyUnderstanding, type ReasoningInput, type SignalInput } from '@/lib/intelligence-sources/reasoning-engine';
import { assessSignalDensity } from '@/lib/intelligence-sources/adaptive-intelligence';

interface CompanyIntelligenceResult {
  companyId: string;
  companyName: string;
  sizeRange: string | null;
  sizeTier: string;
  collection: {
    totalSearched: number;
    evidenceCollected: number;
    signalsCreated: number;
    signalsSkipped: number;
    aiClassifiedCount: number;
    ruleClassifiedCount: number;
    duration: number;
    midMarketChannels?: Record<string, { queriesRun: number; evidenceCollected: number; signalsCreated: number }>;
  };
  density: {
    level: string;
    externalWeight: number;
    internalWeight: number;
    externalSignalCount: number;
    uniqueSignalTypes: number;
  };
  understanding: {
    executiveSummary: string;
    signalRichness: string;
    trajectory: string;
    overallConfidence: number;
    keyChanges: Array<{
      whatChanged: string;
      whyItMatters: string;
      confidence: number;
      recency: string;
      severity: string;
      recommendedAction: string;
      capabilityMatch?: string;
    }>;
    recommendedActions: Array<{
      action: string;
      reasoning: string;
      priority: string;
      stakeholder: string;
    }>;
  };
  errors: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyIds, useAIClassification = false } = body as {
      companyIds: string[];
      useAIClassification?: boolean;
    };

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'companyIds is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (companyIds.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 companies per request' },
        { status: 400 }
      );
    }

    const results: CompanyIntelligenceResult[] = [];
    const startTime = Date.now();

    for (const companyId of companyIds) {
      try {
        // Step 1: Collect intelligence (size-adaptive)
        const collection = await collectIntelligenceForCompany(companyId, {
          maxResultsPerQuery: 5,
          useAIClassification,
        });

        // Step 2: Fetch company data + existing signals for reasoning
        const company = await db.company.findUnique({
          where: { id: companyId },
          select: {
            id: true, rawName: true, domain: true, sizeRange: true, industry: true,
            _count: { select: { signals: true, contacts: true, notes: true } },
            lastEnrichedAt: true,
          },
        });

        if (!company) {
          results.push({
            companyId,
            companyName: 'Unknown',
            sizeRange: null,
            sizeTier: 'unknown',
            collection: { totalSearched: 0, evidenceCollected: 0, signalsCreated: 0, signalsSkipped: 0, aiClassifiedCount: 0, ruleClassifiedCount: 0, duration: 0 },
            density: { level: 'unknown', externalWeight: 0.5, internalWeight: 0.5, externalSignalCount: 0, uniqueSignalTypes: 0 },
            understanding: { executiveSummary: 'Company not found', signalRichness: 'desert', trajectory: 'unclear', overallConfidence: 0, keyChanges: [], recommendedActions: [] },
            errors: ['Company not found'],
          });
          continue;
        }

        // Fetch signals for reasoning engine
        const signals = await db.companySignal.findMany({
          where: { companyId, status: { notIn: ['archived', 'expired'] } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        // Fetch capabilities for capability matching
        const capabilities = await db.capabilityAsset.findMany({
          where: { isActive: true },
          select: { id: true, title: true, category: true, summary: true },
          take: 20,
        });

        // Step 3: Assess signal density
        const signalInputs: SignalInput[] = signals.map(s => ({
          id: s.id,
          signalType: s.signalType,
          title: s.title,
          description: s.description,
          severity: s.severity,
          confidence: s.confidence,
          signalDate: s.signalDate?.toISOString() || null,
          createdAt: s.createdAt.toISOString(),
          sourceUrl: s.sourceUrl,
          source: s.source,
          sourceQuality: s.sourceQuality,
          businessImpact: s.businessImpact,
          recommendedAction: s.recommendedAction,
          timingWindow: s.timingWindow,
          meaningCategory: s.meaningCategory,
        }));

        const density = assessSignalDensity(signalInputs, {
          contactCount: company._count.contacts,
          existingNotes: company._count.notes,
        });

        // Step 4: Generate understanding
        const reasoningInput: ReasoningInput = {
          companyId,
          companyName: company.rawName,
          domain: company.domain,
          industry: company.industry,
          sizeRange: company.sizeRange,
          signals: signalInputs,
          internalContext: {
            contactCount: company._count.contacts,
            existingNotes: company._count.notes,
          },
          capabilities: capabilities.map(c => ({
            id: c.id,
            title: c.title,
            category: c.category,
            description: c.summary || undefined,
          })),
        };

        const understanding = generateCompanyUnderstanding(reasoningInput);

        results.push({
          companyId,
          companyName: company.rawName,
          sizeRange: company.sizeRange,
          sizeTier: collection.companySizeTier,
          collection: {
            totalSearched: collection.totalSearched,
            evidenceCollected: collection.evidenceCollected,
            signalsCreated: collection.signalsCreated,
            signalsSkipped: collection.signalsSkipped,
            aiClassifiedCount: collection.aiClassifiedCount,
            ruleClassifiedCount: collection.ruleClassifiedCount,
            duration: collection.duration,
            midMarketChannels: collection.midMarketChannels as any,
          },
          density: {
            level: density.density,
            externalWeight: density.externalWeight,
            internalWeight: density.internalWeight,
            externalSignalCount: density.externalSignalCount,
            uniqueSignalTypes: density.uniqueSignalTypes,
          },
          understanding: {
            executiveSummary: understanding.executiveSummary,
            signalRichness: understanding.signalRichness,
            trajectory: understanding.trajectory,
            overallConfidence: understanding.overallConfidence,
            keyChanges: understanding.keyChanges.map(c => ({
              whatChanged: c.whatChanged,
              whyItMatters: c.whyItMatters,
              confidence: c.confidence,
              recency: c.recency,
              severity: c.severity,
              recommendedAction: c.recommendedAction,
              capabilityMatch: c.capabilityMatch,
            })),
            recommendedActions: understanding.recommendedActions.map(a => ({
              action: a.action,
              reasoning: a.reasoning,
              priority: a.priority,
              stakeholder: a.stakeholder,
            })),
          },
          errors: collection.errors,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push({
          companyId,
          companyName: 'Error',
          sizeRange: null,
          sizeTier: 'error',
          collection: { totalSearched: 0, evidenceCollected: 0, signalsCreated: 0, signalsSkipped: 0, aiClassifiedCount: 0, ruleClassifiedCount: 0, duration: 0 },
          density: { level: 'unknown', externalWeight: 0.5, internalWeight: 0.5, externalSignalCount: 0, uniqueSignalTypes: 0 },
          understanding: { executiveSummary: `Error processing company: ${msg}`, signalRichness: 'desert', trajectory: 'unclear', overallConfidence: 0, keyChanges: [], recommendedActions: [] },
          errors: [msg],
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      results,
      meta: {
        totalDuration,
        companiesProcessed: results.length,
        totalSignalsCreated: results.reduce((sum, r) => sum + r.collection.signalsCreated, 0),
        totalEvidenceCollected: results.reduce((sum, r) => sum + r.collection.evidenceCollected, 0),
        aiClassificationUsed: useAIClassification,
        sprint: 1,
        version: '1.0',
      },
    });
  } catch (error) {
    console.error('[sprint1-api] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process Sprint 1 intelligence' },
      { status: 500 }
    );
  }
}
