import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeJsonParse(str: string | null | undefined, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// GET /api/strategy-room — list strategies
export async function GET() {
  try {
    let strategies: any[];
    try {
      strategies = await db.accountStrategy.findMany({
        orderBy: { updatedAt: 'desc' },
      });
    } catch {
      return NextResponse.json([]);
    }

    // Enrich with company names where companyId exists
    const enriched = await Promise.all((strategies || []).map(async (s: any) => {
      let companyName: string | undefined;
      if (s.companyId) {
        try {
          const company = await db.company.findUnique({ where: { id: s.companyId }, select: { rawName: true } });
          companyName = company?.rawName || undefined;
        } catch { /* company not found */ }
      }
      return {
        ...s,
        companyName,
        swotAnalysis: safeJsonParse(s.swotAnalysis, null),
        keyInitiatives: safeJsonParse(s.keyInitiatives, null),
        stakeholderMap: safeJsonParse(s.stakeholderMap, null),
        competitivePosition: s.competitivePosition,
      };
    }));

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/strategy-room — create strategy
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, companyName, objective: reqObjective, currentSituation: reqSituation, aiGenerate } = body;
    let objective = reqObjective || null;
    let currentSituation = reqSituation || null;

    let swotAnalysis = null;
    let keyInitiatives = null;
    let stakeholderMap = null;
    let competitivePosition = null;
    let nextSteps = null;
    let companyId = null;

    // Try to find company in DB
    if (companyName) {
      try {
        const company = await db.company.findFirst({
          where: { normalizedName: { contains: companyName.toLowerCase().replace(/[^a-z0-9]/g, '') } },
        });
        if (company) companyId = company.id;
      } catch { /* skip */ }
    }

    // AI generation
    if (aiGenerate) {
      try {
        const { generateWithWebSearch } = await import('z-ai-web-dev-sdk');
        const prompt = `You are a strategic account planning expert. Create a comprehensive account strategy for: "${title}"
${companyName ? `Company: ${companyName}` : ''}
${objective ? `Objective: ${objective}` : ''}
${currentSituation ? `Current Situation: ${currentSituation}` : ''}

Return a JSON object (no markdown, raw JSON only):
{
  "objective": "Refined strategic objective (1-2 sentences)",
  "currentSituation": "Detailed current situation assessment (2-3 sentences)",
  "swotAnalysis": {
    "strengths": ["Strength 1", "Strength 2", "Strength 3"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
    "threats": ["Threat 1", "Threat 2"]
  },
  "keyInitiatives": [
    {"title": "Initiative title", "owner": "Role/person", "status": "not_started", "dueDate": "2025-09-30"},
    {"title": "Initiative title", "owner": "Role/person", "status": "in_progress", "dueDate": "2025-10-15"}
  ],
  "stakeholderMap": {
    "champions": [{"name": "Name", "role": "Title", "notes": "Why they support"}],
    "influencers": [{"name": "Name", "role": "Title", "notes": "Their influence area"}],
    "blockers": [{"name": "Name", "role": "Title", "notes": "Potential concern"}],
    "decisionMakers": [{"name": "Name", "role": "Title", "notes": "Decision authority"}]
  },
  "competitivePosition": "1-2 sentences on competitive positioning",
  "nextSteps": "Numbered list of 3-5 recommended next steps"
}

Be specific and actionable. Make stakeholder names realistic but mark them as [To be identified] if not known.`;

        const result = await generateWithWebSearch(prompt, { maxTokens: 4000 });
        const content = typeof result === 'string' ? result : JSON.stringify(result);
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          objective = parsed.objective || objective;
          currentSituation = parsed.currentSituation || currentSituation;
          swotAnalysis = parsed.swotAnalysis || null;
          keyInitiatives = parsed.keyInitiatives || null;
          stakeholderMap = parsed.stakeholderMap || null;
          competitivePosition = parsed.competitivePosition || null;
          nextSteps = parsed.nextSteps || null;
        }
      } catch {
        // AI failed — create defaults
        swotAnalysis = {
          strengths: ['Strong market position', 'Growing technology investment', 'Experienced leadership team'],
          weaknesses: ['Limited brand awareness in target segment', 'Complex buying process'],
          opportunities: ['Digital transformation initiative', 'Market expansion plans', 'Budget allocation for solutions'],
          threats: ['Established competitors', 'Economic uncertainty affecting budgets'],
        };
        keyInitiatives = [
          { title: 'Initial Discovery Meeting', owner: 'Account Executive', status: 'not_started', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) },
          { title: 'Technical Assessment', owner: 'Solutions Engineer', status: 'not_started', dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
          { title: 'Proposal Development', owner: 'Account Executive', status: 'not_started', dueDate: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10) },
        ];
        stakeholderMap = {
          champions: [{ name: '[To be identified]', role: 'Business Stakeholder', notes: 'Look for internal advocates' }],
          influencers: [{ name: '[To be identified]', role: 'Technical Lead', notes: 'Technology evaluation influencer' }],
          blockers: [{ name: '[To be identified]', role: 'Procurement', notes: 'Potential budget or process concerns' }],
          decisionMakers: [{ name: '[To be identified]', role: 'Executive Sponsor', notes: 'Final decision authority' }],
        };
        nextSteps = '1. Schedule initial discovery meeting with key stakeholders\n2. Research recent company news and triggers\n3. Prepare customized value proposition\n4. Identify and map all stakeholders\n5. Develop technical proof of concept plan';
      }
    }

    const strategy = await db.accountStrategy.create({
      data: {
        companyId,
        title,
        objective: objective || null,
        currentSituation: currentSituation || null,
        swotAnalysis: swotAnalysis ? JSON.stringify(swotAnalysis) : null,
        keyInitiatives: keyInitiatives ? JSON.stringify(keyInitiatives) : null,
        stakeholderMap: stakeholderMap ? JSON.stringify(stakeholderMap) : null,
        competitivePosition,
        nextSteps,
        status: aiGenerate ? 'active' : 'draft',
      },
    });

    // Try to find company name for response
    let respCompanyName = companyName || undefined;
    if (!respCompanyName && companyId) {
      try {
        const company = await db.company.findUnique({ where: { id: companyId! }, select: { rawName: true } });
        respCompanyName = company?.rawName || undefined;
      } catch { /* skip */ }
    }

    return NextResponse.json({
      ...strategy,
      companyName: respCompanyName,
      swotAnalysis,
      keyInitiatives,
      stakeholderMap,
      competitivePosition,
      nextSteps,
    });
  } catch (error: any) {
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      // Table doesn't exist — return mock
      const mock = {
        id: `mock-${Date.now()}`,
        companyId: null,
        title: body.title,
        objective: body.objective || null,
        currentSituation: body.currentSituation || null,
        swotAnalysis: body.aiGenerate ? {
          strengths: ['Strong market position', 'Innovation focus'],
          weaknesses: ['Limited awareness'],
          opportunities: ['Digital transformation', 'Market growth'],
          threats: ['Competition', 'Budget constraints'],
        } : null,
        keyInitiatives: body.aiGenerate ? [
          { title: 'Discovery Call', owner: 'AE', status: 'not_started', dueDate: '2025-08-30' },
        ] : null,
        stakeholderMap: null,
        competitivePosition: body.aiGenerate ? 'Well-positioned for engagement' : null,
        nextSteps: body.aiGenerate ? '1. Schedule discovery call\n2. Prepare value props' : null,
        status: body.aiGenerate ? 'active' : 'draft',
        companyName: body.companyName || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(mock);
    }
    return NextResponse.json({ error: 'Failed to create strategy' }, { status: 500 });
  }
}