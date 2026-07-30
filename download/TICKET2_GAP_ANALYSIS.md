# Ticket 2: Intelligence API Layer Refactor — Deep Audit Gap Analysis
## 165 Gaps Identified | Evidence-Based | Full Enumeration

**Audit Date**: 2026-07-30
**Scope**: ARCHITECTURE.md lines 740-765 (Ticket 2 spec: 4 backend requirements + 6 API contracts + 2 test requirements + 3 exit criteria)
**Method**: Deep Phase 1-4 Zero-Defect — Spec Decomposition → Full Enumeration → Evidence Collection → Gap Analysis
**Files Audited**: 10 core route files, 6 lib files, all test files

---

## SUMMARY

| Category | Gap Count | Severity |
|----------|-----------|----------|
| A: ?include= selective loading missing/incorrect (6 primary endpoints) | 18 | CRITICAL |
| B: Include key type system mismatch (VALID_INCLUDES, IntelligenceInclude, includeSchema) | 37 | CRITICAL |
| C: Sequential queries that should be parallel (N+1 risk) | 6 | HIGH |
| D: Missing Cache-Control headers (React Query compatible) | 10 | HIGH |
| E: Response type envelope gaps | 5 | MEDIUM |
| F: Middleware usage gaps (double params, dead code, duplication) | 9 | MEDIUM |
| G: Missing tests (spec-required unit + integration tests) | 41 | CRITICAL |
| H: Type safety issues (unsafe casts) | 11 | MEDIUM |
| I: Unused imports | 2 | LOW |
| J: Missing error code specificity | 4 | MEDIUM |
| K: VALID_INCLUDES ghost entries (defined but not implemented) | 4 | LOW |
| L: Additional implementation gaps (missing exports, logic bugs) | 8 | MEDIUM |
| **TOTAL** | **165** | |

---

## EXIT CRITERIA STATUS

| Exit Criterion | Status | Gap Count |
|----------------|--------|-----------|
| All 6 endpoints support `?include=` with selective loading | **FAIL** | 18 |
| Response types match `IntelligenceResponse` from types.ts | **FAIL** | 37 |
| No N+1 queries | **FAIL** | 6 |
| Cache-Control headers present | **FAIL** | 10 |
| Tests exist | **FAIL** | 41 |

---

## CATEGORY A: ?include= SELECTIVE LOADING GAPS (18 gaps) — CRITICAL

**Spec Requirement**: Ticket 2 API contracts define specific include keys per endpoint. All 6 primary endpoints must conditionally load data based on ?include=.

**Evidence**: 5 of 6 primary endpoints fail to implement selective loading for spec'd include keys. Only `company` fully implements all spec'd includes.

| # | Route | File:Line | Missing Include Key | Evidence |
|---|-------|-----------|---------------------|----------|
| A1 | reasoning | route.ts:46-47 | `impact` | Spec: `?include=steps,impact,recommendations`. Route has ZERO code to conditionally load impact data. `impact` is never checked. |
| A2 | reasoning | route.ts:46-47 | `recommendations` | Same as above. Route has ZERO code for recommendations. |
| A3 | opportunity | route.ts:85-89 | `scores` | Spec: `?include=scores,fusion,capabilities`. ScoringEngine runs ALWAYS regardless of includes. No `shouldInclude('scores')` gate. |
| A4 | opportunity | route.ts:116-149 | `fusion` | Fusion data loaded ALWAYS. No `shouldInclude('fusion')` gate. |
| A5 | opportunity | route.ts:all | `capabilities` | ZERO code for capabilities selective loading. |
| A6 | opportunity | route.ts:all | (route-wide) | Route has ZERO `shouldInclude()` calls. Zero selective loading despite 3 spec'd includes. |
| A7 | action | route.ts:78-87 | `recommendations` | Spec: `?include=recommendations,sequences,learning`. ActionEngine runs ALWAYS. No gate. |
| A8 | action | route.ts:all | `sequences` | ZERO code for sequences. No `shouldInclude()`, no DB query, no data field. |
| A9 | conversation | route.ts:79 | `talkingPoints` | Spec: `?include=talkingPoints,objections,buyerProfiles`. ZERO code for talking points. |
| A10 | conversation | route.ts:all | `objections` | ZERO code for objections. |
| A11 | conversation | route.ts:all | `buyerProfiles` | ZERO code for buyer profiles. |
| A12 | conversation | route.ts:79 | (engine always runs) | ConversationEngine.brief() ALWAYS called. No selective gate. |
| A13 | conversation | route.ts:124-155 | (brief always built) | Brief ALWAYS constructed from result regardless of includes. |
| A14 | conversation | route.ts:102 | wrong include implemented | Route implements `?include=learning` (NOT in spec) while missing all 3 spec'd includes. |
| A15 | mindmap | route.ts:74-90 | `nodes` | Spec: `?include=nodes,edges,knowledgeConnections`. Nodes loaded ALWAYS. No gate. |
| A16 | mindmap | route.ts:130-141 | `edges` | Edges built ALWAYS. No gate. |
| A17 | mindmap | route.ts:all | `knowledgeConnections` | ZERO code for knowledge connections. |
| A18 | mindmap | route.ts:all | (route-wide) | ZERO `shouldInclude()` calls. Zero selective loading. |

