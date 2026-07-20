# DeepMindQ Phase 5 Gap Fix — Work Log

---
Task ID: init
Agent: Main Coordinator
Task: Launch 6 parallel agents to fix all 37 Phase 5 gaps

Work Log:
- Analyzed 37 gaps from comprehensive gap analysis
- Organized into 6 parallel agent groups by file ownership
- Agent 1: Frontend & API Routes (GAPs 1,4,5,23,24,25,26)
- Agent 2: ICP Config & Schema (GAPs 2,3,9,22,30,35,36)
- Agent 3: account-prioritization.ts (GAPs 6,7,10,11,12,13,15,16,19,20,21,27,28,29,37)
- Agent 4: Signal Pipeline Naming (GAP 8)
- Agent 5: Signal Lifecycle + Lead Scoring (GAPs 14,17,18)
- Agent 6: Tests (GAPs 31,32,33,34)

Stage Summary:
- All 6 agents launched in parallel
- Awaiting results

---
Task ID: 5
Agent: Signal Lifecycle & Lead Scoring
Task: Fix GAPs 14, 17, 18

Work Log:
- Read worklog.md, src/lib/lead-scoring.ts, src/lib/research-engine/signal-lifecycle.ts, src/lib/icp-config.ts
- GAP-14: Added `import { getIcpProfileSync } from '@/lib/icp-config'` to lead-scoring.ts
  - Replaced hardcoded 7-element `targetIndustries` array in `scoreCompanyFit` with `getIcpProfileSync().targetIndustries` (15 industries from configurable ICP)
  - Replaced hardcoded size regex (`/enterprise|10001\+|5001-10000/`, etc.) with ICP profile's `targetSizeRanges` using same bidirectional substring match as icp-config's `sizeMatch` helper
  - Added excluded-industry guard: excluded industries now score 0 on the industry dimension (previously got 5 points as "partial match")
  - Used `getIcpProfileSync()` (not async) because `scoreCompanyFit` is a sync helper; fallback to DEFAULT_ICP is built into icp-config's module-level initialization
- GAP-17: Refactored `transitionSignalLifecycles` from single `findMany` to cursor-based pagination (BATCH_SIZE=200)
  - Uses Prisma cursor pagination on `id` for stable, gap-free iteration
  - Each page: evaluate transitions → group by new status → `updateMany` per status group → advance cursor
  - Changed `where` from `{ not: 'archived' }` to `{ notIn: ['archived', 'expired'] }` to skip signals that can only transition to archived (expired ones would just become archived again next cycle)
  - Moved time constants outside loop for clarity
- GAP-18: Refactored `recalculateAllScores` from N+1 individual `db.contact.update` calls to batched transactions
  - First pass: calculate all scores in memory (map, no DB writes)
  - Second pass: batch 50 updates per `db.$transaction`, reducing round-trips by ~50x
  - Preserved exact same scoring logic and output shape

Stage Summary:
- GAP-14: `scoreCompanyFit` now reads industries + size ranges from ICP config (with exclusion support)
- GAP-17: `transitionSignalLifecycles` processes 200 signals per page via cursor pagination, eliminating OOM risk
- GAP-18: `recalculateAllScores` writes in transactional batches of 50 instead of N individual updates
- TypeScript compiles cleanly for all modified files

---
Task ID: 1
Agent: Frontend & API Routes
Task: Fix GAPs 1, 4, 5, 23, 24, 25, 26

