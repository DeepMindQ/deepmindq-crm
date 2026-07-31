/**
 * GET /api/intelligence/brief/{id}
 *
 * Intelligence API — Brief Endpoint
 *
 * Generates an evidence-grounded brief for a company using the SynthesisEngine.
 * Replaces the legacy POST /api/engines/brief route with the Intelligence API
 * contract layer (IntelligenceResponse envelope, ?include= support, freshness).
 *
 * Query params:
 *   ?briefType=account_brief|deal_strategy|exec_summary|contact_brief|opportunity_brief
 *   ?depth=standard|deep
 *   ?audience=executive|analyst|sales
 *   ?focusAreas=funding,tech_stack
 *
 * Non-throwing: always returns IntelligenceResponse envelope.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { SynthesisEngine } from '@/lib/engines/synthesis-engine';
import type { BriefType, BriefDepth } from '@/lib/engines/synthesis-engine';
import {
  createResponse,
  createErrorResponse,
  computeFreshness,
  shouldInclude,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceBriefOutput, IntelligenceBrief, IntelligenceInclude } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';
import { runGovernanceChecks } from '@/lib/ai-governance';
import { getResearchContext } from '@/lib/intelligence-contract';

const VALID_BRIEF_TYPES = new Set<BriefType>([
  'account_brief',
  'deal_strategy',
  'exec_summary',
  'contact_brief',
  'opportunity_brief',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'brief');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  // Ticket 3: Run real governance check for response metadata (requires DB)
  let governanceMeta: { passed: boolean; generationType: string; checks: Record<string, { passed: boolean; message: string }> } | undefined;
  try {
    // Only run governance check against real PostgreSQL — skip for file-based/test DBs
    if (process.env.DATABASE_URL?.startsWith('postgres')) {
      const researchCtx = await getResearchContext(companyId);
      const govResult = await runGovernanceChecks({ companyId, generationType: 'account_brief', researchContext: researchCtx });
      governanceMeta = {
        passed: govResult.passed,
        generationType: 'account_brief',
        checks: Object.fromEntries(Object.entries(govResult.checks).map(([k, v]) => [k, { passed: v.passed, message: v.message }])),
      };
    }
  } catch {
    // Governance metadata is optional — degrade gracefully
  }

  // Parse brief-specific query params
  const briefType = (request.nextUrl.searchParams.get('briefType') as BriefType) || 'account_brief';
  const depth = (request.nextUrl.searchParams.get('depth') as BriefDepth) || 'deep';
  const audience = (request.nextUrl.searchParams.get('audience') as 'executive' | 'analyst' | 'sales' | null) || undefined;
  const focusAreasRaw = request.nextUrl.searchParams.get('focusAreas');
  const focusAreas = focusAreasRaw ? focusAreasRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;

  if (!VALID_BRIEF_TYPES.has(briefType)) {
    return Response.json(
      createErrorResponse('brief', companyId, `Invalid briefType: ${briefType}. Must be one of: ${Array.from(VALID_BRIEF_TYPES).join(', ')}`, IntelligenceErrors.VALIDATION_FAILED, Date.now() - startedAt, includes),
      { status: 400, headers: responseHeaders },
    );
  }

  logger.info('[intelligence/brief] Processing', {
    companyId,
    correlationId,
    briefType,
    depth,
    audience,
    focusAreas,
    includes: Array.from(includes),
  });

  // ── Step 1: Load company from DB (for freshness) ────────────────────────
  let company: Record<string, unknown> | null = null;
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        lastEnrichedAt: true,
        lastActivityAt: true,
      },
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/brief] DB lookup failed', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('brief', companyId, `Company lookup failed: ${scrubError(rawMessage)}`, IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, Date.now() - startedAt, includes),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('brief', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, includes),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Run SynthesisEngine ────────────────────────────────────────
  let briefResult: Awaited<ReturnType<typeof SynthesisEngine.generate>>;
  try {
    briefResult = await SynthesisEngine.generate({
      briefType,
      context: { companyId },
      depth,
      audience,
      focusAreas,
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    logger.warn('[intelligence/brief] SynthesisEngine threw', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse('brief', companyId, scrubError(rawMessage), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
      { status: 502, headers: responseHeaders },
    );
  }

  if (!briefResult.success) {
    logger.warn('[intelligence/brief] SynthesisEngine failed', {
      companyId,
      error: briefResult.error,
    });
    return Response.json(
      createErrorResponse('brief', companyId, scrubError(briefResult.error || 'Brief generation failed'), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
      { status: 502, headers: responseHeaders },
    );
  }

  // ── Step 3: Map Brief → IntelligenceBrief contract ─────────────────────
  // ?include=citations controls whether full evidence chain + citations are included.
  // Default (no includes) returns a lightweight brief with just content + sections.
  const includeCitations = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'citations' as IntelligenceInclude);

  const intelligenceBrief: IntelligenceBrief = {
    briefType: briefResult.type,
    content: briefResult.content,
    sections: briefResult.sections.map(s => ({
      heading: s.heading,
      body: s.body,
      confidence: s.confidence,
      citations: includeCitations ? s.citations : [],
    })),
    ...(includeCitations ? {
      citations: briefResult.citations.map(c => ({
        marker: c.marker,
        evidenceId: c.evidenceId,
        snippet: c.snippet,
        url: c.url,
      })),
      evidenceChain: {
        evidences: briefResult.evidenceChain.evidences,
        aggregateConfidence: briefResult.evidenceChain.aggregateConfidence,
        coverage: briefResult.evidenceChain.coverage,
        gaps: briefResult.evidenceChain.gaps,
        freshnessScore: briefResult.evidenceChain.freshnessScore,
      },
    } : {
      citations: [],
      evidenceChain: { evidences: [], aggregateConfidence: briefResult.evidenceChain.aggregateConfidence, coverage: 0, gaps: [], freshnessScore: briefResult.evidenceChain.freshnessScore },
    }),
    wordCount: briefResult.wordCount,
    modelUsed: briefResult.modelUsed,
    confidence: briefResult.confidence,
    durationMs: briefResult.durationMs,
    tokensUsed: briefResult.tokensUsed,
    costUsd: briefResult.costUsd,
    warnings: briefResult.warnings,
  };

  const data: IntelligenceBriefOutput = {
    companyId,
    brief: intelligenceBrief,
  };

  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/brief] Brief generated', {
    companyId,
    briefType,
    wordCount: briefResult.wordCount,
    sections: briefResult.sections.length,
    citations: briefResult.citations.length,
    confidence: briefResult.confidence,
    durationMs,
    freshnessLevel: freshness.level,
    warnings: briefResult.warnings.length,
  });

  return Response.json(
    createResponse('brief', companyId, data, {
      durationMs,
      includes,
      cached: false,
      confidence: briefResult.confidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
