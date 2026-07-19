---
Task ID: 1
Agent: Main Agent
Task: Generate Phase 3 Freeze Handover Package (PDF)

Work Log:
- Read all key codebase files (35 models, 152 API routes, governance layer, research engine)
- Loaded PDF skill (report brief, fonts, cover system, palette)
- Loaded Charts skill for diagram generation
- Generated 3 Playwright+CSS diagrams: System Architecture, Data Flow Pipeline, AI Governance Architecture
- Generated cascade palette for document theming
- Wrote 680-line ReportLab script with TocDocTemplate, 11 chapters, 7 tables, 3 embedded figures
- Created cover page (Template 01 HUD Data Terminal) via html2poster.js
- Merged cover + body via pypdf with A4 normalization
- Ran pdf_qa.py: PASS (12/12 checks pass, 1 warning for intentional cover asymmetry)

Stage Summary:
- Final deliverable: /home/z/my-project/download/Phase_3_Freeze_Handover_DeepMindQ.pdf (18 pages, 780KB)
- 11 chapters: Executive Summary, System Architecture, Data Flow, Module Dependencies, AI Governance, API Entry Points, DB Schema, RFP/RFI Foundation, Human-Controlled Selling, Technical Debt, Phase 4/5/6 Rules
- Phase 4 human approval requirement documented as mandatory architectural control
- All quality gates passed

---
Task ID: A3
Agent: full-stack-developer
Task: Remove deprecated AI paths

Work Log:
- Grep-checked all 5 removed function names (researchCompany, findKeyPeople, getCompanyNews, getZAI, callChatLLM) across src/
- Confirmed all hits are either the NEW research-engine/researcher.ts replacement or comments — no stale imports
- Updated governance comment block in src/lib/zai-helpers.ts (lines 269–292): added Phase 4 A2 Enforcement header, listed all 5 deprecated functions with "do NOT re-add", documented 5 active exports + type exports, referenced ESLint rule and CI script
- Checked email-generation.ts line 19: confirmed it is a comment only (`// callLLM is accessed ONLY through ai-governance.ts`), not an import — no action needed (outside A3 scope per instructions)
- Verified researcher.ts has zero imports of callLLM (confirmed uses governedAICall)

Stage Summary:
- Validation 1 — removed function refs: 16 grep hits, ALL are either comments or the new research-engine replacement. Zero stale imports.
- Validation 2 — `export.*callLLM` in zai-helpers.ts: 1 hit (line 108) ✓
- Validation 3 — active exports: tavilyAIAnswer (L152), webSearch (L196), extractJSON (L251), verifyEmailBasic (L302) — all 4 present ✓
- Validation 4 — updated comment block confirmed at lines 269–292 ✓
- No code changes beyond the governance comment block update. No violations found.
---
Task ID: A1
Agent: full-stack-developer
Task: Sequence human approval enforcement

Work Log:
- Read sequences__process.ts to understand the current auto-approve behavior
- Read drafts.ts as reference for the correct human approval pattern (not modified)
- Updated file header comment block: revised description to say "creates a draft (pending_review)" instead of "creates a draft, approves and queues it", and added the Phase 4 A1 guard block explaining that this endpoint must NOT create SendQueue entries
- Changed draft creation status from `'approved'` (line 100) to `'pending_review'` (line 107)
- Removed entire SendQueue creation block (old lines 108-115: `db.sendQueue.create({ ... })`)
- Added explanatory comment above draft creation: "Phase 4 A1: AI generates draft only. Human must review and approve before SendQueue entry is created. See drafts.ts PATCH handler for the approval → SendQueue flow."
- Confirmed step advancement logic (lines 115-133) remains unchanged

Validation Results:
1. `rg "sendQueue.create" .../sequences__process.ts` → 0 results ✅
2. `rg "status.*approved" .../sequences__process.ts` → 0 results ✅
3. `rg "pending_review" .../sequences__process.ts` → 4 results (header comment ×3 + draft status ×1) ✅
4. Step advancement logic intact (lines 115-133: nextStep lookup, enrollment update with delayDays, completed fallback) ✅

Stage Summary:
- sequences__process.ts now creates drafts with status 'pending_review' instead of 'approved'
- SendQueue creation removed entirely from this file; only human approval via PATCH /api/drafts can create SendQueue entries
- drafts.ts was NOT modified (reference only)
- No other files were modified

