import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { governedAICallAggregate } from '@/lib/ai-governance';
import { logger } from '@/lib/logger';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';

function safeJsonParse(str: string | null | undefined, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// GET /api/playbooks — list all playbooks
export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    let playbooks: any[];
    try {
      playbooks = await db.playbook.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return NextResponse.json([]);
    }
    return NextResponse.json((playbooks || []).map((p: any) => ({
      ...p,
      steps: safeJsonParse(p.steps, []),
      aiTips: p.aiTips || null,
    })));
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/playbooks — create playbook (with optional AI generation)
export async function POST(req: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const createPlaybookSchema = z.object({
      name: z.string().trim().min(1, 'Name is required').max(200),
      description: z.string().max(2000).optional(),
      category: z.string().optional(),
      targetIndustry: z.string().optional(),
      targetRole: z.string().optional(),
      aiGenerate: z.boolean().optional(),
      steps: z.string().optional(),
      aiTips: z.string().optional(),
    });

    const body = await req.json();
    const parsed = validateBody(createPlaybookSchema, body);
    if (parsed instanceof Response) return parsed;
    const { name, description, category, targetIndustry, targetRole, aiGenerate, steps, aiTips } = parsed;

    let finalSteps: any[] = Array.isArray(steps) ? steps : (typeof steps === 'string' ? safeJsonParse(steps, []) : []);
    let finalAiTips = aiTips || null;

    // AI generation
    if (aiGenerate && !steps) {
      try {
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

        const completion = await governedAICallAggregate({
          generationType: 'playbook_generation',
          systemPrompt: 'You are a sales playbook expert. Return valid JSON only, no markdown fences.',
          userPrompt: prompt,
          tier: 'smart',
          maxTokens: 4096,
          temperature: 0.7,
        });
        const content = completion.success ? completion.response ?? '' : '';

        // Try to parse the JSON from the response
        let jsonStr = content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        try {
          const parsed = JSON.parse(jsonStr ?? '{}');
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
    logger.error('Playbook create error:', { error: error });
    return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 });
  }
}