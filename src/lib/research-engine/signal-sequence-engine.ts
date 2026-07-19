/**
 * Signal-Driven Sequence Engine (Phase 4 — Track C1)
 *
 * Generates a multi-step outreach sequence based on:
 *   - A buying signal (why now?)
 *   - A capability match (why this capability?)
 *   - Company research intelligence (why this company?)
 *   - Contact role relevance (why this person?)
 *
 * The sequence answers the four "why" questions through AI-generated
 * email steps that are specific, timely, and relevant.
 *
 * Uses governedAICallAggregate for LLM calls (never calls callLLM directly).
 */

import { db } from '@/lib/db';
import { governedAICallAggregate } from '@/lib/ai-governance';

// ── Types ──

export interface SignalDrivenSequenceStep {
  stepNumber: number;
  subject: string;
  body: string;
  cta: string;
  delayDays: number;
  stepPurpose: string;
}

export interface SignalDrivenSequenceResult {
  sequence: {
    id: string;
    name: string;
    description: string;
    triggerReason: string;
    steps: SignalDrivenSequenceStep[];
  };
}

// ── System Prompt ──

const SEQUENCE_GENERATION_SYSTEM_PROMPT = `You are an expert B2B sales strategist at a leading technology consultancy. Your task is to generate a 3-step email outreach sequence that is signal-driven, highly personalized, and professionally compelling.

## Sequence Structure

You MUST generate exactly 3 steps:

**Step 1 — Executive Insight Email (delayDays: 0)**
- Opens with a reference to a specific buying signal or trigger event at the prospect's company
- Establishes relevance by connecting the signal to the prospect's industry and strategic priorities
- Brief, punchy, and insightful — no generic filler
- Ends with a soft question or invitation to connect

**Step 2 — Value Proof Email (delayDays: 4)**
- References the specific capability/solution that maps to the detected business problem
- Includes a relevant case study reference, proof point, or evidence
- Demonstrates expertise and credibility
- Maintains the narrative from Step 1

**Step 3 — Conversation Request (delayDays: 3)**
- Soft, low-friction CTA to schedule a brief conversation
- Summarizes the value proposition concisely
- References the signal/timing urgency without being aggressive
- Professional close

## Placeholders

Use these exact placeholders in subjects and bodies (the system will replace them):
- {{name}} — contact's first name
- {{company}} — company name
- {{title}} — contact's job title

## Style Rules

- Executive tone — concise, insightful, no buzzword soup
- Every sentence must earn its place
- NO hallucinated data, metrics, or case studies — only reference what is provided in the context
- Personalize to the specific signal, company, and contact role
- Subject lines must be compelling and specific (not generic)

## Output Format

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "name": "Short descriptive sequence name",
  "description": "Brief description of the sequence strategy",
  "triggerReason": "One paragraph explaining: why this company (industry/size/priorities), why now (the signal/timing), why this capability (relevance to business problem), why this person (role relevance)",
  "steps": [
    {
      "stepNumber": 1,
      "subject": "Subject line with {{name}} or {{company}}",
      "body": "Email body with {{name}}, {{company}}, {{title}} placeholders...",
      "cta": "The specific call-to-action text",
      "delayDays": 0,
      "stepPurpose": "Executive insight — establish relevance via signal"
    },
    {
      "stepNumber": 2,
      "subject": "Follow-up subject",
      "body": "Value proof body...",
      "cta": "The specific call-to-action text",
      "delayDays": 4,
      "stepPurpose": "Value proof — demonstrate capability with evidence"
    },
    {
      "stepNumber": 3,
      "subject": "Meeting request subject",
      "body": "Conversation request body...",
      "cta": "The specific call-to-action text",
      "delayDays": 3,
      "stepPurpose": "Conversation request — soft CTA for meeting"
    }
  ]
}`;

// ── Main Function ──

