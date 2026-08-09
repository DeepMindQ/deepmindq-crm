/**
 * Data Completeness Scoring API (Session 8 — Component 4.1)
 *
 * Routes:
 *   POST /api/scoring/completeness/company   — Score a single company by ID
 *   POST /api/scoring/completeness/batch      — Score multiple companies (portfolio)
 *   GET  /api/scoring/completeness/dashboard  — Portfolio-wide completeness stats
 *   GET  /api/scoring/completeness/priorities — Enrichment priority list
 */

import { db } from '@/lib/db';
import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  DataCompletenessEngine,
  type CompletenessResult,
  type PortfolioCompletenessReport,
  type EnrichmentPriority,
  type DataGap,
} from '@/lib/scoring/data-completeness-engine';

// ═══════════════════════════════════════════════════════════════════════════
// Validation schemas
// ═══════════════════════════════════════════════════════════════════════════

const CompanyBodySchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
});

const BatchBodySchema = z.object({
  companyIds: z.array(z.string().min(1)).min(1, 'At least one companyId is required').max(500, 'Maximum 500 companies per batch'),
});

// ═══════════════════════════════════════════════════════════════════════════
// Prisma includes for company completeness data
// ═══════════════════════════════════════════════════════════════════════════

const COMPANY_INCLUDE = {
  researchCard: {
    select: {
      revenue: true,
      employeeCount: true,
      fundingStage: true,
      techStack: true,
      businessOverview: true,
    },
  },
  contacts: {
    select: { id: true },
  },
  signals: {
    select: { id: true, status: true },
  },
} as const;

const NOT_ARCHIVED = { not: 'archived' } as const;

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Fetch a single company with all relations needed for scoring. */
async function fetchCompanyForScoring(companyId: string) {
  return db.company.findUnique({
    where: { id: companyId },
    include: COMPANY_INCLUDE,
  });
}

/** Fetch multiple companies with all relations needed for scoring. */
async function fetchCompaniesForScoring(companyIds?: string[]) {
  return db.company.findMany({
    where: {
      status: NOT_ARCHIVED,
      ...(companyIds && companyIds.length > 0 ? { id: { in: companyIds } } : {}),
    },
    include: COMPANY_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Route Handlers
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(request.url);
    const action = url.pathname.replace(/\/api\/scoring\/completeness\/?$/, '');

    // Route: /api/scoring/completeness/company
    if (action === '/company' || url.pathname.endsWith('/company')) {
      return handleScoreCompany(request);
    }

    // Route: /api/scoring/completeness/batch
    if (action === '/batch' || url.pathname.endsWith('/batch')) {
      return handleScoreBatch(request);
    }

    return apiError('Unknown action. Use /company or /batch.', 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error('Completeness scoring POST error', { error: message });
    return apiError(message, 500);
  }
}

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(request.url);

    // Route: /api/scoring/completeness/dashboard
    if (url.pathname.endsWith('/dashboard')) {
      return handleDashboard();
    }

    // Route: /api/scoring/completeness/priorities
    if (url.pathname.endsWith('/priorities')) {
      return handlePriorities(request);
    }

    return apiError('Unknown action. Use /dashboard or /priorities.', 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error('Completeness scoring GET error', { error: message });
    return apiError(message, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Action Handlers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/scoring/completeness/company
 * Body: { companyId: string }
 * Returns: CompletenessResult + gaps for a single company.
 */
async function handleScoreCompany(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateBody(CompanyBodySchema, body);
  if (parsed instanceof Response) return parsed;

  const company = await fetchCompanyForScoring(parsed.companyId);
  if (!company) {
    return apiError('Company not found', 404);
  }

  const result: CompletenessResult = DataCompletenessEngine.scoreCompany(company);
  const gaps: DataGap[] = DataCompletenessEngine.identifyGaps(company);

  logger.info('Scored company completeness', {
    companyId: company.id,
    score: result.overallScore,
    grade: result.grade,
    gapCount: gaps.length,
  });

  return apiSuccess({
    company: {
      id: company.id,
      name: company.normalizedName || company.rawName,
    },
    completeness: result,
    gaps,
  });
}

/**
 * POST /api/scoring/completeness/batch
 * Body: { companyIds: string[] }
 * Returns: PortfolioCompletenessReport for the specified companies.
 */
async function handleScoreBatch(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateBody(BatchBodySchema, body);
  if (parsed instanceof Response) return parsed;

  const companies = await fetchCompaniesForScoring(parsed.companyIds);
  if (companies.length === 0) {
    return apiError('No companies found for the provided IDs', 404);
  }

  const report: PortfolioCompletenessReport = DataCompletenessEngine.scorePortfolio(companies);

  logger.info('Scored batch completeness', {
    requestedCount: parsed.companyIds.length,
    foundCount: companies.length,
    avgScore: report.averageScore,
  });

  return apiSuccess(report);
}

/**
 * GET /api/scoring/completeness/dashboard
 * Query: ?limit=1000 (default: all non-archived companies)
 * Returns: Portfolio-wide completeness stats (avg score, grade distribution, top gaps).
 */
async function handleDashboard() {
  const companies = await fetchCompaniesForScoring();

  const report = DataCompletenessEngine.scorePortfolio(companies);

  // Compute top gaps across the entire portfolio
  const gapCounts: Record<string, { count: number; importance: string }> = {};
  for (const company of companies) {
    const gaps = DataCompletenessEngine.identifyGaps(company);
    for (const gap of gaps) {
      if (!gapCounts[gap.field]) {
        gapCounts[gap.field] = { count: 0, importance: gap.importance };
      }
      gapCounts[gap.field].count++;
    }
  }

  // Sort by frequency descending, take top 10
  const topGaps = Object.entries(gapCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([field, data]) => ({
      field,
      missingCount: data.count,
      importance: data.importance,
      percentage: companies.length > 0
        ? Math.round((data.count / companies.length) * 100)
        : 0,
    }));

  logger.info('Generated completeness dashboard', {
    totalCompanies: companies.length,
    avgScore: report.averageScore,
  });

  return apiSuccess({
    summary: {
      totalCompanies: report.totalCompanies,
      averageScore: report.averageScore,
      medianScore: report.medianScore,
    },
    gradeDistribution: report.gradeDistribution,
    dimensionAverages: report.dimensionAverages,
    topGaps,
    generatedAt: report.generatedAt,
  });
}

/**
 * GET /api/scoring/completeness/priorities
 * Query: ?limit=50 (default: 50, max: 200)
 * Returns: Enrichment priority list sorted by opportunity score.
 */
async function handlePriorities(request: Request) {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(rawLimit, 1), 200);

  const companies = await fetchCompaniesForScoring();

  const allPriorities: EnrichmentPriority[] = DataCompletenessEngine.getEnrichmentPriority(companies);
  const priorities = allPriorities.slice(0, limit);

  // Quick summary stats
  const scoreStats = {
    total: companies.length,
    avgCompleteness: companies.length > 0
      ? Math.round(priorities.reduce((s, p) => s + p.completenessScore, 0) / priorities.length)
      : 0,
    avgOpportunity: companies.length > 0
      ? Math.round(priorities.reduce((s, p) => s + p.opportunityScore, 0) / priorities.length)
      : 0,
  };

  logger.info('Generated enrichment priorities', {
    totalCompanies: companies.length,
    returnedLimit: limit,
  });

  return apiSuccess({
    priorities,
    stats: scoreStats,
  });
}
