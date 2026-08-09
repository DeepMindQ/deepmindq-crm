# DeepMindQ Phase 0: Architecture Documentation
# Enterprise Intelligence Operating System
# Version 1.0 | August 2026 | CONFIDENTIAL

## 1. Product Identity

DeepMindQ is an Enterprise Intelligence Operating System. It continuously understands a client's buyer universe, monitors business changes, connects those changes to the client's capabilities, and surfaces evidence-backed intelligence so human decision-makers know who matters, why now, and what context to bring into every conversation.

Core Principle: Intelligence Before Execution. AI Briefs. Human Decides. System Learns.

## 2. Architecture Layers (7-Layer Model)

### Layer 1: Intelligence Foundation
Ingests and validates buyer data, capabilities, and knowledge.
- Buyer Universe Upload (CSV/Excel, validation, dedup, quality scoring)
- Client Capability Library (services, expertise, case studies, auto-embedded)
- Knowledge Intelligence (document processing, chunking, embedding, retrieval)
- Enterprise Memory (4 layers: Working, Conversation, Enterprise, Institutional)
- Evidence & Trust Framework (TRUST metadata, evidence chains, confidence scoring)

### Layer 2: Signal Intelligence
Monitors external changes in the buyer universe.
- External Signal Collection (web search, RSS, website connectors)
- Signal Classification (11 types with confidence scoring)
- Multi-Signal Interpretation (cross-signal correlation, pattern detection)
- Signal Validation and Trust (source reliability, contradiction detection)

### Layer 3: Intelligence Reasoning
Transforms data and signals into understanding.
- Knowledge Intelligence Graph (21 entity types, 30 relationship types)
- Opportunity Intelligence Engine (Static Fit 40% + Dynamic Signals 40% + Timing 20%)
- Capability-Buyer Matching (automatic: signal to capability match to opportunity)
- Contact and Decision Intelligence (buying roles, influence scoring, committee mapping)
- AI Executive Briefing (7-section structured brief with TRUST metadata)
- Deep Analysis Mode (multi-agent comprehensive account analysis)
- Intelligence Health Forecasting (predictive priority changes)

### Layer 4: Human Decision and Learning
Surfaces intelligence to users and captures feedback.
- Proactive Intelligence Dashboard (intelligence-first, not sales-ops KPIs)
- Unified Decision Layer (Engage/Monitor/Ignore across all surfaces)
- Feedback and Learning Loop (wired to scoring engines)
- Intelligence Digest Delivery (weekly briefings via email)

### Layer 5: Enterprise Intelligence Operations
Governance, trust, and platform operations.
- AI Governance Layer (hallucination prevention, cost governance, audit trail)
- AI Advisor (conversational intelligence with context loading)
- Unified Intelligence Search (hybrid: semantic + keyword + entity + graph + recency)
- Intelligence Operations Center (real-time intelligence cockpit)
- Engagement Advisory (post-decision conversation intelligence)
- Trust and Explainability Dashboard

## 3. Memory Architecture (4 Layers)

| Layer | Scope | Purpose | Storage | Phase |
|-------|-------|---------|---------|-------|
| L1: Working Memory | Session | Current query state | In-memory (session) | Production |
| L2: Conversation Memory | Conversation | Advisor chat history | DB (AdvisorConversation) | Production |
| L3: Enterprise Memory | Entity | Company/contact/signal intelligence | DB (via persistence adapter) | Phase 1 |
| L4: Institutional Memory | Organization | Learning events, win/loss patterns | DB (via persistence adapter) | Phase 1 |

Critical: USE_DB_PERSISTENCE=false by default. Persistence infrastructure is fully built but disabled. Phase 1 activates it.

## 4. Persistence Architecture

### Current State (Pre-Phase 1)

Flag: USE_DB_PERSISTENCE=false (default)

Tier 1 Stores (in-memory Maps to DB when enabled):
  - Knowledge Graph: nodeStore, edgeStore, 5 derived indices
  - AI Memory: memoryStore + 4 category indices
  - Hybrid Retrieval: hybridIndex + indexTimestamps
  - Retrieval Corpus Stats: documentFrequency

Tier 2 (always persisted):
  - CRM data (Company, Contact, signals, evidence)
  - Learning events (LearningEvent, IntelligenceFeedback)
  - Advisor conversations (AdvisorConversation, AdvisorMessage)
  - Document knowledge (KnowledgeDocument, KnowledgeChunk, Embedding)
  - Audit trails (AuditLog, AIGenerationAudit)

### Target State (Post-Phase 1)

Flag: USE_DB_PERSISTENCE=true

Same stores, but:
  - persistWrite() actually writes to PostgreSQL (fire-and-forget)
  - Cold start loader restores Maps from DB on restart
  - Shadow mode available for validation
  - Zero intelligence loss on restart

### Infrastructure Components (Already Built)

- persistence-adapter.ts: CRUD operations for all stores
- persistence-cold-start-loader.ts: DB to Map hydration
- persistence-health-monitor.ts: Health metrics
- persistence-registry.ts: Store registration and ordering
- PersistenceOperationLog: Audit trail for persistence operations
- PersistenceHealthSnapshot: Health monitoring data
- ShadowModeReconciliation: Compare in-memory vs DB

### DB Models for Persistence

