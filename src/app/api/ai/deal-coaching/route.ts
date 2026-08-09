import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

// Stage-specific coaching config
const STAGE_COACHING: Record<string, {
  topics: Array<{ topic: string; why: string; timing: string }>;
  focus: string[];
  idealDaysInStage: number;
}> = {
  discovery: {
    idealDaysInStage: 14,
    topics: [
      { topic: 'Business pain points & challenges', why: 'Understanding their problems builds trust and positions your solution', timing: 'First meeting' },
      { topic: 'Current solution landscape', why: 'Knowing what they use reveals gaps and competitive positioning', timing: 'First meeting' },
      { topic: 'Decision-making process', why: 'Early mapping avoids surprises later in the pipeline', timing: 'Second interaction' },
      { topic: 'Budget indicators', why: 'Qualifying budget early prevents wasted effort on unqualified deals', timing: 'Discovery call' },
    ],
    focus: ['Uncover pain points', 'Map stakeholders', 'Establish business value'],
  },
  qualification: {
    idealDaysInStage: 10,
    topics: [
      { topic: 'BANT qualification (Budget, Authority, Need, Timeline)', why: 'Standard framework ensures thorough qualification', timing: 'Qualification call' },
      { topic: 'Competitive landscape', why: 'Understanding alternatives helps position your unique value', timing: 'After initial interest' },
      { topic: 'Success criteria & KPIs', why: 'Defining success metrics creates shared vision and measurable outcomes', timing: 'When pain confirmed' },
    ],
    focus: ['Validate budget', 'Confirm authority', 'Verify timeline'],
  },
  proposal: {
    idealDaysInStage: 14,
    topics: [
      { topic: 'Value proposition alignment', why: 'Connecting your solution directly to their stated needs increases close rate', timing: 'Proposal creation' },
      { topic: 'ROI / business case', why: 'Quantifying value makes approval easier for decision makers', timing: 'Before presenting' },
      { topic: 'Implementation roadmap', why: 'Showing a clear path to value reduces perceived risk', timing: 'Proposal review' },
      { topic: 'Risk mitigation', why: 'Proactively addressing concerns prevents last-minute stalls', timing: 'Proposal presentation' },
    ],
    focus: ['Align on value', 'Present ROI', 'Address objections'],
  },
  negotiation: {
    idealDaysInStage: 7,
    topics: [
      { topic: 'Terms & pricing structure', why: 'Flexible packaging shows partnership orientation', timing: 'When budget discussed' },
      { topic: 'Contract terms & SLAs', why: 'Clear expectations prevent post-sale disputes', timing: 'Before final sign-off' },
      { topic: 'Executive sponsorship', why: 'Higher-level support accelerates internal approval', timing: 'If stalled' },
    ],
    focus: ['Finalize terms', 'Secure commitment', 'Set expectations'],
  },
  closed_won: {
    idealDaysInStage: 0,
    topics: [],
    focus: ['Celebrate win', 'Plan handoff'],
  },
  closed_lost: {
    idealDaysInStage: 0,
    topics: [],
    focus: ['Capture learnings', 'Nurture for future'],
  },
};

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const pursuitId = searchParams.get('pursuitId');
    const companyId = searchParams.get('companyId');

    if (!pursuitId && !companyId) {
      return apiError('Provide pursuitId or companyId', 400);
    }

    // Fetch pursuit(s)
    const where: Record<string, unknown> = { status: 'active' };
    if (pursuitId) where.id = pursuitId;
    if (companyId) where.companyId = companyId;

    const pursuits = await db.pursuit.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        opportunity: {
          include: {
            company: { select: { id: true, rawName: true, normalizedName: true, engagementScore: true } },
            signal: true,
          },
        },
      },
    });

    if (pursuits.length === 0) {
      return apiError('No active pursuits found', 404);
    }

    const coachingResults: Array<{
      pursuitId: string;
      opportunityTitle: string;
      company: { id: string; name: string };
      currentStage: string;
      stageProgress: number;
      daysInStage: number;
      daysSinceActivity: number;
      coaching: {
        strengths: Array<{ area: string; evidence: string }>;
        gaps: Array<{ area: string; severity: string; suggestion: string }>;
        conversationTopics: Array<{ topic: string; why: string; timing: string }>;
        positioningNotes: string;
        nextSteps: Array<{ action: string; priority: string; deadline: string }>;
        churnRisk: number;
        churnRiskFactors: string[];
      };
    }> = [];

    for (const p of pursuits) {
      const opp = p.opportunity;
      const company = opp?.company;
      const currentStage = p.outcomeStage || 'discovery';
      const stageConfig = STAGE_COACHING[currentStage] || STAGE_COACHING.discovery;

      const now = Date.now();
      const daysSinceActivity = p.lastActivityAt
        ? Math.floor((now - p.lastActivityAt.getTime()) / 86400000)
        : 30;
      const daysInStage = p.createdAt
        ? Math.floor((now - p.createdAt.getTime()) / 86400000)
        : 0;

      const stageProgress = (() => {
        const stageOrder = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
        const idx = stageOrder.indexOf(currentStage);
        return Math.min(100, Math.max(0, Math.round((idx / (stageOrder.length - 2)) * 100)));
      })();

      // Strengths
      const strengths: Array<{ area: string; evidence: string }> = [];
      if (opp && opp.confidenceScore >= 70) strengths.push({ area: 'Strong Signal', evidence: `High confidence score of ${opp.confidenceScore}%` });
      if (daysSinceActivity <= 3) strengths.push({ area: 'Active Engagement', evidence: `Recent activity (${daysSinceActivity} days ago)` });
      if (p.owner) strengths.push({ area: 'Owner Assigned', evidence: `Assigned to ${p.owner}` });
      if (opp && opp.matchScore >= 0.6) strengths.push({ area: 'Good Fit', evidence: `Capability match score ${Math.round(opp.matchScore * 100)}%` });
      if (company && company.engagementScore >= 50) strengths.push({ area: 'Company Engagement', evidence: `High engagement score of ${company.engagementScore}` });

      // Gaps
      const gaps: Array<{ area: string; severity: 'high' | 'medium' | 'low'; suggestion: string }> = [];
      if (!p.nextAction) gaps.push({ area: 'Missing Next Action', severity: 'high', suggestion: 'Define a clear next step with deadline to maintain momentum' });
      if (daysSinceActivity > 7) gaps.push({ area: 'Stale Activity', severity: daysSinceActivity > 14 ? 'high' : 'medium', suggestion: `No activity in ${daysSinceActivity} days — schedule a touchpoint immediately` });
      if (!p.owner) gaps.push({ area: 'Unassigned', severity: 'high', suggestion: 'Assign a sales rep to drive this pursuit forward' });
      if (opp && opp.confidenceScore < 40) gaps.push({ area: 'Low Confidence', severity: 'medium', suggestion: 'Gather more evidence or re-qualify this opportunity' });
      if (daysInStage > stageConfig.idealDaysInStage) gaps.push({ area: 'Slow Stage Progress', severity: 'medium', suggestion: `Exceeding ideal ${stageConfig.idealDaysInStage} days in ${currentStage} — push for advancement` });

      // Churn risk
      let churnRisk = 0;
      const churnRiskFactors: string[] = [];
      if (daysSinceActivity > 14) { churnRisk += 35; churnRiskFactors.push('No activity in 14+ days'); }
      else if (daysSinceActivity > 7) { churnRisk += 20; churnRiskFactors.push('No activity in 7+ days'); }
      if (!p.owner) { churnRisk += 20; churnRiskFactors.push('No owner assigned'); }
      if (!p.nextAction) { churnRisk += 15; churnRiskFactors.push('No next action planned'); }
      if (opp && opp.confidenceScore < 30) { churnRisk += 20; churnRiskFactors.push('Very low confidence'); }
      churnRisk = Math.min(100, churnRisk);

      // Next steps
      const nextSteps: Array<{ action: string; priority: string; deadline: string }> = [];
      if (!p.owner) nextSteps.push({ action: 'Assign a sales rep to own this pursuit', priority: 'high', deadline: 'Today' });
      if (!p.nextAction) nextSteps.push({ action: 'Define and schedule the next action with the prospect', priority: 'high', deadline: 'Within 24 hours' });
      if (daysSinceActivity > 7) nextSteps.push({ action: 'Re-engage with a value-add touchpoint (article, insight, intro)', priority: 'high', deadline: 'Within 48 hours' });
      if (currentStage === 'discovery' && daysInStage > 14) nextSteps.push({ action: 'Move to qualification: schedule a BANT-qualifying call', priority: 'medium', deadline: 'This week' });
      if (currentStage === 'qualification' && daysInStage > 10) nextSteps.push({ action: 'Prepare and present proposal to advance to proposal stage', priority: 'medium', deadline: 'This week' });
      if (currentStage === 'proposal' && daysInStage > 14) nextSteps.push({ action: 'Follow up on proposal, address objections, push to negotiation', priority: 'high', deadline: 'Within 48 hours' });

      const coaching = {
        strengths,
        gaps,
        conversationTopics: stageConfig.topics,
        positioningNotes: opp?.suggestedConversation || `Focus on the business problem: ${opp?.businessProblem || 'unspecified'}`,
        nextSteps,
        churnRisk,
        churnRiskFactors,
      };

      coachingResults.push({
        pursuitId: p.id,
        opportunityTitle: opp?.opportunityTitle || 'Untitled',
        company: company ? { id: company.id, name: company.normalizedName || company.rawName } : { id: '', name: 'Unknown' },
        currentStage,
        stageProgress,
        daysInStage,
        daysSinceActivity,
        coaching,
      });

      // Persist coaching for single pursuit
      if (pursuitId && companyId) {
        try {
          await createInsights([{
            companyId,
            opportunityId: p.opportunityId,
            type: 'RECOMMENDATION' as const,
            title: `Coaching: ${opp?.opportunityTitle || 'Deal'}`,
            description: `Stage ${currentStage} coaching — ${strengths.length} strengths, ${gaps.length} gaps, churn risk ${churnRisk}%`,
            evidence: [
              ...strengths.map(s => ({ source: 'coaching-engine', snippet: s.evidence, reliability: 0.8 })),
              ...gaps.map(g => ({ source: 'coaching-engine', snippet: `${g.area}: ${g.suggestion}`, reliability: 0.85 })),
            ],
            confidenceScore: 75,
            impactScore: churnRisk,
            urgencyScore: churnRisk >= 50 ? 80 : 40,
            reasoning: `Stage-specific coaching for ${currentStage} with ${stageConfig.topics.length} conversation topics`,
            recommendedAction: nextSteps[0]?.action || 'Continue current approach',
            sourceType: 'deal_coaching_engine',
            sourceRoute: '/api/ai/deal-coaching',
            expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          }]);
        } catch (e) {
          logger.warn('[deal-coaching] Failed to persist insight:', { error: e });
        }
      }
    }

    return apiSuccess(pursuitId ? coachingResults[0] : coachingResults);
  } catch (error) {
    logger.error('[ai/deal-coaching] Error:', { error: error });
    return apiError('Failed to generate deal coaching', 500);
  }
}
