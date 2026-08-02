# Phase 3 Final Hardening & Freeze — Technical Documentation

**Version**: v3-phase3-harden  
**Date**: 2026-07-19  
**Status**: FROZEN — Phase 4/5/6 must build ONLY on the intelligence contract

---

## 1. Architecture Overview

### Intelligence Pipeline (Mandatory Data Flow)

```
Company → Research Engine → Evidence → Signals → Research Card → Intelligence Contract → AI Consumer
                                    ↓                    ↓
                            SignalCapabilityMatch   CapabilityAsset
```

**CRITICAL RULE**: No Phase 4/5/6 module may create new intelligence sources. All AI consumption MUST go through `getResearchContext()` in `src/lib/intelligence-contract.ts`.

### Module Dependency Graph

```
src/lib/intelligence-contract.ts       ← SINGLE SOURCE OF TRUTH for all AI consumers
  ├── src/lib/research-engine/
  │     ├── index.ts                   ← Public API barrel
  │     ├── researcher.ts              ← 6-step research pipeline
  │     ├── evidence.ts                ← Evidence storage, confidence, tiers
  │     ├── signals.ts                 ← Signal detection & storage
  │     └── signal-capability-matching.ts ← Signal→Capability matching engine
  ├── src/lib/ai-governance.ts         ← MANDATORY governance layer (all AI routes)
  ├── prisma/schema.prisma             ← Database schema (PostgreSQL)
  └── src/app/api/                     ← API routes (consumers)
        ├── g-ai/[...slug]/            ← AI generation routes (MUST use governedAICall)
        └── g-crm/[...slug]/           ← CRM routes (data management)
```

---

## 2. Schema Changes (Phase 3 Hardening)

### Evidence Model — New Fields
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `status` | `String` | `"active"` | Evidence lifecycle: `active` → `superseded` → deleted |
| Index on `status` | — | — | Fast filtering by lifecycle state |

### AIGenerationAudit Model — New Fields
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `promptVersion` | `String?` | `null` | Governance prompt version hash for reproducibility |

### SignalCapabilityMatch Model — NEW TABLE
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | `String` | `cuid()` | Primary key |
| `companyId` | `String` | — | Owning company (indexed) |
| `signalId` | `String` | — | Source signal (indexed) |
| `capabilityId` | `String` | — | Matched capability asset (indexed) |
| `matchScore` | `Float` | `0` | 0-1 match quality (indexed) |
| `reason` | `String` | — | Human-readable match explanation |
| `businessProblem` | `String?` | — | Derived business problem |
| `expectedOutcome` | `String?` | — | Expected outcome from capability |
| `salesAngle` | `String?` | — | Suggested sales angle |

### CapabilityAsset Model — Enhanced Fields (12+ total)
| Field | Type | Purpose |
|-------|------|---------|
| `solution` | `String?` | Solution name (e.g., "Cloud Migration Factory") |
| `accelerator` | `String?` | Reusable accelerator/asset name |
| `technology` | `String?` | Primary technology (e.g., "Azure", "Snowflake") |
| `industry` | `String?` | Primary target industry |
| `businessProblem` | `String?` | Core business problem this addresses |
| `customerOutcome` | `String?` | Outcome the customer achieves |
| `differentiator` | `String?` | What makes this different |
| `caseStudyRef` | `String?` | JSON: `[{title, url, industry, outcome}]` |
| `proofPointRef` | `String?` | JSON: `[{metric, value, context}]` |
| `keywords` | `String?` | JSON: `["keyword1", "keyword2"]` for matching |

### CompanyResearchCard — Enhanced Fields
| Field | Type | Purpose |
|-------|------|---------|
| `structuredTechLandscape` | `String` | JSON: `{cloud:[], data:[], ai:[], applications:[]}` |
| `strategicPriorities` | `String` | JSON: `[{priority, description, evidence, confidence}]` |
| `businessProblems` | `String` | JSON: `["problem1", "problem2"]` |
| `transformationAreas` | `String` | JSON: `["area1", "area2"]` |
| `technologyThemes` | `String` | JSON: `["theme1", "theme2"]` |
| `profileFreshnessAt` | `DateTime?` | When profile data was last verified |
| `signalFreshnessAt` | `DateTime?` | When signals were last refreshed |
| `contactFreshnessAt` | `DateTime?` | When key people were last verified |
| `techFreshnessAt` | `DateTime?` | When technology landscape was last verified |