- KnowledgeGraphNode, KnowledgeGraphEdge (graph nodes/edges)
- AIMemoryEntry (4-layer memory)
- RetrievalIndexEntry (hybrid retrieval index)
- RetrievalCorpusStats (IDF statistics)

## 5. AI Governance Architecture

### Flow

API Route -> governedAICall() / governedAICallAggregate()
Pre-flight checks (6: research_exists, confidence, freshness, staleness, capability_match, recent_intelligence)
-> Hallucination Prevention (15 rules injected into system prompt)
-> Evidence Grounding Notes (appended to user prompt)
-> ModelRouter (fast/smart/deep tier selection)
-> LLM Call
-> Post-generation Hallucination Check (WI-16B: claim extraction + citation verification)
-> Audit Trail (AIGenerationAudit DB record)
-> Response

### Dual Enforcement

1. ESLint rule (no-ungoverned-llm.js): Static analysis at build time
2. Shell script (check-governance.sh): Runtime CI gate
3. Phase 0 addition: streamAICall and getLLMChain now caught

### Bypass Status (Phase 0)

- /api/ai/chat-stream: BLOCKED (returns 403)
- governedAICallAggregate(): Advisory-only (by design, 14/25 routes)
- enforceGovernance flag: Caller-controlled (documented, not changed in Phase 0)
- Cost governance: Manual (not integrated into governedAICall yet)

## 6. Feedback and Learning Architecture

### 4 Learning Loops (All Exist, Wiring Status)

| Loop | File | LOC | Stores To | Wired To Scoring? |
|------|------|-----|-----------|-------------------|
| WI-17E Feedback Loop | feedback-learning-loop.ts | 950 | AIMemoryEntry, IntelligenceFeedback, LearningEvent | Not wired |
| Decision Learning | decision-learning.ts | 708 | Evidence table (feedback entries) | Not wired |
| Continuous Learning | continuous-learning-loop.ts | 203 | LearningEvent, CapabilityAsset | Not wired |
| Signal Learning | learning-loop.ts | 191 | Evidence table (signal feedback) | Not wired |

Phase 1 Task: Wire getCalibrationAdjustments() into recommendation-engine.ts.

## 7. Knowledge Graph Architecture

Entity Types (21): company, person, role, signal, technology, capability, industry, market, decision_maker, product, competitor, location, event, document, evidence, opportunity, relationship, concept, organization

Relationship Types (30): REPORTS_TO, WORKS_AT, INFLUENCES, USES_TECHNOLOGY, HAS_SIGNAL, MATCHES_CAPABILITY, PARTNERS_WITH, INVESTED_IN, COMPETES_WITH, DEPENDS_ON, ACQUIRED, LEADS_TO, INDICATES_OPPORTUNITY, MIGRATED_FROM, OWNS, MANAGES, BELONGS_TO, LOCATED_IN, PROVIDES, REQUIRES, SUPPORTS, COLLABORATES_WITH, SUBSIDIARY_OF, PARENT_OF, KNOWS_ABOUT, INTERESTED_IN

Storage: 6 in-memory Maps (nodeStore, edgeStore, sourceEdgeIndex, targetEdgeIndex, labelIndex, typeIndex, relationshipIndex)

## 8. Prisma Schema Summary

- Total Models: 105
- Total Enums: ~30
- Schema Lines: 3,512+
- Phase 0 Addition: parentId, subsidiaryType on Company model

## 9. Test Categories

| Category | Config | Files | Tests | Status |
|----------|--------|-------|-------|--------|
| Unit | vitest.unit.config.ts | 31 | 931/976 (2 OOM errors, infrastructure) | Pass |
| Security | vitest.security.config.ts | 13 | 333/333 | Pass |
| AI | vitest.ai.config.ts | 22 | 409/409 | Pass |
| API | vitest.api.config.ts | 12 | 745/759 (14 skipped) | Pass |
| Database | vitest.database.config.ts | 10 | 331/343 (1 failed: no DB URL, 12 skipped) | Expected |

Total: 2,749 tests passed across all suites.

## 10. Phase Plan Overview

| Phase | Weeks | Focus |
|-------|-------|-------|
| Phase 0 | 1-2 | Foundation Integrity |
| Phase 1 | 3-5 | Intelligence Persistence Activation |
| Phase 2 | 6-8 | Document Intelligence and Signal Operations |
| Phase 3 | 9-12 | Proactive Intelligence and Decision Layer |
| Phase 4 | 13-16 | Intelligence Delivery and Deep Analysis |
| Phase 5 | 17-20 | Predictive Intelligence and Enterprise Hardening |
| Phase 6 | 21-22 | Polish and Market Readiness |

## 11. Product Boundaries

What DeepMindQ IS: Enterprise Intelligence Operating System. System of understanding and reasoning about business reality.

What DeepMindQ Is NOT: CRM replacement, email outreach automation, sales engagement tool, autonomous selling robot, lead database, generic AI chatbot.

What Was Redirected: Email sequences to Intelligence Digest, multi-agent framework to Deep Analysis Mode, pipeline forecasting to Intelligence Health Forecasting, deal coaching to Engagement Advisory.

## 12. Engineering Decision Test

For every future feature: Does this make DeepMindQ understand businesses better, reason better, explain better, or learn better?
