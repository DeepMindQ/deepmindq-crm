# Phase 3 Final Hardening — Freeze Report

## 1. Governance Validation Report

### Route Migration Status

**g-ai Routes (17 LLM-producing):**

| Route | Generation Type | Governance Function | Status |
|---|---|---|---|
| ai__signals.ts | signal_analysis | governedAICall | Compliant |
| ai__opportunities.ts | opportunities | governedAICall | Compliant |
| ai__insights.ts | insights | governedAICall | Compliant |
| command-center__insights.ts | insights | governedAICall | Compliant |
| ai__suggested-contacts.ts | suggested_contacts | governedAICall | Compliant |
| ai__recommendations.ts | recommendations | governedAICall | Compliant |
| ai__conversation-plan.ts | conversation_plan | governedAICall | Migrated |
| ai__query.ts | query_parsing | governedAICallAggregate | Migrated |
| ai__enrich.ts | enrichment | governedAICall | Migrated |
| ai__generate-pdf.ts | pdf_report | governedAICall | Migrated (3 calls) |
| ai__account-brief.ts | account_brief | governedAICall | Migrated |
| ai__summarize.ts | summarize | governedAICall | Migrated (2 calls) |
| ai__generate-ppt.ts | ppt_generation | governedAICall | Migrated |
| capabilities__enrich.ts | knowledge_enrichment | governedAICallAggregate | Migrated |
| command-center__query.ts | command_center_query/analysis | governedChat wrapper | Migrated (2 calls) |
| research-agent.ts | research_agent_person | governedAICallAggregate | Migrated |
| ai__relationship-memory.ts | relationship_memory | governedAICallAggregate | Migrated (5 calls) |

**Non-g-ai Routes (5):**

| Route | Generation Type | Governance Function | Status |
|---|---|---|---|
| g-data/ab-tests.ts | ab_test_variant | governedAICall | Migrated |
| g-data/data-health.ts | data_health_analysis | governedAICallAggregate | Migrated (3 calls) |
| g-crm/contacts___id__generate-email.ts | email_draft | governedAICall | Migrated |
| g-strategy/playbooks.ts | playbook_generation | governedAICallAggregate | Migrated |
| g-strategy/strategy-room.ts | strategy_generation | governedAICall | Migrated |

**Library Modules (4):**

| Module | Generation Type | Governance Function | Status |
|---|---|---|---|
| research-engine/researcher.ts | research_extraction | governedAICallAggregate | Migrated (2 calls) |
| research-engine/signals.ts | signal_detection | governedAICallAggregate | Migrated |
| email-generation.ts | email_draft | governedAICall | Migrated |
| workflow-engine/processor.ts | workflow_email_generation | governedAICall | Migrated |

### Validation Metrics

| Metric | Value |
|---|---|
| Direct callLLM() outside governance | 0 (in route/library files) |
| Direct callLLM() in ai-governance.ts (allowed) | 2 |
| Direct callLLM() in zai-helpers.ts (primitive) | 3 |
| governedAICall() usages | 23 |
| governedAICallAggregate() usages | 17 |
| Direct OpenAI/Anthropic API usages | 0 |
| Total governed LLM call sites | 40 |

---

## 2. AI Governance Flow

```
User Request
    |
    v
API Route
    |
    v
governedAICall() / governedAICallAggregate()
    |
    +-- 1. Governance Checks
    |   +-- Research exists?
    |   +-- Confidence >= threshold? (per engine)
    |   +-- Freshness >= threshold?
    |   +-- Staleness within limit?
    |   +-- Capability matched? (if required)
    |   +-- Recent intelligence exists? (if required)
    |
    +-- 2. Prompt Enhancement
    |   +-- Inject hallucination prevention rules (15 rules)
    |   +-- Inject evidence grounding notes
    |   +-- Inject governance warnings
    |   +-- Inject freshness lifecycle warnings
    |
    +-- 3. Decision
    |   +-- If blocked --> Return rejection with reason + audit
    |   +-- If passed --> Continue to LLM call
    |
    +-- 4. LLM Call (via callLLM, single entry point)
    |
    +-- 5. Audit Trail
        +-- AIGenerationAudit.create({
              generationType, companyId, contactId,
              evidenceIdsUsed, signalIdsUsed,
              capabilityAssetIdsUsed, researchConfidence,
              freshnessScore, governancePassed,
              governanceChecks, outputSummary,
              modelUsed, promptVersion, inputParams
            })
```

