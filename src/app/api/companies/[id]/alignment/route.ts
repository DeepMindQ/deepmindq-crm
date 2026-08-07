import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type {
  CompanyIntelligence,
  IntelligenceObject,
  EvidenceState,
  EvidenceSource,
  TemporalConfidence,
} from '@/lib/intelligence-types';
import { checkApiAuth } from '@/lib/api-auth';
import {
  computeIntelligenceRanking,
  computeFreshnessState,
  sourceQualityWeight,
  type IntelligenceRankingResult,
} from '@/lib/scoring/freshness-ranking';

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/companies/[id]/alignment — Read-Only Composition Layer (v2)
   
   Returns Intelligence Objects — the frozen UI/API contract.
   
   Every intelligence item has:
   - Evidence state: confirmed | inferred | unknown
   - Confidence: 0-100
   - Freshness tracking
   - Reasoning chain
   
   Architecture-ready for Phase B. The UI consumes Intelligence Objects.
   The source of intelligence can evolve without redesign.
   ═══════════════════════════════════════════════════════════════════════════ */

function determineEvidenceState(
  hasDirectEvidence: boolean,
  hasSourceUrl: boolean,
  hasMultipleSignals: boolean
): EvidenceState {
  if (hasDirectEvidence && hasSourceUrl) return 'confirmed';
  if (hasDirectEvidence || hasMultipleSignals) return 'inferred';
  return 'unknown';
}

function computeTemporal(confidence: number, createdAt: string): TemporalConfidence {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  // Lightweight: previous is estimated as lower if recent, higher confidence tends to rise
  const previous = Math.max(0, confidence - (ageDays < 7 ? 15 : ageDays < 30 ? 10 : 5));
  const trend: TemporalConfidence['trend'] = 
    confidence > previous + 10 ? 'rising' : 
    confidence < previous - 10 ? 'declining' : 'stable';
  
  return {
    current: Math.round(confidence),
    previous: Math.round(previous),
    lastUpdated: new Date(createdAt).toISOString(),
    changeReason: ageDays < 7 ? 'Recent signals detected' : ageDays < 30 ? 'Ongoing monitoring' : 'Historical baseline',
    trend,
  };
}

function computeFreshness(createdAt: string, signalDate?: string | null, signalType?: string): {
  lastEnriched: string;
  staleness: 'fresh' | 'aging' | 'stale' | 'unknown';
} {
  const date = signalDate ? new Date(signalDate) : new Date(createdAt);
  // Phase 2A: Use half-life-based staleness from freshness-ranking
  const state = signalType
    ? computeFreshnessState(signalDate, createdAt, signalType)
    : null;
  const staleness = state?.staleness ?? 'unknown';
  // Map 'expired' to 'stale' for the IntelligenceObject contract
  return {
    lastEnriched: date.toISOString(),
    staleness: staleness === 'expired' ? 'stale' as const : staleness,
  };
}

/**
 * Phase 2A: Derive intelligence origin from signal source field.
 * Maps the CompanySignal.source string to the IntelligenceObject.origin type.
 */