---
Task ID: A4
Agent: full-stack-developer
Task: Context-aware chat governance

Work Log:
- Read ai__chat.ts — found imports (governedAICall, ResearchContext) and loadResearchContext helper already present from prior partial implementation
- Replaced the single governedAICallAggregate call block (lines 257-282) with conditional logic: governedAICall when companyId present, governedAICallAggregate otherwise
- Added governance metadata (confidence, freshness, stalenessWarning, capabilityMatches) to response when company context is active
- Added 'chat' entry to GOVERNANCE_CONFIGS in ai-governance.ts with advisory thresholds (minResearchConfidence: 0.2, minFreshnessScore: 10, requireCapabilityMatch: false, requireRecentIntelligence: false, maxStalenessDays: 365)
- Ran ESLint on both modified files — zero errors/warnings

Stage Summary:
- Validation: all 4 grep checks pass
  - rg "governedAICall" → shows import (line 7), governedAICall usage (line 266), governedAICallAggregate usage (line 285)
  - rg "loadResearchContext" → shows definition (line 116) and call (line 265)
  - rg "chat:" in ai-governance.ts → shows config entry (line 239)
  - rg "enforceGovernance: false" → shows on line 273
- Lint: both modified files pass with zero errors

---
Task ID: A2
Agent: full-stack-developer
Task: Governance build-time enforcement

Work Log:
- Created `/home/z/my-project/eslint-rules/no-ungoverned-llm.js` — custom ESLint rule that detects and blocks:
  - `import { callLLM }` from zai-helpers in any file except ai-governance.ts
  - `import { callChatLLM }` from anywhere (removed function)
  - `import { generateText, streamText } from 'ai'` (Vercel AI SDK)
  - `import OpenAI from 'openai'` (OpenAI SDK)
  - `import { openai } from '@ai-sdk/openai'`
  - Allows non-callLLM imports from zai-helpers (webSearch, extractJSON, tavilyAIAnswer, etc.)
- Registered the rule in `eslint.config.mjs` via plugin object, set to `"error"` level
- Updated `scripts/check-governance.sh` with Phase 4 A2 checks (4 checks: import guard, callChatLLM removal, AI SDK ban, callLLM location audit); enhanced with comment-aware filtering using `grep -E` to avoid false positives on documentation comments in zai-helpers.ts, researcher.ts, and ai__chat.ts
- Added `"check:governance": "bash scripts/check-governance.sh"` to package.json scripts

Stage Summary:
- `bash scripts/check-governance.sh` → ALL 4 CHECKS PASSED
- ESLint on compliant file (ai__chat.ts with comment-only refs) → 0 errors
- ESLint on ai-governance.ts (allowed callLLM import) → 0 errors
- ESLint on test file with `import { callLLM } from '@/lib/zai-helpers'` → 1 error (caught)
- ESLint on test file with `import { callChatLLM }` → 1 error (caught)
- ESLint on test file with `import { generateText } from 'ai'` → 1 error (caught)
- ESLint on test file with `import OpenAI from 'openai'` → 1 error (caught)
- ESLint on test file with `import { openai } from '@ai-sdk/openai'` → 1 error (caught)
- ESLint on test file with `import { webSearch, extractJSON } from '@/lib/zai-helpers'` → 0 errors (allowed)
- Test violation file cleaned up (deleted)
---
Task ID: B2
Agent: full-stack-developer
Task: Evidence quality scoring

Work Log:
- Created `/home/z/my-project/src/lib/research-engine/evidence-quality.ts` with `computeEvidenceQuality()` function
  - Scores 5 dimensions: coverage (25%), freshness (25%), sourceQuality (20%), corroboration (15%), volume (15%)
  - Returns `EvidenceQualityScore` interface with overall 0-100 score plus per-dimension breakdown and supporting metrics
  - Handles zero-evidence edge case with sensible defaults
  - Uses active+aging evidence only; filters by 6 KEY_FIELDS for coverage
- Created `/home/z/my-project/src/app/api/g-crm/[...slug]/companies___id__evidence-quality.ts` API endpoint
  - GET handler following same pattern as account-intelligence route
  - Validates company existence, returns 404 if not found
  - Returns computed quality score as JSON
- Registered route in `src/app/api/g-crm/[...slug]/route.ts` — added import and route entry
- Exported `computeEvidenceQuality` and `EvidenceQualityScore` from `src/lib/research-engine/index.ts`