---

## 3. Governance Rules

### 3.1 Mandatory Governance Layer

**ALL AI routes MUST call `governedAICall()`** from `src/lib/ai-governance.ts`. Direct `callLLM()` calls are PROHIBITED for AI routes.

```typescript
// CORRECT:
const result = await governedAICall({
  generationType: 'email_draft',
  companyId: 'xxx',
  researchContext: ctx,
  systemPrompt: '...',
  userPrompt: '...',
});
if (!result.success) return error(result.rejectionReason!);

// FORBIDDEN:
const response = await callLLM(systemPrompt, userPrompt); // BANNED
```

### 3.2 Governed AI Call — 5-Step Flow

1. **Governance Checks** — Run all 6 checks (research exists, confidence, freshness, staleness, capability match, recent intelligence)
2. **Build Prompt Addons** — Inject evidence grounding notes and governance warnings
3. **Blocking Decision** — If `enforceGovernance=true` and checks fail → block LLM call, record in audit
4. **LLM Call** — Inject 15 anti-hallucination rules into system prompt, grounding into user prompt
5. **Audit Trail** — Record generation in `AIGenerationAudit` with `promptVersion: 'v3-phase3-harden'`

### 3.3 Per-Engine Confidence Thresholds

| Generation Type | Min Confidence | Min Freshness | Require Capability | Max Staleness |
|----------------|---------------|---------------|-------------------|---------------|
| `email_draft` | **60%** | 25 | Yes | 60 days |
| `conversation_plan` | **60%** | 25 | No | 60 days |
| `opportunities` | **50%** | 20 | No | 90 days |
| `score_leads` | **50%** | 20 | No | 90 days |
| `recommendations` | 40% | 15 | No | 120 days |
| `insights` | 40% | 15 | No | 120 days |
| `suggested_contacts` | 40% | 15 | No | 90 days |
| `account_brief` | 20% | 10 | No | 180 days |
| `signal_analysis` | 20% | 10 | No | 365 days |
| Default | **40%** | 20 | No | 60 days |

### 3.4 Enforce Governance Modes

| Route Type | `enforceGovernance` | Behavior |
|-----------|-------------------|----------|
| Company-specific (email, suggested-contacts) | `true` | **Blocks** if governance fails |
| Platform-level (insights, recommendations, signals) | `false` | **Advisory only** — proceeds with warnings |

### 3.5 Anti-Hallucination Rules (15 Rules)

All 15 rules are injected into every LLM system prompt via `HALLUCINATION_PREVENTION_RULES`:

1. Only reference facts from provided intelligence context
2. "Not found" fields → say "Data not available" (never fabricate)
3. Never extrapolate metrics from partial data
4. Never claim technology usage not in tech landscape data
5. Never invent quotes, press releases, or announcements
6. Stale data (>30 days) → preface with "Based on data from [date]..."
7. Never state confidence higher than field confidence scores
8. Missing info → say "Consider running a research refresh"
9. Never assume strategy/priorities not explicitly stated
10. Never invent technology usage, customers, or partnerships
11. Never mention capabilities not in the capability library
12. Clearly state when information is unavailable
13. Reduce confidence when intelligence quality is low
14. Mention uncertainty for single-source or low-confidence evidence
15. Never create fake business problems or pain points

---

## 4. Freshness Model

### 4.1 Category-Specific Freshness Half-Lives

| Category | Half-Life | Warning Threshold | Penalty Per Day | Max Penalty |
|----------|-----------|-------------------|----------------|-------------|
| **Signals** | 14 days | 14 days | 2% | 40% |
| **Technology** | 60 days | 60 days | 1% | 30% |
| **Contacts** | 45 days | 45 days | 1.5% | 35% |
| **Profile** | 90 days | 90 days | 0.5% | 20% |

