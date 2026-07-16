import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { formatDistanceToNow } from 'date-fns'

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
}

const NOT_ARCHIVED = { not: 'archived' }

/* ── Helper: compute a 0-100 percentage safely ── */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100)
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
        select: { id: true, normalizedName: true, industry: true, domain: true, sizeRange: true },
        take: 20,
        orderBy: { updatedAt: 'desc' },
      }),

      // Contacts needing enrichment (missing at least 1 key field)
      db.contact.findMany({
        where: {
          status: NOT_ARCHIVED,
          OR: [{ email: '' }, { title: null }, { phone: null }],
        },
        select: { id: true, normalizedName: true, email: true, title: true, phone: true },
        take: 20,
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
    // 5. Enrichment queue (top 10)
    // ────────────────────────────────────────────────
    type QueueItem = DataHealthResponse['enrichmentQueue'][number]

    const companyQueueItems: QueueItem[] = companiesNeedingEnrichment.map((c) => {
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
      }
    })

    const contactQueueItems: QueueItem[] = contactsNeedingEnrichment.map((c) => {
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

    // Merge, sort by most missing fields first, take top 10
    const enrichmentQueue = [...companyQueueItems, ...contactQueueItems]
      .sort((a, b) => (b as any)._missingCount - (a as any)._missingCount)
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
    // 7. Build final response
    // ────────────────────────────────────────────────
    const result: DataHealthResponse = {
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

    // Cache the result
    cachedResult = { data: result, ts: Date.now() }

    return apiSuccess(result)
  } catch (error) {
    console.error('[data-health] Error computing data health metrics:', error)
    return apiError('Failed to compute data health metrics')
  }
}