Stage Summary:
- 3 files created/modified, 0 existing files modified (evidence.ts, schema untouched)
- Lint passes for all new code (pre-existing lint errors in other files)
- All 3 validation checks pass
- API available at `GET /api/g-crm/companies/[id]/evidence-quality`

---
Task ID: B1
Agent: full-stack-developer
Task: Signal lifecycle automation

Work Log:
- Read existing files: signal-capability-matching.ts (line 279 query), jobs__actions.ts (action switch), jobs.ts (listing endpoint), research-engine/index.ts (exports)
- Created `src/lib/research-engine/signal-lifecycle.ts` with `transitionSignalLifecycles()` function that loads all non-archived signals, computes correct lifecycle state based on age/confidence/impact, and batch-updates by new status
- Fixed signal capability matching filter in `signal-capability-matching.ts` line 279-286: changed `where: { companyId }` to `where: { companyId, status: { in: ['active', 'validated', 'aging'] } }` to exclude expired/archived signals
- Added `run_signal_lifecycle` action case in `src/app/api/g-data/[...slug]/jobs__actions.ts` with import of `transitionSignalLifecycles`, console logging, and JSON response
- Added `export { transitionSignalLifecycles } from './signal-lifecycle'` to `src/lib/research-engine/index.ts`

Stage Summary:
- 4 files modified/created, 0 existing files broken
- Lint passes for all new code (pre-existing lint errors in other files unchanged)
- All 3 validation checks pass:
  1. `rg "status.*in.*active.*validated.*aging"` → line 283 confirmed
  2. `rg "transitionSignalLifecycles"` → line 19 export confirmed
  3. `rg "signal_lifecycle|signal-lifecycle" src/app/api/g-data/ --type ts -l` → jobs__actions.ts confirmed
- Signal capability matching now filters out expired/archived signals
- Lifecycle job triggerable via `POST /api/g-data/jobs/actions` with `{ action: 'run_signal_lifecycle' }`
---
Task ID: B3
Agent: full-stack-developer
Task: Freshness indicators

Work Log:
- Read existing files: route.ts (slug router), research-engine/index.ts (exports), apiHelpers.ts (response helpers)
- Created `src/lib/research-engine/freshness-indicators.ts` with freshness lifecycle logic
  - `FreshnessStatus` type: 'fresh' | 'aging' | 'stale' | 'expired' | 'none'
  - Thresholds: fresh <14d, aging 14-45d, stale 45-90d, expired >90d
  - `evaluateStatus()` computes score 0-100 with linear decay per band
  - `getCompanyFreshnessProfile()` reads 4 domain timestamps from CompanyResearchCard, returns per-domain + overall status
  - `getBatchFreshnessProfiles()` for portfolio-level queries
  - `getStaleCompanies()` returns companies needing refresh, sorted by score (worst first)
- Created `src/app/api/g-crm/[...slug]/companies___id__freshness.ts` — GET handler for single company freshness
- Created `src/app/api/g-crm/[...slug]/freshness-overview.ts` — GET handler for portfolio freshness summary with `?view=stale|all&limit=N`
- Registered both routes in `src/app/api/g-crm/[...slug]/route.ts` (imports + ROUTES array)
- Exported new functions and types from `src/lib/research-engine/index.ts`

Stage Summary:
- 5 files created/modified, 0 existing files broken
- Lint passes for all new code (pre-existing lint errors in other files unchanged)
- All 3 validation checks pass:
  1. `rg "getCompanyFreshnessProfile" src/lib/research-engine/freshness-indicators.ts -n` → lines 77, 149 confirmed
  2. `rg "freshness" src/app/api/g-crm/ --glob *.ts -l` → shows both new route files + route.ts
  3. `rg "FRESHNESS_THRESHOLDS" src/lib/research-engine/freshness-indicators.ts` → threshold logic confirmed
- APIs available at `GET /api/g-crm/companies/[id]/freshness` and `GET /api/g-crm/freshness-overview`
---
Task ID: B4
Agent: full-stack-developer
Task: Governance dashboard

