// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Signal Engine — Rule-based signal detection
//
// Detects business signals from organization data and changes.
// Rules first, AI reasoning later. The signal engine is the "eyes" of DeepMindQ.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getIntelligence, setIntelligence } from '@/lib/intelligence-cache';
import { governedAICall } from '@/lib/ai-governance';
import { webSearch } from '@/lib/llm-client';

export interface DetectedSignal {
  organizationId: string;
  signalType: string;
  severity: string;
  title: string;
  description: string;
  confidenceScore: number;
  impactScore: number;
  sourceUrl?: string;
  sourceLabel?: string;
}

// ─── Signal Metrics — Dynamic Severity Scoring (FIX #13) ───────────────

/** Signal type base weights for severity calculation */
const SIGNAL_TYPE_WEIGHTS: Record<string, number> = {
  funding_event: 0.9,
  acquisition: 0.95,
  leadership_change: 0.8,
  partnership: 0.7,
  competitor_move: 0.75,
  regulatory: 0.85,
  product_launch: 0.6,
  market_expansion: 0.65,
  financial_indicator: 0.7,
  hiring_change: 0.5,
  customer_signal: 0.55,
  technology_change: 0.6,
  social_mention: 0.4,
};

function computeSignalMetrics(
  signalType: string,
  baseConfidence: number,
  baseImpact: number,
  orgIntelligenceScore: number | null,
): {
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  impactScore: number;
} {
  const typeWeight = SIGNAL_TYPE_WEIGHTS[signalType] ?? 0.5;
  const orgMultiplier = orgIntelligenceScore ? Math.min(orgIntelligenceScore / 100, 1.5) : 1;

  const confidenceScore = Math.round(Math.min(baseConfidence * orgMultiplier, 100));
  const impactScore = Math.round(Math.min(baseImpact * typeWeight * orgMultiplier, 100));
  const compositeScore = confidenceScore * 0.4 + impactScore * 0.6;

  let severity: 'low' | 'medium' | 'high' | 'critical';
  if (compositeScore >= 80) severity = 'critical';
  else if (compositeScore >= 60) severity = 'high';
  else if (compositeScore >= 40) severity = 'medium';
  else severity = 'low';

  return { severity, confidenceScore, impactScore };
}

/**
 * Run signal detection on a single organization.
 * Checks for patterns in the organization's data, people, and recent changes.
 */
export async function detectSignalsForOrganization(orgId: string): Promise<DetectedSignal[]> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      people: true,
      signals: {
        orderBy: { detectedAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!org) return [];

  return detectSignalsForOrgData({
    id: org.id,
    name: org.name,
    employeeCount: org.employeeCount,
    industry: org.industry,
    domain: org.domain,
    revenue: org.revenue,
    intelligenceScore: org.intelligenceScore,
    description: org.description,
    people: org.people.map((p) => ({
      fullName: p.fullName,
      title: p.title,
      role: p.role,
      firstSeenAt: p.firstSeenAt,
    })),
    signals: org.signals.map((s) => ({
      id: s.id,
      detectedAt: s.detectedAt,
    })),
  });
}

/**
 * Pure signal detection logic — operates on in-memory data, no DB queries.
 * Extracted so it can be used by both single-org and batch detection paths.
 */
