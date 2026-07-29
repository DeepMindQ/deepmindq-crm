# DeepMindQ — AI-Powered Revenue Intelligence

> **"The goal is not to build more screens. The goal is that every screen becomes powered by reliable AI intelligence."**

DeepMindQ is an enterprise-grade, AI-native CRM that transforms revenue intelligence from reactive dashboards into proactive, evidence-backed selling machines. Built on a composable 7-engine architecture where every AI output follows the chain: **Signal → Reason → Evidence → Confidence → Business Impact → Recommended Action**.

---

## Architecture Overview

### Complete AI Flow

```
User Action → Screen → API Route → Engine Layer → Retrieval/Grounding → Model Router → LLM → Structured Output → UI
```

### 7-Engine Architecture (Phase A + B)

**Foundation Engines** (call LLMs, collect evidence, retrieve knowledge):

| Engine | Purpose | Key Technology |
|--------|---------|----------------|
| **ModelRouter** | Tiered LLM routing with automatic fallback | Z.ai GLM → Gemini → Groq Llama (Deep/Smart/Fast tiers) |
| **GroundingEngine** | Unified evidence chain builder with citations + confidence | Multi-source evidence collection, freshness decay, gap detection |
| **RetrievalEngine** | Local semantic search with zero-cost embeddings | @xenova/transformers (all-MiniLM-L6-v2, 384-dim) + TF-IDF fallback |

**Composition Engines** (orchestrate foundation engines to produce output):

| Engine | Purpose | Input | Output |
|--------|---------|-------|--------|
| **SynthesisEngine** | Evidence-grounded briefs (1200-2000 words) | Evidence + Knowledge + LLM (Deep tier) | Structured brief with [En] citations, per-section confidence, hallucination detection |
| **ScoringEngine** | Explainable revenue intelligence scoring | Evidence + LLM (Smart tier) | Score + factor breakdown + reasoning + evidence + confidence |
| **ActionEngine** | Next-best-action + sales motion recommendations | Evidence + Score + LLM (Smart tier) | Action + why + why now + message + timing + confidence |
| **ConversationEngine** | Persona-aware meeting prep + conversation planning | Evidence + Contact + LLM (Smart tier) | Talking points + questions + objections + positioning + topics to avoid |

### AI Reliability Layer

