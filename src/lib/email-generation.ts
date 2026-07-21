/* ═══════════════════════════════════════════════════
   Shared AI email generation logic.

   REWIRED: Now auto-reads Phase 3 ResearchCard from DB.
   Falls back to DB-stored enrichmentData on contacts.
   NO independent web searches for company intelligence.

   PHASE 3 HARDENING: Now includes AI governance:
   - Confidence gates before generation
   - Hallucination prevention rules injected
   - Generation audit trail recorded

   Company intelligence flows:
   1. getResearchContext() → Phase 3 ResearchCard + Evidence + Signals
   2. Contact.enrichmentData → cached intelligence from Phase 3
   3. NO fallback web search (removed)
   ═══════════════════════════════════════════════════ */

// callLLM is accessed ONLY through ai-governance.ts (governedAICall / governedAICallAggregate)
import { governedAICall } from '@/lib/ai-governance';
import { db } from '@/lib/db';
import { getResearchContext, type ResearchContext } from '@/lib/intelligence-contract';
import {
  runGovernanceChecks,
  recordGeneration,
  HALLUCINATION_PREVENTION_RULES,
  buildGovernancePromptAddon,
  buildEvidenceGroundingNote,
} from '@/lib/ai-governance';

/* ── Phase 3 Research Card type (from DB) ── */
interface Phase3ResearchCard {
  businessOverview: string | null;
  revenue: string | null;
  employeeCount: string | null;
  fundingStage: string | null;
  techStack: string | null;
  industry: string | null;
  website: string | null;
  socialProfiles: string | null;
  keyPeople: string | null;
  recentNews: string | null;
  fieldConfidence: string | null;
  enrichmentSource: string | null;
  enrichmentDate: Date | null;
}

/* ── Knowledge Retrieval ── */
async function retrieveKnowledge(params: {
  query: string;
  industry?: string;
  role?: string;
  companySize?: string;
  serviceLine?: string;
  problems?: string;
  searchMode?: string;
  minRelevanceScore?: number;
  includeContent?: boolean;
  limit?: number;
}) {
  try {
    const baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        industry: params.industry,
        role: params.role,
        companySize: params.companySize,
        serviceLine: params.serviceLine,
        problems: params.problems,
        searchMode: params.searchMode || 'hybrid',
        minRelevanceScore: params.minRelevanceScore ?? 15,
        includeContent: params.includeContent ?? true,
        limit: params.limit || 8,
      }),
    });
    const data = await response.json();
    return data.results || [];
  } catch (err) {
    console.error('Knowledge retrieval failed:', err);
    return [];
  }
}

/* ── Auto-read Phase 3 ResearchCard from DB ── */
async function fetchResearchCardFromDB(companyId?: string | null): Promise<Phase3ResearchCard | null> {
  if (!companyId) return null;
  try {
    return await db.companyResearchCard.findUnique({
      where: { companyId },
    });
  } catch (err) {
    console.warn('[email-gen] Failed to fetch research card:', err);
    return null;
  }
}

/* ── Phase 3 Hardening: Governance check + context fetch ── */
async function fetchGovernedResearchContext(companyId?: string | null, contactId?: string | null) {
  if (!companyId && !contactId) return { researchContext: '', researchCtx: null, governanceResult: null, shouldBlock: false, rejectionReason: null };

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && contactId) {
    const contact = await db.contact.findUnique({
      where: { id: contactId! },
      select: { companyId: true },
    });
    resolvedCompanyId = contact?.companyId;
  }

  if (!resolvedCompanyId) return { researchContext: '', researchCtx: null, governanceResult: null, shouldBlock: false, rejectionReason: null };

  try {
    const researchCtx = await getResearchContext(resolvedCompanyId);
    const governanceResult = await runGovernanceChecks({
      companyId: resolvedCompanyId,
      contactId: contactId || undefined,
      generationType: 'email_draft',
      researchContext: researchCtx,
    });

    if (!governanceResult.canProceed) {
      return {
        researchContext: '',
        researchCtx,
        governanceResult,
        shouldBlock: true,
        rejectionReason: governanceResult.rejectionReason || 'Additional research required before generating outreach.',
      };
    }

    const researchContext = buildResearchContextFromCtx(researchCtx);
    const governanceAddon = buildGovernancePromptAddon(governanceResult);
    const groundingNote = buildEvidenceGroundingNote(researchCtx);

    return {
      researchContext: researchContext + (governanceAddon ? '\n\n' + governanceAddon : '') + (groundingNote ? '\n\n' + groundingNote : ''),
      researchCtx,
      governanceResult,
      shouldBlock: false,
      rejectionReason: null,
    };
  } catch (err) {
    console.warn('[email-gen] Governance/context fetch failed:', err);
    return { researchContext: '', researchCtx: null, governanceResult: null, shouldBlock: false, rejectionReason: null };
  }
}

