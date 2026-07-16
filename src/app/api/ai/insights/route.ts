import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

/* ── In-memory cache (5 minutes) ── */
let cachedResult: { data: InsightsResponse; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

/* ── Types ── */
interface InsightItem {
  type: 'positive' | 'negative' | 'neutral' | 'action'
  icon: string
  title: string
  description: string
}

interface PredictionItem {
  metric: string
  current: number
  predicted: number
  trend: 'up' | 'down' | 'stable'
  confidence: number
}

interface InsightsResponse {
  summary: string
  keyInsights: InsightItem[]
  predictions: PredictionItem[]
}

/* ── Stats shape gathered from DB ── */
interface PipelineStats {
  totalCompanies: number
  totalContacts: number
  healthyEmails: number
  riskyEmails: number
  invalidEmails: number
  newThisWeek: number
  draftsGenerated: number
  pendingDrafts: number
  stalledNegotiations: number
  companiesWithoutResearch: number
  lastWeekCompanies: number
  lastWeekContacts: number
  lastWeekHealthy: number
  pipelineActive: number
  topIndustries: { industry: string; count: number }[]
}

/* ══════════════════════════════════════════════════════════════════════════
   AI-POWERED INSIGHTS (Primary Path)
   ══════════════════════════════════════════════════════════════════════════ */

async function createZAI() {
  return import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create())
}

/**
 * Fetch live industry trend context via web search.
 * Runs in parallel with the LLM where possible, but we need results first
 * to inject into the prompt.
 */
async function fetchIndustryTrends(topIndustries: { industry: string; count: number }[]): Promise<string> {
  if (topIndustries.length === 0) return ''

  try {
    const ZAI = await createZAI()
    const topThree = topIndustries.slice(0, 3).map(i => i.industry)
    const query = `B2B sales and outreach trends 2025 for ${topThree.join(', ')} industries`
    const results = await ZAI.functions.invoke('web_search', { query, num: 5 })

    // results may be an array of items or an object with a results array
    const items: Array<{ title?: string; snippet?: string; url?: string }> = Array.isArray(results)
      ? results
      : Array.isArray((results as Record<string, unknown>)?.results)
        ? (results as Record<string, unknown>).results as typeof items
        : []

    const snippets = items
      .slice(0, 5)
      .map(r => r.snippet ? '[' + (r.title ?? 'Article') + '] ' + r.snippet : null)
      .filter(Boolean)
      .join('\n')

    return snippets
      ? 'Live market intelligence for user\'s top industries:\n' + snippets
      : ''
  } catch {
    return '' // Non-critical — AI still works without it
  }
}

/**
 * Call the LLM with the gathered stats + optional web context and parse
 * a structured InsightsResponse out of the JSON it returns.
 */
