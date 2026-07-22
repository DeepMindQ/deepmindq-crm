/**
 * Batch Company Enrichment — Poll-Driven
 *
 * POST  /api/g-crm/companies/enrich-batch  — start batch, returns jobId
 * GET   /api/g-crm/companies/enrich-batch  — list active/recent jobs
 * GET   /api/g-crm/companies/enrich-batch/[id] — get progress + process next company
 *
 * Architecture: Client polls the job endpoint. Each poll ALSO processes
 * 1 company as a side-effect. This works within Vercel's 10s function
 * timeout because each request does at most 1 enrichment (~5-8s).
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ── In-memory job store (survives warm instances) ──

interface EnrichJob {
  id: string;
  companyIds: string[];
  processed: string[];
  failed: string[];
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  totalCompanies: number;
  force: boolean;
}

const jobs = new Map<string, EnrichJob>();

// Auto-cleanup jobs older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 2 * 60 * 60 * 1000) jobs.delete(id);
  }
}, 5 * 60 * 1000);

// ── Enrich a single company (inline, no fetch to self) ──

async function enrichOneCompany(companyId: string, force: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { webSearch, callLLM, extractJSON, findKeyPeople, getCompanyNews, tavilyAIAnswer } = await import('@/lib/zai-helpers');

    const company = await db.company.findUnique({
      where: { id: companyId },
      include: { researchCard: true },
    });

    if (!company) return { success: false, error: 'Company not found' };

    // Skip if recently enriched (unless force)
    if (!force && company.researchCard?.enrichmentDate) {
      const hoursSince = (Date.now() - new Date(company.researchCard.enrichmentDate).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        console.log(`[enrich-batch] Skipping ${company.rawName} — enriched ${hoursSince.toFixed(1)}h ago`);
        return { success: true }; // count as success, just skipped
      }
    }

    const companyName = company.rawName || company.normalizedName;

    // ── Lightweight enrichment: 2 searches + LLM (fits in 8s) ──
    const [bizResults, peopleResults] = await Promise.allSettled([
      webSearch(`${companyName} ${company.domain || ''} revenue employees industry funding 2024 2025`, 5),
      webSearch(`${companyName} CEO CTO executives leadership team`, 4),
    ]);

    const snippets: string[] = [];
    for (const result of [bizResults, peopleResults]) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        for (const r of result.value) {
          snippets.push(`[${r.title}] ${r.snippet}`);
        }
      }
    }

    const searchContext = snippets.slice(0, 20).join('\n');

    // LLM extraction
    const systemPrompt = `Extract company data from search results. Return ONLY JSON:
{"businessOverview":"2 sentences","revenue":"value or Not found","employeeCount":"value or Not found","fundingStage":"stage or Not found","techStack":"comma-sep or empty","industry":"industry","website":"url"}`;

    const userPrompt = `Company: ${companyName}\nDomain: ${company.domain || 'Unknown'}\n\nSearch Results:\n${searchContext || 'No results.'}`;

    let enrichmentData: Record<string, string> = {};

    try {
      const response = await callLLM(systemPrompt, userPrompt);
      const parsed = extractJSON(response) as Record<string, unknown> | null;
      if (parsed && typeof parsed === 'object') {
        enrichmentData = {
          businessOverview: String(parsed.businessOverview || ''),
          revenue: String(parsed.revenue || 'Not found'),
          employeeCount: String(parsed.employeeCount || 'Not found'),
          fundingStage: String(parsed.fundingStage || 'Not found'),
          techStack: String(parsed.techStack || ''),
          industry: String(parsed.industry || company.industry || 'Not found'),
          website: String(parsed.website || company.website || ''),
          socialProfiles: '{}',
          keyPeople: '[]',
          recentNews: '[]',
        };
      }
    } catch (err) {
      console.warn(`[enrich-batch] LLM failed for ${companyName}, trying Tavily AI`);
      try {
        const answer = await tavilyAIAnswer(`${companyName} revenue employees industry overview`);
        if (answer) {
          enrichmentData = {
            businessOverview: answer.slice(0, 500),
            revenue: 'Not found',
            employeeCount: 'Not found',
            fundingStage: 'Not found',
            techStack: '',
            industry: company.industry || 'Not found',
            website: company.website || '',
            socialProfiles: '{}',
            keyPeople: '[]',
            recentNews: '[]',
          };
        }
      } catch { /* final fallback below */ }
    }

    // If LLM also failed, use raw snippets
    if (!enrichmentData.businessOverview) {
      enrichmentData = {
        businessOverview: snippets.slice(0, 3).join(' ') || `${companyName} — enrichment data unavailable`,
        revenue: 'Not found',
        employeeCount: 'Not found',
        fundingStage: 'Not found',
        techStack: '',
        industry: company.industry || 'Not found',
        website: company.website || '',
        socialProfiles: '{}',
        keyPeople: '[]',
        recentNews: '[]',
      };
    }

    // Upsert research card
    await db.companyResearchCard.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        ...enrichmentData,
        enrichmentSource: 'batch_ai_web_search',
        enrichmentDate: new Date(),
      },
      update: {
        ...enrichmentData,
        enrichmentSource: 'batch_ai_web_search',
        enrichmentDate: new Date(),
      },
    });

    // Backfill company fields
    const companyUpdate: Record<string, string> = {};
    if (!company.industry && enrichmentData.industry && enrichmentData.industry !== 'Not found') {
      companyUpdate.industry = enrichmentData.industry;
    }
    if (!company.website && enrichmentData.website) {
      companyUpdate.website = enrichmentData.website;
    }
    if (Object.keys(companyUpdate).length > 0) {
      await db.company.update({ where: { id: company.id }, data: companyUpdate });
    }

    // Update contact enrichment scores
    await db.contact.updateMany({
      where: { companyId: company.id },
      data: { enrichmentScore: 50 },
    });

    console.log(`[enrich-batch] Enriched: ${companyName}`);
    return { success: true };
  } catch (err) {
    console.error(`[enrich-batch] Error enriching ${companyId}:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── POST: Start batch enrichment ──

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyIds, force = false, unenrichedOnly = false } = body as {
      companyIds?: string[];
      force?: boolean;
      unenrichedOnly?: boolean;
    };

    let targetIds = companyIds || [];

    // If no IDs provided, find companies needing enrichment
    if (targetIds.length === 0 || unenrichedOnly) {
      const unenriched = await db.company.findMany({
        where: {
          ...(unenrichedOnly ? { researchCard: null } : {}),
          ...(targetIds.length > 0 ? { id: { in: targetIds } } : {}),
        },
        select: { id: true },
        take: 500, // max 500 per batch
      });
      targetIds = unenriched.map(c => c.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'No companies to enrich' }, { status: 400 });
    }

    // Limit batch size
    if (targetIds.length > 500) {
      targetIds = targetIds.slice(0, 500);
    }

    const jobId = `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const job: EnrichJob = {
      id: jobId,
      companyIds: targetIds,
      processed: [],
      failed: [],
      status: 'processing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalCompanies: targetIds.length,
      force,
    };

    jobs.set(jobId, job);

    console.log(`[enrich-batch] Started job ${jobId} with ${targetIds.length} companies`);

    return NextResponse.json({
      success: true,
      jobId,
      totalCompanies: targetIds.length,
      message: 'Batch enrichment started. Poll /api/g-crm/companies/enrich-batch/' + jobId + ' for progress.',
    });
  } catch (error) {
    console.error('[enrich-batch] POST error:', error);
    return NextResponse.json({ error: 'Failed to start batch' }, { status: 500 });
  }
}

