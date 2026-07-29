// @ts-nocheck — References Prisma models/enums not in current schema. Remove after DB migration.
/**
 * POST /api/intelligence/full-pipeline
 * GET  /api/intelligence/full-pipeline?companyId=xxx
 *
 * The 20-Stage Intelligence Orchestrator — DeepMindQ's core pipeline.
 *
 * Combines External Intelligence (prospects) + Internal Intelligence (our capabilities)
 * through the AI Matching Engine to produce a complete Account Strategy.
 *
 * STAGES:
 *   Phase A — External: import → email → company match → contact match →
 *             contact intel → buying committee → prospect intel → signals →
 *             evidence → research card → rev score → account brief
 *   Phase B — Internal: capability matching → case study matching →
 *             solution matching → competitive positioning
 *   Phase C — Strategy: recommended actions → conversation strategy →
 *             executive brief → morning brief
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ModelRouter } from '@/lib/engines/model-router';
import { CapabilityIntelligenceEngine } from '@/lib/capability-intelligence-engine';
import { FusionEngine } from '@/lib/fusion-engine';
import { createInsight } from '@/lib/ai-insight-service';

// ── Types ──

interface StageResult {
  name: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  result: Record<string, unknown> | null;
  error?: string;
}

interface PipelineRun {
  id: string;
  companyId: string;
  totalStages: number;
  completedStages: number;
  failedStages: number;
  skippedStages: number;
  durationMs: number;
  stages: StageResult[];
}

// ── Helper: run a single stage with timing + error capture ──

async function runStage(
  name: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<StageResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return { name, status: 'completed', durationMs: Date.now() - started, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, status: 'failed', durationMs: Date.now() - started, result: null, error: msg };
  }
}

// ── Helper: safe AI call ──

async function aiCall(
  systemPrompt: string,
  userPrompt: string,
  tier: 'deep' | 'smart' | 'fast' = 'smart',
  companyId?: string,
): Promise<string> {
  const result = await ModelRouter.complete({
    systemPrompt,
    userPrompt,
    tier,
    genType: 'full_pipeline',
    companyId,
  });
  if (!result.success) throw new Error(result.error || 'AI call failed');
  return result.text;
}

// ═══════════════════════════════════════════════════════════════════════
// GET — Return latest pipeline status / cached results for a company
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ error: 'companyId query parameter required' }, { status: 400 });
  }

  try {
    // Load company
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        researchCard: true,
        signals: { where: { status: { in: ['active', 'validated', 'aging'] } }, take: 20, orderBy: { createdAt: 'desc' } },
        evidence: { take: 10, orderBy: { createdAt: 'desc' } },
        strategicInsights: { take: 5, orderBy: { generatedAt: 'desc' } },
        engagementStrategies: { take: 3, orderBy: { generatedAt: 'desc' } },
        opportunityRecommendations: { take: 10, orderBy: { opportunityScore: 'desc' } },
        signalCapabilityMatches: { take: 20, orderBy: { matchScore: 'desc' } },
        accountBrief: true,
        accountScore: true,
        intelligenceHealth: true,
        fusionResults: { take: 10, orderBy: { fusionScore: 'desc' } },
        pipelineRuns: { take: 5, orderBy: { startedAt: 'desc' } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Load internal capability stats
    const capabilityStats = await CapabilityIntelligenceEngine.getGraphStatus();

    // Build summary
    const summary = {
      companyId: company.id,
      companyName: company.rawName,
      externalIntelligence: {
        signalsCount: company.signals.length,
        evidenceCount: company.evidence.length,
        hasResearchCard: !!company.researchCard,
        insightsCount: company.strategicInsights.length,
        engagementStrategiesCount: company.engagementStrategies.length,
        opportunitiesCount: company.opportunityRecommendations.length,
        hasAccountBrief: !!company.accountBrief,
        hasAccountScore: !!company.accountScore,
        intelligenceScore: company.intelligenceScore,
        healthScore: company.intelligenceHealth?.overallHealthScore ?? 0,
      },
      internalMatching: {
        capabilityMatchesCount: company.signalCapabilityMatches.length,
        highConfidenceMatches: company.signalCapabilityMatches.filter(m => m.matchScore >= 0.6).length,
        topMatches: company.signalCapabilityMatches.slice(0, 5).map(m => ({
          capabilityId: m.capabilityId,
          matchScore: m.matchScore,
          reason: m.reason,
          businessProblem: m.businessProblem,
        })),
      },
      internalKnowledge: capabilityStats,
      intelligenceFusion: {
        fusionResultsCount: company.fusionResults?.length || 0,
        topFusions: (company.fusionResults || []).slice(0, 3).map((f) => ({
          fusionType: f.fusionType ?? '',
          fusionScore: f.fusionScore ?? 0,
          recommendedCapability: f.recommendedCapability ?? '',
          businessProblem: f.businessProblem ?? '',
          confidenceScore: f.confidenceScore ?? 0,
        })),
      },
      pipelineHistory: {
        totalRuns: company.pipelineRuns?.length || 0,
        lastRun: company.pipelineRuns?.[0] ? {
          status: company.pipelineRuns[0].status ?? '',
          completedStages: company.pipelineRuns[0].completedStages ?? '',
          durationMs: company.pipelineRuns[0].durationMs ?? 0,
          aiCallsMade: company.pipelineRuns[0].aiCallsMade ?? 0,
        } : null,
      },
      topOpportunities: company.opportunityRecommendations.slice(0, 3).map(o => ({
        id: o.id,
        title: o.opportunityTitle,
        score: o.opportunityScore,
        priority: o.priority,
        status: o.status,
      })),
      latestInsights: company.strategicInsights.slice(0, 2).map(s => ({
        id: s.id,
        type: s.insightType,
        summary: s.summary,
        confidenceScore: s.confidenceScore,
      })),
    };

    return NextResponse.json({ success: true, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// POST — Execute the full pipeline for a company
// ═══════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId } = body;

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  const pipelineId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const pipelineStart = Date.now();
  const stages: StageResult[] = [];

  // Create PipelineRun record for tracking
  const pipelineRun = await db.pipelineRun.create({
    data: {
      companyId,
      pipelineType: 'full',
      status: 'running',
      totalStages: 17, // Now 17 stages with fusion
      startedAt: new Date(),
    },
  });

  // Load company upfront
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: { take: 20, orderBy: { leadScore: 'desc' } },
      signals: { take: 20, orderBy: { createdAt: 'desc' } },
      evidence: { take: 10, orderBy: { createdAt: 'desc' } },
      researchCard: true,
      signalCapabilityMatches: { take: 20, orderBy: { matchScore: 'desc' } },
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  // ── Phase A: External Intelligence ──────────────────────────

  // Stage 1: Company Profile Assessment
  stages.push(await runStage('company_profile', async () => {
    const filledFields = [
      company.domain, company.industry, company.sizeRange, company.country,
      company.website, company.location,
    ].filter(Boolean).length;
    const score = Math.round((filledFields / 6) * 100);
    return { profileCompleteness: score, filledFields, totalFields: 6 };
  }));

  // Stage 2: Contact Intelligence Assessment
  stages.push(await runStage('contact_intelligence', async () => {
    const totalContacts = await db.contact.count({ where: { companyId } });
    const withTitle = await db.contact.count({ where: { companyId, title: { not: null } } });
    const enriched = await db.contact.count({ where: { companyId, enrichmentData: { not: null } } });
    return {
      total: totalContacts,
      withTitle,
      enriched,
      intelligenceCoverage: totalContacts > 0 ? Math.round((withTitle / totalContacts) * 100) : 0,
    };
  }));

  // Stage 3: Buying Committee Detection
  stages.push(await runStage('buying_committee', async () => {
    const contacts = await db.contact.findMany({
      where: { companyId },
      select: { title: true, role: true, rawName: true, email: true, leadScore: true },
      orderBy: { leadScore: 'desc' },
      take: 20,
    });
    const committee = contacts.filter(c => {
      const t = (c.title || '').toLowerCase();
      return t.includes('vp') || t.includes('director') || t.includes('head') ||
             t.includes('chief') || t.includes('cio') || t.includes('cto') ||
             t.includes('cfo') || t.includes('ceo') || t.includes('president') ||
             t.includes('manager') || t.includes('lead') || t.includes('senior');
    });
    return {
      totalContacts: contacts.length,
      committeeSize: committee.length,
      members: committee.slice(0, 5).map(c => ({ name: c.rawName, title: c.title })),
    };
  }));

  // Stage 4: Signal Detection Assessment
  stages.push(await runStage('signal_detection', async () => {
    const signals = await db.companySignal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const active = signals.filter(s => ['active', 'validated', 'aging'].includes(s.status));
    const byType: Record<string, number> = {};
    for (const s of signals) {
      byType[s.signalType] = (byType[s.signalType] || 0) + 1;
    }
    return {
      total: signals.length,
      active: active.length,
      signalTypes: byType,
      topSignals: signals.slice(0, 5).map(s => ({
        id: s.id,
        type: s.signalType,
        title: s.title,
        impact: s.impact,
        confidence: s.confidence,
      })),
    };
  }));

  // Stage 5: Evidence Assessment
  stages.push(await runStage('evidence_collection', async () => {
    const evidence = await db.evidence.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    return {
      total: evidence.length,
      avgConfidence: evidence.length > 0
        ? Math.round(evidence.reduce((a, e) => a + e.confidence, 0) / evidence.length * 100) / 100
        : 0,
      topEvidence: evidence.slice(0, 3).map(e => ({
        id: e.id,
        sourceName: e.sourceName,
        snippet: e.snippet.slice(0, 200),
        confidence: e.confidence,
      })),
    };
  }));

  // Stage 6: Research Card Assessment
  stages.push(await runStage('research_card', async () => {
    const card = await db.companyResearchCard.findUnique({ where: { companyId } });
    return {
      exists: !!card,
      businessOverview: card?.businessOverview ? card.businessOverview.slice(0, 200) : null,
      techLandscape: card?.techLandscape ? card.techLandscape.slice(0, 200) : null,
      keyPeople: card?.keyPeople || '[]',
    };
  }));

  // Stage 7: Revenue Intelligence Score
  stages.push(await runStage('revenue_score', async () => {
    const signals = await db.companySignal.count({ where: { companyId, status: { in: ['active', 'validated'] } } });
    const evidence = await db.evidence.count({ where: { companyId, status: 'active' } });
    const contacts = await db.contact.count({ where: { companyId } });
    const matches = await db.signalCapabilityMatch.count({ where: { companyId, matchScore: { gte: 0.4 } } });

    const score = Math.min(100, Math.round(
      (signals > 0 ? 25 : 0) +
      (evidence > 0 ? 25 : 0) +
      (contacts > 0 ? 20 : 0) +
      (matches > 0 ? 30 : 0)
    ));
    return { score, signalCount: signals, evidenceCount: evidence, contactCount: contacts, matchCount: matches };
  }));

  // ── Phase B: Internal Intelligence Matching ──────────────────

  // Stage 8: Capability Matching (THE CORE MOAT) — Unified LLM matcher
  // Uses CapabilityIntelligenceEngine.matchSignalToCapabilities() — same function as enrichment.
  // This ensures consistent matching quality across both paths.
  stages.push(await runStage('capability_matching', async () => {
    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      orderBy: { createdAt: 'desc' },
    });

    let totalMatches = 0;
    let highConfidence = 0;
    const enriched: Array<{ matchId: string; capabilityId: string; capabilityTitle: string; category: string; serviceLine: string | null; matchScore: number; businessProblem: string | null; expectedOutcome: string | null; salesAngle: string | null }> = [];

    for (const signal of signals.slice(0, 5)) {
      const matchResult = await CapabilityIntelligenceEngine.matchSignalToCapabilities(companyId, signal.id);
      if (matchResult.success && matchResult.matches.length > 0) {
        totalMatches += matchResult.matches.length;
        highConfidence += matchResult.matches.filter(m => m.matchScore >= 0.6).length;
        for (const m of matchResult.matches) {
          // Find persisted match record for matchId
          const persisted = await db.signalCapabilityMatch.findFirst({
            where: { signalId: signal.id, capabilityId: m.capabilityId },
          });
          enriched.push({
            matchId: persisted?.id || '',
            capabilityId: m.capabilityId,
            capabilityTitle: m.capabilityTitle,
            category: m.capabilityCategory,
            serviceLine: null,
            matchScore: m.matchScore,
            businessProblem: m.businessProblem,
            expectedOutcome: m.expectedOutcome,
            salesAngle: m.salesAngle,
          });
        }
      }
    }

    // Sort by matchScore descending and take top 10
    enriched.sort((a, b) => b.matchScore - a.matchScore);

    return {
      totalMatches,
      highConfidence,
      topMatches: enriched.slice(0, 10),
    };
  }));

  // Stage 9: Case Study Matching
  stages.push(await runStage('case_study_matching', async () => {
    const caseStudies = await db.capabilityAsset.findMany({
      where: { category: 'case_study', isActive: true },
    });

    // Use signal context to rank case studies
    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      take: 5,
    });

    if (caseStudies.length === 0 || signals.length === 0) {
      return { matched: caseStudies.slice(0, 3).map(c => ({ id: c.id, title: c.title, score: 0 })) };
    }

    const signalContext = signals.map(s => `${s.signalType}: ${s.title} — ${s.description || ''}`).join('\n');
    const caseStudyList = caseStudies.map(c => `- [${c.id}] ${c.title}: ${c.summary}`).join('\n');

    const ranked = await aiCall(
      `You are a sales intelligence analyst. Given a company's buying signals and a list of case studies, rank the top 3 most relevant case studies. Consider industry fit, problem alignment, and outcome relevance.`,
      `Company: ${company.rawName} (${company.industry || 'Unknown Industry'})
Signals:\n${signalContext}

Available Case Studies:\n${caseStudyList}

Return ONLY a JSON array of top 3: [{"id":"...","title":"...","score":0.85,"reason":"..."}]`,
      'smart',
      companyId,
    );

    let parsed: Array<{ id: string; title: string; score: number; reason: string }> = [];
    try {
      const cleaned = ranked.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = caseStudies.slice(0, 3).map(c => ({ id: c.id, title: c.title, score: 0.5, reason: 'Default relevance' }));
    }

    return { matched: parsed };
  }));

  // Stage 10: Solution Matching
  stages.push(await runStage('solution_matching', async () => {
    const solutions = await db.capabilityAsset.findMany({
      where: {
        isActive: true,
        category: { in: ['solution', 'service_line'] },
      },
    });

    if (solutions.length === 0) {
      return { matched: [] };
    }

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      take: 5,
    });

    const signalContext = signals.map(s => `${s.signalType}: ${s.title}`).join('; ');
    const solutionList = solutions.slice(0, 15).map(s => `- [${s.id}] ${s.title} (${s.category}): ${s.summary}`).join('\n');

    const ranked = await aiCall(
      `You are a solution architect. Given a prospect company's signals, rank the most relevant solutions from our portfolio.`,
      `Company: ${company.rawName} (${company.industry || 'Unknown'})
Buying Signals: ${signalContext}

Our Solutions:\n${solutionList}

Return top 5 as JSON: [{"id":"...","title":"...","category":"...","score":0.9,"reason":"..."}]`,
      'smart',
      companyId,
    );

    let parsed: Array<{ id: string; title: string; category: string; score: number; reason: string }> = [];
    try {
      const cleaned = ranked.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = solutions.slice(0, 5).map(s => ({ id: s.id, title: s.title, category: s.category, score: 0.5, reason: 'Default' }));
    }

    return { matched: parsed };
  }));

  // Stage 11: Competitive Positioning (AI-generated)
  stages.push(await runStage('competitive_positioning', async () => {
    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      take: 10,
    });
    const matches = company.signalCapabilityMatches.slice(0, 5);

    const matchContext = matches.map(m => `- ${m.capabilityId}: score ${m.matchScore}, problem: ${m.businessProblem || 'N/A'}`).join('\n');
    const signalContext = signals.map(s => `- [${s.signalType}] ${s.title}: ${s.description || ''}`).join('\n');

    const positioning = await aiCall(
      `You are a competitive intelligence strategist for a technology services company. Based on the prospect's buying signals and our capability matches, generate a competitive positioning statement. Be specific, actionable, and concise (3-5 sentences). Focus on WHY we are the best fit for THIS specific prospect.`,
      `Prospect: ${company.rawName} (${company.industry || 'Unknown Industry'}, ${company.sizeRange || 'Unknown Size'})
Current Buying Signals:\n${signalContext}

Our Capability Matches:\n${matchContext}

Generate a competitive positioning statement. Be specific to this prospect.`,
      'deep',
      companyId,
    );

    return { positioning };
  }));

  // ── Phase B.5: Intelligence Fusion ──

  // Stage 12: Intelligence Fusion (External × Internal = Opportunity Intelligence)
  // This is a pure-logic stage — NO AI calls. Uses already-persisted data.
  stages.push(await runStage('intelligence_fusion', async () => {
    const fusionResult = await FusionEngine.fuse({ companyId });
    return {
      totalFusions: fusionResult.totalFusions,
      highConfidenceFusions: fusionResult.highConfidenceFusions,
      topFusions: fusionResult.fusionResults.slice(0, 5).map(f => ({
        fusionType: f.fusionType,
        fusionScore: f.fusionScore,
        recommendedCapability: f.recommendedCapability,
        relevantCaseStudy: f.relevantCaseStudy,
        businessProblem: f.businessProblem,
        confidenceScore: f.confidenceScore,
      })),
    };
  }));

  // ── Phase C: Strategy Generation ──

  // Stage 13: Win Probability
  stages.push(await runStage('win_probability', async () => {
    const winResult = await CapabilityIntelligenceEngine.calculateWinProbability(companyId);
    return winResult as unknown as Record<string, unknown>;
  }));

  // Stage 13: Recommended Actions
  stages.push(await runStage('recommended_actions', async () => {
    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      take: 5,
    });
    const matches = company.signalCapabilityMatches.slice(0, 5);

    const context = `Company: ${company.rawName}
Industry: ${company.industry || 'Unknown'}
Signals: ${signals.map(s => s.title).join(', ')}
Top Capability Matches: ${matches.map(m => `score ${m.matchScore}`).join(', ')}`;

    const actions = await aiCall(
      `You are a revenue operations strategist. Based on intelligence about a prospect company, generate 3-5 specific, actionable next steps. Each action should have a clear timeline and owner suggestion. Return as JSON array: [{"action":"...","priority":"high|medium|low","timeline":"...","owner":"...","rationale":"..."}]`,
      context,
      'smart',
      companyId,
    );

    let parsed: Array<{ action: string; priority: string; timeline: string; owner: string; rationale: string }> = [];
    try {
      const cleaned = actions.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = [{ action: 'Schedule discovery call', priority: 'high', timeline: 'within 7 days', owner: 'SDR', rationale: 'Strong signal alignment detected' }];
    }

    return { actions: parsed };
  }));

  // Stage 14: Conversation Strategy
  stages.push(await runStage('conversation_strategy', async () => {
    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      take: 5,
    });
    const contacts = await db.contact.findMany({
      where: { companyId, title: { not: null } },
      orderBy: { leadScore: 'desc' },
      take: 5,
    });
    const matches = company.signalCapabilityMatches.slice(0, 5);

    const capabilities: string[] = [];
    for (const m of matches) {
      const cap = await db.capabilityAsset.findUnique({ where: { id: m.capabilityId } });
      if (cap) capabilities.push(cap.title);
    }

    const strategy = await aiCall(
      `You are a conversational intelligence expert. Create a targeted conversation strategy for engaging this prospect. Include: opening angle, key talking points (tied to our capabilities), objection handling, and suggested next steps. Be specific and actionable. Return as JSON: {"openingAngle":"...","talkingPoints":["..."],"objectionHandling":["..."],"suggestedNextSteps":["..."],"recommendedApproach":"email|call|linkedin|meeting"}`,
      `Prospect: ${company.rawName} (${company.industry || 'Unknown'})
Buying Signals: ${signals.map(s => `${s.signalType}: ${s.title}`).join('; ')}
Key Contacts: ${contacts.map(c => `${c.rawName} — ${c.title}`).join('; ')}
Our Matching Capabilities: ${capabilities.join(', ')}
Signal-Capability Matches: ${matches.map(m => `${m.capabilityId}: ${m.matchScore} — ${m.businessProblem || ''}`).join('; ')}`,
      'deep',
      companyId,
    );

    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = strategy.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { openingAngle: strategy.slice(0, 300), talkingPoints: [], objectionHandling: [], suggestedNextSteps: [], recommendedApproach: 'email' };
    }

    return { strategy: parsed };
  }));

  // Stage 15: Executive Brief
  stages.push(await runStage('executive_brief', async () => {
    const signals = await db.companySignal.findMany({
      where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
      take: 5,
    });
    const contacts = await db.contact.findMany({
      where: { companyId, title: { not: null } },
      orderBy: { leadScore: 'desc' },
      take: 10,
    });
    const evidence = await db.evidence.findMany({
      where: { companyId, status: 'active' },
      take: 5,
    });
    const matches = company.signalCapabilityMatches.slice(0, 5);
    const researchCard = await db.companyResearchCard.findUnique({ where: { companyId } });

    const capabilities: Array<{ title: string; score: number }> = [];
    for (const m of matches) {
      const cap = await db.capabilityAsset.findUnique({ where: { id: m.capabilityId } });
      if (cap) capabilities.push({ title: cap.title, score: m.matchScore });
    }

    const brief = await aiCall(
      `You are an executive briefing analyst. Write a concise executive brief (max 500 words) for a sales team preparing to engage this prospect. Structure: 1) Company Overview, 2) Key Intelligence (signals + evidence), 3) Capability Alignment (our matching strengths), 4) Recommended Approach, 5) Risk Factors. Write in a professional but direct business tone.`,
      `Company: ${company.rawName}
Industry: ${company.industry || 'Unknown'}
Size: ${company.sizeRange || 'Unknown'}
Domain: ${company.domain || 'Unknown'}
Revenue: ${researchCard?.revenue || 'Unknown'}
Employees: ${researchCard?.employeeCount || 'Unknown'}
Tech Stack: ${researchCard?.techStack || 'Unknown'}

Active Buying Signals (${signals.length}):
${signals.map(s => `- [${s.impact}] ${s.signalType}: ${s.title} — ${s.description || 'No details'}`).join('\n')}

Key Evidence (${evidence.length}):
${evidence.map(e => `- [${e.sourceName || e.sourceUrl}] ${e.snippet.slice(0, 150)}`).join('\n')}

Key Contacts (${contacts.length}):
${contacts.map(c => `- ${c.rawName} — ${c.title} (score: ${c.leadScore})`).join('\n')}

Our Capability Matches (${capabilities.length}):
${capabilities.map(c => `- ${c.title} (match: ${Math.round(c.score * 100)}%)`).join('\n')}`,
      'deep',
      companyId,
    );

    return { brief };
  }));

  // Stage 16: PERSIST EVERYTHING — AccountBrief, AccountScore, IntelligenceHealth,
  // StrategicInsight, AIEngagementStrategy, AIInsight + all stage outputs
  stages.push(await runStage('persist_all', async () => {
    const convResult = stages.find(s => s.name === 'conversation_strategy')?.result as Record<string, unknown> | null;
    const strat = (convResult?.strategy as Record<string, unknown>) || {};

    const briefResult = stages.find(s => s.name === 'executive_brief')?.result as Record<string, unknown> | null;
    const brief = (briefResult?.brief as string) || '';

    const winResult = stages.find(s => s.name === 'win_probability')?.result as Record<string, unknown> | null;
    const winProb = typeof winResult?.probability === 'number' ? winResult.probability : 50;

    const actionsResult = stages.find(s => s.name === 'recommended_actions')?.result as Record<string, unknown> | null;
    const actions = (actionsResult?.actions as Array<Record<string, unknown>>) || [];

    const caseStudyResult = stages.find(s => s.name === 'case_study_matching')?.result as Record<string, unknown> | null;
    const caseStudies = (caseStudyResult?.matched as Array<Record<string, unknown>>) || [];

    const solutionResult = stages.find(s => s.name === 'solution_matching')?.result as Record<string, unknown> | null;
    const solutions = (solutionResult?.matched as Array<Record<string, unknown>>) || [];

    const positioningResult = stages.find(s => s.name === 'competitive_positioning')?.result as Record<string, unknown> | null;
    const positioning = (positioningResult?.positioning as string) || '';

    // ── 16a: Upsert AccountBrief ──
    const signals = await db.companySignal.findMany({ where: { companyId, status: { in: ['active', 'validated', 'aging'] } }, take: 10 });
    const evidence = await db.evidence.findMany({ where: { companyId, status: 'active' }, take: 10 });
    const matches = await db.signalCapabilityMatch.findMany({ where: { companyId }, take: 10, orderBy: { matchScore: 'desc' } });

    await db.accountBrief.upsert({
      where: { companyId },
      create: {
        companyId,
        summary: brief.slice(0, 2000) || `Pipeline analysis for ${company.rawName}`,
        accountHealth: winProb >= 70 ? 'high' : winProb >= 40 ? 'medium' : 'low',
        keySignals: JSON.stringify(signals.slice(0, 5).map(s => ({ signal: s.title, type: s.signalType, confidence: s.confidence }))),
        themes: JSON.stringify([...new Set(matches.slice(0, 3).map(m => m.businessProblem).filter(Boolean))]),
        opportunityAreas: JSON.stringify(matches.slice(0, 5).map(m => m.expectedOutcome).filter(Boolean)),
        risks: JSON.stringify(signals.filter(s => s.severity === 'critical').map(s => s.title)),
        recommendedEngagement: (strat.openingAngle as string) || (actions[0]?.action as string) || 'Research and discover',
        evidenceReferences: JSON.stringify(evidence.slice(0, 5).map(e => ({ evidenceId: e.id, snippet: e.snippet.slice(0, 200) }))),
        confidence: winProb / 100,
        generatedBy: 'PIPELINE',
      },
      update: {
        summary: brief.slice(0, 2000) || `Pipeline analysis for ${company.rawName}`,
        accountHealth: winProb >= 70 ? 'high' : winProb >= 40 ? 'medium' : 'low',
        keySignals: JSON.stringify(signals.slice(0, 5).map(s => ({ signal: s.title, type: s.signalType, confidence: s.confidence }))),
        themes: JSON.stringify([...new Set(matches.slice(0, 3).map(m => m.businessProblem).filter(Boolean))]),
        opportunityAreas: JSON.stringify(matches.slice(0, 5).map(m => m.expectedOutcome).filter(Boolean)),
        risks: JSON.stringify(signals.filter(s => s.severity === 'critical').map(s => s.title)),
        recommendedEngagement: (strat.openingAngle as string) || (actions[0]?.action as string) || 'Research and discover',
        evidenceReferences: JSON.stringify(evidence.slice(0, 5).map(e => ({ evidenceId: e.id, snippet: e.snippet.slice(0, 200) }))),
        confidence: winProb / 100,
        generatedBy: 'PIPELINE',
      },
    });

    // ── 16b: Upsert AccountScore ──
    const scoreCategory = winProb >= 75 ? 'HOT_ACCOUNT' : winProb >= 50 ? 'WARM_ACCOUNT' : winProb >= 25 ? 'NURTURE' : 'AT_RISK';
    await db.accountScore.upsert({
      where: { companyId },
      create: {
        companyId,
        score: winProb,
        scoreBreakdown: JSON.stringify({
          intelligenceCoverage: signals.length > 0 ? Math.min(100, signals.length * 15) : 0,
          signalStrength: signals.reduce((a: number, s: any) => a + s.confidence, 0) / Math.max(1, signals.length) * 100,
          freshness: evidence.length > 0 ? 80 : 20,
          strategicFit: matches.length > 0 ? matches.reduce((a: number, m: any) => a + m.matchScore, 0) / matches.length * 100 : 0,
          overallScore: winProb,
        }),
        category: scoreCategory,
      },
      update: {
        score: winProb,
        scoreBreakdown: JSON.stringify({
          intelligenceCoverage: signals.length > 0 ? Math.min(100, signals.length * 15) : 0,
          signalStrength: signals.reduce((a: number, s: any) => a + s.confidence, 0) / Math.max(1, signals.length) * 100,
          freshness: evidence.length > 0 ? 80 : 20,
          strategicFit: matches.length > 0 ? matches.reduce((a: number, m: any) => a + m.matchScore, 0) / matches.length * 100 : 0,
          overallScore: winProb,
        }),
        category: scoreCategory,
      },
    });

    // ── 16c: Upsert CompanyIntelligenceHealth ──
    const totalContacts = await db.contact.count({ where: { companyId } });
    const filledFields = [company.domain, company.industry, company.sizeRange, company.country, company.website, company.location].filter(Boolean).length;
    const dataCompleteness = Math.round((filledFields / 6) * 100);
    const signalCoverage = signals.length > 0 ? Math.min(100, signals.length * 20) : 0;
    const evidenceCoverage = evidence.length > 0 ? Math.min(100, evidence.length * 15) : 0;
    const contactCoverage = totalContacts > 0 ? Math.min(100, totalContacts * 15) : 0;
    const overallHealth = Math.round((dataCompleteness + signalCoverage + evidenceCoverage + contactCoverage) / 4);

    await db.companyIntelligenceHealth.upsert({
      where: { companyId },
      create: {
        companyId,
        dataCompletenessScore: dataCompleteness,
        signalCoverageScore: signalCoverage,
        evidenceCoverageScore: evidenceCoverage,
        contactCoverageScore: contactCoverage,
        overallHealthScore: overallHealth,
        totalSignals: signals.length,
        activeSignals: signals.filter(s => ['active', 'validated'].includes(s.status)).length,
        totalEvidence: evidence.length,
        activeEvidence: evidence.filter(e => e.status === 'active').length,
        totalContacts,
        filledFields,
        fieldCoverage: JSON.stringify({ domain: !!company.domain, industry: !!company.industry, sizeRange: !!company.sizeRange, country: !!company.country, website: !!company.website, location: !!company.location }),
      },
      update: {
        dataCompletenessScore: dataCompleteness,
        signalCoverageScore: signalCoverage,
        evidenceCoverageScore: evidenceCoverage,
        contactCoverageScore: contactCoverage,
        overallHealthScore: overallHealth,
        totalSignals: signals.length,
        activeSignals: signals.filter(s => ['active', 'validated'].includes(s.status)).length,
        totalEvidence: evidence.length,
        activeEvidence: evidence.filter(e => e.status === 'active').length,
        totalContacts,
        filledFields,
        fieldCoverage: JSON.stringify({ domain: !!company.domain, industry: !!company.industry, sizeRange: !!company.sizeRange, country: !!company.country, website: !!company.website, location: !!company.location }),
      },
    });

    // ── 16d: Upsert StrategicInsight (existing) ──
    const insight = await db.strategicInsight.create({
      data: {
        companyId,
        insightType: 'OPPORTUNITY',
        summary: `Pipeline complete for ${company.rawName}. ${signals.length} signals, ${matches.length} matches, win prob ${Math.round(winProb)}%.`,
        confidenceScore: Math.round(winProb),
        generatedBy: 'PIPELINE',
        keyThemes: JSON.stringify(['pipeline_run', 'dual_intelligence', 'account_brief', 'account_score']),
      },
    });

    // ── 16e: Upsert AIEngagementStrategy (existing + enriched) ──
    await db.aIEngagementStrategy.create({
      data: {
        companyId,
        strategicInsightId: insight.id,
        conversationAngles: JSON.stringify({
          talkingPoints: (strat.talkingPoints as string[]) || [],
          openingAngle: strat.openingAngle || null,
          objectionHandling: (strat.objectionHandling as string[]) || [],
          recommendedApproach: strat.recommendedApproach || 'email',
        }),
        situationAssessment: JSON.stringify({
          stage: 'pipeline_generated',
          caseStudies: caseStudies.slice(0, 3).map(c => ({ id: c.id, title: c.title, score: c.score })),
          solutions: solutions.slice(0, 5).map(s => ({ id: s.id, title: s.title, score: s.score })),
          competitivePositioning: positioning,
          recommendedActions: actions.slice(0, 5).map(a => ({ action: a.action, priority: a.priority, timeline: a.timeline })),
        }),
        riskFactors: JSON.stringify(signals.filter(s => s.severity === 'critical').map(s => ({ signal: s.title, severity: s.severity }))),
        recommendedEntry: JSON.stringify({ approach: strat.recommendedApproach || 'email' }),
        firstMeetingObjective: 'discovery',
        generatedBy: 'PIPELINE',
      },
    });

    // ── 16f: Create AIInsight with full evidence chain ──
    await createInsight({
      companyId,
      type: 'RECOMMENDATION',
      title: `Full Pipeline Complete: ${company.rawName}`,
      description: `Intelligence pipeline completed. ${stages.filter(s => s.status === 'completed').length}/${stages.length} stages succeeded. Win probability: ${Math.round(winProb)}%. Score: ${scoreCategory}.`,
      evidence: [
        ...stages.filter(s => s.status === 'completed').slice(0, 5).map(s => ({
          source: 'pipeline',
          snippet: `Stage ${s.name}: completed in ${s.durationMs}ms`,
          reliability: 0.9,
        })),
        ...(signals.slice(0, 3).map(s => ({
          source: 'signal',
          snippet: `[${s.signalType}] ${s.title} (confidence: ${s.confidence})`,
          reliability: s.confidence,
        })) as Array<{ source: string; snippet: string; reliability: number }>),
        ...(matches.slice(0, 3).map(m => ({
          source: 'capability_match',
          snippet: `Match: ${m.capabilityId} (score: ${m.matchScore}) — ${m.reason || ''}`,
          reliability: m.matchScore,
        })) as Array<{ source: string; snippet: string; reliability: number }>),
      ],
      confidenceScore: Math.round(winProb),
      impactScore: Math.round(winProb * 0.8),
      urgencyScore: signals.some(s => s.severity === 'critical') ? 90 : signals.some(s => s.severity === 'high') ? 70 : 40,
      recommendedAction: (actions[0]?.action as string) || 'Review capability matches and executive brief.',
      reasoning: `Win probability ${Math.round(winProb)}% based on ${signals.length} signals, ${matches.length} capability matches, ${evidence.length} evidence records, ${totalContacts} contacts. Category: ${scoreCategory}.`,
      sourceType: 'pipeline',
      sourceRoute: '/api/intelligence/full-pipeline',
    });

    // ── 16g: Update Company.intelligenceScore ──
    await db.company.update({
      where: { id: companyId },
      data: { intelligenceScore: Math.round(winProb) },
    });

    return {
      accountBriefCreated: true,
      accountScoreCreated: true,
      intelligenceHealthCreated: true,
      strategicInsightId: insight.id,
      persisted: true,
      scoreCategory,
    };
  }));

  // ── Build final response ──

  const completedStages = stages.filter(s => s.status === 'completed').length;
  const failedStages = stages.filter(s => s.status === 'failed').length;
  const skippedStages = stages.filter(s => s.status === 'skipped').length;

  // Collect account strategy from stage results
  const capMatchResult = stages.find(s => s.name === 'capability_matching')?.result as Record<string, unknown> | null;
  const caseStudyResult = stages.find(s => s.name === 'case_study_matching')?.result as Record<string, unknown> | null;
  const solutionResult = stages.find(s => s.name === 'solution_matching')?.result as Record<string, unknown> | null;
  const positioningResult = stages.find(s => s.name === 'competitive_positioning')?.result as Record<string, unknown> | null;
  const actionsResult = stages.find(s => s.name === 'recommended_actions')?.result as Record<string, unknown> | null;
  const convResult = stages.find(s => s.name === 'conversation_strategy')?.result as Record<string, unknown> | null;
  const briefResult = stages.find(s => s.name === 'executive_brief')?.result as Record<string, unknown> | null;
  const winResult = stages.find(s => s.name === 'win_probability')?.result as Record<string, unknown> | null;
  const fusionStageResult = stages.find(s => s.name === 'intelligence_fusion')?.result as Record<string, unknown> | null;

  // ── Update PipelineRun record ──
  await db.pipelineRun.update({
    where: { id: pipelineRun.id },
    data: {
      status: failedStages > 0 ? 'partial' : 'completed',
      completedStages,
      failedStages,
      skippedStages,
      stageResults: JSON.stringify(stages.map(s => ({ name: s.name, status: s.status, durationMs: s.durationMs, error: s.error }))),
      durationMs: Date.now() - pipelineStart,
      completedAt: new Date(),
      aiCallsMade: stages.filter(s => ['case_study_matching', 'solution_matching', 'competitive_positioning', 'win_probability', 'recommended_actions', 'conversation_strategy', 'executive_brief'].includes(s.name)).length,
    },
  }).catch(() => { /* non-blocking */ });

  const pipelineResponse: PipelineRun = {
    id: pipelineId,
    companyId,
    totalStages: stages.length,
    completedStages,
    failedStages,
    skippedStages,
    durationMs: Date.now() - pipelineStart,
    stages,
  };

  return NextResponse.json({
    success: true,
    companyId,
    companyName: company.rawName,
    pipelineRun: pipelineResponse,
    accountStrategy: {
      capabilityMatches: capMatchResult || {},
      caseStudies: caseStudyResult || {},
      solutions: solutionResult || {},
      competitivePosition: positioningResult?.positioning || '',
      recommendedActions: actionsResult || {},
      conversationStrategy: convResult?.strategy || {},
      executiveBrief: briefResult?.brief || '',
      winProbability: winResult || {},
      intelligenceFusion: fusionStageResult || {},
    },
  });
}