Work Log:
- Read existing audit API files (audit.ts, audit-logs.ts) and both router patterns (g-data/route.ts, g-crm/route.ts)
- Analyzed AIGenerationAudit model in prisma/schema.prisma to confirm field types (researchConfidence: Float, freshnessScore: Int, governancePassed: Boolean)
- Created `/src/app/api/g-data/[...slug]/governance-dashboard.ts` with comprehensive dashboard endpoint
  - Fixed Prisma groupBy issue: replaced invalid `having` clause with separate blocked-count query using `where: { governancePassed: false }`
  - Single findMany for both confidence and freshness distributions (avoids duplicate fetch)
  - 9 aIGenerationAudit queries total: 3 counts, 2 groupBy (type totals + blocked), 1 findMany (records), 1 findMany (recent blocked), 2 groupBy (company health + company passed)
- Registered `governance-dashboard` route in g-data router (import + ROUTES entry)
- Created `/src/app/api/g-crm/[...slug]/companies___id__governance.ts` with company-specific governance endpoint
  - Follows existing `{ params: Promise<{ id: string }> }` pattern used by all companies___id__* handlers in g-crm router
- Registered `companies/[id]/governance` route in g-crm router (import + ROUTES entry)
- Ran all 4 validation checks — all passed
- Ran lint — no new errors introduced (50 pre-existing errors in other files)

Stage Summary:
- Created 2 new API files: governance-dashboard.ts (g-data) and companies___id__governance.ts (g-crm)
- Registered both routes in their respective routers following existing patterns
- Governance dashboard provides: summary stats, generation type breakdown, confidence/freshness distributions, recent blocked generations, company-level health
- Company governance provides: per-company pass rate, per-type breakdown, recent 20 generations
- No schema modifications, no UI changes, no ai-governance.ts modifications
---
Task ID: C3
Agent: full-stack-developer
Task: Revenue intelligence analytics

Work Log:
- Analyzed existing Prisma schema: CompanySignal, SignalCapabilityMatch, CapabilityAsset, Draft, SendQueue, EmailEvent, EmailSequence, SequenceEnrollment, SequenceStep, Company
- Studied existing route registration pattern in `[...slug]/route.ts`
- Created `/src/app/api/g-data/[...slug]/revenue-intelligence.ts` with GET handler
  - Dimension 1: Signal Intelligence Funnel — groups by signalType, computes signalsDetected → capabilityMatched → engaged → replied → meetings → pipeline using set intersections
  - Dimension 2: Capability Intelligence — per-capability metrics (companiesDetected, engagements, replies, meetings, deals)
  - Dimension 3: Message Intelligence — THEME_KEYWORDS map for keyword-based theme extraction from draft subject/body, grouped performance metrics sorted by replyRate
  - Period filtering via `?period=30d|90d|all` query param
- Created `/src/app/api/g-data/[...slug]/sequence-analytics.ts` with GET handler
  - Sequence overview: total, signalDriven vs manual, enrollment counts by status
  - Sequence performance: per-sequence metrics with engagement aggregation from SendQueue and EmailEvent
  - Step conversion: draft outcomes grouped by stepNumber with open/reply rates
- Registered both routes in `[...slug]/route.ts` (imports + ROUTES entries)
- All 6 validation checks passed:
  1. `rg "revenue-intelligence"` — shows route.ts and revenue-intelligence.ts ✓
  2. `rg "sequence-analytics"` — shows route.ts and sequence-analytics.ts ✓
  3. `rg "THEME_KEYWORDS"` — shows theme map definition and usage ✓
  4. `rg "signalDriven"` — shows signal_driven counting ✓
  5. `rg "sendQueue.create"` — returns 0 results (read-only) ✓
  6. ESLint — 0 errors on new files ✓

Stage Summary:
- Created 2 new read-only analytics API files
- Registered both routes in the g-data router
- Revenue Intelligence: 3-dimension analytics (signal funnel, capability, message themes) computed entirely from existing tables
- Sequence Analytics: overview, per-sequence performance, step-level conversion rates
- No schema changes, no UI changes, no write operations
---
Task ID: C2
Agent: full-stack-developer
Task: Batch approval workflow with governance scores