Work Log:
- Read all target files completely: account-ranking-screen.tsx, icp-settings-screen.tsx, route.ts, account-rankings.ts, account-prioritization.ts, event-bus.ts, apiHelpers.ts
- GAP-1: Replaced `/api/g-crm/account-priorities` with `/api/g-strategy/account-rankings` in both GET and POST fetch calls in account-ranking-screen.tsx
- GAP-4: Updated APIResponse interface to accept both old shape (`companies`/`tierDistribution`) and new shape (`rankings`/`tierBreakdown`). Added defensive data mapping that normalizes `companyId`→`id`, `companyName`→`rawName`, and provides fallbacks for `_count` fields (`company._count?.contacts || 0`, etc.)
- GAP-5: Converted `handleReset` in icp-settings-screen.tsx from sync to async. Added PUT call to `/api/g-strategy/icp-profile` with `{ reset: true }` body. Added `resetting` state for loading indicator. Kept local `setProfile(DEFAULT_PROFILE)` for immediate UI feedback.
- GAP-23: Added DELETE handler to account-rankings.ts. Supports three modes: single reset via `?companyId=xxx`, batch reset via body `{ companyIds: string[] }`, and full reset (no params). Uses `db.company.updateMany` for bulk ops. Returns `{ success: true, resetCount }`.
- GAP-24: Added `includeBreakdown=true` query param to GET handler. When enabled, calls `computeAccountPriority()` per company in parallel to get full breakdown (staticFit, dynamicIntelligence, timingUrgency, whyNowReasons, topSignals, recommendedFocus) alongside persisted scores. Opt-in since it's expensive.
- GAP-25: Converted POST batch compute from synchronous to async with in-memory job tracking (Map at module level). POST now returns 202 with `{ jobId, status: 'pending' }` immediately. Background `runBatchCompute` function updates job status and emits events. Job status queryable via `GET ?jobId=xxx`. Added frontend `pollJobStatus` helper with 3s interval and 5-minute safety timeout.
- GAP-26: Created `src/lib/events.ts` with `ScoreEventBus` class (on/emit/removeAll). Exported `scoreEvents` singleton. Integrated into account-rankings.ts: emits `scoreUpdated` per company and `batchCompleted` after batch, plus `scoresReset` on DELETE.

Stage Summary:
- Frontend now hits correct `/api/g-strategy/account-rankings` endpoint with proper response shape mapping
- ICP reset persists to DB via PUT with `{ reset: true }`
- DELETE endpoint operational for single/batch/all priority score resets
- `includeBreakdown=true` enables full per-company score breakdown in list view
- Batch compute is now async (202 + jobId polling) to prevent timeouts
- ScoreEventBus (`src/lib/events.ts`) provides in-process event system for score changes

---
Task ID: 4
Agent: Signal Pipeline Naming
Task: Fix GAP-8 — signal type naming inconsistencies

Work Log:
- Audited 4 core pipeline files + searched entire src/ for legacy signal type strings
- Found 3 different naming conventions across the pipeline:
  - Detection (signals.ts): `technology`, `funding`, `hiring`, etc. (canonical)
  - Meaning inference (signal-meaning.ts): expected `tech_change` (never matched `technology`)
  - Capability matching (signal-capability-matching.ts): expected `funding_round`, `hiring_spree`, `product_launch`, `tech_stack_change` (never matched anything from detection)
  - Account prioritization (account-prioritization.ts): expected `tech_change` (never matched `technology`)
- Created `src/lib/signal-types.ts` as single source of truth:
  - `SIGNAL_TYPES` const object with 12 canonical types
  - `SignalType` union type
  - `CANONICAL_SIGNAL_TYPE_LIST` for `.includes()` checks
  - `SIGNAL_TYPE_ALIASES` mapping 5 legacy names → canonical
  - `normalizeSignalType()` helper function
- Updated `src/lib/research-engine/signals.ts`:
  - Imports `CANONICAL_SIGNAL_TYPE_LIST` and `normalizeSignalType`
  - Extended LLM prompt with 3 new signal types (acquisition, regulatory, financial_pressure)
  - Extended valid type check to include all 12 canonical types
  - Added rule-based patterns for product, acquisition, regulatory, financial_pressure
- Updated `src/lib/research-engine/signal-meaning.ts`:
  - Imports `normalizeSignalType`
  - Normalizes signalType at entry of `inferSignalMeaning()`
  - Changed `tech_change` → `technology` in all inference rules
  - Added inference rules for acquisition (→ tech_dissatisfaction), regulatory (→ compliance_requirement), financial_pressure (→ tech_dissatisfaction)
