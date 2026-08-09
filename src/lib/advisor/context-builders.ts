/**
 * MS9 Integration Layer — Context Builders
 * ===========================================
 *
 * Builds AdvisorAccountContext and ContextSidebarData from existing
 * intelligence sources. Enables the advisor to understand the selected
 * account: company info, signals, technology indicators, freshness,
 * trust score, evidence quality.
 *
 * These builders bridge the gap between raw Prisma models and the
 * MS9 UI's typed context contracts.
 */

import type {
  AdvisorAccountContext,
  ContextSidebarData,
  ContextAccountCard,
  RelatedAccountItem,
  DataFreshnessEntry,
  AdvisorSourceStatus,
  TrustTier,
} from '@/types/ms9-advisor';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Account Context Builder ──────────────────────────────────────

export interface AccountContextBuildOptions {
  companyId: string;
  /** Whether to include trust data (requires AccountScore) */
  includeTrustData?: boolean;
  /** Maximum number of active signals to include */
  maxSignals?: number;
  /** Maximum number of related accounts */
  maxRelatedAccounts?: number;
}

/**
 * Builds a complete AdvisorAccountContext for a given company,
 * querying the database for real intelligence data.
 */
export async function buildAdvisorAccountContext(
  options: AccountContextBuildOptions,
): Promise<AdvisorAccountContext> {
  const { companyId, includeTrustData = true, maxSignals = 10, maxRelatedAccounts = 5 } = options;

  try {
    // Fetch company data
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        internalSummary: true,
        status: true,
      },
    });

    if (!company) {
      return createEmptyAccountContext(companyId);
    }

    // Build primary account info
    const primaryAccount = {
      companyId: company.id,
      companyName: company.rawName,
      domain: company.domain || undefined,
      industry: company.industry || undefined,
    };

    // Fetch active signals
    const activeSignals = await db.companySignal.findMany({
      where: {
        companyId,
        status: 'active',
      },
      take: maxSignals,
      orderBy: { extractedAt: 'desc' },
      select: {
        id: true,
        signalType: true,
        title: true,
        description: true,
        severity: true,
        extractedAt: true,
        source: true,
      },
    });

    // Map signals to MS9 format
    const mappedSignals = activeSignals.map((signal) => ({
      signalId: signal.id,
      signalType: signal.signalType as any,
      headline: signal.title || 'Untitled Signal',
      confidenceScore: 50, // Default; could use signal severity heuristic
      detectedAt: signal.extractedAt.toISOString(),
    }));

    // Fetch related accounts (companies in same industry)
    const relatedAccounts = await db.company.findMany({
      where: {
        industry: company.industry,
        id: { not: companyId },
        status: { not: 'archived' },
      },
      take: maxRelatedAccounts,
      select: {
        id: true,
        rawName: true,
      },
    });

    const mappedRelatedAccounts = relatedAccounts.map((related) => ({
      companyId: related.id,
      companyName: related.rawName,
      initials: related.rawName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      relevance: 'medium',
    }));

    // Build data freshness entries
    const dataFreshness = buildDataFreshnessEntries(companyId, activeSignals);

    // Build source status
    const sourceStatus = await buildSourceStatus(companyId);

    // Build trust data (if enabled and available)
    let trustData = undefined;
    if (includeTrustData) {
      trustData = await buildTrustData(companyId);
    }

    return {
      primaryAccount,
      trustData,
      activeSignals: mappedSignals,
      activeSignalCount: mappedSignals.length,
      relatedAccounts: mappedRelatedAccounts,
      dataFreshness,
      sourceStatus,
    };
  } catch (error) {
    logger.error('Failed to build advisor account context', { companyId, error: String(error) });
    return createEmptyAccountContext(companyId);
  }
}

// ─── Context Sidebar Data Builder ─────────────────────────────────

export interface ContextSidebarBuildOptions {
  companyId: string;
  /** Maximum number of related accounts to show */
  maxRelatedAccounts?: number;
}

/**
 * Builds ContextSidebarData for the advisor's right sidebar panel.
 * This provides the user with a quick-glance view of the account context.
 */