Work Log:
- Explored existing codebase: Prisma schema (Draft, SendQueue, AIGenerationAudit, SignalCapabilityMatch, CompanySignal, Company models), existing drafts.ts approval pattern (lines 586-597), route.ts router registry, sequences.ts handler pattern
- Created `/src/app/api/g-outreach/[...slug]/review-queue.ts` — GET handler returning all pending_review drafts enriched with contact info, company info, governance audit data (from AIGenerationAudit), and priority classification based on intelligenceScore, signal impact, and researchConfidence
- Created `/src/app/api/g-outreach/[...slug]/drafts__batch.ts` — POST handler supporting batch approve/reject/assign/regenerate actions with per-draft error handling and result reporting
- Registered both routes in `[...slug]/route.ts` (review-queue before drafts, drafts/batch before drafts/[id] to prevent route shadowing)
- Ran all 5 validation checks — all passed

Stage Summary:
- Created 2 new API files: review-queue.ts and drafts__batch.ts
- Modified 1 file: route.ts (2 new imports, 2 new route entries)
- Review queue: batch-fetches governance audits, active signals, and capability matches for efficient enrichment; supports priority/assigneeId/limit filtering
- Batch actions: approve creates SendQueue + updates contact to queued; reject updates draft + sets contact to cleaned; assign updates assigneeId; regenerate stores feedback in reviewNotes
- sendQueue.create appears exactly 1 time in drafts__batch.ts (inside approve action only)
- Zero lint errors on new files

---
Task ID: C1
Agent: full-stack-developer
Task: Signal-driven sequence intelligence

Work Log:
- Read Prisma schema to understand EmailSequence (Phase 4 C1 fields), SequenceStep, SignalCapabilityMatch, CapabilityAsset, CompanySignal, Contact models
- Read existing ai-governance.ts to understand governedAICallAggregate API (non-company advisory generation type)
- Read existing sequences.ts, sequences__enroll.ts for route patterns
- Read route.ts to understand router registry and route ordering
- Read research-engine/index.ts for export patterns
- Created src/lib/research-engine/signal-sequence-engine.ts with generateSignalDrivenSequence function
  - Loads signal, capability match, capability asset, research card, and contact from DB
  - Builds comprehensive LLM context covering 4 "why" questions (company, timing, capability, person)
  - Uses governedAICallAggregate with generationType 'sequence_generation'
  - LLM generates 3-step sequence: executive insight, value proof, conversation request
  - Creates EmailSequence with companyId, triggerSignalId, triggerCapabilityMatchId, triggerReason, generatedBy='signal_driven'
  - Creates 3 SequenceStep records with stepNumber, subject, body, cta, delayDays
  - Parses LLM JSON response with validation and markdown fence stripping
- Created src/app/api/g-outreach/[...slug]/sequences__signal-driven.ts API endpoint
  - POST handler validates all 4 IDs, verifies entity existence and company ownership
  - Calls generateSignalDrivenSequence and returns created sequence
- Enhanced src/app/api/g-outreach/[...slug]/sequences.ts GET handler
  - Batch-loads signals and capability matches for all sequences
  - Loads capability titles separately (SignalCapabilityMatch has no Prisma relations)
  - Returns companyId, generatedBy, triggerReason in response
  - Attaches signal context (signalTitle, signalType, impact) when triggerSignalId exists
  - Attaches capability match context (capabilityTitle, matchScore, businessProblem) when triggerCapabilityMatchId exists
- Registered route in route.ts: import + route entry before sequences/[id]
- Exported generateSignalDrivenSequence from research-engine/index.ts

Stage Summary:
- Files created: src/lib/research-engine/signal-sequence-engine.ts, src/app/api/g-outreach/[...slug]/sequences__signal-driven.ts
- Files modified: src/app/api/g-outreach/[...slug]/sequences.ts (enhanced GET), src/app/api/g-outreach/[...slug]/route.ts (new route), src/lib/research-engine/index.ts (new export)
- Validation: all 5 grep checks pass, ESLint shows only 1 pre-existing error (Function type in route.ts line 82), zero new errors
---
Task ID: C1-integrate
Agent: full-stack-developer
Task: Update signal-driven sequence flow to consume OpportunityRecommendation

Work Log:
- Waited for C1 agent to complete (opportunity-recommendation-engine.ts confirmed after ~2.5 min)
- Read all relevant files: prisma/schema.prisma (EmailSequence model, OpportunityRecommendation model), sequences__signal-driven.ts, sequences.ts, signal-sequence-engine.ts, opportunity-recommendation-engine.ts
- Updated prisma/schema.prisma:
  - Added `opportunityId String?` field to EmailSequence model with comment
  - Added `opportunity OpportunityRecommendation? @relation(...)` relation on EmailSequence
  - Added `sequences EmailSequence[]` reverse relation on OpportunityRecommendation
  - Added `@@index([opportunityId])` index on EmailSequence
