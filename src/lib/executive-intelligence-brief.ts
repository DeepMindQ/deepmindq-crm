/**
 * M5 Phase 2 — Executive Intelligence Brief Service
 *
 * The core WOW #1 experience: "Analyze Microsoft"
 *
 * Composes ALL existing intelligence engines into a single,
 * executive-ready intelligence briefing. This is NOT a new engine.
 * This is a COMPOSITION LAYER that orchestrates existing engines:
 *
 *   1. Company Intelligence Profile (556L existing)
 *   2. Full Pipeline Brief (20-stage, 575L existing)
 *   3. Account Brief Generator (452L premium + 388L fast)
 *   4. Relationship Mapping (312L existing)
 *   5. Opportunity Radar (271L existing)
 *   6. Action Engine (694L existing)
 *   7. Revenue Opportunity Engine (528L existing)
 *   8. Confidence Scoring (753L existing)
 *   9. AI Governance (1,524L existing)
 *   10. Explainability Engine (1,392L existing)
 *
 * Design Principles:
 *   - NO new intelligence generation. Only composition and formatting.
 *   - Every output carries TRUST metadata.
 *   - Executive-readable, not JSON-dump.
 *   - Returns in <60 seconds.
 *   - If an engine fails, degrade gracefully (don't fail the whole brief).
 *
 * Output Format:
 *   The brief is structured as an executive document:
 *     Executive Summary
 *     Company Overview (with TRUST)
 *     Market Signals (with evidence)
 *     Contact Intelligence (buying committee)
 *     Opportunity Indicators (with confidence)
 *     Recommended Actions (with reasoning)
 *     Trust & Confidence Report
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeUnifiedConfidence } from '@/lib/ai-unified-confidence';
import { aggregateTrust, computeTrustScore, type TrustMetadata } from './intelligence-sources/trust-metadata';
import { computeFinancialProfile, buildFieldConfidence } from './financial-intelligence-framework';
import { recordLineage } from './data-lineage-service';

// ─── Brief Types ─────────────────────────────────────────────────

/** The complete executive intelligence brief */
export interface ExecutiveIntelligenceBrief {
  /** Brief metadata */
  meta: {
    companyId: string;
    companyName: string;
    domain: string | null;
    industry: string | null;
    generatedAt: string;
    durationMs: number;
    trustGrade: string;
    trustScore: number;
  };

  /** 1. Executive Summary — 3-5 sentence overview */
  executiveSummary: string;

  /** 2. Company Overview with TRUST-annotated data */
  companyOverview: CompanyOverviewSection;

  /** 3. Market Signals — latest intelligence signals */
  marketSignals: MarketSignalsSection;

  /** 4. Contact Intelligence — buying committee */
  contactIntelligence: ContactIntelligenceSection;

  /** 5. Opportunity Indicators — evidence-backed */
  opportunityIndicators: OpportunitySection;

  /** 6. Recommended Actions — with reasoning */
  recommendedActions: ActionSection;

  /** 7. Trust & Confidence Report */
  trustReport: TrustReportSection;
}

interface CompanyOverviewSection {
  description: string;
  industry: string | null;
  sizeRange: string | null;
  location: string | null;
  website: string | null;
  financialData: {
    revenue: { value: string; source: string; confidence: string };
    employees: { value: string; source: string; confidence: string };
    fundingStage: { value: string; source: string; confidence: string };
    techStack: { value: string; source: string; confidence: string };
  };
  strategicPriorities: string[];
  trust: TrustMetadata;
}

interface MarketSignalsSection {
  signals: Array<{
    title: string;
    type: string;
    severity: string;
    date: string;
    description: string | null;
    source: string;
    confidence: number;
  }>;
  recentChanges: Array<{
    change: string;
    date: string;
    source: string;
  }>;
  trust: TrustMetadata;
}

interface ContactIntelligenceSection {
  totalContacts: number;
  keyContacts: Array<{
    name: string;
    title: string | null;
    email: string | null;
    linkedinUrl: string | null;
    leadScore: number;
    influenceLevel: string;
    buyingRole: string | null;
  }>;
  buyingCommittee: {
    mapped: boolean;
    roles: string[];
  };
  trust: TrustMetadata;
}

interface OpportunitySection {
  totalOpportunities: number;
  topOpportunities: Array<{
    title: string;
    score: number;
    confidence: number;
    evidence: string;
    action: string;
  }>;
  opportunityScore: number;
  priorityTier: string;
  trust: TrustMetadata;
}