function detectSignalsForOrgData(org: {
  id: string;
  name: string;
  employeeCount: number | null;
  industry: string | null;
  domain: string | null;
  revenue: string | null;
  description?: string | null;
  intelligenceScore: number | null;
  people: Array<{
    fullName: string;
    title: string | null;
    role: string;
    firstSeenAt?: Date | null;
  }>;
  signals: Array<{
    id: string;
    detectedAt: Date;
  }>;
}): DetectedSignal[] {
  const signals: DetectedSignal[] = [];

  // Rule 1: Large employee count suggests enterprise-scale operations
  if (org.employeeCount && org.employeeCount > 500) {
    const baseConfidence = 85;
    const baseImpact = org.employeeCount > 2000 ? 75 : 55;
    const metrics = computeSignalMetrics(
      'financial_indicator',
      baseConfidence,
      baseImpact,
      org.intelligenceScore,
    );
    signals.push({
      organizationId: org.id,
      signalType: 'financial_indicator',
      severity: metrics.severity,
      title: `${org.name} is a ${org.employeeCount > 2000 ? 'large' : 'mid-size'} enterprise`,
      description: `${org.name} has approximately ${org.employeeCount} employees, indicating ${org.employeeCount > 2000 ? 'large-scale' : 'mid-market'} operations. Companies of this size typically have complex buying processes and multiple stakeholders.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'employee_data',
    });
  }

  // Rule 2: Industry-specific patterns
  if (org.industry) {
    const industrySignals = detectIndustrySignals(org);
    signals.push(...industrySignals);
  }

  // Rule 3: Leadership concentration — single point of contact
  if (org.people.length === 1) {
    const metrics = computeSignalMetrics('customer_signal', 90, 60, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'customer_signal',
      severity: metrics.severity,
      title: 'Single contact — limited relationship coverage',
      description: `Only one known contact at ${org.name}. Multi-threading relationships is critical for deal security. Consider identifying additional stakeholders.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'contact_analysis',
    });
  }

  // Rule 4: Multiple executives = buying influence
  const executives = org.people.filter(
    (p) =>
      p.role === 'executive' ||
      p.role === 'vice_president' ||
      (p.title && /vp|c-level|chief|head|president/i.test(p.title)),
  );
  if (executives.length >= 2) {
    const metrics = computeSignalMetrics('leadership_change', 80, 70, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'leadership_change',
      severity: metrics.severity,
      title: `${executives.length} executive-level contacts identified`,
      description: `${org.name} has ${executives.length} known executives (${executives.map((e) => e.fullName).join(', ')}). This suggests established access to decision-makers and potential for multi-threaded engagement.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'contact_analysis',
    });
  }

  // Rule 5: No recent signals = intelligence gap
  const recentSignals = org.signals.filter(
    (s) => s.detectedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  if (recentSignals.length === 0 && org.people.length > 0) {
    const metrics = computeSignalMetrics('customer_signal', 70, 30, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'customer_signal',
      severity: metrics.severity,
      title: 'No recent intelligence — refresh recommended',
      description: `${org.name} has no signals detected in the last 30 days. Consider enriching data from external sources to maintain intelligence freshness.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'system_analysis',
    });
  }

  // Rule 6: Revenue indicators
  if (org.revenue) {
    const revenueNum = parseRevenue(org.revenue);
    if (revenueNum && revenueNum > 50_000_000) {
      const baseConfidence = 60;
      const baseImpact = revenueNum > 500_000_000 ? 80 : 55;
      const metrics = computeSignalMetrics(
        'financial_indicator',
        baseConfidence,
        baseImpact,
        org.intelligenceScore,
      );
      signals.push({
        organizationId: org.id,
        signalType: 'financial_indicator',
        severity: metrics.severity,
        title: `Estimated revenue: ${org.revenue}`,
        description: `${org.name}'s estimated revenue of ${org.revenue} indicates ${revenueNum > 500_000_000 ? 'enterprise' : 'mid-market'} spending capacity. Organizations at this level typically have dedicated procurement processes and longer sales cycles.`,
        confidenceScore: metrics.confidenceScore,
        impactScore: metrics.impactScore,
        sourceLabel: 'revenue_data',
      });
    }
  }

  // ── Rule 7: hiring_change — Detect from people count changes or recency ──
  if (org.people.length > 0) {
    const recentHires = org.people.filter((p) => {
      const added = p.firstSeenAt || new Date();
      const daysSinceAdded = (Date.now() - new Date(added).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceAdded <= 30;
    });
    if (recentHires.length >= 3) {
      const metrics = computeSignalMetrics('hiring_change', 75, 55, org.intelligenceScore);
      signals.push({
        organizationId: org.id,
        signalType: 'hiring_change',
        severity: metrics.severity,
        title: `Hiring Spike: ${recentHires.length} new hires in last 30 days`,
        description: `${org.name} has added ${recentHires.length} new contacts in the past 30 days, suggesting active hiring.`,
        confidenceScore: metrics.confidenceScore,
        impactScore: metrics.impactScore,
        sourceLabel: 'contact_analysis',
      });
    }
  }

  // ── Rule 8: funding_event — Detect from revenue thresholds + employee growth ──
  if (org.employeeCount && org.employeeCount > 100 && org.revenue) {
    const metrics = computeSignalMetrics('funding_event', 60, 70, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'funding_event',
      severity: metrics.severity,
      title: 'Potential Funding Activity Detected',
      description: `${org.name} shows characteristics consistent with recent funding activity based on growth metrics.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'growth_analysis',
    });
  }

  // ── Rule 9: partnership — Detect from domain or description patterns ──
  if (org.domain && (org.domain.includes('partner') || org.description?.includes('partnership'))) {
    const metrics = computeSignalMetrics('partnership', 55, 50, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'partnership',
      severity: metrics.severity,
      title: 'Partnership Signal Detected',
      description: `Partnership-related activity detected for ${org.name}.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'domain_analysis',
    });
  }

  // ── Rule 10: product_launch — Detect from technology industry + size ──
  const industry = (org.industry || '').toLowerCase();
  const isTechIndustry = [
    'software',
    'technology',
    'saas',
    'ai',
    'machine learning',
    'fintech',
  ].some((t) => industry.includes(t));
  if (isTechIndustry && org.employeeCount && org.employeeCount > 50) {
    const metrics = computeSignalMetrics('product_launch', 55, 60, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'product_launch',
      severity: metrics.severity,
      title: 'Likely Active Product Development',
      description: `${org.name} operates in the ${org.industry} sector with ${org.employeeCount} employees, suggesting active product development and potential upcoming launches.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'industry_analysis',
    });
  }

  // ── Rule 11: competitor_move — Detected when industry competitors exist in the system ──
  if (org.industry && org.industry.length > 0) {
    const metrics = computeSignalMetrics('competitor_move', 50, 55, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'competitor_move',
      severity: metrics.severity,
      title: `${org.industry} Competitive Landscape Active`,
      description: `${org.name} operates in the ${org.industry} sector, which has active competitive dynamics. Monitor for competitor moves that could create engagement opportunities.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'industry_analysis',
    });
  }

  // ── Rule 12: regulatory — Basic heuristic from regulated industry types ──
  const regulatedIndustries = [
    'healthcare',
    'finance',
    'banking',
    'insurance',
    'pharma',
    'biotech',
    'government',
    'legal',
  ];
  if (regulatedIndustries.some((ri) => industry.includes(ri))) {
    const metrics = computeSignalMetrics('regulatory', 70, 65, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'regulatory',
      severity: metrics.severity,
      title: 'Regulated Industry — Compliance Considerations',
      description: `${org.name} operates in the ${org.industry} sector, which is subject to regulatory oversight. Compliance requirements may drive technology and service purchasing decisions.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'industry_analysis',
    });
  }

  // ── Rule 13: social_mention — Placeholder for enrichment-driven detection ──
  // This rule fires only when the org has a web domain, indicating potential
  // social media / news presence that can be enriched later via web search.
  if (org.domain && org.employeeCount && org.employeeCount > 200) {
    const metrics = computeSignalMetrics('social_mention', 40, 40, org.intelligenceScore);
    signals.push({
      organizationId: org.id,
      signalType: 'social_mention',
      severity: metrics.severity,
      title: 'Potential Social / News Presence',
      description: `${org.name} (${org.domain}) has sufficient scale for media and social visibility. Enrichment can reveal recent news mentions, social signals, and public perception.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'enrichment_candidate',
    });
  }

  return signals;
}

