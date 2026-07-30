# Ticket 2: Intelligence API Layer Refactor — Post-Fix Re-Audit Report
## 165 Original Gaps Re-Verified | Evidence-Based | Line-by-Line

**Audit Date**: 2026-07-30 (Post-Fix)
**Previous Audit**: TICKET2_GAP_ANALYSIS.md (165 gaps)
**Method**: Full re-enumeration — every original gap verified against current code
**Verification**: `tsc --noEmit` passes ✅ | 56/56 ticket2 tests pass ✅

---

## EXECUTIVE SUMMARY

| Metric | Count |
|--------|-------|
| **Original Gaps** | 165 |
| **FIXED** | 95 (57.6%) |
| **STILL OPEN** | 53 (32.1%) |
| **PARTIALLY FIXED** | 3 (1.8%) |
| **NEW Gaps Introduced by Fixes** | 14 (8.5%) |
| **Total Active Gaps** | **70** |

### Verdict: ❌ TICKET 2 EXIT CRITERIA NOT MET

| Exit Criterion | Status | Blocking Gap Count |
|----------------|--------|--------------------|
| All 6 endpoints support `?include=` with selective loading | **FAIL** | 18 (A1–A18) |
| Response types match `IntelligenceResponse` from types.ts | **FAIL** | 5 (E1–E5) |
| No N+1 queries | **PASS** | 0 (C1–C6 all fixed) |
| Cache-Control headers present | **FAIL** | 1 (D1 — company route) |
| Tests exist | **FAIL** | 8 missing (G17–G41 subset) |

---

## DETAILED GAP-BY-GAP STATUS

---

## CATEGORY A: ?include= SELECTIVE LOADING — 18 gaps, ALL STILL OPEN

**Status: 0/18 FIXED, 18/18 OPEN** ❌

The type system (VALID_INCLUDES, IntelligenceInclude, includeSchema) was updated with all spec'd keys — but **zero route implementations were added**. The company route (reference implementation) is correct; the other 5 primary routes have no selective loading.

| # | Route | Missing Include Key | Status | Evidence |
|---|-------|---------------------|--------|----------|
| A1 | reasoning | `impact` | **OPEN** | `shouldInclude` NOT imported. Only `steps` checked at line 44. Zero code for `impact`. |
| A2 | reasoning | `recommendations` | **OPEN** | Same — zero code for `recommendations`. |
| A3 | opportunity | `scores` | **OPEN** | `shouldInclude` NOT imported. `ScoringEngine.score()` runs unconditionally at line 82. |
| A4 | opportunity | `fusion` | **OPEN** | Fusion DB query runs unconditionally at lines 114–146. |
| A5 | opportunity | `capabilities` | **OPEN** | Zero code for capabilities selective loading. |
| A6 | opportunity | (route-wide) | **OPEN** | ZERO `shouldInclude()` calls anywhere. |
| A7 | action | `recommendations` | **OPEN** | `shouldInclude` IS imported but only gates `'learning'` (line 81). No `recommendations`. |
| A8 | action | `sequences` | **OPEN** | Zero code for sequences. |
| A9 | conversation | `talkingPoints` | **OPEN** | `shouldInclude` IS imported but only gates `'learning'`. Zero code for spec'd includes. |
| A10 | conversation | `objections` | **OPEN** | Same. |
| A11 | conversation | `buyerProfiles` | **OPEN** | Same. |
| A12 | conversation | (engine always runs) | **OPEN** | `ConversationEngine.brief()` always called at line 80. No selective gate. |
| A13 | conversation | (brief always built) | **OPEN** | Brief always constructed at lines 125–155. No conditional. |
| A14 | conversation | wrong include | **OPEN** | Implements `?include=learning` (NOT in spec) while missing all 3 spec'd includes. |
| A15 | mindmap | `nodes` | **OPEN** | `shouldInclude` NOT imported. Nodes loaded unconditionally at lines 72–88, 94–126. |
| A16 | mindmap | `edges` | **OPEN** | Edges always built at lines 129–139. No gate. |
| A17 | mindmap | `knowledgeConnections` | **OPEN** | Zero code anywhere. |
| A18 | mindmap | (route-wide) | **OPEN** | ZERO `shouldInclude()` calls. |

