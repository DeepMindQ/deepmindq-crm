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
  await prisma.draft.deleteMany()
  await prisma.capabilityAsset.deleteMany()
  await prisma.companyResearchCard.deleteMany()
  await prisma.opportunityRecommendation.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.company.deleteMany()

  // ─── Companies ────────────────────────────────────────────────
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        id: 'ci-co-001', name: 'AlphaTech Corp', domain: 'alphatech.com',
        website: 'https://alphatech.com', industry: 'Technology', status: 'new',
        rawName: 'AlphaTech Corp', description: 'Enterprise SaaS platform', size: 'enterprise',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-002', name: 'BetaFinance Ltd', domain: 'betafinance.io',
        website: 'https://betafinance.io', industry: 'Finance', status: 'researching',
        rawName: 'BetaFinance Ltd', description: 'Financial analytics platform', size: 'mid-market',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-003', name: 'GammaCloud Inc', domain: 'gammacloud.com',
        website: 'https://gammacloud.com', industry: 'Technology', status: 'ready',
        rawName: 'GammaCloud Inc', description: 'Cloud infrastructure provider', size: 'mid-market',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-004', name: 'DeltaHealth Systems', domain: 'deltahealth.com',
        website: 'https://deltahealth.com', industry: 'Healthcare', status: 'contacted',
        rawName: 'DeltaHealth Systems', description: 'Health tech solutions', size: 'enterprise',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-005', name: 'EpsilonAI Labs', domain: 'epsilonai.dev',
        website: 'https://epsilonai.dev', industry: 'Technology', status: 'qualified',
        rawName: 'EpsilonAI Labs', description: 'AI research lab', size: 'small',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-006', name: 'ZetaRetail Group', domain: 'zetaretail.com',
        website: 'https://zetaretail.com', industry: 'Retail', status: 'archived',
        rawName: 'ZetaRetail Group', description: 'E-commerce platform', size: 'enterprise',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-007', name: 'EtaLogistics', domain: 'etalogistics.co',
        website: 'https://etalogistics.co', industry: 'Logistics', status: 'new',
        rawName: 'EtaLogistics', description: 'Supply chain management', size: 'mid-market',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-008', name: 'ThetaEnergy Corp', domain: 'thetaenergy.com',
        website: 'https://thetaenergy.com', industry: 'Energy', status: 'researching',
        rawName: 'ThetaEnergy Corp', description: 'Renewable energy solutions', size: 'enterprise',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-009', name: 'IotaSecurity', domain: 'iotasecurity.io',
        website: 'https://iotasecurity.io', industry: 'Technology', status: 'contacted',
        rawName: 'IotaSecurity', description: 'Cybersecurity platform', size: 'small',
        intelligenceScore: 0,
      },
    }),
    prisma.company.create({
      data: {
        id: 'ci-co-010', name: 'KappaMedia Group', domain: 'kappamedia.com',
        website: 'https://kappamedia.com', industry: 'Media', status: 'ready',
        rawName: 'KappaMedia Group', description: 'Digital media company', size: 'mid-market',
        intelligenceScore: 0,
      },
    }),
  ])
  console.log(`[seed-ci] Created ${companies.length} companies`)

  // ─── Contacts ─────────────────────────────────────────────────
  const emailHealths = ['valid', 'valid', 'risky', 'invalid', 'unknown'] as const
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        id: 'ci-con-001', firstName: 'Alice', lastName: 'Anderson',
        email: 'alice@alphatech.com', companyId: 'ci-co-001', status: 'active',
        title: 'CTO', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-002', firstName: 'Bob', lastName: 'Brown',
        email: 'bob@betafinance.io', companyId: 'ci-co-002', status: 'active',
        title: 'VP Engineering', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-003', firstName: 'Carol', lastName: 'Chen',
        email: 'carol@gammacloud.com', companyId: 'ci-co-003', status: 'active',
        title: 'Head of Sales', emailHealth: 'risky',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-004', firstName: 'David', lastName: 'Diaz',
        email: 'david@deltahealth.com', companyId: 'ci-co-004', status: 'active',
        title: 'CEO', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-005', firstName: 'Eva', lastName: 'Eriksson',
        email: 'eva@epsilonai.dev', companyId: 'ci-co-005', status: 'active',
        title: 'Director of AI', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-006', firstName: 'Frank', lastName: 'Foster',
        email: 'frank@zetaretail.com', companyId: 'ci-co-006', status: 'archived',
        title: 'COO', emailHealth: 'unknown',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-007', firstName: 'Grace', lastName: 'Gupta',
        email: 'grace@etalogistics.co', companyId: 'ci-co-007', status: 'active',
        title: 'VP Operations', emailHealth: 'invalid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-008', firstName: 'Henry', lastName: 'Huang',
        email: 'henry@thetaenergy.com', companyId: 'ci-co-008', status: 'active',
        title: 'CFO', emailHealth: 'valid',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-009', firstName: 'Iris', lastName: 'Ito',
        email: 'iris@iotasecurity.io', companyId: 'ci-co-009', status: 'active',
        title: 'CISO', emailHealth: 'risky',
      },
    }),
    prisma.contact.create({
      data: {
        id: 'ci-con-010', firstName: 'James', lastName: 'Jones',
        email: 'james@kappamedia.com', companyId: 'ci-co-010', status: 'active',
        title: 'VP Product', emailHealth: 'valid',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${contacts.length} contacts`)

  // ─── Opportunity Recommendations ─────────────────────────────────
  const opportunities = await Promise.all([
    prisma.opportunityRecommendation.create({
      data: {
        id: 'ci-opp-001', companyId: 'ci-co-001', contactId: 'ci-con-001',
        title: 'Enterprise SaaS Expansion', type: 'upsell',
        status: 'researching', score: 85, confidence: 0.9,
      },
    }),
    prisma.opportunityRecommendation.create({
      data: {
        id: 'ci-opp-002', companyId: 'ci-co-003', contactId: 'ci-con-003',
        title: 'Cloud Migration Services', type: 'new_business',
        status: 'contacted', score: 72, confidence: 0.8,
      },
    }),
    prisma.opportunityRecommendation.create({
      data: {
        id: 'ci-opp-003', companyId: 'ci-co-005', contactId: 'ci-con-005',
        title: 'AI Platform Integration', type: 'partnership',
        status: 'proposed', score: 91, confidence: 0.95,
      },
    }),
  ])
  console.log(`[seed-ci] Created ${opportunities.length} opportunities`)

  // ─── Company Research Cards ─────────────────────────────────────
  const researchCards = await Promise.all([
    prisma.companyResearchCard.create({
      data: {
        id: 'ci-rc-001', companyId: 'ci-co-001',
        summary: 'AlphaTech is expanding their cloud infrastructure.',
        source: 'industry_report', confidence: 0.85,
      },
    }),
    prisma.companyResearchCard.create({
      data: {
        id: 'ci-rc-002', companyId: 'ci-co-004',
        summary: 'DeltaHealth recently raised Series C funding.',
        source: 'news', confidence: 0.92,
      },
    }),
    prisma.companyResearchCard.create({
      data: {
        id: 'ci-rc-003', companyId: 'ci-co-008',
        summary: 'ThetaEnergy announced new solar panel technology.',
        source: 'press_release', confidence: 0.78,
      },
    }),
  ])
  console.log(`[seed-ci] Created ${researchCards.length} research cards`)

  // ─── Capability Assets ─────────────────────────────────────────
  const assets = await Promise.all([
    prisma.capabilityAsset.create({
      data: {
        id: 'ci-asset-001', companyId: 'ci-co-001',
        title: 'Cloud Infrastructure', category: 'technology',
        description: 'AWS and Azure cloud deployment capabilities',
      },
    }),
    prisma.capabilityAsset.create({
      data: {
        id: 'ci-asset-002', companyId: 'ci-co-005',
        title: 'AI/ML Platform', category: 'technology',
        description: 'Machine learning model training and deployment',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${assets.length} capability assets`)

  // ─── Drafts ───────────────────────────────────────────────────
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
        status: 'scheduled',
      },
    }),
  ])
  console.log(`[seed-ci] Created ${drafts.length} drafts`)

  // ─── Timeline Events ───────────────────────────────────────────
  const timelineEvents = await Promise.all([
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-001', companyId: 'ci-co-001',
        action: 'company_created', description: 'Company created in CRM',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-002', companyId: 'ci-co-001',
        action: 'contact_added', description: 'Alice Anderson added as contact',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-003', companyId: 'ci-co-003',
        action: 'research_updated', description: 'Research card updated',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-004', companyId: 'ci-co-004',
        action: 'email_validated', description: 'Email health check completed',
      },
    }),
    prisma.companyTimelineEvent.create({
      data: {
        id: 'ci-tl-005', companyId: 'ci-co-005',
        action: 'opportunity_created', description: 'AI Platform Integration opportunity created',
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
