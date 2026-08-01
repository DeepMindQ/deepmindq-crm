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
  runGovernanceMetadata,
  SECURITY_HEADERS,
} from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type { IntelligenceBriefOutput, IntelligenceBrief, IntelligenceInclude } from '@/lib/intelligence-api/types';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';

const VALID_BRIEF_TYPES = new Set<BriefType>([
  'account_brief',
  'deal_strategy',
  'exec_summary',
  'contact_brief',
  'opportunity_brief',
]);

const briefTypeSchema = z.enum(['account_brief', 'deal_strategy', 'exec_summary', 'contact_brief', 'opportunity_brief']);
const depthSchema = z.enum(['standard', 'deep']);
const audienceSchema = z.enum(['executive', 'analyst', 'sales']).optional();

/** Strip dangerous HTML/JS from AI-generated content to prevent XSS */
function sanitizeMarkdown(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/** Validate focusAreas — only allow alphanumeric, hyphens, underscores */
const focusAreaSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Focus area contains invalid characters');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'brief');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders, includes } = guardResult;

  // ── Parse & validate brief-specific query params BEFORE governance ─────────
  const briefTypeResult = briefTypeSchema.safeParse(request.nextUrl.searchParams.get('briefType'));
  const briefType = briefTypeResult.success ? briefTypeResult.data : 'account_brief';

  const depthResult = depthSchema.safeParse(request.nextUrl.searchParams.get('depth'));
  const depth: BriefDepth = depthResult.success ? depthResult.data : 'deep';

  const audienceResult = audienceSchema.safeParse(request.nextUrl.searchParams.get('audience'));
  const audience = audienceResult.success ? audienceResult.data : undefined;

  const focusAreasRaw = request.nextUrl.searchParams.get('focusAreas');
  let focusAreas: string[] | undefined;
  if (focusAreasRaw) {
    const parts = focusAreasRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    // C3: Validate each focus area against safe pattern
    const invalidAreas = parts.filter(p => !focusAreaSchema.safeParse(p).success);
    if (invalidAreas.length > 0) {
      return Response.json(
        createErrorResponse('brief', companyId, `Invalid focusAreas: ${invalidAreas.join(', ')}. Only alphanumeric, hyphens, underscores allowed.`, IntelligenceErrors.VALIDATION_FAILED, Date.now() - startedAt, includes),
        { status: 400, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
      );
    }
    focusAreas = parts;
  }

  if (request.nextUrl.searchParams.has('briefType') && !briefTypeResult.success) {
    return Response.json(
      createErrorResponse('brief', companyId, `Invalid briefType: ${briefTypeResult.error.issues[0]?.message || 'unknown'}. Must be one of: ${Array.from(VALID_BRIEF_TYPES).join(', ')}`, IntelligenceErrors.VALIDATION_FAILED, Date.now() - startedAt, includes),
      { status: 400, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  // ── Governance check (uses actual briefType, not hardcoded) ─────────
  const governanceMeta = await runGovernanceMetadata(companyId, briefType);

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
      { status: 500, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (!company) {
    return Response.json(
      createErrorResponse('brief', companyId, 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, Date.now() - startedAt, includes),
      { status: 404, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
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
      { status: 502, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (!briefResult.success) {
    logger.warn('[intelligence/brief] SynthesisEngine failed', {
      companyId,
      error: briefResult.error,
    });
    return Response.json(
      createErrorResponse('brief', companyId, scrubError(briefResult.error || 'Brief generation failed'), IntelligenceErrors.ENGINE_FAILED, Date.now() - startedAt, includes),
      { status: 502, headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  // ── Step 3: Map Brief → IntelligenceBrief contract ─────────────────────
  const includeCitations = guardResult.includes.size === 0
    || shouldInclude(guardResult.includes, 'citations');

  const intelligenceBrief: IntelligenceBrief = {
    briefType: briefResult.type,
    content: sanitizeMarkdown(briefResult.content),
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
      evidenceChain: { evidences: [], aggregateConfidence: briefResult.evidenceChain.aggregateConfidence, coverage: includeCitations ? briefResult.evidenceChain.coverage : 0, gaps: [], freshnessScore: briefResult.evidenceChain.freshnessScore },
    }),
    wordCount: briefResult.wordCount,
    modelUsed: briefResult.modelUsed,
    confidence: Math.min(1, briefResult.confidence),
    durationMs: briefResult.durationMs,
    tokensUsed: briefResult.tokensUsed,
    costUsd: briefResult.costUsd,
    warnings: briefResult.warnings,
  };

  const data: IntelligenceBriefOutput = {
    companyId,
    brief: intelligenceBrief,
  };

  const freshness = computeFreshness(company);
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/brief] Brief generated', {
    companyId,
    briefType,
    wordCount: briefResult.wordCount,
    sections: briefResult.sections.length,
    citations: briefResult.citations.length,
    confidence: Math.min(1, briefResult.confidence),
    durationMs,
    freshnessLevel: freshness.level,
    warnings: briefResult.warnings.length,
  });

  return Response.json(
    createResponse('brief', companyId, data, {
      durationMs,
      includes,
      cached: false,
      confidence: Math.min(1, briefResult.confidence),
      freshness,
      requestedAt,
      respondedAt: new Date(),
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    { headers: { ...responseHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