**Root Cause**: The "fix" only updated the type system (middleware.ts, types.ts, validators.ts) with the new keys but never touched the 5 non-company route implementations.

---

## CATEGORY B: INCLUDE KEY TYPE SYSTEM MISMATCH — 37 gaps, ALL FIXED

**Status: 37/37 FIXED** ✅

All 12 previously missing keys (`steps, impact, recommendations, scores, fusion, capabilities, sequences, talkingPoints, objections, buyerProfiles, nodes, edges, knowledgeConnections, ingestion`) are now present in all 3 locations:
- `VALID_INCLUDES` in middleware.ts:19–36
- `IntelligenceInclude` in types.ts:56–89
- `includeSchema`/`getValidIncludeKeys()` in validators.ts:34–44

---

## CATEGORY C: SEQUENTIAL QUERIES / N+1 RISK — 6 gaps, ALL FIXED

**Status: 6/6 FIXED** ✅

| # | Route | Fix Evidence |
|---|-------|-------------|
| C1 | company | L132–353: All 6 sections (signals, contacts, timeline, knowledge, mindmap, researchCard) in single `Promise.all()` |
| C2 | company | L321–352: researchCard IIFE is 6th element in same Promise.all |
| C3 | company | L284–291: Internal `Promise.all([contactCount, signalCount, companyFusionResults])` for mindmap |
| C4 | retrieval | L110–113: `Promise.all([RetrievalEngine.search(...), RetrievalEngine.getStats()])` |
| C5 | conversation | L79–101: `Promise.all([ConversationEngine.brief(...), learningQuery])` |
| C6 | action | L79–101: `Promise.all([ActionEngine.recommend(...), learningQuery])` |

---

## CATEGORY D: MISSING CACHE-CONTROL HEADERS — 10 gaps, 9 FIXED, 1 OPEN

**Status: 9/10 FIXED** ✅

| # | Route | Status | Evidence |
|---|-------|--------|----------|
| D1 | **company** | **OPEN** | L545: `Response.json(..., { headers: responseHeaders })` — no Cache-Control. Only route missing it. |
| D2 | reasoning | FIXED | L194: `'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'` |
| D3 | opportunity | FIXED | L195: same |
| D4 | action | FIXED | L159: same |
| D5 | conversation | FIXED | L193: same |
| D6 | mindmap | FIXED | L177: same |
| D7 | brief | FIXED | L197: same |
| D8 | grounding | FIXED | L132: same |
| D9 | retrieval | FIXED | L163: same |
| D10 | knowledge | FIXED | L168: same |

---

## CATEGORY E: RESPONSE TYPE ENVELOPE GAPS — 5 gaps, ALL OPEN

**Status: 0/5 FIXED, 5/5 OPEN** ❌

| # | Route/File | Description | Status | Evidence |
|---|-----------|-------------|--------|----------|
| E1 | guard.ts L65,76,89,111,163 | `endpoint as 'company'` cast — `endpoint: string` narrowed to literal union in all 5 error paths | **OPEN** | String typed param force-cast to `EndpointName` |
| E2 | knowledge L146–153 | `ingestionStats` always present (as `null`) even when `?include=ingestion` NOT requested | **OPEN** | Type `IntelligenceKnowledgeOutput.ingestionStats` is required (`IntelligenceKnowledgeIngestionStats | null`) |
| E3 | conversation L158–169 | `pastLearnings` always present (empty `[]`) when `?include=learning` not requested | **OPEN** | `IntelligenceConversationOutput.pastLearnings` is required array |
| E4 | action L125–135 | `learningInsights` always present (empty `[]`) when `?include=learning` not requested | **OPEN** | `IntelligenceActionOutput.learningInsights` is required array |
| E5 | opportunity L159–171 | `scores`, `reasoning`, `actions` always present regardless of `?include=` | **OPEN** | All 3 are required fields on `IntelligenceOpportunity` |