function deriveOrigin(signal: any): IntelligenceObject['origin'] {
  const src = (signal.source || '').toLowerCase();
  let type: IntelligenceObject['origin'] extends { type: infer T } | undefined ? (T extends string ? T : never) : 'enrichment';
  if (src === 'external_discovery') type = 'external_discovery';
  else if (src === 'customer_upload' || src === 'csv_upload' || src === 'excel_upload') type = 'customer_uploaded';
  else if (src === 'human_submission' || src === 'human') type = 'human_validation';
  else if (src === 'ai_reasoning' || src === 'ai') type = 'ai_reasoning';
  else if (src.includes('web_search') || src.includes('research') || src.includes('enrich')) type = 'enrichment';
  else type = 'enrichment';

  return {
    type,
    source: signal.sourceUrl ? new URL(signal.sourceUrl.startsWith('http') ? signal.sourceUrl : `https://${signal.sourceUrl}`).hostname.replace('www.', '') : signal.source || undefined,
    collectedAt: signal.extractedAt instanceof Date ? signal.extractedAt.toISOString() : signal.extractedAt,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id: companyId } = await params;

    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        researchCard: true,
        _count: { select: { signals: true, contacts: true, notes: true } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const [signals, capabilities, contacts, validations] = await Promise.all([
      db.companySignal.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),
      db.capabilityAsset.findMany({ where: { isActive: true }, take: 200 }),
      db.contact.findMany({
        where: { companyId },
        orderBy: { leadScore: 'desc' },
        take: 10,
      }),
      db.intelligenceValidation.findMany({
        where: { companyId },
        orderBy: { validatedAt: 'desc' },
        take: 20,
      }),
    ]);

    // Build feedback map from validations
    const feedbackMap = new Map<string, { status: 'accurate' | 'outdated' | 'incorrect'; reason?: string }>();
    for (const v of validations) {
      const key = `${v.artifactType}:${v.artifactId}`;
      if (!feedbackMap.has(key)) {
        const status = v.accuracy === 'accurate' ? 'accurate' as const :
          v.accuracy === 'inaccurate' ? 'incorrect' as const : 'outdated' as const;
        feedbackMap.set(key, { status, reason: v.feedback || undefined });
      }
    }

    // ── Phase 2A: Pre-compute intelligence rankings for all signals ──
    // Signals compete on 5 dimensions: confidence, freshness, source quality,
    // business relevance, and capability relevance.
    const signalRankings = new Map<string, IntelligenceRankingResult>();
    for (const signal of signals) {
      // Estimate business/capability relevance from signal type
      const bizRel = estimateBusinessRelevance(signal, capabilities);
      const capRel = estimateCapabilityRelevance(signal, capabilities);
      signalRankings.set(signal.id, rankSignalWithRecord(signal, bizRel, capRel));
    }

    // ── Compose Intelligence Objects ──
    const signalObjects = composeSignalObjects(signals, company, feedbackMap, signalRankings);
    const needObjects = composeNeedObjects(signalObjects, company, signalRankings);
    const capabilityMatchObjects = composeCapabilityMatchObjects(needObjects, capabilities, signals, company, feedbackMap, signalRankings);
    const actionObjects = composeActionObjects(company, signalObjects, capabilityMatchObjects, contacts, feedbackMap);
    const stakeholderObjects = composeStakeholderObjects(contacts, company, signalObjects, capabilityMatchObjects[0]);

    // ── Executive Understanding ──
    const executiveUnderstanding = composeExecutiveUnderstanding(
      company, signalObjects, capabilityMatchObjects, actionObjects
    );

    // ── Positioning ──
    const positioning = composePositioning(company, needObjects, capabilityMatchObjects, contacts);

    // ── Technology Profile ──
    const technology = composeTechnologyProfile(company, signalObjects);

    // ── Phase 2A: Build recentChanges narrative ──
    // Answers: "What changed recently that should affect my sales strategy?"
    const recentChanges = composeRecentChanges(signalObjects, company);

    const response: CompanyIntelligence = {
      company: {
        id: company.id,
        name: company.rawName,
        industry: company.industry ?? undefined,
        domain: company.domain ?? undefined,
        intelligenceScore: company.intelligenceScore ?? 0,
      },
      executiveUnderstanding,
      signals: signalObjects,
      needs: needObjects,
      capabilityMatches: capabilityMatchObjects,
      actions: actionObjects,
      stakeholders: stakeholderObjects,
      positioning,
      technology,
      generatedAt: new Date().toISOString(),
      signalCount: signals.length,
      capabilityCount: capabilities.length,
      contactCount: contacts.length,
      _meta: { source: 'composition_layer', version: '2.1', futureReady: true },
      recentChanges,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[alignment-v2] Error:', { error: error });
    return NextResponse.json({ error: 'Failed to compose alignment' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   Compose Intelligence Objects from raw data
   ═══════════════════════════════════════ */

function composeSignalObjects(
  signals: any[],
  company: any,
  feedbackMap: Map<string, { status: 'accurate' | 'outdated' | 'incorrect'; reason?: string }>,
  signalRankings: Map<string, IntelligenceRankingResult>
): IntelligenceObject[] {
  const objects = signals.map(signal => {
    const confidence = Math.round((signal.confidence ?? 0.5) * 100);
    const evidenceState = determineEvidenceState(
      Boolean(signal.source || signal.sourceUrl),
      Boolean(signal.sourceUrl),
      false
    );
    const fb = feedbackMap.get(`signal_meaning:${signal.id}`);
    const ranking = signalRankings.get(signal.id);

    // Phase 2A: Enhanced reasoning chain
    // Populate the 4 W's with actual intelligence reasoning
    const reasoningChain = buildSignalReasoningChain(signal, company, ranking);

    return {
      id: signal.id,
      type: 'signal' as const,
      title: signal.title,
      subtitle: signal.description || undefined,
      whatChanged: reasoningChain.whatHappened,
      whyItMatters: reasoningChain.whyItMatters,
      whyWeRelevant: reasoningChain.whyWeRelevant,
      whatToDo: reasoningChain.whatToDo,
      evidenceState,
      confidence,
      reasoning: reasoningChain.fullReasoning,
      evidence: [
        ...(signal.source ? [{ source: signal.source, snippet: signal.title, url: signal.sourceUrl, date: signal.signalDate?.toISOString(), state: evidenceState }] : []),
      ].filter(Boolean) as EvidenceSource[],
      freshness: computeFreshness(
        signal.createdAt instanceof Date ? signal.createdAt.toISOString() : signal.createdAt,
        signal.signalDate?.toISOString() ?? null,
        signal.signalType
      ),
      temporal: computeTemporal(confidence, signal.createdAt instanceof Date ? signal.createdAt.toISOString() : signal.createdAt),
      category: signal.signalType,
      priority: signal.severity === 'critical' || signal.severity === 'high' ? 'high' as const : signal.severity === 'medium' ? 'medium' as const : 'low' as const,
      timing: signal.timingWindow || undefined,
      feedback: fb ? { status: fb.status, updatedAt: new Date().toISOString(), reason: fb.reason } : undefined,
      // Phase 2A: Intelligence origin
      origin: deriveOrigin(signal),
      // Phase 2A: Intelligence ranking score
      rankingScore: ranking?.rankingScore,
    };
  });

  // Phase 2A: Sort by intelligence ranking (freshness-weighted), not just createdAt
  return objects.sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0));
}

const SIGNAL_TO_NEED_MAP: Record<string, string[]> = {
  funding: ['Growth capital available', 'Expanding operations', 'Scaling infrastructure'],
  hiring: ['Talent acquisition', 'Team expansion', 'Skill gaps to fill'],
  leadership_change: ['Strategic direction shift', 'New decision makers', 'Organizational change'],
  tech_change: ['Technology modernization', 'Digital transformation', 'Platform migration'],
  news: ['Market visibility', 'Brand momentum', 'Industry positioning'],
  mention: ['Market awareness', 'Competitive activity', 'Partnership opportunity'],
  partnership: ['Channel development', 'Integration needs', 'Co-sell potential'],
  expansion: ['Geographic growth', 'New market entry', 'Localization needs'],
};

function composeNeedObjects(
  signalObjects: IntelligenceObject[],
  company: any,
  signalRankings?: Map<string, IntelligenceRankingResult>
): IntelligenceObject[] {
  if (signalObjects.length === 0) return [];

  const needMap = new Map<string, { signals: IntelligenceObject[]; types: Set<string>; totalConfidence: number }>();

  for (const so of signalObjects) {
    const mappedNeeds = SIGNAL_TO_NEED_MAP[so.category || ''] || [];
    for (const need of mappedNeeds) {
      if (!needMap.has(need)) {
        needMap.set(need, { signals: [], types: new Set(), totalConfidence: 0 });
      }
      const entry = needMap.get(need)!;
      entry.signals.push(so);
      entry.types.add(so.category || 'unknown');
      entry.totalConfidence += so.confidence;
    }
    // Map signal title as a need if no mapping
    if (mappedNeeds.length === 0 && so.title) {
      if (!needMap.has(so.title)) {
        needMap.set(so.title, { signals: [so], types: new Set([so.category || 'unknown']), totalConfidence: so.confidence });
      }
    }
  }

  return Array.from(needMap.entries())
    .map(([need, data]) => {
      const avgConfidence = Math.round(data.totalConfidence / data.signals.length);
      const hasSources = data.signals.some(s => s.evidence.some(e => e.url));
      const evidenceState = determineEvidenceState(data.signals.length > 1, hasSources, data.signals.length > 2);

      return {
        id: `need-${need.replace(/\s+/g, '-').toLowerCase()}`,
        type: 'need' as const,
        title: need,
        whatChanged: data.signals.map(s => s.title).join('; '),
        whyItMatters: `${data.signals.length} signal${data.signals.length !== 1 ? 's' : ''} from ${Array.from(data.types).join(', ')} indicate this business need for ${company.rawName}`,
        evidenceState,
        confidence: Math.min(95, avgConfidence + data.signals.length * 5),
        reasoning: `Detected through ${Array.from(data.types).join(', ')} signal analysis. ${data.signals.length} active signals contribute to this assessment.`,
        evidence: data.signals.flatMap(s => s.evidence),
        freshness: computeFreshness(data.signals[0]?.freshness?.lastEnriched || new Date().toISOString()),
        temporal: computeTemporal(Math.min(95, avgConfidence + data.signals.length * 5), data.signals[0]?.freshness?.lastEnriched || new Date().toISOString()),
        relatedSignals: data.signals.map(s => s.id),
        priority: avgConfidence >= 70 ? 'high' as const : avgConfidence >= 50 ? 'medium' as const : 'low' as const,
        rankingScore: Math.round(avgConfidence * 0.6 + avgConfidence * 0.4),
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 5);
}

function composeCapabilityMatchObjects(
  needs: IntelligenceObject[],
  capabilities: any[],
  signals: any[],
  company: any,
  feedbackMap: Map<string, { status: 'accurate' | 'outdated' | 'incorrect'; reason?: string }>,
  signalRankings?: Map<string, IntelligenceRankingResult>
): IntelligenceObject[] {
  if (capabilities.length === 0 || needs.length === 0) return [];

  const matches: IntelligenceObject[] = [];

  for (const cap of capabilities) {
    const capText = [
      cap.title, cap.summary, cap.solution, cap.technology,
      cap.industry, cap.businessProblem, cap.customerOutcome,
      cap.differentiator, cap.keywords, cap.problems,
      cap.targetIndustries,
    ].filter(Boolean).join(' ').toLowerCase();

    const companyText = [company.industry, company.domain, company.sizeRange, company.country].filter(Boolean).join(' ').toLowerCase();
    const signalText = signals.map(s => `${s.title} ${s.description} ${s.signalType}`).filter(Boolean).join(' ').toLowerCase();

    let bestScore = 0;
    const matchedNeeds: string[] = [];
    const allEvidence: EvidenceSource[] = [];

    for (const need of needs) {
      const needWords = need.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlapCount = needWords.filter(w => capText.includes(w) || signalText.includes(w)).length;
      const needText = need.title.toLowerCase();
      const directMatch = capText.includes(needText) || signalText.includes(needText);
      const partialMatch = overlapCount >= 2;

      let score = 0;
      if (directMatch) score = 80 + need.confidence * 0.15;
      else if (partialMatch) score = 45 + (overlapCount / Math.max(needWords.length, 1)) * 30 + need.confidence * 0.1;

      if (cap.targetIndustries && company.industry) {
        if (cap.targetIndustries.toLowerCase().includes(company.industry.toLowerCase())) {
          score += 8;
          allEvidence.push({ source: 'Industry Alignment', snippet: cap.targetIndustries, state: 'confirmed' });
        }
      }

      if (score > 25) {
        bestScore = Math.max(bestScore, score);
        matchedNeeds.push(need.title);
        allEvidence.push(...need.evidence.slice(0, 2));
      }
    }

    if (bestScore > 25) {
      const matchConfidence = Math.min(99, Math.round(bestScore));
      const evidenceState = determineEvidenceState(matchedNeeds.length > 1, allEvidence.some(e => e.url), allEvidence.length > 2);
      const fb = feedbackMap.get(`capability_match:${cap.id}`);

      matches.push({
        id: `match-${cap.id}`,
        type: 'capability_match',
        title: cap.title,
        subtitle: cap.summary || undefined,
        whyItMatters: `Matches ${matchedNeeds.length} detected need${matchedNeeds.length !== 1 ? 's' : ''}: ${matchedNeeds[0]}${matchedNeeds.length > 1 ? ` +${matchedNeeds.length - 1} more` : ''}`,
        whyWeRelevant: cap.differentiator || `${cap.category} capability aligned with ${company.rawName}'s current business trajectory`,
        whatToDo: cap.customerOutcome ? `Position ${cap.title.toLowerCase()} as a solution for ${cap.customerOutcome.toLowerCase()}` : `Engage ${company.rawName} on ${cap.title.toLowerCase()}`,
        evidenceState,
        confidence: matchConfidence,
        reasoning: `${matchConfidence}% match based on keyword/signal analysis against ${matchedNeeds.length} business needs. ${cap.category} category.`,
        evidence: allEvidence.slice(0, 6),
        freshness: computeFreshness(cap.updatedAt?.toISOString() || cap.createdAt?.toISOString() || new Date().toISOString()),
        relatedCapabilities: [cap.id],
        relatedSignals: needs.filter(n => matchedNeeds.includes(n.title)).flatMap(n => n.relatedSignals || []),
        category: cap.category,
        priority: matchConfidence > 70 ? 'high' as const : matchConfidence > 45 ? 'medium' as const : 'low' as const,
        feedback: fb ? { status: fb.status, updatedAt: new Date().toISOString(), reason: fb.reason } : undefined,
      });
    }
  }

  // Phase 2A: Add ranking score to capability matches based on signal rankings
  for (const match of matches) {
    const relatedSignals = match.relatedSignals || [];
    if (relatedSignals.length > 0 && signalRankings) {
      const avgSignalRanking = relatedSignals
        .map(id => signalRankings.get(id)?.rankingScore ?? 0)
        .reduce((sum, s) => sum + s, 0) / relatedSignals.length;
      match.rankingScore = Math.round(match.confidence * 0.6 + avgSignalRanking * 0.4);
    }
  }

  return matches.sort((a, b) => (b.rankingScore ?? b.confidence) - (a.rankingScore ?? a.confidence)).slice(0, 4);
}

function composeActionObjects(
  company: any,
  signalObjects: IntelligenceObject[],
  matchObjects: IntelligenceObject[],
  contacts: any[],
  feedbackMap: Map<string, { status: 'accurate' | 'outdated' | 'incorrect'; reason?: string }>
): IntelligenceObject[] {
  const actions: IntelligenceObject[] = [];

  // High-severity signals → immediate actions (cap at 3 highest)
  const highSignalActions = signalObjects
    .filter(s => s.priority === 'high')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  for (const so of highSignalActions) {
    actions.push({
      id: `action-signal-${so.id}`,
      type: 'action',
      title: `Follow up: ${so.title}`,
      whatChanged: so.title,
      whyItMatters: so.whyItMatters,
      whatToDo: `Investigate and act on ${so.category?.replace(/_/g, ' ')} signal for ${company.rawName}`,
      evidenceState: so.evidenceState,
      confidence: so.confidence,
      reasoning: so.reasoning,
      evidence: so.evidence,
      freshness: so.freshness,
      temporal: so.temporal,
      priority: 'high',
      timing: so.timing || 'within_7_days',
      relatedSignals: [so.id],
    });
  }

  // Top match → engagement action
  if (matchObjects.length > 0) {
    const top = matchObjects[0];
    actions.push({
      id: `action-match-${top.id}`,
      type: 'action',
      title: `Position "${top.title}" to ${company.rawName}`,
      whyWeRelevant: top.whyWeRelevant,
      whatToDo: `Engage ${company.rawName} decision-makers with ${top.title.toLowerCase()} approach`,
      evidenceState: top.evidenceState,
      confidence: top.confidence,
      reasoning: `Top capability match at ${top.confidence}%. ${top.whyItMatters || ''}`,
      evidence: top.evidence,
      freshness: top.freshness,
      priority: top.confidence > 70 ? 'high' : 'medium',
      timing: 'within_14_days',
      relatedCapabilities: top.relatedCapabilities,
    });
  }

  // High-score contacts → engage (top 2 only)
  const topContacts = contacts
    .filter(c => c.leadScore >= 70)
    .sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0))
    .slice(0, 2);

  for (const c of topContacts) {
    const fb = feedbackMap.get(`capability_match:contact-${c.id}`);
    actions.push({
      id: `action-contact-${c.id}`,
      type: 'action',
      title: `Reach out to ${c.rawName}`,
      subtitle: c.title || c.role || 'Stakeholder',
      whatToDo: `Engage ${c.rawName} at ${company.rawName}`,
      evidenceState: c.leadScore >= 85 ? 'confirmed' : 'inferred',
      confidence: c.leadScore,
      reasoning: `High lead score (${c.leadScore}), ${c.title || c.role || 'identified stakeholder'} at ${company.rawName}`,
      evidence: [{
        source: 'Contact Intelligence',
        snippet: `${c.rawName} — ${c.title || c.role || 'Unknown role'} — Score: ${c.leadScore}`,
        state: c.leadScore >= 85 ? 'confirmed' : 'inferred',
      }],
      freshness: computeFreshness(c.lastContactedAt?.toISOString() || c.updatedAt?.toISOString() || new Date().toISOString()),
      priority: c.leadScore >= 85 ? 'high' : 'medium',
      relatedContacts: [c.id],
      feedback: fb ? { status: fb.status, updatedAt: new Date().toISOString(), reason: fb.reason } : undefined,
    });
  }

  // No signals → research
  if (signalObjects.length === 0) {
    actions.push({
      id: 'action-research',
      type: 'action',
      title: `Enrich ${company.rawName} with intelligence analysis`,
      whatToDo: 'Run enrichment to discover opportunities and signals',
      evidenceState: 'unknown',
      confidence: 40,
      reasoning: 'No signals detected — intelligence enrichment needed',
      evidence: [],
      freshness: computeFreshness(company.lastEnrichedAt?.toISOString() || new Date().toISOString()),
      priority: 'medium',
    });
  }

  return actions.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority!] || 2) - (p[b.priority!] || 2);
  }).slice(0, 6);
}

