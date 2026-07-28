/**
 * Sprint 1 — 5-Company Validation Script
 *
 * Selects 1 enterprise, 3 mid-market, 1 small company from DB,
 * calls POST /api/intelligence/sprint1 for each, and validates results.
 *
 * Usage: npx tsx scripts/validate-sprint1.ts
 */

import { db } from '../src/lib/db'

// ─── Company Selection ─────────────────────────────────────────────

interface CompanyPick {
  id: string
  name: string
  sizeRange: string | null
  industry: string | null
  tier: 'enterprise' | 'mid-market' | 'small'
}

async function selectCompanies(): Promise<CompanyPick[]> {
  // Enterprise: sizeRange suggests >5000 employees
  const enterprise = await db.company.findFirst({
    where: {
      OR: [
        { sizeRange: { contains: '5000', mode: 'insensitive' } },
        { sizeRange: { contains: '10000', mode: 'insensitive' } },
        { sizeRange: { contains: '10,000', mode: 'insensitive' } },
        { sizeRange: { contains: '5001', mode: 'insensitive' } },
      ],
    },
    orderBy: { intelligenceScore: 'desc' },
  })

  // Mid-market: 200-5000 employees
  const midMarkets = await db.company.findMany({
    where: {
      OR: [
        { sizeRange: { contains: '201', mode: 'insensitive' } },
        { sizeRange: { contains: '500', mode: 'insensitive' } },
        { sizeRange: { contains: '1000', mode: 'insensitive' } },
        { sizeRange: { contains: '200-500', mode: 'insensitive' } },
        { sizeRange: { contains: '501-1000', mode: 'insensitive' } },
        { sizeRange: { contains: '1001-5000', mode: 'insensitive' } },
        { sizeRange: { contains: 'mid-market', mode: 'insensitive' } },
        { sizeRange: { contains: 'Mid-Market', mode: 'insensitive' } },
      ],
    },
    orderBy: { intelligenceScore: 'desc' },
    take: 3,
  })

  // Small: <200 employees
  const small = await db.company.findFirst({
    where: {
      OR: [
        { sizeRange: { contains: '1-10', mode: 'insensitive' } },
        { sizeRange: { contains: '11-50', mode: 'insensitive' } },
        { sizeRange: { contains: '51-200', mode: 'insensitive' } },
        { sizeRange: { contains: 'Small', mode: 'insensitive' } },
        { sizeRange: { contains: 'small', mode: 'insensitive' } },
      ],
    },
    orderBy: { intelligenceScore: 'desc' },
  })

  const picks: CompanyPick[] = []

  if (enterprise) {
    picks.push({ ...enterprise, tier: 'enterprise' })
  } else {
    console.warn('[WARN] No enterprise company found, picking first available')
    const fallback = await db.company.findFirst({ orderBy: { intelligenceScore: 'desc' } })
    if (fallback) picks.push({ ...fallback, tier: 'enterprise' })
  }

  for (const m of midMarkets) {
    if (!picks.find(p => p.id === m.id)) {
      picks.push({ ...m, tier: 'mid-market' })
    }
  }

  if (small) {
    if (!picks.find(p => p.id === small.id)) {
      picks.push({ ...small, tier: 'small' })
    }
  } else {
    console.warn('[WARN] No small company found')
  }

  // Deduplicate ids for mid-market gap fill
  while (picks.length < 5) {
    const existing = picks.map(p => p.id)
    const next = await db.company.findFirst({
      where: { id: { notIn: existing } },
      orderBy: { intelligenceScore: 'desc' },
    })
    if (!next) break
    picks.push({ ...next, tier: 'mid-market' })
  }

  return picks
}

// ─── Sprint1 Pipeline Call ────────────────────────────────────────