**Root Cause**: For E2–E4, the type definitions make fields required instead of optional. For E5, the types and the route both need restructuring. For E1, the `intelligenceGuard` parameter type needs to be `EndpointName` instead of `string`.

---

## CATEGORY F: MIDDLEWARE USAGE GAPS — 9 gaps, 7 FIXED, 2 OPEN

**Status: 7/9 FIXED** ✅

| # | Description | Status | Evidence |
|---|-------------|--------|----------|
| F1 | company route double params extraction | **OPEN** | L51: `const { id: companyId } = await params` then L54: `intelligenceGuard(request, params, 'company')` — guard re-extracts same id |
| F2 | reasoning double params | FIXED | No manual extraction before guard |
| F3 | opportunity double params | FIXED | No manual extraction before guard |
| F4 | action double params | FIXED | No manual extraction before guard |
| F5 | conversation double params | FIXED | No manual extraction before guard |
| F6 | mindmap double params | FIXED | No manual extraction before guard |
| F7 | reasoning bypasses guard's parsed includes | FIXED | L44: uses `guardResult.includes` |
| F8 | dead code `intelligenceSuccessResponse` | FIXED | Function removed from codebase |
| F9 | VALID_INCLUDES duplicated in middleware + validators | **OPEN** | middleware.ts L19–36 defines Set; validators.ts L34–44 duplicates with comment "must stay in sync" |

---

## CATEGORY G: MISSING TESTS — 41 gaps, 33 FIXED, 8 STILL MISSING

**Status: 33/41 FIXED** ✅ (80% coverage)

### G1–G13: parseIncludeParams Unit Tests — 13/13 EXIST ✅

All covered including bonus tests (lowercasing, deduplication, special chars, long strings).

### G14–G41: Integration Tests — 20/28 EXIST, 8 MISSING

| # | Missing Test | Description |
|---|-------------|-------------|
| G17 | Company `?include=timeline` | No test verifies timeline data returned |
| G18 | Company `?include=actions` | No test verifies actions data returned |
| G19 | Company `?include=brief` | No test verifies brief data returned |
| G20 | Company `?include=knowledge` | No test verifies knowledge (capabilities + caseStudies) returned |
| G24 | Opportunity data shape | Only envelope test; no data field validation |
| G28 | Conversation default/no-include | No test for output data shape without includes |
| G30/G31 | Brief success path | No test for sections, wordCount, evidenceChain |
| G32 | Grounding data shape | No test for evidences, coverage, gaps |
| G33/G34 | Retrieval results + stats | No test for results array, stats shape |
| G35 | Knowledge data shape | No test for groups, totalEntries, topCategories |
| G37 | meta.includes reflects requested | Test only checks `Array.isArray` — never verifies actual values |
| G40 | N+1 query verification | No mock call-count assertions for parallel batching |

---

## CATEGORY H: TYPE SAFETY ISSUES — 11 gaps, ALL OPEN

**Status: 0/11 FIXED, 11/11 OPEN** ❌

| # | File | Line(s) | Description |
|---|------|---------|-------------|
| H1 | guard.ts | L65 | `endpoint as 'company'` — `string` to literal union cast |
| H2 | guard.ts | L76 | Same pattern |
| H3 | guard.ts | L89 | Same pattern |
| H4 | guard.ts | L111 | Same pattern |
| H5 | guard.ts | L163 | Same in `utilityGuard` |
| H6 | company/route.ts | L407 | `settled.value as { key: string; result: ... }` — unsafe union assertion |
| H7 | company/route.ts | L410 | `result as RevenueScore` |
| H8 | company/route.ts | L429 | `result as ActionResult` |
| H9 | company/route.ts | L444 | `result as unknown as Record<string, unknown>` — double cast |
| H10 | opportunity/route.ts | L161,L170 | `scoring as RevenueScore` (can be null); `actions as ActionResult` (can be null) |
| H11 | action/route.ts | L137 | `(actionResult as unknown as Record<string, unknown>).confidence as number` |

