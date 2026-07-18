---
Task ID: 1
Agent: main
Task: Phase 3 Hardening — 7 items implementing AI governance, traceability, confidence gates, enhanced contract

Work Log:
- Explored full codebase: read all key files, located unknown paths (email-generation.ts, ai__suggested-contacts.ts, ai__conversation-plan.ts, research-agent.ts, command-center__query.ts)
- Verified existing Phase 3 rewiring status: account-brief, signals, enrich, suggested-contacts were already consuming intelligence contract
- Updated Prisma schema: AIGenerationAudit model (13 fields), CapabilityAsset enhanced (11 new fields), CompanyResearchCard enhanced (9 new fields for structured tech, strategic priorities, capability matching, category-specific freshness timestamps)
- Created src/lib/ai-governance.ts (547 lines): GovernanceConfig, GovernanceResult, GovernanceContext types; getGovernanceConfig() with 9 type-specific configs; runGovernanceChecks() with 6 checks; buildGovernancePromptAddon(); buildEvidenceGroundingNote(); recordGeneration(); preFlightCheck(); HALLUCINATION_PREVENTION_RULES constant
- Rewired ai__conversation-plan.ts: accepts optional companyId, consumes Phase 3 intelligence via getResearchContext, runs governance checks, injects hallucination prevention rules, records generation audit, falls back to web search when no companyId
- Rewired research-agent.ts: accepts optional companyId, stores section data as Evidence records, stores executive summary as CompanyNote, freshness warning for existing research, hallucination rules in company prompts, full audit trail
- Rewired command-center__query.ts: added intelligence-contract import, modified planner to avoid web search for company-specific queries, injects intelligence context into analyst LLM, added HALLUCINATION_PREVENTION_RULES
- Upgraded intelligence-contract.ts: added CategoryFreshness interface, enhanced ResearchFreshness with categories (profile/signal/contact/technology), calculateCategoryFreshness() with per-category half-life days, added structuredTechLandscape/strategicPriorities/capabilityMatchingInputs to ResearchContext, updated getResearchContext() to parse new fields, enhanced buildResearchContextText() with category freshness/tech landscape/strategic priorities/capability matching
- Enhanced email-generation.ts: added governance-gated intelligence fetch via fetchGovernedResearchContext(), blocks generation when governance fails (returns low-confidence template with rejection reason), injects governance warnings + grounding notes, records generation audit after every email
- Enhanced ai__account-brief.ts: added governance checks with buildGovernancePromptAddon + buildEvidenceGroundingNote, injected HALLUCINATION_PREVENTION_RULES into system prompt, records generation audit
- Fixed TypeScript type errors across files
- All changes pushed to GitHub (2 commits: db7fd5a + 3b81226)

Stage Summary:
- 9 files changed, ~1340 lines added
- New Prisma models: AIGenerationAudit
- Enhanced Prisma models: CapabilityAsset (+11 fields), CompanyResearchCard (+9 fields)
- New module: src/lib/ai-governance.ts
- All previously-independent AI routes now consume Phase 3 intelligence contract
- Every AI generation records an audit trail with evidence/signal/capability linkage
- Category-specific freshness model with different lifecycle durations (profile 90d, signal 14d, contact 45d, tech 60d)
- Confidence gates with per-generation-type thresholds
- Schema migration will run on Vercel deployment (prisma db push)