export async function generateSignalDrivenSequence(params: {
  companyId: string;
  signalId: string;
  capabilityMatchId: string;
  contactId: string;
}): Promise<SignalDrivenSequenceResult> {
  const { companyId, signalId, capabilityMatchId, contactId } = params;

  // 1. Load the signal
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
  });
  if (!signal) throw new Error(`Signal ${signalId} not found`);

  // 2. Load the capability match
  const match = await db.signalCapabilityMatch.findUnique({
    where: { id: capabilityMatchId },
  });
  if (!match) throw new Error(`Capability match ${capabilityMatchId} not found`);

  // 3. Load the capability asset
  const capability = await db.capabilityAsset.findUnique({
    where: { id: match.capabilityId },
  });
  if (!capability) throw new Error(`Capability asset ${match.capabilityId} not found`);

  // 4. Load the company research card
  const researchCard = await db.companyResearchCard.findUnique({
    where: { companyId },
  });

  // 5. Load the contact with company
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: { company: true },
  });
  if (!contact) throw new Error(`Contact ${contactId} not found`);

  // 6. Build context for LLM
  const userPrompt = buildUserPrompt({
    signal,
    match,
    capability,
    researchCard,
    contact,
    company: contact.company,
  });

  // 7. Call LLM via governance layer
  const result = await governedAICallAggregate({
    generationType: 'sequence_generation',
    systemPrompt: SEQUENCE_GENERATION_SYSTEM_PROMPT,
    userPrompt,
    inputParams: {
      companyId,
      signalId,
      capabilityMatchId,
      contactId,
      signalType: signal.signalType,
      capabilityTitle: capability.title,
    },
  });

  if (!result.success || !result.response) {
    throw new Error(
      result.rejectionReason || 'Failed to generate signal-driven sequence via LLM',
    );
  }

  // 8. Parse LLM response
  const parsed = parseSequenceResponse(result.response);

  // 9. Create the EmailSequence record
  const sequence = await db.emailSequence.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      generatedBy: 'signal_driven',
      companyId,
      triggerSignalId: signalId,
      triggerCapabilityMatchId: capabilityMatchId,
      triggerReason: parsed.triggerReason,
      steps: {
        create: parsed.steps.map((step) => ({
          stepNumber: step.stepNumber,
          subject: step.subject,
          body: step.body,
          cta: step.cta,
          delayDays: step.delayDays,
        })),
      },
    },
    include: {
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  return {
    sequence: {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description || '',
      triggerReason: sequence.triggerReason || '',
      steps: sequence.steps.map((s) => ({
        stepNumber: s.stepNumber,
        subject: s.subject,
        body: s.body,
        cta: s.cta || '',
        delayDays: s.delayDays,
        stepPurpose:
          parsed.steps.find((p) => p.stepNumber === s.stepNumber)?.stepPurpose || '',
      })),
    },
  };
}

// ── Helpers ──

