# DeepMindQ API Reference

> **Version:** 0.2.0 | **Base URL:** `/api` | **Last Updated:** 2025-07
>
> 224 route files across 66 domain directories. All routes return JSON. Built on Next.js App Router (Route Handlers).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Response Formats](#2-response-formats)
3. [Authentication Model](#3-authentication-model)
4. [Rate Limiting](#4-rate-limiting)
5. [Authentication](#5-authentication)
6. [Companies](#6-companies)
7. [Contacts](#7-contacts)
8. [Intelligence](#8-intelligence)
9. [AI](#9-ai)
10. [Leads](#10-leads)
11. [Opportunities](#11-opportunities)
12. [Dashboard](#12-dashboard)
13. [Pipeline](#13-pipeline)
14. [Knowledge](#14-knowledge)
15. [Capabilities](#15-capabilities)
16. [Import & Data](#16-import--data)
17. [Export](#17-export)
18. [Sequences](#18-sequences)
19. [Emails, Drafts, Replies & Bounces](#19-emails-drafts-replies--bounces)
20. [Email Templates](#20-email-templates)
21. [Signals](#21-signals)
22. [Settings & Preferences](#22-settings--preferences)
23. [Admin](#23-admin)
24. [Webhooks & Tracking](#24-webhooks--tracking)
25. [Background Workers](#25-background-workers)
26. [Reports & Analytics](#26-reports--analytics)
27. [Cross-Cutting](#27-cross-cutting)
28. [Utility Endpoints](#28-utility-endpoints)

---

## 1. Overview

DeepMindQ is an AI-powered B2B sales intelligence platform. The REST API serves the frontend UI and supports programmatic access. All routes are defined as Next.js Route Handlers under `src/app/api/`.

| Metric | Value |
|---|---|
| Total route files | 224 |
| Domain directories | 66 |
| Auth mechanism | Session cookies (`dmq_session`) |
| Framework | Next.js 15 App Router |
| ORM | Prisma |
| Validation | Zod + custom schemas |
| AI governance | `governedAICall`, `governedAICallAggregate` |

### Auth Levels

| Level | Symbol | Description |
|---|---|---|
| **Public** | 🌐 | No authentication required |
| **Authenticated** | 🔐 | Valid `dmq_session` cookie required (`checkApiAuth`) |
| **Admin** | 🔑 | Authenticated + `ADMIN` role (`requireAdminRole`) |
| **Cron Secret** | ⏰ | `Authorization: Bearer <CRON_SECRET>` header |
| **Setup Token** | 🔧 | `X-Setup-Token` header matching `SETUP_TOKEN` env var |

---

## 2. Response Formats

### Standard Success (200/201)

```json
{
  "success": true,
  "data": { ... },
  "meta": { "endpoint": "/api/companies", "durationMs": 142 }
}
```

Many routes use the shorthand helpers:

```json
// apiSuccess wrapper
{ "success": true, "data": { ... } }

// Direct NextResponse.json
{ "companies": [...], "pagination": { "page": 1, "limit": 50, "total": 234, "totalPages": 5 } }
```

### Standard Error

```json
{
  "error": "Human-readable error message"
}
```

HTTP status codes: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found), `409` (conflict), `429` (rate limited), `500` (internal error), `503` (service unavailable).

### Rate Limit Error (429)

```json
{
  "error": "Too many requests. Please try again later."
}
```
Includes `Retry-After` header (seconds).

### Intelligence API Envelope

Intelligence routes return a standardized `IntelligenceResponse`:

```json
{
  "companyId": "xxx",
  "data": { ... },
  "meta": {
    "endpoint": "/api/intelligence/company/xxx",
    "durationMs": 340,
    "cached": false,
    "freshness": { "lastEnriched": "2025-07-01T...", "stale": false }
  },
  "errors": []
}
```

---

## 3. Authentication Model

### Session Cookie Auth (`checkApiAuth`)

The primary auth guard. Reads `dmq_session` cookie and validates against the database via `getCurrentSession()`. Returns `{ session, errorResponse }` — if `errorResponse` is set, return it immediately.

```typescript
// Pattern used in ~180 routes
const { errorResponse } = await checkApiAuth();
if (errorResponse) return errorResponse;
```

**Returns 401** when:
- No `dmq_session` cookie
- Session token < 16 characters
- Database session lookup fails
- Session expired or invalid

### Admin Role Gate (`requireAdminRole`)

Two-step auth for admin-only routes:

```typescript
const { session, errorResponse } = await checkApiAuth();
if (errorResponse) return errorResponse;
const adminCheck = requireAdminRole(session!);
if (adminCheck) return adminCheck;
```

### Cron Secret Auth

Used by scheduled jobs (Vercel Cron). Validates `Authorization: Bearer <CRON_SECRET>` header.

### Setup Token Auth

Used for one-time database provisioning. Validates `X-Setup-Token` header against `SETUP_TOKEN` env var.

---

## 4. Rate Limiting

| Scope | Limit | Implementation |
|---|---|---|
| Auth routes (login, register, change-password, set-password) | 5 req/min per IP | `generalApiRateLimit(ip, 'login')` |
| OTP routes (request-otp, verify-otp) | 5 req/min per IP | `otpRateLimit(ip, ...)` |
| Email send | Per-route limit | `emailSendRateLimit()` |
| Intelligence routes | Per-route limit | `utilityGuard()` with `RateLimitedError` |
| AI routes | Per-route limit | `utilityGuard()` with `RateLimitedError` |
| SSE connections | 3 per user | In-memory connection tracking |

Rate limit errors return HTTP 429 with `Retry-After` header.

---

## 5. Authentication

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | Password verification + OTP challenge | Public | Rate limited 5/min. Returns `{ success, message, devCode? }` |
| 2 | POST | `/api/auth/logout` | Destroy session | Public | Clears `dmq_session` cookie |
| 3 | POST | `/api/auth/request-otp` | Request OTP via email | Public | Rate limited. OTP-only login path |
| 4 | POST | `/api/auth/verify-otp` | Verify OTP + create session | Public | Rate limited. Sets `dmq_session` cookie |
| 5 | POST | `/api/auth/register` | Register new user | Public | Rate limited 5/min |
| 6 | GET | `/api/auth/me` | Get current user profile | Authenticated | Returns `{ user }` or 401. No hardcoded fallbacks |
| 7 | PUT | `/api/auth/update-profile` | Update user profile | Authenticated | Name, email, avatar |
| 8 | PUT | `/api/auth/change-password` | Change password | Authenticated | Rate limited 5/min |
| 9 | PUT | `/api/auth/set-password` | Set initial password (OTP→password) | Authenticated | Rate limited 5/min |

---

## 6. Companies

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/companies` | List companies (search, filter, sort, paginate) | Auth | `?search=&industry=&status=&tier=&sortBy=accountPriorityScore&sortOrder=desc&page=1&limit=50&cursor=`. Returns `{ companies, pagination, filters }` |
| 2 | POST | `/api/companies` | Create company | Auth | Body: `{ name, domain, industry, employeeSize, location, country, website }`. Returns 409 on duplicate |
| 3 | POST | `/api/companies/enrich` | AI enrichment (web search → research card) | Auth | Triggers external intelligence pipeline |
| 4 | GET | `/api/companies/mind-map` | Mind map visualization data | Auth | Returns nodes + edges for company relationships |
| 5 | GET | `/api/companies/meta` | Metadata (filter options, stats) | Auth | Available tiers, statuses, industries |
| 6 | POST | `/api/companies/compare` | Compare multiple companies side-by-side | Auth | Body: `{ companyIds[] }` |
| 7 | POST | `/api/companies/bulk` | Bulk create/update companies | Auth | Batch operation |
| 8 | GET | `/api/companies/stats` | Company aggregate statistics | Auth | Count by tier, status, industry |
| 9 | POST | `/api/companies/refresh-scores` | Recalculate all company scores | Auth | Triggers score recalculation pipeline |
| 10 | GET | `/api/companies/[id]` | Get single company detail | Auth | Full company object with counts |
| 11 | PUT | `/api/companies/[id]` | Update company | Auth | Partial update |
| 12 | DELETE | `/api/companies/[id]` | Delete company | Auth | Soft or hard delete |
| 13 | GET | `/api/companies/[id]/contacts` | List company contacts | Auth | Paginated contact list |
| 14 | GET | `/api/companies/[id]/signals` | List company signals | Auth | Filtered by type, severity, status |
| 15 | DELETE | `/api/companies/[id]/signals/[signalId]` | Delete signal | Auth | |
| 16 | GET | `/api/companies/[id]/timeline` | Company activity timeline | Auth | Chronological activity feed |
| 17 | GET | `/api/companies/[id]/brief` | AI-generated company brief | Auth | Executive summary |
| 18 | GET | `/api/companies/[id]/scores` | Company scores overview | Auth | All score dimensions |
| 19 | GET | `/api/companies/[id]/score` | Single score detail | Auth | Detailed breakdown |
| 20 | GET | `/api/companies/[id]/actions` | Recommended actions | Auth | AI-generated action items |
| 21 | GET | `/api/companies/[id]/intelligence` | Full intelligence profile | Auth | Composed view |
| 22 | GET | `/api/companies/[id]/alignment` | Capability alignment | Auth | Match score against capabilities |
| 23 | GET | `/api/companies/[id]/notes` | Company notes | Auth | Paginated |
| 24 | POST | `/api/companies/[id]/notes` | Create company note | Auth | |
| 25 | DELETE | `/api/companies/[id]/notes/[noteId]` | Delete note | Auth | |
| 26 | POST | `/api/companies/[id]/feedback` | Submit intelligence feedback | Auth | Signal/insight feedback |

---

## 7. Contacts

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/contacts` | List contacts (search, filter, sort, paginate) | Auth | `?search=&status=&emailHealth=&roleBucket=&companyId=&sortBy=name&sortDir=asc&page=1&pageSize=20` |
| 2 | POST | `/api/contacts` | Create contact | Auth | Validated via `createContactSchema` |
| 3 | GET | `/api/contacts/[id]` | Get contact detail | Auth | Full contact with company |
| 4 | PUT | `/api/contacts/[id]` | Update contact | Auth | Partial update |
| 5 | DELETE | `/api/contacts/[id]` | Delete contact | Auth | |
| 6 | GET | `/api/contacts/[id]/timeline` | Contact activity timeline | Auth | Chronological feed |
| 7 | POST | `/api/contacts/[id]/generate-email` | AI email draft for contact | Auth | Context-aware generation |
| 8 | GET | `/api/contacts/[id]/briefing` | Contact briefing | Auth | AI-prepared meeting brief |
| 9 | GET | `/api/contacts/[id]/notes` | Contact notes | Auth | |
| 10 | POST | `/api/contacts/[id]/notes` | Create contact note | Auth | |
| 11 | GET | `/api/contacts/person-profile` | People profile lookup | Auth | Enriched profile data |
| 12 | GET | `/api/contacts/relationship-map` | Relationship visualization | Auth | Network graph data |
| 13 | GET | `/api/contacts/engagement-prediction` | Engagement likelihood score | Auth | ML-based prediction |

---

## 8. Intelligence

The intelligence domain is the core AI engine with ~31 routes covering external intelligence, internal memory, scoring, and analytics.

### Core Intelligence

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/intelligence/company/[id]` | **Primary product API** — unified company intelligence | Auth | `?include=signals,scores,contacts,timeline,actions,brief,knowledge,mindmap`. Composes all engines via `Promise.allSettled` |
| 2 | GET | `/api/intelligence/opportunity/[id]` | Opportunity intelligence | Auth | `?include=scores,fusion,actions`. Win probability + fusion matches |
| 3 | GET | `/api/intelligence/action/[id]` | Recommended actions + learning | Auth | `?include=recommendations,sequences,learning` |
| 4 | GET | `/api/intelligence/conversation/[id]` | Conversation briefing + learning | Auth | `?include=learning` |
| 5 | GET | `/api/intelligence/brief/[id]` | Evidence-grounded brief | Auth | `?briefType=account_brief\|deal_strategy\|exec_summary\|contact_brief\|opportunity_brief&depth=standard\|deep` |
| 6 | GET | `/api/intelligence/grounding/[id]` | Evidence chain with confidence | Auth | `?maxEvidence=50&includeStale=true` |
| 7 | GET | `/api/intelligence/retrieval/[id]` | Semantic knowledge search | Auth | `?q=&topK=5&filter=capability_asset\|ai_insight\|company_signal` |
| 8 | GET | `/api/intelligence/reasoning/[id]` | Full 30-step reasoning context | Auth | Win probability, cost metrics, confidence scores |
| 9 | GET | `/api/intelligence/mindmap/[id]` | Intelligence mind map | Auth | Nodes + edges from contacts, capabilities, signals |
| 10 | GET | `/api/intelligence/knowledge/[id]` | Company knowledge view | Auth | `?include=ingestion` |

### Enrichment & Collection

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 11 | POST | `/api/intelligence/enrich` | Enrich single company | Auth | Web search → signal extraction → evidence → research card |
| 12 | POST | `/api/intelligence/enrich-batch` | Batch enrich companies | Auth | Job tracking with progress |
| 13 | GET | `/api/intelligence/enrich-batch` | Batch pipeline stats | Auth | |
| 14 | POST | `/api/intelligence/collect-external` | External intelligence collection | Auth | Web search → evidence → signals |
| 15 | POST | `/api/intelligence/competitive` | Competitive intelligence | Auth | Competitor name or full scan |
| 16 | POST | `/api/intelligence/people-enrich` | Enrich contact profiles | Auth | Contact or company level |
| 17 | POST | `/api/intelligence/website-monitor` | Detect website changes | Auth | Web monitoring |

### Scoring & Reasoning

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 18 | POST | `/api/intelligence/full-pipeline` | **20-stage intelligence orchestrator** | Auth | Phase A (external) + Phase B (internal matching). The core pipeline |
| 19 | GET | `/api/intelligence/full-pipeline` | Pipeline status | Auth | `?companyId=xxx` |
| 20 | POST | `/api/intelligence/unified` | "What do we know about this company?" | Auth | Combines external + internal + people intelligence |
| 21 | POST | `/api/intelligence/internal-memory` | Extract internal CRM intelligence | Auth | Notes, meetings, timeline, human intel |
| 22 | POST | `/api/intelligence/capability-pipeline` | Internal capability pipeline | Auth | Modes: ingest, bulk-ingest, match-signal, generate-opportunity, win-probability |
| 23 | GET | `/api/intelligence/capability-pipeline` | Capability pipeline status/search | Auth | |
| 24 | GET | `/api/intelligence/sprint3` | Sprint 3 unified pipeline | Auth | Modes: unified_query, internal_memory, people_change, actions, meeting_prep, next_best_action |

### Analytics & Monitoring

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 25 | GET | `/api/intelligence/deltas` | "What changed since I last looked?" | Auth | `?limit=20&companyId=&minMagnitude=3` |
| 26 | POST | `/api/intelligence/deltas` | Capture snapshot for delta tracking | Auth | |
| 27 | GET | `/api/intelligence/narratives` | Intelligence narratives with evidence chains | Auth | `?limit=10&companyId=&minConfidence=0&minSeverity=high` |
| 28 | GET | `/api/intelligence/predictions` | AI predictions from signals | Auth | |
| 29 | GET | `/api/intelligence/correlations` | Signal correlation detection | Auth | Cross-signal analysis |
| 30 | GET | `/api/intelligence/cross-account` | Cross-account pattern detection | Auth | Multi-account intelligence |
| 31 | GET | `/api/intelligence/stats` | Pipeline statistics | Auth | |

### Refresh & Feedback

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 32 | GET | `/api/intelligence/refresh` | Freshness status | Auth | Companies needing refresh |
| 33 | POST | `/api/intelligence/refresh` | Trigger intelligence refresh | Auth | |
| 34 | POST | `/api/intelligence/monitor` | Run live monitoring checks | Auth | Autonomous monitoring |
| 35 | GET | `/api/intelligence/monitor` | Read persisted alerts | Auth | WI-3 alert system |
| 36 | PATCH | `/api/intelligence/monitor` | Alert lifecycle (acknowledge/resolve/dismiss) | Auth | |
| 37 | POST | `/api/intelligence/feedback` | Record signal feedback | Auth | Learning loop input |
| 38 | GET | `/api/intelligence/feedback` | Get learning insights | Auth | Computed from feedback |
| 39 | GET | `/api/intelligence/action-history` | Action history for a company | Auth | `?companyId=` |

---

## 9. AI

AI-assisted features with ~31 routes for scoring, generation, insights, chat, and governance.

### Scoring & Generation

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | POST | `/api/ai/score-contacts` | Score contact influence | Auth | Body: `{ contactId }` or `{ companyId }` |
| 2 | POST | `/api/ai/score-leads` | Score leads with evidence-linked decomposition | Auth | Wave 8A: evidence-linked scoring |
| 3 | POST | `/api/ai/score-opportunities` | Score opportunity win probability | Auth | Body: `{ opportunityId }` or `{ scoreAll: true }` |
| 4 | POST | `/api/ai/revenue-score` | Revenue opportunity scoring | Auth | Multi-dimension scoring |
| 5 | POST | `/api/ai/generate` | AI email draft generation | Auth | Body: `{ name, email, company, context, tone }` |
| 6 | GET | `/api/ai/insights` | Platform-wide AI insights | Auth | Cached 5 min. Positive/negative/neutral/action insights |
| 7 | POST | `/api/ai/summarize` | Summarize company/contact data | Auth | AI-generated summaries |

### Briefings & Recommendations

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 8 | POST | `/api/ai/account-brief` | VP Sales-ready executive brief | Auth | Web research + governed AI |
| 9 | GET | `/api/ai/buying-intent` | Score buying intent signals | Auth | Body: `{ companyId }` |
| 10 | GET | `/api/ai/contact-engagement` | Contact engagement analysis | Auth | `?companyId=` |
| 11 | POST | `/api/ai/contact-intelligence` | Contact intelligence scoring | Auth | Wave 5.1 |
| 12 | POST | `/api/ai/conversation-plan` | AI conversation plan | Auth | Meeting preparation |
| 13 | GET | `/api/ai/conversation-studio` | Evidence-backed meeting preparation | Auth | `?companyId=&contactId=&pursuitId=` |
| 14 | GET | `/api/ai/deal-coaching` | Stage-specific deal coaching | Auth | `?companyId=&stage=` |
| 15 | GET | `/api/ai/deal-risk` | Deal risk assessment | Auth | `?companyId=` |
| 16 | POST | `/api/ai/email-intelligence` | Email recommendations with evidence | Auth | `?contactId=` |
| 17 | GET | `/api/ai/recommendations` | Cross-sell/up-sell recommendations | Auth | AI-generated |
| 18 | POST | `/api/ai/relationship-memory` | Relationship memory analysis | Auth | 943-line comprehensive relationship engine |
| 19 | GET | `/api/ai/suggested-contacts` | Suggest new contacts for company | Auth | Web research + AI |

### Chat & Signals

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 20 | POST | `/api/ai/chat` | AI chat endpoint | Auth | Multi-turn conversation with governed AI |
| 21 | GET | `/api/ai/signals` | AI signal discovery | Auth | Web search + AI extraction |
| 22 | POST | `/api/ai/enrich` | AI company enrichment | Auth | Governed AI enrichment |
| 23 | POST | `/api/ai/freshness` | Run freshness scan | Auth | Signal lifecycle management |
| 24 | GET | `/api/ai/freshness` | Freshness statistics | Auth | |

### Governance, Health & Opportunities

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 25 | GET | `/api/ai/health` | AI quality metrics | Auth | Wave 8.3 health center |
| 26 | GET | `/api/ai/governance/check` | AI governance introspection | Auth | Registered types, thresholds, audit entries, model router health |
| 27 | GET | `/api/ai/usage` | AI usage dashboard | Auth | `?days=30`. Cost, tokens, by feature/model. 5-min cache |
| 28 | GET | `/api/ai/reliability` | AI engine reliability metrics | Auth | Quality metrics from reliability layer |
| 29 | GET | `/api/ai/opportunities` | Opportunity radar | Auth | `?status=&priority=&page=`. Returns `{ opportunities, stats }` |
| 30 | POST | `/api/ai/opportunities/[id]/accept` | Accept opportunity → create Pursuit | Auth | |
| 31 | POST | `/api/ai/opportunities/[id]/reject` | Reject opportunity with reason | Auth | |
| 32 | GET | `/api/ai/query` | Natural language query | Auth | AI-powered data query |

---

## 10. Leads

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/leads` | List leads (DB + static JSON fallback) | Auth | `?source=db\|excel&search=&page=&limit=` |
| 2 | POST | `/api/leads` | Create lead | Auth | |
| 3 | POST | `/api/leads/assign` | Assign lead to user | Auth | |
| 4 | POST | `/api/leads/dedup` | Deduplicate leads | Auth | |
| 5 | GET | `/api/leads/export` | Export leads | Auth | CSV/JSON export |
| 6 | POST | `/api/leads/lookalike` | Find lookalike leads | Auth | AI-based similarity matching |
| 7 | POST | `/api/leads/schedule-optimal` | Optimal send scheduling | Auth | Timezone-aware scheduling |
| 8 | POST | `/api/leads/recalculate-scores` | Recalculate lead scores | Auth | |
| 9 | GET | `/api/leads/status` | Lead status summary | Auth | Counts by status |
| 10 | GET | `/api/leads/source-stats` | Lead source statistics | Auth | |
| 11 | POST | `/api/leads/consent` | Update consent status | Auth | GDPR consent management |

---

## 11. Opportunities

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/opportunities` | List opportunities | Auth | `?companyId=&page=&pageSize=` |
| 2 | POST | `/api/opportunities` | Create opportunity | Auth | Validated via `createOpportunitySchema` |
| 3 | GET | `/api/opportunities/[id]` | Get opportunity detail | Auth | |
| 4 | PUT | `/api/opportunities/[id]` | Update opportunity | Auth | |
| 5 | DELETE | `/api/opportunities/[id]` | Delete opportunity | Auth | |

---

## 12. Dashboard

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/dashboard` | Dashboard overview | Auth | AI-intelligence quality, coverage, health metrics. Rate limited via `utilityGuard` |
| 2 | GET | `/api/dashboard/stats` | Dashboard statistics | Auth | Aggregate platform stats |

---

## 13. Pipeline

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/pipeline` | Pipeline funnel data | Auth | Contact counts by pipeline stage |
| 2 | GET | `/api/pipeline/health` | Pipeline health metrics | Auth | Conversion rates, velocity |
| 3 | GET | `/api/pipeline/forecast` | Pipeline forecast | Auth | Revenue forecast with stage probability weighting |

---

## 14. Knowledge

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/knowledge` | List knowledge documents | Auth | Paginated. Max page 50 |
| 2 | POST | `/api/knowledge` | Upload knowledge document | Auth | Max 10 MB file upload |
| 3 | GET | `/api/knowledge/[id]` | Get knowledge document | Auth | |
| 4 | PUT | `/api/knowledge/[id]` | Update knowledge document | Auth | |
| 5 | DELETE | `/api/knowledge/[id]` | Delete knowledge document | Auth | |
| 6 | GET | `/api/knowledge/graph` | Knowledge graph (nodes + edges) | Auth | `?category=&assetId=&versions=true` |
| 7 | POST | `/api/knowledge/ingest` | Ingest document into AI knowledge graph | Auth | Pipeline processing |
| 8 | GET | `/api/knowledge/ingest` | Ingestion pipeline statistics | Auth | |

---

## 15. Capabilities

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/capabilities` | List capabilities | Auth | Filterable, sortable |
| 2 | POST | `/api/capabilities` | Create capability | Auth | Admin-only for create |
| 3 | GET | `/api/capabilities/[id]` | Get capability detail | Auth | |
| 4 | PUT | `/api/capabilities/[id]` | Update capability | Auth | |
| 5 | DELETE | `/api/capabilities/[id]` | Delete capability | Auth | |
| 6 | POST | `/api/capabilities/enrich` | AI-enrich capability | Auth | Governed AI call |
| 7 | GET | `/api/capabilities/export` | Export capabilities | Auth | CSV/JSON |
| 8 | POST | `/api/capabilities/import` | Import capabilities | Auth | Bulk import |
| 9 | POST | `/api/capabilities/dedup-check` | Check for duplicate capabilities | Auth | Fuzzy matching |
| 10 | GET | `/api/capabilities/[id]/children` | List child capabilities | Auth | Hierarchical capability tree |

---

## 16. Import & Data

### Data Import Pipeline (Ticket 11 — multi-action pipeline)

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/data-import` | List uploads | Auth | Upload history |
| 2 | POST | `/api/data-import` | Upload + auto-analyze | Auth | Multi-part file upload |
| 3 | POST | `/api/data-import/confirm-mapping` | Confirm column mapping | Auth | Step 2 of pipeline |
| 4 | POST | `/api/data-import/validate` | Validate all rows | Auth | Step 3 of pipeline |
| 5 | POST | `/api/data-import/normalize` | Normalize all rows | Auth | Step 4 of pipeline |
| 6 | POST | `/api/data-import/commit` | Commit import to DB | Auth | Step 5 of pipeline |
| 7 | GET | `/api/data-import/[id]` | Get upload with rows and quality scores | Auth | Upload detail |

### Legacy Import & Data Health

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 8 | POST | `/api/imports` | Legacy import (CSV/XLSX) | Auth | Auto-detect format, match companies |
| 9 | GET | `/api/data-health` | Data health dashboard | Auth | Cached 5 min. Completeness, staleness, quality scores |

---

## 17. Export

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/export` | Export data (CSV) | Admin | Companies, contacts, opportunities. CSV download |
| 2 | GET | `/api/export-center` | Export center — history & available exports | Admin | Enterprise data portability. `?type=&format=csv\|json` |
| 3 | POST | `/api/export-center` | Request export job | Admin | Synchronous export with audit logging |

---

## 18. Sequences

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/sequences` | List active sequences | Auth | Includes step counts and enrollment counts |
| 2 | POST | `/api/sequences` | Create sequence | Auth | |
| 3 | GET | `/api/sequences/[id]` | Get sequence detail | Auth | |
| 4 | PUT | `/api/sequences/[id]` | Update sequence | Auth | |
| 5 | DELETE | `/api/sequences/[id]` | Delete sequence | Auth | |
| 6 | POST | `/api/sequences/[id]/execute` | Execute sequence immediately | Auth | |
| 7 | POST | `/api/sequences/enroll` | Enroll contacts in sequence | Auth | Body: `{ sequenceId, contactIds[] }` |
| 8 | POST | `/api/sequences/process` | Process pending sequence steps | Auth | Worker endpoint |
| 9 | GET | `/api/sequences/[id]/steps/[stepId]` | Get step detail | Auth | |
| 10 | PUT | `/api/sequences/[id]/steps/[stepId]` | Update step | Auth | |

---

## 19. Emails, Drafts, Replies & Bounces

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | POST | `/api/emails/send` | Send email (direct or from draft) | Auth | Rate limited. Validates with Zod. Supports `{ to, subject, body }` or `{ draftId }` |
| 2 | GET | `/api/emails/track` | Email tracking (open/click) | Public | Returns 1×1 GIF. `?eid=&type=open\|click` |
| 3 | GET | `/api/drafts` | List email drafts | Auth | `?status=` filter |
| 4 | POST | `/api/drafts` | Create draft | Auth | May auto-generate via AI |
| 5 | GET | `/api/drafts/[id]` | Get draft detail | Auth | |
| 6 | PUT | `/api/drafts/[id]` | Update draft | Auth | |
| 7 | DELETE | `/api/drafts/[id]` | Delete draft | Auth | |
| 8 | GET | `/api/replies` | List inbound replies | Auth | Ordered by receivedAt desc |
| 9 | GET | `/api/bounces` | List bounce records | Auth | Hard/soft bounce tracking |

---

## 20. Email Templates

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/email-templates` | List email templates | Auth | `?serviceLine=&tone=&category=` |
| 2 | POST | `/api/email-templates` | Create template | Auth | |
| 3 | GET | `/api/email-templates/[id]` | Get template | Auth | |
| 4 | PUT | `/api/email-templates/[id]` | Update template | Auth | |
| 5 | DELETE | `/api/email-templates/[id]` | Delete template | Auth | |

---

## 21. Signals

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/signals` | List signals | Auth | `?companyId=&type=&severity=&status=&page=`. Returns `{ signals, evidenceCounts, categories }` |
| 2 | GET | `/api/signals/operational` | Operational signal feed | Auth | Real-time operational signals |
| 3 | GET | `/api/signals/[id]/evidence` | Signal evidence chain | Auth | Evidence records for a signal |

---

## 22. Settings & Preferences

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/settings` | Get system settings | Admin | Mailbox, working hours, AI config, feature flags |
| 2 | PUT | `/api/settings` | Update system settings | Admin | |
| 3 | GET | `/api/preferences` | Get user preferences | Auth | Key-value store |
| 4 | PUT | `/api/preferences` | Update user preferences | Auth | |
| 5 | GET | `/api/prompt-templates` | List prompt templates | Auth | `?category=` filter |
| 6 | POST | `/api/prompt-templates` | Create prompt template | Auth | |
| 7 | GET | `/api/prompt-templates/[id]` | Get prompt template | Auth | |
| 8 | PUT | `/api/prompt-templates/[id]` | Update prompt template | Auth | |
| 9 | DELETE | `/api/prompt-templates/[id]` | Delete prompt template | Auth | |
| 10 | GET | `/api/playbooks` | List playbooks | Auth | |
| 11 | POST | `/api/playbooks` | Create playbook | Auth | Governed AI generation |
| 12 | GET | `/api/playbooks/[id]` | Get playbook | Auth | |
| 13 | PUT | `/api/playbooks/[id]` | Update playbook | Auth | |
| 14 | DELETE | `/api/playbooks/[id]` | Delete playbook | Auth | |

---

## 23. Admin

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/admin/ai-usage` | AI cost dashboard | Admin | Daily cost status from governance |
| 2 | GET | `/api/audit-logs` | Detailed audit log | Admin | `?action=&entity=&userId=&page=&limit=`. Max 500 |
| 3 | GET | `/api/audit` | Audit trail entries | Admin | `?limit=` (max 500). Recent activity |
| 4 | GET | `/api/system-health` | Platform operations center | Auth | DB counts, queue health, AI provider status, 7-day metrics |

---

## 24. Webhooks & Tracking

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | POST | `/api/webhooks/reply` | Inbound email reply webhook | Public | Accepts Resend/SendGrid payloads. Auto-categorizes: out_of_office, positive, negative, question, meeting_request, not_interested, other |
| 2 | POST | `/api/webhooks/bounce` | Bounce notification webhook | Public | Resend/SendGrid/SES/Postmark. Classifies hard vs soft, auto-suppresses hard bounces |
| 3 | GET | `/api/tracking/open` | Email open tracking pixel | Public | `?q=<signed_token>`. Returns 1×1 transparent GIF. No auth (signed token) |
| 4 | GET | `/api/tracking/click` | Email click tracking redirect | Public | `?q=<signed_token>&url=<encoded_url>`. Returns 302 redirect |
| 5 | GET | `/api/unsubscribe` | Email unsubscribe page | Public | `?email=&token=`. HMAC-verified. Returns branded HTML confirmation |

---

## 25. Background Workers

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/cron/job-processor` | Daily cron job (6 AM) | Cron Secret | 11 tasks: workflow jobs, stale recovery, freshness, evidence lifecycle, cross-account signals, monitoring, predictions, learning loop |
| 2 | GET | `/api/realtime` | SSE event stream | Auth | `text/event-stream`. Forwards: notification, email_opened, email_clicked. Max 3 connections per user |
| 3 | GET | `/api/queue` | Send queue status | Auth | Pending/sent/failed emails |
| 4 | POST | `/api/email-worker` | Email send worker | Auth | Processes pending/scheduled SendQueue items. Max 3 retries |
| 5 | POST | `/api/verify-email` | Verify single email | Auth | Syntax, MX, disposable, role-based, free provider checks |
| 6 | POST | `/api/verify-queue` | Add contacts to verification queue | Auth | |
| 7 | GET | `/api/verify-queue` | List verification queue | Auth | |
| 8 | POST | `/api/verify-queue/process` | Process verification queue | Auth | Batch DNS MX lookups |

---

## 26. Reports & Analytics

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/reports/revenue` | Revenue report | Auth | Stage-weighted forecast. `?months=` |
| 2 | GET | `/api/reports/team-performance` | Team performance report | Auth | Per-member KPIs |
| 3 | GET | `/api/reports/data-quality` | Data quality report | Auth | Completeness, validation scores |
| 4 | GET | `/api/reports/pipeline` | Pipeline report | Auth | Funnel metrics, velocity |
| 5 | GET | `/api/analytics` | Analytics dashboard | Auth | KPIs, funnel, campaign performance, trends. 5-min cache |
| 6 | GET | `/api/stats` | Platform statistics | Auth | Aggregate metrics. Rate limited via `utilityGuard` |
| 7 | GET | `/api/revops` | RevOps dashboard | Auth | Revenue operations overview. AI-generated insights |
| 8 | GET | `/api/team/performance` | Team performance | Auth | Per-member pipeline KPIs |
| 9 | GET | `/api/cro-dashboard` | CRO command center | Auth | Revenue pipeline health, risk analysis, AI quality, seller effectiveness, market signals, data health |

---

## 27. Cross-Cutting

### Notes & Timeline

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/notes` | List notes (cross-entity) | Auth | `?companyId=&contactId=&limit=50` |
| 2 | POST | `/api/notes` | Create note | Auth | Company or contact note |
| 3 | PUT | `/api/notes/[id]` | Update note | Auth | |
| 4 | DELETE | `/api/notes/[id]` | Delete note | Auth | |
| 5 | GET | `/api/timeline` | Activity timeline | Auth | `?companyId=&contactId=&limit=&action=` |

### Segments

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 6 | GET | `/api/segments` | List segments | Auth | `?evaluate=true` for dynamic evaluation |
| 7 | POST | `/api/segments` | Create segment | Auth | |
| 8 | PUT | `/api/segments` | Update segment | Auth | |
| 9 | DELETE | `/api/segments` | Archive segment | Auth | |
| 10 | GET | `/api/segments/[id]/contacts` | Get segment contacts | Auth | |

### Engines

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 11 | POST | `/api/engines/score` | Revenue Intelligence Score Engine | Auth | Modes: single, batch, catalog |
| 12 | POST | `/api/engines/brief` | Brief engine (legacy) | Auth | Superseded by `/api/intelligence/brief/[id]` |
| 13 | POST | `/api/engines/conversation` | Conversation engine (legacy) | Auth | Superseded by `/api/intelligence/conversation/[id]` |
| 14 | POST | `/api/engines/actions` | Actions engine (legacy) | Auth | |

### Intelligence Cross-Cutting

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 15 | POST | `/api/reasoning` | Enterprise reasoning context | Auth | 30-step reasoning engine |
| 16 | POST | `/api/research` | Company research (AI) | Auth | Governed AI call. Returns structured research |
| 17 | POST | `/api/research-agent` | Deep research (web + AI) | Auth | `?query=&type=company\|person` |
| 18 | GET | `/api/enterprise` | Enterprise readiness dashboard | Auth | `?view=audit\|export\|compliance` |
| 19 | POST | `/api/learning` | Record learning event | Auth | Continuous learning loop |
| 20 | GET | `/api/templates` | List templates | Auth | `?serviceLine=&tone=&category=` |

### Fusion & Orchestration

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 21 | POST | `/api/fusion` | Fuse external + internal intelligence | Auth | Signal × Capability = Opportunity Intelligence |
| 22 | POST | `/api/orchestration` | Multi-agent orchestration | Auth | Full pipeline orchestration for a company |
| 23 | GET | `/api/suppressions` | List suppressions | Auth | Email suppressions (max 100) |
| 24 | POST | `/api/suppressions` | Create suppression | Auth | |
| 25 | GET | `/api/duplicates` | Find duplicate candidates | Auth | Levenshtein-based fuzzy matching |
| 26 | POST | `/api/duplicates` | Merge duplicates | Auth | |

### Batches

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 27 | POST | `/api/batches` | Create/import batch | Auth | XLSX/CSV batch import |
| 28 | GET | `/api/batches/preview` | Preview batch import | Auth | Parse file, detect mapping |
| 29 | GET | `/api/batches/[id]/progress` | Batch processing progress | Auth | Real-time status |

### Sales & Command

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 30 | GET | `/api/conversation-plans` | List conversation plans | Auth | |
| 31 | POST | `/api/conversation-plans` | Create conversation plan | Auth | |
| 32 | GET | `/api/conversation-plans/[id]` | Get conversation plan | Auth | |
| 33 | PUT | `/api/conversation-plans/[id]` | Update conversation plan | Auth | |
| 34 | DELETE | `/api/conversation-plans/[id]` | Delete conversation plan | Auth | |
| 35 | GET | `/api/sales-execution` | Sales execution dashboard | Auth | `?activity=pursuits` |
| 36 | GET | `/api/command-center/insights` | Command center insights | Auth | |
| 37 | POST | `/api/command-center/query` | Natural language query | Auth | Two-pass LLM: Query Planner → Analyst |

### G-Intel Acquisition (Human Intelligence)

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 38 | GET | `/api/g-intel-acquisition/inbox` | Intelligence inbox | Auth | `?page=&limit=&status=&priority=&search=` |
| 39 | POST | `/api/g-intel-acquisition/inbox` | Submit human intelligence | Auth | |
| 40 | GET | `/api/g-intel-acquisition/inbox/stats` | Inbox statistics | Auth | |
| 41 | POST | `/api/g-intel-acquisition/inbox/batch-dismiss` | Batch dismiss items | Auth | |
| 42 | POST | `/api/g-intel-acquisition/inbox/[id]/convert` | Convert to intelligence | Auth | |
| 43 | POST | `/api/g-intel-acquisition/inbox/[id]/dismiss` | Dismiss item | Auth | |
| 44 | POST | `/api/g-intel-acquisition/inbox/[id]/review` | Review item | Auth | |

### Compliance

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 45 | GET | `/api/compliance` | GDPR compliance metrics | Auth | Consent distribution, risk flags, retention status |

---

## 28. Utility Endpoints

### Public Health & Status

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/health` | Liveness probe | Public | Probes DB. Returns `{ status, uptime, timestamp, providers, db }`. `Cache-Control: no-store` |
| 2 | GET | `/api/ready` | Readiness probe | Public | Returns 200 if DB reachable, 503 otherwise |
| 3 | GET | `/api/version` | Application version | Public | `{ version, environment }` |
| 4 | GET | `/api/ping` | Liveness ping | Public | Returns `"pong"` (plain text) |

### Setup & Seeding

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 5 | POST | `/api/setup-db` | Run database migrations | Setup Token | Double-gated: `SETUP_TOKEN` env + `X-Setup-Token` header. GET returns 404 |
| 6 | POST | `/api/seed` | Seed database with sample data | Admin | Destructive. Clears existing data |
| 7 | POST | `/api/seed/gold-standard` | Seed Gold Standard Account (Microsoft) | Admin | Creates demo account passing all validation tests |

### Root

| # | Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|---|
| 8 | GET | `/api` | API status check | Auth | `{ status: "ok", version: "1.0", timestamp }` |

---

## Quick Reference: Auth by Domain

| Domain | Primary Auth | Exceptions |
|---|---|---|
| `/api/auth/*` (login, logout, otp, register) | Public | `me`, `update-profile`, `change-password`, `set-password` require Auth |
| `/api/health`, `/api/ready`, `/api/version`, `/api/ping` | Public | — |
| `/api/tracking/*`, `/api/emails/track`, `/api/unsubscribe` | Public (signed tokens) | — |
| `/api/webhooks/*` | Public (provider signatures) | — |
| `/api/setup-db` | Setup Token | — |
| `/api/cron/*` | Cron Secret | — |
| `/api/companies/*`, `/api/contacts/*`, `/api/leads/*` | Authenticated | — |
| `/api/intelligence/*`, `/api/ai/*` | Authenticated | — |
| `/api/opportunities/*`, `/api/knowledge/*`, `/api/capabilities/*` | Authenticated | — |
| `/api/sequences/*`, `/api/drafts/*`, `/api/replies/*` | Authenticated | — |
| `/api/emails/send`, `/api/email-worker`, `/api/queue` | Authenticated | — |
| `/api/signals/*`, `/api/settings/*`, `/api/preferences/*` | Authenticated | — |
| `/api/admin/*`, `/api/audit-logs`, `/api/audit` | Admin | — |
| `/api/export/*`, `/api/export-center/*`, `/api/seed/*` | Admin | — |
| `/api/system-health` | Authenticated | — |

---

## Common Query Parameters

| Param | Used In | Description |
|---|---|---|
| `page` | Most list endpoints | Page number (default 1) |
| `limit` / `pageSize` | Most list endpoints | Items per page (default 20-50, max 100) |
| `search` | Companies, Contacts, Leads, Signals | Full-text search |
| `sortBy` | Companies, Contacts | Sort field |
| `sortOrder` / `sortDir` | Companies, Contacts | `asc` or `desc` |
| `cursor` | Companies | Base64 cursor for cursor-based pagination |
| `companyId` | Contacts, Signals, Opportunities, Intelligence | Filter by company |
| `contactId` | AI, Timeline, Notes | Filter by contact |
| `include` | Intelligence `[id]` routes | Comma-separated sections to include |
| `source` | Leads | `db` or `excel` |
| `days` | AI Usage, Revenue | Time range in days |