- Updated sequences__signal-driven.ts POST handler:
  - Now accepts two paths: NEW `{ opportunityId, contactId }` and LEGACY `{ companyId, signalId, capabilityMatchId, contactId }`
  - NEW path: loads OpportunityRecommendation, verifies status === 'accepted', verifies contact belongs to opportunity's company, calls generateSignalDrivenSequence with opportunity's companyId/signalId/capabilityMatchId, then updates the created sequence with opportunityId
  - LEGACY path: unchanged, still works exactly as before
  - Input validation rejects ambiguous/mixed input (both paths attempted simultaneously)
- Updated sequences.ts GET handler:
  - Added batch loading of OpportunityRecommendation records (opportunityIds) alongside signals and matches
  - Created opportunityMap for O(1) lookups
  - Added opportunity enrichment block: when seq.opportunityId is set, attaches { opportunityTitle, opportunityScore, suggestedConversation } to response

Validation Results:
1. `rg "opportunityId" prisma/schema.prisma -n` → lines 402, 409, 415 confirmed ✓
2. `rg "sequences.*EmailSequence" prisma/schema.prisma -n` → line 1128 (reverse relation) ✓
3. `rg "opportunityId" "src/app/api/g-outreach/[...slug]/sequences__signal-driven.ts" -n` → lines 16, 19, 21, 46, 51, 67, 91, 99, 109, 117, 120 confirmed ✓
4. `rg "opportunityId" "src/app/api/g-outreach/[...slug]/sequences.ts" -n` → lines 26-28, 40-50, 115, 116 confirmed ✓
5. ESLint on both modified files → 0 errors ✓
6. Prisma generate → success (v6.19.3) ✓

Migration Status:
- `prisma db push` failed due to pre-existing DATABASE_URL mismatch (env has SQLite URL, schema declares postgresql provider). This is NOT caused by C1-integrate changes.
- `prisma generate` succeeded — Prisma Client updated with new schema fields.
- Migration is needed once the DATABASE_URL is corrected or migrations are set up.

Stage Summary:
- Modified 3 files: prisma/schema.prisma, sequences__signal-driven.ts, sequences.ts
- Zero new files created
- Backward compatibility maintained — legacy path works exactly as before
- NEW path adds opportunityId to generated sequences and validates opportunity status
- GET handler enriches responses with opportunity context when linked

---
Task ID: C1
Agent: full-stack-developer
Task: OpportunityRecommendation Model, Engine, and API

Work Log:
- Read worklog.md, prisma/schema.prisma, ai-governance.ts, evidence-quality.ts, signal-sequence-engine.ts, route.ts, apiHelpers.ts to understand existing patterns
- Updated prisma/schema.prisma: added OpportunityRecommendation model (29 fields, 9 indexes) and Pursuit model (13 fields, 6 indexes)
- Added relation fields to Company (opportunityRecommendations, pursuits), CompanySignal (opportunityRecommendations), SignalCapabilityMatch (opportunityRecommendations)
- Created src/lib/research-engine/opportunity-recommendation-engine.ts with:
  - generateOpportunityRecommendation() — single recommendation from signal+match pair
  - generateCompanyOpportunities() — batch generation for all active signals with high-confidence matches
  - computeOpportunityScore() — pure function, weighted composite (confidence 30%, match 25%, freshness 20%, evidence 15%, impact 10%)
  - computeFreshnessFromResearchCard() — reads 4 domain timestamps, linear decay per lifecycle
  - Uses governedAICallAggregate with generationType 'opportunity_recommendation' (never callLLM directly)
  - LLM generates: opportunityTitle, businessTrigger, whyNow, businessProblem, suggestedConversation, recommendedStakeholders
- Created src/app/api/g-crm/[...slug]/opportunities.ts: GET (list with filters), POST (generate single or company-wide), PATCH (update status with transition guard, auto-creates Pursuit on accept)
- Created src/app/api/g-crm/[...slug]/opportunities__review.ts: GET (review queue, pending_review only), POST (batch accept/reject/monitor with per-item error handling)
- Created src/app/api/g-crm/[...slug]/pursuits.ts: GET (list with filters), PATCH (update any field)
- Registered 3 routes in route.ts (opportunities, opportunities/review, pursuits)
- Exported engine functions from research-engine/index.ts
- Prisma schema validated successfully; Prisma Client generated
- ESLint: zero new errors (1 pre-existing Function type error in route.ts line 141)