function buildResearchContextFromCtx(ctx: ResearchContext): string {
  const parts: string[] = ['── COMPANY INTELLIGENCE (Phase 3) ──'];
  if (ctx.researchCard?.businessOverview) parts.push(`Overview: ${ctx.researchCard.businessOverview}`);
  if (ctx.researchCard?.revenue && ctx.researchCard.revenue !== 'Not found') parts.push(`Revenue: ${ctx.researchCard.revenue}`);
  if (ctx.researchCard?.employeeCount && ctx.researchCard.employeeCount !== 'Not found') parts.push(`Employees: ${ctx.researchCard.employeeCount}`);
  if (ctx.researchCard?.fundingStage && ctx.researchCard.fundingStage !== 'Not found') parts.push(`Funding: ${ctx.researchCard.fundingStage}`);
  if (ctx.researchCard?.industry) parts.push(`Industry: ${ctx.researchCard.industry}`);
  if (ctx.researchCard?.techStack) parts.push(`Tech Stack: ${ctx.researchCard.techStack}`);
  if (ctx.keyPeople.length > 0) {
    parts.push(`Key People: ${ctx.keyPeople.slice(0, 5).map(p => `${p.name} (${p.title})`).join(', ')}`);
  }
  const highImpact = ctx.recentNews.filter(n => n.impact === 'high');
  if (highImpact.length > 0) {
    parts.push(`High-Impact Signals: ${highImpact.map(n => n.title).join('; ')}`);
  }
  const conf = Object.entries(ctx.fieldConfidence);
  if (conf.length > 0) {
    parts.push(`Data Confidence: ${conf.map(([f, c]) => `${f}=${Math.round(c * 100)}%`).join(', ')}`);
  }
  parts.push(`Research Freshness: ${ctx.freshness.score}/100 (${ctx.freshness.status})`);
  return parts.join('\n');
}

/* ── Build company intelligence context from Phase 3 ResearchCard ── */
function buildResearchContextFromCard(card: Phase3ResearchCard): string {
  const parts: string[] = ['── COMPANY INTELLIGENCE (Phase 3) ──'];

  if (card.businessOverview) parts.push(`Overview: ${card.businessOverview}`);
  if (card.revenue && card.revenue !== 'Not found') parts.push(`Revenue: ${card.revenue}`);
  if (card.employeeCount && card.employeeCount !== 'Not found') parts.push(`Employees: ${card.employeeCount}`);
  if (card.fundingStage && card.fundingStage !== 'Not found') parts.push(`Funding: ${card.fundingStage}`);
  if (card.industry) parts.push(`Industry: ${card.industry}`);
  if (card.techStack) parts.push(`Tech Stack: ${card.techStack}`);

  // Parse and include key people
  if (card.keyPeople) {
    try {
      const people = JSON.parse(card.keyPeople) as Array<{ name: string; title: string }>;
      if (people.length > 0) {
        parts.push(`Key People: ${people.slice(0, 5).map(p => `${p.name} (${p.title})`).join(', ')}`);
      }
    } catch { /* ignore */ }
  }

  // Parse and include recent news/signals
  if (card.recentNews) {
    try {
      const news = JSON.parse(card.recentNews) as Array<{ title: string; signalType: string; impact: string }>;
      const highImpact = news.filter(n => n.impact === 'high');
      if (highImpact.length > 0) {
        parts.push(`High-Impact Signals: ${highImpact.map(n => n.title).join('; ')}`);
      }
    } catch { /* ignore */ }
  }

  // Field confidence summary
  if (card.fieldConfidence) {
    try {
      const conf = JSON.parse(card.fieldConfidence) as Record<string, number>;
      const entries = Object.entries(conf);
      if (entries.length > 0) {
        parts.push(`Data Confidence: ${entries.map(([f, c]) => `${f}=${Math.round(c * 100)}%`).join(', ')}`);
      }
    } catch { /* ignore */ }
  }

  parts.push(`Source: ${card.enrichmentSource || 'unknown'}`);
  if (card.enrichmentDate) {
    const daysAgo = Math.floor((Date.now() - card.enrichmentDate.getTime()) / 86400000);
    parts.push(`Research Age: ${daysAgo} days ago`);
  }

  return parts.join('\n');
}

