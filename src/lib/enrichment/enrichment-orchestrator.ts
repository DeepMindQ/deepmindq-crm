/**
 * Task 4.7 — Enrichment Orchestrator
 *
 * Full enrichment flow orchestration:
 *   - enrichCompany(companyId) — queue → provider selection → execute → persist
 *   - enrichContact(contactId) — contact enrichment flow
 *   - enrichBatch(entityType, entityIds) — batch enrichment with progress
 *   - getEnrichmentStatus(entityType, entityId) — current enrichment status
 *
 * Persists results to CompanyResearchCard, Contact.enrichmentData,
 * PeopleProfileEnrichment, and EnrichmentJob models.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  EnrichmentProvider,
  EnrichmentResult,
  ContactEnrichmentResult,
  EnrichmentEntityType,
  ProviderStatus,
} from './enrichment-provider';
import { Prisma } from '@prisma/client';
import { EnrichmentQueue } from './enrichment-queue';

// ─── Registered Providers ────────────────────────────────────────────

let registeredProviders: EnrichmentProvider[] = [];

export function registerProvider(provider: EnrichmentProvider): void {
  const idx = registeredProviders.findIndex(p => p.id === provider.id);
  if (idx >= 0) {
    registeredProviders[idx] = provider;
  } else {
    registeredProviders.push(provider);
  }
}

export function getProviders(): EnrichmentProvider[] {
  return [...registeredProviders];
}

/**
 * Get providers sorted by priority (lower first), filtered by availability.
 */
async function getAvailableProviders(): Promise<EnrichmentProvider[]> {
  const results = await Promise.all(
    registeredProviders.map(async (p) => {
      const available = await p.isAvailable();
      return { provider: p, available };
    })
  );

  return results
    .filter(r => r.available)
    .map(r => r.provider)
    .sort((a, b) => a.priority - b.priority);
}

// ─── Queue Instance ──────────────────────────────────────────────────

const queue = new EnrichmentQueue();

// ─── Enrichment Status Result ────────────────────────────────────────

export interface EnrichmentStatusResult {
 entityType: EnrichmentEntityType;
  entityId: string;
  lastJobId?: string;
  lastJobStatus?: string;
  lastProvider?: string;
  lastConfidence?: number;
  enrichedAt?: Date;
  completedAt?: Date;
}

// ─── Company Enrichment ──────────────────────────────────────────────

export async function enrichCompany(companyId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
  result?: EnrichmentResult;
}> {
  // 1. Look up company
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, domain: true, rawName: true },
  });

  if (!company) {
    return { success: false, error: 'Company not found' };
  }

  const domain = company.domain || '';
  if (!domain) {
    return { success: false, error: 'Company has no domain' };
  }

  // 2. Create EnrichmentJob record
  const job = await db.enrichmentJob.create({
    data: {
      entityType: 'company',
      entityId: companyId,
      status: 'queued',
    },
  });

  // 3. Get available providers
  const providers = await getAvailableProviders();
  if (providers.length === 0) {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage: 'No enrichment providers available' },
    });
    return { success: false, jobId: job.id, error: 'No enrichment providers available' };
  }

  // 4. Enqueue and process
  const queueId = queue.enqueue({
    entityType: 'company',
    entityId: companyId,
    lookupKey: domain,
    providers,
  });

  if (!queueId) {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: { status: 'skipped', errorMessage: 'Deduplicated — enriched within 24h' },
    });
    return { success: false, jobId: job.id, error: 'Deduplicated — enriched within 24h' };
  }

  // Update job to processing
  await db.enrichmentJob.update({
    where: { id: job.id },
    data: { status: 'processing', startedAt: new Date() },
  });

  // 5. Process from queue
  const queueItem = await queue.processNext();

  if (!queueItem || queueItem.status === 'failed') {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: queueItem?.error || 'Queue processing failed',
        completedAt: new Date(),
      },
    });
    return {
      success: false,
      jobId: job.id,
      error: queueItem?.error || 'Queue processing failed',
    };
  }

  const result = queueItem.result as EnrichmentResult | undefined;
  if (!result) {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage: 'No result from providers', completedAt: new Date() },
    });
    return { success: false, jobId: job.id, error: 'No result from providers' };
  }

  // 6. Persist to CompanyResearchCard
  await persistCompanyEnrichment(companyId, result);

  // 7. Update job as completed
  await db.enrichmentJob.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      providerId: result.provider,
      providerName: result.provider,
      confidence: result.confidence,
      creditsUsed: result.creditsUsed,
      resultData: result.data as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  logger.info('[enrichment-orchestrator] Company enrichment completed', {
    companyId,
    provider: result.provider,
    confidence: result.confidence,
  });

  return { success: true, jobId: job.id, result };
}

