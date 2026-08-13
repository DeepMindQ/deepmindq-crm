/**
 * Deterministic CI Seed — Enterprise Intelligence OS
 *
 * Run: npx tsx scripts/seed-ci.ts
 * Env:  DATABASE_URL must be set
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed-ci] Starting deterministic seed...')

  // Clean (respect FK order)
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
    data: { name: 'Initech', domain: 'initech.com', industry: 'Consulting', description: 'IT consulting firm', trackingStatus: 'paused', intelligenceScore: 45, source: 'manual' },
  })
  const org4 = await prisma.organization.create({
    data: { name: 'Umbrella Corp', domain: 'umbrella.co', industry: 'Biotech', description: 'Biotech research company', trackingStatus: 'active', intelligenceScore: 90, source: 'external' },
  })
  const org5 = await prisma.organization.create({
    data: { name: 'Stark Industries', domain: 'stark.industries', industry: 'Defense', description: 'Advanced technology and defense', revenue: '$1B+', employeeCount: 15000, trackingStatus: 'active', intelligenceScore: 95, source: 'ai_inferred' },
  })

  // ── People (model uses "fullName") ──
  const person1 = await prisma.person.create({
    data: { fullName: 'Alice Johnson', email: 'alice@acme.com', title: 'CTO', organizationId: org1.id, source: 'upload' },
  })
  const person2 = await prisma.person.create({
    data: { fullName: 'Bob Smith', email: 'bob@globex.com', title: 'VP Engineering', organizationId: org2.id, source: 'crm' },
  })
  await prisma.person.create({
    data: { fullName: 'Carol White', email: 'carol@initech.com', title: 'CEO', organizationId: org3.id, source: 'manual' },
  })
  await prisma.person.create({
    data: { fullName: 'Diana Prince', email: 'diana@umbrella.co', title: 'Head of R&D', organizationId: org4.id, source: 'external' },
  })
  await prisma.person.create({
    data: { fullName: 'Tony Stark', email: 'tony@stark.industries', title: 'CEO', organizationId: org5.id, source: 'manual' },
  })

  // ── Relationships (polymorphic FKs: sourceOrgId, targetOrgId, sourcePersonId, targetPersonId) ──
  await prisma.relationship.create({
    data: { type: 'works_at', sourcePersonId: person1.id, targetOrgId: org1.id, label: 'CTO at Acme Corp', weight: 1.0 },
  })
  await prisma.relationship.create({
    data: { type: 'competes_with', sourceOrgId: org1.id, targetOrgId: org2.id, label: 'Technology competition', weight: 0.7 },
  })
  await prisma.relationship.create({
    data: { type: 'coworker', sourcePersonId: person1.id, targetPersonId: person2.id, label: 'Former colleagues', weight: 0.5 },
  })

  // ── Signals (model uses "signalType", "organizationId", "confidenceScore") ──
  const signal1 = await prisma.signal.create({
    data: { signalType: 'hiring_change', severity: 'high', status: 'detected', title: 'Acme Corp hiring surge', description: 'Posted 15 new engineering roles', organizationId: org1.id, confidenceScore: 85, detectedAt: new Date('2026-01-15'), source: 'external' },
  })
  await prisma.signal.create({
    data: { signalType: 'funding_event', severity: 'critical', status: 'analyzed', title: 'Globex Series C', description: 'Raised $200M at $2B valuation', organizationId: org2.id, confidenceScore: 95, detectedAt: new Date('2026-01-10'), source: 'external' },
  })
  await prisma.signal.create({
    data: { signalType: 'technology_change', severity: 'medium', status: 'validated', title: 'Stark Industries adopts Kubernetes', description: 'Migration to microservices', organizationId: org5.id, confidenceScore: 75, detectedAt: new Date('2026-01-12'), source: 'ai_inferred' },
  })

  // ── Evidence (model: "claim" required, "organizationId" required) ──
  await prisma.evidence.create({
    data: { signalId: signal1.id, organizationId: org1.id, claim: 'Acme Corp actively hiring engineering talent', sourceType: 'job_posting', sourceUrl: 'https://linkedin.com/jobs/acme-corp', excerpt: '15 new engineering positions posted', reliability: 'likely' },
  })

  // ── Insights (model: "category", "narrative", "confidence" enum, "confidenceScore" Float) ──
  await prisma.insight.create({
    data: { category: 'opportunity', title: 'Acme Corp expansion opportunity', narrative: 'Hiring surge suggests expansion. Good timing for outreach.', organizationId: org1.id, signalId: signal1.id, signalIds: [signal1.id], confidence: 'high', confidenceScore: 80 },
  })
  await prisma.insight.create({
    data: { category: 'risk', title: 'Globex competitive threat', narrative: 'Series C positions Globex to compete in core market.', organizationId: org2.id, confidence: 'medium', confidenceScore: 70, recommendation: 'Monitor product launches' },
  })

  // ── Briefing (model: "executiveSummary" required, no "title"/"status") ──
  await prisma.briefing.create({
    data: { organizationId: org1.id, executiveSummary: 'Acme Corp shows strong growth signals.', keyFindings: ['Engineering hiring surge', 'New product team'], opportunityScore: 78, signalCount: 1, activeSignals: 1, insightCount: 1 },
  })

  // ── User ──
  await prisma.user.create({
    data: { email: 'ci-test@deepmindq.com', name: 'CI Test User', role: 'admin' },
  })

  console.log('[seed-ci] Done. 5 orgs, 5 people, 3 relationships, 3 signals, 1 evidence, 2 insights, 1 briefing, 1 user')
}

main()
  .catch((e) => { console.error('[seed-ci] FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