Every AI output includes these reliability primitives:
- **Confidence Score** (0-100%) — calibrated against evidence quality
- **Evidence References** — [En] citation markers with source attribution
- **Freshness Timestamp** — exponential decay from signal date
- **Source Attribution** — reliability-weighted (SEC.gov: 0.95, LinkedIn: 0.75, etc.)
- **Hallucination Prevention** — citation parser detects fabricated [En] markers
- **Failed Generation Handling** — non-throwing contract (success + error, never throws)
- **Token/Cost Tracking** — per-generation auditing via EngineRun records

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, React 19, Server Components) |
| **Language** | TypeScript 5, strict mode |
| **Database** | Prisma 6 ORM — SQLite (local) / PostgreSQL (Vercel/Neon) |
| **UI** | Tailwind CSS 4 + shadcn/ui (49 components) + Radix UI |
| **State** | Zustand 5 + TanStack React Query 5 |
| **AI/ML** | @xenova/transformers (local embeddings), Z.ai GLM, Gemini, Groq Llama |
| **Testing** | Vitest 4 + Testing Library (232 test files) |
| **Auth** | NextAuth + Resend OTP email authentication |
| **Monitoring** | Sentry 10 (client + server + edge) |
| **Deployment** | Vercel (primary), Render (fallback) |

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # 166 API routes
│   │   ├── ai/                 # AI engine endpoints (score, actions, conversation, brief)
│   │   ├── engines/            # Direct engine access routes
│   │   ├── companies/          # Company CRUD + intelligence + signals + timeline
│   │   ├── contacts/           # Contact CRUD + person intelligence + engagement
│   │   ├── opportunities/      # Opportunity management
│   │   ├── pipeline/           # Pipeline health + forecasting
│   │   ├── intelligence-sources/ # Signal acquisition + connectors
│   │   └── ...                 # 30+ domain API modules
│   ├── page.tsx                # Landing page
│   └── layout.tsx              # Root layout with providers
│
├── components/
│   ├── screens/                # 75 screen components
│   │   ├── ai-command-center-screen.tsx
│   │   ├── account-intelligence-screen.tsx
│   │   ├── company-detail-screen.tsx
│   │   ├── contact-detail-screen.tsx
│   │   ├── pipeline-forecast-screen.tsx
│   │   ├── signal-intelligence-screen.tsx
│   │   └── ...                 # 75 total screens
│   ├── ui/                     # 49 shadcn/ui components
│   ├── enterprise/              # Enterprise-grade reusable components
│   └── shared/                 # Design system, AI chat sidebar, command palette
│
├── lib/
│   ├── engines/                # 7-engine architecture (Phase A+B)
│   │   ├── model-router.ts
│   │   ├── grounding-engine.ts
│   │   ├── retrieval-engine.ts
│   │   ├── synthesis-engine.ts
│   │   ├── scoring-engine.ts
│   │   ├── action-engine.ts
│   │   └── conversation-engine.ts
│   │
│   ├── ai-copilot/             # AI orchestration (prompt builder, guardrails, evidence synthesis)
│   ├── revenue-intelligence/   # Signal detection, scoring, recommendations
│   ├── research-engine/        # Signal sequencing, opportunity radar, evidence quality
│   ├── intelligence-sources/   # Connectors (CSV, RSS, Excel, Website), knowledge fabric
│   ├── scoring/                # Sub-engines (opportunity probability, revenue, contact influence, buying intent)
│   ├── data-intelligence/      # Data validation, normalization, deduplication, quality scoring
│   ├── workflow-engine/        # Queue, processor, retry logic
│   └── ...                     # 161 library modules total
│
├── hooks/                      # React hooks (mobile, toast, realtime)
├── providers/                  # Auth + Query providers
└── data/                       # Chunked lead data files
```

---

## Database Schema

**75 Prisma models**, 1,959 lines of schema covering:

- **Core CRM**: Contact, Company, Opportunity, Lead
- **Intelligence**: CompanySignal, AIInsight, Evidence, SignalCapabilityMatch
- **AI Engine**: EngineRun, Embedding
- **Engagement**: Email, Draft, Reply, Bounce, Sequence
- **Knowledge**: KnowledgeEntry, CapabilityAsset, CapabilityCategory
- **Governance**: AuditLog, AIUsageRecord
- **Workflow**: Batch, ImportJob, Webhook

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Setup

```bash
# Clone
git clone https://github.com/DeepMindQ/deepmindq-crm.git
cd deepmindq-crm

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Database setup
npm run db:generate
npm run db:push

# Development
npm run dev
```

### Environment Variables

Key variables (see `.env.example` for full list):

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | SQLite/PostgreSQL connection string | Yes |
| `AUTH_SECRET` | NextAuth secret key | Yes |
| `RESEND_API_KEY` | Resend email API for OTP auth | Yes |
| `ZAI_API_KEY` | Z.ai GLM API key (primary LLM) | Yes |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key (fallback LLM) | Optional |
| `GROQ_API_KEY` | Groq API key (fast tier LLM) | Optional |
| `NEXT_PUBLIC_APP_URL` | App URL for auth callbacks | Yes |

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build (Prisma generate + DB push + Next build) |
| `npm run build:vercel` | Vercel-optimized build (no DB push) |
| `npm run test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode testing |
| `npm run lint` | ESLint + governance checks |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run seed` | Seed demo data |

---

## AI Engine Examples

### ScoringEngine Output (Evidence-Based)

```
Account Score: 87/100 (Grade A, Priority: Critical)
+25 Technology Trigger — Started Azure AI migration program [E1]
+20 Growth Signal — Hiring 45 AI engineers [E2]
+15 Executive Change — New VP Data appointed [E3]
+12 Engagement — Multiple website visits, 3 contacts engaged [E5]
 -5 Risk — Existing competitor relationship [E8]