**Note**: H1–H5 could all be fixed in one change by typing `intelligenceGuard`'s `endpoint` param as `EndpointName`.

---

## CATEGORY I: UNUSED IMPORTS — 2 gaps, 1 FIXED, 1 OPEN

**Status: 1/2 FIXED** ✅

| # | Route | Status | Evidence |
|---|-------|--------|----------|
| I1 | company L34 | **OPEN** | `IntelligenceResponse` imported but never referenced |
| I2 | opportunity | FIXED | Not imported |

---

## CATEGORY J: ERROR CODE SPECIFICITY — 4 gaps, 1 FIXED, 3 OPEN (1 NEW)

**Status: 1/4 FIXED** ⚠️

| # | Route | Status | Evidence |
|---|-------|--------|----------|
| J1 | brief L62 | **OPEN** | Uses `'VALIDATION_FAILED'` — NOT a member of `IntelligenceErrors` const. Undeclared error code. |
| J2 | retrieval L64 | **OPEN** | Uses `'VALIDATION_FAILED'` — same undeclared error code. |
| J3 | reasoning L87 | **OPEN** | Uses `'ENGINE_TIMEOUT'` for generic catch — throw could be any error, not necessarily timeout. |
| J4 | reasoning L104 | FIXED | Uses `'INTELLIGENCE_UNAVAILABLE'` for engine failure — correct semantic. |

**NEW GAP (J1/J2 side-effect)**: `VALIDATION_FAILED` is used in 25+ locations but is NOT defined in `IntelligenceErrors` const (types.ts L494–502). It IS defined in `UtilityErrorCode` (guard.ts L195) but the `createErrorResponse()` function in middleware.ts accepts `string` for errorCode, not `IntelligenceErrorCode`. This creates an inconsistent error code vocabulary between core routes (which use middleware's `createErrorResponse`) and utility routes (which use guard's `utilityError`).

---

## CATEGORY K: VALID_INCLUDES GHOST ENTRIES — 4 gaps, ALL OPEN

**Status: 0/4 FIXED, 4/4 OPEN** ❌

| # | Key | Status | Evidence |
|---|-----|--------|----------|
| K1 | `people_changes` | **OPEN** | In all 3 type locations. Zero `shouldInclude('people_changes')` in any route. |
| K2 | `data_health` | **OPEN** | In all 3 type locations. Zero route implementation. `IntelligenceCompanyContext.dataHealth` field exists but never populated. |
| K3 | `reasoning` | **OPEN** | In all 3 type locations. Zero route implementation. |
| K4 | `opportunities` | **OPEN** | In all 3 type locations. Zero route implementation. |

---

## CATEGORY L: ADDITIONAL IMPLEMENTATION GAPS — 8 gaps, 6 FIXED, 1 OPEN, 1 PARTIAL

**Status: 6/8 FIXED** ✅

| # | Description | Status | Evidence |
|---|-------------|--------|----------|
| L1 | Export IntelligenceKnowledgeOutput | FIXED | index.ts L42 |
| L2 | Export IntelligenceKnowledgeEntry | FIXED | index.ts L43 |
| L3 | Export IntelligenceKnowledgeGroup | FIXED | index.ts L44 |
| L4 | Export IntelligenceKnowledgeIngestionStats | FIXED | index.ts L45 |
| L5 | computeFreshness lastSignal = lastEnriched | **PARTIAL** | Uses `lastActivityAt` when available, falls back to `lastEnriched`. Function signature doesn't accept signal timestamp. |
| L6 | capabilityAsset.count queries globally | FIXED | Now scoped via fusionResult → capabilityIds per companyId |
| L7 | Reasoning step status fabricated | **OPEN** | L136: `step.confidence > 0.15 ? 'completed' : 'failed'` — Prisma schema has no `status` column |
| L8 | Knowledge route no separate DB error handling | FIXED | Has independent try/catch blocks |