function classifyStakeholderType(title: string): string {
  const t = (title || '').toLowerCase();
  const decisionMakerKeywords = ['ceo', 'cto', 'cio', 'ciso', 'cfo', 'coo', 'president', 'vp', 'vice president', 'svp', 'evp', 'chief'];
  const influencerKeywords = ['director', 'head', 'lead', 'principal', 'architect'];
  const teamMemberKeywords = ['manager', 'associate', 'analyst', 'consultant', 'coordinator', 'specialist', 'engineer', 'developer'];

  if (decisionMakerKeywords.some(kw => t.includes(kw))) return 'Decision Maker';
  if (influencerKeywords.some(kw => t.includes(kw))) return 'Influencer';
  if (teamMemberKeywords.some(kw => t.includes(kw))) return 'Team Member';
  return 'Stakeholder';
}

function composeWhyImportant(contact: any, companyName: string, signalCategories: Set<string>): string {
  const title = (contact.title || contact.role || '').toLowerCase();
  const isTech = /engineering|technology|tech|it |information|development|cloud|data|security|platform/.test(title);
  const isCLevel = /ceo|cto|cio|cfo|coo|ciso|chief|president/.test(title);
  const isHR = /hr |human resource|people|talent|recruit/.test(title);
  const isVP = /vp |vice president|svp|evp/.test(title);

  if (signalCategories.has('tech_change') && isTech) return 'Owns technology transformation area';
  if (signalCategories.has('funding') && isCLevel) return 'Likely involved in investment decisions';
  if (signalCategories.has('hiring') && (isHR || isVP)) return 'Driving talent acquisition';
  if (signalCategories.has('leadership_change') && isCLevel) return 'New leadership — strategic direction shift likely';
  if (signalCategories.has('expansion') && isCLevel) return 'Driving geographic growth strategy';
  if (signalCategories.has('partnership') && (isCLevel || isVP)) return 'Potential partnership decision maker';

  if (isCLevel) return `Key decision maker at ${companyName}`;
  if (isTech) return `Technology leadership at ${companyName}`;
  return `Identified stakeholder at ${companyName}`;
}

