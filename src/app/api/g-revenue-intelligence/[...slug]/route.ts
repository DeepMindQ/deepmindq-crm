/**
 * Phase 7.6: Revenue Intelligence API
 *
 * /api/g-revenue-intelligence/[...slug]
 *
 * Endpoints:
 * - GET  accounts/[id]/brief
 * - POST accounts/[id]/generate-brief
 * - GET  accounts/[id]/signals
 * - POST accounts/[id]/detect-signals
 * - GET  accounts/[id]/recommendations
 * - GET  accounts/[id]/score
 * - POST accounts/[id]/recalculate-score
 * - GET  opportunities
 * - GET  dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateBrief,
  getBrief,
  getOrCreateBrief,
  detectAndPersistSignals,
  getSignalsForCompany,
  getCompanySignalSummary,
  generateRecommendations,
  persistAccountScore,
  getAccountScore,
  getTopOpportunities,
  recalculateAllScores,
  getOpportunityRadar,
  getRadarStats,
} from '@/lib/revenue-intelligence';

// ─── Route helpers ──────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RouteMatch {
  handler: (method: HttpMethod, req: NextRequest, params: Record<string, string>) => Promise<Response>;
  params: Record<string, string>;
}

function keyToRegex(key: string): { regex: RegExp; paramNames: string[] } {
  const parts = key.split('/');
  const regexParts: string[] = [];
  const paramNames: string[] = [];
  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      paramNames.push(part.slice(1, -1));
      regexParts.push('([^/]+)');
    } else {
      regexParts.push(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  return { regex: new RegExp('^' + regexParts.join('/') + '$'), paramNames };
}

function matchRoute(slug: string[]): RouteMatch | null {
  const path = slug.join('/');
  for (const route of ROUTES) {
    const { regex, paramNames } = keyToRegex(route.key);
    const match = path.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1] || ''; });
      return { handler: route.handler, params };
    }
  }
  return null;
}

// ─── Route registry ──────────────────────────────────────────

const ROUTES: Array<{ key: string; handler: (method: HttpMethod, req: NextRequest, params: Record<string, string>) => Promise<Response> }> = [
  // Account Brief
  { key: 'accounts/[id]/brief', handler: handleAccountBrief },
  { key: 'accounts/[id]/generate-brief', handler: handleGenerateBrief },
  // Signals
  { key: 'accounts/[id]/signals', handler: handleAccountSignals },
  { key: 'accounts/[id]/detect-signals', handler: handleDetectSignals },
  // Recommendations
  { key: 'accounts/[id]/recommendations', handler: handleRecommendations },
  // Score
  { key: 'accounts/[id]/score', handler: handleAccountScore },
  { key: 'accounts/[id]/recalculate-score', handler: handleRecalculateScore },
  // Radar + Dashboard
  { key: 'opportunities', handler: handleOpportunities },
  { key: 'dashboard', handler: handleDashboard },
];

// ═══════════════════════════════════════════════════════════════
//  ACCOUNT BRIEF
// ═══════════════════════════════════════════════════════════════

async function handleAccountBrief(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const brief = await getBrief(params.id);
    if (!brief) return NextResponse.json({ error: 'Brief not found. Generate one first.' }, { status: 404 });
    return NextResponse.json({ brief });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get brief', detail: msg }, { status: 500 });
  }
}

async function handleGenerateBrief(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const brief = await generateBrief(params.id, body.generatedBy);
    return NextResponse.json({ brief });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to generate brief', detail: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  SIGNALS
// ═══════════════════════════════════════════════════════════════

async function handleAccountSignals(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const signals = await getSignalsForCompany(params.id, {
      signalType: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      minScore: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined,
    });
    const summary = await getCompanySignalSummary(params.id);
    return NextResponse.json({ signals, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get signals', detail: msg }, { status: 500 });
  }
}

async function handleDetectSignals(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const result = await detectAndPersistSignals(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to detect signals', detail: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

async function handleRecommendations(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const result = await generateRecommendations(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get recommendations', detail: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  ACCOUNT SCORE
// ═══════════════════════════════════════════════════════════════

async function handleAccountScore(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const score = await getAccountScore(params.id);
    if (!score) return NextResponse.json({ error: 'Score not found. Recalculate first.' }, { status: 404 });
    return NextResponse.json({ score });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get score', detail: msg }, { status: 500 });
  }
}

async function handleRecalculateScore(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const score = await persistAccountScore(params.id);
    return NextResponse.json({ score });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to recalculate score', detail: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  OPPORTUNITIES + DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function handleOpportunities(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const radar = await getOpportunityRadar({
      minScore: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined,
      signalTypes: searchParams.get('signalTypes')?.split(','),
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    });
    return NextResponse.json(radar);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get opportunities', detail: msg }, { status: 500 });
  }
}

async function handleDashboard(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const [stats, opportunities] = await Promise.all([getRadarStats(), getOpportunityRadar({ limit: 10 })]);
    const totalCompanies = await db.company.count();
    const accountsWithIntelligence = await db.intelligenceObject.groupBy({ by: ['companyId'], _count: true });

    return NextResponse.json({
      pipelineIntelligence: {
        accountsMonitored: accountsWithIntelligence.length,
        totalCompanies,
        highOpportunityAccounts: stats.byStatus?.['NEW'] ?? 0,
        newSignalsThisWeek: stats.newLast7Days,
        totalActiveSignals: stats.totalSignals,
      },
      topOpportunities: opportunities.accounts.slice(0, 10).map(a => ({
        companyId: a.companyId,
        companyName: a.companyName,
        score: a.score,
        signalStrength: a.signalStrength,
        topSignal: a.topSignals[0]?.title || null,
        possibleOpportunity: a.possibleOpportunity,
      })),
      signalBreakdown: {
        byType: stats.byType,
        byStatus: stats.byStatus,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get dashboard', detail: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  DISPATCHERS
// ═══════════════════════════════════════════════════════════════

async function dispatch(method: HttpMethod, req: NextRequest, slug: string[]): Promise<Response> {
  const matched = matchRoute(slug);
  if (!matched) return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  try {
    return await matched.handler(method, req, matched.params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[router:g-revenue-intelligence] ${method} /${slug.join('/')}:`, msg);
    return NextResponse.json({ error: 'Internal error', detail: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return dispatch('GET', req, slug);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return dispatch('POST', req, slug);
}