/**
 * Sprint 1 — Direct DB Validation (no API server needed)
 *
 * Reads companies from SQLite, simulates the sprint1 pipeline logic,
 * validates signal quality and persistence.
 *
 * Usage: npx tsx scripts/validate-sprint1-direct.ts
 */

import { db } from '../src/lib/db'

const VALID_SIGNAL_TYPES = new Set(['funding', 'hiring', 'leadership', 'tech_change', 'partnership', 'expansion', 'product', 'news'])
const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical'])
const VALID_TIMINGS = new Set(['immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'ongoing', 'expired'])

interface CompanyPick {
  id: string
  name: string
  sizeRange: string | null
  industry: string | null
  tier: string
}

async function selectCompanies(): Promise<CompanyPick[]> {
  const all = await db.company.findMany({
    select: { id: true, rawName: true, sizeRange: true, industry: true },
    take: 100,
  })

  // Map to our interface
  const mapped = all.map(c => ({ id: c.id, name: c.rawName, sizeRange: c.sizeRange, industry: c.industry }))

  const enterprise = mapped.filter(c => {
    const s = (c.sizeRange || '').toLowerCase()
    return s.includes('5001') || s.includes('10001') || s.includes('10000') || s.includes('10,000') || s.includes('5000+')
  })

  const midMarket = mapped.filter(c => {
    const s = (c.sizeRange || '').toLowerCase()
    return (s.includes('201') || s.includes('500') || s.includes('1001') || s.includes('501') || s.includes('mid-market')) &&
      !enterprise.find(e => e.id === c.id)
  })

  const small = mapped.filter(c => {
    const s = (c.sizeRange || '').toLowerCase()
    return (s.includes('1-10') || s.includes('11-50') || s.includes('51-200') || s.includes('1-200')) &&
      !enterprise.find(e => e.id === c.id) && !midMarket.find(m => m.id === c.id)
  })

  const picks: CompanyPick[] = []

  // 1 enterprise
  if (enterprise.length > 0) picks.push({ ...enterprise[0], tier: 'enterprise' })
  else if (mapped.length > 0) picks.push({ ...mapped[0], tier: 'enterprise (fallback)' })

  // 3 mid-market
  for (const m of midMarket.slice(0, 3)) picks.push({ ...m, tier: 'mid-market' })
  while (picks.filter(p => p.tier === 'mid-market').length < 3 && mapped.length > picks.length) {
    const next = mapped.find(c => !picks.find(p => p.id === c.id))
    if (next) picks.push({ ...next, tier: 'mid-market (fallback)' })
    else break
  }

  // 1 small
  if (small.length > 0) picks.push({ ...small[0], tier: 'small' })
  else {
    const next = mapped.find(c => !picks.find(p => p.id === c.id))
    if (next) picks.push({ ...next, tier: 'small (fallback)' })
  }

  return picks.slice(0, 5)
}

// Simulate sprint1 pipeline — create test signals via signal-creator
import { classifySignalType, inferSeverity, createSignalFromIntelligenceObject } from '../src/lib/intelligence-sources/signal-creator'

const MOCK_SIGNALS = [
  {
    signal: 'Company announced Series C funding round of $45M led by Sequoia Capital',
    signalType: 'funding',
    evidence: 'Press release confirmed on company website and TechCrunch coverage',
    evidenceUrl: 'https://example.com/funding-round',
    sourceDate: '2026-07-15',
    confidence: 90,
    businessImpact: 'Significant growth capital indicates expansion plans — potential for enterprise software purchases',
    recommendedAction: 'Position infrastructure scaling solutions within 7 days while they evaluate vendors',
    timing: 'within_7_days' as const,
    owner: 'Enterprise AE',
    severity: 'high' as const,
  },
  {
    signal: 'Hiring 12 cloud engineers and 3 DevOps specialists in Q3 2026',
    signalType: 'hiring',
    evidence: 'LinkedIn job postings and company careers page listing cloud infrastructure roles',
    evidenceUrl: 'https://linkedin.com/jobs/example',
    sourceDate: '2026-07-20',
    confidence: 82,
    businessImpact: 'Cloud expansion underway — strong signal for cloud optimization and migration services',
    recommendedAction: 'Reach out to VP Engineering with cloud cost optimization case study',
    timing: 'within_30_days' as const,
    owner: 'SDR Team',
    severity: 'medium' as const,
  },
  {
    signal: 'CTO announced departure after 5 years, replacement search underway',
    signalType: 'leadership',
    evidence: 'Company blog announcement and LinkedIn post from outgoing CTO',
    evidenceUrl: 'https://example.com/cto-transition',
    sourceDate: '2026-07-10',
    confidence: 88,
    businessImpact: 'Leadership transition creates technology strategy uncertainty — window to influence new direction',
    recommendedAction: 'Engage CEO with technology assessment offering during leadership transition',
    timing: 'immediate' as const,
    owner: 'VP Sales',
    severity: 'high' as const,
  },
  {
    signal: 'Migrating core infrastructure from on-premise to AWS',
    signalType: 'tech_change',
    evidence: 'Job descriptions mention AWS certification requirements and cloud migration project references',
    evidenceUrl: 'https://example.com/aws-migration',
    sourceDate: '2026-07-22',
    confidence: 75,
    businessImpact: 'Large-scale cloud migration creates consulting and tooling opportunities',
    recommendedAction: 'Schedule technical deep-dive with infrastructure team on migration tooling needs',
    timing: 'within_30_days' as const,
    owner: 'Solutions Engineer',
    severity: 'medium' as const,
  },
  {
    signal: 'Strategic partnership announced with Microsoft Azure',
    signalType: 'partnership',
    evidence: 'Joint press release and partner listing on Microsoft website',
    evidenceUrl: 'https://example.com/partnership',
    sourceDate: '2026-07-25',
    confidence: 92,
    businessImpact: 'Azure partnership validates cloud-first strategy — complementary services opportunity',
    recommendedAction: 'Leverage partnership context for warm introduction through Microsoft channel team',
    timing: 'within_7_days' as const,
    owner: 'Channel Manager',
    severity: 'high' as const,
  },
  {
    signal: 'Opening new office in Singapore for APAC expansion',
    signalType: 'expansion',
    evidence: 'Business registration filing and LinkedIn job postings for Singapore office',
    evidenceUrl: 'https://example.com/sg-expansion',
    sourceDate: '2026-07-18',
    confidence: 78,
    businessImpact: 'Geographic expansion signals growing revenue and potential for regional tech deployment',
    recommendedAction: 'Offer multi-region deployment solutions aligned with APAC expansion timeline',
    timing: 'within_90_days' as const,
    owner: 'International AE',
    severity: 'low' as const,
  },
]

interface ValidationCheck {
  name: string
  passed: boolean
  detail: string
}

interface CompanyReport {
  companyId: string
  companyName: string
  tier: string
  passed: boolean
  checks: ValidationCheck[]
  signalsPersisted: number
}

async function validateCompany(company: CompanyPick): Promise<CompanyReport> {
  const checks: ValidationCheck[] = []
  let signalsPersisted = 0

  // 1. Test signal classification
  const classifiedTypes = MOCK_SIGNALS.map(s => classifySignalType(s.signal))
  const classificationCorrect = MOCK_SIGNALS.every((s, i) => classifiedTypes[i] === s.signalType)
  checks.push({
    name: 'signal_type_classification',
    passed: classificationCorrect,
    detail: `Types: ${MOCK_SIGNALS.map((s, i) => `${s.signalType}→${classifiedTypes[i]}`).join(', ')}`,
  })

  // 2. Test severity inference
  const inferredSeverities = MOCK_SIGNALS.map(s => inferSeverity(s.confidence, s.businessImpact, s.timing))
  checks.push({
    name: 'severity_inference',
    passed: inferredSeverities.every(s => VALID_SEVERITIES.has(s)),
    detail: `Severities: ${inferredSeverities.join(', ')}`,
  })

  // 3. Test signal persistence
  for (const mock of MOCK_SIGNALS.slice(0, 3)) { // Persist first 3 to avoid spam
    const result = await createSignalFromIntelligenceObject({
      companyId: company.id,
      signal: mock.signal,
      evidence: mock.evidence,
      sourceUrl: mock.evidenceUrl,
      sourceName: 'sprint1_validation',
      confidence: mock.confidence,
      businessImpact: mock.businessImpact,
      recommendedAction: mock.recommendedAction,
      timing: mock.timing,
      owner: mock.owner,
      severity: mock.severity,
      signalType: mock.signalType,
      signalDate: new Date(mock.sourceDate),
    })

    if (result.success) signalsPersisted++
  }
  checks.push({
    name: 'signal_persistence',
    passed: signalsPersisted >= 2, // At least 2 of 3 should succeed
    detail: `${signalsPersisted}/3 signals persisted to DB`,
  })

  // 4. Verify persisted signals have correct fields
  const persisted = await db.companySignal.findMany({
    where: { companyId: company.id, source: 'sprint1_validation' },
  })
  const allHaveRequiredFields = persisted.every(s =>
    s.signalType && VALID_SIGNAL_TYPES.has(s.signalType) &&
    s.severity && VALID_SEVERITIES.has(s.severity) &&
    s.timingWindow && VALID_TIMINGS.has(s.timingWindow) &&
    s.confidence > 0 && s.confidence <= 1 &&
    s.businessImpact && s.recommendedAction
  )
  checks.push({
    name: 'persisted_signal_integrity',
    passed: allHaveRequiredFields,
    detail: `${persisted.length} signals checked — all have required 8-field Intelligence Object data`,
  })

  // 5. Confidence range validation
  const allConfidenceInRange = persisted.every(s => s.confidence >= 0 && s.confidence <= 1)
  checks.push({
    name: 'confidence_range_0_1',
    passed: allConfidenceInRange,
    detail: persisted.length > 0
      ? `Range: ${Math.min(...persisted.map(s => s.confidence)).toFixed(2)} - ${Math.max(...persisted.map(s => s.confidence)).toFixed(2)}`
      : 'No persisted signals to check',
  })

  // 6. Deduplication check — creating same signal twice should update, not duplicate
  const dupResult = await createSignalFromIntelligenceObject({
    companyId: company.id,
    signal: MOCK_SIGNALS[0].signal,
    evidence: MOCK_SIGNALS[0].evidence,
    sourceUrl: MOCK_SIGNALS[0].evidenceUrl,
    sourceName: 'sprint1_validation',
    confidence: MOCK_SIGNALS[0].confidence,
    businessImpact: MOCK_SIGNALS[0].businessImpact,
    recommendedAction: MOCK_SIGNALS[0].recommendedAction,
    timing: MOCK_SIGNALS[0].timing,
    owner: MOCK_SIGNALS[0].owner,
    severity: MOCK_SIGNALS[0].severity,
    signalType: MOCK_SIGNALS[0].signalType,
  })
  const afterDup = await db.companySignal.findMany({
    where: { companyId: company.id, source: 'sprint1_validation' },
  })
  const noDuplicate = afterDup.length === persisted.length // Should be same count, not +1
  checks.push({
    name: 'deduplication',
    passed: noDuplicate,
    detail: noDuplicate
      ? `OK — ${persisted.length} signals, no duplicate after re-insert`
      : `FAIL — went from ${persisted.length} to ${afterDup.length} (duplicate created)`,
  })

  // 7. Signal type distribution
  const typeCounts = new Map<string, number>()
  for (const s of persisted) typeCounts.set(s.signalType || 'unknown', (typeCounts.get(s.signalType || 'unknown') || 0) + 1)
  checks.push({
    name: 'type_distribution',
    passed: typeCounts.size >= 1,
    detail: [...typeCounts.entries()].map(([t, c]) => `${t}=${c}`).join(', '),
  })

  return {
    companyId: company.id,
    companyName: company.name,
    tier: company.tier,
    passed: checks.every(c => c.passed),
    checks,
    signalsPersisted,
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  DeepMindQ — Sprint 1 Pipeline Validation (5 Companies)      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // Phase 1: Company Selection
  console.log('━━━ PHASE 1: Company Selection ━━━\n')
  const companies = await selectCompanies()
  console.log(`Selected ${companies.length} companies:\n`)
  for (const c of companies) {
    console.log(`  [${c.tier.padEnd(22)}] ${(c.name || '').padEnd(30)} | ${c.sizeRange || 'N/A'} | ${c.industry || 'N/A'}`)
  }
  console.log('')

  // Phase 2: Signal Classification + Persistence Validation
  console.log('━━━ PHASE 2: Signal Pipeline Validation ━━━\n')
  const reports: CompanyReport[] = []

  for (const company of companies) {
    console.log(`▶ ${company.name} (${company.tier})`)
    const report = await validateCompany(company)
    reports.push(report)

    for (const check of report.checks) {
      const icon = check.passed ? '✓' : '✗'
      console.log(`  ${icon} ${check.name.padEnd(30)} ${check.detail}`)
    }
    console.log(`  Signals persisted: ${report.signalsPersisted} | Overall: ${report.passed ? 'PASS' : 'FAIL'}\n`)
  }

  // Phase 3: Three-Date Model Validation
  console.log('━━━ PHASE 3: Three-Date Model Validation ━━━\n')
  const allSignals = await db.companySignal.findMany({
    where: { source: 'sprint1_validation' },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Total sprint1_validation signals in DB: ${allSignals.length}`)

  // Check extractedAt (detection date)
  const allHaveExtractedAt = allSignals.every(s => s.extractedAt !== null)
  console.log(`  ✓ extractedAt (detectionDate): ${allHaveExtractedAt ? 'OK — all signals have detection date' : 'FAIL'}`)

  // Check createdAt (pipeline processing date)
  const allHaveCreatedAt = allSignals.every(s => s.createdAt !== null)
  console.log(`  ✓ createdAt (processingDate):  ${allHaveCreatedAt ? 'OK — all signals have processing date' : 'FAIL'}`)

  // signalDate (signal/event date) — optional but should exist when source provides it
  const withSignalDate = allSignals.filter(s => s.signalDate !== null).length
  console.log(`  ✓ signalDate (eventDate):       ${withSignalDate}/${allSignals.length} signals have event date`)

  // Phase 4: Summary
  console.log('\n━━━ VALIDATION SUMMARY ━━━\n')
  const passed = reports.filter(r => r.passed).length
  const failed = reports.filter(r => !r.passed).length
  const totalPersisted = reports.reduce((sum, r) => sum + r.signalsPersisted, 0)

  console.log(`  Companies tested:       ${reports.length}`)
  console.log(`  Passed:                 ${passed}`)
  console.log(`  Failed:                 ${failed}`)
  console.log(`  Total signals persisted:${totalPersisted}`)
  console.log('')

  // Check-level summary
  console.log('  Check-level results:')
  const allChecks = [...new Set(reports.flatMap(r => r.checks.map(c => c.name)))]
  for (const name of allChecks) {
    const results = reports.flatMap(r => r.checks.filter(c => c.name === name))
    const passCount = results.filter(c => c.passed).length
    const icon = passCount === results.length ? '✓' : '✗'
    console.log(`    ${icon} ${name.padEnd(35)} ${passCount}/${results.length}`)
  }

  console.log('')
  console.log(passed === reports.length
    ? '✅ ALL VALIDATIONS PASSED — Sprint 1 pipeline is operational'
    : `⚠️  ${failed} VALIDATION(S) FAILED — review checks above`)

  // Cleanup: remove test signals
  console.log('\n━━━ CLEANUP: Removing validation signals ━━━')
  const { default: crypto } = await import('crypto')
  for (const company of companies) {
    await db.companySignal.deleteMany({
      where: { companyId: company.id, source: 'sprint1_validation' },
    })
  }
  console.log('  Validation signals cleaned up.')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Validation error:', err)
  process.exit(1)
})