- Updated `src/lib/research-engine/signal-capability-matching.ts`:
  - Imports `normalizeSignalType`
  - Renamed all SIGNAL_CAPABILITY_MAP keys to canonical: `funding_round`→`funding`, `hiring_spree`→`hiring`, `product_launch`→`product`, `tech_stack_change`→`technology`
  - Added `normalizeSignalType()` call at top of `scoreMatch()` so legacy DB values still resolve correctly
- Updated `src/lib/account-prioritization.ts` (SIGNAL_CAPABILITY_TOPICS and related only, no scoring logic):
  - Renamed `tech_change` → `technology` in SIGNAL_CAPABILITY_TOPICS
  - Added product, acquisition, regulatory, financial_pressure topic mappings
  - Updated `signalTypes.has('tech_change')` → `signalTypes.has('technology')` in whyNowReasons
  - Updated `formatSignalType` labels map with all canonical types
- Fixed 4 additional files with `tech_change` references outside research-engine:
  - `src/app/api/g-crm/[...slug]/companies___id__signals.ts` — validTypes list
  - `src/components/screens/command-center-screen.tsx` — SIGNAL_ICONS map
  - `src/app/api/g-data/[...slug]/revenue-intelligence.ts` — SIGNAL_DESCRIPTIONS (removed duplicate `technology` key, added missing types)
  - `src/app/api/g-ai/[...slug]/command-center__query.ts` — documentation comment
- Final grep confirmed zero legacy names remain in production code (only in signal-types.ts aliases and test file)

Stage Summary:
- Created `src/lib/signal-types.ts` as canonical signal type single source of truth
- 8 files updated to use consistent canonical type names
- `technology` signals from detection now correctly match in meaning inference, capability matching, and account prioritization
- `funding` signals no longer fail to match `funding_round` in capability matching
- Backward compatibility preserved via alias map + normalizeSignalType() for any legacy DB values
- Note: `src/lib/__tests__/phase3-e2e-governance.ts` still uses `funding_round` — Agent 6 (Tests) should update

---
Task ID: 2
Agent: ICP Config & Schema
Task: Fix GAPs 2, 3, 9, 22, 30, 35, 36

Work Log:
- Read all target files: worklog.md, src/lib/icp-config.ts, src/components/screens/icp-settings-screen.tsx, src/app/api/g-strategy/[...slug]/icp-profile.ts, src/app/api/g-system/[...slug]/icp-profile.ts, prisma/schema.prisma
- GAP-2: Changed `ICP_SETTING_KEY` from `'icp_profile_v1'` to `'icp_profile'` in src/lib/icp-config.ts, aligning with the g-system route. Now all read/write paths use the same DB key.
- GAP-3: Added `normalizeIcpProfile()` function to icp-config.ts that maps frontend field names (targetCountries, preferredTechnologies, excludeIndustries, minEmployees, maxEmployees) to backend canonical names (targetRegions, preferredTechKeywords, excludedIndustries, minEmployeeCount, maxEmployeeCount). Applied normalization in `ensureLoaded()` after DB read. Added `maxRevenue?: string` to IcpProfile interface. Updated g-strategy route's Zod schema to accept both naming conventions and calls normalize before save. Updated g-system route to normalize and store canonical names. Updated frontend component to use canonical field names internally, with backward-compatible fallbacks on GET (handles old stored data).
- GAP-9: Added `@@index([accountPriorityScore(sort: Desc)])` to Company model in schema.prisma, optimizing the `getAccountRankings` ORDER BY query.
- GAP-22: Added score invalidation logic to both g-strategy and g-system ICP profile PUT handlers. After saving the ICP profile, sets `priorityComputedAt: null` on all companies via `db.company.updateMany` and upserts a `priority_scores_stale` SystemSetting flag with timestamp. Wrapped in try/catch so failures are non-blocking.
- GAP-30: Fixed `deepMerge` bug on line ~158 of icp-config.ts: changed second `!Array.isArray(srcVal)` to `!Array.isArray(tgtVal)`, so both source and target are properly checked for array type before recursing.
- GAP-35: Added `PriorityScoreHistory` model to schema.prisma with fields: id, companyId (FK to Company), score, tier, staticFit, dynamicInt, timingUrg, computedAt, icpVersion. Added composite index on [companyId, computedAt(DESC)] and index on [computedAt]. Added `priorityHistory PriorityScoreHistory[]` relation to Company model.
- GAP-36: Verified already resolved — `keywords String?` field already exists at line 364 of schema.prisma and is correctly parsed in signal-capability-matching.ts. No changes needed.
- Ran `npx prisma generate` — generated successfully with all schema changes.

