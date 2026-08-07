# DeepMindQ — Master Product Roadmap (Reference Card)
# Enterprise Intelligence Operating System | 91 Items | 10 Tracks
# Baseline: 67.9/100 (B-) → Target: 83+/100 (A-)

---

## STATUS: Phase 1.2 ACTIVE | 9 DONE | 81 PENDING

---

## COMPLETE ROADMAP

### Track Legend
| Code | Name | Purpose |
|------|------|---------|
| INT | Intelligence Engine | Core scoring, signals, feedback loop |
| PST | Persistence & State | Maps, hydration, cold-start |
| KNO | Knowledge & Learning | KG, memory, cross-company learning |
| AIQ | AI Quality & Confidence | Evaluation, hallucination prevention, calibration |
| DAT | Data Pipeline & Ingestion | Completeness, CRM, bulk import, enrichment |
| SEC | Security & Compliance | RBAC, SSO, audit trail, GDPR |
| UX | User Experience | Design system, dashboard, all screens |
| API | API & Integrations | Versioning, webhooks, SDK, connectors |
| OPS | Operations & Reliability | Scaling, monitoring, disaster recovery |
| TST | Testing & Validation | E2E, load, security audit, UAT, go-live |

---

### Phase 0 — Foundation (DONE)
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 0.1 | INT | Baseline Audit & Tagging | — | DONE |
| 0.2 | SEC | G2: AI Governance Seal (hard 403) | 0.1 | DONE |
| 0.3 | INT | G9: Version History (real DB) | 0.1 | DONE |
| 0.4 | INT | G6: Score Hierarchy (schema+API) | 0.1 | DONE |
| 0.5 | SEC | Password Auth + Session Management | — | DONE |
| 0.6 | SEC | API Key Management | 0.5 | DONE |
| 0.7 | OPS | Health Endpoints + Basic Monitoring | — | DONE |
| 0.8 | OPS | CI/CD Pipelines (GitHub Actions) | — | DONE |

### Phase 1 — Core Intelligence & Persistence
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 1.1 | INT | Learning Loop Circuit Closure | 0.x | DONE |
| 1.2 | PST | registerMapStateProvider Wiring | 0.x | ACTIVE |
| 1.3 | PST | Maps Cold-Start Hydration | 1.2 | NEXT |
| 1.4 | PST | Cold-Start Trigger on Boot | 1.3 | NEXT |
| 1.5 | PST | Score Config Persistence Validation | 1.2 | PENDING |
| 1.6 | INT | Signal Detection Accuracy Hardening | 1.1 | PENDING |
| 1.7 | INT | Technology Detection Calibration | 1.1, 1.6 | PENDING |

### Phase 2 — Knowledge & Learning
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 2.1 | KNO | Knowledge Graph Cold-Start Hydration | 1.3 | PENDING |
| 2.2 | KNO | Institutional Memory Search & Reuse | 1.1 | PENDING |
| 2.3 | KNO | Cross-Company Learning Transfer | 2.1, 2.2 | PENDING |
| 2.4 | KNO | Decision Learning Confidence Blending | 1.1, 2.2 | PENDING |
| 2.5 | KNO | Continuous Learning Event Pipeline | 2.2 | PENDING |
| 2.6 | INT | Evidence Framework Cross-Validation | 1.1 | PENDING |

### Phase 3 — AI Quality & Confidence
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 3.1 | AIQ | AI Evaluation Engine Hardening | 1.6 | PENDING |
| 3.2 | AIQ | Hallucination Prevention (Golden Dataset) | 3.1 | PENDING |
| 3.3 | AIQ | Unified Confidence Calibration | 1.1, 3.1 | PENDING |
| 3.4 | AIQ | LLM Prompt Registry & Versioning | 0.3 | PENDING |
| 3.5 | AIQ | Prompt A/B Testing Framework | 3.4 | PENDING |
| 3.6 | AIQ | AI Cost Tracking per Model/Route | 3.4 | PENDING |

### Phase 4 — Data Pipeline & Ingestion
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 4.1 | DAT | Data Completeness Scoring Automation | 2.6 | PENDING |
| 4.2 | DAT | Freshness Decay Standardization | 4.1 | PENDING |
| 4.3 | DAT | Source Reliability Scoring Validation | 2.6, 4.1 | PENDING |
| 4.4 | DAT | Company Deduplication Engine | — | PENDING |
| 4.5 | DAT | CRM Integration (Salesforce/HubSpot) | 4.4 | PENDING |
| 4.6 | DAT | Bulk Import/Export Pipeline | 4.4 | PENDING |
| 4.7 | DAT | Data Enrichment API Integration | 4.1 | PENDING |

### Phase 5 — Security & Compliance
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 5.1 | SEC | RBAC — Role-Based Access Control | 0.5 | PENDING |
| 5.2 | SEC | SSO Integration (SAML/OIDC) | 0.5 | PENDING |
| 5.3 | SEC | Field-Level Permissions | 5.1 | PENDING |
| 5.4 | SEC | Audit Trail (Comprehensive) | 0.2, 5.1 | PENDING |
| 5.5 | SEC | Data Encryption (At-Rest + Transit) | — | PENDING |
| 5.6 | SEC | GDPR/CCPA Compliance Module | 5.4, 5.5 | PENDING |
| 5.7 | SEC | API Rate Limiting & Abuse Prevention | 0.6 | PENDING |
| 5.8 | SEC | Penetration Test & Remediation | 5.1-5.7 | PENDING |