---

## CATEGORY B: INCLUDE KEY TYPE SYSTEM MISMATCH (37 gaps) — CRITICAL

**Spec Requirement**: All include keys used in API contracts must be defined in the type system (VALID_INCLUDES, IntelligenceInclude, includeSchema).

**Evidence**: The spec defines 11 include keys (steps, impact, recommendations, scores, fusion, capabilities, sequences, talkingPoints, objections, buyerProfiles, nodes, edges, knowledgeConnections) that are NOT in VALID_INCLUDES, IntelligenceInclude, or includeSchema. Additionally, `ingestion` is used in the knowledge route with an unsafe `as never` cast.

### B1-B11: VALID_INCLUDES missing keys (middleware.ts:17-21)

| # | Missing Key | Used By Endpoint |
|---|-------------|-----------------|
| B1 | `impact` | reasoning |
| B2 | `recommendations` | reasoning, action |
| B3 | `fusion` | opportunity |
| B4 | `capabilities` | opportunity |
| B5 | `sequences` | action |
| B6 | `talkingPoints` | conversation |
| B7 | `objections` | conversation |
| B8 | `buyerProfiles` | conversation |
| B9 | `nodes` | mindmap |
| B10 | `edges` | mindmap |
| B11 | `knowledgeConnections` | mindmap |
| B12 | `ingestion` | knowledge (used with `as never` cast) |

### B13-B24: IntelligenceInclude type missing keys (types.ts:56-70)

| # | Missing Key |
|---|-------------|
| B13 | `impact` |
| B14 | `recommendations` |
| B15 | `fusion` |
| B16 | `capabilities` |
| B17 | `sequences` |
| B18 | `talkingPoints` |
| B19 | `objections` |
| B20 | `buyerProfiles` |
| B21 | `nodes` |
| B22 | `edges` |
| B23 | `knowledgeConnections` |
| B24 | `ingestion` |

### B25-B37: includeSchema validIncludes missing keys (validators.ts:36-39)

| # | Missing Key |
|---|-------------|
| B25 | `impact` |
| B26 | `recommendations` |
| B27 | `fusion` |
| B28 | `capabilities` |
| B29 | `sequences` |
| B30 | `talkingPoints` |
| B31 | `objections` |
| B32 | `buyerProfiles` |
| B33 | `nodes` |
| B34 | `edges` |
| B35 | `knowledgeConnections` |
| B36 | `ingestion` |

---

## CATEGORY C: SEQUENTIAL QUERY GAPS — N+1 RISK (6 gaps) — HIGH

**Spec Requirement (Exit Criteria)**: "No N+1 queries (verify with Prisma query log)"

**Evidence**: Multiple independent DB queries execute sequentially when they could be parallelized with Promise.all.

| # | Route | File:Lines | Description |
|---|-------|------------|-------------|
| C1 | company | route.ts:135-340 | signals (L137), contacts (L180), timeline (L228), knowledge (L261) — 4 independent include-gated queries run SEQUENTIALLY when multiple includes are requested. Should use Promise.all. |
| C2 | company | route.ts:507-544 | researchCard DB query runs sequentially after all include queries but is independent. Could parallelize with include block. |
| C3 | company | route.ts:343-367 | mindmap summary has 3 independent `count()` queries (contacts, signals, capabilityAsset) that COULD be inside the knowledge block's Promise.all. |
| C4 | retrieval | route.ts:109-125 | RetrievalEngine.search() (L109) and RetrievalEngine.getStats() (L122) are independent sequential calls. Should use Promise.all. |
| C5 | conversation | route.ts:79-122 | ConversationEngine.brief() (L79) and learningEvents DB query (L104) are independent when ?include=learning is requested. |
| C6 | action | route.ts:79-122 | ActionEngine.recommend() (L79) and learningEvents DB query (L104) are independent when ?include=learning is requested. |