Confidence: 91% — based on 23 signals, 6 evidence sources
```

### ActionEngine Output (Contextual + Actionable)

```
Signal Detected: CIO hired 3 cloud architects
Action: Schedule executive discussion with VP Data
Why: Company entering cloud modernization phase
Why Now: 14-day decision window (RFP deadline approaching)
Message: "We noticed your cloud modernization initiative..."
Expected Impact: High — VP Data is actively evaluating vendors
Confidence: 85% — 4 signals, 2 contacts, hiring pattern
```

### ConversationEngine Output (Persona-Aware)

```
Buyer: CIO at Fortune 500 manufacturing company
Priorities: 1. Regulatory compliance  2. Data modernization  3. Cost optimization
Questions to Ask: "What challenges are you facing managing AI governance?"
Topics to Avoid: Leading with cost reduction (buyer is ROI-positive)
Positioning: Enterprise AI control layer
Objections: "We already have a data team" → "Your team is the reason this will succeed"
```

---

## Key Screens (75 Total)

| Screen | Description |
|--------|-------------|
| AI Command Center | Cross-account AI intelligence overview |
| Account Intelligence | Full AI-powered account workspace |
| Company Detail | Company profile + signals + contacts + timeline |
| Contact Detail | Buyer intelligence profile |
| Pipeline Forecast | AI-powered forecasting command center |
| Signal Intelligence | Real-time signal detection + analysis |
| Conversation Studio | AI-powered conversation planning |
| Research Agent | Automated company research |
| Knowledge Library | Internal knowledge management |
| Revenue Intelligence | Score + brief + recommendations |
| Opportunity Radar | AI-sourced opportunity detection |
| Deal Coaching | AI deal strategy + coaching |
| AI Health | AI system monitoring + reliability metrics |
| RevOps | Revenue operations dashboard |
| Analytics | Full analytics suite |
| Intelligence Timeline | Chronological intelligence feed |

---

## Design Principles

### Evidence-First AI
Every AI output cites evidence with [En] markers. Hallucinated citations are detected and penalized. Coverage gaps are acknowledged explicitly.

### Non-Throwing Engine Contract
All engines return `{ success: boolean, error: string | null, ... }`. Failures degrade gracefully — a failed Deep tier call falls back to Smart, then Fast, then structured error.

### Zero-Cost Intelligence Stack
Default LLM providers all have free tiers (Z.ai, Gemini, Groq). Local embeddings via @xenova/transformers ($0). Paid providers (NVIDIA, OpenAI) are opt-in.

### Source Reliability Hierarchy
```
SEC.gov (0.95) > Bloomberg (0.92) > Crunchbase (0.85) > LinkedIn (0.75) > TechCrunch (0.78) > Default (0.60)
```

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0-1** | Complete | Foundation: CRM, auth, import, contacts, companies |
| **Phase 2** | Complete | AI intelligence: scoring, signals, recommendations |
| **Phase 3** | Complete | Freeze + handover + documentation |
| **Phase 4-5** | Complete | Enterprise: RBAC, audit, workflow engine, data health |
| **Phase 6** | Complete | Enterprise readiness + design validation |
| **Phase 7** | Complete | Stabilization + evidence collection |
| **Phase A** | Complete | Engine architecture: ModelRouter, Grounding, Retrieval |
| **Phase B** | Complete | Composition engines: Synthesis, Scoring, Action, Conversation |
| **Phase C** | Planned | Screen upgrades: AI Account Intelligence, Buyer Intelligence, AI Deal Room, AI Forecasting |

---

## Deployment

### Vercel (Primary)
```bash
npm run build:vercel
```
- Automatic deployments via GitHub push
- Neon PostgreSQL adapter for serverless
- Edge runtime for auth routes

### Render (Fallback)
```bash
npm run build
npm run start
```
- `render.yaml` configuration included
- SQLite for single-instance deployment

---

## Testing

```
232 test files across:
- Unit tests: Engine logic, scoring, signal detection, data intelligence
- Integration tests: API routes, database operations
- E2E tests: Business journey validation
```

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
```

---

## License

Private — DeepMindQ CRM

---

## Repository

**GitHub:** [DeepMindQ/deepmindq-crm](https://github.com/DeepMindQ/deepmindq-crm)

---

*Built with Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma, and a composable 7-engine AI architecture.*