### Phase 6 — UX Foundation
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 6.1 | UX | Design System Finalization | 0.x | PENDING |
| 6.2 | UX | Error Boundaries & Global Error Pages | — | PENDING |
| 6.3 | UX | Loading States & Skeleton Screens | 1.2-1.4 | PENDING |
| 6.4 | UX | Command Palette (Cmd+K) | — | PENDING |
| 6.5 | UX | Notification Center | — | PENDING |
| 6.6 | UX | Feedback Form Integration | 1.1 | PENDING |
| 6.7 | UX | Calibration Reason Display | 1.1 | PENDING |
| 6.8 | UX | Confidence Badges & Explainability Panel | 3.3 | PENDING |
| 6.9 | UX | KG Visualization Component | 2.1 | PENDING |
| 6.10 | UX | Memory Browser & Learning Timeline | 2.2 | PENDING |
| 6.11 | UX | Signal Cards & Detection Indicators | 1.6 | PENDING |
| 6.12 | UX | Data Completeness Bars & Freshness | 4.1, 4.2 | PENDING |
| 6.13 | UX | Score Breakdown Drill-Down | 1.5 | PENDING |
| 6.14 | UX | Account Tier Badges & Opportunity Cards | 1.5 | PENDING |
| 6.15 | UX | Accessibility (WCAG 2.1 AA) | 6.1 | PENDING |

### Phase 7 — Main Application UI
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 7.1 | UX | **Main Intelligence Dashboard** | 6.x, 5.1 | PENDING |
| 7.2 | UX | Company Workspace (Detail View) | 7.1 | PENDING |
| 7.3 | UX | Recommendation Queue & Actions | 7.1 | PENDING |
| 7.4 | UX | Admin Settings Panel | 5.1, 3.4 | PENDING |
| 7.5 | UX | User Onboarding Flow | 7.1 | PENDING |
| 7.6 | UX | Scoring Config UI | 1.5 | PENDING |
| 7.7 | UX | Batch Operations UI | 4.6 | PENDING |

### Phase 8 — API & Integrations
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 8.1 | API | API Versioning (v1 Stable) | 5.7 | PENDING |
| 8.2 | API | Webhook System (Outbound) | 8.1 | PENDING |
| 8.3 | API | Public API Documentation (OpenAPI) | 8.1 | PENDING |
| 8.4 | API | SDK / Client Library | 8.1, 8.3 | PENDING |
| 8.5 | API | Email Notification Templates | — | PENDING |
| 8.6 | API | Slack / Teams Integration | 8.2 | PENDING |
| 8.7 | API | Zapier / Automation Connectors | 8.2 | PENDING |

### Phase 9 — Operations & Reliability
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 9.1 | OPS | Performance Optimization (Query+Cache) | 7.1 | PENDING |
| 9.2 | OPS | Horizontal Scaling Preparation | 9.1 | PENDING |
| 9.3 | OPS | Monitoring & Alerting (Production) | 9.1 | PENDING |
| 9.4 | OPS | Backup & Disaster Recovery | 1.2 | PENDING |
| 9.5 | OPS | Database Migration Strategy | 4.5 | PENDING |
| 9.6 | OPS | Infrastructure as Code (Terraform/Pulumi) | 9.2 | PENDING |
| 9.7 | OPS | Blue-Green Deployment Pipeline | 9.6 | PENDING |
| 9.8 | OPS | Incident Response Playbooks | 9.3 | PENDING |

### Phase 10 — Testing & Go-Live
| ID | Track | Title | Depends On | Status |
|----|-------|-------|------------|--------|
| 10.1 | TST | E2E Testing Suite (Playwright) | 7.1 | PENDING |
| 10.2 | TST | Load Testing & Capacity Planning | 9.1 | PENDING |
| 10.3 | TST | Security Audit (External) | 5.8 | PENDING |
| 10.4 | TST | Accessibility Audit (External) | 6.15 | PENDING |
| 10.5 | TST | Regression Suite Finalization | 10.1 | PENDING |
| 10.6 | TST | User Acceptance Testing | 10.1-10.5 | PENDING |
| 10.7 | TST | Production Readiness Review | 10.6 | PENDING |
| 10.8 | TST | Deployment Runbook & Rollback Plan | 10.7 | PENDING |
| 10.9 | TST | Go-Live & Hypercare | 10.8 | PENDING |

---

## CRITICAL PATH

0.x → 1.2 → 1.3 → 2.1 → 2.3 → 5.1 → 6.1 → 7.1 → 9.1 → 9.2 → 9.6 → 10.1 → 10.6 → 10.8 → 10.9

---

## PARALLEL TRACKS

After Phase 1.3 completes, these tracks can run concurrently:

Wave A (Phase 2-4):  INT 1.6-1.7 | KNO 2.2-2.6 | AIQ 3.1-3.6 | DAT 4.1-4.7
Wave B (Phase 5):    SEC 5.1-5.8 (after 0.5)
Wave C (Phase 6):    UX 6.1-6.15 (after 6.1 baseline)
Wave D (Phase 7-8):  UX 7.1-7.7 + API 8.1-8.7 (after Wave B+C)
Wave E (Phase 9-10):  OPS 9.1-9.8 + TST 10.1-10.9 (after Wave D)

---

## EFFORT SUMMARY

| Track | Items | Weeks |
|-------|-------|-------|
| INT | 11 | 12.0w |
| PST | 4 | 2.5w |
| KNO | 5 | 8.5w |
| AIQ | 6 | 8.0w |
| DAT | 7 | 10.5w |
| SEC | 8 | 9.0w |
| UX | 21 | 23.0w |
| API | 7 | 8.5w |
| OPS | 8 | 10.0w |
| TST | 9 | 11.0w |
| **TOTAL** | **91** | **~93w** |

With 3-4 parallel tracks active from Phase 2 onward, wall-clock estimate: **~28-32 weeks to go-live**