async function buildAIInsights(stats: PipelineStats, trendContext: string): Promise<InsightsResponse> {
  const ZAI = await createZAI()

  const healthRate = stats.totalContacts > 0
    ? Math.round((stats.healthyEmails / stats.totalContacts) * 100)
    : 0

  const weekOverWeekGrowth = stats.lastWeekCompanies > 0
    ? Math.round(((stats.newThisWeek - stats.lastWeekCompanies) / stats.lastWeekCompanies) * 100)
    : null

  const topIndustriesStr = stats.topIndustries.length > 0
    ? stats.topIndustries.map(i => i.industry + ' (' + i.count + ')').join(', ')
    : 'None detected'

  const wowLabel = weekOverWeekGrowth !== null
    ? ' (WoW ' + (weekOverWeekGrowth >= 0 ? '+' : '') + weekOverWeekGrowth + '%)'
    : ''

  const trendSection = trendContext
    ? '\n## Live Market Intelligence\n' + trendContext + '\n'
    : ''

  const instructionsBlock = [
    'Return ONLY valid JSON (no markdown fences, no extra text) matching this exact schema:',
    '{',
    '  "summary": "2-4 sentence CEO-level strategic summary. Be specific with numbers. Name the single most important action the CEO should take today.",',
    '  "keyInsights": [',
    '    {',
    '      "type": "positive" or "negative" or "neutral" or "action",',
    '      "icon": "one of: TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, AlertTriangle, Clock, Sparkles, FileSearch, Mail, Building2, Target, Users, Zap, DollarSign, BarChart3, ArrowRight, Lightbulb",',
    '      "title": "Short 3-5 word title",',
    '      "description": "1-2 sentences with strategic reasoning, not just restating the number. Explain WHY this matters."',
    '    }',
    '  ],',
    '  "predictions": [',
    '    {',
    '      "metric": "name of the metric",',
    '      "current": <current number>,',
    '      "predicted": <predicted number ~4 weeks out>,',
    '      "trend": "up" or "down" or "stable",',
    '      "confidence": <1-100>',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Generate 4-6 key insights. Prioritize: (1) stalled negotiations, (2) email health issues, (3) growth signals, (4) action items.',
    '- Generate 3-4 predictions. Include "Total Companies", "Valid Emails", and at least one derived metric.',
    '- Each insight description must contain strategic analysis, not just data restatement.',
    '- Predictions should account for momentum, seasonality cues, and the live market intelligence above.',
    '- If the pipeline is very small (< 10 companies), be encouraging but honest about needing more data.',
    '- Keep the summary under 80 words.',
  ].join('\n')

  const userPrompt = [
    'You are a senior sales intelligence analyst writing a CEO morning briefing. Analyze the following real pipeline data and produce actionable insights.',
    '',
    '## Raw Data',
    '- Total companies in pipeline: ' + stats.totalCompanies,
    '- Total contacts: ' + stats.totalContacts,
    '- Emails valid: ' + stats.healthyEmails + ' (' + healthRate + '%)',
    '- Emails risky: ' + stats.riskyEmails,
    '- Emails invalid: ' + stats.invalidEmails,
    '- New companies added THIS week: ' + stats.newThisWeek,
    '- New companies added LAST week: ' + stats.lastWeekCompanies + wowLabel,
    '- New contacts added last week: ' + stats.lastWeekContacts,
    '- AI email drafts generated (last 90 days): ' + stats.draftsGenerated,
    '- Drafts pending review: ' + stats.pendingDrafts,
    '- Stalled negotiations: ' + stats.stalledNegotiations,
    '- Companies without research cards: ' + stats.companiesWithoutResearch,
    '- Active pipeline deals (not won/lost/archived): ' + stats.pipelineActive,
    '- Top industries: ' + topIndustriesStr,
    trendSection,
    '## Instructions',
    instructionsBlock,
  ].join('\n')

  const completion = await ZAI.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content:
          'You are a sales intelligence analyst. You respond ONLY with valid JSON matching the requested schema. No markdown, no commentary.',
      },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices?.[0]?.message?.content ?? ''

  // Extract JSON — handle potential markdown fences or leading/trailing whitespace
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI returned non-JSON response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  // Validate and sanitize the shape
  const insights: InsightItem[] = (Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [])
    .slice(0, 6)
    .map((item: Record<string, unknown>) => ({
      type: ['positive', 'negative', 'neutral', 'action'].includes(item.type as string)
        ? (item.type as InsightItem['type'])
        : 'neutral',
      icon: typeof item.icon === 'string' && item.icon.length > 0 ? item.icon : 'Lightbulb',
      title: String(item.title ?? '').slice(0, 60) || 'Insight',
      description: String(item.description ?? '').slice(0, 300) || '',
    }))

  const predictions: PredictionItem[] = (Array.isArray(parsed.predictions) ? parsed.predictions : [])
    .slice(0, 4)
    .map((item: Record<string, unknown>) => ({
      metric: String(item.metric ?? 'Metric').slice(0, 50),
      current: Number(item.current) || 0,
      predicted: Math.max(Number(item.predicted) || 0, Number(item.current) || 0),
      trend: ['up', 'down', 'stable'].includes(item.trend as string)
        ? (item.trend as PredictionItem['trend'])
        : 'stable',
      confidence: Math.min(99, Math.max(1, Math.round(Number(item.confidence) || 50))),
    }))

  return {
    summary: String(parsed.summary ?? '').slice(0, 500) || 'AI insights unavailable.',
    keyInsights: insights,
    predictions,
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RULE-BASED FALLBACK (kept verbatim from original)
   ══════════════════════════════════════════════════════════════════════════ */

function buildRuleBasedInsights(stats: PipelineStats): InsightsResponse {
  const insights: InsightItem[] = []
  const predictions: PredictionItem[] = []

  const totalEmails = stats.totalContacts
  const healthRate = totalEmails > 0 ? Math.round((stats.healthyEmails / totalEmails) * 100) : 0

  // ── Positive insights ──
  if (stats.newThisWeek > 0 && stats.lastWeekCompanies > 0) {
    const growth = Math.round(((stats.newThisWeek - stats.lastWeekCompanies) / Math.max(stats.lastWeekCompanies, 1)) * 100)
    if (growth > 0) {
      insights.push({
        type: 'positive',
        icon: 'TrendingUp',
        title: 'Company Growth',
        description: `Total companies grew ${growth}% this week with ${stats.newThisWeek} new additions.`,
      })
    } else {
      insights.push({
        type: 'neutral',
        icon: 'Building2',
        title: 'New Companies Added',
        description: `${stats.newThisWeek} new companies added this week.`,
      })
    }
  } else if (stats.newThisWeek > 0) {
    insights.push({
      type: 'positive',
      icon: 'Building2',
      title: 'New Companies',
      description: `${stats.newThisWeek} new companies added this week.`,
    })
  }

  if (healthRate >= 80) {
    insights.push({
      type: 'positive',
      icon: 'ShieldCheck',
      title: 'Email Health Strong',
      description: `${healthRate}% of contact emails are valid and deliverable.`,
    })
  } else if (stats.lastWeekHealthy > 0 && stats.healthyEmails > stats.lastWeekHealthy) {
    const improved = Math.round(((stats.healthyEmails - stats.lastWeekHealthy) / Math.max(stats.lastWeekHealthy, 1)) * 100)
    insights.push({
      type: 'positive',
      icon: 'ShieldCheck',
      title: 'Email Health Improving',
      description: `Email validation improved by ${improved}% compared to last week.`,
    })
  }

  if (stats.draftsGenerated > 0) {
    insights.push({
      type: 'positive',
      icon: 'Sparkles',
      title: 'AI Drafts Generated',
      description: `${stats.draftsGenerated} AI-powered email drafts have been created.`,
    })
  }

  // ── Negative insights ──
  if (stats.invalidEmails > 0) {
    insights.push({
      type: 'negative',
      icon: 'AlertTriangle',
      title: 'Invalid Emails Detected',
      description: `${stats.invalidEmails} contacts have invalid email addresses that need attention.`,
    })
  }

  if (stats.riskyEmails > 0) {
    insights.push({
      type: 'negative',
      icon: 'ShieldAlert',
      title: 'Risky Email Addresses',
      description: `${stats.riskyEmails} contacts have risky emails that may bounce.`,
    })
  }

  if (stats.stalledNegotiations > 0) {
    insights.push({
      type: 'negative',
      icon: 'Clock',
      title: 'Stalled Opportunities',
      description: `${stats.stalledNegotiations} opportunities are stalled in negotiation stage.`,
    })
  }

  // ── Action insights ──
  if (stats.companiesWithoutResearch > 0) {
    insights.push({
      type: 'action',
      icon: 'FileSearch',
      title: 'Research Needed',
      description: `${stats.companiesWithoutResearch} companies need AI research cards generated.`,
    })
  }

  if (stats.pendingDrafts > 0) {
    insights.push({
      type: 'action',
      icon: 'Mail',
      title: 'Drafts Pending Review',
      description: `${stats.pendingDrafts} email drafts are waiting for approval before sending.`,
    })
  }

  // ── Neutral insights ──
  if (stats.pipelineActive > 0) {
    insights.push({
      type: 'neutral',
      icon: 'Target',
      title: 'Active Pipeline',
      description: `Pipeline has ${stats.pipelineActive} active deals being tracked.`,
    })
  }

  if (stats.totalContacts > 0 && stats.totalCompanies > 0) {
    const avgContacts = (stats.totalContacts / stats.totalCompanies).toFixed(1)
    insights.push({
      type: 'neutral',
      icon: 'Users',
      title: 'Contacts per Company',
      description: `Average of ${avgContacts} contacts per company in your database.`,
    })
  }

  // ── Predictions (simple linear extrapolation) ──
  const weekGrowthRate = stats.lastWeekCompanies > 0
    ? (stats.newThisWeek - stats.lastWeekCompanies) / stats.lastWeekCompanies
    : stats.totalCompanies > 0 ? stats.newThisWeek / stats.totalCompanies : 0

  predictions.push({
    metric: 'Total Companies',
    current: stats.totalCompanies,
    predicted: Math.max(stats.totalCompanies + Math.round(stats.newThisWeek * 4 * (1 + weekGrowthRate * 0.1)), stats.totalCompanies),
    trend: weekGrowthRate > 0.05 ? 'up' : weekGrowthRate < -0.05 ? 'down' : 'stable',
    confidence: Math.min(95, Math.max(30, 50 + Math.abs(weekGrowthRate) * 100)),
  })

  const healthGrowthRate = stats.lastWeekHealthy > 0
    ? (stats.healthyEmails - stats.lastWeekHealthy) / stats.lastWeekHealthy
    : 0
  predictions.push({
    metric: 'Valid Emails',
    current: stats.healthyEmails,
    predicted: Math.max(stats.healthyEmails + Math.round((stats.healthyEmails - stats.lastWeekHealthy) * 4), stats.healthyEmails),
    trend: healthGrowthRate > 0.02 ? 'up' : healthGrowthRate < -0.02 ? 'down' : 'stable',
    confidence: Math.min(85, Math.max(25, 45 + Math.abs(healthGrowthRate) * 80)),
  })

  predictions.push({
    metric: 'Pipeline Deals',
    current: stats.pipelineActive,
    predicted: Math.max(Math.round(stats.pipelineActive * (1 + weekGrowthRate * 0.3)), stats.pipelineActive),
    trend: weekGrowthRate > 0.03 ? 'up' : weekGrowthRate < -0.03 ? 'down' : 'stable',
    confidence: Math.min(70, Math.max(20, 40 + stats.pipelineActive * 2)),
  })

  // ── Build summary ──
  const parts: string[] = []
  if (stats.newThisWeek > 0) {
    const dir = stats.lastWeekCompanies > 0 && stats.newThisWeek > stats.lastWeekCompanies ? 'growing' : 'building'
    parts.push(`Your pipeline is ${dir} with ${stats.newThisWeek} new companies this week`)
  }
  if (healthRate >= 80) {
    parts.push(`email health is strong at ${healthRate}%`)
  } else if (healthRate > 0) {
    parts.push(`email health sits at ${healthRate}% — consider validating more contacts`)
  }
  if (stats.stalledNegotiations > 0) {
    parts.push(`${stats.stalledNegotiations} deal${stats.stalledNegotiations === 1 ? ' needs' : 's need'} follow-up to avoid going cold`)
  }

  const summary = parts.length > 0
    ? parts.join('. ') + '.'
    : 'Your sales intelligence pipeline is set up. Start adding companies and contacts to see AI-powered insights here.'

  return { summary, keyInsights: insights.slice(0, 6), predictions }
}

/* ══════════════════════════════════════════════════════════════════════════
   DB QUERY LAYER — gathers all stats in parallel
   ══════════════════════════════════════════════════════════════════════════ */

async function gatherStats(): Promise<PipelineStats> {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const [
    totalCompanies,
    totalContacts,
    healthyEmails,
    riskyEmails,
    invalidEmails,
    newThisWeek,
    draftsGenerated,
    pendingDrafts,
    stalledNegotiations,
    companiesWithoutResearch,
    lastWeekCompanies,
    lastWeekContacts,
    lastWeekHealthy,
    pipelineActive,
    topIndustriesRaw,
  ] = await Promise.all([
    db.company.count({ where: { status: { not: 'archived' } } }),
    db.contact.count({ where: { status: { not: 'archived' } } }),
    db.contact.count({ where: { emailHealth: 'valid', status: { not: 'archived' } } }),
    db.contact.count({ where: { emailHealth: 'risky', status: { not: 'archived' } } }),
    db.contact.count({ where: { emailHealth: 'invalid', status: { not: 'archived' } } }),
    db.company.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.draft.count({ where: { createdAt: { gte: new Date(now.getTime() - 90 * 86400000) } } }),
    db.draft.count({ where: { status: 'pending_review' } }),
    db.company.count({ where: { lifecycleStage: 'negotiation' } }),
    db.company.count({
      where: {
        status: { not: 'archived' },
        researchCard: { is: null },
      },
    }),
    db.company.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    db.contact.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, status: { not: 'archived' } } }),
    db.contact.count({ where: { emailHealth: 'valid', lastCheckedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    db.company.count({ where: { lifecycleStage: { notIn: ['closed', 'closed_won', 'closed_lost'] } } }),
    // Group companies by industry, take top 5
    db.company.groupBy({
      by: ['industry'],
      where: {
        status: { not: 'archived' },
        industry: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ])

  const topIndustries = topIndustriesRaw
    .filter(r => r.industry)
    .map(r => ({ industry: r.industry!, count: r._count.id }))

  return {
    totalCompanies,
    totalContacts,
    healthyEmails,
    riskyEmails,
    invalidEmails,
    newThisWeek,
    draftsGenerated,
    pendingDrafts,
    stalledNegotiations,
    companiesWithoutResearch,
    lastWeekCompanies,
    lastWeekContacts,
    lastWeekHealthy,
    pipelineActive,
    topIndustries,
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   GET HANDLER
   ══════════════════════════════════════════════════════════════════════════ */

export async function GET() {
  try {
    // Return cached if fresh
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      return apiSuccess(cachedResult.data)
    }

    const stats = await gatherStats()

    // --- AI path (primary) ---
    let data: InsightsResponse
    try {
      const [trendContext] = await Promise.all([
        fetchIndustryTrends(stats.topIndustries),
        // We could parallelize the LLM call too, but it depends on trendContext
        // so we run it sequentially inside buildAIInsights
      ])
      data = await buildAIInsights(stats, trendContext)
    } catch (aiError) {
      // Fallback to rule-based if AI fails for any reason
      console.warn('[AI Insights] AI generation failed, falling back to rules:', aiError)
      data = buildRuleBasedInsights(stats)
    }

    cachedResult = { data, ts: Date.now() }
    return apiSuccess(data)
  } catch (error) {
    console.error('Failed to generate AI insights:', error)
    return apiError('Failed to generate AI insights', 500)
  }
}