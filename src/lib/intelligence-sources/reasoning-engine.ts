/**
 * Sprint 1 — Reasoning Engine
 *
 * The differentiator: DeepMindQ does not collect maximum information.
 * DeepMindQ creates maximum understanding.
 *
 * The pipeline:
 *   External/Internal Data → Evidence → Validation → Reasoning → Business Impact → Recommended Action
 *
 * The reasoning engine takes raw signals + evidence + company context
 * and produces INTELLIGENCE NARRATIVES — not data dumps.
 *
 * Architecture principle:
 *   "The user should never see: 'Here are 20 articles.'
 *    The user should see: 'Here is what changed, why it matters, how confident we are,
 *     and what action makes sense.'"
 *
 * Sprint 1 Output Types:
 *   1. CompanyUnderstanding — Executive summary of what's happening at a company
 *   2. KeyChanges — Top 3-5 changes with evidence, impact, and action
 *   3. IntelligenceNarrative — Full narrative combining internal memory + external signals
 *   4. ActionRecommendations — Prioritized actions with reasoning chains
 *
 * Every output answers:
 *   - What changed?
 *   - Why does it matter?
 *   - How confident are we?
 *   - What should you do?
 */

import { rankSignal, computeIntelligenceRanking, SIGNAL_HALF_LIVES } from '@/lib/scoring/freshness-ranking';
import { normalizeType, type CanonicalSignalType } from './signal-type-mapping';
import type { IntelligenceRankingResult } from '@/lib/scoring/freshness-ranking';

// ─── Input Types ────────────────────────────────────────────────

export interface ReasoningInput {
  companyId: string;
  companyName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  signals: SignalInput[];
  /** Internal memory: CRM data, contacts, notes, opportunities */
  internalContext?: InternalContext;
  /** Capabilities from the user's library */
  capabilities?: CapabilityInput[];
}

export interface SignalInput {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  severity: string;
  confidence: number;
  signalDate: string | null;
  createdAt: string;
  sourceUrl?: string | null;
  source?: string | null;
  sourceQuality?: string;
  businessImpact?: string | null;
  recommendedAction?: string | null;
  timingWindow?: string | null;
  meaningCategory?: string | null;
  /** Sprint 1: Optional sourcePublishedDate */
  sourcePublishedDate?: string | null;
}

export interface InternalContext {
  contactCount?: number;
  highValueContacts?: number;
  lastInteractionDays?: number | null;
  openOpportunities?: number;
  totalOpportunities?: number;
  existingNotes?: number;
  accountHistory?: string;
  engagementStatus?: string;
}

export interface CapabilityInput {
  id: string;
  title: string;
  category: string;
  description?: string;
}

// ─── Output Types ───────────────────────────────────────────────

export interface CompanyUnderstanding {
  /** Executive summary — the 10-second answer */
  executiveSummary: string;
  /** Intelligence density: how much we know about this company */
  intelligenceDensity: 'high' | 'medium' | 'low';
  /** Signal richness: how many external signals were found */
  signalRichness: 'rich' | 'moderate' | 'sparse' | 'desert';
  /** Internal/external balance: what the intelligence is based on */
  intelligenceBalance: {
    externalWeight: number;  // 0-1
    internalWeight: number;  // 0-1
    rationale: string;
  };
  /** Key changes — top 3-5 things that changed */
  keyChanges: KeyChange[];
  /** Overall business trajectory */
  trajectory: 'expanding' | 'growing' | 'stable' | 'contracting' | 'unclear';
  /** Priority actions */
  recommendedActions: ActionRecommendation[];
  /** Confidence in the overall assessment */
  overallConfidence: number;  // 0-1
  /** When this assessment was generated */
  generatedAt: string;
}

export interface KeyChange {
  /** What happened */
  whatChanged: string;
  /** Evidence supporting this change */
  evidence: string[];
  /** Why it matters */
  whyItMatters: string;
  /** Signal type(s) that contributed */
  signalTypes: string[];
  /** Confidence in this specific change */
  confidence: number;
  /** How recent is this change */
  recency: 'today' | 'this_week' | 'this_month' | 'older';
  /** Severity */
  severity: string;
  /** Recommended action */
  recommendedAction: string;
  /** Capability match (if applicable) */
  capabilityMatch?: string;
  /** Intelligence ranking score */
  rankingScore?: number;
}