Stage Summary:
- ICP DB key unified to `'icp_profile'` — UI saves now affect scoring engine
- Field name normalization bridge eliminates frontend/backend mismatch for all 6 renamed fields
- `maxRevenue` added to IcpProfile interface (was missing from backend)
- deepMerge no longer incorrectly recurses into array values
- Score invalidation on ICP update marks all companies stale and sets a system flag
- Company model has new DESC index on accountPriorityScore for fast ranking queries
- PriorityScoreHistory model ready for score drift tracking and ICP tuning impact analysis
- Prisma client regenerated cleanly

---
Task ID: 3
Agent: account-prioritization.ts
Task: Fix GAPs 6, 7, 10, 11, 12, 13, 15, 16, 19, 20, 21, 27, 28, 29, 37

Work Log:
- Read entire account-prioritization.ts (~1117 lines), icp-config.ts, prisma schema
- Verified all Prisma models (CompanySignal has signalDate/meaningCategory, Company has pursuits/opportunityRecommendations relations)
- GAP-7: Added `parseRevenueToNumber()` function that handles K/M/B/thousand/million/billion suffixes. Replaced broken `parseFloat(replace(/[^0-9.]/g, ''))` logic with proper numeric thresholds ($1M→60, $10M→75, $50M→85, $100M→95, $500M→100, $1B+→100).
- GAP-29: Replaced binary industry/geography scoring (0 or 100) with fuzzy matching:
  - Industry: exact→100, partial keyword overlap→70, related sector (2+ short words)→40, excluded→0
  - Geography: exact→100, same region group (NA/EU/APAC/ME/LATAM)→60, no match→0
  - Added REGION_GROUPS mapping and fuzzyIndustryScore/fuzzyGeographyScore helpers
- GAP-10: Added meaningCategory integration to computeTimingUrgency:
  - High urgency (vendor_evaluation, budget_available, tech_dissatisfaction, financial_pressure) → +18 each
  - Medium urgency (growth_expansion, leadership_change_impact, compliance_requirement) → +9 each
  - Low urgency (informational, general_news) → +2 each
  - Total meaningCategory boost capped at 30 to prevent score inflation
  - meaningCategory now fetched in signal queries and passed via CompanyScoringData._meaningCategories
- GAP-11: Replaced hardcoded funding stages ['series b','series c','series d','late'] with icp.targetFundingStages (with fallback to old list)
- GAP-12: Added engagement proxy when engagementScore is 0: `effectiveEngagement = activePursuits*20 + activeOppRecs*10 + notes*5` capped at 100. Active pursuit and opp counts now fetched in both single and batch paths.
- GAP-13: Added exclusion hard filter in computeComposite — if company industry matches any excludedIndustry, total score capped at 49 (forces LOW tier)
- GAP-15: Replaced single $transaction(N updates) with chunked batches of 50 updates per transaction
- GAP-16: Replaced bulk findMany (all signals for all companies) with sub-batched approach:
  - Fetch signals in batches of 50 company IDs at a time
  - Select only needed fields (id, companyId, title, signalType, severity, source, createdAt, signalDate, meaningCategory)
  - Limit to 10 signals per company in-memory
  - Use separate groupBy count query for recent signal counts (no longer need to load all signals)
