/**
 * Job Processor — Workflow Automation Engine (Phase 2)
 *
 * Processes queued/running jobs by type.
 * Each job type has a defined pipeline with sub-steps and progress tracking.
 *
 * Job types and their pipelines:
 * - enrichment: searching (30%) → extracting (60%) → validating (80%) → storing (95%) → completed (100%)
 * - research:   same as enrichment (alias for now, Phase 3 will differentiate)
 * - scoring:    loading data (30%) → computing (70%) → storing (90%) → completed (100%)
 * - signal_detection: searching (30%) → analyzing (60%) → storing (90%) → completed (100%)
 * - email_generation: loading context (20%) → generating (60%) → storing (90%) → completed (100%)
 *
 * Error handling: all errors are caught, classified by retry.ts,
 * and the job is either retried (retryable) or permanently failed.
 */

import {
  startJob,
  completeJob,
  failJob,
  updateJobProgress,
  getJobDetail,
  type JobType,
} from './queue';
import { classifyError } from './retry';
import { logJobEvent } from './index';
import { db } from '@/lib/db';
import { webSearch, callLLM, extractJSON } from '@/lib/zai-helpers';
import { researchCompany } from '@/lib/research-engine';
import { detectSignals, storeSignals } from '@/lib/research-engine';

// ── Process a single job by ID ──

export async function processJob(jobId: string): Promise<void> {
  const job = await getJobDetail(jobId);
  if (!job) {
    console.error(`[processor] Job ${jobId} not found`);
    return;
  }

  // Only process queued or pending jobs (pending = just created, allow direct processing)
  if (job.status === 'pending') {
    await startJob(jobId);
  } else if (job.status !== 'running') {
    // If it's already running (stale from a crash), allow re-processing
    if (job.status !== 'queued') {
      console.warn(`[processor] Job ${jobId} is ${job.status}, skipping`);
      return;
    }
    await startJob(jobId);
  }

  try {
    switch (job.type) {
      case 'enrichment':
        await processEnrichmentJob(jobId, job);
        break;
      case 'research':
        await processResearchJob(jobId, job);
        break;
      case 'scoring':
        await processScoringJob(jobId, job);
        break;
      case 'signal_detection':
        await processSignalDetectionJob(jobId, job);
        break;
      case 'email_generation':
        await processEmailGenerationJob(jobId, job);
        break;
      default:
        await failJob(jobId, `Unknown job type: ${job.type}`, 'UNKNOWN_TYPE', false);
    }
  } catch (error: unknown) {
    const classification = classifyError(error);
    const attemptIndex = (job.attemptCount); // current attempt was already counted in startJob
    const { getNextRetryTime } = await import('./retry');
    const nextRetry = classification.isRetryable ? getNextRetryTime(attemptIndex) : undefined;

    await failJob(
      jobId,
      error instanceof Error ? error.message : String(error),
      classification.errorCode,
      classification.isRetryable,
      nextRetry
    );
  }
}

// ── Process next N queued jobs ──

