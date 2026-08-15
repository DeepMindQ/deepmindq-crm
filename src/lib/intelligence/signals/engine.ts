// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Signal Engine — Rule-based signal detection
//
// Detects business signals from organization data and changes.
// Rules first, AI reasoning later. The signal engine is the "eyes" of DeepMindQ.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getIntelligence, setIntelligence } from '@/lib/intelligence-cache';

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
    people: org.people.map((p) => ({
      fullName: p.fullName,
      title: p.title,
      role: p.role,
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
  people: Array<{
    fullName: string;
    title: string | null;
    role: string;
  }>;
  signals: Array<{
    id: string;
    detectedAt: Date;
  }>;
}): DetectedSignal[] {
  const signals: DetectedSignal[] = [];

  // Rule 1: Large employee count suggests enterprise-scale operations
  if (org.employeeCount && org.employeeCount > 500) {
    signals.push({
      organizationId: org.id,
      signalType: 'financial_indicator',
      severity: org.employeeCount > 2000 ? 'high' : 'medium',
      title: `${org.name} is a ${org.employeeCount > 2000 ? 'large' : 'mid-size'} enterprise`,
      description: `${org.name} has approximately ${org.employeeCount} employees, indicating ${org.employeeCount > 2000 ? 'large-scale' : 'mid-market'} operations. Companies of this size typically have complex buying processes and multiple stakeholders.`,
      confidenceScore: 85,
      impactScore: org.employeeCount > 2000 ? 75 : 55,
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
    signals.push({
      organizationId: org.id,
      signalType: 'customer_signal',
      severity: 'medium',
      title: 'Single contact — limited relationship coverage',
      description: `Only one known contact at ${org.name}. Multi-threading relationships is critical for deal security. Consider identifying additional stakeholders.`,
      confidenceScore: 90,
      impactScore: 60,
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
    signals.push({
      organizationId: org.id,
      signalType: 'leadership_change',
      severity: 'medium',
      title: `${executives.length} executive-level contacts identified`,
      description: `${org.name} has ${executives.length} known executives (${executives.map((e) => e.fullName).join(', ')}). This suggests established access to decision-makers and potential for multi-threaded engagement.`,
      confidenceScore: 80,
      impactScore: 70,
      sourceLabel: 'contact_analysis',
    });
  }

  // Rule 5: No recent signals = intelligence gap
  const recentSignals = org.signals.filter(
    (s) => s.detectedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  if (recentSignals.length === 0 && org.people.length > 0) {
    signals.push({
      organizationId: org.id,
      signalType: 'customer_signal',
      severity: 'low',
      title: 'No recent intelligence — refresh recommended',
      description: `${org.name} has no signals detected in the last 30 days. Consider enriching data from external sources to maintain intelligence freshness.`,
      confidenceScore: 70,
      impactScore: 30,
      sourceLabel: 'system_analysis',
    });
  }

  // Rule 6: Revenue indicators
  if (org.revenue) {
    const revenueNum = parseRevenue(org.revenue);
    if (revenueNum && revenueNum > 50_000_000) {
      signals.push({
        organizationId: org.id,
        signalType: 'financial_indicator',
        severity: revenueNum > 500_000_000 ? 'high' : 'medium',
        title: `Estimated revenue: ${org.revenue}`,
        description: `${org.name}'s estimated revenue of ${org.revenue} indicates ${revenueNum > 500_000_000 ? 'enterprise' : 'mid-market'} spending capacity. Organizations at this level typically have dedicated procurement processes and longer sales cycles.`,
        confidenceScore: 60,
        impactScore: revenueNum > 500_000_000 ? 80 : 55,
        sourceLabel: 'revenue_data',
      });
    }
  }

  return signals;
}

/**
 * Detect industry-specific signals.
 */
function detectIndustrySignals(org: {
  name: string;
  industry: string | null;
  domain?: string | null;
  id?: string;
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
    signals.push({
      organizationId: org.id || '',
      signalType: 'market_expansion',
      severity: 'high',
      title: `${org.name} operates in a high-growth sector`,
      description: `The ${org.industry} sector is experiencing rapid growth. Companies in this space are likely investing in infrastructure, tools, and platforms to scale operations.`,
      confidenceScore: 75,
      impactScore: 70,
      sourceLabel: 'industry_analysis',
    });
  }

  if (techHeavyIndustries.some((ti) => industry.includes(ti))) {
    signals.push({
      organizationId: org.id || '',
      signalType: 'technology_change',
      severity: 'medium',
      title: 'Technology-native organization',
      description: `${org.name} is in the ${org.industry} sector. Technology-native companies typically evaluate tools based on technical merit, integration capabilities, and developer experience.`,
      confidenceScore: 80,
      impactScore: 55,
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

/**
 * Store detected signals in the database.
 */
export async function storeSignals(signals: DetectedSignal[]): Promise<number> {
  if (signals.length === 0) return 0;

  let stored = 0;
  await db.$transaction(async (tx) => {
    for (const signal of signals) {
      await tx.signal.create({
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
        const stored = await storeSignals(signals);

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
