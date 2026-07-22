import { NextRequest, NextResponse } from 'next/server';

// Phase 8 AI Copilot API Route
import { generateStrategicInsight, getLatestInsight, getInsightHistory, gatherReasoningContext } from '@/lib/ai-copilot/reasoning-engine';
import { generateEngagementStrategy, getLatestStrategy } from '@/lib/ai-copilot/strategy-generator';
import { enhanceBrief, getEnhancedBrief } from '@/lib/ai-copilot/brief-enhancer';
import { getUsageStats } from '@/lib/ai-copilot/usage-tracker';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import type { StrategicInsightOutput } from '@/lib/ai-copilot/types';

// ── Route Registry ──

type RouteHandler = {
  GET?: (req: NextRequest, params: Record<string, string>) => Promise<Response>;
  POST?: (req: NextRequest, params: Record<string, string>) => Promise<Response>;
};

const ROUTES: Record<string, RouteHandler> = {
  'accounts/[id]/reason': { POST: handleGenerateReasoning },
  'accounts/[id]/reasoning': { GET: handleGetReasoning },
  'accounts/[id]/reasoning/history': { GET: handleGetReasoningHistory },
  'accounts/[id]/strategy': { POST: handleGenerateStrategy, GET: handleGetStrategy },
  'accounts/[id]/enhance-brief': { POST: handleEnhanceBrief },
  'accounts/[id]/enhanced-brief': { GET: handleGetEnhancedBrief },
  'usage/stats': { GET: handleGetUsageStats },
  'usage/recent': { GET: handleGetUsageRecent },
};

function matchRoute(slug: string[]): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const [key, handler] of Object.entries(ROUTES)) {
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
    const regex = new RegExp('^' + regexParts.join('/') + '$');
    const match = slug.join('/').match(regex);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1] || ''; });
      return { handler, params };
    }
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  // Authentication check
  const auth = await checkApiAuth();
  if (auth.errorResponse) return auth.errorResponse;
  const matched = matchRoute(slug);
  if (!matched) return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  if (!matched.handler.GET) return NextResponse.json({ error: 'GET not allowed' }, { status: 405 });
  return matched.handler.GET(req, matched.params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  // Authentication check
  const auth = await checkApiAuth();
  if (auth.errorResponse) return auth.errorResponse;
  const matched = matchRoute(slug);
  if (!matched) return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  if (!matched.handler.POST) return NextResponse.json({ error: 'POST not allowed' }, { status: 405 });
  return matched.handler.POST(req, matched.params);
}

// ── Helper: parse insight from DB record to StrategicInsightOutput ──

function dbInsightToOutput(dbRecord: any): StrategicInsightOutput {
  return {
    insightType: (dbRecord.insightType || 'STRATEGIC_SHIFT') as any,
    summary: dbRecord.summary || '',
    keyThemes: safeJsonParse(dbRecord.keyThemes, []),
    reasoningSummary: safeJsonParse(dbRecord.reasoningSummary, { observations: [], interpretation: '', confidenceFactors: [] }),
    supportingEvidence: safeJsonParse(dbRecord.supportingEvidence, []),
    confidenceScore: dbRecord.confidenceScore || 0,
  };
}

function safeJsonParse(str: string | null | undefined, fallback: unknown): any {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Handlers ──

async function handleGenerateReasoning(_req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const result = await generateStrategicInsight(companyId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[g-ai-copilot] generate-reasoning failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetReasoning(_req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const insight = await getLatestInsight(companyId);
    if (!insight) return NextResponse.json({ insight: null, message: 'No strategic insight generated yet' });

    const insightAny = insight as any;
    return NextResponse.json({
      insight: {
        ...insightAny,
        keyThemes: safeJsonParse(insightAny.keyThemes, []),
        reasoningSummary: safeJsonParse(insightAny.reasoningSummary, {}),
        supportingEvidence: safeJsonParse(insightAny.supportingEvidence, []),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetReasoningHistory(req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '10', 10), 50);
    const history = await getInsightHistory(companyId, limit);

    return NextResponse.json({
      insights: history.map(i => ({ id: i.id, insightType: i.insightType, summary: i.summary, confidenceScore: i.confidenceScore, generatedAt: i.generatedAt })),
      total: history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGenerateStrategy(_req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const latestInsight = await getLatestInsight(companyId);
    if (!latestInsight) return NextResponse.json({ error: 'No strategic insight found. Generate reasoning first.' }, { status: 400 });

    const insightOutput = dbInsightToOutput(latestInsight);
    const ctx = await gatherReasoningContext(companyId);

    const result = await generateEngagementStrategy(companyId, insightOutput, ctx);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[g-ai-copilot] generate-strategy failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetStrategy(_req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const strategy = await getLatestStrategy(companyId);
    if (!strategy) return NextResponse.json({ strategy: null, message: 'No engagement strategy generated yet' });

    return NextResponse.json({ strategy });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleEnhanceBrief(_req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const latestInsight = await getLatestInsight(companyId);
    if (!latestInsight) return NextResponse.json({ error: 'No strategic insight found. Generate reasoning first.' }, { status: 400 });

    const ctx = await gatherReasoningContext(companyId);
    const insightOutput = dbInsightToOutput(latestInsight);

    const result = await enhanceBrief(companyId, insightOutput, ctx);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[g-ai-copilot] enhance-brief failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetEnhancedBrief(_req: NextRequest, params: Record<string, string>) {
  try {
    const companyId = params.id;
    if (!companyId) return NextResponse.json({ error: 'Company ID required' }, { status: 400 });

    const brief = await getEnhancedBrief(companyId);
    if (!brief) return NextResponse.json({ brief: null, message: 'No brief found for this company' });

    return NextResponse.json({
      brief: {
        ...brief,
        themes: safeJsonParse(brief.themes as string | null, []),
        risks: safeJsonParse(brief.risks as string | null, []),
        recommendations: safeJsonParse(brief.recommendations as string | null, []),
        aiKeyTakeaways: safeJsonParse(brief.aiKeyTakeaways as string | null, []),
        aiStrategicImplications: safeJsonParse(brief.aiStrategicImplications as string | null, []),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetUsageStats(req: NextRequest, _params: Record<string, string>) {
  try {
    const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') || '30', 10), 365);
    const stats = await getUsageStats(days);
    return NextResponse.json({ stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetUsageRecent(req: NextRequest, _params: Record<string, string>) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 100);
    const recentLogs = await db.aIUsageLog.findMany({
      orderBy: { generatedAt: 'desc' },
      take: limit,
      select: {
        id: true, companyId: true, feature: true, model: true,
        promptTokens: true, completionTokens: true, totalTokens: true,
        estimatedCost: true, status: true, generatedAt: true,
      },
    });
    return NextResponse.json({ logs: recentLogs, total: recentLogs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
