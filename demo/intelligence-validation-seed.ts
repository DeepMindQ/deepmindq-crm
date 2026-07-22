/**
 * Phase 6.1 Demo Seed Dataset
 *
 * Seeds 5 Middle Eastern companies with realistic signals, evidence,
 * conflicts, recommendations, and validation scores for demonstrations.
 *
 * Usage: npx tsx demo/intelligence-validation-seed.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const COMPANIES = [
  {
    name: 'Saudi Aramco',
    domain: 'aramco.com',
    industry: 'Oil & Gas',
    sizeRange: '10000+',
    location: 'Dhahran, Saudi Arabia',
    country: 'Saudi Arabia',
    website: 'https://aramco.com',
  },
  {
    name: 'Emirates NBD',
    domain: 'emiratesnbd.com',
    industry: 'Banking & Finance',
    sizeRange: '5000-10000',
    location: 'Dubai, UAE',
    country: 'UAE',
    website: 'https://emiratesnbd.com',
  },
  {
    name: 'STC',
    domain: 'stc.com.sa',
    industry: 'Telecommunications',
    sizeRange: '5000-10000',
    location: 'Riyadh, Saudi Arabia',
    country: 'Saudi Arabia',
    website: 'https://stc.com.sa',
  },
  {
    name: 'ADNOC',
    domain: 'adnoc.ae',
    industry: 'Oil & Gas',
    sizeRange: '10000+',
    location: 'Abu Dhabi, UAE',
    country: 'UAE',
    website: 'https://adnoc.ae',
  },
  {
    name: 'NEOM',
    domain: 'neom.com',
    industry: 'Technology & Innovation',
    sizeRange: '1000-5000',
    location: 'Tabuk, Saudi Arabia',
    country: 'Saudi Arabia',
    website: 'https://neom.com',
  },
];

const SIGNALS = [
  { type: 'technology_adoption', description: 'Cloud migration announcement', impact: 'high', confidence: 0.92 },
  { type: 'hiring_surge', description: 'Cloud engineering hiring spike (+40% YoY)', impact: 'high', confidence: 0.88 },
  { type: 'funding_event', description: 'Major digital transformation budget approved', impact: 'high', confidence: 0.95 },
  { type: 'executive_change', description: 'New CTO appointed with cloud background', impact: 'medium', confidence: 0.75 },
  { type: 'technology_adoption', description: 'AI/ML platform evaluation in progress', impact: 'medium', confidence: 0.70 },
  { type: 'partnership', description: 'Partnership announced with global cloud provider', impact: 'high', confidence: 0.90 },
  { type: 'hiring_surge', description: 'Cybersecurity team expansion (+25%)', impact: 'medium', confidence: 0.82 },
  { type: 'technology_adoption', description: 'Kubernetes adoption signals detected', impact: 'medium', confidence: 0.78 },
];

const EVIDENCE_TEMPLATES = [
  { url: 'https://linkedin.com/company/{domain}/jobs', title: 'LinkedIn Job Postings', tier: 'primary' },
  { url: 'https://gulfnews.com/business/tech/{domain}-expansion', title: 'Gulf News Coverage', tier: 'secondary' },
  { url: 'https://reuters.com/technology/{domain}-cloud', title: 'Reuters Technology Report', tier: 'primary' },
  { url: 'https://zawya.com/en/press/{domain}-announcement', title: 'Zawya Press Release', tier: 'secondary' },
  { url: 'https://arabianbusiness.com/{domain}-strategy', title: 'Arabian Business Analysis', tier: 'tertiary' },
];

async function seed() {
  console.log('Seeding Phase 6.1 demo data...');

  // Source reliability presets
  const domainReliability: Record<string, number> = {
    'linkedin.com': 0.92,
    'reuters.com': 0.95,
    'gulfnews.com': 0.75,
    'zawya.com': 0.70,
    'arabianbusiness.com': 0.65,
  };

  // Seed source reliability
  for (const [domain, score] of Object.entries(domainReliability)) {
    await db.evidenceSourceReliability.upsert({
      where: { domain },
      create: { domain, totalEvidence: 50, validatedCorrect: Math.round(50 * score), validatedIncorrect: Math.round(50 * (1 - score)), reliabilityScore: score },
      update: {},
    });
  }
  console.log('  Source reliability seeded');

  for (const comp of COMPANIES) {
    // Create or find company
    const company = await db.company.upsert({
      where: { id: `demo-${comp.domain}` },
      create: {
        id: `demo-${comp.domain}`,
        rawName: comp.name,
        normalizedName: comp.name.toLowerCase(),
        domain: comp.domain,
        industry: comp.industry,
        sizeRange: comp.sizeRange,
        location: comp.location,
        country: comp.country,
        website: comp.website,
        intelligenceScore: Math.floor(Math.random() * 30 + 55),
      },
      update: {},
    });

    // Create 3-5 signals per company
    const shuffled = [...SIGNALS].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3));
    const signalIds: string[] = [];

    for (const sig of shuffled) {
      const signal = await db.companySignal.create({
        data: {
          companyId: company.id,
          signalType: sig.type,
          description: sig.description,
          impact: sig.impact,
          confidence: sig.confidence,
          signalDate: new Date(Date.now() - Math.random() * 90 * 86400000),
          status: 'active',
          source: 'demo_seed',
        },
      });
      signalIds.push(signal.id);

      // Create 2-4 evidence items per signal
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const template = EVIDENCE_TEMPLATES[i % EVIDENCE_TEMPLATES.length];
        await db.evidence.create({
          data: {
            companyId: company.id,
            sourceUrl: template.url.replace('{domain}', comp.domain),
            title: template.title,
            sourceQualityTier: template.tier,
            relevanceScore: 0.5 + Math.random() * 0.5,
            extractedField: 'digital_transformation',
            confidence: 0.6 + Math.random() * 0.4,
            sourceDate: new Date(Date.now() - Math.random() * 60 * 86400000),
          },
        });
      }
    }

    // Create signal validations
    const validCount = Math.ceil(signalIds.length * 0.6);
    for (let i = 0; i < signalIds.length; i++) {
      await db.signalValidation.create({
        data: {
          companyId: company.id,
          signalId: signalIds[i],
          validationStatus: i < validCount ? 'VALID' : 'WEAK',
          confidenceScore: i < validCount ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3,
          evidenceCount: 2 + Math.floor(Math.random() * 4),
          sourceDomainCount: 1 + Math.floor(Math.random() * 3),
          signalAge: Math.floor(Math.random() * 60),
        },
      });
    }

    // Create intelligence health
    const healthScore = Math.floor(Math.random() * 40 + 50);
    await db.companyIntelligenceHealth.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        dataCompletenessScore: Math.floor(Math.random() * 30 + 60),
        signalQualityScore: Math.floor(Math.random() * 30 + 55),
        evidenceStrengthScore: Math.floor(Math.random() * 30 + 50),
        overallHealthScore: healthScore,
        healthTier: healthScore >= 70 ? 'GOOD' : 'FAIR',
      },
      update: {
        dataCompletenessScore: Math.floor(Math.random() * 30 + 60),
        signalQualityScore: Math.floor(Math.random() * 30 + 55),
        evidenceStrengthScore: Math.floor(Math.random() * 30 + 50),
        overallHealthScore: healthScore,
        healthTier: healthScore >= 70 ? 'GOOD' : 'FAIR',
      },
    });

    // Create a conflict for 2 of 5 companies
    if (Math.random() > 0.5) {
      await db.intelligenceConflict.create({
        data: {
          companyId: company.id,
          conflictType: 'SIGNAL_CONTRADICTION',
          description: `Conflicting signals: on-premise expansion reported alongside cloud migration plans`,
          severity: 'MEDIUM',
          resolutionStatus: 'open',
        },
      });
    }

    console.log(`  Seeded ${company.normalizedName} with ${signalIds.length} signals`);
  }

  console.log('\nDemo seed complete. 5 companies ready for demonstration.');
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect());