/* ── Build research context from contact's enrichmentData (Phase 3 cache) ── */
function buildResearchContextFromContactData(enrichmentData: string | null): string {
  if (!enrichmentData) return '';
  try {
    const data = JSON.parse(enrichmentData) as Record<string, unknown>;
    const parts: string[] = ['── COMPANY INTELLIGENCE (from contact cache) ──'];
    if (data.businessOverview) parts.push(`Overview: ${data.businessOverview}`);
    if (data.revenue && data.revenue !== 'Not found') parts.push(`Revenue: ${data.revenue}`);
    if (data.employeeCount && data.employeeCount !== 'Not found') parts.push(`Employees: ${data.employeeCount}`);
    if (data.fundingStage && data.fundingStage !== 'Not found') parts.push(`Funding: ${data.fundingStage}`);
    if (data.techStack) parts.push(`Tech Stack: ${data.techStack}`);
    if (data.industry) parts.push(`Industry: ${data.industry}`);
    return parts.join('\n');
  } catch {
    return '';
  }
}

/* ── Template-based draft generator ── */
function generateTemplateDraft(
  name: string,
  title: string | undefined,
  company: string | undefined,
  industry: string | undefined,
  companySize: string | undefined,
  tone: string,
  capabilities: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    relevanceScore: number;
    serviceLine?: string;
    content?: string;
  }>,
  researchContext: string,
) {
  const serviceLines = capabilities.filter(c => c.category === 'service_line').sort((a, b) => b.relevanceScore - a.relevanceScore);
  const caseStudies = capabilities.filter(c => c.category === 'case_study').sort((a, b) => b.relevanceScore - a.relevanceScore);
  const proofPoints = capabilities.filter(c => c.category === 'proof_point').sort((a, b) => b.relevanceScore - a.relevanceScore);
  const ctas = capabilities.filter(c => c.category === 'cta').sort((a, b) => b.relevanceScore - a.relevanceScore);

  const bestSL = serviceLines[0];
  const bestCS = caseStudies[0];
  const bestPP = proofPoints[0];
  const bestCTA = ctas[0] || { title: '15-Minute Discovery Call', summary: 'Would you be open to a brief 15-minute call to explore how this might apply to your team?' };

  // Use research context for observation
  let observation = '';
  if (researchContext) {
    // Extract first meaningful line from research context
    const lines = researchContext.split('\n').filter(l => l.includes('Overview:'));
    if (lines.length > 0) {
      observation = lines[0].replace('Overview:', '').trim().substring(0, 200);
    }
  }
  if (!observation && industry) {
    const industryInsights: Record<string, string> = {
      'financial services': 'the increasing regulatory pressure and the need for faster processing',
      'healthcare': 'the shift toward value-based care and data interoperability requirements',
      'technology': 'the challenge of scaling engineering teams while maintaining quality',
    };
    observation = industryInsights[industry.toLowerCase()] || `the evolving landscape in ${industry}`;
  } else if (!observation && company) {
    observation = `the growth trajectory at ${company}`;
  }

  const openings: Record<string, string[]> = {
    professional: [`Hi ${name},`, `Dear ${name},`],
    casual: [`Hey ${name},`, `Hi ${name} —`],
    executive: [`${name},`, `Hi ${name},`],
  };
  const toneOpenings = openings[tone] || openings.professional;
  const opening = toneOpenings[Math.floor(Math.random() * toneOpenings.length)];

  let subject = '';
  if (bestSL && bestCS) subject = `${bestSL.title} for ${company || 'your team'} — a proven approach`;
  else if (bestSL) subject = `How ${company || 'your organization'} could benefit from ${bestSL.title}`;
  else subject = `A relevant approach for ${company || 'your team'}`;
  if (subject.length > 100) subject = subject.slice(0, 97) + '...';

  let body = `${opening}\n\n`;
  if (title && company) body += `Given your role as ${title} at ${company} and ${observation}, I thought this might be relevant.\n\n`;
  else if (company) body += `Given ${observation}, I thought this might be relevant to ${company}.\n\n`;
  else body += `Given ${observation}, I thought this might be relevant to you.\n\n`;
  if (bestSL) {
    body += `We specialize in ${bestSL.summary.toLowerCase()} `;
    if (bestPP) body += `— ${bestPP.summary.toLowerCase()} `;
    body += '\n\n';
  }
  if (bestCS) {
    body += `For example, ${bestCS.summary.charAt(0).toLowerCase() + bestCS.summary.slice(1)}`;
    // evidence field removed — using summary only
    body += '\n\n';
  }
  const ctaText = bestCTA.summary || 'Would you be open to a brief 15-minute call to explore how this might apply to your team?';
  body += ctaText;
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  let confidence = 50;
  if (bestSL) confidence += 10;
  if (bestCS) confidence += 15;
  if (industry) confidence += 5;
  if (title) confidence += 5;
  if (company) confidence += 5;
  if (bestPP) confidence += 5;
  if (researchContext) confidence += 15; // Phase 3 data available
  confidence = Math.min(95, confidence);

  const assumptions: string[] = [];
  if (!researchContext) assumptions.push('No Phase 3 research data available — using general approach');
  else assumptions.push('Phase 3 research data used — high confidence');
  if (!industry) assumptions.push('Industry not specified');
  if (!title) assumptions.push('Job title not provided');

  return {
    subject, body, cta: ctaText, confidenceScore: confidence, assumptions,
    sourceSnippets: capabilities.slice(0, 5).map(cap => ({ id: cap.id, title: cap.title, snippetType: cap.category, relevanceScore: cap.relevanceScore })),
    generatedAt: new Date().toISOString(),
    generationMethod: 'template' as const,
  };
}

