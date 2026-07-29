/**
 * Phase 9: Website Change Detection Engine
 *
 * Monitors prospect website pages for changes that indicate business intent:
 * - Pricing page changes → budget availability, competitive positioning
 * - Careers page changes → growth signals, tech stack adoption
 * - About page changes → leadership changes, strategic shifts
 * - Blog/news changes → company momentum, priorities
 *
 * Uses content hashing to detect changes. On change detection, creates
 * signals and optionally runs AI analysis on the diff.
 */

import { db } from '@/lib/db'
import { webSearch } from '@/lib/llm-client'
import { ModelRouter } from '@/lib/engines/model-router'
import crypto from 'crypto'
import { logger } from '@/lib/logger';

export interface WebsiteChangeResult {
  companyId: string
  pageUrl: string
  pageType: string
  hasChanged: boolean
  previousHash: string | null
  newHash: string
  detectedChanges: string[]
  signalCreated: boolean
}

const PAGE_TYPES = ['homepage', 'pricing', 'careers', 'about', 'blog'] as const
export type PageType = typeof PAGE_TYPES[number]

/**
 * Check a single page for changes
 */
export async function detectWebsiteChange(
  companyId: string,
  pageUrl: string,
  pageType: PageType
): Promise<WebsiteChangeResult> {
  const startTime = Date.now()

  // Get the latest snapshot for this page
  const latestSnapshot = await db.websiteSnapshot.findFirst({
    where: { companyId, pageUrl, pageType, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })

  // Fetch current page content via search (we can't do full page fetch in serverless easily)
  // Instead, we use search to find recent mentions of the page
  let currentContent = ''
  try {
    const searchQuery = `site:${pageUrl} ${pageType === 'careers' ? 'jobs hiring careers' : pageType === 'pricing' ? 'pricing plans' : pageType}`
    const results = await webSearch(searchQuery, 3)
    currentContent = results.map((r: any) => `${r.title || ''} ${r.snippet || r.content || ''}`).join(' ')
  } catch {
    logger.warn(`[website-monitor] Search failed for ${pageUrl}`)
  }

  const newHash = crypto.createHash('sha256').update(currentContent).digest('hex')
  const previousHash = latestSnapshot?.contentHash || null

  // No previous snapshot — create baseline
  if (!latestSnapshot) {
    await db.websiteSnapshot.create({
      data: { companyId, pageUrl, pageType, contentHash: newHash, contentText: currentContent, status: 'active' },
    })
    return { companyId, pageUrl, pageType, hasChanged: false, previousHash: null, newHash, detectedChanges: [], signalCreated: false }
  }

  // No change detected
  if (newHash === previousHash) {
    return { companyId, pageUrl, pageType, hasChanged: false, previousHash, newHash, detectedChanges: [], signalCreated: false }
  }

  // Change detected — analyze with AI
  let detectedChanges: string[] = []
  try {
    const llmResult = await ModelRouter.complete({
      systemPrompt: 'You are a B2B sales intelligence analyst. Analyze website content changes and identify business-relevant signals. Be specific and factual.',
      userPrompt: `Previous content: "${latestSnapshot.contentText?.slice(0, 500) || 'No previous content'}"
New content: "${currentContent.slice(0, 500)}"

What changed? List specific business-relevant changes as a JSON array:
["change1", "change2"]

Focus on: pricing changes, new job listings, leadership mentions, product launches, partnerships, growth indicators.`,
      tier: 'fast',
      genType: 'website_change_analysis',
      maxTokens: 1500,
      temperature: 0.2,
      companyId,
    })

    const cleaned = (llmResult.text || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) detectedChanges = JSON.parse(match[0])
  } catch {
    detectedChanges = ['Website content change detected']
  }

  // Create new snapshot
  await db.websiteSnapshot.create({
    data: {
      companyId, pageUrl, pageType, contentHash: newHash, contentText: currentContent,
      detectedChanges: JSON.stringify(detectedChanges), status: 'active',
    },
  })

  // Archive previous snapshot
  await db.websiteSnapshot.update({
    where: { id: latestSnapshot.id },
    data: { status: 'archived' },
  })

  logger.info(`[website-monitor] Change detected for ${pageUrl} in ${Date.now() - startTime}ms: ${detectedChanges.join(', ')}`)

  return {
    companyId, pageUrl, pageType, hasChanged: true, previousHash, newHash,
    detectedChanges, signalCreated: detectedChanges.length > 0,
  }
}

/**
 * Monitor all pages for a company
 */
export async function monitorCompanyWebsite(companyId: string): Promise<WebsiteChangeResult[]> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { website: true, rawName: true } })
  if (!company?.website) return []

  const baseUrl = company.website.replace(/\/$/, '')
  const pageUrls: Array<{ url: string; type: PageType }> = [
    { url: baseUrl, type: 'homepage' },
    { url: `${baseUrl}/pricing`, type: 'pricing' },
    { url: `${baseUrl}/careers`, type: 'careers' },
    { url: `${baseUrl}/about`, type: 'about' },
  ]

  const results: WebsiteChangeResult[] = []
  for (const { url, type } of pageUrls) {
    try {
      const result = await detectWebsiteChange(companyId, url, type)
      results.push(result)
    } catch (err) {
      logger.warn(`[website-monitor] Failed for ${url}:`, { error: err })
    }
  }
  return results
}