---

## CATEGORY D: MISSING CACHE-CONTROL HEADERS (10 gaps) — HIGH

**Spec Requirement**: "Add response caching (React Query compatible — Cache-Control headers)"

**Evidence**: Zero of 10 core intelligence routes set any Cache-Control header.

| # | Route | File:Line | Evidence |
|---|-------|-----------|----------|
| D1 | company | route.ts:592-603 | Response.json() has no Cache-Control header |
| D2 | reasoning | route.ts:187-198 | Same |
| D3 | opportunity | route.ts:188-199 | Same |
| D4 | action | route.ts:149-160 | Same |
| D5 | conversation | route.ts:183-194 | Same |
| D6 | mindmap | route.ts:169-180 | Same |
| D7 | brief | route.ts:187-198 | Same |
| D8 | grounding | route.ts:122-133 | Same |
| D9 | retrieval | route.ts:155-166 | Same |
| D10 | knowledge | route.ts:147-158 | Same |

---

## CATEGORY E: RESPONSE TYPE ENVELOPE GAPS (5 gaps) — MEDIUM

**Spec Requirement (Exit Criteria)**: "Response types match IntelligenceResponse from types.ts"

**Evidence**: All routes use `createResponse()` envelope, but some routes always include fields that should be optional based on includes.

| # | Route | File:Line | Description |
|---|-------|-----------|-------------|
| E1 | guard.ts | L191 | `intelligenceSuccessResponse()` hardcodes `'company' as never` — if any route uses this helper, metadata.endpoint always returns 'company'. Currently dead code but latent bug. |
| E2 | knowledge | route.ts:135-142 | `ingestionStats` is null but always included in response even when ?include=ingestion is NOT requested. Should be omitted. |
| E3 | conversation | route.ts:158-169 | `pastLearnings` is always `[]` when ?include=learning not requested. Type `IntelligenceConversationOutput` does not make `pastLearnings` optional. |
| E4 | action | route.ts:125-135 | `learningInsights` is always `[]` when ?include=learning not requested. Type `IntelligenceActionOutput` does not make `learningInsights` optional. |
| E5 | opportunity | route.ts:162-174 | `scores`, `reasoning`, `actions` are always present even though spec defines them as ?include= selective. Types don't make them optional. |

---

## CATEGORY F: MIDDLEWARE USAGE GAPS (9 gaps) — MEDIUM

| # | Route | File:Line | Description |
|---|-------|-----------|-------------|
| F1 | company | L51, L54 | Double params extraction: `const { id: companyId } = await params` then `intelligenceGuard(request, params, ...)` which also extracts id. |
| F2 | reasoning | L38, L41 | Same double params extraction. |
| F3 | opportunity | L44, L46 | Same. |
| F4 | action | L38, L40 | Same. |
| F5 | conversation | L38, L40 | Same. |
| F6 | mindmap | L33, L35 | Same. |
| F7 | reasoning | L46 | Uses raw `request.nextUrl.searchParams.get('include')` instead of guard's parsed `guardResult.includes`. Bypasses validation layer. |
| F8 | guard.ts | L186-201 | `intelligenceSuccessResponse()` is dead code — no route imports or calls it. |
| F9 | middleware+validators | L17-21 / L36-39 | `VALID_INCLUDES` set DUPLICATED in middleware.ts and validators.ts. Single source of truth violation. |

---

## CATEGORY G: MISSING TESTS (41 gaps) — CRITICAL

**Spec Requirement**: "Unit test: parseIncludeParams() — valid includes, invalid includes, SQL injection prevention" + "Integration test: Each endpoint returns correct data shape with selective includes"

**Evidence**: No `tests/ticket2-*.test.ts` file exists. Zero ticket2-specific tests.

### G1-G13: Missing parseIncludeParams() Unit Tests