function composeEngagementStatus(lastContactedAt: Date | null): string {
  if (!lastContactedAt) return 'No engagement in last 90 days';
  const daysAgo = Math.floor((Date.now() - lastContactedAt.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 7) return 'Active engagement';
  if (daysAgo <= 45) return `Recent engagement (${daysAgo} days ago)`;
  return `No recent engagement (last ${daysAgo} days ago)`;
}

function composeRecommendedAction(
  stakeholderType: string,
  hasTopMatch: boolean,
  topCapability: string | undefined,
  contact: any,
  engagementStatus: string
): string {
  if (stakeholderType === 'Decision Maker' && hasTopMatch && topCapability) {
    return `Executive outreach: position ${topCapability} as strategic solution`;
  }
  if (stakeholderType === 'Influencer' && hasTopMatch && topCapability) {
    return `Technical conversation: demonstrate ${topCapability} value`;
  }
  if (engagementStatus.startsWith('No ') && (contact.leadScore || 50) >= 70) {
    return 'Priority re-engagement';
  }
  return 'Monitor and identify engagement opportunity';
}

function composeStakeholderObjects(
  contacts: any[],
  company: any,
  signalObjects: IntelligenceObject[],
  topCapabilityMatch?: IntelligenceObject
): IntelligenceObject[] {
  const signalCategories = new Set(signalObjects.map(s => s.category).filter((c): c is string => Boolean(c)));
  const topCapability = topCapabilityMatch?.title;
  const hasTopMatch = Boolean(topCapabilityMatch);

  return contacts.slice(0, 6).map(c => {
    const stakeholderType = classifyStakeholderType(c.title || c.role || '');
    const whyImportant = composeWhyImportant(c, company.rawName, signalCategories);
    const engagementStatus = composeEngagementStatus(c.lastContactedAt);
    const recommendedAction = composeRecommendedAction(
      stakeholderType, hasTopMatch, topCapability, c, engagementStatus
    );

    return {
      id: `stakeholder-${c.id}`,
      type: 'stakeholder' as const,
      title: c.rawName,
      subtitle: engagementStatus,
      category: stakeholderType,
      whatToDo: recommendedAction,
      evidenceState: c.leadScore >= 70 ? 'confirmed' : 'inferred',
      confidence: c.leadScore || 50,
      reasoning: whyImportant,
      evidence: [{
        source: 'CRM Data',
        snippet: `${c.title || c.role || 'Unknown role'} — ${stakeholderType}${c.assignedTo ? ` — Assigned: ${c.assignedTo}` : ''}`,
        state: 'confirmed',
      }],
      freshness: computeFreshness(c.lastContactedAt?.toISOString() || c.updatedAt?.toISOString() || new Date().toISOString()),
      priority: c.leadScore >= 80 ? 'high' : c.leadScore >= 50 ? 'medium' : 'low',
    };
  });
}

function composeExecutiveUnderstanding(
  company: any,
  signals: IntelligenceObject[],
  matches: IntelligenceObject[],
  actions: IntelligenceObject[]
): CompanyIntelligence['executiveUnderstanding'] {
  if (signals.length === 0) {
    return {
      headline: `${company.rawName} — No active intelligence signals`,
      narrative: `Intelligence enrichment has not yet been performed for ${company.rawName}. Upload capabilities and run enrichment to activate intelligence.`,
      evidenceState: 'unknown',
      overallConfidence: 0,
      temporal: { current: 0, previous: 0, lastUpdated: new Date().toISOString(), trend: 'new' },
    };
  }

  const highSignals = signals.filter(s => s.priority === 'high');
  const avgConfidence = Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length);
  const signalTypes = [...new Set(signals.map(s => s.category).filter((c): c is string => Boolean(c)))];
  
  // Build a sharp headline from the top signals
  const topCritical = signals.filter(s => s.priority === 'high').slice(0, 2);
  const headline = topCritical.length >= 2
    ? `${company.rawName} — ${topCritical[0].title.split(/for |—/)[0].trim().slice(0, 60)}; ${topCritical[1].title.split(/for |—/)[0].trim().slice(0, 60)}`
    : highSignals.length > 0
      ? `${highSignals.length} high-priority signal${highSignals.length !== 1 ? 's' : ''} for ${company.rawName}`
      : `${signals.length} intelligence signal${signals.length !== 1 ? 's' : ''} active for ${company.rawName}`;

  // Build narrative that answers Why Now + Why Us + What To Do
  const typeLabels = signalTypes.map(t => t.replace(/_/g, ' ')).join(', ');
  let narrative = `${company.rawName} shows active intelligence across ${signalTypes.length} categories: ${typeLabels}. `;
  
  if (highSignals.length > 0) {
    const topEvidence = highSignals[0];
    narrative += `The most critical signal is "${topEvidence.title}" at ${topEvidence.confidence}% confidence`;
    if (topEvidence.whyItMatters) narrative += ` — ${topEvidence.whyItMatters.toLowerCase()}`;
    narrative += '. ';
  }
  
  if (matches.length > 0) {
    narrative += `${matches.length} capabilit${matches.length !== 1 ? 'ies match' : 'y matches'} detected needs — strongest: "${matches[0].title}" at ${matches[0].confidence}%. `;
  }
  
  const highActions = actions.filter(a => a.priority === 'high');
  if (highActions.length > 0) {
    narrative += `${highActions.length} high-priority action${highActions.length !== 1 ? 's' : ''} recommended, starting with: "${highActions[0].whatToDo || highActions[0].title}".`;
  }

  const evidenceState = signals.some(s => s.evidenceState === 'confirmed')
    ? 'confirmed' : signals.some(s => s.evidenceState === 'inferred') ? 'inferred' : 'unknown';

  return {
    headline,
    narrative,
    evidenceState,
    overallConfidence: avgConfidence,
    temporal: computeTemporal(avgConfidence, signals[0]?.freshness?.lastEnriched || new Date().toISOString()),
  };
}

