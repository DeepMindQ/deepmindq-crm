---
Task ID: 3-c-enhancement
Agent: main
Task: Track C Enhancement — Revenue Intelligence Execution Layer

Work Log:
- Read all existing files: schema (OpportunityRecommendation + Pursuit already exist), signal-sequence-engine, review-queue, drafts__batch, revenue-intelligence, route files
- Created src/lib/research-engine/opportunity-recommendation.ts — the core engine transforming signal+evidence+capability match into OpportunityRecommendation with 5-dimension composite scoring
- Refactored src/lib/research-engine/signal-sequence-engine.ts — added generateOpportunitySequence() as primary path (consumes OpportunityRecommendation, validates accepted status, links opportunityId to sequence)
- Created src/app/api/g-outreach/[...slug]/opportunities.ts — GET (opportunity-level review queue) + POST (single/batch opportunity generation)
- Created src/app/api/g-outreach/[...slug]/opportunities__batch.ts — Accept (creates Pursuit), Reject (structured taxonomy), Monitor, Assign actions
- Created src/app/api/g-outreach/[...slug]/pursuits.ts — GET (list pursuits with filters) + PATCH (update pursuit stage)
- Enhanced src/app/api/g-outreach/[...slug]/drafts__batch.ts with structured rejection taxonomy (WRONG_TIMING, EXISTING_RELATIONSHIP, NOT_RELEVANT, LOW_CONFIDENCE, NO_BUDGET, OTHER)
- Registered new routes in g-outreach route.ts: opportunities, opportunities/batch, pursuits, pursuits/[id]
- Prisma client generated successfully
- TypeScript compilation: 0 errors in new/modified files (pre-existing errors in strategy-room.ts and opportunities-screen.tsx are unrelated)

Stage Summary:
- New files: opportunity-recommendation.ts, opportunities.ts, opportunities__batch.ts, pursuits.ts
- Modified files: signal-sequence-engine.ts, drafts__batch.ts, route.ts
- The flow is now: Signal → OpportunityRecommendation → Human Decision (Accept/Reject/Monitor) → Pursuit (on Accept) → Optional Engagement Sequence
- No SendQueue creation outside human approval flow
- AI only creates recommendations (status=pending_review), never accepts/rejects/creates pursuits