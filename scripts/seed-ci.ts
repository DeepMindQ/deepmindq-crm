/**
 * Deterministic CI Seed — Minimal test data for API test validation
 *
 * Creates test data for the Enterprise Intelligence OS schema:
 *  - 5 organizations
 *  - 5 people
 *  - 3 relationships
 *  - 3 signals
 *  - 1 evidence
 *  - 2 insights
 *  - 1 briefing
 *  - 1 user
 *
 * Run: npx tsx scripts/seed-ci.ts
 * Env:  DATABASE_URL must be set
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed-ci] Starting deterministic seed...')

  // Clean existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany()
  await prisma.session.deleteMany()
  await prisma.dataIngestionRow.deleteMany()
  await prisma.dataIngestion.deleteMany()
  await prisma.briefing.deleteMany()
  await prisma.insight.deleteMany()
  await prisma.evidence.deleteMany()
  await prisma.signal.deleteMany()
  await prisma.relationship.deleteMany()
  await prisma.person.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()

  // ── Organizations ──
  const org1 = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Technology',
      website: 'https://acme.com',
      description: 'Enterprise software company',
      revenue: '$50M-$100M',
      employeeCount: 350,
      trackingStatus: 'active',
      intelligenceScore: 72,
      source: 'upload',
    },
  })
  const org2 = await prisma.organization.create({
    data: {
      name: 'Globex Inc',
      domain: 'globex.com',
      industry: 'Finance',
      website: 'https://globex.com',
      description: 'Financial services provider',
      revenue: '$100M-$500M',
      employeeCount: 750,
      trackingStatus: 'active',
      intelligenceScore: 85,
      source: 'crm',
    },
  })
  const org3 = await prisma.organization.create({
    data: {
      name: 'Initech',
      domain: 'initech.com',
      industry: 'Consulting',
      description: 'IT consulting firm',
      trackingStatus: 'paused',
      intelligenceScore: 45,
      source: 'manual',
    },
  })
  const org4 = await prisma.organization.create({
    data: {
      name: 'Umbrella Corp',
      domain: 'umbrella.co',
      industry: 'Biotech',
      description: 'Biotech research company',
      trackingStatus: 'active',
      intelligenceScore: 90,
      source: 'external',
    },
  })
  const org5 = await prisma.organization.create({
    data: {
      name: 'Stark Industries',
      domain: 'stark.industries',
      industry: 'Defense',
      description: 'Advanced technology and defense',
      revenue: '$1B+',
      employeeCount: 15000,
      trackingStatus: 'active',
      intelligenceScore: 95,
      source: 'ai_inferred',
    },
  })

  // ── People ──
  const person1 = await prisma.person.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@acme.com',
      title: 'CTO',
      organizationId: org1.id,
      source: 'upload',
    },
  })
  const person2 = await prisma.person.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@globex.com',
      title: 'VP Engineering',
      organizationId: org2.id,
      source: 'crm',
    },
  })
  const person3 = await prisma.person.create({
    data: {
      name: 'Carol White',
      email: 'carol@initech.com',
      title: 'CEO',
      organizationId: org3.id,
      source: 'manual',
    },
  })
  await prisma.person.create({
    data: {
      name: 'Diana Prince',
      email: 'diana@umbrella.co',
      title: 'Head of R&D',
      organizationId: org4.id,
      source: 'external',
    },
  })
  await prisma.person.create({
    data: {
      name: 'Tony Stark',
      email: 'tony@stark.industries',
      title: 'CEO',
      organizationId: org5.id,
      source: 'manual',
    },
  })

  // ── Relationships ──
  await prisma.relationship.create({
    data: {
      type: 'works_at',
      sourcePersonId: person1.id,
      targetOrgId: org1.id,
      label: 'CTO at Acme Corp',
      weight: 1.0,
    },
  })
  await prisma.relationship.create({
    data: {
      type: 'competes_with',
      sourceOrgId: org1.id,
      targetOrgId: org2.id,
      label: 'Technology competition',
      weight: 0.7,
    },
  })
  await prisma.relationship.create({
    data: {
      type: 'coworker',
      sourcePersonId: person1.id,
      targetPersonId: person2.id,
      label: 'Former colleagues',
      weight: 0.5,
    },
  })

  // ── Signals ──
  const signal1 = await prisma.signal.create({
    data: {
      signalType: 'hiring_change',
      severity: 'high',
      status: 'detected',
      title: 'Acme Corp hiring surge',
      description: 'Acme Corp posted 15 new engineering roles in the last week',
      organizationId: org1.id,
      confidenceScore: 85,
      detectedAt: new Date('2026-01-15'),
      source: 'external',
    },
  })
  await prisma.signal.create({
    data: {
      signalType: 'funding_event',
      severity: 'critical',
      status: 'analyzed',
      title: 'Globex Series C',
      description: 'Globex raised $200M Series C at $2B valuation',
      organizationId: org2.id,
      confidenceScore: 95,
      detectedAt: new Date('2026-01-10'),
      source: 'external',
    },
  })
  await prisma.signal.create({
    data: {
      signalType: 'technology_change',
      severity: 'medium',
      status: 'validated',
      title: 'Stark Industries adopts Kubernetes',
      description: 'Migration from monolith to microservices detected',
      organizationId: org5.id,
      confidenceScore: 75,
      detectedAt: new Date('2026-01-12'),
      source: 'ai_inferred',
    },
  })

  // ── Evidence ──
  await prisma.evidence.create({
    data: {
      signalId: signal1.id,
      organizationId: org1.id,
      claim: 'Acme Corp is actively hiring engineering talent',
      sourceType: 'job_posting',
      sourceUrl: 'https://linkedin.com/jobs/acme-corp',
      excerpt: '15 new engineering positions posted in the last week',
      reliability: 'likely',
    },
  })

  // ── Insights ──
  await prisma.insight.create({
    data: {
      category: 'opportunity',
      title: 'Acme Corp expansion opportunity',
      narrative: 'Hiring surge suggests expansion phase. Good timing for outreach about enterprise solutions.',
      organizationId: org1.id,
      signalId: signal1.id,
      signalIds: [signal1.id],
      confidence: 'high',
      confidenceScore: 80,
    },
  })
  await prisma.insight.create({
    data: {
      category: 'risk',
      title: 'Globex competitive threat',
      narrative: 'Series C funding positions Globex to compete in our core market segment.',
      organizationId: org2.id,
      confidence: 'medium',
      confidenceScore: 70,
      recommendation: 'Monitor Globex product launches and partnership announcements',
    },
  })

  // ── Briefing ──
  await prisma.briefing.create({
    data: {
      organizationId: org1.id,
      executiveSummary: 'Acme Corp shows strong growth signals with 15 new engineering hires and expanding product line.',
      keyFindings: ['Engineering hiring surge', 'New product team forming', 'Budget expansion confirmed'],
      opportunityScore: 78,
      signalCount: 1,
      activeSignals: 1,
      insightCount: 1,
    },
  })

  // ── User ──
  await prisma.user.create({
    data: {
      name: 'CI Test User',
      email: 'ci-test@deepmindq.com',
      role: 'admin',
    },
  })

  console.log('[seed-ci] Seed complete.')
  console.log('  Organizations: 5')
  console.log('  People: 5')
  console.log('  Relationships: 3')
  console.log('  Signals: 3')
  console.log('  Evidence: 1')
  console.log('  Insights: 2')
  console.log('  Briefings: 1')
  console.log('  Users: 1')
}

main()
  .catch((e) => {
    console.error('[seed-ci] Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