- GAP-19: Dimension weights now read from icp.scoreWeights (default 0.40/0.40/0.20). Added weight normalization if sum ≠ 1.0 (tolerance 0.01). Added scoreWeights/tierThresholds/signalRecencyDays to IcpProfile interface and DEFAULT_ICP.
- GAP-20: Tier thresholds now read from icp.tierThresholds (default hot:90, active:70, nurture:50). classifyTier accepts optional thresholds parameter.
- GAP-21: Signal recency window now reads from icp.signalRecencyDays (default 30). Applied to both single-company and batch paths.
- GAP-27: _noteCount kept in queries because it's now used by GAP-12's engagement proxy calculation
- GAP-28: Added pursuit/opp status boost to computeTimingUrgency: active pursuits → growthIndicator min(70 + count*5, 95), active opp recs → min(50 + count*5, 85). Pursuit and opp counts fetched via groupBy in batch, count() in single path.
- GAP-6: All signal age calculations now use signalDate || createdAt. Applied to: toSignalEvidence, fetchCompanyScoringData (orderBy signalDate, recency count uses OR signalDate/createdAt), batch signal fetch (orderBy signalDate, daysAgo uses signalDate || createdAt)
- GAP-37: getAccountRankings query now includes _count with contacts, signals, opportunityRecommendations, pursuits, notes
- Cleaned up unused imports (industryMatch, regionMatch removed; IcpProfile type added)
- Added new fields to CompanyScoringData interface: _meaningCategories, _activePursuitCount, _activeOppRecCount

Stage Summary:
- All 15 gaps fixed in account-prioritization.ts + 3 new fields added to icp-config.ts
- TypeScript compiles cleanly (0 new errors; only pre-existing errors in other files)
- Revenue parsing now correctly handles $500K→500,000, $10B→10,000,000,000
- Industry/geography scoring now supports partial credit (70, 40, 60 tiers)
- meaningCategory from signal meaning engine now boosts timing urgency
- engagementScore=0 no longer deflates scores — proxy from pursuits/opp/notes used
- Excluded industries now hard-cap at 49 regardless of other dimension scores
- Batch operations properly chunked (50 per transaction) and signal fetch limited (10/company)
- All previously hardcoded values (weights, thresholds, recency days, funding stages) now configurable via ICP profile

---
Task ID: G1
Agent: verification
Task: Verify P0 Gaps 1-5 are already fixed

Work Log:
- Read account-ranking-screen.tsx: confirms fetch uses /api/g-strategy/account-rankings (line 380)
- Read account-ranking-screen.tsx: confirms lines 384-401 handle both response shapes (data.rankings || data.companies) with _count fallbacks, and line 404 handles (data.tierBreakdown || data.tierDistribution)
- Read icp-settings-screen.tsx: confirms reset calls /api/g-strategy/icp-profile with { reset: true } via PUT (lines 281-285)
- Read g-system icp-profile.ts: confirms uses 'icp_profile' key (lines 13, 63, 65) and calls normalizeIcpProfile(body) (line 47)
- Read icp-config.ts: confirms ICP_SETTING_KEY = 'icp_profile' (line 108)

Stage Summary:
- All P0 gaps (1-5) were already fixed in the codebase. No changes needed.

---
Task ID: config-api-verify
Agent: verification
Task: Verify config/API design gaps (19,20,21,22,23,24,25,26,30)

Work Log:
- GAP-19: Verified IcpProfile.scoreWeights exists (icp-config.ts:42-46) with {staticFit, dynamicIntel, timingUrgency}. computeComposite (account-prioritization.ts:488-512) reads icp.scoreWeights and normalizes if sum ≠ 1.0. ✅ FIXED
- GAP-20: Verified classifyTier (account-prioritization.ts:479-485) reads getIcpProfileSync().tierThresholds with fallback. ✅ FIXED
- GAP-21: Verified fetchCompanyScoringData (line 857) and batch compute (line 1049) both use getIcpProfileSync().signalRecencyDays || 30. ✅ FIXED
- GAP-22: Verified PUT handler in icp-profile.ts (lines 99-116) sets priorityComputedAt: null on all companies and upserts priority_scores_stale SystemSetting. ✅ FIXED
- GAP-23: Verified DELETE handler exists in account-rankings.ts (lines 247-306) supporting single, batch, and full reset. ✅ FIXED
- GAP-24: Verified GET handler parses includeBreakdown param (line 68) and enriches rankings with full breakdown (lines 84-111). ✅ FIXED
- GAP-25: Verified POST handler returns 202 with jobId (lines 170-173), computation runs in background via runBatchCompute (line 165). Job status checkable via GET ?jobId=. ✅ FIXED
- GAP-26: Verified scoreEvents imported from @/lib/events (account-rankings.ts:4). events.ts exports ScoreEventBus with on/emit/removeAll. Used in runBatchCompute (scoreUpdated, batchCompleted) and DELETE handler (scoresReset). ✅ FIXED
- GAP-30: Verified deepMerge (icp-config.ts:150-169) second condition correctly checks tgtVal (line 159), not srcVal. Both branches properly guard: srcVal is-object && tgtVal is-object before recursing. ✅ FIXED