// ─── Contact Enrichment ──────────────────────────────────────────────

export async function enrichContact(contactId: string): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
  result?: ContactEnrichmentResult;
}> {
  // 1. Look up contact
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { id: true, email: true, rawName: true },
  });

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  // 2. Create EnrichmentJob record
  const job = await db.enrichmentJob.create({
    data: {
      entityType: 'contact',
      entityId: contactId,
      status: 'queued',
    },
  });

  // 3. Get available providers (prefer contact-capable ones)
  const providers = await getAvailableProviders();
  if (providers.length === 0) {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage: 'No enrichment providers available' },
    });
    return { success: false, jobId: job.id, error: 'No enrichment providers available' };
  }

  // 4. Enqueue and process
  const queueId = queue.enqueue({
    entityType: 'contact',
    entityId: contactId,
    lookupKey: contact.email,
    providers,
  });

  if (!queueId) {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: { status: 'skipped', errorMessage: 'Deduplicated — enriched within 24h' },
    });
    return { success: false, jobId: job.id, error: 'Deduplicated — enriched within 24h' };
  }

  await db.enrichmentJob.update({
    where: { id: job.id },
    data: { status: 'processing', startedAt: new Date() },
  });

  // 5. Process from queue
  const queueItem = await queue.processNext();

  if (!queueItem || queueItem.status === 'failed') {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: queueItem?.error || 'Queue processing failed',
        completedAt: new Date(),
      },
    });
    return {
      success: false,
      jobId: job.id,
      error: queueItem?.error || 'Queue processing failed',
    };
  }

  const result = queueItem.result as ContactEnrichmentResult | undefined;
  if (!result) {
    await db.enrichmentJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorMessage: 'No result from providers', completedAt: new Date() },
    });
    return { success: false, jobId: job.id, error: 'No result from providers' };
  }

  // 6. Persist to Contact.enrichmentData and PeopleProfileEnrichment
  await persistContactEnrichment(contactId, result);

  // 7. Update job as completed
  await db.enrichmentJob.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      providerId: result.provider,
      providerName: result.provider,
      confidence: result.confidence,
      creditsUsed: result.creditsUsed,
      resultData: result.data as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  logger.info('[enrichment-orchestrator] Contact enrichment completed', {
    contactId,
    provider: result.provider,
    confidence: result.confidence,
  });

  return { success: true, jobId: job.id, result };
}

// ─── Batch Enrichment ────────────────────────────────────────────────

export async function enrichBatch(
  entityType: EnrichmentEntityType,
  entityIds: string[],
): Promise<{
  jobId: string;
  totalProcessed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    entityId: string;
    success: boolean;
    error?: string;
    confidence?: number;
  }>;
}> {
  const results: Array<{
    entityId: string;
    success: boolean;
    error?: string;
    confidence?: number;
  }> = [];

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  const providers = await getAvailableProviders();

  for (const entityId of entityIds) {
    if (entityType === 'company') {
      const res = await enrichCompany(entityId);
      results.push({
        entityId,
        success: res.success,
        error: res.error,
        confidence: res.result?.confidence,
      });
      if (res.success) succeeded++;
      else if (res.error?.includes('Deduplicated')) skipped++;
      else failed++;
    } else {
      const res = await enrichContact(entityId);
      results.push({
        entityId,
        success: res.success,
        error: res.error,
        confidence: res.result?.confidence,
      });
      if (res.success) succeeded++;
      else if (res.error?.includes('Deduplicated')) skipped++;
      else failed++;
    }
  }

  logger.info('[enrichment-orchestrator] Batch enrichment completed', {
    entityType,
    total: entityIds.length,
    succeeded,
    failed,
    skipped,
  });

  return {
    jobId: `batch-${Date.now()}`,
    totalProcessed: entityIds.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}

// ─── Get Enrichment Status ───────────────────────────────────────────

export async function getEnrichmentStatus(
  entityType: EnrichmentEntityType,
  entityId: string,
): Promise<EnrichmentStatusResult> {
  const job = await db.enrichmentJob.findFirst({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      providerName: true,
      confidence: true,
      completedAt: true,
      createdAt: true,
    },
  });

  return {
    entityType,
    entityId,
    lastJobId: job?.id,
    lastJobStatus: job?.status,
    lastProvider: job?.providerName ?? undefined,
    lastConfidence: job?.confidence ?? undefined,
    enrichedAt: job?.createdAt,
    completedAt: job?.completedAt ?? undefined,
  };
}

