---
Task ID: 1
Agent: main
Task: Full audit of Phase 1 & 2 — verify every file, identify gaps, fix and deploy

Work Log:
- Read all 8 files in src/lib/data-intelligence/ (engine.ts, column-detector.ts, validator.ts, normalizer.ts, deduplicator.ts, quality-scorer.ts, correction-suggester.ts, config-store.ts)
- Read full Prisma schema (881 lines) — confirmed Job, JobLog models exist with proper indexes
- Read all 4 workflow-engine files (queue.ts, processor.ts, retry.ts, index.ts) — fully built with real business logic
- Read all job API routes (jobs.ts, jobs/:id.ts, jobs/actions.ts) — properly import from workflow-engine
- Read command-center-screen.tsx — already fetches /api/g-data/jobs?stats=true, displays job queue stats + recent jobs
- Read companies-screen.tsx — was using direct /api/g-crm/companies/enrich calls instead of job queue
- Read import-screen.tsx — 4-step wizard (Upload → Map → Review → History), uses data intelligence pipeline
- Read config-store.ts — has comprehensive auto-seed (60+ industry mappings, country ISO codes, employee size patterns, scoring weights)

Gaps Found & Fixed:
1. Companies screen enrichment was calling /api/g-crm/companies/enrich directly → Changed to use /api/g-data/jobs/actions (enqueue-enrichment) to create proper job queue entries
2. Single-company "Enrich Data" button also updated to queue a job
3. No db-sync endpoint existed for ensuring Job/JobLog tables exist on remote PostgreSQL → Created /api/g-system/db-sync that creates missing tables via raw SQL + triggers config seed
4. Added enqueue-enrichment action to jobs/actions API route

Phase 1 Status: FULLY BUILT
- 8 modules in data-intelligence/, all with real business logic (not stubs)
- Auto-seed triggers on first config load when tables are empty
- Column mapping: 16 regex rules for header detection
- Validation: 12 rules (email format, domain format, required fields, uniqueness, custom checks)
- Normalization: 60+ industry mappings, country ISO codes, employee size ranges, title abbreviations
- Quality scoring: 3 dimensions (completeness 40%, validity 30%, richness 30%) with DB-configurable weights
- Deduplication: Levenshtein-based fuzzy matching, email exact match, domain+name match
- Correction suggestions: email typos, domain cleanup, industry/country normalization

Phase 2 Status: FULLY BUILT
- Job/JobLog Prisma models with proper indexes
- queue.ts: createJob, queuePendingJobs, startJob, completeJob, failJob, cancelJob, updateJobProgress, getJobs, getJobDetail, getQueueStats, retryJob, retryAllFailed
- processor.ts: 5 job type processors (enrichment, research, scoring, signal_detection, email_generation) with sub-step progress tracking
- retry.ts: Error classification (retryable vs non-retryable), exponential backoff with jitter (30s base, 2x multiplier, 10min max)
- index.ts: Barrel exports, logJobEvent, recoverStaleJobs, enqueueEnrichment, enqueueBulkEnrichment
- 3 API routes: GET /jobs, GET/POST /jobs/:id, POST /jobs/actions
- Command center already wired to job queue stats
- Companies screen enrichment now uses job queue

Stage Summary:
- Everything builds cleanly (next build succeeds)
- No code is stubbed — all modules contain real business logic
- Auto-seed mechanism ensures first-use data population
- db-sync endpoint ensures database table creation on first deploy
- Enrichment flow: Companies screen → enqueue jobs → Command Center shows progress