interface Sprint1Result {
  company: { id: string; name: string; industry: string | null; domain: string | null; sizeRange: string | null; country: string | null }
  reasoning: string
  signals: Array<{
    rank: number
    signal: string
    signalType: string
    severity: string
    confidence: number
    businessImpact: string
    recommendedAction: string
    timing: string
    owner: string
    evidence: string
    evidenceUrl: string
    sourceDate: string
    signalId?: string
  }>
  meta: {
    webSourcesFetched: number
    aiModelUsed: boolean
    signalsCreated: number
    signalsUpdated: number
    pipelineLatencyMs: number
    searchQueries: string[]
  }
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

async function runSprint1(companyId: string): Promise<Sprint1Result | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/intelligence/sprint1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`  [ERROR] HTTP ${res.status}: ${text.substring(0, 200)}`)
      return null
    }

    return await res.json() as Sprint1Result
  } catch (err) {
    console.error(`  [ERROR] Fetch failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Validation Checks ────────────────────────────────────────────

interface ValidationReport {
  companyId: string
  companyName: string
  tier: string
  passed: boolean
  checks: Array<{ name: string; passed: boolean; detail: string }>
  latencyMs: number
  signalCount: number
}

function validate(result: Sprint1Result, tier: string): ValidationReport {
  const checks: ValidationReport['checks'] = []

  // Check 1: Reasoning present and non-empty
  checks.push({
    name: 'reasoning_present',
    passed: !!result.reasoning && result.reasoning.length > 10,
    detail: result.reasoning ? `OK (${result.reasoning.length} chars)` : 'MISSING or too short',
  })

  // Check 2: Signals array present
  checks.push({
    name: 'signals_array',
    passed: Array.isArray(result.signals),
    detail: Array.isArray(result.signals) ? `OK (${result.signals.length} signals)` : 'NOT an array',
  })

  // Check 3: Signal type classification
  const validTypes = new Set(['funding', 'hiring', 'leadership', 'tech_change', 'partnership', 'expansion', 'product', 'news'])
  const allTypesValid = result.signals.every(s => validTypes.has(s.signalType))
  const typeCounts = new Map<string, number>()
  for (const s of result.signals) typeCounts.set(s.signalType, (typeCounts.get(s.signalType) || 0) + 1)
  checks.push({
    name: 'signal_type_classification',
    passed: allTypesValid && result.signals.length > 0,
    detail: allTypesValid
      ? `OK (${[...typeCounts.entries()].map(([t, c]) => `${t}=${c}`).join(', ')})`
      : `FAIL — invalid types found`,
  })

  // Check 4: Confidence range 0-100
  const allConfidenceValid = result.signals.every(s => s.confidence >= 0 && s.confidence <= 100)
  const avgConfidence = result.signals.length > 0
    ? Math.round(result.signals.reduce((sum, s) => sum + s.confidence, 0) / result.signals.length)
    : 0
  checks.push({
    name: 'confidence_range',
    passed: allConfidenceValid,
    detail: `avg=${avgConfidence}, range=[${result.signals.length > 0 ? Math.min(...result.signals.map(s => s.confidence)) : 'N/A'}-${result.signals.length > 0 ? Math.max(...result.signals.map(s => s.confidence)) : 'N/A'}]`,
  })

  // Check 5: Business impact present
  const allImpactPresent = result.signals.every(s => s.businessImpact && s.businessImpact.length > 3)
  checks.push({
    name: 'business_impact',
    passed: allImpactPresent,
    detail: allImpactPresent ? 'OK' : 'FAIL — some signals missing businessImpact',
  })

  // Check 6: Recommended action present
  const allActionPresent = result.signals.every(s => s.recommendedAction && s.recommendedAction.length > 3)
  checks.push({
    name: 'recommended_action',
    passed: allActionPresent,
    detail: allActionPresent ? 'OK' : 'FAIL — some signals missing recommendedAction',
  })

  // Check 7: Timing window valid
  const validTimings = new Set(['immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'ongoing', 'expired'])
  const allTimingValid = result.signals.every(s => validTimings.has(s.timing))
  checks.push({
    name: 'timing_window',
    passed: allTimingValid,
    detail: allTimingValid ? 'OK' : 'FAIL — invalid timing values',
  })

  // Check 8: Severity classification
  const validSeverities = new Set(['low', 'medium', 'high', 'critical'])
  const allSeverityValid = result.signals.every(s => validSeverities.has(s.severity))
  checks.push({
    name: 'severity_classification',
    passed: allSeverityValid,
    detail: allSeverityValid ? 'OK' : 'FAIL — invalid severity values',
  })

  // Check 9: Meta data present
  checks.push({
    name: 'meta_complete',
    passed: !!result.meta && result.meta.pipelineLatencyMs > 0,
    detail: result.meta ? `latency=${result.meta.pipelineLatencyMs}ms, webSources=${result.meta.webSourcesFetched}` : 'MISSING',
  })

  // Check 10: Signal ranking (1-based, no gaps)
  const ranks = result.signals.map(s => s.rank).sort((a, b) => a - b)
  const ranksValid = ranks.length === 0 || (ranks[0] === 1 && ranks.every((r, i) => r === i + 1))
  checks.push({
    name: 'signal_ranking',
    passed: ranksValid,
    detail: ranksValid ? `OK (${ranks.length} ranked)` : `FAIL — ranks: [${ranks.join(', ')}]`,
  })

  return {
    companyId: result.company.id,
    companyName: result.company.name,
    tier,
    passed: checks.every(c => c.passed),
    checks,
    latencyMs: result.meta.pipelineLatencyMs,
    signalCount: result.signals.length,
  }
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('=== Sprint 1 — 5-Company Validation ===\n')

  // Step 1: Select companies
  console.log('[1] Selecting companies from database...')
  const companies = await selectCompanies()
  console.log(`    Found ${companies.length} companies:\n`)

  for (const c of companies) {
    console.log(`    ${c.tier.padEnd(12)} | ${c.name.padEnd(35)} | ${c.sizeRange || 'N/A'} | ${c.industry || 'N/A'}`)
  }
  console.log('')

  // Step 2: Run sprint1 pipeline for each
  console.log('[2] Running Sprint 1 pipeline...\n')
  const reports: ValidationReport[] = []

  for (const company of companies) {
    console.log(`  → Processing: ${company.name} (${company.tier})`)
    const result = await runSprint1(company.id)

    if (!result) {
      console.log(`    FAILED — no response from pipeline\n`)
      reports.push({
        companyId: company.id,
        companyName: company.name,
        tier: company.tier,
        passed: false,
        checks: [{ name: 'pipeline_response', passed: false, detail: 'No response received' }],
        latencyMs: 0,
        signalCount: 0,
      })
      continue
    }

    const report = validate(result, company.tier)
    reports.push(report)

    // Print summary
    for (const check of report.checks) {
      const icon = check.passed ? '✓' : '✗'
      console.log(`    ${icon} ${check.name.padEnd(28)} ${check.detail}`)
    }
    console.log(`    Latency: ${report.latencyMs}ms | Signals: ${report.signalCount} | Overall: ${report.passed ? 'PASS' : 'FAIL'}`)
    console.log('')
  }

  // Step 3: Summary
  console.log('=== VALIDATION SUMMARY ===\n')
  const passed = reports.filter(r => r.passed).length
  const failed = reports.filter(r => !r.passed).length
  const totalSignals = reports.reduce((sum, r) => sum + r.signalCount, 0)
  const avgLatency = reports.length > 0 ? Math.round(reports.reduce((sum, r) => sum + r.latencyMs, 0) / reports.length) : 0

  console.log(`  Companies tested: ${reports.length}`)
  console.log(`  Passed: ${passed} | Failed: ${failed}`)
  console.log(`  Total signals extracted: ${totalSignals}`)
  console.log(`  Average pipeline latency: ${avgLatency}ms`)
  console.log('')

  // Check-level summary
  const allCheckNames = [...new Set(reports.flatMap(r => r.checks.map(c => c.name)))]
  for (const name of allCheckNames) {
    const results = reports.flatMap(r => r.checks.filter(c => c.name === name))
    const passCount = results.filter(c => c.passed).length
    console.log(`  ${name}: ${passCount}/${results.length} passed`)
  }

  console.log('')
  console.log(passed === reports.length ? 'ALL VALIDATIONS PASSED' : `${failed} VALIDATION(S) FAILED`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Validation script error:', err)
  process.exit(1)
})
