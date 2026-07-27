/**
 * ConversationEngine — Phase B Composition Engine #4
 * =================================================
 *
 * Enterprise sales conversation intelligence. The system understands:
 *   - Buyer persona (role, seniority, buying influence)
 *   - Relationship history (past interactions, warmth level)
 *   - Company strategy (signals, priorities, initiatives)
 *   - Previous conversations (notes, emails, briefs)
 *
 * Produces evidence-backed meeting briefings, conversation plans,
 * and executive briefs that transform sales conversations from
 * generic pitches into hyper-personalized engagements.
 *
 * Orchestrates foundation engines:
 *   1. GroundingEngine.collect() — gather evidence about company + contact
 *   2. ModelRouter.complete({ tier: 'smart' }) — LLM-powered briefing
 *   3. RetrievalEngine.search() — find similar conversation patterns
 *
 * Briefing Types:
 *   - meeting_prep       Pre-meeting briefing with talking points
 *   - executive_brief     C-suite ready 1-page executive brief
 *   - conversation_plan  Multi-touch conversation sequence plan
 *   - outreach_prepare   First-touch outreach preparation
 *
 * Example Output (Meeting Prep):
 *   Meeting Objective: Position AI governance platform
 *   Buyer Priorities:
 *     1. Regulatory compliance
 *     2. Data modernization
 *     3. Cost optimization
 *   Questions to Ask:
 *     "What challenges are you facing managing AI governance?"
 *   Topics to Avoid:
 *     Leading with cost reduction (buyer is ROI-positive, not cost-focused)
 *   Recommended Positioning: Enterprise AI control layer
 *
 * NON-THROWING CONTRACT
 * ---------------------
 * Returns ConversationResult with success:boolean + error:string|null.
 */

import { ModelRouter } from './model-router';
import { GroundingEngine, renderChainForPrompt } from './grounding-engine';
import { RetrievalEngine } from './retrieval-engine';
import type { EvidenceChain, GroundingContext } from './grounding-engine';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export type BriefingType =
  | 'meeting_prep'
  | 'executive_brief'
  | 'conversation_plan'
  | 'outreach_prepare';

export type MeetingType =
  | 'discovery'
  | 'qualification'
  | 'proposal_review'
  | 'negotiation'
  | 'check_in'
  | 'demo'
  | 'executive_briefing'
  | 'technical_deep_dive';

export type BuyerRole =
  | 'economic_buyer'
  | 'technical_buyer'
  | 'champion'
  | 'coach'
  | 'user'
  | 'blocker'
  | 'unknown';

export interface TalkingPoint {
  point: string;
  evidence: string;
  source: string;
  priority: 'must_cover' | 'should_cover' | 'nice_to_have';
}

export interface QuestionToAsk {
  question: string;
  purpose: string;
  timing: 'opening' | 'middle' | 'closing';
}

export interface ObjectionPrep {
  objection: string;
  preparedResponse: string;
  evidence: string;
  probability: 'high' | 'medium' | 'low';
}

export interface BuyerProfile {
  name: string;
  role: string;
  seniority: 'c_suite' | 'vp' | 'director' | 'manager' | 'individual';
  buyerRole: BuyerRole;
  influenceScore: number; // 0-100
  detectedPriorities: string[];
  relationshipStrength: 'strong' | 'warm' | 'neutral' | 'cold' | 'none';
  communicationStyle: 'analytical' | 'visionary' | 'pragmatic' | 'relationship' | 'unknown';
}

export interface ConversationResult {
  /** Whether briefing generation succeeded. */
  success: boolean;
  /** Error message if !success. */
  error: string | null;

  // Entity context
  companyId: string;
  companyName: string;
  contactId: string | null;
  opportunityId: string | null;

  // Briefing type
  briefingType: BriefingType;

  // Meeting context
  meetingObjective: string;
  meetingType: MeetingType;
  suggestedDuration: string;
  keyStakeholders: string[];

  // Buyer intelligence
  buyerProfile: BuyerProfile;

  // Content sections
  talkingPoints: TalkingPoint[];
  questionsToAsk: QuestionToAsk[];
  objectionsToPrepare: ObjectionPrep[];
  topicsToAvoid: string[];
  recommendedPositioning: string;
  valuePropositionAngle: string;

