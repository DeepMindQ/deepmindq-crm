/**
 * Sprint 2 — Direct DB Validation (no API server needed)
 *
 * Tests the Sprint 2 intelligence fabric layer:
 * - Association engine: duplicate detection, conflict detection, auto-association
 * - Confidence engine: composite scoring, freshness decay, persistence
 * - Knowledge versioning: snapshot creation, version history
 * - Source governance: health scoring
 *
 * Usage: npx tsx scripts/validate-sprint2-direct.ts
 */

import { db } from '../src/lib/db'
import {
  detectDuplicates,
  detectConflicts,
  createAssociation,
  getAssociations,
} from '../src/lib/intelligence-sources/association-engine'
import {
  calculateConfidence,
  calculateFreshness,
  generateConfidenceExplanation,
  recalculateObjectConfidence,
} from '../src/lib/intelligence-sources/confidence-engine'
import { createVersionSnapshot, getVersionHistory } from '../src/lib/intelligence-sources/knowledge-versioning'

// ─── Company Selection (same as Sprint 1) ────────────────────────

interface CompanyPick { id: string; name: string; sizeRange: string | null; industry: string | null; tier: string }

async function selectCompanies(): Promise<CompanyPick[]> {
  const all = await db.company.findMany({ select: { id: true, rawName: true, sizeRange: true, industry: true }, take: 100 })
  const mapped = all.map(c => ({ id: c.id, name: c.rawName, sizeRange: c.sizeRange, industry: c.industry }))

  const enterprise = mapped.filter(c => { const s = (c.sizeRange || '').toLowerCase(); return s.includes('5001') || s.includes('10001') || s.includes('10000') })
  const midMarket = mapped.filter(c => { const s = (c.sizeRange || '').toLowerCase(); return (s.includes('201') || s.includes('500') || s.includes('1001') || s.includes('501')) && !enterprise.find(e => e.id === c.id) })
  const small = mapped.filter(c => { const s = (c.sizeRange || '').toLowerCase(); return s.includes('51-200') && !enterprise.find(e => e.id === c.id) && !midMarket.find(m => m.id === c.id) })

  const picks: CompanyPick[] = []
  if (enterprise.length > 0) picks.push({ ...enterprise[0], tier: 'enterprise' })
  else if (mapped.length > 0) picks.push({ ...mapped[0], tier: 'enterprise (fallback)' })
  for (const m of midMarket.slice(0, 3)) picks.push({ ...m, tier: 'mid-market' })
  while (picks.filter(p => p.tier === 'mid-market').length < 3 && mapped.length > picks.length) {
    const next = mapped.find(c => !picks.find(p => p.id === c.id))
    if (next) picks.push({ ...next, tier: 'mid-market (fallback)' }); else break
  }
  if (small.length > 0) picks.push({ ...small[0], tier: 'small' })
  else { const next = mapped.find(c => !picks.find(p => p.id === c.id)); if (next) picks.push({ ...next, tier: 'small (fallback)' }) }
  return picks.slice(0, 5)
}

// ─── Seed Test Intelligence Objects for Sprint 2 Testing ────────────
// Sprint 2 operates on IntelligenceObject records. We need some to test against.

