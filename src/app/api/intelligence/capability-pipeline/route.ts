/**
 * POST /api/intelligence/capability-pipeline
 * GET  /api/intelligence/capability-pipeline
 *
 * Intelligence API — Capability Pipeline Endpoint
 *
 * Orchestrates the Internal Intelligence Graph:
 *   POST: ingest, bulk-ingest, match-signal, generate-opportunity, win-probability, run-pipeline
 *   GET:  status, search, list capabilities
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { CapabilityIntelligenceEngine, type CapabilityInput } from '@/lib/capability-intelligence-engine';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { checkApiAuth } from '@/lib/api-auth';

const EP = 'capability-pipeline';

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, EP);
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return utilityError(ctx, 400, 'Validation failed: action is required (string)', 'VALIDATION_FAILED', Date.now() - startedAt);
    }

    if (action === 'ingest') {
      const result = await CapabilityIntelligenceEngine.ingest(body.data as CapabilityInput);
      return utilitySuccess(ctx, result, EP, Date.now() - startedAt);
    }

    if (action === 'bulk-ingest') {
      const inputs = (body.data || body.capabilities || []) as CapabilityInput[];
      const result = await CapabilityIntelligenceEngine.bulkIngest(inputs);
      return utilitySuccess(ctx, result, EP, Date.now() - startedAt);
    }

    if (action === 'match-signal') {
      const matchSignalSchema = z.object({ companyId: companyIdSchema, signalId: z.string().min(1) });
      const ms = matchSignalSchema.safeParse(body);
      if (!ms.success) {
        return utilityError(ctx, 400, `Validation failed: ${ms.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
      }
      const { companyId, signalId } = ms.data;
      const result = await CapabilityIntelligenceEngine.matchSignalToCapabilities(companyId, signalId);
      return utilitySuccess(ctx, result, EP, Date.now() - startedAt);
    }

    if (action === 'generate-opportunity') {
      const genOppSchema = z.object({ companyId: companyIdSchema, signalId: z.string().min(1), capabilityMatchId: z.string().min(1) });
      const go = genOppSchema.safeParse(body);
      if (!go.success) {
        return utilityError(ctx, 400, `Validation failed: ${go.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
      }
      const { companyId, signalId, capabilityMatchId } = go.data;
      const result = await CapabilityIntelligenceEngine.generateOpportunity(companyId, signalId, capabilityMatchId);
      return utilitySuccess(ctx, result, EP, Date.now() - startedAt);
    }

    if (action === 'win-probability') {
      const wpSchema = z.object({ companyId: companyIdSchema });
      const wp = wpSchema.safeParse(body);
      if (!wp.success) {
        return utilityError(ctx, 400, `Validation failed: ${wp.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
      }
      const { companyId } = wp.data;
      const result = await CapabilityIntelligenceEngine.calculateWinProbability(companyId);
      return utilitySuccess(ctx, result, EP, Date.now() - startedAt);
    }

    if (action === 'run-pipeline') {
      const rpSchema = z.object({ companyId: companyIdSchema });
      const rp = rpSchema.safeParse(body);
      if (!rp.success) {
        return utilityError(ctx, 400, `Validation failed: ${rp.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
      }
      const { companyId } = rp.data;
      const result = await CapabilityIntelligenceEngine.runFullPipeline(companyId);
      return utilitySuccess(ctx, result, EP, Date.now() - startedAt);
    }

    return utilityError(ctx, 400, `Unknown action: ${action}. Use: ingest, bulk-ingest, match-signal, generate-opportunity, win-probability, run-pipeline`, 'INVALID_REQUEST', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Capability pipeline failed', Date.now() - startedAt);
  }
}

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, EP);
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const action = request.nextUrl.searchParams.get('action') || 'status';

    if (action === 'status') {
      const status = await CapabilityIntelligenceEngine.getGraphStatus();
      return utilitySuccess(ctx, status, EP, Date.now() - startedAt);
    }

    if (action === 'search') {
      const query = request.nextUrl.searchParams.get('q') || '';
      const topK = parseInt(request.nextUrl.searchParams.get('topK') || '5', 10);
      if (!query) {
        return utilityError(ctx, 400, 'q parameter required for search', 'INVALID_REQUEST', Date.now() - startedAt);
      }
      const results = await CapabilityIntelligenceEngine.searchCapabilities(query, topK);
      return utilitySuccess(ctx, { query, results }, EP, Date.now() - startedAt);
    }

    if (action === 'list') {
      const category = request.nextUrl.searchParams.get('category') || undefined;
      const assets = await CapabilityIntelligenceEngine.getAssets(category);
      return utilitySuccess(ctx, assets, EP, Date.now() - startedAt);
    }

    return utilityError(ctx, 400, `Unknown action: ${action}. Use: status, search, list`, 'INVALID_REQUEST', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Capability pipeline failed', Date.now() - startedAt);
  }
}