function composePositioning(
  company: any,
  needs: IntelligenceObject[],
  matches: IntelligenceObject[],
  contacts: any[]
): CompanyIntelligence['positioning'] {
  if (matches.length === 0) {
    return {
      message: 'No capability alignment detected yet.',
      angle: 'general',
      strengthScore: 0,
      targetStakeholders: [],
      topCapabilities: [],
    };
  }

  const top = matches.slice(0, 3);
  const avgConf = Math.round(top.reduce((s, m) => s + m.confidence, 0) / top.length);
  const allNeeds = [...new Set(top.flatMap(m => m.whyItMatters?.split(/[:;]/).slice(0, 2) || []))].filter(Boolean);

  const stakeholders: Array<{ role: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const c of contacts.slice(0, 5)) {
    const role = c.title || c.role || 'Unknown';
    if (!seen.has(role)) {
      seen.add(role);
      stakeholders.push({
        role,
        reason: c.leadScore > 70 ? `High scoring contact (${c.leadScore})` : 'Identified stakeholder',
      });
    }
  }

  return {
    message: `Position as a ${top[0].title.toLowerCase()} partner for ${company.rawName}. ${allNeeds[0] ? `Active need: ${allNeeds[0].trim()}.` : ''}`,
    angle: avgConf > 75 ? 'strategic-partner' : avgConf > 55 ? 'technical-advisor' : 'cost-optimizer',
    strengthScore: avgConf,
    targetStakeholders: stakeholders.slice(0, 4),
    topCapabilities: top.map(m => m.title),
  };
}

