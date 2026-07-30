# DeepMindQ — System Architecture Document

**Version**: 2.0 (Approved, Locked)
**Date**: July 30, 2026
**Status**: SPEC — No code may be written until user says "PROCEED TO TICKET 1"
**Classification**: Internal Engineering Reference

---

> **North Star**: *The CRM stores information. DeepMindQ creates intelligence.*

---

## Table of Contents

1. [Product Vision & Positioning](#1-product-vision--positioning)
2. [10 Core Capabilities](#2-10-core-capabilities)
3. [System Architecture (6-Layer Stack)](#3-system-architecture-6-layer-stack)
4. [Data Architecture](#4-data-architecture)
5. [AI Engine Architecture](#5-ai-engine-architecture)
6. [API Architecture](#6-api-architecture)
7. [Backend Business Logic](#7-backend-business-logic)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Screen Map (76 Screens)](#10-screen-map-76-screens)
11. [20 Implementation Tickets](#11-20-implementation-tickets)
12. [Decisions Log](#12-decisions-log)

---

## 1. Product Vision & Positioning

### 1.1 What DeepMindQ Is

DeepMindQ is an **Enterprise Intelligence Operating System** for B2B revenue growth. It does not store contacts or send emails — it transforms raw data into actionable intelligence that tells a revenue team **what changed, why it matters, who to approach, what to say, and what to do next**.

DeepMindQ sits on top of existing data sources (CRMs, spreadsheets, news feeds, internal knowledge) and creates a living intelligence layer that continuously learns and improves.

### 1.2 What DeepMindQ Is NOT

| It is NOT this | It IS this |
|---|---|
| A CRM (stores contacts) | An intelligence layer ON TOP of a CRM |
| An email platform (sends messages) | An intelligence layer that INFORMS outreach |
| A dashboard (displays charts) | A decision system that DRIVES action |
| A reporting tool (summarizes past data) | A predictive system that ANTICIPATES opportunities |
| A copilot (answers questions) | An autonomous intelligence OS that PROACTIVELY alerts |

### 1.3 The 5-Question Framework

The entire product experience is built around five questions that map to the revenue workflow:

```
Q1: WHAT CHANGED?         → Signals, news, people movements, competitive shifts
Q2: WHY DOES IT MATTER?   → Enterprise reasoning, impact assessment, opportunity windows
Q3: WHO SHOULD WE ENGAGE? → Buying committee, decision makers, influencers
Q4: WHAT SHOULD WE SAY?   → Conversation prep, talking points, objection handling
Q5: WHAT SHOULD WE DO?    → Next best actions, outreach sequence, engagement plan
```

### 1.4 Target User

- **Primary**: B2B sales teams (SDRs, AEs, Sales Leaders) at mid-market and enterprise companies
- **Secondary**: RevOps, marketing intelligence, account managers
- **Deployment**: Single-tenant, single-org (no multi-tenancy)

### 1.5 Core Differentiators

1. **Intelligence-first architecture** — every screen, every API, every engine is designed to produce intelligence, not store data
2. **Evidence-grounded AI** — every AI output includes citations, confidence scores, and evidence chains
3. **Continuous learning** — the system improves based on user feedback loops (accept/reject/modify recommendations)
4. **Composable engine architecture** — 14 AI engines that compose together like LEGO bricks
5. **Dark-first, command-palette navigation** — Bloomberg Terminal meets Palantir meets Apple

---

## 2. 10 Core Capabilities

### Capability Map

| # | Capability | Description | Status | Engines Used |
|---|---|---|---|---|
| C1 | **Signal Detection & Monitoring** | Detect buying signals from news, hiring, funding, tech changes, people movements | Active | Grounding, Retrieval |
| C2 | **Enterprise Reasoning** | 30-step chain-of-thought analysis connecting signals to business impact | Active | Reasoning, ModelRouter |
| C3 | **Account Intelligence Scoring** | 3 independent scores: ICP Fit, Evidence Quality, Win Rate | Active | Scoring, Grounding |
| C4 | **Opportunity Discovery** | Auto-match signals to capabilities, generate opportunity recommendations | Active | Action, Scoring, Fusion |
| C5 | **Knowledge Fabric** | Unified knowledge graph across 14 categories (Strategy, Technology, Competitive, etc.) | Active | Retrieval, Synthesis |
| C6 | **Conversation Intelligence** | Meeting prep, talking points, objection handling, buyer profiling | Active | Conversation, Synthesis |
| C7 | **Intelligence Validation** | Human-in-the-loop rating of all AI outputs for continuous improvement | Active | Grounding, LearningLoop |
| C8 | **Competitive Intelligence** | Track competitor moves, market positioning, partnership changes | Active | Grounding, Scoring |
| C9 | **Data Intelligence Engine** | Automated import, column mapping, validation, normalization, quality scoring | Active | (Rule-based) |
| C10 | **Revenue Intelligence** | Pipeline forecasting, account prioritization, revenue scoring, deal coaching | Active | Scoring, Action, Fusion |

### Capability Flow

```
Signal Detection → Enterprise Reasoning → Opportunity Discovery
        ↓                  ↓                      ↓
  Knowledge Fabric    Account Scoring    Conversation Intelligence
        ↓                  ↓                      ↓
  Competitive Intel   Validation Loop     Revenue Intelligence
        ↓                  ↓                      ↓
  [Feedback Events → Learning Events → Confidence Calibration]
```

---

## 3. System Architecture (6-Layer Stack)

### 3.1 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND                                             │
│  Next.js 16 App Router + React 19 + Tailwind 4 + shadcn/ui     │
│  76 Screens | Zustand State | React Query | Command Palette     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: INTELLIGENCE API LAYER                               │
│  6 Product Endpoints — The ONLY frontend contract               │
│  /api/intelligence/{company,reasoning,opportunity,action,       │
│                     conversation,mindmap}/{id}                   │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: INTELLIGENCE ORCHESTRATION                           │
│  Reasoning Engine (30-step) | Multi-Agent Orchestrator (10)     │
│  Fusion Engine | Continuous Learning Loop | Knowledge Ingestion  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: GOVERNED AI ENGINES (7 Composable)                   │
│  ModelRouter | GroundingEngine | RetrievalEngine               │
│  SynthesisEngine | ScoringEngine | ActionEngine                 │
│  ConversationEngine                                            │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: AI FOUNDATION                                         │
│  Model Router (Deep/Smart/Fast tiers) | AI Governance           │
│  Evidence Framework | Hallucination Detection | Cost Tracking    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 6: DATA LAYER                                           │
│  PostgreSQL + pgvector | Prisma ORM (90 models)                  │
│  Embeddings (@xenova/transformers) | Cron Job Processor         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Strict Rules

1. **Frontend NEVER calls engines directly** — all intelligence flows through Layer 2
2. **All LLM calls go through AI Governance** (`governedAI()` wrapper) — ESLint rule blocks ungoverned calls
3. **Every intelligence output includes evidence citations** — no hallucinated claims without source
4. **Every generation is audited** — AIGenerationAudit record for every AI output
5. **Model Router handles all LLM routing** — tiered fallback (Deep → Smart → Fast)

### 3.3 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.x |
| UI | React + Tailwind CSS + shadcn/ui | 19 / 4 / latest |
| State | Zustand + React Query | latest / 5.x |
| ORM | Prisma | 6.19.x |
| Database | PostgreSQL + pgvector | 16+ |
| Language | TypeScript (strict mode target) | 5.x |
| Email | Resend | 6.x |
| Search | Tavily | latest |
| Embeddings | @xenova/transformers (local) | 2.17.x |
| Testing | Vitest | latest |
| Monitoring | Sentry | 10.x |

---

## 4. Data Architecture

### 4.1 Schema Overview

**90 Prisma models** organized into 10 domains:

| Domain | Models | Count |
|---|---|---|
| **Core Entity** | Company, Contact, ImportBatch | 3 |
| **Research & Intelligence** | CompanyResearchCard, CompanyNote, CompanySignal, Evidence, CompanyTimelineEvent, ContactNote | 6 |
| **Knowledge** | CapabilityAsset, KnowledgeDocument, KnowledgeChunk, KnowledgeEntry, KnowledgeVersion | 5 |
| **Email & Outreach** | EmailTemplate, EmailSequence, SequenceStep, SequenceEnrollment, Draft, SendQueue, EmailEvent, ABTest, Reply, Bounce, Suppression, ConversationPlan, Playbook, CustomEmailTemplate | 14 |
| **Scoring & Prioritization** | ScoringWeight, PriorityScoreHistory, AccountScore, SignalValidation, CompanyIntelligenceHealth, IntelligenceConflict | 6 |
| **Opportunity & Pursuit** | SignalCapabilityMatch, OpportunityRecommendation, Pursuit, OpportunitySignal, ActionArtifact, StrategicInsight | 6 |
| **Intelligence Acquisition** | IntelligenceObject, CompanyAlias, IntelligenceAssociation, IntelligenceTimeline, IntelligenceAlert, HumanIntelligenceInbox | 6 |
| **AI & Governance** | AIGenerationAudit, AICallLog, AIUsageLog, AIInsight, AIEngagementStrategy, AICache, EngineRun, ReasoningContext, ReasoningStep, AgentOrchestration, AgentRun, LearningEvent, IntelligenceActionHistory, IntelligenceValidation, RecommendationFeedback | 15 |
| **Data Pipeline** | DataUpload, UploadRow, ColumnMappingRule, FieldValidationRule, NormalizationMapping, NormalizationLog, DataQualityScore, EvidenceSourceReliability | 8 |
| **System** | User, OtpCode, Session, AuditLog, SystemSetting, Job, JobLog, Connector, ConnectorRun, SourceHealth, PipelineRun, FusionResult, Segment, SegmentContact, AccountStrategy | 15 |

### 4.2 Key Enums (18)

```
CompanyStatus: new, prospect, researching, active, engaged, paused, archived, closed_won, closed_lost
CompanyLifecycleStage: discovery, qualification, proposal, negotiation, closed
CompanyPriorityTier: HOT, ACTIVE, NURTURE, LOW
ContactStatus: active, engaged, imported, cleaned, duplicate, drafted, queued, sent, replied, bounced, suppressed, archived
SignalType: funding, hiring, leadership_change, leadership, tech_change, technology, news, mention, partnership, expansion, people_change, internal_memory
SignalSeverity: low, medium, high, critical
SignalStatus: detected, validated, active, aging, expired, archived
SignalTimingWindow: immediate, within_7_days, within_30_days, within_90_days, ongoing, expired
SignalMeaningCategory: budget_available, leadership_openness, tech_dissatisfaction, growth_pressure, compliance_requirement, vendor_evaluation, unknown
JobType: enrichment, research, scoring, signal_detection, email_generation
JobStatus: pending, queued, running, completed, failed, cancelled
DraftStatus: draft, pending_review, approved, rejected, sent
ImportBatchStatus: staged, processing, completed, archived, cancelled, failed
```

### 4.3 Vector Storage Strategy

- **Current**: pgvector extension on PostgreSQL with `Embedding` model
- **Embedding generation**: `@xenova/transformers` (Xenova/all-MiniLM-L6-v2) — runs locally, no external API
- **Abstraction layer**: `src/lib/vector-index.ts` provides `embed()`, `search()`, `index()` — can be swapped to Pinecone/Weaviate without engine changes
- **Indexed entities**: CapabilityAsset (knowledge search), Company (account matching), Evidence (source retrieval)

### 4.4 3-Score Architecture

Three independent scores, **never merged**:

| Score | What It Measures | Inputs | Output |
|---|---|---|---|
| **Account Priority Score** (ICP Fit) | How well company matches ideal customer profile | Industry, size, tech stack, signals, engagement | 0-100 + tier (HOT/ACTIVE/NURTURE/LOW) |
| **Intelligence Score** (Evidence Quality) | How strong is the evidence supporting our intelligence | Evidence count, confidence, freshness, source quality | 0-100 + health grade |
| **Opportunity Score** (Win Rate) | How likely we are to win business | Match score, confidence, freshness, pursuit stage | 0-100 + priority (high/medium/low) |

---

## 5. AI Engine Architecture

### 5.1 Engine Composition Model

```
                    ┌─────────────────┐
                    │  ModelRouter    │  (Foundation: LLM calls)
                    │  Deep/Smart/Fast│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────┴───┐  ┌──────┴────┐  ┌──────┴──────┐
     │ Grounding  │  │ Retrieval │  │  Learning   │
     │ Engine     │  │ Engine    │  │  Loop       │
     │ (Evidence) │  │ (Vectors) │  │  (Feedback) │
     └─────┬──────┘  └──────┬────┘  └─────────────┘
           │                │
     ┌─────┴────────────────┴──────┐
     │    COMPOSITION ENGINES       │
     ├─────────────────────────────┤
     │ Synthesis    → Briefs       │
     │ Scoring      → Scores       │
     │ Action       → NBA          │
     │ Conversation → Meeting Prep │
     └─────────────────────────────┘
```

### 5.2 Foundation Engines (3)

| Engine | File | Purpose | LLM Usage |
|---|---|---|---|
| **ModelRouter** | `src/lib/engines/model-router.ts` | Tiered LLM routing with fallback | Yes (routes TO LLMs) |
| **GroundingEngine** | `src/lib/engines/grounding-engine.ts` | Evidence chain builder with citations + confidence | Yes |
| **RetrievalEngine** | `src/lib/engines/retrieval-engine.ts` | Local semantic search via embeddings | No (local vectors) |

### 5.3 Composition Engines (4)

| Engine | File | Purpose | Foundation Used |
|---|---|---|---|
| **SynthesisEngine** | `src/lib/engines/synthesis-engine.ts` | Long-form evidence-grounded briefs | ModelRouter + Grounding |
| **ScoringEngine** | `src/lib/engines/scoring-engine.ts` | Explainable, decomposed revenue scores | ModelRouter + Grounding |
| **ActionEngine** | `src/lib/engines/action-engine.ts` | Next-best-action + sales motion recommendations | ModelRouter + Grounding + Retrieval |
| **ConversationEngine** | `src/lib/engines/conversation-engine.ts` | Meeting prep, talking points, objection handling | ModelRouter + Grounding + Synthesis |

### 5.4 Orchestration Engines (4)

| Engine | File | Purpose |
|---|---|---|
| **Enterprise Reasoning** | `src/lib/enterprise-reasoning-engine.ts` | 30-step chain-of-thought analysis connecting signals → impact → actions |
| **Multi-Agent Orchestrator** | `src/lib/multi-agent-orchestrator.ts` | 10 specialist agents for complex analysis tasks |
| **Fusion Engine** | `src/lib/fusion-engine.ts` | Merges external intelligence + internal memory for unified view |
| **Continuous Learning Loop** | `src/lib/continuous-learning-loop.ts` | Feedback → recommendation → execution → learning → calibration |

### 5.5 Intelligence Source Connectors (5)

| Connector | File | Source Type |
|---|---|---|
| **CSV Connector** | `src/lib/intelligence-sources/connectors/csv-connector.ts` | CSV upload |
| **Excel Connector** | `src/lib/intelligence-sources/connectors/excel-connector.ts` | Excel upload |
| **Website Connector** | `src/lib/intelligence-sources/connectors/website-connector.ts` | Web scraping |
| **RSS Connector** | `src/lib/intelligence-sources/connectors/rss-connector.ts` | RSS feeds |
| **Internal Memory** | `src/lib/intelligence-sources/internal-memory-connector.ts` | User-submitted intel |

### 5.6 Model Router — Tier Configuration

```
TIER: DEEP   (Complex reasoning, long-form generation)
  Primary:   Z.ai GLM-4.6
  Fallback:  Gemini 1.5 Pro
  Fallback:  Gemini 2.0 Flash
  MaxTokens: 8192

TIER: SMART (Standard intelligence tasks)
  Primary:   Gemini 2.0 Flash
  Fallback:  Groq Llama 3.3 70B
  Fallback:  Z.ai GLM-4.6
  MaxTokens: 4096

TIER: FAST  (Classification, summarization, short responses)
  Primary:   Groq Llama 3.1 8B
  Fallback:  Gemini 2.0 Flash
  MaxTokens: 1500
```

All default providers have free tiers. Paid providers (NVIDIA, Fireworks, OpenAI) are disabled by default.

### 5.7 AI Governance Layer

Every LLM call passes through `governedAI()` (`src/lib/ai-governance.ts`):

```
Input Validation → Confidence Gates → LLM Call → Hallucination Check → Evidence Audit
```

**Governance checks per generation type:**

| Generation Type | Min Confidence | Min Freshness | Require Capability Match |
|---|---|---|---|
| email_draft | 0.6 | 25 | Yes |
| conversation_plan | 0.6 | 25 | No |
| account_brief | 0.5 | 20 | No |
| signal_analysis | 0.4 | 15 | No |
| enrichment | 0.3 | 0 | No |
| insights | 0.5 | 20 | No |
| opportunities | 0.5 | 20 | Yes |
| recommendations | 0.5 | 20 | Yes |

**ESLint enforcement**: `eslint-rules/no-ungoverned-llm.js` blocks any direct LLM call that bypasses governance. CI fails if ungoverned calls are detected.

---

## 6. API Architecture

### 6.1 Intelligence API Layer (6 Product Endpoints)

These are the **ONLY** endpoints the frontend should call for intelligence:

| Endpoint | Method | Purpose | Key Response Data |
|---|---|---|---|
| `/api/intelligence/company/{id}` | GET | Company 360 intelligence view | signals, scores, contacts, timeline, actions, brief, knowledge |
| `/api/intelligence/reasoning/{id}` | GET | Enterprise reasoning analysis | 30-step chain, impact analysis, recommendations |
| `/api/intelligence/opportunity/{id}` | GET | Opportunity intelligence | scores, fusion data, win probability, capabilities |
| `/api/intelligence/action/{id}` | GET | Next best actions | recommendations, sequences, learning insights |
| `/api/intelligence/conversation/{id}` | GET | Conversation preparation | talking points, objections, buyer profiles, strategy |
| `/api/intelligence/mindmap/{id}` | GET | Knowledge graph | org chart, knowledge connections, signal relationships |

All endpoints support **`?include=`** query parameter for selective data loading:
```
GET /api/intelligence/company/abc?include=signals,scores,contacts
```

### 6.2 Internal API Routes (208 total)

Internal routes used for direct entity CRUD, testing, and engine access:

| Route Group | Count | Purpose |
|---|---|---|
| `/api/companies/*` | 18 | Company CRUD, intelligence, signals, timeline |
| `/api/contacts/*` | 8 | Contact CRUD, engagement, relationship mapping |
| `/api/intelligence/*` | 25 | Internal intelligence endpoints (sprint3, full-pipeline, etc.) |
| `/api/leads/*` | 10 | Lead management, scoring, dedup |
| `/api/ai/*` | 22 | AI features (insights, scoring, enrichment, health) |
| `/api/engines/*` | 6 | Direct engine access (testing/research) |
| `/api/emails/*` | 4 | Email tracking, sending |
| `/api/drafts/*` | 2 | Draft CRUD |
| `/api/sequences/*` | 5 | Sequence management, enrollment, execution |
| `/api/knowledge/*` | 4 | Knowledge CRUD, graph, ingestion |
| `/api/capabilities/*` | 5 | Capability library, import, export, enrich |
| `/api/auth/*` | 10 | Authentication (OTP, session, profile) |
| `/api/signals/*` | 1 | Signal detection |
| `/api/reports/*` | 4 | Pipeline, revenue, team, data quality reports |
| `/api/system-health/*` | 1 | System health check |
| Other | 83 | Settings, segments, import, analytics, audit, etc. |

### 6.3 API Middleware Stack

```
Request → Auth Check → Rate Limit → CSRF Protection → Zod Validation → Business Logic → Response
                                  → Audit Log (write)
                                  → AI Governance (if LLM call)
```

### 6.4 Real-time Layer

- **WebSocket**: `src/app/api/realtime/route.ts` — for live intelligence updates
- **Polling fallback**: React Query refetch intervals for screens without WebSocket
- **SSE alternative**: Available via `/api/intelligence/monitor` for event streams

---

## 7. Backend Business Logic

### 7.1 Intelligence Pipeline

The core intelligence processing pipeline that transforms raw data into actionable intelligence:

```
Stage 1: ACQUIRE
  └── Connectors (CSV, Excel, Website, RSS, Human) → IntelligenceObject

Stage 2: ENRICH
  └── Research Engine → Evidence, CompanyResearchCard, CompanySignal

Stage 3: VALIDATE
  └── SignalValidation, IntelligenceValidation, CompanyIntelligenceHealth

Stage 4: REASON
  └── Enterprise Reasoning (30-step), Multi-Agent Orchestrator

Stage 5: SCORE
  └── ScoringEngine → 3-Score Architecture (ICP, Evidence, Win Rate)

Stage 6: RECOMMEND
  └── ActionEngine → OpportunityRecommendation, StrategicInsights

Stage 7: LEARN
  └── Feedback Intelligence Layer → LearningEvent → Confidence Calibration
```

### 7.2 Feedback Intelligence Layer

This is the **self-improvement loop** that makes DeepMindQ smarter over time:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ RECOMMEND    │────→│ USER DECIDES │────→│ EXECUTE      │
│ (AI Output)  │     │ (Accept/     │     │ (Send email, │
│              │     │  Reject/     │     │  Have call,  │
│              │     │  Modify)     │     │  Schedule)   │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
                     ┌──────▼───────┐     ┌──────▼───────┐
                     │ FEEDBACK     │────→│ RESULT       │
                     │ EVENT        │     │ (Reply? Open?│
                     │ (Why reject? │     │  Bounce? Win?│
                     │  What wrong? │     │  Lose?)      │
                     └──────┬───────┘     └──────┬───────┘
                            │                     │
                     ┌──────▼─────────────────────▼───────┐
                     │ LEARNING EVENT                        │
                     │ (Store pattern, adjust weights,      │
                     │  calibrate confidence)                │
                     └──────────────┬───────────────────────┘
                                    │
                     ┌──────────────▼───────────────────────┐
                     │ CONFIDENCE CALIBRATION                │
                     │ (Update scoring weights, adjust       │
                     │  governance thresholds, improve       │
                     │  signal-to-capability matching)       │
                     └──────────────────────────────────────┘
```

**Key files**:
- `src/lib/continuous-learning-loop.ts` — Learning event processor
- `src/lib/recommendation-feedback.ts` — Feedback collection
- `src/lib/ai-governance.ts` — Confidence gate adjustment
- `src/lib/intelligence-contract.ts` — Freshness scoring

### 7.3 Job Processing System

Async task processing via Prisma `Job` model:

```
Job Creation → db.job.create({ type, priority, payload })
     ↓
Cron Processor (src/app/api/cron/job-processor/route.ts)
     ↓
Worker picks next job by priority + nextRetryAt
     ↓
Execute → progress updates via db.job.update({ currentStep, stepDetail })
     ↓
Complete / Fail → retry logic (max 3 attempts, exponential backoff)
     ↓
AIGenerationAudit record (if AI was used)
```

**Job types**: enrichment, research, scoring, signal_detection, email_generation

### 7.4 Data Intelligence Engine (Config-Driven Rules)

All import/business rules stored in database, NOT code:

| Config Model | Purpose | Admin Editable |
|---|---|---|
| `ColumnMappingRule` | Maps source headers → internal fields (regex-based) | Yes |
| `FieldValidationRule` | Per-field validation (required, format, range) | Yes |
| `NormalizationMapping` | Source value → clean value (industry, country, title) | Yes |
| `ScoringWeight` | Lead scoring dimension weights | Yes |
| `SystemSetting` | AI provider configs, feature flags, app settings | Yes |

Admin can modify rules from **Settings > Data Rules** without any developer intervention.

---

## 8. Frontend Architecture

### 8.1 Navigation Architecture (3 Sections)

```
┌── INTELLIGENCE ──────────────────────────┐
│  Command Center | Accounts | Intelligence │
│  Search                                  │
├── WORKSPACES ────────────────────────────┤
│  Company Workspace | Knowledge &         │
│  Capabilities | Capability Workspace    │
├── ADMINISTRATION ───────────────────────┤
│  Data Management | Analytics | Settings │
│  Integrations | System Health | Audit    │
└─────────────────────────────────────────┘
```

**Navigation**: Command palette (`Cmd+K`) primary, sidebar secondary. Flat structure — no nested sub-menus.

### 8.2 Screen Architecture

- **Layout**: `src/components/app-shell.tsx` — persistent sidebar + command palette + main content area
- **Screen components**: `src/components/screens/*-screen.tsx` — 76 screen files
- **Enterprise components**: `src/components/enterprise/` — shared intelligence display components
- **Design system**: `src/components/shared/design-system.tsx` — token-driven dark-first theme

### 8.3 State Management

```
Zustand Store (src/lib/store.ts)
  └── Global UI state (active screen, sidebar, theme)
  └── User session state (auth, preferences)

React Query (@tanstack/react-query)
  └── Server state (companies, contacts, intelligence data)
  └── Cache invalidation on mutations
  └── Optimistic updates for draft actions
```

### 8.4 Design System

- **Theme**: Dark-first (`#0a0c10` base), light mode available
- **Surface tokens**: Sunken `#06080c`, Base `#0f1219`, Float `#2a3650`, Raised `#1e293b`
- **Intelligence tokens**: Positive `#22c55e`, Negative `#ef4444`, Warning `#f59e0b`, Critical `#dc2626`
- **Density**: Desktop-first, information-dense, minimal chrome
- **Components**: shadcn/ui + custom enterprise components (AIInsightCard, ConfidenceBar, EvidenceBadge, IntelligenceFeed)

---

## 9. Security Architecture

### 9.1 Authentication

- **Method**: OTP-based email authentication (no passwords for initial login)
- **Flow**: Request OTP → Verify OTP → Create session token
- **Session**: Opaque token stored in database (`Session` model), HTTP-only cookie
- **No OAuth, no multi-tenancy, no social login**

### 9.2 CSRF Protection

- `src/lib/csrf.ts` — Double-submit cookie pattern for state-changing requests
- Applied to all POST/PUT/DELETE routes via API middleware

### 9.3 Rate Limiting

- `src/lib/rate-limit.ts` — Per-route rate limiting
- Stricter limits on auth endpoints (OTP request: 5/min)
- AI endpoints have cost-aware rate limiting

### 9.4 Data Protection

- **Consent tracking**: `ContactConsentStatus` enum, `consentSource`, `consentDate`, `consentIp`
- **Suppression list**: `Suppression` model with manual/auto-bounce/auto-webhook methods
- **Email health**: Per-contact email validation status and scoring
- **PII handling**: `inputParams` in AIGenerationAudit are sanitized — no raw PII stored

### 9.5 Audit Trail

- `AuditLog` model — records all significant actions
- `AIGenerationAudit` — records every AI generation with full context
- `NormalizationLog` — records every data transformation during import
- `LearningEvent` — records every feedback learning event

---

## 10. Screen Map (76 Screens)

### 10.1 Priority Classification

| Priority | Count | Description | These screens FIRST |
|---|---|---|---|
| **P0: Core Intelligence** | 25 | Intelligence operations that define the product | Yes |
| **P1: Operations** | 15 | Day-to-day operations (import, data management) | Second |
| **P2: Communication** | 10 | Email, drafts, sequences, replies | Third |
| **P3: Management** | 26 | Settings, analytics, admin, audit | Last |

### 10.2 P0 Screens — Core Intelligence (25)

| # | Screen | File | Purpose | Primary API | Engines | Key Data |
|---|---|---|---|---|---|---|
| 1 | **Dashboard** | `dashboard-screen.tsx` | Command center overview | `/api/dashboard/stats` | Multiple | KPIs, alerts, scores |
| 2 | **Command Center** | `command-center-screen.tsx` | Unified intelligence hub | `/api/command-center/insights` | All | Insights, actions, health |
| 3 | **Company List** | `companies-screen.tsx` | Account prioritization view | `/api/companies` | Scoring | Companies, tiers, scores |
| 4 | **Company Profile** | `company-profile-screen.tsx` | 5Q workspace container | `/api/intelligence/company/{id}` | All | Full 360 view |
| 5 | **Company Intelligence** | `account-intelligence-screen.tsx` | Deep intelligence view | `/api/companies/{id}/intelligence` | Grounding, Scoring | Signals, evidence |
| 6 | **Company Timeline** | `intelligence-timeline-screen.tsx` | Event chronology | `/api/companies/{id}/timeline` | — | Timeline events |
| 7 | **Intelligence Inbox** | `intelligence-inbox-screen.tsx` | New intelligence queue | `/api/intelligence/sprint3` | Grounding | Unreviewed signals |
| 8 | **Signal Intelligence** | `signal-intelligence-screen.tsx` | Signal detection view | `/api/signals` | Grounding | All signals |
| 9 | **Intelligence Health** | `intelligence-health-screen.tsx` | Per-company intelligence quality | `/api/companies/{id}/actions` | Grounding | Health scores |
| 10 | **Intelligence Analytics** | `intelligence-analytics-screen.tsx` | System-wide intelligence metrics | `/api/intelligence/stats` | — | Aggregate stats |
| 11 | **Intelligence Sources** | `intelligence-sources-screen.tsx` | Source management | `/api/intelligence/collect-external` | — | Source health |
| 12 | **Opportunity Radar** | `opportunity-radar-screen.tsx` | Active opportunity overview | `/api/ai/opportunities` | Action, Scoring | Opportunities |
| 13 | **Revenue Intelligence Brief** | `revenue-intelligence-brief-screen.tsx` | Strategic brief view | `/api/intelligence/brief/{id}` | Synthesis | Briefs |
| 14 | **Revenue Intelligence Opps** | `revenue-intelligence-opportunities-screen.tsx` | Revenue opp details | `/api/intelligence/opportunity/{id}` | Fusion | Fusion data |
| 15 | **Revenue Intelligence Recs** | `revenue-intelligence-recommendations-screen.tsx` | AI recommendations | `/api/ai/recommendations` | Action | Recommendations |
| 16 | **Pipeline Health** | `pipeline-health-screen.tsx` | Pipeline quality metrics | `/api/pipeline/health` | Scoring | Pipeline data |
| 17 | **Pipeline Forecast** | `pipeline-forecast-screen.tsx` | Revenue forecasting | `/api/pipeline/forecast` | Scoring, Fusion | Forecast |
| 18 | **Account Ranking** | `account-ranking-screen.tsx` | Priority-ranked accounts | `/api/companies?sortBy=accountPriorityScore` | Scoring | Ranked list |
| 19 | **Account Brief** | `company-workspace` (workspace) | Account briefing | `/api/intelligence/company/{id}?include=brief` | Synthesis | Brief + signals |
| 20 | **Intelligence Reasoning** | `intelligence-reasoning-screen.tsx` | 30-step reasoning view | `/api/intelligence/reasoning/{id}` | Reasoning | Reasoning chain |
| 21 | **AI Reasoning** | `ai-reasoning-screen.tsx` | AI reasoning interface | `/api/reasoning` | Reasoning | Reasoning output |
| 22 | **Deal Coaching** | `deal-coaching-screen.tsx` | Deal strategy guidance | `/api/ai/deal-coaching` | Conversation | Coaching data |
| 23 | **Contact Intelligence** | `contact-intelligence-screen.tsx` | Contact analysis | `/api/ai/contact-intelligence` | Scoring, Action | Contact intel |
| 24 | **Intelligence Knowledge** | `intelligence-knowledge-screen.tsx` | Knowledge base view | `/api/knowledge` | Retrieval | Knowledge entries |
| 25 | **Knowledge Library** | `knowledge-library-screen.tsx` | Asset library | `/api/capabilities` | Retrieval | Capabilities |

### 10.3 P1 Screens — Operations (15)

| # | Screen | File | Purpose | Primary API |
|---|---|---|---|---|
| 26 | **Import** | `import-screen.tsx` | Data import wizard | `/api/imports` |
| 27 | **Data Health** | `data-health-screen.tsx` | Data quality overview | `/api/data-health` |
| 28 | **Duplicates** | `duplicates-screen.tsx` | Duplicate detection | `/api/duplicates` |
| 29 | **Segments** | `segments-screen.tsx` | Lead segmentation | `/api/segments` |
| 30 | **Contacts** | `contacts-screen.tsx` | Contact management | `/api/contacts` |
| 31 | **Contact Detail** | `contact-detail-screen.tsx` | Contact 360 view | `/api/contacts/{id}` |
| 32 | **Leads** | `leads-screen.tsx` | Lead management | `/api/leads` |
| 33 | **Companies (basic)** | `companies-screen.tsx` | Company list (operational) | `/api/companies` |
| 34 | **Analytics** | `analytics-screen.tsx` | General analytics | `/api/analytics` |
| 35 | **Reports** | `reports-screen.tsx` | Report generation | `/api/reports/*` |
| 36 | **Mind Map** | `mind-map-screen.tsx` | Visual knowledge map | `/api/intelligence/mindmap/{id}` |
| 37 | **Intelligence Associations** | `intelligence-associations-screen.tsx` | Entity relationships | `/api/intelligence/cross-account` |
| 38 | **Internal Intelligence** | `internal-intelligence-screen.tsx` | Internal intel tracking | `/api/intelligence/internal-memory` |
| 39 | **Research Agent** | `research-agent-screen.tsx` | Research automation | `/api/research-agent` |
| 40 | **Company Resolution** | `company-resolution-modal.tsx` | Entity resolution | `/api/companies/bulk` |

### 10.4 P2 Screens — Communication (10)

| # | Screen | File | Purpose | Primary API |
|---|---|---|---|---|
| 41 | **Drafts** | `drafts-screen.tsx` | Email draft management | `/api/drafts` |
| 42 | **Queue** | `queue-screen.tsx` | Send queue | `/api/queue` |
| 43 | **Email Generation** | `email-generation-screen.tsx` | AI email creation | `/api/ai/generate` |
| 44 | **Templates** | `templates-screen.tsx` | Email templates | `/api/email-templates` |
| 45 | **Sequences** | `sequences-screen.tsx` | Sequence management | `/api/sequences` |
| 46 | **Replies** | `replies-screen.tsx` | Reply management | `/api/replies` |
| 47 | **Bounces** | `bounces-screen.tsx` | Bounce tracking | `/api/bounces` |
| 48 | **Conversation Planner** | `conversation-planner-screen.tsx` | Conversation planning | `/api/conversation-plans` |
| 49 | **Conversation Studio** | `conversation-studio-screen.tsx` | AI conversation tool | `/api/ai/conversation-studio` |
| 50 | **Playbooks** | `playbooks-screen.tsx` | Sales playbook library | `/api/playbooks` |

### 10.5 P3 Screens — Management (26)

| # | Screen | File | Purpose | Primary API |
|---|---|---|---|---|
| 51 | **Settings** | `settings-screen.tsx` | App settings | `/api/settings` |
| 52 | **Data Rules** | `settings-data-rules.tsx` | Data rule config | `/api/settings` |
| 53 | **ICP Settings** | `icp-settings-screen.tsx` | Ideal customer profile | `/api/settings` |
| 54 | **Prompt Templates** | `prompt-templates-screen.tsx` | AI prompt config | `/api/prompt-templates` |
| 55 | **AI Usage Dashboard** | `ai-usage-dashboard-screen.tsx` | AI cost tracking | `/api/admin/ai-usage` |
| 56 | **AI Health** | `ai-health-screen.tsx` | AI system health | `/api/ai/health` |
| 57 | **AI Strategy** | `ai-strategy-screen.tsx` | AI strategy config | `/api/ai` |
| 58 | **AI Command Center** | `ai-command-center-screen.tsx` | AI operations | `/api/command-center/query` |
| 59 | **Audit** | `audit-screen.tsx` | Audit log viewer | `/api/audit-logs` |
| 60 | **Audit Logs** | `audit-logs-screen.tsx` | Detailed audit | `/api/audit-logs` |
| 61 | **Enterprise** | `enterprise-screen.tsx` | Enterprise settings | `/api/enterprise` |
| 62 | **RevOps** | `revops-screen.tsx` | Revenue operations | `/api/revops` |
| 63 | **Sales Execution** | `sales-execution-screen.tsx` | Sales execution metrics | `/api/sales-execution` |
| 64 | **Strategy Room** | `strategy-room-screen.tsx` | Account strategy | `/api/strategy` |
| 65 | **Opportunity Workspace** | `opportunity-workspace-screen.tsx` | Opp deep-dive | `/api/opportunities/{id}` |
| 66 | **Pursuit Workspace** | `pursuit-workspace-screen.tsx` | Pursuit tracking | `/api/pipelines` |
| 67 | **Pipeline** | `pipeline-screen.tsx` | Pipeline view | `/api/pipeline` |
| 68 | **Opportunities** | `opportunities-screen.tsx` | Opportunity list | `/api/opportunities` |
| 69 | **Capability Library** | `capability-library-screen.tsx` | Capability management | `/api/capabilities` |
| 70 | **Capability** | `capability-screen.tsx` | Capability detail | `/api/capabilities/{id}` |
| 71 | **Relationship Memory** | `relationship-memory-screen.tsx` | Relationship tracking | `/api/ai/relationship-memory` |
| 72 | **Demo Experience** | `demo-experience-screen.tsx` | Demo data management | `/api/demo/prepare` |
| 73 | **Intelligence Scheduler** | `intelligence-scheduler-screen.tsx` | Scheduled tasks | `/api/cron` |
| 74 | **Intelligence Report** | `intelligence-report-screen.tsx` | Report generation | `/api/reports/*` |
| 75 | **CRO Dashboard** | `cro-dashboard` (in app) | Executive dashboard | `/api/cro-dashboard` |
| 76 | **Company Detail (basic)** | `company-detail-screen.tsx` | Basic company view | `/api/companies/{id}` |

---

## 11. 20 Implementation Tickets

### Ticket Execution Rules

1. **Spec-First**: ARCHITECTURE.md is written. User says "PROCEED TO TICKET 1" before any code.
2. **Vertical Slicing**: Each ticket is end-to-end: DB → API → UI → Tests
3. **Backend First**: Every ticket must define the API contract before UI work
4. **Memory File**: Update `PROJECT_STATUS.md` after every ticket
5. **"Unsexy 90%"**: try/catch, logging, Zod validation, 2+ unit tests per ticket
6. **Terminal Feedback Loop**: Fix errors precisely, don't refactor unrelated code

---

### Ticket 1: Foundation Hardening
**Priority**: P0 | **Estimate**: 3 days | **Dependencies**: None

**Backend**:
- Fix `tsconfig.json`: enable `noImplicitAny: true`; enable `reactStrictMode: true` in `next.config.ts`
- Fix resulting TypeScript errors (estimated 50-80 errors across codebase)
- Update `src/lib/db.ts` — ensure all Prisma queries use typed selects
- Add Zod validation schemas for all 6 Intelligence API endpoints

**API**:
- Add request validation middleware to `/api/intelligence/*` routes
- Add error handling wrapper (try/catch + structured error responses)
- Add `correlation-id` header propagation

**Frontend**:
- Fix type errors in screen components that call Intelligence API
- Add error boundaries to all 76 screens

**Tests**:
- Unit test: Zod validation schemas (2+ per endpoint)
- Integration test: Intelligence API returns structured errors

**Security**:
- Verify no sensitive data in error responses
- Rate limiting on Intelligence API endpoints

**Exit Criteria**:
- [ ] `tsc --noEmit` passes with zero errors
- [ ] All 6 Intelligence API endpoints have Zod validation
- [ ] Error responses follow `{ error: string, code: string, details?: object }` format
- [ ] 2+ unit tests pass per endpoint

---

### Ticket 2: Intelligence API Layer Refactor
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 1

**Backend**:
- Refactor 6 Intelligence API routes to use shared middleware (`src/lib/intelligence-api/middleware.ts`)
- Implement `?include=` selective loading for all 6 endpoints
- Add freshness computation (`computeFreshness()`) to company endpoint
- Add response caching (React Query compatible — Cache-Control headers)

**API**:
- `GET /api/intelligence/company/{id}?include=signals,scores,contacts,brief,timeline,actions,knowledge`
- `GET /api/intelligence/reasoning/{id}?include=steps,impact,recommendations`
- `GET /api/intelligence/opportunity/{id}?include=scores,fusion,capabilities`
- `GET /api/intelligence/action/{id}?include=recommendations,sequences,learning`
- `GET /api/intelligence/conversation/{id}?include=talkingPoints,objections,buyerProfiles`
- `GET /api/intelligence/mindmap/{id}?include=nodes,edges,knowledgeConnections`

**Tests**:
- Unit test: `parseIncludeParams()` — valid includes, invalid includes, SQL injection prevention
- Integration test: Each endpoint returns correct data shape with selective includes

**Exit Criteria**:
- [ ] All 6 endpoints support `?include=` with selective loading
- [ ] Response types match `IntelligenceResponse` from `src/lib/intelligence-api/types.ts`
- [ ] No N+1 queries (verify with Prisma query log)

---

### Ticket 3: AI Governance Hardening
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 1

**Backend**:
- Audit all LLM call sites — ensure 100% go through `governedAI()` wrapper
- Add governance checks to: SynthesisEngine, ScoringEngine, ActionEngine (currently 3/10 governed)
- Update `eslint-rules/no-ungoverned-llm.js` — add patterns for any ungoverned call patterns
- Add governance result logging to AIGenerationAudit

**API**:
- Add `/api/ai/governance/check` — manual governance check endpoint
- Add governance score to all Intelligence API responses (meta.governance)

**Tests**:
- Unit test: Each governance config has correct thresholds
- Integration test: Email draft rejected below confidence threshold
- Lint test: `npm run check:governance` passes with zero violations

**Exit Criteria**:
- [ ] 10/10 generation types have governance configs
- [ ] 7/7 engines route through governance
- [ ] ESLint rule catches all ungoverned patterns
- [ ] AIGenerationAudit records governance_passed + governance_checks for every generation

---

### Ticket 4: 3-Score Architecture Unification
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 2

**Backend**:
- Unify Account Priority Score computation in `src/lib/account-prioritization/engine.ts`
- Unify Intelligence Score in `src/lib/intelligence-contract.ts`
- Unify Opportunity Score in `src/lib/revenue-intelligence/account-scorer.ts`
- Ensure all 3 scores stored in Company model with proper indexing
- Add PriorityScoreHistory tracking for score changes over time

**API**:
- Add `GET /api/companies/{id}/scores` — returns all 3 scores with breakdown
- Add scores to `GET /api/intelligence/company/{id}?include=scores`

**Frontend**:
- Build `ScoreTriple` component (3 scores side-by-side)
- Wire to Company Profile screen

**Tests**:
- Unit test: Each score function returns 0-100 range
- Integration test: Score endpoint returns correct shape
- Unit test: PriorityScoreHistory creates record on score change

**Exit Criteria**:
- [ ] All 3 scores computed consistently across the system
- [ ] ScoreTriple displays on Company Profile
- [ ] PriorityScoreHistory tracks changes

---

### Ticket 5: Command Center Screen (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Tickets 2, 4

**API Contract**:
```
GET /api/command-center/insights
Response: {
  kpis: { totalAccounts, activeSignals, avgIntelligenceScore, pendingActions },
  recentSignals: CompanySignal[],
  topOpportunities: OpportunityRecommendation[],
  systemHealth: { engines: EngineHealth[], aiStatus: string },
  intelligenceFeed: IntelligenceFeedItem[]
}
```

**Backend**:
- Aggregate KPIs from Company, CompanySignal, OpportunityRecommendation tables
- Merge engine health from `/api/ai/health`
- Compile intelligence feed from recent events

**Frontend**:
- 4 KPI cards (total accounts, active signals, avg score, pending actions)
- Recent signals feed (scrollable, newest first)
- Top opportunities table (score, priority, company)
- System health indicator (engines online, AI status)
- Intelligence feed (real-time updates)

**Tests**:
- Unit test: KPI aggregation math correct
- Integration test: Endpoint returns within 500ms for 1000 companies

**Exit Criteria**:
- [ ] Command Center loads within 2 seconds
- [ ] All KPIs display with live data
- [ ] Intelligence feed updates on new signal detection

---

### Ticket 6: Company List with Priority Ranking (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 4

**API Contract**:
```
GET /api/companies?sortBy=accountPriorityScore&sortOrder=desc&page=1&limit=50&tier=HOT
Response: {
  companies: Company[], pagination: { page, limit, total, totalPages },
  filters: { tiers: CompanyPriorityTier[], statuses: CompanyStatus[] }
}
```

**Backend**:
- Add sorting by accountPriorityScore, intelligenceScore, opportunityScore
- Add tier filtering (HOT, ACTIVE, NURTURE, LOW)
- Add pagination (cursor-based)
- Add batch intelligence score refresh

**Frontend**:
- Company table with columns: Name, Tier, ICP Score, Intel Score, Opp Score, Signals Count, Last Activity
- Tier badge (color-coded: HOT=red, ACTIVE=green, NURTURE=yellow, LOW=gray)
- Sort by any score column
- Filter by tier, status, industry
- Click to navigate to Company Profile (5Q workspace)

**Tests**:
- Unit test: Pagination cursor logic
- Integration test: Sorting returns correct order
- Unit test: Tier badge colors

**Exit Criteria**:
- [ ] Companies load sorted by priority within 1 second
- [ ] Tier filtering works
- [ ] Click navigates to Company Profile

---

### Ticket 7: Company Profile — 5Q Workspace (P0)
**Priority**: P0 | **Estimate**: 3 days | **Dependencies**: Tickets 2, 3, 4, 5

**API Contract**: `GET /api/intelligence/company/{id}?include=all`

**Frontend**:
- Progressive disclosure layout (NOT wizard — narrative scroll)
- **Q1: What Changed?** — Signal timeline, news cards, people changes
- **Q2: Why Does It Matter?** — Enterprise reasoning summary, impact assessment
- **Q3: Who Should We Engage?** — Contact list, buying committee map, influence scores
- **Q4: What Should We Say?** — Conversation prep, talking points, capability matches
- **Q5: What Should We Do?** — Next best actions, opportunity recommendations, sequences

Each section lazy-loads from Intelligence API on scroll.

**Components**:
- `SignalTimeline` — chronological signal display
- `ReasoningSummary` — condensed 30-step reasoning
- `BuyingCommittee` — contact role + influence visualization
- `ConversationPrep` — talking points + objection cards
- `ActionList` — prioritized next actions

**Tests**:
- Component test: Each Q section renders with mock data
- Integration test: Lazy loading triggers on scroll
- E2E test: Full 5Q navigation flow

**Exit Criteria**:
- [ ] 5Q workspace loads and displays all sections
- [ ] Each section lazy-loads independently
- [ ] ScoreTriple visible at top of workspace

---

### Ticket 8: Signal Intelligence Screen (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 2

**API Contract**:
```
GET /api/signals?companyId={id}&type=funding&severity=high&status=active&page=1
Response: {
  signals: CompanySignal[], evidenceCounts: Record<stringId, number>,
  categories: SignalMeaningCategory[]
}
```

**Frontend**:
- Signal table: Title, Type, Severity, Impact, Confidence, Meaning, Date
- Severity badge (color-coded)
- Meaning category filter (budget_available, leadership_openness, etc.)
- Click signal → evidence detail panel
- Signal-to-capability match display

**Tests**:
- Unit test: Signal filtering logic
- Integration test: Evidence count accuracy

**Exit Criteria**:
- [ ] Signal list loads with filters
- [ ] Evidence detail panel shows supporting evidence
- [ ] Capability match displayed per signal

---

### Ticket 9: Opportunity Radar Screen (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Tickets 2, 4

**API Contract**:
```
GET /api/ai/opportunities?status=pending_review&priority=high&page=1
Response: {
  opportunities: OpportunityRecommendation[], stats: { total, byPriority, byStatus }
}
```

**Frontend**:
- Opportunity cards: Company, Trigger, Capability, Score, Priority, Why Now
- Priority filter (high, medium, low)
- Status filter (pending_review, accepted, rejected, monitored)
- Accept/Reject buttons with feedback form
- Click → navigate to Company Profile Q5

**Tests**:
- Unit test: Accept/Reject flow creates Pursuit/updates status
- Integration test: Feedback stored in RecommendationFeedback

**Exit Criteria**:
- [ ] Opportunity cards display with all fields
- [ ] Accept creates Pursuit record
- [ ] Reject with reason updates OpportunityRecommendation

---

### Ticket 10: Intelligence Inbox (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 8

**Backend**:
- Compile new/unreviewed signals into unified inbox
- Add human intelligence submission flow (HumanIntelligenceInbox)
- Priority排序: critical > high > medium > low

**Frontend**:
- Inbox list: Signal title, company, severity, timestamp
- Quick actions: Dismiss, Investigate, Create Opportunity
- Filter by signal type, severity, company
- Batch actions (dismiss all low-severity)

**Tests**:
- Unit test: Inbox priority sorting
- Integration test: Dismiss updates signal status

**Exit Criteria**:
- [ ] Inbox shows unreviewed intelligence
- [ ] Quick actions work correctly
- [ ] Human intelligence can be submitted

---

### Ticket 11: Data Intelligence Import (P1)
**Priority**: P1 | **Estimate**: 3 days | **Dependencies**: Ticket 1

**Backend**:
- Complete DataUpload pipeline: Upload → Map → Validate → Normalize → Score → Commit
- Wire ColumnMappingRule, FieldValidationRule, NormalizationMapping from database
- Add NormalizationLog for every transformation
- Add DataQualityScore computation per row

**Frontend**:
- Upload wizard: File upload → Column mapping → Preview → Validate → Commit
- Data quality preview (score per row, issues highlighted)
- Normalization suggestions (show before/after)
- Commit with progress indicator

**Tests**:
- Unit test: Column mapping rule matching
- Unit test: Validation rule execution
- Integration test: Full import pipeline with 100-row CSV

**Exit Criteria**:
- [ ] Import wizard works end-to-end
- [ ] Data quality scores computed per row
- [ ] NormalizationLog records all transformations

---

### Ticket 12: Contact Management (P1)
**Priority**: P1 | **Estimate**: 2 days | **Dependencies**: Ticket 1

**Backend**:
- Contact CRUD with full validation
- Contact enrichment via research engine
- Lead scoring computation (companyFit, engagement, enrichment, aiConversion)
- Consent status tracking

**Frontend**:
- Contact table: Name, Email, Company, Role, Lead Score, Status
- Contact detail: Enrichment data, notes, activity timeline
- Lead score breakdown component

**Tests**:
- Unit test: Lead score computation
- Integration test: Contact CRUD

**Exit Criteria**:
- [ ] Contacts display with scores
- [ ] Contact detail shows enrichment data
- [ ] Consent status tracked

---

### Ticket 13: Email Draft Generation (P2)
**Priority**: P2 | **Estimate**: 2 days | **Dependencies**: Tickets 3, 7

**Backend**:
- Wire ConversationEngine for email draft generation
- Add governance gate (min 0.6 confidence, min 25 freshness)
- Store AIGenerationAudit for every draft
- Add batch approval workflow (assignee, governance score)

**Frontend**:
- Draft creation from Company Profile Q4
- Draft list: Contact, Subject, Score, Status, Governance Grade
- Draft review: Source snippets, assumption flags, confidence score
- Approve/Reject/Send actions

**Tests**:
- Unit test: Draft generation with governance check
- Integration test: Draft stored in database with audit trail

**Exit Criteria**:
- [ ] Draft generated from Company Profile
- [ ] Governance score displayed
- [ ] AIGenerationAudit created

---

### Ticket 14: Sequence Management (P2)
**Priority**: P2 | **Estimate**: 2 days | **Dependencies**: Ticket 13

**Backend**:
- Sequence CRUD (create, edit steps, toggle active)
- Signal-driven sequence generation (from OpportunityRecommendation)
- Sequence enrollment (contact + sequence)
- Sequence execution (step progression + delay scheduling)

**Frontend**:
- Sequence list: Name, Steps, Enrolled, Active
- Sequence builder: Step editor with delay configuration
- Enrollment management: Add/remove contacts, status tracking
- Execution history per enrollment

**Tests**:
- Unit test: Step progression logic
- Integration test: Signal-driven sequence creation

**Exit Criteria**:
- [ ] Sequences can be created with multiple steps
- [ ] Signal-driven sequences link to OpportunityRecommendation
- [ ] Enrollment tracking works

---

### Ticket 15: Knowledge & Capability Library (P0/P1)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Tickets 2, 7

**Backend**:
- Capability CRUD with 30+ categories
- Knowledge document ingestion (upload, chunk, embed)
- Vector search across capabilities
- Deduplication via contentHash

**Frontend**:
- Capability table: Title, Category, Service Line, Upvotes, Used In Emails
- Capability detail: Full content, evidence, case studies, keywords
- Knowledge library: Document list, search, category filter
- Upload knowledge document flow

**Tests**:
- Unit test: Vector search returns relevant results
- Integration test: Document ingestion pipeline

**Exit Criteria**:
- [ ] Capabilities searchable by vector similarity
- [ ] Knowledge documents upload and embed successfully
- [ ] Deduplication prevents duplicate assets

---

### Ticket 16: Intelligence Reasoning View (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Ticket 2

**Backend**:
- Wire Enterprise Reasoning Engine to Intelligence API
- Store ReasoningContext + ReasoningSteps in database
- Add reasoning refresh (re-compute on demand)

**Frontend**:
- Reasoning chain display: 30 steps, expandable
- Each step: Title, reasoning, evidence, impact
- Confidence indicator per step
- "Refresh Reasoning" button

**Tests**:
- Unit test: Reasoning step chain logic
- Integration test: Reasoning API returns structured steps

**Exit Criteria**:
- [ ] 30-step reasoning chain displays
- [ ] Each step shows evidence citations
- [ ] Refresh re-computes reasoning

---

### Ticket 17: Conversation Intelligence (P0)
**Priority**: P0 | **Estimate**: 2 days | **Dependencies**: Tickets 2, 7

**Backend**:
- Wire ConversationEngine to Intelligence API `/conversation/{id}`
- Generate talking points, objection handling, buyer profiles
- Store in ConversationPlan model

**Frontend**:
- Conversation prep card: Executive name, role, key topics
- Talking points list with confidence scores
- Objection handling cards
- Buyer profile summary

**Tests**:
- Unit test: Talking point generation
- Integration test: Conversation prep stored

**Exit Criteria**:
- [ ] Talking points generate with evidence grounding
- [ ] Objection cards display
- [ ] Buyer profile shows role + influence

---

### Ticket 18: Analytics & Reporting (P3)
**Priority**: P3 | **Estimate**: 2 days | **Dependencies**: Tickets 4, 5

**Backend**:
- Pipeline report: Stage distribution, conversion rates, average deal size
- Revenue report: Forecast vs actual, by month/quarter
- Team performance: Activity metrics, conversion metrics
- Data quality report: Completeness, validity, richness scores

**Frontend**:
- Dashboard with 4 report types (tab navigation)
- Charts: Bar (pipeline), Line (revenue trend), Pie (stage distribution)
- Export to PDF/CSV

**Tests**:
- Unit test: Report aggregation math
- Integration test: Report data accuracy

**Exit Criteria**:
- [ ] 4 report types display correctly
- [ ] Export to CSV works
- [ ] Charts render with real data

---

### Ticket 19: Settings & Configuration (P3)
**Priority**: P3 | **Estimate**: 2 days | **Dependencies**: Ticket 1

**Backend**:
- SystemSetting CRUD (key-value store)
- Column mapping rules admin interface
- Validation rules admin interface
- Scoring weights admin interface
- AI provider configuration (model selection, tier config)

**Frontend**:
- Settings tabs: General, Data Rules, AI Configuration, Scoring, Team
- Column mapping rule editor: Regex pattern, target field, priority
- Validation rule editor: Field, type, config, severity
- Scoring weight editor: Dimension, weight, max score

**Tests**:
- Unit test: Setting CRUD
- Integration test: Rule changes affect import behavior

**Exit Criteria**:
- [ ] All settings editable via UI
- [ ] Column mapping rules work on next import
- [ ] Scoring weights affect lead scoring

---

### Ticket 20: System Health & Audit (P3)
**Priority**: P3 | **Estimate**: 1 day | **Dependencies**: Ticket 3

**Backend**:
- System health aggregation: DB connection, AI engines, cron jobs, connectors
- Audit log viewer with filters
- AI usage dashboard: Cost per model, tokens per day, error rates

**Frontend**:
- Health dashboard: Green/Yellow/Red status per subsystem
- Audit log table: Action, Entity, User, Timestamp (filterable)
- AI usage charts: Cost trend, token usage, model distribution

**Tests**:
- Integration test: Health endpoint returns accurate status
- Unit test: Audit log filter logic

**Exit Criteria**:
- [ ] Health dashboard shows all subsystems
- [ ] Audit logs filterable by entity/type/date
- [ ] AI cost tracking displays

---

## 12. Decisions Log

### Locked Decisions (12/12)

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | **Communication = Optional Execution Layer** | DeepMindQ is intelligence-first, not email-first. Email/sequences are execution layers that consume intelligence, not the core product. | LOCKED |
| D2 | **Learning Loop: Manual Feedback First** | Start with explicit user feedback (accept/reject/modify). Architecture supports future CRM/calendar integration for implicit feedback. | LOCKED |
| D3 | **Screen Priority: P0(25) > P1(15) > P2(10) > P3(26)** | Core intelligence screens first. Operations second. Communication third. Management last. | LOCKED |
| D4 | **Vector Store: pgvector + Abstraction Layer** | PostgreSQL + pgvector for zero-infrastructure vector search. Abstraction layer (`vector-index.ts`) allows future swap to Pinecone/Weaviate. | LOCKED |
| D5 | **Task Processing: Prisma Job Model + Worker** | Simple, database-backed job queue. Migrate to BullMQ when scale demands it. Prisma Job model already has retry logic. | LOCKED |
| D6 | **Authentication: OTP + Session (No Multi-Tenant, No OAuth)** | Single-tenant, single-org deployment. OTP email auth is sufficient. No need for OAuth/SAML complexity at this stage. | LOCKED |
| D7 | **Refactor, Don't Rewrite** | Existing IP (90 models, 14 engines, 208 routes) is valuable. Refactor in-place, don't start from scratch. | LOCKED |
| D8 | **Backend First: Real API Contracts** | Every screen must have a real API contract before UI work begins. No mock data. | LOCKED |
| D9 | **Intelligence API Layer: Frontend Never Calls Engines** | Frontend ONLY calls 6 Intelligence API endpoints. All engine composition happens server-side. | LOCKED |
| D10 | **AI Governance: All LLM Calls Governed** | Every LLM call goes through `governedAI()`. ESLint rule blocks ungoverned calls. CI fails on violations. | LOCKED |
| D11 | **Feedback Intelligence Layer** | Recommend → User Decides → Execute → Result → Feedback Event → Learning Event → Confidence Calibration. Full closed loop. | LOCKED |
| D12 | **Design: Dark-First, Command Palette, Intelligence Cards** | Bloomberg Terminal + Palantir + Apple aesthetic. Command palette navigation (`Cmd+K`). Intelligence cards with evidence badges. | LOCKED |

### Architecture Decision Records (ADRs)

See `docs/ADR.md` for detailed ADR records:
- **ADR-001**: 6-Layer Architecture Stack
- **ADR-002**: Intelligence API Layer (6 Product Endpoints)
- **ADR-003**: 3-Score Architecture
- **ADR-004**: 5-Question Workspace
- **ADR-005**: 3-Section Navigation
- **ADR-006**: AI Governance (10/10 Engines)
- **ADR-007**: Design System — Dark First
- **ADR-008**: Dead Code Removal
- **ADR-009**: Orphaned Engine Resolution
- **ADR-010**: Phase Dependency Graph

---

*End of ARCHITECTURE.md — Version 2.0, Approved and Locked*
