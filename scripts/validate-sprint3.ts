/**
 * Sprint 3 Validation Script — Simplified
 * Tests internal memory, people change, and unified query across 3 scenarios
 */

const BASE = 'http://localhost:3000'
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function api(path: string, body: unknown) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (!text || text.length < 2) {
        console.log(`  ⏳ Empty response (attempt ${attempt + 1}), waiting...`)
        await delay(10000)
        continue
      }
      if (!res.ok) {
        console.log(`  ❌ HTTP ${res.status}: ${text.substring(0, 200)}`)
        return null
      }
      return JSON.parse(text)
    } catch (e: any) {
      console.log(`  ⏳ Request failed (attempt ${attempt + 1}): ${e.message}`)
      await delay(10000)
    }
  }
  return null
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  DeepMindQ Sprint 3 — Full Pipeline Validation')
  console.log('  3 Scenarios: Enterprise, Mid-Market, Small Company')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  // Step 1: Seed
  console.log('━━━ STEP 1: Seeding validation data ━━━')
  await delay(3000)
  const seed = await api('/api/intelligence/sprint3', { mode: 'seed_validation' })
  if (!seed || !seed.scenarios) {
    console.log('❌ Seed failed, aborting')
    return
  }
  const ids = {
    enterprise: seed.scenarios.enterprise.companyId,
    midmarket: seed.scenarios.midmarket.companyId,
    small_company: seed.scenarios.small_company.companyId,
  }
  console.log(`✅ Seeded: Enterprise=${seed.scenarios.enterprise.name}, Mid=${seed.scenarios.midmarket.name}, Small=${seed.scenarios.small_company.name}`)
  console.log()

  for (const [label, companyId] of Object.entries(ids) as [string, string][]) {
    console.log(`━━━ ${label.toUpperCase()} ━━━`)

    // Internal Memory
    await delay(5000)
    const mem = await api('/api/intelligence/sprint3', { mode: 'internal_memory', companyId })
    if (mem) {
      console.log(`  Internal Memory: ${mem.signalsExtracted} signals (${mem.signalsPersisted} persisted)`)
      console.log(`    Depth: ${mem.memoryDepth.score}/100 (${mem.memoryDepth.grade})`)
      console.log(`    Notes: ${mem.sources.companyNotes}, Contact notes: ${mem.sources.contactNotes}, Timeline: ${mem.sources.timelineEvents}`)
      console.log(`    Strategy: ${mem.sources.accountStrategies}, Research: ${mem.sources.researchCards}, Human: ${mem.sources.humanIntelligence}`)
    } else {
      console.log('  ⚠️ Internal memory skipped')
    }

    // People Change
    await delay(5000)
    const ppl = await api('/api/intelligence/sprint3', { mode: 'people_change', companyId })
    if (ppl) {
      console.log(`  People Change: ${ppl.signalsExtracted} signals (${ppl.signalsPersisted} persisted)`)
      console.log(`    Contacts: ${ppl.contactAnalysis.totalContacts}, new 30d: ${ppl.contactAnalysis.newContacts30d}, high-influence: ${ppl.contactAnalysis.highInfluenceContacts}`)
      console.log(`    Active: ${ppl.contactAnalysis.activeEngagement}, champions: ${ppl.contactAnalysis.championCandidates}, stale: ${ppl.contactAnalysis.staleContacts}`)
    } else {
      console.log('  ⚠️ People change skipped')
    }

    // Unified Query
    await delay(5000)
    const unified = await api('/api/intelligence/sprint3', { mode: 'unified_query', companyId })
    if (unified) {
      console.log(`  Unified Memory Query:`)
      console.log(`    Score: ${unified.compositeScore.overall}/100 (${unified.compositeScore.grade}) | Scenario: ${unified.compositeScore.scenario}`)
      console.log(`    External: ${unified.layers.external.signalCount} (${unified.layers.external.coverage}) | Internal: ${unified.layers.internal.signalCount} (depth ${unified.layers.internal.memoryDepth}, ${unified.layers.internal.memoryGrade})`)
      console.log(`    People: ${unified.layers.people.totalContacts} contacts (${unified.layers.people.coverageScore}/100)`)
      console.log(`    Top signals: ${unified.topSignals.length} | Actions: ${unified.recommendedActions.length} | Gaps: ${unified.memoryGaps.length}`)
      if (unified.topSignals.length > 0) {
        console.log(`    Top 3 signals:`)
        unified.topSignals.slice(0, 3).forEach((s: any) =>
          console.log(`      ${s.rank}. [${s.source}] ${s.signal} (${s.confidence}%)`)
        )
      }
      if (unified.keyContacts.length > 0) {
        console.log(`    Key contacts: ${unified.keyContacts.map((c: any) => `${c.name} (${c.buyingRole}, influence ${c.influenceScore})`).join(', ')}`)
      }
    } else {
      console.log('  ⚠️ Unified query skipped')
    }

    console.log()
  }

  // Next Best Action for enterprise
  console.log('━━━ ACTION GENERATION (Enterprise) ━━━')
  await delay(5000)
  const nba = await api('/api/intelligence/sprint3', { mode: 'next_best_action', companyId: ids.enterprise })
  if (nba && nba.data) {
    console.log(`  Next Best Action: ${nba.data.action}`)
    console.log(`  Priority: ${nba.data.priority} | Urgency: ${nba.data.urgency} | Effort: ${nba.data.effort}`)
    console.log(`  Target: ${nba.data.targetContact?.name || 'N/A'} | ${nba.wasCached ? '(cached)' : '(fresh)'}`)
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Sprint 3 Validation Complete!')
  console.log('═══════════════════════════════════════════════════════')
}

main().catch(console.error)