Stage Summary:
- Files created: opportunity-recommendation-engine.ts, opportunities.ts, opportunities__review.ts, pursuits.ts
- Files modified: prisma/schema.prisma (2 new models, 3 relation additions), route.ts (3 imports + 3 routes), research-engine/index.ts (4 exports)
- Prisma migration could not execute (no reachable PostgreSQL instance in sandbox) but schema is valid and Prisma Client was generated
- All new code passes ESLint with zero new errors
---
Task ID: C3
Agent: full-stack-developer
Task: Revenue intelligence analytics (opportunity-level intelligence effectiveness)

Work Log:
- Waited for C1 to complete (opportunity-recommendation-engine.ts confirmed after ~2.5 min)
- Read worklog.md, prisma/schema.prisma (OpportunityRecommendation, Pursuit, EmailSequence, Evidence, SignalCapabilityMatch, CapabilityAsset, CompanySignal models), existing revenue-intelligence.ts and sequence-analytics.ts
- Rewrote src/app/api/g-data/[...slug]/revenue-intelligence.ts with 5 intelligence dimensions:
  - Dimension 1 (Signal Intelligence): Funnel per signalType — signalsDetected → opportunitiesCreated → opportunitiesAccepted → qualifiedConversations → pipelineCreated → revenueWon, plus topConvertingSignals from accepted OpportunityRecommendations sorted by score
  - Dimension 2 (Capability Intelligence): Per-capability metrics — opportunitiesCreated, accepted, acceptanceRate (0-1), pursuitsActive, pursuitsWon, rejectionReasons distribution
  - Dimension 3 (Message Intelligence): Kept existing theme extraction with keyword map, added meeting counting by joining draft contacts to companies with pursuits in meeting+ stages
  - Dimension 4 (Recommendation Effectiveness — NEW): Total counts by status, rejectionBreakdown by rejectionReason, outcomeByStage distribution from Pursuit.outcomeStage
  - Dimension 5 (Intelligence Quality Metrics — NEW): signalsGeneratingOpportunities (signals with ≥1 OpportunityRecommendation vs total active), evidenceSourceEffectiveness (grouped by sourceUrl with sourceQualityTier), freshnessImpactOnAcceptance (fresh 70-100, aging 40-69, stale 0-39 buckets)
- Updated src/app/api/g-data/[...slug]/sequence-analytics.ts:
  - Added safeQuery wrapper for graceful fallback when opportunityId column/relation doesn't exist
  - Added opportunity include in EmailSequence findMany (with fallback query without it)
  - Added opportunityLinked count to sequenceOverview
  - Added opportunityId and opportunityTitle to each sequencePerformance entry
- All OpportunityRecommendation and Pursuit queries wrapped in safeQuery with empty-array fallbacks
- Uses apiSuccess/apiError and db imports exclusively, no callLLM

Validation Results:
1. `rg "safeQuery" src/app/api/g-data/ --type ts -l` → revenue-intelligence.ts + sequence-analytics.ts ✓
2. `rg "recommendationEffectiveness" revenue-intelligence.ts -n` → line 533 confirmed ✓
3. `rg "intelligenceQualityMetrics" revenue-intelligence.ts -n` → line 542 confirmed ✓
4. `rg "freshnessImpactOnAcceptance" revenue-intelligence.ts -n` → line 516 confirmed ✓
5. `rg "opportunityLinked" sequence-analytics.ts -n` → lines 192, 198 confirmed ✓
6. `rg "opportunityId.*seq.opportunity" sequence-analytics.ts -n` → line 255 confirmed ✓
7. ESLint: 0 errors in modified files (50 pre-existing errors in other files unchanged)

Stage Summary:
- 2 files modified: revenue-intelligence.ts (full rewrite), sequence-analytics.ts (opportunity-linked enhancement)
- 0 new files created
- 0 schema changes
- All queries to OpportunityRecommendation and Pursuit are gracefully degraded via safeQuery
- Revenue intelligence now focuses on intelligence effectiveness (opportunity funnel) instead of email metrics
- Sequence analytics now surfaces opportunity linkage data
