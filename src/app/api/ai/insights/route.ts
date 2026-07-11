import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

/* ── In-memory cache (5 minutes) ── */
let cachedResult: { data: ReturnType<typeof buildInsights>; ts: number } | null = null
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

/* ── Rule-based insight builder ── */
function buildInsights(stats: {
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
}): InsightsResponse {
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

/* ── GET handler ── */
export async function GET() {
  try {
    // Return cached if fresh
    if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
      return apiSuccess(cachedResult.data)
    }

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
    ] = await Promise.all([
      db.company.count({ where: { status: { not: 'archived' } } }),
      db.contact.count({ where: { archivedAt: null } }),
      db.contact.count({ where: { emailHealth: 'valid', archivedAt: null } }),
      db.contact.count({ where: { emailHealth: 'risky', archivedAt: null } }),
      db.contact.count({ where: { emailHealth: 'invalid', archivedAt: null } }),
      db.company.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.draft.count({ where: { createdAt: { gte: new Date(now.getTime() - 90 * 86400000) } } }),
      db.draft.count({ where: { status: 'draft' } }),
      db.opportunity.count({ where: { status: 'negotiation' } }),
      db.company.count({
        where: {
          status: { not: 'archived' },
          researchCard: { is: null },
        },
      }),
      db.company.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      db.contact.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, archivedAt: null } }),
      db.emailHealthCheck.count({ where: { checkedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }, status: 'valid' } }),
      db.opportunity.count({ where: { status: { notIn: ['won', 'lost', 'archived'] } } }),
    ])

    const data = buildInsights({
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
    })

    cachedResult = { data, ts: Date.now() }
    return apiSuccess(data)
  } catch (error) {
    console.error('Failed to generate AI insights:', error)
    return apiError('Failed to generate AI insights', 500)
  }
}