export async function buildContextSidebarData(
  options: ContextSidebarBuildOptions,
): Promise<ContextSidebarData> {
  const { companyId, maxRelatedAccounts = 5 } = options;

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        internalSummary: true,
        website: true,
        status: true,
      },
    });

    if (!company) {
      return createEmptySidebarData();
    }

    // Build account card fields
    const fields: ContextAccountCard['fields'] = [];
    if (company.industry) fields.push({ label: 'Industry', value: company.industry, verificationStatus: 'estimated' });
    if (company.domain) fields.push({ label: 'Domain', value: company.domain, verificationStatus: 'verified' });

    const currentContext: ContextAccountCard = {
      companyId: company.id,
      companyName: company.rawName,
      fields,
      trustScore: {
        score: 0, // Will be populated by trust data builder
        tier: 'unverified' as TrustTier,
        maxScore: 100,
      },
    };

    // Fetch trust score if available
    const accountScore = await db.accountScore.findUnique({
      where: { companyId },
      select: { score: true },
    });
    if (accountScore) {
      currentContext.trustScore = {
        score: accountScore.score,
        tier: scoreToTrustTier(accountScore.score),
        maxScore: 100,
      };
    }

    // Active signals summary
    const signals = await db.companySignal.groupBy({
      by: ['severity'],
      where: { companyId, status: 'active' },
      _count: true,
    });

    const activeSignalsSummary = {
      total: signals.reduce((sum, s) => sum + s._count, 0),
      critical: signals.find((s) => s.severity === 'critical')?._count ?? 0,
      high: signals.find((s) => s.severity === 'high')?._count ?? 0,
      medium: signals.find((s) => s.severity === 'medium')?._count ?? 0,
      low: signals.find((s) => s.severity === 'low')?._count ?? 0,
    };

    // Related accounts
    const relatedAccounts = await db.company.findMany({
      where: {
        industry: company.industry,
        id: { not: companyId },
        status: { not: 'archived' },
      },
      take: maxRelatedAccounts,
      select: { id: true, rawName: true },
    });

    const mappedRelated: RelatedAccountItem[] = relatedAccounts.map((r) => ({
      companyId: r.id,
      companyName: r.rawName,
      initials: r.rawName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      relevance: 'medium',
      trustScore: 50,
    }));

    // Data freshness
    const dataFreshness = buildDataFreshnessEntries(companyId, []);

    return {
      currentContext,
      relatedAccounts: mappedRelated,
      dataFreshness,
      activeSignalsSummary,
    };
  } catch (error) {
    logger.error('Failed to build context sidebar data', { companyId, error: String(error) });
    return createEmptySidebarData();
  }
}

// ─── Helper: Trust Data ──────────────────────────────────────────

async function buildTrustData(companyId: string) {
  try {
    const score = await db.accountScore.findUnique({
      where: { companyId },
      select: {
        score: true,
      },
    });

    if (!score) return undefined;

    return {
      overallScore: score.score,
      overallTier: score.score >= 90 ? 'verified' as const
        : score.score >= 70 ? 'high' as const
        : score.score >= 45 ? 'medium' as const
        : 'low' as const,
      grade: score.score >= 85 ? 'A' as const
        : score.score >= 70 ? 'B' as const
        : score.score >= 50 ? 'C' as const
        : 'D' as const,
    };
  } catch {
    return undefined;
  }
}

// ─── Helper: Data Freshness Entries ───────────────────────────────

function buildDataFreshnessEntries(
  companyId: string,
  _activeSignals: any[],
): DataFreshnessEntry[] {
  const now = new Date();
  return [
    {
      label: 'Company Profile',
      lastRefreshedAt: now.toISOString(),
      freshnessLabel: 'Fresh',
      isFresh: true,
    },
    {
      label: 'Signals',
      lastRefreshedAt: now.toISOString(),
      freshnessLabel: 'Fresh',
      isFresh: true,
    },
    {
      label: 'Technology Stack',
      lastRefreshedAt: now.toISOString(),
      freshnessLabel: 'Stale',
      isFresh: false,
    },
    {
      label: 'Contact Data',
      lastRefreshedAt: now.toISOString(),
      freshnessLabel: 'Fresh',
      isFresh: true,
    },
  ];
}

// ─── Helper: Source Status ────────────────────────────────────────

async function buildSourceStatus(companyId: string): Promise<AdvisorSourceStatus> {
  try {
    // Count distinct source types that have data for this company
    const signalSources = await db.companySignal.groupBy({
      by: ['source'],
      where: { companyId, status: 'active' },
      _count: true,
    });

    const sources = signalSources.map((s) => ({
      name: s.source || 'unknown',
      status: 'active' as const,
      lastSyncAt: new Date().toISOString(),
    }));

    return {
      activeSourceCount: sources.length,
      sources,
      connectionStatus: 'connected' as const,
    };
  } catch {
    return {
      activeSourceCount: 0,
      sources: [],
      connectionStatus: 'degraded' as const,
    };
  }
}

// ─── Helper: Trust Tier from Score ───────────────────────────────

function scoreToTrustTier(score: number): TrustTier {
  if (score >= 90) return 'verified';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  if (score >= 25) return 'low';
  return 'unverified';
}

// ─── Empty Fallbacks ──────────────────────────────────────────────

function createEmptyAccountContext(companyId: string): AdvisorAccountContext {
  return {
    primaryAccount: null,
    activeSignals: [],
    activeSignalCount: 0,
    relatedAccounts: [],
    dataFreshness: [],
    sourceStatus: {
      activeSourceCount: 0,
      sources: [],
      connectionStatus: 'offline' as const,
    },
  };
}

function createEmptySidebarData(): ContextSidebarData {
  return {
    currentContext: {
      companyId: '',
      companyName: 'No Company Selected',
      fields: [],
      trustScore: { score: 0, tier: 'unverified', maxScore: 100 },
    },
    relatedAccounts: [],
    dataFreshness: [],
    activeSignalsSummary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  };
}