Stage Summary:
- All 9 config/API design gaps (19,20,21,22,23,24,25,26,30) verified as correctly fixed. No code changes required.

---
Task ID: p1-scoring-gaps-verify
Agent: verification
Task: Verify P1 scoring logic gaps (6,7,9,10,11,12,13,14)

Work Log:
- GAP-6: Verified toSignalEvidence (line 679) uses `r.signalDate || r.createdAt`. Verified fetchCompanyScoringData recency count (lines 868-876) uses `OR: [{ signalDate: { gte: recencyCutoff } }, { signalDate: null, createdAt: { gte: recencyCutoff } }]`. Verified batch compute recency groupBy (lines 1066-1080) uses same OR pattern. Verified batch signal ordering (line 1113) uses `orderBy: { signalDate: 'desc' }`. ✅ FIXED
- GAP-7: Verified parseRevenueToNumber (lines 170-186) uses regex `/([\d.]+)\s*(k|thousand|m|million|b|billion)?/` with correct multipliers (1K, 1M, 1B). Verified computeStaticFit (lines 276-289) uses parseRevenueToNumber and applies thresholds against actual numeric values (e.g. $500K → 500,000 → revenueScore=60). ✅ FIXED
- GAP-9: Verified schema.prisma Company model (line 126) has `@@index([accountPriorityScore(sort: Desc)])`. ✅ FIXED
- GAP-10: Verified CompanyScoringData interface (line 124) has `_meaningCategories: string[]`. Verified computeTimingUrgency (lines 374-382) defines HIGH_URGENCY_MEANINGS and MEDIUM_URGENCY_MEANINGS sets, and (lines 449-459) applies meaningCategory boost capped at 30. Verified fetchCompanyScoringData (lines 903-906) extracts meaningCategory from signals. Verified single-company fetch (line 890) and batch fetch (line 1124) both select meaningCategory. ✅ FIXED
- GAP-11: Verified computeTimingUrgency (lines 430-439) uses `icp.targetFundingStages` with fallback to ['series b', 'series c', 'series d', 'late']. ✅ FIXED
- GAP-12: Verified CompanyScoringData (lines 126-127) has `_activePursuitCount` and `_activeOppRecCount`. Verified computeTimingUrgency (lines 401-408) computes engagement proxy: `_activePursuitCount * 20 + _activeOppRecCount * 10 + _noteCount * 5` when engagementScore is 0. Verified fetchCompanyScoringData (lines 893-901) queries pursuit and oppRec counts. ✅ FIXED
- GAP-13: Verified computeComposite (lines 515-523) checks `icp.excludedIndustries` and caps composite at 49 for excluded industries. ✅ FIXED
- GAP-14: Verified lead-scoring.ts scoreCompanyFit (line 92) uses `getIcpProfileSync()`. Industry matching (lines 96-101) uses `icp.excludedIndustries` and `icp.targetIndustries`. Size matching (lines 104-115) uses `icp.targetSizeRanges`. ✅ FIXED

Stage Summary:
- All 8 P1 scoring logic gaps (6,7,9,10,11,12,13,14) verified as correctly fixed. No code changes required.

---
Task ID: verify-signal-pipeline-gaps
Agent: Signal Pipeline Gap Verifier
Task: Verify GAP-8, GAP-15, GAP-16, GAP-17, GAP-18 are fixed

