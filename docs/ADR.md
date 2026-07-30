# DeepMindQ Architecture Decision Record (ADR)
**Locked: Phase 0 — July 30, 2026**

---

## ADR-001: 6-Layer Architecture Stack

**Decision**: DeepMindQ uses a 6-layer architecture stack. All intelligence flows through these layers in order.

```
Layer 1: Frontend (75 screens, Next.js + React)
Layer 2: Intelligence API Layer (6 product endpoints — the ONLY frontend contract)
Layer 3: Intelligence Orchestration (Reasoning, Multi-Agent, Fusion, Learning)
Layer 4: Governed AI Engines (Scoring, Synthesis, Action, Conversation, Grounding, Retrieval)
Layer 5: AI Foundation (Model Router, AI Governance, Evidence Framework)
Layer 6: Data Layer (Prisma/PostgreSQL + Vector Index + Cron)
```

**Consequences**: Frontend NEVER calls engines or DB directly. All intelligence flows through the Intelligence API Layer.

---

## ADR-002: Intelligence API Layer (6 Product Endpoints)

**Decision**: 6 product-facing endpoints under `/api/intelligence/`:

| Endpoint | Purpose | Key Data |
|----------|---------|----------|
| `GET /api/intelligence/company/{id}` | Company 360 | signals, scores, contacts, timeline, actions, brief, knowledge |
| `GET /api/intelligence/reasoning/{id}` | Enterprise reasoning | 30-step chain, impact analysis |
| `GET /api/intelligence/opportunity/{id}` | Opportunity intel | scores, fusion, win probability |
| `GET /api/intelligence/action/{id}` | Next best actions | recommendations, sequences, learning |
| `GET /api/intelligence/conversation/{id}` | Meeting prep | talking points, objections, strategy |
| `GET /api/intelligence/mindmap/{id}` | Knowledge graph | org chart + knowledge + signal connections |

**All endpoints support `?include=` query param** for selective data loading.

**Existing engine routes remain as internal testing APIs** (`/api/engines/*`, `/api/reasoning`, `/api/fusion`, `/api/intelligence/sprint1/2/3`).

---

## ADR-003: 3-Score Architecture

**Decision**: Three independent scores, never merged:

1. **Account Priority Score (ICP Fit)** — How well does this company match our ideal customer profile?
2. **Intelligence Score (Evidence Quality)** — How strong is the evidence supporting our intelligence about this company?
3. **Opportunity Score (Win Rate)** — How likely are we to win business with this company?

Each score has its own inputs, methodology, and confidence level. The frontend displays all three side-by-side (ScoreTriple component).

---

## ADR-004: 5-Question Workspace (Core Product Experience)

**Decision**: The primary product interface is the 5-Question Workspace:

1. **Q1: WHAT CHANGED?** — Signals, news, people movements, competitive shifts
2. **Q2: WHY DOES IT MATTER?** — Enterprise reasoning, impact assessment, opportunity windows
3. **Q3: WHO TO APPROACH?** — Buying committee, decision makers, influencers
4. **Q4: WHAT TO SAY?** — Conversation prep, talking points, objection handling
5. **Q5: WHAT TO DO?** — Next best actions, outreach sequence, engagement plan

**Navigation model**: NOT a wizard (linear). A narrative scroll (progressive disclosure). Each question loads its data lazily from the Intelligence API.

---

## ADR-005: 7-Segment Navigation

**Decision**: Flat 7-segment navigation architecture:

1. **Command Center** — Dashboard, health, analytics
2. **Companies** — List, profile (5Q workspace)
3. **Intelligence** — Inbox, timeline, reasoning
4. **Opportunities** — Radar, pipeline
5. **Actions** — Queue, drafts, sequences
6. **Knowledge** — Library, capabilities
7. **Settings** — Config, data, team, admin

---

## ADR-006: AI Governance (10/10 Engines)

**Decision**: ALL AI/LLM calls go through `governedAI()` wrapper:

1. Pre-check: budget, permissions, input validation
2. Execute: the actual AI call
3. Post-check: hallucination detection, confidence scoring, citation validation
4. Log: usage, cost, quality metrics

**Currently governed (3/10)**: Grounding, Conversation, AI Evidence Engine.
**Target**: All 10 engines governed.

---

## ADR-007: Design System — Dark First

**Decision**: Dark-first design system. Bloomberg Terminal + Palantir + Apple aesthetics.

- Base background: `#0a0c10` (near-black)
- Surface tokens: Sunken `#06080c`, Base `#0f1219`, Float `#2a3650`, Raised `#1e293b`, Overlay `rgba(0,0,0,0.6)`
- Intelligence tokens: positive `#22c55e`, negative `#ef4444`, neutral `#64748b`, warning `#f59e0b`, critical `#dc2626`
- Desktop-first, large-screen-first, minimal chrome, information-dense

---

## ADR-008: Dead Code Removal (Phase 0)

**Decision**: Removed the following dead code:

| File | Lines | Reason |
|------|-------|--------|
| `src/lib/account-prioritization.ts` | 1,622 | Superseded by `src/lib/account-prioritization/engine.ts` |
| `src/lib/intelligence-fusion-engine.ts` | 194 | Superseded by `src/lib/fusion-engine.ts` |
| `src/lib/intelligence-sources/evidence-traceability.ts` | 217 | Zero consumers |
| 4 `.bak`/`.bak2` screen files | ~500 | Dead artifacts |
| 4 dead test files | ~1,200 | Tested deleted code |

**Revised**: `src/lib/scoring/` (5 files, 1,502 lines) was marked for deletion but has **8 real consumers**. Kept. Will be wired to governance in Phase 2.

Total removed: ~2,533 lines across 9 files.

---

## ADR-009: Orphaned Engine Resolution

**Decision**: 4 engines have API routes but zero UI consumers. Resolution:

| Engine | Lines | Resolution |
|--------|-------|------------|
| Enterprise Reasoning (30-step chain) | 666 | Wire to Intelligence API `/reasoning/{id}` in Phase 3 |
| Multi-Agent Orchestrator (10 specialists) | 412 | Wire as `POST /reasoning/{id}?mode=orchestrated` in Phase 3 |
| Fusion Engine (External x Internal) | 275 | Wire to `/opportunity/{id}` in Phase 3 |
| Continuous Learning Loop | 203 | Wire to `/action/{id}` and `/conversation/{id}` in Phase 3 |

---

## ADR-010: Phase Dependency Graph

```
Phase 0 (Dead Code) ✅
    → Phase 1A (Type Safety) → Phase 1B (API Layer) → Phase 2 (Governance) → Phase 3 (Wire Orphans)
                                                                         ↓
                                                                  Phase 4 (External Intel) ─┐
                                                                  Phase 5 (Knowledge Intel) ─┤ parallel
                                                                  Phase 6 (Data Intel) ─────┘
                                                                         ↓
                                                                  Phase 7 (5Q Workspace + Nav + Design + Components)
                                                                         ↓
                                                                  Phase 8 (Hardening) → Phase 9 (Production)
```
