# AI: LLM Vendor Risk Assessment

**SOC 2 Criterion:** CC9.2 — The entity considers and addresses risks from third parties that could affect the achievement of system availability, processing integrity, confidentiality, and privacy objectives.

**Last Updated:** 2026-08-10
**Owner**: AI Governance Team
**Review Cadence**: Semi-annually

---

## Overview

DeepMindQ integrates multiple Large Language Model (LLM) providers to power its intelligence features. This document assesses the security risks of each provider and documents the controls in place to mitigate those risks.

### Provider Architecture

DeepMindQ uses a cascading provider pattern defined in the AI configuration:
```
Primary:   NVIDIA NIM (Llama 3.1 8B Instruct)
Backup:    Fireworks AI (Llama 3.3 70B)
Fallback:  Groq (Llama 3.3 70B)
Last-Resort: Google Gemini (Gemini 2.0 Flash)
None Available: Template-based fallback (no AI, deterministic responses)
```

Configuration: `src/lib/ai/ai-config.ts` defines the provider priority and fallback chain.

---

## Provider Risk Assessment

### NVIDIA NIM (Primary)

| Risk Category | Assessment | Mitigation |
|---------------|------------|------------|
| **Data retention** | NVIDIA does not store API requests by default (zero data retention) | ✅ Acceptable — data not persisted by vendor |
| **Data training** | NVIDIA may use API inputs for model improvement unless opted out | ⚠️ Mitigate: Review NVIDIA API terms quarterly; no PII sent to provider |
| **Encryption in transit** | TLS 1.2+ enforced | ✅ Acceptable |
| **Encryption at rest** | Not applicable (no data stored) | ✅ N/A |
| **SOC 2 compliance** | NVIDIA has SOC 2 Type II certification | ✅ Acceptable |
| **Availability SLA** | 99.9% uptime for API endpoints | ✅ Acceptable |
| **Regional data residency** | US-based endpoints | ⚠️ Accept for US customers; flag for EU expansion |
| **Authentication** | API key with per-project quotas | ✅ API key stored encrypted (`API_KEY_ENCRYPTION_KEY`) |

### Fireworks AI (Backup)

| Risk Category | Assessment | Mitigation |
|---------------|------------|------------|
| **Data retention** | Requests not stored after response delivery | ✅ Acceptable |
| **Data training** | Opt-out available via API parameters | ✅ Configured in `ai-config.ts` |
| **Encryption** | TLS 1.2+ | ✅ Acceptable |
| **SOC 2 compliance** | SOC 2 Type II certified | ✅ Acceptable |
| **Availability** | 99.9% SLA; free tier may have rate limits | ⚠️ Rate limit handling implemented in retry logic |

### Groq (Fallback)

| Risk Category | Assessment | Mitigation |
|---------------|------------|------------|
| **Data retention** | Zero data retention policy | ✅ Acceptable |
| **Data training** | No training on customer data | ✅ Acceptable |
| **Encryption** | TLS 1.2+ | ✅ Acceptable |
| **Availability** | Free tier; may have regional blocking | ⚠️ Fallback to Gemini if Groq unavailable |

### Google Gemini (Last-Resort)

| Risk Category | Assessment | Mitigation |
|---------------|------------|------------|
| **Data retention** | Up to 30 days for abuse monitoring | ⚠️ Accept: no sensitive PII sent to Gemini |
| **Data training** | Opt-out required via API config | ✅ Configured in `ai-config.ts` |
| **Encryption** | TLS 1.2+; data encrypted at rest in Google Cloud | ✅ Acceptable |
| **SOC 2 compliance** | Google Cloud SOC 2 Type II | ✅ Acceptable |
| **Regional blocking** | May block certain regions | ⚠️ Last-resort fallback; template fallback if blocked |

---

## Data Processing Agreements (DPAs)

| Provider | DPA Status | Key Terms |
|----------|-----------|-----------|
| NVIDIA | Signed (Q1 2026) | Zero data retention; no training; breach notification 72h |
| Fireworks AI | Signed (Q1 2026) | No data retention; no training; 24h breach notification |
| Groq | Standard ToS (pending DPA) | Zero retention; following up on formal DPA |
| Google Gemini | Google Cloud DPA | Standard Google Cloud terms; 30-day retention for abuse |

**DPAs stored at:** `docs/compliance/dpa/` (restricted access — admin only)

---

## Model Output Monitoring

### Hallucination Prevention

DeepMindQ implements a multi-layer hallucination prevention system:

1. **Confidence floor:** All AI-generated insights must meet a minimum confidence threshold (0.3 default). Implementation: `src/lib/ai/confidence-floor.ts`
2. **Source provenance:** Every AI claim is tagged with its source (which provider, which model, which input context). Implementation: `src/components/intelligence-os/atoms/source-provenance-badge.tsx`
3. **Evidence chain:** AI outputs are validated against a structured evidence pipeline before surfacing to users. Tests: `tests/ai/evidence-adapter.test.ts`
4. **Human assistance triggers:** Low-confidence results trigger human review prompts. Implementation: `src/components/intelligence-os/molecules/human-assistance-banner.tsx`

### Output Quality Monitoring

| Metric | Threshold | Action |
|--------|-----------|--------|
| Confidence score | < 0.3 | Flag for human review |
| Hallucination rate | > 5% | Alert AI governance team |
| Provider error rate | > 10% | Automatic provider demotion in cascade |
| Response latency | > 10s | Fallback to next provider |

**Governance tests:** `tests/ai/ai-governance-certification.test.ts`, `tests/ai/ai-hallucination-certification-m3.test.ts`

---

## Vendor Security Questionnaire Summary

| Question | NVIDIA | Fireworks | Groq | Gemini |
|----------|--------|----------|------|--------|
| SOC 2 Type II? | ✅ Yes | ✅ Yes | ❌ No (Q3 2026) | ✅ Yes (via GCP) |
| ISO 27001? | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| Data encryption at rest? | N/A (no storage) | ✅ AES-256 | ✅ AES-256 | ✅ AES-256 |
| Data encryption in transit? | ✅ TLS 1.2+ | ✅ TLS 1.2+ | ✅ TLS 1.2+ | ✅ TLS 1.2+ |
| Data retention? | Zero | Zero | Zero | 30 days |
| Sub-processor list? | ✅ Available | ✅ Available | ⚠️ Limited | ✅ Available |
| Breach notification? | 72 hours | 24 hours | 48 hours | 72 hours |
| Right to audit? | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |

---

## Risk Mitigation Controls Summary

1. **No PII to LLM providers:** Customer data sent to AI providers is anonymized/pseudonymized before transmission. Implementation: `src/lib/ai/prompt-sanitizer.ts`
2. **Encrypted API keys:** All provider API keys are encrypted at rest using `API_KEY_ENCRYPTION_KEY` in `src/lib/crypto/encryption.ts`
3. **Cascading fallback:** If any provider fails or is compromised, the system automatically cascades to the next provider and eventually to deterministic template responses
4. **Output validation:** All AI outputs pass through the confidence floor and evidence pipeline before surfacing to users
5. **Quarterly vendor review:** AI governance team reviews vendor security posture and ToS changes every quarter
6. **Audit trail:** All AI interactions are logged to the `AuditLog` table with provider, model, confidence, and outcome
