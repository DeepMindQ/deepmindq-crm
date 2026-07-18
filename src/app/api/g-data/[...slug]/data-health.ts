import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { formatDistanceToNow } from 'date-fns'
import { callLLM } from '@/lib/zai-helpers'

/* ── In-memory cache (5 minutes) ── */
let cachedResult: { data: DataHealthResponse; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

/* ── Types ── */
interface DataHealthResponse {
  overallScore: number
  totalRecords: number
  healthyRecords: number
  needsAttention: number
  criticalRecords: number
  healthBreakdown: {
    dataCompleteness: number
    contactEnrichment: number
    signalCoverage: number
    relationshipMapping: number
  }
  qualityCategories: {
    missingEmails: { count: number; entity: 'contacts' }
    missingCompanyData: { count: number; entity: 'companies' }
    staleSignals: { count: number; entity: 'companies' }
    incompleteStakeholders: { count: number; entity: 'companies' }
    missingIndustry: { count: number; entity: 'companies' }
    potentialDuplicates: { count: number; entity: 'contacts' }
  }
  enrichmentQueue: Array<{
    id: string
    name: string
    type: 'company' | 'contact'
    missing: string
    priority: 'high' | 'medium' | 'low'
  }>
  dataFreshness: Array<{
    group: string
    lastUpdated: string
    completeness: number
    totalRecords: number
  }>
  // ── AI-powered fields (may be undefined if AI is unavailable) ──
  aiDiagnosis?: string
  aiEnrichmentStrategy?: Array<{
    priority: string
    action: string
    reasoning: string
    estimatedImpact: string
  }>
  aiPrediction?: string
  aiEnrichmentPlan?: {
    summary: string
    batches: Array<{
      label: string
      entityType: 'company' | 'contact'
      ids: string[]
      rationale: string
    }>
    estimatedTimeToComplete: string
    projectedScoreAfter: number
  }
}

const NOT_ARCHIVED = { not: 'archived' }

/* ── Helper: compute a 0-100 percentage safely ── */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100)
}

/* ── Parse a JSON array from LLM output, with fallback ── */
function parseJSONArray<T>(text: string): T[] {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Try regex-based extraction of objects
    const results: T[] = []
    const objRegex = /\{[^{}]*\}/g
    let match
    while ((match = objRegex.exec(cleaned)) !== null) {
      try {
        results.push(JSON.parse(match[0]) as T)
      } catch {
        // skip malformed objects
      }
    }
    return results
  }
  return []
}