export interface ActionRecommendation {
  /** The action to take */
  action: string;
  /** Why this action makes sense */
  reasoning: string;
  /** Priority */
  priority: 'immediate' | 'high' | 'medium' | 'low';
  /** Who should take this action */
  stakeholder: string;
  /** Signal(s) driving this recommendation */
  drivenBy: string[];
  /** Expected outcome */
  expectedOutcome: string;
}

// ─── Core Reasoning Engine ──────────────────────────────────────

/**
 * Generate company understanding from signals and context.
 *
 * This is the main entry point for the reasoning engine.
 * It takes raw signals + company context and produces intelligence narratives.
 */
export function generateCompanyUnderstanding(input: ReasoningInput): CompanyUnderstanding {
  const normalizedSignals = input.signals.map(s => ({
    ...s,
    normalizedType: normalizeType(s.signalType, s.title, s.description || undefined),
  }));

  // Rank all signals
  const rankedSignals = normalizedSignals.map(s => {
    const ranking = rankSignal(
      {
        ...s,
        sourceQuality: s.sourceQuality || 'standard',
      },
      estimateBusinessRelevance(s.normalizedType),
      estimateCapabilityFit(s.normalizedType)
    );
    return { signal: s, ranking };
  }).sort((a, b) => b.ranking.rankingScore - a.ranking.rankingScore);

  // Compute intelligence density
  const totalSignals = normalizedSignals.length;
  const uniqueTypes = new Set(normalizedSignals.map(s => s.normalizedType)).size;
  const signalRichness = computeSignalRichness(totalSignals, uniqueTypes);
  const intelligenceDensity = computeIntelligenceDensity(totalSignals, uniqueTypes, input.internalContext);

  // Compute internal/external balance
  const balance = computeIntelligenceBalance(signalRichness, input.internalContext, input.sizeRange);

  // Detect key changes
  const keyChanges = detectKeyChanges(rankedSignals, input);

  // Compute trajectory
  const trajectory = computeTrajectory(normalizedSignals);

  // Generate recommendations
  const recommendedActions = generateRecommendations(rankedSignals, input, keyChanges);

  // Generate executive summary
  const executiveSummary = composeExecutiveSummary(input, keyChanges, trajectory, balance, signalRichness);

  // Compute overall confidence
  const overallConfidence = computeOverallConfidence(rankedSignals, signalRichness);

  return {
    executiveSummary,
    intelligenceDensity,
    signalRichness,
    intelligenceBalance: balance,
    keyChanges,
    trajectory,
    recommendedActions,
    overallConfidence,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Signal Richness ─────────────────────────────────────────────

function computeSignalRichness(count: number, uniqueTypes: number): CompanyUnderstanding['signalRichness'] {
  if (count >= 10 && uniqueTypes >= 4) return 'rich';
  if (count >= 5 && uniqueTypes >= 3) return 'moderate';
  if (count >= 2) return 'sparse';
  return 'desert';
}

function computeIntelligenceDensity(
  signalCount: number,
  typeDiversity: number,
  internalContext?: InternalContext
): CompanyUnderstanding['intelligenceDensity'] {
  const externalScore = Math.min(signalCount * 0.15 + typeDiversity * 0.1, 0.6);
  const internalScore = internalContext
    ? Math.min((internalContext.contactCount || 0) * 0.02 + (internalContext.openOpportunities || 0) * 0.05 + (internalContext.existingNotes || 0) * 0.01, 0.4)
    : 0;
  const total = externalScore + internalScore;
  if (total >= 0.7) return 'high';
  if (total >= 0.4) return 'medium';
  return 'low';
}

// ─── Intelligence Balance ───────────────────────────────────────

function computeIntelligenceBalance(
  signalRichness: CompanyUnderstanding['signalRichness'],
  internalContext?: InternalContext,
  sizeRange?: string | null
): CompanyUnderstanding['intelligenceBalance'] {
  let externalWeight: number;
  let rationale: string;

  switch (signalRichness) {
    case 'rich':
      externalWeight = 0.7;
      rationale = 'Strong external signal coverage. This company has abundant public intelligence available.';
      break;
    case 'moderate':
      externalWeight = 0.6;
      rationale = 'Moderate external signals. Combining with internal context provides a well-rounded view.';
      break;
    case 'sparse':
      externalWeight = 0.4;
      rationale = 'Limited external signals. Internal knowledge and relationship history are critical for understanding.';
      break;
    case 'desert':
      externalWeight = 0.2;
      rationale = 'Minimal external signals detected. Intelligence is primarily based on internal knowledge and any available context.';
      break;
  }

  // Adjust for internal context availability
  const hasInternal = internalContext && (
    (internalContext.contactCount || 0) > 0 ||
    (internalContext.openOpportunities || 0) > 0 ||
    (internalContext.existingNotes || 0) > 0
  );

  if (!hasInternal && signalRichness === 'desert') {
    externalWeight = 0.5; // No internal either — best effort
    rationale = 'Very limited signals from both external and internal sources. Consider manual research to build intelligence baseline.';
  }

  return {
    externalWeight,
    internalWeight: 1 - externalWeight,
    rationale,
  };
}

// ─── Key Change Detection ───────────────────────────────────────

function detectKeyChanges(
  rankedSignals: Array<{ signal: SignalInput & { normalizedType: CanonicalSignalType }; ranking: IntelligenceRankingResult }>,
  input: ReasoningInput
): KeyChange[] {
  const changes: KeyChange[] = [];
  const maxChanges = 5;

  // Group by normalized type to avoid redundant changes
  const seenTypes = new Set<string>();
  const typeGroups = new Map<string, typeof rankedSignals>();

  for (const item of rankedSignals) {
    const list = typeGroups.get(item.signal.normalizedType) || [];
    list.push(item);
    typeGroups.set(item.signal.normalizedType, list);
  }

  // Process each type group, creating one KeyChange per significant type
  for (const [type, items] of typeGroups.entries()) {
    if (changes.length >= maxChanges) break;
    if (seenTypes.has(type)) continue;

    // Skip generic 'news' unless it's the only type
    if (type === 'news' && typeGroups.size > 1) continue;

    seenTypes.add(type);

    const topItem = items[0];
    const supportingItems = items.slice(0, 3);

    // Compute recency
    const refDate = topItem.signal.signalDate || topItem.signal.createdAt;
    const daysSince = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
    const recency: KeyChange['recency'] =
      daysSince <= 1 ? 'today' :
      daysSince <= 7 ? 'this_week' :
      daysSince <= 30 ? 'this_month' : 'older';

    // Check capability match
    let capabilityMatch: string | undefined;
    if (input.capabilities) {
      for (const cap of input.capabilities) {
        const capText = `${cap.title} ${cap.description || ''}`.toLowerCase();
        const signalText = `${topItem.signal.title} ${topItem.signal.description || ''}`.toLowerCase();
        const typeKeywords = getKeywordsForType(type as CanonicalSignalType);
        const hasMatch = typeKeywords.some(kw => capText.includes(kw)) || signalText.split(/\s+/).some(w => w.length > 4 && capText.includes(w));
        if (hasMatch) {
          capabilityMatch = cap.title;
          break;
        }
      }
    }

    changes.push({
      whatChanged: composeWhatChanged(type as CanonicalSignalType, topItem.signal, supportingItems.map(i => i.signal)),
      evidence: supportingItems.map(i => i.signal.title),
      whyItMatters: composeWhyItMatters(type as CanonicalSignalType, topItem.signal, input.companyName),
      signalTypes: [type, ...new Set(items.map(i => i.signal.signalType).filter(t => t !== type))],
      confidence: topItem.ranking.breakdown.confidenceScore / 100,
      recency,
      severity: topItem.signal.severity,
      recommendedAction: composeChangeAction(type as CanonicalSignalType, topItem.signal, input.companyName, capabilityMatch),
      capabilityMatch,
      rankingScore: topItem.ranking.rankingScore,
    });
  }

  return changes.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
}

// ─── Trajectory Detection ───────────────────────────────────────

function computeTrajectory(signals: Array<SignalInput & { normalizedType: CanonicalSignalType }>): CompanyUnderstanding['trajectory'] {
  const typeCounts = new Map<string, number>();
  for (const s of signals) {
    typeCounts.set(s.normalizedType, (typeCounts.get(s.normalizedType) || 0) + 1);
  }

  const hasHiring = (typeCounts.get('hiring') || 0) >= 2;
  const hasExpansion = typeCounts.get('expansion') || 0 >= 1;
  const hasFunding = typeCounts.get('funding') || 0 >= 1;
  const hasLeadershipChange = typeCounts.get('leadership_change') || 0 >= 1;
  const hasTechInvestment = (typeCounts.get('tech_change') || 0) >= 1 || (typeCounts.get('technology_adoption') || 0) >= 1;

  const positiveSignals = (typeCounts.get('hiring') || 0) + (typeCounts.get('expansion') || 0) + (typeCounts.get('funding') || 0) + (typeCounts.get('partnership') || 0);
  const totalSignals = signals.length;

  if (hasHiring && hasExpansion && hasFunding) return 'expanding';
  if (positiveSignals >= 3 || (hasHiring && hasTechInvestment)) return 'growing';
  if (hasLeadershipChange && positiveSignals <= 1) return 'stable'; // Leadership change alone = uncertain
  if (totalSignals >= 2) return 'stable';
  if (totalSignals === 0) return 'unclear';
  return 'stable';
}

// ─── Recommendation Generation ───────────────────────────────────

function generateRecommendations(
  rankedSignals: Array<{ signal: SignalInput & { normalizedType: CanonicalSignalType }; ranking: IntelligenceRankingResult }>,
  input: ReasoningInput,
  keyChanges: KeyChange[]
): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];

  // Recommendation 1: Act on highest-ranked change
  if (keyChanges.length > 0) {
    const top = keyChanges[0];
    recommendations.push({
      action: top.recommendedAction,
      reasoning: `${top.whatChanged} at ${input.companyName}. ${top.whyItMatters}`,
      priority: top.severity === 'critical' ? 'immediate' : top.severity === 'high' ? 'high' : 'medium',
      stakeholder: getStakeholderForType(top.signalTypes[0]),
      drivenBy: top.evidence,
      expectedOutcome: `Engagement opportunity aligned with ${input.companyName}'s current business direction`,
    });
  }

  // Recommendation 2: Capability match
  const matchedChange = keyChanges.find(c => c.capabilityMatch);
  if (matchedChange) {
    recommendations.push({
      action: `Position "${matchedChange.capabilityMatch}" to ${input.companyName}`,
      reasoning: `${matchedChange.capabilityMatch} matches detected ${matchedChange.signalTypes[0].replace(/_/g, ' ')} activity. ${matchedChange.whyItMatters}`,
      priority: 'high',
      stakeholder: 'Account Executive',
      drivenBy: matchedChange.evidence,
      expectedOutcome: `Capability-aligned engagement with clear value proposition`,
    });
  }

  // Recommendation 3: For sparse/desert signals, recommend internal research
  if (keyChanges.length === 0 && rankedSignals.length === 0) {
    recommendations.push({
      action: `Research ${input.companyName} manually and add internal intelligence`,
      reasoning: `No external signals detected for ${input.companyName}. Building internal knowledge through direct engagement is critical for creating intelligence value.`,
      priority: 'medium',
      stakeholder: 'Sales Development Rep',
      drivenBy: [],
      expectedOutcome: `Establish intelligence baseline for ${input.companyName}`,
    });
  }

  // Recommendation 4: Re-engage if stale
  if (input.internalContext?.lastInteractionDays && input.internalContext.lastInteractionDays > 45) {
    recommendations.push({
      action: `Re-engage ${input.companyName} — last interaction was ${input.internalContext.lastInteractionDays} days ago`,
      reasoning: `Significant time gap since last engagement. If combined with recent signal activity, this is a priority outreach opportunity.`,
      priority: 'medium',
      stakeholder: 'Account Executive',
      drivenBy: [],
      expectedOutcome: `Re-establish engagement and gather fresh intelligence`,
    });
  }

  // Recommendation 5: Schedule follow-up for recent changes
  const recentChanges = keyChanges.filter(c => c.recency === 'today' || c.recency === 'this_week');
  if (recentChanges.length > 0 && keyChanges.length > 1) {
    recommendations.push({
      action: `Schedule account review for ${input.companyName} — ${recentChanges.length} recent changes detected`,
      reasoning: `Multiple recent changes indicate active movement at ${input.companyName}. A coordinated account review will ensure nothing is missed.`,
      priority: 'high',
      stakeholder: 'Account Team',
      drivenBy: recentChanges.flatMap(c => c.evidence),
      expectedOutcome: `Coordinated strategy based on current intelligence`,
    });
  }

  return recommendations.sort((a, b) => {
    const p = { immediate: 0, high: 1, medium: 2, low: 3 };
    return (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
  }).slice(0, 5);
}

// ─── Narrative Composition ───────────────────────────────────────

function composeExecutiveSummary(
  input: ReasoningInput,
  keyChanges: KeyChange[],
  trajectory: CompanyUnderstanding['trajectory'],
  balance: CompanyUnderstanding['intelligenceBalance'],
  signalRichness: CompanyUnderstanding['signalRichness']
): string {
  const name = input.companyName;
  const parts: string[] = [];

  // Opening: trajectory
  const trajectoryPhrases: Record<string, string> = {
    expanding: `${name} is in an expansion phase with significant investment activity`,
    growing: `${name} shows active growth signals across multiple dimensions`,
    stable: `${name} appears operationally stable with selective investment`,
    contracting: `${name} shows signals of contraction or reduced activity`,
    unclear: `Limited signals available for ${name} — intelligence assessment is based on available data`,
  };
  parts.push(trajectoryPhrases[trajectory] || trajectoryPhrases.unclear);

  // Key changes summary
  if (keyChanges.length > 0) {
    const changeCount = keyChanges.length;
    const topChange = keyChanges[0].whatChanged;
    const otherTypes = keyChanges.slice(1).map(c => c.signalTypes[0].replace(/_/g, ' '));
    parts.push(`${changeCount} important change${changeCount !== 1 ? 's' : ''} detected: ${topChange}${otherTypes.length > 0 ? `, plus ${otherTypes.join(', ')}` : ''}`);
  } else {
    parts.push(`No significant external changes detected in the current intelligence cycle`);
  }

  // Balance context
  if (balance.externalWeight > 0.6) {
    parts.push(`Assessment is primarily based on strong external intelligence signals`);
  } else if (balance.internalWeight > 0.6) {
    parts.push(`Assessment combines limited external signals with internal knowledge and relationship history`);
  }

  return parts.join('. ') + '.';
}

function composeWhatChanged(
  type: CanonicalSignalType,
  topSignal: SignalInput,
  supportingSignals: SignalInput[]
): string {
  const templates: Record<string, string> = {
    hiring: `${topSignal.title}${supportingSignals.length > 1 ? ` (plus ${supportingSignals.length - 1} related hiring signals)` : ''}`,
    funding: `${topSignal.title}`,
    leadership_change: `${topSignal.title}`,
    people_change: `${topSignal.title}`,
    expansion: `${topSignal.title}`,
    tech_change: `${topSignal.title}`,
    technology_adoption: `${topSignal.title}`,
    partnership: `${topSignal.title}`,
    acquisition: `${topSignal.title}`,
    news: `${topSignal.title}`,
  };
  return templates[type] || topSignal.title;
}

function composeWhyItMatters(
  type: CanonicalSignalType,
  signal: SignalInput,
  companyName: string
): string {
  const templates: Record<string, string> = {
    hiring: `Active hiring at ${companyName} indicates growth trajectory and potential resource needs — may signal upcoming project requirements or team scaling`,
    funding: `Recent funding at ${companyName} means available budget and an active investment phase — prime opportunity for vendor engagement during allocation`,
    leadership_change: `Leadership change at ${companyName} creates a strategic inflection point — new leaders often re-evaluate vendor relationships within their first 90 days`,
    people_change: `Organizational change at the VP/Director level at ${companyName} often precedes new initiatives and budget reallocation`,
    expansion: `Expansion at ${companyName} signals infrastructure and service needs — strong opportunity for scalable solutions`,
    tech_change: `Technology changes at ${companyName} indicate active modernization — potential dissatisfaction with current solutions and a window for competitive positioning`,
    technology_adoption: `${companyName} is actively adopting new technology — indicates investment in capability gaps and potential complementary solution opportunities`,
    partnership: `Partnership activity at ${companyName} signals ecosystem building and potential integration requirements`,
    acquisition: `Acquisition signals major organizational change at ${companyName} — technology consolidation and new vendor evaluation are likely`,
    news: `Recent announcement from ${companyName} may indicate strategic direction change relevant to engagement`,
  };
  return templates[type] || `Signal activity at ${companyName} indicates ongoing business development worth monitoring`;
}

function composeChangeAction(
  type: CanonicalSignalType,
  signal: SignalInput,
  companyName: string,
  capabilityMatch?: string
): string {
  const capText = capabilityMatch ? ` Position "${capabilityMatch}" as a solution.` : '';
  const templates: Record<string, string> = {
    hiring: `Research specific role requirements at ${companyName} to identify capability alignment and outreach timing.${capText}`,
    funding: `Engage executive sponsors at ${companyName} during budget allocation to position solutions for their funded roadmap.${capText}`,
    leadership_change: `Map the new leadership background at ${companyName} and priorities for capability alignment; prepare tailored outreach within 30 days.${capText}`,
    people_change: `Research the organizational change at ${companyName} and identify how it connects to our capability domain; prepare informed outreach.${capText}`,
    expansion: `Position relevant capabilities for ${companyName}'s expansion requirements; identify local stakeholder contacts.${capText}`,
    tech_change: `Map technology change at ${companyName} to relevant capabilities; prepare technical conversation with architecture team.${capText}`,
    technology_adoption: `Map adopted technology at ${companyName} to our integration and competitive landscape; identify complementary or replacement opportunities.${capText}`,
    partnership: `Assess partnership implications for ${companyName}'s competitive landscape; identify co-sell or integration opportunities.${capText}`,
    acquisition: `Monitor acquisition impact on ${companyName}'s existing contracts; prepare for potential technology migration needs.${capText}`,
    news: `Review announcement details from ${companyName} for capability alignment; incorporate into account narrative.${capText}`,
  };
  return templates[type] || `Assess signal at ${companyName} and determine engagement strategy.${capText}`;
}

// ─── Helpers ─────────────────────────────────────────────────────

function estimateBusinessRelevance(type: CanonicalSignalType): number {
  const relevance: Record<string, number> = {
    funding: 0.9,
    hiring: 0.7,
    leadership_change: 0.85,
    people_change: 0.7,
    expansion: 0.8,
    tech_change: 0.75,
    technology_adoption: 0.8,
    partnership: 0.65,
    acquisition: 0.85,
    news: 0.5,
  };
  return relevance[type] || 0.5;
}

function estimateCapabilityFit(type: CanonicalSignalType): number {
  const fit: Record<string, number> = {
    funding: 0.6,
    hiring: 0.4,
    leadership_change: 0.5,
    people_change: 0.4,
    expansion: 0.7,
    tech_change: 0.8,
    technology_adoption: 0.85,
    partnership: 0.6,
    acquisition: 0.7,
    news: 0.3,
  };
  return fit[type] || 0.4;
}

function getStakeholderForType(type: string): string {
  const mapping: Record<string, string> = {
    funding: 'Account Executive',
    hiring: 'Sales Development Rep',
    leadership_change: 'Account Executive',
    people_change: 'Sales Development Rep',
    expansion: 'Account Executive',
    tech_change: 'Solution Architect',
    technology_adoption: 'Solution Architect',
    partnership: 'Business Development',
    acquisition: 'Account Executive',
    news: 'Account Executive',
  };
  return mapping[type] || 'Account Executive';
}

function getKeywordsForType(type: CanonicalSignalType): string[] {
  const keywords: Record<string, string[]> = {
    funding: ['funding', 'investment', 'budget', 'capital'],
    hiring: ['hiring', 'talent', 'recruiting', 'roles', 'jobs'],
    leadership_change: ['leadership', 'executive', 'CEO', 'CTO', 'CIO'],
    people_change: ['VP', 'director', 'head of', 'department'],
    expansion: ['expansion', 'growth', 'new office', 'new market'],
    tech_change: ['technology', 'cloud', 'AI', 'migration', 'modernization'],
    technology_adoption: ['implements', 'adopts', 'deploying', 'standardizes'],
    partnership: ['partnership', 'partner', 'collaboration', 'alliance'],
    acquisition: ['acquisition', 'merger', 'acquires', 'buys'],
    news: ['announces', 'launches', 'release', 'report'],
  };
  return keywords[type] || [];
}

function computeOverallConfidence(
  rankedSignals: Array<{ ranking: IntelligenceRankingResult }>,
  signalRichness: CompanyUnderstanding['signalRichness']
): number {
  if (rankedSignals.length === 0) return 0.3;

  const avgRanking = rankedSignals.reduce((sum, r) => sum + r.ranking.rankingScore, 0) / rankedSignals.length;
  const richnessBonus = signalRichness === 'rich' ? 0.1 : signalRichness === 'moderate' ? 0.05 : 0;
  const countBonus = Math.min(rankedSignals.length * 0.02, 0.1);

  return Math.min(0.95, (avgRanking / 100) * 0.7 + richnessBonus + countBonus);
}