export async function processNextJobs(limit: number = 5): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  // Queue pending jobs first
  const { queuePendingJobs } = await import('./queue');
  await queuePendingJobs(limit);

  // Get queued jobs (not running, not failed, not completed)
  const queuedJobs = await db.job.findMany({
    where: { status: 'queued' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    select: { id: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const job of queuedJobs) {
    try {
      await processJob(job.id);
      // Check if it completed successfully
      const updated = await db.job.findUnique({ where: { id: job.id }, select: { status: true } });
      if (updated?.status === 'completed') succeeded++;
      else if (updated?.status === 'failed') failed++;
    } catch (err) {
      console.error(`[processor] Unhandled error processing job ${job.id}:`, err);
      failed++;
    }
  }

  return { processed: queuedJobs.length, succeeded, failed };
}

// ── Job Type Processors ──

async function processEnrichmentJob(jobId: string, job: any): Promise<void> {
  // Phase 3: Enrichment now delegates to the research engine.
  // The 'enrichment' job type is a legacy alias — it runs the full
  // 6-step research pipeline (search→evidence→extract→validate→score→store).
  // This ensures all enrichment goes through evidence tracking and
  // per-field confidence scoring.
  const payload = job.payload || {};
  const companyId = job.companyId || payload.companyId;

  if (!companyId) {
    await failJob(jobId, 'Missing companyId for enrichment job', 'MISSING_DATA', false);
    return;
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    await failJob(jobId, `Company ${companyId} not found`, 'NOT_FOUND', false);
    return;
  }

  const companyName = company.rawName || company.normalizedName;

  // Delegate to Phase 3 research engine
  const researchResult = await researchCompany(
    companyId,
    companyName,
    company.domain,
    company.industry,
    jobId,
    payload.force === true,
    (progress) => {
      const jobProgress = Math.round(progress.progress * 0.95);
      updateJobProgress(jobId, jobProgress, progress.label, {
        step: `enrichment_${progress.step}`,
        progress: jobProgress,
        message: progress.message,
      }).catch(() => {});
    },
  );

  await completeJob(jobId, {
    companyId: company.id,
    companyName,
    mode: 'enrichment_via_research_engine',
    overallConfidence: researchResult.overallConfidence,
    evidenceCount: researchResult.evidenceCount,
    signalsDetected: researchResult.signals.signalCount,
  });

  await logJobEvent(jobId, 'info', 'enrichment_complete',
    `Enriched ${companyName} via research engine: ${Math.round(researchResult.overallConfidence * 100)}% confidence, ${researchResult.evidenceCount} evidence`
  );
}

async function processResearchJob(jobId: string, job: any): Promise<void> {
  const payload = job.payload || {};
  const companyId = job.companyId || payload.companyId;

  if (!companyId) {
    await failJob(jobId, 'Missing companyId for research job', 'MISSING_DATA', false);
    return;
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    await failJob(jobId, `Company ${companyId} not found`, 'NOT_FOUND', false);
    return;
  }

  const companyName = company.rawName || company.normalizedName;

  // Use the Phase 3 research engine with 6-step pipeline
  const researchResult = await researchCompany(
    companyId,
    companyName,
    company.domain,
    company.industry,
    jobId,
    payload.force === true,
    (progress) => {
      // Map research engine progress to job progress
      const jobProgress = Math.round(progress.step === 1
        ? progress.progress * 0.25
        : progress.step === 2
        ? 25 + progress.progress * 0.15
        : progress.step === 3
        ? 40 + progress.progress * 0.25
        : progress.step === 4
        ? 65 + progress.progress * 0.10
        : progress.step === 5
        ? 75 + progress.progress * 0.10
        : 85 + progress.progress * 0.15
      );
      updateJobProgress(jobId, jobProgress, progress.label, {
        step: `research_${progress.step}`,
        progress: jobProgress,
        message: progress.message,
      }).catch(() => {}); // non-blocking
    },
  );

  await completeJob(jobId, {
    companyId: company.id,
    companyName,
    overallConfidence: researchResult.overallConfidence,
    evidenceCount: researchResult.evidenceCount,
    signalsDetected: researchResult.signals.signalCount,
    highImpactSignals: researchResult.signals.highImpactCount,
    fieldConfidence: researchResult.fieldConfidence,
    industry: researchResult.industry,
    revenue: researchResult.revenue,
  });

  await logJobEvent(jobId, 'info', 'research_complete',
    `Research complete for ${companyName}: ${Math.round(researchResult.overallConfidence * 100)}% confidence, ${researchResult.evidenceCount} evidence, ${researchResult.signals.signalCount} signals`
  );
}

async function processScoringJob(jobId: string, job: any): Promise<void> {
  const payload = job.payload || {};
  const companyId = job.companyId || payload.companyId;

  if (!companyId) {
    await failJob(jobId, 'Missing companyId for scoring job', 'MISSING_DATA', false);
    return;
  }

  // Step 1: Load data (including Phase 3 evidence + fieldConfidence)
  await updateJobProgress(jobId, 30, 'Loading company data', { step: 'loading', progress: 30 });
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      researchCard: true,
      signals: true,
      contacts: { select: { id: true, leadScore: true, emailHealth: true, status: true } },
    },
  });

  if (!company) {
    await failJob(jobId, `Company ${companyId} not found`, 'NOT_FOUND', false);
    return;
  }

  // Step 2: Compute score using Phase 3 evidence data
  await updateJobProgress(jobId, 70, 'Computing intelligence score', { step: 'computing', progress: 70 });

  let score = 0;
  const reasons: string[] = [];

  // Parse fieldConfidence from research card (Phase 3)
  let fieldConfidence: Record<string, number> = {};
  try {
    if (company.researchCard?.fieldConfidence) {
      fieldConfidence = JSON.parse(company.researchCard.fieldConfidence);
    }
  } catch { /* ignore parse errors */ }

  // Has research card with real data
  if (company.researchCard) {
    const rc = company.researchCard;

    // Phase 3: Use per-field confidence for scoring
    if (rc.businessOverview && rc.businessOverview.length > 50) {
      const fc = fieldConfidence.businessOverview || 0.5;
      score += Math.round(20 * (0.5 + fc * 0.5));
      reasons.push(`Business overview (${Math.round(fc * 100)}% confidence)`);
    }
    if (rc.revenue && rc.revenue !== 'Not found') {
      const fc = fieldConfidence.revenue || 0.5;
      score += Math.round(15 * (0.5 + fc * 0.5));
      reasons.push(`Revenue known (${Math.round(fc * 100)}% confidence)`);
    }
    if (rc.employeeCount && rc.employeeCount !== 'Not found') {
      const fc = fieldConfidence.employeeCount || 0.5;
      score += Math.round(10 * (0.5 + fc * 0.5));
      reasons.push(`Employee count known (${Math.round(fc * 100)}% confidence)`);
    }
    if (rc.fundingStage && rc.fundingStage !== 'Not found') {
      const fc = fieldConfidence.fundingStage || 0.5;
      score += Math.round(10 * (0.5 + fc * 0.5));
      reasons.push(`Funding stage known (${Math.round(fc * 100)}% confidence)`);
    }
    if (rc.techStack && rc.techStack.length > 0) {
      score += 10;
      reasons.push('Tech stack known');
    }

    // Phase 3: Evidence count bonus
    try {
      const { getEvidenceSummary } = await import('@/lib/research-engine');
      const summary = await getEvidenceSummary(companyId);
      if (summary.totalEvidence > 0) {
        const evidenceBonus = Math.min(Math.round(summary.totalEvidence / 5), 10);
        score += evidenceBonus;
        reasons.push(`${summary.totalEvidence} evidence records (+${evidenceBonus})`);
      }
    } catch { /* non-critical */ }
  }

  // Has domain
  if (company.domain) { score += 10; reasons.push('Has domain'); }

  // Has industry
  if (company.industry) { score += 10; reasons.push('Industry classified'); }

  // Has signals (Phase 3: weight by impact)
  const highImpactSignals = company.signals.filter((s: any) => s.impact === 'high').length;
  if (company.signals.length > 0) {
    const signalScore = Math.min(15, company.signals.length * 3 + highImpactSignals * 5);
    score += signalScore;
    reasons.push(`${company.signals.length} signal(s) (${highImpactSignals} high-impact, +${signalScore})`);
  }

  // Has contacts with high scores
  const highValueContacts = company.contacts.filter(c => c.leadScore >= 50);
  if (highValueContacts.length > 0) { score += 5; reasons.push(`${highValueContacts.length} high-value contact(s)`); }

  score = Math.min(100, score);

  // Step 3: Store
  await updateJobProgress(jobId, 90, 'Storing score', { step: 'storing', progress: 90 });

  await db.company.update({
    where: { id: companyId },
    data: { intelligenceScore: score },
  });

  await completeJob(jobId, {
    companyId,
    score,
    reasons,
    fieldConfidence,
  });

  await logJobEvent(jobId, 'info', 'scoring_complete', `Scored ${company.rawName}: ${score}/100`);
}

