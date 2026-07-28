/**
 * POST /api/intelligence/sprint3
 *
 * Sprint 3 Intelligence Pipeline — Unified Memory + Action Generation
 *
 * Endpoints:
 *   POST { mode: "unified_query", companyId }       → "What do we know?" across all 3 layers
 *   POST { mode: "internal_memory", companyId }       → Extract & persist internal memory signals
 *   POST { mode: "people_change", companyId }         → Detect people movement signals
 *   POST { mode: "actions", companyId }               → Delegate to Phase B ActionEngine
 *   POST { mode: "meeting_prep", companyId }           → Delegate to Phase B ConversationEngine
 *   POST { mode: "next_best_action", companyId }      → Delegate to Phase B ActionEngine
 *   POST { mode: "full_pipeline", companyId }         → Internal memory → People change → Actions
 *   POST { mode: "seed_validation" }                  → Seed 3 validation scenarios
 *
 * NOTE: Action modes now delegate to Phase B engines (engines/ directory).
 * The old action-engine/ directory was removed as it was fully superseded.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractInternalMemorySignals, computeInternalMemoryDepth } from '@/lib/intelligence-sources/internal-memory-connector'
import { detectPeopleChanges } from '@/lib/intelligence-sources/people-change-detector'
import { queryUnifiedMemory } from '@/lib/intelligence-sources/unified-memory-query'

// ── Seed Validation Data ──

async function seedValidationData() {
  const startTime = Date.now()

  // ── Scenario 1: Enterprise (Acme Corp — rich external, rich internal) ──
  const acme = await db.company.findFirst({ where: { rawName: 'Acme Corp' } })
  let acmeId = acme?.id

  if (!acmeId) {
    const batch = await db.importBatch.create({
      data: { fileName: 'seed.csv', fileHash: 'seed_enterprise', totalRows: 5, acceptedRows: 5, status: 'completed' },
    })
    acmeId = (await db.company.create({
      data: {
        rawName: 'Acme Corp', normalizedName: 'acme corp', domain: 'acmecorp.com',
        industry: 'Enterprise Software', sizeRange: 'enterprise', country: 'United States',
        location: 'San Francisco, CA', website: 'https://acmecorp.com',
        status: 'active', lifecycleStage: 'qualification', intelligenceScore: 72,
        internalSummary: 'Large enterprise software company with complex buying committee',
      },
    })).id
  }

  // Seed enterprise contacts
  const existingAcmeContacts = await db.contact.count({ where: { companyId: acmeId } })
  if (existingAcmeContacts === 0) {
    const acmeBatch = await db.importBatch.create({ data: { fileName: 'seed_acme_contacts.csv', fileHash: 'seed_acme', totalRows: 5, acceptedRows: 5, status: 'completed' } })

    const contactData = [
      { name: 'Sarah Chen', email: 'sarah.chen@acmecorp.com', title: 'Chief Technology Officer', score: 85, replies: 3 },
      { name: 'James Wilson', email: 'james.wilson@acmecorp.com', title: 'VP Engineering', score: 72, replies: 1 },
      { name: 'Mike Torres', email: 'mike.torres@acmecorp.com', title: 'Director of IT', score: 68, replies: 5 },
      { name: 'Emily Davis', email: 'emily.davis@acmecorp.com', title: 'CFO', score: 78, replies: 0 },
      { name: 'Alex Kumar', email: 'alex.kumar@acmecorp.com', title: 'Cloud Architect', score: 55, replies: 2 },
    ]
    for (const c of contactData) {
      await db.contact.create({
        data: {
          rawName: c.name, normalizedName: c.name.toLowerCase(), email: c.email,
          title: c.title, companyId: acmeId!, batchId: acmeBatch.id,
          leadScore: c.score, engagementScore: c.replies * 20,
          status: c.replies > 0 ? 'replied' : 'imported',
          lastContactedAt: new Date(Date.now() - (c.replies > 0 ? 14 : 60) * 86400000),
        },
      })
    }
  }

  // Seed enterprise internal memory
  const acmeNotes = await db.companyNote.count({ where: { companyId: acmeId } })
  if (acmeNotes === 0) {
    await db.companyNote.createMany({
      data: [
        { companyId: acmeId!, title: 'Q2 Discovery Call Notes', category: 'discovery', body: 'Discovery call with Sarah Chen revealed Acme Corp is undergoing a major cloud migration from on-premise to AWS. Timeline: 12-18 months. Budget: $3-5M. Key challenge: legacy data migration and team skills gap. Sarah mentioned they are evaluating 3 vendors including a competitor. Strong buying signal.', author: 'John Smith', pinned: true },
        { companyId: acmeId!, title: 'SWOT Analysis — Acme Corp', category: 'swot', body: 'Strengths: Large budget, clear technology vision, executive sponsorship. Weaknesses: Slow procurement process, multiple stakeholders with conflicting priorities. Opportunities: Cloud migration is a $5M opportunity, AI governance is emerging need. Threats: Competitor X has existing relationship with VP Engineering.', author: 'Jane Doe' },
        { companyId: acmeId!, title: 'Competitive Intelligence', category: 'competitive', body: 'Competitor X presented to James Wilson (VP Engineering) last month. Feedback was mixed — strong on price but weak on AI capabilities. This is our differentiator. Mike Torres (Director IT) expressed frustration with Competitor X implementation timeline.', author: 'John Smith', pinned: true },
        { companyId: acmeId!, title: 'Meeting Follow-up', category: 'meeting', body: 'Follow-up from exec briefing. Sarah Chen was interested in AI governance framework. Requested a technical deep-dive with Alex Kumar (Cloud Architect). Emily Davis (CFO) wants ROI analysis before proceeding to proposal stage.', author: 'Jane Doe' },
        { companyId: acmeId!, title: 'Call Notes — Technical Discussion', category: 'call', body: 'Call with Alex Kumar covered integration architecture. Key findings: They run a hybrid environment (AWS + on-premise), need API-first approach, concerned about data residency. Alex mentioned team is expanding — hiring 5 cloud engineers in Q3.', author: 'John Smith' },
      ],
    })
  }

  // Seed enterprise account strategy
  const acmeStrategies = await db.accountStrategy.count({ where: { companyId: acmeId } })
  if (acmeStrategies === 0) {
    await db.accountStrategy.create({
      data: {
        companyId: acmeId!, title: 'Acme Corp — Cloud Migration & AI Strategy', status: 'active',
        objective: 'Position DeepMindQ as the primary AI intelligence layer for Acme Corp cloud migration',
        currentSituation: 'Acme Corp is migrating from on-premise to AWS over 12-18 months. Currently evaluating vendors. We have strong champion in Mike Torres and executive access to Sarah Chen.',
        swotAnalysis: JSON.stringify({
          strengths: ['Technical deep-dive completed with Cloud Architect', 'Champion advocate in IT Director', 'AI capabilities differentiate from competitors'],
          weaknesses: ['CFO needs ROI justification', 'Competitor X has existing relationship with VP Eng', 'No procurement contact identified'],
          opportunities: ['$3-5M cloud migration budget', 'AI governance emerging need', 'Team expansion = more buying committee members'],
          threats: ['Competitor X aggressive pricing', 'Slow procurement timeline may delay deal', 'Budget reallocation risk if economy worsens'],
        }),
        nextSteps: 'Schedule CFO ROI presentation. Deep-dive with Alex Kumar on integration. Counter competitor positioning with James Wilson.',
      },
    })
  }

  // Seed enterprise research card
  const acmeCard = await db.companyResearchCard.findUnique({ where: { companyId: acmeId } })
  if (!acmeCard) {
    await db.companyResearchCard.create({
      data: {
        companyId: acmeId!,
        businessOverview: 'Acme Corp is a Fortune 500 enterprise software company headquartered in San Francisco. 5,000+ employees. Revenue: $2.4B. They are undergoing digital transformation including cloud migration, AI adoption, and data modernization.',
        techLandscape: 'Currently running hybrid cloud environment. Migrating from on-premise data centers to AWS. Tech stack includes Java, Python, PostgreSQL, legacy Oracle. Interested in AI/ML capabilities.',
        potentialChallenges: 'Legacy data migration complexity, team skills gap for cloud-native development, data governance requirements, multi-vendor integration.',
        possibleOpportunities: 'AI governance framework, cloud migration consulting, data governance solutions.',
        relevantServices: 'Enterprise AI platform, cloud migration consulting, data governance solutions.',
        strategicPriorities: JSON.stringify([{ priority: 'Cloud Migration', description: 'Migrate to AWS within 18 months', evidence: 'Discovery call with CTO', confidence: 95 }]),
        businessProblems: JSON.stringify(['Legacy system migration', 'Data governance', 'AI adoption strategy']),
        transformationAreas: JSON.stringify(['Cloud migration', 'AI/ML adoption', 'Data modernization']),
      },
    })
  }

  // Seed enterprise signals (simulating Sprint 1 results)
  const acmeSignals = await db.companySignal.count({ where: { companyId: acmeId } })
  if (acmeSignals === 0) {
    await db.companySignal.createMany({
      data: [
        { companyId: acmeId!, signalType: 'tech_change', title: 'AWS Migration Initiative: Multi-phase cloud migration from on-premise', description: 'Acme Corp announced plans to migrate all workloads to AWS within 18 months', severity: 'critical', confidence: 0.9, businessImpact: '$3-5M cloud migration budget — major opportunity', recommendedAction: 'Position AI intelligence layer for migration planning', timingWindow: 'within_90_days', status: 'active' },
        { companyId: acmeId!, signalType: 'hiring', title: 'Cloud Engineering Team Expansion: Hiring 5+ cloud engineers in Q3', description: 'Job postings indicate aggressive cloud team hiring', severity: 'high', confidence: 0.8, businessImpact: 'Team expansion signals commitment to cloud transformation', recommendedAction: 'Engage during hiring process — new hires will need tooling', timingWindow: 'within_30_days', status: 'active' },
        { companyId: acmeId!, signalType: 'leadership', title: 'New VP Engineering: James Wilson joined from competitor', description: 'James Wilson joined Acme Corp as VP Engineering', severity: 'high', confidence: 0.85, businessImpact: 'New leadership may shift technology decisions', recommendedAction: 'Build relationship with new VP — fresh perspective on vendors', timingWindow: 'within_30_days', status: 'active' },
        { companyId: acmeId!, signalType: 'partnership', title: 'Strategic AWS Partnership: Deepening cloud partnership', description: 'Acme Corp and AWS announced expanded partnership for migration', severity: 'medium', confidence: 0.75, businessImpact: 'AWS partnership validates cloud direction — co-sell opportunity', recommendedAction: 'Explore AWS marketplace and partner co-sell opportunities', timingWindow: 'within_90_days', status: 'active' },
        { companyId: acmeId!, signalType: 'funding', title: '$50M Digital Transformation Investment', description: 'Board approved $50M for digital transformation initiatives', severity: 'critical', confidence: 0.88, businessImpact: 'Major budget commitment — strong buying signal', recommendedAction: 'Ensure DeepMindQ is positioned in the transformation budget', timingWindow: 'immediate', status: 'active' },
      ],
    })
  }

  // ── Scenario 2: Mid-Market (TechStart Inc — some external, some internal) ──
  const techStart = await db.company.findFirst({ where: { rawName: 'TechStart Inc' } })
  let techStartId = techStart?.id

  if (!techStartId) {
    const batch2 = await db.importBatch.create({
      data: { fileName: 'seed.csv', fileHash: 'seed_midmarket', totalRows: 3, acceptedRows: 3, status: 'completed' },
    })
    techStartId = (await db.company.create({
      data: {
        rawName: 'TechStart Inc', normalizedName: 'techstart inc', domain: 'techstart.io',
        industry: 'SaaS', sizeRange: 'midmarket', country: 'United States',
        location: 'Austin, TX', website: 'https://techstart.io',
        status: 'researching', lifecycleStage: 'discovery', intelligenceScore: 45,
      },
    })).id
  }

  const existingTsContacts = await db.contact.count({ where: { companyId: techStartId } })
  if (existingTsContacts === 0) {
    const tsBatch = await db.importBatch.create({ data: { fileName: 'seed_ts_contacts.csv', fileHash: 'seed_ts', totalRows: 3, acceptedRows: 3, status: 'completed' } })
    await db.contact.createMany({
      data: [
        { rawName: 'Priya Sharma', normalizedName: 'priya sharma', email: 'priya@techstart.io', title: 'CEO & Co-Founder', companyId: techStartId!, batchId: tsBatch.id, leadScore: 70, status: 'imported' },
        { rawName: 'David Park', normalizedName: 'david park', email: 'david@techstart.io', title: 'VP Product', companyId: techStartId!, batchId: tsBatch.id, leadScore: 60, status: 'imported', lastContactedAt: new Date(Date.now() - 25 * 86400000) },
        { rawName: 'Lisa Wong', normalizedName: 'lisa wong', email: 'lisa@techstart.io', title: 'Head of Data', companyId: techStartId!, batchId: tsBatch.id, leadScore: 55, status: 'replied', lastContactedAt: new Date(Date.now() - 8 * 86400000), engagementScore: 45 },
      ],
    })
    // Add a reply for Lisa
    const lisaContact = await db.contact.findFirst({ where: { email: 'lisa@techstart.io' } })
    if (lisaContact) {
      await db.reply.create({ data: { contactId: lisaContact.id, subject: 'Re: Data strategy discussion', body: 'Thanks for reaching out — we are indeed looking at data intelligence solutions. Would love to schedule a call next week.', category: 'positive' } })
    }
  }

  const tsNotes = await db.companyNote.count({ where: { companyId: techStartId } })
  if (tsNotes === 0) {
    await db.companyNote.createMany({
      data: [
        { companyId: techStartId!, title: 'Initial Research Notes', category: 'research', body: 'TechStart is a fast-growing SaaS company in the data analytics space. Series B funded, $15M ARR, growing 80% YoY. They are building out their data team and looking for intelligence solutions.', author: 'System' },
        { companyId: techStartId!, title: 'Discovery Call', category: 'discovery', body: 'Had a call with Lisa Wong (Head of Data). She mentioned they are struggling with competitive intelligence — manually tracking 50+ competitors takes 3 hours/week. Budget is available but need to justify ROI to CEO Priya.', author: 'John Smith' },
      ],
    })
  }

  const tsSignals = await db.companySignal.count({ where: { companyId: techStartId } })
  if (tsSignals === 0) {
    await db.companySignal.createMany({
      data: [
        { companyId: techStartId!, signalType: 'hiring', title: 'Hiring Data Engineers and ML Engineers', severity: 'medium', confidence: 0.7, businessImpact: 'Team expansion indicates growth phase and data investment', recommendedAction: 'Engage with data team building needs', timingWindow: 'within_30_days', status: 'active' },
        { companyId: techStartId!, signalType: 'leadership', title: 'New Head of Data: Lisa Wong joined from DataCorp', severity: 'medium', confidence: 0.75, businessImpact: 'New data leadership may bring new tooling preferences', recommendedAction: 'Build relationship with new Head of Data', timingWindow: 'within_7_days', status: 'active' },
      ],
    })
  }

  // ── Scenario 3: Small Company (LocalBiz Solutions — near-zero external, strong internal) ──
  const localBiz = await db.company.findFirst({ where: { rawName: 'LocalBiz Solutions' } })
  let localBizId = localBiz?.id

  if (!localBizId) {
    const batch3 = await db.importBatch.create({
      data: { fileName: 'seed.csv', fileHash: 'seed_small', totalRows: 2, acceptedRows: 2, status: 'completed' },
    })
    localBizId = (await db.company.create({
      data: {
        rawName: 'LocalBiz Solutions', normalizedName: 'localbiz solutions', domain: 'localbiz.co',
        industry: 'Professional Services', sizeRange: 'small', country: 'India',
        location: 'Bangalore, Karnataka', website: 'https://localbiz.co',
        status: 'active', lifecycleStage: 'proposal', intelligenceScore: 30,
      },
    })).id
  }

  const lbContacts = await db.contact.count({ where: { companyId: localBizId } })
  if (lbContacts === 0) {
    const lbBatch = await db.importBatch.create({ data: { fileName: 'seed_lb_contacts.csv', fileHash: 'seed_lb', totalRows: 2, acceptedRows: 2, status: 'completed' } })
    await db.contact.createMany({
      data: [
        { rawName: 'Rajesh Kumar', normalizedName: 'rajesh kumar', email: 'rajesh@localbiz.co', title: 'Founder & CEO', companyId: localBizId!, batchId: lbBatch.id, leadScore: 75, status: 'replied', lastContactedAt: new Date(Date.now() - 3 * 86400000), engagementScore: 65 },
        { rawName: 'Anita Desai', normalizedName: 'anita desai', email: 'anita@localbiz.co', title: 'Operations Manager', companyId: localBizId!, batchId: lbBatch.id, leadScore: 50, status: 'replied', lastContactedAt: new Date(Date.now() - 10 * 86400000), engagementScore: 40 },
      ],
    })
    // Add replies
    const rajeshContact = await db.contact.findFirst({ where: { email: 'rajesh@localbiz.co' } })
    const anitaContact = await db.contact.findFirst({ where: { email: 'anita@localbiz.co' } })
    if (rajeshContact) {
      const replyData = [
        { subject: 'Re: Initial outreach', body: 'Thanks for reaching out! We are actually looking for something like this. Can we schedule a demo?', category: 'positive' },
        { subject: 'Re: Demo follow-up', body: 'The demo was impressive. How does pricing work for a team of 15? We need something simple, not enterprise-level complexity.', category: 'positive' },
        { subject: 'Pricing question', body: 'We need this within the next quarter. Our current manual process is killing productivity. Can you send a proposal?', category: 'positive' },
      ]
      for (const r of replyData) {
        await db.reply.create({ data: { contactId: rajeshContact.id, ...r } })
      }
    }
    if (anitaContact) {
      await db.reply.create({
        data: { contactId: anitaContact.id, subject: 'Re: Operations use case', body: 'I am the main user — Rajesh wants me to evaluate this for the operations team. My biggest pain point is tracking client deliverables across projects.', category: 'positive' },
      })
    }
  }

  const lbNotes = await db.contactNote.count({ where: { contact: { companyId: localBizId } } })
  if (lbNotes === 0) {
    const rajesh = await db.contact.findFirst({ where: { email: 'rajesh@localbiz.co' } })
    if (rajesh) {
      await db.contactNote.createMany({
        data: [
          { contactId: rajesh.id, body: 'Rajesh is very engaged — responded to every email within hours. He is the decision maker and budget holder. Expressed urgency: "We need this before Q3." His main pain point is manual client tracking across spreadsheets.' },
          { contactId: rajesh.id, body: 'Rajesh mentioned they are growing fast — went from 10 to 25 employees in the last year. Planning to double again next year. This growth is creating operational chaos that our solution directly addresses.' },
        ],
      })
    }
    const anita = await db.contact.findFirst({ where: { email: 'anita@localbiz.co' } })
    if (anita) {
      await db.contactNote.create({
        data: {
          contactId: anita.id,
          body: 'Anita is the primary user and evaluator. She gave a detailed account of their workflow pain: tracking deliverables for 40+ clients across 3 project managers. Currently using Google Sheets and WhatsApp groups. She said "anything that centralizes this would be a lifesaver."',
        },
      })
    }
  }

  const lbCompanyNotes = await db.companyNote.count({ where: { companyId: localBizId } })
  if (lbCompanyNotes === 0) {
    await db.companyNote.createMany({
      data: [
        { companyId: localBizId!, title: 'Discovery Call Notes', category: 'discovery', body: 'Had a 45-min discovery call with Rajesh and Anita. Key findings: (1) Budget approved for Q3 — ~$15K/year, (2) Decision will be made by Rajesh with input from Anita, (3) No competitor evaluation happening — we are the first vendor they are seriously considering, (4) Timeline: want to implement within 4 weeks of signing, (5) 15 users initially, scaling to 30 next year. This is a strong opportunity — warm champion in Rajesh, clear pain point, budget available, no competition.', author: 'John Smith', pinned: true },
        { companyId: localBizId!, title: 'SWOT — LocalBiz', category: 'swot', body: 'Strengths: Warm relationship, clear pain point, budget available, no competition. Weaknesses: Small deal size ($15K), limited expansion revenue. Opportunities: Reference customer for SMB segment, expansion as they grow. Threats: Budget constraints if growth slows, decision may take longer than expected.', author: 'Jane Doe' },
        { companyId: localBizId!, title: 'Proposal Notes', category: 'general', body: 'Proposal sent for 15-user license at $12K/year. Rajesh said the number looks right but wants to confirm with their accountant. Anita confirmed the user stories are accurate. Next step: follow up next Tuesday for decision.', author: 'John Smith' },
      ],
    })
  }

  // NO external signals for small company — this is the key test!
  // The pipeline should generate rich intelligence from internal memory alone.

  return {
    seeded: true,
    scenarios: {
      enterprise: { companyId: acmeId!, name: 'Acme Corp' },
      midmarket: { companyId: techStartId!, name: 'TechStart Inc' },
      small_company: { companyId: localBizId!, name: 'LocalBiz Solutions' },
    },
    latencyMs: Date.now() - startTime,
  }
}

// ═══════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { mode, companyId, actionTypes } = body as {
      mode?: string
      companyId?: string
      actionTypes?: string[]
    }

    // ── Mode: seed_validation ──
    if (mode === 'seed_validation') {
      const result = await seedValidationData()
      return NextResponse.json({ ...result, mode: 'seed_validation' })
    }

    // ── Validate companyId ──
    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json({ error: 'companyId is required for all modes except seed_validation' }, { status: 400 })
    }

    // ── Mode: unified_query ──
    if (mode === 'unified_query') {
      const result = await queryUnifiedMemory(companyId)
      return NextResponse.json({ mode: 'unified_query', ...result, meta: { ...result.meta, pipelineLatencyMs: Date.now() - startTime } })
    }

    // ── Mode: internal_memory ──
    if (mode === 'internal_memory') {
      const [result, depth] = await Promise.all([
        extractInternalMemorySignals(companyId),
        computeInternalMemoryDepth(companyId),
      ])
      return NextResponse.json({
        mode: 'internal_memory',
        signalsExtracted: result.signalsExtracted,
        signalsPersisted: result.signalsPersisted,
        sources: result.sources,
        memoryDepth: depth,
        pipelineLatencyMs: Date.now() - startTime,
      })
    }

    // ── Mode: people_change ──
    if (mode === 'people_change') {
      const result = await detectPeopleChanges(companyId)
      return NextResponse.json({
        mode: 'people_change',
        signalsExtracted: result.signalsExtracted,
        signalsPersisted: result.signalsPersisted,
        contactAnalysis: result.contactAnalysis,
        pipelineLatencyMs: Date.now() - startTime,
      })
    }

    // ── Mode: actions / meeting_prep / next_best_action ──
    // DELEGATED to Phase B engines — redirect to /api/engines/actions or /api/engines/conversation
    if (mode === 'actions' || mode === 'next_best_action') {
      return NextResponse.json({
        mode: mode,
        message: `Action generation has moved to Phase B engines. Use POST /api/engines/actions instead.`,
        redirect: '/api/engines/actions',
      })
    }
    if (mode === 'meeting_prep') {
      return NextResponse.json({
        mode: mode,
        message: `Meeting prep has moved to Phase B engines. Use POST /api/engines/conversation instead.`,
        redirect: '/api/engines/conversation',
      })
    }

    // ── Mode: full_pipeline (default) ──
    // Internal Memory → People Change → Action recommendations (Phase B)
    const company = await db.company.findUnique({ where: { id: companyId }, select: { rawName: true } })
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    // Step 1: Extract internal memory + people change in parallel
    const [internalResult, peopleResult, memoryDepth] = await Promise.all([
      extractInternalMemorySignals(companyId),
      detectPeopleChanges(companyId),
      computeInternalMemoryDepth(companyId),
    ])

    // Step 2: Actions are now handled by Phase B ActionEngine
    // Users should call POST /api/engines/actions for action generation
    return NextResponse.json({
      mode: 'full_pipeline',
      company: { id: companyId, name: company.rawName },
      internalMemory: {
        signalsExtracted: internalResult.signalsExtracted,
        signalsPersisted: internalResult.signalsPersisted,
        sources: internalResult.sources,
        memoryDepth: memoryDepth.score,
        memoryGrade: memoryDepth.grade,
      },
      peopleChange: {
        signalsExtracted: peopleResult.signalsExtracted,
        signalsPersisted: peopleResult.signalsPersisted,
        contactAnalysis: peopleResult.contactAnalysis,
      },
      actions: {
        note: 'Action generation has moved to Phase B engines. Call POST /api/engines/actions for AI-powered action recommendations.',
      },
      pipelineLatencyMs: Date.now() - startTime,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sprint3] Pipeline error:', message)
    return NextResponse.json({ error: `Sprint 3 pipeline failed: ${message}` }, { status: 500 })
  }
}