const TECH_TO_BUSINESS_MAP: Record<string, string> = {
  'cloud': 'Cloud infrastructure investment indicates modernization budget and platform migration opportunity',
  'aws': 'AWS usage suggests cloud-native capabilities and potential for managed service partnerships',
  'azure': 'Azure adoption signals Microsoft ecosystem alignment and enterprise integration needs',
  'gcp': 'Google Cloud usage indicates data/AI investment and modern engineering practices',
  'kubernetes': 'Container orchestration maturity signals sophisticated DevOps culture and platform engineering',
  'docker': 'Container adoption indicates CI/CD maturity and infrastructure-as-code readiness',
  'react': 'React frontend suggests modern web engineering practices and component-driven architecture',
  'angular': 'Angular adoption indicates enterprise-scale frontend standards and TypeScript proficiency',
  'node': 'Node.js usage signals JavaScript-first engineering and real-time capability needs',
  'python': 'Python adoption indicates data science, AI/ML investment, or backend services',
  'machine learning': 'ML investment signals data-driven culture and AI product development',
  'ai': 'AI adoption indicates forward-looking technology strategy and intelligent automation needs',
  'terraform': 'Infrastructure-as-code adoption signals mature DevOps and cloud governance',
  'snowflake': 'Snowflake usage indicates enterprise data warehousing and analytics investment',
  'salesforce': 'Salesforce adoption signals CRM-centric operations and potential integration needs',
  'sap': 'SAP usage indicates enterprise ERP and large-scale business process management',
  'service': 'Service-oriented architecture indicates microservices adoption and API-first strategy',
  'api': 'API-first strategy suggests integration partnerships and platform extensibility needs',
  'security': 'Security tooling investment indicates compliance requirements and risk management priority',
  'data': 'Data infrastructure investment signals analytics-driven culture and BI platform needs',
};

function composeTechnologyBusinessInsights(knownTech: string[]): string[] {
  const techLower = knownTech.map(t => t.toLowerCase().trim());
  const insights: string[] = [];
  const seen = new Set<string>();
  for (const tech of techLower) {
    for (const [key, insight] of Object.entries(TECH_TO_BUSINESS_MAP)) {
      if (tech.includes(key) && !seen.has(key)) {
        seen.add(key);
        insights.push(insight);
      }
    }
  }
  return insights;
}

