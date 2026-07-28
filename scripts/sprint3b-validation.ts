/**
 * Sprint 3B Validation Script
 *
 * Validates all 6 action modules across 3 scenarios:
 *   Enterprise (rich external + internal + stakeholders)
 *   Mid-market (limited external + some internal)
 *   Small company (zero external + strong internal)
 *
 * Quality checks:
 *   1. Does the action engine correctly prioritize internal vs external intelligence?
 *   2. Are recommendations grounded in actual evidence?
 *   3. Can every recommendation trace back to signals, notes, contacts, or events?
 *   4. Does the "Next Best Action" feel like something a salesperson would genuinely use?
 *
 * Run: npx tsx scripts/sprint3b-validation.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ═══════════════════════════════════════════════════════════════
// SEED DATA (same as sprint3/route.ts seedValidationData)
// ═══════════════════════════════════════════════════════════════

interface ScenarioData {
  companyId: string
  name: string
  type: 'enterprise' | 'midmarket' | 'small_company'
}

async function seedAllScenarios(): Promise<ScenarioData[]> {
  console.log('\n══ SEEDING VALIDATION DATA ══')
  const start = Date.now()
  const scenarios: ScenarioData[] = []

  // ── Scenario 1: Enterprise (Acme Corp) ──
  let acme = await db.company.findFirst({ where: { rawName: 'Acme Corp' } })
  if (!acme) {
    const batch = await db.importBatch.create({
      data: { fileName: 'seed.csv', fileHash: 'seed_enterprise', totalRows: 5, acceptedRows: 5, status: 'completed' },
    })
    acme = await db.company.create({
      data: {
        rawName: 'Acme Corp', normalizedName: 'acme corp', domain: 'acmecorp.com',
        industry: 'Enterprise Software', sizeRange: 'enterprise', country: 'United States',
        location: 'San Francisco, CA', website: 'https://acmecorp.com',
        status: 'active', lifecycleStage: 'qualification', intelligenceScore: 72,
        internalSummary: 'Large enterprise software company with complex buying committee',
      },
    })
    // Contacts
    const acmeBatch = await db.importBatch.create({ data: { fileName: 'seed_acme_contacts.csv', fileHash: 'seed_acme', totalRows: 5, acceptedRows: 5, status: 'completed' } })
    for (const c of [
      { name: 'Sarah Chen', email: 'sarah.chen@acmecorp.com', title: 'Chief Technology Officer', score: 85, replies: 3 },
      { name: 'James Wilson', email: 'james.wilson@acmecorp.com', title: 'VP Engineering', score: 72, replies: 1 },
      { name: 'Mike Torres', email: 'mike.torres@acmecorp.com', title: 'Director of IT', score: 68, replies: 5 },
      { name: 'Emily Davis', email: 'emily.davis@acmecorp.com', title: 'CFO', score: 78, replies: 0 },
      { name: 'Alex Kumar', email: 'alex.kumar@acmecorp.com', title: 'Cloud Architect', score: 55, replies: 2 },
    ]) {
      await db.contact.create({
        data: {
          rawName: c.name, normalizedName: c.name.toLowerCase(), email: c.email,
          title: c.title, companyId: acme.id, batchId: acmeBatch.id,
          leadScore: c.score, engagementScore: c.replies * 20,
          status: c.replies > 0 ? 'replied' : 'imported',
          lastContactedAt: new Date(Date.now() - (c.replies > 0 ? 14 : 60) * 86400000),
        },
      })
    }
  }

  // Enterprise notes
  if ((await db.companyNote.count({ where: { companyId: acme.id } })) === 0) {
    await db.companyNote.createMany({
      data: [
        { companyId: acme.id, title: 'Q2 Discovery Call Notes', category: 'discovery', body: 'Discovery call with Sarah Chen revealed Acme Corp is undergoing a major cloud migration from on-premise to AWS. Timeline: 12-18 months. Budget: $3-5M. Key challenge: legacy data migration and team skills gap. Sarah mentioned they are evaluating 3 vendors including a competitor. Strong buying signal.', author: 'John Smith', pinned: true },
        { companyId: acme.id, title: 'SWOT Analysis — Acme Corp', category: 'swot', body: 'Strengths: Large budget, clear technology vision, executive sponsorship. Weaknesses: Slow procurement process, multiple stakeholders with conflicting priorities. Opportunities: Cloud migration is a $5M opportunity, AI governance is emerging need. Threats: Competitor X has existing relationship with VP Engineering.', author: 'Jane Doe' },
        { companyId: acme.id, title: 'Competitive Intelligence', category: 'competitive', body: 'Competitor X presented to James Wilson (VP Engineering) last month. Feedback was mixed — strong on price but weak on AI capabilities. This is our differentiator. Mike Torres (Director IT) expressed frustration with Competitor X implementation timeline.', author: 'John Smith', pinned: true },
        { companyId: acme.id, title: 'Meeting Follow-up', category: 'meeting', body: 'Follow-up from exec briefing. Sarah Chen was interested in AI governance framework. Requested a technical deep-dive with Alex Kumar (Cloud Architect). Emily Davis (CFO) wants ROI analysis before proceeding to proposal stage.', author: 'Jane Doe' },
        { companyId: acme.id, title: 'Call Notes — Technical Discussion', category: 'call', body: 'Call with Alex Kumar covered integration architecture. Key findings: They run a hybrid environment (AWS + on-premise), need API-first approach, concerned about data residency. Alex mentioned team is expanding — hiring 5 cloud engineers in Q3.', author: 'John Smith' },
      ],
    })
  }

  // Enterprise account strategy
  if ((await db.accountStrategy.count({ where: { companyId: acme.id } })) === 0) {
    await db.accountStrategy.create({
      data: {
        companyId: acme.id, title: 'Acme Corp — Cloud Migration & AI Strategy', status: 'active',
        objective: 'Position DeepMindQ as the primary AI intelligence layer for Acme Corp cloud migration',
        currentSituation: 'Acme Corp is migrating from on-premise to AWS over 12-18 months. Currently evaluating vendors.',
        swotAnalysis: JSON.stringify({
          strengths: ['Technical deep-dive completed with Cloud Architect', 'Champion advocate in IT Director', 'AI capabilities differentiate from competitors'],
          weaknesses: ['CFO needs ROI justification', 'Competitor X has existing relationship with VP Eng', 'No procurement contact identified'],
          opportunities: ['$3-5M cloud migration budget', 'AI governance emerging need', 'Team expansion = more buying committee members'],
          threats: ['Competitor X aggressive pricing', 'Slow procurement timeline', 'Budget reallocation risk'],
        }),
        nextSteps: 'Schedule CFO ROI presentation. Deep-dive with Alex Kumar on integration.',
      },
    })
  }

  // Enterprise research card
  if (!(await db.companyResearchCard.findUnique({ where: { companyId: acme.id } }))) {
    await db.companyResearchCard.create({
      data: {
        companyId: acme.id,
        businessOverview: 'Acme Corp is a Fortune 500 enterprise software company. 5,000+ employees. Revenue: $2.4B. Digital transformation including cloud migration, AI adoption.',
        techLandscape: 'Hybrid cloud (AWS + on-premise). Java, Python, PostgreSQL, legacy Oracle.',
        potentialChallenges: 'Legacy data migration, skills gap, data governance, multi-vendor integration.',
        possibleOpportunities: 'AI governance framework, cloud migration intelligence, data modernization.',
        relevantServices: 'Enterprise AI platform, cloud migration consulting, data governance.',
        strategicPriorities: JSON.stringify([{ priority: 'Cloud Migration', description: 'Migrate to AWS within 18 months', evidence: 'Discovery call with CTO', confidence: 95 }]),
        businessProblems: JSON.stringify(['Legacy system migration', 'Data governance', 'AI adoption strategy']),
        transformationAreas: JSON.stringify(['Cloud migration', 'AI/ML adoption', 'Data modernization']),
      },
    })
  }

  // Enterprise signals
  if ((await db.companySignal.count({ where: { companyId: acme.id } })) === 0) {
    await db.companySignal.createMany({
      data: [
        { companyId: acme.id, signalType: 'tech_change', title: 'AWS Migration Initiative: Multi-phase cloud migration from on-premise', description: 'Acme Corp announced plans to migrate all workloads to AWS within 18 months', severity: 'critical', confidence: 0.9, businessImpact: '$3-5M cloud migration budget — major opportunity', recommendedAction: 'Position AI intelligence layer for migration planning', timingWindow: 'within_90_days', status: 'active' },
        { companyId: acme.id, signalType: 'hiring', title: 'Cloud Engineering Team Expansion: Hiring 5+ cloud engineers in Q3', description: 'Job postings indicate aggressive cloud team hiring', severity: 'high', confidence: 0.8, businessImpact: 'Team expansion signals commitment to cloud transformation', recommendedAction: 'Engage during hiring process — new hires will need tooling', timingWindow: 'within_30_days', status: 'active' },
        { companyId: acme.id, signalType: 'leadership', title: 'New VP Engineering: James Wilson joined from competitor', description: 'James Wilson joined Acme Corp as VP Engineering', severity: 'high', confidence: 0.85, businessImpact: 'New leadership may shift technology decisions', recommendedAction: 'Build relationship with new VP', timingWindow: 'within_30_days', status: 'active' },
        { companyId: acme.id, signalType: 'partnership', title: 'Strategic AWS Partnership: Deepening cloud partnership', description: 'Acme Corp and AWS announced expanded partnership', severity: 'medium', confidence: 0.75, businessImpact: 'AWS partnership validates cloud direction', recommendedAction: 'Explore AWS marketplace co-sell', timingWindow: 'within_90_days', status: 'active' },
        { companyId: acme.id, signalType: 'funding', title: '$50M Digital Transformation Investment', description: 'Board approved $50M for digital transformation', severity: 'critical', confidence: 0.88, businessImpact: 'Major budget commitment — strong buying signal', recommendedAction: 'Position in transformation budget', timingWindow: 'immediate', status: 'active' },
      ],
    })
  }
  scenarios.push({ companyId: acme.id, name: 'Acme Corp', type: 'enterprise' })

  // ── Scenario 2: Mid-Market (TechStart Inc) ──
  let techStart = await db.company.findFirst({ where: { rawName: 'TechStart Inc' } })
  if (!techStart) {
    const batch2 = await db.importBatch.create({ data: { fileName: 'seed.csv', fileHash: 'seed_midmarket', totalRows: 3, acceptedRows: 3, status: 'completed' } })
    techStart = await db.company.create({
      data: {
        rawName: 'TechStart Inc', normalizedName: 'techstart inc', domain: 'techstart.io',
        industry: 'SaaS', sizeRange: 'midmarket', country: 'United States',
        location: 'Austin, TX', website: 'https://techstart.io',
        status: 'researching', lifecycleStage: 'discovery', intelligenceScore: 45,
      },
    })
    const tsBatch = await db.importBatch.create({ data: { fileName: 'seed_ts_contacts.csv', fileHash: 'seed_ts', totalRows: 3, acceptedRows: 3, status: 'completed' } })
    const lisa = await db.contact.create({
      data: { rawName: 'Lisa Wong', normalizedName: 'lisa wong', email: 'lisa@techstart.io', title: 'Head of Data', companyId: techStart.id, batchId: tsBatch.id, leadScore: 55, status: 'replied', lastContactedAt: new Date(Date.now() - 8 * 86400000), engagementScore: 45 },
    })
    await db.contact.createMany({
      data: [
        { rawName: 'Priya Sharma', normalizedName: 'priya sharma', email: 'priya@techstart.io', title: 'CEO & Co-Founder', companyId: techStart.id, batchId: tsBatch.id, leadScore: 70, status: 'imported' },
        { rawName: 'David Park', normalizedName: 'david park', email: 'david@techstart.io', title: 'VP Product', companyId: techStart.id, batchId: tsBatch.id, leadScore: 60, status: 'imported', lastContactedAt: new Date(Date.now() - 25 * 86400000) },
      ],
    })
    await db.reply.create({ data: { contactId: lisa.id, subject: 'Re: Data strategy discussion', body: 'Thanks for reaching out — we are indeed looking at data intelligence solutions. Would love to schedule a call next week.', category: 'positive' } })
  }
  if ((await db.companyNote.count({ where: { companyId: techStart.id } })) === 0) {
    await db.companyNote.createMany({
      data: [
        { companyId: techStart.id, title: 'Initial Research Notes', category: 'research', body: 'TechStart is a fast-growing SaaS company in the data analytics space. Series B funded, $15M ARR, growing 80% YoY. They are building out their data team and looking for intelligence solutions.', author: 'System' },
        { companyId: techStart.id, title: 'Discovery Call', category: 'discovery', body: 'Had a call with Lisa Wong (Head of Data). She mentioned they are struggling with competitive intelligence — manually tracking 50+ competitors takes 3 hours/week. Budget is available but need to justify ROI to CEO Priya.', author: 'John Smith' },
      ],
    })
  }
  if ((await db.companySignal.count({ where: { companyId: techStart.id } })) === 0) {
    await db.companySignal.createMany({
      data: [
        { companyId: techStart.id, signalType: 'hiring', title: 'Hiring Data Engineers and ML Engineers', severity: 'medium', confidence: 0.7, businessImpact: 'Team expansion indicates growth and data investment', recommendedAction: 'Engage with data team building needs', timingWindow: 'within_30_days', status: 'active' },
        { companyId: techStart.id, signalType: 'leadership', title: 'New Head of Data: Lisa Wong joined from DataCorp', severity: 'medium', confidence: 0.75, businessImpact: 'New data leadership may bring new tooling preferences', recommendedAction: 'Build relationship with new Head of Data', timingWindow: 'within_7_days', status: 'active' },
      ],
    })
  }
  scenarios.push({ companyId: techStart.id, name: 'TechStart Inc', type: 'midmarket' })

  // ── Scenario 3: Small Company (LocalBiz Solutions) ──
  let localBiz = await db.company.findFirst({ where: { rawName: 'LocalBiz Solutions' } })
  if (!localBiz) {
    const batch3 = await db.importBatch.create({ data: { fileName: 'seed.csv', fileHash: 'seed_small', totalRows: 2, acceptedRows: 2, status: 'completed' } })
    localBiz = await db.company.create({
      data: {
        rawName: 'LocalBiz Solutions', normalizedName: 'localbiz solutions', domain: 'localbiz.co',
        industry: 'Professional Services', sizeRange: 'small', country: 'India',
        location: 'Bangalore, Karnataka', website: 'https://localbiz.co',
        status: 'active', lifecycleStage: 'proposal', intelligenceScore: 30,
      },
    })
    const lbBatch = await db.importBatch.create({ data: { fileName: 'seed_lb_contacts.csv', fileHash: 'seed_lb', totalRows: 2, acceptedRows: 2, status: 'completed' } })
    const rajesh = await db.contact.create({
      data: { rawName: 'Rajesh Kumar', normalizedName: 'rajesh kumar', email: 'rajesh@localbiz.co', title: 'Founder & CEO', companyId: localBiz.id, batchId: lbBatch.id, leadScore: 75, status: 'replied', lastContactedAt: new Date(Date.now() - 3 * 86400000), engagementScore: 65 },
    })
    const anita = await db.contact.create({
      data: { rawName: 'Anita Desai', normalizedName: 'anita desai', email: 'anita@localbiz.co', title: 'Operations Manager', companyId: localBiz.id, batchId: lbBatch.id, leadScore: 50, status: 'replied', lastContactedAt: new Date(Date.now() - 10 * 86400000), engagementScore: 40 },
    })
    // Rajesh replies
    for (const r of [
      { subject: 'Re: Initial outreach', body: 'Thanks for reaching out! We are actually looking for something like this. Can we schedule a demo?', category: 'positive' },
      { subject: 'Re: Demo follow-up', body: 'The demo was impressive. How does pricing work for a team of 15? We need something simple, not enterprise-level complexity.', category: 'positive' },
      { subject: 'Pricing question', body: 'We need this within the next quarter. Our current manual process is killing productivity. Can you send a proposal?', category: 'positive' },
    ]) {
      await db.reply.create({ data: { contactId: rajesh.id, ...r } })
    }
    await db.reply.create({
      data: { contactId: anita.id, subject: 'Re: Operations use case', body: 'I am the main user — Rajesh wants me to evaluate this for the operations team. My biggest pain point is tracking client deliverables across projects.', category: 'positive' },
    })
    // Contact notes
    await db.contactNote.createMany({
      data: [
        { contactId: rajesh.id, body: 'Rajesh is very engaged — responded to every email within hours. He is the decision maker and budget holder. Expressed urgency: "We need this before Q3." His main pain point is manual client tracking across spreadsheets.' },
        { contactId: rajesh.id, body: 'Rajesh mentioned they are growing fast — went from 10 to 25 employees in the last year. Planning to double again next year. This growth is creating operational chaos that our solution directly addresses.' },
        { contactId: anita.id, body: 'Anita is the primary user and evaluator. She gave a detailed account of their workflow pain: tracking deliverables for 40+ clients across 3 project managers. Currently using Google Sheets and WhatsApp groups. She said "anything that centralizes this would be a lifesaver."' },
      ],
    })
  }
  if ((await db.companyNote.count({ where: { companyId: localBiz.id } })) === 0) {
    await db.companyNote.createMany({
      data: [
        { companyId: localBiz.id, title: 'Discovery Call Notes', category: 'discovery', body: 'Had a 45-min discovery call with Rajesh and Anita. Key findings: (1) Budget approved for Q3 — ~$15K/year, (2) Decision will be made by Rajesh with input from Anita, (3) No competitor evaluation happening — we are the first vendor they are seriously considering, (4) Timeline: want to implement within 4 weeks of signing, (5) 15 users initially, scaling to 30 next year. This is a strong opportunity — warm champion in Rajesh, clear pain point, budget available, no competition.', author: 'John Smith', pinned: true },
        { companyId: localBiz.id, title: 'SWOT — LocalBiz', category: 'swot', body: 'Strengths: Warm relationship, clear pain point, budget available, no competition. Weaknesses: Small deal size ($15K), limited expansion revenue. Opportunities: Reference customer for SMB segment, expansion as they grow. Threats: Budget constraints if growth slows, decision may take longer than expected.', author: 'Jane Doe' },
        { companyId: localBiz.id, title: 'Proposal Notes', category: 'general', body: 'Proposal sent for 15-user license at $12K/year. Rajesh said the number looks right but wants to confirm with their accountant. Anita confirmed the user stories are accurate. Next step: follow up next Tuesday for decision.', author: 'John Smith' },
      ],
    })
  }
  // NO external signals for small company — this is the key test!
  scenarios.push({ companyId: localBiz.id, name: 'LocalBiz Solutions', type: 'small_company' })

  console.log(`  ✓ Seeded ${scenarios.length} scenarios in ${Date.now() - start}ms`)
  return scenarios
}

// ═══════════════════════════════════════════════════════════════
// AI CALLER (direct LLM access, same as ai-caller.ts)
// ═══════════════════════════════════════════════════════════════

// Retry wrapper with exponential backoff using ZAI SDK
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const { ensureZaiConfig } = await import('../src/lib/zai-config')
  await ensureZaiConfig()
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default)
  const zai = await ZAI.create()

  const maxRetries = 4
  let lastErr: Error | null = null
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await zai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      })
      return result.choices[0]?.message?.content || ''
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      const isRateLimit = lastErr.message.includes('429')
      const delay = isRateLimit
        ? Math.pow(2, i) * 5000 + Math.random() * 2000 // 5s, 10s, 20s, 40s for rate limits
        : Math.pow(2, i) * 1000 + Math.random() * 500  // 1s, 2s, 4s for other errors
      console.log(`  ⚠ LLM call failed (attempt ${i + 1}/${maxRetries}), retrying in ${Math.round(delay / 1000)}s: ${lastErr.message.substring(0, 100)}`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function parseJSON(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    const obj = JSON.parse(cleaned)
    if (obj && typeof obj === 'object') return obj as Record<string, unknown>
  } catch { }
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) as Record<string, unknown> } catch { }
  }
  return { raw }
}

// ═══════════════════════════════════════════════════════════════
// 6 ACTION GENERATORS (mirrors action-engine modules)
// ═══════════════════════════════════════════════════════════════

const GROUND_RULES = `GROUND RULES:
1. Use ONLY the provided company data, signals, contacts, and research information.
2. DO NOT invent, fabricate, or assume any information not present in the data.
3. If data is insufficient, explicitly say "Insufficient data" rather than guessing.
4. Every recommendation MUST be traceable to a specific signal, evidence item, or contact.
5. Be specific and actionable.
6. Combine BOTH external intelligence AND internal memory. Internal memory is often MORE valuable for small/mid-market companies.`

// ── Context Builder ──

async function buildContext(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, rawName: true, industry: true, domain: true, sizeRange: true, country: true, status: true, lifecycleStage: true },
  })
  if (!company) throw new Error(`Company ${companyId} not found`)

  const [
    signals, contacts, notes, contactNotes, strategy, researchCard, replies
  ] = await Promise.all([
    db.companySignal.findMany({ where: { companyId, status: { in: ['detected', 'validated', 'active'] } }, orderBy: { confidence: 'desc' }, take: 20 }),
    db.contact.findMany({ where: { companyId, status: { not: 'archived' } }, include: { _count: { select: { replies: true, notes: true } } }, orderBy: { leadScore: 'desc' }, take: 15 }),
    db.companyNote.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    db.contactNote.findMany({ where: { contact: { companyId } }, orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, body: true, createdAt: true, contact: { select: { rawName: true, title: true } } } }),
    db.accountStrategy.findFirst({ where: { companyId, status: { in: ['active', 'review', 'draft'] } } }),
    db.companyResearchCard.findUnique({ where: { companyId } }),
    db.reply.findMany({ where: { contact: { companyId } }, orderBy: { receivedAt: 'desc' }, take: 10 }),
  ])

  return { company, signals, contacts, notes, contactNotes, strategy, researchCard, replies }
}

function formatSignals(signals: Awaited<ReturnType<typeof buildContext>>['signals']): string {
  if (signals.length === 0) return 'NO EXTERNAL SIGNALS — Intelligence comes entirely from internal memory.'
  return signals.slice(0, 10).map((s, i) =>
    `${i + 1}. [${s.signalType.toUpperCase()}/${s.severity}] ${s.title} (confidence: ${Math.round(s.confidence * 100)}%) — ${s.businessImpact || 'No impact stated'} — Action: ${s.recommendedAction || 'Review'}`
  ).join('\n')
}

function formatContacts(contacts: Awaited<ReturnType<typeof buildContext>>['contacts']): string {
  if (contacts.length === 0) return 'No contacts.'
  return contacts.slice(0, 8).map(c =>
    `- ${c.rawName} (${c.title || c.role || 'Unknown'}) — lead score ${c.leadScore}, ${c._count.replies} replies, ${c.status}, ${c.lastContactedAt ? Math.floor((Date.now() - c.lastContactedAt.getTime()) / 86400000) + 'd ago' : 'never contacted'}`
  ).join('\n')
}

function formatNotes(notes: Awaited<ReturnType<typeof buildContext>>['notes']): string {
  if (notes.length === 0) return 'No internal notes.'
  return notes.slice(0, 6).map((n, i) =>
    `${i + 1}. [${n.category.toUpperCase()}] ${n.title || 'Untitled'} (by ${n.author || 'unknown'})\n   ${n.body.substring(0, 200)}`
  ).join('\n\n')
}

function formatContactNotes(cn: Awaited<ReturnType<typeof buildContext>>['contactNotes']): string {
  if (cn.length === 0) return 'No contact-level notes.'
  return cn.slice(0, 5).map((n, i) =>
    `${i + 1}. ${n.contact.rawName} (${n.contact.title || 'Unknown'})\n   ${n.body.substring(0, 150)}`
  ).join('\n\n')
}

function formatReplies(replies: Awaited<ReturnType<typeof buildContext>>['replies']): string {
  if (replies.length === 0) return 'No email replies.'
  return replies.slice(0, 6).map(r =>
    `- [${r.category}] ${r.subject}: ${r.body.substring(0, 100)}`
  ).join('\n')
}

// ── 1. Meeting Prep ──

async function generateMeetingPrep(companyId: string) {
  const ctx = await buildContext(companyId)
  const sysPrompt = `${GROUND_RULES}

You are a B2B sales meeting preparation assistant. Generate a concise, actionable meeting prep brief.
Return JSON only:
{
  "executiveSummary": "2-3 sentence brief combining external signals AND internal memory",
  "keyChanges": [{"change": "What changed", "source": "Signal or note source", "timing": "When"}],
  "talkingPoints": [{"point": "Talking point", "evidence": "Supporting evidence", "priority": "high|medium"}],
  "discoveryQuestions": ["Open-ended strategic question"],
  "icebreakers": ["Personalized icebreaker referencing actual intelligence"],
  "risks": ["Risk to prepare for"],
  "recommendedObjective": "What the AE should aim to achieve"
}`

  const userPrompt = `Prepare a meeting brief for ${ctx.company.rawName} (${ctx.company.industry || 'Unknown'}, ${ctx.company.sizeRange || 'Unknown'}).

EXTERNAL SIGNALS (${ctx.signals.length}):
${formatSignals(ctx.signals)}

INTERNAL NOTES (${ctx.notes.length}):
${formatNotes(ctx.notes)}

CONTACT NOTES (${ctx.contactNotes.length}):
${formatContactNotes(ctx.contactNotes)}

EMAIL REPLIES (${ctx.replies.length}):
${formatReplies(ctx.replies)}

KEY CONTACTS (${ctx.contacts.length}):
${formatContacts(ctx.contacts)}

ACCOUNT STRATEGY: ${ctx.strategy ? ctx.strategy.title + ': ' + (ctx.strategy.objective || '') : 'No strategy defined'}`

  const raw = await callLLM(sysPrompt, userPrompt)
  return parseJSON(raw)
}

// ── 2. Executive Outreach ──

async function generateExecutiveOutreach(companyId: string) {
  const ctx = await buildContext(companyId)

  const sysPrompt = `${GROUND_RULES}

You are a B2B executive outreach strategist. Generate personalized outreach intelligence.
Return JSON only:
{
  "summary": "2-3 sentence outreach strategy",
  "targets": [{"name": "Name", "title": "Title", "reason": "Why target now", "approach": "How to approach", "messaging": "2-3 sentence personalized message", "priority": "critical|high|medium|low"}],
  "outreachStrategy": "Sequencing strategy",
  "quickWins": ["Most likely to respond and why"],
  "risks": ["Risks and mitigations"]
}`

  const userPrompt = `Generate executive outreach intelligence for ${ctx.company.rawName} (${ctx.company.industry}).

SIGNALS:
${formatSignals(ctx.signals)}

NOTES:
${formatNotes(ctx.notes)}

CONTACTS:
${formatContacts(ctx.contacts)}`

  const raw = await callLLM(sysPrompt, userPrompt)
  return parseJSON(raw)
}

// ── 3. Account Strategy ──

async function generateAccountStrategy(companyId: string) {
  const ctx = await buildContext(companyId)

  const sysPrompt = `${GROUND_RULES}

You are a strategic B2B account planning consultant. Generate a comprehensive account strategy.
Return JSON only:
{
  "executiveSummary": "2-3 sentence strategic overview",
  "priorities": [{"priority": "Name", "rationale": "Why now", "evidence": "Supporting intelligence", "urgency": "critical|high|medium"}],
  "solutionAlignment": [{"capability": "Our capability", "evidence": "Why it fits", "fitScore": 85}],
  "risks": [{"risk": "Risk", "probability": "high|medium|low", "mitigation": "Mitigation action"}],
  "opportunityAreas": [{"area": "Area", "estimatedValue": "Range", "buyingStage": "Stage", "confidence": 75}],
  "competitivePosition": "Competitive analysis",
  "nextSteps": [{"action": "Action", "owner": "Who", "timeline": "When", "priority": "critical|high|medium"}]
}`

  const userPrompt = `Generate account strategy for ${ctx.company.rawName} (${ctx.company.industry}, ${ctx.company.sizeRange}, ${ctx.company.lifecycleStage}).

EXTERNAL SIGNALS (${ctx.signals.length}):
${formatSignals(ctx.signals)}

INTERNAL NOTES (${ctx.notes.length}):
${formatNotes(ctx.notes)}

CONTACT NOTES (${ctx.contactNotes.length}):
${formatContactNotes(ctx.contactNotes)}

CONTACTS (${ctx.contacts.length}):
${formatContacts(ctx.contacts)}

STRATEGY: ${ctx.strategy ? ctx.strategy.title + ': ' + (ctx.strategy.objective || '') : 'None'}`

  const raw = await callLLM(sysPrompt, userPrompt)
  return parseJSON(raw)
}

// ── 4. Stakeholder Map ──

async function generateStakeholderMap(companyId: string) {
  const ctx = await buildContext(companyId)

  const sysPrompt = `${GROUND_RULES}

You are a B2B stakeholder mapping expert. Generate a stakeholder map.
Return JSON only:
{
  "summary": "Stakeholder landscape summary",
  "buyingRoles": {
    "economicBuyers": [{"name": "Name", "title": "Title", "approach": "How to engage"}],
    "technicalBuyers": [{"name": "Name", "title": "Title", "approach": "How to engage"}],
    "champions": [{"name": "Name", "title": "Title", "approach": "How to engage"}],
    "coaches": [{"name": "Name", "title": "Title", "approach": "How to engage"}]
  },
  "coverageGaps": ["Gap description"],
  "recommendations": ["Strategic recommendation"],
  "multiThreadingPlan": "Step-by-step engagement sequence"
}`

  const userPrompt = `Generate stakeholder map for ${ctx.company.rawName}.

CONTACTS:
${formatContacts(ctx.contacts)}

NOTES (for relationship context):
${formatNotes(ctx.notes)}

CONTACT NOTES:
${formatContactNotes(ctx.contactNotes)}

REPLIES:
${formatReplies(ctx.replies)}`

  const raw = await callLLM(sysPrompt, userPrompt)
  return parseJSON(raw)
}

// ── 5. Opportunity Qualification ──

async function generateOpportunityQualification(companyId: string) {
  const ctx = await buildContext(companyId)

  // Data-driven scoring
  const highSeverity = ctx.signals.filter(s => s.severity === 'critical' || s.severity === 'high').length
  const hasChampion = ctx.contacts.some(c => c._count.replies >= 2 && c.leadScore >= 50)
  const activeContacts = ctx.contacts.filter(c => c._count.replies > 0 || c.status === 'replied').length
  const signalStrength = Math.min(100, highSeverity * 20 + ctx.signals.length * 5)
  const timingReadiness = Math.min(100, ctx.signals.filter(s => s.timingWindow === 'immediate').length * 25 + ctx.signals.length * 8)
  const relationshipHealth = Math.min(100, (hasChampion ? 40 : 0) + activeContacts * 15 + ctx.contacts.length * 3)
  const strategicFit = Math.min(100, (ctx.company.industry ? 25 : 0) + (ctx.strategy ? 25 : 0) + (ctx.replies.length > 0 ? 25 : 0) + ctx.notes.length * 5)
  const overall = Math.round(signalStrength * 0.25 + timingReadiness * 0.20 + strategicFit * 0.20 + relationshipHealth * 0.20 + 25)

  const verdict = overall >= 75 ? 'strong_fit' : overall >= 55 ? 'good_fit' : overall >= 40 ? 'uncertain' : overall >= 25 ? 'weak_fit' : 'no_fit'

  const sysPrompt = `${GROUND_RULES}

You are a B2B opportunity qualification expert. Qualify this opportunity.
Return JSON only:
{
  "executiveSummary": "2-3 sentence qualification verdict",
  "buyingSignals": [{"signal": "Signal", "type": "type", "strength": "strong|moderate|weak", "evidence": "Evidence"}],
  "timingAssessment": {"window": "Best timing", "urgency": "Why now", "catalyst": "Catalyst", "risk": "Timing risk"},
  "strategicFit": {"needAlignment": "Needs alignment", "budgetIndicator": "Budget signals"},
  "relationshipHealth": {"championPresent": true, "accessLevel": "C-suite|VP|Director|None", "engagementTrend": "improving|stable|declining", "riskFactors": ["Risk"]},
  "qualificationQuestions": ["Strategic question"],
  "recommendedNextStep": "Specific next step",
  "estimatedDealSize": "Estimated range",
  "competition": ["Competitor"]
}`

  const userPrompt = `Qualify opportunity for ${ctx.company.rawName} (${ctx.company.industry}, ${ctx.company.sizeRange}, stage: ${ctx.company.lifecycleStage}).

SIGNALS (${ctx.signals.length}, ${highSeverity} high-severity):
${formatSignals(ctx.signals)}

NOTES (${ctx.notes.length}):
${formatNotes(ctx.notes)}

CONTACT NOTES (${ctx.contactNotes.length}):
${formatContactNotes(ctx.contactNotes)}

CONTACTS (${ctx.contacts.length}, ${activeContacts} active, champion: ${hasChampion}):
${formatContacts(ctx.contacts)}

REPLIES (${ctx.replies.length}):
${formatReplies(ctx.replies)}

DATA-DRIVEN SCORES:
- Signal Strength: ${signalStrength}/100
- Timing Readiness: ${timingReadiness}/100
- Strategic Fit: ${strategicFit}/100
- Relationship Health: ${relationshipHealth}/100
- OVERALL: ${overall}/100 (${verdict})`

  const raw = await callLLM(sysPrompt, userPrompt)
  return parseJSON(raw)
}

// ── 6. Next Best Action ──

async function generateNextBestAction(companyId: string) {
  const ctx = await buildContext(companyId)

  const criticalSignals = ctx.signals.filter(s => s.severity === 'critical').length
  const championAtRisk = ctx.contacts.filter(c => c._count.replies >= 2 && c.leadScore >= 50 && c.lastContactedAt && (Date.now() - c.lastContactedAt.getTime()) / 86400000 > 45)
  const noEngagement = ctx.contacts.filter(c => c.status !== 'replied' && c._count.replies === 0 && c.leadScore >= 60)

  const sysPrompt = `${GROUND_RULES}

You are a B2B revenue intelligence analyst. Identify the SINGLE most impactful next action a salesperson should take RIGHT NOW.
Return JSON only:
{
  "action": "Specific action (e.g. 'Email Sarah Chen with cloud migration insight')",
  "actionType": "outreach|meeting|research|internal_coordination|follow_up|proposal|escalation",
  "priority": "critical|high|medium|low",
  "urgency": "immediate|within_24_hours|within_7_days|within_30_days",
  "reason": "Why this is the best action right now (2-3 sentences)",
  "evidence": [{"source": "signal_type", "snippet": "Evidence snippet"}],
  "expectedOutcome": "What should happen",
  "effort": "low|medium|high",
  "talkingPoint": "Specific talking point or message",
  "successMetric": "How to measure success",
  "alternatives": [{"action": "Alternative", "reason": "Why second choice"}]
}`

  const userPrompt = `What is the single best next action for ${ctx.company.rawName}?

KEY DATA:
- Critical signals: ${criticalSignals}
- Champions at risk: ${championAtRisk.map(c => c.rawName).join(', ') || 'None'}
- High-value unengaged: ${noEngagement.map(c => c.rawName).join(', ') || 'None'}
- Stage: ${ctx.company.lifecycleStage}

SIGNALS:
${formatSignals(ctx.signals)}

NOTES:
${formatNotes(ctx.notes)}

CONTACT NOTES:
${formatContactNotes(ctx.contactNotes)}

CONTACTS:
${formatContacts(ctx.contacts)}

REPLIES:
${formatReplies(ctx.replies)}`

  const raw = await callLLM(sysPrompt, userPrompt)
  return parseJSON(raw)
}

// ═══════════════════════════════════════════════════════════════
// QUALITY ANALYSIS
// ═══════════════════════════════════════════════════════════════

interface QualityReport {
  evidenceGrounding: string   // Are claims backed by data?
  internalExternalBalance: string  // Correct prioritization?
  specificity: string         // Specific vs generic?
  actionability: string       // Would a salesperson use this?
  traceability: string        // Can we trace recommendations back?
}

function analyzeQuality(
  scenario: ScenarioData,
  ctx: Awaited<ReturnType<typeof buildContext>>,
  results: Map<string, Record<string, unknown>>
): QualityReport {
  const externalSignals = ctx.signals.length
  const internalNotes = ctx.notes.length
  const contactNotesCount = ctx.contactNotes.length
  const replyCount = ctx.replies.length
  const contactCount = ctx.contacts.length

  // Check if AI mentioned specific data points
  const allText = JSON.stringify(results).toLowerCase()
  const companyLower = ctx.company.rawName.toLowerCase()

  // Check evidence grounding
  const mentionsCompany = allText.includes(companyLower)
  const mentionsContactNames = ctx.contacts.some(c => allText.includes(c.rawName.toLowerCase().split(' ')[0].toLowerCase()))
  const mentionsSignals = ctx.signals.some(s => allText.includes(s.title.toLowerCase().substring(0, 20)))
  const mentionsNotes = ctx.notes.some(n => allText.includes(n.title.toLowerCase().substring(0, 15)))
  const mentionsInternalDetail = allText.includes('budget') || allText.includes('migration') || allText.includes('pricing') || allText.includes('proposal') || allText.includes('discovery')

  let evidenceGrounding = 'FAIL'
  if (mentionsCompany && mentionsContactNames) evidenceGrounding = 'STRONG'
  else if (mentionsCompany || mentionsNotes) evidenceGrounding = 'PARTIAL'

  // Internal/external balance
  let internalExternalBalance = 'NEUTRAL'
  if (scenario.type === 'small_company') {
    if (allText.includes('note') || allText.includes('call') || allText.includes('discovery') || allText.includes('internal') || allText.includes('reply') || allText.includes('engaged')) {
      internalExternalBalance = 'CORRECT — Prioritizing internal memory for zero-external company'
    } else {
      internalExternalBalance = 'WARN — Should lean heavily on internal memory (no external signals)'
    }
  } else if (scenario.type === 'enterprise') {
    if (allText.includes('signal') || allText.includes('migration') || allText.includes('aws') || allText.includes('funding')) {
      internalExternalBalance = 'CORRECT — Leveraging rich external + internal'
    } else {
      internalExternalBalance = 'WARN — Not leveraging external signals enough'
    }
  } else {
    if (allText.includes('note') || allText.includes('signal')) {
      internalExternalBalance = 'CORRECT — Balanced internal + external'
    }
  }

  // Specificity
  const hasSpecificActions = allText.includes('email') || allText.includes('call') || allText.includes('schedule') || allText.includes('send') || allText.includes('prepare')
  const hasSpecificNames = mentionsContactNames
  let specificity = 'FAIL'
  if (hasSpecificActions && hasSpecificNames) specificity = 'STRONG — References specific contacts and actions'
  else if (hasSpecificActions || hasSpecificNames) specificity = 'PARTIAL — Has some specifics but not fully grounded'

  // Actionability
  let actionability = 'UNKNOWN'
  const nba = results.get('next_best_action')
  if (nba) {
    const action = String(nba.action || '').toLowerCase()
    if (action.length > 20 && (action.includes('email') || action.includes('call') || action.includes('schedule') || action.includes('send') || action.includes('follow') || action.includes('prepare') || action.includes('demo') || action.includes('proposal'))) {
      actionability = 'STRONG — Specific, actionable next step'
    } else if (action.length > 20) {
      actionability = 'PARTIAL — Has direction but could be more specific'
    } else {
      actionability = 'FAIL — Too vague to be useful'
    }
  }

  // Traceability
  const hasEvidenceField = Array.from(results.values()).some(r => {
    const v = r as any
    return (v.evidence && Array.isArray(v.evidence) && v.evidence.length > 0) ||
      (v.buyingSignals && Array.isArray(v.buyingSignals) && v.buyingSignals.length > 0) ||
      (v.talkingPoints && Array.isArray(v.talkingPoints)) ||
      (v.targets && Array.isArray(v.targets))
  })
  let traceability = hasEvidenceField ? 'STRONG — Evidence references present' : 'PARTIAL — Claims not explicitly traced'

  return { evidenceGrounding, internalExternalBalance, specificity, actionability, traceability }
}

// ═══════════════════════════════════════════════════════════════
// MAIN VALIDATION
// ═══════════════════════════════════════════════════════════════

async function main() {
  // Force unbuffered output
  const log = (msg: string) => process.stderr.write(msg + '\n')
  const out = (msg: string) => process.stdout.write(msg + '\n')

  out('════════════════════════════════════════════════════════════')
  out('  DeepMindQ Sprint 3B — Action Module Validation')
  out(`  Modules: ${process.argv.includes('--all') ? '6 (all)' : '3 (core)'}`)
  out('════════════════════════════════════════════════════════════')

  const totalStart = Date.now()

  // Step 1: Seed
  const scenarios = await seedAllScenarios()

  const generators = [
    { name: 'meeting_prep', label: 'Meeting Prep Brief', fn: generateMeetingPrep },
    { name: 'next_best_action', label: 'Next Best Action', fn: generateNextBestAction },
    { name: 'opportunity_qualification', label: 'Opportunity Qualification', fn: generateOpportunityQualification },
    { name: 'executive_outreach', label: 'Executive Outreach', fn: generateExecutiveOutreach },
    { name: 'account_strategy', label: 'Account Strategy', fn: generateAccountStrategy },
    { name: 'stakeholder_map', label: 'Stakeholder Map', fn: generateStakeholderMap },
  ]

  const RUN_ALL = process.argv.includes('--all')
  const activeGenerators = RUN_ALL ? generators : generators.slice(0, 3)

  const allQualityReports: Array<{ scenario: string; type: string; report: QualityReport }> = []

  for (const scenario of scenarios) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`  SCENARIO: ${scenario.name} (${scenario.type.toUpperCase()})`)
    console.log(`${'═'.repeat(70)}`)

    // Build context once
    const ctx = await buildContext(scenario.companyId)

    // Print intelligence inventory
    console.log(`\n  ── Intelligence Inventory ──`)
    console.log(`  External Signals: ${ctx.signals.length}`)
    console.log(`  Company Notes:    ${ctx.notes.length}`)
    console.log(`  Contact Notes:    ${ctx.contactNotes.length}`)
    console.log(`  Email Replies:    ${ctx.replies.length}`)
    console.log(`  Contacts:         ${ctx.contacts.length}`)
    console.log(`  Account Strategy: ${ctx.strategy ? 'YES' : 'NO'}`)
    console.log(`  Research Card:    ${ctx.researchCard ? 'YES' : 'NO'}`)

    const results = new Map<string, Record<string, unknown>>()

    // Add delay between scenarios to avoid rate limiting
    if (scenarios.indexOf(scenario) > 0) {
      console.log(`  ⏳ Waiting 10s before next scenario to avoid rate limits...`)
      await new Promise(r => setTimeout(r, 10000))
    }

    for (const gen of activeGenerators) {
      console.log(`\n  ── ${gen.label} ──`)
      const start = Date.now()
      try {
        // Add delay between AI calls to avoid rate limiting
        if (activeGenerators.indexOf(gen) > 0) {
          await new Promise(r => setTimeout(r, 5000))
        }
        const result = await gen.fn(scenario.companyId)
        results.set(gen.name, result)
        console.log(`  ✓ Generated in ${Date.now() - start}ms`)

        // Print key output
        const r = result as any
        switch (gen.name) {
          case 'meeting_prep':
            console.log(`  Executive Summary: ${(r.executiveSummary || '').substring(0, 200)}`)
            console.log(`  Talking Points: ${(r.talkingPoints || []).length}`)
            console.log(`  Discovery Questions: ${(r.discoveryQuestions || []).length}`)
            console.log(`  Icebreakers: ${(r.icebreakers || []).length}`)
            console.log(`  Risks: ${(r.risks || []).length}`)
            break
          case 'executive_outreach':
            console.log(`  Summary: ${(r.summary || '').substring(0, 200)}`)
            console.log(`  Targets: ${(r.targets || []).length}`)
            if (r.targets && r.targets.length > 0) {
              for (const t of r.targets.slice(0, 3)) {
                console.log(`    → ${t.name} (${t.title}) — ${t.priority} — ${(t.reason || '').substring(0, 100)}`)
              }
            }
            break
          case 'account_strategy':
            console.log(`  Executive Summary: ${(r.executiveSummary || '').substring(0, 200)}`)
            console.log(`  Priorities: ${(r.priorities || []).length}`)
            console.log(`  Solution Alignment: ${(r.solutionAlignment || []).length}`)
            console.log(`  Risks: ${(r.risks || []).length}`)
            console.log(`  Opportunity Areas: ${(r.opportunityAreas || []).length}`)
            break
          case 'stakeholder_map':
            console.log(`  Summary: ${(r.summary || '').substring(0, 200)}`)
            const br = r.buyingRoles || {}
            console.log(`  Economic Buyers: ${(br.economicBuyers || []).length}`)
            console.log(`  Technical Buyers: ${(br.technicalBuyers || []).length}`)
            console.log(`  Champions: ${(br.champions || []).length}`)
            console.log(`  Coverage Gaps: ${(r.coverageGaps || []).length}`)
            break
          case 'opportunity_qualification':
            console.log(`  Verdict: ${r.verdict || 'unknown'}`)
            console.log(`  Summary: ${(r.executiveSummary || '').substring(0, 200)}`)
            console.log(`  Buying Signals: ${(r.buyingSignals || []).length}`)
            console.log(`  Qualification Questions: ${(r.qualificationQuestions || []).length}`)
            break
          case 'next_best_action':
            console.log(`  Action: ${r.action || 'None'}`)
            console.log(`  Priority: ${r.priority} | Urgency: ${r.urgency}`)
            console.log(`  Reason: ${(r.reason || '').substring(0, 200)}`)
            console.log(`  Evidence: ${(r.evidence || []).length} sources`)
            console.log(`  Talking Point: ${(r.talkingPoint || '').substring(0, 150)}`)
            console.log(`  Success Metric: ${r.successMetric || 'None'}`)
            break
        }
      } catch (err) {
        console.log(`  ✗ FAILED: ${err instanceof Error ? err.message : String(err)}`)
        results.set(gen.name, { error: String(err) })
      }
    }

    // Quality analysis
    console.log(`\n  ── Quality Analysis ──`)
    const quality = analyzeQuality(scenario, ctx, results)
    allQualityReports.push({ scenario: scenario.name, type: scenario.type, report: quality })
    console.log(`  Evidence Grounding:     ${quality.evidenceGrounding}`)
    console.log(`  Internal/External Balance: ${quality.internalExternalBalance}`)
    console.log(`  Specificity:              ${quality.specificity}`)
    console.log(`  Actionability:           ${quality.actionability}`)
    console.log(`  Traceability:             ${quality.traceability}`)

    // Full JSON dump for detailed review
    console.log(`\n  ── Full Action Artifacts (JSON) ──`)
    for (const [name, data] of results) {
      console.log(`\n  === ${name} ===`)
      console.log(JSON.stringify(data, null, 2).split('\n').map(l => `  ${l}`).join('\n'))
    }
  }

  // ═══ FINAL SUMMARY ═══
  console.log(`\n\n${'═'.repeat(70)}`)
  console.log('  VALIDATION SUMMARY')
  console.log(`${'═'.repeat(70)}`)

  for (const qr of allQualityReports) {
    console.log(`\n  ${qr.scenario} (${qr.type}):`)
    console.log(`    Evidence: ${qr.report.evidenceGrounding}`)
    console.log(`    Balance:  ${qr.report.internalExternalBalance}`)
    console.log(`    Specific: ${qr.report.specificity}`)
    console.log(`    Action:   ${qr.report.actionability}`)
    console.log(`    Trace:    ${qr.report.traceability}`)
  }

  // Final test
  console.log(`\n  ── THE 10-MINUTE TEST ──`)
  console.log(`  "Can a salesperson understand this account in 10 minutes`)
  console.log(`   and decide the right action better than spending 2 hours`)
  console.log(`   doing manual research?"`)
  console.log('')
  const strongCount = allQualityReports.filter(q => q.report.evidenceGrounding === 'STRONG').length
  const actionCount = allQualityReports.filter(q => q.report.actionability.includes('STRONG')).length
  const balanceCorrect = allQualityReports.filter(q => q.report.internalExternalBalance.includes('CORRECT')).length
  if (strongCount >= 2 && actionCount >= 2 && balanceCorrect >= 2) {
    console.log('  ✅ PASS — Action artifacts provide sufficient intelligence density')
    console.log(`     ${strongCount}/3 scenarios have strong evidence grounding`)
    console.log(`     ${actionCount}/3 scenarios have actionable recommendations`)
    console.log(`     ${balanceCorrect}/3 scenarios correctly balance internal/external`)
  } else {
    console.log('  ⚠️  PARTIAL — Some scenarios need improvement')
    console.log(`     ${strongCount}/3 strong evidence grounding`)
    console.log(`     ${actionCount}/3 actionable recommendations`)
    console.log(`     ${balanceCorrect}/3 correct balance`)
  }

  console.log(`\n  Total validation time: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`)
  console.log(`\n${'═'.repeat(70)}\n`)

  await db.$disconnect()
}

main().catch(err => {
  console.error('Validation failed:', err)
  process.exit(1)
})
