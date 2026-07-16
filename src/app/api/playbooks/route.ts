import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/playbooks — list all playbooks
export async function GET() {
  try {
    const playbooks = await db.playbook.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(playbooks.map(p => ({
      ...p,
      steps: JSON.parse(p.steps || '[]'),
      aiTips: p.aiTips || null,
    })));
  } catch (error: any) {
    // Table might not exist yet
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      return NextResponse.json([]);
    }
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/playbooks — create playbook (with optional AI generation)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, category, targetIndustry, targetRole, aiGenerate, steps, aiTips } = body;

    let finalSteps = steps || [];
    let finalAiTips = aiTips || null;

    // AI generation
    if (aiGenerate && !steps) {
      try {
        const { generateWithWebSearch } = await import('z-ai-web-dev-sdk');
        const categoryLabel = category === 'introduction' ? 'Initial outreach and introduction' :
          category === 'follow_up' ? 'Follow-up engagement' :
          category === 'discovery' ? 'Discovery call and needs assessment' :
          category === 'proposal' ? 'Proposal presentation' :
          category === 'negotiation' ? 'Negotiation and pricing' :
          category === 'closing' ? 'Deal closing techniques' :
          category === 'objection_handling' ? 'Handling common objections' : 'Sales engagement';

        const prompt = `Create a detailed sales playbook for "${name}".
Category: ${categoryLabel}
${targetIndustry ? `Target Industry: ${targetIndustry}` : ''}
${targetRole ? `Target Role: ${targetRole}` : ''}

Return a JSON object with this exact structure (no markdown, no code fences, raw JSON only):
{
  "steps": [
    {"title": "Step title", "description": "Detailed description of what to do in this step", "tips": ["Tip 1", "Tip 2"], "order": 1},
    {"title": "Step title", "description": "Detailed description", "tips": ["Tip 1"], "order": 2}
  ],
  "aiTips": "2-3 sentences of AI-generated engagement tips for this playbook type, mentioning specific techniques and psychological triggers"
}

Provide 4-6 detailed steps with actionable tips. Make the content specific and practical, not generic.`;

        const result = await generateWithWebSearch(prompt, { maxTokens: 3000 });
        const content = typeof result === 'string' ? result : JSON.stringify(result);

        // Try to parse the JSON from the response
        let jsonStr = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        try {
          const parsed = JSON.parse(jsonStr);
          finalSteps = parsed.steps || [];
          finalAiTips = parsed.aiTips || null;
        } catch {
          // If AI couldn't return proper JSON, create default steps
          finalSteps = [
            { title: 'Preparation', description: 'Research the prospect and prepare personalized talking points', tips: ['Review company news', 'Check LinkedIn profile'], order: 1 },
            { title: 'Outreach', description: `Execute the ${categoryLabel.toLowerCase()} sequence`, tips: ['Personalize the opening', 'Reference specific triggers'], order: 2 },
            { title: 'Follow-Up', description: 'Systematic follow-up based on engagement signals', tips: ['Wait 3-5 business days', 'Add value in each touch'], order: 3 },
            { title: 'Advancement', description: 'Move the conversation toward next steps', tips: ['Propose clear next action', 'Create urgency naturally'], order: 4 },
          ];
        }
      } catch (aiError) {
        // AI failed — create default steps
        finalSteps = [
          { title: 'Preparation', description: 'Research the prospect thoroughly', tips: ['Review recent news'], order: 1 },
          { title: 'Engagement', description: 'Execute outreach strategy', tips: ['Personalize messaging'], order: 2 },
          { title: 'Follow-Up', description: 'Maintain engagement cadence', tips: ['Add value each touch'], order: 3 },
        ];
      }
    }

    const playbook = await db.playbook.create({
      data: {
        name,
        description: description || null,
        category: category || 'custom',
        targetIndustry: targetIndustry || null,
        targetRole: targetRole || null,
        steps: JSON.stringify(finalSteps),
        aiTips: finalAiTips,
      },
    });

    return NextResponse.json({
      ...playbook,
      steps: finalSteps,
    });
  } catch (error: any) {
    if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
      // Table doesn't exist — return mock
      const mock = {
        id: `mock-${Date.now()}`,
        name: body.name,
        description: body.description || null,
        category: body.category || 'custom',
        targetIndustry: body.targetIndustry || null,
        targetRole: body.targetRole || null,
        steps: body.aiGenerate ? [
          { title: 'Preparation', description: 'Research the prospect and company', tips: ['Review LinkedIn', 'Check recent news'], order: 1 },
          { title: 'Initial Outreach', description: 'Send personalized first contact', tips: ['Reference specific trigger events'], order: 2 },
          { title: 'Value Delivery', description: 'Share relevant insights and content', tips: ['Use case studies'], order: 3 },
        ] : [],
        aiTips: body.aiGenerate ? 'Focus on building genuine rapport before pitching. Reference recent company news to show preparation and create immediate relevance.' : null,
        isActive: true,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(mock);
    }
    return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 });
  }
}