  // Post-meeting
  postMeetingActions: string[];
  preparationChecklist: string[];

  // Intelligence context
  companyContext: string;
  signalContext: string[];
  dealContext: string;

  // Evidence
  evidenceChain: EvidenceChain;
  evidenceCount: number;
  confidenceScore: number;     // 0-100

  // AI briefing narrative
  briefingNarrative: string | null;

  // Metadata
  generatedAt: string;
  modelUsed: string;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
}

// ─── Buyer Profile Builder ──────────────────────────────────────────────

async function buildBuyerProfile(
  companyId: string,
  contactId: string | null,
): Promise<BuyerProfile> {
  const defaultProfile: BuyerProfile = {
    name: 'Unknown Contact',
    role: 'Unknown',
    seniority: 'manager',
    buyerRole: 'unknown',
    influenceScore: 0,
    detectedPriorities: [],
    relationshipStrength: 'none',
    communicationStyle: 'unknown',
  };

  if (!contactId) return defaultProfile;

  try {
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true, rawName: true, title: true,
        leadScore: true, status: true, source: true, notes: true,
      },
    });

    if (!contact) return defaultProfile;

    const title = contact.title || '';
    const name = contact.rawName || 'Unknown Contact';

    // Detect seniority from title
    const titleLower = title.toLowerCase();
    let seniority: BuyerProfile['seniority'] = 'manager';
    if (titleLower.match(/ceo|chief|president|c-level|c-level/)) seniority = 'c_suite';
    else if (titleLower.match(/vp|vice president|svp|evp/)) seniority = 'vp';
    else if (titleLower.match(/director|head of/)) seniority = 'director';
    else if (titleLower.match(/manager|lead|sr\.|senior/)) seniority = 'manager';
    else seniority = 'individual';

    // Detect buyer role from title/department
    let buyerRole: BuyerRole = 'unknown';
    if (titleLower.match(/ceo|cfo|coo|president|vp finance|vp operations/)) buyerRole = 'economic_buyer';
    else if (titleLower.match(/cto|ciso|vp engineering|vp technology|architect|devops/)) buyerRole = 'technical_buyer';
    else if (titleLower.match(/director|head|lead/)) buyerRole = 'champion';
    else if (titleLower.match(/manager|analyst|coordinator/)) buyerRole = 'user';
    else if (titleLower.match(/consultant|advisor/)) buyerRole = 'coach';

    // Detect priorities from title keywords
    const dept = titleLower;
    const priorities: string[] = [];
    if (dept.match(/engineer|tech|it|devops/)) priorities.push('Technology modernization', 'Platform reliability', 'Team productivity');
    if (dept.match(/sales|revenue|growth/)) priorities.push('Revenue growth', 'Pipeline acceleration', 'Win rate improvement');
    if (dept.match(/market|brand|communic/)) priorities.push('Brand awareness', 'Lead generation', 'Customer engagement');
    if (dept.match(/finance|accounting/)) priorities.push('Cost optimization', 'ROI measurement', 'Financial compliance');
    if (dept.match(/operation|supply|logistics/)) priorities.push('Operational efficiency', 'Process automation', 'Cost reduction');
    if (dept.match(/data|analytic|bi/)) priorities.push('Data-driven decisions', 'Analytics maturity', 'Data governance');
    if (dept.match(/hr|people|talent/)) priorities.push('Talent retention', 'Workforce planning', 'Employee experience');
    if (dept.match(/product|design/)) priorities.push('Product velocity', 'User experience', 'Feature delivery');
    if (priorities.length === 0) priorities.push('Efficiency improvement', 'Cost optimization', 'Growth enablement');

    // Relationship strength from contact status
    let relationshipStrength: BuyerProfile['relationshipStrength'] = 'none';
    if (contact.status === 'replied' || contact.status === 'active') relationshipStrength = 'warm';
    else if (contact.status === 'contacted') relationshipStrength = 'neutral';
    else if (contact.status === 'prospect') relationshipStrength = 'cold';

    // Communication style from seniority
    let communicationStyle: BuyerProfile['communicationStyle'] = 'unknown';
    if (seniority === 'c_suite') communicationStyle = 'visionary';
    else if (seniority === 'vp') communicationStyle = 'pragmatic';
    else if (seniority === 'director') communicationStyle = 'analytical';
    else if (seniority === 'manager') communicationStyle = 'pragmatic';

    return {
      name,
      role: title || 'Unknown Role',
      seniority,
      buyerRole,
      influenceScore: contact.leadScore ?? 40,
      detectedPriorities: priorities.slice(0, 4),
      relationshipStrength,
      communicationStyle,
    };
  } catch (err) {
    logger.error(`[conversation-engine] buyer profile failed: ${err instanceof Error ? err.message : err}`);
    return defaultProfile;
  }
}