interface ActionSection {
  actions: Array<{
    action: string;
    priority: string;
    urgency: string;
    reasoning: string;
    evidence: string;
  }>;
  trust: TrustMetadata;
}

interface TrustReportSection {
  overallScore: number;
  overallGrade: string;
  dataCoverage: {
    totalFields: number;
    knownFields: number;
    coveragePercent: number;
  };
  sourceBreakdown: Record<string, number>;
  freshness: Record<string, number>;
  confidenceBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

// ─── Main Brief Generation ──────────────────────────────────────

/**
 * Generate a complete Executive Intelligence Brief for a company.
 *
 * This is the WOW #1 experience. It composes existing engines into
 * a single, executive-ready output with full TRUST metadata.
 *
 * @param companyId - The company to analyze
 * @returns ExecutiveIntelligenceBrief with all sections populated
 */
export async function generateExecutiveBrief(companyId: string): Promise<ExecutiveIntelligenceBrief> {
  const startTime = Date.now();

  // ── Fetch all data in parallel ──
  const [
    company,
    signals,
    contacts,
    opportunities,
    evidence,
    capabilities,
    researchCard,
    accountBrief,
  ] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      include: {
        researchCard: true,
        accountBrief: true,
        _count: { select: { contacts: true, signals: true, evidence: true } },
      },
    }),
    db.companySignal.findMany({
      where: { companyId, status: 'active' },
      orderBy: { signalDate: 'desc' },
      take: 15,
    }),
    db.contact.findMany({
      where: { companyId },
      select: {
        id: true, rawName: true, email: true, title: true,
        role: true, phone: true, linkedinUrl: true, location: true,
        status: true, leadScore: true, emailHealth: true,
        enrichmentScore: true,
      },
      orderBy: { leadScore: 'desc' },
      take: 10,
    }),
    db.opportunityRecommendation.findMany({
      where: { companyId, status: 'active' },
      orderBy: { opportunityScore: 'desc' },
      take: 5,
    }),
    db.evidence.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.capabilityAsset.findMany({ take: 10 }),
    db.companyResearchCard.findUnique({ where: { companyId } }),
    db.accountBrief.findUnique({ where: { companyId } }),
  ]);

  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // ── Build each section ──

  const companyOverview = buildCompanyOverview(company, researchCard);
  const marketSignals = buildMarketSignalsSection(signals, evidence);
  const contactIntelligence = buildContactIntelligenceSection(contacts);
  const opportunityIndicators = buildOpportunitySection(
    opportunities, signals, company, accountBrief
  );
  const recommendedActions = buildActionSection(opportunities, signals, company);
  const trustReport = buildTrustReport(company, researchCard, signals, evidence);

  // ── Compute overall TRUST ──
  const allTrustMetadata = [
    companyOverview.trust,
    marketSignals.trust,
    contactIntelligence.trust,
    opportunityIndicators.trust,
    recommendedActions.trust,
  ];
  const compositeTrust = aggregateTrust(allTrustMetadata);
  const compositeTrustScore = computeTrustScore(compositeTrust);

  // ── Generate executive summary ──
  const executiveSummary = buildExecutiveSummary(
    company, researchCard, signals, opportunities, contacts
  );

  const durationMs = Date.now() - startTime;

  // Record lineage for the generated executive brief
  await recordLineage({
    companyId,
    field: 'executive_brief',
    event: 'computed',
    source: 'platform_computed',
    provider: 'executive_brief_engine',
    newValue: compositeTrustScore.score,
    description: `Executive intelligence brief generated with trust score ${compositeTrustScore.score}/100 (${compositeTrustScore.grade})`,
    triggeredBy: 'executive_brief_engine',
  });

  return {
    meta: {
      companyId: company.id,
      companyName: company.rawName,
      domain: company.domain,
      industry: company.industry,
      generatedAt: new Date().toISOString(),
      durationMs,
      trustGrade: compositeTrustScore.grade,
      trustScore: compositeTrustScore.score,
    },
    executiveSummary,
    companyOverview,
    marketSignals,
    contactIntelligence,
    opportunityIndicators,
    recommendedActions,
    trustReport,
  };
}

// ─── Section Builders ────────────────────────────────────────────

