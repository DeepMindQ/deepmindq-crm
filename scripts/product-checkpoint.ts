/**
 * Product Readiness Checkpoint Script
 * 
 * Selects 3 companies (enterprise/mid-market/small) and outputs
 * all existing intelligence data for briefing generation.
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function parseSizeNum(sizeRange: string | null): number {
  if (!sizeRange) return 0
  // Extract the largest number from sizeRange like "10,001+", "501-1,000", "1-10"
  const nums = sizeRange.match(/\d+/g)
  if (!nums || nums.length === 0) return 0
  return Math.max(...nums.map(n => parseInt(n)))
}

async function main() {
  const companies = await db.company.findMany({
    select: {
      id: true,
      rawName: true,
      industry: true,
      domain: true,
      sizeRange: true,
      country: true,
      location: true,
      website: true,
    },
    where: { sizeRange: { not: null } },
    take: 100,
  })

  // Categorize by size using sizeRange string
  const enterprise = companies.filter(c => parseSizeNum(c.sizeRange) >= 10000)
  const midMarket = companies.filter(c => {
    const n = parseSizeNum(c.sizeRange)
    return n >= 200 && n < 10000
  })
  const small = companies.filter(c => {
    const n = parseSizeNum(c.sizeRange)
    return n > 0 && n < 200
  })

  const ent = enterprise[0] || companies[0]
  const mid = midMarket[0] || companies[10] || companies[1]
  const sm = small[0] || companies[20] || companies[2]
  const selected = [ent, mid, sm]

  console.log('=== SELECTED COMPANIES ===')
  for (const c of selected) {
    console.log(JSON.stringify({
      id: c.id,
      name: c.rawName,
      industry: c.industry,
      sizeRange: c.sizeRange,
      parsedSize: parseSizeNum(c.sizeRange),
      country: c.country,
      domain: c.domain,
    }, null, 2))
  }

  // Existing signals
  console.log('\n=== EXISTING SIGNALS ===')
  for (const c of selected) {
    const signals = await db.companySignal.findMany({
      where: { companyId: c.id },
      select: {
        id: true,
        signalType: true,
        title: true,
        description: true,
        severity: true,
        confidence: true,
        businessImpact: true,
        recommendedAction: true,
        timingWindow: true,
        source: true,
        sourceUrl: true,
        signalDate: true,
        extractedAt: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    console.log(`\n--- ${c.rawName} (${signals.length} signals) ---`)
    for (const s of signals) {
      console.log(JSON.stringify({
        type: s.signalType,
        severity: s.severity,
        confidence: Math.round(s.confidence * 100),
        title: s.title?.substring(0, 200),
        impact: s.businessImpact?.substring(0, 200),
        action: s.recommendedAction?.substring(0, 200),
        timing: s.timingWindow,
        source: s.source,
        signalDate: s.signalDate?.toISOString().split('T')[0],
        extractedAt: s.extractedAt?.toISOString().split('T')[0],
      }, null, 2))
    }
  }

  // Key contacts
  console.log('\n=== KEY CONTACTS ===')
  for (const c of selected) {
    const contacts = await db.contact.findMany({
      where: { companyId: c.id },
      select: {
        rawName: true,
        title: true,
        role: true,
        email: true,
        linkedinUrl: true,
        location: true,
        leadScore: true,
        companyFitScore: true,
      },
      take: 10,
      orderBy: { companyFitScore: 'desc' },
    })

    console.log(`\n--- ${c.rawName} contacts (${contacts.length}) ---`)
    for (const contact of contacts) {
      console.log(JSON.stringify({
        name: contact.rawName,
        title: contact.title,
        role: contact.role,
        email: contact.email,
        leadScore: contact.leadScore,
        fitScore: contact.companyFitScore,
      }, null, 2))
    }
  }

  // Intelligence objects
  console.log('\n=== INTELLIGENCE OBJECTS ===')
  for (const c of selected) {
    const objects = await db.intelligenceObject.findMany({
      where: { companyId: c.id },
      select: {
        id: true,
        content: true,
        summary: true,
        sourceType: true,
        sourceName: true,
        originalConfidence: true,
        capturedAt: true,
        sourceUrl: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: 10,
    })

    console.log(`\n--- ${c.rawName} intelligence objects (${objects.length}) ---`)
    for (const obj of objects) {
      console.log(JSON.stringify({
        type: obj.sourceType,
        source: obj.sourceName,
        confidence: Math.round(obj.originalConfidence * 100),
        summary: obj.summary?.substring(0, 200) || obj.content?.substring(0, 200),
        url: obj.sourceUrl,
      }, null, 2))
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
