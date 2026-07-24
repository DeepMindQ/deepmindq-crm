/**
 * Wave 8A Unit Tests — Intelligence Object + Quality Gates
 * 
 * Run: npx tsx scripts/wave8a-tests.ts
 */

// ── Test Framework (minimal) ────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual === expected) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// ── Intelligence Object Tests ───────────────────────────────────────────

console.log('\n═══ Intelligence Object Framework Tests ═══')

import {
  validateIntelligenceObject,
  intelligenceObjectCompleteness,
  normalizeIntelligenceObject,
  companySignalToIntelligenceObject,
} from '../src/lib/ai-copilot/intelligence-object'

// Test 1: validateIntelligenceObject — valid object
const validObj = {
  signal: 'Company hired 10 engineers for cloud migration',
  evidence: { sourceUrl: 'https://example.com/news', sourceName: 'TechCrunch', snippet: 'Acme Corp is hiring...' },
  confidence: 85,
  businessImpact: 'High — cloud migration budget indicated',
  recommendedAction: 'Position cloud assessment',
  timing: 'within_7_days',
  owner: 'Enterprise AE',
  expiresAt: '2026-09-15',
}
const validIssues = validateIntelligenceObject(validObj)
assert(validIssues.length === 0, 'Valid Intelligence Object passes validation with 0 issues')

// Test 2: validateIntelligenceObject — missing fields
const incompleteObj = { signal: 'Some signal' }
const incompleteIssues = validateIntelligenceObject(incompleteObj)
assert(incompleteIssues.length > 0, `Incomplete object has ${incompleteIssues.length} issues`)
assert(incompleteIssues.some(i => i.includes('evidence')), 'Detects missing evidence')
assert(incompleteIssues.some(i => i.includes('confidence')), 'Detects missing confidence')
assert(incompleteIssues.some(i => i.includes('businessImpact')), 'Detects missing businessImpact')
assert(incompleteIssues.some(i => i.includes('timing')), 'Detects missing timing')

// Test 3: intelligenceObjectCompleteness
assertEqual(intelligenceObjectCompleteness(validObj), 8, 'Complete object scores 8/8')
assertEqual(intelligenceObjectCompleteness({ signal: 'x' }), 1, 'Only signal = 1/8')
assertEqual(intelligenceObjectCompleteness({}), 0, 'Empty object = 0/8')

// Test 4: normalizeIntelligenceObject — fills defaults
const raw = { signal: 'Test', evidence: { sourceUrl: '', sourceName: '', snippet: '' }, confidence: 75 }
const normalized = normalizeIntelligenceObject(raw)
assertEqual(normalized.timing, 'within_30_days', 'Default timing is within_30_days')
assertEqual(normalized.owner, 'Unassigned', 'Default owner is Unassigned')
assertEqual(normalized.businessImpact, 'Not assessed', 'Default businessImpact is Not assessed')
assertEqual(normalized.confidence, 75, 'Confidence preserved')

// Test 5: companySignalToIntelligenceObject — maps DB record
const dbSignal = {
  title: 'Hiring spree',
  description: 'Hiring 20 engineers',
  source: 'LinkedIn',
  sourceUrl: 'https://linkedin.com',
  confidence: 0.85,
  severity: 'high',
  impact: 'high',
  signalDate: new Date('2026-06-01'),
  businessImpact: 'Major growth signal',
  recommendedAction: 'Call CTO immediately',
  timingWindow: 'within_7_days',
  expiresAt: new Date('2026-09-01'),
}
const mapped = companySignalToIntelligenceObject(dbSignal)
assert(mapped.signal.includes('Hiring spree'), 'Signal includes title')
assertEqual(mapped.confidence, 85, 'Confidence converted from 0-1 to 0-100')
assertEqual(mapped.timing, 'within_7_days', 'Timing preserved from DB')
assert(mapped.evidence.sourceUrl === 'https://linkedin.com', 'Evidence URL mapped')

// Test 6: companySignalToIntelligenceObject — derives from severity
const noTiming = { ...dbSignal, timingWindow: null, businessImpact: null, recommendedAction: null }
const derived = companySignalToIntelligenceObject(noTiming)
assertEqual(derived.timing, 'within_7_days', 'Timing derived from high severity')
assert(derived.businessImpact.includes('High'), 'Business impact derived from impact field')

// ── Quality Gates Tests ──────────────────────────────────────────────────

console.log('\n═══ Quality Gates Tests ═══')