/* ── GET handler ── */
export async function GET() {
  // Return cached result if still fresh
  if (cachedResult && Date.now() - cachedResult.ts < CACHE_TTL) {
    return apiSuccess(cachedResult.data)
  }

  try {
    // ────────────────────────────────────────────────
    // 1. Run all independent queries in parallel
    // ────────────────────────────────────────────────
    const [
      totalCompanies,
      totalContacts,
      completeCompanies,
      enrichedContacts,
      companiesWithSignals,
      criticalCompanies,
      contactsMissingEmail,
      companiesMissingCompanyData,
      companiesMissingIndustry,
      potentialDuplicateContacts,
      companiesWithMultipleContactsResult,
      criticalContacts,
      companiesNeedingEnrichment,
      contactsNeedingEnrichment,
      freshnessRows,
    ] = await Promise.all([
      // Total non-archived companies
      db.company.count({ where: { status: NOT_ARCHIVED } }),

      // Total non-archived contacts
      db.contact.count({ where: { status: NOT_ARCHIVED } }),

      // Companies with industry, domain, AND sizeRange
      db.company.count({
        where: {
          status: NOT_ARCHIVED,
          industry: { not: null },
          domain: { not: null },
          sizeRange: { not: null },
        },
      }),

      // Contacts with email (non-empty), title, AND companyId
      db.contact.count({
        where: {
          status: NOT_ARCHIVED,
          email: { not: '' },
          title: { not: null },
        },
      }),

      // Companies with at least 1 signal
      db.company.count({
        where: { status: NOT_ARCHIVED, signals: { some: {} } },
      }),

      // Critical companies: missing ALL 3 key fields
      db.company.count({
        where: {
          status: NOT_ARCHIVED,
          industry: null,
          domain: null,
          sizeRange: null,
        },
      }),

      // Contacts with empty email
      db.contact.count({
        where: { status: NOT_ARCHIVED, email: '' },
      }),

      // Companies missing industry OR domain
      db.company.count({
        where: {
          status: NOT_ARCHIVED,
          OR: [{ industry: null }, { domain: null }],
        },
      }),

      // Companies missing industry
      db.company.count({
        where: { status: NOT_ARCHIVED, industry: null },
      }),

      // Contacts with empty email (treated as potential duplicates along with missing company)
      db.contact.count({
        where: {
          status: NOT_ARCHIVED,
          OR: [{ email: '' }],
        },
      }),

      // Companies with 2+ contacts (raw query for efficient counting)
      db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT c.id
          FROM "Company" c
          INNER JOIN "Contact" ct ON ct."companyId" = c.id
          WHERE c.status != 'archived' AND ct.status != 'archived'
          GROUP BY c.id
          HAVING COUNT(ct.id) >= 2
        ) sub
      `,

      // Critical contacts: no email AND no title
      db.contact.count({
        where: { status: NOT_ARCHIVED, email: '', title: null },
      }),

      // Companies needing enrichment (missing at least 1 key field)
      db.company.findMany({
        where: {
          status: NOT_ARCHIVED,
          OR: [
            { industry: null },
            { domain: null },
            { sizeRange: null },
          ],
        },
        select: { id: true, normalizedName: true, industry: true, domain: true, sizeRange: true, lifecycleStage: true },
        take: 30,
        orderBy: { updatedAt: 'desc' },
      }),

      // Contacts needing enrichment (missing at least 1 key field)
      db.contact.findMany({
        where: {
          status: NOT_ARCHIVED,
          OR: [{ email: '' }, { title: null }, { phone: null }],
        },
        select: { id: true, normalizedName: true, email: true, title: true, phone: true },
        take: 30,
        orderBy: { updatedAt: 'desc' },
      }),

      // Data freshness: group companies by lifecycleStage
      db.$queryRaw<
        Array<{
          lifecycleStage: string
          lastUpdated: Date
          totalRecords: number
          completeness: number
        }>
      >`
        SELECT
          "lifecycleStage",
          MAX("updatedAt") AS "lastUpdated",
          COUNT(*)::int AS "totalRecords",
          ROUND(
            AVG(
              (CASE WHEN "industry" IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN "domain" IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN "sizeRange" IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN "location" IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN "website" IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / 5.0
            )
          )::int AS "completeness"
        FROM "Company"
        WHERE "status" != 'archived'
        GROUP BY "lifecycleStage"
        ORDER BY "lifecycleStage"
      `,
    ])

    // ────────────────────────────────────────────────
    // 2. Compute dimension scores
    // ────────────────────────────────────────────────
    const dataCompleteness = pct(completeCompanies, totalCompanies)
    const contactEnrichment = pct(enrichedContacts, totalContacts)
    const signalCoverage = pct(companiesWithSignals, totalCompanies)
    const companiesWithMultipleContacts = companiesWithMultipleContactsResult[0]?.count ?? 0
    const relationshipMapping = pct(companiesWithMultipleContacts, totalCompanies)

    const overallScore = Math.round(
      dataCompleteness * 0.25 +
        contactEnrichment * 0.25 +
        signalCoverage * 0.25 +
        relationshipMapping * 0.25,
    )

    // ────────────────────────────────────────────────
    // 3. Classify records (healthy / needs attention / critical)
    // ────────────────────────────────────────────────
    const healthyCompanies = completeCompanies
    const needsAttentionCompanies = totalCompanies - healthyCompanies - criticalCompanies

    const healthyContacts = enrichedContacts
    const needsAttentionContacts = totalContacts - healthyContacts - criticalContacts

    const totalRecords = totalCompanies + totalContacts
    const healthyRecords = healthyCompanies + healthyContacts
    const criticalRecords = criticalCompanies + criticalContacts
    const needsAttention = Math.max(0, totalRecords - healthyRecords - criticalRecords)

    // ────────────────────────────────────────────────
    // 4. Quality categories
    // ────────────────────────────────────────────────
    const staleSignals = totalCompanies - companiesWithSignals
    const incompleteStakeholders = totalCompanies - companiesWithMultipleContacts

    const qualityCategories = {
      missingEmails: { count: contactsMissingEmail, entity: 'contacts' as const },
      missingCompanyData: { count: companiesMissingCompanyData, entity: 'companies' as const },
      staleSignals: { count: staleSignals, entity: 'companies' as const },
      incompleteStakeholders: { count: incompleteStakeholders, entity: 'companies' as const },
      missingIndustry: { count: companiesMissingIndustry, entity: 'companies' as const },
      potentialDuplicates: { count: potentialDuplicateContacts, entity: 'contacts' as const },
    }

    // ────────────────────────────────────────────────
    // 5. Enrichment queue (top 10 for display)
    // ────────────────────────────────────────────────
    type QueueItem = DataHealthResponse['enrichmentQueue'][number]

    const companyQueueItems: (QueueItem & { _missingCount: number; _lifecycleStage?: string | null })[] = companiesNeedingEnrichment.map((c) => {
      const missing: string[] = []
      if (!c.industry) missing.push('industry')
      if (!c.domain) missing.push('domain')
      if (!c.sizeRange) missing.push('sizeRange')
      const priority: QueueItem['priority'] =
        missing.length >= 3 ? 'high' : missing.length === 2 ? 'medium' : 'low'
      return {
        id: c.id,
        name: c.normalizedName,
        type: 'company' as const,
        missing: missing.join(', '),
        priority,
        _missingCount: missing.length,
        _lifecycleStage: c.lifecycleStage,
      }
    })

    const contactQueueItems: (QueueItem & { _missingCount: number })[] = contactsNeedingEnrichment.map((c) => {
      const missing: string[] = []
      if (!c.email) missing.push('email')
      if (!c.title) missing.push('title')
      if (!c.phone) missing.push('phone')
      const priority: QueueItem['priority'] =
        missing.length >= 3 ? 'high' : missing.length === 2 ? 'medium' : 'low'
      return {
        id: c.id,
        name: c.normalizedName,
        type: 'contact' as const,
        missing: missing.join(', '),
        priority,
        _missingCount: missing.length,
      }
    })

    // Merge, sort by most missing fields first, take top 10 for display
    const allQueueItems = [...companyQueueItems, ...contactQueueItems]
    const enrichmentQueue = allQueueItems
      .sort((a, b) => b._missingCount - a._missingCount)
      .slice(0, 10)
      .map(({ id, name, type, missing, priority }) => ({
        id,
        name,
        type,
        missing,
        priority,
      }))

    // ────────────────────────────────────────────────
    // 6. Data freshness
    // ────────────────────────────────────────────────
    const stageLabelMap: Record<string, string> = {
      discovery: 'Discovery',
      qualification: 'Qualification',
      proposal: 'Proposal',
      negotiation: 'Negotiation',
      closed: 'Closed',
    }

    const dataFreshness = freshnessRows.map((row) => ({
      group: stageLabelMap[row.lifecycleStage] ?? row.lifecycleStage,
      lastUpdated: formatDistanceToNow(new Date(row.lastUpdated), { addSuffix: true }),
      completeness: row.completeness,
      totalRecords: row.totalRecords,
    }))

    // ────────────────────────────────────────────────
    // 7. Build base response (without AI — fallback-safe)
    // ────────────────────────────────────────────────
    const baseResult: DataHealthResponse = {
      overallScore,
      totalRecords,
      healthyRecords,
      needsAttention,
      criticalRecords,
      healthBreakdown: {
        dataCompleteness,
        contactEnrichment,
        signalCoverage,
        relationshipMapping,
      },
      qualityCategories,
      enrichmentQueue,
      dataFreshness,
    }

    // ────────────────────────────────────────────────
    // 8. AI-Powered Analysis (fire-and-forget style —
    //    if AI fails, we still return base metrics)
    // ────────────────────────────────────────────────
    let aiDiagnosis: string | undefined
    let aiEnrichmentStrategy: DataHealthResponse['aiEnrichmentStrategy']
    let aiPrediction: string | undefined
    let aiEnrichmentPlan: DataHealthResponse['aiEnrichmentPlan'] | undefined

    try {
      // Build a compact metrics snapshot for the AI prompts
      const metricsSnapshot = {
        overallScore,
        totalRecords,
        totalCompanies,
        totalContacts,
        healthyRecords,
        criticalRecords,
        needsAttention,
        healthBreakdown: { dataCompleteness, contactEnrichment, signalCoverage, relationshipMapping },
        qualityCategories: {
          missingEmails: contactsMissingEmail,
          missingCompanyData: companiesMissingCompanyData,
          staleSignals,
          incompleteStakeholders,
          missingIndustry: companiesMissingIndustry,
          potentialDuplicates: potentialDuplicateContacts,
        },
        dataFreshness: freshnessRows.map(r => ({
          stage: r.lifecycleStage,
          records: r.totalRecords,
          completeness: r.completeness,
        })),
        enrichmentQueueSummary: {
          companiesNeedingEnrichment: companiesNeedingEnrichment.length,
          contactsNeedingEnrichment: contactsNeedingEnrichment.length,
          highPriorityCompanies: companyQueueItems.filter(q => q.priority === 'high').length,
          highPriorityContacts: contactQueueItems.filter(q => q.priority === 'high').length,
        },
        topCompanyItems: companyQueueItems.slice(0, 10).map(q => ({
          name: q.name,
          missing: q.missing,
          priority: q.priority,
          stage: q._lifecycleStage ?? 'unknown',
          id: q.id,
        })),
        topContactItems: contactQueueItems.slice(0, 10).map(q => ({
          name: q.name,
          missing: q.missing,
          priority: q.priority,
          id: q.id,
        })),
      }

      // Run the three AI analyses in parallel
      const [diagnosisResult, strategyResult, predictionResult] = await Promise.allSettled([
        // ── 8a. AI Health Diagnosis ──
        callLLM(
          `You are a senior sales operations analyst writing a data health report for a sales ops manager. Your tone is direct, practical, and action-oriented. You reference specific numbers from the data. You explain the BUSINESS IMPACT of each issue, not just the raw count. You prioritize issues by revenue/pipeline impact.

Rules:
- Reference specific numbers from the metrics
- Explain what each gap prevents the sales team from doing
- Write 2-4 paragraphs, starting with the most critical issue
- Do NOT use markdown headers or bullets — write flowing prose
- Address the reader as "your" (e.g. "your pipeline", "your outreach")
- Be honest but constructive — lead with what matters most`,
          `Analyze this CRM data health snapshot and write a plain-English diagnosis for the sales ops manager:

${JSON.stringify(metricsSnapshot, null, 2)}`
        ),

        // ── 8b. AI Enrichment Strategy ──
        callLLM(
          `You are a data enrichment strategist for a B2B sales CRM. Given data health metrics, produce an actionable enrichment strategy as a JSON array.

Each item must have exactly these fields:
- "priority": one of "Critical", "High", "Medium", "Low"
- "action": a specific, actionable step (e.g. "Enrich the 12 high-priority companies missing industry and domain")
- "reasoning": why this action matters for pipeline revenue and operations
- "estimatedImpact": a concrete estimate of the improvement (e.g. "Could improve data completeness score by ~15 points")

Rules:
- Max 5 actions, ordered by priority
- Reference specific counts and percentages from the metrics
- Focus on actions that have the highest ROI for sales operations
- Consider lifecycle stage — later-stage records are more valuable
- Respond ONLY with a valid JSON array, no other text`,
          `Here is the CRM data health snapshot. Design the optimal enrichment strategy:

${JSON.stringify(metricsSnapshot, null, 2)}`
        ),

        // ── 8c. AI Data Quality Prediction ──
        callLLM(
          `You are a data quality analyst. Based on the current CRM data health metrics, predict what will happen to data quality over the next 30-90 days if no action is taken.

Rules:
- Reference specific numbers from the metrics
- Predict which issues will worsen and why
- Estimate the business cost of inaction (missed outreach, bad segmentation, pipeline blind spots)
- Write 2-3 concise paragraphs
- Be specific and alarming enough to motivate action, but realistic
- Do NOT use markdown formatting — write flowing prose`,
          `Here is the current CRM data health snapshot. Predict the data quality trajectory over the next 30-90 days if no action is taken:

${JSON.stringify(metricsSnapshot, null, 2)}`
        ),
      ])

      // Extract diagnosis
      if (diagnosisResult.status === 'fulfilled' && diagnosisResult.value.trim()) {
        aiDiagnosis = diagnosisResult.value.trim()
      }

      // Extract enrichment strategy
      if (strategyResult.status === 'fulfilled' && strategyResult.value.trim()) {
        const parsed = parseJSONArray<{
          priority: string
          action: string
          reasoning: string
          estimatedImpact: string
        }>(strategyResult.value)
        if (parsed.length > 0) {
          aiEnrichmentStrategy = parsed.slice(0, 5)
        }
      }

      // Extract prediction
      if (predictionResult.status === 'fulfilled' && predictionResult.value.trim()) {
        aiPrediction = predictionResult.value.trim()
      }

      // ── 8d. Build the AI Enrichment Plan (structured, frontend-consumable) ──
      if (aiEnrichmentStrategy && aiEnrichmentStrategy.length > 0) {
        // Group the high-priority company and contact IDs into actionable batches
        const highPriorityCompanyIds = companyQueueItems
          .filter(q => q._missingCount >= 2)
          .slice(0, 15)
          .map(q => q.id)

        const highPriorityContactIds = contactQueueItems
          .filter(q => q._missingCount >= 2)
          .slice(0, 15)
          .map(q => q.id)

        const mediumPriorityCompanyIds = companyQueueItems
          .filter(q => q._missingCount === 1)
          .slice(0, 10)
          .map(q => q.id)

        type EnrichmentBatch = NonNullable<DataHealthResponse['aiEnrichmentPlan']>
        const batches: EnrichmentBatch['batches'] = []

        if (highPriorityCompanyIds.length > 0) {
          batches.push({
            label: `Enrich ${highPriorityCompanyIds.length} high-priority companies`,
            entityType: 'company',
            ids: highPriorityCompanyIds,
            rationale: 'These companies are missing multiple critical fields (industry, domain, size). Completing them will have the highest impact on data completeness and segmentation.',
          })
        }

        if (highPriorityContactIds.length > 0) {
          batches.push({
            label: `Enrich ${highPriorityContactIds.length} high-priority contacts`,
            entityType: 'contact',
            ids: highPriorityContactIds,
            rationale: 'These contacts lack email, title, or phone — blocking outreach sequences and personalization.',
          })
        }

        if (mediumPriorityCompanyIds.length > 0) {
          batches.push({
            label: `Enrich ${mediumPriorityCompanyIds.length} medium-priority companies`,
            entityType: 'company',
            ids: mediumPriorityCompanyIds,
            rationale: 'These companies are missing a single field. Quick wins to push the completeness score higher.',
          })
        }

        const totalEnrichable = highPriorityCompanyIds.length + highPriorityContactIds.length + mediumPriorityCompanyIds.length
        const projectedNewComplete = completeCompanies + highPriorityCompanyIds.length + mediumPriorityCompanyIds.length
        const projectedCompleteness = pct(projectedNewComplete, totalCompanies)
        const projectedNewEnriched = enrichedContacts + highPriorityContactIds.length
        const projectedContactScore = pct(projectedNewEnriched, totalContacts)
        const projectedOverall = Math.round(
          projectedCompleteness * 0.25 +
          projectedContactScore * 0.25 +
          signalCoverage * 0.25 +
          relationshipMapping * 0.25,
        )

        aiEnrichmentPlan = {
          summary: aiEnrichmentStrategy[0]?.action ?? 'Enrich missing data across companies and contacts to improve overall data health.',
          batches,
          estimatedTimeToComplete: `~${Math.ceil(totalEnrichable * 0.5)} minutes with AI-assisted enrichment`,
          projectedScoreAfter: projectedOverall,
        }
      }
    } catch (aiError) {
      // AI analysis failed — log and continue with base metrics only
      console.error('[data-health] AI analysis failed, returning base metrics:', aiError)
    }

    // ────────────────────────────────────────────────
    // 9. Assemble final response
    // ────────────────────────────────────────────────
    const result: DataHealthResponse = {
      ...baseResult,
      ...(aiDiagnosis ? { aiDiagnosis } : {}),
      ...(aiEnrichmentStrategy ? { aiEnrichmentStrategy } : {}),
      ...(aiPrediction ? { aiPrediction } : {}),
      ...(aiEnrichmentPlan ? { aiEnrichmentPlan } : {}),
    }

    // Cache the result
    cachedResult = { data: result, ts: Date.now() }

    return apiSuccess(result)
  } catch (error) {
    console.error('[data-health] Error computing data health metrics:', error)
    return apiError('Failed to compute data health metrics')
  }
}