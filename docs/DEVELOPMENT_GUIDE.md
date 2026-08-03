# DeepMindQ — Developer Guide

> **Target audience:** Senior engineer joining the team tomorrow. This document covers everything you need to be productive on day one.

---

## Table of Contents

1. [Quick Start](#1-quick-start-15-minutes)
2. [Repository Structure](#2-repository-structure)
3. [Module Ownership Map](#3-module-ownership-map)
4. [Common Tasks](#4-common-tasks)
5. [Design System Reference](#5-design-system-reference)
6. [Testing Guide](#6-testing-guide)
7. [Architecture Deep Dives](#7-architecture-deep-dives)
8. [Design Token Migration Guide](#8-design-token-migration-guide)

---

## 1. Quick Start (15 minutes)

### Prerequisites

- **Node.js** 20+ (`engines` enforced in `package.json`)
- **npm** 10+
- A code editor with TypeScript support (VS Code recommended)

### Setup

```bash
git clone https://github.com/DeepMindQ/deepmindq-crm.git && cd deepmindq-crm
npm install
cp .env.example .env.local
# Edit .env.local — minimum required: DATABASE_URL, NEXTAUTH_SECRET, AUTHORIZED_EMAIL
npx prisma generate
npx prisma db push
npm run dev
# Open http://localhost:3000
```

### Required Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | SQLite (local) or PostgreSQL (Neon/Vercel) connection string | **Yes** |
| `NEXTAUTH_SECRET` | NextAuth session signing key (min 32 chars in production) | **Yes** |
| `AUTHORIZED_EMAIL` | Email address allowed to log in | **Yes** |
| `TRACKING_SECRET` | Email tracking HMAC secret (min 16 chars in production) | **Yes** |
| `GROQ_API_KEY` | Groq LLM provider (free tier) | Recommended |
| `GEMINI_API_KEY` | Google Gemini LLM provider (free tier) | Recommended |
| `FIREWORKS_API_KEY` | Fireworks AI LLM provider (free tier) | Optional |
| `NVIDIA_API_KEY` | NVIDIA NIM LLM provider (free credits) | Optional |
| `TAVILY_API_KEY` | Tavily web search (1000 free searches/mo) | Optional |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email sending (via Nodemailer/Resend) | Optional |

> **Note:** Environment validation runs at startup via `src/instrumentation.ts` → `src/lib/validate-env.ts`. In production, missing required vars cause `process.exit(1)`. In development, warnings are logged but the app continues.

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server on port 3000, logs to `dev.log` |
| `npm run build` | Prisma generate + migrate deploy + Next build |
| `npm run build:vercel` | Prisma generate + Next build (no DB push) |
| `npm run start` | Start production server |
| `npm run test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode testing |
| `npm run lint` | ESLint + governance checks (`check-governance.sh`) |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate:dev` | Create and apply a new migration |
| `npm run db:migrate:deploy` | Apply pending migrations (production) |
| `npm run seed` | Seed demo data |

---

## 2. Repository Structure

```
deepmindq-crm/
├── src/
│   ├── app/                        # Next.js 16 App Router
│   │   ├── api/                    # 224 API route files across 66+ directories
│   │   │   ├── auth/               # OTP login, session, profile (9 routes)
│   │   │   ├── ai/                 # AI endpoints: chat, score, generate, brief (20+ routes)
│   │   │   ├── engines/            # Direct engine access: score, actions, conversation, brief (4 routes)
│   │   │   ├── companies/          # Company CRUD, intelligence, signals, timeline, scoring (14 routes)
│   │   │   ├── contacts/           # Contact CRUD, briefings, email generation (7 routes)
│   │   │   ├── opportunities/      # Opportunity management (2 routes)
│   │   │   ├── intelligence/        # Intelligence pipeline: grounding, retrieval, knowledge (25+ routes)
│   │   │   ├── g-intel-acquisition/ # Intelligence inbox management (6 routes)
│   │   │   ├── leads/              # Lead scoring, dedup, lookalike (8 routes)
│   │   │   ├── pipeline/           # Pipeline health, forecasting (3 routes)
│   │   │   ├── sequences/          # Email sequence enrollment + execution (5 routes)
│   │   │   ├── knowledge/          # Knowledge CRUD, graph, ingestion (4 routes)
│   │   │   ├── capabilities/       # Capability library management (6 routes)
│   │   │   ├── batches/            # Batch job management (3 routes)
│   │   │   ├── reports/            # Revenue, pipeline, team, data-quality (4 routes)
│   │   │   ├── segments/           # Segment management (2 routes)
│   │   │   ├── data-import/        # Intelligence data import pipeline (2 routes)
│   │   │   ├── drafts/             # Email draft management (2 routes)
│   │   │   ├── conversation-plans/ # Conversation planning (2 routes)
│   │   │   ├── prompt-templates/   # Prompt template CRUD + store (3 routes)
│   │   │   ├── email-templates/    # Email template CRUD (2 routes)
│   │   │   ├── playbooks/          # Playbook CRUD (2 routes)
│   │   │   ├── seed/               # Seed data + gold-standard (2 routes)
│   │   │   ├── webhooks/           # Reply + bounce webhooks (2 routes)
│   │   │   ├── tracking/           # Email open + click tracking (2 routes)
│   │   │   ├── cron/               # Job processor (1 route)
│   │   │   ├── health/             # Health check (1 route)
│   │   │   ├── ready/              # Readiness check (1 route)
│   │   │   ├── version/            # Version info (1 route)
│   │   │   ├── ping/               # Liveness probe (1 route)
│   │   │   └── ...                 # settings, audit, analytics, exports, etc.
│   │   ├── login/page.tsx          # Login page (OTP-based)
│   │   ├── signup/page.tsx        # Signup page
│   │   ├── demo/page.tsx          # Demo mode page
│   │   ├── page.tsx                # Landing page / main app shell
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── error.tsx               # Error boundary
│   │   ├── global-error.tsx        # Global error boundary
│   │   ├── not-found.tsx           # 404 page
│   │   ├── loading.tsx             # Loading state
│   │   └── globals.css             # Global styles
│   │
│   ├── components/
│   │   ├── screens/                # 75 screen components (~52,000 lines)
│   │   │   ├── *-screen.tsx        # Each screen is a lazy-loaded page-level component
│   │   │   └── ...                 # See src/lib/screen-map.tsx for full registry
│   │   ├── ui/                     # 49 shadcn/ui base components
│   │   │   ├── button.tsx, card.tsx, dialog.tsx, table.tsx, ...
│   │   │   └── ...                 # Standard shadcn/ui — do NOT modify directly
│   │   ├── enterprise/             # 10 enterprise reusable components
│   │   │   ├── AIInsightCard.tsx   # AI insight display card
│   │   │   ├── AIProgressTracker.tsx # AI operation progress
│   │   │   ├── ConfidenceBar.tsx   # Confidence score display
│   │   │   ├── DataTable.tsx       # Sortable/filterable data table
│   │   │   ├── EvidenceBadge.tsx   # Evidence citation badges
│   │   │   ├── ErrorState.tsx      # Error state component
│   │   │   ├── FilterBar.tsx       # Reusable filter bar
│   │   │   ├── IntelligenceFeed.tsx # Intelligence timeline feed
│   │   │   └── LoadingState.tsx   # Loading state component
│   │   ├── intelligence-os/        # 25 Intelligence OS components
│   │   │   ├── command-center.tsx  # Cross-account intelligence command center
│   │   │   ├── intelligence-operations-center.tsx # Operations overview
│   │   │   ├── company-workspace.tsx # Company intelligence workspace
│   │   │   ├── knowledge-workspace.tsx # Knowledge & capabilities workspace
│   │   │   ├── capability-workspace.tsx # Capability deep-dive workspace
│   │   │   ├── intelligence-briefing.tsx # Intelligence briefing view
│   │   │   ├── intelligence-search.tsx # Semantic intelligence search
│   │   │   ├── evidence-chain.tsx  # Evidence visualization
│   │   │   ├── confidence-indicator.tsx # Confidence metrics
│   │   │   └── ...                 # activation-workspace, action-queue, narrative, etc.
│   │   ├── shared/                 # Design system, AI chat, utilities
│   │   │   ├── enterprise-theme.ts    # Design tokens (colors, spacing, glass effects)
│   │   │   ├── design-system.tsx       # EmptyState, ScoreGauge, ScoreTriple, SkeletonGrid, etc.
│   │   │   ├── command-palette.tsx    # Global command palette (Cmd+K)
│   │   │   ├── ai-chat-sidebar.tsx   # AI copilot chat sidebar
│   │   │   ├── ai-chat-button.tsx    # Floating AI chat button
│   │   │   ├── tag-manager.tsx        # Tag management component
│   │   │   ├── enterprise-components.tsx # Additional enterprise components
│   │   │   └── custom-field-renderer.tsx # Dynamic field renderer
│   │   ├── app-shell.tsx          # Main app shell (sidebar + content area)
│   │   ├── error-boundary.tsx      # React error boundary wrapper
│   │   ├── providers.tsx           # Client-side provider composition
│   │   └── onboarding-flow.tsx    # User onboarding flow
│   │
│   ├── lib/
│   │   ├── engines/                # 7-engine AI architecture (8 files)
│   │   │   ├── index.ts            # Barrel export — import engines from here
│   │   │   ├── model-router.ts     # Tiered LLM routing (Deep/Smart/Fast) with fallback
│   │   │   ├── grounding-engine.ts # Evidence chain builder with [En] citations + confidence
│   │   │   ├── retrieval-engine.ts # Local semantic search (@xenova/transformers + TF-IDF)
│   │   │   ├── synthesis-engine.ts # Evidence-grounded briefs (1200-2000 words)
│   │   │   ├── scoring-engine.ts   # Revenue Intelligence Score (explainable, decomposed)
│   │   │   ├── action-engine.ts    # Next-best-action + sales motion recommendations
│   │   │   └── conversation-engine.ts # Persona-aware meeting prep + conversation planning
│   │   ├── intelligence-sources/    # 45 files: signal connectors + intelligence modules
│   │   │   ├── connectors/         # Data source connectors
│   │   │   │   ├── csv-connector.ts    # CSV file import
│   │   │   │   ├── excel-connector.ts  # Excel file import
│   │   │   │   ├── rss-connector.ts    # RSS feed monitoring
│   │   │   │   └── website-connector.ts # Website content extraction
│   │   │   ├── website-monitor/    # Website change detection engine
│   │   │   ├── people-enrichment/  # People data enrichment engine
│   │   │   ├── competitive-intel/ # Competitive intelligence engine
│   │   │   ├── base-connector.ts   # Abstract connector interface
│   │   │   ├── knowledge-fabric.ts   # Knowledge graph management
│   │   │   ├── evidence-adapter.ts # Evidence normalization + storage
│   │   │   ├── confidence-engine.ts  # Multi-signal confidence scoring
│   │   │   ├── freshness-manager.ts   # Signal freshness tracking + decay
│   │   │   ├── signal-creator.ts   # Signal creation + validation
│   │   │   └── ...                 # 30+ additional intelligence source modules
│   │   ├── data-intelligence/      # Data quality pipeline (8 files)
│   │   │   ├── engine.ts           # Main data intelligence orchestrator
│   │   │   ├── validator.ts        # Input validation
│   │   │   ├── normalizer.ts       # Data normalization
│   │   │   ├── deduplicator.ts     # Entity deduplication
│   │   │   ├── quality-scorer.ts   # Data quality scoring
│   │   │   ├── column-detector.ts  # Auto-detect column semantics
│   │   │   ├── correction-suggester.ts # Auto-correction suggestions
│   │   │   └── config-store.ts     # Data intelligence configuration
│   │   ├── research-engine/        # Signal analysis (10 files)
│   │   │   ├── researcher.ts       # Main research orchestrator
│   │   │   ├── signals.ts          # Signal detection + classification
│   │   │   ├── evidence.ts         # Evidence collection + management
│   │   │   ├── signal-meaning.ts   # Signal interpretation engine
│   │   │   ├── evidence-quality.ts # Evidence quality assessment
│   │   │   ├── freshness-indicators.ts # Freshness signal indicators
│   │   │   ├── signal-sequence-engine.ts # Signal sequencing + patterns
│   │   │   ├── opportunity-recommendation-engine.ts # Opportunity scoring
│   │   │   ├── signal-capability-matching.ts # Signal-to-capability matching
│   │   │   └── signal-lifecycle.ts # Signal lifecycle management
│   │   ├── revenue-intelligence/   # Revenue scoring + recommendations (12 files)
│   │   │   ├── account-scoring.ts  # Account revenue scoring
│   │   │   ├── account-brief.ts    # Account intelligence brief
│   │   │   ├── brief-generator.ts  # Brief generation engine
│   │   │   ├── signal-extraction.ts # Signal extraction from data
│   │   │   ├── signal-patterns.ts  # Revenue signal pattern detection
│   │   │   ├── recommendation-generator.ts # Action recommendation engine
│   │   │   ├── opportunity-radar.ts # Opportunity detection + radar
│   │   │   ├── executive-recommendations.ts # Executive-level recommendations
│   │   │   └── index.ts            # Barrel export
│   │   ├── scoring/                # Sub-engines for specialized scoring (5 files)
│   │   │   ├── opportunity-probability-engine.ts # Win probability scoring
│   │   │   ├── revenue-opportunity-engine.ts  # Revenue opportunity sizing
│   │   │   ├── contact-influence-engine.ts    # Contact influence scoring
│   │   │   ├── buying-intent-engine.ts        # Buying intent detection
│   │   │   └── freshness-ranking.ts           # Freshness-based ranking
│   │   ├── ai-copilot/             # AI orchestration layer (3 files)
│   │   │   ├── quality-gates.ts   # Pre/post-generation quality validation
│   │   │   ├── usage-tracker.ts    # AI usage + cost tracking
│   │   │   └── types.ts            # AI copilot type definitions
│   │   ├── intelligence-api/       # API middleware for intelligence routes (5 files)
│   │   │   ├── guard.ts            # Intelligence API auth guard
│   │   │   ├── handler.ts          # Request handler wrapper
│   │   │   ├── middleware.ts       # Intelligence API middleware
│   │   │   ├── validators.ts       # Input validation schemas
│   │   │   └── types.ts            # API type definitions
│   │   ├── workflow-engine/        # Background task queue (4 files)
│   │   │   ├── queue.ts            # In-memory task queue
│   │   │   ├── processor.ts        # Task processor
│   │   │   ├── retry.ts           # Retry logic with backoff
│   │   │   └── index.ts           # Barrel export
│   │   ├── data-import/            # Data import pipeline (1 file + tests)
│   │   │   └── pipeline.ts        # CSV/Excel import, validation, normalization
│   │   ├── account-prioritization/ # Account prioritization engine (1 file + tests)
│   │   │   └── engine.ts           # Multi-factor account ranking
│   │   │
│   │   ├── ai-config.ts            # AI provider configuration (keys, fallback chain)
│   │   ├── ai-governance.ts        # AI governance layer (confidence gates, hallucination prevention)
│   │   ├── llm-client.ts           # Unified LLM client (THE entry point for all AI calls)
│   │   ├── ai-reliability.ts      # AI reliability metrics + tracking
│   │   ├── ai-evidence-framework.ts # Evidence framework types + utilities
│   │   ├── ai-cache-layer.ts       # AI response caching
│   │   ├── ai-insight-service.ts   # AI insight CRUD service
│   │   ├── ai-insight-types.ts     # AI insight type definitions
│   │   ├── db.ts                   # Prisma client singleton (PostgreSQL/SQLite)
│   │   ├── api-auth.ts             # API authentication guard (checkApiAuth, requireAdminRole)
│   │   ├── auth-helpers.ts         # CSRF, session, security headers, rate limiting (Edge-compatible)
│   │   ├── session.ts              # Session management (getCurrentSession)
│   │   ├── otp.ts                  # OTP generation + verification
│   │   ├── otp-cache.ts            # OTP in-memory cache
│   │   ├── csrf.ts                 # CSRF token generation
│   │   ├── validate-env.ts         # Zod-based environment validation at startup
│   │   ├── logger.ts               # Structured JSON logger (dev: colored console, prod: JSON)
│   │   ├── correlation-id.ts       # Request correlation ID management
│   │   ├── nav-config.ts           # Sidebar navigation configuration (3 sections)
│   │   ├── screen-map.tsx          # Screen registry (lazy-loaded + ErrorBoundary per screen)
│   │   ├── store.ts                # Zustand global state store
│   │   ├── embeddings.ts           # @xenova/transformers local embeddings
│   │   ├── vector-index.ts         # Vector similarity search
│   │   ├── source-reliability.ts   # Source reliability hierarchy weights
│   │   ├── intelligence-contract.ts # Research context contract types
│   │   ├── intelligence-types.ts   # Intelligence domain types
│   │   ├── intelligence-confidence.ts # Confidence calculation utilities
│   │   ├── intelligence-health.ts  # Intelligence system health monitoring
│   │   ├── intelligence-validation.ts # Intelligence data validation
│   │   ├── intelligence-pipeline.ts # Intelligence processing pipeline
│   │   ├── intelligence-delta-service.ts # Intelligence change detection
│   │   ├── intelligence-narrative-service.ts # Narrative generation
│   │   ├── signal-types.ts         # Signal type definitions
│   │   ├── signal-validation.ts    # Signal validation rules
│   │   ├── audit.ts                # Audit logging
│   │   ├── audit-logger.ts         # Structured audit logger
│   │   ├── password.ts             # Password hashing (bcrypt)
│   │   ├── email-generation.ts     # AI email generation
│   │   ├── email-intelligence-engine.ts # Email content intelligence
│   │   ├── email-tracking.ts       # Email tracking (open/click)
│   │   ├── email-verification.ts   # Email verification
│   │   ├── email-validator.ts     # Email format validation
│   │   ├── email-provider.ts      # Email provider abstraction (Nodemailer/Resend)
│   │   ├── rate-limit.ts           # Per-route rate limiting
│   │   ├── sanitize.ts             # Input sanitization
│   │   ├── validations.ts          # Shared validation utilities
│   │   ├── pagination.ts           # Cursor/offset pagination helpers
│   │   ├── api-middleware.ts       # API middleware composition
│   │   ├── apiHelpers.ts           # API response helpers
│   │   ├── fetchApi.ts             # Client-side fetch wrapper
│   │   ├── utils.ts                # cn() utility (clsx + tailwind-merge)
│   │   ├── date.ts                 # Date formatting utilities
│   │   ├── constants.ts            # App-wide constants
│   │   ├── events.ts               # Event bus types
│   │   ├── event-bus.ts            # In-process event bus
│   │   ├── lead-scoring.ts          # Lead scoring service
│   │   ├── lead-workflow.ts        # Lead status workflow
│   │   ├── company-matcher.ts      # Company entity resolution
│   │   ├── doc-parsers.ts          # Document parsing (PDF, DOCX)
│   │   ├── timer-registry.ts       # Timer cleanup for hot-reload + shutdown
│   │   ├── batch-progress.ts       # Batch job progress tracking
│   │   ├── unsubscribe.ts          # Email unsubscribe handling
│   │   ├── knowledge-ingestion-pipeline.ts # Knowledge ingestion
│   │   ├── icp-config.ts           # Ideal Customer Profile configuration
│   │   ├── scoring-config.ts       # Scoring engine configuration
│   │   ├── types.ts                # Shared TypeScript types
│   │   └── ...                     # 40+ additional modules
│   │
│   ├── hooks/                      # React hooks (3 files)
│   │   ├── use-realtime.ts         # Real-time data polling
│   │   ├── use-mobile.ts           # Mobile viewport detection
│   │   └── use-toast.ts            # Toast notification hook
│   │
│   ├── providers/                   # React context providers (2 files)
│   │   ├── auth-provider.tsx       # NextAuth session provider
│   │   └── query-provider.tsx      # TanStack React Query provider
│   │
│   ├── types/                       # TypeScript declarations (1 file)
│   │   └── nodemailer.d.ts         # Nodemailer type augmentations
│   │
│   ├── data/                        # Chunked lead data files (9 JSON files)
│   ├── middleware.ts                # Edge middleware: security headers, CSRF, path blocking
│   ├── instrumentation.ts          # Node.js startup: Sentry init, env validation, graceful shutdown
│   └── proxy.ts                    # Development proxy configuration
│
├── prisma/
│   └── schema.prisma               # 2,935 lines — 75 models
│
├── tests/                           # Integration + E2E tests
├── scripts/                          # Build + deployment scripts
├── eslint-rules/                     # Custom ESLint rules
│   └── no-ungoverned-llm.js        # Governance rule: blocks direct LLM calls
├── docs/                             # Documentation (this file, ARCHITECTURE.md, ADR.md)
├── vitest.config.ts                 # Vitest 4 configuration
├── eslint.config.mjs                # ESLint 9 flat config
├── tsconfig.json                    # TypeScript 5 strict config
└── package.json                      # Dependencies + scripts
```

---

## 3. Module Ownership Map

Where to make changes for each domain. **Read the files listed before modifying.**

| Domain | File(s) | Purpose | What to avoid |
|--------|---------|---------|---------------|
| **Authentication** | `src/lib/auth-helpers.ts`, `src/lib/session.ts`, `src/lib/otp.ts`, `src/lib/otp-cache.ts`, `src/lib/password.ts`, `src/app/api/auth/*` | OTP email login, session cookie management, CSRF protection, Edge-compatible rate limiting | Don't bypass auth guards. Don't remove `timingSafeEqual` for CSRF. Don't hardcode secrets. |
| **Authorization** | `src/lib/api-auth.ts` (`checkApiAuth`, `requireAdminRole`), `src/middleware.ts` | Route protection, admin role gates, CSRF defense-in-depth | Don't skip `checkApiAuth()` in new API routes. Don't remove CSRF validation from middleware. |
| **AI Configuration** | `src/lib/ai-config.ts`, `src/lib/ai-governance.ts` | LLM provider setup, API key encryption (AES-256-GCM), fallback chain, governance checks | Don't add unencrypted API keys. Don't bypass `governedAI()` wrapper. Don't add providers without allowlist in `baseUrl` validation. |
| **AI Client** | `src/lib/llm-client.ts` (595 lines) | **THE** single entry point for all LLM calls. Provides `callLLM`, `callAI`, `revenueLLMCall`, `webSearch` | Don't import from any other LLM caller. Don't call `fetch()` to AI providers directly. |
| **AI Engines** | `src/lib/engines/*.ts` (8 files) | 7-engine composable architecture: ModelRouter → Grounding → Retrieval → Synthesis/Scoring/Action/Conversation | Don't break the non-throwing contract (`{ success, error, ... }`). Don't add new engines without updating `index.ts` barrel export. |
| **AI Governance** | `src/lib/ai-governance.ts`, `src/lib/ai-copilot/quality-gates.ts` | Confidence gates, hallucination prevention, evidence grounding, audit trail | Don't produce AI output without governance checks. The ESLint rule `no-ungoverned-llm` enforces this at CI. |
| **Intelligence Sources** | `src/lib/intelligence-sources/*.ts` (45 files) | Signal connectors (CSV, Excel, RSS, Website), evidence pipeline, confidence scoring, knowledge fabric | Don't add sources without validation. Don't skip `base-connector.ts` interface. |
| **Retrieval** | `src/lib/engines/retrieval-engine.ts`, `src/lib/embeddings.ts`, `src/lib/vector-index.ts` | Local semantic search with @xenova/transformers (384-dim embeddings), TF-IDF fallback | Don't use external vector databases (Pinecone, Weaviate). Don't change embedding model without reindexing. |
| **Data Import** | `src/lib/data-import/pipeline.ts`, `src/lib/data-intelligence/*.ts` (8 files), `src/app/api/data-import/*` | CSV/Excel import, validation, normalization, deduplication, quality scoring | Don't skip validation steps. Don't import without running through `data-intelligence/engine.ts`. |
| **Database** | `prisma/schema.prisma` (2,935 lines, 75 models), `src/lib/db.ts` | Data access layer via Prisma ORM. PostgreSQL (Neon/Vercel) or SQLite (local dev). | Don't modify schema without creating a migration (`npx prisma migrate dev`). Don't use raw SQL without a comment explaining why. |
| **Middleware** | `src/middleware.ts` (Edge Runtime) | Security headers (CSP, HSTS, X-Frame-Options), CSRF token refresh, malicious path blocking, correlation ID | Don't weaken CSP. Don't disable CSRF validation. Don't add blocking I/O (no DB calls in Edge). |
| **Environment** | `src/lib/validate-env.ts` (Zod schema), `src/instrumentation.ts` | Startup validation — production exits on missing required vars. Sentry init. Graceful shutdown. | Don't remove required vars from Zod schema. Don't suppress validation errors in production. |
| **UI Screens** | `src/components/screens/*.tsx` (75 screens, ~52,000 lines) | Page-level components, each lazy-loaded with per-screen ErrorBoundary | Don't use hardcoded hex colors — use `enterprise-theme.ts` tokens. Don't skip loading/error states. |
| **Intelligence OS** | `src/components/intelligence-os/*.tsx` (25 components) | New-generation intelligence UI: command center, workspaces, evidence chain, progressive disclosure | Don't duplicate design-system components. Use `design-tokens.ts` for Intelligence OS styling. |
| **Design System** | `src/components/shared/enterprise-theme.ts`, `src/components/shared/design-system.tsx` | Color tokens, glass-morphism, spacing scale, EmptyState, ScoreGauge, ScoreTriple, SkeletonGrid, TrendIndicator, Sparkline | Don't add one-off styles that bypass the design system. Don't introduce new colors without adding to `enterprise-theme.ts`. |
| **Enterprise Components** | `src/components/enterprise/*.tsx` (10 components) | AIInsightCard, ConfidenceBar, DataTable, EvidenceBadge, LoadingState, ErrorState, FilterBar, IntelligenceFeed, AIProgressTracker | Don't duplicate these in screen files. Import and compose them. |
| **API Routes** | `src/app/api/{domain}/route.ts` (224 route files) | Backend endpoints — all use Next.js Route Handlers | Don't skip `checkApiAuth()`. Don't return non-JSON responses. Use consistent `{ success, error?, data? }` format. |
| **Logging** | `src/lib/logger.ts`, `src/lib/correlation-id.ts`, `src/lib/audit-logger.ts` | Structured JSON logging (prod) / colored console (dev). Child loggers with context. Request-level correlation IDs. | Don't log secrets, API keys, or PII. Don't use `console.log` directly — use `logger.*`. |
| **Navigation** | `src/lib/nav-config.ts` (3 sections: INTELLIGENCE, WORKSPACES, ADMINISTRATION), `src/lib/screen-map.tsx` (lazy registry) | Sidebar nav structure, screen-to-component mapping, ErrorBoundary wrapping | Don't add screens without registering in `screen-map.tsx`. Don't add nav items without adding to `nav-config.ts`. |
| **State Management** | `src/lib/store.ts` (Zustand), `src/providers/query-provider.tsx` (React Query) | Global UI state (selected company/contact, active screen) + server state caching | Don't put server data in Zustand — use React Query. Keep Zustand for UI-only state. |
| **Testing** | `vitest.config.ts`, `tests/`, `src/**/__tests__/` | Vitest 4 + Testing Library + jsdom | Don't add tests that import non-existent modules (see excluded list in vitest.config.ts). |

---

## 4. Common Tasks

### Adding a New API Endpoint

1. **Create route file** at `src/app/api/{domain}/route.ts`
2. **Add auth guard:**
   ```typescript
   import { checkApiAuth } from '@/lib/api-auth'

   export async function POST(request: Request) {
     const { session, errorResponse } = await checkApiAuth()
     if (errorResponse) return errorResponse
     // session.user is available
   }
   ```
3. **Export named handlers:** `GET`, `POST`, `PUT`, `DELETE`
4. **Add Zod validation** for input body/query parameters
5. **Use Prisma** for database access: `import { db } from '@/lib/db'`
6. **Return JSON** with consistent format:
   ```typescript
   // Success
   return NextResponse.json({ success: true, data: result })
   // Error
   return NextResponse.json({ success: false, error: 'Description' }, { status: 400 })
   ```
7. **Use logger** for server-side logging: `import { logger } from '@/lib/logger'`

### Adding a New Screen

1. **Create component** at `src/components/screens/{name}-screen.tsx`:
   ```typescript
   'use client'
   // Use enterprise-theme tokens for ALL styling
   import { gold, glassPanel, spacing, cls } from '@/components/shared/enterprise-theme'
   import { SkeletonGrid } from '@/components/shared/design-system'

   export default function NewScreen() {
     return (
       <div className={spacing.screenPadding}>
         {/* Content */}
       </div>
     )
   }
   ```
2. **Register in `src/lib/screen-map.tsx`:**
   ```typescript
   const NewScreen = lazy(() => import('@/components/screens/new-screen'))
   // Add to SCREEN_MAP:
   'new-screen': withScreenErrorBoundary(NewScreen, 'new-screen'),
   ```
3. **Add to navigation** in `src/lib/nav-config.ts` under the appropriate section
4. **Use `enterprise-theme.ts` tokens** for ALL styling — NEVER use hardcoded hex colors
5. **Add loading state:** `if (isLoading) return <SkeletonGrid />`
6. **Add error handling:** `try/catch` with fallback UI
7. **Import `useQuery`** from `@tanstack/react-query` for data fetching

### Adding a Database Model

1. **Add model** to `prisma/schema.prisma`
2. **Create migration:**
   ```bash
   npx prisma migrate dev --name descriptive-name
   ```
3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```
4. **Update `docs/ARCHITECTURE.md`** if this is a significant schema change
5. **Add seed data** in relevant seed scripts if needed
6. **Update TypeScript types** in `src/lib/types.ts` if the model is exposed to the API

### Adding an AI Capability

1. **Add prompt template** to `src/lib/llm-client.ts` or the appropriate engine
2. **Use `callLLM()`** from `src/lib/llm-client.ts` (NEVER call providers directly):
   ```typescript
   import { callLLM } from '@/lib/llm-client'
   const result = await callLLM({ prompt, systemPrompt, temperature: 0.3 })
   ```
3. **Wrap with governance** — use `src/lib/ai-governance.ts` checks before generation
4. **Add to engine** or create new module in the appropriate subdirectory
5. **Add evidence grounding:** every AI output must have citations, confidence scores
6. **Follow non-throwing contract:**
   ```typescript
   return { success: true, data: result, confidence: 0.85, error: null }
   // On failure:
   return { success: false, data: null, error: 'Description of failure' }
   ```
7. **Test with mocked LLM responses** — mock `callLLM` in tests

### Debugging Production Issues

1. **Check health endpoints:**
   - `GET /api/health` — application health
   - `GET /api/ready` — readiness check (DB connectivity)
   - `GET /api/version` — deployment version info
   - `GET /api/ping` — liveness probe
2. **Check environment health:** `GET /api/system-health` returns env health report from `validate-env.ts`
3. **Review Sentry error tracking** — configured in `sentry.server.config` and `sentry.client.config`
4. **Check application logs:**
   ```bash
   docker compose logs -f app
   # Or check Vercel logs in dashboard
   ```
5. **Use correlation IDs:** every response includes `x-correlation-id` header — trace through logs
6. **Check AI health:** `GET /api/ai/health` — AI provider connectivity, recent engine runs
7. **Check AI usage:** `GET /api/ai/usage` — token consumption, cost tracking

---

## 5. Design System Reference

### Color Tokens (`src/components/shared/enterprise-theme.ts`)

```typescript
// Primary brand colors
export const gold = 'var(--color-gold-dim, #D4AF37)'       // Primary accent
export const goldLight = 'var(--color-gold, #E8C860)'       // Lighter gold

// Surface tokens
export const card = 'rgba(255, 255, 255, 0.85)'              // Card background (glass)
export const cardSolid = '#FFFFFF'                           // Solid card
export const border = 'rgba(0, 0, 0, 0.08)'                  // Default border
export const borderSubtle = 'rgba(0, 0, 0, 0.04)'            // Subtle border

// Text tokens
export const textPrimary = '#111827'                         // Primary text
export const textSecondary = '#6B7280'                      // Secondary text
export const textMuted = '#9CA3AF'                          // Muted text

// Functional colors (use these, NOT hardcoded hexes)
export const colors = {
  blue: '#3B82F6',    green: '#10B981',   amber: '#F59E0B',
  purple: '#A855F7',  red: '#EF4444',     indigo: '#6366F1',
  cyan: '#06B6D4',    pink: '#EC4899',    teal: '#14B8A6',
  orange: '#F97316',  gold: '#D4AF37',
}
```

### Glass Panel Styles

```typescript
import { glassPanel, glassPanelGold, cardStyles } from '@/components/shared/enterprise-theme'

// Standard glass panel
<div style={glassPanel}>...</div>

// Gold-accented panel (for highlighted content)
<div style={glassPanelGold}>...</div>

// Card variants: cardStyles.default, cardStyles.bordered(color), cardStyles.gold, cardStyles.interactive
```

### Spacing Scale

```typescript
import { spacing } from '@/components/shared/enterprise-theme'

spacing.screenPadding  // 'px-1 pr-1' — outer page padding
spacing.sectionGap     // 'space-y-5' — gap between sections
spacing.cardPadding    // 'p-5' — standard card padding
spacing.compactPadding // 'p-4' — compact card padding
spacing.tightPadding   // 'p-3' — tight card padding
```

### Reusable Components (`src/components/shared/design-system.tsx`)

| Component | Props | Purpose |
|-----------|-------|---------|
| `EmptyState` | `icon, title, description, actionLabel, onAction, secondaryActionLabel, onSecondaryAction` | Rich empty state with icon + actions |
| `ScoreGauge` | `score, size, strokeWidth, label, sublabel, segments[]` | Radial score gauge with breakdown segments |
| `ScoreTriple` | `intelligence, accountPriority, revenueOpportunity` (ScoreItem[]) | 3 side-by-side score gauges |
| `SkeletonGrid` | `cols, panels` | Premium loading skeleton (KPI cards + panels) |
| `TrendIndicator` | `value, period` | ↑ 12% vs last week indicator |
| `Sparkline` | `data, width, height, color` | Tiny inline chart |
| `SortableHeader` | `label, sortKey, currentSort, currentDir, onSort` | Table column sort header |
| `StatusDot` | `status: 'fresh'|'stale'|'old'|'unknown', pulse` | Colored status indicator with optional pulse |
| `getActivityIcon` | `action: string` | Maps action strings to styled icons |

### CSS Utility Classes (`enterprise-theme.ts` `cls` object)

```typescript
import { cls } from '@/components/shared/enterprise-theme'

cls.kpiGrid         // 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4'
cls.kpiGrid3        // 'grid grid-cols-3 gap-4'
cls.kpiGrid4        // 'grid grid-cols-2 lg:grid-cols-4 gap-4'
cls.splitView       // 'grid grid-cols-1 lg:grid-cols-5 gap-4'
cls.sectionTitle    // 'text-sm font-bold text-foreground tracking-tight'
cls.sectionSubtitle // 'text-[11px] text-muted-foreground mt-0.5'
cls.labelCaps       // 'text-[11px] text-muted-foreground uppercase tracking-wider font-medium'
cls.valueXL         // 'text-2xl font-bold tabular-nums text-foreground'
cls.valueMD         // 'text-sm font-bold tabular-nums text-foreground'
cls.scrollContainer // 'max-h-[calc(100vh-200px)] overflow-y-auto pr-1'
```

### Design Rules

> **NEVER** use hardcoded hex colors in screen components. Always import from `enterprise-theme.ts` or use Tailwind theme classes (`text-foreground`, `bg-muted`, etc.).

> **ALWAYS** use `SkeletonGrid` or `<Skeleton>` for loading states. Never show blank screens.

> **ALWAYS** wrap data-fetching screens in `try/catch` with an error fallback.

---

## 6. Testing Guide

### Framework

- **Vitest 4** + **Testing Library** + **jsdom** environment
- Configuration: `vitest.config.ts`
- Path alias: `@/` → `./src/` (matches `tsconfig.json`)

### Running Tests

```bash
npm run test           # Run all tests once
npm run test:watch     # Watch mode (re-run on file change)
```

### Test File Locations

| Location | Purpose |
|----------|---------|
| `tests/*.test.ts` | Integration and E2E tests |
| `src/**/__tests__/*.test.{ts,tsx}` | Unit tests colocated with source |

### Test Patterns

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  db: {
    company: { findMany: vi.fn() },
    // ...
  },
}))

// Mock LLM client
vi.mock('@/lib/llm-client', () => ({
  callLLM: vi.fn().mockResolvedValue({ content: 'mocked' }),
}))

describe('MyModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle the happy path', async () => {
    // Arrange + Act + Assert
    expect(result).toEqual(expected)
  })
})
```

### ESLint Governance Rule

The custom `no-ungoverned-llm` rule (`eslint-rules/no-ungoverned-llm.js`) runs at CI and **blocks any direct LLM provider calls** (raw `fetch()` to AI APIs). All AI calls must go through `src/lib/llm-client.ts`.

### Excluded Tests

Some tests are excluded in `vitest.config.ts` because they reference older API shapes or deleted modules. These are documented in the exclude list with comments. Total: ~121 assertions across 15 files that need rewriting against the current codebase.

---

## 7. Architecture Deep Dives

### AI Request Flow

```
User clicks "Generate Brief"
  → Screen component (React Query)
    → API Route (src/app/api/engines/brief/route.ts)
      → Auth guard (checkApiAuth)
        → Governance check (ai-governance.ts)
          → SynthesisEngine (src/lib/engines/synthesis-engine.ts)
            → GroundingEngine (collects evidence from DB + retrieval)
              → RetrievalEngine (semantic search via @xenova/transformers)
            → ModelRouter (selects Deep/Smart/Fast tier → calls LLM via llm-client.ts)
              → LLM Provider Chain (NVIDIA → Fireworks → Groq → Gemini)
          → SynthesisEngine parses structured output
        → Governance records result (audit trail)
      → API returns { success: true, data: brief, confidence: 0.91 }
    → Screen renders brief with [En] citations
```

### Non-Throwing Engine Contract

Every engine returns this shape. **Never throw from engine code.**

```typescript
interface EngineResult<T> {
  success: boolean
  data: T | null
  error: string | null
  confidence?: number
  metadata?: {
    tokensUsed: number
    modelUsed: string
    tierUsed: 'deep' | 'smart' | 'fast'
    durationMs: number
    evidenceCount: number
  }
}
```

### Authentication Flow

```
User submits email on /login
  → POST /api/auth/request-otp
    → Rate limited (5 per email per minute)
    → Generates 6-digit OTP, stores in otp-cache.ts
    → Sends via Resend email
  → User enters OTP
  → POST /api/auth/verify-otp
    → Validates OTP (timing-safe comparison)
    → Creates session via session.ts
    → Sets dmq_session cookie (httpOnly, secure, sameSite: lax)
  → All subsequent requests:
    → middleware.ts: security headers + CSRF token refresh
    → API routes: checkApiAuth() → session.ts → getCurrentSession()
```

### Path Alias

```json
// tsconfig.json
{
  "paths": { "@/*": ["./src/*"] }
}
```

Use `@/lib/db`, `@/components/shared/enterprise-theme`, etc. **Never** use relative paths like `../../lib/db`.

### Key Conventions

| Convention | Rule |
|------------|------|
| **API responses** | Always `{ success: boolean, error?: string, data?: any }` |
| **Auth guard** | Always call `checkApiAuth()` first in API routes |
| **LLM calls** | Always use `callLLM()` from `src/lib/llm-client.ts` |
| **Styling** | Always use `enterprise-theme.ts` tokens, never hardcoded colors |
| **Screens** | Always register in `screen-map.tsx`, lazy-load with ErrorBoundary |
| **Logging** | Always use `logger.*`, never `console.log` |
| **Database** | Always use Prisma client via `db`, always create migrations |
| **Error handling** | Engines never throw — return `{ success: false, error: "..." }` |

---

## 8. Design Token Migration Guide

> **Status:** Phase A complete (audit & documentation). Phase B (systematic migration) tracked as a future work item.

### 8.1 Audit Summary

An automated scan of `src/` found **~1,827 hardcoded color occurrences** across **68 screens**. These represent violations of the [Key Conventions](#key-conventions) rule: _"Always use `enterprise-theme.ts` tokens, never hardcoded colors."_

| Category | Count | Example Patterns |
|----------|-------|------------------|
| Hex colors (`#xxx`) | 512 | `#0a0c10`, `#0f1219`, `#FFD700` |
| Tailwind arbitrary values | 1,013 | `bg-[#0a0c10]`, `text-[#FFD700]`, `border-[#1e293b]` |
| `rgba()` calls | 302 | `rgba(255,255,255,0.08)`, `rgba(0,0,0,0.5)` |
| **Total** | **1,827** | — |

**42 of 68 screens** (62%) contain at least one hex color.

### 8.2 Top 5 Worst Offenders

| Rank | Screen | Inline Colors | Hex | rgba() |
|------|--------|--------------|-----|--------|
| 1 | `settings-screen.tsx` | 95 | 46 | 49 |
| 2 | `dashboard-screen.tsx` | 80 | 41 | 39 |
| 3 | `knowledge-library-screen.tsx` | 67 | 41 | 26 |
| 4 | `pipeline-screen.tsx` | 57 | 28 | 29 |
| 5 | `capability-screen.tsx` | 44 | 27 | 17 |

### 8.3 Migration Pattern

```tsx
import { enterpriseTheme } from '@/components/shared/enterprise-theme'

// ❌ Before — hardcoded color
style={{ backgroundColor: '#0a0c10' }}

// ✅ After — design token
style={{ backgroundColor: enterpriseTheme.bgBase }}
```

For Tailwind arbitrary values, extract to inline styles using the token:

```tsx
// ❌ Before
<div className="bg-[#0f1219] border border-[rgba(255,255,255,0.08)]">

// ✅ After
<div style={{ backgroundColor: enterpriseTheme.surfaceBase, borderColor: enterpriseTheme.borderSubtle }}>
```

### 8.4 Common Replacement Map

| Hardcoded Value | Token | Semantic Meaning |
|----------------|-------|-----------------|
| `#0a0c10`, `#030308` | `enterpriseTheme.bgBase` | Page background |
| `#0f1219` | `enterpriseTheme.surfaceBase` | Card / panel background |
| `#1e293b` | `enterpriseTheme.surfaceRaised` | Elevated surface |
| `rgba(255,255,255,0.08)` | `enterpriseTheme.borderSubtle` | Subtle borders |
| `#FFD700` | `enterpriseTheme.gold` | Brand accent (gold) |
| `#22c55e` | Positive status token | Success / active |
| `#ef4444` | Negative / error token | Error / danger |
| `#f59e0b` | Warning status token | Warning / caution |

> **Note:** Refer to `src/components/shared/enterprise-theme.ts` for the full token inventory. New semantic tokens should be added there rather than introducing new hardcoded values.

### 8.5 Migration Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase A (WI-14)** | Audit, document findings, establish replacement map | ✅ Complete (this section) |
| **Phase B (Future WI)** | Systematic migration of remaining 63 screens | 🔲 Pending |

**Phase B approach:** Migrate screens top-down from the offenders list above. Each screen should be a single PR. Run the audit script (`scripts/audit-hardcoded-colors.ts` if it exists, or `rg '#[0-9a-fA-F]{3,8}' src/ \| wc -l`) after each PR to track progress.

---

*Last updated: Phase 3 Freeze + WI-14 Productization*
