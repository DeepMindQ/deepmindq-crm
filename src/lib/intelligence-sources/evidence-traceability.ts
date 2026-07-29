/**
 * Phase 9: Evidence Traceability Layer
 *
 * Ensures every AI-generated recommendation can be traced back to actual
 * database records (signals, evidence, contacts, notes, events).
 *
 * Post-processes LLM output to:
 * 1. Replace AI-fabricated evidence references with real DB record IDs
 * 2. Add sourceIds array to every action output
 * 3. Flag unverifiable claims with [Unverified] tag
 */

import { db } from '@/lib/db'

export interface TraceableActionOutput {
  content: Record<string, unknown>
  sourceIds: string[]
  unverifiableClaims: string[]
  confidenceAdjustment: number // 0-1, lowered if unverifiable claims found
}

interface DataSource {
  id: string
  type: 'signal' | 'evidence' | 'contact_note' | 'company_note' | 'email_event' | 'timeline_event'
  snippet: string
  relevance: number // 0-1
}

/**
 * Build a context map of all available data sources for a company.
 * Used to verify AI claims against actual data.
 */
export async function buildDataSourceMap(companyId: string): Promise<DataSource[]> {
  const sources: DataSource[] = []

  // Get signals
  const signals = await db.companySignal.findMany({
    where: { companyId, status: 'active' },
    select: { id: true, title: true, signalType: true, confidence: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  for (const s of signals) {
    sources.push({ id: s.id, type: 'signal', snippet: s.title, relevance: s.confidence })
  }

  // Get evidence
  const evidence = await db.evidence.findMany({
    where: { companyId, status: { in: ['active', 'aging'] } },
    select: { id: true, snippet: true, relevanceScore: true, sourceTitle: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  for (const e of evidence) {
    sources.push({
      id: e.id,
      type: 'evidence',
      snippet: `${e.sourceTitle ? `[${e.sourceTitle}] ` : ''}${e.snippet}`,
      relevance: e.relevanceScore,
    })
  }

  // Get contact notes
  const contactNotes = await db.contactNote.findMany({
    where: { contact: { companyId } },
    select: { id: true, body: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  for (const n of contactNotes) {
    sources.push({ id: n.id, type: 'contact_note', snippet: n.body.slice(0, 200), relevance: 0.8 })
  }

  // Get company notes
  const companyNotes = await db.companyNote.findMany({
    where: { companyId },
    select: { id: true, body: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  for (const n of companyNotes) {
    sources.push({ id: n.id, type: 'company_note', snippet: n.body.slice(0, 200), relevance: 0.8 })
  }

  // Get timeline events
  const timelineEvents = await db.companyTimelineEvent.findMany({
    where: { companyId },
    select: { id: true, description: true, eventType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  for (const e of timelineEvents) {
    sources.push({ id: e.id, type: 'timeline_event', snippet: `[${e.eventType}] ${e.description}`, relevance: 0.7 })
  }

  // Get email events
  const emailEvents = await db.emailEvent.findMany({
    where: { contact: { companyId } },
    select: { id: true, eventType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  for (const e of emailEvents) {
    sources.push({ id: e.id, type: 'email_event', snippet: `[${e.eventType}]`, relevance: 0.7 })
  }

  return sources.sort((a, b) => b.relevance - a.relevance)
}

/**
 * Trace AI output against available data sources.
 * Returns matched source IDs and flags unverifiable claims.
 */
export function traceOutputAgainstSources(
  aiOutput: string,
  dataSources: DataSource[]
): TraceableActionOutput {
  const matchedSources: DataSource[] = []
  const unverifiableClaims: string[] = []
  const aiOutputLower = aiOutput.toLowerCase()

  // Extract factual claims from AI output
  const claimPatterns = [
    /(?:announced|launched|raised|acquired|hired|appointed|changed|signed|partnered with|migrated to|adopted|deployed)\s+(.{20,80})/gi,
    /\$[\d.]+[MBK]/gi, // Dollar amounts
    /\d{1,2}%\s+(?:increase|decrease|growth|revenue)/gi, // Percentages
  ]

  const claims: string[] = []
  for (const pattern of claimPatterns) {
    const matches = aiOutput.match(pattern)
    if (matches) claims.push(...matches)
  }

  // Try to match each claim against data sources
  for (const claim of claims) {
    const claimLower = claim.toLowerCase()
    let matched = false

    for (const source of dataSources) {
      // Check for significant word overlap
      const claimWords = claimLower.split(/\s+/).filter(w => w.length > 3)
      const sourceWords = source.snippet.toLowerCase().split(/\s+/)
      const overlap = claimWords.filter(w => sourceWords.includes(w))

      if (overlap.length >= 2 && overlap.length / claimWords.length >= 0.4) {
        if (!matchedSources.find(s => s.id === source.id)) {
          matchedSources.push(source)
        }
        matched = true
        break
      }
    }

    if (!matched && claim.length > 15) {
      unverifiableClaims.push(claim.trim())
    }
  }

  // Calculate confidence adjustment
  const totalClaims = claims.length || 1
  const verifiedRatio = matchedSources.length / totalClaims
  const confidenceAdjustment = Math.min(0.2, (1 - verifiedRatio) * 0.3)

  return {
    content: {}, // Caller should merge this with their own output
    sourceIds: matchedSources.map(s => s.id),
    unverifiableClaims,
    confidenceAdjustment,
  }
}

/**
 * Build evidence context string for LLM prompts
 * This helps the AI reference actual data instead of fabricating
 */
export function buildEvidenceContextForPrompt(dataSources: DataSource[]): string {
  const lines: string[] = []
  lines.push('=== EVIDENCE FROM DATABASE (use ONLY these as evidence sources) ===')

  const signals = dataSources.filter(s => s.type === 'signal')
  if (signals.length > 0) {
    lines.push('\n[Signals]:')
    for (const s of signals.slice(0, 15)) {
      lines.push(`  - Signal ${s.id}: ${s.snippet}`)
    }
  }

  const evidence = dataSources.filter(s => s.type === 'evidence')
  if (evidence.length > 0) {
    lines.push('\n[Evidence]:')
    for (const e of evidence.slice(0, 15)) {
      lines.push(`  - Evidence ${e.id}: ${e.snippet}`)
    }
  }

  const notes = dataSources.filter(s => s.type === 'contact_note' || s.type === 'company_note')
  if (notes.length > 0) {
    lines.push('\n[Internal Notes]:')
    for (const n of notes.slice(0, 10)) {
      lines.push(`  - Note ${n.id} (${n.type}): ${n.snippet}`)
    }
  }

  const events = dataSources.filter(s => s.type === 'timeline_event' || s.type === 'email_event')
  if (events.length > 0) {
    lines.push('\n[Events]:')
    for (const e of events.slice(0, 10)) {
      lines.push(`  - Event ${e.id}: ${e.snippet}`)
    }
  }

  lines.push('\n=== END EVIDENCE ===')
  lines.push('\nCRITICAL: Only reference evidence from the database above. If you cannot support a claim with evidence, prefix it with [Unverified].')

  return lines.join('\n')
}