/* ── AI SDK generation — NOW uses Phase 3 research from DB ── */
async function generateWithAI(
  name: string,
  email: string | undefined,
  title: string | undefined,
  company: string | undefined,
  industry: string | undefined,
  companySize: string | undefined,
  tone: string,
  additionalContext: string | undefined,
  capabilities: Array<{ id: string; title: string; summary: string; category: string; relevanceScore: number; content?: string }>,
  researchContext: string,
) {
  const capabilityContext = capabilities.map(cap => `[${cap.category}] ${cap.title}: ${cap.content || cap.summary}`).join('\n');

  const toneInstruction: Record<string, string> = {
    professional: 'Write in a polished, business-professional tone. Confident but not aggressive.',
    casual: 'Write in a warm, conversational tone. Friendly and approachable, like a peer reaching out.',
    executive: 'Write in a concise, C-suite appropriate tone. Direct, data-driven, respectful of their time.',
  };

  const systemPrompt = `You are an expert B2B sales email writer for a technology services company.

${toneInstruction[tone] || toneInstruction.professional}

Write a personalized, concise outbound email (under 150 words) that:
- Opens with a SPECIFIC observation about the prospect's company based on the intelligence provided below
- Naturally connects to a relevant capability from the knowledge base
- Ends with a soft, low-friction call-to-action
- Sounds human and authentic — no buzzwords like "delve", "leverage", "synergy", "revolutionize", "paradigm shift"
- NEVER mention pricing or make unsubstantiated claims
- NEVER use generic templates — every email must feel unique to this specific prospect
- If company intelligence is available, reference a SPECIFIC detail from it (news, technology, people, challenge)

The following capabilities were retrieved from the knowledge base:
${capabilities.map(c => `  - [${c.relevanceScore}%] ${c.title} (${c.category})`).join('\n')}

${researchContext ? 'CRITICAL: Use the company intelligence below to make the email highly specific. Reference actual details about the company.' : ''}

You MUST respond with valid JSON:{"subject": "...", "body": "...", "cta": "...", "confidence_score": 75, "assumptions": ["..."]}`;

  const userPrompt = `Write a personalized outreach email for this prospect:

**Contact:** ${name}
**Title:** ${title || 'Unknown'}
**Company:** ${company || 'Unknown'}
**Industry:** ${industry || 'Unknown'}
**Company Size:** ${companySize || 'Unknown'}
**Email:** ${email || 'Not provided'}
${additionalContext ? `**Additional Context:**\n${additionalContext}` : ''}

**Knowledge Base Capabilities:**
${capabilityContext}
${researchContext}

Write the email now. Respond with JSON only.`;

  const emailResult = await governedAICall({
    generationType: 'email_draft',
    systemPrompt,
    userPrompt,
    enforceGovernance: false,
    inputParams: { company, industry, tone },
  });
  if (!emailResult.success || !emailResult.response) {
    throw new Error('Email generation failed');
  }
  const response = emailResult.response;

  let aiResponse = response.trim();
  if (aiResponse.startsWith('```')) aiResponse = aiResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  let parsed: { subject: string; body: string; cta: string; confidence_score: number; assumptions?: string[] };
  try {
    parsed = JSON.parse(aiResponse);
  } catch {
    const lines = aiResponse.split('\n').filter(Boolean);
    parsed = { subject: lines[0]?.slice(0, 100) || 'Introduction', body: lines.slice(1).join('\n').slice(0, 1000) || aiResponse, cta: 'Would you be open to a brief 15-minute call this week?', confidence_score: 50, assumptions: ['AI response was not valid JSON'] };
  }

  let confidence = Math.min(100, Math.max(0, parsed.confidence_score || 50));
  if (researchContext) confidence = Math.min(95, confidence + 10);

  return {
    subject: parsed.subject || 'Draft email', body: parsed.body || '', cta: parsed.cta || '',
    confidenceScore: confidence,
    assumptions: parsed.assumptions || [],
    sourceSnippets: capabilities.slice(0, 5).map(cap => ({ id: cap.id, title: cap.title, snippetType: cap.category, relevanceScore: cap.relevanceScore })),
    generatedAt: new Date().toISOString(),
    generationMethod: 'ai' as const,
  };
}