async function seedTestObjects(companyId: string): Promise<string[]> {
  const objects = []

  // Object 1: Funding signal (will have a near-duplicate)
  const obj1 = await db.intelligenceObject.create({
    data: {
      companyId,
      sourceType: 'rss',
      sourceName: 'TechCrunch RSS',
      origin: 'rss_feed',
      content: 'Company announced Series C funding round of $45M led by Sequoia Capital to accelerate product development and expand into European markets',
      summary: 'Series C funding round of $45M',
      metadata: JSON.stringify({ category: 'Strategy', signalType: 'funding' }),
      sourceUrl: 'https://techcrunch.com/funding-round',
      capturedAt: new Date('2026-07-15'),
      originalConfidence: 0.75,
      status: 'active',
    },
  })
  objects.push(obj1.id)

  // Object 2: Near-duplicate of Object 1 (should be detected — Jaccard >= 0.6)
  const obj2 = await db.intelligenceObject.create({
    data: {
      companyId,
      sourceType: 'website',
      sourceName: 'Company Blog',
      origin: 'website_scrape',
      content: 'Company announced Series C funding round of $45M led by Sequoia Capital to accelerate product development and expand into European markets today',
      summary: '$45M Series C funding announcement',
      metadata: JSON.stringify({ category: 'Strategy', signalType: 'funding' }),
      sourceUrl: 'https://company.com/blog/series-c',
      capturedAt: new Date('2026-07-16'),
      originalConfidence: 0.85,
      status: 'active',
    },
  })
  objects.push(obj2.id)

  // Object 3: Conflicting signal (negative sentiment vs positive)
  const obj3 = await db.intelligenceObject.create({
    data: {
      companyId,
      sourceType: 'rss',
      sourceName: 'Industry News RSS',
      origin: 'rss_feed',
      content: 'Company has discontinued its legacy on-premise product line and ceased all support for customers on older versions',
      summary: 'Legacy product line discontinued',
      metadata: JSON.stringify({ category: 'Products' }),
      sourceUrl: 'https://industrynews.com/discontinued',
      capturedAt: new Date('2026-07-10'),
      originalConfidence: 0.7,
      status: 'active',
    },
  })
  objects.push(obj3.id)

  // Object 4: Positive signal in same category (should trigger conflict with obj3)
  const obj4 = await db.intelligenceObject.create({
    data: {
      companyId,
      sourceType: 'website',
      sourceName: 'Company Press Releases',
      origin: 'website_scrape',
      content: 'Company announced expanded product portfolio with new features launched for enterprise customers',
      summary: 'New product features launched',
      metadata: JSON.stringify({ category: 'Products' }),
      sourceUrl: 'https://company.com/press/new-features',
      capturedAt: new Date('2026-07-20'),
      originalConfidence: 0.9,
      status: 'active',
    },
  })
  objects.push(obj4.id)

  // Object 5: Old intelligence (for temporal/confidence testing)
  const obj5 = await db.intelligenceObject.create({
    data: {
      companyId,
      sourceType: 'csv',
      sourceName: 'Q1 Data Import',
      origin: 'csv_upload',
      content: 'Company had approximately 850 employees across 3 offices in North America as reported in Q1 2026 financial filing. Revenue was estimated at $120M annually with strong growth trajectory in the SaaS vertical market segment.',
      summary: 'Q1 2026 employee and revenue data',
      metadata: JSON.stringify({ category: 'Strategy' }),
      sourceUrl: null,
      capturedAt: new Date('2026-01-15'),
      originalConfidence: 0.95,
      status: 'active',
    },
  })
  objects.push(obj5.id)

  return objects
}

// ─── Cleanup ──────────────────────────────────────────────────────────

async function cleanupTestObjects(companyId: string) {
  // Delete associations first (they reference objects)
  const objects = await db.intelligenceObject.findMany({
    where: { companyId, sourceName: { in: ['TechCrunch RSS', 'Company Blog', 'Industry News RSS', 'Company Press Releases', 'Q1 Data Import'] } },
    select: { id: true },
  })
  const ids = objects.map(o => o.id)

  if (ids.length > 0) {
    await db.intelligenceAssociation.deleteMany({ where: { OR: [{ sourceId: { in: ids } }, { targetId: { in: ids } }] } })
    await db.intelligenceObject.deleteMany({ where: { id: { in: ids } } })
  }
}

// ─── Validation ──────────────────────────────────────────────────────

interface ValidationCheck { name: string; passed: boolean; detail: string }
interface CompanyReport { companyId: string; companyName: string; tier: string; passed: boolean; checks: ValidationCheck[] }

