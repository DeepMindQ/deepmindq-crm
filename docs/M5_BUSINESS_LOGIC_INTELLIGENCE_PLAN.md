# M5: Business Logic & Intelligence Plan

**DeepMindQ — Enterprise Intelligence Platform**

**Status:** Planning Phase  
**Depends on:** M4-CICD-ARCHITECTURE-COMPLETE  
**Created:** August 6, 2026  
**Version:** 1.1 (Terminology aligned to Enterprise Intelligence Platform)

---

## Table of Contents

1. [Current System Capability Map](#1-current-system-capability-map)
2. [Intelligence Architecture Definition](#2-intelligence-architecture-definition)
3. [Business Logic Domains](#3-business-logic-domains)
4. [M5 Scope Definition](#4-m5-scope-definition)
5. [Database Impact Review](#5-database-impact-review)
6. [API Architecture Review](#6-api-architecture-review)
7. [AI Governance Requirements](#7-ai-governance-requirements)
8. [Testing Requirements](#8-testing-requirements)
9. [Security Requirements](#9-security-requirements)
10. [M5 Acceptance Criteria](#10-m5-acceptance-criteria)

---

## 1. Current System Capability Map

### 1.1 System Overview

| Metric | Value |
|---|---|
| **Prisma Models** | 100 |
| **Database Indexes** | 417 |
| **Enums** | 40+ |
| **API Route Files** | 250 (0 stubs — all real implementations) |
| **Top-Level API Directories** | 79 |
| **Business Logic Files (src/lib/)** | ~170 |
| **Test Files** | 165 |
| **Vitest Configs** | 20 (categorized silos) |
| **Background Job Types** | 5 (enrichment, research, scoring, signal_detection, email_generation) |
| **AI Providers** | 5 (NVIDIA, Fireworks, Groq, Gemini, Tavily) |
| **AI Governance Layer** | Full (confidence gates, hallucination prevention, audit trail) |

### 1.2 Business Modules Inventory

#### Entity & Relationship Intelligence Modules

| Name | Location | Purpose | Maturity | Dependencies | Test Coverage | Missing |
|---|---|---|---|---|---|---|---|
| **Companies** | `src/app/api/companies/` (24 routes), `src/lib/company-matcher.ts`, `src/lib/icp-config.ts` | Full company lifecycle: CRUD, search, filter, sort, pagination, dedup, AI enrichment, ICP alignment, intelligence profile, mind map, comparison | **Production** | db, ai-governance, lead-scoring | Partial (real-integration CRUD) | Rate limiting, comprehensive sub-route tests |
| **Contacts** | `src/app/api/contacts/` (9 routes), `src/lib/lead-scoring.ts`, `src/lib/relationship-mapping-engine.ts` | Contact management, engagement prediction, email generation, relationship mapping, person profiles | **Production** | db, ai-governance, email-generation | Partial (real-integration CRUD) | Rate limiting, generate-email tests |
| **Leads** | `src/app/api/leads/` (10 routes), `src/lib/lead-scoring.ts`, `src/lib/lead-workflow.ts` | Lead lifecycle: dual-source, dedup (Jaccard), assignment (4 strategies), lookalike, export, consent, scheduling | **Production** | db, validations | Minimal (email-verify only) | Full sub-route test coverage |
| **Opportunities** | `src/app/api/opportunities/` (2 routes), `src/app/api/ai/opportunities/` (4 routes) | Opportunity CRUD, radar, accept/reject with feedback, probability scoring | **Production** | db, scoring | Partial (opportunity-research) | Direct route tests |
| **Pipeline** | `src/app/api/pipeline/` (3 routes) | Pipeline analytics, health monitoring (5 risk factors), AI-powered forecast (evidence-backed) | **Production** | db, ai-governance, evidence-framework | **None** | All pipeline routes untested |
| **Sequences** | `src/app/api/sequences/` (6 routes) | Email sequence CRUD, enrollment (batch, dedup), AI personalization, step processing | **Production** | db, ai-governance | **None** | All sequence routes untested |
| **Emails** | `src/app/api/emails/` (2 routes), `src/lib/email-provider.ts`, `src/lib/email-generation.ts`, `src/lib/email-intelligence-engine.ts` | Multi-provider send (Resend/SendGrid/SES/Postmark), tracking (open/click), bounce/reply webhook handling, AI generation | **Production** | db, ai-governance, nodemailer | Minimal (engine only) | Send/track route tests |

#### Intelligence Modules

| Name | Location | Purpose | Maturity | Dependencies | Test Coverage | Missing |
|---|---|---|---|---|---|---|
| **Intelligence Pipeline** | `src/lib/intelligence-pipeline.ts` | Core product pipeline: Company → Web Search → Signal Extraction → CompanySignal → Evidence → ResearchCard → Score | **Production** | llm-client, db, intelligence-sources | Integration tests | Full regression suite |
| **AI/LLM Layer** | `src/lib/ai-*.ts`, `src/lib/llm-client.ts`, `src/lib/ai-config.ts` | Unified LLM entry (callAI/callLLM/revenueLLMCall), governance, hallucination prevention, tracing, caching, prompt registry, evaluation | **Production** | db, z-ai-web-dev-sdk, crypto | 37 AI test files | Live provider reliability, cost tracking |
| **AI Engines** | `src/lib/engines/` (7 engines) | Model Router (tiered: Deep/Smart/Fast), Grounding, Retrieval, Synthesis, Scoring, Action, Conversation | **Production** | llm-client, ai-config | Unit + golden dataset | Cross-engine integration |
| **AI Extensions** | `src/lib/ai-knowledge-graph.ts`, `src/lib/ai-memory.ts`, `src/lib/ai-agent-framework.ts`, `src/lib/ai-hybrid-retrieval.ts` | Knowledge graph (1781 lines), 4-layer memory, agent framework (2874 lines), hybrid retrieval | **Advanced** | db, transformers | Dedicated configs | Production hardening |
| **Intelligence Sources** | `src/lib/intelligence-sources/` (35+ files) | Connectors (CSV/Excel/Website/RSS), evidence pipeline, knowledge fabric, association engine, predictive intelligence, autonomous monitoring, learning loop | **Production** | db, llm-client | 18 co-located tests | Connector reliability |
| **Revenue Intelligence** | `src/lib/revenue-intelligence/` (7 files) | Signal patterns, extraction, account scoring, AI briefs, opportunity radar, executive recommendations | **Production** | db, ai-governance | 8 co-located tests | Full integration |
| **Research Engine** | `src/lib/research-engine/` (12 files) | 6-step company research, evidence collection, signal lifecycle, opportunity scoring | **Production** | db, llm-client | Research-engine config | Pipeline regression |
| **Scoring Engines** | `src/lib/scoring/` (5 files) | Contact influence, revenue opportunity, buying intent (5 signal categories), opportunity probability, freshness ranking | **Production** | db, intelligence-sources | Partial | Full coverage |
| **Data Intelligence** | `src/lib/data-intelligence/` (8 files) | Data import analysis, column detection, AI correction, dedup, normalization, quality scoring, validation | **Production** | db, ai-governance | Database test files | Production volume testing |
| **Recommendation Engine** | `src/lib/recommendation-engine.ts` | WI-17C: Unified recommendation layer aggregating all intelligence into prioritized recommendations | **Production** | db, scoring, intelligence | Recommendation tests | Feedback loop integration |
| **Persistence Engine** | `src/lib/persistence/` (8 files) | PostgreSQL adapter, failure queue, health monitor, cold-start loader, shadow mode, registry | **Production** | db | Integration tests | Shadow mode accuracy |

#### Background Jobs

| Name | Location | Schedule | Purpose | Maturity |
|---|---|---|---|---|
| **Daily Intelligence** | `/api/cron/job-processor` | Daily 6AM (Vercel Cron) | 11-step maintenance: stale job recovery, job processing, freshness updates, connector execution, autonomous monitoring, alerts, cross-account analysis, predictions, learning loop | **Production** |
| **Persistence Performance** | `/api/cron/persistence-performance` | On-demand (CRON_SECRET) | Latency, queue depth, DB connectivity, memory observation | **Production** |
| **Persistence Evidence** | `/api/cron/persistence-evidence` | On-demand (CRON_SECRET) | Shadow mode evidence collection, reliability metrics | **Production** |
| **Sequence Processor** | `/api/sequences/process` | On-demand | Due enrollment processing, AI personalization, draft creation | **Production** |
| **Email Worker** | `/api/email-worker` | On-demand | Outbound email processing queue | **Production** |

### 1.3 Database Schema Summary

**100 Prisma Models** organized by domain:

| Domain | Models | Count |
|---|---|---|
| **Entity & Relationship Intelligence** | Company, Contact, CompanyNote, ContactNote, Draft, Pursuit, CompanyAlias, CompanyTimelineEvent | 8 |
| **Intelligence** | IntelligenceObject, CompanySignal, Evidence, CompanyResearchCard, IntelligenceAlert, IntelligenceActionHistory, IntelligenceAssociation, IntelligenceConflict, IntelligenceFeedback, IntelligenceSnapshot, IntelligenceTimeline, IntelligenceValidation | 12 |
| **AI/ML** | AIGenerationAudit, AIInsight, AICache, AICallLog, AIUsageLog, AIMemoryEntry, ABTest, AIEngagementStrategy, AccountBrief, AccountScore, AccountStrategy | 11 |
| **Scoring** | AccountBrief, AccountScore, PriorityScoreHistory, ScoringWeight, SignalValidation, SignalCapabilityMatch, OpportunityRecommendation, OpportunitySignal | 8 |
| **Knowledge** | KnowledgeChunk, KnowledgeDocument, KnowledgeEntry, KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeVersion, CapabilityAsset | 7 |
| **Jobs/Workflow** | Job, JobLog, PipelineRun, Connector, ConnectorRun, EngineRun | 6 |
| **Persistence** | PersistenceHealthSnapshot, PersistenceOperationLog, ShadowModeReconciliation, RetrievalIndexEntry, RetrievalCorpusStats | 5 |
| **Email** | EmailSequence, SequenceEnrollment, SequenceStep, SendQueue, EmailEvent, Bounce, Reply, Suppression, CustomEmailTemplate, EmailTemplate | 10 |
| **Data Import** | DataUpload, UploadRow, ImportBatch, ColumnMappingRule, FieldValidationRule, NormalizationMapping, NormalizationLog, DataQualityScore | 8 |
| **Auth/System** | User, Session, OtpCode, AuditLog, SystemSetting, SourceHealth, EvidenceSourceReliability, PeopleProfileEnrichment, CompetitiveSignal, WebsiteSnapshot, ActionArtifact, ConversationPlan, Playbook, Segment, SegmentContact, FusionResult, LearningEvent, ReasoningContext, ReasoningStep, AgentOrchestration, AgentRun, StrategicInsight, HumanIntelligenceInbox, Embedding, CompanyIntelligenceFreshness, CompanyIntelligenceHealth | 25 |

---

## 2. Intelligence Architecture Definition

### 2.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION / API LAYER                       │
│  250 API Routes  |  79 Directories  |  Auth + RBAC + Rate Limit│
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                 RECOMMENDATION ENGINE (WI-17C)                  │
│  Unified Layer: Aggregates all intelligence into prioritized    │
│  account recommendations with explainability trails              │
└────────┬──────────┬──────────┬──────────┬───────────────────────┘
         │          │          │          │
┌────────▼──┐ ┌─────▼────┐ ┌──▼──────┐ ┌─▼────────────────────────┐
│  AI       │ │ Revenue  │ │ Scoring │ │ Knowledge                 │
│ Reasoning │ │ Intel    │ │ Engines │ │ Layer                     │
│ Layer     │ │ Layer    │ │ Layer   │ │                           │
└────┬──────┘ └────┬─────┘ └────┬────┘ └─┬────────────────────────┘
     │             │            │         │
┌────▼─────────────▼────────────▼─────────▼──────────────────────┐
│                   BUSINESS INTELLIGENCE LAYER                   │
│  Intelligence Pipeline │ Research Engine │ Cross-Account       │
│  Predictive Intel │ Autonomous Monitor │ Learning Loop          │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    DATA PROCESSING LAYER                       │
│  Intelligence Sources (35+ connectors) │ Evidence Pipeline      │
│  Data Intelligence (import/normalize/dedup/quality) │ Fusion   │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                       DATA SOURCES                              │
│  Neon PostgreSQL │ In-Memory (Vector Index, KG, Memory, Cache) │
│  External: Web Search │ CSV/Excel │ RSS │ Websites │ Webhooks    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

#### Data Sources Layer

| Component | Responsibility | Technology | DB Impact | API Impact | Security | Testing |
|---|---|---|---|---|---|---|
| **Neon PostgreSQL** | Primary persistent store for all business data | Prisma ORM, Neon Serverless | N/A (existing) | N/A (existing) | Connection pooling, SSL | Integration tests with test DB |
| **In-Memory Stores** | Vector index, knowledge graph, AI memory, rate limits, caches | Custom JS (Map/Set), @xenova/transformers | Cold-start loader populates from DB | N/A (internal) | No external exposure | Unit + shadow mode comparison |
| **External Sources** | Web search (Tavily), CSV/Excel uploads, RSS feeds, website scraping | fetch(), @xenova/transformers, mammoth, papaparse | Evidence, IntelligenceObject, KnowledgeChunk | Intelligence API routes | Source validation, rate limit | Connector unit tests |
| **Webhooks** | Email bounces, replies from email providers | crypto signature verification | Bounce, Reply, Contact, Company | Webhook routes (public) | Provider signature auth | Integration tests |

#### Data Processing Layer

| Component | Responsibility | Technology | DB Impact | API Impact | Security | Testing |
|---|---|---|---|---|---|---|
| **Intelligence Sources** | 35+ connectors for data acquisition | BaseConnector pattern, job queue | Evidence, CompanySignal, IntelligenceObject | Collect-external, connectors | API auth + rate limit | 18 co-located tests |
| **Evidence Pipeline** | Raw data → standardized evidence with quality scoring | evidence-classifier, evidence-adapter | Evidence, EvidenceSourceReliability | Grounding detail routes | Evidence integrity validation | Evidence quality tests |
| **Data Intelligence** | Import analysis, column detection, normalization, dedup, quality | AI-powered correction, rule-based normalization | DataUpload, UploadRow, DataQualityScore | Data-import routes | Admin-only upload | Database test files |
| **Fusion Engine** | Multi-source intelligence fusion | Cross-signal correlation | FusionResult, IntelligenceAssociation | Unified query route | API auth | Cross-source validation |

#### Business Intelligence Layer

| Component | Responsibility | Technology | DB Impact | API Impact | Security | Testing |
|---|---|---|---|---|---|---|
| **Intelligence Pipeline** | Core product: Company → Signal → Evidence → Research → Score | intelligence-pipeline.ts, llm-client | CompanySignal, Evidence, ResearchCard, AccountScore | Full-pipeline route | API auth + guard | Pipeline integration |
| **Research Engine** | 6-step company research with evidence collection | researcher.ts, evidence.ts | CompanyResearchCard, Evidence | Company intelligence routes | API auth | Research-engine config |
| **Cross-Account** | Detect patterns across accounts | cross-account-intelligence.ts | IntelligenceAssociation | Cross-account route | API auth | Integration test |
| **Predictive Intelligence** | Future state predictions | predictive-intelligence.ts | IntelligenceAlert | Predictions route | API auth | Prediction accuracy |
| **Autonomous Monitor** | Continuous monitoring with alerting | autonomous-monitor.ts | IntelligenceAlert, IntelligenceSnapshot | Monitor route | API auth + CRON | Monitor reliability |
| **Learning Loop** | Signal feedback → model improvement | learning-loop.ts, feedback-learning-loop.ts | LearningEvent, RecommendationFeedback | Feedback route | API auth | Learning quality tests |

#### AI Reasoning Layer

| Component | Responsibility | Technology | DB Impact | API Impact | Security | Testing |
|---|---|---|---|---|---|---|
| **AI Governance** | Confidence gates, hallucination prevention, audit trail | ai-governance.ts | AIGenerationAudit | Governance check route | Audit logging | 37 AI test files |
| **Model Router** | Tiered LLM routing (Deep/Smart/Fast) with fallback | model-router.ts | AICallLog, AIUsageLog | N/A (internal) | Provider key encryption | Router reliability |
| **AI Engines** | Grounding, retrieval, synthesis, scoring, action, conversation | engines/ (7 files) | EngineRun, ActionArtifact | Engine routes | API auth | Golden dataset |
| **AI Extensions** | Knowledge graph, memory, agents, hybrid retrieval | ai-knowledge-graph, ai-memory, ai-agent-framework | KnowledgeGraph*, AIMemory*, AgentRun | Agent/graph/memory routes | API auth | Dedicated configs |
| **Prompt Registry** | Centralized prompt template management | prompt-templates-store.ts | SystemSetting | Prompt management | Admin-only | Prompt regression |

#### Knowledge Layer

| Component | Responsibility | Technology | DB Impact | API Impact | Security | Testing |
|---|---|---|---|---|---|---|
| **Knowledge Ingestion** | 8-step: Extract → Chunk → Classify → Summarize → Embed → Link → Version → Search | knowledge-ingestion-pipeline.ts | KnowledgeDocument, KnowledgeChunk, KnowledgeVersion | Ingest route | Admin-only upload | Ingest pipeline tests |
| **Vector Index** | In-memory TF-IDF embeddings with cosine similarity | embeddings.ts, vector-index.ts | RetrievalIndexEntry (cache) | Retrieval metrics route | N/A (internal) | Retrieval benchmarks |
| **Knowledge Graph** | Entity extraction, BFS/DFS traversal, relationship scoring | ai-knowledge-graph.ts | KnowledgeGraphNode, KnowledgeGraphEdge | Graph route | API auth | Graph operations tests |

#### Recommendation Engine

| Component | Responsibility | Technology | DB Impact | API Impact | Security | Testing |
|---|---|---|---|---|---|---|
| **Unified Recommendations** | Aggregate all intelligence into prioritized account recommendations | recommendation-engine.ts | OpportunityRecommendation | Recommendations routes | API auth | Recommendation accuracy |
| **Explainability** | Full reasoning trails, evidence, confidence breakdowns | explainability-engine.ts | ReasoningContext, ReasoningStep | Explain routes | API auth | Explainability tests |
| **Feedback Loop** | User feedback → model improvement | feedback-learning-loop.ts | RecommendationFeedback, LearningEvent | Feedback route | API auth | Feedback integration |

---

## 3. Business Logic Domains

### 3.1 Company Intelligence

**Current State:** Production-ready. 24 API routes with full CRUD, AI enrichment, ICP alignment, intelligence profiles, mind maps.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Company CRUD | ✅ Complete | `api/companies/` | Zod validation, dedup, pagination |
| AI Enrichment | ✅ Complete | `api/companies/enrich`, `api/ai/enrich` | Governance-gated, human-approval |
| ICP Alignment | ✅ Complete | `api/companies/[id]/alignment` | Configurable industry/size/region |
| Intelligence Profile | ✅ Complete | `api/companies/[id]/intelligence-profile` | Full signal + score + evidence |
| Company Matching | ✅ Complete | `lib/company-matcher.ts` | Name-based dedup |
| Industry Classification | ⚠️ Partial | Inline in enrichment | Not a standalone service |
| Org Chart Analysis | ❌ Missing | — | No hierarchical structure |
| Technology Stack Detection | ⚠️ Partial | Signals-based | Not a dedicated module |
| Financial Health Scoring | ❌ Missing | — | No financial data pipeline |

**M5 Action:** Industry classification and financial health scoring are P1. Org chart analysis is P2.

### 3.2 Contact Intelligence

**Current State:** Production-ready. 9 API routes with full CRUD, engagement prediction, email generation, relationship mapping.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Contact CRUD | ✅ Complete | `api/contacts/` | Zod validation, sanitization |
| Lead Scoring | ✅ Complete | `lib/lead-scoring.ts` | 6 dimensions, 0-100 |
| Engagement Prediction | ✅ Complete | `api/contacts/engagement-prediction` | ML-based |
| Email Generation | ✅ Complete | `api/contacts/[id]/generate-email` | LLM + template fallback |
| Relationship Mapping | ✅ Complete | `lib/relationship-mapping-engine.ts` | Cross-entity |
| Role Intelligence | ⚠️ Partial | lead-scoring (roleScore) | Not a dedicated service |
| Buying Authority Assessment | ⚠️ Partial | Scoring only | No org authority mapping |
| Communication Preferences | ❌ Missing | — | No preference learning |
| Contact Clustering | ❌ Missing | — | No grouping/segmentation |

**M5 Action:** Contact clustering and communication preference learning are P1. Buying authority assessment is P2.

### 3.3 Revenue Intelligence

**Current State:** Advanced. Multiple scoring engines, signal extraction, opportunity radar, account briefs.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Revenue Scoring | ✅ Complete | `lib/scoring/revenue-opportunity-engine.ts` | Decomposed scoring |
| Signal Patterns | ✅ Complete | `lib/revenue-intelligence/signal-patterns.ts` | Revenue signal definitions |
| Account Scoring | ✅ Complete | `lib/revenue-intelligence/account-scoring.ts` | Account-level scoring |
| Opportunity Radar | ✅ Complete | `lib/revenue-intelligence/opportunity-radar.ts` | Detection + ranking |
| AI Briefs | ✅ Complete | `lib/revenue-intelligence/brief-generator.ts` | Evidence-grounded |
| Buying Intent Detection | ✅ Complete | `lib/scoring/buying-intent-engine.ts` | 5 signal categories |
| Pipeline Forecast | ✅ Complete | `api/pipeline/forecast` | 322-line, evidence-backed |
| Deal Coaching | ✅ Complete | `api/ai/deal-coaching` | Rule-based, stage-specific |
| Deal Risk Assessment | ✅ Complete | `api/ai/deal-risk` | Staleness, ownership, confidence |
| Win Probability | ✅ Complete | `lib/scoring/opportunity-probability-engine.ts` | Multi-factor |
| Revenue Trend Analysis | ❌ Missing | — | No historical trend tracking |
| Cross-Sell/Upsell Detection | ❌ Missing | — | No product relationship |

**M5 Action:** Revenue trend analysis is P1. Cross-sell detection is P2 (requires product catalog model).

### 3.4 Knowledge Intelligence

**Current State:** Advanced. 8-step ingestion pipeline, knowledge graph, vector index, document processing.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Document Ingestion | ✅ Complete | `lib/knowledge-ingestion-pipeline.ts` | 8-step pipeline |
| Document Parsing | ✅ Complete | `lib/doc-parsers.ts` | TXT, MD, PDF, DOCX |
| Knowledge Graph | ✅ Complete | `lib/ai-knowledge-graph.ts` | 1781 lines, BFS/DFS |
| Vector Search | ✅ Complete | `lib/embeddings.ts`, `lib/vector-index.ts` | TF-IDF, cosine similarity |
| Knowledge Versioning | ✅ Complete | `KnowledgeVersion` model | Full version history |
| RAG-based Q&A | ⚠️ Partial | `lib/engines/retrieval-engine.ts` | Local embeddings only |
| Semantic Chunking | ⚠️ Partial | Fixed 500-1000 word chunks | No semantic boundary detection |
| Knowledge Extraction from Conversations | ❌ Missing | — | No auto-extraction from email/reply |
| Knowledge Expiration | ❌ Missing | — | No TTL-based expiration |

**M5 Action:** Semantic chunking and knowledge extraction from conversations are P0. Knowledge expiration is P1.

### 3.5 AI Reasoning

**Current State:** Advanced. Full governance layer, agent framework, hybrid retrieval, multi-source reasoning.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Confidence Gates | ✅ Complete | `lib/ai-governance.ts` | Per-generation thresholds |
| Hallucination Prevention | ✅ Complete | `lib/ai-hallucination-prevention.ts` | Rule-based |
| Evidence Grounding | ✅ Complete | `lib/engines/grounding-engine.ts` | Citations + confidence |
| Explainability | ✅ Complete | `lib/explainability-engine.ts` | 6-dimension breakdown |
| Agent Framework | ✅ Complete | `lib/ai-agent-framework.ts` | 2874 lines, 8 tool types |
| Hybrid Retrieval | ✅ Complete | `lib/ai-hybrid-retrieval.ts` | Multi-signal retrieval |
| 4-Layer Memory | ✅ Complete | `lib/ai-memory.ts` | Working/short/long/enterprise |
| Multi-Agent Orchestration | ⚠️ Partial | `lib/multi-agent-orchestrator.ts` | Legacy DAG (being replaced) |
| Deterministic AI Testing | ⚠️ Partial | Golden datasets, prompt regression | Not fully automated |
| AI Cost Governance | ⚠️ Partial | `lib/ai-cost-governance.ts` | Tracking exists, no enforcement |

**M5 Action:** Deterministic AI testing automation and AI cost enforcement are P0. Multi-agent production hardening is P1.

### 3.6 Communication Intelligence

**Current State:** Production-ready. Multi-channel sequences, enrollment, AI personalization, pipeline analytics.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Email Sequences | ✅ Complete | `api/sequences/` | Full CRUD + processing |
| AI Personalization | ✅ Complete | `api/sequences/process` | LLM + template fallback |
| Revenue Pipeline Analytics | ✅ Complete | `api/pipeline/health` | Stage distribution, velocity, risk |
| Revenue Pipeline Forecast | ✅ Complete | `api/pipeline/forecast` | Evidence-backed AI |
| Multi-Channel Orchestration | ❌ Missing | — | No cross-channel coordination |
| Send Time Optimization | ⚠️ Partial | `api/leads/schedule-optimal` | Basic, not AI-driven |
| A/B Testing Framework | ⚠️ Partial | `ABTest` model exists | No execution engine |
| Behavioral Trigger Intelligence | ❌ Missing | — | No event-driven automation |

**M5 Action:** A/B testing execution and multi-channel orchestration are P1. Behavioral triggers are P2.

### 3.7 Workflow Intelligence

**Current State:** Production-ready. Background jobs, daily intelligence maintenance, connector scheduling, batch processing.

| Capability | Status | Location | Notes |
|---|---|---|---|
| Daily Intelligence Maintenance | ✅ Complete | `/api/cron/job-processor` | 11-step automated maintenance |
| Connector Scheduling | ✅ Complete | `lib/intelligence-sources/job-queue.ts` | Background job execution |
| Sequence Processing | ✅ Complete | `/api/sequences/process` | Due enrollment + AI personalization |
| Email Worker Queue | ✅ Complete | `/api/email-worker` | Outbound processing queue |
| Persistence Health Monitoring | ✅ Complete | `/api/cron/persistence-performance` | Latency, queue depth, DB connectivity |
| Persistence Evidence Collection | ✅ Complete | `/api/cron/persistence-evidence` | Shadow mode reliability metrics |
| Workflow Orchestration | ⚠️ Partial | `lib/workflow-engine/` | Basic processor/queue/retry |
| Event-Driven Triggers | ❌ Missing | — | No real-time event-to-action pipelines |
| Workflow Analytics | ❌ Missing | — | No execution history or optimization |

**M5 Action:** Workflow orchestration hardening is P1. Event-driven triggers and analytics are P2.

---

## 4. M5 Scope Definition

### 4.1 P0 — Core M5 Deliverables

These are required for M5 milestone completion.

#### P0-1: Test Coverage Completion for Critical Paths

| Item | Details |
|---|---|
| **Capability** | Comprehensive tests for untested critical business flows |
| **Business Value** | Risk mitigation for production deployment; confidence in pipeline stability |
| **Implementation** | Add real-integration tests for: sequences (enroll + process), email send/track, pipeline health/forecast, lead dedup/assign/lookalike, opportunity CRUD |
| **Dependencies** | Test infrastructure (existing), Neon staging DB |
| **API Impact** | None (tests only) |
| **Database Impact** | None (tests only, uses staging) |
| **Tests Required** | ~25 new test files across 5 test categories |
| **Acceptance Criteria** | All new tests pass in CI; zero regressions in existing tests; coverage thresholds raised to 50% statements / 40% branches |

#### P0-2: AI Testing Automation

| Item | Details |
|---|---|
| **Capability** | Deterministic AI test automation with golden datasets and prompt regression |
| **Business Value** | Prevent AI quality degradation; ensure consistent AI behavior across releases |
| **Implementation** | Extend golden dataset framework; automated prompt regression runner; CI-integrated AI quality gate |
| **Dependencies** | AI governance layer (existing), test infrastructure |
| **API Impact** | New `/api/ai/evaluation` endpoints enhanced |
| **Database Impact** | AIGenerationAudit (existing) |
| **Tests Required** | 15+ golden dataset scenarios; 10+ prompt regression tests; CI gate |
| **Acceptance Criteria** | AI quality gate blocks PRs with regression >5%; golden dataset pass rate >=95%; automated nightly quality report |

#### P0-3: Knowledge Extraction from Business Conversations

| Item | Details |
|---|---|
| **Capability** | Auto-extract knowledge from email replies, bounce data, and platform interactions |
| **Business Value** | Automatically build knowledge base from existing business communications |
| **Implementation** | Parse email replies → extract entities → feed into knowledge ingestion pipeline; link to Company/Contact; classify into knowledge categories |
| **Dependencies** | Webhook handlers (existing), knowledge ingestion pipeline (existing) |
| **API Impact** | Enhanced webhook processing; new `/api/knowledge/auto-extract` endpoint |
| **Database Impact** | KnowledgeDocument, KnowledgeChunk, KnowledgeEntry (existing models) |
| **Tests Required** | Unit tests for extraction logic; integration test for webhook→knowledge pipeline |
| **Acceptance Criteria** | Email replies auto-extracted into knowledge entries; entities linked to platform records; classification accuracy >=80% |

#### P0-4: Semantic Chunking Enhancement

| Item | Details |
|---|---|
| **Capability** | Improve knowledge ingestion with semantic boundary detection for document chunking |
| **Business Value** | Better knowledge retrieval accuracy; more meaningful knowledge units |
| **Implementation** | Replace fixed 500-1000 word chunks with NLP-based semantic boundary detection; maintain backward compatibility with existing chunks |
| **Dependencies** | Knowledge ingestion pipeline (existing), @xenova/transformers (existing) |
| **API Impact** | Enhanced `/api/knowledge/ingest` with semantic mode option |
| **Database Impact** | KnowledgeChunk (existing model, new `chunkingMethod` field) |
| **Tests Required** | Unit tests for boundary detection; comparison tests (fixed vs semantic); retrieval quality benchmarks |
| **Acceptance Criteria** | Semantic chunks improve retrieval relevance by >=15%; no regressions in existing knowledge queries; migration for new field is backward-compatible |

#### P0-5: Rate Limiting for All Business Intelligence APIs

| Item | Details |
|---|---|
| **Capability** | Apply consistent rate limiting to all business intelligence API routes |
| **Business Value** | Prevent API abuse; protect against DoS; ensure fair usage |
| **Implementation** | Extend `withApiMiddleware` with configurable per-route rate limits; apply to all 56 core business intelligence routes |
| **Dependencies** | `lib/rate-limit.ts` (existing), `lib/api-middleware.ts` (existing) |
| **API Impact** | All business intelligence routes gain rate limiting headers (X-RateLimit-*) |
| **Database Impact** | None (in-memory rate limit store, existing) |
| **Tests Required** | Rate limit unit tests; integration tests verifying 429 responses |
| **Acceptance Criteria** | All business intelligence routes return 429 when limit exceeded; rate limit headers present on all responses; no performance degradation |

#### P0-6: API Documentation and Contract Validation

| Item | Details |
|---|---|
| **Capability** | OpenAPI/Swagger documentation for all 250 API routes with automated contract testing |
| **Business Value** | Developer experience; API consistency; prevent breaking changes |
| **Implementation** | Generate OpenAPI spec from route definitions; add contract tests that validate response shapes |
| **Dependencies** | Zod schemas (existing, 40+ schemas) |
| **API Impact** | New `/api/docs` endpoint serving OpenAPI spec |
| **Database Impact** | None |
| **Tests Required** | Contract tests for all 250 routes |
| **Acceptance Criteria** | OpenAPI spec generated for 100% of routes; contract tests pass in CI; spec available at `/api/docs` |

### 4.2 P1 — Secondary Enhancements

| ID | Capability | Description | Effort |
|---|---|---|---|
| P1-1 | AI Cost Enforcement | Hard budgets per feature/month; auto-disable when exceeded | 3 days |
| P1-2 | Contact Clustering | Group contacts by similarity (role, industry, engagement) | 5 days |
| P1-3 | Communication Preference Learning | Learn optimal send time/channel from engagement data | 4 days |
| P1-4 | Revenue Trend Analysis | Historical revenue scoring trends with visualization | 4 days |
| P1-5 | Knowledge Expiration | TTL-based knowledge freshness with auto-archival | 3 days |
| P1-6 | Multi-Agent Production Hardening | Replace legacy orchestrator; add circuit breakers | 5 days |
| P1-7 | A/B Testing Execution Engine | Run and evaluate email A/B tests with statistical significance | 4 days |
| P1-8 | Sequence Optimization | AI-driven step ordering and timing optimization | 4 days |
| P1-9 | Authentication Consistency | Migrate 2 engine routes from `requireAuth()` to `checkApiAuth()` | 1 day |
| P1-10 | Coverage Threshold Increase | Raise from 30%/20% to 60%/50% statements/branches | 3 days |

### 4.3 P2 — Future Roadmap

| ID | Capability | Description | Phase |
|---|---|---|---|
| P2-1 | Org Chart Analysis | Hierarchical company structure detection | M6 |
| P2-2 | Financial Health Scoring | External financial data integration | M6 |
| P2-3 | Buying Authority Assessment | Org-level authority mapping | M6 |
| P2-4 | Cross-Sell/Upsell Detection | Product relationship modeling | M7 |
| P2-5 | Drip Campaign Intelligence | Behavior-triggered automated campaigns | M7 |
| P2-6 | Advanced Provider Management | Dynamic provider scaling, cost optimization | M7 |

---

## 5. Database Impact Review

### 5.1 Existing Schema Health

- **100 models** with 417 indexes — well-indexed
- **40+ enums** providing type safety
- **Single migration**: `20260701000000_init_baseline`
- **Migration strategy**: `prisma migrate deploy` with P3005 baseline resolution
- **Connection strategy**: Pooled (app runtime) + Direct (migrations)

### 5.2 Proposed Schema Changes for M5

| Change | Model | Field | Type | Migration Required | Backward Compatible |
|---|---|---|---|---|---|
| Semantic chunking method | KnowledgeChunk | `chunkingMethod` | String (enum: `fixed`, `semantic`) | Yes — add column with default `fixed` | Yes |
| Knowledge source tracking | KnowledgeDocument | `sourceType` | String (enum: `upload`, `email`, `webhook`, `auto_extract`) | Yes — add column with default `upload` | Yes |
| Rate limit configuration | SystemSetting | (existing model) | No schema change — use existing key-value | No | Yes |
| Contract test snapshots | (none) | No schema change — test infrastructure only | No | Yes |

**Total new migrations: 1** (additive columns only — fully backward compatible)

### 5.3 Migration Plan

```sql
-- Migration: 20260806000000_m5_knowledge_enhancements
-- Backward compatible: adds nullable columns with defaults

ALTER TABLE "KnowledgeChunk" ADD COLUMN "chunkingMethod" TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'upload';
```

---

## 6. API Architecture Review

### 6.1 Existing API Standards

All 250 routes follow consistent patterns:

- **Authentication**: `checkApiAuth()` from `src/lib/api-auth`
- **Validation**: Zod schemas from `src/lib/validations.ts`
- **Error handling**: `try/catch` with `logger.error()`, never leaks raw errors
- **Response format**: JSON with consistent envelope
- **Pagination**: Offset-based (most routes) + cursor-based (companies)

### 6.2 Authentication Inconsistency

Two routes use legacy `requireAuth()` instead of `checkApiAuth()`:

| Route | Current Auth | Required Auth | Fix Effort |
|---|---|---|---|
| `/api/engines/actions` | `requireAuth()` | `checkApiAuth()` | 5 min |
| `/api/engines/conversation` | `requireAuth()` | `checkApiAuth()` | 5 min |

### 6.3 Rate Limiting Gap

| Domain | Routes | Currently Rate Limited |
|---|---|---|
| Companies | 24 | No |
| Contacts | 9 | No |
| Leads | 10 | No |
| Opportunities | 2 | No |
| Pipeline | 3 | No |
| Sequences | 6 | No |
| Emails (send) | 1 | Yes (50/hr) |
| Emails (track) | 1 | No (public endpoint) |
| AI | 33 | Partial (governance + some Zod limits) |
| Intelligence | 32 | Yes (intelligence-api-guard) |
| Knowledge | 4 | No |
| Cron | 3 | Yes (CRON_SECRET) |
| Webhooks | 2 | No (provider signature) |

### 6.4 New APIs for M5

| Endpoint | Purpose | Auth | Validation | Response | Tests |
|---|---|---|---|---|---|
| `POST /api/knowledge/auto-extract` | Extract knowledge from conversations | checkApiAuth | Zod (source, content, entityType) | KnowledgeEntry | Unit + integration |
| `GET /api/knowledge/auto-extract/status` | Extraction job status | checkApiAuth | — | Job status | Unit |
| `PATCH /api/knowledge/ingest` | Enhanced ingest with semantic mode | checkApiAuth + AdminRole | Zod (semanticMode: boolean) | Pipeline stats | Unit |
| `GET /api/docs` | OpenAPI specification | Public | — | OpenAPI JSON | Unit |
| `GET /api/ai/testing/regression` | Prompt regression report | checkApiAuth + AdminRole | — | Regression report | Unit |

---

## 7. AI Governance Requirements

### 7.1 Current Governance State

The existing governance layer is comprehensive:

- **`ai-governance.ts`**: Confidence gates, hallucination prevention, evidence grounding, audit trail
- **`ai-governance-check/route.ts`**: Governance introspection endpoint
- **`ai-hallucination-prevention.ts`**: Rule-based hallucination detection
- **`ai-tracing.ts`**: Distributed tracing for AI calls
- **`ai-cache-layer.ts`**: Response caching with TTL
- **`ai-latency-budgets.ts`**: Latency budget enforcement
- **`ai-reliability.ts`**: Provider reliability tracking
- **`ai-prompt-registry.ts`**: Centralized prompt management
- **`AIGenerationAudit` model**: Every AI call recorded with type, tokens, cost, confidence, pass/fail

### 7.2 M5 Governance Additions

| Requirement | Implementation | Status |
|---|---|---|
| **No uncontrolled AI calls** | All calls go through `llm-client.ts` → `ai-governance.ts` | ✅ Existing |
| **Centralized AI service layer** | `llm-client.ts` is the single entry point | ✅ Existing |
| **Logging** | `AIGenerationAudit` table + `ai-tracing.ts` | ✅ Existing |
| **Cost tracking** | `ai-copilot/usage-tracker.ts` + `ai-cost-governance.ts` | ⚠️ Tracking exists, no enforcement |
| **Prompt/version management** | `ai-prompt-registry.ts` | ⚠️ Registry exists, no versioning |
| **Failure handling** | `model-router.ts` auto-fallback + `ai-reliability.ts` circuit breaking | ✅ Existing |
| **Deterministic testing** | Golden datasets + prompt regression | ⚠️ Partial — needs automation |

### 7.3 AI Cost Enforcement (P1)

```
Budget per feature per month:
  - account_brief: $10/month max
  - email_generation: $20/month max
  - conversation_plan: $5/month max
  - general_query: $50/month max

Enforcement:
  - Track cumulative cost in AIGenerationAudit
  - When budget reached: disable feature, alert admin
  - Monthly reset on billing cycle
```

---

## 8. Testing Requirements

### 8.1 Current Test State

| Category | Files | Coverage | CI Status |
|---|---|---|---|
| Unit | 20 | Good | ✅ Passing |
| Security | 12 | Good | ✅ Passing |
| API | 10 | Partial | ✅ Passing |
| Database | 9 | Good | ✅ Passing |
| AI | 37 | Good | ✅ Passing |
| Integration | 6 | Good | ✅ Passing |
| E2E | 4 | Good | ✅ Passing |
| Performance | 10 | Good | ✅ Passing |
| Smoke | 1 | Good | Pending (Vercel) |
| **Total** | **165** | | |

### 8.2 Test Gaps (M5 Must Address)

| Gap | Priority | Test Type | Estimated New Tests |
|---|---|---|---|
| Sequences API (6 routes, 0 tests) | P0 | Real-integration | 8 |
| Email send/track (0 tests) | P0 | Real-integration | 6 |
| Pipeline health/forecast (0 tests) | P0 | API + Database | 6 |
| Lead dedup/assign/lookalike (0 tests) | P0 | API + Database | 8 |
| AI prompt regression automation | P0 | AI-testing | 15 |
| Knowledge extraction pipeline | P0 | Integration | 5 |
| Rate limiting (new) | P0 | Unit + API | 6 |
| API contract validation (new) | P0 | Automated | 250 (generated) |
| **Total** | | | ~304 tests |

### 8.3 M5 Test Categories

For every M5 capability:

| Test Type | Purpose | Tool |
|---|---|---|
| **Unit tests** | Isolated function/module testing | Vitest (vitest.unit.config.ts) |
| **Business logic tests** | Scoring engine correctness, rule evaluation | Vitest (vitest.database.config.ts) |
| **API contract tests** | Request/response shape validation | Vitest (vitest.api.config.ts) |
| **Integration tests** | Full pipeline flows with real DB | Vitest (vitest.real-integration.config.ts) |
| **AI behavior tests** | Golden dataset comparison, prompt regression | Vitest (vitest.ai-testing.config.ts) |

---

## 9. Security Requirements

### 9.1 Current Security State

| Domain | Implementation | Status |
|---|---|---|
| **Authentication** | Session-based via `checkApiAuth()` | ✅ All routes covered |
| **Authorization** | RBAC with 4 roles (admin/operator/user/viewer), 50+ permissions | ✅ Implemented |
| **CSRF Protection** | Token-based via `csrf.ts` | ✅ Implemented |
| **Input Validation** | Zod schemas + `sanitizeFields()` | ✅ Comprehensive |
| **Rate Limiting** | In-memory with registry | ⚠️ Only email send |
| **Audit Logging** | `audit-logger.ts` + `AuditLog` model | ✅ Implemented |
| **Security Headers** | CSP, HSTS, no x-powered-by | ✅ Implemented |
| **Secret Management** | AES-256 encrypted AI keys, env vars | ✅ Implemented |

### 9.2 M5 Security Additions

| Requirement | Implementation | Priority |
|---|---|---|
| **Rate limiting on all business intelligence routes** | `withApiMiddleware` with per-route limits | P0 |
| **Prompt injection prevention** | Enhanced input sanitization on AI routes | P0 |
| **API abuse prevention** | Per-user rate limits, anomaly detection | P0 |
| **Data isolation** | Tenant-aware queries (multi-tenant prep) | P1 |
| **Knowledge access control** | Role-based knowledge visibility | P1 |
| **AI cost abuse prevention** | Per-feature budget enforcement | P1 |

### 9.3 Prompt Injection Risk Assessment

AI routes accepting user input must sanitize:

| Route | User Input | Risk Level | Mitigation |
|---|---|---|---|
| `/api/ai/chat` | Free-text query | High | Prompt boundary enforcement |
| `/api/ai/query` | Natural language → SQL | Critical | Safe query builder (existing) |
| `/api/ai/generate` | Email context | Medium | Template-based generation |
| `/api/ai/conversation-plan` | Meeting context | Medium | Structured prompt |
| `/api/contacts/[id]/generate-email` | Contact + instruction | Medium | Template fallback |

---

## 10. M5 Acceptance Criteria

M5 closes only when ALL of the following pass:

### 10.1 Implementation Gates

- [ ] **Test Coverage**: All P0 test gaps addressed; coverage thresholds >=50% statements, >=40% branches
- [ ] **AI Quality Gate**: Automated prompt regression blocking PRs with >5% regression
- [ ] **Knowledge Extraction**: Email/webhook → knowledge pipeline functional with >=80% classification accuracy
- [ ] **Semantic Chunking**: Enhanced ingestion with semantic mode; retrieval improvement >=15%
- [ ] **Rate Limiting**: All 56 core business intelligence routes rate-limited with 429 responses
- [ ] **API Documentation**: OpenAPI spec for 100% of routes; contract tests passing

### 10.2 Validation Gates

- [ ] **Database Migrations**: Single additive migration deployed successfully on staging
- [ ] **APIs Validated**: All new endpoints tested and documented
- [ ] **Tests Passing in CI**: Zero failures across all 20 Vitest configs
- [ ] **Security Review**: Prompt injection mitigations verified; rate limiting confirmed
- [ ] **Performance**: No regression in API response times (p95 <500ms for CRUD)
- [ ] **Documentation Updated**: ROADMAP.md reflects M5 completion; all new APIs documented

### 10.3 Quality Gates

- [ ] **No Scope Creep**: P2 items NOT included in M5 deliverables
- [ ] **No Architecture Regressions**: Existing intelligence pipeline unchanged
- [ ] **Backward Compatibility**: All existing API contracts unchanged
- [ ] **M4 Standards Maintained**: CI/CD pipeline intact; smoke tests applicable

---

## Appendix A: Implementation Sequence

### Phase 1: Foundation (Week 1-2)

1. P0-6: API Documentation and Contract Validation — establish baseline
2. P0-5: Rate Limiting for All Business Intelligence APIs — security foundation
3. P0-1: Test Coverage Completion (Part 1: sequences, email, pipeline)

### Phase 2: Intelligence (Week 3-4)

4. P0-4: Semantic Chunking Enhancement
5. P0-3: Knowledge Extraction from Conversations
6. P0-1: Test Coverage Completion (Part 2: lead sub-routes, contract tests)

### Phase 3: AI Quality (Week 5-6)

7. P0-2: AI Testing Automation
8. P0-1: Test Coverage Completion (Part 3: final gaps, threshold increase)
9. Integration testing across all P0 deliverables
10. Security review and performance validation

### Estimated Total Effort

| Phase | Duration | Focus |
|---|---|---|
| Phase 1 | 2 weeks | Foundation (docs, rate limiting, core tests) |
| Phase 2 | 2 weeks | Intelligence (knowledge, chunking, tests) |
| Phase 3 | 2 weeks | AI Quality (automation, final tests, validation) |
| **Total** | **6 weeks** | |

---

## Appendix B: File Reference

| Category | Path | Count |
|---|---|---|
| Business Logic | `src/lib/` | ~170 files |
| Entity & Relationship APIs | `src/app/api/companies|contacts|leads|opportunities|pipeline|sequences|emails/` | 56 routes |
| Intelligence API Routes | `src/app/api/ai|intelligence|engines|knowledge|signals|recommendations/` | 76 routes |
| Background Jobs | `src/app/api/cron/|webhooks/` | 5 routes |
| AI Extensions | `src/lib/ai-*.ts`, `src/lib/engines/` | 23 files |
| Test Files | `tests/`, `src/**/__tests__/` | 165 files |
| Prisma Schema | `prisma/schema.prisma` | 100 models, 417 indexes |
| Vitest Configs | `vitest.*.config.ts` | 20 configs |