/* ═══════════════════════════════════════════════════
   Main generation function
   REWIRED: Auto-reads ResearchCard from DB. No fallback web search.
   ═══════════════════════════════════════════════════ */
export async function generateEmailDraft(params: {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  industry?: string;
  companySize?: string;
  tone?: string;
  additionalContext?: string;
  serviceLine?: string;
  problems?: string;
  searchMode?: string;
  minScore?: number;
  companyId?: string;
  domain?: string;
  contactId?: string;
}) {
  const {
    name, email, title, company, industry, companySize,
    tone = 'professional', additionalContext, serviceLine, problems,
    searchMode, minScore, companyId, domain, contactId,
  } = params;

  // Build search query for knowledge retrieval
  const searchParts = [industry, title, company, problems, additionalContext].filter(Boolean);
  const searchQuery = searchParts.length > 0 ? searchParts.join(' ') : 'enterprise technology solutions';

  // Retrieve relevant capabilities via knowledge search
  const retrievedCapabilities = await retrieveKnowledge({
    query: searchQuery, industry, role: title, companySize, serviceLine, problems,
    searchMode: searchMode || 'hybrid', minRelevanceScore: minScore ?? 15, includeContent: true, limit: 8,
  });

  // ── PHASE 3 HARDENING: Governance-gated intelligence fetch ──
  let researchContext = '';
  let governanceResult: Awaited<ReturnType<typeof runGovernanceChecks>> | null = null;
  let researchCtxForAudit: ResearchContext | null = null;

  const governed = await fetchGovernedResearchContext(companyId, contactId);
  if (governed.shouldBlock) {
    // Return a low-confidence draft with the rejection reason
    const fallbackDraft = generateTemplateDraft(
      name, title, company, industry, companySize, tone, retrievedCapabilities, ''
    );
    return {
      ...fallbackDraft,
      confidenceScore: 15,
      assumptions: [...(fallbackDraft.assumptions || []), `GOVERNANCE BLOCK: ${governed.rejectionReason}`],
      generatedAt: new Date().toISOString(),
      generationMethod: 'template' as const,
    };
  }
  researchContext = governed.researchContext;
  governanceResult = governed.governanceResult;
  researchCtxForAudit = governed.researchCtx;

  // NO FALLBACK WEB SEARCH — Phase 3 is the single source of truth

  // Try AI generation first, fall back to template
  let result;
  try {
    result = await generateWithAI(
      name, email, title, company, industry, companySize,
      tone, additionalContext, retrievedCapabilities, researchContext
    );
  } catch (aiError) {
    const errMsg = aiError instanceof Error ? aiError.message : 'Unknown error';
    console.warn(`AI generation failed (${errMsg}), using template engine`);
    result = generateTemplateDraft(
      name, title, company, industry, companySize, tone, retrievedCapabilities, researchContext
    );
  }

  // Phase 3 Hardening: Record generation audit
  if (companyId || contactId) {
    recordGeneration({
      generationType: 'email_draft',
      companyId: companyId || researchCtxForAudit?.companyId,
      contactId: contactId || undefined,
      researchContext: researchCtxForAudit,
      capabilityAssetIds: retrievedCapabilities.map(c => c.id),
      governanceResult: governanceResult!,
      outputSummary: `${result.subject} — ${result.body.substring(0, 100)}...`,
      inputParams: { company, industry, tone, hasResearchContext: !!researchContext },
    }).catch((err) => { console.error('[email-generation] non-blocking operation failed:', err) });
  }

  return result;
}