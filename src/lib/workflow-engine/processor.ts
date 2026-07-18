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
import { webSearch, callLLM, extractJSON, findKeyPeople, getCompanyNews, tavilyAIAnswer } from '@/lib/zai-helpers';
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
  const payload = job.payload || {};
  const companyId = job.companyId || payload.companyId;

  if (!companyId) {
    await failJob(jobId, 'Missing companyId for enrichment job', 'MISSING_DATA', false);
    return;
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { researchCard: true },
  });

  if (!company) {
    await failJob(jobId, `Company ${companyId} not found`, 'NOT_FOUND', false);
    return;
  }

  // Check if already enriched recently (within 24h) unless force
  if (!payload.force && company.researchCard?.enrichmentDate) {
    const hoursSince = (Date.now() - new Date(company.researchCard.enrichmentDate).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      await completeJob(jobId, { skipped: true, reason: 'Recently enriched', researchCard: company.researchCard });
      return;
    }
  }

  const companyName = company.rawName || company.normalizedName;

  // Step 1: Searching (0-30%)
  await updateJobProgress(jobId, 5, 'Searching', { step: 'web_search', progress: 5, message: 'Running web searches...' });
  await logJobEvent(jobId, 'info', 'enrichment_search_start', `Starting web search for ${companyName}`);

  const searchQueries = [
    `${companyName} ${company.domain || ''} revenue employees funding 2024 2025`,
    `${companyName} technology stack products services`,
    `${companyName} LinkedIn company profile overview`,
    `${companyName} CEO CTO CIO executives leadership team`,
    `${companyName} news 2025 funding hiring expansion`,
  ];

  const searchResults = await Promise.allSettled(
    searchQueries.map(q => webSearch(q, 6)),
  );

  const allSnippets: string[] = [];
  let linkedInUrl = '';
  let twitterUrl = '';
  let websiteUrl = '';

  for (const result of searchResults) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      for (const r of result.value) {
        allSnippets.push(`[${r.title}] ${r.snippet}`);
        if (r.url?.includes('linkedin.com/company') && !linkedInUrl) linkedInUrl = r.url;
        if ((r.url?.includes('twitter.com') || r.url?.includes('x.com')) && !twitterUrl) twitterUrl = r.url;
        if (!websiteUrl && r.url && !r.url.includes('linkedin.com') && !r.url.includes('twitter.com') && !r.url.includes('wikipedia.org') && !r.url.includes('google.com')) {
          websiteUrl = r.url;
        }
      }
    }
  }

  await updateJobProgress(jobId, 30, 'Searching', { step: 'web_search', progress: 30, message: `Found ${allSnippets.length} search results` });
  await logJobEvent(jobId, 'info', 'enrichment_search_done', `Found ${allSnippets.length} snippets from web search`);

  // Step 2: Extracting key people (30-50%)
  await updateJobProgress(jobId, 35, 'Finding key people', { step: 'key_people', progress: 35 });
  let keyPeopleData: string = '[]';
  try {
    const people = await findKeyPeople(companyName);
    if (people.length > 0) keyPeopleData = JSON.stringify(people.slice(0, 10));
  } catch (err) {
    await logJobEvent(jobId, 'warn', 'enrichment_key_people_failed', 'Key people search failed, continuing');
  }

  await updateJobProgress(jobId, 50, 'Extracting', { step: 'key_people', progress: 50, message: 'Key people found, extracting news...' });

  // Step 3: Extracting news/signals (50-60%)
  let newsData: string = '[]';
  try {
    const news = await getCompanyNews(companyName);
    if (news.length > 0) newsData = JSON.stringify(news.slice(0, 8));
  } catch (err) {
    await logJobEvent(jobId, 'warn', 'enrichment_news_failed', 'News search failed, continuing');
  }

  await updateJobProgress(jobId, 60, 'Extracting', { step: 'llm_extraction', progress: 60, message: 'Running AI extraction...' });

  // Step 4: LLM Extraction (60-80%)
  const searchContext = allSnippets.slice(0, 30).join('\n');

  const systemPrompt = `You are a business intelligence research assistant. Based ONLY on the web search results provided, extract accurate, factual information.

CRITICAL: Only include information directly supported by the search results. If something is not found, write "Not found".

Return ONLY valid JSON:
{
  "businessOverview": "2-3 sentence factual description",
  "revenue": "revenue or range, or 'Not found'",
  "employeeCount": "employee count or range, or 'Not found'",
  "fundingStage": "Bootstrap/Seed/Series A/Series B/Series C+/PE-backed/Public/Not found",
  "techStack": "comma-separated technologies, or empty string",
  "industry": "primary industry",
  "website": "official website URL"
}`;

  const userPrompt = `Company: ${companyName}
Domain: ${company.domain || 'Unknown'}
Current Industry: ${company.industry || 'Unknown'}

Web Search Results:
${searchContext || 'No results found.'}

Provide accurate company data as JSON.`;

  let extractedData: Record<string, unknown> | null = null;

  try {
    const response = await callLLM(systemPrompt, userPrompt);
    extractedData = extractJSON(response) as Record<string, unknown> | null;
  } catch (err) {
    await logJobEvent(jobId, 'warn', 'enrichment_llm_failed', 'LLM extraction failed, trying Tavily fallback');
  }

  // Tavily fallback
  if (!extractedData || typeof extractedData !== 'object') {
    try {
      const tavilyAnswer = await tavilyAIAnswer(
        `${companyName} ${company.domain || ''} revenue employees funding industry technology overview`
      );
      if (tavilyAnswer) {
        extractedData = {
          businessOverview: tavilyAnswer.slice(0, 500),
          revenue: 'Not found',
          employeeCount: 'Not found',
          fundingStage: 'Not found',
          techStack: '',
          industry: company.industry || 'Not found',
          website: websiteUrl || company.domain ? `https://${company.domain}` : '',
        };
      }
    } catch { /* fall through */ }
  }

  await updateJobProgress(jobId, 80, 'Validating', { step: 'validation', progress: 80, message: 'Validating extracted data...' });

  // Step 5: Store results (80-95%)
  const socialProfiles: Record<string, string> = {};
  if (linkedInUrl) socialProfiles.linkedin = linkedInUrl;
  if (twitterUrl) socialProfiles.twitter = twitterUrl;

  const enrichmentData = {
    businessOverview: String(extractedData?.businessOverview || `${companyName} operates in the ${company.industry || 'technology'} sector.`),
    revenue: String(extractedData?.revenue || 'Not found'),
    employeeCount: String(extractedData?.employeeCount || 'Not found'),
    fundingStage: String(extractedData?.fundingStage || 'Not found'),
    techStack: String(extractedData?.techStack || ''),
    socialProfiles: JSON.stringify(socialProfiles),
    keyPeople: keyPeopleData,
    recentNews: newsData,
    industry: String(extractedData?.industry || company.industry || 'Not found'),
    website: String(extractedData?.website || websiteUrl || (company.domain ? `https://${company.domain}` : '')),
  };

  // Upsert research card
  const { keyPeople: _kp, recentNews: _rn, industry: _ind, website: _web, ...prismaFields } = enrichmentData;
  await db.companyResearchCard.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      ...prismaFields,
      enrichmentSource: 'workflow_engine',
      enrichmentDate: new Date(),
    },
    update: {
      ...prismaFields,
      enrichmentSource: 'workflow_engine',
      enrichmentDate: new Date(),
    },
  });

  // Update company fields
  const companyUpdate: Record<string, string | number> = {};
  if (!company.industry && enrichmentData.industry && enrichmentData.industry !== 'Not found') {
    companyUpdate.industry = enrichmentData.industry;
  }
  if (!company.website && enrichmentData.website) {
    companyUpdate.website = enrichmentData.website;
  }

  // Calculate intelligence score
  let score = 10;
  if (enrichmentData.businessOverview && !enrichmentData.businessOverview.includes('operates in the')) score += 15;
  if (enrichmentData.revenue && enrichmentData.revenue !== 'Not found') score += 15;
  if (enrichmentData.employeeCount && enrichmentData.employeeCount !== 'Not found') score += 10;
  if (enrichmentData.fundingStage && enrichmentData.fundingStage !== 'Not found') score += 10;
  if (enrichmentData.techStack) score += 10;
  if (enrichmentData.industry && enrichmentData.industry !== 'Not found') score += 10;
  if (company.domain) score += 10;
  if (company.website) score += 5;
  companyUpdate.intelligenceScore = Math.min(100, score);

  if (Object.keys(companyUpdate).length > 0) {
    await db.company.update({ where: { id: company.id }, data: companyUpdate });
  }

  // Update enrichment score for contacts
  await db.contact.updateMany({
    where: { companyId: company.id },
    data: { enrichmentScore: 50, enrichmentData: JSON.stringify(enrichmentData) },
  });

  await updateJobProgress(jobId, 95, 'Storing', { step: 'storing', progress: 95, message: 'Results stored' });

  // Step 6: Complete
  await completeJob(jobId, {
    companyId: company.id,
    companyName,
    industry: enrichmentData.industry,
    revenue: enrichmentData.revenue,
    employeeCount: enrichmentData.employeeCount,
    fundingStage: enrichmentData.fundingStage,
    techStack: enrichmentData.techStack,
    intelligenceScore: companyUpdate.intelligenceScore,
  });

  await logJobEvent(jobId, 'info', 'enrichment_complete', `Enriched ${companyName} successfully`);
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

  // Step 1: Load data
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

  // Step 2: Compute score
  await updateJobProgress(jobId, 70, 'Computing intelligence score', { step: 'computing', progress: 70 });

  let score = 0;
  const reasons: string[] = [];

  // Has research card with real data
  if (company.researchCard) {
    const rc = company.researchCard;
    if (rc.businessOverview && rc.businessOverview.length > 50) { score += 20; reasons.push('Has business overview'); }
    if (rc.revenue && rc.revenue !== 'Not found') { score += 15; reasons.push('Revenue known'); }
    if (rc.employeeCount && rc.employeeCount !== 'Not found') { score += 10; reasons.push('Employee count known'); }
    if (rc.fundingStage && rc.fundingStage !== 'Not found') { score += 10; reasons.push('Funding stage known'); }
    if (rc.techStack && rc.techStack.length > 0) { score += 10; reasons.push('Tech stack known'); }
  }

  // Has domain
  if (company.domain) { score += 10; reasons.push('Has domain'); }

  // Has industry
  if (company.industry) { score += 10; reasons.push('Industry classified'); }

  // Has signals
  if (company.signals.length > 0) { score += 10; reasons.push(`${company.signals.length} signal(s) detected`); }

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