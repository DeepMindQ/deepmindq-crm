/**
 * seed-cloud.js
 * 
 * Seeds the PostgreSQL database with the 40K+ contacts from embedded JSON data.
 * This runs on Vercel as a post-deploy step via the /api/seed endpoint.
 * 
 * For initial setup, run locally:
 *   DB_PROVIDER=postgresql DATABASE_URL="<neon-url>" node scripts/seed-cloud.js
 */

const { PrismaClient } = require('@prisma/client');

// --- Data generated from the import ---
const COMPANIES = require('./seed-data/companies.json');
const CONTACTS = require('./seed-data/contacts.json');
const SEED_META = require('./seed-data/meta.json');

const BATCH_SIZE = 200;

async function seed() {
  console.log('🌱 Starting cloud seed...');
  const t0 = Date.now();
  
  const db = new PrismaClient();
  
  // Check if already seeded
  const existing = await db.company.count();
  if (existing > 0) {
    console.log(`✅ Database already has ${existing} companies. Skipping seed.`);
    await db.$disconnect();
    return;
  }
  
  // 1. Import Batch
  console.log('  Creating import batch...');
  const batch = await db.importBatch.create({
    data: {
      fileName: SEED_META.fileName,
      fileHash: SEED_META.fileHash,
      totalRows: SEED_META.totalRows,
      acceptedRows: SEED_META.acceptedRows,
      status: 'completed',
    },
  });
  
  // 2. Companies (batch insert)
  console.log(`  Seeding ${COMPANIES.length} companies...`);
  for (let i = 0; i < COMPANIES.length; i += BATCH_SIZE) {
    const chunk = COMPANIES.slice(i, i + BATCH_SIZE).map(c => ({
      id: c.id,
      rawName: c.rawName,
      normalizedName: c.normalizedName,
      domain: c.domain || null,
      industry: c.industry || null,
      sizeRange: c.sizeRange || null,
      location: c.location || null,
      country: c.country || null,
      website: c.website || null,
      tags: c.tags || '[]',
      status: c.status || 'prospect',
      lifecycleStage: c.lifecycleStage || 'discovery',
      source: 'import',
    }));
    await db.company.createMany({ data: chunk, skipDuplicates: true });
    if ((i / BATCH_SIZE) % 10 === 0) console.log(`    Companies: ${Math.min(i + BATCH_SIZE, COMPANIES.length)}/${COMPANIES.length}`);
  }
  
  // 3. Contacts (batch insert)
  console.log(`  Seeding ${CONTACTS.length} contacts...`);
  for (let i = 0; i < CONTACTS.length; i += BATCH_SIZE) {
    const chunk = CONTACTS.slice(i, i + BATCH_SIZE).map(c => ({
      id: c.id,
      rawName: c.rawName,
      normalizedName: c.normalizedName,
      email: c.email,
      title: c.title || null,
      role: c.role || null,
      linkedinUrl: c.linkedinUrl || null,
      companyId: c.companyId,
      batchId: batch.id,
      source: c.source || 'cold_list',
      leadScore: c.leadScore || 0,
      companyFitScore: c.companyFitScore || 0,
      engagementScore: c.engagementScore || 0,
      enrichmentScore: c.enrichmentScore || 0,
      aiConversionScore: c.aiConversionScore || 0,
    }));
    await db.contact.createMany({ data: chunk, skipDuplicates: true });
    if ((i / BATCH_SIZE) % 20 === 0) console.log(`    Contacts: ${Math.min(i + BATCH_SIZE, CONTACTS.length)}/${CONTACTS.length}`);
  }
  
  // 4. Segments
  console.log('  Creating segments...');
  const SEGMENTS = require('./seed-data/segments.json');
  const segCompanies = await db.company.groupBy({ by: ['industry'], where: { industry: { not: null } }, take: 22, orderBy: { _count: { id: 'desc' } } });
  
  for (let i = 0; i < Math.min(segCompanies.length, 22); i++) {
    const ind = segCompanies[i].industry;
    const companyIds = (await db.company.findMany({ where: { industry: ind }, select: { id: true }, take: 500 })).map(c => c.id);
    const contacts = await db.contact.findMany({ where: { companyId: { in: companyIds } }, select: { id: true }, take: 500 });
    
    await db.segment.create({
      data: {
        name: `${ind} Companies`,
        description: `Auto-segment: All companies in ${ind} industry`,
        rules: JSON.stringify([{ field: 'industry', operator: 'equals', value: ind }]),
      },
    });
    // Add contacts to segment
    if (contacts.length > 0) {
      const seg = await db.segment.findFirst({ where: { name: `${ind} Companies` } });
      if (seg) {
        await db.segmentContact.createMany({
          data: contacts.slice(0, 500).map(c => ({ contactId: c.id, segmentId: seg.id })),
          skipDuplicates: true,
        });
      }
    }
  }
  
  // 5. Templates & Sequences
  console.log('  Creating templates and sequences...');
  const templates = [
    { name: 'Initial Outreach', subject: 'Quick question about {{company}}', body: 'Hi {{firstName}},\n\nI noticed {{company}} is doing great work in {{industry}}.\n\nWould you be open to a brief conversation about how we can help?\n\nBest,\n{{senderName}}', category: 'outreach' },
    { name: 'Follow Up', subject: 'Re: {{subject}}', body: 'Hi {{firstName}},\n\nJust following up on my previous email. I wanted to share a quick case study relevant to {{company}}.\n\nWould 15 minutes work this week?\n\nBest regards', category: 'follow_up' },
    { name: 'Value Proposition', subject: 'How {{company}} can {{benefit}}', body: 'Hi {{firstName}},\n\nI have some insights specifically for {{company}} in the {{industry}} space.\n\nOur clients in similar roles have seen measurable results. Would love to share more.\n\nBest,\n{{senderName}}', category: 'value_prop' },
    { name: 'Meeting Request', subject: '15 min to discuss {{company}} growth', body: 'Hi {{firstName}},\n\nI have a few ideas that could directly impact {{company}}\'s growth trajectory.\n\nCan we schedule a brief call this week?\n\nThanks,\n{{senderName}}', category: 'meeting' },
    { name: 'Breakup Email', subject: 'Should I close the file on {{company}}?', body: 'Hi {{firstName}},\n\nI\'ve reached out a few times but haven\'t heard back. I don\'t want to be a pest.\n\nIf now isn\'t the right time, no worries. Feel free to reach out whenever it makes sense.\n\nBest,\n{{senderName}}', category: 'breakup' },
  ];
  
  for (const t of templates) {
    await db.emailTemplate.create({ data: t });
  }
  
  const seq1 = await db.emailSequence.create({ data: { name: 'Multi-Touch Outreach', description: '5-step sequence for cold outreach', isActive: true } });
  const seq2 = await db.emailSequence.create({ data: { name: 'Warm Lead Nurture', description: '3-step sequence for warm leads', isActive: true } });
  
  await db.sequenceStep.createMany({
    data: [
      { sequenceId: seq1.id, stepNumber: 1, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Initial Outreach' } }))!.id, delayDays: 0, type: 'email' },
      { sequenceId: seq1.id, stepNumber: 2, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Follow Up' } }))!.id, delayDays: 3, type: 'email' },
      { sequenceId: seq1.id, stepNumber: 3, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Value Proposition' } }))!.id, delayDays: 7, type: 'email' },
      { sequenceId: seq1.id, stepNumber: 4, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Meeting Request' } }))!.id, delayDays: 12, type: 'email' },
      { sequenceId: seq1.id, stepNumber: 5, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Breakup Email' } }))!.id, delayDays: 18, type: 'email' },
      { sequenceId: seq2.id, stepNumber: 1, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Value Proposition' } }))!.id, delayDays: 0, type: 'email' },
      { sequenceId: seq2.id, stepNumber: 2, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Follow Up' } }))!.id, delayDays: 5, type: 'email' },
      { sequenceId: seq2.id, stepNumber: 3, templateId: (await db.emailTemplate.findFirst({ where: { name: 'Meeting Request' } }))!.id, delayDays: 10, type: 'email' },
    ],
    skipDuplicates: true,
  });
  
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Seed completed in ${elapsed}s`);
  console.log(`   Companies: ${COMPANIES.length}`);
  console.log(`   Contacts: ${CONTACTS.length}`);
  
  await db.$disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});