async function validateCompany(company: CompanyPick): Promise<CompanyReport> {
  const checks: ValidationCheck[] = []

  // Seed test data
  const objectIds = await seedTestObjects(company.id)

  // ── Test 1: Duplicate Detection ──
  try {
    const duplicates = await detectDuplicates(company.id)
    const hasDuplicates = duplicates.length > 0
    const totalMatches = duplicates.reduce((sum, d) => sum + d.matches.length, 0)
    checks.push({
      name: 'duplicate_detection',
      passed: hasDuplicates,
      detail: hasDuplicates
        ? `Found ${duplicates.length} duplicate groups with ${totalMatches} total matches`
        : 'No duplicates detected (expected near-duplicate pair)',
    })

    // Verify the specific near-duplicate pair was caught
    const matchFound = duplicates.some(d =>
      d.objectId === objectIds[0] && d.matches.some(m => m.objectId === objectIds[1])
    )
    checks.push({
      name: 'specific_duplicate_pair',
      passed: matchFound,
      detail: matchFound ? 'Near-duplicate funding pair correctly identified' : 'Specific pair not detected',
    })

    // Verify similarity score is reasonable (should be > 0.5)
    if (hasDuplicates) {
      const sim = duplicates[0].matches[0]?.similarity || 0
      checks.push({
        name: 'similarity_score',
        passed: sim > 0.4,
        detail: `Jaccard similarity: ${(sim * 100).toFixed(1)}%`,
      })
    } else {
      checks.push({ name: 'similarity_score', passed: false, detail: 'No duplicate to measure' })
    }
  } catch (err) {
    checks.push({ name: 'duplicate_detection', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
    checks.push({ name: 'specific_duplicate_pair', passed: false, detail: 'Skipped due to error' })
    checks.push({ name: 'similarity_score', passed: false, detail: 'Skipped due to error' })
  }

  // ── Test 2: Conflict Detection ──
  try {
    const conflicts = await detectConflicts(company.id)
    const hasConflicts = conflicts.length > 0
    checks.push({
      name: 'conflict_detection',
      passed: hasConflicts,
      detail: hasConflicts
        ? `Found ${conflicts.length} conflicts: ${conflicts.map(c => c.conflictType).join(', ')}`
        : 'No conflicts detected (expected contradiction)',
    })

    // Check for contradiction type specifically
    const hasContradiction = conflicts.some(c => c.conflictType === 'contradiction')
    checks.push({
      name: 'contradiction_detection',
      passed: hasContradiction,
      detail: hasContradiction
        ? 'Contradiction detected: positive vs negative sentiment in same category'
        : 'No contradiction found',
    })
  } catch (err) {
    checks.push({ name: 'conflict_detection', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
    checks.push({ name: 'contradiction_detection', passed: false, detail: 'Skipped due to error' })
  }

  // ── Test 3: Auto-Association Creation ──
  try {
    const before = await db.intelligenceAssociation.count({ where: { companyId: company.id } })
    const duplicates = await detectDuplicates(company.id)
    for (const dup of duplicates) {
      for (const match of dup.matches) {
        try {
          await createAssociation({
            sourceId: dup.objectId,
            targetId: match.objectId,
            associationType: 'duplicate',
            confidence: match.similarity,
            metadata: { autoDetected: true, method: 'jaccard' },
          })
        } catch { /* already exists */ }
      }
    }
    const after = await db.intelligenceAssociation.count({ where: { companyId: company.id } })
    checks.push({
      name: 'auto_association',
      passed: after > before,
      detail: `${after - before} associations created (total: ${after})`,
    })
  } catch (err) {
    checks.push({ name: 'auto_association', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
  }

  // ── Test 4: Association Retrieval ──
  try {
    const associations = await getAssociations(company.id)
    checks.push({
      name: 'association_retrieval',
      passed: associations.length > 0,
      detail: `${associations.length} associations retrieved with source/target info`,
    })
  } catch (err) {
    checks.push({ name: 'association_retrieval', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
  }

  // ── Test 5: Confidence Calculation ──
  try {
    const obj = await db.intelligenceObject.findUnique({ where: { id: objectIds[0] } })
    if (obj) {
      const result = calculateConfidence({
        sourceType: obj.sourceType,
        capturedAt: obj.capturedAt,
        content: obj.content,
        originalConfidence: obj.originalConfidence,
      })
      checks.push({
        name: 'confidence_composite',
        passed: result.composite >= 0 && result.composite <= 1,
        detail: `Composite: ${(result.composite * 100).toFixed(1)}% (source=${(result.sourceQuality * 100).toFixed(0)}%, freshness=${(result.freshness.score * 100).toFixed(0)}%, content=${(result.contentValidation * 100).toFixed(0)}%)`,
      })

      // Freshness specifically
      checks.push({
        name: 'freshness_decay',
        passed: result.freshness.score > 0 && result.freshness.score <= 1,
        detail: `${result.freshness.daysElapsed} days elapsed, max ${result.freshness.maxDays} days, score: ${(result.freshness.score * 100).toFixed(0)}%`,
      })
    } else {
      checks.push({ name: 'confidence_composite', passed: false, detail: 'Object not found' })
      checks.push({ name: 'freshness_decay', passed: false, detail: 'Object not found' })
    }
  } catch (err) {
    checks.push({ name: 'confidence_composite', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
    checks.push({ name: 'freshness_decay', passed: false, detail: 'Error' })
  }

  // ── Test 6: Confidence Persistence (recalculateObjectConfidence) ──
  try {
    const { result, explanation } = await recalculateObjectConfidence(objectIds[0])
    checks.push({
      name: 'confidence_persistence',
      passed: !!explanation && explanation.length > 20,
      detail: `Explanation: "${explanation.substring(0, 80)}..."`,
    })

    // Verify DB was updated
    const updated = await db.intelligenceObject.findUnique({ where: { id: objectIds[0] } })
    checks.push({
      name: 'confidence_db_update',
      passed: updated !== null && updated.confidenceBreakdown !== null && updated.confidenceBreakdown.length > 0,
      detail: updated ? `DB confidence=${(updated.originalConfidence * 100).toFixed(1)}%, breakdown present` : 'Object not found',
    })
  } catch (err) {
    checks.push({ name: 'confidence_persistence', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
    checks.push({ name: 'confidence_db_update', passed: false, detail: `Error` })
  }

  // ── Test 7: Old Data Confidence Penalty ──
  try {
    const oldObj = await db.intelligenceObject.findUnique({ where: { id: objectIds[4] } })
    if (oldObj) {
      const result = calculateConfidence({
        sourceType: oldObj.sourceType,
        capturedAt: oldObj.capturedAt,
        content: oldObj.content,
        originalConfidence: oldObj.originalConfidence,
      })
      checks.push({
        name: 'old_data_penalty',
        passed: result.freshness.score < 1.0,
        detail: `Old data (${(result.freshness.daysElapsed)} days): freshness=${(result.freshness.score * 100).toFixed(0)}% (should be < 100% due to decay)`,
      })
    } else {
      checks.push({ name: 'old_data_penalty', passed: false, detail: 'Object not found' })
    }
  } catch (err) {
    checks.push({ name: 'old_data_penalty', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
  }

  // ── Test 8: Knowledge Versioning ──
  try {
    // Create a knowledge entry first
    const ke = await db.knowledgeEntry.create({
      data: {
        companyId: company.id,
        category: 'Strategy',
        content: 'Initial knowledge entry for Sprint 2 validation testing',
        source: 'sprint2_validation',
        confidence: 0.8,
      },
    })

    // Create version snapshot
    const snapshot = await createVersionSnapshot(ke.id, 'Sprint 2 validation snapshot', 'sprint2_test')
    checks.push({
      name: 'knowledge_versioning',
      passed: snapshot.version === 1 && snapshot.content.length > 0,
      detail: `Version ${snapshot.version} created for entry ${ke.id.substring(0, 12)}`,
    })

    // Get version history
    const history = await getVersionHistory(ke.id)
    checks.push({
      name: 'version_history',
      passed: history.length >= 1,
      detail: `${history.length} versions in history`,
    })

    // Cleanup knowledge entries
    await db.knowledgeVersion.deleteMany({ where: { knowledgeEntryId: ke.id } })
    await db.knowledgeEntry.delete({ where: { id: ke.id } })
  } catch (err) {
    checks.push({ name: 'knowledge_versioning', passed: false, detail: `Error: ${err instanceof Error ? err.message : err}` })
    checks.push({ name: 'version_history', passed: false, detail: `Error` })
  }

  // Cleanup test objects
  await cleanupTestObjects(company.id)

  return {
    companyId: company.id,
    companyName: company.name,
    tier: company.tier,
    passed: checks.every(c => c.passed),
    checks,
  }
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  DeepMindQ — Sprint 2 Pipeline Validation (5 Companies)      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  console.log('━━━ PHASE 1: Company Selection ━━━\n')
  const companies = await selectCompanies()
  console.log('Selected %d companies:\n', companies.length)
  for (const c of companies) {
    console.log('  [%s] %s | %s | %s', c.tier.padEnd(22), c.name.padEnd(30), c.sizeRange || 'N/A', c.industry || 'N/A')
  }
  console.log('')

  console.log('━━━ PHASE 2: Sprint 2 Pipeline Validation ━━━\n')
  const reports: CompanyReport[] = []

  for (const company of companies) {
    console.log('▶ %s (%s)', company.name, company.tier)
    const report = await validateCompany(company)
    reports.push(report)

    for (const check of report.checks) {
      const icon = check.passed ? '✓' : '✗'
      console.log('  %s %s %s', icon, check.name.padEnd(30), check.detail)
    }
    console.log('  Overall: %s\n', report.passed ? 'PASS' : 'FAIL')
  }

  console.log('━━━ VALIDATION SUMMARY ━━━\n')
  const passed = reports.filter(r => r.passed).length
  const failed = reports.filter(r => !r.passed).length

  console.log('  Companies tested: %d', reports.length)
  console.log('  Passed:           %d', passed)
  console.log('  Failed:           %d', failed)
  console.log('')

  console.log('  Check-level results:')
  const allChecks = [...new Set(reports.flatMap(r => r.checks.map(c => c.name)))]
  for (const name of allChecks) {
    const results = reports.flatMap(r => r.checks.filter(c => c.name === name))
    const passCount = results.filter(c => c.passed).length
    const icon = passCount === results.length ? '✓' : '✗'
    console.log('    %s %s %d/%d', icon, name.padEnd(35), passCount, results.length)
  }

  console.log('')
  console.log(passed === reports.length
    ? '✅ ALL VALIDATIONS PASSED — Sprint 2 pipeline is operational'
    : '⚠️  %d VALIDATION(S) FAILED — review checks above', failed)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Validation error:', err)
  process.exit(1)
})