import {
  evidenceCheck,
  hallucinationCheck,
  specificityCheck,
  runQualityGates,
  meetsMinimumQuality,
} from '../src/lib/ai-copilot/quality-gates'

// Test 7: evidenceCheck — good evidence
const goodEvidence = {
  signal: 'Test',
  evidence: { sourceUrl: 'https://example.com/article', sourceName: 'TechCrunch', snippet: 'This is a detailed article about cloud migration trends in 2026.' },
  confidence: 80,
}
const evResult = evidenceCheck(goodEvidence)
assertEqual(evResult.status, 'pass', 'Good evidence passes')
assert(evResult.score >= 70, `Evidence score ${evResult.score} >= 70`)

// Test 8: evidenceCheck — no evidence
const noEvidence = { signal: 'Test' }
const noEvResult = evidenceCheck(noEvidence)
assertEqual(noEvResult.status, 'fail', 'No evidence fails')

// Test 9: evidenceCheck — partial evidence (URL only, no name or snippet)
const partialEvidence = {
  signal: 'Test',
  evidence: { sourceUrl: 'https://example.com', sourceName: '', snippet: '' },
  confidence: 80,
}
const partialEvResult = evidenceCheck(partialEvidence)
assertEqual(partialEvResult.status, 'fail', 'Partial evidence (URL only) gives fail — score < 40')

// Test 10: hallucinationCheck — high confidence
const highConf = { signal: 'Specific claim about company cloud migration to AWS', confidence: 90, evidence: { sourceUrl: 'https://real-source.com' } }
const hallPass = hallucinationCheck(highConf)
assertEqual(hallPass.status, 'pass', 'High confidence + specific language passes hallucination check')

// Test 11: hallucinationCheck — low confidence + hedging
const lowConf = { signal: 'Company may possibly be considering some kind of cloud migration perhaps', confidence: 35, evidence: {} }
const hallFail = hallucinationCheck(lowConf)
assertEqual(hallFail.status, 'fail', 'Low confidence + hedging fails hallucination check')

// Test 12: specificityCheck — specific entities
const specific = { signal: 'Acme Corp hired 15 AWS engineers in Q2 2026, investing $5M in cloud infrastructure (30% increase YoY)' }
const specPass = specificityCheck(specific)
assertEqual(specPass.status, 'pass', 'Specific entities pass specificity check')
assert(specPass.details.includes('AWS') || specPass.details.includes('$5M'), 'Detects named entities')

// Test 13: specificityCheck — vague
const vague = { signal: 'Something might be happening at the company' }
const specFail = specificityCheck(vague)
assertEqual(specFail.status, 'fail', 'Vague output fails specificity check')

// Test 14: runQualityGates — composite
const composite = runQualityGates({
  signal: 'Acme Corp hired 15 AWS engineers in Q2 2026, investing $5M in cloud infrastructure',
  evidence: { sourceUrl: 'https://techcrunch.com/acme-hiring', sourceName: 'TechCrunch', snippet: 'Acme Corp announced plans to hire 15 engineers specialized in AWS cloud services.' },
  confidence: 88,
  businessImpact: 'High — $5M cloud budget confirmed',
  recommendedAction: 'Schedule technical assessment with CTO',
  timing: 'within_7_days',
  owner: 'Enterprise AE — West',
  expiresAt: '2026-09-15',
})
assert(['pass', 'requires_review'].includes(composite.overallStatus), `Overall status: ${composite.overallStatus}`)
assert(composite.overallScore > 50, `Overall score ${composite.overallScore} > 50`)
assertEqual(composite.objectCompleteness, 8, 'Completeness is 8/8')

// Test 15: meetsMinimumQuality
const completeIntObj = {
  signal: 'Acme Corp hired 15 AWS engineers in Q2 2026, investing $5M in cloud infrastructure',
  evidence: { sourceUrl: 'https://techcrunch.com/acme-hiring', sourceName: 'TechCrunch', snippet: 'Acme Corp announced plans to hire 15 engineers specialized in AWS cloud services.' },
  confidence: 88,
  businessImpact: 'High — $5M cloud budget confirmed',
  recommendedAction: 'Schedule technical assessment with CTO',
  timing: 'within_7_days',
  owner: 'Enterprise AE — West',
  expiresAt: '2026-09-15',
}
assert(meetsMinimumQuality(completeIntObj) === true, 'Complete quality object meets minimum')
assert(meetsMinimumQuality({ signal: 'x' }) === false, 'Minimal object does NOT meet minimum')

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`)
if (failed > 0) {
  process.exit(1)
}