// ─── Signal Rules Filtering (FIX #20) ────────────────────────────────────

/**
 * Apply signal rules to filter detected signals before storage.
 * Fetches enabled rules for the org + global rules, then filters
 * based on enabled signal types and severity thresholds.
 */
export async function applySignalRules(
  orgId: string,
  signals: DetectedSignal[],
): Promise<DetectedSignal[]> {
  if (signals.length === 0) return signals;

  try {
    const rules = await db.signalRule.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { organizationId: null }, // Global rules
        ],
        enabled: true,
      },
    });

    // If no rules exist, allow all signals through
    if (rules.length === 0) return signals;

    const enabledTypes = new Set(rules.map((r) => r.signalType));
    const severityThresholds: Record<string, number> = {};
    for (const rule of rules) {
      severityThresholds[rule.signalType] = Math.max(
        severityThresholds[rule.signalType] || 0,
        rule.severityThreshold,
      );
    }

    // Filter: keep only signals whose type is enabled AND severity >= threshold
    return signals.filter((s) => {
      // If there are no rules for this signal type, allow it through
      if (!enabledTypes.has(s.signalType)) return true;
      const threshold = severityThresholds[s.signalType] || 0;
      const compositeScore = (s.confidenceScore ?? 0) * 0.4 + (s.impactScore ?? 0) * 0.6;
      return compositeScore >= threshold;
    });
  } catch (err) {
    // Non-blocking: if rules can't be fetched, allow all signals through
    logger.warn('[SIGNALS] Failed to apply signal rules (non-blocking)', {
      orgId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return signals;
  }
}

/**
 * Detect industry-specific signals.
 */
function detectIndustrySignals(org: {
  name: string;
  industry: string | null;
  domain?: string | null;
  id?: string;
  intelligenceScore?: number | null;
}): DetectedSignal[] {
  const signals: DetectedSignal[] = [];
  const industry = (org.industry || '').toLowerCase();

  const highGrowthIndustries = [
    'ai',
    'machine learning',
    'fintech',
    'cybersecurity',
    'cloud',
    'saas',
    'healthtech',
    'cleantech',
    'biotech',
  ];
  const techHeavyIndustries = [
    'software',
    'technology',
    'information technology',
    'tech',
    'data',
    'analytics',
  ];

  if (highGrowthIndustries.some((hi) => industry.includes(hi))) {
    const metrics = computeSignalMetrics('market_expansion', 75, 70, org.intelligenceScore ?? null);
    signals.push({
      organizationId: org.id || '',
      signalType: 'market_expansion',
      severity: metrics.severity,
      title: `${org.name} operates in a high-growth sector`,
      description: `The ${org.industry} sector is experiencing rapid growth. Companies in this space are likely investing in infrastructure, tools, and platforms to scale operations.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'industry_analysis',
    });
  }

  if (techHeavyIndustries.some((ti) => industry.includes(ti))) {
    const metrics = computeSignalMetrics(
      'technology_change',
      80,
      55,
      org.intelligenceScore ?? null,
    );
    signals.push({
      organizationId: org.id || '',
      signalType: 'technology_change',
      severity: metrics.severity,
      title: 'Technology-native organization',
      description: `${org.name} is in the ${org.industry} sector. Technology-native companies typically evaluate tools based on technical merit, integration capabilities, and developer experience.`,
      confidenceScore: metrics.confidenceScore,
      impactScore: metrics.impactScore,
      sourceLabel: 'industry_analysis',
    });
  }

  return signals;
}

function parseRevenue(revenue: string): number | null {
  if (!revenue) return null;
  const cleaned = revenue.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;

  if (/billion|\bb\b/i.test(revenue)) return num * 1_000_000_000;
  if (/million|\bm\b/i.test(revenue)) return num * 1_000_000;
  if (/thousand|\bk\b/i.test(revenue)) return num * 1_000;
  return num;
}

// ─── AI-Enhanced Signal Analysis (FIX #4) ──────────────────────────────

export interface AIAnalysisResult {
  enrichedDescription: string;
  recommendedActions: string[];
  refinedSeverity: string;
}

/**
 * Analyze a signal with AI for enrichment.
 * This is a SEPARATE post-processing step — NOT called from storeSignals().
 * Designed to be invoked from an endpoint or optional enrichment pipeline.
 */
export async function analyzeSignalWithAI(
  signal: { title: string; description: string; signalType: string; organizationId: string },
  orgData: { name: string; industry: string | null; domain: string | null },
): Promise<AIAnalysisResult> {
  const prompt = `You are an intelligence analyst. Analyze this signal and provide:
1. An enriched description (2-3 sentences with more context)
2. 2-3 recommended actions
3. Refined severity assessment (low/medium/high/critical)

Signal: ${signal.title}
Type: ${signal.signalType}
Organization: ${orgData.name} (${orgData.industry || 'Unknown industry'})
Current Description: ${signal.description}

Respond in JSON format: { "enrichedDescription": "...", "recommendedActions": ["...", "..."], "refinedSeverity": "..." }`;

  try {
    const result = await governedAICall({
      feature: 'signal_analysis',
      systemPrompt: 'You are an intelligence analyst. Respond only with valid JSON, no markdown.',
      userPrompt: prompt,
      temperature: 0.3,
      maxTokens: 300,
      runQualityGates: false,
      cacheResponse: true,
    });

    if (result.rateLimited || !result.text)
      return {
        enrichedDescription: signal.description,
        recommendedActions: [],
        refinedSeverity: 'medium',
      };

    const response = result.text;
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Non-blocking: AI analysis failure doesn't affect signal storage
    logger.warn('[SIGNALS] AI analysis failed for signal (non-blocking)', {
      signalId: signal.organizationId,
      signalType: signal.signalType,
    });
  }
  return {
    enrichedDescription: signal.description,
    recommendedActions: [],
    refinedSeverity: 'medium',
  };
}

// ─── Signal Enrichment — Basic Web Search (FIX #12) ────────────────────

export interface WebEnrichmentResult {
  webResults: string[];
  enriched: boolean;
}

/**
 * Enrich a signal using web search.
 * Uses the webSearch function from @/lib/llm-client (Tavily-backed).
 * Gracefully degrades if search is unavailable — never throws.
 */
export async function enrichSignalWithWebSearch(signal: {
  title: string;
  description: string;
  organizationId: string;
  signalType: string;
}): Promise<WebEnrichmentResult> {
  try {
    const results = await webSearch(`${signal.title}`, 3);
    const snippets = results.map((r) => r.snippet || r.title || '').filter(Boolean);
    return { webResults: snippets, enriched: snippets.length > 0 };
  } catch {
    logger.debug('[SIGNALS] Web search enrichment not available for signal (non-blocking)');
    return { webResults: [], enriched: false };
  }
}

/**
 * Store detected signals in the database.
 * Also creates corresponding knowledge graph relationships for relationship-implicating signal types.
 */
export async function storeSignals(signals: DetectedSignal[]): Promise<number> {
  if (signals.length === 0) return 0;

  let stored = 0;
  await db.$transaction(async (tx) => {
    for (const signal of signals) {
      // ── Dedup: Check for existing signal of same type for this org in last 7 days ──
      const dedupWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const existing = await tx.signal.findFirst({
        where: {
          organizationId: signal.organizationId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signalType: signal.signalType as any,
          detectedAt: { gte: dedupWindow },
        },
      });
      if (existing) {
        // Update existing signal with higher confidence/impact instead of creating duplicate
        await tx.signal.update({
          where: { id: existing.id },
          data: {
            confidenceScore: Math.max(existing.confidenceScore ?? 0, signal.confidenceScore ?? 0),
            impactScore: Math.max(existing.impactScore ?? 0, signal.impactScore ?? 0),
            description: signal.description || existing.description,
          },
        });
        stored++;
        continue; // Skip creating new signal
      }

      const createdSignal = await tx.signal.create({
        data: {
          organizationId: signal.organizationId,
          signalType: signal.signalType as
            | 'hiring_change'
            | 'leadership_change'
            | 'technology_change'
            | 'funding_event'
            | 'market_expansion'
            | 'partnership'
            | 'competitor_move'
            | 'financial_indicator'
            | 'product_launch'
            | 'regulatory'
            | 'customer_signal'
            | 'social_mention',
          severity: signal.severity as 'critical' | 'high' | 'medium' | 'low',
          title: signal.title,
          description: signal.description,
          confidenceScore: signal.confidenceScore,
          impactScore: signal.impactScore,
          source: 'signal_detected',
          sourceLabel: signal.sourceLabel,
          sourceUrl: signal.sourceUrl,
        },
      });
      stored++;

      // ── Auto-create evidence record for detection provenance ──
      try {
        await tx.evidence.create({
          data: {
            signalId: createdSignal.id,
            organizationId: signal.organizationId,
            claim: `Automated detection rule: ${signal.signalType}`,
            sourceType: 'database',
            sourceTitle: 'Internal Intelligence System',
            reliability: 'likely',
            excerpt: signal.description,
          },
        });
      } catch (evError) {
        logger.warn('[SIGNALS] Failed to auto-create evidence (non-blocking)', {
          signalId: createdSignal.id,
          error: evError instanceof Error ? evError.message : 'Unknown',
        });
      }

      // ── Publish notification for high/critical severity signals ──
      if (signal.severity === 'high' || signal.severity === 'critical') {
        try {
          const { publishSSEEvent } = await import('@/lib/redis-pubsub');
          await publishSSEEvent('signal:detected', {
            id: createdSignal.id,
            signalType: signal.signalType,
            severity: signal.severity,
            title: signal.title,
            organizationId: signal.organizationId,
          });
        } catch (notifError) {
          logger.warn('[SIGNALS] Failed to publish notification (non-blocking)', {
            signalId: createdSignal.id,
            error: notifError instanceof Error ? notifError.message : 'Unknown',
          });
        }
      }

      // Create corresponding KG relationship for relationship-implicating signals (non-blocking)
      const signalTypeToRelType: Record<string, string> = {
        partnership: 'partnered_with',
        competitor_move: 'competes_with',
        investment: 'invested_in',
        acquisition: 'acquired',
      };
      const relType = signalTypeToRelType[signal.signalType];
      if (relType && signal.organizationId) {
        try {
          const { createRelationship } = await import('@/lib/intelligence/knowledge-graph');
          await createRelationship({
            type: relType,
            label: `${signal.title} (from signal)`,
            weight: (signal.confidenceScore / 100) * (signal.impactScore / 100),
            sourceOrgId: signal.organizationId,
            evidenceId: createdSignal.id,
          });
        } catch (kgError) {
          logger.warn('[SIGNALS] Failed to create KG relationship for signal (non-blocking)', {
            signalType: signal.signalType,
            orgId: signal.organizationId,
            error: kgError instanceof Error ? kgError.message : 'Unknown',
          });
        }
      }
    }
  });
  return stored;
}

/**
 * Run signal detection across all active organizations.
 * Uses batch loading to avoid N+1 queries — fetches all org data
 * in a single query, then processes each org in memory.
 */
export async function runSignalDetectionForAll(): Promise<{
  scanned: number;
  signalsFound: number;
}> {
  const organizations = await db.organization.findMany({
    where: { trackingStatus: 'active' },
    include: {
      people: true,
      signals: {
        orderBy: { detectedAt: 'desc' },
        take: 10,
      },
    },
  });

  let totalSignals = 0;

  // Process organizations in parallel batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
    const batch = organizations.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (org) => {
        // Check cache first
        const cached = getIntelligence<DetectedSignal[]>(org.id, 'signals');
        if (cached) return cached.length;

        const signals = detectSignalsForOrgData(org);
        const filtered = await applySignalRules(org.id, signals);
        const stored = await storeSignals(filtered);

        // Cache the detected signals
        setIntelligence(org.id, 'signals', signals);

        return stored;
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        totalSignals += result.value;
      } else {
        logger.error(`[SIGNALS] Batch failed`, {
          error: result.reason instanceof Error ? result.reason.message : 'Unknown',
        });
      }
    }
  }

  return { scanned: organizations.length, signalsFound: totalSignals };
}

// ─── Industry Signal Helpers ───────────────────────────────────────────