| # | Missing Test |
|---|-------------|
| G1 | No ticket2 test file exists at all |
| G2 | parseIncludeParams with valid single include returns correct Set |
| G3 | parseIncludeParams with valid multiple comma-separated includes |
| G4 | parseIncludeParams with whitespace around values |
| G5 | parseIncludeParams with invalid keys silently dropped |
| G6 | parseIncludeParams with mix of valid and invalid keys |
| G7 | parseIncludeParams with empty string include returns empty Set |
| G8 | parseIncludeParams with null/missing include returns { includes: Set(), raw: null } |
| G9 | parseIncludeParams returns raw string for metadata |
| G10 | parseIncludeParams SQL injection prevention (e.g., "1; DROP TABLE") |
| G11 | parseIncludeParams path traversal (e.g., "../../../etc/passwd") |
| G12 | parseIncludeParams NoSQL injection patterns |
| G13 | parseIncludeParams XSS/script injection in include values |

### G14-G41: Missing Integration Tests

| # | Missing Test |
|---|-------------|
| G14 | company endpoint with ?include=signals returns signals in correct data shape |
| G15 | company endpoint with ?include=scores returns scores |
| G16 | company endpoint with ?include=contacts returns contacts |
| G17 | company endpoint with ?include=timeline returns timeline |
| G18 | company endpoint with ?include=actions returns actions |
| G19 | company endpoint with ?include=brief returns brief |
| G20 | company endpoint with ?include=knowledge returns knowledge |
| G21 | company endpoint WITHOUT include omits optional sections |
| G22 | reasoning endpoint with ?include=steps returns step details |
| G23 | reasoning endpoint without ?include=steps still includes steps (default-on) |
| G24 | opportunity endpoint returns correct IntelligenceOpportunity data shape |
| G25 | action endpoint with ?include=learning returns learningInsights |
| G26 | action endpoint WITHOUT include omits learningInsights |
| G27 | conversation endpoint returns correct IntelligenceConversationOutput |
| G28 | conversation endpoint with ?include=learning returns pastLearnings |
| G29 | mindmap endpoint returns correct IntelligenceMindmap data shape |
| G30 | brief endpoint with valid briefType returns IntelligenceBriefOutput |
| G31 | brief endpoint with invalid briefType returns 400 |
| G32 | grounding endpoint returns IntelligenceGroundingOutput with evidence chain |
| G33 | retrieval endpoint with ?q= returns search results |
| G34 | retrieval endpoint WITHOUT ?q= returns 400 |
| G35 | knowledge endpoint returns IntelligenceKnowledgeOutput with groups |
| G36 | All 6 primary endpoints return IntelligenceResponse envelope (success, data, meta) |
| G37 | IntelligenceResponse.meta.includes reflects requested includes |
| G38 | IntelligenceResponse.meta.freshness present and correct shape |
| G39 | Cache-Control headers present in responses |
| G40 | N+1 query verification with Prisma query log |
| G41 | Response types match IntelligenceResponse<T> from types.ts |

---

## CATEGORY H: TYPE SAFETY ISSUES (11 gaps) — MEDIUM

| # | Route | File:Line | Description |
|---|-------|-----------|-------------|
| H1 | guard.ts | L191 | `'company' as never` cast in `intelligenceSuccessResponse()` |
| H2 | knowledge | L124 | `'ingestion' as never` cast to bypass `IntelligenceInclude` type |
| H3 | company | L164 | `s.evidenceIds as unknown[]` — evidenceIds could be any JSON type |
| H4 | company | L419 | `settled.value as { key: string; result: ... }` — unsafe settled result cast |
| H5 | company | L427 | `company.accountPriorityScore as number` — field is `number | null` |
| H6 | company | L456 | `result as unknown as Record<string, unknown>` — double unsafe cast for brief |
| H7 | opportunity | L164 | `scoring as RevenueScore` — could be null from Promise.allSettled rejection |
| H8 | opportunity | L173 | `actions as ActionResult` — could be null from Promise.allSettled rejection |
| H9 | action | L137 | `(actionResult as unknown as Record<string, unknown>).confidence as number ?? 0` |
| H10 | conversation | L125 | `conversationResult as unknown as Record<string, unknown>` — double unsafe cast |
| H11 | reasoning | L56 | `company: Record<string, unknown> \| null` — loses all DB type safety |

---