### 4.2 Freshness Decay Algorithm

```
If daysSince <= 10% of halfLife → score = 100, status = 'fresh'
If daysSince <= halfLife → score = 100 - (days/halfLife * 40), status = 'fresh'
If daysSince <= 2 * halfLife → score = 60 - (excess/halfLife * 30), status = 'aging'
If daysSince <= 4 * halfLife → score = 30 - (excess/2halfLife * 20), status = 'stale'
Beyond 4 * halfLife → score = max(0, 10 - decay), status = 'stale'
```

### 4.3 Freshness-Adjusted Confidence

When category data exceeds its warning threshold, field confidence is reduced via `applyFreshnessAdjustments()` in `intelligence-contract.ts`. Returns adjusted confidence + list of adjustments + warnings.

### 4.4 Refresh Needs Assessment

`assessRefreshNeeds()` returns structured assessment with urgency levels (`immediate`, `recommended`, `optional`, `none`) and per-category action items.

---

## 5. Evidence Lifecycle

### States: `active → superseded → deleted`

- **active**: Current evidence, used in confidence calculations
- **superseded**: Marked when new research runs (with `force=true`)
- **deleted**: Purged when >50 superseded records exist (oldest first)

### Quality Tiers

| Tier | Weight | Examples |
|------|--------|---------|
| **Premium** (1.0) | 100% | Bloomberg, Reuters, WSJ, SEC filings, Crunchbase |
| **Standard** (0.7) | 70% | TechCrunch, Forbes, LinkedIn, Gartner, G2 |
| **Low** (0.4) | 40% | Twitter/X, Facebook, Reddit, Medium |

Configurable via `SystemSetting` key `evidence_source_tiers` (config-over-code).

### Confidence Formula (4-Factor)

```
confidence = relevance * 0.30 + tierWeight * 0.25 + recency * 0.25 + (0.5 + corroboration) * 0.20
```

---

## 6. Signal-to-Capability Matching

### Scoring: `categoryMatch * 0.30 + keywordOverlap * 0.30 + problemAlignment * 0.20 + impactBonus * 0.05`

Minimum match score: 0.25. Results stored in `SignalCapabilityMatch` table.

---

## 7. Research Engine Pipeline (7-Step)

| Step | Progress | Description |
|------|----------|-------------|
| Step 1 | 0-28% | Web search (4 query categories) |
| Step 2 | 28-40% | Evidence collection with superseded lifecycle |
| Step 3 | 40-65% | LLM extraction (business data) |
| **Step 3c** | **65-72%** | **Enhanced: strategic priorities, tech landscape, business problems** |
| Step 4 | 72-80% | Field validation — cross-reference with evidence |
| Step 5 | 80-88% | Confidence scoring (4-factor) |
| Step 6 | 88-100% | Signals, capability matching, storage |

---

## 8. AI Route Migration Status

All 7 AI routes migrated to `governedAICall()`. Independent web search removed from 3 routes. See full details in source.

---

## 9. Test Suite

**File**: `src/lib/__tests__/phase3-e2e-governance.ts` — **42/42 tests passing**

Covers: normal company, limited-info company, stale-research company, governance configs, freshness thresholds, hallucination rules.

---

## 10. Extension Guide (Phase 4/5/6)

### Adding a New AI Route
1. Define `generationType` key → add config to `GOVERNANCE_CONFIGS`
2. Use `governedAICall()` — NEVER `callLLM()` directly
3. Load `researchContext` via `getResearchContext(companyId)`

### Adding a New Signal Type
1. Add entry to `SIGNAL_CAPABILITY_MAP` in `signal-capability-matching.ts`
2. Define categories, problems, sales angles, keywords

### FREEZE RULE
- NO new intelligence sources
- All AI consumption via `getResearchContext()`
- All AI generation via `governedAICall()`
- Schema changes require migration plan approval