---

## 3. Engine-Level Confidence Policies

| Engine | Min Confidence | Min Freshness | Require Capability | Require Intelligence | Max Staleness |
|---|---|---|---|---|---|
| Email generation | 60% | 25 | Yes | Yes | 60 days |
| Opportunity detection | 50% | 20 | No | Yes | 90 days |
| Executive conversation | 60% | 25 | No | Yes | 60 days |
| Lead qualification | 50% | 20 | No | Yes | 90 days |
| Account brief | 20% | 10 | No | No | 180 days |
| Signal analysis | 20% | 10 | No | No | 365 days |
| PDF/PPT generation | 20% | 10 | No | No | 180 days |
| Enrichment | 20% | 10 | No | No | 180 days |
| Aggregate (non-company) | 0% | 0 | No | No | N/A |

---

## 4. Freshness Lifecycle Enforcement

| Intelligence Domain | Fresh Lifecycle | Aging Threshold | Stale Threshold | AI Behavior When Stale |
|---|---|---|---|---|
| Profile intelligence | 90 days | 180 days | 180+ days | Reduce confidence, recommend refresh |
| Signals | 14 days | 28 days | 28+ days | Do not reference stale signals |
| Technology | 60 days | 120 days | 120+ days | Do not make tech claims |
| Contacts | 45 days | 90 days | 90+ days | Flag contact data as potentially outdated |

---

## 5. Signal Lifecycle Management

**States:** `detected -> validated -> active -> aging -> expired -> archived`

**Transition rules:**

- detected -> validated: confidence >= 0.5
- validated -> active: confidence >= 0.7 AND impact = 'high'
- active -> aging: age > 14 days
- aging -> expired: age > 90 days
- expired -> archived: age > 365 days

---

## 6. RFP/RFI/Tender Signal Architecture

Extended CompanySignal model with:

- **opportunityType:** rfp, rfi, tender, vendor_search, procurement, tech_transformation, partner_requirement
- **publicationDate**, **deadline**
- **buyingArea**, **techRequirement**, **serviceRequirement**
- **matchingCapability** (links to CapabilityAsset)
- **sourceQuality:** premium, standard, low

---

## 7. Database Schema Changes

### New Fields

- CompanySignal.status (String, default "detected")
- CompanySignal.opportunityType (String, nullable)
- CompanySignal.publicationDate (DateTime, nullable)
- CompanySignal.deadline (DateTime, nullable)
- CompanySignal.buyingArea (String, nullable)
- CompanySignal.techRequirement (String, nullable)
- CompanySignal.serviceRequirement (String, nullable)
- CompanySignal.matchingCapability (String, nullable)
- CompanySignal.sourceQuality (String, default "standard")

### New Composite Indexes (8)

- CompanySignal: [companyId, signalType, createdAt], [companyId, status]
- Evidence: [companyId, status, createdAt], [companyId, extractedField, confidence]
- AIGenerationAudit: [companyId, generationType, createdAt], [companyId, createdAt]
- SignalCapabilityMatch: [companyId, signalId], [companyId, capabilityId]

---

## 8. Technical Debt List

1. **195 pre-existing TypeScript errors in UI components** -- unrelated to governance
2. **callLLM() in zai-helpers.ts is still importable** -- architecturally this is the primitive layer and is acceptable since it is only called from ai-governance.ts
3. **Some routes use enforceGovernance: false** -- these should be tightened in Phase 4
4. **Signal lifecycle transitions are currently only applied at detection time** -- a scheduled job for periodic reclassification is needed
5. **Freshness timestamps (profileFreshnessAt etc.) need to be SET by the research engine during research runs** -- verify population

---

## 9. Phase 3 Freeze Checklist

- [x] All AI routes pass through governance layer
- [x] All AI outputs are traceable via AIGenerationAudit
- [x] All intelligence flows from Research Engine -> Evidence -> Signals -> Contract
- [x] Capability matching explains reasoning (SignalCapabilityMatch.reason)
- [x] Signals have lifecycle management (status field + state machine)
- [x] Database indexes are production-ready (8 new composite indexes)
- [x] RFP/RFI signal architecture supported (extended CompanySignal)
- [x] Freshness and confidence affect AI behavior (per-engine thresholds + lifecycle warnings)
- [x] Hallucination prevention rules injected into every LLM call (15 rules)
- [x] Prompt version tracking (v3-phase3-harden)
- [x] Model tracking in every audit record