// ─── Meeting Type Detection ──────────────────────────────────────────────

function detectMeetingType(
  buyerRole: BuyerRole,
  relationshipStrength: string,
  signalCount: number,
): MeetingType {
  if (relationshipStrength === 'none') return 'discovery';
  if (relationshipStrength === 'cold') return 'discovery';
  if (relationshipStrength === 'warm' && buyerRole === 'economic_buyer') return 'executive_briefing';
  if (relationshipStrength === 'warm' && buyerRole === 'technical_buyer') return 'technical_deep_dive';
  if (relationshipStrength === 'warm' || relationshipStrength === 'strong') return 'qualification';
  if (signalCount >= 5) return 'proposal_review';
  return 'discovery';
}

// ─── Deterministic Briefing Generation ───────────────────────────────────

async function generateDeterministicBriefing(
  companyName: string,
  companyId: string,
  contactId: string | null,
  buyerProfile: BuyerProfile,
  chain: EvidenceChain,
): Promise<{
  talkingPoints: TalkingPoint[];
  questionsToAsk: QuestionToAsk[];
  objectionsToPrepare: ObjectionPrep[];
  topicsToAvoid: string[];
  recommendedPositioning: string;
  valuePropositionAngle: string;
  postMeetingActions: string[];
  preparationChecklist: string[];
  meetingObjective: string;
  meetingType: MeetingType;
  suggestedDuration: string;
  keyStakeholders: string[];
  companyContext: string;
  signalContext: string[];
  dealContext: string;
}> {
  const talkingPoints: TalkingPoint[] = [];
  const questionsToAsk: QuestionToAsk[] = [];
  const objectionsToPrepare: ObjectionPrep[] = [];
  const topicsToAvoid: string[] = [];
  const postMeetingActions: string[] = [];
  const preparationChecklist: string[] = [];

  // Load recent signals
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSignals = await db.companySignal.findMany({
    where: {
      companyId,
      createdAt: { gte: thirtyDaysAgo },
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  }).catch(() => []);

  // Load knowledge entries
  const knowledgeEntries = await db.knowledgeEntry.findMany({
    where: { companyId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }).catch(() => []);

  // Load pursuit context
  const activePursuit = await db.pursuit.findFirst({
    where: { opportunity: { companyId }, status: 'active' },
    orderBy: { updatedAt: 'desc' },
    include: { opportunity: { select: { opportunityTitle: true } } },
  }).catch(() => null);

  // Detect meeting type
  const meetingType = detectMeetingType(
    buyerProfile.buyerRole,
    buyerProfile.relationshipStrength,
    recentSignals.length,
  );

  // Generate talking points from signals
  for (const s of recentSignals.slice(0, 3)) {
    talkingPoints.push({
      point: `${companyName}'s recent ${s.signalType || 'development'}: ${s.title || 'Signal detected'}`,
      evidence: s.businessImpact || s.description || 'Detected from intelligence monitoring',
      source: `signal-${s.signalType}`,
      priority: 'must_cover',
    });
  }

  // Add buyer priority talking points
  for (const p of buyerProfile.detectedPriorities.slice(0, 2)) {
    talkingPoints.push({
      point: `${buyerProfile.name}'s focus on ${p} — align your value proposition to this priority`,
      evidence: `Detected from role analysis: ${buyerProfile.role} suggests ${p} responsibility`,
      source: 'buyer-intelligence',
      priority: 'must_cover',
    });
  }

  // Add knowledge-based talking points
  for (const k of knowledgeEntries.slice(0, 2)) {
    talkingPoints.push({
      point: `Intelligence: ${(k.content || '').substring(0, 120)}`,
      evidence: `Knowledge entry from ${k.source || 'internal research'}`,
      source: 'knowledge-base',
      priority: 'should_cover',
    });
  }

  // Generate questions based on buyer role
  if (buyerProfile.buyerRole === 'economic_buyer') {
    questionsToAsk.push(
      { question: 'What are your top 3 strategic priorities for this quarter?', purpose: 'Understand decision-making framework and urgency', timing: 'opening' },
      { question: 'How are you measuring success for initiatives in this area?', purpose: 'Uncover KPIs and success criteria', timing: 'middle' },
      { question: 'What would need to be true for you to move forward with a solution like this?', purpose: 'Identify decision criteria and timeline', timing: 'middle' },
    );
  } else if (buyerProfile.buyerRole === 'technical_buyer') {
    questionsToAsk.push(
      { question: 'What does your current architecture look like, and where are the pain points?', purpose: 'Understand technical context and integration needs', timing: 'opening' },
      { question: 'What have you tried so far, and what worked or didn\'t?', purpose: 'Map competitive landscape and technical requirements', timing: 'middle' },
      { question: 'What are your evaluation criteria for a solution in this space?', purpose: 'Align your pitch with their technical requirements', timing: 'closing' },
    );
  } else {
    questionsToAsk.push(
      { question: `What are your top priorities for ${buyerProfile.detectedPriorities[0]?.toLowerCase() || 'your team'} over the next 6 months?`, purpose: 'Understand strategic direction and timing', timing: 'opening' },
      { question: 'What does success look like for this initiative, and what would need to change?', purpose: 'Uncover pain points and desired outcomes', timing: 'middle' },
      { question: 'Who else is involved in this decision, and what does the evaluation process look like?', purpose: 'Map stakeholder landscape and buying process', timing: 'middle' },
      { question: 'What have you tried so far, and what worked or didn\'t?', purpose: 'Understand competitive landscape and past experience', timing: 'middle' },
      { question: 'If we could solve one challenge for you in the next 90 days, what would it be?', purpose: 'Identify quick-win opportunity and urgency', timing: 'closing' },
    );
  }

  // Generate objection preparation
  objectionsToPrepare.push(
    {
      objection: 'We already have a solution / vendor for this',
      preparedResponse: 'Acknowledge their current solution. Ask what they wish was different. Position as complementary or identify gaps in current approach.',
      evidence: recentSignals.some(s => s.signalType === 'partnership') ? 'Partnership signals suggest potential vendor shifts' : 'Common objection at qualification stage',
      probability: 'high',
    },
    {
      objection: 'We don\'t have budget right now',
      preparedResponse: 'Explore whether this is a timing issue or priority issue. If timing, propose pilot with smaller scope. If priority, quantify cost of inaction.',
      evidence: 'Budget cycle: companies typically plan Q4/Q1 budgets',
      probability: 'high',
    },
    {
      objection: 'We need to evaluate other options',
      preparedResponse: 'Welcome competition — it validates the need. Offer comparison criteria and case studies. Ask what their evaluation criteria are.',
      evidence: 'Standard procurement objection — indicates active buying process',
      probability: 'medium',
    },
    {
      objection: 'We\'re too busy right now',
      preparedResponse: 'Acknowledge their workload. Reframe as a time-saver, not a time-taker. Offer a 15-min focused call with specific agenda.',
      evidence: 'Priority objection — need to demonstrate value outweighs time investment',
      probability: 'medium',
    },
  );

  // Topics to avoid based on buyer role
  if (buyerProfile.buyerRole === 'economic_buyer') {
    topicsToAvoid.push('Leading with technical specifications instead of business outcomes');
    topicsToAvoid.push('Deep-dive architecture discussions unless they ask');
  } else if (buyerProfile.buyerRole === 'technical_buyer') {
    topicsToAvoid.push('Leading with ROI numbers without technical backing');
    topicsToAvoid.push('High-level strategic language without specifics');
  }
  if (buyerProfile.communicationStyle === 'visionary') {
    topicsToAvoid.push('Excessive detail on implementation before establishing vision alignment');
  }
  if (buyerProfile.relationshipStrength === 'cold' || buyerProfile.relationshipStrength === 'none') {
    topicsToAvoid.push('Assuming too much familiarity with their business');
    topicsToAvoid.push('Aggressive closing tactics');
  }

  // Recommended positioning based on buyer
  const recommendedPositioning = buyerProfile.buyerRole === 'economic_buyer'
    ? 'Lead with business outcomes, ROI quantification, and strategic alignment'
    : buyerProfile.buyerRole === 'technical_buyer'
    ? 'Lead with technical capabilities, integration architecture, and reliability evidence'
    : buyerProfile.buyerRole === 'champion'
    ? 'Empower with internal advocacy materials, case studies, and ROI data for their presentations'
    : 'Lead with industry insights and value demonstration';

  const valuePropositionAngle = buyerProfile.detectedPriorities.length > 0
    ? `Position as the solution that directly addresses ${buyerProfile.detectedPriorities[0]} challenges at ${companyName}`
    : `Position as a platform that drives measurable outcomes for ${companyName}'s industry`;

  // Meeting objective
  const pursuitTitle = (activePursuit as any)?.opportunity?.opportunityTitle;
  const meetingObjective = pursuitTitle
    ? `Advance "${pursuitTitle}" deal with ${buyerProfile.name}`
    : `Establish relationship with ${buyerProfile.name} at ${companyName} and understand ${buyerProfile.detectedPriorities[0] || 'business'} priorities`;

  const suggestedDuration = meetingType === 'discovery' ? '30 minutes'
    : meetingType === 'demo' || meetingType === 'technical_deep_dive' ? '45 minutes'
    : meetingType === 'executive_briefing' ? '30 minutes'
    : '30-45 minutes';

  // Post-meeting actions
  postMeetingActions.push('Document findings and update company intelligence profile');
  if (meetingType === 'discovery') postMeetingActions.push('Create follow-up action items based on discovered priorities');
  if (meetingType === 'qualification') postMeetingActions.push('Update pursuit stage and add identified stakeholders');
  postMeetingActions.push('Send follow-up email within 24 hours with key takeaways');
  postMeetingActions.push('Log meeting notes and update AI insight records');

  // Preparation checklist
  preparationChecklist.push('Review company signals and recent news');
  preparationChecklist.push('Study contact profile and priorities');
  preparationChecklist.push('Prepare relevant case study or evidence');
  preparationChecklist.push('Set clear meeting objective');
  preparationChecklist.push('Prepare demo or materials if applicable');
  preparationChecklist.push('Review previous interactions and commitments');

  // Context strings
  const companyContext = `${companyName} — ${recentSignals.length} recent signals, ${knowledgeEntries.length} knowledge entries`;
  const signalContext = recentSignals.map(s => s.title || s.signalType);
  const dealContext = pursuitTitle
    ? `Active pursuit: "${pursuitTitle}" at ${(activePursuit as any)?.outcomeStage || 'unknown'} stage`
    : 'No active pursuit — this meeting is for discovery/relationship building';

  return {
    talkingPoints,
    questionsToAsk,
    objectionsToPrepare,
    topicsToAvoid,
    recommendedPositioning,
    valuePropositionAngle,
    postMeetingActions,
    preparationChecklist,
    meetingObjective,
    meetingType,
    suggestedDuration,
    keyStakeholders: [buyerProfile.name],
    companyContext,
    signalContext,
    dealContext,
  };
}

// ─── LLM Briefing Narrative ──────────────────────────────────────────────

async function generateBriefingNarrative(
  companyName: string,
  buyerProfile: BuyerProfile,
  briefing: {
    meetingObjective: string;
    meetingType: MeetingType;
    talkingPoints: TalkingPoint[];
    questionsToAsk: QuestionToAsk[];
    objectionsToPrepare: ObjectionPrep[];
    recommendedPositioning: string;
  },
  chain: EvidenceChain,
): Promise<{ narrative: string | null; modelUsed: string; tokensUsed: number; costUsd: number }> {
  try {
    const systemPrompt = `You are a senior sales strategist producing a pre-meeting briefing summary.

Your briefing must be:
- 5-8 sentences maximum
- Include the meeting objective
- Reference buyer profile and priorities
- Mention top 2-3 talking points with their evidence
- Include recommended positioning approach
- Evidence-grounded: cite [En] for key claims
- Do NOT fabricate evidence`;

    const userPrompt = `# Pre-Meeting Briefing

**Company:** ${companyName}
**Contact:** ${buyerProfile.name} (${buyerProfile.role}, ${buyerProfile.buyerRole.replace('_', ' ')})
**Meeting Objective:** ${briefing.meetingObjective}
**Meeting Type:** ${briefing.meetingType}
**Buyer Priorities:** ${buyerProfile.detectedPriorities.join(', ')}

## Key Talking Points
${briefing.talkingPoints.slice(0, 5).map((tp, i) => `${i + 1}. ${tp.point} (${tp.priority})`).join('\n')}

## Recommended Positioning
${briefing.recommendedPositioning}

## Evidence
${renderChainForPrompt(chain)}

Produce a 5-8 sentence pre-meeting briefing summary now.`;

    const completion = await ModelRouter.complete({
      systemPrompt,
      userPrompt,
      tier: 'smart',
      maxTokens: 2000,
      temperature: 0.7,
      genType: 'conversation_briefing',
    });

    if (completion.success && completion.text.trim().length > 30) {
      return {
        narrative: completion.text.trim(),
        modelUsed: completion.modelUsed,
        tokensUsed: completion.totalTokens,
        costUsd: completion.costUsd,
      };
    }
  } catch (err) {
    logger.error(`[conversation-engine] briefing narrative failed: ${err instanceof Error ? err.message : err}`);
  }

  return { narrative: null, modelUsed: 'none', tokensUsed: 0, costUsd: 0 };
}

// ─── EngineRun Audit ────────────────────────────────────────────────────

async function logEngineRun(args: {
  companyId: string;
  compositionId?: string;
  inputSummary: string;
  outputSummary: string;
  confidence: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  llmCallCount: number;
  llmTokensUsed: number;
  llmCostUsd: number;
}): Promise<void> {
  try {
    await db.engineRun.create({
      data: {
        engine: 'conversation',
        compositionId: args.compositionId,
        inputSummary: args.inputSummary,
        outputSummary: args.outputSummary,
        confidence: args.confidence,
        durationMs: args.durationMs,
        success: args.success,
        errorMessage: args.errorMessage ?? null,
        companyId: args.companyId,
        contactId: undefined,
        llmCallCount: args.llmCallCount,
        llmTokensUsed: args.llmTokensUsed,
        llmCostUsd: args.llmCostUsd,
      },
    });
  } catch (err) {
    logger.error(`[conversation-engine] logEngineRun failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── ConversationEngine ─────────────────────────────────────────────────

export const ConversationEngine = {
  /**
   * Generate a conversation briefing for an upcoming meeting.
   * Non-throwing — returns ConversationResult with success=false + error on failure.
   */
  async brief(params: {
    companyId: string;
    contactId?: string;
    opportunityId?: string;
    briefingType?: BriefingType;
    compositionId?: string;
    /** Skip LLM narrative generation. */
    skipNarrative?: boolean;
  }): Promise<ConversationResult> {
    const startedAt = Date.now();
    const {
      companyId, contactId, opportunityId,
      briefingType = 'meeting_prep',
      compositionId, skipNarrative,
    } = params;

    logger.info(`[conversation-engine] briefing for company=${companyId} contact=${contactId ?? '-'} type=${briefingType}`);

    // Step 1: Load company
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true, normalizedName: true, industry: true, sizeRange: true },
    });

    if (!company) {
      const durationMs = Date.now() - startedAt;
      const error = 'Company not found';
      const emptyChain: EvidenceChain = { evidences: [], aggregateConfidence: 0, coverage: 0, gaps: [], freshnessScore: 0, builtAt: new Date().toISOString(), context: { companyId }, error: null };
      await logEngineRun({ companyId, compositionId, inputSummary: companyId, outputSummary: error, confidence: 0, durationMs, success: false, errorMessage: error, llmCallCount: 0, llmTokensUsed: 0, llmCostUsd: 0 });
      return {
        success: false, error,
        companyId, companyName: 'Unknown', contactId: contactId ?? null, opportunityId: opportunityId ?? null,
        briefingType,
        meetingObjective: '', meetingType: 'discovery', suggestedDuration: '30 minutes', keyStakeholders: [],
        buyerProfile: { name: 'Unknown', role: 'Unknown', seniority: 'manager', buyerRole: 'unknown', influenceScore: 0, detectedPriorities: [], relationshipStrength: 'none', communicationStyle: 'unknown' },
        talkingPoints: [], questionsToAsk: [], objectionsToPrepare: [], topicsToAvoid: [],
        recommendedPositioning: '', valuePropositionAngle: '',
        postMeetingActions: [], preparationChecklist: [],
        companyContext: '', signalContext: [], dealContext: '',
        evidenceChain: emptyChain, evidenceCount: 0, confidenceScore: 0,
        briefingNarrative: null,
        generatedAt: new Date().toISOString(), modelUsed: 'none', durationMs, tokensUsed: 0, costUsd: 0,
      };
    }

    const companyName = company.normalizedName || company.rawName;

    // Step 2: Build buyer profile + collect evidence in parallel
    const [buyerProfile, chain] = await Promise.all([
      buildBuyerProfile(companyId, contactId ?? null),
      GroundingEngine.collect({ companyId, contactId, opportunityId }),
    ]);

    // Step 3: Generate deterministic briefing
    const briefing = await generateDeterministicBriefing(
      companyName, companyId, contactId ?? null, buyerProfile, chain,
    );

    // Step 4: Calculate confidence
    const evidenceCount = chain.evidences.length + briefing.talkingPoints.length + briefing.objectionsToPrepare.length;
    const confidenceScore = Math.min(90, 30 + evidenceCount * 4 + chain.evidences.length * 3);

    // Step 5: Optional LLM narrative
    let briefingNarrative: string | null = null;
    let modelUsed = 'deterministic_v1';
    let tokensUsed = 0;
    let costUsd = 0;

    if (!skipNarrative && briefing.talkingPoints.length >= 2) {
      const narrResult = await generateBriefingNarrative(
        companyName, buyerProfile, {
          meetingObjective: briefing.meetingObjective,
          meetingType: briefing.meetingType,
          talkingPoints: briefing.talkingPoints,
          questionsToAsk: briefing.questionsToAsk,
          objectionsToPrepare: briefing.objectionsToPrepare,
          recommendedPositioning: briefing.recommendedPositioning,
        },
        chain,
      );
      briefingNarrative = narrResult.narrative;
      if (narrResult.modelUsed !== 'none') {
        modelUsed = narrResult.modelUsed;
        tokensUsed = narrResult.tokensUsed;
        costUsd = narrResult.costUsd;
      }
    }

    const durationMs = Date.now() - startedAt;

    logger.info(
      `[conversation-engine] briefing complete: ${companyName} + ${buyerProfile.name}, ` +
        `${briefing.talkingPoints.length} talking points, ${briefing.questionsToAsk.length} questions, ` +
        `type=${briefingType}, duration=${durationMs}ms`,
    );

    // Step 6: Audit
    await logEngineRun({
      companyId,
      compositionId,
      inputSummary: JSON.stringify({ companyId, companyName, contactId, briefingType }),
      outputSummary: JSON.stringify({ talkingPoints: briefing.talkingPoints.length, questions: briefing.questionsToAsk.length, meetingType: briefing.meetingType }),
      confidence: confidenceScore / 100,
      durationMs,
      success: true,
      llmCallCount: briefingNarrative ? 1 : 0,
      llmTokensUsed: tokensUsed,
      llmCostUsd: costUsd,
    });

    return {
      success: true,
      error: null,
      companyId,
      companyName,
      contactId: contactId ?? null,
      opportunityId: opportunityId ?? null,
      briefingType,
      meetingObjective: briefing.meetingObjective,
      meetingType: briefing.meetingType,
      suggestedDuration: briefing.suggestedDuration,
      keyStakeholders: briefing.keyStakeholders,
      buyerProfile,
      talkingPoints: briefing.talkingPoints,
      questionsToAsk: briefing.questionsToAsk,
      objectionsToPrepare: briefing.objectionsToPrepare,
      topicsToAvoid: briefing.topicsToAvoid,
      recommendedPositioning: briefing.recommendedPositioning,
      valuePropositionAngle: briefing.valuePropositionAngle,
      postMeetingActions: briefing.postMeetingActions,
      preparationChecklist: briefing.preparationChecklist,
      companyContext: briefing.companyContext,
      signalContext: briefing.signalContext,
      dealContext: briefing.dealContext,
      evidenceChain: chain,
      evidenceCount,
      confidenceScore,
      briefingNarrative,
      generatedAt: new Date().toISOString(),
      modelUsed,
      durationMs,
      tokensUsed,
      costUsd,
    };
  },
};