function composeTechnologyProfile(
  company: any,
  signalObjects: IntelligenceObject[]
): CompanyIntelligence['technology'] {
  const techStack: string[] = [];
  const techSignals = signalObjects.filter(s => s.category === 'tech_change');

  const rc = company.researchCard;
  if (rc?.techStack) {
    const ts = typeof rc.techStack === 'string' ? rc.techStack : JSON.stringify(rc.techStack);
    techStack.push(...ts.split(',').map((t: string) => t.trim()).filter(Boolean));
  }
  if (rc?.techLandscape && typeof rc.techLandscape === 'string') {
    techStack.push(...rc.techLandscape.split(',').map((t: string) => t.trim()).filter(Boolean));
  }

  const maturity = (rc?.digitalMaturity as string) || (
    techStack.length > 10 ? 'advanced' : techStack.length > 5 ? 'high' : techStack.length > 2 ? 'medium' : 'low'
  );

  // Enhance tech signals with business meaning translation
  const enhancedTechSignals = techSignals.map(signal => {
    const businessInsights = composeTechnologyBusinessInsights(techStack);
    const relevantInsight = signal.title
      ? businessInsights.find(i => signal.title.toLowerCase().split(/\s+/).some(w => i.toLowerCase().includes(w)))
      : undefined;
    return {
      ...signal,
      whyItMatters: relevantInsight || signal.whyItMatters || `Technology change at ${company.rawName} may indicate evolving infrastructure needs`,
    };
  });

  return {
    knownTech: [...new Set(techStack)],
    digitalMaturity: maturity,
    techDescription: rc?.techLandscape || null,
    techSignals: enhancedTechSignals,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Phase 2A: Enhanced Reasoning Chain + Intelligence Ranking Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Build the 5-step reasoning chain for a signal.
 * This is the deterministic version of the chain that makes DeepMindQ
 * feel like it "understands" the intelligence.
 *
 * Chain:
 *   1. What happened?        → the signal event
 *   2. Why does it matter?   → business impact
 *   3. Why are we relevant?  → capability connection
 *   4. Who should act?      → stakeholder mapping
 *   5. What should we do?    → recommended action
 */
function buildSignalReasoningChain(
  signal: any,
  company: any,
  ranking?: IntelligenceRankingResult
): {
  whatHappened: string;
  whyItMatters: string;
  whyWeRelevant: string;
  whatToDo: string;
  fullReasoning: string;
} {
  const signalType = signal.signalType || 'unknown';
  const signalLabel = signalType.replace(/_/g, ' ');
  const ageDays = Math.floor((Date.now() - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const recencyLabel = ageDays === 0 ? 'today' : ageDays === 1 ? 'yesterday' : ageDays <= 7 ? `${ageDays} days ago` : ageDays <= 30 ? `${Math.floor(ageDays / 7)} weeks ago` : `${Math.floor(ageDays / 30)} months ago`;

  // 1. What happened?
  const whatHappened = signal.businessImpact
    ? signal.title
    : `${signal.title} (detected ${recencyLabel})`;

  // 2. Why does it matter?
  const whyItMatters = signal.businessImpact || buildDefaultWhyItMatters(signalType, company.rawName, recencyLabel);

  // 3. Why are we relevant?
  const whyWeRelevant = buildWhyWeRelevant(signalType, company.rawName, signal.recommendedAction);

  // 4. What should we do?
  const whatToDo = signal.recommendedAction || buildDefaultAction(signalType, company.rawName);

  // Build full reasoning text
  const freshnessNote = ranking
    ? ` Intelligence ranking: ${ranking.rankingScore}/100 (freshness: ${ranking.freshness.staleness}, ${ranking.freshness.daysSinceSignal}d old).`
    : '';
  const fullReasoning = `${signalLabel.charAt(0).toUpperCase() + signalLabel.slice(1)} signal detected ${recencyLabel} for ${company.rawName}. Severity: ${signal.severity}.${freshnessNote}`;

  return { whatHappened, whyItMatters, whyWeRelevant, whatToDo, fullReasoning };
}

function buildDefaultWhyItMatters(signalType: string, companyName: string, recency: string): string {
  const impacts: Record<string, string> = {
    funding: `Recent funding event at ${companyName} indicates available budget and active investment phase — prime window for vendor engagement`,
    hiring: `Active hiring at ${companyName} signals growth trajectory and potential resource gaps that may require external solutions`,
    leadership_change: `Leadership change at ${companyName} creates a strategic inflection point — new executives often re-evaluate vendor relationships`,
    expansion: `Operational expansion at ${companyName} signals infrastructure and service needs for new markets`,
    tech_change: `Technology change at ${companyName} may indicate dissatisfaction with current solutions or active modernization — key opportunity window`,
    partnership: `Partnership activity at ${companyName} may indicate ecosystem building with integration requirements`,
    acquisition: `Acquisition activity at ${companyName} signals major organizational change — technology consolidation and budget restructuring likely`,
    news: `Recent announcement from ${companyName} may reveal strategic priorities relevant to engagement timing`,
    mention: `${companyName} market activity detected — may indicate evolving competitive landscape`,
    // Phase 2A: New signal types
    people_change: `VP/Director-level organizational change at ${companyName} often signals upcoming strategy shifts, new initiative funding, or technology evaluation — the new hire's background reveals organizational priorities`,
    technology_adoption: `${companyName} is actively investing in new technology, indicating both budget availability and specific capability gaps — complementary or competitive to our solution portfolio`,
  };
  return impacts[signalType] || `${signalType.replace(/_/g, ' ')} signal detected at ${companyName} — further analysis recommended`;
}

function buildWhyWeRelevant(signalType: string, companyName: string, recommendedAction?: string | null): string {
  if (recommendedAction) {
    return `Our capabilities align with the needs created by this ${signalType.replace(/_/g, ' ')} activity at ${companyName}`;
  }
  return `This ${signalType.replace(/_/g, ' ')} activity at ${companyName} may indicate needs aligned with our solutions`;
}

function buildDefaultAction(signalType: string, companyName: string): string {
  const actions: Record<string, string> = {
    funding: `Prioritize ${companyName} outreach — budget allocation phase creates high receptivity for solutions`,
    hiring: `Research specific role requirements at ${companyName} to identify capability alignment`,
    leadership_change: `Prepare tailored outreach to new leadership at ${companyName} — first 90 days are critical`,
    expansion: `Position relevant capabilities for ${companyName}'s expansion requirements`,
    tech_change: `Map technology change at ${companyName} to relevant capabilities; prepare technical conversation`,
    partnership: `Assess partnership implications for ${companyName} competitive landscape`,
    acquisition: `Immediately assess acquisition impact on ${companyName} pipeline and contract stability`,
    news: `Incorporate announcement into ${companyName} account narrative and next touchpoint`,
    // Phase 2A: New signal types
    people_change: `Research the new hire/departure background and priorities at ${companyName}; map their role to our capability domain; prepare context-aware outreach within 30 days`,
    technology_adoption: `Map ${companyName}'s adopted technology to our integration and competitive landscape; identify complementary, replacement, or co-exist opportunities; engage the technical decision-maker`,
  };
  return actions[signalType] || `Assess ${signalType.replace(/_/g, ' ')} signal for ${companyName} engagement strategy`;
}

/**
 * Estimate business relevance of a signal (0-1).
 * Higher for signals that directly indicate buying intent or urgent need.
 */
function estimateBusinessRelevance(signal: any, capabilities: any[]): number {
  // High-relevance signal types
  const highRelevanceTypes = ['funding', 'acquisition', 'expansion', 'leadership_change'];
  const mediumRelevanceTypes = ['hiring', 'tech_change', 'partnership', 'people_change', 'technology_adoption'];
  const lowRelevanceTypes = ['news', 'mention'];

  if (highRelevanceTypes.includes(signal.signalType)) return 0.8;
  if (mediumRelevanceTypes.includes(signal.signalType)) return 0.6;
  if (lowRelevanceTypes.includes(signal.signalType)) return 0.3;

  // Boost if has explicit business impact
  if (signal.businessImpact && signal.businessImpact.length > 30) return 0.7;

  return 0.5;
}

/**
 * Estimate capability relevance of a signal (0-1).
 * Checks if signal keywords overlap with our capability library.
 */
function estimateCapabilityRelevance(signal: any, capabilities: any[]): number {
  if (capabilities.length === 0) return 0.3;

  const signalText = `${signal.title} ${signal.description} ${signal.signalType}`.toLowerCase();
  const capTexts = capabilities.map(c =>
    `${c.title} ${c.summary} ${c.keywords} ${c.businessProblem} ${c.solution}`.toLowerCase()
  );

  // Quick overlap check
  const signalWords = signalText.split(/\s+/).filter(w => w.length > 3);
  let maxOverlap = 0;

  for (const capText of capTexts) {
    const overlap = signalWords.filter(w => capText.includes(w)).length;
    maxOverlap = Math.max(maxOverlap, overlap);
  }

  if (maxOverlap >= 3) return 0.9;
  if (maxOverlap >= 2) return 0.6;
  if (maxOverlap >= 1) return 0.4;
  return 0.2;
}

/**
 * Convenience wrapper for ranking a raw DB signal record.
 */
function rankSignalWithRecord(
  signal: any,
  businessRelevance: number,
  capabilityRelevance: number
): IntelligenceRankingResult {
  return computeIntelligenceRanking({
    confidence: Math.round((signal.confidence ?? 0.5) * 100),
    signalDate: signal.signalDate?.toISOString?.() ?? null,
    createdAt: signal.createdAt instanceof Date ? signal.createdAt.toISOString() : String(signal.createdAt),
    signalType: signal.signalType,
    sourceQuality: signal.sourceQuality || 'standard',
    businessRelevance,
    capabilityRelevance,
  });
}

/**
 * Phase 2A: Compose the "recent changes" narrative.
 *
 * Answers the executive question:
 * "What changed recently that should affect my sales strategy?"
 *
 * Focuses on the top-ranked fresh signals — the ones that are driving
 * the intelligence right now, not historical baseline data.
 */
function composeRecentChanges(
  signalObjects: IntelligenceObject[],
  company: any
): string {
  if (signalObjects.length === 0) {
    return `No recent intelligence changes detected for ${company.rawName}.`;
  }

  // Get fresh signals sorted by ranking
  const freshSignals = signalObjects
    .filter(s => s.freshness.staleness === 'fresh' || s.freshness.staleness === 'aging')
    .sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0))
    .slice(0, 5);

  if (freshSignals.length === 0) {
    // No fresh signals — report on the top-ranked regardless of staleness
    const top = signalObjects.slice(0, 3);
    if (top.length === 0) return `No recent intelligence changes detected for ${company.rawName}.`;
    return `Most recent intelligence for ${company.rawName}: ${top.map(s => s.title).join('; ')}. Consider running external news collection to refresh intelligence.`;
  }

  // Build narrative from fresh signals
  const parts: string[] = [];

  if (freshSignals[0]) {
    const top = freshSignals[0];
    parts.push(`The most significant recent change: "${top.whatChanged || top.title}"`);
    if (top.whyItMatters) parts.push(`This matters because ${top.whyItMatters.toLowerCase().charAt(0) + top.whyItMatters.toLowerCase().slice(1)}`);
    if (top.whatToDo) parts.push(`Recommended action: ${top.whatToDo}`);
    if (top.origin) parts.push(`Intelligence source: ${top.origin.type.replace(/_/g, ' ')}${top.origin.source ? ` (${top.origin.source})` : ''}`);
  }

  if (freshSignals.length > 1) {
    const others = freshSignals.slice(1, 4).map(s => s.title);
    parts.push(`Other recent signals: ${others.join('; ')}`);
  }

  return parts.join('. ') + '.';
}