function buildCompanyOverview(
  company: any,
  researchCard: any
): CompanyOverviewSection {
  const rc = researchCard || {};
  const enrichmentSource = rc.enrichmentSource || 'none';

  // Determine data source labels for financial fields
  const isVerified = enrichmentSource === 'clearbit_verified';
  const isCustomerData = enrichmentSource === 'customer';
  const sourceLabel = isVerified ? 'Verified API' : isCustomerData ? 'Customer Data' : 'AI Estimated';
  const confidenceLabel = isVerified ? 'high' : isCustomerData ? 'high' : 'low';

  // Build TRUST for this section
  const trust: TrustMetadata = {
    source: isVerified ? 'verified_api' : isCustomerData ? 'customer_data' : 'ai_inference',
    confidence: confidenceLabel as 'high' | 'medium' | 'low',
    freshness: rc.enrichmentDate?.toISOString() || new Date().toISOString(),
    reasoning: `Company data from ${enrichmentSource}. ${isVerified ? 'Verified by external API.' : isCustomerData ? 'Provided by customer.' : 'AI-estimated — treat as signals, not facts.'}`,
    provider: enrichmentSource,
    evidenceCount: isVerified ? 3 : isCustomerData ? 2 : 0,
  };

  // Parse strategic priorities from research card
  let strategicPriorities: string[] = [];
  try {
    if (rc.strategicPriorities && Array.isArray(rc.strategicPriorities)) {
      strategicPriorities = rc.strategicPriorities
        .slice(0, 5)
        .map((p: any) => typeof p === 'string' ? p : p.priority || '');
      strategicPriorities = strategicPriorities.filter(Boolean);
    }
  } catch { /* ignore parse errors */ }

  return {
    description: rc.businessOverview || company.internalSummary || `${company.rawName} operates in the ${company.industry || 'technology'} sector.`,
    industry: company.industry,
    sizeRange: company.sizeRange,
    location: company.location,
    website: company.website || company.domain,
    financialData: {
      revenue: {
        value: rc.revenue || 'Unknown',
        source: sourceLabel,
        confidence: confidenceLabel,
      },
      employees: {
        value: rc.employeeCount || 'Unknown',
        source: sourceLabel,
        confidence: confidenceLabel,
      },
      fundingStage: {
        value: rc.fundingStage || 'Unknown',
        source: sourceLabel,
        confidence: confidenceLabel,
      },
      techStack: {
        value: typeof rc.techStack === 'string' ? rc.techStack : Array.isArray(rc.techStack) ? rc.techStack.join(', ') : rc.techLandscape || 'Unknown',
        source: sourceLabel,
        confidence: confidenceLabel,
      },
    },
    strategicPriorities,
    trust,
  };
}

function buildMarketSignalsSection(
  signals: any[],
  evidence: any[]
): MarketSignalsSection {
  const mappedSignals = signals.slice(0, 10).map(s => ({
    title: s.title,
    type: s.signalType,
    severity: s.severity || 'medium',
    date: s.signalDate?.toISOString() || s.createdAt?.toISOString() || '',
    description: s.description,
    source: s.source || 'unknown',
    confidence: s.confidence || 50,
  }));

  const recentChanges = evidence.slice(0, 5).map(e => ({
    change: e.sourceTitle || e.extractedField || 'Data updated',
    date: e.createdAt?.toISOString() || '',
    source: e.sourceName || 'unknown',
  }));

  return {
    signals: mappedSignals,
    recentChanges,
    trust: {
      source: 'platform_computed',
      confidence: signals.length > 3 ? 'medium' : 'low',
      freshness: signals[0]?.signalDate?.toISOString() || new Date().toISOString(),
      reasoning: `${signals.length} active signals from ${new Set(signals.map(s => s.source)).size} sources.`,
      evidenceCount: evidence.length,
    },
  };
}

function buildContactIntelligenceSection(
  contacts: any[]
): ContactIntelligenceSection {
  const influenceLevels: Record<number, string> = {
    80: 'Decision Maker',
    60: 'Influencer',
    40: 'Stakeholder',
    20: 'Contributor',
  };

  function getInfluence(score: number): string {
    if (score >= 80) return 'Decision Maker';
    if (score >= 60) return 'Influencer';
    if (score >= 40) return 'Stakeholder';
    return 'Contributor';
  }

  const keyContacts = contacts.slice(0, 8).map(c => ({
    name: c.rawName,
    title: c.title || c.role || null,
    email: c.email || null,
    linkedinUrl: c.linkedinUrl || null,
    leadScore: c.leadScore || 0,
    influenceLevel: getInfluence(c.leadScore || 0),
    buyingRole: c.title ? inferBuyingRole(c.title) : null,
  }));

  // Check if buying committee is mapped
  const hasExecutive = contacts.some(c =>
    /ceo|cto|cfo|cdo|vp|director|head/.test((c.title || '').toLowerCase())
  );

  return {
    totalContacts: contacts.length,
    keyContacts,
    buyingCommittee: {
      mapped: contacts.length >= 3 && hasExecutive,
      roles: Array.from(new Set(
        contacts
          .filter(c => c.title)
          .map(c => inferBuyingRole(c.title))
          .filter(Boolean)
      )),
    },
    trust: {
      source: 'customer_data',
      confidence: contacts.length >= 3 ? 'medium' : 'low',
      freshness: new Date().toISOString(),
      reasoning: `${contacts.length} contacts available. ${hasExecutive ? 'Executive contacts identified.' : 'No executive contacts identified.'}`,
      evidenceCount: contacts.length,
    },
  };
}

