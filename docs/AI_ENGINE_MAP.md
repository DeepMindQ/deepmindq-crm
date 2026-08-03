# DeepMindQ AI Intelligence Engine Map — WI-16A

> **Last Updated:** 2026-08-03
> **Program:** WI-16 Intelligence Engine Transformation
> **Maturity Baseline:** ~45% (significant foundations, critical gaps remain)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     USER / API LAYER (68 screens)                     │
│   27 /api/ai/* routes  |  22 /api/intelligence/* routes              │
│   4 /api/engines/* routes |  20+ entity-specific AI routes            │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│                  AI GOVERNANCE LAYER (ai-governance.ts)              │
│   57 registered generation types | Confidence gates                  │
│   15 hallucination prevention rules | Audit trail (AIGenerationAudit)│
│   Freshness lifecycle | staleness modifiers | Evidence grounding     │
│   Mandatory: ALL LLM calls pass through governedAICall()             │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│                  7 COMPOSABLE ENGINE ARCHITECTURE                     │
│                                                                      │
│  ┌─ FOUNDATION ENGINES ─────────────────────────────────────────────┐ │
│  │  ModelRouter      — Tiered LLM routing (Deep/Smart/Fast)         │ │
│  │  GroundingEngine  — Evidence chain builder (4 sources parallel)    │ │
│  │  RetrievalEngine  — Semantic search (Xenova + TF-IDF fallback)    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌─ COMPOSITION ENGINES ───────────────────────────────────────────┐ │
│  │  SynthesisEngine   — 5 brief types (1200-2000 word evidence-led)│ │
│  │  ScoringEngine     — Revenue Intelligence Score (9 dimensions)   │ │
│  │  ActionEngine      — 6 action types + sales motion planner       │ │
│  │  ConversationEngine— 4 briefing types + buyer role mapping       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│              ORCHESTRATION LAYER (Higher-Order Intelligence)          │
│                                                                      │
│  Enterprise Reasoning Engine — 30-step cumulative chain              │
│  Multi-Agent Orchestrator    — 10 specialist agents                  │
│  Continuous Learning Loop    — Feedback → calibration                │
│  Contradiction Detection     — Signal conflict detection             │
│  Intelligence Pipeline       — Core product data flow                 │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│              INFERENCE SUPPORT LAYER                                 │
│                                                                      │
│  AI Cache Layer       — SHA-256 keyed, 7-30 day TTL                 │
│  Quality Gates         — 4-gate system (evidence/halluc/accuracy)    │
│  Usage Tracker         — Per-call cost tracking, 5 model cost table   │
│  Confidence Engine     — 3-factor composite (source/freshness/content)│
│  Source Reliability    — Weighted source ratings (sec.gov=0.95)      │
│  Freshness Decay       — Exponential temporal decay                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. AI Capability Inventory

### 2.1 Company Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Company Research | `research-engine/researcher.ts` | Company name/domain | Tavily web search → LLM extraction → structured data | CompanyResearchCard |
| Company Enrichment | `/api/ai/enrich` | Company ID + missing fields | LLM-powered gap filling with web search | Enriched company profile |
| Company Intelligence | `/api/companies/[id]/intelligence` | Company ID | GroundingEngine → governedAICall | Evidence-backed insights |
| Account Brief | `SynthesisEngine` (account_brief type) | Company + evidence chain | 7-section LLM generation with [En] citations | 1200-2000 word brief |
| Company Score | `ScoringEngine` | 9 signal dimensions | Decomposed scoring (max 100, grade A-F) | Revenue Intelligence Score |
| Account Actions | `ActionEngine` | Company + score + evidence | 6 action types + sales motion mapping | Recommended actions |
| Mind Map | `/api/companies/mind-map` | Company ID | Pure DB query (no LLM) | JSON hierarchy |

### 2.2 Contact Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Contact Briefing | `SynthesisEngine` (contact_brief) | Contact + company | LLM with role, influence, priorities | 800-1400 word brief |
| Contact Scoring | `ScoringEngine` + `contact-influence-engine.ts` | Contact data | Influence power scoring | Lead score + influence score |
| Suggested Contacts | `/api/ai/suggested-contacts` | Company + ICP | LLM stakeholder identification | Ranked contact list |
| Contact Intelligence | `/api/ai/contact-intelligence` | Contact ID | Multi-source enrichment | Intelligence profile |
| Relationship Memory | `/api/ai/relationship-memory` | Portfolio | 5 LLM analysis modes | Relationship health + strategy |
| People Enrichment | `intelligence-sources/people-enrichment/engine.ts` | Name/company | Web search → LLM extraction | Professional profile |
| Person Profile | `/api/contacts/person-profile` | Contact ID | Research agent pipeline | Full person profile |

### 2.3 Signal Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Signal Detection | `research-engine/signals.ts` | Company data + web search | LLM extraction with 7 signal types | CompanySignal records |
| Signal Meaning | `research-engine/signal-meaning.ts` | Raw signal | LLM interpretation + impact mapping | Meaning + business impact |
| Signal Lifecycle | `research-engine/signal-lifecycle.ts` | Signal + time | Freshness decay scoring | Active/aging/expired |
| Signal Sequence | `research-engine/signal-sequence-engine.ts` | Signals | LLM multi-step email sequence | 3-email outreach sequence |
| Cross-Signal Correlation | `intelligence-sources/cross-signal-correlation.ts` | Multiple signals | Pattern detection across accounts | Correlated signal groups |
| Signal Capability Match | `research-engine/signal-capability-matching.ts` | Signal + capabilities | Embedding similarity + LLM | Matched capabilities |
| Contradiction Detection | `contradiction-detection.ts` | Signal set | Pattern-based conflict detection | Contradiction reports |

### 2.4 Opportunity Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Opportunity Radar | `revenue-intelligence/opportunity-radar.ts` | Company signals | LLM opportunity identification | Opportunity list |
| Opportunity Scoring | `scoring/opportunity-probability-engine.ts` | Opportunity data | Win probability estimation | Win probability % |
| Opportunity Recommendation | `research-engine/opportunity-recommendation-engine.ts` | Signal + evidence | Multi-factor scoring | Ranked recommendations |
| Opportunity Accept/Reject | `/api/ai/opportunities/[id]/accept|reject` | Opportunity ID | Status transition → Pursuit creation | Pursuit record |
| Revenue Scoring | `ScoringEngine` | 9 dimensions | Decomposed composite scoring | Revenue Intelligence Score |

### 2.5 Knowledge Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Knowledge Base | `/api/knowledge` | Documents | Ingest → chunk → classify → embed | KnowledgeEntry |
| Knowledge Graph | `/api/knowledge/graph` | Knowledge entries | Relationship extraction | Graph structure |
| Knowledge Ingestion | `knowledge-ingestion-pipeline.ts` | File/URL | Parse → chunk → classify → embed | KnowledgeDocument + Chunks |
| Knowledge Fabric | `intelligence-sources/knowledge-fabric.ts` | All knowledge | Unified knowledge graph | Cross-domain relationships |
| Capability Intelligence | `capability-intelligence-engine.ts` | Company + capabilities | LLM matching + scoring | Matched capabilities |

### 2.6 Revenue Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Account Scoring | `revenue-intelligence/account-scoring.ts` | Company data | Multi-factor scoring | Account score |
| Executive Recommendations | `revenue-intelligence/executive-recommendations.ts` | Structured facts | LLM narrative generation | Engagement reasoning |
| Revenue Engagement | `revenue-intelligence/brief-generator.ts` | Score + evidence | LLM narrative | Executive summary |
| Signal Extraction | `revenue-intelligence/signal-extraction.ts` | Text data | Pattern extraction | Signal records |
| Signal Patterns | `revenue-intelligence/signal-patterns.ts` | Historical signals | Pattern recognition | Pattern analysis |

### 2.7 Email Intelligence

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Email Generation | `email-generation.ts` | Contact + context | Governed LLM with evidence | Personalized email |
| Email Intelligence | `/api/ai/email-intelligence` | Email content | LLM analysis | Email classification |
| Email Sequence | `research-engine/signal-sequence-engine.ts` | Company + signals | 3-step LLM sequence | Email sequence |

### 2.8 AI Search

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| Web Search | `llm-client.ts:webSearch()` | Query | Tavily API | Search results |
| Parallel Search | `llm-client.ts:parallelWebSearch()` | Multiple queries | Z.ai SDK parallel | Aggregated results |
| AI Answer | `llm-client.ts:tavilyAIAnswer()` | Query | Tavily AI answer | Direct answer + sources |
| Semantic Search | `RetrievalEngine` | Query + entity types | Xenova embeddings + TF-IDF | Ranked results |
| Command Center Query | `/api/command-center/query` | NL query | LLM query planning → DB execution | Structured results |

### 2.9 AI Recommendations

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| AI Recommendations | `/api/ai/recommendations` | Context | Governed LLM | Ranked recommendations |
| Next Best Action | `ActionEngine` | Company + score | 6-type action reasoning | Priority action |
| Sales Motion | `ActionEngine` | Current stage | Stage progression mapping | Next sales motion |
| Account Strategy | `ActionEngine` | Full intelligence | Strategic planning | Account strategy |

### 2.10 AI Briefings

| Component | Engine/Module | Input | Processing | Output |
|-----------|--------------|-------|-----------|--------|
| AI Insights | `/api/ai/insights` | Context | LLM morning brief format | CEO briefing |
| Account Brief | `SynthesisEngine` | Company + evidence | 7-section evidence-grounded | Full account brief |
| Deal Strategy | `SynthesisEngine` | Opportunity + evidence | Pursuit strategy | Deal strategy brief |
| Executive Summary | `SynthesisEngine` | Any intelligence | Condensed 400-600 word | 1-page summary |
| Conversation Prep | `ConversationEngine` | Meeting context | Buyer role + talking points | Meeting prep brief |
| Executive Briefing | `ConversationEngine` | Company + contacts | Executive-level brief | C-suite brief |

---

## 3. LLM Provider Configuration

### 3.1 Provider Chain

| Priority | Provider | Model | Cost | RPM |
|----------|----------|-------|------|-----|
| 1 | NVIDIA NIM | `meta/llama-3.1-8b-instruct` | Free credits | ~40 |
| 2 | Fireworks AI | `llama-v3p3-70b-instruct` | Free tier | Varies |
| 3 | Groq | `llama-3.3-70b-versatile` | Free tier | ~30 |
| 4 | Google Gemini | `gemini-2.0-flash` | Free tier | ~15 |
| 5 | Z.ai SDK | GLM-4.6 | Internal | N/A |

### 3.2 Tier Routing

| Tier | Max Tokens | Primary | Fallback | Use Case |
|------|-----------|---------|----------|----------|
| **DEEP** | 8192 (cap 16K) | GLM-4.6 | Gemini 1.5 Pro → Gemini 2.0 Flash | Long-form briefs, deal strategy |
| **SMART** | 4096 (cap 8K) | Gemini 2.0 Flash | Llama 3.3 70B → GLM | Action plans, contact briefs |
| **FAST** | 1500 (cap 4K) | Llama 3.1 8B | Gemini 2.0 Flash | Classification, summaries |

### 3.3 Search Provider

| Provider | API | Free Tier | Purpose |
|----------|-----|-----------|---------|
| Tavily | `api.tavily.com/search` | 1000/month | Primary web search |
| Z.ai SDK | `zai.web_search()` | Internal | Parallel search |

---

## 4. Governance & Quality Infrastructure

### 4.1 Governance Configurations (57 types)

Every AI generation type has a registered configuration with:
- `minResearchConfidence` — minimum field confidence (0-1)
- `minFreshnessScore` — minimum freshness (0-100)
- `requireCapabilityMatch` — whether a capability must match
- `requireRecentIntelligence` — whether research must exist
- `maxStalenessDays` — maximum age of intelligence

### 4.2 Quality Gates (4-Gate System)

| Gate | Automatable | Weight | What It Checks |
|------|------------|--------|---------------|
| Evidence Check | Yes | 30% | Source URL, name, snippet, date |
| Hallucination Check | Yes | 25% | Confidence < 60, hedging language, placeholder URLs |
| Accuracy Check | No (human) | 20% | Ground truth comparison |
| Specificity Check | Yes | 25% | Named entities, tech keywords, monetary values |

### 4.3 Hallucination Prevention (15 Mandatory Rules)

Every `governedAICall()` automatically injects 15 evidence grounding rules:
1. Only reference facts from provided context
2. Never fabricate values for "Not found" fields
3. Never extrapolate from partial data
4. Never claim unverified technology usage
5. Never invent quotes or announcements
6. Preface stale claims with date
7. Never exceed field confidence scores
8. Say "no data" rather than guessing
9. Never assume unstated strategy
10. Never invent partnerships
11. Never mention unlisted capabilities
12. State unavailability explicitly
13. Reduce confidence with low quality
14. Mention single-source uncertainty
15. Never create fake business problems

### 4.4 Confidence Scoring (Existing)

**Confidence Engine** (`intelligence-sources/confidence-engine.ts`):
- Source Quality (35%): Static source reliability
- Freshness (35%): Time-decay scoring
- Content Validation (30%): Content length heuristic

**Scoring Engine** (`engines/scoring-engine.ts`): 9 decomposed dimensions, max 100 points

---

## 5. Data Flow: End-to-End AI Pipeline

```
DATA INGESTION
├── CSV/Excel Upload → Connectors → IntelligenceObject
├── Tavily Web Search → Evidence + CompanySignal
├── RSS/Website Monitor → IntelligenceObject
├── Manual Human Intel → HumanIntelligenceInbox → IntelligenceObject
└── Knowledge Docs → KnowledgeDocument → KnowledgeChunk

INTELLIGENCE PROCESSING
├── GroundingEngine.collect() → EvidenceChain (4 sources parallel)
├── RetrievalEngine.search() → Semantic similarity results
├── SignalCapabilityMatch → Capability matching
├── ContradictionDetection → Conflict identification
└── CrossSignalCorrelation → Multi-signal patterns

AI GENERATION (Governed)
├── governedAICall() → Governance checks → LLM → Response
├── SynthesisEngine → Evidence-grounded briefs
├── ScoringEngine → Revenue Intelligence Score
├── ActionEngine → Next-best-action recommendations
└── ConversationEngine → Meeting prep briefs

ORCHESTRATION
├── Enterprise Reasoning Engine → 30-step chain
├── Multi-Agent Orchestrator → 10 agents
├── Continuous Learning → Feedback → calibration
└── Intelligence Pipeline → Full company analysis

OUTPUT & FEEDBACK
├── AI Cache → SHA-256 keyed response cache
├── Quality Gates → 4-gate quality check
├── Audit Trail → AIGenerationAudit + AICallLog
└── Learning Events → Win/loss → capability updates
```

---

## 6. AI Maturity Assessment by Dimension

| Dimension | Current Score | Target | Gap Analysis |
|-----------|:---:|:---:|------|
| **Hallucination Control** | 65% | 95% | 15 rules injected, but NO post-generation validation. No citation verification. No claim extraction + fact checking. |
| **AI Accuracy** | 50% | 95% | Quality gates exist but accuracy gate requires manual human review. No automated accuracy measurement. No benchmark dataset. |
| **Explainability** | 40% | 95% | Evidence chain exists with [En] markers. Score breakdown exists. But no reasoning trace. No "why this recommendation" layer. No decision provenance. |
| **Confidence Scoring** | 55% | 95% | 3-factor confidence engine + 9-dimension scoring. But no unified multi-factor model. No confidence calibration. No confidence decay over time. |
| **Retrieval Quality** | 35% | 90% | Dual embedding systems (TF-IDF + Xenova). No hybrid ranking. No re-ranking. No query understanding. No pgvector. JSON-stored vectors. |
| **AI Memory** | 15% | 90% | No short-term conversation memory. No long-term enterprise memory. No user preference learning. Session-only context. |
| **AI Agents** | 45% | 90% | 10 specialist agents exist. But no tool-calling. No autonomous execution. No self-planning. Sequential, not dynamic. |
| **AI Trust** | 40% | 95% | Governance layer is strong. But no confidence display in UI. No feedback buttons. No trust indicators. Audit exists but not user-visible. |
| **Prompt Engineering** | 30% | 90% | 85+ prompt strings scattered across 48 files. No versioning. No A/B testing. No centralized registry. No systematic evaluation. |
| **AI Documentation** | 20% | 90% | ARCHITECTURE.md exists (1445 lines). But no AI-specific architecture doc. No prompt documentation. No testing guide. |

**Overall Maturity: ~45%** (not 10% — significant foundations exist)

---

## 7. Critical Gaps Identified (WI-16 Priority Order)

### P0 — Must Fix for Enterprise Trust

1. **No Post-Generation Hallucination Detection** — Rules are injected into prompts, but output is never validated against evidence. LLM can still hallucinate despite instructions.
2. **No Unified Confidence Engine** — 3 separate confidence systems (ConfidenceEngine, ScoringEngine, quality gates) with different formulas and no normalization.
3. **Prompt Sprawl** — 85+ prompts in 48 files with no versioning, no registry, no evaluation.
4. **No Citation Verification** — [En] markers are parsed but never verified against actual evidence. Hallucinated citations go undetected.
5. **No AI Memory** — Zero conversation memory, zero enterprise memory. Every interaction is stateless.

### P1 — Important for Enterprise Readiness

6. **Dual LLM Paths** — `callAI()` (Z.ai SDK) and `callLLM()` (direct fetch) have different quality coverage.
7. **No Streaming** — All LLM calls are request/response. Long analyses block with no progress.
8. **No Feedback Loop UI** — Learning events exist but no user-facing feedback mechanism.
9. **Vector Storage as JSON** — Embeddings stored as JSON strings, not native pgvector. Limits to ~10K entries.
10. **Token Estimation is Crude** — 4 chars/token heuristic, no tiktoken.

### P2 — Nice to Have for Differentiation

11. **No Function Calling** — LLMs can't autonomously query DB or trigger actions.
12. **No Multi-Model A/B** — Single model per tier, no A/B testing between models.
13. **No Autonomous Workflows** — All actions require human initiation.
14. **No AI Personalization** — Same intelligence for all users regardless of role.

---

## 8. File Inventory (175 AI-Related Files)

### Core AI Infrastructure
- `src/lib/ai-config.ts` — Central AI configuration
- `src/lib/llm-client.ts` — Unified LLM client (595 lines)
- `src/lib/ai-governance.ts` — Governance layer (1440 lines)
- `src/lib/ai-cache-layer.ts` — Response caching
- `src/lib/zai-config.ts` — Z.ai SDK configuration

### Engine Architecture (8 files)
- `src/lib/engines/model-router.ts` — Tiered LLM routing
- `src/lib/engines/grounding-engine.ts` — Evidence chain builder
- `src/lib/engines/retrieval-engine.ts` — Semantic search
- `src/lib/engines/synthesis-engine.ts` — Brief generation (677 lines)
- `src/lib/engines/scoring-engine.ts` — Revenue scoring (815 lines)
- `src/lib/engines/action-engine.ts` — Action planning (694 lines)
- `src/lib/engines/conversation-engine.ts` — Conversation intel (833 lines)
- `src/lib/engines/index.ts` — Barrel export

### Higher-Order Intelligence (5 files)
- `src/lib/enterprise-reasoning-engine.ts` — 30-step reasoning (668 lines)
- `src/lib/multi-agent-orchestrator.ts` — 10 agents (409 lines)
- `src/lib/continuous-learning-loop.ts` — Learning loop (203 lines)
- `src/lib/contradiction-detection.ts` — Conflict detection (292 lines)
- `src/lib/intelligence-pipeline.ts` — Core pipeline

### AI Copilot (3 files)
- `src/lib/ai-copilot/quality-gates.ts` — 4-gate system (389 lines)
- `src/lib/ai-copilot/usage-tracker.ts` — Cost tracking
- `src/lib/ai-copilot/types.ts` — Type definitions

### Intelligence Sources (47 files)
- 17 connectors, engines, and services
- Evidence, confidence, freshness, correlation systems

### API Routes (80+)
- 27 `/api/ai/*` routes
- 22 `/api/intelligence/*` routes
- 4 `/api/engines/*` routes
- 20+ entity-specific AI routes

---

## 9. WI-16 Program Roadmap

Based on this audit, the WI-16 implementation order is:

| Phase | Priority | Focus | Impact |
|-------|----------|-------|--------|
| **WI-16A** | Done | Architecture audit + engine map | Foundation for all subsequent work |
| **WI-16B** | P0 | Post-generation hallucination detection + citation verification | Enterprise trust |
| **WI-16C** | P0 | Unified confidence engine (merge 3 systems) | Consistent scoring |
| **WI-16D** | P0 | Prompt registry + versioning | Systematic improvement |
| **WI-16E** | P1 | AI evaluation framework + benchmarks | Quality measurement |
| **WI-16F** | P1 | Hybrid retrieval (merge dual systems + add re-ranking) | Search quality |
| **WI-16G** | P1 | Knowledge graph intelligence | Cross-entity reasoning |
| **WI-16H** | P1 | Memory architecture (short + long term) | Context continuity |
| **WI-16I** | P1 | AI agent framework upgrade | Autonomous intelligence |
| **WI-16J** | P1 | AI explainability layer | Decision provenance |
| **WI-16K** | P1 | AI guardrails (output validation) | Output safety |
| **WI-16L-M** | P2 | Cost optimization + multi-model routing | Efficiency |
| **WI-16N-O** | P2 | Observability + human feedback loop | Continuous improvement |
| **WI-16P-R** | P2 | Personalization + search + freshness | UX differentiation |
| **WI-16S-U** | P2 | Security + benchmark + documentation | Enterprise compliance |
| **WI-16V-Z** | P2 | UI integration + monitoring + certification | Final polish |
