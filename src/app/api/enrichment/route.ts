/**
 * Task 4.7 — Unified Enrichment API
 *
 * Routes:
 *   POST /api/enrichment/company    — enrich a company by { companyId } or { domain }
 *   POST /api/enrichment/contact    — enrich a contact by { contactId } or { email }
 *   POST /api/enrichment/batch      — batch enrich: { entityType, entityIds }
 *   GET  /api/enrichment/jobs       — list recent enrichment jobs
 *   GET  /api/enrichment/providers  — list available providers with credit status
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  enrichCompany,
  enrichContact,
  enrichBatch,
  getRecentJobs,
  getProviderStatuses,
  registerProvider,
} from '@/lib/enrichment/enrichment-orchestrator';
import { clearbitProvider } from '@/lib/enrichment/providers/clearbit-provider';
import { apolloProvider } from '@/lib/enrichment/providers/apollo-provider';
import type { EnrichmentEntityType } from '@/lib/enrichment/enrichment-provider';

// ─── Register Providers (lazy — only once) ───────────────────────────

let providersRegistered = false;
function ensureProvidersRegistered() {
  if (providersRegistered) return;
  registerProvider(clearbitProvider);
  registerProvider(apolloProvider);
  providersRegistered = true;
}

// ─── Route Dispatcher ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  ensureProvidersRegistered();

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // POST /api/enrichment/company
    if (pathname.endsWith('/enrichment/company')) {
      return handleEnrichCompany(request);
    }

    // POST /api/enrichment/contact
    if (pathname.endsWith('/enrichment/contact')) {
      return handleEnrichContact(request);
    }

    // POST /api/enrichment/batch
    if (pathname.endsWith('/enrichment/batch')) {
      return handleEnrichBatch(request);
    }

    return apiError('Unknown enrichment endpoint', 404);
  } catch (err) {
    logger.error('[enrichment/api] POST error', { error: err });
    return apiError('Enrichment request failed', 500);
  }
}

export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  ensureProvidersRegistered();

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // GET /api/enrichment/providers
    if (pathname.endsWith('/enrichment/providers')) {
      return handleGetProviders();
    }

    // GET /api/enrichment/jobs
    if (pathname.endsWith('/enrichment/jobs')) {
      return handleGetJobs(request);
    }

    return apiError('Unknown enrichment endpoint', 404);
  } catch (err) {
    logger.error('[enrichment/api] GET error', { error: err });
    return apiError('Enrichment request failed', 500);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

async function handleEnrichCompany(request: NextRequest) {
  const schema = z.object({
    companyId: z.string().min(1).optional(),
    domain: z.string().min(1).optional(),
  }).refine(d => d.companyId || d.domain, {
    message: 'companyId or domain is required',
  });

  const body = await request.json();
  const parsed = validateBody(schema, body);
  if (parsed instanceof Response) return parsed;

  const { companyId, domain } = parsed;

  // If domain is provided, look up companyId from domain
  let targetCompanyId = companyId;
  if (!targetCompanyId && domain) {
    const { db } = await import('@/lib/db');
    const company = await db.company.findFirst({
      where: { domain: domain.toLowerCase() },
      select: { id: true },
    });
    if (!company) return apiError('Company not found for domain', 404);
    targetCompanyId = company.id;
  }

  const result = await enrichCompany(targetCompanyId!);

  if (!result.success) {
    return apiError(result.error || 'Enrichment failed', 400);
  }

  return apiSuccess({
    jobId: result.jobId,
    provider: result.result?.provider,
    confidence: result.result?.confidence,
    data: result.result?.data,
  });
}

async function handleEnrichContact(request: NextRequest) {
  const schema = z.object({
    contactId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  }).refine(d => d.contactId || d.email, {
    message: 'contactId or email is required',
  });

  const body = await request.json();
  const parsed = validateBody(schema, body);
  if (parsed instanceof Response) return parsed;

  const { contactId, email } = parsed;

  let targetContactId = contactId;
  if (!targetContactId && email) {
    const { db } = await import('@/lib/db');
    const contact = await db.contact.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!contact) return apiError('Contact not found for email', 404);
    targetContactId = contact.id;
  }

  const result = await enrichContact(targetContactId!);

  if (!result.success) {
    return apiError(result.error || 'Enrichment failed', 400);
  }

  return apiSuccess({
    jobId: result.jobId,
    provider: result.result?.provider,
    confidence: result.result?.confidence,
    data: result.result?.data,
  });
}

async function handleEnrichBatch(request: NextRequest) {
  const schema = z.object({
    entityType: z.enum(['company', 'contact']),
    entityIds: z.array(z.string().min(1)).min(1).max(100),
  });

  const body = await request.json();
  const parsed = validateBody(schema, body);
  if (parsed instanceof Response) return parsed;

  const result = await enrichBatch(
    parsed.entityType as EnrichmentEntityType,
    parsed.entityIds,
  );

  return apiSuccess(result);
}

async function handleGetJobs(request: NextRequest) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const status = url.searchParams.get('status') || undefined;
  const entityType = url.searchParams.get('entityType') || undefined;

  const result = await getRecentJobs({ limit, offset, status, entityType });
  return apiSuccess(result);
}

async function handleGetProviders() {
  const statuses = await getProviderStatuses();
  return apiSuccess({ providers: statuses });
}