---

## NEW GAPS INTRODUCED BY FIXES — 14 gaps

These gaps did NOT exist in the original audit but were introduced during the fix process:

| # | Category | Description | Severity | Evidence |
|---|----------|-------------|----------|----------|
| N1 | Consistency | `VALIDATION_FAILED` not in `IntelligenceErrors` const but used by 2 core routes | MEDIUM | types.ts L494–502 missing it; brief L62, retrieval L64 use it |
| N2 | Consistency | Error code vocabulary split: `IntelligenceErrorCode` (7 codes) vs `UtilityErrorCode` (6 codes) — different sets | MEDIUM | types.ts vs guard.ts L189–195 — no shared base |
| N3 | Consistency | `createErrorResponse()` accepts bare `string` for errorCode, not `IntelligenceErrorCode` | MEDIUM | middleware.ts L126: `errorCode: string` — no type constraint |
| N4 | Type Safety | `VALID_INCLUDES` duplication comment says "must stay in sync" — manual sync obligation | LOW | validators.ts L33 comment |
| N5 | Type Safety | `getValidIncludeKeys()` uses lazy singleton pattern — first-call only, never invalidated | LOW | validators.ts L31–47 — `_validIncludeKeys` set once |
| N6 | Testing | Cache-Control test for company route documents `null` instead of expecting header | LOW | ticket2-integration.test.ts — company test at ~L640 expects no Cache-Control |
| N7 | Testing | Integration tests don't verify `meta.includes` values match requested includes | MEDIUM | G37 still missing |
| N8 | Architecture | conversation/action routes gate `learning` include (not in Ticket 2 spec) | MEDIUM | Spec says `talkingPoints,objections,buyerProfiles` and `recommendations,sequences,learning` |
| N9 | Architecture | `learning` include is shared across 3 endpoints (action, conversation, company `?include=learning`?) but not in company spec | LOW | Not in company spec but key is in VALID_INCLUDES |
| N10 | Performance | reasoning route runs `EnterpriseReasoningEngine.build()` unconditionally regardless of includes | HIGH | L82: always builds; no include-based gate |
| N11 | Performance | opportunity route runs 3 engines unconditionally in `Promise.allSettled` regardless of includes | HIGH | L82–86: ScoringEngine, ReasoningEngine, ActionEngine all run always |
| N12 | Performance | conversation route runs `ConversationEngine.brief()` unconditionally | HIGH | L80: always runs |
| N13 | Performance | action route runs `ActionEngine.recommend()` unconditionally | HIGH | L80: always runs |
| N14 | Performance | mindmap route loads contacts + capabilities + signals unconditionally | HIGH | L72–88: always loads |

---

## CROSS-CUTTING ANALYSIS

### What PASSES (unchanged from previous)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| All 6 endpoints use shared middleware (guard.ts) | ✅ PASS | All 6 use `intelligenceGuard()` |
| All 10 endpoints use `createResponse()` envelope | ✅ PASS | All return `IntelligenceResponse<T>` |
| All 10 endpoints use `createErrorResponse()` for errors | ✅ PASS | Consistent format |
| All 10 endpoints use `computeFreshness()` | ✅ PASS | Freshness present in all meta |
| Zod validation via guard.ts | ✅ PASS | companyId + include validated |
| Rate limiting on all 10 core routes | ✅ PASS | 60/min via intelligenceGuard |
| scrubError on error paths | ✅ PASS | All catch blocks scrub errors |
| Correlation-id headers on all responses | ✅ PASS | Via guard.ts responseHeaders |
| No N+1 queries | ✅ PASS | All parallelized with Promise.all/allSettled |
| tsc --noEmit passes | ✅ PASS | Zero errors |