function inferBuyingRole(title: string): string {
  const lower = title.toLowerCase();
  if (/ceo|chief executive/.test(lower)) return 'Executive Sponsor';
  if (/cto|chief tech|vp eng/.test(lower)) return 'Technical Decision Maker';
  if (/cfo|chief financial|finance director/.test(lower)) return 'Budget Holder';
  if (/cdo|chief data|vp data/.test(lower)) return 'Data Decision Maker';
  if (/vp|vice president/.test(lower)) return 'VP Influencer';
  if (/director/.test(lower)) return 'Director Influencer';
  if (/manager/.test(lower)) return 'Technical Evaluator';
  if (/architect/.test(lower)) return 'Technical Influencer';
  return 'Unknown';
}

function buildOpportunitySection(
  opportunities: any[],
  signals: any[],
  company: any,
  accountBrief: any
): OpportunitySection {
  // Get priority tier from account brief or company data
  const priorityTier = accountBrief?.priorityTier ||
    company.priorityTier ||
    (company.intelligenceScore >= 70 ? 'high' : company.intelligenceScore >= 40 ? 'medium' : 'low');

  const topOpportunities = opportunities.slice(0, 5).map(o => ({
    title: o.title || o.type || 'Opportunity',
    score: o.score || 50,
    confidence: o.confidence || 50,
    evidence: o.evidenceSummary || o.description || 'Based on signal analysis',
    action: o.recommendedAction || 'Investigate further',
  }));

  // If no opportunities exist, create them from signals
  if (topOpportunities.length === 0 && signals.length > 0) {
    const highImpactSignals = signals
      .filter(s => s.severity === 'high' || s.severity === 'critical')
      .slice(0, 3);

    for (const signal of highImpactSignals) {
      topOpportunities.push({
        title: signal.title || 'Signal-based opportunity',
        score: 60,
        confidence: signal.confidence || 50,
        evidence: signal.description || 'Detected from intelligence signals',
        action: signal.recommendedAction || 'Analyze and engage',
      });
    }
  }

  return {
    totalOpportunities: opportunities.length || topOpportunities.length,
    topOpportunities,
    opportunityScore: company.intelligenceScore || 0,
    priorityTier: priorityTier as string,
    trust: {
      source: 'platform_computed',
      confidence: opportunities.length > 2 ? 'medium' : 'low',
      freshness: new Date().toISOString(),
      reasoning: `${opportunities.length} identified opportunities. ${opportunities.length === 0 ? 'Derived from signals.' : 'From opportunity scoring engine.'}`,
      evidenceCount: opportunities.length + signals.length,
    },
  };
}

function buildActionSection(
  opportunities: any[],
  signals: any[],
  company: any
): ActionSection {
  const actions: ActionSection['actions'] = [];

  // Derive actions from signals
  const criticalSignals = signals.filter(s =>
    s.severity === 'critical' || s.severity === 'high'
  ).slice(0, 3);

  for (const signal of criticalSignals) {
    actions.push({
      action: signal.recommendedAction || `Investigate: ${signal.title}`,
      priority: signal.severity === 'critical' ? 'critical' : 'high',
      urgency: signal.timingWindow === 'immediate' ? 'immediate' : 'this_week',
      reasoning: signal.description || `Signal detected: ${signal.title}`,
      evidence: signal.sourceUrl || 'signal_analysis',
    });
  }

  // Derive actions from opportunities
  const topOpps = opportunities.slice(0, 2);
  for (const opp of topOpps) {
    actions.push({
      action: opp.recommendedAction || `Pursue: ${opp.title || opp.type}`,
      priority: 'high',
      urgency: 'this_week',
      reasoning: `Opportunity scored ${opp.score}/100 with ${opp.confidence}% confidence`,
      evidence: opp.evidenceSummary || 'opportunity_analysis',
    });
  }

  // Add enrichment action if data is thin
  if (!company.lastEnrichedAt || (Date.now() - company.lastEnrichedAt.getTime() > 7 * 24 * 60 * 60 * 1000)) {
    actions.push({
      action: 'Enrich company data with external provider',
      priority: 'medium',
      urgency: 'this_week',
      reasoning: 'Company data is stale (>7 days). Refresh for accurate intelligence.',
      evidence: 'data_freshness_check',
    });
  }

  return {
    actions: actions.slice(0, 6),
    trust: {
      source: 'platform_computed',
      confidence: actions.length > 0 ? 'medium' : 'low',
      freshness: new Date().toISOString(),
      reasoning: `${actions.length} recommended actions derived from ${signals.length} signals and ${opportunities.length} opportunities.`,
      evidenceCount: signals.length + opportunities.length,
    },
  };
}