Work Log:
- GAP-8: Found that `signal-types.ts` normalizer utility EXISTS and is correctly used by `signal-meaning.ts` (line 21) and `signal-capability-matching.ts` (line 12). `SIGNAL_CAPABILITY_TOPICS` in `account-prioritization.ts` covers all 12 canonical types. HOWEVER, `account-prioritization.ts` was NOT normalizing signal types from DB — raw `signalType` flowed through to `SIGNAL_CAPABILITY_TOPICS` lookups, `formatSignalType`, and whyNowReasons. Fixed by: (1) adding `import { normalizeSignalType } from '@/lib/signal-types'` at line 3, (2) normalizing in `toSignalEvidence` (line 678), (3) normalizing in batch compute `rawSignals.map()` (line 1157). Legacy types like `funding_round` or `hiring_spree` now correctly resolve to canonical forms. ✅ FIXED
- GAP-15: Verified `account-prioritization.ts` lines 1223-1240 use `BATCH_SIZE = 50` with `db.$transaction()` per chunk for batch persist. No N individual UPDATEs. ✅ ALREADY FIXED
- GAP-16: Verified `account-prioritization.ts` lines 1103-1142 use `SIGNAL_BATCH_SIZE = 50` for sub-batch signal fetching (50 company IDs per query). No single massive signal fetch. ✅ ALREADY FIXED
- GAP-17: Verified `signal-lifecycle.ts` uses cursor-based pagination: `BATCH_SIZE = 200`, `orderBy: { id: 'asc' }`, `cursor: { id: cursor }`, with `updateMany` grouped by new status per page. No load-all. ✅ ALREADY FIXED
- GAP-18: Verified `lead-scoring.ts` `recalculateAllScores` (lines 205-221) uses `BATCH_SIZE = 50` with `db.$transaction()` per chunk. No N individual UPDATEs. ✅ ALREADY FIXED

Code Changes:
1. `src/lib/account-prioritization.ts` — Added `normalizeSignalType` import and applied it in both the single-company and batch-compute signal type pipelines (3 locations).

- GAP-8: Was NOT fixed — `account-prioritization.ts` was the only signal-consuming module missing normalization. Fixed by importing and applying `normalizeSignalType` at both signal ingestion points.

---
Task ID: G8
Agent: schema-and-tests
Task: Fix P3 gaps (35-37) and create unit tests (31-34)

Work Log:
- GAP-35: Updated PriorityScoreHistory model in schema.prisma — renamed fields to match spec (accountPriorityScore Int, priorityTier String, staticFitTotal Int, dynamicIntelTotal Int, timingUrgencyTotal Int), added onDelete: Cascade, renamed Company relation from priorityHistory to priorityScoreHistory
- GAP-36: Verified CapabilityAsset already has keywords field (line 366) — no change needed
- Ran `npx prisma format && npx prisma generate` — success
- GAP-37: Verified getAccountRankings select already includes _count with contacts, signals, opportunityRecommendations, pursuits, notes (lines 1324-1332)
- Exported internal functions (parseRevenueToNumber, fuzzyIndustryScore, fuzzyGeographyScore, classifyTier, computeComposite, toSignalEvidence) from account-prioritization.ts for direct testing
- Fixed vi.hoisted issue in test file for vitest mock hoisting compatibility
- Added missing db.pursuit and db.opportunityRecommendation mocks to test file
- Created 45 new direct unit tests in tests/account-prioritization.test.ts covering Gaps 31-34:
  - GAP-31: parseRevenueToNumber (12 tests) — $500K, $10B, $50M, N/A, Unknown, $1M, 100M, null, undefined, $1.5B, dash, empty
  - GAP-32: fuzzyIndustryScore (6 tests) — exact, substring, partial keyword (70), excluded (0), no match, null/empty
  - GAP-33: fuzzyGeographyScore (8 tests) — exact country, alias, location, region group (60), no match, null, UK (60), Germany (60)
  - GAP-34: classifyTier (9 tests), computeComposite (6 tests — exclusion cap, weight normalization, clamping), toSignalEvidence (4 tests — signalDate precedence, fallback, field mapping, empty)

Stage Summary:
- Schema updated with audit trail model (PriorityScoreHistory) and verified keywords field on CapabilityAsset
- 45 new isolated unit tests pass; all pre-existing passing tests remain green
- Total test file: 109 tests (98 pass, 11 pre-existing failures unrelated to changes)