---
Task ID: 1
Agent: Main Agent
Task: Create Company Intelligence Contract Layer — Phase 3 Consumption Layer

Work Log:
- Read all existing Phase 3 code: researcher.ts, evidence.ts, signals.ts, index.ts
- Read all 5 AI routes that needed rewiring: ai/account-brief, ai/signals, ai/enrich, ai/suggested-contacts, email-generation.ts
- Read existing CRM APIs: intelligence, evidence, signals, generate-email
- Read Prisma schema for CompanyResearchCard, CompanySignal, Evidence models
- Created `/src/lib/intelligence-contract.ts` — the single intelligence contract layer
  - getResearchContext(): Returns clean JSON for AI consumption
  - getAccountIntelligence(): Returns aggregated lead qualification score
  - getSignalMetrics(): Returns signal analytics
  - calculateFreshness(): Returns 0-100 freshness score with status
  - buildResearchContextText(): Builds LLM-ready text from Phase 3 data
- Created 3 new API routes:
  - `companies/{id}/research-context` — THE single intelligence contract API
  - `companies/{id}/account-intelligence` — Lead qualification score (Phase 5)
  - `signals/metrics` — Signal analytics dashboard (Phase 6)
- Rewired 5 AI routes to consume Phase 3:
  - `ai/account-brief` — Now reads from Phase 3 evidence/signals, no web search
  - `ai/signals` — Now reads from CompanySignal table, no web search
  - `ai/enrich` — Now reads from ResearchCard, no web search
  - `ai/suggested-contacts` — Now checks Phase 3 keyPeople first, only LLM analysis if <3 people
  - `email-generation.ts` — Auto-reads ResearchCard from DB, no fallback web search
  - `contacts/{id}/generate-email` — Now consumes Phase 3 via intelligence-contract
- Added research freshness scoring (0-100, fresh/aging/stale/none)
- All new files pass TypeScript compilation (verified with `tsc --noEmit`)

Stage Summary:
- 9 files created/modified
- 3 new APIs added: research-context, account-intelligence, signals/metrics
- 5 AI routes rewired: zero independent web searches remain
- 1 shared lib module: intelligence-contract.ts
- Phase 3 is now the single source of truth for all AI consumption