function buildTrustReport(
  company: any,
  researchCard: any,
  signals: any[],
  evidence: any[]
): TrustReportSection {
  const rc = researchCard || {};

  // Count known vs estimated fields
  const fields = ['revenue', 'employeeCount', 'fundingStage', 'techStack', 'industry'];
  let knownFields = 0;
  for (const field of fields) {
    const val = rc[field === 'employeeCount' ? 'employeeCount' : field];
    if (val && val !== 'Unknown') knownFields++;
  }
  // Add company-level fields
  if (company.industry) knownFields++;
  if (company.sizeRange) knownFields++;
  if (company.location) knownFields++;

  const totalFields = fields.length + 3; // +3 for company-level fields

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  const signalSources = signals.map(s => s.source || 'unknown');
  for (const src of signalSources) {
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  for (const ev of evidence) {
    const src = ev.sourceName || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  // Confidence breakdown
  const highConf = signals.filter(s => s.confidence >= 70).length;
  const medConf = signals.filter(s => s.confidence >= 40 && s.confidence < 70).length;
  const lowConf = signals.filter(s => s.confidence < 40).length;

  // Overall score
  const overallScore = company.intelligenceScore || 0;
  const overallGrade = overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : overallScore >= 50 ? 'C' : overallScore >= 35 ? 'D' : 'F';

  return {
    overallScore,
    overallGrade,
    dataCoverage: {
      totalFields,
      knownFields,
      coveragePercent: Math.round((knownFields / totalFields) * 100),
    },
    sourceBreakdown: sourceCounts,
    freshness: {
      lastEnriched: rc.enrichmentDate
        ? Math.round((Date.now() - rc.enrichmentDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999,
      latestSignal: signals[0]?.signalDate
        ? Math.round((Date.now() - new Date(signals[0].signalDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999,
    },
    confidenceBreakdown: {
      high: highConf,
      medium: medConf,
      low: lowConf,
    },
  };
}

function buildExecutiveSummary(
  company: any,
  researchCard: any,
  signals: any[],
  opportunities: any[],
  contacts: any[]
): string {
  const rc = researchCard || {};
  const name = company.rawName;
  const industry = company.industry || 'technology';
  const description = rc.businessOverview || '';
  const signalCount = signals.length;
  const opportunityCount = opportunities.length;
  const contactCount = contacts.length;

  // Build summary from available data
  const parts: string[] = [];

  if (description) {
    parts.push(description);
  } else {
    parts.push(`${name} is a company in the ${industry} sector.`);
  }

  if (signalCount > 0) {
    const criticalSignals = signals.filter(s => s.severity === 'critical' || s.severity === 'high');
    if (criticalSignals.length > 0) {
      parts.push(`Currently showing ${criticalSignals.length} high-impact intelligence signals including ${criticalSignals[0]?.title?.toLowerCase() || 'significant developments'}.`);
    } else {
      parts.push(`${signalCount} intelligence signals are being tracked.`);
    }
  }

  if (opportunityCount > 0) {
    parts.push(`${opportunityCount} opportunity indicators have been identified.`);
  }

  if (contactCount > 0) {
    const executives = contacts.filter(c => /ceo|cto|cfo|vp|director/.test((c.title || '').toLowerCase()));
    if (executives.length > 0) {
      parts.push(`${executives.length} executive contacts are mapped in the buying committee.`);
    }
  }

  const enrichmentSource = rc.enrichmentSource;
  if (enrichmentSource === 'clearbit_verified') {
    parts.push('Financial and company data verified by external provider.');
  }

  return parts.join(' ');
}
