/**
 * WI-17B — Company Intelligence Profile
 *
 * GET /api/companies/[id]/intelligence-profile
 *
 * The SINGLE aggregated endpoint for the Company Workspace.
 * Combines all AI intelligence into one response:
 *
 *   1. Company Base Data (name, domain, industry, contacts)
 *   2. AI Summary (from research card)
 *   3. Technology Landscape (tech stack, digital maturity)
 *   4. Current Signals (funding, hiring, leadership, etc.)
 *   5. Evidence Timeline (chronological evidence chain)
 *   6. Opportunity Indicators (capability matches)
 *   7. Confidence Score (unified 6-dimension)
 *   8. Activation Status (which AI steps completed)
 *   9. Recommended Actions (AI-generated next steps)
 *   10. "Why this account?" explanation
 *
 * This replaces multiple separate API calls with ONE call.
 * The Company Workspace component should fetch this single endpoint
 * instead of making 5+ separate calls.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { computeUnifiedConfidence } from '@/lib/ai-unified-confidence';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    // ── Fetch all data in parallel ──
    const [
      company,
      signals,
      evidence,
      contacts,
      opportunities,
      capabilities,
      timeline,
    ] = await Promise.all([
      // 1. Company with research card
      db.company.findUnique({
        where: { id },
        include: {
          researchCard: true,
          _count: { select: { contacts: true, signals: true, evidence: true } },
        },
      }),
      // 2. Signals (sorted by date, newest first)
      db.companySignal.findMany({
        where: { companyId: id },
        orderBy: { signalDate: 'desc' },
        take: 20,
      }),
      // 3. Evidence (sorted by creation)
      db.evidence.findMany({
        where: { companyId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      // 4. Contacts
      db.contact.findMany({
        where: { companyId: id },
        select: {
          id: true, rawName: true, email: true, title: true,
          role: true, phone: true, linkedinUrl: true, location: true,
          status: true, leadScore: true, emailHealth: true,
        },
        orderBy: { leadScore: 'desc' },
        take: 15,
      }),
      // 5. Opportunity recommendations
      db.opportunityRecommendation.findMany({
        where: { companyId: id },
        orderBy: { opportunityScore: 'desc' },
        take: 10,
        include: {
          signal: { select: { title: true, signalType: true } },
        },
      }),
      // 6. Capability matches
      db.signalCapabilityMatch.findMany({
        where: {
          signal: { companyId: id },
        },
        take: 10,
        include: {
          capability: true,
          signal: { select: { title: true, signalType: true } },
        },
        orderBy: { matchScore: 'desc' },
      }),
      // 7. Timeline events
      db.companyTimelineEvent.findMany({
        where: { companyId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // ── Parse research card ──
    const rc = company.researchCard;
    const researchCard = rc ? {
      businessOverview: rc.businessOverview || null,
      industry: rc.industry || company.industry || null,
      techStack: safeJsonParse(rc.techStack) || [],
      revenue: rc.revenue || null,
      employeeCount: rc.employeeCount || null,
      fundingStage: rc.fundingStage || null,
      keyPeople: safeJsonParse(rc.keyPeople) || [],
      recentNews: safeJsonParse(rc.recentNews) || [],
      enrichmentSource: rc.enrichmentSource || null,
      enrichmentDate: rc.enrichmentDate?.toISOString() || null,
    } : null;

    // ── Compute confidence score ──
    const signalCount = signals.length;
    const evidenceCount = evidence.length;
    const daysSinceEnrichment = company.lastEnrichedAt
      ? Math.floor((Date.now() - company.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let confidenceResult = null;
    try {
      confidenceResult = computeUnifiedConfidence({
        entityId: company.id,
        entityType: 'company',
        fieldConfidence: {
          name: 1.0,
          domain: company.domain ? 0.9 : 0.2,
          industry: company.industry ? 0.8 : 0.1,
          size: company.sizeRange ? 0.7 : 0.1,
          location: company.location ? 0.8 : 0.1,
          contacts: Math.min(1.0, company._count.contacts / 5),
        },
        dataCompleteness: [
          company.rawName ? 1 : 0,
          company.domain ? 1 : 0,
          company.industry ? 1 : 0,
          company.location ? 1 : 0,
          company._count.contacts > 0 ? 1 : 0,
          !!rc ? 1 : 0,
          signalCount > 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0) / 7,
        sources: company.source === 'manual'
          ? [{ name: 'manual_entry', reliability: 0.95, type: 'internal' }]
          : [{ name: 'data_import', reliability: 0.75, type: 'csv_import' }],
        averageSourceReliability: company.source === 'manual' ? 0.95 : 0.75,
        daysSinceResearch: daysSinceEnrichment,
        freshnessScore: company.lastEnrichedAt ? Math.max(0, 100 - daysSinceEnrichment * 2) : 0,
        crossValidatedFacts: rc ? 3 : 0,
        totalFacts: rc ? 5 : 1,
        contradictions: 0,
        evidenceCount,
        evidenceCoverage: signalCount > 0 ? Math.min(1.0, evidenceCount / 5) : 0,
        coveredDimensions: [
          company.rawName ? 1 : 0,
          company.domain ? 1 : 0,
          company.industry ? 1 : 0,
          company.sizeRange ? 1 : 0,
          company.location ? 1 : 0,
          company._count.contacts > 0 ? 1 : 0,
          signalCount > 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0),
        expectedDimensions: 7,
        evidenceGaps: [
          !company.domain ? 1 : 0,
          !company.industry ? 1 : 0,
          signalCount === 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0),
        aiOutputConfidence: signalCount > 0 ? 0.8 : 0.5,
        hallucinationRiskScore: signalCount > 0 ? 15 : 40,
        qualityGateScore: signalCount > 0 ? 85 : 50,
      });
    } catch (err) {
      logger.warn(`[IntelligenceProfile] Confidence calculation failed for ${company.rawName}: ${err instanceof Error ? err.message : err}`);
    }

    // ── Signal severity summary ──
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const s of signals) {
      if (s.severity in severityCounts) severityCounts[s.severity as keyof typeof severityCounts]++;
    }

    // ── Signal type distribution ──
    const typeCounts: Record<string, number> = {};
    for (const s of signals) {
      typeCounts[s.signalType] = (typeCounts[s.signalType] || 0) + 1;
    }

    // ── Top recommendations (from signals) ──
    const topActions = signals
      .filter(s => s.recommendedAction && s.severity !== 'low')
      .sort((a, b) => {
        const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (sevOrder[a.severity as keyof typeof sevOrder] ?? 3) - (sevOrder[b.severity as keyof typeof sevOrder] ?? 3);
      })
      .slice(0, 5)
      .map(s => ({
        signal: s.title,
        action: s.recommendedAction!,
        severity: s.severity,
        timing: s.timingWindow || 'unknown',
        confidence: s.confidence,
        source: s.source,
        signalDate: s.signalDate?.toISOString() || null,
      }));

    // ── "Why this account?" explanation ──
    const whyThisAccount = buildWhyThisAccount(company, signals, researchCard, capabilities, contacts);

    return NextResponse.json({
      // 1. Company Base
      company: {
        id: company.id,
        name: company.rawName,
        domain: company.domain,
        industry: company.industry,
        sizeRange: company.sizeRange,
        location: company.location,
        country: company.country,
        website: company.website,
        status: company.status,
        source: company.source,
        intelligenceScore: company.intelligenceScore,
        lastEnrichedAt: company.lastEnrichedAt?.toISOString() || null,
        contactCount: company._count.contacts,
        signalCount: company._count.signals,
      },

      // 2. AI Summary
      aiSummary: researchCard ? {
        overview: researchCard.businessOverview,
        industry: researchCard.industry,
        revenue: researchCard.revenue,
        employees: researchCard.employeeCount,
        fundingStage: researchCard.fundingStage,
      } : null,

      // 3. Technology Landscape
      technology: researchCard ? {
        techStack: researchCard.techStack,
        techCategories: categorizeTechStack(researchCard.techStack),
      } : null,

      // 4. Current Signals
      signals: {
        items: signals.map(s => ({
          id: s.id,
          type: s.signalType,
          title: s.title,
          description: s.description,
          severity: s.severity,
          impact: s.impact,
          confidence: s.confidence,
          source: s.source,
          sourceUrl: s.sourceUrl,
          signalDate: s.signalDate?.toISOString() || null,
          recommendedAction: s.recommendedAction,
          timingWindow: s.timingWindow,
          isRead: s.isRead,
        })),
        summary: {
          total: signals.length,
          bySeverity: severityCounts,
          byType: typeCounts,
          unread: signals.filter(s => !s.isRead).length,
        },
      },

      // 5. Evidence Timeline
      evidenceTimeline: evidence.map(e => ({
        id: e.id,
        sourceName: e.sourceName,
        sourceUrl: e.sourceUrl,
        extractedField: e.extractedField,
        extractedValue: e.extractedValue,
        confidence: e.confidence,
        createdAt: e.createdAt?.toISOString() || null,
      })),

      // 6. Opportunity Indicators
      opportunities: {
        items: opportunities.map(o => ({
          id: o.id,
          title: o.opportunityTitle,
          businessProblem: o.businessProblem,
          score: o.opportunityScore,
          status: o.status,
          priority: o.priority,
        })),
        capabilityMatches: capabilities.map(cm => ({
          id: cm.id,
          capability: cm.capability?.title || 'Unknown',
          category: cm.capability?.category || null,
          signal: cm.signal?.title || 'Unknown',
          confidence: cm.matchScore,
        })),
        totalOpportunities: opportunities.length,
        totalCapabilityMatches: capabilities.length,
      },

      // 7. Confidence Score
      confidence: confidenceResult ? {
        score: confidenceResult.score,
        grade: confidenceResult.grade,
        trustClass: confidenceResult.trustClass,
        enterpriseReady: confidenceResult.enterpriseReady,
        factors: confidenceResult.factors.map(f => ({
          name: f.dimension,
          score: f.score,
          weight: f.weight,
        })),
        summary: confidenceResult.summary,
        recommendations: confidenceResult.recommendations,
      } : null,

      // 8. Activation Status (derived)
      activationStatus: {
        lastEnrichedAt: company.lastEnrichedAt?.toISOString() || null,
        hasResearchCard: !!rc,
        hasSignals: signalCount > 0,
        hasEvidence: evidenceCount > 0,
        hasOpportunities: opportunities.length > 0,
        dataCompleteness: [
          company.rawName ? 1 : 0,
          company.domain ? 1 : 0,
          company.industry ? 1 : 0,
          company.location ? 1 : 0,
          company._count.contacts > 0 ? 1 : 0,
          !!rc ? 1 : 0,
          signalCount > 0 ? 1 : 0,
        ].reduce((a, b) => a + b, 0) / 7,
      },

      // 9. Recommended Actions
      recommendedActions: topActions,

      // 10. Why This Account
      whyThisAccount,

      // Contacts (for sidebar)
      contacts: contacts.map(c => ({
        id: c.id,
        name: c.rawName,
        email: c.email,
        title: c.title,
        role: c.role,
        leadScore: c.leadScore,
        emailHealth: c.emailHealth,
      })),

      // Timeline
      timeline: timeline.map(t => ({
        id: t.id,
        eventType: t.eventType,
        title: t.title,
        description: t.description,
        eventDate: t.createdAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    logger.error('[IntelligenceProfile] Failed:', { error, companyId: id });
    return NextResponse.json({ error: 'Failed to fetch intelligence profile' }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function safeJsonParse(str: unknown): unknown[] {
  if (typeof str !== 'string') return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function categorizeTechStack(techStack: unknown[]): { category: string; items: string[] }[] {
  if (!techStack || techStack.length === 0) return [];

  const categories: Record<string, string[]> = {
    'Cloud Infrastructure': [],
    'Frontend': [],
    'Backend': [],
    'DevOps': [],
    'Data & Analytics': [],
    'AI / ML': [],
    'Security': [],
    'Communication': [],
    'Other': [],
  };

  const patterns: Record<string, RegExp> = {
    'Cloud Infrastructure': /^(aws|azure|gcp|google cloud|amazon web services|digitalocean|heroku|vercel|netlify|cloudflare)/i,
    'Frontend': /^(react|vue|angular|next\.js|nuxt|svelte|tailwind|typescript|javascript|html|css)/i,
    'Backend': /^(node\.js|python|java|go|rust|ruby|php|c\+\+|\.net|django|flask|express|spring|rails|fastapi)/i,
    'DevOps': /^(docker|kubernetes|terraform|ansible|jenkins|github actions|gitlab ci|circleci|argocd|helm)/i,
    'Data & Analytics': /^(snowflake|databricks|bigquery|redshift|tableau|looker|power bi|spark|kafka|airflow|dbt)/i,
    'AI / ML': /^(tensorflow|pytorch|openai|langchain|hugging face|gpt|llm|machine learning|deep learning|nlp)/i,
    'Security': /^(okta|auth0|crowdstrike|sentinel|vault|cloudflare|zscaler|ping)/i,
    'Communication': /^(slack|teams|zoom|twilio|sendgrid|mailchimp|intercom|hubspot|salesforce)/i,
  };

  for (const tech of techStack) {
    const techStr = String(tech).trim();
    if (!techStr) continue;

    let categorized = false;
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(techStr)) {
        categories[category].push(techStr);
        categorized = true;
        break;
      }
    }
    if (!categorized) {
      categories['Other'].push(techStr);
    }
  }

  return Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }));
}

function buildWhyThisAccount(
  company: {
    rawName: string;
    domain: string | null;
    industry: string | null;
    sizeRange: string | null;
    intelligenceScore: number | null;
    _count: { contacts: number; signals: number; evidence: number };
  },
  signals: Array<{
    signalType: string;
    severity: string;
    title: string;
    confidence: number;
    recommendedAction: string | null;
    source: string | null;
    signalDate: Date | null;
  }>,
  researchCard: {
    businessOverview: string | null;
    industry: string | null;
    techStack: unknown[];
    recentNews: unknown[];
  } | null,
  capabilities: Array<{
    capability: { title: string; category: string | null } | null;
    matchScore: number;
  }>,
  contacts: Array<{ rawName: string; title: string | null; leadScore: number | null }>,
): {
  summary: string;
  signals: Array<{ title: string; why: string }>;
  opportunities: string[];
  contacts: string[];
  dataQuality: string;
} {
  const reasons: string[] = [];
  const signalReasons: Array<{ title: string; why: string }> = [];
  const opportunityReasons: string[] = [];
  const contactHighlights: string[] = [];

  // Signal-based reasons
  const highValueSignals = signals.filter(s =>
    ['critical', 'high'].includes(s.severity)
  );

  for (const signal of highValueSignals.slice(0, 3)) {
    signalReasons.push({
      title: signal.title,
      why: `${signal.signalType} signal (${signal.severity} severity, ${Math.round(signal.confidence * 100)}% confidence) — ${signal.recommendedAction || 'Monitor closely'}`,
    });
  }

  // Capability-based reasons
  if (capabilities.length > 0) {
    const topCapabilities = capabilities.slice(0, 3);
    opportunityReasons.push(
      ...topCapabilities.map(c =>
        `${c.capability?.title || 'Unknown'} capability match (${Math.round(c.matchScore * 100)}% confidence)`
      )
    );
  }

  // Contact-based reasons
  const highValueContacts = contacts
    .filter(c => (c.leadScore || 0) >= 70)
    .slice(0, 3);
  for (const contact of highValueContacts) {
    contactHighlights.push(
      `${contact.rawName}${contact.title ? ` (${contact.title})` : ''} — lead score ${contact.leadScore}`
    );
  }

  // Data quality
  const dataPoints = [
    company.domain ? 'domain' : null,
    company.industry ? 'industry' : null,
    company.sizeRange ? 'size' : null,
    company._count.contacts > 0 ? 'contacts' : null,
    researchCard ? 'AI research' : null,
    signals.length > 0 ? 'signals' : null,
  ].filter(Boolean);

  const dataQuality = dataPoints.length >= 5
    ? `Strong — ${dataPoints.length}/6 data dimensions available`
    : dataPoints.length >= 3
      ? `Moderate — ${dataPoints.length}/6 data dimensions available`
      : `Limited — ${dataPoints.length}/6 data dimensions available`;

  // Build summary
  const summaryParts: string[] = [];
  if (highValueSignals.length > 0) {
    summaryParts.push(`${highValueSignals.length} high-value signals detected`);
  }
  if (capabilities.length > 0) {
    summaryParts.push(`${capabilities.length} capability matches found`);
  }
  if (highValueContacts.length > 0) {
    summaryParts.push(`${highValueContacts.length} high-value contacts identified`);
  }
  if (company.intelligenceScore && company.intelligenceScore > 60) {
    summaryParts.push(`intelligence score of ${company.intelligenceScore}`);
  }

  return {
    summary: summaryParts.length > 0
      ? `${company.rawName} is flagged because: ${summaryParts.join(', ')}.`
      : `${company.rawName} has basic data. Enrichment recommended to unlock full intelligence.`,
    signals: signalReasons,
    opportunities: opportunityReasons,
    contacts: contactHighlights,
    dataQuality,
  };
}
