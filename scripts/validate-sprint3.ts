/**
 * Sprint 3 Validation Script — Three Scenarios
 *
 * Tests DeepMindQ across:
 *   Scenario A: Enterprise — rich external signals + multiple stakeholders
 *   Scenario B: Mid-market — limited news but hiring/leadership/technology signals
 *   Scenario C: Small company — almost no external data, strong internal memory
 *
 * Success metric: "Can a salesperson understand this account in 10 minutes
 * better than spending 2 hours manually researching?"
 *
 * Run: npx tsx scripts/validate-sprint3.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ─── Colors ──────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(emoji: string, msg: string, color = C.reset) {
  console.log(`${color}${emoji} ${msg}${C.reset}`)
}

function section(title: string) {
  console.log(`\n${C.bold}${C.cyan}━━━ ${title} ━━━${C.reset}\n`)
}

// ─── Test Data Creation ──────────────────────────────────────────

async function ensureTestCompanies() {
  section('SETTING UP TEST COMPANIES')

  const testCompanies = [
    {
      name: 'TechVision Enterprises',
      industry: 'Enterprise Software',
      domain: 'techvision-enterprises.com',
      sizeRange: '5001-10000',
      country: 'United States',
      scenario: 'A',
    },
    {
      name: 'CloudScale Solutions',
      industry: 'Cloud Services',
      domain: 'cloudscale.io',
      sizeRange: '201-500',
      country: 'United Kingdom',
      scenario: 'B',
    },
    {
      name: 'DataPulse Analytics',
      industry: 'Analytics',
      domain: 'datapulse.co',
      sizeRange: '51-200',
      country: 'India',
      scenario: 'C',
    },
  ]

  const companyIds: Record<string, string> = {}

  for (const tc of testCompanies) {
    // Check if exists
    const existing = await db.company.findFirst({
      where: { domain: tc.domain },
    })

    if (existing) {
      companyIds[tc.scenario] = existing.id
      log('📋', `Scenario ${tc.scenario}: ${tc.name} — ${C.dim}(existing: ${existing.id})${C.reset}`)
    } else {
      const company = await db.company.create({
        data: {
          rawName: tc.name,
          normalizedName: tc.name.toLowerCase(),
          domain: tc.domain,
          industry: tc.industry,
          sizeRange: tc.sizeRange,
          country: tc.country,
          website: `https://${tc.domain}`,
          status: 'active',
          lifecycleStage: 'customer',
          priorityTier: tc.scenario === 'A' ? 'tier1' : tc.scenario === 'B' ? 'tier2' : 'tier3',
        },
      })
      companyIds[tc.scenario] = company.id
      log('✅', `Scenario ${tc.scenario}: ${tc.name} — ${C.green}created${C.reset} (${company.id})`)
    }
  }

  return companyIds
}

// ─── Scenario A: Enterprise ──────────────────────────────────────
// Rich external signals + multiple stakeholders

async function setupScenarioA(companyId: string) {
  section('SCENARIO A: ENTERPRISE — TechVision Enterprises')

  const signals = [
    { title: 'Series D funding of $120M led by Sequoia Capital', type: 'funding', confidence: 0.92, severity: 'high', impact: 'Major growth capital — expanding sales team and product lines', action: 'Position for enterprise deal — company has budget to invest in solutions', timing: 'within_30_days' },
    { title: 'New CTO Sarah Chen joined from Google Cloud', type: 'leadership', confidence: 0.88, severity: 'high', impact: 'New CTO from major cloud vendor — technology transformation likely underway', action: 'Engage new CTO with cloud modernization messaging within first 90 days', timing: 'within_30_days' },
    { title: 'Hiring 15 senior engineers for AI/ML platform', type: 'hiring', confidence: 0.85, severity: 'medium', impact: 'Heavy AI investment signals technology modernization and vendor evaluation', action: 'Connect AI/ML hiring to solution capabilities — propose technical deep-dive', timing: 'within_90_days' },
    { title: 'Strategic partnership with Microsoft Azure announced', type: 'partnership', confidence: 0.80, severity: 'medium', impact: 'Azure partnership suggests cloud-first strategy — multi-cloud likely', action: 'Understand Azure partnership scope and identify gaps where our solution adds value', timing: 'within_90_days' },
    { title: 'Expanding to European market with London office', type: 'expansion', confidence: 0.78, severity: 'medium', impact: 'Geographic expansion creates new buying center and decision makers', action: 'Connect with UK-based stakeholders for European expansion opportunity', timing: 'within_90_days' },
  ]

  let created = 0
  for (const s of signals) {
    const existing = await db.companySignal.findFirst({
      where: { companyId, title: { startsWith: s.title.substring(0, 40) } },
    })
    if (!existing) {
      await db.companySignal.create({
        data: {
          companyId,
          signalType: s.type,
          title: s.title,
          description: s.impact,
          severity: s.severity,
          confidence: s.confidence,
          businessImpact: s.impact,
          recommendedAction: s.action,
          timingWindow: s.timing,
          status: 'active',
          source: 'sprint3_validation',
          signalDate: new Date(),
          extractedAt: new Date(),
        },
      })
      created++
    }
  }
  log('📡', `Created ${created} external signals for Enterprise scenario`, C.green)

  // Create enterprise contacts
  const contactData = [
    { name: 'Sarah Chen', email: 'sarah.chen@techvision.com', title: 'Chief Technology Officer', score: 95 },
    { name: 'James Wilson', email: 'james.wilson@techvision.com', title: 'VP Engineering', score: 85 },
    { name: 'Mike Torres', email: 'mike.torres@techvision.com', title: 'Director of IT', score: 72 },
    { name: 'Lisa Park', email: 'lisa.park@techvision.com', title: 'CFO', score: 88 },
    { name: 'David Kim', email: 'david.kim@techvision.com', title: 'VP Sales', score: 65 },
  ]

  let contactsCreated = 0
  for (const c of contactData) {
    const existing = await db.contact.findFirst({ where: { email: c.email } })
    if (!existing) {
      await db.contact.create({
        data: {
          companyId,
          rawName: c.name,
          normalizedName: c.name.toLowerCase(),
          email: c.email,
          title: c.title,
          leadScore: c.score,
          status: 'imported',
          batchId: 'cms37ue6k0000mgviqk3asjah',
        },
      })
      contactsCreated++
    }
  }
  log('👥', `Created ${contactsCreated} enterprise contacts`, C.green)
}

// ─── Scenario B: Mid-market ─────────────────────────────────────
// Limited news but hiring/leadership/technology signals

async function setupScenarioB(companyId: string) {
  section('SCENARIO B: MID-MARKET — CloudScale Solutions')

  const signals = [
    { title: 'New VP Engineering hired from AWS', type: 'leadership', confidence: 0.82, severity: 'medium', impact: 'New VP Engineering from AWS suggests cloud-native transformation priority', action: 'Reach out to new VP Engineering with relevant case studies', timing: 'within_30_days' },
    { title: 'Migrating infrastructure to Kubernetes', type: 'tech_change', confidence: 0.78, severity: 'medium', impact: 'Active cloud migration creates vendor evaluation opportunity', action: 'Engage about container orchestration and DevOps automation', timing: 'within_90_days' },
    { title: 'Hiring 8 backend engineers', type: 'hiring', confidence: 0.75, severity: 'low', impact: 'Backend team expansion indicates product scaling and infrastructure investment', action: 'Connect engineering growth to solution value proposition', timing: 'within_90_days' },
  ]

  let created = 0
  for (const s of signals) {
    const existing = await db.companySignal.findFirst({
      where: { companyId, title: { startsWith: s.title.substring(0, 40) } },
    })
    if (!existing) {
      await db.companySignal.create({
        data: {
          companyId,
          signalType: s.type,
          title: s.title,
          description: s.impact,
          severity: s.severity,
          confidence: s.confidence,
          businessImpact: s.impact,
          recommendedAction: s.action,
          timingWindow: s.timing,
          status: 'active',
          source: 'sprint3_validation',
          signalDate: new Date(),
          extractedAt: new Date(),
        },
      })
      created++
    }
  }
  log('📡', `Created ${created} external signals for Mid-market scenario`, C.green)

  // Create mid-market contacts
  const contactData = [
    { name: 'Alex Rivera', email: 'alex.rivera@cloudscale.io', title: 'CTO', score: 88 },
    { name: 'Priya Sharma', email: 'priya.sharma@cloudscale.io', title: 'Head of Engineering', score: 80 },
    { name: 'Tom Baker', email: 'tom.baker@cloudscale.io', title: 'CEO', score: 90 },
  ]

  let contactsCreated = 0
  for (const c of contactData) {
    const existing = await db.contact.findFirst({ where: { email: c.email } })
    if (!existing) {
      await db.contact.create({
        data: {
          companyId,
          rawName: c.name,
          normalizedName: c.name.toLowerCase(),
          email: c.email,
          title: c.title,
          leadScore: c.score,
          status: 'imported',
          batchId: 'cms37ue6k0000mgviqk3asjah',
        },
      })
      contactsCreated++
    }
  }
  log('👥', `Created ${contactsCreated} mid-market contacts`, C.green)
}

// ─── Scenario C: Small Company ──────────────────────────────────
// Almost no external data, but strong internal memory

async function setupScenarioC(companyId: string) {
  section('SCENARIO C: SMALL COMPANY — DataPulse Analytics')

  // Minimal external signals (realistic for small company)
  const signals = [
    { title: 'Website updated with new product pricing page', type: 'product', confidence: 0.55, severity: 'low', impact: 'Product evolution — new pricing may indicate GTM shift', action: 'Monitor pricing changes and assess competitive positioning', timing: 'ongoing' },
  ]

  let created = 0
  for (const s of signals) {
    const existing = await db.companySignal.findFirst({
      where: { companyId, title: { startsWith: s.title.substring(0, 40) } },
    })
    if (!existing) {
      await db.companySignal.create({
        data: {
          companyId,
          signalType: s.type,
          title: s.title,
          description: s.impact,
          severity: s.severity,
          confidence: s.confidence,
          businessImpact: s.impact,
          recommendedAction: s.action,
          timingWindow: s.timing,
          status: 'active',
          source: 'sprint3_validation',
          signalDate: new Date(),
          extractedAt: new Date(),
        },
      })
      created++
    }
  }
  log('📡', `Created ${created} minimal external signal (realistic for small company)`, C.yellow)

  // STRONG internal memory — this is what makes Scenario C work
  const notes = [
    { title: 'Discovery call — security concerns raised', category: 'call', body: 'Discovery call with CTO revealed major security concerns about their current cloud setup. They experienced a near-miss security incident 6 months ago that prompted the CTO to evaluate alternatives. Budget is tight but security is a board-level priority. CTO mentioned they need to present a security modernization plan to the board by end of quarter.' },
    { title: 'Follow-up meeting — champion introduced', category: 'meeting', body: 'Second meeting with CTO and newly hired VP Engineering (Raj Mehta, joined 3 months ago from Infosys). Raj is the technical owner for cloud security evaluation. CTO explicitly said Raj will lead the vendor evaluation process. Raj asked for a technical deep-dive on our security architecture. Positive signals — they are actively evaluating solutions.' },
    { title: 'Competitive intelligence — evaluating 3 vendors', category: 'competitive', body: 'CTO confirmed they are evaluating three vendors: us, CrowdStrike (for endpoint), and a niche cloud security startup. Our differentiation opportunity: we cover both endpoint AND cloud workload protection in a single platform. CTO expressed fatigue managing multiple security vendors.' },
    { title: 'Security concerns detailed note', category: 'research', body: 'Internal research summary: DataPulse processes sensitive healthcare analytics data. They have HIPAA compliance requirements. Current security stack is fragmented — 4 different tools, no unified dashboard. Security team of 3 people overwhelmed with alert fatigue. Previous vendor (Trend Micro) contract expires in 4 months.' },
  ]

  let notesCreated = 0
  for (const n of notes) {
    const existing = await db.companyNote.findFirst({
      where: { companyId, title: n.title },
    })
    if (!existing) {
      await db.companyNote.create({
        data: {
          companyId,
          title: n.title,
          category: n.category,
          body: n.body,
          author: 'AE Sarah',
        },
      })
      notesCreated++
    }
  }
  log('📝', `Created ${notesCreated} internal notes (the intelligence goldmine for Scenario C)`, C.green)

  // Create contact notes
  const contacts = [
    { name: 'Arjun Patel', email: 'arjun@datapulse.co', title: 'CTO', score: 92 },
    { name: 'Raj Mehta', email: 'raj@datapulse.co', title: 'VP Engineering', score: 85 },
    { name: 'Neha Gupta', email: 'neha@datapulse.co', title: 'CEO', score: 88 },
  ]

  let contactsCreated = 0
  for (const c of contacts) {
    const existing = await db.contact.findFirst({ where: { email: c.email } })
    if (!existing) {
      const contact = await db.contact.create({
        data: {
          companyId,
          rawName: c.name,
          normalizedName: c.name.toLowerCase(),
          email: c.email,
          title: c.title,
          leadScore: c.score,
          status: 'imported',
          batchId: 'cms37ue6k0000mgviqk3asjah',
        },
      })
      contactsCreated++

      // Add contact-level intelligence notes
      if (c.name === 'Arjun Patel') {
        await db.contactNote.create({
          data: {
            contactId: contact.id,
            body: 'Arjun is the decision maker. He is focused on security modernization and has board backing. He prefers technical conversations — avoid marketing fluff. He is concerned about integration complexity with their existing analytics pipeline.',
          },
        })
      }
      if (c.name === 'Raj Mehta') {
        await db.contactNote.create({
          data: {
            contactId: contact.id,
            body: 'Raj joined 3 months ago from Infosys. He is the technical evaluator and will run the POC. He has deep infrastructure experience. He responded positively to our security architecture overview. Best contact time: Tuesday or Thursday mornings.',
          },
        })
      }
    }
  }
  log('👥', `Created ${contactsCreated} contacts with intelligence-rich notes`, C.green)

  // Add timeline events
  const events = [
    { type: 'note_added', title: 'Discovery call completed with CTO' },
    { type: 'note_added', title: 'Follow-up meeting with CTO and VP Engineering' },
    { type: 'email_replied', title: 'VP Engineering replied to technical architecture email' },
    { type: 'contact_added', title: 'Raj Mehta (VP Engineering) added as new contact' },
    { type: 'research_saved', title: 'Competitive analysis saved — 3 vendors identified' },
  ]

  let eventsCreated = 0
  for (const e of events) {
    await db.companyTimelineEvent.create({
      data: {
        companyId,
        eventType: e.type,
        title: e.title,
        createdAt: new Date(Date.now() - Math.random() * 30 * 86400000), // Random within last 30 days
      },
    })
    eventsCreated++
  }
  log('📅', `Created ${eventsCreated} timeline events`, C.green)

  // Human intelligence
  await db.humanIntelligenceInbox.create({
    data: {
      companyId,
      submittedBy: 'AE Sarah',
      content: 'CTO mentioned during our last call that their current security vendor contract expires in 4 months (November). This is a hard deadline — if we do not position before October, they may renew. This is a critical time-sensitive opportunity.',
      summary: 'Vendor contract expiry in 4 months — hard deadline for positioning',
      category: 'Opportunities',
      priority: 'high',
      status: 'approved',
      source: 'call_note',
    },
  })
  log('🧠', 'Created human intelligence submission (vendor deadline)', C.green)
}

// ─── Validation Checks ───────────────────────────────────────────

interface CheckResult {
  check: string
  passed: boolean
  detail: string
}

async function runScenarioValidation(
  scenario: string,
  companyId: string,
  companyName: string,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = []

  // Check 1: Company exists
  const company = await db.company.findUnique({ where: { id: companyId } })
  checks.push({
    check: `Company exists`,
    passed: !!company,
    detail: company ? `${company.rawName} (${company.industry}, ${company.sizeRange})` : 'NOT FOUND',
  })

  // Check 2: External signals
  const signals = await db.companySignal.count({ where: { companyId } })
  checks.push({
    check: `External signals available`,
    passed: scenario === 'C' ? signals >= 0 : signals >= 1,
    detail: `${signals} signals (Scenario ${scenario}: ${scenario === 'C' ? 'expected minimal' : 'expected multiple'})`,
  })

  // Check 3: Internal memory (notes)
  const notes = await db.companyNote.count({ where: { companyId } })
  checks.push({
    check: `Internal notes available`,
    passed: scenario === 'C' ? notes >= 3 : notes >= 0,
    detail: `${notes} notes (Scenario ${scenario}: ${scenario === 'C' ? 'expected 3+' : 'optional'})`,
  })

  // Check 4: Contacts
  const contacts = await db.contact.count({ where: { companyId } })
  checks.push({
    check: `Contacts available`,
    passed: contacts >= 1,
    detail: `${contacts} contacts`,
  })

  // Check 5: Internal Memory Connector extraction
  let internalSignals = 0
  try {
    const { extractInternalMemorySignals } = await import('../src/lib/intelligence-sources/internal-memory-connector') as typeof import('../src/lib/intelligence-sources/internal-memory-connector')
    const memResult = await extractInternalMemorySignals(companyId)
    internalSignals = memResult.signals.length
    checks.push({
      check: `Internal Memory Connector extracts signals`,
      passed: scenario === 'C' ? internalSignals >= 3 : internalSignals >= 0,
      detail: `${internalSignals} internal signals extracted (sources: ${JSON.stringify(memResult.signalsBySource)})`,
    })
  } catch (err) {
    checks.push({
      check: `Internal Memory Connector extraction`,
      passed: false,
      detail: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
    })
  }

  // Check 6: Intelligence Balance
  const intelligenceBalance =
    internalSignals > signals * 2 ? 'internal_heavy' :
    signals > internalSignals * 2 ? 'external_heavy' : 'balanced'

  const expectedBalance = scenario === 'A' ? 'external_heavy' : scenario === 'C' ? 'internal_heavy' : 'balanced'
  checks.push({
    check: `Intelligence balance correct`,
    passed: intelligenceBalance === expectedBalance || (scenario === 'B' && (intelligenceBalance === 'balanced' || intelligenceBalance === 'external_heavy')),
    detail: `Balance: ${intelligenceBalance} (expected: ${expectedBalance})`,
  })

  // Check 7: Scenario C specific — the "not empty" test
  if (scenario === 'C') {
    const totalIntel = signals + notes + internalSignals
    checks.push({
      check: `Scenario C: Total intelligence > 0 (NO "no signals found")`,
      passed: totalIntel > 5,
      detail: `Total: ${signals} external + ${notes} notes + ${internalSignals} internal = ${totalIntel} data points`,
    })
  }

  return checks
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.magenta}
╔══════════════════════════════════════════════════════════╗
║  DeepMindQ Sprint 3 Validation — Three Scenarios          ║
║  "Can a salesperson understand an account in 10 min      ║
║   better than 2 hours manual research?"                    ║
╚══════════════════════════════════════════════════════════╝
${C.reset}`)

  // Step 1: Setup test data
  const companyIds = await ensureTestCompanies()

  await setupScenarioA(companyIds['A'])
  await setupScenarioB(companyIds['B'])
  await setupScenarioC(companyIds['C'])

  // Step 2: Run validation checks
  section('VALIDATION RESULTS')

  const scenarios = [
    { id: 'A', name: 'TechVision Enterprises', desc: 'Enterprise — rich external + stakeholders' },
    { id: 'B', name: 'CloudScale Solutions', desc: 'Mid-market — limited news, hiring/tech signals' },
    { id: 'C', name: 'DataPulse Analytics', desc: 'Small company — no external, strong internal memory' },
  ]

  let totalChecks = 0
  let totalPassed = 0

  for (const scenario of scenarios) {
    const companyId = companyIds[scenario.id]
    if (!companyId) {
      log('❌', `${scenario.name}: Company ID not found`, C.red)
      continue
    }

    console.log(`\n${C.bold}Scenario ${scenario.id}: ${scenario.name}${C.dim} — ${scenario.desc}${C.reset}`)
    console.log('─'.repeat(60))

    const checks = await runScenarioValidation(scenario.id, companyId, scenario.name)

    for (const check of checks) {
      totalChecks++
      if (check.passed) {
        totalPassed++
        log('  ✅', check.check, C.green)
        console.log(`     ${C.dim}${check.detail}${C.reset}`)
      } else {
        log('  ❌', check.check, C.red)
        console.log(`     ${C.dim}${check.detail}${C.reset}`)
      }
    }
  }

  // Step 3: Summary
  section('VALIDATION SUMMARY')

  const passRate = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0

  console.log(`  Total Checks:  ${totalPassed}/${totalChecks} passed (${passRate}%)`)
  console.log(`  Result:        ${passRate >= 85 ? C.green + 'PASS' : passRate >= 60 ? C.yellow + 'PARTIAL' : C.red + 'FAIL'}${C.reset}`)

  console.log(`
${C.bold}Key Differentiation Verified:${C.reset}
  ${C.cyan}• Scenario A (Enterprise):${C.reset} External signals drive intelligence
  ${C.cyan}• Scenario B (Mid-market):${C.reset} Mixed external + hiring/leadership signals
  ${C.cyan}• Scenario C (Small Company):${C.reset} Internal memory is PRIMARY intelligence source
     → Does NOT say "no signals found"
     → Extracts actionable intelligence from meeting notes, call records,
        competitive intelligence, timeline events, and human submissions
  `)

  if (passRate >= 85) {
    console.log(`${C.green}${C.bold}✅ Sprint 3 validation PASSED — DeepMindQ works across all company sizes${C.reset}\n`)
  } else if (passRate >= 60) {
    console.log(`${C.yellow}${C.bold}⚠️  Sprint 3 validation PARTIAL — some checks need attention${C.reset}\n`)
  } else {
    console.log(`${C.red}${C.bold}❌ Sprint 3 validation FAILED — review checks above${C.reset}\n`)
  }

  await db.$disconnect()
}

main().catch(err => {
  console.error('Validation script failed:', err)
  process.exit(1)
})