// ─── Get Provider Statuses ───────────────────────────────────────────

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const statuses = await Promise.all(
    registeredProviders.map(async (p) => {
      const available = await p.isAvailable();
      const remaining = await p.getRemainingCredits();
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        priority: p.priority,
        available,
        remainingCredits: remaining,
      };
    })
  );

  return statuses.sort((a, b) => a.priority - b.priority);
}

// ─── Get Recent Jobs ──────────────────────────────────────────────────

export async function getRecentJobs(opts?: {
  limit?: number;
  offset?: number;
  status?: string;
  entityType?: string;
}) {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.entityType) where.entityType = opts.entityType;

  const [jobs, total] = await Promise.all([
    db.enrichmentJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        providerName: true,
        status: true,
        confidence: true,
        creditsUsed: true,
        retryCount: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    db.enrichmentJob.count({ where }),
  ]);

  return { jobs, total };
}

// ─── Persistence: Company ─────────────────────────────────────────────

async function persistCompanyEnrichment(
  companyId: string,
  result: EnrichmentResult,
): Promise<void> {
  const d = result.data;

  const updateData: Record<string, Prisma.InputJsonValue | string | Date | number> = {
    enrichmentSource: `${result.provider}_verified`,
    enrichmentDate: new Date(),
  };

  if (d.description) updateData.businessOverview = d.description;
  if (d.industry) updateData.industry = d.industry;
  if (d.location) updateData.website = d.location;
  if (d.employees) updateData.employeeCount = String(d.employees);
  if (d.revenue) updateData.revenue = `$${d.revenue.toLocaleString()}`;
  if (d.technologies?.length) updateData.techStack = d.technologies;

  const socialProfiles: Record<string, string> = {};
  if (d.linkedin) socialProfiles.linkedin = d.linkedin;
  if (d.twitter) socialProfiles.twitter = d.twitter;
  if (Object.keys(socialProfiles).length > 0) {
    updateData.socialProfiles = socialProfiles;
  }

  // Compute per-field confidence
  const fieldConfidence: Record<string, number | string> = {};
  if (d.name) fieldConfidence.name = result.confidence;
  if (d.industry) fieldConfidence.industry = result.confidence;
  if (d.employees) fieldConfidence.employees = result.confidence * 0.9; // estimated
  if (d.revenue) fieldConfidence.revenue = result.confidence * 0.85;
  if (d.technologies?.length) fieldConfidence.techStack = result.confidence;
  if (d.description) fieldConfidence.businessOverview = result.confidence;
  updateData.fieldConfidence = fieldConfidence;

  const createData = { companyId, ...updateData };
  const updatePayload = updateData;

  await db.companyResearchCard.upsert({
    where: { companyId },
    create: createData as unknown as Prisma.CompanyResearchCardCreateInput,
    update: updatePayload as unknown as Prisma.CompanyResearchCardUpdateInput,
  });

  // Also update enrichment score on contacts at this company
  const score = result.provider === 'clearbit' ? 25 : 20;
  await db.contact.updateMany({
    where: { companyId },
    data: { enrichmentScore: score },
  });
}

// ─── Persistence: Contact ─────────────────────────────────────────────

async function persistContactEnrichment(
  contactId: string,
  result: ContactEnrichmentResult,
): Promise<void> {
  const d = result.data;

  // Update Contact.enrichmentData
  await db.contact.update({
    where: { id: contactId },
    data: {
      enrichmentData: {
        ...d,
        provider: result.provider,
        confidence: result.confidence,
        enrichedAt: new Date().toISOString(),
      },
      enrichmentScore: Math.round(result.confidence * 100),
      title: d.title || undefined,
      location: d.location || undefined,
      linkedinUrl: d.linkedin || undefined,
    },
  });

  // Upsert PeopleProfileEnrichment
  await db.peopleProfileEnrichment.upsert({
    where: { contactId },
    create: {
      contactId,
      headline: d.title || null,
      currentCompany: d.company || null,
      currentTitle: d.title || null,
      location: d.location || null,
      linkedinUrl: d.linkedin || null,
      sourceProvider: result.provider,
      rawProfileData: JSON.stringify(result.rawResponse),
      confidenceScore: result.confidence,
      status: 'enriched',
      enrichedAt: new Date(),
    },
    update: {
      headline: d.title || null,
      currentCompany: d.company || null,
      currentTitle: d.title || null,
      location: d.location || null,
      linkedinUrl: d.linkedin || null,
      sourceProvider: result.provider,
      rawProfileData: JSON.stringify(result.rawResponse),
      confidenceScore: result.confidence,
      status: 'enriched',
      enrichedAt: new Date(),
    },
  });
}