async function processSignalDetectionJob(jobId: string, job: any): Promise<void> {
  const payload = job.payload || {};
  const companyId = job.companyId || payload.companyId;

  if (!companyId) {
    await failJob(jobId, 'Missing companyId for signal detection job', 'MISSING_DATA', false);
    return;
  }

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) {
    await failJob(jobId, `Company ${companyId} not found`, 'NOT_FOUND', false);
    return;
  }

  const companyName = company.rawName || company.normalizedName;

  // Step 1: Search for signals
  await updateJobProgress(jobId, 30, 'Searching for signals', { step: 'searching', progress: 30 });
  await logJobEvent(jobId, 'info', 'signal_search_start', `Searching signals for ${companyName}`);

  // Use Phase 3 signal detection engine
  const [newsResults, signalResults] = await Promise.allSettled([
    webSearch(`${companyName} news 2025`, 8),
    webSearch(`${companyName} funding hiring expansion acquisition digital transformation`, 8),
  ]);

  const allSnippets: Array<{ title: string; snippet: string; url: string; source: string }> = [];
  for (const result of [newsResults, signalResults]) {
    if (result.status === 'fulfilled') {
      for (const r of result.value) {
        allSnippets.push({
          title: r.title,
          snippet: r.snippet || r.description || '',
          url: r.url,
          source: r.host_name || r.name || '',
        });
      }
    }
  }

  await updateJobProgress(jobId, 60, 'Analyzing signals', { step: 'analyzing', progress: 60, message: `Found ${allSnippets.length} sources, running signal analysis...` });

  // Step 2: AI-powered signal detection
  const signalResult = await detectSignals(companyName, allSnippets);

  await updateJobProgress(jobId, 85, 'Storing signals', { step: 'storing', progress: 85, message: `Detected ${signalResult.signalCount} signals` });

  // Step 3: Store signals with evidence links
  await storeSignals(companyId, signalResult.signals, jobId);

  // Step 4: Complete
  await completeJob(jobId, {
    companyId,
    signalsFound: signalResult.signalCount,
    highImpactSignals: signalResult.highImpactCount,
    signals: signalResult.signals.map(s => ({
      type: s.signalType,
      title: s.title,
      impact: s.impact,
      confidence: s.confidence,
    })),
  });

  await logJobEvent(jobId, 'info', 'signal_detection_complete',
    `Detected ${signalResult.signalCount} signal(s) for ${companyName} (${signalResult.highImpactCount} high-impact)`
  );
}