### What STILL FAILS

| Requirement | Gap Count | Details |
|-------------|-----------|---------|
| Selective loading per spec | 18 | 5/6 primary endpoints have ZERO selective loading |
| Response type precision | 5 | Optional fields always included; endpoint type cast |
| Cache-Control on all routes | 1 | Company route missing |
| Tests completeness | 8 | Missing integration tests for 8 data-shape scenarios |
| Type safety | 11 | Unsafe casts throughout |
| Error code consistency | 3 | Undeclared codes, wrong semantic codes |
| Ghost include entries | 4 | 4 keys accept but have no implementation |
| Middleware hygiene | 2 | Double params in company, VALID_INCLUDES duplication |
| Unused imports | 1 | Company route |

### What Was Fixed

| Category | Fixed | Total | % |
|----------|-------|-------|---|
| B: Type system | 37 | 37 | 100% |
| C: N+1 queries | 6 | 6 | 100% |
| D: Cache-Control | 9 | 10 | 90% |
| F: Middleware | 7 | 9 | 78% |
| G: Tests | 33 | 41 | 80% |
| I: Unused imports | 1 | 2 | 50% |
| J: Error codes | 1 | 4 | 25% |
| L: Implementation | 6 | 8 | 75% |
| **TOTAL FIXED** | **95** | **165** | **57.6%** |

---

## PRIORITY REMEDIATION PLAN

### P0 — Blocks Exit Criteria (must fix for Ticket 2 to pass)

1. **A1–A18: Implement selective loading in 5 routes** (reasoning, opportunity, action, conversation, mindmap)
   - Import `shouldInclude` where missing
   - Gate engine calls and DB queries on `?include=` params per spec
   - Estimated effort: 1 day

2. **E1–E5: Fix response type envelope precision**
   - E1: Change `intelligenceGuard` endpoint param to `EndpointName`
   - E2–E5: Make optional fields (`?`) in types; conditionally spread in routes
   - Estimated effort: 2 hours

3. **D1: Add Cache-Control to company route**
   - Single line fix
   - Estimated effort: 5 minutes

### P1 — Tests (needed for spec compliance)

4. **G17–G41 missing tests**: Add 8 missing integration tests
   - Estimated effort: 2 hours

### P2 — Code Quality

5. **H1–H11: Fix unsafe casts** — Type guard properly (4 hours)
6. **J1–J3: Error code consistency** — Add VALIDATION_FAILED to IntelligenceErrors; fix ENGINE_TIMEOUT usage (30 min)
7. **F1: Remove double params in company route** (5 min)
8. **F9: Extract VALID_INCLUDES to shared module** (30 min)
9. **K1–K4: Either implement ghost entries or remove them** (2 hours)
10. **N1–N14: Fix new gaps** — See individual descriptions (3 hours)

---

## RISK ASSESSMENT

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| A1–A18 not fixed means wasted API calls | HIGH | HIGH — clients always get full payload | Implement selective loading before production |
| E1 cast lies to TypeScript — wrong endpoint in error responses | MEDIUM | LOW — only affects error metadata | Type the parameter correctly |
| N10–N14 unconditional engine runs = unnecessary cost | HIGH | HIGH — every request runs all engines | Gate on includes |
| J1/J2 undeclared error code breaks type contract | MEDIUM | MEDIUM — frontend can't switch on codes | Add to IntelligenceErrors |
| K1–K4 ghost entries confuse API consumers | MEDIUM | HIGH — clients request includes that have no effect | Remove unimplemented keys |

---

*End of Report. Total active gaps: 70 (53 original + 3 partial + 14 new).*
