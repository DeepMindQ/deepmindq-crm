/**
 * Deterministic CI Seed — Minimal test data for API test validation
 *
 * Creates exactly:
 *  - 10 companies (across all status values)
 *  - 10 contacts (each linked to a company)
 *  - 3 opportunity recommendations
 *  - 3 company research cards
 *  - 2 capability assets
 *  - 2 drafts (linked to contacts)
 *  - 5 timeline events (linked to companies)
 *
 * Run: npx tsx scripts/seed-ci.ts
 * Env:  DATABASE_URL must be set
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed-ci] Starting deterministic seed...')

  // Clean existing data (order matters for FK constraints)
  await prisma.companyTimelineEvent.deleteMany()
  await prisma.companyNote.deleteMany()
  await prisma.draft.deleteMany()
  await prisma.capabilityAsset.deleteMany()
  await prisma.companyResearchCard.deleteMany()
  await prisma.opportunityRecommendation.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.company.deleteMany()

  // ─── Companies ────────────────────────────────────────────────
  // Schema requires: rawName, normalizedName. Optional: domain, industry, sizeRange, website, status, etc.
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        id: 'ci-co-001', rawName: 'AlphaTech Corp', normalizedName: 'alphatech corp',
        domain: 'alphatech.com', website: 'https://alphatech.com', industry: 'Technology',
        status: 'new', sizeRange: 'enterprise',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-002', rawName: 'BetaFinance Ltd', normalizedName: 'betafinance ltd',
        domain: 'betafinance.io', website: 'https://betafinance.io', industry: 'Finance',
        status: 'researching', sizeRange: 'mid-market',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-003', rawName: 'GammaCloud Inc', normalizedName: 'gammacloud inc',
        domain: 'gammacloud.com', website: 'https://gammacloud.com', industry: 'Technology',
        status: 'active', sizeRange: 'mid-market',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-004', rawName: 'DeltaHealth Systems', normalizedName: 'deltahealth systems',
        domain: 'deltahealth.com', website: 'https://deltahealth.com', industry: 'Healthcare',
        status: 'engaged', sizeRange: 'enterprise',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-005', rawName: 'EpsilonAI Labs', normalizedName: 'epsilonai labs',
        domain: 'epsilonai.dev', website: 'https://epsilonai.dev', industry: 'Technology',
        status: 'prospect', sizeRange: 'small',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-006', rawName: 'ZetaRetail Group', normalizedName: 'zetaretail group',
        domain: 'zetaretail.com', website: 'https://zetaretail.com', industry: 'Retail',
        status: 'archived', sizeRange: 'enterprise',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-007', rawName: 'EtaLogistics', normalizedName: 'etalogistics',
        domain: 'etalogistics.co', website: 'https://etalogistics.co', industry: 'Logistics',
        status: 'new', sizeRange: 'mid-market',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-008', rawName: 'ThetaEnergy Corp', normalizedName: 'thetaenergy corp',
        domain: 'thetaenergy.com', website: 'https://thetaenergy.com', industry: 'Energy',
        status: 'researching', sizeRange: 'enterprise',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-009', rawName: 'IotaSecurity', normalizedName: 'iotasecurity',
        domain: 'iotasecurity.io', website: 'https://iotasecurity.io', industry: 'Technology',
        status: 'engaged', sizeRange: 'small',
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-010', rawName: 'KappaMedia Group', normalizedName: 'kappamedia group',
        domain: 'kappamedia.com', website: 'https://kappamedia.com', industry: 'Media',
        status: 'active', sizeRange: 'mid-market',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${companies.length} companies`)

  // ─── Contacts ─────────────────────────────────────────────────
  // Schema requires: rawName, normalizedName, email, companyId, batchId
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        id: 'ci-con-001', rawName: 'Alice Anderson', normalizedName: 'alice anderson',
        email: 'alice@alphatech.com', companyId: 'ci-co-001', batchId: 'ci-batch',
        status: 'active', title: 'CTO', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-002', rawName: 'Bob Brown', normalizedName: 'bob brown',
        email: 'bob@betafinance.io', companyId: 'ci-co-002', batchId: 'ci-batch',
        status: 'active', title: 'VP Engineering', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-003', rawName: 'Carol Chen', normalizedName: 'carol chen',
        email: 'carol@gammacloud.com', companyId: 'ci-co-003', batchId: 'ci-batch',
        status: 'active', title: 'Head of Sales', emailHealth: 'risky',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-004', rawName: 'David Diaz', normalizedName: 'david diaz',
        email: 'david@deltahealth.com', companyId: 'ci-co-004', batchId: 'ci-batch',
        status: 'active', title: 'CEO', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-005', rawName: 'Eva Eriksson', normalizedName: 'eva eriksson',
        email: 'eva@epsilonai.dev', companyId: 'ci-co-005', batchId: 'ci-batch',
        status: 'active', title: 'Director of AI', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-006', rawName: 'Frank Foster', normalizedName: 'frank foster',
        email: 'frank@zetaretail.com', companyId: 'ci-co-006', batchId: 'ci-batch',
        status: 'archived', title: 'COO', emailHealth: 'unknown',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-007', rawName: 'Grace Gupta', normalizedName: 'grace gupta',
        email: 'grace@etalogistics.co', companyId: 'ci-co-007', batchId: 'ci-batch',
        status: 'active', title: 'VP Operations', emailHealth: 'invalid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-008', rawName: 'Henry Huang', normalizedName: 'henry huang',
        email: 'henry@thetaenergy.com', companyId: 'ci-co-008', batchId: 'ci-batch',
        status: 'active', title: 'CFO', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-009', rawName: 'Iris Ito', normalizedName: 'iris ito',
        email: 'iris@iotasecurity.io', companyId: 'ci-co-009', batchId: 'ci-batch',
        status: 'active', title: 'CISO', emailHealth: 'risky',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-010', rawName: 'James Jones', normalizedName: 'james jones',
        email: 'james@kappamedia.com', companyId: 'ci-co-010', batchId: 'ci-batch',
        status: 'active', title: 'VP Product', emailHealth: 'valid',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${contacts.length} contacts`)

  // ─── Opportunity Recommendations ─────────────────────────────────
  // Schema requires: companyId, signalId, capabilityMatchId, opportunityTitle, businessTrigger,
  //   whyNow, businessProblem, recommendedCapability, suggestedConversation
  const opportunities = await Promise.all([
    prisma.opportunityRecommendation.create({
      data: {
        id: 'ci-opp-001', companyId: 'ci-co-001',
        signalId: 'ci-signal-001', capabilityMatchId: 'ci-match-001',
        opportunityTitle: 'Enterprise SaaS Expansion',
        businessTrigger: 'Cloud infrastructure expansion detected',
        whyNow: 'Active cloud migration budget allocated for Q4',
        businessProblem: 'Legacy on-premise systems causing scalability issues',
        recommendedCapability: 'Cloud Infrastructure Services',
        suggestedConversation: 'Discuss cloud migration roadmap and timeline',
        confidenceScore: 0.9, matchScore: 0.85, opportunityScore: 85,
        status: 'pending_review', priority: 'high',
      },
    }),
    prisma.opportunityRecommendation.create({
      data: {
        id: 'ci-opp-002', companyId: 'ci-co-003',
        signalId: 'ci-signal-002', capabilityMatchId: 'ci-match-002',
        opportunityTitle: 'Cloud Migration Services',
        businessTrigger: 'Multi-cloud strategy adoption signal',
        whyNow: 'RFP for cloud migration expected this quarter',
        businessProblem: 'Vendor lock-in with current cloud provider',
        recommendedCapability: 'Multi-Cloud Architecture',
        suggestedConversation: 'Present multi-cloud strategy case study',
        confidenceScore: 0.8, matchScore: 0.72, opportunityScore: 72,
        status: 'accepted', priority: 'medium',
      },
    }),
    prisma.opportunityRecommendation.create({
      data: {
        id: 'ci-opp-003', companyId: 'ci-co-005',
        signalId: 'ci-signal-003', capabilityMatchId: 'ci-match-003',
        opportunityTitle: 'AI Platform Integration',
        businessTrigger: 'AI/ML team expansion hiring signal',
        whyNow: 'New AI initiatives require integration partnerships',
        businessProblem: 'Custom ML models need production deployment',
        recommendedCapability: 'AI/ML Platform Services',
        suggestedConversation: 'Review AI model deployment capabilities',
        confidenceScore: 0.95, matchScore: 0.91, opportunityScore: 91,
        status: 'monitored', priority: 'high',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${opportunities.length} opportunities`)

  // ─── Company Research Cards ─────────────────────────────────────
  // Schema: companyId (unique), plus optional business/tech/challenge fields
  const researchCards = await Promise.all([
    prisma.companyResearchCard.create({
      data: {
        id: 'ci-rc-001', companyId: 'ci-co-001',
        businessOverview: 'AlphaTech is expanding their cloud infrastructure.',
        techLandscape: 'AWS primary, exploring Azure secondary',
      },
    }),
    prisma.companyResearchCard.create({
      data: {
        id: 'ci-rc-002', companyId: 'ci-co-004',
        businessOverview: 'DeltaHealth recently raised Series C funding.',
        potentialChallenges: 'HIPAA compliance requirements for cloud migration',
      },
    }),
    prisma.companyResearchCard.create({
      data: {
        id: 'ci-rc-003', companyId: 'ci-co-008',
        businessOverview: 'ThetaEnergy announced new solar panel technology.',
        possibleOpportunities: 'Green tech partnership opportunities',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${researchCards.length} research cards`)

  // ─── Capability Assets ─────────────────────────────────────────
  // Schema requires: title, summary, category
  const assets = await Promise.all([
    prisma.capabilityAsset.create({
      data: {
        id: 'ci-asset-001', title: 'Cloud Infrastructure',
        summary: 'AWS and Azure cloud deployment capabilities',
        category: 'technology',
      },
    }),
    prisma.capabilityAsset.create({
      data: {
        id: 'ci-asset-002', title: 'AI/ML Platform',
        summary: 'Machine learning model training and deployment',
        category: 'technology',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${assets.length} capability assets`)

  // ─── Drafts ───────────────────────────────────────────────────
  // Schema requires: contactId, subject, body, status
  const drafts = await Promise.all([
    prisma.draft.create({
      data: {
        id: 'ci-draft-001', contactId: 'ci-con-001',
        subject: 'Enterprise Partnership Proposal', body: 'Dear Alice, ...',
        status: 'draft',
      },
    }),
    prisma.draft.create({
      data: {
        id: 'ci-draft-002', contactId: 'ci-con-004',
        subject: 'Health Tech Solutions Demo', body: 'Dear David, ...',
        status: 'pending_review',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${drafts.length} drafts`)

  // ─── Timeline Events ───────────────────────────────────────────
  // Schema requires: companyId, eventType, title
  const timelineEvents = await Promise.all([
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-001', companyId: 'ci-co-001',
        eventType: 'signal', title: 'Company created in CRM',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-002', companyId: 'ci-co-001',
        eventType: 'contact_added', title: 'Alice Anderson added as contact',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-003', companyId: 'ci-co-003',
        eventType: 'enrichment', title: 'Research card updated',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-004', companyId: 'ci-co-004',
        eventType: 'email_sent', title: 'Email health check completed',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-005', companyId: 'ci-co-005',
        eventType: 'signal', title: 'AI Platform Integration opportunity created',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${timelineEvents.length} timeline events`)

  console.log('[seed-ci] Deterministic seed complete.')
  console.log(`  Companies:    ${companies.length}`)
  console.log(`  Contacts:     ${contacts.length}`)
  console.log(`  Opportunities: ${opportunities.length}`)
  console.log(`  Research:     ${researchCards.length}`)
  console.log(`  Assets:       ${assets.length}`)
  console.log(`  Drafts:       ${drafts.length}`)
  console.log(`  Timeline:     ${timelineEvents.length}`)
}

main()
  .catch((e) => {
    console.error('[seed-ci] Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