async function processEmailGenerationJob(jobId: string, job: any): Promise<void> {
  const payload = job.payload || {};
  const contactId = job.contactId || payload.contactId;

  if (!contactId) {
    await failJob(jobId, 'Missing contactId for email generation job', 'MISSING_DATA', false);
    return;
  }

  // Step 1: Load context
  await updateJobProgress(jobId, 20, 'Loading contact context', { step: 'loading', progress: 20 });

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: {
        include: { researchCard: true, signals: true },
      },
    },
  });

  if (!contact) {
    await failJob(jobId, `Contact ${contactId} not found`, 'NOT_FOUND', false);
    return;
  }

  if (!contact.email || contact.email === 'unknown@no-email.com') {
    await failJob(jobId, 'Contact has no valid email', 'MISSING_DATA', false);
    return;
  }

  // Step 2: Generate
  await updateJobProgress(jobId, 60, 'Generating email', { step: 'generating', progress: 60 });

  const companyName = contact.company?.rawName || 'the company';
  const contactName = contact.rawName || 'there';
  const title = contact.title || 'team member';
  const industry = contact.company?.industry || '';
  const overview = contact.company?.researchCard?.businessOverview || '';

  let generatedEmail: { subject: string; body: string } | null = null;

  try {
    const prompt = `Generate a personalized B2B sales email.

Contact: ${contactName} (${title})
Company: ${companyName}
Industry: ${industry}
${overview ? `Company Overview: ${overview}` : ''}

Generate a professional, concise outreach email. Return ONLY valid JSON:
{"subject": "email subject line", "body": "email body text"}`;

    const response = await callLLM(
      'You are a B2B sales email expert. Generate concise, personalized emails. Return only JSON.',
      prompt
    );
    generatedEmail = extractJSON(response) as { subject: string; body: string } | null;
  } catch (err) {
    await logJobEvent(jobId, 'warn', 'email_gen_llm_failed', 'LLM generation failed');
  }

  if (!generatedEmail || !generatedEmail.subject || !generatedEmail.body) {
    await failJob(jobId, 'Failed to generate valid email content', 'GENERATION_ERROR', true);
    return;
  }

  // Step 3: Store
  await updateJobProgress(jobId, 90, 'Storing draft', { step: 'storing', progress: 90 });

  await db.draft.create({
    data: {
      contactId,
      subject: generatedEmail.subject,
      body: generatedEmail.body,
      status: 'pending_review',
    },
  });

  await completeJob(jobId, {
    contactId,
    subject: generatedEmail.subject,
    draftCreated: true,
  });

  await logJobEvent(jobId, 'info', 'email_gen_complete', `Generated email draft for ${contactName} at ${companyName}`);
}