function buildUserPrompt(ctx: {
  signal: {
    signalType: string;
    title: string;
    description: string | null;
    impact: string;
    severity: string;
    source: string | null;
    buyingArea: string | null;
    techRequirement: string | null;
    serviceRequirement: string | null;
  };
  match: {
    matchScore: number;
    reason: string;
    businessProblem: string | null;
    expectedOutcome: string | null;
    salesAngle: string | null;
  };
  capability: {
    title: string;
    summary: string;
    category: string;
    serviceLine: string | null;
    businessProblem: string | null;
    customerOutcome: string | null;
    differentiator: string | null;
    caseStudyRef: string | null;
    proofPointRef: string | null;
    solution: string | null;
    technology: string | null;
    industry: string | null;
  };
  researchCard: {
    businessOverview: string | null;
    techLandscape: string | null;
    potentialChallenges: string | null;
    possibleOpportunities: string | null;
    relevantServices: string | null;
    keyDecisionMakers: string | null;
    industry: string | null;
    revenue: string | null;
    employeeCount: string | null;
    fundingStage: string | null;
    strategicPriorities: string | null;
    businessProblems: string | null;
    transformationAreas: string | null;
    technologyThemes: string | null;
  } | null;
  contact: {
    normalizedName: string;
    title: string | null;
    role: string | null;
    email: string;
  };
  company: {
    normalizedName: string;
    industry: string | null;
    sizeRange: string | null;
    domain: string | null;
    internalSummary: string | null;
  };
}): string {
  const { signal, match, capability, researchCard, contact, company } = ctx;

  // Parse JSON fields from research card
  let strategicPriorities: string[] = [];
  let businessProblems: string[] = [];
  let transformationAreas: string[] = [];
  let technologyThemes: string[] = [];
  let caseStudies: Array<{ title: string; url?: string; industry?: string; outcome?: string }> = [];
  let proofPoints: Array<{ metric: string; value: string; context?: string }> = [];

  if (researchCard) {
    try { strategicPriorities = JSON.parse(researchCard.strategicPriorities || '[]'); } catch { /* empty */ }
    try { businessProblems = JSON.parse(researchCard.businessProblems || '[]'); } catch { /* empty */ }
    try { transformationAreas = JSON.parse(researchCard.transformationAreas || '[]'); } catch { /* empty */ }
    try { technologyThemes = JSON.parse(researchCard.technologyThemes || '[]'); } catch { /* empty */ }
  }

  if (capability.caseStudyRef) {
    try { caseStudies = JSON.parse(capability.caseStudyRef); } catch { /* empty */ }
  }
  if (capability.proofPointRef) {
    try { proofPoints = JSON.parse(capability.proofPointRef); } catch { /* empty */ }
  }

  return `Generate a 3-step signal-driven outreach sequence with the following intelligence:

## WHY THIS COMPANY
- Company: ${company.normalizedName}
- Industry: ${company.industry || 'Unknown'}
- Company Size: ${company.sizeRange || 'Unknown'}
- Domain: ${company.domain || 'Unknown'}
- Internal Summary: ${company.internalSummary || 'Not available'}
- Business Overview: ${researchCard?.businessOverview || 'Not available'}
- Revenue: ${researchCard?.revenue || 'Unknown'}
- Employees: ${researchCard?.employeeCount || 'Unknown'}
- Funding Stage: ${researchCard?.fundingStage || 'Unknown'}
- Strategic Priorities: ${strategicPriorities.length > 0 ? strategicPriorities.map(p => typeof p === 'object' ? (p as { priority?: string; description?: string }).description || (p as { priority?: string; description?: string }).priority : p).join('; ') : 'Not identified'}
- Known Business Problems: ${businessProblems.join('; ') || 'Not identified'}
- Transformation Areas: ${transformationAreas.join('; ') || 'Not identified'}
- Technology Themes: ${technologyThemes.join('; ') || 'Not available'}

## WHY NOW (Signal)
- Signal Type: ${signal.signalType}
- Signal Title: ${signal.title}
- Signal Description: ${signal.description || 'No description'}
- Impact Level: ${signal.impact}
- Severity: ${signal.severity}
- Source: ${signal.source || 'Unknown'}
- Buying Area: ${signal.buyingArea || 'Not specified'}
- Tech Requirement: ${signal.techRequirement || 'Not specified'}
- Service Requirement: ${signal.serviceRequirement || 'Not specified'}

## WHY THIS CAPABILITY
- Capability: ${capability.title}
- Summary: ${capability.summary}
- Category: ${capability.category}
- Service Line: ${capability.serviceLine || 'Not specified'}
- Core Business Problem Addressed: ${capability.businessProblem || match.businessProblem || 'Not specified'}
- Expected Customer Outcome: ${capability.customerOutcome || match.expectedOutcome || 'Not specified'}
- Differentiator: ${capability.differentiator || 'Not specified'}
- Solution Name: ${capability.solution || 'Not specified'}
- Technology: ${capability.technology || 'Not specified'}
- Target Industry: ${capability.industry || 'Not specified'}
- Match Score: ${(match.matchScore * 100).toFixed(0)}%
- Match Reason: ${match.reason}
- Sales Angle: ${match.salesAngle || 'Not specified'}
- Case Studies Available: ${caseStudies.length > 0 ? caseStudies.map(c => `${c.title} (${c.industry || 'general'}) — ${c.outcome || 'see details'}`).join('; ') : 'None provided'}
- Proof Points: ${proofPoints.length > 0 ? proofPoints.map(p => `${p.metric}: ${p.value} ${p.context || ''}`).join('; ') : 'None provided'}

## WHY THIS PERSON
- Name: {{name}} (use placeholder)
- Title: {{title}} (use placeholder)
- Role: ${contact.role || contact.title || 'Unknown'}
- Company: {{company}} (use placeholder)

Now generate the 3-step sequence as JSON.`;
}

function parseSequenceResponse(response: string): {
  name: string;
  description: string;
  triggerReason: string;
  steps: SignalDrivenSequenceStep[];
} {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.name || !parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error('LLM response missing required fields (name, steps)');
  }

  if (parsed.steps.length !== 3) {
    throw new Error(`Expected 3 sequence steps, got ${parsed.steps.length}`);
  }

  for (const step of parsed.steps) {
    if (!step.stepNumber || !step.subject || !step.body || step.delayDays === undefined) {
      throw new Error('Each step must have stepNumber, subject, body, and delayDays');
    }
  }

  return {
    name: parsed.name,
    description: parsed.description || '',
    triggerReason: parsed.triggerReason || '',
    steps: parsed.steps.map((step: Record<string, unknown>) => ({
      stepNumber: step.stepNumber as number,
      subject: step.subject as string,
      body: step.body as string,
      cta: (step.cta as string) || '',
      delayDays: step.delayDays as number,
      stepPurpose: (step.stepPurpose as string) || '',
    })),
  };
}