// ── GET: List active jobs or get job progress ──

export async function GET(request: Request, { params }: { params: Promise<{ id?: string }> }) {
  const { id } = await params;

  // GET /api/g-crm/companies/enrich-batch — list active jobs
  if (!id) {
    const activeJobs = Array.from(jobs.values())
      .filter(j => j.status === 'processing')
      .map(j => ({
        id: j.id,
        totalCompanies: j.totalCompanies,
        processed: j.processed.length,
        failed: j.failed.length,
        status: j.status,
        createdAt: j.createdAt,
      }));
    return NextResponse.json({ jobs: activeJobs });
  }

  // GET /api/g-crm/companies/enrich-batch/[id] — progress + process next
  const job = jobs.get(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // If still processing, enrich the next company as a side-effect
  if (job.status === 'processing') {
    const remaining = job.companyIds.filter(cid => !job.processed.includes(cid) && !job.failed.includes(cid));
    if (remaining.length === 0) {
      job.status = job.failed.length > 0 ? 'completed' : 'completed';
      job.updatedAt = Date.now();
    } else {
      // Process 1 company per poll
      const nextId = remaining[0];
      const result = await enrichOneCompany(nextId, job.force);

      if (result.success) {
        job.processed.push(nextId);
      } else {
        job.failed.push(nextId);
      }
      job.updatedAt = Date.now();

      // Check if done
      const stillRemaining = job.companyIds.filter(cid => !job.processed.includes(cid) && !job.failed.includes(cid));
      if (stillRemaining.length === 0) {
        job.status = 'completed';
        job.updatedAt = Date.now();
        console.log(`[enrich-batch] Job ${id} completed: ${job.processed.length} success, ${job.failed.length} failed`);
      }
    }
  }

  const progress = Math.round((job.processed.length / job.totalCompanies) * 100);

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    totalCompanies: job.totalCompanies,
    processed: job.processed.length,
    failed: job.failed.length,
    progress,
    etaSeconds: job.status === 'processing'
      ? Math.round((job.totalCompanies - job.processed.length - job.failed.length) * 6) // ~6s per company
      : 0,
    failedIds: job.failed.length > 0 ? job.failed.slice(-10) : [], // last 10 failed IDs
  });
}

// ── DELETE: Cancel a job ──

export async function DELETE(request: Request, { params }: { params: Promise<{ id?: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Job ID required' }, { status: 400 });

  const job = jobs.get(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  job.status = 'cancelled';
  job.updatedAt = Date.now();

  return NextResponse.json({ success: true, message: 'Job cancelled' });
}