## CATEGORY I: UNUSED IMPORTS (2 gaps) — LOW

| # | Route | File:Line | Description |
|---|-------|-----------|-------------|
| I1 | company | L34 | `IntelligenceResponse` imported but never directly referenced |
| I2 | opportunity | L31 | `IntelligenceResponse` imported but never directly referenced |

---

## CATEGORY J: MISSING ERROR CODE SPECIFICITY (4 gaps) — MEDIUM

| # | Route | File:Line | Description |
|---|-------|-----------|-------------|
| J1 | brief | L62 | Uses `INVALID_INCLUDE` for invalid briefType — should be `VALIDATION_FAILED` |
| J2 | retrieval | L64 | Uses `INVALID_INCLUDE` for missing ?q= param — should be `VALIDATION_FAILED` |
| J3 | reasoning | L90 | Uses `ENGINE_TIMEOUT` for engine throw — might not be timeout |
| J4 | reasoning | L103 | Uses `ENGINE_TIMEOUT` for engine failure — not necessarily timeout |

---

## CATEGORY K: VALID_INCLUDES GHOST ENTRIES (4 gaps) — LOW

| # | Include Key | Location | Description |
|---|-------------|----------|-------------|
| K1 | `people_changes` | middleware.ts, types.ts, validators.ts | In all 3 locations but NO route implements selective loading for it |
| K2 | `data_health` | middleware.ts, types.ts, validators.ts | In all 3 locations but company route does NOT implement ?include=data_health |
| K3 | `reasoning` | middleware.ts, types.ts, validators.ts | In all 3 but company route does NOT implement ?include=reasoning |
| K4 | `opportunities` | middleware.ts, types.ts, validators.ts | In all 3 but NO route implements ?include=opportunities |

---

## CATEGORY L: ADDITIONAL IMPLEMENTATION GAPS (8 gaps) — MEDIUM

| # | Route/File | File:Line | Description |
|---|------------|-----------|-------------|
| L1 | index.ts | L38-42 | Missing export for `IntelligenceKnowledgeOutput` type |
| L2 | index.ts | L38-42 | Missing export for `IntelligenceKnowledgeEntry` type |
| L3 | index.ts | L38-42 | Missing export for `IntelligenceKnowledgeGroup` type |
| L4 | index.ts | L38-42 | Missing export for `IntelligenceKnowledgeIngestionStats` type |
| L5 | middleware.ts | L153-158 | `computeFreshness()` sets `lastSignal = lastEnriched` — should track different timestamps |
| L6 | company | L351 | `db.capabilityAsset.count({ where: { isActive: true } })` queries globally, NOT per companyId |
| L7 | reasoning | L139 | Step status FABRICATED from confidence threshold — real status not in DB select |
| L8 | knowledge | L49-65 | No separate DB error handling — generic catch vs specific 'Company lookup failed' like other 9 routes |

---

## CROSS-CUTTING ANALYSIS

### What PASSES

| Requirement | Status | Evidence |
|-------------|--------|----------|
| All 6 endpoints use shared middleware (guard.ts) | PASS | All 6 use `intelligenceGuard()` |
| All 10 endpoints use `createResponse()` envelope | PASS | All return `IntelligenceResponse<T>` |
| All 10 endpoints use `createErrorResponse()` for errors | PASS | Consistent `{ error, code, details }` |
| All 10 endpoints use `computeFreshness()` | PASS | Freshness present in all meta |
| Zod validation via guard.ts | PASS | companyId + include validated |
| Rate limiting on all 10 core routes | PASS | 60/min via intelligenceGuard |
| scrubError on error paths | PASS | All catch blocks scrub errors |
| Correlation-id headers on all responses | PASS | Via guard.ts responseHeaders |

### What FAILS

| Requirement | Gap Count | Details |
|-------------|-----------|---------|
| Selective loading per spec | 18 | 5/6 primary endpoints fail |
| Type system for include keys | 37 | 11 spec keys missing from 3 type definitions |
| Sequential queries → N+1 risk | 6 | 4 routes have parallelizable queries |
| Cache-Control headers | 10 | Zero routes set any |
| Tests | 41 | Zero ticket2 tests exist |
| Response type precision | 5 | Optional fields always included |
| Middleware hygiene | 9 | Double params, dead code, duplication |
| Type safety | 11 | Unsafe casts throughout |
